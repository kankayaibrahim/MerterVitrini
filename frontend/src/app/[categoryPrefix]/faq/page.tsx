import React from "react";
import { Metadata } from "next";
import FAQClient, { StoreSettings, FAQCMSPage, Language } from "./FAQClient";
import {
  SITE_ORIGIN,
  SupportedSeoLang,
  OG_LOCALE_BY_LANG,
  GLOBAL_B2B_SEO_MATRIX,
  normalizeSeoLang,
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

const FAQ_TITLES: Record<SupportedSeoLang, string> = {
  tr: "Sıkça Sorulan Sorular (SSS) | Merter Vitrini Toptan B2B",
  en: "Frequently Asked Questions (FAQ) | Merter Vitrini Wholesale B2B",
  ru: "Часто Задаваемые Вопросы (FAQ) | Merter Vitrini Оптом Стамбул",
  ar: "الأسئلة الشائعة (FAQ) | مارتر فيتريني لتجارة الجملة",
  pl: "Często Zadawane Pytania (FAQ) | Merter Vitrini Hurtownia B2B",
  bg: "Често Задавани Въпроси (FAQ) | Merter Vitrini Търговия на Едро",
  de: "Häufig Gestellte Fragen (FAQ) | Merter Vitrini Großhandel B2B",
  fr: "Foire Aux Questions (FAQ) | Merter Vitrini Vente en Gros B2B",
};

const FAQ_DESCRIPTIONS: Record<SupportedSeoLang, string> = {
  tr: "Merter toptan tekstil alımları, asorti seri paket düzeni, minimum sipariş miktarı (MOQ), yurt dışı ihracat kargo ve ödeme süreçleri hakkında sıkça sorulan sorular.",
  en: "Answers to frequently asked questions about Merter Istanbul wholesale clothing: size-run packs, MOQ, consolidated international cargo, customs, and corporate payment.",
  ru: "Ответы на частые вопросы об оптовых закупках турецкой одежды в Мертере: размерные ряды, минимальный заказ, отправка карго в Россию и СНГ и способы оплаты.",
  ar: "إجابات الأسئلة الشائعة حول شراء الملابس التركية بالجملة من مارتر إسطنبول: حزم الباكيدج، الحد الأدنى للطلب، الشحن الدولي وطرق الدفع.",
  pl: "Odpowiedzi na pytania o zakupy hurtowe odzieży z Merter Stambuł: pakiety rozmiarowe, niskie MOQ, transport do Polski i metody płatności B2B.",
  bg: "Отговори на въпроси за поръчки на едро от Мертер Истанбул: размерни серии, минимални количества, карго транспорт до България и плащане.",
  de: "Antworten zum Mode-Großhandel aus Merter Istanbul: Serienpakete, Mindestbestellmengen (MOQ), EU-Versand mit ATR-Dokumenten und sichere B2B-Zahlung.",
  fr: "Tout savoir sur l'achat de vêtements en gros à Merter Istanbul : lots par séries, MOQ, transport international groupé et paiement B2B sécurisé.",
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { categoryPrefix } = await params;
  const activeLangs = await fetchLanguages();
  const lang = resolveLang(categoryPrefix, activeLangs);
  const title = FAQ_TITLES[lang];
  const description = FAQ_DESCRIPTIONS[lang];
  const alternates = buildPrefixedAlternates("faq", lang);

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

export default async function FAQPage({ params }: Readonly<PageProps>) {
  const { categoryPrefix } = await params;

  const [activeLangs, categories, settingsData, pageData] = await Promise.all([
    fetchLanguages(),
    fetchSsrCategories(),
    ssrStoreFetch<StoreSettings>("/settings", 300),
    ssrStoreFetch<FAQCMSPage>("/pages/faq", 300),
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
    <FAQClient
      categoryPrefix={categoryPrefix}
      categories={categories}
      activeLangs={activeLangs}
      settings={settingsData || fallbackSettings}
      cmsPage={pageData}
    />
  );
}
