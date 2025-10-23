# FastAPI Reconcii Admin Backend

A Python FastAPI application that mirrors the functionality of the Node.js Reconcii Admin Backend.

## Features

- **Dual Database Architecture**: Separate SSO and Main databases
- **JWT Authentication**: Secure token-based authentication
- **RESTful API**: Complete API with automatic documentation
- **File Processing**: Excel and CSV file handling
- **Background Tasks**: Scheduled jobs and async processing
- **Docker Support**: Containerized deployment

## Project Structure

```
python/
├── app/
│   ├── config/          # Configuration files
│   ├── models/          # Database models
│   │   ├── sso/        # SSO database models
│   │   └── main/       # Main database models
│   ├── routes/         # API routes
│   ├── middleware/     # Authentication middleware
│   ├── utils/          # Utility functions
│   └── main.py         # FastAPI application
├── requirements.txt    # Python dependencies
├── Dockerfile         # Docker configuration
├── docker-compose.yml # Docker Compose setup
└── run.py            # Application startup script
```

## Quick Start

### 1. Environment Setup

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Environment Configuration

Copy the example environment file and configure:

```bash
cp env.example .env
# Edit .env with your database credentials
```

### 3. Database Setup

The application uses two MySQL databases:
- **SSO Database**: User authentication and management
- **Main Database**: Application data and business logic

### 4. Run the Application

```bash
# Development mode
python run.py

# Or using uvicorn directly
uvicorn app.main:app --host 0.0.0.0 --port 8034 --reload
```

### 5. Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up --build

# Run in background
docker-compose up -d
```

## API Documentation

Once the application is running, access the interactive API documentation:

- **Swagger UI**: http://localhost:8034/api-docs
- **ReDoc**: http://localhost:8034/redoc

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/verify-token` - Token verification

### User Management
- `GET /api/user/` - Get all users
- `GET /api/user/{user_id}` - Get user by ID
- `PUT /api/user/{user_id}` - Update user
- `DELETE /api/user/{user_id}` - Delete user

### Other Endpoints
- `GET /api/organization/` - Organizations
- `GET /api/tool/` - Tools
- `GET /api/module/` - Modules
- `GET /api/group/` - Groups
- `GET /api/permission/` - Permissions
- `GET /api/audit_log/` - Audit logs
- `GET /api/node/reconciliation/` - Reconciliation
- `POST /api/uploader/upload` - File upload

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|------------|---------|
| `ENVIRONMENT` | Environment (development/production) | development |
| `DEBUG` | Debug mode | true |
| `PORT` | Server port | 8034 |
| `JWT_SECRET` | JWT secret key | - |
| `SSO_DB_HOST` | SSO database host | localhost |
| `MAIN_DB_HOST` | Main database host | localhost |

### Database Configuration

The application supports both local and production database configurations:

- **Development**: Local MySQL databases
- **Production**: AWS RDS MySQL databases

## Development

### Adding New Models

1. Create model in appropriate directory (`app/models/sso/` or `app/models/main/`)
2. Add CRUD operations
3. Create corresponding routes
4. Update database schema

### Adding New Routes

1. Create route file in `app/routes/`
2. Implement endpoints with proper authentication
3. Add to main application router
4. Update API documentation

## Testing

```bash
# Run tests
pytest

# Run with coverage
pytest --cov=app
```

## Deployment

### Production Environment

1. Set `ENVIRONMENT=production` in environment variables
2. Configure production database credentials
3. Set secure JWT secrets
4. Use proper CORS settings
5. Enable HTTPS

### Docker Production

```bash
# Build production image
docker build -t reconcii-admin-api .

# Run with production settings
docker run -d \
  --name reconcii-api \
  -p 8034:8034 \
  -e ENVIRONMENT=production \
  -e JWT_SECRET=your-secret \
  reconcii-admin-api
```

## Security Considerations

- Use strong JWT secrets in production
- Implement proper CORS policies
- Use HTTPS in production
- Regular security updates
- Database connection encryption
- Input validation and sanitization

## Monitoring

- Health check endpoint: `/health`
- Application logs
- Database connection monitoring
- Performance metrics

## Contributing

1. Follow PEP 8 style guidelines
2. Add type hints to all functions
3. Write tests for new features
4. Update documentation
5. Use meaningful commit messages
