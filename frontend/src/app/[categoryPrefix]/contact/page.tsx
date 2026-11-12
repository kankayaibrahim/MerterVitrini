import React from "react";
import { Metadata } from "next";
import ContactClient, { StoreSettings, ContactCMSPage, Language } from "./ContactClient";
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

const CONTACT_TITLES: Record<SupportedSeoLang, string> = {
  tr: "İletişim & Showroom Bilgileri | Merter Vitrini Toptan Giyim",
  en: "Contact & Showroom Information | Merter Vitrini Wholesale Clothing",
  ru: "Контакты и Шоурум в Мертере | Merter Vitrini Оптовая Торговля",
  ar: "معلومات الاتصال وصالة العرض في مارتر | Merter Vitrini بالجملة",
  pl: "Kontakt i Showroom w Merter | Merter Vitrini Hurtownia Odzieży",
  bg: "Контакти и Шоурум в Мертер | Merter Vitrini Търговия на Едро",
  de: "Kontakt & Showroom Merter Istanbul | Merter Vitrini Großhandel",
  fr: "Contact & Showroom Merter Istanbul | Merter Vitrini Vente en Gros",
};

const CONTACT_DESCRIPTIONS: Record<SupportedSeoLang, string> = {
  tr: "Merter İstanbul toptan tekstil showroom adresi, müşteri hizmetleri telefonu, 7/24 WhatsApp sipariş hattı ve kurumsal e-posta iletişim bilgileri.",
  en: "Istanbul Merter wholesale clothing showroom address, international B2B phone, 24/7 WhatsApp order hotline, and export support email.",
  ru: "Адрес оптового шоурума в Мертере (Стамбул), телефон поддержки, линия заказов WhatsApp 24/7 и корпоративная почта для закупок одежды оптом.",
  ar: "عنوان صالة عرض مارتر إسطنبول لتجارة الملابس بالجملة، هاتف خدمة العملاء، خط واتساب للطلبات 24/7 والبريد المؤسسي للتصدير.",
  pl: "Adres showroomu hurtowego w dzielnicy Merter (Stambuł), telefon obsługi B2B, całodobowa linia zamówień WhatsApp i e-mail eksportowy.",
  bg: "Адрес на шоурума на едро в Мертер (Истанбул), телефон за клиенти, денонощна WhatsApp линия за поръчки и корпоративен имейл.",
  de: "Adresse des Großhandels-Showrooms in Merter Istanbul, B2B-Kundenservice, 24/7-WhatsApp-Bestellhotline und Export-E-Mail.",
  fr: "Adresse du showroom grossiste à Merter Istanbul, service client B2B, ligne de commande WhatsApp 24/7 et e-mail export.",
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { categoryPrefix } = await params;
  const activeLangs = await fetchLanguages();
  const lang = resolveLang(categoryPrefix, activeLangs);
  const title = CONTACT_TITLES[lang];
  const description = CONTACT_DESCRIPTIONS[lang];
  const alternates = buildPrefixedAlternates("contact", lang);

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

export default async function ContactPage({ params }: Readonly<PageProps>) {
  const { categoryPrefix } = await params;

  const [activeLangs, categories, settingsData, pageData] = await Promise.all([
    fetchLanguages(),
    fetchSsrCategories(),
    ssrStoreFetch<StoreSettings>("/settings", 300),
    ssrStoreFetch<ContactCMSPage>("/pages/iletisim", 300),
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
    <ContactClient
      categoryPrefix={categoryPrefix}
      categories={categories}
      activeLangs={activeLangs}
      settings={settingsData || fallbackSettings}
      cmsPage={pageData}
    />
  );
}
