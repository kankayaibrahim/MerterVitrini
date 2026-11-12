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
import { normalizeSeoLang } from "@/utils/seoHelpers";

interface PagesClientProps {
  readonly categoryPrefix: string;
  readonly slug: string;
  readonly page: Page | null;
  readonly categories: readonly Category[];
  readonly activeLangs: readonly Language[];
}

function subscribeStore(callback: () => void) {
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

function getCartPkgsSnapshot(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem("merter_b2b_cart");
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as Array<{ quantity?: number }>;
    if (!Array.isArray(parsed)) return 0;
    return parsed.reduce((acc, item) => acc + (Number(item.quantity) || 0), 0);
  } catch {
    return 0;
  }
}

function getCartPkgsServerSnapshot(): number {
  return 0;
}

export default function PagesClient({
  categoryPrefix,
  slug,
  page,
  categories,
  activeLangs,
}: Readonly<PagesClientProps>) {
  const router = useRouter();

  const matchedLang = activeLangs.find((l) => l.categoryPrefix === categoryPrefix);
  const initialLang = normalizeSeoLang(matchedLang?.code || categoryPrefix, "en");

  const [lang, setLang] = useState<string>(initialLang);
  const [isLangOpen, setIsLangOpen] = useState<boolean>(false);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState<boolean>(false);
  const [policyModalType, setPolicyModalType] = useState<
    "cancellation_and_return" | "terms_of_service" | "privacy_policy" | ""
  >("");

  const safeLang = normalizeSeoLang(lang, "en");

  const displayCurrency = useSyncExternalStore(
    subscribeStore,
    getCurrencySnapshot,
    getCurrencyServerSnapshot
  );
  const totalPkgs = useSyncExternalStore(
    subscribeStore,
    getCartPkgsSnapshot,
    getCartPkgsServerSnapshot
  );

  const handleCurrencyChange = (curr: string) => {
    localStorage.setItem("merter_preferred_currency", curr);
    window.dispatchEvent(new Event("storage"));
  };

  const handleLangChange = (newLang: string) => {
    setLang(newLang);
    const matchLang = activeLangs.find((l) => l.code === newLang);
    const targetPrefix = matchLang?.categoryPrefix || normalizeSeoLang(newLang, "en");
    router.push(`/${targetPrefix}/pages/${slug}`);
  };

  const translation =
    page?.translations[safeLang] ||
    page?.translations["en"] ||
    page?.translations["tr"] ||
    (page ? Object.values(page.translations)[0] : null);

  const handleBackToShop = () => {
    router.push(`/${categoryPrefix}`);
  };

  return (
    <div
      dir={safeLang === "ar" ? "rtl" : "ltr"}
      className="min-h-screen flex flex-col bg-[#FDFDFD] font-sans antialiased text-onyx"
    >
      <Header
        lang={safeLang}
        setLang={handleLangChange}
        isLangOpen={isLangOpen}
        setIsLangOpen={setIsLangOpen}
        totalPkgs={totalPkgs}
        setIsCartOpen={(open) => {
          if (open) router.push(`/${categoryPrefix}/cart`);
        }}
        setSearchQuery={() => {}}
        setCurrentPage={() => {}}
        setActiveCategoryId={() => {}}
        categories={categories}
        activeCategoryId=""
        displayCurrency={displayCurrency}
        onCurrencyChange={handleCurrencyChange}
      />

      <main className="flex-grow w-full max-w-5xl mx-auto px-4 md:px-8 py-10 md:py-16 select-none animate-in fade-in duration-300">
        <div className="flex items-center gap-2 mb-8">
          <button
            onClick={handleBackToShop}
            className="flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-[1px] text-zinc-400 hover:text-salmon-pink transition-colors border-none bg-transparent cursor-pointer"
          >
            <ArrowLeft size={12} />
            {t("details_back_to_catalog", safeLang)}
          </button>
        </div>

        {page && translation ? (
          <div className="bg-white border border-cultured rounded-[20px] shadow-sm overflow-hidden p-6 md:p-12 relative">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-salmon-pink via-violet-500 to-indigo-500" />

            <div className="border-b border-cultured pb-6 mb-8 flex flex-col gap-2">
              <h1 className="font-sans font-extrabold text-2xl md:text-3xl text-eerie-black leading-tight tracking-tight">
                {translation.title}
              </h1>

              <div className="flex items-center gap-2 text-xs font-semibold text-sonic-silver">
                <FileText size={14} className="text-salmon-pink" />
                <span>{t("static_info_page", safeLang)}</span>
                <span>•</span>
                <Globe size={14} className="text-violet-500" />
                <span className="uppercase">{safeLang}</span>
              </div>
            </div>

            <article className="prose prose-zinc max-w-none text-zinc-700 text-xs md:text-sm leading-relaxed select-text">
              {translation.content.trim().startsWith("<") &&
              translation.content.trim().toLowerCase().includes("</") ? (
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
          <div className="bg-white border border-cultured rounded-[20px] shadow-sm p-12 text-center flex flex-col items-center gap-4 max-w-lg mx-auto">
            <HelpCircle size={48} className="text-zinc-300 animate-bounce" />
            <h2 className="font-sans font-extrabold text-lg text-eerie-black">
              {t("page_not_found", safeLang)}
            </h2>
            <p className="text-xs text-sonic-silver font-semibold leading-relaxed">
              {t("page_not_found_desc", safeLang)}
            </p>
            <button
              onClick={handleBackToShop}
              className="mt-2 px-6 py-2.5 bg-salmon-pink hover:bg-eerie-black text-white text-[10px] font-extrabold uppercase rounded-[5px] tracking-[1px] cursor-pointer transition-all active:scale-95"
            >
              {t("back_to_shop", safeLang)}
            </button>
          </div>
        )}
      </main>

      <Footer
        lang={safeLang}
        onOpenPolicy={(type) => {
          setPolicyModalType(type);
          setIsPolicyModalOpen(true);
        }}
      />

      <PolicyViewerModal
        isOpen={isPolicyModalOpen}
        onClose={() => {
          setIsPolicyModalOpen(false);
          setPolicyModalType("");
        }}
        policyType={policyModalType}
        lang={safeLang}
      />
    </div>
  );
}
