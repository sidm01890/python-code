# API Comparison Analysis: Node.js vs Python Backend

## Executive Summary

This document provides a comprehensive comparison of all APIs in both Node.js and Python backends, their classification, and usage patterns.

---

## API Count Summary

| Backend | Total APIs | Intermediate/Calculation APIs | Other APIs |
|---------|-----------|-------------------------------|-----------|
| **Node.js** | 61 | 12 | 49 |
| **Python** | 72 | 13 | 59 |
| **Difference** | +11 in Python | +1 in Python | +10 in Python |

---

## Detailed API Listing

### 1. RECONCILIATION APIs

#### Node.js Backend (`/api/node/reconciliation`)

| Method | Endpoint | Purpose | Type |
|--------|----------|---------|------|
| GET | `/populate-threepo-dashboard` | Populate 3PO dashboard data | 🔄 **Intermediate** |
| POST | `/generate-excel` | Generate reconciliation Excel | 📊 Data Generation |
| POST | `/generate-receivable-receipt-excel` | Generate receivable vs receipt Excel | 📊 Data Generation |
| POST | `/generation-status` | Check Excel generation status | ℹ️ Status Check |
| POST | `/threePODashboardData` | Get 3PO dashboard data | 📈 **Dashboard** |
| POST | `/instore-data` | Get instore dashboard data | 📈 **Dashboard** |
| POST | `/generate-common-trm` | Populate pos_vs_trm_summary table | 🔄 **Intermediate** |
| GET | `/download/:filename` | Download generated files | 📥 File Download |
| GET | `/cities` | Get all cities | ℹ️ Reference Data |
| POST | `/stores` | Get stores by cities | ℹ️ Reference Data |
| GET | `/public/threepo/missingStoreMappings` | Get missing store mappings | ℹ️ Reference Data |

#### Python Backend (`/api/reconciliation`)

| Method | Endpoint | Purpose | Type |
|--------|----------|---------|------|
| GET | `/populate-threepo-dashboard` | Populate 3PO dashboard data | 🔄 **Intermediate** |
| POST | `/generate-excel` | Generate reconciliation Excel | 📊 Data Generation |
| POST | `/generate-receivable-receipt-excel` | Generate receivable vs receipt Excel | 📊 Data Generation |
| POST | `/generation-status` | Check Excel generation status | ℹ️ Status Check |
| POST | `/threePODashboardData` | Get 3PO dashboard data | 📈 **Dashboard** |
| POST | `/instore-data` | Get instore dashboard data | 📈 **Dashboard** |
| POST | `/generate-common-trm` | Populate pos_vs_trm_summary table | 🔄 **Intermediate** |
| GET | `/download/{filename}` | Download generated files | 📥 File Download |
| GET | `/cities` | Get all cities | ℹ️ Reference Data |
| POST | `/stores` | Get stores by cities | ℹ️ Reference Data |
| GET | `/public/threepo/missingStoreMappings` | Get missing store mappings | ℹ️ Reference Data |
| GET | `/public/dashboard/reportingTenders` | Get reporting tenders | ℹ️ Reference Data |
| GET | `/public/custom/reportFields` | Get custom report fields | ℹ️ Reference Data |
| GET | `/api/v1/recologics/findOldestEffectiveDate` | Find oldest effective date | ℹ️ Reference Data |
| GET | `/api/v1/tenderList` | Get tender list | ℹ️ Reference Data |
| GET | `/api/ve1/datalog/lastSynced` | Get last synced date | ℹ️ Reference Data |
| POST | `/prepare-self-reco` | Prepare self-reco table | 🔄 **Intermediate** |
| POST | `/prepare-cross-reco` | Prepare cross-reco table | 🔄 **Intermediate** |
| POST | `/summary-sheet` | Generate summary sheet | 📊 Data Generation |
| POST | `/summary-sheet-sync` | Sync summary sheet | 🔄 **Intermediate** |

