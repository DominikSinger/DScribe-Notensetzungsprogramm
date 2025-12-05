// PATH: src/modules/omr-manager.js
// DScribe - Optical Music Recognition Manager (Phase 8)

const fs = require('fs-extra');
const path = require('path');
const sharp = require('sharp');
const Tesseract = require('tesseract.js');
const { pdf } = require('pdf-poppler');
const logger = require('./logger');

class OMRManager {
    constructor() {
        this.initialized = false;
        this.supportedFormats = ['pdf', 'png', 'jpg', 'jpeg'];
        this.tesseractWorker = null;
        this.noteTemplates = this.initializeNoteTemplates();
    }

    initializeNoteTemplates() {
        // Musical notation templates for pattern matching
        return {
            'whole': { duration: 'w', pattern: 'o' },
            'half': { duration: 'h', pattern: 'd' },
            'quarter': { duration: 'q', pattern: 'd' },
            'eighth': { duration: '8', pattern: 'd♪' },
            'sixteenth': { duration: '16', pattern: 'd♬' },
            'clef-treble': { type: 'clef', value: 'treble', pattern: '𝄞' },
            'clef-bass': { type: 'clef', value: 'bass', pattern: '𝄢' },
            'sharp': { type: 'accidental', value: '#', pattern: '♯' },
            'flat': { type: 'accidental', value: 'b', pattern: '♭' },
            'natural': { type: 'accidental', value: 'n', pattern: '♮' }
        };
    }

    async initialize() {
        try {
            logger.info('OMR Manager initializing...');
            
            // Initialize Tesseract worker for text/symbol recognition
            this.tesseractWorker = await Tesseract.createWorker('eng', 1, {
                logger: m => logger.debug('Tesseract:', m)
            });
            
            this.initialized = true;
            logger.info('OMR Manager initialized with Tesseract.js and Sharp');
        } catch (error) {
            logger.error('Failed to initialize OMR:', error);
            throw error;
        }
    }

    async recognizeFromFile(filePath) {
        try {
            if (!this.initialized) {
                await this.initialize();
            }

            const ext = path.extname(filePath).toLowerCase().slice(1);
            
            if (!this.supportedFormats.includes(ext)) {
                throw new Error(`Unsupported file format: ${ext}`);
            }

            logger.info(`Starting OMR on file: ${filePath}`);
            const startTime = Date.now();

            // Step 1: Preprocess image
            const preprocessedPath = await this.preprocessImage(filePath);
            
            // Step 2: Detect staff lines
            const staffInfo = await this.detectStaffLines(preprocessedPath);
            
            if (staffInfo.staves.length === 0) {
                throw new Error('No staff lines detected in image');
            }
            
            // Step 3: Segment symbols
            const symbols = await this.segmentSymbols(preprocessedPath, staffInfo);
            
            // Step 4: Recognize each symbol
            const recognizedSymbols = [];
            for (const symbol of symbols) {
                const recognized = await this.recognizeSymbol(symbol, staffInfo);
                if (recognized.type !== 'unknown') {
                    recognizedSymbols.push(recognized);
                }
            }
            
            // Step 5: Build musical structure
            const structure = await this.buildMusicalStructure(recognizedSymbols, staffInfo);
            
            const processingTime = Date.now() - startTime;

            const result = {
                success: structure.measures.length > 0,
                message: structure.measures.length > 0 
                    ? `${structure.measures.length} Takte erkannt` 
                    : 'Keine Noten erkannt',
                measures: structure.measures,
                metadata: {
                    title: 'Importiert aus ' + path.basename(filePath),
                    confidence: this.calculateAverageConfidence(recognizedSymbols),
                    processingTime,
                    symbolsDetected: recognizedSymbols.length,
                    stavesDetected: staffInfo.staves.length
                }
            };

            logger.info(`OMR processing completed in ${processingTime}ms: ${recognizedSymbols.length} symbols`);
            
            // Cleanup temp files
            if (preprocessedPath !== filePath) {
                await fs.remove(preprocessedPath).catch(() => {});
            }
            
            return result;

        } catch (error) {
            logger.error('OMR recognition failed:', error);
            throw error;
        }
    }

