"use client";

import React, { useMemo, useState } from "react";
import {
  Flame,
  Globe2,
  Megaphone,
  Sparkles,
} from "lucide-react";
import {
  BiAttributionRow,
  BiGeoCurrencyRow,
  BiHourlyConversionCell,
  HeatmapCell,
  formatSourceMediumTr,
  getCountryLabelTr,
  translateChannelTr,
} from "./biTypes";
import CountryFlagBadge from "./CountryFlagBadge";

const DAY_NAMES = [
  "Pazar",
  "Pazartesi",
  "Salı",
  "Çarşamba",
  "Perşembe",
  "Cuma",
  "Cumartesi",
];
const ORDERED_DAYS = [1, 2, 3, 4, 5, 6, 0];

type HeatmapMetricMode = "visitors" | "pageviews" | "leads";

const PURPLE_TONES = [
  { threshold: 0.75, cls: "bg-violet-600 text-white font-bold" },
  { threshold: 0.5, cls: "bg-violet-500 text-white font-semibold" },
  { threshold: 0.25, cls: "bg-violet-300 text-violet-950 font-medium" },
];

const EMERALD_TONES = [
  { threshold: 0.75, cls: "bg-emerald-600 text-white font-bold" },
  { threshold: 0.5, cls: "bg-emerald-500 text-white font-semibold" },
  { threshold: 0.25, cls: "bg-emerald-300 text-emerald-950 font-medium" },
];

function getCellHeatTone(value: number, maxVal: number, mode: HeatmapMetricMode): string {
  if (value <= 0) {
    return "bg-zinc-100 hover:bg-zinc-200 text-transparent";
  }
  const ratio = maxVal > 0 ? value / maxVal : 0;
  const palette = mode === "leads" ? PURPLE_TONES : EMERALD_TONES;
  for (const stop of palette) {
    if (ratio > stop.threshold) {
      return stop.cls;
    }
  }
  return mode === "leads"
    ? "bg-violet-100 text-violet-900"
    : "bg-emerald-100 text-emerald-900";
}

function pickCellValue(cell: BiHourlyConversionCell | undefined, mode: HeatmapMetricMode): number {
  if (!cell) return 0;
  if (mode === "visitors") return cell.visitors;
  if (mode === "leads") return cell.leads;
  return cell.pageviews;
}

