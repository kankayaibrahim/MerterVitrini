import React from "react";
import { Metadata } from "next";
import StorefrontLayout from "@/components/store/StorefrontLayout";

// SEO optimization according to the B2B Keyword and Sourcing Strategy
export const metadata: Metadata = {
  metadataBase: new URL("https://mertervitrini.com.tr"),
  title: "Wholesale Clothing Turkey - Buy Directly from Istanbul Suppliers",
  description: "Discover surplus stock and brand new season wholesale ready-to-wear collections from Turkey's leading manufacturers at best factory prices. Turkish wholesale clothing online.",
  alternates: {
    canonical: "https://mertervitrini.com.tr",
    languages: {
      "x-default": "https://mertervitrini.com.tr/en",
      tr: "https://mertervitrini.com.tr/tr",
      en: "https://mertervitrini.com.tr/en",
      pl: "https://mertervitrini.com.tr/pl",
      bg: "https://mertervitrini.com.tr/bg",
      ar: "https://mertervitrini.com.tr/ar",
      ru: "https://mertervitrini.com.tr/ru",
      de: "https://mertervitrini.com.tr/de",
      fr: "https://mertervitrini.com.tr/fr",
    }
  },
  openGraph: {
    title: "Wholesale Clothing Turkey - Buy Directly from Istanbul Suppliers",
    description: "Turkish Wholesale Clothing Online. High-quality boutique outfits from Istanbul suppliers.",
    url: "https://mertervitrini.com.tr",
    siteName: "Merter Vitrini",
    locale: "en_US",
    type: "website",
  }
};

const jsonLdOrg = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://mertervitrini.com.tr/#organization",
      "name": "Merter Vitrini B2B",
      "url": "https://mertervitrini.com.tr",
      "logo": "https://mertervitrini.com.tr/placeholder.png",
      "description": "Türkiye'nin lider üreticilerinden doğrudan toptan hazır giyim ve tekstil e-ticaret platformu.",
      "contactPoint": {
        "@type": "ContactPoint",
        "contactType": "customer service",
        "availableLanguage": ["Turkish", "English", "Russian", "Arabic"]
      }
    },
    {
      "@type": "WebSite",
      "@id": "https://mertervitrini.com.tr/#website",
      "url": "https://mertervitrini.com.tr",
      "name": "Merter Vitrini",
      "publisher": {
        "@id": "https://mertervitrini.com.tr/#organization"
      },
      "potentialAction": {
        "@type": "SearchAction",
        "target": "https://mertervitrini.com.tr/tr/tum-urunler?q={search_term_string}",
        "query-input": "required name=search_term_string"
      }
    }
  ]
};

export default function StorefrontPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdOrg) }}
      />
      <StorefrontLayout mode="portal" />
    </>
  );
}
