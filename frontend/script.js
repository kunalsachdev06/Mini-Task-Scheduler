// Task Scheduler - Complete Implementation
let tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
let notifications = [];

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  loadTasks();
  updateStats();
  startNotificationChecker();
  requestNotificationPermission();
});

// Add new task
function addTask() {
  const form = document.getElementById('taskForm');
  const formData = new FormData(form);
  
  const task = {
    id: Date.now(),
    command: document.getElementById('taskCommand').value,
    time: document.getElementById('taskTime').value,
    priority: document.getElementById('taskPriority').value,
    frequency: document.getElementById('taskFrequency').value,
    mood: document.getElementById('taskMood').value,
    deadline: document.getElementById('taskDeadline').value || null,
    status: 'pending',
    createdAt: new Date().toISOString(),
    notified: false
  };
  
  if (!task.command || !task.time) {
    showToast('Please fill in task title and time', 'error');
    return false;
  }
  
  tasks.push(task);
  saveTasks();
  loadTasks();
  updateStats();
  form.reset();
  showToast('Task added successfully!', 'success');
  logAction(`Task created: ${task.command}`);
  
  return false;
}

// Save tasks to localStorage
function saveTasks() {
  localStorage.setItem('tasks', JSON.stringify(tasks));
}

// Load and display tasks
function loadTasks() {
  const tbody = document.getElementById('taskList');
  if (!tbody) return;
  
  if (tasks.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:gray">No tasks yet</td></tr>';
    return;
  }
  
  tbody.innerHTML = tasks.map(task => `
    <tr class="task-row ${task.status}" data-id="${task.id}">
      <td>
        <div class="task-title">${task.command}</div>
        <div class="task-mood">${getMoodEmoji(task.mood)}</div>
      </td>
      <td>${formatTime(task.time)}</td>
      <td><span class="priority-badge ${task.priority.toLowerCase()}">${task.priority}</span></td>
      <td>${task.frequency}</td>
      <td><span class="status-badge ${task.status}">${task.status}</span></td>
      <td>
        <div class="card-actions">
          <button onclick="runTask(${task.id})" class="run" title="Run Task">▶️</button>
          <button onclick="editTask(${task.id})" class="edit" title="Edit">✏️</button>
          <button onclick="deleteTask(${task.id})" class="delete" title="Delete">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

// Delete task
function deleteTask(id) {
  if (confirm('Are you sure you want to delete this task?')) {
    const task = tasks.find(t => t.id === id);
    tasks = tasks.filter(t => t.id !== id);
    saveTasks();
    loadTasks();
    updateStats();
    showToast('Task deleted', 'info');
    logAction(`Task deleted: ${task?.command || 'Unknown'}`);
  }
}

// Run/Complete task
function runTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  
  task.status = task.status === 'completed' ? 'pending' : 'completed';
  task.completedAt = task.status === 'completed' ? new Date().toISOString() : null;
  
  saveTasks();
  loadTasks();
  updateStats();
  showToast(`Task ${task.status}!`, 'success');
  logAction(`Task ${task.status}: ${task.command}`);
}

// Edit task (simplified - opens prompt)
function editTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  
  const newTitle = prompt('Edit task title:', task.command);
  if (newTitle && newTitle.trim()) {
    task.command = newTitle.trim();
    saveTasks();
    loadTasks();
    showToast('Task updated!', 'success');
    logAction(`Task updated: ${task.command}`);
  }
}

// Helper functions
function getMoodEmoji(mood) {
  const moods = {
    excited: '😃',
    neutral: '😐',
    dreading: '😫',
    challenging: '💡',
    routine: '🔁'
  };
  return moods[mood] || '😐';
}

function formatTime(time) {
  return new Date(`2000-01-01T${time}`).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

// Update statistics
function updateStats() {
  const completed = tasks.filter(t => t.status === 'completed').length;
  const pending = tasks.filter(t => t.status === 'pending').length;
  const productivity = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;
  
  const prodVal = document.getElementById('prodVal');
  const pressVal = document.getElementById('pressVal');
  
  if (prodVal) prodVal.textContent = `${productivity}%`;
  if (pressVal) pressVal.textContent = `${pending} pending`;
  
  updateHeatmap();
}

// Update heatmap
function updateHeatmap() {
  const heatmap = document.getElementById('heatmap');
  if (!heatmap) return;
  
  // Generate heatmap based on task times
  const hours = Array(24).fill(0);
  tasks.forEach(task => {
    const hour = parseInt(task.time.split(':')[0]);
    hours[hour]++;
  });
  
  const maxTasks = Math.max(...hours, 1);
  heatmap.innerHTML = hours.map((count, hour) => {
    const intensity = count / maxTasks;
    return `<div class="cell" style="background-color: rgba(37,99,235,${0.1 + intensity * 0.8})" title="${hour}:00 - ${count} tasks"></div>`;
  }).join('');
}

// Toast notifications
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed; top: 20px; right: 20px; z-index: 10000;
    background: var(--card-bg); color: var(--text); padding: 1rem 1.5rem;
    border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    border-left: 4px solid ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#2563eb'};
    animation: slideIn 0.3s ease;
  `;
  
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Log actions
function logAction(action) {
  const log = document.getElementById('liveLog');
  if (!log) return;
  
  const timestamp = new Date().toLocaleTimeString();
  const entry = `[${timestamp}] ${action}`;
  
  const logs = log.textContent.split('\n').filter(l => l.trim());
  logs.push(entry);
  if (logs.length > 10) logs.shift(); // Keep only last 10 logs
  
  log.textContent = logs.join('\n');
  log.scrollTop = log.scrollHeight;
}

// FULLSCREEN NOTIFICATION SYSTEM
function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function startNotificationChecker() {
  setInterval(checkTaskNotifications, 30000); // Check every 30 seconds
}

function checkTaskNotifications() {
  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  
  tasks.forEach(task => {
    if (task.status === 'pending' && !task.notified && task.time === currentTime) {
      task.notified = true;
      saveTasks();
      showFullscreenNotification(task);
      logAction(`Notification sent: ${task.command}`);
    }
  });
}

function showFullscreenNotification(task) {
  // Create fullscreen notification modal
  const modal = document.createElement('div');
  modal.className = 'fullscreen-notification';
  modal.innerHTML = `
    <div class="notification-content">
      <div class="notification-header">
        <div class="alarm-icon">⏰</div>
        <h2>Task Reminder</h2>
      </div>
      <div class="notification-body">
        <h3>${task.command}</h3>
        <div class="task-details">
          <div class="detail-item">
            <span class="icon">🕒</span>
            <span>Time: ${formatTime(task.time)}</span>
          </div>
          <div class="detail-item">
            <span class="icon">🎯</span>
            <span>Priority: ${task.priority}</span>
          </div>
          <div class="detail-item">
            <span class="icon">${getMoodEmoji(task.mood)}</span>
            <span>Mood: ${task.mood}</span>
          </div>
          ${task.deadline ? `
          <div class="detail-item">
            <span class="icon">📅</span>
            <span>Deadline: ${new Date(task.deadline).toLocaleDateString()}</span>
          </div>` : ''}
        </div>
      </div>
      <div class="notification-actions">
        <button class="btn-complete" onclick="completeFromNotification(${task.id})">✅ Mark Complete</button>
        <button class="btn-snooze" onclick="snoozeNotification(${task.id})">😴 Snooze 5 min</button>
        <button class="btn-dismiss" onclick="dismissNotification()">❌ Dismiss</button>
      </div>
    </div>
  `;
  
  // Add styles
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    display: flex; align-items: center; justify-content: center;
    z-index: 99999; color: white; font-family: 'Inter', sans-serif;
    animation: notificationSlideIn 0.5s ease-out;
  `;
  
  document.body.appendChild(modal);
  
  // Try to go fullscreen on mobile
  if (modal.requestFullscreen) {
    modal.requestFullscreen().catch(() => {});
  }
  
  // Play notification sound (if possible)
  playNotificationSound();
  
  // Vibrate on mobile
  if (navigator.vibrate) {
    navigator.vibrate([200, 100, 200, 100, 200]);
  }
  
  // Auto-dismiss after 30 seconds
  setTimeout(() => {
    if (document.querySelector('.fullscreen-notification')) {
      dismissNotification();
    }
  }, 30000);
}

function completeFromNotification(taskId) {
  runTask(taskId);
  dismissNotification();
  showToast('Task completed! 🎉', 'success');
}

function snoozeNotification(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (task) {
    // Add 5 minutes to task time
    const [hours, minutes] = task.time.split(':').map(Number);
    const newMinutes = (minutes + 5) % 60;
    const newHours = hours + Math.floor((minutes + 5) / 60);
    task.time = `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`;
    task.notified = false;
    saveTasks();
    loadTasks();
  }
  dismissNotification();
  showToast('Task snoozed for 5 minutes', 'info');
}

function dismissNotification() {
  const modal = document.querySelector('.fullscreen-notification');
  if (modal) {
    modal.style.animation = 'notificationSlideOut 0.3s ease-in';
    setTimeout(() => {
      modal.remove();
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }, 300);
  }
}

function playNotificationSound() {
  // Create a simple beep sound using Web Audio API
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch (e) {
    console.log('Audio not supported');
  }
}

// Test notification function
function testNotification() {
  const testTask = {
    id: 999,
    command: "Test Reminder",
    time: "12:00",
    priority: "High",
    mood: "excited",
    deadline: new Date().toISOString().split('T')[0]
  };
  showFullscreenNotification(testTask);
  logAction("Test notification triggered");
}

// Demo function for professors - can be called from browser console
window.demoNotification = function() {
  const demoTask = {
    id: 888,
    command: "Professor Demo - Task Reminder System",
    time: new Date().toTimeString().slice(0,5),
    priority: "High",
    mood: "excited",
    deadline: new Date().toISOString().split('T')[0]
  };
  showFullscreenNotification(demoTask);
  console.log("Demo notification triggered for professor presentation");
}
