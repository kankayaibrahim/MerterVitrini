"use client";

import React from "react";
import { X, ShoppingBag, Plus, Minus, ChevronLeft, ChevronRight } from "lucide-react";
import { Product } from "@/types/store";
import { t, getProductTitle, getProductDescription, getProductAttributes, translateColor } from "@/app/i18n";
import { getUnitsFromSeriesRatio, convertPrice, getResizedImageUrl } from "@/app/utils";

interface ProductDetailsModalProps {
  product: Product;
  lang: string;
  onClose: () => void;
  selectedColor: string;
  setSelectedColor: (color: string) => void;
  pkgQty: number;
  setPkgQty: (qty: number | ((prev: number) => number)) => void;
  modalMainImg: string;
  setModalMainImg: (imgUrl: string) => void;
  onAddToCart: (seriesQty: number, singleQtys: Record<string, number>) => void;
  showSinglePrice?: boolean;
  displayCurrency?: string;
  exchangeRates?: any[];
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

export default function ProductDetailsModal({
  product,
  lang,
  onClose,
  selectedColor,
  setSelectedColor,
  pkgQty,
  setPkgQty,
  modalMainImg,
  setModalMainImg,
  onAddToCart,
  showSinglePrice,
  displayCurrency,
  exchangeRates,
}: ProductDetailsModalProps) {
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

  // Separating variants
  const seriesVariants = product.variants?.filter((v) => !v.is_single) || [];

  // Lightbox Image visualizer state variables
  const [isLightboxOpen, setIsLightboxOpen] = React.useState<boolean>(false);
  const [lightboxIndex, setLightboxIndex] = React.useState<number>(0);

  const handleOpenLightbox = () => {
    const idx = product.images?.findIndex(img => img.image_url === modalMainImg) ?? 0;
    setLightboxIndex(idx >= 0 ? idx : 0);
    setIsLightboxOpen(true);
  };

  React.useEffect(() => {
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



  // Calculations
  const hasSeries = unitsPerPkg > 1;
  const totalSeriesPieces = hasSeries ? (pkgQty * unitsPerPkg) : 0;
  
  const totalPieces = totalSeriesPieces;
  const totalWeight = hasSeries ? (pkgQty * totalPkgWeight) : 0;
  const totalPrice = hasSeries ? (pkgQty * finalPkgPrice) : 0;

  const handleAddClick = () => {
    if (totalPieces === 0) {
      alert(lang === "tr" ? "Lütfen en az 1 ürün seçin." : "Please select at least 1 item.");
      return;
    }
    onAddToCart(hasSeries ? pkgQty : 0, {});
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div 
        className="fixed inset-0" 
        onClick={onClose}
      />
      <div className="bg-white border border-cultured rounded-[15px] max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-premium relative flex flex-col z-10 animate-in fade-in zoom-in-95 duration-200">
        
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 rounded-[5px] bg-[#fafafa] hover:bg-cultured border border-cultured flex items-center justify-center text-onyx cursor-pointer transition-colors z-10"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6 md:p-8 flex flex-col gap-6 md:gap-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            
            {/* Left side Image Gallery */}
            <div className="flex flex-col gap-3">
              <div 
                onClick={handleOpenLightbox}
                className="aspect-[4/5] rounded-[10px] overflow-hidden bg-[#fafafa] border border-cultured relative shadow-inner cursor-zoom-in group"
              >
                <img 
                  src={getResizedImageUrl(modalMainImg, 600, 800)} 
                  alt={title}
                  className="w-full h-full object-contain transition-all duration-300 group-hover:scale-105"
                />
              </div>
              
              {product.images && product.images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto py-1">
                  {product.images.map((img) => (
                    <button
                      key={img.id}
                      onClick={() => setModalMainImg(img.image_url)}
                      className={`w-14 h-18 rounded-[5px] overflow-hidden shrink-0 border-2 cursor-pointer transition-all ${
                        modalMainImg === img.image_url 
                          ? "border-salmon-pink scale-[1.02]" 
                          : "border-transparent opacity-60 hover:opacity-100"
                      }`}
                    >
                      <img src={getResizedImageUrl(img.image_url, 80, 106)} alt="thumb" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right side specifications and calculators */}
            <div className="flex flex-col gap-5">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-[0.5px] text-salmon-pink">
                  {product.brand_name || "Merter Manufacturer"}
                </span>
                <h2 className="font-sans font-extrabold text-xl md:text-2xl text-eerie-black leading-snug mt-1">
                  {title}
                </h2>
                <span className="text-[10px] font-bold text-sonic-silver mt-1 block">
                  {t("sku_label", lang) || "SKU"}: {product.custom_sku || product.source_product_id}
                </span>
              </div>

              {/* pricing details */}
              <div className="flex items-center gap-3 bg-[#fafafa] border border-cultured rounded-[5px] px-4 py-3 shadow-inner">
                <span className="text-[10px] font-bold text-onyx uppercase tracking-[0.5px] shrink-0">
                  {t("unit_price_label", lang)}
                </span>
                <div className="flex items-baseline gap-2">
                  {hasDiscount ? (
                    <>
                      <span className="text-xs text-sonic-silver line-through">
                        {unitPrice.toFixed(2)} {currency}
                      </span>
                      <span className="text-lg font-extrabold text-salmon-pink">
                        {discountedPrice.toFixed(2)} {currency}
                      </span>
                    </>
                  ) : (
                    <span className="text-lg font-extrabold text-eerie-black">
                      {unitPrice.toFixed(2)} {currency}
                    </span>
                  )}
                </div>
              </div>

              {/* Specs Table */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="border border-cultured rounded-[5px] p-2.5 bg-white flex flex-col gap-0.5 shadow-sm">
                  <span className="text-[9px] uppercase font-bold text-sonic-silver tracking-[0.5px]">{t("fabric", lang)}</span>
                  <span className="font-bold text-eerie-black truncate">{t(product.kumas_fabric || "Viskon / Pamuk", lang)}</span>
                </div>
                <div className="border border-cultured rounded-[5px] p-2.5 bg-white flex flex-col gap-0.5 shadow-sm">
                  <span className="text-[9px] uppercase font-bold text-sonic-silver tracking-[0.5px]">
                    {t("gender_spec", lang)} / {t("season_spec", lang)}
                  </span>
                  <span className="font-bold text-eerie-black truncate">
                    {t(product.gender || "Unisex", lang)} / {t(product.season || "Mevsimlik", lang)}
                  </span>
                </div>
                <div className="border border-cultured rounded-[5px] p-2.5 bg-white flex flex-col gap-0.5 shadow-sm">
                  <span className="text-[9px] uppercase font-bold text-sonic-silver tracking-[0.5px]">{t("desi", lang)}</span>
                  <span className="font-bold text-eerie-black">{(product.desi_volume || 2)} {t("desi_unit", lang)}</span>
                </div>
                <div className="border border-cultured rounded-[5px] p-2.5 bg-white flex flex-col gap-0.5 shadow-sm">
                  <span className="text-[9px] uppercase font-bold text-sonic-silver tracking-[0.5px]">{t("min_order_qty", lang)}</span>
                  <span className="font-bold text-eerie-black truncate">
                    {product.minimum_order_quantity} {lang === "tr" ? "Adet" : t("piece", lang)}
                  </span>
                </div>
                
                {/* Dynamic Attributes */}
                {dynamicAttrs && dynamicAttrs.map((attr, idx) => (
                  <div key={idx} className="border border-cultured rounded-[5px] p-2.5 bg-white flex flex-col gap-0.5 shadow-sm">
                    <span className="text-[9px] uppercase font-bold text-sonic-silver tracking-[0.5px] truncate">{t(attr.name, lang)}</span>
                    <span className="font-bold text-eerie-black truncate">{t(attr.value, lang)}</span>
                  </div>
                ))}
              </div>

              {/* Visual sibling colors color picker */}
              <div>
                <span className="block text-[10px] uppercase font-extrabold text-eerie-black mb-2 tracking-[0.5px]">
                  {t("available_colors", lang)}
                </span>
                <div className="flex gap-3 flex-wrap">
                  {/* Current viewed product */}
                  <div
                    className="flex flex-col items-center gap-1.5 p-1.5 rounded-[8px] border-2 bg-white transition-all scale-[1.03] shadow-sm border-salmon-pink select-none"
                  >
                    <div className="w-12 h-14 rounded-[5px] overflow-hidden bg-[#f0f0f0] border border-cultured relative">
                      <img 
                        src={getResizedImageUrl(product.images?.find(img => img.is_cover)?.image_url || product.images?.[0]?.image_url || "/placeholder.png", 80, 106)} 
                        alt={product.color || "Standart"} 
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
                          src={getResizedImageUrl(sib.image_url || "/placeholder.png", 80, 106)} 
                          alt={sib.color} 
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

              {/* A. SERIES PACK SALES SECTION */}
              {hasSeries && (
                <div className="flex flex-col gap-3 pt-3 border-t border-cultured">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase font-extrabold text-eerie-black tracking-[0.5px]">
                      📦 {t("series_sales_pack", lang)}
                    </span>
                    <span className="text-[10px] font-bold text-salmon-pink">
                      {unitsPerPkg} {t("piece", lang)} / {t("package", lang)}
                    </span>
                  </div>

                  {/* Series Asorti Breakdown */}
                  <div>
                    <span className="block text-[9px] uppercase font-bold text-sonic-silver mb-2 tracking-[0.5px]">
                      {t("pkg_content", lang)}
                    </span>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
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

                  {/* Series Counter */}
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



              {/* OVERALL ORDER COMPUTATIONS SUMMARY */}
              <div className="bg-[#fafafa] border border-cultured p-4 rounded-[10px] flex flex-col gap-3 shadow-inner mt-2">
                <span className="text-[10px] font-extrabold text-salmon-pink uppercase tracking-[0.5px] block">
                  {t("order_summary", lang)}
                </span>

                <div className="flex flex-col gap-1.5 text-xs font-bold text-onyx">
                  <div className="flex justify-between">
                    <span>{t("total_pieces_calc", lang)}:</span>
                    <span className="text-eerie-black">{totalPieces} {t("piece", lang)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t("total_weight_calc", lang)}:</span>
                    <span className="text-eerie-black">{totalWeight.toFixed(2)} {t("kg_unit", lang)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-salmon-pink font-extrabold pt-2 border-t border-cultured mt-1.5">
                    <span>{t("total_price_calc", lang)} ({t("excluding_vat", lang)}):</span>
                    <span>{totalPrice.toFixed(2)} {currency}</span>
                  </div>
                </div>
              </div>

              {/* Add To Cart Trigger */}
              <button
                onClick={handleAddClick}
                className="w-full py-3 bg-salmon-pink hover:bg-eerie-black text-white rounded-[5px] font-extrabold text-xs tracking-[0.5px] uppercase transition-all duration-300 border-none flex items-center justify-center gap-2 cursor-pointer select-none active:scale-[0.99]"
              >
                <ShoppingBag className="w-4 h-4 text-white" />
                {t("add_to_cart", lang)}
              </button>

            </div>

          </div>

          {/* Bottom description overlay */}
          <div className="border-t border-cultured pt-6 mt-2">
            <h4 className="font-sans font-extrabold text-sm tracking-[0.5px] mb-2 uppercase text-eerie-black">
              {t("description_label", lang)}
            </h4>
            <p className="text-xs text-sonic-silver leading-relaxed font-semibold whitespace-pre-line">
              {desc}
            </p>
          </div>

        </div>

      </div>

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
