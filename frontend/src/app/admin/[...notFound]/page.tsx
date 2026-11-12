"use client";

import React from "react";
import Link from "next/link";
import { Compass, LayoutDashboard, Package, ArrowRight } from "lucide-react";

export default function AdminCatchAllNotFoundPage() {
  return (
    <div className="min-h-[65vh] flex items-center justify-center p-6 animate-in fade-in duration-200">
      <div className="max-w-lg w-full bg-white rounded-3xl border border-slate-200/90 shadow-sm p-8 sm:p-10 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#0F172A] border border-[#8C6D3F]/50 flex items-center justify-center mx-auto mb-5 shadow-md">
          <Compass size={28} className="text-[#D4AF7A]" />
        </div>

        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wider bg-amber-50 text-amber-800 border border-amber-200 mb-3">
          404 • YÖNETİM PANELİ ROTASI
        </span>

        <h1 className="text-2xl font-black text-[#0F172A] tracking-tight mb-2">
          Sayfa Bulunamadı
        </h1>

        <p className="text-sm text-slate-600 leading-relaxed mb-7">
          Aradığınız yönetim paneli adresi taşınmış, kaldırılmış veya geçersiz bir alt rota olabilir.
          Aşağıdaki bağlantılar üzerinden kurumsal yönetim modüllerine güvenle dönebilirsiniz.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/admin/dashboard"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-colors"
          >
            <LayoutDashboard size={15} />
            <span>Genel Bakış&apos;a Dön</span>
          </Link>

          <Link
            href="/admin/catalog/products"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors"
          >
            <Package size={15} />
            <span>Ürün Yönetimi</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </div>
  );
}
