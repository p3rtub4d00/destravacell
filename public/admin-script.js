document.addEventListener('DOMContentLoaded', () => {
    
    // === 0. LOGOUT & AUTH ===
    window.logout = async () => {
        await fetch('/api/logout', {method:'POST'});
        window.location.href = 'login.html';
    };

    // === 1. LÓGICA DO RECIBO E ASSINATURA (MANTIDA) ===
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

        // Carrega histórico ao iniciar
        loadHistory();

        window.gerarPDF = async () => {
            if (signaturePad.isEmpty()) { alert("Assinatura obrigatória!"); return; }
            const btn = document.querySelector('.btn-generate');
            const txt = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando na Nuvem...'; btn.disabled = true;

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
                const res = await fetch('/api/recibos', {
                    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(dados)
                });
                if(!res.ok) throw new Error("Erro de conexão");
                const salvo = await res.json();
                
                gerarQRCodeEPDF(salvo);
                alert("✅ Recibo Salvo com Sucesso!");
                signaturePad.clear();
                document.getElementById('nome').value = "";
                document.getElementById('valor').value = "";
                loadHistory();
            } catch (e) { alert("Erro: " + e.message); } 
            finally { btn.innerHTML = txt; btn.disabled = false; }
        };
    }

    function gerarQRCodeEPDF(dados) {
        const id = dados._id || Date.now();
        const qrData = `NEXUS\nID:${id}\nIMEI:${dados.imei}\n$${dados.valor}`;
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

    // === PDF GENERATOR (MANTIDO) ===
    window.criarArquivoPDF = (d, qr, id) => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.setLineWidth(0.5); doc.setTextColor(0);
        
        // Cabeçalho
        doc.setFont("helvetica", "bold"); doc.setFontSize(22);
        doc.text("NEXUS DIGITAL", 105, 20, null, null, "center");
        doc.setFontSize(10); doc.setFont("helvetica", "normal");
        doc.text("Destrava Cell | Soluções Mobile", 105, 26, null, null, "center");
        doc.line(10, 30, 200, 30);

        doc.setFontSize(14); doc.setFont("helvetica", "bold");
        doc.text("RECIBO DE VENDA", 105, 40, null, null, "center");
        if(qr) doc.addImage(qr, 'PNG', 170, 10, 30, 30);

        let y = 55;
        // Campos de Dados
        const campos = [
            { t: "DADOS DA TRANSAÇÃO", c: [`Data: ${d.dataFormatada}`, `Valor: R$ ${d.valor}`] },
            { t: "VENDEDOR", c: [`Nome: ${d.nome}`, `CPF: ${d.cpf}`, `Endereço: ${d.endereco}`] },
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
            "1. O VENDEDOR declara ser o proprietário legítimo e que o bem é LÍCITO.",
            "2. O VENDEDOR isenta o Grupo NEXUS DIGITAL de responsabilidade civil/criminal.",
            "3. O VENDEDOR assume responsabilidade caso o aparelho entre em Blacklist (Roubo/Furto).",
            "4. A posse é transferida neste ato, em caráter irrevogável."
        ];
        termos.forEach(t => { doc.text(t, 20, y); y+=5; });
        
        y+=20;
        if(d.assinatura) { doc.rect(60, y-5, 90, 30); doc.addImage(d.assinatura, 'PNG', 75, y, 60, 25); }
        y+=30; doc.text("ASSINATURA DO VENDEDOR", 105, y, null, null, "center");
        
        const avisoLegal = "Aviso Legal: A Destrava Cell repudia qualquer atividade ilícita. Realizamos consulta prévia de IMEI em todos os aparelhos. Não compramos e não desbloqueamos aparelhos com restrição de roubo ou furto (Blacklist).";
        doc.setFontSize(7); doc.setTextColor(80);
        doc.text(avisoLegal, 105, 285, { maxWidth: 180, align: "center" });

        const safeName = d.nome ? d.nome.split(' ')[0].replace(/[^a-z0-9]/gi, '') : 'Recibo';
        doc.save(`Recibo_${safeName}.pdf`);
    };

    // --- FUNÇÕES DE HISTÓRICO RECIBO ---
    async function loadHistory() {
        const tb = document.querySelector('#history-table tbody');
        if(!tb) return;
        tb.innerHTML = "<tr><td colspan='5' style='text-align:center'>Carregando nuvem...</td></tr>";
        try {
            const res = await fetch('/api/recibos');
            const lista = await res.json();
            tb.innerHTML = "";
            if(lista.length === 0) { tb.innerHTML = "<tr><td colspan='5' style='text-align:center'>Nenhum registro.</td></tr>"; return; }
            
            lista.forEach(i => {
                const tr = document.createElement('tr');
                const dataShow = i.dataFormatada || "--";
                tr.innerHTML = `<td>${dataShow}</td><td>${i.nome}</td><td>${i.modelo}</td><td>R$ ${i.valor}</td>
                <td><button class="btn-reprint" onclick="reimprimir('${i._id}')"><i class="fas fa-print"></i></button>
                <button class="btn-delete" onclick="deletar('${i._id}')"><i class="fas fa-trash"></i></button></td>`;
                tb.appendChild(tr);
            });
        } catch(e) { tb.innerHTML = "<tr><td colspan='5'>Erro ao carregar.</td></tr>"; }
    }
    
    window.reimprimir = async (id) => {
        try {
            const res = await fetch(`/api/recibos/${id}`);
            const item = await res.json();
            if(item) gerarQRCodeEPDF(item);
        } catch(e) { alert("Erro ao recuperar."); }
    };
    window.deletar = async (id) => {
        if(confirm("Apagar permanentemente?")) { await fetch(`/api/recibos/${id}`, {method:'DELETE'}); loadHistory(); }
    };

    // === 2. LÓGICA DO FINANCEIRO (NOVO) ===
    
    window.carregarFinanceiro = async () => {
        const tb = document.querySelector('#finance-table tbody');
        if(!tb) return;
        
        try {
            const res = await fetch('/api/financeiro');
            const lista = await res.json();
            
            let total = 0;
            let entradas = 0;
            let saidas = 0;
            
            tb.innerHTML = "";
            lista.forEach(item => {
                const val = parseFloat(item.valor);
                if(item.tipo === 'entrada') { entradas += val; total += val; }
                else { saidas += val; total -= val; }

                const tr = document.createElement('tr');
                const badge = item.tipo === 'entrada' ? '<span style="background: rgba(0, 255, 136, 0.1); color: #00ff88; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem;">ENTRADA</span>' : '<span style="background: rgba(255, 68, 68, 0.1); color: #ff4444; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem;">SAÍDA</span>';
                const corValor = item.tipo === 'entrada' ? 'color:#00ff88' : 'color:#ff4444';
                const dataFormatada = new Date(item.data).toLocaleDateString('pt-BR');

                tr.innerHTML = `
                    <td>${dataFormatada}</td>
                    <td>${item.descricao}</td>
                    <td>${badge}</td>
                    <td style="${corValor}">R$ ${val.toFixed(2)}</td>
                    <td><button class="btn-delete" onclick="deletarFin('${item._id}')"><i class="fas fa-trash"></i></button></td>
                `;
                tb.appendChild(tr);
            });

            // Atualiza Dashboard
            const saldoEl = document.getElementById('dash-saldo');
            if(saldoEl) {
                saldoEl.innerText = `R$ ${total.toFixed(2)}`;
                saldoEl.style.color = total >= 0 ? '#00ff88' : '#ff4444';
            }
            if(document.getElementById('dash-entradas')) document.getElementById('dash-entradas').innerText = `R$ ${entradas.toFixed(2)}`;
            if(document.getElementById('dash-saidas')) document.getElementById('dash-saidas').innerText = `R$ ${saidas.toFixed(2)}`;

        } catch(e) { console.error("Erro financeiro", e); }
    };

    window.salvarFinanceiro = async () => {
        const desc = document.getElementById('fin-desc').value;
        const valor = document.getElementById('fin-valor').value;
        const tipo = document.getElementById('fin-tipo').value;

        if(!desc || !valor) { alert("Preencha descrição e valor!"); return; }

        try {
            await fetch('/api/financeiro', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ descricao: desc, valor: parseFloat(valor), tipo })
            });
            document.getElementById('fin-desc').value = "";
            document.getElementById('fin-valor').value = "";
            carregarFinanceiro();
        } catch(e) { alert("Erro ao salvar."); }
    };

    window.deletarFin = async (id) => {
        if(confirm("Remover este lançamento?")) {
            await fetch(`/api/financeiro/${id}`, {method:'DELETE'});
            carregarFinanceiro();
        }
    };


    // === 3. TABELA DE PREÇOS GIGANTE (MANTIDA 100%) ===
    
    const bancoPrecos = [
        // === SAMSUNG ===
        // Linha A (Entrada/Intermediário)
        { m: "Samsung", mod: "Galaxy A01 Core", serv: "100", blq: "50", ok: "150" },
        { m: "Samsung", mod: "Galaxy A02 / A02s", serv: "120", blq: "80", ok: "200" },
        { m: "Samsung", mod: "Galaxy A03 / A03s / Core", serv: "120", blq: "100", ok: "250" },
        { m: "Samsung", mod: "Galaxy A04 / A04e / A04s", serv: "140", blq: "150", ok: "350" },
        { m: "Samsung", mod: "Galaxy A05 / A05s", serv: "150", blq: "200", ok: "500" },
        { m: "Samsung", mod: "Galaxy A06", serv: "160", blq: "250", ok: "600" },
        
        { m: "Samsung", mod: "Galaxy A11", serv: "120", blq: "100", ok: "250" },
        { m: "Samsung", mod: "Galaxy A12", serv: "130", blq: "150", ok: "350" },
        { m: "Samsung", mod: "Galaxy A13", serv: "140", blq: "200", ok: "450" },
        { m: "Samsung", mod: "Galaxy A14 4G/5G", serv: "160", blq: "250", ok: "600" },
        { m: "Samsung", mod: "Galaxy A15 5G", serv: "180", blq: "300", ok: "750" },
        { m: "Samsung", mod: "Galaxy A16 5G", serv: "200", blq: "350", ok: "850" },

        { m: "Samsung", mod: "Galaxy A21s", serv: "130", blq: "150", ok: "400" },
        { m: "Samsung", mod: "Galaxy A22 4G/5G", serv: "150", blq: "200", ok: "500" },
        { m: "Samsung", mod: "Galaxy A23", serv: "160", blq: "250", ok: "600" },
        { m: "Samsung", mod: "Galaxy A24", serv: "180", blq: "300", ok: "700" },
        { m: "Samsung", mod: "Galaxy A25 5G", serv: "200", blq: "400", ok: "900" },

        { m: "Samsung", mod: "Galaxy A31", serv: "140", blq: "200", ok: "450" },
        { m: "Samsung", mod: "Galaxy A32 4G/5G", serv: "160", blq: "250", ok: "550" },
        { m: "Samsung", mod: "Galaxy A33 5G", serv: "180", blq: "300", ok: "700" },
        { m: "Samsung", mod: "Galaxy A34 5G", serv: "220", blq: "450", ok: "950" },
        { m: "Samsung", mod: "Galaxy A35 5G", serv: "250", blq: "600", ok: "1200" },

        { m: "Samsung", mod: "Galaxy A51", serv: "150", blq: "250", ok: "550" },
        { m: "Samsung", mod: "Galaxy A52 / A52s 5G", serv: "180", blq: "350", ok: "800" },
        { m: "Samsung", mod: "Galaxy A53 5G", serv: "200", blq: "450", ok: "950" },
        { m: "Samsung", mod: "Galaxy A54 5G", serv: "250", blq: "600", ok: "1300" },
        { m: "Samsung", mod: "Galaxy A55 5G", serv: "280", blq: "800", ok: "1600" },

        { m: "Samsung", mod: "Galaxy A71", serv: "160", blq: "300", ok: "650" },
        { m: "Samsung", mod: "Galaxy A72", serv: "180", blq: "350", ok: "750" },
        { m: "Samsung", mod: "Galaxy A73 5G", serv: "220", blq: "500", ok: "1100" },

        // Linha M (Bateria)
        { m: "Samsung", mod: "Galaxy M12 / M13 / M14", serv: "140", blq: "200", ok: "500" },
        { m: "Samsung", mod: "Galaxy M15 5G", serv: "160", blq: "300", ok: "700" },
        { m: "Samsung", mod: "Galaxy M21s / M22 / M23", serv: "150", blq: "250", ok: "600" },
        { m: "Samsung", mod: "Galaxy M31 / M32 / M34", serv: "160", blq: "300", ok: "700" },
        { m: "Samsung", mod: "Galaxy M35 5G", serv: "180", blq: "400", ok: "900" },
        { m: "Samsung", mod: "Galaxy M51 / M52 / M53", serv: "180", blq: "400", ok: "900" },
        { m: "Samsung", mod: "Galaxy M54 / M55", serv: "220", blq: "600", ok: "1300" },

        // Linha S (Premium)
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
        { m: "Samsung", mod: "Z Flip 3 / 4 / 5", serv: "350", blq: "800", ok: "1800" },

        // === MOTOROLA ===
        { m: "Motorola", mod: "Moto E6s / E7 / Power", serv: "80", blq: "50", ok: "150" },
        { m: "Motorola", mod: "Moto E13", serv: "100", blq: "100", ok: "300" },
        { m: "Motorola", mod: "Moto E20 / E22 / E32", serv: "120", blq: "120", ok: "350" },
        { m: "Motorola", mod: "Moto E40", serv: "120", blq: "150", ok: "400" },
        
        { m: "Motorola", mod: "Moto G8 / Power / Play", serv: "100", blq: "100", ok: "250" },
        { m: "Motorola", mod: "Moto G9 / Play / Plus", serv: "120", blq: "150", ok: "350" },
        { m: "Motorola", mod: "Moto G10 / G20 / G30", serv: "130", blq: "180", ok: "400" },
        { m: "Motorola", mod: "Moto G22 / G32 / G42", serv: "140", blq: "200", ok: "500" },
        { m: "Motorola", mod: "Moto G52 / G62 5G", serv: "160", blq: "250", ok: "600" },
        { m: "Motorola", mod: "Moto G53 / G73 5G", serv: "180", blq: "300", ok: "700" },
        { m: "Motorola", mod: "Moto G04 / G24", serv: "140", blq: "200", ok: "500" },
        { m: "Motorola", mod: "Moto G34 5G", serv: "160", blq: "300", ok: "650" },
        { m: "Motorola", mod: "Moto G54 5G", serv: "180", blq: "350", ok: "800" },
        { m: "Motorola", mod: "Moto G84 5G", serv: "200", blq: "450", ok: "1000" },
        { m: "Motorola", mod: "Moto G85 5G", serv: "220", blq: "550", ok: "1200" },

        { m: "Motorola", mod: "Edge 20 / 20 Lite / Pro", serv: "200", blq: "400", ok: "900" },
        { m: "Motorola", mod: "Edge 30 / Neo / Fusion", serv: "220", blq: "500", ok: "1100" },
        { m: "Motorola", mod: "Edge 30 Ultra / Pro", serv: "250", blq: "800", ok: "1600" },
        { m: "Motorola", mod: "Edge 40 / Neo", serv: "250", blq: "700", ok: "1400" },
        { m: "Motorola", mod: "Edge 50 Fusion / Pro", serv: "300", blq: "1000", ok: "2000" },

        // === XIAOMI ===
        { m: "Xiaomi", mod: "Redmi 9 / 9A / 9C / 9T", serv: "100", blq: "80", ok: "250" },
        { m: "Xiaomi", mod: "Redmi 10 / 10A / 10C", serv: "120", blq: "150", ok: "400" },
        { m: "Xiaomi", mod: "Redmi 12 / 12C", serv: "130", blq: "200", ok: "500" },
        { m: "Xiaomi", mod: "Redmi 13C", serv: "140", blq: "250", ok: "600" },
        { m: "Xiaomi", mod: "Redmi A3", serv: "130", blq: "180", ok: "450" },

        { m: "Xiaomi", mod: "Redmi Note 8 / 8 Pro", serv: "120", blq: "150", ok: "350" },
        { m: "Xiaomi", mod: "Redmi Note 9 / 9S / Pro", serv: "130", blq: "200", ok: "450" },
        { m: "Xiaomi", mod: "Redmi Note 10 / 10S / Pro", serv: "150", blq: "300", ok: "650" },
        { m: "Xiaomi", mod: "Redmi Note 11 / 11S", serv: "160", blq: "350", ok: "750" },
        { m: "Xiaomi", mod: "Redmi Note 12 4G/5G", serv: "180", blq: "400", ok: "850" },
        { m: "Xiaomi", mod: "Redmi Note 12 Pro / Plus", serv: "220", blq: "600", ok: "1200" },
        { m: "Xiaomi", mod: "Redmi Note 13 4G/5G", serv: "200", blq: "500", ok: "1000" },
        { m: "Xiaomi", mod: "Redmi Note 13 Pro / Pro+", serv: "250", blq: "800", ok: "1600" },

        { m: "Xiaomi", mod: "Poco M3 / M4 / M5", serv: "150", blq: "250", ok: "600" },
        { m: "Xiaomi", mod: "Poco X3 / NFC / Pro", serv: "160", blq: "300", ok: "700" },
        { m: "Xiaomi", mod: "Poco X4 Pro", serv: "180", blq: "400", ok: "800" },
        { m: "Xiaomi", mod: "Poco X5 / X5 Pro", serv: "200", blq: "500", ok: "1000" },
        { m: "Xiaomi", mod: "Poco X6 / X6 Pro", serv: "250", blq: "700", ok: "1400" },
        { m: "Xiaomi", mod: "Poco F3 / F4 / F5", serv: "250", blq: "600", ok: "1300" },

        { m: "Xiaomi", mod: "Mi 11 / 11 Lite", serv: "200", blq: "500", ok: "1000" },
        { m: "Xiaomi", mod: "Xiaomi 12 / 12 Lite", serv: "250", blq: "700", ok: "1400" },
        { m: "Xiaomi", mod: "Xiaomi 13 / 13 Lite", serv: "300", blq: "1000", ok: "2000" },

        // === INFINIX ===
        { m: "Infinix", mod: "Smart 5 / 6 / 7", serv: "100", blq: "80", ok: "250" },
        { m: "Infinix", mod: "Smart 8 / 8 Pro", serv: "120", blq: "150", ok: "350" },
        { m: "Infinix", mod: "Hot 10 / 11 / 12", serv: "130", blq: "150", ok: "400" },
        { m: "Infinix", mod: "Hot 20 / 30 / 40", serv: "140", blq: "250", ok: "600" },
        { m: "Infinix", mod: "Note 10 / 11 / 12 Pro", serv: "160", blq: "300", ok: "700" },
        { m: "Infinix", mod: "Note 30 5G / 40 Pro", serv: "180", blq: "450", ok: "1000" },
        { m: "Infinix", mod: "Zero 5G / Ultra", serv: "200", blq: "500", ok: "1100" },

        // === APPLE (IPHONE) ===
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
                        <span class="price-label">Serviço (Desbloqueio)</span>
                        <span class="price-value val-service">R$ ${item.serv}</span>
                    </div>
                    <div class="price-box">
                        <span class="price-label">Compro (Bloqueado)</span>
                        <span class="price-value val-buy-bad">R$ ${item.blq}</span>
                    </div>
                    <div class="price-box">
                        <span class="price-label">Compro (Funcionando)</span>
                        <span class="price-value val-buy-ok">R$ ${item.ok}</span>
                    </div>
                    <div class="price-box">
                        <span class="price-label">Lucro Estimado</span>
                        <span class="price-value val-profit">+ R$ ${parseInt(item.ok) - parseInt(item.blq) - 50}</span>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    };
});
