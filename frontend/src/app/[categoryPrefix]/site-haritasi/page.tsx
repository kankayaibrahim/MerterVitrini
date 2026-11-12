import React from "react";
import type { Metadata } from "next";
import SitemapClient from "./SitemapClient";
import type { BlogPost, Language } from "../blog/page";
import {
  buildPrefixedAlternates,
  fetchSsrCategories,
  normalizeSeoLang,
  OG_LOCALE_BY_LANG,
  ssrStoreFetch,
  SUPPORTED_SEO_LANGS,
} from "@/utils/seoHelpers";

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
  { code: "ar", label: "العربية", flag: "🇸🇦", categoryPrefix: "ar", dir: "rtl", isActive: true, sortOrder: 4 },
  { code: "ru", label: "Русский", flag: "🇷🇺", categoryPrefix: "ru", isActive: true, sortOrder: 5 },
  { code: "de", label: "Deutsch", flag: "🇩🇪", categoryPrefix: "de", isActive: true, sortOrder: 6 },
  { code: "fr", label: "Français", flag: "🇫🇷", categoryPrefix: "fr", isActive: true, sortOrder: 7 },
];

async function fetchLanguages(): Promise<Language[]> {
  const data = await ssrStoreFetch<Language[]>("/languages", 3600);
  if (!Array.isArray(data) || data.length === 0) {
    return FALLBACK_LANGUAGES;
  }
  return data.map((l) => ({
    ...l,
    code: normalizeSeoLang(l.code, "tr"),
  }));
}

export function generateStaticParams() {
  return SUPPORTED_SEO_LANGS.map((categoryPrefix) => ({ categoryPrefix }));
}

const SITEMAP_TITLES: Record<string, string> = {
  tr: "Site Haritası",
  en: "Sitemap",
  pl: "Mapa Strony",
  bg: "Карта на Сайта",
  ar: "خريطة الموقع",
  ru: "Карта Сайта",
  de: "Sitemap",
  fr: "Plan du Site",
};

const SITEMAP_DESCS: Record<string, string> = {
  tr: "Merter Vitrini B2B toptan hazır giyim platformumuzun tüm kategori, blog ve kurumsal sayfalarının güncel listesi.",
  en: "Complete hierarchy and list of categories, sourcing blogs, and corporate content of our B2B wholesale clothing platform.",
  pl: "Pełna hierarchia i lista kategorii, blogów zaopatrzeniowych i treści korporacyjnych naszej platformy hurtowej B2B.",
  bg: "Пълна йерархия и списък с категории, блогове за доставка и корпоративно съдържание на нашата B2B платформа за облекло на едро.",
  ar: "التسلسل الهرمي الكامل وقائمة الفئات ومدونات المصادر ومحتوى الشركات لمنصة ملابس الجملة B2B الخاصة بنا.",
  ru: "Полная иерархия и список категорий, блогов о закупках и корпоративного контента нашей оптовой платформы B2B.",
  de: "Vollständige Hierarchie und Liste der Kategorien, Einkaufs-Blogs und Unternehmensinhalte unserer B2B-Großhandelsplattform.",
  fr: "Hiérarchie et liste complète des catégories, blogs d'approvisionnement et contenus d'entreprise de notre plateforme de vente en gros B2B.",
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { categoryPrefix } = await params;
  const lang = normalizeSeoLang(categoryPrefix, "en");
  const title = SITEMAP_TITLES[lang] || SITEMAP_TITLES.en;
  const desc = SITEMAP_DESCS[lang] || SITEMAP_DESCS.en;
  const alternates = buildPrefixedAlternates("site-haritasi", lang);

  return {
    title: `${title} | Merter Vitrini`,
    description: desc,
    alternates,
    openGraph: {
      title: `${title} | Merter Vitrini`,
      description: desc,
      url: alternates.canonical,
      siteName: "Merter Vitrini B2B",
      locale: OG_LOCALE_BY_LANG[lang],
      type: "website",
    },
  };
}

export default async function SitemapPage({ params }: Readonly<PageProps>) {
  const { categoryPrefix } = await params;

  const [activeLangs, categories, blogPostsData] = await Promise.all([
    fetchLanguages(),
    fetchSsrCategories(),
    ssrStoreFetch<BlogPost[]>("/blog", 600),
  ]);

  const blogPosts = Array.isArray(blogPostsData) ? blogPostsData : [];

  return (
    <SitemapClient
      categoryPrefix={categoryPrefix}
      categories={categories}
      blogPosts={blogPosts}
      activeLangs={activeLangs}
    />
  );
}
