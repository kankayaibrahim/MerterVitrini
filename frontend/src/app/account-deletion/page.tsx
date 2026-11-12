import React from "react";
import type { Metadata } from "next";
import AccountDeletionClient from "./AccountDeletionClient";
import {
  GLOBAL_B2B_SEO_MATRIX,
  OG_LOCALE_BY_LANG,
  SITE_ORIGIN,
  SupportedSeoLang,
  buildQueryLangAlternates,
  normalizeSeoLang,
  safeJsonLd,
} from "@/utils/seoHelpers";

interface AccountDeletionSeoCopy {
  readonly title: string;
  readonly description: string;
  readonly breadcrumbLabel: string;
}

const ACCOUNT_DELETION_SEO_META: Record<
  SupportedSeoLang,
  AccountDeletionSeoCopy
> = {
  tr: {
    title: "Hesap ve Veri Silme Merkezi | Merter Vitrini",
    description:
      "Merter Vitrini B2B mobil uygulaması ve web platformu için Google Play Veri Güvenliği uyumlu hesap ve kişisel veri silme merkezi.",
    breadcrumbLabel: "Hesap ve Veri Silme Merkezi",
  },
  en: {
    title: "Account & Personal Data Deletion Center | Merter Vitrini",
    description:
      "Google Play Data Safety & GDPR compliant self-service account and personal data deletion center for Merter Vitrini B2B mobile app and web platform.",
    breadcrumbLabel: "Account Deletion Center",
  },
  ru: {
    title: "Центр удаления аккаунта и персональных данных | Merter Vitrini",
    description:
      "Центр безвозвратного удаления аккаунта покупателя или поставщика и персональных данных для мобильного приложения и веб-платформы Merter Vitrini B2B.",
    breadcrumbLabel: "Удаление аккаунта",
  },
  ar: {
    title: "مركز حذف الحساب والبيانات الشخصية | Merter Vitrini",
    description:
      "مركز حذف الحساب والبيانات الشخصية المتوافق مع معايير أمان بيانات Google Play لتطبيق الجوال ومنصة الويب Merter Vitrini B2B.",
    breadcrumbLabel: "مركز حذف الحساب",
  },
  de: {
    title: "Konto- & Datenlöschungszentrum (DSGVO / Google Play) | Merter Vitrini",
    description:
      "DSGVO- und Google-Play-Datensicherheitskonformes Zentrum zur dauerhaften Löschung Ihres Käufer- oder Lieferantenkontos bei Merter Vitrini B2B.",
    breadcrumbLabel: "Konto- & Datenlöschung",
  },
  fr: {
    title: "Centre de Suppression de Compte et Données (RGPD) | Merter Vitrini",
    description:
      "Centre officiel conforme Google Play Data Safety et RGPD pour supprimer définitivement votre compte client ou fournisseur sur Merter Vitrini B2B.",
    breadcrumbLabel: "Suppression de compte",
  },
  pl: {
    title: "Centrum Usuwania Konta i Danych Osobowych (RODO) | Merter Vitrini",
    description:
      "Zgodne z RODO i Google Play Data Safety centrum trwałego usuwania konta kupca lub dostawcy oraz danych osobowych w Merter Vitrini B2B.",
    breadcrumbLabel: "Usuwanie konta",
  },
  bg: {
    title: "Център за изтриване на профил и лични данни | Merter Vitrini",
    description:
      "Съвместим с GDPR и Google Play Data Safety център за окончателно изтриване на клиентски или доставчически профил в Merter Vitrini B2B.",
    breadcrumbLabel: "Изтриване на профил",
  },
};

interface AccountDeletionPageProps {
  readonly searchParams: Promise<{ lang?: string }>;
}

export async function generateMetadata({
  searchParams,
}: AccountDeletionPageProps): Promise<Metadata> {
  const resolved = await searchParams;
  const lang = normalizeSeoLang(resolved?.lang, "tr");
  const meta = ACCOUNT_DELETION_SEO_META[lang];
  const alternates = buildQueryLangAlternates("/account-deletion", lang);

  return {
    title: meta.title,
    description: meta.description,
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
    },
  };
}

export default async function AccountDeletionPage({
  searchParams,
}: AccountDeletionPageProps) {
  const resolved = await searchParams;
  const lang = normalizeSeoLang(resolved?.lang, "tr");
  const meta = ACCOUNT_DELETION_SEO_META[lang];
  const matrix = GLOBAL_B2B_SEO_MATRIX[lang];
  const canonicalUrl =
    lang === "tr"
      ? `${SITE_ORIGIN}/account-deletion`
      : `${SITE_ORIGIN}/account-deletion?lang=${lang}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${canonicalUrl}#webpage`,
        url: canonicalUrl,
        name: meta.title,
        description: meta.description,
        inLanguage: lang,
        isPartOf: { "@id": `${SITE_ORIGIN}/#website` },
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
      <AccountDeletionClient key={lang} initialLang={lang} />
    </>
  );
}
