"use client";

import React, { useState } from "react";

interface SeoDescriptionProps {
  readonly categoryTitle: string;
  readonly seoDesc: string;
  readonly lang: string;
}

const READ_MORE_MAP: Record<string, string> = {
  tr: "Devamını Oku",
  en: "Read More",
  ar: "اقرأ المزيد",
  ru: "Читать далее",
  pl: "Czytaj więcej",
  bg: "Прочетете повече",
  de: "Weiterlesen",
  fr: "Lire la suite",
};

const READ_LESS_MAP: Record<string, string> = {
  tr: "Daha Az Göster",
  en: "Read Less",
  ar: "عرض أقل",
  ru: "Свернуть",
  pl: "Pokaż mniej",
  bg: "Покажи по-малко",
  de: "Weniger anzeigen",
  fr: "Voir moins",
};

function getSeoToggleLabel(isExpanded: boolean, lang: string): string {
  if (isExpanded) {
    return READ_LESS_MAP[lang] || READ_LESS_MAP.en;
  }
  return READ_MORE_MAP[lang] || READ_MORE_MAP.en;
}

export default function SeoDescription({
  categoryTitle,
  seoDesc,
  lang,
}: Readonly<SeoDescriptionProps>) {
  const [isSeoExpanded, setIsSeoExpanded] = useState<boolean>(false);

  return (
    <div className="mt-12 bg-white border border-cultured rounded-[15px] p-6 md:p-8 shadow-sm relative overflow-hidden select-text">
      <h2 className="font-sans font-extrabold text-sm sm:text-base uppercase tracking-wider text-eerie-black mb-4">
        {categoryTitle}
      </h2>

      <div
        className={`text-xs text-sonic-silver font-semibold leading-relaxed transition-all duration-500 ease-in-out relative ${
          isSeoExpanded ? "max-h-[5000px]" : "max-h-[140px] overflow-hidden"
        }`}
      >
        <div className="space-y-3 whitespace-pre-wrap">{seoDesc}</div>

        {!isSeoExpanded && (
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white to-transparent pointer-events-none" />
        )}
      </div>

      <div className="mt-4 flex justify-center border-t border-cultured pt-4">
        <button
          type="button"
          onClick={() => setIsSeoExpanded(!isSeoExpanded)}
          className="flex items-center gap-1.5 px-4 py-2 bg-cultured/50 hover:bg-cultured border border-transparent rounded-[8px] text-[11px] font-extrabold text-onyx uppercase tracking-wider transition-all duration-300 cursor-pointer shadow-sm active:scale-95"
        >
          <span>{getSeoToggleLabel(isSeoExpanded, lang)}</span>
          <span
            className={`transform transition-transform duration-300 ${
              isSeoExpanded ? "rotate-180" : ""
            }`}
          >
            ▼
          </span>
        </button>
      </div>
    </div>
  );
}
