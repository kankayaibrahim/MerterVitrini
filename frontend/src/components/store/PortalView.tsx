"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Product, Category } from "@/types/store";
import { t, getCategoryPrefix, getCategoryTitle, pickLangText, SupportedLangCode } from "@/app/i18n";
import { ExchangeRate } from "@/app/utils";
import ProductCard from "@/components/store/ProductCard";
import StoriesStrip from "@/components/store/StoriesStrip";
import { PortalSponsoredSuppliersSection } from "@/components/store/SponsoredShowcaseSection";
import GlobalB2BSeoKnowledgeSection from "@/components/seo/GlobalB2BSeoKnowledgeSection";
import { GLOBAL_B2B_SEO_MATRIX, normalizeSeoLang } from "@/utils/seoHelpers";

const PREV_SLIDE_LABELS: Record<string, string> = {
  tr: "Önceki Slayt",
  en: "Previous Slide",
  ru: "Предыдущий слайд",
  ar: "الشريحة السابقة",
  de: "Vorherige Folie",
  fr: "Diapositive précédente",
  pl: "Poprzedni slajd",
  bg: "Предишен слайд",
};

const NEXT_SLIDE_LABELS: Record<string, string> = {
  tr: "Sonraki Slayt",
  en: "Next Slide",
  ru: "Следующий слайд",
  ar: "الشريحة التالية",
  de: "Nächste Folie",
  fr: "Diapositive suivante",
  pl: "Następny slajd",
  bg: "Следващ слайд",
};

interface PortalNewCategoryCopy {
  readonly title: string;
  readonly badge: string;
  readonly viewAll: string;
}

const PORTAL_NEW_CATEGORY_COPY: Record<SupportedLangCode, PortalNewCategoryCopy> = {
  tr: { title: "Yeni Ürünler", badge: "Son 7 Gün", viewAll: "Son 7 Günün Tüm Yeni Ürünleri →" },
  en: { title: "New Arrivals", badge: "Last 7 Days", viewAll: "View All Last 7 Days Arrivals →" },
  ru: { title: "Новые поступления", badge: "За 7 дней", viewAll: "Все новинки за 7 дней →" },
  ar: { title: "وصل حديثاً", badge: "آخر 7 أيام", viewAll: "عرض كل جديد آخر 7 أيام ←" },
  de: { title: "Neuheiten", badge: "Letzte 7 Tage", viewAll: "Alle Neuheiten der letzten 7 Tage →" },
  fr: { title: "Nouveautés", badge: "7 derniers jours", viewAll: "Toutes les nouveautés (7 jours) →" },
  pl: { title: "Nowości", badge: "Ostatnie 7 dni", viewAll: "Zobacz wszystkie nowości (7 dni) →" },
  bg: { title: "Нови продукти", badge: "Последните 7 дни", viewAll: "Всички нови продукти (7 дни) →" },
};

interface PortalViewProps {
  readonly lang: string;
  readonly categories: Category[];
  readonly portalNewArrivals: Product[];
  readonly displayCurrency: string;
  readonly exchangeRates: ExchangeRate[];
  readonly handleOpenModal: (productId: string) => void;
}