**Python-Only APIs (5 additional):**
- `/public/dashboard/reportingTenders`
- `/public/custom/reportFields`
- `/api/v1/recologics/findOldestEffectiveDate`
- `/api/v1/tenderList`
- `/api/ve1/datalog/lastSynced`
- `/prepare-self-reco`
- `/prepare-cross-reco`
- `/summary-sheet`
- `/summary-sheet-sync`

---

### 2. AUTHENTICATION APIs

#### Node.js Backend (`/api/auth`)

| Method | Endpoint | Purpose | Type |
|--------|----------|---------|------|
| POST | `/login` | User login | 🔐 Authentication |
| POST | `/register` | User registration | 🔐 Authentication |
| POST | `/auth/access/token` | Get access token (alias) | 🔐 Authentication |
| POST | `/update_subscriptions` | Update user subscriptions | ⚙️ Configuration |
| POST | `/end_user/forgot_password` | Forgot password | 🔐 Authentication |
| POST | `/end_user/verify_otp` | Verify OTP | 🔐 Authentication |
| POST | `/end_user/reset_password` | Reset password | 🔐 Authentication |

#### Python Backend (`/api/auth`)

| Method | Endpoint | Purpose | Type |
|--------|----------|---------|------|
| POST | `/login` | User login | 🔐 Authentication |
| POST | `/register` | User registration | 🔐 Authentication |
| POST | `/auth/access/token` | Get access token | 🔐 Authentication |
| POST | `/update_subscriptions` | Update user subscriptions | ⚙️ Configuration |
| POST | `/end_user/forgot_password` | Forgot password | 🔐 Authentication |
| POST | `/end_user/verify_otp` | Verify OTP | 🔐 Authentication |
| POST | `/end_user/reset_password` | Reset password | 🔐 Authentication |
| POST | `/verify-token` | Verify JWT token | 🔐 Authentication |

**Python-Only APIs (1 additional):**
- `/verify-token`

**Status:** ✅ **Matched** (Python has 1 extra)

---

### 3. USER MANAGEMENT APIs

#### Node.js Backend (`/api/user`)

| Method | Endpoint | Purpose | Type |
|--------|----------|---------|------|
| POST | `/createUser` | Create user | 👤 User Management |
| POST | `/updateUser` | Update user | 👤 User Management |
| POST | `/deleteUser` | Delete user | 👤 User Management |
| POST | `/updatePassword` | Update password | 👤 User Management |
| POST | `/getAllUsers` | Get all users | 👤 User Management |
| POST | `/updateUserModuleMapping` | Update user module mapping | ⚙️ Configuration |
| POST | `/getUserModules` | Get user modules | 👤 User Management |

#### Python Backend (`/api/user`)

| Method | Endpoint | Purpose | Type |
|--------|----------|---------|------|
| POST | `/createUser` | Create user | 👤 User Management |
| POST | `/updateUser` | Update user | 👤 User Management |
| POST | `/deleteUser` | Delete user | 👤 User Management |
| POST | `/updatePassword` | Update password | 👤 User Management |
| POST | `/getAllUsers` | Get all users | 👤 User Management |
| POST | `/updateUserModuleMapping` | Update user module mapping | ⚙️ Configuration |
| POST | `/getUserModules` | Get user modules | 👤 User Management |

**Status:** ✅ **Matched**

---

### 4. ORGANIZATION APIs

#### Node.js Backend (`/api/organization`)

| Method | Endpoint | Purpose | Type |
|--------|----------|---------|------|
| POST | `/create` | Create organization | 🏢 Organization |
| GET | `/all` | Get all organizations | 🏢 Organization |
| POST | `/update` | Update organization | 🏢 Organization |
| DELETE | `/delete` | Delete organization | 🏢 Organization |
| POST | `/tools/assign` | Assign tools to organization | ⚙️ Configuration |
| GET | `/tools/:organization_id` | Get organization tools | 🏢 Organization |
| POST | `/dashboard` | Get dashboard stats | 📈 **Dashboard** |
| POST | `/getOrganizationModules` | Get org modules | ⚙️ Configuration |
| POST | `/updateOrganizationModules` | Update org modules | ⚙️ Configuration |

