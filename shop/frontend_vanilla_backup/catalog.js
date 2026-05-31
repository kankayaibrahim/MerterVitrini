// =========================================================================
// STOREFRONT B2B CATALOG ENGINE - MERTER VİTRİNİ
// =========================================================================

// Categories Loader
window.loadCategories = async function() {
    const categories = await window.apiFetch('/categories');
    if (categories) {
        window.cachedCategories = categories;
        window.renderCategoryNav(categories);
    }
};

window.renderCategoryNav = function(categories) {
    const container = document.getElementById('categoryNavContainer');
    if (!container) return;
    
    // Clear and build dynamic category navigation bar safely using native DOM elements
    container.innerHTML = '';
    
    const allLink = document.createElement('a');
    allLink.className = 'category-nav-link' + (window.activeCategoryId === '' ? ' active' : '');
    allLink.setAttribute('data-category-id', '');
    allLink.textContent = window.t('all_products');
    container.appendChild(allLink);
    
    categories.forEach(cat => {
        const link = document.createElement('a');
        link.className = 'category-nav-link' + (window.activeCategoryId === cat.id ? ' active' : '');
        link.setAttribute('data-category-id', cat.id);
        link.textContent = cat.title;
        container.appendChild(link);
    });

    // Wire clicks
    document.querySelectorAll('.category-nav-link').forEach(link => {
        link.addEventListener('click', async (e) => {
            document.querySelectorAll('.category-nav-link').forEach(l => l.classList.remove('active'));
            e.currentTarget.classList.add('active');
            
            window.activeCategoryId = e.currentTarget.getAttribute('data-category-id');
            window.updateCatalogTitle();
            window.currentPage = 1;
            await window.loadProducts();
        });
    });
};

// Brands Loader
window.loadBrands = async function() {
    const brands = await window.apiFetch('/brands');
    if (brands) {
        window.cachedBrands = brands;
        window.renderBrandsFilter(brands);
    }
};

window.renderBrandsFilter = function(brands) {
    const list = document.getElementById('brandFilterList');
    if (!list) return;
    list.innerHTML = '';
    
    brands.forEach(brand => {
        const label = document.createElement('label');
        label.className = 'filter-item';
        
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.className = 'filter-checkbox brand-filter';
        chk.value = brand.id;
        
        const span = document.createElement('span');
        span.textContent = ' ' + brand.name;
        
        label.appendChild(chk);
        label.appendChild(span);
        list.appendChild(label);
    });

    // Wire checkbox clicks
    document.querySelectorAll('.brand-filter').forEach(chk => {
        chk.addEventListener('change', async () => {
            window.activeBrandIds = Array.from(document.querySelectorAll('.brand-filter:checked')).map(c => c.value);
            window.currentPage = 1;
            await window.loadProducts();
        });
    });
};

// Products Loader
window.loadProducts = async function() {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;
    
    // Render Loading State securely
    grid.innerHTML = '';
    const loader = document.createElement('div');
    loader.className = 'loading-block';
    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    const p = document.createElement('p');
    p.textContent = window.t('loading');
    loader.appendChild(spinner);
    loader.appendChild(p);
    grid.appendChild(loader);
    
    const offset = (window.currentPage - 1) * window.itemsPerPage;
    let queryParams = '?limit=' + window.itemsPerPage + '&offset=' + offset + '&sort_by=' + window.sortBy;
    
    if (window.activeCategoryId) {
        queryParams += '&category_id=' + window.activeCategoryId;
    }
    
    if (window.activeBrandIds.length > 0) {
        queryParams += '&brand_id=' + window.activeBrandIds[0];
    }
    
    if (window.searchQuery) {
        queryParams += '&q=' + encodeURIComponent(window.searchQuery);
    }
    
    const products = await window.apiFetch('/products' + queryParams);
    if (products) {
        // Local Filter for multi-brands and specific specs if active
        let filtered = products;
        
        if (window.activeBrandIds.length > 1) {
            filtered = filtered.filter(p => window.activeBrandIds.includes(p.brand_id));
        }
        
        if (window.activeSpecs.gender.length > 0) {
            filtered = filtered.filter(p => p.gender && window.activeSpecs.gender.includes(p.gender));
        }
        
        if (window.activeSpecs.season.length > 0) {
            filtered = filtered.filter(p => p.season && window.activeSpecs.season.includes(p.season));
        }
        
        window.cachedProducts = products;
        window.renderProducts(filtered);
        window.renderPagination(products.length);
    } else {
        grid.innerHTML = '';
        const empty = document.createElement('div');
        empty.className = 'empty-block';
        const pEmpty = document.createElement('p');
        pEmpty.textContent = window.t('no_products');
        empty.appendChild(pEmpty);
        grid.appendChild(empty);
        
        const paginationContainer = document.getElementById('paginationContainer');
        if (paginationContainer) paginationContainer.innerHTML = '';
    }
};

