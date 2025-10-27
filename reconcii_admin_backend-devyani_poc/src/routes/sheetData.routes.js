const express = require("express");
const router = express.Router();
const sheetDataController = require("../controllers/sheetData.controller");

// Start sheet data generation
router.post("/generate", sheetDataController.startSheetDataGeneration);

// Check sheet data generation status
router.get(
  "/status/:job_id",
  sheetDataController.checkSheetDataGenerationStatus
);

// Get sheet data
router.get("/data", sheetDataController.getSheetData);

module.exports = router;
