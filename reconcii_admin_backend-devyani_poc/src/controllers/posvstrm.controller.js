const db = require("../models");
const { Op, fn, col, literal } = require("sequelize");
const ExcelJS = require("exceljs");
const dayjs = require("dayjs");
const customParseFormat = require("dayjs/plugin/customParseFormat");

// Add custom parse format plugin to dayjs
dayjs.extend(customParseFormat);

const TRM_PROVIDERS = ["RZP"];
const TRM_PROVIDER_TABLE = {
  RZP: "trm_mpr",
};
const TRM_SUMMARY_TABLE_MAPPING = {
  RZP: {
    trm_uid: "uid",
    store_name: "store_name",
    acquirer: "acquirer",
    payment_mode: "payment_mode",
    card_issuer: "card_issuer",
    card_type: "card_issuer",
    card_network: "card_issuer",
    card_colour: "card_colour",
    transaction_id: "transaction_id",
    transaction_type_detail: "transaction_type_detail",
    amount: "amount",
    currency: "currency",
    transaction_date: "transaction_date",
    rrn: "rrn",
    cloud_ref_id: "cloud_ref_id",
  },
};

const POS_MODES = ["PineLabsPlutusUPI", "PineLabsPlutus"];

const POS_AND_SUMMARY_TABLE_MAPPING = {
  pos_transaction_id: "transaction_number",
  pos_date: "date",
  pos_store: "store_name",
  pos_mode_name: "mode_name",
  pos_amount: "gross_amount",
};

const TRM_AND_SUMMARY_TABLE_MAPPING = {
  trm_transaction_id: "cloud_ref_id",
  trm_date: "transaction_date",
  trm_store: "store_name",
  acquirer: "acquirer",
  payment_mode: "payment_mode",
  card_issuer: "card_issuer",
  card_type: "card_type",
  card_network: "card_network",
  card_colour: "card_colour",
  trm_amount: "amount",
};

// Helper function to process records in batches
const processBatch = async (records, batchSize = 1000) => {
  const batches = [];
  for (let i = 0; i < records.length; i += batchSize) {
    batches.push(records.slice(i, i + batchSize));
  }
  return batches;
};

const generateCommonTRMTable = async (req, res) => {
  try {
    const summaryData = [];
    let totalProcessed = 0;

    // Loop through each TRM provider
    for (const provider of TRM_PROVIDERS) {
      // Get the table name for the provider
      const tableName = TRM_PROVIDER_TABLE[provider];
      if (!tableName) {
        console.warn(`No table mapping found for provider: ${provider}`);
        continue;
      }

      // Get the column mapping for the provider
      const columnMapping = TRM_SUMMARY_TABLE_MAPPING[provider];
      if (!columnMapping) {
        console.warn(`No column mapping found for provider: ${provider}`);
        continue;
      }

      // Read records from the provider's table
      const records = await db[tableName].findAll({
        raw: true,
      });

      // Process each record and map columns according to the mapping
      for (const record of records) {
        const mappedRecord = {
          trm_name: provider, // Add the provider name as trm_name
        };

        // Map each column according to the mapping
        for (const [summaryColumn, sourceColumn] of Object.entries(
          columnMapping
        )) {
          mappedRecord[summaryColumn] = record[sourceColumn];
        }

        summaryData.push(mappedRecord);
      }
    }

    // Save all records to summarised_trm_data table in batches
    if (summaryData.length > 0) {
      const batches = await processBatch(summaryData);

      for (const batch of batches) {
        await db.summarised_trm_data.bulkCreate(batch, {
          updateOnDuplicate: [
            "trm_uid",
            "store_name",
            "acquirer",
            "payment_mode",
            "card_issuer",
            "card_type",
            "card_network",
            "card_colour",
            "transaction_id",
            "transaction_type_detail",
            "amount",
            "currency",
            "transaction_date",
            "rrn",
            "cloud_ref_id",
          ],
        });
        totalProcessed += batch.length;
      }
    }

    res.status(200).json({
      success: true,
      message: "TRM data processed successfully",
      data: totalProcessed,
    });
  } catch (error) {
    console.error("Error processing TRM data:", error);
    res.status(500).json({
      success: false,
      message: "Error processing TRM data",
      error: error.message,
    });
  }
};

const processOrdersData = async (req, res) => {
  try {
    const summaryData = [];
    let totalProcessed = 0;

    // Get all orders where mode_name is in POS_MODES
    const orders = await db.orders.findAll({
      where: {
        mode_name: {
          [Op.in]: POS_MODES,
        },
        transaction_number: {
          [Op.ne]: "-",
        },
      },
      raw: true,
    });

    // Process each order and map columns according to POS_AND_SUMMARY_TABLE_MAPPING
    for (const order of orders) {
      const mappedRecord = {};

      // Map each column according to the mapping
      for (const [summaryColumn, sourceColumn] of Object.entries(
        POS_AND_SUMMARY_TABLE_MAPPING
      )) {
        mappedRecord[summaryColumn] = order[sourceColumn];
      }

      summaryData.push(mappedRecord);
    }

    // Save all records to pos_vs_trm_summary table in batches
    if (summaryData.length > 0) {
      const batches = await processBatch(summaryData);

      for (const batch of batches) {
        await db.pos_vs_trm_summary.bulkCreate(batch, {
          updateOnDuplicate: [
            "pos_transaction_id",
            "pos_date",
            "pos_store",
            "pos_mode_name",
            "pos_amount",
          ],
        });
        totalProcessed += batch.length;
      }
    }

    res.status(200).json({
      success: true,
      message: "Orders data processed successfully",
      data: totalProcessed,
    });
  } catch (error) {
    console.error("Error processing orders data:", error);
    res.status(500).json({
      success: false,
      message: "Error processing orders data",
      error: error.message,
    });
  }
};

