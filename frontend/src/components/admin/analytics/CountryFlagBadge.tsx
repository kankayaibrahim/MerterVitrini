"use client";

import React, { useState } from "react";
import { Globe } from "lucide-react";

export interface CountryFlagBadgeProps {
  readonly countryCode: string;
  readonly title?: string;
}

function normalizeIso2(code: string): string | null {
  const clean = (code || "").trim().toUpperCase();
  if (clean.length !== 2 || clean === "XX" || clean === "ZZ") {
    return null;
  }
  const c0 = clean.codePointAt(0) ?? 0;
  const c1 = clean.codePointAt(1) ?? 0;
  if (c0 < 65 || c0 > 90 || c1 < 65 || c1 > 90) {
    return null;
  }
  return clean;
}

export default function CountryFlagBadge({
  countryCode,
  title,
}: Readonly<CountryFlagBadgeProps>) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const iso2 = normalizeIso2(countryCode);

  if (!iso2) {
    return (
      <span
        className="inline-flex items-center justify-center w-4 h-3 rounded-[2px] bg-slate-100 text-slate-500 shrink-0"
        title={title || "Bilinmeyen Ülke"}
      >
        <Globe size={11} />
      </span>
    );
  }

  const flagSrc = `https://flagcdn.com/w20/${iso2.toLowerCase()}.png`;
  if (failedSrc === flagSrc) {
    return (
      <span
        className="inline-flex items-center justify-center w-4 h-3 rounded-[2px] bg-slate-100 text-slate-600 text-[9px] font-bold shrink-0"
        title={title || iso2}
      >
        {iso2}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={flagSrc}
      alt={iso2}
      title={title || iso2}
      loading="lazy"
      onError={() => setFailedSrc(flagSrc)}
      className="inline-block w-4 h-3 rounded-[2px] object-cover border border-slate-200/70 shrink-0"
    />
  );
}
