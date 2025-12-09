// PATH: src/renderer/js/app.js
// DScribe - Main Application Logic (Renderer Process)

class DScribeApp {
    constructor() {
        this.currentProject = null;
        this.zoom = 100;
        this.isPlaying = false;
        this.notationEngine = null;
        this.playbackEngine = null;
        
        // Undo/Redo system (Phase 7)
        this.undoStack = [];
        this.redoStack = [];
        this.maxUndoSteps = 50;
        
        // UI state (Phase 7)
        this.darkMode = false;
        this.openTabs = [];
        this.activeTabIndex = 0;
        
        // Keyboard shortcuts (Phase 7) - will be initialized in initializeShortcuts()
        this.shortcuts = {};
        
        this.init();
    }

    async init() {
        console.log('Initializing DScribe...');
        
        // Load app version
        const version = await window.electron.app.getVersion();
        document.getElementById('version-info').textContent = `v${version}`;
        
        // Initialize notation engine
        this.notationEngine = new NotationEngine('score-canvas');
        
        // Initialize playback engine
        this.playbackEngine = new PlaybackEngine();
        
        // Initialize audio analysis engine (Phase 5)
        this.audioAnalysisEngine = new AudioAnalysisEngine();
        await this.audioAnalysisEngine.initialize();
        
        // Initialize harmony engine (Phase 6)
        this.harmonyEngine = new HarmonyEngine();
        
        // Initialize keyboard shortcuts (Phase 7)
        this.initializeShortcuts();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Setup menu action handler
        this.setupMenuHandler();
        
        // Load settings
        await this.loadSettings();
        
        // Create new project
        this.createNewProject();
        
        // Initialize tab system (Phase 7)
        this.initializeTabSystem();
        
        // Start autosave
        this.startAutosave();
        
        console.log('DScribe initialized successfully');
        this.setStatus('Bereit');
    }

    setupEventListeners() {
        // Toolbar buttons
        document.getElementById('btn-new').addEventListener('click', () => this.handleFileNew());
        document.getElementById('btn-open').addEventListener('click', () => this.handleFileOpen());
        document.getElementById('btn-save').addEventListener('click', () => this.handleFileSave());
        
        document.getElementById('btn-undo').addEventListener('click', () => this.handleUndo());
        document.getElementById('btn-redo').addEventListener('click', () => this.handleRedo());
        
        document.getElementById('btn-zoom-in').addEventListener('click', () => this.handleZoomIn());
        document.getElementById('btn-zoom-out').addEventListener('click', () => this.handleZoomOut());
        
        // Score controls
        document.getElementById('btn-add-note').addEventListener('click', () => this.addNote());
        document.getElementById('btn-add-rest').addEventListener('click', () => this.addRest());
        document.getElementById('btn-add-measure').addEventListener('click', () => this.addMeasure());
        
        // Transport controls
        document.getElementById('btn-play').addEventListener('click', () => this.handlePlay());
        document.getElementById('btn-stop').addEventListener('click', () => this.handleStop());
        document.getElementById('btn-rewind').addEventListener('click', () => this.handleRewind());
        document.getElementById('btn-prev').addEventListener('click', () => this.handlePrevMeasure());
        document.getElementById('btn-next').addEventListener('click', () => this.handleNextMeasure());
        
        // Tempo and volume controls
        document.getElementById('tempo-input').addEventListener('change', (e) => {
            this.playbackEngine.setTempo(parseInt(e.target.value));
            document.getElementById('project-tempo').value = e.target.value;
        });
        
        document.getElementById('volume-slider').addEventListener('input', (e) => {
            const volume = parseInt(e.target.value);
            this.playbackEngine.setVolume(volume / 100);
            document.getElementById('volume-display').textContent = `${volume}%`;
        });
        
        document.getElementById('metronome-toggle').addEventListener('change', (e) => {
            this.playbackEngine.setMetronome(e.target.checked);
        });
        
        // Instrument selection (Phase 3)
        document.getElementById('instrument-select').addEventListener('change', (e) => {
            this.playbackEngine.setInstrument(e.target.value);
        });
        
        // Project info
        document.getElementById('project-title').addEventListener('change', (e) => {
            if (this.currentProject) {
                this.currentProject.title = e.target.value;
                document.getElementById('score-title-display').textContent = e.target.value;
                this.markProjectDirty();
            }
        });
        
        document.getElementById('score-title-display').addEventListener('input', (e) => {
            if (this.currentProject) {
                this.currentProject.title = e.target.textContent;
                document.getElementById('project-title').value = e.target.textContent;
                this.markProjectDirty();
            }
        });
        
        document.getElementById('project-composer').addEventListener('change', (e) => {
            if (this.currentProject) {
                this.currentProject.composer = e.target.value;
                document.getElementById('score-composer-display').textContent = e.target.value;
                this.markProjectDirty();
            }
        });
        
        document.getElementById('score-composer-display').addEventListener('input', (e) => {
            if (this.currentProject) {
                this.currentProject.composer = e.target.textContent;
                document.getElementById('project-composer').value = e.target.textContent;
                this.markProjectDirty();
            }
        });
        
        document.getElementById('project-key').addEventListener('change', (e) => {
            if (this.currentProject) {
                this.saveState('Tonart ändern');
                this.currentProject.keySignature = e.target.value;
                this.notationEngine.setKeySignature(e.target.value);
                this.markProjectDirty();
            }
        });
        
        document.getElementById('project-time').addEventListener('change', (e) => {
            if (this.currentProject) {
                this.saveState('Taktart ändern');
                this.currentProject.timeSignature = e.target.value;
                this.notationEngine.setTimeSignature(e.target.value);
                this.markProjectDirty();
            }
        });
        
        document.getElementById('project-tempo').addEventListener('change', (e) => {
            if (this.currentProject) {
                this.saveState('Tempo ändern');
                this.currentProject.tempo = parseInt(e.target.value);
                this.playbackEngine.setTempo(parseInt(e.target.value));
                document.getElementById('tempo-input').value = e.target.value;
                this.markProjectDirty();
            }
        });
        
        // Palette buttons
        document.querySelectorAll('.palette-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handlePaletteClick(e.target));
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
        
        // Context menu (Phase 7)
        this.setupContextMenu();
    }
    
    setupContextMenu() {
        // Context menu for score canvas (Phase 7)
        const scoreContainer = document.getElementById('score-container');
        const contextMenu = document.getElementById('context-menu');
        
        // Show context menu on right-click
        scoreContainer.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            
            // Position context menu at mouse position
            contextMenu.style.left = e.pageX + 'px';
            contextMenu.style.top = e.pageY + 'px';
            contextMenu.style.display = 'block';
        });
        
        // Hide context menu on click outside
        document.addEventListener('click', (e) => {
            if (!contextMenu.contains(e.target)) {
                contextMenu.style.display = 'none';
            }
        });
        
