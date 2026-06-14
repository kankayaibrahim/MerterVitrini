import React from "react";
import { Metadata } from "next";
import StorefrontLayout from "@/components/store/StorefrontLayout";

interface PageProps {
  params: Promise<{
    categoryPrefix: string;
  }>;
}

// Generate static routes for all active language prefixes at compile time
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

// Generate localized SEO metadata for each language prefix for the All Products page
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { categoryPrefix } = await params;

  const titles: Record<string, string> = {
    tr: "Toptan Giyim Kataloğu | Merter Vitrini B2B",
    en: "Wholesale Clothing Catalog | Merter Vitrini B2B",
    pl: "Hurtownia Odzieży Katalog | Merter Vitrini B2B",
    bg: "Каталог за Дрехи на Едро | Merter Vitrini B2B",
    ar: "كتالوج الملابس بالجملة | مرتر فيتريني B2B",
    ru: "Каталог Оптовой Одежды | Merter Vitrini B2B",
    de: "Großhandel Bekleidungskatalog | Merter Vitrini B2B",
    fr: "Catalogue de Vêtements en Gros | Merter Vitrini B2B"
  };

  const descs: Record<string, string> = {
    tr: "Merter'in en seçkin üreticilerinin ihraç fazlası ve yeni sezon toptan hazır giyim koleksiyonlarını en uygun fiyatlarla inceleyin.",
    en: "Browse surplus and new season wholesale apparel collections from Istanbul Merter's leading manufacturers.",
    pl: "Przeglądaj hurtowe kolekcje odzieży damskiej i męskiej od wiodących producentów ze Stambułu w najlepszych cenach.",
    bg: "Разгледайте колекциите от дрехи на едро от водещи производители в Истанбул Мертер на най-добри цени.",
    ar: "تصفح مجموعات ملابس الجملة للموسم الجديد من كبار المصنعين في مرتر اسطنبول بأفضل الأسعار.",
    ru: "Просматривайте коллекции оптовой одежды нового сезона от ведущих стамбульских производителей из Мертера.",
    de: "Durchsuchen Sie Großhandelskollektionen für Damen- und Herrenmode von führenden Herstellern aus Istanbul Merter.",
    fr: "Découvrez les collections de prêt-à-porter en gros de saison des meilleurs fabricants d'Istanbul Merter."
  };

  const title = titles[categoryPrefix] || titles.en;
  const desc = descs[categoryPrefix] || descs.en;

  const canonicalUrl = `https://mertervitrini.com.tr/${categoryPrefix}/tum-urunler/`;
  const languagesList = ["tr", "en", "pl", "bg", "ar", "ru", "de", "fr"];
  const alternatesLanguages = Object.fromEntries(
    languagesList
      .filter((code) => code !== "__proto__" && code !== "constructor")
      .map((code) => [code, `https://mertervitrini.com.tr/${code}/tum-urunler/`])
  );

  return {
    title: `${title}`,
    description: desc,
    alternates: {
      canonical: canonicalUrl,
      languages: alternatesLanguages,
    },
    openGraph: {
      title: `${title}`,
      description: desc,
      url: canonicalUrl,
      siteName: "Merter Vitrini",
      locale: categoryPrefix === "tr" ? "tr_TR" : "en_US",
      type: "website",
    }
  };
}

export default async function LocalizedTumUrunlerPage({ params }: PageProps) {
  const { categoryPrefix } = await params;

  // Map categoryPrefix to defaultLang
  const prefixToLangMap: Record<string, string> = {
    tr: "tr",
    en: "en",
    pl: "pl",
    bg: "bg",
    ar: "ar",
    ru: "ru",
    de: "de",
    fr: "fr"
  };

  const defaultLang = prefixToLangMap[categoryPrefix] || "tr";

  return (
    <StorefrontLayout 
      mode="catalog" 
      defaultLang={defaultLang} 
    />
  );
}
