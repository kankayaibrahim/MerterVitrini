"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  Building2, 
  Lock, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ShieldCheck, 
  ArrowRight,
  UserCheck
} from "lucide-react";

function SetupPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [checking, setChecking] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState("");
  const [supplierInfo, setSupplierInfo] = useState<{
    email: string;
    contactName: string;
    brandName: string;
  } | null>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function verifyToken() {
      if (!token) {
        if (!isMounted) return;
        setChecking(false);
        setTokenValid(false);
        setTokenError("Şifre belirleme bağlantısında doğrulama belirteci (token) bulunamadı.");
        return;
      }

      try {
        const res = await fetch(`/api/v1/supplier/auth/verify-setup-token?token=${encodeURIComponent(token!)}`);
        const data = await res.json().catch(() => ({}));

        if (!isMounted) return;

        if (!res.ok) {
          setTokenValid(false);
          setTokenError(data.error || "Geçersiz veya süresi dolmuş bir şifre belirleme bağlantısı.");
          return;
        }

        setTokenValid(true);
        setSupplierInfo({
          email: data.email,
          contactName: data.contact_name,
          brandName: data.brand_name,
        });
      } catch (err: unknown) {
        if (!isMounted) return;
        setTokenValid(false);
        setTokenError((err as Error).message || "Sunucuya bağlanırken bir hata oluştu.");
      } finally {
        if (isMounted) setChecking(false);
      }
    }

    void verifyToken();

    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (password.length < 6) {
      setFormError("Şifreniz en az 6 karakter olmalıdır.");
      return;
    }

    if (password !== confirmPassword) {
      setFormError("Girdiğiniz şifreler birbiriyle eşleşmiyor.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/v1/supplier/auth/setup-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          password,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Şifre oluşturulamadı.");
      }

      if (data.token) {
        localStorage.setItem("merter_supplier_token", data.token);
        if (data.user) {
          localStorage.setItem("merter_supplier_user", JSON.stringify(data.user));
        }
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/supplier");
      }, 2000);
    } catch (err: unknown) {
      setFormError((err as Error).message || "İşlem sırasında bir hata oluştu.");
    } finally {
      setSubmitting(false);
    }
  };

  // Password strength calculation
  const getPasswordStrength = () => {
    if (!password) return 0;
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^A-Za-z\d]/.test(password)) score++;
    return Math.min(score, 4);
  };

  const strength = getPasswordStrength();
  const strengthLabels = ["Çok Zayıf", "Zayıf", "Orta", "Güçlü", "Çok Güçlü"];
  const strengthColors = ["bg-zinc-200", "bg-red-500", "bg-amber-500", "bg-blue-500", "bg-emerald-500"];

  return (
    <div className="min-h-screen bg-linear-to-b from-zinc-50 via-white to-zinc-100 flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-3xl border border-zinc-200 shadow-xl p-8 sm:p-10 relative overflow-hidden">
        {/* Top Accent Bar */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-linear-to-r from-zinc-950 via-emerald-600 to-amber-500" />

        {/* Brand header */}
        <div className="text-center mb-6">
          <Link href="/" className="inline-block">
            <span className="font-black text-2xl tracking-tighter text-zinc-950">MERTER VİTRİNİ</span>
          </Link>
          <div className="flex items-center justify-center gap-1.5 mt-1 text-[11px] font-bold tracking-widest text-emerald-700 uppercase">
            <ShieldCheck size={13} />
            <span>Tedarikçi Hesap Aktivasyonu</span>
          </div>
        </div>

        {/* Loading state */}
        {checking && (
          <div className="py-12 text-center">
            <Loader2 size={36} className="animate-spin text-zinc-900 mx-auto mb-4" />
            <p className="text-xs font-semibold text-zinc-500">Aktivasyon bağlantısı doğrulanıyor...</p>
          </div>
        )}

        {/* Invalid Token state */}
        {!checking && !tokenValid && (
          <div className="py-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={32} />
            </div>
            <h1 className="text-xl font-black text-zinc-950">Bağlantı Geçersiz veya Süresi Dolmuş</h1>
            <p className="text-xs text-zinc-600 mt-2.5 leading-relaxed">
              {tokenError}
            </p>
            <div className="mt-8 flex flex-col gap-2.5">
              <Link
                href="/supplier/login"
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold transition-all shadow-xs"
              >
                <span>Tedarikçi Giriş Sayfası</span>
                <ArrowRight size={14} />
              </Link>
              <Link
                href="/"
                className="w-full inline-flex items-center justify-center px-5 py-2.5 text-zinc-500 hover:text-zinc-800 text-xs font-semibold"
              >
                Mağaza Vitrinine Dön
              </Link>
            </div>
          </div>
        )}

        {/* Success state */}
        {!checking && tokenValid && success && (
          <div className="py-6 text-center">
            <div className="w-20 h-20 rounded-3xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto mb-5 shadow-xs">
              <CheckCircle2 size={44} />
            </div>
            <h1 className="text-2xl font-black text-zinc-950">Şifreniz Oluşturuldu!</h1>
            <p className="text-xs sm:text-sm text-zinc-600 mt-2.5 leading-relaxed">
              Hesabınız başarıyla aktifleştirildi. Tedarikçi yönetim portalına yönlendiriliyorsunuz...
            </p>
            <div className="mt-6 flex justify-center">
              <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            </div>
          </div>
        )}

        {/* Active Setup Form */}
        {!checking && tokenValid && !success && (
          <>
            {/* Supplier Welcome Header */}
            {supplierInfo && (
              <div className="mb-6 p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80">
                <div className="flex items-center gap-2 text-xs font-bold text-zinc-950">
                  <Building2 size={15} className="text-zinc-700" />
                  <span>{supplierInfo.brandName}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 mt-1">
                  <UserCheck size={12} className="text-zinc-400" />
                  <span>Yetkili: {supplierInfo.contactName}</span>
                </div>
                <div className="text-[11px] text-zinc-400 mt-0.5 truncate">
                  E-Posta: {supplierInfo.email}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0 text-red-600" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Password */}
              <div>
                <label htmlFor="setup_password" className="block text-xs font-bold text-zinc-700 mb-1.5 flex items-center gap-1.5">
                  <Lock size={13} className="text-zinc-500" />
                  <span>Yeni Şifre</span>
                  <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="setup_password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="En az 6 karakter"
                    className="w-full bg-zinc-50/60 focus:bg-white border border-zinc-200 rounded-xl pl-4 pr-11 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-700 cursor-pointer"
                    aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {/* Strength meter */}
                {password.length > 0 && (
                  <div className="mt-2">
                    <div className="h-1 w-full bg-zinc-100 rounded-full overflow-hidden flex gap-1">
                      <div className={`h-full flex-1 transition-all ${strength >= 1 ? strengthColors[strength] : "bg-zinc-200"}`} />
                      <div className={`h-full flex-1 transition-all ${strength >= 2 ? strengthColors[strength] : "bg-zinc-200"}`} />
                      <div className={`h-full flex-1 transition-all ${strength >= 3 ? strengthColors[strength] : "bg-zinc-200"}`} />
                      <div className={`h-full flex-1 transition-all ${strength >= 4 ? strengthColors[strength] : "bg-zinc-200"}`} />
                    </div>
                    <span className="text-[10px] text-zinc-400 font-semibold mt-1 block">
                      Güç: {strengthLabels[strength]}
                    </span>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="setup_confirm_password" className="block text-xs font-bold text-zinc-700 mb-1.5 flex items-center gap-1.5">
                  <Lock size={13} className="text-zinc-500" />
                  <span>Şifre Tekrar</span>
                  <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="setup_confirm_password"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Şifrenizi tekrar yazınız"
                    className="w-full bg-zinc-50/60 focus:bg-white border border-zinc-200 rounded-xl pl-4 pr-11 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-700 cursor-pointer"
                    aria-label={showConfirmPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-2 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-60 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Kaydediliyor...</span>
                  </>
                ) : (
                  <>
                    <span>Şifremi Kaydet ve Giriş Yap</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default function SupplierSetupPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <SetupPasswordContent />
    </Suspense>
  );
}
