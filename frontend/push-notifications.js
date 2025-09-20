/**
 * Web Push Notifications System
 * Enables notifications even when browser/app is closed
 * FREE implementation using Web Push API
 */

class PushNotificationSystem {
  constructor() {
    this.swRegistration = null;
    this.isSubscribed = false;
    this.publicVapidKey = null; // Will be generated
    this.subscription = null;
    
    // Determine backend API base
    this.API_BASE = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
      ? 'http://localhost:3000/api'
      : 'https://task-scheduler-backend-production-c243.up.railway.app/api';
    
    // FREE push notification service options
    this.pushService = {
      // Option 1: Firebase Cloud Messaging (FREE)
      fcm: {
        apiKey: "your-fcm-api-key",
        projectId: "taskscheduler-free",
        messagingSenderId: "123456789",
        vapidKey: "your-vapid-key-here" // Generated for free
      },
      
      // Option 2: Web Push (FREE - self-hosted)
      webPush: {
        publicKey: null, // Generated locally
        privateKey: null, // Stored securely
        endpoint: 'http://localhost:3000/api/push' // Your backend
      }
    };

    console.log('🔔 Push Notification System initialized');
  }

  /**
   * Initialize push notifications
   */
  async initialize() {
    try {
      // Check if service workers are supported
      if (!('serviceWorker' in navigator)) {
        throw new Error('Service Workers not supported');
      }

      // Check if push notifications are supported
      if (!('PushManager' in window)) {
        throw new Error('Push notifications not supported');
      }

      // Register service worker
      await this.registerServiceWorker();
      
      // Check current subscription status
      await this.checkSubscriptionStatus();
      
      console.log('✅ Push notification system ready');
      return true;
    } catch (error) {
      console.error('❌ Push notification initialization failed:', error);
      return false;
    }
  }

  /**
   * Register service worker for background notifications
   */
  async registerServiceWorker() {
    try {
      // Reuse main service worker for notifications
      this.swRegistration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      console.log('✅ Service Worker ready for notifications');
      
      // Update service worker if needed
      this.swRegistration.addEventListener('updatefound', () => {
        console.log('🔄 Service Worker update found');
      });

      return this.swRegistration;
    } catch (error) {
      console.error('❌ Service Worker registration failed:', error);
      throw error;
    }
  }

