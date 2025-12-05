// PATH: src/modules/plugin-manager.js
// DScribe - Plugin Manager (Phase 8)

const fs = require('fs-extra');
const path = require('path');
const logger = require('./logger');

class PluginManager {
    constructor() {
        this.plugins = new Map();
        this.pluginDir = null;
        this.hooks = new Map();
    }

    initialize(pluginPath) {
        this.pluginDir = pluginPath;
        fs.ensureDirSync(this.pluginDir);
        logger.info('Plugin manager initialized at:', pluginPath);
        
        // Initialize hook categories
        this.hooks.set('score.beforeRender', []);
        this.hooks.set('score.afterRender', []);
        this.hooks.set('note.beforeAdd', []);
        this.hooks.set('note.afterAdd', []);
        this.hooks.set('export.beforeExport', []);
        this.hooks.set('export.afterExport', []);
        this.hooks.set('import.beforeImport', []);
        this.hooks.set('import.afterImport', []);
        this.hooks.set('playback.beforePlay', []);
        this.hooks.set('playback.afterPlay', []);
    }

    async loadPlugins() {
        try {
            const pluginDirs = await fs.readdir(this.pluginDir);
            
            for (const dir of pluginDirs) {
                const pluginPath = path.join(this.pluginDir, dir);
                const stat = await fs.stat(pluginPath);
                
                if (stat.isDirectory()) {
                    await this.loadPlugin(pluginPath);
                }
            }
            
            logger.info(`Loaded ${this.plugins.size} plugins`);
            return Array.from(this.plugins.values());
        } catch (error) {
            logger.error('Failed to load plugins:', error);
            return [];
        }
    }

    async loadPlugin(pluginPath) {
        try {
            const manifestPath = path.join(pluginPath, 'plugin.json');
            
            if (!await fs.pathExists(manifestPath)) {
                logger.warn(`No manifest found in ${pluginPath}`);
                return null;
            }
            
            const manifest = await fs.readJson(manifestPath);
            
            // Validate manifest
            if (!manifest.id || !manifest.name || !manifest.version) {
                logger.error('Invalid plugin manifest:', pluginPath);
                return null;
            }
            
            // Load plugin code
            const mainFile = path.join(pluginPath, manifest.main || 'index.js');
            
            if (!await fs.pathExists(mainFile)) {
                logger.error(`Plugin main file not found: ${mainFile}`);
                return null;
            }
            
            // Load and initialize plugin
            const PluginClass = require(mainFile);
            const pluginInstance = new PluginClass();
            
            const plugin = {
                id: manifest.id,
                name: manifest.name,
                version: manifest.version,
                description: manifest.description || '',
                author: manifest.author || 'Unknown',
                enabled: true,
                instance: pluginInstance,
                manifest: manifest,
                path: pluginPath
            };
            
            // Initialize plugin
            if (typeof pluginInstance.initialize === 'function') {
                await pluginInstance.initialize(this);
            }
            
            this.plugins.set(manifest.id, plugin);
            logger.info(`Loaded plugin: ${manifest.name} v${manifest.version}`);
            
            return plugin;
        } catch (error) {
            logger.error(`Failed to load plugin from ${pluginPath}:`, error);
            return null;
        }
    }

    async unloadPlugin(pluginId) {
        const plugin = this.plugins.get(pluginId);
        
        if (!plugin) {
            logger.warn(`Plugin not found: ${pluginId}`);
            return false;
        }
        
        try {
            // Call cleanup if available
            if (typeof plugin.instance.cleanup === 'function') {
                await plugin.instance.cleanup();
            }
            
            // Remove from hooks
            for (const [hookName, callbacks] of this.hooks.entries()) {
                const filtered = callbacks.filter(cb => cb.pluginId !== pluginId);
                this.hooks.set(hookName, filtered);
            }
            
            // Remove from plugins map
            this.plugins.delete(pluginId);
            
            logger.info(`Unloaded plugin: ${plugin.name}`);
            return true;
        } catch (error) {
            logger.error(`Failed to unload plugin ${pluginId}:`, error);
            return false;
        }
    }

