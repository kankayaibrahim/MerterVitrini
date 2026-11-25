"use client";

import React from "react";
import Image from "next/image";
import { X, ShoppingBag, Plus, Minus, ChevronLeft, ChevronRight, MessageCircle, Phone, Lock, Play, Maximize2 } from "lucide-react";
import { Product } from "@/types/store";
import { getProductCoverImageUrl, isVideoMedia, isVideoMediaUrl } from "@/utils/media";
import {
  buildLocalizedProductHref,
  getProductAttributes,
  getProductDescription,
  getProductTitle,
  pickLangText,
  SupportedLangCode,
  t,
  translateColor,
} from "@/app/i18n";
import {
  getUnitsFromSeriesRatio,
  convertPrice,
  getResizedImageUrl,
  showToast,
  ExchangeRate,
  normalizeWhatsappDigits,
  trackBrandEvent,
  trackWhatsappClick,
} from "@/app/utils";
import { useIsStoreAuthenticated, openStoreAuthModal, getMemberPriceLabel, getShortMemberPriceLabel } from "@/app/storeAuth";
import { formatAsciiSafeUpper } from "@/utils/formatters";
import {
  isProductWhatsappOnly,
  getWhatsappOrderingCopy,
  buildProductWhatsappOrderLink,
  formatDualProductSku,
} from "@/utils/whatsappOrdering";
import { getDirectSellerNoticeCopy } from "@/utils/legalNotices";
import { SafeHtml, PRODUCT_DESCRIPTION_HTML_CLASS } from "@/components/common/SafeHtml";

interface ModalLocalizedTexts {
  selectMinOneItem: string;
  whatsappWriteSupplier: string;
  callSupplier: string;
  waGreetingPrefix: string;
  waOrderIntro: string;
  waInquiryIntro: string;
  waQtyLabel: string;
  waTotalLabel: string;
}

