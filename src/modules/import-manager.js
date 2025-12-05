// PATH: src/modules/import-manager.js
// DScribe - Import Manager (Phase 4)

const fs = require('fs-extra');
const path = require('path');
const { Midi } = require('@tonejs/midi');
const xml2js = require('xml2js');

class ImportManager {
    constructor(logger) {
        this.logger = logger;
    }

    /**
     * Import MIDI file and convert to DScribe project format
     * @param {string} filePath - Path to MIDI file
     */
    async importFromMIDI(filePath) {
        try {
            this.logger.info('Importing from MIDI:', filePath);
            
            const midiData = await fs.readFile(filePath);
            const midi = new Midi(midiData);
            
            // Create project structure
            const project = {
                title: path.basename(filePath, '.mid'),
                composer: '',
                tempo: Math.round(midi.header.tempos[0]?.bpm || 120),
                timeSignature: this.midiTimeSignatureToString(midi.header.timeSignatures[0]),
                keySignature: 'C',
                measures: []
            };
            
            // Get first track
            const track = midi.tracks[0];
            if (!track) {
                throw new Error('No tracks found in MIDI file');
            }
            
            // Group notes by measure (assuming 4/4 time for simplicity)
            const beatsPerMeasure = 4;
            const secondsPerBeat = 60 / project.tempo;
            const secondsPerMeasure = beatsPerMeasure * secondsPerBeat;
            
            const measures = [];
            let currentMeasure = { notes: [] };
            let measureStartTime = 0;
            
            track.notes.forEach(note => {
                // Check if we need a new measure
                while (note.time >= measureStartTime + secondsPerMeasure) {
                    measures.push(currentMeasure);
                    currentMeasure = { notes: [] };
                    measureStartTime += secondsPerMeasure;
                }
                
                // Convert MIDI note to VexFlow format
                const vexFlowNote = this.midiNoteToVexFlow(note.midi);
                const vexFlowDuration = this.midiDurationToVexFlow(note.duration, project.tempo);
                
                // Add to current measure
                currentMeasure.notes.push({
                    keys: [vexFlowNote],
                    duration: vexFlowDuration
                });
            });
            
            // Add last measure if not empty
            if (currentMeasure.notes.length > 0) {
                measures.push(currentMeasure);
            }
            
            project.measures = measures;
            
            this.logger.info('MIDI imported successfully:', measures.length, 'measures');
            return { success: true, project };
            
        } catch (error) {
            this.logger.error('MIDI import failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Import MusicXML file and convert to DScribe project format
     * @param {string} filePath - Path to MusicXML file
     */
    async importFromMusicXML(filePath) {
        try {
            this.logger.info('Importing from MusicXML:', filePath);
            
            const xmlData = await fs.readFile(filePath, 'utf8');
            const parser = new xml2js.Parser();
            const result = await parser.parseStringPromise(xmlData);
            
            // Extract data from parsed XML
            const scorePartwise = result['score-partwise'];
            const work = scorePartwise.work?.[0];
            const identification = scorePartwise.identification?.[0];
            const part = scorePartwise.part?.[0];
            
            const project = {
                title: work?.['work-title']?.[0] || path.basename(filePath, '.xml'),
                composer: identification?.creator?.[0]?._ || identification?.creator?.[0] || '',
                tempo: 120,
                timeSignature: '4/4',
                keySignature: 'C',
                measures: []
            };
            
            // Parse measures
            if (part && part.measure) {
                part.measure.forEach((measure, measureIndex) => {
                    const measureData = { notes: [] };
                    
                    // Extract attributes from first measure
                    if (measureIndex === 0 && measure.attributes) {
                        const attributes = measure.attributes[0];
                        
                        // Time signature
                        if (attributes.time) {
                            const time = attributes.time[0];
                            const beats = time.beats?.[0] || '4';
                            const beatType = time['beat-type']?.[0] || '4';
                            project.timeSignature = `${beats}/${beatType}`;
                        }
                        
                        // Key signature
                        if (attributes.key) {
                            const key = attributes.key[0];
                            const fifths = parseInt(key.fifths?.[0] || '0');
                            project.keySignature = this.fifthsToKeySignature(fifths);
                        }
                    }
                    
                    // Parse notes
                    if (measure.note) {
                        measure.note.forEach(note => {
                            const isRest = note.rest !== undefined;
                            const isChord = note.chord !== undefined;
                            
                            if (isRest) {
                                const duration = this.musicXMLDurationToVexFlow(note);
                                measureData.notes.push({
                                    keys: [],
                                    duration: duration + 'r'
                                });
                            } else if (note.pitch) {
                                const pitch = note.pitch[0];
                                const step = pitch.step?.[0] || 'C';
                                const octave = pitch.octave?.[0] || '4';
                                const alter = parseInt(pitch.alter?.[0] || '0');
                                
                                const vexFlowNote = this.musicXMLNoteToVexFlow(step, octave, alter);
                                const duration = this.musicXMLDurationToVexFlow(note);
                                
                                if (isChord && measureData.notes.length > 0) {
                                    // Add to previous note as chord
                                    const lastNote = measureData.notes[measureData.notes.length - 1];
                                    lastNote.keys.push(vexFlowNote);
                                } else {
                                    // New note
                                    measureData.notes.push({
                                        keys: [vexFlowNote],
                                        duration: duration
                                    });
                                }
                            }
                        });
                    }
                    
                    project.measures.push(measureData);
                });
            }
            
            this.logger.info('MusicXML imported successfully:', project.measures.length, 'measures');
            return { success: true, project };
            
        } catch (error) {
            this.logger.error('MusicXML import failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Helper: MIDI note number to VexFlow format
     */
    midiNoteToVexFlow(midiNote) {
        const noteNames = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];
        const octave = Math.floor(midiNote / 12) - 1;
        const noteName = noteNames[midiNote % 12];
        
        // Convert # to b for common notes
        let finalNote = noteName;
        if (noteName.includes('#')) {
            const sharpToBFlat = {
                'c#': 'db', 'd#': 'eb', 'f#': 'f#', 'g#': 'ab', 'a#': 'bb'
            };
            finalNote = sharpToBFlat[noteName] || noteName;
        }
        
        return `${finalNote}/${octave}`;
    }

    /**
     * Helper: MIDI duration to VexFlow
     */
    midiDurationToVexFlow(durationSeconds, tempo) {
        const secondsPerBeat = 60 / tempo;
        const beats = durationSeconds / secondsPerBeat;
        
        // Find closest note value
        if (beats >= 3.5) return 'w';
        if (beats >= 1.75) return 'h';
        if (beats >= 0.875) return 'q';
        if (beats >= 0.4375) return '8';
        if (beats >= 0.21875) return '16';
        if (beats >= 0.109375) return '32';
        return '64';
    }

    /**
     * Helper: MusicXML note to VexFlow format
     */
    musicXMLNoteToVexFlow(step, octave, alter) {
        let note = step.toLowerCase();
        if (alter === 1) note += '#';
        if (alter === -1) note += 'b';
        
        return `${note}/${octave}`;
    }

    /**
     * Helper: MusicXML duration to VexFlow
     */
    musicXMLDurationToVexFlow(note) {
        const type = note.type?.[0] || 'quarter';
        const hasDot = note.dot !== undefined;
        
        const typeMap = {
            'whole': 'w',
            'half': 'h',
            'quarter': 'q',
            'eighth': '8',
            '16th': '16',
            '32nd': '32',
            '64th': '64'
        };
        
        let duration = typeMap[type] || 'q';
        if (hasDot) duration += 'd';
        
        return duration;
    }

    /**
     * Helper: Fifths to key signature
     */
    fifthsToKeySignature(fifths) {
        const keyMap = {
            '-7': 'Cb', '-6': 'Gb', '-5': 'Db', '-4': 'Ab', '-3': 'Eb', '-2': 'Bb', '-1': 'F',
            '0': 'C',
            '1': 'G', '2': 'D', '3': 'A', '4': 'E', '5': 'B', '6': 'F#', '7': 'C#'
        };
        return keyMap[fifths.toString()] || 'C';
    }

    /**
     * Helper: MIDI time signature to string
     */
    midiTimeSignatureToString(timeSig) {
        if (!timeSig) return '4/4';
        return `${timeSig.timeSignature[0]}/${timeSig.timeSignature[1]}`;
    }
}

module.exports = ImportManager;
