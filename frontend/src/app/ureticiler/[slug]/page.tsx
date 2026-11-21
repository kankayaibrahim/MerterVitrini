import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Brand } from "@/types/store";
import {
  SITE_ORIGIN,
  OG_LOCALE_BY_LANG,
  GLOBAL_B2B_SEO_MATRIX,
  SupportedSeoLang,
  normalizeSeoLang,
  stripBrandTitleSuffix,
  buildQueryLangAlternates,
  safeJsonLd,
  ssrStoreFetch,
  fetchSsrProducts,
  fetchSsrCategories,
} from "@/utils/seoHelpers";
import SupplierShowcaseClient from "./SupplierShowcaseClient";
import {
  formatBrandInstagramUrl,
  formatBrandWebsiteUrl,
} from "@/utils/brandContactHelpers";

interface SupplierShowcasePageProps {
  readonly params: Promise<{ slug: string }>;
  readonly searchParams: Promise<{ lang?: string | string[] }>;
}

function buildBrandMetaTitle(brandName: string, lang: SupportedSeoLang): string {
  const map: Record<SupportedSeoLang, string> = {
    tr: `${brandName} — Doğrulanmış Merter Toptan Giyim Üretici Vitrini | Merter Vitrini`,
    en: `${brandName} — Verified Merter Wholesale Clothing Manufacturer Istanbul | Merter Vitrini`,
    ru: `${brandName} — Официальная оптовая витрина фабрики Мертер (Стамбул) | Merter Vitrini`,
    ar: `${brandName} — معرض المصنع المعتمد للملابس بالجملة في مارتر إسطنبول | Merter Vitrini`,
    de: `${brandName} — Geprüfter Mode-Hersteller Merter Istanbul B2B | Merter Vitrini`,
    fr: `${brandName} — Vitrine Officielle Fabricant Grossiste Merter Istanbul | Merter Vitrini`,
    pl: `${brandName} — Oficjalna Hurtownia Producenta Merter Stambuł B2B | Merter Vitrini`,
    bg: `${brandName} — Официална B2B витрина на производител Мертер Истанбул | Merter Vitrini`,
  };
  return map[lang];
}

function buildBrandMetaDesc(
  brandName: string,
  customDesc: string | undefined,
  lang: SupportedSeoLang
): string {
  if (lang === "tr" && customDesc && customDesc.trim().length > 30) {
    return customDesc.trim().slice(0, 165);
  }
  const map: Record<SupportedSeoLang, string> = {
    tr: `${brandName} üretici ve toptan giyim firmasının Merter açık iletişim bilgileri, WhatsApp sipariş hattı ve %0 komisyonlu seri paket koleksiyonu.`,
    en: `Browse ${brandName} wholesale clothing packs directly from Merter Istanbul. Direct WhatsApp line, verified factory showroom, and 0% commission B2B pricing.`,
    ru: `Оптовая коллекция фабрики ${brandName} (Мертер, Стамбул): прямые контакты WhatsApp, закупка размерными рядами по ценам производителя без комиссии.`,
    ar: `تشكيلة ملابس الجملة من مصنع ${brandName} في مارتر إسطنبول: تواصل مباشر عبر واتساب، بيع بنظام السيري والباكيدج بدون عمولة.`,
    de: `B2B-Großhandelskollektion von ${brandName} aus Merter Istanbul: Direktkontakt per WhatsApp, sortierte Größenserien und 0% Provision ab Werk.`,
    fr: `Collection B2B en gros de ${brandName} (Merter Istanbul) : contact WhatsApp direct, lots par séries de tailles assorties et prix d’usine sans commission.`,
    pl: `Kolekcja hurtowa producenta ${brandName} z Merter Stambuł: bezpośredni WhatsApp, pełne serie rozmiarowe w paczkach i ceny fabryczne bez prowizji.`,
    bg: `Колекция на едро от производителя ${brandName} в Мертер Истанбул: директен WhatsApp, размерни серии и фабрични цени с 0% комисиона.`,
  };
  return map[lang];
}

