/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { ShoppingBag, PackageCheck, Check } from "lucide-react";
import { Product, XmlFeed } from "@/types/integration";

// Localized labels dictionary to prevent JSX literal internationalization warnings
const LABELS = {
  noImage: "Görsel Yok",
  onSale: "Satışta",
  passive: "Pasif",
  brandLabel: "Marka: ",
  sizeLabel: "Beden: ",
  notSpecified: "Belirtilmemiş",
  standardSeries: "Seri",
  noProductFound: "Eşleşen Ürün Bulunamadı",
  noProductDescription:
    "Arama terimlerinizi veya tedarikçi/durum filtrelerini gözden geçirebilir, entegrasyon ekranından toptancı XML senkronizasyonunu tetikleyebilirsiniz.",
  prevPageButton: "Önceki Sayfa",
  nextPageButton: "Sonraki Sayfa",
  displayedLabel: "Görüntülenen: ",
  selectAllPage: "Bu Sayfadakileri Seç",
  clearPageSelection: "Sayfa Seçimini Kaldır",
  selectProduct: "Ürünü seç",
};

interface ProductGridProps {
  products: Product[];
  totalProductsCount?: number;
  feeds: XmlFeed[];
  loadingProducts: boolean;
  limit: number;
  offset: number;
  setOffset: React.Dispatch<React.SetStateAction<number>>;
  onViewDetails: (productId: string) => Promise<void>;
  selectedProductIds?: readonly string[];
  onToggleSelectProduct?: (productId: string) => void;
  onToggleSelectAllPage?: () => void;
}

