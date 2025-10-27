# File Uploader API Documentation

## Overview

The File Uploader API provides functionality to upload and process multiple files (Excel, CSV, TSV) with background processing. Files are stored locally and processed asynchronously using worker threads.

## Features

- **Multiple File Upload**: Upload up to 10 files simultaneously
- **File Type Support**: Excel (.xlsx, .xls), CSV (.csv), TSV (.tsv)
- **Background Processing**: Files are processed in the background using worker threads
- **Status Tracking**: Real-time status updates for each upload
- **Type-Specific Processing**: Different processing logic for orders, transactions, and reconciliation data
- **File Management**: View, track, and delete uploads

## API Endpoints

### 1. Upload Multiple Files

**POST** `/api/uploader/upload`

Upload multiple files for processing.

**Request:**

- Content-Type: `multipart/form-data`
- Body:
  - `type` (string, required): Type of upload ("orders", "transactions", "reconciliation")
  - `files` (array, required): Array of files to upload

**Response:**

```json
{
  "success": true,
  "message": "Files uploaded successfully",
  "data": {
    "uploadedFiles": [
      {
        "id": 1,
        "filename": "orders.xlsx",
        "status": "uploaded",
        "message": "File uploaded successfully, processing in background"
      }
    ],
    "processingJobs": [1],
    "totalFiles": 1
  }
}
```

### 2. Get Upload Status

**GET** `/api/uploader/status/:uploadId`

Get the status of a specific upload.

**Response:**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "filename": "orders.xlsx",
    "status": "completed",
    "message": "File processed successfully",
    "filetype": ".xlsx",
    "filesize": 1024000,
    "upload_type": "orders",
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:01:00.000Z",
    "processed_data": {
      "fileType": ".xlsx",
      "uploadType": "orders",
      "processedAt": "2024-01-01T00:01:00.000Z",
      "summary": {
        "totalOrders": 150,
        "totalAmount": 15000.5,
        "orderStatuses": {
          "completed": 120,
          "pending": 30
        },
        "stores": ["Store A", "Store B"],
        "dateRange": {
          "start": "2024-01-01T00:00:00.000Z",
          "end": "2024-01-31T23:59:59.000Z"
        }
      }
    }
  }
}
```

### 3. Get All Uploads

**GET** `/api/uploader/uploads`

Get all uploads with pagination and filtering.

**Query Parameters:**

- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 10)
- `status` (string, optional): Filter by status ("uploaded", "processing", "completed", "failed")
- `type` (string, optional): Filter by upload type

**Response:**

```json
{
  "success": true,
  "data": {
    "uploads": [
      {
        "id": 1,
        "filename": "orders.xlsx",
        "status": "completed",
        "upload_type": "orders",
        "created_at": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalItems": 50,
      "itemsPerPage": 10
    }
  }
}
```

### 4. Delete Upload

**DELETE** `/api/uploader/uploads/:uploadId`

Delete a specific upload and its associated file.

**Response:**

```json
{
  "success": true,
  "message": "Upload deleted successfully"
}
```

## File Processing Types

### 1. Orders Processing

When `type` is "orders", the system processes:

- Total number of orders
- Total order amount
- Order status distribution
- Store information
- Date range of orders

### 2. Transactions Processing

When `type` is "transactions", the system processes:

- Total number of transactions
- Total transaction amount
- Transaction type distribution
- Payment method distribution
- Date range of transactions

### 3. Reconciliation Processing

When `type` is "reconciliation", the system processes:

- Total records
- Reconciled vs unreconciled counts
- Reconciled vs unreconciled amounts
- Reconciliation status distribution
- Date range of records

### 4. TRM Processing

When `type` is "trm", the system processes:

- **Database-Excel Column Mapping**: Fetches column mappings from `table_columns_mapping` where `tender_id = 5`
- **Unique Record Identification**: Generates unique IDs based on combination of key columns (order_id, store_code, order_date, amount)
- **Upsert Logic**: Updates existing records or creates new ones based on unique ID
- **Processing Summary**: Tracks processed, updated, and new records
- **Column Mapping Report**: Provides information about mapped and unmapped columns

## File Format Support

### Excel Files (.xlsx, .xls)

- Multiple sheets supported
- Headers automatically detected
- All data types preserved

### CSV Files (.csv)

- Comma-separated values
- Headers automatically detected
- UTF-8 encoding supported

### TSV Files (.tsv)

- Tab-separated values
- Headers automatically detected
- UTF-8 encoding supported

## Status Values

- **uploaded**: File uploaded successfully, waiting for processing
- **processing**: File is currently being processed
- **completed**: File processing completed successfully
- **failed**: File processing failed

## Error Handling

The API returns appropriate HTTP status codes:

- `200`: Success
- `400`: Bad request (invalid file type, missing parameters)
- `404`: Upload not found
- `500`: Internal server error

## File Size Limits

- Maximum file size: 50MB per file
- Maximum files per upload: 10 files

## Database Schema

The uploader uses the `upload_logs` table with the following structure:

```sql
CREATE TABLE upload_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  filename VARCHAR(255) NOT NULL,
  filepath TEXT NOT NULL,
  filesize BIGINT NOT NULL,
  filetype VARCHAR(10) NOT NULL,
  upload_type VARCHAR(50) NOT NULL,
  status ENUM('uploaded', 'processing', 'completed', 'failed') DEFAULT 'uploaded',
  message TEXT,
  processed_data JSON,
  error_details TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## Usage Examples

### Frontend Integration

```javascript
// Upload files
const formData = new FormData();
formData.append("type", "orders");
formData.append("files", file1);
formData.append("files", file2);

const response = await fetch("/api/uploader/upload", {
  method: "POST",
  body: formData,
});

const result = await response.json();
console.log("Upload IDs:", result.data.processingJobs);

// Check status
const statusResponse = await fetch(`/api/uploader/status/${uploadId}`);
const status = await statusResponse.json();
console.log("Status:", status.data.status);
```

### Node.js Integration

```javascript
const axios = require("axios");
const FormData = require("form-data");

async function uploadFiles(files, type) {
  const formData = new FormData();
  formData.append("type", type);

  files.forEach((file) => {
    formData.append("files", file);
  });

  const response = await axios.post("/api/uploader/upload", formData, {
    headers: formData.getHeaders(),
  });

  return response.data;
}
```

## Background Processing

Files are processed using Node.js worker threads to avoid blocking the main application. The processing includes:

1. **File Validation**: Check file type and format
2. **Data Extraction**: Parse Excel/CSV/TSV data
3. **Type-Specific Analysis**: Apply business logic based on upload type
4. **Summary Generation**: Create processing summary with statistics
5. **Status Updates**: Update database with progress and results

## Security Considerations

- File type validation prevents malicious file uploads
- File size limits prevent DoS attacks
- Files are stored in a secure uploads directory
- Database records track all upload activities
- Error handling prevents information leakage

## Monitoring and Logging

- All upload activities are logged in the database
- Processing errors are captured and stored
- File processing progress is tracked
- Upload statistics are available via API

## Dependencies

- `multer`: File upload handling
- `xlsx`: Excel file processing
- `csv-parser`: CSV/TSV file processing
- `dayjs`: Date manipulation
- `worker_threads`: Background processing
