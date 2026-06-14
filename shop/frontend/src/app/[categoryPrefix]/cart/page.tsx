import React from "react";
import { Metadata } from "next";
import { apiFetch } from "@/app/utils";
import { Category } from "@/types/store";
import CartClient from "./CartClient";

interface PageProps {
  params: Promise<{ categoryPrefix: string }>;
}

// Generate static routes for all active language prefixes at compile time (essential for static export mode)
export async function generateStaticParams() {
  return [
    { categoryPrefix: "tr" },
    { categoryPrefix: "en" },
    { categoryPrefix: "pl" },
    { categoryPrefix: "bg" },
    { categoryPrefix: "ar" },
    { categoryPrefix: "ru" },
    { categoryPrefix: "de" },
    { categoryPrefix: "fr" }
  ];
}

// Generate localized dynamic SEO metadata for each language prefix for the Cart page
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { categoryPrefix } = await params;

  const titles: Record<string, string> = {
    tr: "Sepetim | Merter Vitrini Toptan B2B",
    en: "My Cart | Merter Vitrini Wholesale B2B",
    pl: "Mój Koszyk | Merter Vitrini Hurtownia B2B",
    bg: "Моята Количка | Merter Vitrini на Едро B2B",
    ar: "سلة التسوق | مرتر فيتريني بالجملة B2B",
    ru: "Моя Корзина | Merter Vitrini Опт B2B",
    de: "Mein Warenkorb | Merter Vitrini Großhandel B2B",
    fr: "Mon Panier | Merter Vitrini en Gros B2B"
  };

  const descs: Record<string, string> = {
    tr: "Toptan sepetinizdeki ürünleri inceleyin, sipariş verin veya fiyat teklifi isteyin. Güvenilir ve doğrudan üreticiden tedarik.",
    en: "Review items in your wholesale cart, place orders, or request price quotes. Reliable and direct manufacturer sourcing.",
    pl: "Przejrzyj produkty w swoim koszyku hurtowym, złóż zamówienie lub poproś o wycenę. Bezpieczne zakupy bezpośrednio od producentów.",
    bg: "Прегледайте артикулите в количката си на едро, направете поръчка или поискайте оферта. Директно от производителите в Истанбул.",
    ar: "راجع المنتجات في سلة التسوق الخاصة بك، أو قدم طلبًا أو اطلب عرض سعر. توريد مباشر وموثوق من المصنع.",
    ru: "Просмотрите товары в вашей оптовой корзине, оформите заказ или запросите ценовое предложение. Надежные прямые поставки от производителей.",
    de: "Überprüfen Sie die Artikel in Ihrem Großhandelswarenkorb, geben Sie eine Bestellung auf oder fordern Sie ein Angebot an. Direkt von Herstellern.",
    fr: "Consultez les articles de votre panier de vente en gros, passez commande ou demandez un devis. Sourcing direct et fiable du fabricant."
  };

  const title = titles[categoryPrefix] || titles.en;
  const desc = descs[categoryPrefix] || descs.en;

  const canonicalUrl = `https://mertervitrini.com.tr/${categoryPrefix}/cart/`;
  const languagesList = ["tr", "en", "pl", "bg", "ar", "ru", "de", "fr"];
  const alternatesLanguages = Object.fromEntries(
    languagesList
      .filter((code) => code !== "__proto__" && code !== "constructor")
      .map((code) => [code, `https://mertervitrini.com.tr/${code}/cart/`])
  );

  return {
    title: `${title}`,
    description: desc,
    alternates: {
      canonical: canonicalUrl,
      languages: alternatesLanguages,
    },
    openGraph: {
      title: `${title}`,
      description: desc,
      url: canonicalUrl,
      siteName: "Merter Vitrini",
      locale: categoryPrefix === "tr" ? "tr_TR" : "en_US",
      type: "website",
    }
  };
}

export default async function CartPage({ params }: PageProps) {
  const { categoryPrefix } = await params;

  // Server-side fetching of categories for Header navigation rendering
  const categoriesData = await apiFetch<Category[]>("/categories");
  const categories = categoriesData || [];

  return (
    <CartClient 
      categoryPrefix={categoryPrefix} 
      categories={categories} 
    />
  );
}
