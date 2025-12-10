const express = require('express');
const path = require('path');
const app = express();

// =======================================================
// CONFIGURAÇÕES DO SERVIDOR
// =======================================================

// Define a porta: O Render usa a variável process.env.PORT automaticamente.
// Se estiver rodando no seu PC, ele usa a porta 3000.
const port = process.env.PORT || 3000;

// =======================================================
// MIDDLEWARE (Arquivos Estáticos)
// =======================================================

// Diz ao Express para servir os arquivos da pasta 'public' (HTML, CSS, JS, Imagens)
app.use(express.static(path.join(__dirname, 'public')));

// =======================================================
// ROTAS
// =======================================================

// Rota Principal: Quando acessarem o site, entrega o index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota de Segurança (Wildcard):
// Se o usuário tentar acessar qualquer página que não existe (ex: /login, /admin),
// redireciona ele de volta para a Home. Isso evita erros de "Cannot GET".
app.get('*', (req, res) => {
    res.redirect('/');
});

// =======================================================
// INICIALIZAÇÃO
// =======================================================

app.listen(port, () => {
    console.log(`==================================================`);
    console.log(`🚀 Servidor DESTRAVA CELL iniciado com sucesso!`);
    console.log(`📡 Rodando na porta: ${port}`);
    console.log(`👉 Local: http://localhost:${port}`);
    console.log(`==================================================`);
});
