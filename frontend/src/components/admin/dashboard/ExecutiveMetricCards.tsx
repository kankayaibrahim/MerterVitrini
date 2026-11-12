"use client";

import React from "react";
import Link from "next/link";
import { TrendingUp, ShoppingCart, Package, Activity, ArrowUpRight } from "lucide-react";
import { ExecutiveDashboardStats } from "@/types/dashboard";

interface ExecutiveMetricCardsProps {
  readonly stats: ExecutiveDashboardStats | null;
  readonly loading: boolean;
}

export default function ExecutiveMetricCards({
  stats,
  loading,
}: Readonly<ExecutiveMetricCardsProps>) {
  const fin = stats?.financials;
  const cat = stats?.catalog;
  const trf = stats?.traffic;

  const totalRev = fin?.total_revenue ?? 0;
  const aov = fin?.avg_order_value ?? 0;
  const totalOrders = fin?.total_orders ?? 0;
  const pendingOrders = fin?.pending_orders ?? 0;
  const approvedOrders = fin?.approved_orders ?? 0;

  const activeProducts = cat?.active_products ?? 0;
  const totalStock = cat?.total_stock_units ?? 0;
  const activeBrands = cat?.active_brands ?? 0;

  const liveVisitors = trf?.live_visitors_15m ?? 0;
  const todayVisitors = trf?.today_visitors ?? 0;
  const todayPageviews = trf?.today_pageviews ?? 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. B2B Ciro / GMV (TCMB FX-Normalized TRY Equivalent) */}
      <div className="glass-card bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-xs flex flex-col justify-between hover:border-emerald-300 transition-all">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider block">
              Toplam B2B Hacmi (GMV)
            </span>
            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-1.5 py-0.5 rounded-md inline-block mt-1">
              TCMB Kur Karşılığı (TRY)
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <TrendingUp size={20} />
          </div>
        </div>
        <div>
          <div className="text-2xl font-black text-zinc-900 tracking-tight">
            {loading ? "..." : `₺${totalRev.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </div>
          <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1 flex-wrap">
            <span className="font-semibold text-emerald-600">AOV:</span>
            <span>₺{aov.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / sipariş</span>
            <span className="text-[10px] text-zinc-400">• TCMB Kur Karşılığı</span>
          </p>
        </div>
      </div>

      {/* 2. B2B Siparişler */}
      <Link
        href="/admin/orders"
        className="glass-card bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-xs flex flex-col justify-between hover:border-indigo-300 transition-all group"
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
            B2B Siparişler
          </span>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:scale-105 transition-transform">
            <ShoppingCart size={20} />
          </div>
        </div>
        <div>
          <div className="text-2xl font-black text-zinc-900 tracking-tight flex items-center justify-between">
            <span>{loading ? "..." : `${totalOrders} Adet`}</span>
            <ArrowUpRight size={16} className="text-zinc-400 group-hover:text-indigo-600 transition-colors" />
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Bekleyen: <strong className="text-amber-600">{pendingOrders}</strong> • Onay: <strong className="text-emerald-600">{approvedOrders}</strong>
          </p>
        </div>
      </Link>

      {/* 3. Toptan Katalog & Stok */}
      <Link
        href="/admin/products"
        className="glass-card bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-xs flex flex-col justify-between hover:border-amber-300 transition-all group"
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
            Aktif Katalog & Stok
          </span>
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 group-hover:scale-105 transition-transform">
            <Package size={20} />
          </div>
        </div>
        <div>
          <div className="text-2xl font-black text-zinc-900 tracking-tight flex items-center justify-between">
            <span>{loading ? "..." : `${activeProducts.toLocaleString("tr-TR")} Ürün`}</span>
            <ArrowUpRight size={16} className="text-zinc-400 group-hover:text-amber-600 transition-colors" />
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Toplam: <strong className="text-zinc-700">{totalStock.toLocaleString("tr-TR")} Seri/Adet</strong> • {activeBrands} Marka
          </p>
        </div>
      </Link>

      {/* 4. Canlı Trafik & Ziyaretçiler */}
      <Link
        href="/admin/analytics"
        className="glass-card bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-xs flex flex-col justify-between hover:border-rose-300 transition-all group"
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
            </span>
            <span>Canlı Ziyaretçi</span>
          </span>
          <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 group-hover:scale-105 transition-transform">
            <Activity size={20} />
          </div>
        </div>
        <div>
          <div className="text-2xl font-black text-zinc-900 tracking-tight flex items-center justify-between">
            <span>{loading ? "..." : `${liveVisitors} Aktif`}</span>
            <ArrowUpRight size={16} className="text-zinc-400 group-hover:text-rose-600 transition-colors" />
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Bugün: <strong className="text-zinc-700">{todayVisitors} Tekil</strong> ({todayPageviews} Gösterim)
          </p>
        </div>
      </Link>
    </div>
  );
}
