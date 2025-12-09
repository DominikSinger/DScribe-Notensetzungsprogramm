// PATH: src/modules/repetition-engine.js
// DScribe - Repetition Engine for Professional Repeat Handling
// Handles D.S., D.C., Coda, Fine, and other repetition marks

const logger = require('./logger');

class RepetitionEngine {
    constructor(loggerInstance = null) {
        this.logger = loggerInstance || logger;
        this.repetitionMarks = [];
        this.measureMap = {}; // Map measure names to indices
        this.playbackSequence = [];
    }

    /**
     * Repetition mark types
     */
    static MARK_TYPES = {
        REPEAT_START: 'repeat_start',      // |:
        REPEAT_END: 'repeat_end',          // :|
        REPEAT_END_2X: 'repeat_end_2x',    // :||:
        FINE: 'fine',                      // Fine
        CODA: 'coda',                      // ⊕ Coda
        D_C: 'd.c.',                       // D.C. (Da Capo)
        D_S: 'd.s.',                       // D.S. (Dal Segno)
        SEGNO: 'segno',                    // § Segno
        TO_CODA: 'to_coda',                // To Coda
        D_C_AL_FINE: 'd.c.al.fine',        // D.C. al Fine
        D_S_AL_FINE: 'd.s.al.fine',        // D.S. al Fine
        D_C_AL_CODA: 'd.c.al.coda',        // D.C. al Coda
        D_S_AL_CODA: 'd.s.al.coda'         // D.S. al Coda
    };

    /**
     * Adds a repeat mark at a specific measure
     * @param {number} measureIndex - Measure index
     * @param {string} markType - Type of mark (from MARK_TYPES)
     * @param {string} markLabel - Optional label (e.g., "A", "B", "Coda")
     */
    addRepetitionMark(measureIndex, markType, markLabel = null) {
        const mark = {
            measureIndex: measureIndex,
            type: markType,
            label: markLabel,
            timestamp: Date.now()
        };

        this.repetitionMarks.push(mark);
        this.logger.info(`Added ${markType} at measure ${measureIndex}`);

        // Add to measure map if labeled
        if (markLabel) {
            this.measureMap[markLabel] = measureIndex;
        }

        return mark;
    }

    /**
     * Removes a repetition mark
     */
    removeRepetitionMark(measureIndex, markType) {
        this.repetitionMarks = this.repetitionMarks.filter(m => 
            !(m.measureIndex === measureIndex && m.type === markType)
        );
        this.logger.info(`Removed ${markType} from measure ${measureIndex}`);
    }

    /**
     * Gets all repetition marks
     */
    getAllRepetitionMarks() {
        return this.repetitionMarks.sort((a, b) => a.measureIndex - b.measureIndex);
    }

    /**
     * Gets marks at specific measure
     */
    getMarksAtMeasure(measureIndex) {
        return this.repetitionMarks.filter(m => m.measureIndex === measureIndex);
    }

