document.addEventListener('DOMContentLoaded', () => {
    
    // === 0. LOGOUT & AUTH ===
    window.logout = async () => {
        await fetch('/api/logout', {method:'POST'});
        window.location.href = 'login.html';
    };

    // ============================================
    // === 1. MÓDULO ORDEM DE SERVIÇO (NOVO) ===
    // ============================================

    let osAtualID = null;

    window.criarOS = async () => {
        const btn = document.querySelector('#tab-os .btn-generate');
        const originalText = btn.innerText;
        btn.innerText = "Criando..."; btn.disabled = true;

        const dados = {
            cliente: {
                nome: document.getElementById('os-nome').value,
                cpf: document.getElementById('os-cpf').value,
                telefone: document.getElementById('os-tel').value
            },
            aparelho: {
                modelo: document.getElementById('os-modelo').value,
                imei: document.getElementById('os-imei').value,
                senha: document.getElementById('os-senha').value,
                acessorios: document.getElementById('os-acessorios').value
            },
            checklist: {
                tela: document.getElementById('ck-tela').value,
                bateria: document.getElementById('ck-bateria').value,
                carcaca: document.getElementById('ck-carcaca').value,
                botoes: document.getElementById('ck-botoes').value,
                cameras: document.getElementById('ck-cameras').value,
                som: document.getElementById('ck-som').value,
                conectividade: document.getElementById('ck-rede').value,
                sensores: document.getElementById('ck-sensores').value
            },
            defeitoRelatado: document.getElementById('os-defeito').value
        };

        if(!dados.cliente.nome || !dados.aparelho.modelo) {
            alert("Preencha pelo menos Nome e Modelo.");
            btn.innerText = originalText; btn.disabled = false;
            return;
        }

        try {
            const res = await fetch('/api/os', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(dados)
            });
            const os = await res.json();
            osAtualID = os._id;

            // Mostrar QR Code para Assinatura
            const area = document.getElementById('area-assinatura-os');
            const qrDiv = document.getElementById('qrcode-os-display');
            area.style.display = 'block';
            qrDiv.innerHTML = "";
            
            // URL que o cliente vai acessar no celular
            const urlAssinatura = `${window.location.origin}/assinatura-os.html?id=${os._id}`;
            new QRCode(qrDiv, { text: urlAssinatura, width: 200, height: 200 });

            // Rolar até o QR code
            area.scrollIntoView({ behavior: 'smooth' });
            
            carregarOSHistory();
            alert("OS Criada! Escaneie o QR Code para o cliente assinar.");

        } catch(e) { alert("Erro ao criar OS: " + e.message); }
        finally { btn.innerText = originalText; btn.disabled = false; }
    };

    window.verificarAssinaturaEImprimir = async () => {
        if(!osAtualID) return alert("Nenhuma OS selecionada recentemente.");
        
        try {
            const res = await fetch(`/api/os/${osAtualID}`);
            const os = await res.json();
            
            if(os.assinaturaCliente) {
                alert("✅ Assinatura detectada! Gerando PDF...");
                document.getElementById('area-assinatura-os').style.display = 'none';
                gerarPDFOS(os);
                limparFormularioOS();
            } else {
                alert("❌ O cliente ainda não assinou. Peça para ele clicar em 'ENVIAR' no celular.");
            }
        } catch(e) { alert("Erro ao verificar assinatura."); }
    };

    window.carregarOSHistory = async () => {
        const tb = document.querySelector('#os-table tbody');
        tb.innerHTML = "<tr><td colspan='6'>Carregando...</td></tr>";
        try {
            const res = await fetch('/api/os');
            const lista = await res.json();
            tb.innerHTML = "";
            lista.forEach(os => {
                const tr = document.createElement('tr');
                const data = new Date(os.dataEntrada).toLocaleDateString('pt-BR');
                tr.innerHTML = `
                    <td>#${os.numeroOS ? os.numeroOS.toString().slice(-4) : '---'}</td>
                    <td>${data}</td>
                    <td>${os.cliente.nome}</td>
                    <td>${os.aparelho.modelo}</td>
                    <td><span class="brand-badge">${os.status}</span></td>
                    <td>
                        <button class="btn-print" onclick="reimprimirOS('${os._id}')"><i class="fas fa-print"></i></button>
                        <button class="btn-delete" onclick="deletarOS('${os._id}')"><i class="fas fa-trash"></i></button>
                    </td>
                `;
                tb.appendChild(tr);
            });
        } catch(e) { tb.innerHTML = ""; }
    };

    window.reimprimirOS = async (id) => {
        const res = await fetch(`/api/os/${id}`);
        const os = await res.json();
        gerarPDFOS(os);
    };

    window.deletarOS = async (id) => {
        if(confirm("Apagar esta OS?")) {
            await fetch(`/api/os/${id}`, {method: 'DELETE'});
            carregarOSHistory();
        }
    };

    function limparFormularioOS() {
        document.getElementById('os-nome').value = "";
        document.getElementById('os-cpf').value = "";
        document.getElementById('os-tel').value = "";
        document.getElementById('os-modelo').value = "";
        document.getElementById('os-imei').value = "";
        document.getElementById('os-senha').value = "";
        document.getElementById('os-acessorios').value = "";
        document.getElementById('os-defeito').value = "";
        osAtualID = null;
    }

    // --- GERADOR DE PDF DA OS ---
    function gerarPDFOS(os) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Cabeçalho
        doc.setFont("helvetica", "bold"); doc.setFontSize(18);
        doc.text("ORDEM DE SERVIÇO", 105, 15, null, null, "center");
        doc.setFontSize(10); doc.setFont("helvetica", "normal");
        doc.text(`Nº: ${os.numeroOS || '---'} | Data: ${new Date(os.dataEntrada).toLocaleString('pt-BR')}`, 105, 22, null, null, "center");
        
        let y = 30;

        // Cliente
        doc.setFillColor(230,230,230); doc.rect(10, y, 190, 8, 'F');
        doc.setFont("helvetica", "bold"); doc.text("DADOS DO CLIENTE", 15, y+6); y+=15;
        doc.setFont("helvetica", "normal");
        doc.text(`Nome: ${os.cliente.nome}`, 15, y);
        doc.text(`Tel: ${os.cliente.telefone}`, 120, y); y+=7;
        doc.text(`CPF: ${os.cliente.cpf}`, 15, y); y+=10;

        // Aparelho
        doc.setFillColor(230,230,230); doc.rect(10, y, 190, 8, 'F');
        doc.setFont("helvetica", "bold"); doc.text("APARELHO & DEFEITO", 15, y+6); y+=15;
        doc.setFont("helvetica", "normal");
        doc.text(`Modelo: ${os.aparelho.modelo}`, 15, y);
        doc.text(`IMEI: ${os.aparelho.imei}`, 100, y); y+=7;
        doc.text(`Senha Tela: ${os.aparelho.senha || 'Sem senha'}`, 15, y); y+=7;
        doc.text(`Acessórios: ${os.aparelho.acessorios || 'Nenhum'}`, 15, y); y+=10;
        
        doc.setFont("helvetica", "bold"); doc.text("Defeito Relatado:", 15, y); y+=7;
        doc.setFont("helvetica", "normal");
        doc.text(os.defeitoRelatado || "Não informado", 15, y, {maxWidth: 180}); y+=15;

        // Checklist
        doc.setFillColor(230,230,230); doc.rect(10, y, 190, 8, 'F');
        doc.setFont("helvetica", "bold"); doc.text("CHECKLIST DE ENTRADA", 15, y+6); y+=15;
        
        const ck = os.checklist;
        doc.setFontSize(9);
        const col1 = 15, col2 = 60, col3 = 105, col4 = 150;
        
        doc.text(`Tela: ${ck.tela}`, col1, y); doc.text(`Bateria: ${ck.bateria}`, col2, y); doc.text(`Carcaça: ${ck.carcaca}`, col3, y); doc.text(`Botões: ${ck.botoes}`, col4, y); y+=7;
        doc.text(`Câmeras: ${ck.cameras}`, col1, y); doc.text(`Som: ${ck.som}`, col2, y); doc.text(`Wi-Fi: ${ck.conectividade}`, col3, y); doc.text(`Sensores: ${ck.sensores}`, col4, y); y+=15;

        // Termos
        doc.setFontSize(8); doc.setTextColor(100);
        const termos = [
            "1. A garantia cobre apenas o serviço executado e peças trocadas por 90 dias.",
            "2. Não nos responsabilizamos por perda de dados. Faça backup.",
            "3. Aparelhos não retirados em 90 dias serão vendidos para custear despesas (Art. 1.275 CC)."
        ];
        termos.forEach(t => { doc.text(t, 15, y); y+=5; });

        // Assinatura
        y+=15; doc.setTextColor(0);
        if(os.assinaturaCliente) {
            doc.addImage(os.assinaturaCliente, 'PNG', 70, y, 60, 25);
            y+=25;
            doc.text("Assinatura do Cliente (Digital)", 105, y, null, null, "center");
        } else {
            y+=20;
            doc.line(60, y, 150, y);
            doc.text("Assinatura do Cliente", 105, y+5, null, null, "center");
        }

        doc.save(`OS_${os.numeroOS}.pdf`);
    }


    // ============================================
    // === 2. MÓDULO RECIBO (ORIGINAL) ===
    // ============================================
    const canvas = document.getElementById('signature-pad');
    if(canvas) {
        const signaturePad = new SignaturePad(canvas, { backgroundColor: 'rgb(255, 255, 255)', penColor: 'rgb(0, 0, 0)' });
        function resizeCanvas() {
            const ratio = Math.max(window.devicePixelRatio || 1, 1);
            canvas.width = canvas.offsetWidth * ratio;
            canvas.height = canvas.offsetHeight * ratio;
            canvas.getContext("2d").scale(ratio, ratio);
        }
        window.addEventListener("resize", resizeCanvas);
        resizeCanvas();
        document.getElementById('clear-pad').addEventListener('click', () => signaturePad.clear());
        
        loadHistory(); // Carrega histórico Recibos

        window.gerarPDF = async () => {
             // ... (Lógica original de gerar recibo mantida)
             if (signaturePad.isEmpty()) { alert("Assinatura obrigatória!"); return; }
             const btn = document.querySelector('#tab-recibo .btn-generate');
             const txt = btn.innerHTML; btn.innerHTML = "Salvando..."; btn.disabled = true;

             const dados = {
                nome: document.getElementById('nome').value,
                cpf: document.getElementById('cpf').value,
                rg: document.getElementById('rg').value,
                endereco: document.getElementById('endereco').value,
                modelo: document.getElementById('modelo').value,
                imei: document.getElementById('imei').value,
                valor: document.getElementById('valor').value,
                estado: document.getElementById('estado').value,
                assinatura: signaturePad.toDataURL(),
                dataFormatada: new Date().toLocaleDateString('pt-BR'),
                horaFormatada: new Date().toLocaleTimeString('pt-BR')
            };

            try {
                const res = await fetch('/api/recibos', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(dados) });
                const salvo = await res.json();
                gerarPDFRecibo(salvo); // Função renomeada para evitar conflito
                alert("Recibo Salvo!");
                signaturePad.clear();
                loadHistory();
            } catch (e) { alert("Erro: " + e.message); } 
            finally { btn.innerHTML = txt; btn.disabled = false; }
        };
    }

    window.gerarPDFRecibo = (d) => {
        // ... (Mesma lógica do seu PDF original de venda) ...
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.setFont("helvetica", "bold"); doc.text("RECIBO DE VENDA", 105, 20, null, null, "center");
        
        let y = 40;
        doc.setFontSize(10);
        doc.text(`Data: ${d.dataFormatada}`, 20, y); y+=10;
        doc.text(`Vendedor: ${d.nome} (CPF: ${d.cpf})`, 20, y); y+=10;
        doc.text(`Aparelho: ${d.modelo} (IMEI: ${d.imei})`, 20, y); y+=10;
        doc.text(`Valor: R$ ${d.valor} - Estado: ${d.estado}`, 20, y); y+=20;
        
        if(d.assinatura) doc.addImage(d.assinatura, 'PNG', 20, y, 60, 30);
        doc.save(`Recibo_Venda_${d.modelo}.pdf`);
    };

    async function loadHistory() {
        const tb = document.querySelector('#history-table tbody');
        if(!tb) return;
        try {
            const res = await fetch('/api/recibos');
            const lista = await res.json();
            tb.innerHTML = "";
            lista.forEach(i => {
                tb.innerHTML += `<tr><td>${i.dataFormatada}</td><td>${i.nome}</td><td>${i.modelo}</td><td>R$ ${i.valor}</td>
                <td><button class="btn-delete" onclick="deletar('${i._id}')"><i class="fas fa-trash"></i></button></td></tr>`;
            });
        } catch(e) {}
    }
    window.deletar = async (id) => { await fetch(`/api/recibos/${id}`, {method:'DELETE'}); loadHistory(); };


    // ============================================
    // === 3. MÓDULO FINANCEIRO (ORIGINAL) ===
    // ============================================
    window.carregarFinanceiro = async () => {
        // ... Lógica financeira mantida ...
        const tb = document.querySelector('#finance-table tbody');
        try {
            const res = await fetch('/api/financeiro');
            const lista = await res.json();
            let total = 0, ent = 0, sai = 0;
            tb.innerHTML = "";
            lista.forEach(item => {
                const val = parseFloat(item.valor);
                if(item.tipo === 'entrada') { ent += val; total += val; } else { sai += val; total -= val; }
                tb.innerHTML += `<tr><td>${new Date(item.data).toLocaleDateString('pt-BR')}</td><td>${item.descricao}</td>
                <td style="color:${item.tipo==='entrada'?'#0f8':'#f44'}">R$ ${val.toFixed(2)}</td>
                <td><button class="btn-delete" onclick="deletarFin('${item._id}')"><i class="fas fa-trash"></i></button></td></tr>`;
            });
            document.getElementById('dash-saldo').innerText = `R$ ${total.toFixed(2)}`;
            document.getElementById('dash-entradas').innerText = `R$ ${ent.toFixed(2)}`;
            document.getElementById('dash-saidas').innerText = `R$ ${sai.toFixed(2)}`;
        } catch(e){}
    };
    window.salvarFinanceiro = async () => {
        const desc = document.getElementById('fin-desc').value;
        const valor = document.getElementById('fin-valor').value;
        const tipo = document.getElementById('fin-tipo').value;
        await fetch('/api/financeiro', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({descricao:desc, valor, tipo})});
        carregarFinanceiro();
        document.getElementById('fin-desc').value = ""; document.getElementById('fin-valor').value = "";
    };
    window.deletarFin = async(id) => { await fetch(`/api/financeiro/${id}`, {method:'DELETE'}); carregarFinanceiro(); };


    // ============================================
    // === 4. TABELA DE PREÇOS (BUSCA) ===
    // ============================================
    
    // --- COLE AQUI SUA LISTA GIGANTE DE PREÇOS 'bancoPrecos' ORIGINAL ---
    const bancoPrecos = [
        { m: "Samsung", mod: "Galaxy A01 Core", serv: "100", blq: "50", ok: "150" },
        { m: "Samsung", mod: "Galaxy A10", serv: "120", blq: "80", ok: "200" },
        // ... ADICIONE O RESTANTE DA SUA LISTA AQUI ...
    ];

    // Lógica de busca mantida
    const searchInput = document.getElementById('search-input');
    const resultsContainer = document.getElementById('results-container');

    if(searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            resultsContainer.innerHTML = '';
            if(term.length < 2) return;
            
            const filtrados = bancoPrecos.filter(p => p.mod.toLowerCase().includes(term));
            filtrados.forEach(p => {
                const card = document.createElement('div');
                card.className = 'price-card';
                card.innerHTML = `
                    <div class="model-header"><span class="model-name">${p.mod}</span><span class="brand-badge">${p.m}</span></div>
                    <div class="price-grid">
                        <div class="price-box"><span class="price-label">Serviço</span><span class="price-value" style="color:#00ff88">R$ ${p.serv}</span></div>
                        <div class="price-box"><span class="price-label">Compra (Bloq)</span><span class="price-value" style="color:#ffaa00">R$ ${p.blq}</span></div>
                        <div class="price-box"><span class="price-label">Revenda (OK)</span><span class="price-value" style="color:#fff">R$ ${p.ok}</span></div>
                    </div>
                `;
                resultsContainer.appendChild(card);
            });
        });
    }
});
