# 🧪 POSTMAN TESTING GUIDE - ALL 47 APIs

## **📋 OVERVIEW**

This guide provides complete JSON payloads for all 47 APIs converted from Node.js to Python FastAPI. You can import the Postman collection and test all endpoints systematically.

---

## **🚀 QUICK START**

### **1. Import Postman Collection**
1. Open Postman
2. Click **Import** button
3. Select the file: `Postman_Collection_All_APIs.json`
4. Click **Import**

### **2. Set Environment Variables**
- **base_url**: `http://localhost:8034`
- **jwt_token**: (Will be auto-populated after login)

### **3. Start Python Application**
```bash
cd /Users/siddharthmishra/Desktop/Devyani/devyani_existing/python
source venv/bin/activate
python run.py
```

---

## **🔐 AUTHENTICATION FLOW**

### **Step 1: Register a User**
```json
POST /api/auth/register
{
  "username": "testuser",
  "email": "test@example.com",
  "password": "test123",
  "first_name": "Test",
  "last_name": "User"
}
```

### **Step 2: Login to Get JWT Token**
```json
POST /api/auth/login
{
  "username": "testuser",
  "password": "test123"
}
```
**Response will contain JWT token - save this for other requests!**

---

## **📊 API TESTING CATEGORIES**

### **🔐 1. AUTHENTICATION APIs (8 endpoints)**

| API | Method | Endpoint | Description |
|-----|--------|----------|-------------|
| Register | POST | `/api/auth/register` | User registration |
| Login | POST | `/api/auth/login` | User authentication |
| Login Alias | POST | `/api/auth/auth/access/token` | Alternative login |
| Update Subscriptions | POST | `/api/auth/update_subscriptions` | Update user subscriptions |
| Forgot Password | POST | `/api/auth/end_user/forgot_password` | Request password reset |
| Verify OTP | POST | `/api/auth/end_user/verify_otp` | Verify OTP code |
| Reset Password | POST | `/api/auth/end_user/reset_password` | Reset user password |
| Verify Token | POST | `/api/auth/verify-token` | Verify JWT token |

### **👥 2. USER MANAGEMENT APIs (7 endpoints)**

| API | Method | Endpoint | Description |
|-----|--------|----------|-------------|
| Create User | POST | `/api/user/createUser` | Create new user |
| Update User | POST | `/api/user/updateUser` | Update user details |
| Delete User | POST | `/api/user/deleteUser` | Delete user |
| Update Password | POST | `/api/user/updatePassword` | Change user password |
| Get All Users | POST | `/api/user/getAllUsers` | Get users by organization |
| Get User Modules | POST | `/api/user/getUserModules` | Get user's modules |
| Update User Module Mapping | POST | `/api/user/updateUserModuleMapping` | Update user permissions |

### **🏢 3. ORGANIZATION MANAGEMENT APIs (8 endpoints)**

| API | Method | Endpoint | Description |
|-----|--------|----------|-------------|
| Create Organization | POST | `/api/organization/create` | Create new organization |
| Get All Organizations | GET | `/api/organization/all` | Get all organizations |
| Update Organization | POST | `/api/organization/update` | Update organization |
| Delete Organization | DELETE | `/api/organization/delete` | Delete organization |
| Assign Tools | POST | `/api/organization/tools/assign` | Assign tools to org |
| Get Organization Tools | GET | `/api/organization/tools/{id}` | Get org's tools |
| Get Dashboard Stats | POST | `/api/organization/dashboard` | Get dashboard statistics |
| Get Organization Modules | POST | `/api/organization/getOrganizationModules` | Get org's modules |
| Update Organization Modules | POST | `/api/organization/updateOrganizationModules` | Update org permissions |

### **🛠️ 4. TOOL MANAGEMENT APIs (5 endpoints)**

| API | Method | Endpoint | Description |
|-----|--------|----------|-------------|
| Create Tool | POST | `/api/tool/createTool` | Create new tool |
| Get All Tools | GET | `/api/tool/getAllTools` | Get all tools |
| Get Tool By ID | GET | `/api/tool/getToolById` | Get specific tool |
| Update Tool | POST | `/api/tool/updateTool` | Update tool details |
| Delete Tool | POST | `/api/tool/deleteTool` | Delete tool |

### **📦 5. MODULE MANAGEMENT APIs (3 endpoints)**

| API | Method | Endpoint | Description |
|-----|--------|----------|-------------|
| Create Module | POST | `/api/module/createModule` | Create new module |
| Get All Modules | POST | `/api/module/getAllModules` | Get modules by tool |
| Delete Module | POST | `/api/module/deleteModule` | Delete module |

### **👥 6. GROUP MANAGEMENT APIs (5 endpoints)**

