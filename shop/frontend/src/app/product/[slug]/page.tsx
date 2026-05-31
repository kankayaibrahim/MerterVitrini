import React from "react";
import { Metadata } from "next";
import { apiFetch } from "@/app/utils";
import { Product } from "@/types/store";
import ProductDetailClient from "./ProductDetailClient";

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Generate static routes for a subset of products at compilation time.
// All other products will be generated dynamically on demand when visited.
export async function generateStaticParams() {
  // Return only sample products for build check to avoid generating 4000+ static pages during compilation.
  // This reduces deployment build time from 4+ minutes to a few seconds.
  return [
    { slug: "kadin-askili-v-yaka-pul-payetli-bluz-kirmizi-3a15" },
    { slug: "fallback-product-detail" }
  ];
}

// Generate dynamic SEO metadata on the server side using the slug
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await apiFetch<Product>(`/products/${slug}`);
  
  if (!product) {
    return {
      title: "Ürün Bulunamadı | Merter Vitrini Toptan B2B",
      description: "Aradığınız B2B toptan ürün bulunamadı veya deaktif edilmiş.",
    };
  }

  const title = product.title || "Toptan B2B Ürün";
  const brandName = product.brand_name || "Merter Manufacturer";
  const desc = product.description || `${title} toptan serili ve asortili sipariş imkanları.`;
  
  let coverImg = "/placeholder.png";
  if (product.images && product.images.length > 0) {
    const coverObj = product.images.find(img => img.is_cover) || product.images[0];
    coverImg = coverObj.image_url;
  }

  const canonicalUrl = `https://mertervitrini.com.tr/product/${slug}/`;
  const languagesList = ["tr", "en", "pl", "bg", "ar", "ru", "de", "fr"];
  const alternatesLanguages = Object.fromEntries(
    languagesList
      .filter((code) => code !== "__proto__" && code !== "constructor")
      .map((code) => [code, canonicalUrl])
  );

  return {
    title: `${title} - ${brandName} | Merter Vitrini Toptan B2B`,
    description: desc,
    alternates: {
      canonical: canonicalUrl,
      languages: alternatesLanguages,
    },
    openGraph: {
      title: `${title} - ${brandName} | Toptan B2B`,
      description: desc,
      url: canonicalUrl,
      siteName: "Merter Vitrini",
      images: [{ url: coverImg, width: 800, height: 1000, alt: title }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: title,
      description: desc,
      images: [coverImg],
    },
  };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await apiFetch<Product>(`/products/${slug}`);

  return <ProductDetailClient product={product} />;
}
