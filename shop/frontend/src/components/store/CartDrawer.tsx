"use client";

import React from "react";
import { X, ShoppingBag } from "lucide-react";
import { CartItem } from "@/types/store";
import { t } from "@/app/i18n";
import { convertPrice, getResizedImageUrl } from "@/app/utils";

interface CartDrawerProps {
  lang: string;
  cart: CartItem[];
  onClose: () => void;
  onAdjustQty: (index: number, change: number) => void;
  onRemove: (index: number) => void;
  totalPkgs: number;
  totalItemsCount: number;
  totalWeight: number;
  totalPrice: number;
  fullName: string;
  setFullName: (name: string) => void;
  companyName: string;
  setCompanyName: (company: string) => void;
  phoneNumber: string;
  setPhoneNumber: (phone: string) => void;
  emailAddress: string;
  setEmailAddress: (email: string) => void;
  customerMessage: string;
  setCustomerMessage: (msg: string) => void;
  submittingInquiry: boolean;
  onSubmit: (e: React.FormEvent) => void;
  displayCurrency?: string;
  exchangeRates?: any[];
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
  totalPrice,
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
  onSubmit,
  displayCurrency = "TRY",
  exchangeRates = [],
}: CartDrawerProps) {
  const [isCheckout, setIsCheckout] = React.useState(false);
  const [forceShowInquiry, setForceShowInquiry] = React.useState(false);
  const [addresses, setAddresses] = React.useState<any[]>([]);
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
          "Authorization": `Bearer ${token}`
        }
      })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setAddresses(data);
          const defaultBill = data.find((a: any) => a.address_type === "billing" && a.is_default);
          const defaultDel = data.find((a: any) => a.address_type === "shipping" && a.is_default);
          
          if (defaultBill) {
            setBillingAddr(defaultBill.id);
          } else {
            const firstBill = data.find((a: any) => a.address_type === "billing");
            if (firstBill) setBillingAddr(firstBill.id);
            else if (data.length > 0) setBillingAddr(data[0].id);
          }

          if (defaultDel) {
            setDeliveryAddr(defaultDel.id);
          } else {
            const firstDel = data.find((a: any) => a.address_type === "shipping");
            if (firstDel) setDeliveryAddr(firstDel.id);
            else if (data.length > 0) setDeliveryAddr(data[0].id);
          }
        }
      })
      .catch(err => console.error("Error fetching addresses:", err));
    }
  }, [token, isCheckout]);

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    let finalBilling = "";
    if (billingAddr === "custom" || addresses.length === 0) {
      finalBilling = customBillingAddr.trim();
    } else {
      const addr = addresses.find(a => a.id === billingAddr);
      if (addr) {
        finalBilling = `${addr.first_name} ${addr.last_name} - ${addr.company_name || ""}\n${addr.address_line}\n${addr.state_name || ""}/${addr.country_name || ""}\nTel: ${addr.phone}`;
      }
    }

    let finalDelivery = "";
    if (deliveryAddr === "custom" || addresses.length === 0) {
      finalDelivery = customDeliveryAddr.trim();
    } else {
      const addr = addresses.find(a => a.id === deliveryAddr);
      if (addr) {
        finalDelivery = `${addr.first_name} ${addr.last_name} - ${addr.company_name || ""}\n${addr.address_line}\n${addr.state_name || ""}/${addr.country_name || ""}\nTel: ${addr.phone}`;
      }
    }

    if (!finalBilling || !finalDelivery) {
      alert(lang === "tr" ? "Lütfen fatura ve teslimat adreslerini doldurunuz." : "Please select or enter billing and delivery addresses.");
      return;
    }

    setSubmittingOrder(true);
    try {
      // Sync local cart to database before placing order
      const syncRes = await fetch("/api/v1/store/cart/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          items: cart.map(item => ({
            product_id: item.product_id,
            quantity: item.packages_qty * item.units_per_package
          }))
        })
      });

      if (!syncRes.ok) {
        const syncData = await syncRes.json().catch(() => ({}));
        throw new Error(syncData.error || (lang === "tr" ? "Sepet senkronizasyonu başarısız." : "Failed to sync cart."));
      }

      const res = await fetch("/api/v1/store/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          billing_address: finalBilling,
          delivery_address: finalDelivery,
          payment_method: "BANK_TRANSFER"
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        alert(lang === "tr" 
          ? `Siparişiniz başarıyla alındı! Sipariş No: ${data.order_number}\nLütfen sipariş numaranızı belirterek belirtilen IBAN adreslerine banka havalesi gerçekleştiriniz.` 
          : `Your order has been received successfully! Order No: ${data.order_number}\nPlease transfer the amount to the provided IBANs mentioning your order number.`
        );
        
        localStorage.removeItem("merter_b2b_cart");
        window.dispatchEvent(new Event("merter-cart-update"));
        onClose();
        // Redirect to profile orders tab
        window.location.href = `/${lang}/profile?tab=orders`;
      } else {
        alert(data.error || (lang === "tr" ? "Sipariş verilirken bir hata oluştu." : "Failed to place order."));
      }
    } catch (err) {
      console.error(err);
      alert(lang === "tr" ? "Bir ağ hatası oluştu." : "A network error occurred.");
    } finally {
      setSubmittingOrder(false);
    }
  };

  // Calculate grand total in TRY and converted active display currency
  const grandTotalInTRY = cart.reduce((sum, item) => {
    const itemTotalUnits = item.packages_qty * item.units_per_package;
    const itemPriceInOrig = itemTotalUnits * item.price_per_unit;
    const itemPriceInTRY = convertPrice(itemPriceInOrig, item.currency || "TRY", "TRY", exchangeRates);
    return sum + itemPriceInTRY;
  }, 0);

  const finalTotalPrice = convertPrice(grandTotalInTRY, "TRY", displayCurrency, exchangeRates);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-end">
      {/* Drawer overlay click catcher */}
      <div 
        className="fixed inset-0" 
        onClick={onClose}
      />
      
      {/* Sliding slide-over panel content */}
      <div className="bg-white border-l border-cultured w-full max-w-md h-full flex flex-col shadow-premium relative z-10 animate-in slide-in-from-right duration-300 ease-out select-none">
        
        <div className="p-4 border-b border-cultured flex items-center justify-between shrink-0">
          <h3 className="font-sans font-extrabold text-lg tracking-[0.5px] text-eerie-black flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-salmon-pink" />
            {t("cart_title", lang)}
          </h3>
          <button 
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
              {/* Cart List */}
              <div className="flex flex-col gap-3">
                {cart.map((item, idx) => {
                  const itemTotalUnits = item.packages_qty * item.units_per_package;
                  const rawItemPricePerUnit = item.price_per_unit;
                  const rawItemTotalPrice = itemTotalUnits * rawItemPricePerUnit;

                  let pricePerUnit = rawItemPricePerUnit;
                  let itemTotalPrice = rawItemTotalPrice;
                  let currency = displayCurrency || "TRY";

                  if (displayCurrency && exchangeRates && exchangeRates.length > 0) {
                    pricePerUnit = convertPrice(rawItemPricePerUnit, item.currency || "TRY", displayCurrency, exchangeRates);
                    itemTotalPrice = convertPrice(rawItemTotalPrice, item.currency || "TRY", displayCurrency, exchangeRates);
                  } else {
                    currency = item.currency || "TRY";
                  }

                  return (
                    <div key={idx} className="border border-cultured bg-[#fafafa] rounded-[5px] p-3 flex gap-3 relative shadow-inner">
                      
                      <img 
                        src={getResizedImageUrl(item.image_url, 80, 106)} 
                        alt={item.title} 
                        className="w-14 h-18 object-cover rounded-[5px] bg-white border border-cultured"
                      />
                      
                      <div className="flex-grow flex flex-col gap-1 pr-6">
                        <h4 className="text-sm font-bold text-eerie-black line-clamp-2 leading-relaxed">
                          {(item.title_translations && item.title_translations[lang]) || item.title}
                        </h4>
                        
                        <span className="text-xs font-bold text-salmon-pink block">
                          {t("color", lang)}: {item.color} | SKU: {item.custom_sku}
                        </span>
                        
                        <div className="flex items-center gap-2 mt-1.5">
                          <button 
                            onClick={() => onAdjustQty(idx, -1)}
                            className="w-6 h-6 rounded-[5px] border border-cultured bg-white flex items-center justify-center font-bold text-xs cursor-pointer select-none active:scale-90"
                          >
                            −
                          </button>
                          <span className="text-sm font-bold text-onyx">
                            {item.packages_qty} {lang === "tr" ? "Paket" : "Pack"}
                          </span>
                          <button 
                            onClick={() => onAdjustQty(idx, 1)}
                            className="w-6 h-6 rounded-[5px] border border-cultured bg-white flex items-center justify-center font-bold text-xs cursor-pointer select-none active:scale-90"
                          >
                            +
                          </button>
                        </div>

                        <span className="text-xs font-semibold text-sonic-silver mt-1.5 block">
                          {itemTotalUnits} {lang === "tr" ? "Adet" : t("piece", lang)} ({item.units_per_package} {lang === "tr" ? "Adet/Paket" : "Pcs/Pack"}) x {pricePerUnit.toFixed(2)} {currency}
                        </span>
                      </div>

                      <div className="shrink-0 self-center font-extrabold text-sm text-eerie-black text-right pl-1">
                        {itemTotalPrice.toFixed(2)} {currency}
                      </div>

                      <button 
                        onClick={() => onRemove(idx)}
                        className="absolute top-2 right-2 border-none bg-transparent text-sonic-silver hover:text-salmon-pink cursor-pointer text-sm font-extrabold"
                      >
                        &times;
                      </button>

                    </div>
                  );
                })}
              </div>

              {/* B2B Cart Totals Summary */}
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
                <div className="flex justify-between text-base font-extrabold text-salmon-pink border-t border-cultured pt-2.5 mt-1 select-none">
                  <span>{t("grand_total", lang)}:</span>
                  <span>{finalTotalPrice.toFixed(2)} {displayCurrency}</span>
                </div>

                {/* Simultaneous Multi-Currency Equivalents Panel */}
                {(() => {
                  const eqUSD = convertPrice(grandTotalInTRY, "TRY", "USD", exchangeRates);
                  const eqEUR = convertPrice(grandTotalInTRY, "TRY", "EUR", exchangeRates);
                  const eqGBP = convertPrice(grandTotalInTRY, "TRY", "GBP", exchangeRates);
                  const eqTRY = grandTotalInTRY;

                  const ratesBanner = exchangeRates && exchangeRates.length > 0
                    ? exchangeRates.filter(r => ["USD", "EUR", "GBP"].includes(r.currency_code.toUpperCase()))
                    : [];

                  // Safely parse publication date
                  const rawDate = exchangeRates?.find(r => r.publication_date)?.publication_date;
                  let formattedDate = "";
                  if (rawDate) {
                    try {
                      const d = new Date(rawDate);
                      const getSafeLocale = (l: string): string => {
                        switch (l) {
                          case "tr": return "tr-TR";
                          case "en": return "en-US";
                          case "ru": return "ru-RU";
                          case "ar": return "ar-EG";
                          case "de": return "de-DE";
                          case "pl": return "pl-PL";
                          case "bg": return "bg-BG";
                          case "fr": return "fr-FR";
                          default: return "en-US";
                        }
                      };
                      const locale = getSafeLocale(lang);
                      formattedDate = d.toLocaleDateString(locale, {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                      });
                    } catch {
                      formattedDate = String(rawDate).split("T")[0] || "";
                    }
                  }

                  // Multi-language timezone banner translation
                  let dateInfo = `* Rates based on official TCMB publication of ${formattedDate} (TR/Istanbul time-boundary applied)`;
                  if (lang === "tr") {
                    dateInfo = `* ${formattedDate} tarihli TCMB kur bilgileri baz alınmıştır. (TR/İstanbul saat dilimi esaslıdır)`;
                  } else if (lang === "ru") {
                    dateInfo = `* Курсы основаны на официальной публикации ЦБ Турции (TCMB) от ${formattedDate} (по часовому поясу TR/Стамбул)`;
                  } else if (lang === "ar") {
                    dateInfo = `* الأسعار تعتمد على النشرة الرسمية للبنك المركزي التركي (TCMB) بتاريخ ${formattedDate} (توقيت تركيا/إسطنبول)`;
                  } else if (lang === "de") {
                    dateInfo = `* Die Kurse basieren auf der offiziellen Veröffentlichung der TCMB vom ${formattedDate} (TR/Istanbul-Zeitzone gilt)`;
                  } else if (lang === "pl") {
                    dateInfo = `* Kursy oparte na oficjalnej publikacji Banku Centralnego Turcji (TCMB) z dnia ${formattedDate} (obowiązuje strefa czasowa TR/Stambuł)`;
                  } else if (lang === "bg") {
                    dateInfo = `* Валутните курсове са базирани на официалната публикация на TCMB от ${formattedDate} (приложена е часовата зона TR/Истанбул)`;
                  } else if (lang === "fr") {
                    dateInfo = `* Les taux de change sont basés sur la publication officielle de la TCMB du ${formattedDate} (fuseau horaire TR/Istanbul appliqué)`;
                  }

                  return (
                    <div className="mt-3 pt-3 border-t border-dashed border-cultured flex flex-col gap-2.5 select-none bg-white p-3 rounded-[8px] border border-cultured">
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
                })()}

                {/* Inquiry or Checkout Flow Toggles */}
                {token ? (
                  !isCheckout ? (
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
                        onClick={() => {
                          // Allow logged-in users to still request a quote if they prefer
                          setFullName(fullName || (typeof window !== "undefined" ? JSON.parse(localStorage.getItem("store_user_info") || "{}").first_name + " " + JSON.parse(localStorage.getItem("store_user_info") || "{}").last_name : ""));
                          setEmailAddress(emailAddress || (typeof window !== "undefined" ? JSON.parse(localStorage.getItem("store_user_info") || "{}").email : ""));
                          setPhoneNumber(phoneNumber || (typeof window !== "undefined" ? JSON.parse(localStorage.getItem("store_user_info") || "{}").phone : ""));
                          setIsCheckout(false);
                          // We'll show the inquiry form below by toggling a local state
                          setForceShowInquiry(true);
                        }}
                        className="w-full py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-[5px] font-bold text-xs uppercase border-none flex items-center justify-center gap-2 cursor-pointer select-none transition-colors"
                      >
                        📄 {lang === "tr" ? "Sadece Fiyat Teklifi İste (Proforma)" : "Request Price Quote Only"}
                      </button>
                    </div>
                  ) : (
                    // Checkout Address Selection & Bank Transfer Details Form
                    <form onSubmit={handleCheckoutSubmit} className="flex flex-col gap-4 pt-4 border-t border-cultured mt-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs uppercase font-extrabold text-salmon-pink tracking-[0.5px]">
                          {lang === "tr" ? "Adres ve Ödeme Bilgileri" : "Address & Payment Info"}
                        </h4>
                        <button
                          type="button"
                          onClick={() => {
                            setIsCheckout(false);
                            setForceShowInquiry(false);
                          }}
                          className="text-xs font-bold text-sonic-silver hover:text-salmon-pink bg-transparent border-none cursor-pointer"
                        >
                          &larr; {lang === "tr" ? "Sepete Dön" : "Back to Cart"}
                        </button>
                      </div>

                      {/* Delivery Address Selector */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] uppercase font-extrabold text-eerie-black tracking-[0.5px]">
                          🚚 {lang === "tr" ? "Teslimat Adresi" : "Delivery Address"}
                        </label>
                        {addresses.length > 0 ? (
                          <select
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
                            className="w-full px-3 py-2.5 bg-white border border-cultured rounded-[5px] text-xs font-semibold focus:outline-none focus:border-salmon-pink text-eerie-black resize-none mt-1"
                            placeholder={lang === "tr" ? "Teslimat adresini yazınız..." : "Type delivery address..."}
                          />
                        )}
                      </div>

                      {/* Billing Address Selector */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] uppercase font-extrabold text-eerie-black tracking-[0.5px]">
                          📄 {lang === "tr" ? "Fatura Adresi" : "Billing Address"}
                        </label>
                        {addresses.length > 0 ? (
                          <select
                            value={billingAddr}
                            onChange={(e) => setBillingAddr(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-cultured rounded-[5px] text-xs font-semibold focus:outline-none focus:border-salmon-pink text-eerie-black"
                          >
                            {addresses.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.title} ({a.address_line.substring(0, 30)}...)
                              </option>
                            ))}
                            <option value="custom">{lang === "tr" ? "+ Yeni Fatura Adresi Girişi" : "+ Enter Custom Billing Address"}</option>
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
                            className="w-full px-3 py-2.5 bg-white border border-cultured rounded-[5px] text-xs font-semibold focus:outline-none focus:border-salmon-pink text-eerie-black resize-none mt-1"
                            placeholder={lang === "tr" ? "Fatura adresini yazınız..." : "Type billing address..."}
                          />
                        )}
                      </div>

                      {/* Bank Transfer details card */}
                      <div className="bg-[#eff6ff] border border-blue-100 rounded-lg p-3 flex flex-col gap-2.5 text-xs text-blue-900 shadow-sm leading-normal">
                        <div className="font-extrabold uppercase tracking-[0.5px] border-b border-blue-200/50 pb-1 text-[11px] text-blue-800">
                          🏦 {lang === "tr" ? "Banka Havale/EFT Hesapları" : "Bank Transfer IBAN Accounts"}
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
                          {lang === "tr" 
                            ? "* Lütfen transfere sipariş numaranızı açıklama olarak ekleyiniz. Ödeme sonrası profilinizden bildirim yapmayı unutmayınız." 
                            : "* Please add your order number as payment explanation. Submit notification from profile after transfer."}
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={submittingOrder}
                        className="w-full py-3.5 bg-salmon-pink hover:bg-eerie-black text-white rounded-[5px] font-extrabold text-sm tracking-[0.5px] uppercase shadow-sm border-none flex items-center justify-center gap-2 cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed mt-2 active:scale-[0.99] transition-colors duration-300"
                      >
                        {submittingOrder ? (
                          <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                        ) : (
                          "✔️ " + (lang === "tr" ? "Siparişi Onayla" : "Confirm B2B Order")
                        )}
                      </button>
                    </form>
                  )
                ) : null}

                {/* Guest Inquiry Request Form or Logged-in explicit Quote Form */}
                {(!token || forceShowInquiry) && (
                  <form onSubmit={onSubmit} className="flex flex-col gap-3.5 pt-4 border-t border-cultured mt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase font-extrabold text-eerie-black tracking-[0.5px]">
                        {lang === "tr" ? "Fiyat Teklifi Talep Formu" : "Request Quote Form"}
                      </span>
                      {token && (
                        <button
                          type="button"
                          onClick={() => {
                            setForceShowInquiry(false);
                            setIsCheckout(false);
                          }}
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
                )}

                {/* Login hint for guest orders */}
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
