"use client";

import React from "react";
import { ShieldCheck } from "lucide-react";

interface SupplierContentLegalConsentBoxProps {
  readonly checked: boolean;
  readonly onChange: (nextChecked: boolean) => void;
  readonly idPrefix: string;
  readonly compact?: boolean;
}

export function SupplierContentLegalConsentBox({
  checked,
  onChange,
  idPrefix,
  compact = false,
}: SupplierContentLegalConsentBoxProps) {
  const inputId = `${idPrefix}-content-legal-consent`;

  return (
    <div
      className={`rounded-xl border transition-colors ${
        checked
          ? "bg-emerald-50/70 border-emerald-200"
          : "bg-amber-50/80 border-amber-300"
      } ${compact ? "p-3" : "p-3.5 sm:p-4"}`}
    >
      <label htmlFor={inputId} className="flex items-start gap-2.5 cursor-pointer select-none">
        <input
          id={inputId}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
        />
        <div className="text-[11px] sm:text-xs leading-relaxed text-slate-700 space-y-1">
          <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
            <ShieldCheck size={14} className={checked ? "text-emerald-600" : "text-amber-700"} />
            <span>İçerik Sağlayıcı, Telif Hakkı ve Hukuki Sorumluluk Beyanı (Zorunlu)</span>
          </div>
          <p className="font-medium text-slate-700 m-0">
            Yüklediğim tüm ürün fotoğraf, görsel ve metinlerin telif/marka/tasarım haklarının
            (<strong>5846 FSEK &amp; 6769 SMK</strong>) şahsıma veya lisanslı firmama ait olduğunu;
            taklit/replika veya yasalara aykırı hiçbir ürün içermediğini;{" "}
            <strong>5651 sayılı Kanun m. 5</strong> uyarınca Merter Vitrini’nin yalnızca{" "}
            <strong>Yer Sağlayıcı</strong> olduğunu, alıcı şikâyetleri, ticari satış ve tüm adli/idari/mali
            yaptırımlardan tek{" "}
            <a
              href="/tr/pages/tedarikci-sozlesmesi"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-slate-900 underline hover:text-emerald-700"
            >
              Doğrudan Satıcı &amp; Tedarikçi
            </a>{" "}
            olarak münhasıran sorumlu olduğumu ve{" "}
            <a
              href="/tr/pages/telif-hakki-ve-uyar-kaldir"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-slate-900 underline hover:text-emerald-700"
            >
              Uyar-Kaldır Politikası
            </a>{" "}
            hükümlerini kabul ettiğimi onaylarım.
          </p>
        </div>
      </label>
    </div>
  );
}
