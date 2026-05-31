"use client";

import React, { useState, useEffect } from "react";
import { ShoppingBag, Plus, Minus, ChevronRight, ChevronLeft, Home, X, Share2 } from "lucide-react";
import { Product, Category, CartItem } from "@/types/store";
import { t, getProductTitle, getProductDescription, getProductAttributes, getCategoryPrefix, getCategoryTitle, getCategoryTrail, getCategoryUrl, translateColor } from "@/app/i18n";
import { getUnitsFromSeriesRatio, apiFetch, convertPrice, ExchangeRate } from "@/app/utils";

// Reuse the premium Tailwind storefront components
import Header from "@/components/store/Header";
import CartDrawer from "@/components/store/CartDrawer";
import SuccessModal from "@/components/store/SuccessModal";
import Footer from "@/components/store/Footer";

interface ProductDetailClientProps {
  product: Product | null;
}

const findCategory = (tree: Category[], target: string): Category | null => {
  for (const cat of tree) {
    if (cat.id === target || cat.slug === target) return cat;
    if (cat.children && cat.children.length > 0) {
      const found = findCategory(cat.children, target);
      if (found) return found;
    }
  }
  return null;
};

const shareTranslations: Record<string, { share: string, copied: string }> = {
  tr: { share: "Ürünü Paylaş", copied: "Bağlantı Kopyalandı!" },
  en: { share: "Share Product", copied: "Link Copied!" },
  ru: { share: "Поделиться товаром", copied: "Ссылка скопирована!" },
  ar: { share: "مشاركة المنتج", copied: "تم نسخ الرابط!" },
  pl: { share: "Udostępnij produkt", copied: "Link skopiowany!" },
  bg: { share: "Сподели продукта", copied: "Връзката е копирана!" },
  de: { share: "Produkt teilen", copied: "Link kopiert!" },
  fr: { share: "Partager le produit", copied: "Lien copié!" }
};

const EXCLUDED_ATTR_NAMES = new Set([
  // Turkish
  "cinsiyet", "kumaş", "kumaş tipi", "kumas tipi", "renk",
  // English
  "gender", "fabric", "fabric type", "color", "colour",
  // German
  "geschlecht", "stoff", "stoffart", "farbe",
  // French
  "genre", "sexe", "tissu", "type de tissu", "couleur",
  // Russian
  "пол", "ткань", "тип ткани", "цвет",
  // Polish
  "płeć", "plec", "tkanina", "rodzaj tkaniny", "kolor",
  // Bulgarian
  "пол", "тъкан", "тип тъкан", "тип материя", "цвят",
  // Arabic
  "الجنس", "القماش", "نوع القماش", "اللون"
]);

