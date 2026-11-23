import type { Category, Product } from "@/types/store";
import {
  DEFAULT_MERTER_ADDRESS,
  resolveAddressLocality,
  sanitizePublicStoreAddress,
  sanitizePublicStoreEmail,
} from "@/utils/formatters";

/**
 * Strips trailing "| Merter Vitrini..." or "| مارتر فيتريني..." segments from child page
 * titles so root `layout.tsx`'s `title.template` ("%s | Merter Vitrini B2B") never produces
 * double brand suffixes like "... | Merter Vitrini | Merter Vitrini B2B".
 */
export function stripBrandTitleSuffix(rawTitle: string): string {
  const trimmed = (rawTitle || "").trim();
  if (!trimmed) return "Merter Vitrini";
  const pipeIdx = trimmed.lastIndexOf("|");
  if (pipeIdx === -1) return trimmed;
  const suffix = trimmed
    .slice(pipeIdx + 1)
    .trim()
    .split(/\s+/)
    .join(" ")
    .toLowerCase();
  if (suffix.startsWith("merter vitrini") || suffix.startsWith("مارتر فيتريني")) {
    return trimmed.slice(0, pipeIdx).trim() || trimmed;
  }
  return trimmed;
}

export const SITE_ORIGIN = "https://mertervitrini.com.tr";

export const SUPPORTED_SEO_LANGS = [
  "tr",
  "en",
  "ru",
  "ar",
  "de",
  "fr",
  "pl",
  "bg",
] as const;

export type SupportedSeoLang = (typeof SUPPORTED_SEO_LANGS)[number];

export const OG_LOCALE_BY_LANG: Record<SupportedSeoLang, string> = {
  tr: "tr_TR",
  en: "en_US",
  ru: "ru_RU",
  ar: "ar_AR",
  de: "de_DE",
  fr: "fr_FR",
  pl: "pl_PL",
  bg: "bg_BG",
};

export const INTL_LOCALE_BY_LANG: Record<SupportedSeoLang, string> = {
  tr: "tr-TR",
  en: "en-US",
  ru: "ru-RU",
  ar: "ar-SA",
  de: "de-DE",
  fr: "fr-FR",
  pl: "pl-PL",
  bg: "bg-BG",
};

export interface GlobalB2BSeoLocaleCopy {
  readonly keywords: string;
  readonly homeLabel: string;
  readonly allProductsLabel: string;
  readonly newArrivalsLabel: string;
  readonly suppliersLabel: string;
  readonly portalTitle: string;
  readonly portalDescription: string;
  readonly portalH1: string;
  readonly portalLead: string;
  readonly allProductsTitle: string;
  readonly allProductsDescription: string;
  readonly newArrivalsTitle: string;
  readonly newArrivalsDescription: string;
}

export const GLOBAL_B2B_SEO_MATRIX: Record<
  SupportedSeoLang,
  GlobalB2BSeoLocaleCopy
