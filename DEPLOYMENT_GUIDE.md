# Deployment Guide - Exposing Frontend and Backend APIs

This guide provides multiple options to expose your Devyani Reconciliation application for end-to-end testing.

## 📋 Current Architecture

- **Frontend**: React (Vite) - Port 3012
- **Python Backend**: FastAPI - Port 8034
- **Node.js Backend**: Express - Port 8080
- **FeynmanFlow API**: FastAPI (Data Processing) - Port 8000

---

## 🚀 Option 1: Quick Testing with Tunneling Services (Recommended for Quick Demos)

### A. Using LocalTunnel (Already in dependencies)

**Advantages**: Free, No signup required, Quick setup

#### Setup Steps:

1. **Start all services locally:**
   ```bash
   # Terminal 1: Start Python Backend
   cd python
   python run.py
   
   # Terminal 2: Start Node.js Backend
   cd reconcii_admin_backend-devyani_poc
   npm start
   
   # Terminal 3: Start Frontend
   cd reconcii-devyani_poc
   npm run dev
   ```

2. **Expose services with LocalTunnel:**
   ```bash
   # Install localtunnel globally if needed
   npm install -g localtunnel
   
   # Expose Python Backend (port 8034)
   lt --port 8034 --subdomain devyani-python-api
   
   # Expose Node.js Backend (port 8080)
   lt --port 8080 --subdomain devyani-node-api
   
   # Expose FeynmanFlow API (port 8000)
   lt --port 8000 --subdomain devyani-feynmanflow-api
   
   # Expose Frontend (port 3012)
   lt --port 3012 --subdomain devyani-frontend
   ```

3. **Update Frontend API Endpoints:**
   Update `reconcii-devyani_poc/src/ServiceRequest/APIEndPoints.js` to use tunnel URLs:
   ```javascript
   const baseURL = "https://devyani-python-api.loca.lt";
   const ssoBaseURL = "https://devyani-python-api.loca.lt";
   const reconciiBaseURL = "https://devyani-python-api.loca.lt";
   const reconciiAdminBaseURL = "https://devyani-node-api.loca.lt";
   ```

### B. Using ngrok (More Stable)

**Advantages**: More reliable, Custom domains (paid), Better for demos

#### Setup Steps:

1. **Install ngrok:**
   ```bash
   # macOS
   brew install ngrok
   
   # Or download from https://ngrok.com/download
   ```

2. **Sign up and get auth token:**
   ```bash
   ngrok config add-authtoken YOUR_AUTH_TOKEN
   ```

3. **Start tunnels:**
   ```bash
   # Terminal 1: Python Backend
   ngrok http 8034
   
   # Terminal 2: Node.js Backend
   ngrok http 8080
   
   # Terminal 3: Frontend
   ngrok http 3012
   ```

4. **Update API endpoints with ngrok URLs**

**Note**: Free ngrok URLs change on each restart. For stable URLs, use ngrok paid plan.

---

## 🌐 Option 2: Cloud Platform Deployment (Recommended for Production Testing)

### A. Railway.app (Easiest - Free Tier Available)

**Advantages**: 
- Free tier with 500 hours/month
- Auto-deployment from GitHub
- HTTPS included
- Database included

#### Setup Steps:

1. **Create railway.json for each service:**

   **Frontend (railway.json in reconcii-devyani_poc):**
   ```json
   {
     "$schema": "https://railway.app/railway.schema.json",
     "build": {
       "builder": "NIXPACKS"
     },
     "deploy": {
       "startCommand": "npm run preview",
       "restartPolicyType": "ON_FAILURE",
       "restartPolicyMaxRetries": 10
     }
   }
   ```

   **Python Backend (railway.json in python):**
   ```json
   {
     "$schema": "https://railway.app/railway.schema.json",
     "build": {
       "builder": "NIXPACKS"
     },
     "deploy": {
       "startCommand": "python run.py",
       "restartPolicyType": "ON_FAILURE",
       "restartPolicyMaxRetries": 10
     }
   }
   ```

   **Node.js Backend (railway.json in reconcii_admin_backend-devyani_poc):**
   ```json
   {
     "$schema": "https://railway.app/railway.schema.json",
     "build": {
       "builder": "NIXPACKS"
     },
     "deploy": {
       "startCommand": "npm start",
       "restartPolicyType": "ON_FAILURE",
       "restartPolicyMaxRetries": 10
     }
   }
   ```