// Render Product Grid Card Items securely using clean DOM APIs
window.renderProducts = function(products) {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;
    grid.innerHTML = '';
    
    if (products.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-block';
        const pIcon = document.createElement('p');
        pIcon.style.fontSize = '1.5rem';
        pIcon.style.marginBottom = '0.5rem';
        pIcon.textContent = '🔍';
        const pText = document.createElement('p');
        pText.textContent = window.t('no_products');
        
        empty.appendChild(pIcon);
        empty.appendChild(pText);
        grid.appendChild(empty);
        return;
    }
    
    products.forEach(p => {
        const title = window.getProductTitle(p);
        
        let coverImg = 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&q=80&w=600';
        if (p.images && p.images.length > 0) {
            const coverObj = p.images.find(img => img.is_cover) || p.images[0];
            coverImg = coverObj.image_url;
        }
        
        const units = window.getUnitsFromSeriesRatio(p.series_ratio);
        
        let priceRange = "0.00 TL";
        let hasDiscount = false;
        let origPrice = 0.0;
        let discPrice = 0.0;
        
        if (p.variants && p.variants.length > 0) {
            const v = p.variants[0];
            origPrice = v.price;
            discPrice = v.discounted_price;
            hasDiscount = v.discounted_price < v.price && v.discounted_price > 0;
            
            if (hasDiscount) {
                priceRange = discPrice.toFixed(2) + ' TL';
            } else {
                priceRange = origPrice.toFixed(2) + ' TL';
            }
        }
        
        const card = document.createElement('div');
        card.className = 'product-card glass-effect';
        card.setAttribute('data-id', p.id);
        
        const imgWrapper = document.createElement('div');
        imgWrapper.className = 'card-img-wrapper';
        
        const img = document.createElement('img');
        img.src = coverImg;
        img.alt = title;
        img.className = 'card-img';
        img.loading = 'lazy';
        
        const badge = document.createElement('span');
        badge.className = 'card-badge';
        badge.textContent = p.gender || "Unisex";
        
        imgWrapper.appendChild(img);
        imgWrapper.appendChild(badge);
        
        const details = document.createElement('div');
        details.className = 'card-details';
        
        const brandDiv = document.createElement('div');
        brandDiv.className = 'card-brand';
        brandDiv.textContent = p.brand_name || "Merter Manufacturer";
        
        const titleH3 = document.createElement('h3');
        titleH3.className = 'card-title';
        titleH3.textContent = title;
        
        const specs = document.createElement('div');
        specs.className = 'card-b2b-specs';
        
        const spec1 = document.createElement('span');
        spec1.className = 'spec-pill';
        spec1.textContent = units + ' ' + window.t('piece') + ' / ' + window.t('package');
        
        const spec2 = document.createElement('span');
        spec2.className = 'spec-pill';
        spec2.textContent = window.t('min_order_qty') + ': ' + p.minimum_order_quantity + ' ' + window.t('piece');
        
        specs.appendChild(spec1);
        specs.appendChild(spec2);
        
        const priceRow = document.createElement('div');
        priceRow.className = 'card-price-row';
        
        if (hasDiscount) {
            const priceOrig = document.createElement('div');
            priceOrig.className = 'card-price discounted';
            priceOrig.textContent = origPrice.toFixed(2) + ' TL';
            
            const priceDisc = document.createElement('div');
            priceDisc.className = 'card-discounted-price';
            priceDisc.textContent = discPrice.toFixed(2) + ' TL';
            
            priceRow.appendChild(priceOrig);
            priceRow.appendChild(priceDisc);
        } else {
            const priceDiv = document.createElement('div');
            priceDiv.className = 'card-price';
            priceDiv.textContent = priceRange;
            priceRow.appendChild(priceDiv);
        }
        
        details.appendChild(brandDiv);
        details.appendChild(titleH3);
        details.appendChild(specs);
        details.appendChild(priceRow);
        
        card.appendChild(imgWrapper);
        card.appendChild(details);
        
        card.addEventListener('click', () => window.openProductModal(p.id));
        grid.appendChild(card);
    });
};

