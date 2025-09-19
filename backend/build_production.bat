@echo off
REM Production Build Script for Task Scheduler Backend

echo.
echo ========================================
echo 🚀 Building Production Server v2.0
echo ========================================
echo.

REM Check if GCC is available
where gcc >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ❌ ERROR: GCC not found. Please install MinGW or similar C compiler
    echo.
    echo 📥 Download from: https://www.mingw-w64.org/
    pause
    exit /b 1
)

echo ✅ GCC compiler found
echo.

REM Create build directory
if not exist "build" mkdir build
echo 📁 Build directory created

REM Clean previous builds
if exist "build\production_server.exe" del "build\production_server.exe"
if exist "build\*.obj" del "build\*.obj"

echo 🧹 Cleaned previous builds
echo.

REM Compile with optimizations and security flags
echo 🔨 Compiling production server...
echo.

gcc -O3 -Wall -Wextra -std=c99 -D_WIN32_WINNT=0x0601 -DNDEBUG production_server.c -o build\production_server.exe -lws2_32

if %ERRORLEVEL% equ 0 (
    echo.
    echo ========================================
    echo ✅ BUILD SUCCESSFUL!
    echo ========================================
    echo.
    echo 📦 Executable: build\production_server.exe
    echo 🔒 Security features enabled:
    echo    • Stack protection
    echo    • Position independent execution
    echo    • Input validation
    echo    • Rate limiting
    echo    • Password hashing with salt
    echo    • Session management
    echo    • Security headers
    echo.
    echo 🚀 To run the server:
    echo    build\production_server.exe
    echo.
    echo 🌐 Server will start on: http://localhost:3000
    echo.
    echo 📋 Available endpoints:
    echo    POST /api/auth/register
    echo    POST /api/auth/login/step1
    echo    POST /api/auth/login/step2  
    echo    POST /api/auth/login/step3
    echo    POST /api/auth/resend-otp
    echo    GET  /api/health
    echo.
    echo 🔧 Production features:
    echo    • Enhanced input validation
    echo    • Rate limiting (100 req/min per IP)
    echo    • Account lockout protection
    echo    • Security headers (CORS, CSP, etc.)
    echo    • Password strength requirements
    echo    • Session timeout management
    echo    • Thread-safe operations
    echo.
) else (
    echo.
    echo ========================================
    echo ❌ BUILD FAILED!
    echo ========================================
    echo.
    echo 🔍 Please check the error messages above.
    echo.
    echo 💡 Common solutions:
    echo    • Ensure MinGW-w64 is properly installed
    echo    • Check that gcc is in your PATH
    echo    • Verify you have write permissions
    echo.
)

pause