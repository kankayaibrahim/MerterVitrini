"use client";

import React from "react";
import { Bot, Cpu, Info, Sparkles } from "lucide-react";
import {
  TrafficComparisonHero,
  TrafficDailyComparisonPoint,
  formatCompactCountTr,
} from "./trafficSourcesTypes";

function resolveBarWidthPct(value: number, maxVal: number): number {
  if (value <= 0 || maxVal <= 0) return 0;
  return Math.min(100, Math.max(2, (value / maxVal) * 100));
}

function getDataSourceBadgeMeta(source: string): { label: string; hint: string; cls: string } {
  if (source === "nginx_hourly") {
    return {
      label: "Canlı Kaynak: Nginx Tam Erişim Logu (SSR + Sitemap + API)",
      hint: "Next.js SSR sayfaları, sitemap.xml, robots.txt, llms.txt ve API isteklerinin tamamı sayılmaktadır.",
      cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    };
  }
  if (source === "hybrid") {
    return {
      label: "Canlı Kaynak: Hibrit (Nginx Tam Log + API Ara Katman)",
      hint: "Seçili dönemin bir kısmı Nginx tam logundan, öncesi API ara katman bot kayıtlarından birleştirildi.",
      cls: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    };
  }
  return {
    label: "Kaynak: API Ara Katman Bot Logları (Nginx Logu Bekleniyor)",
    hint: "Nginx logu henüz aktif değil veya bu aralıkta kayıt yok; veriler yalnızca Go API ara katmanından geliyor.",
    cls: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  };
}

function ComparisonBarRow({
  label,
  formattedValue,
  rawTitle,
  suffix,
  subtext,
  widthPct,
  barClassName,
}: {
  readonly label: string;
  readonly formattedValue: string;
  readonly rawTitle: string;
  readonly suffix?: string;
  readonly subtext?: string;
  readonly widthPct: number;
  readonly barClassName: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-sm sm:text-base text-zinc-200 leading-snug">
          <span className="font-normal text-zinc-300">{label}: </span>
          <strong className="font-black text-white text-base sm:text-lg tabular-nums" title={rawTitle}>
            {formattedValue}
          </strong>
          {suffix && <span className="font-bold text-white ml-1">{suffix}</span>}
        </div>
        {subtext && (
          <span className="text-[11px] font-medium text-zinc-400 tabular-nums">
            {subtext}
          </span>
        )}
      </div>

      <div className="w-full h-7 sm:h-8 rounded-lg bg-white/5 overflow-hidden p-0.5 flex items-center">
        {widthPct > 0 ? (
          <div
            className={`h-full rounded-md transition-all duration-500 ${barClassName}`}
            style={{ width: `${widthPct}%` }}
          />
        ) : (
          <div className="px-3 text-[11px] text-zinc-500">Bu aralıkta kayıt yok</div>
        )}
      </div>
    </div>
  );
}

