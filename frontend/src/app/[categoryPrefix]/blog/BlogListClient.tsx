"use client";

import React, { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Calendar, Search, ArrowRight, BookOpen } from "lucide-react";
import Header from "@/components/store/Header";
import Footer from "@/components/store/Footer";
import PolicyViewerModal from "@/components/store/PolicyViewerModal";
import { Category } from "@/types/store";
import { BlogPost, Language } from "./page";
import { t } from "@/app/i18n";
import {
  INTL_LOCALE_BY_LANG,
  SupportedSeoLang,
  normalizeSeoLang,
} from "@/utils/seoHelpers";

interface BlogListCopy {
  readonly subtitle: string;
  readonly searchPlaceholder: string;
  readonly guideBadge: string;
  readonly readMore: string;
  readonly emptyTitle: string;
  readonly emptyDesc: string;
  readonly clearFilters: string;
}

const BLOG_LIST_COPY: Record<SupportedSeoLang, BlogListCopy> = {
  tr: {
    subtitle:
      "Merter hazır giyim imalat sektörü, B2B tedarik süreçleri ve uluslararası ihracat hakkında en güncel rehberler ve pazar analizleri.",
    searchPlaceholder: "Blog yazılarında ara...",
    guideBadge: "Rehber",
    readMore: "Devamını Oku",
    emptyTitle: "Blog Yazısı Bulunamadı",
    emptyDesc: "Aradığınız kriterlere uygun aktif blog yazısı bulunmamaktadır.",
    clearFilters: "Filtreyi Temizle",
  },
  en: {
    subtitle:
      "Latest B2B market updates, Merter Istanbul wholesale apparel sourcing guides, trend reports, and global textile export tips.",
    searchPlaceholder: "Search articles...",
    guideBadge: "Guide",
    readMore: "Read More",
    emptyTitle: "No Articles Found",
    emptyDesc: "There are no active articles matching your search criteria at the moment.",
    clearFilters: "Clear Filters",
  },
  ru: {
    subtitle:
      "Актуальные обзоры оптового рынка одежды Мертер (Стамбул), руководства по закупкам сериями напрямую с фабрик и советы по карго-экспорту.",
    searchPlaceholder: "Поиск статей...",
    guideBadge: "Гид",
    readMore: "Читать далее",
    emptyTitle: "Статьи не найдены",
    emptyDesc: "По вашему запросу сейчас нет активных публикаций.",
    clearFilters: "Сбросить фильтр",
  },
  ar: {
    subtitle:
      "أحدث تحليلات سوق الملابس بالجملة في مارتر إسطنبول، أدلة الاستيراد بنظام السيري من المصانع التركية ونصائح الشحن الدولي.",
    searchPlaceholder: "ابحث في المقالات...",
    guideBadge: "دليل",
    readMore: "اقرأ المزيد",
    emptyTitle: "لم يتم العثور على مقالات",
    emptyDesc: "لا توجد مقالات نشطة تطابق معايير البحث حالياً.",
    clearFilters: "مسح الفلتر",
  },
  de: {
    subtitle:
      "Aktuelle B2B-Marktanalysen, Einkaufsratgeber für den Textilgroßhandel in Merter Istanbul, Trendberichte und Exporttipps.",
    searchPlaceholder: "Artikel durchsuchen...",
    guideBadge: "Ratgeber",
    readMore: "Weiterlesen",
    emptyTitle: "Keine Artikel gefunden",
    emptyDesc: "Derzeit entsprechen keine aktiven Artikel Ihren Suchkriterien.",
    clearFilters: "Filter zurücksetzen",
  },
  fr: {
    subtitle:
      "Dernières analyses du marché textile B2B de Merter Istanbul, guides d’achat en série et conseils logistiques pour l’export.",
    searchPlaceholder: "Rechercher un article...",
    guideBadge: "Guide",
    readMore: "Lire la suite",
    emptyTitle: "Aucun article trouvé",
    emptyDesc: "Aucun article actif ne correspond actuellement à votre recherche.",
    clearFilters: "Effacer les filtres",
  },
  pl: {
    subtitle:
      "Najnowsze analizy rynku hurtowego Merter w Stambule, poradniki zakupowe w seriach rozmiarowych oraz wskazówki eksportowe B2B.",
    searchPlaceholder: "Szukaj artykułów...",
    guideBadge: "Poradnik",
    readMore: "Czytaj więcej",
    emptyTitle: "Nie znaleziono artykułów",
    emptyDesc: "Obecnie brak aktywnych artykułów spełniających kryteria wyszukiwania.",
    clearFilters: "Wyczyść filtr",
  },
  bg: {
    subtitle:
      "Актуални B2B анализи за пазара на дрехи на едро в Мертер Истанбул, ръководства за поръчки на серии и съвети за внос.",
    searchPlaceholder: "Търсене на статии...",
    guideBadge: "Ръководство",
    readMore: "Прочети още",
    emptyTitle: "Няма намерени статии",
    emptyDesc: "В момента няма активни статии, отговарящи на вашето търсене.",
    clearFilters: "Изчисти филтъра",
  },
};

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

interface BlogListClientProps {
  readonly categoryPrefix: string;
  readonly blogPosts: readonly BlogPost[];
  readonly categories: readonly Category[];
  readonly activeLangs: readonly Language[];
}

