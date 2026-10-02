"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Search, ArrowRight, BookOpen, FileText } from "lucide-react";
import Header from "@/components/store/Header";
import Footer from "@/components/store/Footer";
import PolicyViewerModal from "@/components/store/PolicyViewerModal";
import { Category } from "@/types/store";
import { BlogPost, Language } from "./page";
import { t } from "@/app/i18n";

interface BlogListClientProps {
  categoryPrefix: string;
  blogPosts: BlogPost[];
  categories: Category[];
  activeLangs: Language[];
}

export default function BlogListClient({
  categoryPrefix,
  blogPosts,
  categories,
  activeLangs
}: BlogListClientProps) {
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
  const [searchQuery, setSearchQuery] = useState<string>("");

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
      router.push(`/${matchLang.categoryPrefix}/blog`);
    }
  };

  // Format date helper
  const formatDate = (dateStr: string) => {
    try {
      const options: Intl.DateTimeFormatOptions = { year: "numeric", month: "long", day: "numeric" };
      return new Date(dateStr).toLocaleDateString(lang === "tr" ? "tr-TR" : "en-US", options);
    } catch {
      return dateStr.split("T")[0];
    }
  };

  // Filter posts based on current language translation availability AND search query
  const filteredPosts = blogPosts.filter((post) => {
    // Get translation matching active storefront language, fallback to TR, EN or first available translation
    const trans = post.translations[lang] || post.translations["tr"] || post.translations["en"] || Object.values(post.translations)[0];
    if (!trans) return false;

    // Search query matching title or summary
    const matchesSearch = searchQuery
      ? trans.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (trans.summary && trans.summary.toLowerCase().includes(searchQuery.toLowerCase()))
      : true;

    return matchesSearch;
  });

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

      {/* Main Container */}
      <main className="flex-grow w-full max-w-[1440px] mx-auto px-4 md:px-8 py-10 md:py-16 select-none animate-in fade-in duration-300">
        
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 border-b border-cultured pb-8">
          <div>
            <h1 className="font-sans font-extrabold text-3xl md:text-4xl text-eerie-black leading-tight tracking-tight mb-2">
              {t("blog", lang)}
            </h1>
            <p className="text-sm text-sonic-silver font-semibold max-w-2xl leading-relaxed">
              {lang === "tr" 
                ? "Merter hazır giyim imalat sektörü, B2B tedarik süreçleri ve e-ihracat hakkında en son haberler, rehberler ve trend analizleri."
                : "Get the latest market updates, wholesale apparel sourcing guides, fashion trend reports, and B2B global trade tips from Istanbul suppliers."}
            </p>
          </div>

          {/* Quick Search */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder={lang === "tr" ? "Blog yazılarında ara..." : "Search articles..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-cultured rounded-[10px] text-xs font-bold text-eerie-black placeholder-zinc-400 focus:outline-none focus:border-salmon-pink transition-all shadow-sm"
            />
          </div>
        </div>

        {/* Blog Posts Grid */}
        {filteredPosts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredPosts.map((post) => {
              const trans = post.translations[lang] || post.translations["tr"] || post.translations["en"] || Object.values(post.translations)[0];
              const title = trans?.title || "Untitled";
              const summary = trans?.summary || "";
              const coverImg = post.cover_image || "/placeholder.png";

              return (
                <article
                  key={post.id}
                  onClick={() => router.push(`/${categoryPrefix}/blog/${post.slug}`)}
                  className="bg-white border border-cultured rounded-[20px] shadow-sm overflow-hidden flex flex-col group cursor-pointer hover:shadow-md hover:border-zinc-300 transition-all duration-300"
                >
                  {/* Aspect Ratio Controlled Cover Image Container */}
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-zinc-100">
                    <img
                      src={coverImg}
                      alt={title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                      onError={(e) => {
                        e.currentTarget.src = "/placeholder.png";
                      }}
                    />
                    {/* Dark gradient shadow */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-60" />
                  </div>

                  {/* Card Body */}
                  <div className="p-6 flex-grow flex flex-col">
                    {/* Meta Fields */}
                    <div className="flex items-center gap-3 text-[10px] font-extrabold uppercase tracking-wider text-sonic-silver mb-3">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={12} className="text-salmon-pink" />
                        <span>{formatDate(post.created_at)}</span>
                      </div>
                      <span>•</span>
                      <div className="px-2 py-0.5 bg-cultured text-eerie-black rounded-[5px] text-[9px] font-bold">
                        {lang === "tr" ? "Rehber" : "Guide"}
                      </div>
                    </div>

                    {/* Title */}
                    <h2 className="font-sans font-extrabold text-base md:text-lg text-eerie-black leading-snug tracking-tight mb-3 line-clamp-2 group-hover:text-salmon-pink transition-colors">
                      {title}
                    </h2>

                    {/* Summary */}
                    {summary && (
                      <p className="text-xs text-sonic-silver font-semibold leading-relaxed mb-6 line-clamp-3">
                        {summary}
                      </p>
                    )}

                    {/* Bottom Action Footer */}
                    <div className="mt-auto pt-4 border-t border-cultured flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-salmon-pink flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                        {lang === "tr" ? "Devamını Oku" : "Read More"}
                        <ArrowRight size={12} />
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          /* Empty state */
          <div className="bg-white border border-cultured rounded-[20px] shadow-sm p-12 text-center flex flex-col items-center gap-4 max-w-lg mx-auto my-12">
            <BookOpen size={48} className="text-zinc-300 animate-pulse" />
            <h2 className="font-sans font-extrabold text-lg text-eerie-black">
              {lang === "tr" ? "Blog Yazısı Bulunamadı" : "No Articles Found"}
            </h2>
            <p className="text-xs text-sonic-silver font-semibold leading-relaxed">
              {lang === "tr" 
                ? "Aradığınız kriterlere uygun aktif blog yazısı bulunmamaktadır."
                : "There are no active articles matching your search criteria at the moment."}
            </p>
            <button
              onClick={() => setSearchQuery("")}
              className="mt-2 px-6 py-2.5 bg-salmon-pink hover:bg-eerie-black text-white text-[10px] font-extrabold uppercase rounded-[5px] tracking-[1px] cursor-pointer transition-all active:scale-95 border-none"
            >
              {lang === "tr" ? "Filtreyi Temizle" : "Clear Filters"}
            </button>
          </div>
        )}
      </main>

      {/* Dynamic Storefront Footer */}
      <Footer
        lang={lang}
        onOpenPolicy={(type) => {
          setPolicyModalType(type);
          setIsPolicyModalOpen(true);
        }}
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
