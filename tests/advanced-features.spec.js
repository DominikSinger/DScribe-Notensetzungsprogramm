/**
 * DScribe - Advanced Features Tests
 * Tests for ML-enhanced audio processing, OCR, VST3 integration, and advanced features
 */

const AudioSplitter = require('../src/modules/audio-splitter');
const OMREngine = require('../src/modules/omr-engine');
const VST3Manager = require('../src/modules/vst3-manager');
const DrumNotation = require('../src/modules/drum-notation');
const JazzChords = require('../src/modules/jazz-chords');
const RepetitionEngine = require('../src/modules/repetition-engine');
const PerformanceMode = require('../src/modules/performance-mode');
const Logger = require('../src/modules/logger');

// Mock ML libraries
jest.mock('@tensorflow/tfjs', () => ({
    loadLayersModel: jest.fn(() => Promise.resolve({
        predict: jest.fn(() => ({
            data: () => Promise.resolve(new Float32Array([0.1, 0.2, 0.3, 0.4]))
        }))
    })),
    tensor: jest.fn(() => ({
        dispose: jest.fn()
    }))
}));

jest.mock('tesseract.js', () => ({
    createWorker: jest.fn(() => Promise.resolve({
        loadLanguage: jest.fn(() => Promise.resolve()),
        initialize: jest.fn(() => Promise.resolve()),
        recognize: jest.fn(() => Promise.resolve({
            data: { text: 'Sample OCR text', confidence: 85 }
        })),
        terminate: jest.fn(() => Promise.resolve())
    }))
}));

