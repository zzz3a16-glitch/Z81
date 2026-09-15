/**
 * Electron Main Process - Production-Grade Media Intelligence Platform
 * Implements mpv JSON IPC, security, file handling, watch party integration
 */

const { app, BrowserWindow, ipcMain, dialog, shell, protocol } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const net = require('net');

// Keep references
let mainWindow;
let mpvProcess = null;
let mpvSocket = null;
let mpvIpcPath = null;
let watchPartyServer = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const MPV_SOCKET_NAME = process.platform === 'win32' 
  ? '\\\\.\\pipe\\zpopcorn-mpv'
  : path.join(os.tmpdir(), `zpopcorn-mpv-${process.pid}.sock`);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    backgroundColor: '#0a0a0f',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
      allowRunningInsecureContent: false,
      sandbox: true
    },
    icon: path.join(__dirname, '../public/favicon.png')
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (process.platform === 'darwin') {
      try {
        app.dock.setIcon(path.join(__dirname, '../public/favicon.png'));
      } catch {}
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Allow only safe external URLs
    try {
      const parsed = new URL(url);
      if (['https:', 'http:'].includes(parsed.protocol)) {
        shell.openExternal(url);
      }
    } catch {}
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    cleanupMpv();
  });

  // Handle mpv events from renderer
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('✓ Renderer loaded');
  });
}

// MPV JSON IPC Controller - Production Grade
class MpvIpcController {
  constructor(socketPath) {
    this.socketPath = socketPath;
    this.socket = null;
    this.requestId = 0;
    this.pendingRequests = new Map();
    this.eventListeners = [];
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnect = 5;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      if (process.platform === 'win32') {
        this.socket = net.createConnection(this.socketPath);
      } else {
        // Remove old socket if exists
        try {
          if (fs.existsSync(this.socketPath)) {
            fs.unlinkSync(this.socketPath);
          }
        } catch {}
        this.socket = net.createConnection(this.socketPath);
      }

      this.socket.on('connect', () => {
        console.log('✓ mpv IPC connected');
        this.connected = true;
        this.reconnectAttempts = 0;
        resolve();
      });

      this.socket.on('data', (data) => {
        this.handleData(data);
      });

      this.socket.on('error', (err) => {
        console.error('mpv IPC error:', err.message);
        this.connected = false;
        if (this.reconnectAttempts < this.maxReconnect) {
          this.reconnectAttempts++;
          setTimeout(() => this.connect().catch(() => {}), 1000 * this.reconnectAttempts);
        }
      });

      this.socket.on('close', () => {
        console.log('mpv IPC closed');
        this.connected = false;
      });

      setTimeout(() => {
        if (!this.connected) {
          reject(new Error('mpv IPC connection timeout'));
        }
      }, 5000);
    });
  }

  handleData(data) {
    const lines = data.toString().split('\n').filter(Boolean);
    
    for (const line of lines) {
      try {
        const msg = JSON.parse(line);
        
        if (msg.request_id !== undefined) {
          // Response to request
          const pending = this.pendingRequests.get(msg.request_id);
          if (pending) {
            if (msg.error && msg.error !== 'success') {
              pending.reject(new Error(msg.error));
            } else {
              pending.resolve(msg.data);
            }
            this.pendingRequests.delete(msg.request_id);
          }
        } else if (msg.event) {
          // Event from mpv
          this.handleEvent(msg);
        }
      } catch (e) {
        console.warn('Failed to parse mpv message:', line.slice(0, 200));
      }
    }
  }

  handleEvent(event) {
    // Forward to renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('mpv-event', event);
    }
    
    this.eventListeners.forEach(cb => {
      try { cb(event); } catch {}
    });
  }

  async sendCommand(command, ...args) {
    if (!this.connected || !this.socket) {
      throw new Error('mpv not connected');
    }

    const id = ++this.requestId;
    const request = {
      command: [command, ...args],
      request_id: id
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      
      try {
        this.socket.write(JSON.stringify(request) + '\n');
      } catch (e) {
        this.pendingRequests.delete(id);
        reject(e);
      }

      // Timeout
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('mpv command timeout'));
        }
      }, 5000);
    });
  }

  async setProperty(property, value) {
    return this.sendCommand('set_property', property, value);
  }

  async getProperty(property) {
    return this.sendCommand('get_property', property);
  }

  async observeProperty(id, property) {
    return this.sendCommand('observe_property', id, property);
  }

  disconnect() {
    if (this.socket) {
      try {
        this.socket.end();
        this.socket.destroy();
      } catch {}
      this.socket = null;
    }
    this.connected = false;
    this.pendingRequests.clear();
  }
}

