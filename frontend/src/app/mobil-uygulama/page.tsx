import React from "react";
import type { Metadata } from "next";
import MobileAppDownloadClient from "./MobileAppDownloadClient";
import {
  GLOBAL_B2B_SEO_MATRIX,
  OG_LOCALE_BY_LANG,
  SITE_ORIGIN,
  SupportedSeoLang,
  buildQueryLangAlternates,
  normalizeSeoLang,
  safeJsonLd,
  stripBrandTitleSuffix,
} from "@/utils/seoHelpers";

interface MobileSeoMetaCopy {
  readonly title: string;
  readonly description: string;
  readonly breadcrumbLabel: string;
}

const MOBILE_SEO_META: Record<SupportedSeoLang, MobileSeoMetaCopy> = {
  tr: {
    title: "Mobil Uygulama İndir (Android APK) | Merter Vitrini B2B",
    description:
      "Merter Vitrini B2B Toptan Giyim Mağazası ve Tedarikçi Kamera Stüdyosu resmi Android uygulamasını indirin. Otomatik uygulama içi güncelleme (OTA) destekli.",
    breadcrumbLabel: "Mobil Uygulama İndir",
  },
  en: {
    title: "Download Official Android B2B App (APK) | Merter Vitrini Wholesale",
    description:
      "Download the official Merter Vitrini B2B Wholesale Clothing & Supplier Camera Studio Android APK with SHA-256 verified OTA automatic updates.",
    breadcrumbLabel: "Download Mobile App",
  },
  ru: {
    title: "Скачать мобильное приложение B2B (Android APK) | Merter Vitrini",
    description:
      "Официальное Android-приложение оптового маркетплейса одежды Merter Vitrini и фотостудии поставщика с автоматическим обновлением (OTA).",
    breadcrumbLabel: "Мобильное приложение",
  },
  ar: {
    title: "تحميل تطبيق الجوال الرسمي B2B (Android APK) | Merter Vitrini",
    description:
      "حمّل تطبيق أندرويد الرسمي لمنصة Merter Vitrini لتجارة الملابس التركية بالجملة واستوديو كاميرا الموردين مع التحديث التلقائي المباشر (OTA).",
    breadcrumbLabel: "تطبيق الجوال",
  },
  de: {
    title: "Offizielle B2B Mobile-App herunterladen (Android APK) | Merter Vitrini",
    description:
      "Laden Sie die offizielle Android-App für den Merter Vitrini B2B-Großhandel und das Hersteller-Kamerastudio mit automatischen OTA-Updates herunter.",
    breadcrumbLabel: "Mobile-App herunterladen",
  },
  fr: {
    title: "Télécharger l'Application Mobile B2B (Android APK) | Merter Vitrini",
    description:
      "Téléchargez l'application officielle Android Merter Vitrini B2B Prêt-à-Porter en Gros & Studio Caméra Fabricant avec mises à jour automatiques OTA.",
    breadcrumbLabel: "Application Mobile",
  },
  pl: {
    title: "Pobierz Aplikację Mobilną B2B (Android APK) | Merter Vitrini",
    description:
      "Pobierz oficjalną aplikację Android hurtowni odzieży tureckiej Merter Vitrini B2B i Studia Kamery Producenta z automatycznymi aktualizacjami OTA.",
    breadcrumbLabel: "Aplikacja Mobilna",
  },
  bg: {
    title: "Изтегли Мобилното B2B Приложение (Android APK) | Merter Vitrini",
    description:
      "Изтеглете официалното Android приложение на Merter Vitrini B2B за дрехи на едро и студио за доставчици с автоматично OTA обновяване.",
    breadcrumbLabel: "Мобилно приложение",
  },
};

interface MobileAppPageProps {
  readonly searchParams: Promise<{ lang?: string }>;
}

export async function generateMetadata({
  searchParams,
}: MobileAppPageProps): Promise<Metadata> {
  const resolved = await searchParams;
  const lang = normalizeSeoLang(resolved?.lang, "tr");
  const meta = MOBILE_SEO_META[lang];
  const alternates = buildQueryLangAlternates("/mobil-uygulama", lang);

  return {
    title: stripBrandTitleSuffix(meta.title),
    description: meta.description,
    keywords: GLOBAL_B2B_SEO_MATRIX[lang].keywords,
    alternates,
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: alternates.canonical,
      siteName: "Merter Vitrini B2B Wholesale",
      locale: OG_LOCALE_BY_LANG[lang],
      type: "website",
      images: [{ url: `${SITE_ORIGIN}/og-image.jpg`, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.description,
      images: [`${SITE_ORIGIN}/og-image.jpg`],
    },
  };
}

export default async function MobileAppDownloadPage({
  searchParams,
}: MobileAppPageProps) {
  const resolved = await searchParams;
  const lang = normalizeSeoLang(resolved?.lang, "tr");
  const meta = MOBILE_SEO_META[lang];
  const matrix = GLOBAL_B2B_SEO_MATRIX[lang];
  const canonicalUrl =
    lang === "tr"
      ? `${SITE_ORIGIN}/mobil-uygulama`
      : `${SITE_ORIGIN}/mobil-uygulama?lang=${lang}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: "Merter Vitrini B2B Mobile",
        operatingSystem: "Android 7.0+",
        applicationCategory: "BusinessApplication",
        url: canonicalUrl,
        downloadUrl: `${SITE_ORIGIN}/api/v1/mobile/apk`,
        description: meta.description,
        inLanguage: lang,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
        publisher: { "@id": `${SITE_ORIGIN}/#organization` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: matrix.homeLabel,
            item: `${SITE_ORIGIN}/${lang}`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: meta.breadcrumbLabel,
            item: canonicalUrl,
          },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />
      <MobileAppDownloadClient key={lang} initialLang={lang} />
    </>
  );
}
