// PATH: src/modules/logger.js
// DScribe - Logging Module

const fs = require('fs-extra');
const path = require('path');

class Logger {
    constructor() {
        this.logPath = null;
        this.logLevel = 'info';
        this.levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3
        };
    }

    initialize(logDir) {
        this.logPath = path.join(logDir, `dscribe-${this.getDateString()}.log`);
        fs.ensureDirSync(logDir);
        this.info('Logger initialized');
    }

    getDateString() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }

    getTimestamp() {
        return new Date().toISOString();
    }

    log(level, ...args) {
        if (this.levels[level] > this.levels[this.logLevel]) {
            return;
        }

        const message = args.map(arg => {
            if (typeof arg === 'object') {
                try {
                    return JSON.stringify(arg, null, 2);
                } catch (e) {
                    return String(arg);
                }
            }
            return String(arg);
        }).join(' ');

        const logEntry = `[${this.getTimestamp()}] [${level.toUpperCase()}] ${message}\n`;

        // Console output
        console.log(logEntry.trim());

        // File output
        if (this.logPath) {
            try {
                fs.appendFileSync(this.logPath, logEntry);
            } catch (error) {
                console.error('Failed to write to log file:', error);
            }
        }
    }

    info(...args) {
        this.log('info', ...args);
    }

    warn(...args) {
        this.log('warn', ...args);
    }

    error(...args) {
        this.log('error', ...args);
    }

    debug(...args) {
        this.log('debug', ...args);
    }

    setLevel(level) {
        if (this.levels.hasOwnProperty(level)) {
            this.logLevel = level;
            this.info(`Log level set to ${level}`);
        }
    }

    // Clean up old log files (keep last 30 days)
    async cleanupOldLogs(logDir, daysToKeep = 30) {
        try {
            const files = await fs.readdir(logDir);
            const now = Date.now();
            const maxAge = daysToKeep * 24 * 60 * 60 * 1000;

            for (const file of files) {
                if (file.endsWith('.log')) {
                    const filePath = path.join(logDir, file);
                    const stats = await fs.stat(filePath);
                    const age = now - stats.mtimeMs;

                    if (age > maxAge) {
                        await fs.remove(filePath);
                        this.info(`Removed old log file: ${file}`);
                    }
                }
            }
        } catch (error) {
            this.error('Failed to cleanup old logs:', error);
        }
    }
}

// Export singleton instance
const logger = new Logger();
module.exports = logger;
