"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Home, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Product, Category } from "@/types/store";
import { t, getCategoryTitle, getCategoryTrail, getCategoryUrl } from "@/app/i18n";
import { ExchangeRate } from "@/app/utils";
import { useIsStoreAuthenticated } from "@/app/storeAuth";
import ProductCard from "@/components/store/ProductCard";
import SeoDescription from "@/components/store/SeoDescription";
import HeroBanner from "@/components/store/HeroBanner";
import { CategorySponsorBanner } from "@/components/store/SponsoredShowcaseSection";

interface CatalogFaqItem {
  readonly q: string;
  readonly a: string;
}

const CATEGORY_FAQ_HEADINGS: Record<string, string> = {
  tr: "Sıkça Sorulan Toptan Alım Soruları",
  en: "Wholesale Buyer Frequently Asked Questions",
  ru: "Частые вопросы оптовых покупателей",
  ar: "الأسئلة الشائعة لتجار الجملة",
  de: "Häufig gestellte B2B-Großhandelsfragen",
  fr: "Questions fréquentes des acheteurs B2B",
  pl: "Najczęstsze pytania kupujących hurtowo",
  bg: "Често задавани въпроси за търговия на едро",
};

interface CatalogViewProps {
  readonly lang: string;
  readonly categories: Category[];
  readonly activeCategoryId: string;
  readonly products: Product[];
  readonly totalProductsCount: number;
  readonly itemsPerPage: number;
  readonly currentPage: number;
  readonly setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  readonly sortBy: string;
  readonly setSortBy: (s: string) => void;
  readonly fetchError: string | null;
  readonly loadingProducts: boolean;
  readonly displayCurrency: string;
  readonly exchangeRates: ExchangeRate[];
  readonly handleOpenModal: (productId: string) => void;
  readonly hasActiveFiltersCount: number;
  readonly setIsMobileFiltersOpen: (open: boolean) => void;
  readonly sidebar: React.ReactNode;
  readonly categoryFaqs?: readonly CatalogFaqItem[];
}

const findCategory = (tree: Category[], target: string): Category | null => {
  for (const cat of tree) {
    if (cat.id === target || cat.slug === target) return cat;
    if (cat.children && cat.children.length > 0) {
      const found = findCategory(cat.children, target);
      if (found) return found;
    }
  }
  return null;
};

interface CatalogProductSectionProps {
  readonly fetchError: string | null;
  readonly loadingProducts: boolean;
  readonly products: Product[];
  readonly lang: string;
  readonly handleOpenModal: (productId: string) => void;
  readonly displayCurrency: string;
  readonly exchangeRates: ExchangeRate[];
  readonly sortBy?: string;
}

function CatalogProductSection({
  fetchError,
  loadingProducts,
  products,
  lang,
  handleOpenModal,
  displayCurrency,
  exchangeRates,
  sortBy,
}: Readonly<CatalogProductSectionProps>) {
  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center py-10 px-6 text-center border-2 border-salmon-pink/20 bg-salmon-pink/5 rounded-[15px] p-8 select-none shadow-sm gap-3">
        <span className="text-3xl">⚠️</span>
        <p className="text-sm font-bold text-salmon-pink uppercase tracking-wide">{t("connection_error_title", lang)}</p>
        <p className="text-xs font-semibold text-eerie-black/80 max-w-md leading-relaxed">{t("connection_error_desc", lang)}</p>
        <p className="text-[10px] font-bold text-sonic-silver mt-1">{t("connection_error_tip", lang)}</p>
      </div>
    );
  }

  if (loadingProducts) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div key={`skeleton-${idx}`} className="bg-white rounded-[15px] border border-cultured flex flex-col h-full overflow-hidden p-4 gap-3 animate-pulse">
            <div className="aspect-[4/5] bg-cultured rounded-[10px] w-full" />
            <div className="h-3 bg-cultured rounded w-1/3 mt-2" />
            <div className="h-4 bg-cultured rounded w-3/4" />
            <div className="h-3 bg-cultured rounded w-1/2 mt-1" />
            <div className="h-6 bg-cultured rounded w-1/3 mt-auto" />
            <div className="h-9 bg-cultured rounded-[8px] w-full mt-2" />
          </div>
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-cultured bg-white rounded-[10px] p-8 select-none shadow-sm">
        <span className="text-3xl mb-2">🔍</span>
        <p className="text-xs font-bold text-sonic-silver">{t("no_products", lang)}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-6" id="catalog-section">
      {products.map((p, idx) => (
        <ProductCard
          key={p.id}
          product={p}
          lang={lang}
          onOpenModal={handleOpenModal}
          priority={idx < 4}
          displayCurrency={displayCurrency}
          exchangeRates={exchangeRates}
          sortBy={sortBy}
        />
      ))}
    </div>
  );
}

