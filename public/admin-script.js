document.addEventListener('DOMContentLoaded', () => {

    // === VARIÁVEIS GLOBAIS ===
    let signaturePadCompras = null;
    let signaturePadOS = null;
    let intervaloVerificacaoAssinatura = null;

    // === INICIALIZAÇÃO DOS CANVAS (ASSINATURAS) ===
    function initCanvas() {
        // Canvas da Aba Compras
        const canvasCompras = document.getElementById('signature-pad');
        if (canvasCompras && !signaturePadCompras) {
            signaturePadCompras = new SignaturePad(canvasCompras, { backgroundColor: 'rgb(255, 255, 255)' });
        }

        // Canvas do Modal OS
        const canvasOS = document.getElementById('signature-pad-os');
        if (canvasOS && !signaturePadOS) {
            signaturePadOS = new SignaturePad(canvasOS, { backgroundColor: 'rgb(255, 255, 255)' });
        }
    }

    // Função para ajustar tamanho do canvas quando a aba abre
    function resizeCanvas(pad, canvasId) {
        const canvas = document.getElementById(canvasId);
        if (canvas && pad) {
            const ratio = Math.max(window.devicePixelRatio || 1, 1);
            canvas.width = canvas.offsetWidth * ratio;
            canvas.height = canvas.offsetHeight * ratio;
            canvas.getContext("2d").scale(ratio, ratio);
            pad.clear(); // Limpa ao redimensionar para evitar borrões
        }
    }

    // === NAVEGAÇÃO DE ABAS ===
    window.abrirAba = (abaNome) => {
        // Esconde todas as abas e desativa botões
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        
        // Ativa a aba desejada
        const abaAlvo = document.getElementById(`tab-${abaNome}`);
        if(abaAlvo) abaAlvo.classList.add('active');

        // Ativa o botão correspondente
        const btns = document.querySelectorAll('.tab-btn');
        if(abaNome === 'compras') btns[0].classList.add('active');
        if(abaNome === 'os') btns[1].classList.add('active');
        if(abaNome === 'financeiro') btns[2].classList.add('active');

        // Carrega dados específicos
        if(abaNome === 'os') carregarOS();
        if(abaNome === 'financeiro') carregarFinanceiro();
        if(abaNome === 'compras') {
            loadHistory();
            setTimeout(() => resizeCanvas(signaturePadCompras, 'signature-pad'), 100);
        }
    };

    // Inicializa Canvas na carga
    initCanvas();
    // Abre aba inicial
    abrirAba('compras');


    // ============================================================
    // === MÓDULO 1: COMPRAS E RECIBOS (RESTAURADO) ===
    // ============================================================

    window.gerarPDF = async () => {
        if (!signaturePadCompras || signaturePadCompras.isEmpty()) { 
            alert("Assinatura obrigatória!"); return; 
        }

        const dados = {
            nome: document.getElementById('nome').value,
            cpf: document.getElementById('cpf').value,
            rg: document.getElementById('rg').value,
            endereco: document.getElementById('endereco').value,
            modelo: document.getElementById('modelo').value,
            imei: document.getElementById('imei').value,
            valor: document.getElementById('valor').value,
            estado: document.getElementById('estado').value,
            assinatura: signaturePadCompras.toDataURL(),
            dataFormatada: new Date().toLocaleDateString('pt-BR'),
            horaFormatada: new Date().toLocaleTimeString('pt-BR')
        };

        if(!dados.nome || !dados.modelo || !dados.valor) {
            return alert("Preencha Nome, Modelo e Valor!");
        }

        try {
            // 1. Salva no Banco de Dados
            const resp = await fetch('/api/recibos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dados)
            });
            
            if(resp.ok) {
                alert("✅ Recibo Salvo e Lançado no Caixa!");
                loadHistory(); // Atualiza tabela
                signaturePadCompras.clear(); // Limpa assinatura
                
                // 2. Gera o PDF Visual
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF();

                doc.setFontSize(22); doc.setFont("helvetica", "bold");
                doc.text("RECIBO DE COMPRA E VENDA", 105, 20, null, null, "center");
                
                doc.setFontSize(12); doc.setFont("helvetica", "normal");
                doc.text(`Data: ${dados.dataFormatada} às ${dados.horaFormatada}`, 105, 30, null, null, "center");

                let y = 50;
                doc.text(`Eu, ${dados.nome}, portador do CPF ${dados.cpf},`, 20, y); y+=10;
                doc.text(`residente em ${dados.endereco},`, 20, y); y+=10;
                doc.text(`DECLARO que vendi para a DESTRAVACELL o seguinte aparelho:`, 20, y); y+=15;
                
                doc.setFont("helvetica", "bold");
                doc.text(`Modelo: ${dados.modelo}`, 20, y); y+=10;
                doc.text(`IMEI: ${dados.imei}`, 20, y); y+=10;
                doc.text(`Valor Pago: R$ ${dados.valor}`, 20, y);
                
                y+=30;
                doc.addImage(dados.assinatura, 'PNG', 60, y, 90, 45);
                
                doc.save(`Recibo_${dados.modelo}_${dados.nome}.pdf`);
            } else {
                alert("Erro ao salvar no banco.");
            }
        } catch (e) {
            console.error(e);
            alert("Erro de conexão.");
        }
    };

    window.loadHistory = async () => {
        const tb = document.querySelector('#history-table tbody');
        if(!tb) return;
        
        try {
            const res = await fetch('/api/recibos');
            const lista = await res.json();
            
            tb.innerHTML = "";
            lista.forEach(r => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${new Date(r.dataCriacao).toLocaleDateString()}</td>
                    <td>${r.nome}</td>
                    <td>${r.modelo}</td>
                    <td>R$ ${r.valor}</td>
                    <td><button onclick="deletarRecibo('${r._id}')" class="btn-delete"><i class="fas fa-trash"></i></button></td>
                `;
                tb.appendChild(tr);
            });
        } catch(e) { console.error("Erro histórico", e); }
    };

    window.deletarRecibo = async (id) => {
        if(confirm("Apagar este recibo?")) {
            await fetch(`/api/recibos/${id}`, { method: 'DELETE' });
            loadHistory();
        }
    };


    // ============================================================
    // === MÓDULO 2: ORDEM DE SERVIÇO (OS) ===
    // ============================================================
    
    const modalOS = document.getElementById('modal-os');

    window.abrirModalOS = (modo, dados = null) => {
        clearInterval(intervaloVerificacaoAssinatura);
        
        // Limpa campos
        document.querySelectorAll('#modal-os input, #modal-os textarea').forEach(i => {
            if(i.type === 'checkbox') i.checked = false;
            else i.value = '';
        });
        document.getElementById('os-total-display').innerText = '0,00';
        document.getElementById('area-assinatura-qr').style.display = 'none';
        document.getElementById('area-assinatura-pc').style.display = 'block';
        document.getElementById('qrcode-os').innerHTML = '';
        
        if (signaturePadOS) {
            signaturePadOS.clear();
            setTimeout(() => resizeCanvas(signaturePadOS, 'signature-pad-os'), 200);
        }

        if (modo === 'editar' && dados) {
            document.getElementById('modal-os-title').innerText = `Editar OS #${dados.osNumber}`;
            document.getElementById('os-id-hidden').value = dados._id;
            
            // Preencher campos
            document.getElementById('os-cliente').value = dados.cliente.nome || '';
            document.getElementById('os-tel').value = dados.cliente.telefone || '';
            document.getElementById('os-modelo').value = dados.aparelho.modelo || '';
            document.getElementById('os-imei').value = dados.aparelho.imei || '';
            document.getElementById('os-senha').value = dados.aparelho.senha || '';
            document.getElementById('os-acessorios').value = dados.aparelho.acessorios || '';
            document.getElementById('os-obs').value = dados.checklist.obs || '';
            document.getElementById('os-defeito').value = dados.servico.defeitoRelatado || '';
            
            document.getElementById('os-pecas').value = dados.financeiro.custoPecas || 0;
            document.getElementById('os-mao').value = dados.financeiro.maoDeObra || 0;
            document.getElementById('os-desconto').value = dados.financeiro.desconto || 0;
            document.getElementById('os-sinal').value = dados.financeiro.sinal || 0;
            document.getElementById('os-total-display').innerText = dados.financeiro.total.toFixed(2);

            if (dados.checklist) {
                if(dados.checklist.liga) document.getElementById('chk-liga').checked = true;
                if(dados.checklist.tela) document.getElementById('chk-tela').checked = true;
                if(dados.checklist.touch) document.getElementById('chk-touch').checked = true;
                // ... adicione outros se precisar
            }

            if (dados.assinaturaCliente && signaturePadOS) {
                signaturePadOS.fromDataURL(dados.assinaturaCliente);
            }
        } else {
            document.getElementById('modal-os-title').innerText = "Nova Ordem de Serviço";
            document.getElementById('os-id-hidden').value = "";
        }
        
        modalOS.style.display = 'flex';
    };

    window.fecharModalOS = () => modalOS.style.display = 'none';

    // Cálculo Automático Total
    ['os-pecas', 'os-mao', 'os-desconto'].forEach(id => {
        document.getElementById(id).addEventListener('input', () => {
            const p = parseFloat(document.getElementById('os-pecas').value) || 0;
            const m = parseFloat(document.getElementById('os-mao').value) || 0;
            const d = parseFloat(document.getElementById('os-desconto').value) || 0;
            document.getElementById('os-total-display').innerText = ((p + m) - d).toFixed(2);
        });
    });

    window.salvarOS = async () => {
        const id = document.getElementById('os-id-hidden').value;
        const assinatura = (signaturePadOS && !signaturePadOS.isEmpty()) ? signaturePadOS.toDataURL() : null;

        const dados = {
            cliente: {
                nome: document.getElementById('os-cliente').value,
                telefone: document.getElementById('os-tel').value,
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

        try {
            const res = await fetch(url, {
                method: method,
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(dados)
            });
            
            if (res.ok) {
                alert("✅ OS Salva com Sucesso!");
                fecharModalOS();
                carregarOS();
            } else { alert("Erro ao salvar OS"); }
        } catch(e) { alert("Erro de conexão"); }
    };

    window.carregarOS = async () => {
        const tbody = document.getElementById('lista-os-body');
        if(!tbody) return;
        tbody.innerHTML = '<tr><td colspan="6">Carregando...</td></tr>';
        
        try {
            const res = await fetch('/api/os');
            const lista = await res.json();
            tbody.innerHTML = "";

            lista.forEach(os => {
                const tr = document.createElement('tr');
                const total = os.financeiro.total || 0;
                const sinal = os.financeiro.sinal || 0;
                const falta = total - sinal;
                const statusPag = os.financeiro.statusPagamento || 'Pendente';
                
                let corStatus = '#888';
                if(os.servico.status === 'Pronto') corStatus = '#00ff88';
                if(os.servico.status === 'Entregue') corStatus = '#00d4ff';

                tr.innerHTML = `
                    <td><b>#${os.osNumber}</b></td>
                    <td>${os.cliente.nome}</td>
                    <td>${os.aparelho.modelo}</td>
                    <td><span style="color:${corStatus}; font-weight:bold;">${os.servico.status}</span></td>
                    <td>R$ ${total.toFixed(2)} <br><small style="color:${statusPag === 'Pago' ? '#00ff88' : '#ff4444'}">(${statusPag})</small></td>
                    <td>
                        <button class="btn-action" onclick="editarOS('${os._id}')"><i class="fas fa-edit"></i></button>
                        <button class="btn-action" onclick="imprimirOS('${os._id}')"><i class="fas fa-print"></i></button>
                        <button class="btn-action" onclick="alterarStatus('${os._id}', '${os.servico.status}', ${falta}, '${os.cliente.nome}')" title="Mudar Status / Entregar"><i class="fas fa-exchange-alt"></i></button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } catch(e) { console.error(e); }
    };

    window.editarOS = async (id) => {
        const res = await fetch(`/api/os/${id}`);
        const os = await res.json();
        abrirModalOS('editar', os);
    };

    // FUNÇÃO CRÍTICA: STATUS E PAGAMENTO
    window.alterarStatus = async (id, statusAtual, valorRestante, nomeCliente) => {
        let novoStatus = prompt(`Status Atual: ${statusAtual}\n\nDigite o novo status:\n(Pronto, Entregue, Aguardando Peça, Cancelado)`, "Pronto");
        
        if (!novoStatus) return;

        let atualizarFinanceiro = false;
        let valorRecebidoAgora = 0;

        // SE FOR ENTREGAR, PERGUNTA DO PAGAMENTO
        if (novoStatus.toLowerCase() === 'entregue') {
            const confirmacao = confirm(`O cliente vai pagar o restante de R$ ${valorRestante.toFixed(2)} agora?`);
            if (confirmacao) {
                atualizarFinanceiro = true;
                valorRecebidoAgora = valorRestante;
            }
        }

        try {
            // 1. Atualiza Status da OS
            const payload = { 
                "servico.status": novoStatus 
            };
            if (atualizarFinanceiro) {
                payload["financeiro.statusPagamento"] = "Pago";
            }

            await fetch(`/api/os/${id}`, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(payload)
            });

            // 2. Se recebeu, lança no Fluxo de Caixa
            if (atualizarFinanceiro && valorRecebidoAgora > 0) {
                await fetch('/api/financeiro', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        tipo: 'entrada',
                        descricao: `Pagamento Final OS (Cliente: ${nomeCliente})`,
                        valor: valorRecebidoAgora
                    })
                });
                alert("💰 Valor lançado no Fluxo de Caixa com sucesso!");
            }

            carregarOS();
        } catch(e) { alert("Erro ao atualizar status."); }
    };

    window.imprimirOS = async (id) => {
        const res = await fetch(`/api/os/${id}`);
        const os = await res.json();
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        doc.setFontSize(18); doc.text(`ORDEM DE SERVIÇO #${os.osNumber}`, 105, 20, null, null, "center");
        doc.setFontSize(12);
        doc.text(`Cliente: ${os.cliente.nome}`, 20, 40);
        doc.text(`Aparelho: ${os.aparelho.modelo}`, 20, 50);
        doc.text(`Defeito: ${os.servico.defeitoRelatado}`, 20, 60);
        
        doc.setFontSize(14); doc.setFont("helvetica", "bold");
        doc.text(`TOTAL: R$ ${os.financeiro.total.toFixed(2)}`, 20, 80);
        
        if(os.assinaturaCliente) {
            doc.addImage(os.assinaturaCliente, 'PNG', 60, 100, 80, 40);
        }
        
        doc.save(`OS_${os.osNumber}.pdf`);
    };
    
    // QR CODE OS
    window.gerarQRCodeOS = async () => {
        const id = document.getElementById('os-id-hidden').value;
        if(!id) return alert("Salve a OS primeiro para gerar o QR Code!");
        
        mostrarTabAssinatura('qr');
        const container = document.getElementById('qrcode-os');
        container.innerHTML = "";
        
        const link = `${window.location.origin}/assinatura-os.html?id=${id}`;
        new QRCode(container, { text: link, width: 200, height: 200 });

        // Polling para verificar se assinou
        intervaloVerificacaoAssinatura = setInterval(async () => {
            const res = await fetch(`/api/os/${id}`);
            const os = await res.json();
            if (os.assinaturaCliente) {
                clearInterval(intervaloVerificacaoAssinatura);
                alert("Assinatura Recebida!");
                signaturePadOS.fromDataURL(os.assinaturaCliente);
                mostrarTabAssinatura('pc');
            }
        }, 3000);
    };
    
    window.mostrarTabAssinatura = (tab) => {
        if(tab === 'pc') {
            document.getElementById('area-assinatura-pc').style.display = 'block';
            document.getElementById('area-assinatura-qr').style.display = 'none';
        } else {
            document.getElementById('area-assinatura-pc').style.display = 'none';
            document.getElementById('area-assinatura-qr').style.display = 'block';
        }
    };
    window.limparAssinaturaOS = () => signaturePadOS.clear();


    // ============================================================
    // === MÓDULO 3: FINANCEIRO (FLUXO DE CAIXA) ===
    // ============================================================

    window.carregarFinanceiro = async () => {
        const tb = document.querySelector('#finance-table tbody');
        if(!tb) return;
        
        try {
            const res = await fetch('/api/financeiro');
            const lista = await res.json();
            
            let total = 0, ent = 0, sai = 0;
            tb.innerHTML = "";
            
            lista.forEach(item => {
                const val = parseFloat(item.valor);
                if(item.tipo === 'entrada') { ent += val; total += val; } 
                else { sai += val; total -= val; }
                
                tb.innerHTML += `
                    <tr>
                        <td>${new Date(item.data).toLocaleDateString()}</td>
                        <td>${item.descricao}</td>
                        <td style="color:${item.tipo === 'entrada' ? '#00ff88' : '#ff4444'}">${item.tipo.toUpperCase()}</td>
                        <td>R$ ${val.toFixed(2)}</td>
                        <td><button class="btn-delete" onclick="delFin('${item._id}')">X</button></td>
                    </tr>`;
            });
            
            document.getElementById('dash-saldo').innerText = `R$ ${total.toFixed(2)}`;
            document.getElementById('dash-entradas').innerText = `R$ ${ent.toFixed(2)}`;
            document.getElementById('dash-saidas').innerText = `R$ ${sai.toFixed(2)}`;
        } catch(e) { console.error(e); }
    };

    window.salvarFinanceiro = async () => {
        const desc = document.getElementById('fin-desc').value;
        const val = document.getElementById('fin-valor').value;
        const tipo = document.getElementById('fin-tipo').value;
        
        if(!desc || !val) return alert("Preencha descrição e valor");
        
        await fetch('/api/financeiro', {
            method:'POST', 
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({descricao: desc, valor: val, tipo: tipo})
        });
        
        document.getElementById('fin-desc').value = "";
        document.getElementById('fin-valor').value = "";
        carregarFinanceiro();
    };
    
    window.delFin = async (id) => {
        if(confirm("Apagar este lançamento?")) { 
            await fetch(`/api/financeiro/${id}`, {method:'DELETE'}); 
            carregarFinanceiro(); 
        }
    };

    // Logout
    window.logout = async () => { await fetch('/api/logout', { method: 'POST' }); window.location.href = 'login.html'; };
});
