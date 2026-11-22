"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { X, Lock, Mail, User, Phone, Check, AlertCircle, Building2, Info } from "lucide-react";
import { getCategoryPrefix, normalizeLangCode, t } from "@/app/i18n";
import { ensureRecaptchaLoaded, executeRecaptchaAction, resolveRecaptchaSiteKey } from "@/utils/recaptcha";
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
import { getAuthLegalCopy } from "@/utils/legalNotices";

interface AuthModalUser {
  id?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  role?: string;
  email_verified?: boolean;
}

const REMEMBERED_EMAIL_KEY = "merter_remembered_email";

function readRememberedEmail(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return localStorage.getItem(REMEMBERED_EMAIL_KEY) || "";
}

interface AuthModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly lang: string;
  readonly initialMode?: "login" | "register";
}

export default function AuthModal({ isOpen, onClose, lang, initialMode = "login" }: Readonly<AuthModalProps>) {
  const [mode, setMode] = useState<"login" | "register" | "complete_phone">(initialMode);
  const [email, setEmail] = useState(() => readRememberedEmail());
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [countryIso, setCountryIso] = useState<string>(() => getDefaultCountryIsoForLang(lang));
  const [pendingAuthToken, setPendingAuthToken] = useState("");
  const [pendingAuthUser, setPendingAuthUser] = useState<AuthModalUser | null>(null);
  const [websiteHp, setWebsiteHp] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [rememberMe, setRememberMe] = useState<boolean>(() => Boolean(readRememberedEmail()));
  const [showForgotHelp, setShowForgotHelp] = useState<boolean>(false);

  const dialCode = getDialCodeByIso(countryIso);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Preload Google reCAPTCHA v3 script when the auth modal opens and site key is configured
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    void resolveRecaptchaSiteKey().then(({ enabled, siteKey }) => {
      if (active && enabled && siteKey) {
        void ensureRecaptchaLoaded(siteKey, lang).catch(() => undefined);
      }
    });
    return () => {
      active = false;
    };
  }, [isOpen, lang]);

  const [prevOpenState, setPrevOpenState] = useState({ isOpen, initialMode });
  if (isOpen !== prevOpenState.isOpen || initialMode !== prevOpenState.initialMode) {
    setPrevOpenState({ isOpen, initialMode });
    if (isOpen) {
      const remembered = initialMode === "login" ? readRememberedEmail() : "";
      setMode(initialMode);
      setError(null);
      setSuccess(null);
      setShowForgotHelp(false);
      setEmail(remembered);
      setRememberMe(Boolean(remembered));
      setPassword("");
      setConfirmPassword("");
      setFirstName("");
      setLastName("");
      setPhone("");
      setCountryIso(getDefaultCountryIsoForLang(lang));
      setPendingAuthToken("");
      setPendingAuthUser(null);
      setWebsiteHp("");
      setAcceptedTerms(false);
    }
  }

  if (!isOpen) return null;

  const handleGoogleLogin = () => {
    if (typeof window !== "undefined") {
      const currentRel = `${window.location.pathname}${window.location.search}`;
      if (
        currentRel.startsWith("/") &&
        !currentRel.startsWith("//") &&
        !currentRel.startsWith("/\\") &&
        !currentRel.startsWith("/google-callback")
      ) {
        sessionStorage.setItem("merter_auth_return_to", currentRel);
      }
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const captchaToken = await executeRecaptchaAction("login", lang).catch(() => "");

      const response = await fetch("/api/v1/store/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          visitor_id: getOrSetVisitorId(),
          captcha_token: captchaToken,
          website_hp: websiteHp,
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        token?: string;
        user?: AuthModalUser;
        requires_phone?: boolean;
      };

      if (!response.ok) {
        throw new Error(data.error || t("login_failed_credentials", lang));
      }

      const role = String(data.user?.role || "customer").toLowerCase();
      const needsPhoneCompletion =
        Boolean(data.requires_phone) ||
        ((role === "" || role === "customer") && !isRealisticPhoneNumber(data.user?.phone));

      if (needsPhoneCompletion) {
        setPendingAuthToken(data.token || "");
        setPendingAuthUser(data.user || null);
        setPhone("");
        setMode("complete_phone");
        return;
      }

      // Save to localStorage
      localStorage.setItem("store_user_token", data.token || "");
      localStorage.setItem("store_user_info", JSON.stringify(data.user));
      if (rememberMe && email.trim()) {
        localStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim());
      } else {
        localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      }

      setSuccess(t("login_success_redirecting", lang));

      // Dispatch custom event to let other components know
      window.dispatchEvent(new Event("auth-change"));

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleCompletePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!phone.trim()) {
      setError(t("phone_required_error", lang));
      return;
    }

    const candidate = combineDialCodeAndLocalPhone(dialCode, phone);
    const phoneCheck = validateAndNormalizeRealisticPhone(candidate);
    if (!phoneCheck.valid) {
      setError(t("phone_invalid_error", lang));
      return;
    }

    setLoading(true);
    try {
      const preferredCurrency =
        typeof window !== "undefined"
          ? localStorage.getItem("merter_preferred_currency") || "TRY"
          : "TRY";

      const response = await fetch("/api/v1/store/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${pendingAuthToken}`,
        },
        body: JSON.stringify({
          first_name: pendingAuthUser?.first_name || t("customer_default_name", lang),
          last_name: pendingAuthUser?.last_name || "",
          phone: phoneCheck.normalized,
          preferred_lang: lang,
          preferred_currency: preferredCurrency,
        }),
      });

      const resData = (await response.json().catch(() => ({}))) as {
        error?: string;
        phone?: string;
      };
      if (!response.ok) {
        throw new Error(resData.error || t("profile_update_failed", lang));
      }

      const savedPhone = resData.phone || phoneCheck.normalized;
      const completedUser = pendingAuthUser
        ? { ...pendingAuthUser, phone: savedPhone }
        : { phone: savedPhone };
      localStorage.setItem("store_user_token", pendingAuthToken);
      localStorage.setItem("store_user_info", JSON.stringify(completedUser));
      if (rememberMe && email.trim()) {
        localStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim());
      } else {
        localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      }

      setSuccess(t("login_success_redirecting", lang));
      window.dispatchEvent(new Event("auth-change"));

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(t("passwords_dont_match", lang));
      return;
    }

    if (!phone.trim()) {
      setError(t("phone_required_error", lang));
      return;
    }

    const candidate = combineDialCodeAndLocalPhone(dialCode, phone);
    const phoneCheck = validateAndNormalizeRealisticPhone(candidate);
    if (!phoneCheck.valid) {
      setError(t("phone_invalid_error", lang));
      return;
    }

    const authLegal = getAuthLegalCopy(lang);
    if (!acceptedTerms) {
      setError(authLegal.requiredError);
      return;
    }

    setLoading(true);

    try {
      const captchaToken = await executeRecaptchaAction("register", lang);

      const response = await fetch("/api/v1/store/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email,
          phone: phoneCheck.normalized,
          password,
          visitor_id: getOrSetVisitorId(),
          terms_accepted: acceptedTerms,
          captcha_token: captchaToken,
          website_hp: websiteHp,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t("register_failed", lang));
      }

      // Save user if auto-logged in
      if (data.token && data.user) {
        localStorage.setItem("store_user_token", data.token);
        localStorage.setItem("store_user_info", JSON.stringify(data.user));
        setSuccess(t("register_success_autologin", lang));
        window.dispatchEvent(new Event("auth-change"));
      } else {
        setSuccess(t("register_success_login_now", lang));
        setMode("login");
      }

      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Translucent overlay */}
      <button
        type="button"
        aria-label={t("close_modal", lang)}
        tabIndex={-1}
        className="fixed inset-0 bg-eerie-black/40 backdrop-blur-md transition-opacity duration-300 cursor-default"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-md bg-white/90 backdrop-blur-2xl border border-cultured rounded-2xl shadow-2xl overflow-hidden z-10 transition-all duration-300 scale-100 animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-cultured px-6 py-4 bg-white/50">
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
                setSuccess(null);
                setShowForgotHelp(false);
              }}
              className={`text-sm font-extrabold tracking-wider uppercase transition-colors border-none bg-transparent cursor-pointer relative pb-1 ${
                mode === "login"
                  ? "text-salmon-pink after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-salmon-pink"
                  : "text-sonic-silver hover:text-eerie-black"
              }`}
            >
              {t("login_title", lang)}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setError(null);
                setSuccess(null);
                setShowForgotHelp(false);
              }}
              className={`text-sm font-extrabold tracking-wider uppercase transition-colors border-none bg-transparent cursor-pointer relative pb-1 ${
                mode === "register"
                  ? "text-salmon-pink after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-salmon-pink"
                  : "text-sonic-silver hover:text-eerie-black"
              }`}
            >
              {t("register_title", lang)}
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close_modal", lang)}
            className="p-1 hover:bg-cultured rounded-full text-sonic-silver hover:text-eerie-black transition-colors cursor-pointer border-none bg-transparent"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="px-6 py-6 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 rounded-xl p-3 text-xs font-semibold animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 flex items-center gap-2 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-xl p-3 text-xs font-semibold">
              <Check className="w-4 h-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {mode === "complete_phone" && (
            <form onSubmit={handleCompletePhone} className="space-y-4">
              <div className="flex flex-col items-center text-center gap-2 pb-1">
                <div className="w-11 h-11 rounded-full bg-salmon-pink/10 text-salmon-pink flex items-center justify-center">
                  <Phone className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-extrabold text-eerie-black">
                  {t("phone_complete_title", lang)}
                </h3>
                <p className="text-xs font-semibold text-sonic-silver leading-relaxed">
                  {t("phone_complete_desc", lang)}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-eerie-black uppercase tracking-wider mb-2">
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
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 bg-cultured border border-cultured rounded-xl text-xs sm:text-sm font-semibold text-onyx placeholder-spanish-gray focus:outline-none focus:border-salmon-pink focus:bg-white transition-all duration-200"
                      placeholder={getLocalPhonePlaceholder(dialCode)}
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-eerie-black hover:bg-salmon-pink text-white rounded-xl text-xs font-extrabold uppercase tracking-widest transition-all duration-200 cursor-pointer shadow-md disabled:bg-spanish-gray select-none active:scale-[0.98]"
              >
                {loading ? t("logging_in", lang) : t("save_and_continue", lang)}
              </button>
            </form>
          )}

          {mode === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Honeypot field to catch spam bots */}
              <div className="hidden" aria-hidden="true" style={{ display: "none" }}>
                <input
                  type="text"
                  name="website_hp"
                  value={websiteHp}
                  onChange={(e) => setWebsiteHp(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-eerie-black uppercase tracking-wider mb-2">
                  {t("email_label", lang)}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-spanish-gray">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-cultured border border-cultured rounded-xl text-xs sm:text-sm font-semibold text-onyx placeholder-spanish-gray focus:outline-none focus:border-salmon-pink focus:bg-white transition-all duration-200"
                    placeholder={t("email_placeholder", lang)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-eerie-black uppercase tracking-wider mb-2">
                  {t("password_label", lang)}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-spanish-gray">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-cultured border border-cultured rounded-xl text-xs sm:text-sm font-semibold text-onyx placeholder-spanish-gray focus:outline-none focus:border-salmon-pink focus:bg-white transition-all duration-200"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs font-bold text-sonic-silver">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded text-salmon-pink focus:ring-salmon-pink"
                  />
                  <span>{t("remember_me", lang)}</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotHelp((prev) => !prev)}
                  className="hover:text-salmon-pink transition-colors bg-transparent border-none p-0 cursor-pointer text-xs font-bold text-sonic-silver"
                >
                  {t("forgot_password", lang)}
                </button>
              </div>

              {showForgotHelp && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-950 flex flex-col gap-2">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="font-semibold leading-relaxed">
                      {t("forgot_password_guide", lang)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between pl-6 pt-1">
                    <Link
                      href={`/${getCategoryPrefix(lang)}/contact`}
                      onClick={onClose}
                      className="text-xs font-extrabold text-salmon-pink hover:text-eerie-black underline transition-colors"
                    >
                      {t("forgot_password_contact_support", lang)}
                    </Link>
                    <button
                      type="button"
                      onClick={() => setShowForgotHelp(false)}
                      className="text-[11px] font-bold text-amber-800 hover:text-amber-950 bg-transparent border-none p-0 cursor-pointer"
                    >
                      {t("close", lang)}
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-eerie-black hover:bg-salmon-pink text-white rounded-xl text-xs font-extrabold uppercase tracking-widest transition-all duration-200 cursor-pointer shadow-md disabled:bg-spanish-gray select-none active:scale-[0.98]"
              >
                {loading ? t("logging_in", lang) : t("login_title", lang)}
              </button>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-cultured"></div>
                <span className="flex-shrink mx-4 text-[10px] font-bold text-sonic-silver uppercase tracking-wider">
                  {t("or", lang)}
                </span>
                <div className="flex-grow border-t border-cultured"></div>
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full py-3 bg-white hover:bg-cultured text-onyx border border-cultured rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer shadow-sm flex items-center justify-center gap-2 select-none active:scale-[0.98]"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.69a5.74 5.74 0 0 1-2.48 3.77v3.13h3.99c2.34-2.16 3.68-5.32 3.68-8.75z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.97-1.08 7.96-2.91l-3.99-3.13a7.18 7.18 0 0 1-10.82-3.77H1.03v3.23A11.99 11.99 0 0 0 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.15 14.19a7.23 7.23 0 0 1 0-4.38V6.58H1.03a11.99 11.99 0 0 0 0 10.84l4.12-3.23z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42A11.92 11.92 0 0 0 12 0 11.99 11.99 0 0 0 1.03 6.58l4.12 3.23c.96-2.89 3.66-5.06 6.85-5.06z"
                  />
                </svg>
                <span>{t("sign_in_with_google", lang)}</span>
              </button>

              <div className="pt-3 text-center border-t border-cultured mt-3">
                <Link
                  href={
                    normalizeLangCode(lang) === "tr"
                      ? "/supplier/login"
                      : `/supplier/login?lang=${normalizeLangCode(lang)}`
                  }
                  onClick={onClose}
                  className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-amber-700 hover:text-amber-900 transition-colors"
                >
                  <Building2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>{t("are_you_supplier", lang)}</span>
                </Link>
              </div>
            </form>
          )}

          {mode === "register" && (
            <form onSubmit={handleRegister} className="space-y-4">
              {/* Honeypot field to catch spam bots */}
              <div className="hidden" aria-hidden="true" style={{ display: "none" }}>
                <input
                  type="text"
                  name="website_hp"
                  value={websiteHp}
                  onChange={(e) => setWebsiteHp(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-eerie-black uppercase tracking-wider mb-2">
                    {t("first_name_label", lang)}
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-spanish-gray">
                      <User className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-cultured border border-cultured rounded-xl text-xs sm:text-sm font-semibold text-onyx placeholder-spanish-gray focus:outline-none focus:border-salmon-pink focus:bg-white transition-all duration-200"
                      placeholder={t("first_name_placeholder", lang)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-eerie-black uppercase tracking-wider mb-2">
                    {t("last_name_label", lang)}
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-spanish-gray">
                      <User className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-cultured border border-cultured rounded-xl text-xs sm:text-sm font-semibold text-onyx placeholder-spanish-gray focus:outline-none focus:border-salmon-pink focus:bg-white transition-all duration-200"
                      placeholder={t("last_name_placeholder", lang)}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-eerie-black uppercase tracking-wider mb-2">
                  {t("email_label", lang)}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-spanish-gray">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-cultured border border-cultured rounded-xl text-xs sm:text-sm font-semibold text-onyx placeholder-spanish-gray focus:outline-none focus:border-salmon-pink focus:bg-white transition-all duration-200"
                    placeholder={t("email_placeholder", lang)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-eerie-black uppercase tracking-wider mb-2">
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
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 bg-cultured border border-cultured rounded-xl text-xs sm:text-sm font-semibold text-onyx placeholder-spanish-gray focus:outline-none focus:border-salmon-pink focus:bg-white transition-all duration-200"
                      placeholder={getLocalPhonePlaceholder(dialCode)}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-eerie-black uppercase tracking-wider mb-2">
                  {t("password_label", lang)}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-spanish-gray">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-cultured border border-cultured rounded-xl text-xs sm:text-sm font-semibold text-onyx placeholder-spanish-gray focus:outline-none focus:border-salmon-pink focus:bg-white transition-all duration-200"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-eerie-black uppercase tracking-wider mb-2">
                  {t("confirm_password_label", lang)}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-spanish-gray">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-cultured border border-cultured rounded-xl text-xs sm:text-sm font-semibold text-onyx placeholder-spanish-gray focus:outline-none focus:border-salmon-pink focus:bg-white transition-all duration-200"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="flex items-start text-[11px] font-bold text-sonic-silver leading-relaxed">
                <label className="flex items-start gap-2 cursor-pointer mt-0.5">
                  <input
                    type="checkbox"
                    required
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="rounded text-salmon-pink focus:ring-salmon-pink mt-0.5 shrink-0"
                  />
                  <span>
                    {getAuthLegalCopy(lang).prefix}{" "}
                    <a
                      href={`/${getCategoryPrefix(lang)}/pages/kullanici-sozlesmesi`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-salmon-pink underline hover:text-eerie-black transition-colors"
                    >
                      {getAuthLegalCopy(lang).termsLinkLabel}
                    </a>{" "}
                    {getAuthLegalCopy(lang).middleAnd}{" "}
                    <a
                      href={`/${getCategoryPrefix(lang)}/pages/yer-saglayici-bildirimi`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-salmon-pink underline hover:text-eerie-black transition-colors"
                    >
                      {getAuthLegalCopy(lang).hostingLinkLabel}
                    </a>{" "}
                    {getAuthLegalCopy(lang).suffix}
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-eerie-black hover:bg-salmon-pink text-white rounded-xl text-xs font-extrabold uppercase tracking-widest transition-all duration-200 cursor-pointer shadow-md disabled:bg-spanish-gray select-none active:scale-[0.98]"
              >
                {loading ? t("registering", lang) : t("register_title", lang)}
              </button>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-cultured"></div>
                <span className="flex-shrink mx-4 text-[10px] font-bold text-sonic-silver uppercase tracking-wider">
                  {t("or", lang)}
                </span>
                <div className="flex-grow border-t border-cultured"></div>
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full py-3 bg-white hover:bg-cultured text-onyx border border-cultured rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer shadow-sm flex items-center justify-center gap-2 select-none active:scale-[0.98]"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.69a5.74 5.74 0 0 1-2.48 3.77v3.13h3.99c2.34-2.16 3.68-5.32 3.68-8.75z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.97-1.08 7.96-2.91l-3.99-3.13a7.18 7.18 0 0 1-10.82-3.77H1.03v3.23A11.99 11.99 0 0 0 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.15 14.19a7.23 7.23 0 0 1 0-4.38V6.58H1.03a11.99 11.99 0 0 0 0 10.84l4.12-3.23z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42A11.92 11.92 0 0 0 12 0 11.99 11.99 0 0 0 1.03 6.58l4.12 3.23c.96-2.89 3.66-5.06 6.85-5.06z"
                  />
                </svg>
                <span>{t("sign_up_with_google", lang)}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
