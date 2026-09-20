/**
 * zPopcorn IPC Contract — single source of truth (CommonJS so the preload
 * can require it directly; main imports the same object).
 *
 * Every renderer-facing capability MUST be declared here. The preload script
 * exposes only what is listed; the main process only answers channels
 * present in this manifest. Unknown channels are rejected at both layers.
 *
 * Namespaces mirror the product spec (section 07):
 *   window.zpopcorn.library | files | database | settings | metadata | system | player
 * plus operational namespaces: cache | backup | favorites | history | collections |
 * inbox | health | duplicates.
 */

const IPC_VERSION = 1;

/** invoke/handle channels grouped by namespace. renderer method name -> channel */
const INVOKE_CHANNELS = {
  system: {
    getInfo: 'zpopcorn:system.getInfo',
    getDiagnostics: 'zpopcorn:system.getDiagnostics',
    getPaths: 'zpopcorn:system.getPaths',
    pickFolder: 'zpopcorn:system.pickFolder',
    pickFiles: 'zpopcorn:system.pickFiles',
    openExternal: 'zpopcorn:system.openExternal',
    showItemInFolder: 'zpopcorn:system.showItemInFolder',
    windowControl: 'zpopcorn:system.windowControl',
    toggleDevTools: 'zpopcorn:system.toggleDevTools',
    restart: 'zpopcorn:system.restart',
    quit: 'zpopcorn:system.quit',
    getLogs: 'zpopcorn:system.getLogs',
    clearLogs: 'zpopcorn:system.clearLogs',
  },
  settings: {
    getAll: 'zpopcorn:settings.getAll',
    get: 'zpopcorn:settings.get',
    set: 'zpopcorn:settings.set',
    setMany: 'zpopcorn:settings.setMany',
    remove: 'zpopcorn:settings.remove',
    syncLegacy: 'zpopcorn:settings.syncLegacy',
  },
  files: {
    stat: 'zpopcorn:files.stat',
    exists: 'zpopcorn:files.exists',
    getDrives: 'zpopcorn:files.getDrives',
    listDir: 'zpopcorn:files.listDir',
  },
  database: {
    // Generic document-store facade (legacy IndexedDB contract, now SQLite-backed)
    get: 'zpopcorn:db.get',
    getAll: 'zpopcorn:db.getAll',
    getByIndex: 'zpopcorn:db.getByIndex',
    put: 'zpopcorn:db.put',
    add: 'zpopcorn:db.add',
    delete: 'zpopcorn:db.delete',
    clear: 'zpopcorn:db.clear',
    count: 'zpopcorn:db.count',
    stats: 'zpopcorn:db.stats',
    exportAll: 'zpopcorn:db.exportAll',
    importLegacy: 'zpopcorn:db.importLegacy',
  },
  library: {
    search: 'zpopcorn:library.search',
    list: 'zpopcorn:library.list',
    get: 'zpopcorn:library.get',
    upsert: 'zpopcorn:library.upsert',
    remove: 'zpopcorn:library.remove',
    stats: 'zpopcorn:library.stats',
    setFlags: 'zpopcorn:library.setFlags',
    listMediaFiles: 'zpopcorn:library.listMediaFiles',
    editionsFor: 'zpopcorn:library.editionsFor',
    upsertEdition: 'zpopcorn:library.upsertEdition',
    removeMediaFile: 'zpopcorn:library.removeMediaFile',
    relinkMediaFile: 'zpopcorn:library.relinkMediaFile',
    listSources: 'zpopcorn:library.listSources',
    addSource: 'zpopcorn:library.addSource',
    removeSource: 'zpopcorn:library.removeSource',
    createSnapshot: 'zpopcorn:library.createSnapshot',
    listSnapshots: 'zpopcorn:library.listSnapshots',
  },
  metadata: {
    request: 'zpopcorn:metadata.request',
    search: 'zpopcorn:metadata.search',
    trending: 'zpopcorn:metadata.trending',
    discover: 'zpopcorn:metadata.discover',
    details: 'zpopcorn:metadata.details',
    credits: 'zpopcorn:metadata.credits',
    videos: 'zpopcorn:metadata.videos',
    images: 'zpopcorn:metadata.images',
    recommendations: 'zpopcorn:metadata.recommendations',
    similar: 'zpopcorn:metadata.similar',
    watchProviders: 'zpopcorn:metadata.watchProviders',
    collection: 'zpopcorn:metadata.collection',
    season: 'zpopcorn:metadata.season',
    episode: 'zpopcorn:metadata.episode',
    person: 'zpopcorn:metadata.person',
    genres: 'zpopcorn:metadata.genres',
    status: 'zpopcorn:metadata.status',
    getImageConfig: 'zpopcorn:metadata.getImageConfig',
  },
  cache: {
    stats: 'zpopcorn:cache.stats',
    clear: 'zpopcorn:cache.clear',
  },
  favorites: {
    list: 'zpopcorn:favorites.list',
    toggle: 'zpopcorn:favorites.toggle',
    add: 'zpopcorn:favorites.add',
    remove: 'zpopcorn:favorites.remove',
    has: 'zpopcorn:favorites.has',
  },
  history: {
    record: 'zpopcorn:history.record',
    list: 'zpopcorn:history.list',
    stats: 'zpopcorn:history.stats',
    clear: 'zpopcorn:history.clear',
    continueWatching: 'zpopcorn:history.continueWatching',
    setProgress: 'zpopcorn:history.setProgress',
    getProgress: 'zpopcorn:history.getProgress',
  },
  collections: {
    list: 'zpopcorn:collections.list',
    create: 'zpopcorn:collections.create',
    update: 'zpopcorn:collections.update',
    remove: 'zpopcorn:collections.remove',
    addItem: 'zpopcorn:collections.addItem',
    removeItem: 'zpopcorn:collections.removeItem',
    items: 'zpopcorn:collections.items',
    evaluateRules: 'zpopcorn:collections.evaluateRules',
  },
  inbox: {
    list: 'zpopcorn:inbox.list',
    stats: 'zpopcorn:inbox.stats',
    scan: 'zpopcorn:inbox.scan',
    stopScan: 'zpopcorn:inbox.stopScan',
    confirm: 'zpopcorn:inbox.confirm',
    confirmMany: 'zpopcorn:inbox.confirmMany',
    ignore: 'zpopcorn:inbox.ignore',
    defer: 'zpopcorn:inbox.defer',
    update: 'zpopcorn:inbox.update',
    rematch: 'zpopcorn:inbox.rematch',
    clearResolved: 'zpopcorn:inbox.clearResolved',
  },
  health: {
    run: 'zpopcorn:health.run',
    list: 'zpopcorn:health.list',
    stats: 'zpopcorn:health.stats',
    dismiss: 'zpopcorn:health.dismiss',
    relink: 'zpopcorn:health.relink',
    removeRecord: 'zpopcorn:health.removeRecord',
  },
  duplicates: {
    scan: 'zpopcorn:duplicates.scan',
    list: 'zpopcorn:duplicates.list',
    review: 'zpopcorn:duplicates.review',
    merge: 'zpopcorn:duplicates.merge',
    stats: 'zpopcorn:duplicates.stats',
  },
  backup: {
    create: 'zpopcorn:backup.create',
    list: 'zpopcorn:backup.list',
    restore: 'zpopcorn:backup.restore',
    validate: 'zpopcorn:backup.validate',
    remove: 'zpopcorn:backup.remove',
    status: 'zpopcorn:backup.status',
    exportLegacy: 'zpopcorn:backup.exportLegacy',
    importLegacy: 'zpopcorn:backup.importLegacy',
  },
  live: {
    // IPTV plumbing: main owns network + external launch (renderer never touches sockets).
    fetchText: 'zpopcorn:live.fetchText',
    launch: 'zpopcorn:live.launch',
    logoPath: 'zpopcorn:live.logoPath',
    purge: 'zpopcorn:live.purge',
    endSession: 'zpopcorn:live.endSession',
  },
  player: {
    // Abstraction only this phase — see spec section 02 / 73. NO engine installed.
    capability: 'zpopcorn:player.capability',
    open: 'zpopcorn:player.open',
    close: 'zpopcorn:player.close',
    command: 'zpopcorn:player.command',
    getState: 'zpopcorn:player.getState',
  },
};

