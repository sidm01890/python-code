# Devyani Services Overview

## 🏗️ Complete Architecture

Your application consists of **4 main services**:

| Service | Technology | Port | Purpose |
|---------|-----------|------|---------|
| **Frontend** | React (Vite) | 3012 | User interface |
| **Python Backend** | FastAPI | 8034 | Main API, Auth, Reconciliation |
| **Node.js Backend** | Express | 8080 | Admin API, Reconciliation endpoints |
| **FeynmanFlow API** | FastAPI | 8000 | Data processing, Excel uploads, Vector matching |

---

## 🔗 Service Relationships

```
Frontend (3012)
    ↓
    ├──→ Python API (8034) ──→ FeynmanFlow API (8000)
    │       ├──→ Auth & SSO
    │       ├──→ Reconciliation
    │       └──→ File Upload (proxies to FeynmanFlow)
    │
    └──→ Node.js API (8080)
            └──→ Reconciliation endpoints
```

### Key Integration Points:

1. **Python Backend → FeynmanFlow**: 
   - When upload requests include `datasource` parameter, Python backend proxies to FeynmanFlow
   - Configure via `FEYNMANFLOW_API_URL` in Python backend's `.env`

2. **All Services → Databases**:
   - MySQL SSO (Authentication database)
   - MySQL Main (Application data)
   - Redis (Caching)

---

## 🚀 Quick Start Commands

### Start All Services Locally:

```bash
# Terminal 1 - Python Backend
cd python && python run.py

# Terminal 2 - Node.js Backend
cd reconcii_admin_backend-devyani_poc && npm start

# Terminal 3 - FeynmanFlow API
cd FeynmanFlow-finance-0.1 && uvicorn app.main:app --host 0.0.0.0 --port 8000

# Terminal 4 - Frontend
cd reconcii-devyani_poc && npm run dev
```

### Expose All Services (LocalTunnel):

```bash
./expose-services.sh
```

This will expose all 4 services and display their public URLs.

---

## 📋 Health Check Endpoints

Test if services are running:

- **Frontend**: `http://localhost:3012`
- **Python API**: `http://localhost:8034/health`
- **Node.js API**: `http://localhost:8080/health`
- **FeynmanFlow API**: `http://localhost:8000/`

---

## 🔧 Configuration Files

- **Docker Compose**: `docker-compose.all.yml` (all 4 services)
- **LocalTunnel Script**: `expose-services.sh`
- **Nginx Config**: `nginx.proxy.conf` (VPS deployment)
- **Railway Config**: `railway.json`
- **Render Config**: `render.yaml`

---

## 📚 Documentation

- **Quick Start**: `QUICK_START.md` - Get started in 2 minutes
- **Full Guide**: `DEPLOYMENT_GUIDE.md` - All deployment options
- **Comparison**: `DEPLOYMENT_COMPARISON.md` - Choose the best option
- **FeynmanFlow**: `FeynmanFlow-finance-0.1/README_DEPLOYMENT.md`

---

## 🎯 Recommended Deployment Path

1. **Today**: Use `expose-services.sh` for immediate testing
2. **This Week**: Deploy to Railway.app for stable testing
3. **Production**: Use Docker Compose on VPS

All services work together seamlessly! 🚀

