// --- CONFIGURAÇÕES GLOBAIS ---
const API_URL = '/api'; 
let TOKEN = localStorage.getItem('admin_token');
let signaturePad = null; // Variável para guardar a assinatura

// --- INICIALIZAÇÃO AO CARREGAR A PÁGINA ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Verifica se está logado
    if (!TOKEN) {
        // Se não tiver login, redireciona para index ou pede senha
        // Como seu HTML Admin não tem tela de login embutida, vamos assumir que ele já passou por ela
        // ou redirecionar de volta:
        // window.location.href = 'index.html'; 
    }

    // 2. Inicializa a Assinatura (Signature Pad)
    const canvas = document.getElementById('signature-pad');
    if (canvas) {
        // Ajusta o tamanho do canvas para a tela
        function resizeCanvas() {
            const ratio = Math.max(window.devicePixelRatio || 1, 1);
            canvas.width = canvas.offsetWidth * ratio;
            canvas.height = canvas.offsetHeight * ratio;
            canvas.getContext("2d").scale(ratio, ratio);
        }
        window.onresize = resizeCanvas;
        resizeCanvas();

        signaturePad = new SignaturePad(canvas, {
            backgroundColor: 'rgb(255, 255, 255)' // Fundo branco
        });
    }

    // 3. Botão de Limpar Assinatura
    const btnClear = document.getElementById('clear-pad');
    if (btnClear) {
        btnClear.addEventListener('click', () => {
            if (signaturePad) signaturePad.clear();
        });
    }

    // 4. Carrega os dados iniciais se estiver na aba certa
    // (Por padrão o HTML começa na aba recibo, então não precisa carregar dados agora)
});

// --- FUNÇÃO: TROCAR ABAS (Essa estava dando erro) ---
function switchTab(tabName) {
    // 1. Remove a classe 'active' de todos os botões e conteúdos
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    // 2. Adiciona 'active' no botão clicado (precisamos achar qual botão chamou a função)
    // Uma forma simples é procurar pelo texto ou índice, mas vamos fazer via ID da div:
    
    // Ativa o conteúdo
    const targetContent = document.getElementById(`tab-${tabName}`);
    if (targetContent) {
        targetContent.classList.add('active');
    }

    // Ativa o botão visualmente (procura qual botão tem o onclick correspondente)
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => {
        if(btn.getAttribute('onclick').includes(tabName)) {
            btn.classList.add('active');
        }
    });

    // 3. Se for aba de dados, carrega os dados
    if (tabName === 'financeiro') carregarFinanceiro();
    if (tabName === 'precos') carregarPrecos();
}

// --- FUNÇÃO: SAIR (LOGOUT) ---
function logout() {
    localStorage.removeItem('admin_token');
    window.location.href = 'index.html'; // Volta para a tela inicial
}

