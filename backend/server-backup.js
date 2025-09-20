const express = require('express');
const path = require('path'); // Only declare once
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

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

app.post('/api/tasks', (req, res) => {
  const t = req.body || {};
  if (!t.id) t.id = Date.now();
  tasks.push(t);
  res.status(201).json(t);
});

app.put('/api/tasks/:id', (req, res) => {
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
