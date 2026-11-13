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
import {
  INTL_LOCALE_BY_LANG,
  SupportedSeoLang,
  normalizeSeoLang,
} from "@/utils/seoHelpers";

interface BlogDetailCopy {
  readonly backToBlog: string;
  readonly notFoundTitle: string;
  readonly notFoundDesc: string;
}

const BLOG_DETAIL_COPY: Record<SupportedSeoLang, BlogDetailCopy> = {
  tr: {
    backToBlog: "Blog Listesine Dön",
    notFoundTitle: "Blog Yazısı Bulunamadı",
    notFoundDesc: "Görüntülemeye çalıştığınız blog yazısı mevcut değil veya yayından kaldırılmış.",
  },
  en: {
    backToBlog: "Back to Blog",
    notFoundTitle: "Article Not Found",
    notFoundDesc: "The blog article you are trying to view does not exist or has been removed.",
  },
  ru: {
    backToBlog: "Назад в блог",
    notFoundTitle: "Статья не найдена",
    notFoundDesc: "Запрашиваемая публикация не существует или была снята с публикации.",
  },
  ar: {
    backToBlog: "العودة إلى المدونة",
    notFoundTitle: "المقال غير موجود",
    notFoundDesc: "المقال الذي تحاول عرضه غير موجود أو تمت إزالته.",
  },
  de: {
    backToBlog: "Zurück zum Blog",
    notFoundTitle: "Artikel nicht gefunden",
    notFoundDesc: "Der gesuchte Blogbeitrag existiert nicht oder wurde entfernt.",
  },
  fr: {
    backToBlog: "Retour au blog",
    notFoundTitle: "Article introuvable",
    notFoundDesc: "L’article que vous souhaitez consulter n’existe pas ou a été retiré.",
  },
  pl: {
    backToBlog: "Powrót do bloga",
    notFoundTitle: "Nie znaleziono artykułu",
    notFoundDesc: "Artykuł, który próbujesz wyświetlić, nie istnieje lub został usunięty.",
  },
  bg: {
    backToBlog: "Обратно към блога",
    notFoundTitle: "Статията не е намерена",
    notFoundDesc: "Статията, която се опитвате да отворите, не съществува или е премахната.",
  },
};

interface BlogDetailClientProps {
  readonly categoryPrefix: string;
  readonly slug: string;
  readonly post: BlogPost | null;
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

function formatDate(dateStr: string, currentLang: SupportedSeoLang): string {
  try {
    const options: Intl.DateTimeFormatOptions = { year: "numeric", month: "long", day: "numeric" };
    return new Date(dateStr).toLocaleDateString(INTL_LOCALE_BY_LANG[currentLang], options);
  } catch {
    return dateStr.split("T")[0];
  }
}

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

function parseInline(text: string): React.ReactNode[] {
  let parts: React.ReactNode[] = [text];

  parts = parts.flatMap((part) => {
    if (typeof part !== "string") return part;
    const split = part.split(/\*\*([^*]+)\*\*/g);
    return split.map((sub, i) =>
      i % 2 === 1 ? (
        <strong key={`bold-${sub}`} className="font-extrabold text-eerie-black">
          {sub}
        </strong>
      ) : (
        sub
      )
    );
  });

  parts = parts.flatMap((part) => {
    if (typeof part !== "string") return part;
    const split = part.split(/\*([^*]+)\*/g);
    return split.map((sub, i) =>
      i % 2 === 1 ? (
        <em key={`em-${sub}`} className="italic">
          {sub}
        </em>
      ) : (
        sub
      )
    );
  });

  parts = parts.flatMap((part) => {
    if (typeof part !== "string") return part;
    return parseLinks(part);
  });

  return parts;
}

function renderMarkdownBlock(trimmed: string) {
  if (!trimmed) return null;

  if (trimmed.startsWith("### ")) {
    return (
      <h3
        key={`h3-${trimmed.slice(4, 35)}`}
        className="font-sans font-extrabold text-sm md:text-base text-eerie-black mt-6 mb-3 uppercase tracking-wider"
      >
        {parseInline(trimmed.substring(4))}
      </h3>
    );
  }
  if (trimmed.startsWith("## ")) {
    return (
      <h2
        key={`h2-${trimmed.slice(3, 35)}`}
        className="font-sans font-extrabold text-lg md:text-xl text-eerie-black mt-8 mb-4 border-b border-cultured pb-2"
      >
        {parseInline(trimmed.substring(3))}
      </h2>
    );
  }
  if (trimmed.startsWith("# ")) {
    return (
      <h2
        key={`h2-top-${trimmed.slice(2, 35)}`}
        className="font-sans font-extrabold text-xl md:text-2xl text-eerie-black mt-8 mb-4 leading-tight"
      >
        {parseInline(trimmed.substring(2))}
      </h2>
    );
  }
  if (trimmed.startsWith("> ")) {
    return (
      <blockquote
        key={`quote-${trimmed.slice(2, 35)}`}
        className="border-l-4 border-salmon-pink bg-cultured p-4 rounded-r-[10px] my-6 text-xs md:text-sm font-semibold italic text-sonic-silver leading-relaxed"
      >
        {parseInline(trimmed.substring(2))}
      </blockquote>
    );
  }
  if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
    const lines = trimmed.split("\n");
    return (
      <ul
        key={`list-${trimmed.slice(0, 35)}`}
        className="list-disc pl-5 my-4 space-y-2 text-xs md:text-sm text-zinc-700 font-semibold leading-relaxed"
      >
        {lines.map((line) => {
          const content = line.replace(/^[-*]\s+/, "");
          return <li key={`item-${content.slice(0, 35)}`}>{parseInline(content)}</li>;
        })}
      </ul>
    );
  }
  return (
    <p
      key={`p-${trimmed.slice(0, 35)}`}
      className="text-xs md:text-sm text-zinc-700 font-semibold leading-relaxed mb-4"
    >
      {parseInline(trimmed)}
    </p>
  );
}