  /**
   * Request notification permission from user
   */
  async requestPermission() {
    try {
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        console.log('✅ Notification permission granted');
        return true;
      } else if (permission === 'denied') {
        console.log('❌ Notification permission denied');
        return false;
      } else {
        console.log('⚠️ Notification permission dismissed');
        return false;
      }
    } catch (error) {
      console.error('❌ Permission request failed:', error);
      return false;
    }
  }

  /**
   * Subscribe to push notifications
   */
  async subscribeToPush() {
    try {
      if (!this.swRegistration) {
        await this.registerServiceWorker();
      }

      // Request permission first
      const permissionGranted = await this.requestPermission();
      if (!permissionGranted) {
        throw new Error('Notification permission required');
      }

      // Get VAPID key (FREE - can be generated)
      const vapidKey = await this.getVapidKey();
      
      // Subscribe to push service
      this.subscription = await this.swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(vapidKey)
      });

      // Send subscription to backend
      await this.sendSubscriptionToBackend();

      this.isSubscribed = true;
      console.log('✅ Push notification subscription successful');
      
      return {
        success: true,
        subscription: this.subscription
      };
    } catch (error) {
      console.error('❌ Push subscription failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get VAPID key (FREE - self-generated)
   */
  async getVapidKey() {
    // In production, this would be stored securely
    // For FREE implementation, we'll generate it
    if (!this.publicVapidKey) {
      // You can generate this for FREE at: https://vapidkeys.com/
      this.publicVapidKey = 'BKd-YOUR-FREE-GENERATED-VAPID-KEY-HERE';
    }
    return this.publicVapidKey;
  }

  /**
   * Send subscription details to backend
   */
  async sendSubscriptionToBackend() {
    try {
      const response = await fetch(`${this.API_BASE}/push/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription: this.subscription,
          userId: this.getCurrentUserId(),
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save subscription');
      }

      console.log('✅ Subscription saved to backend');
      return await response.json();
    } catch (error) {
      console.error('❌ Backend subscription failed:', error);
      // Continue anyway - store locally as backup
      this.storeSubscriptionLocally();
    }
  }

  /**
   * Store subscription locally as backup
   */
  storeSubscriptionLocally() {
    try {
      localStorage.setItem('pushSubscription', JSON.stringify(this.subscription));
      console.log('💾 Subscription stored locally as backup');
    } catch (error) {
      console.error('❌ Local subscription storage failed:', error);
    }
  }

  /**
   * Check current subscription status
   */
  async checkSubscriptionStatus() {
    try {
      if (!this.swRegistration) return false;

      this.subscription = await this.swRegistration.pushManager.getSubscription();
      this.isSubscribed = !(this.subscription === null);

      console.log(`📊 Subscription status: ${this.isSubscribed ? 'Active' : 'Inactive'}`);
      return this.isSubscribed;
    } catch (error) {
      console.error('❌ Subscription check failed:', error);
      return false;
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribeFromPush() {
    try {
      if (!this.subscription) {
        console.log('⚠️ No active subscription to unsubscribe');
        return true;
      }

      // Unsubscribe from push service
      await this.subscription.unsubscribe();

      // Remove from backend
      await this.removeSubscriptionFromBackend();

      this.subscription = null;
      this.isSubscribed = false;

      console.log('✅ Push notification unsubscribed');
      return true;
    } catch (error) {
      console.error('❌ Unsubscribe failed:', error);
      return false;
    }
  }

  /**
   * Remove subscription from backend
   */
  async removeSubscriptionFromBackend() {
    try {
      await fetch(`${this.API_BASE}/push/unsubscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: this.getCurrentUserId()
        })
      });
      console.log('✅ Subscription removed from backend');
    } catch (error) {
      console.error('⚠️ Backend unsubscribe failed:', error);
    }
  }

  /**
   * Send test notification
   */
  async sendTestNotification() {
    try {
      const response = await fetch(`${this.API_BASE}/push/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: this.getCurrentUserId(),
          title: 'Task Scheduler Test',
          body: 'Push notifications are working! 🎉',
          icon: '/assets/logo.png',
          badge: '/assets/badge.png',
          actions: [
            {
              action: 'view',
              title: 'View Tasks',
              icon: '/assets/view-icon.png'
            },
            {
              action: 'dismiss',
              title: 'Dismiss',
              icon: '/assets/dismiss-icon.png'
            }
          ]
        })
      });

      if (response.ok) {
        console.log('✅ Test notification sent');
        return { success: true };
      } else {
        throw new Error('Test notification failed');
      }
    } catch (error) {
      console.error('❌ Test notification failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Schedule task notification
   */
  async scheduleTaskNotification(task) {
    try {
      const response = await fetch(`${this.API_BASE}/push/schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: this.getCurrentUserId(),
          taskId: task.id,
          title: `Task Reminder: ${task.title}`,
          body: task.description || 'You have a scheduled task',
          scheduledTime: task.scheduledTime,
          icon: '/assets/task-icon.png',
          badge: '/assets/badge.png',
          tag: `task-${task.id}`,
          requireInteraction: true,
          actions: [
            {
              action: 'complete',
              title: 'Mark Complete',
              icon: '/assets/complete-icon.png'
            },
            {
              action: 'snooze',
              title: 'Snooze 10min',
              icon: '/assets/snooze-icon.png'
            }
          ]
        })
      });

      if (response.ok) {
        console.log('✅ Task notification scheduled');
        return { success: true };
      } else {
        throw new Error('Task notification scheduling failed');
      }
    } catch (error) {
      console.error('❌ Task notification scheduling failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Utility: Convert VAPID key
   */
  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  /**
   * Get current user ID
   */
  getCurrentUserId() {
    // Get from authentication system
    return localStorage.getItem('userId') || 'anonymous';
  }

  /**
   * Show notification permission prompt
   */
  showPermissionPrompt() {
    return `
      <div class="permission-prompt">
        <div class="permission-content">
          <h3>🔔 Enable Notifications</h3>
          <p>Get notified about your tasks even when the app is closed</p>
          <div class="permission-benefits">
            <ul>
              <li>✅ Task reminders</li>
              <li>✅ Deadline alerts</li>
              <li>✅ Background sync</li>
              <li>✅ Works offline</li>
            </ul>
          </div>
          <div class="permission-actions">
            <button onclick="pushNotifications.subscribeToPush()" class="btn-primary">
              Enable Notifications
            </button>
            <button onclick="this.parentElement.parentElement.parentElement.remove()" class="btn-secondary">
              Maybe Later
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Get subscription status for UI
   */
  getStatus() {
    return {
      supported: 'serviceWorker' in navigator && 'PushManager' in window,
      permission: Notification.permission,
      subscribed: this.isSubscribed,
      subscription: this.subscription
    };
  }
}

// Create global instance
window.pushNotifications = new PushNotificationSystem();

console.log('🔔 FREE Push Notification System loaded - Works even when app is closed!');