export default function BlogListClient({
  categoryPrefix,
  blogPosts,
  categories,
  activeLangs,
}: Readonly<BlogListClientProps>) {
  const router = useRouter();

  const matchedLang = activeLangs.find((l) => l.categoryPrefix === categoryPrefix);
  const initialLang = normalizeSeoLang(matchedLang?.code || categoryPrefix, "en");

  const [lang, setLang] = useState<string>(initialLang);
  const [isLangOpen, setIsLangOpen] = useState<boolean>(false);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState<boolean>(false);
  const [policyModalType, setPolicyModalType] = useState<
    "cancellation_and_return" | "terms_of_service" | "privacy_policy" | ""
  >("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const safeLang = normalizeSeoLang(lang, "en");
  const copy = BLOG_LIST_COPY[safeLang];

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
    router.push(`/${targetPrefix}/blog`);
  };

  const formatDate = (dateStr: string) => {
    try {
      const options: Intl.DateTimeFormatOptions = {
        year: "numeric",
        month: "long",
        day: "numeric",
      };
      return new Date(dateStr).toLocaleDateString(INTL_LOCALE_BY_LANG[safeLang], options);
    } catch {
      return dateStr.split("T")[0];
    }
  };

  const filteredPosts = blogPosts.filter((post) => {
    const trans =
      post.translations[safeLang] ||
      post.translations["en"] ||
      post.translations["tr"] ||
      Object.values(post.translations)[0];
    if (!trans) return false;
    if (!searchQuery) return true;
    const needle = searchQuery.toLowerCase();
    return (
      trans.title.toLowerCase().includes(needle) ||
      Boolean(trans.summary?.toLowerCase().includes(needle))
    );
  });

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

      <main className="flex-grow w-full max-w-[1440px] mx-auto px-4 md:px-8 py-10 md:py-16 select-none animate-in fade-in duration-300">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 border-b border-cultured pb-8">
          <div>
            <h1 className="font-sans font-extrabold text-3xl md:text-4xl text-eerie-black leading-tight tracking-tight mb-2">
              {t("blog", safeLang)}
            </h1>
            <p className="text-sm text-sonic-silver font-semibold max-w-2xl leading-relaxed">
              {copy.subtitle}
            </p>
          </div>

          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder={copy.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-cultured rounded-[10px] text-xs font-bold text-eerie-black placeholder-zinc-400 focus:outline-none focus:border-salmon-pink transition-all shadow-sm"
            />
          </div>
        </div>

        {filteredPosts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredPosts.map((post) => {
              const trans =
                post.translations[safeLang] ||
                post.translations["en"] ||
                post.translations["tr"] ||
                Object.values(post.translations)[0];
              const title = trans?.title || "Merter Vitrini B2B";
              const summary = trans?.summary || "";
              const coverImg = post.cover_image || "/og-image.jpg";

              return (
                <Link
                  key={post.id}
                  href={`/${categoryPrefix}/blog/${trans?.slug || post.slug}`}
                  className="bg-white border border-cultured rounded-[20px] shadow-sm overflow-hidden flex flex-col group cursor-pointer hover:shadow-md hover:border-zinc-300 transition-all duration-300 no-underline text-inherit"
                >
                  <article className="flex flex-col flex-grow">
                    <div className="relative aspect-[16/10] w-full overflow-hidden bg-zinc-100">
                      <Image
                        src={coverImg}
                        alt={title}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                        unoptimized
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-60" />
                    </div>

                    <div className="p-6 flex-grow flex flex-col">
                      <div className="flex items-center gap-3 text-[10px] font-extrabold uppercase tracking-wider text-sonic-silver mb-3">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={12} className="text-salmon-pink" />
                          <span>{formatDate(post.created_at)}</span>
                        </div>
                        <span>•</span>
                        <div className="px-2 py-0.5 bg-cultured text-eerie-black rounded-[5px] text-[9px] font-bold">
                          {copy.guideBadge}
                        </div>
                      </div>

                      <h2 className="font-sans font-extrabold text-base md:text-lg text-eerie-black leading-snug tracking-tight mb-3 line-clamp-2 group-hover:text-salmon-pink transition-colors">
                        {title}
                      </h2>

                      {summary && (
                        <p className="text-xs text-sonic-silver font-semibold leading-relaxed mb-6 line-clamp-3">
                          {summary}
                        </p>
                      )}

                      <div className="mt-auto pt-4 border-t border-cultured flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-salmon-pink flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                          {copy.readMore}
                          <ArrowRight size={12} />
                        </span>
                      </div>
                    </div>
                  </article>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="bg-white border border-cultured rounded-[20px] shadow-sm p-12 text-center flex flex-col items-center gap-4 max-w-lg mx-auto my-12">
            <BookOpen size={48} className="text-zinc-300 animate-pulse" />
            <h2 className="font-sans font-extrabold text-lg text-eerie-black">
              {copy.emptyTitle}
            </h2>
            <p className="text-xs text-sonic-silver font-semibold leading-relaxed">
              {copy.emptyDesc}
            </p>
            <button
              onClick={() => setSearchQuery("")}
              className="mt-2 px-6 py-2.5 bg-salmon-pink hover:bg-eerie-black text-white text-[10px] font-extrabold uppercase rounded-[5px] tracking-[1px] cursor-pointer transition-all active:scale-95 border-none"
            >
              {copy.clearFilters}
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
