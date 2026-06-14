"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShoppingBag, ArrowLeft, Trash2, Home } from "lucide-react";
import { CartItem, Category } from "@/types/store";
import { t, getCategoryPrefix } from "@/app/i18n";
import { convertPrice, getResizedImageUrl, showToast, apiFetch } from "@/app/utils";
import Header from "@/components/store/Header";
import Footer from "@/components/store/Footer";
import SuccessModal from "@/components/store/SuccessModal";
import PolicyViewerModal from "@/components/store/PolicyViewerModal";

interface CartClientProps {
  categoryPrefix: string;
  categories: Category[];
}

export default function CartClient({ categoryPrefix, categories }: CartClientProps) {
  const router = useRouter();

  // --- Core States ---
  const [lang, setLang] = useState<string>(categoryPrefix || "tr");
  const [cart, setCart] = useState<CartItem[]>([]);

  // Sync lang to document element for correct localization context (preventing Turkish localized forms on English text)
  useEffect(() => {
    if (typeof window !== "undefined") {
      document.documentElement.setAttribute("lang", lang);
    }
  }, [lang]);

  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [activeCategoryId, setActiveCategoryId] = useState("");
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [policyModalType, setPolicyModalType] = useState<"cancellation_and_return" | "terms_of_service" | "privacy_policy" | "">("");

  // --- Multi-Currency States ---
  const [displayCurrency, setDisplayCurrency] = useState<string>("TRY");
  const [exchangeRates, setExchangeRates] = useState<any[]>([]);

  // --- Checkout / Inquiry Form States ---
  const [isCheckout, setIsCheckout] = useState(false);
  const [forceShowInquiry, setForceShowInquiry] = useState(false);
  const [addresses, setAddresses] = useState<any[]>([]);
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

  // --- Initialize Cart and Preferences ---
  useEffect(() => {
    const savedCart = localStorage.getItem("merter_b2b_cart");
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (err) {
        console.error("Failed to parse cart storage", err);
      }
    }

    const savedCurrency = localStorage.getItem("merter_preferred_currency");
    if (savedCurrency) {
      setDisplayCurrency(savedCurrency);
    }

    const loadRates = async () => {
      const data = await apiFetch<any[]>("/exchange-rates");
      if (data) setExchangeRates(data);
    };
    loadRates();
  }, []);

  // --- Fetch Addresses on Checkout ---
  useEffect(() => {
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

  // --- Currency Change Handler ---
  const handleCurrencyChange = (curr: string) => {
    setDisplayCurrency(curr);
    localStorage.setItem("merter_preferred_currency", curr);
  };

  // --- Cart Adjustments ---
  const saveCart = (newCart: CartItem[]) => {
    setCart(newCart);
    localStorage.setItem("merter_b2b_cart", JSON.stringify(newCart));
    window.dispatchEvent(new Event("merter-cart-update"));
  };

  const handleAdjustQty = (index: number, change: number) => {
    const updatedCart = [...cart];
    const item = updatedCart[index];
    if (item) {
      item.packages_qty += change;
      if (item.packages_qty <= 0) {
        updatedCart.splice(index, 1);
      }
    }
    saveCart(updatedCart);
  };

  const handleRemoveItem = (index: number) => {
    const updatedCart = [...cart];
    updatedCart.splice(index, 1);
    saveCart(updatedCart);
  };

  const handleClearCart = () => {
    if (confirm(lang === "tr" ? "Sepetinizi tamamen boşaltmak istediğinize emin misiniz?" : "Are you sure you want to empty your cart?")) {
      saveCart([]);
    }
  };

  const exportToExcel = () => {
    if (cart.length === 0) return;

    const rateCurrencies = ["TRY", "USD", "EUR", "GBP"];
    const maxRows = Math.max(cart.length, rateCurrencies.length);
    const grandTotalExcelRow = maxRows + 2;

    const getRateInTRY = (curr: string): number => {
      if (curr.toUpperCase() === "TRY") return 1.0;
      const rateObj = exchangeRates?.find(r => r.currency_code.toUpperCase() === curr.toUpperCase());
      return rateObj ? Number(rateObj.buying_rate) : 1.0;
    };

    const currentDisplayCurrency = displayCurrency || "TRY";

    let rowsHtml = "";
    for (let idx = 0; idx < maxRows; idx++) {
      const rowNum = idx + 2;
      let itemCols = "";
      
      if (idx < cart.length) {
        const item = cart[idx];
        const itemTotalUnits = item.packages_qty * item.units_per_package;
        const rawItemPricePerUnit = item.price_per_unit;
        const rawItemTotalPrice = itemTotalUnits * rawItemPricePerUnit;

        let pricePerUnit = rawItemPricePerUnit;
        let itemTotalPrice = rawItemTotalPrice;
        let currency = currentDisplayCurrency;

        if (displayCurrency && exchangeRates && exchangeRates.length > 0) {
          pricePerUnit = convertPrice(rawItemPricePerUnit, item.currency || "TRY", displayCurrency, exchangeRates);
          itemTotalPrice = convertPrice(rawItemTotalPrice, item.currency || "TRY", displayCurrency, exchangeRates);
        } else {
          currency = item.currency || "TRY";
        }

        const absoluteImgUrl = item.image_url.startsWith("http")
          ? item.image_url
          : `${window.location.origin}${getResizedImageUrl(item.image_url, 80, 106)}`;

        const titleText = (item.title_translations && item.title_translations[lang]) || item.title;
        const absoluteProductUrl = `${window.location.origin}/${lang}/product/${item.slug || item.product_id}`;

        itemCols = `
          <td style="text-align: center; vertical-align: middle; width: 80px; height: 106px;">
            <img src="${absoluteImgUrl}" width="60" height="80" style="display: block; margin: auto;" />
          </td>
          <td style="vertical-align: middle;">${titleText}</td>
          <td style="vertical-align: middle;">${item.custom_sku}</td>
          <td style="vertical-align: middle;">${item.color}</td>
          <td style="text-align: center; vertical-align: middle; mso-number-format:'#,##0';">${item.packages_qty}</td>
          <td x:fmla="=E${rowNum}*${item.units_per_package}" style="text-align: center; vertical-align: middle; mso-number-format:'#,##0';">${itemTotalUnits}</td>
          <td style="text-align: right; vertical-align: middle; mso-number-format:'#,##0.00';">${pricePerUnit.toFixed(2)}</td>
          <td x:fmla="=F${rowNum}*G${rowNum}" style="text-align: right; vertical-align: middle; mso-number-format:'#,##0.00';">${itemTotalPrice.toFixed(2)}</td>
          <td style="text-align: center; vertical-align: middle;">${currency}</td>
          <td style="text-align: center; vertical-align: middle;">
            <a href="${absoluteProductUrl}" style="color: #0284c7; text-decoration: underline;">${lang === "tr" ? "Ürünü Aç" : "Open Product"}</a>
          </td>
        `;
      } else {
        itemCols = `
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
        `;
      }

      // Spacer
      const spacerCol = `<td class="spacer-cell" style="width: 20px;"></td>`;

      // Exchange Rates side panel
      let rateCols = "";
      if (idx < rateCurrencies.length) {
        const targetCurr = rateCurrencies[idx];
        const crossRate = getRateInTRY(targetCurr) / getRateInTRY(currentDisplayCurrency);
        const convertedVal = finalTotalPrice / crossRate;

        rateCols = `
          <td style="text-align: center; vertical-align: middle; font-weight: bold; background-color: #f8fafc;">${targetCurr}</td>
          <td style="text-align: right; vertical-align: middle; mso-number-format:'#,##0.000000';">${crossRate.toFixed(6)}</td>
          <td x:fmla="=H${grandTotalExcelRow}/M${rowNum}" style="text-align: right; vertical-align: middle; font-weight: bold; background-color: #eff6ff; mso-number-format:'#,##0.00';">${convertedVal.toFixed(2)}</td>
        `;
      } else {
        rateCols = `
          <td></td>
          <td></td>
          <td></td>
        `;
      }

      const rowHeightAttr = idx < cart.length ? 'height="106" style="height: 106px;"' : 'height="24" style="height: 24px;"';
      rowsHtml += `
        <tr ${rowHeightAttr}>
          ${itemCols}
          ${spacerCol}
          ${rateCols}
        </tr>
      `;
    }

    // Grand Total Row cells
    const grandTotalRowHtml = `
      <tr height="30" class="total-row" style="height: 30px;">
        <td colspan="4" style="text-align: right; vertical-align: middle;">${lang === "tr" ? "Genel Toplam / Grand Total:" : "Grand Total / Genel Toplam:"}</td>
        <td x:fmla="=SUM(E2:E${maxRows + 1})" style="text-align: center; vertical-align: middle; mso-number-format:'#,##0';">${totalPkgs}</td>
        <td x:fmla="=SUM(F2:F${maxRows + 1})" style="text-align: center; vertical-align: middle; mso-number-format:'#,##0';">${totalItemsCount}</td>
        <td></td>
        <td x:fmla="=SUM(H2:H${maxRows + 1})" style="text-align: right; vertical-align: middle; mso-number-format:'#,##0.00';">${finalTotalPrice.toFixed(2)}</td>
        <td style="text-align: center; vertical-align: middle;">${currentDisplayCurrency}</td>
        <td></td>
        <td class="spacer-cell"></td>
        <td></td>
        <td></td>
        <td></td>
      </tr>
    `;

    const excelHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; }
          table { border-collapse: collapse; }
          th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; font-size: 11px; }
          th { background-color: #1e293b; color: #ffffff; font-weight: bold; font-size: 11px; text-transform: uppercase; }
          .exchange-header { background-color: #0f766e; color: #ffffff; }
          .total-row td { font-weight: bold; background-color: #f8fafc; border-top: 2px solid #94a3b8; border-bottom: 2px solid #94a3b8; color: #0f172a; }
          .spacer-cell { border: none !important; background-color: transparent !important; }
        </style>
      </head>
      <body>
        <table>
          <colgroup>
            <col width="80" />
            <col width="300" />
            <col width="120" />
            <col width="100" />
            <col width="80" />
            <col width="80" />
            <col width="100" />
            <col width="120" />
            <col width="80" />
            <col width="120" />
            <col width="20" />
            <col width="80" />
            <col width="100" />
            <col width="120" />
          </colgroup>
          <thead>
            <tr style="height: 30px; vertical-align: middle;">
              <th x:autofilter="all" style="text-align: center;">Ürün Resmi / Product Image</th>
              <th x:autofilter="all">Ürün Açıklaması / Product Description</th>
              <th x:autofilter="all">SKU / Kod / SKU / Code</th>
              <th x:autofilter="all">Renk / Color</th>
              <th x:autofilter="all" style="text-align: center;">Paket / Packages</th>
              <th x:autofilter="all" style="text-align: center;">Adet / Pieces</th>
              <th x:autofilter="all" style="text-align: right;">Birim Fiyat / Unit Price</th>
              <th x:autofilter="all" style="text-align: right;">Toplam / Total</th>
              <th x:autofilter="all" style="text-align: center;">Para Birimi / Currency</th>
              <th x:autofilter="all" style="text-align: center;">Ürün Linki / Product Link</th>
              <th class="spacer-cell"></th>
              <th class="exchange-header" style="text-align: center;">Döviz / Currency</th>
              <th class="exchange-header" style="text-align: right;">Döviz Kuru / Exchange Rate</th>
              <th class="exchange-header" style="text-align: right;">Döviz Karşılığı / Converted Total</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
            ${grandTotalRowHtml}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([excelHtml], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sepet-${new Date().toISOString().split("T")[0]}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Calculations ---
  const totalPkgs = cart.reduce((sum, item) => sum + item.packages_qty, 0);
  const totalItemsCount = cart.reduce((sum, item) => sum + (item.packages_qty * item.units_per_package), 0);
  const totalWeight = cart.reduce((sum, item) => sum + (item.packages_qty * item.units_per_package * item.weight_per_unit), 0);

  const grandTotalInTRY = cart.reduce((sum, item) => {
    const itemTotalUnits = item.packages_qty * item.units_per_package;
    const itemPriceInOrig = itemTotalUnits * item.price_per_unit;
    const itemPriceInTRY = convertPrice(itemPriceInOrig, item.currency || "TRY", "TRY", exchangeRates);
    return sum + itemPriceInTRY;
  }, 0);

  const finalTotalPrice = convertPrice(grandTotalInTRY, "TRY", displayCurrency, exchangeRates);

  // --- B2B Checkout Order Submission ---
  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    let finalBilling = "";
    if (billingAddr === "custom" || addresses.length === 0) {
      finalBilling = customBillingAddr.trim();
    } else {
      const addr = addresses.find(a => a.id === billingAddr);
      if (addr) {
        const cityPart = addr.city_name ? `${addr.city_name}, ` : "";
        finalBilling = `${addr.first_name} ${addr.last_name} - ${addr.company_name || ""}\n${addr.address_line}\n${cityPart}${addr.state_name || ""}/${addr.country_name || ""}\nTel: ${addr.phone}`;
      }
    }

    let finalDelivery = "";
    if (deliveryAddr === "custom" || addresses.length === 0) {
      finalDelivery = customDeliveryAddr.trim();
    } else {
      const addr = addresses.find(a => a.id === deliveryAddr);
      if (addr) {
        const cityPart = addr.city_name ? `${addr.city_name}, ` : "";
        finalDelivery = `${addr.first_name} ${addr.last_name} - ${addr.company_name || ""}\n${addr.address_line}\n${cityPart}${addr.state_name || ""}/${addr.country_name || ""}\nTel: ${addr.phone}`;
      }
    }

    if (!finalBilling || !finalDelivery) {
      showToast(lang === "tr" ? "Lütfen fatura ve teslimat adreslerini doldurunuz." : "Please select or enter billing and delivery addresses.");
      return;
    }

    setSubmittingOrder(true);
    try {
      // Sync local cart to database first
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
        showToast(lang === "tr" 
          ? `Siparişiniz başarıyla alındı! Sipariş No: ${data.order_number}\nLütfen sipariş numaranızı belirterek banka havalesi gerçekleştiriniz.` 
          : `Your order has been received successfully! Order No: ${data.order_number}\nPlease transfer the amount referencing your order number.`
        );
        
        saveCart([]);
        setIsCheckout(false);
        // Redirect to profile orders page after completion
        router.push(`/${lang}/profile?tab=orders`);
      } else {
        showToast(data.error || (lang === "tr" ? "Sipariş verilirken bir hata oluştu." : "Failed to place order."));
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || (lang === "tr" ? "Bir ağ hatası oluştu." : "A network error occurred."));
    } finally {
      setSubmittingOrder(false);
    }
  };

  // --- Guest Inquiry Submission ---
  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    setSubmittingInquiry(true);

    const inquiryItems = cart.map(item => {
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
        const errData = await response.json();
        showToast(`Error: ${errData.error || "Failed to submit inquiry"}`);
        setSubmittingInquiry(false);
        return;
      }

      const result = await response.json();

      // Clear states
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

  // --- Dynamic Dates and Exchange Rates ---
  const eqUSD = convertPrice(grandTotalInTRY, "TRY", "USD", exchangeRates);
  const eqEUR = convertPrice(grandTotalInTRY, "TRY", "EUR", exchangeRates);
  const eqGBP = convertPrice(grandTotalInTRY, "TRY", "GBP", exchangeRates);
  const eqTRY = grandTotalInTRY;

  const ratesBanner = exchangeRates && exchangeRates.length > 0
    ? exchangeRates.filter(r => ["USD", "EUR", "GBP"].includes(r.currency_code.toUpperCase()))
    : [];

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
      formattedDate = d.toLocaleDateString(getSafeLocale(lang), {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    } catch {
      formattedDate = String(rawDate).split("T")[0] || "";
    }
  }

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
    <div className="min-h-screen w-full flex flex-col bg-bg-dark text-text-primary overflow-x-hidden font-sans antialiased">
      
      {/* 1. Header Navigation */}
      <Header
        lang={lang}
        setLang={setLang}
        isLangOpen={isLangOpen}
        setIsLangOpen={setIsLangOpen}
        totalPkgs={totalPkgs}
        setIsCartOpen={setIsCartOpen}
        setSearchQuery={setSearchQuery}
        setCurrentPage={setCurrentPage}
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
                {cart.length === 0 
                  ? t("empty_cart", lang) 
                  : `${totalPkgs} ${lang === "tr" ? "Paket" : "Packages"} | ${totalItemsCount} ${lang === "tr" ? "Adet Ürün" : "Items"} | ~${totalWeight.toFixed(1)} kg`}
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
          /* Empty Cart View */
          <div className="flex flex-col items-center justify-center py-24 text-center max-w-md mx-auto">
            <div className="w-20 h-20 rounded-full bg-cultured flex items-center justify-center text-4xl mb-6">
              🛍️
            </div>
            <h2 className="text-lg font-extrabold text-eerie-black">{t("empty_cart", lang)}</h2>
            <p className="text-sm font-semibold text-sonic-silver mt-2">
              {t("empty_cart_tip", lang)}
            </p>
            <button
              onClick={() => router.push(`/${getCategoryPrefix(lang)}/tum-urunler`)}
              className="mt-8 px-6 py-3 bg-salmon-pink hover:bg-eerie-black text-white rounded-[5px] font-extrabold text-xs uppercase transition-all duration-300 shadow-md border-none cursor-pointer flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{lang === "tr" ? "Kataloğu İncele" : "Explore Catalog"}</span>
            </button>
          </div>
        ) : (
          /* Wide Two-Column Grid */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            
            {/* Left Column: Product Table Grid */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              
              {/* Desktop Wide Table Layout */}
              <div className="hidden md:block bg-white border border-cultured rounded-[12px] overflow-hidden shadow-premium">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#fafafa] border-b border-cultured text-xs font-extrabold text-sonic-silver tracking-wider">
                      <th className="py-4.5 px-5 w-[42%]">{lang === "tr" ? "ÜRÜN" : "PRODUCT"}</th>
                      <th className="py-4.5 px-4 text-center w-[12%]">{lang === "tr" ? "BİRİM FİYAT" : "UNIT PRICE"}</th>
                      <th className="py-4.5 px-4 text-center w-[15%]">{lang === "tr" ? "PAKET MİKTARI" : "PACKAGE QTY"}</th>
                      <th className="py-4.5 px-4 text-center w-[16%]">{lang === "tr" ? "PAKET İÇERİĞİ" : "PACK CONTENT"}</th>
                      <th className="py-4.5 px-5 text-right w-[15%]">{lang === "tr" ? "TOPLAM TUTAR" : "TOTAL PRICE"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cultured">
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
                        <tr key={idx} className="hover:bg-[#fafafa]/50 transition-colors">
                          <td className="py-4 px-5">
                            <div className="flex gap-4">
                              <img 
                                src={getResizedImageUrl(item.image_url, 80, 106)} 
                                alt={item.title} 
                                className="w-16 h-20 object-cover rounded-[5px] bg-[#fafafa] border border-cultured shrink-0"
                              />
                              <div className="flex flex-col gap-1 min-w-0 pr-4">
                                <a
                                  href={`/product/${item.slug || item.product_id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm font-bold text-eerie-black hover:text-salmon-pink transition-colors truncate leading-normal no-underline block"
                                >
                                  {(item.title_translations && item.title_translations[lang]) || item.title}
                                </a>
                                <span className="text-[11px] font-bold text-accent-gold">
                                  {t("color", lang)}: {item.color}
                                </span>
                                <span className="text-[11px] font-semibold text-sonic-silver">
                                  SKU: {item.custom_sku} | Weight: {(item.weight_per_unit * item.units_per_package).toFixed(2)} kg/pk
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(idx)}
                                  className="text-[10px] font-bold text-red-500 hover:text-red-700 bg-transparent border-none cursor-pointer self-start mt-1.5 transition-colors"
                                >
                                  {lang === "tr" ? "Sil" : "Remove"}
                                </button>
                              </div>
                            </div>
                          </td>
                          
                          <td className="py-4 px-4 text-center font-bold text-sm text-onyx whitespace-nowrap">
                            {pricePerUnit.toFixed(2)} {currency}
                          </td>
                          
                          <td className="py-4 px-4 text-center">
                            <div className="inline-flex items-center gap-2 bg-white border border-cultured rounded-[5px] p-1 shadow-inner">
                              <button 
                                onClick={() => handleAdjustQty(idx, -1)}
                                className="w-7 h-7 rounded-[5px] border border-cultured bg-[#fafafa] hover:bg-cultured flex items-center justify-center font-bold text-xs cursor-pointer select-none transition-colors active:scale-90"
                              >
                                −
                              </button>
                              <span className="text-xs font-bold text-onyx px-2">
                                {item.packages_qty}
                              </span>
                              <button 
                                onClick={() => handleAdjustQty(idx, 1)}
                                className="w-7 h-7 rounded-[5px] border border-cultured bg-[#fafafa] hover:bg-cultured flex items-center justify-center font-bold text-xs cursor-pointer select-none transition-colors active:scale-90"
                              >
                                +
                              </button>
                            </div>
                            <span className="text-[10px] text-sonic-silver font-semibold block mt-1">
                              {lang === "tr" ? "Paket" : "Pack"}
                            </span>
                          </td>

                          <td className="py-4 px-4 text-center">
                            <span className="text-xs font-bold text-eerie-black">
                              {itemTotalUnits} {lang === "tr" ? "Adet" : t("piece", lang)}
                            </span>
                            <span className="text-[10px] text-sonic-silver font-semibold block mt-1">
                              ({item.units_per_package} {lang === "tr" ? "Adet/Paket" : "Pcs/Pack"})
                            </span>
                          </td>

                          <td className="py-4 px-5 text-right font-extrabold text-sm text-eerie-black whitespace-nowrap">
                            {itemTotalPrice.toFixed(2)} {currency}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List Layout (Clean cards stacking) */}
              <div className="flex flex-col gap-4 md:hidden">
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
                    <div key={idx} className="bg-white border border-cultured rounded-[12px] p-4 flex flex-col gap-3 shadow-sm relative">
                      <button
                        onClick={() => handleRemoveItem(idx)}
                        className="absolute top-4 right-4 text-sonic-silver hover:text-red-500 bg-transparent border-none cursor-pointer text-sm transition-colors"
                      >
                        ✕
                      </button>
                      <div className="flex gap-4">
                        <img 
                          src={getResizedImageUrl(item.image_url, 80, 106)} 
                          alt={item.title} 
                          className="w-14 h-18 object-cover rounded-[5px] bg-[#fafafa] border border-cultured shrink-0"
                        />
                        <div className="flex-grow min-w-0 pr-4">
                          <a
                            href={`/product/${item.slug || item.product_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-bold text-eerie-black hover:text-salmon-pink transition-colors line-clamp-2 leading-relaxed no-underline block"
                          >
                            {(item.title_translations && item.title_translations[lang]) || item.title}
                          </a>
                          <span className="text-[10px] font-bold text-accent-gold block mt-0.5">
                            {t("color", lang)}: {item.color} | SKU: {item.custom_sku}
                          </span>
                          <span className="text-[10px] font-semibold text-sonic-silver block mt-0.5">
                            {item.units_per_package} {lang === "tr" ? "Adet/Paket" : "Pcs/Pack"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-cultured pt-3 mt-1">
                        <div className="flex items-center gap-1.5 bg-white border border-cultured rounded-[5px] p-0.5">
                          <button 
                            onClick={() => handleAdjustQty(idx, -1)}
                            className="w-6 h-6 rounded-[5px] border border-cultured bg-[#fafafa] flex items-center justify-center font-bold text-[10px] cursor-pointer"
                          >
                            −
                          </button>
                          <span className="text-xs font-bold text-onyx px-1.5">
                            {item.packages_qty} {lang === "tr" ? "Pkt" : "Pck"}
                          </span>
                          <button 
                            onClick={() => handleAdjustQty(idx, 1)}
                            className="w-6 h-6 rounded-[5px] border border-cultured bg-[#fafafa] flex items-center justify-center font-bold text-[10px] cursor-pointer"
                          >
                            +
                          </button>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] font-semibold text-sonic-silver block">
                            {itemTotalUnits} {lang === "tr" ? "Adet" : t("piece", lang)} x {pricePerUnit.toFixed(2)} {currency}
                          </span>
                          <span className="text-xs font-extrabold text-eerie-black block mt-0.5">
                            {itemTotalPrice.toFixed(2)} {currency}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>

            {/* Right Column: Checkout & Summary Sidebar */}
            <div className="flex flex-col gap-6">
              
              {/* Summary Card */}
              <div className="bg-white border border-cultured rounded-[12px] p-5 shadow-premium flex flex-col gap-4">
                <h3 className="font-sans font-extrabold text-sm text-eerie-black border-b border-cultured pb-3 tracking-wider">
                  {lang === "tr" ? "SİPARİŞ ÖZETİ" : "ORDER SUMMARY"}
                </h3>
                
                <div className="flex flex-col gap-3.5 text-xs font-bold text-davys-gray">
                  <div className="flex justify-between items-center">
                    <span>{t("total_packages", lang)}:</span>
                    <span className="text-eerie-black font-extrabold">{totalPkgs} {lang === "tr" ? "Paket" : "Pack"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>{t("total_qty", lang)}:</span>
                    <span className="text-eerie-black font-extrabold">{totalItemsCount} {lang === "tr" ? "Adet" : t("piece", lang)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>{t("total_weight", lang)}:</span>
                    <span className="text-eerie-black font-extrabold">{totalWeight.toFixed(2)} kg</span>
                  </div>
                  
                  <div className="flex justify-between items-center text-sm font-extrabold text-salmon-pink border-t border-cultured pt-4 mt-2">
                    <span>{t("grand_total", lang)}:</span>
                    <span className="text-[16px]">{finalTotalPrice.toFixed(2)} {displayCurrency}</span>
                  </div>
                </div>

                {/* TCMB Multi-Currency Exchange Equivalents Card */}
                <div className="mt-2 pt-4 border-t border-dashed border-cultured flex flex-col gap-3 bg-[#fafafa] p-3.5 rounded-[8px] border border-cultured">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-extrabold text-sonic-silver tracking-wider">
                      {t("exchange_rate_equivalents", lang).toLocaleUpperCase(lang === "tr" ? "tr" : "en")}
                    </span>
                    {ratesBanner.length > 0 && (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-semibold text-spanish-gray">
                          {t("active_tcmb_rates", lang)}{" "}
                          {ratesBanner.map((r, i) => (
                            <span key={r.currency_code} className="font-bold text-sonic-silver">
                              {i > 0 && " | "}1 {r.currency_code} = {Number(r.buying_rate).toFixed(4)} TL
                            </span>
                          ))}
                        </span>
                        {formattedDate && (
                          <span className="text-[8px] font-medium text-spanish-gray italic leading-normal">
                            {dateInfo}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-extrabold text-onyx">
                    <div className="flex items-center justify-between bg-white border border-cultured rounded p-2 shadow-sm">
                      <span className="text-sonic-silver">🇹🇷 TRY:</span>
                      <span className="text-eerie-black font-extrabold">{eqTRY.toFixed(2)} ₺</span>
                    </div>
                    <div className="flex items-center justify-between bg-white border border-cultured rounded p-2 shadow-sm">
                      <span className="text-sonic-silver">🇺🇸 USD:</span>
                      <span className="text-eerie-black font-extrabold">${eqUSD.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between bg-white border border-cultured rounded p-2 shadow-sm">
                      <span className="text-sonic-silver">🇪🇺 EUR:</span>
                      <span className="text-eerie-black font-extrabold">€{eqEUR.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between bg-white border border-cultured rounded p-2 shadow-sm">
                      <span className="text-sonic-silver">🇬🇧 GBP:</span>
                      <span className="text-eerie-black font-extrabold">£{eqGBP.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* B2B Flow Toggle actions */}
                {token ? (
                  !isCheckout ? (
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
                        onClick={() => {
                          setFullName(fullName || (typeof window !== "undefined" ? JSON.parse(localStorage.getItem("store_user_info") || "{}").first_name + " " + JSON.parse(localStorage.getItem("store_user_info") || "{}").last_name : ""));
                          setEmailAddress(emailAddress || (typeof window !== "undefined" ? JSON.parse(localStorage.getItem("store_user_info") || "{}").email : ""));
                          setPhoneNumber(phoneNumber || (typeof window !== "undefined" ? JSON.parse(localStorage.getItem("store_user_info") || "{}").phone : ""));
                          setIsCheckout(false);
                          setForceShowInquiry(true);
                        }}
                        className="w-full py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-[5px] font-bold text-xs border-none flex items-center justify-center gap-2 cursor-pointer transition-colors"
                      >
                        📄 {lang === "tr" ? "FİYAT TEKLİFİ İSTE (PROFORMA)" : "REQUEST PRICE QUOTE ONLY"}
                      </button>
                    </div>
                  ) : (
                    /* Checkout Address details */
                    <form onSubmit={handleCheckoutSubmit} className="flex flex-col gap-4 pt-2 border-t border-cultured mt-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-extrabold text-salmon-pink tracking-[0.5px]">
                          {lang === "tr" ? "ADRES VE ÖDEME BİLGİLERİ" : "ADDRESS & PAYMENT"}
                        </h4>
                        <button
                          type="button"
                          onClick={() => {
                            setIsCheckout(false);
                            setForceShowInquiry(false);
                          }}
                          className="text-[10px] font-bold text-sonic-silver hover:text-salmon-pink bg-transparent border-none cursor-pointer"
                        >
                          &larr; {lang === "tr" ? "Sepete Dön" : "Back to Cart"}
                        </button>
                      </div>

                      {/* Delivery Address */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-extrabold text-eerie-black tracking-[0.5px]">
                          🚚 {lang === "tr" ? "TESLİMAT ADRESİ" : "DELIVERY ADDRESS"}
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
                            className="w-full px-3 py-2 bg-white border border-cultured rounded-[5px] text-xs font-semibold focus:outline-none focus:border-salmon-pink text-eerie-black resize-none mt-1"
                            placeholder={lang === "tr" ? "Teslimat adresini yazınız..." : "Type delivery address..."}
                          />
                        )}
                      </div>

                      {/* Billing Address */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-extrabold text-eerie-black tracking-[0.5px]">
                          📄 {lang === "tr" ? "FATURA ADRESİ" : "BILLING ADDRESS"}
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
                            <div className="font-mono text-[9.5px] text-zinc-700 bg-white/70 px-1.5 py-0.5 rounded select-all mt-0.5">XXX</div>
                            <span className="text-[8.5px] text-blue-800">Alıcı: Modanet B2B Tekstil</span>
                          </div>
                          <div>
                            <span className="font-bold text-blue-900">Garanti BBVA:</span>
                            <div className="font-mono text-[9.5px] text-zinc-700 bg-white/70 px-1.5 py-0.5 rounded select-all mt-0.5">XXX</div>
                            <span className="text-[8.5px] text-blue-800">Alıcı: Modanet B2B Tekstil</span>
                          </div>
                          <div>
                            <span className="font-bold text-blue-900">VakıfBank:</span>
                            <div className="font-mono text-[9.5px] text-zinc-700 bg-white/70 px-1.5 py-0.5 rounded select-all mt-0.5">XXX</div>
                            <span className="text-[8.5px] text-blue-800">Alıcı: Modanet B2B Tekstil</span>
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
                          "✔️ " + (lang === "tr" ? "SİPARİŞİ ONAYLA" : "CONFIRM B2B ORDER")
                        )}
                      </button>
                    </form>
                  )
                ) : null}

                {/* Guest Inquiry Request Form */}
                {(!token || forceShowInquiry) && (
                  <form onSubmit={handleInquirySubmit} className="flex flex-col gap-3.5 pt-2 border-t border-cultured mt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-eerie-black tracking-wider">
                        {lang === "tr" ? "TEKLİF TALEP FORMU" : "REQUEST QUOTE FORM"}
                      </span>
                      {token && (
                        <button
                          type="button"
                          onClick={() => {
                            setForceShowInquiry(false);
                            setIsCheckout(false);
                          }}
                          className="text-[9px] font-bold text-salmon-pink bg-transparent border-none cursor-pointer"
                        >
                          &larr; {lang === "tr" ? "Checkout'a Git" : "Go to Checkout"}
                        </button>
                      )}
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-extrabold text-eerie-black tracking-[0.5px]">{t("full_name", lang).toLocaleUpperCase(lang === "tr" ? "tr" : "en")}</label>
                      <input 
                        type="text" 
                        required 
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-cultured rounded-[5px] text-xs font-semibold focus:outline-none focus:border-salmon-pink text-eerie-black"
                        placeholder={t("placeholder_full_name", lang)}
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-extrabold text-eerie-black tracking-[0.5px]">{t("company_name", lang).toLocaleUpperCase(lang === "tr" ? "tr" : "en")}</label>
                      <input 
                        type="text" 
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-cultured rounded-[5px] text-xs font-semibold focus:outline-none focus:border-salmon-pink text-eerie-black"
                        placeholder={t("placeholder_company_name", lang)}
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-extrabold text-eerie-black tracking-[0.5px]">{t("phone", lang).toLocaleUpperCase(lang === "tr" ? "tr" : "en")}</label>
                      <input 
                        type="tel" 
                        required 
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-cultured rounded-[5px] text-xs font-semibold focus:outline-none focus:border-salmon-pink text-eerie-black"
                        placeholder={t("placeholder_phone", lang)}
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-extrabold text-eerie-black tracking-[0.5px]">{t("email", lang).toLocaleUpperCase(lang === "tr" ? "tr" : "en")}</label>
                      <input 
                        type="email" 
                        required 
                        value={emailAddress}
                        onChange={(e) => setEmailAddress(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-cultured rounded-[5px] text-xs font-semibold focus:outline-none focus:border-salmon-pink text-eerie-black"
                        placeholder={t("placeholder_email", lang)}
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-extrabold text-eerie-black tracking-[0.5px]">{t("message", lang).toLocaleUpperCase(lang === "tr" ? "tr" : "en")}</label>
                      <textarea 
                        value={customerMessage}
                        onChange={(e) => setCustomerMessage(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-cultured rounded-[5px] text-xs font-semibold focus:outline-none focus:border-salmon-pink text-eerie-black resize-none h-16"
                        placeholder={t("placeholder_message", lang)}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submittingInquiry}
                      className="w-full py-3.5 bg-salmon-pink hover:bg-eerie-black text-white rounded-[5px] font-extrabold text-xs tracking-[0.5px] shadow-sm border-none flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-[0.99] transition-all mt-1"
                    >
                      {submittingInquiry ? (
                        <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                      ) : (
                        "🚀 " + t("submit_inquiry", lang).toLocaleUpperCase(lang === "tr" ? "tr" : "en")
                      )}
                    </button>
                  </form>
                )}

                {/* Login hint for guest orders */}
                {!token && (
                  <div className="mt-3 p-3 bg-zinc-50 border border-zinc-200/60 rounded-lg text-center text-xs font-semibold text-zinc-600">
                    {lang === "tr" ? "Kayıtlı bayimiz misiniz?" : "Are you our registered dealer?"}{" "}
                    <button
                      type="button"
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent("merter-open-auth", { detail: { mode: "login" } }));
                      }}
                      className="text-salmon-pink font-extrabold hover:underline bg-transparent border-none cursor-pointer"
                    >
                      {lang === "tr" ? "Giriş Yapın" : "Sign In"}
                    </button>
                  </div>
                )}

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

    </div>
  );
}
