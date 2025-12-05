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
      ipcRenderer.invoke('export:musicxml', projectData, outputPath),
    toMP3: (projectData, outputPath, audioBufferData) => 
      ipcRenderer.invoke('export:mp3', projectData, outputPath, audioBufferData)
  },

  // Import API (Phase 4)
  import: {
    fromMIDI: (filePath) => ipcRenderer.invoke('import:midi', filePath),
    fromMusicXML: (filePath) => ipcRenderer.invoke('import:musicxml', filePath)
  },

  // Plugin API (Phase 8)
  plugins: {
    getAll: () => ipcRenderer.invoke('plugins:getAll'),
    load: () => ipcRenderer.invoke('plugins:load'),
    enable: (pluginId) => ipcRenderer.invoke('plugins:enable', pluginId),
    disable: (pluginId) => ipcRenderer.invoke('plugins:disable', pluginId),
    unload: (pluginId) => ipcRenderer.invoke('plugins:unload', pluginId),
    install: (packagePath) => ipcRenderer.invoke('plugins:install', packagePath)
  },

  // OMR API (Phase 8)
  omr: {
    recognize: (filePath) => ipcRenderer.invoke('omr:recognize', filePath),
    recognizePDF: (pdfPath) => ipcRenderer.invoke('omr:recognizePDF', pdfPath),
    getCapabilities: () => ipcRenderer.invoke('omr:getCapabilities')
  },

  // Soundfont API (Phase 8)
  soundfonts: {
    getAll: () => ipcRenderer.invoke('soundfonts:getAll'),
    load: () => ipcRenderer.invoke('soundfonts:load'),
    activate: (soundfontId) => ipcRenderer.invoke('soundfonts:activate', soundfontId),
    deactivate: (soundfontId) => ipcRenderer.invoke('soundfonts:deactivate', soundfontId),
    import: (sourcePath) => ipcRenderer.invoke('soundfonts:import', sourcePath),
    remove: (soundfontId) => ipcRenderer.invoke('soundfonts:remove', soundfontId),
    getInfo: (soundfontId) => ipcRenderer.invoke('soundfonts:getInfo', soundfontId),
    getRecommended: () => ipcRenderer.invoke('soundfonts:getRecommended')
  },

  // Menu actions listener
  onMenuAction: (callback) => {
    ipcRenderer.on('menu-action', (event, action, ...args) => callback(action, ...args));
  },
  
  // Plugin/Soundfont reload listeners (Phase 8)
  onPluginsReloaded: (callback) => {
    ipcRenderer.on('plugins-reloaded', callback);
  },
  onSoundfontsReloaded: (callback) => {
    ipcRenderer.on('soundfonts-reloaded', callback);
  }
});
