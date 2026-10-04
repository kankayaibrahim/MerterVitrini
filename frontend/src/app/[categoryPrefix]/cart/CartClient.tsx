"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShoppingBag, ArrowLeft, Trash2, Home } from "lucide-react";
import { CartItem, Category } from "@/types/store";
import { t, getCategoryPrefix } from "@/app/i18n";
import { convertPrice, showToast, apiFetch, ExchangeRate } from "@/app/utils";
import Header from "@/components/store/Header";
import Footer from "@/components/store/Footer";
import SuccessModal from "@/components/store/SuccessModal";
import PolicyViewerModal from "@/components/store/PolicyViewerModal";
import ConfirmModal from "@/components/store/ConfirmModal";
import { UserAddress } from "@/app/profile/components/types";
import CartDesktopTable from "./components/CartDesktopTable";
import CartMobileList from "./components/CartMobileList";
import CartSummaryBreakdown from "./components/CartSummaryBreakdown";
import CartCheckoutSection from "./components/CartCheckoutSection";
import CartInquirySection from "./components/CartInquirySection";

interface CartClientProps {
  readonly categoryPrefix: string;
  readonly categories: readonly Category[];
}

function getCartSummarySubtitle(
  cartLength: number,
  totalPkgs: number,
  totalItemsCount: number,
  totalWeight: number,
  lang: string
): string {
  if (cartLength === 0) return t("empty_cart", lang);
  const pkgUnit = lang === "tr" ? "Paket" : "Packages";
  const itemUnit = lang === "tr" ? "Adet Ürün" : "Items";
  return `${totalPkgs} ${pkgUnit} | ${totalItemsCount} ${itemUnit} | ~${totalWeight.toFixed(1)} kg`;
}

function formatAddressText(addr?: UserAddress): string {
  if (!addr) return "";
  const cityPart = addr.city_name ? `${addr.city_name}, ` : "";
  return `${addr.first_name} ${addr.last_name} - ${addr.company_name || ""}\n${addr.address_line}\n${cityPart}${addr.state_name || ""}/${addr.country_name || ""}\nTel: ${addr.phone}`;
}

function resolveAddressText(
  selectedId: string,
  customText: string,
  addrList: readonly UserAddress[]
): string {
  if (selectedId === "custom" || addrList.length === 0) {
    return customText.trim();
  }
  const addr = addrList.find((a) => a.id === selectedId);
  return formatAddressText(addr);
}

function parseDefaultAddresses(data: readonly UserAddress[]) {
  const defaultBill = data.find((a) => a.address_type === "billing" && a.is_default);
  const firstBill = data.find((a) => a.address_type === "billing");
  const billing = defaultBill?.id || firstBill?.id || data[0]?.id || "";

  const defaultDel = data.find((a) => a.address_type === "shipping" && a.is_default);
  const firstDel = data.find((a) => a.address_type === "shipping");
  const delivery = defaultDel?.id || firstDel?.id || data[0]?.id || "";

  return { billing, delivery };
}

