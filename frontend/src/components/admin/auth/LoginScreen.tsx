"use client";

import { useState } from "react";
import Link from "next/link";
import { ShieldCheck, AlertCircle, RefreshCw, LogIn, LogOut, Building2 } from "lucide-react";
import { normalizeCanonicalAdminUrl } from "@/services/admin-api.service";
import { useAdminAuth } from "@/context/AdminContext";

const LABELS = {
  eyebrow: "KURUMSAL YÖNETİM PANELİ",
  welcomeBack: "Merter Vitrini B2B",
  subtitle: "Toptan Katalog, Sipariş ve Tedarikçi Komuta Merkezi",
  loginButton: "Keycloak Kurumsal Kimlik ile Giriş Yap",
  loadingButton: "Keycloak Servisine Yönlendiriliyor...",
  switchSessionButton: "Farklı / Yönetici Hesabıyla Giriş Yap (SSO Oturumunu Değiştir)",
  clearAndSwitchButton: "Mevcut Oturumu Kapat ve Yönetici Hesabıyla Giriş Yap",
  privilegeDeniedTitle: "Bu hesapta yönetici yetkisi bulunmuyor",
  privilegeDeniedDesc:
    "Tarayıcınızda aktif bir müşteri/vitrin Keycloak oturumu açık olduğu için SSO otomatik olarak o hesabı doğruladı. Yönetici hesabınızla (admin@...) giriş yapmak için mevcut oturumu kapatıp yeniden giriş yapın.",
  systemSlogan: "KURUMSAL YÖNETİM PANELİ • MERTER VİTRİNİ",
  logoText: "MV",
  secureNotice:
    "Oturum açma ve yetkilendirme işlemleri Keycloak kurumsal kimlik doğrulama (IAM) altyapısı ile güvence altına alınmıştır.",
  mfaNotice: "Kurumsal SSO & Rol Tabanlı Erişim Koruması",
};

function isAdminPrivilegeDeniedError(message: string | null): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return lower.includes("admin privileges") || lower.includes("forbidden");
}