#### Python Backend (`/api/organization`)

| Method | Endpoint | Purpose | Type |
|--------|----------|---------|------|
| POST | `/create` | Create organization | 🏢 Organization |
| GET | `/all` | Get all organizations | 🏢 Organization |
| POST | `/update` | Update organization | 🏢 Organization |
| DELETE | `/delete` | Delete organization | 🏢 Organization |
| POST | `/tools/assign` | Assign tools to organization | ⚙️ Configuration |
| GET | `/tools/{organization_id}` | Get organization tools | 🏢 Organization |
| POST | `/dashboard` | Get dashboard stats | 📈 **Dashboard** |
| POST | `/getOrganizationModules` | Get org modules | ⚙️ Configuration |
| POST | `/updateOrganizationModules` | Update org modules | ⚙️ Configuration |

**Status:** ✅ **Matched**

---

### 5. TOOL MANAGEMENT APIs

#### Node.js Backend (`/api/tool`)

| Method | Endpoint | Purpose | Type |
|--------|----------|---------|------|
| POST | `/createTool` | Create tool | 🛠️ Tool Management |
| GET | `/getAllTools` | Get all tools | 🛠️ Tool Management |
| GET | `/getToolById` | Get tool by ID | 🛠️ Tool Management |
| POST | `/updateTool` | Update tool | 🛠️ Tool Management |
| POST | `/deleteTool` | Delete tool | 🛠️ Tool Management |

#### Python Backend (`/api/tool`)

| Method | Endpoint | Purpose | Type |
|--------|----------|---------|------|
| POST | `/createTool` | Create tool | 🛠️ Tool Management |
| GET | `/getAllTools` | Get all tools | 🛠️ Tool Management |
| GET | `/getToolById` | Get tool by ID | 🛠️ Tool Management |
| POST | `/updateTool` | Update tool | 🛠️ Tool Management |
| POST | `/deleteTool` | Delete tool | 🛠️ Tool Management |

**Status:** ✅ **Matched**

---

### 6. MODULE MANAGEMENT APIs

#### Node.js Backend (`/api/module`)

| Method | Endpoint | Purpose | Type |
|--------|----------|---------|------|
| POST | `/createModule` | Create module | 📦 Module Management |
| POST | `/getAllModules` | Get all modules | 📦 Module Management |
| POST | `/deleteModule` | Delete module | 📦 Module Management |

#### Python Backend (`/api/module`)

| Method | Endpoint | Purpose | Type |
|--------|----------|---------|------|
| POST | `/createModule` | Create module | 📦 Module Management |
| POST | `/getAllModules` | Get all modules | 📦 Module Management |
| POST | `/deleteModule` | Delete module | 📦 Module Management |

**Status:** ✅ **Matched**

---

### 7. GROUP MANAGEMENT APIs

#### Node.js Backend (`/api/group`)

| Method | Endpoint | Purpose | Type |
|--------|----------|---------|------|
| POST | `/createGroup` | Create group | 👥 Group Management |
| POST | `/getAllGroups` | Get all groups | 👥 Group Management |
| POST | `/getGroupModules` | Get group modules | ⚙️ Configuration |
| POST | `/updateGroupModuleMapping` | Update group module mapping | ⚙️ Configuration |
| POST | `/deleteGroup` | Delete group | 👥 Group Management |

#### Python Backend (`/api/group`)

| Method | Endpoint | Purpose | Type |
|--------|----------|---------|------|
| POST | `/createGroup` | Create group | 👥 Group Management |
| POST | `/getAllGroups` | Get all groups | 👥 Group Management |
| POST | `/getGroupModules` | Get group modules | ⚙️ Configuration |
| POST | `/updateGroupModuleMapping` | Update group module mapping | ⚙️ Configuration |
| POST | `/deleteGroup` | Delete group | 👥 Group Management |

**Status:** ✅ **Matched**

---

### 8. PERMISSION APIs

