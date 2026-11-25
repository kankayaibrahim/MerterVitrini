/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import {
  X,
  ShoppingBag,
  Info,
  Grid,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  PauseCircle,
  Trash2,
  ExternalLink,
  Globe,
  Clock,
  ShieldCheck,
  Play,
  UploadCloud,
  Loader2,
  Film,
} from "lucide-react";
import { Product, XmlFeed, ProductImage, GroupProductColor } from "@/types/integration";
import { BulkProductActionType } from "@/services/admin-api.service";
import { resolveProductActorMeta } from "@/utils/supplierImpersonation";
import {
  isVideoMedia,
  isVideoUploadFile,
  MAX_PRODUCT_VIDEO_BYTES,
} from "@/utils/media";

// Localized labels dictionary to prevent JSX literal internationalization warnings
const LABELS = {
  supplierXml: "Tedarikçi XML",
  originalSku: "Orijinal Kod (SKU)",
  category: "Kategori",
  brand: "Marka",
  seasonGender: "Sezon / Cinsiyet",
  wholesaleRatio: "Toptan Paket / Seri Çarpanı",
  descriptionTitle: "Ürün Açıklaması & Kumaş",
  variantMatrixTitle: "Modelin Renk Seçenekleri",
  variantSku: "Varyasyon SKU",
  color: "Renk",
  size: "Beden",
  barcode: "Barkod",
  stock: "Stok Adedi",
  price: "Fiyat",
  noVariants: "Bu ürüne ait varyasyon kaydı bulunmuyor.",
  close: "Kapat",
  noImage: "Görsel Yok",
  sourceUrl: "Kaynak Ürün Linki (XML Feed)",
  noOtherColors: "Bu modele ait başka renk seçeneği bulunmuyor.",
  currentColor: "Şu Anki Renk",
  stockSuffix: " Adet Stok",
  colorSuffix: " Renk",
  activateProduct: "Aktife Al",
  deactivateProduct: "Pasife Al",
  deleteProduct: "Ürünü Sil",
  onSale: "Satışta",
  passive: "Pasif",
  viewOnSite: "Sitede Görüntüle",
  viewOnSitePassive: "Vitrinde Gör (Pasif)",
  passiveSiteTooltip:
    "Bu ürün şu anda pasif olduğu için canlı vitrinde gizlidir (404 dönebilir). Önce Aktife Al ile yayına alabilirsiniz.",
  storefrontUrlLabel: "Canlı Vitrin Sayfası",
  priceAndCurrency: "Satış Fiyatı / Para Birimi",
  stockAndSeries: "Stok (Adet / Seri)",
  colorLabel: "Renk",
  noPrice: "Fiyat Belirtilmemiş",
};

const STOREFRONT_ORIGIN = "https://mertervitrini.com.tr";

function buildStorefrontProductUrl(product: Product): string {
  const slugOrId = product.slug?.trim() || product.slug_id?.trim() || product.id;
  return `${STOREFRONT_ORIGIN}/product/${encodeURIComponent(slugOrId)}`;
}

function resolveCurrencySymbol(currency?: string): string {
  const upper = (currency || "TRY").toUpperCase();
  if (upper === "USD") return "$";
  if (upper === "EUR") return "€";
  if (upper === "GBP") return "£";
  return "₺";
}

