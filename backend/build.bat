@echo off
REM Build script for Windows Task Scheduler Backend

echo Building Task Scheduler Backend...

REM Check if required tools are available
where gcc >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ERROR: GCC not found. Please install MinGW-w64 or MSYS2
    echo Download from: https://www.msys2.org/
    pause
    exit /b 1
)

REM Create build directory
if not exist "build" mkdir build

REM Compile source files
echo Compiling server.c...
gcc -Wall -Wextra -std=c99 -pthread -D_WIN32_WINNT=0x0601 -c server.c -o build/server.o

echo Compiling auth.c...
gcc -Wall -Wextra -std=c99 -pthread -D_WIN32_WINNT=0x0601 -c auth.c -o build/auth.o

echo Compiling utils.c...
gcc -Wall -Wextra -std=c99 -pthread -D_WIN32_WINNT=0x0601 -c utils.c -o build/utils.o

REM Link executable
echo Linking executable...
gcc build/server.o build/auth.o build/utils.o -o build/scheduler_server.exe -lsqlite3 -lcjson -lssl -lcrypto -lws2_32 -lpthread

if %ERRORLEVEL% eq 0 (
    echo Build successful! Executable: build/scheduler_server.exe
    echo.
    echo To run the server: build\scheduler_server.exe
) else (
    echo Build failed! Please check the error messages above.
    echo.
    echo Make sure you have installed all dependencies:
    echo - SQLite3 development libraries
    echo - cJSON library
    echo - OpenSSL libraries
    echo - UUID library (if available for Windows)
)

pause