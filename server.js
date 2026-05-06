// ==========================================
// PORTAL PÚBLICO — Solicitação de Serviço
// Node.js + Express + MySQL (Railway)
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

// ==========================================
// BANCO DE DADOS (mesmo do sistema interno)
// ==========================================
const pool = mysql.createPool({
    host:             process.env.MYSQLHOST     || 'mysql.railway.internal',
    port:             parseInt(process.env.MYSQLPORT) || 3306,
    user:             process.env.MYSQLUSER     || 'root',
    password:         process.env.MYSQLPASSWORD || 'OhogquOKFnLPXoQPaHKLyuSVOUUhQZqa',
    database:         process.env.MYSQLDATABASE || 'railway',
    waitForConnections: true,
    connectionLimit:  10,
    queueLimit:       0
});

// ==========================================
// HEALTHCHECK
// ==========================================
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ==========================================
// PRÓXIMO NÚMERO DE S.O.
// ==========================================
app.get('/api/solicitacoes/proximo-numero', async (req, res) => {
    try {
        const ano = new Date().getFullYear();
        const [rows] = await pool.execute(
            'SELECT COUNT(*) as total FROM solicitacoes WHERE YEAR(data_criacao) = ?',
            [ano]
        );
        const proximo = String(rows[0].total + 1).padStart(6, '0');
        res.json({ numero: `${proximo}/${ano}` });
    } catch (err) {
        console.error('Erro ao gerar número SO:', err);
        res.status(500).json({ error: 'Erro ao gerar número' });
    }
});

// ==========================================
// CRIAR SOLICITAÇÃO
// ==========================================
app.post('/api/solicitacoes', async (req, res) => {
    const { titulo, cliente_setor, data_solicitacao, descricao } = req.body;

    if (!titulo || !cliente_setor || !descricao) {
        return res.status(400).json({ error: 'Título, cliente/setor e descrição são obrigatórios.' });
    }

    try {
        const ano = new Date().getFullYear();

        // Gerar número S.O. com lock para evitar duplicatas
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            const [rows] = await conn.execute(
                'SELECT COUNT(*) as total FROM solicitacoes WHERE YEAR(data_criacao) = ? FOR UPDATE',
                [ano]
            );
            const numero = String(rows[0].total + 1).padStart(6, '0');
            const numero_so = `${numero}/${ano}`;

            const [result] = await conn.execute(
                `INSERT INTO solicitacoes
                    (numero_so, titulo, cliente_setor, data_solicitacao, descricao, status)
                 VALUES (?, ?, ?, ?, ?, 'pendente')`,
                [numero_so, titulo, cliente_setor, data_solicitacao || null, descricao]
            );

            await conn.commit();
            conn.release();

            const [newRow] = await pool.execute(
                'SELECT * FROM solicitacoes WHERE id = ?',
                [result.insertId]
            );

            res.status(201).json({ ...newRow[0], numero_so });
        } catch (err) {
            await conn.rollback();
            conn.release();
            throw err;
        }
    } catch (err) {
        console.error('Erro ao criar solicitação:', err);
        res.status(500).json({ error: 'Erro ao registrar solicitação. Tente novamente.' });
    }
});

// ==========================================
// SERVIR FRONTEND
// ==========================================
app.use(express.static(path.join(__dirname)));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ==========================================
// INICIAR
// ==========================================
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Portal Público rodando na porta ${PORT}`);
    pool.getConnection()
        .then(c => { console.log('✅ Banco conectado'); c.release(); })
        .catch(e => console.error('⚠️ Banco indisponível:', e.message));
});