interface CatalogPaginationProps {
  readonly currentPage: number;
  readonly totalPages: number;
  readonly lang: string;
  readonly onPageChange: (page: number) => void;
}

function CatalogPagination({
  currentPage,
  totalPages,
  lang,
  onPageChange,
}: Readonly<CatalogPaginationProps>) {
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();

  const getPageHref = (page: number) => {
    const sp = new URLSearchParams(searchParams ? searchParams.toString() : "");
    if (page <= 1) {
      sp.delete("page");
    } else {
      sp.set("page", String(page));
    }
    const query = sp.toString();
    return query ? `${pathname}?${query}` : pathname || "?";
  };

  const navButtonClass =
    "w-9 h-9 rounded-[5px] border border-cultured bg-white flex items-center justify-center text-onyx hover:border-salmon-pink hover:text-salmon-pink transition-colors cursor-pointer select-none active:scale-95 no-underline";
  const disabledClass =
    "w-9 h-9 rounded-[5px] border border-cultured bg-white flex items-center justify-center text-onyx opacity-30 cursor-not-allowed select-none";

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3 mt-8 select-none">
      {currentPage === 1 ? (
        <span aria-disabled="true" title={t("First Page", lang)} className={disabledClass}>
          <ChevronsLeft className="w-4 h-4" />
        </span>
      ) : (
        <Link
          href={getPageHref(1)}
          onClick={(e) => {
            e.preventDefault();
            onPageChange(1);
          }}
          title={t("First Page", lang)}
          className={navButtonClass}
        >
          <ChevronsLeft className="w-4 h-4" />
        </Link>
      )}

      {currentPage === 1 ? (
        <span aria-disabled="true" title={t("Previous Page", lang)} className={disabledClass}>
          <ChevronLeft className="w-4 h-4" />
        </span>
      ) : (
        <Link
          href={getPageHref(Math.max(currentPage - 1, 1))}
          onClick={(e) => {
            e.preventDefault();
            onPageChange(Math.max(currentPage - 1, 1));
          }}
          title={t("Previous Page", lang)}
          className={navButtonClass}
        >
          <ChevronLeft className="w-4 h-4" />
        </Link>
      )}

      <span className="text-xs font-bold text-sonic-silver px-2 min-w-[70px] text-center">
        {t("page", lang)} {currentPage} / {totalPages}
      </span>

      {currentPage >= totalPages ? (
        <span aria-disabled="true" title={t("Next Page", lang)} className={disabledClass}>
          <ChevronRight className="w-4 h-4" />
        </span>
      ) : (
        <Link
          href={getPageHref(Math.min(currentPage + 1, totalPages))}
          onClick={(e) => {
            e.preventDefault();
            onPageChange(Math.min(currentPage + 1, totalPages));
          }}
          title={t("Next Page", lang)}
          className={navButtonClass}
        >
          <ChevronRight className="w-4 h-4" />
        </Link>
      )}

      {currentPage >= totalPages ? (
        <span aria-disabled="true" title={t("Last Page", lang)} className={disabledClass}>
          <ChevronsRight className="w-4 h-4" />
        </span>
      ) : (
        <Link
          href={getPageHref(totalPages)}
          onClick={(e) => {
            e.preventDefault();
            onPageChange(totalPages);
          }}
          title={t("Last Page", lang)}
          className={navButtonClass}
        >
          <ChevronsRight className="w-4 h-4" />
        </Link>
      )}
    </div>
  );
}

function getCategoryB2BFallbackDesc(title: string, l: string): string {
  const m: Record<string, string> = {
    tr: `Merter Vitrini toptan ${title} kategorisi, İstanbul Merter ve Güngören tekstil imalatçılarının en güncel butik koleksiyonlarını bir araya getirmektedir. Ürünlerimiz toptan seri ve paketler halinde satılmakta olup, paket içi asortili beden dağılımı sayesinde butiğinizin tüm taleplerini karşılar. Minimum sipariş (MOQ) avantajı ve tek konsolide kargo ile dünya geneline güvenle ulaştırılır.`,
    en: `The Merter Vitrini wholesale ${title} collection brings together the latest boutique styles directly from Istanbul Merter textile manufacturers. All products are supplied in wholesale packs and size runs with full ratio distribution. Enjoy direct factory pricing, low MOQ, and worldwide express consolidated shipping.`,
    ru: `Каталог ${title} оптом на Merter Vitrini объединяет новейшие коллекции фабрик Стамбула. Продажа фабричными сериями и пакетами с полным размерным рядом. Прямые поставки от производителей без посредников, минимальный заказ и быстрая доставка карго.`,
    ar: `يوفر قسم ${title} بالجملة على منصة مارتر فيتريني أحدث تشكيلات أزياء البوتيك من مصانع إسطنبول. تباع المنتجات بنظام السيري والباكت المقاسات المتنوعة مع أسعار المصنع وشحن دولي سريع.`,
    de: `Die Großhandelskollektion ${title} auf Merter Vitrini bietet die neuesten Boutique-Styles direkt von Istanbuler Herstellern in Größenserien mit schnellem weltweiten Versand.`,
    fr: `La collection de gros ${title} sur Merter Vitrini rassemble le prêt-à-porter des fabricants d'Istanbul en séries assorties avec expédition internationale consolidée.`,
    pl: `Kolekcja hurtowa ${title} na Merter Vitrini łączy najnowsze fasony butikowe prosto od producentów ze Stambułu w pełnych seriach rozmiarowych.`,
    bg: `Колекцията на едро ${title} в Merter Vitrini предлага бутикови модели директно от производители в Истанбул в размерни серии с бърза доставка.`,
  };
  return m[l] || m.en;
}

