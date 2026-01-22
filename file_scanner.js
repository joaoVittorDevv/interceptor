const fs = require('fs');
const path = require('path');
const db = require('./db');

const CAPTURES_DIR = path.join(__dirname, 'captures');

/**
* Escaneia uma pasta de sessão específica e atualiza o banco de dados.
* Deve ser chamado sempre que uma gravação termina ou durante a inicialização.
* @param {string} sessionId - O ID da sessão (nome da pasta)
*/
function scanSession(sessionId) {
    const sessionPath = path.join(CAPTURES_DIR, sessionId);

    // 1. Verificação de segurança: a pasta existe no disco?
    if (!fs.existsSync(sessionPath)) {
        console.warn(`⚠️ Sessão ${sessionId} não encontrada no disco. Ignorando.`);
        return;
    }

    // 2. Leitura do diretório físico
    const files = fs.readdirSync(sessionPath);
    let totalSize = 0;

    // Preparação de Queries (Prepared Statements são mais rápidos e seguros)

    // [FIX] Garantir que a sessão Pai existe antes de inserir filhos (FK Constraint)
    const timestampStr = sessionId.replace('session_', '');
    const ensureSessionExists = db.prepare(`
        INSERT OR IGNORE INTO sessions (id, created_at, status)
        VALUES (?, ?, 'COMPLETED')
    `);

    // Limpa estado anterior desta sessão
    const clearOldFiles = db.prepare('DELETE FROM session_files WHERE session_id = ?');

    const insertFile = db.prepare(`
    INSERT INTO session_files (session_id, file_type, file_name, file_path, file_size_bytes)
    VALUES (?, ?, ?, ?, ?)
  `);

    const updateSessionStats = db.prepare(`
    UPDATE sessions
    SET total_files = ?, total_size_bytes = ?, status = 'COMPLETED'
    WHERE id = ?
  `);

    // 3. Execução Transacional (Tudo ou Nada)
    const transaction = db.transaction(() => {
        // [FIX] Cria a sessão se não existir (passo crucial para FK)
        ensureSessionExists.run(sessionId, timestampStr);

        // Limpa arquivos antigos
        clearOldFiles.run(sessionId);

        let fileCount = 0;

        for (const file of files) {
            const fullPath = path.join(sessionPath, file);
            try {
                const stats = fs.statSync(fullPath);
                if (stats.isFile()) {
                    // Extrai extensão limpa (ex: 'json')
                    const ext = path.extname(file).replace('.', '').toLowerCase();
                    // Gera caminho relativo (ex: 'session_X/timeline.json')
                    const relPath = path.join(sessionId, file);

                    insertFile.run(sessionId, ext, file, relPath, stats.size);
                    totalSize += stats.size;
                    fileCount++;
                }
            } catch (err) {
                console.error(`Erro ao processar arquivo ${file}:`, err);
            }
        }
        // Atualiza os contadores na tabela pai
        updateSessionStats.run(fileCount, totalSize, sessionId);
        return fileCount;
    });

    // Dispara a transação
    const count = transaction();
    // console.log(`✅ Sessão ${sessionId} escaneada: ${count} arquivos catalogados.`);
}

/**
* Escaneia TODAS as pastas na inicialização.
* Serve como mecanismo de "Auto-Healing" e migração inicial.
*/
function scanAllSessions() {
    // console.log("🔄 Iniciando varredura completa de sessões...");
    if (!fs.existsSync(CAPTURES_DIR)) return;

    const folders = fs.readdirSync(CAPTURES_DIR);

    // Insere a sessão se ela não existir
    const insertSession = db.prepare(`
    INSERT OR IGNORE INTO sessions (id, created_at, status)
    VALUES (?, ?, 'COMPLETED')
  `);

    let count = 0;
    for (const folder of folders) {
        // Apenas processa pastas que seguem o padrão de nomeação
        if (folder.startsWith('session_')) {
            // Extrai timestamp do nome da pasta (session_2026-...)
            const timestampStr = folder.replace('session_', '');
            insertSession.run(folder, timestampStr);
            scanSession(folder);
            count++;
        }
    }
    // console.log(`🏁 Varredura completa finalizada. ${count} sessões verificadas.`);
}

module.exports = { scanSession, scanAllSessions };
