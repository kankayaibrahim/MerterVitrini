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
  EyeOff 
} from "lucide-react";

export default function SupplierLoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [codeExchanging, setCodeExchanging] = useState(false);
  const codeHandledRef = useRef(false);

  // If a legacy / SSO authorization code is passed in URL, handle it silently
  useEffect(() => {
    if (!code || codeHandledRef.current) return;
    codeHandledRef.current = true;
    setCodeExchanging(true);
    setError(null);

    const exchangeCode = async () => {
      try {
        const redirectUri = typeof window !== "undefined"
          ? `${window.location.origin}/supplier/login`
          : "https://mertervitrini.com.tr/supplier/login";

        const res = await fetch("/api/v1/auth/keycloak-callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, redirect_uri: redirectUri }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Giriş oturumu doğrulanamadı.");
        }

        if (data.token) {
          localStorage.setItem("supplier_token", data.token);
          if (data.user) {
            localStorage.setItem("supplier_user", JSON.stringify(data.user));
          }
          router.replace("/supplier");
        } else {
          throw new Error("Geçersiz sunucu yanıtı.");
        }
      } catch (err: unknown) {
        setError((err as Error).message || "Oturum açılırken bir hata oluştu.");
        setCodeExchanging(false);
      } finally {
        if (typeof window !== "undefined") {
          window.history.replaceState({}, "", window.location.pathname);
        }
      }
    };

    void exchangeCode();
  }, [code, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setError("Lütfen kurumsal e-posta adresinizi ve şifrenizi giriniz.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/supplier/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, password }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "E-posta veya şifre hatalı.");
      }

      if (data.token) {
        localStorage.setItem("supplier_token", data.token);
        if (data.user) {
          localStorage.setItem("supplier_user", JSON.stringify(data.user));
        }
        router.replace("/supplier");
      } else {
        throw new Error("Sunucudan geçerli bir oturum anahtarı alınamadı.");
      }
    } catch (err: unknown) {
      setError((err as Error).message || "Giriş yapılırken bir hata oluştu.");
    } finally {
      setLoading(false);
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
        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-xl shadow-slate-200/60 relative overflow-hidden">
          
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-600 mx-auto mb-5 shadow-sm">
            <Building2 size={30} className="text-slate-900" />
          </div>

          <h1 className="text-2xl font-black text-slate-900 tracking-tight text-center">
            Tedarikçi Girişi
          </h1>

          <p className="text-xs text-slate-500 mt-2 mb-6 leading-relaxed text-center">
            Ürünlerinizi, stoklarınızı, siparişlerinizi ve toptan müşteri mesajlarınızı yönetmek için giriş yapınız.
          </p>

          {codeExchanging ? (
            <div className="py-8 text-center space-y-3">
              <Loader2 size={28} className="animate-spin text-slate-900 mx-auto" />
              <p className="text-xs font-semibold text-slate-600">
                Oturumunuz doğrulanıyor, yönlendiriliyorsunuz...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-left flex items-start gap-2.5 shadow-sm animate-in fade-in duration-200">
                  <AlertCircle size={18} className="flex-shrink-0 mt-0.5 text-rose-600" />
                  <div className="text-xs font-semibold leading-relaxed text-rose-800">
                    {error}
                  </div>
                </div>
              )}

              {/* Email Field */}
              <div className="space-y-1.5 text-left">
                <label htmlFor="supplier-email" className="text-xs font-bold text-slate-700 block">
                  Kurumsal E-Posta
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="supplier-email"
                    type="email"
                    required
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ornek@tedarikci.com"
                    className="w-full h-11 pl-10 pr-3.5 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-1.5 text-left">
                <div className="flex items-center justify-between">
                  <label htmlFor="supplier-password" className="text-xs font-bold text-slate-700 block">
                    Şifre
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Şifrenizi unuttuysanız yöneticinizle görüşün
                  </span>
                </div>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="supplier-password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-11 pl-10 pr-10 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 mt-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-[0.99]"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin text-white" />
                    <span>Giriş Yapılıyor...</span>
                  </>
                ) : (
                  <>
                    <span>Tedarikçi Paneline Giriş Yap</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          )}

          <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col items-center gap-3">
            <Link
              href="/tedarikci-basvuru"
              className="text-xs font-semibold text-amber-700 hover:text-amber-800 hover:underline transition-colors"
            >
              Henüz tedarikçimiz değil misiniz? Başvuru Yapın →
            </Link>

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
              <ShieldCheck size={13} className="text-emerald-600" />
              <span>Güvenli 256-Bit SSL Şifreli Giriş</span>
            </div>
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
