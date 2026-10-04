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
  XCircle, 
  Trash2, 
  Edit3, 
  Layers, 
  Tag
} from "lucide-react";
import { SupplierProductRow } from "@/types/integration";
import { SupplierProductModal } from "./SupplierProductModal";

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
    router.push("/tedarikci/login");
  }, [router]);

  // Load Profile & Stats
  const loadProfile = useCallback(async () => {
    const token = getToken();
    if (!token) {
      handleLogout();
      return;
    }

    try {
      const res = await fetch("/api/v1/supplier/profile", {
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (res.status === 401 || res.status === 403) {
        handleLogout();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setProfile(data.user);
        if (data.stats) {
          setStats(data.stats);
        }
      }
    } catch (err) {
      console.error("Profil yüklenemedi:", err);
    }
  }, [getToken, handleLogout]);

  // Load Products
  const loadProducts = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("q", searchQuery);
      if (selectedCategory) params.set("category_id", selectedCategory);
      if (statusFilter !== "all") params.set("status", statusFilter);
      params.set("limit", "50");

      const res = await fetch(`/api/v1/supplier/products?${params.toString()}`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
      }
    } catch (err) {
      console.error("Ürünler yüklenemedi:", err);
    } finally {
      setLoading(false);
    }
  }, [getToken, searchQuery, selectedCategory, statusFilter]);

  // Initial Data Fetch
  useEffect(() => {
    let ignore = false;
    async function initDashboard() {
      const token = getToken();
      if (!token) {
        handleLogout();
        return;
      }

      try {
        const [profileRes, catRes, attrRes] = await Promise.all([
          fetch("/api/v1/supplier/profile", { headers: { "Authorization": `Bearer ${token}` } }),
          fetch("/api/v1/supplier/categories", { headers: { "Authorization": `Bearer ${token}` } }),
          fetch("/api/v1/supplier/attributes", { headers: { "Authorization": `Bearer ${token}` } }),
        ]);

        if (profileRes.status === 401 || profileRes.status === 403) {
          handleLogout();
          return;
        }

        if (profileRes.ok && !ignore) {
          const pData = await profileRes.json();
          setProfile(pData.user);
          if (pData.stats) setStats(pData.stats);
        }

        if (catRes.ok && !ignore) {
          const cats = await catRes.json();
          setCategories(cats);
        }

        if (attrRes.ok && !ignore) {
          const attrs = await attrRes.json();
          setColors(attrs.colors || []);
          setFabrics(attrs.fabrics || []);
        }
      } catch (err) {
        console.error("Başlangıç verileri yüklenemedi:", err);
      }
    }

    void initDashboard();

    return () => {
      ignore = true;
    };
  }, [getToken, handleLogout]);

  // Synchronize Products Query
  useEffect(() => {
    let ignore = false;
    async function fetchProducts() {
      const token = getToken();
      if (!token) return;

      try {
        const params = new URLSearchParams();
        if (searchQuery) params.set("q", searchQuery);
        if (selectedCategory) params.set("category_id", selectedCategory);
        if (statusFilter !== "all") params.set("status", statusFilter);
        params.set("limit", "50");

        const res = await fetch(`/api/v1/supplier/products?${params.toString()}`, {
          headers: { "Authorization": `Bearer ${token}` },
        });
        if (res.ok && !ignore) {
          const data = await res.json();
          setProducts(data.products || []);
        }
      } catch (err) {
        console.error("Ürünler yüklenemedi:", err);
      }
    }

    void fetchProducts();

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
    if (!file) return;

    const token = getToken();
    if (!token) return;

    setImageUploadLoading(true);
    try {
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
      if (data.image_url) {
        setFormImages((prev) => [...prev, data.image_url]);
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
    setFormVariants([
      { id: "var-s", size: "S", stock: 10, barcode: "" },
      { id: "var-m", size: "M", stock: 15, barcode: "" },
      { id: "var-l", size: "L", stock: 15, barcode: "" },
      { id: "var-xl", size: "XL", stock: 10, barcode: "" },
    ]);
    setModalTab("basic");
    setFormError("");
    setActiveModal("create");
  };

  // Open Edit Modal
  const handleOpenEdit = async (prod: SupplierProductRow) => {
    const token = getToken();
    if (!token) return;

    setEditingProductId(prod.id);
    setModalTab("basic");
    setFormError("");
    setActiveModal("edit");

    try {
      const res = await fetch(`/api/v1/supplier/products/${prod.id}`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
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

        if (data.variants && data.variants.length > 0) {
          setFormVariants(
            data.variants.map((v: { id?: string; variant_size?: string; size?: string; stock?: number; barcode?: string }, idx: number) => ({
              id: v.id || `var-${idx}-${Date.now()}`,
              size: v.variant_size || v.size || "STD",
              stock: v.stock || 0,
              barcode: v.barcode || "",
            }))
          );
        } else {
          setFormVariants([{ id: "var-default", size: "STANDART", stock: prod.total_stock, barcode: "" }]);
        }

        if (data.images && data.images.length > 0) {
          setFormImages(data.images.map((img: { image_url?: string; ImageUrl?: string }) => img.image_url || img.ImageUrl || ""));
        } else if (prod.cover_image) {
          setFormImages([prod.cover_image]);
        } else {
          setFormImages([]);
        }
      }
    } catch (err) {
      console.error("Ürün detayları alınamadı:", err);
    }
  };

  // Save Product (Create or Edit)
  const handleSubmitProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError("Ürün adı zorunludur.");
      setModalTab("basic");
      return;
    }
    if (!formCategoryId) {
      setFormError("Lütfen bir kategori seçin.");
      setModalTab("basic");
      return;
    }
    if (formPrice <= 0) {
      setFormError("Geçerli bir toptan satış fiyatı giriniz.");
      setModalTab("pricing");
      return;
    }

    const token = getToken();
    if (!token) return;

    setSubmitting(true);
    setFormError("");

    const payload = {
      title: formTitle.trim(),
      short_description: formShortDesc.trim() || undefined,
      description: formDescription.trim() || undefined,
      category_id: formCategoryId,
      color_id: formColorId || undefined,
      fabric_id: formFabricId || undefined,
      gender: formGender || undefined,
      season: formSeason || undefined,
      buying_price: Number(formBuyingPrice) || 0,
      price: Number(formPrice),
      currency: formCurrency,
      packing_ratio: formPackingRatio.trim() || undefined,
      series_ratio: formSeriesRatio.trim() || undefined,
      minimum_order_quantity: Number(formMoq) || 1,
      is_active: formIsActive,
      images: formImages.filter((img) => img.trim() !== ""),
      variants: formVariants
        .filter((v) => v.size.trim() !== "")
        .map((v) => ({
          size: v.size.trim(),
          barcode: v.barcode.trim(),
          stock: Number(v.stock) || 0,
          is_single: false,
        })),
    };

    try {
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

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "İşlem kaydedilemedi.");
      }

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
    if (!deletingProduct) return;
    const token = getToken();
    if (!token) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/supplier/products/${deletingProduct.id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Ürün silinemedi.");
      }
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
    <div className="min-h-screen bg-zinc-50 text-zinc-900 flex flex-col">
      {/* Top Header */}
      <header className="bg-zinc-950 text-white border-b border-zinc-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Building2 size={22} />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-black text-sm tracking-wider uppercase text-white">MERTER VİTRİNİ</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-500 text-zinc-950 text-[10px] font-black uppercase">
                  Tedarikçi Portalı
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                <span className="font-bold text-zinc-200">{profile?.brand_name || "Yükleniyor..."}</span>
                {profile?.alias_code && (
                  <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-amber-400 text-[10px] font-mono font-bold">
                    [{profile.alias_code}]
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-bold text-zinc-200">{profile?.contact_name}</span>
              <span className="text-[11px] font-mono text-zinc-400">{profile?.email}</span>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="p-2.5 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors cursor-pointer"
              title="Güvenli Çıkış"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6 flex-1">
        {/* Statistics Cards */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-xs flex items-center gap-4">
            <div className="p-3.5 rounded-xl bg-violet-50 text-violet-600">
              <Package size={22} />
            </div>
            <div>
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">Toplam Ürün</span>
              <span className="text-2xl font-black text-zinc-900 block mt-0.5">{stats.total_products}</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-xs flex items-center gap-4">
            <div className="p-3.5 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={22} />
            </div>
            <div>
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">Yayındaki Ürünler</span>
              <span className="text-2xl font-black text-zinc-900 block mt-0.5">{stats.active_products}</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-xs flex items-center gap-4">
            <div className="p-3.5 rounded-xl bg-amber-50 text-amber-600">
              <Layers size={22} />
            </div>
            <div>
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">Toplam Stok (Adet)</span>
              <span className="text-2xl font-black text-zinc-900 block mt-0.5">{stats.total_stock}</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-xs flex items-center gap-4">
            <div className="p-3.5 rounded-xl bg-indigo-50 text-indigo-600">
              <Tag size={22} />
            </div>
            <div>
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">Varyant Sayısı</span>
              <span className="text-2xl font-black text-zinc-900 block mt-0.5">{stats.total_variants}</span>
            </div>
          </div>
        </section>

        {/* Action & Filter Toolbar */}
        <section className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto flex-1">
            {/* Search */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ürün adı veya SKU ile ara..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>

            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full sm:w-48 px-3 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            >
              <option value="">Tüm Kategoriler</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <div className="flex rounded-xl bg-zinc-100 p-1 border border-zinc-200/60 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === "all" ? "bg-white text-zinc-900 shadow-xs" : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                Tümü
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("active")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === "active" ? "bg-white text-emerald-700 shadow-xs" : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                Aktif
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("passive")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === "passive" ? "bg-white text-zinc-700 shadow-xs" : "text-zinc-600 hover:text-zinc-900"
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
              className="p-2.5 rounded-xl border border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 transition-colors cursor-pointer"
              title="Yenile"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>

            <button
              type="button"
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 text-xs font-black shadow-md shadow-amber-500/10 hover:shadow-amber-500/20 transition-all cursor-pointer active:scale-95"
            >
              <Plus size={16} />
              Yeni Ürün Ekle
            </button>
          </div>
        </section>

        {/* Product List Table */}
        <section className="bg-white rounded-2xl border border-zinc-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50/80 border-b border-zinc-200/60 text-zinc-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3.5 px-4 w-16 text-center">Görsel</th>
                  <th className="py-3.5 px-4">Ürün Adı & SKU</th>
                  <th className="py-3.5 px-4">Kategori</th>
                  <th className="py-3.5 px-4">Toptan Fiyat</th>
                  <th className="py-3.5 px-4 text-center">Stok</th>
                  <th className="py-3.5 px-4 text-center">Durum</th>
                  <th className="py-3.5 px-4 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-medium">
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-zinc-400">
                      {loading ? "Ürünler yükleniyor..." : "Henüz ürün eklenmemiş veya arama kriterine uygun ürün bulunamadı."}
                    </td>
                  </tr>
                ) : (
                  products.map((p) => (
                    <tr key={p.id} className="hover:bg-zinc-50/60 transition-colors">
                      <td className="py-3 px-4 text-center">
                        <div className="w-12 h-14 rounded-lg bg-zinc-100 border border-zinc-200 overflow-hidden relative mx-auto flex items-center justify-center">
                          {p.cover_image ? (
                            <Image
                              src={p.cover_image}
                              alt={p.title}
                              fill
                              sizes="48px"
                              className="object-cover"
                            />
                          ) : (
                            <Package size={20} className="text-zinc-300" />
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-zinc-900 line-clamp-1">{p.title}</span>
                          <span className="font-mono text-[11px] text-violet-700 font-bold mt-0.5">
                            {p.custom_sku}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-zinc-600">
                        {p.category_title || "-"}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-black text-zinc-900">
                            {p.price.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} {p.currency}
                          </span>
                          {p.packing_ratio && (
                            <span className="text-[10px] text-zinc-400 font-medium">
                              Paket: {p.packing_ratio}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center font-bold text-zinc-800">
                        {p.total_stock} adet
                      </td>

                      <td className="py-3 px-4 text-center">
                        {p.is_active ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                            <CheckCircle2 size={12} />
                            Yayında
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-zinc-200 text-zinc-600 text-[10px] font-bold">
                            <XCircle size={12} />
                            Pasif
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(p)}
                            className="p-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer"
                            title="Düzenle"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDeletingProduct(p);
                              setActiveModal("delete");
                            }}
                            className="p-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
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
      </main>

      {/* CREATE & EDIT PRODUCT MODAL */}
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
          formImages={formImages}
          imageUploadLoading={imageUploadLoading}
          onUploadImageFile={handleUploadImageFile}
          onSetCoverImage={handleSetCoverImage}
          onRemoveImage={handleRemoveImage}
        />
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {activeModal === "delete" && deletingProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-zinc-200 max-w-sm w-full overflow-hidden p-6 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={24} />
            </div>
            <h3 className="text-base font-bold text-zinc-900 mb-1">
              Ürünü Silmek İstediğinize Emin Misiniz?
            </h3>
            <p className="text-xs text-zinc-500 mb-6 leading-relaxed">
              <span className="font-semibold text-zinc-800">{deletingProduct.title}</span> ({deletingProduct.custom_sku}) ürünü ve tüm varyantları sistemden ve vitrinden kalıcı olarak kaldırılacaktır.
            </p>
            <div className="flex gap-2.5 justify-center">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 rounded-xl border border-zinc-200 text-xs text-zinc-600 hover:bg-zinc-50 cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleDeleteProduct}
                disabled={submitting}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
              >
                {submitting ? "Siliniyor..." : "Evet, Ürünü Sil"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
