const express = require('express');
const path = require('path'); // Only declare once
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

const app = express();
const PORT = process.env.PORT || 3000;

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

// Allow Netlify app by default; can override with env
const NETLIFY_ORIGIN = process.env.CORS_ORIGIN || 'https://minitaskscheduler.netlify.app';

app.use(cors({
  origin: [NETLIFY_ORIGIN, 'http://localhost:3000', 'http://localhost:5173', 'http://localhost:8888'],
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));
app.use(express.json());

// Health check endpoint for Railway
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// Minimal in-memory tasks for quick verification
let tasks = [];

app.get('/api/tasks', (req, res) => {
  res.json(tasks);
});

app.post('/api/tasks', [
  body('command').optional().trim().isLength({ max: 500 }).escape(),
  body('time').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  body('priority').optional().isIn(['low', 'medium', 'high', 'Low', 'Medium', 'High']),
], (req, res) => {
  // Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Validation failed', 
      details: errors.array() 
    });
  }

  const t = req.body || {};
  if (!t.id) t.id = Date.now();
  tasks.push(t);
  res.status(201).json(t);
});

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
  const idx = tasks.findIndex(x => x.id.toString() === id);
  if (idx === -1) return res.status(404).json({ message: 'Not found' });
  tasks[idx] = { ...tasks[idx], ...req.body };
  res.json(tasks[idx]);
});

app.delete('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  tasks = tasks.filter(x => x.id.toString() !== id);
  res.status(204).send();
});

// Fallback 404
app.use((req, res) => res.status(404).json({ message: 'Not found' }));

app.listen(PORT, () => {
  console.log(`✅ Server listening on ${PORT}`);
});