function formatDetailPrice(product: Product): string {
  const base = typeof product.price === "number" ? product.price : 0;
  const discount =
    typeof product.discounted_price === "number" ? product.discounted_price : 0;
  const hasDiscount = discount > 0 && base > 0 && discount < base;
  const effective = hasDiscount ? discount : base;
  if (effective <= 0) return LABELS.noPrice;

  const sym = resolveCurrencySymbol(product.currency);
  const code = (product.currency || "TRY").toUpperCase();
  const formatted = effective.toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${formatted} ${sym} (${code})`;
}

// Safe helper to strip HTML tags while preserving line breaks, avoiding dangerouslySetInnerHTML XSS
const stripHtmlTags = (html: string | null): string => {
  if (!html) return "";
  return html
    .replace(/<br\b[^<>]*>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^<>]*>/g, "")
    .trim();
};

const getStockBadgeClass = (stock: number): string => {
  if (stock > 10) return "bg-emerald-100 text-emerald-800";
  if (stock > 0) return "bg-amber-100 text-amber-800";
  return "bg-rose-100 text-rose-800";
};

interface AdminProductMediaPanelProps {
  readonly productId: string;
  readonly productTitle: string;
  readonly images: readonly ProductImage[];
  readonly activeImageIdx: number;
  readonly setActiveImageIdx: React.Dispatch<React.SetStateAction<number>>;
  readonly mediaBusy: boolean;
  readonly mediaFeedback: { type: "success" | "error"; text: string } | null;
  readonly canUpload: boolean;
  readonly canDelete: boolean;
  readonly onMediaFileSelected: (e: React.ChangeEvent<HTMLInputElement>) => void;
  readonly onDeleteActiveMedia: () => void;
}

function AdminProductMediaPanel({
  productTitle,
  images,
  activeImageIdx,
  setActiveImageIdx,
  mediaBusy,
  mediaFeedback,
  canUpload,
  canDelete,
  onMediaFileSelected,
  onDeleteActiveMedia,
}: AdminProductMediaPanelProps) {
  const safeActiveIdx = Math.min(activeImageIdx, Math.max(images.length - 1, 0));
  const activeImage = images[safeActiveIdx] || images[0] || null;
  const activeIsVideo = activeImage ? isVideoMedia(activeImage) : false;

  return (
    <div className="md:col-span-2 flex flex-col gap-3">
      <div
        className={`w-full aspect-[4/5] border border-zinc-200/50 rounded-2xl overflow-hidden flex items-center justify-center relative group select-none ${
          activeIsVideo ? "bg-black" : "bg-zinc-50"
        }`}
      >
        {images.length > 0 ? (
          <>
            {activeIsVideo && activeImage ? (
              <video
                key={activeImage.image_url}
                src={activeImage.image_url}
                controls
                playsInline
                preload="metadata"
                className="w-full h-full object-contain bg-black"
              >
                <track kind="captions" />
              </video>
            ) : (
              <img
                src={activeImage?.image_url}
                alt={productTitle}
                className="w-full h-full object-cover transition-all duration-300 animate-in fade-in"
              />
            )}
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveImageIdx((prev) => (prev <= 0 ? images.length - 1 : prev - 1));
                  }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-white/80 hover:bg-white text-zinc-800 rounded-full shadow-md backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 z-10"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveImageIdx((prev) => (prev >= images.length - 1 ? 0 : prev + 1));
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-white/80 hover:bg-white text-zinc-800 rounded-full shadow-md backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 z-10"
                >
                  <ChevronRight size={16} />
                </button>
                <div className="absolute top-3 left-3 px-2.5 py-1 bg-black/65 rounded-full text-[10px] text-white font-bold tracking-wider backdrop-blur-sm z-10 pointer-events-none">
                  {safeActiveIdx + 1} / {images.length}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center text-zinc-300">
            <ShoppingBag size={64} />
            <span className="text-[10px] mt-2 font-bold">{LABELS.noImage}</span>
          </div>
        )}
      </div>

      {images.length > 1 && (
        <div className="flex gap-2 flex-wrap max-h-24 overflow-y-auto">
          {images.map((img, idx) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setActiveImageIdx(idx)}
              className={`relative w-12 h-15 rounded-lg border overflow-hidden cursor-pointer bg-zinc-50 transition-all ${
                safeActiveIdx === idx
                  ? "border-violet-600 ring-2 ring-violet-500/20 scale-95"
                  : "border-zinc-200/60 hover:border-violet-400"
              }`}
            >
              {isVideoMedia(img) ? (
                <div className="w-full h-full bg-slate-900 flex items-center justify-center text-white">
                  <Play size={14} className="fill-white" />
                </div>
              ) : (
                <img src={img.image_url} alt="" className="w-full h-full object-cover" />
              )}
            </button>
          ))}
        </div>
      )}

      {(canUpload || canDelete) && (
        <div className="p-3 bg-zinc-50 border border-zinc-200/70 rounded-xl flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider inline-flex items-center gap-1">
              <Film size={12} className="text-violet-600" />
              Medya Yönetimi (MP4 Video / Görsel)
            </span>
            <span className="text-[10px] text-zinc-400 font-semibold">Max 50 MB</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canUpload && (
              <label
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1.5 border transition-colors ${
                  mediaBusy
                    ? "bg-zinc-100 text-zinc-400 border-zinc-200 cursor-not-allowed"
                    : "bg-violet-600 hover:bg-violet-700 text-white border-violet-600 cursor-pointer shadow-xs"
                }`}
              >
                {mediaBusy ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <UploadCloud size={14} />
                )}
                <span>{mediaBusy ? "Yükleniyor..." : "Video / Görsel Ekle"}</span>
                <input
                  type="file"
                  accept="video/mp4,video/webm,image/jpeg,image/png,image/webp"
                  disabled={mediaBusy}
                  onChange={onMediaFileSelected}
                  className="hidden"
                />
              </label>
            )}

            {canDelete && activeImage && (
              <button
                type="button"
                disabled={mediaBusy}
                onClick={onDeleteActiveMedia}
                className="px-3 py-2 rounded-lg text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Trash2 size={13} />
                <span>Seçiliyi Sil</span>
              </button>
            )}
          </div>

          {mediaFeedback && (
            <div
              className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border ${
                mediaFeedback.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-rose-50 text-rose-800 border-rose-200"
              }`}
            >
              {mediaFeedback.text}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AdminProductAuditCard({ product }: Readonly<{ product: Product }>) {
  const actorMeta = resolveProductActorMeta(
    product.created_by_actor_type,
    product.created_by_role
  );
  const createdAtText = product.created_at
    ? new Date(product.created_at).toLocaleString("tr-TR")
    : "-";
  const updatedAtText = product.updated_at
    ? new Date(product.updated_at).toLocaleString("tr-TR")
    : "-";
  const defaultCreator = product.feed_id ? "XML Feed Senkronizasyonu" : "Kayıtlı Kullanıcı";
  const creatorDisplay = product.created_by_name || product.created_by_email || defaultCreator;
  const updaterDisplay =
    product.updated_by_impersonated_by_email ||
    product.updated_by_name ||
    product.updated_by_email ||
    "-";

  return (
    <div className="p-3.5 bg-slate-50/80 border border-slate-200/80 rounded-xl col-span-2 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider inline-flex items-center gap-1">
          <ShieldCheck size={12} className="text-violet-600" />
          Ürün Yükleme & Oturum Kaydı
        </span>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${actorMeta.badgeClass}`}>
          {actorMeta.label}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
        <div>
          <span className="text-zinc-400 block text-[10px] font-semibold">Oluşturan Hesap / Temsilci</span>
          <span className="font-bold text-zinc-800">{creatorDisplay}</span>
          {product.created_by_email && product.created_by_name !== product.created_by_email && (
            <span className="block font-mono text-[10px] text-zinc-500">
              {product.created_by_email}
            </span>
          )}
        </div>

        <div>
          <span className="text-zinc-400 block text-[10px] font-semibold">Açılma Tarih & Saati</span>
          <span className="font-mono font-bold text-zinc-800 inline-flex items-center gap-1">
            <Clock size={11} className="text-zinc-400" />
            {createdAtText}
          </span>
        </div>

        {product.created_by_impersonated_by_email && (
          <div className="sm:col-span-2 bg-amber-50 border border-amber-200/80 rounded-lg px-2.5 py-1.5">
            <span className="text-[10px] font-bold text-amber-700 uppercase block">
              Tedarikçi Adına Yükleyen Yönetici
            </span>
            <span className="text-xs font-extrabold text-amber-950 font-mono">
              {product.created_by_impersonated_by_email}
            </span>
          </div>
        )}

        {product.updated_by_actor_type && (
          <div className="sm:col-span-2 pt-1 border-t border-slate-200/70 flex flex-wrap items-center justify-between gap-2 text-[10px] text-zinc-500">
            <span>
              Son Güncelleme: <strong className="text-zinc-800">{updaterDisplay}</strong>
            </span>
            <span className="font-mono">{updatedAtText}</span>
          </div>
        )}
      </div>
    </div>
  );
}