> = {
  tr: {
    keywords:
      "toptan hazır giyim, Merter toptan giyim, İstanbul toptan hazır giyim üreticileri, seri toptan kadın giyim, toptan giyim siteleri, fason üretim, doğrudan fabrikadan toptan kıyafet",
    homeLabel: "Ana Sayfa",
    allProductsLabel: "Tüm Toptan Ürünler",
    newArrivalsLabel: "Yeni Ürünler",
    suppliersLabel: "Üretici Firmalar",
    portalTitle:
      "Toptan Hazır Giyim — Merter İstanbul B2B Üreticileri",
    portalDescription:
      "Türkiye'nin en büyük toptan hazır giyim merkezi Merter'den aracısız seri toptan kadın, erkek, tesettür giyim ve fason üretim. Doğrulanmış İstanbul üreticileriyle doğrudan çalışın.",
    portalH1:
      "Toptan Hazır Giyim — Merter Üreticilerinden Aracısız B2B Tekstil & Moda Vitrini",
    portalLead:
      "Doğrulanmış Merter toptan hazır giyim fabrikalarıyla aracısız çalışın: asortili beden serileri, düşük MOQ, fason/Private Label üretim ve 50+ ülkeye konsolide ihracat kargo.",
    allProductsTitle:
      "Tüm Toptan Hazır Giyim Koleksiyonları — Seri & Paket Satış",
    allProductsDescription:
      "Merter ve İstanbul üreticilerinden toptan hazır giyim, kadın elbise, ikili takım, triko, tesettür, büyük beden ve erkek giyim koleksiyonlarını seri/paket fiyatlarıyla inceleyin.",
    newArrivalsTitle:
      "Yeni Ürünler (Son 7 Gün) — Merter Toptan Hazır Giyim Yeni Sezon Modelleri",
    newArrivalsDescription:
      "Son 7 günde Merter toptan hazır giyim üreticileri tarafından eklenen en yeni sezon kadın ve erkek giyim modellerini eklenme tarihine göre inceleyin.",
  },
  en: {
    keywords:
      "Merter wholesale clothing Istanbul, Turkish wholesale fashion manufacturers, bulk women's dresses & streetwear packs, low MOQ private label apparel Turkey, direct factory B2B fashion",
    homeLabel: "Home",
    allProductsLabel: "All Wholesale Products",
    newArrivalsLabel: "New Arrivals",
    suppliersLabel: "Manufacturers",
    portalTitle:
      "Merter Wholesale Clothing Istanbul — Direct Turkish Fashion Manufacturers B2B",
    portalDescription:
      "Source bulk women's dresses, modest wear & streetwear size-run packs directly from verified Merter Istanbul clothing factories. Low MOQ, private label OEM & worldwide export shipping.",
    portalH1:
      "Merter Wholesale Clothing Istanbul — Direct From Verified Turkish Apparel Manufacturers",
    portalLead:
      "Zero middlemen: buy assorted size-run packs (series), request low-MOQ private label production, and ship globally with consolidated air & road cargo from Istanbul.",
    allProductsTitle:
      "All Turkish Wholesale Clothing Packs — Direct Merter Factory Catalog",
    allProductsDescription:
      "Browse thousands of wholesale women's & men's clothing packs from Merter Istanbul manufacturers with transparent size ratios, factory pricing, and fast export.",
    newArrivalsTitle:
      "New Arrivals (Last 7 Days) — Latest Merter Wholesale Clothing Packs",
    newArrivalsDescription:
      "Discover wholesale women's and men's fashion packs added by verified Merter Istanbul manufacturers in the last 7 days, sorted newest first.",
  },
  ru: {
    keywords:
      "Одежда оптом из Турции Мертер Стамбул, женская одежда оптом от производителя размерными рядами, фабрики одежды Мертер без посредников, карго доставка в СНГ и Россию",
    homeLabel: "Главная",
    allProductsLabel: "Все товары оптом",
    newArrivalsLabel: "Новые поступления",
    suppliersLabel: "Фабрики и производители",
    portalTitle:
      "Одежда оптом из Турции (Мертер, Стамбул) — Напрямую от фабрик без посредников",
    portalDescription:
      "Женская и мужская одежда оптом из Турции (Мертер, Стамбул) размерными рядами (сериями) напрямую от проверенных фабрик. Пошив под своим брендом и карго доставка в Россию и СНГ.",
    portalH1:
      "Одежда оптом из Турции (Мертер, Стамбул) — Прямые поставки с фабрик без посредников",
    portalLead:
      "Закупайте турецкую одежду размерными рядами (сериями) по фабричным ценам, заказывайте Private Label пошив и оформляйте консолидированную карго-доставку в РФ, Казахстан и СНГ.",
    allProductsTitle:
      "Каталог одежды оптом из Турции Мертер — Закупка размерными рядами с фабрик",
    allProductsDescription:
      "Полный оптовый каталог фабрик Мертера (Стамбул): платья, костюмы, трикотаж и верхняя одежда оптом сериями напрямую от турецких производителей.",
    newArrivalsTitle:
      "Новые поступления (за 7 дней) — Свежие коллекции фабрик Мертера оптом",
    newArrivalsDescription:
      "Новые модели женской и мужской одежды, добавленные турецкими фабриками Мертера за последние 7 дней в порядке поступления.",
  },
  ar: {
    keywords:
      "ملابس تركية بالجملة مارتر إسطنبول، مصانع الملابس الجاهزة في تركيا بدون وسطاء، فساتين وملابس محجبات بالجملة بنظام الباكيدج، شحن دولي وتخليص جمركي",
    homeLabel: "الرئيسية",
    allProductsLabel: "جميع منتجات الجملة",
    newArrivalsLabel: "وصل حديثاً",
    suppliersLabel: "المصانع التركية",
    portalTitle:
      "ملابس تركية بالجملة من مارتر إسطنبول — مباشرة من المصانع بدون وسطاء",
    portalDescription:
      "تسوق ملابس تركية بالجملة من مصانع مارتر إسطنبول مباشرة: فساتين، أطقم وملابس محجبات بنظام السيري والباكيدج، تصنيع خاص (Private Label) وشحن دولي سريع.",
    portalH1:
      "ملابس تركية بالجملة من مارتر إسطنبول — توريد مباشر من مصانع الأزياء المعتمدة",
    portalLead:
      "تواصل مباشرة مع مصانع الملابس الجاهزة في مارتر بدون عمولات وسطاء: بيع بنظام الباكيدج (مقاسات متنوعة)، تصنيع للعلامات الخاصة وشحن جوي وبري موحد للشرق الأوسط والخليج وأوروبا.",
    allProductsTitle:
      "كتالوج الملابس التركية بالجملة — فساتين وأزياء مارتر إسطنبول بنظام السيري",
    allProductsDescription:
      "استعرض آلاف موديلات الملابس التركية بالجملة بنظام الباكيدج مباشرة من مصانع مارتر إسطنبول بأسعار المصنع وشحن دولي موثوق.",
    newArrivalsTitle:
      "وصل حديثاً (آخر 7 أيام) — أحدث موديلات الجملة من مصانع مارتر إسطنبول",
    newArrivalsDescription:
      "استعرض أحدث موديلات الملابس التركية بالجملة المضافة خلال آخر 7 أيام مباشرة من مصانع مارتر حسب الأحدث.",
  },
  de: {
    keywords:
      "Großhandel Damenmode Türkei Merter Istanbul, Türkische Textilhersteller B2B direkt ab Werk, Mode Großhandel Serienpakete, Private Label Bekleidung Türkei",
    homeLabel: "Startseite",
    allProductsLabel: "Alle Großhandelsprodukte",
    newArrivalsLabel: "Neuheiten",
    suppliersLabel: "Herstellerverzeichnis",
    portalTitle:
      "Großhandel Damenmode Türkei (Merter Istanbul) — B2B Direkt ab Werk",
    portalDescription:
      "Türkische Textilhersteller aus Merter Istanbul im B2B-Direktvertrieb: Damenmode & Streetwear im Großhandel in Serienpaketen, Private Label Produktion und schneller EU-Export mit ATR.",
    portalH1:
      "Großhandel Mode aus der Türkei (Merter Istanbul) — Direkt von geprüften Textilherstellern",
    portalLead:
      "Einkauf ohne Zwischenhändler direkt ab Werk: sortierte Größenserien (Packs), niedrige Mindestbestellmengen, Private-Label-Fertigung und konsolidierter EU-Versand inklusive Zollabwicklung.",
    allProductsTitle:
      "B2B Mode Großhandel Katalog — Türkische Bekleidung in Serienpaketen ab Werk",
    allProductsDescription:
      "Entdecken Sie Damen- und Herrenmode im Großhandel direkt von Merter Herstellern in Istanbul mit transparenten Größenläufen und Werkspreisen.",
    newArrivalsTitle:
      "Neuheiten (Letzte 7 Tage) — Neueste Großhandelsmode aus Merter Istanbul",
    newArrivalsDescription:
      "Entdecken Sie neue Damen- und Herrenmode-Serienpakete, die in den letzten 7 Tagen von Merter Herstellern hinzugefügt wurden.",
  },
  fr: {
    keywords:
      "Grossiste vêtement femme Turquie Merter Istanbul, fabricants textile turc en gros sans intermédiaire, achat en série B2B prêt-à-porter et mode modeste",
    homeLabel: "Accueil",
    allProductsLabel: "Tous les produits en gros",
    newArrivalsLabel: "Nouveautés",
    suppliersLabel: "Fabricants",
    portalTitle:
      "Grossiste Vêtement Femme Turquie (Merter Istanbul) — Fabricants B2B en Direct",
    portalDescription:
      "Achetez en gros auprès des fabricants textiles de Merter Istanbul sans intermédiaire : robes, ensembles et mode modeste vendus par séries assorties, marque blanche et expédition internationale.",
    portalH1:
      "Grossiste Prêt-à-Porter Turquie (Merter Istanbul) — En Direct des Usines de Confection",
    portalLead:
      "Approvisionnement B2B direct usine : lots par séries de tailles assorties, fabrication Private Label à faible MOQ et transport international groupé vers la France, l’Europe et le Maghreb.",
    allProductsTitle:
      "Catalogue Grossiste Mode Turque — Achat en Série Direct Fabricants Merter",
    allProductsDescription:
      "Parcourez toutes les collections de prêt-à-porter turc en gros vendues en paquets assortis directement auprès des ateliers vérifiés de Merter Istanbul.",
    newArrivalsTitle:
      "Nouveautés (7 derniers jours) — Nouvelles Collections Grossiste Merter",
    newArrivalsDescription:
      "Découvrez les lots de prêt-à-porter ajoutés ces 7 derniers jours par les fabricants de Merter Istanbul, classés du plus récent.",
  },
  pl: {
    keywords:
      "Hurtownia odzieży tureckiej Merter Stambuł, odzież damska hurt bezpośrednio od producenta w paczkach (seriach), sukienki i komplety z Turcji B2B",
    homeLabel: "Strona główna",
    allProductsLabel: "Wszystkie produkty hurtowe",
    newArrivalsLabel: "Nowości",
    suppliersLabel: "Producenci",
    portalTitle:
      "Hurtownia Odzieży Tureckiej Merter Stambuł — Bezpośrednio od Producenta B2B",
    portalDescription:
      "Odzież damska i męska hurt z Turcji (Merter Stambuł) bezpośrednio od sprawdzonych fabryk. Sprzedaż w paczkach (pełnych seriach rozmiarowych), produkcja Private Label i szybka wysyłka do Polski.",
    portalH1:
      "Hurtownia Odzieży Tureckiej Merter Stambuł — Zakupy B2B Prosto z Fabryk",
    portalLead:
      "Kupuj bez pośredników bezpośrednio u producentów z dzielnicy Merter w Stambule: pełne serie rozmiarowe w paczkach, niskie MOQ, szycie pod własną marką i transport konsolidowany do Polski i UE.",
    allProductsTitle:
      "Katalog Hurtowy Odzieży z Turcji — Sukienki, Komplety i Moda w Paczkach",
    allProductsDescription:
      "Pełny katalog B2B tureckich producentów odzieży z Merter Stambuł: sprzedaż hurtowa w seriach rozmiarowych w cenach fabrycznych.",
    newArrivalsTitle:
      "Nowości (Ostatnie 7 dni) — Najnowsze Kolekcje Hurtowe z Merter",
    newArrivalsDescription:
      "Przeglądaj najnowsze modele odzieży hurtowej dodane przez producentów z Merter w ciągu ostatnich 7 dni.",
  },
  bg: {
    keywords:
      "Дрехи на едро от Турция Мертер Истанбул, дамска конфекция на едро директно от производители на серии, турски фабрики за облекло без посредници",
    homeLabel: "Начало",
    allProductsLabel: "Всички продукти на едро",
    newArrivalsLabel: "Нови продукти",
    suppliersLabel: "Производители",
    portalTitle:
      "Дрехи на едро от Турция (Мертер Истанбул) — Директно от производители B2B",
    portalDescription:
      "Дамска и мъжка конфекция на едро от Мертер Истанбул директно от проверени турски фабрики без посредници. Продажба на серии (пакети), ишлеме/Private Label и бърза доставка до България.",
    portalH1:
      "Дрехи на едро от Турция (Мертер Истанбул) — Директно от турски фабрики за облекло",
    portalLead:
      "Пазарувайте на едро без комисиони от посредници: асортови размерни серии, нисък минимален обем, производство под собствена марка и експресно карго до България и ЕС.",
    allProductsTitle:
      "Каталог дрехи на едро от Турция — Дамска и мъжка мода на серии от Мертер",
    allProductsDescription:
      "Разгледайте хиляди модели турски дрехи на едро в серии директно от фабриките в Мертер Истанбул на производствени цени.",
    newArrivalsTitle:
      "Нови продукти (Последните 7 дни) — Най-новите серии на едро от Мертер",
    newArrivalsDescription:
      "Разгледайте най-новите модели облекла на едро, добавени през последните 7 дни от производители в Мертер Истанбул.",
  },
};

