require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const app = express();

const port = process.env.PORT || 3000;
const mongoURI = process.env.MONGO_URI;
const ADMIN_PASSWORD = process.env.ADMIN_PASS || "admin123"; // SENHA PADRÃO: admin123 (Mude no .env)

// Conectar ao MongoDB
if (!mongoURI) {
    console.error("❌ ERRO: A variável MONGO_URI não está definida.");
} else {
    mongoose.connect(mongoURI)
        .then(() => console.log('✅ MongoDB Conectado!'))
        .catch(err => console.error('❌ Erro MongoDB:', err));
}

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// --- MIDDLEWARE DE SEGURANÇA ---
const checkAuth = (req, res, next) => {
    const auth = req.headers['authorization'];
    if (auth === ADMIN_PASSWORD) {
        next();
    } else {
        res.status(401).json({ erro: 'Senha incorreta ou acesso não autorizado.' });
    }
};

// --- MODELOS ---
const ReciboSchema = new mongoose.Schema({
    nome: String, cpf: String, rg: String, endereco: String,
    modelo: String, imei: String, valor: String, estado: String,
    assinatura: String,
    dataCriacao: { type: Date, default: Date.now },
    dataFormatada: String, horaFormatada: String
});
const Recibo = mongoose.model('Recibo', ReciboSchema);

const PrecoSchema = new mongoose.Schema({
    marca: String, modelo: String,
    servico: String, compraBloq: String, compraOk: String
});
const Preco = mongoose.model('Preco', PrecoSchema);

const FinanceiroSchema = new mongoose.Schema({
    tipo: String, // 'entrada' ou 'saida'
    categoria: String, // 'Venda', 'Compra', 'Serviço'
    descricao: String,
    valor: Number,
    data: { type: Date, default: Date.now },
    dataFormatada: String
});
const Financeiro = mongoose.model('Financeiro', FinanceiroSchema);

// --- ROTAS DA API ---

// ROTA DE LOGIN
app.post('/api/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        res.json({ success: true, token: password });
    } else {
        res.status(401).json({ success: false });
    }
});

// 1. RECIBOS (Protegido)
app.post('/api/recibos', checkAuth, async (req, res) => {
    try {
        const novo = new Recibo(req.body);
        const salvo = await novo.save();
        
        // Opcional: Lançar automaticamente no financeiro se for compra
        // Mas vamos deixar o front-end decidir isso para ter mais controle
        
        res.status(201).json(salvo);
    } catch (e) { res.status(500).json({ erro: e.message }); }
});

app.get('/api/recibos', checkAuth, async (req, res) => {
    try {
        const lista = await Recibo.find().sort({ dataCriacao: -1 });
        res.json(lista);
    } catch (e) { res.status(500).json({ erro: e.message }); }
});

app.get('/api/recibos/:id', checkAuth, async (req, res) => {
    try {
        const item = await Recibo.findById(req.params.id);
        res.json(item);
    } catch (e) { res.status(500).json({ erro: e.message }); }
});

app.delete('/api/recibos/:id', checkAuth, async (req, res) => {
    try {
        await Recibo.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Deletado' });
    } catch (e) { res.status(500).json({ erro: e.message }); }
});

// 2. PREÇOS (Protegido - Substitui lista fixa)
app.get('/api/precos', async (req, res) => { // Público para busca na home se quiser, ou protegido
    const lista = await Preco.find().sort({ marca: 1, modelo: 1 });
    res.json(lista);
});
app.post('/api/precos', checkAuth, async (req, res) => {
    try {
        const novo = new Preco(req.body);
        await novo.save();
        res.status(201).json(novo);
    } catch (e) { res.status(500).json({ erro: e.message }); }
});
app.delete('/api/precos/:id', checkAuth, async (req, res) => {
    await Preco.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Deletado' });
});

// 3. FINANCEIRO (Novo - Protegido)
app.get('/api/financeiro', checkAuth, async (req, res) => {
    try {
        const lancamentos = await Financeiro.find().sort({ data: -1 });
        res.json(lancamentos);
    } catch (e) { res.status(500).json({ erro: e.message }); }
});

app.post('/api/financeiro', checkAuth, async (req, res) => {
    try {
        const novo = new Financeiro(req.body);
        await novo.save();
        res.status(201).json(novo);
    } catch (e) { res.status(500).json({ erro: e.message }); }
});

app.delete('/api/financeiro/:id', checkAuth, async (req, res) => {
    await Financeiro.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Deletado' });
});

// Front-end
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html')); // Rota amigável
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
    console.log(`🚀 Servidor rodando na porta ${port}`);
});
