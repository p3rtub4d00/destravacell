document.addEventListener('DOMContentLoaded', () => {
    
    // === 1. LÓGICA DO RECIBO E ASSINATURA (MANTIDA) ===
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

    loadHistory();

    window.gerarPDF = async () => {
        if (signaturePad.isEmpty()) { alert("Assinatura obrigatória!"); return; }
        const btn = document.querySelector('.btn-generate');
        const txt = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...'; btn.disabled = true;

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
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(dados)
            });
            if(!res.ok) throw new Error("Erro de conexão");
            const salvo = await res.json();
            
            gerarQRCodeEPDF(salvo);
            alert("✅ Salvo na Nuvem!");
            signaturePad.clear();
            document.getElementById('nome').value = "";
            document.getElementById('valor').value = "";
            loadHistory();
        } catch (e) { alert("Erro: " + e.message); } 
        finally { btn.innerHTML = txt; btn.disabled = false; }
    };

    function gerarQRCodeEPDF(dados) {
        const id = dados._id || Date.now();
        const qrData = `NEXUS\nID:${id}\nIMEI:${dados.imei}\n$${dados.valor}`;
        const container = document.getElementById("qrcode-container");
        container.innerHTML = "";
        new QRCode(container, { text: qrData, width: 100, height: 100 });
        setTimeout(() => {
            const img = container.querySelector('canvas') ? container.querySelector('canvas').toDataURL() : null;
            criarArquivoPDF(dados, img, id);
        }, 100);
    }

    window.criarArquivoPDF = (d, qr, id) => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.setLineWidth(0.5); doc.setTextColor(0);
        
        doc.setFont("helvetica", "bold"); doc.setFontSize(22);
        doc.text("NEXUS DIGITAL", 105, 20, null, null, "center");
        doc.setFontSize(10); doc.setFont("helvetica", "normal");
        doc.text("Destrava Cell | Soluções Mobile", 105, 26, null, null, "center");
        doc.line(10, 30, 200, 30);

        doc.setFontSize(14); doc.setFont("helvetica", "bold");
        doc.text("RECIBO DE VENDA", 105, 40, null, null, "center");
        if(qr) doc.addImage(qr, 'PNG', 170, 10, 30, 30);

        let y = 55;
        // Campos
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

        y+=10; doc.setFontSize(8);
        doc.text("Declaro ser proprietário legítimo e isento a Nexus Digital de responsabilidade (Blacklist).", 20, y);
        
        y+=25;
        if(d.assinatura) { doc.rect(60, y-5, 90, 30); doc.addImage(d.assinatura, 'PNG', 75, y, 60, 25); }
        y+=30; doc.text("ASSINATURA DO VENDEDOR", 105, y, null, null, "center");
        
        doc.save(`Recibo_Nexus_${d.nome.split(' ')[0]}.pdf`);
    };

    // Histórico via API
    async function loadHistory() {
        const tb = document.querySelector('#history-table tbody');
        if(!tb) return;
        try {
            const res = await fetch('/api/recibos');
            const lista = await res.json();
            tb.innerHTML = "";
            lista.forEach(i => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${i.dataFormatada}</td><td>${i.nome}</td><td>${i.modelo}</td><td>R$ ${i.valor}</td>
                <td><button class="btn-delete" onclick="deletar('${i._id}')"><i class="fas fa-trash"></i></button></td>`;
                tb.appendChild(tr);
            });
        } catch(e) { console.error(e); }
    }
    window.deletar = async (id) => {
        if(confirm("Apagar?")) { await fetch(`/api/recibos/${id}`, {method:'DELETE'}); loadHistory(); }
    };

    // === 2. NOVA FUNCIONALIDADE: TABELA DE PREÇOS INTELIGENTE ===
    
    // Banco de Dados Local de Preços (Baseado na nossa conversa)
    const bancoPrecos = [
        // SAMSUNG
        { marca: "Samsung", modelo: "Galaxy A05 / A06", servico: "150", compra_ok: "250", compra_bloq: "100" },
        { marca: "Samsung", modelo: "Galaxy A14 / A15 5G", servico: "180", compra_ok: "380", compra_bloq: "200" },
        { marca: "Samsung", modelo: "Galaxy A34 / A54", servico: "250", compra_ok: "800", compra_bloq: "400" },
        { marca: "Samsung", modelo: "Galaxy A35 / A55", servico: "280", compra_ok: "900", compra_bloq: "500" },
        { marca: "Samsung", modelo: "Galaxy S21 FE", servico: "300", compra_ok: "900", compra_bloq: "600" },
        { marca: "Samsung", modelo: "Galaxy S22 / S23 FE", servico: "350", compra_ok: "1300", compra_bloq: "700" },
        { marca: "Samsung", modelo: "Galaxy S23 / Ultra", servico: "450", compra_ok: "2200", compra_bloq: "1000" },
        { marca: "Samsung", modelo: "Galaxy S24 / Ultra", servico: "500", compra_ok: "3500", compra_bloq: "1500" },
        
        // MOTOROLA
        { marca: "Motorola", modelo: "Moto E13 / G04", servico: "130", compra_ok: "200", compra_bloq: "80" },
        { marca: "Motorola", modelo: "Moto G24 / G34", servico: "160", compra_ok: "400", compra_bloq: "150" },
        { marca: "Motorola", modelo: "Moto G54 / G84", servico: "200", compra_ok: "650", compra_bloq: "300" },
        { marca: "Motorola", modelo: "Edge 30 / 40 Neo", servico: "280", compra_ok: "750", compra_bloq: "400" },
        
        // XIAOMI
        { marca: "Xiaomi", modelo: "Redmi 12 / 13C", servico: "140", compra_ok: "300", compra_bloq: "100" },
        { marca: "Xiaomi", modelo: "Note 12 / 13 (4G)", servico: "180", compra_ok: "550", compra_bloq: "250" },
        { marca: "Xiaomi", modelo: "Note 12 / 13 Pro 5G", servico: "250", compra_ok: "900", compra_bloq: "500" },
        { marca: "Xiaomi", modelo: "Poco X5 / X6", servico: "280", compra_ok: "850", compra_bloq: "500" },
        
        // IPHONE (Adicional Básico)
        { marca: "Apple", modelo: "iPhone 11", servico: "Consultar", compra_ok: "1000", compra_bloq: "Sucata" },
        { marca: "Apple", modelo: "iPhone 12", servico: "Consultar", compra_ok: "1400", compra_bloq: "Sucata" },
        { marca: "Apple", modelo: "iPhone 13", servico: "Consultar", compra_ok: "1900", compra_bloq: "Sucata" }
    ];

    // Função de Busca
    window.filtrarPrecos = () => {
        const termo = document.getElementById('searchInput').value.toLowerCase();
        const container = document.getElementById('results-container');
        container.innerHTML = "";

        if(termo.length < 2) return; // Só busca se tiver 2 letras

        const resultados = bancoPrecos.filter(item => 
            item.modelo.toLowerCase().includes(termo) || 
            item.marca.toLowerCase().includes(termo)
        );

        if(resultados.length === 0) {
            container.innerHTML = "<p style='color:#666; text-align:center;'>Nenhum modelo encontrado.</p>";
            return;
        }

        resultados.forEach(item => {
            const card = document.createElement('div');
            card.className = "price-card";
            card.innerHTML = `
                <div class="model-name">
                    ${item.modelo}
                    <span class="brand-tag">${item.marca}</span>
                </div>
                <div class="price-grid">
                    <div class="price-item" style="border: 1px solid var(--primary-color);">
                        <span class="price-label">Cobrar Desbloqueio</span>
                        <span class="price-value green">R$ ${item.servico}</span>
                    </div>
                    <div class="price-item">
                        <span class="price-label">Comprar (Bloqueado)</span>
                        <span class="price-value">R$ ${item.compra_bloq}</span>
                    </div>
                    <div class="price-item">
                        <span class="price-label">Comprar (Funcionando)</span>
                        <span class="price-value blue">R$ ${item.compra_ok}</span>
                    </div>
                    <div class="price-item">
                        <span class="price-label">Margem Lucro Est.</span>
                        <span class="price-value" style="color:#aaa;">+ R$ ${parseInt(item.compra_ok) - parseInt(item.compra_bloq) - 50}</span>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    };
});