let mpvController = null;

function spawnMpv() {
  try {
    // Cleanup old socket
    if (process.platform !== 'win32') {
      try {
        if (fs.existsSync(MPV_SOCKET_NAME)) {
          fs.unlinkSync(MPV_SOCKET_NAME);
        }
      } catch {}
    }

    mpvIpcPath = MPV_SOCKET_NAME;

    const mpvArgs = [
      '--idle=yes',
      '--force-window=yes',
      '--keep-open=yes',
      '--keep-open-pause=no',
      `--input-ipc-server=${mpvIpcPath}`,
      '--no-terminal',
      '--msg-level=all=no',
      '--hwdec=auto',
      '--vo=gpu',
      '--profile=gpu-hq',
      '--sub-auto=fuzzy',
      '--sub-file-paths=.',
      '--audio-display=no',
      '--osd-level=1',
      '--osd-duration=2000',
      '--screenshot-directory=' + path.join(app.getPath('pictures'), 'zPopcorn')
    ];

    console.log('Spawning mpv with args:', mpvArgs.join(' '));

    mpvProcess = spawn('mpv', mpvArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false
    });

    mpvProcess.stdout.on('data', (data) => {
      console.log(`mpv: ${data.toString().trim()}`);
    });

    mpvProcess.stderr.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg) console.error(`mpv stderr: ${msg}`);
    });

    mpvProcess.on('error', (err) => {
      console.error('mpv spawn error:', err);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('mpv-event', { event: 'error', error: err.message });
      }
    });

    mpvProcess.on('close', (code, signal) => {
      console.log(`mpv exited: code=${code} signal=${signal}`);
      mpvProcess = null;
      if (mpvController) {
        mpvController.disconnect();
        mpvController = null;
      }
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('mpv-event', { event: 'shutdown', code, signal });
      }
    });

    // Connect IPC after short delay
    setTimeout(async () => {
      try {
        mpvController = new MpvIpcController(mpvIpcPath);
        await mpvController.connect();
        
        // Observe important properties
        await mpvController.observeProperty(1, 'time-pos').catch(() => {});
        await mpvController.observeProperty(2, 'duration').catch(() => {});
        await mpvController.observeProperty(3, 'pause').catch(() => {});
        await mpvController.observeProperty(4, 'volume').catch(() => {});
        await mpvController.observeProperty(5, 'track-list').catch(() => {});
        
        console.log('✓ mpv IPC ready with observers');
        
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('mpv-event', { event: 'ready' });
        }
      } catch (e) {
        console.warn('mpv IPC connect failed:', e.message);
      }
    }, 1000);

    return mpvProcess;
  } catch (error) {
    console.error('Failed to spawn mpv:', error);
    return null;
  }
}

function cleanupMpv() {
  if (mpvController) {
    mpvController.disconnect();
    mpvController = null;
  }
  
  if (mpvProcess) {
    try {
      mpvProcess.kill('SIGTERM');
      setTimeout(() => {
        if (mpvProcess) {
          try { mpvProcess.kill('SIGKILL'); } catch {}
          mpvProcess = null;
        }
      }, 2000);
    } catch {
      mpvProcess = null;
    }
  }

  // Cleanup socket file
  if (process.platform !== 'win32' && mpvIpcPath) {
    try {
      if (fs.existsSync(mpvIpcPath)) {
        fs.unlinkSync(mpvIpcPath);
      }
    } catch {}
  }
}

