// PATH: src/modules/settings-manager.js
// DScribe - Settings Manager

const fs = require('fs-extra');
const path = require('path');

class SettingsManager {
    constructor() {
        this.settings = {};
        this.settingsPath = null;
        this.defaults = {
            windowState: {
                width: 1400,
                height: 900,
                maximized: false
            },
            ui: {
                theme: 'light',
                showPalettes: true,
                showTransport: true,
                zoom: 100
            },
            playback: {
                tempo: 120,
                volume: 70,
                metronome: false,
                instrument: 'piano'
            },
            autosave: {
                enabled: true,
                intervalMinutes: 4
            },
            recent: {
                files: []
            }
        };
    }

    async initialize(settingsDir) {
        await fs.ensureDir(settingsDir);
        this.settingsPath = path.join(settingsDir, 'settings.json');
        await this.load();
    }

    async load() {
        try {
            if (await fs.pathExists(this.settingsPath)) {
                const data = await fs.readFile(this.settingsPath, 'utf8');
                this.settings = JSON.parse(data);
                console.log('Settings loaded');
            } else {
                this.settings = { ...this.defaults };
                await this.save();
                console.log('Default settings created');
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
            this.settings = { ...this.defaults };
        }
    }

    async save() {
        try {
            await fs.writeFile(
                this.settingsPath,
                JSON.stringify(this.settings, null, 2),
                'utf8'
            );
            console.log('Settings saved');
        } catch (error) {
            console.error('Failed to save settings:', error);
        }
    }

    get(key, defaultValue = null) {
        const keys = key.split('.');
        let value = this.settings;

        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                return defaultValue !== null ? defaultValue : this.getDefault(key);
            }
        }

        return value;
    }

    set(key, value) {
        const keys = key.split('.');
        let obj = this.settings;

        for (let i = 0; i < keys.length - 1; i++) {
            const k = keys[i];
            if (!(k in obj) || typeof obj[k] !== 'object') {
                obj[k] = {};
            }
            obj = obj[k];
        }

        obj[keys[keys.length - 1]] = value;
        this.save();
    }

    getDefault(key) {
        const keys = key.split('.');
        let value = this.defaults;

        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                return null;
            }
        }

        return value;
    }

    getAll() {
        return { ...this.settings };
    }

    reset(key = null) {
        if (key) {
            this.set(key, this.getDefault(key));
        } else {
            this.settings = { ...this.defaults };
            this.save();
        }
    }

    addRecentFile(filePath) {
        const recent = this.get('recent.files', []);
        
        // Remove if already exists
        const index = recent.indexOf(filePath);
        if (index > -1) {
            recent.splice(index, 1);
        }

        // Add to beginning
        recent.unshift(filePath);

        // Keep only last 10
        if (recent.length > 10) {
            recent.splice(10);
        }

        this.set('recent.files', recent);
    }

    getRecentFiles() {
        return this.get('recent.files', []);
    }
}

// Export singleton instance
const settingsManager = new SettingsManager();
module.exports = settingsManager;
