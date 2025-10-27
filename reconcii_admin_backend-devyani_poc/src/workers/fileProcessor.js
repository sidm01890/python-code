const { parentPort, workerData } = require("worker_threads");
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const csv = require("csv-parser");
const db = require("../models");

const dayjs = require("dayjs");
const customParseFormat = require("dayjs/plugin/customParseFormat");
require("dayjs/locale/en"); // Load English locale

dayjs.extend(customParseFormat);
dayjs.locale("en"); // Set locale globally (important!)

const ExcelJS = require("exceljs");

const { uploadId, filePath, type } = workerData;

// Send status update to parent
const sendStatus = (status, message, processedData = null) => {
  parentPort.postMessage({
    status,
    message,
    processedData,
  });
};

// Streaming batch insert for MPR HDFC Card (5K rows at a time)
const processMprHdfcCardDataStreamingBatch = async (filePath, sheetName) => {
  try {
    // Fetch database-excel column mapping for tender_id = 6
    const columnMappings = await db.table_columns_mapping.findAll({
      where: { tender_id: 6 },
      raw: true,
    });
    const excelToDbMapping = {};
    columnMappings.forEach((mapping) => {
      if (mapping.excel_column_name && mapping.db_column_name) {
        excelToDbMapping[mapping.excel_column_name] = mapping.db_column_name;
      }
    });
    const summary = {
      totalRecords: 0,
      totalAmount: 0,
      processedRecords: 0,
      updatedRecords: 0,
      newRecords: 0,
      errors: 0,
      dateRange: { start: null, end: null },
    };
    const BATCH_SIZE = 5000;
    const workbook = new ExcelJS.stream.xlsx.WorkbookReader(filePath);
    for await (const worksheetReader of workbook) {
      if (worksheetReader.name !== sheetName) continue;
      let headers = [];
      let isFirstRow = true;
      let batch = [];
      let rowCount = 0;
      for await (const row of worksheetReader) {
        if (isFirstRow) {
          headers = row.values.slice(1);
          isFirstRow = false;
        } else {
          try {
            const rowObj = {};
            headers.forEach((header, idx) => {
              rowObj[header] = row.values[idx + 1];
            });
            // Map excel column names to database column names
            const mappedRow = {};
            Object.keys(rowObj).forEach((excelColumn) => {
              const dbColumn = excelToDbMapping[excelColumn];
              if (dbColumn) {
                mappedRow[dbColumn] = rowObj[excelColumn];
              } else {
                mappedRow[excelColumn] = rowObj[excelColumn];
              }
            });
            // Clean up mappedRow values
            const excelDateFields = ["chg_date", "process_date", "bh_time"];
            Object.keys(mappedRow).forEach((key) => {
              let value = mappedRow[key];
              if (typeof value === "string" && value.startsWith("'")) {
                value = value.slice(1);
              }
              if (
                excelDateFields.includes(key) &&
                ((typeof value === "number" && !isNaN(value)) ||
                  (typeof value === "string" &&
                    !isNaN(value) &&
                    value.trim() !== ""))
              ) {
                const serial =
                  typeof value === "string" ? Number(value) : value;
                const date = new Date(
                  Math.round((serial - 25569) * 86400 * 1000)
                );
                if (isNaN(date.getTime())) {
                  if (key === "bh_time") {
                    console.warn("Invalid date for bh_time:", value);
                  }
                  mappedRow[key] = null;
                } else {
                  mappedRow[key] = date;
                }
              } else if (key === "bh_time" && value) {
                // Try to extract 'HH:MM:SS' from 'HH:MM:SS:??'
                const match = value.match(/^(\d{1,2}:\d{2}:\d{2})/);
                if (match) {
                  mappedRow[key] = match[1];
                } else {
                  console.warn("Unparseable bh_time:", value);
                  mappedRow[key] = null;
                }
              } else {
                mappedRow[key] = value;
              }
            });
            // Special cleaning for pymt_percent
            if ("pymt_percent" in mappedRow) {
              let val = mappedRow.pymt_percent;
              if (typeof val === "string" && val.startsWith("=")) {
                console.warn(
                  "Formula detected in pymt_percent, setting to null:",
                  val
                );
                val = null;
              }
              if (val === "" || val === null || typeof val === "undefined") {
                mappedRow.pymt_percent = null;
              } else {
                const num = parseFloat(val);
                mappedRow.pymt_percent =
                  typeof num === "number" && !isNaN(num) ? num : null;
              }
            }
            // Special cleaning and logging for all double-type fields
            const doubleFields = [
              "pymt_chgamnt",
              "pymt_comm",
              "pymt_servtax",
              "pymt_sbcess",
              "pymt_kkcess",
              "pymt_cgst",
              "pymt_sgst",
              "pymt_igst",
              "pymt_utgst",
              "pymt_netamnt",
              "auth_amount",
              "auth_comm",
              "auth_servtax",
              "auth_sbcess",
              "auth_kkcess",
              "auth_cgst",
              "auth_sgst",
              "auth_igst",
              "auth_utgst",
              "auth_netamnt",
              "bh_cashamnt",
              "inr_chgamnt",
              "inr_comm",
              "inr_servtax",
              "inr_sbcess",
              "inr_kkcess",
              "inr_cgst",
              "inr_sgst",
              "inr_igst",
              "inr_utgst",
              "inr_netamnt",
            ];
            doubleFields.forEach((field) => {
              if (field in mappedRow) {
                let val = mappedRow[field];
                if (typeof val === "string") {
                  val = val.replace(/,/g, "").trim();
                }
                const parsed = parseFloat(val);
                if (val === "" || isNaN(parsed)) {
                  console.warn(
                    `[Row ${rowCount}] Invalid ${field}:`,
                    val,
                    "Full row:",
                    mappedRow
                  );
                  mappedRow[field] = 0;
                } else {
                  mappedRow[field] = parsed;
                }
              }
            });
            // Unique ID
            const uniqueIdHeaders = ["mecode", "cardnbr", "chg_date"];
            const uniqueIdParts = uniqueIdHeaders
              .map((header) => mappedRow[header])
              .filter(Boolean);
            const uniqueId =
              uniqueIdParts.length > 0
                ? `MPRHDFC_${uniqueIdParts.join("_")}`
                : `MPRHDFC_${Date.now()}_${Math.random()
                    .toString(36)
                    .substr(2, 9)}`;
            mappedRow.uid = uniqueId;
            batch.push(mappedRow);
            // Track amount
            const amount = parseFloat(mappedRow.pymt_chgamnt || 0) || 0;
            summary.totalAmount += amount;
            // Track date range
            const recordDate = mappedRow.chg_date || mappedRow.process_date;
            if (recordDate) {
              const date = dayjs(recordDate);
              if (date.isValid()) {
                if (
                  !summary.dateRange.start ||
                  date.isBefore(summary.dateRange.start)
                ) {
                  summary.dateRange.start = date;
                }
                if (
                  !summary.dateRange.end ||
                  date.isAfter(summary.dateRange.end)
                ) {
                  summary.dateRange.end = date;
                }
              }
            }
            summary.processedRecords++;
            summary.newRecords++;
            rowCount++;
            if (batch.length >= BATCH_SIZE) {
              await db.mpr_hdfc_card.bulkCreate(batch, {
                updateOnDuplicate: Object.keys(db.mpr_hdfc_card.rawAttributes),
              });
              console.log(
                `Inserted batch of ${batch.length} rows, total processed: ${rowCount}`
              );
              batch = [];
            }
          } catch (rowError) {
            console.error(`Error processing row:`, rowError);
            summary.errors++;
          }
        }
      }
      if (batch.length > 0) {
        await db.mpr_hdfc_card.bulkCreate(batch, {
          updateOnDuplicate: Object.keys(db.mpr_hdfc_card.rawAttributes),
        });
        console.log(
          `Inserted final batch of ${batch.length} rows, total processed: ${rowCount}`
        );
      }
      summary.totalRecords += rowCount;
    }
    summary.dateRange.start = summary.dateRange.start?.toISOString() || null;
    summary.dateRange.end = summary.dateRange.end?.toISOString() || null;
    summary.sheet = sheetName;
    console.log("MPR HDFC Card Streaming Batch Insert Summary:", summary);
    return summary;
  } catch (error) {
    console.error("Error in processMprHdfcCardDataStreamingBatch:", error);
    throw error;
  }
};

