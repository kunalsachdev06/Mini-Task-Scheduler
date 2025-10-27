// Firebase Configuration for Task Scheduler App
// Real Firebase Setup with Authentication

// Your Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyAKSP427ylNW6ZAqZsZJ92CS549t76mSMk",
  authDomain: "mini-task-scheduler.firebaseapp.com",
  projectId: "mini-task-scheduler",
  storageBucket: "mini-task-scheduler.firebasestorage.app",
  messagingSenderId: "997330328846",
  appId: "1:997330328846:web:c217d6b5e4686f70298b5f",
  measurementId: "G-V0M473G51C"
};

// Make config available globally
window.firebaseConfig = firebaseConfig;// TODO: Replace with your actual Firebase config

const firebaseConfig = {

console.log('🔥 Firebase config loaded (demo mode)');  apiKey: "your-api-key-here",
  authDomain: "your-project.firebaseapp.com", 
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};

// Initialize Firebase
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
  getAuth, 
  RecaptchaVerifier, 
  signInWithPhoneNumber,
  signOut,
  onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ============================================
// FIREBASE AUTH UTILITIES
// ============================================

class FirebaseAuthManager {
  constructor() {
    this.auth = auth;
    this.db = db;
    this.recaptchaVerifier = null;
    this.confirmationResult = null;
    this.currentUser = null;
    
    // Listen for auth state changes
    onAuthStateChanged(this.auth, (user) => {
      this.currentUser = user;
      this.handleAuthStateChange(user);
    });
  }

  // Initialize reCAPTCHA verifier
  initializeRecaptcha(containerId = 'recaptcha-container') {
    try {
      if (this.recaptchaVerifier) {
        this.recaptchaVerifier.clear();
      }

      this.recaptchaVerifier = new RecaptchaVerifier(this.auth, containerId, {
        'size': 'normal',
        'callback': (response) => {
          console.log('✅ reCAPTCHA solved');
          this.showMessage('reCAPTCHA verified! You can now send SMS.', 'success');
        },
        'expired-callback': () => {
          console.warn('⚠️ reCAPTCHA expired');
          this.showMessage('reCAPTCHA expired. Please solve it again.', 'warning');
        },
        'error-callback': (error) => {
          console.error('❌ reCAPTCHA error:', error);
          this.showMessage('reCAPTCHA error. Please refresh and try again.', 'error');
        }
      });

      return this.recaptchaVerifier;
    } catch (error) {
      console.error('❌ Failed to initialize reCAPTCHA:', error);
      this.showMessage('Failed to initialize reCAPTCHA. Please refresh the page.', 'error');
      throw error;
    }
  }

  // Send SMS verification code
  async sendSMSVerification(phoneNumber) {
    try {
      this.showMessage('Sending SMS verification code...', 'info');

      // Ensure reCAPTCHA is initialized
      if (!this.recaptchaVerifier) {
        throw new Error('reCAPTCHA not initialized');
      }

      // Format phone number (ensure it starts with country code)
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      console.log('📱 Sending SMS to:', formattedPhone);

      // Send verification SMS
      this.confirmationResult = await signInWithPhoneNumber(
        this.auth, 
        formattedPhone, 
        this.recaptchaVerifier
      );

      console.log('✅ SMS sent successfully');
      this.showMessage('SMS verification code sent! Check your phone.', 'success');
      
      // Store phone number for later use
      localStorage.setItem('pendingPhoneNumber', formattedPhone);
      
      return true;
    } catch (error) {
      console.error('❌ SMS sending failed:', error);
      
      // Handle specific Firebase Auth errors
      if (error.code === 'auth/invalid-phone-number') {
        this.showMessage('Invalid phone number format. Please check and try again.', 'error');
      } else if (error.code === 'auth/too-many-requests') {
        this.showMessage('Too many requests. Please wait before trying again.', 'error');
      } else if (error.code === 'auth/captcha-check-failed') {
        this.showMessage('reCAPTCHA verification failed. Please solve it again.', 'error');
        this.recaptchaVerifier?.clear();
        this.initializeRecaptcha();
      } else {
        this.showMessage('Failed to send SMS. Please try again.', 'error');
      }
      
      throw error;
    }
  }

  // Verify SMS code and complete authentication
  async verifySMSCode(code) {
    try {
      if (!this.confirmationResult) {
        throw new Error('No pending SMS verification');
      }

      this.showMessage('Verifying SMS code...', 'info');

      // Verify the SMS code
      const userCredential = await this.confirmationResult.confirm(code);
      const user = userCredential.user;

      console.log('✅ SMS verification successful:', user.uid);
      this.showMessage('SMS verified successfully! Setting up your account...', 'success');

      // Store user data in Firestore
      await this.saveUserToFirestore(user);

      // Clear pending data
      localStorage.removeItem('pendingPhoneNumber');
      
      return user;
    } catch (error) {
      console.error('❌ SMS verification failed:', error);
      
      if (error.code === 'auth/invalid-verification-code') {
        this.showMessage('Invalid verification code. Please check and try again.', 'error');
      } else if (error.code === 'auth/code-expired') {
        this.showMessage('Verification code expired. Please request a new one.', 'error');
      } else {
        this.showMessage('SMS verification failed. Please try again.', 'error');
      }
      
      throw error;
    }
  }

