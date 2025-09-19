@echo off
REM Production Build Script for Task Scheduler Backend v3.0 with SQLite

echo.
echo ========================================
echo 🚀 Building Production Server v3.0 with SQLite
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
if exist "build\production_server_v3.exe" del "build\production_server_v3.exe"
if exist "build\*.obj" del "build\*.obj"

echo 🧹 Cleaned previous builds
echo.

REM Download SQLite if not present
if not exist "sqlite3.c" (
    echo 📥 SQLite source not found. Please download sqlite3.c and sqlite3.h from:
    echo    https://www.sqlite.org/download.html
    echo.
    echo    Required files:
    echo    • sqlite3.c
    echo    • sqlite3.h
    echo.
    echo    Place them in the backend directory and run this script again.
    pause
    exit /b 1
)

echo ✅ SQLite source files found
echo.

REM Compile with SQLite support
echo 🔨 Compiling production server with SQLite...
echo.

gcc -O3 -Wall -Wextra -std=c99 ^
    -D_WIN32_WINNT=0x0601 ^
    -DNDEBUG ^
    -DSQLITE_THREADSAFE=1 ^
    -DSQLITE_ENABLE_FTS5 ^
    -DSQLITE_ENABLE_JSON1 ^
    production_server_v3.c sqlite3.c ^
    -o build\production_server_v3.exe ^
    -lws2_32

if %ERRORLEVEL% equ 0 (
    echo.
    echo ========================================
    echo ✅ BUILD SUCCESSFUL!
    echo ========================================
    echo.
    echo 📦 Executable: build\production_server_v3.exe
    echo 🗄️ Database: SQLite with persistent storage
    echo 🔒 Security features enabled:
    echo    • SQLite database integration
    echo    • Password hashing with salt
    echo    • Session persistence
    echo    • Rate limiting with database storage
    echo    • Account lockout protection
    echo    • Input validation and sanitization
    echo    • Security headers and CORS
    echo.
    echo 🚀 To run the server:
    echo    build\production_server_v3.exe
    echo.
    echo 🌐 Server will start on: http://localhost:3000
    echo.
    echo 📋 Available endpoints:
    echo    POST /api/auth/register
    echo    POST /api/auth/login/step1
    echo    POST /api/auth/login/step2  
    echo    POST /api/auth/login/step3
    echo    POST /api/tasks
    echo    GET  /api/tasks
    echo    PUT  /api/tasks/{id}
    echo    DELETE /api/tasks/{id}
    echo    GET  /api/health
    echo.
    echo 🔧 Production features:
    echo    • Persistent SQLite database
    echo    • Enhanced input validation
    echo    • Rate limiting (100 req/min per IP)
    echo    • Account lockout protection
    echo    • Session management with database
    echo    • Password strength requirements
    echo    • Thread-safe database operations
    echo    • Automatic session cleanup
    echo    • User and task management
    echo.
    echo 💾 Database file will be created as: task_scheduler.db
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
    echo    • Ensure sqlite3.c and sqlite3.h are in this directory
    echo    • Verify MinGW-w64 is properly installed
    echo    • Check that gcc is in your PATH
    echo    • Ensure you have write permissions
    echo.
    echo 📥 To get SQLite source files:
    echo    1. Visit https://www.sqlite.org/download.html
    echo    2. Download "sqlite-amalgamation" package
    echo    3. Extract sqlite3.c and sqlite3.h to this directory
    echo.
)

pause