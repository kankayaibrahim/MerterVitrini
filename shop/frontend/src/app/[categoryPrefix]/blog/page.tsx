import React from "react";
import { Metadata } from "next";
import { apiFetch } from "@/app/utils";
import { Category } from "@/types/store";
import { t as translate } from "@/app/i18n";
import BlogListClient from "./BlogListClient";

interface PageProps {
  params: Promise<{
    categoryPrefix: string;
  }>;
}

export interface BlogPostTranslation {
  title: string;
  summary?: string | null;
  content: string;
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

// Fetch active languages from database with static fallback
async function fetchLanguages(): Promise<Language[]> {
  try {
    const response = await fetch("https://mertervitrini.com.tr/api/v1/store/languages?t=" + Date.now());
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data)) {
        return data.map((l: any) => {
          let code = l.code;
          if (code.startsWith("en_")) code = "en";
          else if (code.startsWith("tr_")) code = "tr";
          else if (code.startsWith("pl_")) code = "pl";
          else if (code.startsWith("bg_")) code = "bg";
          else if (code.startsWith("de_")) code = "de";
          else if (code.startsWith("fr_")) code = "fr";
          else if (code.startsWith("ru_")) code = "ru";
          else if (code.startsWith("ar_")) code = "ar";
          return { ...l, code };
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
    { code: "ar", label: "العربية", flag: "🇸🇦", categoryPrefix: "ar", dir: "rtl", isActive: true, sortOrder: 4 },
    { code: "ru", label: "Русский", flag: "🇷🇺", categoryPrefix: "ru", isActive: true, sortOrder: 5 },
    { code: "de", label: "Deutsch", flag: "🇩🇪", categoryPrefix: "de", isActive: true, sortOrder: 6 },
    { code: "fr", label: "Français", flag: "🇫🇷", categoryPrefix: "fr", isActive: true, sortOrder: 7 },
  ];
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

// Generate dynamic SEO metadata for each language blog list page
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { categoryPrefix } = await params;
  
  const activeLangs = await fetchLanguages();
  const prefixToLangMap = new Map<string, string>();
  activeLangs.forEach((l) => {
    if (!prefixToLangMap.has(l.categoryPrefix) || l.code === "tr" || l.code === "en") {
      prefixToLangMap.set(l.categoryPrefix, l.code);
    }
  });
  
  const lang = prefixToLangMap.get(categoryPrefix) || "en";
  
  const titles: Record<string, string> = {
    tr: "Blog & Sektörel Rehberler | Merter Vitrini Toptan Giyim",
    en: "Blog & Textile Industry Guides | Merter Vitrini Wholesale",
    pl: "Blog i Przewodniki Tekstylne | Merter Vitrini Hurt",
    bg: "Блог и Текстилни Ръководства | Merter Vitrini на Едро",
    ar: "المدونة ودليل قطاع النسيج | Merter Vitrini بالجملة",
    ru: "Блог и Гиды по Текстильной Индустрии | Merter Vitrini Опт",
    de: "Blog & Textilindustrie-Ratgeber | Merter Vitrini Großhandel",
    fr: "Blog & Guides de l'Industrie Textile | Merter Vitrini en Gros"
  };

  const descs: Record<string, string> = {
    tr: "Türkiye ve İstanbul toptan hazır giyim piyasası, tedarik rehberleri, trend analizleri ve B2B e-ihracat ipuçları.",
    en: "Get the latest insights on Turkey & Istanbul wholesale clothing market, sourcing guides, trend analysis, and B2B apparel trade tips.",
    pl: "Najnowsze informacje na temat tureckiego rynku odzieżowego, przewodniki zakupowe ze Stambułu i analizy trendów.",
    bg: "Най-новите прозрения за пазара на дрехи на едро в Турция, съвети за доставки и анализи на тенденциите.",
    ar: "احصل على أحدث الرؤى حول سوق الملابس بالجملة في تركيا واسطنبول، وأدلة التوريد، وتحليل الاتجاهات.",
    ru: "Последние новости об оптовом рынке одежды Турции, руководства по закупкам в Стамбуле и анализ трендов.",
    de: "Aktuelle Einblicke in den türkischen Bekleidungsmarkt, Einkaufsratgeber aus Istanbul und Trendanalysen.",
    fr: "Retrouvez les dernières analyses du marché de l'habillement en Turquie, guides d'approvisionnement et tendances."
  };

  const title = titles[lang] || titles.en;
  const desc = descs[lang] || descs.en;

  const canonicalUrl = `https://mertervitrini.com.tr/${categoryPrefix}/blog/`;
  
  const alternatesLanguages = Object.fromEntries(
    activeLangs
      .filter((l) => l.code !== "__proto__" && l.code !== "constructor")
      .map((l) => [l.code, `https://mertervitrini.com.tr/${l.categoryPrefix}/blog/`])
  );

  return {
    title: `${title} | Merter Vitrini`,
    description: desc,
    alternates: {
      canonical: canonicalUrl,
      languages: alternatesLanguages,
    },
    openGraph: {
      title: `${title} | Merter Vitrini`,
      description: desc,
      url: canonicalUrl,
      siteName: "Merter Vitrini",
      locale: lang === "tr" ? "tr_TR" : "en_US",
      type: "website",
    }
  };
}

export default async function BlogListPage({ params }: PageProps) {
  const { categoryPrefix } = await params;
  
  // Parallel fetch on the server side
  const activeLangs = await fetchLanguages();
  const categoriesData = await apiFetch<Category[]>("/categories");
  const blogPostsData = await apiFetch<BlogPost[]>("/blog");
  
  const categories = categoriesData || [];
  const blogPosts = blogPostsData || [];

  return (
    <BlogListClient 
      categoryPrefix={categoryPrefix}
      blogPosts={blogPosts}
      categories={categories}
      activeLangs={activeLangs}
    />
  );
}
