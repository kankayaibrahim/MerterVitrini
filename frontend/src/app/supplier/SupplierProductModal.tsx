"use client";

import React, { useState } from "react";
import Image from "next/image";
import { 
  Plus, 
  Edit3, 
  X, 
  Trash2, 
  UploadCloud, 
  CheckCircle2, 
  Sparkles, 
  Layers, 
  Coins, 
  ArrowRight, 
  ArrowLeft,
  Check,
  Info
} from "lucide-react";
import type {
  CategoryOption,
  AttributeItem,
  VariantFormItem,
  SupplierProfile,
} from "./SupplierDashboardClient";

// Helper to strip any raw HTML tags from attribute names (e.g. "<p>Siyah - Beyaz</p>" -> "Siyah - Beyaz")
export function cleanAttributeName(name?: string | null): string {
  if (!name) return "";
  return name.replace(/<[^>]*>?/gm, "").trim();
}

// Ant Design style popular fast-pick colors
interface PopularColor {
  name: string;
  hex: string;
  border?: boolean;
}

const POPULAR_COLORS: PopularColor[] = [
  { name: "Siyah", hex: "#18181b" },
  { name: "Beyaz", hex: "#ffffff", border: true },
  { name: "Ekru", hex: "#f5f5dc", border: true },
  { name: "Bej", hex: "#d4be8d" },
  { name: "Lacivert", hex: "#1e3a8a" },
  { name: "Saks Mavi", hex: "#2563eb" },
  { name: "Haki", hex: "#4d5d43" },
  { name: "Mürdüm", hex: "#581c87" },
  { name: "Kırmızı", hex: "#dc2626" },
  { name: "Pudra", hex: "#fbcfe8" },
  { name: "Fuşya", hex: "#db2777" },
  { name: "Zümrüt", hex: "#065f46" },
];

const POPULAR_FABRICS = [
  "Pamuk",
  "Keten",
  "Viskon",
  "Kot / Denim",
  "İki İplik",
  "Üç İplik",
  "Şifon",
  "Poplin",
  "Triko",
  "Kaşmir",
];

const PRESET_SERIES = [
  {
    name: "Standart Kadın/Erkek",
    badge: "S - M - L - XL",
    sizes: ["S", "M", "L", "XL"],
    ratio: "S-M-L-XL 4'lü paket",
  },
  {
    name: "Büyük Beden",
    badge: "42 - 44 - 46 - 48",
    sizes: ["42", "44", "46", "48"],
    ratio: "42-44-46-48 4'lü paket",
  },
  {
    name: "Pantolon / Jean",
    badge: "28 - 30 - 32 - 34 - 36",
    sizes: ["28", "30", "32", "34", "36"],
    ratio: "28-30-32-34-36 5'li paket",
  },
  {
    name: "Standart / Tek Beden",
    badge: "Standart (STD)",
    sizes: ["Standart (STD)"],
    ratio: "Standart Tek Beden",
  },
  {
    name: "Ayakkabı / Terlik",
    badge: "36 - 37 - 38 - 39 - 40",
    sizes: ["36", "37", "38", "39", "40"],
    ratio: "36-40 5'li seri",
  },
];

// TAB 1: BASIC INFO
interface SupplierProductBasicTabProps {
  formTitle: string;
  setFormTitle: (val: string) => void;
  formCategoryId: string;
  setFormCategoryId: (val: string) => void;
  categories: CategoryOption[];
  formGender: string;
  setFormGender: (val: string) => void;
  formFabricId: string;
  setFormFabricId: (val: string) => void;
  fabrics: AttributeItem[];
  formColorId: string;
  setFormColorId: (val: string) => void;
  colors: AttributeItem[];
  formShortDesc: string;
  setFormShortDesc: (val: string) => void;
  formDescription: string;
  setFormDescription: (val: string) => void;
}

