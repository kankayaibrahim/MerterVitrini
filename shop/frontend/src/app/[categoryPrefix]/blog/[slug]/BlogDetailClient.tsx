"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Calendar, FileText, Globe, HelpCircle, BookOpen } from "lucide-react";
import Header from "@/components/store/Header";
import Footer from "@/components/store/Footer";
import PolicyViewerModal from "@/components/store/PolicyViewerModal";
import { Category } from "@/types/store";
import { BlogPost, Language } from "../page";
import { t } from "@/app/i18n";

interface BlogDetailClientProps {
  categoryPrefix: string;
  slug: string;
  post: BlogPost | null;
  categories: Category[];
  activeLangs: Language[];
}

export default function BlogDetailClient({
  categoryPrefix,
  slug,
  post,
  categories,
  activeLangs
}: BlogDetailClientProps) {
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
      router.push(`/${matchLang.categoryPrefix}/blog/${slug}`);
    }
  };

  // Extract translation
  const translation = post?.translations[lang] || post?.translations["tr"] || post?.translations["en"] || (post ? Object.values(post.translations)[0] : null);

  // Return to blog list
  const handleBackToBlog = () => {
    router.push(`/${categoryPrefix}/blog`);
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

  // Safe inline HTML parsing helper
  function parseInline(text: string): React.ReactNode[] {
    let parts: React.ReactNode[] = [text];

    // Process bold: **text**
    parts = parts.flatMap((part) => {
      if (typeof part !== "string") return part;
      const split = part.split(/\*\*([^*]+)\*\*/g);
      return split.map((sub, i) => (i % 2 === 1 ? <strong key={i} className="font-extrabold text-eerie-black">{sub}</strong> : sub));
    });

    // Process italic: *text*
    parts = parts.flatMap((part) => {
      if (typeof part !== "string") return part;
      const split = part.split(/\*([^*]+)\*/g);
      return split.map((sub, i) => (i % 2 === 1 ? <em key={i} className="italic">{sub}</em> : sub));
    });

    // Process links: [label](url)
    parts = parts.flatMap((part) => {
      if (typeof part !== "string") return part;
      const split = part.split(/\[([^\]]+)\]\(([^)]+)\)/g);
      if (split.length <= 1) return part;
      
      const result: React.ReactNode[] = [];
      for (let i = 0; i < split.length; i += 3) {
        result.push(split[i]);
        if (i + 1 < split.length) {
          const label = split[i + 1];
          const url = split[i + 2];
          result.push(
            <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-salmon-pink hover:underline font-extrabold">
              {label}
            </a>
          );
        }
      }
      return result;
    });

    return parts;
  }

  // Self-contained dynamic Markdown renderer
  function renderMarkdown(md: string) {
    if (!md) return null;
    const blocks = md.split(/\n\s*\n/);
    return blocks.map((block, idx) => {
      const trimmed = block.trim();
      if (!trimmed) return null;

      // Heading 3
      if (trimmed.startsWith("### ")) {
        return (
          <h3 key={idx} className="font-sans font-extrabold text-sm md:text-base text-eerie-black mt-6 mb-3 uppercase tracking-wider">
            {parseInline(trimmed.substring(4))}
          </h3>
        );
      }
      // Heading 2
      if (trimmed.startsWith("## ")) {
        return (
          <h2 key={idx} className="font-sans font-extrabold text-lg md:text-xl text-eerie-black mt-8 mb-4 border-b border-cultured pb-2">
            {parseInline(trimmed.substring(3))}
          </h2>
        );
      }
      // Heading 1
      if (trimmed.startsWith("# ")) {
        return (
          <h1 key={idx} className="font-sans font-extrabold text-2xl md:text-3xl text-eerie-black mt-10 mb-6 leading-tight">
            {parseInline(trimmed.substring(2))}
          </h1>
        );
      }

      // Blockquote
      if (trimmed.startsWith("> ")) {
        return (
          <blockquote key={idx} className="border-l-4 border-salmon-pink bg-cultured p-4 rounded-r-[10px] my-6 text-xs md:text-sm font-semibold italic text-sonic-silver leading-relaxed">
            {parseInline(trimmed.substring(2))}
          </blockquote>
        );
      }

      // Unordered lists
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        const lines = trimmed.split("\n");
        return (
          <ul key={idx} className="list-disc pl-5 my-4 space-y-2 text-xs md:text-sm text-zinc-700 font-semibold leading-relaxed">
            {lines.map((line, lIdx) => {
              const content = line.replace(/^[-*]\s+/, "");
              return <li key={lIdx}>{parseInline(content)}</li>;
            })}
          </ul>
        );
      }

      // Standard paragraph
      return (
        <p key={idx} className="text-xs md:text-sm text-zinc-700 font-semibold leading-relaxed mb-4">
          {parseInline(trimmed)}
        </p>
      );
    });
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

      {/* Main Container */}
      <main className="flex-grow w-full max-w-4xl mx-auto px-4 md:px-8 py-10 md:py-16 select-none animate-in fade-in duration-300">
        
        {/* Back navigation */}
        <div className="flex items-center gap-2 mb-8">
          <button
            onClick={handleBackToBlog}
            className="flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-[1.5px] text-zinc-400 hover:text-salmon-pink transition-colors border-none bg-transparent cursor-pointer"
          >
            <ArrowLeft size={12} />
            {lang === "tr" ? "Blog Listesine Dön" : "Back to Blog"}
          </button>
        </div>

        {post && translation ? (
          <div className="bg-white border border-cultured rounded-[20px] shadow-sm overflow-hidden relative p-0">
            {/* Aspect Ratio Controlled Dynamic Cover Image Banner */}
            {post.cover_image && (
              <div className="relative aspect-[21/9] w-full overflow-hidden bg-zinc-100 border-b border-cultured">
                <img
                  src={post.cover_image}
                  alt={translation.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              </div>
            )}

            {/* Article Content Wrapper */}
            <div className="p-6 md:p-12 relative">
              {/* Header Info */}
              <div className="border-b border-cultured pb-6 mb-8 flex flex-col gap-3">
                {/* Meta details */}
                <div className="flex items-center gap-3 text-[10px] font-extrabold uppercase tracking-wider text-sonic-silver">
                  <div className="flex items-center gap-1.5">
                    <Calendar size={12} className="text-salmon-pink" />
                    <span>{formatDate(post.created_at)}</span>
                  </div>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <Globe size={12} className="text-violet-500" />
                    <span className="uppercase">{lang}</span>
                  </div>
                </div>

                {/* Article Title */}
                <h1 className="font-sans font-extrabold text-2xl md:text-3xl text-eerie-black leading-tight tracking-tight">
                  {translation.title}
                </h1>
              </div>

              {/* Summary Area */}
              {translation.summary && (
                <div className="mb-8 p-5 bg-cultured/50 border-l-4 border-violet-500 rounded-r-[10px]">
                  <p className="text-xs md:text-sm text-eerie-black font-bold leading-relaxed italic">
                    {translation.summary}
                  </p>
                </div>
              )}

              {/* Parsed Body Markdown */}
              <article className="max-w-none text-zinc-700 select-text">
                {renderMarkdown(translation.content)}
              </article>
            </div>
          </div>
        ) : (
          /* Blog not found empty state */
          <div className="bg-white border border-cultured rounded-[20px] shadow-sm p-12 text-center flex flex-col items-center gap-4 max-w-lg mx-auto">
            <HelpCircle size={48} className="text-zinc-300 animate-bounce" />
            <h2 className="font-sans font-extrabold text-lg text-eerie-black">
              {lang === "tr" ? "Blog Yazısı Bulunamadı" : "Article Not Found"}
            </h2>
            <p className="text-xs text-sonic-silver font-semibold leading-relaxed">
              {lang === "tr" 
                ? "Görüntülemeye çalıştığınız blog yazısı mevcut değil veya yayından kaldırılmış."
                : "The blog article you are trying to view does not exist or has been removed."}
            </p>
            <button
              onClick={handleBackToBlog}
              className="mt-2 px-6 py-2.5 bg-salmon-pink hover:bg-eerie-black text-white text-[10px] font-extrabold uppercase rounded-[5px] tracking-[1px] cursor-pointer transition-all active:scale-95 border-none"
            >
              {lang === "tr" ? "Blog Listesine Dön" : "Back to Blog"}
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