// Streaming batch insert for MPR HDFC UPI (5K rows at a time)
const processMprHdfcUpiDataStreamingBatch = async (filePath, sheetName) => {
  try {
    // Fetch database-excel column mapping for tender_id = 7
    const columnMappings = await db.table_columns_mapping.findAll({
      where: { tender_id: 7 },
      raw: true,
    });
    const excelToDbMapping = {};
    columnMappings.forEach((mapping) => {
      if (mapping.excel_column_name && mapping.db_column_name) {
        excelToDbMapping[mapping.excel_column_name] = mapping.db_column_name;
      }
    });
    const summary = {
      totalRecords: 0,
      totalAmount: 0,
      processedRecords: 0,
      updatedRecords: 0,
      newRecords: 0,
      errors: 0,
      dateRange: { start: null, end: null },
    };
    const BATCH_SIZE = 5000;
    const workbook = new ExcelJS.stream.xlsx.WorkbookReader(filePath);
    for await (const worksheetReader of workbook) {
      if (worksheetReader.name !== sheetName) continue;
      let headers = [];
      let isFirstRow = true;
      let batch = [];
      let rowCount = 0;
      for await (const row of worksheetReader) {
        if (isFirstRow) {
          headers = row.values.slice(1);
          isFirstRow = false;
        } else {
          try {
            const rowObj = {};
            headers.forEach((header, idx) => {
              rowObj[header] = row.values[idx + 1];
            });
            // Map excel column names to database column names
            const mappedRow = {};
            Object.keys(rowObj).forEach((excelColumn) => {
              const dbColumn = excelToDbMapping[excelColumn];
              if (dbColumn) {
                mappedRow[dbColumn] = rowObj[excelColumn];
              } else {
                mappedRow[excelColumn] = rowObj[excelColumn];
              }
            });
            // Clean up mappedRow values
            const excelDateFields = ["transaction_req_date", "settlement_date"];
            Object.keys(mappedRow).forEach((key) => {
              let value = mappedRow[key];
              if (typeof value === "string" && value.startsWith("'")) {
                value = value.slice(1);
              }
              if (
                excelDateFields.includes(key) &&
                ((typeof value === "number" && !isNaN(value)) ||
                  (typeof value === "string" &&
                    !isNaN(value) &&
                    value.trim() !== ""))
              ) {
                const serial =
                  typeof value === "string" ? parseFloat(value) : value;
                if (!isNaN(serial) && serial > 20000 && serial < 90000) {
                  const jsDate = new Date(
                    Math.round((serial - 25569) * 86400 * 1000)
                  );
                  value = jsDate
                    .toISOString()
                    .replace("T", " ")
                    .substring(0, 19);
                }
              }
              mappedRow[key] = value;
            });
            // Unique ID for MPR HDFC UPI: external_mid, upi_trxn_id, transaction_req_date
            const uniqueIdHeaders = ["upi_trxn_id"];
            const uniqueIdParts = uniqueIdHeaders
              .map((header) => mappedRow[header])
              .filter(Boolean);
            const uniqueId =
              uniqueIdParts.length > 0
                ? `MPRHDFCUPI_${uniqueIdParts.join("_")}`
                : `MPRHDFCUPI_${Date.now()}_${Math.random()
                    .toString(36)
                    .substr(2, 9)}`;
            mappedRow.uid = uniqueId;
            batch.push(mappedRow);
            // Track amount
            const amount = parseFloat(mappedRow.transaction_amount || 0) || 0;
            summary.totalAmount += amount;
            // Track date range
            const recordDate =
              mappedRow.transaction_req_date || mappedRow.settlement_date;
            if (recordDate) {
              const date = dayjs(recordDate);
              if (date.isValid()) {
                if (
                  !summary.dateRange.start ||
                  date.isBefore(summary.dateRange.start)
                ) {
                  summary.dateRange.start = date;
                }
                if (
                  !summary.dateRange.end ||
                  date.isAfter(summary.dateRange.end)
                ) {
                  summary.dateRange.end = date;
                }
              }
            }
            summary.processedRecords++;
            summary.newRecords++;
            rowCount++;
            if (batch.length >= BATCH_SIZE) {
              await db.mpr_hdfc_upi.bulkCreate(batch, {
                updateOnDuplicate: Object.keys(db.mpr_hdfc_upi.rawAttributes),
              });
              console.log(
                `Inserted batch of ${batch.length} rows, total processed: ${rowCount}`
              );
              batch = [];
            }
          } catch (rowError) {
            console.error(`Error processing row:`, rowError);
            summary.errors++;
          }
        }
      }
      if (batch.length > 0) {
        await db.mpr_hdfc_upi.bulkCreate(batch, {
          updateOnDuplicate: Object.keys(db.mpr_hdfc_upi.rawAttributes),
        });
        console.log(
          `Inserted final batch of ${batch.length} rows, total processed: ${rowCount}`
        );
      }
      summary.totalRecords += rowCount;
    }
    summary.dateRange.start = summary.dateRange.start?.toISOString() || null;
    summary.dateRange.end = summary.dateRange.end?.toISOString() || null;
    summary.sheet = sheetName;
    console.log("MPR HDFC UPI Streaming Batch Insert Summary:", summary);
    return summary;
  } catch (error) {
    console.error("Error in processMprHdfcUpiDataStreamingBatch:", error);
    throw error;
  }
};

