/*
 * Task Scheduler Database Schema
 * SQLite initialization script for production deployment
 */

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- Enable Write-Ahead Logging for better concurrency
PRAGMA journal_mode = WAL;

-- Set cache size for better performance
PRAGMA cache_size = 10000;

-- Users table with enhanced security features
CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL COLLATE NOCASE,
    email TEXT UNIQUE NOT NULL COLLATE NOCASE,
    mobile TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    failed_attempts INTEGER DEFAULT 0,
    locked_until INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now')),
    last_login INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    email_verified INTEGER DEFAULT 0,
    mobile_verified INTEGER DEFAULT 0,
    two_factor_enabled INTEGER DEFAULT 0,
    profile_photo_path TEXT,
    timezone TEXT DEFAULT 'UTC',
    language TEXT DEFAULT 'en',
    notification_preferences TEXT DEFAULT '{"email":true,"sms":true,"push":true}'
);

-- Sessions table for authentication management
CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    last_activity INTEGER DEFAULT (strftime('%s', 'now')),
    expires_at INTEGER NOT NULL,
    is_authenticated INTEGER DEFAULT 0,
    auth_level INTEGER DEFAULT 0, -- 0: none, 1: password, 2: +OTP, 3: +face
    ip_address TEXT,
    user_agent TEXT,
    device_fingerprint TEXT,
    is_mobile INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);

-- Tasks table with enhanced scheduling features
CREATE TABLE IF NOT EXISTS tasks (
    task_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'cancelled', 'failed')),
    category TEXT DEFAULT 'general',
    tags TEXT, -- JSON array of tags
    scheduled_time INTEGER,
    start_time INTEGER,
    end_time INTEGER,
    estimated_duration INTEGER, -- in minutes
    actual_duration INTEGER, -- in minutes
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now')),
    completed_at INTEGER,
    is_recurring INTEGER DEFAULT 0,
    recurrence_pattern TEXT, -- JSON with recurrence rules
    parent_task_id INTEGER, -- for subtasks
    attachment_path TEXT,
    location TEXT,
    reminder_time INTEGER,
    reminder_sent INTEGER DEFAULT 0,
    progress_percentage INTEGER DEFAULT 0,
    notes TEXT,
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    FOREIGN KEY (parent_task_id) REFERENCES tasks (task_id) ON DELETE CASCADE
);

-- Task dependencies for complex workflows
CREATE TABLE IF NOT EXISTS task_dependencies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    depends_on_task_id INTEGER NOT NULL,
    dependency_type TEXT DEFAULT 'finish_to_start' CHECK (dependency_type IN ('finish_to_start', 'start_to_start', 'finish_to_finish', 'start_to_finish')),
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (task_id) REFERENCES tasks (task_id) ON DELETE CASCADE,
    FOREIGN KEY (depends_on_task_id) REFERENCES tasks (task_id) ON DELETE CASCADE,
    UNIQUE(task_id, depends_on_task_id)
);

-- OTP codes for two-factor authentication
CREATE TABLE IF NOT EXISTS otp_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    email TEXT,
    mobile TEXT,
    otp_code TEXT NOT NULL,
    otp_type TEXT DEFAULT 'login' CHECK (otp_type IN ('login', 'register', 'password_reset', 'email_verify', 'mobile_verify')),
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    expires_at INTEGER NOT NULL,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    is_used INTEGER DEFAULT 0,
    used_at INTEGER,
    ip_address TEXT,
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);

-- Rate limiting with enhanced tracking
CREATE TABLE IF NOT EXISTS rate_limits (
    ip_address TEXT PRIMARY KEY,
    request_count INTEGER DEFAULT 0,
    window_start INTEGER DEFAULT (strftime('%s', 'now')),
    last_request INTEGER DEFAULT (strftime('%s', 'now')),
    blocked_until INTEGER DEFAULT 0,
    total_requests INTEGER DEFAULT 0,
    violation_count INTEGER DEFAULT 0
);

-- Activity logs for security auditing
CREATE TABLE IF NOT EXISTS activity_logs (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    resource_type TEXT, -- 'user', 'task', 'session', etc.
    resource_id TEXT,
    details TEXT, -- JSON with additional information
    ip_address TEXT,
    user_agent TEXT,
    timestamp INTEGER DEFAULT (strftime('%s', 'now')),
    success INTEGER DEFAULT 1,
    error_message TEXT,
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE SET NULL
);

-- Notifications queue
CREATE TABLE IF NOT EXISTS notifications (
    notification_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('task_reminder', 'task_overdue', 'system', 'security')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data TEXT, -- JSON with additional data
    is_read INTEGER DEFAULT 0,
    is_sent INTEGER DEFAULT 0,
    send_at INTEGER DEFAULT (strftime('%s', 'now')),
    sent_at INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    channels TEXT DEFAULT '["app"]', -- JSON array: app, email, sms, push
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);

