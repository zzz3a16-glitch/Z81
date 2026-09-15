/**
 * Electron Preload Script - Secure IPC Bridge - Production Grade
 * Implements secure context isolation and validates all IPC
 */

const { contextBridge, ipcRenderer } = require('electron');

// Allowed channels for security
const ALLOWED_INVOKE_CHANNELS = [
  'play-media',
  'player-command',
  'player-get-property',
  'select-folder',
  'select-files',
  'get-app-info',
  'get-mpv-status',
  'check-file-exists'
];

const ALLOWED_RECEIVE_CHANNELS = [
  'player-event',
  'mpv-event',
  'watch-party-event',
  'scanner-progress',
  'notification'
];

// Secure wrapper with validation
function secureInvoke(channel, ...args) {
  if (!ALLOWED_INVOKE_CHANNELS.includes(channel)) {
    console.error(`Blocked invoke to disallowed channel: ${channel}`);
    return Promise.reject(new Error(`Channel not allowed: ${channel}`));
  }
  return ipcRenderer.invoke(channel, ...args);
}

function secureOn(channel, callback) {
  if (!ALLOWED_RECEIVE_CHANNELS.includes(channel)) {
    console.error(`Blocked listener on disallowed channel: ${channel}`);
    return;
  }
  
  const wrappedCallback = (event, ...args) => {
    try {
      callback(...args);
    } catch (e) {
      console.error(`Error in ${channel} listener:`, e);
    }
  };
  
  ipcRenderer.on(channel, wrappedCallback);
  
  // Return unsubscribe function
  return () => {
    ipcRenderer.removeListener(channel, wrappedCallback);
  };
}

// Expose protected methods with validation
contextBridge.exposeInMainWorld('electronAPI', {
  // Media playback - mpv JSON IPC
  playMedia: (options) => {
    if (!options || !options.path) {
      return Promise.reject(new Error('Invalid media options'));
    }
    // Validate path doesn't contain traversal
    if (options.path.includes('..')) {
      return Promise.reject(new Error('Invalid path'));
    }
    return secureInvoke('play-media', options);
  },
  
  playerCommand: (command, ...args) => {
    if (!command || typeof command !== 'string') {
      return Promise.reject(new Error('Invalid command'));
    }
    return secureInvoke('player-command', command, ...args);
  },

  playerGetProperty: (property) => {
    if (!property || typeof property !== 'string') {
      return Promise.reject(new Error('Invalid property'));
    }
    return secureInvoke('player-get-property', property);
  },
  
  // File system with validation
  selectFolder: () => secureInvoke('select-folder'),
  
  selectFiles: (options) => {
    // Validate options
    if (options && options.filters) {
      if (!Array.isArray(options.filters)) {
        return Promise.reject(new Error('Invalid filters'));
      }
    }
    return secureInvoke('select-files', options);
  },

  checkFileExists: (filePath) => {
    if (!filePath || typeof filePath !== 'string') {
      return Promise.reject(new Error('Invalid file path'));
    }
    return secureInvoke('check-file-exists', filePath);
  },
  
  // App info
  getAppInfo: () => secureInvoke('get-app-info'),
  getMpvStatus: () => secureInvoke('get-mpv-status'),
  
  // Events - secure listeners
  onPlayerEvent: (callback) => secureOn('player-event', callback),
  onMpvEvent: (callback) => secureOn('mpv-event', callback),
  onWatchPartyEvent: (callback) => secureOn('watch-party-event', callback),
  onScannerProgress: (callback) => secureOn('scanner-progress', callback),
  onNotification: (callback) => secureOn('notification', callback),
  
  // Remove listeners
  removeAllListeners: (channel) => {
    if (!ALLOWED_RECEIVE_CHANNELS.includes(channel) && !ALLOWED_INVOKE_CHANNELS.includes(channel)) {
      console.error(`Blocked removeAllListeners for disallowed channel: ${channel}`);
      return;
    }
    ipcRenderer.removeAllListeners(channel);
  },

  removeListener: (channel, callback) => {
    ipcRenderer.removeListener(channel, callback);
  },

  // Platform info (safe)
  platform: process.platform,
  isElectron: true,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  }
});

// Security: Harden renderer
window.addEventListener('DOMContentLoaded', () => {
  // Remove node globals
  try {
    delete window.require;
    delete window.exports;
    delete window.module;
    delete window.global;
    delete window.Buffer;
    delete window.process;
  } catch {}

  // Prevent prototype pollution
  Object.freeze(Object.prototype);
  
  // Log security ready
  console.log('🔒 Secure IPC bridge ready');
});

// Block dangerous globals
try {
  Object.defineProperty(window, 'eval', {
    value: () => { throw new Error('eval blocked for security'); },
    writable: false,
    configurable: false
  });
} catch {}

// Expose minimal safe info
contextBridge.exposeInMainWorld('zPopcornEnv', {
  isElectron: true,
  platform: process.platform,
  isDev: process.env.NODE_ENV === 'development'
});