function DailyTrendMiniGrid({
  dailyComparison,
}: {
  readonly dailyComparison: TrafficDailyComparisonPoint[];
}) {
  if (dailyComparison.length === 0) return null;
  const maxBotDay = Math.max(
    1,
    ...dailyComparison.map((d) => Math.max(d.ai_bot_hits, d.google_bot_hits))
  );
  const maxVisitDay = Math.max(
    1,
    ...dailyComparison.map((d) => Math.max(d.ai_visits, d.google_visits))
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-4 border-t border-white/10">
      <div className="rounded-2xl bg-black/25 border border-white/10 p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-zinc-200">Günlük Tarama Trendi (AI vs Google Bot)</span>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="inline-flex items-center gap-1 text-rose-300">
              <span className="w-2 h-2 rounded-xs bg-rose-500" /> AI Bot
            </span>
            <span className="inline-flex items-center gap-1 text-sky-300">
              <span className="w-2 h-2 rounded-xs bg-slate-400" /> Google
            </span>
          </div>
        </div>
        <div className="flex items-end gap-1.5 h-20 overflow-x-auto pt-2">
          {dailyComparison.slice(-21).map((d) => (
            <div
              key={d.date}
              className="flex-1 min-w-[14px] h-full flex flex-col justify-end items-center gap-1 group"
              title={`${d.date} — AI Bot: ${d.ai_bot_hits.toLocaleString("tr-TR")} | Google: ${d.google_bot_hits.toLocaleString("tr-TR")}`}
            >
              <div className="w-full flex items-end justify-center gap-0.5 flex-1">
                <div
                  className="w-1.5 sm:w-2 rounded-t bg-rose-500 transition-all"
                  style={{ height: `${Math.max(d.ai_bot_hits > 0 ? 8 : 0, (d.ai_bot_hits / maxBotDay) * 100)}%` }}
                />
                <div
                  className="w-1.5 sm:w-2 rounded-t bg-slate-400 transition-all"
                  style={{ height: `${Math.max(d.google_bot_hits > 0 ? 8 : 0, (d.google_bot_hits / maxBotDay) * 100)}%` }}
                />
              </div>
              <span className="text-[9px] text-zinc-500 font-mono">{d.date.slice(5)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-black/25 border border-white/10 p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-zinc-200">Günlük Gerçek Ziyaret Trendi (AI vs Google)</span>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="inline-flex items-center gap-1 text-rose-300">
              <span className="w-2 h-2 rounded-xs bg-rose-500" /> AI Ziyaret
            </span>
            <span className="inline-flex items-center gap-1 text-sky-300">
              <span className="w-2 h-2 rounded-xs bg-slate-400" /> Google Ziyaret
            </span>
          </div>
        </div>
        <div className="flex items-end gap-1.5 h-20 overflow-x-auto pt-2">
          {dailyComparison.slice(-21).map((d) => (
            <div
              key={d.date}
              className="flex-1 min-w-[14px] h-full flex flex-col justify-end items-center gap-1"
              title={`${d.date} — AI Ziyaret: ${d.ai_visits.toLocaleString("tr-TR")} | Google Ziyaret: ${d.google_visits.toLocaleString("tr-TR")}`}
            >
              <div className="w-full flex items-end justify-center gap-0.5 flex-1">
                <div
                  className="w-1.5 sm:w-2 rounded-t bg-rose-500 transition-all"
                  style={{ height: `${Math.max(d.ai_visits > 0 ? 8 : 0, (d.ai_visits / maxVisitDay) * 100)}%` }}
                />
                <div
                  className="w-1.5 sm:w-2 rounded-t bg-slate-400 transition-all"
                  style={{ height: `${Math.max(d.google_visits > 0 ? 8 : 0, (d.google_visits / maxVisitDay) * 100)}%` }}
                />
              </div>
              <span className="text-[9px] text-zinc-500 font-mono">{d.date.slice(5)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export interface TrafficCrawlVsVisitHeroProps {
  readonly hero: TrafficComparisonHero;
  readonly dateRangeLabel: string;
  readonly dailyComparison: TrafficDailyComparisonPoint[];
}

export default function TrafficCrawlVsVisitHero({
  hero,
  dateRangeLabel,
  dailyComparison,
}: TrafficCrawlVsVisitHeroProps) {
  const maxCrawl = Math.max(1, hero.ai_bot_requests, hero.google_bot_requests);
  const maxVisit = Math.max(1, hero.ai_visits, hero.google_search_visits);
  const dsMeta = getDataSourceBadgeMeta(hero.crawler_data_source);

  const aiVisitDetail =
    hero.chatgpt_visits > 0
      ? `ChatGPT: ${hero.chatgpt_visits.toLocaleString("tr-TR")} ziyaret • ${hero.ai_visitors.toLocaleString("tr-TR")} tekil alıcı`
      : `${hero.ai_visitors.toLocaleString("tr-TR")} tekil alıcı`;

  const googleVisitDetail = `${hero.google_search_visitors.toLocaleString("tr-TR")} tekil alıcı`;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-900 to-rose-950/35 p-6 sm:p-8 text-white shadow-lg flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 text-xs font-bold text-rose-300">
          <Sparkles size={14} />
          <span>Yapay Zeka Botları vs. Google Tarama &amp; Ziyaret Verimliliği</span>
        </div>

        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-semibold ${dsMeta.cls}`}
          title={dsMeta.hint}
        >
          <Info size={12} />
          <span>{dsMeta.label}</span>
        </span>
      </div>

      {/* Block 1: Crawl Requests */}
      <div className="flex flex-col gap-4">
        <p className="text-xs font-medium text-zinc-400">
          Seçili dönemde sitemize gelen tarama istekleri
        </p>

        <ComparisonBarRow
          label="Yapay zeka botları"
          formattedValue={formatCompactCountTr(hero.ai_bot_requests)}
          rawTitle={`${hero.ai_bot_requests.toLocaleString("tr-TR")} istek`}
          suffix="istek"
          subtext="GPTBot, OAI-SearchBot, Claude, Perplexity, Amazonbot, Meta AI..."
          widthPct={resolveBarWidthPct(hero.ai_bot_requests, maxCrawl)}
          barClassName="bg-gradient-to-r from-rose-600 to-rose-500 shadow-xs"
        />

        <ComparisonBarRow
          label="Google'ın tarayıcıları"
          formattedValue={formatCompactCountTr(hero.google_bot_requests)}
          rawTitle={`${hero.google_bot_requests.toLocaleString("tr-TR")} istek`}
          suffix="istek"
          subtext="Googlebot, InspectionTool, AdsBot, Storebot"
          widthPct={resolveBarWidthPct(hero.google_bot_requests, maxCrawl)}
          barClassName="bg-gradient-to-r from-slate-500 to-sky-500/80"
        />

        <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-300 pt-1">
          <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 inline-flex items-center gap-1.5">
            <Bot size={12} className="text-indigo-300" />
            Diğer Arama Botları (Bing, Yandex vb.): <strong>{hero.other_search_bot_requests.toLocaleString("tr-TR")}</strong>
          </span>
          <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 inline-flex items-center gap-1.5">
            <Cpu size={12} className="text-amber-300" />
            SEO &amp; Denetim Botları (Semrush, Ahrefs, Qlyze vb.): <strong>{hero.seo_tool_bot_requests.toLocaleString("tr-TR")}</strong>
          </span>
          <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
            Toplam Bot İsteği: <strong>{hero.total_bot_requests.toLocaleString("tr-TR")}</strong>
          </span>
        </div>
      </div>

      <hr className="border-white/10" />

      {/* Block 2: Actual Human Visits */}
      <div className="flex flex-col gap-4">
        <p className="text-xs font-medium text-zinc-400">
          Aynı dönemde sitemize gelen gerçek ziyaretler (oturum)
        </p>

        <ComparisonBarRow
          label="Yapay Zeka'dan gelen ziyaret"
          formattedValue={hero.ai_visits.toLocaleString("tr-TR")}
          rawTitle={`${hero.ai_visits.toLocaleString("tr-TR")} oturum`}
          subtext={aiVisitDetail}
          widthPct={resolveBarWidthPct(hero.ai_visits, maxVisit)}
          barClassName="bg-gradient-to-r from-rose-600 to-rose-500 shadow-xs"
        />

        <ComparisonBarRow
          label="Google aramasından gelen ziyaret"
          formattedValue={hero.google_search_visits.toLocaleString("tr-TR")}
          rawTitle={`${hero.google_search_visits.toLocaleString("tr-TR")} oturum`}
          subtext={googleVisitDetail}
          widthPct={resolveBarWidthPct(hero.google_search_visits, maxVisit)}
          barClassName="bg-gradient-to-r from-slate-500 to-sky-500/80"
        />

        <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-300 pt-1">
          <span className="px-2.5 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-200">
            AI Tarama / Ziyaret Oranı:{" "}
            <strong>
              {hero.ai_crawl_per_visit_ratio > 0 ? `${hero.ai_crawl_per_visit_ratio.toFixed(1)}x` : "—"}
            </strong>
          </span>
          <span className="px-2.5 py-1 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-200">
            Google Tarama / Ziyaret Oranı:{" "}
            <strong>
              {hero.google_crawl_per_visit_ratio > 0 ? `${hero.google_crawl_per_visit_ratio.toFixed(1)}x` : "—"}
            </strong>
          </span>
          <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
            Diğer Arama Ziyareti: <strong>{hero.other_search_visits.toLocaleString("tr-TR")}</strong>
          </span>
          <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
            Toplam İnsan Ziyareti: <strong>{hero.total_human_sessions.toLocaleString("tr-TR")}</strong>
          </span>
        </div>
      </div>

      <DailyTrendMiniGrid dailyComparison={dailyComparison} />

      <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs">
        <span className="font-bold text-zinc-200 tracking-tight">mertervitrini.com.tr</span>
        <span className="text-zinc-400 font-medium">{dateRangeLabel}</span>
      </div>
    </div>
  );
}