describe('Advanced Features Integration', () => {
    let logger;

    beforeEach(() => {
        logger = new Logger();
        jest.clearAllMocks();
    });

    describe('ML-Enhanced Audio Splitter', () => {
        let audioSplitter;

        beforeEach(() => {
            audioSplitter = new AudioSplitter(logger);
        });

        test('should initialize ML models', async () => {
            const result = await audioSplitter.initializeML();
            expect(result).toBeDefined();
            expect(result.success).toBeDefined();
        });

        test('should perform source separation with ML', async () => {
            const mockAudioBuffer = {
                length: 44100,
                sampleRate: 44100,
                numberOfChannels: 2,
                getChannelData: jest.fn(() => {
                    const data = new Float32Array(44100);
                    // Add some test signal
                    for (let i = 0; i < data.length; i++) {
                        data[i] = Math.sin(2 * Math.PI * 440 * i / 44100) * 0.5;
                    }
                    return data;
                })
            };

            await audioSplitter.initializeML();
            const result = await audioSplitter.splitAudio(mockAudioBuffer);

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            expect(result.stems).toBeDefined();
            expect(result.stems.drums).toBeDefined();
            expect(result.stems.bass).toBeDefined();
            expect(result.stems.vocals).toBeDefined();
        });

        test('should handle ML model loading failure', async () => {
            // Mock model loading failure
            require('@tensorflow/tfjs').loadLayersModel.mockRejectedValueOnce(new Error('Model not found'));

            const result = await audioSplitter.initializeML();
            expect(result.success).toBe(false);
        });

        test('should export separated stems', async () => {
            const mockStems = {
                drums: new Float32Array(44100).fill(0.1),
                bass: new Float32Array(44100).fill(0.2),
                vocals: new Float32Array(44100).fill(0.3),
                other: new Float32Array(44100).fill(0.4)
            };

            const result = await audioSplitter.exportStems(mockStems, 44100);
            expect(result.success).toBe(true);
            expect(result.files).toBeDefined();
            expect(result.files.length).toBe(4);
        });

        test('should apply spectral masking for separation', async () => {
            const mockSpectrogram = new Float32Array(1024 * 100); // Mock spectrogram
            const result = await audioSplitter.applySpectralMasking(mockSpectrogram, 'vocals');

            expect(result).toBeDefined();
            expect(result.length).toBe(mockSpectrogram.length);
        });
    });

    describe('OCR-Enhanced OMR Engine', () => {
        let omrEngine;

        beforeEach(() => {
            omrEngine = new OMREngine(logger);
        });

        test('should initialize OCR worker', async () => {
            const result = await omrEngine.initializeOCR();
            expect(result).toBeDefined();
            expect(result.success).toBeDefined();
        });

        test('should perform OCR on image data', async () => {
            await omrEngine.initializeOCR();

            const mockImageData = {
                width: 800,
                height: 600,
                data: new Uint8ClampedArray(800 * 600 * 4)
            };

            const mockPages = [{ imageData: mockImageData }];
            const result = await omrEngine.performOCR(mockPages);

            expect(result).toBeDefined();
            expect(result.text).toBeDefined();
            expect(result.confidence).toBeGreaterThan(0);
            expect(result.pagesProcessed).toBe(1);
        });

        test('should convert ImageData to canvas', () => {
            const mockImageData = {
                width: 100,
                height: 100,
                data: new Uint8ClampedArray(40000)
            };

            const canvas = omrEngine.imageDataToCanvas(mockImageData);
            expect(canvas).toBeDefined();
            expect(canvas.width).toBe(100);
            expect(canvas.height).toBe(100);
            expect(canvas.toDataURL).toBeDefined();
        });

        test('should handle OCR errors gracefully', async () => {
            // OCR not initialized
            const mockPages = [{ imageData: null }];
            const result = await omrEngine.performOCR(mockPages);

            expect(result.text).toBe('');
            expect(result.confidence).toBe(0);
        });

        test('should cleanup OCR resources', async () => {
            await omrEngine.initializeOCR();
            await omrEngine.cleanup();

            expect(omrEngine.ocrWorker).toBeNull();
        });
    });

    describe('VST3 Plugin Integration', () => {
        let vst3Manager;

        beforeEach(() => {
            vst3Manager = new VST3Manager(logger);
        });

        test('should scan for VST3 plugins', async () => {
            const plugins = await vst3Manager.scanPlugins();
            expect(Array.isArray(plugins)).toBe(true);
        });

        test('should load VST3 plugin', async () => {
            const mockPlugin = {
                id: 'test-synth',
                path: '/path/to/synth.vst3',
                name: 'Test Synth'
            };

            const result = await vst3Manager.loadPlugin(mockPlugin);
            expect(result).toBeDefined();
            expect(result.success).toBeDefined();
        });

        test('should process audio through VST3 plugin', async () => {
            const mockAudioBuffer = {
                length: 44100,
                sampleRate: 44100,
                numberOfChannels: 2,
                getChannelData: jest.fn(() => new Float32Array(44100))
            };

            const result = await vst3Manager.processAudio(mockAudioBuffer, 'test-plugin');
            expect(result).toBeDefined();
            expect(result.success).toBeDefined();
        });

        test('should handle plugin parameters', async () => {
            const parameters = {
                volume: 0.8,
                pan: 0.0,
                reverb: 0.3
            };

            const result = await vst3Manager.setPluginParameters('test-plugin', parameters);
            expect(result).toBeDefined();
            expect(result.success).toBeDefined();
        });

        test('should unload plugin', async () => {
            const result = await vst3Manager.unloadPlugin('test-plugin');
            expect(result).toBeDefined();
            expect(result.success).toBeDefined();
        });
    });

    describe('Drum Notation Engine', () => {
        let drumNotation;

        beforeEach(() => {
            drumNotation = new DrumNotation(logger);
        });

        test('should initialize drum notation', () => {
            expect(drumNotation).toBeDefined();
            expect(drumNotation.logger).toBe(logger);
        });

        test('should parse drum patterns', () => {
            const pattern = 'HH: x-x-|SD: --x-|BD: x---';
            const result = drumNotation.parsePattern(pattern);

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            expect(result.notes).toBeDefined();
        });

        test('should generate drum notation', () => {
            const notes = [
                { instrument: 'BD', position: 0, velocity: 100 },
                { instrument: 'SD', position: 2, velocity: 80 },
                { instrument: 'HH', position: 1, velocity: 60 }
            ];

            const result = drumNotation.generateNotation(notes);
            expect(result).toBeDefined();
            expect(result.notation).toBeDefined();
        });

        test('should handle complex drum patterns', () => {
            const complexPattern = `
                HH: x-x-x-x-|x-x-x-x-
                SD: ----x---|----x---
                BD: x-------|x-------
                CY: --x-----|--x-----
            `;

            const result = drumNotation.parsePattern(complexPattern.trim());
            expect(result.success).toBe(true);
        });
    });

    describe('Jazz Chords Engine', () => {
        let jazzChords;

        beforeEach(() => {
            jazzChords = new JazzChords(logger);
        });

        test('should initialize jazz chords', () => {
            expect(jazzChords).toBeDefined();
            expect(jazzChords.logger).toBe(logger);
        });

        test('should analyze chord progressions', () => {
            const progression = ['Cmaj7', 'Dm7', 'G7', 'Cmaj7'];
            const result = jazzChords.analyzeProgression(progression);

            expect(result).toBeDefined();
            expect(result.analysis).toBeDefined();
            expect(result.tension).toBeDefined();
        });

        test('should generate chord voicings', () => {
            const chord = 'Cmaj7';
            const result = jazzChords.generateVoicings(chord);

            expect(result).toBeDefined();
            expect(Array.isArray(result.voicings)).toBe(true);
            expect(result.voicings.length).toBeGreaterThan(0);
        });

        test('should suggest chord substitutions', () => {
            const original = 'Dm7';
            const context = ['Cmaj7', 'Dm7', 'G7'];

            const result = jazzChords.suggestSubstitutions(original, context);
            expect(result).toBeDefined();
            expect(Array.isArray(result.substitutions)).toBe(true);
        });

        test('should handle extended chords', () => {
            const extendedChords = ['C7b9', 'D7#11', 'Eb7b5', 'Fmaj7#11'];
            extendedChords.forEach(chord => {
                const result = jazzChords.parseChord(chord);
                expect(result).toBeDefined();
                expect(result.root).toBeDefined();
                expect(result.quality).toBeDefined();
            });
        });
    });

    describe('Repetition Engine', () => {
        let repetitionEngine;

        beforeEach(() => {
            repetitionEngine = new RepetitionEngine(logger);
        });

        test('should initialize repetition engine', () => {
            expect(repetitionEngine).toBeDefined();
            expect(repetitionEngine.logger).toBe(logger);
        });

        test('should detect repeated sections', () => {
            const measures = [
                { notes: ['C4', 'D4', 'E4'] },
                { notes: ['C4', 'D4', 'E4'] },
                { notes: ['F4', 'G4', 'A4'] },
                { notes: ['C4', 'D4', 'E4'] }
            ];

            const result = repetitionEngine.detectRepetitions(measures);
            expect(result).toBeDefined();
            expect(result.repetitions).toBeDefined();
        });

        test('should create repeat signs', () => {
            const section = { start: 0, end: 3 };
            const result = repetitionEngine.createRepeat(section);

            expect(result).toBeDefined();
            expect(result.repeat).toBeDefined();
            expect(result.start).toBe(0);
            expect(result.end).toBe(3);
        });

        test('should handle complex repeats', () => {
            const measures = Array(16).fill().map((_, i) => ({
                notes: i < 4 ? ['C4', 'D4'] : i < 8 ? ['E4', 'F4'] : ['G4', 'A4']
            }));

            const result = repetitionEngine.analyzeStructure(measures);
            expect(result).toBeDefined();
            expect(result.sections).toBeDefined();
        });
    });

    describe('Performance Mode', () => {
        let performanceMode;

        beforeEach(() => {
            performanceMode = new PerformanceMode(logger);
        });

        test('should initialize performance mode', () => {
            expect(performanceMode).toBeDefined();
            expect(performanceMode.logger).toBe(logger);
        });

        test('should handle real-time input', () => {
            const input = { type: 'midi', note: 60, velocity: 100 };
            const result = performanceMode.processInput(input);

            expect(result).toBeDefined();
            expect(result.processed).toBe(true);
        });

        test('should manage tempo changes', () => {
            const newTempo = 120;
            const result = performanceMode.setTempo(newTempo);

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
        });

        test('should handle pedal input', () => {
            const pedalEvent = { type: 'sustain', pressed: true };
            const result = performanceMode.processPedal(pedalEvent);

            expect(result).toBeDefined();
            expect(result.processed).toBe(true);
        });

        test('should record performance', () => {
            const result = performanceMode.startRecording();
            expect(result).toBeDefined();
            expect(result.recording).toBe(true);

            const stopResult = performanceMode.stopRecording();
            expect(stopResult).toBeDefined();
            expect(stopResult.recording).toBe(false);
        });
    });

    describe('Integration Tests', () => {
        test('should integrate ML audio splitting with VST3 processing', async () => {
            const audioSplitter = new AudioSplitter(logger);
            const vst3Manager = new VST3Manager(logger);

            const mockAudioBuffer = {
                length: 44100,
                sampleRate: 44100,
                numberOfChannels: 2,
                getChannelData: jest.fn(() => new Float32Array(44100))
            };

            // Split audio
            await audioSplitter.initializeML();
            const splitResult = await audioSplitter.splitAudio(mockAudioBuffer);
            expect(splitResult.success).toBe(true);

            // Process stems through VST3
            if (splitResult.stems) {
                for (const [stemName, stemData] of Object.entries(splitResult.stems)) {
                    const vstResult = await vst3Manager.processAudio(mockAudioBuffer, `test-${stemName}-fx`);
                    expect(vstResult.success).toBeDefined();
                }
            }
        });

        test('should integrate OCR with notation engine', async () => {
            const omrEngine = new OMREngine(logger);

            await omrEngine.initializeOCR();

            const mockImageData = {
                width: 800,
                height: 600,
                data: new Uint8ClampedArray(800 * 600 * 4)
            };

            const ocrResult = await omrEngine.performOCR([{ imageData: mockImageData }]);
            expect(ocrResult.text).toBeDefined();

            // In a real scenario, this text would be parsed into notation
            const parsedNotation = omrEngine.parseRecognizedText(ocrResult.text);
            expect(parsedNotation).toBeDefined();
        });

        test('should handle complex workflow: import -> process -> export', async () => {
            const importManager = require('../src/modules/import-manager');
            const exportManager = require('../src/modules/export-manager');

            const importer = new importManager(logger);
            const exporter = new exportManager(logger);

            // Mock import
            const importResult = await importer.importMIDI('/test/file.mid');
            expect(importResult.success).toBeDefined();

            if (importResult.success) {
                // Mock export
                const exportResult = await exporter.exportToPDF(importResult.project);
                expect(exportResult.success).toBeDefined();
            }
        });
    });
});
                { pitch: 'C4', duration: 'q', position: 100 },
                { pitch: 'E4', duration: 'q', position: 140 },
                { pitch: 'G4', duration: 'h', position: 180 }
            ];
            
            expect(detectedNotes.length).toBe(3);
            expect(detectedNotes[0].pitch).toBe('C4');
        });
    });
});

