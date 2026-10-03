"use client";

import React, { useState, useRef } from "react";
import Image from "next/image";
import { Product } from "@/types/store";
import { getProductTitle, t } from "@/app/i18n";
import { getUnitsFromSeriesRatio, convertPrice, getResizedImageUrl, ExchangeRate } from "@/app/utils";
import { Heart, ShoppingBag, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useWishlistStore } from "@/store/useWishlistStore";

interface ProductCardProps {
  readonly product: Product;
  readonly lang: string;
  readonly onOpenModal: (productId: string) => void;
  readonly priority?: boolean;
  readonly displayCurrency?: string;
  readonly exchangeRates?: readonly ExchangeRate[];
}

const addToCartTranslations: Record<string, string> = {
  tr: "Sepete Ekle",
  en: "Add to Cart",
  ar: "أضف إلى السلة",
  ru: "В корзину",
  pl: "Dodaj do koszyka",
  bg: "Добави в количката",
  de: "In den Warenkorb",
  fr: "Ajouter au panier",
};

function getAddToCartText(lang: string): string {
  return addToCartTranslations[lang] || addToCartTranslations.en;
}

function getColorText(product: Product, lang: string): string {
  if (!product.color_variants || product.color_variants.length === 0) {
    return "";
  }
  const totalColors = product.color_variants.length;
  if (lang === "tr") return `+${totalColors} Renk`;
  if (lang === "ru") return `+${totalColors} Цветов`;
  if (lang === "ar") return `+${totalColors} ألوان`;
  return `+${totalColors} Colors`;
}

function formatPackingRatio(ratio: string, lang: string): string {
  if (ratio.toUpperCase() === "STANDART") {
    return lang === "tr" ? "STANDART" : "STANDARD";
  }
  return ratio.split(",").join(" - ");
}

interface ProductPricing {
  hasDiscount: boolean;
  discountPct: number;
  origPrice: number;
  discPrice: number;
  price: string;
  currency: string;
}

function calculateProductPricing(
  product: Product,
  displayCurrency: string | undefined,
  exchangeRates: readonly ExchangeRate[] | undefined
): ProductPricing {
  const rawOrigPrice = product.price || 0.0;
  const rawDiscPrice = product.discounted_price || 0.0;
  const hasDiscount = product.discounted_price < product.price && product.discounted_price > 0;
  const discountPct = hasDiscount
    ? Math.round(((product.price - product.discounted_price) / product.price) * 100)
    : 0;

  let origPrice = rawOrigPrice;
  let discPrice = rawDiscPrice;
  let currency = product.currency || "TRY";

  if (displayCurrency && exchangeRates && exchangeRates.length > 0) {
    origPrice = convertPrice(rawOrigPrice, product.currency, displayCurrency, [...exchangeRates]);
    discPrice = convertPrice(rawDiscPrice, product.currency, displayCurrency, [...exchangeRates]);
    currency = displayCurrency;
  }

  const price = hasDiscount
    ? `${discPrice.toFixed(2)} ${currency}`
    : `${origPrice.toFixed(2)} ${currency}`;

  return {
    hasDiscount,
    discountPct,
    origPrice,
    discPrice,
    price,
    currency,
  };
}

function getSortedProductImages(product: Product): string[] {
  const cardImages = product.images && product.images.length > 0 ? product.images : [];
  const coverIndex = cardImages.findIndex((img) => img.is_cover);
  const sorted = [...cardImages];
  if (coverIndex > 0) {
    const coverObj = sorted.splice(coverIndex, 1)[0];
    sorted.unshift(coverObj);
  }
  return sorted.length > 0
    ? sorted.slice(0, 5).map((img) => getResizedImageUrl(img.image_url, 288, 385))
    : ["/placeholder.png"];
}