export default function CatalogView({
  lang,
  categories,
  activeCategoryId,
  products,
  totalProductsCount,
  itemsPerPage,
  currentPage,
  setCurrentPage,
  sortBy,
  setSortBy,
  fetchError,
  loadingProducts,
  displayCurrency,
  exchangeRates,
  handleOpenModal,
  hasActiveFiltersCount,
  setIsMobileFiltersOpen,
  sidebar,
  categoryFaqs,
}: Readonly<CatalogViewProps>) {
  const isAuthenticated = useIsStoreAuthenticated();
  const activeCatObj = activeCategoryId ? findCategory(categories, activeCategoryId) : null;
  const categoryTitle = activeCatObj ? getCategoryTitle(activeCatObj, lang) : "";
  const rawSeoDesc = activeCatObj?.translations?.[lang]?.seo_description;
  const effectiveSeoDesc = rawSeoDesc || (categoryTitle ? getCategoryB2BFallbackDesc(categoryTitle, lang) : "");

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (page <= 1) {
        url.searchParams.delete("page");
      } else {
        url.searchParams.set("page", page.toString());
      }
      window.history.pushState({}, "", url.toString());
    }
    window.scrollTo({ top: 220, behavior: "smooth" });
  };

  const totalPages = Math.ceil(totalProductsCount / itemsPerPage) || 1;

  return (
    <main className="flex-grow max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-300">
      {/* Category Breadcrumbs */}
      {activeCategoryId && (
        <nav className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-sonic-silver mb-6 uppercase tracking-wider select-none">
          <Link
            href={lang && lang !== "en" ? `/${lang}` : "/"}
            className="hover:text-[#1C1C1C] flex items-center gap-1 transition-colors no-underline text-sonic-silver"
          >
            <Home className="w-3.5 h-3.5" />
            <span>{t("home", lang)}</span>
          </Link>
          {getCategoryTrail(categories, activeCategoryId)?.map((cat) => (
            <React.Fragment key={cat.id}>
              <ChevronRight className="w-3 h-3 text-spanish-gray rtl:rotate-180" />
              <Link
                href={getCategoryUrl(categories, cat, lang)}
                className="hover:text-[#1C1C1C] transition-colors no-underline text-sonic-silver last:text-[#1C1C1C] last:pointer-events-none last:font-extrabold"
              >
                {getCategoryTitle(cat, lang)}
              </Link>
            </React.Fragment>
          ))}
        </nav>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Hero Banner Subcomponent */}
        <HeroBanner lang={lang} />

        {/* Left Sidebar Filter Subcomponent (Desktop only) passed as a slot */}
        <div className="hidden lg:block lg:col-span-1">
          {sidebar}
        </div>

        {/* Right Product Listing Catalog */}
        <section className="lg:col-span-3 flex flex-col gap-6">
          <CategorySponsorBanner
            lang={lang}
            categorySlug={activeCatObj?.slug || activeCategoryId || ""}
          />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-cultured pb-4 w-full">
            <div className="flex flex-col gap-1 select-none">
              <h1 className="font-sans font-extrabold text-xl tracking-tight text-eerie-black">
                {categoryTitle || t("all_products", lang)}
              </h1>
              {activeCatObj ? (
                <span className="text-[11px] font-semibold text-sonic-silver">
                  {t("active_products_label", lang)} <strong className="text-salmon-pink">{activeCatObj.active_products || 0}</strong> • {t("total_products_label", lang)} <strong className="text-eerie-black">{activeCatObj.total_products || 0}</strong>
                </span>
              ) : (
                <span className="text-[11px] font-semibold text-sonic-silver">
                  {t("total_catalog_products_label", lang)} <strong className="text-salmon-pink">{totalProductsCount}</strong>
                </span>
              )}
            </div>

            {/* Mobile Filter & Sort Control Bar */}
            <div className="flex lg:hidden items-center gap-3 w-full mt-2.5">
              <button
                type="button"
                onClick={() => setIsMobileFiltersOpen(true)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-white border border-cultured rounded-xl hover:bg-zinc-50 font-bold text-xs text-onyx shadow-sm transition-all cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-salmon-pink" aria-hidden="true"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>
                <span>{t("Filter", lang)}</span>
                {hasActiveFiltersCount > 0 && (
                  <span className="bg-salmon-pink text-white rounded-full w-4.5 h-4.5 flex items-center justify-center text-[9px] font-black leading-none shrink-0 shadow-sm animate-scale-in">
                    {hasActiveFiltersCount}
                  </span>
                )}
              </button>

              <div className="flex-1 relative">
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full py-2.5 pl-3 pr-8 bg-white border border-cultured rounded-xl hover:bg-zinc-50 font-bold text-xs text-onyx shadow-sm transition-all appearance-none cursor-pointer focus:outline-none focus:border-salmon-pink"
                >
                  <option value="newest">{t("sort_newest", lang)}</option>
                  {isAuthenticated && (
                    <>
                      <option value="price_asc">{t("sort_price_asc", lang)}</option>
                      <option value="price_desc">{t("sort_price_desc", lang)}</option>
                    </>
                  )}
                  <option value="name_asc">{t("sort_name_asc", lang)}</option>
                  <option value="name_desc">{t("sort_name_desc", lang)}</option>
                  <option value="sku_asc">{t("sort_sku_asc", lang)}</option>
                  <option value="sku_desc">{t("sort_sku_desc", lang)}</option>
                </select>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-sonic-silver text-[9px]">▼</span>
              </div>
            </div>

            {/* Desktop Sort Control Bar */}
            <div className="hidden lg:flex items-center gap-3">
              <div className="flex items-center gap-1.5 select-none shrink-0">
                <span className="text-[10px] font-extrabold text-sonic-silver uppercase tracking-wider">{t("show_label", lang) || "Show:"}</span>
                <span className="bg-cultured py-1 px-2.5 rounded-md text-[10px] font-extrabold text-onyx">{products.length}</span>
              </div>

              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="py-1.5 pl-3 pr-8 bg-cultured border border-transparent rounded-[8px] hover:bg-cultured/80 font-bold text-[11px] text-onyx tracking-wide appearance-none cursor-pointer focus:outline-none focus:border-salmon-pink transition-all"
                >
                  <option value="newest">{t("sort_newest", lang)}</option>
                  {isAuthenticated && (
                    <>
                      <option value="price_asc">{t("sort_price_asc", lang)}</option>
                      <option value="price_desc">{t("sort_price_desc", lang)}</option>
                    </>
                  )}
                  <option value="name_asc">{t("sort_name_asc", lang)}</option>
                  <option value="name_desc">{t("sort_name_desc", lang)}</option>
                  <option value="sku_asc">{t("sort_sku_asc", lang)}</option>
                  <option value="sku_desc">{t("sort_sku_desc", lang)}</option>
                </select>
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-sonic-silver text-[8px]">▼</span>
              </div>
            </div>
          </div>

          {/* Products Grid Section */}
          <CatalogProductSection
            fetchError={fetchError}
            loadingProducts={loadingProducts}
            products={products}
            lang={lang}
            handleOpenModal={handleOpenModal}
            displayCurrency={displayCurrency}
            exchangeRates={exchangeRates}
            sortBy={sortBy}
          />

          {/* Pagination Controls */}
          {products.length > 0 && (
            <CatalogPagination
              currentPage={currentPage}
              totalPages={totalPages}
              lang={lang}
              onPageChange={handlePageChange}
            />
          )}
        </section>
      </div>

      {/* Category SEO Description Block */}
      {effectiveSeoDesc && (
        <SeoDescription
          categoryTitle={categoryTitle}
          seoDesc={effectiveSeoDesc}
          lang={lang}
        />
      )}

      {/* Visible Category B2B FAQs (mirrors FAQPage JSON-LD for Google Rich Results compliance) */}
      {categoryFaqs && categoryFaqs.length > 0 && (
        <section
          aria-labelledby="category-b2b-faq-heading"
          className="mt-8 bg-white border border-cultured rounded-[15px] p-6 md:p-8 shadow-sm"
        >
          <h2
            id="category-b2b-faq-heading"
            className="font-sans font-extrabold text-sm sm:text-base uppercase tracking-wider text-eerie-black mb-4"
          >
            {CATEGORY_FAQ_HEADINGS[lang] || CATEGORY_FAQ_HEADINGS.en}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {categoryFaqs.map((faq) => (
              <div
                key={faq.q}
                className="p-4 rounded-xl bg-[#FAFAFA] border border-cultured space-y-1.5"
              >
                <h3 className="text-xs sm:text-sm font-extrabold text-eerie-black leading-snug">
                  {faq.q}
                </h3>
                <p className="text-xs text-sonic-silver leading-relaxed">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
