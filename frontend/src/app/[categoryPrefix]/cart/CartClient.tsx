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
import { SupportedSeoLang, normalizeSeoLang } from "@/utils/seoHelpers";
import CartDesktopTable from "./components/CartDesktopTable";
import CartMobileList from "./components/CartMobileList";
import CartSummaryBreakdown from "./components/CartSummaryBreakdown";
import CartCheckoutSection from "./components/CartCheckoutSection";
import CartInquirySection from "./components/CartInquirySection";

interface CartPageCopy {
  readonly pkgUnit: string;
  readonly itemUnit: string;
  readonly syncFailed: string;
  readonly orderFailed: string;
  readonly exploreCatalog: string;
  readonly excelFailed: string;
  readonly addressRequired: string;
  readonly orderReceivedPrefix: string;
  readonly orderReceivedSuffix: string;
  readonly networkError: string;
  readonly inquiryError: string;
  readonly exportExcel: string;
  readonly emptyCartBtn: string;
  readonly clearCartConfirm: string;
  readonly cancelBtn: string;
}

const CART_PAGE_COPY: Record<SupportedSeoLang, CartPageCopy> = {
  tr: {
    pkgUnit: "Paket",
    itemUnit: "Adet Ürün",
    syncFailed: "Sepet senkronizasyonu başarısız.",
    orderFailed: "Sipariş verilirken bir hata oluştu.",
    exploreCatalog: "Kataloğu İncele",
    excelFailed: "Excel dışa aktarımı başarısız oldu.",
    addressRequired: "Lütfen fatura ve teslimat adreslerini doldurunuz.",
    orderReceivedPrefix: "Siparişiniz başarıyla alındı! Sipariş No:",
    orderReceivedSuffix:
      "Resmi proforma ve banka bilgileri sipariş detay sayfasında görüntülenmektedir.",
    networkError: "Bir ağ hatası oluştu.",
    inquiryError: "Bağlantı hatası! Teklif talebiniz gönderilemedi.",
    exportExcel: "Excel Olarak İndir",
    emptyCartBtn: "Sepeti Boşalt",
    clearCartConfirm: "Sepetinizi tamamen boşaltmak istediğinize emin misiniz?",
    cancelBtn: "Vazgeç",
  },
  en: {
    pkgUnit: "Packs",
    itemUnit: "Units",
    syncFailed: "Failed to sync wholesale cart.",
    orderFailed: "Failed to place wholesale order.",
    exploreCatalog: "Explore Catalog",
    excelFailed: "Excel export failed.",
    addressRequired: "Please select or enter billing and delivery addresses.",
    orderReceivedPrefix: "Your B2B order has been received! Order No:",
    orderReceivedSuffix:
      "Official proforma invoice and bank wire instructions are available in your order details.",
    networkError: "A network error occurred.",
    inquiryError: "Connection error! Failed to register your quote request.",
    exportExcel: "Export to Excel",
    emptyCartBtn: "Empty Cart",
    clearCartConfirm: "Are you sure you want to empty your wholesale cart?",
    cancelBtn: "Cancel",
  },
  ru: {
    pkgUnit: "Упак.",
    itemUnit: "Ед. товара",
    syncFailed: "Не удалось синхронизировать корзину.",
    orderFailed: "Ошибка при оформлении оптового заказа.",
    exploreCatalog: "Перейти в каталог",
    excelFailed: "Не удалось выгрузить Excel.",
    addressRequired: "Пожалуйста, укажите адрес доставки и адрес для счета.",
    orderReceivedPrefix: "Ваш оптовый заказ принят! № заказа:",
    orderReceivedSuffix:
      "Официальный счет-проформа и банковские реквизиты доступны в деталях заказа.",
    networkError: "Произошла сетевая ошибка.",
    inquiryError: "Ошибка соединения! Не удалось отправить запрос цены.",
    exportExcel: "Скачать в Excel",
    emptyCartBtn: "Очистить корзину",
    clearCartConfirm: "Вы уверены, что хотите полностью очистить корзину?",
    cancelBtn: "Отмена",
  },
  ar: {
    pkgUnit: "باكيدج",
    itemUnit: "قطعة",
    syncFailed: "فشلت مزامنة سلة الجملة.",
    orderFailed: "حدث خطأ أثناء إرسال الطلب.",
    exploreCatalog: "تصفح الكتالوج",
    excelFailed: "فشل تصدير ملف Excel.",
    addressRequired: "يرجى تحديد أو إدخال عنوان الشحن وعنوان الفوترة.",
    orderReceivedPrefix: "تم استلام طلب الجملة بنجاح! رقم الطلب:",
    orderReceivedSuffix:
      "تتوفر الفاتورة الأولية الرسمية وتفاصيل التحويل البنكي في صفحة طلباتك.",
    networkError: "حدث خطأ في الشبكة.",
    inquiryError: "خطأ في الاتصال! تعذر إرسال طلب عرض السعر.",
    exportExcel: "تصدير إلى Excel",
    emptyCartBtn: "إفراغ السلة",
    clearCartConfirm: "هل أنت متأكد من رغبتك في إفراغ السلة بالكامل؟",
    cancelBtn: "إلغاء",
  },
  de: {
    pkgUnit: "Pakete",
    itemUnit: "Stück",
    syncFailed: "Warenkorb-Synchronisierung fehlgeschlagen.",
    orderFailed: "Fehler beim Absenden der B2B-Bestellung.",
    exploreCatalog: "Katalog entdecken",
    excelFailed: "Excel-Export fehlgeschlagen.",
    addressRequired: "Bitte wählen oder geben Sie Liefer- und Rechnungsadresse ein.",
    orderReceivedPrefix: "Ihre B2B-Bestellung ist eingegangen! Bestell-Nr.:",
    orderReceivedSuffix:
      "Offizielle Proforma-Rechnung und Bankverbindung finden Sie in Ihren Bestelldetails.",
    networkError: "Ein Netzwerkfehler ist aufgetreten.",
    inquiryError: "Verbindungsfehler! Ihre Angebotsanfrage konnte nicht gesendet werden.",
    exportExcel: "Als Excel exportieren",
    emptyCartBtn: "Warenkorb leeren",
    clearCartConfirm: "Möchten Sie Ihren Warenkorb wirklich vollständig leeren?",
    cancelBtn: "Abbrechen",
  },
  fr: {
    pkgUnit: "Séries",
    itemUnit: "Pièces",
    syncFailed: "Échec de la synchronisation du panier.",
    orderFailed: "Erreur lors de la validation de la commande.",
    exploreCatalog: "Explorer le catalogue",
    excelFailed: "Échec de l’export Excel.",
    addressRequired: "Veuillez renseigner les adresses de livraison et de facturation.",
    orderReceivedPrefix: "Votre commande B2B a bien été reçue ! N° :",
    orderReceivedSuffix:
      "La facture proforma officielle et les coordonnées bancaires figurent dans vos commandes.",
    networkError: "Une erreur réseau est survenue.",
    inquiryError: "Erreur de connexion ! Impossible d’envoyer la demande de devis.",
    exportExcel: "Exporter en Excel",
    emptyCartBtn: "Vider le panier",
    clearCartConfirm: "Voulez-vous vraiment vider entièrement votre panier ?",
    cancelBtn: "Annuler",
  },
  pl: {
    pkgUnit: "Paczek",
    itemUnit: "Sztuk",
    syncFailed: "Synchronizacja koszyka nie powiodła się.",
    orderFailed: "Błąd podczas składania zamówienia hurtowego.",
    exploreCatalog: "Przeglądaj katalog",
    excelFailed: "Eksport do pliku Excel nie powiódł się.",
    addressRequired: "Wybierz lub wpisz adres dostawy oraz adres rozliczeniowy.",
    orderReceivedPrefix: "Zamówienie hurtowe zostało przyjęte! Nr:",
    orderReceivedSuffix:
      "Oficjalna faktura proforma oraz dane do przelewu są dostępne w szczegółach zamówienia.",
    networkError: "Wystąpił błąd sieci.",
    inquiryError: "Błąd połączenia! Nie udało się wysłać zapytania ofertowego.",
    exportExcel: "Pobierz Excel",
    emptyCartBtn: "Opróżnij koszyk",
    clearCartConfirm: "Czy na pewno chcesz całkowicie opróżnić koszyk?",
    cancelBtn: "Anuluj",
  },
  bg: {
    pkgUnit: "Серии",
    itemUnit: "Броя",
    syncFailed: "Неуспешна синхронизация на количката.",
    orderFailed: "Възникна грешка при подаване на поръчката.",
    exploreCatalog: "Разгледай каталога",
    excelFailed: "Неуспешно експортиране в Excel.",
    addressRequired: "Моля, въведете адрес за доставка и адрес за фактуриране.",
    orderReceivedPrefix: "Вашата поръчка на едро е приета! №:",
    orderReceivedSuffix:
      "Официалната проформа фактура и банковите детайли са налични в профила ви.",
    networkError: "Възникна мрежова грешка.",
    inquiryError: "Грешка във връзката! Запитването за оферта не бе изпратено.",
    exportExcel: "Изтегли в Excel",
    emptyCartBtn: "Изпразни количката",
    clearCartConfirm: "Сигурни ли сте, че искате да изпразните количката?",
    cancelBtn: "Отказ",
  },
};