function ProductCoverThumb({
  imageUrl,
  title,
}: Readonly<{ imageUrl?: string; title: string }>) {
  const [failed, setFailed] = useState(false);

  if (!imageUrl || failed) {
    return (
      <div className="flex flex-col items-center justify-center text-zinc-300">
        <ShoppingBag size={48} />
        <span className="text-[10px] mt-2 font-bold">{LABELS.noImage}</span>
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={title}
      onError={() => setFailed(true)}
      className="w-full h-full object-cover hover:scale-105 transition-all duration-300"
    />
  );
}

export default function ProductGrid({
  products,
  totalProductsCount = 0,
  feeds,
  loadingProducts,
  limit,
  offset,
  setOffset,
  onViewDetails,
  selectedProductIds = [],
  onToggleSelectProduct,
  onToggleSelectAllPage,
}: Readonly<ProductGridProps>) {
  if (loadingProducts) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div
            key={i}
            className="glass-card bg-white rounded-2xl h-80 animate-pulse flex flex-col gap-3"
          >
            <div className="bg-zinc-100 flex-1 rounded-t-2xl" />
            <div className="p-4 flex flex-col gap-2">
              <div className="h-4 w-1/3 bg-zinc-200 rounded" />
              <div className="h-6 w-full bg-zinc-200 rounded" />
              <div className="h-4 w-1/2 bg-zinc-200 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const effectiveTotal = Math.max(totalProductsCount, offset + products.length);
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(effectiveTotal / limit));
  const hasNextPage =
    totalProductsCount > 0
      ? offset + products.length < totalProductsCount
      : products.length >= limit;

  const selectedSet = new Set(selectedProductIds);
  const allOnPageSelected =
    products.length > 0 && products.every((p) => selectedSet.has(p.id));

  return (
    <div className="flex flex-col gap-6">
      {products.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs font-semibold text-slate-600">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-[#0F172A] font-bold">
              <PackageCheck size={15} className="text-emerald-600" />
              Toplam {effectiveTotal.toLocaleString("tr-TR")} Toptan Ürün Modeli
            </span>
            {onToggleSelectAllPage && (
              <button
                type="button"
                onClick={onToggleSelectAllPage}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-colors cursor-pointer ${allOnPageSelected
                    ? "bg-violet-50 border-violet-300 text-violet-800"
                    : "bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                  }`}
              >
                {allOnPageSelected ? LABELS.clearPageSelection : LABELS.selectAllPage}
              </button>
            )}
          </div>
          <span>
            Sayfa {currentPage.toLocaleString("tr-TR")} / {totalPages.toLocaleString("tr-TR")}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {products.map((product) => {
          const coverUrl =
            product.images && product.images.length > 0
              ? product.images.find((img) => img.is_cover)?.image_url ||
              product.images[0].image_url
              : undefined;
          const isSelected = selectedSet.has(product.id);

          return (
            <div
              key={product.id}
              className={`glass-card bg-white rounded-2xl relative flex flex-col border overflow-hidden transition-all hover:shadow-md ${isSelected
                  ? "border-violet-500 ring-2 ring-violet-500/30"
                  : "border-zinc-200/50"
                }`}
            >
              {onToggleSelectProduct && (
                <button
                  type="button"
                  aria-label={`${LABELS.selectProduct}: ${product.title}`}
                  aria-pressed={isSelected}
                  onClick={() => onToggleSelectProduct(product.id)}
                  className={`absolute top-2.5 left-2.5 z-10 w-6 h-6 rounded-lg border flex items-center justify-center transition-all shadow-sm cursor-pointer ${isSelected
                      ? "bg-violet-600 border-violet-600 text-white"
                      : "bg-white/90 hover:bg-white border-zinc-300 text-transparent hover:border-violet-400"
                    }`}
                >
                  <Check size={14} strokeWidth={3} />
                </button>
              )}

              <button
                type="button"
                onClick={() => onViewDetails(product.id)}
                className="flex flex-col flex-1 w-full text-left cursor-pointer"
              >
                {/* Product image (cover or first image) */}
                <div className="relative w-full aspect-[4/5] bg-zinc-100 flex items-center justify-center overflow-hidden border-b border-zinc-100">
                  <ProductCoverThumb imageUrl={coverUrl} title={product.title} />
                  <span className="absolute bottom-2.5 right-2.5 bg-black/75 text-[10px] text-white px-2 py-0.5 rounded-full font-bold shadow-md">
                    {feeds.find((f) => f.id === product.feed_id)?.alias_code ||
                      "PROD"}
                  </span>
                </div>

                {/* Content */}
                <div className="p-4 flex flex-col flex-1 w-full gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">
                      {product.custom_sku}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${product.is_active
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-rose-100 text-rose-800"
                        }`}
                    >
                      {product.is_active ? LABELS.onSale : LABELS.passive}
                    </span>
                  </div>
                  <h4
                    className="font-bold text-zinc-950 text-sm line-clamp-2 leading-relaxed"
                    title={product.title}
                  >
                    {product.title}
                  </h4>

                  <div className="mt-auto border-t border-zinc-100 pt-3 flex items-center justify-between text-xs text-zinc-500 font-medium">
                    <span>
                      {LABELS.brandLabel}
                      <b className="text-zinc-800 font-bold">
                        {product.brand_name || LABELS.notSpecified}
                      </b>
                    </span>
                    <span>
                      {LABELS.sizeLabel}
                      <b className="text-zinc-800 font-bold">
                        {product.packing_ratio || LABELS.standardSeries}
                      </b>
                    </span>
                  </div>
                </div>
              </button>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {products.length === 0 && (
        <div className="glass-card bg-white rounded-2xl p-12 text-center flex flex-col items-center justify-center text-zinc-400">
          <ShoppingBag size={48} className="text-zinc-300 mb-3" />
          <h4 className="text-lg font-bold text-zinc-900 mb-1">
            {LABELS.noProductFound}
          </h4>
          <p className="text-sm max-w-md">{LABELS.noProductDescription}</p>
        </div>
      )}

      {/* Pagination Controls */}
      {products.length > 0 && (
        <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-zinc-200/50 shadow-sm">
          <button
            type="button"
            onClick={() => setOffset((prev) => Math.max(0, prev - limit))}
            disabled={offset === 0}
            className="px-4 py-2 border border-zinc-200 rounded-xl text-sm font-semibold hover:bg-zinc-50 disabled:bg-zinc-50 disabled:text-zinc-400 transition-colors shadow-sm cursor-pointer disabled:cursor-not-allowed"
          >
            {LABELS.prevPageButton}
          </button>
          <span className="text-xs font-semibold text-zinc-600">
            {LABELS.displayedLabel}
            {(offset + 1).toLocaleString("tr-TR")} -{" "}
            {(offset + products.length).toLocaleString("tr-TR")} /{" "}
            {effectiveTotal.toLocaleString("tr-TR")}
          </span>
          <button
            type="button"
            onClick={() => setOffset((prev) => prev + limit)}
            disabled={!hasNextPage}
            className="px-4 py-2 border border-zinc-200 rounded-xl text-sm font-semibold hover:bg-zinc-50 disabled:bg-zinc-50 disabled:text-zinc-400 transition-colors shadow-sm cursor-pointer disabled:cursor-not-allowed"
          >
            {LABELS.nextPageButton}
          </button>
        </div>
      )}
    </div>
  );
}
