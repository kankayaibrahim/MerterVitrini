import React from "react";
import type { Metadata } from "next";
import SupplierApplicationClient from "./SupplierApplicationClient";
import { SUPPLIER_TRANSLATIONS } from "./translations";

interface PageProps {
  readonly params: Promise<{
    readonly categoryPrefix: string;
  }>;
}

const ACTIVE_LANGUAGES = ["tr", "en", "pl", "bg", "ar", "ru", "de", "fr"];

export function generateStaticParams() {
  return ACTIVE_LANGUAGES.map((prefix) => ({
    categoryPrefix: prefix,
  }));
}

export async function generateMetadata({ params }: Readonly<PageProps>): Promise<Metadata> {
  const { categoryPrefix } = await params;
  const lang = categoryPrefix || "tr";
  const t = SUPPLIER_TRANSLATIONS[lang] || SUPPLIER_TRANSLATIONS.en;

  const canonicalUrl = `https://mertervitrini.com.tr/${lang}/tedarikci-basvuru`;

  const alternatesLanguages: Record<string, string> = {
    "x-default": "https://mertervitrini.com.tr/en/tedarikci-basvuru",
  };
  ACTIVE_LANGUAGES.forEach((code) => {
    alternatesLanguages[code] = `https://mertervitrini.com.tr/${code}/tedarikci-basvuru`;
  });

  return {
    title: t.meta_title,
    description: t.meta_desc,
    alternates: {
      canonical: canonicalUrl,
      languages: alternatesLanguages,
    },
    openGraph: {
      title: t.meta_title,
      description: t.meta_desc,
      url: canonicalUrl,
      siteName: "Merter Vitrini B2B",
      locale: lang === "tr" ? "tr_TR" : "en_US",
      type: "website",
    },
  };
}

export default async function SupplierApplicationPage({ params }: Readonly<PageProps>) {
  const { categoryPrefix } = await params;
  const lang = categoryPrefix || "tr";
  const t = SUPPLIER_TRANSLATIONS[lang] || SUPPLIER_TRANSLATIONS.en;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": t.nav_home,
            "item": `https://mertervitrini.com.tr/${lang}`,
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": t.nav_supplier_apply,
            "item": `https://mertervitrini.com.tr/${lang}/tedarikci-basvuru`,
          },
        ],
      },
      {
        "@type": "WebPage",
        "@id": `https://mertervitrini.com.tr/${lang}/tedarikci-basvuru`,
        "url": `https://mertervitrini.com.tr/${lang}/tedarikci-basvuru`,
        "name": t.meta_title,
        "description": t.meta_desc,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SupplierApplicationClient lang={lang} />
    </>
  );
}
