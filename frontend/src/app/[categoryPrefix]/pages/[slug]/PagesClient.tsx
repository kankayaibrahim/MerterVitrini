"use client";

import React, { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { FileText, ArrowLeft, Globe, HelpCircle } from "lucide-react";
import Header from "@/components/store/Header";
import Footer from "@/components/store/Footer";
import PolicyViewerModal from "@/components/store/PolicyViewerModal";
import { Category } from "@/types/store";
import { Page, Language } from "./page";
import { t } from "@/app/i18n";
import SafeHtml from "@/components/common/SafeHtml";

interface PagesClientProps {
  readonly categoryPrefix: string;
  readonly slug: string;
  readonly page: Page | null;
  readonly categories: readonly Category[];
  readonly activeLangs: readonly Language[];
}

function subscribeCurrency(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getCurrencySnapshot(): string {
  if (typeof window === "undefined") return "TRY";
  return localStorage.getItem("merter_preferred_currency") || "TRY";
}

function getCurrencyServerSnapshot(): string {
  return "TRY";
}

export default function PagesClient({
  categoryPrefix,
  slug,
  page,
  categories,
  activeLangs
}: Readonly<PagesClientProps>) {
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
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState<boolean>(false);
  const [policyModalType, setPolicyModalType] = useState<"cancellation_and_return" | "terms_of_service" | "privacy_policy" | "">("");

  // --- Multi-Currency States via External Store ---
  const displayCurrency = useSyncExternalStore(
    subscribeCurrency,
    getCurrencySnapshot,
    getCurrencyServerSnapshot
  );

  const handleCurrencyChange = (curr: string) => {
    localStorage.setItem("merter_preferred_currency", curr);
    window.dispatchEvent(new Event("storage"));
  };

  // Redirect on language switch
  const handleLangChange = (newLang: string) => {
    setLang(newLang);
    const matchLang = activeLangs.find((l) => l.code === newLang);
    if (matchLang) {
      router.push(`/${matchLang.categoryPrefix}/pages/${slug}`);
    }
  };

  // Extract translation
  const translation = page?.translations[lang] || page?.translations["tr"] || page?.translations["en"] || (page ? Object.values(page.translations)[0] : null);

  // Return to shop catalog list
  const handleBackToShop = () => {
    router.push(`/${categoryPrefix}/`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FDFDFD] font-sans antialiased text-onyx">
      {/* Dynamic Storefront Header */}
      <Header
        lang={lang}
        setLang={handleLangChange}
        isLangOpen={isLangOpen}
        setIsLangOpen={setIsLangOpen}
        totalPkgs={0}
        setIsCartOpen={() => {}}
        setSearchQuery={() => {}}
        setCurrentPage={() => {}}
        setActiveCategoryId={() => {}}
        categories={categories}
        activeCategoryId=""
        displayCurrency={displayCurrency}
        onCurrencyChange={handleCurrencyChange}
      />

      {/* Main content CMS article layout */}
      <main className="flex-grow w-full max-w-5xl mx-auto px-4 md:px-8 py-10 md:py-16 select-none animate-in fade-in duration-300">
        
        {/* Breadcrumbs and back button */}
        <div className="flex items-center gap-2 mb-8">
          <button
            onClick={handleBackToShop}
            className="flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-[1px] text-zinc-400 hover:text-salmon-pink transition-colors border-none bg-transparent cursor-pointer"
          >
            <ArrowLeft size={12} />
            {t("details_back_to_catalog", lang)}
          </button>
        </div>

        {page && translation ? (
          <div className="bg-white border border-cultured rounded-[20px] shadow-sm overflow-hidden p-6 md:p-12 relative">
            
            {/* Background design accents */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-salmon-pink via-violet-500 to-indigo-500" />
            
            {/* Article Header */}
            <div className="border-b border-cultured pb-6 mb-8 flex flex-col gap-2">
              <h1 className="font-sans font-extrabold text-2xl md:text-3xl text-eerie-black leading-tight tracking-tight">
                {translation.title}
              </h1>
              
              <div className="flex items-center gap-2 text-xs font-semibold text-sonic-silver">
                <FileText size={14} className="text-salmon-pink" />
                <span>{t("static_info_page", lang)}</span>
                <span>•</span>
                <Globe size={14} className="text-violet-500" />
                <span className="uppercase">{lang}</span>
              </div>
            </div>

            {/* Content body with responsive typography */}
            <article className="prose prose-zinc max-w-none text-zinc-700 text-xs md:text-sm leading-relaxed select-text">
              {translation.content.trim().startsWith("<") && translation.content.trim().toLowerCase().includes("</") ? (
                <SafeHtml
                  html={translation.content}
                  className="space-y-4 [&_p]:mb-4 [&_h2]:font-sans [&_h2]:font-extrabold [&_h2]:text-lg [&_h2]:md:text-xl [&_h2]:text-eerie-black [&_h2]:mt-8 [&_h2]:mb-4 [&_h2]:border-b [&_h2]:border-cultured [&_h2]:pb-2 [&_strong]:font-extrabold [&_strong]:text-eerie-black [&_a]:text-salmon-pink [&_a]:hover:underline [&_a]:font-extrabold"
                />
              ) : (
                <div className="whitespace-pre-wrap">{translation.content}</div>
              )}
            </article>
          </div>
        ) : (
          /* Page not found 404 block */
          <div className="bg-white border border-cultured rounded-[20px] shadow-sm p-12 text-center flex flex-col items-center gap-4 max-w-lg mx-auto">
            <HelpCircle size={48} className="text-zinc-300 animate-bounce" />
            <h2 className="font-sans font-extrabold text-lg text-eerie-black">
              {t("page_not_found", lang)}
            </h2>
            <p className="text-xs text-sonic-silver font-semibold leading-relaxed">
              {t("page_not_found_desc", lang)}
            </p>
            <button
              onClick={handleBackToShop}
              className="mt-2 px-6 py-2.5 bg-salmon-pink hover:bg-eerie-black text-white text-[10px] font-extrabold uppercase rounded-[5px] tracking-[1px] cursor-pointer transition-all active:scale-95"
            >
              {t("back_to_shop", lang)}
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
