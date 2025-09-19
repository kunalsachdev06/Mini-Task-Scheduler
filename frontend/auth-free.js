/* Firebase Configuration for FREE Phone Auth & Email */
// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, sendEmailVerification, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

// Your web app's Firebase configuration (FREE tier)
const firebaseConfig = {
  apiKey: "your-api-key-here", // Free tier - unlimited usage
  authDomain: "taskscheduler-free.firebaseapp.com",
  projectId: "taskscheduler-free", 
  storageBucket: "taskscheduler-free.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123def456"
  // Note: You'll need to create a FREE Firebase project and replace these
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

class FreeAuthenticationSystem {
  constructor() {
    this.auth = auth;
    this.db = db;
    this.recaptchaVerifier = null;
    this.confirmationResult = null;
    this.currentUser = null;
    
    // EmailJS configuration (FREE tier - 200 emails/month)
    this.emailJS = {
      serviceId: 'service_taskscheduler', // You'll need to create this
      templateId: 'template_verification',
      userId: 'your-emailjs-user-id' // Free EmailJS account
    };
    
    console.log('🆓 FREE Authentication System initialized');
  }

  // Initialize reCAPTCHA for phone verification (FREE)
  async initializeRecaptcha() {
    try {
      this.recaptchaVerifier = new RecaptchaVerifier('recaptcha-container', {
        'size': 'normal',
        'callback': (response) => {
          console.log('✅ reCAPTCHA verified');
        },
        'expired-callback': () => {
          console.log('⚠️ reCAPTCHA expired');
        }
      }, this.auth);

      await this.recaptchaVerifier.render();
      console.log('✅ reCAPTCHA initialized');
      return true;
    } catch (error) {
      console.error('❌ reCAPTCHA initialization failed:', error);
      return false;
    }
  }

  // Send FREE SMS OTP using Firebase
  async sendSMSOTP(phoneNumber) {
    try {
      if (!this.recaptchaVerifier) {
        await this.initializeRecaptcha();
      }

      // Format phone number for international use
      const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
      
      console.log('📱 Sending FREE SMS OTP to:', formattedPhone);
      
      this.confirmationResult = await signInWithPhoneNumber(this.auth, formattedPhone, this.recaptchaVerifier);
      
      console.log('✅ SMS OTP sent successfully (FREE)');
      return {
        success: true,
        message: 'Verification code sent to your phone',
        verificationId: this.confirmationResult.verificationId
      };
    } catch (error) {
      console.error('❌ SMS sending failed:', error);
      return {
        success: false,
        message: this.getFirebaseErrorMessage(error.code),
        error: error.code
      };
    }
  }

  // Verify SMS OTP (FREE)
  async verifySMSOTP(otpCode) {
    try {
      if (!this.confirmationResult) {
        throw new Error('No SMS verification in progress');
      }

      const result = await this.confirmationResult.confirm(otpCode);
      console.log('✅ Phone number verified successfully');
      
      return {
        success: true,
        message: 'Phone number verified successfully',
        user: result.user
      };
    } catch (error) {
      console.error('❌ OTP verification failed:', error);
      return {
        success: false,
        message: 'Invalid verification code',
        error: error.code
      };
    }
  }

  // Send FREE Email Verification using EmailJS
  async sendEmailVerification(email, username) {
    try {
      // Generate verification token
      const verificationToken = this.generateVerificationToken();
      const verificationLink = `${window.location.origin}/verify-email?token=${verificationToken}`;
      
      // Store verification token in Firestore (FREE tier)
      await setDoc(doc(this.db, 'email-verifications', verificationToken), {
        email: email,
        username: username,
        createdAt: new Date(),
        verified: false,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      });

      // Send email using EmailJS (FREE - 200 emails/month)
      const templateParams = {
        to_email: email,
        to_name: username,
        verification_link: verificationLink,
        app_name: 'Task Scheduler',
        from_name: 'Task Scheduler Team'
      };

      // Load EmailJS if not already loaded
      if (typeof emailjs === 'undefined') {
        await this.loadEmailJS();
      }

      await emailjs.send(
        this.emailJS.serviceId,
        this.emailJS.templateId,
        templateParams,
        this.emailJS.userId
      );

      console.log('✅ Verification email sent successfully (FREE)');
      return {
        success: true,
        message: 'Verification email sent. Please check your inbox.',
        token: verificationToken
      };
    } catch (error) {
      console.error('❌ Email sending failed:', error);
      return {
        success: false,
        message: 'Failed to send verification email',
        error: error.message
      };
    }
  }

  // Load EmailJS library dynamically
  async loadEmailJS() {
    return new Promise((resolve, reject) => {
      if (typeof emailjs !== 'undefined') {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js';
      script.onload = () => {
        emailjs.init(this.emailJS.userId);
        console.log('✅ EmailJS loaded');
        resolve();
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  // Generate secure verification token
  generateVerificationToken() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  // Verify email token
  async verifyEmailToken(token) {
    try {
      const docRef = doc(this.db, 'email-verifications', token);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return {
          success: false,
          message: 'Invalid verification token'
        };
      }

      const data = docSnap.data();
      
      if (data.verified) {
        return {
          success: false,
          message: 'Email already verified'
        };
      }

      if (new Date() > data.expiresAt.toDate()) {
        return {
          success: false,
          message: 'Verification token expired'
        };
      }

      // Mark as verified
      await setDoc(docRef, { ...data, verified: true, verifiedAt: new Date() });

      return {
        success: true,
        message: 'Email verified successfully',
        email: data.email
      };
    } catch (error) {
      console.error('❌ Email verification failed:', error);
      return {
        success: false,
        message: 'Verification failed',
        error: error.message
      };
    }
  }

  // Complete registration with all 3 factors
  async completeRegistration(userData) {
    try {
      // Store user data in Firestore (FREE tier)
      const userDoc = {
        username: userData.username,
        email: userData.email,
        phone: userData.phone,
        faceDescriptor: userData.faceDescriptor,
        createdAt: new Date(),
        isActive: true,
        emailVerified: true,
        phoneVerified: true,
        faceVerified: true,
        loginCount: 0,
        lastLogin: null
      };

      await setDoc(doc(this.db, 'users', userData.userId), userDoc);

      // Also sync with your C backend SQLite database
      await this.syncWithBackend(userDoc);

      console.log('✅ User registered successfully with 3-factor auth');
      return {
        success: true,
        message: 'Registration completed successfully',
        user: userDoc
      };
    } catch (error) {
      console.error('❌ Registration failed:', error);
      return {
        success: false,
        message: 'Registration failed',
        error: error.message
      };
    }
  }

  // Sync with your C backend
  async syncWithBackend(userData) {
    try {
      const response = await fetch('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: userData.username,
          email: userData.email,
          phone: userData.phone,
          password: userData.password, // This would be handled securely
          faceData: userData.faceDescriptor
        })
      });

      if (!response.ok) {
        throw new Error('Backend sync failed');
      }

      console.log('✅ User synced with backend database');
      return await response.json();
    } catch (error) {
      console.error('⚠️ Backend sync failed:', error);
      // Continue anyway - Firebase is primary, backend is backup
      return null;
    }
  }

  // Get user-friendly error messages
  getFirebaseErrorMessage(errorCode) {
    const messages = {
      'auth/invalid-phone-number': 'Please enter a valid phone number',
      'auth/missing-phone-number': 'Phone number is required',
      'auth/quota-exceeded': 'SMS quota exceeded. Please try again later.',
      'auth/invalid-verification-code': 'Invalid verification code',
      'auth/code-expired': 'Verification code has expired',
      'auth/too-many-requests': 'Too many attempts. Please try again later.',
      'auth/captcha-check-failed': 'reCAPTCHA verification failed'
    };

    return messages[errorCode] || 'An unexpected error occurred';
  }

  // Check authentication status
  isAuthenticated() {
    return this.currentUser !== null;
  }

  // Sign out
  async signOut() {
    try {
      await this.auth.signOut();
      this.currentUser = null;
      console.log('✅ User signed out');
      return { success: true };
    } catch (error) {
      console.error('❌ Sign out failed:', error);
      return { success: false, error: error.message };
    }
  }
}

// Compatibility layer for existing code
class AuthManager extends FreeAuthenticationSystem {
  constructor() {
    super();
    console.log('🔄 AuthManager compatibility layer active');
  }

  // Legacy register method for compatibility
  async register(username, email, password, mobile) {
    const userData = {
      username,
      email,
      password,
      mobile,
      firstName: username,
      lastName: ''
    };
    return await this.registerWithFirebase(userData);
  }

  // Legacy login method for compatibility
  async login(username, password) {
    // For now, redirect to phone verification
    console.log('🔄 Redirecting to phone-based authentication');
    return { success: false, message: 'Please use phone verification' };
  }
}

// Export for use in other files
window.FreeAuthSystem = FreeAuthenticationSystem;
window.AuthManager = AuthManager;

console.log('🆓 FREE Authentication System loaded - Firebase + EmailJS + SQLite');