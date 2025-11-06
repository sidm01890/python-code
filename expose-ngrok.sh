#!/bin/bash

# Script to expose Devyani services using ngrok
# Make sure all services are running locally before executing this script

echo "🚀 Devyani Service Exposer (ngrok)"
echo "===================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "${RED}❌ ngrok not found!${NC}"
    echo ""
    echo "📦 Install ngrok:"
    echo "   macOS: brew install ngrok"
    echo "   Or download from: https://ngrok.com/download"
    echo ""
    echo "🔑 After installing, authenticate:"
    echo "   1. Sign up at https://ngrok.com (free)"
    echo "   2. Get your auth token from dashboard"
    echo "   3. Run: ngrok config add-authtoken YOUR_TOKEN"
    echo ""
    exit 1
fi

# Check if ngrok is authenticated
if [ ! -f ~/.ngrok2/ngrok.yml ] && [ ! -f ~/Library/Application\ Support/ngrok/ngrok.yml ]; then
    echo "${YELLOW}⚠️  ngrok not authenticated${NC}"
    echo ""
    echo "🔑 Please authenticate ngrok:"
    echo "   1. Sign up at https://ngrok.com (free)"
    echo "   2. Get your auth token from dashboard"
    echo "   3. Run: ngrok config add-authtoken YOUR_TOKEN"
    echo ""
    exit 1
fi

echo "${GREEN}✅ ngrok is installed and configured${NC}"
echo ""
echo "📋 Starting services exposure..."
echo ""
echo "${YELLOW}⚠️  IMPORTANT: Keep this terminal open while using the tunnels${NC}"
echo "${YELLOW}   Press Ctrl+C to stop all tunnels${NC}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Function to start ngrok tunnel in background and get URL
start_ngrok() {
    local port=$1
    local service_name=$2
    
    echo "${YELLOW}Starting ngrok for $service_name (port $port)...${NC}"
    
    # Start ngrok in background
    ngrok http $port > /tmp/ngrok-$port.log 2>&1 &
    NGROK_PID=$!
    
    # Wait for ngrok to start
    sleep 3
    
    # Get the public URL from ngrok API
    local url=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"https://[^"]*"' | head -1 | cut -d'"' -f4)
    
    if [ ! -z "$url" ]; then
        echo "${GREEN}✅ $service_name exposed at: $url${NC}"
        echo "$url" > /tmp/ngrok-$port-url.txt
        echo "$NGROK_PID" > /tmp/ngrok-$port-pid.txt
        return 0
    else
        echo "${RED}❌ Failed to get URL for $service_name${NC}"
        echo "   Check ngrok dashboard at: http://localhost:4040"
        return 1
    fi
}

# Start all tunnels
echo "Starting ngrok tunnels..."
echo ""

start_ngrok 8034 "Python API"
PYTHON_URL=$(cat /tmp/ngrok-8034-url.txt 2>/dev/null)

start_ngrok 8080 "Node.js API"
NODE_URL=$(cat /tmp/ngrok-8080-url.txt 2>/dev/null)

start_ngrok 8000 "FeynmanFlow API"
FEYNMANFLOW_URL=$(cat /tmp/ngrok-8000-url.txt 2>/dev/null)

start_ngrok 3012 "Frontend"
FRONTEND_URL=$(cat /tmp/ngrok-3012-url.txt 2>/dev/null)

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 Service URLs (No password required!):"
echo "========================================"
echo ""

if [ ! -z "$PYTHON_URL" ]; then
    echo "🐍 Python API:     $PYTHON_URL"
fi

if [ ! -z "$NODE_URL" ]; then
    echo "🟢 Node.js API:     $NODE_URL"
fi

if [ ! -z "$FEYNMANFLOW_URL" ]; then
    echo "⚡ FeynmanFlow API: $FEYNMANFLOW_URL"
fi

if [ ! -z "$FRONTEND_URL" ]; then
    echo "⚛️  Frontend:       $FRONTEND_URL"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🎉 All services exposed!"
echo ""
echo "📊 ngrok Web Interface:"
echo "   http://localhost:4040 (View requests, inspect traffic)"
echo ""
echo "⚠️  IMPORTANT:"
echo "   1. Update API endpoints in:"
echo "      reconcii-devyani_poc/src/ServiceRequest/APIEndPoints.js"
echo "   2. Replace localhost URLs with ngrok URLs above"
echo ""
echo "💡 Tip: Free ngrok URLs change on restart."
echo "   Paid plans offer fixed domains."
echo ""
echo "${YELLOW}Press Ctrl+C to stop all tunnels${NC}"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping all ngrok tunnels..."
    for pid_file in /tmp/ngrok-*-pid.txt; do
        if [ -f "$pid_file" ]; then
            pid=$(cat "$pid_file")
            kill $pid 2>/dev/null
        fi
    done
    pkill ngrok 2>/dev/null
    echo "✅ All tunnels stopped"
    exit 0
}

# Trap Ctrl+C
trap cleanup INT

# Keep script running
echo "Tunnels are active. Waiting..."
wait

