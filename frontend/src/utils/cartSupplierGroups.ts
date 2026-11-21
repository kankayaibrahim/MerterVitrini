import type { CartItem, Product } from "@/types/store";
import { convertPrice, normalizeWhatsappDigits, type ExchangeRate } from "@/app/utils";
import { t } from "@/app/i18n";
import { normalizeSeoLang, type SupportedSeoLang } from "@/utils/seoHelpers";

export interface CartSupplierGroupItem {
  readonly item: CartItem;
  readonly cartIndex: number;
  readonly pieces: number;
  readonly weightKg: number;
  readonly unitPriceDisplay: number;
  readonly totalPriceDisplay: number;
  readonly rawTotalPrice: number;
  readonly displayCurrency: string;
}

export interface CartSupplierGroup {
  readonly key: string;
  readonly brandId: string;
  readonly brandName: string;
  readonly brandSlug: string;
  readonly whatsappPhone: string;
  readonly phone: string;
  readonly city: string;
  readonly district: string;
  readonly locationAddress: string;
  readonly isVerified: boolean;
  readonly items: readonly CartSupplierGroupItem[];
  readonly totalPackages: number;
  readonly totalPieces: number;
  readonly totalWeightKg: number;
  readonly subtotalDisplay: number;
  readonly displayCurrency: string;
}

export function extractBrandFieldsFromProduct(
  product?: Partial<Product> | null
): Partial<CartItem> {
  if (!product) return {};
  const bp = product.brand_profile;
  return {
    brand_id: product.brand_id || bp?.id || undefined,
    brand_name: product.brand_name || bp?.name || undefined,
    brand_slug: bp?.slug || undefined,
    brand_whatsapp: bp?.whatsapp_phone || bp?.phone || undefined,
    brand_phone: bp?.phone || undefined,
    brand_city: bp?.city || undefined,
    brand_district: bp?.district || undefined,
    brand_location_address: bp?.location_address || undefined,
    brand_verified: bp?.is_verified ?? true,
  };
}

export function normalizeCartWhatsappDigits(raw?: string): string {
  return normalizeWhatsappDigits(raw);
}

interface InternalGroupBuilder {
  key: string;
  brandId: string;
  brandName: string;
  brandSlug: string;
  whatsappPhone: string;
  phone: string;
  city: string;
  district: string;
  locationAddress: string;
  isVerified: boolean;
  items: CartSupplierGroupItem[];
  totalPackages: number;
  totalPieces: number;
  totalWeightKg: number;
  subtotalDisplay: number;
  displayCurrency: string;
}

function resolveGroupIdentity(
  item: CartItem,
  fallbackBrandLabel: string
): { key: string; brandId: string; brandName: string } {
  const brandId = (item.brand_id || "").trim();
  const brandName = (item.brand_name || "").trim() || fallbackBrandLabel;
  if (brandId) {
    return { key: brandId, brandId, brandName };
  }
  const normalizedNameKey = brandName.toLowerCase();
  return { key: `name:${normalizedNameKey}`, brandId: "", brandName };
}

function buildGroupLineItem(
  item: CartItem,
  cartIndex: number,
  displayCurrency: string,
  exchangeRates: readonly ExchangeRate[]
): CartSupplierGroupItem {
  const unitsPerPkg = Math.max(1, item.units_per_package || 1);
  const pieces = item.packages_qty * unitsPerPkg;
  const weightKg = pieces * (item.weight_per_unit || 0.35);
  const rawUnitPrice = item.price_per_unit || 0;
  const rawTotalPrice = pieces * rawUnitPrice;

  const baseCurr = item.currency || "TRY";
  const hasRates = exchangeRates.length > 0 && Boolean(displayCurrency);
  const targetCurrency = hasRates ? displayCurrency : baseCurr;
  const unitPriceDisplay = hasRates
    ? convertPrice(rawUnitPrice, baseCurr, displayCurrency, [...exchangeRates])
    : rawUnitPrice;
  const totalPriceDisplay = hasRates
    ? convertPrice(rawTotalPrice, baseCurr, displayCurrency, [...exchangeRates])
    : rawTotalPrice;

  return {
    item,
    cartIndex,
    pieces,
    weightKg,
    unitPriceDisplay,
    totalPriceDisplay,
    rawTotalPrice,
    displayCurrency: targetCurrency,
  };
}

export function groupCartBySupplier(
  cart: readonly CartItem[],
  displayCurrency: string,
  exchangeRates: readonly ExchangeRate[],
  fallbackBrandLabel: string
): CartSupplierGroup[] {
  const groupMap = new Map<string, InternalGroupBuilder>();

  cart.forEach((item, idx) => {
    const idInfo = resolveGroupIdentity(item, fallbackBrandLabel);
    const line = buildGroupLineItem(item, idx, displayCurrency, exchangeRates);

    let builder = groupMap.get(idInfo.key);
    if (!builder) {
      builder = {
        key: idInfo.key,
        brandId: idInfo.brandId,
        brandName: idInfo.brandName,
        brandSlug: (item.brand_slug || "").trim(),
        whatsappPhone: (item.brand_whatsapp || "").trim(),
        phone: (item.brand_phone || "").trim(),
        city: (item.brand_city || "").trim(),
        district: (item.brand_district || "").trim(),
        locationAddress: (item.brand_location_address || "").trim(),
        isVerified: item.brand_verified ?? true,
        items: [],
        totalPackages: 0,
        totalPieces: 0,
        totalWeightKg: 0,
        subtotalDisplay: 0,
        displayCurrency: line.displayCurrency,
      };
      groupMap.set(idInfo.key, builder);
    }

    if (!builder.brandSlug && item.brand_slug) builder.brandSlug = item.brand_slug.trim();
    if (!builder.whatsappPhone && item.brand_whatsapp) builder.whatsappPhone = item.brand_whatsapp.trim();
    if (!builder.phone && item.brand_phone) builder.phone = item.brand_phone.trim();
    if (!builder.city && item.brand_city) builder.city = item.brand_city.trim();
    if (!builder.district && item.brand_district) builder.district = item.brand_district.trim();
    if (!builder.locationAddress && item.brand_location_address) {
      builder.locationAddress = item.brand_location_address.trim();
    }

    builder.items.push(line);
    builder.totalPackages += item.packages_qty;
    builder.totalPieces += line.pieces;
    builder.totalWeightKg += line.weightKg;
    builder.subtotalDisplay += line.totalPriceDisplay;
  });

  return Array.from(groupMap.values());
}

