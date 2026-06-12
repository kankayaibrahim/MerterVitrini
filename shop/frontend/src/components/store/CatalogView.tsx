"use client";

import React, { useState } from "react";
import { ChevronLeft, ChevronRight, Home, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Product, Category } from "@/types/store";
import { t, getCategoryTitle, getCategoryTrail, getCategoryUrl } from "@/app/i18n";
import ProductCard from "@/components/store/ProductCard";
import SeoDescription from "@/components/store/SeoDescription";
import HeroBanner from "@/components/store/HeroBanner";


interface CatalogViewProps {
  lang: string;
  categories: Category[];
  activeCategoryId: string;
  products: Product[];
  totalProductsCount: number;
  itemsPerPage: number;
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  sortBy: string;
  setSortBy: (s: string) => void;
  fetchError: string | null;
  loadingProducts: boolean;
  displayCurrency: string;
  exchangeRates: any[];
  handleOpenModal: (productId: string) => void;
  hasActiveFiltersCount: number;
  setIsMobileFiltersOpen: (open: boolean) => void;
  sidebar: React.ReactNode;
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
}: CatalogViewProps) {
  const activeCatObj = activeCategoryId ? findCategory(categories, activeCategoryId) : null;
  const seoDesc = activeCatObj?.translations?.[lang]?.seo_description;
  const categoryTitle = activeCatObj ? getCategoryTitle(activeCatObj, lang) : "";

  return (
    <main className="flex-grow max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-300">
      
      {/* Category Breadcrumbs */}
      {activeCategoryId && (
        <nav className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-sonic-silver mb-6 uppercase tracking-wider select-none">
          <a href="/" className="hover:text-salmon-pink flex items-center gap-1 transition-colors no-underline text-sonic-silver">
            <Home className="w-3.5 h-3.5" />
            <span>{t("home", lang)}</span>
          </a>
          {getCategoryTrail(categories, activeCategoryId)?.map((cat) => (
            <React.Fragment key={cat.id}>
              <ChevronRight className="w-3 h-3 text-spanish-gray" />
              <a 
                href={getCategoryUrl(categories, cat, lang)}
                className="hover:text-salmon-pink transition-colors no-underline text-sonic-silver last:text-salmon-pink last:pointer-events-none last:font-extrabold"
              >
                {getCategoryTitle(cat, lang)}
              </a>
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-cultured pb-4 w-full">
            <div className="flex flex-col gap-1 select-none">
              <h2 className="font-sans font-extrabold text-xl tracking-tight text-eerie-black">
                {activeCategoryId 
                  ? getCategoryTitle(findCategory(categories, activeCategoryId), lang) || t("all_products", lang)
                  : t("all_products", lang)
                }
              </h2>
              {(() => {
                if (activeCatObj) {
                  const activeCount = activeCatObj.active_products || 0;
                  const totalCount = activeCatObj.total_products || 0;
                  return (
                    <span className="text-[11px] font-semibold text-sonic-silver">
                      {t("active_products_label", lang)} <strong className="text-salmon-pink">{activeCount}</strong> • {t("total_products_label", lang)} <strong className="text-eerie-black">{totalCount}</strong>
                    </span>
                  );
                } else {
                  return (
                    <span className="text-[11px] font-semibold text-sonic-silver">
                      {t("total_catalog_products_label", lang)} <strong className="text-salmon-pink">{totalProductsCount}</strong>
                    </span>
                  );
                }
              })()}
            </div>
            
            {/* Mobile Filter & Sort Control Bar */}
            <div className="flex lg:hidden items-center gap-3 w-full mt-2.5">
              <button
                type="button"
                onClick={() => setIsMobileFiltersOpen(true)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-white border border-cultured rounded-xl hover:bg-zinc-50 font-bold text-xs text-onyx shadow-sm transition-all cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-salmon-pink"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>
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
                  <option value="price_asc">{t("sort_price_asc", lang)}</option>
                  <option value="price_desc">{t("sort_price_desc", lang)}</option>
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
                  <option value="price_asc">{t("sort_price_asc", lang)}</option>
                  <option value="price_desc">{t("sort_price_desc", lang)}</option>
                  <option value="name_asc">{t("sort_name_asc", lang)}</option>
                  <option value="name_desc">{t("sort_name_desc", lang)}</option>
                  <option value="sku_asc">{t("sort_sku_asc", lang)}</option>
                  <option value="sku_desc">{t("sort_sku_desc", lang)}</option>
                </select>
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-sonic-silver text-[8px]">▼</span>
              </div>
            </div>
          </div>

          {/* Products Grid */}
          {fetchError ? (
            <div className="flex flex-col items-center justify-center py-10 px-6 text-center border-2 border-salmon-pink/20 bg-salmon-pink/5 rounded-[15px] p-8 select-none shadow-sm gap-3">
              <span className="text-3xl">⚠️</span>
              <p className="text-sm font-bold text-salmon-pink uppercase tracking-wide">{t("connection_error_title", lang)}</p>
              <p className="text-xs font-semibold text-eerie-black/80 max-w-md leading-relaxed">{t("connection_error_desc", lang)}</p>
              <p className="text-[10px] font-bold text-sonic-silver mt-1">{t("connection_error_tip", lang)}</p>
            </div>
          ) : loadingProducts ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="spinner animate-spin" />
              <span className="text-xs font-bold text-sonic-silver select-none">{t("loading", lang)}</span>
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-cultured bg-white rounded-[10px] p-8 select-none shadow-sm">
              <span className="text-3xl mb-2">🔍</span>
              <p className="text-xs font-bold text-sonic-silver">{t("no_products", lang)}</p>
            </div>
          ) : (
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
                />
              ))}
            </div>
          )}

          {/* Pagination Controls */}
          {products.length > 0 && (() => {
            const totalPages = Math.ceil(totalProductsCount / itemsPerPage) || 1;
            return (
              <div className="flex items-center justify-center gap-2 sm:gap-3 mt-8 select-none">
                {/* First Page Button */}
                <button
                  disabled={currentPage === 1}
                  onClick={() => {
                    setCurrentPage(1);
                    window.scrollTo({ top: 220, behavior: "smooth" });
                  }}
                  title={t("First Page", lang)}
                  className="w-9 h-9 rounded-[5px] border border-cultured bg-white flex items-center justify-center text-onyx hover:border-salmon-pink hover:text-salmon-pink disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer select-none active:scale-95"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>

                {/* Previous Page Button */}
                <button
                  disabled={currentPage === 1}
                  onClick={() => {
                    setCurrentPage(prev => Math.max(prev - 1, 1));
                    window.scrollTo({ top: 220, behavior: "smooth" });
                  }}
                  title={t("Previous Page", lang)}
                  className="w-9 h-9 rounded-[5px] border border-cultured bg-white flex items-center justify-center text-onyx hover:border-salmon-pink hover:text-salmon-pink disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer select-none active:scale-95"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                
                {/* Current Page Status */}
                <span className="text-xs font-bold text-sonic-silver px-2 min-w-[70px] text-center">
                  {t("page", lang)} {currentPage} / {totalPages}
                </span>
                
                {/* Next Page Button */}
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => {
                    setCurrentPage(prev => Math.min(prev + 1, totalPages));
                    window.scrollTo({ top: 220, behavior: "smooth" });
                  }}
                  title={t("Next Page", lang)}
                  className="w-9 h-9 rounded-[5px] border border-cultured bg-white flex items-center justify-center text-onyx hover:border-salmon-pink hover:text-salmon-pink disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer select-none active:scale-95"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                {/* Last Page Button */}
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => {
                    setCurrentPage(totalPages);
                    window.scrollTo({ top: 220, behavior: "smooth" });
                  }}
                  title={t("Last Page", lang)}
                  className="w-9 h-9 rounded-[5px] border border-cultured bg-white flex items-center justify-center text-onyx hover:border-salmon-pink hover:text-salmon-pink disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer select-none active:scale-95"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            );
          })()}
        </section>
      </div>

      {/* Category SEO Description Block */}
      {seoDesc && (
        <SeoDescription
          categoryTitle={categoryTitle}
          seoDesc={seoDesc}
          lang={lang}
        />
      )}

    </main>
  );
}