export default function ProductDetailClient({ product }: ProductDetailClientProps) {
  // --- UI & Localizer States ---
  const [lang, setLang] = useState<string>("tr");
  const [isLangOpen, setIsLangOpen] = useState<boolean>(false);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string>("");

  // --- Multi-Currency States ---
  const [displayCurrency, setDisplayCurrency] = useState<string>("TRY");
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);

  const handleCurrencyChange = (curr: string) => {
    setDisplayCurrency(curr);
    localStorage.setItem("merter_preferred_currency", curr);
  };

  // --- Dynamic Image Gallery & B2B Selection States ---
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [pkgQty, setPkgQty] = useState<number>(1);
  const [mainImg, setMainImg] = useState<string>("/placeholder.png");

  // --- Shared Cart Persistent State ---
  const [cart, setCart] = useState<CartItem[]>([]);

  // --- Quote inquiry form states ---
  const [fullName, setFullName] = useState<string>("");
  const [companyName, setCompanyName] = useState<string>("");
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [emailAddress, setEmailAddress] = useState<string>("");
  const [customerMessage, setCustomerMessage] = useState<string>("");
  const [submittingInquiry, setSubmittingInquiry] = useState<boolean>(false);
  const [whatsappUrl, setWhatsappUrl] = useState<string>("");
  const [showSuccessOverlay, setShowSuccessOverlay] = useState<boolean>(false);
  const [showToast, setShowToast] = useState<boolean>(false);
  const [storeSettings, setStoreSettings] = useState<any>(null);

  useEffect(() => {
    const loadSettings = async () => {
      const data = await apiFetch<any>("/settings");
      if (data) setStoreSettings(data);
    };
    loadSettings();
  }, []);

  // Sync lang to document element and auto-sync preferred language
  useEffect(() => {
    if (typeof window !== "undefined") {
      document.documentElement.setAttribute("lang", lang);
    }
  }, [lang]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedLang = localStorage.getItem("preferred_lang");
      if (savedLang) {
        setLang(savedLang);
      }
    }
  }, []);

  // Initial mount loaders
  useEffect(() => {
    const loadCategories = async () => {
      const data = await apiFetch<Category[]>("/categories");
      if (data) setCategories(data);
    };

    const savedCart = localStorage.getItem("merter_b2b_cart");
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (err) {
        console.error("Failed to parse cart storage", err);
      }
    }

    const savedCurrency = localStorage.getItem("merter_preferred_currency");
    if (savedCurrency) {
      setDisplayCurrency(savedCurrency);
    }

    const loadRates = async () => {
      const data = await apiFetch<ExchangeRate[]>("/exchange-rates");
      if (data) setExchangeRates(data);
    };
    loadRates();

    loadCategories();

    if (product) {
      // Default main image
      let cover = "/placeholder.png";
      if (product.images && product.images.length > 0) {
        const coverObj = product.images.find(img => img.is_cover) || product.images[0];
        cover = coverObj.image_url;
      }
      setMainImg(cover);

      // Default color selection
      const activeColors = product.color ? [product.color] : ["Standart"];
      setSelectedColor(activeColors[0]);

      // Default package min quantity
      const unitsPerPkg = getUnitsFromSeriesRatio(product.series_ratio);
      const minPkgs = Math.ceil(product.minimum_order_quantity / unitsPerPkg);
      setPkgQty(minPkgs);
    }
  }, [product]);

  // Handle case where product is null (Product Not Found)
  if (!product) {
    const totalPkgs = cart.reduce((sum, item) => sum + item.packages_qty, 0);
    
    return (
      <div 
        className="min-h-screen flex flex-col font-sans antialiased bg-[#fcfcfc] text-[#1c191f]"
        style={{ direction: lang === "ar" ? "rtl" : "ltr" }}
      >
        <Header
          lang={lang}
          setLang={setLang}
          isLangOpen={isLangOpen}
          setIsLangOpen={setIsLangOpen}
          totalPkgs={totalPkgs}
          setIsCartOpen={setIsCartOpen}
          setSearchQuery={() => {}}
          setCurrentPage={() => {}}
          setActiveCategoryId={setActiveCategoryId}
          categories={categories}
          activeCategoryId={activeCategoryId}
          displayCurrency={displayCurrency}
          onCurrencyChange={handleCurrencyChange}
        />
        <main className="flex-grow flex flex-col items-center justify-center p-8 text-center select-none py-24">
          <span className="text-5xl mb-4">🔍</span>
          <h1 className="text-2xl font-extrabold text-[#1c191f] mb-3">
            {t("product_not_found", lang)}
          </h1>
          <p className="text-sm font-semibold text-[#71717a] mb-8 max-w-md mx-auto leading-relaxed">
            {t("product_not_found_desc", lang)}
          </p>
          <a 
            href="/" 
            className="px-8 py-3 bg-[#a855f7] text-white rounded-[5px] font-extrabold text-xs tracking-[0.5px] uppercase hover:bg-[#1c191f] transition-all cursor-pointer shadow-md"
          >
            {t("back_to_homepage", lang)}
          </a>
        </main>
        <Footer lang={lang} />
      </div>
    );
  }

  // --- Specs Variables & Computations ---
  const title = getProductTitle(product, lang);
  const desc = getProductDescription(product, lang);
  const dynamicAttrs = getProductAttributes(product, lang).filter(
    (attr) => !EXCLUDED_ATTR_NAMES.has(attr.name.toLowerCase().trim())
  );
  const unitsPerPkg = getUnitsFromSeriesRatio(product.series_ratio);
  const rawSizes = product.packing_ratio ? product.packing_ratio.split(",") : ["Standart"];
  const ratios = product.series_ratio ? product.series_ratio.split("-") : ["1"];
  const sizes = rawSizes.map(sz => sz.toUpperCase() === "STANDART" ? t("Standart", lang) : sz);
  const weightPerUnit = product.shipping_weight_kg || 0.35;
  const totalPkgWeight = unitsPerPkg * weightPerUnit;

  const rawUnitPrice = product.price || 0.0;
  const rawDiscountedPrice = product.discounted_price || 0.0;
  const hasDiscount = product.discounted_price < product.price && product.discounted_price > 0;

  let unitPrice = rawUnitPrice;
  let discountedPrice = rawDiscountedPrice;
  let currency = displayCurrency || product.currency || "TRY";

  if (displayCurrency && exchangeRates && exchangeRates.length > 0) {
    unitPrice = convertPrice(rawUnitPrice, product.currency, displayCurrency, exchangeRates);
    discountedPrice = convertPrice(rawDiscountedPrice, product.currency, displayCurrency, exchangeRates);
  } else {
    currency = product.currency || "TRY";
  }

  const finalPricePerUnit = hasDiscount ? discountedPrice : unitPrice;
  const finalPkgPrice = unitsPerPkg * finalPricePerUnit;
  const activeColors = product.color ? [product.color] : ["Standart"];

  // Lightbox Image visualizer state variables
  const [isLightboxOpen, setIsLightboxOpen] = useState<boolean>(false);
  const [lightboxIndex, setLightboxIndex] = useState<number>(0);

  const handleOpenLightbox = () => {
    const idx = product.images?.findIndex(img => img.image_url === mainImg) ?? 0;
    setLightboxIndex(idx >= 0 ? idx : 0);
    setIsLightboxOpen(true);
  };

  useEffect(() => {
    if (!isLightboxOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsLightboxOpen(false);
      else if (e.key === "ArrowRight") {
        setLightboxIndex((prev) => (prev + 1) % (product.images?.length || 1));
      } else if (e.key === "ArrowLeft") {
        setLightboxIndex((prev) => (prev - 1 + (product.images?.length || 1)) % (product.images?.length || 1));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLightboxOpen, product.images]);

  const saveCart = (newCart: CartItem[]) => {
    setCart(newCart);
    localStorage.setItem("merter_b2b_cart", JSON.stringify(newCart));
  };

  const handleAdjustPkgQty = (change: number) => {
    const minPkgs = Math.ceil(product.minimum_order_quantity / unitsPerPkg);
    setPkgQty((prev) => {
      const next = prev + change;
      if (next < minPkgs) {
        alert(`${t("minimum_order_alert", lang)} (${minPkgs} ${t("package", lang)})`);
        return minPkgs;
      }
      return next;
    });
  };



  // Order summary calculations
  const hasSeries = unitsPerPkg > 1;
  const totalSeriesPieces = hasSeries ? (pkgQty * unitsPerPkg) : 0;
  
  const totalPieces = totalSeriesPieces;
  const totalWeight = hasSeries ? (pkgQty * totalPkgWeight) : 0;
  const totalPrice = hasSeries ? (pkgQty * finalPkgPrice) : 0;

  const handleAddToCart = () => {
    const sku = product.custom_sku || product.source_product_id || "";
    let coverImg = "/placeholder.png";
    if (product.images && product.images.length > 0) {
      const coverObj = product.images.find(img => img.is_cover) || product.images[0];
      coverImg = coverObj.image_url;
    }

    const updatedCart = [...cart];

    // A. Add series pack
    if (hasSeries && pkgQty > 0) {
      const duplicateIdx = updatedCart.findIndex(
        item => item.product_id === product.id && item.color === selectedColor && item.units_per_package > 1
      );
      if (duplicateIdx > -1) {
        const item = updatedCart.at(duplicateIdx);
        if (item) item.packages_qty += pkgQty;
      } else {
        updatedCart.push({
          product_id: product.id,
          title: getProductTitle(product, lang),
          custom_sku: sku,
          color: selectedColor || product.color || "",
          packages_qty: pkgQty,
          units_per_package: unitsPerPkg,
          price_per_unit: hasDiscount ? rawDiscountedPrice : rawUnitPrice,
          weight_per_unit: weightPerUnit,
          image_url: coverImg,
          currency: product.currency || "TRY",
          title_translations: {
            tr: product.title || "",
            en: product.translations?.en?.title || product.title || "",
            pl: product.translations?.pl?.title || product.title || "",
            ar: product.translations?.ar?.title || product.title || "",
            ru: product.translations?.ru?.title || product.title || "",
            de: product.translations?.de?.title || product.title || "",
            bg: product.translations?.bg?.title || product.title || "",
            fr: product.translations?.fr?.title || product.title || "",
          },
        });
      }
    }

    saveCart(updatedCart);
    setIsCartOpen(true);
  };

  const handleAdjustCartItemQty = (index: number, change: number) => {
    const updatedCart = [...cart];
    const item = updatedCart.at(index);
    if (item) {
      item.packages_qty += change;
      if (item.packages_qty <= 0) {
        updatedCart.splice(index, 1);
      }
    }
    saveCart(updatedCart);
  };

  const handleRemoveCartItem = (index: number) => {
    const updatedCart = [...cart];
    updatedCart.splice(index, 1);
    saveCart(updatedCart);
  };

  // Header quote cart items counts
  const totalPkgs = cart.reduce((sum, item) => sum + item.packages_qty, 0);
  const totalItemsCount = cart.reduce((sum, item) => sum + (item.packages_qty * item.units_per_package), 0);
  const totalWeightCart = cart.reduce((sum, item) => sum + (item.packages_qty * item.units_per_package * item.weight_per_unit), 0);
  const totalPriceCart = cart.reduce((sum, item) => {
    const itemTotalUnits = item.packages_qty * item.units_per_package;
    const itemPriceInOrig = itemTotalUnits * item.price_per_unit;
    const itemPriceInDisplay = convertPrice(itemPriceInOrig, item.currency || "TRY", displayCurrency, exchangeRates);
    return sum + itemPriceInDisplay;
  }, 0);

  const handleSubmitInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;
    
    setSubmittingInquiry(true);
    const inquiryItems = cart.map(item => {
      const totalUnits = item.packages_qty * item.units_per_package;
      return {
        product_id: item.product_id,
        title: `${item.title} (${item.color}) - ${item.packages_qty} ${t("package", lang)} (${totalUnits} ${t("piece", lang)})`,
        custom_sku: item.custom_sku || item.product_id,
        quantity: totalUnits,
        price: item.price_per_unit,
      };
    });

    const payload = {
      full_name: fullName,
      company: companyName || null,
      phone: phoneNumber,
      email: emailAddress,
      message: customerMessage || null,
      items: inquiryItems,
    };

    try {
      const response = await fetch("/api/v1/store/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errData = await response.json();
        alert(`Error: ${errData.error || "Failed to submit inquiry"}`);
        setSubmittingInquiry(false);
        return;
      }

      const result = await response.json();
      saveCart([]);
      setFullName("");
      setCompanyName("");
      setPhoneNumber("");
      setEmailAddress("");
      setCustomerMessage("");
      setIsCartOpen(false);

      setWhatsappUrl(result.whatsapp_url || "#");
      setShowSuccessOverlay(true);
    } catch (err) {
      console.error("Failed to submit B2B inquiry", err);
      alert("Connection error! Failed to register your quote request.");
    } finally {
      setSubmittingInquiry(false);
    }
  };

  // Structured Data (JSON-LD Product Schema for Google SEO results)
  const jsonLdData = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": title,
    "image": product.images ? product.images.map(img => img.image_url) : ["/placeholder.png"],
    "description": desc,
    "sku": product.custom_sku || product.source_product_id,
    "brand": {
      "@type": "Brand",
      "name": product.brand_name || "Merter Manufacturer"
    },
    "offers": {
      "@type": "Offer",
      "priceCurrency": currency,
      "price": finalPricePerUnit.toFixed(2),
      "availability": "https://schema.org/InStock",
      "itemCondition": "https://schema.org/NewCondition",
      "valueAddedTaxIncluded": "false"
    }
  };

  // Escaping '<' and '>' to prevent XSS breakout when placing text directly in the script block
  const safeJsonLdString = JSON.stringify(jsonLdData)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e");

  return (
    <div 
      className="min-h-screen flex flex-col font-sans antialiased bg-bg-dark text-text-primary"
      style={{ direction: lang === "ar" ? "rtl" : "ltr" }}
    >
      {/* Inject Structured Data Safely as child string to prevent XSS and dangerouslySetInnerHTML warnings */}
      <script type="application/ld+json">
        {safeJsonLdString}
      </script>

      {/* Header */}
      <Header
        lang={lang}
        setLang={setLang}
        isLangOpen={isLangOpen}
        setIsLangOpen={setIsLangOpen}
        totalPkgs={totalPkgs}
        setIsCartOpen={setIsCartOpen}
        setSearchQuery={() => {}}
        setCurrentPage={() => {}}
        setActiveCategoryId={setActiveCategoryId}
        categories={categories}
        activeCategoryId={activeCategoryId}
        displayCurrency={displayCurrency}
        onCurrencyChange={handleCurrencyChange}
      />

      {/* Main Content Area */}
      <main className="flex-grow max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Google SEO Breadcrumbs */}
        <nav className="flex items-center gap-1.5 text-[11px] font-semibold text-sonic-silver mb-6 uppercase tracking-wider select-none">
          <a href="/" className="hover:text-salmon-pink flex items-center gap-1 transition-colors no-underline text-sonic-silver">
            <Home className="w-3.5 h-3.5" />
            <span>{t("home", lang)}</span>
          </a>
          {product.category_id && getCategoryTrail(categories, product.category_id)?.map((cat) => (
            <React.Fragment key={cat.id}>
              <ChevronRight className="w-3 h-3 text-spanish-gray" />
              <a 
                href={getCategoryUrl(categories, cat, lang)}
                className="hover:text-salmon-pink transition-colors no-underline text-sonic-silver font-bold"
              >
                {getCategoryTitle(cat, lang)}
              </a>
            </React.Fragment>
          ))}
          <ChevronRight className="w-3 h-3 text-spanish-gray" />
          <span className="text-salmon-pink font-extrabold truncate max-w-[200px]">
            {title}
          </span>
        </nav>

        {/* Product Grid */}
        <div className="bg-white border border-cultured rounded-[15px] p-6 md:p-8 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Left Column - Image Gallery */}
            <div className="flex flex-col gap-4">
              <div 
                onClick={handleOpenLightbox}
                className="aspect-[4/5] rounded-[12px] overflow-hidden bg-[#fafafa] border border-cultured relative shadow-inner cursor-zoom-in group"
              >
                <img 
                  src={mainImg} 
                  alt={title}
                  className="w-full h-full object-cover transition-all duration-300 group-hover:scale-105"
                />
              </div>
              
              {product.images && product.images.length > 1 && (
                <div className="flex gap-2.5 overflow-x-auto py-1 scrollbar-none select-none">
                  {product.images.map((img) => (
                    <button
                      key={img.id}
                      onClick={() => setMainImg(img.image_url)}
                      className={`w-16 h-20 rounded-[5px] overflow-hidden shrink-0 border-2 cursor-pointer transition-all ${
                        mainImg === img.image_url 
                          ? "border-salmon-pink scale-[1.03] shadow-sm" 
                          : "border-transparent opacity-65 hover:opacity-100"
                      }`}
                    >
                      <img src={img.image_url} alt="thumb" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column - Specs & B2B Calculator */}
            <div className="flex flex-col gap-6">
              <div>
                <span className="text-[11px] uppercase font-extrabold tracking-[0.5px] text-salmon-pink">
                  {product.brand_name || "Merter Manufacturer"}
                </span>
                <h1 className="font-sans font-extrabold text-2xl md:text-3xl text-eerie-black leading-snug mt-1">
                  {title}
                </h1>
                <span className="text-[11px] font-bold text-sonic-silver mt-2 block">
                  {t("sku_label", lang) || "SKU"}: {product.custom_sku || product.source_product_id}
                </span>
              </div>

              {/* Pricing breakdown */}
              <div className="flex items-center gap-3 bg-[#fafafa] border border-cultured rounded-[8px] px-5 py-4 shadow-inner">
                <span className="text-[10px] font-extrabold text-onyx uppercase tracking-[0.5px] shrink-0">
                  {t("unit_price_label", lang)}
                </span>
                <div className="flex items-baseline gap-2.5">
                  {hasDiscount ? (
                    <>
                      <span className="text-xs text-sonic-silver line-through">
                        {unitPrice.toFixed(2)} {currency}
                      </span>
                      <span className="text-xl font-extrabold text-salmon-pink">
                        {discountedPrice.toFixed(2)} {currency}
                      </span>
                    </>
                  ) : (
                    <span className="text-xl font-extrabold text-eerie-black">
                      {unitPrice.toFixed(2)} {currency}
                    </span>
                  )}
                </div>
              </div>

              {/* Specifications Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="border border-cultured rounded-[5px] p-3 bg-white flex flex-col gap-0.5 shadow-sm">
                  <span className="text-[9px] uppercase font-extrabold text-sonic-silver tracking-[0.5px]">{t("fabric", lang)}</span>
                  <span className="font-bold text-eerie-black truncate">{t(product.kumas_fabric || "Viskon / Pamuk", lang)}</span>
                </div>
                <div className="border border-cultured rounded-[5px] p-3 bg-white flex flex-col gap-0.5 shadow-sm">
                  <span className="text-[9px] uppercase font-extrabold text-sonic-silver tracking-[0.5px]">
                    {t("gender_spec", lang)} / {t("season_spec", lang)}
                  </span>
                  <span className="font-bold text-eerie-black truncate">
                    {t(product.gender || "Unisex", lang)} / {t(product.season || "Mevsimlik", lang)}
                  </span>
                </div>
                <div className="border border-cultured rounded-[5px] p-3 bg-white flex flex-col gap-0.5 shadow-sm">
                  <span className="text-[9px] uppercase font-extrabold text-sonic-silver tracking-[0.5px]">{t("desi", lang)}</span>
                  <span className="font-bold text-eerie-black">{(product.desi_volume || 2)} {t("desi_unit", lang)}</span>
                </div>
                <div className="border border-cultured rounded-[5px] p-3 bg-white flex flex-col gap-0.5 shadow-sm">
                  <span className="text-[9px] uppercase font-extrabold text-sonic-silver tracking-[0.5px]">{t("min_order_qty", lang)}</span>
                  <span className="font-bold text-eerie-black truncate">
                    {product.minimum_order_quantity} {lang === "tr" ? "Adet" : t("piece", lang)}
                  </span>
                </div>
                
                {dynamicAttrs && dynamicAttrs.map((attr, idx) => (
                  <div key={idx} className="border border-cultured rounded-[5px] p-3 bg-white flex flex-col gap-0.5 shadow-sm">
                    <span className="text-[9px] uppercase font-extrabold text-sonic-silver tracking-[0.5px] truncate">{t(attr.name, lang)}</span>
                    <span className="font-bold text-eerie-black truncate">{t(attr.value, lang)}</span>
                  </div>
                ))}
              </div>

              {/* Visual sibling colors color picker */}
              <div>
                <span className="block text-[11px] uppercase font-extrabold text-eerie-black mb-2 tracking-[0.5px]">
                  {t("available_colors", lang)}
                </span>
                <div className="flex gap-3 flex-wrap">
                  {/* Current viewed product */}
                  <div
                    className="flex flex-col items-center gap-1.5 p-1.5 rounded-[8px] border-2 bg-white transition-all scale-[1.03] shadow-sm border-salmon-pink select-none"
                  >
                    <div className="w-12 h-14 rounded-[5px] overflow-hidden bg-[#f0f0f0] border border-cultured relative">
                      <img 
                        src={product.images?.find(img => img.is_cover)?.image_url || product.images?.[0]?.image_url || "/placeholder.png"} 
                        alt={translateColor(product.color || "Standart", lang)} 
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-0 inset-x-0 bg-salmon-pink text-white text-[8px] font-extrabold py-0.5 text-center uppercase tracking-[0.3px]">
                        {t("active", lang)}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-eerie-black truncate max-w-[56px] text-center">
                      {translateColor(product.color || "Standart", lang)}
                    </span>
                  </div>

                  {/* Sibling color variants */}
                  {product.color_variants && product.color_variants.map((sib) => (
                    <a
                      key={sib.id}
                      href={`/product/${sib.slug || sib.id}`}
                      className="flex flex-col items-center gap-1.5 p-1.5 rounded-[8px] border-2 border-transparent bg-white hover:border-[#e2e8f0] transition-all hover:scale-[1.03] opacity-80 hover:opacity-100 cursor-pointer select-none"
                    >
                      <div className="w-12 h-14 rounded-[5px] overflow-hidden bg-[#f0f0f0] border border-cultured">
                        <img 
                          src={sib.image_url || "/placeholder.png"} 
                          alt={translateColor(sib.color, lang)} 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <span className="text-[10px] font-bold text-sonic-silver truncate max-w-[56px] text-center">
                        {translateColor(sib.color, lang)}
                      </span>
                    </a>
                  ))}
                </div>
              </div>

              {/* A. SERIES PACK SALES CALCULATOR */}
              {hasSeries && (
                <div className="flex flex-col gap-3.5 pt-4 border-t border-cultured">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase font-extrabold text-eerie-black tracking-[0.5px]">
                      📦 {t("series_sales_pack", lang)}
                    </span>
                    <span className="text-[10px] font-bold text-salmon-pink">
                      {unitsPerPkg} {t("piece", lang)} / {t("package", lang)}
                    </span>
                  </div>

                  {/* Pack sizes/ratios content */}
                  <div>
                    <span className="block text-[9px] uppercase font-bold text-sonic-silver mb-2 tracking-[0.5px]">
                      {t("pkg_content", lang)}
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {sizes.map((sz, idx) => {
                        const count = ratios.at(idx) || "1";
                        return (
                          <div key={idx} className="border border-cultured bg-[#fafafa] rounded-[5px] px-3 py-2 flex items-center justify-between text-[11px] font-bold shadow-inner">
                            <span className="text-sonic-silver">{sz}</span>
                            <span className="text-salmon-pink">{count} {lang === "tr" ? "Adet" : t("piece", lang)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Quantity counters */}
                  <div className="bg-[#fafafa] border border-cultured p-3.5 rounded-[10px] flex items-center justify-between shadow-inner">
                    <span className="text-[10px] font-extrabold text-onyx uppercase tracking-[0.5px]">
                      {t("pkg_qty_label", lang)}
                    </span>
                    
                    <div className="flex items-center bg-white border border-cultured rounded-[5px] p-0.5 shadow-sm">
                      <button 
                        onClick={() => handleAdjustPkgQty(-1)}
                        className="w-7 h-7 rounded-[5px] border-none bg-transparent hover:bg-[#fafafa] flex items-center justify-center font-bold text-sm cursor-pointer text-onyx select-none transition-colors"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <input 
                        type="text" 
                        className="w-10 text-center font-extrabold text-xs focus:outline-none border-none bg-transparent text-eerie-black" 
                        value={pkgQty} 
                        readOnly 
                      />
                      <button 
                        onClick={() => handleAdjustPkgQty(1)}
                        className="w-7 h-7 rounded-[5px] border-none bg-transparent hover:bg-[#fafafa] flex items-center justify-center font-bold text-sm cursor-pointer text-onyx select-none transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* B. SINGLE SALES SECTION */}


              {/* B2B CALCULATIONS SUMMARY */}
              <div className="bg-[#fafafa] border border-cultured p-4.5 rounded-[10px] flex flex-col gap-3.5 shadow-inner mt-2">
                <span className="text-[10px] font-extrabold text-salmon-pink uppercase tracking-[0.5px] block">
                  {t("order_summary", lang)}
                </span>

                <div className="flex flex-col gap-2 text-xs font-bold text-onyx">
                  <div className="flex justify-between">
                    <span>{t("total_pieces_calc", lang)}:</span>
                    <span className="text-eerie-black">{totalPieces} {t("piece", lang)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t("total_weight_calc", lang)}:</span>
                    <span className="text-eerie-black">{totalWeight.toFixed(2)} {t("kg_unit", lang)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-salmon-pink font-extrabold pt-2.5 border-t border-cultured mt-2">
                    <span>{t("total_price_calc", lang)} ({t("excluding_vat", lang)}):</span>
                    <span>{totalPrice.toFixed(2)} {currency}</span>
                  </div>
                </div>
              </div>

              {/* Add to Inquiry Cart Button */}
              <button
                onClick={handleAddToCart}
                className="w-full py-3.5 bg-salmon-pink hover:bg-eerie-black text-white rounded-[5px] font-extrabold text-xs tracking-[0.5px] uppercase transition-all duration-300 border-none flex items-center justify-center gap-2.5 cursor-pointer select-none active:scale-[0.99]"
              >
                <ShoppingBag className="w-4 h-4 text-white" />
                {t("add_to_cart", lang)}
              </button>

              {/* B2B Product Social Share Section */}
              <div className="border-t border-cultured pt-5 flex flex-col gap-3 mt-2">
                <span className="text-[11px] uppercase font-extrabold text-eerie-black tracking-[0.5px] block select-none">
                  {shareTranslations[lang]?.share || "Share Product"}
                </span>
                
                <div className="flex items-center gap-3">
                  {/* WhatsApp */}
                  <a
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(title + " - " + (typeof window !== "undefined" ? window.location.href : ""))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 flex items-center justify-center text-emerald-600 transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-sm"
                    title="WhatsApp"
                  >
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.73-1.458L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.863-9.73.001-2.595-1.006-5.035-2.836-6.87C16.671 2.16 14.237.986 11.64.985c-5.441 0-9.87 4.372-9.873 9.734-.001 1.709.467 3.376 1.354 4.887l-.982 3.582 3.71-.974zm13.14-5.932c-.3-.15-1.776-.875-2.05-.975-.275-.1-.475-.15-.675.15-.2.3-.775.975-.95 1.175-.175.2-.35.225-.65.075-1.127-.566-1.929-1.009-2.694-2.321-.202-.347-.202-.656-.051-.951.136-.264.3-.35.45-.5.15-.15.2-.25.3-.45.1-.2.05-.375-.025-.525-.075-.15-.675-1.625-.925-2.225-.244-.588-.491-.508-.675-.518-.175-.009-.375-.01-.575-.01-.2 0-.525.075-.8 1.025-.275.95-1.05 3.3-1.05 3.4 0 .1.075.2.225.35.15.15 1.75 2.673 4.237 3.743.592.255 1.054.408 1.413.523.595.19 1.137.163 1.564.1.477-.07 1.475-.603 1.675-1.18.2-.578.2-1.075.14-1.18-.06-.1-.225-.15-.525-.3z"/>
                    </svg>
                  </a>
                  
                  {/* X (Twitter) */}
                  <a
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(typeof window !== "undefined" ? window.location.href : "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-full bg-zinc-50 hover:bg-zinc-100 border border-zinc-200/60 flex items-center justify-center text-zinc-900 transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-sm"
                    title="X (Twitter)"
                  >
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                  </a>
                  
                  {/* Facebook */}
                  <a
                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(typeof window !== "undefined" ? window.location.href : "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-full bg-blue-50 hover:bg-blue-100 border border-blue-100 flex items-center justify-center text-blue-600 transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-sm"
                    title="Facebook"
                  >
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                      <path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z"/>
                    </svg>
                  </a>
                  
                  {/* Copy Link */}
                  <button
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        navigator.clipboard.writeText(window.location.href);
                        setShowToast(true);
                        setTimeout(() => setShowToast(false), 2000);
                      }
                    }}
                    className="w-10 h-10 rounded-full bg-purple-50 hover:bg-purple-100 border border-purple-100 flex items-center justify-center text-purple-600 transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-sm border-none"
                    title="Copy Link"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                  
                  {/* Toast Notification */}
                  {showToast && (
                    <span className="text-[10px] font-extrabold text-purple-600 bg-purple-50 px-3 py-1.5 rounded-[5px] border border-purple-100 animate-fade-in select-none">
                      {shareTranslations[lang]?.copied || "Link Copied!"}
                    </span>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* Description Block */}
          <div className="border-t border-cultured pt-6 mt-8">
            <h2 className="font-sans font-extrabold text-sm tracking-[0.5px] mb-3 uppercase text-eerie-black select-none">
              {t("description_label", lang)}
            </h2>
            <p className="text-xs text-sonic-silver leading-relaxed font-semibold whitespace-pre-line">
              {desc}
            </p>
          </div>
        </div>

      </main>

      {/* Footer */}
      <Footer lang={lang} />

      {/* Cart Drawer */}
      {isCartOpen && (
        <CartDrawer
          lang={lang}
          cart={cart}
          onClose={() => setIsCartOpen(false)}
          onAdjustQty={handleAdjustCartItemQty}
          onRemove={handleRemoveCartItem}
          totalPkgs={totalPkgs}
          totalItemsCount={totalItemsCount}
          totalWeight={totalWeightCart}
          totalPrice={totalPriceCart}
          fullName={fullName}
          setFullName={setFullName}
          companyName={companyName}
          setCompanyName={setCompanyName}
          phoneNumber={phoneNumber}
          setPhoneNumber={setPhoneNumber}
          emailAddress={emailAddress}
          setEmailAddress={setEmailAddress}
          customerMessage={customerMessage}
          setCustomerMessage={setCustomerMessage}
          submittingInquiry={submittingInquiry}
          onSubmit={handleSubmitInquiry}
          displayCurrency={displayCurrency}
          exchangeRates={exchangeRates}
        />
      )}

      {/* Inquiry Success Confirmation overlay */}
      {showSuccessOverlay && (
        <SuccessModal
          lang={lang}
          whatsappUrl={whatsappUrl}
          onClose={() => setShowSuccessOverlay(false)}
        />
      )}

      {/* C. LIGHTBOX PREMIUM IMAGE GALLERY POPUP */}
      {isLightboxOpen && product.images && product.images.length > 0 && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex flex-col justify-between p-4 md:p-8 animate-in fade-in duration-200 select-none">
          {/* Top Bar */}
          <div className="flex justify-between items-center text-white w-full max-w-[1720px] mx-auto z-10">
            <span className="text-xs font-extrabold tracking-wider bg-white/10 px-3.5 py-1.5 rounded-[5px]">
              {lightboxIndex + 1} / {product.images.length}
            </span>
            <button
              onClick={() => setIsLightboxOpen(false)}
              className="w-10 h-10 rounded-[5px] bg-white/10 hover:bg-white/20 hover:scale-105 border border-white/10 flex items-center justify-center text-white cursor-pointer transition-all active:scale-95"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Main Visualizer Area */}
          <div className="flex-grow flex items-center justify-center relative w-full max-w-5xl mx-auto my-4">
            {/* Left navigation arrow */}
            {product.images.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((prev) => (prev - 1 + product.images!.length) % product.images!.length);
                }}
                className="absolute left-2 md:left-4 z-20 w-11 h-11 rounded-[5px] bg-white/10 hover:bg-white/20 hover:scale-105 flex items-center justify-center text-white cursor-pointer transition-all border border-white/10 active:scale-95"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            {/* Middle Image display */}
            <div 
              className="w-full h-full flex items-center justify-center p-2 relative"
              onClick={() => setIsLightboxOpen(false)}
            >
              <img
                src={product.images.at(lightboxIndex)?.image_url || ""}
                alt={title}
                className="max-w-full max-h-[70vh] md:max-h-[75vh] object-contain rounded-[8px] shadow-2xl transition-all duration-300 transform scale-100 ease-out"
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            {/* Right navigation arrow */}
            {product.images.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((prev) => (prev + 1) % product.images!.length);
                }}
                className="absolute right-2 md:right-4 z-20 w-11 h-11 rounded-[5px] bg-white/10 hover:bg-white/20 hover:scale-105 flex items-center justify-center text-white cursor-pointer transition-all border border-white/10 active:scale-95"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>

          {/* Bottom Thumbnails row */}
          {product.images.length > 1 && (
            <div className="w-full max-w-3xl mx-auto flex gap-2 justify-center overflow-x-auto py-3 scrollbar-none">
              {product.images.map((img, idx) => (
                <button
                  key={img.id}
                  onClick={() => setLightboxIndex(idx)}
                  className={`w-14 h-18 rounded-[4px] overflow-hidden shrink-0 border-2 cursor-pointer transition-all ${
                    lightboxIndex === idx
                      ? "border-salmon-pink scale-105 shadow-md opacity-100"
                      : "border-transparent opacity-40 hover:opacity-100"
                  }`}
                >
                  <img src={img.image_url} alt="thumb" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
