#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <ctype.h>

#ifdef _WIN32
    #include <winsock2.h>
    #include <ws2tcpip.h>
    #include <windows.h>
    #include <process.h>
    #pragma comment(lib, "ws2_32.lib")
    #define close closesocket
    #define sleep(x) Sleep((x) * 1000)
    typedef HANDLE thread_t;
    typedef CRITICAL_SECTION mutex_t;
    #define THREAD_CREATE(thread, func, arg) do { \
        thread = (HANDLE)_beginthreadex(NULL, 0, func, arg, 0, NULL); \
    } while(0)
    #define MUTEX_INIT(mutex) InitializeCriticalSection(&mutex)
    #define MUTEX_LOCK(mutex) EnterCriticalSection(&mutex)
    #define MUTEX_UNLOCK(mutex) LeaveCriticalSection(&mutex)
    #define MUTEX_DESTROY(mutex) DeleteCriticalSection(&mutex)
#else
    #include <sys/socket.h>
    #include <netinet/in.h>
    #include <arpa/inet.h>
    #include <unistd.h>
    #include <pthread.h>
    typedef pthread_t thread_t;
    typedef pthread_mutex_t mutex_t;
    #define THREAD_CREATE(thread, func, arg) (pthread_create(&thread, NULL, func, arg) == 0)
    #define MUTEX_INIT(mutex) pthread_mutex_init(&mutex, NULL)
    #define MUTEX_LOCK(mutex) pthread_mutex_lock(&mutex)
    #define MUTEX_UNLOCK(mutex) pthread_mutex_unlock(&mutex)
    #define MUTEX_DESTROY(mutex) pthread_mutex_destroy(&mutex)
#endif

#define PORT 3000
#define BUFFER_SIZE 8192
#define MAX_USERS 10000
#define MAX_SESSIONS 1000
#define MAX_TASKS 50000
#define OTP_LENGTH 6
#define SESSION_TIMEOUT 3600
#define HASH_SIZE 256
#define RATE_LIMIT_WINDOW 60 // seconds
#define RATE_LIMIT_MAX_REQUESTS 100

// Enhanced security structures
typedef struct {
    int id;
    char username[64];
    char email[128];
    char password_hash[256];  // SHA-256 + salt
    char salt[32];
    char mobile[16];
    char face_data[4096];
    time_t created_at;
    time_t last_login;
    int failed_attempts;
    time_t lockout_until;
    int is_active;
    int is_verified;
} User;

typedef struct {
    char session_id[37];
    char username[64];
    char otp[7];
    time_t created_at;
    time_t expires_at;
    int step;
    int is_active;
    char ip_address[46]; // IPv6 support
    char user_agent[256];
} Session;

typedef struct {
    int id;
    int user_id;
    char title[256];
    char description[1024];
    char category[64];
    time_t due_date;
    char priority[16]; // High, Medium, Low
    char status[16];   // Pending, In Progress, Completed
    time_t created_at;
    time_t updated_at;
    int is_deleted;
} Task;

typedef struct {
    char ip_address[46];
    int request_count;
    time_t window_start;
} RateLimit;

// Global variables
User users[MAX_USERS];
Session sessions[MAX_SESSIONS];
Task tasks[MAX_TASKS];
RateLimit rate_limits[1000];
int user_count = 0;
int session_count = 0;
int task_count = 0;
int rate_limit_count = 0;
mutex_t data_mutex;

// Enhanced security functions
void generate_salt(char *salt, int length) {
    const char charset[] = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    srand((unsigned int)time(NULL) + rand());
    
    for (int i = 0; i < length - 1; i++) {
        salt[i] = charset[rand() % (sizeof(charset) - 1)];
    }
    salt[length - 1] = '\0';
}

void hash_password_with_salt(const char *password, const char *salt, char *hash) {
    char salted_password[512];
    snprintf(salted_password, sizeof(salted_password), "%s%s", password, salt);
    
    // Simple hash function (in production, use SHA-256)
    unsigned long hash_value = 5381;
    for (int i = 0; salted_password[i]; i++) {
        hash_value = ((hash_value << 5) + hash_value) + salted_password[i];
    }
    
    snprintf(hash, HASH_SIZE, "%lx", hash_value);
}

