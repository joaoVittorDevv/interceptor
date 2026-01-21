const express = require('express');
const cors = require('cors');
const compression = require('compression');
const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const archiver = require('archiver');

// ========================================
// CAPTURE PROCESS MANAGEMENT (T003-T007)
// ========================================

let activeCapture = null; // { process, pid, startedAt, lastSessionId }

/**
 * Get current capture status
 * @returns {Object} { status, startedAt, pid, error, lastSessionId }
 */
function getCaptureStatus() {
    if (!activeCapture) {
        return { status: 'IDLE', startedAt: null, pid: null, error: null };
    }
    return {
        status: 'RECORDING',
        startedAt: activeCapture.startedAt,
        pid: activeCapture.pid,
        error: null
    };
}

/**
 * Start a new capture process
 * @returns {Promise<Object>} { status, startedAt, pid } or throws error
 */
async function startCapture() {
    if (activeCapture) {
        const err = new Error('Recording already in progress');
        err.code = 'ALREADY_RECORDING';
        throw err;
    }

    return new Promise((resolve, reject) => {
        const child = spawn('node', ['index.js'], {
            cwd: __dirname,
            stdio: ['ignore', 'pipe', 'pipe'],
            detached: false
        });

        const startedAt = new Date().toISOString();

        activeCapture = {
            process: child,
            pid: child.pid,
            startedAt,
            lastSessionId: null
        };

        // Capture stdout for session ID detection
        let stdoutBuffer = '';
        child.stdout.on('data', (data) => {
            stdoutBuffer += data.toString();
            // Look for session save message
            const match = stdoutBuffer.match(/SESSÃO SALVA COM SUCESSO: .*[\/\\](session_[^\s]+)/);
            if (match && activeCapture) {
                activeCapture.lastSessionId = match[1];
            }
        });

        child.stderr.on('data', (data) => {
            console.error(`[Capture stderr]: ${data}`);
        });

        // Handle process exit (T007: crash detection)
        child.on('exit', (code, signal) => {
            console.log(`[Capture] Process exited with code ${code}, signal ${signal}`);
            if (activeCapture && activeCapture.pid === child.pid) {
                activeCapture = null;
            }
        });

        child.on('error', (err) => {
            console.error('[Capture] Process error:', err);
            activeCapture = null;
            reject(err);
        });

        // Give process time to start, then resolve
        setTimeout(() => {
            if (activeCapture && activeCapture.pid === child.pid) {
                resolve({
                    status: 'RECORDING',
                    startedAt,
                    pid: child.pid
                });
            } else {
                reject(new Error('Process failed to start'));
            }
        }, 500);
    });
}

/**
 * Stop the active capture process
 * @returns {Promise<Object>} { status, sessionId, stoppedAt } or throws error
 */
async function stopCapture() {
    if (!activeCapture) {
        const err = new Error('No active recording');
        err.code = 'NOT_RECORDING';
        throw err;
    }

    return new Promise((resolve) => {
        const { process: child, lastSessionId } = activeCapture;
        const stoppedAt = new Date().toISOString();

        child.on('exit', () => {
            const sessionId = activeCapture?.lastSessionId || lastSessionId || 'unknown';
            activeCapture = null;
            resolve({
                status: 'IDLE',
                sessionId,
                stoppedAt
            });
        });

        // Send SIGTERM for graceful shutdown
        child.kill('SIGTERM');

        // Fallback: force kill after 5 seconds
        setTimeout(() => {
            if (activeCapture) {
                child.kill('SIGKILL');
                activeCapture = null;
                resolve({
                    status: 'IDLE',
                    sessionId: lastSessionId || 'unknown',
                    stoppedAt
                });
            }
        }, 5000);
    });
}

const app = express();
const PORT = 3001;

// Middleware
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(compression());
app.use(express.json());

/**
 * Parse session folder timestamp to ISO string
 * @param {string} sessionId - Session folder name (e.g., session_2026-01-21T19-44-03-734Z)
 * @returns {string} ISO timestamp string (e.g., 2026-01-21T19:44:03.734Z)
 * @throws {Error} If sessionId format is invalid
 */
