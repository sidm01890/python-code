# LocalTunnel Access Guide

## 🔐 Understanding the Tunnel Password

LocalTunnel shows a security page on first visit to prevent abuse. This is **normal and expected**.

## 📋 Your Tunnel Password

Your tunnel password is your **public IP address**:

```
49.36.210.48
```

*(This is automatically fetched when you run `expose-services.sh`)*

## 🚀 How to Share Access

### For You (Developer):
1. Run `./expose-services.sh`
2. Note the tunnel password displayed (your public IP)
3. Share both the URLs **and** the password with testers

### For Testers:
1. Visit the shared URL (e.g., `https://devyani-frontend.loca.lt`)
2. On the security page, enter the tunnel password: `49.36.210.48`
3. Click "Submit" or "Access Website"
4. ✅ They're in! The app should load normally

**Note**: Each visitor will only see this password page **once per public IP every 7 days**.

---

## 🔄 Getting Your Tunnel Password

If you need to get it manually:

```bash
# Option 1: Command line
curl https://loca.lt/mytunnelpassword

# Option 2: In a browser
# Visit: https://loca.lt/mytunnelpassword
```

---

## ⚠️ Important Notes

1. **Tunnel Password = Your Public IP**: This is how LocalTunnel verifies you're the developer
2. **Once Per IP Per Week**: Visitors won't see the password page again for 7 days from the same IP
3. **Share Both**: Always share the URL AND the password with testers
4. **Browser Only**: This page only appears for standard web browsers, not API calls

---

## 🎯 Alternative Solutions

### If you want to avoid the password page:

1. **Use ngrok** (free tier, no password):
   ```bash
   ngrok http 3012  # For frontend
   ngrok http 8034  # For Python API
   # etc.
   ```

2. **Use Railway/Render** (production-ready, no password):
   - Deploy to Railway.app or Render.com
   - Get permanent HTTPS URLs
   - No password required

3. **Set Custom User-Agent** (for API testing):
   - API clients can bypass the page by setting a custom User-Agent header
   - Browsers will still see the page

---

## 🐛 Troubleshooting

### "Password page won't go away"
- Make sure you're entering your **public IP** (not localhost)
- Check if you're behind a VPN (password is VPN's public IP)
- Try visiting `https://loca.lt/mytunnelpassword` to confirm your IP

### "Tester can't access"
- Verify they're entering the correct password (your public IP)
- Check that your tunnels are still running
- Try refreshing the page

### "API calls are blocked"
- API calls with standard browser User-Agents will see the password page
- Use a custom User-Agent header in your API client
- Or switch to ngrok for API testing

---

## 💡 Pro Tips

1. **Document the password** in your testing instructions
2. **Use ngrok for demos** - more professional, no password
3. **Railway/Render for production** - permanent URLs, no password

---

## 📞 Quick Reference

**Your Current Tunnel Password**: `49.36.210.48`

Share this with anyone who needs to access your LocalTunnel URLs!

