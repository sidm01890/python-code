#!/bin/bash

# Quick script to fix LocalTunnel password issues

echo "🔧 LocalTunnel Password Fixer"
echo "============================="
echo ""

# Kill all existing tunnels
echo "1. Killing existing tunnels..."
pkill -f "lt --port" 2>/dev/null
sleep 2
echo "✅ Old tunnels stopped"
echo ""

# Check multiple IP sources
echo "2. Checking your public IP from multiple sources..."
echo ""

IP1=$(curl -s https://loca.lt/mytunnelpassword 2>/dev/null)
IP2=$(curl -s ipinfo.io/ip 2>/dev/null)
IP3=$(curl -s ifconfig.me 2>/dev/null | head -1)

echo "   LocalTunnel's detected IP:  ${IP1:-'Could not fetch'}"
echo "   ipinfo.io says:             ${IP2:-'Could not fetch'}"
echo "   ifconfig.me says:           ${IP3:-'Could not fetch'}"
echo ""

# Determine the most likely correct IP
if [ ! -z "$IP1" ]; then
    CORRECT_IP=$IP1
    echo "✅ Using LocalTunnel's detected IP: $CORRECT_IP"
elif [ ! -z "$IP2" ]; then
    CORRECT_IP=$IP2
    echo "✅ Using ipinfo.io IP: $CORRECT_IP"
elif [ ! -z "$IP3" ]; then
    CORRECT_IP=$IP3
    echo "✅ Using ifconfig.me IP: $CORRECT_IP"
else
    echo "❌ Could not determine your public IP"
    echo "   Please manually check: https://loca.lt/mytunnelpassword"
    exit 1
fi

echo ""
echo "📋 Your Tunnel Password is: ${CORRECT_IP}"
echo ""
echo "🔍 Troubleshooting Tips:"
echo "   1. If password still doesn't work, your IP may have changed"
echo "   2. Restart the tunnels: ./expose-services.sh"
echo "   3. Make sure you're not behind a VPN (check if IPs match)"
echo "   4. The password must match the IP when the tunnel was created"
echo ""
echo "💡 Alternative: Use ngrok (no password needed)"
echo "   ngrok http 3012  # For frontend"
echo ""