// Pagination Builder
window.renderPagination = function(loadedCount) {
    const container = document.getElementById('paginationContainer');
    if (!container) return;
    container.innerHTML = '';
    
    const prevBtn = document.createElement('button');
    prevBtn.className = 'page-btn';
    prevBtn.innerHTML = '❮';
    prevBtn.disabled = window.currentPage === 1;
    prevBtn.addEventListener('click', async () => {
        if (window.currentPage > 1) {
            window.currentPage--;
            await window.loadProducts();
            window.scrollTo({ top: 350, behavior: 'smooth' });
        }
    });
    container.appendChild(prevBtn);
    
    const pageLabel = document.createElement('span');
    pageLabel.style.fontSize = '0.9rem';
    pageLabel.style.fontWeight = '700';
    pageLabel.style.color = 'var(--text-secondary)';
    pageLabel.style.margin = '0 0.5rem';
    pageLabel.textContent = window.t('page') + ' ' + window.currentPage;
    container.appendChild(pageLabel);
    
    const nextBtn = document.createElement('button');
    nextBtn.className = 'page-btn';
    nextBtn.innerHTML = '❯';
    nextBtn.disabled = loadedCount < window.itemsPerPage;
    nextBtn.addEventListener('click', async () => {
        window.currentPage++;
        await window.loadProducts();
        window.scrollTo({ top: 350, behavior: 'smooth' });
    });
    container.appendChild(nextBtn);
};

// Setup Filters Listeners
window.setupFilters = function() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;
    
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
            window.searchQuery = e.target.value.trim();
            window.currentPage = 1;
            await window.loadProducts();
        }, 500);
    });
    
    const sortBySelect = document.getElementById('sortBySelect');
    sortBySelect.addEventListener('change', async (e) => {
        window.sortBy = e.target.value;
        window.currentPage = 1;
        await window.loadProducts();
    });
    
    document.querySelectorAll('.spec-filter').forEach(chk => {
        chk.addEventListener('change', async () => {
            const specType = chk.getAttribute('data-spec-type');
            const value = chk.value;
            
            if (chk.checked) {
                window.activeSpecs[specType].push(value);
            } else {
                window.activeSpecs[specType] = window.activeSpecs[specType].filter(v => v !== value);
            }
            window.currentPage = 1;
            await window.loadProducts();
        });
    });
};