  // Save user data to Firestore
  async saveUserToFirestore(user) {
    try {
      const userData = {
        uid: user.uid,
        phoneNumber: user.phoneNumber,
        createdAt: new Date(),
        lastLogin: new Date(),
        isVerified: true,
        accountType: 'free',
        features: {
          taskScheduling: true,
          pushNotifications: true,
          faceRecognition: true,
          emailNotifications: true
        }
      };

      await setDoc(doc(this.db, 'users', user.uid), userData, { merge: true });
      console.log('✅ User data saved to Firestore');
      
      return userData;
    } catch (error) {
      console.error('❌ Failed to save user data:', error);
      // Don't throw here - user is authenticated even if Firestore fails
    }
  }

  // Get user data from Firestore
  async getUserData(uid) {
    try {
      const userDoc = await getDoc(doc(this.db, 'users', uid));
      if (userDoc.exists()) {
        return userDoc.data();
      }
      return null;
    } catch (error) {
      console.error('❌ Failed to get user data:', error);
      return null;
    }
  }

  // Sign out user
  async signOutUser() {
    try {
      await signOut(this.auth);
      this.currentUser = null;
      console.log('✅ User signed out');
      this.showMessage('Signed out successfully', 'success');
      
      // Clear local data
      localStorage.removeItem('pendingPhoneNumber');
      
      return true;
    } catch (error) {
      console.error('❌ Sign out failed:', error);
      this.showMessage('Failed to sign out', 'error');
      throw error;
    }
  }

  // Handle auth state changes
  handleAuthStateChange(user) {
    if (user) {
      console.log('✅ User authenticated:', user.uid);
      
      // Update UI or redirect to dashboard
      if (typeof window !== 'undefined' && window.location.pathname.includes('register')) {
        window.location.href = '/dashboard-enhanced.html';
      }
      
      // Trigger custom event
      window.dispatchEvent(new CustomEvent('authStateChanged', { 
        detail: { user, authenticated: true } 
      }));
    } else {
      console.log('ℹ️ User not authenticated');
      
      // Trigger custom event
      window.dispatchEvent(new CustomEvent('authStateChanged', { 
        detail: { user: null, authenticated: false } 
      }));
    }
  }

  // Format phone number with country code
  formatPhoneNumber(phoneNumber) {
    // Remove all non-digits
    const digits = phoneNumber.replace(/\D/g, '');
    
    // Add country code if not present
    if (!digits.startsWith('1') && digits.length === 10) {
      return '+1' + digits; // Assume US number
    } else if (!digits.startsWith('+')) {
      return '+' + digits;
    }
    
    return phoneNumber;
  }

  // Show message to user
  showMessage(message, type = 'info') {
    console.log(`${type.toUpperCase()}: ${message}`);
    
    // Create or update message element
    let messageElement = document.getElementById('auth-message');
    if (!messageElement) {
      messageElement = document.createElement('div');
      messageElement.id = 'auth-message';
      messageElement.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        font-weight: 500;
        z-index: 10000;
        transition: all 0.3s ease;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      `;
      document.body.appendChild(messageElement);
    }

    // Set message and styling based on type
    messageElement.textContent = message;
    messageElement.className = `auth-message ${type}`;
    
    const colors = {
      success: { bg: '#d4edda', text: '#155724', border: '#c3e6cb' },
      error: { bg: '#f8d7da', text: '#721c24', border: '#f5c6cb' },
      warning: { bg: '#fff3cd', text: '#856404', border: '#ffeaa7' },
      info: { bg: '#d1ecf1', text: '#0c5460', border: '#bee5eb' }
    };
    
    const color = colors[type] || colors.info;
    messageElement.style.backgroundColor = color.bg;
    messageElement.style.color = color.text;
    messageElement.style.border = `1px solid ${color.border}`;
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      if (messageElement && messageElement.parentNode) {
        messageElement.remove();
      }
    }, 5000);
  }

  // Get current user
  getCurrentUser() {
    return this.currentUser;
  }

  // Check if user is authenticated
  isAuthenticated() {
    return !!this.currentUser;
  }
}

// ============================================
// EXPORT AND INITIALIZE
// ============================================

// Create global instance
window.firebaseAuth = new FirebaseAuthManager();

// Export for use in other modules
export { FirebaseAuthManager, auth, db };

console.log('🔥 Firebase Authentication initialized - Free tier: 25k SMS/month');