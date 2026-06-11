"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User, Clipboard, Home, LogOut } from "lucide-react";
import { t } from "@/app/i18n";
import { Category, CartItem } from "@/types/store";
import { apiFetch, showToast } from "@/app/utils";

// Centralized types & translations
import { addressTranslations, orderTranslations } from "./components/translations";
import { UserAddress, CountryLookup, StateLookup, CityLookup } from "./components/types";

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

export default function ProfilePage() {
  const router = useRouter();

  // --- Storefront states ---
  const [lang, setLang] = useState<string>("tr");
  const [isLangOpen, setIsLangOpen] = useState<boolean>(false);
  const [displayCurrency, setDisplayCurrency] = useState<string>("TRY");
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string>("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);

  // --- Auth states ---
  const [user, setUser] = useState<any | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

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

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // --- Section state ---
  const [activeSection, setActiveSection] = useState<"profile" | "orders">("profile");

  // --- Orders states ---
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState<boolean>(false);
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
  const [refundOrderItems, setRefundOrderItems] = useState<any[]>([]);
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
  const [loadingAddresses, setLoadingAddresses] = useState<boolean>(true);

  // Modal / Form States
  const [isAddressModalOpen, setIsAddressModalOpen] = useState<boolean>(false);
  const [editingAddress, setEditingAddress] = useState<UserAddress | null>(null);
  
  // Active Address form state
  const [formTitle, setFormTitle] = useState("");
  const [formType, setFormType] = useState<"billing" | "shipping">("shipping");
  const [formFirstName, setFormFirstName] = useState("");
  const [formLastName, setFormLastName] = useState("");
  const [formCompany, setFormCompany] = useState("");
  const [formPhone, setFormPhone] = useState("");
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

  // Synchronize dynamic HTML lang attribute
  useEffect(() => {
    if (typeof window !== "undefined") {
      document.documentElement.setAttribute("lang", lang);
    }
  }, [lang]);

  // Load language, currency, cart & categories on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedLang = localStorage.getItem("preferred_lang") || "tr";
      setLang(savedLang);

      const savedCurrency = localStorage.getItem("merter_preferred_currency") || "TRY";
      setDisplayCurrency(savedCurrency);

      const savedCart = localStorage.getItem("merter_b2b_cart");
      if (savedCart) {
        try {
          setCart(JSON.parse(savedCart));
        } catch (e) {
          console.error(e);
        }
      }

      const urlParams = new URLSearchParams(window.location.search);
      const tab = urlParams.get("tab");
      if (tab === "orders") {
        setActiveSection("orders");
      }
    }

    const loadCategories = async () => {
      const data = await apiFetch<Category[]>("/categories");
      if (data) setCategories(data);
    };
    loadCategories();

    // Check authorization
    checkAuth();
  }, []);

  const checkAuth = () => {
    if (typeof window !== "undefined") {
      const savedToken = localStorage.getItem("store_user_token");
      const savedUserInfo = localStorage.getItem("store_user_info");

      if (savedToken && savedUserInfo) {
        setToken(savedToken);
        const parsedUser = JSON.parse(savedUserInfo);
        setUser(parsedUser);
        fetchUserProfile(savedToken);
        fetchAddresses(savedToken);
        fetchCountries();
        fetchOrders(savedToken);
      } else {
        setCheckingAuth(false);
        setLoadingProfile(false);
      }
    }
  };

  const fetchOrders = async (authToken: string) => {
    setLoadingOrders(true);
    setOrdersError(null);
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
    } catch (err: any) {
      setOrdersError(err.message);
    } finally {
      setLoadingOrders(false);
    }
  };

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
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      showToast("Hata: " + err.message);
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
      if (token) fetchOrders(token);
    } catch (err: any) {
      showToast("Hata: " + err.message);
    }
  };

  const openPaymentModal = (order: any) => {
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
          amount: parseFloat(payAmount),
          notes: payNotes
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Ödeme bildirimi iletilemedi");
      }
      showToast(getOrderT("payment_notification_submitted"));
      setIsPaymentModalOpen(false);
      if (token) fetchOrders(token);
    } catch (err: any) {
      showToast("Hata: " + err.message);
    } finally {
      setSubmittingPayment(false);
    }
  };

  const openRefundModal = (order: any) => {
    setRefundOrderID(order.id);
    setRefundOrderItems(order.items || []);
    setRefundType("FULL");
    setRefundReason("");
    
    const initialQty: Record<string, number> = {};
    const initialSel: Record<string, boolean> = {};
    (order.items || []).forEach((item: any) => {
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
    
    let itemsPayload: any[] = [];
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
      if (token) fetchOrders(token);
    } catch (err: any) {
      showToast("Hata: " + err.message);
    } finally {
      setSubmittingRefund(false);
    }
  };

  const fetchUserProfile = async (authToken: string) => {
    setLoadingProfile(true);
    setError(null);
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
        // Token expired or invalid
        if (response.status === 401) {
          handleLogout();
          throw new Error(t("session_expired", lang));
        }
        throw new Error(data.error || t("profile_load_failed", lang));
      }

      // Populate form state
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

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingProfile(false);
      setCheckingAuth(false);
    }
  };

  const fetchAddresses = async (authToken: string) => {
    setLoadingAddresses(true);
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
  };

  const fetchCountries = async () => {
    try {
      const response = await fetch("/api/v1/store/locations/countries");
      if (response.ok) {
        const data = await response.json();
        setCountries(data || []);
      }
    } catch (e) {
      console.error("Failed to fetch countries:", e);
    }
  };

  const fetchStates = async (countryId: string): Promise<void> => {
    if (!countryId) {
      setStates([]);
      return Promise.resolve();
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
    return Promise.resolve();
  };

  const fetchCities = async (stateId: string): Promise<void> => {
    if (!stateId) {
      setCities([]);
      return Promise.resolve();
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
    return Promise.resolve();
  };

  const handleCountryChange = (countryId: string) => {
    setFormCountryID(countryId);
    setFormStateID("");
    setFormCityID("");
    setCities([]);
    fetchStates(countryId);
  };

  const handleStateChange = (stateId: string) => {
    setFormStateID(stateId);
    setFormCityID("");
    fetchCities(stateId);
  };

  const openAddressModal = (address: UserAddress | null = null) => {
    setAddressError(null);
    setAddressSuccess(null);
    if (address) {
      setEditingAddress(address);
      setFormTitle(address.title);
      setFormType(address.address_type);
      setFormFirstName(address.first_name);
      setFormLastName(address.last_name);
      setFormCompany(address.company_name || "");
      setFormPhone(address.phone);
      setFormCountryID(address.country_id);
      setFormAddressLine(address.address_line);
      setFormPostalCode(address.postal_code || "");
      setFormTaxNo(address.tax_no_tckn || "");
      setFormTaxOffice(address.tax_office || "");
      setFormIsDefault(address.is_default);

      // Parse phone code prefix based on selected country
      const matchedCountry = countries.find(c => c.id === address.country_id);
      const matchedPhoneCode = matchedCountry ? matchedCountry.phone_code : 90;
      let cleanP = (address.phone || "").trim().replace(/\D/g, "");
      const pCodeStr = String(matchedPhoneCode);
      if (cleanP.startsWith(pCodeStr)) {
        cleanP = cleanP.substring(pCodeStr.length);
      }
      if (cleanP.startsWith("0")) {
        cleanP = cleanP.substring(1);
      }
      setFormPhoneOnly(cleanP);
      
      fetchStates(address.country_id).then(() => {
        setFormStateID(address.state_id || "");
        if (address.state_id) {
          fetchCities(address.state_id).then(() => {
            setFormCityID(address.city_id || "");
          });
        } else {
          setFormCityID("");
          setCities([]);
        }
      });
    } else {
      setEditingAddress(null);
      setFormTitle("");
      setFormType("shipping");
      setFormFirstName(firstName || "");
      setFormLastName(lastName || "");
      setFormCompany("");
      setFormPhone(phone || "");
      
      const trCountry = countries.find(c => c.code === "TR");
      const defaultCountryID = trCountry ? trCountry.id : (countries.length > 0 ? countries[0].id : "");
      setFormCountryID(defaultCountryID);
      
      // Parse profile phone number prefix based on default country
      const matchedCountry = trCountry || (countries.length > 0 ? countries[0] : null);
      const matchedPhoneCode = matchedCountry ? matchedCountry.phone_code : 90;
      let cleanP = (phone || "").trim().replace(/\D/g, "");
      const pCodeStr = String(matchedPhoneCode);
      if (cleanP.startsWith(pCodeStr)) {
        cleanP = cleanP.substring(pCodeStr.length);
      }
      if (cleanP.startsWith("0")) {
        cleanP = cleanP.substring(1);
      }
      setFormPhoneOnly(cleanP);

      if (defaultCountryID) {
        fetchStates(defaultCountryID);
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

    const selectedCountry = countries.find(c => c.id === formCountryID);
    if (!selectedCountry) {
      setAddressError(getAddressT("country_required_error"));
      return;
    }

    const cleanPhone = formPhoneOnly.trim().replace(/\D/g, "");
    if (selectedCountry.code === "TR") {
      if (cleanPhone.length !== 10) {
        setAddressError(getAddressT("phone_tr_length_error"));
        return;
      }
    } else {
      if (cleanPhone.length < 6 || cleanPhone.length > 15) {
        setAddressError(getAddressT("phone_intl_length_error"));
        return;
      }
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
      if (token) fetchAddresses(token);
      
      setTimeout(() => {
        setIsAddressModalOpen(false);
        setEditingAddress(null);
      }, 1000);

    } catch (err: any) {
      setAddressError(err.message);
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

      if (token) fetchAddresses(token);
    } catch (err: any) {
      showToast(err.message);
    }
  };

  const handleMigrateLegacyAddresses = async () => {
    setIsMigrating(true);
    try {
      const trCountry = countries.find(c => c.code === "TR");
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
      if (token) fetchAddresses(token);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Taşıma işlemi başarısız oldu");
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

    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("store_user_token");
      localStorage.removeItem("store_user_info");
      window.dispatchEvent(new Event("auth-change"));
      
      const origin = window.location.origin;
      window.location.href = origin + "/";
    }
  };

  const totalPkgs = cart.reduce((sum, item) => sum + item.packages_qty, 0);

  // --- Sub-loaders for unauthorised / loading UI ---
  if (checkingAuth || loadingProfile) {
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
          <a 
            href="/" 
            className="px-8 py-3 bg-salmon-pink text-white rounded-[5px] font-extrabold text-xs tracking-[0.5px] uppercase hover:bg-eerie-black transition-all cursor-pointer shadow-md no-underline"
          >
            {t("back_to_homepage", lang)}
          </a>
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
          <a href="/" className="hover:text-salmon-pink flex items-center gap-1 transition-colors no-underline text-sonic-silver">
            <Home className="w-3.5 h-3.5" />
            <span>{t("home", lang)}</span>
          </a>
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
                B2B {user.role === "admin" ? "Admin" : "Customer"}
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
