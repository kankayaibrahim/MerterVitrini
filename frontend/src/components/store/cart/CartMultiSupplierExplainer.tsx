"use client";

import React from "react";
import { Building2, ChevronDown, Info, ShieldCheck } from "lucide-react";
import type { CartSupplierGroup } from "@/utils/cartSupplierGroups";
import { getCartMultiSupplierCopy } from "./cartMultiSupplierCopy";

interface CartMultiSupplierExplainerProps {
  readonly groups: readonly CartSupplierGroup[];
  readonly lang: string;
  readonly variant: "drawer" | "page";
}

function SupplierChipList({
  groups,
  packsShort,
}: {
  readonly groups: readonly CartSupplierGroup[];
  readonly packsShort: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {groups.map((grp) => (
        <span
          key={grp.key}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-[#E5E0D8] text-[11px] font-bold text-[#1C1C1C]"
        >
          <Building2 className="w-3 h-3 text-[#8C6D3F] shrink-0" />
          <span className="truncate max-w-[165px]">{grp.brandName}</span>
          <span className="text-[#8C6D3F]">
            · {grp.totalPackages} {packsShort}
          </span>
        </span>
      ))}
    </div>
  );
}

function ThreeStepGuide({
  lang,
}: {
  readonly lang: string;
}) {
  const copy = getCartMultiSupplierCopy(lang);
  return (
    <div className="grid grid-cols-1 gap-2 pt-2.5 mt-2.5 border-t border-[#E5E0D8] text-[11px] leading-relaxed">
      <div className="bg-white border border-[#E5E0D8] rounded-md px-2.5 py-2">
        <p className="font-extrabold text-[#1C1C1C] m-0">{copy.step1Title}</p>
        <p className="font-medium text-[#525252] m-0 mt-0.5">{copy.step1Desc}</p>
      </div>
      <div className="bg-white border border-[#E5E0D8] rounded-md px-2.5 py-2">
        <p className="font-extrabold text-[#1C1C1C] m-0">{copy.step2Title}</p>
        <p className="font-medium text-[#525252] m-0 mt-0.5">{copy.step2Desc}</p>
      </div>
      <div className="bg-white border border-[#E5E0D8] rounded-md px-2.5 py-2">
        <p className="font-extrabold text-[#1C1C1C] m-0">{copy.step3Title}</p>
        <p className="font-medium text-[#525252] m-0 mt-0.5">{copy.step3Desc}</p>
      </div>
    </div>
  );
}

export default function CartMultiSupplierExplainer({
  groups,
  lang,
  variant,
}: Readonly<CartMultiSupplierExplainerProps>) {
  if (groups.length === 0) return null;

  const copy = getCartMultiSupplierCopy(lang);
  const isMulti = groups.length > 1;
  const headline = isMulti
    ? copy.multiSupplierHeadline.replace("{count}", String(groups.length))
    : copy.singleSupplierHeadline;

  return (
    <section
      aria-label={copy.howItWorksTitle}
      className="bg-[#F8F6F2] border border-[#E5E0D8] rounded-[12px] p-3.5 text-[#1C1C1C]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-7 h-7 rounded-full bg-[#1C1C1C] text-white flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-xs sm:text-[13px] font-extrabold text-[#1C1C1C] m-0 leading-snug">
              {headline}
            </h2>
            <p className="text-[10.5px] font-bold text-[#15803D] m-0 mt-0.5">
              ✓ {copy.zeroCommissionPill}
            </p>
          </div>
        </div>
      </div>

      <SupplierChipList groups={groups} packsShort={copy.packsShort} />

      {variant === "page" ? (
        <ThreeStepGuide lang={lang} />
      ) : (
        <details className="group mt-2.5 pt-2 border-t border-[#E5E0D8]">
          <summary className="list-none cursor-pointer flex items-center justify-between text-[11px] font-extrabold text-[#8C6D3F] hover:text-[#1C1C1C] transition-colors">
            <span className="flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 shrink-0" />
              <span>{copy.howItWorksToggleLabel}</span>
            </span>
            <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180 shrink-0" />
          </summary>
          <ThreeStepGuide lang={lang} />
        </details>
      )}
    </section>
  );
}
