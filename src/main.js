// PATH: src/main.js
// DScribe - Electron Main Process
// Entry point for the Electron application

const { app, BrowserWindow, ipcMain, Menu, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const logger = require('./modules/logger');
const settingsManager = require('./modules/settings-manager');
const updater = require('./modules/updater');
const projectManager = require('./modules/project-manager');
const ExportManager = require('./modules/export-manager');
const ImportManager = require('./modules/import-manager');
const pluginManager = require('./modules/plugin-manager'); // Phase 8
const omrManager = require('./modules/omr-manager'); // Phase 8
const soundfontManager = require('./modules/soundfont-manager'); // Phase 8

// Global reference to main window
let mainWindow = null;

// User data directories structure
const USER_DATA_PATH = path.join(app.getPath('appData'), 'notensetzungsprogramm', 'notensetzungsprogramm');
const PATHS = {
  userData: USER_DATA_PATH,
  override: path.join(USER_DATA_PATH, 'override'),
  updates: path.join(USER_DATA_PATH, 'updates'),
  backups: path.join(USER_DATA_PATH, 'backups'),
  projects: path.join(USER_DATA_PATH, 'projects'),
  settings: path.join(USER_DATA_PATH, 'settings'),
  logs: path.join(USER_DATA_PATH, 'logs'),
  plugins: path.join(USER_DATA_PATH, 'plugins'),
  soundfonts: path.join(USER_DATA_PATH, 'soundfonts'), // Phase 8
  cache: path.join(USER_DATA_PATH, 'cache'),
  analytics: path.join(USER_DATA_PATH, 'analytics'),
};

// Initialize user directories
async function initializeUserDirectories() {
  try {
    for (const [key, dirPath] of Object.entries(PATHS)) {
      await fs.ensureDir(dirPath);
    }
    logger.info('User directories initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize user directories:', error);
  }
}

// Create main application window
function createMainWindow() {
  const windowState = settingsManager.get('windowState', {
    width: 1400,
    height: 900,
    maximized: false
  });

  mainWindow = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    minWidth: 1024,
    minHeight: 768,
    icon: path.join(__dirname, '../icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    show: false, // Don't show until ready
    backgroundColor: '#ffffff',
    title: 'DScribe - Notensatzprogramm'
  });

  // Load the main HTML file
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    if (windowState.maximized) {
      mainWindow.maximize();
    }
    mainWindow.show();
    logger.info('Main window displayed');
  });

  // Save window state on close
  mainWindow.on('close', () => {
    if (!mainWindow.isMaximized()) {
      const bounds = mainWindow.getBounds();
      settingsManager.set('windowState', {
        width: bounds.width,
        height: bounds.height,
        maximized: false
      });
    } else {
      settingsManager.set('windowState', {
        ...settingsManager.get('windowState'),
        maximized: true
      });
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open DevTools in development mode
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Build and set application menu
  buildApplicationMenu();
}

// Build the complete application menu
function buildApplicationMenu() {
  const template = [
    // Datei Menu
    {
      label: 'Datei',
      submenu: [
        {
          label: 'Neu',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow.webContents.send('menu-action', 'file-new')
        },
        {
          label: 'Öffnen...',
          accelerator: 'CmdOrCtrl+O',
          click: () => mainWindow.webContents.send('menu-action', 'file-open')
        },
        { type: 'separator' },
        {
          label: 'Speichern',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow.webContents.send('menu-action', 'file-save')
        },
        {
          label: 'Speichern unter...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => mainWindow.webContents.send('menu-action', 'file-save-as')
        },
        { type: 'separator' },
        {
          label: 'Import',
          submenu: [
            {
              label: 'PDF importieren...',
              click: () => mainWindow.webContents.send('menu-action', 'import-pdf')
            },
            {
              label: 'MIDI importieren...',
              click: () => mainWindow.webContents.send('menu-action', 'import-midi')
            },
            {
              label: 'MusicXML importieren...',
              click: () => mainWindow.webContents.send('menu-action', 'import-musicxml')
            },
            {
              label: 'Audio importieren (MP3/WAV)...',
              click: () => mainWindow.webContents.send('menu-action', 'import-audio')
            }
          ]
        },
        {
          label: 'Export',
          submenu: [
            {
              label: 'Als PDF exportieren...',
              click: () => mainWindow.webContents.send('menu-action', 'export-pdf')
            },
            {
              label: 'Als MIDI exportieren...',
              click: () => mainWindow.webContents.send('menu-action', 'export-midi')
            },
            {
              label: 'Als MP3 exportieren...',
              click: () => mainWindow.webContents.send('menu-action', 'export-mp3')
            },
            {
              label: 'Als MusicXML exportieren...',
              click: () => mainWindow.webContents.send('menu-action', 'export-musicxml')
            },
            {
              label: 'Als PNG exportieren...',
              click: () => mainWindow.webContents.send('menu-action', 'export-png')
            }
          ]
        },
        { type: 'separator' },
        {
          label: 'Projekt-Eigenschaften...',
          click: () => mainWindow.webContents.send('menu-action', 'project-properties')
        },
        { type: 'separator' },
        {
          label: 'Beenden',
          accelerator: 'CmdOrCtrl+Q',
          click: () => app.quit()
        }
      ]
    },
    // Bearbeiten Menu
    {
      label: 'Bearbeiten',
      submenu: [
        {
          label: 'Rückgängig',
          accelerator: 'CmdOrCtrl+Z',
          click: () => mainWindow.webContents.send('menu-action', 'edit-undo')
        },
        {
          label: 'Wiederherstellen',
          accelerator: 'CmdOrCtrl+Y',
          click: () => mainWindow.webContents.send('menu-action', 'edit-redo')
        },
        { type: 'separator' },
        {
          label: 'Ausschneiden',
          accelerator: 'CmdOrCtrl+X',
          click: () => mainWindow.webContents.send('menu-action', 'edit-cut')
        },
        {
          label: 'Kopieren',
          accelerator: 'CmdOrCtrl+C',
          click: () => mainWindow.webContents.send('menu-action', 'edit-copy')
        },
        {
          label: 'Einfügen',
          accelerator: 'CmdOrCtrl+V',
          click: () => mainWindow.webContents.send('menu-action', 'edit-paste')
        },
        {
          label: 'Löschen',
          accelerator: 'Delete',
          click: () => mainWindow.webContents.send('menu-action', 'edit-delete')
        },
        { type: 'separator' },
        {
          label: 'Alles auswählen',
          accelerator: 'CmdOrCtrl+A',
          click: () => mainWindow.webContents.send('menu-action', 'edit-select-all')
        },
        { type: 'separator' },
        {
          label: 'Einstellungen...',
          accelerator: 'CmdOrCtrl+,',
          click: () => mainWindow.webContents.send('menu-action', 'edit-preferences')
        }
      ]
    },
    // Ansicht Menu
    {
      label: 'Ansicht',
      submenu: [
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+Plus',
          click: () => mainWindow.webContents.send('menu-action', 'view-zoom-in')
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: () => mainWindow.webContents.send('menu-action', 'view-zoom-out')
        },
        {
          label: 'Zoom 100%',
          accelerator: 'CmdOrCtrl+0',
          click: () => mainWindow.webContents.send('menu-action', 'view-zoom-reset')
        },
        { type: 'separator' },
        {
          label: 'Einzelseiten-Ansicht',
          type: 'checkbox',
          checked: true,
          click: (menuItem) => mainWindow.webContents.send('menu-action', 'view-single-page', menuItem.checked)
        },
        {
          label: 'Zwei-Seiten-Ansicht',
          type: 'checkbox',
          checked: false,
          click: (menuItem) => mainWindow.webContents.send('menu-action', 'view-two-page', menuItem.checked)
        },
        { type: 'separator' },
        {
          label: 'Vollbild',
          accelerator: 'F11',
          click: () => {
            const isFullScreen = mainWindow.isFullScreen();
            mainWindow.setFullScreen(!isFullScreen);
          }
        },
        { type: 'separator' },
        {
          label: 'Paletten anzeigen',
          type: 'checkbox',
          checked: true,
          click: (menuItem) => mainWindow.webContents.send('menu-action', 'view-palettes', menuItem.checked)
        },
        {
          label: 'Transport-Leiste anzeigen',
          type: 'checkbox',
          checked: true,
          click: (menuItem) => mainWindow.webContents.send('menu-action', 'view-transport', menuItem.checked)
        }
      ]
    },
    // Einfügen/Partitur Menu
    {
      label: 'Einfügen',
      submenu: [
        {
          label: 'Noten',
          submenu: [
            { label: 'Ganze Note', click: () => mainWindow.webContents.send('menu-action', 'insert-note-whole') },
            { label: 'Halbe Note', click: () => mainWindow.webContents.send('menu-action', 'insert-note-half') },
            { label: 'Viertel Note', click: () => mainWindow.webContents.send('menu-action', 'insert-note-quarter') },
            { label: 'Achtel Note', click: () => mainWindow.webContents.send('menu-action', 'insert-note-eighth') },
            { label: 'Sechzehntel Note', click: () => mainWindow.webContents.send('menu-action', 'insert-note-sixteenth') },
            { label: '32tel Note', click: () => mainWindow.webContents.send('menu-action', 'insert-note-thirtysecond') },
            { label: '64tel Note', click: () => mainWindow.webContents.send('menu-action', 'insert-note-sixtyfourth') }
          ]
        },
        {
          label: 'Pausen',
          submenu: [
            { label: 'Ganze Pause', click: () => mainWindow.webContents.send('menu-action', 'insert-rest-whole') },
            { label: 'Halbe Pause', click: () => mainWindow.webContents.send('menu-action', 'insert-rest-half') },
            { label: 'Viertel Pause', click: () => mainWindow.webContents.send('menu-action', 'insert-rest-quarter') },
            { label: 'Achtel Pause', click: () => mainWindow.webContents.send('menu-action', 'insert-rest-eighth') },
            { label: 'Sechzehntel Pause', click: () => mainWindow.webContents.send('menu-action', 'insert-rest-sixteenth') }
          ]
        },
        { type: 'separator' },
        {
          label: 'Takt einfügen',
          click: () => mainWindow.webContents.send('menu-action', 'insert-measure')
        },
        {
          label: 'System einfügen',
          click: () => mainWindow.webContents.send('menu-action', 'insert-staff')
        },
        { type: 'separator' },
        {
          label: 'Text...',
          click: () => mainWindow.webContents.send('menu-action', 'insert-text')
        },
        {
          label: 'Lyrics...',
          click: () => mainWindow.webContents.send('menu-action', 'insert-lyrics')
        },
        {
          label: 'Akkord-Symbol...',
          click: () => mainWindow.webContents.send('menu-action', 'insert-chord-symbol')
        },
        { type: 'separator' },
        {
          label: 'Harmonie',
          submenu: [
            { label: 'Transponieren...', accelerator: 'CmdOrCtrl+T', click: () => mainWindow.webContents.send('menu-action', 'insert-transpose') },
            { label: 'Akkord generieren...', click: () => mainWindow.webContents.send('menu-action', 'insert-chord') },
            { label: 'Melodie harmonisieren', click: () => mainWindow.webContents.send('menu-action', 'insert-harmonize') },
            { type: 'separator' },
            { label: 'Gitarren-Tabulatur...', click: () => mainWindow.webContents.send('menu-action', 'insert-guitar-tab') }
          ]
        },
        { type: 'separator' },
        {
          label: 'Wiederholungszeichen',
          submenu: [
            { label: 'Wiederholungsanfang', click: () => mainWindow.webContents.send('menu-action', 'insert-repeat-start') },
            { label: 'Wiederholungsende', click: () => mainWindow.webContents.send('menu-action', 'insert-repeat-end') },
            { label: 'Volta (1., 2. Endung)', click: () => mainWindow.webContents.send('menu-action', 'insert-volta') },
            { label: 'D.C. (Da Capo)', click: () => mainWindow.webContents.send('menu-action', 'insert-dc') },
            { label: 'D.S. (Dal Segno)', click: () => mainWindow.webContents.send('menu-action', 'insert-ds') },
            { label: 'Segno', click: () => mainWindow.webContents.send('menu-action', 'insert-segno') },
            { label: 'Coda', click: () => mainWindow.webContents.send('menu-action', 'insert-coda') }
          ]
        },
        {
          label: 'Dynamik',
          submenu: [
            { label: 'pp', click: () => mainWindow.webContents.send('menu-action', 'insert-dynamic-pp') },
            { label: 'p', click: () => mainWindow.webContents.send('menu-action', 'insert-dynamic-p') },
            { label: 'mp', click: () => mainWindow.webContents.send('menu-action', 'insert-dynamic-mp') },
            { label: 'mf', click: () => mainWindow.webContents.send('menu-action', 'insert-dynamic-mf') },
            { label: 'f', click: () => mainWindow.webContents.send('menu-action', 'insert-dynamic-f') },
            { label: 'ff', click: () => mainWindow.webContents.send('menu-action', 'insert-dynamic-ff') }
          ]
        }
      ]
    },
    // Formatierung Menu
    {
      label: 'Formatierung',
      submenu: [
        {
          label: 'Schlüssel ändern',
          submenu: [
            { label: 'Violinschlüssel (G)', click: () => mainWindow.webContents.send('menu-action', 'format-clef-treble') },
            { label: 'Bassschlüssel (F)', click: () => mainWindow.webContents.send('menu-action', 'format-clef-bass') },
            { label: 'Altschlüssel (C)', click: () => mainWindow.webContents.send('menu-action', 'format-clef-alto') },
            { label: 'Tenorschlüssel', click: () => mainWindow.webContents.send('menu-action', 'format-clef-tenor') }
          ]
        },
        {
          label: 'Tonart ändern...',
          click: () => mainWindow.webContents.send('menu-action', 'format-key-signature')
        },
        {
          label: 'Taktart ändern...',
          click: () => mainWindow.webContents.send('menu-action', 'format-time-signature')
        },
        { type: 'separator' },
        {
          label: 'Punktierung hinzufügen',
          click: () => mainWindow.webContents.send('menu-action', 'format-add-dot')
        },
        {
          label: 'Triole',
          click: () => mainWindow.webContents.send('menu-action', 'format-triplet')
        },
        { type: 'separator' },
        {
          label: 'Seitenlayout...',
          click: () => mainWindow.webContents.send('menu-action', 'format-page-layout')
        },
        {
          label: 'Stil-Einstellungen...',
          click: () => mainWindow.webContents.send('menu-action', 'format-style')
        }
      ]
    },
    // Werkzeuge Menu
    {
      label: 'Werkzeuge',
      submenu: [
        {
          label: 'Transponieren...',
          click: () => mainWindow.webContents.send('menu-action', 'tools-transpose')
        },
        {
          label: 'Harmonie-Assistent...',
          click: () => mainWindow.webContents.send('menu-action', 'tools-harmony-assistant')
        },
        { type: 'separator' },
        {
          label: 'Akkorde generieren',
          submenu: [
            { label: 'Akkordsymbole anzeigen', click: () => mainWindow.webContents.send('menu-action', 'tools-show-chords') },
            { label: 'Akkordblatt erstellen', click: () => mainWindow.webContents.send('menu-action', 'tools-chord-sheet') },
            { label: 'Gitarrengriffe', click: () => mainWindow.webContents.send('menu-action', 'tools-guitar-chords') },
            { label: 'Klaviergriffe', click: () => mainWindow.webContents.send('menu-action', 'tools-piano-chords') }
          ]
        },
        {
          label: 'Gitarren-TAB...',
          click: () => mainWindow.webContents.send('menu-action', 'tools-guitar-tab')
        },
        { type: 'separator' },
        {
          label: 'Audio-Aufnahme starten',
          click: () => mainWindow.webContents.send('menu-action', 'tools-record-audio')
        },
        {
          label: 'Audio-Analyse...',
          click: () => mainWindow.webContents.send('menu-action', 'tools-audio-analysis')
        },
        {
          label: 'Tempo-Erkennung...',
          click: () => mainWindow.webContents.send('menu-action', 'tools-tempo-detection')
        },
        { type: 'separator' },
        {
          label: 'OMR (Notenerkennung)...',
          click: () => mainWindow.webContents.send('menu-action', 'tools-omr')
        }
      ]
    },
    // Plugins Menu
    {
      label: 'Plugins',
      submenu: [
        {
          label: 'Plugin-Manager...',
          click: () => mainWindow.webContents.send('menu-action', 'plugins-manager')
        },
        {
          label: 'Plugin installieren...',
          click: () => mainWindow.webContents.send('menu-action', 'plugins-install')
        },
        { type: 'separator' },
        {
          label: 'Keine Plugins installiert',
          enabled: false
        }
      ]
    },
    // Wiedergabe Menu
    {
      label: 'Wiedergabe',
      submenu: [
        {
          label: 'Abspielen',
          accelerator: 'Space',
          click: () => mainWindow.webContents.send('menu-action', 'playback-play')
        },
        {
          label: 'Pause',
          accelerator: 'Space',
          click: () => mainWindow.webContents.send('menu-action', 'playback-pause')
        },
        {
          label: 'Stop',
          click: () => mainWindow.webContents.send('menu-action', 'playback-stop')
        },
        { type: 'separator' },
        {
          label: 'Zum Anfang',
          accelerator: 'Home',
          click: () => mainWindow.webContents.send('menu-action', 'playback-rewind')
        },
        {
          label: 'Vorheriger Takt',
          accelerator: 'Left',
          click: () => mainWindow.webContents.send('menu-action', 'playback-prev-measure')
        },
        {
          label: 'Nächster Takt',
          accelerator: 'Right',
          click: () => mainWindow.webContents.send('menu-action', 'playback-next-measure')
        },
        { type: 'separator' },
        {
          label: 'Metronom',
          type: 'checkbox',
          checked: false,
          click: (menuItem) => mainWindow.webContents.send('menu-action', 'playback-metronome', menuItem.checked)
        },
        {
          label: 'Tempo ändern...',
          click: () => mainWindow.webContents.send('menu-action', 'playback-tempo')
        },
        { type: 'separator' },
        {
          label: 'Mixer...',
          click: () => mainWindow.webContents.send('menu-action', 'playback-mixer')
        },
        {
          label: 'Instrument wählen...',
          click: () => mainWindow.webContents.send('menu-action', 'playback-instrument')
        }
      ]
    },
    // Erweiterungen Menu (Phase 8)
    {
      label: 'Erweiterungen',
      submenu: [
        {
          label: 'Plugin-Manager',
          click: () => mainWindow.webContents.send('menu-action', 'plugins-manager')
        },
        {
          label: 'Plugins neu laden',
          click: async () => {
            try {
              await pluginManager.loadPlugins();
              mainWindow.webContents.send('plugins-reloaded');
            } catch (error) {
              logger.error('Failed to reload plugins:', error);
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Soundfont-Manager',
          click: () => mainWindow.webContents.send('menu-action', 'soundfonts-manager')
        },
        {
          label: 'Soundfonts neu laden',
          click: async () => {
            try {
              await soundfontManager.loadSoundfonts();
              mainWindow.webContents.send('soundfonts-reloaded');
            } catch (error) {
              logger.error('Failed to reload soundfonts:', error);
            }
          }
        },
        { type: 'separator' },
        {
          label: 'OMR-Einstellungen',
          click: () => mainWindow.webContents.send('menu-action', 'omr-settings')
        }
      ]
    },
    // Hilfe Menu
    {
      label: 'Hilfe',
      submenu: [
        {
          label: 'Handbuch',
          click: () => shell.openExternal('https://github.com/DominikSinger/DScribe-Notensetzungsprogramm/wiki')
        },
        {
          label: 'Tastenkombinationen',
          click: () => mainWindow.webContents.send('menu-action', 'help-shortcuts')
        },
        { type: 'separator' },
        {
          label: 'Nach Updates suchen...',
          click: async () => {
            try {
              await updater.checkForUpdates(mainWindow);
            } catch (error) {
              logger.error('Update check failed:', error);
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Feedback senden',
          click: () => shell.openExternal('https://github.com/DominikSinger/DScribe-Notensetzungsprogramm/issues')
        },
        { type: 'separator' },
        {
          label: 'Über DScribe',
          click: () => mainWindow.webContents.send('menu-action', 'help-about')
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC Handlers
function setupIpcHandlers() {
  // Settings
  ipcMain.handle('settings:get', (event, key, defaultValue) => {
    return settingsManager.get(key, defaultValue);
  });

  ipcMain.handle('settings:set', (event, key, value) => {
    settingsManager.set(key, value);
  });

  ipcMain.handle('settings:getAll', () => {
    return settingsManager.getAll();
  });

  // Logging
  ipcMain.on('log:info', (event, message) => {
    logger.info(message);
  });

  ipcMain.on('log:error', (event, message) => {
    logger.error(message);
  });

  ipcMain.on('log:warn', (event, message) => {
    logger.warn(message);
  });

  // Project Management
  ipcMain.handle('project:save', async (event, projectData) => {
    return await projectManager.saveProject(projectData);
  });

  ipcMain.handle('project:load', async (event, filePath) => {
    return await projectManager.loadProject(filePath);
  });

  ipcMain.handle('project:new', async () => {
    return await projectManager.createNewProject();
  });

  // File Dialogs
  ipcMain.handle('dialog:openFile', async (event, options) => {
    const result = await dialog.showOpenDialog(mainWindow, options);
    return result;
  });

  ipcMain.handle('dialog:saveFile', async (event, options) => {
    const result = await dialog.showSaveDialog(mainWindow, options);
    return result;
  });

  // Get paths
  ipcMain.handle('app:getPaths', () => {
    return PATHS;
  });

  ipcMain.handle('app:getVersion', () => {
    return app.getVersion();
  });
  
  // Export handlers (Phase 4)
  ipcMain.handle('export:pdf', async (event, projectData, outputPath, canvasDataUrl) => {
    return await global.exportManager.exportToPDF(projectData, outputPath, { toDataURL: () => canvasDataUrl });
  });
  
  ipcMain.handle('export:png', async (event, canvasDataUrl, outputPath) => {
    // Convert data URL to buffer and save
    const base64Data = canvasDataUrl.replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    await fs.writeFile(outputPath, buffer);
    return { success: true, path: outputPath };
  });
  
  ipcMain.handle('export:midi', async (event, projectData, outputPath) => {
    return await global.exportManager.exportToMIDI(projectData, outputPath);
  });
  
  ipcMain.handle('export:musicxml', async (event, projectData, outputPath) => {
    return await global.exportManager.exportToMusicXML(projectData, outputPath);
  });
  
  // Import handlers (Phase 4)
  ipcMain.handle('import:midi', async (event, filePath) => {
    return await global.importManager.importFromMIDI(filePath);
  });
  
  ipcMain.handle('import:musicxml', async (event, filePath) => {
    return await global.importManager.importFromMusicXML(filePath);
  });
  
  // Plugin handlers (Phase 8)
  ipcMain.handle('plugins:getAll', async () => {
    return pluginManager.getAllPlugins();
  });
  
  ipcMain.handle('plugins:load', async () => {
    return await pluginManager.loadPlugins();
  });
  
  ipcMain.handle('plugins:enable', async (event, pluginId) => {
    return await pluginManager.enablePlugin(pluginId);
  });
  
  ipcMain.handle('plugins:disable', async (event, pluginId) => {
    return await pluginManager.disablePlugin(pluginId);
  });
  
  ipcMain.handle('plugins:unload', async (event, pluginId) => {
    return await pluginManager.unloadPlugin(pluginId);
  });
  
  ipcMain.handle('plugins:install', async (event, packagePath) => {
    return await pluginManager.installPlugin(packagePath);
  });
  
  // OMR handlers (Phase 8)
  ipcMain.handle('omr:recognize', async (event, filePath) => {
    return await omrManager.recognizeFromFile(filePath);
  });
  
  ipcMain.handle('omr:recognizePDF', async (event, pdfPath) => {
    return await omrManager.recognizeFromPDF(pdfPath);
  });
  
  ipcMain.handle('omr:getCapabilities', async () => {
    return omrManager.getCapabilities();
  });
  
  // Soundfont handlers (Phase 8)
  ipcMain.handle('soundfonts:getAll', async () => {
    return soundfontManager.getAllSoundfonts();
  });
  
  ipcMain.handle('soundfonts:load', async () => {
    return await soundfontManager.loadSoundfonts();
  });
  
  ipcMain.handle('soundfonts:activate', async (event, soundfontId) => {
    return await soundfontManager.activateSoundfont(soundfontId);
  });
  
  ipcMain.handle('soundfonts:deactivate', async (event, soundfontId) => {
    return await soundfontManager.deactivateSoundfont(soundfontId);
  });
  
  ipcMain.handle('soundfonts:import', async (event, sourcePath) => {
    return await soundfontManager.importSoundfont(sourcePath);
  });
  
  ipcMain.handle('soundfonts:remove', async (event, soundfontId) => {
    return await soundfontManager.removeSoundfont(soundfontId);
  });
  
  ipcMain.handle('soundfonts:getInfo', async (event, soundfontId) => {
    return await soundfontManager.getSoundfontInfo(soundfontId);
  });
  
  ipcMain.handle('soundfonts:getRecommended', async () => {
    return soundfontManager.getRecommendedSoundfonts();
  });
}

// App lifecycle
app.whenReady().then(async () => {
  // Initialize user directories first
  await initializeUserDirectories();
  
  // Initialize logger with log directory
  logger.initialize(PATHS.logs);
  logger.info('Application starting...');
  
  // Initialize Phase 8 managers
  pluginManager.initialize(PATHS.plugins);
  await omrManager.initialize();
  soundfontManager.initialize(PATHS.soundfonts);
  
  // Load plugins and soundfonts
  await pluginManager.loadPlugins();
  await soundfontManager.loadSoundfonts();
  
  // Initialize settings
  await settingsManager.initialize(PATHS.settings);
  
  // Initialize project manager
  projectManager.initialize(PATHS.projects);
  
  // Initialize updater
  updater.initialize(PATHS.updates);
  
  // Initialize export/import managers (Phase 4)
  global.exportManager = new ExportManager(logger);
  global.importManager = new ImportManager(logger);
  
  // Setup IPC handlers
  setupIpcHandlers();
  
  // Create main window
  createMainWindow();
  
  logger.info('Application ready');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

// Handle app errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection:', reason);
});
