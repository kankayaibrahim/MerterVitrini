"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, Sparkles, ArrowUpRight, MapPin, Globe } from "lucide-react";
import { normalizeLangCode, pickLangText, SupportedLangCode } from "@/app/i18n";

export interface SponsoredSlotItem {
  id: string;
  placement: string;
  brand_id?: string;
  brand_name: string;
  brand_slug: string;
  brand_verified: boolean;
  company_type: string;
  export_countries: string;
  whatsapp_phone: string;
  city: string;
  district: string;
  product_count: number;
  category_slug: string;
  title: string;
  subtitle: string;
  badge_text: string;
  image_url: string;
  cta_text: string;
  target_url: string;
  translations?: Record<
    string,
    {
      title?: string;
      subtitle?: string;
      badge_text?: string;
      cta_text?: string;
    }
  >;
}

interface SponsoredSectionLabels {
  featuredHeading: string;
  featuredSub: string;
  verifiedTag: string;
  allSuppliersCta: string;
}

const SECTION_LABELS: Record<SupportedLangCode, SponsoredSectionLabels> = {
  tr: {
    featuredHeading: "ÖNE ÇIKAN DOĞRULANMIŞ MERTER ÜRETİCİLERİ",
    featuredSub: "Sponsorlu Üretici Vitrini • %0 Komisyonla Doğrudan Fabrikadan Toptan Sipariş",
    verifiedTag: "Doğrulanmış Üretici",
    allSuppliersCta: "Tüm Üretici Rehberini Gör →",
  },
  en: {
    featuredHeading: "FEATURED VERIFIED MERTER MANUFACTURERS",
    featuredSub: "Sponsored Showcase • Direct Factory Wholesale with 0% Commission",
    verifiedTag: "Verified Manufacturer",
    allSuppliersCta: "Browse Full Manufacturer Directory →",
  },
  ru: {
    featuredHeading: "РЕКОМЕНДУЕМЫЕ ПРОВЕРЕННЫЕ ПРОИЗВОДИТЕЛИ МЕРТЕР",
    featuredSub: "Спонсорская витрина • Прямые оптовые заказы с фабрик без комиссии",
    verifiedTag: "Проверенный производитель",
    allSuppliersCta: "Весь каталог производителей →",
  },
  ar: {
    featuredHeading: "مصانع مارتر المعتمدة والمميزة",
    featuredSub: "واجهة عرض برعاية • طلب بالجملة مباشرة من المصنع بدون عمولة",
    verifiedTag: "مصنع معتمد",
    allSuppliersCta: "عرض دليل المصنعين بالكامل ←",
  },
  de: {
    featuredHeading: "EMPFOHLENE VERIFIZIERTE MERTER-HERSTELLER",
    featuredSub: "Gesponsertes Schaufenster • Direkt ab Fabrik mit 0 % Provision",
    verifiedTag: "Verifizierter Hersteller",
    allSuppliersCta: "Alle Hersteller anzeigen →",
  },
  fr: {
    featuredHeading: "FABRICANTS VÉRIFIÉS DE MERTER À LA UNE",
    featuredSub: "Vitrine Sponsorisée • Commande en Gros Direct Usine à 0 % de Commission",
    verifiedTag: "Fabricant Vérifié",
    allSuppliersCta: "Voir Tout l'Annuaire des Fabricants →",
  },
  pl: {
    featuredHeading: "WYRÓŻNIENI ZWERYFIKOWANI PRODUCENCI Z MERTER",
    featuredSub: "Sponsorowana Witryna • Bezpośrednie Zamówienia Fabryczne 0% Prowizji",
    verifiedTag: "Zweryfikowany Producent",
    allSuppliersCta: "Zobacz Pełny Katalog Producentów →",
  },
  bg: {
    featuredHeading: "ПРЕПОРЪЧАНИ ПРОВЕРЕНИ ПРОИЗВОДИТЕЛИ ОТ МЕРТЕР",
    featuredSub: "Спонсорирана витрина • Директни фабрични поръчки на едро с 0% комисиона",
    verifiedTag: "Проверен производител",
    allSuppliersCta: "Виж целия каталог на производители →",
  },
};

function withLangParam(urlPath: string, lang: string): string {
  const code = normalizeLangCode(lang);
  if (code === "tr" || !urlPath.startsWith("/")) {
    return urlPath;
  }
  if (urlPath.includes("lang=")) {
    return urlPath;
  }
  const sep = urlPath.includes("?") ? "&" : "?";
  return `${urlPath}${sep}lang=${code}`;
}

function getLocalizedField(
  slot: SponsoredSlotItem,
  lang: string,
  field: "title" | "subtitle" | "badge_text" | "cta_text"
): string {
  const trMap = slot.translations?.[lang];
  const translatedVal = trMap?.[field];
  if (translatedVal && translatedVal.trim() !== "") {
    return translatedVal;
  }
  return slot[field] || "";
}

function recordSponsoredSlotClick(slotId: string) {
  void fetch(`/api/v1/store/sponsored-slots/${encodeURIComponent(slotId)}/click`, {
    method: "POST",
    keepalive: true,
  }).catch(() => undefined);
}

