"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ShoppingBag,
  RefreshCw,
  Phone,
  Mail,
  MapPin,
  Building2,
  Truck,
  CheckCircle2,
  Clock,
  XCircle,
  MessageCircle,
  Package,
} from "lucide-react";
import { formatCurrencyAmount } from "@/utils/orderCurrency";

export interface SupplierOrderItem {
  id: string;
  sub_order_id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  supplier_sku?: string;
  quantity: number;
  price_at_purchase: number;
  total_price: number;
  currency?: string;
  image_url?: string;
  series_ratio?: string;
}

export interface SupplierSubOrderRow {
  id: string;
  order_id: string;
  brand_id: string;
  brand_name?: string;
  sub_order_number: string;
  gross_amount: number;
  commission_rate: number;
  commission_amount: number;
  net_payout_amount: number;
  currency: string;
  status: string;
  tracking_company?: string;
  tracking_number?: string;
  notes?: string;
  customer_name?: string;
  customer_company?: string;
  customer_phone?: string;
  customer_email?: string;
  customer_email_verified?: boolean;
  delivery_address?: string;
  billing_address?: string;
  created_at: string;
  items?: SupplierOrderItem[];
}

interface TrackingInputState {
  company: string;
  number: string;
  status: string;
}

const ORDERS_REFRESH_INTERVAL_MS = 60_000;

const STATUS_LABELS: Record<string, { label: string; badgeClass: string }> = {
  PENDING: {
    label: "Yeni Sipariş (Onay Bekliyor)",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
  },
  ACCEPTED: {
    label: "Onaylandı",
    badgeClass: "bg-slate-100 text-slate-800 border-slate-300",
  },
  PREPARING: {
    label: "Hazırlanıyor",
    badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  SENT_TO_HUB: {
    label: "Kargoya Verildi",
    badgeClass: "bg-purple-50 text-purple-700 border-purple-200",
  },
  DELIVERED: {
    label: "Teslim Edildi",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  CANCELLED: {
    label: "İptal Edildi",
    badgeClass: "bg-red-50 text-red-700 border-red-200",
  },
};

function normalizeWaPhone(raw?: string): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length === 11) {
    return "90" + digits.slice(1);
  }
  if (digits.length === 10 && digits.startsWith("5")) {
    return "90" + digits;
  }
  return digits;
}

function getOrderStatusIcon(status: string) {
  if (status === "DELIVERED") {
    return <CheckCircle2 size={12} />;
  }
  if (status === "CANCELLED") {
    return <XCircle size={12} />;
  }
  return <Clock size={12} />;
}

function renderEmptyOrdersState(loading: boolean) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-xs text-slate-500">
        Siparişler yükleniyor...
      </div>
    );
  }
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
      <ShoppingBag size={36} className="mx-auto text-slate-300 mb-3" />
      <p className="text-sm font-bold text-slate-700">Henüz Gelen Sipariş Yok</p>
      <p className="text-xs text-slate-500 mt-1">
        Müşteriler ürünleriniz için sipariş veya teklif oluşturduğunda anında burada listelenir.
      </p>
    </div>
  );
}

interface SupplierOrderCardProps {
  readonly order: SupplierSubOrderRow;
  readonly inputState: TrackingInputState;
  readonly updating: boolean;
  readonly onInputChange: (next: TrackingInputState) => void;
  readonly onUpdateOrder: () => void;
}

