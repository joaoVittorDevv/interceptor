/**
 * Vibe Logger v2.0 - Orchestrator
 * Configures Puppeteer and coordinates modules
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// Import data layer (Node module - CommonJS OK here)
const logger = require('./logger');

// Read client UI script (pure vanilla JS file)
const CLIENT_UI_SCRIPT = fs.readFileSync(path.join(__dirname, 'client_ui.js'), 'utf8');

// Configuration
const EXCLUDE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.css', '.woff', '.woff2', '.ico', '.svg', '.mp4', '.mp3'];
const OUTPUT_DIR = path.join(__dirname, 'captures');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Global recording state (The Handshake)
let globalIsRecording = false;

(async () => {
    console.log('🚀 Iniciando Vibe Logger v2.0...');

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: false,
            defaultViewport: null,
            args: [
                '--start-maximized',
                '--no-sandbox',
                '--disable-setuid-sandbox'
            ]
        });
    } catch (err) {
        console.error('❌ Failed to launch browser:', err.message);
        process.exit(1);
    }

    const pages = await browser.pages();
    const page = pages[0];

    // ========================================
    // DEBUG: BROWSER CONSOLE/ERROR LOGGING
    // ========================================
    page.on('console', msg => {
        const text = msg.text();
        if (text.includes('Vibe Logger') || text.includes('---')) {
            console.log('🔵 BROWSER:', text);
        }
    });

    page.on('pageerror', err => {
        console.log('🔴 BROWSER ERROR:', err.toString());
    });

    // Handle browser disconnection
    browser.on('disconnected', () => {
        console.log('🔌 Browser disconnected');
        if (globalIsRecording) {
            console.log('⚠️ Recording was active, attempting to save...');
            try {
                logger.endSession();
            } catch (e) {
                console.error('Failed to save on disconnect:', e.message);
            }
        }
        process.exit(0);
    });

    // ========================================
    // EXPOSE NODE FUNCTIONS TO BROWSER
    // ========================================

    // Start Recording
    await page.exposeFunction('nodeStartRecording', () => {
        globalIsRecording = true;
        logger.initSession(OUTPUT_DIR);
        console.log('🔴 GRAVAÇÃO INICIADA');
        return true;
    });

    // Stop Recording
    await page.exposeFunction('nodeStopRecording', async () => {
        globalIsRecording = false;
        const folder = logger.endSession();
        console.log(`⏹ GRAVAÇÃO PARADA. Arquivos salvos em: ${folder}`);
        return folder;
    });

    // Get Recording State (The Handshake)
    await page.exposeFunction('nodeGetRecordingState', () => {
        return globalIsRecording;
    });

    // Log Click Events
    await page.exposeFunction('nodeLogClick', (clickData) => {
        if (!globalIsRecording) return;
        logger.logEvent('USER_INTERACTION', {
            action: 'click',
            x: clickData.x,
            y: clickData.y,
            selector: clickData.selector,
            tagName: clickData.tagName
        });
    });

    // ========================================
    // CONSOLE CAPTURE
    // ========================================
    page.on('console', async (msg) => {
        if (!globalIsRecording) return;
        // Skip our own debug messages
        const text = msg.text();
        if (text.includes('Vibe Logger') || text.includes('---')) return;

        logger.logEvent('CONSOLE', {
            type: msg.type(),
            text: text,
            location: msg.location()
        });
    });

    // ========================================
    // NETWORK INTERCEPTION
    // ========================================
    await page.setRequestInterception(true);

    page.on('request', (request) => {
        request.continue();
    });

    page.on('response', async (response) => {
        const req = response.request();
        const url = response.url();
        const method = req.method();
        const status = response.status();
        const resourceType = req.resourceType();

        // Filter out static assets
        const extension = path.extname(url).toLowerCase();
        if (EXCLUDE_EXTENSIONS.includes(extension) ||
            resourceType === 'image' ||
            resourceType === 'font' ||
            resourceType === 'media') {
            return;
        }

        // Show toast for XHR/Fetch requests (always, for visual feedback)
        if (resourceType === 'xhr' || resourceType === 'fetch') {
            try {
                await page.evaluate((m, u, s) => {
                    if (window.showNetworkToast) window.showNetworkToast(m, u, s);
                }, method, url, status);
            } catch (e) {
                // Page might be navigating, ignore
            }
        }

        // Only log if recording
        if (!globalIsRecording) return;

        // Get response body
        let responseBody = null;
        try {
            responseBody = await response.json();
        } catch (e) {
            try {
                const text = await response.text();
                if (text && text.length > 0) {
                    responseBody = text;
                }
            } catch (e2) {
                responseBody = null;
            }
        }

        // Get request body
        let requestBody = null;
        const postData = req.postData();
        if (postData) {
            try {
                requestBody = JSON.parse(postData);
            } catch (e) {
                requestBody = postData;
            }
        }

        // Build log entry
        const logEntry = {
            url: url,
            method: method,
            status: status,
            resourceType: resourceType
        };

        if (requestBody) {
            logEntry.request = { body: requestBody };
        }

        if (responseBody !== null && responseBody !== undefined && responseBody !== '') {
            logEntry.response = { body: responseBody };
        }

        logger.logEvent('NETWORK_REQUEST', logEntry);

        // Capture snapshot on network error
        if (status >= 400 && globalIsRecording) {
            try {
                const html = await page.evaluate(() => document.documentElement.outerHTML);
                logger.saveSnapshot(html, `network_error_${status}`);
            } catch (e) {
                // Page might be navigating
            }
        }

        console.log(`⚡ [${method}] ${status} ${url.substring(0, 80)}${url.length > 80 ? '...' : ''}`);
    });

    // ========================================
    // NAVIGATION SNAPSHOT
    // ========================================
    page.on('load', async () => {
        if (!globalIsRecording) return;
        try {
            // Wait a bit for dynamic content
            await new Promise(r => setTimeout(r, 500));
            const html = await page.evaluate(() => document.documentElement.outerHTML);
            logger.saveSnapshot(html, 'navigation_complete');
        } catch (e) {
            console.error('Snapshot failed:', e.message);
        }
    });

    // ========================================
    // INJECT CLIENT UI
    // ========================================

    // For future navigations
    await page.evaluateOnNewDocument(CLIENT_UI_SCRIPT);

    console.log('🌐 Navegador pronto. Navegando para página inicial...');

    // Navigate to a page with a valid DOM (not about:blank which may have issues)
    await page.goto('data:text/html,<html><head><title>Vibe Logger</title></head><body style="background:#1a1a1a;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><h1>Vibe Logger Ready</h1></body></html>');

    // Inject on initial page (evaluateOnNewDocument doesn't run on first page)
    await page.evaluate(CLIENT_UI_SCRIPT);

    console.log('✅ Interface carregada. Use os botões no canto inferior direito para gravar.');
})();