interface ProductDetailModalProps {
  readonly product: Product | null;
  readonly feeds: readonly XmlFeed[];
  readonly onClose: () => void;
  readonly onViewProduct?: (productId: string) => void;
  readonly onRequestProductAction?: (
    product: Product,
    action: BulkProductActionType
  ) => void;
  readonly onUploadMedia?: (productId: string, file: File) => Promise<ProductImage[]>;
  readonly onDeleteMedia?: (productId: string, mediaId: string) => Promise<ProductImage[]>;
  readonly onProductImagesUpdated?: (productId: string, images: ProductImage[]) => void;
}

export default function ProductDetailModal({
  product,
  feeds,
  onClose,
  onViewProduct,
  onRequestProductAction,
  onUploadMedia,
  onDeleteMedia,
  onProductImagesUpdated,
}: Readonly<ProductDetailModalProps>) {
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [prevProductId, setPrevProductId] = useState(product?.id);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [mediaFeedback, setMediaFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Reset image index when switching between product colors/variations
  if (product?.id !== prevProductId) {
    setPrevProductId(product?.id);
    setActiveImageIdx(0);
    setMediaFeedback(null);
  }

  if (!product) return null;

  const images = product.images || [];
  const safeActiveIdx = Math.min(activeImageIdx, Math.max(images.length - 1, 0));
  const activeImage = images[safeActiveIdx] || images[0] || null;
  const storefrontUrl = buildStorefrontProductUrl(product);

  const handleMediaFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !onUploadMedia || mediaBusy) return;

    if (isVideoUploadFile(file) && file.size > MAX_PRODUCT_VIDEO_BYTES) {
      setMediaFeedback({
        type: "error",
        text: "Video dosyası en fazla 50 MB olabilir.",
      });
      return;
    }

    setMediaBusy(true);
    setMediaFeedback(null);
    try {
      const nextImages = await onUploadMedia(product.id, file);
      onProductImagesUpdated?.(product.id, nextImages);
      setActiveImageIdx(Math.max(0, nextImages.length - 1));
      setMediaFeedback({
        type: "success",
        text: isVideoUploadFile(file)
          ? "MP4/WebM video ürüne eklendi."
          : "Görsel ürüne eklendi.",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Medya yüklenemedi.";
      setMediaFeedback({ type: "error", text: msg });
    } finally {
      setMediaBusy(false);
    }
  };

  const handleDeleteActiveMedia = async () => {
    if (!activeImage || !onDeleteMedia || mediaBusy) return;
    setMediaBusy(true);
    setMediaFeedback(null);
    try {
      const nextImages = await onDeleteMedia(product.id, activeImage.id);
      onProductImagesUpdated?.(product.id, nextImages);
      setActiveImageIdx((prev) => Math.max(0, Math.min(prev, nextImages.length - 1)));
      setMediaFeedback({
        type: "success",
        text: "Seçili medya kaldırıldı.",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Medya silinemedi.";
      setMediaFeedback({ type: "error", text: msg });
    } finally {
      setMediaBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">

      <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden border border-zinc-200/60 max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-zinc-50 border-b border-zinc-200/60 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-violet-700 bg-violet-100 px-2 py-0.5 rounded-full uppercase tracking-wider font-mono">
                {product.custom_sku}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${product.is_active
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-rose-100 text-rose-800"
                  }`}
              >
                {product.is_active ? LABELS.onSale : LABELS.passive}
              </span>
            </div>
            <h3 className="text-lg font-bold text-zinc-900 mt-1 line-clamp-1">{product.title}</h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={storefrontUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={product.is_active ? storefrontUrl : LABELS.passiveSiteTooltip}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors shadow-sm ${product.is_active
                  ? "bg-violet-600 hover:bg-violet-700 text-white"
                  : "bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200"
                }`}
            >
              <ExternalLink size={14} />
              <span>
                {product.is_active ? LABELS.viewOnSite : LABELS.viewOnSitePassive}
              </span>
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label={LABELS.close}
              className="p-1.5 hover:bg-zinc-200 rounded-xl transition-colors text-zinc-500 cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">

          {/* Product Info Splitted Grid */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            <AdminProductMediaPanel
              productId={product.id}
              productTitle={product.title}
              images={images}
              activeImageIdx={activeImageIdx}
              setActiveImageIdx={setActiveImageIdx}
              mediaBusy={mediaBusy}
              mediaFeedback={mediaFeedback}
              canUpload={Boolean(onUploadMedia)}
              canDelete={Boolean(onDeleteMedia)}
              onMediaFileSelected={(e) => void handleMediaFileSelected(e)}
              onDeleteActiveMedia={() => void handleDeleteActiveMedia()}
            />

            {/* Information details side */}
            <div className="md:col-span-3 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-zinc-50 border border-zinc-200/40 rounded-xl">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-0.5">{LABELS.supplierXml}</span>
                  <span className="font-semibold text-zinc-800">
                    {feeds.find(f => f.id === product.feed_id)?.name || "Kayıtlı Tedarikçi"}
                  </span>
                </div>

                <div className="p-3 bg-zinc-50 border border-zinc-200/40 rounded-xl">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-0.5">{LABELS.originalSku}</span>
                  <span className="font-semibold text-zinc-800 font-mono">{product.source_product_id}</span>
                </div>

                <div className="p-3 bg-zinc-50 border border-zinc-200/40 rounded-xl">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-0.5">{LABELS.category}</span>
                  <span className="font-semibold text-zinc-800">{product.category_title || "Genel"}</span>
                </div>

                <div className="p-3 bg-zinc-50 border border-zinc-200/40 rounded-xl">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-0.5">{LABELS.brand}</span>
                  <span className="font-semibold text-zinc-800">{product.brand_name || "Belirtilmemiş"}</span>
                </div>

                <div className="p-3 bg-zinc-50 border border-zinc-200/40 rounded-xl">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-0.5">{LABELS.seasonGender}</span>
                  <span className="font-semibold text-zinc-800">
                    {product.season || "Dört Mevsim"} / {product.gender || "Kadın"}
                  </span>
                </div>

                <div className="p-3 bg-zinc-50 border border-zinc-200/40 rounded-xl">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-0.5">{LABELS.wholesaleRatio}</span>
                  <span className="font-semibold text-zinc-800">
                    {product.packing_ratio || "Seri"} (Seri Çarpanı: {product.series_ratio || "1"})
                  </span>
                </div>

                <div className="p-3 bg-zinc-50 border border-zinc-200/40 rounded-xl">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-0.5">{LABELS.priceAndCurrency}</span>
                  <span className="font-semibold text-zinc-900">
                    {formatDetailPrice(product)}
                  </span>
                </div>

                <div className="p-3 bg-zinc-50 border border-zinc-200/40 rounded-xl">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-0.5">{LABELS.stockAndSeries}</span>
                  <span className="font-semibold text-zinc-800">
                    {(product.stock ?? 0).toLocaleString("tr-TR")} Adet / {(product.series_stock ?? 0).toLocaleString("tr-TR")} Seri
                    {product.color ? ` • ${LABELS.colorLabel}: ${product.color}` : ""}
                  </span>
                </div>

                <div className="p-3 bg-violet-50/50 border border-violet-200/60 rounded-xl col-span-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-violet-700 uppercase tracking-wider flex items-center gap-1 mb-0.5">
                      <Globe size={11} />
                      {LABELS.storefrontUrlLabel}
                    </span>
                    <a
                      href={storefrontUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-violet-700 hover:text-violet-900 break-all underline text-left block truncate"
                    >
                      {storefrontUrl}
                    </a>
                  </div>
                  <a
                    href={storefrontUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-white hover:bg-violet-50 text-violet-700 border border-violet-200 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 shrink-0 transition-colors"
                  >
                    <ExternalLink size={12} />
                    <span>{LABELS.viewOnSite}</span>
                  </a>
                </div>

                {product.source_url && (
                  <div className="p-3 bg-zinc-50 border border-zinc-200/40 rounded-xl col-span-2 flex flex-col gap-0.5">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-0.5">{LABELS.sourceUrl}</span>
                    <a
                      href={product.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-violet-600 hover:text-violet-800 break-all underline text-left"
                    >
                      {product.source_url}
                    </a>
                  </div>
                )}

                <AdminProductAuditCard product={product} />
              </div>

              {/* Secure Text Description view */}
              {product.description && (
                <div className="flex flex-col gap-1.5">
                  <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                    <Info size={12} />
                    {LABELS.descriptionTitle}
                  </h4>
                  <div className="text-xs text-zinc-600 bg-zinc-50 border border-zinc-200/50 p-4 rounded-2xl max-h-36 overflow-y-auto leading-relaxed whitespace-pre-line">
                    {stripHtmlTags(product.description)}
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Variants / Colors Grid */}
          <div className="flex flex-col gap-3 mt-2">
            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-100 pb-1.5 flex items-center gap-1.5">
              <Grid size={14} className="text-violet-600" />
              {LABELS.variantMatrixTitle} ({product.group_products?.length || 1}{LABELS.colorSuffix})
            </h4>

            {product.group_products && product.group_products.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {product.group_products.map((item: GroupProductColor) => {
                  const isCurrent = item.id === product.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        if (!isCurrent && onViewProduct) {
                          onViewProduct(item.id);
                        }
                      }}
                      className={`group border rounded-2xl overflow-hidden flex flex-col transition-all duration-200 select-none text-left ${isCurrent
                        ? "border-violet-600 ring-2 ring-violet-500/20 bg-violet-50/20 cursor-default"
                        : "border-zinc-200 hover:border-violet-400 hover:shadow-md cursor-pointer active:scale-[0.98]"
                        }`}
                    >
                      {/* Cover image of the color */}
                      <div className="aspect-[4/5] w-full bg-zinc-50 border-b border-zinc-100 flex items-center justify-center relative overflow-hidden">
                        {item.cover_image_url ? (
                          <img
                            src={item.cover_image_url}
                            alt={item.color || "Renk"}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="text-zinc-300 flex flex-col items-center justify-center">
                            <ShoppingBag size={24} />
                            <span className="text-[9px] mt-1 font-bold">{LABELS.noImage}</span>
                          </div>
                        )}

                        {/* Current color indicator badge */}
                        {isCurrent && (
                          <span className="absolute top-2 left-2 text-[9px] font-bold text-white bg-violet-600 px-2 py-0.5 rounded-full uppercase tracking-wider">
                            {LABELS.currentColor}
                          </span>
                        )}

                        <span className={`absolute bottom-2 right-2 text-[9px] font-bold px-2 py-0.5 rounded ${getStockBadgeClass(item.stock)}`}>
                          {item.stock}{LABELS.stockSuffix}
                        </span>
                      </div>

                      {/* Metadata */}
                      <div className="p-3 flex flex-col gap-0.5">
                        <span className="text-xs font-bold text-zinc-800 line-clamp-1 text-left">
                          {item.color || "Standart"}
                        </span>
                        <span className="text-[10px] font-semibold text-zinc-400 font-mono text-left">
                          {item.custom_sku}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 bg-zinc-50 border border-zinc-200/50 rounded-2xl text-center text-zinc-400 text-xs font-semibold">
                {LABELS.noOtherColors}
              </div>
            )}
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-200/60 flex flex-wrap items-center justify-between gap-3">
          {onRequestProductAction ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  onRequestProductAction(
                    product,
                    product.is_active ? "deactivate" : "activate"
                  )
                }
                className={`px-3.5 py-2 rounded-xl text-xs font-bold border inline-flex items-center gap-1.5 transition-colors cursor-pointer ${product.is_active
                  ? "bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200"
                  : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200"
                  }`}
              >
                {product.is_active ? (
                  <>
                    <PauseCircle size={14} />
                    {LABELS.deactivateProduct}
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} />
                    {LABELS.activateProduct}
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => onRequestProductAction(product, "delete")}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 size={14} />
                {LABELS.deleteProduct}
              </button>
            </div>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-zinc-900 text-white rounded-xl text-sm font-semibold hover:bg-zinc-800 transition-colors shadow-sm cursor-pointer"
          >
            {LABELS.close}
          </button>
        </div>
      </div>

    </div>
  );
}

