"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ExternalLink,
  Search,
  SearchX,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import {
  BiSearchMining,
  formatRelativeTimeTr,
  getCountryLabelTr,
} from "./biTypes";
import CountryFlagBadge from "./CountryFlagBadge";

export interface BiSearchMiningTabProps {
  readonly searchMining: BiSearchMining;
}

export default function BiSearchMiningTab({ searchMining }: BiSearchMiningTabProps) {
  const [keywordFilter, setKeywordFilter] = useState<string>("");

  const filteredTopSearches = useMemo(() => {
    const q = keywordFilter.trim().toLowerCase();
    if (!q) return searchMining.top_searches;
    return searchMining.top_searches.filter((item) =>
      item.query.toLowerCase().includes(q)
    );
  }, [searchMining.top_searches, keywordFilter]);

  const filteredZeroResults = useMemo(() => {
    const q = keywordFilter.trim().toLowerCase();
    if (!q) return searchMining.zero_result_searches;
    return searchMining.zero_result_searches.filter((item) =>
      item.query.toLowerCase().includes(q)
    );
  }, [searchMining.zero_result_searches, keywordFilter]);

  const avgCtrPct = useMemo(() => {
    const list = searchMining.top_searches;
    if (list.length === 0) return 0;
    const sum = list.reduce((acc, item) => acc + item.ctr_pct, 0);
    return sum / list.length;
  }, [searchMining.top_searches]);

  const isZeroRateHigh = searchMining.zero_result_rate_pct >= 15;

  return (
    <div className="flex flex-col gap-6">
      {/* Top Search KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs">
          <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
            Toplam Katalog Araması
          </span>
          <div className="text-2xl font-black text-zinc-900 dark:text-zinc-100 mt-1">
            {searchMining.total_searches.toLocaleString("tr-TR")}
          </div>
          <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 block">
            Toptan alıcıların iç arama sorguları
          </span>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs">
          <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
            Sıfır Sonuç Oranı (Boş Arama)
          </span>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-2xl font-black text-zinc-900 dark:text-zinc-100">
              %{searchMining.zero_result_rate_pct.toFixed(1)}
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                isZeroRateHigh
                  ? "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300"
                  : "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
              }`}
            >
              {isZeroRateHigh ? "Fırsat Kaybı Riski" : "Düşük Kayıp"}
            </span>
          </div>
          <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 block">
            Sonuç dönmeyen arama yüzdesi
          </span>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs">
          <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
            Karşılanmayan Talep Kelimesi
          </span>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {searchMining.zero_result_searches.length.toLocaleString("tr-TR")} Kelime
          </div>
          <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 block">
            Tedarikçi / ürün eklenmesi gereken nişler
          </span>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs">
          <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
            Ortalama Arama CTR
          </span>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            %{avgCtrPct.toFixed(1)}
          </div>
          <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 block">
            Arama sonrası ürüne tıklama başarısı
          </span>
        </div>
      </div>

      {/* Filter Input */}
      <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={keywordFilter}
            onChange={(e) => setKeywordFilter(e.target.value)}
            placeholder="Aranan toptan kelimeyi filtrele (örn: keten takım, büyük beden, abiye)..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-emerald-500"
          />
        </div>
        <Link
          href="/admin/suppliers"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline"
        >
          <Sparkles size={14} />
          <span>Eksik Kategoriler İçin XML / Üretici Ekle</span>
          <ExternalLink size={12} />
        </Link>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Prominent Opportunity Radar: Zero-Result Searches (results_count = 0) */}
        <div className="xl:col-span-5 bg-gradient-to-b from-amber-50/70 via-white to-white dark:from-amber-950/20 dark:via-zinc-900 dark:to-zinc-900 rounded-3xl border border-amber-200/90 dark:border-amber-900/60 shadow-xs overflow-hidden flex flex-col">
          <div className="p-6 border-b border-amber-200/60 dark:border-amber-900/40">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-2xl bg-amber-500/15 text-amber-700 dark:text-amber-400 shrink-0">
                <SearchX size={20} />
              </div>
              <div>
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[10px] font-black uppercase tracking-wider mb-1">
                  <AlertTriangle size={11} />
                  <span>Ticari Fırsat Radarı (results_count = 0)</span>
                </div>
                <h2 className="text-sm font-black text-zinc-900 dark:text-zinc-100">
                  Karşılanmayan Talep / Sıfır Sonuçlu Aramalar
                </h2>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                  Toptan alıcıların vitrinde arayıp <strong>0 ürün</strong> bulduğu sıcak talepler. Bu kelimelere uygun Merter üreticilerini davet ederek veya eşanlamlı etiket tanımlayarak anında satış yakalayabilirsiniz.
                </p>
              </div>
            </div>
          </div>

          <div className="divide-y divide-zinc-100 dark:divide-zinc-800 overflow-y-auto max-h-[460px]">
            {filteredZeroResults.map((item) => (
              <div
                key={`${item.query}-${item.top_country}`}
                className="p-4 flex items-center justify-between gap-3 hover:bg-amber-50/40 dark:hover:bg-zinc-800/40 transition-colors"
              >
                <div className="min-w-0">
                  <div className="font-bold text-zinc-900 dark:text-zinc-100 text-sm truncate">
                    &ldquo;{item.query}&rdquo;
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                    <span className="inline-flex items-center gap-1.5 font-medium text-zinc-700">
                      <CountryFlagBadge
                        countryCode={item.top_country}
                        title={getCountryLabelTr(item.top_country)}
                      />
                      <span>{getCountryLabelTr(item.top_country)}</span>
                    </span>
                    <span>•</span>
                    <span className="uppercase font-mono">Dil: {item.top_lang}</span>
                    <span>•</span>
                    <span>Son: {formatRelativeTimeTr(item.last_searched_at)}</span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-black">
                    {item.searches} kez arandı
                  </span>
                </div>
              </div>
            ))}

            {filteredZeroResults.length === 0 && (
              <div className="py-12 px-6 text-center text-xs text-zinc-400">
                Bu periyotta sıfır sonuç dönen arama sorgusu kaydedilmedi. Katalog kapsama oranınız çok iyi durumda!
              </div>
            )}
          </div>
        </div>

        {/* Top Searched Wholesale Keywords + CTR */}
        <div className="xl:col-span-7 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs overflow-hidden flex flex-col">
          <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <TrendingUp size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                En Çok Aranan Toptan Kelimeler &amp; Tıklama Oranı (CTR)
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Yüksek hacimli arama terimleri, dönen ortalama model sayısı ve ürüne geçiş başarısı
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50/80 dark:bg-zinc-950/50 text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
                  <th className="py-3 px-4">Arama Terimi</th>
                  <th className="py-3 px-4">Arama Sayısı</th>
                  <th className="py-3 px-4">Ort. Sonuç</th>
                  <th className="py-3 px-4">Tıklama &amp; CTR</th>
                  <th className="py-3 px-4 text-right">Baskın Pazar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
                {filteredTopSearches.map((row) => (
                  <tr key={`${row.query}-${row.top_lang}`} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="py-3 px-4 font-bold text-zinc-900 dark:text-zinc-100">
                      {row.query}
                    </td>
                    <td className="py-3 px-4 font-black text-zinc-800 dark:text-zinc-200">
                      {row.searches.toLocaleString("tr-TR")}
                    </td>
                    <td className="py-3 px-4 text-zinc-600 dark:text-zinc-300">
                      {Math.round(row.avg_results)} ürün
                    </td>
                    <td className="py-3 px-4 min-w-[150px]">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                          {row.clicks} tık
                        </span>
                        <span className="font-bold text-emerald-700 dark:text-emerald-400">
                          %{row.ctr_pct.toFixed(1)}
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${Math.min(100, Math.max(4, row.ctr_pct))}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap font-semibold text-zinc-700 dark:text-zinc-300">
                      <span className="inline-flex items-center justify-end gap-1.5">
                        <CountryFlagBadge
                          countryCode={row.top_country}
                          title={getCountryLabelTr(row.top_country)}
                        />
                        <span>{getCountryLabelTr(row.top_country)}</span>
                        <span className="text-zinc-400">•</span>
                        <span className="font-mono uppercase text-[11px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700">
                          {row.top_lang}
                        </span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredTopSearches.length === 0 && (
              <div className="py-12 text-center text-xs text-zinc-400">
                Henüz arama terimi istatistiği bulunmuyor.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
