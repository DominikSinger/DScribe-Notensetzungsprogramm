// PATH: src/preload.js
// DScribe - Preload Script
// Exposes safe APIs to the renderer process

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  // Settings API
  settings: {
    get: (key, defaultValue) => ipcRenderer.invoke('settings:get', key, defaultValue),
    set: (key, value) => ipcRenderer.invoke('settings:set', key, value),
    getAll: () => ipcRenderer.invoke('settings:getAll')
  },

  // Logging API
  log: {
    info: (message) => ipcRenderer.send('log:info', message),
    error: (message) => ipcRenderer.send('log:error', message),
    warn: (message) => ipcRenderer.send('log:warn', message)
  },

  // Project API
  project: {
    save: (projectData) => ipcRenderer.invoke('project:save', projectData),
    load: (filePath) => ipcRenderer.invoke('project:load', filePath),
    new: () => ipcRenderer.invoke('project:new')
  },

  // Dialog API
  dialog: {
    openFile: (options) => ipcRenderer.invoke('dialog:openFile', options),
    saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options)
  },

  // App API
  app: {
    getPaths: () => ipcRenderer.invoke('app:getPaths'),
    getVersion: () => ipcRenderer.invoke('app:getVersion')
  },

  // Export API (Phase 4)
  export: {
    toPDF: (projectData, outputPath, canvasDataUrl) => 
      ipcRenderer.invoke('export:pdf', projectData, outputPath, canvasDataUrl),
    toPNG: (canvasDataUrl, outputPath) => 
      ipcRenderer.invoke('export:png', canvasDataUrl, outputPath),
    toMIDI: (projectData, outputPath) => 
      ipcRenderer.invoke('export:midi', projectData, outputPath),
    toMusicXML: (projectData, outputPath) => 
      ipcRenderer.invoke('export:musicxml', projectData, outputPath)
  },

  // Import API (Phase 4)
  import: {
    fromMIDI: (filePath) => ipcRenderer.invoke('import:midi', filePath),
    fromMusicXML: (filePath) => ipcRenderer.invoke('import:musicxml', filePath)
  },

  // Menu actions listener
  onMenuAction: (callback) => {
    ipcRenderer.on('menu-action', (event, action, ...args) => callback(action, ...args));
  }
});
