// VARIÁVEIS GLOBAIS
let padRecibo = null;
let padOS = null;

document.addEventListener('DOMContentLoaded', () => {

    // === INICIALIZAÇÃO CANVAS ===
    const c1 = document.getElementById('signature-pad');
    if(c1) padRecibo = new SignaturePad(c1, { backgroundColor: 'rgb(255, 255, 255)' });

    const c2 = document.getElementById('signature-pad-os');
    if(c2) padOS = new SignaturePad(c2, { backgroundColor: 'rgb(255, 255, 255)' });

    // Ajuste de tamanho dos Canvas
    function resizePads() {
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        if(c1) { c1.width = c1.offsetWidth * ratio; c1.height = c1.offsetHeight * ratio; c1.getContext("2d").scale(ratio, ratio); }
        if(c2) { c2.width = c2.offsetWidth * ratio; c2.height = c2.offsetHeight * ratio; c2.getContext("2d").scale(ratio, ratio); }
    }
    window.addEventListener("resize", resizePads);
    setTimeout(resizePads, 500); // Garante resize ao carregar

    // === NAVEGAÇÃO ABAS ===
    window.abrirAba = (aba) => {
        document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
        
        document.getElementById(`tab-${aba}`).classList.add('active');
        document.getElementById(`btn-${aba}`).classList.add('active');

        if(aba === 'compras') { loadRecibos(); setTimeout(resizePads, 100); }
        if(aba === 'os') { loadOS(); }
        if(aba === 'financeiro') { loadFinanceiro(); }
    };

    // Inicializa na aba compras
    abrirAba('compras');

    // === 1. RECIBOS (LÓGICA ORIGINAL) ===
    window.gerarPDF = async () => {
        if(padRecibo.isEmpty()) return alert("Assine primeiro!");
        
        const dados = {
            nome: document.getElementById('nome').value,
            cpf: document.getElementById('cpf').value,
            rg: document.getElementById('rg').value,
            endereco: document.getElementById('endereco').value,
            modelo: document.getElementById('modelo').value,
            imei: document.getElementById('imei').value,
            valor: document.getElementById('valor').value,
            estado: document.getElementById('estado').value,
            assinatura: padRecibo.toDataURL(),
            dataFormatada: new Date().toLocaleDateString('pt-BR'),
            horaFormatada: new Date().toLocaleTimeString('pt-BR')
        };

        try {
            const res = await fetch('/api/recibos', {
                method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(dados)
            });
            if(res.ok) {
                alert("✅ Recibo Salvo!");
                padRecibo.clear();
                loadRecibos();
                
                // Gera PDF
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF();
                doc.setFontSize(22); doc.text("RECIBO DE VENDA", 105, 20, null, null, "center");
                doc.setFontSize(12); doc.text(`Vendedor: ${dados.nome}`, 20, 50);
                doc.text(`Aparelho: ${dados.modelo} - IMEI: ${dados.imei}`, 20, 60);
                doc.text(`Valor: R$ ${dados.valor}`, 20, 70);
                doc.addImage(dados.assinatura, 'PNG', 60, 90, 80, 40);
                doc.save(`Recibo_${dados.modelo}.pdf`);
            }
        } catch(e) { alert("Erro ao salvar"); }
    };

    window.loadRecibos = async () => {
        const tb = document.getElementById('lista-recibos');
        const res = await fetch('/api/recibos');
        const lista = await res.json();
        tb.innerHTML = "";
        lista.forEach(r => {
            tb.innerHTML += `<tr><td>${r.modelo}</td><td>${r.nome}</td><td>R$ ${r.valor}</td><td><button class="btn-delete" onclick="delRecibo('${r._id}')">X</button></td></tr>`;
        });
    };
    window.delRecibo = async (id) => { if(confirm("Apagar?")) { await fetch(`/api/recibos/${id}`, {method:'DELETE'}); loadRecibos(); } };

    // === 2. ORDEM DE SERVIÇO (NOVA LÓGICA) ===
    window.abrirModalOS = (modo, dados=null) => {
        const modal = document.getElementById('modal-os');
        modal.style.display = 'flex';
        setTimeout(resizePads, 200); // Redimensiona canvas ao abrir modal
        
        // Limpar campos
        document.querySelectorAll('#modal-os input').forEach(i => i.value = '');
        document.querySelectorAll('#modal-os textarea').forEach(i => i.value = '');
        document.querySelectorAll('#modal-os input[type=checkbox]').forEach(i => i.checked = false);
        padOS.clear();
        document.getElementById('os-total').innerText = "0,00";

        if(modo === 'editar' && dados) {
            document.getElementById('os-id').value = dados._id;
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
            document.getElementById('os-total').innerText = dados.financeiro.total.toFixed(2);

            if(dados.checklist.liga) document.getElementById('chk-liga').checked = true;
            if(dados.checklist.tela) document.getElementById('chk-tela').checked = true;
            if(dados.checklist.touch) document.getElementById('chk-touch').checked = true;
            if(dados.checklist.carga) document.getElementById('chk-carga').checked = true;

            if(dados.assinaturaCliente) padOS.fromDataURL(dados.assinaturaCliente);
        }
    };

    // Calc Total OS
    ['os-pecas', 'os-mao', 'os-desconto'].forEach(id => {
        document.getElementById(id).addEventListener('input', () => {
            const p = parseFloat(document.getElementById('os-pecas').value)||0;
            const m = parseFloat(document.getElementById('os-mao').value)||0;
            const d = parseFloat(document.getElementById('os-desconto').value)||0;
            document.getElementById('os-total').innerText = ((p+m)-d).toFixed(2);
        });
    });

    window.salvarOS = async () => {
        const id = document.getElementById('os-id').value;
        const dados = {
            cliente: { nome: document.getElementById('os-cliente').value, telefone: document.getElementById('os-tel').value },
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
                carga: document.getElementById('chk-carga').checked,
                obs: document.getElementById('os-obs').value
            },
            servico: { defeitoRelatado: document.getElementById('os-defeito').value },
            financeiro: {
                custoPecas: document.getElementById('os-pecas').value || 0,
                maoDeObra: document.getElementById('os-mao').value || 0,
                desconto: document.getElementById('os-desconto').value || 0,
                sinal: document.getElementById('os-sinal').value || 0,
                total: parseFloat(document.getElementById('os-total').innerText)
            },
            assinaturaCliente: padOS.isEmpty() ? null : padOS.toDataURL()
        };

        const url = id ? `/api/os/${id}` : '/api/os';
        const method = id ? 'PUT' : 'POST';
        
        try {
            const res = await fetch(url, {method:method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(dados)});
            if(res.ok) {
                alert("✅ OS Salva!");
                document.getElementById('modal-os').style.display='none';
                loadOS();
            }
        } catch(e) { alert("Erro ao salvar OS"); }
    };

    window.loadOS = async () => {
        const tb = document.getElementById('lista-os');
        const res = await fetch('/api/os');
        const lista = await res.json();
        tb.innerHTML = "";
        lista.forEach(os => {
            tb.innerHTML += `<tr>
                <td>#${os.osNumber}</td>
                <td>${os.cliente.nome}</td>
                <td>${os.aparelho.modelo}</td>
                <td style="color:${os.servico.status==='Entregue'?'#00ff88':'#ccc'}">${os.servico.status}</td>
                <td>
                    <button class="btn-delete" style="color:#fff; border-color:#fff;" onclick="editarOS('${os._id}')">EDITAR</button>
                    <button class="btn-delete" style="color:#00ff88; border-color:#00ff88;" onclick="mudarStatus('${os._id}')">ENTREGAR</button>
                </td>
            </tr>`;
        });
    };

    window.editarOS = async (id) => {
        const res = await fetch(`/api/os/${id}`);
        abrirModalOS('editar', await res.json());
    };

    window.mudarStatus = async (id) => {
        if(confirm("Marcar como ENTREGUE e PAGO? (Lançará no caixa)")) {
            // 1. Atualiza Status
            await fetch(`/api/os/${id}`, {
                method:'PUT', headers:{'Content-Type':'application/json'},
                body:JSON.stringify({ "servico.status": "Entregue", "financeiro.statusPagamento": "Pago" })
            });
            
            // 2. Busca valores pra lançar no caixa
            const res = await fetch(`/api/os/${id}`);
            const os = await res.json();
            const restante = os.financeiro.total - (os.financeiro.sinal || 0);
            
            if(restante > 0) {
                await fetch('/api/financeiro', {
                    method:'POST', headers:{'Content-Type':'application/json'},
                    body:JSON.stringify({ tipo:'entrada', descricao:`Pgto Final OS #${os.osNumber}`, valor:restante })
                });
                alert("💰 Valor lançado no caixa!");
            }
            loadOS();
        }
    };

    // === 3. FINANCEIRO ===
    window.loadFinanceiro = async () => {
        const tb = document.getElementById('lista-financeiro');
        const res = await fetch('/api/financeiro');
        const lista = await res.json();
        let total = 0;
        tb.innerHTML = "";
        lista.forEach(i => {
            const val = parseFloat(i.valor);
            if(i.tipo==='entrada') total += val; else total -= val;
            tb.innerHTML += `<tr><td>${new Date(i.data).toLocaleDateString()}</td><td>${i.descricao}</td><td style="color:${i.tipo==='entrada'?'#00ff88':'#ff4444'}">R$ ${val.toFixed(2)}</td><td><button class="btn-delete" onclick="delFin('${i._id}')">X</button></td></tr>`;
        });
        document.getElementById('dash-saldo').innerText = `R$ ${total.toFixed(2)}`;
    };
    
    window.salvarFinanceiro = async () => {
        const d=document.getElementById('fin-desc').value;
        const v=document.getElementById('fin-valor').value;
        const t=document.getElementById('fin-tipo').value;
        await fetch('/api/financeiro', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({descricao:d, valor:v, tipo:t})});
        loadFinanceiro();
    };
    window.delFin = async (id) => { if(confirm("Apagar?")) { await fetch(`/api/financeiro/${id}`, {method:'DELETE'}); loadFinanceiro(); } };

    window.logout = async () => { await fetch('/api/logout', {method:'POST'}); window.location.href='login.html'; };
});