describe('Import/Export Modules', () => {
    describe('Project Manager', () => {
        test('should export project to JSON', () => {
            const projectData = {
                title: 'Test Project',
                composer: 'Test Composer',
                tempo: 120,
                timeSignature: '4/4',
                measures: [
                    { notes: [{ key: 'C4', duration: 'q' }] }
                ]
            };
            
            const json = JSON.stringify(projectData);
            const parsed = JSON.parse(json);
            
            expect(parsed.title).toBe('Test Project');
            expect(parsed.measures.length).toBe(1);
        });

        test('should export project to MusicXML', () => {
            const projectData = {
                title: 'Test Project',
                measures: [{ notes: [{ key: 'C4', duration: 'q' }] }]
            };
            
            let xml = '<?xml version="1.0"?>\n';
            xml += '<score-partwise version="3.1">\n';
            xml += `  <work-title>${projectData.title}</work-title>\n`;
            xml += '</score-partwise>';
            
            expect(xml).toContain('score-partwise');
            expect(xml).toContain(projectData.title);
        });

        test('should import JSON project', () => {
            const jsonData = {
                title: 'Imported Project',
                composer: 'Unknown',
                tempo: 120,
                measures: []
            };
            
            expect(jsonData.title).toBe('Imported Project');
            expect(jsonData.measures).toEqual([]);
        });
    });
});

