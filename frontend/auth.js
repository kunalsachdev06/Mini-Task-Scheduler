// Production Authentication System with Backend API Integration
// Supports 3-Factor Authentication + WebAuthn Passkeys

class ProductionAuthSystem {
  constructor() {
    this.apiBaseUrl = 'http://localhost:3000/api'; // Backend server URL
    this.currentUser = null;
    this.accessToken = localStorage.getItem('accessToken');
    this.refreshToken = localStorage.getItem('refreshToken');
    this.passkeySupported = this.checkPasskeySupport();
    
    // Initialize authentication state
    this.initializeAuth();
  }

  // Check if WebAuthn is supported
  checkPasskeySupport() {
    return window.PublicKeyCredential !== undefined && 
           typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function';
  }

  // Initialize authentication state
  async initializeAuth() {
    if (this.accessToken) {
      try {
        await this.validateToken();
      } catch (error) {
        console.log('Token validation failed, attempting refresh...');
        await this.refreshAccessToken();
      }
    }
  }

  // Validate current access token
  async validateToken() {
    const response = await this.apiCall('/user/profile', 'GET');
    if (response.success) {
      this.currentUser = response.data;
      return true;
    }
    throw new Error('Invalid token');
  }

  // Refresh access token using refresh token
  async refreshAccessToken() {
    if (!this.refreshToken) {
      this.clearTokens();
      return false;
    }

    try {
      const response = await fetch(`${this.apiBaseUrl}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          refreshToken: this.refreshToken
        })
      });

      const data = await response.json();

      if (data.success) {
        this.accessToken = data.data.accessToken;
        this.currentUser = data.data.user;
        localStorage.setItem('accessToken', this.accessToken);
        return true;
      } else {
        this.clearTokens();
        return false;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      this.clearTokens();
      return false;
    }
  }

  // Generic API call method with token handling
  async apiCall(endpoint, method = 'GET', data = null) {
    const headers = {
      'Content-Type': 'application/json'
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const config = {
      method,
      headers,
      credentials: 'include'
    };

    if (data && method !== 'GET') {
      config.body = JSON.stringify(data);
    }

    let response = await fetch(`${this.apiBaseUrl}${endpoint}`, config);

    // If unauthorized, try to refresh token
    if (response.status === 401 && this.refreshToken) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
        response = await fetch(`${this.apiBaseUrl}${endpoint}`, config);
      }
    }

    return await response.json();
  }

  // User Registration
  async registerUser(userData) {
    try {
      const response = await this.apiCall('/auth/register', 'POST', userData);
      
      if (response.success) {
        return {
          success: true,
          message: response.message,
          requiresEmailVerification: response.data.requiresEmailVerification
        };
      } else {
        throw new Error(response.error || 'Registration failed');
      }
    } catch (error) {
      throw new Error(error.message || 'Registration failed');
    }
  }

  // Email Verification
  async verifyEmail(token) {
    try {
      const response = await this.apiCall('/auth/verify-email', 'POST', { token });
      
      if (response.success) {
        return { success: true, message: response.message };
      } else {
        throw new Error(response.error || 'Email verification failed');
      }
    } catch (error) {
      throw new Error(error.message || 'Email verification failed');
    }
  }

  // 3-Factor Authentication Flow

  // Step 1: Username & Password
  async loginStep1(username, password) {
    try {
      const response = await this.apiCall('/auth/login/step1', 'POST', {
        username,
        password
      });

      if (response.success) {
        return {
          success: true,
          message: response.message,
          nextStep: response.nextStep,
          data: response.data
        };
      } else {
        throw new Error(response.error || 'Login failed');
      }
    } catch (error) {
      throw new Error(error.message || 'Login failed');
    }
  }

  // Step 2: OTP Verification
  async loginStep2(otp) {
    try {
      const response = await this.apiCall('/auth/login/step2', 'POST', { otp });

      if (response.success) {
        return {
          success: true,
          message: response.message,
          nextStep: response.nextStep
        };
      } else {
        throw new Error(response.error || 'OTP verification failed');
      }
    } catch (error) {
      throw new Error(error.message || 'OTP verification failed');
    }
  }

  // Step 3: Face Recognition
  async loginStep3(faceData) {
    try {
      const response = await this.apiCall('/auth/login/step3', 'POST', { faceData });

      if (response.success) {
        // Store tokens
        this.accessToken = response.data.tokens.accessToken;
        this.refreshToken = response.data.tokens.refreshToken;
        this.currentUser = response.data.user;

        localStorage.setItem('accessToken', this.accessToken);
        localStorage.setItem('refreshToken', this.refreshToken);

        return {
          success: true,
          message: response.message,
          user: response.data.user,
          redirectTo: 'dashboard-enhanced.html'
        };
      } else {
        throw new Error(response.error || 'Face verification failed');
      }
    } catch (error) {
      throw new Error(error.message || 'Face verification failed');
    }
  }

  // Resend OTP
  async resendOTP() {
    try {
      const response = await this.apiCall('/auth/resend-otp', 'POST');
      
      if (response.success) {
        return { success: true, message: response.message };
      } else {
        throw new Error(response.error || 'Failed to resend OTP');
      }
    } catch (error) {
      throw new Error(error.message || 'Failed to resend OTP');
    }
  }

  // WebAuthn Passkey Authentication

  // Check if user can use passkey
  async canUsePasskey(username) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/auth/user/passkey-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });

      const data = await response.json();
      return data.hasPasskey;
    } catch (error) {
      return false;
    }
  }

  // Start passkey authentication
  async startPasskeyAuth(username) {
    try {
      if (!this.passkeySupported) {
        throw new Error('Passkeys not supported on this device');
      }

      const response = await this.apiCall('/passkey/login/begin', 'POST', { username });
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to start passkey authentication');
      }

      // Create credential request
      const credential = await navigator.credentials.get({
        publicKey: response.options
      });

      // Complete authentication
      const completeResponse = await this.apiCall('/passkey/login/complete', 'POST', {
        credential: {
          id: credential.id,
          rawId: Array.from(new Uint8Array(credential.rawId)),
          response: {
            authenticatorData: Array.from(new Uint8Array(credential.response.authenticatorData)),
            clientDataJSON: Array.from(new Uint8Array(credential.response.clientDataJSON)),
            signature: Array.from(new Uint8Array(credential.response.signature)),
            userHandle: credential.response.userHandle ? Array.from(new Uint8Array(credential.response.userHandle)) : null
          },
          type: credential.type
        }
      });

      if (completeResponse.success) {
        // Store tokens
        this.accessToken = completeResponse.data.tokens.accessToken;
        this.refreshToken = completeResponse.data.tokens.refreshToken;
        this.currentUser = completeResponse.data.user;

        localStorage.setItem('accessToken', this.accessToken);
        localStorage.setItem('refreshToken', this.refreshToken);

        return {
          success: true,
          message: 'Passkey authentication successful!',
          user: completeResponse.data.user,
          authMethod: 'passkey',
          redirectTo: 'dashboard-enhanced.html'
        };
      } else {
        throw new Error(completeResponse.error || 'Passkey authentication failed');
      }

    } catch (error) {
      throw new Error(error.message || 'Passkey authentication failed');
    }
  }

  // Register a new passkey
  async registerPasskey(name = '') {
    try {
      if (!this.passkeySupported) {
        throw new Error('Passkeys not supported on this device');
      }

      if (!this.isLoggedIn()) {
        throw new Error('You must be logged in to register a passkey');
      }

      const response = await this.apiCall('/passkey/register/begin', 'POST');
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to start passkey registration');
      }

      // Create credential
      const credential = await navigator.credentials.create({
        publicKey: response.options
      });

      // Complete registration
      const completeResponse = await this.apiCall('/passkey/register/complete', 'POST', {
        credential: {
          id: credential.id,
          rawId: Array.from(new Uint8Array(credential.rawId)),
          response: {
            attestationObject: Array.from(new Uint8Array(credential.response.attestationObject)),
            clientDataJSON: Array.from(new Uint8Array(credential.response.clientDataJSON))
          },
          type: credential.type
        },
        name
      });

      if (completeResponse.success) {
        return {
          success: true,
          message: completeResponse.message,
          canSkip3FA: true
        };
      } else {
        throw new Error(completeResponse.error || 'Passkey registration failed');
      }

    } catch (error) {
      throw new Error(error.message || 'Passkey registration failed');
    }
  }

  // Get user's passkeys
  async getUserPasskeys() {
    try {
      const response = await this.apiCall('/passkey/list', 'GET');
      
      if (response.success) {
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to retrieve passkeys');
      }
    } catch (error) {
      throw new Error(error.message || 'Failed to retrieve passkeys');
    }
  }

  // Remove a passkey
  async removePasskey(passkeyId) {
    try {
      const response = await this.apiCall(`/passkey/${passkeyId}`, 'DELETE');
      
      if (response.success) {
        return { success: true, message: response.message };
      } else {
        throw new Error(response.error || 'Failed to remove passkey');
      }
    } catch (error) {
      throw new Error(error.message || 'Failed to remove passkey');
    }
  }

  // Logout
  async logout() {
    try {
      await this.apiCall('/auth/logout', 'POST', {
        refreshToken: this.refreshToken
      });
    } catch (error) {
      console.error('Logout API call failed:', error);
    } finally {
      this.clearTokens();
      this.currentUser = null;
      window.location.href = 'index.html';
    }
  }

  // Helper methods
  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  isLoggedIn() {
    return this.accessToken && this.currentUser;
  }

  getCurrentUser() {
    return this.currentUser;
  }

  hasPasskeySupport() {
    return this.passkeySupported;
  }

  // Password strength validation
  isStrongPassword(password) {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[@$!%*?&]/.test(password);

    return password.length >= minLength && hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar;
  }

  // Get password strength score
  getPasswordStrength(password) {
    let score = 0;
    let feedback = [];

    if (password.length >= 8) score += 1;
    else feedback.push('At least 8 characters');

    if (/[A-Z]/.test(password)) score += 1;
    else feedback.push('One uppercase letter');

    if (/[a-z]/.test(password)) score += 1;
    else feedback.push('One lowercase letter');

    if (/\d/.test(password)) score += 1;
    else feedback.push('One number');

    if (/[@$!%*?&]/.test(password)) score += 1;
    else feedback.push('One special character');

    const strength = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'][score];
    const color = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#16a34a'][score];

    return {
      score,
      strength,
      color,
      feedback,
      isValid: score === 5
    };
  }
}

// Initialize the production auth system
const authSystem = new ProductionAuthSystem();

// Global logout function
function logout() {
  authSystem.logout();
}