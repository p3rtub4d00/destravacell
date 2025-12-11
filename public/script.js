document.addEventListener('DOMContentLoaded', () => {
    
    // ===============================================
    // 1. MENU MOBILE (Consertado)
    // ===============================================
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('.nav-links');
    const navItems = document.querySelectorAll('.nav-links li');

    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            
            // Troca ícone (Barras <-> X)
            const icon = menuToggle.querySelector('i');
            if(navLinks.classList.contains('active')){
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-times');
            } else {
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            }
        });
    }

    // Fecha o menu ao clicar em um link
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            if(navLinks.classList.contains('active')){
                navLinks.classList.remove('active');
                const icon = menuToggle.querySelector('i');
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            }
        });
    });

    // ===============================================
    // 2. FAQ (Acordeão)
    // ===============================================
    const faqQuestions = document.querySelectorAll('.faq-question');
    faqQuestions.forEach(question => {
        question.addEventListener('click', () => {
            const item = question.parentElement;
            item.classList.toggle('active');
        });
    });

    // ===============================================
    // 3. BOTS / NOTIFICAÇÕES (Estava faltando isso!)
    // ===============================================
    const names = ["Carlos S.", "Eduardo M.", "Ana Paula", "Rogério T.", "Fernanda L.", "João Pedro", "Lucas B.", "Marcos V.", "Júlia C.", "Roberto A.", "Patrícia D."];
    const actions = [
        { text: "Desbloqueou Conta Google", icon: "fa-unlock" },
        { text: "Removeu MDM/PayJoy", icon: "fa-file-invoice-dollar" },
        { text: "Vendeu um Samsung S22", icon: "fa-hand-holding-usd" },
        { text: "Solicitou orçamento", icon: "fa-comments" },
        { text: "Vendeu iPhone 11", icon: "fa-mobile-alt" },
        { text: "Desbloqueou Xiaomi Note 12", icon: "fa-shield-alt" }
    ];
    const cities = ["Porto Velho", "Ji-Paraná", "Ariquemes", "Cacoal", "Vilhena", "Online"];

    function showNotification() {
        const container = document.getElementById('notification-container');
        if(!container) return; // Se não achar o container, para aqui

        const randomName = names[Math.floor(Math.random() * names.length)];
        const randomAction = actions[Math.floor(Math.random() * actions.length)];
        const randomCity = cities[Math.floor(Math.random() * cities.length)];

        const notification = document.createElement('div');
        notification.classList.add('notification-toast');
        notification.innerHTML = `
            <div class="toast-icon"><i class="fas ${randomAction.icon}"></i></div>
            <div class="toast-content">
                <h4>${randomName} - ${randomCity}</h4>
                <p>${randomAction.text}</p>
            </div>
        `;

        container.appendChild(notification);
        
        // Remove após 5 segundos
        setTimeout(() => notification.remove(), 5000);
    }

    // Inicia os bots (Primeiro em 3s, depois a cada 8-15s)
    setTimeout(() => {
        showNotification();
        setInterval(() => {
            showNotification();
        }, Math.floor(Math.random() * (15000 - 8000 + 1) + 8000));
    }, 3000);

});
