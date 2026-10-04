import React from "react";
import { Metadata } from "next";
import { apiFetch } from "@/app/utils";
import { Category } from "@/types/store";
import FAQClient, { StoreSettings, FAQCMSPage, Language } from "./FAQClient";

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
    tr: "Sıkça Sorulan Sorular (SSS) | Merter Vitrini Toptan B2B",
    en: "Frequently Asked Questions (FAQ) | Merter Vitrini Wholesale",
    ru: "Часто Задаваемые Вопросы (FAQ) | Merter Vitrini Стамбул",
    ar: "الأسئلة الشائعة (FAQ) | مرتر فيتريني لتجارة الجملة",
    pl: "Często Zadawane Pytania (FAQ) | Merter Vitrini Hurtownia",
    bg: "Често Задавани Въпроси (FAQ) | Merter Vitrini Истанбул",
    de: "Häufig Gestellte Fragen (FAQ) | Merter Vitrini Großhandel",
    fr: "Foire Aux Questions (FAQ) | Merter Vitrini Vente en Gros",
  };

  const descriptions: Record<string, string> = {
    tr: "Merter toptan tekstil alımları, asorti seri koli düzeni, minimum sipariş miktarı (MOQ), yurt dışı kargo ve ödeme süreçleri hakkında sıkça sorulan soruların yanıtları.",
    en: "Find answers to frequently asked questions about Merter wholesale apparel ordering, series assortment, minimum order quantities (MOQ), international freight, and payment.",
    ru: "Ответы на частые вопросы об оптовых закупках турецкой одежды в Мертере: фабричные серии, минимальный заказ, отправка карго и способы оплаты.",
    ar: "إجابات الأسئلة الشائعة حول شراء الملابس النسائية بالجملة من مرتر، حزم المقاسات، الشحن الدولي وطرق الدفع المعتمدة.",
    pl: "Odpowiedzi na najczęściej zadawane pytania dotyczące zakupów hurtowych odzieży w Merter: pakiety asortymentowe, minimum zamówienia i wysyłka.",
    bg: "Отговори на често задавани въпроси относно поръчките на едро на дамско облекло в Мертер: серии, минимални количества и транспорт.",
    de: "Antworten auf häufig gestellte Fragen zum Großhandelseinkauf von Bekleidung in Merter: Seriengrößen, Mindestbestellmenge und weltweiter Versand.",
    fr: "Réponses aux questions fréquentes sur la commande de vêtements en gros à Merter : assortiments de tailles, quantité minimale et livraison.",
  };

  const title = titles[lang] || titles.tr;
  const description = descriptions[lang] || descriptions.tr;
  const canonicalUrl = `https://mertervitrini.com.tr/${categoryPrefix}/faq`;

  const alternatesLanguages = Object.fromEntries(
    activeLangs
      .filter((l) => l.code !== "__proto__" && l.code !== "constructor")
      .map((l) => [l.code, `https://mertervitrini.com.tr/${l.categoryPrefix}/faq`])
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

export default async function FAQPage({ params }: Readonly<PageProps>) {
  const { categoryPrefix } = await params;
  
  // Parallel server-side fetching
  const [activeLangs, categoriesData, settingsData, pageData] = await Promise.all([
    fetchLanguages(),
    apiFetch<Category[]>("/categories"),
    apiFetch<StoreSettings>("/settings"),
    apiFetch<FAQCMSPage>("/pages/faq"),
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
    <FAQClient
      categoryPrefix={categoryPrefix}
      categories={categories}
      activeLangs={activeLangs}
      settings={settingsData || fallbackSettings}
      cmsPage={pageData}
    />
  );
}