#### Node.js Backend (`/api/permission`)

| Method | Endpoint | Purpose | Type |
|--------|----------|---------|------|
| POST | `/createPermission` | Create permission | 🔒 Permission Management |
| POST | `/getAllPermissions` | Get all permissions | 🔒 Permission Management |
| POST | `/deletePermission` | Delete permission | 🔒 Permission Management |

#### Python Backend (`/api/permission`)

| Method | Endpoint | Purpose | Type |
|--------|----------|---------|------|
| POST | `/createPermission` | Create permission | 🔒 Permission Management |
| POST | `/getAllPermissions` | Get all permissions | 🔒 Permission Management |
| POST | `/deletePermission` | Delete permission | 🔒 Permission Management |

**Status:** ✅ **Matched**

---

### 9. AUDIT LOG APIs

#### Node.js Backend (`/api/audit_log`)

| Method | Endpoint | Purpose | Type |
|--------|----------|---------|------|
| POST | `/create` | Create audit log | 📝 Audit Log |
| POST | `/list` | Get audit logs | 📝 Audit Log |
| GET | `/user/list` | Get all organization users | 📝 Audit Log |

#### Python Backend (`/api/audit_log`)

| Method | Endpoint | Purpose | Type |
|--------|----------|---------|------|
| POST | `/create` | Create audit log | 📝 Audit Log |
| POST | `/list` | Get audit logs | 📝 Audit Log |
| GET | `/user/list` | Get all organization users | 📝 Audit Log |

**Status:** ✅ **Matched**

---

### 10. FILE UPLOAD APIs

#### Node.js Backend (`/api/uploader`)

| Method | Endpoint | Purpose | Type |
|--------|----------|---------|------|
| POST | `/upload` | Upload file | 📤 File Upload |
| GET | `/status/:uploadId` | Get upload status | ℹ️ Status Check |
| GET | `/uploads` | Get all uploads | 📤 File Upload |
| DELETE | `/uploads/:uploadId` | Delete upload | 📤 File Upload |

#### Python Backend (`/api/uploader`)

| Method | Endpoint | Purpose | Type |
|--------|----------|---------|------|
| POST | `/upload` | Upload file | 📤 File Upload |
| GET | `/status/{upload_id}` | Get upload status | ℹ️ Status Check |
| GET | `/uploads` | Get all uploads | 📤 File Upload |
| DELETE | `/uploads/{upload_id}` | Delete upload | 📤 File Upload |
| POST | `/analyze-columns` | Analyze file columns | 📊 Analysis |
| GET | `/datasource` | Get datasource info | ℹ️ Reference Data |

**Python-Only APIs (2 additional):**
- `/analyze-columns`
- `/datasource`

**Status:** ✅ **Mostly Matched** (Python has 2 extra)

---

### 11. SHEET DATA APIs

#### Node.js Backend (`/api/sheet-data`)

| Method | Endpoint | Purpose | Type |
|--------|----------|---------|------|
| POST | `/generate` | Generate sheet data | 📊 Data Generation |
| GET | `/status/:jobId` | Get generation status | ℹ️ Status Check |
| GET | `/data` | Get sheet data | 📊 Data Generation |

#### Python Backend (`/api/sheet-data`)

| Method | Endpoint | Purpose | Type |
|--------|----------|---------|------|
| POST | `/generate` | Generate sheet data | 📊 Data Generation |
| GET | `/status/{job_id}` | Get generation status | ℹ️ Status Check |
| GET | `/data` | Get sheet data | 📊 Data Generation |

**Status:** ✅ **Matched**

---

### 12. RECONCILIATION FILE UPLOAD (Node.js Only)

#### Node.js Backend (`/api/node/reconciliation`)

| Method | Endpoint | Purpose | Type |
|--------|----------|---------|------|
| POST | `/fileUpload` | Upload reconciliation file | 📤 File Upload |

**Note:** This is in a separate route file but under the same prefix.

---

## API Classification

### 🔄 INTERMEDIATE/CALCULATION APIs

