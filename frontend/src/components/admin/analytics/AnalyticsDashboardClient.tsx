"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { 
  Users, 
  Eye, 
  TrendingUp, 
  Clock, 
  RefreshCw, 
  Compass, 
  Globe2, 
  Smartphone, 
  Monitor, 
  ExternalLink,
  Flame,
  Radio
} from "lucide-react";
import { useAdmin } from "@/context/AdminContext";

export interface AnalyticsSummary {
  total_visitors: number;
  total_pageviews: number;
  avg_pages_per_visitor: number;
  today_visitors: number;
  today_pageviews: number;
  live_visitors_last_15m: number;
}

export interface DailyTrendPoint {
  date: string;
  visitors: number;
  pageviews: number;
}

export interface HeatmapCell {
  day: number; // 0 = Sunday, 1 = Monday ... 6 = Saturday
  hour: number; // 0 - 23
  views: number;
  visitors: number;
}

export interface TopItemCount {
  name: string;
  views: number;
  visitors: number;
  percentage: number;
}

export interface RecentActivityEvent {
  path: string;
  referrer_host: string;
  device_type: string;
  language: string;
  created_at: string;
}

export interface AnalyticsStatsResponse {
  period: string;
  summary: AnalyticsSummary;
  daily_trend: DailyTrendPoint[];
  heatmap: HeatmapCell[];
  top_referrers: TopItemCount[];
  top_pages: TopItemCount[];
  devices: TopItemCount[];
  languages: TopItemCount[];
  recent_events: RecentActivityEvent[];
}

const DAY_NAMES = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
// Reorder days starting from Monday for standard business week
const ORDERED_DAYS = [1, 2, 3, 4, 5, 6, 0];

interface AnalyticsHeaderProps {
  period: string;
  onPeriodChange: (p: string) => void;
  loading: boolean;
  onRefresh: () => void;
  liveVisitors: number;
}

function AnalyticsHeader(props: Readonly<AnalyticsHeaderProps>) {
  const { period, onPeriodChange, loading, onRefresh, liveVisitors } = props;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-zinc-200/80 shadow-xs">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-black text-zinc-900 tracking-tight">
            Ziyaretçi & Trafik Analitiği
          </h1>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
            <Radio size={14} className="animate-pulse text-emerald-600" />
            <span>{liveVisitors} Canlı Ziyaretçi</span>
          </div>
        </div>
        <p className="text-xs text-zinc-500 mt-1">
          Mağaza tekil ziyaretçileri, yönlendiren linkler, cihazlar ve 7x24 saatlik yoğunluk haritası.
        </p>
      </div>

      <div className="flex items-center gap-2 self-start sm:self-auto">
        <div className="inline-flex p-1 rounded-2xl bg-zinc-100 border border-zinc-200 text-xs font-semibold">
          {[
            { id: "today", label: "Bugün" },
            { id: "24h", label: "24 Saat" },
            { id: "7d", label: "Son 7 Gün" },
            { id: "30d", label: "Son 30 Gün" },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onPeriodChange(item.id)}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                period === item.id
                  ? "bg-white text-zinc-900 shadow-xs font-bold"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="p-2.5 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-600 transition-all cursor-pointer disabled:opacity-50"
          title="Yenile"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>
    </div>
  );
}

interface AnalyticsKpiCardsProps {
  summary: AnalyticsSummary;
}

function AnalyticsKpiCards(props: Readonly<AnalyticsKpiCardsProps>) {
  const { summary } = props;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-white p-5 rounded-3xl border border-zinc-200/80 shadow-xs flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider block">
            Tekil Ziyaretçi (Unique)
          </span>
          <div className="text-2xl font-black text-zinc-900 mt-1">
            {summary.total_visitors.toLocaleString("tr-TR")}
          </div>
          <span className="text-[11px] text-zinc-400 mt-0.5 block">
            Bugün: {summary.today_visitors.toLocaleString("tr-TR")} tekil
          </span>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
          <Users size={24} />
        </div>
      </div>

      <div className="bg-white p-5 rounded-3xl border border-zinc-200/80 shadow-xs flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider block">
            Sayfa Görüntüleme
          </span>
          <div className="text-2xl font-black text-zinc-900 mt-1">
            {summary.total_pageviews.toLocaleString("tr-TR")}
          </div>
          <span className="text-[11px] text-zinc-400 mt-0.5 block">
            Bugün: {summary.today_pageviews.toLocaleString("tr-TR")} gösterim
          </span>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
          <Eye size={24} />
        </div>
      </div>

      <div className="bg-white p-5 rounded-3xl border border-zinc-200/80 shadow-xs flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider block">
            Sayfa / Ziyaretçi Oranı
          </span>
          <div className="text-2xl font-black text-zinc-900 mt-1">
            {summary.avg_pages_per_visitor.toFixed(1)}
          </div>
          <span className="text-[11px] text-emerald-600 font-semibold mt-0.5 block">
            Ziyaretçi başına ortalama
          </span>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
          <TrendingUp size={24} />
        </div>
      </div>

      <div className="bg-white p-5 rounded-3xl border border-zinc-200/80 shadow-xs flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider block">
            Son 15 Dakika (Canlı)
          </span>
          <div className="text-2xl font-black text-zinc-900 mt-1">
            {summary.live_visitors_last_15m}
          </div>
          <span className="text-[11px] text-violet-600 font-semibold mt-0.5 block">
            Aktif gezinen kullanıcı
          </span>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-violet-500/10 text-violet-600 flex items-center justify-center">
          <Clock size={24} />
        </div>
      </div>
    </div>
  );
}