export function PortalSponsoredSuppliersSection({
  lang,
}: Readonly<{ lang: string }>) {
  const [slots, setSlots] = useState<SponsoredSlotItem[]>([]);

  useEffect(() => {
    let active = true;
    async function loadSlots() {
      try {
        const res = await fetch("/api/v1/store/sponsored-slots");
        if (!res.ok) return;
        const data = (await res.json()) as SponsoredSlotItem[];
        if (active && Array.isArray(data)) {
          setSlots(
            data.filter(
              (s) =>
                s.placement === "home_featured_suppliers" ||
                s.placement === "home_new_collection" ||
                s.placement === "sector_service_ad"
            )
          );
        }
      } catch {
        // Ignore transient network errors
      }
    }
    void loadSlots();
    return () => {
      active = false;
    };
  }, []);

  if (slots.length === 0) return null;

  const L = pickLangText(lang, SECTION_LABELS);

  return (
    <section className="mb-16 select-none">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6 border-b border-cultured pb-4">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[2px] text-amber-700">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{L.featuredSub}</span>
          </span>
          <h3 className="font-serif font-bold text-base sm:text-lg tracking-[1.5px] text-eerie-black uppercase mt-1">
            {L.featuredHeading}
          </h3>
        </div>
        <Link
          href={withLangParam("/ureticiler", lang)}
          className="text-xs font-extrabold uppercase tracking-wider text-eerie-black hover:text-amber-700 no-underline transition-colors"
        >
          {L.allSuppliersCta}
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {slots.slice(0, 6).map((slot) => {
          const title = getLocalizedField(slot, lang, "title");
          const subtitle = getLocalizedField(slot, lang, "subtitle");
          const badge = getLocalizedField(slot, lang, "badge_text");
          const cta = getLocalizedField(slot, lang, "cta_text");
          const rawHref = slot.target_url || `/ureticiler/${slot.brand_slug || ""}`;
          const href = withLangParam(rawHref, lang);

          return (
            <Link
              key={slot.id}
              href={href}
              onClick={() => recordSponsoredSlotClick(slot.id)}
              className="group bg-white border border-cultured hover:border-amber-500/60 transition-all duration-300 flex flex-col justify-between p-6 no-underline shadow-xs hover:shadow-md relative overflow-hidden"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-900 text-[10px] font-extrabold uppercase tracking-widest">
                    <Sparkles className="w-3 h-3 text-amber-600" />
                    <span>{badge}</span>
                  </span>
                  {slot.brand_verified && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>{L.verifiedTag}</span>
                    </span>
                  )}
                </div>

                <h4 className="font-serif font-bold text-base text-eerie-black group-hover:text-amber-700 transition-colors">
                  {title}
                </h4>
                <p className="text-xs text-sonic-silver mt-1.5 line-clamp-2 leading-relaxed">
                  {subtitle}
                </p>
              </div>

              <div className="mt-5 pt-3.5 border-t border-cultured flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-3 text-sonic-silver font-semibold">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-amber-600" />
                    <span>
                      {slot.district || "Merter"}, {slot.city || "İstanbul"}
                    </span>
                  </span>
                  {slot.export_countries && (
                    <span className="inline-flex items-center gap-1 truncate max-w-[130px]">
                      <Globe className="w-3 h-3 text-zinc-400 shrink-0" />
                      <span className="truncate">{slot.export_countries}</span>
                    </span>
                  )}
                </div>

                <span className="inline-flex items-center gap-1 font-extrabold uppercase tracking-wider text-eerie-black group-hover:text-amber-700">
                  <span>{cta}</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export function CategorySponsorBanner({
  lang,
  categorySlug,
}: Readonly<{ lang: string; categorySlug: string }>) {
  const [slot, setSlot] = useState<SponsoredSlotItem | null>(null);

  useEffect(() => {
    let active = true;
    async function loadCategorySponsor() {
      try {
        const res = await fetch(
          `/api/v1/store/sponsored-slots?placement=category_sponsor&category_slug=${encodeURIComponent(categorySlug || "")}`
        );
        if (!res.ok) return;
        const data = (await res.json()) as SponsoredSlotItem[];
        if (active && Array.isArray(data) && data.length > 0) {
          setSlot(data[0]);
        } else if (active) {
          setSlot(null);
        }
      } catch {
        // Ignore transient network errors
      }
    }
    void loadCategorySponsor();
    return () => {
      active = false;
    };
  }, [categorySlug]);

  if (!slot) return null;

  const title = getLocalizedField(slot, lang, "title");
  const subtitle = getLocalizedField(slot, lang, "subtitle");
  const badge = getLocalizedField(slot, lang, "badge_text");
  const cta = getLocalizedField(slot, lang, "cta_text");
  const rawHref = slot.target_url || `/ureticiler/${slot.brand_slug || ""}`;
  const href = withLangParam(rawHref, lang);

  return (
    <div className="bg-gradient-to-r from-amber-50/90 via-white to-amber-50/50 border border-amber-200/80 rounded-[12px] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
      <div className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-500 text-white text-[10px] font-extrabold uppercase tracking-wider rounded">
            <Sparkles className="w-3 h-3" />
            <span>{badge}</span>
          </span>
          {slot.brand_verified && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{slot.brand_name}</span>
            </span>
          )}
        </div>
        <h3 className="text-sm sm:text-base font-extrabold text-eerie-black">
          {title}
        </h3>
        <p className="text-xs text-sonic-silver">{subtitle}</p>
      </div>

      <Link
        href={href}
        onClick={() => recordSponsoredSlotClick(slot.id)}
        className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-eerie-black hover:bg-amber-600 text-white text-xs font-extrabold uppercase tracking-wider rounded-lg no-underline shrink-0 transition-colors"
      >
        <span>{cta}</span>
        <ArrowUpRight className="w-4 h-4" />
      </Link>
    </div>
  );
}

