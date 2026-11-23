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
  slimSsrCategoriesForNav,
  slimSsrProductsForCardGrid,
} from "@/utils/seoHelpers";

export const revalidate = 180;

const rootTrCopy = GLOBAL_B2B_SEO_MATRIX.tr;
const rootAlternates = buildPrefixedAlternates("", "tr");

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: rootTrCopy.portalTitle,
  description: rootTrCopy.portalDescription,
  keywords: rootTrCopy.keywords,
  alternates: rootAlternates,
  openGraph: {
    title: rootTrCopy.portalTitle,
    description: rootTrCopy.portalDescription,
    url: SITE_ORIGIN,
    siteName: "Merter Vitrini B2B",
    locale: OG_LOCALE_BY_LANG.tr,
    type: "website",
    images: [
      {
        url: `${SITE_ORIGIN}/og-image.jpg`,
        width: 1200,
        height: 630,
        alt: "Merter Vitrini — Toptan Hazır Giyim & İstanbul B2B Tekstil Üreticileri",
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

  const jsonLdOrg = buildOrganizationGraphJsonLd("tr", settings);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLdOrg) }}
      />
      <StorefrontLayout
        mode="portal"
        defaultLang="tr"
        preFetchedCategories={slimSsrCategoriesForNav(categories, "tr")}
        initialPortalProducts={slimSsrProductsForCardGrid(portalPayload.products, "tr")}
      />
    </>
  );
}
