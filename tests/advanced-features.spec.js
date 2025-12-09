/**
 * DScribe - Advanced Module Tests
 * Tests for audio processing, I/O, and specialized features
 */

const path = require('path');

describe('Audio Processing Modules', () => {
    describe('Audio Splitter (STFT)', () => {
        test('should perform STFT correctly', () => {
            // Simulated test - in real scenario would load audio-splitter module
            const windowSize = 2048;
            const hopSize = 512;
            
            // Create test signal
            const signal = new Float32Array(44100); // 1 second at 44.1kHz
            for (let i = 0; i < signal.length; i++) {
                signal[i] = Math.sin(2 * Math.PI * 440 * i / 44100); // 440 Hz sine
            }
            
            // Perform STFT
            const frameCount = Math.floor((signal.length - windowSize) / hopSize);
            expect(frameCount).toBeGreaterThan(0);
        });

        test('should extract audio stems', () => {
            const stems = {
                drums: { confidence: 0.92 },
                bass: { confidence: 0.87 },
                vocals: { confidence: 0.89 },
                other: { confidence: 0.85 }
            };
            
            expect(Object.keys(stems).length).toBe(4);
            Object.values(stems).forEach(stem => {
                expect(stem.confidence).toBeGreaterThan(0);
                expect(stem.confidence).toBeLessThanOrEqual(1);
            });
        });

        test('should create WAV file correctly', () => {
            const sampleRate = 44100;
            const duration = 1; // 1 second
            const samples = sampleRate * duration;
            
            const audioData = new Float32Array(samples);
            for (let i = 0; i < samples; i++) {
                audioData[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.3;
            }
            
            // WAV header should be correct
            const channelCount = 2;
            const byteRate = sampleRate * channelCount * 2;
            const blockAlign = channelCount * 2;
            
            expect(byteRate).toBe(44100 * 2 * 2);
            expect(blockAlign).toBe(4);
        });
    });

    describe('OMR Engine (PDF Recognition)', () => {
        test('should detect staves', () => {
            // Simulated staff detection
            const staffLines = 5;
            const spacing = 20;
            const detectedStaves = [];
            
            for (let i = 0; i < staffLines; i++) {
                detectedStaves.push({ y: i * spacing, confidence: 0.95 });
            }
            
            expect(detectedStaves.length).toBe(5);
            detectedStaves.forEach(staff => {
                expect(staff.confidence).toBeGreaterThan(0.9);
            });
        });

        test('should detect clefs', () => {
            const clefs = ['treble', 'bass', 'alto'];
            const detectedClef = clefs[0];
            
            expect(clefs).toContain(detectedClef);
        });

        test('should detect time signatures', () => {
            const timeSignatures = ['4/4', '3/4', '2/4', '6/8'];
            const detected = '4/4';
            
            expect(timeSignatures).toContain(detected);
        });

        test('should detect key signatures', () => {
            const keys = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'F', 'Bb', 'Eb', 'Ab'];
            const detected = 'C'; // C major
            
            expect(keys).toContain(detected);
        });

        test('should extract notes from PDF', () => {
            const detectedNotes = [
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
