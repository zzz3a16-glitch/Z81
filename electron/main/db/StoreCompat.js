/**
 * StoreCompat — SQLite-backed implementation of the legacy IndexedDB store API
 * (spec 72: preserve existing records; zero data loss during migration).
 *
 * Every renderer service (favorites, watchlists, history, ratings, episodes,
 * people, notifications, metadata, behaviour…) keeps its exact contract:
 *   get / getAll / getByIndex / put / add / delete / clear / count / exportAll
 * Only the engine underneath changes: IndexedDB (browser) -> doc_store (SQLite).
 */
import crypto from 'node:crypto';

/** Per-store descriptors mirroring the legacy IndexedDB schema. */
const DEFS = {
  movies:        { keyPath: 'id', ref1: 'title', ref2: 'year', numIsId: true,
                   indexes: { title: 'ref1', year: 'ref2' } },
  tvshows:       { keyPath: 'id', ref1: 'title', ref2: 'first_air_date', numIsId: true,
                   indexes: { title: 'ref1', year: 'ref2' } },
  episodes:      { keyPath: 'id', ref1: 'showId', ref2: 'season',
                   indexes: { showId: 'ref1', season: 'ref2' } },
  people:        { keyPath: 'id', ref1: 'name', numIsId: true,
                   indexes: { name: 'ref1' } },
  watchHistory:  { keyPath: 'id', ref1: 'mediaId', ref2: 'watchedAt', num: 'watchedAt',
                   indexes: { mediaId: 'ref1', watchedAt: 'ref2' } },
  watchProgress: { keyPath: 'mediaId', ref2: 'updatedAt', num: 'updatedAt',
                   indexes: { mediaId: 'key', updatedAt: 'ref2' } },
  favorites:     { keyPath: 'id', mediaType: 'mediaType',
                   indexes: { mediaType: 'media_type' } },
  watchlists:    { keyPath: 'id', ref1: 'name',
                   indexes: { name: 'ref1' } },
  watchlistItems:{ keyPath: 'id', ref1: 'listId', ref2: 'mediaId',
                   indexes: { listId: 'ref1', mediaId: 'ref2' } },
  ratings:       { keyPath: 'mediaId', num: 'rating',
                   indexes: { rating: 'num', mediaId: 'key' } },
  behaviorEvents:{ keyPath: 'id', ref1: 'type', ref2: 'timestamp', num: 'timestamp',
                   indexes: { type: 'ref1', timestamp: 'ref2' } },
  tasteProfile:  { keyPath: 'id', indexes: {} },
  notifications: { keyPath: 'id', ref1: 'type', ref2: 'read',
                   indexes: { type: 'ref1', read: 'ref2' } },
  metadata:      { keyPath: 'key', indexes: {} },
  // 'settings' store is handled by SettingsService / settings table
};

export const LEGACY_STORES = Object.keys(DEFS);

