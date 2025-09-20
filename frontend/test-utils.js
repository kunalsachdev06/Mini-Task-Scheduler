// Testing utilities for the Mini Task Scheduler
// Include this script in the HTML to enable testing functions

// Create a test task scheduled for 1 minute from now
function showTestTask() {
  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${(now.getMinutes() + 1).toString().padStart(2, '0')}`;
  
  const testTask = {
    id: Date.now(),
    command: "🎯 Test Task - Notification Demo",
    time: currentTime,
    priority: "High",
    mood: "excited",
    status: "pending",
    notified: false,
    deadline: now.toISOString().split('T')[0]
  };
  
  // Add to tasks array if it exists
  if (typeof tasks !== 'undefined') {
    tasks.push(testTask);
    if (typeof saveTasks === 'function') saveTasks();
    if (typeof loadTasks === 'function') loadTasks();
  }
  
  // Show toast if available
  if (typeof showToast === 'function') {
    showToast(`Test task created for ${currentTime} (1 minute from now)`, 'success');
  }
  
  console.log('🎯 Test task created:', testTask);
  console.log('📅 Scheduled for:', currentTime, '(1 minute from now)');
  console.log('🔔 Notification should appear at that time');
  
  return testTask;
}

// Test immediate notification
function triggerTestNotification() {
  const testTask = {
    id: 999,
    command: "🔔 Immediate Test Notification",
    time: "now",
    priority: "High",
    mood: "excited",
    deadline: new Date().toISOString().split('T')[0]
  };
  
  console.log('🔔 Triggering immediate test notification...');
  
  if (typeof showBrowserNotification === 'function') {
    showBrowserNotification(testTask);
  }
  
  if (typeof showFullscreenNotification === 'function') {
    showFullscreenNotification(testTask);
  }
  
  if (typeof showToast === 'function') {
    showToast('Test notification triggered!', 'info');
  }
  
  return testTask;
}

// Test the entire workflow
function testWorkflow() {
  console.log('🧪 Starting workflow test...');
  
  // 1. Test login
  console.log('1️⃣ Testing auth...');
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('authToken', 'test-token-' + Date.now());
    console.log('✅ Auth token set');
  }
  
  // 2. Test task creation
  console.log('2️⃣ Creating test task...');
  const task = showTestTask();
  console.log('✅ Task created:', task.command);
  
  // 3. Test immediate notification
  console.log('3️⃣ Testing immediate notification...');
  setTimeout(() => {
    triggerTestNotification();
    console.log('✅ Immediate notification triggered');
  }, 1000);
  
  // 4. Schedule follow-up test
  console.log('4️⃣ Scheduled notification test will occur in 1 minute');
  console.log('🏁 Workflow test initiated!');
  
  return {
    auth: !!localStorage.getItem('authToken'),
    task: task,
    timestamp: new Date().toISOString()
  };
}

// Make functions globally available
window.showTestTask = showTestTask;
window.triggerTestNotification = triggerTestNotification;
window.testWorkflow = testWorkflow;

console.log('🧪 Test utilities loaded! Available functions:');
console.log('- showTestTask() - Creates a task for 1 minute from now');
console.log('- triggerTestNotification() - Shows immediate notification');
console.log('- testWorkflow() - Tests complete workflow');