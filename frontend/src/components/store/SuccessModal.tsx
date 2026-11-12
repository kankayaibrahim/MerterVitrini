"use client";

import React from "react";
import { Check } from "lucide-react";
import { t } from "@/app/i18n";

interface SuccessModalProps {
  readonly lang: string;
  readonly whatsappUrl: string;
  readonly onClose: () => void;
}

export default function SuccessModal({
  lang,
  whatsappUrl,
  onClose,
}: Readonly<SuccessModalProps>) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={t("close_modal", lang)}
        tabIndex={-1}
        className="fixed inset-0 bg-transparent border-none cursor-default"
        onClick={onClose}
      />
      <div className="bg-white border border-cultured rounded-[15px] max-w-md w-full p-8 text-center flex flex-col items-center gap-6 shadow-premium relative z-10 animate-in fade-in zoom-in-95 duration-200 select-none">
        
        {/* Animated Check badge */}
        <div className="w-16 h-16 rounded-full bg-salmon-pink/10 border border-salmon-pink flex items-center justify-center text-salmon-pink text-2xl font-bold animate-bounce">
          <Check className="w-8 h-8" />
        </div>

        <div>
          <h3 className="font-sans font-extrabold text-xl text-eerie-black leading-tight">
            {t("success_title", lang)}
          </h3>
          <p className="text-xs text-sonic-silver leading-relaxed font-semibold mt-3">
            {t("success_desc", lang)}
          </p>
        </div>

        {/* WhatsApp confirm anchor link */}
        <a 
          href={whatsappUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="w-full py-3 bg-[#25d366] hover:bg-[#20ba5a] text-white rounded-[5px] font-bold text-sm tracking-[0.5px] uppercase text-center no-underline shadow-sm hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2"
        >
          💬 {t("success_whatsapp", lang)}
        </a>

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 border border-cultured hover:border-salmon-pink bg-[#fafafa] rounded-[5px] text-xs font-bold text-onyx transition-colors cursor-pointer select-none active:scale-[0.98]"
        >
          {t("close", lang)}
        </button>

      </div>
    </div>
  );
}