const str = (v) => (v === null || v === undefined ? null : String(v));
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export class StoreCompat {
  /** @param {import('./DatabaseService.js').DatabaseService} db */
  constructor(db, log, events) {
    this.db = db;
    this.log = log;
    this.events = events;
  }

  _def(store) {
    const d = DEFS[store];
    if (!d) throw new Error(`Unknown store: ${store}`);
    return d;
  }

  _keyOf(def, data) {
    let k = data[def.keyPath];
    if (k === undefined || k === null) {
      k = `auto-${crypto.randomUUID()}`;
      data[def.keyPath] = k;
    }
    return String(k);
  }

  put(store, data) {
    const def = this._def(store);
    const key = this._keyOf(def, data);
    const now = Date.now();
    this.db.run(
      `INSERT INTO doc_store (store, key, num, media_type, ref1, ref2, updated_at, payload)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(store, key) DO UPDATE SET
         num=excluded.num, media_type=excluded.media_type, ref1=excluded.ref1,
         ref2=excluded.ref2, updated_at=excluded.updated_at, payload=excluded.payload`,
      [
        store, key,
        num(def.numIsId ? data[def.keyPath] : data[def.num || '']),
        def.mediaType ? str(data[def.mediaType]) : (store === 'movies' ? 'movie' : store === 'tvshows' ? 'tv' : null),
        str(def.ref1 ? data[def.ref1] : null),
        str(def.ref2 ? data[def.ref2] : null),
        now,
        JSON.stringify(data),
      ]
    );
    if (store === 'movies' || store === 'tvshows' || store === 'episodes') {
      this.events?.emit('library:changed', { store, key, op: 'put' });
    }
    return data[def.keyPath];
  }

  add(store, data) {
    const def = this._def(store);
    const key = this._keyOf(def, data);
    const exists = this.db.get('SELECT 1 AS x FROM doc_store WHERE store=? AND key=?', [store, key]);
    if (exists) throw new Error(`ConstraintError: key ${key} already exists in ${store}`);
    return this.put(store, data);
  }

  get(store, key) {
    this._def(store);
    const row = this.db.get('SELECT payload FROM doc_store WHERE store=? AND key=?', [store, String(key)]);
    return row ? JSON.parse(row.payload) : null;
  }

  getAll(store, limit = null) {
    this._def(store);
    // Legacy semantics: unsorted fetch returns insertion-key order; pages re-sort.
    const rows = this.db.all(
      `SELECT payload FROM doc_store WHERE store=? ORDER BY key LIMIT ?`,
      [store, limit ? Number(limit) : -1]
    );
    return rows.map((r) => JSON.parse(r.payload));
  }

  getByIndex(store, indexName, value) {
    const def = this._def(store);
    const col = (def.indexes || {})[indexName];
    if (!col) throw new Error(`No index "${indexName}" on store "${store}"`);
    const rows = this.db.all(
      `SELECT payload FROM doc_store WHERE store=? AND ${col}=? ORDER BY updated_at DESC`,
      [store, str(value)]
    );
    return rows.map((r) => JSON.parse(r.payload));
  }

  delete(store, key) {
    this._def(store);
    const r = this.db.run('DELETE FROM doc_store WHERE store=? AND key=?', [store, String(key)]);
    if (store === 'movies' || store === 'tvshows' || store === 'episodes') {
      this.events?.emit('library:changed', { store, key: String(key), op: 'delete' });
    }
    return r.changes > 0;
  }

  clear(store) {
    this._def(store);
    this.log.warn('db', `clear('${store}') requested — all records will be dropped`);
    const r = this.db.run('DELETE FROM doc_store WHERE store=?', [store]);
    this.events?.emit('library:changed', { store, op: 'clear' });
    return r.changes;
  }

  count(store) {
    this._def(store);
    return this.db.get('SELECT COUNT(*) AS c FROM doc_store WHERE store=?', [store]).c;
  }

  stats() {
    const out = {};
    for (const s of [...LEGACY_STORES, 'settings']) {
      try { out[s] = s === 'settings'
        ? this.db.get('SELECT COUNT(*) AS c FROM settings').c
        : this.count(s); } catch { out[s] = 0; }
    }
    return out;
  }

  /** Legacy exportAll() shape so existing BackupManager flows keep working. */
  exportAll() {
    const data = { version: 1, exportedAt: new Date().toISOString(), stores: {} };
    for (const s of LEGACY_STORES) data.stores[s] = this.getAll(s);
    data.stores.settings = this.db.all('SELECT key, value FROM settings').map((r) => ({
      key: r.key, value: JSON.parse(r.value), updatedAt: r.updated_at,
    }));
    return data;
  }

  /**
   * Merge-import a legacy export (browser IndexedDB export) WITHOUT clearing
   * existing rows — the safe desktop migration path (spec 72).
   * @returns {{imported:number, skipped:number, stores:Record<string,{imported:number,skipped:number}>}}
   */
  importLegacy(data) {
    if (!data || typeof data !== 'object' || !data.stores || typeof data.stores !== 'object') {
      throw new Error('Invalid backup format');
    }
    const summary = {};
    let imported = 0; let skipped = 0;
    this.db.tx(() => {
      for (const [store, items] of Object.entries(data.stores)) {
        if (!Array.isArray(items)) continue;
        if (store === 'settings') {
          for (const it of items) {
            if (!it || it.key === undefined) continue;
            const ex = this.db.get('SELECT 1 AS x FROM settings WHERE key=?', [String(it.key)]);
            if (ex) { skipped++; continue; }
            this.db.run('INSERT INTO settings (key,value,updated_at) VALUES (?,?,?)',
              [String(it.key), JSON.stringify(it.value ?? null), Date.now()]);
            imported++;
          }
          summary[store] = { imported, skipped };
          continue;
        }
        if (!DEFS[store]) continue;
        let si = 0; let sk = 0;
        for (const item of items) {
          if (!item || typeof item !== 'object') { sk++; continue; }
          const key = str(item[DEFS[store].keyPath]);
          if (key === null) { sk++; continue; }
          const ex = this.db.get('SELECT 1 AS x FROM doc_store WHERE store=? AND key=?', [store, key]);
          if (ex) { sk++; continue; }
          this.put(store, item);
          si++;
        }
        summary[store] = { imported: si, skipped: sk };
        imported += si; skipped += sk;
      }
    });
    this.events?.emit('library:changed', { op: 'importLegacy' });
    this.log.info('db', `legacy import done: ${imported} imported, ${skipped} kept (existing wins)`);
    return { imported, skipped, stores: summary };
  }

  /** Raw iteration for domain services (import, health, indexing). */
  * [Symbol.iterator]() { /* not a collection — placeholder to discourage use */ }

  walk(store, fn) {
    for (const item of this.getAll(store)) fn(item);
  }
}
