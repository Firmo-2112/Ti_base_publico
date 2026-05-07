// ==========================================
// PORTAL PÚBLICO — server_pub.js
// Node.js + Express + MySQL (Railway)
// Repositório SEPARADO do sistema interno
// ==========================================

const express = require('express');
const mysql   = require('mysql2/promise');
const cors    = require('cors');
const path    = require('path');

const app = express();
app.use(express.json());
app.use(cors());

// Anti-cache para JS/CSS
app.use((req, res, next) => {
    if (req.path.endsWith('.js') || req.path.endsWith('.css')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
    next();
});

// ── BANCO DE DADOS (mesmo do sistema interno) ──
const pool = mysql.createPool({
    host:             process.env.MYSQLHOST     || 'mysql.railway.internal',
    port:             parseInt(process.env.MYSQLPORT) || 3306,
    user:             process.env.MYSQLUSER     || 'root',
    password:         process.env.MYSQLPASSWORD || '',
    database:         process.env.MYSQLDATABASE || 'railway',
    waitForConnections: true,
    connectionLimit:  10,
    queueLimit:       0
});

// ── HEALTHCHECK ──
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

// ==========================================
// GERAR PRÓXIMO NÚMERO S.O.
// Formato: "000001/2026"
// ==========================================
app.get('/api/solicitacoes/proximo-numero', async (req, res) => {
    try {
        const ano = new Date().getFullYear();
        // Busca o maior número sequencial do ano atual
        const [rows] = await pool.execute(
            `SELECT numero_so FROM solicitacoes
             WHERE numero_so LIKE ?
             ORDER BY id DESC LIMIT 1`,
            [`%/${ano}`]
        );

        let proximo = 1;
        if (rows.length > 0) {
            const ultimo = rows[0].numero_so; // ex: "000042/2026"
            const seq = parseInt(ultimo.split('/')[0]);
            if (!isNaN(seq)) proximo = seq + 1;
        }

        const numero = String(proximo).padStart(6, '0') + '/' + ano;
        res.json({ numero });
    } catch (err) {
        console.error('Erro ao gerar número SO:', err);
        res.status(500).json({ error: 'Erro ao gerar número' });
    }
});

// ==========================================
// CRIAR SOLICITAÇÃO (público — sem auth)
// ==========================================
app.post('/api/solicitacoes', async (req, res) => {
    const { numero_so, titulo, cliente_setor, descricao, data_solicitacao } = req.body;

    if (!titulo || !descricao) {
        return res.status(400).json({ error: 'Título e descrição são obrigatórios' });
    }
    if (!numero_so) {
        return res.status(400).json({ error: 'Número S.O. é obrigatório' });
    }

    try {
        // Checar duplicidade de número (race condition)
        const [existe] = await pool.execute(
            'SELECT id FROM solicitacoes WHERE numero_so = ?', [numero_so]
        );
        if (existe.length > 0) {
            return res.status(409).json({ error: 'Número S.O. já utilizado. Tente novamente.' });
        }

        await pool.execute(
            `INSERT INTO solicitacoes (numero_so, titulo, cliente_setor, descricao, data_solicitacao, status)
             VALUES (?, ?, ?, ?, ?, 'nova')`,
            [numero_so, titulo, cliente_setor || '', descricao, data_solicitacao || null]
        );
        res.status(201).json({ success: true, numero_so });
    } catch (err) {
        console.error('Erro ao criar solicitação:', err);
        res.status(500).json({ error: 'Erro ao registrar solicitação' });
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
                KEY idx_sol_status (status),
                KEY idx_sol_numero (numero_so),
                KEY idx_sol_criacao (data_criacao)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        conn.release();
        console.log('✅ Migrações executadas com sucesso');
    } catch (err) {
        console.error('⚠️  Erro nas migrações:', err.message);
    }
}

// ── ARQUIVOS ESTÁTICOS + FALLBACK ──
app.use(express.static(path.join(__dirname)));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index_pub.html')));

// ── INICIAR ──
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`🌐 Portal Público rodando na porta ${PORT}`);
    try {
        const conn = await pool.getConnection();
        console.log('✅ MySQL conectado');
        conn.release();
        await runMigrations();
    } catch (err) {
        console.error('⚠️  MySQL indisponível:', err.message);
    }
});