const SUPPLIER_WA_TEMPLATES: Record<
  SupportedSeoLang,
  { readonly greeting: string; readonly packsLabel: string; readonly totalLabel: string; readonly quoteAsk: string }
> = {
  tr: {
    greeting: "Merhaba *{brand}*, Merter Vitrini üzerinden şu toptan ürünleriniz hakkında bilgi/sipariş vermek istiyorum:",
    packsLabel: "Seri",
    totalLabel: "Tahmini Ara Toplam",
    quoteAsk: "Stok, güncel toptan fiyat ve hazırlık süresi hakkında dönüş yapabilir misiniz?",
  },
  en: {
    greeting: "Hello *{brand}*, I would like to inquire/order these wholesale items via Merter Vitrini:",
    packsLabel: "Packs",
    totalLabel: "Estimated Subtotal",
    quoteAsk: "Could you confirm stock, wholesale pricing, and preparation lead time?",
  },
  ru: {
    greeting: "Здравствуйте, *{brand}*! Хочу оформить оптовый заказ на следующие модели с Merter Vitrini:",
    packsLabel: "Уп.",
    totalLabel: "Предв. сумма",
    quoteAsk: "Подтвердите, пожалуйста, наличие, оптовую цену и срок сборки.",
  },
  ar: {
    greeting: "مرحباً *{brand}*، أود الاستفسار / طلب منتجات الجملة التالية عبر Merter Vitrini:",
    packsLabel: "باكيدج",
    totalLabel: "المجموع التقديري",
    quoteAsk: "يرجى تأكيد التوفر وسعر الجملة ومدة التجهيز.",
  },
  de: {
    greeting: "Hallo *{brand}*, ich möchte folgende Großhandelsartikel über Merter Vitrini anfragen/bestellen:",
    packsLabel: "Pakete",
    totalLabel: "Zwischensumme",
    quoteAsk: "Könnten Sie bitte Bestand, Großhandelspreis und Lieferzeit bestätigen?",
  },
  fr: {
    greeting: "Bonjour *{brand}*, je souhaite commander / demander un devis pour ces articles sur Merter Vitrini :",
    packsLabel: "Séries",
    totalLabel: "Sous-total estimé",
    quoteAsk: "Pouvez-vous confirmer le stock, le tarif gros et le délai de préparation ?",
  },
  pl: {
    greeting: "Dzień dobry *{brand}*, chcę złożyć zapytanie/zamówienie hurtowe na następujące modele przez Merter Vitrini:",
    packsLabel: "Paczek",
    totalLabel: "Szacowana suma",
    quoteAsk: "Proszę o potwierdzenie dostępności, ceny hurtowej i czasu przygotowania.",
  },
  bg: {
    greeting: "Здравейте *{brand}*, искам да поръчам / попитам за следните артикули на едро през Merter Vitrini:",
    packsLabel: "Серии",
    totalLabel: "Очаквана сума",
    quoteAsk: "Моля, потвърдете наличност, цена на едро и срок за подготовка.",
  },
};

export function buildSupplierCartWhatsAppUrl(
  group: CartSupplierGroup,
  lang: string,
  isAuthenticated: boolean
): string {
  const digits = normalizeCartWhatsappDigits(group.whatsappPhone || group.phone);
  if (!digits) return "";

  const safeLang = normalizeSeoLang(lang, "tr");
  const tpl = SUPPLIER_WA_TEMPLATES[safeLang];
  const pieceWord = t("piece", safeLang);

  const lines: string[] = [
    tpl.greeting.replace("{brand}", group.brandName),
    "",
  ];

  group.items.forEach((entry, index) => {
    const localizedTitle = entry.item.title_translations?.[safeLang] || entry.item.title;
    const skuPart = entry.item.custom_sku ? ` (SKU: ${entry.item.custom_sku})` : "";
    const colorPart = entry.item.color ? ` · ${entry.item.color}` : "";
    const qtyPart = `${entry.item.packages_qty} ${tpl.packsLabel} / ${entry.pieces} ${pieceWord}`;
    const pricePart =
      isAuthenticated && entry.totalPriceDisplay > 0
        ? ` — ${entry.totalPriceDisplay.toFixed(2)} ${group.displayCurrency}`
        : "";
    lines.push(`${index + 1}. *${localizedTitle}*${skuPart}${colorPart} -> ${qtyPart}${pricePart}`);
  });

  if (isAuthenticated && group.subtotalDisplay > 0) {
    lines.push("", `*${tpl.totalLabel}:* ${group.subtotalDisplay.toFixed(2)} ${group.displayCurrency}`);
  }
  lines.push("", tpl.quoteAsk);

  return `https://wa.me/${digits}?text=${encodeURIComponent(lines.join("\n"))}`;
}