function parseSessionTimestamp(sessionId) {
    // Validate format: session_YYYY-MM-DDTHH-mm-ss-sssZ
    const sessionIdPattern = /^session_(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/;
    const match = sessionId.match(sessionIdPattern);

    if (!match) {
        throw new Error(`Invalid session ID format: ${sessionId}`);
    }

    const [, datePart, hours, minutes, seconds, milliseconds] = match;

    // Reconstruct as ISO string: YYYY-MM-DDTHH:mm:ss.sssZ
    const isoString = `${datePart}T${hours}:${minutes}:${seconds}.${milliseconds}Z`;

    // Validate it's a valid date
    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
        throw new Error(`Invalid date in session ID: ${sessionId}`);
    }

    return isoString;
}

// GET /api/sessions - List all sessions
app.get('/api/sessions', async (req, res) => {
    try {
        const capturesDir = path.join(__dirname, 'captures');
        const folders = await fs.readdir(capturesDir);

        const sessionPromises = folders
            .filter(name => name.startsWith('session_'))
            .map(async (sessionId) => {
                try {
                    const timelineFile = path.join(capturesDir, sessionId, 'timeline.json');
                    let eventCount = 0;

                    try {
                        const content = await fs.readFile(timelineFile, 'utf-8');
                        const events = JSON.parse(content);
                        eventCount = Array.isArray(events) ? events.length : 0;
                    } catch (err) {
                        console.warn(`Failed to read timeline for ${sessionId}:`, err.message);
                    }

                    // Parse timestamp from sessionId
                    const timestamp = parseSessionTimestamp(sessionId);

                    return {
                        sessionId,
                        timestamp,
                        eventCount,
                        filePath: `captures/${sessionId}/timeline.json`
                    };
                } catch (err) {
                    // Log warning and skip this session if parsing fails
                    console.warn(`Failed to process session ${sessionId}:`, err.message);
                    return null;
                }
            });

        const sessionsWithNulls = await Promise.all(sessionPromises);

        // Filter out failed sessions (null values)
        const sessions = sessionsWithNulls.filter(session => session !== null);

        // Sort by timestamp descending (newest first)
        sessions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        res.json({ sessions, total: sessions.length });
    } catch (error) {
        console.error('Error reading sessions:', error);
        res.status(500).json({
            error: 'Failed to read sessions directory',
            message: error.message
        });
    }
});

// GET /api/sessions/:sessionId/timeline - Get timeline for session
app.get('/api/sessions/:sessionId/timeline', async (req, res) => {
    const { sessionId } = req.params;

    // Validate session ID format
    const sessionIdPattern = /^session_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/;
    if (!sessionIdPattern.test(sessionId)) {
        return res.status(400).json({
            error: 'Invalid session ID',
            message: 'Session ID must match pattern: session_YYYY-MM-DDTHH-mm-ss-SSSZ'
        });
    }

    const timelineFile = path.join(__dirname, 'captures', sessionId, 'timeline.json');

    try {
        // Check if file exists
        await fs.access(timelineFile);

        // Read and parse timeline
        const content = await fs.readFile(timelineFile, 'utf-8');
        const events = JSON.parse(content);

        // Validate it's an array
        if (!Array.isArray(events)) {
            throw new Error('Timeline must be an array');
        }

        // Sort events by timestamp (ascending)
        events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        // Calculate metadata
        const metadata = {
            eventCount: events.length,
            firstEventTimestamp: events.length > 0 ? events[0].timestamp : null,
            lastEventTimestamp: events.length > 0 ? events[events.length - 1].timestamp : null,
            duration: events.length > 1
                ? new Date(events[events.length - 1].timestamp).getTime() - new Date(events[0].timestamp).getTime()
                : null
        };

        res.json({ sessionId, events, metadata });
    } catch (error) {
        if (error.code === 'ENOENT') {
            return res.status(404).json({
                error: 'Session not found',
                message: `No session found with ID: ${sessionId}`
            });
        }

        if (error instanceof SyntaxError) {
            return res.status(500).json({
                error: 'Failed to parse timeline',
                message: error.message
            });
        }

        console.error('Error loading timeline:', error);
        res.status(500).json({
            error: 'Failed to load timeline',
            message: error.message
        });
    }
});