export function isSupportedSeoLang(val: unknown): val is SupportedSeoLang {
  return (
    typeof val === "string" &&
    (SUPPORTED_SEO_LANGS as readonly string[]).includes(val)
  );
}

export function normalizeSeoLang(
  raw?: string | string[] | null,
  fallback: SupportedSeoLang = "tr"
): SupportedSeoLang {
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  if (!candidate) return fallback;
  const cleaned = candidate.trim().toLowerCase().split(/[-_]/)[0];
  if (isSupportedSeoLang(cleaned)) {
    return cleaned;
  }
  return fallback;
}

/**
 * Safely serializes JSON-LD structured data while escaping `<` to `\u003c`
 * so untrusted strings can never break out of a `<script type="application/ld+json">` tag.
 */
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data).replaceAll("<", String.raw`\u003c`);
}

function stripTrailingSlash(value: string): string {
  if (value.length <= 1) return value;
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

/**
 * Converts a relative asset/route path (`/uploads/...` or `uploads/...`) into an absolute
 * `https://mertervitrini.com.tr/...` URL without trailing slash.
 */
export function toAbsoluteSiteUrl(pathOrUrl?: string | null): string {
  if (!pathOrUrl) return "";
  const trimmed = pathOrUrl.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  const normalizedPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (normalizedPath === "/") {
    return SITE_ORIGIN;
  }
  return `${SITE_ORIGIN}${stripTrailingSlash(normalizedPath)}`;
}

function trimOuterSlashes(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && value.codePointAt(start) === 47) {
    start++;
  }
  while (end > start && value.codePointAt(end - 1) === 47) {
    end--;
  }
  return value.slice(start, end);
}