| API | Method | Endpoint | Description |
|-----|--------|----------|-------------|
| Create Group | POST | `/api/group/createGroup` | Create new group |
| Get All Groups | POST | `/api/group/getAllGroups` | Get groups by tool/org |
| Get Group Modules | POST | `/api/group/getGroupModules` | Get group's modules |
| Update Group Module Mapping | POST | `/api/group/updateGroupModuleMapping` | Update group permissions |
| Delete Group | POST | `/api/group/deleteGroup` | Delete group |

### **🔑 7. PERMISSION MANAGEMENT APIs (3 endpoints)**

| API | Method | Endpoint | Description |
|-----|--------|----------|-------------|
| Create Permission | POST | `/api/permission/createPermission` | Create new permission |
| Get All Permissions | POST | `/api/permission/getAllPermissions` | Get permissions by module |
| Delete Permission | POST | `/api/permission/deletePermission` | Delete permission |

### **📝 8. AUDIT LOG APIs (3 endpoints)**

| API | Method | Endpoint | Description |
|-----|--------|----------|-------------|
| Create Audit Log | POST | `/api/audit_log/create` | Create audit log entry |
| Get Audit Logs | POST | `/api/audit_log/list` | Get filtered audit logs |
| Get All Organization Users | GET | `/api/audit_log/user/list` | Get org users for audit |

### **📊 9. RECONCILIATION APIs (11 endpoints)**

| API | Method | Endpoint | Description |
|-----|--------|----------|-------------|
| Check Reconciliation Status | GET | `/api/node/reconciliation/populate-threepo-dashboard` | Check reconciliation status |
| Generate Reconciliation Excel | POST | `/api/node/reconciliation/generate-excel` | Generate reconciliation report |
| Generate Receivable Receipt Excel | POST | `/api/node/reconciliation/generate-receivable-receipt-excel` | Generate receivable report |
| Check Generation Status | POST | `/api/node/reconciliation/generation-status` | Check report generation status |
| Get 3PO Dashboard Data | POST | `/api/node/reconciliation/threePODashboardData` | Get 3PO dashboard data |
| Get Instore Dashboard Data | POST | `/api/node/reconciliation/instore-data` | Get instore dashboard data |
| Generate Common TRM | POST | `/api/node/reconciliation/generate-common-trm` | Generate common TRM |
| Download File | GET | `/api/node/reconciliation/download/{filename}` | Download generated file |
| Get All Cities | GET | `/api/node/reconciliation/cities` | Get all cities |
| Get Stores by Cities | POST | `/api/node/reconciliation/stores` | Get stores by city IDs |
| Get Missing Store Mappings | GET | `/api/node/reconciliation/public/threepo/missingStoreMappings` | Get missing store mappings |

### **📁 10. FILE UPLOAD APIs (4 endpoints)**

| API | Method | Endpoint | Description |
|-----|--------|----------|-------------|
| Upload Files | POST | `/api/uploader/upload` | Upload multiple files |
| Get Upload Status | GET | `/api/uploader/status/{upload_id}` | Get upload status |
| Get All Uploads | GET | `/api/uploader/uploads` | Get uploads with pagination |
| Delete Upload | DELETE | `/api/uploader/uploads/{upload_id}` | Delete upload record |

### **📈 11. SHEET DATA APIs (3 endpoints)**

| API | Method | Endpoint | Description |
|-----|--------|----------|-------------|
| Generate Sheet Data | POST | `/api/sheetData/generate` | Generate sheet data |
| Get Sheet Data Status | GET | `/api/sheetData/status/{job_id}` | Get generation status |
| Get Sheet Data | GET | `/api/sheetData/data` | Get sheet data by filters |

### **🔧 12. SYSTEM APIs (3 endpoints)**

| API | Method | Endpoint | Description |
|-----|--------|----------|-------------|
| Health Check | GET | `/health` | Application health status |
| API Documentation | GET | `/api-docs` | Swagger UI documentation |
| OpenAPI Schema | GET | `/openapi.json` | OpenAPI JSON schema |

---

## **🧪 TESTING WORKFLOW**

### **Phase 1: Basic Setup**
1. **Health Check** - Verify application is running
2. **Register User** - Create test user
3. **Login** - Get JWT token
4. **Verify Token** - Confirm authentication works

### **Phase 2: Core CRUD Operations**
1. **Create Organization** - Set up test organization
2. **Create Tool** - Set up test tool
3. **Create Module** - Set up test module
4. **Create Group** - Set up test group
5. **Create Permission** - Set up test permission

### **Phase 3: User Management**
1. **Create User** - Add users to organization
2. **Update User** - Modify user details
3. **Get All Users** - List organization users
4. **Update User Module Mapping** - Assign permissions