// Open Product Modal Details
window.openProductModal = async function(productId) {
    const modal = document.getElementById('productModal');
    const modalBody = document.getElementById('productModalBody');
    if (!modal || !modalBody) return;
    
    modalBody.innerHTML = '';
    const loader = document.createElement('div');
    loader.className = 'loading-block';
    loader.style.padding = '5rem 0';
    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    const p = document.createElement('p');
    p.textContent = window.t('loading');
    loader.appendChild(spinner);
    loader.appendChild(p);
    modalBody.appendChild(loader);
    modal.classList.add('open');
    
    const product = await window.apiFetch('/products/' + productId);
    if (product) {
        window.activeProductDetail = product;
        window.renderProductModalDetail(product);
    } else {
        modalBody.innerHTML = '';
        const pErr = document.createElement('p');
        pErr.style.textAlign = 'center';
        pErr.style.padding = '3rem 0';
        pErr.textContent = 'Failed to fetch product details.';
        modalBody.appendChild(pErr);
    }
};

// Render Product detail using a completely static HTML skeleton and safe textContent assignments
window.renderProductModalDetail = function(product) {
    const modalBody = document.getElementById('productModalBody');
    if (!modalBody) return;
    
    const title = window.getProductTitle(product);
    const desc = window.getProductDescription(product);
    
    let activeCoverUrl = 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&q=80&w=600';
    if (product.images && product.images.length > 0) {
        const cover = product.images.find(img => img.is_cover) || product.images[0];
        activeCoverUrl = cover.image_url;
    }
    
    let unitPrice = 0.0;
    let discPrice = 0.0;
    let hasDiscount = false;
    let originalCurrency = "TL";
    
    if (product.variants && product.variants.length > 0) {
        const v = product.variants[0];
        unitPrice = v.price;
        discPrice = v.discounted_price;
        originalCurrency = v.currency || "TL";
        hasDiscount = v.discounted_price < v.price && v.discounted_price > 0;
    }
    
    let colors = [];
    if (product.variants) {
        colors = [...new Set(product.variants.map(v => v.color).filter(c => c))];
    }
    if (colors.length === 0) colors = ['Standart'];
    
    window.selectedColor = colors[0];
    
    const sizes = (product.packing_ratio || "Standart").split(',');
    const ratios = (product.series_ratio || "1").split('-');
    const unitsPerPkg = window.getUnitsFromSeriesRatio(product.series_ratio);
    const weightPerUnit = product.shipping_weight_kg || 0.35;
    const totalPkgWeight = unitsPerPkg * weightPerUnit;
    const finalPricePerUnit = hasDiscount ? discPrice : unitPrice;
    const finalPkgPrice = unitsPerPkg * finalPricePerUnit;
    
    // Inject secure, static skeleton. Not a single variable is interpolated, eliminating XSS and linter warnings!
    modalBody.innerHTML = '<div class="modal-grid">' +
        '<!-- Left Column Gallery -->' +
        '<div class="modal-gallery">' +
        '<div class="modal-main-img-wrapper">' +
        '<img id="modalMainImg" src="" alt="" class="modal-main-img">' +
        '</div>' +
        '<div class="modal-thumbs" id="modalThumbs"></div>' +
        '</div>' +
        '<!-- Right Column Info -->' +
        '<div class="modal-info">' +
        '<div class="modal-brand" id="modalBrand"></div>' +
        '<h2 class="modal-title" id="modalTitle"></h2>' +
        '<div class="modal-sku" id="modalSku"></div>' +
        '<div class="modal-price-row" id="modalPriceRow"></div>' +
        '<!-- Spec list box -->' +
        '<div class="modal-b2b-specs">' +
        '<div class="b2b-spec-box">' +
        '<span class="b2b-spec-label" id="modalLabelFabric"></span>' +
        '<span class="b2b-spec-val" id="modalFabric"></span>' +
        '</div>' +
        '<div class="b2b-spec-box">' +
        '<span class="b2b-spec-label" id="modalLabelSpecs"></span>' +
        '<span class="b2b-spec-val" id="modalSpecs"></span>' +
        '</div>' +
        '<div class="b2b-spec-box">' +
        '<span class="b2b-spec-label" id="modalLabelDesi"></span>' +
        '<span class="b2b-spec-val" id="modalDesi"></span>' +
        '</div>' +
        '<div class="b2b-spec-box">' +
        '<span class="b2b-spec-label" id="modalLabelMinOrder"></span>' +
        '<span class="b2b-spec-val" id="minOrderQtyVal"></span>' +
        '</div>' +
        '</div>' +
        '<!-- Color Options -->' +
        '<div class="variant-selection">' +
        '<span class="variant-label" id="modalLabelColor"></span>' +
        '<div class="color-options" id="modalColorOptions"></div>' +
        '</div>' +
        '<!-- Assortment series layout -->' +
        '<div class="variant-selection">' +
        '<span class="variant-label" id="modalLabelPkgContent"></span>' +
        '<div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 0.5rem;" id="modalSeriesBreakdown"></div>' +
        '</div>' +
        '<!-- Package Live B2B Calculator -->' +
        '<div class="package-calc-box">' +
        '<div class="calc-title" id="modalLabelPkgQty"></div>' +
        '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">' +
        '<div class="pkg-qty-selector">' +
        '<button class="pkg-qty-btn" onclick="window.adjustModalPkgQty(-1)">−</button>' +
        '<input type="text" class="pkg-qty-input" id="modalPkgQtyInput" value="1" readonly>' +
        '<button class="pkg-qty-btn" onclick="window.adjustModalPkgQty(1)">+</button>' +
        '</div>' +
        '<span style="font-size:0.75rem; color:var(--text-secondary); font-weight:700;" id="modalPkgRatioDesc"></span>' +
        '</div>' +
        '<div class="calc-row">' +
        '<span id="modalLabelCalcTotalUnits"></span>' +
        '<span id="calcTotalUnits"></span>' +
        '</div>' +
        '<div class="calc-row">' +
        '<span id="modalLabelCalcTotalWeight"></span>' +
        '<span id="calcTotalWeight"></span>' +
        '</div>' +
        '<div class="calc-row highlight">' +
        '<span id="modalLabelCalcTotalPrice"></span>' +
        '<span id="calcTotalPrice"></span>' +
        '</div>' +
        '</div>' +
        '<!-- Add To Cart Row -->' +
        '<div class="modal-action-row">' +
        '<button class="action-btn primary" id="modalBtnAddToCart" onclick="window.addProductToB2BCart()" style="flex:1; justify-content:center; height:48px; border-radius:30px;"></button>' +
        '</div>' +
        '</div>' +
        '</div>' +
        '<!-- Short description overlay -->' +
        '<div style="border-top:1px solid var(--border-light); margin-top:2rem; padding-top:1.5rem;">' +
        '<h4 style="font-family:\'Playfair Display\', serif; font-size:1.15rem; margin-bottom:0.75rem;">Açıklama / Description</h4>' +
        '<p style="font-size:0.85rem; color:var(--text-secondary); line-height:1.7; font-weight:300;" id="modalDesc"></p>' +
        '</div>';
    
    // Securely bind dynamic text variables using DOM elements
    document.getElementById('modalMainImg').src = activeCoverUrl;
    document.getElementById('modalMainImg').alt = title;
    document.getElementById('modalBrand').textContent = product.brand_name || "Merter Manufacturer";
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalSku').textContent = 'SKU: ' + (product.custom_sku || product.source_product_id);
    document.getElementById('modalDesc').textContent = desc;
    
    // Populate Price Row securely
    const priceRow = document.getElementById('modalPriceRow');
    priceRow.innerHTML = '';
    if (hasDiscount) {
        const lbl = document.createElement('div');
        lbl.className = 'modal-price-label';
        lbl.textContent = window.t('pkg_price') + ':';
        
        const orig = document.createElement('div');
        orig.className = 'modal-price discounted';
        orig.textContent = (unitPrice * unitsPerPkg).toFixed(2) + ' ' + originalCurrency;
        
        const disc = document.createElement('div');
        disc.className = 'modal-discounted-price';
        disc.textContent = (discPrice * unitsPerPkg).toFixed(2) + ' ' + originalCurrency;
        
        priceRow.appendChild(lbl);
        priceRow.appendChild(orig);
        priceRow.appendChild(disc);
    } else {
        const lbl = document.createElement('div');
        lbl.className = 'modal-price-label';
        lbl.textContent = window.t('pkg_price') + ':';
        
        const price = document.createElement('div');
        price.className = 'modal-price';
        price.textContent = (unitPrice * unitsPerPkg).toFixed(2) + ' ' + originalCurrency;
        
        priceRow.appendChild(lbl);
        priceRow.appendChild(price);
    }
    
    // Labels translation binding
    document.getElementById('modalLabelFabric').textContent = window.t('fabric');
    document.getElementById('modalFabric').textContent = product.kumas_fabric || "Viskon / Pamuk";
    document.getElementById('modalLabelSpecs').textContent = window.t('gender_spec') + ' / ' + window.t('season_spec');
    document.getElementById('modalSpecs').textContent = (product.gender || "Unisex") + " / " + (product.season || "Mevsimlik");
    document.getElementById('modalLabelDesi').textContent = window.t('desi');
    document.getElementById('modalDesi').textContent = (product.desi_volume || 2) + " Desi";
    document.getElementById('modalLabelMinOrder').textContent = window.t('min_order_qty');
    document.getElementById('minOrderQtyVal').textContent = product.minimum_order_quantity + ' ' + window.t('piece') + ' (' + Math.ceil(product.minimum_order_quantity / unitsPerPkg) + ' ' + window.t('package') + ')';
    document.getElementById('modalLabelColor').textContent = window.t('color');
    document.getElementById('modalLabelPkgContent').textContent = window.t('pkg_content');
    document.getElementById('modalLabelPkgQty').textContent = window.t('pkg_qty_label');
    document.getElementById('modalPkgRatioDesc').textContent = '1 ' + window.t('package') + ' = ' + unitsPerPkg + ' ' + window.t('piece');
    document.getElementById('modalLabelCalcTotalUnits').textContent = window.t('total_pieces_calc') + ':';
    document.getElementById('modalLabelCalcTotalWeight').textContent = window.t('total_weight_calc') + ':';
    document.getElementById('modalLabelCalcTotalPrice').textContent = window.t('total_price_calc') + ' (' + window.t('excluding_vat') + '):';
    document.getElementById('modalBtnAddToCart').textContent = '🛒 ' + window.t('add_to_cart');
    
    // Populate Image Thumbs Slider securely
    const thumbsContainer = document.getElementById('modalThumbs');
    thumbsContainer.innerHTML = '';
    if (product.images) {
        product.images.forEach((img, idx) => {
            const tImg = document.createElement('img');
            tImg.className = 'modal-thumb' + (img.image_url === activeCoverUrl ? ' active' : '');
            tImg.src = img.image_url;
            tImg.alt = 'thumb-' + idx;
            tImg.addEventListener('click', () => window.changeModalActiveImage(img.image_url));
            thumbsContainer.appendChild(tImg);
        });
    }
    
    // Populate Color Buttons securely
    const colorsContainer = document.getElementById('modalColorOptions');
    colorsContainer.innerHTML = '';
    colors.forEach(col => {
        const btn = document.createElement('button');
        btn.className = 'color-option' + (col === window.selectedColor ? ' active' : '');
        btn.textContent = col;
        btn.addEventListener('click', () => window.selectModalColor(col));
        colorsContainer.appendChild(btn);
    });
    
    // Populate Assorted Series Breakdown elements securely
    const seriesContainer = document.getElementById('modalSeriesBreakdown');
    seriesContainer.innerHTML = '';
    sizes.forEach((sz, idx) => {
        const safeIdx = Number(idx);
        const count = (safeIdx >= 0 && safeIdx < ratios.length) ? ratios[safeIdx] : "1";
        
        const item = document.createElement('div');
        item.style.background = 'rgba(255,255,255,0.02)';
        item.style.padding = '0.4rem 0.75rem';
        item.style.borderRadius = '10px';
        item.style.border = '1px solid var(--border-light)';
        item.style.fontSize = '0.75rem';
        item.style.fontWeight = '700';
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        
        const s1 = document.createElement('span');
        s1.textContent = sz;
        const s2 = document.createElement('span');
        s2.style.color = 'var(--accent-emerald)';
        s2.textContent = count + ' ' + window.t('piece');
        
        item.appendChild(s1);
        item.appendChild(s2);
        seriesContainer.appendChild(item);
    });
    
    const minPkgs = Math.ceil(product.minimum_order_quantity / unitsPerPkg);
    document.getElementById('modalPkgQtyInput').value = minPkgs;
    window.recalculateModalPrices();
};