        // Handle context menu item clicks
        contextMenu.querySelectorAll('.context-menu-item').forEach(item => {
            item.addEventListener('click', () => {
                const action = item.dataset.action;
                this.handleContextMenuAction(action);
                contextMenu.style.display = 'none';
            });
        });
    }
    
    handleContextMenuAction(action) {
        // Handle context menu actions (Phase 7)
        const actions = {
            'add-note': () => this.addNote(),
            'add-rest': () => this.addRest(),
            'add-measure': () => this.addMeasure(),
            'cut': () => this.handleCut(),
            'copy': () => this.handleCopy(),
            'paste': () => this.handlePaste(),
            'delete': () => this.handleDelete(),
            'transpose': () => this.showTransposeDialog(),
            'add-chord': () => this.showChordDialog(),
            'harmonize': () => this.harmonizeMelody(),
        };
        
        const handler = actions[action];
        if (handler) {
            handler();
        }
    }

    setupMenuHandler() {
        window.electron.onMenuAction((action, ...args) => {
            console.log('Menu action:', action, args);
            this.handleMenuAction(action, ...args);
        });
        
        // Setup web-based menu bar event listeners
        const menuOptions = document.querySelectorAll('.menu-option');
        menuOptions.forEach(option => {
            option.addEventListener('click', () => {
                const action = option.dataset.action;
                this.handleWebMenuAction(action);
            });
        });
    }
    
    handleWebMenuAction(action) {
        // Map web menu actions to existing handlers
        const actionMap = {
            'new': () => this.handleFileNew(),
            'open': () => this.handleFileOpen(),
            'save': () => this.handleFileSave(),
            'save-as': () => this.handleFileSaveAs(),
            'export-pdf': () => this.handleExportPDF(),
            'export-midi': () => this.handleExportMIDI(),
            'quit': () => window.close(),
            'undo': () => this.handleUndo(),
            'redo': () => this.handleRedo(),
            'cut': () => this.handleCut(),
            'copy': () => this.handleCopy(),
            'paste': () => this.handlePaste(),
            'zoom-in': () => this.handleZoomIn(),
            'zoom-out': () => this.handleZoomOut(),
            'zoom-reset': () => this.handleZoomReset(),
            'toggle-dark-mode': () => this.toggleDarkMode(),
            'add-measure': () => this.addMeasure(),
            'add-note': () => this.addNote(),
            'add-rest': () => this.addRest(),
            'help': () => this.showHelp(),
            'about': () => this.showAbout()
        };
        
        const handler = actionMap[action];
        if (handler) {
            handler();
        } else {
            console.warn('Unhandled menu action:', action);
        }
    }

    async handleMenuAction(action, ...args) {
        const handlers = {
            // File menu
            'file-new': () => this.handleFileNew(),
            'file-open': () => this.handleFileOpen(),
            'file-save': () => this.handleFileSave(),
            'file-save-as': () => this.handleFileSaveAs(),
            'import-pdf': () => this.handleImportPDF(),
            'import-midi': () => this.handleImportMIDI(),
            'import-musicxml': () => this.handleImportMusicXML(),
            'import-audio': () => this.handleImportAudio(),
            'export-pdf': () => this.handleExportPDF(),
            'export-midi': () => this.handleExportMIDI(),
            'export-mp3': () => this.handleExportMP3(),
            'export-musicxml': () => this.handleExportMusicXML(),
            'export-png': () => this.handleExportPNG(),
            'project-properties': () => this.showProjectProperties(),
            
            // Edit menu
            'edit-undo': () => this.handleUndo(),
            'edit-redo': () => this.handleRedo(),
            'edit-cut': () => this.handleCut(),
            'edit-copy': () => this.handleCopy(),
            'edit-paste': () => this.handlePaste(),
            'edit-delete': () => this.handleDelete(),
            'edit-select-all': () => this.handleSelectAll(),
            'edit-preferences': () => this.showPreferences(),
            
            // View menu
            'view-zoom-in': () => this.handleZoomIn(),
            'view-zoom-out': () => this.handleZoomOut(),
            'view-zoom-reset': () => this.handleZoomReset(),
            'view-zoom-fit': () => this.zoomToFit(),
            'view-zoom-width': () => this.zoomToWidth(),
            'view-zoom-custom': () => this.showZoomDialog(),
            'view-single-page': (checked) => this.setPageView('single', checked),
            'view-two-page': (checked) => this.setPageView('two', checked),
            'view-palettes': (checked) => this.togglePalettes(checked),
            'view-transport': (checked) => this.toggleTransport(checked),
            
            // Playback menu
            'playback-play': () => this.handlePlay(),
            'playback-pause': () => this.handlePause(),
            'playback-stop': () => this.handleStop(),
            'playback-rewind': () => this.handleRewind(),
            'playback-prev-measure': () => this.handlePrevMeasure(),
            'playback-next-measure': () => this.handleNextMeasure(),
            'playback-metronome': (checked) => this.playbackEngine.setMetronome(checked),
            'playback-tempo': () => this.showTempoDialog(),
            'playback-mixer': () => this.showMixer(),
            'playback-instrument': () => this.showInstrumentPicker(),
            
            // Harmony menu (Phase 6)
            'insert-transpose': () => this.showTransposeDialog(),
            'insert-chord': () => this.showChordDialog(),
            'insert-guitar-tab': () => this.showGuitarTabDialog(),
            'insert-harmonize': () => this.harmonizeMelody(),
            
            // Help menu
            'help-shortcuts': () => this.showShortcuts(),
            'help-about': () => this.showAbout(),
        };

        const handler = handlers[action];
        if (handler) {
            try {
                await handler();
            } catch (error) {
                console.error(`Error handling menu action ${action}:`, error);
                this.showError(`Fehler bei Aktion "${action}": ${error.message}`);
            }
        } else {
            console.log(`TODO: Implement menu action: ${action}`);
            this.setStatus(`TODO: ${action} implementieren`);
        }
    }

    handlePaletteClick(btn) {
        // Remove active class from all buttons
        document.querySelectorAll('.palette-btn').forEach(b => b.classList.remove('active'));
        
        // Add active class to clicked button
        btn.classList.add('active');
        
        // Handle different palette types
        if (btn.dataset.note) {
            this.notationEngine.setActiveNoteType(btn.dataset.note);
            this.setStatus(`Notenwert: ${btn.title}`);
        } else if (btn.dataset.rest) {
            this.notationEngine.setActiveRestType(btn.dataset.rest);
            this.setStatus(`Pause: ${btn.title}`);
        } else if (btn.dataset.accidental) {
            this.notationEngine.setActiveAccidental(btn.dataset.accidental);
            this.setStatus(`Vorzeichen: ${btn.title}`);
        } else if (btn.dataset.clef) {
            this.notationEngine.setClef(btn.dataset.clef);
            this.setStatus(`Schlüssel: ${btn.title}`);
        }
    }

    handleKeyPress(e) {
        // Don't trigger shortcuts when typing in input fields
        if (e.target.matches('input, textarea, select')) {
            return;
        }
        
        // Check if any shortcut matches
        for (const [key, config] of Object.entries(this.shortcuts)) {
            if (this.matchesShortcut(e, config)) {
                e.preventDefault();
                config.action();
                return;
            }
        }
    }
    
    matchesShortcut(event, config) {
        return (
            event.key.toLowerCase() === config.key.toLowerCase() &&
            !!event.ctrlKey === !!config.ctrl &&
            !!event.shiftKey === !!config.shift &&
            !!event.altKey === !!config.alt
        );
    }
    
    initializeShortcuts() {
        // Define all keyboard shortcuts (Phase 7)
        this.shortcuts = {
            // File operations
            'new': { key: 'n', ctrl: true, action: () => this.handleFileNew(), description: 'Neue Partitur' },
            'open': { key: 'o', ctrl: true, action: () => this.handleFileOpen(), description: 'Öffnen' },
            'save': { key: 's', ctrl: true, action: () => this.handleFileSave(), description: 'Speichern' },
            'save-as': { key: 's', ctrl: true, shift: true, action: () => this.handleFileSaveAs(), description: 'Speichern unter' },
            
            // Edit operations
            'undo': { key: 'z', ctrl: true, action: () => this.handleUndo(), description: 'Rückgängig' },
            'redo': { key: 'y', ctrl: true, action: () => this.handleRedo(), description: 'Wiederherstellen' },
            'redo-alt': { key: 'z', ctrl: true, shift: true, action: () => this.handleRedo(), description: 'Wiederherstellen (Alt)' },
            'cut': { key: 'x', ctrl: true, action: () => this.handleCut(), description: 'Ausschneiden' },
            'copy': { key: 'c', ctrl: true, action: () => this.handleCopy(), description: 'Kopieren' },
            'paste': { key: 'v', ctrl: true, action: () => this.handlePaste(), description: 'Einfügen' },
            'select-all': { key: 'a', ctrl: true, action: () => this.handleSelectAll(), description: 'Alles auswählen' },
            'delete': { key: 'Delete', action: () => this.handleDelete(), description: 'Löschen' },
            
            // View operations
            'zoom-in': { key: '+', ctrl: true, action: () => this.handleZoomIn(), description: 'Vergrößern' },
            'zoom-out': { key: '-', ctrl: true, action: () => this.handleZoomOut(), description: 'Verkleinern' },
            'zoom-reset': { key: '0', ctrl: true, action: () => this.handleZoomReset(), description: 'Zoom zurücksetzen' },
            
            // Playback operations
            'play': { key: ' ', action: () => this.handlePlay(), description: 'Abspielen/Pause' },
            'stop': { key: 'Escape', action: () => this.handleStop(), description: 'Stopp' },
            'rewind': { key: 'Home', action: () => this.handleRewind(), description: 'Zurückspulen' },
            
            // Note input
            'add-note': { key: 'n', action: () => this.addNote(), description: 'Note hinzufügen' },
            'add-rest': { key: 'r', action: () => this.addRest(), description: 'Pause hinzufügen' },
            'add-measure': { key: 'm', action: () => this.addMeasure(), description: 'Takt hinzufügen' },
            
            // Other
            'dark-mode': { key: 'd', ctrl: true, shift: true, action: () => this.toggleDarkMode(), description: 'Dark Mode umschalten' },
            'shortcuts': { key: 'F1', action: () => this.showShortcuts(), description: 'Tastaturkürzel anzeigen' },
        };
    }

    createNewProject() {
        const project = {
            title: 'Unbenannt',
            composer: '',
            keySignature: 'C',
            timeSignature: '4/4',
            tempo: 120,
            clef: 'treble',
            measures: [],
            isDirty: false,
            filePath: null
        };
        
        // Add to tabs if multi-tab is active (Phase 7)
        if (this.openTabs.length > 0) {
            this.addTab(project);
        } else {
            this.currentProject = project;
            this.updateProjectUI();
            this.notationEngine.clear();
            this.notationEngine.loadProjectData(this.currentProject);
        }
        
        return project;
        this.setStatus('Neues Projekt erstellt');
    }

    updateProjectUI() {
        if (!this.currentProject) return;
        
        document.getElementById('project-title').value = this.currentProject.title || '';
        document.getElementById('project-composer').value = this.currentProject.composer || '';
        document.getElementById('project-key').value = this.currentProject.keySignature || 'C';
        document.getElementById('project-time').value = this.currentProject.timeSignature || '4/4';
        document.getElementById('project-tempo').value = this.currentProject.tempo || 120;
        document.getElementById('tempo-input').value = this.currentProject.tempo || 120;
        
        document.getElementById('score-title-display').textContent = this.currentProject.title || 'Unbenannt';
        document.getElementById('score-composer-display').textContent = this.currentProject.composer || 'Komponist';
    }

    markProjectDirty() {
        if (this.currentProject) {
            this.currentProject.isDirty = true;
        }
    }

    // File operations
    async handleFileNew() {
        if (this.currentProject && this.currentProject.isDirty) {
            const save = confirm('Möchten Sie die aktuellen Änderungen speichern?');
            if (save) {
                await this.handleFileSave();
            }
        }
        this.createNewProject();
    }

    async handleFileOpen() {
        const result = await window.electron.dialog.openFile({
            title: 'Projekt öffnen',
            filters: [
                { name: 'DScribe Projekte', extensions: ['dscribe', 'json'] },
                { name: 'Alle Dateien', extensions: ['*'] }
            ],
            properties: ['openFile']
        });
        
        if (!result.canceled && result.filePaths.length > 0) {
            try {
                const projectData = await window.electron.project.load(result.filePaths[0]);
                this.currentProject = projectData;
                this.updateProjectUI();
                this.notationEngine.loadProject(projectData);
                this.setStatus(`Projekt geladen: ${projectData.title}`);
            } catch (error) {
                console.error('Failed to open project:', error);
                this.showError('Fehler beim Öffnen des Projekts');
            }
        }
    }

    async handleFileSave() {
        if (!this.currentProject) return;
        
        if (!this.currentProject.filePath) {
            return await this.handleFileSaveAs();
        }
        
        try {
            await window.electron.project.save(this.currentProject);
            this.currentProject.isDirty = false;
            this.setStatus('Projekt gespeichert');
        } catch (error) {
            console.error('Failed to save project:', error);
            this.showError('Fehler beim Speichern des Projekts');
        }
    }

    async handleFileSaveAs() {
        if (!this.currentProject) return;
        
        const result = await window.electron.dialog.saveFile({
            title: 'Projekt speichern unter',
            defaultPath: this.currentProject.title || 'Unbenannt',
            filters: [
                { name: 'DScribe Projekte', extensions: ['dscribe'] },
                { name: 'JSON', extensions: ['json'] }
            ]
        });
        
        if (!result.canceled && result.filePath) {
            try {
                this.currentProject.filePath = result.filePath;
                await window.electron.project.save(this.currentProject);
                this.currentProject.isDirty = false;
                this.setStatus(`Projekt gespeichert: ${this.currentProject.title}`);
            } catch (error) {
                console.error('Failed to save project:', error);
                this.showError('Fehler beim Speichern des Projekts');
            }
        }
    }

    // Import handlers (Phase 4)
    handleImportPDF() { this.showTodoDialog('PDF-Import (OMR in Phase 8)'); }
    
    // Audio analysis (Phase 5)
    handleImportAudio() { 
        this.showAudioAnalysisDialog();
    }
    
    async handleImportMIDI() {
        try {
            const result = await window.electron.dialog.openFile({
                title: 'MIDI-Datei importieren',
                filters: [
                    { name: 'MIDI Files', extensions: ['mid', 'midi'] }
                ],
                properties: ['openFile']
            });
            
            if (!result.canceled && result.filePaths.length > 0) {
                this.setStatus('Importiere MIDI...');
                const importResult = await window.electron.import.fromMIDI(result.filePaths[0]);
                
                if (importResult.success) {
                    this.currentProject = importResult.project;
                    this.updateProjectInfo();
                    this.notationEngine.setKeySignature(this.currentProject.keySignature);
                    this.notationEngine.setTimeSignature(this.currentProject.timeSignature);
                    this.notationEngine.render(this.currentProject.measures);
                    this.setStatus(`MIDI importiert: ${this.currentProject.measures.length} Takte`);
                } else {
                    alert('MIDI-Import fehlgeschlagen: ' + importResult.error);
                    this.setStatus('MIDI-Import fehlgeschlagen');
                }
            }
        } catch (error) {
            console.error('MIDI import error:', error);
            alert('Fehler beim MIDI-Import: ' + error.message);
        }
    }
    
    async handleImportMusicXML() {
        try {
            const result = await window.electron.dialog.openFile({
                title: 'MusicXML-Datei importieren',
                filters: [
                    { name: 'MusicXML Files', extensions: ['xml', 'musicxml', 'mxl'] }
                ],
                properties: ['openFile']
            });
            
            if (!result.canceled && result.filePaths.length > 0) {
                this.setStatus('Importiere MusicXML...');
                const importResult = await window.electron.import.fromMusicXML(result.filePaths[0]);
                
                if (importResult.success) {
                    this.currentProject = importResult.project;
                    this.updateProjectInfo();
                    this.notationEngine.setKeySignature(this.currentProject.keySignature);
                    this.notationEngine.setTimeSignature(this.currentProject.timeSignature);
                    this.notationEngine.render(this.currentProject.measures);
                    this.setStatus(`MusicXML importiert: ${this.currentProject.measures.length} Takte`);
                } else {
                    alert('MusicXML-Import fehlgeschlagen: ' + importResult.error);
                    this.setStatus('MusicXML-Import fehlgeschlagen');
                }
            }
        } catch (error) {
            console.error('MusicXML import error:', error);
            alert('Fehler beim MusicXML-Import: ' + error.message);
        }
    }
    
    // Export handlers (Phase 4)
    async handleExportPDF() {
        try {
            const result = await window.electron.dialog.saveFile({
                title: 'Als PDF exportieren',
                defaultPath: `${this.currentProject.title || 'Unbenannt'}.pdf`,
                filters: [
                    { name: 'PDF Files', extensions: ['pdf'] }
                ]
            });
            
            if (!result.canceled && result.filePath) {
                this.setStatus('Exportiere PDF...');
                
                // Get canvas as data URL
                const canvas = document.querySelector('#score-canvas canvas');
                if (!canvas) {
                    alert('Kein Notenblatt zum Exportieren vorhanden');
                    return;
                }
                
                const canvasDataUrl = canvas.toDataURL('image/png');
                const exportResult = await window.electron.export.toPDF(
                    this.currentProject, 
                    result.filePath,
                    canvasDataUrl
                );
                
                if (exportResult.success) {
                    this.setStatus('PDF erfolgreich exportiert');
                    alert('PDF wurde erfolgreich exportiert!');
                } else {
                    alert('PDF-Export fehlgeschlagen: ' + exportResult.error);
                    this.setStatus('PDF-Export fehlgeschlagen');
                }
            }
        } catch (error) {
            console.error('PDF export error:', error);
            alert('Fehler beim PDF-Export: ' + error.message);
        }
    }
    
    async handleExportPNG() {
        try {
            const result = await window.electron.dialog.saveFile({
                title: 'Als PNG exportieren',
                defaultPath: `${this.currentProject.title || 'Unbenannt'}.png`,
                filters: [
                    { name: 'PNG Files', extensions: ['png'] }
                ]
            });
            
            if (!result.canceled && result.filePath) {
                this.setStatus('Exportiere PNG...');
                
                const canvas = document.querySelector('#score-canvas canvas');
                if (!canvas) {
                    alert('Kein Notenblatt zum Exportieren vorhanden');
                    return;
                }
                
                const canvasDataUrl = canvas.toDataURL('image/png');
                const exportResult = await window.electron.export.toPNG(canvasDataUrl, result.filePath);
                
                if (exportResult.success) {
                    this.setStatus('PNG erfolgreich exportiert');
                    alert('PNG wurde erfolgreich exportiert!');
                } else {
                    alert('PNG-Export fehlgeschlagen: ' + exportResult.error);
                    this.setStatus('PNG-Export fehlgeschlagen');
                }
            }
        } catch (error) {
            console.error('PNG export error:', error);
            alert('Fehler beim PNG-Export: ' + error.message);
        }
    }
    
    async handleExportMIDI() {
        try {
            const result = await window.electron.dialog.saveFile({
                title: 'Als MIDI exportieren',
                defaultPath: `${this.currentProject.title || 'Unbenannt'}.mid`,
                filters: [
                    { name: 'MIDI Files', extensions: ['mid', 'midi'] }
                ]
            });
            
            if (!result.canceled && result.filePath) {
                this.setStatus('Exportiere MIDI...');
                const exportResult = await window.electron.export.toMIDI(this.currentProject, result.filePath);
                
                if (exportResult.success) {
                    this.setStatus('MIDI erfolgreich exportiert');
                    alert('MIDI wurde erfolgreich exportiert!');
                } else {
                    alert('MIDI-Export fehlgeschlagen: ' + exportResult.error);
                    this.setStatus('MIDI-Export fehlgeschlagen');
                }
            }
        } catch (error) {
            console.error('MIDI export error:', error);
            alert('Fehler beim MIDI-Export: ' + error.message);
        }
    }
    
    async handleExportMusicXML() {
        try {
            const result = await window.electron.dialog.saveFile({
                title: 'Als MusicXML exportieren',
                defaultPath: `${this.currentProject.title || 'Unbenannt'}.xml`,
                filters: [
                    { name: 'MusicXML Files', extensions: ['xml', 'musicxml'] }
                ]
            });
            
            if (!result.canceled && result.filePath) {
                this.setStatus('Exportiere MusicXML...');
                const exportResult = await window.electron.export.toMusicXML(this.currentProject, result.filePath);
                
                if (exportResult.success) {
                    this.setStatus('MusicXML erfolgreich exportiert');
                    alert('MusicXML wurde erfolgreich exportiert!');
                } else {
                    alert('MusicXML-Export fehlgeschlagen: ' + exportResult.error);
                    this.setStatus('MusicXML-Export fehlgeschlagen');
                }
            }
        } catch (error) {
            console.error('MusicXML export error:', error);
            alert('Fehler beim MusicXML-Export: ' + error.message);
        }
    }
    
    handleExportMP3() { 
        this.showTodoDialog('MP3-Export (Recorder in Phase 5)'); 
    }

    // Edit operations (Phase 7 - Undo/Redo System)
    saveState(actionDescription) {
        const state = {
            measures: JSON.parse(JSON.stringify(this.currentProject.measures)),
            description: actionDescription,
            timestamp: Date.now()
        };
        
        this.undoStack.push(state);
        
        // Limit undo stack size
        if (this.undoStack.length > this.maxUndoSteps) {
            this.undoStack.shift();
        }
        
        // Clear redo stack when new action is performed
        this.redoStack = [];
        
        this.updateUndoRedoButtons();
    }
    
    handleUndo() {
        if (this.undoStack.length === 0) {
            this.setStatus('Nichts zum Rückgängigmachen');
            return;
        }
        
        // Save current state to redo
        const currentState = {
            measures: JSON.parse(JSON.stringify(this.currentProject.measures)),
            description: 'Redo',
            timestamp: Date.now()
        };
        this.redoStack.push(currentState);
        
        // Restore previous state
        const previousState = this.undoStack.pop();
        this.currentProject.measures = previousState.measures;
        this.notationEngine.render(this.currentProject.measures);
        
        this.updateUndoRedoButtons();
        this.setStatus(`Rückgängig: ${previousState.description}`);
    }

    handleRedo() {
        if (this.redoStack.length === 0) {
            this.setStatus('Nichts zum Wiederherstellen');
            return;
        }
        
        // Save current state to undo
        const currentState = {
            measures: JSON.parse(JSON.stringify(this.currentProject.measures)),
            description: 'Undo',
            timestamp: Date.now()
        };
        this.undoStack.push(currentState);
        
        // Restore redo state
        const redoState = this.redoStack.pop();
        this.currentProject.measures = redoState.measures;
        this.notationEngine.render(this.currentProject.measures);
        
        this.updateUndoRedoButtons();
        this.setStatus('Wiederhergestellt');
    }
    
    updateUndoRedoButtons() {
        const undoBtn = document.getElementById('btn-undo');
        const redoBtn = document.getElementById('btn-redo');
        
        if (undoBtn) {
            undoBtn.disabled = this.undoStack.length === 0;
            undoBtn.title = this.undoStack.length > 0 
                ? `Rückgängig: ${this.undoStack[this.undoStack.length - 1].description}` 
                : 'Nichts zum Rückgängigmachen';
        }
        
        if (redoBtn) {
            redoBtn.disabled = this.redoStack.length === 0;
            redoBtn.title = this.redoStack.length > 0 
                ? 'Wiederherstellen' 
                : 'Nichts zum Wiederherstellen';
        }
    }

    handleCut() { this.showTodoDialog('Ausschneiden'); }
    handleCopy() { this.showTodoDialog('Kopieren'); }
    handlePaste() { this.showTodoDialog('Einfügen'); }
    handleDelete() { this.showTodoDialog('Löschen'); }
    handleSelectAll() { this.showTodoDialog('Alles auswählen'); }

    // View operations (enhanced in Phase 7)
    handleZoomIn() {
        this.zoom = Math.min(300, this.zoom + 10);
        this.applyZoom();
    }

    handleZoomOut() {
        this.zoom = Math.max(25, this.zoom - 10);
        this.applyZoom();
    }

    handleZoomReset() {
        this.zoom = 100;
        this.applyZoom();
    }
    
    setZoom(value) {
        this.zoom = Math.max(25, Math.min(300, value));
        this.applyZoom();
    }
    
    zoomToFit() {
        const container = document.getElementById('score-container');
        const canvas = document.getElementById('score-canvas');
        
        const containerWidth = container.clientWidth;
        const canvasWidth = canvas.scrollWidth;
        
        if (canvasWidth > 0) {
            const fitZoom = Math.floor((containerWidth / canvasWidth) * 100);
            this.setZoom(Math.max(25, Math.min(300, fitZoom)));
        }
    }
    
    zoomToWidth() {
        // Fit to width (similar to zoomToFit but focused on width)
        this.zoomToFit();
        this.setStatus('Zoom: An Breite angepasst');
    }

    applyZoom() {
        const canvas = document.getElementById('score-canvas');
        canvas.style.transform = `scale(${this.zoom / 100})`;
        canvas.style.transformOrigin = 'top center';
        
        // Update zoom display
        const zoomDisplay = document.getElementById('zoom-level');
        zoomDisplay.textContent = `${this.zoom}%`;
        zoomDisplay.style.cursor = 'pointer';
        
        // Make zoom display clickable for custom zoom
        zoomDisplay.onclick = () => this.showZoomDialog();
        
        this.setStatus(`Zoom: ${this.zoom}%`);
    }
    
    showZoomDialog() {
        const currentZoom = this.zoom;
        const newZoom = prompt(`Zoom-Stufe eingeben (25-300%):`, currentZoom);
        
        if (newZoom !== null) {
            const zoomValue = parseInt(newZoom);
            if (!isNaN(zoomValue) && zoomValue >= 25 && zoomValue <= 300) {
                this.setZoom(zoomValue);
            } else {
                alert('Bitte einen Wert zwischen 25 und 300 eingeben.');
            }
        }
    }

    setPageView(mode, checked) {
        if (checked) {
            this.setStatus(`Ansicht: ${mode === 'single' ? 'Einzelseite' : 'Zwei Seiten'}`);
        }
    }

    togglePalettes(visible) {
        document.getElementById('left-palette').style.display = visible ? 'block' : 'none';
        document.getElementById('right-panel').style.display = visible ? 'block' : 'none';
    }

    toggleTransport(visible) {
        document.getElementById('transport').style.display = visible ? 'flex' : 'none';
    }

    // Playback operations
    handlePlay() {
        if (this.isPlaying) {
            this.handlePause();
        } else {
            this.isPlaying = true;
            document.getElementById('btn-play').textContent = '⏸';
            this.playbackEngine.play(this.notationEngine.getNotes());
            this.setStatus('Wiedergabe läuft');
        }
    }

    handlePause() {
        this.isPlaying = false;
        document.getElementById('btn-play').textContent = '▶';
        this.playbackEngine.pause();
        this.setStatus('Wiedergabe pausiert');
    }

    handleStop() {
        this.isPlaying = false;
        document.getElementById('btn-play').textContent = '▶';
        this.playbackEngine.stop();
        this.setStatus('Wiedergabe gestoppt');
    }

    handleRewind() {
        this.playbackEngine.rewind();
        this.setStatus('Zum Anfang');
    }

    handlePrevMeasure() {
        this.playbackEngine.previousMeasure();
        this.setStatus('Vorheriger Takt');
    }

    handleNextMeasure() {
        this.playbackEngine.nextMeasure();
        this.setStatus('Nächster Takt');
    }

    // Dialogs
    showTodoDialog(feature) {
        alert(`TODO: ${feature} wird noch implementiert`);
        this.setStatus(`TODO: ${feature}`);
    }
    
    showModalDialog(htmlContent) {
        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.id = 'modal-overlay';
        
        const modal = document.createElement('div');
        modal.className = 'modal-dialog';
        modal.innerHTML = htmlContent;
        
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        
        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.closeModal();
            }
        });
        
        // Setup close modal function globally
        window.closeModal = () => this.closeModal();
    }
    
    closeModal() {
        const overlay = document.getElementById('modal-overlay');
        if (overlay) {
            overlay.remove();
        }
    }

    showProjectProperties() {
        this.showTodoDialog('Projekt-Eigenschaften');
    }

    showPreferences() {
        this.showTodoDialog('Einstellungen');
    }

    showTempoDialog() {
        const tempo = prompt('Tempo (BPM):', this.currentProject.tempo);
        if (tempo && !isNaN(tempo)) {
            this.currentProject.tempo = parseInt(tempo);
            document.getElementById('project-tempo').value = tempo;
            document.getElementById('tempo-input').value = tempo;
            this.playbackEngine.setTempo(parseInt(tempo));
        }
    }

    showMixer() {
        const instruments = this.playbackEngine.getAvailableInstruments();
        const currentInstrument = this.playbackEngine.currentInstrument;
        const volume = Math.round(this.playbackEngine.volume * 100);
        
        const html = `
            <div class="mixer-dialog">
                <h2>Mixer</h2>
                <div class="mixer-controls">
                    <div class="mixer-section">
                        <h3>Master</h3>
                        <div class="mixer-control">
                            <label>Volume:</label>
                            <input type="range" id="mixer-master-volume" min="0" max="100" value="${volume}">
                            <span id="mixer-master-volume-value">${volume}%</span>
                        </div>
                    </div>
                    
                    <div class="mixer-section">
                        <h3>Instrument</h3>
                        <div class="mixer-control">
                            <label>Auswahl:</label>
                            <select id="mixer-instrument-select">
                                ${instruments.map(inst => 
                                    `<option value="${inst}" ${inst === currentInstrument ? 'selected' : ''}>${inst.charAt(0).toUpperCase() + inst.slice(1)}</option>`
                                ).join('')}
                            </select>
                        </div>
                    </div>
                    
                    <div class="mixer-section">
                        <h3>Metronom</h3>
                        <div class="mixer-control">
                            <label>
                                <input type="checkbox" id="mixer-metronome" ${this.playbackEngine.metronomeEnabled ? 'checked' : ''}>
                                Aktiviert
                            </label>
                        </div>
                    </div>
                </div>
                <div class="dialog-buttons">
                    <button class="btn-primary" onclick="window.mixerApply()">Anwenden</button>
                    <button class="btn-secondary" onclick="window.closeModal()">Schließen</button>
                </div>
            </div>
        `;
        
        this.showModalDialog(html);
        
        // Setup event handlers
        window.mixerApply = () => {
            const vol = document.getElementById('mixer-master-volume').value;
            const inst = document.getElementById('mixer-instrument-select').value;
            const metro = document.getElementById('mixer-metronome').checked;
            
            this.playbackEngine.setVolume(parseInt(vol) / 100);
            this.playbackEngine.setInstrument(inst);
            this.playbackEngine.setMetronome(metro);
            
            document.getElementById('volume-slider').value = vol;
            document.getElementById('volume-display').textContent = vol + '%';
            document.getElementById('instrument-select').value = inst;
            document.getElementById('metronome-toggle').checked = metro;
            
            this.closeModal();
        };
        
        document.getElementById('mixer-master-volume').addEventListener('input', (e) => {
            document.getElementById('mixer-master-volume-value').textContent = e.target.value + '%';
        });
    }

    showInstrumentPicker() {
        const instruments = this.playbackEngine.getAvailableInstruments();
        const currentInstrument = this.playbackEngine.currentInstrument;
        
        const html = `
            <div class="instrument-picker-dialog">
                <h2>Instrument wählen</h2>
                <div class="instrument-grid">
                    ${instruments.map(inst => `
                        <button class="instrument-card ${inst === currentInstrument ? 'selected' : ''}" data-instrument="${inst}">
                            <div class="instrument-icon">${this.getInstrumentIcon(inst)}</div>
                            <div class="instrument-name">${inst.charAt(0).toUpperCase() + inst.slice(1)}</div>
                        </button>
                    `).join('')}
                </div>
                <div class="dialog-buttons">
                    <button class="btn-secondary" onclick="window.closeModal()">Schließen</button>
                </div>
            </div>
        `;
        
        this.showModalDialog(html);
        
        document.querySelectorAll('.instrument-card').forEach(btn => {
            btn.addEventListener('click', () => {
                const instrument = btn.dataset.instrument;
                this.playbackEngine.setInstrument(instrument);
                document.getElementById('instrument-select').value = instrument;
                
                document.querySelectorAll('.instrument-card').forEach(c => c.classList.remove('selected'));
                btn.classList.add('selected');
            });
        });
    }
    
    getInstrumentIcon(instrument) {
        const icons = {
            'piano': '🎹',
            'organ': '🎹',
            'guitar': '🎸',
            'strings': '🎻',
            'flute': '🎵',
            'brass': '🎺',
            'bass': '🎸'
        };
        return icons[instrument] || '🎵';
    }

    showShortcuts() {
        // Display keyboard shortcuts dialog (Phase 7)
        const modal = document.getElementById('shortcuts-modal');
        modal.style.display = 'flex';
        
        document.getElementById('btn-close-shortcuts').onclick = () => {
            modal.style.display = 'none';
        };
    }
    
    toggleDarkMode() {
        // Toggle dark mode (Phase 7)
        this.darkMode = !this.darkMode;
        
        if (this.darkMode) {
            document.body.classList.add('dark-mode');
            this.setStatus('Dark Mode aktiviert');
        } else {
            document.body.classList.remove('dark-mode');
            this.setStatus('Dark Mode deaktiviert');
        }
        
        // Save dark mode preference
        localStorage.setItem('darkMode', this.darkMode);
    }
    
    // Multi-Tab Management (Phase 7)
    addTab(project) {
        const tab = {
            project: project,
            undoStack: [],
            redoStack: []
        };
        
        this.openTabs.push(tab);
        this.activeTabIndex = this.openTabs.length - 1;
        
        this.updateTabBar();
        this.switchTab(this.activeTabIndex);
    }
    
    switchTab(index) {
        if (index < 0 || index >= this.openTabs.length) {
            return;
        }
        
        // Save current project state
        if (this.activeTabIndex >= 0 && this.activeTabIndex < this.openTabs.length) {
            this.openTabs[this.activeTabIndex].project = this.currentProject;
            this.openTabs[this.activeTabIndex].undoStack = this.undoStack;
            this.openTabs[this.activeTabIndex].redoStack = this.redoStack;
        }
        
        // Load new tab
        this.activeTabIndex = index;
        const tab = this.openTabs[index];
        this.currentProject = tab.project;
        this.undoStack = tab.undoStack;
        this.redoStack = tab.redoStack;
        
        // Update UI
        this.updateProjectUI();
        this.updateTabBar();
        this.notationEngine.clear();
        this.notationEngine.loadProjectData(this.currentProject);
        this.notationEngine.render(this.currentProject.measures);
        this.updateUndoRedoButtons();
    }
    
    closeTab(index) {
        if (this.openTabs.length <= 1) {
            // Don't close the last tab
            return;
        }
        
        const tab = this.openTabs[index];
        if (tab.project.isDirty) {
            const confirmClose = confirm(`"${tab.project.title}" hat ungespeicherte Änderungen. Trotzdem schließen?`);
            if (!confirmClose) {
                return;
            }
        }
        
        this.openTabs.splice(index, 1);
        
        // Adjust active tab index
        if (this.activeTabIndex >= this.openTabs.length) {
            this.activeTabIndex = this.openTabs.length - 1;
        }
        
        this.updateTabBar();
        this.switchTab(this.activeTabIndex);
    }
    
    updateTabBar() {
        const tabList = document.getElementById('tab-list');
        tabList.innerHTML = '';
        
        this.openTabs.forEach((tab, index) => {
            const tabElement = document.createElement('div');
            tabElement.className = 'tab' + (index === this.activeTabIndex ? ' active' : '');
            tabElement.dataset.tabIndex = index;
            
            const title = document.createElement('span');
            title.className = 'tab-title';
            title.textContent = tab.project.title + (tab.project.isDirty ? ' *' : '');
            
            const closeBtn = document.createElement('span');
            closeBtn.className = 'tab-close';
            closeBtn.textContent = '×';
            closeBtn.title = 'Schließen';
            closeBtn.onclick = (e) => {
                e.stopPropagation();
                this.closeTab(index);
            };
            
            tabElement.appendChild(title);
            tabElement.appendChild(closeBtn);
            
            tabElement.onclick = () => this.switchTab(index);
            
            tabList.appendChild(tabElement);
        });
    }
    
    initializeTabSystem() {
        // Initialize multi-tab system (Phase 7)
        const newTabBtn = document.getElementById('btn-new-tab');
        newTabBtn.addEventListener('click', () => {
            const project = this.createNewProject();
            this.addTab(project);
        });
        
        // Add initial project as first tab
        if (this.currentProject) {
            this.addTab(this.currentProject);
        }
    }

    showAbout() {
        alert('DScribe - Notensatzprogramm\n\n' +
              'Version 12.0.0\n' +
              'Ein professionelles Notensatzprogramm mit erweiterten\n' +
              'Audio- und Analysefunktionen.\n\n' +
              '© 2025 - MIT License');
    }

    showError(message) {
        alert('Fehler: ' + message);
        this.setStatus('Fehler: ' + message);
    }

    // Score editing methods (with Undo support - Phase 7)
    addNote(pitch = 'c/4', duration = 'q') {
        if (this.notationEngine) {
            this.saveState('Note hinzufügen');
            
            const measureIndex = this.currentProject.measures.length - 1;
            if (!this.currentProject.measures[measureIndex]) {
                this.currentProject.measures[measureIndex] = { notes: [] };
            }
            
            this.currentProject.measures[measureIndex].notes.push({
                keys: [pitch],
                duration: duration
            });
            
            this.notationEngine.render(this.currentProject.measures);
            this.markProjectDirty();
            this.setStatus('Note hinzugefügt');
        }
    }

    addRest(duration = 'qr') {
        if (this.notationEngine) {
            this.saveState('Pause hinzufügen');
            
            const measureIndex = this.currentProject.measures.length - 1;
            if (!this.currentProject.measures[measureIndex]) {
                this.currentProject.measures[measureIndex] = { notes: [] };
            }
            
            this.currentProject.measures[measureIndex].notes.push({
                keys: [],
                duration: duration
            });
            
            this.notationEngine.render(this.currentProject.measures);
            this.markProjectDirty();
            this.setStatus('Pause hinzugefügt');
        }
    }

    addMeasure() {
        if (this.notationEngine) {
            this.saveState('Takt hinzufügen');
            
            this.currentProject.measures.push({ notes: [] });
            this.notationEngine.render(this.currentProject.measures);
            this.markProjectDirty();
            this.setStatus('Takt hinzugefügt');
        }
    }

    // Autosave
    startAutosave() {
        setInterval(async () => {
            if (this.currentProject && this.currentProject.isDirty && this.currentProject.filePath) {
                try {
                    await window.electron.project.save(this.currentProject);
                    console.log('Autosave successful');
                    document.getElementById('autosave-status').textContent = 
                        `Autosave: ${new Date().toLocaleTimeString()}`;
                } catch (error) {
                    console.error('Autosave failed:', error);
                }
            }
        }, 4 * 60 * 1000); // 4 minutes
    }

    async loadSettings() {
        const settings = await window.electron.settings.getAll();
        console.log('Loaded settings:', settings);
        
        // Apply settings to UI
        
        // Load dark mode preference (Phase 7)
        const darkModePreference = localStorage.getItem('darkMode');
        if (darkModePreference === 'true') {
            this.darkMode = true;
            document.body.classList.add('dark-mode');
        }
    }

    setStatus(text) {
        document.getElementById('status-text').textContent = text;
        console.log('Status:', text);
    }
    
    // Audio Analysis Dialog (Phase 5)
    showAudioAnalysisDialog() {
        const modal = document.getElementById('audio-analysis-modal');
        modal.style.display = 'flex';
        
        // Setup event handlers
        document.getElementById('btn-start-mic').onclick = () => this.startMicrophone();
        document.getElementById('btn-stop-mic').onclick = () => this.stopMicrophone();
        document.getElementById('btn-import-audio').onclick = () => this.importAudioFile();
        document.getElementById('btn-add-detected-note').onclick = () => this.addDetectedNote();
        document.getElementById('btn-close-analysis').onclick = () => this.closeAudioAnalysis();
        
        // Setup pitch detection callback
        this.audioAnalysisEngine.onPitchDetected = (frequency, noteName) => {
            document.getElementById('detected-note').textContent = noteName;
            document.getElementById('detected-frequency').textContent = frequency.toFixed(2) + ' Hz';
            document.getElementById('btn-add-detected-note').disabled = false;
        };
    }
    
    async startMicrophone() {
        const result = await this.audioAnalysisEngine.startMicrophone();
        
        if (result.success) {
            document.getElementById('btn-start-mic').disabled = true;
            document.getElementById('btn-stop-mic').disabled = false;
            this.audioAnalysisEngine.startVisualization('audio-visualizer');
            this.setStatus('Mikrofon aktiv - sprechen oder singen Sie');
        } else {
            alert('Mikrofon-Zugriff fehlgeschlagen: ' + result.error);
        }
    }
    
    stopMicrophone() {
        this.audioAnalysisEngine.stopMicrophone();
        this.audioAnalysisEngine.stopVisualization();
        document.getElementById('btn-start-mic').disabled = false;
        document.getElementById('btn-stop-mic').disabled = true;
        this.setStatus('Mikrofon gestoppt');
    }
    
    async importAudioFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'audio/*';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            this.setStatus('Analysiere Audio-Datei...');
            
            const importResult = await this.audioAnalysisEngine.importAudioFile(file);
            
            if (importResult.success) {
                this.setStatus('Extrahiere Noten...');
                const analysisResult = await this.audioAnalysisEngine.analyzeAudioBuffer(importResult.buffer);
                
                if (analysisResult.success && analysisResult.notes.length > 0) {
                    // Add notes to score
                    const measureIndex = this.currentProject.measures.length - 1;
                    
                    analysisResult.notes.forEach(note => {
                        if (!this.currentProject.measures[measureIndex]) {
                            this.currentProject.measures[measureIndex] = { notes: [] };
                        }
                        
                        this.currentProject.measures[measureIndex].notes.push({
                            keys: note.keys,
                            duration: note.duration
                        });
                    });
                    
                    this.notationEngine.render(this.currentProject.measures);
                    this.markProjectDirty();
                    this.setStatus(`${analysisResult.notes.length} Noten extrahiert`);
                    alert(`Erfolgreich ${analysisResult.notes.length} Noten aus Audio extrahiert!`);
                } else {
                    alert('Keine Noten in der Audio-Datei erkannt');
                    this.setStatus('Keine Noten erkannt');
                }
            } else {
                alert('Audio-Import fehlgeschlagen: ' + importResult.error);
                this.setStatus('Audio-Import fehlgeschlagen');
            }
        };
        
        input.click();
    }
    
    addDetectedNote() {
        const noteName = document.getElementById('detected-note').textContent;
        if (noteName === '-') return;
        
        const vexFlowNote = this.audioAnalysisEngine.noteToVexFlow(noteName);
        this.addNote(vexFlowNote, 'q');
        this.setStatus(`Note ${noteName} hinzugefügt`);
    }
    
    closeAudioAnalysis() {
        this.audioAnalysisEngine.stopMicrophone();
        this.audioAnalysisEngine.stopVisualization();
        document.getElementById('audio-analysis-modal').style.display = 'none';
        document.getElementById('btn-start-mic').disabled = false;
        document.getElementById('btn-stop-mic').disabled = true;
        document.getElementById('btn-add-detected-note').disabled = true;
        document.getElementById('detected-note').textContent = '-';
        document.getElementById('detected-frequency').textContent = '- Hz';
    }
    
    // Harmony Functions (Phase 6)
    showTransposeDialog() {
        const modal = document.getElementById('transpose-modal');
        modal.style.display = 'flex';
        
        document.getElementById('btn-apply-transpose').onclick = () => this.applyTranspose();
        document.getElementById('btn-cancel-transpose').onclick = () => {
            modal.style.display = 'none';
        };
    }
    
    applyTranspose() {
        const semitones = parseInt(document.getElementById('transpose-interval').value);
        const preferFlats = document.getElementById('prefer-flats').checked;
        
        if (semitones === 0) {
            alert('Keine Transposition gewählt');
            return;
        }
        
        this.setStatus('Transponiere...');
        this.saveState('Transponieren');
        
        this.currentProject.measures = this.harmonyEngine.transposeProject(
            this.currentProject.measures,
            semitones,
            preferFlats
        );
        
        this.notationEngine.render(this.currentProject.measures);
        this.markProjectDirty();
        
        document.getElementById('transpose-modal').style.display = 'none';
        this.setStatus(`Transponiert um ${semitones} Halbtöne`);
    }
    
    showChordDialog() {
        const modal = document.getElementById('chord-modal');
        modal.style.display = 'flex';
        
        const updatePreview = () => {
            const root = document.getElementById('chord-root').value;
            const type = document.getElementById('chord-type').value;
            const octave = parseInt(document.getElementById('chord-octave').value);
            
            const chord = this.harmonyEngine.generateChord(root, type, octave);
            const symbol = this.harmonyEngine.getChordSymbol(root, type);
            
            document.getElementById('chord-preview').textContent = 
                `${symbol}: ${chord.join(', ')}`;
        };
        
        document.getElementById('chord-root').onchange = updatePreview;
        document.getElementById('chord-type').onchange = updatePreview;
        document.getElementById('chord-octave').oninput = updatePreview;
        
        updatePreview();
        
        document.getElementById('btn-add-chord').onclick = () => {
            const root = document.getElementById('chord-root').value;
            const type = document.getElementById('chord-type').value;
            const octave = parseInt(document.getElementById('chord-octave').value);
            
            const chord = this.harmonyEngine.generateChord(root, type, octave);
            
            this.saveState('Akkord hinzufügen');
            
            // Add chord to current measure
            const measureIndex = this.currentProject.measures.length - 1;
            if (!this.currentProject.measures[measureIndex]) {
                this.currentProject.measures[measureIndex] = { notes: [] };
            }
            
            this.currentProject.measures[measureIndex].notes.push({
                keys: chord,
                duration: 'q'
            });
            
            this.notationEngine.render(this.currentProject.measures);
            this.markProjectDirty();
            
            modal.style.display = 'none';
            this.setStatus(`Akkord ${this.harmonyEngine.getChordSymbol(root, type)} hinzugefügt`);
        };
        
        document.getElementById('btn-cancel-chord').onclick = () => {
            modal.style.display = 'none';
        };
    }
    
    showGuitarTabDialog() {
        const modal = document.getElementById('guitar-tab-modal');
        modal.style.display = 'flex';
        
        const generateTab = () => {
            const tuning = document.getElementById('guitar-tuning').value;
            const tabDisplay = document.getElementById('tab-display');
            
            // Collect all notes from current project
            const allNotes = [];
            this.currentProject.measures.forEach(measure => {
                if (measure.notes) {
                    measure.notes.forEach(note => {
                        if (note.keys && note.keys.length > 0 && !note.duration.includes('r')) {
                            note.keys.forEach(key => allNotes.push(key));
                        }
                    });
                }
            });
            
            if (allNotes.length === 0) {
                tabDisplay.innerHTML = '<p>Keine Noten zum Konvertieren</p>';
                return;
            }
            
            const tab = this.harmonyEngine.generateGuitarTab(allNotes, tuning);
            
            // Render TAB
            let tabHtml = '<div class="tab-strings">';
            for (let string = 6; string >= 1; string--) {
                tabHtml += `<div class="tab-string">`;
                tabHtml += `<span class="tab-string-label">E${7-string}|</span>`;
                
                const stringNotes = tab.filter(t => t.string === string);
                if (stringNotes.length > 0) {
                    stringNotes.forEach(note => {
                        tabHtml += `<span class="tab-fret">${note.fret}</span>`;
                    });
                } else {
                    tabHtml += '<span class="tab-fret">-</span>';
                }
                
                tabHtml += '</div>';
            }
            tabHtml += '</div>';
            
            tabDisplay.innerHTML = tabHtml;
        };
        
        document.getElementById('guitar-tuning').onchange = generateTab;
        generateTab();
        
        document.getElementById('btn-export-tab').onclick = () => {
            alert('TAB-Export wird in einem späteren Update implementiert');
        };
        
        document.getElementById('btn-close-tab').onclick = () => {
            modal.style.display = 'none';
        };
    }
    
    harmonizeMelody() {
        const key = this.currentProject.keySignature || 'C';
        
        // Collect melody notes from first voice
        const melodyNotes = [];
        this.currentProject.measures.forEach(measure => {
            if (measure.notes && measure.notes.length > 0) {
                measure.notes.forEach(note => {
                    if (note.keys && note.keys.length > 0 && !note.duration.includes('r')) {
                        melodyNotes.push(note.keys[0]);
                    }
                });
            }
        });
        
        if (melodyNotes.length === 0) {
            alert('Keine Melodie zum Harmonisieren gefunden');
            return;
        }
        
        this.setStatus('Harmonisiere Melodie...');
        this.saveState('Melodie harmonisieren');
        
        const harmonized = this.harmonyEngine.harmonizeMelody(melodyNotes, key);
        
        // Add harmonization to measures
        let noteIndex = 0;
        this.currentProject.measures.forEach(measure => {
            if (measure.notes && measure.notes.length > 0) {
                measure.notes.forEach(note => {
                    if (note.keys && note.keys.length > 0 && !note.duration.includes('r')) {
                        if (noteIndex < harmonized.length) {
                            // Add chord notes below melody
                            const harm = harmonized[noteIndex];
                            note.keys = harm.chord.concat([note.keys[0]]);
                            noteIndex++;
                        }
                    }
                });
            }
        });
        
        this.notationEngine.render(this.currentProject.measures);
        this.markProjectDirty();
        
        this.setStatus(`Melodie harmonisiert mit ${harmonized.length} Akkorden`);
        alert(`Melodie wurde erfolgreich harmonisiert!\n${harmonized.length} Akkorde hinzugefügt.`);
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new DScribeApp();
});
