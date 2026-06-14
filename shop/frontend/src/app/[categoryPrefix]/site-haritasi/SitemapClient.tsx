"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Compass, BookOpen, ChevronRight, Info } from "lucide-react";
import Header from "@/components/store/Header";
import Footer from "@/components/store/Footer";
import PolicyViewerModal from "@/components/store/PolicyViewerModal";
import { Category } from "@/types/store";
import { BlogPost, Language } from "../blog/page";
import { t, getCategoryPrefix, getCategoryTitle, getCategoryUrl } from "@/app/i18n";

interface SitemapClientProps {
  categoryPrefix: string;
  categories: Category[];
  blogPosts: BlogPost[];
  activeLangs: Language[];
}

export default function SitemapClient({
  categoryPrefix,
  categories,
  blogPosts,
  activeLangs,
}: SitemapClientProps) {
  const router = useRouter();

  // Determine current active language code matching the URL prefix
  const prefixToLangMap = new Map<string, string>();
  activeLangs.forEach((l) => {
    if (!prefixToLangMap.has(l.categoryPrefix) || l.code === "tr" || l.code === "en") {
      prefixToLangMap.set(l.categoryPrefix, l.code);
    }
  });
  
  const initialLang = prefixToLangMap.get(categoryPrefix) || "en";

  // --- UI States ---
  const [lang, setLang] = useState<string>(initialLang);
  const [isLangOpen, setIsLangOpen] = useState<boolean>(false);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState<boolean>(false);
  const [policyModalType, setPolicyModalType] = useState<"cancellation_and_return" | "terms_of_service" | "privacy_policy" | "">("");

  // --- Multi-Currency States ---
  const [displayCurrency, setDisplayCurrency] = useState<string>("TRY");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const preferredCurr = localStorage.getItem("merter_preferred_currency");
      if (preferredCurr) setDisplayCurrency(preferredCurr);
    }
  }, []);

  const handleCurrencyChange = (curr: string) => {
    setDisplayCurrency(curr);
    localStorage.setItem("merter_preferred_currency", curr);
  };

  // Redirect on language switch
  const handleLangChange = (newLang: string) => {
    setLang(newLang);
    const matchLang = activeLangs.find((l) => l.code === newLang);
    if (matchLang) {
      router.push(`/${matchLang.categoryPrefix}/site-haritasi`);
    }
  };

  const handleBackToShop = () => {
    router.push(`/${categoryPrefix}/`);
  };

  const handleOpenPolicy = (type: "cancellation_and_return" | "terms_of_service" | "privacy_policy") => {
    setPolicyModalType(type);
    setIsPolicyModalOpen(true);
  };

  function renderCategoryTree(cats: Category[]) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cats.map((parent) => {
          const parentUrl = getCategoryUrl(categories, parent, lang);
          const parentTitle = getCategoryTitle(parent, lang);
          return (
            <div key={parent.id} className="space-y-4 border border-cultured p-6 bg-white hover:border-accent-gold transition-colors duration-200 rounded-none">
              <a href={parentUrl} className="block text-sm font-extrabold uppercase tracking-[1.5px] text-eerie-black border-b border-cultured pb-2 hover:text-accent-gold transition-colors">
                {parentTitle}
              </a>
              {parent.children && parent.children.length > 0 && (
                <ul className="space-y-3 pl-2">
                  {parent.children.map((sub) => {
                    const subUrl = getCategoryUrl(categories, sub, lang);
                    const subTitle = getCategoryTitle(sub, lang);
                    return (
                      <li key={sub.id} className="space-y-1.5">
                        <a href={subUrl} className="text-xs font-bold text-zinc-800 hover:text-accent-gold transition-colors flex items-center gap-1.5">
                          <ChevronRight size={10} className="text-accent-gold shrink-0" />
                          <span>{subTitle}</span>
                        </a>
                        {sub.children && sub.children.length > 0 && (
                          <ul className="pl-5 space-y-1 border-l border-cultured ml-1.5 mt-1">
                            {sub.children.map((child) => {
                              const childUrl = getCategoryUrl(categories, child, lang);
                              const childTitle = getCategoryTitle(child, lang);
                              return (
                                <li key={child.id}>
                                  <a href={childUrl} className="text-[11px] font-semibold text-zinc-500 hover:text-accent-gold transition-colors">
                                    {childTitle}
                                  </a>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FDFDFD] font-sans antialiased text-onyx">
      {/* Dynamic Storefront Header */}
      <Header
        lang={lang}
        setLang={handleLangChange}
        isLangOpen={isLangOpen}
        setIsLangOpen={setIsLangOpen}
        totalPkgs={0}
        setIsCartOpen={setIsCartOpen}
        setSearchQuery={() => {}}
        setCurrentPage={() => {}}
        setActiveCategoryId={() => {}}
        categories={categories}
        activeCategoryId=""
        displayCurrency={displayCurrency}
        onCurrencyChange={handleCurrencyChange}
      />

      {/* Main Content */}
      <main className="flex-grow w-full max-w-[1720px] mx-auto px-4 md:px-12 py-10 md:py-16 select-none animate-in fade-in duration-300">
        
        {/* Breadcrumb and back button */}
        <div className="flex items-center gap-2 mb-8">
          <button
            onClick={handleBackToShop}
            className="flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-[1.5px] text-zinc-400 hover:text-accent-gold transition-colors border-none bg-transparent cursor-pointer"
          >
            <ArrowLeft size={12} />
            {t("details_back_to_catalog", lang)}
          </button>
        </div>

        {/* Page Title */}
        <div className="border-b border-cultured pb-6 mb-10 flex flex-col gap-2">
          <h1 className="font-sans font-extrabold text-2xl md:text-3xl text-eerie-black leading-tight tracking-tight uppercase">
            {lang === "tr" ? "Site Haritası" : "Sitemap"}
          </h1>
          <p className="text-xs text-sonic-silver font-semibold leading-relaxed max-w-2xl">
            {lang === "tr" 
              ? "Merter Vitrini B2B toptan hazır giyim platformumuzun tüm kategori, blog ve kurumsal sayfalarının güncel listesi."
              : "Complete hierarchy and list of categories, sourcing blogs, and corporate content of our B2B wholesale clothing platform."}
          </p>
        </div>

        {/* Section 1: Dynamic Categories Tree */}
        <div className="space-y-6">
          <h2 className="text-xs font-extrabold uppercase tracking-[2px] text-zinc-400 border-b border-cultured pb-3">
            {lang === "tr" ? "Ürün Kategorileri" : "Product Categories"}
          </h2>
          {renderCategoryTree(categories)}
        </div>

        {/* Section 2: General, Blog, and Corporate Links Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
          
          {/* General Links Card */}
          <div className="border border-cultured p-6 bg-white space-y-4 hover:border-accent-gold transition-colors rounded-none">
            <h3 className="text-xs font-extrabold uppercase tracking-[2px] text-eerie-black border-b border-cultured pb-2 flex items-center gap-2">
              <Compass size={14} className="text-accent-gold shrink-0" />
              <span>{lang === "tr" ? "Genel Sayfalar" : "General Pages"}</span>
            </h3>
            <ul className="space-y-2.5 text-xs font-bold text-zinc-700">
              <li>
                <a href={`/${categoryPrefix}/`} className="hover:text-accent-gold transition-colors">
                  {t("home", lang)}
                </a>
              </li>
              <li>
                <a href={`/${categoryPrefix}/tum-urunler/`} className="hover:text-accent-gold transition-colors">
                  {t("all_products", lang)}
                </a>
              </li>
              <li>
                <a href={`/${categoryPrefix}/blog/`} className="hover:text-accent-gold transition-colors">
                  {t("blog", lang)}
                </a>
              </li>
            </ul>
          </div>

          {/* Sourcing Blogs Card */}
          <div className="border border-cultured p-6 bg-white space-y-4 hover:border-accent-gold transition-colors rounded-none">
            <h3 className="text-xs font-extrabold uppercase tracking-[2px] text-eerie-black border-b border-cultured pb-2 flex items-center gap-2">
              <BookOpen size={14} className="text-accent-gold shrink-0" />
              <span>{lang === "tr" ? "Tedarik Rehberleri & Blog" : "Sourcing Guides & Blog"}</span>
            </h3>
            <ul className="space-y-2.5 text-xs font-semibold text-zinc-600">
              {blogPosts.length === 0 ? (
                <li className="text-zinc-400 italic">No posts found</li>
              ) : (
                blogPosts.map((post) => {
                  const translation = post.translations[lang] || post.translations["tr"] || post.translations["en"] || Object.values(post.translations)[0];
                  return (
                    <li key={post.id}>
                      <a href={`/${categoryPrefix}/blog/${post.slug}/`} className="hover:text-accent-gold transition-colors font-bold text-zinc-700 line-clamp-2">
                        {translation?.title}
                      </a>
                    </li>
                  );
                })
              )}
            </ul>
          </div>

          {/* Corporate / Agreements Card */}
          <div className="border border-cultured p-6 bg-white space-y-4 hover:border-accent-gold transition-colors rounded-none">
            <h3 className="text-xs font-extrabold uppercase tracking-[2px] text-eerie-black border-b border-cultured pb-2 flex items-center gap-2">
              <Info size={14} className="text-accent-gold shrink-0" />
              <span>{lang === "tr" ? "Kurumsal & Bilgi" : "Corporate & Agreements"}</span>
            </h3>
            <ul className="space-y-2.5 text-xs font-bold text-zinc-700">
              <li>
                <a href={`/${categoryPrefix}/pages/hakkimizda/`} className="hover:text-accent-gold transition-colors">
                  {t("about_us", lang)}
                </a>
              </li>
              <li>
                <button 
                  onClick={() => handleOpenPolicy("cancellation_and_return")}
                  className="bg-transparent border-none p-0 font-bold text-xs text-zinc-700 hover:text-accent-gold transition-colors cursor-pointer text-left uppercase tracking-[0.5px]"
                >
                  {t("delivery_returns", lang)}
                </button>
              </li>
              <li>
                <button 
                  onClick={() => handleOpenPolicy("privacy_policy")}
                  className="bg-transparent border-none p-0 font-bold text-xs text-zinc-700 hover:text-accent-gold transition-colors cursor-pointer text-left uppercase tracking-[0.5px]"
                >
                  {t("privacy", lang)}
                </button>
              </li>
              <li>
                <button 
                  onClick={() => handleOpenPolicy("terms_of_service")}
                  className="bg-transparent border-none p-0 font-bold text-xs text-zinc-700 hover:text-accent-gold transition-colors cursor-pointer text-left uppercase tracking-[0.5px]"
                >
                  {t("terms", lang)}
                </button>
              </li>
            </ul>
          </div>
        </div>

      </main>

      {/* Dynamic Storefront Footer */}
      <Footer
        lang={lang}
        onOpenPolicy={handleOpenPolicy}
      />

      {/* Policy modal overlay viewer */}
      <PolicyViewerModal
        isOpen={isPolicyModalOpen}
        onClose={() => {
          setIsPolicyModalOpen(false);
          setPolicyModalType("");
        }}
        policyType={policyModalType}
        lang={lang}
      />
    </div>
  );
}
