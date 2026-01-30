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

// Aumentando limite para suportar imagens base64 (assinaturas grandes)
app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// --- MODELOS (SCHEMAS) ---

const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true }
});
const User = mongoose.model('User', UserSchema);

const ReciboSchema = new mongoose.Schema({
    tipoOperacao: { type: String, default: 'venda' }, // 'compra' ou 'venda'
    nome: String,
    cpf: String,
    rg: String,
    endereco: String,
    modelo: String,
    imei: String,
    valor: String,
    estado: String,
    assinatura: String, // Imagem Base64
    dataCriacao: { type: Date, default: Date.now },
    dataFormatada: String,
    horaFormatada: String
});
const Recibo = mongoose.model('Recibo', ReciboSchema);

const FinanceiroSchema = new mongoose.Schema({
    tipo: { type: String, enum: ['entrada', 'saida'], required: true },
    descricao: { type: String, required: true },
    valor: { type: Number, required: true },
    data: { type: Date, default: Date.now },
    origem: { type: String, default: 'manual' } // 'manual', 'recibo', 'os'
});
const Financeiro = mongoose.model('Financeiro', FinanceiroSchema);

const OSSchema = new mongoose.Schema({
    cliente: {
        nome: String,
        cpf: String,
        telefone: String,
        endereco: String
    },
    aparelho: {
        modelo: String,
        imei: String,
        senha: String,
        acessorios: String
    },
    checklist: {
        tela: String,
        bateria: String,
        carcaca: String,
        botoes: String,
        cameras: String,
        som: String,
        conectividade: String,
        carregamento: String,
        sensores: String
    },
    servico: String, // Tipo de serviço
    defeitoRelatado: String,
    valor: String, // Valor do Orçamento Inicial
    status: { type: String, default: 'Aberto' }, // Aberto, Concluido
    valorFinal: { type: Number }, // Valor recebido ao concluir
    assinaturaCliente: String, // Imagem Base64
    dataEntrada: { type: Date, default: Date.now },
    numeroOS: { type: Number } // ID curto numérico
});
const OrdemServico = mongoose.model('OrdemServico', OSSchema);


// --- FUNÇÕES AUXILIARES ---
async function criarAdminPadrao() {
    try {
        const adminExiste = await User.findOne({ username: 'admin' });
        if (!adminExiste) {
            const hash = await bcrypt.hash('rafaelRAMOS28', 10);
            await User.create({ username: 'admin', password: hash });
            console.log('🔐 Usuário ADMIN criado: admin / rafaelRAMOS28');
        }
    } catch (e) { console.error("Erro ao criar admin:", e); }
}

const authMiddleware = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ erro: 'Não autorizado' });
    try {
        jwt.verify(token, JWT_SECRET);
        next();
    } catch (e) { res.status(401).json({ erro: 'Token inválido' }); }
};

// --- ROTAS DE AUTENTICAÇÃO ---

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ erro: 'Credenciais inválidas' });
    }
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '24h' });
    res.cookie('token', token, { httpOnly: true });
    res.json({ mensagem: 'Login com sucesso' });
});

app.post('/api/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ mensagem: 'Logout realizado' });
});

app.get('/api/check-auth', authMiddleware, (req, res) => res.sendStatus(200));

// --- ROTAS DE RECIBOS (COM INTEGRAÇÃO FINANCEIRA) ---

app.get('/api/recibos', authMiddleware, async (req, res) => {
    const recibos = await Recibo.find().sort({ dataCriacao: -1 });
    res.json(recibos);
});

app.get('/api/recibos/:id', authMiddleware, async (req, res) => {
    try {
        const recibo = await Recibo.findById(req.params.id);
        res.json(recibo);
    } catch (e) { res.status(500).json({ erro: e.message }); }
});

