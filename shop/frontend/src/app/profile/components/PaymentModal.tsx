import React from "react";
import { CreditCard } from "lucide-react";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: string;
  payBankName: string;
  setPayBankName: (v: string) => void;
  paySenderName: string;
  setPaySenderName: (v: string) => void;
  payAmount: string;
  setPayAmount: (v: string) => void;
  payNotes: string;
  setPayNotes: (v: string) => void;
  submittingPayment: boolean;
  handleSubmitPaymentNotification: (e: React.FormEvent) => void;
  getOrderT: (key: string) => string;
  getAddressT: (key: string) => string;
}

export default function PaymentModal({
  isOpen,
  onClose,
  lang,
  payBankName,
  setPayBankName,
  paySenderName,
  setPaySenderName,
  payAmount,
  setPayAmount,
  payNotes,
  setPayNotes,
  submittingPayment,
  handleSubmitPaymentNotification,
  getOrderT,
  getAddressT,
}: PaymentModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#0c0d10]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl animate-in scale-in duration-200 border border-cultured flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-cultured flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-eerie-black uppercase tracking-wider flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-salmon-pink" />
            {getOrderT("payment_modal_title")}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-cultured text-sonic-silver hover:text-salmon-pink hover:bg-cultured transition-all bg-transparent flex items-center justify-center text-lg font-bold cursor-pointer"
          >
            ×
          </button>
        </div>
        
        <form onSubmit={handleSubmitPaymentNotification} className="flex-grow overflow-y-auto p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-extrabold uppercase text-eerie-black tracking-wider">
              {getOrderT("bank_name")} *
            </label>
            <select
              required
              value={payBankName}
              onChange={(e) => setPayBankName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-cultured rounded-lg text-xs font-bold focus:outline-none focus:border-salmon-pink text-onyx cursor-pointer shadow-sm"
            >
              <option value="">-- Banka Seçin --</option>
              <option value="VakıfBank">VakıfBank</option>
              <option value="Ziraat Bankası">Ziraat Bankası</option>
              <option value="Garanti BBVA">Garanti BBVA</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-extrabold uppercase text-eerie-black tracking-wider">
              {getOrderT("sender_name")} *
            </label>
            <input
              type="text"
              required
              value={paySenderName}
              onChange={(e) => setPaySenderName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-cultured rounded-lg text-xs font-semibold focus:outline-none focus:border-salmon-pink text-eerie-black shadow-inner"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-extrabold uppercase text-eerie-black tracking-wider">
              {getOrderT("amount")} (TRY) *
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-cultured rounded-lg text-xs font-semibold focus:outline-none focus:border-salmon-pink text-eerie-black shadow-inner"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-extrabold uppercase text-eerie-black tracking-wider">
              {getOrderT("notes")}
            </label>
            <textarea
              value={payNotes}
              onChange={(e) => setPayNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-cultured rounded-lg text-xs font-semibold focus:outline-none focus:border-salmon-pink text-eerie-black shadow-inner h-20 resize-none"
              placeholder="Ek açıklama varsa yazabilirsiniz..."
            />
          </div>

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
              disabled={submittingPayment}
              className="px-5 py-2.5 bg-salmon-pink hover:bg-eerie-black text-white rounded-lg font-extrabold text-xs uppercase tracking-[0.5px] border-none shadow-md cursor-pointer disabled:opacity-50 transition-colors"
            >
              {submittingPayment ? getOrderT("submitting") : getOrderT("submit_notification")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
