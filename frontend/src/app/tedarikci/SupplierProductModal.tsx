"use client";

import React from "react";
import Image from "next/image";
import { Plus, Edit3, X, Trash2, UploadCloud } from "lucide-react";
import type {
  CategoryOption,
  AttributeItem,
  VariantFormItem,
  SupplierProfile,
} from "./SupplierDashboardClient";

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
  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-150">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="supp-title" className="text-xs font-bold text-zinc-700">
          Ürün Başlığı / Adı *
        </label>
        <input
          id="supp-title"
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
          <label htmlFor="supp-category" className="text-xs font-bold text-zinc-700">
            Kategori *
          </label>
          <select
            id="supp-category"
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
          <label htmlFor="supp-gender" className="text-xs font-bold text-zinc-700">
            Cinsiyet / Hedef
          </label>
          <select
            id="supp-gender"
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
          <label htmlFor="supp-fabric" className="text-xs font-bold text-zinc-700">
            Kumaş Türü
          </label>
          <select
            id="supp-fabric"
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
          <label htmlFor="supp-color" className="text-xs font-bold text-zinc-700">
            Renk
          </label>
          <select
            id="supp-color"
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
        <label htmlFor="supp-short-desc" className="text-xs font-bold text-zinc-700">
          Kısa Açıklama (Özet)
        </label>
        <input
          id="supp-short-desc"
          type="text"
          value={formShortDesc}
          onChange={(e) => setFormShortDesc(e.target.value)}
          placeholder="Örn: %100 Pamuklu, astarlı, nefes alan kumaş"
          className="w-full px-3.5 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="supp-desc" className="text-xs font-bold text-zinc-700">
          Detaylı Ürün Açıklaması
        </label>
        <textarea
          id="supp-desc"
          value={formDescription}
          onChange={(e) => setFormDescription(e.target.value)}
          rows={3}
          placeholder="Kalıp özellikleri, yıkama talimatı vb."
          className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
        />
      </div>
    </div>
  );
}

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
  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-150">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="supp-price" className="text-xs font-bold text-zinc-700">
            Toptan Satış Fiyatı *
          </label>
          <input
            id="supp-price"
            type="number"
            step="0.01"
            min="0"
            value={formPrice}
            onChange={(e) => setFormPrice(Number.parseFloat(e.target.value) || 0)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="supp-buying-price" className="text-xs font-bold text-zinc-700">
            Toptan Maliyet (Alış Fiyatı)
          </label>
          <input
            id="supp-buying-price"
            type="number"
            step="0.01"
            min="0"
            value={formBuyingPrice}
            onChange={(e) => setFormBuyingPrice(Number.parseFloat(e.target.value) || 0)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="supp-currency" className="text-xs font-bold text-zinc-700">
            Para Birimi
          </label>
          <select
            id="supp-currency"
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
          <label htmlFor="supp-packing-ratio" className="text-xs font-bold text-zinc-700">
            Asorti / Paket Oranı
          </label>
          <input
            id="supp-packing-ratio"
            type="text"
            value={formPackingRatio}
            onChange={(e) => setFormPackingRatio(e.target.value)}
            placeholder="Örn: S-M-L-XL 4'lü paket veya 1xS, 2xM, 2xL"
            className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="supp-moq" className="text-xs font-bold text-zinc-700">
            Minimum Sipariş Adedi (Paket)
          </label>
          <input
            id="supp-moq"
            type="number"
            min="1"
            value={formMoq}
            onChange={(e) => setFormMoq(Number.parseInt(e.target.value, 10) || 1)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          />
        </div>
      </div>

      {/* Active Switch */}
      <div className="flex items-center gap-3 p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 mt-2">
        <input
          id="supp-is-active"
          type="checkbox"
          checked={formIsActive}
          onChange={(e) => setFormIsActive(e.target.checked)}
          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-zinc-300 cursor-pointer"
        />
        <label htmlFor="supp-is-active" className="cursor-pointer select-none">
          <span className="text-xs font-bold text-zinc-800 block">Ürün Vitrinde Satışta ve Aktif</span>
          <span className="text-[11px] text-zinc-400 block">
            İşareti kaldırırsanız ürün vitrinde gizlenir, sadece sizin panelinizde kalır.
          </span>
        </label>
      </div>
    </div>
  );
}

interface SupplierProductVariantsTabProps {
  formVariants: VariantFormItem[];
  onAddVariantRow: () => void;
  onUpdateVariantRow: (index: number, field: keyof VariantFormItem, val: string | number) => void;
  onRemoveVariantRow: (index: number) => void;
}

export function SupplierProductVariantsTab(props: Readonly<SupplierProductVariantsTabProps>) {
  const {
    formVariants,
    onAddVariantRow,
    onUpdateVariantRow,
    onRemoveVariantRow,
  } = props;
  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-150">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold text-zinc-800">Beden & Stok Dağılımı</h4>
          <p className="text-[11px] text-zinc-400">Ürünün mevcut bedenlerini ve stok miktarlarını girin.</p>
        </div>
        <button
          type="button"
          onClick={onAddVariantRow}
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
              <tr key={v.id}>
                <td className="py-2 px-3">
                  <input
                    type="text"
                    value={v.size}
                    onChange={(e) => onUpdateVariantRow(idx, "size", e.target.value)}
                    placeholder="Örn: M, 38, Standart"
                    aria-label={`Beden ${idx + 1}`}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                    required
                  />
                </td>
                <td className="py-2 px-3">
                  <input
                    type="number"
                    min="0"
                    value={v.stock}
                    onChange={(e) =>
                      onUpdateVariantRow(idx, "stock", Number.parseInt(e.target.value, 10) || 0)
                    }
                    aria-label={`Stok ${idx + 1}`}
                    className="w-24 px-2.5 py-1.5 rounded-lg border border-zinc-200 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                    required
                  />
                </td>
                <td className="py-2 px-3">
                  <input
                    type="text"
                    value={v.barcode}
                    onChange={(e) => onUpdateVariantRow(idx, "barcode", e.target.value)}
                    placeholder="8690000000000"
                    aria-label={`Barkod ${idx + 1}`}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </td>
                <td className="py-2 px-3 text-right">
                  <button
                    type="button"
                    onClick={() => onRemoveVariantRow(idx)}
                    className="p-1 rounded-lg text-zinc-400 hover:text-red-600 transition-colors cursor-pointer"
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
    <div className="flex flex-col gap-4 animate-in fade-in duration-150">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h4 className="text-xs font-bold text-zinc-800">Ürün Görselleri</h4>
          <p className="text-[11px] text-zinc-400">İlk fotoğraf otomatik olarak kapak görseli yapılır.</p>
        </div>

        <label
          htmlFor="supp-file-upload"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold shadow-sm cursor-pointer transition-all"
        >
          <UploadCloud size={16} />
          {imageUploadLoading ? "Yükleniyor..." : "Bilgisayardan Fotoğraf Yükle"}
          <input
            id="supp-file-upload"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onUploadImageFile}
            disabled={imageUploadLoading}
            className="hidden"
          />
        </label>
      </div>

      {/* Images Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {formImages.map((imgUrl, idx) => (
          <div
            key={imgUrl}
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
                  onClick={() => onSetCoverImage(idx)}
                  className="px-2 py-1 rounded bg-amber-500 text-zinc-950 text-[10px] font-bold shadow-xs cursor-pointer"
                >
                  Kapak Yap
                </button>
              )}
              <button
                type="button"
                onClick={() => onRemoveImage(idx)}
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
  );
}

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
  // Basic Tab Props
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
  // Pricing Tab Props
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
  // Variants Tab Props
  formVariants: VariantFormItem[];
  onAddVariantRow: () => void;
  onUpdateVariantRow: (index: number, field: keyof VariantFormItem, val: string | number) => void;
  onRemoveVariantRow: (index: number) => void;
  // Images Tab Props
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
    formVariants,
    formImages,
  } = props;

  const handleNextTab = () => {
    if (modalTab === "basic") setModalTab("pricing");
    else if (modalTab === "pricing") setModalTab("variants");
    else if (modalTab === "variants") setModalTab("images");
  };

  return (
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
                Tedarikçi: <span className="font-semibold text-zinc-800">{profile?.brand_name}</span> • Tedarikçi Kodu:{" "}
                <span className="font-mono font-bold text-violet-700">{profile?.alias_code}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
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
        <form onSubmit={onSubmit} className="p-6 overflow-y-auto flex-1 flex flex-col gap-5">
          {formError && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
              {formError}
            </div>
          )}

          {modalTab === "basic" && <SupplierProductBasicTab {...props} />}
          {modalTab === "pricing" && <SupplierProductPricingTab {...props} />}
          {modalTab === "variants" && <SupplierProductVariantsTab {...props} />}
          {modalTab === "images" && <SupplierProductImagesTab {...props} />}

          {/* Modal Footer Buttons */}
          <div className="flex justify-between items-center pt-4 border-t border-zinc-100 mt-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-zinc-200 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 cursor-pointer"
            >
              Vazgeç
            </button>

            <div className="flex items-center gap-2">
              {modalTab !== "images" && (
                <button
                  type="button"
                  onClick={handleNextTab}
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
  );
}
