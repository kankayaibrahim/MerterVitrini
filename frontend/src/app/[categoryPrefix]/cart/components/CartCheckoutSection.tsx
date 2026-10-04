"use client";

import React from "react";
import { UserAddress } from "@/app/profile/components/types";

interface CartCheckoutSectionProps {
  readonly isCheckout: boolean;
  readonly setIsCheckout: (v: boolean) => void;
  readonly onRequestQuoteOnly: () => void;
  readonly addresses: readonly UserAddress[];
  readonly deliveryAddr: string;
  readonly setDeliveryAddr: (v: string) => void;
  readonly customDeliveryAddr: string;
  readonly setCustomDeliveryAddr: (v: string) => void;
  readonly billingAddr: string;
  readonly setBillingAddr: (v: string) => void;
  readonly customBillingAddr: string;
  readonly setCustomBillingAddr: (v: string) => void;
  readonly submittingOrder: boolean;
  readonly onSubmitCheckout: (e: React.FormEvent) => void;
  readonly onCancelCheckout: () => void;
  readonly lang: string;
}

function getConfirmOrderText(lang: string): string {
  return lang === "tr" ? "SİPARİŞİ ONAYLA" : "CONFIRM B2B ORDER";
}

export default function CartCheckoutSection({
  isCheckout,
  setIsCheckout,
  onRequestQuoteOnly,
  addresses,
  deliveryAddr,
  setDeliveryAddr,
  customDeliveryAddr,
  setCustomDeliveryAddr,
  billingAddr,
  setBillingAddr,
  customBillingAddr,
  setCustomBillingAddr,
  submittingOrder,
  onSubmitCheckout,
  onCancelCheckout,
  lang,
}: Readonly<CartCheckoutSectionProps>) {
  if (!isCheckout) {
    return (
      <div className="flex flex-col gap-3 pt-2 mt-1">
        <button
          type="button"
          onClick={() => setIsCheckout(true)}
          className="w-full py-3.5 bg-salmon-pink hover:bg-eerie-black text-white rounded-[5px] font-extrabold text-xs tracking-[0.5px] shadow-sm border-none flex items-center justify-center gap-2 cursor-pointer transition-colors"
        >
          💳 {lang === "tr" ? "BANKA HAVALESİ İLE SİPARİŞ VER" : "ORDER VIA BANK TRANSFER"}
        </button>
        <button
          type="button"
          onClick={onRequestQuoteOnly}
          className="w-full py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-[5px] font-bold text-xs border-none flex items-center justify-center gap-2 cursor-pointer transition-colors"
        >
          📄 {lang === "tr" ? "FİYAT TEKLİFİ İSTE (PROFORMA)" : "REQUEST PRICE QUOTE ONLY"}
        </button>
      </div>
    );
  }

  const confirmOrderLabel = `✔️ ${getConfirmOrderText(lang)}`;

  return (
    <form onSubmit={onSubmitCheckout} className="flex flex-col gap-4 pt-2 border-t border-cultured mt-1">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-extrabold text-salmon-pink tracking-[0.5px]">
          {lang === "tr" ? "ADRES VE ÖDEME BİLGİLERİ" : "ADDRESS & PAYMENT"}
        </h4>
        <button
          type="button"
          onClick={onCancelCheckout}
          className="text-[10px] font-bold text-sonic-silver hover:text-salmon-pink bg-transparent border-none cursor-pointer"
        >
          &larr; {lang === "tr" ? "Sepete Dön" : "Back to Cart"}
        </button>
      </div>

      {/* Delivery Address */}
      <div className="flex flex-col gap-1">
        <label htmlFor="cart-delivery-addr" className="text-[10px] font-extrabold text-eerie-black tracking-[0.5px]">
          🚚 {lang === "tr" ? "TESLİMAT ADRESİ" : "DELIVERY ADDRESS"}
        </label>
        {addresses.length > 0 ? (
          <select
            id="cart-delivery-addr"
            value={deliveryAddr}
            onChange={(e) => setDeliveryAddr(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-cultured rounded-[5px] text-xs font-semibold focus:outline-none focus:border-salmon-pink text-eerie-black"
          >
            {addresses.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title} ({a.address_line.substring(0, 30)}...)
              </option>
            ))}
            <option value="custom">{lang === "tr" ? "+ Yeni Adres Girişi" : "+ Enter Custom Address"}</option>
          </select>
        ) : (
          <div className="text-[10px] text-sonic-silver font-medium italic">
            {lang === "tr" ? "Profilinizde kayıtlı teslimat adresi bulunamadı." : "No saved shipping addresses found."}
          </div>
        )}
        {(deliveryAddr === "custom" || addresses.length === 0) && (
          <textarea
            required
            value={customDeliveryAddr}
            onChange={(e) => setCustomDeliveryAddr(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 bg-white border border-cultured rounded-[5px] text-xs font-semibold focus:outline-none focus:border-salmon-pink text-eerie-black resize-none mt-1"
            placeholder={lang === "tr" ? "Teslimat adresini yazınız..." : "Type delivery address..."}
          />
        )}
      </div>

      {/* Billing Address */}
      <div className="flex flex-col gap-1">
        <label htmlFor="cart-billing-addr" className="text-[10px] font-extrabold text-eerie-black tracking-[0.5px]">
          📄 {lang === "tr" ? "FATURA ADRESİ" : "BILLING ADDRESS"}
        </label>
        {addresses.length > 0 ? (
          <select
            id="cart-billing-addr"
            value={billingAddr}
            onChange={(e) => setBillingAddr(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-cultured rounded-[5px] text-xs font-semibold focus:outline-none focus:border-salmon-pink text-eerie-black"
          >
            {addresses.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title} ({a.address_line.substring(0, 30)}...)
              </option>
            ))}
            <option value="custom">{lang === "tr" ? "+ Yeni Fatura Adresi" : "+ Enter Custom Billing"}</option>
          </select>
        ) : (
          <div className="text-[10px] text-sonic-silver font-medium italic">
            {lang === "tr" ? "Profilinizde kayıtlı fatura adresi bulunamadı." : "No saved billing addresses found."}
          </div>
        )}
        {(billingAddr === "custom" || addresses.length === 0) && (
          <textarea
            required
            value={customBillingAddr}
            onChange={(e) => setCustomBillingAddr(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 bg-white border border-cultured rounded-[5px] text-xs font-semibold focus:outline-none focus:border-salmon-pink text-eerie-black resize-none mt-1"
            placeholder={lang === "tr" ? "Fatura adresini yazınız..." : "Type billing address..."}
          />
        )}
      </div>

      {/* Bank IBAN detail list */}
      <div className="bg-[#eff6ff] border border-blue-100 rounded-lg p-3.5 flex flex-col gap-2.5 text-xs text-blue-900 shadow-sm leading-normal">
        <div className="font-extrabold tracking-wide border-b border-blue-200/50 pb-1 text-[10px] text-blue-800">
          🏦 {lang === "tr" ? "BANKA HAVALE/EFT HESAPLARI" : "BANK ACCOUNTS"}
        </div>
        <div className="flex flex-col gap-2 font-semibold text-[10px]">
          <div>
            <span className="font-bold text-blue-900">Ziraat Bankası:</span>
            <div className="font-mono text-[9.5px] text-zinc-700 bg-white/70 px-1.5 py-0.5 rounded select-all mt-0.5">TR00 0000 0000 0000 0000 0000 00</div>
            <span className="text-[8.5px] text-blue-800">Alıcı: Merter Vitrini B2B Tekstil A.Ş.</span>
          </div>
          <div>
            <span className="font-bold text-blue-900">Garanti BBVA:</span>
            <div className="font-mono text-[9.5px] text-zinc-700 bg-white/70 px-1.5 py-0.5 rounded select-all mt-0.5">TR00 0000 0000 0000 0000 0000 00</div>
            <span className="text-[8.5px] text-blue-800">Alıcı: Merter Vitrini B2B Tekstil A.Ş.</span>
          </div>
          <div>
            <span className="font-bold text-blue-900">VakıfBank:</span>
            <div className="font-mono text-[9.5px] text-zinc-700 bg-white/70 px-1.5 py-0.5 rounded select-all mt-0.5">TR00 0000 0000 0000 0000 0000 00</div>
            <span className="text-[8.5px] text-blue-800">Alıcı: Merter Vitrini B2B Tekstil A.Ş.</span>
          </div>
        </div>
        <div className="text-[8.5px] font-bold text-blue-800 italic mt-1 border-t border-blue-200/30 pt-1.5 leading-snug">
          {lang === "tr" 
            ? "* Lütfen transfere sipariş numaranızı açıklama olarak ekleyiniz. Ödeme sonrası profilinizden bildirim yapmayı unutmayınız." 
            : "* Please add order number in description. Confirm order on profile page after transfer."}
        </div>
      </div>

      <button
        type="submit"
        disabled={submittingOrder}
        className="w-full py-3.5 bg-salmon-pink hover:bg-eerie-black text-white rounded-[5px] font-extrabold text-xs tracking-[0.5px] shadow-sm border-none flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-[0.99] transition-all"
      >
        {submittingOrder ? (
          <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
        ) : (
          confirmOrderLabel
        )}
      </button>
    </form>
  );
}
