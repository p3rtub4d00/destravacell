document.addEventListener('DOMContentLoaded', () => {
    // === CONFIGURAÇÃO DA ASSINATURA ===
    const canvas = document.getElementById('signature-pad');
    const signaturePad = new SignaturePad(canvas, {
        backgroundColor: 'rgb(255, 255, 255)',
        penColor: 'rgb(0, 0, 0)'
    });

    function resizeCanvas() {
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        canvas.getContext("2d").scale(ratio, ratio);
    }
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    document.getElementById('clear-pad').addEventListener('click', () => {
        signaturePad.clear();
    });

    // === CARREGAR HISTÓRICO AO ABRIR ===
    loadHistory();

    // === FUNÇÃO PRINCIPAL: GERAR PDF E SALVAR ===
    window.gerarPDF = async () => {
        if (signaturePad.isEmpty()) {
            alert("O cliente precisa assinar!");
            return;
        }

        // 1. Coletar Dados
        const dados = {
            id: Date.now(),
            data: new Date().toLocaleDateString('pt-BR'),
            hora: new Date().toLocaleTimeString('pt-BR'),
            nome: document.getElementById('nome').value || "Não informado",
            cpf: document.getElementById('cpf').value || "",
            rg: document.getElementById('rg').value || "",
            endereco: document.getElementById('endereco').value || "",
            modelo: document.getElementById('modelo').value || "",
            imei: document.getElementById('imei').value || "",
            valor: document.getElementById('valor').value || "0,00",
            estado: document.getElementById('estado').value,
            assinatura: signaturePad.toDataURL()
        };

        // 2. Gerar o Arquivo PDF
        criarArquivoPDF(dados);

        // 3. Salvar no Histórico e Limpar
        salvarNoHistorico(dados);
        alert("Recibo gerado com sucesso! Verifique seus downloads.");
        
        // Limpeza
        signaturePad.clear();
        document.getElementById('nome').value = "";
        document.getElementById('cpf').value = "";
        document.getElementById('rg').value = "";
        document.getElementById('endereco').value = "";
        document.getElementById('modelo').value = "";
        document.getElementById('imei').value = "";
        document.getElementById('valor').value = "";
    };

    // === FUNÇÃO PARA DESENHAR O PDF ===
    window.criarArquivoPDF = (d) => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Cor padrão: Preto
        doc.setTextColor(0, 0, 0);

        // Cabeçalho
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.text("RECIBO E DECLARAÇÃO DE VENDA", 105, 20, null, null, "center");

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        let y = 40;

        // Bloco Loja
        doc.setFont("helvetica", "bold");
        doc.text("COMPRADOR (LOJA):", 20, y);
        doc.setFont("helvetica", "normal");
        y += 6;
        doc.text("DESTRAVA CELL - Soluções em Software", 20, y);
        y += 5;
        doc.text("Porto Velho - Rondônia", 20, y);
        y += 15;

        // Bloco Vendedor
        doc.setFont("helvetica", "bold");
        doc.text("VENDEDOR (CLIENTE):", 20, y);
        doc.setFont("helvetica", "normal");
        y += 6;
        doc.text(`Nome: ${d.nome}`, 20, y);
        y += 5;
        doc.text(`CPF: ${d.cpf}  |  RG: ${d.rg}`, 20, y);
        y += 5;
        doc.text(`Endereço: ${d.endereco}`, 20, y);
        y += 15;

        // Bloco Aparelho
        doc.setFont("helvetica", "bold");
        doc.text("OBJETO DA VENDA:", 20, y);
        doc.setFont("helvetica", "normal");
        y += 6;
        doc.text(`Aparelho: ${d.modelo}`, 20, y);
        y += 5;
        doc.text(`IMEI: ${d.imei}`, 20, y);
        y += 5;
        doc.text(`Estado: ${d.estado}`, 20, y);
        y += 15;

        // Valor
        doc.setFont("helvetica", "bold");
        doc.text(`VALOR PAGO: R$ ${d.valor}`, 20, y);
        y += 15;

        // Termos de Responsabilidade
        doc.setFontSize(9);
        doc.text("DECLARAÇÃO DE RESPONSABILIDADE:", 20, y);
        y += 6;
        const termos = [
            "1. Declaro ser o legítimo proprietário do aparelho acima descrito.",
            "2. Declaro que o aparelho tem origem lícita e NÃO É produto de crime.",
            "3. Estou ciente da responsabilidade criminal caso o aparelho tenha restrição de roubo.",
            "4. Transfiro a posse e propriedade para a Destrava Cell."
        ];
        termos.forEach(t => {
            doc.text(t, 20, y);
            y += 5;
        });
        
        y += 10;
        doc.text(`Porto Velho - RO, ${d.data} às ${d.hora}`, 20, y);

        // Assinatura (Posição Y = 230, sobra espaço para o rodapé)
        y = 230; 
        if(d.assinatura) {
            doc.addImage(d.assinatura, 'PNG', 20, y - 20, 50, 25);
        }
        doc.line(20, y, 90, y);
        doc.text("Assinatura do Vendedor", 20, y + 5);

        // === AVISO LEGAL NO RODAPÉ (AGORA GARANTIDO) ===
        // Texto exato que você pediu
        const avisoLegal = "Aviso Legal: A Destrava Cell repudia qualquer atividade ilícita. Realizamos consulta prévia de IMEI em todos os aparelhos. Não compramos e não desbloqueamos aparelhos com restrição de roubo ou furto (Blacklist). Nossos serviços destinam-se a proprietários legítimos que perderam acesso às suas contas ou desejam quitar débitos contratuais.";
        
        // Configuração do Rodapé
        doc.setFontSize(8); // Tamanho pequeno para caber tudo
        doc.setFont("helvetica", "normal"); // Fonte normal
        doc.setTextColor(0, 0, 0); // Preto absoluto (0,0,0)
        
        // Posição fixa no final da página A4 (Y = 275)
        // maxWidth 170 garante que quebre a linha e não saia da margem
        doc.text(avisoLegal, 20, 275, {
            maxWidth: 170,
            align: "justify"
        });

        // Salvar Arquivo
        const nomeArquivo = `Recibo_${d.nome.split(' ')[0]}_${d.id}.pdf`;
        doc.save(nomeArquivo);
    };

    // === SISTEMA DE HISTÓRICO ===
    function salvarNoHistorico(dados) {
        let historico = JSON.parse(localStorage.getItem('destrava_recibos')) || [];
        historico.unshift(dados);
        localStorage.setItem('destrava_recibos', JSON.stringify(historico));
        loadHistory();
    }

    function loadHistory() {
        const tbody = document.querySelector('#history-table tbody');
        tbody.innerHTML = "";
        let historico = JSON.parse(localStorage.getItem('destrava_recibos')) || [];
        
        if (historico.length === 0) {
            tbody.innerHTML = "<tr><td colspan='5' style='text-align:center; padding:20px;'>Nenhum registro.</td></tr>";
            return;
        }

        historico.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.data}</td>
                <td>${item.nome}</td>
                <td>${item.modelo}</td>
                <td style="color:var(--primary-color)">R$ ${item.valor}</td>
                <td>
                    <button class="btn-reprint" onclick="reimprimir(${item.id})"><i class="fas fa-print"></i> PDF</button>
                    <button class="btn-delete" onclick="deletar(${item.id})"><i class="fas fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    window.reimprimir = (id) => {
        let historico = JSON.parse(localStorage.getItem('destrava_recibos')) || [];
        const item = historico.find(i => i.id === id);
        if (item) criarArquivoPDF(item);
    };

    window.deletar = (id) => {
        if(confirm("Apagar registro?")) {
            let historico = JSON.parse(localStorage.getItem('destrava_recibos')) || [];
            historico = historico.filter(i => i.id !== id);
            localStorage.setItem('destrava_recibos', JSON.stringify(historico));
            loadHistory();
        }
    };
});
