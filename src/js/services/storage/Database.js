/**
 * Database - IndexedDB Wrapper with SQLite-like API
 * Production-Grade Local-First Storage
 */

export class Database {
  constructor(name = 'zpopcorn-db', version = 1) {
    this.name = name;
    this.version = version;
    this.db = null;
    this.stores = [
      { name: 'movies', keyPath: 'id', indexes: [{ name: 'title', keyPath: 'title' }, { name: 'year', keyPath: 'year' }] },
      { name: 'tvshows', keyPath: 'id', indexes: [{ name: 'title', keyPath: 'title' }] },
      { name: 'episodes', keyPath: 'id', indexes: [{ name: 'showId', keyPath: 'showId' }, { name: 'season', keyPath: 'season' }] },
      { name: 'people', keyPath: 'id', indexes: [{ name: 'name', keyPath: 'name' }] },
      { name: 'watchHistory', keyPath: 'id', indexes: [{ name: 'mediaId', keyPath: 'mediaId' }, { name: 'watchedAt', keyPath: 'watchedAt' }] },
      { name: 'watchProgress', keyPath: 'mediaId', indexes: [{ name: 'updatedAt', keyPath: 'updatedAt' }] },
      { name: 'favorites', keyPath: 'id', indexes: [{ name: 'mediaType', keyPath: 'mediaType' }] },
      { name: 'watchlists', keyPath: 'id', indexes: [{ name: 'name', keyPath: 'name' }] },
      { name: 'watchlistItems', keyPath: 'id', indexes: [{ name: 'listId', keyPath: 'listId' }, { name: 'mediaId', keyPath: 'mediaId' }] },
      { name: 'ratings', keyPath: 'mediaId', indexes: [{ name: 'rating', keyPath: 'rating' }] },
      { name: 'behaviorEvents', keyPath: 'id', indexes: [{ name: 'type', keyPath: 'type' }, { name: 'timestamp', keyPath: 'timestamp' }] },
      { name: 'tasteProfile', keyPath: 'id' },
      { name: 'notifications', keyPath: 'id', indexes: [{ name: 'type', keyPath: 'type' }, { name: 'read', keyPath: 'read' }] },
      { name: 'settings', keyPath: 'key' },
      { name: 'metadata', keyPath: 'key' }
    ];
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.name, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        this.stores.forEach(storeConfig => {
          if (!db.objectStoreNames.contains(storeConfig.name)) {
            const store = db.createObjectStore(storeConfig.name, { keyPath: storeConfig.keyPath });
            
            if (storeConfig.indexes) {
              storeConfig.indexes.forEach(index => {
                store.createIndex(index.name, index.keyPath, { unique: index.unique || false });
              });
            }
          }
        });
      };
    });
  }

  async ensureDB() {
    if (!this.db) {
      await this.init();
    }
    return this.db;
  }

  async get(storeName, key) {
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAll(storeName, query = null, count = null) {
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = query ? store.getAll(query, count) : store.getAll(null, count);
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getByIndex(storeName, indexName, value) {
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async put(storeName, data) {
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async add(storeName, data) {
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.add(data);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(storeName, key) {
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);
      
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  async clear(storeName) {
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();
      
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  async count(storeName) {
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.count();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Convenience methods
  async getSetting(key, defaultValue = null) {
    const result = await this.get('settings', key);
    return result ? result.value : defaultValue;
  }

  async setSetting(key, value) {
    return this.put('settings', { key, value, updatedAt: Date.now() });
  }

  async getTasteProfile() {
    const result = await this.get('tasteProfile', 'main');
    return result || null;
  }

  async saveTasteProfile(profile) {
    return this.put('tasteProfile', { id: 'main', ...profile, updatedAt: Date.now() });
  }

  // Backup & Restore
  async exportAll() {
    await this.ensureDB();
    const exportData = {
      version: this.version,
      exportedAt: new Date().toISOString(),
      stores: {}
    };

    for (const storeConfig of this.stores) {
      try {
        exportData.stores[storeConfig.name] = await this.getAll(storeConfig.name);
      } catch (e) {
        console.warn(`Failed to export ${storeConfig.name}:`, e);
        exportData.stores[storeConfig.name] = [];
      }
    }

    return exportData;
  }

  async importAll(data) {
    await this.ensureDB();
    
    if (!data.stores) {
      throw new Error('Invalid backup format');
    }

    for (const [storeName, items] of Object.entries(data.stores)) {
      if (!this.db.objectStoreNames.contains(storeName)) continue;
      
      // Clear existing
      await this.clear(storeName);
      
      // Import new
      for (const item of items) {
        try {
          await this.put(storeName, item);
        } catch (e) {
          console.warn(`Failed to import item to ${storeName}:`, e);
        }
      }
    }

    return true;
  }

  async getStats() {
    await this.ensureDB();
    const stats = {};
    
    for (const storeConfig of this.stores) {
      try {
        stats[storeConfig.name] = await this.count(storeConfig.name);
      } catch {
        stats[storeConfig.name] = 0;
      }
    }
    
    return stats;
  }
}

// Singleton
export const db = new Database();
export default db;
