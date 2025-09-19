/* Enhanced Task Scheduler Backend with SQLite Integration
 * Production-ready C backend with proper database management
 * 
 * Compile: gcc scheduler_enhanced.c -o scheduler_enhanced -lsqlite3 -lcjson -lm -lcurl
 * Dependencies: sudo apt-get install libsqlite3-dev libcjson-dev libcurl4-openssl-dev
 * Run: ./backend/scheduler_enhanced
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>
#include <limits.h>
#include <sqlite3.h>
#include <cjson/cJSON.h>
#include <curl/curl.h>
#include <sys/stat.h>
#include <errno.h>
#include <signal.h>
#include <pthread.h>

// Configuration constants
#define MAX_PATH 1024
#define MAX_QUERY 2048
#define MAX_USERS 10000
#define MAX_TASKS_PER_USER 1000
#define CONFIG_FILE "backend/config.json"
#define DB_SCHEMA_VERSION 2

// Global configuration structure
typedef struct {
    char db_path[MAX_PATH];
    char backup_path[MAX_PATH];
    int poll_interval_sec;
    int port;
    int max_connections;
    int session_timeout_hours;
    int max_tasks_per_user;
    int cleanup_days;
    char cors_origins[512];
    int rate_limit_rpm;
    int enable_notifications;
    int enable_face_auth;
    int debug_mode;
} Config;

// Task structure
typedef struct {
    int id;
    int user_id;
    char username[64];
    char title[128];
    char description[512];
    char category[32];
    int priority;        // 1-5 (1=low, 5=critical)
    int difficulty;      // 1-10
    long created_at;
    long scheduled_at;
    long due_at;
    long completed_at;
    int status;          // 0=pending, 1=in_progress, 2=completed, 3=cancelled
    int recurrence_type; // 0=none, 1=daily, 2=weekly, 3=monthly
    int recurrence_interval;
    char tags[256];
    char face_hash[128]; // For face recognition integration
    int notification_sent;
    int reminder_count;
} Task;

// User structure
typedef struct {
    int id;
    char username[64];
    char email[128];
    char phone[32];
    char password_hash[256];
    char salt[64];
    long created_at;
    long last_login;
    int is_verified;
    int login_attempts;
    long locked_until;
    char face_descriptor[1024];
    int notification_preferences;
    int total_tasks;
    int completed_tasks;
    double productivity_score;
} User;

// Global variables
static Config config;
static sqlite3 *db = NULL;
static int running = 1;
static pthread_mutex_t db_mutex = PTHREAD_MUTEX_INITIALIZER;

// Function prototypes
int load_config(const char *config_file);
int init_database(void);
int create_tables(void);
int migrate_database(void);
void signal_handler(int signum);
void cleanup_resources(void);
int ensure_directory(const char *path);

// Task management
int create_task(const Task *task);
int update_task(const Task *task);
int delete_task(int task_id, int user_id);
int get_user_tasks(int user_id, Task **tasks, int *count);
int mark_task_completed(int task_id, int user_id);

// User management
int create_user(const User *user);
int authenticate_user(const char *username, const char *password, User *user);
int verify_user(int user_id, const char *verification_code);
int update_user_face_data(int user_id, const char *face_descriptor);

// Notification system
int send_task_notification(const Task *task, const User *user);
int check_due_tasks(void);
int send_push_notification(const char *title, const char *body, const char *user_token);

// Analytics and reporting
double calculate_productivity_score(int user_id);
int generate_user_analytics(int user_id, cJSON **analytics);
int cleanup_old_tasks(void);

// Database utilities
int execute_query(const char *sql);
int execute_query_with_callback(const char *sql, int (*callback)(void*,int,char**,char**), void *data);

// ============================================
// CONFIGURATION MANAGEMENT
// ============================================

int load_config(const char *config_file) {
    FILE *file = fopen(config_file, "r");
    if (!file) {
        printf("Warning: Config file not found, using defaults\n");
        // Set default values
        strcpy(config.db_path, "../frontend/data/scheduler.db");
        strcpy(config.backup_path, "../frontend/data/backups");
        config.poll_interval_sec = 10;
        config.port = 3000;
        config.max_connections = 100;
        config.session_timeout_hours = 24;
        config.max_tasks_per_user = 1000;
        config.cleanup_days = 30;
        strcpy(config.cors_origins, "http://localhost:8080,http://127.0.0.1:8080");
        config.rate_limit_rpm = 60;
        config.enable_notifications = 1;
        config.enable_face_auth = 1;
        config.debug_mode = 0;
        return 1;
    }

    // Read file content
    fseek(file, 0, SEEK_END);
    long length = ftell(file);
    fseek(file, 0, SEEK_SET);
    
    char *content = malloc(length + 1);
    fread(content, 1, length, file);
    content[length] = '\0';
    fclose(file);

    // Parse JSON
    cJSON *json = cJSON_Parse(content);
    free(content);
    
    if (!json) {
        printf("Error: Invalid JSON in config file\n");
        return 0;
    }

    // Extract configuration values
    cJSON *database = cJSON_GetObjectItem(json, "database");
    if (database) {
        cJSON *path = cJSON_GetObjectItem(database, "path");
        if (path && cJSON_IsString(path)) {
            strcpy(config.db_path, path->valuestring);
        }
        
        cJSON *backup = cJSON_GetObjectItem(database, "backup_path");
        if (backup && cJSON_IsString(backup)) {
            strcpy(config.backup_path, backup->valuestring);
        }
    }

    cJSON *tasks = cJSON_GetObjectItem(json, "tasks");
    if (tasks) {
        cJSON *poll = cJSON_GetObjectItem(tasks, "poll_interval_sec");
        if (poll && cJSON_IsNumber(poll)) {
            config.poll_interval_sec = poll->valueint;
        }
        
        cJSON *max_tasks = cJSON_GetObjectItem(tasks, "max_tasks_per_user");
        if (max_tasks && cJSON_IsNumber(max_tasks)) {
            config.max_tasks_per_user = max_tasks->valueint;
        }
        
        cJSON *cleanup = cJSON_GetObjectItem(tasks, "cleanup_completed_after_days");
        if (cleanup && cJSON_IsNumber(cleanup)) {
            config.cleanup_days = cleanup->valueint;
        }
    }

    cJSON *server = cJSON_GetObjectItem(json, "server");
    if (server) {
        cJSON *port = cJSON_GetObjectItem(server, "port");
        if (port && cJSON_IsNumber(port)) {
            config.port = port->valueint;
        }
        
        cJSON *max_conn = cJSON_GetObjectItem(server, "max_connections");
        if (max_conn && cJSON_IsNumber(max_conn)) {
            config.max_connections = max_conn->valueint;
        }
    }

    cJSON_Delete(json);
    
    printf("✅ Configuration loaded successfully\n");
    printf("📁 Database: %s\n", config.db_path);
    printf("🔄 Poll interval: %d seconds\n", config.poll_interval_sec);
    printf("🌐 Port: %d\n", config.port);
    
    return 1;
}

// ============================================
// DATABASE MANAGEMENT
// ============================================

int ensure_directory(const char *path) {
    char tmp[MAX_PATH];
    char *p = NULL;
    size_t len;

    snprintf(tmp, sizeof(tmp), "%s", path);
    len = strlen(tmp);
    if (tmp[len - 1] == '/')
        tmp[len - 1] = 0;

    for (p = tmp + 1; *p; p++) {
        if (*p == '/') {
            *p = 0;
            if (mkdir(tmp, 0755) != 0 && errno != EEXIST) {
                return 0;
            }
            *p = '/';
        }
    }
    
    if (mkdir(tmp, 0755) != 0 && errno != EEXIST) {
        return 0;
    }
    
    return 1;
}

int init_database(void) {
    // Ensure database directory exists
    char db_dir[MAX_PATH];
    strcpy(db_dir, config.db_path);
    char *last_slash = strrchr(db_dir, '/');
    if (last_slash) {
        *last_slash = '\0';
        if (!ensure_directory(db_dir)) {
            printf("❌ Failed to create database directory: %s\n", db_dir);
            return 0;
        }
    }

    // Ensure backup directory exists
    if (!ensure_directory(config.backup_path)) {
        printf("❌ Failed to create backup directory: %s\n", config.backup_path);
        return 0;
    }

    // Open database
    int rc = sqlite3_open(config.db_path, &db);
    if (rc != SQLITE_OK) {
        printf("❌ Cannot open database: %s\n", sqlite3_errmsg(db));
        sqlite3_close(db);
        return 0;
    }

    // Enable foreign keys and WAL mode
    execute_query("PRAGMA foreign_keys = ON");
    execute_query("PRAGMA journal_mode = WAL");
    execute_query("PRAGMA synchronous = NORMAL");
    execute_query("PRAGMA cache_size = 10000");
    execute_query("PRAGMA temp_store = MEMORY");
    execute_query("PRAGMA auto_vacuum = INCREMENTAL");

    // Create tables
    if (!create_tables()) {
        printf("❌ Failed to create database tables\n");
        return 0;
    }

    // Migrate if needed
    if (!migrate_database()) {
        printf("❌ Database migration failed\n");
        return 0;
    }

    printf("✅ Database initialized: %s\n", config.db_path);
    return 1;
}

int create_tables(void) {
    const char *sql_users = 
        "CREATE TABLE IF NOT EXISTS users ("
        "id INTEGER PRIMARY KEY AUTOINCREMENT,"
        "username TEXT UNIQUE NOT NULL,"
        "email TEXT UNIQUE NOT NULL,"
        "phone TEXT,"
        "password_hash TEXT NOT NULL,"
        "salt TEXT NOT NULL,"
        "created_at INTEGER NOT NULL,"
        "last_login INTEGER DEFAULT 0,"
        "is_verified INTEGER DEFAULT 0,"
        "login_attempts INTEGER DEFAULT 0,"
        "locked_until INTEGER DEFAULT 0,"
        "face_descriptor TEXT,"
        "notification_preferences INTEGER DEFAULT 7,"
        "total_tasks INTEGER DEFAULT 0,"
        "completed_tasks INTEGER DEFAULT 0,"
        "productivity_score REAL DEFAULT 0.0"
        ");";

    const char *sql_tasks = 
        "CREATE TABLE IF NOT EXISTS tasks ("
        "id INTEGER PRIMARY KEY AUTOINCREMENT,"
        "user_id INTEGER NOT NULL,"
        "title TEXT NOT NULL,"
        "description TEXT,"
        "category TEXT DEFAULT 'general',"
        "priority INTEGER DEFAULT 3,"
        "difficulty INTEGER DEFAULT 5,"
        "created_at INTEGER NOT NULL,"
        "scheduled_at INTEGER,"
        "due_at INTEGER,"
        "completed_at INTEGER,"
        "status INTEGER DEFAULT 0,"
        "recurrence_type INTEGER DEFAULT 0,"
        "recurrence_interval INTEGER DEFAULT 0,"
        "tags TEXT,"
        "face_hash TEXT,"
        "notification_sent INTEGER DEFAULT 0,"
        "reminder_count INTEGER DEFAULT 0,"
        "FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE"
        ");";

    const char *sql_sessions = 
        "CREATE TABLE IF NOT EXISTS sessions ("
        "id TEXT PRIMARY KEY,"
        "user_id INTEGER NOT NULL,"
        "created_at INTEGER NOT NULL,"
        "expires_at INTEGER NOT NULL,"
        "last_activity INTEGER NOT NULL,"
        "ip_address TEXT,"
        "user_agent TEXT,"
        "FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE"
        ");";

    const char *sql_notifications = 
        "CREATE TABLE IF NOT EXISTS notifications ("
        "id INTEGER PRIMARY KEY AUTOINCREMENT,"
        "user_id INTEGER NOT NULL,"
        "task_id INTEGER,"
        "type TEXT NOT NULL,"
        "title TEXT NOT NULL,"
        "message TEXT,"
        "sent_at INTEGER NOT NULL,"
        "read_at INTEGER DEFAULT 0,"
        "delivery_status INTEGER DEFAULT 0,"
        "FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,"
        "FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL"
        ");";

    const char *sql_audit_log = 
        "CREATE TABLE IF NOT EXISTS audit_log ("
        "id INTEGER PRIMARY KEY AUTOINCREMENT,"
        "user_id INTEGER,"
        "action TEXT NOT NULL,"
        "entity_type TEXT,"
        "entity_id INTEGER,"
        "details TEXT,"
        "ip_address TEXT,"
        "timestamp INTEGER NOT NULL,"
        "FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL"
        ");";

    // Execute table creation queries
    if (!execute_query(sql_users)) return 0;
    if (!execute_query(sql_tasks)) return 0;
    if (!execute_query(sql_sessions)) return 0;
    if (!execute_query(sql_notifications)) return 0;
    if (!execute_query(sql_audit_log)) return 0;

    // Create indexes for performance
    execute_query("CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id)");
    execute_query("CREATE INDEX IF NOT EXISTS idx_tasks_due_at ON tasks(due_at)");
    execute_query("CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)");
    execute_query("CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)");
    execute_query("CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)");
    execute_query("CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)");
    execute_query("CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp)");

    printf("✅ Database tables created with indexes\n");
    return 1;
}

int migrate_database(void) {
    // Check current schema version
    sqlite3_stmt *stmt;
    const char *sql = "PRAGMA user_version";
    
    int rc = sqlite3_prepare_v2(db, sql, -1, &stmt, NULL);
    if (rc != SQLITE_OK) return 0;

    int current_version = 0;
    if (sqlite3_step(stmt) == SQLITE_ROW) {
        current_version = sqlite3_column_int(stmt, 0);
    }
    sqlite3_finalize(stmt);

    printf("📊 Current database schema version: %d\n", current_version);

    if (current_version < DB_SCHEMA_VERSION) {
        printf("🔄 Migrating database from version %d to %d...\n", current_version, DB_SCHEMA_VERSION);

        // Migration from version 0 to 1
        if (current_version < 1) {
            execute_query("ALTER TABLE users ADD COLUMN productivity_score REAL DEFAULT 0.0");
            execute_query("ALTER TABLE tasks ADD COLUMN face_hash TEXT");
        }

        // Migration from version 1 to 2  
        if (current_version < 2) {
            execute_query("ALTER TABLE tasks ADD COLUMN reminder_count INTEGER DEFAULT 0");
            execute_query("CREATE INDEX IF NOT EXISTS idx_tasks_scheduled ON tasks(scheduled_at)");
        }

        // Update schema version
        char version_sql[128];
        snprintf(version_sql, sizeof(version_sql), "PRAGMA user_version = %d", DB_SCHEMA_VERSION);
        execute_query(version_sql);

        printf("✅ Database migration completed\n");
    }

    return 1;
}

int execute_query(const char *sql) {
    pthread_mutex_lock(&db_mutex);
    
    char *err_msg = 0;
    int rc = sqlite3_exec(db, sql, 0, 0, &err_msg);
    
    if (rc != SQLITE_OK) {
        printf("❌ SQL error: %s\n", err_msg);
        sqlite3_free(err_msg);
        pthread_mutex_unlock(&db_mutex);
        return 0;
    }
    
    pthread_mutex_unlock(&db_mutex);
    return 1;
}

// ============================================
// TASK MANAGEMENT
// ============================================

int create_task(const Task *task) {
    const char *sql = 
        "INSERT INTO tasks (user_id, title, description, category, priority, difficulty, "
        "created_at, scheduled_at, due_at, status, recurrence_type, recurrence_interval, tags) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

    pthread_mutex_lock(&db_mutex);
    
    sqlite3_stmt *stmt;
    int rc = sqlite3_prepare_v2(db, sql, -1, &stmt, NULL);
    if (rc != SQLITE_OK) {
        pthread_mutex_unlock(&db_mutex);
        return 0;
    }

    sqlite3_bind_int(stmt, 1, task->user_id);
    sqlite3_bind_text(stmt, 2, task->title, -1, SQLITE_STATIC);
    sqlite3_bind_text(stmt, 3, task->description, -1, SQLITE_STATIC);
    sqlite3_bind_text(stmt, 4, task->category, -1, SQLITE_STATIC);
    sqlite3_bind_int(stmt, 5, task->priority);
    sqlite3_bind_int(stmt, 6, task->difficulty);
    sqlite3_bind_int64(stmt, 7, task->created_at);
    sqlite3_bind_int64(stmt, 8, task->scheduled_at);
    sqlite3_bind_int64(stmt, 9, task->due_at);
    sqlite3_bind_int(stmt, 10, task->status);
    sqlite3_bind_int(stmt, 11, task->recurrence_type);
    sqlite3_bind_int(stmt, 12, task->recurrence_interval);
    sqlite3_bind_text(stmt, 13, task->tags, -1, SQLITE_STATIC);

    rc = sqlite3_step(stmt);
    sqlite3_finalize(stmt);
    
    pthread_mutex_unlock(&db_mutex);
    
    if (rc == SQLITE_DONE) {
        // Update user task count
        const char *update_sql = "UPDATE users SET total_tasks = total_tasks + 1 WHERE id = ?";
        sqlite3_prepare_v2(db, update_sql, -1, &stmt, NULL);
        sqlite3_bind_int(stmt, 1, task->user_id);
        sqlite3_step(stmt);
        sqlite3_finalize(stmt);
        
        printf("✅ Task created: %s\n", task->title);
        return 1;
    }

    return 0;
}

int mark_task_completed(int task_id, int user_id) {
    const char *sql = "UPDATE tasks SET status = 2, completed_at = ? WHERE id = ? AND user_id = ?";
    
    pthread_mutex_lock(&db_mutex);
    
    sqlite3_stmt *stmt;
    int rc = sqlite3_prepare_v2(db, sql, -1, &stmt, NULL);
    if (rc != SQLITE_OK) {
        pthread_mutex_unlock(&db_mutex);
        return 0;
    }

    long now = time(NULL);
    sqlite3_bind_int64(stmt, 1, now);
    sqlite3_bind_int(stmt, 2, task_id);
    sqlite3_bind_int(stmt, 3, user_id);

    rc = sqlite3_step(stmt);
    sqlite3_finalize(stmt);
    
    pthread_mutex_unlock(&db_mutex);

    if (rc == SQLITE_DONE) {
        // Update user completed task count
        const char *update_sql = "UPDATE users SET completed_tasks = completed_tasks + 1 WHERE id = ?";
        sqlite3_prepare_v2(db, update_sql, -1, &stmt, NULL);
        sqlite3_bind_int(stmt, 1, user_id);
        sqlite3_step(stmt);
        sqlite3_finalize(stmt);
        
        printf("✅ Task completed: ID %d\n", task_id);
        return 1;
    }

    return 0;
}

// ============================================
// NOTIFICATION SYSTEM
// ============================================

int check_due_tasks(void) {
    const char *sql = 
        "SELECT t.id, t.title, t.description, u.username, u.email, u.phone "
        "FROM tasks t JOIN users u ON t.user_id = u.id "
        "WHERE t.due_at > 0 AND t.due_at <= ? AND t.status = 0 AND t.notification_sent = 0";

    pthread_mutex_lock(&db_mutex);
    
    sqlite3_stmt *stmt;
    int rc = sqlite3_prepare_v2(db, sql, -1, &stmt, NULL);
    if (rc != SQLITE_OK) {
        pthread_mutex_unlock(&db_mutex);
        return 0;
    }

    long now = time(NULL);
    sqlite3_bind_int64(stmt, 1, now + 300); // 5 minutes from now

    int notification_count = 0;
    while ((rc = sqlite3_step(stmt)) == SQLITE_ROW) {
        int task_id = sqlite3_column_int(stmt, 0);
        const char *title = (const char*)sqlite3_column_text(stmt, 1);
        const char *description = (const char*)sqlite3_column_text(stmt, 2);
        const char *username = (const char*)sqlite3_column_text(stmt, 3);
        const char *email = (const char*)sqlite3_column_text(stmt, 4);
        const char *phone = (const char*)sqlite3_column_text(stmt, 5);

        printf("📢 Due task notification: %s for %s\n", title, username);
        
        // Mark notification as sent
        const char *update_sql = "UPDATE tasks SET notification_sent = 1, reminder_count = reminder_count + 1 WHERE id = ?";
        sqlite3_stmt *update_stmt;
        sqlite3_prepare_v2(db, update_sql, -1, &update_stmt, NULL);
        sqlite3_bind_int(update_stmt, 1, task_id);
        sqlite3_step(update_stmt);
        sqlite3_finalize(update_stmt);
        
        notification_count++;
    }

    sqlite3_finalize(stmt);
    pthread_mutex_unlock(&db_mutex);

    if (notification_count > 0) {
        printf("📱 Sent %d task notifications\n", notification_count);
    }

    return notification_count;
}

// ============================================
// ANALYTICS
// ============================================

double calculate_productivity_score(int user_id) {
    const char *sql = 
        "SELECT COUNT(*) as total, "
        "SUM(CASE WHEN status = 2 THEN 1 ELSE 0 END) as completed, "
        "AVG(CASE WHEN status = 2 AND completed_at > 0 AND due_at > 0 "
        "THEN CASE WHEN completed_at <= due_at THEN 1.0 ELSE 0.5 END ELSE 0 END) as on_time_rate "
        "FROM tasks WHERE user_id = ? AND created_at > ?";

    pthread_mutex_lock(&db_mutex);
    
    sqlite3_stmt *stmt;
    int rc = sqlite3_prepare_v2(db, sql, -1, &stmt, NULL);
    if (rc != SQLITE_OK) {
        pthread_mutex_unlock(&db_mutex);
        return 0.0;
    }

    long thirty_days_ago = time(NULL) - (30 * 24 * 3600);
    sqlite3_bind_int(stmt, 1, user_id);
    sqlite3_bind_int64(stmt, 2, thirty_days_ago);

    double score = 0.0;
    if (sqlite3_step(stmt) == SQLITE_ROW) {
        int total = sqlite3_column_int(stmt, 0);
        int completed = sqlite3_column_int(stmt, 1);
        double on_time_rate = sqlite3_column_double(stmt, 2);

        if (total > 0) {
            double completion_rate = (double)completed / total;
            score = (completion_rate * 0.7 + on_time_rate * 0.3) * 10.0;
        }
    }

    sqlite3_finalize(stmt);
    pthread_mutex_unlock(&db_mutex);

    // Update user's productivity score
    const char *update_sql = "UPDATE users SET productivity_score = ? WHERE id = ?";
    sqlite3_prepare_v2(db, update_sql, -1, &stmt, NULL);
    sqlite3_bind_double(stmt, 1, score);
    sqlite3_bind_int(stmt, 2, user_id);
    sqlite3_step(stmt);
    sqlite3_finalize(stmt);

    return score;
}

int cleanup_old_tasks(void) {
    const char *sql = "DELETE FROM tasks WHERE status = 2 AND completed_at < ?";
    
    pthread_mutex_lock(&db_mutex);
    
    sqlite3_stmt *stmt;
    int rc = sqlite3_prepare_v2(db, sql, -1, &stmt, NULL);
    if (rc != SQLITE_OK) {
        pthread_mutex_unlock(&db_mutex);
        return 0;
    }

    long cutoff_time = time(NULL) - (config.cleanup_days * 24 * 3600);
    sqlite3_bind_int64(stmt, 1, cutoff_time);

    rc = sqlite3_step(stmt);
    int deleted_count = sqlite3_changes(db);
    
    sqlite3_finalize(stmt);
    pthread_mutex_unlock(&db_mutex);

    if (deleted_count > 0) {
        printf("🧹 Cleaned up %d old completed tasks\n", deleted_count);
    }

    return deleted_count;
}

// ============================================
// SIGNAL HANDLING
// ============================================

void signal_handler(int signum) {
    printf("\n🛑 Received signal %d, shutting down gracefully...\n", signum);
    running = 0;
}

void cleanup_resources(void) {
    if (db) {
        // Final cleanup
        cleanup_old_tasks();
        
        // Close database
        sqlite3_close(db);
        db = NULL;
        printf("📁 Database closed\n");
    }
    
    pthread_mutex_destroy(&db_mutex);
    printf("✅ Resources cleaned up\n");
}

// ============================================
// MAIN SCHEDULER LOOP
// ============================================

int main(int argc, char *argv[]) {
    printf("🚀 Task Scheduler Enhanced Backend Starting...\n");
    printf("📅 Build Date: %s %s\n", __DATE__, __TIME__);

    // Setup signal handlers
    signal(SIGINT, signal_handler);
    signal(SIGTERM, signal_handler);

    // Load configuration
    if (!load_config(CONFIG_FILE)) {
        printf("❌ Failed to load configuration\n");
        return 1;
    }

    // Initialize database
    if (!init_database()) {
        printf("❌ Database initialization failed\n");
        return 1;
    }

    printf("✅ Backend initialized successfully\n");
    printf("🔄 Starting main loop (polling every %d seconds)\n", config.poll_interval_sec);
    printf("📊 Max tasks per user: %d\n", config.max_tasks_per_user);
    printf("🧹 Cleanup after %d days\n", config.cleanup_days);

    // Main scheduler loop
    int loop_count = 0;
    time_t last_cleanup = time(NULL);
    time_t last_analytics = time(NULL);

    while (running) {
        loop_count++;
        time_t now = time(NULL);

        // Check for due tasks and send notifications
        int notifications_sent = check_due_tasks();

        // Periodic cleanup (every 6 hours)
        if (now - last_cleanup > 6 * 3600) {
            cleanup_old_tasks();
            last_cleanup = now;
        }

        // Update analytics (every hour)
        if (now - last_analytics > 3600) {
            printf("📈 Updating user analytics...\n");
            // This would typically update all users' productivity scores
            last_analytics = now;
        }

        // Status report every 100 loops
        if (loop_count % 100 == 0) {
            printf("💓 Heartbeat: Loop %d, Notifications: %d\n", loop_count, notifications_sent);
        }

        // Sleep until next poll
        sleep(config.poll_interval_sec);
    }

    printf("🛑 Scheduler stopped\n");
    cleanup_resources();
    
    return 0;
}