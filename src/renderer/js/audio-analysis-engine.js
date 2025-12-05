// PATH: src/renderer/js/audio-analysis-engine.js
// DScribe - Audio Analysis Engine (Phase 5)

class AudioAnalysisEngine {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.isRecording = false;
        this.bufferSize = 2048;
        this.sampleRate = 44100;
        
        // Pitch detection
        this.detectedPitch = 0;
        this.detectedNote = '';
        this.pitchConfidence = 0;
        
        // Audio buffer for processing
        this.audioBuffer = [];
        this.maxBufferLength = this.sampleRate * 10; // 10 seconds
        
        // Callbacks
        this.onPitchDetected = null;
        this.onNoteDetected = null;
        this.onAudioData = null;
        
        // Recording
        this.mediaRecorder = null;
        this.recordedChunks = [];
        
        // Visualization
        this.dataArray = null;
        this.visualizationActive = false;
    }

    /**
     * Initialize audio context and analyser
     */
    async initialize() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: this.sampleRate
            });
            
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = this.bufferSize;
            this.analyser.smoothingTimeConstant = 0.8;
            
            this.dataArray = new Float32Array(this.analyser.frequencyBinCount);
            
            console.log('Audio Analysis Engine initialized');
            return { success: true };
        } catch (error) {
            console.error('Failed to initialize audio context:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Start microphone input
     */
    async startMicrophone() {
        try {
            if (!this.audioContext) {
                await this.initialize();
            }

            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                } 
            });
            
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            this.microphone.connect(this.analyser);
            
            this.isRecording = true;
            this.startPitchDetection();
            
            console.log('Microphone started');
            return { success: true };
            
        } catch (error) {
            console.error('Failed to start microphone:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Stop microphone input
     */
    stopMicrophone() {
        if (this.microphone) {
            this.microphone.disconnect();
            this.microphone.mediaStream.getTracks().forEach(track => track.stop());
            this.microphone = null;
        }
        
        this.isRecording = false;
        console.log('Microphone stopped');
    }

    /**
     * Start real-time pitch detection
     */
    startPitchDetection() {
        if (!this.isRecording) return;
        
        const detectPitch = () => {
            if (!this.isRecording) return;
            
            // Get time domain data
            const buffer = new Float32Array(this.analyser.fftSize);
            this.analyser.getFloatTimeDomainData(buffer);
            
            // Detect pitch using autocorrelation
            const pitch = this.autoCorrelate(buffer, this.audioContext.sampleRate);
            
            if (pitch > 0) {
                this.detectedPitch = pitch;
                this.detectedNote = this.frequencyToNote(pitch);
                
                // Call callback
                if (this.onPitchDetected) {
                    this.onPitchDetected(pitch, this.detectedNote);
                }
            }
            
            // Continue detection
            requestAnimationFrame(detectPitch);
        };
        
        detectPitch();
    }

    /**
     * Autocorrelation pitch detection algorithm
     */
    autoCorrelate(buffer, sampleRate) {
        // Minimum and maximum frequency to detect (E2 to E6)
        const minFreq = 82.41; // E2
        const maxFreq = 1318.51; // E6
        
        const minPeriod = Math.floor(sampleRate / maxFreq);
        const maxPeriod = Math.ceil(sampleRate / minFreq);
        
        // Find silence threshold
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
            sum += Math.abs(buffer[i]);
        }
        const threshold = sum / buffer.length * 0.2;
        
        // Check if signal is too quiet
        if (sum / buffer.length < 0.01) {
            return -1;
        }
        
        // Autocorrelation
        let maxCorrelation = 0;
        let maxLag = 0;
        
        for (let lag = minPeriod; lag < maxPeriod; lag++) {
            let correlation = 0;
            
            for (let i = 0; i < buffer.length - lag; i++) {
                correlation += buffer[i] * buffer[i + lag];
            }
            
            if (correlation > maxCorrelation) {
                maxCorrelation = correlation;
                maxLag = lag;
            }
        }
        
        // Calculate frequency
        if (maxLag > 0) {
            const frequency = sampleRate / maxLag;
            
            // Verify it's a reasonable frequency
            if (frequency >= minFreq && frequency <= maxFreq) {
                return frequency;
            }
        }
        
        return -1;
    }

    /**
     * Convert frequency to note name
     */
    frequencyToNote(frequency) {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const A4 = 440;
        const C0 = A4 * Math.pow(2, -4.75);
        
        const halfSteps = Math.round(12 * Math.log2(frequency / C0));
        const octave = Math.floor(halfSteps / 12);
        const noteIndex = halfSteps % 12;
        
        const noteName = noteNames[noteIndex];
        return `${noteName}${octave}`;
    }

    /**
     * Convert note name to frequency
     */
    noteToFrequency(noteName) {
        const noteMap = {
            'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5,
            'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11
        };
        
        const match = noteName.match(/^([A-G]#?)(\d+)$/);
        if (!match) return 440;
        
        const note = match[1];
        const octave = parseInt(match[2]);
        
        const noteIndex = noteMap[note] || 0;
        const A4 = 440;
        const halfSteps = (octave - 4) * 12 + (noteIndex - 9);
        
        return A4 * Math.pow(2, halfSteps / 12);
    }

    /**
     * Convert note name to VexFlow format
     */
    noteToVexFlow(noteName) {
        const match = noteName.match(/^([A-G])(#?)(\d+)$/);
        if (!match) return 'c/4';
        
        const note = match[1].toLowerCase();
        const accidental = match[2];
        const octave = match[3];
        
        return `${note}${accidental}/${octave}`;
    }

    /**
     * Detect onset (note start) in audio buffer
     */
    detectOnset(buffer) {
        // Simple energy-based onset detection
        const windowSize = 512;
        const hopSize = 256;
        const threshold = 0.05;
        
        const onsets = [];
        let prevEnergy = 0;
        
        for (let i = 0; i < buffer.length - windowSize; i += hopSize) {
            let energy = 0;
            
            for (let j = 0; j < windowSize; j++) {
                energy += buffer[i + j] * buffer[i + j];
            }
            
            energy = Math.sqrt(energy / windowSize);
            
            // Detect sudden increase in energy
            if (energy > prevEnergy * 1.5 && energy > threshold) {
                onsets.push(i / this.sampleRate);
            }
            
            prevEnergy = energy;
        }
        
        return onsets;
    }

    /**
     * Quantize duration to nearest note value
     */
    quantizeDuration(durationSeconds) {
        const tempo = 120; // BPM
        const secondsPerBeat = 60 / tempo;
        const beats = durationSeconds / secondsPerBeat;
        
        // Map to closest note value
        const noteValues = [
            { beats: 4, duration: 'w' },
            { beats: 3, duration: 'hd' },
            { beats: 2, duration: 'h' },
            { beats: 1.5, duration: 'qd' },
            { beats: 1, duration: 'q' },
            { beats: 0.75, duration: '8d' },
            { beats: 0.5, duration: '8' },
            { beats: 0.25, duration: '16' },
            { beats: 0.125, duration: '32' }
        ];
        
        let closest = noteValues[0];
        let minDiff = Math.abs(beats - closest.beats);
        
        for (const noteValue of noteValues) {
            const diff = Math.abs(beats - noteValue.beats);
            if (diff < minDiff) {
                minDiff = diff;
                closest = noteValue;
            }
        }
        
        return closest.duration;
    }

    /**
     * Import audio file (MP3/WAV)
     */
    async importAudioFile(file) {
        try {
            if (!this.audioContext) {
                await this.initialize();
            }
            
            const arrayBuffer = await file.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            
            console.log('Audio file imported:', audioBuffer.duration, 'seconds');
            
            return {
                success: true,
                buffer: audioBuffer,
                duration: audioBuffer.duration,
                sampleRate: audioBuffer.sampleRate
            };
            
        } catch (error) {
            console.error('Failed to import audio file:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Analyze audio buffer and extract notes
     */
    async analyzeAudioBuffer(audioBuffer) {
        try {
            const channelData = audioBuffer.getChannelData(0);
            const sampleRate = audioBuffer.sampleRate;
            
            // Detect onsets
            const onsets = this.detectOnset(channelData);
            console.log('Detected onsets:', onsets.length);
            
            // Extract notes at each onset
            const notes = [];
            const windowSize = 2048;
            
            for (let i = 0; i < onsets.length; i++) {
                const startSample = Math.floor(onsets[i] * sampleRate);
                const endSample = Math.min(startSample + windowSize, channelData.length);
                
                const window = channelData.slice(startSample, endSample);
                const pitch = this.autoCorrelate(window, sampleRate);
                
                if (pitch > 0) {
                    const noteName = this.frequencyToNote(pitch);
                    const vexFlowNote = this.noteToVexFlow(noteName);
                    
                    // Calculate duration
                    const nextOnset = i < onsets.length - 1 ? onsets[i + 1] : audioBuffer.duration;
                    const duration = nextOnset - onsets[i];
                    const quantizedDuration = this.quantizeDuration(duration);
                    
                    notes.push({
                        keys: [vexFlowNote],
                        duration: quantizedDuration,
                        time: onsets[i],
                        frequency: pitch,
                        noteName: noteName
                    });
                }
            }
            
            console.log('Extracted notes:', notes.length);
            return { success: true, notes };
            
        } catch (error) {
            console.error('Failed to analyze audio buffer:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Start visualization
     */
    startVisualization(canvasId) {
        this.visualizationActive = true;
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        
        const draw = () => {
            if (!this.visualizationActive) return;
            
            requestAnimationFrame(draw);
            
            if (!this.analyser) return;
            
            // Get frequency data
            const bufferLength = this.analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            this.analyser.getByteFrequencyData(dataArray);
            
            // Clear canvas
            ctx.fillStyle = 'rgb(20, 20, 20)';
            ctx.fillRect(0, 0, width, height);
            
            // Draw bars
            const barWidth = (width / bufferLength) * 2.5;
            let x = 0;
            
            for (let i = 0; i < bufferLength; i++) {
                const barHeight = (dataArray[i] / 255) * height;
                
                const r = barHeight + (25 * (i / bufferLength));
                const g = 250 * (i / bufferLength);
                const b = 50;
                
                ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                ctx.fillRect(x, height - barHeight, barWidth, barHeight);
                
                x += barWidth + 1;
            }
        };
        
        draw();
    }

    /**
     * Stop visualization
     */
    stopVisualization() {
        this.visualizationActive = false;
    }

    /**
     * Start recording to file
     */
    async startRecording() {
        try {
            if (!this.microphone) {
                const result = await this.startMicrophone();
                if (!result.success) return result;
            }
            
            const stream = this.microphone.mediaStream;
            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm'
            });
            
            this.recordedChunks = [];
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.start();
            console.log('Recording started');
            
            return { success: true };
            
        } catch (error) {
            console.error('Failed to start recording:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Stop recording and return audio blob
     */
    async stopRecording() {
        return new Promise((resolve) => {
            if (!this.mediaRecorder) {
                resolve({ success: false, error: 'No active recording' });
                return;
            }
            
            this.mediaRecorder.onstop = () => {
                const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
                console.log('Recording stopped, blob size:', blob.size);
                resolve({ success: true, blob });
            };
            
            this.mediaRecorder.stop();
        });
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        this.stopMicrophone();
        this.stopVisualization();
        
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        
        console.log('Audio Analysis Engine cleaned up');
    }
}
