// PATH: src/modules/autosave.js
// DScribe - Autosave Module

const logger = require('./logger');
const projectManager = require('./project-manager');

class AutosaveManager {
    constructor() {
        this.intervalId = null;
        this.intervalMinutes = 4;
        this.enabled = true;
        this.lastAutosave = null;
    }

    start(getProjectCallback) {
        if (this.intervalId) {
            this.stop();
        }

        if (!this.enabled) {
            logger.info('Autosave is disabled');
            return;
        }

        const intervalMs = this.intervalMinutes * 60 * 1000;
        
        this.intervalId = setInterval(async () => {
            try {
                const project = getProjectCallback();
                
                if (project && project.isDirty) {
                    await projectManager.autosaveProject(project);
                    this.lastAutosave = new Date();
                    logger.info('Autosave completed');
                }
            } catch (error) {
                logger.error('Autosave error:', error);
            }
        }, intervalMs);

        logger.info(`Autosave started (every ${this.intervalMinutes} minutes)`);
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            logger.info('Autosave stopped');
        }
    }

    setInterval(minutes) {
        this.intervalMinutes = Math.max(1, Math.min(60, minutes));
        
        if (this.intervalId) {
            logger.info(`Autosave interval changed to ${this.intervalMinutes} minutes`);
        }
    }

    setEnabled(enabled) {
        this.enabled = enabled;
        
        if (!enabled && this.intervalId) {
            this.stop();
        }
    }

    getLastAutosaveTime() {
        return this.lastAutosave;
    }
}

// Export singleton instance
const autosaveManager = new AutosaveManager();
module.exports = autosaveManager;
