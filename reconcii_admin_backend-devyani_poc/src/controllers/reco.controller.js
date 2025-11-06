const db = require("../models");
const { Op, fn, col, literal, Sequelize } = require("sequelize");
const ExcelJS = require("exceljs");
const dayjs = require("dayjs");
const {
  THREE_PO_VS_POS_REASONS,
  THREE_PO_VS_POS_REASON_LIST,
  THREEPO_EXCEL_MISMATCH_REASONS,
  THREE_PO_SELF_MISMATCH_REASON_LIST,
  CALCULATED_3PO_MISMATCH_SHEETS,
} = require("../constants/3POvsPOSUnreconciReasons");
const { fork } = require("child_process");
// const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");

// Add status tracking object
const generationStatus = {};

function shortenSheetName(name) {
  const parts = name.split("_");
  const abbrev = parts.map((part) => part.slice(0, 3)).join("_");
  return abbrev;
}

// Helper function to generate dates between start and end date
const getDatesInRange = (startDate, endDate) => {
  const dates = [];
  let currentDate = new Date(startDate);
  const lastDate = new Date(endDate);

  while (currentDate <= lastDate) {
    dates.push(new Date(currentDate).toISOString().split("T")[0]);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return dates;
};

// Helper function to get database field mapping
const getDbFieldMapping = async (dataSource) => {
  try {
    const dbFields = await db.table_columns_mapping.findAll({
      where: {
        data_source: dataSource,
      },
      attributes: ["excel_column_name", "db_column_name"],
    });

    const mapping = {};
    dbFields.forEach((field) => {
      mapping[field.excel_column_name] = field.db_column_name;
    });

    return mapping;
  } catch (error) {
    throw error;
  }
};

// Helper function to resolve formula references
const resolveFormulaReferences = (formula, calculatedValues) => {
  let resolvedFormula = formula;

  // Replace references to calculated values with their formulas
  Object.entries(calculatedValues).forEach(([key, value]) => {
    const regex = new RegExp(`\\b${key}\\b`, "g");
    resolvedFormula = resolvedFormula.replace(regex, `(${value})`);
  });

  return resolvedFormula;
};

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Helper function to replace Excel columns with DB columns
const replaceExcelWithDbColumns = (formula, dbFieldMapping) => {
  let resolvedFormula = formula;

  // Replace Excel column names with DB column names
  Object.entries(dbFieldMapping).forEach(([excelCol, dbCol]) => {
    const escapedExcelCol = escapeRegex(excelCol);
    const regex = new RegExp(`\\b${escapedExcelCol}\\b`, "gi");
    resolvedFormula = resolvedFormula.replace(regex, dbCol);
  });

  return resolvedFormula;
};

const calculateSlabRate = (netAmount) => {
  if (netAmount < 400) {
    return 0.165;
  } else if (netAmount < 450) {
    return 0.1525;
  } else if (netAmount < 500) {
    return 0.145;
  } else if (netAmount < 550) {
    return 0.1375;
  } else if (netAmount < 600) {
    return 0.1325;
  } else {
    return 0.1275;
  }
};

const formulaForPosSummary = async () => {
  try {
    // Get database field mapping
    const dbFieldMapping = await getDbFieldMapping("POS_ORDERS");

    // Define the calculation formulas
    const calculatedValues = {
      slab_rate: "slab_rate",
      pos_net_amount: "Payment",
      pos_tax_paid_by_customer: "Payment * 0.05",
      pos_commission_value: "pos_net_amount * slab_rate",
      pos_pg_applied_on: "pos_net_amount + pos_tax_paid_by_customer",
      pos_pg_charge: "pos_pg_applied_on * 0.011",
      pos_taxes_zomato_fee: "(pos_commission_value + pos_pg_charge) * 0.18",
      pos_tds_amount: "pos_net_amount * 0.001",
      pos_final_amount:
        "pos_net_amount - pos_commission_value - pos_pg_charge - pos_taxes_zomato_fee - pos_tds_amount",
    };

    const updatedCalculatedValues = { ...calculatedValues };

    for (const [key, formula] of Object.entries(calculatedValues)) {
      // First resolve any references to other calculated values
      let resolvedFormula = resolveFormulaReferences(
        formula,
        updatedCalculatedValues
      );

      // Then replace Excel columns with DB columns
      resolvedFormula = replaceExcelWithDbColumns(
        resolvedFormula,
        dbFieldMapping
      );

      updatedCalculatedValues[key] = resolvedFormula;
    }

    return updatedCalculatedValues;
  } catch (error) {
    throw error;
  }
};

const createPosSummaryRecords = async () => {
  console.log("📍 [createPosSummaryRecords] Function started");
  try {
    // Get total count first to process in batches
    console.log("📍 [createPosSummaryRecords] Getting total count of POS orders...");
    const totalCount = await db.orders.count({
      where: {
        online_order_taker: "ZOMATO",
      },
      logging: (sql) => {
        console.log("📊 [SQL] createPosSummaryRecords - Count Query:");
        console.log("   ", sql);
      },
    });
    console.log(`📍 [createPosSummaryRecords] Total POS orders found: ${totalCount}`);

    if (totalCount === 0) {
      return;
    }

    // Get formulas for calculations
    console.log("📍 [createPosSummaryRecords] Fetching POS summary formulas...");
    const formulas = await formulaForPosSummary();
    console.log(`📍 [createPosSummaryRecords] Loaded ${Object.keys(formulas).length} formulas`);

    // Pre-compile regex for column extraction
    const columnRegex = /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g;

    // Get all unique column names from formulas once
    console.log("📍 [createPosSummaryRecords] Extracting unique columns from formulas...");
    const uniqueColumns = new Set();
    Object.values(formulas).forEach((formula) => {
      const matches = formula.match(columnRegex) || [];
      matches.forEach((col) => uniqueColumns.add(col));
    });
    console.log(`📍 [createPosSummaryRecords] Found ${uniqueColumns.size} unique columns in formulas`);

    // Process in batches to avoid memory issues
    const BATCH_SIZE = 1000;
    let offset = 0;
    let totalProcessed = 0;
    let totalCreated = 0;
    let totalUpdated = 0;

    while (offset < totalCount) {
      // Fetch batch of POS orders
      console.log(`📍 [createPosSummaryRecords] Fetching batch: offset=${offset}, limit=${BATCH_SIZE}`);
      const posOrders = await db.orders.findAll({
        attributes: [
          "instance_id",
          "store_name",
          "date",
          "payment",
          "subtotal",
          "discount",
          "net_sale",
          "gst_at_5_percent",
          "gst_ecom_at_5_percent",
          "packaging_charge",
          "gross_amount",
        ],
        where: {
          online_order_taker: "ZOMATO",
        },
        raw: true,
        limit: BATCH_SIZE,
        offset: offset,
        order: [["instance_id", "ASC"]],
        logging: (sql) => {
          console.log(`📊 [SQL] createPosSummaryRecords - Batch Query (offset ${offset}):`);
          console.log("   ", sql);
        },
      });
      console.log(`📍 [createPosSummaryRecords] Fetched ${posOrders.length} orders in this batch`);

      if (!posOrders || posOrders.length === 0) {
        break;
      }

      // Prepare bulk operations for this batch
      const bulkCreateRecords = [];
      const bulkUpdateRecords = [];

      // Get existing records for this batch only
      const orderIds = posOrders.map((order) => order.instance_id);
      console.log(`📍 [createPosSummaryRecords] Checking ${orderIds.length} existing records in summary table...`);
      const existingRecords = await db.zomato_vs_pos_summary.findAll({
        where: {
          pos_order_id: { [Op.in]: orderIds },
        },
        raw: true,
        logging: (sql) => {
          console.log(`📊 [SQL] createPosSummaryRecords - Check Existing Records Query (batch ${offset}):`);
          console.log("   ", sql);
        },
      });
      console.log(`📍 [createPosSummaryRecords] Found ${existingRecords.length} existing records to update`);

      // Create a map of existing records for faster lookup
      const existingRecordsMap = new Map(
        existingRecords.map((record) => [record.pos_order_id, record])
      );

      console.log(`📍 [createPosSummaryRecords] Processing ${posOrders.length} orders in batch ${offset}...`);
      let processedInBatch = 0;
      for (const order of posOrders) {
        try {
          processedInBatch++;
          if (processedInBatch % 100 === 0) {
            console.log(`📍 [createPosSummaryRecords] Processing order ${processedInBatch}/${posOrders.length} in batch ${offset}`);
          }
          // Create context object
          const context = {};
          for (const col of uniqueColumns) {
            if (col === "0") continue;
            else if (col === "slab_rate") {
              context[col] = calculateSlabRate(order.payment) || 0;
            } else {
              context[col] = order[col] || 0;
            }
          }

          // Calculate values using formulas
          const calculatedValues = {};
          for (const [key, formula] of Object.entries(formulas)) {
            try {
              let evaluableFormula = formula;
              Object.entries(context).forEach(([col, value]) => {
                evaluableFormula = evaluableFormula.replace(
                  new RegExp(`\\b${col}\\b`, "g"),
                  value
                );
              });
              calculatedValues[key] = eval(evaluableFormula);
            } catch (error) {
              calculatedValues[key] = 0;
            }
          }

          const recordData = {
            pos_order_id: order.instance_id,
            store_name: order.store_name,
            order_date: order.date,
            ...calculatedValues,
            order_status_pos: "Delivered",
            updated_at: new Date(),
          };

          if (existingRecordsMap.has(order.instance_id)) {
            // Add to bulk update
            bulkUpdateRecords.push({
              ...recordData,
              id: existingRecordsMap.get(order.instance_id).id,
            });
          } else {
            // Add to bulk create
            bulkCreateRecords.push({
              ...recordData,
              id: `ZVS_${order.instance_id}`,
              reconciled_status: "PENDING",
              created_at: new Date(),
            });
          }
        } catch (error) {
          console.error(
            `Error processing order ${order.instance_id}:`,
            error.message
          );
        }
      }

      // Perform bulk operations for this batch
      if (bulkCreateRecords.length > 0) {
        console.log(`📍 [createPosSummaryRecords] Bulk creating ${bulkCreateRecords.length} records...`);
        await db.zomato_vs_pos_summary.bulkCreate(bulkCreateRecords, {
          ignoreDuplicates: true,
          logging: (sql) => {
            console.log(`📊 [SQL] createPosSummaryRecords - Bulk Create Query (batch ${offset}):`);
            console.log("   ", sql);
          },
        });
        totalCreated += bulkCreateRecords.length;
        console.log(`📍 [createPosSummaryRecords] Created ${bulkCreateRecords.length} records in batch ${offset}`);
      }

      if (bulkUpdateRecords.length > 0) {
        console.log(`📍 [createPosSummaryRecords] Bulk updating ${bulkUpdateRecords.length} records...`);
        await Promise.all(
          bulkUpdateRecords.map((record) =>
            db.zomato_vs_pos_summary.update(record, { 
              where: { id: record.id },
              logging: (sql) => {
                console.log(`📊 [SQL] createPosSummaryRecords - Update Query for id ${record.id}:`);
                console.log("   ", sql);
              },
            })
          )
        );
        totalUpdated += bulkUpdateRecords.length;
        console.log(`📍 [createPosSummaryRecords] Updated ${bulkUpdateRecords.length} records in batch ${offset}`);
      }

      totalProcessed += posOrders.length;
      offset += BATCH_SIZE;

      // Log progress
      console.log(`📍 [createPosSummaryRecords] POS Summary batch: ${offset}/${totalCount} orders (${Math.round((offset/totalCount)*100)}%)`);
    }

    console.log(`\n✅ [createPosSummaryRecords] Function completed successfully`);
    console.log(`📍 [createPosSummaryRecords] Total processed: ${totalProcessed} orders`);
    console.log(`📍 [createPosSummaryRecords] Total created: ${totalCreated} new records`);
    console.log(`📍 [createPosSummaryRecords] Total updated: ${totalUpdated} existing records`);
  } catch (error) {
    console.error("❌ [createPosSummaryRecords] Error occurred:", error);
    console.error("   Error message:", error.message);
    console.error("   Error stack:", error.stack);
  }
};

const formulaForZomatoSummary = async () => {
  try {
    // Get database field mapping
    const dbFieldMapping = await getDbFieldMapping("ZOMATO");
    // Define the calculation formulas
    const calculatedValues = {
      slab_rate: "slab_rate",
      zomato_sale_type: "action",
      zomato_net_amount: "net_amount",
      zomato_tax_paid_by_customer: "tax_paid_by_customer",
      zomato_commission_value: "commission_value",
      zomato_pg_applied_on: "pg_applied_on",
      zomato_pg_charge: "pg_charge",
      zomato_taxes_zomato_fee: "taxes_zomato_fee",
      zomato_tds_amount: "tds_amount",
      zomato_final_amount: "final_amount",
      calculated_zomato_net_amount:
        "bill_subtotal - mvd + merchant_pack_charge",
      calculated_zomato_tax_paid_by_customer: "zomato_net_amount * 0.05",
      calculated_zomato_commission_value: "zomato_net_amount * slab_rate",
      calculated_zomato_pg_applied_on:
        "zomato_net_amount + zomato_tax_paid_by_customer",
      calculated_zomato_pg_charge: "zomato_pg_applied_on * 0.011",
      calculated_zomato_taxes_zomato_fee:
        "(zomato_commission_value + zomato_pg_charge) * 0.18",
      calculated_zomato_tds_amount: "zomato_net_amount * 0.001",
      calculated_zomato_final_amount:
        "zomato_net_amount - zomato_commission_value - zomato_pg_charge - zomato_taxes_zomato_fee - zomato_tds_amount",
      fixed_credit_note_amount: "credit_note_amount",
      fixed_pro_discount_passthrough: "pro_discount_passthrough",
      fixed_customer_discount: "customer_discount",
      fixed_rejection_penalty_charge: "rejection_penalty_charge",
      fixed_user_credits_charge: "user_credits_charge",
      fixed_promo_recovery_adj: "promo_recovery_adj",
      fixed_icecream_handling: "icecream_handling",
      fixed_icecream_deductions: "icecream_deductions",
      fixed_order_support_cost: "order_support_cost",
      fixed_merchant_delivery_charge: "merchant_delivery_charge",
    };

    const updatedCalculatedValues = { ...calculatedValues };

    for (const [key, formula] of Object.entries(calculatedValues)) {
      // First resolve any references to other calculated values
      let resolvedFormula = resolveFormulaReferences(
        formula,
        updatedCalculatedValues
      );

      // Then replace Excel columns with DB columns
      resolvedFormula = replaceExcelWithDbColumns(
        resolvedFormula,
        dbFieldMapping
      );

      updatedCalculatedValues[key] = resolvedFormula;
    }

    return updatedCalculatedValues;
  } catch (error) {
    console.error("Error in calculateZomatoVsPosSummary:", error);
    throw error;
  }
};

const createZomatoSummaryRecords = async () => {
  console.log("📍 [createZomatoSummaryRecords] Function started");
  try {
    // Get total count first to process in batches
    console.log("📍 [createZomatoSummaryRecords] Getting total count of Zomato orders (sale/addition)...");
    const totalCount = await db.zomato.count({
      where: {
        action: { [Op.in]: ["sale", "addition"] },
      },
      logging: (sql) => {
        console.log("📊 [SQL] createZomatoSummaryRecords - Count Query:");
        console.log("   ", sql);
      },
    });
    console.log(`📍 [createZomatoSummaryRecords] Total Zomato orders found: ${totalCount}`);

    if (totalCount === 0) {
      console.log("No Zomato orders found");
      return;
    }

    // Get formulas for calculations
    console.log("📍 [createZomatoSummaryRecords] Fetching Zomato summary formulas...");
    const formulas = await formulaForZomatoSummary();
    console.log(`📍 [createZomatoSummaryRecords] Loaded ${Object.keys(formulas).length} formulas`);

    // Pre-compile regex for column extraction
    const columnRegex = /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g;

    // Get all unique column names from formulas once
    console.log("📍 [createZomatoSummaryRecords] Extracting unique columns from formulas...");
    const uniqueColumns = new Set();
    Object.values(formulas).forEach((formula) => {
      const matches = formula.match(columnRegex) || [];
      matches.forEach((col) => uniqueColumns.add(col));
    });
    console.log(`📍 [createZomatoSummaryRecords] Found ${uniqueColumns.size} unique columns in formulas`);

    // Process in batches to avoid memory issues
    const BATCH_SIZE = 1000;
    let offset = 0;
    let totalProcessed = 0;
    let totalCreated = 0;
    let totalUpdated = 0;

    while (offset < totalCount) {
      // Fetch batch of Zomato orders
      console.log(`📍 [createZomatoSummaryRecords] Fetching batch: offset=${offset}, limit=${BATCH_SIZE}`);
      const zomatoOrders = await db.zomato.findAll({
        where: {
          action: { [Op.in]: ["sale", "addition"] },
        },
        raw: true,
        nest: true,
        limit: BATCH_SIZE,
        offset: offset,
        order: [["order_id", "ASC"]],
        logging: (sql) => {
          console.log(`📊 [SQL] createZomatoSummaryRecords - Batch Query (offset ${offset}):`);
          console.log("   ", sql);
        },
      });
      console.log(`📍 [createZomatoSummaryRecords] Fetched ${zomatoOrders.length} orders in this batch`);

      if (!zomatoOrders || zomatoOrders.length === 0) {
        break;
      }

      // Prepare bulk operations for this batch
      const bulkCreateRecords = [];
      const bulkUpdateRecords = [];

      // Get existing records for this batch only
      const orderIds = zomatoOrders.map((order) => order.order_id);
      console.log(`📍 [createZomatoSummaryRecords] Checking ${orderIds.length} existing records in summary table...`);
      const existingRecords = await db.zomato_vs_pos_summary.findAll({
        where: {
          pos_order_id: {
            [Op.in]: orderIds,
          },
        },
        raw: true,
        logging: (sql) => {
          console.log(`📊 [SQL] createZomatoSummaryRecords - Check Existing Records Query (batch ${offset}):`);
          console.log("   ", sql);
        },
      });
      console.log(`📍 [createZomatoSummaryRecords] Found ${existingRecords.length} existing records to update`);

      // Create a map of existing records for faster lookup using pos_order_id
      const existingRecordsMap = new Map(
        existingRecords.map((record) => [record.pos_order_id, record])
      );

      console.log(`📍 [createZomatoSummaryRecords] Processing ${zomatoOrders.length} orders in batch ${offset}...`);
      let processedInBatch = 0;
      for (const order of zomatoOrders) {
        try {
          processedInBatch++;
          if (processedInBatch % 100 === 0) {
            console.log(`📍 [createZomatoSummaryRecords] Processing order ${processedInBatch}/${zomatoOrders.length} in batch ${offset}`);
          }
          // Create context object
          const context = {};
          for (const col of uniqueColumns) {
            if (col === "0") continue;
            else if (col === "slab_rate") {
              context[col] = calculateSlabRate(order.net_amount) || 0;
            } else {
              context[col] = order[col] || 0;
            }
          }

          // Calculate values using formulas
          const calculatedValues = {};
          for (const [key, formula] of Object.entries(formulas)) {
            try {
              let evaluableFormula = formula;
              Object.entries(context).forEach(([col, value]) => {
                evaluableFormula = evaluableFormula.replace(
                  new RegExp(`\\b${col}\\b`, "g"),
                  value
                );
              });
              calculatedValues[key] = eval(evaluableFormula);
            } catch (error) {
              calculatedValues[key] = 0;
            }
          }

          const recordData = {
            zomato_order_id: order.order_id,
            store_name: order.store_code,
            order_date: order.order_date,
            ...calculatedValues,
            order_status_zomato: order.action,
            updated_at: new Date(),
          };

          // Check if this Zomato order_id exists as pos_order_id in the summary table
          if (existingRecordsMap.has(order.order_id)) {
            // Update existing record
            bulkUpdateRecords.push({
              ...recordData,
              id: existingRecordsMap.get(order.order_id).id,
            });
          } else {
            // Create new record
            bulkCreateRecords.push({
              ...recordData,
              id: `ZVS_${order.order_id}`,
              reconciled_status: "PENDING",
              created_at: new Date(),
            });
          }
        } catch (error) {
          console.error(
            `Error processing order ${order.order_id}:`,
            error.message
          );
        }
      }

      // Perform bulk operations for this batch
      if (bulkCreateRecords.length > 0) {
        console.log(`📍 [createZomatoSummaryRecords] Bulk creating ${bulkCreateRecords.length} records...`);
        await db.zomato_vs_pos_summary.bulkCreate(bulkCreateRecords, {
          ignoreDuplicates: true,
          logging: (sql) => {
            console.log(`📊 [SQL] createZomatoSummaryRecords - Bulk Create Query (batch ${offset}):`);
            console.log("   ", sql);
          },
        });
        totalCreated += bulkCreateRecords.length;
        console.log(`📍 [createZomatoSummaryRecords] Created ${bulkCreateRecords.length} records in batch ${offset}`);
      }

      if (bulkUpdateRecords.length > 0) {
        console.log(`📍 [createZomatoSummaryRecords] Bulk updating ${bulkUpdateRecords.length} records...`);
        await Promise.all(
          bulkUpdateRecords.map((record) =>
            db.zomato_vs_pos_summary.update(record, { 
              where: { id: record.id },
              logging: (sql) => {
                console.log(`📊 [SQL] createZomatoSummaryRecords - Update Query for id ${record.id}:`);
                console.log("   ", sql);
              },
            })
          )
        );
        totalUpdated += bulkUpdateRecords.length;
        console.log(`📍 [createZomatoSummaryRecords] Updated ${bulkUpdateRecords.length} records in batch ${offset}`);
      }

      totalProcessed += zomatoOrders.length;
      offset += BATCH_SIZE;

      // Log progress
      console.log(`📍 [createZomatoSummaryRecords] Zomato Summary batch: ${offset}/${totalCount} orders (${Math.round((offset/totalCount)*100)}%)`);
    }

    console.log(`\n✅ [createZomatoSummaryRecords] Function completed successfully`);
    console.log(`📍 [createZomatoSummaryRecords] Total processed: ${totalProcessed} Zomato orders`);
    console.log(`📍 [createZomatoSummaryRecords] Total created: ${totalCreated} new records`);
    console.log(`📍 [createZomatoSummaryRecords] Total updated: ${totalUpdated} existing records`);
  } catch (error) {
    console.error("❌ [createZomatoSummaryRecords] Error occurred:", error);
    console.error("   Error message:", error.message);
    console.error("   Error stack:", error.stack);
  }
};

const createZomatoSummaryRecordsForRefundOnly = async () => {
  console.log("📍 [createZomatoSummaryRecordsForRefundOnly] Function started");
  try {
    // Get total count first to process in batches
    console.log("📍 [createZomatoSummaryRecordsForRefundOnly] Getting total count of Zomato refund orders...");
    const totalCount = await db.zomato.count({
      where: {
        action: "refund",
      },
      logging: (sql) => {
        console.log("📊 [SQL] createZomatoSummaryRecordsForRefundOnly - Count Query:");
        console.log("   ", sql);
      },
    });
    console.log(`📍 [createZomatoSummaryRecordsForRefundOnly] Total refund orders found: ${totalCount}`);

    if (totalCount === 0) {
      console.log("No Zomato refund orders found");
      return;
    }

    // Get formulas for calculations
    console.log("📍 [createZomatoSummaryRecords] Fetching Zomato summary formulas...");
    const formulas = await formulaForZomatoSummary();
    console.log(`📍 [createZomatoSummaryRecords] Loaded ${Object.keys(formulas).length} formulas`);

    // Pre-compile regex for column extraction
    const columnRegex = /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g;

    // Get all unique column names from formulas once
    console.log("📍 [createZomatoSummaryRecords] Extracting unique columns from formulas...");
    const uniqueColumns = new Set();
    Object.values(formulas).forEach((formula) => {
      const matches = formula.match(columnRegex) || [];
      matches.forEach((col) => uniqueColumns.add(col));
    });
    console.log(`📍 [createZomatoSummaryRecords] Found ${uniqueColumns.size} unique columns in formulas`);

    // Process in batches to avoid memory issues
    const BATCH_SIZE = 1000;
    let offset = 0;
    let totalProcessed = 0;
    let totalCreated = 0;
    let totalUpdated = 0;

    while (offset < totalCount) {
      // Fetch batch of Zomato refund orders
      console.log(`📍 [createZomatoSummaryRecordsForRefundOnly] Fetching batch: offset=${offset}, limit=${BATCH_SIZE}`);
      const zomatoOrders = await db.zomato.findAll({
        where: {
          action: "refund",
        },
        raw: true,
        nest: true,
        limit: BATCH_SIZE,
        offset: offset,
        order: [["order_id", "ASC"]],
        logging: (sql) => {
          console.log(`📊 [SQL] createZomatoSummaryRecordsForRefundOnly - Batch Query (offset ${offset}):`);
          console.log("   ", sql);
        },
      });
      console.log(`📍 [createZomatoSummaryRecordsForRefundOnly] Fetched ${zomatoOrders.length} refund orders in this batch`);

      if (!zomatoOrders || zomatoOrders.length === 0) {
        break;
      }

      // Prepare bulk operations for this batch
      const bulkCreateRecords = [];
      const bulkUpdateRecords = [];

      // Get existing records for this batch only
      const orderIds = zomatoOrders.map((order) => order.order_id);
      console.log(`📍 [createZomatoSummaryRecordsForRefundOnly] Checking ${orderIds.length} existing refund records...`);
      const existingRecords = await db.zomato_vs_pos_summary.findAll({
        where: {
          [Op.and]: [
            {
              zomato_order_id: {
                [Op.in]: orderIds,
              },
            },
            { order_status_zomato: "refund" },
          ],
        },
        raw: true,
        logging: (sql) => {
          console.log(`📊 [SQL] createZomatoSummaryRecordsForRefundOnly - Check Existing Records Query (batch ${offset}):`);
          console.log("   ", sql);
        },
      });
      console.log(`📍 [createZomatoSummaryRecordsForRefundOnly] Found ${existingRecords.length} existing refund records to update`);

      // Create a map of existing records for faster lookup using zomato_order_id
      const existingRecordsMap = new Map(
        existingRecords.map((record) => [record.zomato_order_id, record])
      );

      console.log(`📍 [createZomatoSummaryRecordsForRefundOnly] Processing ${zomatoOrders.length} refund orders in batch ${offset}...`);
      let processedInBatch = 0;
      for (const order of zomatoOrders) {
        try {
          processedInBatch++;
          if (processedInBatch % 100 === 0) {
            console.log(`📍 [createZomatoSummaryRecordsForRefundOnly] Processing refund order ${processedInBatch}/${zomatoOrders.length} in batch ${offset}`);
          }
          // Create context object
          const context = {};
          for (const col of uniqueColumns) {
            if (col === "0") continue;
            else if (col === "slab_rate") {
              context[col] = calculateSlabRate(order.net_amount) || 0;
            } else {
              context[col] = order[col] || 0;
            }
          }

          // Calculate values using formulas
          const calculatedValues = {};
          for (const [key, formula] of Object.entries(formulas)) {
            try {
              let evaluableFormula = formula;
              Object.entries(context).forEach(([col, value]) => {
                evaluableFormula = evaluableFormula.replace(
                  new RegExp(`\\b${col}\\b`, "g"),
                  value
                );
              });
              calculatedValues[key] = eval(evaluableFormula);
            } catch (error) {
              calculatedValues[key] = 0;
            }
          }

          const recordData = {
            zomato_order_id: order.order_id,
            store_name: order.store_code,
            order_date: order.order_date,
            ...calculatedValues,
            order_status_zomato: order.action,
            updated_at: new Date(),
          };

          // Check if this Zomato order_id exists in the summary table
          if (existingRecordsMap.has(order.order_id)) {
            // Update existing record
            bulkUpdateRecords.push({
              ...recordData,
              id: existingRecordsMap.get(order.order_id).id,
            });
          } else {
            // Create new record
            bulkCreateRecords.push({
              ...recordData,
              id: `ZVS_refund_${order.order_id}`,
              reconciled_status: "PENDING",
              created_at: new Date(),
            });
          }
        } catch (error) {
          console.error(
            `Error processing refund order ${order.order_id}:`,
            error.message
          );
        }
      }

      // Perform bulk operations for this batch
      if (bulkCreateRecords.length > 0) {
        console.log(`📍 [createZomatoSummaryRecordsForRefundOnly] Bulk creating ${bulkCreateRecords.length} refund records...`);
        await db.zomato_vs_pos_summary.bulkCreate(bulkCreateRecords, {
          ignoreDuplicates: true,
          logging: (sql) => {
            console.log(`📊 [SQL] createZomatoSummaryRecordsForRefundOnly - Bulk Create Query (batch ${offset}):`);
            console.log("   ", sql);
          },
        });
        totalCreated += bulkCreateRecords.length;
        console.log(`📍 [createZomatoSummaryRecordsForRefundOnly] Created ${bulkCreateRecords.length} refund records in batch ${offset}`);
      }

      if (bulkUpdateRecords.length > 0) {
        console.log(`📍 [createZomatoSummaryRecordsForRefundOnly] Bulk updating ${bulkUpdateRecords.length} refund records...`);
        await Promise.all(
          bulkUpdateRecords.map((record) =>
            db.zomato_vs_pos_summary.update(record, { 
              where: { id: record.id },
              logging: (sql) => {
                console.log(`📊 [SQL] createZomatoSummaryRecordsForRefundOnly - Update Query for id ${record.id}:`);
                console.log("   ", sql);
              },
            })
          )
        );
        totalUpdated += bulkUpdateRecords.length;
        console.log(`📍 [createZomatoSummaryRecordsForRefundOnly] Updated ${bulkUpdateRecords.length} refund records in batch ${offset}`);
      }

      totalProcessed += zomatoOrders.length;
      offset += BATCH_SIZE;

      // Log progress
      console.log(`📍 [createZomatoSummaryRecordsForRefundOnly] Zomato Refund Summary batch: ${offset}/${totalCount} orders (${Math.round((offset/totalCount)*100)}%)`);
    }

    console.log(`\n✅ [createZomatoSummaryRecordsForRefundOnly] Function completed successfully`);
    console.log(`📍 [createZomatoSummaryRecordsForRefundOnly] Total processed: ${totalProcessed} refund orders`);
    console.log(`📍 [createZomatoSummaryRecordsForRefundOnly] Total created: ${totalCreated} new records`);
    console.log(`📍 [createZomatoSummaryRecordsForRefundOnly] Total updated: ${totalUpdated} existing records`);
  } catch (error) {
    console.error("❌ [createZomatoSummaryRecordsForRefundOnly] Error occurred:", error);
    console.error("   Error message:", error.message);
    console.error("   Error stack:", error.stack);
  }
};

// Function to calculate delta values between POS and Zomato columns
const calculateDeltaValues = async () => {
  console.log("📍 [calculateDeltaValues] Function started");
  try {
    // Get total count first
    console.log("📍 [calculateDeltaValues] Getting total count of summary records...");
    const totalCount = await db.zomato_vs_pos_summary.count({
      logging: (sql) => {
        console.log("📊 [SQL] calculateDeltaValues - Count Query:");
        console.log("   ", sql);
      },
    });
    console.log(`📍 [calculateDeltaValues] Total summary records found: ${totalCount}`);

    if (totalCount === 0) {
      console.log("No records found for delta calculation");
      return;
    }

    // Process records in batches to avoid memory issues
    const BATCH_SIZE = 1000;
    let totalProcessed = 0;
    let totalUpdated = 0;
    const errors = [];
    let offset = 0;

    // Process in batches
    while (offset < totalCount) {
      // Fetch batch of records
      const summaryRecords = await db.zomato_vs_pos_summary.findAll({
        raw: true,
        limit: BATCH_SIZE,
        offset: offset,
        order: [["id", "ASC"]], // Consistent ordering
      });

      if (!summaryRecords || summaryRecords.length === 0) {
        break;
      }

      const bulkUpdates = [];
      console.log(`📍 [calculateDeltaValues] Processing ${summaryRecords.length} records in batch ${offset}...`);
      let processedInBatch = 0;

      for (const record of summaryRecords) {
        try {
          processedInBatch++;
          if (processedInBatch % 100 === 0) {
            console.log(`📍 [calculateDeltaValues] Processing record ${processedInBatch}/${summaryRecords.length} in batch ${offset}`);
          }
          const updatedValues = {};

          // Get all column names from the record
          const columns = Object.keys(record);

          // Filter columns that start with pos_ or zomato_ (excluding order_id fields)
          const posColumns = columns.filter(
            (col) =>
              col.startsWith("pos_") &&
              col !== "pos_order_id" &&
              col !== "order_status_pos"
          );

          // For each POS column, calculate deltas
          for (const posCol of posColumns) {
            // Get the corresponding Zomato column name
            const zomatoCol = posCol.replace("pos_", "zomato_");

            // Calculate deltas
            const posVsZomatoDelta = record[posCol] - (record[zomatoCol] || 0);
            const zomatoVsPosDelta = (record[zomatoCol] || 0) - record[posCol];

            // Get the base column name (without pos_ or zomato_ prefix)
            const baseColName = posCol.replace("pos_", "");

            // Add delta values to update object with correct naming format
            updatedValues[`pos_vs_zomato_${baseColName}_delta`] =
              posVsZomatoDelta;
            updatedValues[`zomato_vs_pos_${baseColName}_delta`] =
              zomatoVsPosDelta;
          }

          // Add to bulk updates array
          bulkUpdates.push({
            id: record.id,
            ...updatedValues,
            updated_at: new Date(),
          });

          totalProcessed++;
        } catch (error) {
          errors.push({
            record_id: record.pos_order_id,
            error: error.message,
          });
        }
      }

      // Perform bulk update for this batch
      if (bulkUpdates.length > 0) {
        console.log(`📍 [calculateDeltaValues] Updating ${bulkUpdates.length} records with delta values...`);
        await Promise.all(
          bulkUpdates.map((update) =>
            db.zomato_vs_pos_summary.update(update, { 
              where: { id: update.id },
              logging: (sql) => {
                console.log(`📊 [SQL] calculateDeltaValues - Update Query for id ${update.id}:`);
                console.log("   ", sql);
              },
            })
          )
        );
        totalUpdated += bulkUpdates.length;
        console.log(`📍 [calculateDeltaValues] Updated ${bulkUpdates.length} records in batch ${offset}`);
      }

      // Clear arrays for next batch to free memory
      offset += BATCH_SIZE;
      
      // Log progress
      console.log(`📍 [calculateDeltaValues] Delta calculation batch: ${offset}/${totalCount} records (${Math.round((offset/totalCount)*100)}%)`);
    }

    console.log(`\n✅ [calculateDeltaValues] Function completed successfully`);
    console.log(`📍 [calculateDeltaValues] Total processed: ${totalProcessed} records for delta calculation`);
    console.log(`📍 [calculateDeltaValues] Successfully updated: ${totalUpdated} records`);
    if (errors.length > 0) {
      console.error(`⚠️ [calculateDeltaValues] Failed to update ${errors.length} records:`, errors);
    }
  } catch (error) {
    console.error("❌ [calculateDeltaValues] Error occurred:", error);
    console.error("   Error message:", error.message);
    console.error("   Error stack:", error.stack);
  }
};

// Function to calculate Zomato receivables vs receipts
const calculateZomatoReceivablesVsReceipts = async () => {
  console.log("📍 [calculateZomatoReceivablesVsReceipts] Function started");
  try {
    // Get all Zomato records with UTR numbers and join with zomato_vs_pos_summary
    console.log("📍 [calculateZomatoReceivablesVsReceipts] Fetching Zomato records with UTR numbers...");
    const zomatoRecords = await db.zomato.findAll({
      logging: (sql) => {
        console.log("📊 [SQL] calculateZomatoReceivablesVsReceipts - Aggregate Query:");
        console.log("   ", sql);
      },
      // where: {
      //   utr_number: {
      //     [Op.not]: null,
      //     [Op.ne]: "",
      //   },
      // },
      // include: [
      //   {
      //     model: db.zomato_vs_pos_summary,
      //     required: false,
      //     where: {
      //       zomato_order_id: {
      //         [Op.col]: "zomato.order_id",
      //       },
      //     },
      //     attributes: [],
      //   },
      // ],
      attributes: [
        "order_date",
        "store_code",
        "utr_number",
        "utr_date",
        [fn("COUNT", col("order_id")), "total_orders"],
        [fn("SUM", col("final_amount")), "total_final_amount"],
        [fn("SUM", 0), "total_calculated_final_amount"],
      ],
      group: ["order_date", "store_code", "utr_number", "utr_date"],
      raw: true,
      nest: true,
    });

    console.log(`📍 [calculateZomatoReceivablesVsReceipts] Found ${zomatoRecords.length} Zomato records with UTR numbers`);
    
    if (!zomatoRecords || zomatoRecords.length === 0) {
      console.log("📍 [calculateZomatoReceivablesVsReceipts] No Zomato records found with UTR numbers");
      return;
    }

    const bulkCreateRecords = [];

    // Fetch all relevant UTRs from Zomato records
    const utrNumbers = zomatoRecords.map((r) => r.utr_number).filter(Boolean);
    console.log(`📍 [calculateZomatoReceivablesVsReceipts] Fetching bank statements for ${utrNumbers.length} UTR numbers...`);

    // Fetch all matching bank statements in one query
    const bankStatements = await db.bank_statement.findAll({
      where: {
        utr: utrNumbers.length > 0 ? utrNumbers : null,
      },
      logging: (sql) => {
        console.log("📊 [SQL] calculateZomatoReceivablesVsReceipts - Bank Statement Query:");
        console.log("   ", sql);
      },
    });
    console.log(`📍 [calculateZomatoReceivablesVsReceipts] Found ${bankStatements.length} matching bank statements`);
    console.log("📍 [calculateZomatoReceivablesVsReceipts] Creating bank statement map...");
    const bankStatementMap = {};
    bankStatements.forEach((bs) => {
      if (bs.utr) bankStatementMap[bs.utr] = bs;
    });
    console.log(`📍 [calculateZomatoReceivablesVsReceipts] Created map with ${Object.keys(bankStatementMap).length} UTR entries`);

    for (const record of zomatoRecords) {
      try {
        // Get the calculated final amount from the summary records
        const calculatedFinalAmount =
          parseFloat(record.total_calculated_final_amount) ||
          parseFloat(record.total_final_amount);

        // Find matching bank statement by UTR
        const bankMatch = record.utr_number
          ? bankStatementMap[record.utr_number]
          : null;
        let depositAmount, bank, accountNo, amountDelta;
        if (bankMatch) {
          depositAmount = parseFloat(bankMatch.deposit_amount) || 0;
          bank = bankMatch.bank || null;
          accountNo = bankMatch.account_no || null;
          amountDelta = parseFloat(record.total_final_amount) - depositAmount;
        } else {
          depositAmount = 0;
          bank = null;
          accountNo = null;
          amountDelta = parseFloat(record.total_final_amount);
        }

        // Create a unique ID for each record
        const recordId =
          `ZR_${record.order_date}_${record.store_code}_${record.utr_number}`.replace(
            /[^a-zA-Z0-9_]/g,
            "_"
          );

        // Prepare record data
        const recordData = {
          id: recordId,
          order_date: record.order_date,
          store_name: record.store_code, // Using store_code as store_name
          utr_number: record.utr_number,
          utr_date: record.utr_date,
          total_orders: parseInt(record.total_orders),
          final_amount: parseFloat(record.total_final_amount),
          calculated_final_amount: calculatedFinalAmount,
          deposit_amount: depositAmount,
          amount_delta: amountDelta,
          bank: bank,
          account_no: accountNo,
          created_at: new Date(),
          updated_at: new Date(),
        };

        bulkCreateRecords.push(recordData);
      } catch (error) {
        console.error(`Error processing record: ${error.message}`);
      }
    }

    // Perform bulk create with upsert
    if (bulkCreateRecords.length > 0) {
      console.log(`📍 [calculateZomatoReceivablesVsReceipts] Bulk creating/updating ${bulkCreateRecords.length} receivables records...`);
      await db.zomato_receivables_vs_receipts.bulkCreate(bulkCreateRecords, {
        updateOnDuplicate: [
          "total_orders",
          "final_amount",
          "calculated_final_amount",
          "deposit_amount",
          "amount_delta",
          "bank",
          "account_no",
          "updated_at",
        ],
        logging: (sql) => {
          console.log("📊 [SQL] calculateZomatoReceivablesVsReceipts - Bulk Create/Update Query:");
          console.log("   ", sql);
        },
      });
      console.log(`📍 [calculateZomatoReceivablesVsReceipts] Created/Updated ${bulkCreateRecords.length} receivables records`);
    }

    console.log(`📍 [calculateZomatoReceivablesVsReceipts] Processed ${bulkCreateRecords.length} receivables records`);
    console.log("✅ [calculateZomatoReceivablesVsReceipts] Function completed successfully");
  } catch (error) {
    console.error("❌ [calculateZomatoReceivablesVsReceipts] Error occurred:", error);
    console.error("   Error message:", error.message);
    console.error("   Error stack:", error.stack);
  }
};

// Function to check and update reconciliation status
const checkReconciliationStatus = async (req, res) => {
  console.log("===========================================");
  console.log("🚀 I AM HERE - Entry point of /api/node/reconciliation/populate-threepo-dashboard");
  console.log("===========================================");
  console.log(`📅 Timestamp: ${new Date().toISOString()}`);
  
  try {
    console.log("\n🔵 STEP 1: Starting createPosSummaryRecords()");
    console.log("─────────────────────────────────────────");
    await createPosSummaryRecords();
    console.log("✅ STEP 1 COMPLETE: createPosSummaryRecords() finished\n");

    console.log("🔵 STEP 2: Starting createZomatoSummaryRecords()");
    console.log("─────────────────────────────────────────");
    await createZomatoSummaryRecords();
    console.log("✅ STEP 2 COMPLETE: createZomatoSummaryRecords() finished\n");

    console.log("🔵 STEP 3: Starting createZomatoSummaryRecordsForRefundOnly()");
    console.log("─────────────────────────────────────────");
    await createZomatoSummaryRecordsForRefundOnly();
    console.log("✅ STEP 3 COMPLETE: createZomatoSummaryRecordsForRefundOnly() finished\n");

    console.log("🔵 STEP 4: Starting calculateDeltaValues()");
    console.log("─────────────────────────────────────────");
    await calculateDeltaValues();
    console.log("✅ STEP 4 COMPLETE: calculateDeltaValues() finished\n");

    console.log("🔵 STEP 5: Starting calculateZomatoReceivablesVsReceipts()");
    console.log("─────────────────────────────────────────");
    await calculateZomatoReceivablesVsReceipts();
    console.log("✅ STEP 5 COMPLETE: calculateZomatoReceivablesVsReceipts() finished\n");

    // Get total count first
    console.log("📍 [checkReconciliationStatus] Getting total count of summary records for reconciliation...");
    const totalCount = await db.zomato_vs_pos_summary.count({
      logging: (sql) => {
        console.log("📊 [SQL] checkReconciliationStatus - Count Query:");
        console.log("   ", sql);
      },
    });
    console.log(`📍 [checkReconciliationStatus] Total summary records: ${totalCount}`);

    if (totalCount === 0) {
      console.log("⚠️ [checkReconciliationStatus] No summary records found - returning 404");
      return res.status(404).json({
        success: false,
        message: "No summary records found",
      });
    }

    // Process records in batches to avoid memory issues
    const BATCH_SIZE = 1000;
    let totalProcessed = 0;
    let totalUpdated = 0;
    const errors = [];
    let offset = 0;

    const BASE_COLUMN_TO_CHECK = [
      "pos_vs_zomato_net_amount_delta",
      "pos_vs_zomato_tax_paid_by_customer_delta",
      "pos_vs_zomato_commission_value_delta",
      "pos_vs_zomato_pg_charge_delta",
      "zomato_vs_pos_net_amount_delta",
      "zomato_vs_pos_tax_paid_by_customer_delta",
      "zomato_vs_pos_commission_value_delta",
      "zomato_vs_pos_pg_charge_delta",
    ];

    // Process in batches to avoid memory exhaustion
    while (offset < totalCount) {
      // Fetch batch of records
      console.log(`📍 [checkReconciliationStatus] Fetching batch: offset=${offset}, limit=${BATCH_SIZE}`);
      const summaryRecords = await db.zomato_vs_pos_summary.findAll({
        raw: true,
        limit: BATCH_SIZE,
        offset: offset,
        order: [["id", "ASC"]], // Consistent ordering
        logging: (sql) => {
          console.log(`📊 [SQL] checkReconciliationStatus - Batch Query (offset ${offset}):`);
          console.log("   ", sql);
        },
      });
      console.log(`📍 [checkReconciliationStatus] Fetched ${summaryRecords.length} records in this batch`);

      if (!summaryRecords || summaryRecords.length === 0) {
        break;
      }

      const bulkUpdates = [];
      console.log(`📍 [checkReconciliationStatus] Starting reconciliation checks for batch ${offset}...`);
      console.log(`📍 [checkReconciliationStatus] Processing ${summaryRecords.length} records in batch ${offset}...`);
      let processedInBatch = 0;

      for (const record of summaryRecords) {
        try {
          processedInBatch++;
          if (processedInBatch % 100 === 0) {
            console.log(`📍 [checkReconciliationStatus] Processing record ${processedInBatch}/${summaryRecords.length} in batch ${offset}`);
          }
          let isReconciled = true;
          let unreconciledReasonPosVsZomato = [];
          let unreconciledReasonZomatoVsPos = [];
          let billSubTotal = 0;
          const columns = Object.keys(record);
          // First check if order IDs are missing
          if (!record.pos_order_id) {
            isReconciled = false;
            unreconciledReasonPosVsZomato = ["Order not found in pos"];
            unreconciledReasonZomatoVsPos = ["Order not found in pos"]; // Using pos_sub_total as default
            billSubTotal = record?.zomato_net_amount;
          } else if (!record.zomato_order_id) {
            isReconciled = false;
            unreconciledReasonZomatoVsPos = ["Order not found in zomato"];
            unreconciledReasonPosVsZomato = ["Order not found in zomato"]; // Using zomato_sub_total as default
            billSubTotal = record?.pos_net_amount;
          } else {
            billSubTotal = record?.pos_net_amount;
            // Get all column names from the record
            // Filter columns that contain '_delta' in their name
            const deltaColumns = columns.filter((col) => col.includes("_delta"));
            // Check each delta column

            // Values where threshold need to add
              let thresholdColumns50 = [
              "pos_vs_zomato_net_amount_delta",
              "zomato_vs_pos_net_amount_delta",
              "pos_vs_zomato_commission_value_delta",
              "zomato_vs_pos_commission_value_delta",
              "pos_vs_zomato_pg_applied_on_delta",
              "zomato_vs_pos_pg_applied_on_delta",
              "pos_vs_zomato_final_amount_delta",
              "zomato_vs_pos_final_amount_delta",
            ];

            let thresholdColumns10 = [
              "pos_vs_zomato_tax_paid_by_customer_delta",
              "zomato_vs_pos_tax_paid_by_customer_delta",
              "pos_vs_zomato_taxes_zomato_fee_delta",
              "zomato_vs_pos_taxes_zomato_fee_delta",
              "pos_vs_zomato_tds_amount_delta",
              "zomato_vs_pos_tds_amount_delta",
              "pos_vs_zomato_pg_charge_delta",
              "zomato_vs_pos_pg_charge_delta",
            ];

            for (const deltaCol of deltaColumns) {
              if (
                !thresholdColumns50?.includes(deltaCol) &&
                !thresholdColumns10?.includes(deltaCol)
              ) {
                if (Math.abs(parseFloat(record[deltaCol])) !== 0) {
                isReconciled = false;
                if (BASE_COLUMN_TO_CHECK?.includes(deltaCol)) {
                  unreconciledReasonPosVsZomato?.push(
                    THREE_PO_VS_POS_REASONS[deltaCol]
                  );
                  unreconciledReasonZomatoVsPos?.push(
                    THREE_PO_VS_POS_REASONS[deltaCol]
                  );
                  if (
                    deltaCol ===
                    BASE_COLUMN_TO_CHECK[BASE_COLUMN_TO_CHECK?.length - 1]
                  ) {
                    break;
                  }
                } else {
                  if (unreconciledReasonPosVsZomato?.length === 0) {
                    unreconciledReasonPosVsZomato = [
                      THREE_PO_VS_POS_REASONS[deltaCol],
                    ];
                  }
                  if (unreconciledReasonZomatoVsPos?.length === 0) {
                    unreconciledReasonZomatoVsPos = [
                      THREE_PO_VS_POS_REASONS[deltaCol],
                    ];
                  }
                  break; // Stop checking after finding first non-zero delta
                }
              }
            } else if (
              thresholdColumns50?.includes(deltaCol) &&
              Math.abs(parseFloat(record[deltaCol])) > 0.5
            ) {
              isReconciled = false;
              if (BASE_COLUMN_TO_CHECK?.includes(deltaCol)) {
                if (
                  !unreconciledReasonPosVsZomato?.includes(
                    THREE_PO_VS_POS_REASONS[deltaCol]
                  )
                ) {
                  unreconciledReasonPosVsZomato?.push(
                    THREE_PO_VS_POS_REASONS[deltaCol]
                  );
                  unreconciledReasonZomatoVsPos?.push(
                    THREE_PO_VS_POS_REASONS[deltaCol]
                  );
                }
                if (
                  deltaCol ===
                  BASE_COLUMN_TO_CHECK[BASE_COLUMN_TO_CHECK?.length - 1]
                ) {
                  break;
                }
              } else {
                if (unreconciledReasonPosVsZomato?.length === 0) {
                  unreconciledReasonPosVsZomato = [
                    THREE_PO_VS_POS_REASONS[deltaCol],
                  ];
                }
                if (unreconciledReasonZomatoVsPos?.length === 0) {
                  unreconciledReasonZomatoVsPos = [
                    THREE_PO_VS_POS_REASONS[deltaCol],
                  ];
                }
                break; // Stop checking after finding first non-zero delta
              }
            } else if (
              thresholdColumns10?.includes(deltaCol) &&
              Math.abs(parseFloat(record[deltaCol])) > 0.1
            ) {
              isReconciled = false;
              if (BASE_COLUMN_TO_CHECK?.includes(deltaCol)) {
                if (
                  !unreconciledReasonPosVsZomato?.includes(
                    THREE_PO_VS_POS_REASONS[deltaCol]
                  )
                ) {
                  unreconciledReasonPosVsZomato?.push(
                    THREE_PO_VS_POS_REASONS[deltaCol]
                  );
                  unreconciledReasonZomatoVsPos?.push(
                    THREE_PO_VS_POS_REASONS[deltaCol]
                  );
                }
                if (
                  deltaCol ===
                  BASE_COLUMN_TO_CHECK[BASE_COLUMN_TO_CHECK?.length - 1]
                ) {
                  break;
                }
              } else {
                if (unreconciledReasonPosVsZomato?.length === 0) {
                  unreconciledReasonPosVsZomato = [
                    THREE_PO_VS_POS_REASONS[deltaCol],
                  ];
                }
                if (unreconciledReasonZomatoVsPos?.length === 0) {
                  unreconciledReasonZomatoVsPos = [
                    THREE_PO_VS_POS_REASONS[deltaCol],
                  ];
                }
                break; // Stop checking after finding first non-zero delta
              }
            }
          }
        }

          // Check Self Mismatch
          if (isReconciled) {
            // Compare recipt vs calculated values of zomato_vs_pos_summary
            const calculatedColumns = columns.filter((col) =>
              col.includes("calculated_")
            );
            for (const calculatedCol of calculatedColumns) {
              const originalCol = calculatedCol.replace(/^calculated_/, "");
              if (record[calculatedCol] !== record[originalCol]) {
                isReconciled = false;
                billSubTotal = record?.zomato_sub_total;
                unreconciledReasonZomatoVsPos = [
                  THREE_PO_VS_POS_REASONS[calculatedCol],
                ];
                break;
              }
            }
          }

          // Add to bulk updates array
          bulkUpdates.push({
            id: record.id,
            reconciled_status: isReconciled ? "RECONCILED" : "UNRECONCILED",
            reconciled_amount: isReconciled ? billSubTotal : 0,
            unreconciled_amount: !isReconciled ? billSubTotal : 0,
            pos_vs_zomato_reason:
              isReconciled && unreconciledReasonPosVsZomato?.length > 0
                ? ""
                : unreconciledReasonPosVsZomato?.join(","),
            zomato_vs_pos_reason:
              isReconciled && unreconciledReasonPosVsZomato?.length > 0
                ? ""
                : unreconciledReasonZomatoVsPos?.join(","),
            updated_at: new Date(),
          });

          totalProcessed++;
        } catch (error) {
          errors.push({
            record_id: record.pos_order_id,
            error: error.message,
          });
        }
    }

      // Perform bulk update for this batch
      if (bulkUpdates.length > 0) {
        console.log(`📍 [checkReconciliationStatus] Updating ${bulkUpdates.length} records with reconciliation status...`);
        await Promise.all(
          bulkUpdates.map((update) =>
            db.zomato_vs_pos_summary.update(update, { 
              where: { id: update.id },
              logging: (sql) => {
                console.log(`📊 [SQL] checkReconciliationStatus - Update Query for id ${update.id}:`);
                console.log("   ", sql);
              },
            })
          )
        );
        totalUpdated += bulkUpdates.length;
        console.log(`📍 [checkReconciliationStatus] Updated ${bulkUpdates.length} records in batch ${offset}`);
      }

      // Clear arrays for next batch to free memory
      offset += BATCH_SIZE;
      
      // Log progress
      console.log(`📍 [checkReconciliationStatus] Processed batch: ${offset}/${totalCount} records (${Math.round((offset/totalCount)*100)}%)`);
      
      // Force garbage collection hint (Node.js will handle it)
      if (global.gc && offset % (BATCH_SIZE * 10) === 0) {
        global.gc();
      }
    }

    console.log("\n✅ [checkReconciliationStatus] Reconciliation processing complete!");
    console.log(`📍 [checkReconciliationStatus] Total processed: ${totalProcessed} records`);
    console.log(`📍 [checkReconciliationStatus] Successfully updated: ${totalUpdated} records`);
    if (errors.length > 0) {
      console.error(`⚠️ [checkReconciliationStatus] Failed to update ${errors.length} records:`, errors);
    }

    console.log("===========================================");
    console.log("🎉 API COMPLETE - Returning success response");
    console.log("===========================================\n");

    // Return success response
    return res.status(200).json({
      success: true,
      message: "Reconciliation completed successfully",
      processed: totalProcessed,
      updated: totalUpdated,
      errors: errors.length,
      errors_details: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("\n❌ [checkReconciliationStatus] ERROR OCCURRED:");
    console.error("   Error message:", error.message);
    console.error("   Error stack:", error.stack);
    console.error("===========================================\n");
    return res.status(500).json({
      success: false,
      message: "Error in checkReconciliationStatus",
      error: error.message,
    });
  }
};

const generateReconciliationExcel = async (req, res) => {
  try {
    const {
      startDate: start_date,
      endDate: end_date,
      stores: store_codes,
    } = req.body;

    if (!start_date || !end_date || !store_codes) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required parameters: start_date, end_date, or store_code",
      });
    }

    // Create reports directory if it doesn't exist
    const reportsDir = path.join(__dirname, "../../reports");
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // Create initial record in database
    const generationRecord = await db.excel_generation.create({
      store_code: `SummaryReport_${store_codes?.length} store(s)`,
      start_date,
      end_date,
      status: "pending",
      progress: 0,
      message: "Initializing Excel generation...",
    });

    // 👉 instead of directly calling the heavy function, fork the worker
    const workerPath = path.join(__dirname, "../workers/excelWorker.js");
    const worker = fork(workerPath);

    worker.send({
      jobType: "summarySheet",
      generationId: generationRecord.id,
      params: {
        start_date,
        end_date,
        store_codes,
        reportsDir,
      },
    });

    worker.on("message", (msg) => {
      console.log(`[Worker Message]`, msg);
      // Optional: you can update DB or logs here if needed
    });

    worker.on("exit", (code) => {
      console.log(`[Worker Exit] Code:`, code);
    });

    // Start background processing
    // processExcelGeneration(generationRecord.id, {
    //   start_date,
    //   end_date,
    //   store_codes,
    //   reportsDir,
    // });

    // Return immediately with generation ID
    res.json({
      success: true,
      message: "Excel generation started",
      generationId: generationRecord.id,
      status: "pending",
    });
  } catch (error) {
    console.error("Excel generation error:", error);
    res.status(500).json({
      success: false,
      message: "Server error starting Excel generation",
    });
  }
};

