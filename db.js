const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'interceptor.db');
const db = new Database(dbPath, { verbose: null });

// CONFIGURAÇÃO CRÍTICA DE PERFORMANCE
// O modo WAL (Write-Ahead Logging) permite leituras e escritas simultâneas.
db.pragma('journal_mode = WAL');

const logMigration = (message) => {
    const logDir = path.join(__dirname, 'logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
    const logFile = path.join(logDir, 'migration_history.log');
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logFile, `[${timestamp}] ${message}\n`);
};

const initSchema = () => {
    try {
        // Executa as queries de criação de tabelas.
        // O uso de IF NOT EXISTS torna essa operação segura para rodar em todo restart.
        db.exec(`
      -- Tabela de Sessões (Metadados que aparecem na Home)
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,          -- Identificador da pasta da sessão
        name TEXT,                    -- Futuro: Nome customizável pelo usuário
        created_at TEXT NOT NULL,     -- Data ISO para ordenação temporal
        status TEXT DEFAULT 'COMPLETED', -- Controle de estado
        duration_ms INTEGER,          -- Duração da captura
        total_files INTEGER DEFAULT 0, -- Cache de performance
        total_size_bytes INTEGER DEFAULT 0 -- Cache de performance
      );

      -- Tabela de Arquivos (Inventário detalhado)
      CREATE TABLE IF NOT EXISTS session_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        file_type TEXT,               -- ex: 'json', 'html'
        file_name TEXT NOT NULL,      -- ex: 'timeline.json'
        file_path TEXT NOT NULL,      -- Caminho relativo
        file_size_bytes INTEGER,      -- Tamanho em bytes
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );

      -- Índices são cruciais para a velocidade da interface gráfica
      CREATE INDEX IF NOT EXISTS idx_sessions_created ON sessions(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_files_session ON session_files(session_id);
    `);
        logMigration('Schema initialized/verified successfully.');
        console.log("📦 Banco de dados SQLite inicializado e verificado com sucesso.");
    } catch (error) {
        console.error("Erro ao inicializar schema:", error);
        logMigration(`Error initializing schema: ${error.message}`);
        throw error;
    }
};

// Inicializa o schema imediatamente ao importar este módulo
initSchema();

module.exports = db;