export async function generateMetadata({
  params,
  searchParams,
}: SupplierShowcasePageProps): Promise<Metadata> {
  const [{ slug }, sParams] = await Promise.all([params, searchParams]);
  const decoded = decodeURIComponent(slug);
  const lang = normalizeSeoLang(sParams?.lang, "tr");
  const brand = await ssrStoreFetch<Brand>(`/brands/${encodeURIComponent(decoded)}`, 300);
  if (!brand) {
    notFound();
  }

  const displayName = brand.name || decoded.toUpperCase();
  const canonicalSlug = encodeURIComponent(brand.slug || decoded);
  const alternates = buildQueryLangAlternates(`/ureticiler/${canonicalSlug}`, lang);
  const title = stripBrandTitleSuffix(buildBrandMetaTitle(displayName, lang));
  const description = buildBrandMetaDesc(displayName, brand.description, lang);

  return {
    title,
    description,
    keywords: `${displayName}, ${GLOBAL_B2B_SEO_MATRIX[lang].keywords}`,
    robots: { index: true, follow: true },
    alternates,
    openGraph: {
      title,
      description,
      url: alternates.canonical,
      siteName: "Merter Vitrini B2B",
      locale: OG_LOCALE_BY_LANG[lang],
      type: "website",
      images: [{ url: `${SITE_ORIGIN}/og-image.jpg`, width: 1200, height: 630, alt: displayName }],
    },
  };
}

export default async function SupplierShowcasePage({
  params,
  searchParams,
}: SupplierShowcasePageProps) {
  const [{ slug }, sParams] = await Promise.all([params, searchParams]);
  const decoded = decodeURIComponent(slug);
  const lang = normalizeSeoLang(sParams?.lang, "tr");

  const [brand, categories] = await Promise.all([
    ssrStoreFetch<Brand>(`/brands/${encodeURIComponent(decoded)}`, 300),
    fetchSsrCategories(),
  ]);

  if (!brand) {
    notFound();
  }

  const productsPayload = brand.id
    ? await fetchSsrProducts(
        `?brand_id=${encodeURIComponent(brand.id)}&limit=48&offset=0`,
        180
      )
    : { products: [], total: 0 };

  const canonicalSlug = encodeURIComponent(brand?.slug || decoded);
  const alternates = buildQueryLangAlternates(`/ureticiler/${canonicalSlug}`, lang);
  const seoCopy = GLOBAL_B2B_SEO_MATRIX[lang];
  const langSuffix = lang === "tr" ? "" : `?lang=${lang}`;

  const sameAsLinks = [
    formatBrandWebsiteUrl(brand?.website),
    formatBrandInstagramUrl(brand?.instagram_handle),
  ].filter(Boolean);

  const showcaseJsonLd = brand
    ? {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Organization",
            "@id": `${alternates.canonical}#manufacturer`,
            name: brand.name,
            url: alternates.canonical,
            description: buildBrandMetaDesc(brand.name, brand.description, lang),
            telephone: brand.phone || brand.landline_phone || brand.whatsapp_phone || undefined,
            email: brand.public_email || undefined,
            sameAs: sameAsLinks.length > 0 ? sameAsLinks : undefined,
            address: {
              "@type": "PostalAddress",
              streetAddress: brand.location_address || "Merter Tekstil Merkezi",
              addressLocality: brand.district || "Güngören",
              addressRegion: brand.city || "İstanbul",
              addressCountry: "TR",
            },
          },
          {
            "@type": "BreadcrumbList",
            "@id": `${alternates.canonical}#breadcrumb`,
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: seoCopy.homeLabel,
                item: `${SITE_ORIGIN}/${lang}`,
              },
              {
                "@type": "ListItem",
                position: 2,
                name: seoCopy.suppliersLabel,
                item: `${SITE_ORIGIN}/ureticiler${langSuffix}`,
              },
              {
                "@type": "ListItem",
                position: 3,
                name: brand.name,
                item: alternates.canonical,
              },
            ],
          },
        ],
      }
    : null;

  return (
    <>
      {showcaseJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(showcaseJsonLd) }}
        />
      )}
      <SupplierShowcaseClient
        key={`${decoded}-${lang}`}
        slug={decoded}
        initialLang={lang}
        initialBrand={brand}
        initialProducts={productsPayload.products}
        initialTotalProducts={productsPayload.total || brand?.active_product_count || 0}
        initialCategories={categories}
      />
    </>
  );
}