const processExcelGeneration = async (generationId, params) => {
  try {
    const { start_date, end_date, store_codes, reportsDir } = params;

    // Update status to processing
    await db.excel_generation.update(
      {
        status: "processing",
        message: "Starting Excel generation...",
        progress: 0,
      },
      {
        where: { id: generationId },
      }
    );

    // First create a regular workbook for the summary sheet
    const summaryWorkbook = new ExcelJS.Workbook();
    console.log(`[Excel Generation ${generationId}] Created summary workbook`);

    // Generate summary sheet
    await generateSummarySheetForZomato(summaryWorkbook, start_date, end_date);
    console.log(`[Excel Generation ${generationId}] Generated summary sheet`);

    // Now create the streaming workbook for data sheets
    let fileName = `reconciliation_${store_codes?.length}_stores_${dayjs(
      start_date
    ).format("DD-MM-YYYY")}_${dayjs(end_date).format(
      "DD-MM-YYYY"
    )}_${generationId}.xlsx`;
    const options = {
      filename: path.join(reportsDir, fileName),
      useStyles: true,
      useSharedStrings: true,
    };
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter(options);
    console.log(
      `[Excel Generation ${generationId}] Created streaming workbook`
    );

    // Copy summary sheet to streaming workbook
    const summarySheet = workbook.addWorksheet("Summary");
    const originalSummarySheet = summaryWorkbook.getWorksheet("Summary");

    // Copy all rows from original summary sheet
    originalSummarySheet.eachRow((row, rowNumber) => {
      const newRow = summarySheet.getRow(rowNumber);
      row.eachCell((cell, colNumber) => {
        const newCell = newRow.getCell(colNumber);
        newCell.value = cell.value;
        newCell.style = cell.style;
      });
      newRow.commit();
    });

    // Sheet creation utility with streaming
    const createSheet = async (sheetName, columns, query, textColumns = []) => {
      const sheet = workbook.addWorksheet(sheetName);

      // Set up columns with minimal styling
      sheet.columns = columns.map((col) => ({
        header: col,
        key: col,
        width: 20,
      }));

      // Apply header styles only once
      const headerRow = sheet.getRow(1);
      headerRow.eachCell((cell) => {
        cell.font = { bold: true };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE0E0E0" },
        };
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });
      headerRow.commit();

      // Determine which table to query based on sheet name
      let table;
      switch (sheetName) {
        case "Zomato POS vs 3PO":
          table = db.zomato_pos_vs_3po_data;
          break;
        case "Zomato 3PO vs POS":
          table = db.zomato_3po_vs_pos_data;
          break;
        case "Zomato 3PO vs POS Refund":
          table = db.zomato_3po_vs_pos_refund_data;
          break;
        case "Order not found in POS":
          table = db.orders_not_in_pos_data;
          break;
        case "Order not found in 3PO":
          table = db.orders_not_in_3po_data;
          break;
        default:
          throw new Error(`Unknown sheet name: ${sheetName}`);
      }

      // Get total count for progress tracking
      const totalCount = await table.count({
        where: {
          ...query.where,
          store_name: { [Op.in]: store_codes },
        },
      });

      if (totalCount === 0) {
        console.log(
          `[Excel Generation ${generationId}] No records found for ${sheetName}`
        );
        return sheet;
      }

      console.log(
        `[Excel Generation ${generationId}] Processing ${totalCount} records for ${sheetName}`
      );

      // Use streaming for better memory management
      const stream = await table.findAll({
        where: {
          ...query.where,
          store_name: { [Op.in]: store_codes },
        },
        order: query.order,
        stream: true,
      });

      let processedCount = 0;

      // Process records in chunks
      for await (const record of stream) {
        const rowData = {};
        columns.forEach((col) => {
          const value = record[col];
          // Convert to number if not in textColumns and value is not null/undefined
          if (
            !textColumns.includes(col) &&
            value !== null &&
            value !== undefined
          ) {
            const numValue = Number(value);
            rowData[col] = isNaN(numValue) ? value : numValue;
          } else {
            rowData[col] = value;
          }
        });

        // Add row and commit immediately
        const row = sheet.addRow(rowData);
        row.eachCell((cell) => {
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
        });
        row.commit();

        processedCount++;

        // Update progress every 1000 records
        if (processedCount % 1000 === 0) {
          const progress = Math.round((processedCount / totalCount) * 100);
          console.log(
            `[Excel Generation ${generationId}] ${sheetName} progress: ${progress}% (${processedCount}/${totalCount})`
          );
          await db.excel_generation.update(
            {
              progress,
              message: `Processing ${sheetName}: ${processedCount}/${totalCount} records`,
            },
            {
              where: { id: generationId },
            }
          );
        }
      }

      console.log(
        `[Excel Generation ${generationId}] Completed ${sheetName}: ${processedCount} records processed`
      );
      return sheet;
    };

    const posVsZomatoColumns = [
      "pos_order_id",
      "zomato_order_id",
      "store_name",
      "order_date",
      "pos_net_amount",
      "zomato_net_amount",
      "pos_vs_zomato_net_amount_delta",
      "pos_tax_paid_by_customer",
      "zomato_tax_paid_by_customer",
      "pos_vs_zomato_tax_paid_by_customer_delta",
      "pos_commission_value",
      "zomato_commission_value",
      "pos_vs_zomato_commission_value_delta",
      "pos_pg_applied_on",
      "zomato_pg_applied_on",
      "pos_vs_zomato_pg_applied_on_delta",
      "pos_pg_charge",
      "zomato_pg_charge",
      "pos_vs_zomato_pg_charge_delta",
      "pos_taxes_zomato_fee",
      "zomato_taxes_zomato_fee",
      "pos_vs_zomato_taxes_zomato_fee_delta",
      "pos_tds_amount",
      "zomato_tds_amount",
      "pos_vs_zomato_tds_amount_delta",
      "pos_final_amount",
      "zomato_final_amount",
      "pos_vs_zomato_final_amount_delta",
      "reconciled_status",
      "reconciled_amount",
      "unreconciled_amount",
      "pos_vs_zomato_reason",
      "order_status_pos",
    ];

    const zomatoVsPosColumns = [
      "zomato_order_id",
      "pos_order_id",
      "order_date",
      "store_name",
      "zomato_net_amount",
      "pos_net_amount",
      "zomato_vs_pos_net_amount_delta",
      "zomato_tax_paid_by_customer",
      "pos_tax_paid_by_customer",
      "zomato_vs_pos_tax_paid_by_customer_delta",
      "zomato_commission_value",
      "pos_commission_value",
      "zomato_vs_pos_commission_value_delta",
      "zomato_pg_applied_on",
      "pos_pg_applied_on",
      "zomato_vs_pos_pg_applied_on_delta",
      "zomato_pg_charge",
      "pos_pg_charge",
      "zomato_vs_pos_pg_charge_delta",
      "zomato_taxes_zomato_fee",
      "pos_taxes_zomato_fee",
      "zomato_vs_pos_taxes_zomato_fee_delta",
      "zomato_tds_amount",
      "pos_tds_amount",
      "zomato_vs_pos_tds_amount_delta",
      "zomato_final_amount",
      "pos_final_amount",
      "zomato_vs_pos_final_amount_delta",
      "calculated_zomato_net_amount",
      "calculated_zomato_tax_paid_by_customer",
      "calculated_zomato_commission_value",
      "calculated_zomato_pg_applied_on",
      "calculated_zomato_pg_charge",
      "calculated_zomato_taxes_zomato_fee",
      "calculated_zomato_tds_amount",
      "calculated_zomato_final_amount",
      "fixed_credit_note_amount",
      "fixed_pro_discount_passthrough",
      "fixed_customer_discount",
      "fixed_rejection_penalty_charge",
      "fixed_user_credits_charge",
      "fixed_promo_recovery_adj",
      "fixed_icecream_handling",
      "fixed_icecream_deductions",
      "fixed_order_support_cost",
      "fixed_merchant_delivery_charge",
      "reconciled_status",
      "reconciled_amount",
      "unreconciled_amount",
      "zomato_vs_pos_reason",
      "order_status_zomato",
    ];

    const textColumnsInPos = [
      "pos_order_id",
      "zomato_order_id",
      "store_name",
      "order_date",
      "reconciled_status",
      "pos_vs_zomato_reason",
      "order_status_pos",
    ];

    const textColumnsInZomato = [
      "zomato_order_id",
      "pos_order_id",
      "store_name",
      "order_date",
      "reconciled_status",
      "zomato_vs_pos_reason",
      "order_status_zomato",
    ];

    const ordersNotInPosColumns = [
      "zomato_order_id",
      "order_date",
      "store_name",
      "zomato_net_amount",
      "zomato_tax_paid_by_customer",
      "zomato_commission_value",
      "zomato_pg_applied_on",
      "zomato_pg_charge",
      "zomato_taxes_zomato_fee",
      "zomato_tds_amount",
      "zomato_final_amount",
      "calculated_zomato_net_amount",
      "calculated_zomato_tax_paid_by_customer",
      "calculated_zomato_commission_value",
      "calculated_zomato_pg_applied_on",
      "calculated_zomato_pg_charge",
      "calculated_zomato_taxes_zomato_fee",
      "calculated_zomato_tds_amount",
      "calculated_zomato_final_amount",
      "fixed_credit_note_amount",
      "fixed_pro_discount_passthrough",
      "fixed_customer_discount",
      "fixed_rejection_penalty_charge",
      "fixed_user_credits_charge",
      "fixed_promo_recovery_adj",
      "fixed_icecream_handling",
      "fixed_icecream_deductions",
      "fixed_order_support_cost",
      "fixed_merchant_delivery_charge",
      "reconciled_status",
      "reconciled_amount",
      "unreconciled_amount",
      "zomato_vs_pos_reason",
      "order_status_zomato",
    ];

    const ordersNotInZomatoColumns = [
      "pos_order_id",
      "store_name",
      "order_date",
      "pos_net_amount",
      "pos_tax_paid_by_customer",
      "pos_commission_value",
      "pos_pg_applied_on",
      "pos_pg_charge",
      "pos_taxes_zomato_fee",
      "pos_tds_amount",
      "pos_final_amount",
      "reconciled_status",
      "reconciled_amount",
      "unreconciled_amount",
      "pos_vs_zomato_reason",
      "order_status_pos",
    ];

    const sheetPromises = [
      // Main sheets
      createSheet(
        "Zomato POS vs 3PO",
        posVsZomatoColumns,
        {
          where: {
            [Op.and]: [
              {
                order_date:
                  start_date === end_date
                    ? start_date
                    : { [Op.between]: [start_date, end_date] },
              },
            ],
          },
          order: [["order_date", "ASC"]],
        },
        textColumnsInPos
      ),
      createSheet(
        "Zomato 3PO vs POS",
        zomatoVsPosColumns,
        {
          where: {
            [Op.and]: [
              {
                order_date:
                  start_date === end_date
                    ? start_date
                    : { [Op.between]: [start_date, end_date] },
              },
              {
                order_status_zomato: { [Op.in]: ["sale", "addition"] },
              },
            ],
          },
          order: [["order_date", "ASC"]],
        },
        textColumnsInZomato
      ),
      createSheet(
        "Zomato 3PO vs POS Refund",
        zomatoVsPosColumns,
        {
          where: {
            [Op.and]: [
              {
                order_date:
                  start_date === end_date
                    ? start_date
                    : { [Op.between]: [start_date, end_date] },
              },
              {
                order_status_zomato: "refund",
              },
            ],
          },
          order: [["order_date", "ASC"]],
        },
        textColumnsInZomato
      ),
      createSheet(
        "Order not found in POS",
        ordersNotInPosColumns,
        {
          where: {
            [Op.and]: [
              {
                order_date:
                  start_date === end_date
                    ? start_date
                    : { [Op.between]: [start_date, end_date] },
              },
            ],
          },
          order: [["order_date", "ASC"]],
        },
        textColumnsInZomato
      ),
      createSheet(
        "Order not found in 3PO",
        ordersNotInZomatoColumns,
        {
          where: {
            [Op.and]: [
              {
                order_date:
                  start_date === end_date
                    ? start_date
                    : { [Op.between]: [start_date, end_date] },
              },
            ],
          },
          order: [["order_date", "ASC"]],
        },
        textColumnsInPos
      ),
    ];

    console.log(
      `[Excel Generation ${generationId}] Starting parallel sheet creation`
    );
    await Promise.all(sheetPromises);
    console.log(
      `[Excel Generation ${generationId}] All sheets created successfully`
    );

    // Commit the workbook to write the file
    console.log(`[Excel Generation ${generationId}] Committing workbook...`);
    await workbook.commit();
    console.log(`[Excel Generation ${generationId}] File saved successfully`);

    // Update final status
    await db.excel_generation.update(
      {
        status: "completed",
        message: "Excel generation completed successfully",
        progress: 100,
        filename: fileName,
      },
      {
        where: { id: generationId },
      }
    );
    console.log(
      `[Excel Generation ${generationId}] Generation completed successfully`
    );
  } catch (error) {
    console.error(`[Excel Generation ${generationId}] Error:`, error);
    await db.excel_generation.update(
      {
        status: "failed",
        message: "Error generating Excel file",
        error: error.message,
      },
      {
        where: { id: generationId },
      }
    );
  }
};

