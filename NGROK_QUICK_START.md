# 🚀 ngrok Quick Start (No Password!)

ngrok is already installed! Follow these 3 simple steps:

---

## Step 1: Authenticate (One-Time Setup)

If you haven't already:

1. **Sign up** (free): https://ngrok.com
2. **Get your token**: https://dashboard.ngrok.com/get-started/your-authtoken
3. **Authenticate**:
   ```bash
   ngrok config add-authtoken YOUR_TOKEN_HERE
   ```

---

## Step 2: Start All Services

```bash
./expose-ngrok.sh
```

That's it! The script will:
- ✅ Expose all 4 services automatically
- ✅ Show you all the public URLs
- ✅ No password required for anyone!

---

## Step 3: Update Frontend Configuration

Edit `reconcii-devyani_poc/src/ServiceRequest/APIEndPoints.js`:

Replace the URLs with the ngrok URLs shown by the script:

```javascript
const baseURL = "https://abc123.ngrok-free.app";  // Your Python API ngrok URL
const ssoBaseURL = "https://abc123.ngrok-free.app";
const reconciiBaseURL = "https://abc123.ngrok-free.app";
const reconciiAdminBaseURL = "https://xyz789.ngrok-free.app";  // Your Node API ngrok URL
```

---

## 🎉 That's It!

- **No passwords** - Anyone can access immediately
- **Web dashboard** - Visit http://localhost:4040 to see all requests
- **Request inspection** - Debug API calls in real-time

---

## 📋 Manual Method (If you prefer)

If you want to run tunnels manually in separate terminals:

```bash
# Terminal 1
ngrok http 3012  # Frontend

# Terminal 2
ngrok http 8034  # Python API

# Terminal 3
ngrok http 8080  # Node.js API

# Terminal 4
ngrok http 8000  # FeynmanFlow API
```

Each will show a URL like: `https://abc123.ngrok-free.app`

---

## ⚠️ Important Notes

1. **Keep terminal open**: ngrok runs in foreground. The script runs them in background.
2. **URLs change**: Free tier URLs change when you restart. For fixed URLs, upgrade to paid plan.
3. **Dashboard**: Visit http://localhost:4040 to see all active tunnels and inspect traffic.

---

## 🆘 Need Help?

- Full guide: `NGROK_SETUP.md`
- Troubleshooting: Check http://localhost:4040 for tunnel status

