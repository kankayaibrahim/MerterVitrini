"use client";

import React from "react";
import Link from "next/link";
import { ShoppingBag, ArrowRight, Clock, CheckCircle2, Truck, XCircle, AlertCircle } from "lucide-react";
import { DashboardOrderSummary } from "@/types/dashboard";

interface RecentOrdersCardProps {
  readonly orders: DashboardOrderSummary[];
  readonly loading: boolean;
}

function getStatusBadge(status: string) {
  const norm = status.toUpperCase();
  if (norm === "APPROVED") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60">
        <CheckCircle2 size={11} />
        Onaylandı
      </span>
    );
  }
  if (norm === "SHIPPED") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/60">
        <Truck size={11} />
        Kargoda
      </span>
    );
  }
  if (norm === "CANCELLED") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200/60">
        <XCircle size={11} />
        İptal Edildi
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200/60">
      <Clock size={11} />
      {status || "Beklemede"}
    </span>
  );
}

function formatPaymentMethod(method: string) {
  if (method === "BANK_TRANSFER") return "Banka Havalesi";
  if (method === "CREDIT_CARD") return "Kredi Kartı";
  return method || "Banka Havalesi";
}

function renderOrdersContent(loading: boolean, orders: readonly DashboardOrderSummary[]) {
  if (loading) {
    return <div className="py-8 text-center text-xs text-zinc-400">Siparişler yükleniyor...</div>;
  }
  if (orders.length === 0) {
    return (
      <div className="py-8 text-center">
        <AlertCircle size={28} className="mx-auto text-zinc-300 mb-2" />
        <p className="text-xs font-semibold text-zinc-600">Henüz yeni sipariş bulunmuyor</p>
        <p className="text-[11px] text-zinc-400 mt-0.5">Siparişler geldikçe anlık olarak burada listelenecektir.</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-zinc-100 text-zinc-400 font-semibold uppercase tracking-wider text-[10px]">
            <th className="py-2 pr-3">Sipariş No</th>
            <th className="py-2 pr-3">Müşteri</th>
            <th className="py-2 pr-3">Ödeme</th>
            <th className="py-2 pr-3">Tutar</th>
            <th className="py-2 pr-3">Durum</th>
            <th className="py-2 text-right">Tarih</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {orders.map((order) => (
            <tr key={order.id} className="hover:bg-zinc-50/80 transition-colors">
              <td className="py-2.5 pr-3 font-mono font-bold text-zinc-900">
                <Link href={`/admin/orders?search=${order.order_number}`} className="hover:text-indigo-600">
                  #{order.order_number}
                </Link>
              </td>
              <td className="py-2.5 pr-3">
                <div className="font-semibold text-zinc-800 truncate max-w-[140px]">
                  {order.customer_name}
                </div>
                {order.customer_email ? (
                  <div className="text-[10px] text-zinc-400 truncate max-w-[140px]">
                    {order.customer_email}
                  </div>
                ) : null}
              </td>
              <td className="py-2.5 pr-3 text-zinc-600">
                {formatPaymentMethod(order.payment_method)}
              </td>
              <td className="py-2.5 pr-3 font-bold text-zinc-900">
                ₺{order.total_amount.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
              </td>
              <td className="py-2.5 pr-3">
                {getStatusBadge(order.order_status)}
              </td>
              <td className="py-2.5 text-right text-zinc-400 text-[11px] whitespace-nowrap">
                {new Date(order.created_at).toLocaleDateString("tr-TR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function RecentOrdersCard({
  orders,
  loading,
}: Readonly<RecentOrdersCardProps>) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <ShoppingBag size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900">
                Son B2B Toptan Siparişler
              </h3>
              <p className="text-xs text-zinc-500">
                Vitrinden ve toptan sepetten gelen son siparişler
              </p>
            </div>
          </div>

          <Link
            href="/admin/orders"
            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            <span>Tüm Siparişleri Gör</span>
            <ArrowRight size={13} />
          </Link>
        </div>

        {renderOrdersContent(loading, orders)}
      </div>

      <div className="pt-3 mt-3 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
        <span>Tüm sipariş operasyonları sipariş yönetimi panelinden yürütülür.</span>
        <Link href="/admin/orders" className="font-semibold text-zinc-700 hover:text-zinc-900">
          Detaylı Liste →
        </Link>
      </div>
    </div>
  );
}
