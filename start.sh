#!/bin/bash

echo "🚀 Starting Task Scheduler in Production Mode..."
echo

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Show Node.js version
echo "✅ Node.js version:"
node --version

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies!"
        exit 1
    fi
fi

# Create database directory if it doesn't exist
mkdir -p database

# Start the server
echo
echo "🌐 Starting server on http://localhost:3000"
echo "📱 Frontend: http://localhost:3000"
echo "🔧 API: http://localhost:3000/api"
echo
echo "Press Ctrl+C to stop the server"
echo

node server.js