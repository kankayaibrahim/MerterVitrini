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
  Check,
  Globe,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { SizeDefinitionDTO, SeriesTemplateDTO } from "@/types/integration";
import type {
  CategoryOption,
  AttributeItem,
  SupplierProfile,
  ProductTranslationsFormMap,
} from "./SupplierDashboardClient";

export type SupportedTranslationLang = "en" | "ru" | "ar";
export type TranslationFieldKey = "title" | "short_description" | "description";
export type SupplierModalMode = "create" | "edit" | "delete" | null;
export type SizeGroupKey =
  | "letter"
  | "combo"
  | "numeric_eu"
  | "jeans"
  | "kids"
  | "shoes"
  | "standard";
export type AssortmentMode = "single" | "middle_double" | "double";

export function cleanAttributeName(name?: string | null): string {
  if (!name) return "";
  return name.replace(/<[^>]*>?/gm, "").trim();
}

export const FALLBACK_SIZE_DEFINITIONS: SizeDefinitionDTO[] = [
  { id: "sz-xs", code: "XS", label: "XS", size_group: "letter", sort_order: 10, is_active: true },
  { id: "sz-s", code: "S", label: "S", size_group: "letter", sort_order: 20, is_active: true },
  { id: "sz-m", code: "M", label: "M", size_group: "letter", sort_order: 30, is_active: true },
  { id: "sz-l", code: "L", label: "L", size_group: "letter", sort_order: 40, is_active: true },
  { id: "sz-xl", code: "XL", label: "XL", size_group: "letter", sort_order: 50, is_active: true },
  { id: "sz-2xl", code: "2XL", label: "2XL", size_group: "letter", sort_order: 60, is_active: true },
  { id: "sz-3xl", code: "3XL", label: "3XL", size_group: "letter", sort_order: 70, is_active: true },
  { id: "sz-4xl", code: "4XL", label: "4XL", size_group: "letter", sort_order: 80, is_active: true },
  { id: "sz-5xl", code: "5XL", label: "5XL", size_group: "letter", sort_order: 90, is_active: true },
  { id: "sz-sm", code: "S-M", label: "S-M", size_group: "combo", sort_order: 110, is_active: true },
  { id: "sz-ml", code: "M-L", label: "M-L", size_group: "combo", sort_order: 120, is_active: true },
  { id: "sz-lxl", code: "L-XL", label: "L-XL", size_group: "combo", sort_order: 130, is_active: true },
  { id: "sz-2xl3xl", code: "2XL-3XL", label: "2XL-3XL", size_group: "combo", sort_order: 140, is_active: true },
  { id: "sz-34", code: "34", label: "34", size_group: "numeric_eu", sort_order: 200, is_active: true },
  { id: "sz-36", code: "36", label: "36", size_group: "numeric_eu", sort_order: 210, is_active: true },
  { id: "sz-38", code: "38", label: "38", size_group: "numeric_eu", sort_order: 220, is_active: true },
  { id: "sz-40", code: "40", label: "40", size_group: "numeric_eu", sort_order: 230, is_active: true },
  { id: "sz-42", code: "42", label: "42", size_group: "numeric_eu", sort_order: 240, is_active: true },
  { id: "sz-44", code: "44", label: "44", size_group: "numeric_eu", sort_order: 250, is_active: true },
  { id: "sz-46", code: "46", label: "46", size_group: "numeric_eu", sort_order: 260, is_active: true },
  { id: "sz-48", code: "48", label: "48", size_group: "numeric_eu", sort_order: 270, is_active: true },
  { id: "sz-50", code: "50", label: "50", size_group: "numeric_eu", sort_order: 280, is_active: true },
  { id: "sz-52", code: "52", label: "52", size_group: "numeric_eu", sort_order: 290, is_active: true },
  { id: "sz-j28", code: "28", label: "28", size_group: "jeans", sort_order: 310, is_active: true },
  { id: "sz-j29", code: "29", label: "29", size_group: "jeans", sort_order: 315, is_active: true },
  { id: "sz-j30", code: "30", label: "30", size_group: "jeans", sort_order: 320, is_active: true },
  { id: "sz-j31", code: "31", label: "31", size_group: "jeans", sort_order: 325, is_active: true },
  { id: "sz-j32", code: "32", label: "32", size_group: "jeans", sort_order: 330, is_active: true },
  { id: "sz-j33", code: "33", label: "33", size_group: "jeans", sort_order: 335, is_active: true },
  { id: "sz-j34", code: "34", label: "34", size_group: "jeans", sort_order: 340, is_active: true },
  { id: "sz-j36", code: "36", label: "36", size_group: "jeans", sort_order: 350, is_active: true },
  { id: "sz-k34", code: "3-4 Yaş", label: "3-4 Yaş", size_group: "kids", sort_order: 410, is_active: true },
  { id: "sz-k56", code: "5-6 Yaş", label: "5-6 Yaş", size_group: "kids", sort_order: 420, is_active: true },
  { id: "sz-k78", code: "7-8 Yaş", label: "7-8 Yaş", size_group: "kids", sort_order: 430, is_active: true },
  { id: "sz-k910", code: "9-10 Yaş", label: "9-10 Yaş", size_group: "kids", sort_order: 440, is_active: true },
  { id: "sz-k1112", code: "11-12 Yaş", label: "11-12 Yaş", size_group: "kids", sort_order: 450, is_active: true },
  { id: "sz-sh36", code: "36", label: "36", size_group: "shoes", sort_order: 500, is_active: true },
  { id: "sz-sh37", code: "37", label: "37", size_group: "shoes", sort_order: 510, is_active: true },
  { id: "sz-sh38", code: "38", label: "38", size_group: "shoes", sort_order: 520, is_active: true },
  { id: "sz-sh39", code: "39", label: "39", size_group: "shoes", sort_order: 530, is_active: true },
  { id: "sz-sh40", code: "40", label: "40", size_group: "shoes", sort_order: 540, is_active: true },
  { id: "sz-std", code: "STD", label: "Standart (Tek Beden)", size_group: "standard", sort_order: 600, is_active: true },
];

