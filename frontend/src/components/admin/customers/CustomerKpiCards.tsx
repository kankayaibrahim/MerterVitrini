"use client";

import React from "react";
import {
  Users,
  UserPlus,
  CalendarRange,
  Globe2,
  Activity,
  ShoppingBag,
} from "lucide-react";
import {
  CustomerOverviewKPIs,
  CustomerPeriodFilter,
  CustomerStatusFilter,
} from "./customerTypes";

interface CustomerKpiCardsProps {
  kpis: CustomerOverviewKPIs | null;
  loading: boolean;
  activePeriod: CustomerPeriodFilter;
  activeStatus: CustomerStatusFilter;
  activeCountry: string;
  onSelectPeriod: (period: CustomerPeriodFilter) => void;
  onSelectStatus: (status: CustomerStatusFilter) => void;
  onSelectCountry: (country: string) => void;
  onResetAll: () => void;
}

export function CustomerKpiCards({
  kpis,
  loading,
  activePeriod,
  activeStatus,
  activeCountry,
  onSelectPeriod,
  onSelectStatus,
  onSelectCountry,
  onResetAll,
}: CustomerKpiCardsProps) {
  if (loading && !kpis) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div
            key={idx}
            className="glass-card bg-white p-4 rounded-2xl border border-zinc-200/80 shadow-xs animate-pulse"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="h-3 w-24 bg-zinc-200 rounded" />
              <div className="w-8 h-8 rounded-xl bg-zinc-100" />
            </div>
            <div className="h-7 w-16 bg-zinc-200 rounded mb-2" />
            <div className="h-3 w-28 bg-zinc-100 rounded" />
          </div>
        ))}
      </div>
    );
  }

  const data = kpis ?? {
    total_customers: 0,
    today_count: 0,
    yesterday_count: 0,
    last_7_days_count: 0,
    last_30_days_count: 0,
    this_month_count: 0,
    verified_count: 0,
    blocked_count: 0,
    online_now_count: 0,
    active_today_count: 0,
    with_orders_count: 0,
    with_active_cart_count: 0,
    countries_count: 0,
    international_count: 0,
    international_share: 0,
    resolved_geo_count: 0,
  };

  const hasNoFilter =
    activePeriod === "" && activeStatus === "" && (activeCountry === "" || activeCountry === "ALL");

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5">
      <button
        type="button"
        onClick={onResetAll}
        className={`text-left glass-card bg-white p-4 rounded-2xl border transition-all cursor-pointer group ${
          hasNoFilter
            ? "border-indigo-300 ring-2 ring-indigo-500/15 shadow-sm"
            : "border-zinc-200/80 shadow-xs hover:border-zinc-300 hover:shadow-sm"
        }`}
      >
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
            Toplam Üye
          </span>
          <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 group-hover:scale-105 transition-transform">
            <Users className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-bold text-zinc-900 tabular-nums">
          {data.total_customers.toLocaleString("tr-TR")}
        </div>
        <div className="mt-1.5 text-[11px] font-medium text-zinc-500 flex items-center gap-1.5">
          <span className="text-emerald-700 font-semibold">{data.verified_count} onaylı</span>
          <span>•</span>
          <span className={data.blocked_count > 0 ? "text-rose-600 font-semibold" : ""}>
            {data.blocked_count} blokeli
          </span>
        </div>
      </button>

      <button
        type="button"
        onClick={() => onSelectPeriod(activePeriod === "today" ? "" : "today")}
        className={`text-left glass-card bg-white p-4 rounded-2xl border transition-all cursor-pointer group ${
          activePeriod === "today"
            ? "border-emerald-400 ring-2 ring-emerald-500/20 shadow-sm bg-emerald-50/20"
            : "border-zinc-200/80 shadow-xs hover:border-emerald-300 hover:shadow-sm"
        }`}
      >
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
            Bugün Kaydolan
          </span>
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 group-hover:scale-105 transition-transform">
            <UserPlus className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-zinc-900 tabular-nums">
            {data.today_count.toLocaleString("tr-TR")}
          </span>
          {data.today_count > 0 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
              Yeni
            </span>
          )}
        </div>
        <div className="mt-1.5 text-[11px] font-medium text-zinc-500">
          Dün: <span className="font-semibold text-zinc-700 tabular-nums">{data.yesterday_count}</span> • Bu ay:{" "}
          <span className="font-semibold text-zinc-700 tabular-nums">{data.this_month_count}</span>
        </div>
      </button>

      <button
        type="button"
        onClick={() => onSelectPeriod(activePeriod === "7d" ? "" : "7d")}
        className={`text-left glass-card bg-white p-4 rounded-2xl border transition-all cursor-pointer group ${
          activePeriod === "7d"
            ? "border-sky-400 ring-2 ring-sky-500/20 shadow-sm"
            : "border-zinc-200/80 shadow-xs hover:border-sky-300 hover:shadow-sm"
        }`}
      >
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
            Son 7 Gün
          </span>
          <div className="p-2 rounded-xl bg-sky-50 text-sky-600 group-hover:scale-105 transition-transform">
            <CalendarRange className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-bold text-zinc-900 tabular-nums">
          {data.last_7_days_count.toLocaleString("tr-TR")}
        </div>
        <div className="mt-1.5 text-[11px] font-medium text-zinc-500">
          Son 30 gün:{" "}
          <span className="font-semibold text-zinc-700 tabular-nums">{data.last_30_days_count}</span> kayıt
        </div>
      </button>

      <button
        type="button"
        onClick={() => onSelectCountry(activeCountry === "FOREIGN" ? "ALL" : "FOREIGN")}
        className={`text-left glass-card bg-white p-4 rounded-2xl border transition-all cursor-pointer group ${
          activeCountry === "FOREIGN"
            ? "border-violet-400 ring-2 ring-violet-500/20 shadow-sm"
            : "border-zinc-200/80 shadow-xs hover:border-violet-300 hover:shadow-sm"
        }`}
      >
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
            Ülke & Yurtdışı
          </span>
          <div className="p-2 rounded-xl bg-violet-50 text-violet-600 group-hover:scale-105 transition-transform">
            <Globe2 className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-zinc-900 tabular-nums">
            {data.countries_count}
          </span>
          <span className="text-xs font-semibold text-zinc-500">ülke</span>
        </div>
        <div className="mt-1.5 text-[11px] font-medium text-zinc-500">
          <span className="font-semibold text-violet-700 tabular-nums">
            {data.international_count} yurtdışı
          </span>{" "}
          (%{data.international_share.toFixed(1)})
        </div>
      </button>

      <button
        type="button"
        onClick={() => onSelectStatus(activeStatus === "online" ? "" : "online")}
        className={`text-left glass-card bg-white p-4 rounded-2xl border transition-all cursor-pointer group ${
          activeStatus === "online"
            ? "border-emerald-400 ring-2 ring-emerald-500/20 shadow-sm"
            : "border-zinc-200/80 shadow-xs hover:border-emerald-300 hover:shadow-sm"
        }`}
      >
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
            Şu An Çevrimiçi
          </span>
          <div className="p-2 rounded-xl bg-teal-50 text-teal-600 group-hover:scale-105 transition-transform">
            <Activity className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-zinc-900 tabular-nums">
            {data.online_now_count}
          </span>
          {data.online_now_count > 0 && (
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
          )}
        </div>
        <div className="mt-1.5 text-[11px] font-medium text-zinc-500">
          Bugün aktif:{" "}
          <span className="font-semibold text-zinc-700 tabular-nums">{data.active_today_count}</span> üye
        </div>
      </button>

      <button
        type="button"
        onClick={() => onSelectStatus(activeStatus === "with_orders" ? "" : "with_orders")}
        className={`text-left glass-card bg-white p-4 rounded-2xl border transition-all cursor-pointer group ${
          activeStatus === "with_orders"
            ? "border-amber-400 ring-2 ring-amber-500/20 shadow-sm"
            : "border-zinc-200/80 shadow-xs hover:border-amber-300 hover:shadow-sm"
        }`}
      >
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
            Sipariş & Sepet
          </span>
          <div className="p-2 rounded-xl bg-amber-50 text-amber-600 group-hover:scale-105 transition-transform">
            <ShoppingBag className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-bold text-zinc-900 tabular-nums">
          {data.with_orders_count}
        </div>
        <div className="mt-1.5 text-[11px] font-medium text-zinc-500">
          Aktif sepet:{" "}
          <span className="font-semibold text-amber-700 tabular-nums">{data.with_active_cart_count}</span> üye
        </div>
      </button>
    </div>
  );
}
