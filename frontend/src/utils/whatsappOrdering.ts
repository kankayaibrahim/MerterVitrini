import type { Product } from "@/types/store";
import { t } from "@/app/i18n";
import { normalizeWhatsappDigits } from "@/app/utils";
import { normalizeSeoLang, SupportedSeoLang } from "@/utils/seoHelpers";

export const DEFAULT_PLATFORM_WHATSAPP_RAW = "+90 533 355 15 15";
export const DEFAULT_PLATFORM_WHATSAPP_DIGITS = "905333551515";

export interface WhatsAppOrderingCopy {
  readonly priceBadge: string;
  readonly ctaButton: string;
  readonly priceUnknown: string;
  readonly priceUnknownLabel: string;
  readonly priceRangeUnknownTitle: string;
  readonly priceRangeUnknownNote: string;
  readonly supplierBadge: string;
  readonly greetingPrefix: string;
  readonly inquiryIntro: string;
  readonly skuLabel: string;
  readonly colorLabel: string;
  readonly seriesLabel: string;
  readonly qtyLabel: string;
}

export const WHATSAPP_ORDERING_COPY: Record<
  SupportedSeoLang,
  WhatsAppOrderingCopy
> = {
  tr: {
    priceBadge: "Toptan Fiyat İçin WhatsApp'tan Ulaşın",
    ctaButton: "WhatsApp ile Sipariş Ver / Fiyat Al",
    priceUnknown: "Bilinmiyor",
    priceUnknownLabel: "Fiyat: Bilinmiyor",
    priceRangeUnknownTitle: "Fiyat Aralığı: Bilinmiyor",
    priceRangeUnknownNote:
      "Fiyatı bilinmeyen (yalnızca WhatsApp) ürünler fiyat aralığı filtresinde gösterilmez; sıralamada sonda listelenir.",
    supplierBadge: "Yalnızca WhatsApp Sipariş",
    greetingPrefix: "Merhaba",
    inquiryIntro:
      "Merter Vitrini üzerindeki ürününüz için toptan fiyat almak ve sipariş vermek istiyorum.",
    skuLabel: "SKU",
    colorLabel: "Renk",
    seriesLabel: "Seri / Bedenler",
    qtyLabel: "Miktar",
  },
  en: {
    priceBadge: "Contact via WhatsApp for Wholesale Price",
    ctaButton: "Order / Get Price via WhatsApp",
    priceUnknown: "Unknown",
    priceUnknownLabel: "Price: Unknown",
    priceRangeUnknownTitle: "Price Range: Unknown",
    priceRangeUnknownNote:
      "Products with unknown price (WhatsApp-only suppliers) are excluded from price range filtering and listed at the end when sorting by price.",
    supplierBadge: "WhatsApp Orders Only",
    greetingPrefix: "Hello",
    inquiryIntro:
      "I would like to request wholesale pricing and place an order for your product on Merter Vitrini.",
    skuLabel: "SKU",
    colorLabel: "Color",
    seriesLabel: "Series / Sizes",
    qtyLabel: "Quantity",
  },
  ru: {
    priceBadge: "Узнать оптовую цену в WhatsApp",
    ctaButton: "Заказать / Узнать цену в WhatsApp",
    priceUnknown: "Не указана",
    priceUnknownLabel: "Цена: не указана",
    priceRangeUnknownTitle: "Диапазон цен: не указан",
    priceRangeUnknownNote:
      "Товары с неуказанной ценой (заказ через WhatsApp) не отображаются в фильтре по цене и выводятся в конце при сортировке по цене.",
    supplierBadge: "Заказ только через WhatsApp",
    greetingPrefix: "Здравствуйте",
    inquiryIntro:
      "Хочу узнать оптовую цену и оформить заказ на ваш товар на Merter Vitrini.",
    skuLabel: "Артикул (SKU)",
    colorLabel: "Цвет",
    seriesLabel: "Серия / Размеры",
    qtyLabel: "Количество",
  },
  ar: {
    priceBadge: "تواصل عبر واتساب لمعرفة سعر الجملة",
    ctaButton: "اطلب / استفسر عن السعر عبر واتساب",
    priceUnknown: "غير محدد",
    priceUnknownLabel: "السعر: غير محدد",
    priceRangeUnknownTitle: "نطاق السعر: غير محدد",
    priceRangeUnknownNote:
      "المنتجات ذات السعر غير المحدد (الطلب عبر واتساب فقط) مستبعدة من تصفية السعر وتظهر في نهاية الترتيب.",
    supplierBadge: "الطلب عبر واتساب فقط",
    greetingPrefix: "مرحباً",
    inquiryIntro:
      "أود الاستفسار عن سعر الجملة وتقديم طلب لمنتجكم على Merter Vitrini.",
    skuLabel: "رمز المنتج (SKU)",
    colorLabel: "اللون",
    seriesLabel: "السيري / المقاسات",
    qtyLabel: "الكمية",
  },
  de: {
    priceBadge: "Großhandelspreis per WhatsApp anfragen",
    ctaButton: "Per WhatsApp bestellen / Preis anfragen",
    priceUnknown: "Unbekannt",
    priceUnknownLabel: "Preis: Unbekannt",
    priceRangeUnknownTitle: "Preisspanne: Unbekannt",
    priceRangeUnknownNote:
      "Artikel ohne Preisangabe (nur WhatsApp-Bestellung) werden beim Preisfilter ausgeschlossen und bei der Preissortierung am Ende gelistet.",
    supplierBadge: "Nur WhatsApp-Bestellung",
    greetingPrefix: "Hallo",
    inquiryIntro:
      "Ich möchte den Großhandelspreis anfragen und eine Bestellung für Ihr Produkt auf Merter Vitrini aufgeben.",
    skuLabel: "SKU",
    colorLabel: "Farbe",
    seriesLabel: "Serie / Größen",
    qtyLabel: "Menge",
  },
  fr: {
    priceBadge: "Contactez sur WhatsApp pour le prix de gros",
    ctaButton: "Commander / Demander le prix sur WhatsApp",
    priceUnknown: "Inconnu",
    priceUnknownLabel: "Prix : Inconnu",
    priceRangeUnknownTitle: "Fourchette de prix : Inconnue",
    priceRangeUnknownNote:
      "Les produits sans prix affiché (commande WhatsApp uniquement) sont exclus du filtre de prix et affichés en fin de tri.",
    supplierBadge: "Commande WhatsApp uniquement",
    greetingPrefix: "Bonjour",
    inquiryIntro:
      "Je souhaite connaître le tarif de gros et commander votre produit sur Merter Vitrini.",
    skuLabel: "SKU",
    colorLabel: "Couleur",
    seriesLabel: "Série / Tailles",
    qtyLabel: "Quantité",
  },
  pl: {
    priceBadge: "Zapytaj o cenę hurtową na WhatsApp",
    ctaButton: "Zamów / Zapytaj o cenę na WhatsApp",
    priceUnknown: "Nieznana",
    priceUnknownLabel: "Cena: nieznana",
    priceRangeUnknownTitle: "Zakres cen: nieznany",
    priceRangeUnknownNote:
      "Produkty bez podanej ceny (zamówienia tylko przez WhatsApp) są pomijane w filtrze ceny i wyświetlane na końcu sortowania.",
    supplierBadge: "Zamówienia tylko przez WhatsApp",
    greetingPrefix: "Dzień dobry",
    inquiryIntro:
      "Chcę zapytać o cenę hurtową i złożyć zamówienie na Państwa produkt na Merter Vitrini.",
    skuLabel: "SKU",
    colorLabel: "Kolor",
    seriesLabel: "Seria / Rozmiary",
    qtyLabel: "Ilość",
  },
  bg: {
    priceBadge: "Свържете се в WhatsApp за цена на едро",
    ctaButton: "Поръчай / Поискай цена в WhatsApp",
    priceUnknown: "Неизвестна",
    priceUnknownLabel: "Цена: неизвестна",
    priceRangeUnknownTitle: "Ценови диапазон: неизвестен",
    priceRangeUnknownNote:
      "Продуктите с неизвестна цена (само чрез WhatsApp) не участват във филтъра за цена и се показват накрая при сортиране.",
    supplierBadge: "Поръчки само по WhatsApp",
    greetingPrefix: "Здравейте",
    inquiryIntro:
      "Бих искал да попитам за цената на едро и да поръчам вашия продукт в Merter Vitrini.",
    skuLabel: "SKU",
    colorLabel: "Цвят",
    seriesLabel: "Серия / Размери",
    qtyLabel: "Количество",
  },
};

