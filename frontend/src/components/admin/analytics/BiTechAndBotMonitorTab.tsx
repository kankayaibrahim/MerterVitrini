"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import {
  Bot,
  Cpu,
  ExternalLink,
  Gauge,
  Laptop,
  Monitor,
  Smartphone,
  Tablet,
} from "lucide-react";
import {
  BiBotCrawlMonitor,
  BiNamedCountRow,
  BiScreenResolutionRow,
  BiWebVitalsAndTech,
  BiWebVitalsByDevice,
  formatRelativeTimeTr,
} from "./biTypes";

type VitalGrade = "good" | "needs_improvement" | "poor" | "no_data";

function evaluateVital(value: number, goodMax: number, needsMax: number): VitalGrade {
  if (value <= 0) return "no_data";
  if (value <= goodMax) return "good";
  if (value <= needsMax) return "needs_improvement";
  return "poor";
}

function getGradePresentation(grade: VitalGrade): { label: string; className: string } {
  if (grade === "good") {
    return {
      label: "İyi",
      className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    };
  }
  if (grade === "needs_improvement") {
    return {
      label: "Geliştirilmeli",
      className: "bg-amber-50 text-amber-700 border-amber-200",
    };
  }
  if (grade === "poor") {
    return {
      label: "Zayıf",
      className: "bg-rose-50 text-rose-700 border-rose-200",
    };
  }
  return {
    label: "Örneklem Yok",
    className: "bg-zinc-100 text-zinc-500 border-zinc-200",
  };
}

function formatDeviceNameTr(deviceType: string): string {
  const lower = deviceType.toLowerCase();
  if (lower === "mobile") return "Mobil (Mobile)";
  if (lower === "tablet") return "Tablet";
  return "Masaüstü (Desktop)";
}

function DeviceIcon({ deviceType }: { readonly deviceType: string }) {
  const lower = deviceType.toLowerCase();
  if (lower === "mobile") return <Smartphone size={18} />;
  if (lower === "tablet") return <Tablet size={18} />;
  return <Monitor size={18} />;
}

function createEmptyDeviceVitals(deviceType: string): BiWebVitalsByDevice {
  return {
    device_type: deviceType,
    samples: 0,
    avg_lcp_ms: 0,
    avg_inp_ms: 0,
    avg_cls: 0,
    avg_ttfb_ms: 0,
    good_lcp_pct: 0,
  };
}

function buildBalancedDeviceVitalsList(rawList: readonly BiWebVitalsByDevice[]): BiWebVitalsByDevice[] {
  const byType = new Map<string, BiWebVitalsByDevice>();
  for (const item of rawList) {
    const key = (item.device_type || "desktop").trim().toLowerCase();
    byType.set(key, { ...item, device_type: key });
  }

  const desktopItem = byType.get("desktop") ?? createEmptyDeviceVitals("desktop");
  const mobileItem = byType.get("mobile") ?? createEmptyDeviceVitals("mobile");
  const result: BiWebVitalsByDevice[] = [desktopItem, mobileItem];

  const tabletItem = byType.get("tablet");
  if (tabletItem && tabletItem.samples > 0) {
    result.push(tabletItem);
  }

  return result;
}

