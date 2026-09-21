/**
 * Window management — native window, persisted bounds/state, application menu,
 * navigation accelerators, security guards (spec 52/68).
 */
import { app, BrowserWindow, Menu, shell, session } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

const isWin = process.platform === 'win32';

export function loadWindowState(paths) {
  try {
    const raw = JSON.parse(fs.readFileSync(paths.windowState, 'utf8'));
    if (Number.isInteger(raw.width) && Number.isInteger(raw.height)) return raw;
  } catch { /* first launch */ }
  return { width: 1440, height: 900, maximized: false };
}

export function saveWindowState(paths, win) {
  try {
    const b = win.getBounds();
    fs.writeFileSync(paths.windowState, JSON.stringify({
      width: b.width, height: b.height, x: b.x, y: b.y,
      maximized: win.isMaximized(), fullscreen: win.isFullScreen(),
    }));
  } catch { /* ignore */ }
}

export function createMainWindow({ isDev, paths, log, onWindowClosed }) {
  const state = loadWindowState(paths);
  const win = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: Number.isInteger(state.x) ? state.x : undefined,
    y: Number.isInteger(state.y) ? state.y : undefined,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    backgroundColor: '#0a0a0f',
    autoHideMenuBar: false,
    title: 'zPopcorn',
    icon: path.join(app.getAppPath(), 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(import.meta.dirname, '..', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,           // preload needs require() for the typed bridge only
      webSecurity: true,
      spellcheck: false,
      devTools: true,
      zoomFactor: 1.0,
    },
  });

  if (state.maximized) win.maximize();
  if (state.fullscreen) win.setFullScreen(true);

  win.once('ready-to-show', () => {
    win.show();
    log.info('window', 'main window shown');
  });

  // --- navigation guards ---
  const devOrigin = 'http://localhost:5173';
  win.webContents.on('will-navigate', (e, url) => {
    const ok = isDev
      ? url.startsWith(devOrigin)
      : url.startsWith('file:');
    if (!ok) {
      e.preventDefault();
      log.warn('window', `blocked navigation to ${url}`);
    }
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'https:') shell.openExternal(url);
    } catch { /* deny */ }
    return { action: 'deny' };
  });

  win.on('close', () => saveWindowState(paths, win));
  win.on('closed', () => { onWindowClosed?.(); });
  ['resize', 'maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen'].forEach((ev) => {
    win.on(ev, () => {
      win.webContents.send('zpopcorn:event:window-state', {
        maximized: win.isMaximized(),
        fullscreen: win.isFullScreen(),
      });
      saveWindowState(paths, win);
    });
  });

  buildMenu(win, isDev);
  return win;
}

function buildMenu(win, isDev) {
  const template = [
    {
      label: 'الملف',
      submenu: [
        { role: 'reload', label: 'إعادة التحميل' },
        { role: 'forceReload', label: 'إعادة تحميل قسرية' },
        { type: 'separator' },
        { label: 'العودة', accelerator: 'Alt+Left', click: () => win.webContents.canGoBack() && win.webContents.goBack() },
        { label: 'الأمام', accelerator: 'Alt+Right', click: () => win.webContents.canGoForward() && win.webContents.goForward() },
        { type: 'separator' },
        isWin
          ? { role: 'quit', label: 'خروج', accelerator: 'Ctrl+Q' }
          : { role: 'close', label: 'إغلاق' },
      ],
    },
    {
      label: 'تحرير',
      submenu: [
        { role: 'undo', label: 'تراجع' },
        { role: 'redo', label: 'إعادة' },
        { type: 'separator' },
        { role: 'cut', label: 'قص' },
        { role: 'copy', label: 'نسخ' },
        { role: 'paste', label: 'لصق' },
        { role: 'selectAll', label: 'تحديد الكل' },
      ],
    },
    {
      label: 'عرض',
      submenu: [
        { role: 'zoomIn', label: 'تكبير' },
        { role: 'zoomOut', label: 'تصغير' },
        { role: 'resetZoom', label: 'حجم طبيعي' },
        { type: 'separator' },
        { label: 'ملء الشاشة', accelerator: 'F11', click: () => win.setFullScreen(!win.isFullScreen()) },
        ...(isDev ? [{ type: 'separator' }, { role: 'toggleDevTools', label: 'أدوات المطور' }] : []),
      ],
    },
    {
      label: 'تنقّل',
      submenu: [
        { label: 'الرئيسية', accelerator: 'Alt+Home', click: () => win.webContents.send('zpopcorn:event:navigate', '/') },
        { label: 'بحث', accelerator: 'Ctrl+K', click: () => win.webContents.send('zpopcorn:event:navigate', '/search') },
        { label: 'المكتبة', accelerator: 'Ctrl+L', click: () => win.webContents.send('zpopcorn:event:navigate', '/library') },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/** Renderer-facing CSP is enforced via meta tag injected at build (see vite.config). */
export function hardenSession() {
  const ses = session.defaultSession;
  ses.setPermissionRequestHandler((_wc, permission, callback) => {
    // Desktop app needs none of these; deny by default.
    const allowed = new Set([]);
    callback(allowed.has(permission));
  });
}
