"use client";

import React, { useState, useRef } from "react";
import Image from "next/image";
import { Product } from "@/types/store";
import {
  buildLocalizedProductHref,
  getProductTitle,
  pickLangText,
  SupportedLangCode,
  t,
} from "@/app/i18n";
import { getUnitsFromSeriesRatio, convertPrice, getResizedImageUrl, ExchangeRate, trackWhatsappClick } from "@/app/utils";
import { useIsStoreAuthenticated, openStoreAuthModal, getShortMemberPriceLabel } from "@/app/storeAuth";
import { Heart, ShoppingBag, Eye, ChevronLeft, ChevronRight, Lock, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useWishlistStore } from "@/store/useWishlistStore";
import { formatAsciiSafeUpper } from "@/utils/formatters";
import {
  isProductWhatsappOnly,
  getWhatsappOrderingCopy,
  buildProductWhatsappOrderLink,
} from "@/utils/whatsappOrdering";

interface ProductCardProps {
  readonly product: Product;
  readonly lang: string;
  readonly onOpenModal: (productId: string) => void;
  readonly priority?: boolean;
  readonly displayCurrency?: string;
  readonly exchangeRates?: readonly ExchangeRate[];
  readonly sortBy?: string;
}

interface CardUiLabels {
  addToCart: string;
  colorsSuffix: string;
  discountSuffix: string;
  quickView: string;
  addToFavorites: string;
  imageLabel: string;
  loginToSeePrice: string;
}

const CARD_UI_LABELS: Record<SupportedLangCode, CardUiLabels> = {
  tr: {
    addToCart: "Sepete Ekle",
    colorsSuffix: "Renk",
    discountSuffix: "İNDİRİM",
    quickView: "Hızlı İncele",
    addToFavorites: "Favorilerime Ekle",
    imageLabel: "Görsel",
    loginToSeePrice: "Üye Girişi Yap / Fiyat Gör",
  },
  en: {
    addToCart: "Add to Cart",
    colorsSuffix: "Colors",
    discountSuffix: "OFF",
    quickView: "Quick View",
    addToFavorites: "Add to Favorites",
    imageLabel: "Image",
    loginToSeePrice: "Login to See Price",
  },
  ru: {
    addToCart: "В корзину",
    colorsSuffix: "Цветов",
    discountSuffix: "СКИДКА",
    quickView: "Быстрый просмотр",
    addToFavorites: "В избранное",
    imageLabel: "Фото",
    loginToSeePrice: "Войдите, чтобы увидеть цену",
  },
  ar: {
    addToCart: "أضف إلى السلة",
    colorsSuffix: "ألوان",
    discountSuffix: "خصم",
    quickView: "معاينة سريعة",
    addToFavorites: "أضف إلى المفضلة",
    imageLabel: "صورة",
    loginToSeePrice: "سجل الدخول لرؤية السعر",
  },
  de: {
    addToCart: "In den Warenkorb",
    colorsSuffix: "Farben",
    discountSuffix: "RABATT",
    quickView: "Schnellansicht",
    addToFavorites: "Zu Favoriten hinzufügen",
    imageLabel: "Bild",
    loginToSeePrice: "Anmelden, um Preis zu sehen",
  },
  fr: {
    addToCart: "Ajouter au panier",
    colorsSuffix: "Couleurs",
    discountSuffix: "REMISE",
    quickView: "Aperçu rapide",
    addToFavorites: "Ajouter aux favoris",
    imageLabel: "Image",
    loginToSeePrice: "Connectez-vous pour voir le prix",
  },
  pl: {
    addToCart: "Dodaj do koszyka",
    colorsSuffix: "Kolory",
    discountSuffix: "RABAT",
    quickView: "Szybki podgląd",
    addToFavorites: "Dodaj do ulubionych",
    imageLabel: "Zdjęcie",
    loginToSeePrice: "Zaloguj się, aby zobaczyć cenę",
  },
  bg: {
    addToCart: "Добави в количката",
    colorsSuffix: "Цвята",
    discountSuffix: "ОТСТЪПКА",
    quickView: "Бърз преглед",
    addToFavorites: "Добави в любими",
    imageLabel: "Снимка",
    loginToSeePrice: "Влезте, за да видите цената",
  },
};

function getColorText(product: Product, lang: string): string {
  if (!product.color_variants || product.color_variants.length === 0) {
    return "";
  }
  const totalColors = product.color_variants.length;
  const suffix = pickLangText(lang, CARD_UI_LABELS).colorsSuffix;
  return `+${totalColors} ${suffix}`;
}

