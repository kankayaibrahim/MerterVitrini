"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Compass, ExternalLink, Info, Search, Sparkles, Tag } from "lucide-react";
import type { BiTopSearchItem } from "./biTypes";
import {
  TRAFFIC_CHANNEL_META,
  TrafficArrivalKeywordRow,
  TrafficSourceLandingRow,
} from "./trafficSourcesTypes";

type KeywordSubTab = "intents" | "utm_terms" | "internal_search";
type IntentSourceFilter = "all" | "ai_assistant" | "search";

export interface TrafficKeywordsAndIntentSectionProps {
  readonly landingIntents: TrafficSourceLandingRow[];
  readonly arrivalKeywords: TrafficArrivalKeywordRow[];
  readonly internalKeywords: BiTopSearchItem[];
}

export default function TrafficKeywordsAndIntentSection({
  landingIntents,
  arrivalKeywords,
  internalKeywords,
}: TrafficKeywordsAndIntentSectionProps) {
  const [subTab, setSubTab] = useState<KeywordSubTab>("intents");
  const [sourceFilter, setSourceFilter] = useState<IntentSourceFilter>("all");
  const [textQuery, setTextQuery] = useState<string>("");

  const filteredIntents = useMemo(() => {
    const q = textQuery.trim().toLowerCase();
    return landingIntents.filter((row) => {
      if (sourceFilter === "ai_assistant" && row.channel !== "ai_assistant") {
        return false;
      }
      if (
        sourceFilter === "search" &&
        row.channel !== "google_search" &&
        row.channel !== "other_search" &&
        row.channel !== "paid_ads"
      ) {
        return false;
      }
      if (!q) return true;
      return (
        row.source_name.toLowerCase().includes(q) ||
        row.path.toLowerCase().includes(q) ||
        row.inferred_topic.toLowerCase().includes(q)
      );
    });
  }, [landingIntents, sourceFilter, textQuery]);

  const filteredArrivalKeywords = useMemo(() => {
    const q = textQuery.trim().toLowerCase();
    if (!q) return arrivalKeywords;
    return arrivalKeywords.filter(
      (k) =>
        k.keyword.toLowerCase().includes(q) ||
        k.source_name.toLowerCase().includes(q) ||
        k.top_landing_path.toLowerCase().includes(q)
    );
  }, [arrivalKeywords, textQuery]);

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs overflow-hidden flex flex-col">
      <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
              <Tag size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Hangi Kelimelerden &amp; Hangi Konulara Gelindi? (Kelime &amp; Giriş Niyeti)
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                ChatGPT / Google / Bing üzerinden hangi ürün veya kategori konularına düşüldüğü, reklam kelimeleri (`utm_term`) ve site içi aramalar
              </p>
            </div>
          </div>

          <div className="inline-flex p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-bold self-start lg:self-auto">
            {[
              { id: "intents" as const, label: `AI & Arama Giriş Sayfaları (${landingIntents.length})`, icon: Compass },
              { id: "utm_terms" as const, label: `Reklam & Query Kelimeleri (${arrivalKeywords.length})`, icon: Sparkles },
              { id: "internal_search" as const, label: `Site İçi Aramalar (${internalKeywords.length})`, icon: Search },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = subTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSubTab(tab.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    active
                      ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                  }`}
                >
                  <Icon size={13} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Explanatory note about browser Referer privacy */}
        <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-900/60 flex items-start gap-2.5 text-xs text-indigo-950 dark:text-indigo-200">
          <Info size={16} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
          <span>
            <strong>Not:</strong> Google, Yandex, Bing ve ChatGPT gizlilik politikası gereği tarayıcı yönlendirmesindeki ham arama/prompt kelimesini gizler. Aşağıda
            <strong> (1) AI ve arama motorlarının ziyaretçiyi düşürdüğü ürün/kategori konularını</strong>,
            <strong> (2) yakalanan `utm_term` / harici query kelimelerini</strong> ve
            <strong> (3) vitrin içi arama sorgularını</strong> görebilirsiniz. Gerçek Google organik kelimeleri için Faz 2&apos;de Google Search Console API bağlanabilir.
          </span>
        </div>

        {/* Filter bar */}
        {subTab !== "internal_search" && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={textQuery}
                onChange={(e) => setTextQuery(e.target.value)}
                placeholder="Konu, URL yolu, kaynak veya kelime ara..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {subTab === "intents" && (
              <div className="inline-flex items-center gap-1.5">
                {[
                  { id: "all" as const, label: "Tümü" },
                  { id: "ai_assistant" as const, label: "Sadece Yapay Zeka" },
                  { id: "search" as const, label: "Sadece Arama Motorları" },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSourceFilter(f.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                      sourceFilter === f.id
                        ? "bg-zinc-900 text-white border-zinc-900 dark:bg-emerald-600 dark:border-emerald-600"
                        : "bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sub-view 1: Landing Page Intents */}
      {subTab === "intents" && (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/80 dark:bg-zinc-950/60 text-[11px] font-bold uppercase tracking-wider text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
                <th className="py-3 px-4">Kaynak</th>
                <th className="py-3 px-4">Çıkarılan Konu / Ürün Niyeti</th>
                <th className="py-3 px-4">Giriş URL&apos;i</th>
                <th className="py-3 px-4">Oturum / Kişi</th>
                <th className="py-3 px-4 text-right">Ürün İnceleme</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
              {filteredIntents.map((item, idx) => {
                const meta = TRAFFIC_CHANNEL_META[item.channel];
                return (
                  <tr
                    key={`${item.source_name}-${item.path}-${idx}`}
                    className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40"
                  >
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${meta.badgeClass}`}>
                        {item.source_name}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-zinc-900 dark:text-zinc-100 max-w-[260px] truncate" title={item.inferred_topic}>
                      {item.inferred_topic}
                    </td>
                    <td className="py-3 px-4 font-mono text-zinc-600 dark:text-zinc-300 max-w-[280px] truncate">
                      <Link
                        href={item.path || "/"}
                        target="_blank"
                        className="inline-flex items-center gap-1 hover:text-emerald-600"
                      >
                        <span className="truncate">{item.path}</span>
                        <ExternalLink size={11} className="shrink-0" />
                      </Link>
                    </td>
                    <td className="py-3 px-4 tabular-nums whitespace-nowrap">
                      <strong className="text-zinc-900 dark:text-zinc-100">
                        {item.sessions.toLocaleString("tr-TR")}
                      </strong>
                      <span className="text-zinc-400 ml-1">/ {item.visitors.toLocaleString("tr-TR")} kişi</span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {item.product_views.toLocaleString("tr-TR")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredIntents.length === 0 && (
            <div className="py-10 text-center text-xs text-zinc-400">
              Seçili filtre için AI / arama giriş sayfası kaydı bulunamadı.
            </div>
          )}
        </div>
      )}

      {/* Sub-view 2: First-party UTM & Referrer Query Keywords */}
      {subTab === "utm_terms" && (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/80 dark:bg-zinc-950/60 text-[11px] font-bold uppercase tracking-wider text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
                <th className="py-3 px-4">Geliş Kelimesi</th>
                <th className="py-3 px-4">Tip</th>
                <th className="py-3 px-4">Kaynak / Kampanya</th>
                <th className="py-3 px-4">Giriş Sayfası</th>
                <th className="py-3 px-4 text-right">Oturum / Kişi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
              {filteredArrivalKeywords.map((kw, idx) => (
                <tr key={`${kw.keyword}-${kw.source_name}-${idx}`} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40">
                  <td className="py-3 px-4 font-bold text-zinc-900 dark:text-zinc-100">
                    &ldquo;{kw.keyword}&rdquo;
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800">
                      {kw.keyword_type === "paid_utm_term" ? "Reklam (utm_term)" : "Referrer Sorgusu"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-zinc-700 dark:text-zinc-300">
                    <span className="font-semibold">{kw.source_name}</span>
                    {kw.campaign && kw.campaign !== "-" && (
                      <span className="text-zinc-400 ml-1">({kw.campaign})</span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono text-zinc-600 dark:text-zinc-400 truncate max-w-[240px]">
                    {kw.top_landing_path}
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums">
                    <strong>{kw.sessions.toLocaleString("tr-TR")}</strong>
                    <span className="text-zinc-400 ml-1">/ {kw.visitors.toLocaleString("tr-TR")} kişi</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredArrivalKeywords.length === 0 && (
            <div className="py-10 px-6 text-center text-xs text-zinc-400">
              Bu periyotta henüz `utm_term` reklam kelimesi veya açık arama query parametresi gelmemiş. Reklam kampanyalarına `?utm_term=&#123;keyword&#125;` eklendiğinde kelimeler otomatik olarak burada listelenir.
            </div>
          )}
        </div>
      )}

      {/* Sub-view 3: Internal Search Queries */}
      {subTab === "internal_search" && (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/80 dark:bg-zinc-950/60 text-[11px] font-bold uppercase tracking-wider text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
                <th className="py-3 px-4">Vitrin İçi Aranan Kelime</th>
                <th className="py-3 px-4">Arama Sayısı</th>
                <th className="py-3 px-4">Ort. Sonuç</th>
                <th className="py-3 px-4">Tıklama &amp; CTR</th>
                <th className="py-3 px-4 text-right">Baskın Dil / Ülke</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
              {internalKeywords.map((item) => (
                <tr key={`${item.query}-${item.top_lang}`} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40">
                  <td className="py-3 px-4 font-bold text-zinc-900 dark:text-zinc-100">{item.query}</td>
                  <td className="py-3 px-4 font-black text-zinc-800 dark:text-zinc-200 tabular-nums">
                    {item.searches.toLocaleString("tr-TR")}
                  </td>
                  <td className="py-3 px-4 text-zinc-600 dark:text-zinc-300">
                    {Math.round(item.avg_results)} ürün
                  </td>
                  <td className="py-3 px-4 tabular-nums">
                    {item.clicks} tık (<strong>%{item.ctr_pct.toFixed(1)}</strong>)
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-zinc-500">
                    {item.top_lang} / {item.top_country}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {internalKeywords.length === 0 && (
            <div className="py-10 text-center text-xs text-zinc-400">
              Bu periyotta site içi arama kelimesi kaydı bulunamadı.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