export const FALLBACK_SERIES_TEMPLATES: SeriesTemplateDTO[] = [
  {
    id: "tpl-s-xl-4",
    template_key: "s_xl_4",
    name: "S-M-L-XL (4'lü Seri)",
    category_hint: "Üst Giyim / Elbise",
    sizes: ["S", "M", "L", "XL"],
    series_ratio: "1-1-1-1",
    units_per_series: 4,
    sort_order: 10,
    is_active: true,
  },
  {
    id: "tpl-s-l-3",
    template_key: "s_l_3",
    name: "S-M-L (3'lü Seri)",
    category_hint: "Kadın / Genç",
    sizes: ["S", "M", "L"],
    series_ratio: "1-1-1",
    units_per_series: 3,
    sort_order: 20,
    is_active: true,
  },
  {
    id: "tpl-s-xl-6",
    template_key: "s_xl_6",
    name: "S-M-L-XL (6'lı Asorti 1-2-2-1)",
    category_hint: "Tişört / Triko",
    sizes: ["S", "M", "L", "XL"],
    series_ratio: "1-2-2-1",
    units_per_series: 6,
    sort_order: 30,
    is_active: true,
  },
  {
    id: "tpl-36-42",
    template_key: "eu_36_42",
    name: "36-38-40-42 (4'lü Seri)",
    category_hint: "Elbise / Takım",
    sizes: ["36", "38", "40", "42"],
    series_ratio: "1-1-1-1",
    units_per_series: 4,
    sort_order: 40,
    is_active: true,
  },
  {
    id: "tpl-42-48",
    template_key: "plus_42_48",
    name: "42-44-46-48 (Büyük Beden)",
    category_hint: "Büyük Beden",
    sizes: ["42", "44", "46", "48"],
    series_ratio: "1-1-1-1",
    units_per_series: 4,
    sort_order: 50,
    is_active: true,
  },
  {
    id: "tpl-combo",
    template_key: "combo_sm_lxl",
    name: "S-M / L-XL (Çiftli Kalıp)",
    category_hint: "Triko / Oversize",
    sizes: ["S-M", "L-XL"],
    series_ratio: "2-2",
    units_per_series: 4,
    sort_order: 60,
    is_active: true,
  },
  {
    id: "tpl-jeans",
    template_key: "jeans_28_36",
    name: "28-30-32-34-36 (Jean)",
    category_hint: "Kot / Pantolon",
    sizes: ["28", "30", "32", "34", "36"],
    series_ratio: "1-1-1-1-1",
    units_per_series: 5,
    sort_order: 70,
    is_active: true,
  },
  {
    id: "tpl-std",
    template_key: "std_1",
    name: "Standart Tek Beden (STD)",
    category_hint: "Triko / Şal",
    sizes: ["STD"],
    series_ratio: "1",
    units_per_series: 1,
    sort_order: 80,
    is_active: true,
  },
];

const SIZE_GROUP_TABS: ReadonlyArray<{ key: SizeGroupKey; label: string }> = [
  { key: "letter", label: "Harf (XS - 5XL)" },
  { key: "numeric_eu", label: "Sayısal (34 - 54)" },
  { key: "combo", label: "İkili (S-M / L-XL)" },
  { key: "jeans", label: "Kot / Jean" },
  { key: "kids", label: "Çocuk / Yaş" },
  { key: "shoes", label: "Ayakkabı" },
  { key: "standard", label: "Tek Beden (STD)" },
];

const SERIES_STOCK_PRESETS = [25, 50, 100, 250, 500];

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
  { name: "Kırmızı", hex: "#dc2626" },
  { name: "Pudra", hex: "#fbcfe8" },
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
];

export function buildSeriesRatioForMode(sizeCount: number, mode: AssortmentMode): string {
  const safeCount = Math.max(1, sizeCount);
  if (mode === "double") {
    return Array.from({ length: safeCount }, () => "2").join("-");
  }
  if (mode === "middle_double" && safeCount >= 3) {
    return Array.from({ length: safeCount }, (_, idx) => {
      const isEdge = idx === 0 || idx === safeCount - 1;
      return isEdge ? "1" : "2";
    }).join("-");
  }
  return Array.from({ length: safeCount }, () => "1").join("-");
}

export function detectAssortmentMode(seriesRatio: string, sizeCount: number): AssortmentMode {
  const weights = seriesRatio
    .split("-")
    .map((p) => Number.parseInt(p.trim(), 10))
    .filter((n) => !Number.isNaN(n) && n > 0);
  if (weights.length !== sizeCount || sizeCount === 0) {
    return "single";
  }
  if (weights.every((w) => w === 2)) {
    return "double";
  }
  if (sizeCount >= 3 && weights[0] === 1 && weights[sizeCount - 1] === 1 && weights.includes(2)) {
    return "middle_double";
  }
  return "single";
}

