import { AlertTriangle, CheckCircle2, Loader2, PauseCircle, Trash2, X } from "lucide-react";

export type ConfirmTone = "emerald" | "amber" | "rose";

interface BulkActionConfirmModalProps {
  readonly open: boolean;
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
  readonly tone: ConfirmTone;
  readonly showDeleteImagesOption?: boolean;
  readonly deleteImages: boolean;
  readonly setDeleteImages: (val: boolean) => void;
  readonly busy: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

const LABELS = {
  cancel: "Vazgeç",
  processing: "İşlem Yapılıyor...",
  deleteImagesLabel: "Ürün görsel dosyalarını diskten kalıcı olarak sil (başka ürünlerde kullanılmayanlar)",
  deleteImagesHint:
    "İşaretlenirse yalnızca silinen ürünlere ait yerel /uploads ve önbellek görselleri sunucu diskinden kaldırılır.",
};

const TONE_STYLES: Record<
  ConfirmTone,
  { iconBg: string; iconColor: string; buttonBg: string }
> = {
  emerald: {
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-700",
    buttonBg: "bg-emerald-600 hover:bg-emerald-700 text-white",
  },
  amber: {
    iconBg: "bg-amber-100",
    iconColor: "text-amber-700",
    buttonBg: "bg-amber-600 hover:bg-amber-700 text-white",
  },
  rose: {
    iconBg: "bg-rose-100",
    iconColor: "text-rose-700",
    buttonBg: "bg-rose-600 hover:bg-rose-700 text-white",
  },
};

function ToneIcon({ tone }: Readonly<{ tone: ConfirmTone }>) {
  if (tone === "emerald") return <CheckCircle2 size={22} />;
  if (tone === "amber") return <PauseCircle size={22} />;
  return <Trash2 size={22} />;
}

export default function BulkActionConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  tone,
  showDeleteImagesOption = false,
  deleteImages,
  setDeleteImages,
  busy,
  onConfirm,
  onCancel,
}: Readonly<BulkActionConfirmModalProps>) {
  if (!open) return null;

  const styles = TONE_STYLES[tone];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-confirm-title"
      className="fixed inset-0 z-[60] bg-zinc-950/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-zinc-200 overflow-hidden animate-in zoom-in-95 duration-150">
        <div className="px-5 py-4 border-b border-zinc-100 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${styles.iconBg} ${styles.iconColor}`}
            >
              <ToneIcon tone={tone} />
            </div>
            <h3
              id="bulk-confirm-title"
              className="text-base font-bold text-zinc-900 leading-snug"
            >
              {title}
            </h3>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <p className="text-sm text-zinc-600 leading-relaxed">{description}</p>

          {showDeleteImagesOption && (
            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50/70 border border-rose-200/80 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={deleteImages}
                disabled={busy}
                onChange={(e) => setDeleteImages(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-rose-600 rounded cursor-pointer"
              />
              <span className="flex flex-col gap-0.5 text-xs">
                <span className="font-semibold text-rose-900">
                  {LABELS.deleteImagesLabel}
                </span>
                <span className="text-rose-700/80 leading-relaxed">
                  {LABELS.deleteImagesHint}
                </span>
              </span>
            </label>
          )}

          {tone === "rose" && (
            <div className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              <AlertTriangle size={14} className="shrink-0 text-amber-600" />
              <span>
                Silinen ürünler vitrinden kaldırılır ve katalog listesinden çıkarılır.
              </span>
            </div>
          )}
        </div>

        <div className="px-5 py-3.5 bg-zinc-50 border-t border-zinc-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-semibold text-zinc-700 hover:bg-zinc-100 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {LABELS.cancel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm inline-flex items-center gap-2 disabled:opacity-60 cursor-pointer ${styles.buttonBg}`}
          >
            {busy && <Loader2 size={15} className="animate-spin" />}
            {busy ? LABELS.processing : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
