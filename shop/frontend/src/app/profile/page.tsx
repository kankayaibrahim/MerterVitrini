"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User, Settings, MapPin, Clipboard, Check, AlertCircle, Home, LogOut } from "lucide-react";
import { t } from "@/app/i18n";
import { Category, CartItem } from "@/types/store";
import { apiFetch } from "@/app/utils";

// Custom Instagram SVG Icon to avoid older lucide-react import issues
const Instagram = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

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
      } else {
        setCheckingAuth(false);
        setLoadingProfile(false);
      }
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
    }
    router.push("/");
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
                <div className="flex items-center gap-3 px-3 py-2.5 bg-salmon-pink/5 rounded-lg border border-salmon-pink/20 text-salmon-pink text-xs font-bold text-left">
                  <User className="w-4 h-4" />
                  <span>{t("profile_details", lang)}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 px-3 py-2.5 text-sonic-silver hover:text-salmon-pink hover:bg-cultured transition-all rounded-lg text-xs font-bold text-left border-none bg-transparent cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{t("safe_logout", lang)}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Profile Edit Form Dashboard */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-cultured shadow-sm">
              <h2 className="font-sans font-extrabold text-xl text-eerie-black mb-1 select-none flex items-center gap-2">
                <Settings className="w-5 h-5 text-salmon-pink" />
                {t("account_settings_title", lang)}
              </h2>
              <p className="text-xs text-sonic-silver font-semibold mb-8 select-none">
                {t("account_settings_desc", lang)}
              </p>

              {/* Success / Error Alerts */}
              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold flex items-center gap-2 select-none animate-in fade-in duration-200">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{error}</span>
                </div>
              )}
              {success && (
                <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-bold flex items-center gap-2 select-none animate-in fade-in duration-200">
                  <Check className="w-4 h-4 shrink-0 text-emerald-500 animate-bounce" />
                  <span>{success}</span>
                </div>
              )}

              <form onSubmit={handleSaveProfile} className="flex flex-col gap-6">
                
                {/* Section 1: Personal info */}
                <div>
                  <h4 className="text-[10px] font-extrabold uppercase text-sonic-silver tracking-wider border-b border-cultured pb-2 mb-4 select-none">
                    {t("personal_information_header", lang)}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-extrabold uppercase text-eerie-black tracking-wider">{t("first_name_field", lang)}</label>
                      <input
                        type="text"
                        required
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-cultured rounded-lg text-xs font-semibold focus:outline-none focus:border-salmon-pink focus:ring-salmon-pink transition-all shadow-inner text-eerie-black"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-extrabold uppercase text-eerie-black tracking-wider">{t("last_name_field", lang)}</label>
                      <input
                        type="text"
                        required
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-cultured rounded-lg text-xs font-semibold focus:outline-none focus:border-salmon-pink focus:ring-salmon-pink transition-all shadow-inner text-eerie-black"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-extrabold uppercase text-eerie-black tracking-wider">{t("email_readonly", lang)}</label>
                      <input
                        type="email"
                        disabled
                        value={email}
                        className="w-full px-3.5 py-2.5 bg-[#f5f5f5] border border-cultured rounded-lg text-xs font-semibold text-sonic-silver cursor-not-allowed select-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-extrabold uppercase text-eerie-black tracking-wider">{t("phone_number_field", lang)}</label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-cultured rounded-lg text-xs font-semibold focus:outline-none focus:border-salmon-pink focus:ring-salmon-pink transition-all shadow-inner text-eerie-black"
                        placeholder={t("placeholder_phone", lang)}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Storefront Preferences */}
                <div>
                  <h4 className="text-[10px] font-extrabold uppercase text-sonic-silver tracking-wider border-b border-cultured pb-2 mb-4 select-none">
                    {t("shopping_preferences_header", lang)}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-extrabold uppercase text-eerie-black tracking-wider">{t("default_language_field", lang)}</label>
                      <select
                        value={preferredLang}
                        onChange={(e) => setPreferredLang(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-cultured rounded-lg text-xs font-bold focus:outline-none focus:border-salmon-pink text-onyx cursor-pointer shadow-sm"
                      >
                        <option value="tr">Türkçe 🇹🇷</option>
                        <option value="en">English 🇬🇧</option>
                        <option value="ar">العربية 🇸🇦</option>
                        <option value="ru">Русский 🇷🇺</option>
                        <option value="pl">Polski 🇵🇱</option>
                        <option value="bg">Български 🇧🇬</option>
                        <option value="de">Deutsch 🇩🇪</option>
                        <option value="fr">Français 🇫🇷</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-extrabold uppercase text-eerie-black tracking-wider">{t("default_currency_field", lang)}</label>
                      <select
                        value={preferredCurrency}
                        onChange={(e) => setPreferredCurrency(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-cultured rounded-lg text-xs font-bold focus:outline-none focus:border-salmon-pink text-onyx cursor-pointer shadow-sm"
                      >
                        <option value="TRY">TRY (TL) 🇹🇷</option>
                        <option value="USD">USD ($) 🇺🇸</option>
                        <option value="EUR">EUR (€) 🇪🇺</option>
                        <option value="GBP">GBP (£) 🇬🇧</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Section 3: Company and Address Information */}
                <div>
                  <h4 className="text-[10px] font-extrabold uppercase text-sonic-silver tracking-wider border-b border-cultured pb-2 mb-4 select-none">
                    {t("b2b_company_billing_header", lang)}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-extrabold uppercase text-eerie-black tracking-wider flex items-center gap-1.5">
                        <Clipboard className="w-3.5 h-3.5 text-salmon-pink" />
                        {t("tax_id_field", lang)}
                      </label>
                      <input
                        type="text"
                        value={taxNoTCKN}
                        onChange={(e) => setTaxNoTCKN(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-cultured rounded-lg text-xs font-semibold focus:outline-none focus:border-salmon-pink focus:ring-salmon-pink transition-all shadow-inner text-eerie-black"
                        placeholder={t("placeholder_tax_id", lang)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-extrabold uppercase text-eerie-black tracking-wider flex items-center gap-1.5">
                        <Instagram className="w-3.5 h-3.5 text-salmon-pink" />
                        {t("instagram_username_field", lang)}
                      </label>
                      <input
                        type="text"
                        value={instagramUsername}
                        onChange={(e) => setInstagramUsername(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-cultured rounded-lg text-xs font-semibold focus:outline-none focus:border-salmon-pink focus:ring-salmon-pink transition-all shadow-inner text-eerie-black"
                        placeholder={t("placeholder_instagram", lang)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-extrabold uppercase text-eerie-black tracking-wider flex items-center gap-1.5 select-none">
                        <MapPin className="w-3.5 h-3.5 text-salmon-pink" />
                        {t("billing_address_field", lang)}
                      </label>
                      <textarea
                        value={billingAddress}
                        onChange={(e) => setBillingAddress(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-cultured rounded-lg text-xs font-semibold focus:outline-none focus:border-salmon-pink focus:ring-salmon-pink transition-all shadow-inner h-24 resize-none text-eerie-black"
                        placeholder={t("placeholder_billing_address", lang)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-extrabold uppercase text-eerie-black tracking-wider flex items-center gap-1.5 select-none">
                        <MapPin className="w-3.5 h-3.5 text-salmon-pink" />
                        {t("delivery_address_field", lang)}
                      </label>
                      <textarea
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-cultured rounded-lg text-xs font-semibold focus:outline-none focus:border-salmon-pink focus:ring-salmon-pink transition-all shadow-inner h-24 resize-none text-eerie-black"
                        placeholder={t("placeholder_shipping_address", lang)}
                      />
                    </div>
                  </div>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="w-full mt-4 py-3.5 bg-salmon-pink hover:bg-eerie-black text-white rounded-lg font-extrabold text-xs tracking-[0.5px] uppercase shadow-md border-none flex items-center justify-center gap-2 cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-300 active:scale-[0.99]"
                >
                  {savingProfile ? (
                    <div className="spinner animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    t("save_changes_btn", lang)
                  )}
                </button>

              </form>

            </div>
          </div>

        </div>

      </main>

      <Footer lang={lang} />
    </div>
  );
}
