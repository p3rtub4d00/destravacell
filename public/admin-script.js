document.addEventListener('DOMContentLoaded', () => {

    // === VARIÁVEIS GLOBAIS ===
    let padCompras = null;
    let padOS = null;
    let intervaloQR = null;

    // === INICIALIZAR CANVAS COM SEGURANÇA ===
    function initPads() {
        const c1 = document.getElementById('signature-pad');
        if (c1) padCompras = new SignaturePad(c1, { backgroundColor: 'rgb(255, 255, 255)' });

        const c2 = document.getElementById('signature-pad-os');
        if (c2) padOS = new SignaturePad(c2, { backgroundColor: 'rgb(255, 255, 255)' });
    }

    // Redimensiona o canvas para não ficar com tamanho 0 quando oculto
    function resizePad(padInstance, canvasId) {
        const canvas = document.getElementById(canvasId);
        if (canvas && padInstance) {
            const ratio = Math.max(window.devicePixelRatio || 1, 1);
            canvas.width = canvas.offsetWidth * ratio;
            canvas.height = canvas.offsetHeight * ratio;
            canvas.getContext("2d").scale(ratio, ratio);
            padInstance.clear(); // Limpa pra evitar distorção
        }
    }

    // === NAVEGAÇÃO ENTRE ABAS ===
    window.abrirAba = (aba) => {
        // Esconde tudo
        document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

        // Mostra a desejada
        document.getElementById(`tab-${aba}`).classList.add('active');
        document.getElementById(`btn-tab-${aba}`).classList.add('active');

        // Lógica Específica de cada aba
        if (aba === 'compras') {
            loadRecibos();
            setTimeout(() => resizePad(padCompras, 'signature-pad'), 100);
        }
        if (aba === 'os') {
            carregarOS();
        }
        if (aba === 'financeiro') {
            carregarFinanceiro();
        }
    };

    // Inicializa
    initPads();
    abrirAba('compras');

    // ============================================================
    // === MÓDULO 1: RECIBOS (COMPRA DE CELULAR) ===
    // ============================================================

    window.gerarPDFRecibo = async () => {
        if (!padCompras || padCompras.isEmpty()) return alert("Assinatura obrigatória!");

        const dados = {
            nome: document.getElementById('nome').value,
            cpf: document.getElementById('cpf').value,
            rg: document.getElementById('rg').value,
            endereco: document.getElementById('endereco').value,
            modelo: document.getElementById('modelo').value,
            imei: document.getElementById('imei').value,
            valor: document.getElementById('valor').value,
            estado: document.getElementById('estado').value,
            assinatura: padCompras.toDataURL(),
            dataFormatada: new Date().toLocaleDateString('pt-BR'),
            horaFormatada: new Date().toLocaleTimeString('pt-BR')
        };

        if(!dados.nome || !dados.valor) return alert("Preencha Nome e Valor!");

        try {
            // Salva no banco
            const res = await fetch('/api/recibos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dados)
            });

            if(res.ok) {
                alert("✅ Recibo Salvo! Gerando PDF...");
                
                // Gera PDF
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF();
                
                doc.setFontSize(20); doc.text("RECIBO DE COMPRA - DESTRAVACELL", 105, 20, null, null, "center");
                doc.setFontSize(12); doc.text(`Data: ${dados.dataFormatada}`, 105, 30, null, null, "center");
                
                let y = 50;
                doc.text(`Eu, ${dados.nome}, CPF ${dados.cpf}, vendo meu aparelho`, 20, y); y+=10;
                doc.text(`Modelo: ${dados.modelo}`, 20, y); y+=10;
                doc.text(`IMEI: ${dados.imei}`, 20, y); y+=10;
                doc.text(`Valor Recebido: R$ ${dados.valor}`, 20, y);
                
                y+=40;
                doc.addImage(dados.assinatura, 'PNG', 60, y, 90, 45);
                
                doc.save(`Recibo_${dados.modelo}.pdf`);
                
                // Limpa tela
                padCompras.clear();
                loadRecibos();
            } else { alert("Erro ao salvar no sistema."); }
        } catch(e) { console.error(e); alert("Erro de conexão."); }
    };

    window.loadRecibos = async () => {
        const tb = document.querySelector('#history-table tbody');
        const res = await fetch('/api/recibos');
        const lista = await res.json();
        tb.innerHTML = "";
        lista.forEach(r => {
            tb.innerHTML += `<tr>
                <td>${new Date(r.dataCriacao).toLocaleDateString()}</td>
                <td>${r.nome}</td>
                <td>${r.modelo}</td>
                <td>R$ ${r.valor}</td>
                <td><button onclick="delRecibo('${r._id}')" class="btn-delete"><i class="fas fa-trash"></i></button></td>
            </tr>`;
        });
    };

    window.delRecibo = async (id) => {
        if(confirm("Apagar recibo?")) {
            await fetch(`/api/recibos/${id}`, { method: 'DELETE' });
            loadRecibos();
        }
    };
    window.limparPadCompras = () => padCompras.clear();


    // ============================================================
    // === MÓDULO 2: ORDEM DE SERVIÇO (OS) ===
    // ============================================================

    const modalOS = document.getElementById('modal-os');

    window.abrirModalOS = (modo, dados=null) => {
        clearInterval(intervaloQR);
        document.getElementById('area-assinatura-qr').style.display = 'none';
        document.getElementById('area-assinatura-pc').style.display = 'block';
        document.getElementById('qrcode-os').innerHTML = '';
        
        // Reset campos
        document.querySelectorAll('#modal-os input, #modal-os textarea').forEach(i => {
            if(i.type === 'checkbox') i.checked = false;
            else i.value = '';
        });
        document.getElementById('os-total-display').innerText = '0,00';
        
        // Reset Pad
        if(padOS) {
            padOS.clear();
            setTimeout(() => resizePad(padOS, 'signature-pad-os'), 200);
        }

        if(modo === 'editar' && dados) {
            document.getElementById('modal-os-title').innerText = `Editar OS #${dados.osNumber}`;
            document.getElementById('os-id-hidden').value = dados._id;
            
            // Preencher...
            document.getElementById('os-cliente').value = dados.cliente.nome;
            document.getElementById('os-tel').value = dados.cliente.telefone;
            document.getElementById('os-modelo').value = dados.aparelho.modelo;
            document.getElementById('os-imei').value = dados.aparelho.imei;
            document.getElementById('os-senha').value = dados.aparelho.senha || '';
            document.getElementById('os-acessorios').value = dados.aparelho.acessorios || '';
            document.getElementById('os-obs').value = dados.checklist.obs || '';
            document.getElementById('os-defeito').value = dados.servico.defeitoRelatado || '';
            
            document.getElementById('os-pecas').value = dados.financeiro.custoPecas;
            document.getElementById('os-mao').value = dados.financeiro.maoDeObra;
            document.getElementById('os-desconto').value = dados.financeiro.desconto;
            document.getElementById('os-sinal').value = dados.financeiro.sinal;
            document.getElementById('os-total-display').innerText = dados.financeiro.total.toFixed(2);
            
            if(dados.checklist.liga) document.getElementById('chk-liga').checked = true;
            if(dados.checklist.tela) document.getElementById('chk-tela').checked = true;
            if(dados.checklist.touch) document.getElementById('chk-touch').checked = true;

            if(dados.assinaturaCliente && padOS) padOS.fromDataURL(dados.assinaturaCliente);
        } else {
            document.getElementById('modal-os-title').innerText = "Nova OS";
            document.getElementById('os-id-hidden').value = "";
        }

        modalOS.style.display = 'flex';
    };

    window.fecharModalOS = () => modalOS.style.display = 'none';

    // Cálculo Automático
    ['os-pecas', 'os-mao', 'os-desconto'].forEach(id => {
        document.getElementById(id).addEventListener('input', () => {
            const p = parseFloat(document.getElementById('os-pecas').value) || 0;
            const m = parseFloat(document.getElementById('os-mao').value) || 0;
            const d = parseFloat(document.getElementById('os-desconto').value) || 0;
            document.getElementById('os-total-display').innerText = ((p+m)-d).toFixed(2);
        });
    });

    window.salvarOS = async () => {
        const id = document.getElementById('os-id-hidden').value;
        const assinatura = (padOS && !padOS.isEmpty()) ? padOS.toDataURL() : null;

        const dados = {
            cliente: { 
                nome: document.getElementById('os-cliente').value,
                telefone: document.getElementById('os-tel').value
            },
            aparelho: {
                modelo: document.getElementById('os-modelo').value,
                imei: document.getElementById('os-imei').value,
                senha: document.getElementById('os-senha').value,
                acessorios: document.getElementById('os-acessorios').value
            },
            checklist: {
                liga: document.getElementById('chk-liga').checked,
                tela: document.getElementById('chk-tela').checked,
                touch: document.getElementById('chk-touch').checked,
                obs: document.getElementById('os-obs').value
            },
            servico: { defeitoRelatado: document.getElementById('os-defeito').value },
            financeiro: {
                custoPecas: document.getElementById('os-pecas').value || 0,
                maoDeObra: document.getElementById('os-mao').value || 0,
                desconto: document.getElementById('os-desconto').value || 0,
                sinal: document.getElementById('os-sinal').value || 0,
                total: parseFloat(document.getElementById('os-total-display').innerText)
            },
            assinaturaCliente: assinatura
        };

        const url = id ? `/api/os/${id}` : '/api/os';
        const method = id ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method: method,
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(dados)
        });

        if(res.ok) {
            alert("✅ OS Salva!");
            fecharModalOS();
            carregarOS();
        } else { alert("Erro ao salvar OS"); }
    };

    window.carregarOS = async () => {
        const tb = document.getElementById('lista-os-body');
        const res = await fetch('/api/os');
        const lista = await res.json();
        tb.innerHTML = "";
        
        lista.forEach(os => {
            const total = os.financeiro.total || 0;
            const sinal = os.financeiro.sinal || 0;
            const restante = total - sinal;
            const statusPag = os.financeiro.statusPagamento || 'Pendente';
            
            let cor = '#888';
            if(os.servico.status === 'Pronto') cor = '#00ff88';
            if(os.servico.status === 'Entregue') cor = '#00d4ff';

            tb.innerHTML += `<tr>
                <td>#${os.osNumber}</td>
                <td>${os.cliente.nome}</td>
                <td>${os.aparelho.modelo}</td>
                <td><b style="color:${cor}">${os.servico.status}</b></td>
                <td>R$ ${total.toFixed(2)} <br><small>${statusPag}</small></td>
                <td>
                    <button class="btn-action" onclick="editarOS('${os._id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn-action" onclick="imprimirOS('${os._id}')"><i class="fas fa-print"></i></button>
                    <button class="btn-action" onclick="mudarStatus('${os._id}', '${os.servico.status}', ${restante}, '${os.cliente.nome}')" title="Mudar Status"><i class="fas fa-exchange-alt"></i></button>
                </td>
            </tr>`;
        });
    };

    window.editarOS = async (id) => {
        const res = await fetch(`/api/os/${id}`);
        const os = await res.json();
        abrirModalOS('editar', os);
    };

    window.imprimirOS = async (id) => {
        const res = await fetch(`/api/os/${id}`);
        const os = await res.json();
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        doc.setFontSize(22); doc.text(`OS #${os.osNumber}`, 105, 20, null, null, "center");
        doc.setFontSize(12);
        doc.text(`Cliente: ${os.cliente.nome} | Tel: ${os.cliente.telefone}`, 20, 40);
        doc.text(`Aparelho: ${os.aparelho.modelo}`, 20, 50);
        doc.text(`Defeito: ${os.servico.defeitoRelatado}`, 20, 60);
        doc.text(`Checklist Obs: ${os.checklist.obs || 'Nenhuma'}`, 20, 70);
        
        doc.setFontSize(14); doc.setFont("helvetica", "bold");
        doc.text(`TOTAL: R$ ${os.financeiro.total.toFixed(2)}`, 20, 90);
        
        if(os.assinaturaCliente) doc.addImage(os.assinaturaCliente, 'PNG', 60, 110, 80, 40);
        
        doc.save(`OS_${os.osNumber}.pdf`);
    };

    // MUDANÇA DE STATUS E PAGAMENTO
    window.mudarStatus = async (id, statusAtual, valorRestante, nome) => {
        const novo = prompt("Novo Status (Pronto, Entregue, Aguardando...)", "Pronto");
        if(!novo) return;

        let payload = { "servico.status": novo };
        let pagar = false;

        if(novo.toLowerCase() === 'entregue' && valorRestante > 0) {
            if(confirm(`O cliente pagou o restante de R$ ${valorRestante.toFixed(2)}?`)) {
                pagar = true;
                payload["financeiro.statusPagamento"] = "Pago";
            }
        }

        await fetch(`/api/os/${id}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });

        if(pagar) {
            await fetch('/api/financeiro', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    tipo: 'entrada',
                    descricao: `Pagamento Final OS #${id} (${nome})`,
                    valor: valorRestante
                })
            });
            alert("💰 Valor lançado no Caixa!");
        }
        carregarOS();
    };

    // Assinatura Tabs
    window.abaAssinatura = (tipo) => {
        if(tipo === 'pc') {
            document.getElementById('area-assinatura-pc').style.display = 'block';
            document.getElementById('area-assinatura-qr').style.display = 'none';
        } else {
            document.getElementById('area-assinatura-pc').style.display = 'none';
            document.getElementById('area-assinatura-qr').style.display = 'block';
        }
    };
    window.limparPadOS = () => padOS.clear();

    window.gerarQRCodeOS = async () => {
        const id = document.getElementById('os-id-hidden').value;
        if(!id) return alert("Salve a OS antes de gerar o QR Code!");
        
        abaAssinatura('qr');
        const box = document.getElementById('qrcode-os');
        box.innerHTML = "";
        
        const link = `${window.location.origin}/assinatura-os.html?id=${id}`;
        new QRCode(box, { text: link, width: 200, height: 200 });

        intervaloQR = setInterval(async () => {
            const r = await fetch(`/api/os/${id}`);
            const o = await r.json();
            if(o.assinaturaCliente) {
                clearInterval(intervaloQR);
                alert("Assinatura Recebida!");
                padOS.fromDataURL(o.assinaturaCliente);
                abaAssinatura('pc');
            }
        }, 3000);
    };


    // ============================================================
    // === MÓDULO 3: FINANCEIRO (CAIXA) ===
    // ============================================================

    window.carregarFinanceiro = async () => {
        const tb = document.querySelector('#finance-table tbody');
        const res = await fetch('/api/financeiro');
        const lista = await res.json();
        
        let tot=0, ent=0, sai=0;
        tb.innerHTML = "";
        
        lista.forEach(i => {
            const v = parseFloat(i.valor);
            if(i.tipo==='entrada') { ent+=v; tot+=v; } else { sai+=v; tot-=v; }
            
            tb.innerHTML += `<tr>
                <td>${new Date(i.data).toLocaleDateString()}</td>
                <td>${i.descricao}</td>
                <td style="color:${i.tipo==='entrada'?'#00ff88':'#ff4444'}">${i.tipo.toUpperCase()}</td>
                <td>R$ ${v.toFixed(2)}</td>
                <td><button onclick="delFin('${i._id}')" class="btn-delete">X</button></td>
            </tr>`;
        });
        
        document.getElementById('dash-saldo').innerText = `R$ ${tot.toFixed(2)}`;
        document.getElementById('dash-entradas').innerText = `R$ ${ent.toFixed(2)}`;
        document.getElementById('dash-saidas').innerText = `R$ ${sai.toFixed(2)}`;
    };

    window.salvarFinanceiro = async () => {
        const d = document.getElementById('fin-desc').value;
        const v = document.getElementById('fin-valor').value;
        const t = document.getElementById('fin-tipo').value;
        
        if(!d || !v) return alert("Preencha tudo!");

        await fetch('/api/financeiro', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ descricao: d, valor: v, tipo: t })
        });
        
        document.getElementById('fin-desc').value = "";
        document.getElementById('fin-valor').value = "";
        carregarFinanceiro();
    };

    window.delFin = async (id) => {
        if(confirm("Apagar?")) {
            await fetch(`/api/financeiro/${id}`, { method: 'DELETE' });
            carregarFinanceiro();
        }
    };

    window.logout = async () => { 
        await fetch('/api/logout', { method: 'POST' }); 
        window.location.href = 'login.html'; 
    };

});
