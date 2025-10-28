// Authentication Manager for Backend Integration
// Handles user registration, login, OTP verification

class AuthManager {
  constructor() {
    // Use API configuration if available
    if (typeof APIConfig !== 'undefined') {
      const apiConfig = new APIConfig();
      this.apiBaseUrl = apiConfig.apiBaseUrl;
    } else {
      // Fallback configuration
      this.isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      this.apiBaseUrl = this.isDevelopment 
        ? 'http://localhost:3000/api'
        : 'https://mini-task-scheduler.onrender.com/api';
    }

    this.currentUser = null;
    this.accessToken = localStorage.getItem('accessToken');
    this.refreshToken = localStorage.getItem('refreshToken');
    
    console.log('🔐 AuthManager initialized with API:', this.apiBaseUrl);
  }

  // Generic API call method
  async apiCall(endpoint, method = 'GET', data = null) {
    const config = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (this.accessToken) {
      config.headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    if (data && (method === 'POST' || method === 'PUT')) {
      config.body = JSON.stringify(data);
    }

    try {
      const url = `${this.apiBaseUrl}${endpoint}`;
      console.log(`📡 API Call: ${method} ${url}`);
      
      const response = await fetch(url, config);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'API request failed');
      }

      return result;
    } catch (error) {
      console.error('❌ API Error:', error);
      throw error;
    }
  }

  // User Registration
  async register(userData) {
    try {
      console.log('📝 Attempting user registration...');
      const response = await this.apiCall('/auth/register', 'POST', userData);

      if (response.success) {
        console.log('✅ Registration successful');
        return response;
      } else {
        throw new Error(response.message || 'Registration failed');
      }
    } catch (error) {
      console.error('❌ Registration error:', error);
      throw error;
    }
  }

  // Send OTP
  async sendOTP(mobile) {
    try {
      console.log('📱 Sending OTP to:', mobile);
      const response = await this.apiCall('/auth/send-otp', 'POST', { mobile });

      if (response.success) {
        console.log('✅ OTP sent successfully');
        return response;
      } else {
        throw new Error(response.message || 'Failed to send OTP');
      }
    } catch (error) {
      console.error('❌ Send OTP error:', error);
      throw error;
    }
  }

  // Verify OTP
  async verifyOTP(mobile, otp) {
    try {
      console.log('🔐 Verifying OTP...');
      const response = await this.apiCall('/auth/verify-otp', 'POST', { mobile, otp });

      if (response.success) {
        console.log('✅ OTP verified successfully');
        
        // Store tokens if provided
        if (response.accessToken) {
          this.accessToken = response.accessToken;
          localStorage.setItem('accessToken', response.accessToken);
        }
        if (response.refreshToken) {
          this.refreshToken = response.refreshToken;
          localStorage.setItem('refreshToken', response.refreshToken);
        }
        
        this.currentUser = response.user;
        return response;
      } else {
        throw new Error(response.message || 'OTP verification failed');
      }
    } catch (error) {
      console.error('❌ Verify OTP error:', error);
      throw error;
    }
  }

  // User Login
  async login(username, password) {
    try {
      console.log('🔑 Attempting login...');
      const response = await this.apiCall('/auth/login', 'POST', { username, password });

      if (response.success) {
        console.log('✅ Login successful');
        return response;
      } else {
        throw new Error(response.message || 'Login failed');
      }
    } catch (error) {
      console.error('❌ Login error:', error);
      throw error;
    }
  }

  // Logout
  async logout() {
    try {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('currentUser');
      
      this.accessToken = null;
      this.refreshToken = null;
      this.currentUser = null;
      
      console.log('✅ Logged out successfully');
      return { success: true };
    } catch (error) {
      console.error('❌ Logout error:', error);
      throw error;
    }
  }

  getCurrentUser() {
    return this.currentUser;
  }

  isAuthenticated() {
    return !!this.accessToken;
  }
}

window.AuthManager = AuthManager;
console.log('🔐 AuthManager loaded successfully');
