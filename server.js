// Main server entry point for Railway deploymentconst express = require('express');

// This file loads the proper server based on environmentconst cors = require('cors');

const bodyParser = require('body-parser');

const path = require('path');const path = require('path');

require('dotenv').config();const helmet = require('helmet');

const compression = require('compression');

// In production, use the Node.js/PostgreSQL backendconst morgan = require('morgan');

// In development, could optionally use C backendconst sqlite3 = require('sqlite3').verbose();

const serverFile = './server-c-wrapper.js';const bcrypt = require('bcryptjs');

const jwt = require('jsonwebtoken');

console.log(`Starting server with: ${serverFile}`);const cron = require('node-cron');

console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);const webpush = require('web-push');

console.log(`Port: ${process.env.PORT || 3000}`);require('dotenv').config();



// Load and start the serverconst app = express();

require(serverFile);const PORT = process.env.PORT || 3000;

// Security and optimization middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'", "https://cdn.jsdelivr.net"]
        }
    }
}));
app.use(compression());
app.use(morgan('combined'));
app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? false : ['http://localhost:8080', 'http://127.0.0.1:8080'],
    credentials: true
}));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from frontend directory
app.use(express.static(path.join(__dirname, 'frontend'), {
    maxAge: process.env.NODE_ENV === 'production' ? '1y' : '0',
    etag: true
}));

// Initialize SQLite database
const dbPath = path.join(__dirname, 'database', 'tasks.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Database connection error:', err.message);
    } else {
        console.log('✅ Connected to SQLite database');
        initializeDatabase();
    }
});

// Initialize database tables
function initializeDatabase() {
    const tables = [
        `CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            first_name TEXT,
            last_name TEXT,
            mobile TEXT,
            face_data TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            title TEXT NOT NULL,
            description TEXT,
            command TEXT,
            priority TEXT DEFAULT 'medium',
            category TEXT DEFAULT 'general',
            due_at DATETIME,
            completed BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`,
        `CREATE TABLE IF NOT EXISTS push_subscriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            endpoint TEXT NOT NULL,
            keys_p256dh TEXT NOT NULL,
            keys_auth TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`
    ];

    tables.forEach(sql => {
        db.run(sql, (err) => {
            if (err) console.error('Table creation error:', err.message);
        });
    });
}

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// Web Push configuration
const vapidKeys = {
    publicKey: process.env.VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa40HI4Y0r3GwAh8n_bHQmL-XRsW2d8-p7CUXP1K4d8_5sE4r3y8j3f2GwAh8n_b',
    privateKey: process.env.VAPID_PRIVATE_KEY || 'VB9J83VY9-8T5vT6VR9J83VY9-8T5vT6VR9J83VY9-8T5vT6'
};

webpush.setVapidDetails(
    'mailto:your-email@example.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
);

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        // For demo purposes, allow access without token
        req.user = { id: 1, username: 'demo' };
        return next();
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            req.user = { id: 1, username: 'demo' };
            return next();
        }
        req.user = user;
        next();
    });
};

// API Routes

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        database: 'connected'
    });
});

