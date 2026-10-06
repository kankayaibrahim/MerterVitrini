"use client";

import React from "react";
import Link from "next/link";
import { PlusCircle, ShoppingCart, Activity, RefreshCw } from "lucide-react";

interface ExecutiveHeaderProps {
  readonly onRefresh: () => void;
  readonly isRefreshing: boolean;
}

export default function ExecutiveHeader({
  onRefresh,
  isRefreshing,
}: Readonly<ExecutiveHeaderProps>) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-xs">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
            Canlı B2B Platformu
          </span>
        </div>
        <h1 className="text-2xl font-black text-zinc-900 tracking-tight">
          Merter Vitrini Yönetim & B2B Komuta Merkezi
        </h1>
        <p className="text-xs text-zinc-500 mt-0.5">
          Toptan siparişler, tedarikçi ekosistemi, anlık ziyaretçi trafiği ve entegrasyon yönetimi.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-xl transition-colors disabled:opacity-50"
          title="Verileri Canlı Yenile"
        >
          <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
          <span>Yenile</span>
        </button>

        <Link
          href="/admin/analytics"
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/60 rounded-xl transition-colors"
        >
          <Activity size={14} />
          <span>Isı Haritası & Trafik</span>
        </Link>

        <Link
          href="/admin/orders"
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-xl transition-colors"
        >
          <ShoppingCart size={14} />
          <span>Siparişler</span>
        </Link>

        <Link
          href="/admin/products"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl shadow-xs transition-colors"
        >
          <PlusCircle size={14} />
          <span>Kataloğa Git</span>
        </Link>
      </div>
    </div>
  );
}
