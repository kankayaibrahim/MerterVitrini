// =========================================================================
// STOREFRONT B2B CART ENGINE - MERTER VİTRİNİ
// =========================================================================

// Cart Helpers
window.getLocalCart = function() {
    const raw = localStorage.getItem('merter_b2b_cart');
    return raw ? JSON.parse(raw) : [];
};

window.saveLocalCart = function(cart) {
    localStorage.setItem('merter_b2b_cart', JSON.stringify(cart));
};

window.updateCartCounter = function() {
    const cart = window.getLocalCart();
    const totalPkgs = cart.reduce((sum, item) => sum + item.packages_qty, 0);
    const counterEl = document.getElementById('cartCount');
    if (counterEl) counterEl.innerText = totalPkgs;
};

// Add item to cart inside LocalStorage
window.addProductToB2BCart = function() {
    if (!window.activeProductDetail) return;
    
    const pkgs = parseInt(document.getElementById('modalPkgQtyInput').value) || 1;
    const unitsPerPkg = window.getUnitsFromSeriesRatio(window.activeProductDetail.series_ratio);
    const weightPerUnit = window.activeProductDetail.shipping_weight_kg || 0.35;
    
    let unitPrice = 0.0;
    let sku = window.activeProductDetail.custom_sku || window.activeProductDetail.source_product_id;
    
    if (window.activeProductDetail.variants && window.activeProductDetail.variants.length > 0) {
        const v = window.activeProductDetail.variants[0];
        const hasDiscount = v.discounted_price < v.price && v.discounted_price > 0;
        unitPrice = hasDiscount ? v.discounted_price : v.price;
        sku = v.custom_sku || v.sku || window.activeProductDetail.custom_sku;
    }
    
    let coverImg = 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&q=80&w=600';
    if (window.activeProductDetail.images && window.activeProductDetail.images.length > 0) {
        const coverObj = window.activeProductDetail.images.find(img => img.is_cover) || window.activeProductDetail.images[0];
        coverImg = coverObj.image_url;
    }
    
    const cart = window.getLocalCart();
    
    const duplicateIdx = cart.findIndex(item => item.product_id === window.activeProductDetail.id && item.color === window.selectedColor);
    
    if (duplicateIdx > -1) {
        cart[duplicateIdx].packages_qty += pkgs;
    } else {
        cart.push({
            product_id: window.activeProductDetail.id,
            title: window.getProductTitle(window.activeProductDetail),
            custom_sku: sku,
            color: window.selectedColor,
            packages_qty: pkgs,
            units_per_package: unitsPerPkg,
            price_per_unit: unitPrice,
            weight_per_unit: weightPerUnit,
            image_url: coverImg
        });
    }
    
    window.saveLocalCart(cart);
    window.updateCartCounter();
    
    // Close Modal and Open Drawer
    const productModal = document.getElementById('productModal');
    if (productModal) productModal.classList.remove('open');
    window.activeProductDetail = null;
    
    window.updateCartDrawerList();
    const cartDrawer = document.getElementById('cartDrawer');
    if (cartDrawer) cartDrawer.classList.add('open');
};

// Render cart list drawer securely using native DOM APIs to protect against XSS
window.updateCartDrawerList = function() {
    const cart = window.getLocalCart();
    const list = document.getElementById('cartItemsList');
    const summaryBlock = document.getElementById('cartSummaryBlock');
    const emptyBlock = document.getElementById('cartEmptyState');
    
    if (!list || !summaryBlock || !emptyBlock) return;
    
    list.innerHTML = '';
    
    if (cart.length === 0) {
        summaryBlock.style.display = 'none';
        emptyBlock.style.display = 'block';
        return;
    }
    
    summaryBlock.style.display = 'flex';
    emptyBlock.style.display = 'none';
    
    let totalPkgs = 0;
    let totalItems = 0;
    let totalWeight = 0.0;
    let totalPrice = 0.0;
    
    cart.forEach((item, idx) => {
        const itemTotalUnits = item.packages_qty * item.units_per_package;
        const itemTotalPrice = itemTotalUnits * item.price_per_unit;
        const itemTotalWeight = itemTotalUnits * item.weight_per_unit;
        
        totalPkgs += item.packages_qty;
        totalItems += itemTotalUnits;
        totalWeight += itemTotalWeight;
        totalPrice += itemTotalPrice;
        
        const card = document.createElement('div');
        card.className = 'cart-item';
        
        const img = document.createElement('img');
        img.className = 'cart-item-img';
        img.src = item.image_url;
        img.alt = item.title;
        
        const info = document.createElement('div');
        info.className = 'cart-item-info';
        
        const h4 = document.createElement('h4');
        h4.className = 'cart-item-title';
        h4.textContent = item.title;
        
        const specs = document.createElement('div');
        specs.style.fontSize = '0.75rem';
        specs.style.fontWeight = '700';
        specs.style.color = 'var(--accent-gold)';
        specs.style.marginTop = '2px';
        specs.textContent = window.t('color') + ': ' + item.color + ' | SKU: ' + item.custom_sku;
        
        const qtyRow = document.createElement('div');
        qtyRow.className = 'cart-item-qty';
        
        const decBtn = document.createElement('button');
        decBtn.className = 'qty-btn';
        decBtn.textContent = '−';
        decBtn.addEventListener('click', () => window.adjustCartItemQty(idx, -1));
        
        const qtyVal = document.createElement('span');
        qtyVal.className = 'qty-val';
        qtyVal.textContent = item.packages_qty + ' ' + window.t('package');
        
        const incBtn = document.createElement('button');
        incBtn.className = 'qty-btn';
        incBtn.textContent = '+';
        incBtn.addEventListener('click', () => window.adjustCartItemQty(idx, 1));
        
        qtyRow.appendChild(decBtn);
        qtyRow.appendChild(qtyVal);
        qtyRow.appendChild(incBtn);
        
        const subtext = document.createElement('div');
        subtext.style.fontSize = '0.7rem';
        subtext.style.color = 'var(--text-muted)';
        subtext.style.fontWeight = '600';
        subtext.style.marginTop = '2px';
        subtext.textContent = itemTotalUnits + ' ' + window.t('piece') + ' (' + item.units_per_package + ' ' + window.t('piece') + '/' + window.t('package') + ') x ' + item.price_per_unit.toFixed(2) + ' TL';
        
        info.appendChild(h4);
        info.appendChild(specs);
        info.appendChild(qtyRow);
        info.appendChild(subtext);
        
        const priceDiv = document.createElement('div');
        priceDiv.className = 'cart-item-price';
        priceDiv.style.alignSelf = 'center';
        priceDiv.style.fontSize = '1rem';
        priceDiv.textContent = itemTotalPrice.toFixed(2) + ' TL';
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'cart-item-remove';
        removeBtn.innerHTML = '&times;';
        removeBtn.addEventListener('click', () => window.removeCartItem(idx));
        
        card.appendChild(img);
        card.appendChild(info);
        card.appendChild(priceDiv);
        card.appendChild(removeBtn);
        
        list.appendChild(card);
    });
    
    document.getElementById('summaryTotalPkgs').innerText = totalPkgs + ' ' + window.t('package');
    document.getElementById('summaryTotalItems').innerText = totalItems + ' ' + window.t('piece');
    document.getElementById('summaryTotalWeight').innerText = totalWeight.toFixed(2) + ' kg';
    document.getElementById('summaryTotalPrice').innerText = totalPrice.toFixed(2) + ' TL';
};