// Image swapper in details modal
window.changeModalActiveImage = function(imageUrl) {
    const imgEl = document.getElementById('modalMainImg');
    if (imgEl) imgEl.src = imageUrl;
    
    document.querySelectorAll('.modal-thumb').forEach(thumb => {
        if (thumb.src === imageUrl) {
            thumb.classList.add('active');
        } else {
            thumb.classList.remove('active');
        }
    });
};

// Color selection in details modal
window.selectModalColor = function(color) {
    window.selectedColor = color;
    document.querySelectorAll('.color-option').forEach(opt => {
        if (opt.innerText.trim() === color) {
            opt.classList.add('active');
        } else {
            opt.classList.remove('active');
        }
    });
};

// Counter controllers inside details modal B2B calculator
window.adjustModalPkgQty = function(change) {
    const input = document.getElementById('modalPkgQtyInput');
    if (!input) return;
    
    let val = parseInt(input.value) || 1;
    val += change;
    
    const unitsPerPkg = window.getUnitsFromSeriesRatio(window.activeProductDetail.series_ratio);
    const minPkgs = Math.ceil(window.activeProductDetail.minimum_order_quantity / unitsPerPkg);
    
    if (val < minPkgs) {
        val = minPkgs;
        alert(window.t('minimum_order_alert') + ' (' + minPkgs + ' ' + window.t('package') + ')');
    }
    
    input.value = val;
    window.recalculateModalPrices();
};

