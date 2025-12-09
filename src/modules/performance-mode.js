// PATH: src/modules/performance-mode.js
// DScribe - Live Performance Mode
// Unterstützt Tablet-Ansicht, automatisches Umblättern und Echtzeit-Performance

class PerformanceMode {
    constructor() {
        this.isActive = false;
        this.currentPage = 0;
        this.autoPageTurn = false;
        this.pageTurnDelay = 30000; // 30 Sekunden default
        this.measures = [];
        this.displayCanvas = null;
        this.pageInterval = null;
        this.pageSize = {
            measuresPerPage: 8,
            linesPerPage: 4
        };
    }

    /**
     * Aktiviert Performance-Modus
     */
    activate(projectData, displayElementId) {
        this.isActive = true;
        this.measures = projectData.measures || [];
        this.currentPage = 0;

        // Initialisiere Display
        this.displayCanvas = document.getElementById(displayElementId);
        if (!this.displayCanvas) {
            console.error('Display element not found:', displayElementId);
            return { success: false };
        }

        // Richte Bildschirm ein
        this.setupDisplay();

        // Renderiere erste Seite
        this.renderPage();

        console.log('Performance Mode activated');
        return { success: true };
    }

    /**
     * Deaktiviert Performance-Modus
     */
    deactivate() {
        this.isActive = false;
        if (this.pageInterval) {
            clearInterval(this.pageInterval);
            this.pageInterval = null;
        }
        console.log('Performance Mode deactivated');
    }

    /**
     * Richtet Display-Modus ein
     */
    setupDisplay() {
        // Vollbild-Modus
        const elem = this.displayCanvas;

        if (elem.requestFullscreen) {
            elem.requestFullscreen().catch(err => {
                console.warn('Fullscreen failed:', err);
            });
        }

        // Dark background
        elem.style.backgroundColor = '#1a1a1a';
        elem.style.color = '#ffffff';
        elem.style.fontSize = '24px';
        elem.style.padding = '40px';
        elem.style.fontFamily = 'serif';
        elem.style.overflowY = 'auto';
    }

    /**
     * Rendert aktuelle Seite
     */
    renderPage() {
        const startMeasure = this.currentPage * this.pageSize.measuresPerPage;
        const endMeasure = startMeasure + this.pageSize.measuresPerPage;
        const pageMeasures = this.measures.slice(startMeasure, endMeasure);

        let html = `<div class="performance-page" style="page-break-after: always;">`;
        html += `<div style="text-align: center; margin-bottom: 30px; font-size: 28px; font-weight: bold;">`;
        html += `Page ${this.currentPage + 1} / ${Math.ceil(this.measures.length / this.pageSize.measuresPerPage)}`;
        html += `</div>`;

        for (const measure of pageMeasures) {
            html += this.renderMeasure(measure);
        }

        html += `</div>`;

        this.displayCanvas.innerHTML = html;

        // Scroll nach oben
        this.displayCanvas.scrollTop = 0;
    }

    /**
     * Rendert einzelnes Notensystem als Text/ASCII
     */
    renderMeasure(measure) {
        let html = `<div class="measure" style="margin: 20px 0; padding: 15px; border: 1px solid #444;">`;
        html += `<div style="font-family: monospace; font-size: 18px;">`;

        // Notenlinie visualisierung
        const lineCount = 5;
        for (let line = lineCount; line > 0; line--) {
            html += `<div style="height: 20px; border-bottom: 1px solid #666; position: relative;">`;

            if (measure.notes) {
                measure.notes.forEach((note, idx) => {
                    const symbol = this.getNoteSymbol(note, line);
                    if (symbol) {
                        html += `<span style="margin-left: ${idx * 30}px;">${symbol}</span>`;
                    }
                });
            }

            html += `</div>`;
        }

        html += `</div></div>`;
        return html;
    }

    /**
     * Gibt Noten-Symbol zurück
     */
    getNoteSymbol(note, line) {
        // Vereinfachte Darstellung
        const symbols = {
            'whole': '𝅝',
            'half': '𝅗𝅥',
            'quarter': '♩',
            'eighth': '♪',
            'rest': '𝄽'
        };

        if (note.duration && note.duration.includes('r')) {
            return symbols['rest'];
        }

        return symbols['quarter'];
    }

    /**
     * Blätter zur nächsten Seite
     */
    nextPage() {
        const maxPages = Math.ceil(this.measures.length / this.pageSize.measuresPerPage);
        if (this.currentPage < maxPages - 1) {
            this.currentPage++;
            this.renderPage();
            return { success: true, currentPage: this.currentPage, maxPages };
        }
        return { success: false, message: 'Already on last page' };
    }

    /**
     * Blätter zur vorherigen Seite
     */
    previousPage() {
        if (this.currentPage > 0) {
            this.currentPage--;
            this.renderPage();
            return { success: true, currentPage: this.currentPage };
        }
        return { success: false, message: 'Already on first page' };
    }

    /**
     * Springt zu Seite
     */
    goToPage(pageNumber) {
        const maxPages = Math.ceil(this.measures.length / this.pageSize.measuresPerPage);
        if (pageNumber >= 0 && pageNumber < maxPages) {
            this.currentPage = pageNumber;
            this.renderPage();
            return { success: true };
        }
        return { success: false, error: `Invalid page number: ${pageNumber}` };
    }

