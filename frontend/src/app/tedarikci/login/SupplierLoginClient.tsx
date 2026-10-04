"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  Building2, 
  Lock, 
  Mail, 
  ArrowRight, 
  AlertCircle,
  HelpCircle
} from "lucide-react";

export default function SupplierLoginClient() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Lütfen e-posta ve şifrenizi girin.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/v1/supplier/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Giriş yapılamadı. Lütfen bilgilerinizi kontrol edin.");
      }

      if (data.token) {
        localStorage.setItem("supplier_token", data.token);
        if (data.user) {
          localStorage.setItem("supplier_user", JSON.stringify(data.user));
        }
        router.push("/tedarikci");
      } else {
        throw new Error("Geçersiz sunucu yanıtı.");
      }
    } catch (err: unknown) {
      setError((err as Error).message || "Giriş sırasında bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-indigo-950 text-white flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Top Brand Bar */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between py-2">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
            <Building2 size={20} />
          </div>
          <div className="flex flex-col">
            <span className="font-black text-sm tracking-wider uppercase text-white">MERTER VİTRİNİ</span>
            <span className="text-[10px] tracking-widest uppercase text-amber-400 font-bold -mt-0.5">Tedarikçi Portalı</span>
          </div>
        </Link>

        <Link 
          href="/" 
          className="text-xs text-zinc-400 hover:text-white transition-colors"
        >
          Mağazaya Dön →
        </Link>
      </header>

      {/* Main Login Card */}
      <main className="max-w-md w-full mx-auto my-auto py-10">
        <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          {/* Subtle glow background */}
          <div className="absolute -right-16 -top-16 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-16 -bottom-16 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Card Header */}
          <div className="text-center mb-8 relative">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto mb-4 shadow-inner">
              <Building2 size={28} />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Tedarikçi Girişi
            </h1>
            <p className="text-xs text-zinc-400 mt-2">
              Kataloğunuzu yönetmek, toptan yeni ürünler eklemek ve stoklarınızı güncellemek için giriş yapın.
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs font-medium flex items-start gap-2.5 animate-in fade-in duration-200">
              <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 relative">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                <Mail size={13} className="text-zinc-500" />
                Kayıtlı E-Posta Adresi
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tedarikci@firma.com"
                className="w-full px-4 py-3 rounded-xl bg-zinc-950/60 border border-zinc-800 text-white placeholder-zinc-500 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50 transition-all font-mono"
                required
                autoComplete="email"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                <Lock size={13} className="text-zinc-500" />
                Şifre
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl bg-zinc-950/60 border border-zinc-800 text-white placeholder-zinc-500 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50 transition-all"
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-3 w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 text-xs font-black tracking-wide shadow-lg shadow-amber-500/10 hover:shadow-amber-500/20 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                  <span>Giriş Yapılıyor...</span>
                </>
              ) : (
                <>
                  <span>Panele Giriş Yap</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          {/* Help box */}
          <div className="mt-8 pt-6 border-t border-zinc-800/80 flex items-start gap-2.5 text-[11px] text-zinc-400 leading-relaxed">
            <HelpCircle size={15} className="text-amber-400 shrink-0 mt-0.5" />
            <span>
              Tedarikçi hesabı tanımlamaları ve şifre sıfırlama işlemleri Merter Vitrini yönetimi tarafından yapılmaktadır. Giriş yapamıyorsanız sistem yöneticisiyle iletişime geçiniz.
            </span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl w-full mx-auto text-center py-4 text-[11px] text-zinc-500">
        © {new Date().getFullYear()} Merter Vitrini • B2B Toptan Tedarikçi Entegrasyon Sistemi
      </footer>
    </div>
  );
}
