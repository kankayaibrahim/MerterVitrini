import React from "react";
import Image from "next/image";
import { Clipboard, AlertCircle, ChevronUp, ChevronDown, Download, CreditCard, RotateCcw, XCircle } from "lucide-react";
import { getResizedImageUrl } from "@/app/utils";

export interface OrderItem {
  readonly id: string;
  readonly product_name: string;
  readonly product_sku: string;
  readonly quantity: number;
  readonly price_at_purchase: number;
  readonly image_url_at_purchase?: string;
}

export interface UserOrder {
  readonly id: string;
  readonly order_number: string;
  readonly created_at: string;
  readonly total_amount: number;
  readonly order_status: string;
  readonly delivery_address?: string;
  readonly billing_address?: string;
  readonly items?: readonly OrderItem[];
}

interface OrderHistoryProps {
  readonly orders: readonly UserOrder[];
  readonly loadingOrders: boolean;
  readonly ordersError: string | null;
  readonly expandedOrders: Readonly<Record<string, boolean>>;
  readonly setExpandedOrders: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  readonly lang: string;
  readonly getOrderT: (key: string) => string;
  readonly handleDownloadFile: (url: string, filename: string) => void;
  readonly openPaymentModal: (order: UserOrder) => void;
  readonly openRefundModal: (order: UserOrder) => void;
  readonly handleCancelOrder: (orderId: string) => void;
}

function getOrderStatusBadgeClass(status: string): string {
  switch (status) {
    case "PENDING_PAYMENT":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "APPROVED":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "SHIPPING":
      return "bg-purple-50 text-purple-700 border-purple-200";
    case "COMPLETED":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "CANCELLED":
      return "bg-rose-50 text-rose-700 border-rose-200";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
}

interface OrderItemRowProps {
  readonly item: OrderItem;
  readonly lang: string;
  readonly getOrderT: (key: string) => string;
}

function OrderItemRow({ item, lang, getOrderT }: Readonly<OrderItemRowProps>) {
  const coverImg = getResizedImageUrl(item.image_url_at_purchase, 80, 106);
  const locale = lang === "tr" ? "tr-TR" : "en-US";
  const formattedUnitPrice = new Intl.NumberFormat(locale, { style: "currency", currency: "TRY" }).format(item.price_at_purchase);
  const formattedTotalPrice = new Intl.NumberFormat(locale, { style: "currency", currency: "TRY" }).format(item.price_at_purchase * item.quantity);

  return (
    <div className="flex items-center gap-4 text-xs font-bold">
      <div className="w-16 h-16 relative shrink-0 rounded-lg overflow-hidden border border-cultured">
        <Image
          src={coverImg}
          alt={item.product_name}
          width={64}
          height={64}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="flex-grow min-w-0">
        <div className="text-eerie-black font-extrabold truncate">
          {item.product_name}
        </div>
        <div className="text-[10px] text-sonic-silver mt-0.5">
          SKU: {item.product_sku}
        </div>
        <div className="text-[10px] text-sonic-silver mt-0.5">
          {item.quantity} {getOrderT("quantity")} x {formattedUnitPrice}
        </div>
      </div>
      <div className="text-eerie-black font-extrabold shrink-0">
        {formattedTotalPrice}
      </div>
    </div>
  );
}

interface OrderCardProps {
  readonly order: UserOrder;
  readonly isExpanded: boolean;
  readonly onToggleExpand: () => void;
  readonly lang: string;
  readonly getOrderT: (key: string) => string;
  readonly handleDownloadFile: (url: string, filename: string) => void;
  readonly openPaymentModal: (order: UserOrder) => void;
  readonly openRefundModal: (order: UserOrder) => void;
  readonly handleCancelOrder: (orderId: string) => void;
}

function OrderCard({
  order,
  isExpanded,
  onToggleExpand,
  lang,
  getOrderT,
  handleDownloadFile,
  openPaymentModal,
  openRefundModal,
  handleCancelOrder,
}: Readonly<OrderCardProps>) {
  const locale = lang === "tr" ? "tr-TR" : "en-US";
  const formattedDate = new Date(order.created_at).toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const formattedTotal = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "TRY",
  }).format(order.total_amount);

  return (
    <div className="border border-cultured rounded-2xl overflow-hidden shadow-sm bg-white hover:border-salmon-pink/30 transition-colors">
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
            <div className="text-eerie-black">{formattedDate}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-spanish-gray tracking-wider mb-0.5">
              {getOrderT("total_amount")}
            </div>
            <div className="text-salmon-pink font-extrabold">{formattedTotal}</div>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-center">
          <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${getOrderStatusBadgeClass(order.order_status)}`}>
            {getOrderT(`status_${order.order_status.toLowerCase()}`)}
          </span>

          <button
            type="button"
            onClick={onToggleExpand}
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
                {(order.items || []).map((item) => (
                  <OrderItemRow key={item.id} item={item} lang={lang} getOrderT={getOrderT} />
                ))}
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
}: Readonly<OrderHistoryProps>) {
  const renderOrdersContent = () => {
    if (loadingOrders) {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="spinner animate-spin w-8 h-8 border-4 border-salmon-pink border-t-transparent rounded-full" />
          <span className="text-xs font-bold text-sonic-silver select-none">
            Yükleniyor...
          </span>
        </div>
      );
    }

    if (ordersError) {
      return (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold flex items-center gap-2 select-none">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <span>{ordersError}</span>
        </div>
      );
    }

    if (orders.length === 0) {
      return (
        <div className="border-2 border-dashed border-cultured rounded-2xl p-12 text-center select-none">
          <Clipboard className="w-12 h-12 text-spanish-gray mx-auto mb-3" />
          <p className="text-sm font-bold text-sonic-silver">
            {getOrderT("no_orders_found")}
          </p>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-6">
        {orders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            isExpanded={!!expandedOrders[order.id]}
            onToggleExpand={() => setExpandedOrders((prev) => ({ ...prev, [order.id]: !prev[order.id] }))}
            lang={lang}
            getOrderT={getOrderT}
            handleDownloadFile={handleDownloadFile}
            openPaymentModal={openPaymentModal}
            openRefundModal={openRefundModal}
            handleCancelOrder={handleCancelOrder}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl p-6 sm:p-8 border border-cultured shadow-sm animate-in fade-in duration-200">
      <h2 className="font-sans font-extrabold text-xl text-eerie-black mb-1 select-none flex items-center gap-2">
        <Clipboard className="w-5 h-5 text-salmon-pink" />
        {getOrderT("orders_header")}
      </h2>
      <p className="text-xs text-sonic-silver font-semibold mb-8 select-none">
        {getOrderT("orders_desc")}
      </p>

      {renderOrdersContent()}
    </div>
  );
}
