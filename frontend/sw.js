// Service Worker for Task Scheduler
const CACHE_NAME = 'task-scheduler-v1';

self.addEventListener('install', event => { 
  self.skipWaiting(); 
});

self.addEventListener('activate', event => { 
  self.clients.claim(); 
});

self.addEventListener('fetch', event => { 
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  ); 
});

// Handle background notifications
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  // Open the app when notification is clicked
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      for (let client of clientList) {
        if (client.url.includes('dashboard.html') && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window if none exists
      if (clients.openWindow) {
        return clients.openWindow('/dashboard.html');
      }
    })
  );
});

// Handle background sync for notifications
self.addEventListener('sync', event => {
  if (event.tag === 'check-tasks') {
    event.waitUntil(checkPendingTasks());
  }
});

async function checkPendingTasks() {
  try {
    // This would normally fetch from a server, but we'll use localStorage approach
    const clients = await self.clients.matchAll();
    if (clients.length > 0) {
      // Send message to active client to check tasks
      clients[0].postMessage({ type: 'CHECK_TASKS' });
    }
  } catch (error) {
    console.error('Error checking tasks:', error);
  }
}

// Handle messages from main thread
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag, icon } = event.data;
    
    self.registration.showNotification(title, {
      body: body,
      tag: tag,
      icon: icon || './assets/logo.png',
      badge: './assets/logo.png',
      vibrate: [200, 100, 200],
      requireInteraction: true,
      actions: [
        { action: 'complete', title: '✅ Mark Complete' },
        { action: 'snooze', title: '⏰ Snooze 5min' },
        { action: 'dismiss', title: '❌ Dismiss' }
      ]
    });
  }
});

// Handle notification action clicks
self.addEventListener('notificationclick', event => {
  const action = event.action;
  const notification = event.notification;
  
  event.notification.close();
  
  // Send action to main app
  event.waitUntil(
    clients.matchAll().then(clients => {
      if (clients.length > 0) {
        clients[0].postMessage({
          type: 'NOTIFICATION_ACTION',
          action: action,
          taskId: notification.tag
        });
      }
      
      // Focus or open the app
      return clients.length > 0 ? 
        clients[0].focus() : 
        self.clients.openWindow('./dashboard.html');
    })
  );
});