export default function PortalView({
  lang,
  categories,
  portalNewArrivals,
  displayCurrency,
  exchangeRates,
  handleOpenModal,
}: Readonly<PortalViewProps>) {
  const [activeSlide, setActiveSlide] = useState<number>(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % 6);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const handlePrevSlide = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveSlide((prev) => (prev === 0 ? 5 : prev - 1));
  };

  const handleNextSlide = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveSlide((prev) => (prev + 1) % 6);
  };

  // Luxury Campaign Slide details mapping
  const slides = [
    {
      id: 0,
      bannerKey: "hero_new_season",
      title: t("portal_slide0_title", lang),
      subtitle: t("portal_slide0_subtitle", lang),
      desc: t("portal_slide0_desc", lang),
      ctaText: t("portal_slide0_cta", lang),
      ctaUrl: `/${getCategoryPrefix(lang)}/tum-urunler`,
      type: "link",
      positionClass: "object-[center_top]"
    },
    {
      id: 1,
      bannerKey: "hero_women_collection",
      title: t("portal_slide1_title", lang),
      subtitle: t("portal_slide1_subtitle", lang),
      desc: t("portal_slide1_desc", lang),
      ctaText: t("portal_slide1_cta", lang),
      ctaUrl: `/${getCategoryPrefix(lang)}/kadin-giyim`,
      type: "link",
      positionClass: "object-[35%_top]"
    },
    {
      id: 2,
      bannerKey: "hero_men_collection",
      title: t("portal_slide2_title", lang),
      subtitle: t("portal_slide2_subtitle", lang),
      desc: t("portal_slide2_desc", lang),
      ctaText: t("portal_slide2_cta", lang),
      ctaUrl: `/${getCategoryPrefix(lang)}/erkek-giyim`,
      type: "link",
      positionClass: "object-[center_top]"
    },
    {
      id: 3,
      bannerKey: "hero_accessories",
      title: t("portal_slide3_title", lang),
      subtitle: t("portal_slide3_subtitle", lang),
      desc: t("portal_slide3_desc", lang),
      ctaText: t("portal_slide3_cta", lang),
      ctaUrl: `/${getCategoryPrefix(lang)}/tum-urunler?sort=newest`,
      type: "link",
      positionClass: "object-center"
    },
    {
      id: 4,
      bannerKey: "hero_new_opportunities",
      title: t("portal_daily_opportunities", lang),
      subtitle: t("portal_wholesale_opportunities", lang),
      desc: t("portal_daily_opportunities_desc", lang),
      ctaText: t("portal_examine_all_products", lang),
      ctaUrl: `/${getCategoryPrefix(lang)}/tum-urunler`,
      type: "link",
      positionClass: "object-center"
    },
    {
      id: 5,
      bannerKey: "hero_app_promo",
      title: t("portal_download_app", lang),
      subtitle: t("portal_mobile_ease", lang),
      desc: t("portal_download_app_desc", lang),
      type: "apps",
      positionClass: "object-center"
    }
  ];

  // Premium Banners SEO localization mapping with fallback support
  const getLocalizedCollectionBanner = (type: "kadin" | "erkek" | "ic_giyim" | "aksesuar") => {
    if (type === "kadin") return "/banners/collection_kadin.webp?v=2";
    if (type === "erkek") return "/banners/collection_erkek.webp?v=2";
    if (type === "ic_giyim") return "/banners/collection_ic_giyim.webp?v=2";
    return "/banners/collection_aksesuar.webp?v=2";
  };

  const handleCollectionImageError = (type: "kadin" | "erkek" | "ic_giyim" | "aksesuar") => (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    let fallback = "/banners/collection_kadin.webp?v=2";
    if (type === "erkek") fallback = "/banners/collection_erkek.webp?v=2";
    else if (type === "ic_giyim") fallback = "/banners/collection_ic_giyim.webp?v=2";
    else if (type === "aksesuar") fallback = "/banners/collection_aksesuar.webp?v=2";

    const picture = img.parentElement;
    if (picture) {
      const sources = picture.querySelectorAll('source');
      sources.forEach(source => source.remove());
    }
    img.src = fallback;
  };

  const safeLang = normalizeSeoLang(lang, "en");
  const seoCopy = GLOBAL_B2B_SEO_MATRIX[safeLang];
  const newCatCopy = pickLangText(lang, PORTAL_NEW_CATEGORY_COPY);
  const prevSlideLabel = PREV_SLIDE_LABELS[safeLang] || PREV_SLIDE_LABELS.en;
  const nextSlideLabel = NEXT_SLIDE_LABELS[safeLang] || NEXT_SLIDE_LABELS.en;

  return (
    <main className="flex-grow max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-300">
      <StoriesStrip lang={lang} />

      {/* A. PREMIUM AUTO-SLIDING HERO CAROUSEL */}
      <div className="w-full relative rounded-none overflow-hidden border border-cultured aspect-[16/10] xs:aspect-[16/9] sm:aspect-[21/9.5] md:aspect-[21/9] lg:aspect-[21/8.5] min-h-[260px] xs:min-h-[320px] sm:min-h-[400px] bg-[#fafafa] select-none mb-8 group">
        
        {/* Left Arrow Button */}
        <button 
          onClick={handlePrevSlide}
          className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 w-10 h-14 bg-black/25 hover:bg-black/45 text-white items-center justify-center cursor-pointer transition-all duration-300 z-20 border-none select-none opacity-0 group-hover:opacity-100"
          aria-label={prevSlideLabel}
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        {/* Right Arrow Button */}
        <button 
          onClick={handleNextSlide}
          className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 w-10 h-14 bg-black/25 hover:bg-black/45 text-white items-center justify-center cursor-pointer transition-all duration-300 z-20 border-none select-none opacity-0 group-hover:opacity-100"
          aria-label={nextSlideLabel}
        >
          <ChevronRight className="w-6 h-6" />
        </button>

        {/* Dynamic Slides Map */}
        {slides.map((slide) => {
          const isActive = activeSlide === slide.id;
          const bannerSrc = `/banners/${slide.bannerKey}.webp?v=2`;
          const mobileBannerSrc = `/banners/${slide.bannerKey}_mobile.webp?v=2`;
          return (
            <div 
              key={slide.id}
              className={`absolute inset-0 transition-opacity duration-1000 flex items-center p-4 pb-16 xs:p-6 xs:pb-20 sm:p-8 md:p-16 ${isActive ? "opacity-100 z-10" : "opacity-0 z-0"}`}
            >
              <picture className="absolute inset-0 w-full h-full">
                <source media="(max-width: 640px)" srcSet={mobileBannerSrc} />
                <img 
                  src={bannerSrc} 
                  alt={slide.title} 
                  className={`w-full h-full object-cover ${slide.positionClass}`}
                  onError={(e) => {
                    const img = e.currentTarget;
                    const picture = img.parentElement;
                    if (picture) {
                      const sources = picture.querySelectorAll('source');
                      sources.forEach(source => source.remove());
                    }
                    img.src = bannerSrc;
                  }}
                  fetchPriority={slide.id === 0 ? "high" : undefined}
                  loading={slide.id === 0 ? "eager" : "lazy"}
                />
              </picture>
              <div className="absolute inset-0 bg-gradient-to-r from-white/70 via-white/30 to-transparent z-0" />
              <div className="relative z-10 max-w-[90vw] sm:max-w-[360px] md:max-w-[420px] bg-[#F8F6F2]/95 p-6 sm:p-8 md:p-10 rounded-none border-none shadow-none flex flex-col gap-3">
                <span className="text-accent-gold font-bold text-[9px] sm:text-xs uppercase tracking-[2.5px]">{slide.subtitle}</span>
                <h2 className="font-serif font-bold text-lg xs:text-xl sm:text-2xl md:text-4xl text-black leading-tight tracking-[1px]">{slide.title}</h2>
                <p className="text-[11px] xs:text-xs text-sonic-silver font-normal leading-relaxed mt-0.5">{slide.desc}</p>
                {slide.type === "link" ? (
                  <Link 
                    href={slide.ctaUrl || "/"} 
                    className="mt-2 inline-flex items-center pt-2.5 pb-2.5 w-fit no-underline transition-all duration-200 group"
                  >
                    <span className="text-[10.5px] sm:text-xs font-bold uppercase tracking-[2px] text-black border-b border-black pb-1.5 group-hover:text-accent-gold group-hover:border-accent-gold transition-colors">
                      {slide.ctaText}
                    </span>
                  </Link>
                ) : (
                  <div className="flex flex-wrap gap-4 mt-2">
                    <Link 
                      href={safeLang === "tr" ? "/mobil-uygulama" : `/mobil-uygulama?lang=${safeLang}`}
                      className="inline-flex items-center pt-2.5 pb-2.5 no-underline transition-all duration-200 group"
                    >
                      <span lang="en" className="text-[10px] sm:text-xs font-bold uppercase tracking-[2px] text-black border-b border-black pb-1.5 group-hover:text-accent-gold group-hover:border-accent-gold transition-colors">
                        {t("portal_google_play", lang) || "GOOGLE PLAY"}
                      </span>
                    </Link>
                    <Link 
                      href={safeLang === "tr" ? "/mobil-uygulama" : `/mobil-uygulama?lang=${safeLang}`}
                      className="inline-flex items-center pt-2.5 pb-2.5 no-underline transition-all duration-200 group"
                    >
                      <span lang="en" className="text-[10px] sm:text-xs font-bold uppercase tracking-[2px] text-black border-b border-black pb-1.5 group-hover:text-accent-gold group-hover:border-accent-gold transition-colors">
                        {t("portal_app_store", lang) || "APP STORE"}
                      </span>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Slide Indicators */}
        <div className="absolute bottom-3.5 left-1/2 -translate-x-1/2 bg-black/35 backdrop-blur-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 z-20">
          {slides.map((slide) => (
            <button 
              key={slide.id}
              type="button"
              onClick={() => setActiveSlide(slide.id)} 
              aria-label={`Slide ${slide.id + 1}`}
              className="p-1.5 flex items-center justify-center bg-transparent border-none cursor-pointer transition-all active:scale-95"
            >
              <span className={`h-1 rounded-full transition-all ${activeSlide === slide.id ? "w-6 bg-white" : "w-2.5 bg-white/45 hover:bg-white/75"}`} />
            </button>
          ))}
        </div>
      </div>

      {/* A.5 SEMANTIC B2B HERO HEADING (H1) FOR GLOBAL SEARCH ENGINES & BUYERS */}
      <section className="mb-10 bg-[#F8F6F2] border border-cultured px-5 py-6 sm:px-8 sm:py-7 text-center">
        <h1 className="font-serif font-bold text-lg sm:text-2xl md:text-[26px] text-eerie-black tracking-tight leading-snug max-w-4xl mx-auto">
          {seoCopy.portalH1}
        </h1>
        <p className="mt-2 text-xs sm:text-sm text-sonic-silver leading-relaxed max-w-3xl mx-auto">
          {seoCopy.portalLead}
        </p>
      </section>

      {/* B. CATEGORY NAVIGATORS (Luxury editorial clean text badges) */}
      <div className="mb-12 select-none border-t border-b border-cultured py-6">
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 md:gap-6">
          <Link
            href={`/${getCategoryPrefix(lang)}/yeni-urunler`}
            className="group cursor-pointer border-none bg-transparent transition-all no-underline"
          >
            <div className="border border-salmon-pink/40 group-hover:border-salmon-pink bg-white py-3 px-5 sm:px-6 text-center transition-all duration-300 flex items-center gap-2">
              <span className="text-[11px] sm:text-xs font-bold uppercase tracking-[2px] text-eerie-black group-hover:text-salmon-pink transition-colors">
                {newCatCopy.title}
              </span>
              <span className="px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider bg-salmon-pink/10 text-salmon-pink rounded-full">
                {newCatCopy.badge}
              </span>
            </div>
          </Link>
          {categories.length === 0 ? (
            Array.from({ length: 5 }).map((_, idx) => (
              <div key={idx} className="h-10 w-28 bg-cultured animate-pulse" />
            ))
          ) : (
            categories.map((cat) => {
              const prefix = getCategoryPrefix(lang);
              const url = `/${prefix}/${cat.slug || cat.id}`;
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

      {/* B.5 SPONSORED FEATURED MANUFACTURERS & SHOWCASE SLOTS */}
      <PortalSponsoredSuppliersSection lang={lang} />

      {/* C. VISUAL PREMIUM COLLECTIONS GRID */}
      <div className="mb-16 select-none">
        <h3 className="font-serif font-bold text-sm tracking-[2px] text-eerie-black uppercase mb-8 text-center">{t("portal_season_collections", lang)}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Card 1: Kadın Giyim */}
          <a 
            href={`/${getCategoryPrefix(lang)}/kadin-giyim`}
            className="relative rounded-none overflow-hidden aspect-[16/10] border border-cultured cursor-pointer group shadow-none select-none no-underline"
          >
            <picture className="absolute inset-0 w-full h-full">
              <source media="(max-width: 640px)" srcSet={getLocalizedCollectionBanner("kadin").replace(".webp", "_mobile.webp")} />
              <img 
                src={getLocalizedCollectionBanner("kadin")} 
                alt={t("portal_women_clothing", lang)} 
                className="w-full h-full object-cover object-[center_top] group-hover:scale-[1.02] transition-transform duration-700 ease-out" 
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
            href={`/${getCategoryPrefix(lang)}/erkek-giyim`}
            className="relative rounded-none overflow-hidden aspect-[16/10] border border-cultured cursor-pointer group shadow-none select-none no-underline"
          >
            <picture className="absolute inset-0 w-full h-full">
              <source media="(max-width: 640px)" srcSet={getLocalizedCollectionBanner("erkek").replace(".webp", "_mobile.webp")} />
              <img 
                src={getLocalizedCollectionBanner("erkek")} 
                alt={t("portal_men_clothing", lang)} 
                className="w-full h-full object-cover object-[center_top] group-hover:scale-[1.02] transition-transform duration-700 ease-out" 
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
            href={`/${getCategoryPrefix(lang)}/kadin-giyim`}
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
            href={`/${getCategoryPrefix(lang)}/tum-urunler?sort=newest`}
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
        <div className="flex flex-col items-center gap-2 mb-8 text-center">
          <h3 className="font-serif font-bold text-sm tracking-[2px] text-eerie-black uppercase">
            {t("portal_new_arrivals", lang)}
          </h3>
          <Link
            href={`/${getCategoryPrefix(lang)}/yeni-urunler`}
            className="text-[11px] font-bold uppercase tracking-[1.5px] text-salmon-pink hover:text-eerie-black transition-colors no-underline"
          >
            {newCatCopy.viewAll}
          </Link>
        </div>
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

      {/* Popüler Aramalar / Popular Searches (SEO Internal Linking Row) */}
      <div className="mb-12 text-center select-none border-t border-b border-cultured py-8">
        <h4 className="font-serif font-bold text-[11px] tracking-[2px] text-sonic-silver uppercase mb-4">
          {t("portal_popular_searches_title", lang)}
        </h4>
        <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 max-w-2xl mx-auto px-4">
          {lang === "tr" && (
            <Link
              href="/toptan-hazir-giyim"
              className="text-[11px] font-bold text-onyx hover:text-black transition-colors no-underline uppercase tracking-[1px] hover:underline"
            >
              TOPTAN HAZIR GİYİM
            </Link>
          )}
          <a
            href={`/${getCategoryPrefix(lang)}/kadin-giyim/elbise-abiye/elbise`}
            className="text-[11px] font-bold text-onyx hover:text-black transition-colors no-underline uppercase tracking-[1px] hover:underline"
          >
            {t("portal_popular_searches_link1", lang)}
          </a>
          <a
            href={`/${getCategoryPrefix(lang)}/kadin-giyim/elbise-abiye/elbise/jaguar-elbise`}
            className="text-[11px] font-bold text-onyx hover:text-black transition-colors no-underline uppercase tracking-[1px] hover:underline"
          >
            {t("portal_popular_searches_link2", lang)}
          </a>
          <a
            href={`/${getCategoryPrefix(lang)}/kadin-giyim/ust-giyim/bustiyer`}
            className="text-[11px] font-bold text-onyx hover:text-black transition-colors no-underline uppercase tracking-[1px] hover:underline"
          >
            {t("portal_popular_searches_link3", lang)}
          </a>
          <a
            href={`/${getCategoryPrefix(lang)}/erkek-giyim`}
            className="text-[11px] font-bold text-onyx hover:text-black transition-colors no-underline uppercase tracking-[1px] hover:underline"
          >
            {t("portal_popular_searches_link4", lang)}
          </a>
        </div>
      </div>

      {/* E. BROWSE ALL CTA PANEL */}
      <div className="bg-[#fafafa] border border-cultured rounded-none p-8 md:p-12 text-center flex flex-col items-center gap-4 shadow-none mb-6">
        <span className="text-[10px] font-bold tracking-[2px] uppercase text-accent-gold">{t("portal_explore_all_collections", lang)}</span>
        <h3 className="font-serif font-bold text-xl md:text-2xl text-eerie-black max-w-md">{t("portal_all_in_one", lang)}</h3>
        <p className="text-xs text-sonic-silver font-normal leading-relaxed max-w-lg">{t("portal_all_in_one_desc", lang)}</p>
        <a 
          href={`/${getCategoryPrefix(lang)}/tum-urunler`}
          className="mt-2 px-8 py-3.5 bg-black hover:bg-neutral-800 text-white text-xs font-bold uppercase rounded-none transition-all duration-300 tracking-[2px] border-none shadow-none cursor-pointer active:scale-98 no-underline"
        >
          {t("portal_examine_all_products", lang)}
        </a>
      </div>

      {/* F. GLOBAL B2B WHOLESALE SOURCING GUIDE & FAQ KNOWLEDGE SECTION */}
      <GlobalB2BSeoKnowledgeSection lang={lang} />

    </main>
  );
}
