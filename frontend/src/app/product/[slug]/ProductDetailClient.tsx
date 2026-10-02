"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Home, ChevronRight } from "lucide-react";
import { Product, Category, CartItem } from "@/types/store";
import { t, getProductTitle, getProductDescription, getProductAttributes, getCategoryTitle, getCategoryTrail, getCategoryUrl } from "@/app/i18n";
import { getUnitsFromSeriesRatio, apiFetch, convertPrice, ExchangeRate, showToast as triggerToast } from "@/app/utils";

// Reuse the premium Tailwind storefront components
import Header from "@/components/store/Header";
import Footer from "@/components/store/Footer";
import ConfirmModal from "@/components/store/ConfirmModal";

// Modular sub-components
import ProductImageGallery from "./components/ProductImageGallery";
import ProductSpecs from "./components/ProductSpecs";
import ColorVariants from "./components/ColorVariants";
import OrderCalculator from "./components/OrderCalculator";
import SocialShare from "./components/SocialShare";
import ProductInquiryCart from "./components/ProductInquiryCart";

interface ProductDetailClientProps {
  readonly product: Product | null;
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

export default function ProductDetailClient({ product }: Readonly<ProductDetailClientProps>) {
  // --- UI & Localizer States ---
  const [lang, setLang] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("preferred_lang") || "tr";
    }
    return "tr";
  });
  const [isLangOpen, setIsLangOpen] = useState<boolean>(false);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string>("");

  // --- Multi-Currency States ---
  const [displayCurrency, setDisplayCurrency] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("merter_preferred_currency") || "TRY";
    }
    return "TRY";
  });
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);

  const handleCurrencyChange = (curr: string) => {
    setDisplayCurrency(curr);
    localStorage.setItem("merter_preferred_currency", curr);
  };

  // --- B2B Selection States ---
  const [selectedColor] = useState<string>(() => {
    return product?.color || "Standart";
  });
  const [pkgQty, setPkgQty] = useState<number>(() => {
    if (!product) return 1;
    const unitsPerPkg = getUnitsFromSeriesRatio(product.series_ratio);
    const minPkgs = Math.ceil(product.minimum_order_quantity / unitsPerPkg);
    return Math.max(minPkgs, 1);
  });

  // --- Shared Cart Persistent State ---
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window !== "undefined") {
      const savedCart = localStorage.getItem("merter_b2b_cart");
      if (savedCart) {
        try {
          return JSON.parse(savedCart) as CartItem[];
        } catch (err) {
          console.error("Failed to parse cart storage", err);
        }
      }
    }
    return [];
  });

  // --- Quote inquiry form states ---
  const [fullName, setFullName] = useState<string>("");
  const [companyName, setCompanyName] = useState<string>("");
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [emailAddress, setEmailAddress] = useState<string>("");
  const [customerMessage, setCustomerMessage] = useState<string>("");
  const [submittingInquiry, setSubmittingInquiry] = useState<boolean>(false);
  const [whatsappUrl, setWhatsappUrl] = useState<string>("");
  const [showSuccessOverlay, setShowSuccessOverlay] = useState<boolean>(false);
  const [pendingRemove, setPendingRemove] = useState<{ index: number; change: number } | null>(null);

  // Sync lang to document element
  useEffect(() => {
    if (typeof window !== "undefined") {
      document.documentElement.setAttribute("lang", lang);
    }
  }, [lang]);

  // Dynamic browser title synchronization when language changes
  useEffect(() => {
    if (product) {
      const localizedTitle = getProductTitle(product, lang);
      const brandName = product.brand_name || "Merter Manufacturer";
      document.title = `${localizedTitle} - ${brandName} | Merter Vitrini Toptan B2B`;
    }
  }, [lang, product]);

  // Initial mount loaders for categories and rates
  useEffect(() => {
    const loadCategories = async () => {
      const data = await apiFetch<Category[]>("/categories");
      if (data) setCategories(data);
    };

    const loadRates = async () => {
      const data = await apiFetch<ExchangeRate[]>("/exchange-rates");
      if (data) setExchangeRates(data);
    };

    void loadRates();
    void loadCategories();
  }, []);

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
          <Link 
            href="/" 
            className="px-8 py-3 bg-[#a855f7] text-white rounded-[5px] font-extrabold text-xs tracking-[0.5px] uppercase hover:bg-[#1c191f] transition-all cursor-pointer shadow-md no-underline"
          >
            {t("back_to_homepage", lang)}
          </Link>
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
  const hasSeries = !!(product.series_ratio && unitsPerPkg > 1);

  const seriesParts = product.series_ratio?.split("-") || [];
  const sizes = seriesParts.map((p) => p.split("=")[0] || p);
  const ratios = seriesParts.map((p) => p.split("=")[1] || "1");

  const minPkgs = Math.ceil(product.minimum_order_quantity / unitsPerPkg);
  const actualMinPkgs = Math.max(minPkgs, 1);

  // Single unit price & discount calculation
  const unitPrice = convertPrice(product.price, product.currency || "USD", displayCurrency, exchangeRates);
  const hasDiscount = product.discounted_price > 0 && product.discounted_price < product.price;
  const discountedPrice = hasDiscount
    ? convertPrice(product.discounted_price, product.currency || "USD", displayCurrency, exchangeRates)
    : unitPrice;

  // Order summary calculations
  const totalPieces = pkgQty * unitsPerPkg;
  const singleItemWeight = Number(product.shipping_weight_kg) || 0.25;
  const totalWeight = Number((totalPieces * singleItemWeight).toFixed(2));
  const finalPricePerUnit = hasDiscount ? discountedPrice : unitPrice;
  const totalPrice = finalPricePerUnit * totalPieces;
  const currency = displayCurrency;

  // Package quantity adjustments
  const handleAdjustPkgQty = (change: number) => {
    setPkgQty((prev) => Math.max(actualMinPkgs, prev + change));
  };

  // Add configured item to cart
  const handleAddToCart = () => {
    if (pkgQty < actualMinPkgs) {
      triggerToast(
        `${t("min_order_warning", lang) || "Minimum sipariş miktarı"}: ${product.minimum_order_quantity} ${t("piece", lang)} (${actualMinPkgs} ${t("package", lang)})`
      );
      return;
    }

    const coverImg = product.images?.find((img) => img.is_cover)?.image_url || product.images?.[0]?.image_url || "/placeholder.png";

    const newItem: CartItem = {
      product_id: product.id,
      title,
      custom_sku: product.custom_sku || product.source_product_id || "",
      color: selectedColor,
      packages_qty: pkgQty,
      units_per_package: unitsPerPkg,
      price_per_unit: finalPricePerUnit,
      weight_per_unit: singleItemWeight,
      image_url: coverImg,
      currency,
      slug: product.slug,
    };

    setCart((prev) => {
      const existingIdx = prev.findIndex((item) => item.product_id === newItem.product_id && item.color === newItem.color);
      let updated: CartItem[];
      if (existingIdx >= 0) {
        updated = [...prev];
        const existing = updated[existingIdx];
        const updatedPkgs = existing.packages_qty + newItem.packages_qty;

        updated[existingIdx] = {
          ...existing,
          packages_qty: updatedPkgs,
        };
      } else {
        updated = [...prev, newItem];
      }

      if (typeof window !== "undefined") {
        localStorage.setItem("merter_b2b_cart", JSON.stringify(updated));
      }
      return updated;
    });

    setIsCartOpen(true);
    triggerToast(t("product_added_to_cart", lang) || "Ürün sepete eklendi!");
  };

  // Adjust cart item quantities
  const handleAdjustCartItemQty = (idx: number, change: number) => {
    const item = cart[idx];
    if (!item) return;

    if (change < 0 && item.packages_qty <= 1) {
      setPendingRemove({ index: idx, change });
      return;
    }

    applyCartItemQtyChange(idx, change);
  };

  const applyCartItemQtyChange = (idx: number, change: number) => {
    setCart((prev) => {
      const updated = [...prev];
      const item = updated[idx];
      if (!item) return prev;

      const nextPkgs = item.packages_qty + change;
      if (nextPkgs <= 0) {
        updated.splice(idx, 1);
      } else {
        updated[idx] = {
          ...item,
          packages_qty: nextPkgs,
        };
      }

      if (typeof window !== "undefined") {
        localStorage.setItem("merter_b2b_cart", JSON.stringify(updated));
      }
      return updated;
    });
  };

  const confirmRemove = () => {
    if (pendingRemove) {
      applyCartItemQtyChange(pendingRemove.index, pendingRemove.change);
      setPendingRemove(null);
    }
  };

  const handleRemoveCartItem = (idx: number) => {
    setCart((prev) => {
      const updated = prev.filter((_, i) => i !== idx);
      if (typeof window !== "undefined") {
        localStorage.setItem("merter_b2b_cart", JSON.stringify(updated));
      }
      return updated;
    });
  };

  // Submit Quote Inquiry
  const handleSubmitInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    setSubmittingInquiry(true);
    try {
      const payload = {
        full_name: fullName,
        company_name: companyName,
        phone_number: phoneNumber,
        email_address: emailAddress,
        customer_message: customerMessage,
        display_currency: displayCurrency,
        cart_items: cart,
        total_price: totalPriceCart,
        total_pieces: totalItemsCount,
        total_weight: totalWeightCart,
        lang,
      };

      const res = await fetch("/api/v1/store/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Talep gönderilemedi.");
      }

      // Generate WhatsApp order message for buyer
      let waMsg = `*MERTER VITRINI B2B SIPARIS TALEBI*\n`;
      waMsg += `Talep No: #${data.inquiry_id || "NEW"}\n`;
      waMsg += `Yetkili: ${fullName}\n`;
      waMsg += `Firma: ${companyName || "-"}\n`;
      waMsg += `Telefon: ${phoneNumber}\n`;
      waMsg += `Toplam Kalem: ${cart.length} çeşit\n`;
      waMsg += `Toplam Adet: ${totalItemsCount} adet\n`;
      waMsg += `Toplam Tutar: ${totalPriceCart.toFixed(2)} ${displayCurrency}\n`;
      waMsg += `----------------------------\n`;
      cart.forEach((cItem, i) => {
        const itemPieces = cItem.packages_qty * cItem.units_per_package;
        const itemTotal = itemPieces * cItem.price_per_unit;
        waMsg += `${i + 1}. ${cItem.title} (${cItem.color}) - ${cItem.packages_qty} Paket (${itemPieces} Adet) -> ${itemTotal.toFixed(2)} ${displayCurrency}\n`;
      });
      if (customerMessage) {
        waMsg += `----------------------------\nNot: ${customerMessage}`;
      }

      const encodedWa = `https://wa.me/905337030883?text=${encodeURIComponent(waMsg)}`;
      setWhatsappUrl(encodedWa);

      // Clear local cart
      setCart([]);
      if (typeof window !== "undefined") {
        localStorage.removeItem("merter_b2b_cart");
      }
      setIsCartOpen(false);
      setShowSuccessOverlay(true);
    } catch (err: unknown) {
      console.error(err);
      triggerToast((err as Error).message || "Talep gönderimi sırasında bir hata oluştu.");
    } finally {
      setSubmittingInquiry(false);
    }
  };

  // Cart summary aggregations
  const totalPkgs = cart.reduce((sum, item) => sum + item.packages_qty, 0);
  const totalItemsCount = cart.reduce((sum, item) => sum + (item.packages_qty * item.units_per_package), 0);
  const totalWeightCart = Number(cart.reduce((sum, item) => sum + (item.packages_qty * item.units_per_package * item.weight_per_unit), 0).toFixed(2));
  const totalPriceCart = Number(cart.reduce((sum, item) => sum + (item.packages_qty * item.units_per_package * item.price_per_unit), 0).toFixed(2));

  // Structured Data (JSON-LD) for SEO
  const jsonLdData = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": title,
    "description": desc,
    "image": product.images?.map((img) => img.image_url) || [],
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
    .replace(/</g, String.raw`\u003c`)
    .replace(/>/g, String.raw`\u003e`);

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
          <Link href="/" className="hover:text-salmon-pink flex items-center gap-1 transition-colors no-underline text-sonic-silver">
            <Home className="w-3.5 h-3.5" />
            <span>{t("home", lang)}</span>
          </Link>
          {product.category_id && getCategoryTrail(categories, product.category_id)?.map((cat) => (
            <React.Fragment key={cat.id}>
              <ChevronRight className="w-3 h-3 text-spanish-gray" />
              <Link 
                href={getCategoryUrl(categories, cat, lang)}
                className="hover:text-salmon-pink transition-colors no-underline text-sonic-silver font-bold"
              >
                {getCategoryTitle(cat, lang)}
              </Link>
            </React.Fragment>
          ))}
          <ChevronRight className="w-3 h-3 text-spanish-gray" />
          <span className="text-salmon-pink font-extrabold truncate max-w-[200px]">
            {title}
          </span>
        </nav>

        {/* Product Details Display Grid */}
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

      {pendingRemove !== null && (
        <ConfirmModal
          lang={lang}
          message={t("remove_from_cart_confirm", lang) || "Sepetten komple kaldırılacaktır onaylıyor musunuz?"}
          onConfirm={confirmRemove}
          onCancel={() => setPendingRemove(null)}
        />
      )}
    </div>
  );
}
