# Task Scheduler Security Configuration
# Production Security Hardening Guide v1.0

## 🔒 Security Features Overview

### Current Implementation Status
✅ **Implemented:**
- Password hashing with salt (SHA-256 based)
- Session management with secure tokens
- Rate limiting (100 requests per 60 seconds per IP)
- Account lockout protection (5 failed attempts = 30min lock)
- Input validation and sanitization
- CORS headers configuration
- SQL injection prevention (parameterized queries)
- Database connection security
- Thread-safe operations

⚠️ **Needs Enhancement for Production:**
- HTTPS/TLS encryption
- Enhanced XSS protection
- CSRF token implementation
- Security headers hardening
- Certificate management
- API key authentication
- Advanced logging and monitoring
- Backup and recovery procedures

---

## 🛡️ Security Hardening Checklist

### 1. Transport Layer Security (HTTPS)

#### SSL/TLS Certificate Setup
```bash
# For production with Let's Encrypt (recommended)
# 1. Install Certbot
# 2. Generate certificate
certbot certonly --standalone -d yourdomain.com

# For development (self-signed)
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
```

#### C Server HTTPS Configuration
```c
// Add to production_server_v3.c
#ifdef USE_HTTPS
#include <openssl/ssl.h>
#include <openssl/err.h>

// SSL context initialization
SSL_CTX* create_ssl_context() {
    const SSL_METHOD *method;
    SSL_CTX *ctx;
    
    OpenSSL_add_all_algorithms();
    SSL_load_error_strings();
    method = TLS_server_method();
    ctx = SSL_CTX_new(method);
    
    if (!ctx) {
        perror("Unable to create SSL context");
        ERR_print_errors_fp(stderr);
        exit(EXIT_FAILURE);
    }
    
    return ctx;
}

// Configure SSL certificate and key
void configure_ssl_context(SSL_CTX *ctx) {
    if (SSL_CTX_use_certificate_file(ctx, "cert.pem", SSL_FILETYPE_PEM) <= 0) {
        ERR_print_errors_fp(stderr);
        exit(EXIT_FAILURE);
    }
    
    if (SSL_CTX_use_PrivateKey_file(ctx, "key.pem", SSL_FILETYPE_PEM) <= 0) {
        ERR_print_errors_fp(stderr);
        exit(EXIT_FAILURE);
    }
}
#endif
```

### 2. Security Headers Implementation

#### Enhanced CORS and Security Headers
```c
void send_security_headers(int client_socket) {
    const char *security_headers = 
        "Strict-Transport-Security: max-age=31536000; includeSubDomains\r\n"
        "X-Frame-Options: DENY\r\n"
        "X-Content-Type-Options: nosniff\r\n"
        "X-XSS-Protection: 1; mode=block\r\n"
        "Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' fonts.googleapis.com; font-src 'self' fonts.gstatic.com; img-src 'self' data:; connect-src 'self'\r\n"
        "Referrer-Policy: strict-origin-when-cross-origin\r\n"
        "Permissions-Policy: geolocation=(), microphone=(), camera=()\r\n"
        "Access-Control-Allow-Origin: https://yourdomain.com\r\n"
        "Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS\r\n"
        "Access-Control-Allow-Headers: Content-Type, Authorization, X-CSRF-Token\r\n"
        "Access-Control-Allow-Credentials: true\r\n";
        
    send(client_socket, security_headers, strlen(security_headers), 0);
}
```

### 3. Input Validation and Sanitization