function VitalMetricBox({
  name,
  displayValue,
  grade,
}: {
  readonly name: string;
  readonly displayValue: string;
  readonly grade: VitalGrade;
}) {
  const meta = getGradePresentation(grade);
  return (
    <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/70 flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-1">
        <span className="text-[11px] font-black text-zinc-500 uppercase">
          {name}
        </span>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${meta.className}`}>
          {meta.label}
        </span>
      </div>
      <div className="text-lg font-black text-zinc-900 font-mono">
        {displayValue}
      </div>
    </div>
  );
}

function WebVitalsDeviceCard({ item }: { readonly item: BiWebVitalsByDevice }) {
  const hasSamples = item.samples > 0;
  const lcpGrade = hasSamples ? evaluateVital(item.avg_lcp_ms, 2500, 4000) : "no_data";
  const inpGrade = hasSamples ? evaluateVital(item.avg_inp_ms, 200, 500) : "no_data";
  const clsGrade = hasSamples ? evaluateVital(item.avg_cls || 0.001, 0.1, 0.25) : "no_data";
  const ttfbGrade = hasSamples ? evaluateVital(item.avg_ttfb_ms, 800, 1800) : "no_data";

  return (
    <div className="p-5 rounded-3xl bg-white border border-zinc-200/80 shadow-xs flex flex-col justify-between gap-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
            <DeviceIcon deviceType={item.device_type} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-900">
              {formatDeviceNameTr(item.device_type)}
            </h3>
            <p className="text-[11px] text-zinc-500">
              {hasSamples
                ? `${item.samples.toLocaleString("tr-TR")} gerçek kullanıcı (RUM) ölçümü`
                : "Bu zaman aralığında henüz örneklem yok"}
            </p>
          </div>
        </div>

        <div className="text-right">
          <div className={`text-sm font-black ${hasSamples ? "text-emerald-600" : "text-zinc-400"}`}>
            {hasSamples ? `%${item.good_lcp_pct.toFixed(0)}` : "—"}
          </div>
          <span className="text-[10px] text-zinc-400 font-semibold">İyi LCP Oranı</span>
        </div>
      </div>

      {hasSamples ? (
        <div className="grid grid-cols-2 gap-2.5">
          <VitalMetricBox
            name="LCP"
            displayValue={item.avg_lcp_ms > 0 ? `${Math.round(item.avg_lcp_ms)} ms` : "-"}
            grade={lcpGrade}
          />
          <VitalMetricBox
            name="INP"
            displayValue={item.avg_inp_ms > 0 ? `${Math.round(item.avg_inp_ms)} ms` : "-"}
            grade={inpGrade}
          />
          <VitalMetricBox
            name="CLS"
            displayValue={item.avg_cls.toFixed(3)}
            grade={clsGrade}
          />
          <VitalMetricBox
            name="TTFB"
            displayValue={item.avg_ttfb_ms > 0 ? `${Math.round(item.avg_ttfb_ms)} ms` : "-"}
            grade={ttfbGrade}
          />
        </div>
      ) : (
        <div className="min-h-[148px] rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/70 p-4 flex flex-col items-center justify-center text-center gap-1.5">
          <span className="text-xs font-bold text-zinc-700">
            Bu zaman aralığında henüz örneklem yok
          </span>
          <span className="text-[11px] text-zinc-500 max-w-xs">
            {formatDeviceNameTr(item.device_type)} ziyaretçilerinden gerçek kullanıcı (RUM) Web Vitals sinyali geldiğinde LCP, INP, CLS ve TTFB metrikleri burada listelenecektir.
          </span>
        </div>
      )}
    </div>
  );
}

function TechDistributionList({
  title,
  items,
}: {
  readonly title: string;
  readonly items: Array<{ label: string; count: number }>;
}) {
  const total = Math.max(
    1,
    items.reduce((acc, item) => acc + item.count, 0)
  );

  return (
    <div className="bg-white p-5 rounded-3xl border border-zinc-200/80 shadow-xs flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Laptop size={16} className="text-indigo-600" />
        <h3 className="text-xs font-bold text-zinc-900 tracking-wider">
          {title.toLocaleUpperCase("tr-TR")}
        </h3>
      </div>

      <div className="flex flex-col gap-2.5">
        {items.slice(0, 7).map((item) => {
          const pct = (item.count / total) * 100;
          return (
            <div key={item.label} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-800 truncate max-w-[160px]">
                  {item.label}
                </span>
                <span className="text-zinc-500 font-mono text-[11px] tabular-nums">
                  {item.count.toLocaleString("tr-TR")} (%{pct.toFixed(1)})
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-indigo-500"
                  style={{ width: `${Math.min(100, Math.max(4, pct))}%` }}
                />
              </div>
            </div>
          );
        })}

        {items.length === 0 && (
          <div className="py-6 text-center text-xs text-zinc-400">Veri bulunamadı.</div>
        )}
      </div>
    </div>
  );
}

function SeoAndAiBotMonitorCard({ monitor }: { readonly monitor: BiBotCrawlMonitor }) {
  return (
    <div className="bg-white rounded-3xl border border-zinc-200/80 shadow-xs overflow-hidden">
      <div className="p-6 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-2xl bg-violet-500/10 text-violet-600">
            <Bot size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-900">
              SEO Arama Motoru &amp; AI Bot Tarama (Crawl) Monitörü
            </h2>
            <p className="text-xs text-zinc-500">
              Googlebot, YandexBot, Bingbot, GPTBot ve diğer indeksleyicilerin katalog tarama sağlığı (insan trafiğinden izole edilmiştir)
            </p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-violet-50 border border-violet-200 text-violet-700 text-xs font-black self-start sm:self-auto whitespace-nowrap">
          <Cpu size={14} />
          <span>Toplam {monitor.total_bot_hits.toLocaleString("tr-TR")} Bot İsteği</span>
        </span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 divide-y xl:divide-y-0 xl:divide-x divide-zinc-100">
        {/* Bot Agents Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/80 text-[11px] font-bold tracking-wider text-zinc-500 border-b border-zinc-100">
                <th className="py-3 px-4">BOT / TARAYICI</th>
                <th className="py-3 px-4">TARAMA (HİT)</th>
                <th className="py-3 px-4">TEKİL URL / ÜRÜN</th>
                <th className="py-3 px-4 text-right">SON GÖRÜLME</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-xs">
              {monitor.bots.map((bot) => (
                <tr key={bot.bot_name} className="hover:bg-zinc-50/80">
                  <td className="py-3 px-4 font-bold text-zinc-900 font-mono">
                    {bot.bot_name}
                  </td>
                  <td className="py-3 px-4 font-black text-violet-700 tabular-nums">
                    {bot.hits.toLocaleString("tr-TR")}
                  </td>
                  <td className="py-3 px-4 text-zinc-600 tabular-nums">
                    {bot.unique_paths} sayfa ({bot.product_pages_crawled} ürün)
                  </td>
                  <td className="py-3 px-4 text-right text-zinc-500 whitespace-nowrap">
                    {formatRelativeTimeTr(bot.last_crawl_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {monitor.bots.length === 0 && (
            <div className="py-10 text-center text-xs text-zinc-400">
              Bu periyotta kayıtlı arama motoru veya AI bot taraması bulunmuyor.
            </div>
          )}
        </div>

        {/* Top Crawled Paths */}
        <div className="p-5 flex flex-col gap-3">
          <h3 className="text-xs font-bold text-zinc-500 tracking-wider">
            BOTLARIN EN YOĞUN TARADIĞI URL&apos;LER
          </h3>
          <div className="divide-y divide-zinc-100">
            {monitor.top_crawled_paths.map((row) => (
              <div key={`${row.path}-${row.top_bot}`} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                <Link
                  href={row.path || "/"}
                  target="_blank"
                  className="font-mono text-zinc-800 hover:text-violet-600 inline-flex items-center gap-1 truncate max-w-[290px]"
                >
                  <span>{row.path}</span>
                  <ExternalLink size={11} />
                </Link>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-2 py-0.5 rounded bg-zinc-100 font-mono text-[10px] font-bold text-zinc-700">
                    {row.top_bot}
                  </span>
                  <span className="font-black text-zinc-900 tabular-nums">
                    {row.hits} istek
                  </span>
                </div>
              </div>
            ))}

            {monitor.top_crawled_paths.length === 0 && (
              <div className="py-8 text-center text-xs text-zinc-400">
                Henüz bot URL tarama listesi oluşmadı.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export interface BiTechAndBotMonitorTabProps {
  readonly webVitalsAndTech: BiWebVitalsAndTech;
  readonly botCrawlMonitor: BiBotCrawlMonitor;
}

export default function BiTechAndBotMonitorTab({
  webVitalsAndTech,
  botCrawlMonitor,
}: BiTechAndBotMonitorTabProps) {
  const vitalsList = useMemo(
    () => buildBalancedDeviceVitalsList(webVitalsAndTech.web_vitals_by_device),
    [webVitalsAndTech.web_vitals_by_device]
  );

  const vitalsGridClass =
    vitalsList.length >= 3
      ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
      : "grid grid-cols-1 md:grid-cols-2 gap-4";

  const osItems = webVitalsAndTech.os_breakdown.map((r: BiNamedCountRow) => ({
    label: r.name,
    count: r.count,
  }));
  const browserItems = webVitalsAndTech.browser_breakdown.map((r: BiNamedCountRow) => ({
    label: r.name,
    count: r.count,
  }));
  const screenItems = webVitalsAndTech.screen_resolutions.map((r: BiScreenResolutionRow) => ({
    label: r.resolution,
    count: r.count,
  }));

  return (
    <div className="flex flex-col gap-6">
      {/* Core Web Vitals Section */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 px-1">
          <Gauge size={18} className="text-emerald-600" />
          <h2 className="text-sm font-bold text-zinc-900">
            Gerçek Kullanıcı Deneyimi — Google Core Web Vitals (RUM Telemetrisi)
          </h2>
        </div>
        <div className={vitalsGridClass}>
          {vitalsList.map((item) => (
            <WebVitalsDeviceCard key={item.device_type} item={item} />
          ))}
        </div>
      </div>

      {/* OS / Browser / Screen Resolution Matrices */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <TechDistributionList title="İşletim Sistemi (OS)" items={osItems} />
        <TechDistributionList title="Web Tarayıcısı" items={browserItems} />
        <TechDistributionList title="Ekran Çözünürlükleri" items={screenItems} />
      </div>

      {/* SEO & AI Crawler Monitor */}
      <SeoAndAiBotMonitorCard monitor={botCrawlMonitor} />
    </div>
  );
}