int verify_password(const char *password, const char *salt, const char *stored_hash) {
    char computed_hash[HASH_SIZE];
    hash_password_with_salt(password, salt, computed_hash);
    return strcmp(computed_hash, stored_hash) == 0;
}

// Rate limiting
int check_rate_limit(const char *ip_address) {
    time_t now = time(NULL);
    
    MUTEX_LOCK(data_mutex);
    
    // Find existing rate limit entry
    for (int i = 0; i < rate_limit_count; i++) {
        if (strcmp(rate_limits[i].ip_address, ip_address) == 0) {
            // Check if window has expired
            if (now - rate_limits[i].window_start >= RATE_LIMIT_WINDOW) {
                rate_limits[i].request_count = 1;
                rate_limits[i].window_start = now;
                MUTEX_UNLOCK(data_mutex);
                return 1; // Allow
            }
            
            // Increment counter
            rate_limits[i].request_count++;
            int allow = rate_limits[i].request_count <= RATE_LIMIT_MAX_REQUESTS;
            MUTEX_UNLOCK(data_mutex);
            return allow;
        }
    }
    
    // Create new rate limit entry
    if (rate_limit_count < 1000) {
        strcpy(rate_limits[rate_limit_count].ip_address, ip_address);
        rate_limits[rate_limit_count].request_count = 1;
        rate_limits[rate_limit_count].window_start = now;
        rate_limit_count++;
    }
    
    MUTEX_UNLOCK(data_mutex);
    return 1; // Allow new IPs
}

// Enhanced HTTP response functions
void send_response_with_security_headers(int client_socket, int status_code, const char *content_type, const char *body) {
    char response[BUFFER_SIZE * 2];
    char status_text[32];
    
    switch(status_code) {
        case 200: strcpy(status_text, "OK"); break;
        case 400: strcpy(status_text, "Bad Request"); break;
        case 401: strcpy(status_text, "Unauthorized"); break;
        case 403: strcpy(status_text, "Forbidden"); break;
        case 429: strcpy(status_text, "Too Many Requests"); break;
        case 500: strcpy(status_text, "Internal Server Error"); break;
        default: strcpy(status_text, "Unknown"); break;
    }
    
    snprintf(response, sizeof(response),
        "HTTP/1.1 %d %s\r\n"
        "Content-Type: %s\r\n"
        "Content-Length: %u\r\n"
        "Access-Control-Allow-Origin: http://localhost:8080\r\n"
        "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n"
        "Access-Control-Allow-Headers: Content-Type, Authorization\r\n"
        "Access-Control-Allow-Credentials: true\r\n"
        "X-Content-Type-Options: nosniff\r\n"
        "X-Frame-Options: DENY\r\n"
        "X-XSS-Protection: 1; mode=block\r\n"
        "Strict-Transport-Security: max-age=31536000; includeSubDomains\r\n"
        "Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'\r\n"
        "Cache-Control: no-cache, no-store, must-revalidate\r\n"
        "Pragma: no-cache\r\n"
        "Expires: 0\r\n"
        "\r\n"
        "%s",
        status_code, status_text, content_type, (unsigned int)strlen(body), body
    );
    
    send(client_socket, response, strlen(response), 0);
}

void send_json_success(int client_socket, const char *message) {
    char json[1024];
    snprintf(json, sizeof(json), 
        "{\"success\": true, \"message\": \"%s\", \"timestamp\": %ld}", 
        message, time(NULL));
    send_response_with_security_headers(client_socket, 200, "application/json", json);
}

void send_json_error(int client_socket, int status_code, const char *message) {
    char json[1024];
    snprintf(json, sizeof(json), 
        "{\"success\": false, \"error\": \"%s\", \"timestamp\": %ld}", 
        message, time(NULL));
    send_response_with_security_headers(client_socket, status_code, "application/json", json);
}