// --- FUNÇÃO: GERAR PDF (Recibo) ---
async function gerarPDF() {
    if (signaturePad && signaturePad.isEmpty()) {
        return alert("Por favor, assine o recibo antes de gerar.");
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Pegando valores
    const nome = document.getElementById('nome').value;
    const modelo = document.getElementById('modelo').value;
    const valor = document.getElementById('valor').value;
    const imei = document.getElementById('imei').value;
    const dataHoje = new Date().toLocaleDateString('pt-BR');

    // Cabeçalho
    doc.setFontSize(18);
    doc.text("RECIBO DE VENDA/SERVIÇO", 105, 20, null, null, "center");
    
    doc.setFontSize(12);
    doc.text(`Data: ${dataHoje}`, 20, 40);
    doc.text(`Cliente: ${nome}`, 20, 50);
    doc.text(`Aparelho: ${modelo}`, 20, 60);
    doc.text(`IMEI: ${imei}`, 20, 70);
    doc.text(`Valor: R$ ${valor}`, 20, 80);

    // Adiciona Assinatura
    if (signaturePad) {
        const signatureImg = signaturePad.toDataURL();
        doc.addImage(signatureImg, 'PNG', 20, 100, 100, 50);
        doc.text("Assinatura do Vendedor", 20, 155);
    }

    doc.save(`recibo_${nome}.pdf`);

    // Opcional: Salvar no histórico ou financeiro aqui
    if(document.getElementById('lancar-financeiro').checked) {
        await salvarVendaFinanceiro(modelo, valor);
    }
}

// --- FUNÇÃO AUXILIAR: MÁSCARA CPF ---
function maskCPF(i) {
    let v = i.value;
    if(isNaN(v[v.length-1])){ 
       i.value = v.substring(0, v.length-1);
       return;
    }
    i.setAttribute("maxlength", "14");
    if (v.length == 3 || v.length == 7) i.value += ".";
    if (v.length == 11) i.value += "-";
}

// --- APIs: FINANCEIRO ---
async function carregarFinanceiro() {
    try {
        const res = await fetch(`${API_URL}/financeiro`, {
            headers: { 'Authorization': TOKEN }
        });
        const lista = await res.json();
        
        const tbody = document.querySelector('#finance-table tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        let entrada = 0, saida = 0;

        lista.forEach(item => {
            if(item.tipo === 'entrada') entrada += item.valor;
            else saida += item.valor;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${new Date(item.data).toLocaleDateString()}</td>
                <td>${item.tipo}</td>
                <td>${item.categoria}</td>
                <td>${item.descricao}</td>
                <td style="color:${item.tipo === 'entrada' ? 'green' : 'red'}">R$ ${item.valor}</td>
                <td><button onclick="deletarItem('financeiro', '${item._id}')" style="color:red; border:none; background:none; cursor:pointer;"><i class="fas fa-trash"></i></button></td>
            `;
            tbody.appendChild(tr);
        });

        // Atualiza Cards
        document.getElementById('total-entradas').innerText = `R$ ${entrada.toFixed(2)}`;
        document.getElementById('total-saidas').innerText = `R$ ${saida.toFixed(2)}`;
        document.getElementById('total-saldo').innerText = `R$ ${(entrada - saida).toFixed(2)}`;
        
    } catch (e) { console.error(e); }
}

async function addFinanceiro() {
    const tipo = document.getElementById('fin-tipo').value;
    const cat = document.getElementById('fin-cat').value;
    const desc = document.getElementById('fin-desc').value;
    const valor = document.getElementById('fin-valor').value;

    if(!desc || !valor) return alert("Preencha todos os campos");

    await fetch(`${API_URL}/financeiro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': TOKEN },
        body: JSON.stringify({ tipo, categoria: cat, descricao: desc, valor: Number(valor) })
    });

    carregarFinanceiro(); // Recarrega tabela
    // Limpa campos
    document.getElementById('fin-desc').value = '';
    document.getElementById('fin-valor').value = '';
}

// Função usada pelo checkbox "Lançar no financeiro"
async function salvarVendaFinanceiro(modelo, valor) {
    await fetch(`${API_URL}/financeiro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': TOKEN },
        body: JSON.stringify({ 
            tipo: 'saida', // Assumindo que é compra (saída de dinheiro da loja) ou entrada? 
            // O checkbox diz "SAÍDA (Compra)", então:
            categoria: 'Compra Aparelho', 
            descricao: `Compra de ${modelo}`, 
            valor: Number(valor) 
        })
    });
    alert("Lançado no financeiro com sucesso!");
}


// --- APIs: PREÇOS ---
async function carregarPrecos() {
    try {
        const res = await fetch(`${API_URL}/precos`);
        const lista = await res.json();
        renderizarPrecos(lista);
    } catch(e) { console.error(e); }
}

function renderizarPrecos(lista) {
    const container = document.getElementById('results-container');
    container.innerHTML = '';
    
    // Cria tabela dinâmica ou cards
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.color = '#fff';
    table.innerHTML = `
        <thead>
            <tr style="text-align:left; border-bottom:1px solid #444;">
                <th>Marca</th><th>Modelo</th><th>Serviço</th><th>Compra Bloq</th><th>Compra OK</th><th>Ação</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;
    
    const tbody = table.querySelector('tbody');

    lista.forEach(p => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #333';
        tr.innerHTML = `
            <td style="padding:10px;">${p.marca}</td>
            <td style="padding:10px;">${p.modelo}</td>
            <td style="padding:10px; color:#4caf50;">R$ ${p.servico}</td>
            <td style="padding:10px;">R$ ${p.compraBloq}</td>
            <td style="padding:10px;">R$ ${p.compraOk}</td>
            <td><button onclick="deletarItem('precos', '${p._id}')" style="color:red; background:none; border:none; cursor:pointer;"><i class="fas fa-trash"></i></button></td>
        `;
        tbody.appendChild(tr);
    });
    
    container.appendChild(table);
}

// Filtro de pesquisa
async function filtrarPrecos() {
    const termo = document.getElementById('searchInput').value.toLowerCase();
    const res = await fetch(`${API_URL}/precos`);
    const lista = await res.json();
    
    const filtrados = lista.filter(p => 
        p.modelo.toLowerCase().includes(termo) || 
        p.marca.toLowerCase().includes(termo)
    );
    renderizarPrecos(filtrados);
}

async function addPreco() {
    const marca = document.getElementById('p-marca').value;
    const modelo = document.getElementById('p-modelo').value;
    const serv = document.getElementById('p-serv').value;
    const blq = document.getElementById('p-compra-bad').value;
    const ok = document.getElementById('p-compra-ok').value;

    if(!modelo) return alert("Preencha o modelo");

    await fetch(`${API_URL}/precos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': TOKEN },
        body: JSON.stringify({ marca, modelo, servico: serv, compraBloq: blq, compraOk: ok })
    });
    
    alert("Preço adicionado!");
    carregarPrecos();
}

// --- FUNÇÃO DE DELETAR GENÉRICA ---
async function deletarItem(rota, id) {
    if(!confirm("Tem certeza?")) return;
    
    await fetch(`${API_URL}/${rota}/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': TOKEN }
    });
    
    if(rota === 'financeiro') carregarFinanceiro();
    if(rota === 'precos') carregarPrecos();
}
