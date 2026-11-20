"use client";

import React, { useCallback, useEffect, useState } from "react";
import { AlertCircle, Download, FileJson, Loader2, Radar, RefreshCw } from "lucide-react";
import { useAdmin } from "@/context/AdminContext";
import type { BiPeriod } from "./biTypes";
import TrafficCrawlVsVisitHero from "./TrafficCrawlVsVisitHero";
import TrafficSourcesBreakdownGrid from "./TrafficSourcesBreakdownGrid";
import TrafficKeywordsAndIntentSection from "./TrafficKeywordsAndIntentSection";
import {
  TrafficSourcesReportResponse,
  exportTrafficSourcesCsv,
  exportTrafficSourcesJson,
  normalizeTrafficSourcesResponse,
} from "./trafficSourcesTypes";

const PERIOD_OPTIONS: ReadonlyArray<{ id: BiPeriod; label: string }> = [
  { id: "today", label: "Bugün" },
  { id: "24h", label: "24 Saat" },
  { id: "7d", label: "Son 7 Gün" },
  { id: "30d", label: "Son 30 Gün" },
  { id: "90d", label: "Son 90 Gün" },
];

export interface TrafficSourcesPanelProps {
  readonly embedded?: boolean;
  readonly externalPeriod?: BiPeriod;
}

export default function TrafficSourcesPanel({
  embedded = false,
  externalPeriod,
}: TrafficSourcesPanelProps) {
  const { fetchWithConfig } = useAdmin();
  const [localPeriod, setLocalPeriod] = useState<BiPeriod>(externalPeriod ?? "7d");
  const effectivePeriod = embedded && externalPeriod ? externalPeriod : localPeriod;

  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState<number>(0);
  const [report, setReport] = useState<TrafficSourcesReportResponse>(() =>
    normalizeTrafficSourcesResponse({}, effectivePeriod)
  );

  useEffect(() => {
    let cancelled = false;

    async function loadTrafficReport() {
      setLoading(true);
      setErrorMsg(null);
      try {
        let res = await fetchWithConfig(
          `/api/v1/analytics/traffic-sources?period=${effectivePeriod}`
        );
        if (res.status === 404) {
          res = await fetchWithConfig(
            `/api/v1/admin/analytics/traffic-sources?period=${effectivePeriod}`
          );
        }
        if (cancelled) return;

        if (!res.ok) {
          setErrorMsg("Trafik kaynakları ve AI bot raporu yüklenirken bir hata oluştu.");
          return;
        }
        const rawJson: unknown = await res.json();
        if (!cancelled) {
          setReport(normalizeTrafficSourcesResponse(rawJson, effectivePeriod));
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Traffic sources report fetch failed:", err);
          setErrorMsg("Sunucu bağlantısı kurulamadı. Lütfen tekrar deneyin.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadTrafficReport();
    return () => {
      cancelled = true;
    };
  }, [effectivePeriod, refreshTick, fetchWithConfig]);

  const handleRefresh = useCallback(() => {
    setRefreshTick((prev) => prev + 1);
  }, []);

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      {!embedded && (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs p-5 sm:p-6 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Radar size={20} />
            </div>
            <div>
              <h1 className="text-xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
                AI Bot &amp; Trafik Kaynakları İstihbaratı
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Yapay zeka botları (GPTBot, OAI-SearchBot, Claude, Perplexity) ile Google taramalarını, gelen ziyaret kaynaklarını ve giriş kelimesi/konu niyetlerini analiz edin.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex p-1 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-semibold">
              {PERIOD_OPTIONS.map((opt) => {
                const active = localPeriod === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setLocalPeriod(opt.id)}
                    className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                      active
                        ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs font-bold"
                        : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => exportTrafficSourcesCsv(report)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-50 text-xs font-bold text-zinc-700 dark:text-zinc-200 cursor-pointer"
            >
              <Download size={14} className="text-emerald-600" />
              <span>CSV</span>
            </button>

            <button
              type="button"
              onClick={() => exportTrafficSourcesJson(report)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-50 text-xs font-bold text-zinc-700 dark:text-zinc-200 cursor-pointer"
            >
              <FileJson size={14} className="text-violet-600" />
              <span>JSON</span>
            </button>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-50 text-xs font-bold text-zinc-700 dark:text-zinc-200 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? "animate-spin text-emerald-600" : ""} />
              <span>Yenile</span>
            </button>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
          <AlertCircle size={16} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading && report.hero.total_bot_requests === 0 && report.hero.total_human_sessions === 0 ? (
        <div className="py-16 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 flex flex-col items-center justify-center gap-3 text-zinc-500">
          <Loader2 size={26} className="animate-spin text-rose-500" />
          <span className="text-xs font-bold uppercase tracking-wider">
            AI Bot &amp; Trafik Kaynağı İstatistikleri Yükleniyor...
          </span>
        </div>
      ) : (
        <>
          <TrafficCrawlVsVisitHero
            hero={report.hero}
            dateRangeLabel={report.date_range_label}
            dailyComparison={report.daily_comparison}
          />

          <TrafficSourcesBreakdownGrid
            visitChannels={report.visit_channels}
            topSources={report.top_sources}
            crawlerGroups={report.crawler_groups}
            topCrawlers={report.top_crawlers}
            topCrawledPaths={report.top_crawled_paths}
            topCountries={report.top_countries}
          />

          <TrafficKeywordsAndIntentSection
            landingIntents={report.landing_intents}
            arrivalKeywords={report.arrival_keywords}
            internalKeywords={report.internal_keywords}
          />
        </>
      )}
    </div>
  );
}
