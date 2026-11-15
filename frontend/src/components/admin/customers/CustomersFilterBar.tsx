"use client";

import React from "react";
import { Download, Filter, RotateCcw, Search } from "lucide-react";
import {
  Customer,
  CustomerCountryBreakdown,
  CustomerFiltersState,
  CustomerPeriodFilter,
  CustomerSortOption,
  CustomerStatusFilter,
  downloadCustomersCsv,
} from "./customerTypes";

interface CustomersFilterBarProps {
  filters: CustomerFiltersState;
  countries: CustomerCountryBreakdown[];
  resultCount: number;
  loading: boolean;
  customers: Customer[];
  onChange: (next: CustomerFiltersState) => void;
  onReset: () => void;
}

const PERIOD_OPTIONS: Array<{ value: CustomerPeriodFilter; label: string }> = [
  { value: "", label: "Tüm Zamanlar" },
  { value: "today", label: "Bugün" },
  { value: "yesterday", label: "Dün" },
  { value: "7d", label: "Son 7 Gün" },
  { value: "30d", label: "Son 30 Gün" },
  { value: "this_month", label: "Bu Ay" },
];

const STATUS_OPTIONS: Array<{ value: CustomerStatusFilter; label: string }> = [
  { value: "", label: "Tüm Durumlar" },
  { value: "online", label: "Şu An Çevrimiçi" },
  { value: "active", label: "Aktif Üyeler" },
  { value: "verified", label: "E-Posta Onaylı" },
  { value: "unverified", label: "Onay Bekleyen" },
  { value: "with_orders", label: "Sipariş Verenler" },
  { value: "with_cart", label: "Aktif Sepeti Olanlar" },
  { value: "blocked", label: "Blokeli Üyeler" },
];

const SORT_OPTIONS: Array<{ value: CustomerSortOption; label: string }> = [
  { value: "newest", label: "En Yeni Kayıt" },
  { value: "oldest", label: "En Eski Kayıt" },
  { value: "last_active", label: "Son Aktiflik" },
  { value: "most_orders", label: "En Çok Sipariş" },
  { value: "highest_spend", label: "En Yüksek B2B Harcama" },
  { value: "most_engaged", label: "En Yüksek Etkileşim" },
];

export function CustomersFilterBar({
  filters,
  countries,
  resultCount,
  loading,
  customers,
  onChange,
  onReset,
}: CustomersFilterBarProps) {
  const hasActiveFilters =
    filters.search.trim() !== "" ||
    (filters.country !== "" && filters.country !== "ALL") ||
    filters.period !== "" ||
    filters.status !== "" ||
    filters.sort !== "newest";

  return (
    <div className="glass-card bg-white p-4 rounded-2xl border border-zinc-200/80 shadow-xs space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        <div className="md:col-span-4 relative">
          <label htmlFor="customer-search-input" className="sr-only">
            Müşteri ara
          </label>
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="customer-search-input"
            type="text"
            placeholder="İsim, e-posta, tel, ülke, şehir veya IP..."
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            className="w-full pl-10 pr-3.5 py-2.5 bg-zinc-50/70 border border-zinc-200 rounded-xl text-xs font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
          />
        </div>

        <div className="md:col-span-3">
          <label htmlFor="customer-country-select" className="sr-only">
            Ülke filtresi
          </label>
          <select
            id="customer-country-select"
            value={filters.country || "ALL"}
            onChange={(e) => onChange({ ...filters, country: e.target.value })}
            className="w-full px-3 py-2.5 bg-zinc-50/70 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
          >
            <option value="ALL">Tüm Ülkeler</option>
            <option value="FOREIGN">Sadece Yurtdışı (TR Hariç)</option>
            {countries
              .filter((c) => c.country_code !== "UNKNOWN")
              .map((c) => (
                <option key={c.country_code} value={c.country_code}>
                  {c.country_code} — {c.country_name} ({c.customer_count})
                </option>
              ))}
            <option value="UNKNOWN">Konumu Bilinmeyen</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label htmlFor="customer-status-select" className="sr-only">
            Durum filtresi
          </label>
          <select
            id="customer-status-select"
            value={filters.status}
            onChange={(e) =>
              onChange({ ...filters, status: e.target.value as CustomerStatusFilter })
            }
            className="w-full px-3 py-2.5 bg-zinc-50/70 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value || "all"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3">
          <label htmlFor="customer-sort-select" className="sr-only">
            Sıralama
          </label>
          <select
            id="customer-sort-select"
            value={filters.sort}
            onChange={(e) =>
              onChange({ ...filters, sort: e.target.value as CustomerSortOption })
            }
            className="w-full px-3 py-2.5 bg-zinc-50/70 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                Sırala: {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-100">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-500 mr-1">
            <Filter className="w-3.5 h-3.5" />
            Kayıt Zamanı:
          </span>
          {PERIOD_OPTIONS.map((opt) => {
            const active = filters.period === opt.value;
            return (
              <button
                key={opt.value || "all"}
                type="button"
                onClick={() => onChange({ ...filters, period: opt.value })}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors cursor-pointer ${
                  active
                    ? "bg-zinc-900 text-white border-zinc-900"
                    : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100 hover:text-zinc-900"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-zinc-500 tabular-nums">
            {loading ? "Filtreleniyor..." : `${resultCount} müşteri gösteriliyor`}
          </span>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-[11px] font-semibold text-zinc-700 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Temizle
            </button>
          )}

          <button
            type="button"
            onClick={() => downloadCustomersCsv(customers)}
            disabled={customers.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-[11px] font-semibold transition-colors disabled:opacity-40 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            CSV İndir
          </button>
        </div>
      </div>
    </div>
  );
}