app.post('/api/recibos', authMiddleware, async (req, res) => {
    try {
        const dados = req.body;
        const novoRecibo = await Recibo.create(dados);

        // LANÇAMENTO AUTOMÁTICO NO FINANCEIRO
        if (dados.valor) {
            // Converte "1.200,00" ou "1200" para number
            const valorNumerico = parseFloat(dados.valor.replace('.', '').replace(',', '.'));
            
            if (!isNaN(valorNumerico) && valorNumerico > 0) {
                // Se for COMPRA, sai dinheiro do caixa. Se for VENDA, entra.
                let tipoFin = 'entrada';
                if (dados.tipoOperacao === 'compra') {
                    tipoFin = 'saida';
                }

                await Financeiro.create({
                    tipo: tipoFin,
                    descricao: `Recibo #${novoRecibo._id.toString().slice(-4)} - ${dados.tipoOperacao.toUpperCase()} - ${dados.modelo}`,
                    valor: valorNumerico,
                    origem: 'recibo'
                });
            }
        }
        res.json(novoRecibo);
    } catch (e) {
        res.status(500).json({ erro: e.message });
    }
});

app.delete('/api/recibos/:id', authMiddleware, async (req, res) => {
    await Recibo.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
});

// --- ROTAS FINANCEIRO ---

app.get('/api/financeiro', authMiddleware, async (req, res) => {
    const fin = await Financeiro.find().sort({ data: -1 });
    res.json(fin);
});

app.post('/api/financeiro', authMiddleware, async (req, res) => {
    const novo = await Financeiro.create(req.body);
    res.json(novo);
});

app.delete('/api/financeiro/:id', authMiddleware, async (req, res) => {
    await Financeiro.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
});

// --- ROTAS ORDEM DE SERVIÇO (OS) ---

// Criar OS
app.post('/api/os', authMiddleware, async (req, res) => {
    try {
        const dados = req.body;
        dados.numeroOS = Date.now(); // Gera um ID único numérico
        const novaOS = await OrdemServico.create(dados);
        res.json(novaOS);
    } catch (e) {
        res.status(500).json({ erro: e.message });
    }
});

// Listar todas as OS
app.get('/api/os', authMiddleware, async (req, res) => {
    const lista = await OrdemServico.find().sort({ dataEntrada: -1 });
    res.json(lista);
});

// Buscar OS Individual
app.get('/api/os/:id', async (req, res) => {
    try {
        const os = await OrdemServico.findById(req.params.id);
        if (!os) return res.status(404).json({ erro: "OS não encontrada" });
        res.json(os);
    } catch (e) { res.status(500).json({ erro: "Erro interno" }); }
});

// Salvar Assinatura
app.put('/api/os/:id/assinar', async (req, res) => {
    try {
        const { assinatura } = req.body;
        await OrdemServico.findByIdAndUpdate(req.params.id, { assinaturaCliente: assinatura });
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ erro: "Erro ao salvar assinatura" }); }
});

// CONCLUIR OS E LANÇAR NO CAIXA
app.post('/api/os/:id/concluir', authMiddleware, async (req, res) => {
    try {
        const { valorFinal } = req.body;
        
        // Atualiza status e valor final na OS
        const os = await OrdemServico.findByIdAndUpdate(req.params.id, { 
            status: 'Concluido', 
            valorFinal: valorFinal 
        }, { new: true });

        // Lança entrada no Financeiro se houver valor
        if (valorFinal && valorFinal > 0) {
            await Financeiro.create({
                tipo: 'entrada',
                descricao: `Serviço OS #${os.numeroOS.toString().slice(-4)} - ${os.aparelho.modelo}`,
                valor: parseFloat(valorFinal),
                origem: 'os'
            });
        }
        
        res.json(os);
    } catch (e) { res.status(500).json({ erro: "Erro ao concluir OS" }); }
});

// Deletar OS
app.delete('/api/os/:id', authMiddleware, async (req, res) => {
    await OrdemServico.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
});

app.listen(port, () => {
    console.log(`🚀 Servidor rodando na porta ${port}`);
});
