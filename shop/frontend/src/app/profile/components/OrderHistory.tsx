import React from "react";
import { Clipboard, AlertCircle, ChevronUp, ChevronDown, Download, CreditCard, RotateCcw, XCircle } from "lucide-react";
import { getResizedImageUrl } from "@/app/utils";

interface OrderHistoryProps {
  orders: any[];
  loadingOrders: boolean;
  ordersError: string | null;
  expandedOrders: Record<string, boolean>;
  setExpandedOrders: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  lang: string;
  getOrderT: (key: string) => string;
  handleDownloadFile: (url: string, filename: string) => void;
  openPaymentModal: (order: any) => void;
  openRefundModal: (order: any) => void;
  handleCancelOrder: (orderId: string) => void;
}

export default function OrderHistory({
  orders,
  loadingOrders,
  ordersError,
  expandedOrders,
  setExpandedOrders,
  lang,
  getOrderT,
  handleDownloadFile,
  openPaymentModal,
  openRefundModal,
  handleCancelOrder,
}: OrderHistoryProps) {
  return (
    <div className="bg-white rounded-2xl p-6 sm:p-8 border border-cultured shadow-sm animate-in fade-in duration-200">
      <h2 className="font-sans font-extrabold text-xl text-eerie-black mb-1 select-none flex items-center gap-2">
        <Clipboard className="w-5 h-5 text-salmon-pink" />
        {getOrderT("orders_header")}
      </h2>
      <p className="text-xs text-sonic-silver font-semibold mb-8 select-none">
        {getOrderT("orders_desc")}
      </p>

      {loadingOrders ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="spinner animate-spin w-8 h-8 border-4 border-salmon-pink border-t-transparent rounded-full" />
          <span className="text-xs font-bold text-sonic-silver select-none">
            Yükleniyor...
          </span>
        </div>
      ) : ordersError ? (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold flex items-center gap-2 select-none">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <span>{ordersError}</span>
        </div>
      ) : orders.length === 0 ? (
        <div className="border-2 border-dashed border-cultured rounded-2xl p-12 text-center select-none">
          <Clipboard className="w-12 h-12 text-spanish-gray mx-auto mb-3" />
          <p className="text-sm font-bold text-sonic-silver">
            {getOrderT("no_orders_found")}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {orders.map((order) => {
            const isExpanded = !!expandedOrders[order.id];
            return (
              <div
                key={order.id}
                className="border border-cultured rounded-2xl overflow-hidden shadow-sm bg-white hover:border-salmon-pink/30 transition-colors"
              >
                {/* Order Card Header */}
                <div className="bg-cultured/40 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-cultured">
                  <div className="grid grid-cols-2 sm:flex sm:items-center gap-x-6 gap-y-2 text-xs font-bold text-sonic-silver">
                    <div>
                      <div className="text-[10px] uppercase text-spanish-gray tracking-wider mb-0.5">
                        {getOrderT("order_number")}
                      </div>
                      <div className="text-eerie-black font-extrabold">{order.order_number}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-spanish-gray tracking-wider mb-0.5">
                        {getOrderT("order_date")}
                      </div>
                      <div className="text-eerie-black">
                        {new Date(order.created_at).toLocaleDateString(lang === "tr" ? "tr-TR" : "en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric"
                        })}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-spanish-gray tracking-wider mb-0.5">
                        {getOrderT("total_amount")}
                      </div>
                      <div className="text-salmon-pink font-extrabold">
                        {new Intl.NumberFormat(lang === "tr" ? "tr-TR" : "en-US", {
                          style: "currency",
                          currency: "TRY"
                        }).format(order.total_amount)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                      order.order_status === "PENDING_PAYMENT"
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : order.order_status === "APPROVED"
                        ? "bg-blue-50 text-blue-700 border-blue-200"
                        : order.order_status === "SHIPPING"
                        ? "bg-purple-50 text-purple-700 border-purple-200"
                        : order.order_status === "COMPLETED"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : order.order_status === "CANCELLED"
                        ? "bg-rose-50 text-rose-700 border-rose-200"
                        : "bg-slate-50 text-slate-700 border-slate-200"
                    }`}>
                      {getOrderT(`status_${order.order_status.toLowerCase()}`)}
                    </span>

                    <button
                      type="button"
                      onClick={() => setExpandedOrders(prev => ({ ...prev, [order.id]: !prev[order.id] }))}
                      className="p-1.5 hover:bg-cultured rounded-lg transition-colors border border-cultured bg-white cursor-pointer text-sonic-silver hover:text-salmon-pink flex items-center justify-center"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="p-4 sm:p-6 border-t border-cultured bg-white animate-in slide-in-from-top duration-200">
                    <div className="flex flex-col gap-6">
                      
                      <div>
                        <h4 className="text-[10px] font-extrabold uppercase text-sonic-silver tracking-wider border-b border-cultured pb-2 mb-4">
                          Ürünler
                        </h4>
                        <div className="flex flex-col gap-4">
                          {(order.items || []).map((item: any) => {
                            const coverImg = getResizedImageUrl(item.image_url_at_purchase, 80, 106);
                            return (
                              <div key={item.id} className="flex items-center gap-4 text-xs font-bold">
                                <img
                                  src={coverImg}
                                  alt={item.product_name}
                                  className="w-16 h-16 object-cover rounded-lg border border-cultured"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = "/placeholder.png";
                                  }}
                                />
                                <div className="flex-grow min-w-0">
                                  <div className="text-eerie-black font-extrabold truncate">
                                    {item.product_name}
                                  </div>
                                  <div className="text-[10px] text-sonic-silver mt-0.5">
                                    SKU: {item.product_sku}
                                  </div>
                                  <div className="text-[10px] text-sonic-silver mt-0.5">
                                    {item.quantity} {getOrderT("quantity")} x {new Intl.NumberFormat(lang === "tr" ? "tr-TR" : "en-US", { style: "currency", currency: "TRY" }).format(item.price_at_purchase)}
                                  </div>
                                </div>
                                <div className="text-eerie-black font-extrabold shrink-0">
                                  {new Intl.NumberFormat(lang === "tr" ? "tr-TR" : "en-US", { style: "currency", currency: "TRY" }).format(item.price_at_purchase * item.quantity)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-cultured">
                        <div>
                          <h4 className="text-[10px] font-extrabold uppercase text-sonic-silver tracking-wider border-b border-cultured pb-2 mb-2.5">
                            {getOrderT("address_delivery")}
                          </h4>
                          <p className="text-xs font-medium text-sonic-silver leading-relaxed whitespace-pre-line">
                            {order.delivery_address}
                          </p>
                        </div>
                        <div>
                          <h4 className="text-[10px] font-extrabold uppercase text-sonic-silver tracking-wider border-b border-cultured pb-2 mb-2.5">
                            {getOrderT("address_billing")}
                          </h4>
                          <p className="text-xs font-medium text-sonic-silver leading-relaxed whitespace-pre-line">
                            {order.billing_address}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-3 pt-6 border-t border-cultured mt-2">
                        <button
                          type="button"
                          onClick={() => handleDownloadFile(`/api/v1/store/orders/${order.id}/excel`, `fatura-${order.order_number}.xls`)}
                          className="px-4 py-2 bg-cultured hover:bg-[#e2e8f0] text-eerie-black hover:text-salmon-pink rounded-lg font-extrabold text-[10px] uppercase tracking-[0.5px] border border-cultured transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>{getOrderT("download_excel")}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDownloadFile(`/api/v1/store/orders/${order.id}/images`, `gorseller-${order.order_number}.zip`)}
                          className="px-4 py-2 bg-cultured hover:bg-[#e2e8f0] text-eerie-black hover:text-salmon-pink rounded-lg font-extrabold text-[10px] uppercase tracking-[0.5px] border border-cultured transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>{getOrderT("download_images")}</span>
                        </button>

                        {order.order_status === "PENDING_PAYMENT" && (
                          <button
                            type="button"
                            onClick={() => openPaymentModal(order)}
                            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-extrabold text-[10px] uppercase tracking-[0.5px] border-none shadow transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>{getOrderT("pay_notification")}</span>
                          </button>
                        )}

                        {(order.order_status === "APPROVED" || order.order_status === "COMPLETED") && (
                          <button
                            type="button"
                            onClick={() => openRefundModal(order)}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-extrabold text-[10px] uppercase tracking-[0.5px] border-none shadow transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>{getOrderT("request_refund")}</span>
                          </button>
                        )}

                        {(order.order_status === "PENDING_PAYMENT" || order.order_status === "APPROVED") && (
                          <button
                            type="button"
                            onClick={() => handleCancelOrder(order.id)}
                            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-extrabold text-[10px] uppercase tracking-[0.5px] border-none shadow transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>{getOrderT("cancel_order")}</span>
                          </button>
                        )}
                      </div>

                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
