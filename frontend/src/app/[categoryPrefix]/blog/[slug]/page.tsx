import React from "react";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { t as translate } from "@/app/i18n";
import {
  SITE_ORIGIN,
  SUPPORTED_SEO_LANGS,
  OG_LOCALE_BY_LANG,
  GLOBAL_B2B_SEO_MATRIX,
  SupportedSeoLang,
  isSupportedSeoLang,
  safeJsonLd,
  stripBrandTitleSuffix,
  toAbsoluteSiteUrl,
  ssrStoreFetch,
  fetchSsrCategories,
} from "@/utils/seoHelpers";
import BlogDetailClient from "./BlogDetailClient";
import { BlogPost, fetchBlogLanguages, resolvePrefixLanguage } from "../page";

export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{
    readonly categoryPrefix: string;
    readonly slug: string;
  }>;
}

const AUTHOR_NAME_BY_LANG: Record<SupportedSeoLang, string> = {
  tr: "Merter Vitrini B2B Editör Ekibi",
  en: "Merter Vitrini B2B Editorial Desk",
  ru: "Редакция Merter Vitrini B2B",
  ar: "فريق تحرير Merter Vitrini B2B",
  de: "Merter Vitrini B2B Redaktion",
  fr: "Rédaction Merter Vitrini B2B",
  pl: "Redakcja Merter Vitrini B2B",
  bg: "Редакционен екип на Merter Vitrini B2B",
};

const BLOG_CRUMB_BY_LANG: Record<SupportedSeoLang, string> = {
  tr: "B2B Blog",
  en: "B2B Blog",
  ru: "Блог B2B",
  ar: "مدونة B2B",
  de: "B2B-Blog",
  fr: "Blog B2B",
  pl: "Blog B2B",
  bg: "B2B Блог",
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { categoryPrefix, slug } = await params;
  if (!isSupportedSeoLang(categoryPrefix)) {
    notFound();
  }

  const [activeLangs, post] = await Promise.all([
    fetchBlogLanguages(),
    ssrStoreFetch<BlogPost>(`/blog/${encodeURIComponent(slug)}`, 300),
  ]);

  const lang = resolvePrefixLanguage(activeLangs, categoryPrefix);

  if (!post) {
    notFound();
  }

  const trans =
    post.translations[lang] ||
    post.translations["en"] ||
    post.translations["tr"] ||
    Object.values(post.translations)[0];

  const title = stripBrandTitleSuffix(trans?.meta_title || trans?.title || "Merter Vitrini B2B");
  const desc = trans?.meta_description || trans?.summary || translate("seo_fallback_desc", lang);
  const canonicalSlug = trans?.slug || slug;
  const canonicalUrl = `${SITE_ORIGIN}/${lang}/blog/${canonicalSlug}`;

  const defaultSlug = post.translations["en"]?.slug || post.slug;
  const alternatesLanguages: Record<string, string> = {
    "x-default": `${SITE_ORIGIN}/en/blog/${defaultSlug}`,
  };
  for (const supported of SUPPORTED_SEO_LANGS) {
    const langSlug = post.translations[supported]?.slug || post.slug;
    alternatesLanguages[supported] = `${SITE_ORIGIN}/${supported}/blog/${langSlug}`;
  }

  const ogImage = toAbsoluteSiteUrl(post.cover_image) || `${SITE_ORIGIN}/og-image.jpg`;

  return {
    title,
    description: desc,
    keywords: GLOBAL_B2B_SEO_MATRIX[lang].keywords,
    alternates: {
      canonical: canonicalUrl,
      languages: alternatesLanguages,
    },
    openGraph: {
      title: `${title} | Merter Vitrini B2B`,
      description: desc,
      url: canonicalUrl,
      siteName: "Merter Vitrini B2B",
      images: [{ url: ogImage, alt: title }],
      locale: OG_LOCALE_BY_LANG[lang],
      type: "article",
    },
  };
}

export default async function BlogDetailPage({ params }: Readonly<PageProps>) {
  const { categoryPrefix, slug } = await params;
  if (!isSupportedSeoLang(categoryPrefix)) {
    notFound();
  }

  const [activeLangs, categories, postData] = await Promise.all([
    fetchBlogLanguages(),
    fetchSsrCategories(),
    ssrStoreFetch<BlogPost>(`/blog/${encodeURIComponent(slug)}`, 300),
  ]);

  if (!postData) {
    notFound();
  }

  const lang = resolvePrefixLanguage(activeLangs, categoryPrefix);
  const seoCopy = GLOBAL_B2B_SEO_MATRIX[lang];
  const trans = postData
    ? postData.translations[lang] ||
      postData.translations["en"] ||
      postData.translations["tr"] ||
      Object.values(postData.translations)[0]
    : null;

  const articleTitle = trans?.title || "Merter Vitrini B2B Sourcing Blog";
  const articleDesc = trans?.meta_description || trans?.summary || seoCopy.portalDescription;
  const canonicalUrl = `${SITE_ORIGIN}/${lang}/blog/${trans?.slug || slug}`;
  const coverImageUrl = toAbsoluteSiteUrl(postData?.cover_image) || `${SITE_ORIGIN}/og-image.jpg`;

  const articleJsonLd = postData
    ? {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "BlogPosting",
            "@id": `${canonicalUrl}#article`,
            isPartOf: {
              "@type": "WebPage",
              "@id": canonicalUrl,
            },
            headline: articleTitle,
            description: articleDesc,
            image: [coverImageUrl],
            datePublished: postData.created_at || "2026-01-01T00:00:00Z",
            dateModified: postData.updated_at || postData.created_at || "2026-01-01T00:00:00Z",
            mainEntityOfPage: {
              "@type": "WebPage",
              "@id": canonicalUrl,
            },
            author: {
              "@type": "Organization",
              name: AUTHOR_NAME_BY_LANG[lang],
              url: SITE_ORIGIN,
            },
            publisher: {
              "@type": "Organization",
              name: "Merter Vitrini B2B",
              url: SITE_ORIGIN,
              logo: {
                "@type": "ImageObject",
                url: `${SITE_ORIGIN}/og-image.jpg`,
              },
            },
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
                name: BLOG_CRUMB_BY_LANG[lang],
                item: `${SITE_ORIGIN}/${lang}/blog`,
              },
              {
                "@type": "ListItem",
                position: 3,
                name: articleTitle,
                item: canonicalUrl,
              },
            ],
          },
        ],
      }
    : null;

  return (
    <>
      {articleJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(articleJsonLd) }}
        />
      )}
      <BlogDetailClient
        categoryPrefix={categoryPrefix}
        slug={slug}
        post={postData}
        categories={categories}
        activeLangs={activeLangs}
      />
    </>
  );
}
