"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import {
  Plus,
  Edit3,
  X,
  CheckCircle2,
  Sparkles,
  Layers,
  Coins,
  Check,
  Globe,
  Zap,
  SlidersHorizontal,
  FileText,
  Save,
  RotateCcw,
  Trash2,
  Loader2,
} from "lucide-react";
import type {
  SizeDefinitionDTO,
  SeriesTemplateDTO,
  SupplierSiblingItemDTO,
  InlineColorVariantDraft,
} from "@/types/integration";
import type {
  CategoryOption,
  AttributeItem,
  SupplierProfile,
  ProductTranslationsFormMap,
} from "./SupplierDashboardClient";
import { SupplierPhotoDropzone } from "./SupplierPhotoDropzone";
import {
  SupplierSiblingVariantSection,
  cleanAttributeName,
} from "./SupplierSiblingVariantSection";

export { cleanAttributeName };

export type SupportedTranslationLang =
  | "en"
  | "ru"
  | "ar"
  | "de"
  | "fr"
  | "pl"
  | "bg";
export type TranslationFieldKey = "title" | "short_description" | "description";
export type SupplierModalMode = "create" | "edit" | "delete" | null;
export type ProductModalViewMode = "express" | "detailed";
export type SizeGroupKey =
  | "letter"
  | "combo"
  | "numeric_eu"
  | "jeans"
  | "kids"
  | "shoes"
  | "standard";
export type AssortmentMode = "single" | "middle_double" | "double";

export const SUPPORTED_TRANSLATION_LANGS: readonly SupportedTranslationLang[] = [
  "en",
  "ru",
  "ar",
  "de",
  "fr",
  "pl",
  "bg",
];

export interface HierarchicalCategoryOption {
  id: string;
  fullLabel: string;
}

const PILL_SELECTED_CLASS = "bg-slate-900 text-white border-slate-900 shadow-xs";
const PILL_UNSELECTED_CLASS =
  "bg-white text-slate-700 border-slate-200 hover:border-slate-400 hover:bg-slate-50";

const LTREE_SEGMENT_LABELS: Record<string, string> = {
  kadin: "Kadın Giyim",
  kadin_giyim: "Kadın Giyim",
  erkek: "Erkek Giyim",
  erkek_giyim: "Erkek Giyim",
  buyuk_beden: "Büyük Beden",
  tesettur: "Tesettür Giyim",
  tesettur_giyim: "Tesettür Giyim",
  cocuk: "Çocuk & Bebek",
  cocuk_giyim: "Çocuk & Bebek",
  bebek: "Bebek Giyim",
  ic_giyim: "İç Giyim & Pijama",
  spor_giyim: "Spor Giyim",
  ayakkabi: "Ayakkabı & Çanta",
  aksesuar: "Aksesuar",
};

function humanizeLtreeSegment(segment: string): string {
  const key = segment.trim().toLowerCase();
  if (LTREE_SEGMENT_LABELS[key]) {
    return LTREE_SEGMENT_LABELS[key];
  }
  return key
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toLocaleUpperCase("tr-TR") + part.slice(1))
    .join(" ");
}

function resolveAncestorsFromParentId(
  cat: CategoryOption,
  byId: Map<string, CategoryOption>
): string[] {
  const ancestors: string[] = [];
  const visited = new Set<string>([cat.id]);
  let currentParentId = cat.parent_id;

  while (currentParentId && !visited.has(currentParentId)) {
    visited.add(currentParentId);
    const parent = byId.get(currentParentId);
    if (!parent) break;
    ancestors.unshift(parent.title);
    currentParentId = parent.parent_id;
  }

  return ancestors;
}

function resolveAncestorsFromNodePath(
  nodePath: string,
  byNodePath: Map<string, CategoryOption>
): string[] {
  if (!nodePath?.includes(".")) return [];
  const parts = nodePath.split(".").filter(Boolean);
  const titles: string[] = [];

  for (let i = 0; i < parts.length - 1; i += 1) {
    const prefix = parts.slice(0, i + 1).join(".");
    const found = byNodePath.get(prefix);
    if (found) {
      titles.push(found.title);
    } else if (parts[i].toLowerCase() !== "root") {
      titles.push(humanizeLtreeSegment(parts[i]));
    }
  }

  return titles;
}