function renderContent(content?: string | null) {
  if (!content) return null;
  const trimmed = content.trim();
  const isHtml = trimmed.startsWith("<") && trimmed.toLowerCase().includes("</");
  if (isHtml) {
    return (
      <SafeHtml
        html={content}
        className="text-xs md:text-sm text-zinc-700 font-semibold leading-relaxed space-y-4 [&_p]:mb-4 [&_h3]:font-sans [&_h3]:font-extrabold [&_h3]:text-sm [&_h3]:md:text-base [&_h3]:text-eerie-black [&_h3]:mt-6 [&_h3]:mb-3 [&_h3]:uppercase [&_h3]:tracking-wider [&_strong]:font-extrabold [&_strong]:text-eerie-black [&_a]:text-salmon-pink [&_a]:hover:underline [&_a]:font-extrabold"
      />
    );
  }
  return content.split(/\n\s*\n/).map((block) => renderMarkdownBlock(block.trim()));
}

export default function BlogDetailClient({
  categoryPrefix,
  slug,
  post,
  categories,
  activeLangs,
}: Readonly<BlogDetailClientProps>) {
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
  const copy = BLOG_DETAIL_COPY[safeLang];

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
    const targetSlug = post?.translations[newLang]?.slug || slug;
    router.push(`/${targetPrefix}/blog/${targetSlug}`);
  };

  const translation =
    post?.translations[safeLang] ||
    post?.translations["en"] ||
    post?.translations["tr"] ||
    (post ? Object.values(post.translations)[0] : null);

  const handleBackToBlog = () => {
    router.push(`/${categoryPrefix}/blog`);
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

      <main className="flex-grow w-full max-w-4xl mx-auto px-4 md:px-8 py-10 md:py-16 select-none animate-in fade-in duration-300">
        <div className="flex items-center gap-2 mb-8">
          <button
            onClick={handleBackToBlog}
            className="flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-[1.5px] text-zinc-400 hover:text-salmon-pink transition-colors border-none bg-transparent cursor-pointer"
          >
            <ArrowLeft size={12} />
            {copy.backToBlog}
          </button>
        </div>

        {post && translation ? (
          <div className="bg-white border border-cultured rounded-[20px] shadow-sm overflow-hidden relative p-0">
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

            <div className="p-6 md:p-12 relative">
              <div className="border-b border-cultured pb-6 mb-8 flex flex-col gap-3">
                <div className="flex items-center gap-3 text-[10px] font-extrabold uppercase tracking-wider text-sonic-silver">
                  <div className="flex items-center gap-1.5">
                    <Calendar size={12} className="text-salmon-pink" />
                    <span>{formatDate(post.created_at, safeLang)}</span>
                  </div>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <Globe size={12} className="text-violet-500" />
                    <span className="uppercase">{safeLang}</span>
                  </div>
                </div>

                <h1 className="font-sans font-extrabold text-2xl md:text-3xl text-eerie-black leading-tight tracking-tight">
                  {translation.title}
                </h1>
              </div>

              {translation.summary && (
                <div className="mb-8 p-5 bg-cultured/50 border-l-4 border-violet-500 rounded-r-[10px]">
                  <p className="text-xs md:text-sm text-eerie-black font-bold leading-relaxed italic">
                    {translation.summary}
                  </p>
                </div>
              )}

              <article className="max-w-none text-zinc-700 select-text">
                {renderContent(translation.content)}
              </article>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-cultured rounded-[20px] shadow-sm p-12 text-center flex flex-col items-center gap-4 max-w-lg mx-auto">
            <HelpCircle size={48} className="text-zinc-300 animate-bounce" />
            <h2 className="font-sans font-extrabold text-lg text-eerie-black">
              {copy.notFoundTitle}
            </h2>
            <p className="text-xs text-sonic-silver font-semibold leading-relaxed">
              {copy.notFoundDesc}
            </p>
            <button
              onClick={handleBackToBlog}
              className="mt-2 px-6 py-2.5 bg-salmon-pink hover:bg-eerie-black text-white text-[10px] font-extrabold uppercase rounded-[5px] tracking-[1px] cursor-pointer transition-all active:scale-95 border-none"
            >
              {copy.backToBlog}
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
