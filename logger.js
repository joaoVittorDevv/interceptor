/**
 * Vibe Logger v2.0 - Data Layer
 * Centralized logging to unified timeline.json with sanitization
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
     * Log an event to the timeline
     * @param {string} type - Event type: NETWORK_REQUEST | USER_INTERACTION | SNAPSHOT | CONSOLE
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
     * Save HTML snapshot to file
     * @param {string} html - HTML content
     * @param {string} trigger - What triggered the snapshot (navigation | error)
     * @returns {string} Filename of saved snapshot
     */
    saveSnapshot(html, trigger) {
        if (!this.isActive || !this.sessionFolder) return null;

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `snap_${timestamp}.html`;
        const filepath = path.join(this.sessionFolder, filename);

        fs.writeFileSync(filepath, html, 'utf8');

        // Log reference to timeline
        this.logEvent('SNAPSHOT', {
            filename: filename,
            trigger: trigger
        });

        console.log(`📸 Snapshot saved: ${filename}`);
        return filename;
    }

    /**
     * End session and save timeline.json
     * @returns {string} Session folder path
     */
    endSession() {
        if (!this.isActive || !this.sessionFolder) {
            return null;
        }

        const timelinePath = path.join(this.sessionFolder, 'timeline.json');
        fs.writeFileSync(timelinePath, JSON.stringify(this.timeline, null, 2), 'utf8');

        console.log(`✅ Timeline saved with ${this.timeline.length} events`);

        const folder = this.sessionFolder;
        this.isActive = false;
        this.sessionFolder = null;
        this.timeline = [];

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