window.adjustCartItemQty = function(index, change) {
    const cart = window.getLocalCart();
    const idx = parseInt(index);
    if (isNaN(idx) || idx < 0 || idx >= cart.length) return;
    
    cart[idx].packages_qty += change;
    
    if (cart[idx].packages_qty <= 0) {
        cart.splice(idx, 1);
    }
    
    window.saveLocalCart(cart);
    window.updateCartCounter();
    window.updateCartDrawerList();
};

window.removeCartItem = function(index) {
    const cart = window.getLocalCart();
    const idx = parseInt(index);
    if (isNaN(idx) || idx < 0 || idx >= cart.length) return;
    
    cart.splice(idx, 1);
    
    window.saveLocalCart(cart);
    window.updateCartCounter();
    window.updateCartDrawerList();
};

// B2B Cart persistent state and drawers triggers
window.setupCartActions = function() {
    const drawer = document.getElementById('cartDrawer');
    const toggleBtn = document.getElementById('cartToggleBtn');
    const closeBtn = document.getElementById('cartDrawerClose');
    const form = document.getElementById('inquiryForm');
    const successOverlay = document.getElementById('successOverlay');
    const successCloseBtn = document.getElementById('successCloseBtn');
    
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            window.updateCartDrawerList();
            if (drawer) drawer.classList.add('open');
        });
    }
    
    if (closeBtn && drawer) {
        closeBtn.addEventListener('click', () => {
            drawer.classList.remove('open');
        });
    }
    
    const modalClose = document.getElementById('productModalClose');
    const productModal = document.getElementById('productModal');
    if (modalClose && productModal) {
        modalClose.addEventListener('click', () => {
            productModal.classList.remove('open');
            window.activeProductDetail = null;
        });
    }
    
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const fullName = document.getElementById('fullName').value.trim();
            const company = document.getElementById('companyName').value.trim();
            const phone = document.getElementById('phoneNumber').value.trim();
            const email = document.getElementById('emailAddress').value.trim();
            const message = document.getElementById('customerMessage').value.trim();
            
            const cart = window.getLocalCart();
            if (cart.length === 0) return;
            
            const inquiryItems = cart.map(item => {
                const totalItems = item.packages_qty * item.units_per_package;
                return {
                    product_id: item.product_id,
                    title: item.title + ' (' + item.color + ') - ' + item.packages_qty + ' ' + window.t('package') + ' (' + totalItems + ' ' + window.t('piece') + ')',
                    custom_sku: item.custom_sku || item.product_id,
                    quantity: totalItems,
                    price: item.price_per_unit
                };
            });
            
            const payload = {
                full_name: fullName,
                company: company || null,
                phone: phone,
                email: email,
                message: message || null,
                items: inquiryItems
            };
            
            try {
                const submitBtn = form.querySelector('button[type="submit"]');
                const origBtnText = submitBtn.innerText;
                submitBtn.innerText = window.t('loading');
                submitBtn.disabled = true;
                
                const response = await fetch('/api/v1/store/inquiries', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                submitBtn.innerText = origBtnText;
                submitBtn.disabled = false;
                
                if (!response.ok) {
                    const errData = await response.json();
                    alert('Error: ' + (errData.error || 'Failed to submit inquiry'));
                    return;
                }
                
                const result = await response.json();
                
                localStorage.removeItem('merter_b2b_cart');
                window.updateCartCounter();
                
                if (drawer) drawer.classList.remove('open');
                
                document.getElementById('successWhatsappBtn').href = result.whatsapp_url;
                if (successOverlay) successOverlay.classList.add('open');
                
            } catch (err) {
                console.error("Failed to submit B2B inquiry:", err);
                alert("Connection error! Failed to register your quote request.");
            }
        });
    }
    
    if (successCloseBtn && successOverlay) {
        successCloseBtn.addEventListener('click', () => {
            successOverlay.classList.remove('open');
        });
    }
    
    window.updateCartCounter();
};
