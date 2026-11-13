import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import StorefrontLayout from "@/components/store/StorefrontLayout";
import {
  buildOrganizationGraphJsonLd,
  buildPrefixedAlternates,
  fetchSsrCategories,
  fetchSsrProducts,
  fetchSsrStoreSettings,
  GLOBAL_B2B_SEO_MATRIX,
  isSupportedSeoLang,
  normalizeSeoLang,
  OG_LOCALE_BY_LANG,
  safeJsonLd,
  SITE_ORIGIN,
  SUPPORTED_SEO_LANGS,
} from "@/utils/seoHelpers";

interface PageProps {
  readonly params: Promise<{ readonly categoryPrefix: string }>;
}

export function generateStaticParams() {
  return SUPPORTED_SEO_LANGS.map((categoryPrefix) => ({ categoryPrefix }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { categoryPrefix } = await params;
  if (!isSupportedSeoLang(categoryPrefix)) {
    notFound();
  }
  const lang = normalizeSeoLang(categoryPrefix, "en");
  const copy = GLOBAL_B2B_SEO_MATRIX[lang];
  const alternates = buildPrefixedAlternates("", lang);

  return {
    title: copy.portalTitle,
    description: copy.portalDescription,
    keywords: copy.keywords,
    alternates,
    openGraph: {
      title: copy.portalTitle,
      description: copy.portalDescription,
      url: alternates.canonical,
      siteName: "Merter Vitrini B2B",
      images: [
        {
          url: `${SITE_ORIGIN}/og-image.jpg`,
          width: 1200,
          height: 630,
          alt: copy.portalTitle,
        },
      ],
      locale: OG_LOCALE_BY_LANG[lang],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: copy.portalTitle,
      description: copy.portalDescription,
      images: [`${SITE_ORIGIN}/og-image.jpg`],
    },
  };
}

export default async function LocalizedHomePage({ params }: PageProps) {
  const { categoryPrefix } = await params;
  if (!isSupportedSeoLang(categoryPrefix)) {
    notFound();
  }
  const lang = normalizeSeoLang(categoryPrefix, "en");

  const [categories, portalPayload, settings] = await Promise.all([
    fetchSsrCategories(),
    fetchSsrProducts("?limit=8&sort_by=newest", 180),
    fetchSsrStoreSettings(),
  ]);

  const siteJsonLd = buildOrganizationGraphJsonLd(lang, settings);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(siteJsonLd) }}
      />
      <StorefrontLayout
        mode="portal"
        defaultLang={lang}
        preFetchedCategories={categories}
        initialPortalProducts={portalPayload.products}
      />
    </>
  );
}