const MODAL_LOCALIZED_TEXTS: Record<SupportedLangCode, ModalLocalizedTexts> = {
  tr: {
    selectMinOneItem: "Lütfen en az 1 ürün seçin.",
    whatsappWriteSupplier: "WhatsApp ile Tedarikçiye Yaz",
    callSupplier: "Ara",
    waGreetingPrefix: "Merhaba",
    waOrderIntro: "Merter Vitrini üzerindeki ürününüz hakkında doğrudan iletişime geçmek ve sipariş vermek istiyorum.",
    waInquiryIntro: "Merter Vitrini üzerindeki ürününüz hakkında doğrudan iletişime geçmek ve fiyat bilgisi almak istiyorum.",
    waQtyLabel: "Miktar",
    waTotalLabel: "Toplam Tutar",
  },
  en: {
    selectMinOneItem: "Please select at least 1 item.",
    whatsappWriteSupplier: "Message Supplier on WhatsApp",
    callSupplier: "Call",
    waGreetingPrefix: "Hello",
    waOrderIntro: "I would like to contact you directly and place a wholesale order for your product on Merter Vitrini.",
    waInquiryIntro: "I would like to contact you directly and request wholesale pricing for your product on Merter Vitrini.",
    waQtyLabel: "Quantity",
    waTotalLabel: "Total Amount",
  },
  ru: {
    selectMinOneItem: "Пожалуйста, выберите минимум 1 товар.",
    whatsappWriteSupplier: "Написать поставщику в WhatsApp",
    callSupplier: "Позвонить",
    waGreetingPrefix: "Здравствуйте",
    waOrderIntro: "Хочу связаться с вами напрямую и оформить оптовый заказ на ваш товар на Merter Vitrini.",
    waInquiryIntro: "Хочу связаться с вами напрямую и уточнить оптовую цену на ваш товар на Merter Vitrini.",
    waQtyLabel: "Количество",
    waTotalLabel: "Итоговая сумма",
  },
  ar: {
    selectMinOneItem: "يرجى اختيار منتج واحد على الأقل.",
    whatsappWriteSupplier: "مراسلة المورد عبر واتساب",
    callSupplier: "اتصال",
    waGreetingPrefix: "مرحباً",
    waOrderIntro: "أود التواصل معكم مباشرة وتقديم طلب جملة لمنتجكم على Merter Vitrini.",
    waInquiryIntro: "أود التواصل معكم مباشرة والاستفسار عن سعر الجملة لمنتجكم على Merter Vitrini.",
    waQtyLabel: "الكمية",
    waTotalLabel: "المبلغ الإجمالي",
  },
  de: {
    selectMinOneItem: "Bitte wählen Sie mindestens 1 Artikel aus.",
    whatsappWriteSupplier: "Lieferant per WhatsApp kontaktieren",
    callSupplier: "Anrufen",
    waGreetingPrefix: "Hallo",
    waOrderIntro: "Ich möchte Sie direkt kontaktieren und eine Großhandelsbestellung für Ihr Produkt auf Merter Vitrini aufgeben.",
    waInquiryIntro: "Ich möchte Sie direkt kontaktieren und Großhandelspreise für Ihr Produkt auf Merter Vitrini anfragen.",
    waQtyLabel: "Menge",
    waTotalLabel: "Gesamtbetrag",
  },
  fr: {
    selectMinOneItem: "Veuillez sélectionner au moins 1 article.",
    whatsappWriteSupplier: "Écrire au fournisseur sur WhatsApp",
    callSupplier: "Appeler",
    waGreetingPrefix: "Bonjour",
    waOrderIntro: "Je souhaite vous contacter directement et passer une commande en gros pour votre produit sur Merter Vitrini.",
    waInquiryIntro: "Je souhaite vous contacter directement et demander le tarif de gros pour votre produit sur Merter Vitrini.",
    waQtyLabel: "Quantité",
    waTotalLabel: "Montant total",
  },
  pl: {
    selectMinOneItem: "Proszę wybrać co najmniej 1 produkt.",
    whatsappWriteSupplier: "Napisz do dostawcy na WhatsApp",
    callSupplier: "Zadzwoń",
    waGreetingPrefix: "Dzień dobry",
    waOrderIntro: "Chcę skontaktować się bezpośrednio i złożyć zamówienie hurtowe na Państwa produkt na Merter Vitrini.",
    waInquiryIntro: "Chcę skontaktować się bezpośrednio i zapytać o cenę hurtową Państwa produktu na Merter Vitrini.",
    waQtyLabel: "Ilość",
    waTotalLabel: "Kwota całkowita",
  },
  bg: {
    selectMinOneItem: "Моля, изберете поне 1 артикул.",
    whatsappWriteSupplier: "Пишете на доставчика в WhatsApp",
    callSupplier: "Обади се",
    waGreetingPrefix: "Здравейте",
    waOrderIntro: "Искам да се свържа директно с вас и да направя поръчка на едро за вашия продукт в Merter Vitrini.",
    waInquiryIntro: "Искам да се свържа директно с вас и да попитам за цената на едро за вашия продукт в Merter Vitrini.",
    waQtyLabel: "Количество",
    waTotalLabel: "Обща сума",
  },
};

function buildSupplierWhatsAppMessage(params: {
  lang: string;
  isAuthenticated: boolean;
  supplierName: string;
  title: string;
  sku: string;
  pkgQty: number;
  totalPieces: number;
  totalPrice: number;
  currency: string;
}): string {
  const txt = pickLangText(params.lang, MODAL_LOCALIZED_TEXTS);
  const pkgWord = t("package", params.lang);
  const pieceWord = t("piece", params.lang);
  const intro = params.isAuthenticated ? txt.waOrderIntro : txt.waInquiryIntro;
  const baseLines = [
    `${txt.waGreetingPrefix} *${params.supplierName}*,`,
    `*${params.title}* (SKU: ${params.sku}) — ${intro}`,
    "",
    `• ${txt.waQtyLabel}: ${params.pkgQty} ${pkgWord} (${params.totalPieces} ${pieceWord})`,
  ];
  if (params.isAuthenticated) {
    baseLines.push(`• ${txt.waTotalLabel}: ${params.totalPrice.toFixed(2)} ${params.currency}`);
  }
  return baseLines.join("\n");
}

