require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const app = express();

const port = process.env.PORT || 3000;
const mongoURI = process.env.MONGO_URI;
const ADMIN_PASSWORD = process.env.ADMIN_PASS || "admin123";

// Conectar ao MongoDB
if (!mongoURI) {
    console.error("❌ ERRO: MONGO_URI não definida.");
} else {
    mongoose.connect(mongoURI)
        .then(() => {
            console.log('✅ MongoDB Conectado!');
            seedPrecos(); // <--- RODA A VARREDURA AUTOMÁTICA AO INICIAR
        })
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
        res.status(401).json({ erro: 'Acesso negado.' });
    }
};

// --- MODELOS ---
const Recibo = mongoose.model('Recibo', new mongoose.Schema({
    nome: String, cpf: String, rg: String, endereco: String,
    modelo: String, imei: String, valor: String, estado: String,
    assinatura: String,
    dataCriacao: { type: Date, default: Date.now },
    dataFormatada: String, horaFormatada: String
}));

const Preco = mongoose.model('Preco', new mongoose.Schema({
    marca: String, modelo: String,
    servico: String, compraBloq: String, compraOk: String
}));

const Financeiro = mongoose.model('Financeiro', new mongoose.Schema({
    tipo: String, categoria: String, descricao: String,
    valor: Number, data: { type: Date, default: Date.now }, dataFormatada: String
}));

// --- ROTAS DA API ---

// Login
app.post('/api/login', (req, res) => {
    if (req.body.password === ADMIN_PASSWORD) res.json({ success: true, token: req.body.password });
    else res.status(401).json({ success: false });
});

// Recibos
app.post('/api/recibos', checkAuth, async (req, res) => {
    try {
        const novo = new Recibo(req.body);
        res.status(201).json(await novo.save());
    } catch (e) { res.status(500).json({ erro: e.message }); }
});
app.get('/api/recibos', checkAuth, async (req, res) => {
    res.json(await Recibo.find().sort({ dataCriacao: -1 }));
});
app.delete('/api/recibos/:id', checkAuth, async (req, res) => {
    await Recibo.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Deletado' });
});

// Financeiro
app.get('/api/financeiro', checkAuth, async (req, res) => {
    res.json(await Financeiro.find().sort({ data: -1 }));
});
app.post('/api/financeiro', checkAuth, async (req, res) => {
    const novo = new Financeiro(req.body);
    res.status(201).json(await novo.save());
});
app.delete('/api/financeiro/:id', checkAuth, async (req, res) => {
    await Financeiro.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Deletado' });
});

// Preços
app.get('/api/precos', async (req, res) => {
    res.json(await Preco.find().sort({ marca: 1, modelo: 1 }));
});
app.post('/api/precos', checkAuth, async (req, res) => {
    const novo = new Preco(req.body);
    res.status(201).json(await novo.save());
});
app.delete('/api/precos/:id', checkAuth, async (req, res) => {
    await Preco.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Deletado' });
});

// Front-end
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(port, () => console.log(`🚀 Servidor rodando na porta ${port}`));

