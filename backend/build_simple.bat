@echo off
REM Simple build script for Task Scheduler Backend (no external dependencies)

echo Building Task Scheduler Backend (Simple Version)...

REM Check if GCC is available
where gcc >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ERROR: GCC not found. Please install MinGW or similar C compiler
    pause
    exit /b 1
)

REM Create build directory
if not exist "build" mkdir build

REM Compile the simple server
echo Compiling simple_server.c...
gcc -Wall -Wextra -std=c99 -D_WIN32_WINNT=0x0601 simple_server.c -o build/scheduler_server.exe -lws2_32

if %ERRORLEVEL% eq 0 (
    echo.
    echo ======================================
    echo Build successful!
    echo ======================================
    echo Executable: build/scheduler_server.exe
    echo.
    echo To run the server:
    echo   build\scheduler_server.exe
    echo.
    echo The server will start on http://localhost:3000
    echo API endpoints will be available at:
    echo   POST http://localhost:3000/api/auth/register
    echo   POST http://localhost:3000/api/auth/login/step1
    echo   POST http://localhost:3000/api/auth/login/step2
    echo   POST http://localhost:3000/api/auth/login/step3
    echo   POST http://localhost:3000/api/auth/resend-otp
    echo.
) else (
    echo.
    echo ======================================
    echo Build failed!
    echo ======================================
    echo Please check the error messages above.
)

pause