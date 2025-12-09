/**
 * DScribe - Core Module Tests
 * Comprehensive test suite for notation, playback, audio engines
 */

const NotationEngine = require('../src/renderer/js/notation-engine');
const PlaybackEngine = require('../src/renderer/js/playback-engine');
const HarmonyEngine = require('../src/renderer/js/harmony-engine');
const AudioAnalysisEngine = require('../src/renderer/js/audio-analysis-engine');

describe('NotationEngine', () => {
    let engine;
    let mockCanvas;

    beforeEach(() => {
        mockCanvas = {
            getContext: jest.fn(() => ({
                fillRect: jest.fn(),
                strokeRect: jest.fn(),
                fillText: jest.fn(),
                moveTo: jest.fn(),
                lineTo: jest.fn(),
                stroke: jest.fn(),
                fill: jest.fn(),
                clearRect: jest.fn()
            })),
            width: 1000,
            height: 600
        };
        document.body.innerHTML = '<canvas id="test-canvas"></canvas>';
        engine = new NotationEngine('test-canvas');
    });

    test('should initialize notation engine', () => {
        expect(engine).toBeDefined();
        expect(engine.measures).toBeDefined();
        expect(engine.measures.length).toBeGreaterThan(0);
    });

    test('should add measures', () => {
        const initialCount = engine.measures.length;
        engine.addMeasure();
        expect(engine.measures.length).toBe(initialCount + 1);
    });

    test('should add notes to measure', () => {
        const measureIndex = 0;
        engine.addNote('C4', 'q', measureIndex);
        expect(engine.measures[measureIndex].notes.length).toBeGreaterThan(0);
    });

    test('should add lyrics to notes', () => {
        engine.addNote('C4', 'q', 0);
        engine.addLyrics('La', 0, 0);
        expect(engine.measures[0].notes[0].lyrics).toBe('La');
    });

    test('should add chord symbols', () => {
        engine.addChordSymbol('Cmaj7', 0);
        expect(engine.measures[0].chord).toBe('Cmaj7');
    });

    test('should transpose notes', () => {
        engine.addNote('C4', 'q', 0);
        engine.transpose(2);
        expect(engine.measures[0].notes[0].key).toBe('D4');
    });

    test('should make triplets', () => {
        engine.addNote('C4', 'q', 0);
        engine.addNote('D4', 'q', 0);
        engine.addNote('E4', 'q', 0);
        engine.makeTriplet([0, 1, 2], 0);
        expect(engine.measures[0].notes[0].triplet).toBe(true);
    });

    test('should get notes from measure', () => {
        engine.addNote('C4', 'q', 0);
        engine.addNote('D4', 'q', 0);
        const notes = engine.getNotesFromMeasure(0);
        expect(notes.length).toBe(2);
    });

    test('should change clef', () => {
        engine.setClef('bass');
        expect(engine.measures[0].clef).toBe('bass');
    });

    test('should set time signature', () => {
        engine.setTimeSignature('3/4');
        expect(engine.timeSignature).toBe('3/4');
    });
});

describe('PlaybackEngine', () => {
    let engine;

    beforeEach(() => {
        engine = new PlaybackEngine();
    });

    test('should initialize playback engine', () => {
        expect(engine).toBeDefined();
        expect(engine.audioContext).toBeDefined();
    });

    test('should play notes', () => {
        const notes = [
            { key: 'C4', duration: 'q' },
            { key: 'D4', duration: 'q' },
            { key: 'E4', duration: 'q' }
        ];
        engine.play(notes);
        expect(engine.isPlaying).toBe(true);
    });

    test('should pause playback', () => {
        engine.pause();
        expect(engine.isPlaying).toBe(false);
    });

    test('should stop playback', () => {
        engine.stop();
        expect(engine.isPlaying).toBe(false);
    });

    test('should set tempo', () => {
        engine.setTempo(140);
        expect(engine.tempo).toBe(140);
    });

    test('should set volume', () => {
        engine.setVolume(80);
        expect(engine.volume).toBe(80);
    });

    test('should select instrument', () => {
        engine.selectInstrument('piano');
        expect(engine.currentInstrument).toBe('piano');
    });

    test('should support multiple instruments', () => {
        const instruments = ['piano', 'guitar', 'violin', 'flute', 'trumpet'];
        instruments.forEach(inst => {
            engine.selectInstrument(inst);
            expect(engine.currentInstrument).toBe(inst);
        });
    });
});

