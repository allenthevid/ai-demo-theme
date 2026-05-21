document.addEventListener('DOMContentLoaded', function() {
    const section = document.querySelector('section.category-archive, section.archive-page');
    if (!section) return;

    const postsGrid = section.querySelector('.posts-grid');
    const paginationContainer = section.querySelector('.pagination-container');
    
    // Settings
    let currentOrder = 'DESC';
    const bgColor = section.dataset.bgColor || '0';
    const categoryId = section.dataset.categoryId || '0';

    // 1. Sort Handlers
    const sortDescBtn = section.querySelector('.sort-desc');
    const sortAscBtn = section.querySelector('.sort-asc');

    if (sortDescBtn && sortAscBtn) {
        sortDescBtn.addEventListener('click', () => handleSort('DESC', sortDescBtn, sortAscBtn));
        sortAscBtn.addEventListener('click', () => handleSort('ASC', sortAscBtn, sortDescBtn));
    }

    function handleSort(order, activeBtn, inactiveBtn) {
        if (currentOrder === order) return;
        currentOrder = order;
        activeBtn.classList.add('active');
        activeBtn.setAttribute('aria-pressed', 'true');
        inactiveBtn.classList.remove('active');
        inactiveBtn.setAttribute('aria-pressed', 'false');
        loadPosts(1); // Reset to page 1 on sort
    }

    // 2. Pagination Handlers (Delegation)
    if (paginationContainer) {
        paginationContainer.addEventListener('click', function(e) {
            // Look for closest link
            const link = e.target.closest('a');
            if (!link) return;
            
            e.preventDefault();
            
            // Get page number from data attribute
            const page = link.getAttribute('data-page');
            if (page) {
                loadPosts(parseInt(page));
            }
        });
    }

    // 3. AJAX Logic
    function loadPosts(page) {
        postsGrid.style.opacity = '0.5';
        
        const formData = new FormData();
        formData.append('action', 'filter_posts');
        formData.append('paged', page);
        formData.append('order', currentOrder);
        formData.append('bg_color', bgColor);
        formData.append('category_id', categoryId);
        
        fetch(frontendajax.ajaxurl, {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Update Grid
                postsGrid.innerHTML = data.data.html;
                // Update Pagination
                paginationContainer.innerHTML = data.data.pagination_html;
                
                // Scroll smooth
                section.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        })
        .catch(error => console.error('Error:', error))
        .finally(() => {
            postsGrid.style.opacity = '1';
        });
    }
});
