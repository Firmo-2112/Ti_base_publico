// ==========================================
// PORTAL PÚBLICO — app_pub.js
// ==========================================

// ── MATRIX BACKGROUND ──
const canvas = document.getElementById('matrix');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.height = window.innerHeight;
    canvas.width  = window.innerWidth;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

const letters = '01';
const fontSize = 14;

function drawMatrix() {
    const cols = Math.floor(canvas.width / fontSize);
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#00d4ff';
    ctx.font = fontSize + 'px monospace';
    if (!drawMatrix._drops || drawMatrix._drops.length !== cols) {
        drawMatrix._drops = Array(cols).fill(1);
    }
    const drops = drawMatrix._drops;
    for (let i = 0; i < drops.length; i++) {
        ctx.fillText(letters[Math.floor(Math.random() * 2)], i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
    }
}
setInterval(drawMatrix, 33);

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
        setTimeout(() => removeToast(toast), 6000);
    }
};

function removeToast(toast) {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
}

// ── GERAR NÚMERO S.O. LOCAL (não depende de API) ──
// Gera sequência baseada em timestamp para garantir unicidade
function gerarNumeroSOLocal() {
    const ano = new Date().getFullYear();
    const ts  = Date.now(); // timestamp ms — único por definição
    // Pega os últimos 6 dígitos do timestamp para o número sequencial
    const seq = String(ts).slice(-6);
    return `${seq}/${ano}`;
}

// ── ESTADO GLOBAL ──
let currentSO = '';
const hoje = new Date();
const dataFormatada = hoje.toLocaleDateString('pt-BR');

// ── INIT ──
function init() {
    // Data de hoje
    document.getElementById('solData').value = dataFormatada;

    // Gerar número SO localmente — sem depender da API
    currentSO = gerarNumeroSOLocal();
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
    ['solTitulo', 'solSetor'].forEach(id => {
        document.getElementById(id).addEventListener('input', () => {
            document.getElementById(id).classList.remove('invalid');
            const errId = id === 'solTitulo' ? 'errTitulo' : 'errSetor';
            document.getElementById(errId).classList.remove('visible');
        });
    });

    // Submit
    document.getElementById('solicitacaoForm').addEventListener('submit', handleSubmit);

    // Nova solicitação
    document.getElementById('novaSolBtn').addEventListener('click', () => {
        document.getElementById('successCard').style.display = 'none';
        document.querySelector('.form-card').style.display   = 'block';
        document.getElementById('solicitacaoForm').reset();
        document.getElementById('charCount').textContent     = '0';
        document.getElementById('solData').value             = dataFormatada;
        currentSO = gerarNumeroSOLocal();
        document.getElementById('soDisplay').textContent     = currentSO;
    });
}

// ── VALIDAÇÃO ──
function validateForm() {
    let valid = true;
    const fields = [
        { id: 'solTitulo',    errId: 'errTitulo' },
        { id: 'solSetor',     errId: 'errSetor' },
        { id: 'solDescricao', errId: 'errDescricao' }
    ];
    fields.forEach(({ id, errId }) => {
        const el = document.getElementById(id);
        if (!el.value.trim()) {
            el.classList.add('invalid');
            document.getElementById(errId).classList.add('visible');
            valid = false;
        }
    });
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

    btn.disabled          = true;
    txtNorm.style.display = 'none';
    txtLoad.style.display = 'flex';

    const payload = {
        numero_so:        currentSO,
        titulo:           document.getElementById('solTitulo').value.trim(),
        cliente_setor:    document.getElementById('solSetor').value.trim(),
        descricao:        document.getElementById('solDescricao').value.trim(),
        data_solicitacao: hoje.toISOString().split('T')[0]
    };

    try {
        const res = await fetch('/api/solicitacoes', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(payload)
        });

        let data = {};
        try { data = await res.json(); } catch(_) {}

        if (!res.ok) {
            throw new Error(data.detail || data.error || `Erro ${res.status}`);
        }

        // ── SUCESSO ──
        document.querySelector('.form-card').style.display  = 'none';
        document.getElementById('successCard').style.display = 'block';
        document.getElementById('successSoDisplay').textContent = currentSO;

    } catch (err) {
        console.error('Erro ao enviar:', err);
        Toast.show('Erro: ' + err.message, 'error');
        console.error('Payload enviado:', JSON.stringify(payload));
        console.error('Stack:', err.stack);
    } finally {
        btn.disabled          = false;
        txtNorm.style.display = 'flex';
        txtLoad.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', init);