export function SupplierProductBasicTab(props: Readonly<SupplierProductBasicTabProps>) {
  const {
    formTitle,
    setFormTitle,
    formCategoryId,
    setFormCategoryId,
    categories,
    formGender,
    setFormGender,
    formFabricId,
    setFormFabricId,
    fabrics,
    formColorId,
    setFormColorId,
    colors,
    formShortDesc,
    setFormShortDesc,
    formDescription,
    setFormDescription,
  } = props;

  // Selected color name
  const selectedColor = colors.find((c) => c.id === formColorId);
  const selectedColorName = cleanAttributeName(selectedColor?.name);

  // Selected fabric name
  const selectedFabric = fabrics.find((f) => f.id === formFabricId);
  const selectedFabricName = cleanAttributeName(selectedFabric?.name);

  const handleSelectPopularColor = (colorName: string) => {
    const matched = colors.find(
      (c) => cleanAttributeName(c.name).toLowerCase() === colorName.toLowerCase()
    );
    if (matched) {
      setFormColorId(matched.id);
    }
  };

  const handleSelectPopularFabric = (fabricName: string) => {
    const matched = fabrics.find(
      (f) => cleanAttributeName(f.name).toLowerCase() === fabricName.toLowerCase()
    );
    if (matched) {
      setFormFabricId(matched.id);
    }
  };

  return (
    <div className="flex flex-col gap-5 animate-in fade-in duration-150">
      {/* Title */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="supp-title" className="text-xs font-semibold text-slate-700 flex items-center justify-between">
          <span>Ürün Başlığı / Adı <span className="text-red-500 font-bold">*</span></span>
          <span className="text-[11px] text-slate-400 font-normal">Toptan alıcıların vitrinde göreceği ana başlık</span>
        </label>
        <input
          id="supp-title"
          type="text"
          value={formTitle}
          onChange={(e) => setFormTitle(e.target.value)}
          placeholder="Örn: Balon Kol Kuşaklı Keten Elbise"
          className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-slate-300 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1677ff]/20 focus:border-[#1677ff] transition-all"
          required
        />
      </div>

      {/* Category & Gender */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="supp-category" className="text-xs font-semibold text-slate-700">
            Kategori <span className="text-red-500 font-bold">*</span>
          </label>
          <select
            id="supp-category"
            value={formCategoryId}
            onChange={(e) => setFormCategoryId(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-slate-300 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1677ff]/20 focus:border-[#1677ff] transition-all"
            required
          >
            <option value="">Lütfen Kategori Seçin</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-slate-700">
            Cinsiyet / Hedef Kitle
          </span>
          <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200">
            {["Kadın", "Erkek", "Unisex", "Çocuk"].map((gender) => {
              const active = (formGender || "Kadın") === gender;
              return (
                <button
                  key={gender}
                  type="button"
                  onClick={() => setFormGender(gender)}
                  className={`py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer text-center ${
                    active
                      ? "bg-white text-[#1677ff] shadow-xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {gender}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Renk Seçimi - Hızlı Çipler + Arama */}
      <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
            <Sparkles size={14} className="text-[#1677ff]" />
            <span>Ana Renk Seçimi</span>
            {selectedColorName && (
              <span className="ml-2 px-2.5 py-0.5 rounded-full bg-blue-50 text-[#1677ff] border border-blue-200 text-[11px] font-bold">
                Seçili: {selectedColorName}
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-400">Tek tıkla popüler renk seçin</span>
        </div>

        {/* Hızlı Renk Çipleri */}
        <div className="flex flex-wrap gap-2">
          {POPULAR_COLORS.map((pc) => {
            const isSelected = selectedColorName.toLowerCase() === pc.name.toLowerCase();
            return (
              <button
                key={pc.name}
                type="button"
                onClick={() => handleSelectPopularColor(pc.name)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer border ${
                  isSelected
                    ? "bg-[#1677ff] text-white border-[#1677ff] shadow-xs"
                    : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-100"
                }`}
              >
                <span
                  className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                  style={{
                    backgroundColor: pc.hex,
                    border: pc.border ? "1px solid #cbd5e1" : "none",
                  }}
                />
                <span>{pc.name}</span>
                {isSelected && <Check size={12} className="ml-0.5" />}
              </button>
            );
          })}
        </div>

        {/* Tam Liste Dropdown */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-200/60">
          <label htmlFor="supp-color" className="text-[11px] font-medium text-slate-500 whitespace-nowrap">
            Veya Listedeki Renkler:
          </label>
          <select
            id="supp-color"
            value={formColorId}
            onChange={(e) => setFormColorId(e.target.value)}
            className="flex-1 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1677ff]"
          >
            <option value="">Renk Listesinden Seçin (Opsiyonel)</option>
            {colors.map((c) => {
              const cleanName = cleanAttributeName(c.name);
              return (
                <option key={c.id} value={c.id}>
                  {cleanName}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Kumaş Türü - Hızlı Çipler + Arama */}
      <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
            <Layers size={14} className="text-[#1677ff]" />
            <span>Kumaş Türü</span>
            {selectedFabricName && (
              <span className="ml-2 px-2.5 py-0.5 rounded-full bg-blue-50 text-[#1677ff] border border-blue-200 text-[11px] font-bold">
                Seçili: {selectedFabricName}
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-400">Tek tıkla kumaş seçin</span>
        </div>

        {/* Hızlı Kumaş Çipleri */}
        <div className="flex flex-wrap gap-1.5">
          {POPULAR_FABRICS.map((fab) => {
            const isSelected = selectedFabricName.toLowerCase() === fab.toLowerCase();
            return (
              <button
                key={fab}
                type="button"
                onClick={() => handleSelectPopularFabric(fab)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer border ${
                  isSelected
                    ? "bg-[#1677ff] text-white border-[#1677ff] shadow-xs"
                    : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-100"
                }`}
              >
                {fab}
              </button>
            );
          })}
        </div>

        {/* Tam Liste Dropdown */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-200/60">
          <label htmlFor="supp-fabric" className="text-[11px] font-medium text-slate-500 whitespace-nowrap">
            Veya Listedeki Kumaşlar:
          </label>
          <select
            id="supp-fabric"
            value={formFabricId}
            onChange={(e) => setFormFabricId(e.target.value)}
            className="flex-1 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1677ff]"
          >
            <option value="">Kumaş Listesinden Seçin (Opsiyonel)</option>
            {fabrics.map((f) => {
              const cleanName = cleanAttributeName(f.name);
              return (
                <option key={f.id} value={f.id}>
                  {cleanName}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Descriptions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="supp-short-desc" className="text-xs font-semibold text-slate-700">
            Kısa Açıklama (Özet / Vurgu)
          </label>
          <input
            id="supp-short-desc"
            type="text"
            value={formShortDesc}
            onChange={(e) => setFormShortDesc(e.target.value)}
            placeholder="Örn: %100 Pamuklu, astarlı, nefes alan kumaş"
            className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1677ff]/20 focus:border-[#1677ff] transition-all"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="supp-desc" className="text-xs font-semibold text-slate-700">
            Detaylı Ürün Açıklaması
          </label>
          <textarea
            id="supp-desc"
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            rows={2}
            placeholder="Kalıp özellikleri, yıkama talimatı vb."
            className="w-full px-3.5 py-2 rounded-lg bg-white border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1677ff]/20 focus:border-[#1677ff] transition-all"
          />
        </div>
      </div>
    </div>
  );
}

// TAB 2: PRICING & WHOLESALE PACKAGING
interface SupplierProductPricingTabProps {
  formPrice: number;
  setFormPrice: (val: number) => void;
  formBuyingPrice: number;
  setFormBuyingPrice: (val: number) => void;
  formCurrency: string;
  setFormCurrency: (val: string) => void;
  formPackingRatio: string;
  setFormPackingRatio: (val: string) => void;
  formMoq: number;
  setFormMoq: (val: number) => void;
  formIsActive: boolean;
  setFormIsActive: (val: boolean) => void;
}

export function SupplierProductPricingTab(props: Readonly<SupplierProductPricingTabProps>) {
  const {
    formPrice,
    setFormPrice,
    formBuyingPrice,
    setFormBuyingPrice,
    formCurrency,
    setFormCurrency,
    formPackingRatio,
    setFormPackingRatio,
    formMoq,
    setFormMoq,
    formIsActive,
    setFormIsActive,
  } = props;

  // Calculate items per pack from packing ratio text (e.g. "4'lü" -> 4, or default 4)
  const matchedCount = /(\d+)/.exec(formPackingRatio);
  const packItemCount = matchedCount ? Number.parseInt(matchedCount[1], 10) : 4;
  const calculatedPackPrice = (formPrice || 0) * (packItemCount > 0 ? packItemCount : 1);

  return (
    <div className="flex flex-col gap-5 animate-in fade-in duration-150">
      {/* Price & Currency */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="supp-price" className="text-xs font-semibold text-slate-700">
            Tekil Toptan Satış Fiyatı <span className="text-red-500 font-bold">*</span>
          </label>
          <div className="relative">
            <input
              id="supp-price"
              type="number"
              step="0.01"
              min="0"
              value={formPrice || ""}
              onChange={(e) => setFormPrice(Number.parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1677ff]/20 focus:border-[#1677ff] transition-all"
              required
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-bold text-xs text-slate-400">
              {formCurrency}
            </span>
          </div>
          <span className="text-[11px] text-slate-400">1 adet ürünün toptan fiyatı</span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="supp-buying-price" className="text-xs font-semibold text-slate-700">
            Toptan Maliyet (Alış Fiyatı)
          </label>
          <div className="relative">
            <input
              id="supp-buying-price"
              type="number"
              step="0.01"
              min="0"
              value={formBuyingPrice || ""}
              onChange={(e) => setFormBuyingPrice(Number.parseFloat(e.target.value) || 0)}
              placeholder="0.00 (Opsiyonel)"
              className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-slate-300 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1677ff]/20 focus:border-[#1677ff] transition-all"
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-medium text-xs text-slate-400">
              {formCurrency}
            </span>
          </div>
          <span className="text-[11px] text-slate-400">Sadece panelinizde görünür</span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="supp-currency" className="text-xs font-semibold text-slate-700">
            Para Birimi
          </label>
          <select
            id="supp-currency"
            value={formCurrency}
            onChange={(e) => setFormCurrency(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1677ff]/20 focus:border-[#1677ff] transition-all"
          >
            <option value="TRY">TRY (₺ Türk Lirası)</option>
            <option value="USD">USD ($ Amerikan Doları)</option>
            <option value="EUR">EUR (€ Euro)</option>
          </select>
        </div>
      </div>

      {/* Packing Ratio & MOQ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="supp-packing-ratio" className="text-xs font-semibold text-slate-700">
            Asorti / Paket Oranı Tanımı
          </label>
          <input
            id="supp-packing-ratio"
            type="text"
            value={formPackingRatio}
            onChange={(e) => setFormPackingRatio(e.target.value)}
            placeholder="Örn: S-M-L-XL 4'lü paket veya 1xS, 2xM, 2xL"
            className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1677ff]/20 focus:border-[#1677ff] transition-all"
          />
          <span className="text-[11px] text-slate-400">B2B sipariş fişlerinde ve vitrinde alıcıya gösterilir</span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="supp-moq" className="text-xs font-semibold text-slate-700">
            Minimum Sipariş Miktarı (Paket Cinsinden)
          </label>
          <input
            id="supp-moq"
            type="number"
            min="1"
            value={formMoq}
            onChange={(e) => setFormMoq(Number.parseInt(e.target.value, 10) || 1)}
            className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1677ff]/20 focus:border-[#1677ff] transition-all"
          />
          <span className="text-[11px] text-slate-400">Varsayılan 1 Paket (Tek seri)</span>
        </div>
      </div>

      {/* Ant Design Style Live Pricing Calculation Card */}
      <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 text-slate-900 flex items-start gap-3.5">
        <div className="p-2.5 rounded-lg bg-[#1677ff] text-white shrink-0 shadow-xs">
          <Coins size={20} />
        </div>
        <div className="flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span className="font-bold text-xs text-blue-950 uppercase tracking-wide">
              📦 Canlı Toptan Paket / Seri Satış Fiyatı
            </span>
            <span className="text-base font-black text-[#1677ff]">
              {calculatedPackPrice.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
              {formCurrency}
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
            Toptan alıcı sepetine <strong>1 Paket ({packItemCount} Adet)</strong> eklediğinde ödenecek toplam tutar:{" "}
            <strong className="text-blue-900 font-semibold">
              {calculatedPackPrice.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} {formCurrency}
            </strong>{" "}
            (KDV hariç) olarak vitrinde görüntülenecektir.
          </p>
        </div>
      </div>

      {/* Active Toggle Switch */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
        <div>
          <span className="font-semibold text-xs text-slate-800 block">Vitrinde Hemen Yayına Al</span>
          <span className="text-[11px] text-slate-500 block">
            {formIsActive
              ? "Ürün kaydedildiğinde doğrudan toptan satış vitrininde aktif hale getirilir."
              : "Ürün taslak olarak saklanır, vitrinde gizli kalır."}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setFormIsActive(!formIsActive)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            formIsActive ? "bg-emerald-500" : "bg-slate-300"
          }`}
          role="switch"
          aria-checked={formIsActive}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
              formIsActive ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>
    </div>
  );
}

// TAB 3: VARIANTS & SIZES WIZARD
interface SupplierProductVariantsTabProps {
  formVariants: VariantFormItem[];
  onAddVariantRow: () => void;
  onUpdateVariantRow: (index: number, field: keyof VariantFormItem, val: string | number) => void;
  onRemoveVariantRow: (index: number) => void;
  onApplyPresetSeries?: (sizes: string[], ratio: string) => void;
  onApplyBulkStock?: (stock: number) => void;
}

export function SupplierProductVariantsTab(props: Readonly<SupplierProductVariantsTabProps>) {
  const {
    formVariants,
    onAddVariantRow,
    onUpdateVariantRow,
    onRemoveVariantRow,
    onApplyPresetSeries,
    onApplyBulkStock,
  } = props;

  const [bulkStockVal, setBulkStockVal] = useState<number>(20);

  const totalVariantStock = formVariants.reduce((acc, v) => acc + (Number(v.stock) || 0), 0);

  return (
    <div className="flex flex-col gap-5 animate-in fade-in duration-150">
      {/* Fast Preset Templates (Ant Design Card) */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50/60 to-indigo-50/60 border border-blue-200/80 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-blue-950">
            <Sparkles size={14} className="text-[#1677ff]" />
            <span>⚡ Hızlı Seri Şablonları (Tek Tıkla Bedenleri Doldur)</span>
          </div>
          <span className="text-[11px] text-blue-600 font-medium">Bedenleri tek tek yazmanıza gerek yok</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {PRESET_SERIES.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => onApplyPresetSeries?.(preset.sizes, preset.ratio)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-blue-200 hover:border-[#1677ff] hover:bg-blue-50 text-slate-800 text-xs font-semibold transition-all shadow-xs cursor-pointer active:scale-95"
            >
              <span>{preset.name}</span>
              <span className="px-1.5 py-0.5 rounded bg-blue-100 text-[#1677ff] text-[10px] font-mono font-bold">
                {preset.badge}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Bulk Stock Distributor */}
      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Info size={16} className="text-slate-400 shrink-0" />
          <span className="text-xs text-slate-700 font-medium">
            Tüm bedenlere eşit stok uygula:
          </span>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="number"
            min="0"
            value={bulkStockVal}
            onChange={(e) => setBulkStockVal(Number.parseInt(e.target.value, 10) || 0)}
            className="w-24 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#1677ff]"
          />
          <button
            type="button"
            onClick={() => onApplyBulkStock?.(bulkStockVal)}
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold cursor-pointer transition-all shadow-xs"
          >
            Tüm Bedenlere Uygula
          </button>
        </div>
      </div>

      {/* Variants Table Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="text-xs font-bold text-slate-800">Beden & Stok Listesi</h4>
          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold">
            Toplam Stok: {totalVariantStock} Adet
          </span>
        </div>
        <button
          type="button"
          onClick={onAddVariantRow}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1677ff] hover:bg-[#4096ff] text-white text-xs font-bold cursor-pointer transition-all shadow-xs"
        >
          <Plus size={14} />
          <span>Yeni Beden Ekle</span>
        </button>
      </div>

      {/* Ant Design Style Table */}
      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#fafafa] border-b border-slate-200 text-slate-600 font-semibold">
            <tr>
              <th className="py-2.5 px-3.5">Beden / Boyut</th>
              <th className="py-2.5 px-3.5 w-32">Mevcut Stok (Adet)</th>
              <th className="py-2.5 px-3.5">Barkod (Opsiyonel)</th>
              <th className="py-2.5 px-3.5 w-16 text-right">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {formVariants.map((v, idx) => (
              <tr key={v.id || `v-${idx}`} className="hover:bg-slate-50/60 transition-colors">
                <td className="py-2 px-3.5">
                  <input
                    type="text"
                    value={v.size}
                    onChange={(e) => onUpdateVariantRow(idx, "size", e.target.value)}
                    placeholder="Örn: M, 38, Standart"
                    aria-label={`Beden ${idx + 1}`}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#1677ff]"
                    required
                  />
                </td>
                <td className="py-2 px-3.5">
                  <input
                    type="number"
                    min="0"
                    value={v.stock}
                    onChange={(e) =>
                      onUpdateVariantRow(idx, "stock", Number.parseInt(e.target.value, 10) || 0)
                    }
                    aria-label={`Stok ${idx + 1}`}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#1677ff]"
                    required
                  />
                </td>
                <td className="py-2 px-3.5">
                  <input
                    type="text"
                    value={v.barcode}
                    onChange={(e) => onUpdateVariantRow(idx, "barcode", e.target.value)}
                    placeholder="8690000000000"
                    aria-label={`Barkod ${idx + 1}`}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-mono text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#1677ff]"
                  />
                </td>
                <td className="py-2 px-3.5 text-right">
                  <button
                    type="button"
                    onClick={() => onRemoveVariantRow(idx)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    title="Satırı Sil"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// TAB 4: PRODUCT IMAGES (ANT DESIGN DRAGGER)
interface SupplierProductImagesTabProps {
  formImages: string[];
  imageUploadLoading: boolean;
  onUploadImageFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSetCoverImage: (index: number) => void;
  onRemoveImage: (index: number) => void;
}

export function SupplierProductImagesTab(props: Readonly<SupplierProductImagesTabProps>) {
  const {
    formImages,
    imageUploadLoading,
    onUploadImageFile,
    onSetCoverImage,
    onRemoveImage,
  } = props;

  return (
    <div className="flex flex-col gap-5 animate-in fade-in duration-150">
      {/* Ant Design Dragger Upload Box */}
      <label
        htmlFor="supp-file-upload"
        className="border-2 border-dashed border-blue-200 hover:border-[#1677ff] bg-blue-50/20 hover:bg-blue-50/40 p-8 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all group"
      >
        <div className="w-14 h-14 rounded-2xl bg-blue-100/80 text-[#1677ff] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform shadow-xs">
          <UploadCloud size={28} />
        </div>
        <div className="font-bold text-sm text-slate-900">
          {imageUploadLoading ? "Fotoğraf Yükleniyor, Lütfen Bekleyin..." : "Fotoğraf Seçmek İçin Tıklayın veya Sürükleyip Bırakın"}
        </div>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          Desteklenen formatlar: JPG, PNG, WebP. İlk yüklenen fotoğraf otomatik olarak vitrin kapak fotoğrafı yapılır.
        </p>
        <input
          id="supp-file-upload"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={onUploadImageFile}
          disabled={imageUploadLoading}
          className="hidden"
        />
      </label>

      {/* Uploaded Images Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold text-slate-800">
            Yüklenen Fotoğraflar ({formImages.length})
          </h4>
          <span className="text-[11px] text-slate-400">
            Fareyle görselin üzerine gelerek kapak yapabilir veya silebilirsiniz
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3.5">
          {formImages.map((imgUrl, idx) => (
            <div
              key={imgUrl}
              className={`relative rounded-xl border overflow-hidden group aspect-[3/4] bg-slate-100 flex items-center justify-center transition-all ${
                idx === 0
                  ? "border-[#1677ff] ring-2 ring-[#1677ff]/20 shadow-md"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <Image
                src={imgUrl}
                alt={`Ürün Görseli ${idx + 1}`}
                fill
                sizes="(max-width: 640px) 50vw, 20vw"
                className="object-cover"
              />

              {idx === 0 && (
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold uppercase shadow-sm">
                  ★ Kapak Fotoğrafı
                </span>
              )}

              <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                {idx !== 0 && (
                  <button
                    type="button"
                    onClick={() => onSetCoverImage(idx)}
                    className="w-full py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-900 text-xs font-bold shadow-xs cursor-pointer"
                  >
                    Kapak Yap
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onRemoveImage(idx)}
                  className="p-2 rounded-lg bg-red-600 hover:bg-red-700 text-white shadow-xs cursor-pointer"
                  title="Fotoğrafı Kaldır"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}

          {formImages.length === 0 && (
            <div className="col-span-full py-10 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
              Henüz fotoğraf yüklenmedi. Yukarıdaki alana tıklayarak bilgisayarınızdan ürün fotoğraflarını yükleyin.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// MAIN MODAL CONTAINER (ANT DESIGN PRO STYLE)
export interface SupplierProductModalProps {
  activeModal: "create" | "edit";
  editingProductId: string | null;
  profile: SupplierProfile | null;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  modalTab: "basic" | "pricing" | "variants" | "images";
  setModalTab: (tab: "basic" | "pricing" | "variants" | "images") => void;
  submitting: boolean;
  formError: string;
  // Basic Tab
  formTitle: string;
  setFormTitle: (val: string) => void;
  formCategoryId: string;
  setFormCategoryId: (val: string) => void;
  categories: CategoryOption[];
  formGender: string;
  setFormGender: (val: string) => void;
  formFabricId: string;
  setFormFabricId: (val: string) => void;
  fabrics: AttributeItem[];
  formColorId: string;
  setFormColorId: (val: string) => void;
  colors: AttributeItem[];
  formShortDesc: string;
  setFormShortDesc: (val: string) => void;
  formDescription: string;
  setFormDescription: (val: string) => void;
  // Pricing Tab
  formPrice: number;
  setFormPrice: (val: number) => void;
  formBuyingPrice: number;
  setFormBuyingPrice: (val: number) => void;
  formCurrency: string;
  setFormCurrency: (val: string) => void;
  formPackingRatio: string;
  setFormPackingRatio: (val: string) => void;
  formMoq: number;
  setFormMoq: (val: number) => void;
  formIsActive: boolean;
  setFormIsActive: (val: boolean) => void;
  // Variants Tab
  formVariants: VariantFormItem[];
  onAddVariantRow: () => void;
  onUpdateVariantRow: (index: number, field: keyof VariantFormItem, val: string | number) => void;
  onRemoveVariantRow: (index: number) => void;
  onApplyPresetSeries?: (sizes: string[], ratio: string) => void;
  onApplyBulkStock?: (stock: number) => void;
  // Images Tab
  formImages: string[];
  imageUploadLoading: boolean;
  onUploadImageFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSetCoverImage: (index: number) => void;
  onRemoveImage: (index: number) => void;
}

export function SupplierProductModal(props: Readonly<SupplierProductModalProps>) {
  const {
    activeModal,
    profile,
    onClose,
    onSubmit,
    modalTab,
    setModalTab,
    submitting,
    formError,
  } = props;

  const handleNextTab = () => {
    if (modalTab === "basic") setModalTab("pricing");
    else if (modalTab === "pricing") setModalTab("variants");
    else if (modalTab === "variants") setModalTab("images");
  };

  const handlePrevTab = () => {
    if (modalTab === "images") setModalTab("variants");
    else if (modalTab === "variants") setModalTab("pricing");
    else if (modalTab === "pricing") setModalTab("basic");
  };

  const steps = [
    { key: "basic", step: 1, title: "Temel Bilgiler", sub: "Ad, Kategori, Renk" },
    { key: "pricing", step: 2, title: "Fiyat & Paket", sub: "Fiyatlandırma & Oran" },
    { key: "variants", step: 3, title: "Beden & Stok", sub: "Hazır Seriler & Stok" },
    { key: "images", step: 4, title: "Fotoğraflar", sub: "Görsel Yükleme" },
  ] as const;

  return (
    // Semi-transparent soft veil backdrop (NOT pitch black!)
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col my-6 max-h-[92vh]">
        {/* Ant Design Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#1677ff] border border-blue-100 flex items-center justify-center shadow-xs">
              {activeModal === "create" ? <Plus size={20} /> : <Edit3 size={20} />}
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                <span>{activeModal === "create" ? "Yeni Ürün Ekle ve Vitrinde Yayınla" : "Ürünü Düzenle"}</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Tedarikçi: <strong className="text-slate-800 font-semibold">{profile?.brand_name}</strong> • Maske Kodu:{" "}
                <span className="font-mono font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-[10px]">
                  {profile?.alias_code}
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Kapat"
          >
            <X size={20} />
          </button>
        </div>

        {/* Ant Design Stepper Navigation Bar */}
        <div className="px-6 py-3 bg-[#fafafa] border-b border-slate-200 flex items-center justify-between gap-2 overflow-x-auto">
          {steps.map((s, idx) => {
            const isActive = modalTab === s.key;
            return (
              <React.Fragment key={s.key}>
                <button
                  type="button"
                  onClick={() => setModalTab(s.key)}
                  className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer whitespace-nowrap ${
                    isActive
                      ? "bg-white text-[#1677ff] border border-blue-200 shadow-xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 ${
                      isActive
                        ? "bg-[#1677ff] text-white"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {s.step}
                  </span>
                  <div className="text-left">
                    <span className="block leading-tight">{s.title}</span>
                  </div>
                </button>
                {idx < steps.length - 1 && (
                  <div className="h-px w-6 sm:w-10 bg-slate-200 shrink-0" />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Modal Body / Active Tab */}
        <form onSubmit={onSubmit} className="p-6 overflow-y-auto flex-1 flex flex-col gap-4">
          {formError && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
              {formError}
            </div>
          )}

          {modalTab === "basic" && <SupplierProductBasicTab {...props} />}
          {modalTab === "pricing" && <SupplierProductPricingTab {...props} />}
          {modalTab === "variants" && <SupplierProductVariantsTab {...props} />}
          {modalTab === "images" && <SupplierProductImagesTab {...props} />}

          {/* Ant Design Modal Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200 mt-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Vazgeç
            </button>

            <div className="flex items-center gap-2.5">
              {modalTab !== "basic" && (
                <button
                  type="button"
                  onClick={handlePrevTab}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                >
                  <ArrowLeft size={14} />
                  <span>Geri</span>
                </button>
              )}

              {modalTab !== "images" ? (
                <button
                  type="button"
                  onClick={handleNextTab}
                  className="px-5 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#1677ff] border border-blue-200 text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  <span>İlerle</span>
                  <ArrowRight size={14} />
                </button>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 rounded-lg bg-[#1677ff] hover:bg-[#4096ff] text-white text-xs font-bold transition-all shadow-sm shadow-blue-500/20 cursor-pointer disabled:opacity-50 inline-flex items-center gap-2 active:scale-98"
              >
                <CheckCircle2 size={16} />
                <span>{submitting ? "Kaydediliyor..." : "Kaydet ve Vitrinde Yayınla"}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
