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
    console.error("❌ ERRO: A variável MONGO_URI não está definida.");
} else {
    mongoose.connect(mongoURI)
        .then(() => {
            console.log('✅ MongoDB Conectado com Sucesso!');
            criarAdminPadrao();
        })
        .catch(err => console.error('❌ Erro de Conexão MongoDB:', err));
}

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// --- MODELOS (MANTIDOS ORIGINAIS + NOVO OS) ---

const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true }
});
const User = mongoose.model('User', UserSchema);

const ReciboSchema = new mongoose.Schema({
    nome: String, cpf: String, rg: String, endereco: String,
    modelo: String, imei: String, valor: String, estado: String,
    assinatura: String,
    dataCriacao: { type: Date, default: Date.now },
    dataFormatada: String, horaFormatada: String
});
const Recibo = mongoose.model('Recibo', ReciboSchema);

const FinanceiroSchema = new mongoose.Schema({
    tipo: { type: String, enum: ['entrada', 'saida'], required: true },
    descricao: { type: String, required: true },
    valor: { type: Number, required: true },
    data: { type: Date, default: Date.now }
});
const Financeiro = mongoose.model('Financeiro', FinanceiroSchema);

// --- NOVO MODELO: ORDEM DE SERVIÇO (OS) ---
const OSSchema = new mongoose.Schema({
    osNumber: { type: String, unique: true },
    cliente: { nome: String, telefone: String },
    aparelho: { modelo: String, imei: String, senha: String, acessorios: String },
    checklist: {
        liga: Boolean, tela: Boolean, touch: Boolean, 
        camera: Boolean, audio: Boolean, carga: Boolean, obs: String
    },
    servico: { defeitoRelatado: String, status: { type: String, default: 'Aberto' } },
    financeiro: {
        custoPecas: Number, maoDeObra: Number, desconto: Number, 
        sinal: Number, total: Number, statusPagamento: { type: String, default: 'Pendente' }
    },
    assinaturaCliente: String,
    dataEntrada: { type: Date, default: Date.now },
    dataSaida: Date
});
const OS = mongoose.model('OrdemServico', OSSchema);

// --- MIDDLEWARES ---
const authMiddleware = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ erro: 'Não autorizado' });
    try { jwt.verify(token, JWT_SECRET); next(); } 
    catch (e) { res.status(401).json({ erro: 'Token inválido' }); }
};

// --- ROTAS (API) ---

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ erro: 'Credenciais inválidas' });
    }
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '12h' });
    res.cookie('token', token, { httpOnly: true, maxAge: 12 * 3600000 });
    res.json({ mensagem: 'Login sucesso' });
});

app.post('/api/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ mensagem: 'Logout realizado' });
});

app.get('/api/check-auth', authMiddleware, (req, res) => res.sendStatus(200));

// RECIBOS (Mantido)
app.get('/api/recibos', authMiddleware, async (req, res) => {
    const r = await Recibo.find().sort({ dataCriacao: -1 }).limit(100); res.json(r);
});
app.post('/api/recibos', authMiddleware, async (req, res) => {
    const n = await Recibo.create(req.body);
    // Lança saída no financeiro automático
    if(n.valor) await Financeiro.create({ tipo: 'saida', descricao: `Compra: ${n.modelo}`, valor: parseFloat(n.valor.replace(',','.')) });
    res.json(n);
});
app.delete('/api/recibos/:id', authMiddleware, async (req, res) => {
    await Recibo.findByIdAndDelete(req.params.id); res.json({ok:true});
});

// FINANCEIRO (Mantido)
app.get('/api/financeiro', authMiddleware, async (req, res) => {
    const f = await Financeiro.find().sort({ data: -1 }).limit(200); res.json(f);
});
app.post('/api/financeiro', authMiddleware, async (req, res) => {
    res.json(await Financeiro.create(req.body));
});
app.delete('/api/financeiro/:id', authMiddleware, async (req, res) => {
    await Financeiro.findByIdAndDelete(req.params.id); res.json({ok:true});
});

// ORDEM DE SERVIÇO (Novo)
app.get('/api/os', authMiddleware, async (req, res) => {
    res.json(await OS.find().sort({ dataEntrada: -1 }));
});
app.get('/api/os/:id', async (req, res) => {
    res.json(await OS.findById(req.params.id));
});
app.post('/api/os', authMiddleware, async (req, res) => {
    const num = Date.now().toString().slice(-6);
    const nova = await OS.create({ ...req.body, osNumber: num });
    // Lança sinal no financeiro
    if(req.body.financeiro.sinal > 0) {
        await Financeiro.create({ tipo: 'entrada', descricao: `Sinal OS #${num}`, valor: req.body.financeiro.sinal });
    }
    res.json(nova);
});
app.put('/api/os/:id', async (req, res) => {
    res.json(await OS.findByIdAndUpdate(req.params.id, req.body, {new:true}));
});
app.delete('/api/os/:id', authMiddleware, async (req, res) => {
    await OS.findByIdAndDelete(req.params.id); res.json({ok:true});
});

// Inicialização
async function criarAdminPadrao() {
    if (!await User.findOne({ username: 'admin' })) {
        await User.create({ username: 'admin', password: await bcrypt.hash('rafaelRAMOS28', 10) });
    }
}

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(port, () => console.log(`🚀 Rodando na porta ${port}`));
