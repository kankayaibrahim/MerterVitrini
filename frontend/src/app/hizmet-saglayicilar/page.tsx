import React from "react";
import type { Metadata } from "next";
import ServiceProvidersClient, {
  ServiceProviderItem,
} from "./ServiceProvidersClient";
import {
  GLOBAL_B2B_SEO_MATRIX,
  OG_LOCALE_BY_LANG,
  SITE_ORIGIN,
  SupportedSeoLang,
  buildQueryLangAlternates,
  fetchSsrCategories,
  normalizeSeoLang,
  safeJsonLd,
  ssrStoreFetch,
} from "@/utils/seoHelpers";

interface ServiceProvidersSeoCopy {
  readonly title: string;
  readonly description: string;
  readonly breadcrumbLabel: string;
}

const SERVICE_PROVIDERS_SEO_META: Record<
  SupportedSeoLang,
  ServiceProvidersSeoCopy
> = {
  tr: {
    title:
      "Sektörel Hizmet Sağlayıcılar Rehberi — Kargo, Fotoğraf Stüdyosu, Etiket, Modelhane & İhracat | Merter Vitrini",
    description:
      "Merter toptan tekstil ekosistemi için doğrulanmış uluslararası kargo/lojistik firmaları, mankenli katalog çekim stüdyoları, dokuma etiket/ambalaj üreticileri, dijital modelhaneler ve ihracat danışmanları rehberi.",
    breadcrumbLabel: "Sektörel Hizmet Sağlayıcılar",
  },
  en: {
    title:
      "Merter B2B Textile Service Providers Directory — Export Cargo, Studios, Labels, Pattern Makers & Customs",
    description:
      "Connect directly with verified international textile cargo & consolidation forwarders, fashion lookbook studios, woven label & packaging makers, CAD pattern houses, and export customs brokers in Merter Istanbul.",
    breadcrumbLabel: "B2B Service Providers",
  },
  ru: {
    title:
      "Каталог B2B услуг Мертера — Карго доставка из Турции, Фотостудии, Бирки, Лекала и Экспорт",
    description:
      "Проверенные карго-перевозчики одежды из Турции (Мертер, Стамбул) в РФ и СНГ, модельные фотостудии, производство тканых бирок/упаковки, конструкторские бюро и таможенные брокеры.",
    breadcrumbLabel: "Каталог B2B партнеров",
  },
  ar: {
    title:
      "دليل شركات الخدمات اللوجستية والنسيجية في مارتر — شحن دولي، استوديوهات تصوير، ليبل وتخليص جمركي",
    description:
      "تواصل مباشرة مع شركات الشحن الدولي وتجميع البضائع المعتمدة في مارتر إسطنبول، استوديوهات تصوير الأزياء، مصانع الليبل والتغليف، مكاتب الباترون والاستشارات التصديرية.",
    breadcrumbLabel: "دليل مزودي الخدمات B2B",
  },
  de: {
    title:
      "Merter B2B Textil-Dienstleisterverzeichnis — Spedition, Fotostudios, Webetiketten, Schnittmuster & Zoll",
    description:
      "Geprüfte internationale Textilspeditionen, Mode-Fotostudios, Private-Label-Etikettenhersteller, CAD-Schnittateliers und Export-/Zollberater (ATR/EUR.1) in Merter Istanbul.",
    breadcrumbLabel: "B2B Dienstleister",
  },
  fr: {
    title:
      "Annuaire des Prestataires B2B Textile Merter — Cargo Export, Studios Photo, Étiquettes & Modélisme",
    description:
      "Contactez directement les transitaires cargo internationaux, studios photo lookbook, fabricants d'étiquettes tissées, bureaux de modélisme CAO et experts douane export à Merter Istanbul.",
    breadcrumbLabel: "Prestataires B2B Textile",
  },
  pl: {
    title:
      "Katalog Usług B2B Tekstylia Merter — Spedycja Cargo, Studia Foto, Metki Tkane, Konstrukcja Odzieży i Cło",
    description:
      "Zweryfikowane firmy spedycyjne i konsolidacyjne z Turcji, studia fotografii modowej, producenci metek Private Label, wzorcownie CAD oraz agencje celne w Merter Stambuł.",
    breadcrumbLabel: "Partnerzy Usługowi B2B",
  },
  bg: {
    title:
      "Каталог на B2B текстилни услуги в Мертер — Карго транспорт, Фотостудиа, Етикети, Кройки и Износ",
    description:
      "Свържете се директно с проверени спедитори и карго фирми от Мертер Истанбул, модни фотостудиа, производители на тъкани етикети, конструктори на облекло и митнически консултанти.",
    breadcrumbLabel: "B2B доставчици на услуги",
  },
};