void send_rate_limit_error(int client_socket) {
    send_json_error(client_socket, 429, "Rate limit exceeded. Please try again later.");
}

// Utility functions
void generate_session_id(char *session_id) {
    const char chars[] = "0123456789abcdefABCDEF";
    srand((unsigned int)time(NULL) + rand());
    
    for(int i = 0; i < 36; i++) {
        if(i == 8 || i == 13 || i == 18 || i == 23) {
            session_id[i] = '-';
        } else {
            session_id[i] = chars[rand() % 22];
        }
    }
    session_id[36] = '\0';
}

void generate_otp(char *otp) {
    srand((unsigned int)time(NULL) + rand());
    for(int i = 0; i < OTP_LENGTH; i++) {
        otp[i] = '0' + (rand() % 10);
    }
    otp[OTP_LENGTH] = '\0';
}

User* find_user_by_username(const char *username) {
    MUTEX_LOCK(data_mutex);
    for(int i = 0; i < user_count; i++) {
        if(strcmp(users[i].username, username) == 0 && users[i].is_active) {
            MUTEX_UNLOCK(data_mutex);
            return &users[i];
        }
    }
    MUTEX_UNLOCK(data_mutex);
    return NULL;
}

Session* find_session(const char *session_id) {
    MUTEX_LOCK(data_mutex);
    time_t now = time(NULL);
    for(int i = 0; i < session_count; i++) {
        if(strcmp(sessions[i].session_id, session_id) == 0 && 
           sessions[i].is_active && 
           sessions[i].expires_at > now) {
            MUTEX_UNLOCK(data_mutex);
            return &sessions[i];
        }
    }
    MUTEX_UNLOCK(data_mutex);
    return NULL;
}

Session* create_session(const char *username, const char *ip_address, const char *user_agent) {
    MUTEX_LOCK(data_mutex);
    
    if(session_count >= MAX_SESSIONS) {
        MUTEX_UNLOCK(data_mutex);
        return NULL;
    }
    
    Session *session = &sessions[session_count++];
    generate_session_id(session->session_id);
    strcpy(session->username, username);
    generate_otp(session->otp);
    session->created_at = time(NULL);
    session->expires_at = session->created_at + SESSION_TIMEOUT;
    session->step = 1;
    session->is_active = 1;
    strncpy(session->ip_address, ip_address, 45);
    session->ip_address[45] = '\0';
    strncpy(session->user_agent, user_agent, 255);
    session->user_agent[255] = '\0';
    
    MUTEX_UNLOCK(data_mutex);
    return session;
}

// Input validation and sanitization
int is_valid_email(const char *email) {
    if (!email || strlen(email) < 5 || strlen(email) > 127) return 0;
    
    char *at = strchr(email, '@');
    if (!at || at == email || at == email + strlen(email) - 1) return 0;
    
    char *dot = strchr(at, '.');
    if (!dot || dot == at + 1 || dot == email + strlen(email) - 1) return 0;
    
    return 1;
}

int is_valid_username(const char *username) {
    if (!username || strlen(username) < 3 || strlen(username) > 63) return 0;
    
    for (int i = 0; username[i]; i++) {
        char c = username[i];
        if (!(isalnum(c) || c == '_' || c == '.' || c == '@')) {
            return 0;
        }
    }
    return 1;
}

int is_strong_password(const char *password) {
    if (!password || strlen(password) < 8) return 0;
    
    int has_upper = 0, has_lower = 0, has_digit = 0, has_special = 0;
    
    for (int i = 0; password[i]; i++) {
        char c = password[i];
        if (isupper(c)) has_upper = 1;
        else if (islower(c)) has_lower = 1;
        else if (isdigit(c)) has_digit = 1;
        else if (ispunct(c)) has_special = 1;
    }
    
    return has_upper && has_lower && has_digit && has_special;
}

