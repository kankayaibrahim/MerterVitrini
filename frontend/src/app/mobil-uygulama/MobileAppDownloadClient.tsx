"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Smartphone,
  Download,
  RefreshCw,
  ShieldCheck,
  Camera,
  ShoppingBag,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

interface MobileVersionManifest {
  app_name: string;
  package_id: string;
  version: string;
  build_number: number;
  min_build_number: number;
  force_update: boolean;
  apk_filename: string;
  download_url: string;
  sha256: string;
  file_size_bytes: number;
  published_at: string;
  apk_available: boolean;
  release_notes?: Record<string, string>;
}

function formatBytesToMb(bytes: number): string {
  if (!bytes || bytes <= 0) {
    return "—";
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatPublishedDate(iso: string): string {
  if (!iso) {
    return "Güncel Sürüm";
  }
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return "Güncel Sürüm";
  }
  return parsed.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MobileAppDownloadClient() {
  const [manifest, setManifest] = useState<MobileVersionManifest | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let active = true;
    async function fetchManifest() {
      try {
        const res = await fetch("/api/v1/mobile/version", {
          cache: "no-store",
        });
        if (res.ok) {
          const data = (await res.json()) as MobileVersionManifest;
          if (active) {
            setManifest(data);
          }
        }
      } catch {
        // Fallback metadata rendered gracefully when offline
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    void fetchManifest();
    return () => {
      active = false;
    };
  }, []);

  const versionLabel = manifest
    ? `v${manifest.version} (Yapı #${manifest.build_number})`
    : "v1.0.0 (Yapı #1)";
  const sizeLabel = manifest ? formatBytesToMb(manifest.file_size_bytes) : "—";
  const releaseNote =
    manifest?.release_notes?.tr ||
    "Merter Vitrini B2B Müşteri Mağazası ve Tedarikçi Kamera Stüdyosu resmi Android sürümü. Uygulama içi otomatik güncelleme (OTA) altyapısı dahildir.";
  const apkAvailable = manifest ? manifest.apk_available : true;

  return (
    <main className="min-h-screen bg-[#FAFAFA] text-[#111111] py-10 px-4 sm:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[1.5px] text-zinc-600 hover:text-black transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Mağaza Vitrinine Dön</span>
          </Link>
          <span className="text-[11px] font-bold tracking-[2px] uppercase text-[#8A6D1F]">
            MERTER VİTRİNİ MOBILE • OTA
          </span>
        </div>

        {/* Hero Download Card */}
        <section className="bg-white border border-[#EAEAEA] shadow-sm overflow-hidden">
          <div className="bg-[#111111] text-white px-6 sm:px-10 py-10 sm:py-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 border border-white/15 text-[11px] font-extrabold tracking-[2px] uppercase text-[#D4AF37] mb-5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>RESMİ ANDROID PAKETİ • OTOMATİK GÜNCELLEME DESTEKLİ</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight">
              Merter Vitrini B2B Mobil Uygulaması
            </h1>
            <p className="mt-3 text-sm sm:text-base text-zinc-300 max-w-2xl leading-relaxed">
              Toptan hazır giyim kataloğu, canlı üretici pazarlık sohbeti ve tedarikçi
              kamera stüdyosu tek uygulamada. Telefonunuza yalnızca{" "}
              <strong className="text-white">bir kez</strong> kurun; yeni sürümler
              yayınlandığında uygulama açılışta kendisini otomatik kontrol edip tek
              dokunuşla günceller.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-4">
              {apkAvailable ? (
                <a
                  href="/api/v1/mobile/apk"
                  download
                  className="inline-flex items-center justify-center gap-3 px-8 py-4 bg-[#D4AF37] hover:bg-[#c39e2c] text-[#111111] font-extrabold text-xs sm:text-sm tracking-[1.8px] uppercase transition-colors no-underline"
                >
                  <Download className="w-5 h-5 shrink-0" />
                  <span>ANDROID APK İNDİR ({versionLabel})</span>
                </a>
              ) : (
                <div className="inline-flex items-center gap-3 px-6 py-4 bg-zinc-800 text-zinc-300 text-xs font-bold uppercase tracking-wider">
                  <span>Yeni APK paketi hazırlanıyor, lütfen birazdan yenileyin.</span>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-zinc-300">
                <span className="inline-flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-[#D4AF37]" />
                  <span>Android 7.0+ (ARM64 / Universal)</span>
                </span>
                {sizeLabel !== "—" && (
                  <span className="font-mono text-zinc-200">Boyut: {sizeLabel}</span>
                )}
              </div>
            </div>
          </div>

          {/* Live Version Metadata Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#EAEAEA] bg-[#FCFCFC] text-xs">
            <div className="px-6 py-4">
              <div className="text-[10px] font-bold uppercase tracking-[1.5px] text-zinc-400">
                AKTİF SÜRÜM & YAPI
              </div>
              <div className="mt-1 font-extrabold text-sm text-[#111111]">
                {loading ? "Kontrol ediliyor..." : versionLabel}
              </div>
            </div>
            <div className="px-6 py-4">
              <div className="text-[10px] font-bold uppercase tracking-[1.5px] text-zinc-400">
                YAYIN TARİHİ & BOYUT
              </div>
              <div className="mt-1 font-bold text-[#111111]">
                {manifest ? formatPublishedDate(manifest.published_at) : "Güncel"} •{" "}
                {sizeLabel}
              </div>
            </div>
            <div className="px-6 py-4">
              <div className="text-[10px] font-bold uppercase tracking-[1.5px] text-zinc-400">
                PAKET KİMLİĞİ & İMZA
              </div>
              <div className="mt-1 font-mono text-[11px] text-zinc-700 truncate">
                {manifest?.package_id || "com.mertervitrini.app"} (Release Signed)
              </div>
            </div>
          </div>

          {/* Release Notes & SHA-256 */}
          <div className="p-6 sm:p-10 border-t border-[#EAEAEA] space-y-6">
            <div>
              <h2 className="text-xs font-extrabold uppercase tracking-[2px] text-[#111111] mb-2">
                BU SÜRÜMDEKİ YENİLİKLER
              </h2>
              <p className="text-sm text-zinc-600 leading-relaxed">{releaseNote}</p>
            </div>

            {manifest?.sha256 && (
              <div className="p-4 bg-[#FAFAFA] border border-[#EAEAEA] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-zinc-700">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>SHA-256 Doğrulama Özeti:</span>
                </div>
                <code className="text-[11px] font-mono text-zinc-500 break-all">
                  {manifest.sha256}
                </code>
              </div>
            )}
          </div>
        </section>

        {/* How Self-Update Works + Dual Role Highlights */}
        <section className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white border border-[#EAEAEA] p-6">
            <div className="w-9 h-9 bg-[#111111] text-white flex items-center justify-center mb-4">
              <CheckCircle2 className="w-4 h-4 text-[#D4AF37]" />
            </div>
            <h3 className="text-xs font-extrabold uppercase tracking-[1.5px] mb-2">
              1. Tek Seferlik Kurulum
            </h3>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Yukarıdaki <strong>Android APK İndir</strong> butonuna dokunun ve inen
              dosyayı açarak kurulumu tamamlayın. İlk yüklemede tarayıcınız için{" "}
              <em>&ldquo;Bu kaynaktan yüklemeye izin ver&rdquo;</em> seçeneğini açmanız
              yeterlidir.
            </p>
          </div>

          <div className="bg-white border border-[#EAEAEA] p-6">
            <div className="w-9 h-9 bg-[#111111] text-white flex items-center justify-center mb-4">
              <RefreshCw className="w-4 h-4 text-[#D4AF37]" />
            </div>
            <h3 className="text-xs font-extrabold uppercase tracking-[1.5px] mb-2">
              2. Otomatik Sürüm Kontrolü (OTA)
            </h3>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Yeni bir güncelleme yayınlandığında uygulama açılışında sürümü otomatik
              algılar ve <strong>&ldquo;Yeni versiyon mevcut, indirilsin mi?&rdquo;</strong>{" "}
              uyarısını gösterir; onayladığınızda SHA-256 doğrulamalı indirip kendisini
              günceller.
            </p>
          </div>

          <div className="bg-white border border-[#EAEAEA] p-6">
            <div className="w-9 h-9 bg-[#111111] text-white flex items-center justify-center mb-4">
              <div className="flex items-center gap-0.5">
                <ShoppingBag className="w-3.5 h-3.5 text-[#D4AF37]" />
                <Camera className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
            <h3 className="text-xs font-extrabold uppercase tracking-[1.5px] mb-2">
              3. Müşteri Vitrini + Üretici Stüdyosu
            </h3>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Hem toptan alıcılar için seri bazlı sipariş ve canlı pazarlık hem de
              üreticiler için doğrudan kameradan ürün çekip vitrine yükleme stüdyosu
              aynı pakette yer alır.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

