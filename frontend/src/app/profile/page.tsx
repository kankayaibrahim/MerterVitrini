"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { User, Clipboard, Home, LogOut } from "lucide-react";
import { t } from "@/app/i18n";
import { Category, CartItem } from "@/types/store";
import { apiFetch, showToast } from "@/app/utils";

// Centralized types & translations
import { addressTranslations, orderTranslations } from "./components/translations";
import { UserAddress, CountryLookup, StateLookup, CityLookup } from "./components/types";
import { UserOrder } from "./components/OrderHistory";
import { RefundOrderItem } from "./components/RefundModal";

// Modular sub-components
import ProfileDetails from "./components/ProfileDetails";
import AddressBook from "./components/AddressBook";
import AddressModal from "./components/AddressModal";
import OrderHistory from "./components/OrderHistory";
import PaymentModal from "./components/PaymentModal";
import RefundModal from "./components/RefundModal";

// Reuse global storefront components
import Header from "@/components/store/Header";
import Footer from "@/components/store/Footer";

interface AuthUser {
  readonly id?: string;
  readonly email?: string;
  readonly role?: string;
  readonly first_name?: string;
  readonly last_name?: string;
  readonly phone?: string;
  readonly [key: string]: unknown;
}

function parsePhoneOnly(rawPhone: string, phoneCode: number): string {
  let cleanP = rawPhone.trim().replace(/\D/g, "");
  const pCodeStr = String(phoneCode);
  if (cleanP.startsWith(pCodeStr)) {
    cleanP = cleanP.substring(pCodeStr.length);
  }
  if (cleanP.startsWith("0")) {
    cleanP = cleanP.substring(1);
  }
  return cleanP;
}

function getDefaultCountryId(countries: readonly CountryLookup[]): string {
  const trCountry = countries.find((c) => c.code === "TR");
  if (trCountry) return trCountry.id;
  return countries[0]?.id || "";
}

function validateAddressPhone(
  countryCode: string,
  cleanPhone: string,
  getAddressT: (k: string) => string
): string | null {
  if (countryCode === "TR") {
    if (cleanPhone.length !== 10) {
      return getAddressT("phone_tr_length_error");
    }
  } else if (cleanPhone.length < 6 || cleanPhone.length > 15) {
    return getAddressT("phone_intl_length_error");
  }
  return null;
}

