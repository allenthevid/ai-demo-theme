const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
const mobileMenuClose = document.getElementById('mobile-menu-close');
const mobileMenu = document.getElementById('mobile-menu');

// Toggle mobile menu on hamburger click
mobileMenuToggle.addEventListener('click', function() {
    mobileMenu.classList.toggle('hidden');
    document.body.style.overflow = mobileMenu.classList.contains('hidden') ? 'auto' : 'hidden';
    this.setAttribute('aria-expanded', mobileMenu.classList.contains('hidden') ? 'false' : 'true');
});

// Close mobile menu on close button click
mobileMenuClose.addEventListener('click', function() {
    mobileMenu.classList.add('hidden');
    document.body.style.overflow = 'auto';
    mobileMenuToggle.setAttribute('aria-expanded', 'false');
});

// Close mobile menu when a link is clicked
const mobileMenuLinks = mobileMenu.querySelectorAll('a');
mobileMenuLinks.forEach(link => {
    link.addEventListener('click', function() {
        mobileMenu.classList.add('hidden');
        document.body.style.overflow = 'auto';
    });
});

// Mobile submenu toggle
document.querySelectorAll('.mobile-menu-toggle').forEach(button => {
    button.addEventListener('click', function(e) {
        e.preventDefault();
        const submenu = this.nextElementSibling;
        submenu.classList.toggle('hidden');
        
        const arrow = this.querySelector('.mobile-menu-arrow');
        if (submenu.classList.contains('hidden')) {
            arrow.style.transform = 'rotate(0deg)';
            this.setAttribute('aria-expanded', 'false');
        } else {
            arrow.style.transform = 'rotate(180deg)';
            this.setAttribute('aria-expanded', 'true');
        }
    });
});

// Mega menu hover functionality
document.querySelectorAll('.mega-menu-item').forEach(item => {
    const button = item.querySelector('.mega-menu-trigger');
    const menuId = button.getAttribute('data-menu');
    const megaMenuDropdown = document.getElementById(menuId);
    const arrow = button.querySelector('.mega-menu-arrow');
    
    let hoverTimeout;

    // Show mega menu on hover
    item.addEventListener('mouseenter', function() {
        clearTimeout(hoverTimeout);
        
        // Close all normal dropdown menus
        document.querySelectorAll('.dropdown-menu-dropdown').forEach(menu => {
            menu.classList.add('hidden');
        });
        document.querySelectorAll('.dropdown-menu-trigger .dropdown-menu-arrow').forEach(arrow => {
            arrow.style.transform = 'rotate(0deg)';
        });
        document.querySelectorAll('.dropdown-menu-trigger').forEach(btn => btn.setAttribute('aria-expanded', 'false'));
        
        // Close all other mega menus
        document.querySelectorAll('.mega-menu-dropdown').forEach(menu => {
            if (menu.id !== menuId) {
                menu.classList.add('hidden');
                const relatedButton = document.querySelector(`[data-menu="${menu.id}"]`);
                if (relatedButton) {
                    const relatedArrow = relatedButton.querySelector('.mega-menu-arrow');
                    if (relatedArrow) relatedArrow.style.transform = 'rotate(0deg)';
                    relatedButton.setAttribute('aria-expanded', 'false');
                }
            }
        });

        // Show current mega menu
        megaMenuDropdown.classList.remove('hidden');
        if (arrow) arrow.style.transform = 'rotate(180deg)';
        button.setAttribute('aria-expanded', 'true');
    });

    // Hide mega menu on mouse leave with slight delay
    item.addEventListener('mouseleave', function() {
        hoverTimeout = setTimeout(() => {
            megaMenuDropdown.classList.add('hidden');
            if (arrow) arrow.style.transform = 'rotate(0deg)';
            button.setAttribute('aria-expanded', 'false');
        }, 200); // 200ms delay before closing
    });

    // Prevent closing when hovering over the dropdown
    megaMenuDropdown.addEventListener('mouseenter', function() {
        clearTimeout(hoverTimeout);
    });

    megaMenuDropdown.addEventListener('mouseleave', function() {
        megaMenuDropdown.classList.add('hidden');
        if (arrow) arrow.style.transform = 'rotate(0deg)';
        button.setAttribute('aria-expanded', 'false');
    });
});

// Normal dropdown (non-mega) hover functionality
document.querySelectorAll('.dropdown-menu-item').forEach(item => {
    const button = item.querySelector('.dropdown-menu-trigger');
    const menuId = button.getAttribute('data-menu');
    const dropdown = document.getElementById(menuId);
    const arrow = button.querySelector('.dropdown-menu-arrow');
    
    let hoverTimeout;

    // Show dropdown on hover
    item.addEventListener('mouseenter', function() {
        clearTimeout(hoverTimeout);
        
        // Close all other normal dropdowns
        document.querySelectorAll('.dropdown-menu-dropdown').forEach(menu => {
            if (menu.id !== menuId) menu.classList.add('hidden');
        });
        document.querySelectorAll('.dropdown-menu-trigger').forEach(btn => {
            if (btn !== button) {
                const arr = btn.querySelector('.dropdown-menu-arrow');
                if (arr) arr.style.transform = 'rotate(0deg)';
                btn.setAttribute('aria-expanded', 'false');
            }
        });

        // Close all mega menus when opening a normal dropdown
        document.querySelectorAll('.mega-menu-dropdown').forEach(menu => {
            menu.classList.add('hidden');
        });
        document.querySelectorAll('.mega-menu-trigger .mega-menu-arrow').forEach(arrow => {
            arrow.style.transform = 'rotate(0deg)';
        });
        document.querySelectorAll('.mega-menu-trigger').forEach(btn => btn.setAttribute('aria-expanded', 'false'));

        // Show current dropdown
        dropdown.classList.remove('hidden');
        if (arrow) arrow.style.transform = 'rotate(180deg)';
        button.setAttribute('aria-expanded', 'true');
    });

    // Hide dropdown on mouse leave with slight delay
    item.addEventListener('mouseleave', function() {
        hoverTimeout = setTimeout(() => {
            dropdown.classList.add('hidden');
            if (arrow) arrow.style.transform = 'rotate(0deg)';
            button.setAttribute('aria-expanded', 'false');
        }, 200); // 200ms delay before closing
    });

    // Prevent closing when hovering over the dropdown
    dropdown.addEventListener('mouseenter', function() {
        clearTimeout(hoverTimeout);
    });

    dropdown.addEventListener('mouseleave', function() {
        dropdown.classList.add('hidden');
        if (arrow) arrow.style.transform = 'rotate(0deg)';
        button.setAttribute('aria-expanded', 'false');
    });
});

    jQuery(document).on("nfFormReady", function (e, layoutView) {
        nfRadio.channel("nfMP").on("change:part", function ($) {
            var $submitContainer = jQuery('.submit-container');
            
            // 2. Target the inner wrapper of the footer (div inside .nf-mp-footer)
            var $footerWrapper = jQuery('.nf-mp-footer > div');

            // 3. Move the button if both exist
            if ($submitContainer.length > 0 && $footerWrapper.length > 0) {
                $footerWrapper.append($submitContainer);
            }
    });
});