const checkGenerationStatus = async (req, res) => {
  try {
    const generations = await db.excel_generation.findAll({
      order: [["created_at", "DESC"]],
    });

    const formattedGenerations = generations.map((generation) => ({
      id: generation.id,
      store_code: generation.store_code,
      start_date: generation.start_date,
      end_date: generation.end_date,
      status: generation.status,
      progress: generation.progress,
      message: generation.message,
      filename: generation.filename,
      error: generation.error,
      created_at: generation.created_at,
      updated_at: generation.updated_at,
      downloadUrl:
        generation.status === "completed"
          ? `/api/node/reconciliation/download/${generation.filename}`
          : null,
    }));

    res.json({
      success: true,
      data: formattedGenerations,
    });
  } catch (error) {
    console.error("Error fetching generation statuses:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching generation statuses",
    });
  }
};

const generateSummarySheetForZomato = async (
  workbook,
  start_date,
  end_date
) => {
  const worksheet = workbook.addWorksheet("Summary");

  const textToBold = [];
  const cellWithBorders = [];
  const textToRight = [];
  // Row 1
  worksheet.getCell("A1").value = "Debtor Name";
  textToBold?.push("A1");
  worksheet.getCell("B1").value = "Zomato";

  // Row 2
  worksheet.getCell("A2").value = "Recon Period";
  textToBold?.push("A2");

  let startDate = dayjs(start_date).format("MMM DD, YYYY");
  let endDate = dayjs(end_date).format("MMM DD, YYYY");

  worksheet.getCell("B2").value = `${startDate} - ${endDate}`;

  // Empty Row 3
  worksheet.getCell("B3").value = "No. of orders";
  worksheet.getCell("C3").value = "POS Amount";

  textToBold?.push("B3");
  textToBold?.push("C3");

  // Row 4, 5, 6 (Headers)
  worksheet.getCell("A4").value = "POS Sale as per Business Date (S1+S2)";
  worksheet.getCell("A5").value = "POS Sale as per Transaction Date (S1)";
  worksheet.getCell("A6").value =
    "Difference in POS Sale that falls in subsequent time period (S2)";

  textToBold?.push("A4");
  textToBold?.push("A5");
  textToBold?.push("A6");

  worksheet.getCell("B4").value = {
    formula: `COUNTA('Zomato POS vs 3PO'!A2:A1048576)`, // A2 to A∞ (limit of Excel)
  };
  worksheet.getCell("B5").value = {
    formula: `COUNTA('Zomato POS vs 3PO'!A2:A1048576)`, // A2 to A∞ (limit of Excel)
  };
  worksheet.getCell("B6").value = {
    formula: `B4 - B5`,
  };

  worksheet.getCell("C4").value = {
    formula: `SUM('Zomato POS vs 3PO'!E2:E1048576)`,
  };
  worksheet.getCell("C5").value = {
    formula: `SUM('Zomato POS vs 3PO'!E2:E1048576)`,
  };
  worksheet.getCell("C6").value = {
    formula: `C4 - C5`,
  };

  worksheet.addRow([]);

  worksheet.getCell("A8").value = "POS Sale as per Business Date (S1+S2)";
  textToBold?.push("A8");
  cellWithBorders?.push("A8");

  worksheet.mergeCells("B8:F8");
  worksheet.getCell("B8").value = "As per POS data (POS vs 3PO)";
  worksheet.getCell("B8").alignment = {
    vertical: "middle",
    horizontal: "center",
  };
  textToBold?.push("B8");
  cellWithBorders?.push("B8");

  worksheet.mergeCells("G8:K8");
  worksheet.getCell("G8").value = "As per 3PO Data (3PO vs POS)";
  worksheet.getCell("G8").alignment = {
    vertical: "middle",
    horizontal: "center",
  };
  textToBold?.push("G8");
  cellWithBorders?.push("G8");

  //
  worksheet.getCell("A9").value = "Parameters";
  worksheet.getCell("B9").value = "No. of orders";
  worksheet.getCell("C9").value = "POS Amount/Calculated";
  worksheet.getCell("D9").value = "3PO Amount/Actual";
  worksheet.getCell("E9").value = "Diff. in Amount";
  worksheet.getCell("F9").value = "Amount Receivable";
  worksheet.getCell("G9").value = "No. of orders";
  worksheet.getCell("H9").value = "3PO Amount/Actual";
  worksheet.getCell("I9").value = "POS Amount/Calculated";
  worksheet.getCell("J9").value = "Diff. in Amount";
  worksheet.getCell("K9").value = "Amount Receivable";

  textToBold?.push([
    ...textToBold,
    ...["A9", "B9", "C9", "D9", "E9", "F9", "G9", "H9", "I9", "J9", "K9"],
  ]);
  cellWithBorders?.push("A9");
  applyOuterBorder(worksheet, 9, 9, 2, 6);
  applyOuterBorder(worksheet, 9, 9, 7, 11);

  // New Row
  worksheet.getCell("A10").value = "DELIVERED (As per transaction date)";
  worksheet.getCell("B10").value = {
    formula: `COUNTA('Zomato POS vs 3PO'!A2:A1048576)`, // A2 to A∞ (limit of Excel)
  };
  worksheet.getCell("C10").value = {
    formula: `SUM('Zomato POS vs 3PO'!E2:E1048576)`,
  };
  worksheet.getCell("D10").value = {
    formula: `SUM('Zomato POS vs 3PO'!F2:F1048576)`,
  };
  worksheet.getCell("E10").value = {
    formula: `C10 - D10`,
  };
  worksheet.getCell("F10").value = {
    formula: `SUM('Zomato POS vs 3PO'!Z2:Z1048576)`,
  };
  worksheet.getCell("G10").value = {
    formula: `COUNTA('Zomato 3PO vs POS'!A2:A1048576)`,
  };
  worksheet.getCell("H10").value = {
    formula: `SUM('Zomato 3PO vs POS'!E2:E1048576)`,
  };
  worksheet.getCell("I10").value = {
    formula: `SUM('Zomato 3PO vs POS'!F2:F1048576)`,
  };
  worksheet.getCell("J10").value = {
    formula: `H10 - I10`,
  };
  worksheet.getCell("K10").value = {
    formula: `SUM('Zomato 3PO vs POS'!Z2:Z1048576)`,
  };

  textToBold?.push(
    ...[
      "A10",
      "B10",
      "C10",
      "D10",
      "E10",
      "F10",
      "G10",
      "H10",
      "I10",
      "J10",
      "K10",
    ]
  );

  // New Row
  worksheet.getCell("A11").value = "SALE";
  worksheet.getCell("B11").value = "";
  worksheet.getCell("C11").value = "";
  worksheet.getCell("D11").value = "";
  worksheet.getCell("E11").value = "";
  worksheet.getCell("F11").value = "";
  worksheet.getCell("G11").value = {
    formula: `COUNTIFS('Zomato 3PO vs POS'!A2:A1048576, "<>", 'Zomato 3PO vs POS'!AY2:AY1048576, "sale")`,
  };
  worksheet.getCell("H11").value = {
    formula: `SUMIFS('Zomato 3PO vs POS'!E2:E1048576, 'Zomato 3PO vs POS'!E2:E1048576, "<>", 'Zomato 3PO vs POS'!AY2:AY1048576, "sale")`,
  };
  worksheet.getCell("I11").value = {
    formula: `SUMIFS('Zomato 3PO vs POS'!F2:F1048576, 'Zomato 3PO vs POS'!F2:F1048576, "<>", 'Zomato 3PO vs POS'!AY2:AY1048576, "sale")`,
  };
  worksheet.getCell("J11").value = {
    formula: `H11 - I11`,
  };

  worksheet.getCell("K11").value = {
    formula: `SUMIFS('Zomato 3PO vs POS'!Z2:Z1048576, 'Zomato 3PO vs POS'!Z2:Z1048576, "<>", 'Zomato 3PO vs POS'!AY2:AY1048576, "sale")`,
  };

  textToRight?.push("A11");

  // New Row
  worksheet.getCell("A12").value = "ADDITION";
  worksheet.getCell("B12").value = "";
  worksheet.getCell("C12").value = "";
  worksheet.getCell("D12").value = "";
  worksheet.getCell("E12").value = "";
  worksheet.getCell("F12").value = "";
  worksheet.getCell("G12").value = {
    formula: `COUNTIFS('Zomato 3PO vs POS'!A2:A1048576, "<>", 'Zomato 3PO vs POS'!AY2:AY1048576, "addition")`,
  };
  worksheet.getCell("H12").value = {
    formula: `SUMIFS('Zomato 3PO vs POS'!E2:E1048576, 'Zomato 3PO vs POS'!E2:E1048576, "<>", 'Zomato 3PO vs POS'!AY2:AY1048576, "addition")`,
  };
  worksheet.getCell("I12").value = {
    formula: `SUMIFS('Zomato 3PO vs POS'!F2:F1048576, 'Zomato 3PO vs POS'!F2:F1048576, "<>", 'Zomato 3PO vs POS'!AY2:AY1048576, "addition")`,
  };
  worksheet.getCell("J12").value = {
    formula: `H12 - I12`,
  };
  worksheet.getCell("K12").value = {
    formula: `SUMIFS('Zomato 3PO vs POS'!Z2:Z1048576, 'Zomato 3PO vs POS'!Z2:Z1048576, "<>", 'Zomato 3PO vs POS'!AY2:AY1048576, "addition")`,
  };
  textToRight?.push("A12");
  // New Row
  worksheet.getCell("A13").value = "REFUND";
  // worksheet.getCell("B13").value = "";
  // worksheet.getCell("C13").value = "";
  // worksheet.getCell("D13").value = "";
  // worksheet.getCell("E13").value = "";
  // worksheet.getCell("F13").value = "";
  worksheet.getCell("G13").value = {
    formula: `COUNTIFS('Zomato 3PO vs POS Refund'!A2:A1048576, "<>", 'Zomato 3PO vs POS Refund'!AY2:AY1048576, "refund")`,
  };
  worksheet.getCell("H13").value = {
    formula: `SUMIFS('Zomato 3PO vs POS Refund'!E2:E1048576, 'Zomato 3PO vs POS Refund'!E2:E1048576, "<>", 'Zomato 3PO vs POS Refund'!AY2:AY1048576, "refund")`,
  };
  worksheet.getCell("I13").value = {
    formula: `SUMIFS('Zomato 3PO vs POS Refund'!F2:F1048576, 'Zomato 3PO vs POS Refund'!F2:F1048576, "<>", 'Zomato 3PO vs POS Refund'!AY2:AY1048576, "refund")`,
  };
  worksheet.getCell("J13").value = {
    formula: `H13 - I13`,
  };
  worksheet.getCell("K13").value = {
    formula: `SUMIFS('Zomato 3PO vs POS Refund'!Z2:Z1048576, 'Zomato 3PO vs POS Refund'!Z2:Z1048576, "<>", 'Zomato 3PO vs POS Refund'!AY2:AY1048576, "refund")`,
  };
  textToRight?.push("A13");
  // New Row
  // worksheet.getCell("A14").value = "TIMEDOUT";
  // worksheet.getCell("B14").value = "";
  // worksheet.getCell("C14").value = "";
  // worksheet.getCell("D14").value = "";
  // worksheet.getCell("E14").value = "";
  // worksheet.getCell("F14").value = "";
  // worksheet.getCell("G14").value = {
  //   formula: `COUNTIFS('Zomato 3PO vs POS'!A2:A1048576, "<>", 'Zomato 3PO vs POS'!AY2:AY1048576, "TIMEDOUT")`,
  // };
  // worksheet.getCell("H14").value = {
  //   formula: `SUMIFS('Zomato 3PO vs POS'!Z2:Z1048576, 'Zomato 3PO vs POS'!Z2:Z1048576, "<>", 'Zomato 3PO vs POS'!AY2:AY1048576, "TIMEDOUT")`,
  // };
  // worksheet.getCell("I14").value = {
  //   formula: `SUMIFS('Zomato 3PO vs POS'!AA2:AA1048576, 'Zomato 3PO vs POS'!AA2:AA1048576, "<>", 'Zomato 3PO vs POS'!AY2:AY1048576, "TIMEDOUT")`,
  // };
  // worksheet.getCell("J14").value = {
  //   formula: `H14 - I14`,
  // };
  // worksheet.getCell("K14").value = {
  //   formula: `SUMIFS('Zomato 3PO vs POS'!Z2:Z1048576, 'Zomato 3PO vs POS'!Z2:Z1048576, "<>", 'Zomato 3PO vs POS'!AY2:AY1048576, "TIMEDOUT")`,
  // };
  // textToRight?.push("A14");

  // New Row
  worksheet.getCell("A15").value = "Reconciled Orders";
  worksheet.getCell("B15").value = {
    formula: `COUNTIF('Zomato POS vs 3PO'!AC2:AC1048576,"RECONCILED")`, // A2 to A∞ (limit of Excel)
  };
  worksheet.getCell("C15").value = {
    formula: `SUMIFS('Zomato POS vs 3PO'!E2:E1048576, 'Zomato POS vs 3PO'!E2:E1048576, "<>", 'Zomato POS vs 3PO'!AC2:AC1048576,"RECONCILED")`, // A2 to A∞ (limit of Excel)
  };
  worksheet.getCell("D15").value = {
    formula: `SUMIFS('Zomato POS vs 3PO'!F2:F1048576, 'Zomato POS vs 3PO'!F2:F1048576, "<>", 'Zomato POS vs 3PO'!AC2:AC1048576,"RECONCILED")`, // A2 to A∞ (limit of Excel)
  };
  worksheet.getCell("E15").value = {
    formula: `C15 - D15`,
  };
  worksheet.getCell("F15").value = {
    formula: `SUMIFS('Zomato POS vs 3PO'!Z2:Z1048576, 'Zomato POS vs 3PO'!Z2:Z1048576, "<>", 'Zomato POS vs 3PO'!AC2:AC1048576,"RECONCILED")`, // A2 to A∞ (limit of Excel)
  };

  worksheet.getCell("G15").value = {
    formula: `COUNTIF('Zomato 3PO vs POS'!AU2:AU1048576,"RECONCILED")`, // A2 to A∞ (limit of Excel)
  };
  worksheet.getCell("H15").value = {
    formula: `SUMIFS('Zomato 3PO vs POS'!E2:E1048576, 'Zomato 3PO vs POS'!E2:E1048576, "<>", 'Zomato 3PO vs POS'!AU2:AU1048576,"RECONCILED")`, // A2 to A∞ (limit of Excel)
  };
  worksheet.getCell("I15").value = {
    formula: `SUMIFS('Zomato 3PO vs POS'!F2:F1048576, 'Zomato 3PO vs POS'!F2:F1048576, "<>", 'Zomato 3PO vs POS'!AU2:AU1048576,"RECONCILED")`, // A2 to A∞ (limit of Excel)
  };
  worksheet.getCell("J15").value = {
    formula: `H15 - I15`,
  };
  worksheet.getCell("K15").value = {
    formula: `SUMIFS('Zomato 3PO vs POS'!Z2:Z1048576, 'Zomato 3PO vs POS'!Z2:Z1048576, "<>", 'Zomato 3PO vs POS'!AU2:AU1048576,"RECONCILED")`, // A2 to A∞ (limit of Excel)
  };
  textToBold?.push(
    ...[
      "A15",
      "B15",
      "C15",
      "D15",
      "E15",
      "F15",
      "G15",
      "H15",
      "I15",
      "J15",
      "K15",
    ]
  );
  // New Row
  worksheet.getCell("A16").value = "Cancelled by Merchant and found in POS";
  worksheet.getCell("B16").value = 0;
  worksheet.getCell("C16").value = 0;
  worksheet.getCell("D16").value = 0;
  worksheet.getCell("E16").value = 0;
  worksheet.getCell("F16").value = 0;
  worksheet.getCell("G16").value = 0;
  worksheet.getCell("H16").value = 0;
  worksheet.getCell("I16").value = 0;
  worksheet.getCell("J16").value = 0;
  worksheet.getCell("K16").value = 0;
  textToRight?.push("A16");

  // New Row
  worksheet.getCell("A17").value = "Cancelled by Merchant and not found in POS";
  worksheet.getCell("B17").value = 0;
  worksheet.getCell("C17").value = 0;
  worksheet.getCell("D17").value = 0;
  worksheet.getCell("E17").value = 0;
  worksheet.getCell("F17").value = 0;
  worksheet.getCell("G17").value = 0;
  worksheet.getCell("H17").value = 0;
  worksheet.getCell("I17").value = 0;
  worksheet.getCell("J17").value = 0;
  worksheet.getCell("K17").value = 0;
  textToRight?.push("A17");
  // New Row
  worksheet.getCell("A18").value = "Unreconciled Orders";

  worksheet.getCell("B18").value = {
    formula: `COUNTIF('Zomato POS vs 3PO'!AC2:AC1048576,"UNRECONCILED")`, // A2 to A∞ (limit of Excel)
  };
  worksheet.getCell("C18").value = {
    formula: `SUMIFS('Zomato POS vs 3PO'!E2:E1048576, 'Zomato POS vs 3PO'!E2:E1048576, "<>", 'Zomato POS vs 3PO'!AC2:AC1048576,"UNRECONCILED")`, // A2 to A∞ (limit of Excel)
  };
  worksheet.getCell("D18").value = {
    formula: `SUMIFS('Zomato POS vs 3PO'!F2:F1048576, 'Zomato POS vs 3PO'!F2:F1048576, "<>", 'Zomato POS vs 3PO'!AC2:AC1048576,"UNRECONCILED")`, // A2 to A∞ (limit of Excel)
  };
  worksheet.getCell("E18").value = {
    formula: `C18 - D18`,
  };
  worksheet.getCell("F18").value = {
    formula: `SUMIFS('Zomato POS vs 3PO'!Z2:Z1048576, 'Zomato POS vs 3PO'!Z2:Z1048576, "<>", 'Zomato POS vs 3PO'!AC2:AC1048576,"UNRECONCILED")`, // A2 to A∞ (limit of Excel)
  };

  worksheet.getCell("G18").value = {
    formula: `COUNTIF('Zomato 3PO vs POS'!AU2:AU1048576,"UNRECONCILED")`, // A2 to A∞ (limit of Excel)
  };
  worksheet.getCell("H18").value = {
    formula: `SUMIFS('Zomato 3PO vs POS'!E2:E1048576, 'Zomato 3PO vs POS'!E2:E1048576, "<>", 'Zomato 3PO vs POS'!AU2:AU1048576,"UNRECONCILED")`, // A2 to A∞ (limit of Excel)
  };
  worksheet.getCell("I18").value = {
    formula: `SUMIFS('Zomato 3PO vs POS'!F2:F1048576, 'Zomato 3PO vs POS'!F2:F1048576, "<>", 'Zomato 3PO vs POS'!AU2:AU1048576,"UNRECONCILED")`, // A2 to A∞ (limit of Excel)
  };
  worksheet.getCell("J18").value = {
    formula: `H18 - I18`,
  };
  worksheet.getCell("K18").value = {
    formula: `SUMIFS('Zomato 3PO vs POS'!Z2:Z1048576, 'Zomato 3PO vs POS'!Z2:Z1048576, "<>", 'Zomato 3PO vs POS'!AU2:AU1048576,"UNRECONCILED")`, // A2 to A∞ (limit of Excel)
  };

  textToBold?.push(
    ...[
      "A18",
      "B18",
      "C18",
      "D18",
      "E18",
      "F18",
      "G18",
      "H18",
      "I18",
      "J18",
      "K18",
    ]
  );
  // New Row
  worksheet.getCell("A19").value = "Order Not found in 3PO/POS";
  worksheet.getCell("B19").value = {
    formula: `COUNTIFS('Zomato POS vs 3PO'!AC2:AC1048576,"UNRECONCILED", 'Zomato POS vs 3PO'!B2:B1048576, "")`, // A2 to A∞ (limit of Excel)
  };
  worksheet.getCell("C19").value = {
    formula: `SUMIFS('Zomato POS vs 3PO'!E2:E1048576, 'Zomato POS vs 3PO'!E2:E1048576, "<>", 'Zomato POS vs 3PO'!AC2:AC1048576,"UNRECONCILED", 'Zomato POS vs 3PO'!B2:B1048576, "")`, // A2 to A∞ (limit of Excel)
  };
  worksheet.getCell("D19").value = {
    formula: `SUMIFS('Zomato POS vs 3PO'!F2:F1048576, 'Zomato POS vs 3PO'!F2:F1048576, "<>", 'Zomato POS vs 3PO'!AC2:AC1048576,"UNRECONCILED", 'Zomato POS vs 3PO'!B2:B1048576, "")`, // A2 to A∞ (limit of Excel)
  };
  worksheet.getCell("E19").value = {
    formula: `C19 - D19`,
  };
  worksheet.getCell("F19").value = {
    formula: `SUMIFS('Zomato POS vs 3PO'!Z2:Z1048576, 'Zomato POS vs 3PO'!Z2:Z1048576, "<>", 'Zomato POS vs 3PO'!AC2:AC1048576,"UNRECONCILED", 'Zomato POS vs 3PO'!B2:B1048576, "")`, // A2 to A∞ (limit of Excel)
  };
  worksheet.getCell("G19").value = {
    formula: `COUNTIFS('Zomato 3PO vs POS'!AU2:AU1048576,"UNRECONCILED", 'Zomato 3PO vs POS'!B2:B1048576,"")`, // A2 to A∞ (limit of Excel)
  };
  worksheet.getCell("H19").value = {
    formula: `SUMIFS('Zomato 3PO vs POS'!E2:E1048576, 'Zomato 3PO vs POS'!E2:E1048576, "<>", 'Zomato 3PO vs POS'!AU2:AU1048576,"UNRECONCILED", 'Zomato 3PO vs POS'!B2:B1048576,"")`, // A2 to A∞ (limit of Excel)
  };
  worksheet.getCell("I19").value = {
    formula: `SUMIFS('Zomato 3PO vs POS'!F2:F1048576, 'Zomato 3PO vs POS'!F2:F1048576, "<>", 'Zomato 3PO vs POS'!AU2:AU1048576,"UNRECONCILED", 'Zomato 3PO vs POS'!B2:B1048576,"")`, // A2 to A∞ (limit of Excel)
  };
  worksheet.getCell("J19").value = {
    formula: `H19 - I19`,
  };
  worksheet.getCell("K19").value = {
    formula: `SUMIFS('Zomato 3PO vs POS'!Z2:Z1048576, 'Zomato 3PO vs POS'!Z2:Z1048576, "<>", 'Zomato 3PO vs POS'!AU2:AU1048576,"UNRECONCILED", 'Zomato 3PO vs POS'!B2:B1048576,"")`, // A2 to A∞ (limit of Excel)
  };
  textToRight?.push("A19");

  let cellsToRight = allUnreconciliationReasonSummary(workbook, worksheet);
  textToRight?.push(...cellsToRight);
  applyOuterBorder(worksheet, 10, 38, 1, 1);
  applyOuterBorder(worksheet, 10, 38, 2, 6);
  applyOuterBorder(worksheet, 10, 38, 7, 11);

  applyTextBoldToCells(worksheet, textToBold);
  applyBorderToCells(worksheet, cellWithBorders);
  alignTextRightOfCells(worksheet, textToRight);
};