function formatPackingRatio(ratio: string, lang: string): string {
  if (ratio.toUpperCase() === "STANDART") {
    return t("Standart", lang).toUpperCase();
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

function ProductCardPriceBlock({
  isAuthenticated,
  isWhatsappOnly,
  showPriceUnknown,
  hasDiscount,
  origPrice,
  discPrice,
  price,
  currency,
  lang,
}: Readonly<{
  isAuthenticated: boolean;
  isWhatsappOnly: boolean;
  showPriceUnknown: boolean;
  hasDiscount: boolean;
  origPrice: number;
  discPrice: number;
  price: string;
  currency: string;
  lang: string;
}>) {
  if (isWhatsappOnly) {
    const waCopy = getWhatsappOrderingCopy(lang);
    return (
      <div className="flex flex-col items-end gap-0.5 text-right max-w-full">
        {showPriceUnknown && (
          <span className="text-[10px] font-bold text-[#6B6B6B] select-none">
            {waCopy.priceUnknownLabel}
          </span>
        )}
        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-[#166534] bg-[#F0FDF4] border border-[#BBF7D0] px-2 py-0.5 rounded leading-tight max-w-full">
          <MessageCircle className="w-3 h-3 text-[#15803D] shrink-0" />
          <span className="truncate">{waCopy.priceBadge}</span>
        </span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#6E542E] select-none">
        <Lock className="w-3 h-3 text-[#8C6D3F] shrink-0" />
        <span className="truncate">{getShortMemberPriceLabel(lang)}</span>
      </span>
    );
  }

  if (hasDiscount) {
    return (
      <>
        <span className="text-[11px] text-sonic-silver line-through font-normal">
          {origPrice.toFixed(2)} {currency}
        </span>
        <span className="text-xs font-bold text-[#A30000]">
          {discPrice.toFixed(2)} {currency}
        </span>
      </>
    );
  }

  return <span className="text-xs font-bold text-eerie-black">{price}</span>;
}

export default function ProductCard({
  product,
  lang,
  onOpenModal,
  priority = false,
  displayCurrency,
  exchangeRates,
  sortBy,
}: Readonly<ProductCardProps>) {
  const title = getProductTitle(product, lang);
  const cardLabels = pickLangText(lang, CARD_UI_LABELS);
  const productHref = buildLocalizedProductHref(product.slug || product.id, lang);
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
        setActiveImgIndex((prev) => (prev + 1) % displayImages.length);
      } else {
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

  const isAuthenticated = useIsStoreAuthenticated();
  const isWhatsappOnly = isProductWhatsappOnly(product);
  const waCopy = getWhatsappOrderingCopy(lang);
  const showPriceUnknown = sortBy === "price_asc" || sortBy === "price_desc";
  const waOrderLink = isWhatsappOnly
    ? buildProductWhatsappOrderLink({
        product,
        lang,
        title,
      })
    : null;
  const displayImages = getSortedProductImages(product);
  const units = getUnitsFromSeriesRatio(product.series_ratio);
  const colorText = getColorText(product, lang);
  const btnText = cardLabels.addToCart;
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
          href={productHref}
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
                href={productHref}
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
              aria-label={t("prev", lang)}
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
              aria-label={t("next_image", lang)}
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
                aria-label={`${cardLabels.imageLabel} ${idx + 1}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setActiveImgIndex(idx);
                }}
                className="flex-grow h-3 -my-1 py-1 relative cursor-pointer focus:outline-none bg-transparent border-none p-0 group/bar"
              >
                <div className="w-full h-[2px] bg-[#E0E0E0] relative overflow-hidden transition-all group-hover/bar:h-[3px]">
                  <div
                    className={`absolute inset-0 bg-black transition-opacity duration-200 ${activeImgIndex === idx ? "opacity-100" : "opacity-0"
                      }`}
                  />
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Discount Badge (Only for authenticated members & priced suppliers) */}
        {!isWhatsappOnly && isAuthenticated && hasDiscount && (
          <span className="absolute top-3 left-3 bg-[#A30000] text-white text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-none z-10 pointer-events-none">
            {discountPct}% {cardLabels.discountSuffix}
          </span>
        )}

        {/* Gender Badge */}
        {(isWhatsappOnly || !isAuthenticated || !hasDiscount) && product.gender && (
          <span className="absolute top-3 left-3 bg-white border border-black/10 text-onyx text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-none z-10 pointer-events-none">
            {t(product.gender, lang)}
          </span>
        )}

        {/* Color Variants Badge */}
        {colorText && (
          <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm border border-black/5 px-2.5 py-1 flex items-center gap-1.5 z-10 rounded-none shadow-none select-none group-hover:opacity-0 transition-opacity duration-200 pointer-events-none">
            <div className="flex">
              <span className="w-2.5 h-2.5 rounded-full border border-white bg-[#1C1C1C] shadow-sm" />
              <span className="w-2.5 h-2.5 rounded-full border border-white bg-[#8C6D3F] shadow-sm -ml-1.5" />
            </div>
            <span className="text-[9.5px] font-bold text-[#1C1C1C] tracking-wide uppercase">
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
            title={cardLabels.quickView}
            aria-label={cardLabels.quickView}
          >
            <Eye className="w-4 h-4" />
          </button>

          <button
            type="button"
            className={`w-9 h-9 border rounded-none flex items-center justify-center shadow-none transition-all cursor-pointer animate-in fade-in duration-200 ${isFavorite
                ? "bg-black border-black text-white hover:bg-black"
                : "bg-white border-black/10 text-onyx hover:bg-black hover:text-white hover:border-black"
              }`}
            onClick={toggleFavorite}
            title={cardLabels.addToFavorites}
            aria-label={cardLabels.addToFavorites}
          >
            <Heart className={`w-4 h-4 ${isFavorite ? "fill-white" : ""}`} />
          </button>
        </div>
      </div>

      {/* 2. Visual Details Section */}
      <div className="p-3 flex flex-col gap-1 flex-grow">
        <span className="text-[10px] font-bold tracking-[1.5px] text-[#1C1C1C] block mb-0.5">
          {formatAsciiSafeUpper(product.brand_name || t("merter_manufacturer", lang))}
        </span>

        <h3 className="text-xs font-normal text-onyx line-clamp-2 min-h-[34px] leading-relaxed transition-colors duration-150 group-hover:text-black">
          <Link href={productHref} className="hover:underline text-inherit">
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
          <ProductCardPriceBlock
            isAuthenticated={isAuthenticated}
            isWhatsappOnly={isWhatsappOnly}
            showPriceUnknown={showPriceUnknown}
            hasDiscount={hasDiscount}
            origPrice={origPrice}
            discPrice={discPrice}
            price={price}
            currency={currency}
            lang={lang}
          />
        </div>

        {isWhatsappOnly ? (
          <a
            href={waOrderLink?.url || "#"}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              e.stopPropagation();
              trackWhatsappClick({
                brandId: product.brand_id,
                productId: product.id,
                sourceSurface: "product_card",
                targetPhone: waOrderLink?.targetPhone,
              });
            }}
            className="mt-3 relative z-10 w-full bg-[#15803D] hover:bg-[#166534] text-white text-[10px] sm:text-[11px] font-bold uppercase py-2 sm:py-2.5 px-2 sm:px-3 rounded-md transition-colors duration-200 flex items-center justify-center gap-1.5 active:scale-[0.98] shadow-none select-none no-underline tracking-wider"
          >
            <MessageCircle className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{waCopy.ctaButton}</span>
          </a>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!isAuthenticated) {
                openStoreAuthModal("login");
                return;
              }
              const unitsPerPkg = getUnitsFromSeriesRatio(product.series_ratio);
              const minPkgs = Math.max(1, Math.ceil((product.minimum_order_quantity || 1) / (unitsPerPkg || 1)));
              window.dispatchEvent(
                new CustomEvent("merter-add-to-cart", {
                  detail: { product, quantity: minPkgs },
                })
              );
            }}
            className="mt-3 relative z-10 w-full bg-[#1C1C1C] hover:bg-[#333333] text-white text-[10px] sm:text-[11px] font-bold uppercase py-2 sm:py-2.5 px-2 sm:px-4 rounded-md transition-colors duration-200 flex items-center justify-center gap-1.5 active:scale-[0.98] shadow-none select-none border-none cursor-pointer tracking-wider"
          >
            {isAuthenticated ? (
              <>
                <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
                <span>{btnText}</span>
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5 shrink-0" />
                <span>{cardLabels.loginToSeePrice}</span>
              </>
            )}
          </button>
        )}
      </div>
    </article>
  );
}
