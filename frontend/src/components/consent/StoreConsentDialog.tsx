"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Database,
  Lock,
  ShieldCheck,
  X,
} from "lucide-react";
import type { AllConsentNames } from "@c15t/core";
import { ConsentDraftProvider, useConsentDraft } from "@c15t/react";
import { useHeadlessConsentUI } from "@c15t/react/headless";
import { getCategoryPrefix } from "@/app/i18n";
import {
  CONSENT_UI_COPY,
  normalizeConsentLang,
  type ConsentLang,
} from "./consentCopy";
import {
  CONSENT_RUNTIME_UPDATED_EVENT,
  getCachedConsentInitData,
  getCachedConsentReceipt,
  type ConsentReceiptDTO,
  type CookieInventoryItemDTO,
} from "./consentRuntime";

interface StoreConsentDialogProps {
  lang: ConsentLang;
}

const ORDERED_CATEGORIES: readonly AllConsentNames[] = [
  "necessary",
  "functionality",
  "experience",
  "measurement",
  "marketing",
];

function ReceiptProofPanel({
  lang,
  receipt,
}: {
  lang: ConsentLang;
  receipt: ConsentReceiptDTO | null;
}) {
  const copy = CONSENT_UI_COPY[lang].receipt;
  const [copied, setCopied] = useState(false);

  if (!receipt) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(receipt.consent_ref_id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/70 p-4 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2 font-semibold text-emerald-950">
          <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>{copy.title}</span>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
            receipt.anchored
              ? "bg-emerald-700 text-white"
              : "bg-amber-100 text-amber-900 border border-amber-300"
          }`}
        >
          {receipt.anchored ? copy.anchoredBadge : copy.pendingBadge}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-lg bg-white/80 border border-emerald-900/10 p-2">
          <span className="text-eerie-black/60 block">{copy.refLabel}</span>
          <div className="flex items-center justify-between gap-1 mt-0.5">
            <code
              data-testid="consent-receipt-ref"
              className="font-mono font-bold text-eerie-black"
            >
              {receipt.consent_ref_id}
            </code>
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-800 hover:text-emerald-950 cursor-pointer"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? copy.copied : copy.copyRef}
            </button>
          </div>
        </div>

        <div className="rounded-lg bg-white/80 border border-emerald-900/10 p-2">
          <span className="text-eerie-black/60 block">{copy.timeLabel}</span>
          <code className="font-mono text-eerie-black mt-0.5 block truncate">
            {receipt.recorded_at_utc}
          </code>
        </div>

        <div className="rounded-lg bg-white/80 border border-emerald-900/10 p-2 sm:col-span-2">
          <span className="text-eerie-black/60 block">{copy.entryHashLabel}</span>
          <code className="font-mono text-[10px] text-eerie-black/90 break-all block mt-0.5">
            {receipt.entry_hash}
          </code>
        </div>
      </div>

      <p className="mt-2.5 text-[11px] leading-relaxed text-emerald-950/80">
        {copy.explain}
      </p>
    </div>
  );
}

function CategoryCookieTable({
  lang,
  items,
}: {
  lang: ConsentLang;
  items: CookieInventoryItemDTO[];
}) {
  const t = CONSENT_UI_COPY[lang].table;
  if (items.length === 0) {
    return (
      <p className="text-[11px] text-eerie-black/60 italic py-2">
        {t.emptyInventory}
      </p>
    );
  }

  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-eerie-black/10 bg-cultured/40">
      <table className="w-full text-left border-collapse text-[11px]">
        <thead>
          <tr className="border-b border-eerie-black/10 bg-cultured text-eerie-black/75">
            <th className="py-2 px-2.5 font-semibold">{t.cookieName}</th>
            <th className="py-2 px-2.5 font-semibold">{t.provider}</th>
            <th className="py-2 px-2.5 font-semibold">{t.storageType}</th>
            <th className="py-2 px-2.5 font-semibold">{t.duration}</th>
            <th className="py-2 px-2.5 font-semibold">{t.purpose}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-eerie-black/10">
          {items.map((ck) => (
            <tr key={ck.id || ck.cookie_name} className="bg-white/60">
              <td className="py-2 px-2.5 font-mono font-semibold text-eerie-black whitespace-nowrap">
                {ck.cookie_name}
              </td>
              <td className="py-2 px-2.5 text-eerie-black/80 whitespace-nowrap">
                {ck.provider}{" "}
                <span className="ms-1 rounded bg-eerie-black/5 px-1.5 py-0.5 text-[9px] font-medium">
                  {ck.is_third_party ? t.thirdParty : t.firstParty}
                </span>
              </td>
              <td className="py-2 px-2.5 text-eerie-black/75 whitespace-nowrap">
                {ck.storage_type}
              </td>
              <td className="py-2 px-2.5 text-eerie-black/75 whitespace-nowrap">
                {ck.duration}
              </td>
              <td className="py-2 px-2.5 text-eerie-black/80 min-w-[200px]">
                {ck.purpose}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConsentDialogInner({
  lang,
  onClose,
}: {
  lang: ConsentLang;
  onClose: () => void;
}) {
  const safeLang = normalizeConsentLang(lang);
  const copy = useMemo(() => CONSENT_UI_COPY[safeLang], [safeLang]);
  const isRtl = safeLang === "ar";
  const policyHref = `/${getCategoryPrefix(safeLang)}/pages/cerez-politikasi`;

  const draft = useConsentDraft();
  const [expandedCategory, setExpandedCategory] = useState<AllConsentNames | null>("necessary");
  const [saving, setSaving] = useState(false);
  const [runtimeTick, setRuntimeTick] = useState(0);
  const [receipt, setReceipt] = useState<ConsentReceiptDTO | null>(() =>
    getCachedConsentReceipt()
  );

  useEffect(() => {
    const refreshRuntime = () => {
      setReceipt(getCachedConsentReceipt());
      setRuntimeTick((prev) => prev + 1);
    };
    window.addEventListener(CONSENT_RUNTIME_UPDATED_EVENT, refreshRuntime);
    return () => {
      window.removeEventListener(CONSENT_RUNTIME_UPDATED_EVENT, refreshRuntime);
    };
  }, []);

  const inventoryByCategory = useMemo(() => {
    void runtimeTick;
    const grouped: Record<AllConsentNames, CookieInventoryItemDTO[]> = {
      necessary: [],
      functionality: [],
      experience: [],
      measurement: [],
      marketing: [],
    };
    const items = getCachedConsentInitData()?.cookie_inventory || [];
    for (const item of items) {
      if (grouped[item.category]) {
        grouped[item.category].push(item);
      }
    }
    return grouped;
  }, [runtimeTick]);

  const handleSaveCustom = async () => {
    setSaving(true);
    try {
      await draft.save();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleBulkSave = async (grantAll: boolean) => {
    setSaving(true);
    try {
      if (grantAll) {
        draft.acceptAll();
      } else {
        draft.rejectAll();
      }
      await draft.save();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      role="dialog"
      aria-modal="true"
      aria-label={copy.dialogTitle}
      data-testid="merter-consent-dialog"
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/55 backdrop-blur-xs p-3 sm:p-6"
    >
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-eerie-black/15 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-eerie-black/10 bg-cultured/50 px-5 py-4 sm:px-6">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-eerie-black px-2.5 py-0.5 text-[10px] font-semibold tracking-wider text-accent-gold uppercase">
              <ShieldCheck className="w-3.5 h-3.5" />
              {copy.badge}
            </span>
            <h2 className="mt-1.5 font-serif text-lg sm:text-xl font-bold text-eerie-black">
              {copy.dialogTitle}
            </h2>
            <p className="mt-1 text-xs text-eerie-black/75">
              {copy.dialogSubtitle}{" "}
              <Link
                href={policyHref}
                onClick={onClose}
                className="font-semibold text-eerie-black underline decoration-accent-gold underline-offset-4 hover:text-accent-gold"
              >
                {copy.cookiePolicyLabel}
              </Link>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={copy.closeLabel}
            className="rounded-xl p-2 text-eerie-black/70 hover:bg-eerie-black/10 hover:text-eerie-black transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6 space-y-3.5">
          <ReceiptProofPanel lang={safeLang} receipt={receipt} />

          {ORDERED_CATEGORIES.map((category) => {
            const catMeta = copy.categories[category];
            const isNecessary = category === "necessary";
            const isChecked = isNecessary ? true : Boolean(draft.values[category]);
            const isExpanded = expandedCategory === category;
            const catItems = inventoryByCategory[category] || [];

            return (
              <div
                key={category}
                className="rounded-xl border border-eerie-black/15 bg-white p-4 transition-colors hover:border-eerie-black/25"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-eerie-black">
                        {catMeta.title}
                      </h3>
                      <span className="inline-flex items-center gap-1 rounded-full bg-cultured px-2 py-0.5 text-[10px] font-medium text-eerie-black/75">
                        <Database className="w-3 h-3" />
                        {catItems.length}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-eerie-black/75">
                      {catMeta.description}
                    </p>
                  </div>

                  {isNecessary ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-eerie-black text-accent-gold px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide">
                      <Lock className="w-3 h-3" />
                      {copy.alwaysActive}
                    </span>
                  ) : (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isChecked}
                      data-testid={`consent-toggle-${category}`}
                      onClick={() => draft.set(category, !isChecked)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                        isChecked ? "bg-eerie-black" : "bg-eerie-black/20"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          isChecked
                            ? isRtl
                              ? "-translate-x-6"
                              : "translate-x-6"
                            : isRtl
                              ? "-translate-x-1"
                              : "translate-x-1"
                        }`}
                      />
                    </button>
                  )}
                </div>

                <div className="mt-2.5 pt-2 border-t border-eerie-black/5">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedCategory(isExpanded ? null : category)
                    }
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-eerie-black/70 hover:text-eerie-black cursor-pointer"
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                    {copy.table.title} ({catItems.length})
                  </button>
                  {isExpanded && (
                    <CategoryCookieTable lang={safeLang} items={catItems} />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Sticky Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-eerie-black/10 bg-cultured/50 px-5 py-3.5 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleBulkSave(false)}
              className="rounded-xl border border-eerie-black/25 bg-white hover:bg-cultured px-3.5 py-2 text-xs font-semibold text-eerie-black transition-colors cursor-pointer disabled:opacity-50"
            >
              {copy.rejectAll}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleBulkSave(true)}
              className="rounded-xl border border-eerie-black/25 bg-white hover:bg-cultured px-3.5 py-2 text-xs font-semibold text-eerie-black transition-colors cursor-pointer disabled:opacity-50"
            >
              {copy.acceptAll}
            </button>
          </div>

          <button
            type="button"
            disabled={saving}
            data-testid="consent-save-preferences"
            onClick={() => void handleSaveCustom()}
            className="rounded-xl bg-eerie-black hover:bg-black px-5 py-2.5 text-xs font-semibold text-white transition-colors cursor-pointer disabled:opacity-50"
          >
            {copy.savePreferences}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StoreConsentDialog({ lang }: StoreConsentDialogProps) {
  const { dialog, closeUI } = useHeadlessConsentUI();

  if (!dialog.isVisible) {
    return null;
  }

  return (
    <ConsentDraftProvider>
      <ConsentDialogInner lang={lang} onClose={closeUI} />
    </ConsentDraftProvider>
  );
}