// Streaming batch insert for TRM (5K rows at a time)
const processTrmDataStreamingBatch = async (filePath, sheetName) => {
  try {
    // Fetch database-excel column mapping for tender_id = 5
    const columnMappings = await db.table_columns_mapping.findAll({
      where: { tender_id: 5 },
      raw: true,
    });
    const excelToDbMapping = {};
    columnMappings.forEach((mapping) => {
      if (mapping.excel_column_name && mapping.db_column_name) {
        excelToDbMapping[mapping.excel_column_name] = mapping.db_column_name;
      }
    });
    const summary = {
      totalRecords: 0,
      totalAmount: 0,
      processedRecords: 0,
      updatedRecords: 0,
      newRecords: 0,
      errors: 0,
      stores: new Set(),
      dateRange: { start: null, end: null },
    };
    const BATCH_SIZE = 5000;
    const updateOnDuplicateColumns = Object.keys(db.trm.rawAttributes);
    // Unique ID config for TRM
    const uniqueIdHeaders = ["transaction_id"];
    const workbook = new ExcelJS.stream.xlsx.WorkbookReader(filePath);
    for await (const worksheetReader of workbook) {
      if (worksheetReader.name !== sheetName) continue;
      let headers = [];
      let isFirstRow = true;
      let batch = [];
      let rowCount = 0;
      for await (const row of worksheetReader) {
        if (isFirstRow) {
          headers = row.values.slice(1);
          isFirstRow = false;
        } else {
          try {
            const rowObj = {};
            headers.forEach((header, idx) => {
              rowObj[header] = row.values[idx + 1];
            });
            // Map excel column names to database column names
            const mappedRow = {};
            Object.keys(rowObj).forEach((excelColumn) => {
              const dbColumn = excelToDbMapping[excelColumn];
              if (dbColumn) {
                mappedRow[dbColumn] = rowObj[excelColumn];
              } else {
                mappedRow[excelColumn] = rowObj[excelColumn];
              }
            });
            // Clean up mappedRow values
            const excelDateFields = [
              "date",
              "order_date",
              "transaction_date",
              "settlement_date",
            ];
            Object.keys(mappedRow).forEach((key) => {
              let value = mappedRow[key];
              // Handle Excel error cells
              if (value && typeof value === "object" && value.error) {
                value = null;
              }
              // Remove leading apostrophe if present
              if (typeof value === "string" && value.startsWith("'")) {
                value = value.slice(1);
              }
              // Convert Excel serial date to string if field is a date and value is a number or numeric string
              if (
                excelDateFields.includes(key) &&
                ((typeof value === "number" && !isNaN(value)) ||
                  (typeof value === "string" &&
                    !isNaN(value) &&
                    value.trim() !== ""))
              ) {
                const serial =
                  typeof value === "string" ? parseFloat(value) : value;
                if (!isNaN(serial) && serial > 20000 && serial < 90000) {
                  const jsDate = new Date(
                    Math.round((serial - 25569) * 86400 * 1000)
                  );
                  value = jsDate
                    .toISOString()
                    .replace("T", " ")
                    .substring(0, 19);
                }
              }
              mappedRow[key] = value;
            });
            // Use uniqueIdHeaders for unique ID generation
            const uniqueIdParts = uniqueIdHeaders
              .map((header) => mappedRow[header])
              .filter(Boolean); // Remove null/undefined/empty values
            const uniqueId =
              uniqueIdParts.length > 0
                ? `TRM_${uniqueIdParts.join("_")}`
                : `TRM_${Date.now()}_${Math.random()
                    .toString(36)
                    .substr(2, 9)}`;
            mappedRow.uid = uniqueId;
            batch.push(mappedRow);
            // Track amount
            const amount =
              parseFloat(mappedRow.amount || mappedRow.total_amount || 0) || 0;
            summary.totalAmount += amount;
            // Track stores
            if (mappedRow.store_code || mappedRow.store_name) {
              summary.stores.add(mappedRow.store_code || mappedRow.store_name);
            }
            // Track date range
            const recordDate =
              mappedRow.order_date ||
              mappedRow.transaction_date ||
              mappedRow.created_at;
            if (recordDate) {
              const date = dayjs(recordDate);
              if (date.isValid()) {
                if (
                  !summary.dateRange.start ||
                  date.isBefore(summary.dateRange.start)
                ) {
                  summary.dateRange.start = date;
                }
                if (
                  !summary.dateRange.end ||
                  date.isAfter(summary.dateRange.end)
                ) {
                  summary.dateRange.end = date;
                }
              }
            }
            summary.processedRecords++;
            summary.newRecords++;
            rowCount++;
            if (batch.length >= BATCH_SIZE) {
              await db.trm.bulkCreate(batch, {
                updateOnDuplicate: updateOnDuplicateColumns,
              });
              console.log(
                `Inserted batch of ${batch.length} rows, total processed: ${rowCount}`
              );
              batch = [];
            }
          } catch (rowError) {
            console.error(`Error processing row:`, rowError);
            summary.errors++;
          }
        }
      }
      if (batch.length > 0) {
        await db.trm.bulkCreate(batch, {
          updateOnDuplicate: updateOnDuplicateColumns,
        });
        console.log(
          `Inserted final batch of ${batch.length} rows, total processed: ${rowCount}`
        );
      }
      summary.totalRecords += rowCount;
    }
    summary.stores = Array.from(summary.stores);
    summary.dateRange.start = summary.dateRange.start?.toISOString() || null;
    summary.dateRange.end = summary.dateRange.end?.toISOString() || null;
    summary.sheet = sheetName;
    console.log("TRM Streaming Batch Insert Summary:", summary);
    return summary;
  } catch (error) {
    console.error("Error in processTrmDataStreamingBatch:", error);
    throw error;
  }
};