-- User preferences and settings
CREATE TABLE IF NOT EXISTS user_settings (
    user_id INTEGER PRIMARY KEY,
    theme TEXT DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'auto')),
    language TEXT DEFAULT 'en',
    timezone TEXT DEFAULT 'UTC',
    date_format TEXT DEFAULT 'YYYY-MM-DD',
    time_format TEXT DEFAULT '24h' CHECK (time_format IN ('12h', '24h')),
    week_start TEXT DEFAULT 'monday' CHECK (week_start IN ('sunday', 'monday')),
    notification_settings TEXT DEFAULT '{"email":true,"sms":true,"push":true,"desktop":true}',
    privacy_settings TEXT DEFAULT '{"profile_visibility":"private","activity_visibility":"private"}',
    productivity_settings TEXT DEFAULT '{"pomodoro_duration":25,"break_duration":5,"daily_goal":8}',
    dashboard_layout TEXT DEFAULT '{"widgets":["upcoming_tasks","productivity_chart","recent_activity"]}',
    auto_backup INTEGER DEFAULT 1,
    data_retention_days INTEGER DEFAULT 365,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);

-- Performance indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_created ON users(created_at);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON sessions(last_activity);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_auth_level ON sessions(auth_level);

CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_scheduled_time ON tasks(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category);
CREATE INDEX IF NOT EXISTS idx_tasks_recurring ON tasks(is_recurring);

CREATE INDEX IF NOT EXISTS idx_task_deps_task_id ON task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_task_deps_depends_on ON task_dependencies(depends_on_task_id);

CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_codes(email);
CREATE INDEX IF NOT EXISTS idx_otp_mobile ON otp_codes(mobile);
CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_otp_type ON otp_codes(otp_type);

CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start);
CREATE INDEX IF NOT EXISTS idx_rate_limits_blocked ON rate_limits(blocked_until);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON activity_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_resource ON activity_logs(resource_type, resource_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_send_at ON notifications(send_at);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);

-- Triggers for maintaining data integrity and automatic updates

-- Update timestamp trigger for users
CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
    AFTER UPDATE ON users
    FOR EACH ROW
BEGIN
    UPDATE users SET updated_at = strftime('%s', 'now') WHERE user_id = NEW.user_id;
END;

-- Update timestamp trigger for tasks
CREATE TRIGGER IF NOT EXISTS update_tasks_timestamp 
    AFTER UPDATE ON tasks
    FOR EACH ROW
BEGIN
    UPDATE tasks SET updated_at = strftime('%s', 'now') WHERE task_id = NEW.task_id;
END;

-- Auto-complete parent task when all subtasks are completed
CREATE TRIGGER IF NOT EXISTS auto_complete_parent_task
    AFTER UPDATE OF status ON tasks
    FOR EACH ROW
    WHEN NEW.status = 'completed' AND NEW.parent_task_id IS NOT NULL
BEGIN
    UPDATE tasks 
    SET status = 'completed', 
        completed_at = strftime('%s', 'now'),
        progress_percentage = 100
    WHERE task_id = NEW.parent_task_id 
    AND NOT EXISTS (
        SELECT 1 FROM tasks 
        WHERE parent_task_id = NEW.parent_task_id 
        AND status != 'completed'
    );
END;

-- Log user activity
CREATE TRIGGER IF NOT EXISTS log_user_login
    AFTER INSERT ON sessions
    FOR EACH ROW
BEGIN
    INSERT INTO activity_logs (user_id, action, resource_type, resource_id, ip_address)
    VALUES (NEW.user_id, 'login_attempt', 'session', NEW.session_id, NEW.ip_address);
END;

-- Cleanup expired OTP codes
CREATE TRIGGER IF NOT EXISTS cleanup_expired_otp
    AFTER INSERT ON otp_codes
    FOR EACH ROW
BEGIN
    DELETE FROM otp_codes 
    WHERE expires_at < strftime('%s', 'now') 
    AND is_used = 0;
END;

-- Views for commonly used queries

-- Active users with session info
CREATE VIEW IF NOT EXISTS v_active_users AS
SELECT 
    u.user_id,
    u.username,
    u.email,
    u.created_at,
    u.last_login,
    s.session_id,
    s.last_activity,
    s.auth_level
FROM users u
LEFT JOIN sessions s ON u.user_id = s.user_id 
    AND s.expires_at > strftime('%s', 'now')
WHERE u.is_active = 1;

-- Task summary by user
CREATE VIEW IF NOT EXISTS v_task_summary AS
SELECT 
    user_id,
    COUNT(*) as total_tasks,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_tasks,
    COUNT(CASE WHEN status = 'running' THEN 1 END) as running_tasks,
    COUNT(CASE WHEN priority = 'high' OR priority = 'urgent' THEN 1 END) as high_priority_tasks,
    AVG(CASE WHEN actual_duration IS NOT NULL THEN actual_duration END) as avg_duration
FROM tasks
GROUP BY user_id;

-- Overdue tasks
CREATE VIEW IF NOT EXISTS v_overdue_tasks AS
SELECT 
    t.*,
    u.username,
    u.email
FROM tasks t
JOIN users u ON t.user_id = u.user_id
WHERE t.scheduled_time < strftime('%s', 'now')
    AND t.status IN ('pending', 'running')
    AND u.is_active = 1;

-- Recent activity feed
CREATE VIEW IF NOT EXISTS v_recent_activity AS
SELECT 
    al.*,
    u.username
FROM activity_logs al
LEFT JOIN users u ON al.user_id = u.user_id
ORDER BY al.timestamp DESC
LIMIT 100;