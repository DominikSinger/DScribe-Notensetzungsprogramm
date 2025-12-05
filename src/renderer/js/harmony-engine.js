// PATH: src/renderer/js/harmony-engine.js
// DScribe - Harmony Engine (Phase 6)

class HarmonyEngine {
    constructor() {
        // Note mappings
        this.noteMap = {
            'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
            'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
            'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
        };
        
        this.noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        this.flatNoteNames = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
        
        // Chord definitions
        this.chordTemplates = {
            'major': [0, 4, 7],
            'minor': [0, 3, 7],
            'diminished': [0, 3, 6],
            'augmented': [0, 4, 8],
            'sus2': [0, 2, 7],
            'sus4': [0, 5, 7],
            'major7': [0, 4, 7, 11],
            'minor7': [0, 3, 7, 10],
            'dominant7': [0, 4, 7, 10],
            'diminished7': [0, 3, 6, 9],
            'halfDiminished7': [0, 3, 6, 10],
            'majorAdd9': [0, 4, 7, 14],
            'minor6': [0, 3, 7, 9],
            'major6': [0, 4, 7, 9]
        };
        
        // Guitar tuning (standard EADGBE)
        this.guitarTuning = {
            'standard': ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'],
            'dropD': ['D2', 'A2', 'D3', 'G3', 'B3', 'E4'],
            'halfStep': ['Eb2', 'Ab2', 'Db3', 'Gb3', 'Bb3', 'Eb4']
        };
        
        // Scale intervals
        this.scaleIntervals = {
            'major': [0, 2, 4, 5, 7, 9, 11],
            'minor': [0, 2, 3, 5, 7, 8, 10],
            'harmonicMinor': [0, 2, 3, 5, 7, 8, 11],
            'melodicMinor': [0, 2, 3, 5, 7, 9, 11],
            'dorian': [0, 2, 3, 5, 7, 9, 10],
            'phrygian': [0, 1, 3, 5, 7, 8, 10],
            'lydian': [0, 2, 4, 6, 7, 9, 11],
            'mixolydian': [0, 2, 4, 5, 7, 9, 10],
            'locrian': [0, 1, 3, 5, 6, 8, 10]
        };
    }

    /**
     * Transpose note by semitones
     */
    transpose(vexFlowNote, semitones, preferFlats = false) {
        const { note, accidental, octave } = this.parseVexFlowNote(vexFlowNote);
        
        // Get current pitch
        const noteName = note.toUpperCase() + (accidental || '');
        let pitchClass = this.noteMap[noteName];
        
        // Transpose
        pitchClass = (pitchClass + semitones) % 12;
        if (pitchClass < 0) pitchClass += 12;
        
        // Calculate octave change
        const totalSemitones = this.noteMap[noteName] + semitones;
        const octaveChange = Math.floor(totalSemitones / 12) - Math.floor(this.noteMap[noteName] / 12);
        const newOctave = parseInt(octave) + octaveChange;
        
        // Get new note name
        const noteNames = preferFlats ? this.flatNoteNames : this.noteNames;
        const newNoteName = noteNames[pitchClass];
        
        return this.toVexFlowFormat(newNoteName, newOctave);
    }

    /**
     * Transpose entire project by interval
     */
    transposeProject(measures, semitones, preferFlats = false) {
        const transposedMeasures = [];
        
        measures.forEach(measure => {
            const transposedMeasure = { ...measure, notes: [] };
            
            if (measure.notes) {
                measure.notes.forEach(note => {
                    if (note.keys && note.keys.length > 0 && !note.duration.includes('r')) {
                        const transposedKeys = note.keys.map(key => 
                            this.transpose(key, semitones, preferFlats)
                        );
                        transposedMeasure.notes.push({
                            ...note,
                            keys: transposedKeys
                        });
                    } else {
                        // Keep rests unchanged
                        transposedMeasure.notes.push({ ...note });
                    }
                });
            }
            
            transposedMeasures.push(transposedMeasure);
        });
        
        return transposedMeasures;
    }