export default function ProfilePage() {
  // --- Storefront states ---
  const [lang, setLang] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("preferred_lang") || "tr";
    }
    return "tr";
  });
  const [isLangOpen, setIsLangOpen] = useState<boolean>(false);
  const [displayCurrency, setDisplayCurrency] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("merter_preferred_currency") || "TRY";
    }
    return "TRY";
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string>("");
  const [cart] = useState<CartItem[]>(() => {
    if (typeof window !== "undefined") {
      const savedCart = localStorage.getItem("merter_b2b_cart");
      if (savedCart) {
        try {
          return JSON.parse(savedCart);
        } catch {
          // ignore
        }
      }
    }
    return [];
  });
  const [, setIsCartOpen] = useState<boolean>(false);

  // --- Auth states ---
  const [user, setUser] = useState<AuthUser | null>(() => {
    if (typeof window !== "undefined") {
      const savedUserInfo = localStorage.getItem("store_user_info");
      if (savedUserInfo) {
        try {
          return JSON.parse(savedUserInfo);
        } catch {
          // ignore
        }
      }
    }
    return null;
  });
  const [token] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("store_user_token");
    }
    return null;
  });

  // --- Form Profile states ---
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [preferredLang, setPreferredLang] = useState("tr");
  const [preferredCurrency, setPreferredCurrency] = useState("TRY");
  const [billingAddress, setBillingAddress] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [taxNoTCKN, setTaxNoTCKN] = useState("");
  const [instagramUsername, setInstagramUsername] = useState("");

  const [loadingProfile, setLoadingProfile] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return Boolean(localStorage.getItem("store_user_token"));
    }
    return false;
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // --- Section state ---
  const [activeSection, setActiveSection] = useState<"profile" | "orders">(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("tab") === "orders") {
        return "orders";
      }
    }
    return "profile";
  });

  // --- Orders states ---
  const [orders, setOrders] = useState<UserOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return Boolean(localStorage.getItem("store_user_token"));
    }
    return false;
  });
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

  // --- Payment Notification Form States ---
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [paymentOrderID, setPaymentOrderID] = useState<string>("");
  const [payBankName, setPayBankName] = useState<string>("");
  const [paySenderName, setPaySenderName] = useState<string>("");
  const [payAmount, setPayAmount] = useState<string>("");
  const [payNotes, setPayNotes] = useState<string>("");
  const [submittingPayment, setSubmittingPayment] = useState<boolean>(false);

  // --- Refund Form States ---
  const [isRefundModalOpen, setIsRefundModalOpen] = useState<boolean>(false);
  const [refundOrderID, setRefundOrderID] = useState<string>("");
  const [refundOrderItems, setRefundOrderItems] = useState<RefundOrderItem[]>([]);
  const [refundType, setRefundType] = useState<"FULL" | "PARTIAL">("FULL");
  const [refundReason, setRefundReason] = useState<string>("");
  const [refundQuantities, setRefundQuantities] = useState<Record<string, number>>({});
  const [refundSelectedItems, setRefundSelectedItems] = useState<Record<string, boolean>>({});
  const [submittingRefund, setSubmittingRefund] = useState<boolean>(false);

  // --- Address Book States ---
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [countries, setCountries] = useState<CountryLookup[]>([]);
  const [states, setStates] = useState<StateLookup[]>([]);
  const [cities, setCities] = useState<CityLookup[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return Boolean(localStorage.getItem("store_user_token"));
    }
    return false;
  });

  // Modal / Form States
  const [isAddressModalOpen, setIsAddressModalOpen] = useState<boolean>(false);
  const [editingAddress, setEditingAddress] = useState<UserAddress | null>(null);
  
  // Active Address form state
  const [formTitle, setFormTitle] = useState("");
  const [formType, setFormType] = useState<"billing" | "shipping">("shipping");
  const [formFirstName, setFormFirstName] = useState("");
  const [formLastName, setFormLastName] = useState("");
  const [formCompany, setFormCompany] = useState("");
  const [formPhoneOnly, setFormPhoneOnly] = useState("");
  const [formCountryID, setFormCountryID] = useState("");
  const [formStateID, setFormStateID] = useState("");
  const [formCityID, setFormCityID] = useState("");
  const [formAddressLine, setFormAddressLine] = useState("");
  const [formPostalCode, setFormPostalCode] = useState("");
  const [formTaxNo, setFormTaxNo] = useState("");
  const [formTaxOffice, setFormTaxOffice] = useState("");
  const [formIsDefault, setFormIsDefault] = useState(false);

  const [savingAddress, setSavingAddress] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [addressSuccess, setAddressSuccess] = useState<string | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);

  const getAddressT = (key: string): string => {
    const safeLang = addressTranslations[lang] ? lang : "tr";
    return addressTranslations[safeLang][key] || addressTranslations["tr"][key] || t(key, lang);
  };

  const getOrderT = (key: string): string => {
    const safeLang = orderTranslations[lang] ? lang : "tr";
    return orderTranslations[safeLang][key] || orderTranslations["tr"][key] || key;
  };

  const handleLogout = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("store_user_token");
      localStorage.removeItem("store_user_info");
      window.dispatchEvent(new Event("auth-change"));
      
      const origin = window.location.origin;
      window.location.href = origin + "/";
    }
  }, []);

  const fetchOrders = useCallback(async (authToken: string) => {
    try {
      const response = await fetch("/api/v1/store/orders", {
        headers: {
          "Authorization": `Bearer ${authToken}`,
          "Content-Type": "application/json"
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Siparişler yüklenemedi");
      }
      setOrders(data || []);
    } catch (err: unknown) {
      setOrdersError((err as Error).message || "Siparişler yüklenemedi");
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  const fetchUserProfile = useCallback(async (authToken: string) => {
    try {
      const response = await fetch("/api/v1/store/profile", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${authToken}`,
          "Content-Type": "application/json"
        }
      });

      const data = await response.json();

      if (!response.ok) {
        const currentLang = (typeof window !== "undefined" && localStorage.getItem("preferred_lang")) || "tr";
        if (response.status === 401) {
          handleLogout();
          throw new Error(t("session_expired", currentLang));
        }
        throw new Error(data.error || t("profile_load_failed", currentLang));
      }

      setFirstName(data.first_name || "");
      setLastName(data.last_name || "");
      setEmail(data.email || "");
      setPhone(data.phone || "");
      setPreferredLang(data.preferred_lang || "tr");
      setPreferredCurrency(data.preferred_currency || "TRY");
      setBillingAddress(data.billing_address || "");
      setDeliveryAddress(data.delivery_address || "");
      setTaxNoTCKN(data.tax_no_tckn || "");
      setInstagramUsername(data.instagram_username || "");

    } catch (err: unknown) {
      const currentLang = (typeof window !== "undefined" && localStorage.getItem("preferred_lang")) || "tr";
      setError((err as Error).message || t("profile_load_failed", currentLang));
    } finally {
      setLoadingProfile(false);
    }
  }, [handleLogout]);

  const fetchAddresses = useCallback(async (authToken: string) => {
    try {
      const response = await fetch("/api/v1/store/profile/addresses", {
        headers: {
          "Authorization": `Bearer ${authToken}`,
          "Content-Type": "application/json"
        }
      });
      if (response.ok) {
        const data = await response.json();
        setAddresses(data || []);
      }
    } catch (e) {
      console.error("Failed to fetch addresses:", e);
    } finally {
      setLoadingAddresses(false);
    }
  }, []);

  const fetchCountries = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/store/locations/countries");
      if (response.ok) {
        const data = await response.json();
        setCountries(data || []);
      }
    } catch (e) {
      console.error("Failed to fetch countries:", e);
    }
  }, []);

  // Synchronize dynamic HTML lang attribute
  useEffect(() => {
    if (typeof window !== "undefined") {
      document.documentElement.setAttribute("lang", lang);
    }
  }, [lang]);

  // Load language, currency, cart & categories on mount
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      const catData = await apiFetch<Category[]>("/categories");
      if (isMounted && catData) {
        setCategories(catData);
      }

      if (token) {
        await Promise.all([
          fetchUserProfile(token),
          fetchAddresses(token),
          fetchCountries(),
          fetchOrders(token)
        ]);
      }
    };

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [token, fetchUserProfile, fetchAddresses, fetchCountries, fetchOrders]);

  const handleDownloadFile = async (url: string, filename: string) => {
    if (!token) return;
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Dosya indirilemedi");
      }
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err: unknown) {
      showToast("Hata: " + ((err as Error).message || "Dosya indirilemedi"));
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!window.confirm(getOrderT("cancel_confirm"))) return;
    try {
      const response = await fetch(`/api/v1/store/orders/${orderId}/cancel`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Sipariş iptal edilemedi");
      }
      showToast(getOrderT("order_cancelled"));
      if (token) void fetchOrders(token);
    } catch (err: unknown) {
      showToast("Hata: " + ((err as Error).message || "Sipariş iptal edilemedi"));
    }
  };

  const openPaymentModal = (order: UserOrder) => {
    setPaymentOrderID(order.id);
    setPayBankName("");
    setPaySenderName(`${firstName} ${lastName}`);
    setPayAmount(order.total_amount.toString());
    setPayNotes("");
    setIsPaymentModalOpen(true);
  };

  const handleSubmitPaymentNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingPayment(true);
    try {
      const response = await fetch(`/api/v1/store/orders/${paymentOrderID}/payment-notification`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          bank_name: payBankName,
          sender_name: paySenderName,
          amount: Number.parseFloat(payAmount),
          notes: payNotes
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Ödeme bildirimi iletilemedi");
      }
      showToast(getOrderT("payment_notification_submitted"));
      setIsPaymentModalOpen(false);
      if (token) void fetchOrders(token);
    } catch (err: unknown) {
      showToast("Hata: " + ((err as Error).message || "Ödeme bildirimi iletilemedi"));
    } finally {
      setSubmittingPayment(false);
    }
  };

  const openRefundModal = (order: UserOrder) => {
    setRefundOrderID(order.id);
    setRefundOrderItems(order.items ? [...order.items] : []);
    setRefundType("FULL");
    setRefundReason("");
    
    const initialQty: Record<string, number> = {};
    const initialSel: Record<string, boolean> = {};
    (order.items || []).forEach((item) => {
      initialQty[item.id] = item.quantity;
      initialSel[item.id] = false;
    });
    setRefundQuantities(initialQty);
    setRefundSelectedItems(initialSel);
    
    setIsRefundModalOpen(true);
  };

  const handleRefundQtyChange = (itemId: string, val: number, max: number) => {
    const cleanVal = Math.max(1, Math.min(max, val));
    setRefundQuantities(prev => ({
      ...prev,
      [itemId]: cleanVal
    }));
  };

  const handleToggleRefundItem = (itemId: string) => {
    setRefundSelectedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const handleSubmitRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let itemsPayload: Array<{ order_item_id: string; quantity: number }> = [];
    if (refundType === "PARTIAL") {
      itemsPayload = refundOrderItems
        .filter(item => refundSelectedItems[item.id])
        .map(item => ({
          order_item_id: item.id,
          quantity: refundQuantities[item.id]
        }));
      
      if (itemsPayload.length === 0) {
        showToast(getOrderT("refund_items_selection"));
        return;
      }
    }
    
    setSubmittingRefund(true);
    try {
      const response = await fetch(`/api/v1/store/orders/${refundOrderID}/refund`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          refund_type: refundType,
          reason: refundReason,
          items: itemsPayload
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "İade talebi oluşturulamadı");
      }
      showToast(getOrderT("refund_requested"));
      setIsRefundModalOpen(false);
      if (token) void fetchOrders(token);
    } catch (err: unknown) {
      showToast("Hata: " + ((err as Error).message || "İade talebi oluşturulamadı"));
    } finally {
      setSubmittingRefund(false);
    }
  };



  const fetchStates = async (countryId: string): Promise<void> => {
    if (!countryId) {
      setStates([]);
      return;
    }
    try {
      const response = await fetch(`/api/v1/store/locations/countries/${countryId}/states`);
      if (response.ok) {
        const data = await response.json();
        setStates(data || []);
      } else {
        setStates([]);
      }
    } catch (e) {
      console.error("Failed to fetch states:", e);
      setStates([]);
    }
  };

  const fetchCities = async (stateId: string): Promise<void> => {
    if (!stateId) {
      setCities([]);
      return;
    }
    try {
      const response = await fetch(`/api/v1/store/locations/states/${stateId}/cities`);
      if (response.ok) {
        const data = await response.json();
        setCities(data || []);
      } else {
        setCities([]);
      }
    } catch (e) {
      console.error("Failed to fetch cities:", e);
      setCities([]);
    }
  };

  const handleCountryChange = (countryId: string) => {
    setFormCountryID(countryId);
    setFormStateID("");
    setFormCityID("");
    setCities([]);
    void fetchStates(countryId);
  };

  const handleStateChange = (stateId: string) => {
    setFormStateID(stateId);
    setFormCityID("");
    void fetchCities(stateId);
  };

  const openAddressModal = async (address: UserAddress | null = null) => {
    setAddressError(null);
    setAddressSuccess(null);
    if (address) {
      setEditingAddress(address);
      setFormTitle(address.title);
      setFormType(address.address_type);
      setFormFirstName(address.first_name);
      setFormLastName(address.last_name);
      setFormCompany(address.company_name || "");
      setFormCountryID(address.country_id);
      setFormAddressLine(address.address_line);
      setFormPostalCode(address.postal_code || "");
      setFormTaxNo(address.tax_no_tckn || "");
      setFormTaxOffice(address.tax_office || "");
      setFormIsDefault(address.is_default);

      // Parse phone code prefix based on selected country
      const matchedCountry = countries.find((c) => c.id === address.country_id);
      const matchedPhoneCode = matchedCountry ? matchedCountry.phone_code : 90;
      setFormPhoneOnly(parsePhoneOnly(address.phone || "", matchedPhoneCode));
      
      await fetchStates(address.country_id);
      setFormStateID(address.state_id || "");
      if (address.state_id) {
        await fetchCities(address.state_id);
        setFormCityID(address.city_id || "");
      } else {
        setFormCityID("");
        setCities([]);
      }
    } else {
      setEditingAddress(null);
      setFormTitle("");
      setFormType("shipping");
      setFormFirstName(firstName || "");
      setFormLastName(lastName || "");
      setFormCompany("");
      
      const defaultCountryID = getDefaultCountryId(countries);
      setFormCountryID(defaultCountryID);
      
      // Parse profile phone number prefix based on default country
      const matchedCountry = countries.find((c) => c.id === defaultCountryID);
      const matchedPhoneCode = matchedCountry ? matchedCountry.phone_code : 90;
      setFormPhoneOnly(parsePhoneOnly(phone || "", matchedPhoneCode));

      if (defaultCountryID) {
        await fetchStates(defaultCountryID);
      }
      setFormStateID("");
      setFormCityID("");
      setCities([]);
      setFormAddressLine("");
      setFormPostalCode("");
      setFormTaxNo(taxNoTCKN || "");
      setFormTaxOffice("");
      setFormIsDefault(addresses.length === 0);
    }
    setIsAddressModalOpen(true);
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddressError(null);
    setAddressSuccess(null);

    if (!formPostalCode.trim()) {
      setAddressError(getAddressT("postal_code_required_error"));
      return;
    }

    const selectedCountry = countries.find((c) => c.id === formCountryID);
    if (!selectedCountry) {
      setAddressError(getAddressT("country_required_error"));
      return;
    }

    const cleanPhone = formPhoneOnly.trim().replace(/\D/g, "");
    const phoneError = validateAddressPhone(selectedCountry.code, cleanPhone, getAddressT);
    if (phoneError) {
      setAddressError(phoneError);
      return;
    }

    const fullPhone = `+${selectedCountry.phone_code}${cleanPhone}`;

    setSavingAddress(true);

    const payload = {
      title: formTitle,
      address_type: formType,
      first_name: formFirstName,
      last_name: formLastName,
      company_name: formCompany || null,
      phone: fullPhone,
      country_id: formCountryID,
      state_id: formStateID || null,
      city_id: formCityID || null,
      address_line: formAddressLine,
      postal_code: formPostalCode,
      tax_no_tckn: formType === "billing" ? (formTaxNo || null) : null,
      tax_office: formType === "billing" ? (formTaxOffice || null) : null,
      is_default: formIsDefault
    };

    try {
      const url = editingAddress 
        ? `/api/v1/store/profile/addresses/${editingAddress.id}`
        : "/api/v1/store/profile/addresses";
      
      const method = editingAddress ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Adres kaydedilirken bir hata oluştu");
      }

      setAddressSuccess(editingAddress ? getAddressT("address_update_success") : getAddressT("address_create_success"));
      if (token) void fetchAddresses(token);
      
      setTimeout(() => {
        setIsAddressModalOpen(false);
        setEditingAddress(null);
      }, 1000);

    } catch (err: unknown) {
      setAddressError((err as Error).message || "Adres kaydedilemedi");
    } finally {
      setSavingAddress(false);
    }
  };

  const handleDeleteAddress = async (id: string) => {
    if (!window.confirm(getAddressT("address_delete_confirm"))) {
      return;
    }
    
    try {
      const response = await fetch(`/api/v1/store/profile/addresses/${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Adres silinemedi");
      }

      if (token) void fetchAddresses(token);
    } catch (err: unknown) {
      showToast((err as Error).message || "Adres silinemedi");
    }
  };

  const handleMigrateLegacyAddresses = async () => {
    setIsMigrating(true);
    try {
      const trCountry = countries.find((c) => c.code === "TR");
      if (!trCountry) throw new Error("Turkey location code not found in active catalog countries");

      if (billingAddress && billingAddress.trim() !== "") {
        const response = await fetch("/api/v1/store/profile/addresses", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            title: getAddressT("billing_address"),
            address_type: "billing",
            first_name: firstName,
            last_name: lastName,
            phone: phone || "905000000000",
            country_id: trCountry.id,
            address_line: billingAddress.substring(0, 500),
            postal_code: "34000",
            tax_no_tckn: taxNoTCKN || null,
            is_default: true
          })
        });
        if (!response.ok) {
          const resErr = await response.json();
          throw new Error(resErr.error || "Fatura adresi taşınamadı");
        }
      }

      if (deliveryAddress && deliveryAddress.trim() !== "") {
        const response = await fetch("/api/v1/store/profile/addresses", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            title: getAddressT("shipping_address"),
            address_type: "shipping",
            first_name: firstName,
            last_name: lastName,
            phone: phone || "905000000000",
            country_id: trCountry.id,
            address_line: deliveryAddress.substring(0, 500),
            postal_code: "34000",
            is_default: true
          })
        });
        if (!response.ok) {
          const resErr = await response.json();
          throw new Error(resErr.error || "Sevk adresi taşınamadı");
        }
      }

      setSuccess(getAddressT("migration_success"));
      if (token) void fetchAddresses(token);
    } catch (e: unknown) {
      console.error(e);
      setError((e as Error).message || "Taşıma işlemi başarısız oldu");
    } finally {
      setIsMigrating(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSavingProfile(true);

    try {
      const response = await fetch("/api/v1/store/profile", {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          phone,
          preferred_lang: preferredLang,
          preferred_currency: preferredCurrency,
          billing_address: billingAddress,
          delivery_address: deliveryAddress,
          tax_no_tckn: taxNoTCKN,
          instagram_username: instagramUsername
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t("profile_update_failed", lang));
      }

      setSuccess(t("profile_saved_success", lang));

      // 1. Sync updated details locally immediately
      if (typeof window !== "undefined") {
        const updatedUserInfo = {
          ...user,
          first_name: firstName,
          last_name: lastName,
          phone: phone
        };
        setUser(updatedUserInfo);
        localStorage.setItem("store_user_info", JSON.stringify(updatedUserInfo));
        localStorage.setItem("preferred_lang", preferredLang);
        localStorage.setItem("merter_preferred_currency", preferredCurrency);
        
        // Sync outer page display state
        setLang(preferredLang);
        setDisplayCurrency(preferredCurrency);

        // Dispatch auth and profile sync triggers
        window.dispatchEvent(new Event("auth-change"));
      }

      setTimeout(() => {
        setSuccess(null);
      }, 3000);

    } catch (err: unknown) {
      setError((err as Error).message || t("profile_update_failed", lang));
    } finally {
      setSavingProfile(false);
    }
  };

  const totalPkgs = cart.reduce((sum, item) => sum + item.packages_qty, 0);

  // --- Sub-loaders for unauthorised / loading UI ---
  if (loadingProfile) {
    return (
      <div className="min-h-screen flex flex-col bg-[#fafafa]">
        <Header
          lang={lang}
          setLang={setLang}
          isLangOpen={isLangOpen}
          setIsLangOpen={setIsLangOpen}
          totalPkgs={totalPkgs}
          setIsCartOpen={setIsCartOpen}
          setSearchQuery={() => {}}
          setCurrentPage={() => {}}
          setActiveCategoryId={setActiveCategoryId}
          categories={categories}
          activeCategoryId={activeCategoryId}
          displayCurrency={displayCurrency}
          onCurrencyChange={() => {}}
        />
        <main className="flex-grow flex flex-col items-center justify-center py-20 gap-3">
          <div className="spinner animate-spin w-8 h-8 border-4 border-salmon-pink border-t-transparent rounded-full" />
          <span className="text-xs font-bold text-sonic-silver select-none">
            {t("loading_profile", lang)}
          </span>
        </main>
        <Footer lang={lang} />
      </div>
    );
  }

  // Unauthorized page state
  if (!user || !token) {
    return (
      <div className="min-h-screen flex flex-col bg-[#fafafa]">
        <Header
          lang={lang}
          setLang={setLang}
          isLangOpen={isLangOpen}
          setIsLangOpen={setIsLangOpen}
          totalPkgs={totalPkgs}
          setIsCartOpen={setIsCartOpen}
          setSearchQuery={() => {}}
          setCurrentPage={() => {}}
          setActiveCategoryId={setActiveCategoryId}
          categories={categories}
          activeCategoryId={activeCategoryId}
          displayCurrency={displayCurrency}
          onCurrencyChange={() => {}}
        />
        <main className="flex-grow flex flex-col items-center justify-center p-8 text-center select-none py-24">
          <span className="text-5xl mb-4">🔒</span>
          <h1 className="text-2xl font-extrabold text-eerie-black mb-3">
            {t("auth_required", lang)}
          </h1>
          <p className="text-sm font-semibold text-sonic-silver mb-8 max-w-md mx-auto leading-relaxed">
            {t("auth_required_desc", lang)}
          </p>
          <Link 
            href="/" 
            className="px-8 py-3 bg-salmon-pink text-white rounded-[5px] font-extrabold text-xs tracking-[0.5px] uppercase hover:bg-eerie-black transition-all cursor-pointer shadow-md no-underline"
          >
            {t("back_to_homepage", lang)}
          </Link>
        </main>
        <Footer lang={lang} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#fbfbfb]">
      <Header
        lang={lang}
        setLang={setLang}
        isLangOpen={isLangOpen}
        setIsLangOpen={setIsLangOpen}
        totalPkgs={totalPkgs}
        setIsCartOpen={setIsCartOpen}
        setSearchQuery={() => {}}
        setCurrentPage={() => {}}
        setActiveCategoryId={setActiveCategoryId}
        categories={categories}
        activeCategoryId={activeCategoryId}
        displayCurrency={displayCurrency}
        onCurrencyChange={() => {}}
      />

      <main className="flex-grow max-w-[1280px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-in fade-in duration-300">
        
        {/* Navigation Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-[11px] font-bold text-sonic-silver mb-6 uppercase tracking-wider select-none">
          <Link href="/" className="hover:text-salmon-pink flex items-center gap-1 transition-colors no-underline text-sonic-silver">
            <Home className="w-3.5 h-3.5" />
            <span>{t("home", lang)}</span>
          </Link>
          <span className="text-spanish-gray">/</span>
          <span className="text-salmon-pink font-extrabold">{t("my_account", lang)}</span>
        </nav>

        {/* Outer Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Left Column: Premium User Status Widget */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            <div className="bg-white rounded-2xl p-6 border border-cultured flex flex-col items-center text-center shadow-sm select-none">
              <div className="w-20 h-20 rounded-full bg-salmon-pink/10 border-2 border-salmon-pink flex items-center justify-center mb-4">
                <span className="text-3xl font-extrabold text-salmon-pink">
                  {firstName.charAt(0).toUpperCase()}
                </span>
              </div>
              <h3 className="font-sans font-extrabold text-lg text-eerie-black">
                {firstName} {lastName}
              </h3>
              <span className="text-[11px] font-semibold text-sonic-silver tracking-wider uppercase bg-cultured px-2.5 py-1 rounded-full mt-2.5 border border-cultured">
                B2B {user?.role === "admin" ? "Admin" : "Customer"}
              </span>
              
              <div className="w-full border-t border-cultured my-6" />

              <div className="flex flex-col gap-2.5 w-full">
                <button
                  type="button"
                  onClick={() => setActiveSection("profile")}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border text-xs font-bold text-left cursor-pointer w-full transition-all ${
                    activeSection === "profile"
                      ? "bg-salmon-pink/5 border-salmon-pink/20 text-salmon-pink"
                      : "bg-transparent border-transparent text-sonic-silver hover:text-salmon-pink hover:bg-cultured"
                  }`}
                >
                  <User className="w-4 h-4" />
                  <span>{t("profile_details", lang)}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSection("orders")}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border text-xs font-bold text-left cursor-pointer w-full transition-all ${
                    activeSection === "orders"
                      ? "bg-salmon-pink/5 border-salmon-pink/20 text-salmon-pink"
                      : "bg-transparent border-transparent text-sonic-silver hover:text-salmon-pink hover:bg-cultured"
                  }`}
                >
                  <Clipboard className="w-4 h-4" />
                  <span>{getOrderT("orders_tab")}</span>
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-3 px-3 py-2.5 text-sonic-silver hover:text-salmon-pink hover:bg-cultured transition-all rounded-lg text-xs font-bold text-left border border-transparent bg-transparent cursor-pointer w-full"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{t("safe_logout", lang)}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Dynamic Section Router */}
          <div className="lg:col-span-3">
            {activeSection === "profile" ? (
              <div className="flex flex-col gap-8">
                <ProfileDetails
                  lang={lang}
                  firstName={firstName}
                  setFirstName={setFirstName}
                  lastName={lastName}
                  setLastName={setLastName}
                  email={email}
                  phone={phone}
                  setPhone={setPhone}
                  preferredLang={preferredLang}
                  setPreferredLang={setPreferredLang}
                  preferredCurrency={preferredCurrency}
                  setPreferredCurrency={setPreferredCurrency}
                  taxNoTCKN={taxNoTCKN}
                  setTaxNoTCKN={setTaxNoTCKN}
                  instagramUsername={instagramUsername}
                  setInstagramUsername={setInstagramUsername}
                  savingProfile={savingProfile}
                  handleSaveProfile={handleSaveProfile}
                  addressesCount={addresses.length}
                  billingAddress={billingAddress}
                  deliveryAddress={deliveryAddress}
                  isMigrating={isMigrating}
                  handleMigrateLegacyAddresses={handleMigrateLegacyAddresses}
                  getAddressT={getAddressT}
                  error={error}
                  success={success}
                />
                
                <AddressBook
                  addresses={addresses}
                  loadingAddresses={loadingAddresses}
                  openAddressModal={openAddressModal}
                  handleDeleteAddress={handleDeleteAddress}
                  getAddressT={getAddressT}
                />
              </div>
            ) : (
              <OrderHistory
                orders={orders}
                loadingOrders={loadingOrders}
                ordersError={ordersError}
                expandedOrders={expandedOrders}
                setExpandedOrders={setExpandedOrders}
                lang={lang}
                getOrderT={getOrderT}
                handleDownloadFile={handleDownloadFile}
                openPaymentModal={openPaymentModal}
                openRefundModal={openRefundModal}
                handleCancelOrder={handleCancelOrder}
              />
            )}
          </div>

        </div>

      </main>

      {/* Form Dialog Modals */}
      <AddressModal
        isOpen={isAddressModalOpen}
        onClose={() => setIsAddressModalOpen(false)}
        lang={lang}
        countries={countries}
        states={states}
        cities={cities}
        editingAddress={editingAddress}
        formTitle={formTitle}
        setFormTitle={setFormTitle}
        formType={formType}
        setFormType={setFormType}
        formFirstName={formFirstName}
        setFormFirstName={setFormFirstName}
        formLastName={formLastName}
        setFormLastName={setFormLastName}
        formCompany={formCompany}
        setFormCompany={setFormCompany}
        formPhoneOnly={formPhoneOnly}
        setFormPhoneOnly={setFormPhoneOnly}
        formCountryID={formCountryID}
        handleCountryChange={handleCountryChange}
        formStateID={formStateID}
        handleStateChange={handleStateChange}
        formCityID={formCityID}
        setFormCityID={setFormCityID}
        formAddressLine={formAddressLine}
        setFormAddressLine={setFormAddressLine}
        formPostalCode={formPostalCode}
        setFormPostalCode={setFormPostalCode}
        formTaxNo={formTaxNo}
        setFormTaxNo={setFormTaxNo}
        formTaxOffice={formTaxOffice}
        setFormTaxOffice={setFormTaxOffice}
        formIsDefault={formIsDefault}
        setFormIsDefault={setFormIsDefault}
        savingAddress={savingAddress}
        addressError={addressError}
        addressSuccess={addressSuccess}
        handleSaveAddress={handleSaveAddress}
        getAddressT={getAddressT}
      />

      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        lang={lang}
        payBankName={payBankName}
        setPayBankName={setPayBankName}
        paySenderName={paySenderName}
        setPaySenderName={setPaySenderName}
        payAmount={payAmount}
        setPayAmount={setPayAmount}
        payNotes={payNotes}
        setPayNotes={setPayNotes}
        submittingPayment={submittingPayment}
        handleSubmitPaymentNotification={handleSubmitPaymentNotification}
        getOrderT={getOrderT}
        getAddressT={getAddressT}
      />

      <RefundModal
        isOpen={isRefundModalOpen}
        onClose={() => setIsRefundModalOpen(false)}
        lang={lang}
        refundType={refundType}
        setRefundType={setRefundType}
        refundReason={refundReason}
        setRefundReason={setRefundReason}
        refundOrderItems={refundOrderItems}
        refundQuantities={refundQuantities}
        handleRefundQtyChange={handleRefundQtyChange}
        refundSelectedItems={refundSelectedItems}
        handleToggleRefundItem={handleToggleRefundItem}
        submittingRefund={submittingRefund}
        handleSubmitRefund={handleSubmitRefund}
        getOrderT={getOrderT}
        getAddressT={getAddressT}
      />

      <Footer lang={lang} />
    </div>
  );
}