const processTrmData = async (req, res) => {
  try {
    const summaryData = [];
    let totalProcessed = 0;
    let totalUpdated = 0;
    let totalCreated = 0;

    // Get all TRM records where cloud_ref_id is not 0
    const trmRecords = await db.summarised_trm_data.findAll({
      where: {
        cloud_ref_id: {
          [Op.ne]: "0",
        },
      },
      raw: true,
    });

    // Process each TRM record
    for (const trmRecord of trmRecords) {
      const mappedRecord = {};

      // Map each column according to the mapping
      for (const [summaryColumn, sourceColumn] of Object.entries(
        TRM_AND_SUMMARY_TABLE_MAPPING
      )) {
        if (summaryColumn === "trm_date") {
          // Convert date format from DD/MM/YYYY HH:mm:ss AM/PM to MySQL datetime
          const dateStr = trmRecord[sourceColumn];
          if (dateStr) {
            try {
              const parsedDate = dayjs(dateStr, "DD/MM/YYYY hh:mm:ss A");
              if (parsedDate.isValid()) {
                mappedRecord[summaryColumn] = parsedDate.format(
                  "YYYY-MM-DD HH:mm:ss"
                );
              } else {
                console.warn(
                  `Invalid date format for record: ${trmRecord.cloud_ref_id}, date: ${dateStr}`
                );
                mappedRecord[summaryColumn] = null;
              }
            } catch (error) {
              console.warn(
                `Error parsing date for record: ${trmRecord.cloud_ref_id}, date: ${dateStr}`,
                error
              );
              mappedRecord[summaryColumn] = null;
            }
          } else {
            mappedRecord[summaryColumn] = null;
          }
        } else {
          mappedRecord[summaryColumn] = trmRecord[sourceColumn];
        }
      }

      // Check if record exists in pos_vs_trm_summary
      const existingRecord = await db.pos_vs_trm_summary.findOne({
        where: {
          pos_transaction_id: trmRecord.cloud_ref_id,
        },
      });

      if (existingRecord) {
        // Update existing record
        await existingRecord.update(mappedRecord);
        totalUpdated++;
      } else {
        // Add to batch for new record creation
        summaryData.push(mappedRecord);
      }
    }

    // Save new records to pos_vs_trm_summary table in batches
    if (summaryData.length > 0) {
      const batches = await processBatch(summaryData);

      for (const batch of batches) {
        await db.pos_vs_trm_summary.bulkCreate(batch);
        totalCreated += batch.length;
      }
    }

    totalProcessed = totalUpdated + totalCreated;

    res.status(200).json({
      success: true,
      message: "TRM data processed successfully",
      data: {
        totalProcessed,
        totalUpdated,
        totalCreated,
      },
    });
  } catch (error) {
    console.error("Error processing TRM data:", error);
    res.status(500).json({
      success: false,
      message: "Error processing TRM data",
      error: error.message,
    });
  }
};

const calculatePosVsTrm = async (req, res) => {
  try {
    let totalProcessed = 0;
    let totalReconciled = 0;
    let totalUnreconciled = 0;

    // Get all records from pos_vs_trm_summary
    const records = await db.pos_vs_trm_summary.findAll({
      raw: true,
    });

    // Process each record
    for (const record of records) {
      const updateData = {};

      // Check 1: If pos_transaction_id is NULL
      if (!record.pos_transaction_id) {
        updateData.unreconciled_amount = record.trm_amount;
        updateData.reconciliation_status = "UNRECONCILED";
        updateData.pos_reason = "ORDER NOT FOUND IN POS";
        updateData.trm_reason = "ORDER NOT FOUND IN POS";
        totalUnreconciled++;
      }
      // Check 2: If trm_transaction_id is NULL
      else if (!record.trm_transaction_id) {
        updateData.unreconciled_amount = record.pos_amount;
        updateData.reconciliation_status = "UNRECONCILED";
        updateData.pos_reason = "ORDER NOT FOUND IN TRM";
        updateData.trm_reason = "ORDER NOT FOUND IN TRM";
        totalUnreconciled++;
      }
      // Check 3: If amounts don't match
      else if (record.pos_amount !== record.trm_amount) {
        updateData.unreconciled_amount = record.pos_amount;
        updateData.reconciliation_status = "UNRECONCILED";
        updateData.pos_reason = "ORDER AMOUNT NOT MATCHED";
        updateData.trm_reason = "ORDER AMOUNT NOT MATCHED";
        totalUnreconciled++;
      }
      // Check 4: All conditions passed - reconciled
      else {
        updateData.reconciled_amount = record.pos_amount;
        updateData.reconciliation_status = "RECONCILED";
        updateData.pos_reason = "";
        updateData.trm_reason = "";
        totalReconciled++;
      }

      // Update the record
      await db.pos_vs_trm_summary.update(updateData, {
        where: {
          id: record.id,
        },
      });

      totalProcessed++;
    }

    res.status(200).json({
      success: true,
      message: "Reconciliation calculation completed successfully",
      data: {
        totalProcessed,
        totalReconciled,
        totalUnreconciled,
      },
    });
  } catch (error) {
    console.error("Error calculating POS vs TRM reconciliation:", error);
    res.status(500).json({
      success: false,
      message: "Error calculating POS vs TRM reconciliation",
      error: error.message,
    });
  }
};

module.exports = {
  generateCommonTRMTable,
  processOrdersData,
  processTrmData,
  calculatePosVsTrm,
};
