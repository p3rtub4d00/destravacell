document.addEventListener('DOMContentLoaded', () => {
    
    // ===============================================
    // 1. LÓGICA DO MENU MOBILE
    // ===============================================
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('.nav-links');
    const navItems = document.querySelectorAll('.nav-links li');

    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            
            const icon = menuToggle.querySelector('i');
            if(navLinks.classList.contains('active')){
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-times');
            } else {
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            }

            navItems.forEach((link, index) => {
                if (link.style.animation) {
                    link.style.animation = '';
                } else {
                    link.style.animation = `navLinkFade 0.5s ease forwards ${index / 7 + 0.3}s`;
                }
            });
        });
    }

    // Fecha menu ao clicar em link
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            if(navLinks.classList.contains('active')){
                navLinks.classList.remove('active');
                const icon = menuToggle.querySelector('i');
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
                navItems.forEach(link => link.style.animation = '');
            }
        });
    });

    // ===============================================
    // 2. SCROLL SUAVE
    // ===============================================
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if(target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    // ===============================================
    // 3. ANIMAÇÃO DE ENTRADA (Cards)
    // ===============================================
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = 1;
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.card').forEach(card => {
        card.style.opacity = 0;
        card.style.transform = 'translateY(30px)';
        card.style.transition = 'all 0.6s ease-out';
        observer.observe(card);
    });

    // ===============================================
    // 4. NOTIFICAÇÕES AUTOMÁTICAS
    // ===============================================
    const names = ["Carlos S.", "Eduardo M.", "Ana Paula", "Rogério T.", "Fernanda L.", "João Pedro", "Lucas B.", "Marcos V.", "Júlia C."];
    const actions = [
        { text: "Desbloqueou Conta Google", icon: "fa-unlock" },
        { text: "Removeu MDM/PayJoy", icon: "fa-file-invoice-dollar" },
        { text: "Vendeu Samsung S22", icon: "fa-hand-holding-usd" },
        { text: "Solicitou orçamento", icon: "fa-comments" },
        { text: "Vendeu iPhone 11", icon: "fa-mobile-alt" },
        { text: "Desbloqueou Xiaomi Note 12", icon: "fa-shield-alt" }
    ];
    const cities = ["Porto Velho", "Ji-Paraná", "Ariquemes", "Cacoal", "Vilhena", "Online"];

    function showNotification() {
        const container = document.getElementById('notification-container');
        if(!container) return;

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
            <small class="toast-time">Agora</small>
        `;

        container.appendChild(notification);
        setTimeout(() => notification.remove(), 5000);
    }

    setTimeout(() => {
        showNotification();
        setInterval(() => {
            showNotification();
        }, Math.floor(Math.random() * (15000 - 8000 + 1) + 8000));
    }, 3000);

    // ===============================================
    // 5. LÓGICA DO FAQ (ACORDEÃO)
    // ===============================================
    const faqQuestions = document.querySelectorAll('.faq-question');

    faqQuestions.forEach(question => {
        question.addEventListener('click', () => {
            const item = question.parentElement;
            
            // Fecha os outros (Opcional, se quiser que fique só um aberto)
            document.querySelectorAll('.faq-item').forEach(otherItem => {
                if(otherItem !== item) {
                    otherItem.classList.remove('active');
                }
            });

            // Alterna o atual
            item.classList.toggle('active');
        });
    });
});
