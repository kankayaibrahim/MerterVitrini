import React from "react";
import type { Metadata } from "next";
import BuyerRfqBoardClient from "./BuyerRfqBoardClient";
import {
  GLOBAL_B2B_SEO_MATRIX,
  OG_LOCALE_BY_LANG,
  SITE_ORIGIN,
  SupportedSeoLang,
  buildQueryLangAlternates,
  fetchSsrCategories,
  normalizeSeoLang,
  safeJsonLd,
  stripBrandTitleSuffix,
} from "@/utils/seoHelpers";

interface RfqSeoMetaCopy {
  readonly title: string;
  readonly description: string;
  readonly breadcrumbLabel: string;
}

const RFQ_SEO_META: Record<SupportedSeoLang, RfqSeoMetaCopy> = {
  tr: {
    title: "Alıcı Talep Panosu (B2B Toptan Alım İlanları / RFQ) | Merter Vitrini",
    description:
      "Küresel toptan giyim alıcılarının hazır stok, Private Label ve fason üretim alım ilanları (RFQ). Ücretsiz alım talebi açın, doğrulanmış Merter üreticilerinden doğrudan teklif alın.",
    breadcrumbLabel: "Alıcı Talep Panosu (RFQ)",
  },
  en: {
    title: "B2B Wholesale Clothing Buying Leads & RFQ Board — Merter Manufacturers",
    description:
      "Post wholesale apparel buying requests (RFQ) for ready-stock size-run packs, private label OEM, or CMT production and receive direct factory quotes from verified Merter Istanbul manufacturers.",
    breadcrumbLabel: "Wholesale Buying Leads (RFQ)",
  },
  ru: {
    title: "Доска оптовых закупок и заявок (RFQ) — Одежда оптом из Турции Мертер",
    description:
      "Разместите заявку на оптовую закупку готовых серий, пошив под своим брендом (Private Label) или контрактное производство и получайте прямые предложения от фабрик Мертера (Стамбул).",
    breadcrumbLabel: "Заявки покупателей (RFQ)",
  },
  ar: {
    title: "لوحة طلبات الشراء بالجملة والتصنيع (RFQ) — مصانع ملابس مارتر إسطنبول",
    description:
      "انشر طلب الشراء بالجملة للكميات الجاهزة أو التصنيع باسم علامتك التجارية (Private Label) واحصل على عروض أسعار مباشرة من مصانع الملابس المعتمدة في مارتر إسطنبول.",
    breadcrumbLabel: "طلبات الشراء بالجملة (RFQ)",
  },
  de: {
    title: "B2B Textil-Ausschreibungen & Kaufgesuche (RFQ) — Merter Hersteller Istanbul",
    description:
      "Veröffentlichen Sie Großhandels-Kaufgesuche (RFQ) für Serienware, Private-Label-Produktion oder Lohnfertigung und erhalten Sie direkte Angebote von geprüften Merter Textilfabriken.",
    breadcrumbLabel: "B2B Kaufgesuche (RFQ)",
  },
  fr: {
    title: "Appels d'Offres & Demandes d'Achat B2B (RFQ) — Fabricants Textile Merter Istanbul",
    description:
      "Publiez vos demandes de devis en gros (RFQ) pour collections prêtes en série, marque blanche (Private Label) ou façonnage et recevez des offres directes des usines de Merter Istanbul.",
    breadcrumbLabel: "Appels d'Offres B2B (RFQ)",
  },
  pl: {
    title: "Tablica Zapytań Ofertowych B2B (RFQ) — Producenci Odzieży Merter Stambuł",
    description:
      "Dodaj bezpłatne zapytanie hurtowe (RFQ) na gotowe paczki odzieży, produkcję Private Label lub szycie kontraktowe i otrzymuj bezpośrednie oferty z fabryk w Merter Stambuł.",
    breadcrumbLabel: "Zapytania Ofertowe (RFQ)",
  },
  bg: {
    title: "Борса за B2B търсене и запитвания на едро (RFQ) — Производители Мертер Истанбул",
    description:
      "Публикувайте безплатно запитване за покупка на едро (RFQ) на готови серии, Private Label или ишлеме и получете директни оферти от проверени фабрики в Мертер Истанбул.",
    breadcrumbLabel: "B2B запитвания (RFQ)",
  },
};

interface BuyerRfqPageProps {
  readonly searchParams: Promise<{ lang?: string }>;
}

export async function generateMetadata({
  searchParams,
}: BuyerRfqPageProps): Promise<Metadata> {
  const resolved = await searchParams;
  const lang = normalizeSeoLang(resolved?.lang, "tr");
  const meta = RFQ_SEO_META[lang];
  const alternates = buildQueryLangAlternates("/alim-talepleri", lang);

  return {
    title: stripBrandTitleSuffix(meta.title),
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

export default async function BuyerRfqBoardPage({
  searchParams,
}: BuyerRfqPageProps) {
  const resolved = await searchParams;
  const lang = normalizeSeoLang(resolved?.lang, "tr");
  const meta = RFQ_SEO_META[lang];
  const matrix = GLOBAL_B2B_SEO_MATRIX[lang];
  const canonicalUrl =
    lang === "tr"
      ? `${SITE_ORIGIN}/alim-talepleri`
      : `${SITE_ORIGIN}/alim-talepleri?lang=${lang}`;

  const categories = await fetchSsrCategories();

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${canonicalUrl}#webpage`,
        url: canonicalUrl,
        name: meta.title,
        description: meta.description,
        inLanguage: lang,
        isPartOf: { "@id": `${SITE_ORIGIN}/#website` },
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
      <BuyerRfqBoardClient
        key={lang}
        initialLang={lang}
        initialCategories={categories}
      />
    </>
  );
}
