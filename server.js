require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const app = express();

const port = process.env.PORT || 3000;
const mongoURI = process.env.MONGO_URI;

// Conectar ao MongoDB
if (!mongoURI) {
    console.error("❌ ERRO: A variável MONGO_URI não está definida no Render.");
} else {
    mongoose.connect(mongoURI)
        .then(() => console.log('✅ MongoDB Conectado com Sucesso!'))
        .catch(err => console.error('❌ Erro de Conexão MongoDB:', err));
}

app.use(express.json({ limit: '10mb' })); // Limite alto para aceitar assinaturas
app.use(express.static(path.join(__dirname, 'public')));

// --- MODELO ---
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

// --- ROTAS DA API ---

// 1. Salvar Recibo
app.post('/api/recibos', async (req, res) => {
    try {
        const novoRecibo = new Recibo(req.body);
        const salvo = await novoRecibo.save();
        res.status(201).json(salvo);
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao salvar', detalhe: error.message });
    }
});

// 2. Listar Todos (Para a tabela)
app.get('/api/recibos', async (req, res) => {
    try {
        // Traz apenas os campos essenciais para a tabela ficar leve
        const recibos = await Recibo.find({}, 'nome modelo valor dataFormatada _id').sort({ dataCriacao: -1 });
        res.json(recibos);
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao listar' });
    }
});

// 3. Buscar UM Recibo Específico (NOVA ROTA - CRUCIAL PARA O ERRO)
app.get('/api/recibos/:id', async (req, res) => {
    try {
        const recibo = await Recibo.findById(req.params.id);
        if (!recibo) return res.status(404).json({ erro: 'Recibo não encontrado' });
        res.json(recibo);
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao buscar recibo único' });
    }
});

// 4. Deletar Recibo
app.delete('/api/recibos/:id', async (req, res) => {
    try {
        await Recibo.findByIdAndDelete(req.params.id);
        res.json({ mensagem: 'Deletado com sucesso' });
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao deletar' });
    }
});

// Front-end
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
    console.log(`🚀 Servidor rodando na porta ${port}`);
});
