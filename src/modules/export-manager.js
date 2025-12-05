// PATH: src/modules/export-manager.js
// DScribe - Export Manager (Phase 4)

const fs = require('fs-extra');
const path = require('path');
const { jsPDF } = require('jspdf');
const { Midi } = require('@tonejs/midi');

class ExportManager {
    constructor(logger) {
        this.logger = logger;
    }

    /**
     * Export project to PDF using VexFlow rendering
     * @param {Object} projectData - Project data with measures, title, composer
     * @param {string} outputPath - Full path to save PDF
     * @param {HTMLCanvasElement} canvas - Canvas with rendered VexFlow score
     */
    async exportToPDF(projectData, outputPath, canvas) {
        try {
            this.logger.info('Exporting to PDF:', outputPath);
            
            // Create PDF document (A4 landscape for sheet music)
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });
            
            // Add title and composer
            pdf.setFontSize(20);
            pdf.text(projectData.title || 'Unbenannt', 148, 15, { align: 'center' });
            
            if (projectData.composer) {
                pdf.setFontSize(12);
                pdf.text(projectData.composer, 148, 25, { align: 'center' });
            }
            
            // Add canvas image to PDF
            if (canvas) {
                const imgData = canvas.toDataURL('image/png');
                const imgWidth = 280; // mm
                const imgHeight = (canvas.height * imgWidth) / canvas.width;
                pdf.addImage(imgData, 'PNG', 8, 35, imgWidth, imgHeight);
            }
            
            // Add metadata
            pdf.setProperties({
                title: projectData.title,
                subject: 'Music Sheet created with DScribe',
                author: projectData.composer || 'DScribe',
                creator: 'DScribe Notensetzungsprogramm'
            });
            
            // Save PDF
            const pdfBuffer = Buffer.from(pdf.output('arraybuffer'));
            await fs.writeFile(outputPath, pdfBuffer);
            
