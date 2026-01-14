const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Configurações
const EXCLUDE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.css', '.woff', '.woff2', '.ico', '.svg', '.mp4', '.mp3'];
const OUTPUT_DIR = path.join(__dirname, 'captures');

// Cria pasta de capturas se não existir
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR);
}

(async () => {
    console.log('🚀 Iniciando Vibe Logger (Clean Mode)...');

    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: [
            '--start-maximized',
            '--no-sandbox',           // Correção aplicada
            '--disable-setuid-sandbox' // Correção aplicada
        ]
    });

    const pages = await browser.pages();
    const page = pages[0];

    // --- VARIÁVEIS DE ESTADO ---
    let isRecording = false;
    let payloadLogs = [];
    let consoleLogs = [];

    // --- FUNÇÕES DE CONTROLE ---
    await page.exposeFunction('nodeStartRecording', () => {
        isRecording = true;
        payloadLogs = [];
        consoleLogs = [];
        console.log('🔴 GRAVAÇÃO INICIADA');
        return true;
    });

    await page.exposeFunction('nodeStopRecording', async () => {
        isRecording = false;
        console.log('⏹ GRAVAÇÃO PARADA. Salvando arquivos...');

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const sessionFolder = path.join(OUTPUT_DIR, `session_${timestamp}`);

        fs.mkdirSync(sessionFolder);

        // Salva PAYLOAD.JSON (Versão Limpa)
        fs.writeFileSync(
            path.join(sessionFolder, 'payload.json'),
            JSON.stringify(payloadLogs, null, 2)
        );

        // Salva CONSOLE.JSON
        fs.writeFileSync(
            path.join(sessionFolder, 'console.json'),
            JSON.stringify(consoleLogs, null, 2)
        );

        console.log(`✅ Arquivos salvos em: ${sessionFolder}`);
        return sessionFolder;
    });

    // --- CAPTURA DE CONSOLE ---
    page.on('console', async (msg) => {
        if (!isRecording) return;
        consoleLogs.push({
            type: msg.type(),
            text: msg.text(),
            location: msg.location(), // Útil para saber qual linha do código deu erro
            timestamp: new Date().toISOString()
        });
    });

    // --- CAPTURA DE REDE (PAYLOADS OTIMIZADOS) ---
    await page.setRequestInterception(true);

    page.on('request', (request) => {
        request.continue();
    });

    page.on('response', async (response) => {
        if (!isRecording) return;

        const req = response.request();
        const url = response.url();
        const method = req.method();
        const resourceType = req.resourceType();

        // 1. Filtro de Extensões/Tipos (Para não poluir com imagens/fontes)
        const extension = path.extname(url).toLowerCase();
        if (EXCLUDE_EXTENSIONS.includes(extension) || resourceType === 'image' || resourceType === 'font' || resourceType === 'media') {
            return;
        }

        // --- TRATAMENTO DO BODY DA RESPONSE ---
        let responseBody = null;
        try {
            // Primeiro tenta JSON
            responseBody = await response.json();
        } catch (e) {
            try {
                // Se falhar, tenta texto
                const text = await response.text();
                // Só salva se não for vazio e não parecer lixo binário (opcional, mas bom pra vibe code)
                if (text && text.length > 0) {
                    responseBody = text;
                }
            } catch (e2) {
                // Se não der pra ler (ex: cors, redirect 302 sem body), deixa null
                responseBody = null;
            }
        }

        // --- TRATAMENTO DO BODY DA REQUEST ---
        let requestBody = null;
        const postData = req.postData();
        if (postData) {
            try {
                requestBody = JSON.parse(postData);
            } catch (e) {
                requestBody = postData; // Se não for JSON, salva a string crua
            }
        }

        // --- MONTAGEM DO LOG LIMPO ---
        // Cria apenas os campos essenciais
        const logEntry = {
            url: url,
            method: method,
            status: response.status(),
            type: resourceType,
            timestamp: new Date().toISOString()
        };

        // Regra: Só adiciona 'request' se tiver body (payload enviado)
        if (requestBody) {
            logEntry.request = { body: requestBody };
        }

        // Regra: Só adiciona 'response' se tiver body (conteúdo recebido)
        // Ignora bodies vazios ou nulos
        if (responseBody !== null && responseBody !== undefined && responseBody !== '') {
            logEntry.response = { body: responseBody };
        }

        payloadLogs.push(logEntry);
        console.log(`⚡ [${method}] ${url}`);
    });

    // --- INJEÇÃO DE INTERFACE ---
    await page.evaluateOnNewDocument(() => {
        window.addEventListener('DOMContentLoaded', () => {
            const div = document.createElement('div');
            div.style.cssText = `
                position: fixed; bottom: 20px; right: 20px; z-index: 2147483647;
                background: rgba(0,0,0,0.85); padding: 15px; border-radius: 12px;
                display: flex; flex-direction: column; gap: 10px; font-family: monospace; border: 1px solid #444;
                box-shadow: 0 10px 30px rgba(0,0,0,0.5); backdrop-filter: blur(5px);
                min-width: 200px; min-height: 80px; cursor: move;
            `;

            const btnRec = document.createElement('button');
            btnRec.innerText = '● REC';
            btnRec.style.cssText = `background: #ff4d4d; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold;`;

            const btnStop = document.createElement('button');
            btnStop.innerText = '■ SAVE';
            btnStop.style.cssText = `background: #4dff88; color: #000; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; display: none;`;

            const statusLabel = document.createElement('div');
            statusLabel.innerText = 'Ready';
            statusLabel.style.cssText = 'color: #aaa; font-size: 10px; margin-top:5px; text-align:center;';

            // Resize handle
            const resizeHandle = document.createElement('div');
            resizeHandle.style.cssText = `
                position: absolute; bottom: 0; right: 0; width: 15px; height: 15px;
                cursor: nwse-resize; background: linear-gradient(135deg, transparent 50%, #666 50%);
                border-bottom-right-radius: 12px;
            `;

            btnRec.onclick = async () => {
                await window.nodeStartRecording();
                btnRec.style.display = 'none';
                btnStop.style.display = 'block';
                div.style.border = '2px solid red';
                statusLabel.innerText = 'Recording...';
                statusLabel.style.color = 'red';
            };

            btnStop.onclick = async () => {
                const folder = await window.nodeStopRecording();
                btnStop.style.display = 'none';
                btnRec.style.display = 'block';
                div.style.border = '1px solid #444';
                statusLabel.innerText = 'Saved!';
                statusLabel.style.color = '#4dff88';
                setTimeout(() => statusLabel.innerText = 'Ready', 2000);
            };

            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'display: flex; gap: 10px;';
            wrapper.appendChild(btnRec);
            wrapper.appendChild(btnStop);
            div.appendChild(wrapper);
            div.appendChild(statusLabel);
            div.appendChild(resizeHandle);
            document.body.appendChild(div);

            // --- DRAG & DROP LOGIC ---
            let isDragging = false;
            let dragOffsetX = 0;
            let dragOffsetY = 0;

            div.addEventListener('mousedown', (e) => {
                // Don't drag if clicking on buttons or resize handle
                if (e.target === btnRec || e.target === btnStop || e.target === resizeHandle) {
                    return;
                }

                isDragging = true;
                dragOffsetX = e.clientX - div.offsetLeft;
                dragOffsetY = e.clientY - div.offsetTop;
                div.style.cursor = 'grabbing';
                e.preventDefault();
            });

            document.addEventListener('mousemove', (e) => {
                if (!isDragging) return;

                const newLeft = e.clientX - dragOffsetX;
                const newTop = e.clientY - dragOffsetY;

                // Keep within viewport bounds
                const maxLeft = window.innerWidth - div.offsetWidth;
                const maxTop = window.innerHeight - div.offsetHeight;

                div.style.left = Math.max(0, Math.min(newLeft, maxLeft)) + 'px';
                div.style.top = Math.max(0, Math.min(newTop, maxTop)) + 'px';
                div.style.bottom = 'auto';
                div.style.right = 'auto';
            });

            document.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    div.style.cursor = 'move';
                }
            });

            // --- RESIZE LOGIC ---
            let isResizing = false;
            let resizeStartX = 0;
            let resizeStartY = 0;
            let resizeStartWidth = 0;
            let resizeStartHeight = 0;

            resizeHandle.addEventListener('mousedown', (e) => {
                isResizing = true;
                resizeStartX = e.clientX;
                resizeStartY = e.clientY;
                resizeStartWidth = div.offsetWidth;
                resizeStartHeight = div.offsetHeight;
                e.stopPropagation();
                e.preventDefault();
            });

            document.addEventListener('mousemove', (e) => {
                if (!isResizing) return;

                const deltaX = e.clientX - resizeStartX;
                const deltaY = e.clientY - resizeStartY;

                const newWidth = Math.max(200, resizeStartWidth + deltaX);
                const newHeight = Math.max(80, resizeStartHeight + deltaY);

                div.style.width = newWidth + 'px';
                div.style.height = newHeight + 'px';
            });

            document.addEventListener('mouseup', () => {
                if (isResizing) {
                    isResizing = false;
                }
            });
        });
    });

    console.log('🌐 Navegador aberto. Use os botões no canto inferior direito para gravar.');
    await page.goto('about:blank');
})();