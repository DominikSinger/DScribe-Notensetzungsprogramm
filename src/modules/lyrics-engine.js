// PATH: src/modules/lyrics-engine.js
// DScribe - Lyrics Engine for Professional Lyric Notation
// Handles syllable alignment, verse management, and lyric rendering

const fs = require('fs-extra');

class LyricsEngine {
    constructor(logger = null) {
        this.logger = logger || console;
        this.lyrics = [];
        this.currentVerse = 0;
        this.verseLabels = ['1.', '2.', '3.', '4.'];
        this.syllableAlignment = {};
        this.lineBreaks = [];
    }

    /**
     * Adds lyrics to a measure
     * @param {number} measureIndex - Measure index
     * @param {Array<string>} syllables - Array of syllables
     * @param {string} verseNumber - Verse number (1, 2, etc.)
     */
    addLyricsToMeasure(measureIndex, syllables, verseNumber = 1) {
        if (!this.lyrics[verseNumber]) {
            this.lyrics[verseNumber] = [];
        }

        if (!this.lyrics[verseNumber][measureIndex]) {
            this.lyrics[verseNumber][measureIndex] = [];
        }

        this.lyrics[verseNumber][measureIndex] = syllables;
        this.logger.info(`Added lyrics to measure ${measureIndex}, verse ${verseNumber}`);
    }

    /**
     * Aligns syllables to notes within a measure
     * @param {number} measureIndex - Measure index
     * @param {Array} notes - Array of note objects
     * @param {Array<string>} syllables - Array of syllables
     * @param {number} verseNumber - Verse number
     */
    alignSyllablesToNotes(measureIndex, notes, syllables, verseNumber = 1) {
        if (!notes || notes.length === 0) {
            this.logger.warn('No notes provided for lyric alignment');
            return [];
        }

        const alignment = [];
        let syllableIndex = 0;

        // Distribute syllables across notes
        for (let i = 0; i < notes.length; i++) {
            if (syllableIndex < syllables.length) {
                const note = notes[i];
                const syllable = syllables[syllableIndex];
                
                alignment.push({
                    noteIndex: i,
                    syllable: syllable,
                    verseNumber: verseNumber,
                    measureIndex: measureIndex,
                    connector: this.shouldConnectToNextSyllable(syllables, syllableIndex) ? '-' : ' '
                });

                syllableIndex++;
            }
        }

        this.syllableAlignment[`${measureIndex}-${verseNumber}`] = alignment;
        this.logger.info(`Aligned ${alignment.length} syllables to notes`);
        return alignment;
    }

    /**
     * Determines if syllable should be connected to next with hyphen
     * @private
     */
    shouldConnectToNextSyllable(syllables, currentIndex) {
        if (currentIndex >= syllables.length - 1) return false;
        // Connect if next syllable exists and current one doesn't end with vowel sound
        return true; // Simplified logic
    }

    /**
     * Gets lyrics for a specific measure and verse
     */
    getLyricsForMeasure(measureIndex, verseNumber = 1) {
        if (!this.lyrics[verseNumber] || !this.lyrics[verseNumber][measureIndex]) {
            return [];
        }
        return this.lyrics[verseNumber][measureIndex];
    }

    /**
     * Gets all verses for a measure
     */
    getAllVersesForMeasure(measureIndex) {
        const allVerses = {};
        for (const verseNum in this.lyrics) {
            if (this.lyrics[verseNum][measureIndex]) {
                allVerses[verseNum] = this.lyrics[verseNum][measureIndex];
            }
        }
        return allVerses;
    }

    /**
     * Adds a verse separator (blank line between verses)
     */
    addVerseLineBreak(afterMeasureIndex) {
        this.lineBreaks.push(afterMeasureIndex);
        this.logger.info(`Added verse line break after measure ${afterMeasureIndex}`);
    }

    /**
     * Generates lyric sheet text format
     */
    generateLyricSheet(title = '', composer = '') {
        let sheet = '';
        sheet += `╔════════════════════════════════════╗\n`;
        sheet += `║          LYRICS SHEET             ║\n`;
        sheet += `╚════════════════════════════════════╝\n\n`;

        if (title) sheet += `Title: ${title}\n`;
        if (composer) sheet += `Composer: ${composer}\n`;
        sheet += `\n`;

        // Group lyrics by verse
        for (const verseNum in this.lyrics) {
            sheet += `Verse ${verseNum}:\n`;
            sheet += `${'─'.repeat(40)}\n`;

            const verseLyrics = this.lyrics[verseNum];
            let lyricLine = '';

            for (let measureIdx = 0; measureIdx < verseLyrics.length; measureIdx++) {
                if (this.lineBreaks.includes(measureIdx)) {
                    sheet += lyricLine + '\n\n';
                    lyricLine = '';
                } else {
                    const syllables = verseLyrics[measureIdx] || [];
                    lyricLine += syllables.join('-') + ' ';
                }
            }

            sheet += lyricLine + '\n\n';
        }

        return sheet;
    }