2. **Deploy to Railway:**
   - Sign up at https://railway.app
   - Create new project
   - Deploy from GitHub repo or connect each service
   - Railway automatically detects and deploys

3. **Configure environment variables** in Railway dashboard for each service

4. **Update frontend API endpoints** with Railway URLs

### B. Render.com (Free Tier Available)

**Advantages**: 
- Free tier for web services
- PostgreSQL included
- Auto-deploy from GitHub

#### Setup Steps:

1. **Create render.yaml in project root:**
   ```yaml
   services:
     - type: web
       name: devyani-frontend
       env: static
       buildCommand: cd reconcii-devyani_poc && npm install && npm run build
       staticPublishPath: reconcii-devyani_poc/dist
       envVars:
         - key: NODE_ENV
           value: production
   
     - type: web
       name: devyani-python-api
       env: python
       buildCommand: cd python && pip install -r requirements.txt
       startCommand: cd python && python run.py
       envVars:
         - key: PORT
           value: 8034
         - key: ENVIRONMENT
           value: production
   
     - type: web
       name: devyani-node-api
       env: node
       buildCommand: cd reconcii_admin_backend-devyani_poc && npm install
       startCommand: cd reconcii_admin_backend-devyani_poc && npm start
       envVars:
         - key: PORT
           value: 8080
         - key: NODE_ENV
           value: production
   ```

2. **Deploy to Render:**
   - Sign up at https://render.com
   - Connect GitHub repo
   - Render will auto-detect and deploy services

### C. Fly.io (Free Tier Available)

**Advantages**: 
- Generous free tier
- Global edge network
- Docker-based deployment

#### Setup Steps:

1. **Install Fly CLI:**
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Create Dockerfile for each service** (already exists for Python)

3. **Initialize and deploy:**
   ```bash
   # For Python Backend
   cd python
   fly launch
   
   # For Node.js Backend
   cd reconcii_admin_backend-devyani_poc
   fly launch
   
   # For Frontend (create Dockerfile first)
   cd reconcii-devyani_poc
   fly launch
   ```

---

## 🐳 Option 3: Docker Compose Deployment (Self-Hosted)

Create a comprehensive docker-compose setup for all services:

### Setup Steps:

1. **Create docker-compose.yml in project root** (see below)
2. **Build and run:**
   ```bash
   docker-compose up -d
   ```
3. **Expose via reverse proxy (nginx) or cloud VPS**

---

## 📦 Option 4: VPS Deployment (DigitalOcean, AWS EC2, etc.)

**Advantages**: 
- Full control
- Scalable
- Custom domains

### Setup Steps:

1. **Provision VPS** (Ubuntu 22.04 recommended)
2. **Install dependencies:**
   ```bash
   sudo apt update
   sudo apt install docker docker-compose nginx certbot python3-certbot-nginx
   ```
3. **Clone repository and setup services**
4. **Configure Nginx reverse proxy**
5. **Setup SSL with Let's Encrypt**

---

## 📝 Quick Start: Complete Docker Compose Setup

I'll create a comprehensive docker-compose file that includes all services. Would you like me to create this?

---

## 🔐 Security Considerations

When exposing APIs publicly:

1. **Enable CORS properly** (only allow your frontend domain)
2. **Use environment variables** for sensitive data
3. **Enable rate limiting**
4. **Use HTTPS** (SSL certificates)
5. **Implement authentication** (JWT already in place)
6. **Hide sensitive endpoints** behind authentication
7. **Use API keys** for public endpoints if needed

---

## 🧪 Testing Checklist

After deployment:

- [ ] Frontend loads correctly
- [ ] Python API health check: `/health`
- [ ] Node.js API responds
- [ ] Frontend can authenticate
- [ ] API endpoints are accessible
- [ ] CORS is configured correctly
- [ ] File uploads work
- [ ] Database connections work

---

## 📞 Next Steps

**For Quick Demo** (Today):
→ Use LocalTunnel or ngrok (Option 1)

**For Extended Testing** (This Week):
→ Use Railway or Render (Option 2)

**For Production** (Long-term):
→ Use VPS with Docker Compose (Option 4)

Would you like me to:
1. Create the complete docker-compose.yml file?
2. Set up Railway/Render configurations?
3. Create Nginx reverse proxy configuration?
4. Set up a tunneling script for easy testing?