These APIs are used for data preparation, calculations, and table population. They should be run before using dashboard/reporting APIs.

#### Node.js Backend (12 APIs)

1. `GET /api/node/reconciliation/populate-threepo-dashboard` - Populate 3PO dashboard tables
2. `POST /api/node/reconciliation/generate-common-trm` - Populate pos_vs_trm_summary table
3. `POST /api/node/reconciliation/generate-excel` - Generate reconciliation Excel (calculation)
4. `POST /api/node/reconciliation/generate-receivable-receipt-excel` - Generate receivable Excel (calculation)
5. `POST /api/node/reconciliation/generation-status` - Check calculation status
6. `POST /api/organization/dashboard` - Calculate dashboard stats
7. `POST /api/sheet-data/generate` - Generate sheet data (calculation)
8. `GET /api/sheet-data/status/:jobId` - Check calculation status
9. `POST /api/uploader/upload` - Upload and process data (calculation)
10. `GET /api/uploader/status/:uploadId` - Check processing status
11. `POST /api/node/reconciliation/fileUpload` - Upload reconciliation file (calculation)
12. `GET /api/uploader/uploads` - Get processed uploads (metadata calculation)

#### Python Backend (13 APIs)

1. `GET /api/reconciliation/populate-threepo-dashboard` - Populate 3PO dashboard tables
2. `POST /api/reconciliation/generate-common-trm` - Populate pos_vs_trm_summary table
3. `POST /api/reconciliation/prepare-self-reco` - Prepare self-reco table
4. `POST /api/reconciliation/prepare-cross-reco` - Prepare cross-reco table
5. `POST /api/reconciliation/summary-sheet-sync` - Sync summary sheet data
6. `POST /api/reconciliation/generate-excel` - Generate reconciliation Excel (calculation)
7. `POST /api/reconciliation/generate-receivable-receipt-excel` - Generate receivable Excel (calculation)
8. `POST /api/reconciliation/generation-status` - Check calculation status
9. `POST /api/reconciliation/summary-sheet` - Generate summary sheet (calculation)
10. `POST /api/organization/dashboard` - Calculate dashboard stats
11. `POST /api/sheet-data/generate` - Generate sheet data (calculation)
12. `GET /api/sheet-data/status/{job_id}` - Check calculation status
13. `POST /api/uploader/upload` - Upload and process data (calculation)
14. `GET /api/uploader/status/{upload_id}` - Check processing status
15. `POST /api/uploader/analyze-columns` - Analyze file columns (calculation)

**Python-Only Intermediate APIs (3):**
- `/prepare-self-reco`
- `/prepare-cross-reco`
- `/summary-sheet-sync`
- `/summary-sheet`
- `/analyze-columns`

---

### 📈 DASHBOARD/REPORTING APIs

These APIs retrieve data for dashboards and reports. They depend on intermediate APIs being run first.

#### Both Backends (Matched)

1. `POST /api/reconciliation/threePODashboardData` - Get 3PO dashboard data
2. `POST /api/reconciliation/instore-data` - Get instore dashboard data
3. `GET /api/reconciliation/cities` - Get cities (reference)
4. `POST /api/reconciliation/stores` - Get stores (reference)
5. `GET /api/reconciliation/public/threepo/missingStoreMappings` - Get missing mappings

---

### 🔐 AUTHENTICATION & AUTHORIZATION APIs

#### Both Backends (Matched)

- Login, Register, Token, Password Reset, OTP Verification
- Python has 1 extra: `/verify-token`

---

### 👤 USER MANAGEMENT APIs

#### Both Backends (Matched)

- Create, Update, Delete, Get Users
- User Module Mapping

---

### 🏢 ORGANIZATION APIs

#### Both Backends (Matched)

- CRUD operations for organizations
- Tool assignment, Module mapping

---

### 🛠️ TOOL/MODULE/GROUP/PERMISSION APIs

#### Both Backends (Matched)

- Standard CRUD operations

---

## Critical Intermediate APIs for Instore-Data

