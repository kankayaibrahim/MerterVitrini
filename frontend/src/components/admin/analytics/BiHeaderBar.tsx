"use client";

import React from "react";
import {
  Activity,
  BarChart3,
  Bot,
  Download,
  FileJson,
  Filter,
  Globe2,
  PackageSearch,
  Radio,
  RefreshCw,
  Search,
  LucideIcon,
} from "lucide-react";
import { BiPeriod, BiTabId } from "./biTypes";

interface PeriodOption {
  id: BiPeriod;
  label: string;
}

const PERIOD_OPTIONS: PeriodOption[] = [
  { id: "today", label: "Bugün" },
  { id: "24h", label: "24 Saat" },
  { id: "7d", label: "Son 7 Gün" },
  { id: "30d", label: "Son 30 Gün" },
  { id: "90d", label: "Son 90 Gün" },
];

interface TabDefinition {
  id: BiTabId;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  badgeCount?: number;
}

export interface BiHeaderBarProps {
  readonly period: BiPeriod;
  readonly onPeriodChange: (period: BiPeriod) => void;
  readonly activeTab: BiTabId;
  readonly onTabChange: (tab: BiTabId) => void;
  readonly loading: boolean;
  readonly onRefresh: () => void;
  readonly onExportCsv: () => void;
  readonly onExportJson: () => void;
  readonly liveVisitors: number;
  readonly hotLeadsCount: number;
  readonly zeroResultCount: number;
  readonly opportunityProductsCount: number;
}

export default function BiHeaderBar({
  period,
  onPeriodChange,
  activeTab,
  onTabChange,
  loading,
  onRefresh,
  onExportCsv,
  onExportJson,
  liveVisitors,
  hotLeadsCount,
  zeroResultCount,
  opportunityProductsCount,
}: BiHeaderBarProps) {
  const tabs: TabDefinition[] = [
    {
      id: "overview",
      label: "Yönetici Özeti & Trendler",
      shortLabel: "Yönetici Özeti",
      icon: BarChart3,
    },
    {
      id: "funnel",
      label: "B2B Dönüşüm Hunisi & Sıcak Alıcılar",
      shortLabel: "Huni & Sıcak Alıcılar",
      icon: Filter,
      badgeCount: hotLeadsCount,
    },
    {
      id: "search",
      label: "Arama & Talep Madenciliği",
      shortLabel: "Arama Madenciliği",
      icon: Search,
      badgeCount: zeroResultCount,
    },
    {
      id: "geo",
      label: "Küresel İhracat & Kampanya ROI",
      shortLabel: "İhracat & ROI",
      icon: Globe2,
    },
    {
      id: "catalog",
      label: "Ürün/Üretici Hızı & Sayfa Sızıntıları",
      shortLabel: "Ürün Hızı & Sızıntı",
      icon: PackageSearch,
      badgeCount: opportunityProductsCount,
    },
    {
      id: "tech",
      label: "Web Vitals (RUM), Cihaz & SEO Bot",
      shortLabel: "RUM & SEO Bot",
      icon: Bot,
    },
  ];

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs overflow-hidden">
      {/* Top Executive Command Strip */}
      <div className="p-5 sm:p-6 flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-sm">
              <Activity size={18} />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
              İş Zekası (BI) &amp; Veri Madenciliği Merkezi
            </h1>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
              <Radio size={14} className="animate-pulse text-emerald-600 dark:text-emerald-400" />
              <span>{liveVisitors} Canlı Toptan Alıcı</span>
            </div>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 max-w-3xl">
            Gerçek zamanlı B2B dönüşüm hunisi, 0–100 sıcak alıcı skorlama, karşılanmayan arama talebi radarı, ihracat döviz matrisi, Core Web Vitals (RUM) ve SEO/AI bot telemetrisi.
          </p>
        </div>

        {/* Period Switcher + Export + Refresh Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex p-1 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-semibold">
            {PERIOD_OPTIONS.map((item) => {
              const isSelected = period === item.id;
              const btnClass = isSelected
                ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs font-bold"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100";
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onPeriodChange(item.id)}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-xl transition-all cursor-pointer ${btnClass}`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-200 transition-all cursor-pointer"
            title="BI Raporunu CSV (Excel) Olarak İndir"
          >
            <Download size={14} className="text-emerald-600" />
            <span>CSV</span>
          </button>

          <button
            type="button"
            onClick={onExportJson}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-200 transition-all cursor-pointer"
            title="Ham BI Veri Madenciliği Çıktısını JSON Olarak İndir"
          >
            <FileJson size={14} className="text-violet-600" />
            <span>JSON</span>
          </button>

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 transition-all cursor-pointer disabled:opacity-50"
            title="Verileri Yenile"
          >
            <RefreshCw size={16} className={loading ? "animate-spin text-emerald-600" : ""} />
          </button>
        </div>
      </div>

      {/* 6 Analytical Module Tabs */}
      <div className="px-4 sm:px-6 py-2.5 bg-zinc-50/70 dark:bg-zinc-950/40 flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const tabStyle = isActive
            ? "bg-zinc-900 dark:bg-emerald-600 text-white shadow-xs"
            : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100";
          const badgeStyle = isActive
            ? "bg-white/20 text-white"
            : "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300";

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${tabStyle}`}
            >
              <Icon size={15} />
              <span className="hidden 2xl:inline">{tab.label}</span>
              <span className="2xl:hidden">{tab.shortLabel}</span>
              {typeof tab.badgeCount === "number" && tab.badgeCount > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${badgeStyle}`}>
                  {tab.badgeCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
