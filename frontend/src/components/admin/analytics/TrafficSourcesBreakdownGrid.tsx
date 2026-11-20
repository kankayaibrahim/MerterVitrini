"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Bot, ExternalLink, Globe2, Link2, Network } from "lucide-react";
import CountryFlagBadge from "./CountryFlagBadge";
import { formatRelativeTimeTr } from "./biTypes";
import {
  CRAWLER_CATEGORY_META,
  TRAFFIC_CHANNEL_META,
  TrafficChannelId,
  TrafficChannelSummaryRow,
  TrafficCountryRow,
  TrafficCrawledPathRow,
  TrafficCrawlerBotRow,
  TrafficCrawlerGroupRow,
  TrafficSourceRow,
} from "./trafficSourcesTypes";

type RightPanelTab = "bots" | "countries" | "paths";

export interface TrafficSourcesBreakdownGridProps {
  readonly visitChannels: TrafficChannelSummaryRow[];
  readonly topSources: TrafficSourceRow[];
  readonly crawlerGroups: TrafficCrawlerGroupRow[];
  readonly topCrawlers: TrafficCrawlerBotRow[];
  readonly topCrawledPaths: TrafficCrawledPathRow[];
  readonly topCountries: TrafficCountryRow[];
}

export default function TrafficSourcesBreakdownGrid({
  visitChannels,
  topSources,
  crawlerGroups,
  topCrawlers,
  topCrawledPaths,
  topCountries,
}: TrafficSourcesBreakdownGridProps) {
  const [selectedChannel, setSelectedChannel] = useState<TrafficChannelId | "all">("all");
  const [rightTab, setRightTab] = useState<RightPanelTab>("bots");

  const filteredSources = useMemo(() => {
    if (selectedChannel === "all") return topSources;
    return topSources.filter((s) => s.channel === selectedChannel);
  }, [topSources, selectedChannel]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
      {/* Left: Human Traffic Sources ("En Çok Nereden Ziyaret Geliyor?") */}
      <div className="xl:col-span-6 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs overflow-hidden flex flex-col">
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Network size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                En Çok Nereden Ziyaret Geliyor? (Trafik Kaynakları)
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Yapay zeka asistanları (ChatGPT, Perplexity, Claude...), arama motorları, sosyal medya ve doğrudan oturumlar
              </p>
            </div>
          </div>

          {/* Clickable channel filter pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedChannel("all")}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors cursor-pointer ${
                selectedChannel === "all"
                  ? "bg-zinc-900 text-white border-zinc-900 dark:bg-emerald-600 dark:border-emerald-600"
                  : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100 dark:bg-zinc-950 dark:text-zinc-300 dark:border-zinc-800"
              }`}
            >
              Tümü ({topSources.length})
            </button>
            {visitChannels.map((ch) => {
              const meta = TRAFFIC_CHANNEL_META[ch.channel];
              const active = selectedChannel === ch.channel;
              return (
                <button
                  key={ch.channel}
                  type="button"
                  onClick={() => setSelectedChannel(active ? "all" : ch.channel)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors cursor-pointer ${
                    active
                      ? "bg-zinc-900 text-white border-zinc-900 dark:bg-emerald-600 dark:border-emerald-600"
                      : `${meta.badgeClass} hover:opacity-90`
                  }`}
                >
                  {ch.label}: {ch.sessions.toLocaleString("tr-TR")} (%{ch.share_pct.toFixed(1)})
                </button>
              );
            })}
          </div>
        </div>

        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/80 dark:bg-zinc-950/60 text-[11px] font-bold uppercase tracking-wider text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
                <th className="py-3 px-4">Kaynak</th>
                <th className="py-3 px-4">Kanal</th>
                <th className="py-3 px-4">Oturum / Tekil</th>
                <th className="py-3 px-4">Pay</th>
                <th className="py-3 px-4 text-right">B2B Talep</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
              {filteredSources.map((src) => {
                const meta = TRAFFIC_CHANNEL_META[src.channel];
                return (
                  <tr
                    key={`${src.channel}-${src.source_name}`}
                    className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors"
                  >
                    <td className="py-3 px-4 font-bold text-zinc-900 dark:text-zinc-100">
                      {src.source_name}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${meta.badgeClass}`}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap tabular-nums">
                      <strong className="text-zinc-900 dark:text-zinc-100">
                        {src.sessions.toLocaleString("tr-TR")}
                      </strong>
                      <span className="text-zinc-400 ml-1">
                        / {src.visitors.toLocaleString("tr-TR")} kişi
                      </span>
                    </td>
                    <td className="py-3 px-4 min-w-[110px]">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 mb-1 tabular-nums">
                        <span>%{src.share_pct.toFixed(1)}</span>
                        <span className="text-zinc-400 text-[10px]">H.Ç. %{src.bounce_rate_pct.toFixed(0)}</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${meta.barClass}`}
                          style={{ width: `${Math.min(100, Math.max(4, src.share_pct))}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-violet-700 dark:text-violet-400 tabular-nums">
                      {src.b2b_leads.toLocaleString("tr-TR")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredSources.length === 0 && (
            <div className="py-12 text-center text-xs text-zinc-400">
              Seçili filtre için trafik kaynağı verisi bulunamadı.
            </div>
          )}
        </div>
      </div>

      {/* Right: Bots, Countries & Top Crawled URLs */}
      <div className="xl:col-span-6 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs overflow-hidden flex flex-col">
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
                <Bot size={18} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  Bot İstekleri, Ülke Dağılımı &amp; Taranan Sayfalar
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Hangi botların, hangi ülkelerin ve hangi sayfaların en yoğun istek aldığını inceleyin
                </p>
              </div>
            </div>

            <div className="inline-flex p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[11px] font-bold">
              {[
                { id: "bots" as const, label: "Bot Tarayıcılar", icon: Bot },
                { id: "countries" as const, label: "Ülkeler", icon: Globe2 },
                { id: "paths" as const, label: "Taranan URL'ler", icon: Link2 },
              ].map((t) => {
                const Icon = t.icon;
                const active = rightTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setRightTab(t.id)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                      active
                        ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs"
                        : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                    }`}
                  >
                    <Icon size={12} />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {rightTab === "bots" && crawlerGroups.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {crawlerGroups.map((g) => {
                const meta = CRAWLER_CATEGORY_META[g.category];
                return (
                  <span
                    key={g.category}
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${meta.badgeClass}`}
                  >
                    {g.label}: {g.hits.toLocaleString("tr-TR")} (%{g.share_pct.toFixed(1)})
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <div className="overflow-x-auto flex-1">
          {rightTab === "bots" && (
            <>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-50/80 dark:bg-zinc-950/60 text-[11px] font-bold uppercase tracking-wider text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
                    <th className="py-3 px-4">Bot Adı</th>
                    <th className="py-3 px-4">Grup</th>
                    <th className="py-3 px-4">İstek</th>
                    <th className="py-3 px-4">Tekil Sayfa</th>
                    <th className="py-3 px-4 text-right">Son Görülme</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
                  {topCrawlers.map((bot) => {
                    const meta = CRAWLER_CATEGORY_META[bot.category];
                    return (
                      <tr key={bot.bot_name} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40">
                        <td className="py-3 px-4 font-bold font-mono text-zinc-900 dark:text-zinc-100">
                          {bot.bot_name}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${meta.badgeClass}`}>
                            {meta.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-black text-zinc-900 dark:text-zinc-100 tabular-nums">
                          {bot.hits.toLocaleString("tr-TR")}
                          <span className="text-[10px] font-medium text-zinc-400 ml-1">
                            (%{bot.share_pct.toFixed(1)})
                          </span>
                        </td>
                        <td className="py-3 px-4 text-zinc-600 dark:text-zinc-300 tabular-nums">
                          {bot.unique_paths.toLocaleString("tr-TR")} URL
                        </td>
                        <td className="py-3 px-4 text-right text-zinc-500 whitespace-nowrap">
                          {formatRelativeTimeTr(bot.last_crawl_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {topCrawlers.length === 0 && (
                <div className="py-12 text-center text-xs text-zinc-400">
                  Bu periyotta bot tarama kaydı bulunamadı.
                </div>
              )}
            </>
          )}

          {rightTab === "countries" && (
            <>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-50/80 dark:bg-zinc-950/60 text-[11px] font-bold uppercase tracking-wider text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
                    <th className="py-3 px-4">Ülke</th>
                    <th className="py-3 px-4">Oturum / Kişi</th>
                    <th className="py-3 px-4">AI Ziyaret</th>
                    <th className="py-3 px-4">Google</th>
                    <th className="py-3 px-4 text-right">Pay</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
                  {topCountries.map((c) => (
                    <tr key={c.country_code} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40">
                      <td className="py-3 px-4 font-bold text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                        <span className="inline-flex items-center gap-2">
                          <CountryFlagBadge countryCode={c.country_code} title={c.country_label} />
                          <span>{c.country_label}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 tabular-nums whitespace-nowrap">
                        <strong className="text-zinc-900 dark:text-zinc-100">
                          {c.sessions.toLocaleString("tr-TR")}
                        </strong>
                        <span className="text-zinc-400 ml-1">/ {c.visitors.toLocaleString("tr-TR")}</span>
                      </td>
                      <td className="py-3 px-4 font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                        {c.ai_visits.toLocaleString("tr-TR")}
                      </td>
                      <td className="py-3 px-4 font-bold text-sky-600 dark:text-sky-400 tabular-nums">
                        {c.google_visits.toLocaleString("tr-TR")}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-zinc-700 dark:text-zinc-300 tabular-nums">
                        %{c.share_pct.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {topCountries.length === 0 && (
                <div className="py-12 text-center text-xs text-zinc-400">
                  Ülke kırılımı verisi bulunamadı.
                </div>
              )}
            </>
          )}

          {rightTab === "paths" && (
            <div className="p-5 divide-y divide-zinc-100 dark:divide-zinc-800">
              {topCrawledPaths.map((p) => {
                const meta = CRAWLER_CATEGORY_META[p.top_category];
                return (
                  <div
                    key={`${p.path}-${p.top_bot}`}
                    className="py-2.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <Link
                      href={p.path || "/"}
                      target="_blank"
                      className="font-mono text-zinc-800 dark:text-zinc-200 hover:text-emerald-600 inline-flex items-center gap-1 truncate max-w-[300px]"
                      title={p.path}
                    >
                      <span className="truncate">{p.path}</span>
                      <ExternalLink size={11} className="shrink-0" />
                    </Link>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border font-mono ${meta.badgeClass}`}>
                        {p.top_bot}
                      </span>
                      <span className="font-black text-zinc-900 dark:text-zinc-100 tabular-nums">
                        {p.hits.toLocaleString("tr-TR")} istek
                      </span>
                    </div>
                  </div>
                );
              })}

              {topCrawledPaths.length === 0 && (
                <div className="py-10 text-center text-xs text-zinc-400">
                  En çok taranan URL listesi henüz oluşmadı.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
