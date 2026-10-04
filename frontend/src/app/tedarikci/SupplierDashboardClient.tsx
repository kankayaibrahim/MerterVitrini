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
  Tag, 
  UploadCloud, 
  X
} from "lucide-react";
import { SupplierProductRow } from "@/types/integration";

interface CategoryOption {
  id: string;
  title: string;
  slug: string;
  node_path: string;
}

interface AttributeItem {
  id: string;
  name: string;
  code?: string;
}

interface VariantFormItem {
  size: string;
  stock: number;
  barcode: string;
}

interface SupplierProfile {
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
    { size: "S", stock: 10, barcode: "" },
    { size: "M", stock: 15, barcode: "" },
    { size: "L", stock: 15, barcode: "" },
    { size: "XL", stock: 10, barcode: "" },
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
    setFormVariants((prev) => [...prev, { size: "", stock: 10, barcode: "" }]);
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
      { size: "S", stock: 10, barcode: "" },
      { size: "M", stock: 15, barcode: "" },
      { size: "L", stock: 15, barcode: "" },
      { size: "XL", stock: 10, barcode: "" },
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
            data.variants.map((v: { variant_size?: string; size?: string; stock?: number; barcode?: string }) => ({
              size: v.variant_size || v.size || "STD",
              stock: v.stock || 0,
              barcode: v.barcode || "",
            }))
          );
        } else {
          setFormVariants([{ size: "STANDART", stock: prod.total_stock, barcode: "" }]);
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-zinc-200 max-w-3xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col my-8 max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 font-bold">
                  {activeModal === "create" ? <Plus size={18} /> : <Edit3 size={18} />}
                </div>
                <div>
                  <h3 className="font-bold text-zinc-900 text-sm">
                    {activeModal === "create" ? "Yeni Ürün Ekle ve Vitrinde Yayınla" : "Ürünü Düzenle"}
                  </h3>
                  <p className="text-[11px] text-zinc-500">
                    Tedarikçi: <span className="font-semibold text-zinc-800">{profile?.brand_name}</span> • Maske Kodu: <span className="font-mono font-bold text-violet-700">{profile?.alias_code}</span>
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setActiveModal(null)} 
                className="text-zinc-400 hover:text-zinc-600 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Tab Buttons */}
            <div className="flex border-b border-zinc-200 px-6 gap-6 bg-white">
              <button
                type="button"
                onClick={() => setModalTab("basic")}
                className={`py-3 text-xs font-bold transition-all relative cursor-pointer ${
                  modalTab === "basic"
                    ? "text-amber-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-amber-600"
                    : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                1. Temel Bilgiler
              </button>
              <button
                type="button"
                onClick={() => setModalTab("pricing")}
                className={`py-3 text-xs font-bold transition-all relative cursor-pointer ${
                  modalTab === "pricing"
                    ? "text-amber-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-amber-600"
                    : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                2. Fiyat & Toptan Şartlar
              </button>
              <button
                type="button"
                onClick={() => setModalTab("variants")}
                className={`py-3 text-xs font-bold transition-all relative cursor-pointer ${
                  modalTab === "variants"
                    ? "text-amber-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-amber-600"
                    : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                3. Beden & Stok Varyantları ({formVariants.length})
              </button>
              <button
                type="button"
                onClick={() => setModalTab("images")}
                className={`py-3 text-xs font-bold transition-all relative cursor-pointer ${
                  modalTab === "images"
                    ? "text-amber-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-amber-600"
                    : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                4. Fotoğraflar ({formImages.length})
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSubmitProduct} className="p-6 overflow-y-auto flex-1 flex flex-col gap-5">
              {formError && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                  {formError}
                </div>
              )}

              {/* TAB 1: BASIC */}
              {modalTab === "basic" && (
                <div className="flex flex-col gap-4 animate-in fade-in duration-150">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-zinc-700">Ürün Başlığı / Adı *</label>
                    <input
                      type="text"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="Örn: Balon Kol Kuşaklı Keten Elbise"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-zinc-700">Kategori *</label>
                      <select
                        value={formCategoryId}
                        onChange={(e) => setFormCategoryId(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                        required
                      >
                        <option value="">Kategori Seçin</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-zinc-700">Cinsiyet / Hedef</label>
                      <select
                        value={formGender}
                        onChange={(e) => setFormGender(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                      >
                        <option value="Kadın">Kadın</option>
                        <option value="Erkek">Erkek</option>
                        <option value="Unisex">Unisex</option>
                        <option value="Çocuk">Çocuk</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-zinc-700">Kumaş Türü</label>
                      <select
                        value={formFabricId}
                        onChange={(e) => setFormFabricId(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                      >
                        <option value="">Seçilmedi</option>
                        {fabrics.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-zinc-700">Renk</label>
                      <select
                        value={formColorId}
                        onChange={(e) => setFormColorId(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                      >
                        <option value="">Seçilmedi</option>
                        {colors.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-zinc-700">Kısa Açıklama (Özet)</label>
                    <input
                      type="text"
                      value={formShortDesc}
                      onChange={(e) => setFormShortDesc(e.target.value)}
                      placeholder="Örn: %100 Pamuklu, astarlı, nefes alan kumaş"
                      className="w-full px-3.5 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-zinc-700">Detaylı Ürün Açıklaması</label>
                    <textarea
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      rows={3}
                      placeholder="Kalıp özellikleri, yıkama talimatı vb."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: PRICING */}
              {modalTab === "pricing" && (
                <div className="flex flex-col gap-4 animate-in fade-in duration-150">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-zinc-700">Toptan Satış Fiyatı *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formPrice}
                        onChange={(e) => setFormPrice(parseFloat(e.target.value) || 0)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                        required
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-zinc-700">Toptan Maliyet (Alış Fiyatı)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formBuyingPrice}
                        onChange={(e) => setFormBuyingPrice(parseFloat(e.target.value) || 0)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-zinc-700">Para Birimi</label>
                      <select
                        value={formCurrency}
                        onChange={(e) => setFormCurrency(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold text-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                      >
                        <option value="TRY">TRY (₺ Türk Lirası)</option>
                        <option value="USD">USD ($ Amerikan Doları)</option>
                        <option value="EUR">EUR (€ Euro)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-zinc-700">Asorti / Paket Oranı</label>
                      <input
                        type="text"
                        value={formPackingRatio}
                        onChange={(e) => setFormPackingRatio(e.target.value)}
                        placeholder="Örn: S-M-L-XL 4'lü paket veya 1xS, 2xM, 2xL"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-zinc-700">Minimum Sipariş Adedi (Paket)</label>
                      <input
                        type="number"
                        min="1"
                        value={formMoq}
                        onChange={(e) => setFormMoq(parseInt(e.target.value, 10) || 1)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                      />
                    </div>
                  </div>

                  {/* Active Switch */}
                  <label className="flex items-center gap-3 p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 cursor-pointer mt-2">
                    <input
                      type="checkbox"
                      checked={formIsActive}
                      onChange={(e) => setFormIsActive(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-zinc-300"
                    />
                    <div>
                      <span className="text-xs font-bold text-zinc-800 block">Ürün Vitrinde Satışta ve Aktif</span>
                      <span className="text-[11px] text-zinc-400 block">İşareti kaldırırsanız ürün vitrinde gizlenir, sadece sizin panelinizde kalır.</span>
                    </div>
                  </label>
                </div>
              )}

              {/* TAB 3: VARIANTS */}
              {modalTab === "variants" && (
                <div className="flex flex-col gap-4 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-zinc-800">Beden & Stok Dağılımı</h4>
                      <p className="text-[11px] text-zinc-400">Ürünün mevcut bedenlerini ve stok miktarlarını girin.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddVariantRow}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold cursor-pointer"
                    >
                      <Plus size={14} />
                      Beden Ekle
                    </button>
                  </div>

                  <div className="border border-zinc-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 uppercase font-semibold">
                        <tr>
                          <th className="py-2.5 px-3">Beden / Boyut</th>
                          <th className="py-2.5 px-3">Mevcut Stok</th>
                          <th className="py-2.5 px-3">Barkod (İsteğe Bağlı)</th>
                          <th className="py-2.5 px-3 text-right">İşlem</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 font-medium">
                        {formVariants.map((v, idx) => (
                          <tr key={idx}>
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={v.size}
                                onChange={(e) => handleUpdateVariantRow(idx, "size", e.target.value)}
                                placeholder="Örn: M, 38, Standart"
                                className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                                required
                              />
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                min="0"
                                value={v.stock}
                                onChange={(e) => handleUpdateVariantRow(idx, "stock", parseInt(e.target.value, 10) || 0)}
                                className="w-24 px-2.5 py-1.5 rounded-lg border border-zinc-200 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                                required
                              />
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={v.barcode}
                                onChange={(e) => handleUpdateVariantRow(idx, "barcode", e.target.value)}
                                placeholder="8690000000000"
                                className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                              />
                            </td>
                            <td className="py-2 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveVariantRow(idx)}
                                className="p-1 rounded-lg text-zinc-400 hover:text-red-600 transition-colors cursor-pointer"
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
              )}

              {/* TAB 4: IMAGES */}
              {modalTab === "images" && (
                <div className="flex flex-col gap-4 animate-in fade-in duration-150">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-bold text-zinc-800">Ürün Görselleri</h4>
                      <p className="text-[11px] text-zinc-400">İlk fotoğraf otomatik olarak kapak görseli yapılır.</p>
                    </div>

                    <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold shadow-sm cursor-pointer transition-all">
                      <UploadCloud size={16} />
                      {imageUploadLoading ? "Yükleniyor..." : "Bilgisayardan Fotoğraf Yükle"}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleUploadImageFile}
                        disabled={imageUploadLoading}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* Images Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {formImages.map((imgUrl, idx) => (
                      <div
                        key={idx}
                        className={`relative rounded-xl border overflow-hidden group aspect-[3/4] bg-zinc-100 flex items-center justify-center ${
                          idx === 0 ? "border-amber-500 ring-2 ring-amber-500/20" : "border-zinc-200"
                        }`}
                      >
                        <Image
                          src={imgUrl}
                          alt={`Ürün Görseli ${idx + 1}`}
                          fill
                          sizes="(max-width: 640px) 50vw, 25vw"
                          className="object-cover"
                        />

                        {idx === 0 && (
                          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-amber-500 text-zinc-950 text-[9px] font-black uppercase shadow-xs">
                            Kapak
                          </span>
                        )}

                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          {idx !== 0 && (
                            <button
                              type="button"
                              onClick={() => handleSetCoverImage(idx)}
                              className="px-2 py-1 rounded bg-amber-500 text-zinc-950 text-[10px] font-bold shadow-xs cursor-pointer"
                            >
                              Kapak Yap
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(idx)}
                            className="p-1.5 rounded bg-red-600 text-white shadow-xs cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}

                    {formImages.length === 0 && (
                      <div className="col-span-full py-12 text-center text-zinc-400 border border-dashed border-zinc-200 rounded-2xl">
                        Henüz ürün görseli yüklenmedi. Yukarıdaki butona tıklayarak fotoğraf ekleyin.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Modal Footer Buttons */}
              <div className="flex justify-between items-center pt-4 border-t border-zinc-100 mt-auto">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2.5 rounded-xl border border-zinc-200 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 cursor-pointer"
                >
                  Vazgeç
                </button>

                <div className="flex items-center gap-2">
                  {modalTab !== "images" && (
                    <button
                      type="button"
                      onClick={() => {
                        if (modalTab === "basic") setModalTab("pricing");
                        else if (modalTab === "pricing") setModalTab("variants");
                        else if (modalTab === "variants") setModalTab("images");
                      }}
                      className="px-4 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold cursor-pointer"
                    >
                      İlerle →
                    </button>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 text-xs font-black shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? "Kaydediliyor..." : "Kaydet ve Vitrinde Yayınla"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
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
