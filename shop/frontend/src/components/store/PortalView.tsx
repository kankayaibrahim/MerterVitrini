"use client";

import React, { useState, useEffect } from "react";
import { Product, Category } from "@/types/store";
import { t, getCategoryPrefix, getCategoryTitle } from "@/app/i18n";
import ProductCard from "@/components/store/ProductCard";

interface PortalViewProps {
  lang: string;
  categories: Category[];
  portalNewArrivals: Product[];
  displayCurrency: string;
  exchangeRates: any[];
  handleOpenModal: (productId: string) => void;
}

export default function PortalView({
  lang,
  categories,
  portalNewArrivals,
  displayCurrency,
  exchangeRates,
  handleOpenModal,
}: PortalViewProps) {
  const [activeSlide, setActiveSlide] = useState<number>(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev === 0 ? 1 : 0));
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  // Premium Banners SEO localization mapping with fallback support
  const getLocalizedCollectionBanner = (type: "kadin" | "erkek" | "ic_giyim" | "aksesuar") => {
    if (type === "kadin") return "/banners/collection_kadin.webp";
    if (type === "erkek") return "/banners/collection_erkek.webp";
    if (type === "ic_giyim") return "/banners/collection_ic_giyim.webp";
    return "/banners/collection_aksesuar.webp";
  };

  const getLocalizedSliderBanner = (type: "opportunities" | "app_promo") => {
    if (type === "opportunities") {
      return "/banners/hero_new_opportunities.webp";
    }
    return "/banners/hero_app_promo.webp";
  };

  const handleCollectionImageError = (type: "kadin" | "erkek" | "ic_giyim" | "aksesuar") => (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    let fallback = "/banners/collection_kadin.webp";
    if (type === "erkek") fallback = "/banners/collection_erkek.webp";
    else if (type === "ic_giyim") fallback = "/banners/collection_ic_giyim.webp";
    else if (type === "aksesuar") fallback = "/banners/collection_aksesuar.webp";

    if (!img.src.endsWith(fallback)) {
      img.src = fallback;
    }
  };

  const handleSliderImageError = (type: "opportunities" | "app_promo") => (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    let fallback = "/banners/hero_new_opportunities.webp";
    if (type === "app_promo") fallback = "/banners/hero_app_promo.webp";

    if (!img.src.endsWith(fallback)) {
      img.src = fallback;
    }
  };

  return (
    <main className="flex-grow max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-300">
      
      {/* A. PREMIUM AUTO-SLIDING HERO CAROUSEL */}
      <div className="w-full relative rounded-none overflow-hidden border border-cultured aspect-[16/10] xs:aspect-[16/9] sm:aspect-[21/9] min-h-[220px] xs:min-h-[280px] sm:min-h-[280px] bg-[#fafafa] select-none mb-10 group">
        {/* Slide 1: Opportunities Promo */}
        <div className={`absolute inset-0 transition-opacity duration-1000 flex items-center p-4 xs:p-6 sm:p-8 md:p-16 ${activeSlide === 0 ? "opacity-100 z-10" : "opacity-0 z-0"}`}>
          <picture className="absolute inset-0 w-full h-full">
            <source media="(max-width: 640px)" srcSet={getLocalizedSliderBanner("opportunities").replace(".webp", "_mobile.webp")} />
            <img 
              src={getLocalizedSliderBanner("opportunities")} 
              alt={t("portal_daily_opportunities", lang)} 
              className="w-full h-full object-cover object-[35%_top]" 
              onError={handleSliderImageError("opportunities")}
              fetchPriority="high"
              loading="eager"
            />
          </picture>
          <div className="absolute inset-0 bg-gradient-to-r from-white/70 via-white/30 to-transparent z-0" />
          <div className="relative z-10 max-w-[90vw] sm:max-w-[340px] md:max-w-[380px] bg-white p-5 sm:p-6 md:p-8 rounded-none border border-black/10 shadow-none flex flex-col gap-2">
            <span className="text-accent-gold font-bold text-[9px] sm:text-xs uppercase tracking-[2px]">{t("portal_wholesale_opportunities", lang)}</span>
            <h2 className="font-serif font-bold text-base xs:text-lg sm:text-xl md:text-3xl text-eerie-black leading-tight">{t("portal_daily_opportunities", lang)}</h2>
            <p className="text-[11px] xs:text-xs text-sonic-silver font-normal leading-relaxed mt-0.5">{t("portal_daily_opportunities_desc", lang)}</p>
            <a href="/tum-urunler" className="mt-2.5 px-6 py-3 bg-black hover:bg-neutral-800 text-white text-[10px] sm:text-xs font-bold uppercase rounded-none transition-colors duration-300 w-fit cursor-pointer border-none no-underline tracking-widest">{t("portal_examine_catalog", lang)}</a>
          </div>
        </div>

        {/* Slide 2: Mobile App Promo */}
        <div className={`absolute inset-0 transition-opacity duration-1000 flex items-center p-4 xs:p-6 sm:p-8 md:p-16 ${activeSlide === 1 ? "opacity-100 z-10" : "opacity-0 z-0"}`}>
          <picture className="absolute inset-0 w-full h-full">
            <source media="(max-width: 640px)" srcSet={getLocalizedSliderBanner("app_promo").replace(".webp", "_mobile.webp")} />
            <img 
              src={getLocalizedSliderBanner("app_promo")} 
              alt={t("portal_download_app", lang)} 
              className="w-full h-full object-cover" 
              onError={handleSliderImageError("app_promo")}
            />
          </picture>
          <div className="absolute inset-0 bg-gradient-to-r from-white/70 via-white/30 to-transparent z-0" />
          <div className="relative z-10 max-w-[90vw] sm:max-w-[340px] md:max-w-[380px] bg-white p-5 sm:p-6 md:p-8 rounded-none border border-black/10 shadow-none flex flex-col gap-2">
            <span className="text-accent-gold font-bold text-[9px] sm:text-xs uppercase tracking-[2px]">{t("portal_mobile_ease", lang)}</span>
            <h2 className="font-serif font-bold text-base xs:text-lg sm:text-xl md:text-3xl text-eerie-black leading-tight">{t("portal_download_app", lang)}</h2>
            <p className="text-[11px] xs:text-xs text-sonic-silver font-normal leading-relaxed mt-0.5">{t("portal_download_app_desc", lang)}</p>
            <div className="flex gap-2 mt-2">
              <a 
                href="#" 
                className="px-4 py-2.5 bg-black hover:bg-neutral-800 text-white text-[10px] sm:text-xs font-bold uppercase rounded-none transition-colors duration-300 w-fit cursor-pointer border-none no-underline flex items-center gap-1.5 tracking-widest"
              >
                {t("portal_google_play", lang) || "Google Play"}
              </a>
              <a 
                href="#" 
                className="px-4 py-2.5 bg-black hover:bg-neutral-800 text-white text-[10px] sm:text-xs font-bold uppercase rounded-none transition-colors duration-300 w-fit cursor-pointer border-none no-underline flex items-center gap-1.5 tracking-widest"
              >
                {t("portal_app_store", lang) || "App Store"}
              </a>
            </div>
          </div>
        </div>

        {/* Slide Indicators */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 z-20">
          <button 
            onClick={() => setActiveSlide(0)} 
            aria-label={lang === "tr" ? "Slayt 1" : "Slide 1"}
            className="w-8 h-8 flex items-center justify-center bg-transparent border-none cursor-pointer transition-all active:scale-95"
          >
            <span className={`w-6 h-0.5 transition-all ${activeSlide === 0 ? "bg-black" : "bg-spanish-gray/50 hover:bg-spanish-gray"}`} />
          </button>
          <button 
            onClick={() => setActiveSlide(1)} 
            aria-label={lang === "tr" ? "Slayt 2" : "Slide 2"}
            className="w-8 h-8 flex items-center justify-center bg-transparent border-none cursor-pointer transition-all active:scale-95"
          >
            <span className={`w-6 h-0.5 transition-all ${activeSlide === 1 ? "bg-black" : "bg-spanish-gray/50 hover:bg-spanish-gray"}`} />
          </button>
        </div>
      </div>

      {/* B. CATEGORY NAVIGATORS (Beymen-inspired clean text badges) */}
      <div className="mb-12 select-none border-t border-b border-cultured py-6">
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 md:gap-6">
          {categories.length === 0 ? (
            Array.from({ length: 5 }).map((_, idx) => (
              <div key={idx} className="h-10 w-28 bg-cultured animate-pulse" />
            ))
          ) : (
            categories.map((cat) => {
              const prefix = getCategoryPrefix(lang);
              const url = `/${prefix}/${cat.slug || cat.id}/`;
              return (
                <a 
                  key={cat.id} 
                  href={url}
                  className="group cursor-pointer border-none bg-transparent transition-all no-underline"
                >
                  <div className="border border-black/10 group-hover:border-black bg-white py-3 px-5 sm:px-6 text-center transition-all duration-300">
                    <span className="text-[11px] sm:text-xs font-bold uppercase tracking-[2px] text-onyx group-hover:text-black transition-colors block">
                      {getCategoryTitle(cat, lang)}
                    </span>
                  </div>
                </a>
              );
            })
          )}
        </div>
      </div>

      {/* C. VISUAL PREMIUM COLLECTIONS GRID */}
      <div className="mb-16 select-none">
        <h3 className="font-serif font-bold text-sm tracking-[2px] text-eerie-black uppercase mb-8 text-center">{t("portal_season_collections", lang)}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Card 1: Kadın Giyim */}
          <a 
            href={`/${getCategoryPrefix(lang)}/kadin-giyim/`}
            className="relative rounded-none overflow-hidden aspect-[16/10] border border-cultured cursor-pointer group shadow-none select-none no-underline"
          >
            <picture className="absolute inset-0 w-full h-full">
              <source media="(max-width: 640px)" srcSet={getLocalizedCollectionBanner("kadin").replace(".webp", "_mobile.webp")} />
              <img 
                src={getLocalizedCollectionBanner("kadin")} 
                alt={t("portal_women_clothing", lang)} 
                className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-700 ease-out" 
                onError={handleCollectionImageError("kadin")}
              />
            </picture>
            <div className="absolute inset-0 bg-black/5 flex items-end justify-center p-6">
              <div className="bg-white px-6 py-4 rounded-none border border-black/10 shadow-none text-center flex flex-col gap-1 max-w-[90%] transform group-hover:scale-[1.01] transition-transform duration-300">
                <span className="text-accent-gold font-bold text-[9px] uppercase tracking-[1.5px]">{t("portal_women_trend_desc", lang)}</span>
                <h4 className="font-serif font-bold text-sm sm:text-base text-black uppercase tracking-[1px] leading-tight">{t("portal_women_clothing", lang)}</h4>
              </div>
            </div>
          </a>

          {/* Card 2: Erkek Giyim */}
          <a 
            href={`/${getCategoryPrefix(lang)}/erkek-giyim/`}
            className="relative rounded-none overflow-hidden aspect-[16/10] border border-cultured cursor-pointer group shadow-none select-none no-underline"
          >
            <picture className="absolute inset-0 w-full h-full">
              <source media="(max-width: 640px)" srcSet={getLocalizedCollectionBanner("erkek").replace(".webp", "_mobile.webp")} />
              <img 
                src={getLocalizedCollectionBanner("erkek")} 
                alt={t("portal_men_clothing", lang)} 
                className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-700 ease-out" 
                onError={handleCollectionImageError("erkek")}
              />
            </picture>
            <div className="absolute inset-0 bg-black/5 flex items-end justify-center p-6">
              <div className="bg-white px-6 py-4 rounded-none border border-black/10 shadow-none text-center flex flex-col gap-1 max-w-[90%] transform group-hover:scale-[1.01] transition-transform duration-300">
                <span className="text-accent-gold font-bold text-[9px] uppercase tracking-[1.5px]">{t("portal_men_trend_desc", lang)}</span>
                <h4 className="font-serif font-bold text-sm sm:text-base text-black uppercase tracking-[1px] leading-tight">{t("portal_men_clothing", lang)}</h4>
              </div>
            </div>
          </a>

          {/* Card 3: İç Giyim */}
          <a 
            href={`/tum-urunler?q=${lang === 'tr' ? 'tayt' : 'leggings'}`}
            className="relative rounded-none overflow-hidden aspect-[16/10] border border-cultured cursor-pointer group shadow-none select-none no-underline"
          >
            <picture className="absolute inset-0 w-full h-full">
              <source media="(max-width: 640px)" srcSet={getLocalizedCollectionBanner("ic_giyim").replace(".webp", "_mobile.webp")} />
              <img 
                src={getLocalizedCollectionBanner("ic_giyim")} 
                alt={t("portal_lingerie", lang)} 
                className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-700 ease-out" 
                onError={handleCollectionImageError("ic_giyim")}
              />
            </picture>
            <div className="absolute inset-0 bg-black/5 flex items-end justify-center p-6">
              <div className="bg-white px-6 py-4 rounded-none border border-black/10 shadow-none text-center flex flex-col gap-1 max-w-[90%] transform group-hover:scale-[1.01] transition-transform duration-300">
                <span className="text-accent-gold font-bold text-[9px] uppercase tracking-[1.5px]">{t("portal_lingerie_desc", lang)}</span>
                <h4 className="font-serif font-bold text-sm sm:text-base text-black uppercase tracking-[1px] leading-tight">{t("portal_lingerie", lang)}</h4>
              </div>
            </div>
          </a>

          {/* Card 4: Aksesuar */}
          <a 
            href={`/tum-urunler?q=${lang === 'tr' ? 'aksesuar' : 'accessories'}`}
            className="relative rounded-none overflow-hidden aspect-[16/10] border border-cultured cursor-pointer group shadow-none select-none no-underline"
          >
            <picture className="absolute inset-0 w-full h-full">
              <source media="(max-width: 640px)" srcSet={getLocalizedCollectionBanner("aksesuar").replace(".webp", "_mobile.webp")} />
              <img 
                src={getLocalizedCollectionBanner("aksesuar")} 
                alt={t("portal_accessories", lang)} 
                className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-700 ease-out" 
                onError={handleCollectionImageError("aksesuar")}
              />
            </picture>
            <div className="absolute inset-0 bg-black/5 flex items-end justify-center p-6">
              <div className="bg-white px-6 py-4 rounded-none border border-black/10 shadow-none text-center flex flex-col gap-1 max-w-[90%] transform group-hover:scale-[1.01] transition-transform duration-300">
                <span className="text-accent-gold font-bold text-[9px] uppercase tracking-[1.5px]">{t("portal_accessories_desc", lang)}</span>
                <h4 className="font-serif font-bold text-sm sm:text-base text-black uppercase tracking-[1px] leading-tight">{t("portal_accessories", lang)}</h4>
              </div>
            </div>
          </a>

        </div>
      </div>

      {/* D. NEW ARRIVALS PREVIEW CAROUSEL */}
      <div className="mb-16 select-none">
        <h3 className="font-serif font-bold text-sm tracking-[2px] text-eerie-black uppercase mb-8 text-center">{t("portal_new_arrivals", lang)}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {portalNewArrivals.length === 0 ? (
            Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="bg-white rounded-none border border-cultured flex flex-col h-full overflow-hidden p-4 gap-3 animate-pulse">
                <div className="aspect-[4/5] bg-cultured rounded-none w-full" />
                <div className="h-3 bg-cultured rounded-none w-1/3 mt-2" />
                <div className="h-4 bg-cultured rounded-none w-3/4" />
                <div className="h-3 bg-cultured rounded-none w-1/2 mt-1" />
                <div className="h-6 bg-cultured rounded-none w-1/3 mt-auto" />
                <div className="h-9 bg-cultured rounded-none w-full mt-2" />
              </div>
            ))
          ) : (
            portalNewArrivals.map((p) => (
              <ProductCard 
                key={p.id} 
                product={p} 
                lang={lang} 
                onOpenModal={handleOpenModal} 
                displayCurrency={displayCurrency}
                exchangeRates={exchangeRates}
              />
            ))
          )}
        </div>
      </div>

      {/* E. BROWSE ALL CTA PANEL */}
      <div className="bg-[#fafafa] border border-cultured rounded-none p-8 md:p-12 text-center flex flex-col items-center gap-4 shadow-none mb-6">
        <span className="text-[10px] font-bold tracking-[2px] uppercase text-accent-gold">{t("portal_explore_all_collections", lang)}</span>
        <h3 className="font-serif font-bold text-xl md:text-2xl text-eerie-black max-w-md">{t("portal_all_in_one", lang)}</h3>
        <p className="text-xs text-sonic-silver font-normal leading-relaxed max-w-lg">{t("portal_all_in_one_desc", lang)}</p>
        <a 
          href="/tum-urunler"
          className="mt-2 px-8 py-3.5 bg-black hover:bg-neutral-800 text-white text-xs font-bold uppercase rounded-none transition-all duration-300 tracking-[2px] border-none shadow-none cursor-pointer active:scale-98 no-underline"
        >
          {t("portal_examine_all_products", lang)}
        </a>
      </div>

    </main>
  );
}
