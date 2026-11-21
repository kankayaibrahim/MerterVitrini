"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import CatalogFilters from "@/components/admin/catalog/CatalogFilters";
import SupplierBulkActionsBar from "@/components/admin/catalog/SupplierBulkActionsBar";
import BulkActionConfirmModal, {
  ConfirmTone,
} from "@/components/admin/catalog/BulkActionConfirmModal";
import ProductGrid from "@/components/admin/catalog/ProductGrid";
import ProductDetailModal from "@/components/admin/catalog/ProductDetailModal";
import { useAdmin } from "@/context/AdminContext";
import { Brand, Product } from "@/types/integration";
import {
  BulkProductActionResult,
  BulkProductActionType,
  ProductStatusFilter,
} from "@/services/admin-api.service";

type ConfirmModalState =
  | { scope: "supplier"; supplier: Brand; action: BulkProductActionType }
  | { scope: "selection"; productIds: string[]; action: BulkProductActionType }
  | { scope: "single"; product: Product; action: BulkProductActionType };

interface DialogContent {
  title: string;
  description: string;
  confirmLabel: string;
  tone: ConfirmTone;
  showDeleteImagesOption: boolean;
}

const ACTION_TONE: Record<BulkProductActionType, ConfirmTone> = {
  activate: "emerald",
  deactivate: "amber",
  delete: "rose",
};

function buildDialogContent(modal: ConfirmModalState): DialogContent {
  const tone = ACTION_TONE[modal.action];

  if (modal.scope === "supplier") {
    const labelMap: Record<BulkProductActionType, DialogContent> = {
      activate: {
        title: `${modal.supplier.name} — Tüm Ürünleri Aktife Al`,
        description: `${modal.supplier.name} tedarikçisine ait silinmemiş tüm pasif ürünler satışa açılacaktır.`,
        confirmLabel: "Tümünü Aktife Al",
        tone,
        showDeleteImagesOption: false,
      },
      deactivate: {
        title: `${modal.supplier.name} — Tüm Ürünleri Pasife Al`,
        description: `${modal.supplier.name} tedarikçisine ait tüm aktif ürünler ve varyasyonlar vitrinde pasif duruma getirilecektir.`,
        confirmLabel: "Tümünü Pasife Al",
        tone,
        showDeleteImagesOption: false,
      },
      delete: {
        title: `${modal.supplier.name} — Tüm Ürünleri Sil`,
        description: `${modal.supplier.name} tedarikçisine ait tüm ürünler katalogdan kaldırılacaktır. İsterseniz yerel görselleri de diskten temizleyebilirsiniz.`,
        confirmLabel: "Tüm Ürünleri Sil",
        tone,
        showDeleteImagesOption: true,
      },
    };
    return labelMap[modal.action];
  }

  if (modal.scope === "single") {
    const labelMap: Record<BulkProductActionType, DialogContent> = {
      activate: {
        title: "Ürünü Aktife Al",
        description: `"${modal.product.title}" (${modal.product.custom_sku}) tekrar satışta olarak işaretlenecektir.`,
        confirmLabel: "Aktife Al",
        tone,
        showDeleteImagesOption: false,
      },
      deactivate: {
        title: "Ürünü Pasife Al",
        description: `"${modal.product.title}" (${modal.product.custom_sku}) vitrinden gizlenip pasif duruma alınacaktır.`,
        confirmLabel: "Pasife Al",
        tone,
        showDeleteImagesOption: false,
      },
      delete: {
        title: "Ürünü Sil",
        description: `"${modal.product.title}" (${modal.product.custom_sku}) katalogdan silinecektir.`,
        confirmLabel: "Ürünü Sil",
        tone,
        showDeleteImagesOption: true,
      },
    };
    return labelMap[modal.action];
  }

  const countText = modal.productIds.length.toLocaleString("tr-TR");
  const labelMap: Record<BulkProductActionType, DialogContent> = {
    activate: {
      title: `${countText} Seçili Ürünü Aktife Al`,
      description: `Seçtiğiniz ${countText} ürün satışa açılacaktır.`,
      confirmLabel: "Seçilenleri Aktife Al",
      tone,
      showDeleteImagesOption: false,
    },
    deactivate: {
      title: `${countText} Seçili Ürünü Pasife Al`,
      description: `Seçtiğiniz ${countText} ürün vitrinde pasif duruma geçirilecektir.`,
      confirmLabel: "Seçilenleri Pasife Al",
      tone,
      showDeleteImagesOption: false,
    },
    delete: {
      title: `${countText} Seçili Ürünü Sil`,
      description: `Seçtiğiniz ${countText} ürün katalogdan silinecektir.`,
      confirmLabel: "Seçilenleri Sil",
      tone,
      showDeleteImagesOption: true,
    },
  };
  return labelMap[modal.action];
}

