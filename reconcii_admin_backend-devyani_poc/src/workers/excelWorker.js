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

process.on("message", async ({ jobType, generationId, params }) => {
  console.log(`[Worker] Received generationId: ${generationId}`);

  try {
    // Import your actual implementation function (refactor to keep your giant function in another file if you want)
    if (jobType === "summarySheet") {
      await processExcelGeneration(generationId, params);
    } else if (jobType === "receivableVsReceipt") {
      await processExcelGenerationForReceivableVsReceipts(generationId, params);
    } else {
      throw new Error(`Unknown jobType: ${jobType}`);
    }

    process.send({ status: "completed", generationId });
  } catch (error) {
    console.error(`[Worker] Error`, error);
    process.send({ status: "failed", generationId, error: error.message });
  }

  process.exit(0);
});

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
        return sheet;
      }

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
        if (totalCount > 10000) {
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
        if (totalCount > 10000) {
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
