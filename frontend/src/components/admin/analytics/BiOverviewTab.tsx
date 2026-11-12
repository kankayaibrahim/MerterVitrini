"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  Compass,
  Eye,
  MessageSquareQuote,
  MousePointerClick,
  Package,
  ShoppingCart,
  TrendingUp,
  UserCheck,
  Users,
  LucideIcon,
} from "lucide-react";
import {
  BiDailySeriesPoint,
  BiOverviewMetrics,
  RecentActivityEvent,
  TopItemCount,
  formatCurrencyTry,
  formatDurationSec,
} from "./biTypes";

type TrendMetricKey = "visitors" | "product_views" | "cart_adds" | "leads";

interface TrendMetricConfig {
  key: TrendMetricKey;
  label: string;
  barClass: string;
  dotClass: string;
}

const TREND_METRICS: TrendMetricConfig[] = [
  { key: "visitors", label: "Tekil Ziyaretçi", barClass: "bg-emerald-500", dotClass: "bg-emerald-500" },
  { key: "product_views", label: "Ürün İnceleme", barClass: "bg-blue-500", dotClass: "bg-blue-500" },
  { key: "cart_adds", label: "Sepete Ekleme", barClass: "bg-amber-500", dotClass: "bg-amber-500" },
  { key: "leads", label: "B2B Talep / Lead", barClass: "bg-violet-600", dotClass: "bg-violet-600" },
];

interface DeltaBadgeProps {
  readonly deltaPct: number;
  readonly invertGood?: boolean;
}

function DeltaBadge({ deltaPct, invertGood = false }: DeltaBadgeProps) {
  if (!Number.isFinite(deltaPct) || Math.abs(deltaPct) < 0.05) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
        %0.0 sabit
      </span>
    );
  }

  const isPositive = deltaPct > 0;
  const isFavorable = invertGood ? !isPositive : isPositive;
  const toneClass = isFavorable
    ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
    : "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800";
  const prefix = isPositive ? "+" : "";

  return (
    <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold border ${toneClass}`}>
      {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      <span>{prefix}{deltaPct.toFixed(1)}%</span>
    </span>
  );
}

interface ExecutiveKpiCardProps {
  readonly title: string;
  readonly value: string;
  readonly subtitle: string;
  readonly icon: LucideIcon;
  readonly iconTone: string;
  readonly deltaPct?: number;
}

function ExecutiveKpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconTone,
  deltaPct,
}: ExecutiveKpiCardProps) {
  return (
    <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs flex flex-col justify-between gap-3 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
          {title}
        </span>
        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${iconTone}`}>
          <Icon size={20} />
        </div>
      </div>

      <div>
        <div className="text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
          {value}
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</span>
          {typeof deltaPct === "number" && <DeltaBadge deltaPct={deltaPct} />}
        </div>
      </div>
    </div>
  );
}

function BuyerCohortBar({
  newVisitors,
  returningVisitors,
}: {
  readonly newVisitors: number;
  readonly returningVisitors: number;
}) {
  const total = Math.max(1, newVisitors + returningVisitors);
  const hasData = newVisitors + returningVisitors > 0;
  const newPct = hasData ? (newVisitors / total) * 100 : 50;
  const retPct = hasData ? (returningVisitors / total) * 100 : 50;

  return (
    <div className="bg-white dark:bg-zinc-900 p-5 sm:p-6 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <UserCheck size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Alıcı Sadakat Kohortu: İlk Kez Gelen vs. Tekrar Gelen Toptancılar
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              B2B pazaryerinde tekrar gelen alıcı oranı yüksek sipariş niyetini temsil eder
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-bold">
          <span className="inline-flex items-center gap-1.5 text-sky-700 dark:text-sky-300">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
            Yeni Alıcı: {newVisitors.toLocaleString("tr-TR")} (%{hasData ? newPct.toFixed(1) : "0.0"})
          </span>
          <span className="inline-flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
            Tekrar Gelen: {returningVisitors.toLocaleString("tr-TR")} (%{hasData ? retPct.toFixed(1) : "0.0"})
          </span>
        </div>
      </div>

      <div className="w-full h-3.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden flex">
        <div
          className="h-full bg-sky-500 transition-all duration-300"
          style={{ width: `${newPct}%` }}
          title={`Yeni Ziyaretçi: %${newPct.toFixed(1)}`}
        />
        <div
          className="h-full bg-indigo-600 transition-all duration-300"
          style={{ width: `${retPct}%` }}
          title={`Tekrar Gelen Toptancı: %${retPct.toFixed(1)}`}
        />
      </div>
    </div>
  );
}