    /**
     * Detect chord from notes
     */
    detectChord(vexFlowNotes) {
        if (!vexFlowNotes || vexFlowNotes.length === 0) {
            return null;
        }
        
        // Extract pitch classes
        const pitchClasses = vexFlowNotes.map(note => {
            const { note: noteName, accidental } = this.parseVexFlowNote(note);
            const fullNote = noteName.toUpperCase() + (accidental || '');
            return this.noteMap[fullNote];
        }).sort((a, b) => a - b);
        
        // Remove duplicates
        const uniquePitches = [...new Set(pitchClasses)];
        
        if (uniquePitches.length < 2) {
            return { root: this.noteNames[uniquePitches[0]], type: 'single' };
        }
        
        // Try to match chord pattern
        const root = uniquePitches[0];
        const intervals = uniquePitches.map(p => (p - root + 12) % 12).sort((a, b) => a - b);
        
        // Match against known chord templates
        for (const [chordType, template] of Object.entries(this.chordTemplates)) {
            if (this.arraysEqual(intervals, template)) {
                return {
                    root: this.noteNames[root],
                    type: chordType,
                    notes: uniquePitches.map(p => this.noteNames[p]),
                    symbol: this.getChordSymbol(this.noteNames[root], chordType)
                };
            }
        }
        
        // Unknown chord
        return {
            root: this.noteNames[root],
            type: 'unknown',
            notes: uniquePitches.map(p => this.noteNames[p]),
            intervals: intervals
        };
    }

    /**
     * Generate chord from root and type
     */
    generateChord(root, chordType, octave = 4) {
        const template = this.chordTemplates[chordType];
        if (!template) {
            console.warn('Unknown chord type:', chordType);
            return [];
        }
        
        const rootPitch = this.noteMap[root.toUpperCase()];
        const chordNotes = [];
        
        template.forEach((interval, index) => {
            const pitch = (rootPitch + interval) % 12;
            const octaveAdjust = Math.floor((rootPitch + interval) / 12);
            const noteOctave = octave + octaveAdjust;
            
            chordNotes.push(this.toVexFlowFormat(this.noteNames[pitch], noteOctave));
        });
        
        return chordNotes;
    }

    /**
     * Get chord symbol (e.g., "Cmaj7", "Dm", "G7")
     */
    getChordSymbol(root, chordType) {
        const symbols = {
            'major': '',
            'minor': 'm',
            'diminished': 'dim',
            'augmented': 'aug',
            'sus2': 'sus2',
            'sus4': 'sus4',
            'major7': 'maj7',
            'minor7': 'm7',
            'dominant7': '7',
            'diminished7': 'dim7',
            'halfDiminished7': 'm7♭5',
            'majorAdd9': 'add9',
            'minor6': 'm6',
            'major6': '6'
        };
        
        return root + (symbols[chordType] || '');
    }

    /**
     * Generate guitar tablature for notes
     */
    generateGuitarTab(vexFlowNotes, tuning = 'standard') {
        const tuningNotes = this.guitarTuning[tuning];
        const tab = [];
        
        vexFlowNotes.forEach(note => {
            const targetPitch = this.vexFlowToMidiNote(note);
            let bestString = -1;
            let bestFret = 999;
            
            // Find best position on fretboard
            tuningNotes.forEach((stringNote, stringIndex) => {
                const openStringPitch = this.vexFlowToMidiNote(
                    this.toVexFlowFormat(stringNote.slice(0, -1), stringNote.slice(-1))
                );
                const fret = targetPitch - openStringPitch;
                
                // Check if playable (0-24 frets)
                if (fret >= 0 && fret <= 24) {
                    // Prefer lower frets
                    if (fret < bestFret) {
                        bestFret = fret;
                        bestString = stringIndex;
                    }
                }
            });
            
            if (bestString !== -1) {
                tab.push({
                    string: bestString + 1, // 1-indexed
                    fret: bestFret,
                    note: note
                });
            }
        });
        
        return tab;
    }

    /**
     * Suggest chord progressions
     */
    suggestChordProgression(key, length = 4) {
        const commonProgressions = {
            'major': [
                [0, 3, 4, 0],    // I-IV-V-I
                [0, 5, 3, 4],    // I-vi-IV-V
                [0, 4, 5, 0],    // I-V-vi-IV
                [0, 3, 0, 4]     // I-IV-I-V
            ],
            'minor': [
                [0, 3, 4, 0],    // i-iv-v-i
                [0, 5, 3, 4],    // i-VI-III-VII
                [0, 6, 3, 4],    // i-VII-VI-V
                [0, 3, 4, 4]     // i-iv-v-V
            ]
        };
        
        const keyRoot = key.replace(/[mb]/g, '');
        const isMinor = key.includes('m');
        const scaleType = isMinor ? 'minor' : 'major';
        const scale = this.generateScale(keyRoot, scaleType);
        
        const progressions = commonProgressions[scaleType];
        const progression = progressions[Math.floor(Math.random() * progressions.length)];
        
        return progression.map(degree => {
            const note = scale[degree];
            const chordType = this.getChordTypeForDegree(degree, scaleType);
            return {
                root: note,
                type: chordType,
                symbol: this.getChordSymbol(note, chordType)
            };
        });
    }

