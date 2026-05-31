"use client";

import React from "react";
import Link from "next/link";
import { Product } from "@/types/store";
import { getProductTitle, t } from "@/app/i18n";
import { getUnitsFromSeriesRatio, convertPrice } from "@/app/utils";
import { Heart, ShoppingBag, Eye, Star } from "lucide-react";

interface ProductCardProps {
  product: Product;
  lang: string;
  onOpenModal: (productId: string) => void;
  priority?: boolean;
  displayCurrency?: string;
  exchangeRates?: any[];
}

const addToCartTranslations: Record<string, string> = {
  tr: "Sepete Ekle",
  en: "Add to Cart",
  ar: "أضف إلى السلة",
  ru: "В корзину",
  pl: "Dodaj do koszyka",
  bg: "Добави в количката",
  de: "In den Warenkorb",
  fr: "Ajouter au panier"
};

export default function ProductCard({
  product,
  lang,
  onOpenModal,
  priority = false,
  displayCurrency,
  exchangeRates,
}: ProductCardProps) {
  const title = getProductTitle(product, lang);
  
  let coverImg = "/placeholder.png";
  if (product.images && product.images.length > 0) {
    const coverObj = product.images.find((img) => img.is_cover) || product.images[0];
    coverImg = coverObj.image_url;
  }

  let hoverImg = "";
  if (product.images && product.images.length > 1) {
    hoverImg = product.images.at(1)?.image_url || "";
  }
  
  const units = getUnitsFromSeriesRatio(product.series_ratio);
  
  let price = "0.00 TL";
  let hasDiscount = false;
  let origPrice = 0.0;
  let discPrice = 0.0;
  let discountPct = 0;
  let currency = displayCurrency || product.currency || "TRY";
  
  if (product) {
    const rawOrigPrice = product.price || 0.0;
    const rawDiscPrice = product.discounted_price || 0.0;
    hasDiscount = product.discounted_price < product.price && product.discounted_price > 0;
    
    if (hasDiscount) {
      discountPct = Math.round(((product.price - product.discounted_price) / product.price) * 100);
    }
    
    if (displayCurrency && exchangeRates && exchangeRates.length > 0) {
      origPrice = convertPrice(rawOrigPrice, product.currency, displayCurrency, exchangeRates);
      discPrice = convertPrice(rawDiscPrice, product.currency, displayCurrency, exchangeRates);
    } else {
      origPrice = rawOrigPrice;
      discPrice = rawDiscPrice;
      currency = product.currency || "TRY";
    }

    price = hasDiscount 
      ? `${discPrice.toFixed(2)} ${currency}` 
      : `${origPrice.toFixed(2)} ${currency}`;
  }

  let btnText = addToCartTranslations.en;
  if (lang === "tr") btnText = addToCartTranslations.tr;
  else if (lang === "ar") btnText = addToCartTranslations.ar;
  else if (lang === "ru") btnText = addToCartTranslations.ru;
  else if (lang === "pl") btnText = addToCartTranslations.pl;
  else if (lang === "bg") btnText = addToCartTranslations.bg;
  else if (lang === "de") btnText = addToCartTranslations.de;
  else if (lang === "fr") btnText = addToCartTranslations.fr;

  return (
    <Link 
      href={`/product/${product.slug || product.id}`}
      className="bg-white rounded-[15px] overflow-hidden flex flex-col h-full cursor-pointer relative border border-cultured group select-none shadow-sm hover:shadow-premium transition-all duration-300 block text-inherit no-underline"
    >
      {/* 1. Visual Image Container with double-image hover swap */}
      <div className="relative aspect-[4/5] overflow-hidden bg-[#fafafa]">
        {/* Primary Image */}
        <img 
          src={coverImg} 
          alt={title}
          className={`w-full h-full object-contain transition-all duration-500 ease-out group-hover:scale-105 ${
            hoverImg ? "group-hover:opacity-0" : ""
          }`}
          loading={priority ? undefined : "lazy"}
          fetchPriority={priority ? "high" : undefined}
        />
        
        {/* Secondary Image for Hover Swap */}
        {hoverImg && (
          <img 
            src={hoverImg} 
            alt={title}
            className="absolute inset-0 w-full h-full object-contain opacity-0 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500 ease-out"
            loading={priority ? undefined : "lazy"}
          />
        )}

        {/* Discount Badge */}
        {hasDiscount && (
          <span className="absolute top-3 left-3 bg-salmon-pink text-white text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-[5px] shadow-sm z-10">
            {discountPct}% {lang === "tr" ? "İndirim" : "Off"}
          </span>
        )}

        {/* Gender Badge */}
        {!hasDiscount && product.gender && (
          <span className="absolute top-3 left-3 bg-white border border-cultured text-onyx text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-[5px] shadow-sm z-10">
            {t(product.gender, lang)}
          </span>
        )}

        {/* Action buttons overlay */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 translate-x-3 group-hover:translate-x-0 transition-all duration-300 z-10">
          <button 
            type="button"
            className="w-9 h-9 bg-white border border-cultured rounded-[5px] flex items-center justify-center shadow-sm text-onyx hover:bg-eerie-black hover:text-white hover:border-eerie-black transition-all cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onOpenModal(product.id);
            }}
          >
            <Eye className="w-4 h-4" />
          </button>
          <button 
            type="button"
            className="w-9 h-9 bg-white border border-cultured rounded-[5px] flex items-center justify-center shadow-sm text-onyx hover:bg-eerie-black hover:text-white hover:border-eerie-black transition-all cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onOpenModal(product.id);
            }}
          >
            <ShoppingBag className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* 2. Visual Details Section */}
      <div className="p-4 flex flex-col gap-1.5 flex-grow">
        {/* Brand label */}
        <span className="text-[10px] uppercase font-bold tracking-[0.5px] text-salmon-pink block">
          {product.brand_name || "Merter Manufacturer"}
        </span>
        
        {/* Product Title */}
        <h3 className="text-xs font-bold text-onyx line-clamp-2 min-h-[34px] leading-relaxed transition-colors duration-150 group-hover:text-salmon-pink">
          {title}
        </h3>

        {/* Gold Rating Stars */}
        <div className="flex items-center gap-0.5 text-sandy-brown">
          <Star className="w-3 h-3 fill-current" />
          <Star className="w-3 h-3 fill-current" />
          <Star className="w-3 h-3 fill-current" />
          <Star className="w-3 h-3 fill-current" />
          <Star className="w-3 h-3 fill-current" />
        </div>
        
        {/* B2B Specs */}
        <div className="flex flex-col gap-2 mt-1.5 text-[11px] font-semibold text-sonic-silver">
          <div className="flex flex-wrap gap-1 text-[10.5px]">
            <span>{units} {t("piece", lang)} / {t("package", lang)}</span>
            <span>•</span>
            <span>{t("min_order_qty", lang)}: {product.minimum_order_quantity} {t("piece", lang)}</span>
          </div>
          {product.packing_ratio && (
            <div className="mt-1 py-1.5 px-2.5 bg-zinc-50 border border-cultured rounded-[8px] flex items-center justify-between transition-colors duration-150 hover:bg-[#fff5f6] hover:border-salmon-pink/30 shadow-sm">
              <span className="text-[9px] uppercase tracking-wider text-sonic-silver font-extrabold">
                {t("series_sizes", lang).replace(":", "").trim()}
              </span>
              <span className="text-[12.5px] font-black text-eerie-black tracking-wide">
                {product.packing_ratio.toUpperCase() === "STANDART" ? (lang === "tr" ? "STANDART" : "STANDARD") : product.packing_ratio.split(",").join(" - ")}
              </span>
            </div>
          )}
        </div>
        
        {/* Pricing structure */}
        <div className="flex items-baseline gap-2 mt-auto pt-3 border-t border-cultured">
          {hasDiscount ? (
            <>
              <span className="text-[11px] text-sonic-silver line-through font-medium">
                {origPrice.toFixed(2)} {currency}
              </span>
              <span className="text-sm font-extrabold text-eerie-black">
                {discPrice.toFixed(2)} {currency}
              </span>
            </>
          ) : (
            <span className="text-sm font-extrabold text-eerie-black">
              {price}
            </span>
          )}
        </div>

        {/* Direct Add to Cart Button */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const unitsPerPkg = getUnitsFromSeriesRatio(product.series_ratio);
            const minPkgs = Math.max(1, Math.ceil((product.minimum_order_quantity || 1) / (unitsPerPkg || 1)));
            window.dispatchEvent(
              new CustomEvent("merter-add-to-cart", {
                detail: { product, quantity: minPkgs }
              })
            );
          }}
          className="mt-3 w-full bg-salmon-pink hover:bg-eerie-black text-white text-[11px] font-extrabold uppercase py-2.5 px-4 rounded-[8px] transition-all duration-300 flex items-center justify-center gap-2 active:scale-[0.98] shadow-sm select-none border-none cursor-pointer"
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>{btnText}</span>
        </button>
      </div>
    </Link>
  );
}
