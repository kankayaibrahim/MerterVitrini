import React from "react";
import { Metadata } from "next";
import { Category } from "@/types/store";
import { getCategoryTitle, getCategoryTrail, getCategoryUrl } from "@/app/i18n";
import {
  SITE_ORIGIN,
  SupportedSeoLang,
  OG_LOCALE_BY_LANG,
  GLOBAL_B2B_SEO_MATRIX,
  SeoEnhancedProduct,
  StorePublicSettings,
  normalizeSeoLang,
  safeJsonLd,
  toAbsoluteSiteUrl,
  buildQueryLangAlternates,
  ssrStoreFetch,
  fetchSsrCategories,
  fetchSsrStoreSettings,
} from "@/utils/seoHelpers";
import ProductDetailClient from "./ProductDetailClient";

interface PageProps {
  readonly params: Promise<{ readonly slug: string }>;
  readonly searchParams?: Promise<{ readonly lang?: string | string[] }>;
}

export const revalidate = 300;

interface ProductSeoTemplate {
  readonly notFoundTitle: string;
  readonly notFoundDesc: string;
  readonly defaultBrand: string;
  readonly defaultProduct: string;
  readonly b2bPrefix: string;
  readonly b2bSuffix: string;
  readonly buildDescription: (
    title: string,
    brand: string,
    packInfo: string
  ) => string;
}

const PRODUCT_SEO_TEMPLATES: Record<SupportedSeoLang, ProductSeoTemplate> = {
  tr: {
    notFoundTitle: "Ürün Bulunamadı | Merter Vitrini Toptan B2B",
    notFoundDesc: "Aradığınız B2B toptan ürün bulunamadı veya yayından kaldırılmış.",
    defaultBrand: "Merter Doğrulanmış Üretici",
    defaultProduct: "Toptan Hazır Giyim Ürünü",
    b2bPrefix: "Toptan",
    b2bSuffix: "Serili Paket",
    buildDescription: (title, brand, packInfo) =>
      `${title} ${packInfo} toptan serili ve asortili butik sipariş imkanları. Doğrudan İstanbul Merter üretici ${brand} fabrika fiyatlarıyla aracısız B2B hazır giyim tedariği.`,
  },
  en: {
    notFoundTitle: "Product Not Found | Merter Vitrini Wholesale B2B",
    notFoundDesc: "The wholesale B2B product you requested is unavailable or out of catalog.",
    defaultBrand: "Merter Verified Manufacturer",
    defaultProduct: "Wholesale Ready-to-Wear Apparel",
    b2bPrefix: "Wholesale",
    b2bSuffix: "Size-Run Pack",
    buildDescription: (title, brand, packInfo) =>
      `Wholesale ${title} ${packInfo} size-run packs directly from ${brand} in Merter Istanbul, Turkey. Factory-direct B2B pricing, low MOQ & worldwide export cargo.`,
  },
  ru: {
    notFoundTitle: "Товар не найден | Merter Vitrini Оптом B2B",
    notFoundDesc: "Запрашиваемый оптовый товар не найден или снят с производства.",
    defaultBrand: "Проверенная фабрика Мертер",
    defaultProduct: "Одежда оптом из Турции",
    b2bPrefix: "Оптом",
    b2bSuffix: "Размерный ряд",
    buildDescription: (title, brand, packInfo) =>
      `${title} ${packInfo} оптом размерными рядами (сериями) напрямую от фабрики ${brand} (Мертер, Стамбул). Фабричные цены без посредников и карго доставка в РФ и СНГ.`,
  },
  ar: {
    notFoundTitle: "المنتج غير موجود | Merter Vitrini بالجملة B2B",
    notFoundDesc: "منتج الجملة المطلوب غير متوفر حالياً في الكتالوج.",
    defaultBrand: "مصنع معتمد في مارتر",
    defaultProduct: "ملابس تركية بالجملة",
    b2bPrefix: "بالجملة",
    b2bSuffix: "سيري وباكيدج",
    buildDescription: (title, brand, packInfo) =>
      `شراء ${title} ${packInfo} بالجملة بنظام الباكيدج والمقاسات المتنوعة مباشرة من مصنع ${brand} في مارتر إسطنبول بأسعار المصنع وشحن دولي سريع.`,
  },
  de: {
    notFoundTitle: "Produkt nicht gefunden | Merter Vitrini Großhandel B2B",
    notFoundDesc: "Das gesuchte B2B-Großhandelsprodukt wurde nicht gefunden.",
    defaultBrand: "Geprüfter Hersteller Merter",
    defaultProduct: "B2B Mode Großhandel",
    b2bPrefix: "Großhandel",
    b2bSuffix: "Serienpaket",
    buildDescription: (title, brand, packInfo) =>
      `Großhandel ${title} ${packInfo} in sortierten Serienpaketen direkt ab Werk von ${brand} aus Merter Istanbul. B2B-Fabrikpreise und schneller EU-Export.`,
  },
  fr: {
    notFoundTitle: "Produit introuvable | Merter Vitrini Grossiste B2B",
    notFoundDesc: "Le produit en gros recherché est introuvable ou indisponible.",
    defaultBrand: "Fabricant Vérifié Merter",
    defaultProduct: "Prêt-à-Porter en Gros",
    b2bPrefix: "Vente en Gros",
    b2bSuffix: "Lot en Série",
    buildDescription: (title, brand, packInfo) =>
      `Vente en gros ${title} ${packInfo} par séries assorties en direct de l'usine ${brand} à Merter Istanbul. Prix fabricant sans intermédiaire et expédition internationale.`,
  },
  pl: {
    notFoundTitle: "Nie znaleziono produktu | Merter Vitrini Hurt B2B",
    notFoundDesc: "Szukany produkt hurtowy B2B nie został znaleziony.",
    defaultBrand: "Zweryfikowany Producent Merter",
    defaultProduct: "Odzież Hurtowa z Turcji",
    b2bPrefix: "Hurt",
    b2bSuffix: "Pakiet Rozmiarowy",
    buildDescription: (title, brand, packInfo) =>
      `Hurt ${title} ${packInfo} w pełnych seriach rozmiarowych (paczkach) bezpośrednio od producenta ${brand} z Merter Stambuł. Ceny fabryczne B2B i szybka wysyłka do Polski.`,
  },
  bg: {
    notFoundTitle: "Продуктът не е намерен | Merter Vitrini На Едро B2B",
    notFoundDesc: "Търсеният продукт на едро не е наличен в каталога.",
    defaultBrand: "Проверен производител Мертер",
    defaultProduct: "Дрехи на едро от Турция",
    b2bPrefix: "На едро",
    b2bSuffix: "Размерна серия",
    buildDescription: (title, brand, packInfo) =>
      `${title} ${packInfo} на едро в размерни серии директно от фабрика ${brand} в Мертер Истанбул. Производствени цени без посредници и бърза доставка до България.`,
  },
};

