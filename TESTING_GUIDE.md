# 3-Factor Authentication Testing Guide

## ✅ Cleanup Complete
**Archived Files:**
- `auth-login.html` → `archive/`
- `auth-simple.html` → `archive/`
- `firebase-otp-test.html` → `archive/`
- `login-new.html` → `archive/`
- `login-old.html` → `archive/`

**Active Files:**
- `login.html` - Main 3-factor authentication page
- `register-enhanced.html` - Registration with face setup
- `dashboard-enhanced.html` - Main dashboard
- `index.html` - Landing page
- `about.html` - About page
- `history.html` - Task history

---

## 🚀 Server Status
- **Backend:** Running on port 3001 ✅
- **Frontend:** Running on port 8080 ✅
- **Login Page:** http://localhost:8080/login.html

---

## 🔐 3-Factor Authentication Flow

### **Factor 1: Password Authentication**
Choose one of two methods:

#### Option A: Email/Password
1. Open http://localhost:8080/login.html
2. Click **"Email"** tab (default)
3. Enter email and password
4. Click **"Sign In"**

#### Option B: Phone Number
1. Open http://localhost:8080/login.html
2. Click **"Phone"** tab
3. Enter phone number (e.g., +1234567890)
4. Click **"Send OTP"**

**Test Phone Number (bypasses rate limits):**
- Phone: `+91 9876543210`
- OTP Code: `123456`

---

### **Factor 2: OTP Verification**

#### For Email Login:
- Firebase sends verification email automatically
- Check email and click verification link
- Or use Firebase Console to verify manually

#### For Phone Login:
1. reCAPTCHA appears (may require domain authorization)
2. Receive 6-digit SMS code
3. Enter OTP code
4. Click **"Verify OTP"**

**If reCAPTCHA fails:**
- Use test phone number: `+91 9876543210`
- Use test OTP: `123456`
- Or enable Phone provider in Firebase Console

---

### **Factor 3: Face Recognition Biometric**

After successful password + OTP authentication:

1. **Face Recognition Modal Opens**
   - Camera access request appears
   - Allow camera permissions

2. **Face Detection**
   - Face-api.js loads AI models
   - TinyFaceDetector activates
   - 68 facial landmarks detected
   - Real-time overlay shows face detection

3. **Face Capture**
   - System extracts 128-dimensional face descriptor
   - Descriptor saved to Firestore
   - Status: "Face detected! Saving..."

4. **Completion**
   - Success message: "Login successful!"
   - Redirect to `index.html`
   - JWT token stored in localStorage

**Note:** You can skip face recognition (not recommended) using the skip button.

---

## 📝 Complete Test Scenarios

### **Scenario 1: New User Registration**
1. Navigate to http://localhost:8080/register-enhanced.html
2. Enter email, password, phone number
3. Complete email verification
4. Complete phone OTP verification
5. Set up face recognition (Factor 3)
6. Redirect to `dashboard-enhanced.html`

### **Scenario 2: Returning User Login (Email)**
1. Navigate to http://localhost:8080/login.html
2. Enter existing email + password
3. Face recognition modal opens
4. System compares face descriptor with stored data
5. Match found → Login successful
6. Redirect to `index.html`

### **Scenario 3: Returning User Login (Phone)**
1. Navigate to http://localhost:8080/login.html
2. Click "Phone" tab
3. Enter phone number → Receive OTP
4. Enter OTP code
5. Face recognition verification
6. Login successful → Redirect to `index.html`

### **Scenario 4: Dashboard Access Control**
1. Navigate to http://localhost:8080/dashboard-enhanced.html
2. **Without authentication:** Redirect to `login.html`
3. **With authentication:** Dashboard loads with tasks

### **Scenario 5: Logout Flow**
1. From `dashboard-enhanced.html`, click **"Logout"**
2. JWT token cleared from localStorage
3. Firebase signOut() called
4. Redirect to `index.html`
5. Attempt to access dashboard → Redirect to `login.html`

---

## 🔍 What to Test

### ✅ Authentication Features
- [ ] Email login works (Factor 1)
- [ ] Phone login works (Factor 1)
- [ ] OTP verification works (Factor 2)
- [ ] Face recognition captures face (Factor 3)
- [ ] Face descriptor saved to Firestore
- [ ] JWT token generated and stored
- [ ] Login redirects to index.html

### ✅ Security Features
- [ ] Dashboard requires authentication
- [ ] No authentication → Redirect to login.html
- [ ] Logout clears tokens
- [ ] Cannot access protected pages without JWT

