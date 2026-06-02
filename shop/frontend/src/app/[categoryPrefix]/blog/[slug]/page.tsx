import React from "react";
import { Metadata } from "next";
import { apiFetch } from "@/app/utils";
import { Category } from "@/types/store";
import { t as translate } from "@/app/i18n";
import BlogDetailClient from "./BlogDetailClient";
import { BlogPost, Language } from "../page";

interface PageProps {
  params: Promise<{
    categoryPrefix: string;
    slug: string;
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

// Generate static params at compilation time for active blog posts
export async function generateStaticParams() {
  if (process.env.NEXT_BUILD_SSR === "true") return [];
  try {
    const activeLangs = await fetchLanguages();
    const response = await fetch("https://mertervitrini.com.tr/api/v1/store/blog?t=" + Date.now());
    if (response.ok) {
      const posts = await response.json();
      if (Array.isArray(posts) && posts.length > 0) {
        const params: { categoryPrefix: string; slug: string }[] = [];
        
        // Find unique prefixes
        const uniquePrefixes = Array.from(new Set(activeLangs.map((l) => l.categoryPrefix)));
        
        uniquePrefixes.forEach((prefix) => {
          posts.forEach((post: any) => {
            if (post.slug) {
              params.push({
                categoryPrefix: prefix,
                slug: String(post.slug),
              });
            }
          });
        });
        
        return params;
      }
    }
  } catch (err) {
    console.error("[SEO] Blog post generateStaticParams failed, using fallback:", err);
  }
  
  // Return fallback path if not available during compile
  const prefixes = ["tr", "en", "pl", "bg", "ar", "ru", "de", "fr"];
  const fallbackParams: { categoryPrefix: string; slug: string }[] = [];
  prefixes.forEach((prefix) => {
    fallbackParams.push({
      categoryPrefix: prefix,
      slug: "merter-toptan-giyim-piyasasi",
    });
  });
  return fallbackParams;
}

// Generate dynamic SEO metadata for specific blog posts
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
  const post = await apiFetch<BlogPost>(`/blog/${slug}`);
  
  if (!post) {
    return {
      title: translate("seo_page_not_found", lang),
      description: translate("seo_page_not_found_desc", lang),
    };
  }

  // Find translation or fall back to any available
  const t = post.translations[lang] || post.translations["tr"] || post.translations["en"] || Object.values(post.translations)[0];
  
  const title = t?.meta_title || t?.title || "Merter Vitrini";
  const desc = t?.meta_description || t?.summary || translate("seo_fallback_desc", lang);
  
  const canonicalUrl = `https://mertervitrini.com.tr/${categoryPrefix}/blog/${slug}/`;
  
  // Build Hreflang alternates
  const alternatesLanguages = Object.fromEntries(
    activeLangs
      .filter((l) => l.code !== "__proto__" && l.code !== "constructor")
      .map((l) => [l.code, `https://mertervitrini.com.tr/${l.categoryPrefix}/blog/${slug}/`])
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
      images: post.cover_image ? [{ url: post.cover_image }] : undefined,
      locale: lang === "tr" ? "tr_TR" : "en_US",
      type: "article",
    }
  };
}

export default async function BlogDetailPage({ params }: PageProps) {
  const { categoryPrefix, slug } = await params;
  
  // Parallel fetches on the server side
  const activeLangs = await fetchLanguages();
  const categoriesData = await apiFetch<Category[]>("/categories");
  const postData = await apiFetch<BlogPost>(`/blog/${slug}`);
  
  const categories = categoriesData || [];
  
  return (
    <BlogDetailClient 
      categoryPrefix={categoryPrefix}
      slug={slug}
      post={postData}
      categories={categories}
      activeLangs={activeLangs}
    />
  );
}
