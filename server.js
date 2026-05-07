// ==========================================
// PORTAL PÚBLICO — server.js
// Node.js + Express + MySQL (Railway)
// ==========================================

const express = require('express');
const mysql   = require('mysql2/promise');
const cors    = require('cors');
const path    = require('path');

const app = express();
app.use(express.json());
app.use(cors());

app.use((req, res, next) => {
    if (req.path.endsWith('.js') || req.path.endsWith('.css')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
    next();
});

// ── BANCO ──
const dbConfig = {
    host:               process.env.MYSQLHOST     || 'mysql.railway.internal',
    port:               parseInt(process.env.MYSQLPORT) || 3306,
    user:               process.env.MYSQLUSER     || 'root',
    password:           process.env.MYSQLPASSWORD || 'OhogquOKFnLPXoQPaHKLyuSVOUUhQZqa',
    database:           process.env.MYSQLDATABASE || 'railway',
    waitForConnections: true,
    connectionLimit:    10,
    queueLimit:         0,
    connectTimeout:     15000
};

console.log('🔌 DB:', {
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    db:   dbConfig.database,
    hasPass: !!dbConfig.password
});

const pool = mysql.createPool(dbConfig);

// ── HEALTHCHECK ──
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ── DIAGNÓSTICO ──
app.get('/api/ping-db', async (req, res) => {
    try {
        const conn = await pool.getConnection();
        const [rows] = await conn.execute('SELECT 1 AS ok');
        // Checa se tabela existe
        const [tables] = await conn.execute(
            "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'solicitacoes'",
            [dbConfig.database]
        );
        conn.release();
        res.json({
            db: 'ok',
            tabela_solicitacoes: tables.length > 0 ? 'existe' : 'NÃO EXISTE',
            result: rows[0]
        });
    } catch (err) {
        res.status(500).json({ db: 'erro', message: err.message, code: err.code });
    }
});

// ── MIGRAÇÃO AUTOMÁTICA ──
async function runMigrations() {
    try {
        const conn = await pool.getConnection();
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS solicitacoes (
                id               INT NOT NULL AUTO_INCREMENT,
                numero_so        VARCHAR(20)  NOT NULL,
                titulo           VARCHAR(100) NOT NULL,
                cliente_setor    VARCHAR(100) DEFAULT NULL,
                descricao        TEXT         NOT NULL,
                data_solicitacao DATE         DEFAULT NULL,
                status           VARCHAR(20)  DEFAULT 'nova',
                prioridade       VARCHAR(20)  DEFAULT NULL,
                servico_id       INT          DEFAULT NULL,
                data_criacao     DATETIME     DEFAULT CURRENT_TIMESTAMP,
                data_atualizacao DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY unique_numero_so (numero_so),
                KEY idx_sol_status  (status),
                KEY idx_sol_numero  (numero_so),
                KEY idx_sol_criacao (data_criacao)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        conn.release();
        console.log('✅ Migração OK — tabela solicitacoes pronta');
    } catch (err) {
        console.error('⚠️  Migração falhou:', err.message);
    }
}

// ── CRIAR SOLICITAÇÃO ──
app.post('/api/solicitacoes', async (req, res) => {
    console.log('📥 POST /api/solicitacoes body:', JSON.stringify(req.body));
    const { numero_so, titulo, cliente_setor, descricao, data_solicitacao } = req.body;

    if (!titulo || !descricao || !numero_so) {
        return res.status(400).json({ error: 'Campos obrigatórios faltando', received: { numero_so, titulo, descricao } });
    }

    try {
        const conn = await pool.getConnection();

        // Verifica duplicidade
        const [existe] = await conn.execute(
            'SELECT id FROM solicitacoes WHERE numero_so = ?', [numero_so]
        );
        if (existe.length > 0) {
            conn.release();
            return res.status(409).json({ error: 'Número S.O. já utilizado. Recarregue e tente novamente.' });
        }

        await conn.execute(
            `INSERT INTO solicitacoes (numero_so, titulo, cliente_setor, descricao, data_solicitacao, status)
             VALUES (?, ?, ?, ?, ?, 'nova')`,
            [numero_so, titulo, cliente_setor || '', descricao, data_solicitacao || null]
        );
        conn.release();

        console.log('✅ Solicitação criada:', numero_so);
        res.status(201).json({ success: true, numero_so });

    } catch (err) {
        console.error('❌ Erro ao inserir solicitação:', err.message, err.code);
        res.status(500).json({
            error: 'Erro ao registrar solicitação',
            detail: err.message,
            code: err.code
        });
    }
});

// ── ESTÁTICOS + FALLBACK ──
app.use(express.static(path.join(__dirname)));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// ── INICIAR ──
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`🌐 Portal Público na porta ${PORT}`);
    try {
        const conn = await pool.getConnection();
        console.log('✅ MySQL conectado!');
        conn.release();
        await runMigrations();
    } catch (err) {
        console.error('⚠️  MySQL falhou na inicialização:', err.message);
        console.error('   Verifique MYSQLHOST, MYSQLPASSWORD, MYSQLDATABASE nas variáveis do Railway.');
    }
});
