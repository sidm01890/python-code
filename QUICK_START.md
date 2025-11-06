# 🚀 Quick Start - Expose Your Services

Choose the fastest method for your needs:

## ⚡ Option 1: LocalTunnel (Fastest - 2 minutes)

**Best for**: Quick demos, immediate testing

### Steps:

1. **Start your services** (in separate terminals):
   ```bash
   # Terminal 1 - Python Backend
   cd python
   python run.py
   
   # Terminal 2 - Node.js Backend  
   cd reconcii_admin_backend-devyani_poc
   npm start
   
   # Terminal 3 - FeynmanFlow API (Data Processing)
   cd FeynmanFlow-finance-0.1
   uvicorn app.main:app --host 0.0.0.0 --port 8000
   
   # Terminal 4 - Frontend
   cd reconcii-devyani_poc
   npm run dev
   ```

2. **Run the expose script**:
   ```bash
   ./expose-services.sh
   ```

3. **Share access with testers**:
   - The script will display tunnel URLs and a **tunnel password** (your public IP)
   - Share both the URLs **and** the password with testers
   - They'll enter the password on first visit (valid for 7 days per IP)
   - See `LOCALTUNNEL_GUIDE.md` for detailed instructions

4. **Update API endpoints** in `reconcii-devyani_poc/src/ServiceRequest/APIEndPoints.js` with the tunnel URLs shown

**⚠️ Note**: LocalTunnel shows a security page requiring a password. This is normal! The password is your public IP address (automatically displayed by the script).

---

## 🌐 Option 2: ngrok (Most Reliable)

**Best for**: Stable demos, professional presentations

### Steps:

1. **Install ngrok**:
   ```bash
   brew install ngrok  # macOS
   # Or download from https://ngrok.com/download
   ```

2. **Authenticate** (sign up at ngrok.com):
   ```bash
   ngrok config add-authtoken YOUR_TOKEN
   ```

3. **Start tunnels** - Choose one:

   **Option A: Use the script (Recommended - all services at once):**
   ```bash
   ./expose-ngrok.sh
   ```

   **Option B: Manual (one service per terminal):**
   ```bash
   # Terminal 1 - Python API
   ngrok http 8034
   
   # Terminal 2 - Node.js API
   ngrok http 8080
   
   # Terminal 3 - FeynmanFlow API
   ngrok http 8000
   
   # Terminal 4 - Frontend
   ngrok http 3012
   ```

4. **Update API endpoints** with the ngrok URLs shown

**💡 Tip**: Visit http://localhost:4040 to see all tunnels and inspect requests!

---

## ☁️ Option 3: Railway (Free & Easy)

**Best for**: Longer-term testing, production-like environment

### Steps:

1. **Sign up** at https://railway.app (GitHub login)

2. **Create new project** → "Deploy from GitHub repo"

3. **Add four services**:
   - Connect `reconcii-devyani_poc` → Set build command: `npm install && npm run build`
   - Connect `python` → Set start command: `python run.py`
   - Connect `reconcii_admin_backend-devyani_poc` → Set start command: `npm start`
   - Connect `FeynmanFlow-finance-0.1` → Set start command: `uvicorn app.main:app --host 0.0.0.0 --port 8000`

4. **Configure environment variables** in Railway dashboard for each service

5. **Get public URLs** from Railway (HTTPS included!)

6. **Update frontend API endpoints** with Railway URLs

**Railway provides**: Free HTTPS, auto-deploy, database (optional)

---

## 🐳 Option 4: Docker Compose (Self-Hosted)

**Best for**: Full control, VPS deployment

### Steps:

1. **Update environment variables** in `docker-compose.all.yml`

2. **Build and start**:
   ```bash
   docker-compose -f docker-compose.all.yml up -d
   ```

3. **Access services**:
   - Frontend: http://localhost
   - Python API: http://localhost:8034
   - Node API: http://localhost:8080
   - FeynmanFlow API: http://localhost:8000

4. **Expose via VPS**: 
   - Deploy to DigitalOcean/AWS EC2
   - Use `nginx.proxy.conf` for reverse proxy
   - Setup SSL with Let's Encrypt

---

## 📋 Pre-Deployment Checklist

Before exposing publicly:

- [ ] All services start without errors
- [ ] Database connections work
- [ ] Environment variables are set
- [ ] CORS is configured for your frontend domain
- [ ] Sensitive endpoints are protected
- [ ] Health checks work: 
  - Python: `http://localhost:8034/health`
  - Node.js: `http://localhost:8080/health`
  - FeynmanFlow: `http://localhost:8000/`

---

## 🔐 Security Notes

1. **CORS**: Update backend CORS settings to only allow your frontend domain
2. **Environment Variables**: Never commit `.env` files
3. **API Keys**: Use strong secrets for JWT
4. **Rate Limiting**: Consider adding rate limiting for public APIs
5. **HTTPS**: Always use HTTPS in production (Railway/Render provide this)

---

## 🆘 Troubleshooting

### Services won't start?
- Check ports aren't already in use: `lsof -i :8034`, `lsof -i :8080`, `lsof -i :3012`
- Verify database connections
- Check environment variables

### CORS errors?
- Update CORS settings in:
  - Python: `python/app/main.py` (line 85)
  - Node.js: `reconcii_admin_backend-devyani_poc/app.js` (line 42)

### Tunnels not working?
- LocalTunnel: Try different subdomain names
- ngrok: Check authentication token is valid
- Check firewall isn't blocking ports

---

## 📞 Need Help?

Check `DEPLOYMENT_GUIDE.md` for detailed instructions for each option.