    /**
     * Generate scale from root
     */
    generateScale(root, scaleType = 'major') {
        const intervals = this.scaleIntervals[scaleType] || this.scaleIntervals['major'];
        const rootPitch = this.noteMap[root.toUpperCase()];
        
        return intervals.map(interval => {
            const pitch = (rootPitch + interval) % 12;
            return this.noteNames[pitch];
        });
    }

    /**
     * Get chord type for scale degree
     */
    getChordTypeForDegree(degree, scaleType) {
        const majorChords = ['major', 'minor', 'minor', 'major', 'major', 'minor', 'diminished'];
        const minorChords = ['minor', 'diminished', 'major', 'minor', 'minor', 'major', 'major'];
        
        const chords = scaleType === 'minor' ? minorChords : majorChords;
        return chords[degree % 7];
    }

    /**
     * Check voice leading rules
     */
    checkVoiceLeading(chord1, chord2) {
        const issues = [];
        
        const pitches1 = chord1.map(note => this.vexFlowToMidiNote(note));
        const pitches2 = chord2.map(note => this.vexFlowToMidiNote(note));
        
        // Check for parallel fifths and octaves
        for (let i = 0; i < pitches1.length; i++) {
            for (let j = i + 1; j < pitches1.length; j++) {
                const interval1 = Math.abs(pitches1[i] - pitches1[j]) % 12;
                const interval2 = Math.abs(pitches2[i] - pitches2[j]) % 12;
                
                if (interval1 === interval2) {
                    if (interval1 === 7) {
                        issues.push('Parallel fifths detected');
                    } else if (interval1 === 0) {
                        issues.push('Parallel octaves detected');
                    }
                }
            }
        }
        
        // Check for large leaps
        for (let i = 0; i < Math.min(pitches1.length, pitches2.length); i++) {
            const leap = Math.abs(pitches2[i] - pitches1[i]);
            if (leap > 12) {
                issues.push(`Large leap (${leap} semitones) in voice ${i + 1}`);
            }
        }
        
        return {
            valid: issues.length === 0,
            issues: issues
        };
    }

    /**
     * Suggest harmonization for melody
     */
    harmonizeMelody(melodyNotes, key) {
        const harmonizedMeasures = [];
        const scale = this.generateScale(key, 'major');
        
        melodyNotes.forEach(note => {
            const { note: noteName } = this.parseVexFlowNote(note);
            const pitch = this.noteMap[noteName.toUpperCase()] || 0;
            
            // Find scale degree
            const scalePitches = scale.map(n => this.noteMap[n]);
            const degree = scalePitches.indexOf(pitch % 12);
            
            if (degree !== -1) {
                const chordType = this.getChordTypeForDegree(degree, 'major');
                const chordRoot = scale[degree];
                const chord = this.generateChord(chordRoot, chordType, 3);
                
                harmonizedMeasures.push({
                    melody: note,
                    chord: chord,
                    symbol: this.getChordSymbol(chordRoot, chordType)
                });
            }
        });
        
        return harmonizedMeasures;
    }

    // Helper methods
    parseVexFlowNote(vexFlowNote) {
        const match = vexFlowNote.match(/^([a-g])(#|b)?\/(\d+)$/i);
        if (!match) return { note: 'c', octave: '4', accidental: '' };
        
        return {
            note: match[1].toLowerCase(),
            accidental: match[2] || '',
            octave: match[3]
        };
    }

    toVexFlowFormat(noteName, octave) {
        let note = noteName.toLowerCase();
        return `${note}/${octave}`;
    }

    vexFlowToMidiNote(vexFlowNote) {
        const { note, accidental, octave } = this.parseVexFlowNote(vexFlowNote);
        const noteName = note.toUpperCase() + (accidental || '');
        const pitchClass = this.noteMap[noteName] || 0;
        return pitchClass + (parseInt(octave) + 1) * 12;
    }

    arraysEqual(arr1, arr2) {
        if (arr1.length !== arr2.length) return false;
        for (let i = 0; i < arr1.length; i++) {
            if (arr1[i] !== arr2[i]) return false;
        }
        return true;
    }
}
