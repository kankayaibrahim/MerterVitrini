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
} from "lucide-react";
import { Product, XmlFeed, ProductImage, GroupProductColor } from "@/types/integration";
import { BulkProductActionType } from "@/services/admin-api.service";

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
  passive: "Pasif"
};

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

interface ProductDetailModalProps {
  readonly product: Product | null;
  readonly feeds: readonly XmlFeed[];
  readonly onClose: () => void;
  readonly onViewProduct?: (productId: string) => void;
  readonly onRequestProductAction?: (
    product: Product,
    action: BulkProductActionType
  ) => void;
}

export default function ProductDetailModal({
  product,
  feeds,
  onClose,
  onViewProduct,
  onRequestProductAction
}: Readonly<ProductDetailModalProps>) {
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [prevProductId, setPrevProductId] = useState(product?.id);

  // Reset image index when switching between product colors/variations
  if (product?.id !== prevProductId) {
    setPrevProductId(product?.id);
    setActiveImageIdx(0);
  }

  if (!product) return null;

  const images = product.images || [];
  const activeImage = images[activeImageIdx] || images[0] || null;

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">

      <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden border border-zinc-200/60 max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-zinc-50 border-b border-zinc-200/60 flex items-center justify-between">
          <div>
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
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-200 rounded-xl transition-colors text-zinc-500"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">

          {/* Product Info Splitted Grid */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">

            {/* Images side */}
            <div className="md:col-span-2 flex flex-col gap-3">
              <div className="w-full aspect-[4/5] bg-zinc-50 border border-zinc-200/50 rounded-2xl overflow-hidden flex items-center justify-center relative group select-none">
                {images.length > 0 ? (
                  <>
                    <img
                      src={activeImage?.image_url}
                      alt={product.title}
                      className="w-full h-full object-cover transition-all duration-300 animate-in fade-in"
                    />
                    {images.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveImageIdx(prev => (prev === 0 ? images.length - 1 : prev - 1));
                          }}
                          className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-white/80 hover:bg-white text-zinc-800 rounded-full shadow-md backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveImageIdx(prev => (prev === images.length - 1 ? 0 : prev + 1));
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-white/80 hover:bg-white text-zinc-800 rounded-full shadow-md backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                        >
                          <ChevronRight size={16} />
                        </button>
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-2.5 py-1 bg-black/60 rounded-full text-[10px] text-white font-bold tracking-wider backdrop-blur-sm">
                          {activeImageIdx + 1} / {images.length}
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

              {/* Thumbnail gallery */}
              {images.length > 1 && (
                <div className="flex gap-2 flex-wrap max-h-24 overflow-y-auto">
                  {images.map((img: ProductImage, idx: number) => (
                    <button
                      key={img.id}
                      type="button"
                      onClick={() => setActiveImageIdx(idx)}
                      className={`w-12 h-15 rounded-lg border overflow-hidden cursor-pointer bg-zinc-50 transition-all ${activeImageIdx === idx ? "border-violet-600 ring-2 ring-violet-500/20 scale-95" : "border-zinc-200/60 hover:border-violet-400"
                        }`}
                    >
                      <img src={img.image_url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

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

