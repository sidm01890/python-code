# Devyani Reconciliation API Testing Guide

## Overview
This guide provides comprehensive instructions for testing all API endpoints in the Devyani Reconciliation System using Postman.

## Setup Instructions

### 1. Import Postman Collection
1. Open Postman
2. Click "Import" button
3. Select the `Devyani_API_Postman_Collection.json` file
4. The collection will be imported with all endpoints organized by category

### 2. Environment Setup
The collection uses the following variables:
- `baseUrl`: Set to `http://localhost:8034` (default)
- `authToken`: Will be automatically set after successful login

### 3. Server Setup
Make sure your backend server is running:
```bash
cd reconcii_admin_backend-devyani_poc
npm start
# Server should run on port 8034
```

## API Endpoints Overview

### Authentication Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/register` | User registration |
| POST | `/api/auth/end_user/forgot_password` | Forgot password |
| POST | `/api/auth/end_user/verify_otp` | Verify OTP |
| POST | `/api/auth/end_user/reset_password` | Reset password |
| POST | `/api/auth/update_subscriptions` | Update subscriptions |

### User Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/user/createUser` | Create new user (Admin only) |
| POST | `/api/user/getAllUsers` | Get all users |
| POST | `/api/user/updateUser` | Update user (Admin only) |
| POST | `/api/user/deleteUser` | Delete user (Admin only) |
| POST | `/api/user/updatePassword` | Update user password |
| POST | `/api/user/updateUserModuleMapping` | Update user module mapping |
| POST | `/api/user/getUserModules` | Get user modules |

### Group Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/group/createGroup` | Create new group (Admin only) |
| POST | `/api/group/getAllGroups` | Get all groups |
| POST | `/api/group/getGroupModules` | Get group modules |
| POST | `/api/group/updateGroupModuleMapping` | Update group module mapping |
| POST | `/api/group/deleteGroup` | Delete group (Admin only) |

### Organization Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/organization/create` | Create organization |
| GET | `/api/organization/all` | Get all organizations |
| POST | `/api/organization/update` | Update organization |
| DELETE | `/api/organization/delete` | Delete organization |
| POST | `/api/organization/tools/assign` | Assign tools to organization |
| GET | `/api/organization/tools/:organization_id` | Get organization tools |
| POST | `/api/organization/dashboard` | Get dashboard stats |
| POST | `/api/organization/getOrganizationModules` | Get organization modules |
| POST | `/api/organization/updateOrganizationModules` | Update organization module mapping |

### File Upload & Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/uploader/upload` | Upload files (Excel/CSV) |
| GET | `/api/uploader/status/:uploadId` | Get upload status |
| GET | `/api/uploader/uploads` | Get all uploads |
| DELETE | `/api/uploader/uploads/:uploadId` | Delete upload |

### Reconciliation & Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reconciliation/populate-threepo-dashboard` | Populate ThreePO dashboard |
| POST | `/api/reconciliation/generate-excel` | Generate reconciliation Excel |
| POST | `/api/reconciliation/generate-receivable-receipt-excel` | Generate receivable vs receipt Excel |
| POST | `/api/reconciliation/generation-status` | Check generation status |
| POST | `/api/reconciliation/threePODashboardData` | Get ThreePO dashboard data |
| POST | `/api/reconciliation/instore-data` | Get instore dashboard data |
| POST | `/api/reconciliation/generate-common-trm` | Generate common TRM |
| GET | `/api/reconciliation/download/:filename` | Download generated file |
| GET | `/api/reconciliation/cities` | Get all cities |
| POST | `/api/reconciliation/stores` | Get stores by cities |
| GET | `/api/reconciliation/public/threepo/missingStoreMappings` | Get missing store mappings |

