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
import SupplierEditorialProfileClient from "./SupplierEditorialProfileClient";

interface SupplierEditorialPageProps {
  readonly params: Promise<{ slug: string }>;
  readonly searchParams: Promise<{ lang?: string | string[] }>;
}

function buildEditorialTitle(brandName: string, lang: SupportedSeoLang): string {
  const map: Record<SupportedSeoLang, string> = {
    tr: `${brandName} — Firma Tanıtımı, Merter Üretim Gücü & Toptan Alım Rehberi | Merter Vitrini`,
    en: `${brandName} — Merter Apparel Factory Profile & Wholesale Buying Guide | Merter Vitrini`,
    ru: `${brandName} — Обзор фабрики в Мертере (Стамбул) и гид по оптовым закупкам | Merter Vitrini`,
    ar: `${brandName} — ملف المصنع في مارتر إسطنبول ودليل الشراء بالجملة | Merter Vitrini`,
    de: `${brandName} — Herstellerprofil Merter Istanbul & B2B-Einkaufsratgeber | Merter Vitrini`,
    fr: `${brandName} — Profil d’Usine Merter Istanbul & Guide d’Achat en Gros | Merter Vitrini`,
    pl: `${brandName} — Profil Producenta Merter Stambuł i Poradnik Zakupów B2B | Merter Vitrini`,
    bg: `${brandName} — Профил на фабриката в Мертер Истанбул и B2B ръководство | Merter Vitrini`,
  };
  return map[lang];
}

function buildEditorialDesc(brandName: string, lang: SupportedSeoLang): string {
  const map: Record<SupportedSeoLang, string> = {
    tr: `${brandName} üretici ve toptan hazır giyim firmasının Merter üretim standartları, seri paket yapısı, ihracat bölgeleri ve doğrudan fabrikadan sipariş rehberi.`,
    en: `Discover ${brandName}'s Merter Istanbul garment production standards, assorted size-run pack structure, export logistics, and direct factory B2B ordering guide.`,
    ru: `Узнайте о производственных стандартах фабрики ${brandName} в Мертере (Стамбул), составе размерных рядов, регионах экспорта и прямом заказе без посредников.`,
    ar: `تعرّف على معايير الإنتاج لدى مصنع ${brandName} في مارتر إسطنبول، نظام الباكيدج والمقاسات، دول التصدير وخطوات الطلب المباشر بدون وسطاء.`,
    de: `Erfahren Sie alles über die Produktionsstandards von ${brandName} in Merter Istanbul, Größenserien-Pakete, Exportmärkte und den direkten B2B-Werksbezug.`,
    fr: `Découvrez la capacité de production de ${brandName} à Merter Istanbul, la composition des séries assorties, les zones d’export et la commande directe usine.`,
    pl: `Poznaj standardy produkcji firmy ${brandName} w Merter Stambuł, strukturę paczek rozmiarowych, rynki eksportowe oraz zasady bezpośrednich zamówień B2B.`,
    bg: `Научете за производствените стандарти на ${brandName} в Мертер Истанбул, размерните серии, пазарите за износ и директните поръчки от фабриката.`,
  };
  return map[lang];
}

const EDITORIAL_CRUMB_LABEL: Record<SupportedSeoLang, string> = {
  tr: "Firma Rehberi & Tanıtım",
  en: "Factory Profile & Guide",
  ru: "Обзор фабрики",
  ar: "ملف المصنع",
  de: "Firmenprofil",
  fr: "Profil fabricant",
  pl: "Profil producenta",
  bg: "Профил на фабриката",
};

export async function generateMetadata({
  params,
  searchParams,
}: SupplierEditorialPageProps): Promise<Metadata> {
  const [{ slug }, sParams] = await Promise.all([params, searchParams]);
  const decoded = decodeURIComponent(slug);
  const lang = normalizeSeoLang(sParams?.lang, "tr");
  const brand = await ssrStoreFetch<Brand>(`/brands/${encodeURIComponent(decoded)}`, 300);
  if (!brand) {
    notFound();
  }

  const displayName = brand.name || decoded.toUpperCase();
  const canonicalSlug = encodeURIComponent(brand.slug || decoded);
  const alternates = buildQueryLangAlternates(`/ureticiler/${canonicalSlug}/tanitim`, lang);
  const title = stripBrandTitleSuffix(buildEditorialTitle(displayName, lang));
  const description = buildEditorialDesc(displayName, lang);

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
      type: "article",
      images: [{ url: `${SITE_ORIGIN}/og-image.jpg`, width: 1200, height: 630, alt: displayName }],
    },
  };
}

export default async function SupplierEditorialPage({
  params,
  searchParams,
}: SupplierEditorialPageProps) {
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
        `?brand_id=${encodeURIComponent(brand.id)}&limit=8&offset=0`,
        180
      )
    : { products: [], total: 0 };

  const canonicalSlug = encodeURIComponent(brand?.slug || decoded);
  const alternates = buildQueryLangAlternates(`/ureticiler/${canonicalSlug}/tanitim`, lang);
  const seoCopy = GLOBAL_B2B_SEO_MATRIX[lang];
  const langSuffix = lang === "tr" ? "" : `?lang=${lang}`;

  const editorialJsonLd = brand
    ? {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Article",
            "@id": `${alternates.canonical}#article`,
            headline: buildEditorialTitle(brand.name, lang),
            description: buildEditorialDesc(brand.name, lang),
            inLanguage: lang,
            image: [`${SITE_ORIGIN}/og-image.jpg`],
            author: {
              "@type": "Organization",
              name: "Merter Vitrini B2B",
              url: SITE_ORIGIN,
            },
            publisher: {
              "@id": `${SITE_ORIGIN}/#organization`,
            },
            about: {
              "@type": "Organization",
              name: brand.name,
              url: `${SITE_ORIGIN}/ureticiler/${canonicalSlug}${langSuffix}`,
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
                item: `${SITE_ORIGIN}/ureticiler/${canonicalSlug}${langSuffix}`,
              },
              {
                "@type": "ListItem",
                position: 4,
                name: EDITORIAL_CRUMB_LABEL[lang],
                item: alternates.canonical,
              },
            ],
          },
        ],
      }
    : null;

  return (
    <>
      {editorialJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(editorialJsonLd) }}
        />
      )}
      <SupplierEditorialProfileClient
        key={`${decoded}-${lang}`}
        slug={decoded}
        initialLang={lang}
        initialBrand={brand}
        initialFeaturedProducts={productsPayload.products}
        initialTotalProducts={productsPayload.total || brand?.active_product_count || 0}
        initialCategories={categories}
      />
    </>
  );
}
