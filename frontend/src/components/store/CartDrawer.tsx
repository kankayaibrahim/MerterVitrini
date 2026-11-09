"use client";

import React from "react";
import { X, ShoppingBag, Lock } from "lucide-react";
import { CartItem } from "@/types/store";
import { t, getCategoryPrefix } from "@/app/i18n";
import { convertPrice, getResizedImageUrl, showToast, ExchangeRate } from "@/app/utils";
import { useIsStoreAuthenticated, openStoreAuthModal, getShortMemberPriceLabel } from "@/app/storeAuth";
import { UserAddress } from "@/app/profile/components/types";

export interface InquiryFormData {
  fullName: string;
  companyName: string;
  phoneNumber: string;
  emailAddress: string;
  customerMessage: string;
}

interface CartDrawerProps {
  readonly lang: string;
  readonly cart: readonly CartItem[];
  readonly onClose: () => void;
  readonly onAdjustQty: (index: number, change: number) => void;
  readonly onRemove: (index: number) => void;
  readonly totalPkgs: number;
  readonly totalItemsCount: number;
  readonly totalWeight: number;
  readonly totalPrice?: number;
  readonly submittingInquiry: boolean;
  readonly onSubmitInquiry: (data: InquiryFormData) => void;
  readonly displayCurrency?: string;
  readonly exchangeRates?: readonly ExchangeRate[];
}

function formatAddress(addr: UserAddress): string {
  const cityPart = addr.city_name ? `${addr.city_name}, ` : "";
  const companyPart = addr.company_name ? ` - ${addr.company_name}` : "";
  const stateCountry = `${addr.state_name || ""}/${addr.country_name || ""}`;
  return `${addr.first_name} ${addr.last_name}${companyPart}\n${addr.address_line}\n${cityPart}${stateCountry}\nTel: ${addr.phone}`;
}

function resolveFinalAddress(
  selectedId: string,
  customText: string,
  addresses: readonly UserAddress[]
): string {
  if (selectedId === "custom" || addresses.length === 0) {
    return customText.trim();
  }
  const addr = addresses.find((a) => a.id === selectedId);
  return addr ? formatAddress(addr) : "";
}

function selectDefaultAddresses(
  data: readonly UserAddress[],
  setBilling: (id: string) => void,
  setDelivery: (id: string) => void
) {
  const defaultBill = data.find((a) => a.address_type === "billing" && a.is_default);
  const firstBill = defaultBill || data.find((a) => a.address_type === "billing") || data[0];
  if (firstBill?.id) {
    setBilling(firstBill.id);
  }

  const defaultDel = data.find((a) => a.address_type === "shipping" && a.is_default);
  const firstDel = defaultDel || data.find((a) => a.address_type === "shipping") || data[0];
  if (firstDel?.id) {
    setDelivery(firstDel.id);
  }
}

interface SubmitB2BOrderParams {
  readonly token: string;
  readonly cart: readonly CartItem[];
  readonly billingAddress: string;
  readonly deliveryAddress: string;
  readonly lang: string;
}

async function submitB2BOrder({
  token,
  cart,
  billingAddress,
  deliveryAddress,
  lang,
}: SubmitB2BOrderParams): Promise<string> {
  const syncRes = await fetch("/api/v1/store/cart/sync", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      items: cart.map((item) => ({
        product_id: item.product_id,
        quantity: item.packages_qty * item.units_per_package,
      })),
    }),
  });

  if (!syncRes.ok) {
    const syncData = await syncRes.json().catch(() => ({}));
    const fallbackSyncMsg = lang === "tr" ? "Sepet senkronizasyonu başarısız." : "Failed to sync cart.";
    throw new Error(syncData.error || fallbackSyncMsg);
  }

  const res = await fetch("/api/v1/store/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      billing_address: billingAddress,
      delivery_address: deliveryAddress,
      payment_method: "BANK_TRANSFER",
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    const fallbackOrderMsg = lang === "tr" ? "Sipariş verilirken bir hata oluştu." : "Failed to place order.";
    throw new Error(data.error || fallbackOrderMsg);
  }

  return data.order_number;
}

