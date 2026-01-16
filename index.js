/**
 * Vibe Logger v1.1 - Orchestrator (Smart Context)
 * Configures Puppeteer with noise filtering
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// Import data layer (Node module - CommonJS OK here)
const logger = require('./logger');
const TraceCleaner = require('./trace_cleaner');

// Read client UI script (pure vanilla JS file)
const CLIENT_UI_SCRIPT = fs.readFileSync(path.join(__dirname, 'client_ui.js'), 'utf8');

// Configuration
const OUTPUT_DIR = path.join(__dirname, 'captures');

// ========================================
// SMART FILTER CONFIGURATION
// ========================================

// URL patterns to IGNORE (tracking, analytics, noise)
const URL_BLOCKLIST = [
    'google-analytics',
    'googletagmanager',
    'doubleclick',
    'facebook',
    'fbcdn',
    'metrics',
    'telemetry',
    'gen_204',
    'ping',
    'beacon',
    'collect',
    'analytics',
    'tracking',
    'hotjar',
    'clarity',
    'segment',
    'mixpanel',
    'amplitude',
    'sentry',
    'bugsnag',
    'newrelic',
    'datadoghq'
];

// Resource types to IGNORE (static assets)
const IGNORED_RESOURCE_TYPES = ['image', 'font', 'media', 'stylesheet'];

// Extensions to IGNORE
const IGNORED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.mp3', '.wav', '.webm', '.css'];

// Max response snippet size (1KB)
const MAX_RESPONSE_SNIPPET = 1024;

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Check if URL should be filtered out
 * @param {string} url - URL to check
 * @returns {boolean} true if should be ignored
 */
function shouldIgnoreUrl(url) {
    const lowerUrl = url.toLowerCase();
    return URL_BLOCKLIST.some(pattern => lowerUrl.includes(pattern));
}

/**
 * Check if resource type should be filtered
 * @param {string} resourceType - Puppeteer resource type
 * @returns {boolean} true if should be ignored
 */
function shouldIgnoreResourceType(resourceType) {
    return IGNORED_RESOURCE_TYPES.includes(resourceType);
}

/**
 * Check if extension should be filtered
 * @param {string} url - URL to check
 * @returns {boolean} true if should be ignored  
 */
function shouldIgnoreExtension(url) {
    const ext = path.extname(url).toLowerCase().split('?')[0];
    return IGNORED_EXTENSIONS.includes(ext);
}

/**
 * Truncate response to snippet
 * @param {string} response - Full response text
 * @returns {string} Truncated snippet
 */
function getResponseSnippet(response) {
    if (!response) return null;
    const text = typeof response === 'string' ? response : JSON.stringify(response);
    if (text.length <= MAX_RESPONSE_SNIPPET) return text;
    return text.substring(0, MAX_RESPONSE_SNIPPET) + '... [TRUNCATED]';
}

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Global recording state (The Handshake)
let globalIsRecording = false;
let currentTracePath = null;
let isStopping = false;