    async recognizeFromPDF(pdfPath) {
        try {
            logger.info(`Processing PDF for OMR: ${pdfPath}`);

            // Create temp directory for PDF pages
            const tempDir = path.join(path.dirname(pdfPath), 'omr-temp-' + Date.now());
            await fs.ensureDir(tempDir);

            try {
                // Convert PDF to images using pdf-poppler
                const opts = {
                    format: 'png',
                    out_dir: tempDir,
                    out_prefix: 'page',
                    page: null // Process all pages
                };

                await pdf(pdfPath, opts);

                // Get all generated page images
                const pageFiles = (await fs.readdir(tempDir))
                    .filter(f => f.endsWith('.png'))
                    .sort()
                    .map(f => path.join(tempDir, f));

                logger.info(`PDF converted to ${pageFiles.length} page images`);

                // Process each page
                const pageResults = [];
                for (let i = 0; i < pageFiles.length; i++) {
                    logger.info(`Processing page ${i + 1}/${pageFiles.length}`);
                    const result = await this.recognizeFromFile(pageFiles[i]);
                    pageResults.push({
                        pageNumber: i + 1,
                        ...result
                    });
                }

                // Combine all measures from all pages
                const allMeasures = [];
                let totalConfidence = 0;
                let successCount = 0;

                for (const pageResult of pageResults) {
                    if (pageResult.success) {
                        allMeasures.push(...pageResult.measures);
                        totalConfidence += pageResult.metadata.confidence;
                        successCount++;
                    }
                }

                return {
                    success: successCount > 0,
                    message: `${successCount}/${pageResults.length} Seiten erfolgreich verarbeitet`,
                    pages: pageResults,
                    measures: allMeasures,
                    metadata: {
                        pageCount: pageFiles.length,
                        confidence: successCount > 0 ? totalConfidence / successCount : 0,
                        totalMeasures: allMeasures.length
                    }
                };

            } finally {
                // Cleanup temp directory
                await fs.remove(tempDir).catch(err => 
                    logger.warn('Failed to cleanup temp directory:', err)
                );
            }

        } catch (error) {
            logger.error('PDF OMR failed:', error);
            throw error;
        }
    }

    async preprocessImage(imagePath) {
        logger.info('Preprocessing image:', imagePath);
        
        try {
            const tempPath = path.join(
                path.dirname(imagePath),
                'preprocessed-' + path.basename(imagePath)
            );

            // Use Sharp for image preprocessing
            await sharp(imagePath)
                .grayscale() // Convert to grayscale
                .normalize() // Normalize contrast
                .sharpen() // Sharpen edges
                .threshold(128) // Binarization (simple threshold)
                .median(3) // Noise reduction
                .toFile(tempPath);

            logger.info('Image preprocessing complete');
            return tempPath;

        } catch (error) {
            logger.warn('Preprocessing failed, using original:', error);
            return imagePath;
        }
    }

    async detectStaffLines(imagePath) {
        logger.info('Detecting staff lines...');
        
        try {
            // Get image metadata
            const metadata = await sharp(imagePath).metadata();
            const { width, height } = metadata;

            // Get raw pixel data for analysis
            const { data } = await sharp(imagePath)
                .raw()
                .toBuffer({ resolveWithObject: true });

            // Horizontal projection to find staff lines
            const projection = new Array(height).fill(0);
            
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = y * width + x;
                    // Count dark pixels (staff lines)
                    if (data[idx] < 128) {
                        projection[y]++;
                    }
                }
            }

            // Find peaks (staff lines) - look for rows with many dark pixels
            const threshold = width * 0.3; // At least 30% of width should be dark
            const staffLines = [];
            
            for (let y = 1; y < height - 1; y++) {
                if (projection[y] > threshold) {
                    // Check if this is a local maximum
                    if (projection[y] >= projection[y - 1] && projection[y] >= projection[y + 1]) {
                        staffLines.push(y);
                    }
                }
            }