function resolveLocalizedProductTitle(
  product: SeoEnhancedProduct,
  lang: SupportedSeoLang
): string {
  const tpl = PRODUCT_SEO_TEMPLATES[lang];
  return (
    product.translations?.[lang]?.title?.trim() ||
    product.title?.trim() ||
    tpl.defaultProduct
  );
}

function resolveLocalizedProductDesc(
  product: SeoEnhancedProduct,
  lang: SupportedSeoLang,
  fallbackDesc: string
): string {
  const raw =
    product.translations?.[lang]?.description?.trim() ||
    (lang === "tr" ? product.short_description?.trim() || product.description?.trim() : "");
  if (!raw) return fallbackDesc;
  const cleaned = raw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return cleaned || fallbackDesc;
}

function resolvePackKeywordTag(product: SeoEnhancedProduct): string {
  const ratio = product.packing_ratio?.trim() || product.series_ratio?.trim() || "";
  return ratio ? `(${ratio})` : "";
}

function isProductInStock(product: SeoEnhancedProduct): boolean {
  if (typeof product.stock === "number") {
    return product.stock > 0;
  }
  if (typeof product.series_stock === "number") {
    return product.series_stock > 0;
  }
  return true;
}

function buildProductMetaStrings(
  product: SeoEnhancedProduct,
  lang: SupportedSeoLang
): { metaTitle: string; metaDesc: string } {
  const tpl = PRODUCT_SEO_TEMPLATES[lang];
  const rawTitle = resolveLocalizedProductTitle(product, lang);
  const brandName = product.brand_name?.trim() || tpl.defaultBrand;
  const packInfo = resolvePackKeywordTag(product);

  if (lang === "tr" && product.seo_title?.trim()) {
    const customTitle = product.seo_title.trim();
    const customDesc =
      product.seo_description?.trim() ||
      tpl.buildDescription(rawTitle, brandName, packInfo);
    return { metaTitle: customTitle, metaDesc: customDesc };
  }

  const prefixed = rawTitle.toLowerCase().includes(tpl.b2bPrefix.toLowerCase())
    ? rawTitle
    : `${tpl.b2bPrefix} ${rawTitle}`;
  const metaTitle = `${prefixed} (${tpl.b2bSuffix}) - ${brandName} | Merter Vitrini B2B`;
  const defaultDesc = tpl.buildDescription(rawTitle, brandName, packInfo);
  const metaDesc =
    lang === "tr" && product.seo_description?.trim()
      ? product.seo_description.trim()
      : defaultDesc;

  return { metaTitle, metaDesc };
}