function SupplierOrderCard({
  order,
  inputState,
  updating,
  onInputChange,
  onUpdateOrder,
}: SupplierOrderCardProps) {
  const st = STATUS_LABELS[order.status] || {
    label: order.status,
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
  };
  const waDigits = normalizeWaPhone(order.customer_phone);

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
      {/* Top summary bar */}
      <div className="bg-slate-50/80 px-5 py-3.5 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs font-extrabold text-slate-900 bg-white px-2.5 py-1 rounded-md border border-slate-200">
            #{order.sub_order_number}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${st.badgeClass}`}
          >
            {getOrderStatusIcon(order.status)}
            {st.label}
          </span>
          <span className="text-[11px] text-slate-500">
            {new Date(order.created_at).toLocaleString("tr-TR")}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">
              Toplam Sipariş Tutarı (%0 Komisyon)
            </span>
            <span className="text-sm font-black text-emerald-700">
              {formatCurrencyAmount(Number(order.gross_amount), order.currency || "TRY", "tr-TR")}
            </span>
          </div>
        </div>
      </div>

      {/* Main body: Buyer Contact + Order Items + Status Management */}
      <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 4 cols: Direct Buyer Info */}
        <div className="lg:col-span-4 bg-slate-50/70 rounded-xl p-4 border border-slate-200/70 space-y-2.5">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Building2 size={13} className="text-slate-700" />
            <span>Alıcı (Müşteri) İletişim &amp; Teslimat</span>
          </div>

          <div className="text-xs font-bold text-slate-900">
            {order.customer_name || "İsimsiz Alıcı"}
            {order.customer_company ? (
              <span className="block text-[11px] font-semibold text-slate-600 mt-0.5">
                Firma: {order.customer_company}
              </span>
            ) : null}
          </div>

          {order.customer_phone && (
            <div className="flex items-center gap-2 text-xs text-slate-700">
              <Phone size={13} className="text-slate-400 shrink-0" />
              <a
                href={`tel:${order.customer_phone}`}
                className="font-semibold hover:text-slate-900 hover:underline"
              >
                {order.customer_phone}
              </a>
            </div>
          )}

          {order.customer_email && (
            <div className="flex items-center gap-1.5 text-xs text-slate-700 flex-wrap">
              <Mail size={13} className="text-slate-400 shrink-0" />
              <a
                href={`mailto:${order.customer_email}`}
                className="hover:text-slate-900 hover:underline break-all"
              >
                {order.customer_email}
              </a>
              {order.customer_email_verified ? (
                <span className="inline-flex items-center px-1.5 py-0.2 text-[9px] font-extrabold bg-emerald-100 text-emerald-800 rounded border border-emerald-300">
                  ✓ Doğrulanmış E-posta
                </span>
              ) : (
                <span className="inline-flex items-center px-1.5 py-0.2 text-[9px] font-semibold bg-amber-100 text-amber-800 rounded border border-amber-300">
                  Doğrulanmadı
                </span>
              )}
            </div>
          )}

          {order.delivery_address && (
            <div className="flex items-start gap-2 text-xs text-slate-600 pt-1 border-t border-slate-200/70">
              <MapPin size={13} className="text-slate-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{order.delivery_address}</span>
            </div>
          )}

          {waDigits && (
            <div className="pt-2">
              <a
                href={`https://wa.me/${waDigits}?text=${encodeURIComponent(
                  `Merhaba ${order.customer_name || ""}, Merter Vitrini üzerindeki #${order.sub_order_number} numaralı siparişiniz için ${order.brand_name || "firmamızdan"} yazıyoruz.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-xs"
              >
                <MessageCircle size={14} />
                <span>Alıcıya Doğrudan WhatsApp&apos;tan Yaz</span>
              </a>
            </div>
          )}
        </div>

        {/* Middle 5 cols: Order Line Items */}
        <div className="lg:col-span-5 space-y-2">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Package size={13} className="text-slate-700" />
            <span>Sipariş Kalemleri ({order.items?.length || 0} Ürün)</span>
          </div>

          {order.items && order.items.length > 0 ? (
            <div className="divide-y divide-slate-100 border border-slate-200/70 rounded-xl overflow-hidden">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="p-2.5 bg-white flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">
                      {item.product_name}
                    </p>
                    <p className="text-[11px] text-slate-500 font-mono">
                      SKU: {item.product_sku}
                      {item.supplier_sku &&
                      item.supplier_sku.toUpperCase() !== item.product_sku.toUpperCase()
                        ? ` • Model: ${item.supplier_sku}`
                        : ""}
                      {item.series_ratio ? ` • Seri: ${item.series_ratio}` : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-bold text-slate-900 block">
                      {item.quantity} Seri/Paket
                    </span>
                    <span className="text-[11px] text-emerald-700 font-semibold">
                      {formatCurrencyAmount(
                        Number(item.total_price),
                        item.currency || order.currency || "TRY",
                        "tr-TR"
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">
              Kalem detayı bulunamadı.
            </p>
          )}
        </div>

        {/* Right 3 cols: Status & Tracking Update */}
        <div className="lg:col-span-3 bg-slate-50/70 rounded-xl p-4 border border-slate-200/70 space-y-3">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Truck size={13} className="text-slate-700" />
            <span>Sipariş &amp; Kargo Durumu</span>
          </div>

          <div>
            <label htmlFor={`order-status-${order.id}`} className="block text-[11px] font-semibold text-slate-600 mb-1">
              Sipariş Statüsü
            </label>
            <select
              id={`order-status-${order.id}`}
              value={inputState.status}
              onChange={(e) => onInputChange({ ...inputState, status: e.target.value })}
              className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-900"
            >
              <option value="PENDING">Onay Bekliyor</option>
              <option value="ACCEPTED">Onaylandı</option>
              <option value="PREPARING">Hazırlanıyor</option>
              <option value="SENT_TO_HUB">Kargoya Verildi</option>
              <option value="DELIVERED">Teslim Edildi</option>
              <option value="CANCELLED">İptal Edildi</option>
            </select>
          </div>

          <div>
            <label htmlFor={`order-tracking-company-${order.id}`} className="block text-[11px] font-semibold text-slate-600 mb-1">
              Kargo / Ambar Firması
            </label>
            <input
              id={`order-tracking-company-${order.id}`}
              type="text"
              value={inputState.company}
              onChange={(e) => onInputChange({ ...inputState, company: e.target.value })}
              placeholder="Örn: Yurtiçi Kargo / Merter Ambar"
              className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-slate-900"
            />
          </div>

          <div>
            <label htmlFor={`order-tracking-number-${order.id}`} className="block text-[11px] font-semibold text-slate-600 mb-1">
              Kargo Takip No
            </label>
            <input
              id={`order-tracking-number-${order.id}`}
              type="text"
              value={inputState.number}
              onChange={(e) => onInputChange({ ...inputState, number: e.target.value })}
              placeholder="Takip Kodu"
              className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-slate-900"
            />
          </div>

          <button
            type="button"
            onClick={onUpdateOrder}
            disabled={updating}
            className="w-full py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            {updating ? "Kaydediliyor..." : "Durumu Güncelle"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SupplierOrdersPanel({
  getToken,
  onOrderCountChange,
}: Readonly<{
  getToken: () => string | null;
  onOrderCountChange?: (count: number) => void;
}>) {
  const [orders, setOrders] = useState<SupplierSubOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [trackingInputs, setTrackingInputs] = useState<Record<string, TrackingInputState>>({});

  const getTokenRef = useRef(getToken);
  const onOrderCountChangeRef = useRef(onOrderCountChange);
  const inFlightRef = useRef(false);

  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  useEffect(() => {
    onOrderCountChangeRef.current = onOrderCountChange;
  }, [onOrderCountChange]);

  const applyOrdersList = useCallback((list: SupplierSubOrderRow[], updateCount: boolean) => {
    setOrders(list);
    if (updateCount && onOrderCountChangeRef.current) {
      onOrderCountChangeRef.current(list.length);
    }
    setTrackingInputs((prev) => {
      const nextInputs: Record<string, TrackingInputState> = {};
      for (const o of list) {
        nextInputs[o.id] = prev[o.id] ?? {
          company: o.tracking_company || "",
          number: o.tracking_number || "",
          status: o.status || "PENDING",
        };
      }
      return nextInputs;
    });
  }, []);

  const loadOrders = useCallback(
    async (filterValue: string, silent = false) => {
      if (inFlightRef.current) return;
      const token = getTokenRef.current();
      if (!token) {
        if (!silent) setLoading(false);
        return;
      }

      inFlightRef.current = true;
      if (!silent) setLoading(true);

      try {
        const qs = filterValue !== "ALL" ? `?status=${encodeURIComponent(filterValue)}` : "";
        const res = await fetch(`/api/v1/supplier/orders${qs}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = (await res.json()) as { orders?: SupplierSubOrderRow[] };
          applyOrdersList(data.orders || [], filterValue === "ALL");
        }
      } catch (err) {
        console.error("Failed to load supplier orders:", err);
      } finally {
        inFlightRef.current = false;
        if (!silent) setLoading(false);
      }
    },
    [applyOrdersList]
  );

  useEffect(() => {
    const initTimer = window.setTimeout(() => {
      void loadOrders(statusFilter, false);
    }, 0);

    const intervalId = window.setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      void loadOrders(statusFilter, true);
    }, ORDERS_REFRESH_INTERVAL_MS);

    return () => {
      window.clearTimeout(initTimer);
      window.clearInterval(intervalId);
    };
  }, [statusFilter, loadOrders]);

  const handleUpdateOrder = async (orderId: string) => {
    const token = getTokenRef.current();
    const input = trackingInputs[orderId];
    if (!token || !input) return;

    setUpdatingId(orderId);
    try {
      const res = await fetch(`/api/v1/supplier/orders/${orderId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: input.status,
          tracking_company: input.company,
          tracking_number: input.number,
        }),
      });
      if (res.ok) {
        setTrackingInputs((prev) => {
          const copy = { ...prev };
          delete copy[orderId];
          return copy;
        });
        await loadOrders(statusFilter, false);
      }
    } catch (err) {
      console.error("Update order status error:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <ShoppingBag size={17} className="text-slate-900" />
            <span>Firmanıza Gelen Doğrudan Toptan Siparişler</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Vitrinden ve sepetten ürünleriniz için verilen siparişler komisyonsuz (%0) olarak doğrudan firmanıza düşer. Alıcıyla doğrudan iletişime geçip sevkiyatı yönetebilirsiniz.
          </p>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-3 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-900"
          >
            <option value="ALL">Tüm Siparişler</option>
            <option value="PENDING">Yeni (Onay Bekleyen)</option>
            <option value="ACCEPTED">Onaylananlar</option>
            <option value="PREPARING">Hazırlananlar</option>
            <option value="SENT_TO_HUB">Kargodakiler</option>
            <option value="DELIVERED">Teslim Edilenler</option>
            <option value="CANCELLED">İptal Edilenler</option>
          </select>

          <button
            type="button"
            onClick={() => void loadOrders(statusFilter, false)}
            disabled={loading}
            className="h-9 px-3 inline-flex items-center justify-center gap-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
            title="Siparişleri Yenile"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Yenile</span>
          </button>
        </div>
      </div>

      {/* Orders List */}
      {orders.length === 0 ? (
        renderEmptyOrdersState(loading)
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const inputState = trackingInputs[order.id] || {
              company: order.tracking_company || "",
              number: order.tracking_number || "",
              status: order.status || "PENDING",
            };
            return (
              <SupplierOrderCard
                key={order.id}
                order={order}
                inputState={inputState}
                updating={updatingId === order.id}
                onInputChange={(next) =>
                  setTrackingInputs((prev) => ({ ...prev, [order.id]: next }))
                }
                onUpdateOrder={() => void handleUpdateOrder(order.id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
