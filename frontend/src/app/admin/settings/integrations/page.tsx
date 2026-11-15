"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import {
  Webhook,
  ShieldCheck,
  TrendingUp,
  Languages,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Copy
} from "lucide-react";
import { useAdmin } from "@/context/AdminContext";

function maskRecaptchaSiteKey(rawKey?: string): string {
  const trimmed = (rawKey || "").trim();
  if (!trimmed) {
    return "Tanımlanmadı";
  }
  if (trimmed.length <= 14) {
    return trimmed;
  }
  return `${trimmed.slice(0, 8)}...${trimmed.slice(-4)}`;
}

export default function AdminSettingsIntegrationsPage() {
  const { storeSettings, loadStoreSettings } = useAdmin();

  useEffect(() => {
    void loadStoreSettings();
  }, [loadStoreSettings]);

  const recaptchaSiteKey = (storeSettings.recaptcha_site_key || "").trim();
  const recaptchaActive =
    Boolean(storeSettings.recaptcha_enabled) &&
    Boolean(recaptchaSiteKey) &&
    Boolean(storeSettings.recaptcha_has_secret);
  const maskedSiteKey = maskRecaptchaSiteKey(recaptchaSiteKey);

  const copyToClipboard = (text: string) => {
    if (typeof navigator !== "undefined") {
      void navigator.clipboard.writeText(text);
      alert("Kopyalandı: " + text);
    }
  };

  return (
    <div className="max-w-5xl mx-auto w-full flex flex-col gap-6 animate-in fade-in duration-200">
      {/* Header Card */}
      <div className="bg-white dark:bg-zinc-950 p-6 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-600 flex items-center justify-center shrink-0">
            <Webhook size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-950 dark:text-white">
              Dış API, IAM &amp; Webhook Entegrasyonları
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Keycloak 26 IAM, TCMB döviz kurları, Google reCAPTCHA ve arama motoru API uç noktalarını yönetin.
            </p>
          </div>
        </div>
      </div>

      {/* Grid of Integrations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Keycloak 26 IAM */}
        <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-6 shadow-xs flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Keycloak 26 IAM (Quarkus LTS)</h3>
                  <span className="text-[11px] text-zinc-400">OIDC / OAuth 2.0 / RS256 JWT</span>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-bold">
                <CheckCircle2 size={11} /> Aktif
              </span>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Müşteri vitrini ve toptancı tedarikçi portalı oturumları Keycloak Realm üzerinden doğrulanır.
            </p>
            <div className="space-y-1.5 pt-1 text-xs">
              <div className="flex justify-between py-1 border-b border-zinc-100 dark:border-zinc-800/80">
                <span className="text-zinc-400">Realm:</span>
                <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">merter</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-100 dark:border-zinc-800/80">
                <span className="text-zinc-400">Client ID:</span>
                <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">merter-backend</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-zinc-400">Admin Giriş URL:</span>
                <span className="font-mono text-violet-600">/admin/auth</span>
              </div>
            </div>
          </div>
          <a
            href="https://mertervitrini.com.tr/auth/admin"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 text-xs font-bold hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center gap-1.5"
          >
            <span>Keycloak Konsoluna Git</span>
            <ExternalLink size={13} />
          </a>
        </div>

        {/* Card 2: TCMB Live Currency Rates */}
        <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-6 shadow-xs flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <TrendingUp size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">TCMB Döviz Çevirici Worker</h3>
                  <span className="text-[11px] text-zinc-400">Saatlik Otomatik Kur Güncellemesi</span>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-bold">
                <CheckCircle2 size={11} /> 1 Saatlik Cron
              </span>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              T.C. Merkez Bankası resmi XML kur servisi üzerinden USD, EUR, GBP, PLN, RUB kurları anlık çekilir.
            </p>
            <div className="space-y-1.5 pt-1 text-xs">
              <div className="flex justify-between py-1 border-b border-zinc-100 dark:border-zinc-800/80">
                <span className="text-zinc-400">Desteklenen Kurlar:</span>
                <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">USD, EUR, GBP, PLN, RUB, SAR</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-100 dark:border-zinc-800/80">
                <span className="text-zinc-400">Veri Tabanı Tablosu:</span>
                <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">currencies.exchange_rates</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-zinc-400">Otomatik Çapraz Dönüşüm:</span>
                <span className="font-semibold text-emerald-600">Aktif (TRY Bazlı)</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => alert("TCMB kurları arka planda her saat otomatik güncellenmektedir.")}
            className="w-full py-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 text-xs font-bold hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center gap-1.5"
          >
            <span>Kurları Şimdi Senkronize Et</span>
          </button>
        </div>

        {/* Card 3: LibreTranslate AI Translation */}
        <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-6 shadow-xs flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-violet-500/10 text-violet-600 flex items-center justify-center">
                  <Languages size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">LibreTranslate AI Çeviri Motoru</h3>
                  <span className="text-[11px] text-zinc-400">Lokal Sunucu Portu: 5000 / 5001</span>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-bold">
                <CheckCircle2 size={11} /> Yerel Servis
              </span>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Dış API ücreti ödemeden ürün başlıkları, kumaş açıklamaları ve SEO blogları 8 dilde otomatik çevrilir.
            </p>
            <div className="space-y-1.5 pt-1 text-xs">
              <div className="flex justify-between py-1 border-b border-zinc-100 dark:border-zinc-800/80">
                <span className="text-zinc-400">Hedef Diller:</span>
                <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">EN, PL, BG, DE, FR, RU, AR</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-zinc-400">API Uç Noktası:</span>
                <span className="font-mono text-zinc-500">http://127.0.0.1:5000/translate</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => copyToClipboard("http://127.0.0.1:5000")}
            className="w-full py-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 text-xs font-bold hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Copy size={13} />
            <span>Yerel Çeviri Proxy Adresini Kopyala</span>
          </button>
        </div>

        {/* Card 4: Google reCAPTCHA v3 */}
        <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-6 shadow-xs flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Google reCAPTCHA v3</h3>
                  <span className="text-[11px] text-zinc-400">Sipariş, Teklif, Kayıt &amp; Başvuru Koruması</span>
                </div>
              </div>
              {recaptchaActive ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-bold">
                  <CheckCircle2 size={11} /> Aktif (v3 Skor Bazlı)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 text-[10px] font-bold">
                  <AlertTriangle size={11} /> Pasif / Anahtar Eksik
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Kullanıcıya bulmaca çözdürmeden botları engelleyen görünmez güvenlik doğrulaması.
            </p>
            <div className="space-y-1.5 pt-1 text-xs">
              <div className="flex justify-between py-1 border-b border-zinc-100 dark:border-zinc-800/80">
                <span className="text-zinc-400">Site Key (Public):</span>
                <span className="font-mono text-zinc-700 dark:text-zinc-300">{maskedSiteKey}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-100 dark:border-zinc-800/80">
                <span className="text-zinc-400">Secret Key (Server):</span>
                <span className={`font-semibold ${storeSettings.recaptcha_has_secret ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                  {storeSettings.recaptcha_has_secret ? "Kayıtlı (Gizli)" : "Eksik"}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-zinc-400">Backend Eşik Değeri:</span>
                <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">Score &gt;= 0.2</span>
              </div>
            </div>
          </div>
          <Link
            href="/admin/settings/site"
            className="w-full py-2 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 text-xs font-bold hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center gap-1.5"
          >
            <span>Mağaza Ayarlarından reCAPTCHA Anahtarlarını Yönet</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </div>
  );
}
