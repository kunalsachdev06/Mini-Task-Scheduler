const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

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
app.post('/api/tasks', (req, res) => {
  const task = req.body || {};
  if (!task.id) task.id = Date.now();
  if (!task.status) task.status = 'pending';
  if (!task.createdAt) task.createdAt = new Date().toISOString();
  
  tasks.push(task);
  console.log(`✅ Task created: ${task.command || 'Unnamed'} (ID: ${task.id})`);
  res.status(201).json(task);
});

// Update task
app.put('/api/tasks/:id', (req, res) => {
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