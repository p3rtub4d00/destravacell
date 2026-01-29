require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const port = process.env.PORT || 3000;
const mongoURI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'segredo_nexus_digital_2025_safe_key';

// --- CONEXÃO MONGODB ---
if (!mongoURI) {
    console.error("❌ ERRO: A variável MONGO_URI não está definida no Render.");
} else {
    mongoose.connect(mongoURI)
        .then(() => {
            console.log('✅ MongoDB Conectado com Sucesso!');
            criarAdminPadrao();
        })
        .catch(err => console.error('❌ Erro de Conexão MongoDB:', err));
}

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// --- MODELOS (SCHEMAS) ---

// 1. Usuário Admin
const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true }
});
const User = mongoose.model('User', UserSchema);

// 2. Recibo de Compra
const ReciboSchema = new mongoose.Schema({
    nome: String, cpf: String, rg: String, endereco: String,
    modelo: String, imei: String, valor: String, estado: String,
    assinatura: String,
    dataCriacao: { type: Date, default: Date.now },
    dataFormatada: String, horaFormatada: String
});
const Recibo = mongoose.model('Recibo', ReciboSchema);

// 3. Financeiro
const FinanceiroSchema = new mongoose.Schema({
    tipo: { type: String, enum: ['entrada', 'saida'], required: true },
    descricao: { type: String, required: true },
    valor: { type: Number, required: true },
    data: { type: Date, default: Date.now }
});
const Financeiro = mongoose.model('Financeiro', FinanceiroSchema);

// 4. ORDEM DE SERVIÇO (ATUALIZADO)
const OSSchema = new mongoose.Schema({
    osNumber: { type: String, unique: true }, 
    cliente: { 
        nome: String, telefone: String, cpf: String 
    },
    aparelho: { 
        marca: String, modelo: String, imei: String, 
        senha: String, acessorios: String 
    },
    checklist: {
        liga: Boolean, tela: Boolean, touch: Boolean, 
        camera: Boolean, audio: Boolean, carga: Boolean, 
        wifi: Boolean, biom: Boolean, obs: String
    },
    servico: { 
        defeitoRelatado: String, laudoTecnico: String, 
        status: { type: String, default: 'Aberto' } 
    },
    financeiro: {
        custoPecas: Number, maoDeObra: Number, 
        desconto: Number, sinal: Number, total: Number,
        statusPagamento: { type: String, default: 'Pendente' }
    },
    assinaturaCliente: String, // CAMPO NOVO PARA ASSINATURA
    dataEntrada: { type: Date, default: Date.now },
    dataSaida: Date
});
const OS = mongoose.model('OrdemServico', OSSchema);

// --- MIDDLEWARES ---
const authMiddleware = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ erro: 'Não autorizado' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.id;
        next();
    } catch (e) { res.status(401).json({ erro: 'Token inválido' }); }
};

// --- ROTAS (API) ---

// Auth
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ erro: 'Credenciais inválidas' });
    }
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '8h' });
    res.cookie('token', token, { httpOnly: true, maxAge: 8 * 3600000 });
    res.json({ mensagem: 'Login com sucesso' });
});

app.post('/api/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ mensagem: 'Logout realizado' });
});

app.get('/api/check-auth', authMiddleware, (req, res) => res.sendStatus(200));

// Recibos
app.get('/api/recibos', authMiddleware, async (req, res) => {
    try { const recibos = await Recibo.find().sort({ dataCriacao: -1 }).limit(50); res.json(recibos); } 
    catch (e) { res.status(500).json({ erro: 'Erro' }); }
});
app.post('/api/recibos', authMiddleware, async (req, res) => {
    try { const novo = await Recibo.create(req.body); res.json(novo); } 
    catch (e) { res.status(500).json({ erro: 'Erro' }); }
});
app.delete('/api/recibos/:id', authMiddleware, async (req, res) => {
    try { await Recibo.findByIdAndDelete(req.params.id); res.json({ ok: true }); } 
    catch (e) { res.status(500).json({ erro: 'Erro' }); }
});

// Financeiro
app.get('/api/financeiro', authMiddleware, async (req, res) => {
    try { const lancamentos = await Financeiro.find().sort({ data: -1 }).limit(100); res.json(lancamentos); } 
    catch (e) { res.status(500).json({ erro: 'Erro' }); }
});
app.post('/api/financeiro', authMiddleware, async (req, res) => {
    try { const novo = await Financeiro.create(req.body); res.json(novo); } 
    catch (e) { res.status(500).json({ erro: 'Erro' }); }
});
app.delete('/api/financeiro/:id', authMiddleware, async (req, res) => {
    try { await Financeiro.findByIdAndDelete(req.params.id); res.json({ ok: true }); } 
    catch (e) { res.status(500).json({ erro: 'Erro' }); }
});

// --- ROTAS DE ORDEM DE SERVIÇO ---
app.get('/api/os', authMiddleware, async (req, res) => {
    try { const lista = await OS.find().sort({ dataEntrada: -1 }); res.json(lista); } 
    catch (e) { res.status(500).json({ erro: "Erro" }); }
});

// Buscar uma única OS (para edição ou assinatura)
app.get('/api/os/:id', async (req, res) => {
    // Nota: Removi o authMiddleware dessa rota específica para permitir que 
    // a página de assinatura no celular (pública via QR) acesse os dados básicos se necessário.
    // Em produção real, usaria um token temporário na URL, mas aqui simplificamos.
    try { const os = await OS.findById(req.params.id); res.json(os); } 
    catch (e) { res.status(500).json({ erro: "Erro" }); }
});

app.post('/api/os', authMiddleware, async (req, res) => {
    try {
        const num = Date.now().toString().slice(-6);
        const novaOS = await OS.create({ ...req.body, osNumber: num });
        
        if (req.body.financeiro && req.body.financeiro.sinal > 0) {
            await Financeiro.create({
                tipo: 'entrada',
                descricao: `Sinal OS #${num} - ${req.body.cliente.nome}`,
                valor: req.body.financeiro.sinal
            });
        }
        res.json(novaOS);
    } catch (e) { res.status(500).json({ erro: "Erro" }); }
});

app.put('/api/os/:id', async (req, res) => { // Aberto para receber assinatura do celular
    try {
        const atualizada = await OS.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(atualizada);
    } catch (e) { res.status(500).json({ erro: "Erro" }); }
});

app.delete('/api/os/:id', authMiddleware, async (req, res) => {
    try { await OS.findByIdAndDelete(req.params.id); res.json({ ok: true }); } 
    catch (e) { res.status(500).json({ erro: "Erro" }); }
});

async function criarAdminPadrao() {
    try {
        const adminExiste = await User.findOne({ username: 'admin' });
        if (!adminExiste) {
            const hash = await bcrypt.hash('rafaelRAMOS28', 10);
            await User.create({ username: 'admin', password: hash });
            console.log('🔐 Usuário ADMIN criado.');
        }
    } catch (e) { console.error('Erro criar admin', e); }
}

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => console.log(`🚀 Servidor rodando na porta ${port}`));