interface AnalyticsHeatmapMatrixProps {
  heatmap: HeatmapCell[];
}

function getHeatmapColor(count: number, maxCount: number): string {
  if (count === 0) return "bg-zinc-100 hover:bg-zinc-200 text-transparent";
  const ratio = maxCount > 0 ? count / maxCount : 0;
  if (ratio > 0.75) return "bg-emerald-600 text-white font-bold";
  if (ratio > 0.5) return "bg-emerald-500 text-white font-semibold";
  if (ratio > 0.25) return "bg-emerald-300 text-emerald-950 font-medium";
  return "bg-emerald-100 text-emerald-900";
}

function AnalyticsHeatmapMatrix(props: Readonly<AnalyticsHeatmapMatrixProps>) {
  const { heatmap } = props;
  const [activeCell, setActiveCell] = useState<{ dayName: string; hour: number; views: number; visitors: number } | null>(null);

  // Map heatmap data by key `${day}-${hour}`
  const heatMapLookup = React.useMemo(() => {
    const map = new Map<string, HeatmapCell>();
    let maxViews = 1;
    for (const cell of heatmap) {
      map.set(`${cell.day}-${cell.hour}`, cell);
      if (cell.views > maxViews) maxViews = cell.views;
    }
    return { map, maxViews };
  }, [heatmap]);

  return (
    <div className="bg-white p-6 rounded-3xl border border-zinc-200/80 shadow-xs flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 font-bold">
            <Flame size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-900">
              7 Günlük / 24 Saatlik Ziyaretçi Yoğunluk Haritası (Heatmap)
            </h2>
            <p className="text-xs text-zinc-500">
              Kullanıcıların siteyi günün hangi saatlerinde yoğun ziyaret ettiğini gösterir.
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 self-start sm:self-auto text-[11px] text-zinc-500 font-medium">
          <span>Düşük</span>
          <span className="w-3.5 h-3.5 rounded bg-zinc-100 border border-zinc-200 inline-block" />
          <span className="w-3.5 h-3.5 rounded bg-emerald-100 inline-block" />
          <span className="w-3.5 h-3.5 rounded bg-emerald-300 inline-block" />
          <span className="w-3.5 h-3.5 rounded bg-emerald-500 inline-block" />
          <span className="w-3.5 h-3.5 rounded bg-emerald-600 inline-block" />
          <span>Yüksek</span>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="overflow-x-auto pb-2">
        <div className="min-w-[760px]">
          {/* Hour labels header */}
          <div className="grid grid-cols-[80px_repeat(24,1fr)] gap-1 text-[10px] font-bold text-zinc-400 text-center mb-1">
            <div className="text-left pl-1">Gün / Saat</div>
            {Array.from({ length: 24 }).map((_, h) => (
              <div key={h}>{h}</div>
            ))}
          </div>

          {/* Days rows */}
          <div className="flex flex-col gap-1">
            {ORDERED_DAYS.map((dayIdx) => {
              const dayName = DAY_NAMES[dayIdx];
              return (
                <div key={dayIdx} className="grid grid-cols-[80px_repeat(24,1fr)] gap-1 items-center">
                  <div className="text-xs font-semibold text-zinc-700 pl-1 truncate">
                    {dayName}
                  </div>
                  {Array.from({ length: 24 }).map((_, hour) => {
                    const cell = heatMapLookup.map.get(`${dayIdx}-${hour}`);
                    const views = cell?.views || 0;
                    const visitors = cell?.visitors || 0;
                    const colorClass = getHeatmapColor(views, heatMapLookup.maxViews);

                    return (
                      <button
                        key={hour}
                        type="button"
                        onMouseEnter={() => setActiveCell({ dayName, hour, views, visitors })}
                        onClick={() => setActiveCell({ dayName, hour, views, visitors })}
                        className={`h-7 rounded-md transition-all flex items-center justify-center text-[10px] cursor-pointer ${colorClass}`}
                        title={`${dayName} ${hour}:00 - ${views} görüntüleme, ${visitors} tekil`}
                      >
                        {views > 0 ? views : ""}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected Cell Detail Info */}
      <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200 text-xs flex items-center justify-between">
        {activeCell ? (
          <div>
            <span className="font-bold text-zinc-900">{activeCell.dayName} saat {activeCell.hour}:00:</span>{" "}
            <span className="text-emerald-700 font-black">{activeCell.views} Sayfa Görüntüleme</span> •{" "}
            <span className="text-zinc-600 font-semibold">{activeCell.visitors} Tekil Ziyaretçi</span>
          </div>
        ) : (
          <div className="text-zinc-400">
            Ayrıntılı görüntüleme ve tekil ziyaretçi sayısını görmek için ısı haritasındaki bir kutunun üzerine gelin.
          </div>
        )}
      </div>
    </div>
  );
}

interface AnalyticsTopListsProps {
  topReferrers: TopItemCount[];
  topPages: TopItemCount[];
}

function AnalyticsTopLists(props: Readonly<AnalyticsTopListsProps>) {
  const { topReferrers, topPages } = props;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Top Referrers */}
      <div className="bg-white p-6 rounded-3xl border border-zinc-200/80 shadow-xs flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-violet-500/10 text-violet-600 font-bold">
            <Compass size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-900">
              Yönlendiren URL&apos;ler ve Trafik Kaynakları (Referrers)
            </h2>
            <p className="text-xs text-zinc-500">Ziyaretçilerin hangi web sitelerinden geldiği</p>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          {topReferrers.map((ref) => (
            <div key={ref.name} className="flex flex-col gap-1 p-2 rounded-xl hover:bg-zinc-50 transition-colors">
              <div className="flex items-center justify-between text-xs font-semibold text-zinc-800">
                <span className="truncate max-w-[240px] font-bold text-zinc-900">{ref.name}</span>
                <span className="text-zinc-500">
                  {ref.views} gösterim ({ref.visitors} tekil • %{ref.percentage.toFixed(1)})
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                <div
                  className="h-full bg-violet-600 rounded-full"
                  style={{ width: `${Math.min(100, Math.max(4, ref.percentage))}%` }}
                />
              </div>
            </div>
          ))}

          {topReferrers.length === 0 && (
            <div className="py-8 text-center text-xs text-zinc-400">
              Bu periyotta henüz yönlendirme verisi kaydedilmedi.
            </div>
          )}
        </div>
      </div>

      {/* Top Visited Pages */}
      <div className="bg-white p-6 rounded-3xl border border-zinc-200/80 shadow-xs flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 font-bold">
            <Eye size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-900">
              En Çok Ziyaret Edilen Sayfalar
            </h2>
            <p className="text-xs text-zinc-500">Kullanıcıların en fazla incelediği sayfalar</p>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          {topPages.map((pg) => (
            <div key={pg.name} className="flex flex-col gap-1 p-2 rounded-xl hover:bg-zinc-50 transition-colors">
              <div className="flex items-center justify-between text-xs font-semibold text-zinc-800">
                <Link
                  href={pg.name}
                  target="_blank"
                  className="truncate max-w-[280px] font-mono font-medium text-amber-700 hover:text-amber-600 inline-flex items-center gap-1"
                >
                  {pg.name}
                  <ExternalLink size={11} />
                </Link>
                <span className="text-zinc-500">
                  {pg.views} gösterim ({pg.visitors} tekil)
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{ width: `${Math.min(100, Math.max(4, pg.percentage))}%` }}
                />
              </div>
            </div>
          ))}

          {topPages.length === 0 && (
            <div className="py-8 text-center text-xs text-zinc-400">
              Bu periyotta henüz sayfa ziyareti kaydedilmedi.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface AnalyticsBreakdownAndLiveFeedProps {
  devices: TopItemCount[];
  languages: TopItemCount[];
  recentEvents: RecentActivityEvent[];
}

function getDeviceLabel(name: string): string {
  if (name === "mobile") return "Mobil";
  if (name === "desktop") return "Masaüstü";
  return "Tablet";
}

function AnalyticsBreakdownAndLiveFeed(props: Readonly<AnalyticsBreakdownAndLiveFeedProps>) {
  const { devices, languages, recentEvents } = props;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Device & Language Breakdown */}
      <div className="bg-white p-6 rounded-3xl border border-zinc-200/80 shadow-xs flex flex-col gap-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Smartphone size={16} className="text-zinc-600" />
            <h2 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">Cihaz Türü</h2>
          </div>
          <div className="flex flex-col gap-2">
            {devices.map((d) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <span className="capitalize font-semibold text-zinc-800 flex items-center gap-1.5">
                  {d.name === "mobile" ? <Smartphone size={14} /> : <Monitor size={14} />}
                  {getDeviceLabel(d.name)}
                </span>
                <span className="font-bold text-zinc-900">
                  %{d.percentage.toFixed(1)} ({d.views})
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-zinc-100">
          <div className="flex items-center gap-2 mb-3">
            <Globe2 size={16} className="text-zinc-600" />
            <h2 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">Dil Dağılımı</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {languages.map((l) => (
              <span
                key={l.name}
                className="px-2.5 py-1 rounded-xl bg-zinc-100 border border-zinc-200 text-xs font-bold text-zinc-800"
              >
                {l.name}: {l.views} (%{l.percentage.toFixed(0)})
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Real-time Recent Activity Feed */}
      <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-zinc-200/80 shadow-xs flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
            <Clock size={16} className="text-zinc-500" />
            Canlı Ziyaretçi Akışı (Son 20 Olay)
          </h2>
          <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            Gerçek Zamanlı
          </span>
        </div>

        <div className="divide-y divide-zinc-100 overflow-y-auto max-h-[280px]">
          {recentEvents.map((ev, idx) => (
            <div key={`${ev.path}-${ev.created_at}-${idx}`} className="py-2.5 flex items-center justify-between text-xs gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="px-1.5 py-0.5 rounded-md bg-zinc-100 font-mono text-[10px] font-bold text-zinc-700">
                  {ev.language.toUpperCase()}
                </span>
                <span className="font-mono text-zinc-800 truncate max-w-[260px]" title={ev.path}>
                  {ev.path}
                </span>
              </div>
              <div className="flex items-center gap-3 text-zinc-400 text-[11px] shrink-0">
                <span className="text-zinc-500 hidden sm:inline">{ev.referrer_host}</span>
                <span className="capitalize">{ev.device_type}</span>
                <span className="font-mono">{new Date(ev.created_at).toLocaleTimeString("tr-TR")}</span>
              </div>
            </div>
          ))}

          {recentEvents.length === 0 && (
            <div className="py-8 text-center text-xs text-zinc-400">
              Henüz canlı ziyaretçi olayı kaydedilmedi.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsDashboardClient() {
  const { fetchWithConfig } = useAdmin();
  const [period, setPeriod] = useState<string>("7d");
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [data, setData] = useState<AnalyticsStatsResponse | null>(null);

  useEffect(() => {
    let ignore = false;

    async function fetchData() {
      try {
        const res = await fetchWithConfig(`/api/v1/admin/analytics/stats?period=${period}`);
        if (res.ok && !ignore) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.error("Analitik verileri yüklenemedi:", err);
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void fetchData();

    return () => {
      ignore = true;
    };
  }, [period, refreshTrigger, fetchWithConfig]);

  const handlePeriodChange = useCallback((newPeriod: string) => {
    setLoading(true);
    setPeriod(newPeriod);
  }, []);

  const handleRefresh = useCallback(() => {
    setLoading(true);
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  const defaultSummary: AnalyticsSummary = {
    total_visitors: 0,
    total_pageviews: 0,
    avg_pages_per_visitor: 0,
    today_visitors: 0,
    today_pageviews: 0,
    live_visitors_last_15m: 0,
  };

  const summary = data?.summary || defaultSummary;

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      <AnalyticsHeader
        period={period}
        onPeriodChange={handlePeriodChange}
        loading={loading}
        onRefresh={handleRefresh}
        liveVisitors={summary.live_visitors_last_15m}
      />

      <AnalyticsKpiCards summary={summary} />

      <AnalyticsHeatmapMatrix heatmap={data?.heatmap || []} />

      <AnalyticsTopLists
        topReferrers={data?.top_referrers || []}
        topPages={data?.top_pages || []}
      />

      <AnalyticsBreakdownAndLiveFeed
        devices={data?.devices || []}
        languages={data?.languages || []}
        recentEvents={data?.recent_events || []}
      />
    </div>
  );
}