    /**
     * Generates VexFlow-compatible lyrics annotation
     */
    generateLyricsAnnotation(syllables, measureIndex, verseNumber = 1) {
        return {
            measureIndex: measureIndex,
            verseNumber: verseNumber,
            syllables: syllables,
            text: syllables.join('-'),
            position: 'bottom',
            offset: {
                x: 0,
                y: 20 + (verseNumber * 15) // Each verse positioned lower
            }
        };
    }

    /**
     * Exports lyrics to text file
     */
    async exportLyricsToFile(filePath, projectData) {
        try {
            let content = '';
            
            if (projectData.title) content += `Title: ${projectData.title}\n`;
            if (projectData.composer) content += `Composer: ${projectData.composer}\n`;
            content += '\n';

            content += this.generateLyricSheet(projectData.title, projectData.composer);

            await fs.writeFile(filePath, content, 'utf8');
            this.logger.info(`Lyrics exported to: ${filePath}`);
            return { success: true, file: filePath };
        } catch (error) {
            this.logger.error('Failed to export lyrics:', error);
            throw error;
        }
    }

    /**
     * Exports lyrics to PDF format (with jsPDF)
     */
    async exportLyricsToPDF(filePath, projectData) {
        try {
            const jsPDF = require('jspdf').jsPDF;
            const doc = new jsPDF();

            let yPos = 20;
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const margin = 15;

            // Add title
            if (projectData.title) {
                doc.setFontSize(16);
                doc.text(projectData.title, margin, yPos);
                yPos += 10;
            }

            // Add composer
            if (projectData.composer) {
                doc.setFontSize(10);
                doc.text(`Composer: ${projectData.composer}`, margin, yPos);
                yPos += 8;
            }

            yPos += 5;

            // Add lyrics
            doc.setFontSize(11);
            for (const verseNum in this.lyrics) {
                // Check if new page needed
                if (yPos > pageHeight - margin) {
                    doc.addPage();
                    yPos = margin;
                }

                doc.setFont(undefined, 'bold');
                doc.text(`Verse ${verseNum}:`, margin, yPos);
                yPos += 6;

                doc.setFont(undefined, 'normal');
                const verseLyrics = this.lyrics[verseNum];
                let lyricText = '';

                for (let measureIdx = 0; measureIdx < verseLyrics.length; measureIdx++) {
                    const syllables = verseLyrics[measureIdx] || [];
                    lyricText += syllables.join('-') + ' ';

                    if (this.lineBreaks.includes(measureIdx)) {
                        doc.text(lyricText, margin, yPos);
                        yPos += 6;
                        lyricText = '';
                    }
                }

                if (lyricText.trim()) {
                    doc.text(lyricText, margin, yPos);
                    yPos += 6;
                }

                yPos += 4;
            }

            doc.save(filePath || 'lyrics.pdf');
            this.logger.info(`Lyrics PDF exported to: ${filePath}`);
            return { success: true, file: filePath };
        } catch (error) {
            this.logger.error('Failed to export lyrics PDF:', error);
            throw error;
        }
    }

    /**
     * Parses lyrics from text format
     * Format:
     * Verse 1:
     * Syl-la-ble text
     */
    parseLyricsFromText(lyricsText) {
        const lines = lyricsText.split('\n');
        let currentVerse = 1;

        for (const line of lines) {
            if (line.startsWith('Verse')) {
                currentVerse = parseInt(line.match(/\d+/)[0]);
                continue;
            }

            if (line.trim()) {
                const syllables = line.split(/[\s-]+/).filter(s => s.length > 0);
                for (let i = 0; i < syllables.length; i++) {
                    this.addLyricsToMeasure(i, [syllables[i]], currentVerse);
                }
            }
        }

        this.logger.info(`Parsed lyrics for ${Object.keys(this.lyrics).length} verses`);
        return this.lyrics;
    }

    /**
     * Clears all lyrics
     */
    clear() {
        this.lyrics = [];
        this.syllableAlignment = {};
        this.lineBreaks = [];
        this.logger.info('Lyrics cleared');
    }

    /**
     * Gets statistics about lyrics
     */
    getStatistics() {
        let totalSyllables = 0;
        let verseCount = 0;

        for (const verseNum in this.lyrics) {
            verseCount++;
            for (const measure of this.lyrics[verseNum]) {
                if (measure && Array.isArray(measure)) {
                    totalSyllables += measure.length;
                }
            }
        }

        return {
            verseCount: verseCount,
            totalSyllables: totalSyllables,
            averageSyllablesPerVerse: verseCount > 0 ? totalSyllables / verseCount : 0
        };
    }
}

module.exports = LyricsEngine;
