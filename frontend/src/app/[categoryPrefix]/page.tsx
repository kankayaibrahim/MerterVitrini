import React from "react";
import { Metadata } from "next";
import StorefrontLayout from "@/components/store/StorefrontLayout";

interface PageProps {
  readonly params: Promise<{ readonly categoryPrefix: string }>;
}

// Generate static routes for all active language prefixes at compile time (essential for static export mode)
export async function generateStaticParams() {
  return [
    { categoryPrefix: "tr" },
    { categoryPrefix: "en" },
    { categoryPrefix: "pl" },
    { categoryPrefix: "bg" },
    { categoryPrefix: "ar" },
    { categoryPrefix: "ru" },
    { categoryPrefix: "de" },
    { categoryPrefix: "fr" }
  ];
}

// Generate localized dynamic SEO metadata for each language root page
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { categoryPrefix } = await params;
  
  const titles: Record<string, string> = {
    tr: "Toptan Giyim Türkiye - Doğrudan İstanbul İmalatçılarından Alın",
    en: "Wholesale Clothing Turkey - Buy Directly from Istanbul Suppliers",
    pl: "Hurtownia Odzieży Turcja - Kupuj Bezpośrednio od Dostawców ze Stambułu",
    bg: "Дрехи на Едро Турция - Купете Директно от Доставчици в Истанбул",
    ar: "ملابس بالجملة تركيا - اشترِ مباشرة من موردي اسطنبول",
    ru: "Одежда Оптом Турция - Покупайте Напрямую у Стамбульских Поставщиков",
    de: "Großhandel Bekleidung Türkei - Kaufen Sie direkt bei Lieferanten in Istanbul",
    fr: "Vêtements en Gros Turquie - Achetez Directement auprès des Fournisseurs d'Istanbul"
  };

  const descs: Record<string, string> = {
    tr: "Türkiye'nin lider üreticilerinden en uygun fabrika fiyatlarıyla toptan hazır giyim koleksiyonlarını keşfedin. Merter toptan giyim online.",
    en: "Discover surplus stock and brand new season wholesale ready-to-wear collections from Turkey's leading manufacturers at best factory prices. Turkish wholesale clothing online.",
    pl: "Odkryj zapasy magazynowe i kolekcje hurtowe odzieży gotowej od wiodących producentów z Turcji w najlepszych cenach fabrycznych.",
    bg: "Открийте складови наличности и колекции на едро от водещи производители в Турция на най-добри фабрични цени.",
    ar: "اكتشف مخзون الفائض ومجموعات الملابس الجاهزة بالجملة للموسم الجديد من الشركات المصнعة الرائدة في تركيا بأفضل أسعار المصنع.",
    ru: "Откройте для себя складские остатки и оптовые коллекции готовой одежды нового сезона от ведущих турецких производителей по лучшим ценам.",
    de: "Entdecken Sie Restposten und Großhandelskollektionen führender türkischer Hersteller zu besten Fabrikpreisen.",
    fr: "Découvrez les fins de séries et les collections de prêt-à-porter en gros des principaux fabricants turcs aux meilleurs prix d'usine."
  };

  const title = titles[categoryPrefix] || titles.en;
  const desc = descs[categoryPrefix] || descs.en;

  const canonicalUrl = `https://mertervitrini.com.tr/${categoryPrefix}`;
  const languagesList = ["tr", "en", "pl", "bg", "ar", "ru", "de", "fr"];
  const alternatesLanguages: Record<string, string> = {
    "x-default": "https://mertervitrini.com.tr/en",
  };
  languagesList.forEach((code) => {
    alternatesLanguages[code] = `https://mertervitrini.com.tr/${code}`;
  });

  return {
    title: title,
    description: desc,
    alternates: {
      canonical: canonicalUrl,
      languages: alternatesLanguages,
    },
    openGraph: {
      title: title,
      description: desc,
      url: canonicalUrl,
      siteName: "Merter Vitrini",
      images: [
        {
          url: "https://mertervitrini.com.tr/placeholder.png",
          width: 800,
          height: 600,
          alt: title,
        }
      ],
      locale: categoryPrefix === "tr" ? "tr_TR" : "en_US",
      type: "website",
    }
  };
}

export default async function LocalizedHomePage({ params }: PageProps) {
  const { categoryPrefix } = await params;
  
  const langMap: Record<string, string> = {
    tr: "tr",
    en: "en",
    pl: "pl",
    bg: "bg",
    ar: "ar",
    ru: "ru",
    de: "de",
    fr: "fr"
  };
  
  const defaultLang = langMap[categoryPrefix] || "en";

  const siteJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "name": "Merter Vitrini",
        "legalName": "Merter Vitrini B2B Toptan Tekstil ve Hazır Giyim",
        "url": `https://mertervitrini.com.tr/${categoryPrefix}`,
        "logo": "https://mertervitrini.com.tr/logo.png",
        "description": desc,
        "contactPoint": {
          "@type": "ContactPoint",
          "telephone": "+90-532-000-0000",
          "contactType": "sales",
          "availableLanguage": ["Turkish", "English", "Russian", "Arabic", "French", "German", "Polish", "Bulgarian"],
          "areaServed": ["TR", "DE", "FR", "PL", "RU", "AE", "SA", "US", "BG"],
        },
      },
      {
        "@type": "WebSite",
        "name": "Merter Vitrini",
        "url": `https://mertervitrini.com.tr/${categoryPrefix}`,
        "potentialAction": {
          "@type": "SearchAction",
          "target": `https://mertervitrini.com.tr/${categoryPrefix}/tum-urunler?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }}
      />
      <StorefrontLayout mode="portal" defaultLang={defaultLang} />
    </>
  );
}
