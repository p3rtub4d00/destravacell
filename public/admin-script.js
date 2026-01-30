document.addEventListener('DOMContentLoaded', () => {
    
    // === 0. LOGOUT & AUTH ===
    window.logout = async () => {
        await fetch('/api/logout', {method:'POST'});
        window.location.href = 'login.html';
    };

    // ============================================
    // === 1. ORDEM DE SERVIÇO (OS) ===
    // ============================================

    let osAtualID = null;

    window.criarOS = async () => {
        const btn = document.querySelector('#tab-os .btn-generate');
        const originalText = btn.innerHTML;
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
            btn.innerHTML = originalText; btn.disabled = false;
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
            
            const urlAssinatura = `${window.location.origin}/assinatura-os.html?id=${os._id}`;
            new QRCode(qrDiv, { text: urlAssinatura, width: 200, height: 200 });

            area.scrollIntoView({ behavior: 'smooth' });
            
            carregarOSHistory();
            alert("OS Criada! Escaneie o QR Code para o cliente assinar.");

        } catch(e) { alert("Erro ao criar OS: " + e.message); }
        finally { btn.innerHTML = originalText; btn.disabled = false; }
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

    // --- NOVA LÓGICA: CONCLUIR OS ---
    window.concluirOS = async (id) => {
        const valorStr = prompt("Qual o valor final do serviço? (Este valor entrará no Financeiro)");
        if(valorStr === null) return; // Cancelou

        const valor = parseFloat(valorStr.replace(',', '.'));
        if(isNaN(valor) || valor <= 0) {
            return alert("Valor inválido. Digite um número (ex: 150.00)");
        }

        try {
            const res = await fetch(`/api/os/${id}/concluir`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ valorFinal: valor })
            });
            
            if(res.ok) {
                alert(`✅ Serviço Concluído! R$ ${valor.toFixed(2)} lançado no Financeiro.`);
                carregarOSHistory();
            } else {
                alert("Erro ao concluir OS.");
            }
        } catch(e) { alert("Erro de conexão: " + e.message); }
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
                
                let statusBadge = "";
                let btnConcluir = "";

                if(os.status === "Concluido") {
                    statusBadge = `<span style="color:#00ff88; font-weight:bold;">CONCLUÍDO</span>`;
                } else {
                    statusBadge = `<span style="color:#fff;">${os.status}</span>`;
                    // Botão para concluir só aparece se não estiver concluído
                    btnConcluir = `<button class="btn-icon btn-conclude" onclick="concluirOS('${os._id}')" title="Concluir e Cobrar"><i class="fas fa-check"></i></button>`;
                }

                tr.innerHTML = `
                    <td>#${os.numeroOS ? os.numeroOS.toString().slice(-4) : '---'}</td>
                    <td>${data}</td>
                    <td>${os.cliente.nome}</td>
                    <td>${statusBadge}</td>
                    <td>
                        ${btnConcluir}
                        <button class="btn-icon btn-action" onclick="reimprimirOS('${os._id}')" title="Baixar PDF"><i class="fas fa-file-pdf"></i></button>
                        <button class="btn-icon btn-danger" onclick="deletarOS('${os._id}')" title="Excluir"><i class="fas fa-trash"></i></button>
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

    // --- GERADOR PDF OS ---
    function gerarPDFOS(os) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
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
        doc.text(`Senha: ${os.aparelho.senha || 'Sem senha'}`, 15, y);
        doc.text(`Acessórios: ${os.aparelho.acessorios || 'Nenhum'}`, 100, y); y+=10;
        
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
            "3. Aparelhos não retirados em 90 dias serão vendidos para custear despesas."
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
    // === 2. MÓDULO RECIBO (COMPRA/VENDA) ===
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
        
        loadHistory(); 

        window.gerarPDF = async () => {
             if (signaturePad.isEmpty()) { alert("Assinatura obrigatória!"); return; }
             const btn = document.querySelector('#tab-recibo .btn-generate');
             const txt = btn.innerHTML; btn.innerHTML = "Processando..."; btn.disabled = true;

             const dados = {
                tipoOperacao: document.getElementById('tipo-recibo').value, // CAMPO NOVO
                nome: document.getElementById('nome').value || "---",
                cpf: document.getElementById('cpf').value || "---",
                rg: document.getElementById('rg').value || "---",
                endereco: document.getElementById('endereco').value || "---",
                modelo: document.getElementById('modelo').value || "---",
                imei: document.getElementById('imei').value || "---",
                valor: document.getElementById('valor').value || "0,00",
                estado: document.getElementById('estado').value,
                assinatura: signaturePad.toDataURL(),
                dataFormatada: new Date().toLocaleDateString('pt-BR'),
                horaFormatada: new Date().toLocaleTimeString('pt-BR')
            };

            try {
                const res = await fetch('/api/recibos', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(dados) });
                const salvo = await res.json();
                gerarQRCodeEPDF(salvo);
                alert(`Recibo Salvo! Lançado como ${dados.tipoOperacao.toUpperCase()} no Financeiro.`);
                signaturePad.clear();
                loadHistory();
            } catch (e) { alert("Erro: " + e.message); } 
            finally { btn.innerHTML = txt; btn.disabled = false; }
        };
    }

    window.reimprimirRecibo = async (id) => {
        try {
            const res = await fetch(`/api/recibos/${id}`);
            if(!res.ok) throw new Error("Erro ao buscar");
            const dados = await res.json();
            gerarQRCodeEPDF(dados);
        } catch(e) { alert("Erro ao reimprimir: " + e.message); }
    };

    function gerarQRCodeEPDF(dados) {
        let container = document.getElementById("qrcode-container");
        if(!container) {
            container = document.createElement('div');
            container.id = "qrcode-container";
            container.style.display = "none";
            document.body.appendChild(container);
        }
        container.innerHTML = "";
        
        const id = dados._id || Date.now();
        // Inclui se é VENDA ou COMPRA no QR Code
        const tipoLabel = dados.tipoOperacao === 'compra' ? 'COMPRA' : 'VENDA';
        const qrData = `NEXUS|${tipoLabel}|ID:${id}|IMEI:${dados.imei}|$${dados.valor}`;
        
        new QRCode(container, { text: qrData, width: 100, height: 100 });
        
        setTimeout(() => {
            const canvasQr = container.querySelector('canvas');
            const imgQr = canvasQr ? canvasQr.toDataURL() : null;
            criarArquivoPDF(dados, imgQr);
        }, 100);
    }

    // === LAYOUT ORIGINAL NEXUS DIGITAL (MANTIDO) ===
    window.criarArquivoPDF = (d, qr) => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.setLineWidth(0.5); doc.setTextColor(0);
        
        // Cabeçalho Nexus Digital
        doc.setFont("helvetica", "bold"); doc.setFontSize(22);
        doc.text("NEXUS DIGITAL", 105, 20, null, null, "center");
        doc.setFontSize(10); doc.setFont("helvetica", "normal");
        doc.text("Destrava Cell | Soluções Mobile", 105, 26, null, null, "center");
        doc.line(10, 30, 200, 30);

        // Ajusta Título conforme o tipo
        const titulo = d.tipoOperacao === 'compra' ? "RECIBO DE COMPRA (AQUISIÇÃO)" : "RECIBO DE VENDA";
        
        doc.setFontSize(14); doc.setFont("helvetica", "bold");
        doc.text(titulo, 105, 40, null, null, "center");
        
        if(qr) doc.addImage(qr, 'PNG', 170, 10, 30, 30);

        let y = 55;
        const campos = [
            { t: "DADOS DA TRANSAÇÃO", c: [`Data: ${d.dataFormatada}`, `Valor: R$ ${d.valor}`, `Tipo: ${d.tipoOperacao.toUpperCase()}`] },
            { t: "PESSOA (CLIENTE/VENDEDOR)", c: [`Nome: ${d.nome}`, `CPF: ${d.cpf}`, `Endereço: ${d.endereco}`] },
            { t: "APARELHO", c: [`Modelo: ${d.modelo}`, `IMEI: ${d.imei}`, `Estado: ${d.estado}`] }
        ];

        campos.forEach(bloco => {
            doc.setFillColor(240,240,240); doc.rect(15, y, 180, 8, 'F');
            doc.setFont("helvetica", "bold"); doc.text(bloco.t, 20, y+6); y+=15;
            doc.setFont("helvetica", "normal");
            bloco.c.forEach(l => { doc.text(l, 20, y); y+=6; });
            y+=5;
        });

        y+=10; 
        doc.setFont("helvetica", "bold"); doc.setFontSize(9);
        doc.text("TERMOS E RESPONSABILIDADE LEGAL:", 20, y); y+=6;
        
        doc.setFont("helvetica", "normal"); doc.setFontSize(8);
        const termos = [
            "1. As partes declaram que a transação é lícita e de boa fé.",
            "2. O aparelho foi verificado e testado no ato da transação.",
            "3. Em caso de bloqueio futuro (Blacklist), o responsável legal será acionado.",
            "4. A posse é transferida neste ato, em caráter irrevogável."
        ];
        termos.forEach(t => { doc.text(t, 20, y); y+=5; });
        
        y+=20;
        if(d.assinatura) { 
            doc.rect(60, y-5, 90, 30); 
            doc.addImage(d.assinatura, 'PNG', 75, y, 60, 25); 
        }
        y+=30; doc.text("ASSINATURA", 105, y, null, null, "center");
        
        doc.save(`Recibo_${d.modelo}.pdf`);
    };

    async function loadHistory() {
        const tb = document.querySelector('#history-table tbody');
        if(!tb) return;
        try {
            const res = await fetch('/api/recibos');
            const lista = await res.json();
            tb.innerHTML = "";
            lista.forEach(i => {
                const tipoDisplay = i.tipoOperacao === 'compra' 
                    ? '<span style="color:#ff4444; font-weight:bold;">COMPRA (SAÍDA)</span>' 
                    : '<span style="color:#00ff88; font-weight:bold;">VENDA (ENTRADA)</span>';

                tb.innerHTML += `
                <tr>
                    <td>${tipoDisplay}</td>
                    <td>${i.nome}</td>
                    <td>${i.modelo}</td>
                    <td>R$ ${i.valor}</td>
                    <td>
                        <button class="btn-icon btn-action" onclick="reimprimirRecibo('${i._id}')" title="Baixar PDF"><i class="fas fa-file-pdf"></i></button>
                        <button class="btn-icon btn-danger" onclick="deletar('${i._id}')" title="Excluir"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>`;
            });
        } catch(e) {}
    }
    window.deletar = async (id) => { await fetch(`/api/recibos/${id}`, {method:'DELETE'}); loadHistory(); };


    // ============================================
    // === 3. FINANCEIRO & PREÇOS ===
    // ============================================
    
    window.carregarFinanceiro = async () => {
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
                <td><button class="btn-icon btn-danger" onclick="deletarFin('${item._id}')"><i class="fas fa-trash"></i></button></td></tr>`;
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


    // === TABELA DE PREÇOS ===
    // ATENÇÃO: COLE AQUI SUA LISTA COMPLETA DE PREÇOS SE ELA TIVER SIDO APAGADA
    const bancoPrecos = [
        { m: "Samsung", mod: "Galaxy A01 Core", serv: "100", blq: "50", ok: "150" },
        { m: "Samsung", mod: "Galaxy A10", serv: "120", blq: "80", ok: "200" },
        // ... COLE O RESTANTE DA SUA LISTA AQUI ...
    ];

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