interface CartClientProps {
  readonly categoryPrefix: string;
  readonly categories: readonly Category[];
}

function getCartSummarySubtitle(
  cartLength: number,
  totalPkgs: number,
  totalItemsCount: number,
  totalWeight: number,
  lang: SupportedSeoLang
): string {
  if (cartLength === 0) return t("empty_cart", lang);
  const copy = CART_PAGE_COPY[lang];
  return `${totalPkgs} ${copy.pkgUnit} | ${totalItemsCount} ${copy.itemUnit} | ~${totalWeight.toFixed(1)} kg`;
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
  link.download = `merter-cart-${new Date().toISOString().split("T")[0]}.xlsx`;
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
  lang: SupportedSeoLang,
  displayCurrency = "TRY"
) {
  const copy = CART_PAGE_COPY[lang];
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
    const syncData = (await syncRes.json().catch(() => ({}))) as { error?: string };
    throw new Error(syncData.error || copy.syncFailed);
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
      customer_currency: displayCurrency || "TRY",
    }),
  });

  const data = (await res.json()) as { success?: boolean; error?: string; order_number?: string };
  if (!res.ok || !data.success) {
    throw new Error(data.error || copy.orderFailed);
  }

  return data;
}

function EmptyCartView({
  lang,
  onExplore,
}: {
  readonly lang: SupportedSeoLang;
  readonly onExplore: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center max-w-md mx-auto">
      <div className="w-20 h-20 rounded-full bg-cultured flex items-center justify-center text-4xl mb-6">
        🛍️
      </div>
      <h2 className="text-lg font-extrabold text-eerie-black">{t("empty_cart", lang)}</h2>
      <p className="text-sm font-semibold text-sonic-silver mt-2">{t("empty_cart_tip", lang)}</p>
      <button
        onClick={onExplore}
        className="mt-8 px-6 py-3 bg-salmon-pink hover:bg-eerie-black text-white rounded-[5px] font-extrabold text-xs uppercase transition-all duration-300 shadow-md border-none cursor-pointer flex items-center gap-2"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>{CART_PAGE_COPY[lang].exploreCatalog}</span>
      </button>
    </div>
  );
}

