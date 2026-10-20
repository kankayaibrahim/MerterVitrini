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
  MessageSquare
} from "lucide-react";
import { SupplierProductRow } from "@/types/integration";
import { SupplierProductModal } from "./SupplierProductModal";
import SupplierChatPanel from "./SupplierChatPanel";

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

async function fetchSupplierProfile(token: string): Promise<{ user?: SupplierProfile; stats?: DashboardStats; isAuthError?: boolean }> {
  try {
    const res = await fetch("/api/v1/supplier/profile", {
      headers: { "Authorization": `Bearer ${token}` },
    });
    if (isAuthStatusError(res.status)) return { isAuthError: true };
    if (res.ok) {
      const data = await res.json();
      return { user: data.user, stats: data.stats };
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
      categories?: CategoryOption[];
      colors?: AttributeItem[];
      fabrics?: AttributeItem[];
    } = {};

    if (profileRes.ok) {
      const pData = await profileRes.json();
      result.user = pData.user;
      result.stats = pData.stats;
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

function SupplierProductTable({
  products,
  loading,
  onOpenEdit,
  onOpenDelete,
}: Readonly<{
  products: SupplierProductRow[];
  loading: boolean;
  onOpenEdit: (prod: SupplierProductRow) => void;
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
                    {p.is_active ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Yayında</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold">
                        <span>Pasif</span>
                      </span>
                    )}
                  </td>

                  <td className="py-2.5 px-4 text-right">
                    <div className="inline-flex items-center gap-1.5">
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

export default function SupplierDashboardClient() {
  const router = useRouter();

  // Auth state
  const [profile, setProfile] = useState<SupplierProfile | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    total_products: 0,
    active_products: 0,
    total_stock: 0,
    total_variants: 0,
  });

  // Catalog state
  const [products, setProducts] = useState<SupplierProductRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [colors, setColors] = useState<AttributeItem[]>([]);
  const [fabrics, setFabrics] = useState<AttributeItem[]>([]);

  // Filter state
  const [activeSection, setActiveSection] = useState<"catalog" | "chat">("catalog");
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "passive">("all");

  // Modal state
  const [activeModal, setActiveModal] = useState<"create" | "edit" | "delete" | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<SupplierProductRow | null>(null);

  // Product Form State
  const [modalTab, setModalTab] = useState<"basic" | "pricing" | "variants" | "images">("basic");
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
  const [formVariants, setFormVariants] = useState<VariantFormItem[]>([
    { id: "var-s", size: "S", stock: 10, barcode: "" },
    { id: "var-m", size: "M", stock: 15, barcode: "" },
    { id: "var-l", size: "L", stock: 15, barcode: "" },
    { id: "var-xl", size: "XL", stock: 10, barcode: "" },
  ]);
  const [imageUploadLoading, setImageUploadLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const getToken = useCallback(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("supplier_token");
  }, []);

  const handleLogout = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("supplier_token");
      localStorage.removeItem("supplier_user");
    }
    router.push("/supplier/login");
  }, [router]);

  // Load Profile & Stats
  const loadProfile = useCallback(async () => {
    const token = getToken();
    if (!token) return handleLogout();
    const res = await fetchSupplierProfile(token);
    if (res.isAuthError) return handleLogout();
    if (res.user) setProfile(res.user);
    if (res.stats) setStats(res.stats);
  }, [getToken, handleLogout]);

  // Load Products
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

  // Initial Data Fetch
  useEffect(() => {
    let ignore = false;
    async function initDashboard() {
      const token = getToken();
      if (!token) return handleLogout();

      const data = await fetchInitialSupplierData(token);
      if (data.isAuthError) return handleLogout();
      if (ignore) return;

      if (data.user) setProfile(data.user);
      if (data.stats) setStats(data.stats);
      if (data.categories) setCategories(data.categories);
      if (data.colors) setColors(data.colors);
      if (data.fabrics) setFabrics(data.fabrics);
    }

    void initDashboard();

    return () => {
      ignore = true;
    };
  }, [getToken, handleLogout]);

  // Synchronize Products Query
  useEffect(() => {
    let ignore = false;
    async function syncProducts() {
      const token = getToken();
      if (!token) return;

      const list = await fetchSupplierProducts(
        token,
        buildProductSearchParams(searchQuery, selectedCategory, statusFilter)
      );
      if (!ignore) {
        setProducts(list);
      }
    }

    void syncProducts();

    return () => {
      ignore = true;
    };
  }, [getToken, searchQuery, selectedCategory, statusFilter]);

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
    setFormVariants((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: val } : item))
    );
  };

  // Image upload
  const handleUploadImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const token = getToken();
    if (!file || !token) return;

    setImageUploadLoading(true);
    try {
      const imageUrl = await uploadSupplierImageFile(token, file);
      if (imageUrl) {
        setFormImages((prev) => [...prev, imageUrl]);
      }
    } catch (err: unknown) {
      alert((err as Error).message);
    } finally {
      setImageUploadLoading(false);
      e.target.value = "";
    }
  };

  const handleRemoveImage = (index: number) => {
    setFormImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSetCoverImage = (index: number) => {
    if (index === 0) return;
    setFormImages((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.unshift(item);
      return copy;
    });
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingProductId(null);
    setFormTitle("");
    setFormShortDesc("");
    setFormDescription("");
    setFormCategoryId(categories[0]?.id || "");
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
    setModalTab("basic");
    setFormError("");
    setActiveModal("create");
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
  const handleOpenEdit = async (prod: SupplierProductRow) => {
    const token = getToken();
    if (!token) return;

    setEditingProductId(prod.id);
    setModalTab("basic");
    setFormError("");
    setActiveModal("edit");

    const data = await fetchProductDetailApi(token, prod.id);
    if (!data) return;

    setFormTitle(data.title || "");
    setFormShortDesc(data.short_description || "");
    setFormDescription(data.description || "");
    setFormCategoryId(data.category_id || "");
    setFormColorId(data.color_id || "");
    setFormFabricId(data.fabric_id || "");
    setFormGender(data.gender || "");
    setFormSeason(data.season || "");
    setFormBuyingPrice(data.buying_price || 0);
    setFormPrice(data.price || 0);
    setFormCurrency(data.currency || "TRY");
    setFormPackingRatio(data.packing_ratio || "");
    setFormSeriesRatio(data.series_ratio || "");
    setFormMoq(data.minimum_order_quantity || 1);
    setFormIsActive(data.is_active ?? true);
    setFormVariants(parseDetailVariants(data.variants, prod.total_stock));
    setFormImages(parseDetailImages(data.images, prod.cover_image));
  };

  // Save Product (Create or Edit)
  const handleSubmitProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateProductForm(formTitle, formCategoryId, formPrice);
    if (validation.error) {
      setFormError(validation.error);
      if (validation.tab) setModalTab(validation.tab);
      return;
    }

    const token = getToken();
    if (!token) return;

    setSubmitting(true);
    setFormError("");

    try {
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
      });

      await saveSupplierProductApi(token, payload, editingProductId);
      setActiveModal(null);
      void loadProducts();
      void loadProfile();
    } catch (err: unknown) {
      setFormError((err as Error).message || "Kayıt sırasında bir hata oluştu.");
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Product
  const handleDeleteProduct = async () => {
    const token = getToken();
    if (!deletingProduct || !token) return;

    setSubmitting(true);
    try {
      await deleteSupplierProductApi(token, deletingProduct.id);
      setActiveModal(null);
      void loadProducts();
      void loadProfile();
    } catch (err: unknown) {
      alert((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f2f5] text-slate-800 flex flex-col">
      {/* Ant Design Pro Top Header (Clean Light Theme) */}
      <SupplierHeader profile={profile} onLogout={handleLogout} />

      {/* Main Content */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6 flex-1">
        {/* Ant Design Statistics Cards */}
        <SupplierStatsCards stats={stats} />

        {/* Ant Design Segmented Tabs: Catalog vs Real-Time Customer Chat */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 flex-wrap gap-3">
          <div className="bg-slate-200/80 p-1 rounded-xl inline-flex gap-1">
            <button
              type="button"
              onClick={() => setActiveSection("catalog")}
              className={`px-4 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center gap-2 ${
                activeSection === "catalog"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Package size={15} className="text-[#1677ff]" />
              <span>Ürün Kataloğum ({stats.total_products})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection("chat")}
              className={`px-4 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center gap-2 ${
                activeSection === "chat"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <MessageSquare size={15} className="text-[#1677ff]" />
              <span>Canlı Müşteri Sohbetleri</span>
              {unreadChatCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                  {unreadChatCount}
                </span>
              )}
            </button>
          </div>

          {activeSection === "catalog" && (
            <button
              type="button"
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1677ff] hover:bg-[#4096ff] text-white text-xs font-bold shadow-sm shadow-blue-500/20 transition-all cursor-pointer active:scale-95"
            >
              <Plus size={16} />
              <span>Yeni Ürün Ekle</span>
            </button>
          )}
        </div>

        {activeSection === "chat" ? (
          <SupplierChatPanel
            brandId={profile?.brand_id || ""}
            supplierUserId={profile?.sub || ""}
            products={products}
            getToken={getToken}
            onUnreadTotalChange={setUnreadChatCount}
          />
        ) : (
          <>
        {/* Ant Design Action & Filter Toolbar */}
        <section className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto flex-1">
            {/* Search */}
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

            {/* Category Filter */}
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

            {/* Status Filter */}
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
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
            <button
              type="button"
              onClick={() => void loadProducts()}
              disabled={loading}
              className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
              title="Yenile"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </section>

        {/* Ant Design Style Product List Table */}
        <SupplierProductTable
          products={products}
          loading={loading}
          onOpenEdit={handleOpenEdit}
          onOpenDelete={(p) => {
            setDeletingProduct(p);
            setActiveModal("delete");
          }}
        />
          </>
        )}
      </main>

      {/* CREATE & EDIT PRODUCT MODAL (ANT DESIGN PRO STYLE) */}
      {(activeModal === "create" || activeModal === "edit") && (
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
