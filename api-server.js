const express = require('express');
const cors = require('cors');
const compression = require('compression');
const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const archiver = require('archiver');
const db = require('./db');
const { scanSession, scanAllSessions } = require('./file_scanner');

// Execute scanAllSessions() UMA VEZ ao iniciar o server para garantir sincronia
scanAllSessions();

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
            const chunk = data.toString();
            stdoutBuffer += chunk;

            // Look for session save message - Robust Logic
            // Matches: ... session_2026-01-22T14-00-00-000Z ...
            const match = stdoutBuffer.match(/(session_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)/);
            if (match && activeCapture && !activeCapture.lastSessionId) {
                // ID detected
                activeCapture.lastSessionId = match[1];
            }
        });

        child.stderr.on('data', (data) => {
            console.error(`[Capture stderr]: ${data}`);
        });

        // Handle process exit (T007: crash detection + Graceful DB Update)
        child.on('exit', (code, signal) => {

            // Capture the Last Session ID using the closure if activeCapture is still valid or already null
            // We use the one we detected via stdout

            // If activeCapture was already null (cleaned by force), we might lose context if we rely strictly on global.
            // But usually we only clear activeCapture at the very specific moment.

            // Wait a moment for file flushing
            if (activeCapture && activeCapture.lastSessionId) {
                const sessionId = activeCapture.lastSessionId;

                setTimeout(() => {
                    try {
                        scanSession(sessionId);
                    } catch (e) {
                        console.error(`❌ [Orchestrator] Falha ao atualizar DB:`, e);
                    }
                }, 1000);
            }

            // Always clear activeCapture on exit to reset state
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

    // Capture local reference
    const { process: child } = activeCapture;

    return new Promise((resolve) => {
        const stoppedAt = new Date().toISOString();

        // 1. Send SIGTERM to trigger graceful shutdown in index.js
        // index.js will catch this, save session, print ID, and then exit.
        child.kill('SIGTERM');

        // 2. Wait for the process to actually exit
        // The DB update logic is now entirely handled by the 'exit' listener in startCapture
        child.once('exit', () => {
            // We can't easily return the sessionId here because it's asynchronous from the child's stdout.
            // But the API client typically refreshes the list anyway.
            // If we really needed it, we'd have to wait for the stdout match event too.
            // For now, we return IDLE status.

            resolve({
                status: 'IDLE',
                sessionId: activeCapture?.lastSessionId || null, // Best effort
                stoppedAt
            });
            // activeCapture is cleared in the 'exit' listener
        });

        // 3. Fallback force kill
        setTimeout(() => {
            if (activeCapture && activeCapture.pid === child.pid) {
                console.warn('⚠️ Force-killing stalled capture process...');
                child.kill('SIGKILL');
                // The exit listener will still run (with signal SIGKILL)
                // But probably won't have a session ID if it froze.
            }
        }, 6000); // 6s (give index.js 5s to timeout + 1s buffer)
    });
}

const app = express();
const PORT = 3001;

// Middleware
app.use(cors({
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));
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
        const sessions = db.prepare(`
          SELECT
            id,
            created_at,
            status,
            duration_ms,
            total_files,
            total_size_bytes
          FROM sessions
          ORDER BY created_at DESC
        `).all();

        // Adiciona timestamp para manter contrato com frontend se necessário
        // Mas a query já retorna created_at que é o timestamp ISO
        const mappedSessions = sessions.map(s => ({
            sessionId: s.id,
            timestamp: s.created_at,
            eventCount: s.total_files, // Aproximação ou usar outra lógica se events != files
            status: s.status,
            duration: s.duration_ms,
            sizeBytes: s.total_size_bytes
        }));

        res.json({ sessions: mappedSessions, total: mappedSessions.length });
    } catch (error) {
        console.error('Error reading sessions:', error);
        res.status(500).json({
            error: 'Failed to read sessions from database',
            message: error.message
        });
    }
});

// GET /api/sessions/:id/files (NOVA)
app.get('/api/sessions/:id/files', (req, res) => {
    try {
        const files = db.prepare(`
      SELECT * FROM session_files WHERE session_id = ? ORDER BY file_name ASC
    `).all(req.params.id);
        res.json(files);
    } catch (error) {
        res.status(500).json({ error: error.message });
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

// DELETE /api/sessions/reset - Hard Reset (Wipe all data)
app.delete('/api/sessions/reset', async (req, res) => {
    try {
        // 1. Database Wipe (Transactional)
        const wipeDb = db.transaction(() => {
            db.prepare('DELETE FROM session_files').run();
            db.prepare('DELETE FROM sessions').run();
        });
        wipeDb();

        // 2. File System Wipe
        const capturesDir = path.join(__dirname, 'captures');

        // Check if directory exists
        try {
            await fs.access(capturesDir);

            const files = await fs.readdir(capturesDir);
            for (const file of files) {
                // Keep .gitkeep if it exists, remove everything else
                if (file === '.gitkeep') continue;

                const fullPath = path.join(capturesDir, file);
                await fs.rm(fullPath, { recursive: true, force: true });
            }
        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw error; // Rethrow unexpected errors
            }
            // If dir doesn't exist, that's fine (already empty/gone)
        }

        res.status(200).json({ message: 'System reset successful' });

    } catch (error) {
        console.error('❌ Hard Reset Failed:', error);
        res.status(500).json({
            error: 'Failed to reset system',
            message: error.message
        });
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