            this.logger.info('PDF exported successfully');
            return { success: true, path: outputPath };
            
        } catch (error) {
            this.logger.error('PDF export failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Export canvas as PNG image
     * @param {HTMLCanvasElement} canvas - Canvas with rendered score
     * @param {string} outputPath - Full path to save PNG
     */
    async exportToPNG(canvas, outputPath) {
        try {
            this.logger.info('Exporting to PNG:', outputPath);
            
            // Get PNG data from canvas
            const dataUrl = canvas.toDataURL('image/png');
            const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            
            // Save to file
            await fs.writeFile(outputPath, buffer);
            
            this.logger.info('PNG exported successfully');
            return { success: true, path: outputPath };
            
        } catch (error) {
            this.logger.error('PNG export failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Export project to MIDI file
     * @param {Object} projectData - Project data with measures
     * @param {string} outputPath - Full path to save MIDI
     */
    async exportToMIDI(projectData, outputPath) {
        try {
            this.logger.info('Exporting to MIDI:', outputPath);
            
            const midi = new Midi();
            midi.name = projectData.title || 'Unbenannt';
            
            // Create a track
            const track = midi.addTrack();
            track.name = 'Piano';
            track.instrument.number = 0; // Acoustic Grand Piano
            
            // Set tempo
            const tempo = projectData.tempo || 120;
            midi.header.setTempo(tempo);
            
            // Convert measures to MIDI notes
            let currentTime = 0;
            const secondsPerBeat = 60 / tempo;
            
            projectData.measures.forEach((measure, measureIndex) => {
                if (measure.notes && measure.notes.length > 0) {
                    measure.notes.forEach(note => {
                        if (!note.duration || note.duration.includes('r')) {
                            // Rest - just advance time
                            currentTime += this.durationToBeats(note.duration || 'q') * secondsPerBeat;
                            return;
                        }
                        
                        // Add note(s)
                        const duration = this.durationToBeats(note.duration) * secondsPerBeat;
                        
                        note.keys.forEach(key => {
                            const midiNote = this.vexFlowNoteToMidi(key);
                            track.addNote({
                                midi: midiNote,
                                time: currentTime,
                                duration: duration,
                                velocity: 0.8
                            });
                        });
                        
                        currentTime += duration;
                    });
                } else {
                    // Empty measure - whole rest
                    currentTime += 4 * secondsPerBeat;
                }
            });
            
            // Write MIDI file
            const midiArray = midi.toArray();
            const buffer = Buffer.from(midiArray);
            await fs.writeFile(outputPath, buffer);
            
            this.logger.info('MIDI exported successfully');
            return { success: true, path: outputPath };
            
        } catch (error) {
            this.logger.error('MIDI export failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Export project to MusicXML
     * @param {Object} projectData - Project data
     * @param {string} outputPath - Full path to save MusicXML
     */
    async exportToMusicXML(projectData, outputPath) {
        try {
            this.logger.info('Exporting to MusicXML:', outputPath);
            
            const xml = this.generateMusicXML(projectData);
            await fs.writeFile(outputPath, xml, 'utf8');
            
            this.logger.info('MusicXML exported successfully');
            return { success: true, path: outputPath };
            
        } catch (error) {
            this.logger.error('MusicXML export failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Generate MusicXML string from project data
     */
    generateMusicXML(projectData) {
        const title = this.escapeXml(projectData.title || 'Unbenannt');
        const composer = this.escapeXml(projectData.composer || '');
        const keySignature = projectData.keySignature || 'C';
        const timeSignature = projectData.timeSignature || '4/4';
        const [beats, beatType] = timeSignature.split('/').map(Number);
        
        // Calculate fifths for key signature
        const fifths = this.keySignatureToFifths(keySignature);
        
        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <work>
    <work-title>${title}</work-title>
  </work>
  <identification>
    <creator type="composer">${composer}</creator>
    <encoding>
      <software>DScribe Notensetzungsprogramm</software>
      <encoding-date>${new Date().toISOString().split('T')[0]}</encoding-date>
    </encoding>
  </identification>
  <part-list>
    <score-part id="P1">
      <part-name>Piano</part-name>
    </score-part>
  </part-list>
  <part id="P1">
`;
        
        // Generate measures
        projectData.measures.forEach((measure, index) => {
            xml += `    <measure number="${index + 1}">\n`;
            
            // Add attributes to first measure
            if (index === 0) {
                xml += `      <attributes>
        <divisions>4</divisions>
        <key>
          <fifths>${fifths}</fifths>
        </key>
        <time>
          <beats>${beats}</beats>
          <beat-type>${beatType}</beat-type>
        </time>
        <clef>
          <sign>G</sign>
          <line>2</line>
        </clef>
      </attributes>
`;
            }
            
            // Add notes
            if (measure.notes && measure.notes.length > 0) {
                measure.notes.forEach(note => {
                    const isRest = !note.keys || note.keys.length === 0 || (note.duration && note.duration.includes('r'));
                    const duration = this.vexFlowDurationToMusicXML(note.duration || 'q');
                    
                    if (isRest) {
                        xml += `      <note>
        <rest/>
        <duration>${duration.divisions}</duration>
        <type>${duration.type}</type>
      </note>
`;
                    } else {
                        note.keys.forEach((key, keyIndex) => {
                            const { step, octave, alter } = this.parseVexFlowNote(key);
                            
                            xml += `      <note${keyIndex > 0 ? '>\n        <chord/>' : ''}
        <pitch>
          <step>${step}</step>
${alter !== 0 ? `          <alter>${alter}</alter>\n` : ''}          <octave>${octave}</octave>
        </pitch>
        <duration>${duration.divisions}</duration>
        <type>${duration.type}</type>
${duration.dot ? '        <dot/>\n' : ''}      </note>
`;
                        });
                    }
                });
            } else {
                // Empty measure - whole rest
                xml += `      <note>
        <rest measure="yes"/>
        <duration>16</duration>
      </note>
`;
            }
            
            xml += `    </measure>\n`;
        });
        
        xml += `  </part>
</score-partwise>`;
        
        return xml;
    }

    /**
     * Helper: VexFlow note to MIDI number
     */
    vexFlowNoteToMidi(noteString) {
        const match = noteString.match(/^([a-g])(#|b)?\/(\d+)$/i);
        if (!match) return 60; // Middle C
        
        const [, note, accidental, octave] = match;
        const noteMap = {
            'c': 0, 'd': 2, 'e': 4, 'f': 5, 'g': 7, 'a': 9, 'b': 11
        };
        
        let midiNote = noteMap[note.toLowerCase()] || 0;
        if (accidental === '#') midiNote += 1;
        if (accidental === 'b') midiNote -= 1;
        
        midiNote += (parseInt(octave) + 1) * 12;
        
        return midiNote;
    }

    /**
     * Helper: VexFlow duration to beats
     */
    durationToBeats(duration) {
        const baseDuration = duration.replace(/[rd]/g, '');
        const hasDot = duration.includes('d');
        
        const durationMap = {
            'w': 4, 'h': 2, 'q': 1, '8': 0.5,
            '16': 0.25, '32': 0.125, '64': 0.0625
        };
        
        let beats = durationMap[baseDuration] || 1;
        if (hasDot) beats *= 1.5;
        
        return beats;
    }

    /**
     * Helper: Parse VexFlow note format
     */
    parseVexFlowNote(noteString) {
        const match = noteString.match(/^([a-g])(#|b)?\/(\d+)$/i);
        if (!match) return { step: 'C', octave: 4, alter: 0 };
        
        const [, note, accidental, octave] = match;
        const step = note.toUpperCase();
        const alter = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0;
        
        return { step, octave: parseInt(octave), alter };
    }

    /**
     * Helper: VexFlow duration to MusicXML
     */
    vexFlowDurationToMusicXML(duration) {
        const baseDuration = duration.replace(/[rd]/g, '');
        const hasDot = duration.includes('d');
        
        const typeMap = {
            'w': { type: 'whole', divisions: 16 },
            'h': { type: 'half', divisions: 8 },
            'q': { type: 'quarter', divisions: 4 },
            '8': { type: 'eighth', divisions: 2 },
            '16': { type: '16th', divisions: 1 },
            '32': { type: '32nd', divisions: 0.5 },
            '64': { type: '64th', divisions: 0.25 }
        };
        
        const result = typeMap[baseDuration] || typeMap['q'];
        
        return {
            type: result.type,
            divisions: hasDot ? result.divisions * 1.5 : result.divisions,
            dot: hasDot
        };
    }

    /**
     * Helper: Key signature to fifths
     */
    keySignatureToFifths(key) {
        const fifthsMap = {
            'Cb': -7, 'Gb': -6, 'Db': -5, 'Ab': -4, 'Eb': -3, 'Bb': -2, 'F': -1,
            'C': 0,
            'G': 1, 'D': 2, 'A': 3, 'E': 4, 'B': 5, 'F#': 6, 'C#': 7
        };
        return fifthsMap[key] || 0;
    }

    /**
     * Helper: Escape XML special characters
     */
    escapeXml(unsafe) {
        return unsafe
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }
}

module.exports = ExportManager;
