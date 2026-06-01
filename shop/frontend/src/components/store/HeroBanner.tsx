"use client";

import React from "react";
import { Sparkles, Layers, Box, Truck } from "lucide-react";
import { t } from "@/app/i18n";

interface HeroBannerProps {
  lang: string;
}

export default function HeroBanner({ lang }: HeroBannerProps) {
  return (
    <div className="hidden lg:flex lg:col-span-4 rounded-[15px] overflow-hidden border border-cultured bg-gradient-to-r from-[#fafafa] to-[#fff0f1] p-8 md:p-12 relative flex-col justify-center min-h-[260px] select-none shadow-sm">
      <div className="absolute right-8 top-1/2 -translate-y-1/2 w-64 h-64 bg-radial from-salmon-pink/10 to-transparent pointer-events-none rounded-full hidden lg:block animate-pulse" />
      
      <div className="text-salmon-pink font-bold text-xs sm:text-sm uppercase tracking-[2px] mb-2 flex items-center gap-1.5">
        <Sparkles className="w-4 h-4 shrink-0" />
        {t("b2b_wholesale_showroom", lang)}
      </div>
      
      <h1 className="font-sans font-extrabold text-2xl md:text-3.5xl text-eerie-black tracking-tight leading-tight max-w-xl">
        {t("istanbul_wholesale", lang)}
      </h1>
      
      <p className="mt-3 text-xs md:text-sm text-sonic-silver leading-relaxed max-w-xl font-medium">
        {t("hero_subtitle", lang)}
      </p>
      
      <div className="mt-6 flex flex-wrap items-center gap-4">
        {/* B2B CTA button */}
        <button 
          onClick={() => {
            const catalogElement = document.getElementById("catalog-section");
            if (catalogElement) catalogElement.scrollIntoView({ behavior: "smooth" });
          }}
          className="px-5 py-2.5 bg-salmon-pink hover:bg-eerie-black text-white text-xs font-bold uppercase rounded-[5px] transition-colors duration-300 border-none cursor-pointer tracking-[0.5px]"
        >
          {t("examine_products", lang)}
        </button>

        {/* Feature Badges */}
        <div className="flex flex-wrap gap-2">
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-[5px] border border-cultured bg-white text-[10px] font-bold text-onyx shadow-inner">
            <Layers className="w-3.5 h-3.5 text-salmon-pink" /> {t("assorted_series", lang)}
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-[5px] border border-cultured bg-white text-[10px] font-bold text-onyx shadow-inner">
            <Box className="w-3.5 h-3.5 text-salmon-pink" /> {t("min_1_pack", lang)}
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-[5px] border border-cultured bg-white text-[10px] font-bold text-onyx shadow-inner">
            <Truck className="w-3.5 h-3.5 text-salmon-pink" /> {t("logistics_shipping", lang)}
          </span>
        </div>
      </div>
    </div>
  );
}
