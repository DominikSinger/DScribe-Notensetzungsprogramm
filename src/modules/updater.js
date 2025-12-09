// PATH: src/modules/updater.js
// DScribe - Update Manager

const fs = require('fs-extra');
const path = require('path');
const { dialog } = require('electron');
const logger = require('./logger');

class UpdateManager {
    constructor() {
        this.updateUrl = 'https://api.github.com/repos/DominikSinger/DScribe-Notensetzungsprogramm/releases/latest';
        this.currentVersion = '12.0.0';
        this.updateDir = null;
    }

    initialize(updatePath) {
        this.updateDir = updatePath;
        fs.ensureDirSync(this.updateDir);
        logger.info('Update manager initialized');
    }

    async checkForUpdates(mainWindow) {
        try {
            logger.info('Checking for updates...');
            const fetch = require('node-fetch');
            const response = await fetch(this.updateUrl);
            if (!response.ok) {
                return { available: false, currentVersion: this.currentVersion, latestVersion: this.currentVersion };
            }
            const latestRelease = await response.json();
            const latestVersion = latestRelease.tag_name?.replace(/^v/, '') || this.currentVersion;
            const isAvailable = this.compareVersions(latestVersion, this.currentVersion) > 0;
            logger.info(`Update check: available=${isAvailable}, latest=${latestVersion}`);
            return { available: isAvailable, currentVersion: this.currentVersion, latestVersion };
        } catch (error) {
            logger.error('Update check failed:', error);
            return { available: false, currentVersion: this.currentVersion, latestVersion: this.currentVersion };
        }
    }
    
    compareVersions(v1, v2) {
        const p1 = v1.split('.').map(Number);
        const p2 = v2.split('.').map(Number);
        for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
            if ((p1[i]||0) > (p2[i]||0)) return 1;
            if ((p1[i]||0) < (p2[i]||0)) return -1;
        }
        return 0;
    }

    async downloadUpdate(version, downloadUrl) {
        try {
            if (!downloadUrl) throw new Error('No download URL');
            logger.info(`Downloading update ${version}...`);
            const fetch = require('node-fetch');
            const response = await fetch(downloadUrl);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const updateFile = path.join(this.updateDir, `DScribe-${version}.exe`);
            const fileStream = require('fs').createWriteStream(updateFile);
            return new Promise((resolve, reject) => {
                response.body.pipe(fileStream);
                fileStream.on('finish', () => { logger.info(`Downloaded: ${updateFile}`); resolve(updateFile); });
                fileStream.on('error', reject);
            });
        } catch (error) {
            logger.error('Download failed:', error);
            throw error;
        }
    }

    async installUpdate(updatePackagePath) {
        try {
            logger.info(`Installing from ${updatePackagePath}`);
            if (!fs.existsSync(updatePackagePath)) throw new Error(`Not found: ${updatePackagePath}`);
            const backupDir = path.join(this.updateDir, `backup-${this.currentVersion}`);
            await fs.ensureDir(backupDir);
            logger.info(`Backup: ${backupDir}`);
            if (process.platform === 'win32') {
                const { execFile } = require('child_process');
                execFile(updatePackagePath, ['/S'], (error) => {
                    if (error) logger.error('Installation failed:', error);
                    else logger.info('Installation complete');
                });
            }
            return true;
        } catch (error) {
            logger.error('Installation failed:', error);
            throw error;
        }
    }

    async verifyUpdate(updatePackagePath, checksumPath) {
        try {
            logger.info(`Verifying...`);
            const crypto = require('crypto');
            const checksumFile = checksumPath || path.join(updatePackagePath, 'checksums.json');
            if (!fs.existsSync(checksumFile)) return true;
            const checksums = await fs.readJson(checksumFile);
            const filesDir = path.join(updatePackagePath, 'files');
            for (const [filePath, expectedChecksum] of Object.entries(checksums)) {
                const fullPath = path.join(filesDir, filePath);
                const fileContent = await fs.readFile(fullPath);
                const actualChecksum = crypto.createHash('sha256').update(fileContent).digest('hex');
                if (actualChecksum !== expectedChecksum) { logger.error(`Mismatch: ${filePath}`); return false; }
            }
            logger.info('Verification OK');
            return true;
        } catch (error) {
            logger.error('Verification failed:', error);
            return false;
        }
    }

    async createUpdatePackage(version, files) {
        try {
            const packageDir = path.join(this.updateDir, `update-${version}`);
            await fs.ensureDir(packageDir);

            // Create manifest
            const manifest = {
                version,
                timestamp: new Date().toISOString(),
                files: []
            };

            // Create checksums
            const checksums = {};

            // Copy files
            const filesDir = path.join(packageDir, 'files');
            await fs.ensureDir(filesDir);

            for (const file of files) {
                const destPath = path.join(filesDir, file.relativePath);
                await fs.ensureDir(path.dirname(destPath));
                await fs.copy(file.sourcePath, destPath);

                manifest.files.push({
                    path: file.relativePath,
                    action: 'replace'
                });

                // Calculate SHA256 checksums
                const crypto = require('crypto');
                const fileContent = await fs.readFile(file.sourcePath);
                checksums[file.relativePath] = crypto.createHash('sha256').update(fileContent).digest('hex');
            }

            // Write manifest
            await fs.writeJson(path.join(packageDir, 'manifest.json'), manifest, { spaces: 2 });

            // Write checksums
            await fs.writeJson(path.join(packageDir, 'checksums.json'), checksums, { spaces: 2 });

            // Create rollback info
            const rollback = {
                version: this.currentVersion,
                timestamp: new Date().toISOString()
            };
            await fs.writeJson(path.join(packageDir, 'rollback.json'), rollback, { spaces: 2 });

            logger.info(`Update package created: ${packageDir}`);
            return packageDir;
        } catch (error) {
            logger.error('Failed to create update package:', error);
            throw error;
        }
    }

    getCurrentVersion() {
        return this.currentVersion;
    }

    compareVersions(v1, v2) {
        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);

        for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
            const p1 = parts1[i] || 0;
            const p2 = parts2[i] || 0;

            if (p1 > p2) return 1;
            if (p1 < p2) return -1;
        }

        return 0;
    }
}

// Export singleton instance
const updater = new UpdateManager();
module.exports = updater;