#### Enhanced Input Validation
```c
// Input sanitization functions
int is_valid_email(const char *email) {
    if (!email || strlen(email) < 5 || strlen(email) > 254) return 0;
    
    // Basic email regex validation
    const char *at = strchr(email, '@');
    if (!at || at == email || strchr(at + 1, '@')) return 0;
    
    const char *dot = strrchr(at, '.');
    if (!dot || dot == at + 1 || *(dot + 1) == '\0') return 0;
    
    return 1;
}

int is_valid_username(const char *username) {
    if (!username || strlen(username) < 3 || strlen(username) > 50) return 0;
    
    // Allow alphanumeric and underscore only
    for (int i = 0; username[i]; i++) {
        if (!isalnum(username[i]) && username[i] != '_') return 0;
    }
    
    return 1;
}

int is_strong_password(const char *password) {
    if (!password || strlen(password) < 8 || strlen(password) > 128) return 0;
    
    int has_upper = 0, has_lower = 0, has_digit = 0, has_special = 0;
    
    for (int i = 0; password[i]; i++) {
        if (isupper(password[i])) has_upper = 1;
        else if (islower(password[i])) has_lower = 1;
        else if (isdigit(password[i])) has_digit = 1;
        else if (ispunct(password[i])) has_special = 1;
    }
    
    return has_upper && has_lower && has_digit && has_special;
}

char* sanitize_input(const char *input) {
    if (!input) return NULL;
    
    int len = strlen(input);
    char *sanitized = malloc(len * 2 + 1); // Extra space for escaping
    int j = 0;
    
    for (int i = 0; i < len; i++) {
        switch (input[i]) {
            case '<': case '>': case '"': case '\'': case '&':
                // Remove dangerous characters
                break;
            case '\r': case '\n':
                // Remove line breaks
                break;
            default:
                sanitized[j++] = input[i];
        }
    }
    
    sanitized[j] = '\0';
    return sanitized;
}
```

### 4. CSRF Protection

#### CSRF Token Implementation
```c
// CSRF token generation and validation
void generate_csrf_token(char *token, int length) {
    const char charset[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    srand((unsigned int)time(NULL));
    
    for (int i = 0; i < length - 1; i++) {
        token[i] = charset[rand() % (sizeof(charset) - 1)];
    }
    token[length - 1] = '\0';
}

int validate_csrf_token(const char *session_id, const char *provided_token) {
    // In production, store CSRF tokens in database with session
    // For now, implement basic validation
    
    if (!session_id || !provided_token) return 0;
    if (strlen(provided_token) != 32) return 0; // Expected token length
    
    // TODO: Implement database lookup for stored CSRF token
    return 1; // Placeholder
}
```

### 5. Enhanced Logging and Monitoring

#### Security Audit Logging
```c
typedef enum {
    LOG_INFO,
    LOG_WARNING,
    LOG_ERROR,
    LOG_SECURITY
} log_level_t;

void security_log(log_level_t level, const char *event, const char *details, const char *ip_address) {
    time_t now = time(NULL);
    struct tm *tm_info = localtime(&now);
    char timestamp[64];
    strftime(timestamp, sizeof(timestamp), "%Y-%m-%d %H:%M:%S", tm_info);
    
    const char *level_str;
    switch (level) {
        case LOG_INFO: level_str = "INFO"; break;
        case LOG_WARNING: level_str = "WARN"; break;
        case LOG_ERROR: level_str = "ERROR"; break;
        case LOG_SECURITY: level_str = "SECURITY"; break;
        default: level_str = "UNKNOWN";
    }
    
    // Log to database
    const char *sql = 
        "INSERT INTO activity_logs (action, details, ip_address, timestamp, log_level) "
        "VALUES (?, ?, ?, ?, ?);";
    
    sqlite3_stmt *stmt;
    MUTEX_LOCK(db_mutex);
    
    if (sqlite3_prepare_v2(db, sql, -1, &stmt, NULL) == SQLITE_OK) {
        sqlite3_bind_text(stmt, 1, event, -1, SQLITE_STATIC);
        sqlite3_bind_text(stmt, 2, details, -1, SQLITE_STATIC);
        sqlite3_bind_text(stmt, 3, ip_address, -1, SQLITE_STATIC);
        sqlite3_bind_int64(stmt, 4, now);
        sqlite3_bind_text(stmt, 5, level_str, -1, SQLITE_STATIC);
        sqlite3_step(stmt);
    }
    
    sqlite3_finalize(stmt);
    MUTEX_UNLOCK(db_mutex);
    
    // Also log to file for backup
    FILE *log_file = fopen("security.log", "a");
    if (log_file) {
        fprintf(log_file, "[%s] %s: %s - %s (IP: %s)\n", 
                timestamp, level_str, event, details, ip_address);
        fclose(log_file);
    }
}
```

### 6. Database Security Enhancements

