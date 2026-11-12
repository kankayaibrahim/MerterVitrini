"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  Compass,
  Filter,
  Flame,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";
import {
  BiFunnelStep,
  BiHotBuyerLead,
  BiOverviewMetrics,
  formatDurationSec,
  formatRelativeTimeTr,
  getCountryFlagEmoji,
  getCountryLabelTr,
} from "./biTypes";

type BuyerFilterMode = "all" | "registered" | "anonymous";

function buildFallbackFunnel(overview: BiOverviewMetrics): BiFunnelStep[] {
  const start = Math.max(1, overview.unique_visitors);
  const catalog = Math.round(overview.unique_visitors * 0.72);
  const rawSteps = [
    { step_key: "visit", label: "1. Mağaza Ziyareti", count: overview.unique_visitors },
    { step_key: "catalog", label: "2. Katalog Keşfi", count: Math.min(overview.unique_visitors, Math.max(catalog, overview.product_views)) },
    { step_key: "product_view", label: "3. Ürün İnceleme", count: overview.product_views },
    { step_key: "cart_intent", label: "4. Sepet / Seri Niyeti", count: overview.cart_additions },
    { step_key: "b2b_lead", label: "5. Üretici İletişimi / Talep", count: overview.b2b_leads },
    { step_key: "order", label: "6. Toptan Sipariş", count: overview.orders_count },
  ];

  return rawSteps.map((st, idx) => {
    const prevCount = idx === 0 ? st.count : rawSteps[idx - 1].count;
    const convStart = overview.unique_visitors > 0 ? (st.count / start) * 100 : 0;
    const dropPrev = idx > 0 && prevCount > 0 ? Math.max(0, ((prevCount - st.count) / prevCount) * 100) : 0;
    return {
      step_key: st.step_key,
      label: st.label,
      visitors_count: st.count,
      conversion_from_start_pct: convStart,
      drop_off_from_prev_pct: dropPrev,
    };
  });
}

function getLeadScoreTone(score: number): { label: string; badgeClass: string; barClass: string } {
  if (score >= 75) {
    return {
      label: "Ateşli Alıcı",
      badgeClass: "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
      barClass: "bg-emerald-500",
    };
  }
  if (score >= 45) {
    return {
      label: "Sıcak Niyet",
      badgeClass: "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
      barClass: "bg-amber-500",
    };
  }
  return {
    label: "Keşif Aşaması",
    badgeClass: "bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800",
    barClass: "bg-sky-500",
  };
}

