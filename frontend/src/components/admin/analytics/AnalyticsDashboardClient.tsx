"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { useAdmin } from "@/context/AdminContext";
import {
  AnalyticsStatsResponse,
  BiMiningResponse,
  BiPeriod,
  BiTabId,
  exportBiSummaryCsv,
  exportBiSummaryJson,
  normalizeBiMiningResponse,
  normalizeStatsResponse,
  resolveOpportunityDiagnosis,
} from "./biTypes";
import BiHeaderBar from "./BiHeaderBar";
import BiOverviewTab from "./BiOverviewTab";
import BiFunnelAndLeadsTab from "./BiFunnelAndLeadsTab";
import BiSearchMiningTab from "./BiSearchMiningTab";
import BiGeoAndAttributionTab from "./BiGeoAndAttributionTab";
import BiCatalogAndPagesTab from "./BiCatalogAndPagesTab";
import BiTechAndBotMonitorTab from "./BiTechAndBotMonitorTab";
import WhatsappClicksPanel from "./WhatsappClicksPanel";

export type {
  AnalyticsSummary,
  DailyTrendPoint,
  HeatmapCell,
  TopItemCount,
  RecentActivityEvent,
  AnalyticsStatsResponse,
  BiMiningResponse,
  BiPeriod,
  BiTabId,
} from "./biTypes";

async function fetchWithRouteFallback(
  fetchFn: (path: string) => Promise<Response>,
  primaryPath: string,
  fallbackPath: string
): Promise<Response> {
  const primaryRes = await fetchFn(primaryPath);
  if (primaryRes.status === 404) {
    return fetchFn(fallbackPath);
  }
  return primaryRes;
}

export default function AnalyticsDashboardClient() {
  const { fetchWithConfig } = useAdmin();
  const [period, setPeriod] = useState<BiPeriod>("7d");
  const [activeTab, setActiveTab] = useState<BiTabId>("overview");
  const [loading, setLoading] = useState<boolean>(true);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  const [biData, setBiData] = useState<BiMiningResponse>(() =>
    normalizeBiMiningResponse({}, "7d")
  );
  const [statsData, setStatsData] = useState<AnalyticsStatsResponse>(() =>
    normalizeStatsResponse({}, "7d")
  );

  useEffect(() => {
    let cancelled = false;

    async function loadAnalyticsSuite() {
      setErrorBanner(null);
      const statsPeriod = period === "90d" ? "30d" : period;

      try {
        const [biRes, statsRes] = await Promise.all([
          fetchWithRouteFallback(
            fetchWithConfig,
            `/api/v1/analytics/bi-mining?period=${period}`,
            `/api/v1/admin/analytics/bi-mining?period=${period}`
          ),
          fetchWithRouteFallback(
            fetchWithConfig,
            `/api/v1/analytics/stats?period=${statsPeriod}`,
            `/api/v1/admin/analytics/stats?period=${statsPeriod}`
          ),
        ]);

        if (cancelled) return;

        if (biRes.ok) {
          const rawBi: unknown = await biRes.json();
          setBiData(normalizeBiMiningResponse(rawBi, period));
        } else if (!statsRes.ok) {
          setErrorBanner("İş zekası ve telemetri servisine bağlanırken bir hata oluştu.");
        }

        if (statsRes.ok) {
          const rawStats: unknown = await statsRes.json();
          setStatsData(normalizeStatsResponse(rawStats, statsPeriod));
        }
      } catch (err) {
        if (!cancelled) {
          console.error("BI & Analitik verileri yüklenemedi:", err);
          setErrorBanner("Sunucu bağlantısı kurulamadı. Lütfen tekrar deneyin.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadAnalyticsSuite();

    return () => {
      cancelled = true;
    };
  }, [period, refreshTrigger, fetchWithConfig]);

  const handlePeriodChange = useCallback((nextPeriod: BiPeriod) => {
    setLoading(true);
    setPeriod(nextPeriod);
  }, []);

  const handleRefresh = useCallback(() => {
    setLoading(true);
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  const handleExportCsv = useCallback(() => {
    exportBiSummaryCsv(biData, period);
  }, [biData, period]);

  const handleExportJson = useCallback(() => {
    exportBiSummaryJson(biData, period);
  }, [biData, period]);

  const liveVisitorsCount =
    biData.overview.live_visitors_15m || statsData.summary.live_visitors_last_15m || 0;

  const opportunityProductsCount = useMemo(
    () =>
      biData.product_and_brand_velocity.hot_products.filter(
        (p) => resolveOpportunityDiagnosis(p).isWarning
      ).length,
    [biData.product_and_brand_velocity.hot_products]
  );

  function renderActiveTab() {
    if (activeTab === "funnel") {
      return (
        <BiFunnelAndLeadsTab
          conversionFunnel={biData.conversion_funnel}
          hotBuyerLeads={biData.hot_buyer_leads}
          overview={biData.overview}
        />
      );
    }
    if (activeTab === "search") {
      return <BiSearchMiningTab searchMining={biData.search_mining} />;
    }
    if (activeTab === "geo") {
      return (
        <BiGeoAndAttributionTab
          geoCurrencyMatrix={biData.geo_currency_matrix}
          acquisitionAttribution={biData.acquisition_attribution}
          hourlyHeatmap={biData.web_vitals_and_tech.hourly_conversion_heatmap}
          fallbackStatsHeatmap={statsData.heatmap}
        />
      );
    }
    if (activeTab === "catalog") {
      return (
        <BiCatalogAndPagesTab
          velocity={biData.product_and_brand_velocity}
          pageIntelligence={biData.page_intelligence}
        />
      );
    }
    if (activeTab === "tech") {
      return (
        <BiTechAndBotMonitorTab
          webVitalsAndTech={biData.web_vitals_and_tech}
          botCrawlMonitor={biData.bot_crawl_monitor}
        />
      );
    }
    if (activeTab === "whatsapp") {
      return <WhatsappClicksPanel embedded initialPeriod={period} />;
    }
    return (
      <BiOverviewTab
        overview={{
          ...biData.overview,
          live_visitors_15m: liveVisitorsCount,
        }}
        dailySeries={biData.daily_series}
        recentEvents={statsData.recent_events}
        topReferrers={statsData.top_referrers}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      <BiHeaderBar
        period={period}
        onPeriodChange={handlePeriodChange}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        loading={loading}
        onRefresh={handleRefresh}
        onExportCsv={handleExportCsv}
        onExportJson={handleExportJson}
        liveVisitors={liveVisitorsCount}
        hotLeadsCount={biData.hot_buyer_leads.length}
        zeroResultCount={biData.search_mining.zero_result_searches.length}
        opportunityProductsCount={opportunityProductsCount}
      />

      {errorBanner && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2.5">
          <AlertCircle size={16} className="shrink-0" />
          <span>{errorBanner}</span>
        </div>
      )}

      {loading && biData.overview.unique_visitors === 0 && statsData.summary.total_visitors === 0 ? (
        <div className="py-16 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 flex flex-col items-center justify-center gap-3 text-zinc-500">
          <Loader2 size={26} className="animate-spin text-emerald-600" />
          <span className="text-xs font-bold uppercase tracking-wider">
            BI &amp; Veri Madenciliği Motoru Yükleniyor...
          </span>
        </div>
      ) : (
        renderActiveTab()
      )}
    </div>
  );
}
