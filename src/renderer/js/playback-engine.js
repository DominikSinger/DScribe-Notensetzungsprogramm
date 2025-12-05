// PATH: src/renderer/js/playback-engine.js
// DScribe - Playback Engine (WebAudio) - Phase 3

class PlaybackEngine {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.tempo = 120;
        this.volume = 0.7;
        this.isPlaying = false;
        this.isPaused = false;
        this.currentTime = 0;
        this.currentMeasure = 0;
        this.metronomeEnabled = false;
        this.scheduledNotes = [];
        this.currentInstrument = 'piano';
        
        // Scheduling
        this.lookahead = 25.0; // ms
        this.scheduleAheadTime = 0.1; // seconds
        this.nextNoteTime = 0.0;
        this.noteIndex = 0;
        this.timerID = null;
        this.noteSequence = [];
        
        // Instrument definitions with ADSR envelopes
        this.instruments = {
            'piano': { type: 'triangle', attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.3 },
            'organ': { type: 'sine', attack: 0.01, decay: 0.1, sustain: 0.9, release: 0.1 },
            'guitar': { type: 'sawtooth', attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.4 },
            'strings': { type: 'sawtooth', attack: 0.1, decay: 0.2, sustain: 0.8, release: 0.5 },
            'flute': { type: 'sine', attack: 0.05, decay: 0.1, sustain: 0.8, release: 0.2 },
            'brass': { type: 'square', attack: 0.05, decay: 0.1, sustain: 0.7, release: 0.2 },
            'bass': { type: 'triangle', attack: 0.01, decay: 0.1, sustain: 0.9, release: 0.1 }
        };
        
