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

interface CartInitialActionsProps {
  readonly onStartCheckout: () => void;
  readonly onRequestQuoteOnly: () => void;
  readonly lang: string;
}

function CartInitialActions({
  onStartCheckout,
  onRequestQuoteOnly,
  lang,
}: Readonly<CartInitialActionsProps>) {
  const isTr = lang === "tr";
  return (
    <div className="flex flex-col gap-3 pt-2 mt-1">
      <button
        type="button"
        onClick={onStartCheckout}
        className="w-full py-3.5 bg-salmon-pink hover:bg-eerie-black text-white rounded-[5px] font-extrabold text-xs tracking-[0.5px] shadow-sm border-none flex items-center justify-center gap-2 cursor-pointer transition-colors"
      >
        💳 {isTr ? "BANKA HAVALESİ İLE SİPARİŞ VER" : "ORDER VIA BANK TRANSFER"}
      </button>
      <button
        type="button"
        onClick={onRequestQuoteOnly}
        className="w-full py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-[5px] font-bold text-xs border-none flex items-center justify-center gap-2 cursor-pointer transition-colors"
      >
        📄 {isTr ? "FİYAT TEKLİFİ İSTE (PROFORMA)" : "REQUEST PRICE QUOTE ONLY"}
      </button>
    </div>
  );
}

interface AddressSelectorFieldProps {
  readonly id: string;
  readonly label: string;
  readonly addresses: readonly UserAddress[];
  readonly selectedAddr: string;
  readonly onSelectAddr: (v: string) => void;
  readonly customAddr: string;
  readonly onCustomAddrChange: (v: string) => void;
  readonly customOptionLabel: string;
  readonly emptyMessage: string;
  readonly placeholder: string;
}

function AddressSelectorField({
  id,
  label,
  addresses,
  selectedAddr,
  onSelectAddr,
  customAddr,
  onCustomAddrChange,
  customOptionLabel,
  emptyMessage,
  placeholder,
}: Readonly<AddressSelectorFieldProps>) {
  const showCustomTextarea = selectedAddr === "custom" || addresses.length === 0;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[10px] font-extrabold text-eerie-black tracking-[0.5px]">
        {label}
      </label>
      {addresses.length > 0 ? (
        <select
          id={id}
          value={selectedAddr}
          onChange={(e) => onSelectAddr(e.target.value)}
          className="w-full px-3 py-2 bg-white border border-cultured rounded-[5px] text-xs font-semibold focus:outline-none focus:border-salmon-pink text-eerie-black"
        >
          {addresses.map((a) => (
            <option key={a.id} value={a.id}>
              {a.title} ({a.address_line.substring(0, 30)}...)
            </option>
          ))}
          <option value="custom">{customOptionLabel}</option>
        </select>
      ) : (
        <div className="text-[10px] text-sonic-silver font-medium italic">
          {emptyMessage}
        </div>
      )}
      {showCustomTextarea && (
        <textarea
          required
          value={customAddr}
          onChange={(e) => onCustomAddrChange(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 bg-white border border-cultured rounded-[5px] text-xs font-semibold focus:outline-none focus:border-salmon-pink text-eerie-black resize-none mt-1"
          placeholder={placeholder}
        />
      )}
    </div>
  );
}

function BankAccountsNotice({ lang }: { readonly lang: string }) {
  const isTr = lang === "tr";
  return (
    <div className="bg-[#eff6ff] border border-blue-100 rounded-lg p-3.5 flex flex-col gap-2.5 text-xs text-blue-900 shadow-sm leading-normal">
      <div className="font-extrabold tracking-wide border-b border-blue-200/50 pb-1 text-[10px] text-blue-800">
        🏦 {isTr ? "BANKA HAVALE/EFT HESAPLARI" : "BANK ACCOUNTS"}
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
        {isTr 
          ? "* Lütfen transfere sipariş numaranızı açıklama olarak ekleyiniz. Ödeme sonrası profilinizden bildirim yapmayı unutmayınız." 
          : "* Please add order number in description. Confirm order on profile page after transfer."}
      </div>
    </div>
  );
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
      <CartInitialActions
        onStartCheckout={() => setIsCheckout(true)}
        onRequestQuoteOnly={onRequestQuoteOnly}
        lang={lang}
      />
    );
  }

  const isTr = lang === "tr";
  const confirmOrderLabel = `✔️ ${isTr ? "SİPARİŞİ ONAYLA" : "CONFIRM B2B ORDER"}`;

  return (
    <form onSubmit={onSubmitCheckout} className="flex flex-col gap-4 pt-2 border-t border-cultured mt-1">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-extrabold text-salmon-pink tracking-[0.5px]">
          {isTr ? "ADRES VE ÖDEME BİLGİLERİ" : "ADDRESS & PAYMENT"}
        </h4>
        <button
          type="button"
          onClick={onCancelCheckout}
          className="text-[10px] font-bold text-sonic-silver hover:text-salmon-pink bg-transparent border-none cursor-pointer"
        >
          &larr; {isTr ? "Sepete Dön" : "Back to Cart"}
        </button>
      </div>

      <AddressSelectorField
        id="cart-delivery-addr"
        label={`🚚 ${isTr ? "TESLİMAT ADRESİ" : "DELIVERY ADDRESS"}`}
        addresses={addresses}
        selectedAddr={deliveryAddr}
        onSelectAddr={setDeliveryAddr}
        customAddr={customDeliveryAddr}
        onCustomAddrChange={setCustomDeliveryAddr}
        customOptionLabel={isTr ? "+ Yeni Adres Girişi" : "+ Enter Custom Address"}
        emptyMessage={isTr ? "Profilinizde kayıtlı teslimat adresi bulunamadı." : "No saved shipping addresses found."}
        placeholder={isTr ? "Teslimat adresini yazınız..." : "Type delivery address..."}
      />

      <AddressSelectorField
        id="cart-billing-addr"
        label={`📄 ${isTr ? "FATURA ADRESİ" : "BILLING ADDRESS"}`}
        addresses={addresses}
        selectedAddr={billingAddr}
        onSelectAddr={setBillingAddr}
        customAddr={customBillingAddr}
        onCustomAddrChange={setCustomBillingAddr}
        customOptionLabel={isTr ? "+ Yeni Fatura Adresi" : "+ Enter Custom Billing"}
        emptyMessage={isTr ? "Profilinizde kayıtlı fatura adresi bulunamadı." : "No saved billing addresses found."}
        placeholder={isTr ? "Fatura adresini yazınız..." : "Type billing address..."}
      />

      <BankAccountsNotice lang={lang} />

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