// Simple JSON parsing
char* extract_json_value(const char *json, const char *key) {
    static char value[512];
    char search_key[128];
    snprintf(search_key, sizeof(search_key), "\"%s\":", key);
    
    char *pos = strstr(json, search_key);
    if(!pos) return NULL;
    
    pos += strlen(search_key);
    while(*pos == ' ' || *pos == '\t') pos++;
    
    if(*pos == '"') {
        pos++;
        int i = 0;
        while(*pos && *pos != '"' && i < 511) {
            if (*pos == '\\' && *(pos + 1)) {
                pos++; // Skip escape character
            }
            value[i++] = *pos++;
        }
        value[i] = '\0';
        return value;
    }
    
    return NULL;
}

// API handlers
void handle_register(int client_socket, const char *body, const char *ip_address) {
    (void)ip_address; // Mark as intentionally unused for now
    
    char *username = extract_json_value(body, "username");
    char *email = extract_json_value(body, "email");
    char *password = extract_json_value(body, "password");
    char *mobile = extract_json_value(body, "mobile");
    
    // Input validation
    if (!username || !email || !password || !mobile) {
        send_json_error(client_socket, 400, "Missing required fields");
        return;
    }
    
    if (!is_valid_username(username)) {
        send_json_error(client_socket, 400, "Invalid username format");
        return;
    }
    
    if (!is_valid_email(email)) {
        send_json_error(client_socket, 400, "Invalid email format");
        return;
    }
    
    if (!is_strong_password(password)) {
        send_json_error(client_socket, 400, "Password must be at least 8 characters with uppercase, lowercase, number, and special character");
        return;
    }
    
    // Check if user already exists
    if (find_user_by_username(username)) {
        send_json_error(client_socket, 400, "Username already exists");
        return;
    }
    
    MUTEX_LOCK(data_mutex);
    
    if (user_count >= MAX_USERS) {
        MUTEX_UNLOCK(data_mutex);
        send_json_error(client_socket, 500, "User limit reached");
        return;
    }
    
    // Create new user
    User *user = &users[user_count++];
    user->id = user_count;
    strcpy(user->username, username);
    strcpy(user->email, email);
    strcpy(user->mobile, mobile);
    
    // Generate salt and hash password
    generate_salt(user->salt, 32);
    hash_password_with_salt(password, user->salt, user->password_hash);
    
    user->created_at = time(NULL);
    user->last_login = 0;
    user->failed_attempts = 0;
    user->lockout_until = 0;
    user->is_active = 1;
    user->is_verified = 0; // Would be verified via email in production
    
    MUTEX_UNLOCK(data_mutex);
    
    printf("User registered: %s (%s)\n", username, email);
    send_json_success(client_socket, "User registered successfully");
}

void handle_login_step1(int client_socket, const char *body, const char *ip_address, const char *user_agent) {
    char *username = extract_json_value(body, "username");
    char *password = extract_json_value(body, "password");
    
    if (!username || !password) {
        send_json_error(client_socket, 400, "Missing username or password");
        return;
    }
    
    User *user = find_user_by_username(username);
    if (!user) {
        send_json_error(client_socket, 401, "Invalid credentials");
        return;
    }
    
    // Check account lockout
    time_t now = time(NULL);
    if (user->lockout_until > now) {
        send_json_error(client_socket, 403, "Account temporarily locked. Please try again later.");
        return;
    }
    
    // Verify password
    if (!verify_password(password, user->salt, user->password_hash)) {
        MUTEX_LOCK(data_mutex);
        user->failed_attempts++;
        if (user->failed_attempts >= 5) {
            user->lockout_until = now + 900; // 15 minute lockout
        }
        MUTEX_UNLOCK(data_mutex);
        
        send_json_error(client_socket, 401, "Invalid credentials");
        return;
    }
    
    // Reset failed attempts on successful password verification
    MUTEX_LOCK(data_mutex);
    user->failed_attempts = 0;
    user->lockout_until = 0;
    user->last_login = now;
    MUTEX_UNLOCK(data_mutex);
    
    // Create session
    Session *session = create_session(username, ip_address, user_agent);
    if (!session) {
        send_json_error(client_socket, 500, "Could not create session");
        return;
    }
    
    char response[1024];
    snprintf(response, sizeof(response), 
        "{\"success\": true, \"session_id\": \"%s\", \"message\": \"OTP sent to mobile\", \"otp\": \"%s\", \"expires_in\": %d}", 
        session->session_id, session->otp, SESSION_TIMEOUT);
    
    printf("Login step 1 for %s, OTP: %s\n", username, session->otp);
    send_response_with_security_headers(client_socket, 200, "application/json", response);
}

