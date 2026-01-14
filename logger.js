/**
 * Vibe Logger v1.1 - Data Layer (Smart Context)
 * Centralized logging with console separation
 */

const fs = require('fs');
const path = require('path');

// Sensitive keys to mask
const SENSITIVE_KEYS = ['password', 'token', 'auth', 'secret', 'key', 'credential', 'authorization', 'apikey', 'api_key'];
const REDACTED = '***REDACTED***';

class Logger {
    constructor() {
        this.sessionFolder = null;
        this.timeline = [];
        this.consoleDump = [];
        this.isActive = false;
    }

    /**
     * Initialize a new logging session
     * @param {string} outputDir - Base output directory
     * @returns {string} Session folder path
     */
    initSession(outputDir) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        this.sessionFolder = path.join(outputDir, `session_${timestamp}`);

        if (!fs.existsSync(this.sessionFolder)) {
            fs.mkdirSync(this.sessionFolder, { recursive: true });
        }

        this.timeline = [];
        this.consoleDump = [];
        this.isActive = true;

        console.log(`📁 Session initialized: ${this.sessionFolder}`);
        return this.sessionFolder;
    }

    /**
     * Sanitize data by masking sensitive keys
     * @param {any} data - Data to sanitize
     * @returns {any} Sanitized data
     */
    sanitize(data) {
        if (data === null || data === undefined) {
            return data;
        }

        if (typeof data === 'string') {
            return data;
        }

        if (Array.isArray(data)) {
            return data.map(item => this.sanitize(item));
        }

        if (typeof data === 'object') {
            const sanitized = {};
            for (const [key, value] of Object.entries(data)) {
                const lowerKey = key.toLowerCase();
                const isSensitive = SENSITIVE_KEYS.some(sk => lowerKey.includes(sk));

                if (isSensitive && value !== null && value !== undefined) {
                    sanitized[key] = REDACTED;
                } else if (typeof value === 'object') {
                    sanitized[key] = this.sanitize(value);
                } else {
                    sanitized[key] = value;
                }
            }
            return sanitized;
        }

        return data;
    }

    /**
     * Log an event to the timeline (INTERACTION, NETWORK, SNAPSHOT only)
     * @param {string} type - Event type: NETWORK_REQUEST | USER_INTERACTION | SNAPSHOT
     * @param {object} data - Event data
     */
    logEvent(type, data) {
        if (!this.isActive) return;

        const event = {
            timestamp: new Date().toISOString(),
            type: type,
            data: this.sanitize(data)
        };

        this.timeline.push(event);
    }

    /**
     * Log console output to separate dump file
     * @param {string} level - Console level: log | info | warn | debug | error
     * @param {string} text - Console message
     * @param {object} location - Source location
     */
    logConsole(level, text, location) {
        if (!this.isActive) return;

        const entry = {
            timestamp: new Date().toISOString(),
            level: level,
            message: text,
            source: location ? `${location.url || ''}:${location.lineNumber || 0}` : ''
        };

        // Add to console dump (all levels)
        this.consoleDump.push(entry);

        // If ERROR, also add reference to timeline
        if (level === 'error') {
            this.logEvent('CONSOLE_ERROR', {
                message: text.substring(0, 200), // Truncate for timeline
                source: entry.source
            });
        }
    }

    /**
     * Save HTML snapshot to file
     * @param {string} html - Clean HTML content
     * @param {string} trigger - What triggered the snapshot (navigation | error)
     * @returns {string} Filename of saved snapshot
     */
    saveSnapshot(html, trigger) {
        if (!this.isActive || !this.sessionFolder) return null;

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `snap_clean_${timestamp}.html`;
        const filepath = path.join(this.sessionFolder, filename);

        fs.writeFileSync(filepath, html, 'utf8');

        // Log reference to timeline
        this.logEvent('SNAPSHOT', {
            file: filename,
            trigger: trigger
        });

        console.log(`📸 Snapshot saved: ${filename}`);
        return filename;
    }

    /**
     * End session and save all files
     * @returns {string} Session folder path
     */
    endSession() {
        if (!this.isActive || !this.sessionFolder) {
            return null;
        }

        // Save timeline.json (clean events only)
        const timelinePath = path.join(this.sessionFolder, 'timeline.json');
        fs.writeFileSync(timelinePath, JSON.stringify(this.timeline, null, 2), 'utf8');
        console.log(`✅ Timeline saved with ${this.timeline.length} events`);

        // Save console_dump.log (all console output)
        if (this.consoleDump.length > 0) {
            const consolePath = path.join(this.sessionFolder, 'console_dump.log');
            const consoleContent = this.consoleDump.map(entry =>
                `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}${entry.source ? ' (' + entry.source + ')' : ''}`
            ).join('\n');
            fs.writeFileSync(consolePath, consoleContent, 'utf8');
            console.log(`📋 Console dump saved with ${this.consoleDump.length} entries`);
        }

        const folder = this.sessionFolder;
        this.isActive = false;
        this.sessionFolder = null;
        this.timeline = [];
        this.consoleDump = [];

        return folder;
    }

    /**
     * Check if session is active
     * @returns {boolean}
     */
    isSessionActive() {
        return this.isActive;
    }
}

// Export singleton instance
module.exports = new Logger();
