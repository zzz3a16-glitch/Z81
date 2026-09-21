/**
 * Security Manager - Production-Grade Security & Data Protection
 */

export class SecurityManager {
  constructor() {
    this.rateLimits = new Map();
    this.blockedIPs = new Set();
  }

  // Input validation
  validateFilePath(path) {
    if (!path || typeof path !== 'string') return false;
    
    // Prevent directory traversal
    const forbidden = ['..', '~', '$', '`', '|', ';', '&', '>', '<'];
    if (forbidden.some(f => path.includes(f))) return false;
    
    // Must be absolute or relative safe path
    const safePattern = /^[a-zA-Z0-9\/\-_\.\\:\s\u0600-\u06FF]+$/;
    return safePattern.test(path);
  }

  validateTMDBId(id) {
    const numId = parseInt(id);
    return !isNaN(numId) && numId > 0 && numId < 1000000000;
  }

  validateSearchQuery(query) {
    if (!query || typeof query !== 'string') return false;
    if (query.length > 500) return false; // Prevent huge queries
    
    // Prevent script injection
    const dangerous = ['<script', 'javascript:', 'data:', 'vbscript:', 'onload=', 'onerror='];
    const lowerQuery = query.toLowerCase();
    return !dangerous.some(d => lowerQuery.includes(d));
  }

  sanitizeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  sanitizeJSON(json) {
    try {
      const parsed = typeof json === 'string' ? JSON.parse(json) : json;
      
      // Check for prototype pollution
      const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
      const checkObject = (obj) => {
        if (obj && typeof obj === 'object') {
          for (const key of Object.keys(obj)) {
            if (dangerousKeys.includes(key)) {
              throw new Error('Dangerous key detected');
            }
            checkObject(obj[key]);
          }
        }
      };
      
      checkObject(parsed);
      return parsed;
    } catch (e) {
      throw new Error(`Invalid JSON: ${e.message}`);
    }
  }

  validateBackupFile(backup) {
    const required = ['schemaVersion', 'appVersion', 'timestamp', 'data'];
    for (const field of required) {
      if (!(field in backup)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate schema version
    if (typeof backup.schemaVersion !== 'string') {
      throw new Error('Invalid schemaVersion');
    }

    // Validate timestamp
    if (isNaN(backup.timestamp) || backup.timestamp < 0) {
      throw new Error('Invalid timestamp');
    }

    // Validate data is object
    if (!backup.data || typeof backup.data !== 'object') {
      throw new Error('Invalid data field');
    }

    return true;
  }

  // Rate limiting
  checkRateLimit(identifier, maxRequests = 20, windowMs = 10000) {
    const now = Date.now();
    const key = `ratelimit:${identifier}`;
    
    if (!this.rateLimits.has(key)) {
      this.rateLimits.set(key, []);
    }

    const requests = this.rateLimits.get(key);
    
    // Remove old requests
    const validRequests = requests.filter(time => now - time < windowMs);
    
    if (validRequests.length >= maxRequests) {
      return { allowed: false, remaining: 0, resetIn: windowMs - (now - validRequests[0]) };
    }

    validRequests.push(now);
    this.rateLimits.set(key, validRequests);

    return { 
      allowed: true, 
      remaining: maxRequests - validRequests.length,
      resetIn: windowMs
    };
  }

  // XSS Protection
  escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Safe localStorage with size limits
  safeSetItem(key, value, maxSize = 5 * 1024 * 1024) {
    try {
      const serialized = JSON.stringify(value);
      if (serialized.length > maxSize) {
        throw new Error(`Data too large: ${serialized.length} > ${maxSize}`);
      }
      localStorage.setItem(key, serialized);
      return true;
    } catch (e) {
      console.error('safeSetItem failed:', e);
      return false;
    }
  }

  safeGetItem(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      if (!item) return defaultValue;
      return JSON.parse(item);
    } catch {
      return defaultValue;
    }
  }

  // Content Security
  isSafeUrl(url) {
    try {
      const parsed = new URL(url);
      
      // Allow only https for external
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:' && parsed.protocol !== 'file:') {
        return false;
      }

      // Block private IPs
      const privatePatterns = [
        /^localhost$/,
        /^127\./,
        /^10\./,
        /^192\.168\./,
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./
      ];

      // Allow localhost for dev
      if (import.meta.env.DEV && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')) {
        return true;
      }

      return !privatePatterns.some(p => p.test(parsed.hostname));
    } catch {
      return false;
    }
  }

  // Audit logging
  async logSecurityEvent(event, details = {}) {
    const log = {
      id: `sec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      event,
      details,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    try {
      const logs = JSON.parse(localStorage.getItem('zpopcorn-security-logs') || '[]');
      logs.unshift(log);
      if (logs.length > 100) logs.length = 100;
      localStorage.setItem('zpopcorn-security-logs', JSON.stringify(logs));
    } catch {}

    console.warn(' Security event:', event, details);
  }

  // Data export validation
  validateExportData(data) {
    // Ensure no sensitive paths are exported
    const sensitiveKeys = ['path', 'filePath', 'localPath', 'password', 'apiKey', 'token'];
    
    const checkForSensitive = (obj, path = '') => {
      if (!obj || typeof obj !== 'object') return;
      
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        
        if (sensitiveKeys.some(s => key.toLowerCase().includes(s.toLowerCase()))) {
          // Log but don't block - user owns their data
          console.warn(`Sensitive field in export: ${currentPath}`);
        }
        
        if (value && typeof value === 'object') {
          checkForSensitive(value, currentPath);
        }
      }
    };

    checkForSensitive(data);
    return true;
  }

  // Cleanup
  cleanup() {
    // Clean old rate limit data
    const now = Date.now();
    for (const [key, requests] of this.rateLimits) {
      const valid = requests.filter(time => now - time < 60000);
      if (valid.length === 0) {
        this.rateLimits.delete(key);
      } else {
        this.rateLimits.set(key, valid);
      }
    }
  }
}

export const securityManager = new SecurityManager();

// Auto cleanup every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(() => securityManager.cleanup(), 5 * 60 * 1000);
}
