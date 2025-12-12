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
const JWT_SECRET = process.env.JWT_SECRET || 'segredo_nexus_digital_2025';

// --- CONEXÃO MONGODB ---
if (!mongoURI) {
    console.error("❌ ERRO: A variável MONGO_URI não está definida.");
} else {
    mongoose.connect(mongoURI)
        .then(() => {
            console.log('✅ MongoDB Conectado!');
            criarAdminPadrao();
        })
        .catch(err => console.error('❌ Erro Mongo:', err));
}

// --- MIDDLEWARES ---
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// --- MODELOS (SCHEMAS) ---

// 1. Usuário (Admin)
const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true }
});
const User = mongoose.model('User', UserSchema);

// 2. Recibo (Original)
const ReciboSchema = new mongoose.Schema({
    nome: String,
    cpf: String,
    rg: String,
    endereco: String,
    modelo: String,
    imei: String,
    valor: String,
    estado: String,
    assinatura: String,
    dataCriacao: { type: Date, default: Date.now },
    dataFormatada: String,
    horaFormatada: String
});
const Recibo = mongoose.model('Recibo', ReciboSchema);

// 3. Financeiro (Novo)
const FinanceiroSchema = new mongoose.Schema({
    tipo: { type: String, enum: ['entrada', 'saida'], required: true },
    descricao: { type: String, required: true },
    valor: { type: Number, required: true },
    categoria: String,
    data: { type: Date, default: Date.now },
    dataFormatada: String
});
const Financeiro = mongoose.model('Financeiro', FinanceiroSchema);

// --- FUNÇÕES AUXILIARES ---

async function criarAdminPadrao() {
    const adminExiste = await User.findOne({ username: 'admin' });
    if (!adminExiste) {
        const hash = await bcrypt.hash('admin123', 10);
        await User.create({ username: 'admin', password: hash });
        console.log('🔐 Usuário ADMIN criado: admin / admin123');
    }
}

// Middleware de Autenticação
const authMiddleware = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ erro: 'Não autorizado' });

    try {
        jwt.verify(token, JWT_SECRET);
        next();
    } catch (e) {
        res.status(401).json({ erro: 'Token inválido' });
    }
};

// --- ROTAS DE AUTENTICAÇÃO ---

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ erro: 'Credenciais inválidas' });
    }

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '8h' });
    res.cookie('token', token, { httpOnly: true, maxAge: 8 * 3600000 }); // 8 horas
    res.json({ mensagem: 'Logado com sucesso' });
});

app.post('/api/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ mensagem: 'Logout realizado' });
});

app.get('/api/check-auth', (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ logado: false });
    try {
        jwt.verify(token, JWT_SECRET);
        res.json({ logado: true });
    } catch {
        res.status(401).json({ logado: false });
    }
});

// --- ROTAS FINANCEIRO ---

app.post('/api/financeiro', authMiddleware, async (req, res) => {
    try {
        const novoLancamento = new Financeiro(req.body);
        await novoLancamento.save();
        res.status(201).json(novoLancamento);
    } catch (e) { res.status(500).json({ erro: e.message }); }
});

app.get('/api/financeiro', authMiddleware, async (req, res) => {
    try {
        const lancamentos = await Financeiro.find().sort({ data: -1 });
        res.json(lancamentos);
    } catch (e) { res.status(500).json({ erro: e.message }); }
});

app.delete('/api/financeiro/:id', authMiddleware, async (req, res) => {
    try {
        await Financeiro.findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ erro: e.message }); }
});

// --- ROTAS RECIBOS (AGORA PROTEGIDAS) ---

app.post('/api/recibos', authMiddleware, async (req, res) => {
    try {
        const novoRecibo = new Recibo(req.body);
        const salvo = await novoRecibo.save();
        res.status(201).json(salvo);
    } catch (error) { res.status(500).json({ erro: 'Erro ao salvar', detalhe: error.message }); }
});

app.get('/api/recibos', authMiddleware, async (req, res) => {
    try {
        const recibos = await Recibo.find({}, 'nome modelo valor dataFormatada _id').sort({ dataCriacao: -1 });
        res.json(recibos);
    } catch (error) { res.status(500).json({ erro: 'Erro ao listar' }); }
});

app.get('/api/recibos/:id', authMiddleware, async (req, res) => {
    try {
        const recibo = await Recibo.findById(req.params.id);
        if (!recibo) return res.status(404).json({ erro: 'Recibo não encontrado' });
        res.json(recibo);
    } catch (error) { res.status(500).json({ erro: 'Erro ao buscar' }); }
});

app.delete('/api/recibos/:id', authMiddleware, async (req, res) => {
    try {
        await Recibo.findByIdAndDelete(req.params.id);
        res.json({ mensagem: 'Deletado com sucesso' });
    } catch (error) { res.status(500).json({ erro: 'Erro ao deletar' }); }
});

// Front-end padrão
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
    console.log(`🚀 Servidor rodando na porta ${port}`);
});
