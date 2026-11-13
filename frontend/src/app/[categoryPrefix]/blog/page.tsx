import React from "react";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  SITE_ORIGIN,
  OG_LOCALE_BY_LANG,
  GLOBAL_B2B_SEO_MATRIX,
  SupportedSeoLang,
  isSupportedSeoLang,
  normalizeSeoLang,
  stripBrandTitleSuffix,
  buildPrefixedAlternates,
  safeJsonLd,
  ssrStoreFetch,
  fetchSsrCategories,
} from "@/utils/seoHelpers";
import BlogListClient from "./BlogListClient";

interface PageProps {
  readonly params: Promise<{
    readonly categoryPrefix: string;
  }>;
}

export interface BlogPostTranslation {
  slug?: string;
  title: string;
  summary?: string | null;
  content?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
}

export interface BlogPost {
  id: string;
  slug: string;
  cover_image?: string | null;
  is_active: boolean;
  translations: Record<string, BlogPostTranslation>;
  created_at: string;
  updated_at: string;
}

export interface Language {
  code: string;
  label: string;
  flag: string;
  categoryPrefix: string;
  dir?: string;
  isActive: boolean;
  sortOrder: number;
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

export async function fetchBlogLanguages(): Promise<Language[]> {
  const data = await ssrStoreFetch<Language[]>("/languages", 3600);
  if (!Array.isArray(data) || data.length === 0) {
    return FALLBACK_LANGUAGES;
  }
  return data.map((item) => ({
    ...item,
    code: normalizeSeoLang(item.code, "en"),
  }));
}

export function resolvePrefixLanguage(
  activeLangs: readonly Language[],
  categoryPrefix: string
): SupportedSeoLang {
  const matched = activeLangs.find((item) => item.categoryPrefix === categoryPrefix);
  return normalizeSeoLang(matched?.code || categoryPrefix, "en");
}

export function generateStaticParams() {
  return [
    { categoryPrefix: "tr" },
    { categoryPrefix: "en" },
    { categoryPrefix: "pl" },
    { categoryPrefix: "bg" },
    { categoryPrefix: "ar" },
    { categoryPrefix: "ru" },
    { categoryPrefix: "de" },
    { categoryPrefix: "fr" },
  ];
}

const BLOG_TITLES: Record<SupportedSeoLang, string> = {
  tr: "B2B Toptan Giyim Blog & Sektörel Rehberler | Merter Vitrini",
  en: "B2B Wholesale Fashion Blog & Merter Sourcing Guides | Merter Vitrini",
  ru: "Блог об одежде оптом из Турции & Гиды по закупкам в Мертере | Merter Vitrini",
  ar: "مدونة تجارة الملابس بالجملة ودليل الاستيراد من مارتر إسطنبول | Merter Vitrini",
  de: "B2B Mode-Großhandel Blog & Einkaufsratgeber Merter Istanbul | Merter Vitrini",
  fr: "Blog Grossiste Mode & Guides d’Approvisionnement Merter Istanbul | Merter Vitrini",
  pl: "Blog Hurtowni Odzieży & Przewodniki Zakupowe Merter Stambuł | Merter Vitrini",
  bg: "Блог за дрехи на едро & Ръководства за доставки от Мертер | Merter Vitrini",
};

const BLOG_DESCS: Record<SupportedSeoLang, string> = {
  tr: "Merter toptan giyim piyasası, İstanbul tekstil üreticileri, seri toptan alım rehberleri, fason üretim ve B2B ihracat lojistiği analizleri.",
  en: "Expert B2B guides on Merter Istanbul wholesale clothing, Turkish apparel manufacturers, size-run pack sourcing, private label OEM, and global export logistics.",
  ru: "Экспертные статьи об оптовом рынке одежды Мертер в Стамбуле, закупках размерными рядами напрямую с фабрик Турции и карго-доставке в СНГ.",
  ar: "مقالات وأدلة متخصصة حول سوق الملابس بالجملة في مارتر إسطنبول، الشراء بنظام السيري والباكيدج من المصانع التركية والشحن الدولي.",
  de: "Fachartikel über den Textilgroßhandel in Merter Istanbul, Direktbezug in Serienpaketen ab Werk, Private Label Produktion und EU-Zollabwicklung.",
  fr: "Analyses et guides B2B sur le marché du prêt-à-porter en gros à Merter Istanbul, l’achat par séries assorties en direct usine et l’export international.",
  pl: "Praktyczne poradniki o hurtowych zakupach odzieży w Merter Stambuł, zamówieniach w pełnych seriach od producentów i transporcie do Polski.",
  bg: "Практични B2B ръководства за пазара на дрехи на едро в Мертер Истанбул, поръчки на серии директно от фабрики и карго доставка до България.",
};

const BLOG_BREADCRUMB_LABEL: Record<SupportedSeoLang, string> = {
  tr: "B2B Blog",
  en: "B2B Blog",
  ru: "Блог B2B",
  ar: "مدونة B2B",
  de: "B2B-Blog",
  fr: "Blog B2B",
  pl: "Blog B2B",
  bg: "B2B Блог",
};

export async function generateMetadata({ params }: Readonly<PageProps>): Promise<Metadata> {
  const { categoryPrefix } = await params;
  if (!isSupportedSeoLang(categoryPrefix)) {
    notFound();
  }
  const activeLangs = await fetchBlogLanguages();
  const lang = resolvePrefixLanguage(activeLangs, categoryPrefix);

  const title = stripBrandTitleSuffix(BLOG_TITLES[lang]);
  const desc = BLOG_DESCS[lang];
  const alternates = buildPrefixedAlternates("blog", lang);

  return {
    title,
    description: desc,
    keywords: GLOBAL_B2B_SEO_MATRIX[lang].keywords,
    alternates,
    openGraph: {
      title,
      description: desc,
      url: alternates.canonical,
      siteName: "Merter Vitrini B2B",
      locale: OG_LOCALE_BY_LANG[lang],
      type: "website",
      images: [{ url: `${SITE_ORIGIN}/og-image.jpg`, width: 1200, height: 630, alt: title }],
    },
  };
}

export default async function BlogListPage({ params }: Readonly<PageProps>) {
  const { categoryPrefix } = await params;
  if (!isSupportedSeoLang(categoryPrefix)) {
    notFound();
  }

  const [activeLangs, categories, blogPostsData] = await Promise.all([
    fetchBlogLanguages(),
    fetchSsrCategories(),
    ssrStoreFetch<BlogPost[]>("/blog", 300),
  ]);

  const blogPosts = Array.isArray(blogPostsData) ? blogPostsData : [];
  const lang = resolvePrefixLanguage(activeLangs, categoryPrefix);
  const canonicalUrl = `${SITE_ORIGIN}/${lang}/blog`;
  const seoCopy = GLOBAL_B2B_SEO_MATRIX[lang];

  const blogCollectionJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${canonicalUrl}#collection`,
        url: canonicalUrl,
        name: BLOG_TITLES[lang],
        description: BLOG_DESCS[lang],
        inLanguage: lang,
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${canonicalUrl}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: seoCopy.homeLabel,
            item: `${SITE_ORIGIN}/${lang}`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: BLOG_BREADCRUMB_LABEL[lang],
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
        dangerouslySetInnerHTML={{ __html: safeJsonLd(blogCollectionJsonLd) }}
      />
      <BlogListClient
        categoryPrefix={categoryPrefix}
        blogPosts={blogPosts}
        categories={categories}
        activeLangs={activeLangs}
      />
    </>
  );
}
