const db = require("../models");
const XLSX = require("xlsx"); // Import the xlsx library

// const fileUploadParser = async (req, res) => {
//   try {
//     // Check if files are uploaded
//     const files = req.files; // Assuming you're using multer for multiple file uploads
//     if (!files || files.length === 0) {
//       return res.status(400).json({ message: "No files uploaded" });
//     }

//     // Determine which table to push data into based on a parameter
//     const targetTable = req.body.targetTable; // Expecting a parameter to specify the target table

//     // Process each file
//     for (const file of files) {
//       const workbook = XLSX.read(file.buffer, {
//         type: "buffer",
//         cellDates: true,
//       }); // Read the file buffer
//       const sheetName = workbook.SheetNames[0]; // Get the first sheet
//       let data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]); // Convert to JSON
//       data = [data[0]];
//       // Create a mapping object for easy lookup
//       const mappings = await db.tender_column_mapping.findAll({
//         include: [
//           {
//             model: db.excel_tender_columns,
//             attributes: ["excel_column_name"],
//             as: "excel_tender_columns",
//           },
//           {
//             model: db.db_tender_columns,
//             attributes: ["db_column_name"],
//             as: "db_tender_columns",
//           },
//         ],
//         where: {
//           "$excel_tender_columns.tender$": targetTable, // Assuming tender is the same as targetTable
//         },
//       });

//       // Create a mapping object
//       const mappingObject = {};
//       mappings.forEach((mapping) => {
//         const excelColName = mapping.excel_tender_columns.excel_column_name;
//         const dbColName = mapping.db_tender_columns.db_column_name;
//         mappingObject[excelColName] = dbColName; // Map Excel column name to DB column name
//       });

//       // Map the parsed data to match the model structure using the mapping object
//       const mappedData = data.map((item) => {
//         const mappedItem = {};
//         console.log("item");
//         for (const [excelCol, dbCol] of Object.entries(mappingObject)) {
//           console.log("dbCol", dbCol, excelCol);
//           mappedItem[dbCol] = item[excelCol]; // Map the values
//         }
//         return mappedItem;
//       });

//       console.log("mappedData", mappedData[0]);

//       // Insert mapped data into the appropriate table
//       if (targetTable === "cms_mpr_raw") {
//         await db.cms_mpr_raw.bulkCreate(mappedData); // Insert into cms_mpr_raw table
//       } else if (targetTable === "yes_bank_statement_raw") {
//         await db.yes_bank_statement_raw.bulkCreate(mappedData); // Insert into yes_bank_statement_raw table
//       } else if (targetTable === "hsbc_bank_statement_raw") {
//         await db.hsbc_bank_statement_raw.bulkCreate(mappedData); // Insert into hsbc_bank_statement_raw table
//       } else if (targetTable === "hsbc_bank_statement_raw") {
//         await db.hsbc_bank_statement_raw.bulkCreate(mappedData); // Insert into hsbc_bank_statement_raw table
//       } else if (targetTable === "bill_wise_sales") {
//         await db.bill_wise_sales.bulkCreate(mappedData); // Insert into hsbc_bank_statement_raw table
//       } else {
//         return res
//           .status(400)
//           .json({ message: "Invalid target table specified" });
//       }
//     }

//     res.status(201).json({ success: true });
//   } catch (error) {
//     console.log("error", error);
//     res.status(500).json({ message: "Error processing files" });
//   }
// };

const fileUploadParser = async (req, res) => {
  try {
    // Check if files are uploaded
    const files = req.files; // Assuming you're using multer for file uploads
    if (!files || files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    const targetTable = req.body.targetTable; // Determine which table to insert data into

    for (const file of files) {
      console.log("file", file);
      // Read the file buffer
      let workbook = null;
      try {
        workbook = XLSX.read(file.buffer, {
          type: "buffer",
          cellDates: true,
          dense: true,
        });
      } catch (e) {
        console.log(e);
      }

      const sheetName = workbook.SheetNames[0];
      console.log("sheetName", sheetName);
      const sheet = workbook.Sheets[sheetName];

      // Convert sheet data to JSON (Array of Arrays for efficiency)
      const rawData = XLSX.utils.sheet_to_json(sheet, {
        raw: true,
        range: 0,
        defval: "",
        header: 1, // Return as an array of arrays (faster)
      });

      if (!rawData.length) {
        return res.status(400).json({ message: "Empty file or sheet" });
      }

      // Extract column headers from the first row
      const headers = rawData.shift(); // Remove first row (header row)
      console.log("headers", headers);
      // Fetch column mappings from the database
      const mappings = await db.tender_column_mapping.findAll({
        include: [
          {
            model: db.excel_tender_columns,
            attributes: ["excel_column_name"],
            as: "excel_tender_columns",
          },
          {
            model: db.db_tender_columns,
            attributes: ["db_column_name"],
            as: "db_tender_columns",
          },
        ],
        where: { "$excel_tender_columns.tender$": targetTable },
      });

      // Create a mapping object for column names
      const mappingObject = {};
      mappings.forEach((mapping) => {
        mappingObject[mapping.excel_tender_columns.excel_column_name] =
          mapping.db_tender_columns.db_column_name;
      });

      // Map Excel headers to DB column names
      const dbHeaders = headers
        .map((col) => mappingObject[col] || null)
        .filter((col) => col); // Remove nulls

      // Process data in chunks
      for (let i = 0; i < rawData.length; i += BATCH_SIZE) {
        const chunk = rawData.slice(i, i + BATCH_SIZE);

        // Map rows based on column headers
        const mappedData = chunk.map((row) => {
          let obj = {};
          dbHeaders.forEach((dbCol, idx) => {
            obj[dbCol] = row[idx] || "";
          });
          return obj;
        });

        // Bulk insert into the target table
        if (targetTable === "cms_mpr_raw") {
          await db.cms_mpr_raw.bulkCreate(mappedData);
        } else if (targetTable === "yes_bank_statement_raw") {
          await db.yes_bank_statement_raw.bulkCreate(mappedData);
        } else if (targetTable === "hsbc_bank_statement_raw") {
          await db.hsbc_bank_statement_raw.bulkCreate(mappedData);
        } else if (targetTable === "bill_wise_sales") {
          await db.bill_wise_sales.bulkCreate(mappedData);
        } else {
          return res
            .status(400)
            .json({ message: "Invalid target table specified" });
        }
      }
    }

    res.status(201).json({ success: true });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Error processing files" });
  }
};

module.exports = {
  fileUploadParser,
};
