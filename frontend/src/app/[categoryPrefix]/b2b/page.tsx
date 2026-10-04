import React from "react";
import { Metadata } from "next";
import { apiFetch } from "@/app/utils";
import { Category } from "@/types/store";
import B2BClient, { StoreSettings, B2BCMSPage, Language } from "./B2BClient";

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

// Fetch active languages from database with static fallback
async function fetchLanguages(): Promise<Language[]> {
  try {
    const response = await fetch("https://mertervitrini.com.tr/api/v1/store/languages?t=" + Date.now(), {
      next: { revalidate: 300 }
    });
    if (response.ok) {
      const data: unknown = await response.json();
      if (Array.isArray(data)) {
        return (data as RawLangItem[]).map((l) => {
          let code = l.code;
          if (code.startsWith("en_")) code = "en";
          else if (code.startsWith("tr_")) code = "tr";
          else if (code.startsWith("pl_")) code = "pl";
          else if (code.startsWith("bg_")) code = "bg";
          else if (code.startsWith("de_")) code = "de";
          else if (code.startsWith("fr_")) code = "fr";
          else if (code.startsWith("ru_")) code = "ru";
          else if (code.startsWith("ar_")) code = "ar";
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
    }
  } catch (err) {
    console.error("[SEO] Failed to fetch active languages, using fallback:", err);
  }
  
  return [
    { code: "tr", label: "Türkçe", flag: "🇹🇷", categoryPrefix: "tr", isActive: true, sortOrder: 0 },
    { code: "en", label: "English", flag: "🇬🇧", categoryPrefix: "en", isActive: true, sortOrder: 1 },
    { code: "pl", label: "Polski", flag: "🇵🇱", categoryPrefix: "pl", isActive: true, sortOrder: 2 },
    { code: "bg", label: "Български", flag: "🇧🇬", categoryPrefix: "bg", isActive: true, sortOrder: 3 },
    { code: "ar", label: "العربية", flag: "🇸🇦", dir: "rtl", categoryPrefix: "ar", isActive: true, sortOrder: 4 },
    { code: "ru", label: "Русский", flag: "🇷🇺", categoryPrefix: "ru", isActive: true, sortOrder: 5 },
    { code: "de", label: "Deutsch", flag: "🇩🇪", categoryPrefix: "de", isActive: true, sortOrder: 6 },
    { code: "fr", label: "Français", flag: "🇫🇷", categoryPrefix: "fr", isActive: true, sortOrder: 7 },
  ];
}

export function generateStaticParams() {
  if (process.env.NEXT_BUILD_SSR === "true") return [];
  const prefixes = ["tr", "en", "pl", "bg", "ar", "ru", "de", "fr"];
  return prefixes.map((prefix) => ({ categoryPrefix: prefix }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { categoryPrefix } = await params;
  
  const activeLangs = await fetchLanguages();
  const prefixToLangMap = new Map<string, string>();
  activeLangs.forEach((l) => {
    if (!prefixToLangMap.has(l.categoryPrefix) || l.code === "tr" || l.code === "en") {
      prefixToLangMap.set(l.categoryPrefix, l.code);
    }
  });
  
  const lang = prefixToLangMap.get(categoryPrefix) || "tr";
  
  const titles: Record<string, string> = {
    tr: "Toptan Satış & B2B Tedarik | Merter Vitrini Hazır Giyim",
    en: "Wholesale & B2B Fashion Sourcing | Merter Vitrini Istanbul",
    ru: "Оптовые Продажи и B2B Поставки | Merter Vitrini Стамбул",
    ar: "تجارة الجملة وتوريد الأزياء B2B | مرتر فيتريني إسطنبول",
    pl: "Hurtownia i Zaopatrzenie B2B | Merter Vitrini Odzież",
    bg: "Търговия на Едро & B2B Доставки | Merter Vitrini Истанбул",
    de: "Großhandel & B2B Modebeschaffung | Merter Vitrini Istanbul",
    fr: "Vente en Gros & B2B Sourcing | Merter Vitrini Istanbul",
  };

  const descriptions: Record<string, string> = {
    tr: "İstanbul Merter tekstil üreticilerinden doğrudan toptan kadın hazır giyim alımı, asorti paketleme, minimum sipariş miktarları (MOQ) ve uluslararası kargo/ihracat şartları.",
    en: "Direct wholesale ready-to-wear apparel sourcing from Istanbul Merter manufacturers. Series assortment, minimum order requirements (MOQ), and global freight forwarding.",
    ru: "Прямые оптовые закупки женской одежды от турецких фабрик Мертера. Серии, минимальный заказ, доставка карго по всему миру и B2B сотрудничество.",
    ar: "توريد الملابس النسائية الجاهزة بالجملة مباشرة من مصانع مرتر في إسطنبول. حزم السيري، الحد الأدنى للطلب، والشحن الدولي لمختلف دول العالم.",
    pl: "Bezpośrednie zakupy hurtowe odzieży damskiej od producentów z Merter w Stambule. Pakiety asortymentowe, minimum zamówienia i logistyka międzynarodowa.",
    bg: "Директни покупки на едро на дамско облекло от производители в Мертер, Истанбул. Серии, минимални поръчки и международно карго.",
    de: "Direkter Großhandelseinkauf von Damenbekleidung von Herstellern in Merter Istanbul. Seriengrößen, Mindestbestellmengen und weltweiter Versand.",
    fr: "Achats directs en gros de prêt-à-porter féminin auprès des fabricants de Merter Istanbul. Tailles assorties, quantités minimales et fret international.",
  };

  const title = titles[lang] || titles.tr;
  const description = descriptions[lang] || descriptions.tr;
  const canonicalUrl = `https://mertervitrini.com.tr/${categoryPrefix}/b2b`;

  const alternatesLanguages = Object.fromEntries(
    activeLangs
      .filter((l) => l.code !== "__proto__" && l.code !== "constructor")
      .map((l) => [l.code, `https://mertervitrini.com.tr/${l.categoryPrefix}/b2b`])
  );

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
      languages: alternatesLanguages,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: "Merter Vitrini",
      type: "website",
    },
  };
}

export default async function B2BPage({ params }: Readonly<PageProps>) {
  const { categoryPrefix } = await params;
  
  // Parallel server-side fetching
  const [activeLangs, categoriesData, settingsData, pageData] = await Promise.all([
    fetchLanguages(),
    apiFetch<Category[]>("/categories"),
    apiFetch<StoreSettings>("/settings"),
    apiFetch<B2BCMSPage>("/pages/b2b"),
  ]);

  const categories = categoriesData || [];
  
  const fallbackSettings: StoreSettings = {
    id: "default-settings",
    address: "AKEVLER MAH. 1076 SOK. REGNUM ASTRUM TOWER 8A C2 NO:204 ESENYURT / İSTANBUL / TÜRKİYE",
    phone: "+90 533 703 08 83",
    whatsapp: "+90 533 703 08 83",
    email: "info@toptanmoda.net",
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