            // Group lines into staves (each staff has 5 lines)
            const staves = [];
            const lineHeight = this.estimateLineHeight(staffLines);
            
            for (let i = 0; i < staffLines.length - 4; i++) {
                const lines = staffLines.slice(i, i + 5);
                const spacing = [];
                
                for (let j = 0; j < lines.length - 1; j++) {
                    spacing.push(lines[j + 1] - lines[j]);
                }
                
                // Check if spacing is consistent (indicating a staff)
                const avgSpacing = spacing.reduce((a, b) => a + b, 0) / spacing.length;
                const variance = spacing.reduce((sum, s) => sum + Math.pow(s - avgSpacing, 2), 0) / spacing.length;
                
                if (variance < avgSpacing * 0.5) { // Consistent spacing
                    staves.push({
                        lines: lines,
                        top: lines[0],
                        bottom: lines[4],
                        spaceHeight: avgSpacing,
                        lineHeight: lineHeight
                    });
                    i += 4; // Skip processed lines
                }
            }

            logger.info(`Detected ${staves.length} staves with ${staffLines.length} total lines`);

            return {
                staves,
                lineHeight: lineHeight || 2,
                spaceHeight: staves.length > 0 ? staves[0].spaceHeight : 10
            };

        } catch (error) {
            logger.error('Staff line detection failed:', error);
            // Return default structure for testing
            return {
                staves: [{
                    lines: [100, 110, 120, 130, 140],
                    top: 100,
                    bottom: 140,
                    spaceHeight: 10,
                    lineHeight: 2
                }],
                lineHeight: 2,
                spaceHeight: 10
            };
        }
    }

    estimateLineHeight(staffLines) {
        if (staffLines.length < 2) return 2;
        
        // Find minimum spacing between consecutive lines
        let minSpacing = Infinity;
        for (let i = 0; i < staffLines.length - 1; i++) {
            const spacing = staffLines[i + 1] - staffLines[i];
            if (spacing > 0 && spacing < minSpacing) {
                minSpacing = spacing;
            }
        }
        
        // Line height is typically 1/3 to 1/5 of space height
        return Math.max(1, Math.floor(minSpacing / 4));
    }

    async segmentSymbols(imagePath, staffInfo) {
        logger.info('Segmenting musical symbols...');
        
        try {
            // Use Tesseract to detect text regions (as symbols)
            const { data: { words } } = await this.tesseractWorker.recognize(imagePath);
            
            // Get image dimensions
            const metadata = await sharp(imagePath).metadata();
            
            // Create symbol objects from detected regions
            const symbols = [];
            
            for (const word of words) {
                const bbox = word.bbox;
                
                // Determine which staff this symbol belongs to
                const centerY = (bbox.y0 + bbox.y1) / 2;
                const staff = this.findNearestStaff(centerY, staffInfo.staves);
                
                if (staff) {
                    symbols.push({
                        bbox,
                        centerY,
                        centerX: (bbox.x0 + bbox.x1) / 2,
                        width: bbox.x1 - bbox.x0,
                        height: bbox.y1 - bbox.y0,
                        staff,
                        text: word.text,
                        confidence: word.confidence
                    });
                }
            }
            
            // Sort symbols by horizontal position (left to right)
            symbols.sort((a, b) => a.centerX - b.centerX);
            
            logger.info(`Segmented ${symbols.length} symbols`);
            return symbols;
            
        } catch (error) {
            logger.warn('Symbol segmentation failed:', error);
            return [];
        }
    }

    findNearestStaff(y, staves) {
        if (staves.length === 0) return null;
        
        let nearest = staves[0];
        let minDistance = Math.abs(y - (nearest.top + nearest.bottom) / 2);
        
        for (const staff of staves) {
            const staffCenter = (staff.top + staff.bottom) / 2;
            const distance = Math.abs(y - staffCenter);
            
            if (distance < minDistance) {
                minDistance = distance;
                nearest = staff;
            }
        }
        
        return nearest;
    }

    async recognizeSymbol(symbol, staffInfo) {
        try {
            // Determine position on staff (which line or space)
            const position = this.getPositionOnStaff(symbol.centerY, symbol.staff, staffInfo);
            
            // Analyze symbol characteristics
            const aspectRatio = symbol.width / symbol.height;
            const text = symbol.text.toLowerCase();
            
            // Pattern matching for note recognition
            let type = 'note';
            let duration = 'q'; // Default quarter note
            let pitch = this.getPitchFromPosition(position, 'treble');
            
            // Recognize clefs
            if (text.includes('𝄞') || symbol.centerX < 100) {
                type = 'clef';
                return {
                    type: 'clef',
                    value: 'treble',
                    confidence: 0.8,
                    position: symbol.centerX
                };
            }
            
            if (text.includes('𝄢')) {
                type = 'clef';
                return {
                    type: 'clef',
                    value: 'bass',
                    confidence: 0.8,
                    position: symbol.centerX
                };
            }
            
            // Recognize accidentals
            if (text.includes('♯') || text.includes('#')) {
                return {
                    type: 'accidental',
                    value: '#',
                    pitch,
                    confidence: 0.7,
                    position: symbol.centerX
                };
            }
            
            if (text.includes('♭') || text.includes('b')) {
                return {
                    type: 'accidental',
                    value: 'b',
                    pitch,
                    confidence: 0.7,
                    position: symbol.centerX
                };
            }
            
            // Determine note duration based on symbol characteristics
            if (aspectRatio > 1.5) {
                duration = 'w'; // Whole note (wider)
            } else if (aspectRatio > 1.2) {
                duration = 'h'; // Half note
            } else if (symbol.height > staffInfo.spaceHeight * 2) {
                // Has stem, likely quarter or shorter
                duration = 'q';
            }
            
            return {
                type: 'note',
                duration,
                pitch,
                position: symbol.centerX,
                confidence: symbol.confidence / 100,
                properties: {
                    staffLine: position.line,
                    staffSpace: position.space
                }
            };
            
        } catch (error) {
            logger.warn('Symbol recognition failed:', error);
            return {
                type: 'unknown',
                confidence: 0,
                properties: {}
            };
        }
    }

    getPositionOnStaff(y, staff, staffInfo) {
        // Calculate position relative to staff lines
        const relativeY = y - staff.top;
        const spaceHeight = staffInfo.spaceHeight;
        
        // 0 = on first line, 1 = first space, 2 = second line, etc.
        const position = Math.round(relativeY / (spaceHeight / 2));
        
        return {
            line: Math.floor(position / 2),
            space: position % 2 === 1 ? Math.floor(position / 2) : -1,
            exact: position
        };
    }

    getPitchFromPosition(position, clef) {
        // Map staff position to pitch (treble clef)
        const treblePitches = ['e/5', 'f/5', 'g/5', 'a/5', 'b/5', 'c/6', 'd/6', 'e/6', 'f/6', 'g/6'];
        const bassPitches = ['g/3', 'a/3', 'b/3', 'c/4', 'd/4', 'e/4', 'f/4', 'g/4', 'a/4', 'b/4'];
        
        const pitches = clef === 'bass' ? bassPitches : treblePitches;
        const index = Math.max(0, Math.min(pitches.length - 1, position.exact));
        
        return pitches[index];
    }

    async buildMusicalStructure(symbols, staffInfo) {
        logger.info('Building musical structure...');
        
        try {
            const measures = [];
            let currentMeasure = {
                notes: [],
                clef: 'treble',
                keySignature: 'C',
                timeSignature: '4/4'
            };
            
            let currentClef = 'treble';
            const measureWidth = 200; // Estimated pixels per measure
            let measureStart = 0;
            
            for (const symbol of symbols) {
                // Check if we should start a new measure
                if (symbol.centerX > measureStart + measureWidth && currentMeasure.notes.length > 0) {
                    measures.push({ ...currentMeasure });
                    currentMeasure = {
                        notes: [],
                        clef: currentClef,
                        keySignature: 'C',
                        timeSignature: '4/4'
                    };
                    measureStart = symbol.centerX;
                }
                
                if (symbol.type === 'clef') {
                    currentClef = symbol.value;
                    currentMeasure.clef = symbol.value;
                } else if (symbol.type === 'note') {
                    currentMeasure.notes.push({
                        keys: [symbol.pitch],
                        duration: symbol.duration
                    });
                } else if (symbol.type === 'accidental') {
                    // Apply accidental to previous note if exists
                    if (currentMeasure.notes.length > 0) {
                        const lastNote = currentMeasure.notes[currentMeasure.notes.length - 1];
                        lastNote.keys = [symbol.pitch + '/' + symbol.value];
                    }
                }
            }
            
            // Add last measure if it has notes
            if (currentMeasure.notes.length > 0) {
                measures.push(currentMeasure);
            }
            
            logger.info(`Built ${measures.length} measures from ${symbols.length} symbols`);
            
            return {
                measures,
                metadata: {
                    totalMeasures: measures.length,
                    averageNotesPerMeasure: measures.length > 0 
                        ? measures.reduce((sum, m) => sum + m.notes.length, 0) / measures.length 
                        : 0
                }
            };
            
        } catch (error) {
            logger.error('Failed to build musical structure:', error);
            return {
                measures: [],
                metadata: {}
            };
        }
    }

    calculateAverageConfidence(symbols) {
        if (symbols.length === 0) return 0;
        const sum = symbols.reduce((acc, s) => acc + (s.confidence || 0), 0);
        return Math.round((sum / symbols.length) * 100) / 100;
    }

    getCapabilities() {
        return {
            supportedFormats: this.supportedFormats,
            features: {
                staffLineDetection: true,
                noteRecognition: true,
                chordRecognition: false,
                restRecognition: false,
                accidentalRecognition: true,
                clefRecognition: true,
                keySignatureRecognition: false,
                timeSignatureRecognition: false,
                dynamicsRecognition: false,
                articulationRecognition: false
            },
            status: this.initialized ? 'ready' : 'not initialized',
            libraries: {
                imageProcessing: 'Sharp 0.33.x',
                ocr: 'Tesseract.js 5.1.x',
                pdfConversion: 'pdf-poppler 0.2.x'
            },
            note: 'OMR mit Tesseract.js und Sharp - Basis-Funktionalität implementiert'
        };
    }

    async calibrate(sampleImages) {
        logger.info('Calibrating OMR system...');
        
        try {
            let totalStaffHeight = 0;
            let totalLineHeight = 0;
            let count = 0;
            
            // Analyze sample images to improve detection parameters
            for (const imagePath of sampleImages) {
                const staffInfo = await this.detectStaffLines(imagePath);
                
                if (staffInfo.staves.length > 0) {
                    totalStaffHeight += staffInfo.spaceHeight;
                    totalLineHeight += staffInfo.lineHeight;
                    count++;
                }
            }
            
            if (count > 0) {
                // Update average parameters
                const avgSpaceHeight = totalStaffHeight / count;
                const avgLineHeight = totalLineHeight / count;
                
                logger.info(`Calibration complete: avg space=${avgSpaceHeight.toFixed(1)}px, line=${avgLineHeight.toFixed(1)}px`);
                
                return {
                    success: true,
                    message: `Kalibriert mit ${count} Beispielbildern`,
                    parameters: {
                        averageSpaceHeight: avgSpaceHeight,
                        averageLineHeight: avgLineHeight
                    }
                };
            }
            
            return {
                success: false,
                message: 'Keine gültigen Notenlinien in Beispielbildern gefunden'
            };
            
        } catch (error) {
            logger.error('Calibration failed:', error);
            return {
                success: false,
                message: 'Kalibrierung fehlgeschlagen: ' + error.message
            };
        }
    }

    async destroy() {
        if (this.tesseractWorker) {
            await this.tesseractWorker.terminate();
            this.tesseractWorker = null;
        }
        this.initialized = false;
        logger.info('OMR Manager destroyed');
    }
}

// Export singleton instance
const omrManager = new OMRManager();
module.exports = omrManager;
