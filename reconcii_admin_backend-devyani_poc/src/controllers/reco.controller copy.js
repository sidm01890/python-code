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
  try {
    // Get POS order data with specific fields only
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
      raw: true, // Get plain objects instead of model instances
    });

    if (!posOrders || posOrders.length === 0) {
      return;
    }

    // Get formulas for calculations
    const formulas = await formulaForPosSummary();

    // Pre-compile regex for column extraction
    const columnRegex = /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g;

    // Get all unique column names from formulas once
    const uniqueColumns = new Set();
    Object.values(formulas).forEach((formula) => {
      const matches = formula.match(columnRegex) || [];
      matches.forEach((col) => uniqueColumns.add(col));
    });

    // Prepare bulk operations
    const bulkCreateRecords = [];
    const bulkUpdateRecords = [];

    // Get existing records in bulk
    const existingRecords = await db.zomato_vs_pos_summary.findAll({
      where: {
        pos_order_id: posOrders.map((order) => order.instance_id),
      },
      raw: true,
    });

    // Create a map of existing records for faster lookup
    const existingRecordsMap = new Map(
      existingRecords.map((record) => [record.pos_order_id, record])
    );

    for (const order of posOrders) {
      try {
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

    // Perform bulk operations
    if (bulkCreateRecords.length > 0) {
      await db.zomato_vs_pos_summary.bulkCreate(bulkCreateRecords, {
        ignoreDuplicates: true,
      });
    }

    if (bulkUpdateRecords.length > 0) {
      await Promise.all(
        bulkUpdateRecords.map((record) =>
          db.zomato_vs_pos_summary.update(record, { where: { id: record.id } })
        )
      );
    }

    console.log(`Processed ${posOrders.length} orders`);
    console.log(`Created ${bulkCreateRecords.length} new records`);
    console.log(`Updated ${bulkUpdateRecords.length} existing records`);
  } catch (error) {
    console.error("Error in createPosSummaryRecords:", error);
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
  try {
    // Get Zomato order data with specific fields and store_code from zomato_mappings
    const zomatoOrders = await db.zomato.findAll({
      where: {
        action: { [Op.in]: ["sale", "addition"] },
      },
      raw: true,
      nest: true,
    });

    if (!zomatoOrders || zomatoOrders.length === 0) {
      console.log("No Zomato orders found");
      return;
    }

    // Get formulas for calculations
    const formulas = await formulaForZomatoSummary();

    // Pre-compile regex for column extraction
    const columnRegex = /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g;

    // Get all unique column names from formulas once
    const uniqueColumns = new Set();
    Object.values(formulas).forEach((formula) => {
      const matches = formula.match(columnRegex) || [];
      matches.forEach((col) => uniqueColumns.add(col));
    });

    // Prepare bulk operations
    const bulkCreateRecords = [];
    const bulkUpdateRecords = [];

    // Get existing records in bulk where pos_order_id matches Zomato order_id
    const existingRecords = await db.zomato_vs_pos_summary.findAll({
      where: {
        pos_order_id: {
          [Op.in]: zomatoOrders.map((order) => order.order_id),
        },
      },
      raw: true,
    });

    // Create a map of existing records for faster lookup using pos_order_id
    const existingRecordsMap = new Map(
      existingRecords.map((record) => [record.pos_order_id, record])
    );

    for (const order of zomatoOrders) {
      try {
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

    // Perform bulk operations
    if (bulkCreateRecords.length > 0) {
      await db.zomato_vs_pos_summary.bulkCreate(bulkCreateRecords, {
        ignoreDuplicates: true,
      });
    }

    if (bulkUpdateRecords.length > 0) {
      await Promise.all(
        bulkUpdateRecords.map((record) =>
          db.zomato_vs_pos_summary.update(record, { where: { id: record.id } })
        )
      );
    }

    console.log(`Processed ${zomatoOrders.length} Zomato orders`);
    console.log(`Created ${bulkCreateRecords.length} new records`);
    console.log(`Updated ${bulkUpdateRecords.length} existing records`);
  } catch (error) {
    console.error("Error in createZomatoSummaryRecords:", error);
  }
};

const createZomatoSummaryRecordsForRefundOnly = async () => {
  try {
    // Get Zomato order data with specific fields and store_code from zomato_mappings
    const zomatoOrders = await db.zomato.findAll({
      where: {
        action: "refund",
      },
      raw: true,
      nest: true,
    });

    if (!zomatoOrders || zomatoOrders.length === 0) {
      console.log("No Zomato orders found");
      return;
    }

    // Get formulas for calculations
    const formulas = await formulaForZomatoSummary();

    // Pre-compile regex for column extraction
    const columnRegex = /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g;

    // Get all unique column names from formulas once
    const uniqueColumns = new Set();
    Object.values(formulas).forEach((formula) => {
      const matches = formula.match(columnRegex) || [];
      matches.forEach((col) => uniqueColumns.add(col));
    });

    // Prepare bulk operations
    const bulkCreateRecords = [];
    const bulkUpdateRecords = [];

    // Get existing records in bulk where pos_order_id matches Zomato order_id
    const existingRecords = await db.zomato_vs_pos_summary.findAll({
      where: {
        [Op.and]: [
          {
            zomato_order_id: {
              [Op.in]: zomatoOrders.map((order) => order.order_id),
            },
          },
          { order_status_zomato: "refund" },
        ],
      },
      raw: true,
    });

    // Create a map of existing records for faster lookup using pos_order_id
    const existingRecordsMap = new Map(
      existingRecords.map((record) => [record.zomato_order_id, record])
    );

    for (const order of zomatoOrders) {
      try {
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
            id: `ZVS_refund_${order.order_id}`,
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

    // Perform bulk operations
    if (bulkCreateRecords.length > 0) {
      await db.zomato_vs_pos_summary.bulkCreate(bulkCreateRecords, {
        ignoreDuplicates: true,
      });
    }

    if (bulkUpdateRecords.length > 0) {
      await Promise.all(
        bulkUpdateRecords.map((record) =>
          db.zomato_vs_pos_summary.update(record, { where: { id: record.id } })
        )
      );
    }

    console.log(`Processed ${zomatoOrders.length} Zomato orders`);
    console.log(`Created ${bulkCreateRecords.length} new records`);
    console.log(`Updated ${bulkUpdateRecords.length} existing records`);
  } catch (error) {
    console.error("Error in createZomatoSummaryRecords:", error);
  }
};

// Function to calculate delta values between POS and Zomato columns
const calculateDeltaValues = async () => {
  try {
    // Get all records from zomato_vs_pos_summary with raw data for better performance
    const summaryRecords = await db.zomato_vs_pos_summary.findAll({
      raw: true,
    });

    if (!summaryRecords || summaryRecords.length === 0) {
      console.log("No records found for delta calculation");
      return;
    }

    const results = [];
    const errors = [];
    const bulkUpdates = [];

    for (const record of summaryRecords) {
      try {
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

        results.push(record.pos_order_id);
      } catch (error) {
        errors.push({
          record_id: record.pos_order_id,
          error: error.message,
        });
      }
    }

    // Perform bulk update if there are records to update
    if (bulkUpdates.length > 0) {
      await Promise.all(
        bulkUpdates.map((update) =>
          db.zomato_vs_pos_summary.update(update, { where: { id: update.id } })
        )
      );
    }

    console.log(`Processed ${summaryRecords.length} records`);
    console.log(`Successfully updated ${results.length} records`);
    if (errors.length > 0) {
      console.error(`Failed to update ${errors.length} records:`, errors);
    }
  } catch (error) {
    console.error("Error in calculateDeltaValues:", error);
  }
};

// Function to check and update reconciliation status
const checkReconciliationStatus = async () => {
  try {
    await createPosSummaryRecords();
    await createZomatoSummaryRecords();
    await createZomatoSummaryRecordsForRefundOnly();
    await calculateDeltaValues();

    // Get all records from zomato_vs_pos_summary with raw data for better performance
    const summaryRecords = await db.zomato_vs_pos_summary.findAll({
      raw: true,
    });

    if (!summaryRecords || summaryRecords.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No summary records found",
      });
    }

    const results = [];
    const errors = [];
    const bulkUpdates = [];

    const BASE_COLUMN_TO_CHECK = [
      "pos_vs_zomato_net_amount_delta",
      "pos_vs_zomato_pg_charge_delta",
      "pos_vs_zomato_tax_paid_by_customer_delta",
      "pos_vs_zomato_commission_value_delta",
      // "zomato_vs_pos_net_amount_delta",
      // "zomato_vs_pos_pg_charge_delta",
      // "zomato_vs_pos_tax_paid_by_customer_delta",
      // "zomato_vs_pos_commission_value_delta",
    ];

    for (const record of summaryRecords) {
      try {
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
            "pos_vs_zomato_pg_charge_delta",
            "zomato_vs_pos_pg_charge_delta",
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
            } else if (
              thresholdColumns10?.includes(deltaCol) &&
              Math.abs(parseFloat(record[deltaCol])) > 0.1
            ) {
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

        results.push(record.pos_order_id);
      } catch (error) {
        errors.push({
          record_id: record.pos_order_id,
          error: error.message,
        });
      }
    }

    // Perform bulk update if there are records to update
    if (bulkUpdates.length > 0) {
      await Promise.all(
        bulkUpdates.map((update) =>
          db.zomato_vs_pos_summary.update(update, { where: { id: update.id } })
        )
      );
    }

    console.log(`Processed ${summaryRecords.length} records`);
    console.log(`Successfully updated ${results.length} records`);
    if (errors.length > 0) {
      console.error(`Failed to update ${errors.length} records:`, errors);
    }
  } catch (error) {
    console.error("Error in checkReconciliationStatus:", error);
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
      store_code: store_codes?.length,
      start_date,
      end_date,
      status: "pending",
      progress: 0,
      message: "Initializing Excel generation...",
    });

    // Start background processing
    processExcelGeneration(generationRecord.id, {
      start_date,
      end_date,
      store_codes,
      reportsDir,
    });

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
        message: "Processing data...",
      },
      {
        where: { id: generationId },
      }
    );

    const workbook = new ExcelJS.Workbook();
    await generateSummarySheetForZomato(workbook, start_date, end_date);

    // Sheet creation utility with streaming
    const createSheet = async (sheetName, columns, query, textColumns = []) => {
      const sheet = workbook.addWorksheet(sheetName);

      // Set up columns once with minimal styling
      sheet.columns = columns.map((header) => ({
        header,
        key: header,
        width: 20,
      }));

      // Apply header style once
      const headerRow = sheet.getRow(1);
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "000000" },
        };
        cell.font = {
          color: { argb: "FFFFFF" },
          bold: true,
        };
      });

      // Process in smaller batches with retry logic
      let offset = 0;
      const batchSize = 1000;
      let totalProcessed = 0;
      const maxRetries = 3;
      let allRows = []; // Store all rows for bulk insert

      while (true) {
        let retryCount = 0;
        let records = null;

        while (retryCount < maxRetries) {
          try {
            records = await db.zomato_vs_pos_summary.findAll({
              ...query,
              where: {
                ...query.where,
                store_name: { [Op.in]: store_codes },
              },
              limit: batchSize,
              offset,
              raw: true,
              nest: true,
              attributes: columns.filter((col) => col !== "difference"),
              logging: false,
              timeout: 30000,
              dialectOptions: {
                connectTimeout: 30000,
                acquireTimeout: 30000,
              },
            });
            break;
          } catch (error) {
            retryCount++;
            if (retryCount === maxRetries) {
              throw error;
            }
            await new Promise((resolve) =>
              setTimeout(resolve, 1000 * retryCount)
            );
          }
        }

        if (!records || records.length === 0) {
          break;
        }

        // Process batch
        const rows = records.map((record) => {
          const rowData = {};
          columns.forEach((col) => {
            if (col === "difference") {
              const regularCol = columns[columns.length - 3];
              const calcCol = columns[columns.length - 2];
              const regularValue = Number(record[regularCol] ?? 0);
              const calcValue = Number(record[calcCol] ?? 0);
              rowData[col] = regularValue - calcValue;
            } else {
              const value = record[col];
              rowData[col] = textColumns.includes(col)
                ? value ?? ""
                : Number(value ?? 0);
            }
          });

          // Add calculated columns for Zomato vs POS sheet
          if (sheetName === "Zomato 3PO vs POS") {
            const calculatedColumns = columns.filter((col) =>
              col.startsWith("calculated_")
            );
            calculatedColumns.forEach((calcCol) => {
              const originalCol = calcCol.replace("calculated_", "");
              const calcValue = Number(record[calcCol] ?? 0);
              const originalValue = Number(record[originalCol] ?? 0);
              rowData[calcCol] = calcValue;
              rowData[originalCol] = originalValue;
            });
          }

          return rowData;
        });

        // Add to bulk array instead of immediate insert
        allRows = allRows.concat(rows);

        totalProcessed += records.length;
        offset += batchSize;

        // Update progress
        const progress = Math.floor((totalProcessed / 1000) * 100);
        await db.excel_generation.update(
          {
            progress,
            message: `Processed ${totalProcessed} records for ${sheetName}`,
          },
          {
            where: { id: generationId },
          }
        );

        console.log(`Total records processed: ${totalProcessed}`);
        console.log(`Progress: ${progress}%`);

        if (global.gc) {
          global.gc();
        }

        // Process in chunks of 5000 rows to avoid memory issues
        if (allRows.length >= 5000) {
          console.log(`Bulk adding ${allRows.length} rows to sheet...`);
          const addedRows = sheet.addRows(allRows);
          // Apply minimal styling in bulk
          addedRows.forEach((row) => {
            row.eachCell((cell) => {
              cell.border = {
                top: { style: "thin" },
                left: { style: "thin" },
                bottom: { style: "thin" },
                right: { style: "thin" },
              };
            });
          });
          allRows = []; // Clear the array after bulk insert
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Add any remaining rows
      if (allRows.length > 0) {
        console.log(`Adding final ${allRows.length} rows to sheet...`);
        const addedRows = sheet.addRows(allRows);
        addedRows.forEach((row) => {
          row.eachCell((cell) => {
            cell.border = {
              top: { style: "thin" },
              left: { style: "thin" },
              bottom: { style: "thin" },
              right: { style: "thin" },
            };
          });
        });
      }

      console.log(`Total records processed: ${totalProcessed}`);

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
              { pos_order_id: { [Op.ne]: null } },
              {
                order_date:
                  start_date === end_date
                    ? start_date
                    : { [Op.between]: [start_date, end_date] },
              },
              {
                store_name: { [Op.in]: store_codes },
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
              { zomato_order_id: { [Op.ne]: null } },
              {
                order_date:
                  start_date === end_date
                    ? start_date
                    : { [Op.between]: [start_date, end_date] },
              },
              {
                store_name: { [Op.in]: store_codes },
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
              { zomato_order_id: { [Op.ne]: null } },
              {
                order_date:
                  start_date === end_date
                    ? start_date
                    : { [Op.between]: [start_date, end_date] },
              },
              {
                store_name: { [Op.in]: store_codes },
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
      // Orders not found sheets
      createSheet(
        "Order not found in POS",
        ordersNotInPosColumns,
        {
          where: {
            [Op.and]: [
              { pos_order_id: { [Op.ne]: null } },
              {
                order_date:
                  start_date === end_date
                    ? start_date
                    : { [Op.between]: [start_date, end_date] },
              },
              {
                store_name: { [Op.in]: store_codes },
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
              { zomato_order_id: { [Op.ne]: null } },
              {
                order_date:
                  start_date === end_date
                    ? start_date
                    : { [Op.between]: [start_date, end_date] },
              },
              {
                store_name: { [Op.in]: store_codes },
              },
              {
                order_status_zomato: { [Op.in]: ["sale", "addition"] },
              },
            ],
          },
          order: [["order_date", "ASC"]],
        },
        textColumnsInPos
      ),
    ];

    // Process all sheets in parallel
    await Promise.all(sheetPromises);

    // Get calculated columns
    // const tableColumns = await db.zomato_vs_pos_summary.describe();
    // const calculatedColumns = Object.keys(tableColumns).filter((col) =>
    //   col.startsWith("calculated_")
    // );

    // Process mismatched records with streaming
    // for (const calcCol of calculatedColumns) {
    //   const regularCol = calcCol.replace("calculated_", "");
    //   const sheetColumns = [
    //     ...ordersNotInPosColumns.filter((col) => col !== regularCol),
    //     regularCol,
    //     calcCol,
    //     "difference",
    //   ];

    //   await createSheet(
    //     shortenSheetName(`${regularCol?.toUpperCase()}_MISMATCHES`),
    //     sheetColumns,
    //     {
    //       where: {
    //         [Op.and]: [
    //           { [calcCol]: { [Op.ne]: null } },
    //           { [regularCol]: { [Op.ne]: null } },
    //           Sequelize.where(
    //             Sequelize.cast(Sequelize.col(calcCol), "DECIMAL(20,2)"),
    //             {
    //               [Op.ne]: Sequelize.cast(
    //                 Sequelize.col(regularCol),
    //                 "DECIMAL(20,2)"
    //               ),
    //             }
    //           ),
    //           {
    //             order_date:
    //               start_date === end_date
    //                 ? start_date
    //                 : { [Op.between]: [start_date, end_date] },
    //           },
    //           {
    //             store_name: { [Op.in]: store_codes },
    //           },
    //         ],
    //       },
    //       order: [["order_date", "ASC"]],
    //     },
    //     textColumnsInZomato
    //   );
    //   console.log("calcCol", calcCol);
    // }

    // Generate filename with store codes
    const storeCodesStr = store_codes?.length + "_stores";
    const filename = `reconciliation_${storeCodesStr}_${start_date}_${end_date}_${generationId}.xlsx`;
    const filepath = path.join(reportsDir, filename);

    // Save the file
    await workbook.xlsx.writeFile(filepath);

    // Update final status
    await db.excel_generation.update(
      {
        status: "completed",
        progress: 100,
        message: "Excel file generated successfully",
        filename: filename,
      },
      {
        where: { id: generationId },
      }
    );
  } catch (error) {
    console.error("Background processing error:", error);
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
  try {
    const { startDate, endDate, stores } = req.body;

    if (!startDate || !endDate || !stores) {
      return res.status(400).json({
        success: false,
        message: "Missing required parameters: startDate, endDate, or stores",
      });
    }

    const tenders = ["ZOMATO"]; // Static array of tenders

    // Get store mappings
    // const storeMappings = await db.store.findAll({
    //   where: {
    //     store_code: {
    //       [Op.in]: stores,
    //     },
    //   },
    //   attributes: ["store_code", "store_name"],
    //   raw: true,
    // });

    // Create a mapping of store_code to store_name
    // const storeCodeToName = storeMappings.reduce((acc, store) => {
    //   acc[store.store_code] = store.store_name;
    //   return acc;
    // }, {});

    // Get summary data for all stores
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
    });

    // Convert summary data to numbers
    const summaryDataNumbers = summaryData[0]
      ? Object.entries(summaryData[0]).reduce((acc, [key, value]) => {
          acc[key] = Number(value) || 0;
          return acc;
        }, {})
      : {};

    // Get data for each tender
    const tenderData = await Promise.all(
      tenders.map(async (tender) => {
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
        });

        // Convert tender summary data to numbers
        const tenderSummaryNumbers = tenderSummary[0]
          ? Object.entries(tenderSummary[0]).reduce((acc, [key, value]) => {
              acc[key] = Number(value) || 0;
              return acc;
            }, {})
          : {};

        return {
          ...tenderSummaryNumbers,
          posFreebies: 0,
          threePOFreebies: 0,
          booked: 0,
          promo: 0,
          deltaPromo: 0,
          allThreePOCharges: 0,
          allPOSCharges: 0,
          tenderName: tender,
        };
      })
    );

    const tenderWiseDataAsPerPOS = await Promise.all(
      tenders.map(async (tender) => {
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
        });

        // Convert tender summary data to numbers
        const tenderSummaryNumbers = tenderSummary[0]
          ? Object.entries(tenderSummary[0]).reduce((acc, [key, value]) => {
              acc[key] = Number(value) || 0;
              return acc;
            }, {})
          : {};

        return {
          ...tenderSummaryNumbers,
          posFreebies: 0,
          threePOFreebies: 0,
          booked: 0,
          promo: 0,
          deltaPromo: 0,
          allThreePOCharges: 0,
          allPOSCharges: 0,
          tenderName: tender,
        };
      })
    );

    // Get Instore numbers for Sales
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
    });

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

    res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error("Error in getDashboardData:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving dashboard data",
      error: error.message,
    });
  }
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

    // Get store mappings
    // const storeMappings = await db.store.findAll({
    //   where: {
    //     store_code: {
    //       [Op.in]: stores,
    //     },
    //   },
    //   attributes: ["store_code", "store_name"],
    //   raw: true,
    // });

    // Create a mapping of store_code to store_name
    // const storeCodeToName = storeMappings.reduce((acc, store) => {
    //   acc[store.store_code] = store.store_name;
    //   return acc;
    // }, {});

    // Get Instore numbers for Sales
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
        // order_status_pos: "Delivered",
      },
      attributes: [[fn("SUM", col("payment")), "aggregatorSales"]],
      raw: true,
    });

    // Static response with blank values
    const response = {
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
      tenderWiseDataList: [
        {
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
          tenderName: "CARD",
          bankWiseDataList: [
            {
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
              bankName: "AMEX",
              missingTidValue: "0/0",
              unreconciled: 0,
            },
            {
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
              bankName: "YES",
              missingTidValue: "0/0",
              unreconciled: 0,
            },
            {
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
              bankName: "ICICI",
              missingTidValue: "0/0",
              unreconciled: 0,
            },
            {
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
              bankName: "ICICI_LYRA",
              missingTidValue: "0/0",
              unreconciled: 0,
            },
            {
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
              bankName: "HDFC",
              missingTidValue: "0/0",
              unreconciled: 0,
            },
            {
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
              bankName: "SBI87",
              missingTidValue: "0/0",
              unreconciled: 0,
            },
          ],
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
        },
        {
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
          tenderName: "UPI",
          bankWiseDataList: [
            {
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
              bankName: "PHONEPE",
              missingTidValue: "0/0",
              unreconciled: 0,
            },
            {
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
              bankName: "YES_BANK_QR",
              missingTidValue: "0/0",
              unreconciled: 0,
            },
          ],
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
        },
      ],
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
      aggregatorTotal: aggregatorsData[0]?.aggregatorSales || 0,
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

module.exports = {
  createZomatoSummaryRecords,
  calculateDeltaValues,
  checkReconciliationStatus,
  generateReconciliationExcel,
  getThreePODashboardData,
  getInstoreDashboardData,
  checkGenerationStatus,
};
