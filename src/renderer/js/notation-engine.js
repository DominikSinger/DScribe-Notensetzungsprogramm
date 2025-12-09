// PATH: src/renderer/js/notation-engine.js
// DScribe - Notation Engine (VexFlow Integration)

// Load VexFlow from CDN
const VF = Vex.Flow;

class NotationEngine {
    constructor(containerId) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        this.activeNoteType = 'q'; // quarter note
        this.activeRestType = null;
        this.activeAccidental = null;
        this.currentClef = 'treble';
        this.currentKeySignature = 'C';
        this.currentTimeSignature = '4/4';
        this.currentTempo = 120;
        
        // Score data
        this.measures = [];
        this.voices = [];
        this.currentVoice = 0;
        this.currentMeasure = 0;
        
        // VexFlow objects
        this.renderer = null;
        this.context = null;
        this.staves = [];
        
        // Note durations mapping
        this.noteDurations = {
            'whole': 'w',
            'half': 'h',
            'quarter': 'q',
            'eighth': '8',
            'sixteenth': '16',
            'thirtysecond': '32',
            'sixtyfourth': '64'
        };
        
        this.initializeCanvas();
        this.initializeScore();
    }

    initializeCanvas() {
        // Clear container
        this.container.innerHTML = '';
        
        // Get container dimensions
        const containerWidth = this.container.clientWidth || 800;
        const containerHeight = Math.max(this.container.clientHeight || 600, 600);
        
        // Create canvas for VexFlow with responsive sizing
        const canvas = document.createElement('canvas');
        canvas.id = 'vexflow-canvas';
        canvas.width = Math.min(containerWidth - 40, 800);  // Max 800px width
        canvas.height = containerHeight;
        this.container.appendChild(canvas);
        
        // Create VexFlow renderer
        this.renderer = new VF.Renderer(canvas, VF.Renderer.Backends.CANVAS);
        this.context = this.renderer.getContext();
    }

    initializeScore() {
        // Create initial empty measure with 4/4 time
        this.measures = [{
            notes: [],
            timeSignature: '4/4',
            keySignature: 'C',
            clef: 'treble'
        }];
        
        this.render();
    }

    loadProjectData(projectData) {
        this.measures = projectData.measures || [];
        this.currentKeySignature = projectData.keySignature || 'C';
        this.currentTimeSignature = projectData.timeSignature || '4/4';
        this.currentClef = projectData.clef || 'treble';
        this.currentTempo = projectData.tempo || 120;
        
        if (this.measures.length === 0) {
            this.initializeScore();
        } else {
            this.render();
        }
    }

    clear() {
        this.measures = [];
        this.initializeCanvas();
        this.initializeScore();
    }

    loadProject(projectData) {
        this.loadProjectData(projectData);
    }

    setActiveNoteType(noteType) {
        this.activeNoteType = this.noteDurations[noteType] || 'q';
        this.activeRestType = null;
        console.log('Active note type:', this.activeNoteType);
    }

    setActiveRestType(restType) {
        this.activeRestType = this.noteDurations[restType] || 'qr';
        this.activeNoteType = null;
        console.log('Active rest type:', this.activeRestType);
    }

    setActiveAccidental(accidental) {
        this.activeAccidental = accidental;
        console.log('Active accidental:', this.activeAccidental);
    }

    setClef(clef) {
        this.currentClef = clef;
        if (this.measures.length > 0) {
            this.measures[0].clef = clef;
        }
        this.render();
    }

    setKeySignature(key) {
        this.currentKeySignature = key;
        if (this.measures.length > 0) {
            this.measures[0].keySignature = key;
        }
        this.render();
    }

    setTimeSignature(time) {
        this.currentTimeSignature = time;
        if (this.measures.length > 0) {
            this.measures[0].timeSignature = time;
        }
        this.render();
    }

    addNote(pitch = 'c/4', duration = null) {
        if (!duration) {
            duration = this.activeNoteType || 'q';
        }
        
        const measureIndex = this.currentMeasure;
        if (!this.measures[measureIndex]) {
            this.measures[measureIndex] = {
                notes: [],
                timeSignature: this.currentTimeSignature,
                keySignature: this.currentKeySignature,
                clef: this.currentClef
            };
        }
        
        const note = {
            keys: [pitch],
            duration: duration,
            accidental: this.activeAccidental
        };
        
        this.measures[measureIndex].notes.push(note);
        this.render();
        return note;
    }

    addRest(duration = null) {
        if (!duration) {
            duration = this.activeRestType || 'qr';
        }
        
        const measureIndex = this.currentMeasure;
        if (!this.measures[measureIndex]) {
            this.measures[measureIndex] = {
                notes: [],
                timeSignature: this.currentTimeSignature,
                keySignature: this.currentKeySignature,
                clef: this.currentClef
            };
        }
        
        const rest = {
            keys: ['b/4'],
            duration: duration + 'r',
            isRest: true
        };
        
        this.measures[measureIndex].notes.push(rest);
        this.render();
        return rest;
    }

    addMeasure() {
        this.measures.push({
            notes: [],
            timeSignature: this.currentTimeSignature,
            keySignature: this.currentKeySignature,
            clef: this.currentClef
        });
        this.render();
    }

    removeNote(noteIndex, measureIndex = null) {
        if (measureIndex === null) {
            measureIndex = this.currentMeasure;
        }
        
        if (this.measures[measureIndex] && this.measures[measureIndex].notes[noteIndex]) {
            this.measures[measureIndex].notes.splice(noteIndex, 1);
            this.render();
        }
    }

    getNotes() {
        // Flatten all notes from all measures
        const allNotes = [];
        this.measures.forEach(measure => {
            allNotes.push(...measure.notes);
        });
        return allNotes;
    }

    render() {
        try {
            // Clear canvas
            this.context.clear();
            
            if (this.measures.length === 0) {
                // Create at least one empty stave
                const stave = new VF.Stave(40, 40, 300);
                stave.addClef(this.currentClef);
                stave.addKeySignature(this.getVexFlowKeySignature(this.currentKeySignature));
                stave.addTimeSignature(this.currentTimeSignature);
                stave.setContext(this.context).draw();
                return;
            }
            
            let currentY = 40;
            const stavesPerLine = 1;
            
            // Render each measure
            this.measures.forEach((measure, index) => {
                const x = 10 + (index % 4) * 170;
                const y = currentY + Math.floor(index / 4) * 150;
                
                // Create stave
                const stave = new VF.Stave(x, y, 160);
                
                // Add clef, key signature, time signature to first measure
                if (index === 0) {
                    stave.addClef(measure.clef || this.currentClef);
                    stave.addKeySignature(this.getVexFlowKeySignature(measure.keySignature || this.currentKeySignature));
                    stave.addTimeSignature(measure.timeSignature || this.currentTimeSignature);
                }
                
                // Draw stave
                stave.setContext(this.context).draw();
                
                // Create notes for this measure
                if (measure.notes && measure.notes.length > 0) {
                    const vexNotes = [];
                    
                    measure.notes.forEach(note => {
                        try {
                            const vexNote = new VF.StaveNote({
                                keys: note.keys || ['b/4'],
                                duration: note.duration || 'q',
                                clef: measure.clef || this.currentClef
                            });
                            
                            // Add accidentals
                            if (note.accidental) {
                                const accidentalMap = {
                                    'sharp': '#',
                                    'flat': 'b',
                                    'natural': 'n'
                                };
                                vexNote.addAccidental(0, new VF.Accidental(accidentalMap[note.accidental] || note.accidental));
                            }
                            
                            vexNotes.push(vexNote);
                        } catch (error) {
                            console.error('Error creating note:', error);
                        }
                    });
                    
                    if (vexNotes.length > 0) {
                        // Create voice
                        const voice = new VF.Voice({
                            num_beats: this.getBeatsFromTimeSignature(measure.timeSignature),
                            beat_value: this.getBeatValueFromTimeSignature(measure.timeSignature)
                        });
                        
                        voice.setStrict(false);
                        voice.addTickables(vexNotes);
                        
                        // Format and draw
                        const formatter = new VF.Formatter();
                        formatter.joinVoices([voice]).format([voice], 140);
                        voice.draw(this.context, stave);
                    }
                }
            });
            
            console.log('Rendered', this.measures.length, 'measures');
        } catch (error) {
            console.error('Error rendering score:', error);
        }
    }

    getVexFlowKeySignature(key) {
        // Convert our key signature format to VexFlow format
        const keyMap = {
            'C': 'C',
            'G': 'G',
            'D': 'D',
            'A': 'A',
            'E': 'E',
            'B': 'B',
            'F#': 'F#',
            'C#': 'C#',
            'F': 'F',
            'Bb': 'Bb',
            'Eb': 'Eb',
            'Ab': 'Ab',
            'Db': 'Db',
            'Gb': 'Gb',
            'Cb': 'Cb'
        };
        
        return keyMap[key] || 'C';
    }

    getBeatsFromTimeSignature(timeSig) {
        const parts = (timeSig || '4/4').split('/');
        return parseInt(parts[0]) || 4;
    }

    getBeatValueFromTimeSignature(timeSig) {
        const parts = (timeSig || '4/4').split('/');
        return parseInt(parts[1]) || 4;
    }

    addLyrics(text, noteIndex, measureIndex = null) {
        if (measureIndex === null) {
            measureIndex = this.currentMeasure;
        }
        if (this.measures[measureIndex] && this.measures[measureIndex].notes[noteIndex]) {
            this.measures[measureIndex].notes[noteIndex].lyrics = text;
            this.renderLyrics(measureIndex);
            console.log('Lyrics added:', text);
        }
    }
    
    renderLyrics(measureIndex) {
        const measure = this.measures[measureIndex];
        if (!measure) return;
        const ctx = this.canvas?.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = '#000000';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        if (measure.notes) {
            measure.notes.forEach((note, idx) => {
                if (note.lyrics) {
                    const x = 50 + (idx * 40);
                    const y = 150;
                    ctx.fillText(note.lyrics, x, y);
                }
            });
        }
    }

    addChordSymbol(chord, measureIndex = null) {
        if (measureIndex === null) {
            measureIndex = this.currentMeasure;
        }
        if (this.measures[measureIndex]) {
            this.measures[measureIndex].chord = chord;
            this.renderChordSymbol(measureIndex, chord);
            console.log('Chord symbol added:', chord);
        }
    }
    
    renderChordSymbol(measureIndex, chord) {
        const ctx = this.canvas?.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = '#0066CC';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        const x = 50 + (measureIndex * 40);
        const y = 40;
        ctx.fillText(chord, x, y);
    }

    transpose(semitones) {
        const noteMap = { 'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11 };
        const measure = this.measures[this.currentMeasure];
        if (!measure || !measure.notes) return;
        
        measure.notes.forEach(note => {
            if (note.key) {
                const noteName = note.key.charAt(0);
                const octave = parseInt(note.key.substring(1));
                let noteValue = noteMap[noteName] || 0;
                noteValue += semitones;
                
                let newOctave = octave;
                while (noteValue < 0) { noteValue += 12; newOctave--; }
                while (noteValue >= 12) { noteValue -= 12; newOctave++; }
                
                const newNoteName = Object.keys(noteMap).find(k => noteMap[k] === noteValue);
                note.key = `${newNoteName}${newOctave}`;
            }
        });
        
        console.log(`Transposed by ${semitones} semitones`);
        this.render();
    }

    addDot(noteIndex, measureIndex = null) {
        if (measureIndex === null) {
            measureIndex = this.currentMeasure;
        }
        
        if (this.measures[measureIndex] && this.measures[measureIndex].notes[noteIndex]) {
            const note = this.measures[measureIndex].notes[noteIndex];
            note.duration += 'd';
            this.render();
        }
    }

    makeTriplet(noteIndices, measureIndex = null) {
        if (measureIndex === null) {
            measureIndex = this.currentMeasure;
        }
        
        const measure = this.measures[measureIndex];
        if (!measure || !measure.notes) return;
        
        noteIndices.forEach(idx => {
            if (measure.notes[idx]) {
                measure.notes[idx].triplet = true;
                measure.notes[idx].duration = this.calculateTripletDuration(measure.notes[idx].duration);
            }
        });
        
        console.log('Triplet created for notes:', noteIndices);
        this.render();
    }
    
    calculateTripletDuration(duration) {
        // Triplets are 2/3 of the original duration
        const durationMap = { 'w': 4, 'h': 2, 'q': 1, '8': 0.5, '16': 0.25 };
        const value = durationMap[duration] || 1;
        return value * 2 / 3;
    }
}
