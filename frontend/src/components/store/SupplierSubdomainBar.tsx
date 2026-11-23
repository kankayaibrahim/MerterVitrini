"use client";

import React, { useState } from "react";
import { ArrowLeft, Check, Copy, ExternalLink, Globe } from "lucide-react";
import { pickLangText, SupportedLangCode } from "@/app/i18n";
import { normalizeSeoLang } from "@/utils/seoHelpers";
import { ROOT_DOMAIN, ROOT_ORIGIN } from "@/utils/subdomain";

interface SubdomainBarLocaleCopy {
  readonly backMarketplace: string;
  readonly officialStorefront: string;
  readonly copyBtn: string;
  readonly copiedBtn: string;
}

const SUBDOMAIN_BAR_COPY: Record<SupportedLangCode, SubdomainBarLocaleCopy> = {
  tr: {
    backMarketplace: "Merter Vitrini Ana Sayfa",
    officialStorefront: "Resmi Üretici Mağazası",
    copyBtn: "Linki Kopyala",
    copiedBtn: "Kopyalandı",
  },
  en: {
    backMarketplace: "Merter Vitrini Marketplace",
    officialStorefront: "Official Factory Storefront",
    copyBtn: "Copy Link",
    copiedBtn: "Copied",
  },
  ru: {
    backMarketplace: "Главная Merter Vitrini",
    officialStorefront: "Официальный магазин фабрики",
    copyBtn: "Копировать ссылку",
    copiedBtn: "Скопировано",
  },
  ar: {
    backMarketplace: "الرئيسية Merter Vitrini",
    officialStorefront: "المتجر الرسمي للمصنع",
    copyBtn: "نسخ الرابط",
    copiedBtn: "تم النسخ",
  },
  de: {
    backMarketplace: "Merter Vitrini Startseite",
    officialStorefront: "Offizieller Hersteller-Shop",
    copyBtn: "Link kopieren",
    copiedBtn: "Kopiert",
  },
  fr: {
    backMarketplace: "Accueil Merter Vitrini",
    officialStorefront: "Boutique Officielle Usine",
    copyBtn: "Copier le lien",
    copiedBtn: "Copié",
  },
  pl: {
    backMarketplace: "Strona główna Merter Vitrini",
    officialStorefront: "Oficjalny Sklep Producenta",
    copyBtn: "Kopiuj link",
    copiedBtn: "Skopiowano",
  },
  bg: {
    backMarketplace: "Начало Merter Vitrini",
    officialStorefront: "Официален магазин на фабриката",
    copyBtn: "Копирай линк",
    copiedBtn: "Копирано",
  },
};

interface SupplierSubdomainBarProps {
  readonly tenantSubdomain: string;
  readonly brandName: string;
  readonly lang: string;
}

export default function SupplierSubdomainBar({
  tenantSubdomain,
  brandName,
  lang,
}: Readonly<SupplierSubdomainBarProps>) {
  const [copied, setCopied] = useState(false);

  if (!tenantSubdomain) {
    return null;
  }

  const fullDomain = `${tenantSubdomain}.${ROOT_DOMAIN}`;
  const fullUrl = `https://${fullDomain}`;
  const safeLang = normalizeSeoLang(lang, "tr");
  const copy = pickLangText(safeLang, SUBDOMAIN_BAR_COPY);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div className="bg-[#1C1C1C] text-white border-b border-white/10">
      <div className="max-w-[1440px] mx-auto px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2.5 flex-wrap min-w-0">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/10 border border-white/15 font-extrabold text-[#E8D5B5]">
            <Globe size={13} className="text-emerald-400 shrink-0" />
            <span className="truncate">{fullDomain}</span>
          </span>
          <span className="hidden sm:inline text-white/75 font-semibold truncate">
            {brandName} • {copy.officialStorefront}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold border border-white/15 cursor-pointer transition-colors"
          >
            {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            <span>{copied ? copy.copiedBtn : copy.copyBtn}</span>
          </button>

          <a
            href={`${ROOT_ORIGIN}/${safeLang}`}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#E8D5B5] hover:bg-white text-[#1C1C1C] text-[11px] font-extrabold no-underline transition-colors"
          >
            <ArrowLeft size={12} className="rtl:rotate-180" />
            <span>{copy.backMarketplace}</span>
          </a>
        </div>
      </div>
    </div>
  );
}

export function SupplierSubdomainPill({
  subdomainUrl,
  compact = false,
}: Readonly<{ subdomainUrl: string; compact?: boolean }>) {
  const displayHost = subdomainUrl.replace(/^https?:\/\//i, "");
  return (
    <a
      href={subdomainUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 rounded-md border font-bold no-underline transition-colors ${
        compact
          ? "px-2 py-0.5 bg-[#FAF8F5] hover:bg-[#EFECE6] text-[#6E542E] border-[#D6D1C7] text-[11px]"
          : "px-3 py-1 bg-white hover:bg-[#FAF8F5] text-[#1C1C1C] border-[#D6D1C7] hover:border-[#1C1C1C] text-xs"
      }`}
    >
      <Globe size={compact ? 11 : 13} className="text-[#8C6D3F] shrink-0" />
      <span className="truncate">{displayHost}</span>
      <ExternalLink size={compact ? 10 : 11} className="text-[#8C6D3F] shrink-0" />
    </a>
  );
}
