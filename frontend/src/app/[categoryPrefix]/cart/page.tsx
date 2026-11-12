import React from "react";
import { Metadata } from "next";
import {
  OG_LOCALE_BY_LANG,
  SupportedSeoLang,
  normalizeSeoLang,
  buildPrefixedAlternates,
  fetchSsrCategories,
} from "@/utils/seoHelpers";
import CartClient from "./CartClient";

interface PageProps {
  readonly params: Promise<{ readonly categoryPrefix: string }>;
}

export function generateStaticParams() {
  return [
    { categoryPrefix: "tr" },
    { categoryPrefix: "en" },
    { categoryPrefix: "pl" },
    { categoryPrefix: "bg" },
    { categoryPrefix: "ar" },
    { categoryPrefix: "ru" },
    { categoryPrefix: "de" },
    { categoryPrefix: "fr" },
  ];
}

const CART_TITLES: Record<SupportedSeoLang, string> = {
  tr: "Toptan Sepetim | Merter Vitrini B2B",
  en: "My Wholesale Cart | Merter Vitrini B2B",
  pl: "Mój Koszyk Hurtowy | Merter Vitrini B2B",
  bg: "Моята Количка на Едро | Merter Vitrini B2B",
  ar: "سلة طلبات الجملة | Merter Vitrini B2B",
  ru: "Моя Оптовая Корзина | Merter Vitrini B2B",
  de: "Mein B2B-Warenkorb | Merter Vitrini Großhandel",
  fr: "Mon Panier Grossiste | Merter Vitrini B2B",
};

const CART_DESCS: Record<SupportedSeoLang, string> = {
  tr: "Toptan sepetinizdeki seri paketleri inceleyin, kurumsal sipariş verin veya proforma fiyat teklifi isteyin.",
  en: "Review size-run packs in your wholesale cart, place direct factory orders, or request an official proforma quote.",
  pl: "Przejrzyj pakiety w swoim koszyku hurtowym, złóż zamówienie lub poproś o fakturę proforma.",
  bg: "Прегледайте сериите в количката си на едро, направете поръчка или заявете проформа фактура.",
  ar: "راجع باقات المقاسات في سلة الجملة الخاصة بك، أتمم الطلب أو اطلب فاتورة أولية رسمية (Proforma).",
  ru: "Проверьте размерные ряды в оптовой корзине, оформите заказ или запросите официальный счет-проформу.",
  de: "Überprüfen Sie die Serienpakete in Ihrem B2B-Warenkorb, bestellen Sie direkt oder fordern Sie eine Proforma-Rechnung an.",
  fr: "Vérifiez vos séries dans le panier B2B, validez votre commande ou demandez une facture proforma officielle.",
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { categoryPrefix } = await params;
  const lang = normalizeSeoLang(categoryPrefix, "en");
  const title = CART_TITLES[lang];
  const desc = CART_DESCS[lang];
  const alternates = buildPrefixedAlternates("cart", lang);

  return {
    title,
    description: desc,
    robots: {
      index: false,
      follow: false,
    },
    alternates,
    openGraph: {
      title,
      description: desc,
      url: alternates.canonical,
      siteName: "Merter Vitrini B2B",
      locale: OG_LOCALE_BY_LANG[lang],
      type: "website",
    },
  };
}

export default async function CartPage({ params }: Readonly<PageProps>) {
  const { categoryPrefix } = await params;
  const categories = await fetchSsrCategories();

  return <CartClient categoryPrefix={categoryPrefix} categories={categories} />;
}
