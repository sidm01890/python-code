const express = require("express");
const router = express.Router();
const { verifyToken, isAdmin } = require("../middleware/auth.middleware");
const {
  fileUploadParser,
} = require("../controllers/reconciliation.controller");
const multer = require("multer");
// Configure multer for file uploads
const storage = multer.memoryStorage(); // Store files in memory
const upload = multer({ storage: storage }).array("files"); // Accept multiple files

router.use(verifyToken);

router.post("/fileUpload", upload, fileUploadParser);

module.exports = router;
