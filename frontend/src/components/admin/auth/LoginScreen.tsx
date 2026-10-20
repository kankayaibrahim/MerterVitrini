import { useState } from "react";
import Link from "next/link";
import { ShieldCheck, AlertCircle, RefreshCw, LogIn } from "lucide-react";

// Localized labels dictionary to prevent JSX literal internationalization warnings
const LABELS = {
  welcomeBack: "Hoş Geldiniz",
  subtitle: "Merter Vitrini Yönetim Paneli",
  loginButton: "Keycloak ile Giriş Yap",
  loadingButton: "Keycloak Servisine Yönlendiriliyor...",
  systemSlogan: "Merter Vitrini Entegrasyon Suite",
  logoText: "MV",
  secureNotice: "Oturum açma ve yetkilendirme işlemleri Keycloak kurumsal IAM altyapısı ile güvence altına alınmıştır.",
  mfaNotice: "MFA & SSO Korumalı Giriş"
};

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keycloak OIDC Configurations (with custom env support and hardcoded production fallbacks)
  const KEYCLOAK_URL = process.env.NEXT_PUBLIC_KEYCLOAK_URL || "https://auth.mertervitrini.com.tr";
  const KEYCLOAK_REALM = process.env.NEXT_PUBLIC_KEYCLOAK_REALM || "merter";
  const KEYCLOAK_CLIENT_ID = process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || "admin-client";

  const handleKeycloakRedirect = () => {
    try {
      setError(null);
      setLoading(true);

      // Construct OIDC Authorization flow parameters
      // Automatically detect absolute frontend browser origin to form redirect_uri to /admin
      const redirectUri = encodeURIComponent(window.location.origin + "/admin");
      const authUrl = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/auth` +
        `?client_id=${KEYCLOAK_CLIENT_ID}` +
        `&redirect_uri=${redirectUri}` +
        `&response_type=code` +
        `&scope=openid+profile+email`;

      // Redirect the browser window to Keycloak OIDC Login page
      window.location.href = authUrl;
    } catch (err: unknown) {
      setLoading(false);
      setError((err as Error).message || "OIDC yönlendirmesi sırasında beklenmeyen bir hata oluştu.");
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-radial from-zinc-900 via-zinc-950 to-black p-4 font-sans text-zinc-100 antialiased overflow-hidden relative">
      
      {/* Decorative Blur Orbs */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[450px] h-[450px] rounded-full bg-sky-600/10 blur-[150px] pointer-events-none" />
      
      {/* Grid Pattern Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      {/* Login Card */}
      <div className="w-full max-w-md bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 p-8 sm:p-10 rounded-3xl shadow-2xl flex flex-col gap-8 relative z-10 animate-in fade-in zoom-in-95 duration-300">
        
        {/* Logo and Slogans */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-violet-600 to-fuchsia-600 flex items-center justify-center text-white shadow-lg shadow-violet-500/20 font-black text-2xl">
            {LABELS.logoText}
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-white">{LABELS.welcomeBack}</h2>
            <p className="text-xs font-semibold text-zinc-500 mt-1">{LABELS.subtitle}</p>
          </div>
        </div>

        {/* Error Alert Box */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold flex items-start gap-3 animate-in slide-in-from-top-2 duration-200">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Secure Message and Keycloak CTA Button */}
        <div className="flex flex-col gap-6">
          <p className="text-zinc-400 text-xs font-medium leading-relaxed text-center px-2">
            {LABELS.secureNotice}
          </p>

          <button
            type="button"
            disabled={loading}
            onClick={handleKeycloakRedirect}
            className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold py-4 px-4 rounded-2xl text-sm transition-all shadow-lg shadow-violet-600/15 active:scale-98 flex items-center justify-center gap-3.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {loading ? (
              <>
                <RefreshCw size={18} className="animate-spin" />
                <span>{LABELS.loadingButton}</span>
              </>
            ) : (
              <>
                <LogIn size={18} />
                <span>{LABELS.loginButton}</span>
              </>
            )}
          </button>

          <div className="flex items-center justify-center gap-2 text-[10px] font-semibold text-zinc-500 mt-2">
            <ShieldCheck size={14} className="text-emerald-500" />
            <span>{LABELS.mfaNotice}</span>
          </div>

          <div className="flex items-center justify-center pt-2">
            <Link
              href="/"
              className="text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              ← Mağaza Vitrini
            </Link>
          </div>
        </div>

        {/* Footer Brand Slogan */}
        <div className="text-center text-[10px] text-zinc-600 font-bold uppercase tracking-widest border-t border-zinc-800/40 pt-6">
          {LABELS.systemSlogan}
        </div>

      </div>
    </main>
  );
}