function ModalUnitPriceValue({
  isAuthenticated,
  isWhatsappOnly,
  hasDiscount,
  unitPrice,
  discountedPrice,
  currency,
  lang,
}: Readonly<{
  isAuthenticated: boolean;
  isWhatsappOnly: boolean;
  hasDiscount: boolean;
  unitPrice: number;
  discountedPrice: number;
  currency: string;
  lang: string;
}>) {
  if (isWhatsappOnly) {
    const waCopy = getWhatsappOrderingCopy(lang);
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#166534] bg-[#F0FDF4] border border-[#BBF7D0] px-2.5 py-1 rounded">
        <MessageCircle className="w-3.5 h-3.5 text-[#15803D] shrink-0" />
        <span>{waCopy.priceBadge}</span>
      </span>
    );
  }

  if (!isAuthenticated) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6E542E]">
        <Lock className="w-3.5 h-3.5 text-[#8C6D3F] shrink-0" />
        <span>{getMemberPriceLabel(lang)}</span>
      </span>
    );
  }

  if (hasDiscount) {
    return (
      <div className="flex items-baseline gap-2">
        <span className="text-xs text-sonic-silver line-through">
          {unitPrice.toFixed(2)} {currency}
        </span>
        <span className="text-lg font-extrabold text-[#A30000]">
          {discountedPrice.toFixed(2)} {currency}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-baseline gap-2">
      <span className="text-lg font-extrabold text-[#1C1C1C]">
        {unitPrice.toFixed(2)} {currency}
      </span>
    </div>
  );
}

interface ProductDetailsModalProps {
  readonly product: Product;
  readonly lang: string;
  readonly onClose: () => void;
  readonly selectedColor?: string;
  readonly setSelectedColor?: (color: string) => void;
  readonly pkgQty: number;
  readonly setPkgQty: (qty: number | ((prev: number) => number)) => void;
  readonly modalMainImg: string;
  readonly setModalMainImg: (imgUrl: string) => void;
  readonly onAddToCart: (seriesQty: number, singleQtys: Record<string, number>) => void;
  readonly showSinglePrice?: boolean;
  readonly displayCurrency?: string;
  readonly exchangeRates?: readonly ExchangeRate[];
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

function resolveModalPricing(
  product: Product,
  displayCurrency: string | undefined,
  exchangeRates: readonly ExchangeRate[] | undefined,
  unitsPerPkg: number
) {
  const rawUnitPrice = product.price || 0.0;
  const rawDiscountedPrice = product.discounted_price || 0.0;
  const hasDiscount =
    product.discounted_price < product.price && product.discounted_price > 0;

  let unitPrice = rawUnitPrice;
  let discountedPrice = rawDiscountedPrice;
  let currency = displayCurrency || product.currency || "TRY";

  if (displayCurrency && exchangeRates && exchangeRates.length > 0) {
    unitPrice = convertPrice(
      rawUnitPrice,
      product.currency,
      displayCurrency,
      [...exchangeRates]
    );
    discountedPrice = convertPrice(
      rawDiscountedPrice,
      product.currency,
      displayCurrency,
      [...exchangeRates]
    );
  } else {
    currency = product.currency || "TRY";
  }

  const finalPricePerUnit = hasDiscount ? discountedPrice : unitPrice;
  const finalPkgPrice = unitsPerPkg * finalPricePerUnit;

  return { unitPrice, discountedPrice, currency, hasDiscount, finalPkgPrice };
}

function resolveModalDirectWhatsAppUrl(
  waOrderLinkUrl: string | undefined,
  supplierWaDigits: string,
  message: string
): string {
  if (waOrderLinkUrl) {
    return waOrderLinkUrl;
  }
  if (!supplierWaDigits) {
    return "";
  }
  return `https://wa.me/${supplierWaDigits}?text=${encodeURIComponent(message)}`;
}

function ModalTotalPriceValue({
  isWhatsappOnly,
  isAuthenticated,
  waPriceBadge,
  totalPrice,
  currency,
  lang,
}: Readonly<{
  isWhatsappOnly: boolean;
  isAuthenticated: boolean;
  waPriceBadge: string;
  totalPrice: number;
  currency: string;
  lang: string;
}>) {
  if (isWhatsappOnly) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-extrabold text-[#166534] bg-[#F0FDF4] border border-[#BBF7D0] px-2 py-0.5 rounded">
        <MessageCircle className="w-3.5 h-3.5 text-[#15803D] shrink-0" />
        <span>{waPriceBadge}</span>
      </span>
    );
  }