// Streaming batch insert for Pizzahut Orders (CSV, memory efficient, pause/resume)
const processPizzahutOrdersDataStreamingBatch = async (
  filePath,
  uniqueIdHeaders = []
) => {
  try {
    // Fetch column mapping for tender_id = 8
    const columnMappings = await db.table_columns_mapping.findAll({
      where: { tender_id: 8 },
      raw: true,
    });
    const excelToDbMapping = {};
    columnMappings.forEach((mapping) => {
      if (mapping.excel_column_name && mapping.db_column_name) {
        excelToDbMapping[mapping.excel_column_name] = mapping.db_column_name;
      }
    });

    const summary = {
      totalRecords: 0,
      totalAmount: 0,
      processedRecords: 0,
      updatedRecords: 0,
      newRecords: 0,
      errors: 0,
      dateRange: { start: null, end: null },
    };
    const BATCH_SIZE = 1000;
    const updateOnDuplicateColumns = Object.keys(
      db.pizzahut_orders.rawAttributes
    );
    const headers = [];
    let batch = [];
    let rowCount = 0;
    let streamError = null;
    await new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath).pipe(csv());
      stream.on("headers", (headerList) => {
        headers.push(...headerList);
      });
      stream.on("data", (row) => {
        try {
          // Map CSV columns to DB columns if mapping exists
          const mappedRow = {};
          Object.keys(row).forEach((csvColumn) => {
            const dbColumn = excelToDbMapping[csvColumn] || csvColumn;
            let value = row[csvColumn];
            // Handle Excel/CSV error cells
            if (value && typeof value === "object" && value.error) {
              value = null;
            }
            // Remove leading apostrophe if present
            if (typeof value === "string" && value.startsWith("'")) {
              value = value.slice(1);
            }
            // Convert empty string to null
            if (value === "") {
              value = null;
            }
            // Handle date columns (any column with 'date' in its name)
            if (
              (dbColumn.toLowerCase().includes("date") ||
                dbColumn.toLowerCase().includes("food_ready") ||
                dbColumn.toLowerCase().includes("load_time")) &&
              typeof value === "string"
            ) {
              value = value.replace(/^\s*[A-Za-z]+,?\s+/i, "");
              let parsed = dayjs(
                value,
                [
                  "YYYY-MM-DD",
                  "YYYY-MM-DD HH:mm:ss.SSS",
                  "D MMMM YYYY",
                  "DD MMMM YYYY",
                  "dddd, D MMMM YYYY",
                  "dddd, DD MMMM YYYY",
                  "dddd, D MMMM, YYYY",
                  "dddd, DD MMMM, YYYY",
                ],
                "en",
                true // Keep strict parsing to ensure exact matches
              );
              if (!parsed.isValid()) {
                value = null;
              } else {
                value = parsed.format("YYYY-MM-DD");
              }
            }
            // Extra safety: if value is 'Invalid date', set to null
            if (value === "Invalid date") {
              value = null;
            }
            mappedRow[dbColumn] = value;
          });
          // UID: use uniqueIdHeaders if present, else fallback
          const uniqueIdParts = uniqueIdHeaders
            .map((header) => mappedRow[header])
            .filter(Boolean);
          if (uniqueIdParts.length > 0) {
            mappedRow.uid = `PIZZAHUT_${uniqueIdParts.join("_")}`;
          } else if (!mappedRow.uid) {
            mappedRow.uid = `PIZZAHUT_${Date.now()}_${Math.random()
              .toString(36)
              .substr(2, 9)}`;
          }
          batch.push(mappedRow);
          rowCount++;
          summary.processedRecords++;
          summary.newRecords++;
          // Track amount if present
          if (mappedRow.net_amount) {
            const amount = parseFloat(mappedRow.net_amount) || 0;
            summary.totalAmount += amount;
          }
          // Track date range if present
          if (mappedRow.date) {
            const date = dayjs(mappedRow.date);
            if (date.isValid()) {
              if (
                !summary.dateRange.start ||
                date.isBefore(summary.dateRange.start)
              ) {
                summary.dateRange.start = date;
              }
              if (
                !summary.dateRange.end ||
                date.isAfter(summary.dateRange.end)
              ) {
                summary.dateRange.end = date;
              }
            }
          }
          if (batch.length >= BATCH_SIZE) {
            stream.pause();
            db.pizzahut_orders
              .bulkCreate(batch, {
                updateOnDuplicate: updateOnDuplicateColumns,
              })
              .then(() => {
                console.log(
                  `Inserted batch of ${batch.length} rows, total processed: ${rowCount}`
                );
                batch = [];
                stream.resume();
              })
              .catch((err) => {
                streamError = err;
                stream.destroy(err);
              });
          }
        } catch (rowError) {
          console.error(`Error processing row:`, rowError);
          summary.errors++;
        }
      });
      stream.on("end", () => {
        if (batch.length > 0) {
          db.pizzahut_orders
            .bulkCreate(batch, {
              updateOnDuplicate: updateOnDuplicateColumns,
            })
            .then(() => {
              console.log(
                `Inserted final batch of ${batch.length} rows, total processed: ${rowCount}`
              );
              summary.totalRecords = rowCount;
              summary.dateRange.start =
                summary.dateRange.start?.toISOString() || null;
              summary.dateRange.end =
                summary.dateRange.end?.toISOString() || null;
              console.log(
                "Pizzahut Orders Streaming Batch Insert Summary:",
                summary
              );
              sendStatus(
                "completed",
                "Pizzahut Orders processing completed.",
                summary
              );
              resolve();
            })
            .catch((err) => {
              streamError = err;
              sendStatus("failed", `Processing failed: ${err.message}`);
              reject(err);
            });
        } else {
          summary.totalRecords = rowCount;
          summary.dateRange.start =
            summary.dateRange.start?.toISOString() || null;
          summary.dateRange.end = summary.dateRange.end?.toISOString() || null;
          console.log(
            "Pizzahut Orders Streaming Batch Insert Summary:",
            summary
          );
          sendStatus(
            "completed",
            "Pizzahut Orders processing completed.",
            summary
          );
          resolve();
        }
      });
      stream.on("error", (err) => {
        streamError = err;
        sendStatus("failed", `Processing failed: ${err.message}`);
        reject(err);
      });
    });
    if (streamError) throw streamError;
    return summary;
  } catch (error) {
    console.error("Error in processPizzahutOrdersDataStreamingBatch:", error);
    sendStatus("failed", `Processing failed: ${error.message}`);
    throw error;
  }
};

