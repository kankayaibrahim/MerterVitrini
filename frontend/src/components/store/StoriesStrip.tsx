"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Building2, Sparkles } from "lucide-react";
import { PublicStoryGroup } from "@/types/stories";
import { normalizeSeoLang, SupportedSeoLang } from "@/utils/seoHelpers";
import StoryViewerModal, { readSeenStoryIDs } from "./StoryViewerModal";

interface StripCopy {
  readonly heading: string;
  readonly subheading: string;
  readonly storyUnit: string;
}

const STRIP_COPY: Record<SupportedSeoLang, StripCopy> = {
  tr: {
    heading: "Üretici Hikayeleri",
    subheading: "24 Saatlik Yeni Sezon & Seri Duyuruları",
    storyUnit: "hikaye",
  },
  en: {
    heading: "Factory Stories",
    subheading: "24h New Season & Wholesale Highlights",
    storyUnit: "stories",
  },
  ru: {
    heading: "Истории фабрик",
    subheading: "Новинки сезона и подборки 24ч",
    storyUnit: "историй",
  },
  ar: {
    heading: "قصص المصانع",
    subheading: "أحدث الموديلات خلال 24 ساعة",
    storyUnit: "قصة",
  },
  de: {
    heading: "Hersteller-Stories",
    subheading: "24h Kollektions-Highlights ab Werk",
    storyUnit: "Stories",
  },
  fr: {
    heading: "Stories Fabricants",
    subheading: "Nouveautés & séries 24h en direct",
    storyUnit: "stories",
  },
  pl: {
    heading: "Relacje Producentów",
    subheading: "Nowości hurtowe z ostatnich 24h",
    storyUnit: "relacji",
  },
  bg: {
    heading: "Истории на фабриките",
    subheading: "Нови модели и серии за 24ч",
    storyUnit: "истории",
  },
};

function findFirstUnseenIndex(group: PublicStoryGroup, seenIDs: Set<string>): number {
  const idx = group.stories.findIndex((s) => !seenIDs.has(s.id));
  return idx >= 0 ? idx : 0;
}

interface StoriesStripProps {
  readonly lang: string;
}

export default function StoriesStrip({ lang }: StoriesStripProps) {
  const safeLang = normalizeSeoLang(lang, "tr");
  const copy = STRIP_COPY[safeLang];

  const [groups, setGroups] = useState<PublicStoryGroup[]>([]);
  const [loaded, setLoaded] = useState<boolean>(false);
  const [seenIDs, setSeenIDs] = useState<Set<string>>(() => readSeenStoryIDs());
  const [viewerState, setViewerState] = useState<{
    groupIndex: number;
    storyIndex: number;
    sessionKey: number;
  } | null>(null);

  useEffect(() => {
    let ignore = false;
    fetch("/api/v1/store/stories", {
      headers: { Accept: "application/json" },
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as { groups?: PublicStoryGroup[] };
        if (!ignore) {
          setGroups(Array.isArray(data.groups) ? data.groups : []);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!ignore) setLoaded(true);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const handleStorySeen = useCallback((storyId: string) => {
    setSeenIDs((prev) => {
      if (prev.has(storyId)) return prev;
      const next = new Set(prev);
      next.add(storyId);
      return next;
    });
  }, []);

  if (!loaded || groups.length === 0) {
    return null;
  }

  return (
    <section
      aria-label={copy.heading}
      className="w-full mb-6"
    >
      <div className="bg-white border border-cultured rounded-xl px-4 py-3 shadow-2xs">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-tr from-[#D4AF37] via-[#E1306C] to-[#F77737] text-white shrink-0">
              <Sparkles size={13} />
            </span>
            <span className="text-xs font-extrabold uppercase tracking-wider text-eerie-black">
              {copy.heading}
            </span>
            <span className="hidden sm:inline text-[11px] font-medium text-sonic-silver">
              • {copy.subheading}
            </span>
          </div>
        </div>

        <div className="flex items-start gap-4 overflow-x-auto no-scrollbar pb-1">
          {groups.map((grp, gIdx) => {
            const hasUnseen = grp.stories.some((s) => !seenIDs.has(s.id));
            const previewImage = grp.brand_cover_url || grp.stories[0]?.media_url || "";
            const ringCls = hasUnseen
              ? "bg-gradient-to-tr from-[#D4AF37] via-[#E1306C] to-[#F77737] p-[2.5px]"
              : "bg-zinc-200 p-[2px]";

            return (
              <button
                key={grp.brand_id}
                type="button"
                onClick={() =>
                  setViewerState({
                    groupIndex: gIdx,
                    storyIndex: findFirstUnseenIndex(grp, seenIDs),
                    sessionKey: Date.now(),
                  })
                }
                className="flex flex-col items-center gap-1.5 w-[78px] shrink-0 bg-transparent border-none cursor-pointer group p-0"
              >
                <div
                  className={`w-[66px] h-[66px] rounded-full ${ringCls} transition-transform duration-200 group-hover:scale-105`}
                >
                  <div className="w-full h-full rounded-full bg-white p-[2px] overflow-hidden flex items-center justify-center">
                    {previewImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={previewImage}
                        alt={grp.brand_name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full rounded-full bg-zinc-100 text-eerie-black flex items-center justify-center">
                        <Building2 size={22} />
                      </div>
                    )}
                  </div>
                </div>

                <span className="text-[11px] font-bold text-eerie-black line-clamp-1 w-full text-center group-hover:text-salmon-pink transition-colors">
                  {grp.brand_name}
                </span>
                <span className="text-[9.5px] font-semibold text-sonic-silver -mt-1">
                  {grp.stories.length} {copy.storyUnit}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {viewerState && (
        <StoryViewerModal
          key={viewerState.sessionKey}
          groups={groups}
          initialGroupIndex={viewerState.groupIndex}
          initialStoryIndex={viewerState.storyIndex}
          lang={lang}
          onClose={() => setViewerState(null)}
          onStorySeen={handleStorySeen}
        />
      )}
    </section>
  );
}