function ConversionFunnelCard({ steps }: { readonly steps: BiFunnelStep[] }) {
  const maxVisitors = useMemo(() => {
    let m = 1;
    for (const s of steps) {
      if (s.visitors_count > m) m = s.visitors_count;
    }
    return m;
  }, [steps]);

  return (
    <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <Filter size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              6 Aşamalı B2B Toptan Dönüşüm Hunisi (Funnel Analizi)
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Ziyaretten siparişe kadar her adımdaki alıcı geçiş ve sızıntı (drop-off) oranları
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {steps.map((step, index) => {
          const widthPct = Math.max(6, Math.min(100, (step.visitors_count / maxVisitors) * 100));
          const isHighDropOff = index > 0 && step.drop_off_from_prev_pct >= 60;
          const dropTone = isHighDropOff
            ? "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800"
            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700";

          return (
            <div
              key={step.step_key || String(index)}
              className="p-3.5 rounded-2xl bg-zinc-50/70 dark:bg-zinc-950/40 border border-zinc-200/70 dark:border-zinc-800 flex flex-col gap-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-black text-[11px] flex items-center justify-center">
                    {index + 1}
                  </span>
                  <span className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                    {step.label}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-black text-zinc-900 dark:text-zinc-100 text-sm">
                    {step.visitors_count.toLocaleString("tr-TR")} Alıcı
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-bold text-[11px]">
                    Toplamın %{step.conversion_from_start_pct.toFixed(1)}&apos;i
                  </span>
                  {index > 0 && (
                    <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full border font-bold text-[11px] ${dropTone}`}>
                      <ArrowDown size={11} />
                      Kayıp %{step.drop_off_from_prev_pct.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>

              <div className="w-full h-3 rounded-full bg-zinc-200/70 dark:bg-zinc-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-emerald-500 transition-all duration-300"
                  style={{ width: `${widthPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HotBuyerLeadRow({ lead }: { readonly lead: BiHotBuyerLead }) {
  const scoreMeta = getLeadScoreTone(lead.lead_score);
  const displayName =
    lead.customer_name ||
    lead.customer_email ||
    `Anonim Alıcı #${lead.visitor_id.slice(-8)}`;
  const flag = getCountryFlagEmoji(lead.country_code);
  const countryName = getCountryLabelTr(lead.country_code);

  return (
    <tr className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors">
      <td className="py-3.5 px-4">
        <div className="flex items-start gap-2.5">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs ${
              lead.is_registered
                ? "bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
            }`}
          >
            {lead.is_registered ? <ShieldCheck size={16} /> : <Users size={15} />}
          </div>
          <div className="min-w-0">
            <div className="font-bold text-zinc-900 dark:text-zinc-100 text-xs truncate max-w-[210px]">
              {displayName}
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate max-w-[210px]">
              {lead.is_registered ? lead.customer_email || "Kayıtlı B2B Üye" : `Ziyaretçi ID: ${lead.visitor_id.slice(0, 14)}`}
            </div>
          </div>
        </div>
      </td>

      <td className="py-3.5 px-4">
        <div className="flex flex-col gap-1 min-w-[120px]">
          <div className="flex items-center justify-between gap-2">
            <span className="font-black text-zinc-900 dark:text-zinc-100 text-sm">
              {Math.round(lead.lead_score)} / 100
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${scoreMeta.badgeClass}`}>
              {scoreMeta.label}
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
            <div
              className={`h-full rounded-full ${scoreMeta.barClass}`}
              style={{ width: `${Math.min(100, Math.max(4, lead.lead_score))}%` }}
            />
          </div>
        </div>
      </td>

      <td className="py-3.5 px-4 whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200">
          <span className="text-base" title={countryName}>{flag}</span>
          <span>{lead.country_code || "TR"}</span>
          <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono text-[10px]">
            {(lead.language || "tr").toUpperCase()}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-mono text-[10px] font-bold">
            {(lead.currency || "TRY").toUpperCase()}
          </span>
        </div>
      </td>

      <td className="py-3.5 px-4 whitespace-nowrap text-xs text-zinc-700 dark:text-zinc-300">
        <div className="flex items-center gap-2 font-semibold">
          <span><strong>{lead.products_viewed}</strong> ürün</span>
          <span>•</span>
          <span className="text-amber-700 dark:text-amber-400"><strong>{lead.cart_adds}</strong> sepet</span>
          <span>•</span>
          <span className="text-emerald-700 dark:text-emerald-400"><strong>{lead.lead_actions}</strong> lead</span>
        </div>
        <div className="text-[11px] text-zinc-400 mt-0.5">
          Toplam odak: {formatDurationSec(lead.total_dwell_sec)} • {lead.referrer_host} ({lead.device_type})
        </div>
      </td>

      <td className="py-3.5 px-4">
        <div className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate max-w-[220px]" title={lead.last_action_title}>
          {lead.last_action_title || "Katalog gezintisi"}
        </div>
        <div className="text-[11px] text-zinc-400">
          {formatRelativeTimeTr(lead.last_seen_at)}
        </div>
      </td>

      <td className="py-3.5 px-4 text-right whitespace-nowrap">
        {lead.is_registered && lead.user_id ? (
          <Link
            href={`/admin/member-journeys?customer_id=${encodeURIComponent(lead.user_id)}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-colors"
          >
            <Compass size={13} />
            <span>Yolculuğu Aç</span>
          </Link>
        ) : (
          <span className="inline-flex items-center px-2.5 py-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
            Misafir Oturum
          </span>
        )}
      </td>
    </tr>
  );
}

export interface BiFunnelAndLeadsTabProps {
  readonly conversionFunnel: BiFunnelStep[];
  readonly hotBuyerLeads: BiHotBuyerLead[];
  readonly overview: BiOverviewMetrics;
}

export default function BiFunnelAndLeadsTab({
  conversionFunnel,
  hotBuyerLeads,
  overview,
}: BiFunnelAndLeadsTabProps) {
  const [filterMode, setFilterMode] = useState<BuyerFilterMode>("all");

  const funnelSteps = useMemo(() => {
    if (conversionFunnel.length > 0) return conversionFunnel;
    return buildFallbackFunnel(overview);
  }, [conversionFunnel, overview]);

  const filteredLeads = useMemo(() => {
    if (filterMode === "registered") {
      return hotBuyerLeads.filter((l) => l.is_registered);
    }
    if (filterMode === "anonymous") {
      return hotBuyerLeads.filter((l) => !l.is_registered);
    }
    return hotBuyerLeads;
  }, [hotBuyerLeads, filterMode]);

  const registeredCount = useMemo(
    () => hotBuyerLeads.filter((l) => l.is_registered).length,
    [hotBuyerLeads]
  );

  return (
    <div className="flex flex-col gap-6">
      {/* 6-Stage B2B Funnel */}
      <ConversionFunnelCard steps={funnelSteps} />

      {/* Hot Wholesale Buyer Lead Scoring Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Flame size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Sıcak Toptan Alıcı Madenciliği (0–100 Davranışsal Lead Skoru)
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Ürün inceleme derinliği, sepet serisi, odak süresi ve iletişim aksiyonlarına göre en yüksek alım niyetli alıcılar
              </p>
            </div>
          </div>

          <div className="inline-flex p-1 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-semibold self-start sm:self-auto">
            {[
              { id: "all" as const, label: `Tümü (${hotBuyerLeads.length})` },
              { id: "registered" as const, label: `Kayıtlı Üye (${registeredCount})` },
              { id: "anonymous" as const, label: `Anonim (${hotBuyerLeads.length - registeredCount})` },
            ].map((tab) => {
              const active = filterMode === tab.id;
              const cls = active
                ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs font-bold"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white";
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterMode(tab.id)}
                  className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${cls}`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/80 dark:bg-zinc-950/50 text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
                <th className="py-3 px-4">Toptan Alıcı Kimliği</th>
                <th className="py-3 px-4">Lead Skoru (0–100)</th>
                <th className="py-3 px-4">Ülke / Dil / Döviz</th>
                <th className="py-3 px-4">Davranış &amp; Niyet Sinyalleri</th>
                <th className="py-3 px-4">Son Etkileşim</th>
                <th className="py-3 px-4 text-right">CRM / Yolculuk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredLeads.map((lead, idx) => (
                <HotBuyerLeadRow key={`${lead.visitor_id}-${idx}`} lead={lead} />
              ))}
            </tbody>
          </table>

          {filteredLeads.length === 0 && (
            <div className="py-12 text-center text-xs text-zinc-400 flex flex-col items-center gap-2">
              <UserCheck size={24} className="text-zinc-300 dark:text-zinc-700" />
              <span>Bu filtrede henüz puanlanmış sıcak toptan alıcı kaydı bulunmuyor.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