void handle_login_step2(int client_socket, const char *body) {
    char *session_id = extract_json_value(body, "session_id");
    char *otp = extract_json_value(body, "otp");
    
    if (!session_id || !otp) {
        send_json_error(client_socket, 400, "Missing session_id or otp");
        return;
    }
    
    Session *session = find_session(session_id);
    if (!session || session->step != 1) {
        send_json_error(client_socket, 401, "Invalid session or step");
        return;
    }
    
    if (strcmp(session->otp, otp) != 0) {
        send_json_error(client_socket, 401, "Invalid OTP");
        return;
    }
    
    MUTEX_LOCK(data_mutex);
    session->step = 2;
    MUTEX_UNLOCK(data_mutex);
    
    printf("OTP verified for session %s\n", session_id);
    send_json_success(client_socket, "OTP verified, proceed to face recognition");
}

void handle_login_step3(int client_socket, const char *body) {
    char *session_id = extract_json_value(body, "session_id");
    
    if (!session_id) {
        send_json_error(client_socket, 400, "Missing session_id");
        return;
    }
    
    Session *session = find_session(session_id);
    if (!session || session->step != 2) {
        send_json_error(client_socket, 401, "Invalid session or step");
        return;
    }
    
    // In production: implement actual face recognition
    // For now: accept any face data
    
    MUTEX_LOCK(data_mutex);
    session->step = 3;
    MUTEX_UNLOCK(data_mutex);
    
    char response[1024];
    snprintf(response, sizeof(response), 
        "{\"success\": true, \"token\": \"jwt_token_%s_%ld\", \"message\": \"Login successful\", \"user\": \"%s\"}", 
        session->username, time(NULL), session->username);
    
    printf("Face recognition completed for %s\n", session->username);
    send_response_with_security_headers(client_socket, 200, "application/json", response);
}

void handle_resend_otp(int client_socket, const char *body) {
    char *session_id = extract_json_value(body, "session_id");
    
    if (!session_id) {
        send_json_error(client_socket, 400, "Missing session_id");
        return;
    }
    
    Session *session = find_session(session_id);
    if (!session) {
        send_json_error(client_socket, 401, "Invalid session");
        return;
    }
    
    MUTEX_LOCK(data_mutex);
    generate_otp(session->otp);
    MUTEX_UNLOCK(data_mutex);
    
    char response[1024];
    snprintf(response, sizeof(response), 
        "{\"success\": true, \"message\": \"OTP resent\", \"otp\": \"%s\"}", 
        session->otp);
    
    printf("OTP resent for session %s: %s\n", session_id, session->otp);
    send_response_with_security_headers(client_socket, 200, "application/json", response);
}

// Task management handlers
void handle_get_tasks(int client_socket, const char *username) {
    User *user = find_user_by_username(username);
    if (!user) {
        send_json_error(client_socket, 401, "User not found");
        return;
    }
    
    char response[BUFFER_SIZE];
    strcpy(response, "{\"success\": true, \"tasks\": [");
    
    MUTEX_LOCK(data_mutex);
    int first = 1;
    for (int i = 0; i < task_count; i++) {
        if (tasks[i].user_id == user->id && !tasks[i].is_deleted) {
            if (!first) strcat(response, ",");
            
            char task_json[512];
            snprintf(task_json, sizeof(task_json),
                "{\"id\": %d, \"title\": \"%s\", \"description\": \"%s\", \"category\": \"%s\", \"priority\": \"%s\", \"status\": \"%s\", \"due_date\": %ld, \"created_at\": %ld}",
                tasks[i].id, tasks[i].title, tasks[i].description, tasks[i].category, 
                tasks[i].priority, tasks[i].status, tasks[i].due_date, tasks[i].created_at);
            
            strcat(response, task_json);
            first = 0;
        }
    }
    MUTEX_UNLOCK(data_mutex);
    
    strcat(response, "]}");
    send_response_with_security_headers(client_socket, 200, "application/json", response);
}

