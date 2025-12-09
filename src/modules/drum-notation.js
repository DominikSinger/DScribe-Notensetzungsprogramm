// PATH: src/modules/drum-notation.js
// DScribe - Drum Notation & TAB Generator
// Unterstützt professionelle Schlagzeug-Notation und Drum-TABs

class DrumNotation {
    constructor() {
        // Standard-Schlagzeug-Instrumente (GM Percussion Mapping)
        this.drumKits = {
            'standard': {
                'kick': { midi: 36, symbol: '○', line: 2 },
                'snare': { midi: 38, symbol: '●', line: 3 },
                'hihat-closed': { midi: 42, symbol: '×', line: 5 },
                'hihat-open': { midi: 46, symbol: 'O', line: 5 },
                'tom-high': { midi: 50, symbol: '◐', line: 1 },
                'tom-mid': { midi: 48, symbol: '◑', line: 2 },
                'tom-low': { midi: 45, symbol: '◒', line: 4 },
                'cymbal-crash': { midi: 49, symbol: '◎', line: 5 },
                'cymbal-ride': { midi: 51, symbol: '◉', line: 5 },
                'cowbell': { midi: 56, symbol: '□', line: 3 }
            },
            'jazz': {
                'kick': { midi: 36, symbol: '●', line: 2 },
                'snare': { midi: 38, symbol: '◉', line: 3 },
                'hihat': { midi: 42, symbol: '×', line: 5 },
                'tom-high': { midi: 50, symbol: '◐', line: 1 },
                'tom-low': { midi: 45, symbol: '◒', line: 4 },
                'cymbal-crash': { midi: 49, symbol: '◎', line: 5 },
                'cymbal-ride': { midi: 51, symbol: '◉', line: 5 }
            },
            'rock': {
                'kick': { midi: 36, symbol: '○', line: 2 },
                'snare': { midi: 38, symbol: '●', line: 3 },
                'hihat-closed': { midi: 42, symbol: '×', line: 5 },
                'hihat-open': { midi: 46, symbol: 'X', line: 5 },
                'tom-high': { midi: 50, symbol: '◐', line: 1 },
                'tom-low': { midi: 45, symbol: '◒', line: 4 },
                'cymbal-crash': { midi: 49, symbol: '◎', line: 5 }
            }
        };

        this.currentKit = 'standard';
    }

    /**
     * Setzt Drum-Kit
     */
    setDrumKit(kitName) {
        if (this.drumKits[kitName]) {
            this.currentKit = kitName;
            return { success: true };
        }
        return { success: false, error: `Unknown kit: ${kitName}` };
    }

    /**
     * Generiert Drum-TAB aus Noten
     */
    generateDrumTab(measures, kitName = 'standard') {
        const kit = this.drumKits[kitName] || this.drumKits['standard'];
        let tabOutput = '';

        // Header
        tabOutput += `\n╔══════════════════════════════════════╗\n`;
        tabOutput += `║     DRUM TABLATURE (${kitName.toUpperCase()})     ║\n`;
        tabOutput += `╚══════════════════════════════════════╝\n\n`;

        // Instrumenten-Labels
        const instruments = Object.keys(kit).map(name => ({
            name,
            line: kit[name].line,
            symbol: kit[name].symbol
        }));

        // Sortiere nach Linie
        instruments.sort((a, b) => b.line - a.line);

        for (const measure of measures) {
            tabOutput += this.renderDrumMeasure(measure, kit, instruments);
        }

        return tabOutput;
    }

    /**
     * Rendert einzelnes Drum-Takt
     */
    renderDrumMeasure(measure, kit, instruments) {
        let output = '|';

        // Für jede Zeile (Instrument)
        const lines = {};
        for (const instr of instruments) {
            lines[instr.line] = '';
        }

        // Verteile Noten auf Linien
        if (measure.notes && measure.notes.length > 0) {
            const noteCount = Math.max(16, measure.notes.length);
            const beatsPerNote = 16 / measure.notes.length;

            for (let i = 0; i < noteCount; i++) {
                const noteIdx = Math.floor(i / beatsPerNote);
                if (noteIdx < measure.notes.length) {
                    const note = measure.notes[noteIdx];
                    const drum = this.identifyDrumFromNote(note, kit);
                    
                    if (drum) {
                        lines[drum.line] += drum.symbol;
                    } else {
                        for (const line of Object.keys(lines)) {
                            lines[line] += '-';
                        }
                    }
                } else {
                    for (const line of Object.keys(lines)) {
                        lines[line] += '-';
                    }
                }
            }
        } else {
            // Leeres Takt
            for (const line of Object.keys(lines)) {
                lines[line] = '----------------';
            }
        }

        // Ausgabe zusammensetzen
        let result = '';
        for (const instr of instruments) {
            result += `| ${instr.name.padEnd(12)} | ${lines[instr.line]} |\n`;
        }
        result += '|──────────────────────────────────────|\n';

        return result;
    }

