#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <ctype.h>

#ifdef _WIN32
    #include <winsock2.h>
    #include <ws2tcpip.h>
    #include <windows.h>
    #pragma comment(lib, "ws2_32.lib")
    #define close closesocket
    #define sleep(x) Sleep((x) * 1000)
#else
    #include <sys/socket.h>
    #include <netinet/in.h>
    #include <arpa/inet.h>
    #include <unistd.h>
    #include <pthread.h>
#endif

#define PORT 3000
#define BUFFER_SIZE 8192
#define MAX_USERS 1000
#define MAX_SESSIONS 100
#define OTP_LENGTH 6
#define SESSION_TIMEOUT 3600

// Simplified structures without external dependencies
typedef struct {
    int id;
    char username[64];
    char email[128];
    char password[128];  // For demo - in production use hashed passwords
    char mobile[16];
    int is_active;
} User;

typedef struct {
    char session_id[37];
    char username[64];
    char otp[7];
    time_t created_at;
    int step;
    int is_active;
} Session;

// Global storage (in production, use database)
User users[MAX_USERS];
Session sessions[MAX_SESSIONS];
int user_count = 0;
int session_count = 0;

// Simple JSON-like response functions
void send_response(int client_socket, int status_code, const char *content_type, const char *body) {
    char response[BUFFER_SIZE];
    char status_text[32];
    
    switch(status_code) {
        case 200: strcpy(status_text, "OK"); break;
        case 400: strcpy(status_text, "Bad Request"); break;
        case 401: strcpy(status_text, "Unauthorized"); break;
        case 500: strcpy(status_text, "Internal Server Error"); break;
        default: strcpy(status_text, "Unknown"); break;
    }
    
    snprintf(response, sizeof(response),
        "HTTP/1.1 %d %s\r\n"
        "Content-Type: %s\r\n"
        "Access-Control-Allow-Origin: *\r\n"
        "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n"
        "Access-Control-Allow-Headers: Content-Type\r\n"
        "Content-Length: %u\r\n"
        "\r\n"
        "%s",
        status_code, status_text, content_type, (unsigned int)strlen(body), body
    );
    
    send(client_socket, response, strlen(response), 0);
}

void send_json_success(int client_socket, const char *message) {
    char json[512];
    snprintf(json, sizeof(json), "{\"success\": true, \"message\": \"%s\"}", message);
    send_response(client_socket, 200, "application/json", json);
}

void send_json_error(int client_socket, int status_code, const char *message) {
    char json[512];
    snprintf(json, sizeof(json), "{\"success\": false, \"error\": \"%s\"}", message);
    send_response(client_socket, status_code, "application/json", json);
}

// Utility functions
void generate_session_id(char *session_id) {
    const char chars[] = "0123456789abcdef";
    srand((unsigned int)time(NULL));
    
    for(int i = 0; i < 36; i++) {
        if(i == 8 || i == 13 || i == 18 || i == 23) {
            session_id[i] = '-';
        } else {
            session_id[i] = chars[rand() % 16];
        }
    }
    session_id[36] = '\0';
}

void generate_otp(char *otp) {
    srand((unsigned int)time(NULL));
    for(int i = 0; i < OTP_LENGTH; i++) {
        otp[i] = '0' + (rand() % 10);
    }
    otp[OTP_LENGTH] = '\0';
}

User* find_user(const char *username) {
    for(int i = 0; i < user_count; i++) {
        if(strcmp(users[i].username, username) == 0) {
            return &users[i];
        }
    }
    return NULL;
}

Session* find_session(const char *session_id) {
    for(int i = 0; i < session_count; i++) {
        if(strcmp(sessions[i].session_id, session_id) == 0 && sessions[i].is_active) {
            return &sessions[i];
        }
    }
    return NULL;
}

Session* create_session(const char *username) {
    if(session_count >= MAX_SESSIONS) return NULL;
    
    Session *session = &sessions[session_count++];
    generate_session_id(session->session_id);
    strcpy(session->username, username);
    generate_otp(session->otp);
    session->created_at = time(NULL);
    session->step = 1;
    session->is_active = 1;
    
    return session;
}

// Simple JSON parsing (very basic)
char* extract_json_value(const char *json, const char *key) {
    static char value[256];
    char search_key[64];
    snprintf(search_key, sizeof(search_key), "\"%s\":", key);
    
    char *pos = strstr(json, search_key);
    if(!pos) return NULL;
    
    pos += strlen(search_key);
    while(*pos == ' ' || *pos == '\t') pos++; // skip whitespace
    
    if(*pos == '"') {
        pos++; // skip opening quote
        int i = 0;
        while(*pos && *pos != '"' && i < 255) {
            value[i++] = *pos++;
        }
        value[i] = '\0';
        return value;
    }
    
    return NULL;
}

