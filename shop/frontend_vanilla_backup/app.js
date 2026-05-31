// =========================================================================
// STOREFRONT B2B BOOTSTRAPPING ENGINE - MERTER VİTRİNİ
// =========================================================================

// Init Function on Load
document.addEventListener("DOMContentLoaded", async () => {
    // 1. Initial Static Translations
    if (window.translateStaticUI) {
        window.translateStaticUI();
    }
    
    // 2. Setup Language Menu Dropdown Listeners
    const langBtn = document.getElementById('langBtn');
    const langDropdown = document.getElementById('langDropdown');
    
    if (langBtn && langDropdown) {
        langBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            langDropdown.classList.toggle('show');
        });
        
        document.addEventListener('click', () => {
            langDropdown.classList.remove('show');
        });
    }
    
    document.querySelectorAll('.lang-option').forEach(option => {
        option.addEventListener('click', async (e) => {
            const lang = e.currentTarget.getAttribute('data-lang');
            document.querySelectorAll('.lang-option').forEach(o => o.classList.remove('active'));
            e.currentTarget.classList.add('active');
            
            // Set active flag & text in DOM
            const flag = e.currentTarget.querySelector('span').innerText;
            const text = e.currentTarget.innerText.replace(flag, '').trim();
            
            const flagEl = document.getElementById('activeLangFlag');
            const textEl = document.getElementById('activeLangText');
            if (flagEl) flagEl.innerText = flag;
            if (textEl) textEl.innerText = text;
            
            window.currentLang = lang;
            
            if (window.translateStaticUI) window.translateStaticUI();
            
            // Dynamic translations refresh
            if (window.renderProducts) window.renderProducts(window.cachedProducts);
            if (window.renderCategoryNav) window.renderCategoryNav(window.cachedCategories);
            
            if (window.activeProductDetail && window.renderProductModalDetail) {
                window.renderProductModalDetail(window.activeProductDetail);
            }
            if (window.updateCartDrawerList) window.updateCartDrawerList();
        });
    });

    // 3. Load Categories & Brands
    if (window.loadCategories) await window.loadCategories();
    if (window.loadBrands) await window.loadBrands();
    
    // 4. Load Initial Product Cards Catalog
    if (window.loadProducts) await window.loadProducts();

    // 5. Setup Live Filters and Search Handler Listeners
    if (window.setupFilters) window.setupFilters();
    
    // 6. Setup Cart Persistent Drawer Actions
    if (window.setupCartActions) window.setupCartActions();
});
