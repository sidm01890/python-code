#!/bin/bash

# Script to expose Devyani services using LocalTunnel
# Make sure all services are running locally before executing this script

echo "🚀 Devyani Service Exposer"
echo "=========================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if localtunnel is installed
if ! command -v lt &> /dev/null; then
    echo "⚠️  LocalTunnel not found. Installing..."
    npm install -g localtunnel
fi

# Kill any existing LocalTunnel processes to avoid conflicts
echo "🧹 Cleaning up any existing tunnels..."
pkill -f "lt --port" 2>/dev/null
sleep 2

# Get tunnel password (public IP) - try multiple sources
echo "🔑 Getting tunnel password (your public IP)..."
TUNNEL_PASSWORD=$(curl -s https://loca.lt/mytunnelpassword 2>/dev/null)
if [ -z "$TUNNEL_PASSWORD" ]; then
    # Try alternative IP check services
    TUNNEL_PASSWORD=$(curl -s ipinfo.io/ip 2>/dev/null)
    if [ -z "$TUNNEL_PASSWORD" ]; then
        TUNNEL_PASSWORD=$(curl -s ifconfig.me 2>/dev/null | head -1)
    fi
fi

if [ -z "$TUNNEL_PASSWORD" ]; then
    echo "${RED}⚠️  Could not fetch tunnel password. You may need to get it manually.${NC}"
    echo "   Visit: https://loca.lt/mytunnelpassword"
    TUNNEL_PASSWORD="YOUR_PUBLIC_IP"
else
    echo "${GREEN}✅ Tunnel Password: ${TUNNEL_PASSWORD}${NC}"
    echo "${YELLOW}⚠️  If this doesn't work, the IP may have changed.${NC}"
    echo "${YELLOW}   Try visiting https://loca.lt/mytunnelpassword from the machine running the tunnel${NC}"
fi
echo ""

echo "📋 Starting services exposure..."
echo ""

# Function to expose a service
expose_service() {
    local port=$1
    local name=$2
    local service_name=$3
    
    echo "${YELLOW}Exposing $service_name on port $port...${NC}"
    lt --port $port --subdomain $name > /tmp/$name-url.txt 2>&1 &
    sleep 3
    
    if [ -f /tmp/$name-url.txt ]; then
        local url=$(grep -o 'https://[^ ]*\.loca\.lt' /tmp/$name-url.txt | head -1)
        if [ ! -z "$url" ]; then
            echo "${GREEN}✅ $service_name exposed at: $url${NC}"
            echo "$url" > /tmp/$name-url.txt
        else
            echo "${YELLOW}⚠️  $service_name tunnel starting (URL will be available shortly)${NC}"
        fi
    fi
    echo ""
}

# Expose services
expose_service 8034 "devyani-python-api" "Python API (FastAPI)"
expose_service 8080 "devyani-node-api" "Node.js API (Express)"
expose_service 8000 "devyani-feynmanflow-api" "FeynmanFlow API (Data Processing)"
expose_service 3012 "devyani-frontend" "Frontend (React)"

echo "⏳ Waiting for tunnels to establish..."
sleep 5

echo ""
echo "📝 Service URLs:"
echo "================"

# Display URLs
if [ -f /tmp/devyani-python-api-url.txt ]; then
    PYTHON_URL=$(cat /tmp/devyani-python-api-url.txt | grep -o 'https://[^ ]*' | head -1)
    if [ ! -z "$PYTHON_URL" ]; then
        echo "🐍 Python API: $PYTHON_URL"
    fi
fi

if [ -f /tmp/devyani-node-api-url.txt ]; then
    NODE_URL=$(cat /tmp/devyani-node-api-url.txt | grep -o 'https://[^ ]*' | head -1)
    if [ ! -z "$NODE_URL" ]; then
        echo "🟢 Node.js API: $NODE_URL"
    fi
fi

if [ -f /tmp/devyani-feynmanflow-api-url.txt ]; then
    FEYNMANFLOW_URL=$(cat /tmp/devyani-feynmanflow-api-url.txt | grep -o 'https://[^ ]*' | head -1)
    if [ ! -z "$FEYNMANFLOW_URL" ]; then
        echo "⚡ FeynmanFlow API: $FEYNMANFLOW_URL"
    fi
fi

if [ -f /tmp/devyani-frontend-url.txt ]; then
    FRONTEND_URL=$(cat /tmp/devyani-frontend-url.txt | grep -o 'https://[^ ]*' | head -1)
    if [ ! -z "$FRONTEND_URL" ]; then
        echo "⚛️  Frontend: $FRONTEND_URL"
    fi
fi

echo ""
echo "🔐 IMPORTANT - Tunnel Access Information:"
echo "=========================================="
echo "${YELLOW}LocalTunnel requires visitors to enter a password on first visit.${NC}"
echo ""
echo "${BLUE}Tunnel Password: ${TUNNEL_PASSWORD}${NC}"
echo ""
echo "📋 Instructions for sharing:"
echo "  1. Share the URLs above with your testers"
echo "  2. Tell them the tunnel password is: ${BLUE}${TUNNEL_PASSWORD}${NC}"
echo "  3. They'll only see the password page ONCE per IP (valid for 7 days)"
echo ""
echo "💡 Alternative: Use ngrok (no password required) - see QUICK_START.md"
echo ""
echo "⚠️  IMPORTANT: Update API endpoints in:"
echo "   reconcii-devyani_poc/src/ServiceRequest/APIEndPoints.js"
echo ""
echo "${YELLOW}Press Ctrl+C to stop all tunnels${NC}"
echo ""

# Keep script running
wait