Based on the fix we implemented, these intermediate APIs **MUST** be run before using `/instore-data`:

### 1. **Primary Intermediate API (Required)**

```
POST /api/reconciliation/generate-common-trm
```

**Purpose:** Populates `pos_vs_trm_summary` table which provides:
- Bank-wise reconciliation data
- POS vs TRM matching
- Reconciliation status
- Acquirer mapping

**Steps:**
1. Creates `pos_vs_trm_summary` table if it doesn't exist
2. Processes orders data (POS data)
3. Processes TRM data (Terminal data)
4. Calculates reconciliation status

**When to Run:**
- After data uploads
- Before using `/instore-data` API
- Periodically (daily/weekly) to keep data fresh

### 2. **Secondary Intermediate API (Optional but Recommended)**

```
GET /api/reconciliation/populate-threepo-dashboard
```

**Purpose:** Populates 3PO dashboard tables for three-party order reconciliation.

**When to Run:**
- Before using `/threePODashboardData` API
- Periodically for data freshness

---

## API Execution Order

### For Instore-Data API:

```
1. Upload Data (if needed)
   POST /api/uploader/upload
   
2. Run Reconciliation Pipeline
   POST /api/reconciliation/generate-common-trm
   [Wait for completion - check logs]
   
3. Get Instore Dashboard Data
   POST /api/reconciliation/instore-data
   {
     "startDate": "2024-12-01 00:00:00",
     "endDate": "2024-12-07 23:59:59",
     "stores": ["141"]
   }
```

### For 3PO Dashboard API:

```
1. Populate 3PO Dashboard Tables
   GET /api/reconciliation/populate-threepo-dashboard
   [Wait for completion]
   
2. Get 3PO Dashboard Data
   POST /api/reconciliation/threePODashboardData
   {
     "startDate": "2024-12-01 00:00:00",
     "endDate": "2024-12-07 23:59:59",
     "stores": ["141"]
   }
```

---

## Summary of Differences

### Python Backend Advantages

1. **More Reference Data APIs** (5 additional):
   - `/public/dashboard/reportingTenders`
   - `/public/custom/reportFields`
   - `/api/v1/recologics/findOldestEffectiveDate`
   - `/api/v1/tenderList`
   - `/api/ve1/datalog/lastSynced`

2. **Additional Reconciliation Features**:
   - `/prepare-self-reco` - Self-reconciliation preparation
   - `/prepare-cross-reco` - Cross-reconciliation preparation
   - `/summary-sheet` - Summary sheet generation
   - `/summary-sheet-sync` - Summary sheet synchronization

3. **Enhanced File Upload**:
   - `/analyze-columns` - Column analysis
   - `/datasource` - Datasource information

4. **Additional Authentication**:
   - `/verify-token` - Token verification endpoint

### Node.js Backend Advantages

1. **File Upload Route**:
   - Separate `/fileUpload` endpoint for reconciliation files

---

## Recommendations

### For Instore-Data API Usage:

1. **Always run** `POST /api/reconciliation/generate-common-trm` **first**
2. **Check logs** to ensure completion
3. **Then call** `POST /api/reconciliation/instore-data`

### For Production:

1. **Schedule** intermediate APIs:
   - `generate-common-trm`: Daily at midnight
   - `populate-threepo-dashboard`: Daily at 1 AM
   - `prepare-self-reco`: Daily at 2 AM
   - `prepare-cross-reco`: Daily at 3 AM

2. **Monitor** calculation status using `/generation-status` endpoint

3. **Set up alerts** for failed calculations

---

## Conclusion

- **Total APIs**: Python has 11 more APIs than Node.js
- **Intermediate APIs**: Python has 1 more intermediate API
- **Core Functionality**: Both backends are well-matched
- **Python Extras**: Mostly reference data and additional reconciliation features

**For instore-data API specifically, the critical intermediate API is:**
```
POST /api/reconciliation/generate-common-trm
```

This must be run before using the instore-data endpoint to get bank-wise reconciliation data.