function buildProductBreadcrumbElements(
  product: SeoEnhancedProduct,
  categories: Category[],
  lang: SupportedSeoLang,
  localizedTitle: string,
  canonicalProductUrl: string
) {
  const items: Array<{ "@type": string; position: number; name: string; item: string }> = [
    {
      "@type": "ListItem",
      position: 1,
      name: GLOBAL_B2B_SEO_MATRIX[lang].homeLabel,
      item: `${SITE_ORIGIN}/${lang}`,
    },
  ];

  const catTrail = product.category_id
    ? getCategoryTrail(categories, product.category_id)
    : null;
  if (catTrail && catTrail.length > 0) {
    for (const cat of catTrail) {
      const catRelUrl = getCategoryUrl(categories, cat, lang).replace(/\/+$/, "");
      items.push({
        "@type": "ListItem",
        position: items.length + 1,
        name: getCategoryTitle(cat, lang),
        item: `${SITE_ORIGIN}${catRelUrl}`,
      });
    }
  }

  if (product.brand_name) {
    const supplierSlug = encodeURIComponent(
      product.brand_profile?.slug || product.brand_id
    );
    const supplierUrl =
      lang === "tr"
        ? `${SITE_ORIGIN}/ureticiler/${supplierSlug}`
        : `${SITE_ORIGIN}/ureticiler/${supplierSlug}?lang=${lang}`;
    items.push({
      "@type": "ListItem",
      position: items.length + 1,
      name: product.brand_name,
      item: supplierUrl,
    });
  }

  items.push({
    "@type": "ListItem",
    position: items.length + 1,
    name: localizedTitle,
    item: canonicalProductUrl,
  });

  return items;
}

