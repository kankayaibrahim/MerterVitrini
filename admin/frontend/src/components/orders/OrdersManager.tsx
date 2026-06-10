"use client";

import React, { useState, useEffect } from "react";
import { 
  ShoppingBag, 
  Search, 
  Loader2, 
  RefreshCw, 
  Info, 
  X, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Calendar, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  CreditCard, 
  RotateCcw, 
  FileText 
} from "lucide-react";

interface OrdersManagerProps {
  apiUrl: string;
  token: string | null;
}

interface OrderItem {
  id: string;
  product_id?: string;
  product_name: string;
  product_sku: string;
  quantity: number;
  price_at_purchase: number;
  image_url_at_purchase: string;
  created_at: string;
}

interface PaymentNotification {
  id: string;
  bank_name: string;
  sender_name: string;
  amount: number;
  notification_status: string;
  notes: string;
  created_at: string;
}

interface RefundItem {
  id: string;
  order_item_id: string;
  quantity: number;
  product_name: string;
  product_sku: string;
}

interface RefundRequest {
  id: string;
  refund_type: string;
  refund_status: string;
  reason: string;
  created_at: string;
  items: RefundItem[];
}

interface OrderDetail {
  id: string;
  order_number: string;
  total_amount: number;
  payment_method: string;
  order_status: string;
  billing_address: string;
  delivery_address: string;
  created_at: string;
  updated_at: string;
  user: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  };
  items: OrderItem[];
  payment_notifications: PaymentNotification[];
  refunds: RefundRequest[];
}

interface OrderSummary {
  id: string;
  order_number: string;
  total_amount: number;
  payment_method: string;
  order_status: string;
  billing_address: string;
  delivery_address: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  user_first_name: string;
  user_last_name: string;
  user_email: string;
}

const LABELS = {
  TITLE: "B2B Sipariş Yönetimi",
  SUBTITLE: "Müşteriler tarafından verilen siparişlerin durumlarını güncelleyin, ödeme bildirimlerini ve iade taleplerini doğrulayın.",
  REFRESH: "Tazele",
  SEARCH_PLACEHOLDER: "Sipariş numarası, müşteri adı veya e-posta ile ara...",
  SEARCH_BTN: "Ara",
  LOADING: "Sipariş verileri yükleniyor...",
  EMPTY: "Sistemde herhangi bir sipariş bulunamadı.",
  TH_ORDER: "Sipariş No",
  TH_CUSTOMER: "Müşteri",
  TH_TOTAL: "Toplam Tutar",
  TH_PAYMENT: "Ödeme Yöntemi",
  TH_STATUS: "Durum",
  TH_CREATED: "Tarih",
  TH_ACTIONS: "İşlemler",
  CANCEL: "Kapat",
  STATUS_PENDING_PAYMENT: "Ödeme Bekliyor",
  STATUS_APPROVED: "Onaylandı",
  STATUS_SHIPPING: "Kargoda",
  STATUS_COMPLETED: "Tamamlandı",
  STATUS_CANCELLED: "İptal Edildi",
  STATUS_REFUNDED: "İade Edildi",
  STATUS_PARTIALLY_REFUNDED: "Kısmi İade",
};