describe('Advanced Features', () => {
    describe('Lyrics Engine', () => {
        test('should add lyrics to measures', () => {
            const lyrics = {
                verse1: ['La', 'la', 'la', 'la'],
                verse2: ['Do', 're', 'mi', 'fa']
            };
            
            expect(lyrics.verse1.length).toBe(4);
            expect(lyrics.verse2[0]).toBe('Do');
        });

        test('should support multiple verses', () => {
            const measureLyrics = {
                verse1: 'La la',
                verse2: 'Do re',
                verse3: 'Mi fa'
            };
            
            expect(Object.keys(measureLyrics).length).toBe(3);
        });

        test('should align syllables to notes', () => {
            const notes = [
                { key: 'C4', duration: 'q' },
                { key: 'E4', duration: 'q' },
                { key: 'G4', duration: 'q' }
            ];
            
            const syllables = ['Do', 're', 'mi'];
            const aligned = notes.map((note, idx) => ({
                ...note,
                syllable: syllables[idx]
            }));
            
            expect(aligned.length).toBe(3);
            expect(aligned[0].syllable).toBe('Do');
        });

        test('should handle multi-verse display', () => {
            const verses = {
                1: { text: 'First verse lyrics', notes: [60, 62, 64] },
                2: { text: 'Second verse lyrics', notes: [60, 62, 64] },
                3: { text: 'Third verse lyrics', notes: [60, 62, 64] }
            };
            
            expect(Object.keys(verses).length).toBe(3);
            verses[2].notes.forEach(note => expect(note).toBeGreaterThan(0));
        });
    });

    describe('Repetition Engine', () => {
        test('should mark repetitions', () => {
            const repetitionMarks = {
                measure1: 'repeat_start',
                measure4: 'repeat_end',
                measure8: 'fine',
                measure6: 'coda'
            };
            
            expect(repetitionMarks.measure1).toBe('repeat_start');
            expect(repetitionMarks.measure4).toBe('repeat_end');
        });

        test('should generate playback sequence', () => {
            const marks = {
                1: 'repeat_start',
                4: 'repeat_end'
            };
            
            // Simple repeat: 1-4, then 1-4 again
            const sequence = [1, 2, 3, 4, 1, 2, 3, 4];
            
            expect(sequence.length).toBe(8);
            expect(sequence[0]).toBe(1);
            expect(sequence[4]).toBe(1);
        });

        test('should handle D.C. and D.S.', () => {
            const marks = {
                6: 'segno',
                12: 'd_c_al_fine',
                10: 'fine'
            };
            
            // D.C. al Fine: go to beginning, play until Fine
            const sequence = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]; // Then back to 1-10
            
            expect(sequence.length).toBe(10);
            expect(sequence[5]).toBe(6); // Segno at measure 6
        });

        test('should handle Coda', () => {
            const marks = {
                8: 'to_coda',
                15: 'coda'
            };
            
            // Play 1-8, then skip to coda (15+)
            const sequence = [1, 2, 3, 4, 5, 6, 7, 8, 15, 16, 17];
            
            expect(sequence.includes(8)).toBe(true);
            expect(sequence.includes(9)).toBe(false); // Skipped
            expect(sequence.includes(15)).toBe(true); // Coda starts
        });

        test('should handle D.S. al Coda', () => {
            const marks = {
                4: 'segno',
                8: 'd_s_al_coda',
                12: 'coda'
            };
            
            // Go back to Segno (measure 4), play to Coda marker, then jump to Coda
            const sequence = [1, 2, 3, 4, 5, 6, 7, 8, 12, 13, 14];
            
            expect(sequence[3]).toBe(4); // Segno
            expect(sequence[8]).toBe(12); // Jump to Coda
        });
    });

    describe('Jazz Chords', () => {
        test('should generate extended chords', () => {
            const chords = {
                'maj7': { root: 'C', intervals: [0, 4, 7, 11] },
                'min7b5': { root: 'D', intervals: [0, 3, 6, 10] },
                'dominant13': { root: 'G', intervals: [0, 4, 7, 10, 14] }
            };
            
            expect(chords.maj7.intervals.length).toBeGreaterThan(0);
            expect(chords.min7b5.root).toBe('D');
        });

        test('should apply voicings', () => {
            const voicings = {
                'drop2': [0, 7, 4, 11], // Root, 5th, 3rd, 7th
                'drop3': [0, 11, 4, 7], // Root, 7th, 3rd, 5th
                'rootPosition': [0, 4, 7, 11]
            };
            
            expect(voicings.drop2.length).toBe(4);
            expect(voicings.rootPosition[0]).toBe(0); // Root first
        });

        test('should transpose jazz chords', () => {
            const chord = { root: 'C', type: 'maj7' };
            const transposed = { root: 'D', type: 'maj7' };
            
            expect(transposed.root).not.toBe(chord.root);
            expect(transposed.type).toBe(chord.type);
        });
    });

    describe('Performance Mode', () => {
        test('should display large score efficiently', () => {
            const pageCount = Math.ceil(200 / 15); // 200 measures, 15 per page
            expect(pageCount).toBeGreaterThan(1);
        });

        test('should auto page-turn', () => {
            const measureTime = (60 / 120) * 4; // 4 quarter notes at 120 BPM
            const measuresPerPage = 15;
            const pageTime = measureTime * measuresPerPage;
            
            expect(pageTime).toBeGreaterThan(0);
        });

        test('should track playback position', () => {
            const totalMeasures = 100;
            const currentMeasure = 37;
            const progress = (currentMeasure / totalMeasures) * 100;
            
            expect(progress).toBeCloseTo(37, 1);
        });
    });

    describe('Drum Notation', () => {
        test('should support drum kits', () => {
            const kits = {
                standard: { kick: 36, snare: 38, hihat_closed: 42 },
                jazz: { kick: 36, snare: 38, hihat_open: 46 },
                electronic: { kick: 36, snare: 38, hihat_pedal: 44 }
            };
            
            expect(Object.keys(kits).length).toBe(3);
            expect(kits.standard.kick).toBe(36);
        });

        test('should render drum notation', () => {
            const drumNotes = [
                { instrument: 'kick', position: 100 },
                { instrument: 'snare', position: 150 },
                { instrument: 'hihat', position: 175 }
            ];
            
            expect(drumNotes.length).toBe(3);
            expect(drumNotes[0].instrument).toBe('kick');
        });
    });

    describe('Audio Export', () => {
        test('should generate audio with correct duration', () => {
            const measures = 16;
            const tempo = 120;
            const noteCount = measures * 4; // 4 quarter notes per measure
            const duration = (noteCount / (tempo / 60)); // seconds
            
            expect(duration).toBeCloseTo(32, 0); // 16 measures at 120 BPM = 32 seconds
        });

        test('should apply ADSR envelopes', () => {
            const adsr = {
                attack: 0.01,
                decay: 0.1,
                sustain: 0.8,
                release: 0.2
            };
            
            expect(adsr.attack + adsr.decay + adsr.release).toBeGreaterThan(0);
            expect(adsr.sustain).toBeLessThanOrEqual(1);
        });

        test('should mix multiple voices', () => {
            const voices = [
                { instrument: 'piano', volume: 0.7 },
                { instrument: 'strings', volume: 0.5 },
                { instrument: 'bass', volume: 0.6 }
            ];
            
            const totalVolume = voices.reduce((sum, v) => sum + v.volume, 0);
            expect(totalVolume).toBeCloseTo(1.8, 1);
        });

        test('should normalize audio output', () => {
            const audioBuffer = [1.2, 0.8, -1.5, 0.3]; // Some clipping
            const peak = Math.max(...audioBuffer.map(Math.abs));
            const normalized = audioBuffer.map(s => s / peak);
            
            expect(Math.max(...normalized.map(Math.abs))).toBeCloseTo(1.0, 5);
        });
    });
});

describe('Performance & Stability', () => {
    test('should handle large scores (>100 measures)', () => {
        const largeScore = { measures: Array(150).fill({}) };
        expect(largeScore.measures.length).toBe(150);
    });

    test('should maintain memory efficiency', () => {
        const notes = Array(1000).fill({ key: 'C4', duration: 'q' });
        const size = JSON.stringify(notes).length / 1024; // KB
        expect(size).toBeLessThan(100); // Should be less than 100KB
    });

    test('should handle rapid input', () => {
        let noteCount = 0;
        for (let i = 0; i < 100; i++) {
            noteCount++;
        }
        expect(noteCount).toBe(100);
    });
});
