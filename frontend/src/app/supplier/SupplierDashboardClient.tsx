"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  ArchiveRestore
} from "lucide-react";
import { SupplierProductRow } from "@/types/integration";
import { SupplierProductModal } from "./SupplierProductModal";
import {
  SupplierExcelImportModal,
  SupplierCollectionArchiveModal,
  toggleSupplierProductArchiveApi,
} from "./SupplierBulkAndArchiveModals";
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

export interface ProductTranslationsFormMap {
  en: ProductTranslationFormItem;
  ru: ProductTranslationFormItem;
  ar: ProductTranslationFormItem;
}

const DEFAULT_EMPTY_TRANSLATIONS: ProductTranslationsFormMap = {
  en: { title: "", short_description: "", description: "" },
  ru: { title: "", short_description: "", description: "" },
  ar: { title: "", short_description: "", description: "" },
};

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
  total_stock: number;
  total_variants: number;
  total_orders?: number;
}

const DEFAULT_INITIAL_VARIANTS: VariantFormItem[] = [
  { id: "var-s", size: "S", stock: 10, barcode: "" },
  { id: "var-m", size: "M", stock: 15, barcode: "" },
  { id: "var-l", size: "L", stock: 15, barcode: "" },
  { id: "var-xl", size: "XL", stock: 10, barcode: "" },
];

function isAuthStatusError(status: number): boolean {
  return status === 401 || status === 403;
}

function validateProductForm(
  title: string,
  categoryId: string,
  price: number
): { error?: string; tab?: "basic" | "pricing" } {
  if (!title.trim()) {
    return { error: "Ürün adı zorunludur.", tab: "basic" };
  }
  if (!categoryId) {
    return { error: "Lütfen bir kategori seçin.", tab: "basic" };
  }
  if (price <= 0) {
    return { error: "Geçerli bir toptan satış fiyatı giriniz.", tab: "pricing" };
  }
  return {};
}

function parseDetailVariants(
  variants?: Array<{ id?: string; variant_size?: string; size?: string; stock?: number; barcode?: string }>,
  fallbackStock = 0
): VariantFormItem[] {
  if (!variants || variants.length === 0) {
    return [{ id: "var-default", size: "STANDART", stock: fallbackStock, barcode: "" }];
  }
  return variants.map((v, idx) => ({
    id: v.id || `var-${idx}-${Date.now()}`,
    size: v.variant_size || v.size || "STD",
    stock: v.stock || 0,
    barcode: v.barcode || "",
  }));
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
  packingRatio: string;
  seriesRatio: string;
  moq: number;
  isActive: boolean;
  images: string[];
  variants: VariantFormItem[];
  translations: ProductTranslationsFormMap;
}

function buildProductPayload(params: ProductPayloadParams) {
  return {
    title: params.title.trim(),
    short_description: params.shortDesc.trim() || undefined,
    description: params.description.trim() || undefined,
    category_id: params.categoryId,
    color_id: params.colorId || undefined,
    fabric_id: params.fabricId || undefined,
    gender: params.gender || undefined,
    season: params.season || undefined,
    buying_price: Number(params.buyingPrice) || 0,
    price: Number(params.price),
    currency: params.currency,
    packing_ratio: params.packingRatio.trim() || undefined,
    series_ratio: params.seriesRatio.trim() || undefined,
    minimum_order_quantity: Number(params.moq) || 1,
    is_active: params.isActive,
    images: params.images.filter((img) => img.trim() !== ""),
    variants: params.variants
      .filter((v) => v.size.trim() !== "")
      .map((v) => ({
        size: v.size.trim(),
        barcode: v.barcode.trim(),
        stock: Number(v.stock) || 0,
        is_single: false,
      })),
    translations: {
      en: {
        title: params.translations.en.title.trim(),
        short_description: params.translations.en.short_description.trim(),
        description: params.translations.en.description.trim(),
      },
      ru: {
        title: params.translations.ru.title.trim(),
        short_description: params.translations.ru.short_description.trim(),
        description: params.translations.ru.description.trim(),
      },
      ar: {
        title: params.translations.ar.title.trim(),
        short_description: params.translations.ar.short_description.trim(),
        description: params.translations.ar.description.trim(),
      },
    },
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
    }
    return result;
  } catch (err) {
    console.error("Başlangıç verileri yüklenemedi:", err);
    return {};
  }
}

