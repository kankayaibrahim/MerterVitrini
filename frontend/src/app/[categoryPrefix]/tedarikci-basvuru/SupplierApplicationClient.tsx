"use client";

import React from "react";
import Link from "next/link";
import { 
  Building2, 
  Globe2, 
  Award, 
  Truck, 
  Coins, 
  ChevronRight, 
  ArrowRight 
} from "lucide-react";
import SupplierApplicationSection from "@/components/store/SupplierApplicationSection";
import Footer from "@/components/store/Footer";
import { SUPPLIER_TRANSLATIONS, SupplierPageTranslations } from "./translations";

interface SupplierApplicationClientProps {
  readonly lang: string;
}

export default function SupplierApplicationClient({ lang }: Readonly<SupplierApplicationClientProps>) {
  const t: SupplierPageTranslations = SUPPLIER_TRANSLATIONS[lang] || SUPPLIER_TRANSLATIONS.en;
  const isRtl = lang === "ar";

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col justify-between font-sans" dir={isRtl ? "rtl" : "ltr"}>
      {/* Top Bar / Navigation */}
      <header className="bg-white border-b border-zinc-200/80 sticky top-0 z-40">
        <div className="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href={`/${lang}`} className="flex items-center gap-2.5">
            <span className="bg-black text-white px-2 py-0.5 rounded-none text-xs font-black tracking-widest">
              B2B
            </span>
            <span className="font-serif font-black text-base sm:text-lg tracking-tight text-zinc-950">
              MERTER VİTRİNİ
            </span>
          </Link>

          <div className="flex items-center gap-4">
            <Link
              href="/supplier/login"
              className="text-xs font-bold text-zinc-600 hover:text-zinc-950 transition-colors flex items-center gap-1"
            >
              <span>{t.supplier_login}</span>
              <ArrowRight size={13} className={isRtl ? "rotate-180" : ""} />
            </Link>
            <Link
              href={`/${lang}`}
              className="text-xs text-zinc-500 hover:text-zinc-800 transition-colors hidden sm:inline-block"
            >
              {t.back_to_shop}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero & Value Props */}
      <main className="flex-1">
        <div className="bg-white border-b border-zinc-200/60 py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-1.5 text-xs text-zinc-400 mb-6 font-medium">
              <Link href={`/${lang}`} className="hover:text-zinc-700 transition-colors">
                {t.nav_home}
              </Link>
              <ChevronRight size={13} className={isRtl ? "rotate-180" : ""} />
              <span className="text-zinc-900 font-semibold">{t.nav_supplier_apply}</span>
            </nav>

            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold tracking-wider uppercase mb-4">
                <Building2 size={14} className="text-amber-600" />
                {t.badge_partnership}
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-zinc-950 tracking-tight leading-tight">
                {t.hero_title}
              </h1>
              <p className="mt-4 text-sm sm:text-base text-zinc-600 leading-relaxed">
                {t.hero_desc}
              </p>
            </div>

            {/* 4 Feature Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mt-12">
              <div className="p-5 rounded-2xl bg-zinc-50 border border-zinc-200/80">
                <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center mb-3.5 shadow-sm">
                  <Globe2 size={20} />
                </div>
                <h2 className="font-bold text-sm text-zinc-950">{t.feature_1_title}</h2>
                <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">
                  {t.feature_1_desc}
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-zinc-50 border border-zinc-200/80">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-black flex items-center justify-center mb-3.5 shadow-sm">
                  <Award size={20} />
                </div>
                <h2 className="font-bold text-sm text-zinc-950">{t.feature_2_title}</h2>
                <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">
                  {t.feature_2_desc}
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-zinc-50 border border-zinc-200/80">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center mb-3.5 shadow-sm">
                  <Coins size={20} />
                </div>
                <h2 className="font-bold text-sm text-zinc-950">{t.feature_3_title}</h2>
                <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">
                  {t.feature_3_desc}
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-zinc-50 border border-zinc-200/80">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center mb-3.5 shadow-sm">
                  <Truck size={20} />
                </div>
                <h2 className="font-bold text-sm text-zinc-950">{t.feature_4_title}</h2>
                <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">
                  {t.feature_4_desc}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* The Localized Form Section */}
        <SupplierApplicationSection lang={lang} />
      </main>

      {/* Footer without duplicate application form */}
      <Footer lang={lang} showApplicationForm={false} />
    </div>
  );
}