        this.initializeAudio();
    }

    initializeAudio() {
        try {
            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Create master gain node
            this.masterGain = this.audioContext.createGain();
            this.masterGain.gain.value = this.volume;
            this.masterGain.connect(this.audioContext.destination);
            
            console.log('Audio context initialized');
        } catch (error) {
            console.error('Failed to initialize audio context:', error);
        }
    }

    play(measures = []) {
        if (!this.audioContext) {
            console.error('Audio context not initialized');
            return;
        }
        
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        this.isPlaying = true;
        this.isPaused = false;
        
        // Convert measures to playable note sequence
        this.noteSequence = this.measuresToNoteSequence(measures);
        this.noteIndex = 0;
        this.nextNoteTime = this.audioContext.currentTime;
        
        console.log('Playing', this.noteSequence.length, 'notes at tempo', this.tempo, 'BPM');
        
        if (this.noteSequence.length === 0) {
            console.log('No notes to play, playing test tone');
            this.playTestTone();
            return;
        }
        
        this.scheduler();
    }
    
    scheduler() {
        while (this.nextNoteTime < this.audioContext.currentTime + this.scheduleAheadTime) {
            this.scheduleNote(this.noteIndex, this.nextNoteTime);
            this.nextNote();
        }
        
        if (this.isPlaying && this.noteIndex < this.noteSequence.length) {
            this.timerID = setTimeout(() => this.scheduler(), this.lookahead);
        } else if (this.noteIndex >= this.noteSequence.length) {
            this.stop();
        }
    }
    
    nextNote() {
        if (this.noteIndex < this.noteSequence.length) {
            const note = this.noteSequence[this.noteIndex];
            this.nextNoteTime += this.durationToSeconds(note.duration);
            this.noteIndex++;
        }
    }
    
    scheduleNote(noteIndex, time) {
        if (noteIndex >= this.noteSequence.length) return;
        
        const note = this.noteSequence[noteIndex];
        
        if (note.isRest) {
            return;
        }
        
        if (note.isMetronome && this.metronomeEnabled) {
            this.playMetronomeClick(time, note.accent);
        } else if (!note.isMetronome) {
            const frequency = this.vexFlowNoteToFrequency(note.pitch);
            const duration = this.durationToSeconds(note.duration);
            this.playInstrumentNote(frequency, duration, time);
        }
    }
    
    measuresToNoteSequence(measures) {
        const sequence = [];
        
        measures.forEach((measure, measureIndex) => {
            // Add metronome clicks at the beginning of each beat
            if (this.metronomeEnabled) {
                const beatsPerMeasure = this.getBeatsFromTimeSignature(measure.timeSignature || '4/4');
                const beatValue = this.getBeatValueFromTimeSignature(measure.timeSignature || '4/4');
                const beatDuration = this.getBeatDuration(beatValue);
                
                for (let beat = 0; beat < beatsPerMeasure; beat++) {
                    sequence.push({
                        isMetronome: true,
                        accent: beat === 0,
                        duration: beatDuration,
                        measureIndex: measureIndex
                    });
                }
            }
            
            // Add notes from measure
            if (measure.notes && measure.notes.length > 0) {
                measure.notes.forEach(note => {
                    if (note.keys && note.keys.length > 0) {
                        sequence.push({
                            pitch: note.keys[0],
                            duration: note.duration || 'q',
                            isRest: note.duration && note.duration.includes('r'),
                            measureIndex: measureIndex
                        });
                    }
                });
            } else {
                // Empty measure = whole rest
                sequence.push({
                    pitch: 'b/4',
                    duration: 'wr',
                    isRest: true,
                    measureIndex: measureIndex
                });
            }
        });
        
        return sequence;
    }
    
    playInstrumentNote(frequency, duration, startTime = 0) {
        if (!this.audioContext) return;
        
        const now = startTime;
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        const instrument = this.instruments[this.currentInstrument] || this.instruments['piano'];
        
        oscillator.type = instrument.type;
        oscillator.frequency.value = frequency;
        
        // ADSR envelope
        const attack = instrument.attack;
        const decay = instrument.decay;
        const sustain = instrument.sustain;
        const release = instrument.release;
        const peakLevel = 0.3;
        
        gainNode.gain.value = 0;
        gainNode.gain.linearRampToValueAtTime(peakLevel, now + attack);
        gainNode.gain.linearRampToValueAtTime(peakLevel * sustain, now + attack + decay);
        gainNode.gain.setValueAtTime(peakLevel * sustain, now + duration - release);
        gainNode.gain.linearRampToValueAtTime(0, now + duration);
        
        oscillator.connect(gainNode);
        gainNode.connect(this.masterGain);
        
        oscillator.start(now);
        oscillator.stop(now + duration);
        
        this.scheduledNotes.push({ oscillator, gainNode, stopTime: now + duration });
    }
    
    playMetronomeClick(time, accent = false) {
        if (!this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.frequency.value = accent ? 1000 : 800;
        oscillator.type = 'sine';
        
        gainNode.gain.value = accent ? 0.5 : 0.3;
        gainNode.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
        
        oscillator.connect(gainNode);
        gainNode.connect(this.masterGain);
        
        oscillator.start(time);
        oscillator.stop(time + 0.05);
    }

    pause() {
        this.isPaused = true;
        this.isPlaying = false;
        
        if (this.timerID) {
            clearTimeout(this.timerID);
            this.timerID = null;
        }
        
        this.stopAllNotes();
        console.log('Playback paused at note', this.noteIndex);
    }

    stop() {
        this.isPlaying = false;
        this.isPaused = false;
        this.currentTime = 0;
        this.noteIndex = 0;
        this.currentMeasure = 0;
        
        if (this.timerID) {
            clearTimeout(this.timerID);
            this.timerID = null;
        }
        
        this.stopAllNotes();
        console.log('Playback stopped');
    }

    rewind() {
        this.stop();
        console.log('Rewound to start');
    }

    previousMeasure() {
        if (this.currentMeasure > 0) {
            this.currentMeasure--;
            console.log('Previous measure:', this.currentMeasure);
        }
    }

    nextMeasure() {
        this.currentMeasure++;
        console.log('Next measure:', this.currentMeasure);
    }

    setTempo(bpm) {
        this.tempo = Math.max(20, Math.min(300, bpm));
        console.log('Tempo set to', this.tempo, 'BPM');
    }

    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        if (this.masterGain) {
            this.masterGain.gain.value = this.volume;
        }
        console.log('Volume set to', Math.round(this.volume * 100), '%');
    }

    setMetronome(enabled) {
        this.metronomeEnabled = enabled;
        console.log('Metronome', enabled ? 'enabled' : 'disabled');
    }
    
    setInstrument(instrument) {
        if (this.instruments[instrument]) {
            this.currentInstrument = instrument;
            console.log('Instrument set to', instrument);
        } else {
            console.warn('Unknown instrument:', instrument);
        }
    }
    
    getAvailableInstruments() {
        return Object.keys(this.instruments);
    }

    playTestTone() {
        if (!this.audioContext) return;
        
        const now = this.audioContext.currentTime;
        const notes = [
            { freq: 261.63, time: now },         // C4
            { freq: 293.66, time: now + 0.25 },  // D4
            { freq: 329.63, time: now + 0.5 },   // E4
            { freq: 349.23, time: now + 0.75 }   // F4
        ];
        
        notes.forEach(note => {
            this.playInstrumentNote(note.freq, 0.2, note.time);
        });
        
        console.log('Played test tone sequence');
    }

    stopAllNotes() {
        const now = this.audioContext ? this.audioContext.currentTime : 0;
        
        this.scheduledNotes.forEach(({ oscillator, gainNode, stopTime }) => {
            try {
                if (stopTime > now) {
                    gainNode.gain.cancelScheduledValues(now);
                    gainNode.gain.setValueAtTime(gainNode.gain.value, now);
                    gainNode.gain.linearRampToValueAtTime(0, now + 0.01);
                    oscillator.stop(now + 0.01);
                }
            } catch (error) {
                // Note already stopped
            }
        });
        
        this.scheduledNotes = [];
    }

    // VexFlow note format to frequency
    vexFlowNoteToFrequency(noteString) {
        // Parse VexFlow format: "c/4", "d#/5", "eb/3"
        const match = noteString.match(/^([a-g])(#|b)?\/(\d+)$/i);
        if (!match) {
            console.warn('Invalid note format:', noteString);
            return 440;
        }
        
        const [, note, accidental, octave] = match;
        const noteName = note.toUpperCase() + (accidental || '') + octave;
        const midiNote = this.noteNameToMidi(noteName);
        return this.midiToFrequency(midiNote);
    }
    
    midiToFrequency(midiNote) {
        return 440 * Math.pow(2, (midiNote - 69) / 12);
    }

    noteNameToMidi(noteName) {
        const noteMap = {
            'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
            'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
            'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
        };
        
        const match = noteName.match(/^([A-G][#b]?)(\d+)$/);
        if (!match) return 60;
        
        const [, note, octave] = match;
        const noteValue = noteMap[note] || 0;
        const octaveValue = parseInt(octave) || 4;
        
        return noteValue + (octaveValue + 1) * 12;
    }

    durationToSeconds(duration) {
        const secondsPerBeat = 60.0 / this.tempo;
        const baseDuration = duration.replace(/[rd]/g, '');
        const hasDot = duration.includes('d');
        
        const durationMap = {
            'w': 4, 'h': 2, 'q': 1, '8': 0.5, 
            '16': 0.25, '32': 0.125, '64': 0.0625
        };
        
        let beats = durationMap[baseDuration] || 1;
        if (hasDot) beats *= 1.5;
        
        return beats * secondsPerBeat;
    }
    
    getBeatDuration(beatValue) {
        const map = { 1: 'w', 2: 'h', 4: 'q', 8: '8', 16: '16' };
        return map[beatValue] || 'q';
    }
    
    getBeatsFromTimeSignature(timeSig) {
        return parseInt((timeSig || '4/4').split('/')[0]) || 4;
    }
    
    getBeatValueFromTimeSignature(timeSig) {
        return parseInt((timeSig || '4/4').split('/')[1]) || 4;
    }

    /**
     * Render entire composition to AudioBuffer for export (Phase 4)
     * @returns {Promise<AudioBuffer>} Rendered audio buffer
     */
    async renderToBuffer() {
        try {
            if (!this.measures || this.measures.length === 0) {
                throw new Error('No measures to render');
            }
            
            // Calculate total duration
            const totalDuration = this.calculateTotalDuration();
            
            if (totalDuration <= 0) {
                throw new Error('Invalid duration calculated');
            }
            
            // Create offline audio context for rendering
            const sampleRate = 44100;
            const offlineContext = new OfflineAudioContext(2, sampleRate * totalDuration, sampleRate);
            
            // Schedule all notes
            let currentTime = 0;
            
            for (const measure of this.measures) {
                const notes = measure.notes || [];
                
                for (const note of notes) {
                    if (note.keys && note.keys.length > 0) {
                        const duration = this.getNoteDuration(note.duration, measure.timeSignature);
                        
                        // Play each note in the chord
                        for (const key of note.keys) {
                            const frequency = this.getFrequency(key);
                            
                            // Create oscillator
                            const oscillator = offlineContext.createOscillator();
                            const gainNode = offlineContext.createGain();
                            
                            oscillator.connect(gainNode);
                            gainNode.connect(offlineContext.destination);
                            
                            oscillator.type = this.waveform;
                            oscillator.frequency.setValueAtTime(frequency, currentTime);
                            
                            // Envelope
                            gainNode.gain.setValueAtTime(0, currentTime);
                            gainNode.gain.linearRampToValueAtTime(0.3, currentTime + 0.01);
                            gainNode.gain.exponentialRampToValueAtTime(0.2, currentTime + duration * 0.3);
                            gainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + duration);
                            
                            oscillator.start(currentTime);
                            oscillator.stop(currentTime + duration);
                        }
                        
                        currentTime += duration;
                    }
                }
            }
            
            // Render
            const audioBuffer = await offlineContext.startRendering();
            console.log('Audio rendered:', audioBuffer.duration, 'seconds');
            
            return audioBuffer;
            
        } catch (error) {
            console.error('Error rendering audio buffer:', error);
            throw error;
        }
    }
    
    /**
     * Calculate total duration of composition
     * @returns {number} Duration in seconds
     */
    calculateTotalDuration() {
        let totalDuration = 0;
        
        for (const measure of this.measures) {
            const notes = measure.notes || [];
            let measureDuration = 0;
            
            for (const note of notes) {
                if (note.keys && note.keys.length > 0) {
                    const duration = this.getNoteDuration(note.duration, measure.timeSignature);
                    measureDuration += duration;
                }
            }
            
            // If measure has no notes, use default measure duration based on time signature
            if (measureDuration === 0) {
                const beats = this.getBeatsFromTimeSignature(measure.timeSignature);
                const beatValue = this.getBeatValueFromTimeSignature(measure.timeSignature);
                const secondsPerBeat = 60 / this.tempo * (4 / beatValue);
                measureDuration = beats * secondsPerBeat;
            }
            
            totalDuration += measureDuration;
        }
        
        return totalDuration;
    }

    // Cleanup
    destroy() {
        this.stop();
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }
}
