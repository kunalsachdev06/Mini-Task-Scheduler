# Task Scheduler Backend (C Implementation)

A high-performance HTTP server backend written in C with SQLite database integration for the Task Scheduler application.

## Features

- **HTTP Server**: Custom HTTP server with socket programming
- **Authentication**: 3-step authentication (password + OTP + face recognition)
- **Database**: SQLite database for user and task management
- **Security**: SHA256 password hashing, UUID session management
- **Multithreading**: Concurrent request handling with pthreads
- **JSON API**: RESTful JSON endpoints with CORS support

## Prerequisites

### Windows (MSYS2/MinGW)
```bash
# Install MSYS2 from https://www.msys2.org/
# Then install dependencies:
pacman -S mingw-w64-x86_64-gcc
pacman -S mingw-w64-x86_64-sqlite3
pacman -S mingw-w64-x86_64-cjson
pacman -S mingw-w64-x86_64-openssl
```

### Linux (Ubuntu/Debian)
```bash
sudo apt-get update
sudo apt-get install build-essential libsqlite3-dev libcjson-dev libssl-dev uuid-dev
```

### macOS
```bash
brew install sqlite3 cjson openssl
```

## Building

### Windows
Run the provided batch file:
```cmd
build.bat
```

### Linux/macOS
Use the Makefile:
```bash
make all
```

For debug build:
```bash
make debug
```

## Running

### Windows
```cmd
build\scheduler_server.exe
```

### Linux/macOS
```bash
./scheduler_server
```

The server will start on port 3000.

## API Endpoints

### Authentication

#### Register User
```
POST /api/auth/register
Content-Type: application/json

{
    "username": "string",
    "email": "string", 
    "password": "string",
    "mobile": "string"
}
```

#### Login Step 1 (Password)
```
POST /api/auth/login/step1
Content-Type: application/json

{
    "username": "string",
    "password": "string"
}

Response: { "session_id": "uuid", "message": "OTP sent" }
```

#### Login Step 2 (OTP)
```
POST /api/auth/login/step2
Content-Type: application/json

{
    "session_id": "uuid",
    "otp": "string"
}

Response: { "message": "OTP verified, proceed to face recognition" }
```

#### Login Step 3 (Face Recognition)
```
POST /api/auth/login/step3
Content-Type: application/json

{
    "session_id": "uuid",
    "face_data": "base64_string"
}

Response: { "token": "jwt_token", "message": "Login successful" }
```

#### Resend OTP
```
POST /api/auth/resend-otp
Content-Type: application/json

{
    "session_id": "uuid"
}
```

## Database Schema

### Users Table
- id (INTEGER PRIMARY KEY)
- username (TEXT UNIQUE)
- email (TEXT UNIQUE)
- password_hash (TEXT)
- mobile (TEXT)
- face_data (TEXT)
- created_at (INTEGER)
- is_active (INTEGER)

### Tasks Table
- id (INTEGER PRIMARY KEY)
- user_id (INTEGER)
- title (TEXT)
- description (TEXT)
- category (TEXT)
- due_date (INTEGER)
- priority (TEXT)
- status (TEXT)
- created_at (INTEGER)

## Security Features

- **Password Hashing**: SHA256 with salt
- **Session Management**: UUID-based sessions with timeout
- **OTP Generation**: 6-digit random OTP
- **CORS Support**: Cross-origin resource sharing
- **Input Validation**: JSON parsing and validation
- **Thread Safety**: Mutex-protected shared resources

## File Structure

```
backend/
├── server.c          # Main HTTP server
├── auth.c            # Authentication endpoints
├── utils.c           # Utility functions
├── server.h          # Header file
├── Makefile          # Linux/macOS build
├── build.bat         # Windows build script
└── README.md         # This file
```

## Troubleshooting

### Common Issues

1. **Missing Dependencies**: Install all required libraries
2. **Port Already in Use**: Change PORT in server.h
3. **Database Permissions**: Ensure write permissions in directory
4. **Compilation Errors**: Check library paths and versions

### Debug Mode
Compile with debug flags to enable verbose logging:
```bash
make debug
```

## Development

### Adding New Endpoints
1. Define handler function in appropriate .c file
2. Add function declaration to server.h
3. Register route in handle_request() function
4. Update this README with API documentation

### Database Changes
1. Modify CREATE TABLE statements in init_database()
2. Update corresponding structures in server.h
3. Add migration logic if needed

## Performance

- **Concurrent Connections**: Handles multiple clients simultaneously
- **Memory Management**: Proper cleanup and resource management
- **Database Caching**: SQLite connection pooling
- **Session Cleanup**: Automatic expired session removal

## License

This project is part of the Task Scheduler application.