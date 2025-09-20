@echo off
echo 🚀 Starting Task Scheduler in Production Mode...
echo.

:: Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

:: Show Node.js version
echo ✅ Node.js version:
node --version

:: Check if dependencies are installed
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    npm install
    if errorlevel 1 (
        echo ❌ Failed to install dependencies!
        pause
        exit /b 1
    )
)

:: Create database directory if it doesn't exist
if not exist "database" mkdir database

:: Start the server
echo.
echo 🌐 Starting server on http://localhost:3000
echo 📱 Frontend: http://localhost:3000
echo 🔧 API: http://localhost:3000/api
echo.
echo Press Ctrl+C to stop the server
echo.

node server.js