export default function ProductCard({
  product,
  lang,
  onOpenModal,
  priority = false,
  displayCurrency,
  exchangeRates,
}: Readonly<ProductCardProps>) {
  const title = getProductTitle(product, lang);
  const isFavorite = useWishlistStore((state) => state.wishlistIds.includes(product.id));
  const toggleWishlist = useWishlistStore((state) => state.toggleWishlist);

  const [activeImgIndex, setActiveImgIndex] = useState<number>(0);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchDeltaX = useRef<number>(0);
  const isSwiping = useRef<boolean>(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchDeltaX.current = 0;
    isSwiping.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - touchStartX.current;
    const deltaY = currentY - touchStartY.current;

    touchDeltaX.current = deltaX;

    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
      isSwiping.current = true;
    }
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null) return;
    const deltaX = touchDeltaX.current;

    if (isSwiping.current && Math.abs(deltaX) > 30 && displayImages.length > 1) {
      if (deltaX < 0) {
        // Swiped left -> next image
        setActiveImgIndex((prev) => (prev + 1) % displayImages.length);
      } else {
        // Swiped right -> previous image
        setActiveImgIndex((prev) => (prev - 1 + displayImages.length) % displayImages.length);
      }
    }

    touchStartX.current = null;
    touchStartY.current = null;
    touchDeltaX.current = 0;
    setTimeout(() => {
      isSwiping.current = false;
    }, 150);
  };

  const toggleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(product.id, title, lang);
  };

  const displayImages = getSortedProductImages(product);
  const units = getUnitsFromSeriesRatio(product.series_ratio);
  const colorText = getColorText(product, lang);
  const btnText = getAddToCartText(lang);
  const { hasDiscount, discountPct, origPrice, discPrice, price, currency } = calculateProductPricing(
    product,
    displayCurrency,
    exchangeRates
  );

  return (
    <article className="bg-white rounded-none overflow-hidden flex flex-col h-full cursor-pointer relative border-none group select-none shadow-none transition-all duration-300 block text-inherit no-underline">
      {/* 1. Visual Image Container with mobile touch swipe & desktop hover switcher */}
      <div
        className="relative aspect-[4/5] overflow-hidden bg-[#fafafa] touch-pan-y"
        onMouseLeave={() => setActiveImgIndex(0)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Active Image Link */}
        <Link
          href={`/product/${product.slug || product.id}`}
          tabIndex={-1}
          aria-hidden="true"
          onClick={(e) => {
            if (isSwiping.current) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
          className="absolute inset-0 block z-0"
        >
          <Image
            src={displayImages[activeImgIndex] || "/placeholder.png"}
            alt={title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            priority={priority}
            className="object-contain transition-all duration-300 ease-out group-hover:scale-102"
          />
        </Link>

        {/* Desktop-only vertical hover zones overlays (hidden on mobile, z-15) */}
        {displayImages.length > 1 && (
          <div className="hidden md:flex absolute inset-0 z-15">
            {displayImages.map((imgUrl, idx) => (
              <Link
                key={`zone-${product.id}-${imgUrl}`}
                href={`/product/${product.slug || product.id}`}
                tabIndex={-1}
                aria-hidden="true"
                className="flex-grow h-full cursor-pointer block"
                onMouseEnter={() => setActiveImgIndex(idx)}
              />
            ))}
          </div>
        )}

        {/* Mobile touch navigation chevrons (md:hidden, z-25) */}
        {displayImages.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Önceki Görsel"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setActiveImgIndex((prev) => (prev - 1 + displayImages.length) % displayImages.length);
              }}
              className="md:hidden absolute left-1.5 top-1/2 -translate-y-1/2 z-25 w-7 h-7 rounded-full bg-white/90 shadow-sm border border-black/10 flex items-center justify-center text-onyx active:scale-90 transition-transform cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              aria-label="Sonraki Görsel"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setActiveImgIndex((prev) => (prev + 1) % displayImages.length);
              }}
              className="md:hidden absolute right-1.5 top-1/2 -translate-y-1/2 z-25 w-7 h-7 rounded-full bg-white/90 shadow-sm border border-black/10 flex items-center justify-center text-onyx active:scale-90 transition-transform cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}

        {/* Segmented horizontal indicator bars at the bottom with touch-friendly tap hit area (z-20) */}
        {displayImages.length > 1 && (
          <div className="absolute bottom-2.5 left-3.5 right-3.5 flex gap-1 z-20">
            {displayImages.map((imgUrl, idx) => (
              <button
                key={`bar-${product.id}-${imgUrl}`}
                type="button"
                aria-label={`Görsel ${idx + 1}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setActiveImgIndex(idx);
                }}
                className="flex-grow h-3 -my-1 py-1 relative cursor-pointer focus:outline-none bg-transparent border-none p-0 group/bar"
              >
                <div className="w-full h-[2px] bg-[#E0E0E0] relative overflow-hidden transition-all group-hover/bar:h-[3px]">
                  <div
                    className={`absolute inset-0 bg-black transition-opacity duration-200 ${
                      activeImgIndex === idx ? "opacity-100" : "opacity-0"
                    }`}
                  />
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Discount Badge */}
        {hasDiscount && (
          <span className="absolute top-3 left-3 bg-[#A30000] text-white text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-none z-10 pointer-events-none">
            {discountPct}% {lang === "tr" ? "İNDİRİM" : "OFF"}
          </span>
        )}

        {/* Gender Badge */}
        {!hasDiscount && product.gender && (
          <span className="absolute top-3 left-3 bg-white border border-black/10 text-onyx text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-none z-10 pointer-events-none">
            {t(product.gender, lang)}
          </span>
        )}

        {/* Color Variants Badge */}
        {colorText && (
          <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm border border-black/5 px-2.5 py-1 flex items-center gap-1.5 z-10 rounded-none shadow-none select-none group-hover:opacity-0 transition-opacity duration-200 pointer-events-none">
            <div className="flex">
              <span className="w-2.5 h-2.5 rounded-full border border-white bg-indigo-500 shadow-sm" />
              <span className="w-2.5 h-2.5 rounded-full border border-white bg-purple-500 shadow-sm -ml-1.5" />
            </div>
            <span className="text-[9.5px] font-bold text-black tracking-wide uppercase">
              {colorText}
            </span>
          </div>
        )}

        {/* Action buttons overlay (z-30 to ensure clickability above overlay) */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 translate-x-3 group-hover:translate-x-0 transition-all duration-300 z-30">
          <button
            type="button"
            className="w-9 h-9 bg-white border border-black/10 rounded-none flex items-center justify-center shadow-none text-onyx hover:bg-black hover:text-white hover:border-black transition-all cursor-pointer animate-in fade-in duration-200"
            onClick={(e) => {
              e.stopPropagation();
              onOpenModal(product.id);
            }}
            title={lang === "tr" ? "Hızlı İncele" : "Quick View"}
          >
            <Eye className="w-4 h-4" />
          </button>

          <button
            type="button"
            className={`w-9 h-9 border rounded-none flex items-center justify-center shadow-none transition-all cursor-pointer animate-in fade-in duration-200 ${
              isFavorite
                ? "bg-black border-black text-white hover:bg-black"
                : "bg-white border-black/10 text-onyx hover:bg-black hover:text-white hover:border-black"
            }`}
            onClick={toggleFavorite}
            title={lang === "tr" ? "Favorilerime Ekle" : "Add to Favorites"}
          >
            <Heart className={`w-4 h-4 ${isFavorite ? "fill-white" : ""}`} />
          </button>
        </div>
      </div>

      {/* 2. Visual Details Section */}
      <div className="p-3 flex flex-col gap-1 flex-grow">
        <span className="text-[10px] uppercase font-bold tracking-[1.5px] text-black block mb-0.5">
          {product.brand_name || "Merter Manufacturer"}
        </span>

        <h3 className="text-xs font-normal text-onyx line-clamp-2 min-h-[34px] leading-relaxed transition-colors duration-150 group-hover:text-black">
          <Link href={`/product/${product.slug || product.id}`} className="hover:underline text-inherit">
            {title}
          </Link>
        </h3>

        <div className="flex flex-col gap-1.5 mt-1.5 text-[11px] font-normal text-sonic-silver">
          <div className="flex flex-wrap gap-1 text-[10.5px]">
            <span>{units} {t("piece", lang)} / {t("package", lang)}</span>
            <span>•</span>
            <span>{t("min_order_qty", lang)}: {product.minimum_order_quantity} {t("piece", lang)}</span>
          </div>
          {product.packing_ratio && (
            <div className="mt-1 py-1 px-2 bg-neutral-50 border border-cultured rounded-none flex items-center justify-between transition-colors duration-150 hover:bg-neutral-100 hover:border-black/15 shadow-none">
              <span className="text-[8px] uppercase tracking-wider text-sonic-silver font-bold">
                {t("series_sizes", lang).replace(":", "").trim()}
              </span>
              <span className="text-[10.5px] font-bold text-eerie-black tracking-wide">
                {formatPackingRatio(product.packing_ratio, lang)}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-baseline justify-end gap-2 mt-auto pt-2 border-t border-cultured">
          {hasDiscount ? (
            <>
              <span className="text-[11px] text-sonic-silver line-through font-normal">
                {origPrice.toFixed(2)} {currency}
              </span>
              <span className="text-xs font-bold text-[#A30000]">
                {discPrice.toFixed(2)} {currency}
              </span>
            </>
          ) : (
            <span className="text-xs font-bold text-eerie-black">
              {price}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const unitsPerPkg = getUnitsFromSeriesRatio(product.series_ratio);
            const minPkgs = Math.max(1, Math.ceil((product.minimum_order_quantity || 1) / (unitsPerPkg || 1)));
            window.dispatchEvent(
              new CustomEvent("merter-add-to-cart", {
                detail: { product, quantity: minPkgs },
              })
            );
          }}
          className="mt-3 relative z-10 w-full bg-black hover:bg-neutral-800 text-white text-[10px] sm:text-[11px] font-bold uppercase py-2 sm:py-2.5 px-2 sm:px-4 rounded-none transition-all duration-300 flex items-center justify-center gap-1.5 active:scale-[0.98] shadow-none select-none border-none cursor-pointer tracking-wider"
        >
          <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
          <span>{btnText}</span>
        </button>
      </div>
    </article>
  );
}
