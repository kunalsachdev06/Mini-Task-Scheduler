const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

const app = express();
const PORT = process.env.PORT || 3001;

// Security: Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Security: Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
      fontSrc: ["'self'", "fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://minitaskscheduler.netlify.app"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Apply rate limiting to all API routes
app.use('/api/', limiter);

// CORS configuration
app.use(cors({
  origin: ['https://minitaskscheduler.netlify.app', 'http://localhost:3000', 'http://localhost:5173', 'http://localhost:8888'],
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));

app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    uptime: process.uptime(), 
    timestamp: new Date().toISOString(),
    message: 'Backend is running successfully!'
  });
});

// In-memory tasks storage for testing
let tasks = [];

// Get all tasks
app.get('/api/tasks', (req, res) => {
  res.json(tasks);
});

// Create new task
app.post('/api/tasks', [
  body('command').trim().notEmpty().isLength({ max: 500 }).escape().withMessage('Command must be between 1 and 500 characters'),
  body('time').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Invalid time format'),
  body('priority').optional().isIn(['low', 'medium', 'high', 'Low', 'Medium', 'High']).withMessage('Priority must be low, medium, or high'),
  body('status').optional().isIn(['pending', 'completed', 'in-progress']).withMessage('Invalid status'),
], (req, res) => {
  // Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Validation failed', 
      details: errors.array() 
    });
  }

  const task = req.body || {};
  if (!task.id) task.id = Date.now();
  if (!task.status) task.status = 'pending';
  if (!task.createdAt) task.createdAt = new Date().toISOString();
  
  tasks.push(task);
  console.log(`✅ Task created: ${task.command || 'Unnamed'} (ID: ${task.id})`);
  res.status(201).json(task);
});

// Update task
app.put('/api/tasks/:id', [
  body('command').optional().trim().isLength({ max: 500 }).escape(),
  body('status').optional().isIn(['pending', 'completed', 'in-progress']),
], (req, res) => {
  // Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Validation failed', 
      details: errors.array() 
    });
  }

  const { id } = req.params;
  const taskIndex = tasks.findIndex(t => t.id.toString() === id);
  
  if (taskIndex === -1) {
    return res.status(404).json({ message: 'Task not found' });
  }
  
  tasks[taskIndex] = { ...tasks[taskIndex], ...req.body };
  console.log(`✅ Task updated: ${tasks[taskIndex].command || 'Unnamed'} (ID: ${id})`);
  res.json(tasks[taskIndex]);
});

// Delete task
app.delete('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  const taskIndex = tasks.findIndex(t => t.id.toString() === id);
  
  if (taskIndex === -1) {
    return res.status(404).json({ message: 'Task not found' });
  }
  
  const deletedTask = tasks[taskIndex];
  tasks = tasks.filter(t => t.id.toString() !== id);
  console.log(`🗑️ Task deleted: ${deletedTask.command || 'Unnamed'} (ID: ${id})`);
  res.status(204).send();
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Endpoint not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Mini Task Scheduler Backend`);
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📋 Tasks API: http://localhost:${PORT}/api/tasks`);
});