async function uploadSupplierImageFile(token: string, file: File): Promise<string> {
  const fd = new FormData();
  fd.append("image", file);
  const res = await fetch("/api/v1/supplier/upload-image", {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}` },
    body: fd,
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || "Görsel yüklenemedi.");
  }
  const data = await res.json();
  return data.image_url || "";
}

async function saveSupplierProductApi(
  token: string,
  payload: ReturnType<typeof buildProductPayload>,
  editingProductId: string | null
): Promise<void> {
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
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "İşlem kaydedilemedi.");
  }
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
        target_langs: ["en", "ru", "ar"],
        fields: {
          title: title.trim(),
          short_description: shortDesc.trim(),
          description: description.trim(),
        },
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const t = data.translations || {};
      return {
        en: {
          title: t.en?.title || current.en.title,
          short_description: t.en?.short_description || current.en.short_description,
          description: t.en?.description || current.en.description,
        },
        ru: {
          title: t.ru?.title || current.ru.title,
          short_description: t.ru?.short_description || current.ru.short_description,
          description: t.ru?.description || current.ru.description,
        },
        ar: {
          title: t.ar?.title || current.ar.title,
          short_description: t.ar?.short_description || current.ar.short_description,
          description: t.ar?.description || current.ar.description,
        },
      };
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

function updateVariantListItem(
  list: VariantFormItem[],
  index: number,
  field: keyof VariantFormItem,
  val: string | number
): VariantFormItem[] {
  return list.map((item, i) => (i === index ? { ...item, [field]: val } : item));
}

function promoteCoverImageAtIndex(list: string[], index: number): string[] {
  if (index === 0) return list;
  const copy = [...list];
  const [item] = copy.splice(index, 1);
  copy.unshift(item);
  return copy;
}

function strVal(val: unknown, fallback = ""): string {
  return typeof val === "string" && val.length > 0 ? val : fallback;
}

function numVal(val: unknown, fallback = 0): number {
  const n = Number(val);
  return !Number.isNaN(n) && n !== 0 ? n : fallback;
}

function parseDetailTranslations(raw?: Record<string, unknown>): ProductTranslationsFormMap {
  const getLang = (code: "en" | "ru" | "ar"): ProductTranslationFormItem => {
    const obj = (raw?.[code] as Record<string, unknown> | undefined) || {};
    return {
      title: strVal(obj.title),
      short_description: strVal(obj.short_description),
      description: strVal(obj.description),
    };
  };
  return {
    en: getLang("en"),
    ru: getLang("ru"),
    ar: getLang("ar"),
  };
}

function normalizeEditableProductDetail(data: Record<string, unknown>, prod: SupplierProductRow) {
  return {
    title: strVal(data.title),
    shortDesc: strVal(data.short_description),
    description: strVal(data.description),
    categoryId: strVal(data.category_id),
    colorId: strVal(data.color_id),
    fabricId: strVal(data.fabric_id),
    gender: strVal(data.gender),
    season: strVal(data.season),
    buyingPrice: numVal(data.buying_price, 0),
    price: numVal(data.price, 0),
    currency: strVal(data.currency, "TRY"),
    packingRatio: strVal(data.packing_ratio),
    seriesRatio: strVal(data.series_ratio),
    moq: numVal(data.minimum_order_quantity, 1),
    isActive: typeof data.is_active === "boolean" ? data.is_active : true,
    variants: parseDetailVariants(
      data.variants as Array<{ id?: string; variant_size?: string; size?: string; stock?: number; barcode?: string }> | undefined,
      prod.total_stock
    ),
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
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#1677ff] shadow-xs">
            <Building2 size={22} />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-black text-sm tracking-wider uppercase text-slate-900">MERTER VİTRİNİ</span>
              <span className="px-2 py-0.5 rounded-full bg-blue-50 text-[#1677ff] border border-blue-200 text-[10px] font-bold uppercase">
                Tedarikçi Portalı
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="font-bold text-slate-800">{profile?.brand_name || "Yükleniyor..."}</span>
              {profile?.alias_code && (
                <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-mono font-bold">
                  [{profile.alias_code}]
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="w-7 h-7 rounded-full bg-[#1677ff] text-white flex items-center justify-center text-xs font-bold shadow-xs">
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
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors cursor-pointer"
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
        <div className="p-3.5 rounded-xl bg-blue-50 text-[#1677ff]">
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
        <div className="p-3.5 rounded-xl bg-amber-50 text-amber-600">
          <Layers size={22} />
        </div>
        <div>
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Toplam Stok (Adet)</span>
          <span className="text-2xl font-bold text-slate-900 block mt-0.5">{stats.total_stock}</span>
        </div>
      </div>

      <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-4">
        <div className="p-3.5 rounded-xl bg-purple-50 text-purple-600">
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
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
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
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold">
      <span>Pasif</span>
    </span>
  );
}

function SupplierProductTable({
  products,
  loading,
  onOpenEdit,
  onOpenTranslations,
  onToggleArchive,
  onOpenDelete,
}: Readonly<{
  products: SupplierProductRow[];
  loading: boolean;
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
              products.map((p) => (
                <tr key={p.id} className="hover:bg-blue-50/20 transition-colors">
                  <td className="py-2.5 px-4 text-center">
                    <div className="w-12 h-14 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden relative mx-auto flex items-center justify-center shadow-xs">
                      {p.cover_image ? (
                        <Image
                          src={p.cover_image}
                          alt={p.title}
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
                      <span className="font-bold text-slate-900 line-clamp-1">{p.title}</span>
                      <span className="font-mono text-[11px] text-[#1677ff] font-semibold mt-0.5">
                        {p.custom_sku}
                      </span>
                    </div>
                  </td>

                  <td className="py-2.5 px-4 text-slate-600">
                    {p.category_title || "-"}
                  </td>

                  <td className="py-2.5 px-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900">
                        {p.price.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} {p.currency}
                      </span>
                      {p.packing_ratio && (
                        <span className="text-[10px] text-slate-400 font-medium">
                          Paket: {p.packing_ratio}
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="py-2.5 px-4 text-center font-bold text-slate-800">
                    {p.total_stock} adet
                  </td>

                  <td className="py-2.5 px-4 text-center">
                    {getProductRowStatusBadge(p)}
                  </td>

                  <td className="py-2.5 px-4 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onOpenTranslations(p)}
                        className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-blue-200 bg-blue-50/70 text-[#1677ff] hover:bg-blue-100 text-[11px] font-bold transition-colors cursor-pointer"
                        title="Çok Dilli Çevirileri Düzenle (TR / EN / RU / AR)"
                      >
                        <Globe size={13} />
                        <span className="hidden xl:inline">Çeviri</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleArchive(p)}
                        className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-amber-200 bg-amber-50/80 text-amber-800 hover:bg-amber-100 text-[11px] font-bold transition-colors cursor-pointer"
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
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-[#1677ff] hover:bg-blue-50 transition-colors cursor-pointer"
                        title="Düzenle"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenDelete(p)}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors cursor-pointer"
                        title="Sil"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
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
      className="bg-white rounded-xl border border-emerald-200/90 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3"
    >
      <div className="flex items-start sm:items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 font-black text-base shadow-xs">
          WA
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide">
              Doğrudan Müşteri & Sipariş WhatsApp Hattınız
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
          <p className="text-[11px] text-slate-500 mt-0.5">
            Alıcılar ürün sayfalarınızda &quot;WhatsApp ile Doğrudan Tedarikçiye Yaz / Sipariş Ver&quot; butonuna bastığında doğrudan bu numaraya bağlanır.
          </p>
          {quickWaSavedMsg && (
            <p className="text-[11px] font-bold text-emerald-700 mt-1">
              ✓ {quickWaSavedMsg}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full md:w-auto">
        <input
          type="text"
          value={quickWhatsapp}
          onChange={(e) => setQuickWhatsapp(e.target.value)}
          placeholder="+90 532 000 00 00"
          className="flex-1 sm:w-52 px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600"
        />
        <button
          type="submit"
          disabled={savingQuickWa}
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold transition-colors cursor-pointer disabled:opacity-50 shrink-0"
        >
          {savingQuickWa ? "Kaydediliyor..." : "WhatsApp Numaramı Kaydet"}
        </button>
        <button
          type="button"
          onClick={onOpenProfileSection}
          className="px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors cursor-pointer shrink-0"
        >
          Tüm Vitrin & IBAN Ayarları
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
  readonly onOpenExcelImport: () => void;
  readonly onOpenBulkArchive: () => void;
}

function SupplierDashboardNavTabs({
  activeSection,
  setActiveSection,
  stats,
  unreadChatCount,
  onOpenCreate,
  onOpenExcelImport,
  onOpenBulkArchive,
}: SupplierDashboardNavTabsProps) {
  const tabClass = (sec: SupplierDashboardSection) =>
    `px-4 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center gap-2 ${
      activeSection === sec
        ? "bg-white text-slate-900 shadow-xs"
        : "text-slate-600 hover:text-slate-900"
    }`;

  return (
    <div className="flex items-center justify-between border-b border-slate-200 pb-3 flex-wrap gap-3">
      <div className="bg-slate-200/80 p-1 rounded-xl inline-flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => setActiveSection("catalog")}
          className={tabClass("catalog")}
        >
          <Package size={15} className="text-[#1677ff]" />
          <span>Ürün Kataloğum ({stats.total_products})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection("orders")}
          className={tabClass("orders")}
        >
          <ShoppingBag size={15} className="text-emerald-600" />
          <span>Gelen Siparişlerim ({stats.total_orders ?? 0})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection("chat")}
          className={tabClass("chat")}
        >
          <MessageSquare size={15} className="text-[#1677ff]" />
          <span>Canlı Müşteri Sohbetleri</span>
          {unreadChatCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
              {unreadChatCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSection("profile")}
          className={tabClass("profile")}
        >
          <Building2 size={15} className="text-[#1677ff]" />
          <span>Firma Vitrin & İletişim Bilgilerim</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection("billing")}
          className={tabClass("billing")}
        >
          <CreditCard size={15} className="text-emerald-600" />
          <span>Üyelik, Muhasebe & Faturalarım</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection("analytics")}
          className={tabClass("analytics")}
        >
          <BarChart3 size={15} className="text-violet-600" />
          <span>Ziyaretçi & ROI Analitiği</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection("rfq")}
          className={tabClass("rfq")}
        >
          <FileText size={15} className="text-amber-600" />
          <span>Alıcı Talepleri (RFQ)</span>
        </button>
      </div>

      {activeSection === "catalog" && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenBulkArchive}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold transition-all cursor-pointer"
          >
            <Archive size={15} />
            <span>Eski Koleksiyonu Arşivle</span>
          </button>

          <button
            type="button"
            onClick={onOpenExcelImport}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <FileSpreadsheet size={15} />
            <span>Excel / CSV ile Toplu Yükle</span>
          </button>

          <button
            type="button"
            onClick={onOpenCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1677ff] hover:bg-[#4096ff] text-white text-xs font-bold shadow-sm shadow-blue-500/20 transition-all cursor-pointer active:scale-95"
          >
            <Plus size={16} />
            <span>Yeni Ürün Ekle</span>
          </button>
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
  loading,
  onRefresh,
}: SupplierCatalogToolbarProps) {
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
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-white border border-slate-300 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1677ff]/20 focus:border-[#1677ff] transition-all"
          />
        </div>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="w-full sm:w-48 px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1677ff]/20 focus:border-[#1677ff] transition-all"
        >
          <option value="">Tüm Kategoriler</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>

        <div className="flex rounded-lg bg-slate-100 p-1 border border-slate-200 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === "all" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Tümü
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("active")}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === "active" ? "bg-white text-emerald-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Yayında
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("passive")}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === "passive" ? "bg-white text-slate-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Pasif
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("archived")}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === "archived" ? "bg-white text-amber-800 shadow-xs" : "text-slate-600 hover:text-slate-900"
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
          className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
          title="Yenile"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
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
  loading,
  onRefresh,
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
  loading: boolean;
  onRefresh: () => void;
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
        loading={loading}
        onRefresh={onRefresh}
      />

      <SupplierProductTable
        products={products}
        loading={loading}
        onOpenEdit={onOpenEdit}
        onOpenTranslations={onOpenTranslations}
        onToggleArchive={onToggleArchive}
        onOpenDelete={onOpenDelete}
      />
    </>
  );
}

function applyProfileDataToSetters(
  res: {
    user?: SupplierProfile;
    stats?: DashboardStats;
    whatsappPhone?: string;
    categories?: CategoryOption[];
    colors?: AttributeItem[];
    fabrics?: AttributeItem[];
    isAuthError?: boolean;
  },
  onLogout: () => void,
  setProfile: (p: SupplierProfile) => void,
  setStats: (s: DashboardStats) => void,
  setQuickWhatsapp: (w: string) => void,
  setCategories?: (c: CategoryOption[]) => void,
  setColors?: (c: AttributeItem[]) => void,
  setFabrics?: (f: AttributeItem[]) => void
) {
  if (res.isAuthError) {
    onLogout();
    return;
  }
  if (res.user) setProfile(res.user);
  if (res.stats) setStats(res.stats);
  if (res.whatsappPhone !== undefined) setQuickWhatsapp(res.whatsappPhone);
  if (setCategories && res.categories) setCategories(res.categories);
  if (setColors && res.colors) setColors(res.colors);
  if (setFabrics && res.fabrics) setFabrics(res.fabrics);
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

  const getToken = useCallback(() => getStoredSupplierToken(), []);

  const handleLogout = useCallback(() => {
    clearStoredSupplierSession();
    router.push("/supplier/login");
  }, [router]);

  const loadProfile = useCallback(async () => {
    const token = getToken();
    if (!token) return handleLogout();
    const res = await fetchSupplierProfile(token);
    applyProfileDataToSetters(res, handleLogout, setProfile, setStats, setQuickWhatsapp);
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
        applyProfileDataToSetters(
          data,
          handleLogout,
          setProfile,
          setStats,
          setQuickWhatsapp,
          setCategories,
          setColors,
          setFabrics
        );
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

async function performImageUpload(
  file: File | undefined,
  token: string | null,
  setLoading: (v: boolean) => void,
  onUploaded: (url: string) => void
) {
  if (!file || !token) return;
  setLoading(true);
  try {
    const imageUrl = await uploadSupplierImageFile(token, file);
    if (imageUrl) onUploaded(imageUrl);
  } catch (err: unknown) {
    alert((err as Error).message);
  } finally {
    setLoading(false);
  }
}

async function performProductSave(
  token: string | null,
  payload: ReturnType<typeof buildProductPayload>,
  editingProductId: string | null,
  setSubmitting: (v: boolean) => void,
  setFormError: (msg: string) => void,
  onSuccess: () => void
) {
  if (!token) return;
  setSubmitting(true);
  setFormError("");
  try {
    await saveSupplierProductApi(token, payload, editingProductId);
    onSuccess();
  } catch (err: unknown) {
    setFormError(strVal((err as Error).message, "Kayıt sırasında bir hata oluştu."));
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
    getToken,
    handleLogout,
    loadProfile,
    handleSaveQuickWhatsapp,
  } = useSupplierAuthAndProfile(router);

  // Filter state
  const [activeSection, setActiveSection] = useState<SupplierDashboardSection>("catalog");
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [statusFilter, setStatusFilter] = useState<SupplierStatusFilter>("all");
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);

  const { products, loading, loadProducts } = useSupplierProductCatalog(
    getToken,
    searchQuery,
    selectedCategory,
    statusFilter
  );

  const handleToggleProductArchive = async (prod: SupplierProductRow) => {
    const token = getToken();
    if (!token) return;
    const nextArchived = !Boolean(prod.is_archived);
    const ok = await toggleSupplierProductArchiveApi(token, prod.id, nextArchived, true);
    if (ok) {
      void loadProducts();
      void loadProfile();
    }
  };

  // Modal state
  const [activeModal, setActiveModal] = useState<"create" | "edit" | "delete" | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<SupplierProductRow | null>(null);

  // Product Form State
  const [modalTab, setModalTab] = useState<"basic" | "pricing" | "variants" | "images" | "translations">("basic");
  const [formTitle, setFormTitle] = useState("");
  const [formShortDesc, setFormShortDesc] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formColorId, setFormColorId] = useState("");
  const [formFabricId, setFormFabricId] = useState("");
  const [formGender, setFormGender] = useState("");
  const [formSeason, setFormSeason] = useState("");
  const [formBuyingPrice, setFormBuyingPrice] = useState<number>(0);
  const [formPrice, setFormPrice] = useState<number>(0);
  const [formCurrency, setFormCurrency] = useState("TRY");
  const [formPackingRatio, setFormPackingRatio] = useState("S-M-L-XL 4'lü paket");
  const [formSeriesRatio, setFormSeriesRatio] = useState("");
  const [formMoq, setFormMoq] = useState<number>(1);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formImages, setFormImages] = useState<string[]>([]);
  const [formVariants, setFormVariants] = useState<VariantFormItem[]>(DEFAULT_INITIAL_VARIANTS);
  const [formTranslations, setFormTranslations] = useState<ProductTranslationsFormMap>(DEFAULT_EMPTY_TRANSLATIONS);
  const [autoTranslating, setAutoTranslating] = useState(false);
  const [imageUploadLoading, setImageUploadLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Add Variant Row
  const handleAddVariantRow = () => {
    setFormVariants((prev) => [
      ...prev,
      { id: `var-${Date.now()}-${prev.length + 1}`, size: "", stock: 10, barcode: "" },
    ]);
  };

  // Remove Variant Row
  const handleRemoveVariantRow = (index: number) => {
    setFormVariants((prev) => prev.filter((_, i) => i !== index));
  };

  // Update Variant Row
  const handleUpdateVariantRow = (index: number, field: keyof VariantFormItem, val: string | number) => {
    setFormVariants((prev) => updateVariantListItem(prev, index, field, val));
  };

  // Image upload
  const handleUploadImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    await performImageUpload(file, getToken(), setImageUploadLoading, (imageUrl) => {
      setFormImages((prev) => [...prev, imageUrl]);
    });
    e.target.value = "";
  };

  const handleRemoveImage = (index: number) => {
    setFormImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSetCoverImage = (index: number) => {
    setFormImages((prev) => promoteCoverImageAtIndex(prev, index));
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingProductId(null);
    setFormTitle("");
    setFormShortDesc("");
    setFormDescription("");
    setFormCategoryId(categories[0]?.id ?? "");
    setFormColorId("");
    setFormFabricId("");
    setFormGender("Kadın");
    setFormSeason("İlkbahar/Yaz");
    setFormBuyingPrice(0);
    setFormPrice(0);
    setFormCurrency("TRY");
    setFormPackingRatio("S-M-L-XL 4'lü paket");
    setFormSeriesRatio("");
    setFormMoq(1);
    setFormIsActive(true);
    setFormImages([]);
    setFormVariants(DEFAULT_INITIAL_VARIANTS);
    setFormTranslations(DEFAULT_EMPTY_TRANSLATIONS);
    setModalTab("basic");
    setFormError("");
    setActiveModal("create");
  };

  const handleUpdateTranslationField = (
    lang: "en" | "ru" | "ar",
    field: "title" | "short_description" | "description",
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

  // Ant Design Fast Series & Bulk Stock Wizards
  const handleApplyPresetSeries = (sizes: string[], packingText: string) => {
    const newVars: VariantFormItem[] = sizes.map((s, i) => ({
      id: `var-${i}-${Date.now()}`,
      size: s,
      stock: 10,
      barcode: "",
    }));
    setFormVariants(newVars);
    if (packingText) {
      setFormPackingRatio(packingText);
    }
  };

  const handleApplyBulkStock = (stockCount: number) => {
    setFormVariants((prev) => prev.map((v) => ({ ...v, stock: Math.max(0, stockCount) })));
  };

  // Open Edit Modal
  const openProductEditWithTab = async (
    prod: SupplierProductRow,
    initialTab: "basic" | "translations"
  ) => {
    setEditingProductId(prod.id);
    setModalTab(initialTab);
    setFormError("");
    setActiveModal("edit");

    const data = await fetchProductDetailApi(getToken() ?? "", prod.id);
    if (!data) return;

    const normalized = normalizeEditableProductDetail(data as Record<string, unknown>, prod);
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
    setFormPackingRatio(normalized.packingRatio);
    setFormSeriesRatio(normalized.seriesRatio);
    setFormMoq(normalized.moq);
    setFormIsActive(normalized.isActive);
    setFormVariants(normalized.variants);
    setFormImages(normalized.images);
    setFormTranslations(normalized.translations);
  };

  const handleOpenEdit = async (prod: SupplierProductRow) => {
    await openProductEditWithTab(prod, "basic");
  };

  const handleOpenTranslations = async (prod: SupplierProductRow) => {
    await openProductEditWithTab(prod, "translations");
  };

  // Save Product (Create or Edit)
  const handleSubmitProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateProductForm(formTitle, formCategoryId, formPrice);
    if (validation.error) {
      setFormError(validation.error);
      setModalTab(validation.tab ?? "basic");
      return;
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
      packingRatio: formPackingRatio,
      seriesRatio: formSeriesRatio,
      moq: formMoq,
      isActive: formIsActive,
      images: formImages,
      variants: formVariants,
      translations: formTranslations,
    });

    await performProductSave(getToken(), payload, editingProductId, setSubmitting, setFormError, () => {
      setActiveModal(null);
      void loadProducts();
      void loadProfile();
    });
  };

  // Delete Product
  const handleDeleteProduct = async () => {
    await performProductDelete(getToken(), deletingProduct, setSubmitting, () => {
      setActiveModal(null);
      void loadProducts();
      void loadProfile();
    });
  };

  const isProductModalOpen = activeModal === "create" || activeModal === "edit";

  return (
    <div className="min-h-screen bg-[#f0f2f5] text-slate-800 flex flex-col">
      <SupplierHeader profile={profile} onLogout={handleLogout} />

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6 flex-1">
        <SupplierStatsCards stats={stats} />

        <SupplierQuickWhatsappBanner
          quickWhatsapp={quickWhatsapp}
          setQuickWhatsapp={setQuickWhatsapp}
          savingQuickWa={savingQuickWa}
          quickWaSavedMsg={quickWaSavedMsg}
          onSubmit={handleSaveQuickWhatsapp}
          onOpenProfileSection={() => setActiveSection("profile")}
        />

        <SupplierDashboardNavTabs
          activeSection={activeSection}
          setActiveSection={setActiveSection}
          stats={stats}
          unreadChatCount={unreadChatCount}
          onOpenCreate={handleOpenCreate}
          onOpenExcelImport={() => setIsExcelModalOpen(true)}
          onOpenBulkArchive={() => setIsArchiveModalOpen(true)}
        />

        <SupplierSectionContent
          activeSection={activeSection}
          getToken={getToken}
          onOrderCountChange={(cnt) =>
            setStats((prev) => ({ ...prev, total_orders: cnt }))
          }
          onProfileSaved={() => void loadProfile()}
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
          loading={loading}
          onRefresh={() => void loadProducts()}
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

      {/* CREATE & EDIT PRODUCT MODAL (ANT DESIGN PRO STYLE) */}
      {isProductModalOpen && (
        <SupplierProductModal
          activeModal={activeModal}
          editingProductId={editingProductId}
          profile={profile}
          onClose={() => setActiveModal(null)}
          onSubmit={handleSubmitProduct}
          modalTab={modalTab}
          setModalTab={setModalTab}
          submitting={submitting}
          formError={formError}
          formTitle={formTitle}
          setFormTitle={setFormTitle}
          formCategoryId={formCategoryId}
          setFormCategoryId={setFormCategoryId}
          categories={categories}
          formGender={formGender}
          setFormGender={setFormGender}
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
          formPackingRatio={formPackingRatio}
          setFormPackingRatio={setFormPackingRatio}
          formMoq={formMoq}
          setFormMoq={setFormMoq}
          formIsActive={formIsActive}
          setFormIsActive={setFormIsActive}
          formVariants={formVariants}
          onAddVariantRow={handleAddVariantRow}
          onUpdateVariantRow={handleUpdateVariantRow}
          onRemoveVariantRow={handleRemoveVariantRow}
          onApplyPresetSeries={handleApplyPresetSeries}
          onApplyBulkStock={handleApplyBulkStock}
          formImages={formImages}
          imageUploadLoading={imageUploadLoading}
          onUploadImageFile={handleUploadImageFile}
          onSetCoverImage={handleSetCoverImage}
          onRemoveImage={handleRemoveImage}
          formTranslations={formTranslations}
          onUpdateTranslationField={handleUpdateTranslationField}
          autoTranslating={autoTranslating}
          onAutoTranslateFromTurkish={() => void handleAutoTranslateFromTurkish()}
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
