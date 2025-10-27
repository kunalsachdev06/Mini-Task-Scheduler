# Firebase Authentication Setup Guide

## 🔥 Firebase Configuration Complete!

Your Firebase project is set up and ready to use for authentication.

### ✅ What's Configured

- **Project Name:** Mini-Task-Scheduler
- **Project ID:** mini-task-scheduler
- **App ID:** 1:997330328846:web:c217d6b5e4686f70298b5f

### 📱 Authentication Methods Available

1. **Phone Authentication (OTP)** - ✅ Configured
2. **Email/Password Authentication** - ✅ Configured
3. **Guest Mode** - ✅ Available

---

## 🚀 Quick Start

### 1. Enable Authentication in Firebase Console

Go to [Firebase Console](https://console.firebase.google.com/project/mini-task-scheduler)

#### Enable Phone Authentication:
1. Click **Authentication** in the left sidebar
2. Go to **Sign-in method** tab
3. Click **Phone** provider
4. Enable it and click **Save**
5. Add your domain to **Authorized domains** (for local testing, add `localhost`)

#### Enable Email/Password Authentication:
1. In the same **Sign-in method** tab
2. Click **Email/Password** provider
3. Enable **Email/Password** (first option)
4. Click **Save**

### 2. Configure Firestore Database

1. Click **Firestore Database** in the left sidebar
2. Click **Create database**
3. Choose **Start in test mode** (for development)
4. Select your preferred region
5. Click **Enable**

### 3. Add Authorized Domains

For local development:
1. Go to **Authentication** > **Settings** > **Authorized domains**
2. Add `localhost` if not already present
3. For production, add your actual domain

---

## 📝 Usage Instructions

### Access the Login Page

Open: `frontend/auth-login.html`

### Login Methods

#### 1. Phone Authentication (OTP)
- Select your country code
- Enter your phone number (10 digits)
- Solve the reCAPTCHA
- Click "Send OTP"
- Enter the 6-digit OTP received via SMS
- Click "Verify OTP"

**Free Tier Limit:** 10,000 verifications per month

#### 2. Email/Password
- Enter your email address
- Enter your password (min 6 characters)
- Click "Sign In" to login
- Or click "Create Account" to register

**Free Tier:** Unlimited users

#### 3. Guest Mode
- Click "Continue as Guest"
- Data stored only locally (not synced)
- Perfect for testing or single-device usage

---

## 🔒 Security Features Implemented

✅ reCAPTCHA verification for phone auth  
✅ Secure OTP verification  
✅ Password minimum length enforcement  
✅ Firebase security rules (set to test mode initially)  
✅ Firestore user profile storage  
✅ LocalStorage for session management  
✅ Auto-redirect if already logged in  
✅ Logout functionality  

---

## 📁 Files Created/Modified

### New Files:
- `frontend/auth-login.html` - Complete authentication page with OTP
- `frontend/auth-guard.js` - Authentication middleware
- `frontend/firebase-config-new.js` - Clean Firebase config

### Configuration:
All Firebase credentials are properly configured in `auth-login.html`

---

## 🎨 Features

### Phone Authentication UI:
- Country code selector (8 major countries)
- Clean OTP input (6 digits with auto-focus)
- Resend OTP functionality
- Real-time validation
- Success/Error messages

### Email Authentication UI:
- Email validation
- Password strength check
- Login/Signup toggle
- Remember session

### General:
- Tab-based interface
- Responsive design
- Loading spinners
- Error handling
- Auto-redirect after login
- User info display
- Logout button

---

## 🧪 Testing

### Test Phone Authentication:
1. Use a real phone number for initial setup
2. Firebase Test Mode allows testing without SMS charges during development

### Test Email Authentication:
```
Email: test@example.com
Password: test123
```
Create account first, then login

### Test Guest Mode:
- Click "Continue as Guest"
- All data stored locally
- No Firebase authentication required

---

## 🔐 Production Setup Checklist

Before deploying to production:

- [ ] Update Firestore rules from test mode to production rules
- [ ] Configure proper security rules for user data
- [ ] Add production domain to Authorized domains
- [ ] Enable Firebase App Check for additional security
- [ ] Set up Firebase billing (for phone auth beyond free tier)
- [ ] Configure email templates for password reset
- [ ] Add user profile management
- [ ] Implement email verification
- [ ] Add password reset functionality
- [ ] Configure CORS properly

---

## 📊 Firebase Pricing (Free Tier)

| Feature | Free Tier Limit |
|---------|-----------------|
| Phone Authentication | 10,000 verifications/month |
| Email/Password Auth | Unlimited |
| Firestore Reads | 50,000/day |
| Firestore Writes | 20,000/day |
| Firestore Storage | 1 GB |
| Firestore Bandwidth | 10 GB/month |

---

## 🛠️ Firestore Security Rules

For production, replace test mode rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Tasks belong to users
    match /users/{userId}/tasks/{taskId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## 🐛 Troubleshooting

### reCAPTCHA not showing:
- Clear browser cache
- Check console for errors
- Ensure domain is authorized
- Refresh the page

### OTP not received:
- Verify phone number format
- Check Firebase console > Authentication > Users
- Verify phone auth is enabled
- Check SMS quota in Firebase console

### Email signup fails:
- Ensure email/password auth is enabled
- Password must be at least 6 characters
- Check Firebase console for error logs

### Localhost issues:
- Ensure `localhost` is in Authorized domains
- Use `http://localhost` not `file://`
- Serve files via HTTP server

---

## 📞 Support

- Firebase Documentation: https://firebase.google.com/docs
- Firebase Console: https://console.firebase.google.com/project/mini-task-scheduler
- Authentication Docs: https://firebase.google.com/docs/auth

---

## ✅ Next Steps

1. Test the authentication flow
2. Set up proper Firestore security rules
3. Add user profile page
4. Implement password reset
5. Add email verification
6. Set up proper error logging
7. Add analytics

**Your Firebase authentication is ready to use! 🎉**
