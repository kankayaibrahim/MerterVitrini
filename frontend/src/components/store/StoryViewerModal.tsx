"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Pause,
  Play,
  ShieldCheck,
  X,
} from "lucide-react";
import { PublicStoryGroup, PublicStoryItem } from "@/types/stories";
import { normalizeSeoLang, SupportedSeoLang } from "@/utils/seoHelpers";
import { getSupplierShowcaseHref } from "@/utils/subdomain";

export const SEEN_STORIES_STORAGE_KEY = "merter_seen_story_ids_v1";
const STORY_DURATION_MS = 5500;
const TICK_INTERVAL_MS = 50;

interface ViewerCopy {
  readonly closeLabel: string;
  readonly pauseLabel: string;
  readonly resumeLabel: string;
  readonly prevStoryLabel: string;
  readonly nextStoryLabel: string;
  readonly openShowcase: string;
  readonly defaultCTA: string;
  readonly justNow: string;
  readonly minutesAgoSuffix: string;
  readonly hoursAgoSuffix: string;
  readonly verifiedLabel: string;
}

const VIEWER_COPY: Record<SupportedSeoLang, ViewerCopy> = {
  tr: {
    closeLabel: "Hikayeyi kapat",
    pauseLabel: "Duraklat",
    resumeLabel: "Devam ettir",
    prevStoryLabel: "Önceki hikaye",
    nextStoryLabel: "Sonraki hikaye",
    openShowcase: "Vitrine Git",
    defaultCTA: "Ürünü İncele",
    justNow: "Az önce",
    minutesAgoSuffix: "dk",
    hoursAgoSuffix: "sa",
    verifiedLabel: "Doğrulanmış Üretici",
  },
  en: {
    closeLabel: "Close story",
    pauseLabel: "Pause",
    resumeLabel: "Resume",
    prevStoryLabel: "Previous story",
    nextStoryLabel: "Next story",
    openShowcase: "Open Showroom",
    defaultCTA: "View Product",
    justNow: "Just now",
    minutesAgoSuffix: "m",
    hoursAgoSuffix: "h",
    verifiedLabel: "Verified Factory",
  },
  ru: {
    closeLabel: "Закрыть историю",
    pauseLabel: "Пауза",
    resumeLabel: "Продолжить",
    prevStoryLabel: "Предыдущая",
    nextStoryLabel: "Следующая",
    openShowcase: "Открыть витрину",
    defaultCTA: "Смотреть товар",
    justNow: "Только что",
    minutesAgoSuffix: "м",
    hoursAgoSuffix: "ч",
    verifiedLabel: "Проверенная фабрика",
  },
  ar: {
    closeLabel: "إغلاق القصة",
    pauseLabel: "إيقاف مؤقت",
    resumeLabel: "استئناف",
    prevStoryLabel: "القصة السابقة",
    nextStoryLabel: "القصة التالية",
    openShowcase: "فتح المعرض",
    defaultCTA: "عرض المنتج",
    justNow: "الآن",
    minutesAgoSuffix: "د",
    hoursAgoSuffix: "س",
    verifiedLabel: "مصنع معتمد",
  },
  de: {
    closeLabel: "Story schließen",
    pauseLabel: "Pausieren",
    resumeLabel: "Fortsetzen",
    prevStoryLabel: "Vorherige Story",
    nextStoryLabel: "Nächste Story",
    openShowcase: "Showroom öffnen",
    defaultCTA: "Produkt ansehen",
    justNow: "Gerade eben",
    minutesAgoSuffix: "Min.",
    hoursAgoSuffix: "Std.",
    verifiedLabel: "Geprüfter Hersteller",
  },
  fr: {
    closeLabel: "Fermer la story",
    pauseLabel: "Pause",
    resumeLabel: "Reprendre",
    prevStoryLabel: "Story précédente",
    nextStoryLabel: "Story suivante",
    openShowcase: "Voir le showroom",
    defaultCTA: "Voir le produit",
    justNow: "À l'instant",
    minutesAgoSuffix: "min",
    hoursAgoSuffix: "h",
    verifiedLabel: "Fabricant vérifié",
  },
  pl: {
    closeLabel: "Zamknij relację",
    pauseLabel: "Wstrzymaj",
    resumeLabel: "Wznów",
    prevStoryLabel: "Poprzednia relacja",
    nextStoryLabel: "Następna relacja",
    openShowcase: "Otwórz showroom",
    defaultCTA: "Zobacz produkt",
    justNow: "Przed chwilą",
    minutesAgoSuffix: "min",
    hoursAgoSuffix: "godz.",
    verifiedLabel: "Zweryfikowany producent",
  },
  bg: {
    closeLabel: "Затвори историята",
    pauseLabel: "Пауза",
    resumeLabel: "Продължи",
    prevStoryLabel: "Предишна история",
    nextStoryLabel: "Следваща история",
    openShowcase: "Отвори шоурума",
    defaultCTA: "Виж продукта",
    justNow: "Току-що",
    minutesAgoSuffix: "м",
    hoursAgoSuffix: "ч",
    verifiedLabel: "Проверен производител",
  },
};

