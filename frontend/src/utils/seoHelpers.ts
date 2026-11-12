import type { Category, Product } from "@/types/store";

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
  readonly suppliersLabel: string;
  readonly portalTitle: string;
  readonly portalDescription: string;
  readonly portalH1: string;
  readonly portalLead: string;
  readonly allProductsTitle: string;
  readonly allProductsDescription: string;
}

export const GLOBAL_B2B_SEO_MATRIX: Record<
  SupportedSeoLang,
  GlobalB2BSeoLocaleCopy
> = {
  tr: {
    keywords:
      "Merter toptan giyim, İstanbul toptan tekstil üreticileri, seri toptan kadın giyim, fason üretim, doğrudan fabrikadan toptan kıyafet",
    homeLabel: "Ana Sayfa",
    allProductsLabel: "Tüm Toptan Ürünler",
    suppliersLabel: "Üretici Firmalar",
    portalTitle:
      "Merter Toptan Giyim & İstanbul B2B Tekstil Üreticileri | Merter Vitrini",
    portalDescription:
      "Merter toptan giyim ve İstanbul toptan tekstil üreticilerinden aracısız seri toptan kadın giyim, erkek giyim, fason üretim ve Private Label koleksiyonları.",
    portalH1:
      "Merter Toptan Giyim — İstanbul Üreticilerinden Doğrudan B2B Tekstil & Moda Vitrini",
    portalLead:
      "Doğrulanmış Merter fabrikalarıyla aracısız çalışın: asortili beden serileri, düşük MOQ, fason/Private Label üretim ve 50+ ülkeye konsolide ihracat kargo.",
    allProductsTitle:
      "Tüm Toptan Giyim Koleksiyonları — Seri Bazlı Fabrikadan Toptan Kıyafet",
    allProductsDescription:
      "Merter toptan kadın giyim, elbise, takım, dış giyim ve erkek giyim modellerini seri/paket fiyatlarıyla doğrudan üretici fabrikalardan inceleyin.",
  },
  en: {
    keywords:
      "Merter wholesale clothing Istanbul, Turkish wholesale fashion manufacturers, bulk women's dresses & streetwear packs, low MOQ private label apparel Turkey, direct factory B2B fashion",
    homeLabel: "Home",
    allProductsLabel: "All Wholesale Products",
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
  },
  ru: {
    keywords:
      "Одежда оптом из Турции Мертер Стамбул, женская одежда оптом от производителя размерными рядами, фабрики одежды Мертер без посредников, карго доставка в СНГ и Россию",
    homeLabel: "Главная",
    allProductsLabel: "Все товары оптом",
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
  },
  ar: {
    keywords:
      "ملابس تركية بالجملة مارتر إسطنبول، مصانع الملابس الجاهزة في تركيا بدون وسطاء، فساتين وملابس محجبات بالجملة بنظام الباكيدج، شحن دولي وتخليص جمركي",
    homeLabel: "الرئيسية",
    allProductsLabel: "جميع منتجات الجملة",
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
  },
  de: {
    keywords:
      "Großhandel Damenmode Türkei Merter Istanbul, Türkische Textilhersteller B2B direkt ab Werk, Mode Großhandel Serienpakete, Private Label Bekleidung Türkei",
    homeLabel: "Startseite",
    allProductsLabel: "Alle Großhandelsprodukte",
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
  },
  fr: {
    keywords:
      "Grossiste vêtement femme Turquie Merter Istanbul, fabricants textile turc en gros sans intermédiaire, achat en série B2B prêt-à-porter et mode modeste",
    homeLabel: "Accueil",
    allProductsLabel: "Tous les produits en gros",
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
  },
  pl: {
    keywords:
      "Hurtownia odzieży tureckiej Merter Stambuł, odzież damska hurt bezpośrednio od producenta w paczkach (seriach), sukienki i komplety z Turcji B2B",
    homeLabel: "Strona główna",
    allProductsLabel: "Wszystkie produkty hurtowe",
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
  },
  bg: {
    keywords:
      "Дрехи на едро от Турция Мертер Истанбул, дамска конфекция на едро директно от производители на серии, турски фабрики за облекло без посредници",
    homeLabel: "Начало",
    allProductsLabel: "Всички продукти на едро",
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
  return JSON.stringify(data).replace(/</g, "\\u003c");
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

/**
 * Builds self-referencing canonical + full 8-language hreflang + x-default (`/en...`)
 * for `[categoryPrefix]` routes such as `/tr`, `/tr/tum-urunler`, `/tr/kadin-giyim/elbise`.
 */
export function buildPrefixedAlternates(subPath: string, currentLang: string) {
  const safeLang = normalizeSeoLang(currentLang, "tr");
  const trimmed = subPath.trim().replace(/^\/+|\/+$/g, "");
  const suffix = trimmed ? `/${trimmed}` : "";

  const languages: Record<string, string> = {};
  for (const lang of SUPPORTED_SEO_LANGS) {
    languages[lang] = `${SITE_ORIGIN}/${lang}${suffix}`;
  }
  languages["x-default"] = `${SITE_ORIGIN}/en${suffix}`;

  return {
    canonical: `${SITE_ORIGIN}/${safeLang}${suffix}`,
    languages,
  };
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
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "X-SSR-Prefetch": "1",
      },
      next: { revalidate: revalidateSeconds },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
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
  return ssrStoreFetch<StorePublicSettings>("/settings", 300);
}

export function buildOrganizationGraphJsonLd(
  lang: SupportedSeoLang,
  settings?: StorePublicSettings | null
) {
  const copy = GLOBAL_B2B_SEO_MATRIX[lang];
  const contactPhone = settings?.phone?.trim() || "+90 533 703 08 83";
  const contactEmail = settings?.email?.trim() || "info@mertervitrini.com.tr";

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_ORIGIN}/#organization`,
        name: "Merter Vitrini B2B",
        url: SITE_ORIGIN,
        logo: {
          "@type": "ImageObject",
          url: `${SITE_ORIGIN}/og-image.jpg`,
        },
        image: `${SITE_ORIGIN}/og-image.jpg`,
        description: copy.portalDescription,
        address: {
          "@type": "PostalAddress",
          streetAddress:
            settings?.address?.trim() || "Mehmet Nesih Özmen Mah., Merter",
          addressLocality: "Güngören",
          addressRegion: "İstanbul",
          postalCode: "34173",
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
