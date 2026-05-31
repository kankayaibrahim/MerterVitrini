import React from "react";
import { Metadata } from "next";
import { apiFetch } from "@/app/utils";
import { Product } from "@/types/store";
import ProductDetailClient from "./ProductDetailClient";

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Generate static routes for a subset of products at compilation time.
// Other pages will be generated dynamically on demand when visited.
export async function generateStaticParams() {
  try {
    // Skip or limit SSG during development or heavy builds to avoid network bottlenecks and rate limits.
    const limit = process.env.NODE_ENV === "development" ? 0 : 15000;
    if (limit === 0) return [];

    const response = await fetch(`https://mertervitrini.com.tr/api/v1/store/products?limit=${limit}&t=` + Date.now());
    if (response.ok) {
      const data = await response.json();
      // Go API returns {"products": [...], "total": 3936}. Handle both list and dictionary formats.
      const products = Array.isArray(data) ? data : (data && Array.isArray(data.products) ? data.products : []);
      if (products.length > 0) {
        return products.map((p: any) => ({
          slug: String(p.slug || p.id),
        }));
      }
    }
  } catch (err) {
    console.error("[SEO] generateStaticParams failed, fallback to fallback array:", err);
  }
  // Return a static fallback list of common/sample product slugs to prevent Next.js from throwing build errors on output: "export"
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
