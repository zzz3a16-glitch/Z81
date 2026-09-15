/**
 * Electron Preload Script - Secure IPC Bridge
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods
contextBridge.exposeInMainWorld('electronAPI', {
  // Media playback
  playMedia: (options) => ipcRenderer.invoke('play-media', options),
  playerCommand: (command, ...args) => ipcRenderer.invoke('player-command', command, ...args),
  
  // File system
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  selectFiles: (options) => ipcRenderer.invoke('select-files', options),
  
  // App info
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  
  // Events
  onPlayerEvent: (callback) => {
    ipcRenderer.on('player-event', (event, data) => callback(data));
  },
  
  onMpvEvent: (callback) => {
    ipcRenderer.on('mpv-event', (event, data) => callback(data));
  },
  
  // Remove listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});

// Security: Disable node integration in renderer
window.addEventListener('DOMContentLoaded', () => {
  // Remove any node globals that might have leaked
  delete window.require;
  delete window.exports;
  delete window.module;
});
