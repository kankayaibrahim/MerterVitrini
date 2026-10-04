import React from "react";
import { Metadata } from "next";
import { apiFetch } from "@/app/utils";
import { Product } from "@/types/store";
import ProductDetailClient from "./ProductDetailClient";

interface PageProps {
  readonly params: Promise<{ readonly slug: string }>;
  readonly searchParams?: Promise<{ readonly lang?: string }>;
}

export const revalidate = 300;

// Generate dynamic SEO metadata on the server side using the slug and optional lang
export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const sParams = searchParams ? await searchParams : {};
  const requestedLang = sParams?.lang || "tr";
  
  const product = await apiFetch<Product>(`/products/${slug}`);
  
  if (!product) {
    return {
      title: "Ürün Bulunamadı | Merter Vitrini Toptan B2B",
      description: "Aradığınız B2B toptan ürün bulunamadı veya deaktif edilmiş.",
    };
  }

  const translation = product.translations?.[requestedLang];
  const rawTitle = translation?.title || product.title || "Hazır Giyim Ürünü";
  const brandName = product.brand_name || "Merter Üretici";

  let b2bPrefix = "Toptan";
  let b2bSuffix = "Serili Paket";
  let descTemplate = `${rawTitle} toptan serili ve asortili butik sipariş imkanları. Doğrudan Merter üretici ${brandName} fabrika fiyatlarıyla toptan hazır giyim tedariği. Minimum paket alımı.`;

  if (requestedLang === "en") {
    b2bPrefix = "Wholesale";
    b2bSuffix = "Series Pack";
    descTemplate = `Wholesale ${rawTitle} series and pack orders for boutiques. Direct Istanbul Merter factory prices from ${brandName}. Minimum package order.`;
  } else if (requestedLang === "ru") {
    b2bPrefix = "Оптом";
    b2bSuffix = "Серия Упаковка";
    descTemplate = `Оптовые закупки ${rawTitle} сериями и упаковками для бутиков. Прямые поставки от производителя ${brandName} из Стамбула по фабричным ценам.`;
  } else if (requestedLang === "ar") {
    b2bPrefix = "بالجملة";
    b2bSuffix = "سيري وباكيت";
    descTemplate = `شراء ${rawTitle} بالجملة بالسيري والباكيت للمحلات والبوتيكات. بأسعار المصنع المباشرة من مصانع مارتر اسطنبول ${brandName}.`;
  } else if (requestedLang === "de") {
    b2bPrefix = "Großhandel";
    b2bSuffix = "Serienpack";
    descTemplate = `Großhandel ${rawTitle} in Serien und Packungen für Boutiquen. Direktpreise ab Fabrik Merter Istanbul von ${brandName}.`;
  } else if (requestedLang === "pl") {
    b2bPrefix = "Hurt";
    b2bSuffix = "Pakiety Serii";
    descTemplate = `Zamówienia hurtowe ${rawTitle} w seriach i pakietach dla butików. Bezpośrednie ceny fabryczne z Merter Stambuł od ${brandName}.`;
  } else if (requestedLang === "fr") {
    b2bPrefix = "Vente en Gros";
    b2bSuffix = "Lot en Série";
    descTemplate = `Vente en gros ${rawTitle} en séries et lots pour boutiques. Prix direct usine Merter Istanbul de ${brandName}.`;
  }

  const b2bTitle = rawTitle.toLowerCase().includes(b2bPrefix.toLowerCase()) ? rawTitle : `${b2bPrefix} ${rawTitle}`;
  const metaTitle = `${b2bTitle} (${b2bSuffix}) - ${brandName} | Merter Vitrini B2B`;
  const metaDesc = descTemplate;
  
  let coverImg = "/placeholder.png";
  if (product.images && product.images.length > 0) {
    const coverObj = product.images.find(img => img.is_cover) || product.images[0];
    coverImg = coverObj.image_url;
  }

  const canonicalUrl = `https://mertervitrini.com.tr/product/${slug}`;
  const alternatesLanguages: Record<string, string> = {
    "x-default": canonicalUrl,
    "tr": canonicalUrl,
    "en": `${canonicalUrl}?lang=en`,
    "ru": `${canonicalUrl}?lang=ru`,
    "ar": `${canonicalUrl}?lang=ar`,
    "de": `${canonicalUrl}?lang=de`,
    "pl": `${canonicalUrl}?lang=pl`,
    "fr": `${canonicalUrl}?lang=fr`,
    "bg": `${canonicalUrl}?lang=bg`,
  };

  return {
    title: metaTitle,
    description: metaDesc,
    alternates: {
      canonical: canonicalUrl,
      languages: alternatesLanguages,
    },
    openGraph: {
      title: metaTitle,
      description: metaDesc,
      url: canonicalUrl,
      siteName: "Merter Vitrini",
      images: [{ url: coverImg, width: 800, height: 1000, alt: metaTitle }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: metaTitle,
      description: metaDesc,
      images: [coverImg],
    },
  };
}