export default function LoginScreen() {
  const { authError, clearAuthError, handleLogout } = useAdminAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const KEYCLOAK_URL =
    process.env.NEXT_PUBLIC_KEYCLOAK_URL || "https://auth.mertervitrini.com.tr";
  const KEYCLOAK_REALM = process.env.NEXT_PUBLIC_KEYCLOAK_REALM || "merter";
  const KEYCLOAK_CLIENT_ID =
    process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || "admin-client";

  const handleKeycloakRedirect = () => {
    try {
      setError(null);
      clearAuthError();
      setLoading(true);

      const canonicalAdminTarget = normalizeCanonicalAdminUrl(
        `${window.location.origin}/admin`
      );
      const redirectUri = encodeURIComponent(canonicalAdminTarget);
      const authUrl =
        `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/auth` +
        `?client_id=${KEYCLOAK_CLIENT_ID}` +
        `&redirect_uri=${redirectUri}` +
        `&response_type=code` +
        `&scope=openid+profile+email`;

      window.location.href = authUrl;
    } catch (err: unknown) {
      setLoading(false);
      setError(
        err instanceof Error && err.message
          ? err.message
          : "OIDC yönlendirmesi sırasında beklenmeyen bir hata oluştu."
      );
    }
  };

  const displayError = error || authError;
  const isPrivilegeDenied = isAdminPrivilegeDeniedError(displayError);

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#F8FAFC] p-4 font-sans text-[#0F172A] antialiased overflow-hidden relative">
      {/* Subtle Executive Ambient Accents (Slate-Navy + Warm Champagne-Bronze) */}
      <div className="absolute top-0 left-1/4 -translate-x-1/2 w-[480px] h-[480px] rounded-full bg-[#8C6D3F]/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 translate-x-1/2 w-[520px] h-[520px] rounded-full bg-[#0F172A]/8 blur-[140px] pointer-events-none" />

      {/* Architectural Grid Texture */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.03)_1px,transparent_1px)] bg-[size:28px_28px] pointer-events-none" />

      {/* Executive Login Card */}
      <div className="w-full max-w-md bg-white border border-slate-200/90 p-8 sm:p-10 rounded-3xl shadow-xl shadow-slate-900/5 flex flex-col gap-7 relative z-10 animate-in fade-in zoom-in-95 duration-300">
        {/* Brand Emblem & Header */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#0F172A] border-2 border-[#8C6D3F]/60 flex items-center justify-center text-[#F3E2C7] shadow-lg shadow-slate-900/15 font-black text-2xl">
            {LABELS.logoText}
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#8C6D3F]/10 border border-[#8C6D3F]/30 text-[#8C6D3F] text-[10px] font-extrabold tracking-widest">
            <Building2 size={12} />
            <span>{LABELS.eyebrow}</span>
          </span>

          <div>
            <h1 className="text-2xl font-black tracking-tight text-[#0F172A]">
              {LABELS.welcomeBack}
            </h1>
            <p className="text-xs font-semibold text-slate-500 mt-1">
              {LABELS.subtitle}
            </p>
          </div>
        </div>

        {/* Error Alert Box */}
        {displayError && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex flex-col gap-3 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-start gap-3">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-600" />
              <div className="space-y-1">
                {isPrivilegeDenied ? (
                  <>
                    <p className="font-extrabold text-rose-900 m-0">
                      {LABELS.privilegeDeniedTitle}
                    </p>
                    <p className="leading-relaxed text-rose-700 m-0">
                      {LABELS.privilegeDeniedDesc}
                    </p>
                  </>
                ) : (
                  <span>{displayError}</span>
                )}
              </div>
            </div>
            {isPrivilegeDenied && (
              <button
                type="button"
                onClick={handleLogout}
                className="w-full bg-rose-700 hover:bg-rose-800 text-white font-bold py-2.5 px-3.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer border-none"
              >
                <LogOut size={14} />
                <span>{LABELS.clearAndSwitchButton}</span>
              </button>
            )}
          </div>
        )}

        {/* Secure Notice & Primary Executive CTA */}
        <div className="flex flex-col gap-5">
          <p className="text-slate-600 text-xs font-medium leading-relaxed text-center px-2">
            {LABELS.secureNotice}
          </p>

          <button
            type="button"
            disabled={loading}
            onClick={handleKeycloakRedirect}
            className="w-full bg-[#0F172A] hover:bg-slate-800 text-white font-bold py-4 px-5 rounded-2xl text-sm transition-all shadow-md shadow-slate-900/15 active:scale-[0.99] flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border border-[#8C6D3F]/30"
          >
            {loading ? (
              <>
                <RefreshCw size={18} className="animate-spin text-[#D4AF7A]" />
                <span>{LABELS.loadingButton}</span>
              </>
            ) : (
              <>
                <LogIn size={18} className="text-[#D4AF7A]" />
                <span>{LABELS.loginButton}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full bg-slate-100 hover:bg-slate-200/80 text-slate-700 font-bold py-2.5 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer border border-slate-200"
          >
            <LogOut size={14} className="text-slate-600 shrink-0" />
            <span>{LABELS.switchSessionButton}</span>
          </button>

          <div className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-emerald-50/80 border border-emerald-200/70 text-[11px] font-bold text-emerald-800">
            <ShieldCheck size={15} className="text-emerald-600 shrink-0" />
            <span>{LABELS.mfaNotice}</span>
          </div>

          <div className="flex items-center justify-center pt-1">
            <Link
              href="/"
              className="text-xs font-bold text-slate-600 hover:text-[#0F172A] transition-colors"
            >
              ← Mağaza Vitrinine Dön
            </Link>
          </div>
        </div>

        {/* Corporate Footer Strip */}
        <div className="text-center text-[10px] text-slate-400 font-bold tracking-widest border-t border-slate-100 pt-5">
          {LABELS.systemSlogan}
        </div>
      </div>
    </main>
  );
}
