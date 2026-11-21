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
  const alternates = buildPrefixedAlternates("yeni-urunler", lang);

  return {
    title: copy.newArrivalsTitle,
    description: copy.newArrivalsDescription,
    keywords: copy.keywords,
    alternates,
    openGraph: {
      title: copy.newArrivalsTitle,
      description: copy.newArrivalsDescription,
      url: alternates.canonical,
      siteName: "Merter Vitrini B2B",
      locale: OG_LOCALE_BY_LANG[lang],
      type: "website",
      images: [
        {
          url: `${SITE_ORIGIN}/og-image.jpg`,
          width: 1200,
          height: 630,
          alt: copy.newArrivalsTitle,
        },
      ],
    },
  };
}

export default async function LocalizedYeniUrunlerPage({
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
  const parsedPage = Number.parseInt(pageRaw || "1", 10);
  const pageNum = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const offset = (pageNum - 1) * 24;

  const lang = normalizeSeoLang(categoryPrefix, "tr");
  const copy = GLOBAL_B2B_SEO_MATRIX[lang];
  const alternates = buildPrefixedAlternates("yeni-urunler", lang);

  const [categories, productsPayload] = await Promise.all([
    fetchSsrCategories(),
    fetchSsrProducts(`?limit=24&offset=${offset}&sort_by=newest&new_days=7`, 180),
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
        name: copy.newArrivalsTitle,
        url: alternates.canonical,
        description: copy.newArrivalsDescription,
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
            name: copy.newArrivalsLabel,
            item: alternates.canonical,
          },
        ],
      },
      ...(itemListElements.length > 0
        ? [
            {
              "@type": "ItemList",
              name: copy.newArrivalsTitle,
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
        newArrivalsDays={7}
        preFetchedCategories={categories}
        initialProducts={productsPayload.products}
        initialTotalProducts={productsPayload.total}
      />
    </>
  );
}