function GeoCurrencyMatrixCard({ rows }: { readonly rows: BiGeoCurrencyRow[] }) {
  return (
    <div className="bg-white rounded-3xl border border-zinc-200/80 shadow-xs overflow-hidden">
      <div className="p-6 border-b border-zinc-100 flex items-center gap-2.5">
        <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600">
          <Globe2 size={18} />
        </div>
        <div>
          <h2 className="text-sm font-bold text-zinc-900">
            Küresel İhracat Matrisi (Ülke × Dil × Tercih Edilen Döviz)
          </h2>
          <p className="text-xs text-zinc-500">
            Yurt dışı toptan alıcıların hangi ülke, dil ve para birimiyle katalog inceleyip talep oluşturduğu
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-50/80 text-[11px] font-bold uppercase tracking-wider text-zinc-500 border-b border-zinc-100">
              <th className="py-3 px-4">Hedef Ülke / Pazar</th>
              <th className="py-3 px-4">Dil &amp; Döviz Tercihi</th>
              <th className="py-3 px-4">Tekil Alıcı</th>
              <th className="py-3 px-4">Ürün İnceleme</th>
              <th className="py-3 px-4">B2B Talep</th>
              <th className="py-3 px-4">Dönüşüm Oranı</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 text-xs">
            {rows.map((row, idx) => {
              const countryLabel = getCountryLabelTr(row.country_code);
              const cleanCode = (row.country_code || "").trim().toUpperCase();
              const showIsoSuffix = cleanCode && cleanCode !== "XX" && cleanCode !== "UNKNOWN";

              return (
                <tr
                  key={`${row.country_code}-${row.top_currency}-${idx}`}
                  className="hover:bg-zinc-50/80 transition-colors"
                >
                  <td className="py-3.5 px-4 font-bold text-zinc-900 whitespace-nowrap">
                    <span className="inline-flex items-center gap-2">
                      <CountryFlagBadge countryCode={row.country_code} title={countryLabel} />
                      <span>{countryLabel}</span>
                      {showIsoSuffix ? (
                        <span className="text-[10px] font-mono text-zinc-400">
                          ({cleanCode})
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded-md bg-zinc-100 font-mono font-bold text-[11px] text-zinc-700 mr-1.5 uppercase">
                      {row.top_language}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 font-mono font-bold text-[11px] text-emerald-700 uppercase">
                      {row.top_currency}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-black text-zinc-900 tabular-nums">
                    {row.visitors.toLocaleString("tr-TR")}
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-zinc-700 tabular-nums">
                    {row.product_views.toLocaleString("tr-TR")}
                    <span className="text-[11px] text-zinc-400 ml-1">
                      ({row.pageviews.toLocaleString("tr-TR")} sayfa)
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-bold text-violet-700 tabular-nums">
                    {row.b2b_leads.toLocaleString("tr-TR")} Talep
                  </td>
                  <td className="py-3.5 px-4 min-w-[140px]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-emerald-700 tabular-nums">
                        %{row.conversion_rate_pct.toFixed(1)}
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${Math.min(100, Math.max(4, row.conversion_rate_pct * 4))}%` }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {rows.length === 0 && (
          <div className="py-12 text-center text-xs text-zinc-400">
            Bu periyotta ülke ve döviz kırılımı verisi bulunamadı.
          </div>
        )}
      </div>
    </div>
  );
}

function CampaignAttributionCard({ rows }: { readonly rows: BiAttributionRow[] }) {
  return (
    <div className="bg-white rounded-3xl border border-zinc-200/80 shadow-xs overflow-hidden">
      <div className="p-6 border-b border-zinc-100 flex items-center gap-2.5">
        <div className="p-2.5 rounded-2xl bg-violet-500/10 text-violet-600">
          <Megaphone size={18} />
        </div>
        <div>
          <h2 className="text-sm font-bold text-zinc-900">
            Kampanya Atıf (UTM) &amp; Dijital Reklam ROI Tablosu
          </h2>
          <p className="text-xs text-zinc-500">
            Google Ads (gclid), Meta (fbclid), Yandex (yclid), TikTok (ttclid), organik arama ve yönlendirme kanallarının B2B dönüşüm verimi
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-50/80 text-[11px] font-bold uppercase tracking-wider text-zinc-500 border-b border-zinc-100">
              <th className="py-3 px-4">Kanal &amp; Kaynak / Mecra</th>
              <th className="py-3 px-4">Kampanya</th>
              <th className="py-3 px-4">Ziyaretçi / Oturum</th>
              <th className="py-3 px-4">Hemen Çıkma</th>
              <th className="py-3 px-4">Ürün İnceleme</th>
              <th className="py-3 px-4 text-right">B2B Talep &amp; Oran</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 text-xs">
            {rows.map((row, idx) => {
              const channelLabel = translateChannelTr(row.channel);
              const sourceMediumLabel = formatSourceMediumTr(row.source, row.medium);
              const campaignLabel =
                !row.campaign || row.campaign === "-" || row.campaign === "(none)" || row.campaign === "(not set)"
                  ? "—"
                  : row.campaign;

              return (
                <tr
                  key={`${row.channel}-${row.source}-${row.campaign}-${idx}`}
                  className="hover:bg-zinc-50/80 transition-colors"
                >
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-zinc-900">
                        {channelLabel}
                      </span>
                      {row.has_paid_click_id && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black">
                          <Sparkles size={10} />
                          Reklam Tıklaması
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-medium text-zinc-500 mt-0.5">
                      {sourceMediumLabel}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-zinc-700 max-w-[200px] truncate" title={campaignLabel}>
                    {campaignLabel}
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap tabular-nums">
                    <strong className="text-zinc-900">
                      {row.visitors.toLocaleString("tr-TR")}
                    </strong>{" "}
                    <span className="text-zinc-400">/ {row.sessions.toLocaleString("tr-TR")} oturum</span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-bold tabular-nums ${
                        row.bounce_rate_pct <= 50
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-rose-50 text-rose-700"
                      }`}
                    >
                      %{row.bounce_rate_pct.toFixed(1)}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-zinc-700 tabular-nums">
                    {row.product_views.toLocaleString("tr-TR")}
                  </td>
                  <td className="py-3.5 px-4 text-right whitespace-nowrap tabular-nums">
                    <span className="font-black text-violet-700">
                      {row.b2b_leads.toLocaleString("tr-TR")} Talep
                    </span>
                    <span className="ml-2 px-2 py-0.5 rounded-md bg-violet-50 text-violet-700 font-bold text-[11px]">
                      %{row.lead_rate_pct.toFixed(1)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {rows.length === 0 && (
          <div className="py-12 text-center text-xs text-zinc-400">
            Bu periyotta UTM veya yönlendirme kanalı verisi bulunamadı.
          </div>
        )}
      </div>
    </div>
  );
}

function IstanbulConversionHeatmap({ cells }: { readonly cells: BiHourlyConversionCell[] }) {
  const [mode, setMode] = useState<HeatmapMetricMode>("visitors");
  const [activeInfo, setActiveInfo] = useState<{
    dayName: string;
    hour: number;
    visitors: number;
    pageviews: number;
    leads: number;
  } | null>(null);

  const lookup = useMemo(() => {
    const map = new Map<string, BiHourlyConversionCell>();
    let maxVal = 1;
    for (const c of cells) {
      map.set(`${c.day_of_week}-${c.hour_of_day}`, c);
      const val = pickCellValue(c, mode);
      if (val > maxVal) maxVal = val;
    }
    return { map, maxVal };
  }, [cells, mode]);

  return (
    <div className="bg-white p-6 rounded-3xl border border-zinc-200/80 shadow-xs flex flex-col gap-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600">
            <Flame size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-900">
              7×24 Saatlik Trafik &amp; Dönüşüm Isı Haritası (Europe/Istanbul - TSİ)
            </h2>
            <p className="text-xs text-zinc-500">
              Reklam bütçesini ve canlı destek vardiyasını alıcıların en aktif olduğu saatlere odaklayın
            </p>
          </div>
        </div>

        <div className="inline-flex p-1 rounded-2xl bg-zinc-100 border border-zinc-200 text-xs font-semibold self-start md:self-auto">
          {[
            { id: "visitors" as const, label: "Tekil Alıcı" },
            { id: "pageviews" as const, label: "Sayfa Gösterimi" },
            { id: "leads" as const, label: "B2B Talep" },
          ].map((opt) => {
            const active = mode === opt.id;
            const cls = active
              ? "bg-white text-zinc-900 shadow-xs font-bold"
              : "text-zinc-600 hover:text-zinc-900";
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setMode(opt.id)}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${cls}`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[86px_repeat(24,1fr)] gap-1 text-[10px] font-bold text-zinc-400 text-center mb-1">
            <div className="text-left pl-1">Gün / Saat</div>
            {Array.from({ length: 24 }).map((_, hour) => (
              <div key={hour}>{hour}</div>
            ))}
          </div>

          <div className="flex flex-col gap-1">
            {ORDERED_DAYS.map((dayIdx) => {
              const dayName = DAY_NAMES[dayIdx] || "Gün";
              return (
                <div key={dayIdx} className="grid grid-cols-[86px_repeat(24,1fr)] gap-1 items-center">
                  <div className="text-xs font-semibold text-zinc-700 pl-1 truncate">
                    {dayName}
                  </div>
                  {Array.from({ length: 24 }).map((_, hour) => {
                    const cell = lookup.map.get(`${dayIdx}-${hour}`);
                    const val = pickCellValue(cell, mode);
                    const tone = getCellHeatTone(val, lookup.maxVal, mode);

                    return (
                      <button
                        key={hour}
                        type="button"
                        onMouseEnter={() =>
                          setActiveInfo({
                            dayName,
                            hour,
                            visitors: cell?.visitors ?? 0,
                            pageviews: cell?.pageviews ?? 0,
                            leads: cell?.leads ?? 0,
                          })
                        }
                        onClick={() =>
                          setActiveInfo({
                            dayName,
                            hour,
                            visitors: cell?.visitors ?? 0,
                            pageviews: cell?.pageviews ?? 0,
                            leads: cell?.leads ?? 0,
                          })
                        }
                        className={`h-7 rounded-md transition-all flex items-center justify-center text-[10px] cursor-pointer ${tone}`}
                        title={`${dayName} ${hour}:00 — ${cell?.visitors ?? 0} tekil, ${cell?.pageviews ?? 0} gösterim, ${cell?.leads ?? 0} talep`}
                      >
                        {val > 0 ? val : ""}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200 text-xs flex items-center justify-between">
        {activeInfo ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-zinc-900">
              {activeInfo.dayName} {String(activeInfo.hour).padStart(2, "0")}:00 (TSİ):
            </span>
            <span className="text-emerald-700 font-black">
              {activeInfo.visitors} Tekil Alıcı
            </span>
            <span>•</span>
            <span className="text-zinc-700 font-semibold">
              {activeInfo.pageviews} Gösterim
            </span>
            <span>•</span>
            <span className="text-violet-700 font-black">
              {activeInfo.leads} B2B Talep
            </span>
          </div>
        ) : (
          <span className="text-zinc-400">
            Saatlik tekil alıcı, sayfa gösterimi ve B2B talep detayını görmek için bir hücrenin üzerine gelin.
          </span>
        )}
      </div>
    </div>
  );
}

export interface BiGeoAndAttributionTabProps {
  readonly geoCurrencyMatrix: BiGeoCurrencyRow[];
  readonly acquisitionAttribution: BiAttributionRow[];
  readonly hourlyHeatmap: BiHourlyConversionCell[];
  readonly fallbackStatsHeatmap: HeatmapCell[];
}

export default function BiGeoAndAttributionTab({
  geoCurrencyMatrix,
  acquisitionAttribution,
  hourlyHeatmap,
  fallbackStatsHeatmap,
}: BiGeoAndAttributionTabProps) {
  const effectiveHeatmap = useMemo<BiHourlyConversionCell[]>(() => {
    if (hourlyHeatmap.length > 0) return hourlyHeatmap;
    return fallbackStatsHeatmap.map((h) => ({
      day_of_week: h.day,
      hour_of_day: h.hour,
      visitors: h.visitors,
      pageviews: h.views,
      leads: 0,
    }));
  }, [hourlyHeatmap, fallbackStatsHeatmap]);

  return (
    <div className="flex flex-col gap-6">
      <GeoCurrencyMatrixCard rows={geoCurrencyMatrix} />
      <CampaignAttributionCard rows={acquisitionAttribution} />
      <IstanbulConversionHeatmap cells={effectiveHeatmap} />
    </div>
  );
}