export default function CartClient({
  categoryPrefix,
  categories,
}: Readonly<CartClientProps>) {
  const router = useRouter();

  const [lang, setLang] = useState<string>(normalizeSeoLang(categoryPrefix, "tr"));
  const safeLang = normalizeSeoLang(lang, "tr");
  const copy = CART_PAGE_COPY[safeLang];

  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem("merter_b2b_cart");
      return saved ? (JSON.parse(saved) as CartItem[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      document.documentElement.setAttribute("lang", safeLang);
      document.documentElement.setAttribute("dir", safeLang === "ar" ? "rtl" : "ltr");
    }
  }, [safeLang]);

  const [isLangOpen, setIsLangOpen] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState("");
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [policyModalType, setPolicyModalType] = useState<
    "cancellation_and_return" | "terms_of_service" | "privacy_policy" | ""
  >("");
  const [pendingRemove, setPendingRemove] = useState<{ index: number; change: number } | null>(
    null
  );
  const [pendingClearCart, setPendingClearCart] = useState<boolean>(false);

  const [displayCurrency, setDisplayCurrency] = useState<string>(() => {
    if (typeof window === "undefined") return "TRY";
    return localStorage.getItem("merter_preferred_currency") || "TRY";
  });
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);

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

  const token =
    typeof window !== "undefined" ? localStorage.getItem("store_user_token") : null;

  useEffect(() => {
    const loadRates = async () => {
      const data = await apiFetch<ExchangeRate[]>("/exchange-rates");
      if (data) setExchangeRates(data);
    };
    void loadRates();
  }, []);

  useEffect(() => {
    if (token && isCheckout) {
      fetch("/api/v1/store/profile/addresses", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data: unknown) => {
          if (Array.isArray(data)) {
            const typed = data as UserAddress[];
            setAddresses(typed);
            const defaults = parseDefaultAddresses(typed);
            setBillingAddr(defaults.billing);
            setDeliveryAddr(defaults.delivery);
          }
        })
        .catch((err) => console.error("Error fetching addresses:", err));
    }
  }, [token, isCheckout]);

  const handleLangChange = (newLang: string) => {
    const normalized = normalizeSeoLang(newLang, "tr");
    setLang(normalized);
    router.push(`/${getCategoryPrefix(normalized)}/cart`);
  };

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
      await triggerExcelExport(cart, safeLang, displayCurrency, token);
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      showToast(copy.excelFailed);
    }
  };

  const totalPkgs = cart.reduce((sum, item) => sum + item.packages_qty, 0);
  const totalItemsCount = cart.reduce(
    (sum, item) => sum + item.packages_qty * item.units_per_package,
    0
  );
  const totalWeight = cart.reduce(
    (sum, item) => sum + item.packages_qty * item.units_per_package * item.weight_per_unit,
    0
  );

  const grandTotalInTRY = cart.reduce((sum, item) => {
    const itemTotalUnits = item.packages_qty * item.units_per_package;
    const itemPriceInOrig = itemTotalUnits * item.price_per_unit;
    const itemPriceInTRY = convertPrice(
      itemPriceInOrig,
      item.currency || "TRY",
      "TRY",
      exchangeRates
    );
    return sum + itemPriceInTRY;
  }, 0);

  const finalTotalPrice = convertPrice(grandTotalInTRY, "TRY", displayCurrency, exchangeRates);
  const eqUSD = convertPrice(grandTotalInTRY, "TRY", "USD", exchangeRates);
  const eqEUR = convertPrice(grandTotalInTRY, "TRY", "EUR", exchangeRates);
  const eqGBP = convertPrice(grandTotalInTRY, "TRY", "GBP", exchangeRates);
  const eqTRY = grandTotalInTRY;

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    const finalBilling = resolveAddressText(billingAddr, customBillingAddr, addresses);
    const finalDelivery = resolveAddressText(deliveryAddr, customDeliveryAddr, addresses);

    if (!finalBilling || !finalDelivery) {
      showToast(copy.addressRequired);
      return;
    }

    setSubmittingOrder(true);
    try {
      const data = await syncAndCreateOrder(token, cart, finalBilling, finalDelivery, safeLang, displayCurrency);
      showToast(`${copy.orderReceivedPrefix} ${data.order_number ?? ""}\n${copy.orderReceivedSuffix}`);
      saveCart([]);
      setIsCheckout(false);
      router.push(`/profile?lang=${safeLang}&tab=orders`);
    } catch (err: unknown) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : String(err);
      showToast(errMsg || copy.networkError);
    } finally {
      setSubmittingOrder(false);
    }
  };

  const handleRequestQuoteOnly = () => {
    if (typeof window !== "undefined") {
      try {
        const userInfo = JSON.parse(localStorage.getItem("store_user_info") || "{}") as {
          first_name?: string;
          last_name?: string;
          email?: string;
          phone?: string;
        };
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

  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    setSubmittingInquiry(true);

    const inquiryItems = cart.map((item) => {
      const totalUnits = item.packages_qty * item.units_per_package;
      return {
        product_id: item.product_id,
        title: `${item.title} (${item.color}) - ${item.packages_qty} ${t("package", safeLang)} (${totalUnits} ${t("piece", safeLang)})`,
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
        const errData = (await response.json().catch(() => ({}))) as { error?: string };
        showToast(errData.error || copy.inquiryError);
        return;
      }

      const result = (await response.json()) as { whatsapp_url?: string };
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
      showToast(copy.inquiryError);
    } finally {
      setSubmittingInquiry(false);
    }
  };

  const summarySubtitle = getCartSummarySubtitle(
    cart.length,
    totalPkgs,
    totalItemsCount,
    totalWeight,
    safeLang
  );

  return (
    <div
      dir={safeLang === "ar" ? "rtl" : "ltr"}
      className="min-h-screen w-full flex flex-col bg-bg-dark text-text-primary overflow-x-hidden font-sans antialiased"
    >
      <Header
        lang={safeLang}
        setLang={handleLangChange}
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

      <main className="flex-grow max-w-[1720px] mx-auto w-full px-4 py-8 select-none">
        <div className="flex items-center gap-2 text-xs font-bold text-sonic-silver mb-6">
          <button
            onClick={() => router.push(`/${getCategoryPrefix(safeLang)}`)}
            className="flex items-center gap-1 hover:text-salmon-pink bg-transparent border-none cursor-pointer transition-colors"
          >
            <Home className="w-3.5 h-3.5" />
            <span>{t("home", safeLang)}</span>
          </button>
          <span>/</span>
          <span className="text-eerie-black font-extrabold">{t("cart_title", safeLang)}</span>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-cultured pb-6 mb-8 gap-4">
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-7 h-7 text-salmon-pink" />
            <div>
              <h1 className="text-2xl font-serif font-extrabold text-eerie-black tracking-wide">
                {t("cart_title", safeLang)}
              </h1>
              <p className="text-xs font-semibold text-sonic-silver mt-1">{summarySubtitle}</p>
            </div>
          </div>
          {cart.length > 0 && (
            <div className="flex items-center gap-4.5 self-start md:self-auto select-none">
              <button
                onClick={exportToExcel}
                className="text-xs font-extrabold text-accent-gold hover:text-eerie-black bg-transparent border-none cursor-pointer flex items-center gap-1.5 transition-colors"
              >
                <span>📥</span>
                <span>{copy.exportExcel}</span>
              </button>
              <span className="text-cultured">|</span>
              <button
                onClick={handleClearCart}
                className="text-xs font-extrabold text-red-500 hover:text-red-700 bg-transparent border-none cursor-pointer flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>{copy.emptyCartBtn}</span>
              </button>
            </div>
          )}
        </div>

        {cart.length === 0 ? (
          <EmptyCartView
            lang={safeLang}
            onExplore={() => router.push(`/${getCategoryPrefix(safeLang)}/tum-urunler`)}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-2 flex flex-col gap-6">
              <CartDesktopTable
                cart={cart}
                lang={safeLang}
                displayCurrency={displayCurrency}
                exchangeRates={exchangeRates}
                onAdjustQty={handleAdjustQty}
                onRemoveItem={handleRemoveItem}
              />
              <CartMobileList
                cart={cart}
                lang={safeLang}
                displayCurrency={displayCurrency}
                exchangeRates={exchangeRates}
                onAdjustQty={handleAdjustQty}
                onRemoveItem={handleRemoveItem}
              />
            </div>

            <div className="flex flex-col gap-6">
              <CartSummaryBreakdown
                totalPkgs={totalPkgs}
                totalItemsCount={totalItemsCount}
                totalWeight={totalWeight}
                finalTotalPrice={finalTotalPrice}
                displayCurrency={displayCurrency}
                lang={safeLang}
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
                    lang={safeLang}
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
                  lang={safeLang}
                />
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer
        lang={safeLang}
        onOpenPolicy={(type) => {
          setPolicyModalType(type);
          setIsPolicyModalOpen(true);
        }}
      />

      {showSuccessOverlay && (
        <SuccessModal
          onClose={() => setShowSuccessOverlay(false)}
          lang={safeLang}
          whatsappUrl={whatsappUrl}
        />
      )}

      <PolicyViewerModal
        isOpen={isPolicyModalOpen}
        onClose={() => {
          setIsPolicyModalOpen(false);
          setPolicyModalType("");
        }}
        policyType={policyModalType}
        lang={safeLang}
      />

      {pendingRemove !== null && (
        <ConfirmModal
          lang={safeLang}
          message={t("remove_from_cart_confirm", safeLang)}
          onConfirm={confirmRemove}
          onCancel={() => setPendingRemove(null)}
        />
      )}

      {pendingClearCart && (
        <ConfirmModal
          lang={safeLang}
          message={copy.clearCartConfirm}
          onConfirm={confirmClearCart}
          onCancel={() => setPendingClearCart(false)}
          confirmText={copy.emptyCartBtn}
          cancelText={copy.cancelBtn}
        />
      )}
    </div>
  );
}