// === FUNÇÃO DE "VARREDURA" E POPULAÇÃO DO BANCO ===
// Se o banco estiver vazio, ele preenche com essa lista automaticamente.
async function seedPrecos() {
    const count = await Preco.countDocuments();
    if (count > 0) return; // Já tem dados, não faz nada.

    console.log("🔄 Banco de Preços vazio. Iniciando varredura e preenchimento automático...");
    
    // REGRA DE PREÇO: Custo Servidor = 50.
    // Serviço = 50 + Lucro (Min 70 a Max 350)
    
    const listaMestra = [
        // --- SAMSUNG (2020-2025) ---
        // Linha S (Premium)
        { m: "Samsung", mod: "Galaxy S25 Ultra (Lançamento)", serv: "450", blq: "3500", ok: "6500" },
        { m: "Samsung", mod: "Galaxy S25 / S25+", serv: "400", blq: "2500", ok: "4800" },
        { m: "Samsung", mod: "Galaxy S24 Ultra", serv: "400", blq: "2200", ok: "4500" },
        { m: "Samsung", mod: "Galaxy S24 / S24+", serv: "350", blq: "1800", ok: "3200" },
        { m: "Samsung", mod: "Galaxy S23 Ultra", serv: "350", blq: "1500", ok: "2800" },
        { m: "Samsung", mod: "Galaxy S23 FE", serv: "250", blq: "1000", ok: "1900" },
        { m: "Samsung", mod: "Galaxy S22 Ultra", serv: "300", blq: "1100", ok: "2100" },
        { m: "Samsung", mod: "Galaxy S21 FE", serv: "200", blq: "600", ok: "1200" },
        { m: "Samsung", mod: "Galaxy S20 FE", serv: "150", blq: "400", ok: "850" },
        { m: "Samsung", mod: "Z Fold 6 / 7", serv: "500", blq: "3000", ok: "7000" },
        { m: "Samsung", mod: "Z Flip 6 / 7", serv: "400", blq: "1500", ok: "3500" },

        // Linha A (Intermediários - Custo 50 + Lucro médio 100-150)
        { m: "Samsung", mod: "Galaxy A56 5G (Novo)", serv: "250", blq: "900", ok: "1800" },
        { m: "Samsung", mod: "Galaxy A55 5G", serv: "220", blq: "700", ok: "1500" },
        { m: "Samsung", mod: "Galaxy A54 5G", serv: "200", blq: "550", ok: "1200" },
        { m: "Samsung", mod: "Galaxy A36 5G (Novo)", serv: "220", blq: "700", ok: "1400" },
        { m: "Samsung", mod: "Galaxy A35 5G", serv: "180", blq: "500", ok: "1100" },
        { m: "Samsung", mod: "Galaxy A34 5G", serv: "160", blq: "400", ok: "900" },
        { m: "Samsung", mod: "Galaxy A26 (Novo)", serv: "180", blq: "500", ok: "1100" },
        { m: "Samsung", mod: "Galaxy A25 5G", serv: "160", blq: "400", ok: "900" },
        { m: "Samsung", mod: "Galaxy A16 5G", serv: "150", blq: "350", ok: "800" },
        { m: "Samsung", mod: "Galaxy A15 4G/5G", serv: "150", blq: "300", ok: "700" },
        { m: "Samsung", mod: "Galaxy A14 4G/5G", serv: "140", blq: "250", ok: "600" },
        { m: "Samsung", mod: "Galaxy A06", serv: "130", blq: "200", ok: "550" },
        { m: "Samsung", mod: "Galaxy A05 / A05s", serv: "130", blq: "200", ok: "500" },
        { m: "Samsung", mod: "Galaxy A04 / A04s", serv: "120", blq: "150", ok: "400" },
        { m: "Samsung", mod: "Galaxy A03 / Core", serv: "120", blq: "100", ok: "300" },

        // Linha M
        { m: "Samsung", mod: "Galaxy M55 5G", serv: "200", blq: "600", ok: "1300" },
        { m: "Samsung", mod: "Galaxy M35 5G", serv: "180", blq: "450", ok: "1000" },
        { m: "Samsung", mod: "Galaxy M15 5G", serv: "150", blq: "300", ok: "750" },

        // --- MOTOROLA (2020-2025) ---
        // Linha Edge
        { m: "Motorola", mod: "Edge 60 Pro / Ultra (2025)", serv: "400", blq: "2000", ok: "4000" },
        { m: "Motorola", mod: "Edge 50 Ultra / Pro", serv: "350", blq: "1500", ok: "3000" },
        { m: "Motorola", mod: "Edge 50 Fusion", serv: "250", blq: "900", ok: "1800" },
        { m: "Motorola", mod: "Edge 40 / Neo", serv: "220", blq: "700", ok: "1400" },
        { m: "Motorola", mod: "Edge 30 Ultra / Fusion", serv: "220", blq: "600", ok: "1300" },

        // Linha Moto G (Intermediários)
        { m: "Motorola", mod: "Moto G86 5G (Lançamento)", serv: "220", blq: "800", ok: "1600" },
        { m: "Motorola", mod: "Moto G85 5G", serv: "200", blq: "600", ok: "1300" },
        { m: "Motorola", mod: "Moto G84 5G", serv: "180", blq: "500", ok: "1100" },
        { m: "Motorola", mod: "Moto G56 5G (2025)", serv: "180", blq: "550", ok: "1200" },
        { m: "Motorola", mod: "Moto G54 / G53", serv: "160", blq: "350", ok: "800" },
        { m: "Motorola", mod: "Moto G34 / G35 5G", serv: "150", blq: "300", ok: "750" },
        { m: "Motorola", mod: "Moto G24 / Power", serv: "140", blq: "250", ok: "600" },
        { m: "Motorola", mod: "Moto G04 / G06", serv: "120", blq: "150", ok: "500" },

        // --- XIAOMI (2020-2025) ---
        // Linha Redmi Note
        { m: "Xiaomi", mod: "Redmi Note 14 Pro+ 5G", serv: "250", blq: "1000", ok: "2200" },
        { m: "Xiaomi", mod: "Redmi Note 14 Pro", serv: "220", blq: "800", ok: "1700" },
        { m: "Xiaomi", mod: "Redmi Note 14 5G", serv: "180", blq: "600", ok: "1300" },
        { m: "Xiaomi", mod: "Redmi Note 13 Pro+", serv: "220", blq: "700", ok: "1500" },
        { m: "Xiaomi", mod: "Redmi Note 13 4G/5G", serv: "180", blq: "450", ok: "1000" },
        { m: "Xiaomi", mod: "Redmi Note 12 Series", serv: "160", blq: "350", ok: "850" },
        
        // Linha POCO
        { m: "Xiaomi", mod: "Poco X7 Pro", serv: "250", blq: "900", ok: "1900" },
        { m: "Xiaomi", mod: "Poco X6 Pro", serv: "220", blq: "700", ok: "1600" },
        { m: "Xiaomi", mod: "Poco M6 Pro", serv: "180", blq: "500", ok: "1100" },
        { m: "Xiaomi", mod: "Poco C75 / C85", serv: "130", blq: "250", ok: "650" },

        // Linha Básica
        { m: "Xiaomi", mod: "Redmi 15C / 14C", serv: "140", blq: "300", ok: "700" },
        { m: "Xiaomi", mod: "Redmi 13 / 13C", serv: "130", blq: "250", ok: "600" },
        { m: "Xiaomi", mod: "Redmi A3 / A3x", serv: "120", blq: "150", ok: "450" },

        // --- INFINIX (Crescendo no Brasil) ---
        { m: "Infinix", mod: "Note 50 Pro (2025)", serv: "200", blq: "700", ok: "1500" },
        { m: "Infinix", mod: "Note 40 Pro / 5G", serv: "180", blq: "600", ok: "1300" },
        { m: "Infinix", mod: "Hot 50i / 60i", serv: "140", blq: "300", ok: "700" },
        { m: "Infinix", mod: "Smart 9 / 10", serv: "120", blq: "150", ok: "500" },

        // --- APPLE (iPhone) ---
        // Serviço sempre "A Consultar" ou valor alto devido ao risco/custo alto de bypass
        { m: "Apple", mod: "iPhone 16 Pro Max", serv: "Consultar", blq: "3000", ok: "7000" },
        { m: "Apple", mod: "iPhone 16 / Plus", serv: "Consultar", blq: "2200", ok: "5000" },
        { m: "Apple", mod: "iPhone 15 Pro Max", serv: "Consultar", blq: "2500", ok: "5500" },
        { m: "Apple", mod: "iPhone 15", serv: "Consultar", blq: "1800", ok: "3500" },
        { m: "Apple", mod: "iPhone 14 Pro Max", serv: "Consultar", blq: "2000", ok: "4500" },
        { m: "Apple", mod: "iPhone 14", serv: "Consultar", blq: "1500", ok: "2800" },
        { m: "Apple", mod: "iPhone 13", serv: "Consultar", blq: "1200", ok: "2200" },
        { m: "Apple", mod: "iPhone 12", serv: "Consultar", blq: "900", ok: "1600" },
        { m: "Apple", mod: "iPhone 11", serv: "Consultar", blq: "600", ok: "1200" }
    ];

    try {
        await Preco.insertMany(listaMestra.map(p => ({
            marca: p.m, modelo: p.mod,
            servico: p.serv, compraBloq: p.blq, compraOk: p.ok
        })));
        console.log(`✅ ${listaMestra.length} modelos de 2020 a 2025 adicionados ao banco com sucesso!`);
    } catch (e) {
        console.error("Erro ao popular banco:", e);
    }
}
