"use client";

import React, { useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, Calendar, Globe, HelpCircle } from "lucide-react";
import Header from "@/components/store/Header";
import Footer from "@/components/store/Footer";
import PolicyViewerModal from "@/components/store/PolicyViewerModal";
import { Category } from "@/types/store";
import { BlogPost, Language } from "../page";
import SafeHtml from "@/components/common/SafeHtml";

interface BlogDetailClientProps {
  readonly categoryPrefix: string;
  readonly slug: string;
  readonly post: BlogPost | null;
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

function formatDate(dateStr: string, currentLang: string): string {
  try {
    const options: Intl.DateTimeFormatOptions = { year: "numeric", month: "long", day: "numeric" };
    return new Date(dateStr).toLocaleDateString(currentLang === "tr" ? "tr-TR" : "en-US", options);
  } catch {
    return dateStr.split("T")[0];
  }
}

// Linear string scanner for Markdown links [label](url) with zero regex backtracking (O(N) runtime)
function parseLinks(text: string): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    const openBracket = remaining.indexOf("[");
    if (openBracket === -1) {
      result.push(remaining);
      break;
    }

    const closeBracket = remaining.indexOf("](", openBracket + 1);
    if (closeBracket === -1) {
      result.push(remaining);
      break;
    }

    const closeParen = remaining.indexOf(")", closeBracket + 2);
    if (closeParen === -1) {
      result.push(remaining);
      break;
    }

    const label = remaining.substring(openBracket + 1, closeBracket);
    const url = remaining.substring(closeBracket + 2, closeParen).trim();

    if (!label.includes("\n") && !url.includes(" ") && (url.startsWith("http") || url.startsWith("/"))) {
      if (openBracket > 0) {
        result.push(remaining.substring(0, openBracket));
      }
      result.push(
        <a
          key={`link-${label}-${url}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-salmon-pink hover:underline font-extrabold"
        >
          {label}
        </a>
      );
      remaining = remaining.substring(closeParen + 1);
    } else {
      result.push(remaining.substring(0, openBracket + 1));
      remaining = remaining.substring(openBracket + 1);
    }
  }

  return result;
}

// Safe inline HTML parsing helper
function parseInline(text: string): React.ReactNode[] {
  let parts: React.ReactNode[] = [text];

  // Process bold: **text**
  parts = parts.flatMap((part) => {
    if (typeof part !== "string") return part;
    const split = part.split(/\*\*([^*]+)\*\*/g);
    return split.map((sub, i) => (i % 2 === 1 ? <strong key={`bold-${sub}`} className="font-extrabold text-eerie-black">{sub}</strong> : sub));
  });

  // Process italic: *text*
  parts = parts.flatMap((part) => {
    if (typeof part !== "string") return part;
    const split = part.split(/\*([^*]+)\*/g);
    return split.map((sub, i) => (i % 2 === 1 ? <em key={`em-${sub}`} className="italic">{sub}</em> : sub));
  });

  // Process links: [label](url) via linear scanner
  parts = parts.flatMap((part) => {
    if (typeof part !== "string") return part;
    return parseLinks(part);
  });

  return parts;
}

// Self-contained dynamic Markdown renderer
function renderMarkdown(md: string) {
  if (!md) return null;
  const blocks = md.split(/\n\s*\n/);
  return blocks.map((block) => {
    const trimmed = block.trim();
    if (!trimmed) return null;

    // Heading 3
    if (trimmed.startsWith("### ")) {
      return (
        <h3 key={`h3-${trimmed.slice(4, 35)}`} className="font-sans font-extrabold text-sm md:text-base text-eerie-black mt-6 mb-3 uppercase tracking-wider">
          {parseInline(trimmed.substring(4))}
        </h3>
      );
    }
    // Heading 2
    if (trimmed.startsWith("## ")) {
      return (
        <h2 key={`h2-${trimmed.slice(3, 35)}`} className="font-sans font-extrabold text-lg md:text-xl text-eerie-black mt-8 mb-4 border-b border-cultured pb-2">
          {parseInline(trimmed.substring(3))}
        </h2>
      );
    }
    // Heading 1 in markdown body mapped to h2 to preserve single h1 rule
    if (trimmed.startsWith("# ")) {
      return (
        <h2 key={`h2-top-${trimmed.slice(2, 35)}`} className="font-sans font-extrabold text-xl md:text-2xl text-eerie-black mt-8 mb-4 leading-tight">
          {parseInline(trimmed.substring(2))}
        </h2>
      );
    }

    // Blockquote
    if (trimmed.startsWith("> ")) {
      return (
        <blockquote key={`quote-${trimmed.slice(2, 35)}`} className="border-l-4 border-salmon-pink bg-cultured p-4 rounded-r-[10px] my-6 text-xs md:text-sm font-semibold italic text-sonic-silver leading-relaxed">
          {parseInline(trimmed.substring(2))}
        </blockquote>
      );
    }

    // Unordered lists
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const lines = trimmed.split("\n");
      return (
        <ul key={`list-${trimmed.slice(0, 35)}`} className="list-disc pl-5 my-4 space-y-2 text-xs md:text-sm text-zinc-700 font-semibold leading-relaxed">
          {lines.map((line) => {
            const content = line.replace(/^[-*]\s+/, "");
            return <li key={`item-${content.slice(0, 35)}`}>{parseInline(content)}</li>;
          })}
        </ul>
      );
    }

    // Standard paragraph
    return (
      <p key={`p-${trimmed.slice(0, 35)}`} className="text-xs md:text-sm text-zinc-700 font-semibold leading-relaxed mb-4">
        {parseInline(trimmed)}
      </p>
    );
  });
}

// Render function that handles both HTML and Markdown content
function renderContent(content: string) {
  if (!content) return null;
  const isHtml = content.trim().startsWith("<") && content.trim().toLowerCase().includes("</");
  if (isHtml) {
    return (
      <SafeHtml 
        html={content} 
        className="text-xs md:text-sm text-zinc-700 font-semibold leading-relaxed space-y-4 [&_p]:mb-4 [&_h3]:font-sans [&_h3]:font-extrabold [&_h3]:text-sm [&_h3]:md:text-base [&_h3]:text-eerie-black [&_h3]:mt-6 [&_h3]:mb-3 [&_h3]:uppercase [&_h3]:tracking-wider [&_strong]:font-extrabold [&_strong]:text-eerie-black [&_a]:text-salmon-pink [&_a]:hover:underline [&_a]:font-extrabold"
      />
    );
  }
  return renderMarkdown(content);
}

export default function BlogDetailClient({
  categoryPrefix,
  slug,
  post,
  categories,
  activeLangs
}: Readonly<BlogDetailClientProps>) {
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

  // --- Multi-Currency via External Store (Zero Cascading Renders) ---
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
      router.push(`/${matchLang.categoryPrefix}/blog/${slug}`);
    }
  };

  // Extract translation
  const translation = post?.translations[lang] || post?.translations["tr"] || post?.translations["en"] || (post ? Object.values(post.translations)[0] : null);

  // Return to blog list
  const handleBackToBlog = () => {
    router.push(`/${categoryPrefix}/blog`);
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
                <Image
                  src={post.cover_image}
                  alt={translation.title}
                  fill
                  sizes="(max-width: 1024px) 100vw, 896px"
                  className="object-cover"
                  priority
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
                    <span>{formatDate(post.created_at, lang)}</span>
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
                {renderContent(translation.content)}
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