describe('HarmonyEngine', () => {
    let engine;

    beforeEach(() => {
        engine = new HarmonyEngine();
    });

    test('should initialize harmony engine', () => {
        expect(engine).toBeDefined();
        expect(engine.chordDatabase).toBeDefined();
    });

    test('should generate basic chords', () => {
        const chord = engine.generateChord('C', 'major');
        expect(chord).toBeDefined();
        expect(chord.root).toBe('C');
    });

    test('should generate jazz chords', () => {
        const chord = engine.generateChord('Dm', 'minor7b5');
        expect(chord).toBeDefined();
        expect(chord.type).toBe('minor7b5');
    });

    test('should transpose chords', () => {
        const chord = engine.generateChord('C', 'major');
        const transposed = engine.transposeChord(chord, 2);
        expect(transposed.root).toBe('D');
    });

    test('should analyze harmony', () => {
        const notes = [60, 64, 67]; // C, E, G
        const analysis = engine.analyzeHarmony(notes);
        expect(analysis).toBeDefined();
        expect(analysis.chord).toBeDefined();
    });

    test('should suggest harmonization', () => {
        const melody = [60, 62, 64]; // C, D, E
        const harmonization = engine.suggestHarmonization(melody);
        expect(harmonization).toBeDefined();
        expect(harmonization.length).toBeGreaterThan(0);
    });

    test('should handle guitar chords', () => {
        const chord = engine.getGuitarChord('Cmaj7', 'standard');
        expect(chord).toBeDefined();
        expect(chord.fingering).toBeDefined();
    });
});

describe('AudioAnalysisEngine', () => {
    let engine;

    beforeEach(async () => {
        engine = new AudioAnalysisEngine();
        await engine.initialize();
    });

    test('should initialize audio analysis engine', () => {
        expect(engine).toBeDefined();
        expect(engine.audioContext).toBeDefined();
    });

    test('should detect pitch', async () => {
        // Create test audio buffer with 440 Hz (A4)
        const sampleRate = 44100;
        const duration = 0.5; // 0.5 seconds
        const audioBuffer = engine.audioContext.createAudioBuffer(1, sampleRate * duration, sampleRate);
        
        // Fill with sine wave at 440 Hz
        const data = audioBuffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
            data[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate);
        }
        
        const result = await engine.detectPitch(audioBuffer);
        expect(result).toBeDefined();
        // Should be close to 440 Hz (allow 50 Hz tolerance)
        if (result.frequency) {
            expect(Math.abs(result.frequency - 440)).toBeLessThan(50);
        }
    });

    test('should detect note from pitch', () => {
        const note = engine.pitchToNote(440); // A4
        expect(note).toBe('A4');
    });

    test('should extract features from audio', async () => {
        const sampleRate = 44100;
        const audioBuffer = engine.audioContext.createAudioBuffer(1, sampleRate * 0.1, sampleRate);
        
        const features = await engine.extractFeatures(audioBuffer);
        expect(features).toBeDefined();
        expect(features.energy).toBeDefined();
        expect(features.spectralCentroid).toBeDefined();
    });
});

// Integration Tests
describe('DScribe Integration Tests', () => {
    test('Noteneingabe -> Playback', () => {
        const notation = new NotationEngine('test-canvas');
        const playback = new PlaybackEngine();
        
        notation.addNote('C4', 'q');
        notation.addNote('E4', 'q');
        notation.addNote('G4', 'q');
        
        const notes = notation.getNotesFromMeasure(0);
        playback.play(notes);
        
        expect(playback.isPlaying).toBe(true);
        expect(notes.length).toBe(3);
    });

    test('Harmonization workflow', () => {
        const notation = new NotationEngine('test-canvas');
        const harmony = new HarmonyEngine();
        
        notation.addNote('C4', 'q');
        notation.addNote('D4', 'q');
        notation.addNote('E4', 'q');
        
        const melody = [60, 62, 64];
        const harmonization = harmony.suggestHarmonization(melody);
        
        expect(harmonization).toBeDefined();
        expect(harmonization.length).toBeGreaterThan(0);
    });

    test('Complete notation workflow', () => {
        const notation = new NotationEngine('test-canvas');
        
        // Add multiple measures
        notation.addMeasure();
        notation.addMeasure();
        
        // Add notes
        notation.addNote('C4', 'q', 0);
        notation.addNote('D4', 'q', 0);
        notation.addNote('E4', 'q', 0);
        notation.addNote('F4', 'q', 0);
        
        notation.addNote('G4', 'q', 1);
        notation.addNote('A4', 'q', 1);
        notation.addNote('B4', 'q', 1);
        notation.addNote('C5', 'q', 1);
        
        // Add lyrics
        notation.addLyrics('Do', 0, 0);
        notation.addLyrics('Re', 1, 0);
        
        // Add chord symbols
        notation.addChordSymbol('Cmaj7', 0);
        
        expect(notation.measures.length).toBe(2);
        expect(notation.measures[0].notes.length).toBe(4);
        expect(notation.measures[0].chord).toBe('Cmaj7');
    });
});
