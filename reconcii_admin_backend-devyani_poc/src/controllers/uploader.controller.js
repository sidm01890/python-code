const { Worker } = require("worker_threads");
const db = require("../models");
const path = require("path");
const fs = require("fs");

// Upload multiple files
const uploadFiles = async (req, res) => {
  try {
    const { type } = req.body;
    if (!type) {
      return res.status(400).json({
        success: false,
        message: "Type is required",
      });
    }

    // Validate upload type
    const validTypes = [
      "orders",
      "transactions",
      "reconciliation",
      "trm",
      "mpr_hdfc_card",
      "mpr_hdfc_upi",
      "pizzahut_orders",
    ];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid type. Must be one of: ${validTypes.join(", ")}`,
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No files uploaded",
      });
    }

    const uploadedFiles = [];
    const processingJobs = [];

    // Process each uploaded file
    for (const file of req.files) {
      try {
        // Create upload record in database
        const uploadRecord = await db.upload_logs.create({
          filename: file.originalname,
          filepath: file.path,
          filesize: file.size,
          filetype: path.extname(file.originalname).toLowerCase(),
          upload_type: type,
          status: "uploaded",
          message: "File uploaded successfully, processing in background",
          created_at: new Date(),
          updated_at: new Date(),
        });

        uploadedFiles.push({
          id: uploadRecord.id,
          filename: file.originalname,
          status: "uploaded",
          message: "File uploaded successfully, processing in background",
        });

        // Start background processing (do NOT await)
        startBackgroundProcessing(uploadRecord.id, file.path, type);
        processingJobs.push(uploadRecord.id);
      } catch (fileError) {
        console.error(`Error processing file ${file.originalname}:`, fileError);
        uploadedFiles.push({
          filename: file.originalname,
          status: "error",
          message: fileError.message,
        });
      }
    }

    // Send response immediately after upload, do NOT wait for processing
    return res.status(200).json({
      success: true,
      message: "Files uploaded successfully",
      data: {
        uploadedFiles,
        processingJobs,
        totalFiles: req.files.length,
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Start background processing
const startBackgroundProcessing = async (uploadId, filePath, type) => {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      path.join(__dirname, "../workers/fileProcessor.js"),
      {
        workerData: {
          uploadId,
          filePath,
          type,
        },
      }
    );

    worker.on("message", async (message) => {
      try {
        await db.upload_logs.update(
          {
            status: message.status,
            message: message.message,
            processed_data: message.processedData || null,
            updated_at: new Date(),
          },
          {
            where: { id: uploadId },
          }
        );

        if (message.status === "completed" || message.status === "failed") {
          worker.terminate();
          resolve(uploadId);
        }
      } catch (error) {
        console.error("Error updating upload status:", error);
        reject(error);
      }
    });

    worker.on("error", async (error) => {
      console.error("Worker error:", error);
      try {
        await db.upload_logs.update(
          {
            status: "failed",
            message: `Processing failed: ${error.message}`,
            updated_at: new Date(),
          },
          {
            where: { id: uploadId },
          }
        );
      } catch (updateError) {
        console.error("Error updating failed status:", updateError);
      }
      worker.terminate();
      reject(error);
    });
  });
};

// Get upload status
const getUploadStatus = async (req, res) => {
  try {
    const { uploadId } = req.params;

    const uploadRecord = await db.upload_logs.findByPk(uploadId);

    if (!uploadRecord) {
      return res.status(404).json({
        success: false,
        message: "Upload record not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: uploadRecord.id,
        filename: uploadRecord.filename,
        status: uploadRecord.status,
        message: uploadRecord.message,
        filetype: uploadRecord.filetype,
        filesize: uploadRecord.filesize,
        upload_type: uploadRecord.upload_type,
        created_at: uploadRecord.created_at,
        updated_at: uploadRecord.updated_at,
        processed_data: uploadRecord.processed_data,
      },
    });
  } catch (error) {
    console.error("Get upload status error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get all uploads
const getAllUploads = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, type } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};
    if (status) whereClause.status = status;
    if (type) whereClause.upload_type = type;

    const uploads = await db.upload_logs.findAndCountAll({
      where: whereClause,
      order: [["created_at", "DESC"]],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    return res.status(200).json({
      success: true,
      data: {
        uploads: uploads.rows,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(uploads.count / limit),
          totalItems: uploads.count,
          itemsPerPage: parseInt(limit),
        },
      },
    });
  } catch (error) {
    console.error("Get all uploads error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Delete upload
const deleteUpload = async (req, res) => {
  try {
    const { uploadId } = req.params;

    const uploadRecord = await db.upload_logs.findByPk(uploadId);

    if (!uploadRecord) {
      return res.status(404).json({
        success: false,
        message: "Upload record not found",
      });
    }

    // Delete the physical file
    if (fs.existsSync(uploadRecord.filepath)) {
      fs.unlinkSync(uploadRecord.filepath);
    }

    // Delete from database
    await uploadRecord.destroy();

    return res.status(200).json({
      success: true,
      message: "Upload deleted successfully",
    });
  } catch (error) {
    console.error("Delete upload error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

module.exports = {
  uploadFiles,
  getUploadStatus,
  getAllUploads,
  deleteUpload,
};