function allUnreconciliationReasonSummary(workbook, worksheet) {
  let textToRight = [];
  // THREE_PO_VS_POS_REASON_LIST
  THREE_PO_VS_POS_REASON_LIST?.map((reason, index) => {
    worksheet.getCell(`A${20 + index}`).value =
      THREEPO_EXCEL_MISMATCH_REASONS[reason];
    worksheet.getCell(`B${20 + index}`).value = {
      formula: `COUNTIFS('Zomato POS vs 3PO'!AC2:AC1048576,"UNRECONCILED", 'Zomato POS vs 3PO'!AF2:AF1048576, "${reason}")`, // A2 to A∞ (limit of Excel)
    };
    worksheet.getCell(`C${20 + index}`).value = {
      formula: `SUMIFS('Zomato POS vs 3PO'!E2:E1048576, 'Zomato POS vs 3PO'!E2:E1048576, "<>", 'Zomato POS vs 3PO'!AC2:AC1048576,"UNRECONCILED", 'Zomato POS vs 3PO'!AF2:AF1048576, "${reason}")`, // A2 to A∞ (limit of Excel)
    };
    worksheet.getCell(`D${20 + index}`).value = {
      formula: `SUMIFS('Zomato POS vs 3PO'!F2:F1048576, 'Zomato POS vs 3PO'!F2:F1048576, "<>", 'Zomato POS vs 3PO'!AC2:AC1048576,"UNRECONCILED", 'Zomato POS vs 3PO'!AF2:AF1048576, "${reason}")`, // A2 to A∞ (limit of Excel)
    };
    worksheet.getCell(`E${20 + index}`).value = {
      formula: `C${20 + index} - D${20 + index}`,
    };
    worksheet.getCell(`F${20 + index}`).value = {
      formula: `SUMIFS('Zomato POS vs 3PO'!Z2:Z1048576, 'Zomato POS vs 3PO'!Z2:Z1048576, "<>", 'Zomato POS vs 3PO'!AC2:AC1048576,"UNRECONCILED", 'Zomato POS vs 3PO'!AF2:AF1048576, "${reason}")`, // A2 to A∞ (limit of Excel)
    };
    worksheet.getCell(`G${20 + index}`).value = {
      formula: `COUNTIFS('Zomato 3PO vs POS'!AU2:AU1048576,"UNRECONCILED", 'Zomato 3PO vs POS'!AX2:AX1048576, "${reason}")`, // A2 to A∞ (limit of Excel)
    };
    worksheet.getCell(`H${20 + index}`).value = {
      formula: `SUMIFS('Zomato 3PO vs POS'!E2:E1048576, 'Zomato 3PO vs POS'!E2:E1048576, "<>", 'Zomato 3PO vs POS'!AU2:AU1048576,"UNRECONCILED", 'Zomato 3PO vs POS'!AX2:AX1048576, "${reason}")`, // A2 to A∞ (limit of Excel)
    };
    worksheet.getCell(`I${20 + index}`).value = {
      formula: `SUMIFS('Zomato 3PO vs POS'!F2:F1048576, 'Zomato 3PO vs POS'!F2:F1048576, "<>", 'Zomato 3PO vs POS'!AU2:AU1048576,"UNRECONCILED", 'Zomato 3PO vs POS'!AX2:AX1048576, "${reason}")`, // A2 to A∞ (limit of Excel)
    };
    worksheet.getCell(`J${20 + index}`).value = {
      formula: `H${20 + index}-I${20 + index}`,
    };
    worksheet.getCell(`K${20 + index}`).value = {
      formula: `SUMIFS('Zomato 3PO vs POS'!Z2:Z1048576, 'Zomato 3PO vs POS'!Z2:Z1048576, "<>", 'Zomato 3PO vs POS'!AU2:AU1048576,"UNRECONCILED", 'Zomato 3PO vs POS'!AX2:AX1048576, "${reason}")`, // A2 to A∞ (limit of Excel)
    };
    textToRight?.push(`A${20 + index}`);
  });

  // New Row
  // worksheet.getCell(`A${20 + THREE_PO_VS_POS_REASON_LIST?.length}`).value =
  //   "Self Mismatch Orders";
  // worksheet.getCell(`A${20 + THREE_PO_VS_POS_REASON_LIST?.length}`).font = {
  //   bold: true,
  // };

  // let aboveRowsTotal = 20 + THREE_PO_VS_POS_REASON_LIST?.length + 1;

  // THREE_PO_SELF_MISMATCH_REASON_LIST?.map((reason, index) => {
  //   const sheetName = CALCULATED_3PO_MISMATCH_SHEETS[index];
  //   worksheet.getCell(`A${aboveRowsTotal + index}`).value =
  //     THREEPO_EXCEL_MISMATCH_REASONS[reason];

  //   worksheet.getCell(`G${aboveRowsTotal + index}`).value = {
  //     formula: `COUNTA('${sheetName}'!A2:A1048576)`,
  //   };
  //   worksheet.getCell(`H${aboveRowsTotal + index}`).value = {
  //     formula: `SUM('${sheetName}'!H2:H1048576)`,
  //   };
  //   worksheet.getCell(`I${aboveRowsTotal + index}`).value = {
  //     formula: `SUM('${sheetName}'!Q2:Q1048576)`,
  //   };
  //   worksheet.getCell(`J${aboveRowsTotal + index}`).value = {
  //     formula: `H${aboveRowsTotal + index}-I${aboveRowsTotal + index}`,
  //   };
  //   worksheet.getCell(`K${aboveRowsTotal + index}`).value = {
  //     formula: `SUM('${sheetName}'!P2:P1048576)`,
  //   };

  //   textToRight?.push(`A${aboveRowsTotal + index}`);
  // });

  return textToRight;
}

