# ngrok Setup Guide

## Why ngrok?

- ✅ **No password required** - Direct access for all users
- ✅ **More reliable** - Better uptime than LocalTunnel
- ✅ **Web interface** - View requests at http://localhost:4040
- ✅ **Request inspection** - See all traffic in real-time
- ⚠️ **Note**: Free tier URLs change on restart. Paid plans offer fixed domains.

---

## Step 1: Install ngrok

### macOS:
```bash
brew install ngrok
```

### Or Download:
1. Visit: https://ngrok.com/download
2. Download for your OS
3. Extract and move to `/usr/local/bin/` (or add to PATH)

### Verify Installation:
```bash
ngrok version
```

---

## Step 2: Sign Up & Authenticate

1. **Sign up** at https://ngrok.com (free account)
2. **Get your auth token** from the dashboard (https://dashboard.ngrok.com/get-started/your-authtoken)
3. **Authenticate**:
   ```bash
   ngrok config add-authtoken YOUR_AUTH_TOKEN
   ```

You only need to do this once!

---

## Step 3: Expose Services

### Option A: Use the Script (Recommended)

```bash
./expose-ngrok.sh
```

This will automatically expose all 4 services:
- Frontend (port 3012)
- Python API (port 8034)
- Node.js API (port 8080)
- FeynmanFlow API (port 8000)

### Option B: Manual (One Service at a Time)

Open **separate terminals** for each service:

```bash
# Terminal 1 - Frontend
ngrok http 3012

# Terminal 2 - Python API
ngrok http 8034

# Terminal 3 - Node.js API
ngrok http 8080

# Terminal 4 - FeynmanFlow API
ngrok http 8000
```

Each will show a URL like: `https://abc123.ngrok-free.app`

---

## Step 4: Update Frontend API Endpoints

Edit `reconcii-devyani_poc/src/ServiceRequest/APIEndPoints.js`:

```javascript
// Replace localhost URLs with ngrok URLs
const baseURL = "https://your-python-api.ngrok-free.app";
const ssoBaseURL = "https://your-python-api.ngrok-free.app";
const reconciiBaseURL = "https://your-python-api.ngrok-free.app";
const reconciiAdminBaseURL = "https://your-node-api.ngrok-free.app";
```

---

## Step 5: Access ngrok Dashboard

While ngrok is running, visit:
```
http://localhost:4040
```

This shows:
- All active tunnels
- Request/response inspection
- Replay requests
- Traffic analysis

---

## 🆚 ngrok vs LocalTunnel Comparison

| Feature | ngrok | LocalTunnel |
|---------|-------|-------------|
| **Password Required** | ❌ No | ✅ Yes |
| **Reliability** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Web Interface** | ✅ Yes | ❌ No |
| **Request Inspection** | ✅ Yes | ❌ No |
| **Free Tier** | ✅ Yes | ✅ Yes |
| **Fixed URLs (Free)** | ❌ No | ❌ No |
| **Fixed URLs (Paid)** | ✅ Yes | ❌ No |

---

## 💡 Pro Tips

1. **Keep terminal open**: ngrok tunnels run in the foreground. Use the script for background tunnels.

2. **Inspect requests**: Use http://localhost:4040 to debug API calls

3. **Fixed domains**: For production, consider ngrok paid plan ($8/month) for fixed domains

4. **Multiple services**: The script handles all services automatically

5. **Webhook testing**: ngrok is great for testing webhooks (no password blocking!)

---

## 🐛 Troubleshooting

### "ngrok: command not found"
- Install ngrok: `brew install ngrok`
- Or download from https://ngrok.com/download

### "authtoken required"
- Sign up at https://ngrok.com
- Get token from dashboard
- Run: `ngrok config add-authtoken YOUR_TOKEN`

### "tunnel session failed"
- Check if port is already in use
- Make sure your service is running on that port
- Check ngrok status at http://localhost:4040

### URLs keep changing
- This is normal on free tier
- Consider ngrok paid plan for fixed domains
- Or use Railway/Render for permanent URLs

---

## 📋 Quick Reference

```bash
# Install
brew install ngrok

# Authenticate (one time)
ngrok config add-authtoken YOUR_TOKEN

# Expose all services
./expose-ngrok.sh

# Or expose one service
ngrok http 3012

# View dashboard
open http://localhost:4040
```

---

## ✅ Benefits for Your Use Case

- **No password hassle** - Testers can access immediately
- **Professional** - Better for demos and client presentations
- **Debugging** - See all API requests in real-time
- **Reliable** - Better uptime than LocalTunnel

Ready to go! Run `./expose-ngrok.sh` to get started! 🚀