### **Phase 4: Advanced Features**
1. **File Upload** - Test file upload functionality
2. **Reconciliation** - Test reconciliation endpoints
3. **Sheet Data** - Test sheet data generation
4. **Audit Logs** - Test audit logging

### **Phase 5: Cleanup**
1. **Delete Test Data** - Remove created test records
2. **Verify Cleanup** - Confirm data removal

---

## **🔍 EXPECTED RESPONSES**

### **✅ Success Responses:**
- **200 OK**: Successful operations
- **201 Created**: Resource creation
- **JWT Token**: Authentication success
- **JSON Data**: Structured response data

### **⚠️ Expected Errors:**
- **401 Unauthorized**: Invalid or missing token
- **400 Bad Request**: Invalid request data
- **404 Not Found**: Resource not found
- **500 Internal Server Error**: Server-side issues

### **📊 Response Formats:**
```json
// Success Response
{
  "message": "Operation successful",
  "status": 200,
  "data": [...]
}

// Error Response
{
  "detail": "Error description"
}

// JWT Response
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {...}
}
```

---

## **🚨 TROUBLESHOOTING**

### **Common Issues:**

#### **1. Authentication Errors**
- **Problem**: `401 Unauthorized`
- **Solution**: Ensure JWT token is valid and included in Authorization header
- **Check**: Token format: `Bearer <token>`

#### **2. Database Errors**
- **Problem**: `500 Internal Server Error`
- **Solution**: Check database connection and table existence
- **Check**: Run database migrations if needed

#### **3. Validation Errors**
- **Problem**: `422 Validation Error`
- **Solution**: Check request body format and required fields
- **Check**: Ensure all required fields are provided

#### **4. File Upload Errors**
- **Problem**: File upload fails
- **Solution**: Check file size limits and supported formats
- **Check**: Ensure multipart/form-data content type

---

## **📈 PERFORMANCE TESTING**

### **Load Testing:**
1. **Concurrent Users**: Test with multiple simultaneous requests
2. **Large Datasets**: Test with large amounts of data
3. **File Uploads**: Test with large files
4. **Database Queries**: Monitor query performance

### **Monitoring:**
- **Response Times**: Monitor API response times
- **Memory Usage**: Check application memory consumption
- **Database Performance**: Monitor database query performance
- **Error Rates**: Track error rates and types

---

## **✅ SUCCESS CRITERIA**

### **All APIs Should:**
- ✅ **Respond within 5 seconds**
- ✅ **Return proper HTTP status codes**
- ✅ **Include appropriate error messages**
- ✅ **Handle authentication correctly**
- ✅ **Validate input data**
- ✅ **Return consistent response formats**

### **Authentication Should:**
- ✅ **Generate valid JWT tokens**
- ✅ **Verify tokens correctly**
- ✅ **Protect authenticated endpoints**
- ✅ **Handle token expiration**

### **Database Operations Should:**
- ✅ **Create records successfully**
- ✅ **Update records correctly**
- ✅ **Delete records properly**
- ✅ **Handle relationships correctly**

---

## **🎯 TESTING CHECKLIST**

### **Pre-Testing:**
- [ ] Python application is running
- [ ] Database connections are working
- [ ] Postman collection is imported
- [ ] Environment variables are set

### **Authentication Testing:**
- [ ] User registration works
- [ ] User login returns JWT token
- [ ] JWT token is valid
- [ ] Protected endpoints require authentication

### **CRUD Operations:**
- [ ] Create operations work
- [ ] Read operations return data
- [ ] Update operations modify data
- [ ] Delete operations remove data

### **Advanced Features:**
- [ ] File upload works
- [ ] Excel generation works
- [ ] Background tasks work
- [ ] Audit logging works

### **Error Handling:**
- [ ] Invalid requests return proper errors
- [ ] Authentication errors are handled
- [ ] Database errors are caught
- [ ] Validation errors are clear

---

## **📞 SUPPORT**

### **If Issues Occur:**
1. **Check Application Logs**: Look for error messages
2. **Verify Database**: Ensure tables exist and are accessible
3. **Test Individual Components**: Isolate the problem
4. **Check Dependencies**: Ensure all packages are installed
5. **Review Configuration**: Verify settings are correct

### **Common Solutions:**
- **Restart Application**: `python run.py`
- **Check Database**: Verify connections and tables
- **Update Dependencies**: `pip install -r requirements.txt`
- **Clear Cache**: Remove temporary files
- **Check Permissions**: Ensure proper file/database permissions

---

## **🎉 CONCLUSION**

This comprehensive testing guide covers all 47 APIs converted from Node.js to Python FastAPI. The Postman collection provides ready-to-use requests with proper authentication, headers, and payloads.

**Happy Testing! 🚀**
