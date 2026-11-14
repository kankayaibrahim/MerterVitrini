"use client";

import React, { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2, Home, Phone, RefreshCw } from "lucide-react";
import Header from "@/components/store/Header";
import Footer from "@/components/store/Footer";
import { Category, CartItem } from "@/types/store";
import { apiFetch } from "@/app/utils";
import { t } from "@/app/i18n";
import { getOrSetVisitorId } from "@/components/analytics/AnalyticsTracker";
import {
  COUNTRY_DIAL_CODES,
  combineDialCodeAndLocalPhone,
  getDefaultCountryIsoForLang,
  getDialCodeByIso,
  getLocalPhonePlaceholder,
  isRealisticPhoneNumber,
  validateAndNormalizeRealisticPhone,
} from "@/utils/phoneValidation";

interface CallbackUserInfo {
  id?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  role?: string;
}

function consumeSafeReturnToPath(): string {
  if (typeof window === "undefined") {
    return "/profile/";
  }
  const raw = sessionStorage.getItem("merter_auth_return_to");
  sessionStorage.removeItem("merter_auth_return_to");
  if (!raw) {
    return "/profile/";
  }
  const trimmed = raw.trim();
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.startsWith("/\\") ||
    trimmed.startsWith("/google-callback")
  ) {
    return "/profile/";
  }
  return trimmed;
}

function GoogleCallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [needsPhone, setNeedsPhone] = useState(false);
  const [pendingToken, setPendingToken] = useState("");
  const [pendingUser, setPendingUser] = useState<CallbackUserInfo | null>(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [submittingPhone, setSubmittingPhone] = useState(false);

  const [lang, setLang] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("preferred_lang") || "tr";
    }
    return "tr";
  });
  const [countryIso, setCountryIso] = useState<string>(() =>
    getDefaultCountryIsoForLang(typeof window !== "undefined" ? localStorage.getItem("preferred_lang") || "tr" : "tr")
  );
  const dialCode = getDialCodeByIso(countryIso);
  const [displayCurrency] = useState<string>(() => {
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
          return JSON.parse(savedCart) as CartItem[];
        } catch {
          // ignore invalid cart JSON
        }
      }
    }
    return [];
  });

  // Sync lang to document element
  useEffect(() => {
    if (typeof window !== "undefined") {
      document.documentElement.setAttribute("lang", lang);
    }
  }, [lang]);

  useEffect(() => {
    const loadCategories = async () => {
      const data = await apiFetch<Category[]>("/categories");
      if (data) setCategories(data);
    };
    void loadCategories();
  }, []);

  useEffect(() => {
    const code = searchParams.get("code");
    
    if (!code) {
      const timer = setTimeout(() => {
        setError(t("google_code_missing", lang));
      }, 0);
      return () => clearTimeout(timer);
    }

    const exchangeCode = async () => {
      try {
        const origin = window.location.origin;
        const redirectUri = `${origin}/google-callback/`;
        const vid = getOrSetVisitorId();
        
        const response = await fetch(`/api/v1/store/auth/google-callback?code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(redirectUri)}&visitor_id=${encodeURIComponent(vid)}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        let data: { error?: string; token?: string; user?: CallbackUserInfo; requires_phone?: boolean } = {};
        try {
          data = await response.json();
        } catch {
          throw new Error(t("google_auth_failed", lang) || "Giriş işlemi sırasında sunucu ile bağlantı kurulamadı. Lütfen tekrar deneyiniz.");
        }

        if (!response.ok) {
          throw new Error(data.error || t("google_auth_failed", lang));
        }

        const userPhone = data.user?.phone ? String(data.user.phone).trim() : "";
        const role = (data.user?.role || "customer").toLowerCase();
        const needsPhoneGate =
          Boolean(data.requires_phone) ||
          ((role === "" || role === "customer") && !isRealisticPhoneNumber(userPhone));

        if (needsPhoneGate) {
          localStorage.removeItem("store_user_token");
          localStorage.removeItem("store_user_info");
          window.dispatchEvent(new Event("auth-change"));
          setPendingToken(data.token || "");
          setPendingUser(data.user || null);
          setNeedsPhone(true);
          return;
        }

        // Save token & user to localStorage only after verified phone exists
        localStorage.setItem("store_user_token", data.token || "");
        localStorage.setItem("store_user_info", JSON.stringify(data.user));
        window.dispatchEvent(new Event("auth-change"));

        setSuccess(true);

        const targetPath = consumeSafeReturnToPath();
        setTimeout(() => {
          router.push(targetPath);
        }, 1500);

      } catch (err: unknown) {
        setError((err as Error).message || t("google_unexpected_error", lang));
      }
    };

    void exchangeCode();
  }, [searchParams, router, lang]);

  const handleGoogleRetry = () => {
    if (typeof window !== "undefined") {
      const origin = window.location.origin;
      const keycloakUrl = "https://auth.mertervitrini.com.tr";
      const realm = "merter";
      const clientId = "admin-client";
      const redirectUri = `${origin}/google-callback/`;
      const scope = "openid profile email";
      const idpHint = "google";

      const authUrl = `${keycloakUrl}/realms/${realm}/protocol/openid-connect/auth` +
        `?client_id=${encodeURIComponent(clientId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent(scope)}` +
        `&prompt=select_account` +
        `&kc_idp_hint=${encodeURIComponent(idpHint)}`;

      window.location.href = authUrl;
    }
  };

  const handleSavePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError(null);

    const trimmed = phoneInput.trim();
    if (!trimmed) {
      setPhoneError(t("phone_required_error", lang) || "Cep telefonu numarası zorunludur.");
      return;
    }

    const candidate = combineDialCodeAndLocalPhone(dialCode, trimmed);
    const phoneCheck = validateAndNormalizeRealisticPhone(candidate);
    if (!phoneCheck.valid) {
      setPhoneError(t("phone_invalid_error", lang));
      return;
    }

    setSubmittingPhone(true);
    try {
      const response = await fetch("/api/v1/store/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${pendingToken}`,
        },
        body: JSON.stringify({
          first_name: pendingUser?.first_name || "Müşteri",
          last_name: pendingUser?.last_name || "",
          phone: phoneCheck.normalized,
          preferred_lang: lang,
          preferred_currency: displayCurrency,
        }),
      });

      const resData = (await response.json().catch(() => ({}))) as { error?: string; phone?: string };
      if (!response.ok) {
        throw new Error(resData.error || t("profile_update_failed", lang));
      }

      const savedPhone = resData.phone || phoneCheck.normalized;
      const updatedUser = pendingUser
        ? { ...pendingUser, phone: savedPhone, email_verified: true }
        : { phone: savedPhone, email_verified: true };
      localStorage.setItem("store_user_token", pendingToken);
      localStorage.setItem("store_user_info", JSON.stringify(updatedUser));
      window.dispatchEvent(new Event("auth-change"));

      setNeedsPhone(false);
      setSuccess(true);
      const targetPath = consumeSafeReturnToPath();
      setTimeout(() => {
        router.push(targetPath);
      }, 1500);
    } catch (err: unknown) {
      setPhoneError((err as Error).message);
    } finally {
      setSubmittingPhone(false);
    }
  };

  const totalPkgs = cart.reduce((sum, item) => sum + item.packages_qty, 0);

  return (
    <div className="min-h-screen flex flex-col bg-[#fafafa]">
      <Header
        lang={lang}
        setLang={setLang}
        isLangOpen={false}
        setIsLangOpen={() => {}}
        totalPkgs={totalPkgs}
        setIsCartOpen={() => {}}
        setSearchQuery={() => {}}
        setCurrentPage={() => {}}
        setActiveCategoryId={setActiveCategoryId}
        categories={categories}
        activeCategoryId={activeCategoryId}
        displayCurrency={displayCurrency}
        onCurrencyChange={() => {}}
      />

      <main className="flex-grow flex flex-col items-center justify-center p-6 sm:p-12 select-none py-24">
        <div className="w-full max-w-md bg-white/95 backdrop-blur-2xl border border-cultured rounded-2xl shadow-2xl p-8 text-center animate-in fade-in zoom-in-95 duration-200">
          {!error && !success && !needsPhone && (
            <div className="flex flex-col items-center gap-4">
              <div className="relative flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-salmon-pink animate-spin" />
              </div>
              <h2 className="text-lg font-extrabold text-eerie-black mt-2">
                {t("google_signing_in", lang)}
              </h2>
              <p className="text-xs font-semibold text-sonic-silver max-w-xs leading-relaxed">
                {t("google_signing_in_desc", lang)}
              </p>
            </div>
          )}

          {needsPhone && (
            <form onSubmit={handleSavePhone} className="flex flex-col items-center gap-4 animate-in fade-in duration-300 text-left">
              <div className="w-12 h-12 bg-salmon-pink/10 rounded-full flex items-center justify-center text-salmon-pink mb-1">
                <Phone className="w-6 h-6" />
              </div>
              <h2 className="text-base font-extrabold text-eerie-black text-center">
                {t("phone_complete_title", lang)}
              </h2>
              <p className="text-xs font-semibold text-sonic-silver text-center max-w-xs leading-relaxed">
                {t("phone_complete_desc", lang)}
              </p>

              {phoneError && (
                <div className="w-full bg-red-50 border border-red-100 text-red-600 rounded-xl p-3 text-xs font-semibold animate-shake">
                  {phoneError}
                </div>
              )}

              <div className="w-full">
                <label className="block text-[10px] font-extrabold text-eerie-black uppercase tracking-wider mb-1.5">
                  {t("phone_label", lang)} <span className="text-red-500 font-bold">*</span>
                </label>
                <div className="flex gap-2">
                  <select
                    aria-label={t("phone_label", lang)}
                    value={countryIso}
                    onChange={(e) => setCountryIso(e.target.value)}
                    className="w-28 shrink-0 px-2.5 py-2.5 bg-cultured border border-cultured rounded-xl text-xs font-bold text-onyx focus:outline-none focus:border-salmon-pink focus:bg-white transition-all duration-200 cursor-pointer"
                  >
                    {COUNTRY_DIAL_CODES.map((opt) => (
                      <option key={opt.iso} value={opt.iso}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <div className="relative flex-1">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-spanish-gray">
                      <Phone className="w-4 h-4" />
                    </span>
                    <input
                      type="tel"
                      required
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 bg-cultured border border-cultured rounded-xl text-xs sm:text-sm font-semibold text-onyx placeholder-spanish-gray focus:outline-none focus:border-salmon-pink focus:bg-white transition-all duration-200"
                      placeholder={getLocalPhonePlaceholder(dialCode)}
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={submittingPhone}
                className="w-full py-3 bg-salmon-pink hover:bg-salmon-pink/90 text-white rounded-xl text-xs font-extrabold uppercase tracking-widest transition-all duration-200 cursor-pointer shadow-md flex items-center justify-center gap-2 border-none mt-2"
              >
                {submittingPhone ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>{t("save_and_continue", lang)}</span>
              </button>
            </form>
          )}

          {success && (
            <div className="flex flex-col items-center gap-4 animate-in fade-in duration-300">
              <CheckCircle2 className="w-16 h-16 text-emerald-500 animate-bounce" />
              <h2 className="text-lg font-extrabold text-eerie-black mt-2">
                {t("login_success", lang)}
              </h2>
              <p className="text-xs font-semibold text-emerald-600 max-w-xs leading-relaxed">
                {t("redirecting_to_profile", lang)}
              </p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center gap-4 animate-in fade-in duration-300">
              <AlertCircle className="w-16 h-16 text-red-500 animate-shake" />
              <h2 className="text-lg font-extrabold text-eerie-black mt-2">
                {t("login_failed", lang)}
              </h2>
              <p className="text-xs font-semibold text-red-600 max-w-xs leading-relaxed">
                {error}
              </p>
              
              <div className="w-full flex flex-col gap-2.5 mt-2">
                <button 
                  type="button"
                  onClick={handleGoogleRetry}
                  className="w-full py-3 bg-salmon-pink hover:bg-salmon-pink/90 text-white rounded-xl text-xs font-extrabold uppercase tracking-widest transition-all duration-200 cursor-pointer shadow-md flex items-center justify-center gap-2 border-none"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Google ile Tekrar Dene</span>
                </button>
                <Link 
                  href="/" 
                  className="w-full py-3 bg-eerie-black hover:bg-zinc-800 text-white rounded-xl text-xs font-extrabold uppercase tracking-widest transition-all duration-200 cursor-pointer shadow-md flex items-center justify-center gap-2 no-underline text-center"
                >
                  <Home className="w-4 h-4" />
                  <span>{t("back_to_homepage", lang)}</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer lang={lang} />
    </div>
  );
}

export default function GoogleCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa]">
        <div className="spinner animate-spin w-8 h-8 border-4 border-salmon-pink border-t-transparent rounded-full" />
      </div>
    }>
      <GoogleCallbackHandler />
    </Suspense>
  );
}
