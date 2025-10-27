/**
 * Security Utilities for Frontend
 * Provides XSS protection and safe DOM manipulation
 */

class SecurityUtils {
  /**
   * Safely set text content (prevents XSS)
   * @param {HTMLElement} element - Target element
   * @param {string} text - Text to set
   */
  static setTextContent(element, text) {
    if (!element) return;
    element.textContent = text; // Auto-escapes HTML
  }

  /**
   * Safely create and append element with text
   * @param {string} tagName - HTML tag name
   * @param {string} text - Text content
   * @param {string} className - Optional CSS class
   * @returns {HTMLElement}
   */
  static createTextElement(tagName, text, className = '') {
    const element = document.createElement(tagName);
    element.textContent = text;
    if (className) element.className = className;
    return element;
  }

  /**
   * Sanitize HTML string (basic sanitization)
   * For production, use DOMPurify library
   * @param {string} html - HTML string to sanitize
   * @returns {string} Sanitized HTML
   */
  static sanitizeHTML(html) {
    if (typeof html !== 'string') return '';
    
    // Basic XSS protection - escape dangerous characters
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;',
    };
    
    return html.replace(/[&<>"'/]/g, (char) => map[char]);
  }

  /**
   * Safely set HTML content with sanitization
   * @param {HTMLElement} element - Target element
   * @param {string} html - HTML to set
   */
  static setHTML(element, html) {
    if (!element) return;
    element.innerHTML = this.sanitizeHTML(html);
  }

  /**
   * Create element with safe HTML content
   * @param {string} tagName - HTML tag name
   * @param {string} html - HTML content (will be sanitized)
   * @returns {HTMLElement}
   */
  static createHTMLElement(tagName, html) {
    const element = document.createElement(tagName);
    element.innerHTML = this.sanitizeHTML(html);
    return element;
  }

  /**
   * Validate and sanitize input value
   * @param {string} value - Input value
   * @param {Object} options - Validation options
   * @returns {string} Sanitized value
   */
  static sanitizeInput(value, options = {}) {
    if (typeof value !== 'string') return '';
    
    const {
      maxLength = 1000,
      allowHTML = false,
      trim = true
    } = options;
    
    let sanitized = trim ? value.trim() : value;
    
    if (!allowHTML) {
      sanitized = this.sanitizeHTML(sanitized);
    }
    
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }
    
    return sanitized;
  }

  /**
   * Encrypt data for localStorage (basic obfuscation)
   * For production, use proper encryption like crypto-js
   * @param {string} data - Data to encrypt
   * @returns {string} Encrypted data
   */
  static encryptData(data) {
    if (!data) return '';
    try {
      // Basic Base64 encoding (NOT secure encryption)
      // Replace with proper encryption in production
      return btoa(encodeURIComponent(JSON.stringify(data)));
    } catch (error) {
      console.error('Encryption failed:', error);
      return '';
    }
  }

  /**
   * Decrypt data from localStorage
   * @param {string} encryptedData - Encrypted data
   * @returns {any} Decrypted data
   */
  static decryptData(encryptedData) {
    if (!encryptedData) return null;
    try {
      return JSON.parse(decodeURIComponent(atob(encryptedData)));
    } catch (error) {
      console.error('Decryption failed:', error);
      return null;
    }
  }

  /**
   * Safely store data in localStorage with encryption
   * @param {string} key - Storage key
   * @param {any} value - Value to store
   */
  static setSecureItem(key, value) {
    try {
      const encrypted = this.encryptData(value);
      localStorage.setItem(key, encrypted);
    } catch (error) {
      console.error('Failed to store item:', error);
    }
  }

  /**
   * Safely retrieve data from localStorage with decryption
   * @param {string} key - Storage key
   * @returns {any} Decrypted value
   */
  static getSecureItem(key) {
    try {
      const encrypted = localStorage.getItem(key);
      return this.decryptData(encrypted);
    } catch (error) {
      console.error('Failed to retrieve item:', error);
      return null;
    }
  }

  /**
   * Validate URL to prevent XSS via javascript: protocol
   * @param {string} url - URL to validate
   * @returns {boolean} True if URL is safe
   */
  static isValidURL(url) {
    if (!url || typeof url !== 'string') return false;
    
    const dangerous = ['javascript:', 'data:', 'vbscript:', 'file:'];
    const lowerURL = url.toLowerCase().trim();
    
    return !dangerous.some(protocol => lowerURL.startsWith(protocol));
  }

  /**
   * Safely set href attribute
   * @param {HTMLElement} element - Link element
   * @param {string} url - URL to set
   */
  static setSafeHref(element, url) {
    if (!element || !this.isValidURL(url)) {
      console.warn('Invalid or dangerous URL blocked:', url);
      return;
    }
    element.href = url;
  }

  /**
   * Create safe link element
   * @param {string} url - URL
   * @param {string} text - Link text
   * @returns {HTMLAnchorElement}
   */
  static createSafeLink(url, text) {
    const link = document.createElement('a');
    this.setTextContent(link, text);
    this.setSafeHref(link, url);
    return link;
  }

  /**
   * Validate and sanitize time input (HH:MM format)
   * @param {string} time - Time string
   * @returns {string|null} Sanitized time or null if invalid
   */
  static validateTime(time) {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(time)) return null;
    return time;
  }

  /**
   * Validate and sanitize date input (YYYY-MM-DD format)
   * @param {string} date - Date string
   * @returns {string|null} Sanitized date or null if invalid
   */
  static validateDate(date) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) return null;
    
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) return null;
    
    return date;
  }

  /**
   * Generate CSRF token
   * @returns {string} CSRF token
   */
  static generateCSRFToken() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Set CSRF token in session
   */
  static setCSRFToken() {
    const token = this.generateCSRFToken();
    sessionStorage.setItem('csrf_token', token);
    return token;
  }

  /**
   * Get CSRF token from session
   * @returns {string|null} CSRF token
   */
  static getCSRFToken() {
    let token = sessionStorage.getItem('csrf_token');
    if (!token) {
      token = this.setCSRFToken();
    }
    return token;
  }

  /**
   * Add CSRF token to request headers
   * @param {Object} headers - Request headers
   * @returns {Object} Headers with CSRF token
   */
  static addCSRFHeader(headers = {}) {
    return {
      ...headers,
      'X-CSRF-Token': this.getCSRFToken()
    };
  }
}

// Make available globally
window.SecurityUtils = SecurityUtils;

console.log('🔒 Security utilities loaded');
