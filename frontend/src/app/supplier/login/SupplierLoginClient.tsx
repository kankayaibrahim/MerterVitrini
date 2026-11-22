"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  ShieldCheck,
  ArrowRight,
  Loader2,
  AlertCircle,
  Mail,
  Lock,
  Eye,
  EyeOff,
  HelpCircle,
  MessageCircle,
} from "lucide-react";
import {
  SUPPORTED_SEO_LANGS,
  SupportedSeoLang,
  normalizeSeoLang,
} from "@/utils/seoHelpers";
import { SUPPLIER_LOGIN_COPY, SupplierLoginCopy } from "./translations";

interface LoginApiResponse {
  token?: string;
  user?: Record<string, unknown>;
  error?: string;
}

function persistSupplierLoginSession(
  token: string,
  user?: Record<string, unknown>
): void {
  localStorage.setItem("supplier_token", token);
  if (user) {
    localStorage.setItem("supplier_user", JSON.stringify(user));
  }
}

async function exchangeSupplierSsoCode(
  code: string,
  fallbackErr: string
): Promise<LoginApiResponse> {
  const redirectUri =
    typeof window !== "undefined"
      ? `${window.location.origin}/supplier/login`
      : "https://mertervitrini.com.tr/supplier/login";

  const res = await fetch("/api/v1/auth/keycloak-callback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, redirect_uri: redirectUri }),
  });

  const data = (await res.json().catch(() => ({}))) as LoginApiResponse;
  if (!res.ok || !data.token) {
    throw new Error(data.error || fallbackErr);
  }
  return data;
}

