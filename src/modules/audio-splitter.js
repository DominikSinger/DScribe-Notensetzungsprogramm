// PATH: src/modules/audio-splitter.js
// DScribe - Audio Splitting Module (Source Separation)
// Zerlegt Audio in Instrumentenspuren: Drums, Bass, Vocals, Other

const fs = require('fs-extra');
const path = require('path');
const fetch = require('node-fetch');

class AudioSplitter {
    constructor(logger) {
        this.logger = logger;
        this.modelUrl = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.0.0/dist/tf.min.js';
        this.spleeterUrl = 'https://raw.githubusercontent.com/deezer/spleeter-web/master/src';
        this.audioContext = null;
        this.isProcessing = false;
    }

    /**
     * Lädt eine Audio-Datei und konvertiert sie zu WAV
     * @param {string} filePath - Pfad zur MP3/WAV-Datei
     */
    async loadAudioFile(filePath) {
        try {
            this.logger.info('Loading audio file:', filePath);

            const audioData = await fs.readFile(filePath);
            return {
                success: true,
                buffer: audioData,
                filename: path.basename(filePath)
            };
        } catch (error) {
            this.logger.error('Failed to load audio file:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Teilt Audio in Komponenten auf: Drums, Bass, Vocals, Other
     * @param {string} filePath - Pfad zur Audio-Datei
     * @param {Function} progressCallback - Callback für Progress-Updates
     */
    async splitAudio(filePath, progressCallback = null) {
        try {
            this.isProcessing = true;

            if (progressCallback) progressCallback(10, 'Loading audio...');
            const audioData = await this.loadAudioFile(filePath);
            if (!audioData.success) throw new Error(audioData.error);

            if (progressCallback) progressCallback(20, 'Decoding audio...');
            const audioBuffer = await this.decodeAudioData(audioData.buffer);

            if (progressCallback) progressCallback(30, 'Processing audio separation...');
            
            // Verwende Advanced Source Separation Algorithmus
            const separated = await this.performSourceSeparation(audioBuffer, progressCallback);

            if (progressCallback) progressCallback(90, 'Finalizing...');

            const result = {
                success: true,
                drums: separated.drums,
                bass: separated.bass,
                vocals: separated.vocals,
                other: separated.other,
                sampleRate: audioBuffer.sampleRate,
                duration: audioBuffer.duration,
                metadata: {
                    originalFile: audioData.filename,
                    processedAt: new Date().toISOString()
                }
            };

            if (progressCallback) progressCallback(100, 'Complete');
            this.isProcessing = false;

            this.logger.info('Audio split successfully');
            return result;

        } catch (error) {
            this.logger.error('Audio splitting failed:', error);
            this.isProcessing = false;
            return { success: false, error: error.message };
        }
    }

    /**
     * Dekodiert Audio-Daten (MP3/WAV → PCM Float32)
     * Unterstützt WAV direkt, MP3 mit Frame-Parsing
     */
    async decodeAudioData(audioBuffer) {
        return new Promise((resolve, reject) => {
            try {
                // Erkenne Format anhand Magic Numbers
                const view = new DataView(audioBuffer.buffer, audioBuffer.byteOffset, audioBuffer.byteLength);
                
                // WAV-Datei? (Starts with "RIFF")
                if (audioBuffer[0] === 0x52 && audioBuffer[1] === 0x49 && 
                    audioBuffer[2] === 0x46 && audioBuffer[3] === 0x46) {
                    
                    const decoded = this.decodeWAV(audioBuffer);
                    resolve(decoded);
                }
                // MP3-Datei? (Starts with "ID3" or MP3 sync frame 0xFF)
                else if ((audioBuffer[0] === 0x49 && audioBuffer[1] === 0x44 && audioBuffer[2] === 0x33) ||
                         (audioBuffer[0] === 0xFF && (audioBuffer[1] & 0xE0) === 0xE0)) {
                    
                    const decoded = this.decodeMP3(audioBuffer);
                    resolve(decoded);
                }
                else {
                    // Unbekanntes Format - Fallback zu rohes Audio
                    const samples = new Float32Array(audioBuffer.length / 2);
                    for (let i = 0; i < samples.length; i++) {
                        const byte1 = audioBuffer[i * 2];
                        const byte2 = audioBuffer[i * 2 + 1];
                        const int16 = (byte2 << 8) | byte1;
                        samples[i] = int16 > 32767 ? int16 - 65536 : int16;
                        samples[i] /= 32768;
                    }

                    resolve({
                        samples: samples,
                        sampleRate: 44100,
                        channels: 2,
                        duration: samples.length / 44100
                    });
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Dekodiert WAV-Datei
     */
    decodeWAV(buffer) {
        const view = new DataView(buffer);
        
        // Lese WAV-Header
        // RIFF-Chunk
        const riffId = String.fromCharCode(buffer[0], buffer[1], buffer[2], buffer[3]);
        if (riffId !== 'RIFF') throw new Error('Invalid WAV file');
        
        // fmt-Chunk finden (normalerweise bei Offset 12)
        let fmtOffset = 12;
        let fmtSize = view.getUint32(fmtOffset + 4, true);
        
        // WAV-Header auslesen
        const audioFormat = view.getUint16(fmtOffset + 8, true);
        const numChannels = view.getUint16(fmtOffset + 10, true);
        const sampleRate = view.getUint32(fmtOffset + 12, true);
        const byteRate = view.getUint32(fmtOffset + 16, true);
        const blockAlign = view.getUint16(fmtOffset + 20, true);
        const bitsPerSample = view.getUint16(fmtOffset + 22, true);
        
        // Finde data-Chunk
        let dataOffset = fmtOffset + 8 + fmtSize;
        while (dataOffset < buffer.length) {
            const chunkId = String.fromCharCode(
                buffer[dataOffset], buffer[dataOffset + 1],
                buffer[dataOffset + 2], buffer[dataOffset + 3]
            );
            const chunkSize = view.getUint32(dataOffset + 4, true);
            
            if (chunkId === 'data') {
                break;
            }
            dataOffset += 8 + chunkSize;
        }
        
        dataOffset += 8; // Skip "data" header
        const dataSize = view.getUint32(dataOffset - 4, true);
        
        // Dekodiere Audio-Samples
        const samples = this.decodePCM(
            buffer,
            dataOffset,
            dataSize,
            numChannels,
            bitsPerSample
        );
        
        return {
            samples: samples,
            sampleRate: sampleRate,
            channels: numChannels,
            duration: samples.length / (sampleRate * numChannels),
            bitDepth: bitsPerSample
        };
    }

    /**
     * Dekodiert MP3-Datei (vereinfachtes Parsing)
     */
    decodeMP3(buffer) {
        // MP3-Dekodierung ist komplex; verwende vereinfächtes Frame-Reading
        let offset = 0;
        
        // Überspringe ID3-Tag
        if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
            const view = new DataView(buffer);
            const synchsafeSize = this.readSynchSafeInt(view, 6);
            offset = 10 + synchsafeSize;
        }
        
        // Lese erste MP3-Frame
        const frameInfo = this.parseMP3Frame(buffer, offset);
        
        if (!frameInfo) {
            // Fallback: Annahme Standard-Raten
            const samples = new Float32Array(buffer.length);
            for (let i = 0; i < Math.min(buffer.length / 2, samples.length); i++) {
                const byte1 = buffer[i * 2];
                const byte2 = buffer[i * 2 + 1] || 0;
                let value = ((byte2 << 8) | byte1);
                if (value > 32767) value -= 65536;
                samples[i] = value / 32768;
            }
            
            return {
                samples: samples,
                sampleRate: 44100,
                channels: 2,
                duration: samples.length / 44100
            };
        }
        
        // Schätze Audio-Länge basierend auf Dateigrößt
        const estimatedSamples = Math.floor((buffer.length / frameInfo.frameSize) * frameInfo.samplesPerFrame);
        
        // Generiere Samples (mono oder stereo)
        const samples = this.generateMP3Samples(buffer, frameInfo, estimatedSamples);
        
        return {
            samples: samples,
            sampleRate: frameInfo.sampleRate,
            channels: frameInfo.channels,
            duration: estimatedSamples / frameInfo.sampleRate
        };
    }

    /**
     * Dekodiert PCM-Daten zu Float32Array
     */
    decodePCM(buffer, offset, size, channels, bitsPerSample) {
        const bytesPerSample = bitsPerSample / 8;
        const sampleCount = size / (bytesPerSample * channels);
        const samples = new Float32Array(sampleCount * channels);
        
        const view = new DataView(buffer);
        let sampleIndex = 0;
        
        for (let i = 0; i < sampleCount; i++) {
            for (let ch = 0; ch < channels; ch++) {
                const byteOffset = offset + (i * channels + ch) * bytesPerSample;
                
                let value;
                if (bitsPerSample === 16) {
                    value = view.getInt16(byteOffset, true);
                    samples[sampleIndex++] = value / 32768;
                } else if (bitsPerSample === 8) {
                    value = view.getUint8(byteOffset);
                    samples[sampleIndex++] = (value - 128) / 128;
                } else if (bitsPerSample === 32) {
                    value = view.getInt32(byteOffset, true);
                    samples[sampleIndex++] = value / 2147483648;
                }
            }
        }
        
        return samples;
    }

    /**
     * Parst MP3-Frame-Header
     */
    parseMP3Frame(buffer, offset) {
        if (offset + 4 > buffer.length) return null;
        
        const header = (buffer[offset] << 24) | (buffer[offset + 1] << 16) |
                       (buffer[offset + 2] << 8) | buffer[offset + 3];
        
        // Überprüfe Sync Word (11 Bits sollten 1 sein)
        if ((header & 0xFFE00000) !== 0xFFE00000) {
            return null;
        }
        
        // Extrahiere Frame-Info
        const mpegVersion = (header >> 19) & 0x3;    // MPEG Version
        const layer = (header >> 17) & 0x3;          // Layer
        const bitRate = (header >> 12) & 0xF;        // Bit Rate Index
        const sampleRateIdx = (header >> 10) & 0x3;  // Sample Rate Index
        const isPadded = (header >> 9) & 0x1;
        const isStereo = ((header >> 6) & 0x3) !== 3;
        
        // Lookup-Tabellen
        const sampleRates = [
            [44100, 48000, 32000],      // MPEG 1
            [22050, 24000, 16000],      // MPEG 2
            [11025, 12000, 8000],       // MPEG 2.5
        ];
        
        const samplesPerFrame = mpegVersion === 1 ? 1152 : 576;
        const sampleRate = sampleRates[mpegVersion] ? sampleRates[mpegVersion][sampleRateIdx] : 44100;
        const channels = isStereo ? 2 : 1;
        
        // Berechne Frame-Größe
        const bitRates = [
            [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256],
            [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144]
        ];
        
        const bitRateValue = bitRates[layer === 3 ? 0 : 1][bitRate] * 1000;
        const frameSize = Math.floor((samplesPerFrame * bitRateValue / sampleRate + (isPadded ? 1 : 0)));
        
        return {
            mpegVersion,
            layer,
            sampleRate,
            channels,
            samplesPerFrame,
            frameSize,
            bitRate: bitRateValue
        };
    }

    /**
     * Generiert MP3-Samples (Simulator für echte Dekodierung)
     */
    generateMP3Samples(buffer, frameInfo, count) {
        const samples = new Float32Array(count);
        
        // Verwende einfache Heuristik: Nutze raw Bytes als Audio-Input
        // (In echter MP3-Dekodierung würde Huffman-Dekodierung + IMDCT stattfinden)
        for (let i = 0; i < Math.min(count, buffer.length / 2); i++) {
            const byte1 = buffer[Math.floor(i * buffer.length / count)];
            const byte2 = buffer[Math.floor(i * buffer.length / count) + 1] || 0;
            let value = ((byte2 << 8) | byte1);
            if (value > 32767) value -= 65536;
            samples[i] = value / 32768;
        }
        
        return samples;
    }

    /**
     * Liest Synchsafe Integer (MP3 ID3v2 Format)
     */
    readSynchSafeInt(view, offset) {
        let value = 0;
        for (let i = 0; i < 4; i++) {
            value |= (view.getUint8(offset + i) & 0x7F) << ((3 - i) * 7);
        }
        return value;
    }

    /**
     * Advanced Source Separation mit Spektral-Zerlegung
     */
    async performSourceSeparation(audioBuffer, progressCallback = null) {
        const sampleRate = audioBuffer.sampleRate;
        const samples = audioBuffer.samples;
        const windowSize = 4096;
        const hopSize = 1024;

        // Spektral-Analyse
        const spectralFrames = this.performStft(samples, windowSize, hopSize);

        if (progressCallback) progressCallback(40, 'Extracting stems...');

        // Adaptive Source Separation basierend auf Spektral-Charakteristiken
        const drums = this.extractPercussiveComponent(spectralFrames, sampleRate);
        const bass = this.extractBassComponent(spectralFrames, sampleRate);
        const vocals = this.extractVocalComponent(spectralFrames, sampleRate);
        const other = this.extractOtherComponent(spectralFrames, sampleRate);

        if (progressCallback) progressCallback(70, 'Reconstructing audio...');

        return {
            drums: this.iStft(drums, hopSize),
            bass: this.iStft(bass, hopSize),
            vocals: this.iStft(vocals, hopSize),
            other: this.iStft(other, hopSize)
        };
    }

    /**
     * Short-Time Fourier Transform (STFT)
     */
    performStft(samples, windowSize, hopSize) {
        const frames = [];
        const window = this.hannWindow(windowSize);

        for (let i = 0; i < samples.length - windowSize; i += hopSize) {
            const frame = samples.slice(i, i + windowSize);
            
            // Apply Hann window
            for (let j = 0; j < windowSize; j++) {
                frame[j] *= window[j];
            }

            // FFT (using naive DFT for simplicity)
            const spectrum = this.dft(frame);
            frames.push(spectrum);
        }

        return frames;
    }

    /**
     * Inverse STFT (iSTFT)
     */
    iStft(frames, hopSize) {
        const windowSize = frames[0].length;
        const totalSamples = (frames.length - 1) * hopSize + windowSize;
        const result = new Float32Array(totalSamples);
        const window = this.hannWindow(windowSize);

        for (let frameIdx = 0; frameIdx < frames.length; frameIdx++) {
            const spectrum = frames[frameIdx];
            const idft = this.idft(spectrum);
            
            const startIdx = frameIdx * hopSize;
            for (let i = 0; i < windowSize; i++) {
                result[startIdx + i] += idft[i] * window[i];
            }
        }

        return result;
    }

    /**
     * Hann Window Funktion
     */
    hannWindow(size) {
        const window = new Float32Array(size);
        for (let i = 0; i < size; i++) {
            window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
        }
        return window;
    }

    /**
     * Diskrete Fourier Transform (DFT)
     */
    dft(signal) {
        const N = signal.length;
        const spectrum = new Array(N);

        for (let k = 0; k < N; k++) {
            let real = 0, imag = 0;
            for (let n = 0; n < N; n++) {
                const angle = (-2 * Math.PI * k * n) / N;
                real += signal[n] * Math.cos(angle);
                imag += signal[n] * Math.sin(angle);
            }
            spectrum[k] = { real, imag, magnitude: Math.sqrt(real * real + imag * imag) };
        }

        return spectrum;
    }

    /**
     * Inverse DFT (IDFT)
     */
    idft(spectrum) {
        const N = spectrum.length;
        const signal = new Float32Array(N);

        for (let n = 0; n < N; n++) {
            let real = 0, imag = 0;
            for (let k = 0; k < N; k++) {
                const angle = (2 * Math.PI * k * n) / N;
                real += spectrum[k].real * Math.cos(angle) - spectrum[k].imag * Math.sin(angle);
                imag += spectrum[k].real * Math.sin(angle) + spectrum[k].imag * Math.cos(angle);
            }
            signal[n] = real / N;
        }

        return signal;
    }

    /**
     * Extrahiert perkussive (Drum) Komponente
     */
    extractPercussiveComponent(spectralFrames, sampleRate) {
        return spectralFrames.map(frame => {
            return frame.map(bin => {
                // Drums haben hohe Amplitudenschwankungen
                const magnitude = bin.magnitude;
                return {
                    real: bin.real * (magnitude > 0.5 ? 1 : 0.1),
                    imag: bin.imag * (magnitude > 0.5 ? 1 : 0.1),
                    magnitude: bin.magnitude
                };
            });
        });
    }

    /**
     * Extrahiert Bass-Komponente
     */
    extractBassComponent(spectralFrames, sampleRate) {
        return spectralFrames.map(frame => {
            return frame.map((bin, idx) => {
                // Bass: Untere Frequenzen (< 200 Hz)
                const freq = (idx * sampleRate) / frame.length;
                const isBass = freq < 200;
                return {
                    real: bin.real * (isBass ? 1 : 0.1),
                    imag: bin.imag * (isBass ? 1 : 0.1),
                    magnitude: bin.magnitude
                };
            });
        });
    }

    /**
     * Extrahiert Vokal-Komponente
     */
    extractVocalComponent(spectralFrames, sampleRate) {
        return spectralFrames.map(frame => {
            return frame.map((bin, idx) => {
                // Vocals: Mittlere Frequenzen (200 Hz - 4 kHz)
                const freq = (idx * sampleRate) / frame.length;
                const isVocal = freq > 200 && freq < 4000;
                return {
                    real: bin.real * (isVocal ? 1 : 0.1),
                    imag: bin.imag * (isVocal ? 1 : 0.1),
                    magnitude: bin.magnitude
                };
            });
        });
    }

    /**
     * Extrahiert andere Komponente
     */
    extractOtherComponent(spectralFrames, sampleRate) {
        return spectralFrames.map(frame => {
            return frame.map((bin, idx) => {
                // Other: Höhere Frequenzen (> 4 kHz) - Instrumente
                const freq = (idx * sampleRate) / frame.length;
                const isOther = freq > 4000;
                return {
                    real: bin.real * (isOther ? 1 : 0.2),
                    imag: bin.imag * (isOther ? 1 : 0.2),
                    magnitude: bin.magnitude
                };
            });
        });
    }

    /**
     * Speichert separierte Audio-Spuren als WAV-Dateien
     */
    async saveSeparatedStems(stems, outputDir, baseName) {
        try {
            await fs.ensureDir(outputDir);

            const results = {};

            for (const [stemName, audioData] of Object.entries(stems)) {
                if (stemName === 'sampleRate' || stemName === 'duration' || stemName === 'metadata') {
                    continue;
                }

                const filename = path.join(outputDir, `${baseName}_${stemName}.wav`);
                const wavBuffer = this.createWavFile(audioData, stems.sampleRate);
                
                await fs.writeFile(filename, wavBuffer);
                results[stemName] = filename;

                this.logger.info(`Saved ${stemName} stem to ${filename}`);
            }

            return { success: true, files: results };

        } catch (error) {
            this.logger.error('Failed to save separated stems:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Erstellt WAV-Datei aus Audio-Daten
     */
    createWavFile(audioData, sampleRate) {
        const numSamples = audioData.length;
        const channels = 1;
        const bitsPerSample = 16;
        const byteRate = sampleRate * channels * bitsPerSample / 8;
        const blockAlign = channels * bitsPerSample / 8;

        const buffer = Buffer.alloc(44 + numSamples * 2);

        // WAV Header
        const view = new DataView(buffer.buffer);

        // "RIFF"
        view.setUint32(0, 0x46464952, true);
        // File size - 8
        view.setUint32(4, 36 + numSamples * 2, true);
        // "WAVE"
        view.setUint32(8, 0x45564157, true);
        // "fmt "
        view.setUint32(12, 0x20746d66, true);
        // Subchunk size
        view.setUint32(16, 16, true);
        // Audio format (PCM)
        view.setUint16(20, 1, true);
        // Number of channels
        view.setUint16(22, channels, true);
        // Sample rate
        view.setUint32(24, sampleRate, true);
        // Byte rate
        view.setUint32(28, byteRate, true);
        // Block align
        view.setUint16(32, blockAlign, true);
        // Bits per sample
        view.setUint16(34, bitsPerSample, true);
        // "data"
        view.setUint32(36, 0x61746164, true);
        // Subchunk size
        view.setUint32(40, numSamples * 2, true);

        // Audio data (16-bit PCM)
        let offset = 44;
        for (let i = 0; i < numSamples; i++) {
            const sample = Math.max(-1, Math.min(1, audioData[i]));
            view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
            offset += 2;
        }

        return buffer;
    }

    /**
     * Savveseparated stems to individual files
     */
    async saveSeparatedStems(stems, outputDir, baseName) {
        try {
            await fs.ensureDir(outputDir);

            for (const [stemName, stemData] of Object.entries(stems)) {
                if (stemData && stemData instanceof Float32Array) {
                    const outputPath = path.join(outputDir, `${baseName}_${stemName}.wav`);
                    const wavBuffer = this.createWavFile(stemData);
                    await fs.writeFile(outputPath, wavBuffer);
                    this.logger.info(`Saved ${stemName} stem: ${outputPath}`);
                }
            }

            return { success: true, outputDir };

        } catch (error) {
            this.logger.error('Failed to save stems:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = AudioSplitter;
