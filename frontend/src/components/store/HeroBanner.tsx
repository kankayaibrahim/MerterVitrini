"use client";

import React from "react";
import { Sparkles, Layers, Box, Truck } from "lucide-react";
import { t } from "@/app/i18n";

interface HeroBannerProps {
  readonly lang: string;
}

export default function HeroBanner({ lang }: Readonly<HeroBannerProps>) {
  return (
    <div className="hidden lg:flex lg:col-span-4 rounded-lg overflow-hidden border border-[#E5E0D8] bg-[#F8F6F2] p-8 md:p-10 relative flex-col justify-center min-h-[240px] select-none">
      <div className="text-[#6E542E] font-bold text-xs uppercase tracking-[2px] mb-2 flex items-center gap-1.5">
        <Sparkles className="w-4 h-4 text-[#8C6D3F] shrink-0" />
        <span>{t("b2b_wholesale_showroom", lang)}</span>
      </div>

      <p className="font-serif font-bold text-2xl md:text-3xl text-[#1C1C1C] tracking-tight leading-tight max-w-2xl">
        {t("istanbul_wholesale", lang)}
      </p>

      <p className="mt-2.5 text-xs md:text-sm text-[#525252] leading-relaxed max-w-2xl font-normal">
        {t("hero_subtitle", lang)}
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            const catalogElement = document.getElementById("catalog-section");
            if (catalogElement) catalogElement.scrollIntoView({ behavior: "smooth" });
          }}
          className="px-5 py-2.5 bg-[#1C1C1C] hover:bg-[#333333] text-white text-xs font-bold uppercase rounded-md transition-colors duration-200 border-none cursor-pointer tracking-[0.5px]"
        >
          {t("examine_products", lang)}
        </button>

        <div className="flex flex-wrap gap-2">
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#D6D1C7] bg-white text-[10px] font-bold text-[#1C1C1C]">
            <Layers className="w-3.5 h-3.5 text-[#8C6D3F]" /> {t("assorted_series", lang)}
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#D6D1C7] bg-white text-[10px] font-bold text-[#1C1C1C]">
            <Box className="w-3.5 h-3.5 text-[#8C6D3F]" /> {t("min_1_pack", lang)}
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#D6D1C7] bg-white text-[10px] font-bold text-[#1C1C1C]">
            <Truck className="w-3.5 h-3.5 text-[#8C6D3F]" /> {t("logistics_shipping", lang)}
          </span>
        </div>
      </div>
    </div>
  );
}