/**
 * Builds self-referencing canonical + full 8-language hreflang + x-default (`/en...`)
 * for `[categoryPrefix]` routes such as `/tr`, `/tr/tum-urunler`, `/tr/kadin-giyim/elbise`.
 */
export function buildPrefixedAlternates(subPath: string, currentLang: string) {
  const safeLang = normalizeSeoLang(currentLang, "tr");
  const trimmed = trimOuterSlashes(subPath.trim());
  const suffix = trimmed ? `/${trimmed}` : "";

  const languages: Record<string, string> = {};
  for (const lang of SUPPORTED_SEO_LANGS) {
    if (trimmed === "" && lang === "tr") {
      languages.tr = SITE_ORIGIN;
    } else {
      languages[lang] = `${SITE_ORIGIN}/${lang}${suffix}`;
    }
  }
  languages["x-default"] = `${SITE_ORIGIN}/en${suffix}`;

  const canonical =
    trimmed === "" && safeLang === "tr"
      ? SITE_ORIGIN
      : `${SITE_ORIGIN}/${safeLang}${suffix}`;

  return {
    canonical,
    languages,
  };
}

/**
 * Strips heavy full-HTML descriptions and non-active language translations from SSR
 * list payloads so page HTML stays compact without breaking ProductCard rendering.
 */