// Main processing function
const processFile = async () => {
  try {
    sendStatus("processing", "Starting file processing...");
    if (!fs.existsSync(filePath)) {
      throw new Error("File not found");
    }
    const fileExtension = path.extname(filePath).toLowerCase();

    // Add pizzahut_orders CSV logic as a branch
    if (type === "pizzahut_orders" && fileExtension === ".csv") {
      await processPizzahutOrdersDataStreamingBatch(filePath);
      return;
    }

    if (type === "mpr_hdfc_card" && fileExtension === ".xlsx") {
      console.log(
        "[MPR HDFC Card] Using streaming batch insert for all file sizes."
      );
      // Use exceljs streaming to get all sheet names
      const workbook = new ExcelJS.stream.xlsx.WorkbookReader(filePath);
      for await (const worksheetReader of workbook) {
        await processMprHdfcCardDataStreamingBatch(
          filePath,
          worksheetReader.name
        );
      }
      sendStatus("completed", "MPR HDFC Card processing completed.");
      return;
    }

    if (type === "mpr_hdfc_upi" && fileExtension === ".xlsx") {
      console.log(
        "[MPR HDFC UPI] Using streaming batch insert for all file sizes."
      );
      // Use exceljs streaming to get all sheet names
      const workbook = new ExcelJS.stream.xlsx.WorkbookReader(filePath);
      for await (const worksheetReader of workbook) {
        await processMprHdfcUpiDataStreamingBatch(
          filePath,
          worksheetReader.name
        );
      }
      sendStatus("completed", "MPR HDFC UPI processing completed.");
      return;
    }

    if (type === "trm" && fileExtension === ".xlsx") {
      console.log("[TRM] Using streaming batch insert for all file sizes.");
      // Use exceljs streaming to get all sheet names
      const workbook = new ExcelJS.stream.xlsx.WorkbookReader(filePath);
      for await (const worksheetReader of workbook) {
        await processTrmDataStreamingBatch(filePath, worksheetReader.name);
      }
      sendStatus("completed", "TRM processing completed.");
      return;
    }
  } catch (error) {
    console.error("File processing error:", error);
    sendStatus("failed", `Processing failed: ${error.message}`);
  }
};

// Start processing
processFile();
