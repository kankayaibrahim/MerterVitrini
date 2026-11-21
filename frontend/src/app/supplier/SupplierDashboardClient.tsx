"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { 
  Building2, 
  Package, 
  Plus, 
  Search, 
  RefreshCw, 
  LogOut, 
  CheckCircle2, 
  Trash2, 
  Edit3, 
  Layers, 
  Tag,
  MessageSquare,
  ShoppingBag,
  CreditCard,
  BarChart3,
  FileText,
  Globe,
  FileSpreadsheet,
  Archive,
  ArchiveRestore,
  Camera,
  CopyPlus,
  Rocket,
  Loader2,
  AlertCircle,
  X
} from "lucide-react";
import {
  SupplierProductRow,
  SizeDefinitionDTO,
  SeriesTemplateDTO,
  SupplierSiblingItemDTO,
  InlineColorVariantDraft,
} from "@/types/integration";
import {
  SupplierProductModal,
  FALLBACK_SIZE_DEFINITIONS,
  SUPPORTED_TRANSLATION_LANGS,
  buildHierarchicalCategoryOptions,
  buildSeriesRatioForMode,
  detectAssortmentMode,
  parseSeriesRatioWeights,
  sortSelectedSizesByDefinitions,
  type SupportedTranslationLang,
  type TranslationFieldKey,
  type SupplierModalMode,
  type ProductModalViewMode,
  type AssortmentMode,
} from "./SupplierProductModal";
import {
  SupplierExcelImportModal,
  SupplierCollectionArchiveModal,
  toggleSupplierProductArchiveApi,
} from "./SupplierBulkAndArchiveModals";
import {
  performMultiImageUpload,
  reorderImageList,
} from "./SupplierPhotoDropzone";
import { cleanAttributeName } from "./SupplierSiblingVariantSection";
import { SupplierQuickDraftModal } from "./SupplierQuickDraftModal";
import SupplierChatPanel from "./SupplierChatPanel";
import SupplierOrdersPanel from "./SupplierOrdersPanel";
import SupplierProfilePanel from "./SupplierProfilePanel";
import SupplierBillingPanel from "./SupplierBillingPanel";
import SupplierAnalyticsPanel from "./SupplierAnalyticsPanel";
import SupplierRfqPanel from "./SupplierRfqPanel";

export interface CategoryOption {
  id: string;
  title: string;
  slug: string;
  node_path: string;
  parent_id?: string | null;
}

export interface AttributeItem {
  id: string;
  name: string;
  code?: string;
}

export interface VariantFormItem {
  id?: string;
  size: string;
  stock: number;
  barcode: string;
}

export interface ProductTranslationFormItem {
  title: string;
  short_description: string;
  description: string;
}

export type ProductTranslationsFormMap = Record<
  SupportedTranslationLang,
  ProductTranslationFormItem
>;

export function createEmptyTranslations(): ProductTranslationsFormMap {
  return {
    en: { title: "", short_description: "", description: "" },
    ru: { title: "", short_description: "", description: "" },
    ar: { title: "", short_description: "", description: "" },
    de: { title: "", short_description: "", description: "" },
    fr: { title: "", short_description: "", description: "" },
    pl: { title: "", short_description: "", description: "" },
    bg: { title: "", short_description: "", description: "" },
  };
}

export interface SupplierProfile {
  sub: string;
  brand_id: string;
  brand_name: string;
  alias_code: string;
  email: string;
  contact_name: string;
  role: string;
}

interface DashboardStats {
  total_products: number;
  active_products: number;
  draft_products?: number;
  total_stock: number;
  total_variants: number;
  total_orders?: number;
}

const DEFAULT_SELECTED_SIZES = ["S", "M", "L", "XL"];
const DEFAULT_SERIES_RATIO = "1-1-1-1";
const DEFAULT_SERIES_STOCK = 100;

const LAST_DEFAULTS_STORAGE_KEY = "mv_supplier_last_defaults_v1";
const UNSAVED_DRAFT_STORAGE_KEY = "mv_supplier_unsaved_draft_v1";

interface SupplierLastDefaults {
  categoryId: string;
  currency: string;
  selectedSizes: string[];
  seriesRatio: string;
  seriesStock: number;
  gender: string;
  season: string;
}

interface SupplierUnsavedDraft {
  savedAt: string;
  title: string;
  shortDesc: string;
  description: string;
  categoryId: string;
  colorId: string;
  fabricId: string;
  gender: string;
  season: string;
  buyingPrice: number;
  price: number;
  currency: string;
  selectedSizes: string[];
  seriesRatio: string;
  seriesStock: number;
  minOrderSeries: number;
  isActive: boolean;
  images: string[];
  translations: ProductTranslationsFormMap;
  linkWithProduct: SupplierSiblingItemDTO | null;
  additionalColorVariants: InlineColorVariantDraft[];
}

function readSupplierLastDefaults(): Partial<SupplierLastDefaults> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LAST_DEFAULTS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SupplierLastDefaults>;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function saveSupplierLastDefaults(defaults: SupplierLastDefaults): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LAST_DEFAULTS_STORAGE_KEY, JSON.stringify(defaults));
  } catch {
    // Ignore storage quota / privacy mode errors
  }
}

function readSupplierUnsavedDraft(): SupplierUnsavedDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(UNSAVED_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SupplierUnsavedDraft>;
    if (!parsed || typeof parsed !== "object" || !parsed.savedAt) return null;
    const hasData =
      Boolean(parsed.title?.trim()) ||
      (Array.isArray(parsed.images) && parsed.images.length > 0) ||
      Number(parsed.price || 0) > 0 ||
      Boolean(parsed.linkWithProduct) ||
      (Array.isArray(parsed.additionalColorVariants) &&
        parsed.additionalColorVariants.length > 0);
    if (!hasData) return null;
    return {
      savedAt: parsed.savedAt,
      title: parsed.title || "",
      shortDesc: parsed.shortDesc || "",
      description: parsed.description || "",
      categoryId: parsed.categoryId || "",
      colorId: parsed.colorId || "",
      fabricId: parsed.fabricId || "",
      gender: parsed.gender || "Kadın",
      season: parsed.season || "İlkbahar/Yaz",
      buyingPrice: Number(parsed.buyingPrice) || 0,
      price: Number(parsed.price) || 0,
      currency: parsed.currency || "TRY",
      selectedSizes:
        Array.isArray(parsed.selectedSizes) && parsed.selectedSizes.length > 0
          ? parsed.selectedSizes
          : [...DEFAULT_SELECTED_SIZES],
      seriesRatio: parsed.seriesRatio || DEFAULT_SERIES_RATIO,
      seriesStock: Number(parsed.seriesStock) || DEFAULT_SERIES_STOCK,
      minOrderSeries: Number(parsed.minOrderSeries) || 1,
      isActive: typeof parsed.isActive === "boolean" ? parsed.isActive : true,
      images: Array.isArray(parsed.images) ? parsed.images : [],
      translations: parsed.translations || createEmptyTranslations(),
      linkWithProduct: parsed.linkWithProduct ?? null,
      additionalColorVariants: Array.isArray(parsed.additionalColorVariants)
        ? parsed.additionalColorVariants
        : [],
    };
  } catch {
    return null;
  }
}

function saveSupplierUnsavedDraft(draft: SupplierUnsavedDraft): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(UNSAVED_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Ignore storage errors
  }
}