    registerHook(pluginId, hookName, callback) {
        if (!this.hooks.has(hookName)) {
            logger.warn(`Unknown hook: ${hookName}`);
            return false;
        }
        
        const plugin = this.plugins.get(pluginId);
        if (!plugin) {
            logger.warn(`Plugin not found: ${pluginId}`);
            return false;
        }
        
        this.hooks.get(hookName).push({
            pluginId,
            callback
        });
        
        logger.info(`Plugin ${plugin.name} registered hook: ${hookName}`);
        return true;
    }

    async executeHook(hookName, data) {
        if (!this.hooks.has(hookName)) {
            return data;
        }
        
        const callbacks = this.hooks.get(hookName);
        let result = data;
        
        for (const { pluginId, callback } of callbacks) {
            const plugin = this.plugins.get(pluginId);
            
            if (!plugin || !plugin.enabled) {
                continue;
            }
            
            try {
                result = await callback(result);
            } catch (error) {
                logger.error(`Hook execution failed for ${plugin.name} on ${hookName}:`, error);
            }
        }
        
        return result;
    }

    getPlugin(pluginId) {
        return this.plugins.get(pluginId);
    }

    getAllPlugins() {
        return Array.from(this.plugins.values());
    }

    async enablePlugin(pluginId) {
        const plugin = this.plugins.get(pluginId);
        
        if (!plugin) {
            return false;
        }
        
        plugin.enabled = true;
        
        if (typeof plugin.instance.onEnable === 'function') {
            await plugin.instance.onEnable();
        }
        
        logger.info(`Enabled plugin: ${plugin.name}`);
        return true;
    }

    async disablePlugin(pluginId) {
        const plugin = this.plugins.get(pluginId);
        
        if (!plugin) {
            return false;
        }
        
        plugin.enabled = false;
        
        if (typeof plugin.instance.onDisable === 'function') {
            await plugin.instance.onDisable();
        }
        
        logger.info(`Disabled plugin: ${plugin.name}`);
        return true;
    }

    async installPlugin(pluginPackagePath) {
        try {
            // Extract plugin package
            const pluginName = path.basename(pluginPackagePath, '.zip');
            const destPath = path.join(this.pluginDir, pluginName);
            
            // TODO: Implement ZIP extraction
            logger.info(`TODO: Extract plugin from ${pluginPackagePath} to ${destPath}`);
            
            // Load the newly installed plugin
            // await this.loadPlugin(destPath);
            
            return true;
        } catch (error) {
            logger.error('Failed to install plugin:', error);
            return false;
        }
    }

    async createPluginTemplate(pluginName, pluginId) {
        try {
            const pluginPath = path.join(this.pluginDir, pluginId);
            await fs.ensureDir(pluginPath);
            
            // Create manifest
            const manifest = {
                id: pluginId,
                name: pluginName,
                version: '1.0.0',
                description: 'A DScribe plugin',
                author: 'Your Name',
                main: 'index.js',
                hooks: []
            };
            
            await fs.writeJson(path.join(pluginPath, 'plugin.json'), manifest, { spaces: 2 });
            
            // Create main file template
            const template = `// ${pluginName} Plugin for DScribe

class ${pluginName.replace(/[^a-zA-Z0-9]/g, '')}Plugin {
    constructor() {
        this.name = '${pluginName}';
    }

    async initialize(pluginManager) {
        console.log('${pluginName} plugin initialized');
        
        // Register hooks
        // pluginManager.registerHook('${pluginId}', 'score.beforeRender', async (data) => {
        //     console.log('Before render hook called');
        //     return data;
        // });
    }

    async cleanup() {
        console.log('${pluginName} plugin cleanup');
    }

    async onEnable() {
        console.log('${pluginName} plugin enabled');
    }

    async onDisable() {
        console.log('${pluginName} plugin disabled');
    }
}

module.exports = ${pluginName.replace(/[^a-zA-Z0-9]/g, '')}Plugin;
`;
            
            await fs.writeFile(path.join(pluginPath, 'index.js'), template);
            
            logger.info(`Plugin template created at: ${pluginPath}`);
            return pluginPath;
        } catch (error) {
            logger.error('Failed to create plugin template:', error);
            throw error;
        }
    }
}

// Export singleton instance
const pluginManager = new PluginManager();
module.exports = pluginManager;
