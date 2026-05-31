import React from "react";
import { Metadata } from "next";
import { apiFetch } from "@/app/utils";
import { Category } from "@/types/store";
import PagesClient from "./PagesClient";

interface PageProps {
  params: Promise<{
    categoryPrefix: string;
    slug: string;
  }>;
}

export interface PageTranslation {
  title: string;
  content: string;
  meta_title?: string | null;
  meta_description?: string | null;
}

export interface Page {
  id: string;
  slug: string;
  is_active: boolean;
  translations: Record<string, PageTranslation>;
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

// Generate static params at compilation time for active dynamic CMS pages
export async function generateStaticParams() {
  if (process.env.NEXT_BUILD_SSR === "true") return [];
  try {
    const activeLangs = await fetchLanguages();
    const response = await fetch("https://mertervitrini.com.tr/api/v1/store/pages?t=" + Date.now());
    if (response.ok) {
      const pages = await response.json();
      if (Array.isArray(pages) && pages.length > 0) {
        const params: { categoryPrefix: string; slug: string }[] = [];
        
        // Find unique prefixes (e.g., "tr", "en", "pl", "bg", "ar", "ru", "de", "fr")
        const uniquePrefixes = Array.from(new Set(activeLangs.map((l) => l.categoryPrefix)));
        
        uniquePrefixes.forEach((prefix) => {
          pages.forEach((page: any) => {
            if (page.slug) {
              params.push({
                categoryPrefix: prefix,
                slug: String(page.slug),
              });
            }
          });
        });
        
        return params;
      }
    }
  } catch (err) {
    console.error("[SEO] Dynamic pages generateStaticParams failed, using fallback:", err);
  }
  
  // Return fallback pages (e.g. seeded "hakkimizda" for all fallback prefixes)
  const prefixes = ["tr", "en", "pl", "bg", "ar", "ru", "de", "fr"];
  const fallbackParams: { categoryPrefix: string; slug: string }[] = [];
  prefixes.forEach((prefix) => {
    fallbackParams.push({
      categoryPrefix: prefix,
      slug: "hakkimizda",
    });
  });
  return fallbackParams;
}

// Generate dynamic SEO metadata on the server side using prefix and slug
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { categoryPrefix, slug } = await params;
  
  const activeLangs = await fetchLanguages();
  const prefixToLangMap = new Map<string, string>();
  activeLangs.forEach((l) => {
    if (!prefixToLangMap.has(l.categoryPrefix) || l.code === "tr" || l.code === "en") {
      prefixToLangMap.set(l.categoryPrefix, l.code);
    }
  });
  
  const lang = prefixToLangMap.get(categoryPrefix) || "en";
  const page = await apiFetch<Page>(`/pages/${slug}`);
  
  if (!page) {
    return {
      title: "Sayfa Bulunamadı | Merter Vitrini Toptan B2B",
      description: "Aradığınız sayfa bulunamadı veya deaktif edilmiş.",
    };
  }

  // Find translation or fall back to any available
  const t = page.translations[lang] || page.translations["tr"] || page.translations["en"] || Object.values(page.translations)[0];
  
  const title = t?.meta_title || t?.title || "Merter Vitrini";
  const desc = t?.meta_description || "Merter Vitrini toptan B2B hazır giyim dijital showroomu.";
  
  const canonicalUrl = `https://mertervitrini.com.tr/${categoryPrefix}/pages/${slug}/`;
  
  // Build Hreflang alternates
  const alternatesLanguages = Object.fromEntries(
    activeLangs
      .filter((l) => l.code !== "__proto__" && l.code !== "constructor")
      .map((l) => [l.code, `https://mertervitrini.com.tr/${l.categoryPrefix}/pages/${slug}/`])
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
      type: "website",
    }
  };
}

export default async function CMSPage({ params }: PageProps) {
  const { categoryPrefix, slug } = await params;
  
  // Parallel fetches on the server side
  const activeLangs = await fetchLanguages();
  const categoriesData = await apiFetch<Category[]>("/categories");
  const pageData = await apiFetch<Page>(`/pages/${slug}`);
  
  const categories = categoriesData || [];
  
  return (
    <PagesClient 
      categoryPrefix={categoryPrefix}
      slug={slug}
      page={pageData}
      categories={categories}
      activeLangs={activeLangs}
    />
  );
}
