"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { 
  Store, 
  Loader2, 
  MapPin, 
  Phone, 
  MessageCircle, 
  Mail, 
  CheckCircle2, 
  AlertTriangle,
  Save,
  Tag,
  Eye,
  Lock,
  Bell,
  ArrowRight,
  ShieldCheck,
  KeyRound
} from "lucide-react";
import { useAdmin } from "@/context/AdminContext";

export default function AdminSettingsSitePage() {
  const {
    storeSettings,
    setStoreSettings,
    loadingSettings,
    savingSettings,
    settingsError,
    settingsSuccess,
    handleUpdateSettings,
    loadStoreSettings
  } = useAdmin();

  useEffect(() => {
    void loadStoreSettings();
  }, [loadStoreSettings]);

  return (
    <div className="max-w-4xl mx-auto w-full flex flex-col gap-6 animate-in fade-in duration-200">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-zinc-950 p-6 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-600 flex items-center justify-center shrink-0">
            <Store size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-950 dark:text-white">
              Mağaza &amp; Showroom İletişim Ayarları
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Storefront footer&apos;ında, mobil barda ve iletişim sayfasında global alıcılara gösterilen resmi şirket bilgileri.
            </p>
          </div>
        </div>
        <Link
          href="/admin/settings/notifications"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-800 dark:text-zinc-200 transition-colors shrink-0"
        >
          <Bell size={14} className="text-violet-600" />
          <span>E-Posta &amp; Bildirim Ayarları</span>
          <ArrowRight size={14} />
        </Link>
      </div>

      {/* Main Settings Form */}
      <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-6 sm:p-8 shadow-xs">
        {loadingSettings ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 size={32} className="text-violet-600 animate-spin" />
            <span className="text-xs font-semibold text-zinc-400">Mağaza ayarları getiriliyor...</span>
          </div>
        ) : (
          <form onSubmit={handleUpdateSettings} className="space-y-6">
            {settingsError && (
              <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <AlertTriangle size={16} className="shrink-0" />
                <span>{settingsError}</span>
              </div>
            )}

            {settingsSuccess && (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                <CheckCircle2 size={16} className="shrink-0" />
                <span>Mağaza ve showroom bilgileri başarıyla kaydedildi!</span>
              </div>
            )}

            <div className="space-y-5">
              {/* Address */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <MapPin size={14} className="text-zinc-400" />
                  Showroom / Şirket Adresi
                </label>
                <textarea
                  value={storeSettings.address}
                  onChange={(e) => setStoreSettings(prev => ({ ...prev, address: e.target.value }))}
                  rows={3}
                  className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900 text-sm focus:outline-hidden focus:border-violet-500 focus:ring-1 focus:ring-violet-500 leading-relaxed text-zinc-900 dark:text-white"
                  placeholder="Showroom adresini buraya girin..."
                  required
                />
              </div>

              {/* Phone & WhatsApp */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <Phone size={14} className="text-zinc-400" />
                    Müşteri Hizmetleri Telefonu
                  </label>
                  <input
                    type="text"
                    value={storeSettings.phone}
                    onChange={(e) => setStoreSettings(prev => ({ ...prev, phone: e.target.value }))}
                    className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900 text-sm focus:outline-hidden focus:border-violet-500 text-zinc-900 dark:text-white"
                    placeholder="+90 533 703 08 83"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <MessageCircle size={14} className="text-emerald-500" />
                    WhatsApp Sipariş Hattı
                  </label>
                  <input
                    type="text"
                    value={storeSettings.whatsapp}
                    onChange={(e) => setStoreSettings(prev => ({ ...prev, whatsapp: e.target.value }))}
                    className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900 text-sm focus:outline-hidden focus:border-violet-500 text-zinc-900 dark:text-white"
                    placeholder="+90 533 703 08 83"
                    required
                  />
                </div>
              </div>

              {/* Email */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Mail size={14} className="text-zinc-400" />
                  Kurumsal E-Posta Adresi
                </label>
                <input
                  type="email"
                  value={storeSettings.email}
                  onChange={(e) => setStoreSettings(prev => ({ ...prev, email: e.target.value }))}
                  className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900 text-sm focus:outline-hidden focus:border-violet-500 text-zinc-900 dark:text-white"
                  placeholder="info@mertervitrini.com.tr"
                  required
                />
              </div>

              {/* Pricing Display Toggle */}
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                    <Tag size={16} />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-zinc-900 dark:text-white block">
                      Tek Fiyat / B2B Seri Fiyat Modu
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      Aktif edildiğinde vitrinde adet fiyatı yerine doğrudan paket seri fiyatı gösterilir.
                    </span>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <span className="sr-only">Tek Fiyat / B2B Seri Fiyat Modu</span>
                  <input
                    type="checkbox"
                    checked={storeSettings.show_single_price}
                    onChange={(e) => setStoreSettings(prev => ({ ...prev, show_single_price: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-hidden rounded-full peer dark:bg-zinc-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600" />
                </label>
              </div>

              {/* Guest Price Visibility Toggle */}
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      storeSettings.show_prices_to_guests
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-rose-500/10 text-rose-600"
                    }`}
                  >
                    {storeSettings.show_prices_to_guests ? <Eye size={16} /> : <Lock size={16} />}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-zinc-900 dark:text-white block">
                      Ziyaretçilere (Üye Olmayanlara) Fiyatları Göster
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      {storeSettings.show_prices_to_guests
                        ? "AÇIK: Giriş yapmamış ziyaretçiler web vitrininde ve mobil uygulamada fiyatları görebilir."
                        : "KAPALI: Yalnızca üye girişi yapmış kullanıcılar fiyatları görebilir (Üyelere Özel Fiyat modu)."}
                    </span>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <span className="sr-only">Ziyaretçilere (Üye Olmayanlara) Fiyatları Göster</span>
                  <input
                    type="checkbox"
                    checked={Boolean(storeSettings.show_prices_to_guests)}
                    onChange={(e) =>
                      setStoreSettings((prev) => ({
                        ...prev,
                        show_prices_to_guests: e.target.checked,
                      }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-hidden rounded-full peer dark:bg-zinc-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
                </label>
              </div>
            </div>

            {/* Google reCAPTCHA v3 Bot & Fake Order Protection */}
            <div className="pt-2 space-y-4 border-t border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center justify-between p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/30">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                      storeSettings.recaptcha_enabled
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-zinc-500/10 text-zinc-500"
                    }`}
                  >
                    <ShieldCheck size={16} />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-zinc-900 dark:text-white block">
                      Google reCAPTCHA v3 Bot &amp; Sahte Sipariş Koruması
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      {storeSettings.recaptcha_enabled
                        ? "AÇIK: Site Key ve Secret Key tanımlıysa sipariş, teklif, kayıt ve başvuru adımlarında görünmez bot koruması çalışır."
                        : "KAPALI: Google reCAPTCHA v3 doğrulaması devre dışı bırakıldı."}
                    </span>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <span className="sr-only">Google reCAPTCHA v3 Bot Koruması</span>
                  <input
                    type="checkbox"
                    checked={Boolean(storeSettings.recaptcha_enabled)}
                    onChange={(e) =>
                      setStoreSettings((prev) => ({
                        ...prev,
                        recaptcha_enabled: e.target.checked,
                      }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-hidden rounded-full peer dark:bg-zinc-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-2 flex items-center gap-2">
                    <KeyRound size={14} className="text-zinc-400" />
                    Google reCAPTCHA v3 Site Key (Genel Anahtar)
                  </label>
                  <input
                    type="text"
                    value={storeSettings.recaptcha_site_key || ""}
                    onChange={(e) =>
                      setStoreSettings((prev) => ({
                        ...prev,
                        recaptcha_site_key: e.target.value,
                      }))
                    }
                    placeholder="6Lc..."
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white transition-all"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                      <Lock size={14} className="text-zinc-400" />
                      Google reCAPTCHA v3 Secret Key (Gizli Anahtar)
                    </label>
                    {storeSettings.recaptcha_has_secret && !storeSettings.clear_recaptcha_secret && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Kayıtlı gizli anahtar aktif
                      </span>
                    )}
                  </div>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={storeSettings.recaptcha_secret_key || ""}
                    onChange={(e) =>
                      setStoreSettings((prev) => ({
                        ...prev,
                        recaptcha_secret_key: e.target.value,
                        clear_recaptcha_secret: false,
                      }))
                    }
                    placeholder={
                      storeSettings.recaptcha_has_secret
                        ? "Değiştirmek için yeni Secret Key girin (boş bırakılırsa mevcut korunur)"
                        : "6Lc... gizli anahtarını girin"
                    }
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white transition-all"
                  />
                  {storeSettings.recaptcha_has_secret && (
                    <label className="mt-2 inline-flex items-center gap-2 text-[11px] font-semibold text-zinc-500 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(storeSettings.clear_recaptcha_secret)}
                        onChange={(e) =>
                          setStoreSettings((prev) => ({
                            ...prev,
                            clear_recaptcha_secret: e.target.checked,
                            recaptcha_secret_key: e.target.checked ? "" : prev.recaptcha_secret_key,
                          }))
                        }
                        className="rounded border-zinc-300"
                      />
                      Kayıtlı gizli anahtarı veritabanından temizle
                    </label>
                  )}
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="submit"
                disabled={savingSettings}
                className="px-6 py-2.5 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-bold text-xs hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-all flex items-center gap-2 shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {savingSettings ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Kaydediliyor...</span>
                  </>
                ) : (
                  <>
                    <Save size={14} />
                    <span>Ayarları Güncelle</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
