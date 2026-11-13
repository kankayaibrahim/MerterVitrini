import React from "react";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import B2BClient, { StoreSettings, B2BCMSPage, Language } from "./B2BClient";
import {
  SITE_ORIGIN,
  SupportedSeoLang,
  isSupportedSeoLang,
  OG_LOCALE_BY_LANG,
  GLOBAL_B2B_SEO_MATRIX,
  normalizeSeoLang,
  stripBrandTitleSuffix,
  buildPrefixedAlternates,
  ssrStoreFetch,
  fetchSsrCategories,
} from "@/utils/seoHelpers";

export const dynamic = "force-dynamic";

interface RawLangItem {
  code: string;
  label: string;
  flag: string;
  categoryPrefix?: string;
  category_prefix?: string;
  dir?: string;
  isActive?: boolean;
  is_active?: boolean;
  sortOrder?: number;
  sort_order?: number;
}

interface PageProps {
  readonly params: Promise<{
    readonly categoryPrefix: string;
  }>;
}

const FALLBACK_LANGUAGES: Language[] = [
  { code: "tr", label: "Türkçe", flag: "🇹🇷", categoryPrefix: "tr", isActive: true, sortOrder: 0 },
  { code: "en", label: "English", flag: "🇬🇧", categoryPrefix: "en", isActive: true, sortOrder: 1 },
  { code: "pl", label: "Polski", flag: "🇵🇱", categoryPrefix: "pl", isActive: true, sortOrder: 2 },
  { code: "bg", label: "Български", flag: "🇧🇬", categoryPrefix: "bg", isActive: true, sortOrder: 3 },
  { code: "ar", label: "العربية", flag: "🇸🇦", dir: "rtl", categoryPrefix: "ar", isActive: true, sortOrder: 4 },
  { code: "ru", label: "Русский", flag: "🇷🇺", categoryPrefix: "ru", isActive: true, sortOrder: 5 },
  { code: "de", label: "Deutsch", flag: "🇩🇪", categoryPrefix: "de", isActive: true, sortOrder: 6 },
  { code: "fr", label: "Français", flag: "🇫🇷", categoryPrefix: "fr", isActive: true, sortOrder: 7 },
];

async function fetchLanguages(): Promise<Language[]> {
  const data = await ssrStoreFetch<RawLangItem[]>("/languages", 3600);
  if (Array.isArray(data) && data.length > 0) {
    return data.map((l) => {
      const code = normalizeSeoLang(l.code, "en");
      return {
        code,
        label: l.label,
        flag: l.flag,
        categoryPrefix: l.categoryPrefix || l.category_prefix || code,
        dir: l.dir,
        isActive: l.isActive ?? l.is_active ?? true,
        sortOrder: l.sortOrder ?? l.sort_order ?? 0,
      };
    });
  }
  return FALLBACK_LANGUAGES;
}

function resolveLang(categoryPrefix: string, activeLangs: Language[]): SupportedSeoLang {
  const matched = activeLangs.find((l) => l.categoryPrefix === categoryPrefix);
  return normalizeSeoLang(matched?.code || categoryPrefix, "tr");
}

const B2B_TITLES: Record<SupportedSeoLang, string> = {
  tr: "Toptan Satış & B2B Tedarik | Merter Vitrini Hazır Giyim",
  en: "Wholesale & B2B Fashion Sourcing | Merter Vitrini Istanbul",
  ru: "Оптовые Продажи и B2B Поставки | Merter Vitrini Стамбул",
  ar: "تجارة الجملة وتوريد الأزياء B2B | مارتر فيتريني إسطنبول",
  pl: "Hurtownia i Zaopatrzenie B2B | Merter Vitrini Stambuł",
  bg: "Търговия на Едро & B2B Доставки | Merter Vitrini Истанбул",
  de: "Großhandel & B2B Modebeschaffung | Merter Vitrini Istanbul",
  fr: "Vente en Gros & B2B Sourcing | Merter Vitrini Istanbul",
};

