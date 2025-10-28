// ============================================
// FIREBASE CONFIGURATION & AUTHENTICATION
// ============================================
// Real Firebase Setup for Mini Task Scheduler

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
window.firebaseConfig = firebaseConfig;

console.log('🔥 Firebase configuration loaded');

// Note: Firebase SDK will be loaded via CDN in HTML files
// This file just contains the configuration
