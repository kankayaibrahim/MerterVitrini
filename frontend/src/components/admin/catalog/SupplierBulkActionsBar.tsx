import {
  Building2,
  CheckCircle2,
  CheckSquare,
  PauseCircle,
  Trash2,
  X,
} from "lucide-react";
import { Brand } from "@/types/integration";
import { BulkProductActionType } from "@/services/admin-api.service";

interface SupplierBulkActionsBarProps {
  readonly selectedSupplier: Brand | null;
  readonly totalProductsCount: number;
  readonly selectedProductCount: number;
  readonly busy: boolean;
  readonly onSupplierAction: (action: BulkProductActionType) => void;
  readonly onSelectionAction: (action: BulkProductActionType) => void;
  readonly onClearSelection: () => void;
}

const LABELS = {
  supplierScopeNote:
    "Tedarikçi toplu işlemleri, bu tedarikçiye ait silinmemiş tüm ürünlere uygulanır.",
  activateAll: "Tümünü Aktife Al",
  deactivateAll: "Tümünü Pasife Al",
  deleteAll: "Tüm Ürünleri Sil",
  activateSelected: "Seçilenleri Aktife Al",
  deactivateSelected: "Seçilenleri Pasife Al",
  deleteSelected: "Seçilenleri Sil",
  clearSelection: "Seçimi Temizle",
};

export default function SupplierBulkActionsBar({
  selectedSupplier,
  totalProductsCount,
  selectedProductCount,
  busy,
  onSupplierAction,
  onSelectionAction,
  onClearSelection,
}: Readonly<SupplierBulkActionsBarProps>) {
  if (!selectedSupplier && selectedProductCount === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      {selectedSupplier && (
        <div className="glass-card bg-white border border-violet-200/80 rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
              <Building2 size={20} />
            </div>
            <div className="flex flex-col gap-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-sm text-zinc-900">
                  {selectedSupplier.name}
                </span>
                {selectedSupplier.alias_code && (
                  <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 border border-zinc-200">
                    {selectedSupplier.alias_code}
                  </span>
                )}
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
                  {totalProductsCount.toLocaleString("tr-TR")} eşleşen ürün
                </span>
              </div>
              <p className="text-xs text-zinc-500">{LABELS.supplierScopeNote}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => onSupplierAction("activate")}
              className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 size={15} />
              {LABELS.activateAll}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onSupplierAction("deactivate")}
              className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <PauseCircle size={15} />
              {LABELS.deactivateAll}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onSupplierAction("delete")}
              className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Trash2 size={15} />
              {LABELS.deleteAll}
            </button>
          </div>
        </div>
      )}

      {selectedProductCount > 0 && (
        <div className="glass-card bg-zinc-900 text-white rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2.5 text-sm font-semibold">
            <CheckSquare size={17} className="text-violet-400" />
            <span>
              {selectedProductCount.toLocaleString("tr-TR")} ürün seçildi
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => onSelectionAction("activate")}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 size={14} />
              {LABELS.activateSelected}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onSelectionAction("deactivate")}
              className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <PauseCircle size={14} />
              {LABELS.deactivateSelected}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onSelectionAction("delete")}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Trash2 size={14} />
              {LABELS.deleteSelected}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onClearSelection}
              className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold inline-flex items-center gap-1 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <X size={14} />
              {LABELS.clearSelection}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