function clearSupplierUnsavedDraft(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(UNSAVED_DRAFT_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

function formatDraftTimestamp(iso: string): string {
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

function isAuthStatusError(status: number): boolean {
  return status === 401 || status === 403;
}

function validateProductForm(
  title: string,
  categoryId: string,
  price: number,
  selectedSizes: string[],
  isDraft: boolean,
  images: readonly string[]
): string {
  if (isDraft) {
    if (images.length === 0 && !title.trim()) {
      return "Taslak kaydetmek için en az 1 fotoğraf yükleyin veya ürün adı girin.";
    }
    return "";
  }
  if (!title.trim()) {
    return "Ürün adı zorunludur.";
  }
  if (!categoryId) {
    return "Lütfen bir kategori seçin.";
  }
  if (price <= 0) {
    return "Geçerli bir toptan satış fiyatı giriniz.";
  }
  if (selectedSizes.length === 0) {
    return "Lütfen beden tanım tablosundan en az bir beden seçiniz.";
  }
  return "";
}

function parseDetailImages(
  images?: Array<{ image_url?: string; ImageUrl?: string }>,
  coverImage?: string
): string[] {
  if (images && images.length > 0) {
    return images.map((img) => img.image_url || img.ImageUrl || "").filter(Boolean);
  }
  return coverImage ? [coverImage] : [];
}

interface ProductPayloadParams {
  title: string;
  shortDesc: string;
  description: string;
  categoryId: string;
  colorId: string;
  fabricId: string;
  gender: string;
  season: string;
  buyingPrice: number;
  price: number;
  currency: string;
  selectedSizes: string[];
  seriesRatio: string;
  seriesStock: number;
  minOrderSeries: number;
  isActive: boolean;
  isDraft: boolean;
  sourceProductGroupId?: string;
  linkWithProductId?: string;
  additionalColorVariants?: readonly InlineColorVariantDraft[];
  images: string[];
  translations: ProductTranslationsFormMap;
  contentResponsibilityAccepted: boolean;
}

function buildProductPayload(params: ProductPayloadParams) {
  const safeSeriesStock = Math.max(1, Number(params.seriesStock) || DEFAULT_SERIES_STOCK);
  const safeMinSeries = Math.max(1, Number(params.minOrderSeries) || 1);
  const weights = parseSeriesRatioWeights(params.seriesRatio, params.selectedSizes.length);
  const unitsPerSeries = Math.max(
    1,
    weights.reduce((acc, w) => acc + w, 0)
  );

  const mappedAdditionalColors = (params.additionalColorVariants || [])
    .filter((v) => v.colorId !== "" || v.images.length > 0)
    .map((v) => ({
      color_id: v.colorId || undefined,
      title: v.title.trim() || undefined,
      price: v.price > 0 ? Number(v.price) : undefined,
      images: v.images.filter((img) => img.trim() !== ""),
      is_active: params.isActive,
    }));

  const translationsPayload = SUPPORTED_TRANSLATION_LANGS.reduce(
    (acc, lang) => {
      acc[lang] = {
        title: params.translations[lang].title.trim(),
        short_description: params.translations[lang].short_description.trim(),
        description: params.translations[lang].description.trim(),
      };
      return acc;
    },
    {} as ProductTranslationsFormMap
  );

  return {
    title: params.title.trim(),
    short_description: params.shortDesc.trim() || undefined,
    description: params.description.trim() || undefined,
    category_id: params.categoryId || undefined,
    color_id: params.colorId || undefined,
    fabric_id: params.fabricId || undefined,
    gender: params.gender || undefined,
    season: params.season || undefined,
    buying_price: Number(params.buyingPrice) || 0,
    price: Number(params.price) || 0,
    currency: params.currency,
    selected_sizes: params.selectedSizes,
    packing_ratio: params.selectedSizes.join(","),
    series_ratio: weights.join("-"),
    series_stock: safeSeriesStock,
    min_order_series: safeMinSeries,
    minimum_order_quantity: unitsPerSeries * safeMinSeries,
    is_active: params.isActive,
    is_draft: params.isDraft,
    source_product_group_id: params.sourceProductGroupId || undefined,
    link_with_product_id: params.linkWithProductId || undefined,
    additional_color_variants:
      mappedAdditionalColors.length > 0 ? mappedAdditionalColors : undefined,
    images: params.images.filter((img) => img.trim() !== ""),
    variants: params.selectedSizes.map((sz, idx) => ({
      size: sz,
      barcode: "",
      stock: (weights[idx] ?? 1) * safeSeriesStock,
      is_single: false,
    })),
    translations: translationsPayload,
    content_responsibility_accepted: params.contentResponsibilityAccepted,
  };
}

function buildProductSearchParams(query: string, category: string, status: string): URLSearchParams {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (category) params.set("category_id", category);
  if (status !== "all") params.set("status", status);
  params.set("limit", "50");
  return params;
}

async function fetchSupplierProfile(token: string): Promise<{ user?: SupplierProfile; stats?: DashboardStats; whatsappPhone?: string; isAuthError?: boolean }> {
  try {
    const res = await fetch("/api/v1/supplier/profile", {
      headers: { "Authorization": `Bearer ${token}` },
    });
    if (isAuthStatusError(res.status)) return { isAuthError: true };
    if (res.ok) {
      const data = await res.json();
      const wa = data.brand_profile?.whatsapp_phone || data.brand_profile?.phone || "";
      return { user: data.user, stats: data.stats, whatsappPhone: wa };
    }
  } catch (err) {
    console.error("Profil yüklenemedi:", err);
  }
  return {};
}

async function fetchSupplierProducts(token: string, searchParams: URLSearchParams): Promise<SupplierProductRow[]> {
  try {
    const res = await fetch(`/api/v1/supplier/products?${searchParams.toString()}`, {
      headers: { "Authorization": `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      return data.products || [];
    }
  } catch (err) {
    console.error("Ürünler yüklenemedi:", err);
  }
  return [];
}

async function fetchInitialSupplierData(token: string): Promise<{
  user?: SupplierProfile;
  stats?: DashboardStats;
  whatsappPhone?: string;
  categories?: CategoryOption[];
  colors?: AttributeItem[];
  fabrics?: AttributeItem[];
  sizes?: SizeDefinitionDTO[];
  seriesTemplates?: SeriesTemplateDTO[];
  isAuthError?: boolean;
}> {
  try {
    const [profileRes, catRes, attrRes] = await Promise.all([
      fetch("/api/v1/supplier/profile", { headers: { "Authorization": `Bearer ${token}` } }),
      fetch("/api/v1/supplier/categories", { headers: { "Authorization": `Bearer ${token}` } }),
      fetch("/api/v1/supplier/attributes", { headers: { "Authorization": `Bearer ${token}` } }),
    ]);

    if (isAuthStatusError(profileRes.status)) return { isAuthError: true };

    const result: {
      user?: SupplierProfile;
      stats?: DashboardStats;
      whatsappPhone?: string;
      categories?: CategoryOption[];
      colors?: AttributeItem[];
      fabrics?: AttributeItem[];
      sizes?: SizeDefinitionDTO[];
      seriesTemplates?: SeriesTemplateDTO[];
    } = {};

    if (profileRes.ok) {
      const pData = await profileRes.json();
      result.user = pData.user;
      result.stats = pData.stats;
      result.whatsappPhone = pData.brand_profile?.whatsapp_phone || pData.brand_profile?.phone || "";
    }
    if (catRes.ok) {
      result.categories = await catRes.json();
    }
    if (attrRes.ok) {
      const attrs = await attrRes.json();
      result.colors = attrs.colors || [];
      result.fabrics = attrs.fabrics || [];
      result.sizes = attrs.sizes || [];
      result.seriesTemplates = attrs.series_templates || [];
    }
    return result;
  } catch (err) {
    console.error("Başlangıç verileri yüklenemedi:", err);
    return {};
  }
}

interface SaveSupplierProductResponse {
  id?: string;
  custom_sku?: string;
  slug?: string;
  source_product_group_id?: string;
  message?: string;
}

async function saveSupplierProductApi(
  token: string,
  payload: ReturnType<typeof buildProductPayload>,
  editingProductId: string | null
): Promise<SaveSupplierProductResponse> {
  const url = editingProductId
    ? `/api/v1/supplier/products/${editingProductId}`
    : "/api/v1/supplier/products";
  const method = editingProductId ? "PUT" : "POST";
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as SaveSupplierProductResponse & {
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || "İşlem kaydedilemedi.");
  }
  return data;
}

async function quickPublishSupplierProductApi(
  token: string,
  productId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(
      `/api/v1/mobile/supplier/products/${encodeURIComponent(productId)}/quick-update`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ is_active: true }),
      }
    );
    if (res.ok) {
      return { ok: true };
    }
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return {
      ok: false,
      error: data.error || "Ürün yayına alınamadı; lütfen zorunlu alanları kontrol edin.",
    };
  } catch {
    return { ok: false, error: "Sunucu bağlantı hatası oluştu." };
  }
}

async function fetchProductSiblingsApi(
  token: string,
  productId: string
): Promise<{ source_product_group_id: string; siblings: SupplierSiblingItemDTO[] }> {
  try {
    const res = await fetch(`/api/v1/supplier/products/${productId}/siblings`, {
      headers: { "Authorization": `Bearer ${token}` },
    });
    if (res.ok) {
      const data = (await res.json()) as {
        source_product_group_id?: string;
        siblings?: SupplierSiblingItemDTO[];
      };
      return {
        source_product_group_id: data.source_product_group_id || "",
        siblings: Array.isArray(data.siblings) ? data.siblings : [],
      };
    }
  } catch {
    // Fallback silently
  }
  return { source_product_group_id: "", siblings: [] };
}

async function deleteSupplierProductApi(token: string, productId: string): Promise<void> {
  const res = await fetch(`/api/v1/supplier/products/${productId}`, {
    method: "DELETE",
    headers: { "Authorization": `Bearer ${token}` },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Ürün silinemedi.");
  }
}

async function fetchProductDetailApi(token: string, productId: string) {
  try {
    const res = await fetch(`/api/v1/supplier/products/${productId}`, {
      headers: { "Authorization": `Bearer ${token}` },
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.error("Ürün detayları alınamadı:", err);
  }
  return null;
}

async function autoTranslateSupplierProductApi(
  token: string,
  title: string,
  shortDesc: string,
  description: string,
  current: ProductTranslationsFormMap
): Promise<ProductTranslationsFormMap> {
  try {
    const res = await fetch("/api/v1/supplier/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        source_lang: "tr",
        target_langs: [...SUPPORTED_TRANSLATION_LANGS],
        fields: {
          title: title.trim(),
          short_description: shortDesc.trim(),
          description: description.trim(),
        },
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        translations?: Partial<Record<SupportedTranslationLang, Partial<ProductTranslationFormItem>>>;
      };
      const t = data.translations || {};
      const next = { ...current };
      for (const lang of SUPPORTED_TRANSLATION_LANGS) {
        const incoming = t[lang];
        next[lang] = {
          title: incoming?.title || current[lang].title,
          short_description: incoming?.short_description || current[lang].short_description,
          description: incoming?.description || current[lang].description,
        };
      }
      return next;
    }
  } catch (err) {
    console.error("Otomatik çeviri hatası:", err);
  }
  return current;
}

async function saveQuickWhatsappApi(token: string, whatsappPhone: string): Promise<boolean> {
  try {
    const res = await fetch("/api/v1/supplier/profile", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        whatsapp_phone: whatsappPhone,
        quick_whatsapp_only: true,
      }),
    });
    return res.ok;
  } catch (err) {
    console.error("Quick WhatsApp save error:", err);
    return false;
  }
}

function getStoredSupplierToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("supplier_token");
}

function clearStoredSupplierSession(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("supplier_token");
    localStorage.removeItem("supplier_user");
  }
}

function strVal(val: unknown, fallback = ""): string {
  return typeof val === "string" && val.length > 0 ? val : fallback;
}

function numVal(val: unknown, fallback = 0): number {
  const n = Number(val);
  return !Number.isNaN(n) && n !== 0 ? n : fallback;
}

function parseDetailTranslations(raw?: Record<string, unknown>): ProductTranslationsFormMap {
  const result = createEmptyTranslations();
  for (const code of SUPPORTED_TRANSLATION_LANGS) {
    const obj = (raw?.[code] as Record<string, unknown> | undefined) || {};
    result[code] = {
      title: strVal(obj.title),
      short_description: strVal(obj.short_description),
      description: strVal(obj.description),
    };
  }
  return result;
}

function normalizeKnownSizeCode(raw: string, knownCodes: Set<string>): string {
  const trimmed = raw.trim().toUpperCase();
  if (trimmed === "STANDART" || trimmed === "STANDART (STD)" || trimmed === "TEK BEDEN") {
    return "STD";
  }
  if (trimmed === "XXL") return "2XL";
  if (trimmed === "XXXL") return "3XL";
  for (const code of knownCodes) {
    if (code.toUpperCase() === trimmed) {
      return code;
    }
  }
  return "";
}

function extractSelectedSizesFromDetail(
  data: Record<string, unknown>,
  sizeDefinitions: SizeDefinitionDTO[]
): string[] {
  const defs = sizeDefinitions.length > 0 ? sizeDefinitions : FALLBACK_SIZE_DEFINITIONS;
  const knownCodes = new Set(defs.map((d) => d.code));
  const rawVariants = (data.variants as Array<{ variant_size?: string; size?: string }> | undefined) || [];
  const collected: string[] = [];

  for (const v of rawVariants) {
    const candidate = normalizeKnownSizeCode(v.variant_size || v.size || "", knownCodes);
    if (candidate && !collected.includes(candidate)) {
      collected.push(candidate);
    }
  }

  if (collected.length === 0) {
    const packingParts = strVal(data.packing_ratio).split(",");
    for (const part of packingParts) {
      const candidate = normalizeKnownSizeCode(part, knownCodes);
      if (candidate && !collected.includes(candidate)) {
        collected.push(candidate);
      }
    }
  }

  if (collected.length === 0) {
    return [...DEFAULT_SELECTED_SIZES];
  }
  return sortSelectedSizesByDefinitions(collected, defs);
}

function normalizeEditableProductDetail(
  data: Record<string, unknown>,
  prod: SupplierProductRow,
  sizeDefinitions: SizeDefinitionDTO[]
) {
  const selectedSizes = extractSelectedSizesFromDetail(data, sizeDefinitions);
  const rawSeriesRatio = strVal(data.series_ratio);
  const weights = parseSeriesRatioWeights(rawSeriesRatio, selectedSizes.length);
  const seriesRatio = weights.join("-");
  const unitsPerSeries = Math.max(
    1,
    weights.reduce((acc, w) => acc + w, 0)
  );
  const seriesStock = numVal(data.series_stock, prod.series_stock || DEFAULT_SERIES_STOCK);
  const moqUnits = numVal(data.minimum_order_quantity, unitsPerSeries);
  const minOrderSeries = Math.max(1, Math.round(moqUnits / unitsPerSeries));
  const rawSiblings = Array.isArray(data.supplier_siblings)
    ? (data.supplier_siblings as SupplierSiblingItemDTO[])
    : null;

  return {
    title: strVal(data.title),
    shortDesc: strVal(data.short_description),
    description: strVal(data.description),
    categoryId: strVal(data.category_id, prod.category_id || ""),
    colorId: strVal(data.color_id, prod.color_id || ""),
    fabricId: strVal(data.fabric_id),
    gender: strVal(data.gender, "Kadın"),
    season: strVal(data.season, "İlkbahar/Yaz"),
    buyingPrice: numVal(data.buying_price, 0),
    price: numVal(data.price, 0),
    currency: strVal(data.currency, "TRY"),
    selectedSizes,
    seriesRatio,
    seriesStock,
    minOrderSeries,
    isActive: typeof data.is_active === "boolean" ? data.is_active : true,
    sourceProductGroupId: strVal(
      data.source_product_group_id,
      prod.source_product_group_id || ""
    ),
    supplierSiblings: rawSiblings,
    images: parseDetailImages(
      data.images as Array<{ image_url?: string; ImageUrl?: string }> | undefined,
      prod.cover_image
    ),
    translations: parseDetailTranslations(data.translations as Record<string, unknown> | undefined),
  };
}

function SupplierHeader({
  profile,
  onLogout,
}: Readonly<{
  profile: SupplierProfile | null;
  onLogout: () => void;
}>) {
  return (
    <header className="bg-white/95 backdrop-blur-md text-slate-800 border-b border-slate-200/80 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-white shadow-xs">
            <Building2 size={20} />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-black text-sm tracking-wider uppercase text-slate-900">MERTER VİTRİNİ</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold uppercase">
                Tedarikçi Portalı
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="font-bold text-slate-800">{profile?.brand_name || "Yükleniyor..."}</span>
              {profile?.alias_code && (
                <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-mono font-bold">
                  [{profile.alias_code}]
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold shadow-xs">
              {(profile?.contact_name || "T").slice(0, 1).toUpperCase()}
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xs font-bold text-slate-800 leading-tight">{profile?.contact_name}</span>
              <span className="text-[10px] font-mono text-slate-400 leading-tight">{profile?.email}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="h-9 w-9 inline-flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors cursor-pointer"
            title="Güvenli Çıkış"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}

function SupplierStatsCards({ stats }: Readonly<{ stats: DashboardStats }>) {
  return (
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-4">
        <div className="p-3.5 rounded-xl bg-slate-100 text-slate-800">
          <Package size={22} />
        </div>
        <div>
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Toplam Ürün</span>
          <span className="text-2xl font-bold text-slate-900 block mt-0.5">{stats.total_products}</span>
        </div>
      </div>

      <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-4">
        <div className="p-3.5 rounded-xl bg-emerald-50 text-emerald-600">
          <CheckCircle2 size={22} />
        </div>
        <div>
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Yayındaki Ürünler</span>
          <span className="text-2xl font-bold text-slate-900 block mt-0.5">{stats.active_products}</span>
        </div>
      </div>

      <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-4">
        <div className="p-3.5 rounded-xl bg-slate-100 text-slate-800">
          <Layers size={22} />
        </div>
        <div>
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Toplam Stok (Adet)</span>
          <span className="text-2xl font-bold text-slate-900 block mt-0.5">{stats.total_stock}</span>
        </div>
      </div>

      <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-4">
        <div className="p-3.5 rounded-xl bg-slate-100 text-slate-800">
          <Tag size={22} />
        </div>
        <div>
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Varyant Sayısı</span>
          <span className="text-2xl font-bold text-slate-900 block mt-0.5">{stats.total_variants}</span>
        </div>
      </div>
    </section>
  );
}

function getProductRowStatusBadge(p: SupplierProductRow) {
  if (p.is_archived) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold">
        <Archive size={11} />
        <span>Arşivde</span>
      </span>
    );
  }
  if (p.is_active) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span>Yayında</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-extrabold">
      <span>📝 Taslak</span>
    </span>
  );
}

function SupplierProductTable({
  products,
  loading,
  quickPublishingId,
  onQuickPublish,
  onOpenNewColorFromProduct,
  onOpenEdit,
  onOpenTranslations,
  onToggleArchive,
  onOpenDelete,
}: Readonly<{
  products: SupplierProductRow[];
  loading: boolean;
  quickPublishingId: string | null;
  onQuickPublish: (prod: SupplierProductRow) => void;
  onOpenNewColorFromProduct: (prod: SupplierProductRow) => void;
  onOpenEdit: (prod: SupplierProductRow) => void;
  onOpenTranslations: (prod: SupplierProductRow) => void;
  onToggleArchive: (prod: SupplierProductRow) => void;
  onOpenDelete: (prod: SupplierProductRow) => void;
}>) {
  return (
    <section className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#fafafa] border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px] tracking-wider">
            <tr>
              <th className="py-3 px-4 w-16 text-center">Görsel</th>
              <th className="py-3 px-4">Ürün Adı &amp; SKU</th>
              <th className="py-3 px-4">Kategori</th>
              <th className="py-3 px-4">Toptan Fiyat</th>
              <th className="py-3 px-4 text-center">Stok</th>
              <th className="py-3 px-4 text-center">Durum</th>
              <th className="py-3 px-4 text-right">İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {products.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16 text-center text-slate-400">
                  {loading ? "Ürünler yükleniyor..." : "Henüz ürün eklenmemiş veya arama kriterine uygun ürün bulunamadı."}
                </td>
              </tr>
            ) : (
              products.map((p) => {
                const isDraft = !p.is_active && !p.is_archived;
                const isQuickPublishing = quickPublishingId === p.id;
                const siblingCount = p.sibling_count ?? 0;

                return (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-4 text-center">
                      <div className="w-12 h-14 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden relative mx-auto flex items-center justify-center shadow-xs">
                        {p.cover_image ? (
                          <Image
                            src={p.cover_image}
                            alt={p.title || p.custom_sku}
                            fill
                            sizes="48px"
                            className="object-cover"
                          />
                        ) : (
                          <Package size={20} className="text-slate-300" />
                        )}
                      </div>
                    </td>

                    <td className="py-2.5 px-4">
                      <div className="flex flex-col">
                        <span
                          className={`font-bold line-clamp-1 ${
                            p.title ? "text-slate-900" : "text-slate-400 italic"
                          }`}
                        >
                          {p.title || "İsimsiz Taslak Model"}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="font-mono text-[11px] text-slate-500 font-semibold">
                            {p.custom_sku}
                          </span>
                          {p.color && (
                            <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold">
                              {p.color}
                            </span>
                          )}
                        </div>
                        {siblingCount > 0 && (
                          <span className="mt-1 self-start inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold">
                            🎨 +{siblingCount} Renk
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-2.5 px-4 text-slate-600">
                      {p.category_title || "-"}
                    </td>

                    <td className="py-2.5 px-4">
                      <div className="flex flex-col">
                        <span className={`font-bold ${p.price > 0 ? "text-slate-900" : "text-amber-700"}`}>
                          {p.price > 0
                            ? `${p.price.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ${p.currency}`
                            : "Fiyat Girilmedi"}
                        </span>
                        {p.packing_ratio && (
                          <span className="text-[10px] text-slate-400 font-medium">
                            Paket: {p.packing_ratio}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-2.5 px-4 text-center">
                      <div className="flex flex-col items-center">
                        <span className="font-extrabold text-emerald-700">
                          ~{p.series_stock || DEFAULT_SERIES_STOCK} Seri
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold">
                          ({p.total_stock} adet)
                        </span>
                      </div>
                    </td>

                    <td className="py-2.5 px-4 text-center">
                      <div className="inline-flex flex-col items-center gap-1.5">
                        {getProductRowStatusBadge(p)}
                        {isDraft && (
                          <button
                            type="button"
                            onClick={() => onQuickPublish(p)}
                            disabled={isQuickPublishing}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-extrabold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                            title={
                              p.price > 0 && p.cover_image
                                ? "Tek tıkla vitrine yayınla"
                                : "Fiyat veya fotoğrafı tamamlayıp yayınla"
                            }
                          >
                            {isQuickPublishing ? (
                              <Loader2 size={10} className="animate-spin" />
                            ) : (
                              <Rocket size={10} />
                            )}
                            <span>{isQuickPublishing ? "Yayınlanıyor" : "🚀 Yayınla"}</span>
                          </button>
                        )}
                      </div>
                    </td>

                    <td className="py-2.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onOpenNewColorFromProduct(p)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 hover:bg-slate-900 hover:text-white hover:border-slate-900 text-[11px] font-bold transition-colors cursor-pointer"
                          title="Bu modelin yeni rengini aç"
                        >
                          <CopyPlus size={13} />
                          <span className="hidden xl:inline">+ Yeni Rengini Aç</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenTranslations(p)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 text-[11px] font-bold transition-colors cursor-pointer"
                          title="Çok Dilli Çevirileri Düzenle (TR / EN / RU / AR / DE / FR / PL / BG)"
                        >
                          <Globe size={13} />
                          <span className="hidden xl:inline">Çeviri</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleArchive(p)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 text-[11px] font-bold transition-colors cursor-pointer"
                          title={
                            p.is_archived
                              ? "Arşivden Çıkar ve Yayına Al"
                              : "Eski Koleksiyon Arşivine Taşı"
                          }
                        >
                          {p.is_archived ? (
                            <ArchiveRestore size={13} />
                          ) : (
                            <Archive size={13} />
                          )}
                          <span className="hidden xl:inline">
                            {p.is_archived ? "Arşivden Çıkar" : "Arşivle"}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenEdit(p)}
                          className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer"
                          title="Düzenle"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenDelete(p)}
                          className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors cursor-pointer"
                          title="Sil"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SupplierDeleteConfirmModal({
  product,
  submitting,
  onCancel,
  onConfirm,
}: Readonly<{
  product: SupplierProductRow;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}>) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full overflow-hidden p-6 text-center animate-in fade-in zoom-in-95 duration-150">
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
          <Trash2 size={24} />
        </div>
        <h3 className="text-base font-bold text-slate-900 mb-1">
          Ürünü Silmek İstediğinize Emin Misiniz?
        </h3>
        <p className="text-xs text-slate-500 mb-6 leading-relaxed">
          <span className="font-semibold text-slate-800">{product.title}</span> ({product.custom_sku}) ürünü ve tüm varyantları sistemden ve vitrinden kalıcı olarak kaldırılacaktır.
        </p>
        <div className="flex gap-2.5 justify-center">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
          >
            {submitting ? "Siliniyor..." : "Evet, Ürünü Sil"}
          </button>
        </div>
      </div>
    </div>
  );
}

type SupplierDashboardSection = "catalog" | "orders" | "chat" | "profile" | "billing" | "analytics" | "rfq";

interface SupplierQuickWhatsappBannerProps {
  readonly quickWhatsapp: string;
  readonly setQuickWhatsapp: (v: string) => void;
  readonly savingQuickWa: boolean;
  readonly quickWaSavedMsg: string;
  readonly onSubmit: (e: React.FormEvent) => void;
  readonly onOpenProfileSection: () => void;
}

function SupplierQuickWhatsappBanner({
  quickWhatsapp,
  setQuickWhatsapp,
  savingQuickWa,
  quickWaSavedMsg,
  onSubmit,
  onOpenProfileSection,
}: SupplierQuickWhatsappBannerProps) {
  const hasWhatsapp = quickWhatsapp.trim().length > 0;
  return (
    <form
      onSubmit={onSubmit}
      className="bg-white rounded-xl border border-slate-200/90 px-4 py-4 sm:px-5 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-4 overflow-hidden"
    >
      <div className="min-w-0 flex-1 flex items-start sm:items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 font-black text-base shadow-xs">
          WA
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide">
              Doğrudan Müşteri &amp; Sipariş WhatsApp Hattınız
            </h3>
            {hasWhatsapp ? (
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                Aktif • Vitrinde Açık Görünüyor
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                Numara Girilmedi • Hemen Ekleyin
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
            Alıcılar ürün sayfalarınızda &quot;WhatsApp ile Doğrudan Tedarikçiye Yaz / Sipariş Ver&quot; butonuna bastığında doğrudan bu numaraya bağlanır.
          </p>
          {quickWaSavedMsg && (
            <p className="text-[11px] font-bold text-emerald-700 mt-1">
              ✓ {quickWaSavedMsg}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <input
          type="text"
          value={quickWhatsapp}
          onChange={(e) => setQuickWhatsapp(e.target.value)}
          placeholder="+90 532 000 00 00"
          className="h-9 w-full sm:w-48 px-3 rounded-lg border border-slate-300 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600"
        />
        <button
          type="submit"
          disabled={savingQuickWa}
          className="h-9 px-3.5 inline-flex items-center justify-center rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold transition-colors cursor-pointer disabled:opacity-50 shrink-0"
        >
          {savingQuickWa ? "Kaydediliyor..." : "WhatsApp Numaramı Kaydet"}
        </button>
        <button
          type="button"
          onClick={onOpenProfileSection}
          className="h-9 px-3.5 inline-flex items-center justify-center rounded-lg bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 text-xs font-bold transition-colors cursor-pointer shrink-0"
        >
          Tüm Vitrin &amp; IBAN Ayarları
        </button>
      </div>
    </form>
  );
}

type SupplierStatusFilter = "all" | "active" | "passive" | "archived";

interface SupplierDashboardNavTabsProps {
  readonly activeSection: SupplierDashboardSection;
  readonly setActiveSection: (s: SupplierDashboardSection) => void;
  readonly stats: DashboardStats;
  readonly unreadChatCount: number;
  readonly onOpenCreate: () => void;
  readonly onOpenQuickDraft: () => void;
  readonly onOpenExcelImport: () => void;
  readonly onOpenBulkArchive: () => void;
}

function SupplierDashboardNavTabs({
  activeSection,
  setActiveSection,
  stats,
  unreadChatCount,
  onOpenCreate,
  onOpenQuickDraft,
  onOpenExcelImport,
  onOpenBulkArchive,
}: SupplierDashboardNavTabsProps) {
  const tabClass = (sec: SupplierDashboardSection) =>
    `shrink-0 h-9 px-3 rounded-lg font-bold text-xs transition-all cursor-pointer inline-flex items-center gap-1.5 ${
      activeSection === sec
        ? "bg-slate-900 text-white shadow-xs"
        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
    }`;

  return (
    <div className="space-y-3">
      <nav
        aria-label="Tedarikçi Paneli Sekmeleri"
        className="w-full bg-white p-1.5 rounded-xl border border-slate-200/90 shadow-xs flex items-center gap-1 overflow-x-auto no-scrollbar whitespace-nowrap"
      >
        <button
          type="button"
          onClick={() => setActiveSection("catalog")}
          className={tabClass("catalog")}
        >
          <Package size={15} />
          <span>Ürün Kataloğum ({stats.total_products})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection("orders")}
          className={tabClass("orders")}
        >
          <ShoppingBag size={15} />
          <span>Gelen Siparişlerim ({stats.total_orders ?? 0})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection("chat")}
          className={tabClass("chat")}
        >
          <MessageSquare size={15} />
          <span>Müşteri Sohbetleri</span>
          {unreadChatCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
              {unreadChatCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSection("profile")}
          className={tabClass("profile")}
        >
          <Building2 size={15} />
          <span>Firma &amp; İletişim</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection("billing")}
          className={tabClass("billing")}
        >
          <CreditCard size={15} />
          <span>Üyelik &amp; Faturalar</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection("analytics")}
          className={tabClass("analytics")}
        >
          <BarChart3 size={15} />
          <span>Ziyaretçi Analitiği</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection("rfq")}
          className={tabClass("rfq")}
        >
          <FileText size={15} />
          <span>Alıcı Talepleri (RFQ)</span>
        </button>
      </nav>

      {activeSection === "catalog" && (
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-0.5">
          <div className="text-xs font-bold text-slate-600">
            Koleksiyon &amp; Toptan Ürün Yönetimi
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenBulkArchive}
              className="h-9 px-3.5 inline-flex items-center justify-center gap-1.5 rounded-lg bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-xs font-bold transition-colors cursor-pointer shrink-0"
            >
              <Archive size={14} />
              <span>Eski Koleksiyonu Arşivle</span>
            </button>

            <button
              type="button"
              onClick={onOpenExcelImport}
              className="h-9 px-3.5 inline-flex items-center justify-center gap-1.5 rounded-lg bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-xs font-bold transition-colors cursor-pointer shrink-0"
            >
              <FileSpreadsheet size={14} />
              <span>Excel / CSV ile Toplu Yükle</span>
            </button>

            <button
              type="button"
              onClick={onOpenQuickDraft}
              className="h-9 px-3.5 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 text-xs font-extrabold transition-colors cursor-pointer shrink-0"
            >
              <Camera size={14} />
              <span>📸 Fotoğraftan Hızlı Taslak</span>
            </button>

            <button
              type="button"
              onClick={onOpenCreate}
              className="h-9 px-4 inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-[0.99] shrink-0"
            >
              <Plus size={15} />
              <span>Yeni Ürün Ekle</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface SupplierCatalogToolbarProps {
  readonly searchQuery: string;
  readonly setSearchQuery: (v: string) => void;
  readonly selectedCategory: string;
  readonly setSelectedCategory: (v: string) => void;
  readonly categories: CategoryOption[];
  readonly statusFilter: SupplierStatusFilter;
  readonly setStatusFilter: (v: SupplierStatusFilter) => void;
  readonly draftCount: number;
  readonly loading: boolean;
  readonly onRefresh: () => void;
}

function SupplierCatalogToolbar({
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  categories,
  statusFilter,
  setStatusFilter,
  draftCount,
  loading,
  onRefresh,
}: SupplierCatalogToolbarProps) {
  const hierarchicalCategories = useMemo(
    () => buildHierarchicalCategoryOptions(categories),
    [categories]
  );

  return (
    <section className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
      <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto flex-1">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Ürün adı veya SKU ile ara..."
            className="h-9 w-full pl-9 pr-4 rounded-lg bg-white border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900 transition-all"
          />
        </div>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="h-9 w-full sm:w-56 px-3 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900 transition-all"
        >
          <option value="">Tüm Kategoriler</option>
          {hierarchicalCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.fullLabel}
            </option>
          ))}
        </select>

        <div className="flex rounded-lg bg-slate-100 p-1 border border-slate-200 w-full sm:w-auto overflow-x-auto">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              statusFilter === "all" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Tümü
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("active")}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              statusFilter === "active" ? "bg-white text-emerald-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Yayında
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("passive")}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              statusFilter === "passive"
                ? "bg-white text-amber-800 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Taslaklar ({draftCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("archived")}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              statusFilter === "archived" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Arşiv (Eski Koleksiyon)
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="h-9 px-3 inline-flex items-center justify-center gap-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
          title="Listeyi Yenile"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          <span>Yenile</span>
        </button>
      </div>
    </section>
  );
}

function SupplierSectionContent({
  activeSection,
  getToken,
  onOrderCountChange,
  onProfileSaved,
  profile,
  products,
  onUnreadTotalChange,
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  categories,
  statusFilter,
  setStatusFilter,
  draftCount,
  loading,
  onRefresh,
  catalogBanner,
  onDismissCatalogBanner,
  quickPublishingId,
  onQuickPublish,
  onOpenNewColorFromProduct,
  onOpenEdit,
  onOpenTranslations,
  onToggleArchive,
  onOpenDelete,
}: Readonly<{
  activeSection: SupplierDashboardSection;
  getToken: () => string | null;
  onOrderCountChange: (cnt: number) => void;
  onProfileSaved: () => void;
  profile: SupplierProfile | null;
  products: SupplierProductRow[];
  onUnreadTotalChange: (cnt: number) => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  selectedCategory: string;
  setSelectedCategory: (v: string) => void;
  categories: CategoryOption[];
  statusFilter: SupplierStatusFilter;
  setStatusFilter: (v: SupplierStatusFilter) => void;
  draftCount: number;
  loading: boolean;
  onRefresh: () => void;
  catalogBanner: { type: "success" | "error"; text: string } | null;
  onDismissCatalogBanner: () => void;
  quickPublishingId: string | null;
  onQuickPublish: (p: SupplierProductRow) => void;
  onOpenNewColorFromProduct: (p: SupplierProductRow) => void;
  onOpenEdit: (p: SupplierProductRow) => void;
  onOpenTranslations: (p: SupplierProductRow) => void;
  onToggleArchive: (p: SupplierProductRow) => void;
  onOpenDelete: (p: SupplierProductRow) => void;
}>) {
  if (activeSection === "orders") {
    return (
      <SupplierOrdersPanel
        getToken={getToken}
        onOrderCountChange={onOrderCountChange}
      />
    );
  }

  if (activeSection === "profile") {
    return (
      <SupplierProfilePanel
        getToken={getToken}
        onProfileSaved={onProfileSaved}
      />
    );
  }

  if (activeSection === "billing") {
    return <SupplierBillingPanel getToken={getToken} />;
  }

  if (activeSection === "analytics") {
    return <SupplierAnalyticsPanel getToken={getToken} />;
  }

  if (activeSection === "rfq") {
    return <SupplierRfqPanel getToken={getToken} />;
  }

  if (activeSection === "chat") {
    return (
      <SupplierChatPanel
        brandId={profile?.brand_id || ""}
        supplierUserId={profile?.sub || ""}
        products={products}
        getToken={getToken}
        onUnreadTotalChange={onUnreadTotalChange}
      />
    );
  }

  return (
    <>
      <SupplierCatalogToolbar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        categories={categories}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        draftCount={draftCount}
        loading={loading}
        onRefresh={onRefresh}
      />

      {catalogBanner && (
        <div
          className={`px-4 py-3 rounded-xl border flex items-center justify-between gap-3 text-xs font-bold ${
            catalogBanner.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {catalogBanner.type === "success" ? (
              <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle size={15} className="text-red-600 shrink-0" />
            )}
            <span>{catalogBanner.text}</span>
          </div>
          <button
            type="button"
            onClick={onDismissCatalogBanner}
            className="p-1 rounded-md hover:bg-black/5 cursor-pointer"
            aria-label="Bildirimi kapat"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <SupplierProductTable
        products={products}
        loading={loading}
        quickPublishingId={quickPublishingId}
        onQuickPublish={onQuickPublish}
        onOpenNewColorFromProduct={onOpenNewColorFromProduct}
        onOpenEdit={onOpenEdit}
        onOpenTranslations={onOpenTranslations}
        onToggleArchive={onToggleArchive}
        onOpenDelete={onOpenDelete}
      />
    </>
  );
}

interface ProfileDataSetters {
  setProfile: (p: SupplierProfile) => void;
  setStats: (s: DashboardStats) => void;
  setQuickWhatsapp: (w: string) => void;
  setCategories?: (c: CategoryOption[]) => void;
  setColors?: (c: AttributeItem[]) => void;
  setFabrics?: (f: AttributeItem[]) => void;
  setSizeDefinitions?: (s: SizeDefinitionDTO[]) => void;
  setSeriesTemplates?: (t: SeriesTemplateDTO[]) => void;
}

function applyAttributeDataToSetters(
  res: {
    categories?: CategoryOption[];
    colors?: AttributeItem[];
    fabrics?: AttributeItem[];
    sizes?: SizeDefinitionDTO[];
    seriesTemplates?: SeriesTemplateDTO[];
  },
  setters: ProfileDataSetters
) {
  if (setters.setCategories && res.categories) setters.setCategories(res.categories);
  if (setters.setColors && res.colors) setters.setColors(res.colors);
  if (setters.setFabrics && res.fabrics) setters.setFabrics(res.fabrics);
  if (setters.setSizeDefinitions && res.sizes) setters.setSizeDefinitions(res.sizes);
  if (setters.setSeriesTemplates && res.seriesTemplates) setters.setSeriesTemplates(res.seriesTemplates);
}

function applyProfileDataToSetters(
  res: {
    user?: SupplierProfile;
    stats?: DashboardStats;
    whatsappPhone?: string;
    categories?: CategoryOption[];
    colors?: AttributeItem[];
    fabrics?: AttributeItem[];
    sizes?: SizeDefinitionDTO[];
    seriesTemplates?: SeriesTemplateDTO[];
    isAuthError?: boolean;
  },
  onLogout: () => void,
  setters: ProfileDataSetters
) {
  if (res.isAuthError) {
    onLogout();
    return;
  }
  if (res.user) setters.setProfile(res.user);
  if (res.stats) setters.setStats(res.stats);
  if (res.whatsappPhone !== undefined) setters.setQuickWhatsapp(res.whatsappPhone);
  applyAttributeDataToSetters(res, setters);
}

function useSupplierAuthAndProfile(router: ReturnType<typeof useRouter>) {
  const [profile, setProfile] = useState<SupplierProfile | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    total_products: 0,
    active_products: 0,
    total_stock: 0,
    total_variants: 0,
  });
  const [quickWhatsapp, setQuickWhatsapp] = useState<string>("");
  const [savingQuickWa, setSavingQuickWa] = useState<boolean>(false);
  const [quickWaSavedMsg, setQuickWaSavedMsg] = useState<string>("");
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [colors, setColors] = useState<AttributeItem[]>([]);
  const [fabrics, setFabrics] = useState<AttributeItem[]>([]);
  const [sizeDefinitions, setSizeDefinitions] = useState<SizeDefinitionDTO[]>([]);
  const [seriesTemplates, setSeriesTemplates] = useState<SeriesTemplateDTO[]>([]);

  const getToken = useCallback(() => getStoredSupplierToken(), []);

  const handleLogout = useCallback(() => {
    clearStoredSupplierSession();
    router.push("/supplier/login");
  }, [router]);

  const loadProfile = useCallback(async () => {
    const token = getToken();
    if (!token) return handleLogout();
    const res = await fetchSupplierProfile(token);
    applyProfileDataToSetters(res, handleLogout, {
      setProfile,
      setStats,
      setQuickWhatsapp,
    });
  }, [getToken, handleLogout]);

  const handleSaveQuickWhatsapp = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getToken();
    if (!token) return;
    setSavingQuickWa(true);
    setQuickWaSavedMsg("");
    const ok = await saveQuickWhatsappApi(token, quickWhatsapp);
    if (ok) {
      setQuickWaSavedMsg("WhatsApp hattınız güncellendi! Alıcılar artık ürün sayfalarınızdan doğrudan size ulaşabilir.");
      setTimeout(() => setQuickWaSavedMsg(""), 4000);
    }
    setSavingQuickWa(false);
  };

  useEffect(() => {
    const token = getToken();
    if (!token) {
      handleLogout();
      return;
    }
    let ignore = false;
    void fetchInitialSupplierData(token).then((data) => {
      if (!ignore) {
        applyProfileDataToSetters(data, handleLogout, {
          setProfile,
          setStats,
          setQuickWhatsapp,
          setCategories,
          setColors,
          setFabrics,
          setSizeDefinitions,
          setSeriesTemplates,
        });
      }
    });
    return () => {
      ignore = true;
    };
  }, [getToken, handleLogout]);

  return {
    profile,
    stats,
    setStats,
    quickWhatsapp,
    setQuickWhatsapp,
    savingQuickWa,
    quickWaSavedMsg,
    categories,
    colors,
    fabrics,
    sizeDefinitions,
    seriesTemplates,
    getToken,
    handleLogout,
    loadProfile,
    handleSaveQuickWhatsapp,
  };
}

function useSupplierProductCatalog(
  getToken: () => string | null,
  searchQuery: string,
  selectedCategory: string,
  statusFilter: SupplierStatusFilter
) {
  const [products, setProducts] = useState<SupplierProductRow[]>([]);
  const [loading, setLoading] = useState(false);

  const loadProducts = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    setLoading(true);
    const list = await fetchSupplierProducts(
      token,
      buildProductSearchParams(searchQuery, selectedCategory, statusFilter)
    );
    setProducts(list);
    setLoading(false);
  }, [getToken, searchQuery, selectedCategory, statusFilter]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    let ignore = false;
    const params = buildProductSearchParams(searchQuery, selectedCategory, statusFilter);
    void fetchSupplierProducts(token, params).then((list) => {
      if (!ignore) setProducts(list);
    });
    return () => {
      ignore = true;
    };
  }, [getToken, searchQuery, selectedCategory, statusFilter]);

  return { products, loading, loadProducts };
}

async function performProductSave(
  token: string | null,
  payload: ReturnType<typeof buildProductPayload>,
  editingProductId: string | null,
  setSubmitting: (v: boolean) => void,
  setFormError: (msg: string) => void
): Promise<SaveSupplierProductResponse | null> {
  if (!token) return null;
  setSubmitting(true);
  setFormError("");
  try {
    return await saveSupplierProductApi(token, payload, editingProductId);
  } catch (err: unknown) {
    setFormError(strVal((err as Error).message, "Kayıt sırasında bir hata oluştu."));
    return null;
  } finally {
    setSubmitting(false);
  }
}

async function performProductDelete(
  token: string | null,
  deletingProduct: SupplierProductRow | null,
  setSubmitting: (v: boolean) => void,
  onSuccess: () => void
) {
  if (!deletingProduct || !token) return;
  setSubmitting(true);
  try {
    await deleteSupplierProductApi(token, deletingProduct.id);
    onSuccess();
  } catch (err: unknown) {
    alert((err as Error).message);
  } finally {
    setSubmitting(false);
  }
}

interface QuickDraftDefaultsState {
  categoryId: string;
  currency: string;
  selectedSizes: string[];
  seriesRatio: string;
  seriesStock: number;
}

export default function SupplierDashboardClient() {
  const router = useRouter();
  const {
    profile,
    stats,
    setStats,
    quickWhatsapp,
    setQuickWhatsapp,
    savingQuickWa,
    quickWaSavedMsg,
    categories,
    colors,
    fabrics,
    sizeDefinitions,
    seriesTemplates,
    getToken,
    handleLogout,
    loadProfile,
    handleSaveQuickWhatsapp,
  } = useSupplierAuthAndProfile(router);

  // Filter & navigation state
  const [activeSection, setActiveSection] = useState<SupplierDashboardSection>("catalog");
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [statusFilter, setStatusFilter] = useState<SupplierStatusFilter>("all");
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [isQuickDraftModalOpen, setIsQuickDraftModalOpen] = useState(false);
  const [quickDraftDefaults, setQuickDraftDefaults] = useState<QuickDraftDefaultsState>({
    categoryId: "",
    currency: "TRY",
    selectedSizes: [...DEFAULT_SELECTED_SIZES],
    seriesRatio: DEFAULT_SERIES_RATIO,
    seriesStock: DEFAULT_SERIES_STOCK,
  });

  // Catalog banner & quick-publish state
  const [catalogBanner, setCatalogBanner] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [quickPublishingId, setQuickPublishingId] = useState<string | null>(null);

  const { products, loading, loadProducts } = useSupplierProductCatalog(
    getToken,
    searchQuery,
    selectedCategory,
    statusFilter
  );

  const handleToggleProductArchive = async (prod: SupplierProductRow) => {
    const token = getToken();
    if (!token) return;
    const nextArchived = !prod.is_archived;
    const ok = await toggleSupplierProductArchiveApi(token, prod.id, nextArchived, true);
    if (ok) {
      void loadProducts();
      void loadProfile();
    }
  };

  // Modal state
  const [activeModal, setActiveModal] = useState<SupplierModalMode>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<SupplierProductRow | null>(null);
  const [modalViewMode, setModalViewMode] = useState<ProductModalViewMode>("express");
  const [pendingLocalDraft, setPendingLocalDraft] = useState<SupplierUnsavedDraft | null>(null);
  const [formNotice, setFormNotice] = useState("");

  // Product Form State (Express & Detailed Unified)
  const [formTitle, setFormTitle] = useState("");
  const [formShortDesc, setFormShortDesc] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formColorId, setFormColorId] = useState("");
  const [formFabricId, setFormFabricId] = useState("");
  const [formGender, setFormGender] = useState("Kadın");
  const [formSeason, setFormSeason] = useState("İlkbahar/Yaz");
  const [formBuyingPrice, setFormBuyingPrice] = useState<number>(0);
  const [formPrice, setFormPrice] = useState<number>(0);
  const [formCurrency, setFormCurrency] = useState("TRY");
  const [formSelectedSizes, setFormSelectedSizes] = useState<string[]>(DEFAULT_SELECTED_SIZES);
  const [formSeriesRatio, setFormSeriesRatio] = useState(DEFAULT_SERIES_RATIO);
  const [formSeriesStock, setFormSeriesStock] = useState<number>(DEFAULT_SERIES_STOCK);
  const [formMinOrderSeries, setFormMinOrderSeries] = useState<number>(1);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formImages, setFormImages] = useState<string[]>([]);
  const [formTranslations, setFormTranslations] = useState<ProductTranslationsFormMap>(
    () => createEmptyTranslations()
  );
  const [sourceProductGroupId, setSourceProductGroupId] = useState("");
  const [supplierSiblings, setSupplierSiblings] = useState<SupplierSiblingItemDTO[]>([]);
  const [linkWithProduct, setLinkWithProduct] = useState<SupplierSiblingItemDTO | null>(null);
  const [additionalColorVariants, setAdditionalColorVariants] = useState<InlineColorVariantDraft[]>([]);

  const [autoTranslating, setAutoTranslating] = useState(false);
  const [imageUploadLoading, setImageUploadLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formContentLegalAccepted, setFormContentLegalAccepted] = useState(false);

  // Debounced auto-save for in-progress Create modal state
  useEffect(() => {
    if (activeModal !== "create" || pendingLocalDraft !== null) return;
    const hasMeaningfulContent =
      formTitle.trim().length > 0 ||
      formImages.length > 0 ||
      formPrice > 0 ||
      linkWithProduct !== null ||
      additionalColorVariants.length > 0;
    if (!hasMeaningfulContent) return;

    const timer = window.setTimeout(() => {
      saveSupplierUnsavedDraft({
        savedAt: new Date().toISOString(),
        title: formTitle,
        shortDesc: formShortDesc,
        description: formDescription,
        categoryId: formCategoryId,
        colorId: formColorId,
        fabricId: formFabricId,
        gender: formGender,
        season: formSeason,
        buyingPrice: formBuyingPrice,
        price: formPrice,
        currency: formCurrency,
        selectedSizes: formSelectedSizes,
        seriesRatio: formSeriesRatio,
        seriesStock: formSeriesStock,
        minOrderSeries: formMinOrderSeries,
        isActive: formIsActive,
        images: formImages,
        translations: formTranslations,
        linkWithProduct,
        additionalColorVariants,
      });
    }, 600);

    return () => window.clearTimeout(timer);
  }, [
    activeModal,
    pendingLocalDraft,
    formTitle,
    formShortDesc,
    formDescription,
    formCategoryId,
    formColorId,
    formFabricId,
    formGender,
    formSeason,
    formBuyingPrice,
    formPrice,
    formCurrency,
    formSelectedSizes,
    formSeriesRatio,
    formSeriesStock,
    formMinOrderSeries,
    formIsActive,
    formImages,
    formTranslations,
    linkWithProduct,
    additionalColorVariants,
  ]);

  const handleToggleSize = (code: string) => {
    const defs = sizeDefinitions.length > 0 ? sizeDefinitions : FALLBACK_SIZE_DEFINITIONS;
    setFormSelectedSizes((prev) => {
      const exists = prev.includes(code);
      if (exists && prev.length <= 1) {
        return prev;
      }
      const next = exists ? prev.filter((s) => s !== code) : [...prev, code];
      const sorted = sortSelectedSizesByDefinitions(next, defs);
      const currentMode = detectAssortmentMode(formSeriesRatio, prev.length);
      setFormSeriesRatio(buildSeriesRatioForMode(sorted.length, currentMode));
      return sorted;
    });
  };

  const handleApplySeriesTemplate = (tpl: SeriesTemplateDTO) => {
    setFormSelectedSizes([...tpl.sizes]);
    setFormSeriesRatio(tpl.series_ratio);
  };

  const handleSelectAssortmentMode = (mode: AssortmentMode) => {
    setFormSeriesRatio(buildSeriesRatioForMode(formSelectedSizes.length, mode));
  };

  // Multi-image dropzone handlers (Drag-Drop, Paste, Reorder, Click)
  const handleUploadImageFiles = useCallback(
    async (files: File[]) => {
      await performMultiImageUpload(
        files,
        getToken(),
        setImageUploadLoading,
        (urls) => {
          setFormImages((prev) => [...prev, ...urls]);
        },
        (errMsg) => setFormError(errMsg)
      );
    },
    [getToken]
  );

  const handleReorderImages = useCallback((fromIdx: number, toIdx: number) => {
    setFormImages((prev) => reorderImageList(prev, fromIdx, toIdx));
  }, []);

  const handleRemoveImage = useCallback((index: number) => {
    setFormImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSetCoverImage = useCallback((index: number) => {
    setFormImages((prev) => reorderImageList(prev, index, 0));
  }, []);

  // Resolve defaults from localStorage for new entries
  const resolveRememberedCreateDefaults = useCallback((): QuickDraftDefaultsState & {
    gender: string;
    season: string;
  } => {
    const saved = readSupplierLastDefaults();
    const validSavedCategory =
      saved?.categoryId && categories.some((c) => c.id === saved.categoryId)
        ? saved.categoryId
        : categories[0]?.id ?? "";
    const savedSizes =
      Array.isArray(saved?.selectedSizes) && saved.selectedSizes.length > 0
        ? saved.selectedSizes
        : [...DEFAULT_SELECTED_SIZES];

    return {
      categoryId: validSavedCategory,
      currency: saved?.currency || "TRY",
      selectedSizes: savedSizes,
      seriesRatio: saved?.seriesRatio || DEFAULT_SERIES_RATIO,
      seriesStock:
        saved?.seriesStock && saved.seriesStock > 0
          ? saved.seriesStock
          : DEFAULT_SERIES_STOCK,
      gender: saved?.gender || "Kadın",
      season: saved?.season || "İlkbahar/Yaz",
    };
  }, [categories]);

  // Open Create Modal (Smart Defaults + Unsaved Local Draft Recovery Check)
  const handleOpenCreate = () => {
    const defaults = resolveRememberedCreateDefaults();
    const unsavedDraft = readSupplierUnsavedDraft();

    setEditingProductId(null);
    setFormTitle("");
    setFormShortDesc("");
    setFormDescription("");
    setFormCategoryId(defaults.categoryId);
    setFormColorId("");
    setFormFabricId("");
    setFormGender(defaults.gender);
    setFormSeason(defaults.season);
    setFormBuyingPrice(0);
    setFormPrice(0);
    setFormCurrency(defaults.currency);
    setFormSelectedSizes(defaults.selectedSizes);
    setFormSeriesRatio(defaults.seriesRatio);
    setFormSeriesStock(defaults.seriesStock);
    setFormMinOrderSeries(1);
    setFormIsActive(true);
    setFormImages([]);
    setFormTranslations(createEmptyTranslations());
    setSourceProductGroupId("");
    setSupplierSiblings([]);
    setLinkWithProduct(null);
    setAdditionalColorVariants([]);
    setPendingLocalDraft(unsavedDraft);
    setModalViewMode("express");
    setFormNotice("");
    setFormError("");
    setFormContentLegalAccepted(false);
    setActiveModal("create");
  };

  const handleOpenQuickDraft = () => {
    const defaults = resolveRememberedCreateDefaults();
    setQuickDraftDefaults({
      categoryId: defaults.categoryId,
      currency: defaults.currency,
      selectedSizes: defaults.selectedSizes,
      seriesRatio: defaults.seriesRatio,
      seriesStock: defaults.seriesStock,
    });
    setIsQuickDraftModalOpen(true);
  };

  const handleRestoreLocalDraft = () => {
    if (!pendingLocalDraft) return;
    const d = pendingLocalDraft;
    setFormTitle(d.title);
    setFormShortDesc(d.shortDesc);
    setFormDescription(d.description);
    setFormCategoryId(
      d.categoryId && categories.some((c) => c.id === d.categoryId)
        ? d.categoryId
        : categories[0]?.id ?? ""
    );
    setFormColorId(d.colorId);
    setFormFabricId(d.fabricId);
    setFormGender(d.gender);
    setFormSeason(d.season);
    setFormBuyingPrice(d.buyingPrice);
    setFormPrice(d.price);
    setFormCurrency(d.currency);
    setFormSelectedSizes(d.selectedSizes);
    setFormSeriesRatio(d.seriesRatio);
    setFormSeriesStock(d.seriesStock);
    setFormMinOrderSeries(d.minOrderSeries);
    setFormIsActive(d.isActive);
    setFormImages(d.images);
    setFormTranslations(d.translations);
    setLinkWithProduct(d.linkWithProduct);
    setAdditionalColorVariants(d.additionalColorVariants);
    setPendingLocalDraft(null);
    setFormNotice("Yarım kalmış ürün taslağı geri yüklendi.");
  };

  const handleDiscardLocalDraft = () => {
    clearSupplierUnsavedDraft();
    setPendingLocalDraft(null);
  };

  const handleCloseProductModal = () => {
    setActiveModal(null);
    setFormError("");
    setFormNotice("");
    setPendingLocalDraft(null);
  };

  const handleUpdateTranslationField = (
    lang: SupportedTranslationLang,
    field: TranslationFieldKey,
    val: string
  ) => {
    setFormTranslations((prev) => ({
      ...prev,
      [lang]: { ...prev[lang], [field]: val },
    }));
  };

  const handleAutoTranslateFromTurkish = async () => {
    const token = getToken();
    if (!token || !formTitle.trim()) return;
    setAutoTranslating(true);
    const updated = await autoTranslateSupplierProductApi(
      token,
      formTitle,
      formShortDesc,
      formDescription,
      formTranslations
    );
    setFormTranslations(updated);
    setAutoTranslating(false);
  };

  // Open Edit Modal
  const openProductEditModal = async (
    prod: SupplierProductRow,
    expandTranslations: boolean
  ) => {
    setEditingProductId(prod.id);
    setModalViewMode(expandTranslations ? "detailed" : "express");
    setPendingLocalDraft(null);
    setLinkWithProduct(null);
    setAdditionalColorVariants([]);
    setSourceProductGroupId(prod.source_product_group_id || "");
    setSupplierSiblings([]);
    setFormNotice("");
    setFormError("");
    setFormContentLegalAccepted(false);
    setActiveModal("edit");

    const token = getToken() ?? "";
    const data = await fetchProductDetailApi(token, prod.id);
    if (!data) return;

    const normalized = normalizeEditableProductDetail(
      data as Record<string, unknown>,
      prod,
      sizeDefinitions
    );
    setFormTitle(normalized.title);
    setFormShortDesc(normalized.shortDesc);
    setFormDescription(normalized.description);
    setFormCategoryId(normalized.categoryId);
    setFormColorId(normalized.colorId);
    setFormFabricId(normalized.fabricId);
    setFormGender(normalized.gender);
    setFormSeason(normalized.season);
    setFormBuyingPrice(normalized.buyingPrice);
    setFormPrice(normalized.price);
    setFormCurrency(normalized.currency);
    setFormSelectedSizes(normalized.selectedSizes);
    setFormSeriesRatio(normalized.seriesRatio);
    setFormSeriesStock(normalized.seriesStock);
    setFormMinOrderSeries(normalized.minOrderSeries);
    setFormIsActive(normalized.isActive);
    setFormImages(normalized.images);
    setFormTranslations(normalized.translations);
    setSourceProductGroupId(normalized.sourceProductGroupId);

    if (normalized.supplierSiblings !== null) {
      setSupplierSiblings(normalized.supplierSiblings);
    } else if (token) {
      const siblingInfo = await fetchProductSiblingsApi(token, prod.id);
      if (siblingInfo.source_product_group_id) {
        setSourceProductGroupId(siblingInfo.source_product_group_id);
      }
      setSupplierSiblings(siblingInfo.siblings);
    }
  };

  // Open Create Modal cloned from an existing product for a brand-new color sibling
  const handleOpenNewColorFromProduct = async (prod: SupplierProductRow) => {
    const defaults = resolveRememberedCreateDefaults();
    setEditingProductId(null);
    setModalViewMode("express");
    setPendingLocalDraft(null);
    setFormNotice(
      `"${prod.title || prod.custom_sku}" modeli baz alınarak yeni renk açılıyor. Sadece yeni rengin fotoğrafını ve rengini seçin.`
    );
    setFormError("");
    setFormContentLegalAccepted(false);

    const initialLinkTarget: SupplierSiblingItemDTO = {
      id: prod.id,
      title: prod.title,
      custom_sku: prod.custom_sku,
      slug: "",
      color_id: prod.color_id ?? undefined,
      color: prod.color || "",
      image_url: prod.cover_image || "",
      price: prod.price,
      currency: prod.currency,
      is_active: prod.is_active,
      source_product_group_id: prod.source_product_group_id || "",
    };

    const prodSeriesStock = prod.series_stock ?? 0;
    setFormTitle(prod.title || "");
    setFormShortDesc("");
    setFormDescription("");
    setFormCategoryId(prod.category_id || defaults.categoryId);
    setFormColorId("");
    setFormFabricId("");
    setFormGender(defaults.gender);
    setFormSeason(defaults.season);
    setFormBuyingPrice(0);
    setFormPrice(prod.price > 0 ? prod.price : 0);
    setFormCurrency(prod.currency || defaults.currency);
    setFormSelectedSizes(defaults.selectedSizes);
    setFormSeriesRatio(defaults.seriesRatio);
    setFormSeriesStock(prodSeriesStock > 0 ? prodSeriesStock : defaults.seriesStock);
    setFormMinOrderSeries(1);
    setFormIsActive(true);
    setFormImages([]);
    setFormTranslations(createEmptyTranslations());
    setSourceProductGroupId(prod.source_product_group_id || "");
    setSupplierSiblings([]);
    setLinkWithProduct(initialLinkTarget);
    setAdditionalColorVariants([]);
    setActiveModal("create");

    const token = getToken();
    if (!token) return;
    const data = await fetchProductDetailApi(token, prod.id);
    if (!data) return;

    const normalized = normalizeEditableProductDetail(
      data as Record<string, unknown>,
      prod,
      sizeDefinitions
    );
    setFormTitle(normalized.title || prod.title);
    setFormShortDesc(normalized.shortDesc);
    setFormDescription(normalized.description);
    if (normalized.categoryId) setFormCategoryId(normalized.categoryId);
    setFormFabricId(normalized.fabricId);
    setFormGender(normalized.gender);
    setFormSeason(normalized.season);
    setFormBuyingPrice(normalized.buyingPrice);
    setFormPrice(normalized.price);
    setFormCurrency(normalized.currency);
    setFormSelectedSizes(normalized.selectedSizes);
    setFormSeriesRatio(normalized.seriesRatio);
    setFormSeriesStock(normalized.seriesStock);
    setFormMinOrderSeries(normalized.minOrderSeries);
    if (normalized.sourceProductGroupId) {
      setSourceProductGroupId(normalized.sourceProductGroupId);
      setLinkWithProduct((prev) =>
        prev
          ? { ...prev, source_product_group_id: normalized.sourceProductGroupId }
          : prev
      );
    }
  };

  const handleOpenEdit = async (prod: SupplierProductRow) => {
    await openProductEditModal(prod, false);
  };

  const handleOpenTranslations = async (prod: SupplierProductRow) => {
    await openProductEditModal(prod, true);
  };

  const persistSmartDefaultsIfValid = () => {
    if (!formCategoryId) return;
    saveSupplierLastDefaults({
      categoryId: formCategoryId,
      currency: formCurrency,
      selectedSizes: formSelectedSizes,
      seriesRatio: formSeriesRatio,
      seriesStock: formSeriesStock,
      gender: formGender,
      season: formSeason,
    });
  };

  const executeProductSubmit = async (
    targetIsActive: boolean,
    isDraft: boolean
  ): Promise<SaveSupplierProductResponse | null> => {
    const errMsg = validateProductForm(
      formTitle,
      formCategoryId,
      formPrice,
      formSelectedSizes,
      isDraft,
      formImages
    );
    if (errMsg) {
      setFormError(errMsg);
      return null;
    }
    if (!formContentLegalAccepted) {
      setFormError("Lütfen telif hakkı, marka ve hukuki sorumluluk beyanını onaylayın.");
      return null;
    }

    const payload = buildProductPayload({
      title: formTitle,
      shortDesc: formShortDesc,
      description: formDescription,
      categoryId: formCategoryId,
      colorId: formColorId,
      fabricId: formFabricId,
      gender: formGender,
      season: formSeason,
      buyingPrice: formBuyingPrice,
      price: formPrice,
      currency: formCurrency,
      selectedSizes: formSelectedSizes,
      seriesRatio: formSeriesRatio,
      seriesStock: formSeriesStock,
      minOrderSeries: formMinOrderSeries,
      isActive: targetIsActive,
      isDraft,
      sourceProductGroupId: sourceProductGroupId || undefined,
      linkWithProductId:
        activeModal === "create" && linkWithProduct ? linkWithProduct.id : undefined,
      additionalColorVariants:
        activeModal === "create" ? additionalColorVariants : undefined,
      images: formImages,
      translations: formTranslations,
      contentResponsibilityAccepted: formContentLegalAccepted,
    });

    const saved = await performProductSave(
      getToken(),
      payload,
      editingProductId,
      setSubmitting,
      setFormError
    );
    if (!saved) return null;

    persistSmartDefaultsIfValid();
    clearSupplierUnsavedDraft();
    setPendingLocalDraft(null);
    return saved;
  };

  // Primary CTA: Publish live (create or draft) or Update existing active model
  const handlePublishOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormNotice("");
    const saved = await executeProductSubmit(true, false);
    if (!saved) return;

    handleCloseProductModal();
    setCatalogBanner({
      type: "success",
      text:
        editingProductId && formIsActive
          ? `"${formTitle.trim()}" güncellendi.`
          : `"${formTitle.trim()}" vitrinde yayına alındı.`,
    });
    void loadProducts();
    void loadProfile();
  };

  // Secondary CTA: Save as Draft (accepts partial fields as long as photo or title exists)
  const handleSaveDraft = async () => {
    setFormNotice("");
    const saved = await executeProductSubmit(false, true);
    if (!saved) return;

    handleCloseProductModal();
    setStatusFilter("passive");
    setCatalogBanner({
      type: "success",
      text: `"${formTitle.trim() || saved.custom_sku || "Yeni ürün"}" taslak olarak kaydedildi.`,
    });
    void loadProducts();
    void loadProfile();
  };

  // Speed CTA: Save current product, keep shared metadata, link next color to just-saved product
  const handleSaveAndNextColor = async () => {
    setFormNotice("");
    const savedIsActive = activeModal === "edit" ? formIsActive : true;
    const savedIsDraft = activeModal === "edit" ? !formIsActive : false;
    const saved = await executeProductSubmit(savedIsActive, savedIsDraft);
    if (!saved) return;

    const savedId = saved.id || editingProductId || "";
    const matchedColor = colors.find((c) => c.id === formColorId);
    const colorDisplay = matchedColor ? cleanAttributeName(matchedColor.name) : "";
    const groupId = saved.source_product_group_id || sourceProductGroupId;

    if (savedId) {
      setLinkWithProduct({
        id: savedId,
        title: formTitle.trim() || saved.custom_sku || "Kayıtlı Model",
        custom_sku: saved.custom_sku || "",
        slug: saved.slug || "",
        color_id: formColorId || undefined,
        color: colorDisplay,
        image_url: formImages[0] || "",
        price: formPrice,
        currency: formCurrency,
        is_active: savedIsActive,
        source_product_group_id: groupId || "",
      });
    }

    setEditingProductId(null);
    setActiveModal("create");
    setSourceProductGroupId(groupId || "");
    setSupplierSiblings([]);
    setAdditionalColorVariants([]);
    setFormImages([]);
    setFormColorId("");
    setFormIsActive(true);
    setFormTranslations(createEmptyTranslations());
    setFormError("");
    setFormNotice(
      `"${formTitle.trim() || saved.custom_sku || "Ürün"}" kaydedildi ve yeni renk bağlantısı kuruldu. Şimdi sıradaki rengin fotoğraflarını bırakıp rengini seçin.`
    );
    void loadProducts();
    void loadProfile();
  };

  // One-click quick publish from Taslaklar / Catalog table
  const handleQuickPublish = async (prod: SupplierProductRow) => {
    if (prod.price <= 0 || !prod.cover_image) {
      await openProductEditModal(prod, false);
      setFormError(
        "Vitrine yayınlamak için lütfen geçerli bir toptan fiyat ve en az 1 fotoğraf ekleyin."
      );
      return;
    }

    const token = getToken();
    if (!token) return;
    setQuickPublishingId(prod.id);
    setCatalogBanner(null);
    const result = await quickPublishSupplierProductApi(token, prod.id);
    setQuickPublishingId(null);

    if (result.ok) {
      setCatalogBanner({
        type: "success",
        text: `"${prod.title || prod.custom_sku}" vitrinde yayına alındı.`,
      });
      void loadProducts();
      void loadProfile();
    } else {
      await openProductEditModal(prod, false);
      setFormError(
        result.error || "Ürün yayına alınamadı; lütfen eksik alanları tamamlayın."
      );
    }
  };

  // Delete Product
  const handleDeleteProduct = async () => {
    await performProductDelete(getToken(), deletingProduct, setSubmitting, () => {
      setActiveModal(null);
      void loadProducts();
      void loadProfile();
    });
  };

  const handleOrderCountChange = useCallback(
    (cnt: number) => {
      setStats((prev) =>
        prev.total_orders === cnt ? prev : { ...prev, total_orders: cnt }
      );
    },
    [setStats]
  );

  const handleProfileSaved = useCallback(() => {
    void loadProfile();
  }, [loadProfile]);

  const handleCatalogRefresh = useCallback(() => {
    void loadProducts();
  }, [loadProducts]);

  const isProductModalOpen = activeModal === "create" || activeModal === "edit";
  const draftCount = stats.draft_products ?? 0;

  return (
    <div className="min-h-screen bg-[#f0f2f5] text-slate-800 flex flex-col">
      <SupplierHeader profile={profile} onLogout={handleLogout} />

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6 flex-1">
        <SupplierStatsCards stats={stats} />

        {activeSection !== "profile" && (
          <SupplierQuickWhatsappBanner
            quickWhatsapp={quickWhatsapp}
            setQuickWhatsapp={setQuickWhatsapp}
            savingQuickWa={savingQuickWa}
            quickWaSavedMsg={quickWaSavedMsg}
            onSubmit={handleSaveQuickWhatsapp}
            onOpenProfileSection={() => setActiveSection("profile")}
          />
        )}

        <SupplierDashboardNavTabs
          activeSection={activeSection}
          setActiveSection={setActiveSection}
          stats={stats}
          unreadChatCount={unreadChatCount}
          onOpenCreate={handleOpenCreate}
          onOpenQuickDraft={handleOpenQuickDraft}
          onOpenExcelImport={() => setIsExcelModalOpen(true)}
          onOpenBulkArchive={() => setIsArchiveModalOpen(true)}
        />

        <SupplierSectionContent
          activeSection={activeSection}
          getToken={getToken}
          onOrderCountChange={handleOrderCountChange}
          onProfileSaved={handleProfileSaved}
          profile={profile}
          products={products}
          onUnreadTotalChange={setUnreadChatCount}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          categories={categories}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          draftCount={draftCount}
          loading={loading}
          onRefresh={handleCatalogRefresh}
          catalogBanner={catalogBanner}
          onDismissCatalogBanner={() => setCatalogBanner(null)}
          quickPublishingId={quickPublishingId}
          onQuickPublish={(p) => void handleQuickPublish(p)}
          onOpenNewColorFromProduct={(p) => void handleOpenNewColorFromProduct(p)}
          onOpenEdit={handleOpenEdit}
          onOpenTranslations={handleOpenTranslations}
          onToggleArchive={(p) => void handleToggleProductArchive(p)}
          onOpenDelete={(p) => {
            setDeletingProduct(p);
            setActiveModal("delete");
          }}
        />
      </main>

      <SupplierExcelImportModal
        isOpen={isExcelModalOpen}
        getToken={getToken}
        onClose={() => setIsExcelModalOpen(false)}
        onImported={() => {
          void loadProducts();
          void loadProfile();
        }}
      />

      <SupplierCollectionArchiveModal
        isOpen={isArchiveModalOpen}
        getToken={getToken}
        onClose={() => setIsArchiveModalOpen(false)}
        onArchived={() => {
          void loadProducts();
          void loadProfile();
        }}
      />

      {isQuickDraftModalOpen && (
        <SupplierQuickDraftModal
          isOpen={isQuickDraftModalOpen}
          getToken={getToken}
          categories={categories}
          defaultCategoryId={quickDraftDefaults.categoryId}
          defaultCurrency={quickDraftDefaults.currency}
          defaultSizes={quickDraftDefaults.selectedSizes}
          defaultSeriesRatio={quickDraftDefaults.seriesRatio}
          defaultSeriesStock={quickDraftDefaults.seriesStock}
          onClose={() => setIsQuickDraftModalOpen(false)}
          onCreated={(createdCount) => {
            setIsQuickDraftModalOpen(false);
            setActiveSection("catalog");
            setStatusFilter("passive");
            setCatalogBanner({
              type: "success",
              text: `${createdCount} adet hızlı ürün taslağı oluşturuldu. Fiyat ve model adı girip "Yayınla" ile vitrine açabilirsiniz.`,
            });
            void loadProducts();
            void loadProfile();
          }}
        />
      )}

      {/* CREATE & EDIT PRODUCT MODAL (EXPRESS + DETAILED + SIBLINGS) */}
      {isProductModalOpen && (
        <SupplierProductModal
          activeModal={activeModal}
          editingProductId={editingProductId}
          profile={profile}
          getToken={getToken}
          onClose={handleCloseProductModal}
          onPublishOrUpdate={handlePublishOrUpdate}
          onSaveDraft={() => void handleSaveDraft()}
          onSaveAndNextColor={() => void handleSaveAndNextColor()}
          submitting={submitting}
          formError={formError}
          formNotice={formNotice}
          modalViewMode={modalViewMode}
          setModalViewMode={setModalViewMode}
          localDraftSavedAt={
            pendingLocalDraft ? formatDraftTimestamp(pendingLocalDraft.savedAt) : null
          }
          onRestoreLocalDraft={handleRestoreLocalDraft}
          onDiscardLocalDraft={handleDiscardLocalDraft}
          formTitle={formTitle}
          setFormTitle={setFormTitle}
          formCategoryId={formCategoryId}
          setFormCategoryId={setFormCategoryId}
          categories={categories}
          formGender={formGender}
          setFormGender={setFormGender}
          formSeason={formSeason}
          setFormSeason={setFormSeason}
          formFabricId={formFabricId}
          setFormFabricId={setFormFabricId}
          fabrics={fabrics}
          formColorId={formColorId}
          setFormColorId={setFormColorId}
          colors={colors}
          formShortDesc={formShortDesc}
          setFormShortDesc={setFormShortDesc}
          formDescription={formDescription}
          setFormDescription={setFormDescription}
          formPrice={formPrice}
          setFormPrice={setFormPrice}
          formBuyingPrice={formBuyingPrice}
          setFormBuyingPrice={setFormBuyingPrice}
          formCurrency={formCurrency}
          setFormCurrency={setFormCurrency}
          formMinOrderSeries={formMinOrderSeries}
          setFormMinOrderSeries={setFormMinOrderSeries}
          formIsActive={formIsActive}
          setFormIsActive={setFormIsActive}
          sizeDefinitions={sizeDefinitions}
          seriesTemplates={seriesTemplates}
          selectedSizes={formSelectedSizes}
          onToggleSize={handleToggleSize}
          onApplySeriesTemplate={handleApplySeriesTemplate}
          seriesRatio={formSeriesRatio}
          onSelectAssortmentMode={handleSelectAssortmentMode}
          seriesStock={formSeriesStock}
          setSeriesStock={setFormSeriesStock}
          formImages={formImages}
          imageUploadLoading={imageUploadLoading}
          onUploadImageFiles={handleUploadImageFiles}
          onReorderImages={handleReorderImages}
          onSetCoverImage={handleSetCoverImage}
          onRemoveImage={handleRemoveImage}
          sourceProductGroupId={sourceProductGroupId}
          supplierSiblings={supplierSiblings}
          onSiblingsUpdated={(groupId, updatedSiblings) => {
            setSourceProductGroupId(groupId);
            setSupplierSiblings(updatedSiblings);
          }}
          linkWithProduct={linkWithProduct}
          onChangeLinkWithProduct={setLinkWithProduct}
          additionalColorVariants={additionalColorVariants}
          onChangeAdditionalColorVariants={setAdditionalColorVariants}
          formTranslations={formTranslations}
          onUpdateTranslationField={handleUpdateTranslationField}
          autoTranslating={autoTranslating}
          onAutoTranslateFromTurkish={() => void handleAutoTranslateFromTurkish()}
          contentLegalAccepted={formContentLegalAccepted}
          setContentLegalAccepted={setFormContentLegalAccepted}
        />
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {activeModal === "delete" && deletingProduct && (
        <SupplierDeleteConfirmModal
          product={deletingProduct}
          submitting={submitting}
          onCancel={() => setActiveModal(null)}
          onConfirm={handleDeleteProduct}
        />
      )}
    </div>
  );
}