export default async function ProductDetailPage({ params, searchParams }: PageProps) {
  void searchParams;
  const { slug } = await params;
  const product = await apiFetch<Product>(`/products/${slug}`);

  const jsonLd = product ? {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        "name": product.title || "Toptan Hazır Giyim",
        "description": product.short_description || product.description || "Merter toptan tekstil hazır giyim ürünü",
        "image": product.images?.map((img) => img.image_url) || [],
        "sku": product.custom_sku || product.source_product_id || product.id,
        "mpn": product.custom_sku || product.source_product_id || product.id,
        "brand": {
          "@type": "Brand",
          "name": product.brand_name || "Merter Üretici",
        },
        "offers": {
          "@type": "Offer",
          "url": `https://mertervitrini.com.tr/product/${product.slug || product.id}`,
          "priceCurrency": product.currency || "USD",
          "price": (product.discounted_price && product.discounted_price > 0 ? product.discounted_price : product.price || 0).toFixed(2),
          "availability": "https://schema.org/InStock",
          "itemCondition": "https://schema.org/NewCondition",
          "priceValidUntil": "2027-12-31",
          "seller": {
            "@type": "Organization",
            "name": "Merter Vitrini B2B",
          },
          "hasMerchantReturnPolicy": {
            "@type": "MerchantReturnPolicy",
            "applicableCountry": "TR",
            "returnPolicyCategory": "https://schema.org/MerchantReturnFiniteReturnWindow",
            "merchantReturnDays": 14,
            "returnMethod": "https://schema.org/ReturnByMail",
            "returnFees": "https://schema.org/ReturnFeesCustomerResponsibility",
          },
          "shippingDetails": {
            "@type": "OfferShippingDetails",
            "shippingRate": {
              "@type": "MonetaryAmount",
              "value": "0.00",
              "currency": product.currency || "USD",
            },
            "shippingDestination": {
              "@type": "DefinedRegion",
              "addressCountry": ["TR", "DE", "FR", "PL", "US", "RU", "AE", "SA"],
            },
            "deliveryTime": {
              "@type": "ShippingDeliveryTime",
              "handlingTime": {
                "@type": "QuantitativeValue",
                "minValue": 1,
                "maxValue": 3,
                "unitCode": "DAY",
              },
              "transitTime": {
                "@type": "QuantitativeValue",
                "minValue": 2,
                "maxValue": 7,
                "unitCode": "DAY",
              },
            },
          },
        },
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "Ana Sayfa",
            "item": "https://mertervitrini.com.tr",
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": product.brand_name || "Toptan Giyim",
            "item": `https://mertervitrini.com.tr/product/${product.slug || product.id}`,
          },
        ],
      },
    ],
  } : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <ProductDetailClient product={product} />
    </>
  );
}