export function buildHierarchicalCategoryOptions(
  categories: readonly CategoryOption[]
): HierarchicalCategoryOption[] {
  const byNodePath = new Map<string, CategoryOption>();
  const byId = new Map<string, CategoryOption>();

  for (const cat of categories) {
    byId.set(cat.id, cat);
    if (cat.node_path) {
      byNodePath.set(cat.node_path, cat);
    }
  }

  const formatted = categories.map((cat) => {
    const parentAncestors = cat.parent_id
      ? resolveAncestorsFromParentId(cat, byId)
      : [];
    const ancestors =
      parentAncestors.length > 0
        ? parentAncestors
        : resolveAncestorsFromNodePath(cat.node_path, byNodePath);

    const trail = [...ancestors, cat.title].filter(
      (segment, idx, arr) =>
        Boolean(segment) && (idx === 0 || arr[idx - 1] !== segment)
    );

    return {
      id: cat.id,
      fullLabel: trail.join(" › "),
    };
  });

  return formatted.sort((a, b) => a.fullLabel.localeCompare(b.fullLabel, "tr"));
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
const SEASON_PRESETS = ["İlkbahar/Yaz", "Sonbahar/Kış", "4 Mevsim", "Yeni Sezon"];

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

export const TRANSLATION_LANG_TABS: ReadonlyArray<{
  code: SupportedTranslationLang;
  label: string;
  shortLabel: string;
  flagCode: string;
  dir: "ltr" | "rtl";
}> = [
  { code: "en", label: "İngilizce (EN)", shortLabel: "EN", flagCode: "gb", dir: "ltr" },
  { code: "ru", label: "Rusça (RU)", shortLabel: "RU", flagCode: "ru", dir: "ltr" },
  { code: "ar", label: "Arapça (AR)", shortLabel: "AR", flagCode: "sa", dir: "rtl" },
  { code: "de", label: "Almanca (DE)", shortLabel: "DE", flagCode: "de", dir: "ltr" },
  { code: "fr", label: "Fransızca (FR)", shortLabel: "FR", flagCode: "fr", dir: "ltr" },
  { code: "pl", label: "Lehçe (PL)", shortLabel: "PL", flagCode: "pl", dir: "ltr" },
  { code: "bg", label: "Bulgarca (BG)", shortLabel: "BG", flagCode: "bg", dir: "ltr" },
];

export function buildSeriesRatioForMode(
  sizeCount: number,
  mode: AssortmentMode
): string {
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

export function detectAssortmentMode(
  seriesRatio: string,
  sizeCount: number
): AssortmentMode {
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
  if (
    sizeCount >= 3 &&
    weights[0] === 1 &&
    weights[sizeCount - 1] === 1 &&
    weights.includes(2)
  ) {
    return "middle_double";
  }
  return "single";
}

export function parseSeriesRatioWeights(
  seriesRatio: string,
  sizeCount: number
): number[] {
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

function isSeriesTemplateSelected(
  tpl: SeriesTemplateDTO,
  selectedSizes: readonly string[],
  seriesRatio: string
): boolean {
  return (
    tpl.sizes.length === selectedSizes.length &&
    tpl.sizes.every((sz, idx) => selectedSizes[idx] === sz) &&
    tpl.series_ratio === seriesRatio
  );
}

interface ExpressCompactModeSectionProps {
  readonly formTitle: string;
  readonly setFormTitle: (v: string) => void;
  readonly formPrice: number;
  readonly setFormPrice: (v: number) => void;
  readonly formCurrency: string;
  readonly setFormCurrency: (v: string) => void;
  readonly formColorId: string;
  readonly setFormColorId: (v: string) => void;
  readonly colors: readonly AttributeItem[];
  readonly formCategoryId: string;
  readonly setFormCategoryId: (v: string) => void;
  readonly hierarchicalCategories: readonly HierarchicalCategoryOption[];
  readonly seriesTemplates: readonly SeriesTemplateDTO[];
  readonly selectedSizes: readonly string[];
  readonly seriesRatio: string;
  readonly onApplySeriesTemplate: (tpl: SeriesTemplateDTO) => void;
  readonly seriesStock: number;
  readonly setSeriesStock: (v: number) => void;
  readonly onSwitchToDetailed: () => void;
}

function ExpressCompactModeSection({
  formTitle,
  setFormTitle,
  formPrice,
  setFormPrice,
  formCurrency,
  setFormCurrency,
  formColorId,
  setFormColorId,
  colors,
  formCategoryId,
  setFormCategoryId,
  hierarchicalCategories,
  seriesTemplates,
  selectedSizes,
  seriesRatio,
  onApplySeriesTemplate,
  seriesStock,
  setSeriesStock,
  onSwitchToDetailed,
}: ExpressCompactModeSectionProps) {
  const effectiveTemplates =
    seriesTemplates.length > 0 ? seriesTemplates : FALLBACK_SERIES_TEMPLATES;
  const currencySymbol = getCurrencySymbol(formCurrency);
  const weights = parseSeriesRatioWeights(seriesRatio, selectedSizes.length);
  const unitsPerSeries = weights.reduce((acc, w) => acc + w, 0);
  const safeSeriesStock = Math.max(1, seriesStock || 100);
  const totalPieces = unitsPerSeries * safeSeriesStock;

  return (
    <>
      {/* Single Crisp Row: Model Adı + Toptan Satış Fiyatı + Döviz + Ana Renk */}
      <section className="p-4 rounded-xl bg-white border border-slate-200/90 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-slate-900 text-white text-xs font-extrabold flex items-center justify-center">
              2
            </span>
            <span className="text-xs font-extrabold text-slate-900">
              Model Adı, Toptan Fiyat &amp; Ana Renk
            </span>
          </div>
          <span className="text-[10px] font-semibold text-slate-400">
            Taslak için yalnızca fotoğraf veya başlık yeterlidir
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-end">
          <div className="lg:col-span-5 flex flex-col gap-1">
            <label htmlFor="supp-express-title" className="text-[11px] font-bold text-slate-700">
              Model Adı <span className="text-red-500">*</span>
            </label>
            <input
              id="supp-express-title"
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="Örn: Kuşaklı Keten İkili Takım"
              className="h-10 w-full px-3 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
            />
          </div>

          <div className="lg:col-span-3 flex flex-col gap-1">
            <label htmlFor="supp-express-price" className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
              <Coins size={12} className="text-slate-600" />
              <span>Toptan Satış Fiyatı</span>
            </label>
            <div className="relative">
              <input
                id="supp-express-price"
                type="number"
                step="0.01"
                min="0"
                value={formPrice || ""}
                onChange={(e) => setFormPrice(Number(e.target.value))}
                placeholder="0.00"
                className="h-10 w-full pl-3 pr-8 rounded-lg bg-white border border-slate-300 text-sm font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-extrabold text-slate-500">
                {currencySymbol}
              </span>
            </div>
          </div>

          <div className="lg:col-span-2 flex flex-col gap-1">
            <span className="text-[11px] font-bold text-slate-700">Döviz</span>
            <div className="grid grid-cols-3 gap-1 h-10">
              {(["TRY", "USD", "EUR"] as const).map((curr) => (
                <button
                  key={curr}
                  type="button"
                  onClick={() => setFormCurrency(curr)}
                  className={`rounded-lg border text-[11px] font-extrabold transition-all cursor-pointer ${
                    formCurrency === curr ? PILL_SELECTED_CLASS : PILL_UNSELECTED_CLASS
                  }`}
                >
                  {curr}
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 flex flex-col gap-1">
            <label htmlFor="supp-express-color" className="text-[11px] font-bold text-slate-700">
              Ana Renk
            </label>
            <select
              id="supp-express-color"
              value={formColorId}
              onChange={(e) => setFormColorId(e.target.value)}
              className="h-10 w-full px-2.5 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-900"
            >
              <option value="">-- Renk --</option>
              {colors.map((col) => (
                <option key={col.id} value={col.id}>
                  {cleanAttributeName(col.name)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Compact Kategori & Seri Kalıbı Barı */}
      <section className="p-4 rounded-xl bg-white border border-slate-200/90 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-slate-900 text-white text-xs font-extrabold flex items-center justify-center">
              3
            </span>
            <span className="text-xs font-extrabold text-slate-900">
              Kategori &amp; Seri Kalıbı Barı
            </span>
          </div>
          <button
            type="button"
            onClick={onSwitchToDetailed}
            className="text-[11px] font-bold text-slate-600 hover:text-slate-900 underline underline-offset-2 cursor-pointer"
          >
            Özel beden / asorti seçimi için Detaylı Mod →
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
          <div className="lg:col-span-5 flex flex-col gap-1">
            <label htmlFor="supp-express-category" className="text-[11px] font-bold text-slate-700">
              Kategori <span className="text-red-500">*</span>
            </label>
            <select
              id="supp-express-category"
              value={formCategoryId}
              onChange={(e) => setFormCategoryId(e.target.value)}
              className="h-10 w-full px-3 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-900"
            >
              <option value="">-- Kategori Seçiniz --</option>
              {hierarchicalCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullLabel}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-7 flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[11px] font-bold text-slate-700">
                Hızlı Seri Şablonu (Seçili: <strong className="text-slate-900">{selectedSizes.join("-")}</strong>)
              </span>
              <span className="text-[11px] font-extrabold text-emerald-700">
                {unitsPerSeries} Adet/Seri • {totalPieces} Toplam Adet
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {effectiveTemplates.slice(0, 6).map((tpl) => {
                const selected = isSeriesTemplateSelected(tpl, selectedSizes, seriesRatio);
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => onApplySeriesTemplate(tpl)}
                    className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-all cursor-pointer inline-flex items-center gap-1 ${
                      selected ? PILL_SELECTED_CLASS : PILL_UNSELECTED_CLASS
                    }`}
                  >
                    {selected && <Check size={11} />}
                    <span>{tpl.name.split(" (")[0]}</span>
                  </button>
                );
              })}
              {effectiveTemplates
                .filter((tpl) => tpl.template_key === "std_1")
                .map((tpl) => {
                  const selected = isSeriesTemplateSelected(tpl, selectedSizes, seriesRatio);
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => onApplySeriesTemplate(tpl)}
                      className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-all cursor-pointer inline-flex items-center gap-1 ${
                        selected ? PILL_SELECTED_CLASS : PILL_UNSELECTED_CLASS
                      }`}
                    >
                      {selected && <Check size={11} />}
                      <span>STD</span>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
            <Layers size={13} className="text-slate-600" />
            <span>Tahmini Seri Stoğu:</span>
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {SERIES_STOCK_PRESETS.map((cnt) => (
              <button
                key={cnt}
                type="button"
                onClick={() => setSeriesStock(cnt)}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all cursor-pointer ${
                  safeSeriesStock === cnt ? PILL_SELECTED_CLASS : PILL_UNSELECTED_CLASS
                }`}
              >
                {cnt} Seri
              </button>
            ))}
            <input
              type="number"
              min="1"
              aria-label="Tahmini Seri Adedi"
              value={safeSeriesStock}
              onChange={(e) => setSeriesStock(Math.max(1, Number(e.target.value) || 1))}
              className="w-20 h-7 px-2 rounded-lg border border-slate-300 text-xs font-extrabold text-slate-900 text-center focus:outline-none focus:border-slate-900"
            />
          </div>
        </div>
      </section>
    </>
  );
}

interface ExpressCoreAndPriceSectionProps {
  readonly formTitle: string;
  readonly setFormTitle: (v: string) => void;
  readonly formCategoryId: string;
  readonly setFormCategoryId: (v: string) => void;
  readonly hierarchicalCategories: readonly HierarchicalCategoryOption[];
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
  hierarchicalCategories,
  formPrice,
  setFormPrice,
  formCurrency,
  setFormCurrency,
}: ExpressCoreAndPriceSectionProps) {
  const currencySymbol = getCurrencySymbol(formCurrency);

  return (
    <section className="p-4 rounded-xl bg-white border border-slate-200/90 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 rounded-md bg-slate-900 text-white text-xs font-extrabold flex items-center justify-center">
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
            className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
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
            className="w-full px-3 py-2.5 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
          >
            <option value="">-- Kategori Seçiniz --</option>
            {hierarchicalCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullLabel}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-7 flex flex-col gap-1">
          <label htmlFor="supp-price" className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Coins size={13} className="text-slate-700" />
            <span>
              Tekil Ürün Toptan Satış Fiyatı (1 Adet) <span className="text-red-500">*</span>
            </span>
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
              className="w-full pl-3.5 pr-10 py-2.5 rounded-lg bg-white border border-slate-300 text-sm font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
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
                  formCurrency === curr ? PILL_SELECTED_CLASS : PILL_UNSELECTED_CLASS
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
  const effectiveSizes =
    sizeDefinitions.length > 0 ? sizeDefinitions : FALLBACK_SIZE_DEFINITIONS;
  const effectiveTemplates =
    seriesTemplates.length > 0 ? seriesTemplates : FALLBACK_SERIES_TEMPLATES;

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

  return (
    <section className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/90 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-md bg-slate-900 text-white text-xs font-extrabold flex items-center justify-center">
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
        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
          <Sparkles size={13} className="text-slate-900" />
          <span>Hazır Merter Seri Şablonları (Tek Tıkla Uygula)</span>
        </span>
        <div className="flex flex-wrap gap-1.5">
          {effectiveTemplates.map((tpl) => {
            const selected = isSeriesTemplateSelected(tpl, selectedSizes, seriesRatio);
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => {
                  onApplySeriesTemplate(tpl);
                  setActiveGroup(inferSizeGroupFromSelected(tpl.sizes, effectiveSizes));
                }}
                className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  selected ? PILL_SELECTED_CLASS : PILL_UNSELECTED_CLASS
                }`}
              >
                {selected && <Check size={12} />}
                <span>{tpl.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Predefined Size Definitions Picker */}
      <div className="p-3.5 rounded-xl bg-white border border-slate-200 flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs font-bold text-slate-800">
            Beden Tanım Tablosundan Seçin <span className="text-red-500">*</span>
          </span>
          <span className="text-[11px] font-semibold text-slate-500">
            Seçili: <strong className="text-slate-900">{selectedSizes.join(" - ") || "Yok"}</strong>
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 border-b border-slate-100 pb-2.5">
          {SIZE_GROUP_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveGroup(tab.key)}
              className={`px-2.5 py-1 rounded-md border text-[11px] font-bold transition-all cursor-pointer ${
                activeGroup === tab.key ? PILL_SELECTED_CLASS : PILL_UNSELECTED_CLASS
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
                  isChecked ? PILL_SELECTED_CLASS : PILL_UNSELECTED_CLASS
                }`}
              >
                {isChecked && <Check size={12} />}
                <span>{sz.label}</span>
              </button>
            );
          })}
        </div>

        {selectedSizes.length > 1 && (
          <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-slate-600">
              1 Serideki Beden Dağılımı (Asorti):
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => onSelectAssortmentMode("single")}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all cursor-pointer ${
                  activeAssortment === "single" ? PILL_SELECTED_CLASS : PILL_UNSELECTED_CLASS
                }`}
              >
                Her Bedenden 1 Adet ({buildSeriesRatioForMode(selectedSizes.length, "single")})
              </button>
              {selectedSizes.length >= 3 && (
                <button
                  type="button"
                  onClick={() => onSelectAssortmentMode("middle_double")}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all cursor-pointer ${
                    activeAssortment === "middle_double" ? PILL_SELECTED_CLASS : PILL_UNSELECTED_CLASS
                  }`}
                >
                  Orta Bedenler Çift ({buildSeriesRatioForMode(selectedSizes.length, "middle_double")})
                </button>
              )}
              <button
                type="button"
                onClick={() => onSelectAssortmentMode("double")}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all cursor-pointer ${
                  activeAssortment === "double" ? PILL_SELECTED_CLASS : PILL_UNSELECTED_CLASS
                }`}
              >
                Çiftli Seri ({buildSeriesRatioForMode(selectedSizes.length, "double")})
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Estimated Series Count + Live Emerald Seri Summary Box */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center p-3.5 rounded-xl bg-white border border-slate-200">
        <div className="md:col-span-7 flex flex-col gap-1.5">
          <label htmlFor="supp-series-stock" className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
            <Layers size={14} className="text-slate-700" />
            <span>Eldeki Tahmini Seri Adedi (Varsayılan: 100 Seri)</span>
          </label>
          <div className="flex flex-wrap items-center gap-1.5">
            {SERIES_STOCK_PRESETS.map((cnt) => (
              <button
                key={cnt}
                type="button"
                onClick={() => setSeriesStock(cnt)}
                className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                  safeSeriesStock === cnt ? PILL_SELECTED_CLASS : PILL_UNSELECTED_CLASS
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
              className="w-24 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-extrabold text-slate-900 text-center focus:outline-none focus:border-slate-900"
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
            <span className="font-extrabold text-emerald-700">
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
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all cursor-pointer ${
                  isSelected ? PILL_SELECTED_CLASS : PILL_UNSELECTED_CLASS
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
          className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-slate-900"
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
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all cursor-pointer ${
                  isSelected ? PILL_SELECTED_CLASS : PILL_UNSELECTED_CLASS
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
          className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-slate-900"
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

interface DetailedMetadataAndTranslationsSectionProps {
  readonly formGender: string;
  readonly setFormGender: (v: string) => void;
  readonly formSeason: string;
  readonly setFormSeason: (v: string) => void;
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

function DetailedMetadataAndTranslationsSection({
  formGender,
  setFormGender,
  formSeason,
  setFormSeason,
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
}: DetailedMetadataAndTranslationsSectionProps) {
  const [activeLang, setActiveLang] = useState<SupportedTranslationLang>("en");
  const currentLangMeta =
    TRANSLATION_LANG_TABS.find((t) => t.code === activeLang) ?? TRANSLATION_LANG_TABS[0];
  const currentFields = formTranslations[activeLang];
  const seasonOptions = SEASON_PRESETS.includes(formSeason) || !formSeason
    ? SEASON_PRESETS
    : [formSeason, ...SEASON_PRESETS];

  return (
    <section className="p-4 rounded-xl bg-white border border-slate-200/90 flex flex-col gap-4">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
        <Globe size={15} className="text-slate-700" />
        <span className="text-xs font-extrabold text-slate-900">
          Detaylı Özellikler, Yayın Ayarı &amp; 7 Dilde İhracat Çevirisi
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="supp-gender" className="text-xs font-semibold text-slate-700">
            Hedef Kitle / Cinsiyet
          </label>
          <select
            id="supp-gender"
            value={formGender}
            onChange={(e) => setFormGender(e.target.value)}
            className="h-9 px-3 rounded-lg border border-slate-300 text-xs text-slate-800 bg-white focus:outline-none focus:border-slate-900"
          >
            <option value="Kadın">Kadın Giyim</option>
            <option value="Erkek">Erkek Giyim</option>
            <option value="Unisex">Unisex</option>
            <option value="Çocuk">Çocuk Giyim</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="supp-season" className="text-xs font-semibold text-slate-700">
            Sezon
          </label>
          <select
            id="supp-season"
            value={formSeason}
            onChange={(e) => setFormSeason(e.target.value)}
            className="h-9 px-3 rounded-lg border border-slate-300 text-xs text-slate-800 bg-white focus:outline-none focus:border-slate-900"
          >
            {seasonOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="supp-min-series" className="text-xs font-semibold text-slate-700">
            Min. Sipariş (Seri)
          </label>
          <input
            id="supp-min-series"
            type="number"
            min="1"
            value={formMinOrderSeries}
            onChange={(e) => setFormMinOrderSeries(Math.max(1, Number(e.target.value) || 1))}
            className="h-9 px-3 rounded-lg border border-slate-300 text-xs font-bold text-slate-800 focus:outline-none focus:border-slate-900"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="supp-buying-price" className="text-xs font-semibold text-slate-700">
            Gizli Birim Maliyet
          </label>
          <input
            id="supp-buying-price"
            type="number"
            step="0.01"
            min="0"
            value={formBuyingPrice || ""}
            onChange={(e) => setFormBuyingPrice(Number(e.target.value))}
            placeholder="0.00"
            className="h-9 px-3 rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-slate-900"
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
            className="px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-slate-900"
          />
        </div>

        <div className="flex items-center justify-between px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-200">
          <div>
            <span className="text-xs font-bold text-slate-800 block">Vitrin Yayın Durumu</span>
            <span className="text-[10px] text-slate-500">
              {formIsActive ? "Vitrinde alıcılara açık görünür" : "Taslak / Pasif durumda"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setFormIsActive(!formIsActive)}
            className={`w-11 h-6 rounded-full transition-colors p-0.5 cursor-pointer flex items-center ${
              formIsActive ? "bg-emerald-600 justify-end" : "bg-slate-300 justify-start"
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
          className="px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-slate-900"
        />
      </div>

      {/* 7-Language Export Translation */}
      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-xs font-bold text-slate-900">
            İhracat Vitrini Çok Dilli AI Çeviri (EN / RU / AR / DE / FR / PL / BG)
          </span>
          <button
            type="button"
            onClick={onAutoTranslateFromTurkish}
            disabled={autoTranslating || !formTitle.trim()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold cursor-pointer disabled:opacity-50 shrink-0"
          >
            {autoTranslating ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Sparkles size={13} />
            )}
            <span>{autoTranslating ? "7 Dile Çevriliyor..." : "Türkçeden 7 Dile Çevir"}</span>
          </button>
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {TRANSLATION_LANG_TABS.map((tab) => {
            const hasContent = Boolean(formTranslations[tab.code]?.title?.trim());
            return (
              <button
                key={tab.code}
                type="button"
                onClick={() => setActiveLang(tab.code)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                  activeLang === tab.code ? PILL_SELECTED_CLASS : PILL_UNSELECTED_CLASS
                }`}
              >
                <Image
                  unoptimized
                  src={`https://flagcdn.com/w20/${tab.flagCode}.png`}
                  alt={tab.shortLabel}
                  width={16}
                  height={12}
                  className="w-4 h-3 object-cover rounded-[2px] border border-slate-200/80 shrink-0"
                />
                <span>{tab.label}</span>
                {hasContent && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      activeLang === tab.code ? "bg-emerald-400" : "bg-emerald-500"
                    }`}
                  />
                )}
              </button>
            );
          })}
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
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-slate-900"
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
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-slate-900"
            />
          </div>

          <div className="sm:col-span-2 flex flex-col gap-1">
            <label htmlFor={`tr-desc-${activeLang}`} className="text-[11px] font-semibold text-slate-700">
              {currentLangMeta.label} Detaylı Açıklama
            </label>
            <textarea
              id={`tr-desc-${activeLang}`}
              rows={2}
              value={currentFields.description}
              onChange={(e) =>
                onUpdateTranslationField(activeLang, "description", e.target.value)
              }
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-slate-900"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export interface SupplierProductModalProps {
  activeModal: SupplierModalMode;
  editingProductId: string | null;
  profile: SupplierProfile | null;
  getToken: () => string | null;
  onClose: () => void;
  onPublishOrUpdate: (e: React.FormEvent) => void;
  onSaveDraft: () => void;
  onSaveAndNextColor: () => void;
  submitting: boolean;
  formError: string;
  formNotice: string;
  modalViewMode: ProductModalViewMode;
  setModalViewMode: (mode: ProductModalViewMode) => void;
  // Draft Recovery Banner
  localDraftSavedAt: string | null;
  onRestoreLocalDraft: () => void;
  onDiscardLocalDraft: () => void;
  // Core
  formTitle: string;
  setFormTitle: (val: string) => void;
  formCategoryId: string;
  setFormCategoryId: (val: string) => void;
  categories: CategoryOption[];
  formGender: string;
  setFormGender: (val: string) => void;
  formSeason: string;
  setFormSeason: (val: string) => void;
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
  onUploadImageFiles: (files: File[]) => void | Promise<void>;
  onReorderImages: (fromIdx: number, toIdx: number) => void;
  onSetCoverImage: (index: number) => void;
  onRemoveImage: (index: number) => void;
  // Siblings & Multi-Color Variants
  sourceProductGroupId: string;
  supplierSiblings: SupplierSiblingItemDTO[];
  onSiblingsUpdated: (groupId: string, siblings: SupplierSiblingItemDTO[]) => void;
  linkWithProduct: SupplierSiblingItemDTO | null;
  onChangeLinkWithProduct: (target: SupplierSiblingItemDTO | null) => void;
  additionalColorVariants: InlineColorVariantDraft[];
  onChangeAdditionalColorVariants: (
    updater: (prev: InlineColorVariantDraft[]) => InlineColorVariantDraft[]
  ) => void;
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
    editingProductId,
    profile,
    getToken,
    onClose,
    onPublishOrUpdate,
    onSaveDraft,
    onSaveAndNextColor,
    submitting,
    formError,
    formNotice,
    modalViewMode,
    setModalViewMode,
    localDraftSavedAt,
    onRestoreLocalDraft,
    onDiscardLocalDraft,
  } = props;

  const hierarchicalCategories = useMemo(
    () => buildHierarchicalCategoryOptions(props.categories),
    [props.categories]
  );

  if (activeModal !== "create" && activeModal !== "edit") return null;

  const isCreate = activeModal === "create";
  const primaryLabel = getPrimarySubmitLabel(submitting, isCreate, props.formIsActive);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-5xl w-full overflow-hidden flex flex-col max-h-[94vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header with Express vs Detailed Mode Toggle */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs shrink-0">
              {isCreate ? <Plus size={18} /> : <Edit3 size={18} />}
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                {isCreate ? "Toptan Ürün Ekle" : "Toptan Ürünü Düzenle"}
              </h2>
              <p className="text-[11px] text-slate-500">
                Firma: <strong className="text-slate-800">{profile?.brand_name}</strong> • Otomatik SKU &amp; Beden Matrisi
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
              <button
                type="button"
                onClick={() => setModalViewMode("express")}
                className={`h-8 px-3 rounded-lg text-xs font-extrabold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                  modalViewMode === "express"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Zap size={13} className={modalViewMode === "express" ? "text-amber-500" : ""} />
                <span>⚡ Hızlı Giriş</span>
              </button>
              <button
                type="button"
                onClick={() => setModalViewMode("detailed")}
                className={`h-8 px-3 rounded-lg text-xs font-extrabold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                  modalViewMode === "detailed"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <SlidersHorizontal size={13} />
                <span>🎛️ Detaylı Mod &amp; Çeviri</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <form noValidate onSubmit={onPublishOrUpdate} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-4 sm:p-5 overflow-y-auto flex-1 flex flex-col gap-4 bg-[#f8fafc]">
            {/* Local Unsaved Draft Recovery Banner */}
            {isCreate && localDraftSavedAt && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                  <RotateCcw size={15} className="text-amber-700 shrink-0" />
                  <span>
                    Yarım kalmış ürün taslağı bulundu ({localDraftSavedAt}). Devam etmek ister misiniz?
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onRestoreLocalDraft}
                    className="h-7 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-extrabold cursor-pointer transition-colors"
                  >
                    Taslağı Geri Yükle
                  </button>
                  <button
                    type="button"
                    onClick={onDiscardLocalDraft}
                    className="h-7 px-2.5 rounded-lg bg-white hover:bg-amber-100 text-amber-800 border border-amber-300 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Trash2 size={11} />
                    <span>Temizle</span>
                  </button>
                </div>
              </div>
            )}

            {formNotice && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                <span>{formNotice}</span>
              </div>
            )}

            {formError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2">
                <span>{formError}</span>
              </div>
            )}

            {/* Drag-and-Drop + Paste + Reorder Photo Studio */}
            <SupplierPhotoDropzone
              images={props.formImages}
              uploading={props.imageUploadLoading}
              onUploadFiles={props.onUploadImageFiles}
              onReorderImages={props.onReorderImages}
              onSetCoverImage={props.onSetCoverImage}
              onRemoveImage={props.onRemoveImage}
              enablePaste
              stepNumber={1}
              inputId="supp-express-photos"
            />

            {modalViewMode === "express" ? (
              <ExpressCompactModeSection
                formTitle={props.formTitle}
                setFormTitle={props.setFormTitle}
                formPrice={props.formPrice}
                setFormPrice={props.setFormPrice}
                formCurrency={props.formCurrency}
                setFormCurrency={props.setFormCurrency}
                formColorId={props.formColorId}
                setFormColorId={props.setFormColorId}
                colors={props.colors}
                formCategoryId={props.formCategoryId}
                setFormCategoryId={props.setFormCategoryId}
                hierarchicalCategories={hierarchicalCategories}
                seriesTemplates={props.seriesTemplates}
                selectedSizes={props.selectedSizes}
                seriesRatio={props.seriesRatio}
                onApplySeriesTemplate={props.onApplySeriesTemplate}
                seriesStock={props.seriesStock}
                setSeriesStock={props.setSeriesStock}
                onSwitchToDetailed={() => setModalViewMode("detailed")}
              />
            ) : (
              <>
                <ExpressCoreAndPriceSection
                  formTitle={props.formTitle}
                  setFormTitle={props.setFormTitle}
                  formCategoryId={props.formCategoryId}
                  setFormCategoryId={props.setFormCategoryId}
                  hierarchicalCategories={hierarchicalCategories}
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
              </>
            )}

            {/* Collapsible Color Sibling Linker & Multi-Color Variant Studio */}
            <SupplierSiblingVariantSection
              isCreate={isCreate}
              editingProductId={editingProductId}
              getToken={getToken}
              colors={props.colors}
              formTitle={props.formTitle}
              formPrice={props.formPrice}
              formCurrency={props.formCurrency}
              sourceProductGroupId={props.sourceProductGroupId}
              supplierSiblings={props.supplierSiblings}
              onSiblingsUpdated={props.onSiblingsUpdated}
              linkWithProduct={props.linkWithProduct}
              onChangeLinkWithProduct={props.onChangeLinkWithProduct}
              additionalColorVariants={props.additionalColorVariants}
              onChangeAdditionalColorVariants={props.onChangeAdditionalColorVariants}
            />

            {modalViewMode === "detailed" && (
              <DetailedMetadataAndTranslationsSection
                formGender={props.formGender}
                setFormGender={props.setFormGender}
                formSeason={props.formSeason}
                setFormSeason={props.setFormSeason}
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
            )}
          </div>

          {/* Sticky Multi-Action Footer */}
          <div className="px-4 sm:px-5 py-3.5 border-t border-slate-200 bg-white flex flex-wrap items-center justify-between gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 inline-flex items-center justify-center rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 cursor-pointer transition-colors"
            >
              İptal
            </button>

            <div className="flex flex-wrap items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onSaveDraft}
                disabled={submitting || props.imageUploadLoading}
                className="h-10 px-4 inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-extrabold cursor-pointer disabled:opacity-50 transition-colors"
              >
                <FileText size={14} />
                <span>📝 Taslak Kaydet</span>
              </button>

              <button
                type="button"
                onClick={onSaveAndNextColor}
                disabled={submitting || props.imageUploadLoading}
                className="h-10 px-4 inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold cursor-pointer disabled:opacity-50 transition-colors"
              >
                <Zap size={14} className="text-amber-400" />
                <span>⚡ Kaydet &amp; Yeni Rengini Aç</span>
              </button>

              <button
                type="submit"
                disabled={submitting || props.imageUploadLoading}
                className="h-10 inline-flex items-center justify-center gap-2 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : isCreate || !props.formIsActive ? (
                  <CheckCircle2 size={15} />
                ) : (
                  <Save size={15} />
                )}
                <span>{primaryLabel}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function getPrimarySubmitLabel(
  submitting: boolean,
  isCreate: boolean,
  isActive: boolean
): string {
  if (submitting) return "Kaydediliyor...";
  if (isCreate || !isActive) return "✅ Vitrine Yayınla";
  return "💾 Güncelle";
}
