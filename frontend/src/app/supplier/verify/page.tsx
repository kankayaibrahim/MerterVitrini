"use client";

import React, { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, AlertTriangle, XCircle, Loader2, ArrowRight, Building2, ShieldCheck, Mail } from "lucide-react";

function VerifyContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [state, setState] = useState<{
    loading: boolean;
    status: "success" | "already_verified" | "expired" | "error" | "loading";
    message: string;
    companyName?: string;
    contactName?: string;
  }>({
    loading: true,
    status: "loading",
    message: "E-posta adresiniz doğrulanıyor, lütfen bekleyiniz...",
  });

  useEffect(() => {
    let isMounted = true;

    async function verify() {
      if (!token) {
        if (!isMounted) return;
        setState({
          loading: false,
          status: "error",
          message: "Doğrulama belirteci (token) eksik veya geçersiz bir bağlantı kullandınız.",
        });
        return;
      }

      try {
        const res = await fetch(`/api/v1/store/supplier-applications/verify?token=${encodeURIComponent(token!)}`);
        const data = await res.json().catch(() => ({}));

        if (!isMounted) return;

        if (res.status === 410) {
          setState({
            loading: false,
            status: "expired",
            message: data.error || "Doğrulama bağlantısının 30 dakikalık süresi dolmuştur. Başvurunuz güvenlik sebebiyle silinmiştir.",
          });
          return;
        }

        if (!res.ok) {
          setState({
            loading: false,
            status: "error",
            message: data.error || "Doğrulama işlemi gerçekleştirilemedi. Lütfen bağlantıyı kontrol ediniz.",
          });
          return;
        }

        if (data.already_verified) {
          setState({
            loading: false,
            status: "already_verified",
            message: data.message || "E-posta adresiniz daha önce başarıyla doğrulanmıştır.",
            companyName: data.company_name,
            contactName: data.contact_name,
          });
          return;
        }

        setState({
          loading: false,
          status: "success",
          message: data.message || "E-posta adresiniz başarıyla doğrulandı!",
          companyName: data.company_name,
          contactName: data.contact_name,
        });
      } catch (err: unknown) {
        if (!isMounted) return;
        setState({
          loading: false,
          status: "error",
          message: (err as Error).message || "Sunucuya bağlanırken bir hata oluştu.",
        });
      }
    }

    void verify();

    return () => {
      isMounted = false;
    };
  }, [token]);

  return (
    <div className="min-h-screen bg-linear-to-b from-zinc-50 via-white to-zinc-100 flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-lg bg-white rounded-3xl border border-zinc-200 shadow-xl p-8 sm:p-10 text-center relative overflow-hidden">
        {/* Top Accent bar */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-linear-to-r from-zinc-900 via-amber-500 to-emerald-500" />

        {/* Brand header */}
        <div className="mb-8">
          <Link href="/" className="inline-block">
            <span className="font-black text-2xl tracking-tighter text-zinc-950">MERTER VİTRİNİ</span>
          </Link>
          <p className="text-[11px] font-bold tracking-widest text-zinc-400 uppercase mt-1">
            Toptan Moda Tedarikçi Portalı
          </p>
        </div>

        {/* State: Loading */}
        {state.status === "loading" && (
          <div className="py-8">
            <div className="w-16 h-16 rounded-2xl bg-zinc-100 text-zinc-900 flex items-center justify-center mx-auto mb-4 animate-spin">
              <Loader2 size={32} />
            </div>
            <h1 className="text-xl font-black text-zinc-900">E-Posta Doğrulanıyor</h1>
            <p className="text-xs text-zinc-500 mt-2">{state.message}</p>
          </div>
        )}

        {/* State: Success */}
        {state.status === "success" && (
          <div className="py-4">
            <div className="w-20 h-20 rounded-3xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto mb-5 shadow-xs">
              <CheckCircle2 size={44} />
            </div>
            <span className="inline-block px-3 py-1 rounded-full bg-emerald-100/80 text-emerald-800 text-[11px] font-extrabold uppercase tracking-wider mb-3">
              ✓ Doğrulama Başarılı
            </span>
            <h1 className="text-2xl font-black text-zinc-950">Başvurunuz Onaya Alındı!</h1>
            
            {state.companyName && (
              <div className="mt-4 p-3 bg-zinc-50 border border-zinc-200/80 rounded-xl text-xs text-zinc-700 font-semibold inline-flex items-center gap-2">
                <Building2 size={15} className="text-zinc-500" />
                <span>{state.companyName}</span>
                {state.contactName && <span className="text-zinc-400">({state.contactName})</span>}
              </div>
            )}

            <p className="text-xs sm:text-sm text-zinc-600 mt-4 leading-relaxed">
              E-posta adresiniz başarıyla teyit edildi. Tedarikçi başvurunuz doğrudan satın alma ve kategori ekibimize iletilmiştir.
            </p>

            <div className="mt-6 p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 text-left text-xs text-emerald-950 flex items-start gap-3">
              <ShieldCheck size={20} className="text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong>Sonraki Adım:</strong> Satın alma ekibimiz başvurunuzu onayladığında, tedarikçi yönetim portalınıza giriş şifrenizi oluşturmanız için bu e-posta adresinize bir aktivasyon bağlantısı iletecektir.
              </div>
            </div>

            <div className="mt-8">
              <Link
                href="/"
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold transition-all shadow-sm active:scale-95"
              >
                <span>Mağaza Vitrinine Dön</span>
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        )}

        {/* State: Already Verified */}
        {state.status === "already_verified" && (
          <div className="py-4">
            <div className="w-20 h-20 rounded-3xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center mx-auto mb-5 shadow-xs">
              <CheckCircle2 size={44} />
            </div>
            <h1 className="text-xl font-black text-zinc-950">E-Posta Zaten Doğrulanmış</h1>
            <p className="text-xs text-zinc-600 mt-3 leading-relaxed">
              {state.message}
            </p>
            <div className="mt-8">
              <Link
                href="/"
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold transition-all shadow-sm active:scale-95"
              >
                <span>Mağaza Vitrinine Dön</span>
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        )}

        {/* State: Expired (30 mins exceeded) */}
        {state.status === "expired" && (
          <div className="py-4">
            <div className="w-20 h-20 rounded-3xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto mb-5 shadow-xs">
              <AlertTriangle size={44} />
            </div>
            <span className="inline-block px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-extrabold uppercase tracking-wider mb-3">
              ⏳ Süre Aşımı (30 Dakika)
            </span>
            <h1 className="text-2xl font-black text-zinc-950">Doğrulama Süresi Doldu</h1>
            <p className="text-xs sm:text-sm text-zinc-600 mt-3 leading-relaxed">
              {state.message}
            </p>
            <div className="mt-8">
              <Link
                href="/tr/tedarikci-basvuru"
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold transition-all shadow-sm active:scale-95"
              >
                <span>Yeniden Başvuru Yap</span>
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        )}

        {/* State: Error */}
        {state.status === "error" && (
          <div className="py-4">
            <div className="w-20 h-20 rounded-3xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center mx-auto mb-5 shadow-xs">
              <XCircle size={44} />
            </div>
            <h1 className="text-2xl font-black text-zinc-950">Doğrulama Başarısız</h1>
            <p className="text-xs sm:text-sm text-zinc-600 mt-3 leading-relaxed">
              {state.message}
            </p>
            <div className="mt-8 flex flex-col gap-2.5">
              <Link
                href="/tr/tedarikci-basvuru"
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold transition-all shadow-sm active:scale-95"
              >
                <span>Tedarikçi Başvuru Sayfası</span>
                <ArrowRight size={15} />
              </Link>
              <Link
                href="/"
                className="w-full inline-flex items-center justify-center px-6 py-2.5 text-zinc-500 hover:text-zinc-800 text-xs font-semibold transition-all"
              >
                Mağaza Vitrinine Dön
              </Link>
            </div>
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-zinc-100 flex items-center justify-center gap-2 text-[11px] text-zinc-400">
          <Mail size={13} />
          <span>Destek: destek@mertervitrini.com.tr</span>
        </div>
      </div>
    </div>
  );
}

export default function SupplierApplicationVerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}