async function loginWithEmailAndPassword(
  email: string,
  password: string,
  fallbackErr: string
): Promise<LoginApiResponse> {
  const res = await fetch("/api/v1/supplier/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = (await res.json().catch(() => ({}))) as LoginApiResponse;
  if (!res.ok || !data.token) {
    throw new Error(data.error || fallbackErr);
  }
  return data;
}

function PasswordRecoveryHelpCard({
  email,
  copy,
}: Readonly<{ email: string; copy: SupplierLoginCopy }>) {
  const cleanEmail = email.trim();
  const mailSubject = encodeURIComponent(copy.recoveryMailSubject);
  const mailBody = encodeURIComponent(
    `${copy.recoveryMailBodyPrefix}${cleanEmail || copy.recoveryMailBodyDefaultEmail}${copy.recoveryMailBodySuffix}`
  );
  const waHref = `https://wa.me/905337030883?text=${encodeURIComponent(copy.whatsappPrefill)}`;

  return (
    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-start space-y-2.5 animate-in fade-in duration-150">
      <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
        <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
        <span>{copy.recoveryTitle}</span>
      </div>
      <p className="text-[11px] text-slate-600 leading-relaxed">{copy.recoveryDesc}</p>
      <div className="flex flex-wrap items-center gap-2 pt-0.5">
        <a
          href={`mailto:info@mertervitrini.com.tr?subject=${mailSubject}&body=${mailBody}`}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-[11px] font-bold transition-colors"
        >
          <Mail size={13} className="text-slate-700" />
          <span>info@mertervitrini.com.tr</span>
        </a>
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition-colors"
        >
          <MessageCircle size={13} />
          <span>{copy.whatsappSupportBtn}</span>
        </a>
      </div>
    </div>
  );
}

interface SupplierLoginClientProps {
  readonly initialLang?: SupportedSeoLang;
}

export default function SupplierLoginClient({
  initialLang = "tr",
}: SupplierLoginClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const queryLang = searchParams.get("lang");

  const [lang, setLang] = useState<SupportedSeoLang>(initialLang);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showRecoveryHelp, setShowRecoveryHelp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [codeExchanging, setCodeExchanging] = useState(false);
  const codeHandledRef = useRef(false);

  const safeLang = normalizeSeoLang(queryLang || lang, initialLang);
  const copy = SUPPLIER_LOGIN_COPY[safeLang];
  const isRtl = safeLang === "ar";

  useEffect(() => {
    if (!code || codeHandledRef.current) return;
    codeHandledRef.current = true;
    setCodeExchanging(true);
    setError(null);

    const runExchange = async () => {
      try {
        const data = await exchangeSupplierSsoCode(
          code,
          SUPPLIER_LOGIN_COPY[safeLang].errorSessionVerify
        );
        persistSupplierLoginSession(data.token!, data.user);
        router.replace("/supplier");
      } catch (err: unknown) {
        setError(
          (err as Error).message ||
            SUPPLIER_LOGIN_COPY[safeLang].errorGenericLogin
        );
        setCodeExchanging(false);
      } finally {
        if (typeof window !== "undefined") {
          window.history.replaceState({}, "", window.location.pathname);
        }
      }
    };

    void runExchange();
  }, [code, router, safeLang]);

  const handleLangSelect = (targetLang: SupportedSeoLang) => {
    setLang(targetLang);
    if (typeof window !== "undefined") {
      localStorage.setItem("preferred_lang", targetLang);
    }
    router.push(
      targetLang === "tr" ? "/supplier/login" : `/supplier/login?lang=${targetLang}`
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setError(copy.errorEmptyFields);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await loginWithEmailAndPassword(
        cleanEmail,
        password,
        copy.errorInvalidCredentials
      );
      persistSupplierLoginSession(data.token!, data.user);
      router.replace("/supplier");
    } catch (err: unknown) {
      setError((err as Error).message || copy.errorGenericLogin);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 text-slate-900 flex flex-col justify-between p-4 sm:p-6 lg:p-8"
    >
      {/* Brand Header */}
      <header className="max-w-4xl w-full mx-auto flex flex-wrap items-center justify-between gap-3 py-2">
        <Link href={`/${safeLang}`} className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black shadow-sm group-hover:bg-slate-800 transition-colors">
            <Building2 size={20} />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-sm tracking-wider uppercase text-slate-900">
              MERTER VİTRİNİ
            </span>
            <span className="text-[10px] tracking-widest uppercase text-emerald-700 font-bold -mt-0.5">
              {copy.portalSubtitle}
            </span>
          </div>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1">
            {SUPPORTED_SEO_LANGS.map((lCode) => (
              <button
                key={lCode}
                type="button"
                onClick={() => handleLangSelect(lCode)}
                className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase cursor-pointer border transition-colors ${
                  safeLang === lCode
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                }`}
              >
                {lCode}
              </button>
            ))}
          </div>

          <Link
            href={`/${safeLang}`}
            className="inline-flex items-center gap-1 h-9 px-3.5 rounded-lg bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-xs font-bold transition-colors"
          >
            <span>{copy.backToStore}</span>
            <ArrowRight size={13} className="rtl:rotate-180" />
          </Link>
        </div>
      </header>

      {/* Main Card */}
      <main className="max-w-md w-full mx-auto my-auto py-8">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-xl shadow-slate-200/60 relative overflow-hidden">
          <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center mx-auto mb-4 shadow-sm">
            <Building2 size={26} />
          </div>

          <div className="flex justify-center mb-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold">
              <ShieldCheck size={13} />
              <span>{copy.verifiedStudioBadge}</span>
            </span>
          </div>

          <h1 className="text-2xl font-black text-slate-900 tracking-tight text-center">
            {copy.heading}
          </h1>

          <p className="text-xs text-slate-500 mt-2 mb-6 leading-relaxed text-center">
            {copy.subtitle}
          </p>

          {codeExchanging ? (
            <div className="py-8 text-center space-y-3">
              <Loader2 size={28} className="animate-spin text-slate-900 mx-auto" />
              <p className="text-xs font-semibold text-slate-600">
                {copy.verifyingSession}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-start flex items-start gap-2.5 shadow-sm animate-in fade-in duration-200">
                  <AlertCircle size={18} className="shrink-0 mt-0.5 text-rose-600" />
                  <div className="text-xs font-semibold leading-relaxed text-rose-800">
                    {error}
                  </div>
                </div>
              )}

              {/* Email Field */}
              <div className="space-y-1.5 text-start">
                <label
                  htmlFor="supplier-email"
                  className="text-xs font-bold text-slate-700 block"
                >
                  {copy.emailLabel}
                </label>
                <div className="relative">
                  <Mail
                    size={16}
                    className="absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    id="supplier-email"
                    type="email"
                    required
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={copy.emailPlaceholder}
                    className="w-full h-11 ps-10 pe-3.5 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-1.5 text-start">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="supplier-password"
                    className="text-xs font-bold text-slate-700 block"
                  >
                    {copy.passwordLabel}
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowRecoveryHelp((prev) => !prev)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 underline underline-offset-2 transition-colors cursor-pointer bg-transparent border-none p-0"
                  >
                    <HelpCircle size={12} />
                    <span>{copy.forgotPasswordBtn}</span>
                  </button>
                </div>
                <div className="relative">
                  <Lock
                    size={16}
                    className="absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    id="supplier-password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-11 ps-10 pe-10 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    aria-label={
                      showPassword ? copy.hidePasswordAria : copy.showPasswordAria
                    }
                    className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer bg-transparent border-none p-0"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {showRecoveryHelp && (
                <PasswordRecoveryHelpCard email={email} copy={copy} />
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 mt-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow-md active:scale-[0.99] cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin text-white" />
                    <span>{copy.submittingBtn}</span>
                  </>
                ) : (
                  <>
                    <span>{copy.submitBtn}</span>
                    <ArrowRight size={16} className="rtl:rotate-180" />
                  </>
                )}
              </button>
            </form>
          )}

          <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col items-center gap-3">
            <Link
              href={`/${safeLang}/tedarikci-basvuru`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:underline transition-colors"
            >
              <span>{copy.notSupplierYet}</span>
              <ArrowRight size={12} className="rtl:rotate-180" />
            </Link>

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
              <ShieldCheck size={13} className="text-emerald-600" />
              <span>{copy.sslBadge}</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-4xl w-full mx-auto text-center py-2 text-xs text-slate-400">
        {copy.copyright}
      </footer>
    </div>
  );
}
