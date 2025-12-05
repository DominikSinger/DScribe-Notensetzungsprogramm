// PATH: src/renderer/js/app.js
// DScribe - Main Application Logic (Renderer Process)

class DScribeApp {
    constructor() {
        this.currentProject = null;
        this.zoom = 100;
        this.isPlaying = false;
        this.notationEngine = null;
        this.playbackEngine = null;
        this.undoStack = [];
        this.redoStack = [];
        
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
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Setup menu action handler
        this.setupMenuHandler();
        
        // Load settings
        await this.loadSettings();
        
        // Create new project
        this.createNewProject();
        
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
                this.currentProject.keySignature = e.target.value;
                this.notationEngine.setKeySignature(e.target.value);
                this.markProjectDirty();
            }
        });
        
        document.getElementById('project-time').addEventListener('change', (e) => {
            if (this.currentProject) {
                this.currentProject.timeSignature = e.target.value;
                this.notationEngine.setTimeSignature(e.target.value);
                this.markProjectDirty();
            }
        });
        
        document.getElementById('project-tempo').addEventListener('change', (e) => {
            if (this.currentProject) {
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
    }

    setupMenuHandler() {
        window.electron.onMenuAction((action, ...args) => {
            console.log('Menu action:', action, args);
            this.handleMenuAction(action, ...args);
        });
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
        // Space for play/pause
        if (e.code === 'Space' && !e.target.matches('input, textarea')) {
            e.preventDefault();
            this.handlePlay();
        }
        
        // Ctrl+Z for undo
        if (e.ctrlKey && e.key === 'z') {
            e.preventDefault();
            this.handleUndo();
        }
        
        // Ctrl+Y for redo
        if (e.ctrlKey && e.key === 'y') {
            e.preventDefault();
            this.handleRedo();
        }
        
        // Ctrl+S for save
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            this.handleFileSave();
        }
        
        // Ctrl+N for new
        if (e.ctrlKey && e.key === 'n') {
            e.preventDefault();
            this.handleFileNew();
        }
        
        // Ctrl+O for open
        if (e.ctrlKey && e.key === 'o') {
            e.preventDefault();
            this.handleFileOpen();
        }
    }

    createNewProject() {
        this.currentProject = {
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
        
        this.updateProjectUI();
        this.notationEngine.clear();
        this.notationEngine.loadProjectData(this.currentProject);
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
    handleImportAudio() { this.showTodoDialog('Audio-Import (Phase 5)'); }
    
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

    // Edit operations
    handleUndo() {
        if (this.undoStack.length > 0) {
            const action = this.undoStack.pop();
            this.redoStack.push(action);
            // TODO: Apply undo
            this.setStatus('Rückgängig');
        }
    }

    handleRedo() {
        if (this.redoStack.length > 0) {
            const action = this.redoStack.pop();
            this.undoStack.push(action);
            // TODO: Apply redo
            this.setStatus('Wiederherstellen');
        }
    }

    handleCut() { this.showTodoDialog('Ausschneiden'); }
    handleCopy() { this.showTodoDialog('Kopieren'); }
    handlePaste() { this.showTodoDialog('Einfügen'); }
    handleDelete() { this.showTodoDialog('Löschen'); }
    handleSelectAll() { this.showTodoDialog('Alles auswählen'); }

    // View operations
    handleZoomIn() {
        this.zoom = Math.min(200, this.zoom + 10);
        this.applyZoom();
    }

    handleZoomOut() {
        this.zoom = Math.max(50, this.zoom - 10);
        this.applyZoom();
    }

    handleZoomReset() {
        this.zoom = 100;
        this.applyZoom();
    }

    applyZoom() {
        const canvas = document.getElementById('score-canvas');
        canvas.style.transform = `scale(${this.zoom / 100})`;
        canvas.style.transformOrigin = 'top center';
        document.getElementById('zoom-level').textContent = `${this.zoom}%`;
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
        alert('Tastenkombinationen:\n\n' +
              'Strg+N - Neu\n' +
              'Strg+O - Öffnen\n' +
              'Strg+S - Speichern\n' +
              'Strg+Z - Rückgängig\n' +
              'Strg+Y - Wiederherstellen\n' +
              'Leertaste - Abspielen/Pause\n' +
              'F11 - Vollbild');
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

    // Score editing methods
    addNote() {
        if (this.notationEngine) {
            this.notationEngine.addNote('c/4');
            this.markProjectDirty();
            this.setStatus('Note hinzugefügt');
        }
    }

    addRest() {
        if (this.notationEngine) {
            this.notationEngine.addRest();
            this.markProjectDirty();
            this.setStatus('Pause hinzugefügt');
        }
    }

    addMeasure() {
        if (this.notationEngine) {
            this.notationEngine.addMeasure();
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
    }

    setStatus(text) {
        document.getElementById('status-text').textContent = text;
        console.log('Status:', text);
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new DScribeApp();
});