export function parseSeriesRatioWeights(seriesRatio: string, sizeCount: number): number[] {
  const parsed = seriesRatio
    .split("-")
    .map((p) => Number.parseInt(p.trim(), 10))
    .filter((n) => !Number.isNaN(n) && n > 0);
  if (parsed.length === sizeCount) {
    return parsed;
  }
  return Array.from({ length: sizeCount }, () => 1);
}

export function sortSelectedSizesByDefinitions(
  sizes: string[],
  definitions: SizeDefinitionDTO[]
): string[] {
  const orderMap = new Map<string, number>();
  for (const def of definitions) {
    const prev = orderMap.get(def.code);
    if (prev === undefined || def.sort_order < prev) {
      orderMap.set(def.code, def.sort_order);
    }
  }
  return [...sizes].sort((a, b) => {
    const oa = orderMap.get(a) ?? 9999;
    const ob = orderMap.get(b) ?? 9999;
    if (oa !== ob) return oa - ob;
    return a.localeCompare(b, "tr");
  });
}

function getCurrencySymbol(currency: string): string {
  if (currency === "TRY") return "₺";
  if (currency === "USD") return "$";
  return "€";
}

function inferSizeGroupFromSelected(
  selectedSizes: string[],
  definitions: SizeDefinitionDTO[]
): SizeGroupKey {
  const first = selectedSizes[0];
  if (!first) return "letter";
  const matched = definitions.find((d) => d.code === first);
  if (!matched) return "letter";
  return matched.size_group as SizeGroupKey;
}

interface ExpressPhotosSectionProps {
  readonly formImages: string[];
  readonly imageUploadLoading: boolean;
  readonly onUploadImageFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  readonly onSetCoverImage: (index: number) => void;
  readonly onRemoveImage: (index: number) => void;
}

