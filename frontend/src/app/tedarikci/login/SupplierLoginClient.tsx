"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Building2, ShieldCheck, ArrowRight, Loader2, AlertCircle } from "lucide-react";

export default function SupplierLoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const redirectedRef = useRef(false);

  const KEYCLOAK_URL = process.env.NEXT_PUBLIC_KEYCLOAK_URL || "https://auth.mertervitrini.com.tr";
  const KEYCLOAK_REALM = process.env.NEXT_PUBLIC_KEYCLOAK_REALM || "merter";
  const KEYCLOAK_CLIENT_ID = process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || "admin-client";

  const getRedirectUri = useCallback(() => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/tedarikci/login`;
    }
    return "https://mertervitrini.com.tr/tedarikci/login";
  }, []);

  const getAuthUrl = useCallback(() => {
    const redirectUri = getRedirectUri();
    let currentLocale = "tr";
    if (typeof window !== "undefined") {
      const savedLang = localStorage.getItem("merter_lang");
      if (savedLang) currentLocale = savedLang;
      const paramLocale = searchParams.get("kc_locale") || searchParams.get("locale") || searchParams.get("lang");
      if (paramLocale) currentLocale = paramLocale;
    }

    return `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/auth` +
      `?client_id=${KEYCLOAK_CLIENT_ID}` +
      `&response_type=code` +
      `&scope=openid%20profile%20email` +
      `&kc_locale=${encodeURIComponent(currentLocale)}` +
      `&ui_locales=${encodeURIComponent(currentLocale)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}`;
  }, [KEYCLOAK_URL, KEYCLOAK_REALM, KEYCLOAK_CLIENT_ID, getRedirectUri, searchParams]);

  // 1. Handle Keycloak Authorization Code Callback
  useEffect(() => {
    if (!code) return;
    if (redirectedRef.current) return;
    redirectedRef.current = true;

    setProcessing(true);
    setError(null);

    const exchangeCode = async () => {
      try {
        const redirectUri = getRedirectUri();
        const res = await fetch("/api/v1/auth/keycloak-callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            redirect_uri: redirectUri,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Keycloak oturumu onaylanamadı.");
        }

        const data = await res.json();
        if (data.token) {
          localStorage.setItem("supplier_token", data.token);
          if (data.user) {
            localStorage.setItem("supplier_user", JSON.stringify(data.user));
          }
          router.replace("/tedarikci");
        } else {
          throw new Error("Geçersiz sunucu yanıtı.");
        }
      } catch (err: unknown) {
        setError((err as Error).message || "Oturum açılırken bir hata oluştu.");
        setProcessing(false);
      }
    };

    void exchangeCode();
  }, [code, router, getRedirectUri]);

  // 2. If no code, auto-redirect to Keycloak
  useEffect(() => {
    if (code) return;
    if (redirectedRef.current) return;

    const timer = setTimeout(() => {
      if (typeof window !== "undefined" && !redirectedRef.current) {
        redirectedRef.current = true;
        window.location.href = getAuthUrl();
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [code, getAuthUrl]);

  const handleManualRedirect = () => {
    if (typeof window !== "undefined") {
      window.location.href = getAuthUrl();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 text-slate-900 flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Brand Header */}
      <header className="max-w-4xl w-full mx-auto flex items-center justify-between py-2">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center font-black shadow-md group-hover:scale-105 transition-transform">
            <Building2 size={20} />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-sm tracking-wider uppercase text-slate-900">MERTER VİTRİNİ</span>
            <span className="text-[10px] tracking-widest uppercase text-amber-600 font-bold -mt-0.5">Tedarikçi Portalı</span>
          </div>
        </Link>
        <Link href="/" className="text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors">
          Mağaza Vitrini →
        </Link>
      </header>

      {/* Main Card */}
      <main className="max-w-md w-full mx-auto my-auto py-8">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-xl shadow-slate-200/60 text-center relative overflow-hidden">
          
          <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-900 mx-auto mb-5 shadow-sm">
            <ShieldCheck size={32} className="text-slate-900" />
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {code ? "Oturum Doğrulanıyor..." : "Tedarikçi Girişi"}
          </h1>

          <p className="text-xs text-slate-500 mt-2 mb-6 leading-relaxed">
            {code
              ? "Keycloak kimlik doğrulama yanıtı işleniyor, lütfen bekleyin..."
              : "Keycloak 26 kurumsal IAM altyapısına yönlendiriliyorsunuz. Oturum açarak ürünlerinizi ve siparişlerinizi yönetebilirsiniz."}
          </p>

          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs text-left flex items-start gap-2.5">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5 text-red-600" />
              <div className="flex-1">{error}</div>
            </div>
          )}

          {/* Loading or Manual Button */}
          {processing || !error ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-2.5 py-3 text-sm font-semibold text-slate-600">
                <Loader2 size={18} className="animate-spin text-slate-900" />
                <span>{code ? "Tedarikçi Paneline Bağlanılıyor..." : "Keycloak Servisine Aktarılıyor..."}</span>
              </div>
              <button
                type="button"
                onClick={handleManualRedirect}
                className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow"
              >
                <span>Otomatik Yönlenmediyse Tıklayın</span>
                <ArrowRight size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleManualRedirect}
              className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
            >
              <span>Keycloak ile Giriş Yap</span>
              <ArrowRight size={16} />
            </button>
          )}

          <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck size={13} className="text-emerald-600" />
            <span>Keycloak 26 Kurumsal IAM Korumalı</span>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-4xl w-full mx-auto text-center py-2 text-xs text-slate-400">
        © 2026 Merter Vitrini B2B E-Ticaret Platformu. Tüm hakları saklıdır.
      </footer>
    </div>
  );
}
