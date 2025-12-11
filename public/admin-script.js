document.addEventListener('DOMContentLoaded', () => {
    
    // ============================================================
    // 0. SISTEMA DE LOGIN (TELA DE BLOQUEIO)
    // ============================================================
    window.fazerLogin = async () => {
        const senha = document.getElementById('adminPass').value;
        const msg = document.getElementById('login-msg');
        
        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ senha })
            });
            const data = await res.json();
            
            if (data.auth) {
                document.getElementById('login-screen').style.display = 'none';
                document.getElementById('admin-content').style.display = 'block';
                // Carregar dados iniciais ao logar
                loadHistory(); 
                loadFinanceiro(); 
            } else {
                msg.style.display = 'block';
                msg.innerText = "Senha Incorreta";
            }
        } catch (e) {
            msg.style.display = 'block';
            msg.innerText = "Erro de conexão com o servidor";
        }
    };

    // ============================================================
    // 1. CONFIGURAÇÃO DO PAD DE ASSINATURA
    // ============================================================
    const canvas = document.getElementById('signature-pad');
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

    // ============================================================
    // 2. FUNÇÃO PRINCIPAL: GERAR RECIBO E SALVAR NO MONGO
    // ============================================================
    window.gerarPDF = async () => {
        if (signaturePad.isEmpty()) { alert("A assinatura do cliente é obrigatória!"); return; }

        const btn = document.querySelector('.btn-generate');
        const txtOriginal = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...'; 
        btn.disabled = true;

        const dados = {
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
            // Salva no Banco de Dados
            const res = await fetch('/api/recibos', {
                method: 'POST', 
                headers: {'Content-Type': 'application/json'}, 
                body: JSON.stringify(dados)
            });

            if(!res.ok) throw new Error("Erro ao salvar no banco de dados.");
            const salvo = await res.json();
            
            // Gera o PDF com QR Code
            gerarQRCodeEPDF(salvo);
            
            alert("✅ Recibo Salvo na Nuvem e Gerado com Sucesso!");
            
            // Limpeza
            signaturePad.clear();
            document.getElementById('nome').value = "";
            document.getElementById('cpf').value = "";
            document.getElementById('modelo').value = "";
            document.getElementById('imei').value = "";
            document.getElementById('valor').value = "";
            
            loadHistory(); // Atualiza a tabela

        } catch (e) { 
            alert("Erro: " + e.message); 
        } finally { 
            btn.innerHTML = txtOriginal; 
            btn.disabled = false; 
        }
    };

    // ============================================================
    // 3. GERAÇÃO DE QR CODE E PDF (LAYOUT COMPLETO)
    // ============================================================
    function gerarQRCodeEPDF(dados) {
        const id = dados._id || Date.now();
        const qrData = `NEXUS DIGITAL\nID:${id}\nIMEI:${dados.imei}\nVALOR: R$ ${dados.valor}\nDATA:${dados.dataFormatada}`;
        const container = document.getElementById("qrcode-container");
        
        if(container) {
            container.innerHTML = "";
            new QRCode(container, { text: qrData, width: 100, height: 100 });
            
            setTimeout(() => {
                const img = container.querySelector('canvas') ? container.querySelector('canvas').toDataURL() : null;
                criarArquivoPDF(dados, img, id);
            }, 100);
        }
    }

    window.criarArquivoPDF = (d, qr, id) => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.setLineWidth(0.5); doc.setTextColor(0);
        
        // Cabeçalho
        doc.setFont("helvetica", "bold"); doc.setFontSize(22);
        doc.text("NEXUS DIGITAL", 105, 20, null, null, "center");
        doc.setFontSize(10); doc.setFont("helvetica", "normal");
        doc.text("Divisão: Destrava Cell | Soluções Mobile", 105, 26, null, null, "center");
        doc.line(10, 30, 200, 30);

        doc.setFontSize(14); doc.setFont("helvetica", "bold");
        doc.text("RECIBO DE VENDA E TRANSFERÊNCIA", 105, 40, null, null, "center");
        
        if(qr) doc.addImage(qr, 'PNG', 170, 10, 30, 30);

        let y = 55;
        
        // Blocos de Informação
        const campos = [
            { t: "DADOS DA TRANSAÇÃO", c: [`Data: ${d.dataFormatada} às ${d.horaFormatada}`, `ID Cloud: #${String(id).slice(-6)}`, `Valor Pago: R$ ${d.valor}`] },
            { t: "VENDEDOR (CLIENTE)", c: [`Nome: ${d.nome}`, `CPF: ${d.cpf}  |  RG: ${d.rg}`, `Endereço: ${d.endereco}`] },
            { t: "OBJETO DA VENDA (APARELHO)", c: [`Modelo: ${d.modelo}`, `IMEI: ${d.imei}`, `Estado Declarado: ${d.estado}`] }
        ];

        campos.forEach(bloco => {
            doc.setFillColor(240,240,240); doc.rect(15, y, 180, 8, 'F');
            doc.setFont("helvetica", "bold"); doc.text(bloco.t, 20, y+6); y+=15;
            doc.setFont("helvetica", "normal");
            bloco.c.forEach(l => { doc.text(l, 20, y); y+=6; });
            y+=5;
        });

        // Termos Jurídicos Completos
        y+=10; 
        doc.setFont("helvetica", "bold"); doc.setFontSize(9);
        doc.text("TERMOS E RESPONSABILIDADE LEGAL:", 20, y); y+=6;
        
        doc.setFont("helvetica", "normal"); doc.setFontSize(8);
        const termos = [
            "1. O VENDEDOR declara ser o proprietário legítimo e que o bem é LÍCITO.",
            "2. O VENDEDOR isenta o Grupo NEXUS DIGITAL de qualquer responsabilidade civil/criminal.",
            "3. O VENDEDOR assume total responsabilidade caso o aparelho conste como Roubo/Furto (Blacklist).",
            "4. A posse e propriedade são transferidas neste ato, em caráter irrevogável e irretratável."
        ];
        termos.forEach(t => { doc.text(t, 20, y); y+=5; });
        
        // Assinatura
        y+=15;
        if(d.assinatura) { 
            doc.rect(60, y-5, 90, 35); 
            doc.addImage(d.assinatura, 'PNG', 75, y, 60, 25); 
        }
        y+=35; doc.setFont("helvetica", "bold");
        doc.text("ASSINATURA DO VENDEDOR", 105, y, null, null, "center");
        
        // Rodapé Jurídico
        doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(80);
        const aviso = "Aviso Legal: A Destrava Cell e o Grupo Nexus Digital repudiam qualquer atividade ilícita. Realizamos consulta prévia de IMEI. Não compramos aparelhos com restrição de roubo ou furto.";
        doc.text(aviso, 105, 285, { maxWidth: 180, align: "center" });

        // Salvar
        const safeName = d.nome ? d.nome.split(' ')[0].replace(/[^a-z0-9]/gi, '') : 'Recibo';
        doc.save(`Recibo_Nexus_${safeName}.pdf`);
    };

    // ============================================================
    // 4. HISTÓRICO DE RECIBOS (CRUD)
    // ============================================================
    async function loadHistory() {
        const tb = document.querySelector('#history-table tbody');
        if(!tb) return;
        tb.innerHTML = "<tr><td colspan='5' style='text-align:center'>Carregando dados...</td></tr>";
        try {
            const res = await fetch('/api/recibos');
            const lista = await res.json();
            tb.innerHTML = "";
            
            if(lista.length === 0) { 
                tb.innerHTML = "<tr><td colspan='5' style='text-align:center'>Nenhum registro.</td></tr>"; 
                return; 
            }
            
            lista.forEach(i => {
                const tr = document.createElement('tr');
                const dataShow = i.dataFormatada || "--";
                tr.innerHTML = `
                    <td>${dataShow}</td>
                    <td>${i.nome}</td>
                    <td>${i.modelo}</td>
                    <td style="color:var(--primary-color)">R$ ${i.valor}</td>
                    <td>
                        <button class="btn-delete" onclick="deletarRecibo('${i._id}')"><i class="fas fa-trash"></i></button>
                    </td>`;
                tb.appendChild(tr);
            });
        } catch(e) { tb.innerHTML = "<tr><td colspan='5'>Erro de conexão.</td></tr>"; }
    }

    window.deletarRecibo = async (id) => {
        if(confirm("Deseja apagar este recibo permanentemente?")) { 
            await fetch(`/api/recibos/${id}`, {method:'DELETE'}); 
            loadHistory(); 
        }
    };

    // ============================================================
    // 5. MÓDULO FINANCEIRO (Dashboard e Lançamentos)
    // ============================================================
    window.lancarFinanceiro = async () => {
        const dados = {
            tipo: document.getElementById('fin-tipo').value,
            categoria: document.getElementById('fin-categoria').value,
            descricao: document.getElementById('fin-desc').value,
            valor: parseFloat(document.getElementById('fin-valor').value),
            dataFormatada: new Date().toLocaleDateString('pt-BR')
        };

        if(!dados.descricao || !dados.valor) { alert("Preencha a descrição e o valor!"); return; }

        try {
            await fetch('/api/financeiro', {
                method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(dados)
            });
            alert("Lançamento Registrado!");
            document.getElementById('fin-desc').value = "";
            document.getElementById('fin-valor').value = "";
            loadFinanceiro();
        } catch (e) { alert("Erro ao lançar financeiro."); }
    };

    async function loadFinanceiro() {
        try {
            const res = await fetch('/api/financeiro');
            const lista = await res.json();
            const tb = document.querySelector('#finance-table tbody');
            if(!tb) return;
            
            tb.innerHTML = "";
            let totalEntrada = 0;
            let totalSaida = 0;

            lista.forEach(i => {
                const color = i.tipo === 'entrada' ? '#00ff88' : '#ff4444';
                const sinal = i.tipo === 'entrada' ? '+' : '-';
                
                if(i.tipo === 'entrada') totalEntrada += i.valor;
                else totalSaida += i.valor;

                tb.innerHTML += `
                    <tr>
                        <td>${i.dataFormatada}</td>
                        <td><span style="color:${color}">${i.categoria}</span></td>
                        <td>${i.descricao}</td>
                        <td style="color:${color}">${sinal} R$ ${i.valor.toFixed(2)}</td>
                        <td><button class="btn-delete" onclick="deletarFin('${i._id}')">X</button></td>
                    </tr>
                `;
            });

            // Atualiza Dashboard
            document.getElementById('dash-entradas').innerText = `R$ ${totalEntrada.toFixed(2)}`;
            document.getElementById('dash-saidas').innerText = `R$ ${totalSaida.toFixed(2)}`;
            const lucro = totalEntrada - totalSaida;
            const elLucro = document.getElementById('dash-lucro');
            elLucro.innerText = `R$ ${lucro.toFixed(2)}`;
            elLucro.style.color = lucro >= 0 ? '#00d4ff' : '#ff4444';

        } catch (e) { console.error("Erro financeiro"); }
    }

    window.deletarFin = async (id) => {
        if(confirm("Apagar lançamento financeiro?")) { 
            await fetch(`/api/financeiro/${id}`, {method:'DELETE'}); 
            loadFinanceiro(); 
        }
    };

    // ============================================================
    // 6. TABELA DE PREÇOS GIGANTE (2020-2025)
    // ============================================================
    
    const bancoPrecos = [
        // === SAMSUNG (Linha A, M, S, Z) ===
        { m: "Samsung", mod: "Galaxy A01 Core", serv: "100", blq: "50", ok: "150" },
        { m: "Samsung", mod: "Galaxy A02 / A02s", serv: "120", blq: "80", ok: "200" },
        { m: "Samsung", mod: "Galaxy A03 / A03s", serv: "130", blq: "100", ok: "250" },
        { m: "Samsung", mod: "Galaxy A04 / A04e", serv: "140", blq: "150", ok: "350" },
        { m: "Samsung", mod: "Galaxy A05 / A05s", serv: "150", blq: "200", ok: "500" },
        { m: "Samsung", mod: "Galaxy A06", serv: "160", blq: "250", ok: "600" },
        { m: "Samsung", mod: "Galaxy A11", serv: "120", blq: "100", ok: "250" },
        { m: "Samsung", mod: "Galaxy A12", serv: "130", blq: "150", ok: "350" },
        { m: "Samsung", mod: "Galaxy A13", serv: "140", blq: "200", ok: "450" },
        { m: "Samsung", mod: "Galaxy A14 4G/5G", serv: "160", blq: "250", ok: "600" },
        { m: "Samsung", mod: "Galaxy A15 5G", serv: "180", blq: "300", ok: "750" },
        { m: "Samsung", mod: "Galaxy A16 5G", serv: "200", blq: "350", ok: "850" },
        { m: "Samsung", mod: "Galaxy A21s", serv: "140", blq: "150", ok: "400" },
        { m: "Samsung", mod: "Galaxy A22", serv: "150", blq: "200", ok: "500" },
        { m: "Samsung", mod: "Galaxy A23", serv: "160", blq: "250", ok: "600" },
        { m: "Samsung", mod: "Galaxy A24", serv: "180", blq: "300", ok: "700" },
        { m: "Samsung", mod: "Galaxy A25 5G", serv: "200", blq: "400", ok: "900" },
        { m: "Samsung", mod: "Galaxy A31", serv: "140", blq: "200", ok: "450" },
        { m: "Samsung", mod: "Galaxy A32", serv: "160", blq: "250", ok: "550" },
        { m: "Samsung", mod: "Galaxy A33 5G", serv: "180", blq: "300", ok: "700" },
        { m: "Samsung", mod: "Galaxy A34 5G", serv: "220", blq: "450", ok: "950" },
        { m: "Samsung", mod: "Galaxy A35 5G", serv: "250", blq: "600", ok: "1200" },
        { m: "Samsung", mod: "Galaxy A51", serv: "150", blq: "250", ok: "550" },
        { m: "Samsung", mod: "Galaxy A52 / A52s", serv: "180", blq: "350", ok: "800" },
        { m: "Samsung", mod: "Galaxy A53 5G", serv: "200", blq: "450", ok: "950" },
        { m: "Samsung", mod: "Galaxy A54 5G", serv: "250", blq: "600", ok: "1300" },
        { m: "Samsung", mod: "Galaxy A55 5G", serv: "280", blq: "800", ok: "1600" },
        { m: "Samsung", mod: "Galaxy A71", serv: "160", blq: "300", ok: "650" },
        { m: "Samsung", mod: "Galaxy A72", serv: "180", blq: "350", ok: "750" },
        { m: "Samsung", mod: "Galaxy A73 5G", serv: "220", blq: "500", ok: "1100" },
        
        { m: "Samsung", mod: "Galaxy M12 / M13 / M14", serv: "140", blq: "200", ok: "500" },
        { m: "Samsung", mod: "Galaxy M15 5G", serv: "160", blq: "300", ok: "700" },
        { m: "Samsung", mod: "Galaxy M23 / M34 / M54", serv: "200", blq: "400", ok: "900" },
        { m: "Samsung", mod: "Galaxy M55 5G", serv: "250", blq: "600", ok: "1300" },

        { m: "Samsung", mod: "Galaxy S20 FE", serv: "200", blq: "400", ok: "850" },
        { m: "Samsung", mod: "Galaxy S21 FE", serv: "250", blq: "550", ok: "1100" },
        { m: "Samsung", mod: "Galaxy S21 / S21+", serv: "250", blq: "600", ok: "1300" },
        { m: "Samsung", mod: "Galaxy S21 Ultra", serv: "300", blq: "800", ok: "1800" },
        { m: "Samsung", mod: "Galaxy S22 / S22+", serv: "300", blq: "900", ok: "1800" },
        { m: "Samsung", mod: "Galaxy S22 Ultra", serv: "350", blq: "1200", ok: "2400" },
        { m: "Samsung", mod: "Galaxy S23 FE", serv: "300", blq: "1000", ok: "1900" },
        { m: "Samsung", mod: "Galaxy S23 / S23+", serv: "350", blq: "1300", ok: "2500" },
        { m: "Samsung", mod: "Galaxy S23 Ultra", serv: "400", blq: "1800", ok: "3200" },
        { m: "Samsung", mod: "Galaxy S24 / S24+", serv: "400", blq: "2000", ok: "3800" },
        { m: "Samsung", mod: "Galaxy S24 Ultra", serv: "500", blq: "2800", ok: "5000" },
        { m: "Samsung", mod: "Galaxy Z Flip 3/4/5", serv: "350", blq: "800", ok: "1800" },

        // === MOTOROLA ===
        { m: "Motorola", mod: "Moto E6s / E7 / Power", serv: "80", blq: "50", ok: "150" },
        { m: "Motorola", mod: "Moto E13 / E22", serv: "100", blq: "100", ok: "300" },
        { m: "Motorola", mod: "Moto E32 / E40", serv: "120", blq: "150", ok: "400" },
        { m: "Motorola", mod: "Moto G8 / Power", serv: "100", blq: "100", ok: "250" },
        { m: "Motorola", mod: "Moto G9 / Play / Plus", serv: "120", blq: "150", ok: "350" },
        { m: "Motorola", mod: "Moto G10 / G20 / G30", serv: "130", blq: "180", ok: "400" },
        { m: "Motorola", mod: "Moto G22 / G32 / G42", serv: "140", blq: "200", ok: "500" },
        { m: "Motorola", mod: "Moto G52 / G62", serv: "160", blq: "250", ok: "600" },
        { m: "Motorola", mod: "Moto G53 / G73", serv: "180", blq: "300", ok: "700" },
        { m: "Motorola", mod: "Moto G04 / G24", serv: "140", blq: "200", ok: "500" },
        { m: "Motorola", mod: "Moto G34 / G54", serv: "180", blq: "350", ok: "800" },
        { m: "Motorola", mod: "Moto G84 5G", serv: "200", blq: "450", ok: "1000" },
        { m: "Motorola", mod: "Moto G85 5G", serv: "220", blq: "550", ok: "1200" },
        { m: "Motorola", mod: "Edge 20 / Pro", serv: "200", blq: "400", ok: "900" },
        { m: "Motorola", mod: "Edge 30 / Fusion", serv: "220", blq: "500", ok: "1100" },
        { m: "Motorola", mod: "Edge 30 Ultra", serv: "250", blq: "800", ok: "1600" },
        { m: "Motorola", mod: "Edge 40 / Neo", serv: "250", blq: "700", ok: "1400" },
        { m: "Motorola", mod: "Edge 50 Fusion / Pro", serv: "300", blq: "1000", ok: "2000" },

        // === XIAOMI ===
        { m: "Xiaomi", mod: "Redmi 9 / 9A / 9C", serv: "100", blq: "80", ok: "250" },
        { m: "Xiaomi", mod: "Redmi 10 / 10C", serv: "120", blq: "150", ok: "400" },
        { m: "Xiaomi", mod: "Redmi 12 / 12C / 13C", serv: "140", blq: "200", ok: "550" },
        { m: "Xiaomi", mod: "Redmi Note 8 / Pro", serv: "120", blq: "150", ok: "350" },
        { m: "Xiaomi", mod: "Redmi Note 9 / S / Pro", serv: "130", blq: "200", ok: "450" },
        { m: "Xiaomi", mod: "Redmi Note 10 / S / Pro", serv: "150", blq: "300", ok: "650" },
        { m: "Xiaomi", mod: "Redmi Note 11 / S", serv: "160", blq: "350", ok: "750" },
        { m: "Xiaomi", mod: "Redmi Note 12 4G/5G", serv: "180", blq: "400", ok: "850" },
        { m: "Xiaomi", mod: "Redmi Note 12 Pro", serv: "220", blq: "600", ok: "1200" },
        { m: "Xiaomi", mod: "Redmi Note 13 4G/5G", serv: "200", blq: "500", ok: "1000" },
        { m: "Xiaomi", mod: "Redmi Note 13 Pro", serv: "250", blq: "800", ok: "1600" },
        { m: "Xiaomi", mod: "Poco M3 / M4 / M5", serv: "150", blq: "250", ok: "600" },
        { m: "Xiaomi", mod: "Poco X3 / Pro / NFC", serv: "160", blq: "300", ok: "700" },
        { m: "Xiaomi", mod: "Poco X4 Pro", serv: "180", blq: "400", ok: "800" },
        { m: "Xiaomi", mod: "Poco X5 / Pro", serv: "200", blq: "500", ok: "1000" },
        { m: "Xiaomi", mod: "Poco X6 / Pro", serv: "250", blq: "700", ok: "1400" },
        { m: "Xiaomi", mod: "Poco F3 / F4 / F5", serv: "250", blq: "600", ok: "1300" },
        { m: "Xiaomi", mod: "Mi 11 / 12 / 13 Lite", serv: "250", blq: "600", ok: "1400" },

        // === INFINIX ===
        { m: "Infinix", mod: "Smart 5 / 6 / 7", serv: "100", blq: "80", ok: "250" },
        { m: "Infinix", mod: "Smart 8 / Pro", serv: "120", blq: "150", ok: "350" },
        { m: "Infinix", mod: "Hot 10 / 11 / 12", serv: "130", blq: "150", ok: "400" },
        { m: "Infinix", mod: "Hot 20 / 30 / 40", serv: "140", blq: "250", ok: "600" },
        { m: "Infinix", mod: "Note 10 / 11 / 12", serv: "160", blq: "300", ok: "700" },
        { m: "Infinix", mod: "Note 30 / 40 5G", serv: "180", blq: "450", ok: "1000" },
        { m: "Infinix", mod: "Zero 5G / Ultra", serv: "200", blq: "500", ok: "1100" },

        // === APPLE ===
        { m: "Apple", mod: "iPhone 11", serv: "Consultar", blq: "500", ok: "1100" },
        { m: "Apple", mod: "iPhone 11 Pro / Max", serv: "Consultar", blq: "700", ok: "1500" },
        { m: "Apple", mod: "iPhone 12 / Mini", serv: "Consultar", blq: "800", ok: "1600" },
        { m: "Apple", mod: "iPhone 12 Pro / Max", serv: "Consultar", blq: "1000", ok: "2200" },
        { m: "Apple", mod: "iPhone 13 / Mini", serv: "Consultar", blq: "1200", ok: "2500" },
        { m: "Apple", mod: "iPhone 13 Pro / Max", serv: "Consultar", blq: "1500", ok: "3200" },
        { m: "Apple", mod: "iPhone 14 / Plus", serv: "Consultar", blq: "1600", ok: "3000" },
        { m: "Apple", mod: "iPhone 14 Pro / Max", serv: "Consultar", blq: "2000", ok: "4200" },
        { m: "Apple", mod: "iPhone 15 / Plus", serv: "Consultar", blq: "2200", ok: "3800" },
        { m: "Apple", mod: "iPhone 15 Pro / Max", serv: "Consultar", blq: "2800", ok: "5500" }
    ];

    window.filtrarPrecos = () => {
        const termo = document.getElementById('searchInput').value.toLowerCase();
        const container = document.getElementById('results-container');
        if(!container) return;
        container.innerHTML = "";

        if(termo.length < 2) return; 

        const resultados = bancoPrecos.filter(item => 
            item.mod.toLowerCase().includes(termo) || 
            item.m.toLowerCase().includes(termo)
        );

        if(resultados.length === 0) {
            container.innerHTML = "<p style='color:#666; text-align:center;'>Nenhum modelo encontrado.</p>";
            return;
        }

        resultados.forEach(item => {
            const card = document.createElement('div');
            card.className = "price-card";
            card.innerHTML = `
                <div class="model-header">
                    <span class="model-name">${item.mod}</span>
                    <span class="brand-badge">${item.m}</span>
                </div>
                <div class="price-grid">
                    <div class="price-box" style="border-color: var(--primary-color);">
                        <span class="price-label">Serviço</span>
                        <span class="price-value val-service">R$ ${item.serv}</span>
                    </div>
                    <div class="price-box">
                        <span class="price-label">Compra (Bloqueado)</span>
                        <span class="price-value val-buy-bad">R$ ${item.blq}</span>
                    </div>
                    <div class="price-box">
                        <span class="price-label">Compra (100%)</span>
                        <span class="price-value val-buy-ok">R$ ${item.ok}</span>
                    </div>
                    <div class="price-box">
                        <span class="price-label">Lucro Est.</span>
                        <span class="price-value val-profit">+ R$ ${parseInt(item.ok) - parseInt(item.blq) - 50}</span>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    };
});
