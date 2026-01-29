document.addEventListener('DOMContentLoaded', () => {

    // === 1. LÓGICA DE ABAS (NAVEGAÇÃO) ===
    window.abrirAba = (abaNome) => {
        // Remove active de todos
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        
        // Ativa o selecionado
        document.getElementById(`tab-${abaNome}`).classList.add('active');
        // Busca o botão clicado (hack simples para adicionar active no botão)
        const btns = document.querySelectorAll('.tab-btn');
        if(abaNome === 'compras') btns[0].classList.add('active');
        if(abaNome === 'os') btns[1].classList.add('active');
        if(abaNome === 'financeiro') btns[2].classList.add('active');

        // Carrega dados específicos
        if(abaNome === 'os') carregarOS();
        if(abaNome === 'financeiro') carregarFinanceiro();
        if(abaNome === 'compras') {
            loadHistory();
            resizeCanvas(); // Garante que o canvas não bugue
        }
    };

    // === 2. ORDEM DE SERVIÇO (OS) ===
    const modalOS = document.getElementById('modal-os');
    
    window.abrirModalOS = () => {
        // Limpa campos
        document.querySelectorAll('#modal-os input, #modal-os textarea').forEach(i => {
            if(i.type === 'checkbox') i.checked = false;
            else i.value = '';
        });
        document.getElementById('os-total-display').innerText = '0,00';
        modalOS.style.display = 'flex';
    };

    window.fecharModalOS = () => modalOS.style.display = 'none';

    // Cálculo automático do total na OS
    const calcInputs = ['os-pecas', 'os-mao', 'os-desconto'];
    calcInputs.forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            el.addEventListener('input', () => {
                const pecas = parseFloat(document.getElementById('os-pecas').value) || 0;
                const mao = parseFloat(document.getElementById('os-mao').value) || 0;
                const desc = parseFloat(document.getElementById('os-desconto').value) || 0;
                const total = (pecas + mao) - desc;
                document.getElementById('os-total-display').innerText = total.toFixed(2);
            });
        }
    });

    window.salvarOS = async () => {
        const dados = {
            cliente: {
                nome: document.getElementById('os-cliente').value,
                telefone: document.getElementById('os-tel').value,
                cpf: ""
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
                audio: document.getElementById('chk-audio').checked,
                camera: document.getElementById('chk-camera').checked,
                carga: document.getElementById('chk-carga').checked,
                wifi: document.getElementById('chk-wifi').checked,
                biom: document.getElementById('chk-biom').checked,
                obs: document.getElementById('os-obs').value
            },
            servico: {
                defeitoRelatado: document.getElementById('os-defeito').value
            },
            financeiro: {
                custoPecas: document.getElementById('os-pecas').value || 0,
                maoDeObra: document.getElementById('os-mao').value || 0,
                desconto: document.getElementById('os-desconto').value || 0,
                sinal: document.getElementById('os-sinal').value || 0,
                total: parseFloat(document.getElementById('os-total-display').innerText)
            }
        };

        try {
            const res = await fetch('/api/os', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(dados)
            });
            if(res.ok) {
                alert("✅ OS Criada com Sucesso!");
                fecharModalOS();
                carregarOS();
            } else {
                alert("Erro ao criar OS");
            }
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
                // Cores de status
                let statusColor = '#888';
                if(os.servico.status === 'Pronto') statusColor = '#00ff88';
                if(os.servico.status === 'Entregue') statusColor = '#00d4ff';
                if(os.servico.status === 'Aguardando Peça') statusColor = '#ffaa00';

                tr.innerHTML = `
                    <td><b>#${os.osNumber}</b></td>
                    <td>${os.cliente.nome}<br><small>${os.cliente.telefone}</small></td>
                    <td>${os.aparelho.modelo}<br><small>${os.aparelho.imei || ''}</small></td>
                    <td><span style="color:${statusColor}; font-weight:bold;">${os.servico.status.toUpperCase()}</span></td>
                    <td>R$ ${os.financeiro.total.toFixed(2)}</td>
                    <td>
                        <button class="btn-action" onclick="editarStatus('${os._id}', 'Pronto')" title="Marcar Pronto"><i class="fas fa-check"></i></button>
                        <button class="btn-action" onclick="editarStatus('${os._id}', 'Entregue')" title="Entregar"><i class="fas fa-hand-holding-usd"></i></button>
                        <button class="btn-delete" onclick="deletarOS('${os._id}')"><i class="fas fa-trash"></i></button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } catch(e) { console.error(e); }
    };

    window.editarStatus = async (id, novoStatus) => {
        if(!confirm(`Mudar status para ${novoStatus}?`)) return;
        
        let atualizacao = { "servico.status": novoStatus };
        if(novoStatus === 'Entregue') {
            const pago = confirm("O cliente realizou o pagamento total? Clique OK para confirmar pagamento.");
            if(pago) {
                atualizacao = { 
                    "servico.status": novoStatus, 
                    "financeiro.statusPagamento": "Pago" 
                };
            }
        }

        await fetch(`/api/os/${id}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(atualizacao)
        });
        carregarOS();
    };

    window.deletarOS = async (id) => {
        if(confirm("Apagar essa OS?")) {
            await fetch(`/api/os/${id}`, {method:'DELETE'});
            carregarOS();
        }
    };
    
    // Filtro simples de OS
    window.filtrarOS = () => {
        const termo = document.getElementById('busca-os').value.toLowerCase();
        const linhas = document.querySelectorAll('#lista-os-body tr');
        linhas.forEach(linha => {
            const texto = linha.innerText.toLowerCase();
            linha.style.display = texto.includes(termo) ? '' : 'none';
        });
    };

    // === 3. FINANCEIRO (MANTIDO) ===
    window.carregarFinanceiro = async () => {
        const tb = document.querySelector('#finance-table tbody');
        if(!tb) return;
        const res = await fetch('/api/financeiro');
        const lista = await res.json();
        let total = 0, ent = 0, sai = 0;
        tb.innerHTML = "";
        lista.forEach(item => {
            const val = parseFloat(item.valor);
            if(item.tipo === 'entrada') { ent += val; total += val; } else { sai += val; total -= val; }
            tb.innerHTML += `<tr><td>${new Date(item.data).toLocaleDateString()}</td><td>${item.descricao}</td><td>${item.tipo}</td><td>R$ ${val.toFixed(2)}</td><td><button class="btn-delete" onclick="delFin('${item._id}')">X</button></td></tr>`;
        });
        document.getElementById('dash-saldo').innerText = `R$ ${total.toFixed(2)}`;
        document.getElementById('dash-entradas').innerText = `R$ ${ent.toFixed(2)}`;
        document.getElementById('dash-saidas').innerText = `R$ ${sai.toFixed(2)}`;
    };

    window.salvarFinanceiro = async () => {
        const desc = document.getElementById('fin-desc').value;
        const val = document.getElementById('fin-valor').value;
        const tipo = document.getElementById('fin-tipo').value;
        if(!desc || !val) return alert("Preencha tudo");
        await fetch('/api/financeiro', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({descricao: desc, valor: val, tipo: tipo})
        });
        document.getElementById('fin-desc').value = "";
        document.getElementById('fin-valor').value = "";
        carregarFinanceiro();
    };
    
    window.delFin = async (id) => {
        if(confirm("Apagar?")) { await fetch(`/api/financeiro/${id}`, {method:'DELETE'}); carregarFinanceiro(); }
    };

    // === 4. COMPRAS E RECIBOS (FUNCIONALIDADE ORIGINAL) ===
    const canvas = document.getElementById('signature-pad');
    let signaturePad;

    if(canvas) {
        signaturePad = new SignaturePad(canvas, { backgroundColor: 'rgb(255, 255, 255)', penColor: 'rgb(0, 0, 0)' });
        
        window.resizeCanvas = () => {
            const ratio = Math.max(window.devicePixelRatio || 1, 1);
            canvas.width = canvas.offsetWidth * ratio;
            canvas.height = canvas.offsetHeight * ratio;
            canvas.getContext("2d").scale(ratio, ratio);
        };
        window.addEventListener("resize", resizeCanvas);
        resizeCanvas();
        document.getElementById('clear-pad').addEventListener('click', () => signaturePad.clear());
        
        // Carrega histórico apenas na inicialização se estiver na aba compras
        loadHistory();
    }

    window.logout = async () => {
        await fetch('/api/logout', { method: 'POST' });
        window.location.href = 'login.html';
    };

    window.gerarPDF = async () => {
        if (signaturePad.isEmpty()) { alert("Assinatura obrigatória!"); return; }

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

        if(!dados.nome || !dados.valor) return alert("Preencha os campos obrigatórios");

        // Salva no Banco de Dados
        const resp = await fetch('/api/recibos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });
        if(resp.ok) {
            alert("✅ Salvo com sucesso!");
            loadHistory();
        }

        // Gera PDF Visual
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Cabeçalho
        doc.setFontSize(22);
        doc.setFont("helvetica", "bold");
        doc.text("RECIBO DE COMPRA E VENDA", 105, 20, null, null, "center");
        
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.text(`Data: ${dados.dataFormatada} às ${dados.horaFormatada}`, 105, 30, null, null, "center");

        // Conteúdo
        let y = 50;
        doc.text(`Eu, ${dados.nome}, portador do CPF ${dados.cpf} e RG ${dados.rg},`, 20, y);
        y+=10;
        doc.text(`residente em ${dados.endereco},`, 20, y);
        y+=10;
        doc.text(`DECLARO que vendi para a DESTRAVACELL o seguinte aparelho:`, 20, y);
        y+=15;
        
        doc.setFont("helvetica", "bold");
        doc.text(`Modelo: ${dados.modelo}`, 20, y);
        y+=10;
        doc.text(`IMEI: ${dados.imei}`, 20, y);
        y+=10;
        doc.text(`Estado: ${dados.estado}`, 20, y);
        y+=10;
        doc.text(`Valor Pago: R$ ${dados.valor}`, 20, y);
        
        y+=20;
        doc.setFont("helvetica", "normal");
        doc.text("Declaro ser o legítimo proprietário e que o aparelho tem procedência lícita.", 20, y);
        
        // Assinatura
        y+=40;
        doc.addImage(dados.assinatura, 'PNG', 60, y, 90, 45);
        y+=50;
        doc.line(60, y, 150, y);
        doc.text("Assinatura do Vendedor", 105, y+5, null, null, "center");

        doc.save(`Recibo_${dados.modelo}_${dados.nome}.pdf`);
    };

    window.loadHistory = async () => {
        const tb = document.querySelector('#history-table tbody');
        if(!tb) return;
        
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
                <td>
                    <button onclick="reimprimir('${r._id}')" class="btn-action"><i class="fas fa-print"></i></button>
                    <button onclick="deletarRecibo('${r._id}')" class="btn-delete"><i class="fas fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    };

    window.deletarRecibo = async (id) => {
        if(confirm("Apagar este registro permanentemente?")) {
            await fetch(`/api/recibos/${id}`, { method: 'DELETE' });
            loadHistory();
        }
    };
});