// GET /api/sessions/:sessionId/download - Download session as ZIP
app.get('/api/sessions/:sessionId/download', async (req, res) => {
    const { sessionId } = req.params;

    // Validate session ID format
    const sessionIdPattern = /^session_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/;
    if (!sessionIdPattern.test(sessionId)) {
        return res.status(400).json({
            error: 'Invalid session ID',
            message: 'Session ID must match pattern: session_YYYY-MM-DDTHH-mm-ss-SSSZ'
        });
    }

    const sessionDir = path.join(__dirname, 'captures', sessionId);

    try {
        // Check if session directory exists
        await fs.access(sessionDir);

        // Set response headers for ZIP download
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${sessionId}.zip"`);

        // Create archiver instance
        const archive = archiver('zip', {
            zlib: { level: 9 } // Maximum compression
        });

        // Handle archiver errors
        archive.on('error', (err) => {
            console.error('Archiver error:', err);
            if (!res.headersSent) {
                res.status(500).json({
                    error: 'Failed to create ZIP archive',
                    message: err.message
                });
            }
        });

        // Handle archiver warnings
        archive.on('warning', (err) => {
            if (err.code === 'ENOENT') {
                console.warn('Archiver warning:', err);
            } else {
                throw err;
            }
        });

        // Pipe archive to response
        archive.pipe(res);

        // Add session directory to archive
        archive.directory(sessionDir, false);

        // Finalize the archive
        await archive.finalize();

        console.log(`📦 Session ${sessionId} downloaded successfully`);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return res.status(404).json({
                error: 'Session not found',
                message: `No session found with ID: ${sessionId}`
            });
        }

        console.error('Error creating session download:', error);
        if (!res.headersSent) {
            res.status(500).json({
                error: 'Failed to download session',
                message: error.message
            });
        }
    }
});

// DELETE /api/sessions/:sessionId - Delete session
app.delete('/api/sessions/:sessionId', async (req, res) => {
    const { sessionId } = req.params;

    // Validate session ID format
    const sessionIdPattern = /^session_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/;
    if (!sessionIdPattern.test(sessionId)) {
        return res.status(400).json({
            error: 'Invalid session ID',
            message: 'Session ID must match pattern: session_YYYY-MM-DDTHH-mm-ss-SSSZ'
        });
    }

    const sessionDir = path.join(__dirname, 'captures', sessionId);

    try {
        // Check if session directory exists
        await fs.access(sessionDir);

        // Delete the session directory recursively
        await fs.rm(sessionDir, { recursive: true, force: true });

        console.log(`🗑️  Session ${sessionId} deleted successfully`);

        res.status(200).json({
            success: true,
            message: `Session ${sessionId} deleted successfully`,
            sessionId
        });
    } catch (error) {
        if (error.code === 'ENOENT') {
            return res.status(404).json({
                error: 'Session not found',
                message: `No session found with ID: ${sessionId}`
            });
        }

        console.error('Error deleting session:', error);
        res.status(500).json({
            error: 'Failed to delete session',
            message: error.message
        });
    }
});

// ========================================
// CAPTURE CONTROL ENDPOINTS (T004-T006)
// ========================================

// POST /api/capture/start - Start recording (T004)
app.post('/api/capture/start', async (req, res) => {
    try {
        const result = await startCapture();
        res.status(201).json(result);
    } catch (error) {
        if (error.code === 'ALREADY_RECORDING') {
            return res.status(409).json({
                error: 'Recording already in progress',
                message: 'Stop current recording before starting a new one'
            });
        }
        console.error('Error starting capture:', error);
        res.status(500).json({
            error: 'Failed to start capture',
            message: error.message
        });
    }
});

// POST /api/capture/stop - Stop recording (T005)
app.post('/api/capture/stop', async (req, res) => {
    try {
        const result = await stopCapture();
        res.status(200).json(result);
    } catch (error) {
        if (error.code === 'NOT_RECORDING') {
            return res.status(400).json({
                error: 'No active recording',
                message: 'Cannot stop: no recording is currently active'
            });
        }
        console.error('Error stopping capture:', error);
        res.status(500).json({
            error: 'Failed to stop capture',
            message: error.message
        });
    }
});

// GET /api/capture/status - Get recording status (T006)
app.get('/api/capture/status', (req, res) => {
    res.json(getCaptureStatus());
});

app.listen(PORT, () => {
    console.log(`✅ API Server running on http://localhost:${PORT}`);
    console.log(`📊 Serving sessions from: ${path.join(__dirname, 'captures')}`);
    console.log(`🎬 Capture control available at /api/capture/*`);
});
