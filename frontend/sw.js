// Enhanced Service Worker with Push Notifications
// Enables offline functionality and background notifications

const CACHE_NAME = 'task-scheduler-v1.0';
const urlsToCache = [
  '/',
  '/index.html',
  '/dashboard-enhanced.html',
  '/register-enhanced.html',
  '/styles-enhanced.css',
  '/app.js',
  '/script.js',
  '/auth-free.js',
  '/face-recognition.js',
  '/push-notifications.js',
  '/assets/logo.png',
  '/assets/logo.svg',
  '/manifest.webmanifest',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap'
];

// Install event - cache resources
self.addEventListener('install', event => {
  console.log('🔧 Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Caching app resources');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('✅ Service Worker installed successfully');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('🔄 Service Worker activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Service Worker activated');
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!event.request.url.startsWith('http')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version or fetch from network
        if (response) {
          console.log('📦 Serving from cache:', event.request.url);
          return response;
        }

        console.log('🌐 Fetching from network:', event.request.url);
        return fetch(event.request).then(response => {
          // Don't cache non-successful responses
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response for caching
          const responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });

          return response;
        });
      })
      .catch(() => {
        // Offline fallback
        if (event.request.destination === 'document') {
          return caches.match('/index.html');
        }
      })
  );
});

// ============================================
// PUSH NOTIFICATION HANDLING
// ============================================

// Push event - handle incoming notifications
self.addEventListener('push', event => {
  console.log('🔔 Push notification received');

  let notificationData = {
    title: 'Task Scheduler',
    body: 'You have a new notification',
    icon: '/assets/logo.png',
    badge: '/assets/badge.png',
    tag: 'default',
    requireInteraction: false,
    actions: []
  };

  // Parse push data if available
  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = { ...notificationData, ...data };
      console.log('📊 Push data:', data);
    } catch (error) {
      console.error('❌ Failed to parse push data:', error);
      notificationData.body = event.data.text();
    }
  }

  // Show notification
  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      requireInteraction: notificationData.requireInteraction,
      data: notificationData.data || {},
      actions: notificationData.actions || [],
      vibrate: [200, 100, 200], // Vibration pattern
      silent: false,
      timestamp: Date.now()
    })
  );
});

// Notification click event
self.addEventListener('notificationclick', event => {
  console.log('🖱️ Notification clicked:', event.notification.tag);

  // Close the notification
  event.notification.close();

  // Handle action buttons
  if (event.action === 'complete') {
    // Mark task as complete
    event.waitUntil(
      handleTaskComplete(event.notification.data.taskId)
    );
    return;
  }

  if (event.action === 'snooze') {
    // Snooze task for 10 minutes
    event.waitUntil(
      handleTaskSnooze(event.notification.data.taskId, 10)
    );
    return;
  }

  if (event.action === 'view') {
    // Open dashboard
    event.waitUntil(
      clients.openWindow('/dashboard-enhanced.html')
    );
    return;
  }

  // Default action - open app
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url.includes(self.location.origin)) {
          return client.focus();
        }
      }
      
      // Open new window
      if (clients.openWindow) {
        return clients.openWindow('/dashboard-enhanced.html');
      }
    })
  );
});

// Background sync for offline actions
self.addEventListener('sync', event => {
  console.log('🔄 Background sync triggered:', event.tag);

  if (event.tag === 'task-sync') {
    event.waitUntil(syncTasks());
  }

  if (event.tag === 'notification-sync') {
    event.waitUntil(syncNotifications());
  }
});

