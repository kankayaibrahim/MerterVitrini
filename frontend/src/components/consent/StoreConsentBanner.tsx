"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ShieldCheck, SlidersHorizontal, Cookie } from "lucide-react";
import { useHeadlessConsentUI } from "@c15t/react/headless";
import { getCategoryPrefix } from "@/app/i18n";
import { CONSENT_UI_COPY, normalizeConsentLang, type ConsentLang } from "./consentCopy";
import { CONSENT_RUNTIME_UPDATED_EVENT, getCachedConsentInitData } from "./consentRuntime";

interface StoreConsentBannerProps {
  lang: ConsentLang;
}

export default function StoreConsentBanner({ lang }: StoreConsentBannerProps) {
  const { banner, performBannerAction } = useHeadlessConsentUI();
  const safeLang = normalizeConsentLang(lang);
  const copy = useMemo(() => CONSENT_UI_COPY[safeLang], [safeLang]);
  const isRtl = safeLang === "ar";
  const policyHref = `/${getCategoryPrefix(safeLang)}/pages/cerez-politikasi`;
  const [runtimeTick, setRuntimeTick] = useState(0);

  useEffect(() => {
    const onRuntimeUpdate = () => setRuntimeTick((prev) => prev + 1);
    window.addEventListener(CONSENT_RUNTIME_UPDATED_EVENT, onRuntimeUpdate);
    return () => {
      window.removeEventListener(CONSENT_RUNTIME_UPDATED_EVENT, onRuntimeUpdate);
    };
  }, []);

  const initData = useMemo(() => {
    void runtimeTick;
    return getCachedConsentInitData();
  }, [runtimeTick]);

  if (!banner.isVisible || initData?.settings?.banner_enabled === false) {
    return null;
  }

  const isFullBar = initData?.settings?.banner_layout === "bar";

  return (
    <aside
      dir={isRtl ? "rtl" : "ltr"}
      aria-label={copy.bannerTitle}
      data-testid="merter-consent-banner"
      className={
        isFullBar
          ? "fixed inset-x-0 bottom-0 z-[80] border-t border-eerie-black/15 bg-white/95 backdrop-blur-md shadow-[0_-12px_40px_rgba(15,15,15,0.14)] px-4 py-4 md:px-8"
          : "fixed bottom-4 inset-x-4 md:inset-x-auto md:bottom-5 md:end-5 md:max-w-[540px] z-[80] rounded-2xl border border-eerie-black/15 bg-white/97 backdrop-blur-md shadow-[0_20px_50px_rgba(15,15,15,0.2)] p-5"
      }
    >
      <div className="mx-auto max-w-6xl flex flex-col gap-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-eerie-black text-accent-gold px-2.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              {copy.badge}
            </span>
            <h2 className="font-serif text-base md:text-lg font-bold text-eerie-black flex items-center gap-2">
              <Cookie className="w-4 h-4 text-accent-gold shrink-0" />
              {copy.bannerTitle}
            </h2>
          </div>
        </div>

        <p className="text-xs leading-relaxed text-eerie-black/80">
          {copy.bannerDescription}{" "}
          <Link
            href={policyHref}
            className="font-semibold text-eerie-black underline decoration-accent-gold underline-offset-4 hover:text-accent-gold transition-colors"
          >
            {copy.cookiePolicyLabel}
          </Link>
        </p>

        <p className="rounded-lg bg-cultured/80 border border-eerie-black/10 px-3 py-2 text-[11px] leading-snug text-eerie-black/75">
          {copy.hostingNote}
        </p>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            data-testid="consent-accept-all"
            onClick={() => void performBannerAction("accept")}
            className="flex-1 min-w-[140px] rounded-xl bg-eerie-black hover:bg-black text-white px-4 py-2.5 text-xs font-semibold tracking-wide transition-colors cursor-pointer"
          >
            {copy.acceptAll}
          </button>

          <button
            type="button"
            data-testid="consent-reject-all"
            onClick={() => void performBannerAction("reject")}
            className="flex-1 min-w-[140px] rounded-xl border border-eerie-black/25 bg-white hover:bg-cultured text-eerie-black px-4 py-2.5 text-xs font-semibold transition-colors cursor-pointer"
          >
            {copy.rejectAll}
          </button>

          <button
            type="button"
            data-testid="consent-customize"
            onClick={() => void performBannerAction("customize")}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-accent-gold/60 bg-accent-gold/10 hover:bg-accent-gold/20 text-eerie-black px-3.5 py-2.5 text-xs font-semibold transition-colors cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {copy.customize}
          </button>
        </div>
      </div>
    </aside>
  );
}