function getFormattedTcmbDate(rawDate: string | undefined, lang: string): string {
  if (!rawDate) return "";
  try {
    const d = new Date(rawDate);
    const localeMap: Record<string, string> = {
      tr: "tr-TR",
      en: "en-US",
      ru: "ru-RU",
      ar: "ar-EG",
      de: "de-DE",
      pl: "pl-PL",
      bg: "bg-BG",
      fr: "fr-FR",
    };
    const locale = localeMap[lang] || "en-US";
    return d.toLocaleDateString(locale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return String(rawDate).split("T")[0] || "";
  }
}

function getTcmbDateNotice(formattedDate: string, lang: string): string {
  const notices: Record<string, string> = {
    tr: `* ${formattedDate} tarihli TCMB kur bilgileri baz alınmıştır. (TR/İstanbul saat dilimi esaslıdır)`,
    ru: `* Курсы основаны на официальной публикации ЦБ Турции (TCMB) от ${formattedDate} (по часовому поясу TR/Стамбул)`,
    ar: `* الأسعار تعتمد على النشرة الرسمية للبنك المركزي التركي (TCMB) بتاريخ ${formattedDate} (توقيت تركيا/إسطنبول)`,
    de: `* Die Kurse basieren auf der offiziellen Veröffentlichung der TCMB vom ${formattedDate} (TR/Istanbul-Zeitzone gilt)`,
    pl: `* Kursy oparte na oficjalnej publikacji Banku Centralnego Turcji (TCMB) z dnia ${formattedDate} (obowiązuje strefa czasowa TR/Stambuł)`,
    bg: `* Валутните курсове са базирани на официалната публикация на TCMB от ${formattedDate} (приложена е часовата зона TR/Истанбул)`,
    fr: `* Les taux de change sont basés sur la publication officielle de la TCMB du ${formattedDate} (fuseau horaire TR/Istanbul appliqué)`,
  };
  return notices[lang] || `* Rates based on official TCMB publication of ${formattedDate} (TR/Istanbul time-boundary applied)`;
}

interface CartItemCardProps {
  readonly item: CartItem;
  readonly idx: number;
  readonly lang: string;
  readonly displayCurrency: string;
  readonly exchangeRates: readonly ExchangeRate[];
  readonly onAdjustQty: (index: number, change: number) => void;
  readonly onRemove: (index: number) => void;
}

function CartItemCard({
  item,
  idx,
  lang,
  displayCurrency,
  exchangeRates,
  onAdjustQty,
  onRemove,
}: Readonly<CartItemCardProps>) {
  const isAuthenticated = useIsStoreAuthenticated();
  const itemTotalUnits = item.packages_qty * item.units_per_package;
  const rawItemPricePerUnit = item.price_per_unit;
  const rawItemTotalPrice = itemTotalUnits * rawItemPricePerUnit;

  let pricePerUnit = rawItemPricePerUnit;
  let itemTotalPrice = rawItemTotalPrice;
  let currency = displayCurrency || "TRY";

  if (displayCurrency && exchangeRates.length > 0) {
    pricePerUnit = convertPrice(rawItemPricePerUnit, item.currency || "TRY", displayCurrency, [...exchangeRates]);
    itemTotalPrice = convertPrice(rawItemTotalPrice, item.currency || "TRY", displayCurrency, [...exchangeRates]);
  } else {
    currency = item.currency || "TRY";
  }

  const title = item.title_translations?.[lang] || item.title;

  return (
    <div className="border border-cultured bg-[#fafafa] rounded-[5px] p-3 flex gap-3 relative shadow-inner">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={getResizedImageUrl(item.image_url, 80, 106)}
        alt={item.title}
        className="w-14 h-18 object-cover rounded-[5px] bg-white border border-cultured"
      />

      <div className="flex-grow flex flex-col gap-1 pr-6">
        <h4 className="text-sm font-bold text-eerie-black line-clamp-2 leading-relaxed">
          {title}
        </h4>

        <span className="text-xs font-bold text-salmon-pink block">
          {t("color", lang)}: {item.color} | SKU: {item.custom_sku}
        </span>

        <div className="flex items-center gap-2 mt-1.5">
          <button
            type="button"
            onClick={() => onAdjustQty(idx, -1)}
            className="w-6 h-6 rounded-[5px] border border-cultured bg-white flex items-center justify-center font-bold text-xs cursor-pointer select-none active:scale-90"
          >
            −
          </button>
          <span className="text-sm font-bold text-onyx">
            {item.packages_qty} {lang === "tr" ? "Paket" : "Pack"}
          </span>
          <button
            type="button"
            onClick={() => onAdjustQty(idx, 1)}
            className="w-6 h-6 rounded-[5px] border border-cultured bg-white flex items-center justify-center font-bold text-xs cursor-pointer select-none active:scale-90"
          >
            +
          </button>
        </div>

        <span className="text-xs font-semibold text-sonic-silver mt-1.5 block">
          {itemTotalUnits} {lang === "tr" ? "Adet" : t("piece", lang)} ({item.units_per_package} {lang === "tr" ? "Adet/Paket" : "Pcs/Pack"})
          {isAuthenticated ? ` x ${pricePerUnit.toFixed(2)} ${currency}` : ""}
        </span>
      </div>

      <div className="shrink-0 self-center font-extrabold text-sm text-eerie-black text-right pl-1">
        {isAuthenticated ? (
          `${itemTotalPrice.toFixed(2)} ${currency}`
        ) : (
          <button
            type="button"
            onClick={() => openStoreAuthModal("login")}
            className="inline-flex items-center gap-1 text-[10px] font-extrabold text-salmon-pink hover:underline bg-transparent border-none p-0 cursor-pointer"
          >
            <Lock className="w-2.5 h-2.5 shrink-0" />
            <span>{getShortMemberPriceLabel(lang)}</span>
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => onRemove(idx)}
        className="absolute top-2 right-2 border-none bg-transparent text-sonic-silver hover:text-salmon-pink cursor-pointer text-sm font-extrabold"
      >
        &times;
      </button>
    </div>
  );
}

interface CartCurrencyEquivalentsProps {
  readonly grandTotalInTRY: number;
  readonly exchangeRates: readonly ExchangeRate[];
  readonly lang: string;
}

function CartCurrencyEquivalents({
  grandTotalInTRY,
  exchangeRates,
  lang,
}: Readonly<CartCurrencyEquivalentsProps>) {
  const eqUSD = convertPrice(grandTotalInTRY, "TRY", "USD", [...exchangeRates]);
  const eqEUR = convertPrice(grandTotalInTRY, "TRY", "EUR", [...exchangeRates]);
  const eqGBP = convertPrice(grandTotalInTRY, "TRY", "GBP", [...exchangeRates]);
  const eqTRY = grandTotalInTRY;

  const ratesBanner = exchangeRates.length > 0
    ? exchangeRates.filter((r) => ["USD", "EUR", "GBP"].includes(r.currency_code.toUpperCase()))
    : [];

  const rawDate = exchangeRates.find((r) => r.publication_date)?.publication_date;
  const formattedDate = getFormattedTcmbDate(rawDate, lang);
  const dateInfo = getTcmbDateNotice(formattedDate, lang);

  return (
    <div className="mt-3 pt-3 border-t border-dashed border-cultured flex flex-col gap-2.5 select-none bg-white p-3 rounded-[8px] border">
      <div className="flex flex-col gap-1">
        <span className="text-xs uppercase font-extrabold text-sonic-silver tracking-[0.5px]">
          {t("exchange_rate_equivalents", lang)}
        </span>
        {ratesBanner.length > 0 && (
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold text-spanish-gray">
              {t("active_tcmb_rates", lang)}{" "}
              {ratesBanner.map((r, i) => (
                <span key={r.currency_code} className="font-bold text-sonic-silver">
                  {i > 0 && " | "}1 {r.currency_code} = {Number(r.buying_rate).toFixed(4)} TL
                </span>
              ))}
            </span>
            {formattedDate && (
              <span className="text-[9px] font-medium text-spanish-gray italic leading-normal">
                {dateInfo}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs font-extrabold text-onyx">
        <div className="flex items-center justify-between bg-[#fafafa] border border-cultured rounded p-2 shadow-inner">
          <span className="text-sonic-silver">🇹🇷 TRY:</span>
          <span className="text-eerie-black font-extrabold">{eqTRY.toFixed(2)} ₺</span>
        </div>
        <div className="flex items-center justify-between bg-[#fafafa] border border-cultured rounded p-2 shadow-inner">
          <span className="text-sonic-silver">🇺🇸 USD:</span>
          <span className="text-eerie-black font-extrabold">${eqUSD.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between bg-[#fafafa] border border-cultured rounded p-2 shadow-inner">
          <span className="text-sonic-silver">🇪🇺 EUR:</span>
          <span className="text-eerie-black font-extrabold">€{eqEUR.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between bg-[#fafafa] border border-cultured rounded p-2 shadow-inner">
          <span className="text-sonic-silver">🇬🇧 GBP:</span>
          <span className="text-eerie-black font-extrabold">£{eqGBP.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

interface CartTotalsSectionProps {
  readonly lang: string;
  readonly totalPkgs: number;
  readonly totalItemsCount: number;
  readonly totalWeight: number;
  readonly finalTotalPrice: number;
  readonly displayCurrency: string;
  readonly grandTotalInTRY: number;
  readonly exchangeRates: readonly ExchangeRate[];
}

function CartTotalsSection({
  lang,
  totalPkgs,
  totalItemsCount,
  totalWeight,
  finalTotalPrice,
  displayCurrency,
  grandTotalInTRY,
  exchangeRates,
}: Readonly<CartTotalsSectionProps>) {
  const isAuthenticated = useIsStoreAuthenticated();
  return (
    <div className="border border-cultured bg-[#fafafa] p-4 rounded-[10px] flex flex-col gap-2.5 shadow-sm shrink-0">
      <div className="flex justify-between text-sm font-bold text-onyx">
        <span>{t("total_packages", lang)}:</span>
        <span className="text-eerie-black font-extrabold">{totalPkgs} {lang === "tr" ? "Paket" : "Pack"}</span>
      </div>
      <div className="flex justify-between text-sm font-bold text-onyx">
        <span>{t("total_qty", lang)}:</span>
        <span className="text-eerie-black font-extrabold">{totalItemsCount} {lang === "tr" ? "Adet" : t("piece", lang)}</span>
      </div>
      <div className="flex justify-between text-sm font-bold text-onyx">
        <span>{t("total_weight", lang)}:</span>
        <span className="text-eerie-black font-extrabold">{totalWeight.toFixed(2)} kg</span>
      </div>
      <div className="flex justify-between items-center text-base font-extrabold text-salmon-pink border-t border-cultured pt-2.5 mt-1 select-none">
        <span>{t("grand_total", lang)}:</span>
        {isAuthenticated ? (
          <span>{finalTotalPrice.toFixed(2)} {displayCurrency}</span>
        ) : (
          <button
            type="button"
            onClick={() => openStoreAuthModal("login")}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900 hover:bg-salmon-pink text-white text-xs font-extrabold transition-colors cursor-pointer border-none"
          >
            <Lock className="w-3 h-3 shrink-0" />
            <span>{getShortMemberPriceLabel(lang)}</span>
          </button>
        )}
      </div>

      {isAuthenticated && (
        <CartCurrencyEquivalents
          grandTotalInTRY={grandTotalInTRY}
          exchangeRates={exchangeRates}
          lang={lang}
        />
      )}
    </div>
  );
}

interface CartCheckoutFormProps {
  readonly lang: string;
  readonly addresses: readonly UserAddress[];
  readonly deliveryAddr: string;
  readonly setDeliveryAddr: (val: string) => void;
  readonly customDeliveryAddr: string;
  readonly setCustomDeliveryAddr: (val: string) => void;
  readonly billingAddr: string;
  readonly setBillingAddr: (val: string) => void;
  readonly customBillingAddr: string;
  readonly setCustomBillingAddr: (val: string) => void;
  readonly submittingOrder: boolean;
  readonly onBackToCart: () => void;
  readonly onSubmit: (e: React.FormEvent) => void;
}

interface AddressPickerProps {
  readonly title: string;
  readonly icon: string;
  readonly addresses: readonly UserAddress[];
  readonly selectedAddr: string;
  readonly onSelectAddr: (val: string) => void;
  readonly customAddr: string;
  readonly onCustomAddrChange: (val: string) => void;
  readonly customPlaceholder: string;
  readonly customOptionLabel: string;
  readonly emptyNotice: string;
}

function AddressPicker({
  title,
  icon,
  addresses,
  selectedAddr,
  onSelectAddr,
  customAddr,
  onCustomAddrChange,
  customPlaceholder,
  customOptionLabel,
  emptyNotice,
}: Readonly<AddressPickerProps>) {
  const showTextarea = selectedAddr === "custom" || addresses.length === 0;

  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] uppercase font-extrabold text-eerie-black tracking-[0.5px]">
        {icon} {title}
      </label>
      {addresses.length > 0 ? (
        <select
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
          {emptyNotice}
        </div>
      )}
      {showTextarea && (
        <textarea
          required
          value={customAddr}
          onChange={(e) => onCustomAddrChange(e.target.value)}
          rows={3}
          className="w-full px-3 py-2.5 bg-white border border-cultured rounded-[5px] text-xs font-semibold focus:outline-none focus:border-salmon-pink text-eerie-black resize-none mt-1"
          placeholder={customPlaceholder}
        />
      )}
    </div>
  );
}

function BankTransferInfo({ lang }: { readonly lang: string }) {
  const isTr = lang === "tr";
  return (
    <div className="bg-[#eff6ff] border border-blue-100 rounded-lg p-3 flex flex-col gap-2.5 text-xs text-blue-900 shadow-sm leading-normal">
      <div className="font-extrabold uppercase tracking-[0.5px] border-b border-blue-200/50 pb-1 text-[11px] text-blue-800">
        🏦 {isTr ? "Banka Havale/EFT Hesapları" : "Bank Transfer IBAN Accounts"}
      </div>
      <div className="flex flex-col gap-1.5 font-semibold text-[11px]">
        <div>
          <span className="font-bold text-blue-900">Ziraat Bankası:</span>
          <div className="font-mono text-[10px] text-zinc-700 bg-white/70 px-1 py-0.5 rounded select-all mt-0.5">XXX</div>
          <span className="text-[9px] text-blue-800">Alıcı: Modanet B2B Tekstil</span>
        </div>
        <div>
          <span className="font-bold text-blue-900">Garanti BBVA:</span>
          <div className="font-mono text-[10px] text-zinc-700 bg-white/70 px-1 py-0.5 rounded select-all mt-0.5">XXX</div>
          <span className="text-[9px] text-blue-800">Alıcı: Modanet B2B Tekstil</span>
        </div>
        <div>
          <span className="font-bold text-blue-900">VakıfBank:</span>
          <div className="font-mono text-[10px] text-zinc-700 bg-white/70 px-1 py-0.5 rounded select-all mt-0.5">XXX</div>
          <span className="text-[9px] text-blue-800">Alıcı: Modanet B2B Tekstil</span>
        </div>
      </div>
      <div className="text-[9px] font-bold text-blue-800 italic mt-1 border-t border-blue-200/30 pt-1.5 leading-snug">
        {isTr
          ? "* Lütfen transfere sipariş numaranızı açıklama olarak ekleyiniz. Ödeme sonrası profilinizden bildirim yapmayı unutmayınız."
          : "* Please add your order number as payment explanation. Submit notification from profile after transfer."}
      </div>
    </div>
  );
}

function CartCheckoutForm({
  lang,
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
  onBackToCart,
  onSubmit,
}: Readonly<CartCheckoutFormProps>) {
  const isTr = lang === "tr";
  const submitButtonText = isTr ? "Siparişi Onayla" : "Confirm B2B Order";

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 pt-4 border-t border-cultured mt-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs uppercase font-extrabold text-salmon-pink tracking-[0.5px]">
          {isTr ? "Adres ve Ödeme Bilgileri" : "Address & Payment Info"}
        </h4>
        <button
          type="button"
          onClick={onBackToCart}
          className="text-xs font-bold text-sonic-silver hover:text-salmon-pink bg-transparent border-none cursor-pointer"
        >
          &larr; {isTr ? "Sepete Dön" : "Back to Cart"}
        </button>
      </div>

      <AddressPicker
        title={isTr ? "Teslimat Adresi" : "Delivery Address"}
        icon="🚚"
        addresses={addresses}
        selectedAddr={deliveryAddr}
        onSelectAddr={setDeliveryAddr}
        customAddr={customDeliveryAddr}
        onCustomAddrChange={setCustomDeliveryAddr}
        customPlaceholder={isTr ? "Teslimat adresini yazınız..." : "Type delivery address..."}
        customOptionLabel={isTr ? "+ Yeni Adres Girişi" : "+ Enter Custom Address"}
        emptyNotice={isTr ? "Profilinizde kayıtlı teslimat adresi bulunamadı." : "No saved shipping addresses found."}
      />

      <AddressPicker
        title={isTr ? "Fatura Adresi" : "Billing Address"}
        icon="📄"
        addresses={addresses}
        selectedAddr={billingAddr}
        onSelectAddr={setBillingAddr}
        customAddr={customBillingAddr}
        onCustomAddrChange={setCustomBillingAddr}
        customPlaceholder={isTr ? "Fatura adresini yazınız..." : "Type billing address..."}
        customOptionLabel={isTr ? "+ Yeni Fatura Adresi Girişi" : "+ Enter Custom Billing Address"}
        emptyNotice={isTr ? "Profilinizde kayıtlı fatura adresi bulunamadı." : "No saved billing addresses found."}
      />

      <BankTransferInfo lang={lang} />

      <button
        type="submit"
        disabled={submittingOrder}
        className="w-full py-3.5 bg-salmon-pink hover:bg-eerie-black text-white rounded-[5px] font-extrabold text-sm tracking-[0.5px] uppercase shadow-sm border-none flex items-center justify-center gap-2 cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed mt-2 active:scale-[0.99] transition-colors duration-300"
      >
        {submittingOrder ? (
          <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
        ) : (
          `✔️ ${submitButtonText}`
        )}
      </button>
    </form>
  );
}

interface CartInquiryFormProps {
  readonly lang: string;
  readonly token: string | null;
  readonly fullName: string;
  readonly setFullName: (val: string) => void;
  readonly companyName: string;
  readonly setCompanyName: (val: string) => void;
  readonly phoneNumber: string;
  readonly setPhoneNumber: (val: string) => void;
  readonly emailAddress: string;
  readonly setEmailAddress: (val: string) => void;
  readonly customerMessage: string;
  readonly setCustomerMessage: (val: string) => void;
  readonly submittingInquiry: boolean;
  readonly onGoToCheckout: () => void;
  readonly onSubmit: (e: React.FormEvent) => void;
}

function CartInquiryForm({
  lang,
  token,
  fullName,
  setFullName,
  companyName,
  setCompanyName,
  phoneNumber,
  setPhoneNumber,
  emailAddress,
  setEmailAddress,
  customerMessage,
  setCustomerMessage,
  submittingInquiry,
  onGoToCheckout,
  onSubmit,
}: Readonly<CartInquiryFormProps>) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3.5 pt-4 border-t border-cultured mt-2">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase font-extrabold text-eerie-black tracking-[0.5px]">
          {lang === "tr" ? "Fiyat Teklifi Talep Formu" : "Request Quote Form"}
        </span>
        {token && (
          <button
            type="button"
            onClick={onGoToCheckout}
            className="text-[10px] font-bold text-salmon-pink bg-transparent border-none cursor-pointer"
          >
            &larr; {lang === "tr" ? "Checkout'a Git" : "Go to Checkout"}
          </button>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs uppercase font-extrabold text-eerie-black tracking-[0.5px]">{t("full_name", lang)}</label>
        <input
          type="text"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full px-3.5 py-2.5 bg-white border border-cultured rounded-[5px] text-sm font-semibold focus:outline-none focus:border-salmon-pink focus:ring-salmon-pink transition-all shadow-sm text-eerie-black"
          placeholder={t("placeholder_full_name", lang)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs uppercase font-extrabold text-eerie-black tracking-[0.5px]">{t("company_name", lang)}</label>
        <input
          type="text"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          className="w-full px-3.5 py-2.5 bg-white border border-cultured rounded-[5px] text-sm font-semibold focus:outline-none focus:border-salmon-pink focus:ring-salmon-pink transition-all shadow-sm text-eerie-black"
          placeholder={t("placeholder_company_name", lang)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs uppercase font-extrabold text-eerie-black tracking-[0.5px]">{t("phone", lang)}</label>
        <input
          type="tel"
          required
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          className="w-full px-3.5 py-2.5 bg-white border border-cultured rounded-[5px] text-sm font-semibold focus:outline-none focus:border-salmon-pink focus:ring-salmon-pink transition-all shadow-sm text-eerie-black"
          placeholder={t("placeholder_phone", lang)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs uppercase font-extrabold text-eerie-black tracking-[0.5px]">{t("email", lang)}</label>
        <input
          type="email"
          required
          value={emailAddress}
          onChange={(e) => setEmailAddress(e.target.value)}
          className="w-full px-3.5 py-2.5 bg-white border border-cultured rounded-[5px] text-sm font-semibold focus:outline-none focus:border-salmon-pink focus:ring-salmon-pink transition-all shadow-sm text-eerie-black"
          placeholder={t("placeholder_email", lang)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs uppercase font-extrabold text-eerie-black tracking-[0.5px]">{t("message", lang)}</label>
        <textarea
          value={customerMessage}
          onChange={(e) => setCustomerMessage(e.target.value)}
          className="w-full px-3.5 py-2.5 bg-white border border-cultured rounded-[5px] text-sm font-semibold focus:outline-none focus:border-salmon-pink focus:ring-salmon-pink transition-all shadow-sm resize-none h-14 text-eerie-black"
          placeholder={t("placeholder_message", lang)}
        />
      </div>

      <button
        type="submit"
        disabled={submittingInquiry}
        className="w-full py-3.5 bg-salmon-pink hover:bg-eerie-black text-white rounded-[5px] font-extrabold text-sm tracking-[0.5px] uppercase shadow-sm border-none flex items-center justify-center gap-2 cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed mt-3 active:scale-[0.99] transition-colors duration-300"
      >
        {submittingInquiry ? (
          <div className="spinner w-4 h-4 border-2" />
        ) : (
          "🚀 " + t("submit_inquiry", lang)
        )}
      </button>
    </form>
  );
}

export default function CartDrawer({
  lang,
  cart,
  onClose,
  onAdjustQty,
  onRemove,
  totalPkgs,
  totalItemsCount,
  totalWeight,
  submittingInquiry,
  onSubmitInquiry,
  displayCurrency = "TRY",
  exchangeRates = [],
}: Readonly<CartDrawerProps>) {
  const [fullName, setFullName] = React.useState<string>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = JSON.parse(localStorage.getItem("store_user_info") || "{}");
        return [stored.first_name, stored.last_name].filter(Boolean).join(" ");
      } catch {
        return "";
      }
    }
    return "";
  });
  const [companyName, setCompanyName] = React.useState<string>("");
  const [phoneNumber, setPhoneNumber] = React.useState<string>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = JSON.parse(localStorage.getItem("store_user_info") || "{}");
        return stored.phone || "";
      } catch {
        return "";
      }
    }
    return "";
  });
  const [emailAddress, setEmailAddress] = React.useState<string>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = JSON.parse(localStorage.getItem("store_user_info") || "{}");
        return stored.email || "";
      } catch {
        return "";
      }
    }
    return "";
  });
  const [customerMessage, setCustomerMessage] = React.useState<string>("");

  const handleInquirySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmitInquiry({
      fullName,
      companyName,
      phoneNumber,
      emailAddress,
      customerMessage,
    });
  };
  const [isCheckout, setIsCheckout] = React.useState(false);
  const [forceShowInquiry, setForceShowInquiry] = React.useState(false);
  const [addresses, setAddresses] = React.useState<UserAddress[]>([]);
  const [billingAddr, setBillingAddr] = React.useState("");
  const [deliveryAddr, setDeliveryAddr] = React.useState("");
  const [customBillingAddr, setCustomBillingAddr] = React.useState("");
  const [customDeliveryAddr, setCustomDeliveryAddr] = React.useState("");
  const [submittingOrder, setSubmittingOrder] = React.useState(false);

  const token = typeof window !== "undefined" ? localStorage.getItem("store_user_token") : null;

  React.useEffect(() => {
    if (token && isCheckout) {
      fetch("/api/v1/store/profile/addresses", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
        .then((res) => res.json())
        .then((data: UserAddress[]) => {
          if (Array.isArray(data)) {
            setAddresses(data);
            selectDefaultAddresses(data, setBillingAddr, setDeliveryAddr);
          }
        })
        .catch((err) => console.error("Error fetching addresses:", err));
    }
  }, [token, isCheckout]);

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    const finalBilling = resolveFinalAddress(billingAddr, customBillingAddr, addresses);
    const finalDelivery = resolveFinalAddress(deliveryAddr, customDeliveryAddr, addresses);

    if (!finalBilling || !finalDelivery) {
      showToast(lang === "tr" ? "Lütfen fatura ve teslimat adreslerini doldurunuz." : "Please select or enter billing and delivery addresses.");
      return;
    }

    setSubmittingOrder(true);
    try {
      const orderNumber = await submitB2BOrder({
        token,
        cart,
        billingAddress: finalBilling,
        deliveryAddress: finalDelivery,
        lang,
      });

      const successNotice = lang === "tr"
        ? `Siparişiniz başarıyla alındı! Sipariş No: ${orderNumber}\nLütfen sipariş numaranızı belirterek belirtilen IBAN adreslerine banka havalesi gerçekleştiriniz.`
        : `Your order has been received successfully! Order No: ${orderNumber}\nPlease transfer the amount to the provided IBANs mentioning your order number.`;

      showToast(successNotice);
      localStorage.removeItem("merter_b2b_cart");
      window.dispatchEvent(new Event("merter-cart-update"));
      onClose();
      window.location.href = `/${lang}/profile?tab=orders`;
    } catch (err: unknown) {
      console.error(err);
      const fallbackMsg = lang === "tr" ? "Bir ağ hatası oluştu." : "A network error occurred.";
      const errMsg = err instanceof Error ? err.message : fallbackMsg;
      showToast(errMsg);
    } finally {
      setSubmittingOrder(false);
    }
  };

  const handleOpenInquiryFromLoggedIn = () => {
    if (typeof window !== "undefined") {
      try {
        const stored = JSON.parse(localStorage.getItem("store_user_info") || "{}");
        const fullNameVal = [stored.first_name, stored.last_name].filter(Boolean).join(" ");
        if (fullNameVal) setFullName(fullName || fullNameVal);
        if (stored.email) setEmailAddress(emailAddress || stored.email);
        if (stored.phone) setPhoneNumber(phoneNumber || stored.phone);
      } catch {
        // ignore parse error
      }
    }
    setIsCheckout(false);
    setForceShowInquiry(true);
  };

  const grandTotalInTRY = cart.reduce((sum, item) => {
    const itemTotalUnits = item.packages_qty * item.units_per_package;
    const itemPriceInOrig = itemTotalUnits * item.price_per_unit;
    const itemPriceInTRY = convertPrice(itemPriceInOrig, item.currency || "TRY", "TRY", [...exchangeRates]);
    return sum + itemPriceInTRY;
  }, 0);

  const finalTotalPrice = convertPrice(grandTotalInTRY, "TRY", displayCurrency, [...exchangeRates]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-end">
      <button
        type="button"
        aria-label="Kapat"
        tabIndex={-1}
        className="fixed inset-0 bg-transparent border-none cursor-default"
        onClick={onClose}
      />

      <div className="bg-white border-l border-cultured w-full max-w-md h-full flex flex-col shadow-premium relative z-10 animate-in slide-in-from-right duration-300 ease-out select-none">
        <div className="p-4 border-b border-cultured flex items-center justify-between shrink-0">
          <h3 className="font-sans font-extrabold text-lg tracking-[0.5px] text-eerie-black flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-salmon-pink" />
            {t("cart_title", lang)}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-[5px] bg-[#fafafa] hover:bg-cultured border border-cultured flex items-center justify-center text-onyx cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-grow overflow-y-auto p-4 flex flex-col gap-4">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center text-sonic-silver">
              <span className="text-5xl mb-4">🛍️</span>
              <p className="text-sm font-bold text-eerie-black">{t("empty_cart", lang)}</p>
              <p className="text-xs font-semibold mt-1 max-w-[280px] text-sonic-silver">
                {t("empty_cart_tip", lang)}
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3">
                {cart.map((item, idx) => (
                  <CartItemCard
                    key={`${item.product_id}-${item.custom_sku || idx}`}
                    item={item}
                    idx={idx}
                    lang={lang}
                    displayCurrency={displayCurrency}
                    exchangeRates={exchangeRates}
                    onAdjustQty={onAdjustQty}
                    onRemove={onRemove}
                  />
                ))}
              </div>

              <div className="flex justify-between items-center py-2 px-1 border-b border-cultured shrink-0 mt-1 select-none">
                <span className="text-xs font-bold text-sonic-silver">
                  {cart.length} {lang === "tr" ? "Çeşit Ürün" : "Items"}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    window.location.href = `/${getCategoryPrefix(lang)}/cart`;
                  }}
                  className="px-4 py-2 bg-salmon-pink text-white hover:bg-eerie-black rounded-[5px] font-extrabold text-[11px] uppercase transition-all duration-200 cursor-pointer active:scale-[0.98] flex items-center gap-1.5 shadow-sm border-none"
                >
                  <span>🛒</span>
                  <span>{t("go_to_cart", lang)}</span>
                </button>
              </div>

              <div className="flex flex-col gap-2.5">
                <CartTotalsSection
                  lang={lang}
                  totalPkgs={totalPkgs}
                  totalItemsCount={totalItemsCount}
                  totalWeight={totalWeight}
                  finalTotalPrice={finalTotalPrice}
                  displayCurrency={displayCurrency}
                  grandTotalInTRY={grandTotalInTRY}
                  exchangeRates={exchangeRates}
                />

                {token && !isCheckout && (
                  <div className="flex flex-col gap-3 pt-4 border-t border-cultured mt-2">
                    <button
                      type="button"
                      onClick={() => setIsCheckout(true)}
                      className="w-full py-3.5 bg-salmon-pink hover:bg-eerie-black text-white rounded-[5px] font-extrabold text-sm tracking-[0.5px] uppercase shadow-sm border-none flex items-center justify-center gap-2 cursor-pointer select-none active:scale-[0.99] transition-colors duration-300"
                    >
                      💳 {lang === "tr" ? "Banka Havalesi ile Sipariş Ver" : "Order via Bank Transfer"}
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenInquiryFromLoggedIn}
                      className="w-full py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-[5px] font-bold text-xs uppercase border-none flex items-center justify-center gap-2 cursor-pointer select-none transition-colors"
                    >
                      📄 {lang === "tr" ? "Sadece Fiyat Teklifi İste (Proforma)" : "Request Price Quote Only"}
                    </button>
                  </div>
                )}

                {token && isCheckout && (
                  <CartCheckoutForm
                    lang={lang}
                    addresses={addresses}
                    deliveryAddr={deliveryAddr}
                    setDeliveryAddr={setDeliveryAddr}
                    customDeliveryAddr={customDeliveryAddr}
                    setCustomDeliveryAddr={setCustomDeliveryAddr}
                    billingAddr={billingAddr}
                    setBillingAddr={setBillingAddr}
                    customBillingAddr={customBillingAddr}
                    setCustomBillingAddr={setCustomBillingAddr}
                    submittingOrder={submittingOrder}
                    onBackToCart={() => {
                      setIsCheckout(false);
                      setForceShowInquiry(false);
                    }}
                    onSubmit={handleCheckoutSubmit}
                  />
                )}

                {(!token || forceShowInquiry) && (
                  <CartInquiryForm
                    lang={lang}
                    token={token}
                    fullName={fullName}
                    setFullName={setFullName}
                    companyName={companyName}
                    setCompanyName={setCompanyName}
                    phoneNumber={phoneNumber}
                    setPhoneNumber={setPhoneNumber}
                    emailAddress={emailAddress}
                    setEmailAddress={setEmailAddress}
                    customerMessage={customerMessage}
                    setCustomerMessage={setCustomerMessage}
                    submittingInquiry={submittingInquiry}
                    onGoToCheckout={() => {
                      setForceShowInquiry(false);
                      setIsCheckout(false);
                    }}
                    onSubmit={handleInquirySubmit}
                  />
                )}

                {!token && (
                  <div className="mt-4 p-3 bg-zinc-50 border border-zinc-200/60 rounded-lg text-center text-xs font-semibold text-zinc-600 select-none">
                    {lang === "tr" ? "Kayıtlı bayimiz misiniz?" : "Are you our registered dealer?"}{" "}
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        window.dispatchEvent(new CustomEvent("merter-open-auth", { detail: { mode: "login" } }));
                      }}
                      className="text-salmon-pink font-extrabold hover:underline bg-transparent border-none cursor-pointer"
                    >
                      {lang === "tr" ? "Giriş Yapın" : "Sign In"}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
