"use client";

import React, { useState } from "react";
import { 
  SlidersHorizontal, 
  Layers, 
  Palette, 
  Sparkles, 
  Search, 
  CheckCircle2, 
  Info,
  Package
} from "lucide-react";

interface SizeSeries {
  id: string;
  name: string;
  category: string;
  sizes: string[];
  multiplier: number;
  totalProducts: number;
}

const DEFAULT_SERIES: SizeSeries[] = [
  { id: "1", name: "Standart Kadın Seri (36-42)", category: "Elbise / Takım", sizes: ["36", "38", "40", "42"], multiplier: 4, totalProducts: 3420 },
  { id: "2", name: "Geniş Beden Seri (42-48)", category: "Büyük Beden", sizes: ["42", "44", "46", "48"], multiplier: 4, totalProducts: 1280 },
  { id: "3", name: "Triko & Üst Giyim (S-XL)", category: "Triko / Kazak", sizes: ["S", "M", "L", "XL"], multiplier: 4, totalProducts: 2150 },
  { id: "4", name: "Çift Seri Paket (36-40 x2)", category: "Toptan Hızlı Seri", sizes: ["36 (2x)", "38 (2x)", "40 (2x)"], multiplier: 6, totalProducts: 890 },
  { id: "5", name: "Standart Tek Beden (STD)", category: "Aksesuar / Şal", sizes: ["STANDART"], multiplier: 1, totalProducts: 450 },
];

export default function AdminCatalogVariantsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [seriesList] = useState<SizeSeries[]>(DEFAULT_SERIES);

  const filteredSeries = seriesList.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      {/* Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-zinc-950 p-6 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-600 flex items-center justify-center shrink-0">
            <SlidersHorizontal size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-950 dark:text-white flex items-center gap-2">
              <span>Varyant &amp; Beden/Renk Matrisi</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300 font-bold">
                B2B Paket Serileri
              </span>
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Merter toptan tekstil paket serileri, asorti katsayıları ve renk eşleme kurallarını yönetin.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Seri veya kategori ara..."
              className="pl-9 pr-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:outline-hidden focus:border-violet-500 text-zinc-900 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
            <Layers size={20} />
          </div>
          <div>
            <span className="text-xs font-semibold text-zinc-500">Aktif B2B Seri Şablonu</span>
            <p className="text-xl font-black text-zinc-950 dark:text-white">5 Şablon</p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
            <Package size={20} />
          </div>
          <div>
            <span className="text-xs font-semibold text-zinc-500">Eşlenmiş Toptan Ürün</span>
            <p className="text-xl font-black text-zinc-950 dark:text-white">8,190 Model</p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-600 flex items-center justify-center">
            <Palette size={20} />
          </div>
          <div>
            <span className="text-xs font-semibold text-zinc-500">Normalleştirilmiş Renk</span>
            <p className="text-xl font-black text-zinc-950 dark:text-white">128 Standart Renk</p>
          </div>
        </div>
      </div>

      {/* Table of Series */}
      <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between">
          <span className="text-xs font-bold text-zinc-900 dark:text-white">Toptan Seri Dağılım Listesi</span>
          <span className="text-xs text-zinc-400">XML senkronizasyonunda otomatik uygulanır</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 dark:bg-zinc-900/60 text-zinc-500 font-bold uppercase tracking-wider border-b border-zinc-200/60 dark:border-zinc-800/60">
              <tr>
                <th className="py-3.5 px-4">Seri Adı</th>
                <th className="py-3.5 px-4">Kategori Grubu</th>
                <th className="py-3.5 px-4">Beden Dağılımı (Asorti)</th>
                <th className="py-3.5 px-4 text-center">Paket Çarpanı</th>
                <th className="py-3.5 px-4 text-right">Eşleşen Ürün</th>
                <th className="py-3.5 px-4 text-center">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 text-zinc-700 dark:text-zinc-300">
              {filteredSeries.map((s) => (
                <tr key={s.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                    <Sparkles size={14} className="text-amber-500" />
                    {s.name}
                  </td>
                  <td className="py-3.5 px-4 text-zinc-500">{s.category}</td>
                  <td className="py-3.5 px-4">
                    <div className="flex flex-wrap gap-1.5">
                      {s.sizes.map((sz) => (
                        <span key={sz} className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 font-mono text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                          {sz}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-center font-bold text-zinc-900 dark:text-white">
                    {s.multiplier}x Adet / Paket
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-zinc-900 dark:text-white">
                    {s.totalProducts.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-bold">
                      <CheckCircle2 size={11} /> Aktif
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-4 bg-zinc-50 dark:bg-zinc-900/40 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center gap-2 text-xs text-zinc-500">
          <Info size={14} className="text-violet-500 shrink-0" />
          <span>Tedarikçi XML beslemelerindeki varyasyonlar (beden &amp; renk) otomatik olarak bu kural matrisi ile normalize edilmektedir.</span>
        </div>
      </div>
    </div>
  );
}
