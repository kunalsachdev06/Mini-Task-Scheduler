// API        // Set API base URL
        if (this.isDevelopment) {
            // Local development - use localhost backend
            this.apiBaseUrl = 'http://localhost:3001/api';
            this.dataBaseUrl = 'http://localhost:3001/api/data';
        } else {
            // Production - route through Netlify proxy to Railway backend
            // This avoids CORS issues and uses the deployed Railway backend
            this.apiBaseUrl = '/api';
            this.dataBaseUrl = '/api/data';
        }ation for Production/Development
class APIConfig {
    constructor() {
        // Automatically detect if we're in development or production
        this.isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        
        // Set API base URL
        if (this.isDevelopment) {
            this.apiBaseUrl = 'http://localhost:3001/api';
            this.dataBaseUrl = 'http://localhost:3001/api/data';
        } else {
            // Production - route through Netlify proxy to avoid CORS
            this.apiBaseUrl = '/api';
            this.dataBaseUrl = '/api/data';
        }
        
        console.log(`🔧 API Config: ${this.isDevelopment ? 'Development' : 'Production'} mode`);
        console.log(`📡 API Base URL: ${this.apiBaseUrl}`);
    }

    // Get full API endpoint URL
    getEndpoint(path) {
        return `${this.apiBaseUrl}${path}`;
    }

    // Get full data endpoint URL
    getDataEndpoint(path) {
        return `${this.dataBaseUrl}${path}`;
    }

    // Get headers with authentication
    getHeaders(includeAuth = true) {
        const headers = {
            'Content-Type': 'application/json'
        };

        if (includeAuth) {
            const token = localStorage.getItem('authToken');
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
        }

        return headers;
    }

    // Make authenticated API request
    async makeRequest(endpoint, options = {}) {
        const url = endpoint.startsWith('/') ? this.getEndpoint(endpoint) : endpoint;
        
        const defaultOptions = {
            headers: this.getHeaders(options.includeAuth !== false),
            ...options
        };

        try {
            const response = await fetch(url, defaultOptions);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Request failed' }));
                throw new Error(errorData.message || `HTTP ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`API Request failed: ${url}`, error);
            throw error;
        }
    }

    // Specific API methods
    async getTasks() {
        return this.makeRequest('/tasks');
    }

    async createTask(taskData) {
        return this.makeRequest('/tasks', {
            method: 'POST',
            body: JSON.stringify(taskData)
        });
    }

    async updateTask(taskId, taskData) {
        return this.makeRequest(`/tasks/${taskId}`, {
            method: 'PUT',
            body: JSON.stringify(taskData)
        });
    }

    async deleteTask(taskId) {
        return this.makeRequest(`/tasks/${taskId}`, {
            method: 'DELETE'
        });
    }

    async login(credentials) {
        return this.makeRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify(credentials),
            includeAuth: false
        });
    }

    async register(userData) {
        return this.makeRequest('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData),
            includeAuth: false
        });
    }

    async getHealthCheck() {
        return this.makeRequest('/health', { includeAuth: false });
    }

    // C Backend data endpoints
    async getTasksData() {
        return fetch(this.getDataEndpoint('/tasks')).then(r => r.json());
    }

    async getHeatmapData() {
        return fetch(this.getDataEndpoint('/heatmap')).then(r => r.json());
    }

    async getNotificationsData() {
        return fetch(this.getDataEndpoint('/notifications')).then(r => r.json());
    }
}

// Create global API instance
window.api = new APIConfig();

// Backward compatibility - replace old fetch calls
window.apiRequest = (endpoint, options = {}) => {
    return window.api.makeRequest(endpoint, options);
};

console.log('✅ API Configuration loaded');