// Authentication routes
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password, firstName, lastName, mobile, faceData } = req.body;
        
        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);
        
        // Insert user
        const sql = `INSERT INTO users (username, email, password_hash, first_name, last_name, mobile, face_data) 
                     VALUES (?, ?, ?, ?, ?, ?, ?)`;
        
        db.run(sql, [username, email, passwordHash, firstName, lastName, mobile, faceData], function(err) {
            if (err) {
                console.error('Registration error:', err);
                return res.status(400).json({ 
                    success: false, 
                    message: 'User already exists or invalid data' 
                });
            }
            
            // Generate JWT token
            const token = jwt.sign(
                { id: this.lastID, username, email },
                JWT_SECRET,
                { expiresIn: '24h' }
            );
            
            res.json({
                success: true,
                message: 'Registration successful',
                token,
                user: { id: this.lastID, username, email, firstName, lastName }
            });
        });
        
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        const sql = `SELECT * FROM users WHERE username = ? OR email = ?`;
        db.get(sql, [username, username], async (err, user) => {
            if (err || !user) {
                return res.status(401).json({ 
                    success: false, 
                    message: 'Invalid credentials' 
                });
            }
            
            // Verify password
            const validPassword = await bcrypt.compare(password, user.password_hash);
            if (!validPassword) {
                return res.status(401).json({ 
                    success: false, 
                    message: 'Invalid credentials' 
                });
            }
            
            // Generate JWT token
            const token = jwt.sign(
                { id: user.id, username: user.username, email: user.email },
                JWT_SECRET,
                { expiresIn: '24h' }
            );
            
            res.json({
                success: true,
                message: 'Login successful',
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    firstName: user.first_name,
                    lastName: user.last_name
                }
            });
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Task routes
app.get('/api/tasks', authenticateToken, (req, res) => {
    const sql = `SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC`;
    db.all(sql, [req.user.id], (err, rows) => {
        if (err) {
            console.error('Tasks fetch error:', err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.json(rows);
    });
});

app.post('/api/tasks', authenticateToken, (req, res) => {
    const { title, description, command, priority, category, due_at } = req.body;
    
    const sql = `INSERT INTO tasks (user_id, title, description, command, priority, category, due_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`;
    
    db.run(sql, [req.user.id, title, description, command, priority, category, due_at], function(err) {
        if (err) {
            console.error('Task creation error:', err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        
        res.json({
            success: true,
            message: 'Task created successfully',
            task: {
                id: this.lastID,
                user_id: req.user.id,
                title,
                description,
                command,
                priority,
                category,
                due_at,
                completed: false,
                created_at: new Date().toISOString()
            }
        });
    });
});

app.put('/api/tasks/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const { title, description, command, priority, category, due_at, completed } = req.body;
    
    const sql = `UPDATE tasks SET 
                 title = ?, description = ?, command = ?, priority = ?, 
                 category = ?, due_at = ?, completed = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ? AND user_id = ?`;
    
    db.run(sql, [title, description, command, priority, category, due_at, completed, id, req.user.id], function(err) {
        if (err) {
            console.error('Task update error:', err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ success: false, message: 'Task not found' });
        }
        
        res.json({ success: true, message: 'Task updated successfully' });
    });
});

app.delete('/api/tasks/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    
    const sql = `DELETE FROM tasks WHERE id = ? AND user_id = ?`;
    db.run(sql, [id, req.user.id], function(err) {
        if (err) {
            console.error('Task deletion error:', err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ success: false, message: 'Task not found' });
        }
        
        res.json({ success: true, message: 'Task deleted successfully' });
    });
});

// Push notification routes
app.post('/api/push/subscribe', authenticateToken, (req, res) => {
    const { endpoint, keys } = req.body;
    
    const sql = `INSERT OR REPLACE INTO push_subscriptions (user_id, endpoint, keys_p256dh, keys_auth) 
                 VALUES (?, ?, ?, ?)`;
    
    db.run(sql, [req.user.id, endpoint, keys.p256dh, keys.auth], function(err) {
        if (err) {
            console.error('Push subscription error:', err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        
        res.json({ success: true, message: 'Push subscription saved' });
    });
});

app.get('/api/push/vapid-key', (req, res) => {
    res.json({ publicKey: vapidKeys.publicKey });
});

// Serve frontend routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'dashboard-enhanced.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'register-enhanced.html'));
});

app.get('/about', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'about.html'));
});

app.get('/history', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'history.html'));
});

// Catch-all handler for SPA routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// Background task scheduler
cron.schedule('*/5 * * * *', () => {
    console.log('Running scheduled task check...');
    // Check for due tasks and send notifications
    const sql = `SELECT * FROM tasks WHERE due_at <= datetime('now', '+15 minutes') 
                 AND completed = 0 AND due_at > datetime('now')`;
    
    db.all(sql, [], (err, tasks) => {
        if (err) return console.error('Task check error:', err);
        
        tasks.forEach(task => {
            // Send push notification for upcoming tasks
            sendTaskNotification(task);
        });
    });
});

function sendTaskNotification(task) {
    const sql = `SELECT * FROM push_subscriptions WHERE user_id = ?`;
    db.all(sql, [task.user_id], (err, subscriptions) => {
        if (err) return console.error('Subscription fetch error:', err);
        
        const payload = JSON.stringify({
            title: '📋 Task Reminder',
            body: `Task "${task.title}" is due in 15 minutes!`,
            icon: '/assets/logo.png',
            badge: '/assets/logo.png',
            tag: `task-${task.id}`,
            data: { taskId: task.id }
        });
        
        subscriptions.forEach(subscription => {
            const pushSubscription = {
                endpoint: subscription.endpoint,
                keys: {
                    p256dh: subscription.keys_p256dh,
                    auth: subscription.keys_auth
                }
            };
            
            webpush.sendNotification(pushSubscription, payload)
                .catch(error => console.error('Push notification error:', error));
        });
    });
}

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err.stack);
    res.status(500).json({ 
        success: false, 
        message: process.env.NODE_ENV === 'production' ? 'Something went wrong!' : err.message 
    });
});

// Create database directory if it doesn't exist
const fs = require('fs');
const dbDir = path.join(__dirname, 'database');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Task Scheduler Server running on port ${PORT}`);
    console.log(`📱 Frontend: http://localhost:${PORT}`);
    console.log(`🔧 API: http://localhost:${PORT}/api`);
    console.log(`💾 Database: ${dbPath}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🔄 Shutting down gracefully...');
    db.close((err) => {
        if (err) console.error('Database close error:', err.message);
        else console.log('✅ Database connection closed');
        process.exit(0);
    });
});

module.exports = app;