// Authentication handlers
void handle_register(int client_socket, const char *body) {
    char *username = extract_json_value(body, "username");
    char *email = extract_json_value(body, "email");
    char *password = extract_json_value(body, "password");
    char *mobile = extract_json_value(body, "mobile");
    
    if(!username || !email || !password || !mobile) {
        send_json_error(client_socket, 400, "Missing required fields");
        return;
    }
    
    if(find_user(username)) {
        send_json_error(client_socket, 400, "Username already exists");
        return;
    }
    
    if(user_count >= MAX_USERS) {
        send_json_error(client_socket, 500, "User limit reached");
        return;
    }
    
    User *user = &users[user_count++];
    user->id = user_count;
    strcpy(user->username, username);
    strcpy(user->email, email);
    strcpy(user->password, password); // In production: hash this
    strcpy(user->mobile, mobile);
    user->is_active = 1;
    
    printf("User registered: %s\n", username);
    send_json_success(client_socket, "User registered successfully");
}

void handle_login_step1(int client_socket, const char *body) {
    char *username = extract_json_value(body, "username");
    char *password = extract_json_value(body, "password");
    
    if(!username || !password) {
        send_json_error(client_socket, 400, "Missing username or password");
        return;
    }
    
    User *user = find_user(username);
    if(!user || strcmp(user->password, password) != 0) {
        send_json_error(client_socket, 401, "Invalid credentials");
        return;
    }
    
    Session *session = create_session(username);
    if(!session) {
        send_json_error(client_socket, 500, "Could not create session");
        return;
    }
    
    char response[512];
    snprintf(response, sizeof(response), 
        "{\"success\": true, \"session_id\": \"%s\", \"message\": \"OTP sent to mobile\", \"otp\": \"%s\"}", 
        session->session_id, session->otp);
    
    printf("Login step 1 for %s, OTP: %s\n", username, session->otp);
    send_response(client_socket, 200, "application/json", response);
}

void handle_login_step2(int client_socket, const char *body) {
    char *session_id = extract_json_value(body, "session_id");
    char *otp = extract_json_value(body, "otp");
    
    if(!session_id || !otp) {
        send_json_error(client_socket, 400, "Missing session_id or otp");
        return;
    }
    
    Session *session = find_session(session_id);
    if(!session || session->step != 1) {
        send_json_error(client_socket, 401, "Invalid session or step");
        return;
    }
    
    if(strcmp(session->otp, otp) != 0) {
        send_json_error(client_socket, 401, "Invalid OTP");
        return;
    }
    
    session->step = 2;
    printf("OTP verified for session %s\n", session_id);
    send_json_success(client_socket, "OTP verified, proceed to face recognition");
}

void handle_login_step3(int client_socket, const char *body) {
    char *session_id = extract_json_value(body, "session_id");
    
    if(!session_id) {
        send_json_error(client_socket, 400, "Missing session_id");
        return;
    }
    
    Session *session = find_session(session_id);
    if(!session || session->step != 2) {
        send_json_error(client_socket, 401, "Invalid session or step");
        return;
    }
    
    // In production: implement face recognition here
    // For demo: just accept any face data
    
    session->step = 3;
    char response[512];
    snprintf(response, sizeof(response), 
        "{\"success\": true, \"token\": \"jwt_token_%s\", \"message\": \"Login successful\"}", 
        session->username);
    
    printf("Face recognition completed for %s\n", session->username);
    send_response(client_socket, 200, "application/json", response);
}

void handle_resend_otp(int client_socket, const char *body) {
    char *session_id = extract_json_value(body, "session_id");
    
    if(!session_id) {
        send_json_error(client_socket, 400, "Missing session_id");
        return;
    }
    
    Session *session = find_session(session_id);
    if(!session) {
        send_json_error(client_socket, 401, "Invalid session");
        return;
    }
    
    generate_otp(session->otp);
    char response[512];
    snprintf(response, sizeof(response), 
        "{\"success\": true, \"message\": \"OTP resent\", \"otp\": \"%s\"}", 
        session->otp);
    
    printf("OTP resent for session %s: %s\n", session_id, session->otp);
    send_response(client_socket, 200, "application/json", response);
}

