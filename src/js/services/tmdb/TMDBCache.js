/**
 * TMDBCache - Production-Grade Caching System
 * Implements TTL, LRU, and persistent storage
 */

export class TMDBCache {
  constructor(options = {}) {
    this.storageKey = options.storageKey || 'zpopcorn-tmdb-cache';
    this.maxSize = options.maxSize || 500;
    this.defaultTTL = options.defaultTTL || 6 * 60 * 60 * 1000; // 6 hours
    this.cache = new Map();
    this.loadFromStorage();
  }

  loadFromStorage() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        Object.entries(data).forEach(([key, value]) => {
          if (this.isValid(value)) {
            this.cache.set(key, value);
          }
        });
      }
    } catch (error) {
      console.warn('Failed to load TMDB cache from storage:', error);
    }
  }

  saveToStorage() {
    try {
      const data = {};
      for (const [key, value] of this.cache.entries()) {
        if (this.isValid(value)) {
          data[key] = value;
        }
      }
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save TMDB cache:', error);
      // If quota exceeded, clear old entries
      if (error.name === 'QuotaExceededError') {
        this.evictOldest(100);
        try {
          localStorage.setItem(this.storageKey, JSON.stringify(Object.fromEntries(this.cache)));
        } catch {}
      }
    }
  }

  isValid(entry) {
    if (!entry || !entry.timestamp || !entry.ttl) return false;
    return Date.now() - entry.timestamp < entry.ttl;
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (!this.isValid(entry)) {
      this.cache.delete(key);
      this.saveToStorage();
      return null;
    }
    
    // Update access time for LRU
    entry.lastAccessed = Date.now();
    return entry.data;
  }

  set(key, data, ttl = this.defaultTTL) {
    // Evict if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictOldest(1);
    }

    const entry = {
      data,
      timestamp: Date.now(),
      lastAccessed: Date.now(),
      ttl
    };

    this.cache.set(key, entry);
    this.saveToStorage();
    return entry;
  }

  has(key) {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (!this.isValid(entry)) {
      this.cache.delete(key);
      this.saveToStorage();
      return false;
    }
    return true;
  }

  delete(key) {
    const result = this.cache.delete(key);
    this.saveToStorage();
    return result;
  }

  clear() {
    this.cache.clear();
    localStorage.removeItem(this.storageKey);
  }

  clearExpired() {
    let cleared = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (!this.isValid(entry)) {
        this.cache.delete(key);
        cleared++;
      }
    }
    if (cleared > 0) {
      this.saveToStorage();
    }
    return cleared;
  }

  evictOldest(count = 1) {
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => (a[1].lastAccessed || 0) - (b[1].lastAccessed || 0));
    
    for (let i = 0; i < Math.min(count, entries.length); i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      validEntries: Array.from(this.cache.values()).filter(e => this.isValid(e)).length
    };
  }

  generateKey(endpoint, params = {}) {
    const sortedParams = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
    return `${endpoint}?${sortedParams}`;
  }
}

// Specialized caches
export class MetadataCache extends TMDBCache {
  constructor() {
    super({ storageKey: 'zpopcorn-metadata-cache', maxSize: 300, defaultTTL: 6 * 60 * 60 * 1000 });
  }
}

export class SearchCache extends TMDBCache {
  constructor() {
    super({ storageKey: 'zpopcorn-search-cache', maxSize: 100, defaultTTL: 60 * 60 * 1000 });
  }
}

export class ImageCache extends TMDBCache {
  constructor() {
    super({ storageKey: 'zpopcorn-image-cache', maxSize: 500, defaultTTL: 30 * 24 * 60 * 60 * 1000 });
  }
}

export class ConfigCache extends TMDBCache {
  constructor() {
    super({ storageKey: 'zpopcorn-config-cache', maxSize: 10, defaultTTL: 24 * 60 * 60 * 1000 });
  }
}

export default TMDBCache;