    /**
     * Generates playback sequence based on repetition marks
     * @param {number} totalMeasures - Total number of measures
     */
    generatePlaybackSequence(totalMeasures) {
        if (this.repetitionMarks.length === 0) {
            // No repeats, just play all measures
            this.playbackSequence = Array.from({ length: totalMeasures }, (_, i) => i);
            return this.playbackSequence;
        }

        const sequence = [];
        const marks = this.getAllRepetitionMarks();
        let currentMeasure = 0;

        // Find first repeat start
        let repeatStart = 0;
        let repeatEnd = totalMeasures;
        let codaStart = null;
        let fineAtMeasure = null;
        let segnoAtMeasure = null;

        // Parse marks
        for (const mark of marks) {
            switch (mark.type) {
                case RepetitionEngine.MARK_TYPES.REPEAT_START:
                    repeatStart = mark.measureIndex;
                    break;
                case RepetitionEngine.MARK_TYPES.REPEAT_END:
                case RepetitionEngine.MARK_TYPES.REPEAT_END_2X:
                    repeatEnd = mark.measureIndex;
                    break;
                case RepetitionEngine.MARK_TYPES.CODA:
                    codaStart = mark.measureIndex;
                    break;
                case RepetitionEngine.MARK_TYPES.FINE:
                    fineAtMeasure = mark.measureIndex;
                    break;
                case RepetitionEngine.MARK_TYPES.SEGNO:
                    segnoAtMeasure = mark.measureIndex;
                    break;
            }
        }

        // Build sequence
        for (let i = 0; i < totalMeasures; i++) {
            const marksHere = this.getMarksAtMeasure(i);

            for (const mark of marksHere) {
                if (mark.type === RepetitionEngine.MARK_TYPES.D_C ||
                    mark.type === RepetitionEngine.MARK_TYPES.D_C_AL_FINE) {
                    // Da Capo - repeat from beginning
                    for (let j = 0; j < (i + 1); j++) {
                        if (fineAtMeasure === null || j <= fineAtMeasure) {
                            if (!sequence.includes(j)) sequence.push(j);
                        }
                    }
                } else if (mark.type === RepetitionEngine.MARK_TYPES.D_S ||
                           mark.type === RepetitionEngine.MARK_TYPES.D_S_AL_FINE) {
                    // Dal Segno - repeat from segno mark
                    if (segnoAtMeasure !== null) {
                        for (let j = segnoAtMeasure; j <= (i + 1); j++) {
                            if (fineAtMeasure === null || j <= fineAtMeasure) {
                                if (!sequence.includes(j)) sequence.push(j);
                            }
                        }
                    }
                }
            }

            sequence.push(i);

            // Stop at Fine
            if (fineAtMeasure !== null && i === fineAtMeasure) {
                break;
            }
        }

        // Add Coda if present
        if (codaStart !== null) {
            for (let i = codaStart; i < totalMeasures; i++) {
                if (!sequence.includes(i)) sequence.push(i);
            }
        }

        this.playbackSequence = sequence;
        this.logger.info(`Generated playback sequence: ${sequence.length} measures`);
        return sequence;
    }

    /**
     * Generates ASCII notation for repetition marks
     */
    generateRepetitionNotation() {
        let notation = '';
        notation += `╔════════════════════════════════════╗\n`;
        notation += `║      REPETITION MARKS             ║\n`;
        notation += `╚════════════════════════════════════╝\n\n`;

        const marks = this.getAllRepetitionMarks();
        
        if (marks.length === 0) {
            notation += `No repetition marks defined.\n`;
            return notation;
        }

        notation += `Mark Symbols:\n`;
        notation += `${'─'.repeat(40)}\n`;

        for (const mark of marks) {
            const symbol = this.getMarkSymbol(mark.type);
            const label = mark.label ? ` (${mark.label})` : '';
            notation += `Measure ${mark.measureIndex}: ${symbol}${label}\n`;
        }

        return notation;
    }

    /**
     * Gets the display symbol for a mark type
     * @private
     */
    getMarkSymbol(markType) {
        const symbols = {
            [RepetitionEngine.MARK_TYPES.REPEAT_START]: '|:',
            [RepetitionEngine.MARK_TYPES.REPEAT_END]: ':|',
            [RepetitionEngine.MARK_TYPES.REPEAT_END_2X]: ':||:',
            [RepetitionEngine.MARK_TYPES.FINE]: 'Fine',
            [RepetitionEngine.MARK_TYPES.CODA]: '⊕ (Coda)',
            [RepetitionEngine.MARK_TYPES.D_C]: 'D.C.',
            [RepetitionEngine.MARK_TYPES.D_S]: 'D.S.',
            [RepetitionEngine.MARK_TYPES.SEGNO]: '§',
            [RepetitionEngine.MARK_TYPES.TO_CODA]: 'To Coda',
            [RepetitionEngine.MARK_TYPES.D_C_AL_FINE]: 'D.C. al Fine',
            [RepetitionEngine.MARK_TYPES.D_S_AL_FINE]: 'D.S. al Fine',
            [RepetitionEngine.MARK_TYPES.D_C_AL_CODA]: 'D.C. al Coda',
            [RepetitionEngine.MARK_TYPES.D_S_AL_CODA]: 'D.S. al Coda'
        };
        return symbols[markType] || markType;
    }

