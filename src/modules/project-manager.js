// PATH: src/modules/project-manager.js
// DScribe - Project Manager

const fs = require('fs-extra');
const path = require('path');
const logger = require('./logger');

class ProjectManager {
    constructor() {
        this.projectsDir = null;
        this.autosaveDir = null;
    }

    initialize(projectsPath) {
        this.projectsDir = projectsPath;
        this.autosaveDir = path.join(projectsPath, 'autosave');
        fs.ensureDirSync(this.projectsDir);
        fs.ensureDirSync(this.autosaveDir);
        logger.info('Project manager initialized');
    }

    createNewProject() {
        return {
            title: 'Unbenannt',
            composer: '',
            copyright: '',
            keySignature: 'C',
            timeSignature: '4/4',
            tempo: 120,
            staves: [],
            measures: [],
            notes: [],
            lyrics: [],
            chords: [],
            metadata: {
                created: new Date().toISOString(),
                modified: new Date().toISOString(),
                version: '12.0.0'
            },
            isDirty: false,
            filePath: null
        };
    }

    async saveProject(projectData) {
        try {
            const filePath = projectData.filePath;
            
            if (!filePath) {
                throw new Error('No file path specified');
            }

            // Update metadata
            projectData.metadata = projectData.metadata || {};
            projectData.metadata.modified = new Date().toISOString();
            projectData.metadata.version = '12.0.0';

            // Ensure directory exists
            await fs.ensureDir(path.dirname(filePath));

            // Write project file
            await fs.writeFile(
                filePath,
                JSON.stringify(projectData, null, 2),
                'utf8'
            );

            logger.info(`Project saved: ${filePath}`);
            return { success: true, filePath };
        } catch (error) {
            logger.error('Failed to save project:', error);
            throw error;
        }
    }

    async loadProject(filePath) {
        try {
            if (!await fs.pathExists(filePath)) {
                throw new Error('Project file not found');
            }

            const data = await fs.readFile(filePath, 'utf8');
            const projectData = JSON.parse(data);
            
            // Set file path
            projectData.filePath = filePath;
            projectData.isDirty = false;

            logger.info(`Project loaded: ${filePath}`);
            return projectData;
        } catch (error) {
            logger.error('Failed to load project:', error);
            throw error;
        }
    }

    async autosaveProject(projectData) {
        try {
            if (!projectData.title) {
                return;
            }

            const filename = `autosave_${this.sanitizeFilename(projectData.title)}_${Date.now()}.dscribe`;
            const autosavePath = path.join(this.autosaveDir, filename);

            // Keep only last 5 autosaves for this project
            await this.cleanupAutosaves(projectData.title, 5);

            // Save autosave
            projectData.metadata = projectData.metadata || {};
            projectData.metadata.autosave = true;
            projectData.metadata.autosaveTime = new Date().toISOString();

            await fs.writeFile(
                autosavePath,
                JSON.stringify(projectData, null, 2),
                'utf8'
            );

            logger.info(`Autosave created: ${autosavePath}`);
            return autosavePath;
        } catch (error) {
            logger.error('Autosave failed:', error);
            throw error;
        }
    }

    async cleanupAutosaves(projectTitle, keepCount = 5) {
        try {
            const files = await fs.readdir(this.autosaveDir);
            const prefix = `autosave_${this.sanitizeFilename(projectTitle)}_`;
            
            const autosaves = files
                .filter(f => f.startsWith(prefix))
                .map(f => ({
                    name: f,
                    path: path.join(this.autosaveDir, f),
                    time: parseInt(f.split('_').pop().replace('.dscribe', ''))
                }))
                .sort((a, b) => b.time - a.time);

            // Remove old autosaves
            for (let i = keepCount; i < autosaves.length; i++) {
                await fs.remove(autosaves[i].path);
                logger.info(`Removed old autosave: ${autosaves[i].name}`);
            }
        } catch (error) {
            logger.error('Failed to cleanup autosaves:', error);
        }
    }

    async listAutosaves(projectTitle = null) {
        try {
            const files = await fs.readdir(this.autosaveDir);
            let autosaves = files.filter(f => f.startsWith('autosave_') && f.endsWith('.dscribe'));

            if (projectTitle) {
                const prefix = `autosave_${this.sanitizeFilename(projectTitle)}_`;
                autosaves = autosaves.filter(f => f.startsWith(prefix));
            }

            return autosaves.map(f => ({
                name: f,
                path: path.join(this.autosaveDir, f)
            }));
        } catch (error) {
            logger.error('Failed to list autosaves:', error);
            return [];
        }
    }

    sanitizeFilename(filename) {
        return filename.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    }

    async exportProject(projectData, format, outputPath) {
        // TODO: Implement export for different formats
        logger.info(`TODO: Export to ${format} at ${outputPath}`);
        throw new Error(`Export format ${format} not yet implemented`);
    }

    async importProject(filePath, format) {
        // TODO: Implement import from different formats
        logger.info(`TODO: Import from ${format} at ${filePath}`);
        throw new Error(`Import format ${format} not yet implemented`);
    }
}

// Export singleton instance
const projectManager = new ProjectManager();
module.exports = projectManager;
