document.addEventListener('DOMContentLoaded', () => {
    
    window.logout = async () => { await fetch('/api/logout', {method:'POST'}); window.location.href = 'login.html'; };

    // ============================================
    // === 1. ORDEM DE SERVIÇO (OS) ===
    // ============================================

    let osAtualID = null;

    window.carregarDropdownPecas = async () => {
        const select = document.getElementById('os-peca-estoque');
        if(!select) return;
        try {
            const res = await fetch('/api/estoque');
            const lista = await res.json();
            select.innerHTML = '<option value="">-- Nenhuma / Apenas Serviço --</option>';
            lista.forEach(p => {
                if(p.quantidade > 0) {
                    const opt = document.createElement('option');
                    opt.value = p._id;
                    opt.textContent = `${p.nome} (Qtd: ${p.quantidade})`;
                    select.appendChild(opt);
                }
            });
        } catch(e) {}
    };

    window.criarOS = async () => {
        const btn = document.querySelector('#tab-os .btn-generate');
        const originalText = btn.innerHTML;
        btn.innerText = "Criando..."; btn.disabled = true;

        const selectPeca = document.getElementById('os-peca-estoque');
        const idPeca = selectPeca.value;
        const nomePeca = idPeca ? selectPeca.options[selectPeca.selectedIndex].text : null;

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
            servico: document.getElementById('os-servico').value,
            estadoGeral: document.getElementById('os-estado').value, // CAPTURA O ESTADO GERAL
            defeitoRelatado: document.getElementById('os-defeito').value,
            valor: document.getElementById('os-valor').value,
            idPecaVinculada: idPeca,
            nomePecaVinculada: nomePeca
        };

        if(!dados.cliente.nome || !dados.aparelho.modelo) {
            alert("Preencha pelo menos Nome e Modelo.");
            btn.innerHTML = originalText; btn.disabled = false;
            return;
        }

        try {
            const res = await fetch('/api/os', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(dados) });
            const os = await res.json();
            osAtualID = os._id;

            const area = document.getElementById('area-assinatura-os');
            const qrDiv = document.getElementById('qrcode-os-display');
            area.style.display = 'block';
            qrDiv.innerHTML = "";
            new QRCode(qrDiv, { text: `${window.location.origin}/assinatura-os.html?id=${os._id}`, width: 200, height: 200 });

            area.scrollIntoView({ behavior: 'smooth' });
            carregarOSHistory();
            
            let msg = "OS Criada!";
            if(nomePeca) msg += ` Peça reservada: ${nomePeca}`;
            alert(msg);

        } catch(e) { alert("Erro ao criar OS: " + e.message); }
        finally { btn.innerHTML = originalText; btn.disabled = false; }
    };

    window.verificarAssinaturaEImprimir = async () => {
        if(!osAtualID) return alert("Nenhuma OS selecionada recentemente.");
        try {
            const res = await fetch(`/api/os/${osAtualID}?t=${Date.now()}`);
            const os = await res.json();
            if(os.assinaturaCliente) {
                alert("✅ Assinatura CONFIRMADA! Gerando PDF...");
                document.getElementById('area-assinatura-os').style.display = 'none';
                gerarPDFOS(os);
                limparFormularioOS();
            } else { alert("❌ O cliente ainda não enviou a assinatura."); }
        } catch(e) { alert("Erro."); }
    };

    window.concluirOS = async (id) => {
        const valorStr = prompt("Valor final recebido? (Ponto ou vírgula)");
        if(valorStr === null) return;
        const valor = parseFloat(valorStr.replace(',', '.'));
        if(isNaN(valor) || valor <= 0) return alert("Valor inválido.");

        try {
            const res = await fetch(`/api/os/${id}/concluir`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ valorFinal: valor }) });
            if(res.ok) { 
                alert(`✅ OS Concluída! R$ ${valor.toFixed(2)} lançado no Caixa.`); 
                carregarOSHistory(); 
                carregarDropdownPecas();
            }
        } catch(e) { alert("Erro."); }
    };
    
    window.enviarZap = (telefone, modelo, status) => {
        if(!telefone) return alert("Cliente sem telefone.");
        const num = telefone.replace(/\D/g, '');
        let msg = status === 'Concluido' 
            ? `Olá! Aqui é da Destrava Cell. Seu aparelho ${modelo} já está pronto e disponível para retirada! 🚀`
            : `Olá! Aqui é da Destrava Cell. Passando para informar sobre seu aparelho ${modelo}. Status atual: ${status}.`;
        window.open(`https://wa.me/55${num}?text=${encodeURIComponent(msg)}`, '_blank');
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
                let statusBadge = os.status === "Concluido" ? `<span style="color:#00ff88;font-weight:bold;">CONCLUÍDO</span>` : `<span style="color:#fff;">${os.status}</span>`;
                
                let botoes = `<button class="btn-icon btn-zap" onclick="enviarZap('${os.cliente.telefone}', '${os.aparelho.modelo}', '${os.status}')"><i class="fab fa-whatsapp"></i></button>`;
                if(os.status !== "Concluido") botoes += `<button class="btn-icon btn-conclude" onclick="concluirOS('${os._id}')"><i class="fas fa-check"></i></button>`;
                botoes += `<button class="btn-icon btn-action" onclick="reimprimirOS('${os._id}')"><i class="fas fa-file-pdf"></i></button>`;
                botoes += `<button class="btn-icon btn-danger" onclick="deletarOS('${os._id}')"><i class="fas fa-trash"></i></button>`;

                tr.innerHTML = `<td>#${os.numeroOS ? os.numeroOS.toString().slice(-4) : '---'}</td><td>${data}</td><td>${os.cliente.nome}</td><td>${statusBadge}</td><td>${botoes}</td>`;
                tb.appendChild(tr);
            });
        } catch(e) { tb.innerHTML = ""; }
    };

    window.reimprimirOS = async (id) => { const res = await fetch(`/api/os/${id}?t=${Date.now()}`); gerarPDFOS(await res.json()); };
    window.deletarOS = async (id) => { if(confirm("Apagar?")) { await fetch(`/api/os/${id}`, {method: 'DELETE'}); carregarOSHistory(); }};

    function limparFormularioOS() {
        document.querySelectorAll('#tab-os input, #tab-os textarea').forEach(i => i.value = '');
        document.getElementById('os-peca-estoque').value = "";
        osAtualID = null;
    }

    // PDF OS
    function gerarPDFOS(os) {
        let qrContainer = document.getElementById('temp-qr-rastreio');
        if(!qrContainer) {
            qrContainer = document.createElement('div');
            qrContainer.id = 'temp-qr-rastreio';
            qrContainer.style.display = 'none';
            document.body.appendChild(qrContainer);
        }
        qrContainer.innerHTML = "";
        
        const linkStatus = `${window.location.origin}/status.html`;
        new QRCode(qrContainer, { text: linkStatus, width: 100, height: 100 });

        setTimeout(() => {
            const canvasQr = qrContainer.querySelector('canvas');
            const imgQrRastreio = canvasQr ? canvasQr.toDataURL() : null;

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // TITULO DESTRAVA CELL
            doc.setFont("helvetica", "bold"); doc.setFontSize(22);
            doc.text("DESTRAVA CELL", 105, 15, null, null, "center");
            doc.setFontSize(10); doc.setFont("helvetica", "normal");
            doc.text("Soluções Mobile e Assistência Técnica", 105, 22, null, null, "center");
            
            doc.line(10, 25, 200, 25);
            
            doc.setFontSize(12); doc.setFont("helvetica", "bold");
            doc.text(`ORDEM DE SERVIÇO Nº ${os.numeroOS || '---'}`, 15, 35);
            doc.setFontSize(10); doc.setFont("helvetica", "normal");
            doc.text(`Data: ${new Date(os.dataEntrada).toLocaleString('pt-BR')}`, 15, 42);

            if(imgQrRastreio) {
                doc.addImage(imgQrRastreio, 'PNG', 170, 10, 25, 25);
                doc.setFontSize(7);
                doc.text("ACOMPANHE", 182, 38, null, null, "center");
                doc.setFontSize(10);
            }

            let y = 50;

            // CLIENTE
            doc.setFillColor(230,230,230); doc.rect(10, y, 190, 8, 'F'); doc.setFont("helvetica", "bold"); doc.text("CLIENTE", 15, y+6); y+=15;
            doc.setFont("helvetica", "normal"); doc.text(`Nome: ${os.cliente.nome}`, 15, y); doc.text(`Tel: ${os.cliente.telefone}`, 120, y); y+=7;
            doc.text(`CPF: ${os.cliente.cpf}`, 15, y); y+=10;

            // APARELHO
            doc.setFillColor(230,230,230); doc.rect(10, y, 190, 8, 'F'); doc.setFont("helvetica", "bold"); doc.text("APARELHO E SERVIÇO", 15, y+6); y+=15;
            doc.setFont("helvetica", "normal"); 
            doc.text(`Modelo: ${os.aparelho.modelo}`, 15, y); 
            doc.text(`IMEI: ${os.aparelho.imei}`, 100, y); y+=7;
            
            // ESTADO GERAL AGORA APARECE NO PDF
            doc.text(`Estado Geral: ${os.estadoGeral || '-'}`, 15, y); 
            doc.text(`Senha: ${os.aparelho.senha||'-'}`, 100, y); y+=7;
            
            doc.text(`Acessórios: ${os.aparelho.acessorios||'-'}`, 15, y); y+=10;
            
            doc.setFont("helvetica", "bold"); doc.text("Serviço:", 15, y); doc.setFont("helvetica", "normal"); doc.text(os.servico||'-', 35, y); y+=7;
            doc.setFont("helvetica", "bold"); doc.text("Defeito:", 15, y); doc.setFont("helvetica", "normal"); doc.text(os.defeitoRelatado||'-', 35, y); y+=15;

            if(os.nomePecaVinculada) {
                 doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.text(`Peça: ${os.nomePecaVinculada}`, 15, y-3); doc.setFontSize(10);
            }

            // CHECKLIST
            doc.setFillColor(230,230,230); doc.rect(10, y, 190, 8, 'F'); doc.setFont("helvetica", "bold"); doc.text("CHECKLIST", 15, y+6); y+=15;
            const ck = os.checklist; doc.setFontSize(9);
            doc.text(`Tela: ${ck.tela} | Bat: ${ck.bateria} | Carc: ${ck.carcaca}`, 15, y); y+=7;
            doc.text(`Bot: ${ck.botoes} | Câm: ${ck.cameras} | Som: ${ck.som}`, 15, y); y+=7;
            doc.text(`Rede: ${ck.conectividade} | Sens: ${ck.sensores}`, 15, y); y+=15;

            // AREA DE TOTAIS E ORÇAMENTO (Posicionada no fim, à direita)
            if(os.valor) {
                // Desenha uma linha separadora antes
                doc.line(10, y, 200, y); y+=10;
                
                // Caixa alinhada a direita
                doc.setFontSize(12); doc.setFont("helvetica", "bold");
                doc.text("TOTAL ORÇAMENTO:", 120, y);
                doc.setFontSize(16);
                doc.text(`R$ ${os.valor}`, 190, y, null, null, "right");
                y+=10;
            }

            doc.setFontSize(8); doc.setTextColor(100);
            ["1. Garantia de 90 dias.", "2. Não nos responsabilizamos por dados.", "3. Aparelhos não retirados em 90 dias serão vendidos."].forEach(t=>{doc.text(t,15,y);y+=5;});

            y+=15; doc.setTextColor(0);
            if(os.assinaturaCliente) { doc.addImage(os.assinaturaCliente, 'PNG', 70, y, 60, 25); y+=25; doc.text("Assinatura Cliente", 105, y, null, null, "center"); }
            else { y+=20; doc.line(60, y, 150, y); doc.text("Assinatura Cliente", 105, y+5, null, null, "center"); }
            
            doc.save(`OS_${os.numeroOS}.pdf`);
        }, 300);
    }

    // --- RECIBOS ---
    const canvas = document.getElementById('signature-pad');
    if(canvas) {
        const signaturePad = new SignaturePad(canvas, { backgroundColor: '#fff', penColor: '#000' });
        function resizeCanvas() { const r = Math.max(window.devicePixelRatio||1,1); canvas.width=canvas.offsetWidth*r; canvas.height=canvas.offsetHeight*r; canvas.getContext("2d").scale(r,r); }
        window.addEventListener("resize", resizeCanvas); resizeCanvas();
        document.getElementById('clear-pad').addEventListener('click', ()=>signaturePad.clear());
        loadHistory(); 

        window.gerarPDF = async () => {
             if (signaturePad.isEmpty()) { alert("Assinatura obrigatória!"); return; }
             const btn = document.querySelector('#tab-recibo .btn-generate');
             const txt = btn.innerHTML; btn.innerHTML = "Processando..."; btn.disabled = true;
             const dados = {
                tipoOperacao: document.getElementById('tipo-recibo').value,
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
                alert("Recibo Salvo!"); signaturePad.clear(); loadHistory();
            } catch (e) { alert("Erro: " + e.message); } finally { btn.innerHTML = txt; btn.disabled = false; }
        };
    }
    window.reimprimirRecibo = async (id) => { try { const res = await fetch(`/api/recibos/${id}`); gerarQRCodeEPDF(await res.json()); } catch(e) {} };
    function gerarQRCodeEPDF(d) {
        let c = document.getElementById("qrcode-container"); if(!c){c=document.createElement('div');c.id="qrcode-container";c.style.display="none";document.body.appendChild(c);}
        c.innerHTML = "";
        const lbl = d.tipoOperacao==='compra'?'COMPRA':'VENDA';
        new QRCode(c, { text: `NEXUS|${lbl}|ID:${d._id}|$${d.valor}`, width: 100, height: 100 });
        setTimeout(() => { const qr = c.querySelector('canvas'); criarArquivoPDF(d, qr?qr.toDataURL():null); }, 100);
    }
    window.criarArquivoPDF = (d, qr) => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.setLineWidth(0.5); doc.setTextColor(0);
        doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.text("DESTRAVA CELL", 105, 20, null, null, "center");
        doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.text("Soluções Mobile e Assistência Técnica", 105, 26, null, null, "center");
        doc.line(10, 30, 200, 30);
        const t = d.tipoOperacao==='compra'?"RECIBO DE COMPRA (AQUISIÇÃO)":"RECIBO DE VENDA";
        doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.text(t, 105, 40, null, null, "center");
        if(qr) doc.addImage(qr, 'PNG', 170, 10, 30, 30);
        let y = 55;
        const campos = [{t:"DADOS",c:[`Data: ${d.dataFormatada}`, `Valor: R$ ${d.valor}`, `Tipo: ${d.tipoOperacao.toUpperCase()}`]},{t:"PESSOA",c:[`Nome: ${d.nome}`, `CPF: ${d.cpf}`, `End.: ${d.endereco}`]},{t:"APARELHO",c:[`Modelo: ${d.modelo}`, `IMEI: ${d.imei}`, `Estado: ${d.estado}`]}];
        campos.forEach(b => { doc.setFillColor(240,240,240); doc.rect(15, y, 180, 8, 'F'); doc.setFont("helvetica", "bold"); doc.text(b.t, 20, y+6); y+=15; doc.setFont("helvetica", "normal"); b.c.forEach(l => { doc.text(l, 20, y); y+=6; }); y+=5; });
        y+=10; doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text("TERMOS:", 20, y); y+=6; doc.setFont("helvetica", "normal"); doc.setFontSize(8);
        ["1. Transação lícita.", "2. Aparelho verificado.", "3. Bloqueios futuros (Blacklist/Roubo) responsabilidade do vendedor.", "4. Posse transferida.", "5. NÃO nos responsabilizamos por débitos anteriores (PayJoy)."].forEach(l=>{doc.text(l,20,y);y+=5;});
        y+=20; if(d.assinatura) { doc.rect(60,y-5,90,30); doc.addImage(d.assinatura,'PNG',75,y,60,25); }
        y+=30; doc.text("ASSINATURA", 105, y, null, null, "center");
        doc.save(`Recibo_${d.modelo}.pdf`);
    };
    async function loadHistory() {
        const tb = document.querySelector('#history-table tbody'); if(!tb) return;
        try {
            const res = await fetch('/api/recibos'); const l = await res.json(); tb.innerHTML = "";
            l.forEach(i => {
                const cor = i.tipoOperacao === 'compra' ? '#ff4444' : '#00ff88';
                tb.innerHTML += `<tr><td><span style="color:${cor};font-weight:bold;">${i.tipoOperacao.toUpperCase()}</span></td><td>${i.nome}</td><td>${i.modelo}</td><td>R$ ${i.valor}</td><td><button class="btn-icon btn-action" onclick="reimprimirRecibo('${i._id}')"><i class="fas fa-file-pdf"></i></button><button class="btn-icon btn-danger" onclick="deletar('${i._id}')"><i class="fas fa-trash"></i></button></td></tr>`;
            });
        } catch(e) {}
    }
    window.deletar = async (id) => { await fetch(`/api/recibos/${id}`, {method:'DELETE'}); loadHistory(); };

    // --- ESTOQUE (OPÇÃO 4) ---
    window.carregarEstoque = async () => {
        const tb = document.querySelector('#estoque-table tbody');
        if(!tb) return; 
        try {
            const res = await fetch('/api/estoque');
            const lista = await res.json();
            tb.innerHTML = "";
            lista.forEach(item => {
                tb.innerHTML += `<tr><td>${item.nome}</td><td><span style="color:${item.quantidade<3?'#f44':'#fff'}">${item.quantidade}</span></td><td>R$ ${item.valorCusto}</td><td><button class="btn-icon btn-danger" onclick="deletarEstoque('${item._id}')"><i class="fas fa-trash"></i></button></td></tr>`;
            });
        } catch(e){}
    };
    window.salvarEstoque = async () => {
        const nome = document.getElementById('est-nome').value;
        const qtd = document.getElementById('est-qtd').value;
        const custo = document.getElementById('est-custo').value;
        if(!nome) return alert("Nome obrigatório");
        await fetch('/api/estoque', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({nome, quantidade:qtd, valorCusto:custo})});
        alert("Produto adicionado!");
        document.getElementById('est-nome').value = ""; document.getElementById('est-qtd').value="";
        carregarEstoque();
    };
    window.deletarEstoque = async(id) => { if(confirm("Apagar produto?")) { await fetch(`/api/estoque/${id}`, {method:'DELETE'}); carregarEstoque(); }};

    // --- FINANCEIRO ---
    window.carregarFinanceiro = async () => {
        const tb = document.querySelector('#finance-table tbody');
        try {
            const res = await fetch('/api/financeiro'); const l = await res.json();
            let t=0,e=0,s=0; tb.innerHTML="";
            l.forEach(i=>{ const v=parseFloat(i.valor); if(i.tipo==='entrada'){e+=v;t+=v;}else{s+=v;t-=v;} tb.innerHTML+=`<tr><td>${new Date(i.data).toLocaleDateString()}</td><td>${i.descricao}</td><td style="color:${i.tipo==='entrada'?'#0f8':'#f44'}">R$ ${v.toFixed(2)}</td><td><button class="btn-icon btn-danger" onclick="deletarFin('${i._id}')"><i class="fas fa-trash"></i></button></td></tr>`; });
            document.getElementById('dash-saldo').innerText=`R$ ${t.toFixed(2)}`;
            document.getElementById('dash-entradas').innerText=`R$ ${e.toFixed(2)}`;
            document.getElementById('dash-saidas').innerText=`R$ ${s.toFixed(2)}`;
        } catch(e){}
    };
    window.salvarFinanceiro = async () => {
        const d=document.getElementById('fin-desc').value, v=document.getElementById('fin-valor').value, t=document.getElementById('fin-tipo').value;
        await fetch('/api/financeiro',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({descricao:d,valor:v,tipo:t})});
        carregarFinanceiro();
        document.getElementById('fin-desc').value=""; document.getElementById('fin-valor').value="";
    };
    window.deletarFin=async(id)=>{await fetch(`/api/financeiro/${id}`,{method:'DELETE'});carregarFinanceiro();};

    // --- PREÇOS ---
    // *** ATENÇÃO: COLE SUA LISTA DE PREÇOS COMPLETA AQUI ABAIXO ***
    const bancoPrecos = [
        { m: "Samsung", mod: "Galaxy A01 Core", serv: "100", blq: "50", ok: "150" },
        // ... COLE O RESTANTE DA SUA LISTA AQUI ...
    ];
    const inp = document.getElementById('search-input'); const resC = document.getElementById('results-container');
    if(inp){
        inp.addEventListener('input',(e)=>{
            const t=e.target.value.toLowerCase(); resC.innerHTML=''; if(t.length<2)return;
            bancoPrecos.filter(p=>p.mod.toLowerCase().includes(t)).forEach(p=>{
                resC.innerHTML+=`<div class="price-card"><div class="model-header"><span class="model-name">${p.mod}</span><span class="brand-badge">${p.m}</span></div><div class="price-grid"><div class="price-box"><span class="price-label">Serviço</span><span class="price-value" style="color:#00ff88">R$ ${p.serv}</span></div><div class="price-box"><span class="price-label">Bloq</span><span class="price-value" style="color:#ffaa00">R$ ${p.blq}</span></div><div class="price-box"><span class="price-label">OK</span><span class="price-value" style="color:#fff">R$ ${p.ok}</span></div></div></div>`;
            });
        });
    }
});