### Audit Logs
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/audit_log/create` | Create audit log |
| POST | `/api/audit_log/list` | Get audit logs |
| POST | `/api/audit_log/user/list` | Get user audit logs |

## Testing Workflow

### 1. Authentication Flow
1. **Login**: Use the "Login" request in the Authentication folder
   - Username: `admin` (or your test user)
   - Password: `password123` (or your test password)
   - The response will contain an `access_token` that will be automatically stored in the `authToken` variable

2. **Test Protected Endpoints**: All other endpoints require authentication
   - The collection is configured to automatically use the `authToken` variable
   - If you get 401 Unauthorized, make sure you've logged in first

### 2. User Management Testing
1. **Create User**: Test creating a new user (Admin only)
2. **Get All Users**: Verify user list
3. **Update User**: Test user updates
4. **Delete User**: Test user deletion (Admin only)

### 3. Group Management Testing
1. **Create Group**: Test group creation (Admin only)
2. **Get All Groups**: Verify group list
3. **Update Group Module Mapping**: Test module assignments
4. **Delete Group**: Test group deletion (Admin only)

### 4. Organization Management Testing
1. **Create Organization**: Test organization creation
2. **Get All Organizations**: Verify organization list
3. **Update Organization**: Test organization updates
4. **Assign Tools**: Test tool assignments
5. **Get Dashboard Stats**: Test dashboard functionality

### 5. File Upload Testing
1. **Upload Files**: Test file upload with Excel/CSV files
2. **Check Upload Status**: Monitor upload progress
3. **Get All Uploads**: List all uploads
4. **Delete Upload**: Test upload deletion

### 6. Reconciliation Testing
1. **Populate Dashboard**: Test dashboard population
2. **Generate Reports**: Test Excel generation
3. **Check Status**: Monitor generation progress
4. **Download Files**: Test file downloads
5. **Get Data**: Test data retrieval endpoints

## Sample Request Bodies

### Login Request
```json
{
  "username": "admin",
  "password": "password123"
}
```

### Create User Request
```json
{
  "username": "newuser",
  "email": "user@example.com",
  "password": "password123",
  "name": "New User",
  "role_name": 1,
  "organization_id": 1
}
```

### Generate Excel Request
```json
{
  "start_date": "2024-01-01",
  "end_date": "2024-01-31",
  "store_ids": [1, 2, 3]
}
```

### Upload File Request
- Method: POST
- Body: form-data
- Key: `files`
- Type: File
- Select your Excel/CSV file

## Common Response Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 429 | Too Many Requests |
| 500 | Internal Server Error |

## Error Handling

### Authentication Errors
- **401 Unauthorized**: Check if you're logged in and token is valid
- **403 Forbidden**: Check if user has required permissions (Admin role)

### Validation Errors
- **400 Bad Request**: Check request body format and required fields
- **422 Unprocessable Entity**: Check data validation rules

### Rate Limiting
- **429 Too Many Requests**: Wait before retrying
- OTP attempts are limited to 3 attempts
- OTP resend is limited to 3 times

## Tips for Testing

1. **Start with Authentication**: Always login first to get a valid token
2. **Test in Order**: Some endpoints depend on others (e.g., create user before updating)
3. **Check Responses**: Verify response structure and status codes
4. **Test Edge Cases**: Try invalid data, missing fields, etc.
5. **Monitor Logs**: Check server logs for detailed error information
6. **File Uploads**: Test with different file types and sizes
7. **Concurrent Requests**: Test multiple simultaneous requests

## Troubleshooting

### Common Issues
1. **Token Expired**: Re-login to get a new token
2. **CORS Errors**: Ensure server is running and CORS is configured
3. **File Upload Fails**: Check file size limits and file types
4. **Database Errors**: Check database connection and data integrity

### Debug Steps
1. Check server logs for detailed error messages
2. Verify request headers and body format
3. Test with different user roles and permissions
4. Check database constraints and relationships
5. Verify file paths and permissions for uploads

## Environment Variables

The collection uses these environment variables:
- `baseUrl`: API base URL (default: http://localhost:8034)
- `authToken`: JWT token for authentication (auto-set after login)

You can modify these in Postman's environment settings or collection variables.

## Additional Resources

- **Swagger Documentation**: Available at `http://localhost:8034/api-docs`
- **Server Logs**: Check console output for detailed request/response logs
- **Database**: Ensure database is properly configured and accessible
- **File Storage**: Check upload directory permissions

## Support

For issues or questions:
1. Check server logs for error details
2. Verify database connectivity
3. Test with different user accounts
4. Review API documentation in Swagger UI
