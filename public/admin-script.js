document.addEventListener('DOMContentLoaded', () => {

    // === NAVEGAÇÃO ===
    window.abrirAba = (abaNome) => {
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(`tab-${abaNome}`).classList.add('active');
        // Hack para ativar o botão visualmente
        const btns = document.querySelectorAll('.tab-btn');
        if(abaNome === 'compras') btns[0].classList.add('active');
        if(abaNome === 'os') btns[1].classList.add('active');
        if(abaNome === 'financeiro') btns[2].classList.add('active');

        if(abaNome === 'os') carregarOS();
        if(abaNome === 'financeiro') carregarFinanceiro();
        if(abaNome === 'compras') { loadHistory(); resizeCanvas(); }
    };

    // === ORDEM DE SERVIÇO (OS) ===
    const modalOS = document.getElementById('modal-os');
    let signaturePadOS; // Instância separada para a OS
    let intervaloVerificacaoAssinatura; // Para verificar QR Code

    // Inicializa o pad da OS
    setTimeout(() => {
        const canvasOS = document.getElementById('signature-pad-os');
        if(canvasOS) {
            signaturePadOS = new SignaturePad(canvasOS, { backgroundColor: 'rgb(255, 255, 255)' });
        }
    }, 500);

    window.abrirModalOS = (modo, dados = null) => {
        clearInterval(intervaloVerificacaoAssinatura);
        // Limpa tudo
        document.querySelectorAll('#modal-os input, #modal-os textarea').forEach(i => {
            if(i.type === 'checkbox') i.checked = false;
            else i.value = '';
        });
        document.getElementById('os-total-display').innerText = '0,00';
        document.getElementById('area-assinatura-qr').style.display = 'none';
        document.getElementById('area-assinatura-pc').style.display = 'block';
        document.getElementById('qrcode-os').innerHTML = '';
        document.getElementById('status-assinatura').style.display = 'none';
        
        if (signaturePadOS) {
            signaturePadOS.clear();
            // Redimensiona para garantir
            const canvas = document.getElementById('signature-pad-os');
            canvas.width = canvas.parentElement.offsetWidth;
            canvas.height = 200;
        }

        if (modo === 'editar' && dados) {
            // Preenche os dados para EDIÇÃO
            document.getElementById('modal-os-title').innerText = `Editar OS #${dados.osNumber}`;
            document.getElementById('os-id-hidden').value = dados._id;
            
            document.getElementById('os-cliente').value = dados.cliente.nome;
            document.getElementById('os-tel').value = dados.cliente.telefone;
            document.getElementById('os-modelo').value = dados.aparelho.modelo;
            document.getElementById('os-imei').value = dados.aparelho.imei;
            document.getElementById('os-senha').value = dados.aparelho.senha || '';
            document.getElementById('os-acessorios').value = dados.aparelho.acessorios || '';
            document.getElementById('os-obs').value = dados.checklist.obs || '';
            document.getElementById('os-defeito').value = dados.servico.defeitoRelatado || '';
            
            // Valores
            document.getElementById('os-pecas').value = dados.financeiro.custoPecas;
            document.getElementById('os-mao').value = dados.financeiro.maoDeObra;
            document.getElementById('os-desconto').value = dados.financeiro.desconto;
            document.getElementById('os-sinal').value = dados.financeiro.sinal;
            document.getElementById('os-total-display').innerText = dados.financeiro.total.toFixed(2);

            // Checklist
            const checkKeys = ['liga', 'tela', 'touch', 'audio', 'camera', 'carga', 'wifi', 'biom'];
            checkKeys.forEach(key => {
                if(dados.checklist[key]) document.getElementById(`chk-${key}`).checked = true;
            });

            // Se já tiver assinatura, avisa
            if (dados.assinaturaCliente) {
                document.getElementById('status-assinatura').style.display = 'block';
                signaturePadOS.fromDataURL(dados.assinaturaCliente);
            }
        } else {
            // Novo
            document.getElementById('modal-os-title').innerText = "Nova Ordem de Serviço";
            document.getElementById('os-id-hidden').value = "";
        }

        modalOS.style.display = 'flex';
    };

    window.fecharModalOS = () => {
        modalOS.style.display = 'none';
        clearInterval(intervaloVerificacaoAssinatura);
    };

    // Assinatura Tabs
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

    // QR Code Generator para OS
    window.gerarQRCodeOS = async () => {
        // Para gerar QR Code, precisamos salvar a OS primeiro para ter um ID
        let id = document.getElementById('os-id-hidden').value;
        
        if (!id) {
            // Salva como rascunho se for nova
            if(!confirm("Para gerar o QR Code, precisamos salvar um rascunho da OS primeiro. Continuar?")) return;
            await salvarOS(true); // true = modo silencioso (não fecha modal)
            id = document.getElementById('os-id-hidden').value; // Pega o ID novo
            if(!id) return; // Se falhou
        }

        mostrarTabAssinatura('qr');
        const container = document.getElementById('qrcode-os');
        container.innerHTML = "";
        
        // Link para a página de assinatura mobile
        const link = `${window.location.origin}/assinatura-os.html?id=${id}`;
        new QRCode(container, { text: link, width: 200, height: 200 });

        // Começa a ouvir se a assinatura chegou
        clearInterval(intervaloVerificacaoAssinatura);
        intervaloVerificacaoAssinatura = setInterval(async () => {
            const res = await fetch(`/api/os/${id}`);
            const os = await res.json();
            if (os.assinaturaCliente) {
                clearInterval(intervaloVerificacaoAssinatura);
                alert("✅ Assinatura do Cliente Recebida!");
                document.getElementById('status-assinatura').style.display = 'block';
                signaturePadOS.fromDataURL(os.assinaturaCliente); // Mostra no canvas
                mostrarTabAssinatura('pc');
            }
        }, 3000); // Checa a cada 3 segundos
    };

    // Calc Total
    ['os-pecas', 'os-mao', 'os-desconto'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', () => {
            const p = parseFloat(document.getElementById('os-pecas').value) || 0;
            const m = parseFloat(document.getElementById('os-mao').value) || 0;
            const d = parseFloat(document.getElementById('os-desconto').value) || 0;
            document.getElementById('os-total-display').innerText = ((p + m) - d).toFixed(2);
        });
    });

    // Salvar OS (Create or Update)
    window.salvarOS = async (modoSilencioso = false) => {
        const id = document.getElementById('os-id-hidden').value;
        const assinatura = !signaturePadOS.isEmpty() ? signaturePadOS.toDataURL() : null;

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
                audio: document.getElementById('chk-audio').checked,
                camera: document.getElementById('chk-camera').checked,
                carga: document.getElementById('chk-carga').checked,
                wifi: document.getElementById('chk-wifi').checked,
                biom: document.getElementById('chk-biom').checked,
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

        let method = 'POST';
        let url = '/api/os';
        if (id) {
            method = 'PUT';
            url = `/api/os/${id}`;
        }

        try {
            const res = await fetch(url, {
                method: method,
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(dados)
            });
            const json = await res.json();
            
            if (res.ok) {
                if (method === 'POST') document.getElementById('os-id-hidden').value = json._id; // Salva ID se criou agora
                
                if (!modoSilencioso) {
                    alert("✅ OS Salva com Sucesso!");
                    fecharModalOS();
                    carregarOS();
                }
            } else { alert("Erro ao salvar"); }
        } catch (e) { alert("Erro de conexão"); }
    };

    window.carregarOS = async () => {
        const tbody = document.getElementById('lista-os-body');
        if(!tbody) return;
        tbody.innerHTML = '<tr><td colspan="6">Carregando...</td></tr>';
        const res = await fetch('/api/os');
        const lista = await res.json();
        tbody.innerHTML = "";
        lista.forEach(os => {
            const tr = document.createElement('tr');
            // Salvando o objeto OS inteiro no botão de editar (dataset não suporta obj, usamos array global ou fetch, aqui fetch no click é melhor)
            tr.innerHTML = `
                <td><b>#${os.osNumber}</b></td>
                <td>${os.cliente.nome}</td>
                <td>${os.aparelho.modelo}</td>
                <td>${os.servico.status}</td>
                <td>R$ ${os.financeiro.total.toFixed(2)}</td>
                <td>
                    <button class="btn-action" onclick="prepararEdicao('${os._id}')" title="Editar"><i class="fas fa-edit"></i></button>
                    <button class="btn-action" onclick="imprimirOS('${os._id}')" title="Imprimir PDF"><i class="fas fa-print"></i></button>
                    <button class="btn-delete" onclick="deletarOS('${os._id}')"><i class="fas fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    };

    window.prepararEdicao = async (id) => {
        const res = await fetch(`/api/os/${id}`);
        const os = await res.json();
        abrirModalOS('editar', os);
    };

    // IMPRESSÃO DE PDF DA OS
    window.imprimirOS = async (id) => {
        const res = await fetch(`/api/os/${id}`);
        const os = await res.json();

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        doc.setFontSize(22); doc.setFont("helvetica", "bold");
        doc.text(`ORDEM DE SERVIÇO #${os.osNumber}`, 105, 20, null, null, "center");
        
        doc.setFontSize(10); doc.setFont("helvetica", "normal");
        doc.text(`Data Entrada: ${new Date(os.dataEntrada).toLocaleString()}`, 105, 28, null, null, "center");

        // Cliente
        doc.setFillColor(230, 230, 230); doc.rect(10, 35, 190, 8, 'F');
        doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.text("DADOS DO CLIENTE", 15, 40);
        
        doc.setFont("helvetica", "normal");
        doc.text(`Nome: ${os.cliente.nome}`, 15, 50);
        doc.text(`Telefone: ${os.cliente.telefone}`, 120, 50);

        // Aparelho
        doc.setFillColor(230, 230, 230); doc.rect(10, 60, 190, 8, 'F');
        doc.setFont("helvetica", "bold"); doc.text("DADOS DO APARELHO", 15, 65);
        
        doc.setFont("helvetica", "normal");
        doc.text(`Modelo: ${os.aparelho.modelo}`, 15, 75);
        doc.text(`IMEI: ${os.aparelho.imei || 'N/A'}`, 120, 75);
        doc.text(`Senha: ${os.aparelho.senha || 'Sem senha'}`, 15, 82);
        doc.text(`Acessórios: ${os.aparelho.acessorios || 'Nenhum'}`, 120, 82);

        // Checklist
        doc.setFillColor(230, 230, 230); doc.rect(10, 92, 190, 8, 'F');
        doc.setFont("helvetica", "bold"); doc.text("CHECKLIST DE ENTRADA", 15, 97);
        doc.setFont("helvetica", "normal"); doc.setFontSize(9);
        
        const checkMap = os.checklist;
        const itens = [
            `Liga: ${checkMap.liga ? 'SIM' : 'NÃO'}`, `Tela: ${checkMap.tela ? 'OK' : 'QUEBRADA/RISCO'}`,
            `Touch: ${checkMap.touch ? 'OK' : 'FALHA'}`, `Câmeras: ${checkMap.camera ? 'OK' : 'FALHA'}`,
            `Áudio: ${checkMap.audio ? 'OK' : 'FALHA'}`, `Carrega: ${checkMap.carga ? 'OK' : 'FALHA'}`,
            `Wi-Fi/Rede: ${checkMap.wifi ? 'OK' : 'FALHA'}`, `Biometria: ${checkMap.biom ? 'OK' : 'FALHA'}`
        ];
        
        let y = 105;
        let x = 15;
        itens.forEach((item, index) => {
            doc.text(item, x, y);
            x += 45;
            if((index + 1) % 4 === 0) { x = 15; y += 6; }
        });
        
        doc.text(`Obs: ${checkMap.obs || 'Nenhuma'}`, 15, y + 6);

        // Serviços e Valores
        y += 20;
        doc.setFillColor(230, 230, 230); doc.rect(10, y, 190, 8, 'F');
        doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.text("SERVIÇO E VALORES", 15, y + 5);
        
        y += 15;
        doc.setFont("helvetica", "normal");
        doc.text(`Defeito Relatado: ${os.servico.defeitoRelatado}`, 15, y);
        
        y += 10;
        doc.setFont("helvetica", "bold");
        doc.text(`TOTAL: R$ ${os.financeiro.total.toFixed(2)}`, 15, y);
        doc.setFontSize(10);
        doc.text(`(Sinal: R$ ${os.financeiro.sinal.toFixed(2)})`, 80, y);

        // Assinatura
        y += 20;
        if (os.assinaturaCliente) {
            doc.addImage(os.assinaturaCliente, 'PNG', 60, y, 80, 40);
            doc.line(60, y + 40, 140, y + 40);
            doc.text("Assinatura do Cliente", 100, y + 45, null, null, "center");
        } else {
            doc.line(60, y + 30, 140, y + 30);
            doc.text("Assinatura do Cliente", 100, y + 35, null, null, "center");
        }

        // Termos
        doc.setFontSize(8);
        doc.text("Garantia de 90 dias para serviços realizados (exceto em casos de mau uso, queda ou contato com líquidos).", 105, 280, null, null, "center");

        doc.save(`OS_${os.osNumber}.pdf`);
    };

    // CRUD Básico
    window.deletarOS = async (id) => { if(confirm("Apagar?")) { await fetch(`/api/os/${id}`, {method:'DELETE'}); carregarOS(); } };
    
    // Funções Compras/Financeiro mantidas...
    const canvas = document.getElementById('signature-pad');
    let signaturePadCompras;
    if(canvas) {
        signaturePadCompras = new SignaturePad(canvas, { backgroundColor: 'rgb(255, 255, 255)' });
        window.resizeCanvas = () => {
            const ratio = Math.max(window.devicePixelRatio || 1, 1);
            canvas.width = canvas.offsetWidth * ratio;
            canvas.height = canvas.offsetHeight * ratio;
            canvas.getContext("2d").scale(ratio, ratio);
        };
        window.addEventListener("resize", resizeCanvas);
        resizeCanvas();
        document.getElementById('clear-pad').addEventListener('click', () => signaturePadCompras.clear());
        loadHistory();
    }
    
    // ... Resto das funções de Recibo (gerarPDF, loadHistory, logout) iguais ao anterior ...
    // Estou reescrevendo o GerarPDF de Recibo apenas para garantir que não quebre,
    // assumindo que você vai colar este arquivo inteiro.
    window.gerarPDF = async () => {
         if (signaturePadCompras.isEmpty()) { alert("Assinatura obrigatória!"); return; }
         // ... (Lógica de recibo igual ao anterior) ...
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
        await fetch('/api/recibos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) });
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.setFontSize(22); doc.text("RECIBO DE COMPRA", 105, 20, null, null, "center");
        doc.setFontSize(12); doc.text(`Eu, ${dados.nome}, CPF ${dados.cpf}, vendo ${dados.modelo} por R$ ${dados.valor}.`, 20, 50);
        doc.addImage(dados.assinatura, 'PNG', 60, 80, 90, 45);
        doc.save(`Recibo_${dados.modelo}.pdf`);
        loadHistory();
    };

    window.loadHistory = async () => {
        const tb = document.querySelector('#history-table tbody'); if(!tb) return;
        const res = await fetch('/api/recibos'); const lista = await res.json();
        tb.innerHTML = "";
        lista.forEach(r => {
            tb.innerHTML += `<tr><td>${new Date(r.dataCriacao).toLocaleDateString()}</td><td>${r.nome}</td><td>${r.modelo}</td><td>R$ ${r.valor}</td><td><button onclick="deletarRecibo('${r._id}')" class="btn-delete">X</button></td></tr>`;
        });
    };
    window.deletarRecibo = async (id) => { if(confirm("Apagar?")) { await fetch(`/api/recibos/${id}`, {method:'DELETE'}); loadHistory(); }};
    window.logout = async () => { await fetch('/api/logout', { method: 'POST' }); window.location.href = 'login.html'; };

    // Financeiro
    window.carregarFinanceiro = async () => {
        const tb = document.querySelector('#finance-table tbody'); if(!tb) return;
        const res = await fetch('/api/financeiro'); const lista = await res.json();
        let t=0, e=0, s=0; tb.innerHTML="";
        lista.forEach(i => {
            const v = parseFloat(i.valor); if(i.tipo==='entrada'){e+=v;t+=v;}else{s+=v;t-=v;}
            tb.innerHTML+=`<tr><td>${new Date(i.data).toLocaleDateString()}</td><td>${i.descricao}</td><td>${i.tipo}</td><td>R$ ${v.toFixed(2)}</td><td><button class="btn-delete" onclick="delFin('${i._id}')">X</button></td></tr>`;
        });
        document.getElementById('dash-saldo').innerText=`R$ ${t.toFixed(2)}`;
        document.getElementById('dash-entradas').innerText=`R$ ${e.toFixed(2)}`;
        document.getElementById('dash-saidas').innerText=`R$ ${s.toFixed(2)}`;
    };
    window.salvarFinanceiro = async () => {
        const d=document.getElementById('fin-desc').value, v=document.getElementById('fin-valor').value, t=document.getElementById('fin-tipo').value;
        await fetch('/api/financeiro', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({descricao:d, valor:v, tipo:t})});
        carregarFinanceiro();
    };
    window.delFin = async(id)=>{if(confirm("Apagar?")){await fetch(`/api/financeiro/${id}`, {method:'DELETE'}); carregarFinanceiro();}};
});
