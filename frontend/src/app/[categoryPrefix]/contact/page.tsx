import React from "react";
import { Metadata } from "next";
import { apiFetch } from "@/app/utils";
import { Category } from "@/types/store";
import ContactClient, { StoreSettings, ContactCMSPage, Language } from "./ContactClient";

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
    tr: "İletişim & Showroom Bilgileri | Merter Vitrini Toptan Giyim",
    en: "Contact & Showroom Information | Merter Vitrini Wholesale Clothing",
    ru: "Контакты и Шоурум | Merter Vitrini Оптовая Торговля",
    ar: "معلومات الاتصال وصالة العرض | مرتر فيتريني لبيع الملابس بالجملة",
    pl: "Kontakt i Showroom | Merter Vitrini Hurtownia Odzieży",
    bg: "Контакти и Шоурум | Merter Vitrini Търговия на Едро",
    de: "Kontakt & Showroom | Merter Vitrini Großhandel für Kleidung",
    fr: "Contact & Showroom | Merter Vitrini Vente en Gros de Vêtements",
  };

  const descriptions: Record<string, string> = {
    tr: "Merter toptan tekstil showroom adresi, müşteri hizmetleri telefonu, 7/24 WhatsApp sipariş hattı ve kurumsal e-posta iletişim bilgileri. Toptan hazır giyim tedariği için bize ulaşın.",
    en: "Merter wholesale textile showroom address, customer service phone, 24/7 WhatsApp order line, and corporate email. Contact us for ready-to-wear wholesale fashion sourcing.",
    ru: "Адрес оптового шоурума в Мертере (Стамбул), телефон службы поддержки, линия WhatsApp 24/7 и корпоративная почта для заказов готовой одежды оптом.",
    ar: "عنوان صالة عرض مرتر لتجارة المنسوجات بالجملة، هاتف خدمة العملاء، خط واتساب للطلبات على مدار الساعة، والبريد الإلكتروني المؤسسي لتوريد الملابس الجاهزة.",
    pl: "Adres showroomu hurtowego w Merter (Stambuł), telefon obsługi klienta, całodobowa linia zamówień WhatsApp i e-mail firmowy.",
    bg: "Адрес на шоурума за текстил на едро в Мертер, телефон за обслужване на клиенти, 24/7 линия за поръчки в WhatsApp и имейл.",
    de: "Merter Großhandel-Showroom-Adresse, Kundenservice-Telefon, 24/7-WhatsApp-Bestellhotline und Firmen-E-Mail.",
    fr: "Adresse du showroom de vente en gros de textile à Merter, téléphone du service client, ligne de commande WhatsApp 24/7 et e-mail professionnel.",
  };

  const title = titles[lang] || titles.tr;
  const description = descriptions[lang] || descriptions.tr;
  const canonicalUrl = `https://mertervitrini.com.tr/${categoryPrefix}/contact`;

  const alternatesLanguages = Object.fromEntries(
    activeLangs
      .filter((l) => l.code !== "__proto__" && l.code !== "constructor")
      .map((l) => [l.code, `https://mertervitrini.com.tr/${l.categoryPrefix}/contact`])
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

export default async function ContactPage({ params }: Readonly<PageProps>) {
  const { categoryPrefix } = await params;
  
  // Parallel server-side fetching
  const [activeLangs, categoriesData, settingsData, pageData] = await Promise.all([
    fetchLanguages(),
    apiFetch<Category[]>("/categories"),
    apiFetch<StoreSettings>("/settings"),
    apiFetch<ContactCMSPage>("/pages/iletisim"),
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
    <ContactClient
      categoryPrefix={categoryPrefix}
      categories={categories}
      activeLangs={activeLangs}
      settings={settingsData || fallbackSettings}
      cmsPage={pageData}
    />
  );
}
