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

// ── ARQUIVOS ESTÁTICOS + FALLBACK ──
app.use(express.static(path.join(__dirname)));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// ── INICIAR ──
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Portal Público rodando na porta ${PORT}`);
    pool.getConnection()
        .then(conn => { console.log('✅ MySQL conectado'); conn.release(); })
        .catch(err  => console.error('⚠️  MySQL indisponível:', err.message));
});