    /**
     * Aktiviert/Deaktiviert automatisches Umblättern
     */
    setAutoPageTurn(enabled, delayMs = null) {
        if (enabled) {
            if (delayMs) {
                this.pageTurnDelay = delayMs;
            }

            this.autoPageTurn = true;
            this.pageInterval = setInterval(() => {
                const result = this.nextPage();
                if (!result.success) {
                    // Ende erreicht
                    this.setAutoPageTurn(false);
                    console.log('Reached end of score');
                }
            }, this.pageTurnDelay);

            console.log(`Auto page turn enabled (${this.pageTurnDelay}ms)`);
            return { success: true };
        } else {
            this.autoPageTurn = false;
            if (this.pageInterval) {
                clearInterval(this.pageInterval);
                this.pageInterval = null;
            }
            console.log('Auto page turn disabled');
            return { success: true };
        }
    }

    /**
     * Aktiviert Tablet-Modus (größere Schrift, Touch-freundlich)
     */
    enableTabletMode() {
        const style = document.createElement('style');
        style.textContent = `
            .performance-page {
                font-size: 36px !important;
                line-height: 2;
            }
            .measure {
                padding: 30px !important;
                margin: 40px 0 !important;
            }
            button {
                font-size: 28px;
                padding: 20px;
                margin: 10px;
                touch-action: manipulation;
            }
        `;
        document.head.appendChild(style);

        console.log('Tablet mode enabled');
        return { success: true };
    }

    /**
     * Aktiviert Landscape-Lock (für Tablets)
     */
    lockLandscape() {
        if (screen.orientation && screen.orientation.lock) {
            screen.orientation.lock('landscape').catch(err => {
                console.warn('Orientation lock failed:', err);
            });
        }
    }

    /**
     * Erstellt Kontrollelemente für Performance-Modus
     */
    createControls() {
        const controlsHtml = `
            <div id="performance-controls" style="
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0,0,0,0.9);
                padding: 20px;
                border-radius: 10px;
                z-index: 1000;
                display: flex;
                gap: 10px;
            ">
                <button onclick="performanceMode.previousPage()" style="
                    background: #444;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 5px;
                    cursor: pointer;
                ">← Vorherige</button>

                <button id="auto-page-btn" onclick="performanceMode.toggleAutoPageTurn()" style="
                    background: #666;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 5px;
                    cursor: pointer;
                ">Auto Play</button>

                <button onclick="performanceMode.nextPage()" style="
                    background: #444;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 5px;
                    cursor: pointer;
                ">Nächste →</button>

                <button onclick="performanceMode.deactivate()" style="
                    background: #8B0000;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 5px;
                    cursor: pointer;
                ">Beenden</button>
            </div>
        `;

        return controlsHtml;
    }

    /**
     * Toggle Automatisches Umblättern
     */
    toggleAutoPageTurn() {
        if (this.autoPageTurn) {
            this.setAutoPageTurn(false);
            document.getElementById('auto-page-btn').style.background = '#666';
        } else {
            this.setAutoPageTurn(true);
            document.getElementById('auto-page-btn').style.background = '#008B00';
        }
    }

    /**
     * Konfiguriert Seiten-Layout
     */
    setPageConfig(measuresPerPage, linesPerPage) {
        this.pageSize.measuresPerPage = measuresPerPage;
        this.pageSize.linesPerPage = linesPerPage;
        this.renderPage();
        return { success: true };
    }

    /**
     * Exportiert Performance-Modus als HTML
     */
    exportAsHTML(filename = 'performance.html') {
        const html = this.generateFullHTML();
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();

        URL.revokeObjectURL(url);
        return { success: true, filename };
    }

    /**
     * Generiert komplettes HTML für Performance-Modus
     */
    generateFullHTML() {
        let html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DScribe - Performance Mode</title>
    <style>
        body {
            background: #1a1a1a;
            color: #ffffff;
            font-family: serif;
            margin: 0;
            padding: 40px;
            overflow-y: auto;
        }
        .page { page-break-after: always; margin: 50px 0; }
        .measure { margin: 20px 0; padding: 15px; border: 1px solid #444; }
        .page-number { text-align: center; font-size: 18px; color: #888; margin-top: 30px; }
    </style>
</head>
<body>`;

        const maxPages = Math.ceil(this.measures.length / this.pageSize.measuresPerPage);
        for (let page = 0; page < maxPages; page++) {
            const startMeasure = page * this.pageSize.measuresPerPage;
            const endMeasure = startMeasure + this.pageSize.measuresPerPage;
            const pageMeasures = this.measures.slice(startMeasure, endMeasure);

            html += `<div class="page">`;
            for (const measure of pageMeasures) {
                html += this.renderMeasure(measure);
            }
            html += `<div class="page-number">Seite ${page + 1}</div>`;
            html += `</div>`;
        }

        html += `</body></html>`;
        return html;
    }
}

// Globale Instanz
let performanceMode = new PerformanceMode();

module.exports = PerformanceMode;