function ExpressPhotosSection({
  formImages,
  imageUploadLoading,
  onUploadImageFile,
  onSetCoverImage,
  onRemoveImage,
}: ExpressPhotosSectionProps) {
  return (
    <section className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/90 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-md bg-blue-600 text-white text-xs font-extrabold flex items-center justify-center">
            1
          </span>
          <span className="text-xs font-extrabold text-slate-900">
            Ürün Fotoğrafları (Çoklu Seçim Destekli)
          </span>
        </div>
        <span className="text-[11px] text-slate-500">
          İlk görsel vitrin kapağı olur ({formImages.length} görsel yüklü)
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        <label
          htmlFor="supp-express-photos"
          className={`col-span-2 sm:col-span-2 min-h-24 p-3 rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
            imageUploadLoading
              ? "border-blue-400 bg-blue-50/50 opacity-75 pointer-events-none"
              : "border-slate-300 hover:border-[#1677ff] bg-white hover:bg-blue-50/30"
          }`}
        >
          <UploadCloud size={22} className="text-[#1677ff] mb-1" />
          <span className="text-xs font-bold text-slate-800">
            {imageUploadLoading ? "Fotoğraflar Yükleniyor..." : "Fotoğraf Seç (Çoklu)"}
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5">
            JPG, PNG, WEBP • Birden fazla seçebilirsiniz
          </span>
          <input
            id="supp-express-photos"
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            onChange={onUploadImageFile}
            disabled={imageUploadLoading}
            className="hidden"
          />
        </label>

        {formImages.map((imgUrl, idx) => (
          <div
            key={`${imgUrl}-${idx}`}
            className={`relative h-24 rounded-xl overflow-hidden border bg-white group ${
              idx === 0 ? "border-2 border-[#1677ff] shadow-xs" : "border-slate-200"
            }`}
          >
            <Image
              src={imgUrl}
              alt={`Ürün görseli ${idx + 1}`}
              fill
              sizes="140px"
              className="object-cover"
            />
            {idx === 0 && (
              <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-[#1677ff] text-white text-[9px] font-bold">
                KAPAK
              </span>
            )}
            <div className="absolute inset-0 bg-slate-900/55 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-1">
              {idx !== 0 && (
                <button
                  type="button"
                  onClick={() => onSetCoverImage(idx)}
                  className="px-2 py-1 rounded bg-white text-slate-900 text-[10px] font-bold cursor-pointer"
                >
                  Kapak
                </button>
              )}
              <button
                type="button"
                onClick={() => onRemoveImage(idx)}
                className="p-1.5 rounded bg-red-600 text-white cursor-pointer"
                title="Görseli kaldır"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

interface ExpressCoreAndPriceSectionProps {
  readonly formTitle: string;
  readonly setFormTitle: (v: string) => void;
  readonly formCategoryId: string;
  readonly setFormCategoryId: (v: string) => void;
  readonly categories: CategoryOption[];
  readonly formPrice: number;
  readonly setFormPrice: (v: number) => void;
  readonly formCurrency: string;
  readonly setFormCurrency: (v: string) => void;
}

function ExpressCoreAndPriceSection({
  formTitle,
  setFormTitle,
  formCategoryId,
  setFormCategoryId,
  categories,
  formPrice,
  setFormPrice,
  formCurrency,
  setFormCurrency,
}: ExpressCoreAndPriceSectionProps) {
  const currencySymbol = getCurrencySymbol(formCurrency);

  return (
    <section className="p-4 rounded-xl bg-white border border-slate-200/90 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 rounded-md bg-blue-600 text-white text-xs font-extrabold flex items-center justify-center">
          2
        </span>
        <span className="text-xs font-extrabold text-slate-900">
          Ürün Adı, Kategori ve Toptan Birim Fiyatı
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
        <div className="sm:col-span-6 flex flex-col gap-1">
          <label htmlFor="supp-title" className="text-xs font-bold text-slate-700">
            Ürün Adı / Model Başlığı <span className="text-red-500">*</span>
          </label>
          <input
            id="supp-title"
            type="text"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            placeholder="Örn: Kuşaklı Keten İkili Takım"
            className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1677ff]/20 focus:border-[#1677ff]"
            required
          />
        </div>

        <div className="sm:col-span-6 flex flex-col gap-1">
          <label htmlFor="supp-category" className="text-xs font-bold text-slate-700">
            Kategori <span className="text-red-500">*</span>
          </label>
          <select
            id="supp-category"
            value={formCategoryId}
            onChange={(e) => setFormCategoryId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1677ff]/20 focus:border-[#1677ff]"
            required
          >
            <option value="">-- Kategori Seçiniz --</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-7 flex flex-col gap-1">
          <label htmlFor="supp-price" className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Coins size={13} className="text-[#1677ff]" />
            <span>Tekil Ürün Toptan Satış Fiyatı (1 Adet) <span className="text-red-500">*</span></span>
          </label>
          <div className="relative">
            <input
              id="supp-price"
              type="number"
              step="0.01"
              min="0"
              value={formPrice || ""}
              onChange={(e) => setFormPrice(Number(e.target.value))}
              placeholder="0.00"
              className="w-full pl-3.5 pr-10 py-2.5 rounded-lg bg-white border border-slate-300 text-sm font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1677ff]/20 focus:border-[#1677ff]"
              required
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-extrabold text-slate-500">
              {currencySymbol}
            </span>
          </div>
        </div>

        <div className="sm:col-span-5 flex flex-col gap-1">
          <span className="text-xs font-bold text-slate-700">Para Birimi</span>
          <div className="grid grid-cols-3 gap-1.5 h-[42px]">
            {(["TRY", "USD", "EUR"] as const).map((curr) => (
              <button
                key={curr}
                type="button"
                onClick={() => setFormCurrency(curr)}
                className={`rounded-lg border text-xs font-extrabold transition-all cursor-pointer ${
                  formCurrency === curr
                    ? "bg-[#1677ff] border-[#1677ff] text-white shadow-xs"
                    : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
              >
                {curr} ({getCurrencySymbol(curr)})
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

interface ExpressSeriesAndSizePickerSectionProps {
  readonly sizeDefinitions: SizeDefinitionDTO[];
  readonly seriesTemplates: SeriesTemplateDTO[];
  readonly selectedSizes: string[];
  readonly onToggleSize: (code: string) => void;
  readonly onApplySeriesTemplate: (tpl: SeriesTemplateDTO) => void;
  readonly seriesRatio: string;
  readonly onSelectAssortmentMode: (mode: AssortmentMode) => void;
  readonly seriesStock: number;
  readonly setSeriesStock: (val: number) => void;
  readonly unitPrice: number;
  readonly currency: string;
}

function ExpressSeriesAndSizePickerSection({
  sizeDefinitions,
  seriesTemplates,
  selectedSizes,
  onToggleSize,
  onApplySeriesTemplate,
  seriesRatio,
  onSelectAssortmentMode,
  seriesStock,
  setSeriesStock,
  unitPrice,
  currency,
}: ExpressSeriesAndSizePickerSectionProps) {
  const effectiveSizes = sizeDefinitions.length > 0 ? sizeDefinitions : FALLBACK_SIZE_DEFINITIONS;
  const effectiveTemplates = seriesTemplates.length > 0 ? seriesTemplates : FALLBACK_SERIES_TEMPLATES;

  const [activeGroup, setActiveGroup] = useState<SizeGroupKey>(() =>
    inferSizeGroupFromSelected(selectedSizes, effectiveSizes)
  );

  const groupSizes = effectiveSizes.filter((s) => s.size_group === activeGroup);
  const weights = parseSeriesRatioWeights(seriesRatio, selectedSizes.length);
  const unitsPerSeries = weights.reduce((acc, w) => acc + w, 0);
  const safeSeriesStock = Math.max(1, seriesStock || 100);
  const totalPieces = unitsPerSeries * safeSeriesStock;
  const seriesTotalPrice = unitPrice * unitsPerSeries;
  const activeAssortment = detectAssortmentMode(seriesRatio, selectedSizes.length);

  const isTemplateSelected = (tpl: SeriesTemplateDTO): boolean =>
    tpl.sizes.length === selectedSizes.length &&
    tpl.sizes.every((sz, idx) => selectedSizes[idx] === sz) &&
    tpl.series_ratio === seriesRatio;

  return (
    <section className="p-4 rounded-xl bg-blue-50/35 border border-blue-200/80 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-md bg-blue-600 text-white text-xs font-extrabold flex items-center justify-center">
            3
          </span>
          <div>
            <span className="text-xs font-extrabold text-slate-900 block">
              Seçmeli Beden Serisi &amp; Eldeki Tahmini Seri Stoğu
            </span>
            <span className="text-[11px] text-slate-500">
              Bedenleri yazmanıza veya tek tek adet girmenize gerek yoktur; şablondan veya listeden seçin.
            </span>
          </div>
        </div>
      </div>

      {/* 1-Click Series Templates */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wide flex items-center gap-1.5">
          <Sparkles size={13} className="text-[#1677ff]" />
          <span>Hazır Merter Seri Şablonları (Tek Tıkla Uygula)</span>
        </span>
        <div className="flex flex-wrap gap-1.5">
          {effectiveTemplates.map((tpl) => {
            const selected = isTemplateSelected(tpl);
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => {
                  onApplySeriesTemplate(tpl);
                  setActiveGroup(inferSizeGroupFromSelected(tpl.sizes, effectiveSizes));
                }}
                className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  selected
                    ? "bg-[#1677ff] border-[#1677ff] text-white shadow-xs"
                    : "bg-white border-slate-200 text-slate-700 hover:border-[#1677ff] hover:text-[#1677ff]"
                }`}
              >
                {selected && <Check size={12} />}
                <span>{tpl.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Predefined Size Definitions Picker (Zero Free-Text) */}
      <div className="p-3.5 rounded-xl bg-white border border-slate-200 flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs font-bold text-slate-800">
            Beden Tanım Tablosundan Seçin <span className="text-red-500">*</span>
          </span>
          <span className="text-[11px] font-semibold text-slate-500">
            Seçili: <strong className="text-[#1677ff]">{selectedSizes.join(" - ") || "Yok"}</strong>
          </span>
        </div>

        <div className="flex flex-wrap gap-1 border-b border-slate-100 pb-2">
          {SIZE_GROUP_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveGroup(tab.key)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                activeGroup === tab.key
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {groupSizes.map((sz) => {
            const isChecked = selectedSizes.includes(sz.code);
            return (
              <button
                key={sz.id}
                type="button"
                onClick={() => onToggleSize(sz.code)}
                className={`min-w-12 px-3 py-2 rounded-lg border text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  isChecked
                    ? "bg-blue-600 border-blue-600 text-white shadow-xs"
                    : "bg-slate-50 border-slate-200 text-slate-700 hover:border-blue-400 hover:bg-blue-50/40"
                }`}
              >
                {isChecked && <Check size={12} />}
                <span>{sz.label}</span>
              </button>
            );
          })}
        </div>

        {/* Assortment Distribution Mode */}
        {selectedSizes.length > 1 && (
          <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-slate-600">
              1 Serideki Beden Dağılımı (Asorti):
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => onSelectAssortmentMode("single")}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer ${
                  activeAssortment === "single"
                    ? "bg-emerald-600 border-emerald-600 text-white"
                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                Her Bedenden 1 Adet ({buildSeriesRatioForMode(selectedSizes.length, "single")})
              </button>
              {selectedSizes.length >= 3 && (
                <button
                  type="button"
                  onClick={() => onSelectAssortmentMode("middle_double")}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer ${
                    activeAssortment === "middle_double"
                      ? "bg-emerald-600 border-emerald-600 text-white"
                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  Orta Bedenler Çift ({buildSeriesRatioForMode(selectedSizes.length, "middle_double")})
                </button>
              )}
              <button
                type="button"
                onClick={() => onSelectAssortmentMode("double")}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer ${
                  activeAssortment === "double"
                    ? "bg-emerald-600 border-emerald-600 text-white"
                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                Çiftli Seri ({buildSeriesRatioForMode(selectedSizes.length, "double")})
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Estimated Series Count (Default 100 Series) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center p-3.5 rounded-xl bg-white border border-slate-200">
        <div className="md:col-span-7 flex flex-col gap-1.5">
          <label htmlFor="supp-series-stock" className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
            <Layers size={14} className="text-emerald-600" />
            <span>Eldeki Tahmini Seri Adedi (Varsayılan: 100 Seri)</span>
          </label>
          <div className="flex flex-wrap items-center gap-1.5">
            {SERIES_STOCK_PRESETS.map((cnt) => (
              <button
                key={cnt}
                type="button"
                onClick={() => setSeriesStock(cnt)}
                className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                  safeSeriesStock === cnt
                    ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                    : "bg-slate-50 border-slate-200 text-slate-700 hover:border-emerald-400"
                }`}
              >
                {cnt} Seri
              </button>
            ))}
            <input
              id="supp-series-stock"
              type="number"
              min="1"
              value={safeSeriesStock}
              onChange={(e) => setSeriesStock(Math.max(1, Number(e.target.value) || 1))}
              className="w-24 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-extrabold text-slate-900 text-center focus:outline-none focus:border-emerald-600"
            />
          </div>
        </div>

        <div className="md:col-span-5 p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 flex flex-col gap-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-emerald-900">1 Seri İçeriği:</span>
            <span className="font-extrabold text-emerald-950">
              {unitsPerSeries} Adet ({selectedSizes.map((s, i) => `${s}:${weights[i] ?? 1}`).join(", ")})
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-emerald-900">1 Seri Paket Fiyatı:</span>
            <span className="font-extrabold text-[#1677ff]">
              {seriesTotalPrice.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} {currency}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs pt-1 border-t border-emerald-200/70">
            <span className="font-semibold text-emerald-900">Toplam Vitrin Stoğu:</span>
            <span className="font-black text-emerald-800">
              {safeSeriesStock} Seri ({totalPieces} Adet)
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

interface ExpressColorAndFabricSectionProps {
  readonly colors: AttributeItem[];
  readonly formColorId: string;
  readonly setFormColorId: (v: string) => void;
  readonly fabrics: AttributeItem[];
  readonly formFabricId: string;
  readonly setFormFabricId: (v: string) => void;
}

function ExpressColorAndFabricSection({
  colors,
  formColorId,
  setFormColorId,
  fabrics,
  formFabricId,
  setFormFabricId,
}: ExpressColorAndFabricSectionProps) {
  const selectedColorName = cleanAttributeName(colors.find((c) => c.id === formColorId)?.name);
  const selectedFabricName = cleanAttributeName(fabrics.find((f) => f.id === formFabricId)?.name);

  const pickPopularColor = (colorName: string) => {
    const matched = colors.find(
      (c) => cleanAttributeName(c.name).toLowerCase() === colorName.toLowerCase()
    );
    if (matched) setFormColorId(matched.id);
  };

  const pickPopularFabric = (fabricName: string) => {
    const matched = fabrics.find(
      (f) => cleanAttributeName(f.name).toLowerCase() === fabricName.toLowerCase()
    );
    if (matched) setFormFabricId(matched.id);
  };

  return (
    <section className="p-4 rounded-xl bg-white border border-slate-200/90 grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="supp-color" className="text-xs font-bold text-slate-800">
          Ana Renk (Opsiyonel)
        </label>
        <div className="flex flex-wrap gap-1.5">
          {POPULAR_COLORS.map((pc) => {
            const isSelected = selectedColorName.toLowerCase() === pc.name.toLowerCase();
            return (
              <button
                key={pc.name}
                type="button"
                onClick={() => pickPopularColor(pc.name)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border cursor-pointer ${
                  isSelected
                    ? "bg-blue-50 border-[#1677ff] text-[#1677ff]"
                    : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full ${pc.border ? "border border-slate-300" : ""}`}
                  style={{ backgroundColor: pc.hex }}
                />
                <span>{pc.name}</span>
              </button>
            );
          })}
        </div>
        <select
          id="supp-color"
          value={formColorId}
          onChange={(e) => setFormColorId(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs text-slate-800"
        >
          <option value="">-- Tüm Renklerden Seçin --</option>
          {colors.map((col) => (
            <option key={col.id} value={col.id}>
              {cleanAttributeName(col.name)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="supp-fabric" className="text-xs font-bold text-slate-800">
          Kumaş Özelliği (Opsiyonel)
        </label>
        <div className="flex flex-wrap gap-1.5">
          {POPULAR_FABRICS.map((fab) => {
            const isSelected = selectedFabricName.toLowerCase() === fab.toLowerCase();
            return (
              <button
                key={fab}
                type="button"
                onClick={() => pickPopularFabric(fab)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border cursor-pointer ${
                  isSelected
                    ? "bg-blue-50 border-[#1677ff] text-[#1677ff]"
                    : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
              >
                {fab}
              </button>
            );
          })}
        </div>
        <select
          id="supp-fabric"
          value={formFabricId}
          onChange={(e) => setFormFabricId(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs text-slate-800"
        >
          <option value="">-- Tüm Kumaşlardan Seçin --</option>
          {fabrics.map((f) => (
            <option key={f.id} value={f.id}>
              {cleanAttributeName(f.name)}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}

const TRANSLATION_LANG_TABS: ReadonlyArray<{
  code: SupportedTranslationLang;
  label: string;
  flag: string;
  dir: "ltr" | "rtl";
}> = [
  { code: "en", label: "İngilizce (EN)", flag: "🇬🇧", dir: "ltr" },
  { code: "ru", label: "Rusça (RU)", flag: "🇷🇺", dir: "ltr" },
  { code: "ar", label: "Arapça (AR)", flag: "🇸🇦", dir: "rtl" },
];

interface OptionalDetailsAndTranslationsSectionProps {
  readonly expanded: boolean;
  readonly onToggleExpanded: () => void;
  readonly formGender: string;
  readonly setFormGender: (v: string) => void;
  readonly formBuyingPrice: number;
  readonly setFormBuyingPrice: (v: number) => void;
  readonly formMinOrderSeries: number;
  readonly setFormMinOrderSeries: (v: number) => void;
  readonly formShortDesc: string;
  readonly setFormShortDesc: (v: string) => void;
  readonly formDescription: string;
  readonly setFormDescription: (v: string) => void;
  readonly formIsActive: boolean;
  readonly setFormIsActive: (v: boolean) => void;
  readonly formTitle: string;
  readonly formTranslations: ProductTranslationsFormMap;
  readonly onUpdateTranslationField: (
    lang: SupportedTranslationLang,
    field: TranslationFieldKey,
    val: string
  ) => void;
  readonly autoTranslating: boolean;
  readonly onAutoTranslateFromTurkish: () => void;
}

function OptionalDetailsAndTranslationsSection({
  expanded,
  onToggleExpanded,
  formGender,
  setFormGender,
  formBuyingPrice,
  setFormBuyingPrice,
  formMinOrderSeries,
  setFormMinOrderSeries,
  formShortDesc,
  setFormShortDesc,
  formDescription,
  setFormDescription,
  formIsActive,
  setFormIsActive,
  formTitle,
  formTranslations,
  onUpdateTranslationField,
  autoTranslating,
  onAutoTranslateFromTurkish,
}: OptionalDetailsAndTranslationsSectionProps) {
  const [activeLang, setActiveLang] = useState<SupportedTranslationLang>("en");
  const currentLangMeta =
    TRANSLATION_LANG_TABS.find((t) => t.code === activeLang) ?? TRANSLATION_LANG_TABS[0];
  const currentFields = formTranslations[activeLang];

  return (
    <section className="rounded-xl bg-white border border-slate-200/90 overflow-hidden">
      <button
        type="button"
        onClick={onToggleExpanded}
        className="w-full px-4 py-3 bg-slate-50/70 hover:bg-slate-100/80 flex items-center justify-between text-left transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Globe size={15} className="text-[#1677ff]" />
          <span className="text-xs font-extrabold text-slate-800">
            Ek Detaylar, Açıklama &amp; Yabancı Dil Çevirileri (Opsiyonel)
          </span>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#1677ff]">
          <span>{expanded ? "Gizle" : "Genişlet"}</span>
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </span>
      </button>

      {expanded && (
        <div className="p-4 flex flex-col gap-4 border-t border-slate-200">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="supp-gender" className="text-xs font-semibold text-slate-700">
                Hedef Kitle / Cinsiyet
              </label>
              <select
                id="supp-gender"
                value={formGender}
                onChange={(e) => setFormGender(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 bg-white"
              >
                <option value="Kadın">Kadın Giyim</option>
                <option value="Erkek">Erkek Giyim</option>
                <option value="Unisex">Unisex</option>
                <option value="Çocuk">Çocuk Giyim</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="supp-min-series" className="text-xs font-semibold text-slate-700">
                Minimum Sipariş (Seri)
              </label>
              <input
                id="supp-min-series"
                type="number"
                min="1"
                value={formMinOrderSeries}
                onChange={(e) => setFormMinOrderSeries(Math.max(1, Number(e.target.value) || 1))}
                className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-800"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="supp-buying-price" className="text-xs font-semibold text-slate-700">
                Birim Maliyet (Gizli - Sadece Size)
              </label>
              <input
                id="supp-buying-price"
                type="number"
                step="0.01"
                min="0"
                value={formBuyingPrice || ""}
                onChange={(e) => setFormBuyingPrice(Number(e.target.value))}
                placeholder="0.00"
                className="px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="supp-short-desc" className="text-xs font-semibold text-slate-700">
                Kısa Model Notu
              </label>
              <input
                id="supp-short-desc"
                type="text"
                value={formShortDesc}
                onChange={(e) => setFormShortDesc(e.target.value)}
                placeholder="Örn: %100 Pamuk, Tam Kalıp"
                className="px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-800"
              />
            </div>

            <div className="flex items-center justify-between px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-200">
              <div>
                <span className="text-xs font-bold text-slate-800 block">Vitrin Yayın Durumu</span>
                <span className="text-[10px] text-slate-500">
                  {formIsActive ? "Kaydedildiğinde hemen vitrinde görünür" : "Taslak / Pasif olarak kaydedilir"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setFormIsActive(!formIsActive)}
                className={`w-11 h-6 rounded-full transition-colors p-0.5 cursor-pointer flex items-center ${
                  formIsActive ? "bg-[#1677ff] justify-end" : "bg-slate-300 justify-start"
                }`}
              >
                <span className="w-5 h-5 rounded-full bg-white shadow-xs block" />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="supp-desc" className="text-xs font-semibold text-slate-700">
              Detaylı Ürün Açıklaması
            </label>
            <textarea
              id="supp-desc"
              rows={2}
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Kumaş gramajı, yıkama talimatı, manken ölçüleri..."
              className="px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-800"
            />
          </div>

          {/* Multi-language auto-translation */}
          <div className="p-3.5 rounded-xl bg-blue-50/40 border border-blue-200/80 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-bold text-blue-950">
                İhracat Vitrini Çok Dilli Çeviri (EN / RU / AR) — Kayıtta boşsa otomatik çevrilir
              </span>
              <button
                type="button"
                onClick={onAutoTranslateFromTurkish}
                disabled={autoTranslating || !formTitle.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1677ff] hover:bg-[#4096ff] text-white text-[11px] font-bold cursor-pointer disabled:opacity-50"
              >
                <Sparkles size={13} />
                <span>{autoTranslating ? "Çevriliyor..." : "Türkçeden Otomatik Çevir"}</span>
              </button>
            </div>

            <div className="flex gap-1.5 flex-wrap">
              {TRANSLATION_LANG_TABS.map((tab) => (
                <button
                  key={tab.code}
                  type="button"
                  onClick={() => setActiveLang(tab.code)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                    activeLang === tab.code
                      ? "bg-white border-[#1677ff] text-[#1677ff]"
                      : "bg-slate-50 border-slate-200 text-slate-600"
                  }`}
                >
                  {tab.flag} {tab.label}
                </button>
              ))}
            </div>

            <div dir={currentLangMeta.dir} className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="flex flex-col gap-1">
                <label htmlFor={`tr-title-${activeLang}`} className="text-[11px] font-semibold text-slate-700">
                  {currentLangMeta.label} Başlık
                </label>
                <input
                  id={`tr-title-${activeLang}`}
                  type="text"
                  value={currentFields.title}
                  onChange={(e) => onUpdateTranslationField(activeLang, "title", e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-800"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor={`tr-short-${activeLang}`} className="text-[11px] font-semibold text-slate-700">
                  {currentLangMeta.label} Kısa Açıklama
                </label>
                <input
                  id={`tr-short-${activeLang}`}
                  type="text"
                  value={currentFields.short_description}
                  onChange={(e) =>
                    onUpdateTranslationField(activeLang, "short_description", e.target.value)
                  }
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-800"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export interface SupplierProductModalProps {
  activeModal: SupplierModalMode;
  editingProductId: string | null;
  profile: SupplierProfile | null;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  submitting: boolean;
  formError: string;
  expandOptionalByDefault: boolean;
  setExpandOptionalByDefault: (val: boolean) => void;
  // Core
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
  // Pricing & Series
  formPrice: number;
  setFormPrice: (val: number) => void;
  formBuyingPrice: number;
  setFormBuyingPrice: (val: number) => void;
  formCurrency: string;
  setFormCurrency: (val: string) => void;
  formMinOrderSeries: number;
  setFormMinOrderSeries: (val: number) => void;
  formIsActive: boolean;
  setFormIsActive: (val: boolean) => void;
  // Selectable Sizes & Series Stock
  sizeDefinitions: SizeDefinitionDTO[];
  seriesTemplates: SeriesTemplateDTO[];
  selectedSizes: string[];
  onToggleSize: (code: string) => void;
  onApplySeriesTemplate: (tpl: SeriesTemplateDTO) => void;
  seriesRatio: string;
  onSelectAssortmentMode: (mode: AssortmentMode) => void;
  seriesStock: number;
  setSeriesStock: (val: number) => void;
  // Images
  formImages: string[];
  imageUploadLoading: boolean;
  onUploadImageFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSetCoverImage: (index: number) => void;
  onRemoveImage: (index: number) => void;
  // Translations
  formTranslations: ProductTranslationsFormMap;
  onUpdateTranslationField: (
    lang: SupportedTranslationLang,
    field: TranslationFieldKey,
    val: string
  ) => void;
  autoTranslating: boolean;
  onAutoTranslateFromTurkish: () => void;
}

export function SupplierProductModal(props: Readonly<SupplierProductModalProps>) {
  const {
    activeModal,
    profile,
    onClose,
    onSubmit,
    submitting,
    formError,
    expandOptionalByDefault,
    setExpandOptionalByDefault,
  } = props;

  if (activeModal !== "create" && activeModal !== "edit") return null;

  const isCreate = activeModal === "create";
  const submitLabel = getSubmitButtonLabel(submitting, isCreate);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full overflow-hidden flex flex-col max-h-[94vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#1677ff] border border-blue-100 flex items-center justify-center">
              {isCreate ? <Plus size={18} /> : <Edit3 size={18} />}
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                {isCreate ? "Hızlı Toptan Ürün Ekle (Tek Ekran)" : "Toptan Ürünü Düzenle"}
              </h2>
              <p className="text-[11px] text-slate-500">
                Firma: <strong className="text-slate-800">{profile?.brand_name}</strong> • SKU otomatik üretilir, bedenler tanım tablosundan seçilir
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Single-Screen Express Form */}
        <form onSubmit={onSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-4 sm:p-5 overflow-y-auto flex-1 flex flex-col gap-4 bg-[#f8fafc]">
            {formError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2">
                <span>⚠️ {formError}</span>
              </div>
            )}

            <ExpressPhotosSection
              formImages={props.formImages}
              imageUploadLoading={props.imageUploadLoading}
              onUploadImageFile={props.onUploadImageFile}
              onSetCoverImage={props.onSetCoverImage}
              onRemoveImage={props.onRemoveImage}
            />

            <ExpressCoreAndPriceSection
              formTitle={props.formTitle}
              setFormTitle={props.setFormTitle}
              formCategoryId={props.formCategoryId}
              setFormCategoryId={props.setFormCategoryId}
              categories={props.categories}
              formPrice={props.formPrice}
              setFormPrice={props.setFormPrice}
              formCurrency={props.formCurrency}
              setFormCurrency={props.setFormCurrency}
            />

            <ExpressSeriesAndSizePickerSection
              sizeDefinitions={props.sizeDefinitions}
              seriesTemplates={props.seriesTemplates}
              selectedSizes={props.selectedSizes}
              onToggleSize={props.onToggleSize}
              onApplySeriesTemplate={props.onApplySeriesTemplate}
              seriesRatio={props.seriesRatio}
              onSelectAssortmentMode={props.onSelectAssortmentMode}
              seriesStock={props.seriesStock}
              setSeriesStock={props.setSeriesStock}
              unitPrice={props.formPrice}
              currency={props.formCurrency}
            />

            <ExpressColorAndFabricSection
              colors={props.colors}
              formColorId={props.formColorId}
              setFormColorId={props.setFormColorId}
              fabrics={props.fabrics}
              formFabricId={props.formFabricId}
              setFormFabricId={props.setFormFabricId}
            />

            <OptionalDetailsAndTranslationsSection
              expanded={expandOptionalByDefault}
              onToggleExpanded={() => setExpandOptionalByDefault(!expandOptionalByDefault)}
              formGender={props.formGender}
              setFormGender={props.setFormGender}
              formBuyingPrice={props.formBuyingPrice}
              setFormBuyingPrice={props.setFormBuyingPrice}
              formMinOrderSeries={props.formMinOrderSeries}
              setFormMinOrderSeries={props.setFormMinOrderSeries}
              formShortDesc={props.formShortDesc}
              setFormShortDesc={props.setFormShortDesc}
              formDescription={props.formDescription}
              setFormDescription={props.setFormDescription}
              formIsActive={props.formIsActive}
              setFormIsActive={props.setFormIsActive}
              formTitle={props.formTitle}
              formTranslations={props.formTranslations}
              onUpdateTranslationField={props.onUpdateTranslationField}
              autoTranslating={props.autoTranslating}
              onAutoTranslateFromTurkish={props.onAutoTranslateFromTurkish}
            />
          </div>

          {/* Sticky Express Footer */}
          <div className="px-5 py-3.5 border-t border-slate-200 bg-white flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              İptal
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 size={16} />
              <span>{submitLabel}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function getSubmitButtonLabel(submitting: boolean, isCreate: boolean): string {
  if (submitting) return "Kaydediliyor...";
  if (isCreate) return "Ürünü Hemen Vitrine Yayınla";
  return "Değişiklikleri Kaydet";
}