// Request parsing and routing
void handle_request(int client_socket, char *request) {
    char method[16], path[256], version[16];
    char *body = strstr(request, "\r\n\r\n");
    if(body) body += 4; // Skip to actual body
    
    if(sscanf(request, "%s %s %s", method, path, version) != 3) {
        send_json_error(client_socket, 400, "Invalid request format");
        return;
    }
    
    printf("Request: %s %s\n", method, path);
    
    // Handle CORS preflight
    if(strcmp(method, "OPTIONS") == 0) {
        send_response(client_socket, 200, "text/plain", "");
        return;
    }
    
    if(strcmp(method, "POST") != 0) {
        send_json_error(client_socket, 405, "Method not allowed");
        return;
    }
    
    // Route requests
    if(strcmp(path, "/api/auth/register") == 0) {
        handle_register(client_socket, body ? body : "");
    }
    else if(strcmp(path, "/api/auth/login/step1") == 0) {
        handle_login_step1(client_socket, body ? body : "");
    }
    else if(strcmp(path, "/api/auth/login/step2") == 0) {
        handle_login_step2(client_socket, body ? body : "");
    }
    else if(strcmp(path, "/api/auth/login/step3") == 0) {
        handle_login_step3(client_socket, body ? body : "");
    }
    else if(strcmp(path, "/api/auth/resend-otp") == 0) {
        handle_resend_otp(client_socket, body ? body : "");
    }
    else {
        send_json_error(client_socket, 404, "Endpoint not found");
    }
}

#ifdef _WIN32
DWORD WINAPI handle_client(LPVOID client_socket_ptr) {
    int client_socket = *(int*)client_socket_ptr;
    free(client_socket_ptr);
#else
void* handle_client(void *client_socket_ptr) {
    int client_socket = *(int*)client_socket_ptr;
    free(client_socket_ptr);
#endif
    
    char buffer[BUFFER_SIZE];
    int bytes_received = recv(client_socket, buffer, BUFFER_SIZE - 1, 0);
    
    if(bytes_received > 0) {
        buffer[bytes_received] = '\0';
        handle_request(client_socket, buffer);
    }
    
    close(client_socket);
    return 0;
}

int main() {
    printf("Task Scheduler Backend Server\n");
    printf("=============================\n");
    
#ifdef _WIN32
    WSADATA wsa_data;
    if(WSAStartup(MAKEWORD(2,2), &wsa_data) != 0) {
        printf("WSAStartup failed\n");
        return 1;
    }
#endif
    
    int server_socket = socket(AF_INET, SOCK_STREAM, 0);
    if(server_socket < 0) {
        printf("Socket creation failed\n");
        return 1;
    }
    
    // Allow socket reuse
    int opt = 1;
    setsockopt(server_socket, SOL_SOCKET, SO_REUSEADDR, (char*)&opt, sizeof(opt));
    
    struct sockaddr_in server_addr;
    server_addr.sin_family = AF_INET;
    server_addr.sin_addr.s_addr = INADDR_ANY;
    server_addr.sin_port = htons(PORT);
    
    if(bind(server_socket, (struct sockaddr*)&server_addr, sizeof(server_addr)) < 0) {
        printf("Bind failed on port %d\n", PORT);
        close(server_socket);
        return 1;
    }
    
    if(listen(server_socket, 10) < 0) {
        printf("Listen failed\n");
        close(server_socket);
        return 1;
    }
    
    printf("Server listening on port %d\n", PORT);
    printf("API Endpoints:\n");
    printf("  POST /api/auth/register\n");
    printf("  POST /api/auth/login/step1\n");
    printf("  POST /api/auth/login/step2\n");
    printf("  POST /api/auth/login/step3\n");
    printf("  POST /api/auth/resend-otp\n");
    printf("\nPress Ctrl+C to stop\n\n");
    
    while(1) {
        struct sockaddr_in client_addr;
        int addr_len = sizeof(client_addr);
        int client_socket = accept(server_socket, (struct sockaddr*)&client_addr, &addr_len);
        
        if(client_socket >= 0) {
            int *client_ptr = malloc(sizeof(int));
            *client_ptr = client_socket;
            
#ifdef _WIN32
            CreateThread(NULL, 0, handle_client, client_ptr, 0, NULL);
#else
            pthread_t thread;
            pthread_create(&thread, NULL, handle_client, client_ptr);
            pthread_detach(thread);
#endif
        }
    }
    
    close(server_socket);
#ifdef _WIN32
    WSACleanup();
#endif
    return 0;
}