export function slimSsrProductsForCardGrid(
  products: readonly Product[],
  lang: SupportedSeoLang
): Product[] {
  return products.map((p) => {
    const activeTrans = p.translations?.[lang];
    return {
      ...p,
      description: undefined,
      short_description: undefined,
      variants: undefined,
      attributes: undefined,
      translations: activeTrans
        ? {
            [lang]: {
              title: activeTrans.title,
            },
          }
        : undefined,
    };
  });
}

/**
 * Strips bulky SEO HTML blobs from category trees passed into navigation/sidebar state.
 */
export function slimSsrCategoriesForNav(
  categories: readonly Category[],
  lang: SupportedSeoLang
): Category[] {
  return categories.map((cat) => {
    const activeTrans = cat.translations?.[lang];
    return {
      ...cat,
      translations: activeTrans
        ? {
            [lang]: {
              title: activeTrans.title,
            },
          }
        : undefined,
      children: cat.children ? slimSsrCategoriesForNav(cat.children, lang) : undefined,
    };
  });
}

/**
 * Builds self-referencing canonical + full 8-language hreflang + x-default (`?lang=en`)
 * for non-prefixed routes that switch language via `?lang=` (`/product/[slug]`, `/ureticiler`, etc.).
 */
export function buildQueryLangAlternates(
  basePath: string,
  currentLang: string
) {
  const safeLang = normalizeSeoLang(currentLang, "tr");
  const cleanBase = basePath.startsWith("http")
    ? stripTrailingSlash(basePath)
    : toAbsoluteSiteUrl(basePath);

  const languages: Record<string, string> = {
    tr: cleanBase,
  };
  for (const lang of SUPPORTED_SEO_LANGS) {
    if (lang !== "tr") {
      languages[lang] = `${cleanBase}?lang=${lang}`;
    }
  }
  languages["x-default"] = `${cleanBase}?lang=en`;

  return {
    canonical: safeLang === "tr" ? cleanBase : `${cleanBase}?lang=${safeLang}`,
    languages,
  };
}

