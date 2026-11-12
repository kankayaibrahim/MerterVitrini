"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  Eye,
  Users,
  MessageCircle,
  Phone,
  ShoppingBag,
  Globe,
  TrendingUp,
  RefreshCw,
  ExternalLink,
} from "lucide-react";

interface SupplierBrandAnalyticsSummary {
  profile_views: number;
  product_views: number;
  unique_visitors: number;
  whatsapp_clicks: number;
  phone_clicks: number;
  email_website_clicks: number;
  inquiry_leads: number;
  live_chat_rooms: number;
  total_buyer_contacts: number;
}

interface BrandCountryStat {
  country_code: string;
  country_label: string;
  views: number;
  contacts: number;
  percentage: number;
}

interface BrandTopProductStat {
  product_id: string;
  title: string;
  custom_sku: string;
  slug: string;
  views: number;
  whatsapp_clicks: number;
  inquiries: number;
}

interface BrandDailyStat {
  date: string;
  views: number;
  contacts: number;
}

interface SupplierBrandAnalyticsResponse {
  period: string;
  summary: SupplierBrandAnalyticsSummary;
  country_distribution: BrandCountryStat[];
  top_products: BrandTopProductStat[];
  daily_trend: BrandDailyStat[];
}

interface SupplierAnalyticsPanelProps {
  readonly getToken: () => string | null;
}

const PERIOD_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "7d", label: "Son 7 Gün" },
  { value: "30d", label: "Son 30 Gün" },
  { value: "90d", label: "Son 90 Gün" },
];

function SupplierKpiGrid({
  summary,
}: {
  readonly summary: SupplierBrandAnalyticsSummary;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-start gap-3.5">
        <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center shrink-0">
          <Eye size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <span className="min-h-[2.5rem] flex items-start text-[11px] font-bold text-slate-500 uppercase tracking-wider leading-snug">
            Toplam Ürün &amp; Vitrin Görüntülenme
          </span>
          <span className="text-2xl font-black text-slate-900 block mt-0.5">
            {summary.product_views + summary.profile_views}
          </span>
          <span className="text-[11px] font-semibold text-slate-500 block mt-0.5">
            Ürün: {summary.product_views} • Vitrin Profili: {summary.profile_views}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-start gap-3.5">
        <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center shrink-0">
          <Users size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <span className="min-h-[2.5rem] flex items-start text-[11px] font-bold text-slate-500 uppercase tracking-wider leading-snug">
            Tekil Alıcı Ziyaretçi
          </span>
          <span className="text-2xl font-black text-slate-900 block mt-0.5">
            {summary.unique_visitors}
          </span>
          <span className="text-[11px] font-semibold text-slate-500 block mt-0.5">
            Koleksiyonunuzu inceleyen tekil alıcı
          </span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-emerald-200 p-4 shadow-xs flex items-start gap-3.5">
        <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
          <MessageCircle size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <span className="min-h-[2.5rem] flex items-start text-[11px] font-bold text-emerald-700 uppercase tracking-wider leading-snug">
            Doğrudan WhatsApp &amp; Telefon Teması
          </span>
          <span className="text-2xl font-black text-emerald-700 block mt-0.5">
            {summary.whatsapp_clicks + summary.phone_clicks}
          </span>
          <span className="text-[11px] font-semibold text-slate-500 block mt-0.5">
            WhatsApp: {summary.whatsapp_clicks} • Telefon: {summary.phone_clicks}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-start gap-3.5">
        <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
          <ShoppingBag size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <span className="min-h-[2.5rem] flex items-start text-[11px] font-bold text-slate-700 uppercase tracking-wider leading-snug">
            Toplam Alıcı İletişim &amp; Sipariş Talebi
          </span>
          <span className="text-2xl font-black text-slate-900 block mt-0.5">
            {summary.total_buyer_contacts}
          </span>
          <span className="text-[11px] font-semibold text-slate-500 block mt-0.5">
            Sipariş: {summary.inquiry_leads} • Canlı Sohbet: {summary.live_chat_rooms}
          </span>
        </div>
      </div>
    </div>
  );
}

