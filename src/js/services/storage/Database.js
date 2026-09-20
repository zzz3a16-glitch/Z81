/**
 * Database — dual-mode storage facade (spec 05/09/13/72).
 *
 * Desktop (Electron): every operation delegates through the typed IPC bridge
 * to the SQLite-backed document-store in the main process. The API surface is
 * intentionally identical to the previous IndexedDB implementation so all 20+
 * services/pages keep working with ZERO behavior change — only the engine
 * underneath moved to SQLite with migrations + backups.
 *
 * Browser (vite dev / preview / PWA QA): falls back to the original IndexedDB
 * implementation, preserving local-first functionality without Electron.
 */
import { isDesktop, api } from '../../bridge.js';

/* --------------------------- browser mode (legacy) --------------------------- */
class IndexedDBStore {
  constructor(name = 'zpopcorn-db', version = 2) {
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
      { name: 'metadata', keyPath: 'key' },
      // LIVE platform stores (mirror of the desktop doc_store definitions)
      { name: 'live_sources', keyPath: 'id', indexes: [{ name: 'name', keyPath: 'name' }] },
      { name: 'live_playlists', keyPath: 'sourceId' },
      { name: 'live_favs', keyPath: 'chanId', indexes: [{ name: 'sourceId', keyPath: 'sourceId' }] },
      { name: 'live_history', keyPath: 'chanId', indexes: [{ name: 'sourceId', keyPath: 'sourceId' }] },
      { name: 'live_epg', keyPath: 'key', indexes: [{ name: 'sourceId', keyPath: 'sourceId' }] },
    ];
  }

  async init() {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB unavailable')); return; }
      const request = indexedDB.open(this.name, this.version);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => { this.db = request.result; resolve(this.db); };
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        this.stores.forEach((cfg) => {
          if (!db.objectStoreNames.contains(cfg.name)) {
            const store = db.createObjectStore(cfg.name, { keyPath: cfg.keyPath });
            (cfg.indexes || []).forEach((index) => {
              store.createIndex(index.name, index.keyPath, { unique: index.unique || false });
            });
          }
        });
      };
    });
  }

  async ensureDB() { if (!this.db) await this.init(); return this.db; }

  async get(storeName, key) {
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const t = this.db.transaction(storeName, 'readonly');
      const r = t.objectStore(storeName).get(key);
      r.onsuccess = () => resolve(r.result || null);
      r.onerror = () => reject(r.error);
    });
  }

  async getAll(storeName, query = null, count = null) {
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const t = this.db.transaction(storeName, 'readonly');
      const r = query ? t.objectStore(storeName).getAll(query, count) : t.objectStore(storeName).getAll(null, count);
      r.onsuccess = () => resolve(r.result || []);
      r.onerror = () => reject(r.error);
    });
  }

  async getByIndex(storeName, indexName, value) {
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const t = this.db.transaction(storeName, 'readonly');
      const r = t.objectStore(storeName).index(indexName).getAll(value);
      r.onsuccess = () => resolve(r.result || []);
      r.onerror = () => reject(r.error);
    });
  }

  async put(storeName, data) {
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const t = this.db.transaction(storeName, 'readwrite');
      const r = t.objectStore(storeName).put(data);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }

  async add(storeName, data) {
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const t = this.db.transaction(storeName, 'readwrite');
      const r = t.objectStore(storeName).add(data);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }

  async delete(storeName, key) {
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const t = this.db.transaction(storeName, 'readwrite');
      const r = t.objectStore(storeName).delete(key);
      r.onsuccess = () => resolve(true);
      r.onerror = () => reject(r.error);
    });
  }

  async clear(storeName) {
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const t = this.db.transaction(storeName, 'readwrite');
      const r = t.objectStore(storeName).clear();
      r.onsuccess = () => resolve(true);
      r.onerror = () => reject(r.error);
    });
  }

  async count(storeName) {
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const t = this.db.transaction(storeName, 'readonly');
      const r = t.objectStore(storeName).count();
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }

  async exportAll() {
    await this.ensureDB();
    const out = { version: this.version, exportedAt: new Date().toISOString(), stores: {} };
    for (const cfg of this.stores) {
      try { out.stores[cfg.name] = await this.getAll(cfg.name); }
      catch { out.stores[cfg.name] = []; }
    }
    return out;
  }

  async importAll(data) {
    await this.ensureDB();
    if (!data.stores) throw new Error('Invalid backup format');
    for (const [storeName, items] of Object.entries(data.stores)) {
      if (!this.db.objectStoreNames.contains(storeName)) continue;
      await this.clear(storeName);
      for (const item of items) {
        try { await this.put(storeName, item); } catch { /* skip bad row */ }
      }
    }
    return true;
  }

  async getStats() {
    const stats = {};
    for (const cfg of this.stores) {
      try { stats[cfg.name] = await this.count(cfg.name); } catch { stats[cfg.name] = 0; }
    }
    return stats;
  }
}

/* --------------------------- desktop mode (SQLite IPC) --------------------------- */
class DesktopStore {
  constructor() {
    this.mode = 'sqlite-ipc';
  }
  async init() { return true; }
  get(store, key) { return api.database.get(store, key); }
  getAll(store, _query = null, count = null) { return api.database.getAll(store, count); }
  getByIndex(store, index, value) { return api.database.getByIndex(store, index, value); }
  put(store, data) { return api.database.put(store, data); }
  add(store, data) { return api.database.add(store, data); }
  delete(store, key) { return api.database.delete(store, key); }
  clear(store) { return api.database.clear(store); }
  count(store) { return api.database.count(store); }
  exportAll() { return api.database.exportAll(); }
  importAll(data) { return api.database.importLegacy(data); } // merge-safe on desktop by design
  getStats() { return api.database.stats(); }
}

/* ------------------------------- facade ------------------------------- */
export class Database {
  constructor() {
    this.store = isDesktop ? new DesktopStore() : new IndexedDBStore();
    this.isDesktop = isDesktop;
  }

  async init() {
    try { await this.store.init(); }
    catch (e) {
      console.warn('[db] init issue:', e.message);
      // desktop: bridge may still be fine; browser: retry once lazily
    }
    return this;
  }

  get(...a) { return this.store.get(...a); }
  getAll(...a) { return this.store.getAll(...a); }
  getByIndex(...a) { return this.store.getByIndex(...a); }
  put(...a) { return this.store.put(...a); }
  add(...a) { return this.store.add(...a); }
  delete(...a) { return this.store.delete(...a); }
  clear(...a) { return this.store.clear(...a); }
  count(...a) { return this.store.count(...a); }
  exportAll(...a) { return this.store.exportAll(...a); }
  importAll(...a) { return this.store.importAll(...a); }
  getStats(...a) { return this.store.getStats(...a); }

  // Convenience (kept identical to the legacy contract)
  async getSetting(key, defaultValue = null) {
    const result = await this.store.get('settings', key);
    return result ? result.value : defaultValue;
  }

  async setSetting(key, value) {
    return this.store.put('settings', { key, value, updatedAt: Date.now() });
  }

  async getTasteProfile() {
    return (await this.store.get('tasteProfile', 'main')) || null;
  }

  async saveTasteProfile(profile) {
    return this.store.put('tasteProfile', { id: 'main', ...profile, updatedAt: Date.now() });
  }
}

// Singleton
export const db = new Database();
export default db;
