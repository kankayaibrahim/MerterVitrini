"use client";

import React, { useCallback, useState } from "react";
import {
  Camera,
  Layers,
  Palette,
  Package,
  X,
  AlertCircle,
  Loader2,
  Sparkles,
} from "lucide-react";
import type { CategoryOption } from "./SupplierDashboardClient";
import { buildHierarchicalCategoryOptions } from "./SupplierProductModal";
import {
  SupplierPhotoDropzone,
  performMultiImageUpload,
  reorderImageList,
} from "./SupplierPhotoDropzone";

export type BatchDraftMode = "per_photo" | "color_siblings" | "single_product";

interface BatchDraftModeOption {
  value: BatchDraftMode;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const BATCH_DRAFT_MODES: readonly BatchDraftModeOption[] = [
  {
    value: "per_photo",
    title: "Her Fotoğraftan Ayrı Taslak Aç",
    description:
      "10–30 farklı model fotoğrafını tek seferde ayrı taslak ürünlere dönüştürür.",
    icon: <Camera size={16} />,
  },
  {
    value: "color_siblings",
    title: "Hepsini Tek Modelin Renkleri Yap",
    description:
      "Tüm fotoğrafları otomatik aynı model grubu (renk kardeşi) altında toplar.",
    icon: <Palette size={16} />,
  },
  {
    value: "single_product",
    title: "Tüm Fotoğrafları Tek Üründe Topla",
    description:
      "Yüklenen fotoğrafların tamamını tek bir taslak ürünün galerisine ekler.",
    icon: <Package size={16} />,
  },
];

export interface SupplierQuickDraftModalProps {
  readonly isOpen: boolean;
  readonly getToken: () => string | null;
  readonly categories: readonly CategoryOption[];
  readonly defaultCategoryId: string;
  readonly defaultCurrency: string;
  readonly defaultSizes: readonly string[];
  readonly defaultSeriesRatio: string;
  readonly defaultSeriesStock: number;
  readonly onClose: () => void;
  readonly onCreated: (createdCount: number) => void;
}

export function SupplierQuickDraftModal({
  isOpen,
  getToken,
  categories,
  defaultCategoryId,
  defaultCurrency,
  defaultSizes,
  defaultSeriesRatio,
  defaultSeriesStock,
  onClose,
  onCreated,
}: SupplierQuickDraftModalProps) {
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [mode, setMode] = useState<BatchDraftMode>("per_photo");
  const [titlePrefix, setTitlePrefix] = useState("");
  const [categoryId, setCategoryId] = useState(defaultCategoryId);
  const [price, setPrice] = useState<number>(0);
  const [currency, setCurrency] = useState(defaultCurrency || "TRY");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const hierarchicalCategories = React.useMemo(
    () => buildHierarchicalCategoryOptions(categories),
    [categories]
  );

  const handleUploadFiles = useCallback(
    async (files: File[]) => {
      setErrorMsg("");
      await performMultiImageUpload(
        files,
        getToken(),
        setUploading,
        (urls) => {
          setImages((prev) => [...prev, ...urls].slice(0, 30));
        },
        (msg) => setErrorMsg(msg)
      );
    },
    [getToken]
  );

  const handleReorderImages = useCallback((fromIdx: number, toIdx: number) => {
    setImages((prev) => reorderImageList(prev, fromIdx, toIdx));
  }, []);

  const handleSetCoverImage = useCallback((idx: number) => {
    setImages((prev) => reorderImageList(prev, idx, 0));
  }, []);

  const handleRemoveImage = useCallback((idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (images.length === 0) {
      setErrorMsg("Lütfen en az 1 ürün fotoğrafı yükleyin.");
      return;
    }
    const token = getToken();
    if (!token) {
      setErrorMsg("Oturum süreniz dolmuş olabilir. Lütfen tekrar giriş yapın.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/v1/supplier/products/batch-drafts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          mode,
          image_urls: images,
          title_prefix: titlePrefix.trim() || undefined,
          category_id: categoryId || undefined,
          price: Number(price) || 0,
          currency,
          selected_sizes: [...defaultSizes],
          series_ratio: defaultSeriesRatio,
          series_stock: defaultSeriesStock,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        created_count?: number;
      };
      if (!res.ok) {
        setErrorMsg(data.error || "Toplu taslak oluşturulamadı.");
        return;
      }
      const createdCount = data.created_count ?? (mode === "single_product" ? 1 : images.length);
      onCreated(createdCount);
    } catch {
      setErrorMsg("Sunucu bağlantısı sırasında bir hata oluştu.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <Camera size={18} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                📸 Fotoğrafları At → Hızlı Taslak
              </h2>
              <p className="text-[11px] text-slate-500">
                Fotoğrafları toplu sürükleyin veya Ctrl+V ile yapıştırın; fiyat ve detayları daha sonra Taslaklar sekmesinden tamamlayın.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-4 sm:p-5 overflow-y-auto flex-1 flex flex-col gap-4 bg-[#f8fafc]">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2 text-xs font-bold text-red-700">
                <AlertCircle size={15} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <SupplierPhotoDropzone
              images={images}
              uploading={uploading}
              onUploadFiles={handleUploadFiles}
              onReorderImages={handleReorderImages}
              onSetCoverImage={handleSetCoverImage}
              onRemoveImage={handleRemoveImage}
              enablePaste={isOpen}
              maxImages={30}
              inputId="supp-quick-draft-photos"
              largeDropzone
              showCoverBadge={mode !== "per_photo"}
              title="1. Adım: Ürün Fotoğraflarını Bırakın (1–30 Fotoğraf)"
              subtitle="Görseller otomatik WebP formatına optimize edilir • İsterseniz sırayı sürükleyerek düzenleyin"
            />

            {/* 3-Mode Selector */}
            <section className="p-4 rounded-xl bg-white border border-slate-200/90 flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                  <Layers size={14} className="text-slate-700" />
                  <span>2. Adım: Fotoğraflar Nasıl Taslağa Dönüştürülsün?</span>
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                {BATCH_DRAFT_MODES.map((opt) => {
                  const selected = mode === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setMode(opt.value)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
                        selected
                          ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                          : "bg-slate-50/60 text-slate-800 border-slate-200 hover:border-slate-400 hover:bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={selected ? "text-emerald-400" : "text-slate-700"}>
                          {opt.icon}
                        </span>
                        <span
                          className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            selected ? "border-emerald-400 bg-emerald-500" : "border-slate-300 bg-white"
                          }`}
                        >
                          {selected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </span>
                      </div>
                      <span className="text-xs font-extrabold leading-snug">{opt.title}</span>
                      <span
                        className={`text-[11px] leading-relaxed ${
                          selected ? "text-slate-300" : "text-slate-500"
                        }`}
                      >
                        {opt.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Optional Quick Defaults */}
            <section className="p-4 rounded-xl bg-white border border-slate-200/90 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-extrabold text-slate-900">
                  3. Adım: Hızlı Varsayılanlar (Opsiyonel)
                </span>
                <span className="text-[11px] text-slate-500">
                  Varsayılan Seri: <strong className="text-slate-800">{defaultSizes.join("-")}</strong> ({defaultSeriesStock} Seri)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-4 flex flex-col gap-1">
                  <label htmlFor="qd-title-prefix" className="text-[11px] font-bold text-slate-700">
                    Model Adı Ön Eki
                  </label>
                  <input
                    id="qd-title-prefix"
                    type="text"
                    value={titlePrefix}
                    onChange={(e) => setTitlePrefix(e.target.value)}
                    placeholder="Örn: 2026 Yaz Keten Elbise"
                    className="h-9 px-3 rounded-lg border border-slate-300 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900"
                  />
                </div>

                <div className="sm:col-span-4 flex flex-col gap-1">
                  <label htmlFor="qd-category" className="text-[11px] font-bold text-slate-700">
                    Kategori
                  </label>
                  <select
                    id="qd-category"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="h-9 px-2.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-900"
                  >
                    <option value="">-- Kategori Seçilmedi --</option>
                    {hierarchicalCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullLabel}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-4 flex flex-col gap-1">
                  <label htmlFor="qd-price" className="text-[11px] font-bold text-slate-700">
                    Hazır Toptan Fiyat (0 = Taslak)
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      id="qd-price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={price || ""}
                      onChange={(e) => setPrice(Number(e.target.value) || 0)}
                      placeholder="0.00"
                      className="h-9 flex-1 min-w-0 px-3 rounded-lg border border-slate-300 text-xs font-extrabold text-slate-900 focus:outline-none focus:border-slate-900"
                    />
                    <select
                      aria-label="Para Birimi"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="h-9 px-2 rounded-lg border border-slate-300 bg-white text-xs font-extrabold text-slate-800 focus:outline-none focus:border-slate-900"
                    >
                      <option value="TRY">TRY (₺)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                    </select>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Sticky Footer */}
          <div className="px-5 py-3.5 border-t border-slate-200 bg-white flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 inline-flex items-center justify-center rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              İptal
            </button>

            <button
              type="submit"
              disabled={submitting || uploading || images.length === 0}
              className="h-10 px-6 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Sparkles size={15} />
              )}
              <span>
                {submitting
                  ? "Taslaklar Oluşturuluyor..."
                  : `Taslakları Oluştur (${images.length} Fotoğraf)`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