// Message handling from main app
self.addEventListener('message', event => {
  console.log('📨 Message from app:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'SCHEDULE_NOTIFICATION') {
    scheduleLocalNotification(event.data.notification);
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

// Handle task completion from notification
async function handleTaskComplete(taskId) {
  try {
    console.log('✅ Marking task complete:', taskId);

    // Try to send to backend
    const response = await fetch(`/api/tasks/${taskId}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (response.ok) {
      console.log('✅ Task marked complete via backend');
    } else {
      // Store for sync when online
      await storeOfflineAction('complete-task', { taskId });
    }

    // Show confirmation notification
    await self.registration.showNotification('Task Completed! ✅', {
      body: 'Great job! Your task has been marked as complete.',
      icon: '/assets/logo.png',
      tag: 'task-complete',
      requireInteraction: false
    });

  } catch (error) {
    console.error('❌ Task completion failed:', error);
    // Store for sync when online
    await storeOfflineAction('complete-task', { taskId });
  }
}

// Handle task snooze from notification
async function handleTaskSnooze(taskId, minutes) {
  try {
    console.log(`⏰ Snoozing task for ${minutes} minutes:`, taskId);

    const snoozeTime = new Date(Date.now() + minutes * 60 * 1000);

    // Try to send to backend
    const response = await fetch(`/api/tasks/${taskId}/snooze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ snoozeUntil: snoozeTime.toISOString() })
    });

    if (response.ok) {
      console.log('⏰ Task snoozed via backend');
    } else {
      // Store for sync when online
      await storeOfflineAction('snooze-task', { taskId, snoozeUntil: snoozeTime });
    }

    // Show confirmation notification
    await self.registration.showNotification(`Snoozed for ${minutes} minutes ⏰`, {
      body: `You'll be reminded again at ${snoozeTime.toLocaleTimeString()}`,
      icon: '/assets/logo.png',
      tag: 'task-snooze',
      requireInteraction: false
    });

  } catch (error) {
    console.error('❌ Task snooze failed:', error);
    // Store for sync when online
    await storeOfflineAction('snooze-task', { taskId, snoozeUntil: new Date(Date.now() + minutes * 60 * 1000) });
  }
}

// Store offline actions for later sync
async function storeOfflineAction(action, data) {
  try {
    const cache = await caches.open('offline-actions');
    const actionData = {
      action,
      data,
      timestamp: Date.now()
    };

    await cache.put(
      `/offline-action-${Date.now()}`,
      new Response(JSON.stringify(actionData))
    );

    console.log('💾 Offline action stored:', action);
  } catch (error) {
    console.error('❌ Failed to store offline action:', error);
  }
}

// Sync tasks when coming back online
async function syncTasks() {
  try {
    console.log('🔄 Syncing tasks...');

    const cache = await caches.open('offline-actions');
    const requests = await cache.keys();

    for (const request of requests) {
      if (request.url.includes('offline-action-')) {
        try {
          const response = await cache.match(request);
          const actionData = await response.json();

          // Process the offline action
          await processOfflineAction(actionData);

          // Remove processed action
          await cache.delete(request);
        } catch (error) {
          console.error('❌ Failed to process offline action:', error);
        }
      }
    }

    console.log('✅ Task sync completed');
  } catch (error) {
    console.error('❌ Task sync failed:', error);
  }
}

// Process individual offline action
async function processOfflineAction(actionData) {
  const { action, data } = actionData;

  switch (action) {
    case 'complete-task':
      await fetch(`/api/tasks/${data.taskId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      break;

    case 'snooze-task':
      await fetch(`/api/tasks/${data.taskId}/snooze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snoozeUntil: data.snoozeUntil })
      });
      break;

    default:
      console.warn('❓ Unknown offline action:', action);
  }
}

// Schedule local notification (for offline use)
function scheduleLocalNotification(notificationData) {
  // This would use local storage and check periodically
  // For simplicity, we'll use setTimeout for demo
  const delay = new Date(notificationData.scheduledTime) - new Date();
  
  if (delay > 0 && delay < 24 * 60 * 60 * 1000) { // Within 24 hours
    setTimeout(() => {
      self.registration.showNotification(notificationData.title, {
        body: notificationData.body,
        icon: notificationData.icon || '/assets/logo.png',
        tag: notificationData.tag || 'scheduled',
        requireInteraction: true
      });
    }, delay);
  }
}

// Sync notifications
async function syncNotifications() {
  try {
    console.log('🔄 Syncing notifications...');
    
    // Fetch pending notifications from backend
    const response = await fetch('/api/notifications/pending');
    if (response.ok) {
      const notifications = await response.json();
      
      for (const notification of notifications) {
        if (new Date(notification.scheduledTime) <= new Date()) {
          // Show overdue notifications
          await self.registration.showNotification(notification.title, {
            body: notification.body,
            icon: notification.icon || '/assets/logo.png',
            tag: notification.tag || 'synced'
          });
        }
      }
    }
    
    console.log('✅ Notification sync completed');
  } catch (error) {
    console.error('❌ Notification sync failed:', error);
  }
}

console.log('🚀 Enhanced Service Worker loaded - Push notifications & offline support enabled!');
