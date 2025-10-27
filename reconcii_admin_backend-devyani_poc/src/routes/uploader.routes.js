const express = require("express");
const router = express.Router();
const uploaderController = require("../controllers/uploader.controller");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Multer configuration (reuse from controller)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../../uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/csv",
      "text/tab-separated-values",
      "application/csv",
      "text/plain",
    ];
    const allowedExtensions = [".xlsx", ".xls", ".csv", ".tsv"];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    if (
      allowedTypes.includes(file.mimetype) ||
      allowedExtensions.includes(fileExtension)
    ) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Only Excel, CSV, and TSV files are allowed."
        ),
        false
      );
    }
  },
  limits: {
    fileSize: 400 * 1024 * 1024, // 200MB limit
    files: 10, // Maximum 10 files at once
  },
});

// Upload multiple files (multer as middleware)
router.post(
  "/upload",
  upload.array("files", 10),
  uploaderController.uploadFiles
);

// Get upload status by ID
router.get("/status/:uploadId", uploaderController.getUploadStatus);

// Get all uploads with pagination and filtering
router.get("/uploads", uploaderController.getAllUploads);

// Delete upload by ID
router.delete("/uploads/:uploadId", uploaderController.deleteUpload);

module.exports = router;