function DailyTimeSeriesChart({ series }: { readonly series: BiDailySeriesPoint[] }) {
  const [selectedMetric, setSelectedMetric] = useState<TrendMetricKey>("visitors");
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const activeConfig = useMemo(
    () => TREND_METRICS.find((m) => m.key === selectedMetric) ?? TREND_METRICS[0],
    [selectedMetric]
  );

  const maxMetricVal = useMemo(() => {
    let max = 1;
    for (const pt of series) {
      const val = pt[selectedMetric];
      if (val > max) max = val;
    }
    return max;
  }, [series, selectedMetric]);

  const activePoint = hoveredIdx !== null ? series[hoveredIdx] ?? null : series.at(-1) ?? null;

  return (
    <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs flex flex-col gap-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <TrendingUp size={18} className="text-emerald-600" />
            Günlük Zaman Serisi &amp; Dönüşüm Trendi
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Gün bazında ziyaretçi, ürün inceleme, sepet ve B2B lead ivmesi
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-2xl border border-zinc-200 dark:border-zinc-700">
          {TREND_METRICS.map((m) => {
            const active = m.key === selectedMetric;
            const cls = active
              ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs font-bold"
              : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white";
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setSelectedMetric(m.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer ${cls}`}
              >
                <span className={`w-2 h-2 rounded-full ${m.dotClass}`} />
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {series.length === 0 ? (
        <div className="py-12 text-center text-xs text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
          Seçili periyotta günlük zaman serisi kaydı bulunamadı.
        </div>
      ) : (
        <>
          <div className="h-52 flex items-end gap-1.5 sm:gap-2 pt-4 px-1 overflow-x-auto">
            {series.map((pt, idx) => {
              const rawVal = pt[selectedMetric];
              const heightPct = Math.max(4, Math.round((rawVal / maxMetricVal) * 100));
              const isHovered = hoveredIdx === idx;
              const shortDate = pt.date.length >= 10 ? pt.date.slice(5) : pt.date;

              return (
                <button
                  key={pt.date || String(idx)}
                  type="button"
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onClick={() => setHoveredIdx(idx)}
                  className="flex-1 min-w-[26px] h-full flex flex-col justify-end items-center gap-1.5 group cursor-pointer"
                  title={`${pt.date}: ${rawVal.toLocaleString("tr-TR")} ${activeConfig.label}`}
                >
                  <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    {rawVal}
                  </span>
                  <div className="w-full flex-1 flex items-end justify-center bg-zinc-100/70 dark:bg-zinc-800/50 rounded-t-xl overflow-hidden">
                    <div
                      className={`w-full rounded-t-xl transition-all duration-200 ${activeConfig.barClass} ${
                        isHovered ? "opacity-100 ring-2 ring-zinc-900/20" : "opacity-85 group-hover:opacity-100"
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 truncate max-w-full">
                    {shortDate}
                  </span>
                </button>
              );
            })}
          </div>

          {activePoint && (
            <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="font-bold text-zinc-900 dark:text-zinc-100">
                Tarih: <span className="font-mono text-emerald-700 dark:text-emerald-400">{activePoint.date}</span>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-zinc-600 dark:text-zinc-300">
                <span>Tekil: <strong>{activePoint.visitors.toLocaleString("tr-TR")}</strong></span>
                <span>Oturum: <strong>{activePoint.sessions.toLocaleString("tr-TR")}</strong></span>
                <span>Gösterim: <strong>{activePoint.pageviews.toLocaleString("tr-TR")}</strong></span>
                <span>Ürün İnceleme: <strong>{activePoint.product_views.toLocaleString("tr-TR")}</strong></span>
                <span>Sepet: <strong>{activePoint.cart_adds.toLocaleString("tr-TR")}</strong></span>
                <span>B2B Lead: <strong>{activePoint.leads.toLocaleString("tr-TR")}</strong></span>
                <span>Sipariş: <strong>{activePoint.orders.toLocaleString("tr-TR")}</strong></span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function LiveStreamAndReferrers({
  recentEvents,
  topReferrers,
}: {
  readonly recentEvents: RecentActivityEvent[];
  readonly topReferrers: TopItemCount[];
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Top Referrers Snapshot */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
            <Compass size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Öne Çıkan Yönlendirenler
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Anlık trafik yönlendirme kaynakları</p>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          {topReferrers.slice(0, 6).map((ref) => (
            <div key={ref.name} className="flex flex-col gap-1 p-2 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-zinc-900 dark:text-zinc-100 truncate max-w-[180px]">
                  {ref.name}
                </span>
                <span className="text-zinc-500 dark:text-zinc-400 font-semibold">
                  {ref.visitors} tekil (%{ref.percentage.toFixed(1)})
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-violet-600 rounded-full"
                  style={{ width: `${Math.min(100, Math.max(4, ref.percentage))}%` }}
                />
              </div>
            </div>
          ))}

          {topReferrers.length === 0 && (
            <div className="py-8 text-center text-xs text-zinc-400">
              Henüz yönlendirme kaydı bulunmuyor.
            </div>
          )}
        </div>
      </div>

      {/* Live Visitor Stream */}
      <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Clock size={16} className="text-emerald-600" />
            Canlı Ziyaretçi Akışı (Son Gerçek Zamanlı Olaylar)
          </h2>
          <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
            Canlı Telemetri
          </span>
        </div>

        <div className="divide-y divide-zinc-100 dark:divide-zinc-800 overflow-y-auto max-h-[300px] pr-1">
          {recentEvents.map((ev, idx) => {
            const formattedTime = ev.created_at
              ? new Date(ev.created_at).toLocaleTimeString("tr-TR")
              : "-";
            return (
              <div
                key={`${ev.path}-${ev.created_at}-${idx}`}
                className="py-2.5 flex items-center justify-between text-xs gap-3"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 font-mono text-[10px] font-bold text-zinc-700 dark:text-zinc-300">
                    {(ev.language || "tr").toUpperCase()}
                  </span>
                  <Link
                    href={ev.path || "/"}
                    target="_blank"
                    className="font-mono text-zinc-800 dark:text-zinc-200 hover:text-emerald-600 truncate max-w-[320px]"
                    title={ev.path}
                  >
                    {ev.path}
                  </Link>
                </div>
                <div className="flex items-center gap-3 text-zinc-400 text-[11px] shrink-0">
                  <span className="text-zinc-500 dark:text-zinc-400 hidden sm:inline truncate max-w-[140px]">
                    {ev.referrer_host}
                  </span>
                  <span className="capitalize px-2 py-0.5 rounded-md bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                    {ev.device_type}
                  </span>
                  <span className="font-mono">{formattedTime}</span>
                </div>
              </div>
            );
          })}

          {recentEvents.length === 0 && (
            <div className="py-10 text-center text-xs text-zinc-400">
              Henüz canlı ziyaretçi olayı kaydedilmedi.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export interface BiOverviewTabProps {
  readonly overview: BiOverviewMetrics;
  readonly dailySeries: BiDailySeriesPoint[];
  readonly recentEvents: RecentActivityEvent[];
  readonly topReferrers: TopItemCount[];
}

export default function BiOverviewTab({
  overview,
  dailySeries,
  recentEvents,
  topReferrers,
}: BiOverviewTabProps) {
  const pagesPerSession =
    overview.total_sessions > 0
      ? (overview.total_pageviews / overview.total_sessions).toFixed(1)
      : "0.0";
  const cartRate =
    overview.product_views > 0
      ? ((overview.cart_additions / overview.product_views) * 100).toFixed(1)
      : "0.0";

  return (
    <div className="flex flex-col gap-6">
      {/* 8 Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ExecutiveKpiCard
          title="Tekil Toptan Alıcı"
          value={overview.unique_visitors.toLocaleString("tr-TR")}
          subtitle={`Canlı (15 dk): ${overview.live_visitors_15m} aktif`}
          icon={Users}
          iconTone="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          deltaPct={overview.visitors_delta_pct}
        />

        <ExecutiveKpiCard
          title="Toplam Oturum & Gösterim"
          value={overview.total_sessions.toLocaleString("tr-TR")}
          subtitle={`${overview.total_pageviews.toLocaleString("tr-TR")} sayfa (${pagesPerSession}/oturum)`}
          icon={Eye}
          iconTone="bg-blue-500/10 text-blue-600 dark:text-blue-400"
          deltaPct={overview.sessions_delta_pct}
        />

        <ExecutiveKpiCard
          title="Ürün Kartı İnceleme"
          value={overview.product_views.toLocaleString("tr-TR")}
          subtitle="Detay sayfası görüntülenen modeller"
          icon={Package}
          iconTone="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
        />

        <ExecutiveKpiCard
          title="Sepete Ekleme (Seri Niyeti)"
          value={overview.cart_additions.toLocaleString("tr-TR")}
          subtitle={`Ürün -> Sepet oranı: %${cartRate}`}
          icon={ShoppingCart}
          iconTone="bg-amber-500/10 text-amber-600 dark:text-amber-400"
        />

        <ExecutiveKpiCard
          title="B2B Talep & WhatsApp Lead"
          value={overview.b2b_leads.toLocaleString("tr-TR")}
          subtitle="Üretici iletişimi, teklif ve RFQ"
          icon={MessageSquareQuote}
          iconTone="bg-violet-500/10 text-violet-600 dark:text-violet-400"
          deltaPct={overview.leads_delta_pct}
        />

        <ExecutiveKpiCard
          title="B2B Sipariş & GMV (TRY)"
          value={`${overview.orders_count.toLocaleString("tr-TR")} Sipariş`}
          subtitle={`${formatCurrencyTry(overview.gmv_try)} (TCMB Kur Karşılığı)`}
          icon={TrendingUp}
          iconTone="bg-teal-500/10 text-teal-600 dark:text-teal-400"
        />

        <ExecutiveKpiCard
          title="Ort. Süre & Kaydırma Derinliği"
          value={formatDurationSec(overview.avg_session_duration_sec)}
          subtitle={`Ort. sayfa kaydırma: %${overview.avg_scroll_depth_pct.toFixed(0)}`}
          icon={Clock}
          iconTone="bg-sky-500/10 text-sky-600 dark:text-sky-400"
        />

        <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Hemen Çıkma Oranı (Bounce)
            </span>
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <MousePointerClick size={20} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
              %{overview.bounce_rate_pct.toFixed(1)}
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Tek sayfa görüp ayrılan oturumlar
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  overview.bounce_rate_pct <= 45
                    ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                    : "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300"
                }`}
              >
                {overview.bounce_rate_pct <= 45 ? "Sağlıklı" : "İyileştirilebilir"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* New vs Returning Buyer Cohort Bar */}
      <BuyerCohortBar
        newVisitors={overview.new_visitors}
        returningVisitors={overview.returning_visitors}
      />

      {/* Interactive Multi-Metric Daily Time-Series Trend Chart */}
      <DailyTimeSeriesChart series={dailySeries} />

      {/* Live Recent Stream + Referrer Snapshot */}
      <LiveStreamAndReferrers recentEvents={recentEvents} topReferrers={topReferrers} />
    </div>
  );
}