    /**
     * Exports repetition map to text file
     */
    exportRepetitionMap(filePath, projectData) {
        try {
            const fs = require('fs-extra');
            let content = '';

            if (projectData.title) content += `Title: ${projectData.title}\n`;
            if (projectData.composer) content += `Composer: ${projectData.composer}\n`;
            content += '\n';

            content += this.generateRepetitionNotation();
            content += '\n';

            if (this.playbackSequence.length > 0) {
                content += `Playback Sequence:\n`;
                content += `${'─'.repeat(40)}\n`;
                content += `${this.playbackSequence.join(' → ')}\n`;
            }

            fs.writeFileSync(filePath, content, 'utf8');
            this.logger.info(`Repetition map exported to: ${filePath}`);
            return { success: true, file: filePath };
        } catch (error) {
            this.logger.error('Failed to export repetition map:', error);
            throw error;
        }
    }

    /**
     * Gets repeat count (how many times a section repeats)
     */
    getRepeatCount(fromMeasure, toMeasure) {
        let count = 1;
        const marks = this.repetitionMarks.filter(m => 
            m.measureIndex >= fromMeasure && m.measureIndex <= toMeasure
        );

        for (const mark of marks) {
            if (mark.type === RepetitionEngine.MARK_TYPES.REPEAT_END_2X) {
                count = 2;
            }
        }

        return count;
    }

    /**
     * Calculates total playback duration based on repetitions
     */
    calculateTotalDuration(measureDurations) {
        if (this.playbackSequence.length === 0) {
            return measureDurations.reduce((a, b) => a + b, 0);
        }

        let totalDuration = 0;
        for (const measureIndex of this.playbackSequence) {
            if (measureIndex < measureDurations.length) {
                totalDuration += measureDurations[measureIndex];
            }
        }

        return totalDuration;
    }

    /**
     * Validates repetition marks (checks for logical issues)
     */
    validateRepetitionMarks(totalMeasures) {
        const issues = [];

        // Check for orphaned marks
        for (const mark of this.repetitionMarks) {
            if (mark.measureIndex >= totalMeasures) {
                issues.push(`${mark.type} at measure ${mark.measureIndex} is beyond total measures (${totalMeasures})`);
            }

            if (mark.type === RepetitionEngine.MARK_TYPES.D_S) {
                const hasSegno = this.repetitionMarks.some(m => 
                    m.type === RepetitionEngine.MARK_TYPES.SEGNO
                );
                if (!hasSegno) {
                    issues.push('D.S. mark found but no Segno mark defined');
                }
            }

            if (mark.type === RepetitionEngine.MARK_TYPES.TO_CODA) {
                const hasCoda = this.repetitionMarks.some(m => 
                    m.type === RepetitionEngine.MARK_TYPES.CODA
                );
                if (!hasCoda) {
                    issues.push('To Coda mark found but no Coda mark defined');
                }
            }
        }

        if (issues.length > 0) {
            this.logger.warn(`Found ${issues.length} validation issues:`, issues);
        }

        return { valid: issues.length === 0, issues: issues };
    }

    /**
     * Clears all repetition marks
     */
    clear() {
        this.repetitionMarks = [];
        this.measureMap = {};
        this.playbackSequence = [];
        this.logger.info('Repetition marks cleared');
    }

    /**
     * Gets statistics about repetitions
     */
    getStatistics() {
        return {
            totalMarks: this.repetitionMarks.length,
            markTypes: this.getMarkTypeDistribution(),
            playbackSequenceLength: this.playbackSequence.length,
            hasRepetitions: this.repetitionMarks.some(m => 
                m.type === RepetitionEngine.MARK_TYPES.REPEAT_START
            )
        };
    }

    /**
     * Gets distribution of mark types
     * @private
     */
    getMarkTypeDistribution() {
        const distribution = {};
        for (const mark of this.repetitionMarks) {
            distribution[mark.type] = (distribution[mark.type] || 0) + 1;
        }
        return distribution;
    }
}

module.exports = RepetitionEngine;