export function isBrandWhatsappOnly(
  brand?: { whatsapp_only_ordering?: boolean } | null
): boolean {
  return Boolean(brand?.whatsapp_only_ordering);
}

export function isProductWhatsappOnly(product?: Product | null): boolean {
  return Boolean(product?.brand_profile?.whatsapp_only_ordering);
}

export function getWhatsappOrderingCopy(lang: string): WhatsAppOrderingCopy {
  return WHATSAPP_ORDERING_COPY[normalizeSeoLang(lang, "tr")];
}

export function buildProductWhatsappOrderLink(params: {
  readonly product: Product;
  readonly lang: string;
  readonly title: string;
  readonly color?: string;
  readonly pkgQty?: number;
  readonly totalPieces?: number;
  readonly fallbackPhone?: string;
}): { url: string; targetPhone: string } {
  const { product, lang, title, color, pkgQty, totalPieces, fallbackPhone } = params;
  const copy = getWhatsappOrderingCopy(lang);
  const rawPhone =
    product.brand_profile?.whatsapp_phone ||
    product.brand_profile?.phone ||
    fallbackPhone ||
    DEFAULT_PLATFORM_WHATSAPP_RAW;
  const digits =
    normalizeWhatsappDigits(rawPhone) || DEFAULT_PLATFORM_WHATSAPP_DIGITS;
  const targetPhone = rawPhone.trim() || DEFAULT_PLATFORM_WHATSAPP_RAW;

  const supplierName =
    product.brand_profile?.name ||
    product.brand_name ||
    "Merter Vitrini";
  const sku = product.custom_sku || product.source_product_id || product.id;
  const resolvedColor = (color || product.color || "").trim();
  const seriesInfo = [product.packing_ratio, product.series_ratio]
    .filter((v): v is string => Boolean(v && v.trim()))
    .join(" / ");

  const lines = [
    `${copy.greetingPrefix} *${supplierName}*,`,
    `*${title}* (${copy.skuLabel}: ${sku})`,
    copy.inquiryIntro,
  ];

  if (resolvedColor) {
    lines.push(`• ${copy.colorLabel}: ${resolvedColor}`);
  }
  if (seriesInfo) {
    lines.push(`• ${copy.seriesLabel}: ${seriesInfo}`);
  }
  if (typeof pkgQty === "number" && pkgQty > 0) {
    const pkgWord = t("package", lang);
    const pieceWord = t("piece", lang);
    const qtyDetail =
      typeof totalPieces === "number" && totalPieces > 0
        ? `${pkgQty} ${pkgWord} (${totalPieces} ${pieceWord})`
        : `${pkgQty} ${pkgWord}`;
    lines.push(`• ${copy.qtyLabel}: ${qtyDetail}`);
  }

  return {
    url: `https://wa.me/${digits}?text=${encodeURIComponent(lines.join("\n"))}`,
    targetPhone,
  };
}
