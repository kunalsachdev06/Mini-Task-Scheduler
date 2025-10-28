const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const path = require('path');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const compression = require('compression');
require('dotenv').config();

const execAsync = promisify(exec);
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'"]
        }
    }
}));
app.use(compression());
app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? 
        [process.env.FRONTEND_URL] : 
        ['http://localhost:8080', 'http://127.0.0.1:8080'],
    credentials: true
}));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'frontend')));

// Database setup
const isPostgreSQL = process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgresql://');
let db;
let pool;

// Initialize database
async function initializeDatabase() {
    console.log('🔧 Initializing database...');
    
    if (isPostgreSQL) {
        console.log('🐘 Setting up PostgreSQL connection...');
        // PostgreSQL setup
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
        
        try {
            const result = await pool.query('SELECT NOW()');
            console.log('✅ Connected to PostgreSQL database');
            console.log('📅 Database time:', result.rows[0].now);
            
            // Create tables for PostgreSQL
            const tables = [
                `CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    username VARCHAR(255) UNIQUE NOT NULL,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    first_name VARCHAR(255),
                    last_name VARCHAR(255),
                    mobile VARCHAR(20),
                    face_data TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`,
                `CREATE TABLE IF NOT EXISTS tasks (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    title VARCHAR(255) NOT NULL,
                    description TEXT,
                    priority VARCHAR(20) DEFAULT 'medium',
                    status VARCHAR(20) DEFAULT 'pending',
                    due_date TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`
            ];
            
            for (const tableSQL of tables) {
                await pool.query(tableSQL);
            }
            console.log('✅ Database tables initialized');
            
        } catch (error) {
            console.error('PostgreSQL connection error:', error);
            throw error;
        }
    } else {
        // SQLite setup (fallback)
        return new Promise((resolve, reject) => {
            const dbPath = path.join(__dirname, 'database', 'tasks.db');
            const dbDir = path.dirname(dbPath);
            require('fs').mkdirSync(dbDir, { recursive: true });
            
            db = new sqlite3.Database(dbPath, (err) => {
                if (err) {
                    console.error('Database connection error:', err);
                    reject(err);
                    return;
                }
                console.log('✅ Connected to SQLite database');
                
                // Create tables for SQLite
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
                        user_id INTEGER DEFAULT 1,
                        username TEXT DEFAULT 'demo',
                        title TEXT NOT NULL,
                        description TEXT,
                        tag TEXT DEFAULT 'general',
                        difficulty INTEGER DEFAULT 1,
                        priority INTEGER DEFAULT 2,
                        start_epoch INTEGER,
                        end_epoch INTEGER,
                        recur_minutes INTEGER DEFAULT 0,
                        completed INTEGER DEFAULT 0,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users (id)
                    )`
                ];

                let completed = 0;
                tables.forEach(sql => {
                    db.run(sql, (err) => {
                        if (err) {
                            console.error('Table creation error:', err);
                            reject(err);
                            return;
                        }
                        completed++;
                        if (completed === tables.length) {
                            console.log('✅ Database tables initialized');
                            resolve();
                        }
                    });
                });
            });
        });
    }
}

// JWT middleware - SECURITY: Require JWT_SECRET from environment
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
    console.error('❌ SECURITY ERROR: JWT_SECRET environment variable is required and must be at least 32 characters long!');
    console.error('Set JWT_SECRET in your .env file before starting the server.');
    process.exit(1);
}

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        // For demo purposes, allow access with default user
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

// Database helper functions
const dbQuery = async (query, params = []) => {
    if (isPostgreSQL) {
        const result = await pool.query(query, params);
        return result;
    } else {
        return new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) reject(err);
                else resolve({ rows });
            });
        });
    }
};

const dbRun = async (query, params = []) => {
    if (isPostgreSQL) {
        const result = await pool.query(query, params);
        return result;
    } else {
        return new Promise((resolve, reject) => {
            db.run(query, params, function(err) {
                if (err) reject(err);
                else resolve({ insertId: this.lastID, changes: this.changes });
            });
        });
    }
};

// C Backend Integration Functions
class CBackendWrapper {
    constructor() {
        this.backendPath = path.join(__dirname, 'backend');
        this.executablePath = path.join(this.backendPath, 'scheduler');
        this.tasksFilePath = path.join(this.backendPath, 'tasks_runtime.txt');
        this.dataPath = path.join(__dirname, 'frontend', 'data');
        this.isCompiled = false;
    }

    async ensureCompiledBinary() {
        if (this.isCompiled) return true;

        try {
            // Check if executable exists
            await fs.access(this.executablePath);
            this.isCompiled = true;
            return true;
        } catch (error) {
            // Try to compile
            console.log('🔨 Compiling C backend...');
            try {
                const sourcePath = path.join(this.backendPath, 'scheduler.c');
                await execAsync(`gcc "${sourcePath}" -o "${this.executablePath}" -lm`, {
                    cwd: this.backendPath
                });
                this.isCompiled = true;
                console.log('✅ C backend compiled successfully');
                return true;
            } catch (compileError) {
                console.error('❌ Failed to compile C backend:', compileError);
                return false;
            }
        }
    }

    async writeTasksFile(tasks) {
        // Ensure backend directory exists
        await fs.mkdir(this.backendPath, { recursive: true });
        
        // Convert database tasks to C backend format
        const lines = ['# Tasks file for C backend'];
        tasks.forEach(task => {
            const line = [
                task.id || 1,
                task.username || 'demo',
                task.title || 'Untitled',
                task.description || '',
                task.tag || 'general',
                task.difficulty || 1,
                task.priority || 2,
                task.start_epoch || 0,
                task.end_epoch || 0,
                task.recur_minutes || 0,
                task.completed || 0
            ].join('|');
            lines.push(line);
        });

        await fs.writeFile(this.tasksFilePath, lines.join('\n'));
    }

    async runScheduler(tasks) {
        try {
            await this.ensureCompiledBinary();
            await this.writeTasksFile(tasks);
            
            // Ensure data directory exists
            await fs.mkdir(this.dataPath, { recursive: true });
            
            // Run C backend once to generate JSON files
            if (this.isCompiled) {
                const { stdout, stderr } = await execAsync(`"${this.executablePath}"`, {
                    cwd: path.dirname(this.executablePath),
                    timeout: 5000 // 5 second timeout
                });
                
                console.log('✅ C backend executed successfully');
                return true;
            } else {
                // Fallback: generate JSON manually
                await this.generateFallbackData(tasks);
                return true;
            }
        } catch (error) {
            console.warn('⚠️ C backend execution failed, using fallback:', error.message);
            await this.generateFallbackData(tasks);
            return true;
        }
    }

    async generateFallbackData(tasks) {
        // Ensure data directory exists
        await fs.mkdir(this.dataPath, { recursive: true });
        
        // Generate tasks.json
        const tasksData = {
            tasks: tasks.map(task => ({
                id: task.id,
                username: task.username || 'demo',
                title: task.title,
                desc: task.description || '',
                tag: task.tag || 'general',
                difficulty: task.difficulty || 1,
                priority: task.priority || 2,
                start_epoch: task.start_epoch || 0,
                end_epoch: task.end_epoch || 0,
                recur_minutes: task.recur_minutes || 0,
                completed: task.completed || 0
            })),
            meta: {
                productivity: 0.85,
                pressure: 0.3
            }
        };

        await fs.writeFile(
            path.join(this.dataPath, 'tasks.json'),
            JSON.stringify(tasksData, null, 2)
        );

        // Generate heatmap.json
        const heatmapData = {
            hours: new Array(24).fill(0).map(() => Math.floor(Math.random() * 5))
        };

        await fs.writeFile(
            path.join(this.dataPath, 'heatmap.json'),
            JSON.stringify(heatmapData, null, 2)
        );

        // Generate notifications.json
        const now = Math.floor(Date.now() / 1000);
        const notificationsData = {
            notifications: tasks
                .filter(task => task.end_epoch && task.end_epoch - now <= 300 && task.end_epoch - now >= 0)
                .map(task => ({
                    id: task.id,
                    title: task.title,
                    desc: task.description || '',
                    username: task.username || 'demo'
                }))
        };

        await fs.writeFile(
            path.join(this.dataPath, 'notifications.json'),
            JSON.stringify(notificationsData, null, 2)
        );

        console.log('✅ Fallback data generated');
    }
}

const cBackend = new CBackendWrapper();

// Helper function to get tasks from database
async function getTasks(userId = 1) {
    try {
        const sql = isPostgreSQL 
            ? `SELECT * FROM tasks WHERE user_id = $1 ORDER BY created_at DESC`
            : `SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC`;
        
        const result = await dbQuery(sql, [userId]);
        return result.rows;
    } catch (error) {
        throw error;
    }
}

// API Routes

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        backend: 'c-wrapper',
        database: isPostgreSQL ? 'postgresql' : 'sqlite'
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
app.get('/api/tasks', authenticateToken, async (req, res) => {
    try {
        const tasks = await getTasks(req.user.id);
        
        // Run C backend to update analytics
        await cBackend.runScheduler(tasks);
        
        res.json(tasks);
    } catch (error) {
        console.error('Tasks fetch error:', error);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

app.post('/api/tasks', authenticateToken, async (req, res) => {
    try {
        const { title, description, command, priority, category, due_at } = req.body;
        
        // Convert to C backend format
        const task = {
            user_id: req.user.id,
            username: req.user.username,
            title: title || command,
            description: description || '',
            tag: category || 'general',
            difficulty: 1,
            priority: priority === 'high' ? 3 : (priority === 'low' ? 1 : 2),
            start_epoch: Math.floor(Date.now() / 1000),
            end_epoch: due_at ? Math.floor(new Date(due_at).getTime() / 1000) : 0,
            recur_minutes: 0,
            completed: 0
        };
        
        const sql = isPostgreSQL 
            ? `INSERT INTO tasks (user_id, username, title, description, tag, difficulty, priority, start_epoch, end_epoch, recur_minutes, completed) 
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`
            : `INSERT INTO tasks (user_id, username, title, description, tag, difficulty, priority, start_epoch, end_epoch, recur_minutes, completed) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        
        const result = await dbRun(sql, [
            task.user_id, task.username, task.title, task.description, 
            task.tag, task.difficulty, task.priority, task.start_epoch, 
            task.end_epoch, task.recur_minutes, task.completed
        ]);
        
        const newTaskId = isPostgreSQL ? result.rows[0].id : result.insertId;
        const newTask = { ...task, id: newTaskId };
        
        // Update C backend
        const allTasks = await getTasks(req.user.id);
        await cBackend.runScheduler(allTasks);
        
        res.json({
            success: true,
            message: 'Task created successfully',
            task: newTask
        });
        
    } catch (error) {
        console.error('Task creation error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.put('/api/tasks/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, command, priority, category, due_at, completed } = req.body;
        
        const updateData = {
            title: title || command,
            description: description || '',
            tag: category || 'general',
            priority: priority === 'high' ? 3 : (priority === 'low' ? 1 : 2),
            end_epoch: due_at ? Math.floor(new Date(due_at).getTime() / 1000) : 0,
            completed: completed ? 1 : 0
        };
        
        const sql = `UPDATE tasks SET 
                     title = ?, description = ?, tag = ?, priority = ?, 
                     end_epoch = ?, completed = ?, updated_at = CURRENT_TIMESTAMP
                     WHERE id = ? AND user_id = ?`;
        
        db.run(sql, [
            updateData.title, updateData.description, updateData.tag, 
            updateData.priority, updateData.end_epoch, updateData.completed, 
            id, req.user.id
        ], async function(err) {
            if (err) {
                console.error('Task update error:', err);
                return res.status(500).json({ success: false, message: 'Database error' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ success: false, message: 'Task not found' });
            }
            
            // Update C backend
            const allTasks = await getTasks(req.user.id);
            await cBackend.runScheduler(allTasks);
            
            res.json({ success: true, message: 'Task updated successfully' });
        });
        
    } catch (error) {
        console.error('Task update error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.delete('/api/tasks/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        const sql = `DELETE FROM tasks WHERE id = ? AND user_id = ?`;
        db.run(sql, [id, req.user.id], async function(err) {
            if (err) {
                console.error('Task deletion error:', err);
                return res.status(500).json({ success: false, message: 'Database error' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ success: false, message: 'Task not found' });
            }
            
            // Update C backend
            const allTasks = await getTasks(req.user.id);
            await cBackend.runScheduler(allTasks);
            
            res.json({ success: true, message: 'Task deleted successfully' });
        });
        
    } catch (error) {
        console.error('Task deletion error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// C Backend data endpoints (for frontend compatibility)
app.get('/api/data/tasks', async (req, res) => {
    try {
        const filePath = path.join(cBackend.dataPath, 'tasks.json');
        const data = await fs.readFile(filePath, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        console.error('Tasks data error:', error);
        res.status(500).json({ error: 'Failed to load tasks data' });
    }
});

app.get('/api/data/heatmap', async (req, res) => {
    try {
        const filePath = path.join(cBackend.dataPath, 'heatmap.json');
        const data = await fs.readFile(filePath, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        console.error('Heatmap data error:', error);
        res.status(500).json({ error: 'Failed to load heatmap data' });
    }
});

app.get('/api/data/notifications', async (req, res) => {
    try {
        const filePath = path.join(cBackend.dataPath, 'notifications.json');
        const data = await fs.readFile(filePath, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        console.error('Notifications data error:', error);
        res.status(500).json({ error: 'Failed to load notifications data' });
    }
});

// Frontend routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'dashboard-enhanced.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'register-enhanced.html'));
});

// Catch-all handler for SPA routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err.stack);
    res.status(500).json({ 
        success: false, 
        message: process.env.NODE_ENV === 'production' ? 'Something went wrong!' : err.message 
    });
});

// Initialize and start server
async function startServer() {
    try {
        console.log('🚀 Initializing Task Scheduler Server...');
        console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🔌 Port: ${PORT}`);
        console.log(`💾 Database URL: ${process.env.DATABASE_URL ? 'SET ✅' : 'NOT SET ❌'}`);
        console.log(`🔐 JWT Secret: ${process.env.JWT_SECRET ? 'SET ✅' : 'NOT SET ❌'}`);
        
        // Initialize database
        await initializeDatabase();
        
        // Ensure C backend is ready (but don't fail if it's not available)
        try {
            await cBackend.ensureCompiledBinary();
            console.log('🎯 C Backend: Ready');
        } catch (cError) {
            console.warn('⚠️ C Backend: Not available, using fallback mode');
        }
        
        // Start server
        const server = app.listen(PORT, '0.0.0.0', () => {
            console.log(`✅ Task Scheduler Server running on port ${PORT}`);
            console.log(`📱 Frontend: http://localhost:${PORT}`);
            console.log(`🔧 API: http://localhost:${PORT}/api`);
            console.log(`💾 Database: ${isPostgreSQL ? 'PostgreSQL' : 'SQLite'}`);
            console.log(`🎯 C Backend: ${cBackend.isCompiled ? 'Compiled' : 'Fallback mode'}`);
            console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
        });
        
        // Handle server errors
        server.on('error', (error) => {
            console.error('❌ Server error:', error);
            if (error.code === 'EADDRINUSE') {
                console.error(`❌ Port ${PORT} is already in use`);
            }
            process.exit(1);
        });
        
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🔄 Shutting down gracefully...');
    if (db) {
        db.close((err) => {
            if (err) console.error('Database close error:', err.message);
            else console.log('✅ Database connection closed');
            process.exit(0);
        });
    } else {
        process.exit(0);
    }
});

// Start the server
startServer();

module.exports = app;