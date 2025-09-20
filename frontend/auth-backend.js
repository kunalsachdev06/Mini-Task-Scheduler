// Authentication Manager for Registration System// Authentication Manager for Registration System// Production Authentication System for C Backend

// Compatible with existing Task Scheduler backend

// Compatible with existing Task Scheduler backend// Supports 3-Factor Authentication: Password + SMS OTP + Face Recognition

class AuthManager {

  constructor() {

    // Use the same API configuration as the main app

    if (typeof APIConfig !== 'undefined') {class AuthManager {class AuthManager {

      const apiConfig = new APIConfig();

      this.apiBaseUrl = apiConfig.apiBaseUrl;  constructor() {    constructor() {

    } else {

      // Fallback configuration    // Use the same API configuration as the main app        this.baseURL = 'http://localhost:3000/api/auth';

      this.isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

      this.apiBaseUrl = this.isDevelopment     if (typeof APIConfig !== 'undefined') {        this.currentSession = null;

        ? 'http://localhost:3000/api'

        : 'https://task-scheduler-backend-production-c243.up.railway.app/api';      const apiConfig = new APIConfig();        this.currentUser = null;

    }

          this.apiBaseUrl = apiConfig.apiBaseUrl;    }

    this.currentUser = null;

    this.accessToken = localStorage.getItem('accessToken');    } else {

    this.refreshToken = localStorage.getItem('refreshToken');

          // Fallback configuration    async login(username, password) {

    console.log('🔐 AuthManager initialized with API:', this.apiBaseUrl);

  }      this.isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';        try {



  // Generic API call method      this.apiBaseUrl = this.isDevelopment             const response = await fetch(`${this.baseURL}/login/step1`, {

  async apiCall(endpoint, method = 'GET', data = null) {

    const config = {        ? 'http://localhost:3000/api'                method: 'POST',

      method,

      headers: {        : 'https://task-scheduler-backend-production-c243.up.railway.app/api';                headers: {

        'Content-Type': 'application/json',

      },    }                    'Content-Type': 'application/json',

    };

                    },

    if (this.accessToken) {

      config.headers['Authorization'] = `Bearer ${this.accessToken}`;    this.currentUser = null;                body: JSON.stringify({ username, password })

    }

    this.accessToken = localStorage.getItem('accessToken');            });

    if (data) {

      config.body = JSON.stringify(data);    this.refreshToken = localStorage.getItem('refreshToken');

    }

                const data = await response.json();

    try {

      const response = await fetch(`${this.apiBaseUrl}${endpoint}`, config);    console.log('🔐 AuthManager initialized with API:', this.apiBaseUrl);            

      const result = await response.json();

        }            if (data.success) {

      if (!response.ok) {

        throw new Error(result.message || 'API call failed');                this.currentSession = data.session_id;

      }

        // Generic API call method                // Show OTP for demo (in production, this would be sent via SMS)

      return result;

    } catch (error) {  async apiCall(endpoint, method = 'GET', data = null) {                alert(`Demo: Your OTP is ${data.otp}`);

      console.error('API call failed:', error);

      throw error;    const config = {                return { success: true, sessionId: data.session_id };

    }

  }      method,            } else {



  // Register new user      headers: {                throw new Error(data.error || 'Login failed');

  async register(userData) {

    try {        'Content-Type': 'application/json',            }

      console.log('📝 Attempting user registration...');

      const response = await this.apiCall('/auth/register', 'POST', userData);      },        } catch (error) {

      

      if (response.success) {    };            console.error('Login error:', error);

        console.log('✅ Registration successful');

        return { success: true, data: response.data };            throw error;

      } else {

        throw new Error(response.message || 'Registration failed');    if (this.accessToken) {        }

      }

    } catch (error) {      config.headers['Authorization'] = `Bearer ${this.accessToken}`;    }

      console.error('❌ Registration failed:', error);

      return { success: false, error: error.message };    }

    }

  }    async verifyOTP(otp) {



  // Send OTP for mobile verification    if (data) {        if (!this.currentSession) {

  async sendOTP(mobile) {

    try {      config.body = JSON.stringify(data);            throw new Error('No active session');

      console.log('📱 Sending OTP to:', mobile);

          }        }

      // For demo purposes, generate a random OTP

      const demoOTP = Math.floor(100000 + Math.random() * 900000).toString();

      

      // In a real app, this would call your backend API    try {        try {

      // const response = await this.apiCall('/auth/send-otp', 'POST', { mobile });

            const response = await fetch(`${this.apiBaseUrl}${endpoint}`, config);            const response = await fetch(`${this.baseURL}/login/step2`, {

      // For demo, store the OTP in localStorage temporarily

      localStorage.setItem('demoOTP', demoOTP);      const result = await response.json();                method: 'POST',

      localStorage.setItem('demoOTPMobile', mobile);

                            headers: {

      console.log('📱 Demo OTP generated:', demoOTP);

            if (!response.ok) {                    'Content-Type': 'application/json',

      return { 

        success: true,         throw new Error(result.message || 'API call failed');                },

        message: `OTP sent to ${mobile}`, 

        demoOTP: demoOTP // In production, remove this!      }                body: JSON.stringify({ 

      };

    } catch (error) {                          session_id: this.currentSession, 

      console.error('❌ OTP sending failed:', error);

      return { success: false, error: error.message };      return result;                    otp 

    }

  }    } catch (error) {                })



  // Verify OTP      console.error('API call failed:', error);            });

  async verifyOTP(otp, mobile) {

    try {      throw error;

      console.log('🔐 Verifying OTP...');

          }            const data = await response.json();

      // Demo verification

      const storedOTP = localStorage.getItem('demoOTP');  }            

      const storedMobile = localStorage.getItem('demoOTPMobile');

                  if (data.success) {

      if (otp === storedOTP && mobile === storedMobile) {

        console.log('✅ OTP verified successfully');  // Register new user                return { success: true };

        

        // Clean up demo OTP  async register(userData) {            } else {

        localStorage.removeItem('demoOTP');

        localStorage.removeItem('demoOTPMobile');    try {                throw new Error(data.error || 'OTP verification failed');

        

        return { success: true, message: 'OTP verified successfully' };      console.log('📝 Attempting user registration...');            }

      } else {

        throw new Error('Invalid OTP');      const response = await this.apiCall('/auth/register', 'POST', userData);        } catch (error) {

      }

    } catch (error) {                  console.error('OTP verification error:', error);

      console.error('❌ OTP verification failed:', error);

      return { success: false, error: error.message };      if (response.success) {            throw error;

    }

  }        console.log('✅ Registration successful');        }



  // Process face recognition data        return { success: true, data: response.data };    }

  async processFaceData(faceImageData) {

    try {      } else {

      console.log('📷 Processing face recognition data...');

              throw new Error(response.message || 'Registration failed');    async verifyFace(faceData) {

      // In a real app, this would process the face data with your backend

      // For demo purposes, we'll just validate that we have image data      }        if (!this.currentSession) {

      if (!faceImageData || faceImageData.length < 1000) {

        throw new Error('Invalid face image data');    } catch (error) {            throw new Error('No active session');

      }

            console.error('❌ Registration failed:', error);        }

      console.log('✅ Face data processed successfully');

      return {       return { success: false, error: error.message };

        success: true, 

        message: 'Face recognition data processed',    }        try {

        faceId: 'demo_face_' + Date.now()

      };  }            const response = await fetch(`${this.baseURL}/login/step3`, {

    } catch (error) {

      console.error('❌ Face processing failed:', error);                method: 'POST',

      return { success: false, error: error.message };

    }  // Send OTP for mobile verification                headers: {

  }

  async sendOTP(mobile) {                    'Content-Type': 'application/json',

  // Complete registration with all steps

  async completeRegistration(registrationData) {    try {                },

    try {

      console.log('🎯 Completing full registration...');      console.log('📱 Sending OTP to:', mobile);                body: JSON.stringify({ 

      

      // Validate all required data                          session_id: this.currentSession, 

      const required = ['firstName', 'lastName', 'username', 'email', 'mobile', 'password'];

      for (const field of required) {      // For demo purposes, generate a random OTP                    face_data: faceData || 'demo_face_data'

        if (!registrationData[field]) {

          throw new Error(`Missing required field: ${field}`);      const demoOTP = Math.floor(100000 + Math.random() * 900000).toString();                })

        }

      }                  });

      

      // In production, this would create the actual user account      // In a real app, this would call your backend API

      console.log('✅ Registration completed successfully');

            // const response = await this.apiCall('/auth/send-otp', 'POST', { mobile });            const data = await response.json();

      return {

        success: true,                  

        message: 'Registration completed successfully! You can now log in.',

        user: {      // For demo, store the OTP in localStorage temporarily            if (data.success) {

          id: 'demo_user_' + Date.now(),

          username: registrationData.username,      localStorage.setItem('demoOTP', demoOTP);                this.currentUser = data.token;

          email: registrationData.email,

          mobile: registrationData.mobile      localStorage.setItem('demoOTPMobile', mobile);                localStorage.setItem('authToken', data.token);

        }

      };                      return { success: true, token: data.token };

    } catch (error) {

      console.error('❌ Registration completion failed:', error);      console.log('📱 Demo OTP generated:', demoOTP);            } else {

      return { success: false, error: error.message };

    }                      throw new Error(data.error || 'Face verification failed');

  }

      return {             }

  // Login user

  async login(credentials) {        success: true,         } catch (error) {

    try {

      console.log('🔑 Attempting login...');        message: `OTP sent to ${mobile}`,             console.error('Face verification error:', error);

      const response = await this.apiCall('/auth/login', 'POST', credentials);

              demoOTP: demoOTP // In production, remove this!            throw error;

      if (response.success) {

        this.accessToken = response.data.accessToken;      };        }

        this.refreshToken = response.data.refreshToken;

        this.currentUser = response.data.user;    } catch (error) {    }

        

        // Store tokens      console.error('❌ OTP sending failed:', error);

        localStorage.setItem('accessToken', this.accessToken);

        localStorage.setItem('refreshToken', this.refreshToken);      return { success: false, error: error.message };    async register(userData) {

        

        console.log('✅ Login successful');    }        try {

        return { success: true, user: this.currentUser };

      } else {  }            console.log('🔄 Attempting registration to:', `${this.baseURL}/register`);

        throw new Error(response.message || 'Login failed');

      }            

    } catch (error) {

      console.error('❌ Login failed:', error);  // Verify OTP            const response = await fetch(`${this.baseURL}/register`, {

      return { success: false, error: error.message };

    }  async verifyOTP(otp, mobile) {                method: 'POST',

  }

    try {                headers: {

  // Logout user

  logout() {      console.log('🔐 Verifying OTP...');                    'Content-Type': 'application/json',

    this.accessToken = null;

    this.refreshToken = null;                      },

    this.currentUser = null;

          // Demo verification                body: JSON.stringify(userData)

    localStorage.removeItem('accessToken');

    localStorage.removeItem('refreshToken');      const storedOTP = localStorage.getItem('demoOTP');            });

    localStorage.removeItem('demoOTP');

    localStorage.removeItem('demoOTPMobile');      const storedMobile = localStorage.getItem('demoOTPMobile');

    

    console.log('👋 User logged out');                  if (!response.ok) {

  }

      if (otp === storedOTP && mobile === storedMobile) {                throw new Error(`HTTP ${response.status}: ${response.statusText}`);

  // Check if user is authenticated

  isAuthenticated() {        console.log('✅ OTP verified successfully');            }

    return !!this.accessToken && !!this.currentUser;

  }        



  // Get current user        // Clean up demo OTP            const data = await response.json();

  getCurrentUser() {

    return this.currentUser;        localStorage.removeItem('demoOTP');            

  }

}        localStorage.removeItem('demoOTPMobile');            if (data.success) {



// Export for use in registration system                        console.log('✅ Registration successful:', data.message);

window.AuthManager = AuthManager;

        return { success: true, message: 'OTP verified successfully' };                return { success: true, message: data.message };

console.log('🔐 Auth Backend loaded successfully');
      } else {            } else {

        throw new Error('Invalid OTP');                throw new Error(data.error || 'Registration failed');

      }            }

    } catch (error) {        } catch (error) {

      console.error('❌ OTP verification failed:', error);            console.error('Registration error:', error);

      return { success: false, error: error.message };            

    }            // Enhanced error handling

  }            if (error.name === 'TypeError' && error.message.includes('fetch')) {

                throw new Error('Failed to fetch - Backend server not available');

  // Process face recognition data            } else if (error.message.includes('NetworkError')) {

  async processFaceData(faceImageData) {                throw new Error('Network error - Please check your connection');

    try {            } else {

      console.log('📷 Processing face recognition data...');                throw error;

                  }

      // In a real app, this would process the face data with your backend        }

      // For demo purposes, we'll just validate that we have image data    }

      if (!faceImageData || faceImageData.length < 1000) {

        throw new Error('Invalid face image data');    async resendOTP() {

      }        if (!this.currentSession) {

                  throw new Error('No active session');

      console.log('✅ Face data processed successfully');        }

      return { 

        success: true,         try {

        message: 'Face recognition data processed',            const response = await fetch(`${this.baseURL}/resend-otp`, {

        faceId: 'demo_face_' + Date.now()                method: 'POST',

      };                headers: {

    } catch (error) {                    'Content-Type': 'application/json',

      console.error('❌ Face processing failed:', error);                },

      return { success: false, error: error.message };                body: JSON.stringify({ session_id: this.currentSession })

    }            });

  }

            const data = await response.json();

  // Complete registration with all steps            

  async completeRegistration(registrationData) {            if (data.success) {

    try {                // Show new OTP for demo

      console.log('🎯 Completing full registration...');                alert(`Demo: Your new OTP is ${data.otp}`);

                      return { success: true };

      // Validate all required data            } else {

      const required = ['firstName', 'lastName', 'username', 'email', 'mobile', 'password'];                throw new Error(data.error || 'Failed to resend OTP');

      for (const field of required) {            }

        if (!registrationData[field]) {        } catch (error) {

          throw new Error(`Missing required field: ${field}`);            console.error('Resend OTP error:', error);

        }            throw error;

      }        }

          }

      // In production, this would create the actual user account

      console.log('✅ Registration completed successfully');    isLoggedIn() {

              return localStorage.getItem('authToken') !== null;

      return {    }

        success: true,

        message: 'Registration completed successfully! You can now log in.',    logout() {

        user: {        this.currentSession = null;

          id: 'demo_user_' + Date.now(),        this.currentUser = null;

          username: registrationData.username,        localStorage.removeItem('authToken');

          email: registrationData.email,    }

          mobile: registrationData.mobile}

        }

      };// Initialize the auth manager

    } catch (error) {const authManager = new AuthManager();

      console.error('❌ Registration completion failed:', error);

      return { success: false, error: error.message };// Legacy compatibility - expose as global for existing code

    }window.authSystem = authManager;
  }

  // Login user
  async login(credentials) {
    try {
      console.log('🔑 Attempting login...');
      const response = await this.apiCall('/auth/login', 'POST', credentials);
      
      if (response.success) {
        this.accessToken = response.data.accessToken;
        this.refreshToken = response.data.refreshToken;
        this.currentUser = response.data.user;
        
        // Store tokens
        localStorage.setItem('accessToken', this.accessToken);
        localStorage.setItem('refreshToken', this.refreshToken);
        
        console.log('✅ Login successful');
        return { success: true, user: this.currentUser };
      } else {
        throw new Error(response.message || 'Login failed');
      }
    } catch (error) {
      console.error('❌ Login failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Logout user
  logout() {
    this.accessToken = null;
    this.refreshToken = null;
    this.currentUser = null;
    
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('demoOTP');
    localStorage.removeItem('demoOTPMobile');
    
    console.log('👋 User logged out');
  }

  // Check if user is authenticated
  isAuthenticated() {
    return !!this.accessToken && !!this.currentUser;
  }

  // Get current user
  getCurrentUser() {
    return this.currentUser;
  }
}

// Export for use in registration system
window.AuthManager = AuthManager;

console.log('🔐 Auth Backend loaded successfully');