(async () => {
    console.log('🚀 Iniciando Vibe Logger v1.1 (Smart Context)...');

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
        const type = msg.type();

        // Show our debug logs
        if (text.includes('Vibe Logger') || text.includes('---')) {
            console.log('🔵 BROWSER:', text);
        }

        // Log to logger if recording (separate console dump)
        if (globalIsRecording) {
            logger.logConsole(type, text, msg.location());
        }
    });

    page.on('pageerror', err => {
        console.log('🔴 BROWSER ERROR:', err.toString());
        if (globalIsRecording) {
            logger.logConsole('error', err.toString(), null);
        }
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
    await page.exposeFunction('nodeStartRecording', async () => {
        globalIsRecording = true;
        const sessionFolder = logger.initSession(OUTPUT_DIR);

        // Performance Tracing Setup
        currentTracePath = path.join(sessionFolder, 'raw_trace_temp.json');
        try {
            await page.tracing.start({
                path: currentTracePath,
                screenshots: false,
                categories: [
                    'devtools.timeline',
                    'v8.execute',
                    'disabled-by-default-devtools.timeline',
                    'toplevel',
                    'blink.user_timing',
                    'latencyInfo'
                ]
            });
        } catch (e) {
            console.error('⚠️ Failed to start tracing:', e.message);
        }

        console.log('🔴 GRAVAÇÃO INICIADA');
        return true;
    });

    // Stop Recording - Versão com Timeout e Concorrência (v1.3)
    await page.exposeFunction('nodeStopRecording', async () => {
        // 1. Prevenção de Múltiplos Cliques (Concurrency Lock)
        if (isStopping) {
            console.warn('⚠️ Processo de parada já em andamento. Ignorando clique duplicado.');
            return null;
        }
        isStopping = true;
        console.log('🛑 Solicitada parada de gravação...');

        globalIsRecording = false;
        let traceSummary = null;

        // 2. Parada do Tracing com Timeout (Race Condition)
        if (currentTracePath) {
            console.log('⏳ Parando Tracing do Chrome (Timeout: 5s)...');

            try {
                // Cria uma promessa que rejeita após 5 segundos
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Tracing stop timed out')), 5000)
                );

                // Competição: O que terminar primeiro ganha (Stop ou Timeout)
                await Promise.race([
                    page.tracing.stop(),
                    timeoutPromise
                ]);

                console.log('📉 Tracing parado com sucesso. Iniciando ETL...');

                // Só executa o ETL se o arquivo existir e não tivermos estourado o tempo
                if (fs.existsSync(currentTracePath)) {
                    traceSummary = TraceCleaner.process(currentTracePath);

                    if (traceSummary) {
                        logger.logEvent('PERFORMANCE_SUMMARY', traceSummary);
                        console.log('✅ Performance injetada na timeline.');
                    }

                    // Limpeza do arquivo temporário
                    try { fs.unlinkSync(currentTracePath); } catch (err) { console.error('⚠️ Falha ao deletar trace temp:', err.message); }
                }

            } catch (e) {
                console.error('⚠️ ALERTA DE PERFORMANCE:', e.message);
                console.log('⏩ Pulando etapa de tracing para garantir salvamento dos dados.');
                // Não relançamos o erro para garantir que o código abaixo (logger.endSession) seja executado
            } finally {
                currentTracePath = null;
            }
        }

        // 3. Finalização da Sessão (Código Indestrutível)
        console.log('💾 Salvando sessão no disco...');
        try {
            const folder = logger.endSession();
            console.log(`✅ SESSÃO SALVA COM SUCESSO: ${folder}`);

            // Reset do lock para permitir novas gravações futuras (se necessário reiniciar a página)
            isStopping = false;

            return folder;
        } catch (fatalError) {
            console.error('❌ ERRO FATAL AO SALVAR SESSÃO:', fatalError);
            isStopping = false;
            return null;
        }
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

    // Save Clean Snapshot (called from browser)
    await page.exposeFunction('nodeSaveSnapshot', (cleanHtml, trigger) => {
        if (!globalIsRecording) return null;
        return logger.saveSnapshot(cleanHtml, trigger);
    });

    // ========================================
    // NETWORK INTERCEPTION (SMART FILTERED)
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

        // ========================================
        // NOISE FILTER CHAIN
        // ========================================

        // 1. Check URL blocklist
        if (shouldIgnoreUrl(url)) {
            return; // Skip tracking/analytics
        }

        // 2. Check resource type (images, fonts, media, CSS)
        if (shouldIgnoreResourceType(resourceType)) {
            return; // Skip static assets
        }

        // 3. Check file extension
        if (shouldIgnoreExtension(url)) {
            return; // Skip by extension
        }

        // 4. For scripts, only log if error
        if (resourceType === 'script' && status < 400) {
            return; // Skip successful JS loads
        }

        // ========================================
        // SHOW TOAST (Visual feedback for relevant requests)
        // ========================================
        if (resourceType === 'xhr' || resourceType === 'fetch' || resourceType === 'document') {
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

        // ========================================
        // CAPTURE RELEVANT DATA
        // ========================================
        let responseSnippet = null;

        // For XHR/Fetch, try to get JSON response snippet
        if (resourceType === 'xhr' || resourceType === 'fetch') {
            try {
                const contentType = response.headers()['content-type'] || '';
                if (contentType.includes('application/json')) {
                    const json = await response.json();
                    responseSnippet = getResponseSnippet(json);
                }
            } catch (e) {
                // Could not parse, skip snippet
            }
        }

        // Build clean log entry
        const logEntry = {
            method: method,
            url: url,
            status: status
        };

        // Only add snippet if we got one
        if (responseSnippet) {
            logEntry.responseSnippet = responseSnippet;
        }

        logger.logEvent('NETWORK_REQUEST', logEntry);

        // Capture snapshot on network error
        if (status >= 400) {
            try {
                await page.evaluate((trigger) => {
                    if (window.captureCleanSnapshot) {
                        window.captureCleanSnapshot(trigger);
                    }
                }, `network_error_${status}`);
            } catch (e) {
                // Page might be navigating
            }
        }

        // Minimal console log
        const shortUrl = url.length > 60 ? url.substring(0, 57) + '...' : url;
        console.log(`⚡ [${method}] ${status} ${shortUrl}`);
    });

    // ========================================
    // NAVIGATION SNAPSHOT
    // ========================================
    page.on('load', async () => {
        if (!globalIsRecording) return;
        try {
            // Wait a bit for dynamic content
            await new Promise(r => setTimeout(r, 500));
            await page.evaluate(() => {
                if (window.captureCleanSnapshot) {
                    window.captureCleanSnapshot('navigation_complete');
                }
            });
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

    // Navigate to a page with a valid DOM
    await page.goto('data:text/html,<html><head><title>Vibe Logger</title></head><body style="background:#1a1a1a;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><h1>Vibe Logger v1.1 Ready</h1></body></html>');

    // Inject on initial page
    await page.evaluate(CLIENT_UI_SCRIPT);

    console.log('✅ Interface carregada. Use os botões no canto inferior direito para gravar.');
})();