function applyOuterBorder(worksheet, startRow, endRow, startCol, endCol) {
  for (let row = startRow; row <= endRow; row++) {
    for (let col = startCol; col <= endCol; col++) {
      const cell = worksheet.getRow(row).getCell(col);
      const border = {};

      if (row === startRow) border.top = { style: "medium" };
      if (row === endRow) border.bottom = { style: "medium" };
      if (col === startCol) border.left = { style: "medium" };
      if (col === endCol) border.right = { style: "medium" };

      cell.border = border;
    }
  }
}

function applyBorderToCells(worksheet, cellAddresses, style = "medium") {
  cellAddresses.forEach((cellAddress) => {
    if (typeof cellAddress === "string") {
      const cell = worksheet.getCell(cellAddress);
      cell.border = {
        top: { style },
        bottom: { style },
        left: { style },
        right: { style },
      };
    }
  });
}

function applyTextBoldToCells(worksheet, cellAddresses) {
  cellAddresses.forEach((cellAddress) => {
    if (typeof cellAddress === "string") {
      const cell = worksheet.getCell(cellAddress);
      cell.font = { bold: true };
    }
  });
}

function alignTextRightOfCells(worksheet, cellAddresses) {
  cellAddresses.forEach((cellAddress) => {
    if (typeof cellAddress === "string") {
      const cell = worksheet.getCell(cellAddress);
      cell.alignment = {
        vertical: "middle",
        horizontal: "right",
      };
    }
  });
}

