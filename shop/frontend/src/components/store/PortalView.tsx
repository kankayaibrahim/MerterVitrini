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
      <div className="w-full relative rounded-[20px] overflow-hidden border border-cultured aspect-[16/10] xs:aspect-[16/9] sm:aspect-[21/9] min-h-[220px] xs:min-h-[280px] sm:min-h-[280px] bg-gradient-to-br from-[#fafafa] to-[#fff0f1] shadow-sm select-none mb-10 group">
        {/* Slide 1: Opportunities Promo */}
        <div className={`absolute inset-0 transition-opacity duration-1000 flex items-center p-4 xs:p-6 sm:p-8 md:p-16 ${activeSlide === 0 ? "opacity-100 z-10" : "opacity-0 z-0"}`}>
          <img 
            src={getLocalizedSliderBanner("opportunities")} 
            alt={t("portal_daily_opportunities", lang)} 
            className="absolute inset-0 w-full h-full object-cover object-[35%_top]" 
            onError={handleSliderImageError("opportunities")}
            fetchPriority="high"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-white/70 via-white/30 to-transparent z-0" />
          <div className="relative z-10 max-w-[90vw] sm:max-w-[340px] md:max-w-[380px] bg-white/85 backdrop-blur-md p-4 sm:p-5 md:p-6 rounded-[15px] border border-white/20 shadow-lg flex flex-col gap-1.5 sm:gap-2">
            <span className="text-salmon-pink font-extrabold text-[9px] sm:text-xs uppercase tracking-[1.5px] sm:tracking-[2px]">{t("portal_wholesale_opportunities", lang)}</span>
            <h2 className="font-sans font-extrabold text-base xs:text-lg sm:text-xl md:text-3xl text-eerie-black leading-tight">{t("portal_daily_opportunities", lang)}</h2>
            <p className="text-[11px] xs:text-xs text-sonic-silver font-semibold leading-relaxed mt-0.5">{t("portal_daily_opportunities_desc", lang)}</p>
            <a href="/tum-urunler" className="mt-2.5 px-4 py-2 sm:px-5 sm:py-2.5 bg-salmon-pink hover:bg-eerie-black text-white text-[10px] sm:text-xs font-bold uppercase rounded-[5px] transition-colors duration-300 w-fit cursor-pointer border-none shadow-sm no-underline">{t("portal_examine_catalog", lang)}</a>
          </div>
        </div>

        {/* Slide 2: Mobile App Promo */}
        <div className={`absolute inset-0 transition-opacity duration-1000 flex items-center p-4 xs:p-6 sm:p-8 md:p-16 ${activeSlide === 1 ? "opacity-100 z-10" : "opacity-0 z-0"}`}>
          <img 
            src={getLocalizedSliderBanner("app_promo")} 
            alt={t("portal_download_app", lang)} 
            className="absolute inset-0 w-full h-full object-cover" 
            onError={handleSliderImageError("app_promo")}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-white/70 via-white/30 to-transparent z-0" />
          <div className="relative z-10 max-w-[90vw] sm:max-w-[340px] md:max-w-[380px] bg-white/85 backdrop-blur-md p-4 sm:p-5 md:p-6 rounded-[15px] border border-white/20 shadow-lg flex flex-col gap-1.5 sm:gap-2">
            <span className="text-salmon-pink font-extrabold text-[9px] sm:text-xs uppercase tracking-[1.5px] sm:tracking-[2px]">{t("portal_mobile_ease", lang)}</span>
            <h2 className="font-sans font-extrabold text-base xs:text-lg sm:text-xl md:text-3xl text-eerie-black leading-tight">{t("portal_download_app", lang)}</h2>
            <p className="text-[11px] xs:text-xs text-sonic-silver font-semibold leading-relaxed mt-0.5">{t("portal_download_app_desc", lang)}</p>
            <div className="flex gap-2 mt-2">
              <a 
                href="#" 
                className="px-3.5 py-2 bg-eerie-black hover:bg-salmon-pink text-white text-[10px] sm:text-xs font-bold uppercase rounded-[5px] transition-colors duration-300 w-fit cursor-pointer border-none shadow-sm no-underline flex items-center gap-1.5"
              >
                <span>🤖</span> {t("portal_google_play", lang) || "Google Play"}
              </a>
              <a 
                href="#" 
                className="px-3.5 py-2 bg-eerie-black hover:bg-salmon-pink text-white text-[10px] sm:text-xs font-bold uppercase rounded-[5px] transition-colors duration-300 w-fit cursor-pointer border-none shadow-sm no-underline flex items-center gap-1.5"
              >
                <span>🍎</span> {t("portal_app_store", lang) || "App Store"}
              </a>
            </div>
          </div>
        </div>

        {/* Slide Indicators */}
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-0 z-20">
          <button 
            onClick={() => setActiveSlide(0)} 
            aria-label={lang === "tr" ? "Slayt 1" : "Slide 1"}
            className="w-12 h-12 flex items-center justify-center bg-transparent border-none cursor-pointer transition-all hover:scale-110 active:scale-95"
          >
            <span className={`w-2.5 h-2.5 rounded-full transition-all ${activeSlide === 0 ? "bg-salmon-pink scale-110" : "bg-spanish-gray/50 hover:bg-spanish-gray"}`} />
          </button>
          <button 
            onClick={() => setActiveSlide(1)} 
            aria-label={lang === "tr" ? "Slayt 2" : "Slide 2"}
            className="w-12 h-12 flex items-center justify-center bg-transparent border-none cursor-pointer transition-all hover:scale-110 active:scale-95"
          >
            <span className={`w-2.5 h-2.5 rounded-full transition-all ${activeSlide === 1 ? "bg-salmon-pink scale-110" : "bg-spanish-gray/50 hover:bg-spanish-gray"}`} />
          </button>
        </div>
      </div>

      {/* B. CIRCULAR CATEGORY NAVIGATORS */}
      <div className="mb-12 select-none">
        <h3 className="font-sans font-extrabold text-xs tracking-[2px] text-eerie-black uppercase mb-6 text-center">{t("portal_wholesale_categories", lang)}</h3>
        <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10">
          {categories.length === 0 ? (
            Array.from({ length: 5 }).map((_, idx) => (
              <div key={idx} className="flex flex-col items-center gap-3 animate-pulse">
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-cultured" />
                <div className="h-3 w-16 bg-cultured rounded" />
              </div>
            ))
          ) : (
            categories.map((cat) => {
              const prefix = getCategoryPrefix(lang);
              const url = `/${prefix}/${cat.slug || cat.id}/`;
              return (
                <a 
                  key={cat.id} 
                  href={url}
                  className="flex flex-col items-center gap-3 group cursor-pointer border-none bg-transparent active:scale-95 transition-transform no-underline"
                >
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-full border border-cultured bg-white shadow-sm flex items-center justify-center text-2xl group-hover:border-salmon-pink group-hover:scale-105 transition-all duration-300 relative overflow-hidden">
                    <span className="relative z-10">
                      {cat.slug === "kadin-giyim" ? "👗" : cat.slug === "erkek-giyim" ? "👔" : cat.slug === "buyuk-beden" ? "👚" : cat.slug === "ic-giyim" ? "👙" : "✨"}
                    </span>
                    <div className="absolute inset-0 bg-salmon-pink/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <span className="text-xs font-bold text-onyx group-hover:text-salmon-pink transition-colors">
                    {getCategoryTitle(cat, lang)}
                  </span>
                </a>
              );
            })
          )}
        </div>
      </div>

      {/* C. VISUAL PREMIUM COLLECTIONS GRID */}
      <div className="mb-16 select-none">
        <h3 className="font-sans font-extrabold text-xs tracking-[2px] text-eerie-black uppercase mb-8 text-center">{t("portal_season_collections", lang)}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Card 1: Kadın Giyim */}
          <a 
            href={`/${getCategoryPrefix(lang)}/kadin-giyim/`}
            className="relative rounded-[15px] overflow-hidden aspect-[16/10] border border-cultured cursor-pointer group shadow-sm select-none no-underline"
          >
            <img 
              src={getLocalizedCollectionBanner("kadin")} 
              alt={t("portal_women_clothing", lang)} 
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-700 ease-out" 
              onError={handleCollectionImageError("kadin")}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent flex items-end p-5 sm:p-7">
              <div className="bg-white/90 backdrop-blur-md px-5 py-3.5 rounded-[10px] border border-white/20 shadow-md flex flex-col gap-1 max-w-[85%] transform group-hover:translate-y-[-2px] transition-transform duration-300 select-none animate-in fade-in slide-in-from-bottom-2 duration-500">
                <span className="text-salmon-pink font-extrabold text-[8px] sm:text-[9px] uppercase tracking-[1.5px]">{t("portal_women_trend_desc", lang)}</span>
                <h4 className="font-sans font-extrabold text-xs sm:text-sm text-eerie-black uppercase tracking-[0.5px] leading-tight">{t("portal_women_clothing", lang)}</h4>
              </div>
            </div>
          </a>

          {/* Card 2: Erkek Giyim */}
          <a 
            href={`/${getCategoryPrefix(lang)}/erkek-giyim/`}
            className="relative rounded-[15px] overflow-hidden aspect-[16/10] border border-cultured cursor-pointer group shadow-sm select-none no-underline"
          >
            <img 
              src={getLocalizedCollectionBanner("erkek")} 
              alt={t("portal_men_clothing", lang)} 
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-700 ease-out" 
              onError={handleCollectionImageError("erkek")}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent flex items-end p-5 sm:p-7">
              <div className="bg-white/90 backdrop-blur-md px-5 py-3.5 rounded-[10px] border border-white/20 shadow-md flex flex-col gap-1 max-w-[85%] transform group-hover:translate-y-[-2px] transition-transform duration-300 select-none animate-in fade-in slide-in-from-bottom-2 duration-500">
                <span className="text-salmon-pink font-extrabold text-[8px] sm:text-[9px] uppercase tracking-[1.5px]">{t("portal_men_trend_desc", lang)}</span>
                <h4 className="font-sans font-extrabold text-xs sm:text-sm text-eerie-black uppercase tracking-[0.5px] leading-tight">{t("portal_men_clothing", lang)}</h4>
              </div>
            </div>
          </a>

          {/* Card 3: İç Giyim */}
          <a 
            href={`/tum-urunler?q=${lang === 'tr' ? 'tayt' : 'leggings'}`}
            className="relative rounded-[15px] overflow-hidden aspect-[16/10] border border-cultured cursor-pointer group shadow-sm select-none no-underline"
          >
            <img 
              src={getLocalizedCollectionBanner("ic_giyim")} 
              alt={t("portal_lingerie", lang)} 
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-700 ease-out" 
              onError={handleCollectionImageError("ic_giyim")}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent flex items-end p-5 sm:p-7">
              <div className="bg-white/90 backdrop-blur-md px-5 py-3.5 rounded-[10px] border border-white/20 shadow-md flex flex-col gap-1 max-w-[85%] transform group-hover:translate-y-[-2px] transition-transform duration-300 select-none animate-in fade-in slide-in-from-bottom-2 duration-500">
                <span className="text-salmon-pink font-extrabold text-[8px] sm:text-[9px] uppercase tracking-[1.5px]">{t("portal_lingerie_desc", lang)}</span>
                <h4 className="font-sans font-extrabold text-xs sm:text-sm text-eerie-black uppercase tracking-[0.5px] leading-tight">{t("portal_lingerie", lang)}</h4>
              </div>
            </div>
          </a>

          {/* Card 4: Aksesuar */}
          <a 
            href={`/tum-urunler?q=${lang === 'tr' ? 'aksesuar' : 'accessories'}`}
            className="relative rounded-[15px] overflow-hidden aspect-[16/10] border border-cultured cursor-pointer group shadow-sm select-none no-underline"
          >
            <img 
              src={getLocalizedCollectionBanner("aksesuar")} 
              alt={t("portal_accessories", lang)} 
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-700 ease-out" 
              onError={handleCollectionImageError("aksesuar")}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent flex items-end p-5 sm:p-7">
              <div className="bg-white/90 backdrop-blur-md px-5 py-3.5 rounded-[10px] border border-white/20 shadow-md flex flex-col gap-1 max-w-[85%] transform group-hover:translate-y-[-2px] transition-transform duration-300 select-none animate-in fade-in slide-in-from-bottom-2 duration-500">
                <span className="text-salmon-pink font-extrabold text-[8px] sm:text-[9px] uppercase tracking-[1.5px]">{t("portal_accessories_desc", lang)}</span>
                <h4 className="font-sans font-extrabold text-xs sm:text-sm text-eerie-black uppercase tracking-[0.5px] leading-tight">{t("portal_accessories", lang)}</h4>
              </div>
            </div>
          </a>

        </div>
      </div>

      {/* D. NEW ARRIVALS PREVIEW CAROUSEL */}
      <div className="mb-16 select-none">
        <h3 className="font-sans font-extrabold text-xs tracking-[2px] text-eerie-black uppercase mb-8 text-center">{t("portal_new_arrivals", lang)}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {portalNewArrivals.length === 0 ? (
            Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="bg-white rounded-[15px] border border-cultured flex flex-col h-full overflow-hidden p-4 gap-3 animate-pulse">
                <div className="aspect-[4/5] bg-cultured rounded-[10px] w-full" />
                <div className="h-3 bg-cultured rounded w-1/3 mt-2" />
                <div className="h-4 bg-cultured rounded w-3/4" />
                <div className="h-3 bg-cultured rounded w-1/2 mt-1" />
                <div className="h-6 bg-cultured rounded w-1/3 mt-auto" />
                <div className="h-9 bg-cultured rounded-[8px] w-full mt-2" />
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
      <div className="bg-[#fafafa] border border-cultured rounded-[15px] p-8 md:p-12 text-center flex flex-col items-center gap-4 shadow-inner mb-6">
        <span className="text-[10px] font-extrabold tracking-[2px] uppercase text-salmon-pink">{t("portal_explore_all_collections", lang)}</span>
        <h3 className="font-sans font-extrabold text-xl md:text-2xl text-eerie-black max-w-md">{t("portal_all_in_one", lang)}</h3>
        <p className="text-xs text-sonic-silver font-semibold leading-relaxed max-w-lg">{t("portal_all_in_one_desc", lang)}</p>
        <a 
          href="/tum-urunler"
          className="mt-2 px-8 py-3.5 bg-salmon-pink hover:bg-eerie-black text-white text-xs font-extrabold uppercase rounded-[5px] transition-all duration-300 tracking-[1px] border-none shadow-md cursor-pointer active:scale-98 no-underline"
        >
          {t("portal_examine_all_products", lang)}
        </a>
      </div>

    </main>
  );
}
