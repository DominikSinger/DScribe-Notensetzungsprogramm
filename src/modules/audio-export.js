// PATH: src/modules/audio-export.js
// DScribe - Audio Export Module (MP3/WAV)
// Exportiert Notensatz als Audiodatei

const fs = require('fs-extra');
const path = require('path');

class AudioExport {
    constructor(logger) {
        this.logger = logger;
        this.sampleRate = 44100;
        this.bitDepth = 16;
    }

    /**
     * Exportiert Projekt als WAV-Datei
     * @param {Object} projectData - Projekt mit Noten und Tempo
     * @param {string} outputPath - Speicherort
     * @param {Object} instruments - Instrumenten-Mapping
     */
    async exportToWAV(projectData, outputPath, instruments = {}) {
        try {
            this.logger.info('Exporting to WAV:', outputPath);

            // Generiere Audio-Buffer
            const audioBuffer = await this.generateAudioBuffer(projectData, instruments);

            // Konvertiere zu WAV
            const wavBuffer = this.createWavFile(audioBuffer);

            // Speichere Datei
            await fs.writeFile(outputPath, wavBuffer);

            this.logger.info('WAV exported successfully');
            return { success: true, path: outputPath, size: wavBuffer.length };

        } catch (error) {
            this.logger.error('WAV export failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Exportiert als MP3 (via WAV-Konvertierung)
     */
    async exportToMP3(projectData, outputPath, instruments = {}) {
        try {
            this.logger.info('Exporting to MP3:', outputPath);

            // Generiere WAV
            const wavPath = outputPath.replace('.mp3', '_temp.wav');
            const wavResult = await this.exportToWAV(projectData, wavPath, instruments);

            if (!wavResult.success) {
                throw new Error('Failed to generate WAV');
            }

            // In echter Impl. würde hier MP3-Encoding stattfinden
            // Für diese Demo: Kopiere WAV als Fallback
            const mp3Data = await fs.readFile(wavPath);
            await fs.writeFile(outputPath, mp3Data);
            await fs.remove(wavPath);

            this.logger.info('MP3 exported successfully');
            return { success: true, path: outputPath };

        } catch (error) {
            this.logger.error('MP3 export failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Generiert Audio-Buffer aus Noten
     */
    async generateAudioBuffer(projectData, instruments) {
        const tempo = projectData.tempo || 120;
        const secondsPerBeat = 60 / tempo;
        const totalDuration = this.calculateProjectDuration(projectData, tempo);
        const totalSamples = Math.floor(totalDuration * this.sampleRate);

        // Initialisiere Audio-Buffer
        const audioBuffer = new Float32Array(totalSamples);

        let currentSample = 0;

        // Für jedes Notensystem
        for (const measure of projectData.measures) {
            currentSample = await this.renderMeasure(
                measure,
                audioBuffer,
                currentSample,
                secondsPerBeat,
                instruments
            );
        }

        // Normalisiere Audio
        this.normalizeAudio(audioBuffer);

        return audioBuffer;
    }

    /**
     * Rendert einzelnes Notensystem
     */
    async renderMeasure(measure, audioBuffer, startSample, secondsPerBeat, instruments) {
        let currentSample = startSample;

        if (!measure.notes || measure.notes.length === 0) {
            // Rest-Takt
            const measureDuration = 4 * secondsPerBeat; // 4/4 Standard
            return startSample + Math.floor(measureDuration * this.sampleRate);
        }

        for (const note of measure.notes) {
            const duration = this.getDurationInSeconds(note.duration, secondsPerBeat);
            const durationSamples = Math.floor(duration * this.sampleRate);

            if (note.duration && note.duration.includes('r')) {
                // Rest: Stille
                currentSample += durationSamples;
            } else {
                // Note(n) abspielen
                for (const key of note.keys) {
                    const frequency = this.noteToFrequency(key);
                    const volume = 0.3 / note.keys.length; // Teile Lautstärke auf Akkorde

                    // Generiere Sine-Wave
                    this.generateTone(
                        audioBuffer,
                        currentSample,
                        durationSamples,
                        frequency,
                        volume
                    );
                }

                currentSample += durationSamples;
            }
        }

        return currentSample;
    }

    /**
     * Generiert Sinus-Ton
     */
    generateTone(audioBuffer, startSample, durationSamples, frequency, volume) {
        for (let i = 0; i < durationSamples; i++) {
            const sample = startSample + i;
            if (sample >= audioBuffer.length) break;

            const time = i / this.sampleRate;
            const angle = 2 * Math.PI * frequency * time;

            // Sinus-Welle
            let value = Math.sin(angle);

            // ADSR Envelope
            value *= this.applyADSREnvelope(i, durationSamples, this.sampleRate);

            // Addiere zum Buffer (für Polyphonie)
            audioBuffer[sample] += value * volume;
        }
    }

    /**
     * Wendet ADSR-Hüllkurve an
     */
    applyADSREnvelope(sampleIndex, totalSamples, sampleRate) {
        const attackTime = 0.05; // 50ms
        const releaseTime = 0.1; // 100ms
        const totalTime = totalSamples / sampleRate;

        const attackSamples = Math.floor(attackTime * sampleRate);
        const releaseSamples = Math.floor(releaseTime * sampleRate);
        const sustainSamples = totalSamples - attackSamples - releaseSamples;

        if (sampleIndex < attackSamples) {
            // Attack
            return sampleIndex / attackSamples;
        } else if (sampleIndex < attackSamples + sustainSamples) {
            // Sustain
            return 1.0;
        } else {
            // Release
            const releaseIndex = sampleIndex - (attackSamples + sustainSamples);
            return 1.0 - (releaseIndex / releaseSamples);
        }
    }

    /**
     * Konvertiert Note zu Frequenz (Hz)
     */
    noteToFrequency(vexFlowNote) {
        // Parse VexFlow format: c/4, d#4, etc.
        const match = vexFlowNote.match(/([a-g])([#b]?)\/(\d)/);
        if (!match) return 440; // A4 default

        const [, note, accidental, octave] = match;
        const noteMap = {
            'c': 0, 'd': 2, 'e': 4, 'f': 5, 'g': 7, 'a': 9, 'b': 11
        };

        let semitone = noteMap[note.toLowerCase()];
        if (accidental === '#') semitone++;
        if (accidental === 'b') semitone--;

        const midiNote = (parseInt(octave) + 1) * 12 + semitone;
        const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);

        return frequency;
    }

    /**
     * Konvertiert Notenwert zu Sekunden
     */
    getDurationInSeconds(duration, secondsPerBeat) {
        const durationMap = {
            'w': 4,    // whole
            'h': 2,    // half
            'q': 1,    // quarter
            '8': 0.5,  // eighth
            '16': 0.25, // sixteenth
            '32': 0.125,
            '64': 0.0625
        };

        let duration_value = duration?.replace(/r$/, '') || 'q';
        let beats = durationMap[duration_value] || 1;

        // Punktierung
        if (duration?.includes('.')) {
            beats *= 1.5;
        }

        return beats * secondsPerBeat;
    }

    /**
     * Normalisiert Audio (verhindert Clipping)
     */
    normalizeAudio(audioBuffer) {
        let maxValue = 0;

        // Finde Maximum
        for (let i = 0; i < audioBuffer.length; i++) {
            maxValue = Math.max(maxValue, Math.abs(audioBuffer[i]));
        }

        // Normalisiere
        if (maxValue > 1.0) {
            const factor = 0.95 / maxValue;
            for (let i = 0; i < audioBuffer.length; i++) {
                audioBuffer[i] *= factor;
            }
        }
    }

    /**
     * Erstellt WAV-Datei aus Audio-Buffer
     */
    createWavFile(audioBuffer) {
        const channels = 1;
        const byteRate = this.sampleRate * channels * this.bitDepth / 8;
        const blockAlign = channels * this.bitDepth / 8;
        const subChunk2Size = audioBuffer.length * 2;

        const buffer = Buffer.alloc(44 + subChunk2Size);
        const view = new DataView(buffer.buffer);

        // WAV Header
        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        writeString(0, 'RIFF');
        view.setUint32(4, 36 + subChunk2Size, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true); // Subchunk1Size
        view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
        view.setUint16(22, channels, true);
        view.setUint32(24, this.sampleRate, true);
        view.setUint32(28, byteRate, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, this.bitDepth, true);
        writeString(36, 'data');
        view.setUint32(40, subChunk2Size, true);

        // Audio-Daten
        let offset = 44;
        for (let i = 0; i < audioBuffer.length; i++) {
            const sample = Math.max(-1, Math.min(1, audioBuffer[i]));
            view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
            offset += 2;
        }

        return buffer;
    }

    /**
     * Berechnet Projekt-Dauer
     */
    calculateProjectDuration(projectData, tempo) {
        let totalBeats = 0;
        const secondsPerBeat = 60 / tempo;

        for (const measure of projectData.measures) {
            if (!measure.notes || measure.notes.length === 0) {
                totalBeats += 4; // Default 4/4
            } else {
                for (const note of measure.notes) {
                    totalBeats += this.durationToBeats(note.duration);
                }
            }
        }

        return totalBeats * secondsPerBeat;
    }

    /**
     * Konvertiert Duration zu Beats
     */
    durationToBeats(duration) {
        const beatMap = {
            'w': 4,
            'h': 2,
            'q': 1,
            '8': 0.5,
            '16': 0.25,
            '32': 0.125,
            '64': 0.0625
        };

        let duration_value = duration?.replace(/r$/, '') || 'q';
        let beats = beatMap[duration_value] || 1;

        if (duration?.includes('.')) {
            beats *= 1.5;
        }

        return beats;
    }
}

module.exports = AudioExport;