function formatActionFeedbackMessage(res: BulkProductActionResult): string {
  const base = res.message?.trim() || `${res.affected_count} ürün güncellendi.`;
  const imageNote =
    typeof res.images_removed === "number" && res.images_removed > 0
      ? ` ${res.images_removed} görsel dosyası diskten temizlendi.`
      : "";
  return `${base}${imageNote} Vitrin önbelleği arka planda güncelleniyor.`;
}

export default function AdminCatalogProductsPage() {
  const {
    products,
    totalProductsCount,
    suppliers,
    feeds,
    flatCategories,
    loadingProducts,
    loadProducts,
    activateSupplierProducts,
    deactivateSupplierProducts,
    deleteSupplierProducts,
    bulkProductAction,
    fetchWithConfig,
  } = useAdmin();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBrandId, setSelectedBrandId] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<ProductStatusFilter>("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 24;

  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState | null>(null);
  const [deleteImages, setDeleteImages] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s.id === selectedBrandId) ?? null,
    [suppliers, selectedBrandId]
  );

  // Load products whenever filters or pagination change
  useEffect(() => {
    void loadProducts(
      limit,
      offset,
      selectedCategory,
      searchQuery,
      selectedBrandId,
      selectedStatus
    );
  }, [
    loadProducts,
    limit,
    offset,
    selectedCategory,
    searchQuery,
    selectedBrandId,
    selectedStatus,
  ]);

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedBrandId("");
    setSelectedStatus("");
    setSelectedCategory("");
    setOffset(0);
    setSelectedProductIds([]);
  };

  const handleViewProductById = useCallback(
    async (productId: string) => {
      try {
        const res = await fetchWithConfig(`/api/v1/products/${productId}`);
        if (res.ok) {
          const prod = (await res.json()) as Product;
          setSelectedProduct(prod);
        }
      } catch (err) {
        console.error("Failed to load product detail:", err);
      }
    },
    [fetchWithConfig]
  );

  const handleToggleSelectProduct = (productId: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  const handleToggleSelectAllPage = () => {
    const pageIds = products.map((p) => p.id);
    if (pageIds.length === 0) return;

    setSelectedProductIds((prev) => {
      const prevSet = new Set(prev);
      const allSelected = pageIds.every((id) => prevSet.has(id));
      if (allSelected) {
        const pageSet = new Set(pageIds);
        return prev.filter((id) => !pageSet.has(id));
      }
      return Array.from(new Set([...prev, ...pageIds]));
    });
  };

  const openSupplierModal = (action: BulkProductActionType) => {
    if (!selectedSupplier) return;
    setDeleteImages(false);
    setConfirmModal({ scope: "supplier", supplier: selectedSupplier, action });
  };

  const openSelectionModal = (action: BulkProductActionType) => {
    if (selectedProductIds.length === 0) return;
    setDeleteImages(false);
    setConfirmModal({ scope: "selection", productIds: selectedProductIds, action });
  };

  const openSingleProductModal = (product: Product, action: BulkProductActionType) => {
    setDeleteImages(false);
    setConfirmModal({ scope: "single", product, action });
  };

  const runConfirmedAction = async (
    modal: ConfirmModalState
  ): Promise<BulkProductActionResult> => {
    if (modal.scope === "supplier") {
      if (modal.action === "activate") {
        return activateSupplierProducts(modal.supplier.id);
      }
      if (modal.action === "deactivate") {
        return deactivateSupplierProducts(modal.supplier.id);
      }
      return deleteSupplierProducts(modal.supplier.id, deleteImages);
    }
    const targetIds =
      modal.scope === "single" ? [modal.product.id] : modal.productIds;
    return bulkProductAction(modal.action, targetIds, deleteImages);
  };

  const handleConfirmAction = async () => {
    if (!confirmModal) return;
    setActionBusy(true);
    setFeedback(null);

    try {
      const result = await runConfirmedAction(confirmModal);
      setFeedback({ type: "success", message: formatActionFeedbackMessage(result) });

      if (confirmModal.scope === "selection") {
        setSelectedProductIds([]);
      } else if (confirmModal.scope === "supplier" && confirmModal.action === "delete") {
        setSelectedProductIds([]);
      }

      if (selectedProduct) {
        const modalDeletedCurrent =
          confirmModal.action === "delete" &&
          (confirmModal.scope === "supplier" ||
            (confirmModal.scope === "single" &&
              confirmModal.product.id === selectedProduct.id) ||
            (confirmModal.scope === "selection" &&
              confirmModal.productIds.includes(selectedProduct.id)));

        if (modalDeletedCurrent) {
          setSelectedProduct(null);
        } else {
          await handleViewProductById(selectedProduct.id);
        }
      }

      const nextOffset = confirmModal.action === "delete" ? 0 : offset;
      if (nextOffset !== offset) {
        setOffset(0);
      } else {
        await loadProducts(
          limit,
          offset,
          selectedCategory,
          searchQuery,
          selectedBrandId,
          selectedStatus
        );
      }

      setConfirmModal(null);
    } catch (err: unknown) {
      const msg =
        err instanceof Error && err.message
          ? err.message
          : "İşlem sırasında beklenmeyen bir hata oluştu.";
      setFeedback({ type: "error", message: msg });
      setConfirmModal(null);
    } finally {
      setActionBusy(false);
    }
  };

  const dialogContent = confirmModal ? buildDialogContent(confirmModal) : null;

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      {/* Top Filter and Search Bar */}
      <CatalogFilters
        searchQuery={searchQuery}
        setSearchQuery={(q) => {
          setSearchQuery(q);
          setOffset(0);
        }}
        selectedBrandId={selectedBrandId}
        setSelectedBrandId={(brandId) => {
          setSelectedBrandId(brandId);
          setOffset(0);
          setSelectedProductIds([]);
        }}
        selectedStatus={selectedStatus}
        setSelectedStatus={(status) => {
          setSelectedStatus(status);
          setOffset(0);
          setSelectedProductIds([]);
        }}
        selectedCategory={selectedCategory}
        setSelectedCategory={(cat) => {
          setSelectedCategory(cat);
          setOffset(0);
        }}
        suppliers={suppliers}
        flatCategories={flatCategories}
        onReset={handleResetFilters}
      />

      {/* Supplier & Multi-select Bulk Actions */}
      <SupplierBulkActionsBar
        selectedSupplier={selectedSupplier}
        totalProductsCount={totalProductsCount}
        selectedProductCount={selectedProductIds.length}
        busy={actionBusy}
        onSupplierAction={openSupplierModal}
        onSelectionAction={openSelectionModal}
        onClearSelection={() => setSelectedProductIds([])}
      />

      {/* Action Feedback Banner */}
      {feedback && (
        <div
          className={`rounded-2xl px-4 py-3 border flex items-center justify-between gap-3 text-sm font-medium ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-rose-50 border-rose-200 text-rose-900"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle size={18} className="text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-1 rounded-lg hover:bg-black/5 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Main Grid View */}
      <ProductGrid
        products={products}
        totalProductsCount={totalProductsCount}
        feeds={feeds}
        loadingProducts={loadingProducts}
        limit={limit}
        offset={offset}
        setOffset={setOffset}
        onViewDetails={handleViewProductById}
        selectedProductIds={selectedProductIds}
        onToggleSelectProduct={handleToggleSelectProduct}
        onToggleSelectAllPage={handleToggleSelectAllPage}
      />

      {/* Detail Modal */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          feeds={feeds}
          onClose={() => setSelectedProduct(null)}
          onViewProduct={handleViewProductById}
          onRequestProductAction={openSingleProductModal}
        />
      )}

      {/* Confirmation Dialog for Supplier / Multi-select / Single Actions */}
      {dialogContent && (
        <BulkActionConfirmModal
          open={confirmModal !== null}
          title={dialogContent.title}
          description={dialogContent.description}
          confirmLabel={dialogContent.confirmLabel}
          tone={dialogContent.tone}
          showDeleteImagesOption={dialogContent.showDeleteImagesOption}
          deleteImages={deleteImages}
          setDeleteImages={setDeleteImages}
          busy={actionBusy}
          onConfirm={() => void handleConfirmAction()}
          onCancel={() => {
            if (!actionBusy) setConfirmModal(null);
          }}
        />
      )}
    </div>
  );
}