const getThreePODashboardData = async (req, res) => {
  const requestId = Math.random().toString(36).substring(2, 15);
  const startTime = Date.now();
  
  // ========== ENTRY POINT ==========
  console.log("===========================================");
  console.log("🚀 /threePODashboardData API IS HIT");
  console.log("===========================================");
  console.log(`[${requestId}] [threePODashboardData] API Request Started`, {
    timestamp: new Date().toISOString(),
    requestId,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress
  });

  // Helper function to log SQL queries
  const logSQL = (msg) => {
    // Sequelize logging can pass either a string or an object
    let sqlString = typeof msg === 'string' ? msg : (msg?.sql || msg?.query || JSON.stringify(msg));
    // Clean up the SQL for better readability (replace multiple spaces with single space)
    const formattedSQL = sqlString.replace(/\s+/g, ' ').trim();
    console.log(`[${requestId}] 🔍 Actual SQL Query:`);
    console.log(`[${requestId}] ${formattedSQL}`);
  };

  try {
    const { startDate, endDate, stores } = req.body;

    console.log(`[${requestId}] [threePODashboardData] Request Parameters`, {
      startDate,
      endDate,
      storesCount: stores ? stores.length : 0,
      stores: stores ? stores.slice(0, 10) : null, // Log first 10 stores for brevity
      totalStores: stores ? stores.length : 0
    });

    if (!startDate || !endDate || !stores) {
      console.log(`[${requestId}] [threePODashboardData] Validation Failed`, {
        missingParams: {
          startDate: !startDate,
          endDate: !endDate,
          stores: !stores
        }
      });
      return res.status(400).json({
        success: false,
        message: "Missing required parameters: startDate, endDate, or stores",
      });
    }

    const tenders = ["ZOMATO"]; // Static array of tenders
    console.log(`[${requestId}] [threePODashboardData] Processing for tenders:`, tenders);

    // Get summary data for all stores
    console.log(`\n[${requestId}] ════════════════════════════════════════`);
    console.log(`[${requestId}] 📊 QUERY 1: Summary Data Query`);
    console.log(`[${requestId}] ════════════════════════════════════════`);
    console.log(`[${requestId}] Table: zomato_vs_pos_summary`);
    console.log(`[${requestId}] WHERE conditions:`);
    console.log(`[${requestId}]   - order_date BETWEEN '${startDate}' AND '${endDate}'`);
    console.log(`[${requestId}]   - store_name IN (${stores.length} stores)`);
    console.log(`[${requestId}]   - pos_order_id IS NOT NULL`);
    console.log(`[${requestId}] SELECT aggregations: SUM(pos_net_amount), SUM(pos_final_amount), SUM(pos_commission_value), SUM(pos_tax_paid_by_customer), SUM(zomato_net_amount), SUM(zomato_final_amount), SUM(zomato_commission_value), SUM(zomato_tax_paid_by_customer), SUM(reconciled_amount)`);
    
    const summaryQueryStart = Date.now();
    const summaryData = await db.zomato_vs_pos_summary.findAll({
      where: {
        order_date: {
          [Op.between]: [startDate, endDate],
        },
        store_name: {
          [Op.in]: stores,
        },
        pos_order_id: {
          [Op.ne]: null,
        },
        // order_status_pos: "Delivered",
      },
      attributes: [
        [fn("SUM", col("pos_net_amount")), "posSales"],
        [fn("SUM", col("pos_final_amount")), "posReceivables"],
        [fn("SUM", col("pos_commission_value")), "posCommission"],
        [fn("SUM", col("pos_tax_paid_by_customer")), "posCharges"],
        [fn("SUM", 0), "posDiscounts"],
        [fn("SUM", col("zomato_net_amount")), "threePOSales"],
        [fn("SUM", col("zomato_final_amount")), "threePOReceivables"],
        [fn("SUM", col("zomato_commission_value")), "threePOCommission"],
        [fn("SUM", col("zomato_tax_paid_by_customer")), "threePOCharges"],
        [fn("SUM", 0), "threePODiscounts"],
        [fn("SUM", col("reconciled_amount")), "reconciled"],
        [fn("SUM", col("pos_final_amount")), "receivablesVsReceipts"],
      ],
      raw: true,
      logging: logSQL,
    });
    const summaryQueryTime = Date.now() - summaryQueryStart;
    console.log(`[${requestId}] ✅ Query 1 completed in ${summaryQueryTime}ms`);
    console.log(`[${requestId}] Result count: ${summaryData.length}`);
    console.log(`[${requestId}] ════════════════════════════════════════\n`);

    // Convert summary data to numbers
    const summaryDataNumbers = summaryData[0]
      ? Object.entries(summaryData[0]).reduce((acc, [key, value]) => {
          acc[key] = Number(value) || 0;
          return acc;
        }, {})
      : {};

    // Get data for each tender
    console.log(`[${requestId}] ════════════════════════════════════════`);
    console.log(`[${requestId}] 📊 QUERY 2: Tender-wise Data (3PO Perspective)`);
    console.log(`[${requestId}] ════════════════════════════════════════`);
    console.log(`[${requestId}] Processing ${tenders.length} tender(s): ${tenders.join(", ")}`);
    
    const tenderQueryStart = Date.now();
    const tenderData = await Promise.all(
      tenders.map(async (tender) => {
        console.log(`\n[${requestId}] ──────────────────────────────────────`);
        console.log(`[${requestId}] 📋 Tender: ${tender}`);
        console.log(`[${requestId}] Table: zomato_vs_pos_summary`);
        console.log(`[${requestId}] WHERE conditions:`);
        console.log(`[${requestId}]   - order_date BETWEEN '${startDate}' AND '${endDate}'`);
        console.log(`[${requestId}]   - store_name IN (${stores.length} stores)`);
        console.log(`[${requestId}]   - zomato_order_id IS NOT NULL`);
        console.log(`[${requestId}] SELECT aggregations: SUM(pos_net_amount), SUM(pos_final_amount), SUM(pos_commission_value), SUM(pos_tax_paid_by_customer), SUM(zomato_net_amount), SUM(zomato_final_amount), SUM(zomato_commission_value), SUM(zomato_tax_paid_by_customer), SUM(reconciled_amount), SUM(zomato_net_amount) AS posVsThreePO`);
        
        const tenderQueryStart = Date.now();
        const tenderSummary = await db.zomato_vs_pos_summary.findAll({
          where: {
            order_date: {
              [Op.between]: [startDate, endDate],
            },
            store_name: {
              [Op.in]: stores,
            },
            zomato_order_id: {
              [Op.ne]: null,
            },
          },
          attributes: [
            [fn("SUM", col("pos_net_amount")), "posSales"],
            [fn("SUM", col("pos_final_amount")), "posReceivables"],
            [fn("SUM", col("pos_commission_value")), "posCommission"],
            [fn("SUM", col("pos_tax_paid_by_customer")), "posCharges"],
            [fn("SUM", 0), "posDiscounts"],
            [fn("SUM", col("zomato_net_amount")), "threePOSales"],
            [fn("SUM", col("zomato_final_amount")), "threePOReceivables"],
            [fn("SUM", col("zomato_commission_value")), "threePOCommission"],
            [fn("SUM", col("zomato_tax_paid_by_customer")), "threePOCharges"],
            [fn("SUM", 0), "threePODiscounts"],
            [fn("SUM", col("reconciled_amount")), "reconciled"],
            [fn("SUM", col("zomato_final_amount")), "receivablesVsReceipts"],
            [fn("SUM", col("zomato_net_amount")), "posVsThreePO"],
          ],
          raw: true,
          logging: logSQL,
        });

        // Convert tender summary data to numbers
        const tenderSummaryNumbers = tenderSummary[0]
          ? Object.entries(tenderSummary[0]).reduce((acc, [key, value]) => {
              acc[key] = Number(value) || 0;
              return acc;
            }, {})
          : {};

        const tenderQueryTime = Date.now() - tenderQueryStart;
        console.log(`[${requestId}] ✅ Tender ${tender} query completed in ${tenderQueryTime}ms`);

        console.log(`[${requestId}] 📊 Executing Receivables vs Receipts calculation for tender: ${tender}`);
        console.log(`[${requestId}]   Sub-Query: zomato_receivables_vs_receipts.findAll`);
        console.log(`[${requestId}]   WHERE: order_date BETWEEN '${startDate}' AND '${endDate}', store_name IN (${stores.length} stores)`);
        const { totalReceivables, totalReceipts } =
          await calculateReceivablesVsReceipts(startDate, endDate, stores, requestId);
        console.log(`[${requestId}] ✅ Receivables vs Receipts calculation completed (Receivables: ${totalReceivables}, Receipts: ${totalReceipts})`);
        console.log(`[${requestId}] ──────────────────────────────────────`);

        return {
          ...tenderSummaryNumbers,
          posFreebies: 0,
          threePOFreebies: 0,
          booked: 0,
          promo: 0,
          deltaPromo: 0,
          allThreePOCharges: 0,
          allPOSCharges: 0,
          totalReceivables,
          totalReceipts,
          tenderName: tender,
        };
      })
    );
    const tenderQueryTime = Date.now() - tenderQueryStart;
    console.log(`[${requestId}] ✅ All tender queries (3PO perspective) completed in ${tenderQueryTime}ms`);
    console.log(`[${requestId}] Total tender data count: ${tenderData.length}`);
    console.log(`[${requestId}] ════════════════════════════════════════\n`);

    console.log(`[${requestId}] ════════════════════════════════════════`);
    console.log(`[${requestId}] 📊 QUERY 3: POS-wise Data`);
    console.log(`[${requestId}] ════════════════════════════════════════`);
    
    const posQueryStart = Date.now();
    const tenderWiseDataAsPerPOS = await Promise.all(
      tenders.map(async (tender) => {
        console.log(`\n[${requestId}] ──────────────────────────────────────`);
        console.log(`[${requestId}] 📋 Processing POS data for tender: ${tender}`);
        console.log(`[${requestId}] Table: zomato_vs_pos_summary`);
        console.log(`[${requestId}] WHERE conditions:`);
        console.log(`[${requestId}]   - order_date BETWEEN '${startDate}' AND '${endDate}'`);
        console.log(`[${requestId}]   - store_name IN (${stores.length} stores)`);
        console.log(`[${requestId}]   - pos_order_id IS NOT NULL`);
        console.log(`[${requestId}] SELECT aggregations: SUM(pos_net_amount), SUM(pos_final_amount), SUM(pos_commission_value), SUM(pos_tax_paid_by_customer), SUM(zomato_net_amount), SUM(zomato_final_amount), SUM(zomato_commission_value), SUM(zomato_tax_paid_by_customer), SUM(reconciled_amount), SUM(zomato_net_amount) AS posVsThreePO`);
        
        const posTenderQueryStart = Date.now();
        const tenderSummary = await db.zomato_vs_pos_summary.findAll({
          where: {
            order_date: {
              [Op.between]: [startDate, endDate],
            },
            store_name: {
              [Op.in]: stores,
            },
            pos_order_id: {
              [Op.ne]: null,
            },
          },
          attributes: [
            [fn("SUM", col("pos_net_amount")), "posSales"],
            [fn("SUM", col("pos_final_amount")), "posReceivables"],
            [fn("SUM", col("pos_commission_value")), "posCommission"],
            [fn("SUM", col("pos_tax_paid_by_customer")), "posCharges"],
            [fn("SUM", 0), "posDiscounts"],
            [fn("SUM", col("zomato_net_amount")), "threePOSales"],
            [fn("SUM", col("zomato_final_amount")), "threePOReceivables"],
            [fn("SUM", col("zomato_commission_value")), "threePOCommission"],
            [fn("SUM", col("zomato_tax_paid_by_customer")), "threePOCharges"],
            [fn("SUM", 0), "threePODiscounts"],
            [fn("SUM", col("reconciled_amount")), "reconciled"],
            [fn("SUM", col("pos_final_amount")), "receivablesVsReceipts"],
            [fn("SUM", col("zomato_net_amount")), "posVsThreePO"],
          ],
          raw: true,
          logging: logSQL,
        });

        // Convert tender summary data to numbers
        const tenderSummaryNumbers = tenderSummary[0]
          ? Object.entries(tenderSummary[0]).reduce((acc, [key, value]) => {
              acc[key] = Number(value) || 0;
              return acc;
            }, {})
          : {};

        const posTenderQueryTime = Date.now() - posTenderQueryStart;
        console.log(`[${requestId}] ✅ POS tender ${tender} query completed in ${posTenderQueryTime}ms`);

        console.log(`[${requestId}] 📊 Executing Receivables vs Receipts calculation (POS) for tender: ${tender}`);
        console.log(`[${requestId}]   Sub-Query 1: zomato_vs_pos_summary.findOne (SUM pos_final_amount)`);
        console.log(`[${requestId}]   WHERE: order_date BETWEEN '${startDate}' AND '${endDate}', store_name IN (${stores.length} stores), pos_order_id IS NOT NULL`);
        console.log(`[${requestId}]   Sub-Query 2: zomato_receivables_vs_receipts.findAll`);
        console.log(`[${requestId}]   WHERE: order_date BETWEEN '${startDate}' AND '${endDate}', store_name IN (${stores.length} stores)`);
        const { totalReceivablesPos, totalReceiptsPos } =
          await calculateReceivablesVsReceiptsForPos(
            startDate,
            endDate,
            stores,
            requestId
          );
        console.log(`[${requestId}] ✅ Receivables vs Receipts (POS) calculation completed (Receivables: ${totalReceivablesPos}, Receipts: ${totalReceiptsPos})`);
        console.log(`[${requestId}] ──────────────────────────────────────`);

        return {
          ...tenderSummaryNumbers,
          posFreebies: 0,
          threePOFreebies: 0,
          booked: 0,
          promo: 0,
          deltaPromo: 0,
          allThreePOCharges: 0,
          allPOSCharges: 0,
          totalReceivables: totalReceivablesPos,
          totalReceipts: totalReceiptsPos,
          tenderName: tender,
        };
      })
    );
    const posQueryTime = Date.now() - posQueryStart;
    console.log(`[${requestId}] ✅ All POS queries completed in ${posQueryTime}ms`);
    console.log(`[${requestId}] Total POS data count: ${tenderWiseDataAsPerPOS.length}`);
    console.log(`[${requestId}] ════════════════════════════════════════\n`);

    // Get Instore numbers for Sales
    console.log(`[${requestId}] ════════════════════════════════════════`);
    console.log(`[${requestId}] 📊 QUERY 4: Instore Data Query`);
    console.log(`[${requestId}] ════════════════════════════════════════`);
    console.log(`[${requestId}] Table: orders`);
    console.log(`[${requestId}] WHERE conditions:`);
    console.log(`[${requestId}]   - date BETWEEN '${startDate}' AND '${endDate}'`);
    console.log(`[${requestId}]   - store_name IN (${stores.length} stores)`);
    console.log(`[${requestId}]   - online_order_taker IN ('CASH', 'CARD', 'UPI')`);
    console.log(`[${requestId}] SELECT aggregation: SUM(payment) AS instoreSales`);
    
    const instoreQueryStart = Date.now();
    const instoreTenders = ["CASH", "CARD", "UPI"];
    const instoreData = await db.orders.findAll({
      where: {
        date: {
          [Op.between]: [startDate, endDate],
        },
        store_name: {
          [Op.in]: stores,
        },
        online_order_taker: {
          [Op.in]: instoreTenders,
        },
        // order_status_pos: "Delivered",
      },
      attributes: [[fn("SUM", col("payment")), "instoreSales"]],
      raw: true,
      logging: logSQL,
    });
    const instoreQueryTime = Date.now() - instoreQueryStart;
    console.log(`[${requestId}] ✅ Query 4 (Instore) completed in ${instoreQueryTime}ms`);
    console.log(`[${requestId}] Instore tenders: ${instoreTenders.join(", ")}`);
    console.log(`[${requestId}] Result: ${instoreData[0]?.instoreSales || 0}`);
    console.log(`[${requestId}] ════════════════════════════════════════\n`);

    // Prepare final response
    const response = {
      ...summaryDataNumbers,
      posFreebies: 0,
      threePOFreebies: 0,
      posVsThreePO: 0,
      booked: 0,
      promo: 0,
      deltaPromo: 0,
      allThreePOCharges: 0,
      allPOSCharges: 0,
      threePOData: tenderData,
      tenderWisePOSData: tenderWiseDataAsPerPOS,
      instoreTotal: instoreData[0]?.instoreSales || 0,
    };

    const totalTime = Date.now() - startTime;
    console.log(`[${requestId}] ════════════════════════════════════════`);
    console.log(`[${requestId}] ✅ API Request Completed Successfully`);
    console.log(`[${requestId}] ════════════════════════════════════════`);
    console.log(`[${requestId}] Total execution time: ${totalTime}ms`);
    console.log(`[${requestId}] Summary: tenderDataCount=${tenderData.length}, posDataCount=${tenderWiseDataAsPerPOS.length}, instoreTotal=${instoreData[0]?.instoreSales || 0}`);
    console.log(`[${requestId}] ════════════════════════════════════════\n`);

    res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`[${requestId}] [threePODashboardData] Error in getDashboardData:`, {
      error: error.message,
      stack: error.stack,
      totalTime: totalTime,
      requestId,
      timestamp: new Date().toISOString()
    });
    res.status(500).json({
      success: false,
      message: "Error retrieving dashboard data",
      error: error.message,
    });
  }
};

const calculateReceivablesVsReceipts = async (startDate, endDate, stores, requestId = null) => {
  // --- Receipts summary logic (inserted here) ---
  const logSQLForHelper = requestId ? (msg) => {
    // Sequelize logging can pass either a string or an object
    let sqlString = typeof msg === 'string' ? msg : (msg?.sql || msg?.query || JSON.stringify(msg));
    const formattedSQL = sqlString.replace(/\s+/g, ' ').trim();
    console.log(`[${requestId}]     🔍 Actual SQL Query:`);
    console.log(`[${requestId}]     ${formattedSQL}`);
  } : false;

  const receiptsRecords = await db.zomato_receivables_vs_receipts.findAll({
    where: {
      ...(startDate && endDate
        ? { order_date: { [Op.between]: [startDate, endDate] } }
        : {}),
      ...(stores && stores.length > 0
        ? { store_name: { [Op.in]: stores } }
        : {}),
    },
    raw: true,
    logging: logSQLForHelper,
  });
  if (requestId) {
    console.log(`[${requestId}]     ✅ Receivables query returned ${receiptsRecords.length} records`);
  }
  const utrMap = new Map();
  for (const rec of receiptsRecords) {
    if (!rec.utr_number) continue;
    if (!utrMap.has(rec.utr_number)) {
      utrMap.set(rec.utr_number, {
        utr_number: rec.utr_number,
        final_amount: 0,
        deposit_amount: rec.deposit_amount || 0,
      });
    }
    const entry = utrMap.get(rec.utr_number);
    entry.final_amount += Number(rec.final_amount) || 0;
    // deposit_amount stays as is (from the first record)
  }
  let totalReceivables = 0;
  let totalReceipts = 0;
  for (const entry of utrMap.values()) {
    totalReceivables += parseFloat(entry.final_amount);
    totalReceipts += parseFloat(entry.deposit_amount);
  }
  return { totalReceivables, totalReceipts };
};

const calculateReceivablesVsReceiptsForPos = async (
  startDate,
  endDate,
  stores,
  requestId = null
) => {
  const logSQLForHelper = requestId ? (msg) => {
    // Sequelize logging can pass either a string or an object
    let sqlString = typeof msg === 'string' ? msg : (msg?.sql || msg?.query || JSON.stringify(msg));
    const formattedSQL = sqlString.replace(/\s+/g, ' ').trim();
    console.log(`[${requestId}]     🔍 Actual SQL Query:`);
    console.log(`[${requestId}]     ${formattedSQL}`);
  } : false;

  // Receivable: sum of pos_final_amount from zomato_vs_pos_summary
  const receivableResult = await db.zomato_vs_pos_summary.findOne({
    where: {
      ...(startDate && endDate
        ? { order_date: { [Op.between]: [startDate, endDate] } }
        : {}),
      ...(stores && stores.length > 0
        ? { store_name: { [Op.in]: stores } }
        : {}),
      pos_order_id: { [Op.ne]: null },
    },
    attributes: [[fn("SUM", col("pos_final_amount")), "totalReceivables"]],
    raw: true,
    logging: logSQLForHelper,
  });
  const totalReceivablesPos = Number(receivableResult?.totalReceivables) || 0;
  if (requestId) {
    console.log(`[${requestId}]     ✅ Receivables query returned: ${totalReceivablesPos}`);
  }

  // Receipt: sum of deposit_amount for unique utr_number from zomato_receivables_vs_receipts
  const receiptsRecords = await db.zomato_receivables_vs_receipts.findAll({
    where: {
      ...(startDate && endDate
        ? { order_date: { [Op.between]: [startDate, endDate] } }
        : {}),
      ...(stores && stores.length > 0
        ? { store_name: { [Op.in]: stores } }
        : {}),
    },
    raw: true,
    logging: logSQLForHelper,
  });
  if (requestId) {
    console.log(`[${requestId}]     ✅ Receipts query returned ${receiptsRecords.length} records`);
  }
  const utrSet = new Set();
  let totalReceiptsPos = 0;
  for (const rec of receiptsRecords) {
    if (!rec.utr_number || utrSet.has(rec.utr_number)) continue;
    utrSet.add(rec.utr_number);
    totalReceiptsPos += Number(rec.deposit_amount) || 0;
  }

  return { totalReceivablesPos, totalReceiptsPos };
};

