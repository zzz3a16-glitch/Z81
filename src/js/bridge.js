/**
 * zPopcorn renderer bridge — the ONLY gateway between UI and desktop APIs.
 *
 * Desktop mode  (Electron): window.zpopcorn.* typed IPC (see electron/preload.cjs).
 * Browser mode  (vite dev / preview): the legacy in-browser stack (IndexedDB +
 *               direct TMDB fetch) keeps the UI fully functional for QA/preview.
 *
 * Responsibilities:
 *  - capability detection + a stable `api` facade
 *  - settings: pull the canonical snapshot from main before app init and mirror
 *    it into localStorage; install a write-through mirror so existing
 *    localStorage call-sites keep working while main stays the source of truth
 *  - router hash mode for file:// navigation (packaged desktop)
 *  - desktop push events (scan progress, inbox, health, toasts, shortcuts)
 */

const zp = (typeof window !== 'undefined') ? window.zpopcorn : undefined;
export const isDesktop = !!(zp && zp.__meta && zp.__meta.isZpopcorn);

if (typeof window !== 'undefined') {
  // Packaged desktop runs on file:// where history API paths break on reload.
  window.__zpopcornHashMode = isDesktop;
}

/** Namespaced accessors — never raw ipcRenderer in components (spec 07). */
export const api = isDesktop ? zp : null;

export const bridge = {
  isDesktop,
  api,
  meta: isDesktop ? zp.__meta : { isZpopcorn: false, platform: 'browser' },

  /** Called first in main.js — hydrates localStorage from canonical settings. */
  async init() {
    if (!isDesktop) return { mode: 'browser' };
    try {
      const snap = await zp.settings.getAll();
      // Mirror canonical settings to localStorage keys the UI already reads.
      for (const [key, value] of Object.entries(snap)) {
        const legacy = legacyKeyFor(key);
        try {
          const store = legacy || key;
          const serialized = typeof value === 'string' ? (store.includes('theme') ? JSON.stringify(value) : value) : JSON.stringify(value);
          localStorage.setItem(store, serialized);
        } catch { /* quota — ignore */ }
      }
      installWriteThrough();
      installEvents();
      return { mode: 'desktop', settings: snap };
    } catch (e) {
      console.warn('[bridge] settings snapshot failed — continuing in degraded mode', e);
      return { mode: 'desktop-degraded' };
    }
  },
};

const CANONICAL_TO_LEGACY = {
  region: 'zpopcorn-region',
  language: 'zpopcorn-language',
  tmdbApiKey: 'zpopcorn-tmdb-api-key',
  theme: 'zpopcorn-theme',
  density: 'zpopcorn-density',
  motion: 'zpopcorn-motion',
  devMode: 'zpopcorn-dev-mode',
};
const LEGACY_TO_CANONICAL = Object.fromEntries(
  Object.entries(CANONICAL_TO_LEGACY).map(([a, b]) => [b, a])
);
function legacyKeyFor(canonical) {
  return CANONICAL_TO_LEGACY[canonical] || null;
}

let writeThroughInstalled = false;
/**
 * Write-through mirror: renderer code uses localStorage as always; when a
 * recognized setting changes, it is persisted to main (SQLite) as well.
 * Single documented choke-point instead of scattered IPC calls.
 */
function installWriteThrough() {
  if (writeThroughInstalled) return;
  writeThroughInstalled = true;
  const proto = Object.getPrototypeOf(localStorage);
  const original = proto.setItem;
  const debounced = new Map();
  proto.setItem = function (key, value) {
    original.call(this, key, value);
    const canonical = LEGACY_TO_CANONICAL[key];
    if (!canonical) return;
    clearTimeout(debounced.get(key));
    debounced.set(key, setTimeout(() => {
      debounced.delete(key);
      let parsed = value;
      try { parsed = JSON.parse(value); } catch { /* string value */ }
      api.settings.set(canonical, parsed).catch(() => {});
    }, 120));
  };
}

function installEvents() {
  if (!api) return;
  // Native-menu accelerators (Ctrl+K search, etc.)
  api.events.on('navigate', (payload) => {
    const target = typeof payload === 'string' ? payload : (payload?.path ?? payload?.payload?.path);
    if (target && window.router) window.router.navigate(target);
  });
  // Main-originated toasts (scan finished, backup progress…)
  api.events.on('toast', (payload) => {
    const d = payload || {};
    window.dispatchEvent(new CustomEvent('showtoast', {
      detail: { message: d.message || '', type: d.type || 'info' },
    }));
  });
  // Library/health/inbox changes refresh live views
  for (const ev of ['library-changed', 'inbox-changed', 'health-changed', 'settings-changed']) {
    api.events.on(ev, (payload) => {
      window.dispatchEvent(new CustomEvent('zpopcorn:' + ev, { detail: payload }));
    });
  }
  api.events.on('scan-progress', (payload) => {
    window.dispatchEvent(new CustomEvent('zpopcorn:scan-progress', { detail: payload }));
  });
  api.events.on('backup-progress', (payload) => {
    window.dispatchEvent(new CustomEvent('zpopcorn:backup-progress', { detail: payload }));
  });
}

/**
 * Safe call helper: pages use this for optional desktop features so the UI
 * never crashes in browser mode or when main returns a structured error.
 */
export async function call(fn, fallback = null, onError = null) {
  if (!api) return fallback;
  try {
    return await fn();
  } catch (e) {
    if (onError) onError(e);
    else console.warn('[bridge]', e.message);
    return fallback;
  }
}

export function playerCapability() {
  return call(() => api.player.capability(), {
    implemented: false,
    code: 'PLAYER_NOT_IMPLEMENTED',
    message: 'مشغّل الوسائط سيُضاف في مرحلة مستقبلية منفصلة',
  });
}

export default bridge;
