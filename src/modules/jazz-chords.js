// PATH: src/modules/jazz-chords.js
// DScribe - Jazz Chord Extensions & Voicings
// Unterstützt erweiterte Akkorde: 9ths, 11ths, 13ths, alterations, etc.

class JazzChords {
    constructor() {
        this.extendedChordTemplates = {
            // Dominante Akkorde
            'dominant9': [0, 4, 7, 10, 14],
            'dominant11': [0, 4, 7, 10, 14, 17],
            'dominant13': [0, 4, 7, 10, 14, 21],
            'dominantAlt': [0, 4, 7, 10, 15], // ♭5

            // Major Akkorde
            'major9': [0, 4, 7, 14],
            'major11': [0, 4, 7, 14, 17],
            'major13': [0, 4, 7, 14, 21],
            'major7sharp9': [0, 4, 7, 11, 15],

            // Minor Akkorde
            'minor9': [0, 3, 7, 10, 14],
            'minor11': [0, 3, 7, 10, 14, 17],
            'minor13': [0, 3, 7, 10, 14, 21],

            // Half-Diminished
            'halfDim9': [0, 3, 6, 10, 14],
            'halfDim11': [0, 3, 6, 10, 14, 17],

            // Alterations
            'dominant7flat5': [0, 4, 6, 10],
            'dominant7sharp5': [0, 4, 8, 10],
            'dominant7flatnine': [0, 4, 7, 10, 13],
            'dominant7sharpnine': [0, 4, 7, 10, 15],

            // Special
            'augMajor7': [0, 4, 8, 11],
            'minorMajor7': [0, 3, 7, 11],
            'sus': [0, 5, 7],
            'sus9': [0, 2, 5, 7]
        };

        this.voicingStyles = {
            'drop2': this.voicingDrop2,
            'drop3': this.voicingDrop3,
            'rootPosition': this.voicingRootPosition,
            'firstInversion': this.voicingFirstInversion,
            'secondInversion': this.voicingSecondInversion
        };

        this.noteMap = {
            'c': 0, 'd': 2, 'e': 4, 'f': 5, 'g': 7, 'a': 9, 'b': 11
        };

        this.noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    }

    /**
     * Generiert erweiterten Akkord
     */
    generateExtendedChord(root, chordType, octave = 3) {
        const template = this.extendedChordTemplates[chordType];
        if (!template) {
            console.warn('Unknown jazz chord type:', chordType);
            return [];
        }

        const rootPitch = this.noteMap[root.toLowerCase()] || 0;
        const chordNotes = [];

        template.forEach((interval, index) => {
            const semitone = (rootPitch + interval) % 12;
            const octaveAdjust = Math.floor((rootPitch + interval) / 12);
            const noteOctave = octave + octaveAdjust;

            chordNotes.push({
                note: this.noteNames[semitone],
                octave: noteOctave,
                interval: interval,
                vexFlow: `${this.noteNames[semitone].toLowerCase()}/${noteOctave}`
            });
        });

        return chordNotes;
    }

    /**
     * Generiert Akkord mit Voicing-Stil
     */
    generateVoicing(root, chordType, voicingStyle = 'rootPosition', octave = 3) {
        const extChord = this.generateExtendedChord(root, chordType, octave);

        if (voicingStyle === 'drop2') {
            return this.voicingDrop2(extChord);
        } else if (voicingStyle === 'drop3') {
            return this.voicingDrop3(extChord);
        } else if (voicingStyle === 'firstInversion') {
            return this.voicingFirstInversion(extChord);
        } else if (voicingStyle === 'secondInversion') {
            return this.voicingSecondInversion(extChord);
        }

        return extChord;
    }

    /**
     * Drop 2 Voicing
     */
    voicingDrop2(notes) {
        if (notes.length < 4) return notes;

        const voicing = [
            notes[0],           // Root
            notes[2],           // drop
            notes[1],           // third
            notes[3]            // top
        ];

        // Octave adjustment für Drop 2
        voicing[1].octave -= 1;

        return voicing;
    }

    /**
     * Drop 3 Voicing
     */
    voicingDrop3(notes) {
        if (notes.length < 4) return notes;

        const voicing = [
            notes[0],           // Root
            notes[3],           // drop
            notes[1],           // third
            notes[2]            // fifth
        ];

        // Octave adjustment
        voicing[1].octave -= 1;
        voicing[2].octave -= 1;

        return voicing;
    }

    /**
     * Root Position Voicing
     */
    voicingRootPosition(notes) {
        return notes;
    }

    /**
     * First Inversion (Akkord mit Terz im Bass)
     */
    voicingFirstInversion(notes) {
        const voicing = [
            notes[1],           // Third
            notes[0],           // Root
            notes[2],           // Fifth
            notes[3]            // Seventh
        ];

        voicing[1].octave += 1;
        voicing[2].octave += 1;
        voicing[3].octave += 1;

        return voicing;
    }

    /**
     * Second Inversion (Akkord mit Quinte im Bass)
     */
    voicingSecondInversion(notes) {
        const voicing = [
            notes[2],           // Fifth
            notes[0],           // Root
            notes[1],           // Third
            notes[3]            // Seventh
        ];

        voicing[1].octave += 1;
        voicing[2].octave += 1;
        voicing[3].octave += 1;

        return voicing;
    }