const B2B_DESCRIPTIONS: Record<SupportedSeoLang, string> = {
  tr: "İstanbul Merter tekstil üreticilerinden doğrudan toptan hazır giyim alımı, asorti beden serileri, minimum sipariş miktarları (MOQ), fason/Private Label üretim ve uluslararası ihracat kargo şartları.",
  en: "Direct wholesale ready-to-wear apparel sourcing from Istanbul Merter manufacturers. Size-run packs, low MOQ, private label OEM, and global consolidated freight forwarding.",
  ru: "Прямые оптовые закупки одежды от турецких фабрик Мертера (Стамбул) без посредников: размерные ряды, низкий MOQ, Private Label и доставка карго в Россию и СНГ.",
  ar: "توريد الملابس التركية الجاهزة بالجملة مباشرة من مصانع مارتر إسطنبول بدون وسطاء: نظام الباكيدج، تصنيع خاص (Private Label) وشحن دولي سريع.",
  pl: "Bezpośrednie zakupy hurtowe odzieży od producentów z Merter w Stambule: pełne serie rozmiarowe w paczkach, niskie MOQ, Private Label i szybki transport do Polski.",
  bg: "Директни доставки на едро от фабрики в Мертер, Истанбул без посредници: размерни серии, нисък MOQ, ишлеме/Private Label и карго до България.",
  de: "Direkter B2B-Großhandelseinkauf bei Textilherstellern in Merter Istanbul: sortierte Serienpakete, niedrige MOQ, Private Label und schneller EU-Versand mit ATR.",
  fr: "Approvisionnement direct en gros auprès des fabricants de Merter Istanbul : lots par séries de tailles, marque blanche à faible MOQ et fret international.",
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { categoryPrefix } = await params;
  if (!isSupportedSeoLang(categoryPrefix)) {
    notFound();
  }
  const activeLangs = await fetchLanguages();
  const lang = resolveLang(categoryPrefix, activeLangs);
  const title = stripBrandTitleSuffix(B2B_TITLES[lang]);
  const description = B2B_DESCRIPTIONS[lang];
  const alternates = buildPrefixedAlternates("b2b", lang);

  return {
    title,
    description,
    keywords: GLOBAL_B2B_SEO_MATRIX[lang].keywords,
    alternates,
    openGraph: {
      title,
      description,
      url: alternates.canonical,
      siteName: "Merter Vitrini B2B",
      locale: OG_LOCALE_BY_LANG[lang],
      images: [{ url: `${SITE_ORIGIN}/og-image.jpg`, width: 1200, height: 630, alt: title }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${SITE_ORIGIN}/og-image.jpg`],
    },
  };
}

export default async function B2BPage({ params }: Readonly<PageProps>) {
  const { categoryPrefix } = await params;
  if (!isSupportedSeoLang(categoryPrefix)) {
    notFound();
  }

  const [activeLangs, categories, settingsData, pageData] = await Promise.all([
    fetchLanguages(),
    fetchSsrCategories(),
    ssrStoreFetch<StoreSettings>("/settings", 300),
    ssrStoreFetch<B2BCMSPage>("/pages/b2b", 300),
  ]);

  const fallbackSettings: StoreSettings = {
    id: "default-settings",
    address: "Mehmet Nesih Özmen Mah., Merter Tekstil Merkezi, Güngören / İstanbul / Türkiye",
    phone: "+90 533 703 08 83",
    whatsapp: "+90 533 703 08 83",
    email: "info@mertervitrini.com.tr",
    show_single_price: false,
    updated_at: new Date().toISOString(),
  };

  return (
    <B2BClient
      categoryPrefix={categoryPrefix}
      categories={categories}
      activeLangs={activeLangs}
      settings={settingsData || fallbackSettings}
      cmsPage={pageData}
    />
  );
}
