document.addEventListener('DOMContentLoaded', function() {
    const navButtons = document.querySelectorAll('.nav-button');
    const rightPanel = document.querySelector('.right-panel');
    const spotlight = document.querySelector('.spotlight');
    const rightPanelBg = document.querySelector('.right-panel-bg');
    
    // Spotlight effect - constrained within the right panel
    document.addEventListener('mousemove', function(e) {
        const x = e.clientX;
        const y = e.clientY;
        
        // Move spotlight only when mouse is over the right panel
        const rightPanelRect = rightPanel.getBoundingClientRect();
        if (
            x >= rightPanelRect.left && 
            x <= rightPanelRect.right && 
            y >= rightPanelRect.top && 
            y <= rightPanelRect.bottom
        ) {
            spotlight.style.opacity = '1';
            
            // Calculate position relative to the visible part of the right panel
            const relativeX = x - rightPanelRect.left;
            const relativeY = y - rightPanelRect.top;
            
            // Apply the position without adding scrollTop
            spotlight.style.left = `${relativeX}px`;
            spotlight.style.top = `${relativeY}px`;
        } else {
            spotlight.style.opacity = '0';
        }
    });
    
    // Experience section position for opacity calculation
    const experienceSection = document.getElementById('experience');
    let experiencePosition = experienceSection ? experienceSection.offsetTop : 500;
    
    // Background fade effect on scroll - faster transition
    rightPanel.addEventListener('scroll', function() {
        // Get the current scroll position
        const scrollPosition = rightPanel.scrollTop;
        
        // Calculate opacity based on scroll position relative to Experience section
        // Fade to almost invisible by the time we reach the Experience section
        let opacity;
        if (scrollPosition <= 50) {
            // Start with full opacity
            opacity = 0.15;
        } else if (scrollPosition >= experiencePosition) {
            // Almost invisible at Experience section
            opacity = 0.02;
        } else {
            // Linear fade between the two points, but with a steeper curve
            const ratio = scrollPosition / experiencePosition;
            opacity = 0.15 - (ratio * 0.13); // This makes it fade much faster
        }
        
        rightPanelBg.style.opacity = opacity.toString();
    });
    
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
    
    // Initial opacity adjustment on page load
    rightPanel.dispatchEvent(new Event('scroll'));
    
    // Recalculate experience position if window resizes
    window.addEventListener('resize', function() {
        experiencePosition = experienceSection ? experienceSection.offsetTop : 500;
        rightPanel.dispatchEvent(new Event('scroll'));
    });
});
