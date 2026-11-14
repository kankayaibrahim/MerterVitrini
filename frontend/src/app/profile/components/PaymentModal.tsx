import React from "react";
import { CreditCard } from "lucide-react";
import { normalizeCurrencyCode } from "@/utils/orderCurrency";
import { SupportedSeoLang, normalizeSeoLang } from "@/utils/seoHelpers";

interface PaymentModalExtraCopy {
  readonly selectBankPlaceholder: string;
  readonly intlSwiftOption: string;
  readonly notesPlaceholder: string;
}

const PAYMENT_MODAL_EXTRA: Record<SupportedSeoLang, PaymentModalExtraCopy> = {
  tr: {
    selectBankPlaceholder: "-- Banka Seçin --",
    intlSwiftOption: "Uluslararası SWIFT / Kurumsal Havale",
    notesPlaceholder: "Ek açıklama veya dekont referans no yazabilirsiniz...",
  },
  en: {
    selectBankPlaceholder: "-- Select Bank --",
    intlSwiftOption: "International SWIFT / Corporate Wire",
    notesPlaceholder: "Add transfer reference number or additional notes...",
  },
  ru: {
    selectBankPlaceholder: "-- Выберите банк --",
    intlSwiftOption: "Международный перевод SWIFT / Корпоративный счет",
    notesPlaceholder: "Укажите номер платежного поручения или комментарий...",
  },
  ar: {
    selectBankPlaceholder: "-- اختر البنك --",
    intlSwiftOption: "حوالة دولية SWIFT / تحويل بنكي للشركات",
    notesPlaceholder: "أدخل رقم مرجع الحوالة أو أي ملاحظات إضافية...",
  },
  de: {
    selectBankPlaceholder: "-- Bank auswählen --",
    intlSwiftOption: "Internationale SWIFT- / SEPA-Überweisung",
    notesPlaceholder: "Überweisungsreferenz oder optionale Anmerkungen...",
  },
  fr: {
    selectBankPlaceholder: "-- Sélectionner la banque --",
    intlSwiftOption: "Virement international SWIFT / SEPA",
    notesPlaceholder: "Indiquez la référence du virement ou vos remarques...",
  },
  pl: {
    selectBankPlaceholder: "-- Wybierz bank --",
    intlSwiftOption: "Przelew międzynarodowy SWIFT / SEPA",
    notesPlaceholder: "Wpisz numer referencyjny przelewu lub dodatkowe uwagi...",
  },
  bg: {
    selectBankPlaceholder: "-- Изберете банка --",
    intlSwiftOption: "Международен SWIFT / Банков превод",
    notesPlaceholder: "Въведете референтен номер на превода или бележка...",
  },
};

interface PaymentModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly lang: string;
  readonly currency?: string;
  readonly payBankName: string;
  readonly setPayBankName: (v: string) => void;
  readonly paySenderName: string;
  readonly setPaySenderName: (v: string) => void;
  readonly payAmount: string;
  readonly setPayAmount: (v: string) => void;
  readonly payNotes: string;
  readonly setPayNotes: (v: string) => void;
  readonly submittingPayment: boolean;
  readonly handleSubmitPaymentNotification: (e: React.FormEvent) => void;
  readonly getOrderT: (key: string) => string;
  readonly getAddressT: (key: string) => string;
}

export default function PaymentModal({
  isOpen,
  onClose,
  lang,
  currency = "TRY",
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
}: Readonly<PaymentModalProps>) {
  if (!isOpen) return null;

  const safeLang = normalizeSeoLang(lang, "tr");
  const extra = PAYMENT_MODAL_EXTRA[safeLang];

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

        <form
          onSubmit={handleSubmitPaymentNotification}
          className="flex-grow overflow-y-auto p-6 flex flex-col gap-4"
        >
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
              <option value="">{extra.selectBankPlaceholder}</option>
              <option value="VakıfBank">VakıfBank</option>
              <option value="Ziraat Bankası">Ziraat Bankası</option>
              <option value="Garanti BBVA">Garanti BBVA</option>
              <option value="SWIFT / International Wire">
                {extra.intlSwiftOption}
              </option>
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
              {getOrderT("amount")} ({normalizeCurrencyCode(currency)}) *
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
              placeholder={extra.notesPlaceholder}
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
              {submittingPayment
                ? getOrderT("submitting")
                : getOrderT("submit_notification")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
