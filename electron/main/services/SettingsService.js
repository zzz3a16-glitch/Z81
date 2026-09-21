/**
 * SettingsService — canonical app settings in SQLite (spec 63).
 * The renderer keeps using localStorage as a mirror; bridge.js syncs
 * the two so main remains the single source of truth.
 */
const DEFAULTS = {
  region: 'SA',
  language: 'ar-SA',
  tmdbApiKey: 'e547e17d4e91f3e62a571655cd1ccaff', // demo fallback (override in Settings → TMDB)
  devMode: false,
  autoConfirmThreshold: 92,
  autoScanOnLaunch: false,
  theme: 'midnight-neon',
  density: 'comfortable',
  motion: 'full',
  maxScanFiles: 50000,
  scanConcurrency: 3,
  cacheTtlScale: 1,
  importConflictPolicy: 'merge', // merge | keep-both
};

const LEGACY_KEY_MAP = {
  'zpopcorn-region': 'region',
  'zpopcorn-language': 'language',
  'zpopcorn-tmdb-api-key': 'tmdbApiKey',
  'zpopcorn-theme': 'theme',
  'zpopcorn-density': 'density',
  'zpopcorn-motion': 'motion',
  'zpopcorn-dev-mode': 'devMode',
};

export class SettingsService {
  constructor(db, log, events) {
    this.db = db;
    this.log = log;
    this.events = events;
  }

  _tableGet(key) {
    const row = this.db.get('SELECT value FROM settings WHERE key=?', [key]);
    if (!row) return undefined;
    try { return JSON.parse(row.value); } catch { return row.value; }
  }

  get(key) {
    const v = this._tableGet(key);
    return v === undefined ? DEFAULTS[key] : v;
  }

  getAll() {
    const rows = this.db.all('SELECT key, value FROM settings');
    const out = { ...DEFAULTS };
    for (const r of rows) {
      try { out[r.key] = JSON.parse(r.value); } catch { out[r.key] = r.value; }
    }
    return out;
  }

  /** Flat snapshot for renderer bootstrap (includes legacy localStorage keys). */
  snapshotForRenderer() {
    const all = this.getAll();
    const snap = {};
    for (const [legacyKey, canonical] of Object.entries(LEGACY_KEY_MAP)) {
      if (all[canonical] !== undefined) snap[legacyKey] = all[canonical];
    }
    snap.__settings = all;
    return snap;
  }

  set(key, value) {
    this.db.run(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`,
      [key, JSON.stringify(value ?? null), Date.now()]
    );
    this.events?.emit('settings:changed', { key, value });
    return true;
  }

  setMany(obj) {
    this.db.tx(() => {
      for (const [k, v] of Object.entries(obj)) {
        this.db.run(
          `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
           ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`,
          [k, JSON.stringify(v ?? null), Date.now()]
        );
      }
    });
    this.events?.emit('settings:changed', { keys: Object.keys(obj) });
    return true;
  }

  remove(key) {
    return this.db.run('DELETE FROM settings WHERE key=?', [key]).changes > 0;
  }

  /** Accept writes coming from the renderer's localStorage mirror. */
  syncFromLegacy(localKey, value) {
    const canonical = LEGACY_KEY_MAP[localKey];
    if (!canonical) return false;
    // localStorage stores strings; normalize known non-string settings.
    if (typeof DEFAULTS[canonical] === 'number') {
      const n = Number(value);
      if (Number.isFinite(n)) value = n;
    } else if (typeof DEFAULTS[canonical] === 'boolean') {
      value = value === 'true' || value === true;
    } else if (canonical === 'theme' || canonical === 'region' || canonical === 'language') {
      try { value = JSON.parse(value); } catch { /* raw string ok */ }
    }
    this.set(canonical, value);
    return true;
  }

  maskedSnapshot() {
    const all = this.snapshotForRenderer();
    if (all.__settings?.tmdbApiKey) {
      const k = String(all.__settings.tmdbApiKey);
      all.__settings.tmdbApiKey = k.length > 8 ? `••••••${k.slice(-4)}` : '••••';
      if (all['zpopcorn-tmdb-api-key']) all['zpopcorn-tmdb-api-key'] = '••••••••';
    }
    return all;
  }
}

export { DEFAULTS, LEGACY_KEY_MAP };
