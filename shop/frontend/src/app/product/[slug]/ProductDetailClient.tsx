"use client";

import React, { useState, useEffect } from "react";
import { Home, ChevronRight } from "lucide-react";
import { Product, Category, CartItem } from "@/types/store";
import { t, getProductTitle, getProductDescription, getProductAttributes, getCategoryTitle, getCategoryTrail, getCategoryUrl } from "@/app/i18n";
import { getUnitsFromSeriesRatio, apiFetch, convertPrice, ExchangeRate, showToast as triggerToast } from "@/app/utils";

// Reuse the premium Tailwind storefront components
import Header from "@/components/store/Header";
import Footer from "@/components/store/Footer";

// Modular sub-components
import ProductImageGallery from "./components/ProductImageGallery";
import ProductSpecs from "./components/ProductSpecs";
import ColorVariants from "./components/ColorVariants";
import OrderCalculator from "./components/OrderCalculator";
import SocialShare from "./components/SocialShare";
import ProductInquiryCart from "./components/ProductInquiryCart";

interface ProductDetailClientProps {
  product: Product | null;
}

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

  // --- B2B Selection States ---
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [pkgQty, setPkgQty] = useState<number>(1);

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

  // Dynamic browser title synchronization when language changes
  useEffect(() => {
    if (product) {
      const localizedTitle = getProductTitle(product, lang);
      const brandName = product.brand_name || "Merter Manufacturer";
      document.title = `${localizedTitle} - ${brandName} | Merter Vitrini Toptan B2B`;
    }
  }, [lang, product]);

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
            className="px-8 py-3 bg-[#a855f7] text-white rounded-[5px] font-extrabold text-xs tracking-[0.5px] uppercase hover:bg-[#1c191f] transition-all cursor-pointer shadow-md no-underline"
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

  const saveCart = (newCart: CartItem[]) => {
    setCart(newCart);
    localStorage.setItem("merter_b2b_cart", JSON.stringify(newCart));
  };

  const handleAdjustPkgQty = (change: number) => {
    const minPkgs = Math.ceil(product.minimum_order_quantity / unitsPerPkg);
    setPkgQty((prev) => {
      const next = prev + change;
      if (next < minPkgs) {
        triggerToast(`${t("minimum_order_alert", lang)} (${minPkgs} ${t("package", lang)})`);
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

    // Add series pack
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
          slug: product.slug || product.id,
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
        triggerToast(`Error: ${errData.error || t("failed_submit_inquiry", lang)}`);
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
      triggerToast(t("connection_error_inquiry", lang));
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
      "name": product.brand_name || t("merter_manufacturer", lang)
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

  const safeJsonLdString = JSON.stringify(jsonLdData)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e");

  return (
    <div 
      className="min-h-screen flex flex-col font-sans antialiased bg-bg-dark text-text-primary"
      style={{ direction: lang === "ar" ? "rtl" : "ltr" }}
    >
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
            <ProductImageGallery
              images={product.images}
              title={title}
              lang={lang}
              t={t}
            />

            {/* Right Column - Specs & B2B Calculator */}
            <div className="flex flex-col gap-6">
              <ProductSpecs
                product={product}
                title={title}
                lang={lang}
                t={t}
                hasDiscount={hasDiscount}
                unitPrice={unitPrice}
                discountedPrice={discountedPrice}
                currency={currency}
                dynamicAttrs={dynamicAttrs}
              />

              <ColorVariants
                product={product}
                lang={lang}
                t={t}
              />

              <OrderCalculator
                hasSeries={hasSeries}
                unitsPerPkg={unitsPerPkg}
                sizes={sizes}
                ratios={ratios}
                pkgQty={pkgQty}
                handleAdjustPkgQty={handleAdjustPkgQty}
                totalPieces={totalPieces}
                totalWeight={totalWeight}
                totalPrice={totalPrice}
                currency={currency}
                lang={lang}
                t={t}
                handleAddToCart={handleAddToCart}
              />

              <SocialShare
                title={title}
                lang={lang}
                t={t}
              />
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

      {/* Cart components overlay */}
      <ProductInquiryCart
        isCartOpen={isCartOpen}
        setIsCartOpen={setIsCartOpen}
        cart={cart}
        lang={lang}
        totalPkgs={totalPkgs}
        totalItemsCount={totalItemsCount}
        totalWeightCart={totalWeightCart}
        totalPriceCart={totalPriceCart}
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
        handleSubmitInquiry={handleSubmitInquiry}
        handleAdjustCartItemQty={handleAdjustCartItemQty}
        handleRemoveCartItem={handleRemoveCartItem}
        displayCurrency={displayCurrency}
        exchangeRates={exchangeRates}
        showSuccessOverlay={showSuccessOverlay}
        setShowSuccessOverlay={setShowSuccessOverlay}
        whatsappUrl={whatsappUrl}
      />
    </div>
  );
}