window.recalculateModalPrices = function() {
    if (!window.activeProductDetail) return;
    
    const pkgs = parseInt(document.getElementById('modalPkgQtyInput').value) || 1;
    const unitsPerPkg = window.getUnitsFromSeriesRatio(window.activeProductDetail.series_ratio);
    const weightPerUnit = window.activeProductDetail.shipping_weight_kg || 0.35;
    
    let unitPrice = 0.0;
    let discPrice = 0.0;
    let currency = "TL";
    
    if (window.activeProductDetail.variants && window.activeProductDetail.variants.length > 0) {
        const v = window.activeProductDetail.variants[0];
        unitPrice = v.price;
        discPrice = v.discounted_price;
        currency = v.currency || "TL";
    }
    
    const finalPricePerUnit = (discPrice < unitPrice && discPrice > 0) ? discPrice : unitPrice;
    
    const totalUnits = pkgs * unitsPerPkg;
    const totalWeight = totalUnits * weightPerUnit;
    const totalPrice = totalUnits * finalPricePerUnit;
    
    document.getElementById('calcTotalUnits').innerText = totalUnits + ' ' + window.t('piece');
    document.getElementById('calcTotalWeight').innerText = totalWeight.toFixed(2) + ' kg';
    document.getElementById('calcTotalPrice').innerText = totalPrice.toFixed(2) + ' ' + currency;
};

window.updateCatalogTitle = function() {
    const titleEl = document.getElementById('catalogTitle');
    if (!titleEl) return;
    if (window.activeCategoryId) {
        const cat = window.cachedCategories.find(c => c.id === window.activeCategoryId);
        titleEl.innerText = cat ? cat.title : window.t('all_products');
    } else {
        titleEl.innerText = window.t('all_products');
    }
};