export type SeoEnhancedProduct = Product & {
  seo_title?: string | null;
  seo_description?: string | null;
  category_title?: string | null;
  series_stock?: number;
};

export interface StorePublicSettings {
  show_single_price?: boolean;
  show_prices_to_guests?: boolean;
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
}

export interface SsrProductsPayload {
  products: Product[];
  total: number;
}

export function getInternalStoreApiBase(): string {
  const base = process.env.INTERNAL_API_URL || SITE_ORIGIN;
  return stripTrailingSlash(base);
}

/**
 * Server-side helper for SSR store API pre-fetching with `X-SSR-Prefetch: 1` header.
 */
export async function ssrStoreFetch<T>(
  endpoint: string,
  revalidateSeconds = 300
): Promise<T | null> {
  const normalizedEndpoint = endpoint.startsWith("/")
    ? endpoint
    : `/${endpoint}`;
  const url = `${getInternalStoreApiBase()}/api/v1/store${normalizedEndpoint}`;
  const isNoStore = normalizedEndpoint === "/settings" || revalidateSeconds <= 0;
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "X-SSR-Prefetch": "1",
      },
      ...(isNoStore
        ? { cache: "no-store" as const }
        : { next: { revalidate: revalidateSeconds } }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as T;
    if (normalizedEndpoint === "/settings" && json && typeof json === "object") {
      const rawObj = json as unknown as Record<string, unknown>;
      return {
        ...rawObj,
        email: sanitizePublicStoreEmail(rawObj.email as string | undefined),
        address: sanitizePublicStoreAddress(rawObj.address as string | undefined),
      } as unknown as T;
    }
    return json;
  } catch {
    return null;
  }
}