function buildProductJsonLdGraph(
  product: SeoEnhancedProduct,
  categories: Category[],
  settings: StorePublicSettings | null,
  lang: SupportedSeoLang,
  canonicalProductUrl: string
) {
  const tpl = PRODUCT_SEO_TEMPLATES[lang];
  const localizedTitle = resolveLocalizedProductTitle(product, lang);
  const packInfo = resolvePackKeywordTag(product);
  const fallbackDesc = tpl.buildDescription(
    localizedTitle,
    product.brand_name || tpl.defaultBrand,
    packInfo
  );
  const localizedDesc = resolveLocalizedProductDesc(product, lang, fallbackDesc);

  const absoluteImages = (product.images || [])
    .map((img) => toAbsoluteSiteUrl(img.image_url))
    .filter(Boolean);
  if (absoluteImages.length === 0) {
    absoluteImages.push(`${SITE_ORIGIN}/og-image.jpg`);
  }

  const availability = isProductInStock(product)
    ? "https://schema.org/InStock"
    : "https://schema.org/OutOfStock";

  const hasDiscount = Boolean(product.discounted_price && product.discounted_price > 0);
  const effectiveOfferPrice = hasDiscount
    ? product.discounted_price || 0
    : product.price || 0;
  const moq =
    product.minimum_order_quantity && product.minimum_order_quantity > 0
      ? product.minimum_order_quantity
      : 1;
  const showGuestPrices =
    Boolean(settings?.show_prices_to_guests) && effectiveOfferPrice > 0;
  const currencyCode = product.currency || "USD";

  const baseOffer: Record<string, unknown> = {
    "@type": "Offer",
    url: canonicalProductUrl,
    availability,
    itemCondition: "https://schema.org/NewCondition",
    eligibleQuantity: {
      "@type": "QuantitativeValue",
      minValue: moq,
      unitText: "PACK",
    },
    seller: {
      "@type": "Organization",
      name: product.brand_name || "Merter Vitrini B2B",
      url: SITE_ORIGIN,
    },
    shippingDetails: {
      "@type": "OfferShippingDetails",
      shippingDestination: {
        "@type": "DefinedRegion",
        addressCountry: ["TR", "DE", "FR", "PL", "BG", "RU", "KZ", "AE", "SA", "US"],
      },
      deliveryTime: {
        "@type": "ShippingDeliveryTime",
        handlingTime: {
          "@type": "QuantitativeValue",
          minValue: 1,
          maxValue: 3,
          unitCode: "DAY",
        },
        transitTime: {
          "@type": "QuantitativeValue",
          minValue: 2,
          maxValue: 7,
          unitCode: "DAY",
        },
      },
    },
  };

  if (showGuestPrices) {
    baseOffer.priceCurrency = currencyCode;
    baseOffer.price = effectiveOfferPrice.toFixed(2);
    baseOffer.priceValidUntil = "2027-12-31";
  }

  const skuValue = product.custom_sku || product.source_product_id || product.id;
  const breadcrumbs = buildProductBreadcrumbElements(
    product,
    categories,
    lang,
    localizedTitle,
    canonicalProductUrl
  );

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        name: localizedTitle,
        description: localizedDesc,
        inLanguage: lang,
        image: absoluteImages,
        sku: skuValue,
        mpn: skuValue,
        ...(product.kumas_fabric ? { material: product.kumas_fabric } : {}),
        ...(product.color ? { color: product.color } : {}),
        brand: {
          "@type": "Brand",
          name: product.brand_name || tpl.defaultBrand,
        },
        ...(showGuestPrices ? { offers: baseOffer } : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: breadcrumbs,
      },
    ],
  };
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const resolvedSearch = searchParams ? await searchParams : {};
  const lang = normalizeSeoLang(resolvedSearch.lang, "tr");
  const tpl = PRODUCT_SEO_TEMPLATES[lang];

  const product = await ssrStoreFetch<SeoEnhancedProduct>(
    `/products/${encodeURIComponent(slug)}`,
    300
  );

  if (!product) {
    return {
      title: tpl.notFoundTitle,
      description: tpl.notFoundDesc,
      robots: { index: false, follow: true },
    };
  }

  const canonicalSlug = product.slug || slug;
  const alternates = buildQueryLangAlternates(`/product/${canonicalSlug}`, lang);
  const { metaTitle, metaDesc } = buildProductMetaStrings(product, lang);

  const coverRaw =
    product.images?.find((img) => img.is_cover)?.image_url ||
    product.images?.[0]?.image_url ||
    "/og-image.jpg";
  const coverAbsolute = toAbsoluteSiteUrl(coverRaw) || `${SITE_ORIGIN}/og-image.jpg`;

  return {
    title: metaTitle,
    description: metaDesc,
    keywords: `${resolveLocalizedProductTitle(product, lang)}, ${product.brand_name || "Merter"}, ${GLOBAL_B2B_SEO_MATRIX[lang].keywords}`,
    alternates,
    openGraph: {
      title: metaTitle,
      description: metaDesc,
      url: alternates.canonical,
      siteName: "Merter Vitrini B2B",
      locale: OG_LOCALE_BY_LANG[lang],
      images: [{ url: coverAbsolute, width: 800, height: 1000, alt: metaTitle }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: metaTitle,
      description: metaDesc,
      images: [coverAbsolute],
    },
  };
}

export default async function ProductDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  const resolvedSearch = searchParams ? await searchParams : {};
  const lang = normalizeSeoLang(resolvedSearch.lang, "tr");

  const [product, categories, settings] = await Promise.all([
    ssrStoreFetch<SeoEnhancedProduct>(`/products/${encodeURIComponent(slug)}`, 300),
    fetchSsrCategories(),
    fetchSsrStoreSettings(),
  ]);

  const canonicalSlug = product?.slug || slug;
  const alternates = buildQueryLangAlternates(`/product/${canonicalSlug}`, lang);
  const jsonLd = product
    ? buildProductJsonLdGraph(
        product,
        categories,
        settings,
        lang,
        alternates.canonical
      )
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
        />
      )}
      <ProductDetailClient
        key={`${slug}-${lang}`}
        product={product}
        initialLang={lang}
        initialCategories={categories}
        initialShowPricesToGuests={
          typeof settings?.show_prices_to_guests === "boolean"
            ? settings.show_prices_to_guests
            : undefined
        }
      />
    </>
  );
}