function SupplierCountryDistributionCard({
  countries,
}: {
  readonly countries: readonly BrandCountryStat[];
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe size={18} className="text-slate-800" />
          <h3 className="text-sm font-extrabold text-slate-900">
            Ülke &amp; Pazar Dağılımı (Alıcı İlgisi)
          </h3>
        </div>
        <span className="text-[11px] font-semibold text-slate-400">
          Görüntülenme + İletişim
        </span>
      </div>

      {countries.length === 0 ? (
        <div className="py-10 text-center text-xs text-slate-400">
          Seçili dönemde ülke bazlı ziyaret verisi henüz oluşmadı.
        </div>
      ) : (
        <div className="space-y-3">
          {countries.map((c) => (
            <div key={c.country_code} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800">{c.country_label}</span>
                <span className="text-slate-600 font-semibold">
                  {c.views} görüntülenme •{" "}
                  <strong className="text-emerald-700">{c.contacts} iletişim</strong> (
                  %{c.percentage})
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-slate-900"
                  style={{ width: `${Math.max(4, Math.min(100, c.percentage))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SupplierTopProductsCard({
  products,
}: {
  readonly products: readonly BrandTopProductStat[];
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp size={18} className="text-emerald-600" />
          <h3 className="text-sm font-extrabold text-slate-900">
            En Çok İlgi Gören Ürünleriniz
          </h3>
        </div>
        <span className="text-[11px] font-semibold text-slate-400">
          İlk 10 Koleksiyon Ürünü
        </span>
      </div>

      {products.length === 0 ? (
        <div className="py-10 text-center text-xs text-slate-400">
          Henüz aktif ürün bulunmuyor.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
              <tr>
                <th className="py-2 pr-3">Ürün &amp; SKU</th>
                <th className="py-2 px-2 text-center">Görüntülenme</th>
                <th className="py-2 px-2 text-center">WhatsApp Tık</th>
                <th className="py-2 pl-2 text-center">Sipariş Talebi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((p) => (
                <tr key={p.product_id} className="hover:bg-slate-50/80">
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/product/${encodeURIComponent(p.slug || p.product_id)}`}
                        target="_blank"
                        className="font-bold text-slate-900 hover:text-emerald-700 no-underline line-clamp-1"
                      >
                        {p.title}
                      </Link>
                      <ExternalLink size={11} className="text-slate-400 shrink-0" />
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">
                      {p.custom_sku}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-center font-extrabold text-slate-800">
                    {p.views}
                  </td>
                  <td className="py-2.5 px-2 text-center font-extrabold text-emerald-700">
                    {p.whatsapp_clicks}
                  </td>
                  <td className="py-2.5 pl-2 text-center font-extrabold text-slate-900">
                    {p.inquiries}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function SupplierAnalyticsPanel({
  getToken,
}: SupplierAnalyticsPanelProps) {
  const [period, setPeriod] = useState<string>("30d");
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<SupplierBrandAnalyticsResponse | null>(null);

  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  const loadAnalytics = useCallback(async () => {
    const token = getTokenRef.current();
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/supplier/analytics?period=${period}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = (await res.json()) as SupplierBrandAnalyticsResponse;
        setData(json);
      }
    } catch {
      // Keep previous state on network hiccup
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadAnalytics();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadAnalytics]);

  const summary: SupplierBrandAnalyticsSummary = data?.summary ?? {
    profile_views: 0,
    product_views: 0,
    unique_visitors: 0,
    whatsapp_clicks: 0,
    phone_clicks: 0,
    email_website_clicks: 0,
    inquiry_leads: 0,
    live_chat_rooms: 0,
    total_buyer_contacts: 0,
  };

  return (
    <div className="space-y-5">
      {/* Header & Period Selector */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
            <BarChart3 size={20} />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-900">
              Firma Ziyaretçi, İhracat Ülkesi &amp; İletişim Analitiği (ROI Raporu)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Açık firma vitrininizin ve ürünlerinizin kaç kez görüntülendiğini, hangi ülkelerden ilgi gördüğünü ve kaç alıcının doğrudan WhatsApp/Sipariş üzerinden size ulaştığını takip edin.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="bg-slate-100 p-1 rounded-xl inline-flex gap-1 border border-slate-200">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPeriod(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                  period === opt.value
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void loadAnalytics()}
            disabled={loading}
            className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 text-xs font-bold cursor-pointer disabled:opacity-50"
            title="Raporu Yenile"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Yenile</span>
          </button>
        </div>
      </div>

      <SupplierKpiGrid summary={summary} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SupplierCountryDistributionCard
          countries={data?.country_distribution ?? []}
        />
        <SupplierTopProductsCard products={data?.top_products ?? []} />
      </div>

      {/* Channel Breakdown Footer */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4 text-xs">
        <span className="font-extrabold text-slate-800">
          Doğrudan Alıcı İletişim Kanalları Dağılımı:
        </span>
        <div className="flex flex-wrap items-center gap-4 text-slate-600 font-semibold">
          <span className="inline-flex items-center gap-1.5">
            <MessageCircle size={14} className="text-emerald-600" />
            WhatsApp Tıklaması: <strong>{summary.whatsapp_clicks}</strong>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Phone size={14} className="text-slate-700" />
            Telefon Tıklaması: <strong>{summary.phone_clicks}</strong>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ShoppingBag size={14} className="text-slate-700" />
            Doğrudan Sipariş / Form: <strong>{summary.inquiry_leads}</strong>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users size={14} className="text-slate-700" />
            Canlı B2B Sohbet: <strong>{summary.live_chat_rooms}</strong>
          </span>
        </div>
      </div>
    </div>
  );
}
