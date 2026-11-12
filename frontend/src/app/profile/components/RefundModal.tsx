import React from "react";
import { RotateCcw } from "lucide-react";
import { SupportedSeoLang, normalizeSeoLang } from "@/utils/seoHelpers";

const REFUND_REASON_PLACEHOLDERS: Record<SupportedSeoLang, string> = {
  tr: "İade talep nedeninizi açıklayınız...",
  en: "Please describe the reason for your refund request...",
  ru: "Пожалуйста, опишите причину запроса на возврат...",
  ar: "يرجى توضيح سبب طلب الاسترجاع...",
  de: "Bitte beschreiben Sie den Grund für Ihre Rücksendeanfrage...",
  fr: "Veuillez décrire le motif de votre demande de retour...",
  pl: "Proszę opisać powód zgłoszenia zwrotu...",
  bg: "Моля, опишете причината за заявката за връщане...",
};

export interface RefundOrderItem {
  readonly id: string;
  readonly product_name: string;
  readonly product_sku: string;
  readonly quantity: number;
}

interface RefundModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly lang: string;
  readonly refundType: "FULL" | "PARTIAL";
  readonly setRefundType: (v: "FULL" | "PARTIAL") => void;
  readonly refundReason: string;
  readonly setRefundReason: (v: string) => void;
  readonly refundOrderItems: readonly RefundOrderItem[];
  readonly refundQuantities: Readonly<Record<string, number>>;
  readonly handleRefundQtyChange: (
    itemId: string,
    val: number,
    max: number
  ) => void;
  readonly refundSelectedItems: Readonly<Record<string, boolean>>;
  readonly handleToggleRefundItem: (itemId: string) => void;
  readonly submittingRefund: boolean;
  readonly handleSubmitRefund: (e: React.FormEvent) => void;
  readonly getOrderT: (key: string) => string;
  readonly getAddressT: (key: string) => string;
}

export default function RefundModal({
  isOpen,
  onClose,
  lang,
  refundType,
  setRefundType,
  refundReason,
  setRefundReason,
  refundOrderItems,
  refundQuantities,
  handleRefundQtyChange,
  refundSelectedItems,
  handleToggleRefundItem,
  submittingRefund,
  handleSubmitRefund,
  getOrderT,
  getAddressT,
}: Readonly<RefundModalProps>) {
  if (!isOpen) return null;

  const safeLang = normalizeSeoLang(lang, "tr");

  return (
    <div className="fixed inset-0 bg-[#0c0d10]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl animate-in scale-in duration-200 border border-cultured flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-cultured flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-eerie-black uppercase tracking-wider flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-salmon-pink" />
            {getOrderT("refund_modal_title")}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-cultured text-sonic-silver hover:text-salmon-pink hover:bg-cultured transition-all bg-transparent flex items-center justify-center text-lg font-bold cursor-pointer"
          >
            ×
          </button>
        </div>

        <form
          onSubmit={handleSubmitRefund}
          className="flex-grow overflow-y-auto p-6 flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-extrabold uppercase text-eerie-black tracking-wider">
              {getOrderT("refund_type")} *
            </label>
            <select
              required
              value={refundType}
              onChange={(e) =>
                setRefundType(e.target.value as "FULL" | "PARTIAL")
              }
              className="w-full px-3.5 py-2.5 bg-white border border-cultured rounded-lg text-xs font-bold focus:outline-none focus:border-salmon-pink text-onyx cursor-pointer shadow-sm"
            >
              <option value="FULL">{getOrderT("full_refund")}</option>
              <option value="PARTIAL">{getOrderT("partial_refund")}</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-extrabold uppercase text-eerie-black tracking-wider">
              {getOrderT("refund_reason")} *
            </label>
            <textarea
              required
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-cultured rounded-lg text-xs font-semibold focus:outline-none focus:border-salmon-pink text-eerie-black shadow-inner h-20 resize-none"
              placeholder={REFUND_REASON_PLACEHOLDERS[safeLang]}
            />
          </div>

          {/* Partial Refund Items Selection */}
          {refundType === "PARTIAL" && (
            <div className="flex flex-col gap-3 border-t border-cultured pt-4">
              <label className="text-[10px] font-extrabold uppercase text-sonic-silver tracking-wider">
                {getOrderT("refund_items_selection")}
              </label>

              <div className="flex flex-col gap-3 max-h-48 overflow-y-auto pr-1">
                {refundOrderItems.map((item) => {
                  const isSelected = !!refundSelectedItems[item.id];
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-2 bg-[#fbfbfb] rounded-lg border border-cultured text-xs font-bold text-eerie-black"
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleRefundItem(item.id)}
                        className="rounded text-salmon-pink focus:ring-salmon-pink cursor-pointer w-4 h-4"
                      />
                      <div className="flex-grow min-w-0">
                        <div className="truncate">{item.product_name}</div>
                        <div className="text-[10px] text-sonic-silver">
                          SKU: {item.product_sku}
                        </div>
                      </div>

                      {isSelected && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] text-sonic-silver font-semibold">
                            {getOrderT("quantity")}:
                          </span>
                          <input
                            type="number"
                            min={1}
                            max={item.quantity}
                            value={refundQuantities[item.id] || 1}
                            onChange={(e) =>
                              handleRefundQtyChange(
                                item.id,
                                Number.parseInt(e.target.value, 10) || 1,
                                item.quantity
                              )
                            }
                            className="w-16 px-1.5 py-1 bg-white border border-cultured rounded text-center text-xs font-bold text-eerie-black focus:outline-none focus:border-salmon-pink"
                          />
                          <span className="text-[10px] text-sonic-silver font-semibold">
                            / {item.quantity}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-cultured mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-cultured hover:bg-spanish-gray/20 text-sonic-silver rounded-lg font-extrabold text-xs uppercase tracking-[0.5px] border-none cursor-pointer transition-colors"
            >
              {getAddressT("cancel_btn")}
            </button>
            <button
              type="submit"
              disabled={submittingRefund}
              className="px-5 py-2.5 bg-salmon-pink hover:bg-eerie-black text-white rounded-lg font-extrabold text-xs uppercase tracking-[0.5px] border-none shadow-md cursor-pointer disabled:opacity-50 transition-colors"
            >
              {submittingRefund
                ? getOrderT("submitting")
                : getOrderT("request_refund")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
