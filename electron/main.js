/**
 * Electron Main Process - Professional Media Intelligence Platform
 */

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

// Keep reference to windows
let mainWindow;
let mpvProcess = null;
let watchPartyServer = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

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
      allowRunningInsecureContent: false
    },
    icon: path.join(__dirname, '../public/favicon.png')
  });

  // Load app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Show when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    if (process.platform === 'darwin') {
      app.dock.setIcon(path.join(__dirname, '../public/favicon.png'));
    }
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
    cleanupMpv();
  });
}

// MPV Integration
function spawnMpv(ipcSocketPath) {
  try {
    const mpvArgs = [
      '--idle=yes',
      '--force-window=yes',
      '--keep-open=yes',
      `--input-ipc-server=${ipcSocketPath}`,
      '--no-terminal',
      '--msg-level=all=no'
    ];

    mpvProcess = spawn('mpv', mpvArgs, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    mpvProcess.stdout.on('data', (data) => {
      console.log(`mpv stdout: ${data}`);
    });

    mpvProcess.stderr.on('data', (data) => {
      console.error(`mpv stderr: ${data}`);
    });

    mpvProcess.on('close', (code) => {
      console.log(`mpv process exited with code ${code}`);
      mpvProcess = null;
    });

    return mpvProcess;
  } catch (error) {
    console.error('Failed to spawn mpv:', error);
    return null;
  }
}

function cleanupMpv() {
  if (mpvProcess) {
    mpvProcess.kill();
    mpvProcess = null;
  }
}

// IPC Handlers
ipcMain.handle('play-media', async (event, { path: mediaPath, position = 0, mediaId }) => {
  try {
    if (!fs.existsSync(mediaPath)) {
      throw new Error('File not found');
    }

    // In production, this would communicate with mpv via IPC
    // For now, return success
    return { success: true, path: mediaPath, position };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('player-command', async (event, command, ...args) => {
  // Forward command to mpv via IPC
  // Implementation would use mpv JSON IPC
  console.log('Player command:', command, args);
  return { success: true };
});

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  
  if (!result.canceled) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('select-files', async (event, options = {}) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: options.filters || [
      { name: 'Media Files', extensions: ['mp4', 'mkv', 'avi', 'mov', 'mp3', 'flac', 'm4a'] }
    ]
  });
  
  if (!result.canceled) {
    return result.filePaths;
  }
  return [];
});

ipcMain.handle('get-app-info', () => {
  return {
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    isDev,
    paths: {
      userData: app.getPath('userData'),
      documents: app.getPath('documents'),
      videos: app.getPath('videos')
    }
  };
});

// App lifecycle
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  cleanupMpv();
  
  if (watchPartyServer) {
    watchPartyServer.kill();
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  cleanupMpv();
});

// Security
app.on('web-contents-created', (event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    
    if (parsedUrl.origin !== 'http://localhost:5173' && !navigationUrl.startsWith('file://')) {
      event.preventDefault();
    }
  });
});

// Handle protocol for deep linking (optional)
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('zpopcorn', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('zpopcorn');
}