#### Connection Security
```c
void secure_database_connection() {
    // Enable security features
    sqlite3_exec(db, "PRAGMA secure_delete = ON;", 0, 0, 0);
    sqlite3_exec(db, "PRAGMA temp_store = memory;", 0, 0, 0);
    sqlite3_exec(db, "PRAGMA journal_mode = WAL;", 0, 0, 0);
    sqlite3_exec(db, "PRAGMA synchronous = FULL;", 0, 0, 0);
    
    // Set database encryption key (if using SQLCipher)
    #ifdef SQLITE_HAS_CODEC
    const char *key = getenv("DB_ENCRYPTION_KEY");
    if (key) {
        sqlite3_key(db, key, strlen(key));
    }
    #endif
}
```

### 7. API Security Configuration

#### API Rate Limiting Enhancement
```c
typedef struct {
    char ip_address[46];
    time_t requests[100]; // Sliding window
    int request_count;
    time_t blocked_until;
    int violation_count;
} enhanced_rate_limit_t;

int check_enhanced_rate_limit(const char *ip_address) {
    time_t now = time(NULL);
    
    // Get rate limit data from database
    const char *sql = 
        "SELECT request_count, window_start, blocked_until, violation_count "
        "FROM rate_limits WHERE ip_address = ?;";
    
    // Implement sliding window rate limiting
    // Block IPs with repeated violations
    // Progressive penalties for abuse
    
    return 1; // Placeholder
}
```

---

## 🔐 Environment Configuration

### Production Environment Variables
```bash
# Security Configuration
export DB_ENCRYPTION_KEY="your-32-character-encryption-key"
export JWT_SECRET="your-jwt-signing-secret"
export CSRF_SECRET="your-csrf-token-secret"
export SESSION_SECRET="your-session-encryption-key"

# SSL/TLS Configuration
export SSL_CERT_PATH="/path/to/cert.pem"
export SSL_KEY_PATH="/path/to/key.pem"
export SSL_CA_PATH="/path/to/ca.pem"

# Database Configuration
export DB_PATH="/secure/path/task_scheduler.db"
export DB_BACKUP_PATH="/backup/path/"

# Server Configuration
export SERVER_HOST="0.0.0.0"
export SERVER_PORT="443"
export SERVER_WORKERS="4"

# Security Limits
export MAX_CONNECTIONS="1000"
export RATE_LIMIT_REQUESTS="100"
export RATE_LIMIT_WINDOW="60"
export SESSION_TIMEOUT="3600"

# Logging Configuration
export LOG_LEVEL="INFO"
export LOG_PATH="/var/log/taskscheduler/"
export AUDIT_LOG_RETENTION="90"
```

### Security Deployment Checklist

#### Pre-deployment Security Audit
- [ ] All dependencies updated to latest versions
- [ ] SSL/TLS certificates configured and valid
- [ ] Security headers implemented and tested
- [ ] Input validation comprehensive and tested
- [ ] Rate limiting configured and tested
- [ ] Database encryption enabled
- [ ] Logging and monitoring configured
- [ ] Backup and recovery procedures tested
- [ ] Security documentation updated
- [ ] Penetration testing completed

#### Production Monitoring
- [ ] Real-time security monitoring
- [ ] Automated vulnerability scanning
- [ ] Log analysis and alerting
- [ ] Performance monitoring
- [ ] Database integrity checks
- [ ] Certificate expiration monitoring
- [ ] Backup verification
- [ ] Security incident response plan

---

## 🚨 Incident Response Procedures

### Security Incident Classification
1. **Low**: Failed login attempts, minor rate limit violations
2. **Medium**: Suspicious activity patterns, potential brute force
3. **High**: SQL injection attempts, XSS attempts, data breach indicators
4. **Critical**: Confirmed security breach, system compromise

### Response Actions
1. **Immediate**: Log incident, assess severity, implement containment
2. **Short-term**: Investigate scope, notify stakeholders, implement fixes
3. **Long-term**: Post-incident review, update procedures, improve security

### Emergency Contacts
- Security Team: security@yourdomain.com
- DevOps Team: devops@yourdomain.com
- Management: management@yourdomain.com

---

## 📊 Security Metrics and KPIs

### Monitoring Dashboards
- Failed login attempt rates
- Rate limiting trigger frequency
- Session security metrics
- Database performance and security
- SSL/TLS certificate status
- Vulnerability scan results

### Security Reports
- Weekly security summary
- Monthly vulnerability assessment
- Quarterly security audit
- Annual penetration testing

---

*This security configuration is continuously updated as new threats and best practices emerge. Regular security reviews and updates are essential for maintaining a secure production environment.*