async function triggerExcelExport(
  cart: readonly CartItem[],
  lang: string,
  displayCurrency: string,
  token: string | null
) {
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch("/api/v1/store/cart/export-excel", {
    method: "POST",
    headers,
    body: JSON.stringify({
      lang,
      display_currency: displayCurrency || "TRY",
      items: cart,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to export cart to excel");
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `sepet-${new Date().toISOString().split("T")[0]}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

async function syncAndCreateOrder(
  token: string,
  cart: readonly CartItem[],
  billing: string,
  delivery: string,
  lang: string
) {
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
    throw new Error(syncData.error || (lang === "tr" ? "Sepet senkronizasyonu başarısız." : "Failed to sync cart."));
  }

  const res = await fetch("/api/v1/store/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      billing_address: billing,
      delivery_address: delivery,
      payment_method: "BANK_TRANSFER",
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || (lang === "tr" ? "Sipariş verilirken bir hata oluştu." : "Failed to place order."));
  }

  return data;
}

function EmptyCartView({ lang, onExplore }: { readonly lang: string; readonly onExplore: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center max-w-md mx-auto">
      <div className="w-20 h-20 rounded-full bg-cultured flex items-center justify-center text-4xl mb-6">
        🛍️
      </div>
      <h2 className="text-lg font-extrabold text-eerie-black">{t("empty_cart", lang)}</h2>
      <p className="text-sm font-semibold text-sonic-silver mt-2">
        {t("empty_cart_tip", lang)}
      </p>
      <button
        onClick={onExplore}
        className="mt-8 px-6 py-3 bg-salmon-pink hover:bg-eerie-black text-white rounded-[5px] font-extrabold text-xs uppercase transition-all duration-300 shadow-md border-none cursor-pointer flex items-center gap-2"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>{lang === "tr" ? "Kataloğu İncele" : "Explore Catalog"}</span>
      </button>
    </div>
  );
}

export default function CartClient({ categoryPrefix, categories }: Readonly<CartClientProps>) {
  const router = useRouter();

  // --- Core States ---
  const [lang, setLang] = useState<string>(categoryPrefix || "tr");
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem("merter_b2b_cart");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      document.documentElement.setAttribute("lang", lang);
    }
  }, [lang]);

  const [isLangOpen, setIsLangOpen] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState("");
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [policyModalType, setPolicyModalType] = useState<"cancellation_and_return" | "terms_of_service" | "privacy_policy" | "">("");
  const [pendingRemove, setPendingRemove] = useState<{ index: number; change: number } | null>(null);
  const [pendingClearCart, setPendingClearCart] = useState<boolean>(false);

  // --- Multi-Currency States ---
  const [displayCurrency, setDisplayCurrency] = useState<string>(() => {
    if (typeof window === "undefined") return "TRY";
    return localStorage.getItem("merter_preferred_currency") || "TRY";
  });
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);

  // --- Checkout / Inquiry Form States ---
  const [isCheckout, setIsCheckout] = useState(false);
  const [forceShowInquiry, setForceShowInquiry] = useState(false);
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [billingAddr, setBillingAddr] = useState("");
  const [deliveryAddr, setDeliveryAddr] = useState("");
  const [customBillingAddr, setCustomBillingAddr] = useState("");
  const [customDeliveryAddr, setCustomDeliveryAddr] = useState("");
  const [submittingOrder, setSubmittingOrder] = useState(false);

  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [emailAddress, setEmailAddress] = useState("");
  const [customerMessage, setCustomerMessage] = useState("");
  const [submittingInquiry, setSubmittingInquiry] = useState(false);

  const [whatsappUrl, setWhatsappUrl] = useState("");
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);

  const token = typeof window !== "undefined" ? localStorage.getItem("store_user_token") : null;

  // --- Load Exchange Rates ---
  useEffect(() => {
    const loadRates = async () => {
      const data = await apiFetch<ExchangeRate[]>("/exchange-rates");
      if (data) setExchangeRates(data);
    };
    void loadRates();
  }, []);

  // --- Fetch Addresses on Checkout ---
  useEffect(() => {
    if (token && isCheckout) {
      fetch("/api/v1/store/profile/addresses", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setAddresses(data);
            const defaults = parseDefaultAddresses(data);
            setBillingAddr(defaults.billing);
            setDeliveryAddr(defaults.delivery);
          }
        })
        .catch((err) => console.error("Error fetching addresses:", err));
    }
  }, [token, isCheckout]);

  const handleCurrencyChange = (curr: string) => {
    setDisplayCurrency(curr);
    localStorage.setItem("merter_preferred_currency", curr);
  };

  const saveCart = (newCart: CartItem[]) => {
    setCart(newCart);
    localStorage.setItem("merter_b2b_cart", JSON.stringify(newCart));
    window.dispatchEvent(new Event("merter-cart-update"));
  };

  const handleAdjustQty = (index: number, change: number) => {
    const updatedCart = [...cart];
    const item = updatedCart[index];
    if (item) {
      if (change < 0 && item.packages_qty + change <= 0) {
        setPendingRemove({ index, change });
        return;
      }
      item.packages_qty += change;
      if (item.packages_qty <= 0) {
        updatedCart.splice(index, 1);
      }
    }
    saveCart(updatedCart);
  };

  const confirmRemove = () => {
    if (pendingRemove !== null) {
      const { index, change } = pendingRemove;
      const updatedCart = [...cart];
      const item = updatedCart[index];
      if (item) {
        item.packages_qty += change;
        if (item.packages_qty <= 0) {
          updatedCart.splice(index, 1);
        }
      }
      saveCart(updatedCart);
      setPendingRemove(null);
    }
  };

  const handleRemoveItem = (index: number) => {
    const updatedCart = [...cart];
    updatedCart.splice(index, 1);
    saveCart(updatedCart);
  };

  const handleClearCart = () => {
    setPendingClearCart(true);
  };

  const confirmClearCart = () => {
    saveCart([]);
    setPendingClearCart(false);
  };

  const exportToExcel = async () => {
    if (cart.length === 0) return;
    try {
      await triggerExcelExport(cart, lang, displayCurrency, token);
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      alert(lang === "tr" ? "Excel dışa aktarımı başarısız oldu." : "Excel export failed.");
    }
  };

  // --- Calculations ---
  const totalPkgs = cart.reduce((sum, item) => sum + item.packages_qty, 0);
  const totalItemsCount = cart.reduce((sum, item) => sum + item.packages_qty * item.units_per_package, 0);
  const totalWeight = cart.reduce((sum, item) => sum + item.packages_qty * item.units_per_package * item.weight_per_unit, 0);

  const grandTotalInTRY = cart.reduce((sum, item) => {
    const itemTotalUnits = item.packages_qty * item.units_per_package;
    const itemPriceInOrig = itemTotalUnits * item.price_per_unit;
    const itemPriceInTRY = convertPrice(itemPriceInOrig, item.currency || "TRY", "TRY", exchangeRates);
    return sum + itemPriceInTRY;
  }, 0);

  const finalTotalPrice = convertPrice(grandTotalInTRY, "TRY", displayCurrency, exchangeRates);
  const eqUSD = convertPrice(grandTotalInTRY, "TRY", "USD", exchangeRates);
  const eqEUR = convertPrice(grandTotalInTRY, "TRY", "EUR", exchangeRates);
  const eqGBP = convertPrice(grandTotalInTRY, "TRY", "GBP", exchangeRates);
  const eqTRY = grandTotalInTRY;

  // --- B2B Checkout Order Submission ---
  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    const finalBilling = resolveAddressText(billingAddr, customBillingAddr, addresses);
    const finalDelivery = resolveAddressText(deliveryAddr, customDeliveryAddr, addresses);

    if (!finalBilling || !finalDelivery) {
      showToast(lang === "tr" ? "Lütfen fatura ve teslimat adreslerini doldurunuz." : "Please select or enter billing and delivery addresses.");
      return;
    }

    setSubmittingOrder(true);
    try {
      const data = await syncAndCreateOrder(token, cart, finalBilling, finalDelivery, lang);
      showToast(
        lang === "tr"
          ? `Siparişiniz başarıyla alındı! Sipariş No: ${data.order_number}\nLütfen sipariş numaranızı belirterek banka havalesi gerçekleştiriniz.`
          : `Your order has been received successfully! Order No: ${data.order_number}\nPlease transfer the amount referencing your order number.`
      );
      saveCart([]);
      setIsCheckout(false);
      router.push(`/${lang}/profile?tab=orders`);
    } catch (err: unknown) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : String(err);
      showToast(errMsg || (lang === "tr" ? "Bir ağ hatası oluştu." : "A network error occurred."));
    } finally {
      setSubmittingOrder(false);
    }
  };

  const handleRequestQuoteOnly = () => {
    if (typeof window !== "undefined") {
      try {
        const userInfo = JSON.parse(localStorage.getItem("store_user_info") || "{}");
        const userFullName = `${userInfo.first_name || ""} ${userInfo.last_name || ""}`.trim();
        setFullName(fullName || userFullName);
        setEmailAddress(emailAddress || userInfo.email || "");
        setPhoneNumber(phoneNumber || userInfo.phone || "");
      } catch {
        // ignore parse error
      }
    }
    setIsCheckout(false);
    setForceShowInquiry(true);
  };

  // --- Guest Inquiry Submission ---
  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    setSubmittingInquiry(true);

    const inquiryItems = cart.map((item) => {
      const totalUnits = item.packages_qty * item.units_per_package;
      return {
        product_id: item.product_id,
        title: `${item.title} (${item.color}) - ${item.packages_qty} ${t("package", lang)} (${totalUnits} ${t("piece", lang)})`,
        custom_sku: item.custom_sku || item.product_id,
        quantity: totalUnits,
        price: item.price_per_unit,
      };
    });

    const payload = {
      full_name: fullName,
      company: companyName || null,
      phone: phoneNumber,
      email: emailAddress,
      message: customerMessage || null,
      items: inquiryItems,
    };

    try {
      const response = await fetch("/api/v1/store/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        showToast(`Error: ${errData.error || "Failed to submit inquiry"}`);
        return;
      }

      const result = await response.json();
      saveCart([]);
      setFullName("");
      setCompanyName("");
      setPhoneNumber("");
      setEmailAddress("");
      setCustomerMessage("");
      setWhatsappUrl(result.whatsapp_url || "#");
      setShowSuccessOverlay(true);
    } catch (err) {
      console.error("Failed to submit B2B inquiry", err);
      showToast("Connection error! Failed to register your quote request.");
    } finally {
      setSubmittingInquiry(false);
    }
  };

  const summarySubtitle = getCartSummarySubtitle(cart.length, totalPkgs, totalItemsCount, totalWeight, lang);

  return (
    <div className="min-h-screen w-full flex flex-col bg-bg-dark text-text-primary overflow-x-hidden font-sans antialiased">
      {/* 1. Header Navigation */}
      <Header
        lang={lang}
        setLang={setLang}
        isLangOpen={isLangOpen}
        setIsLangOpen={setIsLangOpen}
        totalPkgs={totalPkgs}
        setIsCartOpen={() => {}}
        setSearchQuery={() => {}}
        setCurrentPage={() => {}}
        setActiveCategoryId={setActiveCategoryId}
        categories={categories}
        activeCategoryId={activeCategoryId}
        displayCurrency={displayCurrency}
        onCurrencyChange={handleCurrencyChange}
      />

      {/* 2. Main Page Content Container */}
      <main className="flex-grow max-w-[1720px] mx-auto w-full px-4 py-8 select-none">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs font-bold text-sonic-silver mb-6">
          <button 
            onClick={() => router.push("/")}
            className="flex items-center gap-1 hover:text-salmon-pink bg-transparent border-none cursor-pointer transition-colors"
          >
            <Home className="w-3.5 h-3.5" />
            <span>{t("home", lang)}</span>
          </button>
          <span>/</span>
          <span className="text-eerie-black font-extrabold">{t("cart_title", lang)}</span>
        </div>

        {/* Dynamic Title Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-cultured pb-6 mb-8 gap-4">
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-7 h-7 text-salmon-pink" />
            <div>
              <h1 className="text-2xl font-serif font-extrabold text-eerie-black tracking-wide">
                {t("cart_title", lang)}
              </h1>
              <p className="text-xs font-semibold text-sonic-silver mt-1">
                {summarySubtitle}
              </p>
            </div>
          </div>
          {cart.length > 0 && (
            <div className="flex items-center gap-4.5 self-start md:self-auto select-none">
              <button
                onClick={exportToExcel}
                className="text-xs font-extrabold text-accent-gold hover:text-eerie-black bg-transparent border-none cursor-pointer flex items-center gap-1.5 transition-colors"
              >
                <span>📥</span>
                <span>{lang === "tr" ? "Excel Olarak İndir" : "Export to Excel"}</span>
              </button>
              <span className="text-cultured">|</span>
              <button
                onClick={handleClearCart}
                className="text-xs font-extrabold text-red-500 hover:text-red-700 bg-transparent border-none cursor-pointer flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>{lang === "tr" ? "Sepeti Boşalt" : "Empty Cart"}</span>
              </button>
            </div>
          )}
        </div>

        {cart.length === 0 ? (
          <EmptyCartView lang={lang} onExplore={() => router.push(`/${getCategoryPrefix(lang)}/tum-urunler`)} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* Left Column: Product Table Grid */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              <CartDesktopTable
                cart={cart}
                lang={lang}
                displayCurrency={displayCurrency}
                exchangeRates={exchangeRates}
                onAdjustQty={handleAdjustQty}
                onRemoveItem={handleRemoveItem}
              />
              <CartMobileList
                cart={cart}
                lang={lang}
                displayCurrency={displayCurrency}
                exchangeRates={exchangeRates}
                onAdjustQty={handleAdjustQty}
                onRemoveItem={handleRemoveItem}
              />
            </div>

            {/* Right Column: Checkout & Summary Sidebar */}
            <div className="flex flex-col gap-6">
              <CartSummaryBreakdown
                totalPkgs={totalPkgs}
                totalItemsCount={totalItemsCount}
                totalWeight={totalWeight}
                finalTotalPrice={finalTotalPrice}
                displayCurrency={displayCurrency}
                lang={lang}
                eqTRY={eqTRY}
                eqUSD={eqUSD}
                eqEUR={eqEUR}
                eqGBP={eqGBP}
                exchangeRates={exchangeRates}
              />

              <div className="bg-white border border-cultured rounded-[12px] p-5 shadow-premium flex flex-col gap-4">
                {token && (
                  <CartCheckoutSection
                    isCheckout={isCheckout}
                    setIsCheckout={setIsCheckout}
                    onRequestQuoteOnly={handleRequestQuoteOnly}
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
                    onSubmitCheckout={handleCheckoutSubmit}
                    onCancelCheckout={() => {
                      setIsCheckout(false);
                      setForceShowInquiry(false);
                    }}
                    lang={lang}
                  />
                )}

                <CartInquirySection
                  token={token}
                  forceShowInquiry={forceShowInquiry}
                  onBackToCheckout={() => {
                    setForceShowInquiry(false);
                    setIsCheckout(false);
                  }}
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
                  onSubmitInquiry={handleInquirySubmit}
                  lang={lang}
                />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 3. Footer Section */}
      <Footer 
        lang={lang} 
        onOpenPolicy={(type) => {
          setPolicyModalType(type);
          setIsPolicyModalOpen(true);
        }}
      />

      {/* 4. Inquiry Success Feedback Overlay Modal */}
      {showSuccessOverlay && (
        <SuccessModal
          onClose={() => setShowSuccessOverlay(false)}
          lang={lang}
          whatsappUrl={whatsappUrl}
        />
      )}

      {/* 5. Legal Policy Dynamic Viewer Modal */}
      <PolicyViewerModal
        isOpen={isPolicyModalOpen}
        onClose={() => {
          setIsPolicyModalOpen(false);
          setPolicyModalType("");
        }}
        policyType={policyModalType}
        lang={lang}
      />

      {pendingRemove !== null && (
        <ConfirmModal
          lang={lang}
          message={t("remove_from_cart_confirm", lang) || "Sepetten komple kaldırılacaktır onaylıyor musunuz?"}
          onConfirm={confirmRemove}
          onCancel={() => setPendingRemove(null)}
        />
      )}

      {pendingClearCart && (
        <ConfirmModal
          lang={lang}
          message={lang === "tr" ? "Sepetinizi tamamen boşaltmak istediğinize emin misiniz?" : "Are you sure you want to empty your cart?"}
          onConfirm={confirmClearCart}
          onCancel={() => setPendingClearCart(false)}
          confirmText={lang === "tr" ? "Sepeti Boşalt" : "Empty Cart"}
          cancelText={lang === "tr" ? "Vazgeç" : "Cancel"}
        />
      )}
    </div>
  );
}
