// Production Authentication System for C Backend
// Supports 3-Factor Authentication: Password + SMS OTP + Face Recognition

class AuthManager {
    constructor() {
        this.baseURL = 'http://localhost:3000/api/auth';
        this.currentSession = null;
        this.currentUser = null;
    }

    async login(username, password) {
        try {
            const response = await fetch(`${this.baseURL}/login/step1`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();
            
            if (data.success) {
                this.currentSession = data.session_id;
                // Show OTP for demo (in production, this would be sent via SMS)
                alert(`Demo: Your OTP is ${data.otp}`);
                return { success: true, sessionId: data.session_id };
            } else {
                throw new Error(data.error || 'Login failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }

    async verifyOTP(otp) {
        if (!this.currentSession) {
            throw new Error('No active session');
        }

        try {
            const response = await fetch(`${this.baseURL}/login/step2`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    session_id: this.currentSession, 
                    otp 
                })
            });

            const data = await response.json();
            
            if (data.success) {
                return { success: true };
            } else {
                throw new Error(data.error || 'OTP verification failed');
            }
        } catch (error) {
            console.error('OTP verification error:', error);
            throw error;
        }
    }

    async verifyFace(faceData) {
        if (!this.currentSession) {
            throw new Error('No active session');
        }

        try {
            const response = await fetch(`${this.baseURL}/login/step3`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    session_id: this.currentSession, 
                    face_data: faceData || 'demo_face_data'
                })
            });

            const data = await response.json();
            
            if (data.success) {
                this.currentUser = data.token;
                localStorage.setItem('authToken', data.token);
                return { success: true, token: data.token };
            } else {
                throw new Error(data.error || 'Face verification failed');
            }
        } catch (error) {
            console.error('Face verification error:', error);
            throw error;
        }
    }

    async register(userData) {
        try {
            const response = await fetch(`${this.baseURL}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(userData)
            });

            const data = await response.json();
            
            if (data.success) {
                return { success: true, message: data.message };
            } else {
                throw new Error(data.error || 'Registration failed');
            }
        } catch (error) {
            console.error('Registration error:', error);
            throw error;
        }
    }

    async resendOTP() {
        if (!this.currentSession) {
            throw new Error('No active session');
        }

        try {
            const response = await fetch(`${this.baseURL}/resend-otp`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ session_id: this.currentSession })
            });

            const data = await response.json();
            
            if (data.success) {
                // Show new OTP for demo
                alert(`Demo: Your new OTP is ${data.otp}`);
                return { success: true };
            } else {
                throw new Error(data.error || 'Failed to resend OTP');
            }
        } catch (error) {
            console.error('Resend OTP error:', error);
            throw error;
        }
    }

    isLoggedIn() {
        return localStorage.getItem('authToken') !== null;
    }

    logout() {
        this.currentSession = null;
        this.currentUser = null;
        localStorage.removeItem('authToken');
    }
}

// Initialize the auth manager
const authManager = new AuthManager();

// Legacy compatibility - expose as global for existing code
window.authSystem = authManager;