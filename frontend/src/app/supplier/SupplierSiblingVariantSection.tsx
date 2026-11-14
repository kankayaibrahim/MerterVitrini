"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  Palette,
  Search,
  Link2,
  Unlink,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Package,
  UploadCloud,
  Loader2,
  X,
} from "lucide-react";
import type {
  SupplierProductRow,
  SupplierSiblingItemDTO,
  InlineColorVariantDraft,
} from "@/types/integration";
import {
  performMultiImageUpload,
  filterAcceptedImageFiles,
} from "./SupplierPhotoDropzone";

export interface SupplierAttributeItem {
  id: string;
  name: string;
  code?: string;
}

export function cleanAttributeName(name?: string | null): string {
  if (!name) return "";
  return name.replace(/<[^>]*>?/gm, "").trim();
}

interface SiblingsApiResponse {
  source_product_group_id?: string;
  siblings?: SupplierSiblingItemDTO[];
  error?: string;
}

function SiblingPreviewCard({
  item,
  onUnlink,
  unlinking,
}: Readonly<{
  item: SupplierSiblingItemDTO;
  onUnlink: () => void;
  unlinking: boolean;
}>) {
  return (
    <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-11 h-12 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden relative shrink-0 flex items-center justify-center">
          {item.image_url ? (
            <Image
              src={item.image_url}
              alt={item.title}
              fill
              sizes="44px"
              className="object-cover"
            />
          ) : (
            <Package size={16} className="text-slate-300" />
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-extrabold text-slate-900 truncate max-w-[180px] sm:max-w-[260px]">
              {item.title || "İsimsiz Taslak"}
            </span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${
                item.is_active
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-amber-50 text-amber-800 border-amber-200"
              }`}
            >
              {item.is_active ? "Yayında" : "Taslak"}
            </span>
          </div>

          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className="font-mono text-[10px] font-bold text-slate-500">
              {item.custom_sku}
            </span>
            {item.color && (
              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold">
                {item.color}
              </span>
            )}
            <span className="text-[10px] font-extrabold text-slate-700">
              {item.price > 0
                ? `${item.price.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ${item.currency}`
                : "Taslak Fiyat"}
            </span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onUnlink}
        disabled={unlinking}
        className="h-8 px-2.5 inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50/70 hover:bg-red-100 text-red-700 text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-50 shrink-0"
        title="Bu renk kardeşini gruptan ayır"
      >
        {unlinking ? <Loader2 size={12} className="animate-spin" /> : <Unlink size={12} />}
        <span>Ayır</span>
      </button>
    </div>
  );
}

interface InlineColorVariantRowProps {
  readonly index: number;
  readonly draft: InlineColorVariantDraft;
  readonly colors: readonly SupplierAttributeItem[];
  readonly formTitle: string;
  readonly formPrice: number;
  readonly formCurrency: string;
  readonly uploading: boolean;
  readonly onUpdate: (patch: Partial<InlineColorVariantDraft>) => void;
  readonly onUploadFiles: (files: File[]) => void;
  readonly onRemoveImage: (imgIdx: number) => void;
  readonly onRemoveRow: () => void;
}

function InlineColorVariantRow({
  index,
  draft,
  colors,
  formTitle,
  formPrice,
  formCurrency,
  uploading,
  onUpdate,
  onUploadFiles,
  onRemoveImage,
  onRemoveRow,
}: InlineColorVariantRowProps) {
  const [dragHover, setDragHover] = useState(false);
  const inputId = `inline-color-var-${draft.localId}`;

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragHover(false);
    const files = filterAcceptedImageFiles(e.dataTransfer.files);
    if (files.length > 0 && !uploading) {
      onUploadFiles(files);
    }
  };

  return (
    <div
      onDragOver={(e) => {
        if (Array.from(e.dataTransfer.types).includes("Files")) {
          e.preventDefault();
          setDragHover(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setDragHover(false);
        }
      }}
      onDrop={handleDrop}
      className={`p-3 rounded-xl border transition-all flex flex-col gap-2.5 ${
        dragHover
          ? "bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/25"
          : "bg-white border-slate-200"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-extrabold text-slate-800">
          Ek Renk Varyantı #{index + 1}
        </span>
        <button
          type="button"
          onClick={onRemoveRow}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold text-red-600 hover:bg-red-50 cursor-pointer"
        >
          <Trash2 size={12} />
          <span>Satırı Kaldır</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
        <div className="sm:col-span-4">
          <select
            value={draft.colorId}
            onChange={(e) => onUpdate({ colorId: e.target.value })}
            className="w-full h-9 px-2.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-900"
          >
            <option value="">-- Renk Seçin --</option>
            {colors.map((c) => (
              <option key={c.id} value={c.id}>
                {cleanAttributeName(c.name)}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-5">
          <input
            type="text"
            value={draft.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder={
              formTitle.trim()
                ? `${formTitle.trim()} (opsiyonel)`
                : "Opsiyonel model adı (boşsa ana başlık)"
            }
            className="w-full h-9 px-2.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-900"
          />
        </div>

        <div className="sm:col-span-3">
          <input
            type="number"
            step="0.01"
            min="0"
            value={draft.price || ""}
            onChange={(e) => onUpdate({ price: Number(e.target.value) || 0 })}
            placeholder={
              formPrice > 0 ? `${formPrice} ${formCurrency}` : "Ana fiyat"
            }
            className="w-full h-9 px-2.5 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-900"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label
          htmlFor={inputId}
          className={`h-14 px-3 rounded-lg border-2 border-dashed inline-flex items-center gap-1.5 text-[11px] font-bold transition-colors cursor-pointer ${
            uploading
              ? "border-slate-300 bg-slate-100 text-slate-500 pointer-events-none"
              : "border-slate-300 hover:border-emerald-600 bg-slate-50 hover:bg-emerald-50/40 text-slate-700"
          }`}
        >
          {uploading ? (
            <Loader2 size={14} className="animate-spin text-emerald-600" />
          ) : (
            <UploadCloud size={14} />
          )}
          <span>{uploading ? "Yükleniyor..." : "Renk Fotoğrafı Ekle / Bırak"}</span>
          <input
            id={inputId}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => {
              const files = filterAcceptedImageFiles(e.target.files);
              if (files.length > 0) onUploadFiles(files);
              e.target.value = "";
            }}
            disabled={uploading}
            className="hidden"
          />
        </label>

        {draft.images.map((url, imgIdx) => (
          <div
            key={`${url}-${imgIdx}`}
            className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 group"
          >
            <Image
              src={url}
              alt={`Renk görseli ${imgIdx + 1}`}
              fill
              sizes="56px"
              className="object-cover"
            />
            <button
              type="button"
              onClick={() => onRemoveImage(imgIdx)}
              className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-red-600 text-white flex items-center justify-center opacity-90 hover:opacity-100 cursor-pointer"
              title="Görseli sil"
            >
              <X size={10} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export interface SupplierSiblingVariantSectionProps {
  readonly isCreate: boolean;
  readonly editingProductId: string | null;
  readonly getToken: () => string | null;
  readonly colors: readonly SupplierAttributeItem[];
  readonly formTitle: string;
  readonly formPrice: number;
  readonly formCurrency: string;
  readonly sourceProductGroupId: string;
  readonly supplierSiblings: readonly SupplierSiblingItemDTO[];
  readonly onSiblingsUpdated: (
    groupId: string,
    siblings: SupplierSiblingItemDTO[]
  ) => void;
  readonly linkWithProduct: SupplierSiblingItemDTO | null;
  readonly onChangeLinkWithProduct: (
    target: SupplierSiblingItemDTO | null
  ) => void;
  readonly additionalColorVariants: readonly InlineColorVariantDraft[];
  readonly onChangeAdditionalColorVariants: (
    updater: (prev: InlineColorVariantDraft[]) => InlineColorVariantDraft[]
  ) => void;
}

export function SupplierSiblingVariantSection({
  isCreate,
  editingProductId,
  getToken,
  colors,
  formTitle,
  formPrice,
  formCurrency,
  sourceProductGroupId,
  supplierSiblings,
  onSiblingsUpdated,
  linkWithProduct,
  onChangeLinkWithProduct,
  additionalColorVariants,
  onChangeAdditionalColorVariants,
}: SupplierSiblingVariantSectionProps) {
  const otherSiblings = useMemo(
    () => supplierSiblings.filter((s) => s.id !== editingProductId),
    [supplierSiblings, editingProductId]
  );

  const hasInitialContent =
    otherSiblings.length > 0 ||
    linkWithProduct !== null ||
    additionalColorVariants.length > 0;

  const [manualExpanded, setManualExpanded] = useState<boolean | null>(null);
  const isExpanded = manualExpanded ?? hasInitialContent;

  const [searchTerm, setSearchTerm] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SupplierProductRow[]>([]);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const [uploadingVariantIds, setUploadingVariantIds] = useState<Record<string, boolean>>({});
  const [sectionError, setSectionError] = useState("");

  useEffect(() => {
    const trimmed = searchTerm.trim();
    if (!trimmed) return;

    const token = getToken();
    if (!token) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      setSearching(true);
      const params = new URLSearchParams({
        q: trimmed,
        limit: "8",
      });
      void fetch(`/api/v1/supplier/products?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(async (res) => {
          if (!res.ok) return [] as SupplierProductRow[];
          const data = (await res.json()) as { products?: SupplierProductRow[] };
          return data.products || [];
        })
        .then((list) => {
          if (!cancelled) {
            setSearchResults(list);
          }
        })
        .catch(() => {
          if (!cancelled) setSearchResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [getToken, searchTerm]);

  const excludedIds = useMemo(() => {
    const ids = new Set<string>();
    if (editingProductId) ids.add(editingProductId);
    if (linkWithProduct) ids.add(linkWithProduct.id);
    for (const sib of supplierSiblings) {
      ids.add(sib.id);
    }
    return ids;
  }, [editingProductId, linkWithProduct, supplierSiblings]);

  const visibleSearchResults = useMemo(
    () => searchResults.filter((item) => !excludedIds.has(item.id)),
    [searchResults, excludedIds]
  );

  const handleLinkExisting = async (item: SupplierProductRow) => {
    setSectionError("");
    if (isCreate || !editingProductId) {
      onChangeLinkWithProduct({
        id: item.id,
        title: item.title,
        custom_sku: item.custom_sku,
        slug: "",
        color_id: item.color_id ?? null,
        color: item.color || "",
        image_url: item.cover_image || "",
        price: item.price,
        currency: item.currency,
        is_active: item.is_active,
        source_product_group_id: item.source_product_group_id || "",
      });
      setSearchTerm("");
      setSearchResults([]);
      return;
    }

    const token = getToken();
    if (!token) return;
    setLinkingId(item.id);
    try {
      const res = await fetch(`/api/v1/supplier/products/${editingProductId}/siblings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ target_product_ids: [item.id] }),
      });
      const data = (await res.json().catch(() => ({}))) as SiblingsApiResponse;
      if (!res.ok) {
        setSectionError(data.error || "Renk kardeşi eşleştirilemedi.");
      } else {
        onSiblingsUpdated(
          data.source_product_group_id || sourceProductGroupId,
          data.siblings || []
        );
        setSearchTerm("");
        setSearchResults([]);
      }
    } catch {
      setSectionError("Bağlantı hatası nedeniyle eşleştirme yapılamadı.");
    } finally {
      setLinkingId(null);
    }
  };

  const handleUnlinkSibling = async (targetId: string) => {
    setSectionError("");
    if (isCreate || !editingProductId) {
      onChangeLinkWithProduct(null);
      return;
    }

    const token = getToken();
    if (!token) return;
    setUnlinkingId(targetId);
    try {
      const res = await fetch(
        `/api/v1/supplier/products/${editingProductId}/siblings/${targetId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = (await res.json().catch(() => ({}))) as SiblingsApiResponse;
      if (!res.ok) {
        setSectionError(data.error || "Renk bağlantısı kaldırılamadı.");
      } else {
        onSiblingsUpdated(data.source_product_group_id || "", data.siblings || []);
      }
    } catch {
      setSectionError("Bağlantı hatası nedeniyle ayırma yapılamadı.");
    } finally {
      setUnlinkingId(null);
    }
  };

  const handleAddInlineVariantRow = () => {
    setManualExpanded(true);
    onChangeAdditionalColorVariants((prev) => [
      ...prev,
      {
        localId: `var-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        colorId: "",
        title: "",
        price: 0,
        images: [],
      },
    ]);
  };

  const handleUploadVariantImages = (localId: string, files: File[]) => {
    setSectionError("");
    void performMultiImageUpload(
      files,
      getToken(),
      (loading) =>
        setUploadingVariantIds((prev) => ({
          ...prev,
          [localId]: loading,
        })),
      (urls) => {
        onChangeAdditionalColorVariants((prev) =>
          prev.map((row) =>
            row.localId === localId
              ? { ...row, images: [...row.images, ...urls] }
              : row
          )
        );
      },
      (errMsg) => setSectionError(errMsg)
    );
  };

  const linkedCount = isCreate
    ? linkWithProduct
      ? 1
      : 0
    : otherSiblings.length;

  return (
    <section className="rounded-xl bg-white border border-slate-200/90 overflow-hidden">
      <button
        type="button"
        onClick={() => setManualExpanded(!isExpanded)}
        className="w-full px-4 py-3 bg-slate-50/80 hover:bg-slate-100/80 flex items-center justify-between gap-2 text-left transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Palette size={15} className="text-slate-800" />
          <span className="text-xs font-extrabold text-slate-900">
            🎨 Renk / Varyant Eşleştir &amp; Çoklu Renk
          </span>
          {linkedCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
              {linkedCount} Bağlı Renk
            </span>
          )}
          {isCreate && additionalColorVariants.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-slate-900 text-white text-[10px] font-bold">
              +{additionalColorVariants.length} Ek Renk
            </span>
          )}
        </div>

        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 shrink-0">
          <span>{isExpanded ? "Gizle" : "Aç"}</span>
          {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </span>
      </button>

      {isExpanded && (
        <div className="p-4 border-t border-slate-200 flex flex-col gap-3.5 bg-slate-50/40">
          {sectionError && (
            <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs font-bold text-red-700">
              {sectionError}
            </div>
          )}

          {/* Linked Siblings / Selected Link Preview */}
          {isCreate ? (
            linkWithProduct && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold text-slate-600">
                  Eşleştirilecek Mevcut Model:
                </span>
                <SiblingPreviewCard
                  item={linkWithProduct}
                  unlinking={false}
                  onUnlink={() => void handleUnlinkSibling(linkWithProduct.id)}
                />
              </div>
            )
          ) : (
            otherSiblings.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-slate-600">
                    Aynı Model Grubundaki Renk Kardeşleri ({otherSiblings.length})
                  </span>
                  {sourceProductGroupId && (
                    <span className="text-[10px] font-mono text-slate-400">
                      Grup: {sourceProductGroupId}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {otherSiblings.map((sib) => (
                    <SiblingPreviewCard
                      key={sib.id}
                      item={sib}
                      unlinking={unlinkingId === sib.id}
                      onUnlink={() => void handleUnlinkSibling(sib.id)}
                    />
                  ))}
                </div>
              </div>
            )
          )}

          {/* Search input to link existing product */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="supp-sibling-search"
              className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5"
            >
              <Link2 size={13} />
              <span>Mevcut Ürünle Renk Kardeşi Yap</span>
            </label>

            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                id="supp-sibling-search"
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  const next = e.target.value;
                  setSearchTerm(next);
                  if (!next.trim()) {
                    setSearchResults([]);
                    setSearching(false);
                  }
                }}
                placeholder="Model adı veya SKU yazarak mevcut başka bir rengi eşleştir..."
                className="w-full h-9 pl-8 pr-8 rounded-lg bg-white border border-slate-300 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-900"
              />
              {searching && (
                <Loader2
                  size={14}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin"
                />
              )}
            </div>

            {searchTerm.trim().length > 0 && !searching && (
              <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 max-h-60 overflow-y-auto shadow-xs">
                {visibleSearchResults.length === 0 ? (
                  <div className="px-3 py-4 text-center text-[11px] text-slate-400">
                    Eşleştirilebilecek başka ürün bulunamadı.
                  </div>
                ) : (
                  visibleSearchResults.map((item) => (
                    <div
                      key={item.id}
                      className="px-3 py-2 flex items-center justify-between gap-2.5 hover:bg-slate-50"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-10 rounded-md bg-slate-100 border border-slate-200 overflow-hidden relative shrink-0 flex items-center justify-center">
                          {item.cover_image ? (
                            <Image
                              src={item.cover_image}
                              alt={item.title}
                              fill
                              sizes="36px"
                              className="object-cover"
                            />
                          ) : (
                            <Package size={14} className="text-slate-300" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate">
                            {item.title || "İsimsiz Taslak"}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 flex-wrap">
                            <span className="font-mono font-semibold">{item.custom_sku}</span>
                            {item.color && (
                              <span className="px-1.5 py-0.2 rounded bg-slate-100 border border-slate-200 text-slate-700 font-semibold">
                                {item.color}
                              </span>
                            )}
                            <span>
                              {item.price > 0
                                ? `${item.price.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ${item.currency}`
                                : "Taslak"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleLinkExisting(item)}
                        disabled={linkingId === item.id}
                        className="h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50 shrink-0"
                      >
                        {linkingId === item.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Link2 size={12} />
                        )}
                        <span>Eşleştir</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Inline multi-color creation (Create mode only) */}
          {isCreate && (
            <div className="pt-2 border-t border-slate-200/80 flex flex-col gap-2.5">
              {additionalColorVariants.map((draft, idx) => (
                <InlineColorVariantRow
                  key={draft.localId}
                  index={idx}
                  draft={draft}
                  colors={colors}
                  formTitle={formTitle}
                  formPrice={formPrice}
                  formCurrency={formCurrency}
                  uploading={Boolean(uploadingVariantIds[draft.localId])}
                  onUpdate={(patch) =>
                    onChangeAdditionalColorVariants((prev) =>
                      prev.map((row) =>
                        row.localId === draft.localId ? { ...row, ...patch } : row
                      )
                    )
                  }
                  onUploadFiles={(files) =>
                    handleUploadVariantImages(draft.localId, files)
                  }
                  onRemoveImage={(imgIdx) =>
                    onChangeAdditionalColorVariants((prev) =>
                      prev.map((row) =>
                        row.localId === draft.localId
                          ? {
                              ...row,
                              images: row.images.filter((_, i) => i !== imgIdx),
                            }
                          : row
                      )
                    )
                  }
                  onRemoveRow={() =>
                    onChangeAdditionalColorVariants((prev) =>
                      prev.filter((row) => row.localId !== draft.localId)
                    )
                  }
                />
              ))}

              <button
                type="button"
                onClick={handleAddInlineVariantRow}
                className="self-start h-9 px-3.5 rounded-lg border border-dashed border-slate-400 hover:border-slate-900 bg-white hover:bg-slate-50 text-slate-800 text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Plus size={14} />
                <span>+ Aynı Anda Başka Renk Varyantı Ekle</span>
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
