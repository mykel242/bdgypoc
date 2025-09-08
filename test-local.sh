#!/bin/bash

# Local testing script for Budgie application

echo "🚀 Starting Budgie Local Test Server..."
echo "=================================="
echo ""

# Check which server to use
if command -v python3 &> /dev/null; then
    echo "📦 Using Python HTTP Server"
    echo "🌐 Opening: http://localhost:8000"
    echo ""
    echo "Press Ctrl+C to stop the server"
    echo "=================================="
    python3 -m http.server 8000
elif command -v npx &> /dev/null; then
    echo "📦 Using Node.js HTTP Server"
    echo "🌐 Opening: http://localhost:8000"
    echo ""
    echo "Press Ctrl+C to stop the server"
    echo "=================================="
    npx http-server -p 8000
else
    echo "❌ No suitable server found!"
    echo "Please install Python 3 or Node.js"
    exit 1
fi