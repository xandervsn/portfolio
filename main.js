document.addEventListener('DOMContentLoaded', function() {
    const navButtons = document.querySelectorAll('.nav-button');
    const rightPanel = document.querySelector('.right-panel');
    
    function setActiveButton(button) {
        navButtons.forEach(btn => {
            btn.classList.remove('active');
        });
        
        button.classList.add('active');
    }
    
    navButtons.forEach(button => {
        button.addEventListener('click', function() {
            const sectionId = this.getAttribute('data-section');
            const section = document.getElementById(sectionId);
            
            rightPanel.scrollTo({
                top: section.offsetTop,
                behavior: 'smooth'
            });
            
            setActiveButton(this);
        });
    });
    
    setActiveButton(navButtons[0]);
    
    const sections = document.querySelectorAll('.section, .profile-section');
    const observerOptions = {
        root: rightPanel,
        rootMargin: '0px',
        threshold: 0.5
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.id;
                const activeButton = document.querySelector(`.nav-button[data-section="${id}"]`);
                if (activeButton) {
                    setActiveButton(activeButton);
                }
            }
        });
    }, observerOptions);
    
    sections.forEach(section => {
        observer.observe(section);
    });
    
    const projectItems = document.querySelectorAll('.project-item');
    projectItems.forEach(item => {
        item.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-5px)';
        });
        
        item.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
    });
    
    rightPanel.style.scrollBehavior = 'smooth';
});