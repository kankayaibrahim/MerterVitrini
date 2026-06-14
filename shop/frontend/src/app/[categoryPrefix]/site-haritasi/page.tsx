import React from "react";
import { Metadata } from "next";
import { apiFetch } from "@/app/utils";
import { Category } from "@/types/store";
import SitemapClient from "./SitemapClient";
import { BlogPost, Language } from "../blog/page";

interface PageProps {
  params: Promise<{
    categoryPrefix: string;
  }>;
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

// Generate static routes for all active language prefixes
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

// Generate metadata
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { categoryPrefix } = await params;
  
  const title = categoryPrefix === "tr" ? "Site Haritası" : "Sitemap";
  const desc = categoryPrefix === "tr" 
    ? "Merter Vitrini B2B toptan hazır giyim platformunun tüm kategori, blog ve kurumsal sayfalarının güncel listesi."
    : "Complete hierarchy and list of categories, sourcing blogs, and corporate content of our B2B wholesale clothing platform.";
  
  const canonicalUrl = `https://mertervitrini.com.tr/${categoryPrefix}/site-haritasi/`;
  const languagesList = ["tr", "en", "pl", "bg", "ar", "ru", "de", "fr"];
  const alternatesLanguages = Object.fromEntries(
    languagesList
      .filter((code) => code !== "__proto__" && code !== "constructor")
      .map((code) => [code, `https://mertervitrini.com.tr/${code}/site-haritasi/`])
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

export default async function SitemapPage({ params }: PageProps) {
  const { categoryPrefix } = await params;
  
  // Parallel fetches on the server side
  const activeLangs = await fetchLanguages();
  const categoriesData = await apiFetch<Category[]>("/categories");
  const blogPostsData = await apiFetch<BlogPost[]>("/blog");
  
  const categories = categoriesData || [];
  const blogPosts = blogPostsData || [];
  
  return (
    <SitemapClient 
      categoryPrefix={categoryPrefix}
      categories={categories}
      blogPosts={blogPosts}
      activeLangs={activeLangs}
    />
  );
}