interface ServiceProvidersPageProps {
  readonly searchParams: Promise<{ lang?: string }>;
}

export async function generateMetadata({
  searchParams,
}: ServiceProvidersPageProps): Promise<Metadata> {
  const resolved = await searchParams;
  const lang = normalizeSeoLang(resolved?.lang, "tr");
  const meta = SERVICE_PROVIDERS_SEO_META[lang];
  const alternates = buildQueryLangAlternates("/hizmet-saglayicilar", lang);

  return {
    title: meta.title,
    description: meta.description,
    keywords: GLOBAL_B2B_SEO_MATRIX[lang].keywords,
    alternates,
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: alternates.canonical,
      siteName: "Merter Vitrini B2B Wholesale",
      locale: OG_LOCALE_BY_LANG[lang],
      type: "website",
      images: [{ url: `${SITE_ORIGIN}/og-image.jpg`, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.description,
      images: [`${SITE_ORIGIN}/og-image.jpg`],
    },
  };
}

export default async function ServiceProvidersDirectoryPage({
  searchParams,
}: ServiceProvidersPageProps) {
  const resolved = await searchParams;
  const lang = normalizeSeoLang(resolved?.lang, "tr");
  const meta = SERVICE_PROVIDERS_SEO_META[lang];
  const matrix = GLOBAL_B2B_SEO_MATRIX[lang];
  const canonicalUrl =
    lang === "tr"
      ? `${SITE_ORIGIN}/hizmet-saglayicilar`
      : `${SITE_ORIGIN}/hizmet-saglayicilar?lang=${lang}`;

  const [providersResp, categories] = await Promise.all([
    ssrStoreFetch<ServiceProviderItem[]>(
      "/service-providers?category=all&q=",
      300
    ),
    fetchSsrCategories(),
  ]);
  const initialItems = Array.isArray(providersResp) ? providersResp : [];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${canonicalUrl}#webpage`,
        url: canonicalUrl,
        name: meta.title,
        description: meta.description,
        inLanguage: lang,
        isPartOf: { "@id": `${SITE_ORIGIN}/#website` },
      },
      {
        "@type": "ItemList",
        name: meta.breadcrumbLabel,
        numberOfItems: initialItems.length,
        itemListElement: initialItems.slice(0, 40).map((item, idx) => ({
          "@type": "ListItem",
          position: idx + 1,
          item: {
            "@type": "ProfessionalService",
            name: item.company_name,
            description:
              item.translations?.[lang]?.short_description ||
              item.short_description,
            telephone: item.phone || undefined,
            address: item.address
              ? {
                  "@type": "PostalAddress",
                  streetAddress: item.address,
                  addressLocality: item.district || "Merter, Güngören",
                  addressRegion: item.city || "İstanbul",
                  addressCountry: "TR",
                }
              : undefined,
          },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: matrix.homeLabel,
            item: `${SITE_ORIGIN}/${lang}`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: meta.breadcrumbLabel,
            item: canonicalUrl,
          },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />
      <ServiceProvidersClient
        key={lang}
        initialLang={lang}
        initialItems={initialItems}
        initialCategories={categories}
      />
    </>
  );
}
