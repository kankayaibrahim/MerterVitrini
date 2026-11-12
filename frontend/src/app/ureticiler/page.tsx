import React from "react";
import type { Metadata } from "next";
import type { Brand } from "@/types/store";
import {
  SITE_ORIGIN,
  OG_LOCALE_BY_LANG,
  GLOBAL_B2B_SEO_MATRIX,
  SupportedSeoLang,
  normalizeSeoLang,
  buildQueryLangAlternates,
  safeJsonLd,
  ssrStoreFetch,
  fetchSsrCategories,
} from "@/utils/seoHelpers";
import SuppliersDirectoryClient from "./SuppliersDirectoryClient";

interface PageProps {
  readonly searchParams: Promise<{ lang?: string | string[] }>;
}

const DIRECTORY_TITLES: Record<SupportedSeoLang, string> = {
  tr: "Merter Doğrulanmış Üretici & Toptan Giyim Firmaları Rehberi | Merter Vitrini",
  en: "Verified Merter Clothing Manufacturers & Turkish Wholesale Suppliers Directory | Merter Vitrini",
  ru: "Каталог проверенных фабрик одежды Мертер (Стамбул) без посредников | Merter Vitrini",
  ar: "دليل مصانع الملابس المعتمدة في مارتر إسطنبول بدون وسطاء | Merter Vitrini",
  de: "Geprüfte Textilhersteller Merter Istanbul — B2B Herstellerverzeichnis | Merter Vitrini",
  fr: "Annuaire des Fabricants Textiles Vérifiés de Merter Istanbul B2B | Merter Vitrini",
  pl: "Katalog Zweryfikowanych Producentów Odzieży Merter Stambuł B2B | Merter Vitrini",
  bg: "Каталог на проверени производители на дрехи в Мертер Истанбул | Merter Vitrini",
};

const DIRECTORY_DESCS: Record<SupportedSeoLang, string> = {
  tr: "İstanbul Merter tekstil piyasasının doğrulanmış üretici, toptan hazır giyim, Private Label ve fason üretim firmaları rehberi. %0 komisyonla doğrudan üreticiyle çalışın.",
  en: "Connect directly with verified Merter Istanbul apparel factories, bulk size-run wholesalers, and Private Label OEM clothing manufacturers with 0% commission.",
  ru: "Прямые контакты проверенных швейных фабрик и оптовых поставщиков одежды района Мертер (Стамбул): WhatsApp, адреса шоурумов, серии и пошив Private Label без комиссии.",
  ar: "تواصل مباشرة بدون عمولة مع مصانع الملابس الجاهزة وشركات الجملة المعتمدة في سوق مارتر إسطنبول: واتساب مباشر، عناوين المعارض وتصنيع خاص.",
  de: "Direktkontakt zu geprüften Bekleidungsherstellern in Merter Istanbul: 0% Provision, Serienpakete ab Werk, Private Label & Lohnfertigung.",
  fr: "Contactez directement les usines de confection et grossistes vérifiés de Merter Istanbul : 0% de commission, séries assorties et fabrication Private Label.",
  pl: "Bezpośredni kontakt ze sprawdzonymi fabrykami odzieży w Merter Stambuł: 0% prowizji, sprzedaż hurtowa w paczkach oraz produkcja Private Label.",
  bg: "Директен контакт с проверени фабрики за дрехи в Мертер Истанбул: 0% комисиона, продажба на серии, ишлеме и Private Label производство.",
};

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const sParams = await searchParams;
  const lang = normalizeSeoLang(sParams?.lang, "tr");
  const title = DIRECTORY_TITLES[lang];
  const desc = DIRECTORY_DESCS[lang];
  const alternates = buildQueryLangAlternates("/ureticiler", lang);

  return {
    title,
    description: desc,
    keywords: GLOBAL_B2B_SEO_MATRIX[lang].keywords,
    alternates,
    openGraph: {
      title,
      description: desc,
      url: alternates.canonical,
      siteName: "Merter Vitrini B2B",
      locale: OG_LOCALE_BY_LANG[lang],
      type: "website",
      images: [{ url: `${SITE_ORIGIN}/og-image.jpg`, width: 1200, height: 630, alt: title }],
    },
  };
}

export default async function SuppliersDirectoryPage({ searchParams }: PageProps) {
  const sParams = await searchParams;
  const lang = normalizeSeoLang(sParams?.lang, "tr");

  const [brandsData, categories] = await Promise.all([
    ssrStoreFetch<Brand[]>("/brands", 300),
    fetchSsrCategories(),
  ]);

  const brands = Array.isArray(brandsData) ? brandsData : [];
  const activeBrands = brands.filter((b) => (b.active_product_count ?? 0) > 0);
  const alternates = buildQueryLangAlternates("/ureticiler", lang);
  const seoCopy = GLOBAL_B2B_SEO_MATRIX[lang];
  const langSuffix = lang === "tr" ? "" : `?lang=${lang}`;

  const directoryJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${alternates.canonical}#directory`,
        url: alternates.canonical,
        name: DIRECTORY_TITLES[lang],
        description: DIRECTORY_DESCS[lang],
        inLanguage: lang,
      },
      {
        "@type": "ItemList",
        "@id": `${alternates.canonical}#manufacturers`,
        numberOfItems: activeBrands.length,
        itemListElement: activeBrands.slice(0, 50).map((brand, idx) => ({
          "@type": "ListItem",
          position: idx + 1,
          name: brand.name,
          url: `${SITE_ORIGIN}/ureticiler/${encodeURIComponent(brand.slug || brand.id)}${langSuffix}`,
        })),
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
            item: alternates.canonical,
          },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(directoryJsonLd) }}
      />
      <SuppliersDirectoryClient
        key={lang}
        initialLang={lang}
        initialBrands={brands}
        initialCategories={categories}
      />
    </>
  );
}