export function readSeenStoryIDs(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(SEEN_STORIES_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((v): v is string => typeof v === "string"));
  } catch {
    return new Set();
  }
}

function persistSeenStoryID(storyId: string): void {
  if (typeof window === "undefined" || !storyId) return;
  try {
    const set = readSeenStoryIDs();
    set.add(storyId);
    const trimmed = Array.from(set).slice(-300);
    localStorage.setItem(SEEN_STORIES_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore storage limits
  }
}

function formatRelativeAge(createdIso: string, copy: ViewerCopy): string {
  const diffMs = Math.max(0, Date.now() - new Date(createdIso).getTime());
  const mins = Math.floor(diffMs / 60000);
  if (mins < 2) return copy.justNow;
  if (mins < 60) return `${mins}${copy.minutesAgoSuffix}`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}${copy.hoursAgoSuffix}`;
}

function computeStoryBarWidth(barIndex: number, activeIndex: number, progressPct: number): number {
  if (barIndex < activeIndex) return 100;
  if (barIndex > activeIndex) return 0;
  return Math.min(100, Math.max(0, progressPct));
}

function resolveStoryCTA(
  story: PublicStoryItem,
  copy: ViewerCopy,
  lang: SupportedSeoLang,
  langSuffix: string
): { label: string; href: string } {
  if (story.cta_url) {
    const label = story.cta_label.trim() || copy.defaultCTA;
    if (story.cta_url.startsWith("/") && langSuffix && !story.cta_url.includes("?")) {
      return { label, href: `${story.cta_url}${langSuffix}` };
    }
    return { label, href: story.cta_url };
  }
  return {
    label: copy.openShowcase,
    href: getSupplierShowcaseHref(
      {
        id: story.brand_id,
        slug: story.brand_slug,
        subdomain: story.brand_subdomain,
        subdomain_enabled: Boolean(story.brand_subdomain),
      },
      lang
    ),
  };
}

interface StoryViewerModalProps {
  readonly groups: readonly PublicStoryGroup[];
  readonly initialGroupIndex: number;
  readonly initialStoryIndex?: number;
  readonly lang: string;
  readonly onClose: () => void;
  readonly onStorySeen?: (storyId: string) => void;
}

export default function StoryViewerModal({
  groups,
  initialGroupIndex,
  initialStoryIndex = 0,
  lang,
  onClose,
  onStorySeen,
}: StoryViewerModalProps) {
  const router = useRouter();
  const safeLang = normalizeSeoLang(lang, "tr");
  const copy = VIEWER_COPY[safeLang];
  const langSuffix = safeLang === "tr" ? "" : `?lang=${safeLang}`;

  const [groupIdx, setGroupIdx] = useState<number>(() =>
    Math.min(Math.max(0, initialGroupIndex), Math.max(0, groups.length - 1))
  );
  const [storyIdx, setStoryIdx] = useState<number>(() => Math.max(0, initialStoryIndex));
  const [progressPct, setProgressPct] = useState<number>(0);
  const [paused, setPaused] = useState<boolean>(false);

  const currentGroup = groups[groupIdx] ?? null;
  const currentStories = currentGroup?.stories ?? [];
  const activeStory = currentStories[storyIdx] ?? currentStories[0] ?? null;
  const activeStoryID = activeStory?.id ?? "";

  const goNext = useCallback(() => {
    if (!currentGroup) {
      onClose();
      return;
    }
    if (storyIdx + 1 < currentGroup.stories.length) {
      setStoryIdx((prev) => prev + 1);
      setProgressPct(0);
      return;
    }
    if (groupIdx + 1 < groups.length) {
      setGroupIdx((prev) => prev + 1);
      setStoryIdx(0);
      setProgressPct(0);
      return;
    }
    onClose();
  }, [currentGroup, groupIdx, groups.length, onClose, storyIdx]);

  const goPrev = useCallback(() => {
    if (storyIdx > 0) {
      setStoryIdx((prev) => prev - 1);
      setProgressPct(0);
      return;
    }
    if (groupIdx > 0) {
      const prevGrp = groups[groupIdx - 1];
      setGroupIdx((prev) => prev - 1);
      setStoryIdx(Math.max(0, (prevGrp?.stories.length ?? 1) - 1));
      setProgressPct(0);
      return;
    }
    setProgressPct(0);
  }, [groupIdx, groups, storyIdx]);

  // Track story impression & persist seen state cleanly
  useEffect(() => {
    if (!activeStoryID) return;
    persistSeenStoryID(activeStoryID);
    onStorySeen?.(activeStoryID);
    void fetch(`/api/v1/store/stories/${encodeURIComponent(activeStoryID)}/view`, {
      method: "POST",
    }).catch(() => {});
  }, [activeStoryID, onStorySeen]);

  // Auto-advance timer
  useEffect(() => {
    if (!activeStoryID || paused) return;
    const step = (TICK_INTERVAL_MS / STORY_DURATION_MS) * 100;
    const timer = window.setInterval(() => {
      setProgressPct((prev) => {
        if (prev + step >= 100) {
          queueMicrotask(goNext);
          return 100;
        }
        return prev + step;
      });
    }, TICK_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [activeStoryID, paused, goNext]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowRight") {
        if (safeLang === "ar") {
          goPrev();
        } else {
          goNext();
        }
      } else if (e.key === "ArrowLeft") {
        if (safeLang === "ar") {
          goNext();
        } else {
          goPrev();
        }
      } else if (e.key === " ") {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goNext, goPrev, onClose, safeLang]);

  if (!currentGroup || !activeStory) {
    return null;
  }

  const cta = resolveStoryCTA(activeStory, copy, safeLang, langSuffix);
  const showcaseHref = getSupplierShowcaseHref(
    {
      id: currentGroup.brand_id,
      slug: currentGroup.brand_slug,
      subdomain: currentGroup.brand_subdomain,
      subdomain_enabled: Boolean(currentGroup.brand_subdomain),
    },
    safeLang
  );
  const isExternalShowcase = showcaseHref.startsWith("http");

  const handleCTAClick = () => {
    void fetch(`/api/v1/store/stories/${encodeURIComponent(activeStory.id)}/click`, {
      method: "POST",
    }).catch(() => {});
    onClose();
    if (cta.href.startsWith("http")) {
      window.location.href = cta.href;
    } else {
      router.push(cta.href);
    }
  };

  const showcaseHeaderContent = (
    <>
      <div className="w-9 h-9 rounded-full bg-white/95 text-[#111111] border-2 border-[#D4AF37] overflow-hidden flex items-center justify-center shrink-0">
        {currentGroup.brand_cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentGroup.brand_cover_url}
            alt={currentGroup.brand_name}
            className="w-full h-full object-cover"
          />
        ) : (
          <Building2 size={16} />
        )}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-extrabold text-white truncate group-hover:underline">
            {currentGroup.brand_name}
          </span>
          {currentGroup.brand_verified && (
            <ShieldCheck
              size={13}
              className="text-emerald-400 shrink-0"
              aria-label={copy.verifiedLabel}
            />
          )}
          <span className="text-[11px] font-semibold text-white/75 shrink-0">
            • {formatRelativeAge(activeStory.created_at, copy)}
          </span>
        </div>
        {activeStory.product_title && (
          <p className="text-[10.5px] font-semibold text-amber-300 truncate">
            {activeStory.product_title}
          </p>
        )}
      </div>
    </>
  );

  return (
    <div
      dir={safeLang === "ar" ? "rtl" : "ltr"}
      className="fixed inset-0 z-[120] bg-black/92 backdrop-blur-md flex items-center justify-center p-0 sm:p-4 select-none"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={copy.closeLabel}
        className="hidden sm:flex fixed top-5 end-5 z-30 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white items-center justify-center border border-white/15 cursor-pointer transition-colors"
      >
        <X size={20} />
      </button>

      {/* Previous brand arrow on desktop */}
      <button
        type="button"
        onClick={goPrev}
        aria-label={copy.prevStoryLabel}
        disabled={groupIdx === 0 && storyIdx === 0}
        className="hidden sm:flex me-4 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-25 text-white items-center justify-center border border-white/15 cursor-pointer transition-colors"
      >
        <ChevronLeft size={22} className="rtl:rotate-180" />
      </button>

      {/* Vertical 9:16 Instagram Story Canvas */}
      <div
        className="relative w-full h-full sm:h-auto sm:aspect-[9/16] sm:max-w-[420px] sm:max-h-[88vh] sm:rounded-2xl overflow-hidden shadow-2xl border border-white/10 flex flex-col justify-between"
        style={{ backgroundColor: activeStory.bg_color || "#111111" }}
      >
        {/* Background Media */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={activeStory.media_url}
          alt={activeStory.caption || currentGroup.brand_name}
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Top & Bottom Scrim Gradients */}
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/75 via-black/30 to-transparent pointer-events-none z-10" />
        <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none z-10" />

        {/* Left / Right Tap Navigation Zones */}
        <div className="absolute inset-0 z-10 flex">
          <button
            type="button"
            aria-label={copy.prevStoryLabel}
            onClick={goPrev}
            className="w-1/3 h-full bg-transparent border-none cursor-pointer focus:outline-none"
          />
          <button
            type="button"
            aria-label={paused ? copy.resumeLabel : copy.pauseLabel}
            onClick={() => setPaused((p) => !p)}
            className="w-1/3 h-full bg-transparent border-none cursor-pointer focus:outline-none"
          />
          <button
            type="button"
            aria-label={copy.nextStoryLabel}
            onClick={goNext}
            className="w-1/3 h-full bg-transparent border-none cursor-pointer focus:outline-none"
          />
        </div>

        {/* Top Header: Segmented Progress + Brand Avatar */}
        <div className="relative z-20 p-3.5 pt-4 space-y-3 pointer-events-none">
          <div className="flex items-center gap-1">
            {currentStories.map((st, idx) => (
              <div
                key={st.id}
                className="h-1 flex-1 rounded-full bg-white/30 overflow-hidden"
              >
                <div
                  className="h-full bg-white transition-[width] duration-75 ease-linear rounded-full"
                  style={{ width: `${computeStoryBarWidth(idx, storyIdx, progressPct)}%` }}
                />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2 pointer-events-auto">
            {isExternalShowcase ? (
              <a
                href={showcaseHref}
                onClick={onClose}
                className="flex items-center gap-2.5 min-w-0 no-underline group"
              >
                {showcaseHeaderContent}
              </a>
            ) : (
              <Link
                href={showcaseHref}
                onClick={onClose}
                className="flex items-center gap-2.5 min-w-0 no-underline group"
              >
                {showcaseHeaderContent}
              </Link>
            )}

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setPaused((p) => !p)}
                aria-label={paused ? copy.resumeLabel : copy.pauseLabel}
                className="w-8 h-8 rounded-full bg-black/45 hover:bg-black/65 text-white flex items-center justify-center border border-white/15 cursor-pointer"
              >
                {paused ? <Play size={14} /> : <Pause size={14} />}
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label={copy.closeLabel}
                className="sm:hidden w-8 h-8 rounded-full bg-black/45 hover:bg-black/65 text-white flex items-center justify-center border border-white/15 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Caption & CTA */}
        <div className="relative z-20 p-4 pb-6 space-y-3">
          {activeStory.caption && (
            <p className="text-sm font-semibold text-white leading-snug drop-shadow-md">
              {activeStory.caption}
            </p>
          )}

          <button
            type="button"
            onClick={handleCTAClick}
            className="w-full py-3 px-4 rounded-xl bg-white hover:bg-amber-50 text-[#111111] text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg border-none cursor-pointer transition-colors"
          >
            <span>{cta.label}</span>
            <ExternalLink size={14} />
          </button>
        </div>
      </div>

      {/* Next brand arrow on desktop */}
      <button
        type="button"
        onClick={goNext}
        aria-label={copy.nextStoryLabel}
        className="hidden sm:flex ms-4 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white items-center justify-center border border-white/15 cursor-pointer transition-colors"
      >
        <ChevronRight size={22} className="rtl:rotate-180" />
      </button>
    </div>
  );
}
