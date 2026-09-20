/**
 * IPC handler bindings — thin, validated adapters from channels to services.
 * No business logic lives here (spec 08/09).
 */
import { err, VALIDATORS } from './validation.js';

const { storeKey, storeOnly, str, json } = VALIDATORS;

/** @param {ReturnType<import('../services/container.js').createContainer>} S */
export function registerHandlers(S, broadcast) {
  const win = () => (S.windows ? S.windows()[0] : null);
  const dialog = S.dialog;
  const h = new Map();
  const on = (ch, validate, handler) => h.set(ch, { validate, handler });

  // ---------------- system ----------------
  on('zpopcorn:system.getInfo', () => {}, () => S.system.getInfo());
  on('zpopcorn:system.getDiagnostics', () => {}, () => S.system.getDiagnostics());
  on('zpopcorn:system.getPaths', () => {}, () => S.system.getPaths());
  on('zpopcorn:system.pickFolder', () => {}, async () => {
    const w = win();
    if (!w) return null;
    const res = await dialog.showOpenDialog(w, {
      title: 'اختر مجلد الوسائط',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (res.canceled || !res.filePaths[0]) return null;
    S.system.authorize(res.filePaths[0]);
    return res.filePaths[0];
  });
  on('zpopcorn:system.pickFiles', (opts) => { opts && json(opts); }, async (opts = {}) => {
    const w = win();
    if (!w) return [];
    const res = await dialog.showOpenDialog(w, {
      title: 'اختر ملفات الوسائط',
      properties: ['openFile', 'multiSelections'],
      filters: Array.isArray(opts.filters) ? opts.filters : [
        { name: 'Video', extensions: ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v', 'ts', 'm2ts'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (res.canceled) return [];
    for (const p of res.filePaths) S.system.authorize(p);
    return res.filePaths;
  });
  on('zpopcorn:system.openExternal', (url) => str(url), (url) => S.system.openExternal(url));
  on('zpopcorn:system.showItemInFolder', (p) => str(p), (p) => S.system.showItemInFolder(p));
  on('zpopcorn:system.windowControl', (action) => {
    if (!['minimize', 'maximize', 'unmaximize', 'toggle-maximize', 'close', 'fullscreen', 'exit-fullscreen'].includes(action)) throw err('E_BAD_ACTION');
  }, (action) => {
    const w = win();
    if (!w) return false;
    switch (action) {
      case 'minimize': w.minimize(); break;
      case 'maximize': w.maximize(); break;
      case 'unmaximize': w.unmaximize(); break;
      case 'toggle-maximize': w.isMaximized() ? w.unmaximize() : w.maximize(); break;
      case 'close': w.close(); break;
      case 'fullscreen': w.setFullScreen(!w.isFullScreen()); break;
      case 'exit-fullscreen': w.setFullScreen(false); break;
    }
    return true;
  });
  on('zpopcorn:system.toggleDevTools', () => {}, () => { const w = win(); if (!w) return false; w.webContents.toggleDevTools(); return true; });
  on('zpopcorn:system.restart', () => {}, () => S.system.restart());
  on('zpopcorn:system.quit', () => {}, () => S.system.quit());
  on('zpopcorn:system.getLogs', (tail) => { tail !== undefined && Number(tail); }, (tail) => S.system.getLogs(tail));
  on('zpopcorn:system.clearLogs', () => {}, () => S.system.clearLogs());

  // ---------------- settings ----------------
  on('zpopcorn:settings.getAll', () => {}, () => S.settings.getAll());
  on('zpopcorn:settings.get', (key) => str(key), (key) => S.settings.get(key));
  on('zpopcorn:settings.set', (key, value) => { str(key); json(value); }, (key, value) => {
    // mask guard: never persist the placeholder
    if (key === 'tmdbApiKey' && typeof value === 'string' && value.includes('•')) return true;
    S.settings.set(key, value);
    return true;
  });
  on('zpopcorn:settings.setMany', (obj) => json(obj), (obj) => S.settings.setMany(obj || {}));
  on('zpopcorn:settings.remove', (key) => str(key), (key) => S.settings.remove(key));
  on('zpopcorn:settings.syncLegacy', (key, value) => { str(key); json(value); }, (key, value) => S.settings.syncFromLegacy(key, value));

  // ---------------- files ----------------
  on('zpopcorn:files.stat', (p) => str(p), (p) => S.fs.stat(p));
  on('zpopcorn:files.exists', (p) => str(p), (p) => S.fs.exists(p));
  on('zpopcorn:files.getDrives', () => {}, () => S.fs.getDrives());
  on('zpopcorn:files.listDir', (p) => str(p), (p, opts) => S.fs.listDir(p, opts || {}));

  // ---------------- database (legacy-compatible document facade) ----------------
  on('zpopcorn:db.get', (store, key) => storeKey(store, key), (store, key) => {
    if (store === 'settings') {
      const v = S.settings.get(String(key));
      return v === undefined ? null : { key: String(key), value: v, updated_at: Date.now() };
    }
    return S.store.get(store, key);
  });
  on('zpopcorn:db.getAll', (store) => storeOnly(store), (store, count) => S.store.getAll(store, count));
  on('zpopcorn:db.getByIndex', (store, index) => { storeOnly(store); str(index); }, (store, index, value) => S.store.getByIndex(store, index, value));
  on('zpopcorn:db.put', (store, data) => { storeOnly(store); json(data); }, (store, data) => {
    if (store === 'settings' && data && data.key !== undefined) {
      S.settings.set(String(data.key), data.value ?? null);
      return data.key;
    }
    return S.store.put(store, data);
  });
  on('zpopcorn:db.add', (store, data) => { storeOnly(store); json(data); }, (store, data) => S.store.add(store, data));
  on('zpopcorn:db.delete', (store, key) => storeKey(store, key), (store, key) => store === 'settings' ? S.settings.remove(String(key)) : S.store.delete(store, key));
  on('zpopcorn:db.clear', (store) => storeOnly(store), (store) => {
    if (store === 'settings') throw err('E_PROTECTED', 'clearing all settings is not permitted');
    return S.store.clear(store);
  });
  on('zpopcorn:db.count', (store) => storeOnly(store), (store) => store === 'settings'
    ? Object.keys(S.settings.getAll()).length
    : S.store.count(store));
  on('zpopcorn:db.stats', () => {}, () => S.store.stats());
  on('zpopcorn:db.exportAll', () => {}, () => S.store.exportAll());
  on('zpopcorn:db.importLegacy', (data) => json(data), (data) => S.store.importLegacy(data));

  // ---------------- library ----------------
  on('zpopcorn:library.search', (q) => { q !== undefined && str(q); }, (q, opts) => S.library.search(q, opts || {}));
  on('zpopcorn:library.list', (opts) => { opts && json(opts); }, (opts = {}) => S.library.list(opts));
  on('zpopcorn:library.get', (store, key) => storeKey(store, key), (store, key) => S.library.get(store, key));
  on('zpopcorn:library.upsert', (data) => json(data), (data) => S.library.upsert(data));
  on('zpopcorn:library.remove', (store, key) => storeKey(store, key), (store, key) => S.library.remove({ store, key }));
  on('zpopcorn:library.stats', () => {}, () => S.library.stats());
  on('zpopcorn:library.setFlags', (store, key, flags) => { storeKey(store, key); json(flags); }, (store, key, flags) => S.library.setFlags({ store, key, flags }));
  on('zpopcorn:library.listMediaFiles', (store, key) => storeKey(store, key), (store, key) => S.library.listMediaFiles(store, key));
  on('zpopcorn:library.editionsFor', (store, key) => storeKey(store, key), (store, key) => S.library.editionsFor(store, key));
  on('zpopcorn:library.upsertEdition', (e) => json(e), (e) => S.library.upsertEdition(e));
  on('zpopcorn:library.removeMediaFile', (id) => Number(id), (id) => S.library.removeMediaFile(id));
  on('zpopcorn:library.relinkMediaFile', (id, p) => { Number(id); str(p); }, (id, p) => S.library.relinkMediaFile(id, p));
  on('zpopcorn:library.listSources', () => {}, () => S.library.listSources());
  on('zpopcorn:library.addSource', (p) => str(p), (p, label, kind) => S.library.addSource({ path: p, label, kind }));
  on('zpopcorn:library.removeSource', (id) => Number(id), (id, opts) => S.library.removeSource(id, opts || {}));
  on('zpopcorn:library.createSnapshot', (label) => { label !== undefined && str(label); }, (label) => S.library.createSnapshot(label));
  on('zpopcorn:library.listSnapshots', () => {}, () => S.library.listSnapshots());

  // ---------------- metadata (TMDB) ----------------
  on('zpopcorn:metadata.request', (path, params) => { str(path); params && json(params); }, (path, params = {}, opts = {}) => S.tmdb.request(path, params, opts));
  on('zpopcorn:metadata.search', (type, q) => { str(type); str(q); }, (type, q, page) => S.tmdb.search(type, q, page || 1));
  on('zpopcorn:metadata.trending', (mediaType) => { mediaType !== undefined && str(mediaType); }, (t, w, p) => S.tmdb.trending(t || 'all', w || 'day', p || 1));
  on('zpopcorn:metadata.discover', (type) => str(type), (type, params) => S.tmdb.discover(type, params || {}));
  on('zpopcorn:metadata.details', (type, id) => { str(type); Number(id); }, (type, id, append) => S.tmdb.details(type, id, append));
  on('zpopcorn:metadata.credits', (type, id) => { str(type); Number(id); }, (type, id) => S.tmdb.credits(type, id));
  on('zpopcorn:metadata.videos', (type, id) => { str(type); Number(id); }, (type, id) => S.tmdb.videos(type, id));
  on('zpopcorn:metadata.images', (type, id) => { str(type); Number(id); }, (type, id) => S.tmdb.images(type, id));
  on('zpopcorn:metadata.recommendations', (type, id) => { str(type); Number(id); }, (type, id, p) => S.tmdb.recommendations(type, id, p || 1));
  on('zpopcorn:metadata.similar', (type, id) => { str(type); Number(id); }, (type, id, p) => S.tmdb.similar(type, id, p || 1));
  on('zpopcorn:metadata.watchProviders', (type, id) => { str(type); Number(id); }, (type, id) => S.tmdb.watchProviders(type, id));
  on('zpopcorn:metadata.collection', (id) => Number(id), (id) => S.tmdb.collection(id));
  on('zpopcorn:metadata.season', (id, s) => { Number(id); Number(s); }, (id, s) => S.tmdb.season(id, s));
  on('zpopcorn:metadata.episode', (id, s, e) => { Number(id); Number(s); Number(e); }, (id, s, e) => S.tmdb.episode(id, s, e));
  on('zpopcorn:metadata.person', (id, append) => Number(id), (id, append) => S.tmdb.person(id, append));
  on('zpopcorn:metadata.genres', (type) => { type !== undefined && str(type); }, (type) => S.tmdb.genres(type));
  on('zpopcorn:metadata.status', () => {}, () => S.tmdb.status());
  on('zpopcorn:metadata.getImageConfig', () => {}, () => S.tmdb.getImageConfig());

  // ---------------- cache ----------------
  on('zpopcorn:cache.stats', () => {}, () => ({ metadata: S.tmdb.cacheStats(), images: S.images.stats() }));
  on('zpopcorn:cache.clear', (opts) => { opts && json(opts); }, (opts = {}) => {
    const clearedMeta = opts.metadata ? S.tmdb.clearCache(typeof opts.metadata === 'string' ? opts.metadata : null) : 0;
    const clearedImages = opts.images ? S.images.clear(typeof opts.images === 'string' ? opts.images : 'all') : 0;
    return { metadataEntries: clearedMeta, imageFiles: clearedImages };
  });

  // ---------------- favorites / history / collections ----------------
  on('zpopcorn:favorites.list', (opts) => { opts && json(opts); }, (opts = {}) => S.favorites.list(opts));
  on('zpopcorn:favorites.toggle', (item) => json(item), (item) => S.favorites.toggle(item));
  on('zpopcorn:favorites.add', (item) => json(item), (item) => S.favorites.add(item));
  on('zpopcorn:favorites.remove', (id) => { if (id === undefined || id === null) throw err('E_BAD_ID'); }, (id) => S.favorites.remove(id));
  on('zpopcorn:favorites.has', (ref) => json(ref), (ref) => S.favorites.has(ref));

  on('zpopcorn:history.record', (e) => json(e), (e) => S.history.record(e));
  on('zpopcorn:history.list', (opts) => { opts && json(opts); }, (opts = {}) => S.history.list(opts));
  on('zpopcorn:history.stats', () => {}, () => S.history.stats());
  on('zpopcorn:history.clear', () => {}, () => S.history.clear());
  on('zpopcorn:history.continueWatching', (opts) => { opts && json(opts); }, (opts = {}) => S.history.continueWatching(opts));
  on('zpopcorn:history.setProgress', (p) => json(p), (p) => S.history.setProgress(p));
  on('zpopcorn:history.getProgress', (id) => { if (id === undefined) throw err('E_BAD_ID'); }, (id) => S.history.getProgress(id));

  on('zpopcorn:collections.list', () => {}, () => S.collections.list());
  on('zpopcorn:collections.create', (d) => json(d), (d) => S.collections.create(d));
  on('zpopcorn:collections.update', (id, patch) => { str(id); json(patch); }, (id, patch) => S.collections.update(id, patch));
  on('zpopcorn:collections.remove', (id) => str(id), (id) => S.collections.remove(id));
  on('zpopcorn:collections.addItem', (id, media) => { str(id); json(media); }, (id, media) => S.collections.addItem(id, media));
  on('zpopcorn:collections.removeItem', (id, key) => { str(id); str(key); }, (id, key) => S.collections.removeItem(id, key));
  on('zpopcorn:collections.items', (id) => str(id), (id, opts) => S.collections.items(id, opts || {}));
  on('zpopcorn:collections.evaluateRules', (rules) => json(rules), (rules) => S.collections.evaluateRules(rules));

  // ---------------- inbox ----------------
  on('zpopcorn:inbox.list', (opts) => { opts && json(opts); }, (opts = {}) => S.imports.list(opts));
  on('zpopcorn:inbox.stats', () => {}, () => S.imports.stats());
  on('zpopcorn:inbox.scan', (opts) => { opts && json(opts); }, (opts = {}) => S.imports.scanAll(opts));
  on('zpopcorn:inbox.stopScan', () => {}, () => S.imports.stopScan());
  on('zpopcorn:inbox.confirm', (id) => Number(id), (id) => S.imports.confirm(id));
  on('zpopcorn:inbox.confirmMany', (ids) => { if (!Array.isArray(ids)) throw err('E_BAD_ARG'); }, (ids) => S.imports.confirmMany(ids));
  on('zpopcorn:inbox.ignore', (id) => Number(id), (id) => S.imports.ignore(id));
  on('zpopcorn:inbox.defer', (id) => Number(id), (id) => S.imports.defer(id));
  on('zpopcorn:inbox.update', (id, patch) => { Number(id); json(patch); }, (id, patch) => S.imports.update(id, patch));
  on('zpopcorn:inbox.rematch', (id) => Number(id), (id) => S.imports.rematch(id));
  on('zpopcorn:inbox.clearResolved', () => {}, () => S.imports.clearResolved());

  // ---------------- health ----------------
  on('zpopcorn:health.run', (opts) => { opts && json(opts); }, (opts = {}) => S.health.run(opts));
  on('zpopcorn:health.list', (opts) => { opts && json(opts); }, (opts = {}) => S.health.list(opts));
  on('zpopcorn:health.stats', () => {}, () => S.health.stats());
  on('zpopcorn:health.dismiss', (id) => str(id), (id) => S.health.dismiss(id));
  on('zpopcorn:health.relink', (id, p) => { str(id); str(p); }, (id, p) => S.health.relink(id, p));
  on('zpopcorn:health.removeRecord', (id) => str(id), (id) => S.health.removeRecord(id));

  // ---------------- duplicates ----------------
  on('zpopcorn:duplicates.scan', () => {}, () => S.dupes.scan());
  on('zpopcorn:duplicates.list', () => {}, () => S.dupes.list());
  on('zpopcorn:duplicates.review', (pair, action) => { str(pair); str(action); }, (pair, action) => S.dupes.review(pair, action));
  on('zpopcorn:duplicates.merge', (pair, keepRef) => { str(pair); keepRef !== undefined && str(keepRef); }, (pair, keepRef) => S.dupes.merge(pair, keepRef));
  on('zpopcorn:duplicates.stats', () => {}, () => S.dupes.stats());

  // ---------------- backup ----------------
  on('zpopcorn:backup.create', (label) => { label !== undefined && str(label); }, (label = '') => S.backup.create(label));
  on('zpopcorn:backup.list', () => {}, () => S.backup.list());
  on('zpopcorn:backup.restore', (file, opts) => { str(file); opts && json(opts); }, (file, opts) => S.backup.restore(file, opts || {}));
  on('zpopcorn:backup.validate', (file) => str(file), (file) => S.backup.validate(file));
  on('zpopcorn:backup.remove', (file) => str(file), (file) => S.backup.remove(file));
  on('zpopcorn:backup.status', () => {}, () => S.backup.status());
  on('zpopcorn:backup.exportLegacy', () => {}, () => S.backup.exportLegacy());
  on('zpopcorn:backup.importLegacy', (data) => json(data), (data) => S.backup.importLegacyJson(data));

  // ---------------- player (abstraction only — spec 02) ----------------
  on('zpopcorn:player.capability', () => {}, () => S.player.capability());
  on('zpopcorn:player.open', (ref) => { ref && json(ref); }, (ref, opts) => S.player.open(ref, opts));
  on('zpopcorn:player.close', () => {}, () => S.player.close());
  on('zpopcorn:player.command', (name) => str(name), (name, ...args) => S.player.command(name, ...args));
  on('zpopcorn:player.getState', () => {}, () => S.player.getState());

  // bind broadcast helper for handlers that need raw event pushes
  void broadcast;
  return h;
}
