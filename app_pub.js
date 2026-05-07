// ==========================================
// PORTAL PÚBLICO — app_pub.js
// Solicitações de Serviço de TI
// ==========================================

// ── MATRIX BACKGROUND ──
const canvas = document.getElementById('matrix');
const ctx = canvas.getContext('2d');
canvas.height = window.innerHeight;
canvas.width  = window.innerWidth;
const letters = '01';
const fontSize = 14;
const columns = canvas.width / fontSize;
const drops = [];
for (let x = 0; x < columns; x++) drops[x] = 1;

function drawMatrix() {
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#00d4ff';
    ctx.font = fontSize + 'px monospace';
    for (let i = 0; i < drops.length; i++) {
        const text = letters[Math.floor(Math.random() * letters.length)];
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
    }
}
setInterval(drawMatrix, 33);

window.addEventListener('resize', () => {
    canvas.height = window.innerHeight;
    canvas.width  = window.innerWidth;
});


const AppState = {
    inventory: [],
    snippets: [],
    services: [],
    solicitacoes: [],
    inventoryActivities: [],
    servicesActivities: [],
    settings: { theme: 'dark' },
    authToken: null
};
// ── API BASE (mesmo domínio Railway) ──
const API = {
    BASE: '',

    headers() {
        return {
            'Content-Type': 'application/json',
            'x-auth-token': AppState.authToken || ''
        };
    },

    async get(path) {
        const res = await fetch(this.BASE + path, { headers: this.headers() });
        if (!res.ok) throw await res.json();
        return res.json();
    },

    async post(path, body) {
        const res = await fetch(this.BASE + path, {
            method: 'POST',
            headers: this.headers(),
            body: JSON.stringify(body)
        });
        if (!res.ok) throw await res.json();
        return res.json();
    },

    async put(path, body) {
        const res = await fetch(this.BASE + path, {
            method: 'PUT',
            headers: this.headers(),
            body: JSON.stringify(body)
        });
        if (!res.ok) throw await res.json();
        return res.json();
    },

    async patch(path, body) {
        const res = await fetch(this.BASE + path, {
            method: 'PATCH',
            headers: this.headers(),
            body: JSON.stringify(body || {})
        });
        if (!res.ok) throw await res.json();
        return res.json();
    },

    async delete(path) {
        const res = await fetch(this.BASE + path, {
            method: 'DELETE',
            headers: this.headers()
        });
        if (!res.ok) throw await res.json();
        return res.json();
    }
};

// ── TOAST ──
const Toast = {
    show(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = 'toast ' + type;
        const icons = {
            success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
            error:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
            info:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
        };
        toast.innerHTML = `<div class="toast-icon">${icons[type]}</div><span class="toast-message">${message}</span><button class="toast-close">&times;</button>`;
        container.appendChild(toast);
        toast.querySelector('.toast-close').addEventListener('click', () => removeToast(toast));
        setTimeout(() => removeToast(toast), 5000);
    }
};

function removeToast(toast) {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
}

// ── GERAR NÚMERO S.O. ──
async function gerarNumeroSO() {
    try {
        const res = await fetch(API_BASE + '/api/solicitacoes/proximo-numero');
        if (!res.ok) throw new Error();
        const data = await res.json();
        return data.numero;
    } catch (e) {
        // Fallback local: 6 dígitos aleatórios + ano
        const ano = new Date().getFullYear();
        const num = String(Math.floor(Math.random() * 999999) + 1).padStart(6, '0');
        return `${num}/${ano}`;
    }
}

// ── INIT ──
let currentSO = '';

async function init() {
    // Data de hoje
    const hoje = new Date();
    const dataFormatada = hoje.toLocaleDateString('pt-BR');
    document.getElementById('solData').value = dataFormatada;

    // Gerar número SO
    document.getElementById('soDisplay').textContent = 'Gerando...';
    currentSO = await gerarNumeroSO();
    document.getElementById('soDisplay').textContent = currentSO;

    // Contador de caracteres
    const textarea = document.getElementById('solDescricao');
    textarea.addEventListener('input', () => {
        document.getElementById('charCount').textContent = textarea.value.length;
        if (textarea.value.length > 0) {
            textarea.classList.remove('invalid');
            document.getElementById('errDescricao').classList.remove('visible');
        }
    });

    // Limpar erros ao digitar
    document.getElementById('solTitulo').addEventListener('input', () => {
        document.getElementById('solTitulo').classList.remove('invalid');
        document.getElementById('errTitulo').classList.remove('visible');
    });
    document.getElementById('solSetor').addEventListener('input', () => {
        document.getElementById('solSetor').classList.remove('invalid');
        document.getElementById('errSetor').classList.remove('visible');
    });

    // Submit
    document.getElementById('solicitacaoForm').addEventListener('submit', handleSubmit);

    // Nova solicitação
    document.getElementById('novaSolBtn').addEventListener('click', async () => {
        document.getElementById('successCard').style.display = 'none';
        document.getElementById('solicitacaoForm').parentElement.style.display = 'block';
        document.getElementById('solicitacaoForm').reset();
        document.getElementById('charCount').textContent = '0';
        document.getElementById('solData').value = dataFormatada;

        // Gerar novo número
        document.getElementById('soDisplay').textContent = 'Gerando...';
        currentSO = await gerarNumeroSO();
        document.getElementById('soDisplay').textContent = currentSO;
    });
}

// ── VALIDAÇÃO ──
function validateForm() {
    let valid = true;

    const titulo = document.getElementById('solTitulo');
    const setor  = document.getElementById('solSetor');
    const desc   = document.getElementById('solDescricao');

    if (!titulo.value.trim()) {
        titulo.classList.add('invalid');
        document.getElementById('errTitulo').classList.add('visible');
        valid = false;
    }
    if (!setor.value.trim()) {
        setor.classList.add('invalid');
        document.getElementById('errSetor').classList.add('visible');
        valid = false;
    }
    if (!desc.value.trim()) {
        desc.classList.add('invalid');
        document.getElementById('errDescricao').classList.add('visible');
        valid = false;
    }

    return valid;
}

// ── SUBMIT ──
async function handleSubmit(e) {
    e.preventDefault();
    if (!validateForm()) {
        Toast.show('Preencha todos os campos obrigatórios!', 'error');
        return;
    }

    const btn     = document.getElementById('submitBtn');
    const txtNorm = btn.querySelector('.submit-btn__text');
    const txtLoad = btn.querySelector('.submit-btn__loading');

    btn.disabled    = true;
    txtNorm.style.display = 'none';
    txtLoad.style.display = 'flex';

    const payload = {
        numero_so:    currentSO,
        titulo:       document.getElementById('solTitulo').value.trim(),
        cliente_setor: document.getElementById('solSetor').value.trim(),
        descricao:    document.getElementById('solDescricao').value.trim(),
        data_solicitacao: new Date().toISOString().split('T')[0]
    };

    try {
        const res = await fetch(API_BASE + '/api/solicitacoes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Erro ao enviar');
        }

        // Sucesso
        document.getElementById('solicitacaoForm').parentElement.querySelector('.form-card').style.display = 'none';
        const successCard = document.getElementById('successCard');
        successCard.style.display = 'block';
        document.getElementById('successSoDisplay').textContent = currentSO;

    } catch (err) {
        Toast.show('Erro ao enviar solicitação. Tente novamente.', 'error');
        console.error(err);
    } finally {
        btn.disabled    = false;
        txtNorm.style.display = 'flex';
        txtLoad.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', init);
