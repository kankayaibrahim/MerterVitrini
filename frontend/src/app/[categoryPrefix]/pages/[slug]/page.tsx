import React from "react";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import PagesClient from "./PagesClient";
import { t as translate } from "@/app/i18n";
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

export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{
    readonly categoryPrefix: string;
    readonly slug: string;
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
  return data.map((item) => ({
    ...item,
    code: normalizeSeoLang(item.code, "en"),
  }));
}

function resolvePageLang(
  activeLangs: readonly Language[],
  categoryPrefix: string
): SupportedSeoLang {
  const matched = activeLangs.find((l) => l.categoryPrefix === categoryPrefix);
  return normalizeSeoLang(matched?.code || categoryPrefix, "en");
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { categoryPrefix, slug } = await params;
  if (!isSupportedSeoLang(categoryPrefix)) {
    notFound();
  }

  const [activeLangs, page] = await Promise.all([
    fetchLanguages(),
    ssrStoreFetch<Page>(`/pages/${encodeURIComponent(slug)}`, 300),
  ]);

  const lang = resolvePageLang(activeLangs, categoryPrefix);

  if (!page) {
    notFound();
  }

  const trans =
    page.translations[lang] ||
    page.translations["en"] ||
    page.translations["tr"] ||
    Object.values(page.translations)[0];

  const title = stripBrandTitleSuffix(trans?.meta_title || trans?.title || "Merter Vitrini B2B");
  const desc = trans?.meta_description || translate("seo_fallback_desc", lang);
  const alternates = buildPrefixedAlternates(`pages/${slug}`, lang);

  return {
    title,
    description: desc,
    keywords: GLOBAL_B2B_SEO_MATRIX[lang].keywords,
    alternates,
    openGraph: {
      title: `${title} | Merter Vitrini B2B`,
      description: desc,
      url: alternates.canonical,
      siteName: "Merter Vitrini B2B",
      locale: OG_LOCALE_BY_LANG[lang],
      type: "website",
      images: [{ url: `${SITE_ORIGIN}/og-image.jpg`, width: 1200, height: 630, alt: title }],
    },
  };
}

export default async function CMSPage({ params }: Readonly<PageProps>) {
  const { categoryPrefix, slug } = await params;
  if (!isSupportedSeoLang(categoryPrefix)) {
    notFound();
  }

  const [activeLangs, categories, pageData] = await Promise.all([
    fetchLanguages(),
    fetchSsrCategories(),
    ssrStoreFetch<Page>(`/pages/${encodeURIComponent(slug)}`, 300),
  ]);

  if (!pageData) {
    notFound();
  }

  const lang = resolvePageLang(activeLangs, categoryPrefix);
  const seoCopy = GLOBAL_B2B_SEO_MATRIX[lang];
  const trans = pageData
    ? pageData.translations[lang] ||
      pageData.translations["en"] ||
      pageData.translations["tr"] ||
      Object.values(pageData.translations)[0]
    : null;

  const canonicalUrl = `${SITE_ORIGIN}/${lang}/pages/${slug}`;
  const pageTitle = trans?.title || "Merter Vitrini B2B";
  const pageDesc = trans?.meta_description || seoCopy.portalDescription;

  const pageJsonLd = pageData
    ? {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "WebPage",
            "@id": `${canonicalUrl}#webpage`,
            url: canonicalUrl,
            name: pageTitle,
            description: pageDesc,
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
                name: pageTitle,
                item: canonicalUrl,
              },
            ],
          },
        ],
      }
    : null;

  return (
    <>
      {pageJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(pageJsonLd) }}
        />
      )}
      <PagesClient
        categoryPrefix={categoryPrefix}
        slug={slug}
        page={pageData}
        categories={categories}
        activeLangs={activeLangs}
      />
    </>
  );
}
