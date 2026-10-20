"use client";

import React from "react";
import Link from "next/link";
import { Landmark, ArrowRight, DollarSign } from "lucide-react";
import { DashboardExchangeRate } from "@/types/dashboard";

interface MarketFxTickerProps {
  readonly rates: DashboardExchangeRate[];
  readonly loading: boolean;
}

function renderFxContent(loading: boolean, rates: readonly DashboardExchangeRate[]) {
  if (loading) {
    return <div className="py-4 text-center text-xs text-zinc-400">Döviz kurları yükleniyor...</div>;
  }
  if (rates.length === 0) {
    return <div className="py-4 text-center text-xs text-zinc-400">Kayıtlı döviz kuru bulunamadı.</div>;
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {rates.map((rate) => (
        <div
          key={rate.currency_code}
          className="p-3 rounded-xl bg-zinc-50/80 border border-zinc-200/60 flex flex-col justify-between hover:bg-zinc-100/70 transition-colors"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-zinc-900 flex items-center gap-1">
              <DollarSign size={13} className="text-zinc-400" />
              {rate.currency_code}/TRY
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white text-zinc-600 border border-zinc-200/60 shadow-2xs">
              TCMB
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-1">
            <span className="text-[11px] text-zinc-500">Satış:</span>
            <span className="text-sm font-black text-zinc-900">
              ₺{rate.selling_rate.toFixed(4)}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-1 mt-0.5">
            <span className="text-[10px] text-zinc-400">Alış:</span>
            <span className="text-xs font-semibold text-zinc-600">
              ₺{rate.buying_rate.toFixed(4)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function MarketFxTicker({
  rates,
  loading,
}: Readonly<MarketFxTickerProps>) {
  const latestDate = rates.length > 0 ? rates[0].publication_date : "Güncel";

  return (
    <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4 pb-3 border-b border-zinc-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Landmark size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-900">
              TCMB Canlı Döviz Kurları (B2B İhracat & Fiyatlandırma)
            </h3>
            <p className="text-xs text-zinc-500">
              TCMB Resmi Bülten Tarihi: <span className="font-semibold text-zinc-700">{latestDate}</span>
            </p>
          </div>
        </div>

        <Link
          href="/admin/currencies"
          className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-600 hover:text-zinc-900 transition-colors"
        >
          <span>Para Birimi Ayarları</span>
          <ArrowRight size={13} />
        </Link>
      </div>

      {renderFxContent(loading, rates)}
    </div>
  );
}