    /**
     * Schlägt Jazz-Akkord-Progression vor
     */
    suggestJazzProgression(key, style = 'bebop') {
        const progressions = {
            'bebop': [
                { root: 'i', type: 'minor7' },
                { root: 'iv', type: 'minor7' },
                { root: 'i', type: 'minor7' },
                { root: 'v', type: 'dominant7' }
            ],
            'modal': [
                { root: 'i', type: 'major9' },
                { root: 'vi', type: 'minor7' },
                { root: 'ii', type: 'minor7' },
                { root: 'v', type: 'dominant9' }
            ],
            'blues': [
                { root: 'i', type: 'dominant7' },
                { root: 'i', type: 'dominant7' },
                { root: 'iv', type: 'dominant7' },
                { root: 'v', type: 'dominant7' }
            ]
        };

        const progression = progressions[style] || progressions['bebop'];
        const scale = this.generateJazzScale(key);

        return progression.map(chord => {
            const root = scale[chord.root === 'i' ? 0 : (chord.root === 'iv' ? 3 : (chord.root === 'v' ? 4 : 5))];
            return {
                root: root,
                type: chord.type,
                symbol: `${root}${this.getChordSymbol(chord.type)}`
            };
        });
    }

    /**
     * Jazz-Skala generieren
     */
    generateJazzScale(key) {
        // Jazz verwendet meist Dorian/Mixolydian
        const intervals = [0, 2, 3, 5, 7, 9, 10]; // Dorian
        const keyPitch = this.noteMap[key.toLowerCase()] || 0;

        return intervals.map(interval => {
            const pitch = (keyPitch + interval) % 12;
            return this.noteNames[pitch];
        });
    }

    /**
     * Gibt Akkord-Symbol für Jazz-Akkord zurück
     */
    getChordSymbol(chordType) {
        const symbols = {
            'dominant7': '7',
            'dominant9': '9',
            'dominant11': '11',
            'dominant13': '13',
            'major9': 'Δ9',
            'major11': 'Δ11',
            'major13': 'Δ13',
            'minor7': 'm7',
            'minor9': 'm9',
            'minor11': 'm11',
            'minor13': 'm13',
            'halfDim9': 'm7♭5(9)',
            'halfDim11': 'm7♭5(11)',
            'augMajor7': '+Δ7',
            'minorMajor7': 'm(Δ7)'
        };

        return symbols[chordType] || '?';
    }

    /**
     * Erkennt Jazz-Akkord von Noten
     */
    detectJazzChord(vexFlowNotes) {
        if (!vexFlowNotes || vexFlowNotes.length < 3) {
            return null;
        }

        const pitches = vexFlowNotes.map(note => {
            const match = note.match(/([a-g])([#b]?)\/(\d)/i);
            if (!match) return 0;

            let pitch = this.noteMap[match[1].toLowerCase()] || 0;
            if (match[2] === '#') pitch++;
            if (match[2] === 'b') pitch--;

            return pitch % 12;
        }).sort((a, b) => a - b);

        // Finde Root (tiefste Note)
        const root = pitches[0];
        const intervals = pitches.map(p => (p - root + 12) % 12).sort((a, b) => a - b);

        // Vergleiche mit Templates
        for (const [chordType, template] of Object.entries(this.extendedChordTemplates)) {
            if (this.arraysEqual(intervals, template)) {
                return {
                    root: this.noteNames[root],
                    type: chordType,
                    symbol: `${this.noteNames[root]}${this.getChordSymbol(chordType)}`
                };
            }
        }

        return null;
    }

    /**
     * Array-Vergleich Helper
     */
    arraysEqual(a, b) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    }

    /**
     * Generiert Jazz-Lead-Sheet
     */
    generateLeadSheet(title, composer, chords, tempo = 120) {
        let sheet = `╔═══════════════════════════════════════╗\n`;
        sheet += `║         JAZZ LEAD SHEET\n`;
        sheet += `║ Title: ${title}\n`;
        sheet += `║ Composer: ${composer}\n`;
        sheet += `║ Tempo: ${tempo} BPM\n`;
        sheet += `╚═══════════════════════════════════════╝\n\n`;

        let measureCount = 1;
        for (const chord of chords) {
            sheet += `| ${chord.symbol.padEnd(10)} `;
            if (measureCount % 4 === 0) {
                sheet += `|\n`;
            }
            measureCount++;
        }

        return sheet;
    }

    /**
     * Lead-Sheet nach PDF konvertieren
     */
    exportLeadSheetPDF(projectData, outputPath) {
        const jsPDF = window.jsPDF;
        if (!jsPDF) {
            console.error('jsPDF not available');
            return { success: false };
        }

        const doc = new jsPDF.jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
        });

        doc.setFontSize(16);
        doc.text(projectData.title || 'Lead Sheet', 148, 15, { align: 'center' });

        doc.setFontSize(10);
        doc.text(`Composer: ${projectData.composer || 'Unknown'}`, 148, 25, { align: 'center' });
        doc.text(`Tempo: ${projectData.tempo || 120} BPM`, 148, 35, { align: 'center' });

        // Akkorde rendern
        doc.setFontSize(14);
        let y = 50;
        let x = 20;
        let measureCount = 0;

        for (const measure of projectData.measures) {
            if (measure.suggestedChords) {
                for (const chord of measure.suggestedChords) {
                    doc.text(chord.symbol, x, y);
                    x += 30;
                    measureCount++;

                    if (measureCount % 4 === 0) {
                        x = 20;
                        y += 20;
                    }
                }
            }
        }

        doc.save(outputPath || 'jazz-leadsheet.pdf');
        return { success: true };
    }
}

module.exports = JazzChords;
