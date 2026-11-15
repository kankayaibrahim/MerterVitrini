"use client";

import React, { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  ChevronDown,
  ChevronUp,
  Globe2,
  MapPin,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import CountryFlagBadge from "../analytics/CountryFlagBadge";
import {
  CustomersOverviewResponse,
  formatCurrencyTry,
} from "./customerTypes";

const CustomersWorldMap = dynamic(() => import("./CustomersWorldMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[380px] sm:h-[420px] rounded-2xl border border-zinc-200 bg-zinc-50 flex flex-col items-center justify-center gap-2 text-zinc-500">
      <div className="w-7 h-7 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      <span className="text-xs font-medium">OpenStreetMap haritası yükleniyor...</span>
    </div>
  ),
});

interface CustomersGeoInsightsSectionProps {
  overview: CustomersOverviewResponse | null;
  loading: boolean;
  syncingGeo: boolean;
  syncMessage: string | null;
  selectedCountry: string;
  onSelectCountry: (country: string) => void;
  onSyncGeo: () => void;
  onSelectCustomerById: (customerId: string) => void;
}

export function CustomersGeoInsightsSection({
  overview,
  loading,
  syncingGeo,
  syncMessage,
  selectedCountry,
  onSelectCountry,
  onSyncGeo,
  onSelectCustomerById,
}: CustomersGeoInsightsSectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [rightTab, setRightTab] = useState<"countries" | "trend">("countries");

  const countries = overview?.countries ?? [];
  const daily = useMemo(
    () => overview?.daily_registrations ?? [],
    [overview?.daily_registrations]
  );
  const mapPoints = overview?.map_points ?? [];
  const kpis = overview?.kpis;

  const maxDailyCount = useMemo(
    () => Math.max(1, ...daily.map((d) => d.count)),
    [daily]
  );

  const unresolvedCount = Math.max(
    0,
    (kpis?.total_customers ?? 0) - (kpis?.resolved_geo_count ?? 0)
  );

  return (
    <section
      aria-label="Coğrafi dağılım ve kayıt eğilimi"
      className="glass-card bg-white rounded-3xl border border-zinc-200/80 shadow-xs overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-zinc-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Globe2 className="w-4.5 h-4.5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-zinc-900">
              Küresel Müşteri Dağılımı (OpenStreetMap) &amp; Kayıt Eğilimi
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {kpis ? (
                <>
                  <span className="font-semibold text-zinc-700 tabular-nums">
                    {kpis.resolved_geo_count}/{kpis.total_customers}
                  </span>{" "}
                  müşterinin ülke/konumu çözümlendi •{" "}
                  <span className="font-semibold text-indigo-700 tabular-nums">
                    {kpis.countries_count}
                  </span>{" "}
                  farklı ülke
                  {unresolvedCount > 0 ? (
                    <span className="text-amber-700 font-medium">
                      {" "}
                      ({unresolvedCount} kayıt çözümlenebilir)
                    </span>
                  ) : null}
                </>
              ) : (
                "Ülke bazlı müşteri yoğunluğu ve günlük kayıt trendleri"
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {syncMessage && (
            <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold">
              {syncMessage}
            </span>
          )}
          <button
            type="button"
            onClick={onSyncGeo}
            disabled={syncingGeo || loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncingGeo ? "animate-spin" : ""}`} />
            {syncingGeo ? "Konumlar Çözümleniyor..." : "Konumları Şimdi Çözümle"}
          </button>

          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-semibold text-zinc-700 transition-colors cursor-pointer"
            aria-expanded={!collapsed}
          >
            {collapsed ? (
              <>
                Haritayı Aç <ChevronDown className="w-3.5 h-3.5" />
              </>
            ) : (
              <>
                Gizle <ChevronUp className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-7 space-y-2.5">
            <CustomersWorldMap
              points={mapPoints}
              selectedCountry={selectedCountry}
              onFilterCountry={(code) =>
                onSelectCountry(selectedCountry === code ? "ALL" : code)
              }
              onSelectCustomerById={onSelectCustomerById}
            />
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500 px-1">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                Haritada pinlere tıklayarak o ülke/şehirdeki son kayıtları açabilir veya tabloyu filtreleyebilirsiniz.
              </span>
              {selectedCountry !== "" && selectedCountry !== "ALL" && (
                <button
                  type="button"
                  onClick={() => onSelectCountry("ALL")}
                  className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                >
                  Harita Ülke Filtresini Temizle
                </button>
              )}
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col gap-3">
            <div
              role="tablist"
              aria-label="Coğrafi analiz görünümleri"
              className="grid grid-cols-2 p-1 rounded-2xl bg-zinc-100 border border-zinc-200/70"
            >
              <button
                type="button"
                role="tab"
                aria-selected={rightTab === "countries"}
                onClick={() => setRightTab("countries")}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  rightTab === "countries"
                    ? "bg-white text-zinc-900 shadow-xs"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                <Globe2 className="w-3.5 h-3.5" />
                Ülkelere Göre ({countries.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={rightTab === "trend"}
                onClick={() => setRightTab("trend")}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  rightTab === "trend"
                    ? "bg-white text-zinc-900 shadow-xs"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                30 Günlük Kayıt Eğilimi
              </button>
            </div>

            {rightTab === "countries" ? (
              <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/40 p-3 flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-1.5 pb-1.5 border-b border-zinc-200/70">
                  <button
                    type="button"
                    onClick={() => onSelectCountry("ALL")}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors cursor-pointer ${
                      selectedCountry === "" || selectedCountry === "ALL"
                        ? "bg-zinc-900 text-white border-zinc-900"
                        : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-100"
                    }`}
                  >
                    Tümü ({kpis?.total_customers ?? 0})
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onSelectCountry(selectedCountry === "FOREIGN" ? "ALL" : "FOREIGN")
                    }
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors cursor-pointer ${
                      selectedCountry === "FOREIGN"
                        ? "bg-violet-600 text-white border-violet-600"
                        : "bg-white text-violet-700 border-violet-200 hover:bg-violet-50"
                    }`}
                  >
                    Yurtdışı ({kpis?.international_count ?? 0})
                  </button>
                  {unresolvedCount > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        onSelectCountry(selectedCountry === "UNKNOWN" ? "ALL" : "UNKNOWN")
                      }
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors cursor-pointer ${
                        selectedCountry === "UNKNOWN"
                          ? "bg-amber-600 text-white border-amber-600"
                          : "bg-white text-amber-700 border-amber-200 hover:bg-amber-50"
                      }`}
                    >
                      Konumsuz ({unresolvedCount})
                    </button>
                  )}
                </div>

                <div className="max-h-[340px] overflow-y-auto pr-1 space-y-1.5">
                  {countries.length === 0 ? (
                    <div className="py-12 text-center text-xs text-zinc-500">
                      Henüz ülke dağılımı verisi yok.
                    </div>
                  ) : (
                    countries.map((c) => {
                      const isActive =
                        selectedCountry.toUpperCase() === c.country_code.toUpperCase();
                      const widthPercent = Math.max(4, Math.min(100, c.share));
                      return (
                        <button
                          key={c.country_code}
                          type="button"
                          onClick={() =>
                            onSelectCountry(isActive ? "ALL" : c.country_code)
                          }
                          className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                            isActive
                              ? "bg-indigo-50/90 border-indigo-300 ring-1 ring-indigo-400/40"
                              : "bg-white border-zinc-200/70 hover:border-zinc-300 hover:bg-zinc-50/70"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <CountryFlagBadge
                                countryCode={c.country_code === "UNKNOWN" ? "" : c.country_code}
                                title={c.country_name}
                              />
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-zinc-900 truncate">
                                  {c.country_name}
                                  {c.country_code !== "UNKNOWN" && (
                                    <span className="ml-1.5 text-[10px] font-semibold text-zinc-400 uppercase">
                                      {c.country_code}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-zinc-500 flex items-center gap-2 mt-0.5">
                                  {c.today_count > 0 && (
                                    <span className="text-emerald-700 font-semibold">
                                      +{c.today_count} bugün
                                    </span>
                                  )}
                                  {c.online_count > 0 && (
                                    <span className="text-teal-700 font-semibold">
                                      • {c.online_count} online
                                    </span>
                                  )}
                                  {c.orders_count > 0 && (
                                    <span>
                                      • {c.orders_count} sip. ({formatCurrencyTry(c.total_spend)})
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <span className="text-xs font-bold text-zinc-900 tabular-nums">
                                {c.customer_count}
                              </span>
                              <span className="ml-1 text-[10px] font-medium text-zinc-500 tabular-nums">
                                (%{c.share.toFixed(1)})
                              </span>
                            </div>
                          </div>

                          <div className="mt-2 h-1.5 w-full rounded-full bg-zinc-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                isActive ? "bg-indigo-600" : "bg-indigo-500/80"
                              }`}
                              style={{ width: `${widthPercent}%` }}
                            />
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/40 p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-zinc-800">
                    Son 30 Günlük Üye Kayıtları (TSİ)
                  </span>
                  <div className="flex items-center gap-3 text-[11px] font-medium text-zinc-600">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-xs bg-indigo-600 inline-block" />
                      Türkiye
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" />
                      Yurtdışı
                    </span>
                  </div>
                </div>

                <div className="h-[240px] flex items-end gap-1 pt-4 border-b border-zinc-200 pb-1">
                  {daily.map((d) => {
                    const totalPct = Math.round((d.count / maxDailyCount) * 100);
                    const trPct =
                      d.count > 0 ? Math.round((d.turkey_count / d.count) * totalPct) : 0;
                    const intlPct =
                      d.count > 0
                        ? Math.max(0, totalPct - trPct)
                        : 0;
                    const tooltip = `${d.date}: Toplam ${d.count} kayıt (TR: ${d.turkey_count}, Yurtdışı: ${d.international_count})`;

                    return (
                      <div
                        key={d.date}
                        title={tooltip}
                        className="flex-1 h-full flex flex-col justify-end items-center group relative"
                      >
                        {d.count > 0 && (
                          <span className="text-[9px] font-bold text-zinc-700 mb-0.5 tabular-nums opacity-80 group-hover:opacity-100">
                            {d.count}
                          </span>
                        )}
                        <div className="w-full max-w-[14px] flex flex-col justify-end rounded-t-sm overflow-hidden bg-zinc-100/80 h-full">
                          <div
                            className="w-full bg-emerald-500 transition-all"
                            style={{ height: `${intlPct}%` }}
                          />
                          <div
                            className="w-full bg-indigo-600 transition-all"
                            style={{ height: `${trPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between text-[10px] font-medium text-zinc-500">
                  <span>{daily[0]?.date ?? "-"}</span>
                  <span>Son 15 gün</span>
                  <span className="font-bold text-zinc-800">
                    Bugün ({daily[daily.length - 1]?.date ?? "-"}):{" "}
                    {daily[daily.length - 1]?.count ?? 0} kayıt
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