/** main -> renderer push events */
const EVENT_CHANNELS = [
  'zpopcorn:event:settings-changed',
  'zpopcorn:event:library-changed',
  'zpopcorn:event:scan-progress',
  'zpopcorn:event:inbox-changed',
  'zpopcorn:event:health-changed',
  'zpopcorn:event:backup-progress',
  'zpopcorn:event:window-state',
  'zpopcorn:event:toast',
  'zpopcorn:event:tmdb-status',
  'zpopcorn:event:navigate',
];

/** internal event-bus name -> renderer event channel */
const EVENT_ROUTE = {
  'settings:changed': 'zpopcorn:event:settings-changed',
  'library:changed': 'zpopcorn:event:library-changed',
  'scan:progress': 'zpopcorn:event:scan-progress',
  'inbox:changed': 'zpopcorn:event:inbox-changed',
  'health:changed': 'zpopcorn:event:health-changed',
  'backup:progress': 'zpopcorn:event:backup-progress',
  'toast': 'zpopcorn:event:toast',
  'tmdb:status': 'zpopcorn:event:tmdb-status',
  'navigate': 'zpopcorn:event:navigate',
};

const STORE_NAMES = [
  'movies', 'tvshows', 'episodes', 'people', 'watchHistory', 'watchProgress',
  'favorites', 'watchlists', 'watchlistItems', 'ratings', 'behaviorEvents',
  'tasteProfile', 'notifications', 'settings', 'metadata',
  // LIVE platform (spec 04–12): sources registry, parsed playlists, favorites,
  // watch history, EPG cache (one doc per source+day). All local-first.
  'live_sources', 'live_playlists', 'live_favs', 'live_history', 'live_epg',
];

const MASKED_SETTING_KEYS = ['tmdbApiKey'];

/**
 * Build the flat list of all legal invoke channels.
 * @returns {string[]}
 */
function allInvokeChannels() {
  const out = [];
  for (const ns of Object.values(INVOKE_CHANNELS)) for (const ch of Object.values(ns)) out.push(ch);
  return out;
}

module.exports = {
  IPC_VERSION,
  INVOKE_CHANNELS,
  EVENT_CHANNELS,
  EVENT_ROUTE,
  STORE_NAMES,
  MASKED_SETTING_KEYS,
  allInvokeChannels,
};