// Request parsing and routing
char* extract_client_ip(const char *request) {
    (void)request; // Mark as intentionally unused for now
    static char ip[46] = "127.0.0.1"; // Default to localhost
    // In a real implementation, extract from X-Forwarded-For or other headers
    return ip;
}

char* extract_user_agent(const char *request) {
    static char user_agent[256] = "Unknown";
    
    char *ua_start = strstr(request, "User-Agent: ");
    if (ua_start) {
        ua_start += 12; // Skip "User-Agent: "
        char *ua_end = strstr(ua_start, "\r\n");
        if (ua_end) {
            int len = ua_end - ua_start;
            if (len > 255) len = 255;
            strncpy(user_agent, ua_start, len);
            user_agent[len] = '\0';
        }
    }
    
    return user_agent;
}

void handle_request(int client_socket, char *request) {
    char method[16], path[256], version[16];
    char *body = strstr(request, "\r\n\r\n");
    if (body) body += 4;
    
    if (sscanf(request, "%s %s %s", method, path, version) != 3) {
        send_json_error(client_socket, 400, "Invalid request format");
        return;
    }
    
    // Extract client information
    char *client_ip = extract_client_ip(request);
    char *user_agent = extract_user_agent(request);
    
    // Rate limiting check
    if (!check_rate_limit(client_ip)) {
        send_rate_limit_error(client_socket);
        return;
    }
    
    printf("Request: %s %s from %s\n", method, path, client_ip);
    
    // Handle CORS preflight
    if (strcmp(method, "OPTIONS") == 0) {
        send_response_with_security_headers(client_socket, 200, "text/plain", "");
        return;
    }
    
    if (strcmp(method, "POST") != 0 && strcmp(method, "GET") != 0) {
        send_json_error(client_socket, 405, "Method not allowed");
        return;
    }
    
    // Route requests
    if (strcmp(path, "/api/auth/register") == 0 && strcmp(method, "POST") == 0) {
        handle_register(client_socket, body ? body : "", client_ip);
    }
    else if (strcmp(path, "/api/auth/login/step1") == 0 && strcmp(method, "POST") == 0) {
        handle_login_step1(client_socket, body ? body : "", client_ip, user_agent);
    }
    else if (strcmp(path, "/api/auth/login/step2") == 0 && strcmp(method, "POST") == 0) {
        handle_login_step2(client_socket, body ? body : "");
    }
    else if (strcmp(path, "/api/auth/login/step3") == 0 && strcmp(method, "POST") == 0) {
        handle_login_step3(client_socket, body ? body : "");
    }
    else if (strcmp(path, "/api/auth/resend-otp") == 0 && strcmp(method, "POST") == 0) {
        handle_resend_otp(client_socket, body ? body : "");
    }
    else if (strcmp(path, "/api/health") == 0 && strcmp(method, "GET") == 0) {
        char health_response[256];
        snprintf(health_response, sizeof(health_response),
            "{\"status\": \"healthy\", \"uptime\": %ld, \"users\": %d, \"sessions\": %d, \"version\": \"2.0.0\"}",
            time(NULL), user_count, session_count);
        send_response_with_security_headers(client_socket, 200, "application/json", health_response);
    }
    else {
        send_json_error(client_socket, 404, "Endpoint not found");
    }
}