// IPC Handlers - Production Grade with Validation
ipcMain.handle('play-media', async (event, { path: mediaPath, position = 0, mediaId, title }) => {
  try {
    // Validate path
    if (!mediaPath || typeof mediaPath !== 'string') {
      throw new Error('Invalid media path');
    }

    // Prevent directory traversal
    if (mediaPath.includes('..') || mediaPath.includes('~')) {
      throw new Error('Invalid path: directory traversal detected');
    }

    if (!fs.existsSync(mediaPath)) {
      throw new Error(`File not found: ${mediaPath}`);
    }

    const stat = fs.statSync(mediaPath);
    if (!stat.isFile()) {
      throw new Error('Path is not a file');
    }

    if (stat.size === 0) {
      throw new Error('File is empty');
    }

    // Ensure mpv is running
    if (!mpvProcess) {
      spawnMpv();
      // Wait a bit for mpv to start
      await new Promise(r => setTimeout(r, 1500));
    }

    if (!mpvController || !mpvController.connected) {
      throw new Error('mpv IPC not ready, try again');
    }

    // Load file via mpv IPC
    await mpvController.sendCommand('loadfile', mediaPath, 'replace');
    
    if (position > 0) {
      await new Promise(r => setTimeout(r, 500));
      await mpvController.setProperty('time-pos', position);
    }

    console.log(`✓ Playing: ${title || path.basename(mediaPath)} at ${position}s`);

    return { 
      success: true, 
      path: mediaPath, 
      position,
      mediaId,
      size: stat.size,
      message: 'Playback started via mpv'
    };
  } catch (error) {
    console.error('play-media failed:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('player-command', async (event, command, ...args) => {
  try {
    if (!command || typeof command !== 'string') {
      throw new Error('Invalid command');
    }

    // Whitelist allowed commands
    const allowedCommands = [
      'play', 'pause', 'stop', 'seek', 'set_property', 'get_property',
      'set', 'cycle', 'frame-step', 'frame-back-step',
      'playlist-next', 'playlist-prev', 'playlist-play-index',
      'sub-add', 'audio-add', 'screenshot',
      'quit'
    ];

    // Map friendly commands to mpv commands
    const commandMap = {
      'play': async () => await mpvController?.setProperty('pause', false),
      'pause': async () => await mpvController?.setProperty('pause', true),
      'toggle': async () => await mpvController?.sendCommand('cycle', 'pause'),
      'stop': async () => await mpvController?.sendCommand('stop'),
      'seek': async (pos) => {
        if (typeof pos === 'number') {
          return await mpvController?.setProperty('time-pos', pos);
        } else if (typeof pos === 'string' && pos.startsWith('+')) {
          return await mpvController?.sendCommand('seek', parseFloat(pos));
        }
        return await mpvController?.setProperty('time-pos', parseFloat(pos));
      },
      'volume': async (vol) => await mpvController?.setProperty('volume', Math.max(0, Math.min(100, vol))),
      'mute': async () => await mpvController?.sendCommand('cycle', 'mute'),
      'fullscreen': async () => await mpvController?.sendCommand('cycle', 'fullscreen'),
      'sub-delay': async (delay) => await mpvController?.setProperty('sub-delay', delay / 1000),
      'audio-delay': async (delay) => await mpvController?.setProperty('audio-delay', delay / 1000),
      'speed': async (speed) => await mpvController?.setProperty('speed', speed),
      'sub-select': async (id) => await mpvController?.setProperty('sid', id),
      'audio-select': async (id) => await mpvController?.setProperty('aid', id)
    };

    if (commandMap[command]) {
      const result = await commandMap[command](...args);
      return { success: true, result };
    }

    if (!allowedCommands.includes(command)) {
      throw new Error(`Command not allowed: ${command}`);
    }

    if (!mpvController || !mpvController.connected) {
      throw new Error('mpv not connected');
    }

    const result = await mpvController.sendCommand(command, ...args);
    return { success: true, result };

  } catch (error) {
    console.error(`player-command ${command} failed:`, error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('player-get-property', async (event, property) => {
  try {
    if (!mpvController || !mpvController.connected) {
      throw new Error('mpv not connected');
    }
    const value = await mpvController.getProperty(property);
    return { success: true, value };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'اختر مجلد المكتبة'
  });
  
  if (!result.canceled && result.filePaths[0]) {
    // Validate path
    const selected = result.filePaths[0];
    try {
      const stat = fs.statSync(selected);
      if (!stat.isDirectory()) throw new Error('Not a directory');
      return selected;
    } catch (e) {
      await dialog.showErrorBox('خطأ', `المجلد غير صالح: ${e.message}`);
      return null;
    }
  }
  return null;
});

ipcMain.handle('select-files', async (event, options = {}) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    title: 'اختر ملفات الوسائط',
    filters: options.filters || [
      { name: 'Video Files', extensions: ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v'] },
      { name: 'Audio Files', extensions: ['mp3', 'flac', 'm4a', 'wav', 'aac', 'ogg'] },
      { name: 'All Media', extensions: ['mp4', 'mkv', 'avi', 'mov', 'mp3', 'flac', 'm4a'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  
  if (!result.canceled) {
    // Validate each file
    const validFiles = [];
    for (const filePath of result.filePaths) {
      try {
        const stat = fs.statSync(filePath);
        if (stat.isFile() && stat.size > 0) {
          validFiles.push(filePath);
        }
      } catch {}
    }
    return validFiles;
  }
  return [];
});

ipcMain.handle('get-app-info', () => {
  return {
    version: app.getVersion(),
    name: app.getName(),
    platform: process.platform,
    arch: process.arch,
    isDev,
    isPackaged: app.isPackaged,
    mpvAvailable: !!mpvProcess,
    mpvConnected: !!(mpvController && mpvController.connected),
    paths: {
      userData: app.getPath('userData'),
      documents: app.getPath('documents'),
      videos: app.getPath('videos'),
      pictures: app.getPath('pictures'),
      temp: app.getPath('temp'),
      home: app.getPath('home')
    },
    system: {
      cpus: os.cpus().length,
      totalMem: os.totalmem(),
      freeMem: os.freemem(),
      uptime: os.uptime()
    }
  };
});

ipcMain.handle('get-mpv-status', () => {
  return {
    running: !!mpvProcess,
    connected: !!(mpvController && mpvController.connected),
    socketPath: mpvIpcPath,
    pid: mpvProcess?.pid || null
  };
});

ipcMain.handle('check-file-exists', async (event, filePath) => {
  try {
    if (!filePath || filePath.includes('..')) return { exists: false, error: 'Invalid path' };
    const exists = fs.existsSync(filePath);
    if (!exists) return { exists: false };
    
    const stat = fs.statSync(filePath);
    return { 
      exists: true, 
      isFile: stat.isFile(),
      size: stat.size,
      mtime: stat.mtimeMs
    };
  } catch (e) {
    return { exists: false, error: e.message };
  }
});

// App lifecycle
app.whenReady().then(() => {
  // Security: handle protocol
  protocol.registerFileProtocol('zpopcorn', (request, callback) => {
    const url = request.url.substr(9); // Remove 'zpopcorn://'
    callback({ path: path.normalize(`${__dirname}/${url}`) });
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  // Auto-start mpv in background (optional)
  if (process.env.AUTO_START_MPV === 'true') {
    setTimeout(() => spawnMpv(), 2000);
  }
});

app.on('window-all-closed', () => {
  cleanupMpv();
  
  if (watchPartyServer) {
    try { watchPartyServer.kill(); } catch {}
    watchPartyServer = null;
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  cleanupMpv();
});

app.on('will-quit', () => {
  cleanupMpv();
});

// Security hardening
app.on('web-contents-created', (event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    try {
      const parsedUrl = new URL(navigationUrl);
      const allowedOrigins = [
        'http://localhost:5173',
        'http://localhost:3000',
        'file://'
      ];
      
      const isAllowed = allowedOrigins.some(origin => 
        navigationUrl.startsWith(origin) || parsedUrl.origin === origin
      );
      
      if (!isAllowed) {
        console.warn(`Blocked navigation to: ${navigationUrl}`);
        event.preventDefault();
      }
    } catch {
      event.preventDefault();
    }
  });

  contents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });

  // Block new windows except allowed
  contents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (['https:', 'http:'].includes(parsed.protocol)) {
        shell.openExternal(url);
      }
    } catch {}
    return { action: 'deny' };
  });
});

// Handle protocol for deep linking
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('zpopcorn', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('zpopcorn');
}

// Graceful shutdown
process.on('SIGTERM', () => {
  cleanupMpv();
  app.quit();
});

process.on('SIGINT', () => {
  cleanupMpv();
  app.quit();
});

// Export for testing
module.exports = { spawnMpv, cleanupMpv, MpvIpcController };