  if (isAuthenticated) {
    return (
      <span>
        {totalPrice.toFixed(2)} {currency}
      </span>
    );
  }

  return (
    <span className="text-xs font-bold text-[#6E542E]">
      {getShortMemberPriceLabel(lang)}
    </span>
  );
}

function ModalLightboxOverlay({
  images,
  title,
  lang,
  lightboxIndex,
  setLightboxIndex,
  onClose,
}: Readonly<{
  images: NonNullable<Product["images"]>;
  title: string;
  lang: string;
  lightboxIndex: number;
  setLightboxIndex: (idx: number | ((prev: number) => number)) => void;
  onClose: () => void;
}>) {
  React.useEffect(() => {
    const imageCount = images.length;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowRight") {
        setLightboxIndex((prev) => (prev + 1) % imageCount);
      } else if (e.key === "ArrowLeft") {
        setLightboxIndex((prev) => (prev - 1 + imageCount) % imageCount);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [images.length, onClose, setLightboxIndex]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex flex-col justify-between p-4 md:p-8 animate-in fade-in duration-200 select-none">
      {/* Top Bar */}
      <div className="flex justify-between items-center text-white w-full max-w-[1720px] mx-auto z-10">
        <span className="text-xs font-extrabold tracking-wider bg-white/10 px-3.5 py-1.5 rounded-[5px]">
          {lightboxIndex + 1} / {images.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("close_modal", lang)}
          className="w-10 h-10 rounded-[5px] bg-white/10 hover:bg-white/20 hover:scale-105 border border-white/10 flex items-center justify-center text-white cursor-pointer transition-all active:scale-95"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Visualizer Area */}
      <div className="flex-grow flex items-center justify-center relative w-full max-w-5xl mx-auto my-4">
        {images.length > 1 && (
          <button
            type="button"
            aria-label={t("prev", lang)}
            onClick={(e) => {
              e.stopPropagation();
              setLightboxIndex((prev) => (prev - 1 + images.length) % images.length);
            }}
            className="absolute left-2 md:left-4 z-20 w-11 h-11 rounded-[5px] bg-white/10 hover:bg-white/20 hover:scale-105 flex items-center justify-center text-white cursor-pointer transition-all border border-white/10 active:scale-95"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        <button
          type="button"
          aria-label={t("close_modal", lang)}
          tabIndex={-1}
          className="absolute inset-0 bg-transparent border-none cursor-default z-0"
          onClick={onClose}
        />

        <div className="w-full h-full flex items-center justify-center p-2 relative z-10 pointer-events-none">
          {isVideoMedia(images.at(lightboxIndex)) ? (
            <video
              key={images.at(lightboxIndex)?.image_url}
              src={images.at(lightboxIndex)?.image_url || ""}
              poster={getProductCoverImageUrl(images, "") || undefined}
              controls
              autoPlay
              playsInline
              preload="metadata"
              controlsList="nodownload"
              className="max-w-full max-h-[70vh] md:max-h-[75vh] rounded-[8px] shadow-2xl pointer-events-auto bg-black"
            >
              <track kind="captions" />
            </video>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={images.at(lightboxIndex)?.image_url || ""}
              alt={title}
              className="max-w-full max-h-[70vh] md:max-h-[75vh] object-contain rounded-[8px] shadow-2xl transition-all duration-300 transform scale-100 ease-out pointer-events-auto"
            />
          )}
        </div>

        {images.length > 1 && (
          <button
            type="button"
            aria-label={t("next_image", lang)}
            onClick={(e) => {
              e.stopPropagation();
              setLightboxIndex((prev) => (prev + 1) % images.length);
            }}
            className="absolute right-2 md:right-4 z-20 w-11 h-11 rounded-[5px] bg-white/10 hover:bg-white/20 hover:scale-105 flex items-center justify-center text-white cursor-pointer transition-all border border-white/10 active:scale-95"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {images.length > 1 && (
        <div className="w-full max-w-3xl mx-auto flex gap-2 justify-center overflow-x-auto py-3 scrollbar-none z-10">
          {images.map((img, idx) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setLightboxIndex(idx)}
              className={`w-14 h-18 rounded-[4px] overflow-hidden shrink-0 border-2 cursor-pointer transition-all ${lightboxIndex === idx
                  ? "border-salmon-pink scale-105 shadow-md opacity-100"
                  : "border-transparent opacity-40 hover:opacity-100"
                }`}
            >
              {isVideoMedia(img) ? (
                <div className="w-full h-full bg-slate-900 flex items-center justify-center text-white">
                  <Play className="w-4 h-4 fill-white text-white" />
                </div>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={img.image_url} alt="thumb" className="w-full h-full object-cover" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProductDetailsModal({
  product,
  lang,
  onClose,
  pkgQty,
  setPkgQty,
  modalMainImg,
  setModalMainImg,
  onAddToCart,
  displayCurrency,
  exchangeRates,
}: Readonly<ProductDetailsModalProps>) {
  const isAuthenticated = useIsStoreAuthenticated();
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

  const {
    unitPrice,
    discountedPrice,
    currency,
    hasDiscount,
    finalPkgPrice,
  } = resolveModalPricing(product, displayCurrency, exchangeRates, unitsPerPkg);

  // Lightbox Image visualizer state variables
  const [isLightboxOpen, setIsLightboxOpen] = React.useState<boolean>(false);
  const [lightboxIndex, setLightboxIndex] = React.useState<number>(0);

  const handleOpenLightbox = () => {
    const idx = product.images?.findIndex(img => img.image_url === modalMainImg) ?? 0;
    setLightboxIndex(Math.max(idx, 0));
    setIsLightboxOpen(true);
  };

  const handleAdjustPkgQty = (change: number) => {
    const minPkgs = Math.ceil(product.minimum_order_quantity / unitsPerPkg);
    setPkgQty((prev) => {
      const next = prev + change;
      if (next < minPkgs) {
        showToast(`${t("minimum_order_alert", lang)} (${minPkgs} ${t("package", lang)})`);
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

  const modalTexts = pickLangText(lang, MODAL_LOCALIZED_TEXTS);
  const isWhatsappOnly = isProductWhatsappOnly(product);
  const waCopy = getWhatsappOrderingCopy(lang);
  const supplierName = product.brand_profile?.name || product.brand_name || t("merter_manufacturer", lang);
  const supplierWaRaw = product.brand_profile?.whatsapp_phone || product.brand_profile?.phone || "";
  const supplierCallRaw = product.brand_profile?.phone || product.brand_profile?.whatsapp_phone || "";
  const supplierWaDigits = normalizeWhatsappDigits(supplierWaRaw);
  const waOrderLink = isWhatsappOnly
    ? buildProductWhatsappOrderLink({
        product,
        lang,
        title,
        pkgQty,
        totalPieces,
        fallbackPhone: supplierWaRaw,
      })
    : null;
  const directWaMessage = buildSupplierWhatsAppMessage({
    lang,
    isAuthenticated: isAuthenticated && !isWhatsappOnly,
    supplierName,
    title,
    sku: formatDualProductSku(product.custom_sku, product.sku),
    pkgQty,
    totalPieces,
    totalPrice,
    currency,
  });
  const directWaUrl = resolveModalDirectWhatsAppUrl(
    waOrderLink?.url,
    supplierWaDigits,
    directWaMessage
  );

  const handleAddClick = () => {
    if (isWhatsappOnly) {
      return;
    }
    if (!isAuthenticated) {
      onClose();
      openStoreAuthModal("login");
      return;
    }
    if (totalPieces === 0) {
      showToast(modalTexts.selectMinOneItem);
      return;
    }
    onAddToCart(hasSeries ? pkgQty : 0, {});
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={t("close_modal", lang)}
        tabIndex={-1}
        className="fixed inset-0 bg-transparent border-none cursor-default"
        onClick={onClose}
      />
      <div className="bg-white border border-cultured rounded-[15px] max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-premium relative flex flex-col z-10 animate-in fade-in zoom-in-95 duration-200">

        <button
          type="button"
          onClick={onClose}
          aria-label={t("close_modal", lang)}
          className="absolute top-4 right-4 w-9 h-9 rounded-[5px] bg-[#fafafa] hover:bg-cultured border border-cultured flex items-center justify-center text-onyx cursor-pointer transition-colors z-10"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6 md:p-8 flex flex-col gap-6 md:gap-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">

            {/* Left side Image Gallery */}
            <div className="flex flex-col gap-3 md:max-w-[420px] w-full md:mx-auto">
              {(() => {
                const coverPoster = getProductCoverImageUrl(product.images, "");
                const activeMedia =
                  product.images?.find((img) => img.image_url === modalMainImg) ?? null;
                const isMainVideo = isVideoMedia(activeMedia) || isVideoMediaUrl(modalMainImg);

                return isMainVideo ? (
                  <div className="w-full aspect-[4/5] max-h-[400px] md:max-h-[520px] rounded-[10px] overflow-hidden bg-black border border-cultured relative shadow-inner flex items-center justify-center">
                    <video
                      key={modalMainImg}
                      src={modalMainImg}
                      poster={coverPoster || undefined}
                      controls
                      playsInline
                      preload="metadata"
                      controlsList="nodownload"
                      className="w-full h-full object-contain bg-black"
                    >
                      <track kind="captions" />
                    </video>
                    <button
                      type="button"
                      onClick={handleOpenLightbox}
                      aria-label={t("zoom_image", lang)}
                      className="absolute top-3 left-3 z-20 w-8 h-8 rounded-full bg-black/65 hover:bg-black/85 text-white border border-white/20 flex items-center justify-center cursor-pointer transition-colors"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleOpenLightbox}
                    aria-label={t("zoom_image", lang)}
                    className="w-full aspect-[4/5] max-h-[400px] md:max-h-[520px] rounded-[10px] overflow-hidden bg-[#fafafa] border border-cultured relative shadow-inner cursor-zoom-in group flex items-center justify-center p-0"
                  >
                    <Image
                      src={getResizedImageUrl(modalMainImg, 600, 800)}
                      alt={title}
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="object-contain transition-all duration-300 group-hover:scale-105"
                    />
                  </button>
                );
              })()}

              {product.images && product.images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto py-1">
                  {product.images.map((img) => {
                    const thumbIsVideo = isVideoMedia(img);
                    const coverPoster = getProductCoverImageUrl(product.images, "");
                    return (
                      <button
                        key={img.id}
                        type="button"
                        onClick={() => setModalMainImg(img.image_url)}
                        className={`relative w-14 h-18 rounded-[5px] overflow-hidden shrink-0 border-2 cursor-pointer transition-all ${modalMainImg === img.image_url
                            ? "border-salmon-pink scale-[1.02]"
                            : "border-transparent opacity-60 hover:opacity-100"
                          }`}
                      >
                        {thumbIsVideo ? (
                          <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center text-white relative">
                            {coverPoster && (
                              <Image
                                src={getResizedImageUrl(coverPoster, 80, 106)}
                                alt={title}
                                fill
                                sizes="56px"
                                className="object-cover opacity-50"
                              />
                            )}
                            <span className="relative z-10 w-5 h-5 rounded-full bg-black/75 border border-white/40 flex items-center justify-center">
                              <Play className="w-2.5 h-2.5 fill-white text-white ml-0.5" />
                            </span>
                          </div>
                        ) : (
                          <Image
                            src={getResizedImageUrl(img.image_url, 80, 106)}
                            alt={title}
                            fill
                            sizes="56px"
                            className="object-cover"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right side specifications and calculators */}
            <div className="flex flex-col gap-5">
              <div>
                <span className="text-[10px] font-bold tracking-[0.8px] text-[#8C6D3F]">
                  {formatAsciiSafeUpper(product.brand_name || t("merter_manufacturer", lang))}
                </span>
                <h2 className="font-sans font-extrabold text-xl md:text-2xl text-[#1C1C1C] leading-snug mt-1">
                  {title}
                </h2>
                <span className="text-[10px] font-bold text-[#6B6B6B] mt-1 block">
                  {t("sku_label", lang) || "SKU"}: {product.custom_sku || product.source_product_id}
                </span>
              </div>

              {/* pricing details */}
              <div className="flex items-center justify-between gap-3 bg-[#F8F6F2] border border-[#E5E0D8] rounded-md px-4 py-3">
                <span className="text-[10px] font-bold text-[#1C1C1C] uppercase tracking-[0.5px] shrink-0">
                  {t("unit_price_label", lang)}
                </span>
                <ModalUnitPriceValue
                  isAuthenticated={isAuthenticated}
                  isWhatsappOnly={isWhatsappOnly}
                  hasDiscount={hasDiscount}
                  unitPrice={unitPrice}
                  discountedPrice={discountedPrice}
                  currency={currency}
                  lang={lang}
                />
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
                    {product.minimum_order_quantity} {t("piece", lang)}
                  </span>
                </div>

                {/* Dynamic Attributes */}
                {dynamicAttrs?.map((attr) => (
                  <div key={`attr-${attr.name}`} className="border border-cultured rounded-[5px] p-2.5 bg-white flex flex-col gap-0.5 shadow-sm">
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
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={getResizedImageUrl(getProductCoverImageUrl(product.images), 80, 106)}
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
                  {product.color_variants?.map((sib) => (
                    <a
                      key={sib.id}
                      href={buildLocalizedProductHref(sib.slug || sib.id, lang)}
                      className="flex flex-col items-center gap-1.5 p-1.5 rounded-[8px] border-2 border-transparent bg-white hover:border-[#e2e8f0] transition-all hover:scale-[1.03] opacity-80 hover:opacity-100 cursor-pointer select-none"
                    >
                      <div className="w-12 h-14 rounded-[5px] overflow-hidden bg-[#f0f0f0] border border-cultured">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
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
                          <div key={`size-${sz}-${idx}`} className="border border-cultured bg-[#fafafa] rounded-[5px] px-3 py-2 flex items-center justify-between text-[11px] font-bold shadow-inner">
                            <span className="text-sonic-silver">{sz}</span>
                            <span className="text-salmon-pink">{count} {t("piece", lang)}</span>
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
                        type="button"
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
                        type="button"
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
                  <div className="flex justify-between items-center text-sm text-[#1C1C1C] font-extrabold pt-2 border-t border-[#E5E0D8] mt-1.5">
                    <span>{t("total_price_calc", lang)} ({t("excluding_vat", lang)}):</span>
                    <ModalTotalPriceValue
                      isWhatsappOnly={isWhatsappOnly}
                      isAuthenticated={isAuthenticated}
                      waPriceBadge={waCopy.priceBadge}
                      totalPrice={totalPrice}
                      currency={currency}
                      lang={lang}
                    />
                  </div>
                </div>
              </div>

              {/* Add To Cart or WhatsApp-Only CTA */}
              {isWhatsappOnly ? (
                <div className="flex flex-col sm:flex-row gap-2">
                  {directWaUrl && (
                    <a
                      href={directWaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() =>
                        trackWhatsappClick({
                          brandId: product.brand_id,
                          productId: product.id,
                          sourceSurface: "product_quick_modal",
                          targetPhone: waOrderLink?.targetPhone || supplierWaRaw,
                        })
                      }
                      className="flex-1 py-3 px-4 bg-[#15803D] hover:bg-[#166534] text-white rounded-md font-extrabold text-xs tracking-[0.4px] uppercase transition-colors flex items-center justify-center gap-2 no-underline"
                    >
                      <MessageCircle className="w-4 h-4 shrink-0" />
                      <span>{waCopy.ctaButton}</span>
                    </a>
                  )}
                  {supplierCallRaw && (
                    <a
                      href={`tel:${supplierCallRaw}`}
                      onClick={() => trackBrandEvent(product.brand_id, "phone_click", product.id)}
                      className="py-3 px-4 bg-[#1C1C1C] hover:bg-[#333333] text-white rounded-md font-extrabold text-xs transition-colors flex items-center justify-center gap-1.5 no-underline shrink-0"
                    >
                      <Phone className="w-3.5 h-3.5 shrink-0" />
                      <span>{modalTexts.callSupplier}</span>
                    </a>
                  )}
                </div>
              ) : (
                <>
                  {/* Add To Cart Trigger */}
                  <button
                    type="button"
                    onClick={handleAddClick}
                    className="w-full py-3 bg-[#1C1C1C] hover:bg-[#333333] text-white rounded-md font-extrabold text-xs tracking-[0.5px] uppercase transition-colors border-none flex items-center justify-center gap-2 cursor-pointer select-none active:scale-[0.99]"
                  >
                    {isAuthenticated ? (
                      <>
                        <ShoppingBag className="w-4 h-4 text-white" />
                        {t("add_to_cart", lang)}
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4 text-white" />
                        {getMemberPriceLabel(lang)}
                      </>
                    )}
                  </button>

                  {/* Direct Supplier WhatsApp & Call Actions */}
                  {(directWaUrl || supplierCallRaw) && (
                    <div className="flex flex-col sm:flex-row gap-2">
                      {directWaUrl && (
                        <a
                          href={directWaUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() =>
                            trackWhatsappClick({
                              brandId: product.brand_id,
                              productId: product.id,
                              sourceSurface: "product_quick_modal",
                              targetPhone: supplierWaRaw,
                            })
                          }
                          className="flex-1 py-2.5 px-3 bg-[#15803D] hover:bg-[#166534] text-white rounded-md font-extrabold text-xs tracking-[0.3px] transition-colors flex items-center justify-center gap-2 no-underline"
                        >
                          <MessageCircle className="w-4 h-4 shrink-0" />
                          <span>
                            {modalTexts.whatsappWriteSupplier} {supplierWaRaw ? `(${supplierWaRaw})` : ""}
                          </span>
                        </a>
                      )}
                      {supplierCallRaw && (
                        <a
                          href={`tel:${supplierCallRaw}`}
                          onClick={() => trackBrandEvent(product.brand_id, "phone_click", product.id)}
                          className="py-2.5 px-3.5 bg-[#1C1C1C] hover:bg-[#333333] text-white rounded-md font-extrabold text-xs transition-colors flex items-center justify-center gap-1.5 no-underline shrink-0"
                        >
                          <Phone className="w-3.5 h-3.5 shrink-0" />
                          <span>{modalTexts.callSupplier}</span>
                        </a>
                      )}
                    </div>
                  )}
                </>
              )}

              <div className="rounded-md bg-[#FAF7F2] border border-[#E5E0D8] px-3 py-2 text-[10.5px] leading-snug text-[#525252]">
                <strong className="text-[#1C1C1C]">{getDirectSellerNoticeCopy(lang).directSellerTag}:</strong>{" "}
                {getDirectSellerNoticeCopy(lang).buyerNotice}
              </div>

            </div>

          </div>

          {/* Bottom description overlay */}
          {desc.trim().length > 0 && (
            <div className="border-t border-cultured pt-6 mt-2">
              <h4 className="font-sans font-extrabold text-sm tracking-[0.5px] mb-2 uppercase text-eerie-black">
                {t("description_label", lang)}
              </h4>
              <SafeHtml
                html={desc}
                className={`text-xs ${PRODUCT_DESCRIPTION_HTML_CLASS}`}
              />
            </div>
          )}

        </div>

      </div>

      {/* C. LIGHTBOX PREMIUM IMAGE GALLERY POPUP */}
      {isLightboxOpen && product.images && product.images.length > 0 && (
        <ModalLightboxOverlay
          images={product.images}
          title={title}
          lang={lang}
          lightboxIndex={lightboxIndex}
          setLightboxIndex={setLightboxIndex}
          onClose={() => setIsLightboxOpen(false)}
        />
      )}
    </div>
  );
}