const getInstoreDashboardData = async (req, res) => {
  try {
    const { startDate, endDate, stores } = req.body;

    if (!startDate || !endDate || !stores) {
      return res.status(400).json({
        success: false,
        message: "Missing required parameters: startDate, endDate, or stores",
      });
    }

    // Bank name mappings for CARD and UPI
    const cardBanks = ["AMEX", "YES", "ICICI", "ICICI_LYRA", "HDFC", "SBI87"];
    const upiBanks = ["PHONEPE", "YES_BANK_QR"];

    // Helper function to create default bank data
    const createDefaultBankData = (bankName) => ({
      sales: 0,
      salesCount: 0,
      receipts: 0,
      receiptsCount: 0,
      reconciled: 0,
      reconciledCount: 0,
      difference: 0,
      differenceCount: 0,
      charges: 0,
      booked: 0,
      posVsTrm: 0,
      trmVsMpr: 0,
      mprVsBank: 0,
      salesVsPickup: 0,
      pickupVsReceipts: 0,
      bankName: bankName,
      missingTidValue: "0/0",
      unreconciled: 0,
    });

    // Helper function to create default tender data structure
    const createDefaultTenderData = (tenderName, banks) => ({
      sales: 0,
      salesCount: 0,
      receipts: 0,
      receiptsCount: 0,
      reconciled: 0,
      reconciledCount: 0,
      difference: 0,
      differenceCount: 0,
      charges: 0,
      booked: 0,
      posVsTrm: 0,
      trmVsMpr: 0,
      mprVsBank: 0,
      salesVsPickup: 0,
      pickupVsReceipts: 0,
      tenderName: tenderName,
      bankWiseDataList: banks.map((bank) => createDefaultBankData(bank)),
      trmSalesData: {
        sales: 0,
        salesCount: 0,
        receipts: 0,
        receiptsCount: 0,
        reconciled: 0,
        reconciledCount: 0,
        difference: 0,
        differenceCount: 0,
        charges: 0,
        booked: 0,
        posVsTrm: 0,
        trmVsMpr: 0,
        mprVsBank: 0,
        salesVsPickup: 0,
        pickupVsReceipts: 0,
        unreconciled: 0,
      },
      unreconciled: 0,
    });

    // Initialize response structure
    const tenderWiseData = {
      CARD: createDefaultTenderData("CARD", cardBanks),
      UPI: createDefaultTenderData("UPI", upiBanks),
    };

    // Get aggregator total (for online orders)
    const aggregators = ["Zomato", "Swiggy", "MagicPin"];
    const aggregatorsData = await db.orders.findAll({
      where: {
        date: {
          [Op.between]: [startDate, endDate],
        },
        store_name: {
          [Op.in]: stores,
        },
        online_order_taker: {
          [Op.in]: aggregators,
        },
      },
      attributes: [[fn("SUM", col("payment")), "aggregatorSales"]],
      raw: true,
    });
    console.log(`[getInstoreDashboardData] Aggregator Total:`, aggregatorsData[0]?.aggregatorSales || 0);

    // Get POS sales data for CARD and UPI from orders table
    // Match production query pattern - using col("payment") directly (MySQL will auto-cast)
    // Note: Using case-insensitive matching with Op.iLike or literal for MySQL
    const instoreTenders = ["CARD", "UPI"];
    
    console.log(`[getInstoreDashboardData] Query Parameters:`, {
      startDate,
      endDate,
      storesCount: stores.length,
      instoreTenders,
    });
    
    // First, let's check what tender values actually exist
    const allTendersCheck = await db.orders.findAll({
      where: {
        date: {
          [Op.between]: [startDate, endDate],
        },
        store_name: {
          [Op.in]: stores.slice(0, 10), // Check first 10 stores
        },
      },
      attributes: [
        "online_order_taker",
        [fn("COUNT", col("online_order_taker")), "count"],
      ],
      group: ["online_order_taker"],
      raw: true,
      limit: 20,
    });
    console.log(`[getInstoreDashboardData] Available tender values (sample):`, JSON.stringify(allTendersCheck, null, 2));
    
    const posSalesData = await db.orders.findAll({
      where: {
        date: {
          [Op.between]: [startDate, endDate],
        },
        store_name: {
          [Op.in]: stores,
        },
        [Op.or]: [
          literal("UPPER(online_order_taker) = 'CARD'"),
          literal("UPPER(online_order_taker) = 'UPI'"),
          literal("UPPER(TRIM(online_order_taker)) = 'CARD'"),
          literal("UPPER(TRIM(online_order_taker)) = 'UPI'"),
        ],
      },
      attributes: [
        "online_order_taker",
        [fn("SUM", col("payment")), "sales"],
        [fn("COUNT", col("payment")), "salesCount"],
      ],
      group: ["online_order_taker"],
      raw: true,
    });

    // Debug logging
    console.log(`[getInstoreDashboardData] POS Sales Data Query Results:`, JSON.stringify(posSalesData, null, 2));
    console.log(`[getInstoreDashboardData] Found ${posSalesData.length} rows from orders table`);
    if (posSalesData.length > 0) {
      posSalesData.forEach((row, idx) => {
        console.log(`[getInstoreDashboardData] Row ${idx}:`, {
          tender: row.online_order_taker,
          sales: row.sales,
          salesType: typeof row.sales,
          salesCount: row.salesCount,
        });
      });
    } else {
      console.warn(`[getInstoreDashboardData] No POS sales data found! Check if data exists for date range ${startDate} to ${endDate} and stores.`);
    }

    // Get reconciliation data from pos_vs_trm_summary (optional - table might not exist)
    let reconciliationData = [];
    try {
      reconciliationData = await db.pos_vs_trm_summary.findAll({
        where: {
          pos_date: {
            [Op.between]: [startDate, endDate],
          },
          pos_store: {
            [Op.in]: stores,
          },
          payment_mode: {
            [Op.in]: ["CARD", "UPI"],
          },
        },
        attributes: [
          "payment_mode",
          "acquirer",
          [fn("SUM", literal("COALESCE(pos_amount, 0)")), "sales"],
          [fn("COUNT", literal("CASE WHEN pos_amount IS NOT NULL THEN 1 END")), "salesCount"],
          [fn("SUM", literal("COALESCE(reconciled_amount, 0)")), "reconciled"],
          [fn("COUNT", literal("CASE WHEN reconciled_amount IS NOT NULL AND reconciled_amount > 0 THEN 1 END")), "reconciledCount"],
          [fn("SUM", literal("COALESCE(unreconciled_amount, 0)")), "unreconciled"],
          [fn("SUM", literal("CASE WHEN COALESCE(pos_amount, 0) != COALESCE(trm_amount, 0) THEN ABS(COALESCE(pos_amount, 0) - COALESCE(trm_amount, 0)) ELSE 0 END")), "difference"],
          [fn("COUNT", literal("CASE WHEN COALESCE(pos_amount, 0) != COALESCE(trm_amount, 0) THEN 1 END")), "differenceCount"],
        ],
        group: ["payment_mode", "acquirer"],
        raw: true,
      });
      console.log(`[getInstoreDashboardData] Reconciliation Data: Found ${reconciliationData.length} rows`);
    } catch (reconciliationError) {
      // Table might not exist or other database error
      console.warn("Warning: Could not fetch reconciliation data from pos_vs_trm_summary:", reconciliationError.message);
      // Continue with empty reconciliation data - sales data will still be populated from orders table
      reconciliationData = [];
    }

    // Bank name mappings for acquirer to bank names
    const acquirerToBankMap = {
      AMEX: "AMEX",
      YES: "YES",
      ICICI: "ICICI",
      "ICICI LYRA": "ICICI_LYRA",
      ICICI_LYRA: "ICICI_LYRA",
      HDFC: "HDFC",
      SBI87: "SBI87",
      SBI: "SBI87",
      PHONEPE: "PHONEPE",
      "YES BANK QR": "YES_BANK_QR",
      YES_BANK_QR: "YES_BANK_QR",
    };

    // Get TRM data from trm table (for trmVsMpr calculation)
    // Note: date field in trm table is STRING(64), so we need to handle date parsing
    // The user confirmed: "trm data exist in the trm table"
    let trmData = [];
    try {
      // Try trm table with date conversion (date is stored as STRING)
      // Common date formats: 'YYYY-MM-DD HH:mm:ss', 'DD/MM/YYYY HH:mm:ss', etc.
      // We'll try multiple date format patterns
      trmData = await db.trm.findAll({
        where: {
          [Op.and]: [
            literal(`STR_TO_DATE(date, '%Y-%m-%d %H:%i:%s') BETWEEN '${startDate}' AND '${endDate}'`),
            {
              store_name: {
                [Op.in]: stores,
              },
              payment_mode: {
                [Op.in]: ["CARD", "UPI"],
              },
            },
          ],
        },
        attributes: [
          "payment_mode",
          "acquirer",
          [fn("SUM", literal("COALESCE(amount, 0)")), "trmAmount"],
          [fn("COUNT", literal("CASE WHEN amount IS NOT NULL THEN 1 END")), "trmCount"],
        ],
        group: ["payment_mode", "acquirer"],
        raw: true,
      });
      console.log(`[getInstoreDashboardData] TRM Data from trm table: Found ${trmData.length} rows`);
      
      // If no data found, try alternative date format
      if (trmData.length === 0) {
        try {
          trmData = await db.trm.findAll({
            where: {
              [Op.and]: [
                literal(`STR_TO_DATE(date, '%d/%m/%Y %H:%i:%s') BETWEEN '${startDate}' AND '${endDate}'`),
                {
                  store_name: {
                    [Op.in]: stores,
                  },
                  payment_mode: {
                    [Op.in]: ["CARD", "UPI"],
                  },
                },
              ],
            },
            attributes: [
              "payment_mode",
              "acquirer",
              [fn("SUM", literal("COALESCE(amount, 0)")), "trmAmount"],
              [fn("COUNT", literal("CASE WHEN amount IS NOT NULL THEN 1 END")), "trmCount"],
            ],
            group: ["payment_mode", "acquirer"],
            raw: true,
          });
          console.log(`[getInstoreDashboardData] TRM Data from trm table (alt date format): Found ${trmData.length} rows`);
        } catch (altDateError) {
          console.warn("Warning: Could not parse dates in trm table with alternative format:", altDateError.message);
        }
      }
      
      // If still no data, try without date filter (in case date format is different)
      // But limit to prevent too much data being loaded
      if (trmData.length === 0) {
        try {
          trmData = await db.trm.findAll({
            where: {
              store_name: {
                [Op.in]: stores,
              },
              payment_mode: {
                [Op.in]: ["CARD", "UPI"],
              },
            },
            attributes: [
              "payment_mode",
              "acquirer",
              [fn("SUM", literal("COALESCE(amount, 0)")), "trmAmount"],
              [fn("COUNT", literal("CASE WHEN amount IS NOT NULL THEN 1 END")), "trmCount"],
            ],
            group: ["payment_mode", "acquirer"],
            raw: true,
            limit: 1000, // Limit grouped results
          });
          console.log(`[getInstoreDashboardData] TRM Data from trm table (no date filter): Found ${trmData.length} rows`);
        } catch (noDateFilterError) {
          console.warn("Warning: Could not fetch TRM data from trm table (no date filter):", noDateFilterError.message);
          trmData = [];
        }
      }
    } catch (trmError) {
      console.warn("Warning: Could not fetch TRM data from trm table:", trmError.message);
      trmData = [];
    }

    // Process POS sales data from orders table and populate tender-level sales
    posSalesData.forEach((row) => {
      const tender = row.online_order_taker;
      const sales = parseFloat(row.sales || 0);
      const salesCount = parseInt(row.salesCount || 0);
      
      console.log(`[getInstoreDashboardData] Processing row: tender=${tender}, sales=${sales}, salesCount=${salesCount}`);
      
      if (tender === "CARD" && tenderWiseData.CARD) {
        tenderWiseData.CARD.sales += sales;
        tenderWiseData.CARD.salesCount += salesCount;
        // posVsTrm = POS sales amount
        tenderWiseData.CARD.posVsTrm = sales;
      } else if (tender === "UPI" && tenderWiseData.UPI) {
        tenderWiseData.UPI.sales += sales;
        tenderWiseData.UPI.salesCount += salesCount;
        // posVsTrm = POS sales amount
        tenderWiseData.UPI.posVsTrm = sales;
      }
    });

    // Process TRM data and populate trmVsMpr
    trmData.forEach((row) => {
      const paymentMode = row.payment_mode || "";
      const acquirer = (row.acquirer || "").trim().toUpperCase();
      const bankName = acquirerToBankMap[acquirer] || acquirer;
      const trmAmount = parseFloat(row.trmAmount || 0);

      if (paymentMode === "CARD" && tenderWiseData.CARD) {
        tenderWiseData.CARD.trmVsMpr += trmAmount;
      } else if (paymentMode === "UPI" && tenderWiseData.UPI) {
        tenderWiseData.UPI.trmVsMpr += trmAmount;
      }
    });

    // Process reconciliation data and map acquirer to bank names
    reconciliationData.forEach((row) => {
      const paymentMode = row.payment_mode || "";
      const acquirer = (row.acquirer || "").trim().toUpperCase();
      const bankName = acquirerToBankMap[acquirer] || acquirer;

      if (paymentMode === "CARD" && cardBanks.includes(bankName)) {
        const bankIndex = cardBanks.indexOf(bankName);
        if (bankIndex >= 0 && bankIndex < tenderWiseData.CARD.bankWiseDataList.length) {
          const bankData = tenderWiseData.CARD.bankWiseDataList[bankIndex];
          bankData.sales += parseFloat(row.sales || 0);
          bankData.salesCount += parseInt(row.salesCount || 0);
          bankData.reconciled += parseFloat(row.reconciled || 0);
          bankData.reconciledCount += parseInt(row.reconciledCount || 0);
          bankData.unreconciled += parseFloat(row.unreconciled || 0);
          bankData.difference += parseFloat(row.difference || 0);
          bankData.differenceCount += parseInt(row.differenceCount || 0);
        }
      } else if (paymentMode === "UPI" && upiBanks.includes(bankName)) {
        const bankIndex = upiBanks.indexOf(bankName);
        if (bankIndex >= 0 && bankIndex < tenderWiseData.UPI.bankWiseDataList.length) {
          const bankData = tenderWiseData.UPI.bankWiseDataList[bankIndex];
          bankData.sales += parseFloat(row.sales || 0);
          bankData.salesCount += parseInt(row.salesCount || 0);
          bankData.reconciled += parseFloat(row.reconciled || 0);
          bankData.reconciledCount += parseInt(row.reconciledCount || 0);
          bankData.unreconciled += parseFloat(row.unreconciled || 0);
          bankData.difference += parseFloat(row.difference || 0);
          bankData.differenceCount += parseInt(row.differenceCount || 0);
        }
      }
    });

    // Aggregate data for each tender
    Object.keys(tenderWiseData).forEach((tenderKey) => {
      const tenderData = tenderWiseData[tenderKey];
      
      // Store initial sales from orders table (before aggregating from bank data)
      const salesFromOrders = tenderData.sales;
      const salesCountFromOrders = tenderData.salesCount;
      
      // Reset sales counters (will be recalculated from bank data if reconciliation table exists)
      tenderData.sales = 0;
      tenderData.salesCount = 0;
      
      // Sum up all bank data for this tender
      tenderData.bankWiseDataList.forEach((bankData) => {
        tenderData.sales += bankData.sales;
        tenderData.salesCount += bankData.salesCount;
        tenderData.reconciled += bankData.reconciled;
        tenderData.reconciledCount += bankData.reconciledCount;
        tenderData.difference += bankData.difference;
        tenderData.differenceCount += bankData.differenceCount;
        tenderData.unreconciled += bankData.unreconciled;
      });

      // If reconciliation table had no data, use orders table data instead
      if (tenderData.sales === 0 && salesFromOrders > 0) {
        tenderData.sales = salesFromOrders;
        tenderData.salesCount = salesCountFromOrders;
      }

      // Copy to TRM sales data including posVsTrm and trmVsMpr
      tenderData.trmSalesData.sales = tenderData.sales;
      tenderData.trmSalesData.salesCount = tenderData.salesCount;
      tenderData.trmSalesData.reconciled = tenderData.reconciled;
      tenderData.trmSalesData.reconciledCount = tenderData.reconciledCount;
      tenderData.trmSalesData.difference = tenderData.difference;
      tenderData.trmSalesData.differenceCount = tenderData.differenceCount;
      tenderData.trmSalesData.unreconciled = tenderData.unreconciled;
      tenderData.trmSalesData.posVsTrm = tenderData.posVsTrm;
      tenderData.trmSalesData.trmVsMpr = tenderData.trmVsMpr;
    });

    // Calculate overall totals
    const overallTotals = {
      sales: 0,
      salesCount: 0,
      receipts: 0,
      receiptsCount: 0,
      reconciled: 0,
      reconciledCount: 0,
      difference: 0,
      differenceCount: 0,
      charges: 0,
      booked: 0,
      posVsTrm: 0,
      trmVsMpr: 0,
      mprVsBank: 0,
      salesVsPickup: 0,
      pickupVsReceipts: 0,
      unreconciled: 0,
    };

    Object.values(tenderWiseData).forEach((tenderData) => {
      overallTotals.sales += tenderData.sales;
      overallTotals.salesCount += tenderData.salesCount;
      overallTotals.reconciled += tenderData.reconciled;
      overallTotals.reconciledCount += tenderData.reconciledCount;
      overallTotals.difference += tenderData.difference;
      overallTotals.differenceCount += tenderData.differenceCount;
      overallTotals.unreconciled += tenderData.unreconciled;
      // Note: posVsTrm and trmVsMpr are NOT aggregated at overall level (remain 0)
      // They only exist at tender level in production response
    });

    // Calculate trmSalesData totals (aggregate from all tenders)
    const trmSalesDataTotals = {
      sales: 0,
      salesCount: 0,
      receipts: 0,
      receiptsCount: 0,
      reconciled: 0,
      reconciledCount: 0,
      difference: 0,
      differenceCount: 0,
      charges: 0,
      booked: 0,
      posVsTrm: 0,
      trmVsMpr: 0,
      mprVsBank: 0,
      salesVsPickup: 0,
      pickupVsReceipts: 0,
      unreconciled: 0,
    };

    Object.values(tenderWiseData).forEach((tenderData) => {
      trmSalesDataTotals.sales += tenderData.trmSalesData.sales || 0;
      trmSalesDataTotals.salesCount += tenderData.trmSalesData.salesCount || 0;
      // Note: posVsTrm and trmVsMpr in trmSalesData should remain 0 at overall level
      // They are only populated at tender level in production response
    });

    // Build final response
    const response = {
      ...overallTotals,
      tenderWiseDataList: [tenderWiseData.CARD, tenderWiseData.UPI],
      trmSalesData: trmSalesDataTotals,
      aggregatorTotal: parseFloat(aggregatorsData[0]?.aggregatorSales || 0),
    };

    res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error("Error in getInstoreDashboardData:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving instore dashboard data",
      error: error.message,
    });
  }
};

const generateReceivableVsReceiptExcel = async (req, res) => {
  try {
    const {
      startDate: start_date,
      endDate: end_date,
      stores: store_codes,
    } = req.body;

    if (!start_date || !end_date || !store_codes) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required parameters: start_date, end_date, or store_code",
      });
    }

    // Create reports directory if it doesn't exist
    const reportsDir = path.join(__dirname, "../../reports");
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // Create initial record in database
    const generationRecord = await db.excel_generation.create({
      store_code: `ReceivableVsReceipt_${store_codes?.length} store(s)`,
      start_date,
      end_date,
      status: "pending",
      progress: 0,
      message: "Initializing Excel generation...",
    });

    // 👉 instead of directly calling the heavy function, fork the worker
    const workerPath = path.join(__dirname, "../workers/excelWorker.js");
    const worker = fork(workerPath);

    worker.send({
      jobType: "receivableVsReceipt",
      generationId: generationRecord.id,
      params: {
        start_date,
        end_date,
        store_codes,
        reportsDir,
      },
    });

    worker.on("message", (msg) => {
      console.log(`[Worker Message]`, msg);
      // Optional: you can update DB or logs here if needed
    });

    worker.on("exit", (code) => {
      console.log(`[Worker Exit] Code:`, code);
    });

    // Start background processing
    // processExcelGenerationForReceivableVsReceipts(generationRecord.id, {
    //   start_date,
    //   end_date,
    //   store_codes,
    //   reportsDir,
    // });

    // Return immediately with generation ID
    res.json({
      success: true,
      message: "Excel generation started",
      generationId: generationRecord.id,
      status: "pending",
    });
  } catch (error) {
    console.error("Excel generation error:", error);
    res.status(500).json({
      success: false,
      message: "Server error starting Excel generation",
    });
  }
};