### ✅ Navigation
- [ ] index.html → login.html link works
- [ ] index.html → register-enhanced.html link works
- [ ] register-enhanced.html → dashboard-enhanced.html redirect works
- [ ] dashboard-enhanced.html → history.html link works
- [ ] dashboard-enhanced.html → about.html link works
- [ ] All pages link correctly (no 404s)

### ✅ Theme System
- [ ] Dark/Light toggle works on login page
- [ ] Theme persists across page navigation
- [ ] CSS variables apply correctly
- [ ] Theme toggle in dashboard works

### ✅ Face Recognition
- [ ] Camera permissions requested
- [ ] Face-api.js models load correctly
- [ ] Face detection overlay shows on video
- [ ] Face descriptor extraction works
- [ ] Descriptor saved to Firestore as array
- [ ] Face verification on subsequent logins

---

## 🐛 Known Issues & Solutions

### Issue 1: reCAPTCHA Not Loading (Phone OTP)
**Problem:** "reCAPTCHA has not been correctly set up"

**Solutions:**
1. Use test phone number: `+91 9876543210` with OTP `123456`
2. Add `localhost` to Firebase Console → Authentication → Settings → Authorized domains
3. Enable Phone provider in Firebase Console
4. Wait 5 minutes after Firebase configuration changes

### Issue 2: too-many-requests Error
**Problem:** Firebase rate limiting on phone authentication

**Solution:**
- Use test phone number (no rate limit)
- Or use email authentication instead
- Or wait 1 hour for rate limit reset

### Issue 3: Camera Not Working
**Problem:** Face recognition cannot access camera

**Solutions:**
1. Allow camera permissions in browser
2. Use HTTPS (or localhost is allowed)
3. Check browser console for errors
4. Ensure face-api.js CDN loaded

### Issue 4: Face Recognition Skipped
**Note:** Skip button bypasses Factor 3 (not recommended)

**For Production:**
- Remove skip button
- Make face recognition mandatory
- Add face verification on subsequent logins

---

## 🎯 Expected Behavior

### ✅ Successful Login Flow
1. User enters email/password OR phone number
2. OTP verification (if phone) OR email verification
3. Face recognition modal opens
4. Face detected and descriptor saved
5. "Login successful!" message
6. Redirect to index.html
7. JWT token in localStorage
8. Can access dashboard-enhanced.html

### ❌ Failed Authentication
1. Wrong password → Error message
2. Invalid OTP → "Invalid OTP" message
3. No face detected → "No face detected" status
4. No JWT token → Redirect to login.html

---

## 📊 Security Verification

### Check JWT Token
```javascript
// In browser console:
console.log(localStorage.getItem('authToken'));
```

### Check Face Descriptor in Firestore
1. Open Firebase Console
2. Navigate to Firestore Database
3. Collection: `users`
4. Document: `{userId}`
5. Field: `faceDescriptor` (array of 128 numbers)

### Test Authentication Guard
```javascript
// Try to access dashboard without login:
localStorage.removeItem('authToken');
window.location.href = '/dashboard-enhanced.html';
// Should redirect to login.html
```

---

## 🔧 Troubleshooting Commands

### Stop All Node Processes
```powershell
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
```

### Restart Backend Server
```powershell
cd "c:\Users\KUNAL\Downloads\mini_task_schedulerr"
$env:JWT_SECRET="test-secret-key-minimum-32-characters-long-for-security"
node server.js
```

### Restart Frontend Server
```powershell
cd "c:\Users\KUNAL\Downloads\mini_task_schedulerr\frontend"
python -m http.server 8080
```

### Check Server Status
```powershell
# Backend (should show port 3001)
netstat -ano | findstr :3001

# Frontend (should show port 8080)
netstat -ano | findstr :8080
```

---

## ✨ Testing Complete!

Both servers are running and ready for testing. Open http://localhost:8080/login.html to begin.

**Quick Test:**
1. Click "Email" tab
2. Enter: test@example.com / password123
3. Allow camera access
4. Face recognition captures your face
5. Login successful!

**Production Checklist:**
- [ ] Remove skip button from face recognition
- [ ] Add face verification for returning users
- [ ] Enable Firebase Phone provider
- [ ] Add localhost to authorized domains
- [ ] Test all three factors end-to-end
- [ ] Verify JWT token generation
- [ ] Test dashboard authentication guard
- [ ] Remove archived test files