export default function OrdersManager({ apiUrl, token }: OrdersManagerProps) {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [limit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Detail Modal
  const [selectedOrderID, setSelectedOrderID] = useState<string | null>(null);
  const [orderDetail, setOrderDetail] = useState<OrderDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Status update, verify notification & verify refund states
  const [updating, setUpdating] = useState(false);

  const fetchOrders = async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      let url = `${apiUrl}/api/v1/orders?limit=${limit}&offset=${offset}`;
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;
      if (statusFilter) url += `&status=${encodeURIComponent(statusFilter)}`;

      const response = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error("Sipariş listesi yüklenemedi.");
      }

      const data = await response.json();
      setOrders(data.orders || []);
      setTotalOrders(data.total || 0);
    } catch (err: any) {
      setError(err.message || "Bir hata oluştu.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchOrderDetail = async (orderId: string) => {
    setLoadingDetail(true);
    setDetailError(null);
    try {
      const response = await fetch(`${apiUrl}/api/v1/orders/${orderId}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error("Sipariş detayları alınamadı.");
      }
      const data = await response.json();
      setOrderDetail(data);
    } catch (err: any) {
      setDetailError(err.message || "Detay hatası.");
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchOrders();
    }
  }, [token, offset, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setOffset(0);
    fetchOrders();
  };

  const handleOpenDetail = (orderId: string) => {
    setSelectedOrderID(orderId);
    fetchOrderDetail(orderId);
  };

  const handleCloseDetail = () => {
    setSelectedOrderID(null);
    setOrderDetail(null);
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!orderDetail) return;
    setUpdating(true);
    try {
      const response = await fetch(`${apiUrl}/api/v1/orders/${orderDetail.id}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Sipariş durumu güncellenemedi.");
      }

      alert("Sipariş durumu başarıyla güncellendi.");
      fetchOrderDetail(orderDetail.id);
      fetchOrders();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleVerifyPayment = async (notifId: string, approve: boolean) => {
    if (!orderDetail) return;
    setUpdating(true);
    try {
      const response = await fetch(`${apiUrl}/api/v1/orders/payment-notifications/${notifId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ status: approve ? "APPROVED" : "REJECTED" })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Ödeme bildirimi güncellenemedi.");
      }

      alert(`Ödeme bildirimi başarıyla ${approve ? "onaylandı" : "reddedildi"}.`);
      fetchOrderDetail(orderDetail.id);
      fetchOrders();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleVerifyRefund = async (refundId: string, approve: boolean) => {
    if (!orderDetail) return;
    setUpdating(true);
    try {
      const response = await fetch(`${apiUrl}/api/v1/orders/refunds/${refundId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ status: approve ? "APPROVED" : "REJECTED" })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "İade işlemi güncellenemedi.");
      }

      alert(`İade talebi başarıyla ${approve ? "onaylandı" : "reddedildi"}.`);
      fetchOrderDetail(orderDetail.id);
      fetchOrders();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "PENDING_PAYMENT": return LABELS.STATUS_PENDING_PAYMENT;
      case "APPROVED": return LABELS.STATUS_APPROVED;
      case "SHIPPING": return LABELS.STATUS_SHIPPING;
      case "COMPLETED": return LABELS.STATUS_COMPLETED;
      case "CANCELLED": return LABELS.STATUS_CANCELLED;
      case "REFUNDED": return LABELS.STATUS_REFUNDED;
      case "PARTIALLY_REFUNDED": return LABELS.STATUS_PARTIALLY_REFUNDED;
      default: return status;
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case "PENDING_PAYMENT": return "bg-amber-50 border-amber-200 text-amber-700";
      case "APPROVED": return "bg-blue-50 border-blue-200 text-blue-700";
      case "SHIPPING": return "bg-purple-50 border-purple-200 text-purple-700";
      case "COMPLETED": return "bg-emerald-50 border-emerald-200 text-emerald-700";
      case "CANCELLED": return "bg-rose-50 border-rose-200 text-rose-700";
      case "REFUNDED": return "bg-zinc-100 border-zinc-200 text-zinc-700";
      case "PARTIALLY_REFUNDED": return "bg-slate-100 border-slate-200 text-slate-700";
      default: return "bg-zinc-50 border-zinc-200 text-zinc-600";
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white p-6 rounded-2xl border border-zinc-200/80 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-zinc-950 flex items-center gap-2">
            <ShoppingBag className="text-violet-600" size={22} />
            {LABELS.TITLE}
          </h1>
          <p className="text-xs text-zinc-500 font-semibold mt-1">
            {LABELS.SUBTITLE}
          </p>
        </div>
        <button
          onClick={() => fetchOrders(true)}
          disabled={loading || refreshing}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-zinc-200 hover:bg-zinc-50 text-xs font-bold text-zinc-700 rounded-xl transition-all cursor-pointer bg-white"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          {LABELS.REFRESH}
        </button>
      </div>

      {/* Filters and List */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden">
        
        {/* Search & Status Filters */}
        <div className="p-4 border-b border-zinc-100 bg-zinc-50/50 flex flex-wrap items-center justify-between gap-4">
          <form onSubmit={handleSearchSubmit} className="flex gap-2 w-full sm:max-w-md">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-400">
                <Search size={16} />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={LABELS.SEARCH_PLACEHOLDER}
                className="w-full pl-9 pr-4 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              {LABELS.SEARCH_BTN}
            </button>
          </form>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-zinc-400">Durum Filtresi:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setOffset(0);
              }}
              className="px-3.5 py-1.5 bg-white border border-zinc-200 rounded-xl text-xs font-bold focus:outline-none text-zinc-700 cursor-pointer shadow-xs"
            >
              <option value="">Tümü</option>
              <option value="PENDING_PAYMENT">Ödeme Bekliyor</option>
              <option value="APPROVED">Onaylandı</option>
              <option value="SHIPPING">Kargoda</option>
              <option value="COMPLETED">Tamamlandı</option>
              <option value="CANCELLED">İptal Edildi</option>
              <option value="REFUNDED">İade Edildi</option>
              <option value="PARTIALLY_REFUNDED">Kısmi İade</option>
            </select>
          </div>
        </div>

        {/* Content Table */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 size={32} className="text-violet-600 animate-spin" />
            <span className="text-xs font-bold text-zinc-400">{LABELS.LOADING}</span>
          </div>
        ) : error ? (
          <div className="py-20 text-center text-xs font-bold text-rose-500">
            ⚠️ Hata: {error}
          </div>
        ) : orders.length === 0 ? (
          <div className="py-20 text-center text-xs font-bold text-zinc-400">
            {LABELS.EMPTY}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/30">
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">{LABELS.TH_ORDER}</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">{LABELS.TH_CUSTOMER}</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">{LABELS.TH_TOTAL}</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">{LABELS.TH_PAYMENT}</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">{LABELS.TH_STATUS}</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">{LABELS.TH_CREATED}</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">{LABELS.TH_ACTIONS}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-zinc-50/30 transition-colors">
                    <td className="px-6 py-4 text-xs font-extrabold text-zinc-900">{o.order_number}</td>
                    <td className="px-6 py-4">
                      <div>
                        <span className="text-xs font-bold text-zinc-900 block">
                          {o.user_first_name} {o.user_last_name}
                        </span>
                        <span className="text-[10px] font-semibold text-zinc-400 block">
                          {o.user_email}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-zinc-900">
                      {new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(o.total_amount)}
                    </td>
                    <td className="px-6 py-4 text-xs font-semibold text-zinc-600">
                      {o.payment_method === "BANK_TRANSFER" ? "Banka Havalesi" : o.payment_method}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${getStatusClass(o.order_status)}`}>
                        {getStatusLabel(o.order_status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs font-semibold text-zinc-500">
                      {new Date(o.created_at).toLocaleString("tr-TR")}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleOpenDetail(o.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 hover:text-violet-600 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
                      >
                        <Info size={14} />
                        Yönet
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedOrderID && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-zinc-950/40 backdrop-blur-sm transition-opacity duration-300"
            onClick={handleCloseDetail}
          />
          <div className="relative w-full max-w-4xl bg-white border border-zinc-200 rounded-2xl shadow-xl overflow-hidden z-10 p-6 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            
            <div className="flex justify-between items-start border-b border-zinc-100 pb-4 shrink-0">
              <div>
                <h3 className="text-base font-bold text-zinc-950 flex items-center gap-2">
                  <ShoppingBag className="text-violet-600" size={18} />
                  Sipariş Yönetimi - {orderDetail?.order_number || "Yükleniyor..."}
                </h3>
                {orderDetail && (
                  <span className="text-[10px] font-semibold text-zinc-400 block mt-0.5">
                    Sipariş Tarihi: {new Date(orderDetail.created_at).toLocaleString("tr-TR")}
                  </span>
                )}
              </div>
              <button
                onClick={handleCloseDetail}
                className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {loadingDetail ? (
              <div className="flex-grow flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 size={36} className="text-violet-600 animate-spin" />
                <span className="text-xs font-bold text-zinc-400">Sipariş detayları yükleniyor...</span>
              </div>
            ) : detailError ? (
              <div className="flex-grow py-20 text-center text-xs font-bold text-rose-500">
                ⚠️ Hata: {detailError}
              </div>
            ) : orderDetail ? (
              <div className="flex-grow overflow-y-auto py-6 space-y-6 text-xs font-bold text-zinc-655 text-zinc-600">
                
                {/* Client Info and Actions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  {/* Client details card */}
                  <div className="bg-zinc-50/50 p-4 rounded-xl border border-zinc-100 space-y-3 md:col-span-2">
                    <h4 className="font-extrabold text-zinc-900 uppercase tracking-wider text-[10px] border-b border-zinc-200/60 pb-1.5 flex items-center gap-1">
                      <User size={13} className="text-violet-600" />
                      Müşteri Bilgileri
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-400 font-semibold">Ad Soyad:</span>
                        <span className="text-zinc-800 font-bold">{orderDetail.user.first_name} {orderDetail.user.last_name}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-400 font-semibold">E-Posta:</span>
                        <span className="text-zinc-800 font-bold">{orderDetail.user.email}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-400 font-semibold">Telefon:</span>
                        <span className="text-zinc-800 font-bold">{orderDetail.user.phone || "-"}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-400 font-semibold">Tutar:</span>
                        <span className="text-salmon-pink font-extrabold">{new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(orderDetail.total_amount)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Status update card */}
                  <div className="bg-zinc-50/50 p-4 rounded-xl border border-zinc-100 space-y-3">
                    <h4 className="font-extrabold text-zinc-900 uppercase tracking-wider text-[10px] border-b border-zinc-200/60 pb-1.5">
                      Sipariş Durumu Güncelle
                    </h4>
                    <div className="flex flex-col gap-2">
                      <select
                        value={orderDetail.order_status}
                        onChange={(e) => handleUpdateStatus(e.target.value)}
                        disabled={updating}
                        className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-bold focus:outline-none text-zinc-700 cursor-pointer shadow-xs disabled:opacity-50"
                      >
                        <option value="PENDING_PAYMENT">Ödeme Bekliyor</option>
                        <option value="APPROVED">Onaylandı</option>
                        <option value="SHIPPING">Kargoda</option>
                        <option value="COMPLETED">Tamamlandı</option>
                        <option value="CANCELLED">İptal Et</option>
                      </select>
                    </div>
                  </div>

                </div>

                {/* Items and Images Grid */}
                <div className="bg-white rounded-xl border border-zinc-100 overflow-hidden">
                  <div className="p-4 bg-zinc-50/50 border-b border-zinc-100">
                    <h4 className="font-extrabold text-zinc-900 uppercase tracking-wider text-[10px]">
                      Sipariş Kalemleri
                    </h4>
                  </div>
                  <div className="divide-y divide-zinc-100 max-h-48 overflow-y-auto">
                    {orderDetail.items.map((item) => (
                      <div key={item.id} className="flex items-center gap-4 p-3 hover:bg-zinc-50/20">
                        <img
                          src={`/api/v1/store/images/resize?url=${encodeURIComponent(item.image_url_at_purchase)}&width=60&height=60`}
                          alt={item.product_name}
                          className="w-12 h-12 object-cover rounded-lg border border-zinc-200"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "/placeholder.png";
                          }}
                        />
                        <div className="flex-grow min-w-0">
                          <span className="text-zinc-800 font-bold block truncate">{item.product_name}</span>
                          <span className="text-[10px] text-zinc-400 block">SKU: {item.product_sku}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-zinc-800 font-bold block">{item.quantity} Adet</span>
                          <span className="text-[10px] text-zinc-400 block">
                            x {new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(item.price_at_purchase)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Address details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  <div className="bg-zinc-50/30 p-4 rounded-xl border border-zinc-150">
                    <span className="text-zinc-400 font-bold block mb-1 uppercase tracking-wider text-[9px]">Teslimat Adresi</span>
                    <p className="text-zinc-700 font-semibold leading-relaxed whitespace-pre-wrap">{orderDetail.delivery_address || "Girilmemiş"}</p>
                  </div>
                  <div className="bg-zinc-50/30 p-4 rounded-xl border border-zinc-150">
                    <span className="text-zinc-400 font-bold block mb-1 uppercase tracking-wider text-[9px]">Fatura Adresi</span>
                    <p className="text-zinc-700 font-semibold leading-relaxed whitespace-pre-wrap">{orderDetail.billing_address || "Girilmemiş"}</p>
                  </div>
                </div>

                {/* Payment Notifications Section */}
                {orderDetail.payment_notifications && orderDetail.payment_notifications.length > 0 && (
                  <div className="bg-white rounded-xl border border-zinc-100 overflow-hidden">
                    <div className="p-4 bg-zinc-50/50 border-b border-zinc-100">
                      <h4 className="font-extrabold text-zinc-900 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                        <CreditCard size={13} className="text-violet-600" />
                        Müşteri Ödeme Bildirimleri
                      </h4>
                    </div>
                    <div className="divide-y divide-zinc-100">
                      {orderDetail.payment_notifications.map((notif) => (
                        <div key={notif.id} className="p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-zinc-800 text-xs">{notif.bank_name}</span>
                              <span className="text-[10px] text-zinc-400 font-medium">Gönderen: {notif.sender_name}</span>
                            </div>
                            <p className="text-[10px] text-zinc-500 font-semibold">{notif.notes}</p>
                            <span className="text-[9px] text-zinc-400 block font-medium">
                              Tarih: {new Date(notif.created_at).toLocaleString("tr-TR")}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-xs font-bold text-zinc-800">
                              {new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(notif.amount)}
                            </span>
                            {notif.notification_status === "PENDING" ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleVerifyPayment(notif.id, true)}
                                  disabled={updating}
                                  className="p-1 px-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-[10px] font-extrabold uppercase transition-colors cursor-pointer"
                                >
                                  Onayla
                                </button>
                                <button
                                  onClick={() => handleVerifyPayment(notif.id, false)}
                                  disabled={updating}
                                  className="p-1 px-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-[10px] font-extrabold uppercase transition-colors cursor-pointer"
                                >
                                  Reddet
                                </button>
                              </div>
                            ) : (
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                notif.notification_status === "APPROVED" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"
                              }`}>
                                {notif.notification_status === "APPROVED" ? "Onaylandı" : "Reddedildi"}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Refund Requests Section */}
                {orderDetail.refunds && orderDetail.refunds.length > 0 && (
                  <div className="bg-white rounded-xl border border-zinc-100 overflow-hidden">
                    <div className="p-4 bg-zinc-50/50 border-b border-zinc-100">
                      <h4 className="font-extrabold text-zinc-900 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                        <RotateCcw size={13} className="text-violet-600" />
                        Müşteri İade Talepleri
                      </h4>
                    </div>
                    <div className="divide-y divide-zinc-100">
                      {orderDetail.refunds.map((ref) => (
                        <div key={ref.id} className="p-4 flex flex-col gap-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                  ref.refund_type === "FULL" ? "bg-indigo-50 text-indigo-700 border border-indigo-200" : "bg-purple-50 text-purple-700 border border-purple-200"
                                }`}>
                                  {ref.refund_type === "FULL" ? "Tam İade" : "Kısmi İade"}
                                </span>
                                <span className="text-[10px] text-zinc-400 font-medium">Tarih: {new Date(ref.created_at).toLocaleString("tr-TR")}</span>
                              </div>
                              <p className="text-[10px] text-zinc-500 font-semibold mt-1">Neden: {ref.reason}</p>
                            </div>
                            <div>
                              {ref.refund_status === "REQUESTED" ? (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => handleVerifyRefund(ref.id, true)}
                                    disabled={updating}
                                    className="p-1 px-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-[10px] font-extrabold uppercase transition-colors cursor-pointer"
                                  >
                                    Onayla
                                  </button>
                                  <button
                                    onClick={() => handleVerifyRefund(ref.id, false)}
                                    disabled={updating}
                                    className="p-1 px-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-[10px] font-extrabold uppercase transition-colors cursor-pointer"
                                  >
                                    Reddet
                                  </button>
                                </div>
                              ) : (
                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                  ref.refund_status === "APPROVED" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"
                                }`}>
                                  {ref.refund_status === "APPROVED" ? "Onaylandı" : "Reddedildi"}
                                </span>
                              )}
                            </div>
                          </div>

                          {ref.items && ref.items.length > 0 && (
                            <div className="bg-zinc-50/50 p-2.5 rounded-lg border border-zinc-100 flex flex-col gap-1.5">
                              <span className="text-[9px] text-zinc-400 uppercase tracking-wider font-extrabold">Talep Edilen Ürünler:</span>
                              {ref.items.map((it) => (
                                <div key={it.id} className="flex justify-between items-center text-[10px]">
                                  <span className="font-semibold text-zinc-700">{it.product_name} (SKU: {it.product_sku})</span>
                                  <span className="font-bold text-zinc-950">{it.quantity} Adet</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            ) : null}

            <div className="flex justify-end gap-2 pt-4 border-t border-zinc-100 shrink-0">
              <button
                type="button"
                onClick={handleCloseDetail}
                className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-[0.98]"
              >
                {LABELS.CANCEL}
              </button>
            </div>
            
          </div>
        </div>
      )}

    </div>
  );
}