const processExcelGenerationForReceivableVsReceipts = async (
  generationId,
  params
) => {
  try {
    const { start_date, end_date, store_codes, reportsDir } = params;

    // Update status to processing
    await db.excel_generation.update(
      {
        status: "processing",
        message: "Starting Excel generation...",
        progress: 0,
      },
      {
        where: { id: generationId },
      }
    );

    // First create a regular workbook for the summary sheet
    const summaryWorkbook = new ExcelJS.Workbook();
    console.log(`[Excel Generation ${generationId}] Created summary workbook`);

    // Generate summary sheet
    await generateSummarySheetForZomatoReceivableVsReceipts(
      summaryWorkbook,
      start_date,
      end_date
    );
    // Now create the streaming workbook for data sheets
    let fileName = `receivable_vs_receipt_${store_codes?.length}_stores_${dayjs(
      start_date
    ).format("DD-MM-YYYY")}_${dayjs(end_date).format(
      "DD-MM-YYYY"
    )}_${generationId}.xlsx`;
    const options = {
      filename: path.join(reportsDir, fileName),
      useStyles: true,
      useSharedStrings: true,
    };
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter(options);
    // Copy summary sheet to streaming workbook
    const summarySheet = workbook.addWorksheet("Summary");
    const originalSummarySheet = summaryWorkbook.getWorksheet("Summary");

    // Copy all rows from original summary sheet
    originalSummarySheet.eachRow((row, rowNumber) => {
      const newRow = summarySheet.getRow(rowNumber);
      row.eachCell((cell, colNumber) => {
        const newCell = newRow.getCell(colNumber);
        newCell.value = cell.value;
        newCell.style = cell.style;
      });
      newRow.commit();
    });

    // Sheet creation utility with streaming
    const createSheet = async (sheetName, columns, query, textColumns = []) => {
      const sheet = workbook.addWorksheet(sheetName);
      // Special handling for ReceivableVsReceipt sheet
      if (sheetName === "ReceivableVsReceipt") {
        // Get unique UTR numbers with their aggregated data
        const utrSummaryData = await db.zomato_receivables_vs_receipts.findAll({
          where: {
            order_date: {
              [Op.between]: [start_date, end_date],
            },
            store_name: { [Op.in]: store_codes },
            utr_number: { [Op.ne]: null },
          },
          attributes: [
            "utr_number",
            "utr_date",
            [fn("SUM", col("final_amount")), "receivable"],
            [fn("MAX", col("deposit_amount")), "receipt"], // Take one record as deposit_amount is already summed
          ],
          group: ["utr_number", "utr_date"],
          raw: true,
        });

        if (utrSummaryData.length === 0) {
          // Check if there's any data at all in the table for the date range
          const rawDataCheck = await db.zomato_receivables_vs_receipts.findAll({
            where: {
              order_date: {
                [Op.between]: [start_date, end_date],
              },
            },
            attributes: [
              "order_date",
              "store_name",
              "utr_number",
              "final_amount",
              "deposit_amount",
            ],
            limit: 5,
            raw: true,
          });
        }

        // Set up columns with minimal styling
        sheet.columns = columns.map((col) => ({
          header: col,
          key: col,
          width: 20,
        }));

        // Apply header styles only once
        const headerRow = sheet.getRow(1);
        headerRow.eachCell((cell) => {
          cell.font = { bold: true };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFE0E0E0" },
          };
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
        });
        headerRow.commit();

        let processedCount = 0;

        // Process each UTR summary record
        for (const record of utrSummaryData) {
          const rowData = {};

          // Add UTR number and date
          rowData["utr_number"] = record.utr_number;
          rowData["utr_date"] = record.utr_date;

          // Add receivable (sum of final_amount)
          rowData["receivable"] = Number(record.receivable) || 0;

          // Add receipt (deposit_amount - already summed)
          rowData["receipt"] = Number(record.receipt) || 0;

          // Calculate delta
          rowData["delta"] = rowData["receivable"] - rowData["receipt"];

          if (rowData["delta"] < -1) {
            rowData["remarks"] = "Excess Payment Received";
          } else if (rowData["delta"] > 1) {
            rowData["remarks"] = "Short Payment Received";
          } else {
            rowData["remarks"] = "Equal Payment Received";
          }

          // Add row and commit immediately
          const row = sheet.addRow(rowData);
          row.eachCell((cell) => {
            cell.border = {
              top: { style: "thin" },
              left: { style: "thin" },
              bottom: { style: "thin" },
              right: { style: "thin" },
            };
          });
          row.commit();

          processedCount++;

          // Update progress every 100 records
          if (processedCount % 100 === 0) {
            const progress = Math.round(
              (processedCount / utrSummaryData.length) * 100
            );
            await db.excel_generation.update(
              {
                progress,
                message: `Processing ${sheetName}: ${processedCount}/${utrSummaryData.length} records`,
              },
              {
                where: { id: generationId },
              }
            );
          }
        }
        return sheet;
      }

      // Special handling for Receivable 3PO And POS sheet
      if (sheetName === "Receivable 3PO And POS") {
        // Set up columns with minimal styling
        sheet.columns = columns.map((col) => ({
          header: col,
          key: col,
          width: 20,
        }));

        // Apply header styles only once
        const headerRow = sheet.getRow(1);
        headerRow.eachCell((cell) => {
          cell.font = { bold: true };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFE0E0E0" },
          };
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
        });
        headerRow.commit();

        // Get POS Receivable data for unique store_name and order_date combinations
        const posReceivableData = await db.zomato_vs_pos_summary.findAll({
          where: {
            order_date: {
              [Op.between]: [start_date, end_date],
            },
            store_name: { [Op.in]: store_codes },
            pos_order_id: { [Op.ne]: null },
          },
          attributes: [
            "store_name",
            [fn("DATE", col("order_date")), "order_date"],
            [fn("SUM", col("pos_final_amount")), "pos_receivable"],
          ],
          group: ["store_name", fn("DATE", col("order_date"))],
          raw: true,
        });

        // Get 3PO Receivable data for unique store_name and order_date combinations
        const threepoReceivableData = await db.zomato_vs_pos_summary.findAll({
          where: {
            order_date: {
              [Op.between]: [start_date, end_date],
            },
            store_name: { [Op.in]: store_codes },
            zomato_order_id: { [Op.ne]: null },
          },
          attributes: [
            "store_name",
            [fn("DATE", col("order_date")), "order_date"],
            [fn("SUM", col("zomato_final_amount")), "threepo_receivable"],
          ],
          group: ["store_name", fn("DATE", col("order_date"))],
          raw: true,
        });

        console.log(
          `[Excel Generation ${generationId}] POS Receivable data found:`,
          posReceivableData.length
        );
        console.log(
          `[Excel Generation ${generationId}] 3PO Receivable data found:`,
          threepoReceivableData.length
        );

        // Create maps for quick lookup
        const posReceivableMap = new Map();
        const threepoReceivableMap = new Map();

        posReceivableData.forEach((item) => {
          const key = `${item.store_name}_${item.order_date}`;
          posReceivableMap.set(key, Number(item.pos_receivable) || 0);
        });

        threepoReceivableData.forEach((item) => {
          const key = `${item.store_name}_${item.order_date}`;
          threepoReceivableMap.set(key, Number(item.threepo_receivable) || 0);
        });

        // Track which store_name and order_date combinations we've already processed
        const processedCombinations = new Set();

        // Define table for this sheet
        const table = db.zomato_receivables_vs_receipts;

        // Get total count for progress tracking
        const totalCount = await table.count({
          where: {
            ...query.where,
            store_name: { [Op.in]: store_codes },
          },
        });

        if (totalCount === 0) {
          console.log(
            `[Excel Generation ${generationId}] No records found for ${sheetName}`
          );
          return sheet;
        }

        console.log(
          `[Excel Generation ${generationId}] Processing ${totalCount} records for ${sheetName}`
        );

        // Use streaming for better memory management
        const stream = await table.findAll({
          where: {
            ...query.where,
            store_name: { [Op.in]: store_codes },
          },
          order: query.order,
          stream: true,
        });

        let processedCount = 0;

        // Process records in chunks
        for await (const record of stream) {
          const rowData = {};
          columns.forEach((col) => {
            const value = record[col];
            // Convert to number if not in textColumns and value is not null/undefined
            if (
              !textColumns.includes(col) &&
              value !== null &&
              value !== undefined
            ) {
              const numValue = Number(value);
              rowData[col] = isNaN(numValue) ? value : numValue;
            } else {
              rowData[col] = value;
            }
          });

          // Add POS and 3PO Receivable columns
          const recordDate = record.order_date
            ? new Date(record.order_date).toISOString().split("T")[0]
            : record.order_date;
          const key = `${record.store_name}_${recordDate}`;

          // Check if this combination has been processed before
          if (processedCombinations.has(key)) {
            // For subsequent records with same store_name and order_date, set receivable values to 0
            rowData["pos_receivable"] = 0;
            rowData["threepo_receivable"] = 0;
          } else {
            // For first occurrence, set the actual values and mark as processed
            rowData["pos_receivable"] = posReceivableMap.get(key) || 0;
            rowData["threepo_receivable"] = threepoReceivableMap.get(key) || 0;
            processedCombinations.add(key);
          }

          // Debug logging for first few records
          if (processedCount < 5) {
            console.log(
              `[Excel Generation ${generationId}] Record ${processedCount + 1}:`
            );
            console.log(
              `  Store: ${record.store_name}, Original Date: ${record.order_date}, Formatted Date: ${recordDate}`
            );
            console.log(`  Lookup key: ${key}`);
            console.log(`  POS Receivable value: ${rowData["pos_receivable"]}`);
            console.log(
              `  3PO Receivable value: ${rowData["threepo_receivable"]}`
            );
            console.log(
              `  Already processed: ${processedCombinations.has(key)}`
            );
          }

          // Add row and commit immediately
          const row = sheet.addRow(rowData);
          row.eachCell((cell) => {
            cell.border = {
              top: { style: "thin" },
              left: { style: "thin" },
              bottom: { style: "thin" },
              right: { style: "thin" },
            };
          });
          row.commit();

          processedCount++;

          // Update progress every 1000 records
          if (processedCount % 1000 === 0) {
            const progress = Math.round((processedCount / totalCount) * 100);
            console.log(
              `[Excel Generation ${generationId}] ${sheetName} progress: ${progress}% (${processedCount}/${totalCount})`
            );
            await db.excel_generation.update(
              {
                progress,
                message: `Processing ${sheetName}: ${processedCount}/${totalCount} records`,
              },
              {
                where: { id: generationId },
              }
            );
          }
        }

        console.log(
          `[Excel Generation ${generationId}] Completed ${sheetName}: ${processedCount} records processed`
        );
        return sheet;
      }

      // Set up columns with minimal styling
      sheet.columns = columns.map((col) => ({
        header: col,
        key: col,
        width: 20,
      }));

      // Apply header styles only once
      const headerRow = sheet.getRow(1);
      headerRow.eachCell((cell) => {
        cell.font = { bold: true };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE0E0E0" },
        };
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });
      headerRow.commit();

      // Determine which table to query based on sheet name
      let table;
      switch (sheetName) {
        case "Zomato POS vs 3PO":
          table = db.zomato_pos_vs_3po_data;
          break;
        case "Zomato 3PO vs POS":
          table = db.zomato_3po_vs_pos_data;
          break;
        case "Zomato 3PO vs POS Refund":
          table = db.zomato_3po_vs_pos_refund_data;
          break;
        case "Order not found in POS":
          table = db.orders_not_in_pos_data;
          break;
        case "Order not found in 3PO":
          table = db.orders_not_in_3po_data;
          break;
        default:
          throw new Error(`Unknown sheet name: ${sheetName}`);
      }

      // Get total count for progress tracking
      const totalCount = await table.count({
        where: {
          ...query.where,
          store_name: { [Op.in]: store_codes },
        },
      });

      if (totalCount === 0) {
        console.log(
          `[Excel Generation ${generationId}] No records found for ${sheetName}`
        );
        return sheet;
      }

      console.log(
        `[Excel Generation ${generationId}] Processing ${totalCount} records for ${sheetName}`
      );

      // Use streaming for better memory management
      const stream = await table.findAll({
        where: {
          ...query.where,
          store_name: { [Op.in]: store_codes },
        },
        order: query.order,
        stream: true,
      });

      let processedCount = 0;

      // Process records in chunks
      for await (const record of stream) {
        const rowData = {};
        columns.forEach((col) => {
          const value = record[col];
          // Convert to number if not in textColumns and value is not null/undefined
          if (
            !textColumns.includes(col) &&
            value !== null &&
            value !== undefined
          ) {
            const numValue = Number(value);
            rowData[col] = isNaN(numValue) ? value : numValue;
          } else {
            rowData[col] = value;
          }
        });

        // Add row and commit immediately
        const row = sheet.addRow(rowData);
        row.eachCell((cell) => {
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
        });
        row.commit();

        processedCount++;

        // Update progress every 1000 records
        if (processedCount % 1000 === 0) {
          const progress = Math.round((processedCount / totalCount) * 100);
          console.log(
            `[Excel Generation ${generationId}] ${sheetName} progress: ${progress}% (${processedCount}/${totalCount})`
          );
          await db.excel_generation.update(
            {
              progress,
              message: `Processing ${sheetName}: ${processedCount}/${totalCount} records`,
            },
            {
              where: { id: generationId },
            }
          );
        }
      }

      console.log(
        `[Excel Generation ${generationId}] Completed ${sheetName}: ${processedCount} records processed`
      );
      return sheet;
    };

    const posVsZomatoColumns = [
      "pos_order_id",
      "zomato_order_id",
      "store_name",
      "order_date",
      "pos_net_amount",
      "zomato_net_amount",
      "pos_vs_zomato_net_amount_delta",
      "pos_tax_paid_by_customer",
      "zomato_tax_paid_by_customer",
      "pos_vs_zomato_tax_paid_by_customer_delta",
      "pos_commission_value",
      "zomato_commission_value",
      "pos_vs_zomato_commission_value_delta",
      "pos_pg_applied_on",
      "zomato_pg_applied_on",
      "pos_vs_zomato_pg_applied_on_delta",
      "pos_pg_charge",
      "zomato_pg_charge",
      "pos_vs_zomato_pg_charge_delta",
      "pos_taxes_zomato_fee",
      "zomato_taxes_zomato_fee",
      "pos_vs_zomato_taxes_zomato_fee_delta",
      "pos_tds_amount",
      "zomato_tds_amount",
      "pos_vs_zomato_tds_amount_delta",
      "pos_final_amount",
      "zomato_final_amount",
      "pos_vs_zomato_final_amount_delta",
      "reconciled_status",
      "reconciled_amount",
      "unreconciled_amount",
      "pos_vs_zomato_reason",
      "order_status_pos",
    ];

    const zomatoVsPosColumns = [
      "zomato_order_id",
      "pos_order_id",
      "order_date",
      "store_name",
      "zomato_net_amount",
      "pos_net_amount",
      "zomato_vs_pos_net_amount_delta",
      "zomato_tax_paid_by_customer",
      "pos_tax_paid_by_customer",
      "zomato_vs_pos_tax_paid_by_customer_delta",
      "zomato_commission_value",
      "pos_commission_value",
      "zomato_vs_pos_commission_value_delta",
      "zomato_pg_applied_on",
      "pos_pg_applied_on",
      "zomato_vs_pos_pg_applied_on_delta",
      "zomato_pg_charge",
      "pos_pg_charge",
      "zomato_vs_pos_pg_charge_delta",
      "zomato_taxes_zomato_fee",
      "pos_taxes_zomato_fee",
      "zomato_vs_pos_taxes_zomato_fee_delta",
      "zomato_tds_amount",
      "pos_tds_amount",
      "zomato_vs_pos_tds_amount_delta",
      "zomato_final_amount",
      "pos_final_amount",
      "zomato_vs_pos_final_amount_delta",
      "calculated_zomato_net_amount",
      "calculated_zomato_tax_paid_by_customer",
      "calculated_zomato_commission_value",
      "calculated_zomato_pg_applied_on",
      "calculated_zomato_pg_charge",
      "calculated_zomato_taxes_zomato_fee",
      "calculated_zomato_tds_amount",
      "calculated_zomato_final_amount",
      "fixed_credit_note_amount",
      "fixed_pro_discount_passthrough",
      "fixed_customer_discount",
      "fixed_rejection_penalty_charge",
      "fixed_user_credits_charge",
      "fixed_promo_recovery_adj",
      "fixed_icecream_handling",
      "fixed_icecream_deductions",
      "fixed_order_support_cost",
      "fixed_merchant_delivery_charge",
      "reconciled_status",
      "reconciled_amount",
      "unreconciled_amount",
      "zomato_vs_pos_reason",
      "order_status_zomato",
    ];

    const textColumnsInPos = [
      "pos_order_id",
      "zomato_order_id",
      "store_name",
      "order_date",
      "reconciled_status",
      "pos_vs_zomato_reason",
      "order_status_pos",
    ];

    const textColumnsInZomato = [
      "zomato_order_id",
      "pos_order_id",
      "store_name",
      "order_date",
      "reconciled_status",
      "zomato_vs_pos_reason",
      "order_status_zomato",
    ];

    const receivable3POAndPOS = [
      "order_date",
      "store_name",
      "utr_number",
      "utr_date",
      "total_orders",
      "final_amount",
      "pos_receivable",
      // "threepo_receivable",
    ];

    const textColumnsInReceivable3POAndPOS = [
      "order_date",
      "store_name",
      "utr_number",
      "utr_date",
    ];

    const receivableVsReceiptColumns = [
      "utr_number",
      "utr_date",
      "receivable",
      "receipt",
      "delta",
      "remarks",
    ];

    const textColumnsInReceivableVsReceipt = ["utr_number", "utr_date"];

    const sheetPromises = [
      // ReceivableVsReceipt sheet
      createSheet(
        "ReceivableVsReceipt",
        receivableVsReceiptColumns,
        {
          where: {
            [Op.and]: [
              {
                order_date:
                  start_date === end_date
                    ? start_date
                    : { [Op.between]: [start_date, end_date] },
              },
            ],
          },
          order: [["utr_number", "ASC"]],
        },
        textColumnsInReceivableVsReceipt
      ),
      // Receivable 3PO And POS sheet
      createSheet(
        "Receivable 3PO And POS",
        receivable3POAndPOS,
        {
          where: {
            [Op.and]: [
              {
                order_date:
                  start_date === end_date
                    ? start_date
                    : { [Op.between]: [start_date, end_date] },
              },
            ],
          },
          order: [["order_date", "ASC"]],
        },
        textColumnsInReceivable3POAndPOS
      ),

      // Main sheets
      createSheet(
        "Zomato POS vs 3PO",
        posVsZomatoColumns,
        {
          where: {
            [Op.and]: [
              {
                order_date:
                  start_date === end_date
                    ? start_date
                    : { [Op.between]: [start_date, end_date] },
              },
            ],
          },
          order: [["order_date", "ASC"]],
        },
        textColumnsInPos
      ),
      createSheet(
        "Zomato 3PO vs POS",
        zomatoVsPosColumns,
        {
          where: {
            [Op.and]: [
              {
                order_date:
                  start_date === end_date
                    ? start_date
                    : { [Op.between]: [start_date, end_date] },
              },
              {
                order_status_zomato: { [Op.in]: ["sale", "addition"] },
              },
            ],
          },
          order: [["order_date", "ASC"]],
        },
        textColumnsInZomato
      ),
      createSheet(
        "Zomato 3PO vs POS Refund",
        zomatoVsPosColumns,
        {
          where: {
            [Op.and]: [
              {
                order_date:
                  start_date === end_date
                    ? start_date
                    : { [Op.between]: [start_date, end_date] },
              },
              {
                order_status_zomato: "refund",
              },
            ],
          },
          order: [["order_date", "ASC"]],
        },
        textColumnsInZomato
      ),
    ];

    console.log(
      `[Excel Generation ${generationId}] Starting parallel sheet creation`
    );
    await Promise.all(sheetPromises);
    console.log(
      `[Excel Generation ${generationId}] All sheets created successfully`
    );

    // Commit the workbook to write the file
    console.log(`[Excel Generation ${generationId}] Committing workbook...`);
    await workbook.commit();
    console.log(`[Excel Generation ${generationId}] File saved successfully`);

    // Update final status
    await db.excel_generation.update(
      {
        status: "completed",
        message: "Excel generation completed successfully",
        progress: 100,
        filename: fileName,
      },
      {
        where: { id: generationId },
      }
    );
    console.log(
      `[Excel Generation ${generationId}] Generation completed successfully`
    );
  } catch (error) {
    console.error(`[Excel Generation ${generationId}] Error:`, error);
    await db.excel_generation.update(
      {
        status: "failed",
        message: "Error generating Excel file",
        error: error.message,
      },
      {
        where: { id: generationId },
      }
    );
  }
};

const generateSummarySheetForZomatoReceivableVsReceipts = async (
  workbook,
  start_date,
  end_date
) => {
  const worksheet = workbook.addWorksheet("Summary");

  const textToBold = [];
  const cellWithBorders = [];
  const textToRight = [];
  // Row 1
  worksheet.getCell("A1").value = "Debtor Name";
  textToBold?.push("A1");
  worksheet.getCell("B1").value = "Zomato";

  worksheet.getCell("A2").value = "Brand";
  textToBold?.push("A2");
  worksheet.getCell("B2").value = "Pizza hut";

  // Row 2
  worksheet.getCell("A3").value = "Recon Period";
  textToBold?.push("A3");

  let startDate = dayjs(start_date).format("MMM DD, YYYY");
  let endDate = dayjs(end_date).format("MMM DD, YYYY");

  worksheet.getCell("B3").value = `${startDate} - ${endDate}`;

  // Empty Row 3
  worksheet.getCell("B4").value = "No. of orders";
  worksheet.getCell("C4").value = "3PO Amount";

  textToBold?.push("B4");
  textToBold?.push("C4");

  // Row 4, 5, 6 (Headers)
  worksheet.getCell("A5").value = "Sale as per Business Date";
  worksheet.getCell("B5").value = {
    formula: `SUM('Receivable 3PO And POS'!E2:E1048576)`, // A2 to A∞ (limit of Excel)
  };

  worksheet.getCell("C5").value = {
    formula: `SUM('Receivable 3PO And POS'!F2:F1048576)`,
  };

  // worksheet.addRow([]);

  //
  worksheet.getCell("A6").value = "Parameters";
  worksheet.getCell("B6").value = "No. of orders as per 3PO";
  worksheet.getCell("C6").value = "Receivable as 3PO";
  worksheet.getCell("D6").value = "Receivable as POS";
  worksheet.getCell("E6").value = "Receipt";
  worksheet.getCell("F6").value = "Difference";
  worksheet.getCell("G6").value = "Remarks";

  textToBold?.push("A6");
  textToBold?.push("B6");
  textToBold?.push("C6");
  textToBold?.push("D6");
  textToBold?.push("E6");
  textToBold?.push("F6");
  textToBold?.push("G6");

  cellWithBorders?.push("A6");
  cellWithBorders?.push("B6");
  cellWithBorders?.push("C6");
  cellWithBorders?.push("D6");
  cellWithBorders?.push("E6");
  cellWithBorders?.push("F6");
  cellWithBorders?.push("G6");
  // applyOuterBorder(worksheet, 6, 6, 2, 6);

  // New Row
  worksheet.getCell("A7").value = "Details";
  worksheet.getCell("B7").value = {
    formula: `SUM('Receivable 3PO And POS'!E2:E1048576)`, // A2 to A∞ (limit of Excel)
  };
  worksheet.getCell("C7").value = {
    formula: `SUM('Receivable 3PO And POS'!F2:F1048576)`,
  };
  worksheet.getCell("D7").value = {
    formula: `SUM('Receivable 3PO And POS'!G2:G1048576)`,
  };
  worksheet.getCell("E7").value = {
    formula: `SUM('ReceivableVsReceipt'!D2:D1048576)`,
  };
  worksheet.getCell("F7").value = {
    formula: `C7 - E7`,
  };
  worksheet.getCell("G7").value = {
    formula: `IF(F7<0,"Excess Payment Received",IF(F7>0,"Short Payment Received","Equal Payment Received"))`,
  };
  cellWithBorders?.push("A7");
  cellWithBorders?.push("B7");
  cellWithBorders?.push("C7");
  cellWithBorders?.push("D7");
  cellWithBorders?.push("E7");
  cellWithBorders?.push("F7");
  cellWithBorders?.push("G7");

  // applyOuterBorder(worksheet, 10, 38, 1, 1);
  // applyOuterBorder(worksheet, 10, 38, 2, 6);
  // applyOuterBorder(worksheet, 10, 38, 7, 11);

  applyTextBoldToCells(worksheet, textToBold);
  applyBorderToCells(worksheet, cellWithBorders);
  alignTextRightOfCells(worksheet, textToRight);
};

// Get missing store mappings for 3PO
const getMissingStoreMappings = async (req, res) => {
  try {
    // Get all stores that don't have mappings in zomato_mappings table
    const missingMappings = await db.store.findAll({
      attributes: [
        'store_code',
        'store_name',
        'city',
        'state',
        'store_type',
        'store_status'
      ],
      where: {
        store_code: {
          [Op.notIn]: db.bercos.literal(
            '(SELECT DISTINCT store_code FROM zomato_mappings WHERE store_code IS NOT NULL)'
          )
        }
      },
      order: [['store_name', 'ASC']],
      raw: true
    });

    // Group by tender (for now, we'll use ZOMATO as the tender)
    const response = {
      ZOMATO: missingMappings.map(store => ({
        store_code: store.store_code,
        store_name: store.store_name,
        city: store.city,
        state: store.state,
        store_type: store.store_type,
        store_status: store.store_status,
        tender: 'ZOMATO'
      }))
    };

    res.status(200).json({
      success: true,
      data: response
    });
  } catch (error) {
    console.error("Error in getMissingStoreMappings:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving missing store mappings",
      error: error.message
    });
  }
};

module.exports = {
  createZomatoSummaryRecords,
  calculateDeltaValues,
  checkReconciliationStatus,
  generateReconciliationExcel,
  getThreePODashboardData,
  getInstoreDashboardData,
  checkGenerationStatus,
  generateReceivableVsReceiptExcel,
  getMissingStoreMappings,
};
