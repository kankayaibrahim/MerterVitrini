import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import StorefrontLayout from "@/components/store/StorefrontLayout";
import { getProductTitle } from "@/app/i18n";
import {
  buildPrefixedAlternates,
  fetchSsrCategories,
  fetchSsrProducts,
  GLOBAL_B2B_SEO_MATRIX,
  isSupportedSeoLang,
  normalizeSeoLang,
  OG_LOCALE_BY_LANG,
  safeJsonLd,
  SITE_ORIGIN,
  SUPPORTED_SEO_LANGS,
} from "@/utils/seoHelpers";

interface PageProps {
  readonly params: Promise<{
    readonly categoryPrefix: string;
  }>;
  readonly searchParams?: Promise<{
    [key: string]: string | string[] | undefined;
  }>;
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
  const lang = normalizeSeoLang(categoryPrefix, "tr");
  const copy = GLOBAL_B2B_SEO_MATRIX[lang];
  const alternates = buildPrefixedAlternates("tum-urunler", lang);

  return {
    title: copy.allProductsTitle,
    description: copy.allProductsDescription,
    keywords: copy.keywords,
    alternates,
    openGraph: {
      title: copy.allProductsTitle,
      description: copy.allProductsDescription,
      url: alternates.canonical,
      siteName: "Merter Vitrini B2B",
      locale: OG_LOCALE_BY_LANG[lang],
      type: "website",
      images: [
        {
          url: `${SITE_ORIGIN}/og-image.jpg`,
          width: 1200,
          height: 630,
          alt: copy.allProductsTitle,
        },
      ],
    },
  };
}

export default async function LocalizedTumUrunlerPage({
  params,
  searchParams,
}: Readonly<PageProps>) {
  const { categoryPrefix } = await params;
  if (!isSupportedSeoLang(categoryPrefix)) {
    notFound();
  }

  const resolvedSearch = searchParams ? await searchParams : undefined;
  const pageRaw = Array.isArray(resolvedSearch?.page)
    ? resolvedSearch.page[0]
    : resolvedSearch?.page;
  const pageNum = Math.max(1, parseInt(pageRaw || "1", 10));
  const offset = (pageNum - 1) * 24;

  const lang = normalizeSeoLang(categoryPrefix, "tr");
  const copy = GLOBAL_B2B_SEO_MATRIX[lang];
  const alternates = buildPrefixedAlternates("tum-urunler", lang);

  const [categories, productsPayload] = await Promise.all([
    fetchSsrCategories(),
    fetchSsrProducts(`?limit=24&offset=${offset}&sort_by=newest`, 180),
  ]);

  const itemListElements = productsPayload.products
    .slice(0, 24)
    .map((prod, idx) => {
      const prodUrl =
        lang === "tr"
          ? `${SITE_ORIGIN}/product/${prod.slug || prod.id}`
          : `${SITE_ORIGIN}/product/${prod.slug || prod.id}?lang=${lang}`;
      return {
        "@type": "ListItem",
        position: idx + 1,
        url: prodUrl,
        name: getProductTitle(prod, lang),
      };
    });

  const catalogJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: copy.allProductsTitle,
        url: alternates.canonical,
        description: copy.allProductsDescription,
        inLanguage: lang,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: copy.homeLabel,
            item: `${SITE_ORIGIN}/${lang}`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: copy.allProductsLabel,
            item: alternates.canonical,
          },
        ],
      },
      ...(itemListElements.length > 0
        ? [
            {
              "@type": "ItemList",
              name: copy.allProductsTitle,
              numberOfItems: productsPayload.total,
              itemListElement: itemListElements,
            },
          ]
        : []),
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(catalogJsonLd) }}
      />
      <StorefrontLayout
        mode="catalog"
        defaultLang={lang}
        preFetchedCategories={categories}
        initialProducts={productsPayload.products}
        initialTotalProducts={productsPayload.total}
      />
    </>
  );
}
