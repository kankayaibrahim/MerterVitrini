"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";
import { pickLangText, SupportedLangCode, t } from "@/app/i18n";

interface ConfirmModalProps {
  readonly lang: string;
  readonly message: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  readonly confirmText?: string;
  readonly cancelText?: string;
}

const buttonTranslations: Record<SupportedLangCode, { cancel: string; confirm: string }> = {
  tr: { cancel: "Vazgeç", confirm: "Evet, Kaldır" },
  en: { cancel: "Cancel", confirm: "Yes, Remove" },
  pl: { cancel: "Anuluj", confirm: "Tak, usuń" },
  ar: { cancel: "إلغاء", confirm: "نعم، إزالة" },
  ru: { cancel: "Отмена", confirm: "Да, удалить" },
  de: { cancel: "Abbrechen", confirm: "Ja, entfernen" },
  bg: { cancel: "Отказ", confirm: "Да, премахни" },
  fr: { cancel: "Annuler", confirm: "Oui, supprimer" },
};

export default function ConfirmModal({
  lang,
  message,
  onConfirm,
  onCancel,
  confirmText,
  cancelText,
}: Readonly<ConfirmModalProps>) {
  const trans = pickLangText(lang, buttonTranslations);

  const finalCancelText = cancelText || trans.cancel;
  const finalConfirmText = confirmText || trans.confirm;

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={t("close_modal", lang)}
        tabIndex={-1}
        className="fixed inset-0 bg-transparent border-none cursor-default"
        onClick={onCancel}
      />
      <div className="bg-white border border-cultured rounded-[15px] max-w-sm w-full p-6 text-center flex flex-col items-center gap-5 shadow-premium relative z-10 animate-in fade-in zoom-in-95 duration-200 select-none">
        
        {/* Animated Warning badge */}
        <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-500 animate-pulse">
          <AlertTriangle className="w-7 h-7" />
        </div>

        <div>
          <p className="font-sans font-extrabold text-sm text-eerie-black leading-relaxed">
            {message}
          </p>
        </div>

        <div className="flex gap-3 w-full">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 border border-cultured hover:bg-zinc-50 rounded-[5px] text-xs font-bold text-onyx transition-colors cursor-pointer select-none active:scale-[0.98]"
          >
            {finalCancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-2.5 bg-salmon-pink hover:bg-eerie-black text-white rounded-[5px] text-xs font-bold transition-all cursor-pointer select-none active:scale-[0.98]"
          >
            {finalConfirmText}
          </button>
        </div>

      </div>
    </div>
  );
}
