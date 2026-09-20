/**
 * zPopcorn main process entry — production Electron shell.
 *
 * Lifecycle (spec 68): single-instance lock, first-launch data-dir creation,
 * DB open + safe migrations, service container, IPC registry, window,
 * private media protocol, crash logging, clean shutdown.
 *
 * NO playback engine exists in this phase (spec 02): the PlayerService here
 * is an abstraction boundary only.
 */
import { app, BrowserWindow, protocol, session, ipcMain, dialog, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { createContainer } from './services/container.js';
import { buildRegistry } from './ipc/registry.js';
import { createMainWindow, hardenSession } from './window.js';
import { EVENT_ROUTE } from '../shared/channels.cjs';

const APP_ID = 'com.zpopcorn.desktop';
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const DEV_URL = 'http://localhost:5173';

// ---- identity & single instance ----
app.setName('zPopcorn');
if (process.platform === 'win32') {
  // Taskbar grouping + notifications identity (Windows).
  app.setAppUserModelId(APP_ID);
}
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  boot();
}

let S = null;          // container
let mainWindow = null;
let registry = null;

function boot() {
  // Standard + secure private scheme so <img> tags can load cached art.
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'zpopcorn-media',
      privileges: { standard: true, secure: true, supportFetchAPI: false, stream: true },
    },
  ]);

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      mainWindow.webContents.send('zpopcorn:event:navigate', { path: null }); // focus only
    }
  });

  process.on('uncaughtException', (e) => {
    try { S?.log.error('fatal', `uncaught exception: ${e.message}`, e.stack?.slice(0, 800)); } catch { /* last resort */ }
  });
  process.on('unhandledRejection', (e) => {
    try { S?.log.error('fatal', `unhandled rejection: ${e?.message || e}`); } catch { /* last resort */ }
  });

  app.whenReady().then(onReady).catch((e) => {
    try { S?.log.error('startup', `fatal boot error: ${e.message}`); } catch { console.error(e); }
    process.exitCode = 1;
  });
}

async function onReady() {
  // ---- data layout: %APPDATA%\zPopcorn (spec 10) ----
  try {
    S = await createContainer({
    app, shell, dialog,
    windows: () => BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed()),
  });
  } catch (e) {
    fatalStartupDialog(`تعذّر فتح قاعدة البيانات\n${e.message}`);
    app.quit();
    return;
  }
  S.log.info('startup', `zPopcorn ${app.getVersion()} (${isDev ? 'dev' : 'packaged'}) on ${process.platform}/${process.arch}`);

  // ---- database + migrations (spec 13/72) ----
  try {
    const res = await S.db.migrate();
    if (res.applied.length) S.log.info('startup', `migrations applied: ${res.applied.join(', ')}`);
    // Reindex FTS after first migration or when index is empty
    const ftsCount = S.db.get('SELECT COUNT(*) n FROM work_fts').n;
    const docCount = S.db.get("SELECT COUNT(*) n FROM doc_store WHERE store IN ('movies','tvshows')").n;
    if (res.applied.length || (ftsCount === 0 && docCount > 0)) S.library.reindexAll();
  } catch (e) {
    S.log.error('startup', `database migration failed: ${e.message}`);
    fatalStartupDialog(`خطأ في قاعدة البيانات أثناء التهيئة:\n${e.message}`);
    app.quit();
    return;
  }

  hardenSession();

  // ---- IPC registry ----
  const broadcast = (channel, payload) => {
    for (const w of BrowserWindow.getAllWindows()) {
      if (!w.isDestroyed()) w.webContents.send(channel, payload);
    }
  };
  registry = buildRegistry(S, broadcast);
  for (const [channel, def] of registry.entries()) {
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel, async (event, ...args) => {
      try {
        def.validate?.(...args);
        const result = await def.handler(...args, event);
        return { ok: true, result: result === undefined ? null : result };
      } catch (err) {
        S.log.warn('ipc', `${channel} -> ${err.code || ''} ${err.message}`);
        return { ok: false, error: { code: err.code || 'E_IPC', message: err.message || 'IPC failure' } };
      }
    });
  }
  S.log.info('ipc', `${registry.size} channels registered`);

  // ---- internal bus -> renderer events (throttled) ----
  for (const [name, channel] of Object.entries(EVENT_ROUTE)) {
    let pending = null;
    S.events.on(name, (payload) => {
      if (pending) return;
      pending = setImmediate(() => { pending = null; broadcast(channel, { name, payload, at: Date.now() }); });
    });
  }

  // ---- media protocol: zpopcorn-media://image/<category>/<size>/<path> ----
  protocol.handle('zpopcorn-media', async (request) => {
    const parsed = ImageURL.parse(request.url);
    if (!parsed) return new Response('bad request', { status: 400 });
    const file = await S.images.ensure(parsed);
    if (!file || !fs.existsSync(file)) return new Response('not found', { status: 404 });
    const ext = path.extname(file).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : ext === '.gif' ? 'image/gif' : 'image/jpeg';
    const buf = fs.readFileSync(file);
    return new Response(buf, {
      status: 200,
      headers: {
        'content-type': mime,
        'content-length': String(buf.length),
        'cache-control': 'public, max-age=604800, immutable',
      },
    });
  });

  // ---- window ----
  mainWindow = createMainWindow({
    isDev,
    paths: S.paths,
    log: S.log,
    onWindowClosed: () => { mainWindow = null; },
  });
  globalThis.__zpopcornWindow = mainWindow;

  if (isDev) {
    await mainWindow.loadURL(DEV_URL);
  } else {
    await mainWindow.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    globalThis.__zpopcornWindow = null;
  });

  // ---- background: first health audit + optional auto-scan ----
  setTimeout(() => {
    S.health.run({ checkFiles: true }).catch((e) => S.log.warn('startup', `initial health run failed: ${e.message}`));
    if (S.settings.get('autoScanOnLaunch')) {
      S.imports.scanAll().catch((e) => S.log.warn('startup', `auto scan failed: ${e.message}`));
    }
  }, 3500);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow({ isDev, paths: S.paths, log: S.log });
      if (isDev) mainWindow.loadURL(DEV_URL);
      else mainWindow.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'));
    }
  });
}

const ImageURL = {
  parse(raw) {
    try {
      const u = new URL(raw);
      if (u.protocol !== 'zpopcorn-media:') return null;
      const parts = (u.host + u.pathname).split('/').filter(Boolean);
      if (parts.length < 4 || parts[0] !== 'image') return null;
      const [ , category, size, ...rest] = parts;
      return { category, size, path: '/' + rest.join('/') };
    } catch { return null; }
  },
};

function fatalStartupDialog(message) {
  try {
    dialog.showErrorBox('zPopcorn — خطأ في التشغيل', message + '\n\nالملفات لم تُحذف — أعد التشغيل بعد الإصلاح.');
  } catch {
    console.error(message);
  }
}

app.on('window-all-closed', () => {
  try { S?.log.info('shutdown', 'all windows closed'); } catch { /* ignore */ }
  try { S?.db.close(); } catch { /* ignore */ }
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  try { S?.db.close(); } catch { /* ignore */ }
});
