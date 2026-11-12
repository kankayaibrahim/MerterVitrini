import React from "react";
import type { Metadata } from "next";
import StorefrontLayout from "@/components/store/StorefrontLayout";
import {
  buildOrganizationGraphJsonLd,
  buildPrefixedAlternates,
  fetchSsrCategories,
  fetchSsrProducts,
  fetchSsrStoreSettings,
  GLOBAL_B2B_SEO_MATRIX,
  OG_LOCALE_BY_LANG,
  safeJsonLd,
  SITE_ORIGIN,
} from "@/utils/seoHelpers";

const rootEnCopy = GLOBAL_B2B_SEO_MATRIX.en;
const rootAlternates = buildPrefixedAlternates("", "en");

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: rootEnCopy.portalTitle,
  description: rootEnCopy.portalDescription,
  keywords: rootEnCopy.keywords,
  alternates: {
    canonical: SITE_ORIGIN,
    languages: {
      ...rootAlternates.languages,
      "x-default": SITE_ORIGIN,
    },
  },
  openGraph: {
    title: rootEnCopy.portalTitle,
    description: rootEnCopy.portalDescription,
    url: SITE_ORIGIN,
    siteName: "Merter Vitrini B2B",
    locale: OG_LOCALE_BY_LANG.en,
    type: "website",
    images: [
      {
        url: `${SITE_ORIGIN}/og-image.jpg`,
        width: 1200,
        height: 630,
        alt: "Merter Vitrini — Wholesale Clothing Istanbul Manufacturers",
      },
    ],
  },
};

export default async function StorefrontPage() {
  const [categories, portalPayload, settings] = await Promise.all([
    fetchSsrCategories(),
    fetchSsrProducts("?limit=8&sort_by=newest", 180),
    fetchSsrStoreSettings(),
  ]);

  const jsonLdOrg = buildOrganizationGraphJsonLd("en", settings);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLdOrg) }}
      />
      <StorefrontLayout
        mode="portal"
        defaultLang="en"
        preFetchedCategories={categories}
        initialPortalProducts={portalPayload.products}
      />
    </>
  );
}
