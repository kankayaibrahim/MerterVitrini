import React from "react";
import type { Metadata } from "next";
import type { Brand, Product } from "@/types/store";
import {
  buildOrganizationGraphJsonLd,
  fetchSsrCategories,
  fetchSsrProducts,
  fetchSsrStoreSettings,
  safeJsonLd,
  SITE_ORIGIN,
  slimSsrCategoriesForNav,
  slimSsrProductsForCardGrid,
  ssrStoreFetch,
} from "@/utils/seoHelpers";
import ToptanHazirGiyimClient, {
  TOPTAN_HAZIR_GIYIM_FAQS,
} from "./ToptanHazirGiyimClient";

export const revalidate = 300;

const PAGE_URL = `${SITE_ORIGIN}/toptan-hazir-giyim`;
const PAGE_TITLE =
  "Toptan Hazır Giyim — Merter İstanbul Üreticilerinden Seri & Paket Tedarik";
const PAGE_DESCRIPTION =
  "Türkiye'nin lider B2B toptan hazır giyim platformu. Merter, Laleli ve İstanbul tekstil üreticilerinden aracısız seri toptan kadın, erkek, tesettür, büyük beden giyim ve fason üretim.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  keywords: [
    "toptan hazır giyim",
    "merter toptan hazır giyim",
    "istanbul toptan hazır giyim üreticileri",
    "toptan giyim siteleri",
    "seri toptan kadın giyim",
    "butik için toptan hazır giyim",
    "fason hazır giyim üretimi",
    "private label tekstil türkiye",
  ],
  alternates: {
    canonical: PAGE_URL,
    languages: {
      tr: PAGE_URL,
      en: `${SITE_ORIGIN}/en/tum-urunler`,
      "x-default": PAGE_URL,
    },
  },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: PAGE_URL,
    siteName: "Merter Vitrini B2B",
    locale: "tr_TR",
    type: "website",
    images: [
      {
        url: `${SITE_ORIGIN}/og-image.jpg`,
        width: 1200,
        height: 630,
        alt: "Merter Vitrini — Toptan Hazır Giyim B2B Tedarik Platformu",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [`${SITE_ORIGIN}/og-image.jpg`],
  },
};

export default async function ToptanHazirGiyimPillarPage() {
  const [categories, productsPayload, brandsData, settings] = await Promise.all([
    fetchSsrCategories(),
    fetchSsrProducts("?limit=16&sort_by=newest", 300),
    ssrStoreFetch<Brand[]>("/brands", 300),
    fetchSsrStoreSettings(),
  ]);

  const brands = Array.isArray(brandsData)
    ? brandsData.filter((b) => (b.active_product_count ?? 0) > 0)
    : [];
  const slimProducts: Product[] = slimSsrProductsForCardGrid(
    productsPayload.products,
    "tr"
  );
  const slimCategories = slimSsrCategoriesForNav(categories, "tr");
  const orgGraph = buildOrganizationGraphJsonLd("tr", settings);

  const pillarJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      ...(Array.isArray(orgGraph["@graph"]) ? orgGraph["@graph"] : []),
      {
        "@type": "CollectionPage",
        "@id": `${PAGE_URL}#collection`,
        url: PAGE_URL,
        name: PAGE_TITLE,
        description: PAGE_DESCRIPTION,
        inLanguage: "tr",
        isPartOf: { "@id": `${SITE_ORIGIN}/#website` },
        breadcrumb: { "@id": `${PAGE_URL}#breadcrumb` },
        ...(slimProducts.length > 0
          ? {
              mainEntity: {
                "@type": "ItemList",
                name: "Toptan Hazır Giyim Yeni Sezon Koleksiyonu",
                numberOfItems: productsPayload.total || slimProducts.length,
                itemListElement: slimProducts.slice(0, 16).map((prod, idx) => ({
                  "@type": "ListItem",
                  position: idx + 1,
                  name: prod.title,
                  url: `${SITE_ORIGIN}/product/${prod.slug || prod.id}`,
                })),
              },
            }
          : {}),
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${PAGE_URL}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Ana Sayfa",
            item: SITE_ORIGIN,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Toptan Hazır Giyim",
            item: PAGE_URL,
          },
        ],
      },
      {
        "@type": "FAQPage",
        "@id": `${PAGE_URL}#faq`,
        mainEntity: TOPTAN_HAZIR_GIYIM_FAQS.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(pillarJsonLd) }}
      />
      <ToptanHazirGiyimClient
        categories={slimCategories}
        featuredProducts={slimProducts}
        totalProductsCount={productsPayload.total}
        activeBrands={brands.slice(0, 12)}
        totalBrandsCount={brands.length}
      />
    </>
  );
}
