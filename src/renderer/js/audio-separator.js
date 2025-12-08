// PATH: src/renderer/js/audio-separator.js
// DScribe - Audio Source Separation Engine (Phase 5+)
// Separates audio into vocal, bass, drums, other using DEMUCS/Spleeter-inspired approach

class AudioSeparator {
    constructor() {
        this.isProcessing = false;
        this.audioContext = null;
        this.sourceBuffer = null;
        this.separatedTracks = {
            vocals: null,
            bass: null,
            drums: null,
            other: null
        };
        this.onProgress = null;
        this.onComplete = null;
    }

    /**
     * Initialize audio context
     */
    async initialize() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            return { success: true };
        } catch (error) {
            console.error('Failed to initialize AudioContext:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Load and decode audio file
     */
    async loadAudioFile(file) {
        try {
            if (!this.audioContext) {
                await this.initialize();
            }

            const arrayBuffer = await file.arrayBuffer();
            this.sourceBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            
            console.log('Audio file loaded:', {
                duration: this.sourceBuffer.duration,
                sampleRate: this.sourceBuffer.sampleRate,
                channels: this.sourceBuffer.numberOfChannels
            });

            return { 
                success: true, 
                duration: this.sourceBuffer.duration,
                sampleRate: this.sourceBuffer.sampleRate
            };
        } catch (error) {
            console.error('Failed to load audio file:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Separate audio into tracks (Vocals, Bass, Drums, Other)
     * Uses frequency-based analysis and spectral processing
     */
    async separateTracks() {
        try {
            if (!this.sourceBuffer) {
                throw new Error('No audio file loaded');
            }

            this.isProcessing = true;
            const startTime = performance.now();

            // Get mono mix
            const monoData = this.toMono(this.sourceBuffer);
            
            // Perform separation using spectral analysis
            const separated = await this.performSpectralSeparation(monoData);

            this.separatedTracks = separated;
            this.isProcessing = false;

            const processingTime = (performance.now() - startTime) / 1000;
            console.log(`Audio separation completed in ${processingTime.toFixed(2)}s`);

            if (this.onComplete) {
                this.onComplete(this.separatedTracks);
            }

            return { 
                success: true, 
                tracks: this.separatedTracks,
                processingTime 
            };
        } catch (error) {
            console.error('Audio separation failed:', error);
            this.isProcessing = false;
            return { success: false, error: error.message };
        }
    }

    /**
     * Convert stereo to mono
     */
    toMono(audioBuffer) {
        const numberOfChannels = audioBuffer.numberOfChannels;
        const sampleRate = audioBuffer.sampleRate;
        const length = audioBuffer.length;
        const monoData = new Float32Array(length);

        if (numberOfChannels === 1) {
            return audioBuffer.getChannelData(0);
        }

        // Average channels
        for (let i = 0; i < length; i++) {
            let sum = 0;
            for (let channel = 0; channel < numberOfChannels; channel++) {
                sum += audioBuffer.getChannelData(channel)[i];
            }
            monoData[i] = sum / numberOfChannels;
        }

        return monoData;
    }

    /**
     * Perform spectral separation using STFT and frequency analysis
     */
    async performSpectralSeparation(audioData) {
        // Frame parameters
        const frameSize = 2048;
        const hopSize = 512;
        const numFrames = Math.floor((audioData.length - frameSize) / hopSize) + 1;

        // Initialize output buffers
        const vocalBuffer = new Float32Array(audioData.length);
        const bassBuffer = new Float32Array(audioData.length);
        const drumsBuffer = new Float32Array(audioData.length);
        const otherBuffer = new Float32Array(audioData.length);

        // Process each frame
        for (let frameIdx = 0; frameIdx < numFrames; frameIdx++) {
            const startIdx = frameIdx * hopSize;
            const endIdx = startIdx + frameSize;

            if (this.onProgress) {
                this.onProgress(frameIdx / numFrames);
            }

            // Extract frame
            const frame = audioData.slice(startIdx, endIdx);
            
            // Apply window
            const windowed = this.applyHannWindow(frame);

            // Compute FFT (simplified using DFT for now)
            const spectrum = this.computeFFT(windowed);

            // Separate sources
            const { vocals, bass, drums, other } = this.separateSpectrum(spectrum);

            // Inverse FFT
            const vocalFrame = this.computeIFFT(vocals);
            const bassFrame = this.computeIFFT(bass);
            const drumsFrame = this.computeIFFT(drums);
            const otherFrame = this.computeIFFT(other);

            // Add to output with overlap-add
            this.overlapAdd(vocalBuffer, vocalFrame, startIdx, hopSize);
            this.overlapAdd(bassBuffer, bassFrame, startIdx, hopSize);
            this.overlapAdd(drumsBuffer, drumsFrame, startIdx, hopSize);
            this.overlapAdd(otherBuffer, otherFrame, startIdx, hopSize);
        }

        // Normalize
        this.normalize(vocalBuffer);
        this.normalize(bassBuffer);
        this.normalize(drumsBuffer);
        this.normalize(otherBuffer);

        // Create audio buffers
        return {
            vocals: this.createAudioBuffer(vocalBuffer),
            bass: this.createAudioBuffer(bassBuffer),
            drums: this.createAudioBuffer(drumsBuffer),
            other: this.createAudioBuffer(otherBuffer)
        };
    }

    /**
     * Apply Hann window
     */
    applyHannWindow(frame) {
        const windowed = new Float32Array(frame.length);
        for (let i = 0; i < frame.length; i++) {
            const window = 0.5 * (1 - Math.cos(2 * Math.PI * i / (frame.length - 1)));
            windowed[i] = frame[i] * window;
        }
        return windowed;
    }

    /**
     * Compute FFT (simplified - uses basic DFT)
     * In production, use faster.js or similar
     */
    computeFFT(frame) {
        const n = frame.length;
        const spectrum = new Array(n).fill(0).map(() => ({ real: 0, imag: 0 }));

        // Simple DFT (slow but accurate for demo)
        for (let k = 0; k < n; k++) {
            let real = 0;
            let imag = 0;

            for (let n_idx = 0; n_idx < n; n_idx++) {
                const angle = -2 * Math.PI * k * n_idx / n;
                real += frame[n_idx] * Math.cos(angle);
                imag += frame[n_idx] * Math.sin(angle);
            }

            spectrum[k] = { real, imag };
        }

        return spectrum;
    }

    /**
     * Separate spectrum into source components
     */
    separateSpectrum(spectrum) {
        const separated = {
            vocals: [],
            bass: [],
            drums: [],
            other: []
        };

        spectrum.forEach((bin, idx) => {
            const magnitude = Math.sqrt(bin.real * bin.real + bin.imag * bin.imag);
            const freq = (idx / spectrum.length) * 22050; // Assuming 44.1kHz sample rate

            // Frequency-based source assignment
            let vocalMask = 0, bassMask = 0, drumsMask = 0, otherMask = 0;

            if (freq < 100) {
                // Sub-bass
                bassMask = 0.9;
                otherMask = 0.1;
            } else if (freq < 250) {
                // Bass region
                bassMask = 0.8;
                otherMask = 0.2;
            } else if (freq < 500) {
                // Low-mid / Drums
                drumsMask = 0.6;
                bassMask = 0.3;
                otherMask = 0.1;
            } else if (freq < 2000) {
                // Vocals / Mid
                vocalMask = 0.7;
                otherMask = 0.3;
            } else if (freq < 5000) {
                // Vocals / Presence
                vocalMask = 0.8;
                otherMask = 0.2;
            } else if (freq < 8000) {
                // Vocals / Presence peak
                vocalMask = 0.7;
                otherMask = 0.3;
            } else {
                // High frequency (cymbals/overhead)
                drumsMask = 0.5;
                otherMask = 0.5;
            }

            // Create masked bins
            separated.vocals.push({
                real: bin.real * vocalMask,
                imag: bin.imag * vocalMask
            });
            separated.bass.push({
                real: bin.real * bassMask,
                imag: bin.imag * bassMask
            });
            separated.drums.push({
                real: bin.real * drumsMask,
                imag: bin.imag * drumsMask
            });
            separated.other.push({
                real: bin.real * otherMask,
                imag: bin.imag * otherMask
            });
        });

        return separated;
    }

    /**
     * Compute IFFT
     */
    computeIFFT(spectrum) {
        const n = spectrum.length;
        const result = new Float32Array(n);

        for (let time_idx = 0; time_idx < n; time_idx++) {
            let sum = 0;

            for (let k = 0; k < n; k++) {
                const angle = 2 * Math.PI * k * time_idx / n;
                sum += spectrum[k].real * Math.cos(angle) - spectrum[k].imag * Math.sin(angle);
            }

            result[time_idx] = sum / n;
        }

        return result;
    }

    /**
     * Overlap-add for frame reconstruction
     */
    overlapAdd(output, frame, startIdx, hopSize) {
        for (let i = 0; i < frame.length; i++) {
            const outIdx = startIdx + i;
            if (outIdx < output.length) {
                output[outIdx] += frame[i];
            }
        }
    }

    /**
     * Normalize audio buffer
     */
    normalize(buffer) {
        let max = 0;
        for (let i = 0; i < buffer.length; i++) {
            max = Math.max(max, Math.abs(buffer[i]));
        }

        if (max > 1) {
            for (let i = 0; i < buffer.length; i++) {
                buffer[i] /= max;
            }
        }
    }

    /**
     * Create AudioBuffer from Float32Array
     */
    createAudioBuffer(data) {
        const buffer = this.audioContext.createBuffer(
            1,
            data.length,
            this.sourceBuffer.sampleRate
        );
        buffer.getChannelData(0).set(data);
        return buffer;
    }

    /**
     * Export separated track as WAV blob
     */
    async exportTrackAsWAV(trackName) {
        const track = this.separatedTracks[trackName];
        if (!track) {
            throw new Error(`Track ${trackName} not found`);
        }

        const audioData = track.getChannelData(0);
        const wavBlob = this.encodeWAV(audioData, this.sourceBuffer.sampleRate);
        
        return wavBlob;
    }

    /**
     * Encode audio data as WAV format
     */
    encodeWAV(audioData, sampleRate) {
        const numChannels = 1;
        const bitDepth = 16;
        const bytesPerSample = bitDepth / 8;
        const blockAlign = numChannels * bytesPerSample;
        const byteRate = sampleRate * blockAlign;
        const dataSize = audioData.length * bytesPerSample;

        const arrayBuffer = new ArrayBuffer(44 + dataSize);
        const view = new DataView(arrayBuffer);

        // WAV header
        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        writeString(0, 'RIFF');
        view.setUint32(4, 36 + dataSize, true);
        writeString(8, 'WAVE');

        writeString(12, 'fmt ');
        view.setUint32(16, 16, true); // fmt chunk size
        view.setUint16(20, 1, true); // audio format (PCM)
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, byteRate, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitDepth, true);

        writeString(36, 'data');
        view.setUint32(40, dataSize, true);

        // Audio data (convert to 16-bit PCM)
        let offset = 44;
        for (let i = 0; i < audioData.length; i++) {
            const sample = Math.max(-1, Math.min(1, audioData[i]));
            view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
            offset += 2;
        }

        return new Blob([arrayBuffer], { type: 'audio/wav' });
    }

    /**
     * Play separated track
     */
    playTrack(trackName) {
        const track = this.separatedTracks[trackName];
        if (!track) {
            console.error(`Track ${trackName} not found`);
            return;
        }

        const source = this.audioContext.createBufferSource();
        source.buffer = track;
        source.connect(this.audioContext.destination);
        source.start(0);
    }
}