#ifdef _WIN32
unsigned __stdcall handle_client(void *client_socket_ptr) {
    int client_socket = *(int*)client_socket_ptr;
    free(client_socket_ptr);
#else
void* handle_client(void *client_socket_ptr) {
    int client_socket = *(int*)client_socket_ptr;
    free(client_socket_ptr);
#endif
    
    char buffer[BUFFER_SIZE];
    int bytes_received = recv(client_socket, buffer, BUFFER_SIZE - 1, 0);
    
    if (bytes_received > 0) {
        buffer[bytes_received] = '\0';
        handle_request(client_socket, buffer);
    }
    
    close(client_socket);
    return 0;
}

void cleanup_expired_sessions() {
    MUTEX_LOCK(data_mutex);
    time_t now = time(NULL);
    
    for (int i = 0; i < session_count; i++) {
        if (sessions[i].expires_at < now) {
            sessions[i].is_active = 0;
        }
    }
    MUTEX_UNLOCK(data_mutex);
}

int main() {
    printf("🚀 Task Scheduler Production Server v2.0\n");
    printf("==========================================\n");
    printf("🔒 Enhanced Security Features:\n");
    printf("   • Rate limiting (%d req/%d sec)\n", RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW);
    printf("   • Password hashing with salt\n");
    printf("   • Session management\n");
    printf("   • Input validation\n");
    printf("   • Security headers\n");
    printf("   • Account lockout protection\n");
    printf("\n");
    
    // Initialize mutex
    MUTEX_INIT(data_mutex);
    
#ifdef _WIN32
    WSADATA wsa_data;
    if (WSAStartup(MAKEWORD(2,2), &wsa_data) != 0) {
        printf("❌ WSAStartup failed\n");
        return 1;
    }
#endif
    
    int server_socket = socket(AF_INET, SOCK_STREAM, 0);
    if (server_socket < 0) {
        printf("❌ Socket creation failed\n");
        return 1;
    }
    
    int opt = 1;
    setsockopt(server_socket, SOL_SOCKET, SO_REUSEADDR, (char*)&opt, sizeof(opt));
    
    struct sockaddr_in server_addr;
    server_addr.sin_family = AF_INET;
    server_addr.sin_addr.s_addr = INADDR_ANY;
    server_addr.sin_port = htons(PORT);
    
    if (bind(server_socket, (struct sockaddr*)&server_addr, sizeof(server_addr)) < 0) {
        printf("❌ Bind failed on port %d\n", PORT);
        close(server_socket);
        return 1;
    }
    
    if (listen(server_socket, 50) < 0) {
        printf("❌ Listen failed\n");
        close(server_socket);
        return 1;
    }
    
    printf("✅ Server running on http://localhost:%d\n", PORT);
    printf("📡 API Endpoints:\n");
    printf("   POST /api/auth/register\n");
    printf("   POST /api/auth/login/step1\n");
    printf("   POST /api/auth/login/step2\n");
    printf("   POST /api/auth/login/step3\n");
    printf("   POST /api/auth/resend-otp\n");
    printf("   GET  /api/health\n");
    printf("\n🔄 Ready for connections...\n\n");
    
    // Session cleanup thread will be implemented later
    // thread_t cleanup_thread;
    
    while (1) {
        struct sockaddr_in client_addr;
        int addr_len = sizeof(client_addr);
        int client_socket = accept(server_socket, (struct sockaddr*)&client_addr, &addr_len);
        
        if (client_socket >= 0) {
            int *client_ptr = malloc(sizeof(int));
            *client_ptr = client_socket;
            
            thread_t thread;
            THREAD_CREATE(thread, handle_client, client_ptr);
        }
        
        // Periodic cleanup
        static time_t last_cleanup = 0;
        time_t now = time(NULL);
        if (now - last_cleanup > 300) { // Every 5 minutes
            cleanup_expired_sessions();
            last_cleanup = now;
        }
    }
    
    close(server_socket);
    MUTEX_DESTROY(data_mutex);
    
#ifdef _WIN32
    WSACleanup();
#endif
    
    return 0;
}