export async function fetchSsrCategories(): Promise<Category[]> {
  const data = await ssrStoreFetch<Category[]>("/categories", 300);
  return Array.isArray(data) ? data : [];
}

export async function fetchSsrProducts(
  query: string,
  revalidateSeconds = 180
): Promise<SsrProductsPayload> {
  const normalizedQuery = query.startsWith("?") ? query : `?${query}`;
  const raw = await ssrStoreFetch<SsrProductsPayload | Product[]>(
    `/products${normalizedQuery}`,
    revalidateSeconds
  );
  if (Array.isArray(raw)) {
    return { products: raw, total: raw.length };
  }
  if (raw && Array.isArray(raw.products)) {
    return {
      products: raw.products,
      total: typeof raw.total === "number" ? raw.total : raw.products.length,
    };
  }
  return { products: [], total: 0 };
}

export async function fetchSsrStoreSettings(): Promise<StorePublicSettings | null> {
  return ssrStoreFetch<StorePublicSettings>("/settings", 0);
}

export function buildOrganizationGraphJsonLd(
  lang: SupportedSeoLang,
  settings?: StorePublicSettings | null
) {
  const copy = GLOBAL_B2B_SEO_MATRIX[lang];
  const contactPhone = settings?.phone?.trim() || "+90 533 703 08 83";
  const contactEmail = sanitizePublicStoreEmail(settings?.email);
  const streetAddress = sanitizePublicStoreAddress(
    settings?.address || DEFAULT_MERTER_ADDRESS
  );
  const locality = resolveAddressLocality(streetAddress);
  const isGungoren = locality.toLocaleLowerCase("tr-TR").includes("güngören");

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["Organization", "WholesaleStore"],
        "@id": `${SITE_ORIGIN}/#organization`,
        name: "Merter Vitrini B2B",
        url: SITE_ORIGIN,
        priceRange: "$$",
        logo: {
          "@type": "ImageObject",
          url: `${SITE_ORIGIN}/og-image.jpg`,
        },
        image: `${SITE_ORIGIN}/og-image.jpg`,
        description: copy.portalDescription,
        knowsAbout: [
          "Toptan Hazır Giyim",
          "Merter Toptan Giyim",
          "Seri Toptan Kadın Giyim",
          "Private Label Tekstil Üretimi",
          "Fason Hazır Giyim Üretimi",
        ],
        geo: {
          "@type": "GeoCoordinates",
          latitude: 41.0112,
          longitude: 28.8878,
        },
        openingHoursSpecification: [
          {
            "@type": "OpeningHoursSpecification",
            dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
            opens: "08:30",
            closes: "19:00",
          },
        ],
        sameAs: [
          "https://facebook.com/mertervitrini",
          "https://x.com/mertervitrini",
          "https://instagram.com/mertervitrini",
          "https://linkedin.com/company/mertervitrini",
        ],
        address: {
          "@type": "PostalAddress",
          streetAddress,
          addressLocality: locality,
          addressRegion: "İstanbul",
          ...(isGungoren ? { postalCode: "34173" } : {}),
          addressCountry: "TR",
        },
        contactPoint: [
          {
            "@type": "ContactPoint",
            telephone: contactPhone,
            email: contactEmail,
            contactType: "sales",
            areaServed: ["TR", "EU", "RU", "KZ", "UZ", "AE", "SA", "US", "GB"],
            availableLanguage: [
              "Turkish",
              "English",
              "Russian",
              "Arabic",
              "German",
              "French",
              "Polish",
              "Bulgarian",
            ],
          },
        ],
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_ORIGIN}/#website`,
        url: SITE_ORIGIN,
        name: "Merter Vitrini B2B Wholesale Showroom",
        inLanguage: lang,
        publisher: {
          "@id": `${SITE_ORIGIN}/#organization`,
        },
        potentialAction: {
          "@type": "SearchAction",
          target: `${SITE_ORIGIN}/${lang}/tum-urunler?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };
}