    /**
     * Identifiziert Schlagzeug-Instrument von Note
     */
    identifyDrumFromNote(note, kit) {
        if (!note.keys || note.keys.length === 0) return null;

        const key = note.keys[0];
        const midi = this.noteToMidi(key);

        for (const [name, info] of Object.entries(kit)) {
            if (info.midi === midi) {
                return info;
            }
        }

        return null;
    }

    /**
     * Konvertiert Note zu MIDI-Nummer
     */
    noteToMidi(vexFlowNote) {
        // Parse: c/4, d#4, etc.
        const match = vexFlowNote.match(/([a-g])([#b]?)\/(\d)/);
        if (!match) return 60; // Middle C

        const [, note, accidental, octave] = match;
        const noteMap = {
            'c': 0, 'd': 2, 'e': 4, 'f': 5, 'g': 7, 'a': 9, 'b': 11
        };

        let semitone = noteMap[note.toLowerCase()];
        if (accidental === '#') semitone++;
        if (accidental === 'b') semitone--;

        return (parseInt(octave) + 1) * 12 + semitone;
    }

    /**
     * Konvertiert MIDI zu Note
     */
    midiToNote(midi) {
        const octave = Math.floor(midi / 12) - 1;
        const noteIndex = midi % 12;
        const notes = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];
        return `${notes[noteIndex]}/${octave}`;
    }

    /**
     * Generiert Standard-Drum-Pattern (z.B. für Midi-Export)
     */
    generateDrumPattern(patternType = 'rock', measures = 8) {
        const patterns = {
            'rock': {
                kick: [0, 0, 0, 1, 0, 0, 0, 1],
                snare: [0, 0, 1, 0, 0, 0, 1, 0],
                hihat: [1, 1, 1, 1, 1, 1, 1, 1]
            },
            'jazz': {
                kick: [0, 0, 1, 0, 0, 1, 0, 0],
                snare: [0, 0, 1, 0, 0, 1, 0, 0],
                hihat: [1, 0, 1, 0, 1, 0, 1, 0]
            },
            'pop': {
                kick: [1, 0, 0, 1, 0, 0, 1, 0],
                snare: [0, 0, 1, 0, 0, 1, 0, 0],
                hihat: [1, 1, 1, 1, 1, 1, 1, 1]
            },
            'metal': {
                kick: [1, 1, 0, 1, 1, 0, 1, 1],
                snare: [0, 1, 1, 0, 0, 1, 1, 0],
                hihat: [1, 1, 1, 1, 1, 1, 1, 1]
            }
        };

        const pattern = patterns[patternType] || patterns['rock'];
        const kit = this.drumKits[this.currentKit];
        const result = [];

        for (let m = 0; m < measures; m++) {
            const measure = { notes: [] };

            // Kick
            if (pattern.kick[m % 8]) {
                measure.notes.push({
                    keys: [this.midiToNote(kit['kick'].midi)],
                    duration: '8'
                });
            }

            // Snare
            if (pattern.snare[m % 8]) {
                measure.notes.push({
                    keys: [this.midiToNote(kit['snare'].midi)],
                    duration: '8'
                });
            }

            // HiHat
            if (pattern.hihat[m % 8]) {
                measure.notes.push({
                    keys: [this.midiToNote(kit['hihat-closed'].midi)],
                    duration: '16'
                });
            }

            result.push(measure);
        }

        return result;
    }

    /**
     * Exportiert Drums als Noten-Format
     */
    exportDrumsAsNotes(measures, kitName = 'standard') {
        const kit = this.drumKits[kitName];
        const exported = [];

        for (const measure of measures) {
            const exportMeasure = { notes: [] };

            for (const note of measure.notes || []) {
                const midi = this.noteToMidi(note.keys[0]);
                const drum = this.findDrumByMidi(midi, kit);

                if (drum) {
                    exportMeasure.notes.push({
                        drum: drum.name,
                        keys: note.keys,
                        duration: note.duration,
                        symbol: drum.symbol
                    });
                }
            }

            exported.push(exportMeasure);
        }

        return exported;
    }

    /**
     * Findet Drum-Info nach MIDI
     */
    findDrumByMidi(midi, kit) {
        for (const [name, info] of Object.entries(kit)) {
            if (info.midi === midi) {
                return { name, ...info };
            }
        }
        return null;
    }

    /**
     * Validiert Drum-Pattern
     */
    validatePattern(pattern) {
        const errors = [];

        for (const drum in pattern) {
            if (!this.drumKits[this.currentKit][drum]) {
                errors.push(`Unknown drum: ${drum}`);
            }

            if (!Array.isArray(pattern[drum])) {
                errors.push(`Pattern for ${drum} must be an array`);
            }

            for (const beat of pattern[drum]) {
                if (typeof beat !== 'number' || (beat !== 0 && beat !== 1)) {
                    errors.push(`Invalid beat value in ${drum}: ${beat}`);
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
}

module.exports = DrumNotation;
