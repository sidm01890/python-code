# FeynmanFlow API Deployment Guide

This is the Data Processing API service that handles Excel file uploads and vector-based column matching.

## Quick Start

### Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# Start the server
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Docker

```bash
# Build and run
docker build -t feynmanflow-api .
docker run -p 8000:8000 --env-file .env feynmanflow-api
```

## Port

- **Default Port**: 8000
- **Health Check**: `GET /`

## Environment Variables

Create a `.env` file with:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=devyani

# AstraDB Configuration (for vector matching)
ASTRA_DB_APPLICATION_TOKEN=your_token
ASTRA_DB_API_ENDPOINT=https://your-endpoint
ASTRA_DB_KEYSPACE=your_keyspace
```

## API Endpoints

- `GET /` - Health check
- `POST /upload/vector-match-excel` - Upload Excel file for processing
- `POST /api/column-alias` - Add column alias mapping
- `GET /admin/canonical-sets` - List canonical column sets
- `GET /debug/canonical-columns` - Debug column mapping
- `GET /diagnose-upload-api` - Diagnostic endpoint
- `GET /docs` - Swagger documentation

## Integration with Main Backend

This service is used by the Python backend (`python/app/routes/uploader.py`) as a proxy service for certain data sources.

Configure the connection in Python backend's `.env`:
```env
FEYNMANFLOW_API_URL=http://localhost:8000
```

## Deployment

See main `DEPLOYMENT_GUIDE.md` for deployment options including:
- LocalTunnel (quick testing)
- Railway.app
- Render.com
- Docker Compose
- VPS deployment

