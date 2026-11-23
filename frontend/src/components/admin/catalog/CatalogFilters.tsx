import { useMemo, useState } from "react";
import {
  Search,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  X,
} from "lucide-react";
import { Brand } from "@/types/integration";
import {
  ProductCurrencyFilter,
  ProductImageFilter,
  ProductPriceStatusFilter,
  ProductSortOption,
  ProductSourceFilter,
  ProductStatusFilter,
  ProductStockStatusFilter,
} from "@/services/admin-api.service";

interface FlatCategoryItem {
  readonly id: string;
  readonly title: string;
  readonly depth: number;
}

export interface AdminCatalogFilterState {
  searchQuery: string;
  brandId: string;
  status: ProductStatusFilter;
  categoryId: string;
  currency: ProductCurrencyFilter;
  minPrice: string;
  maxPrice: string;
  priceStatus: ProductPriceStatusFilter;
  stockStatus: ProductStockStatusFilter;
  hasImage: ProductImageFilter;
  gender: string;
  season: string;
  source: ProductSourceFilter;
  dateFrom: string;
  dateTo: string;
  sortBy: ProductSortOption;
}

export const INITIAL_ADMIN_CATALOG_FILTERS: AdminCatalogFilterState = {
  searchQuery: "",
  brandId: "",
  status: "",
  categoryId: "",
  currency: "",
  minPrice: "",
  maxPrice: "",
  priceStatus: "",
  stockStatus: "",
  hasImage: "",
  gender: "",
  season: "",
  source: "",
  dateFrom: "",
  dateTo: "",
  sortBy: "",
};

interface CatalogFiltersProps {
  readonly filters: AdminCatalogFilterState;
  readonly onUpdateFilters: (patch: Partial<AdminCatalogFilterState>) => void;
  readonly suppliers: readonly Brand[];
  readonly flatCategories: readonly FlatCategoryItem[];
  readonly onReset: () => void;
}

const GENDER_OPTIONS = ["Kadın", "Erkek"] as const;

const SEASON_OPTIONS = [
  "4 Mevsim",
  "Yazlık",
  "Kışlık",
  "İlkbahar / Yaz",
  "Sonbahar / Kış",
  "Tüm Sezonlar",
] as const;

interface ActiveChip {
  key: string;
  label: string;
  clearPatch: Partial<AdminCatalogFilterState>;
}

const SIMPLE_LABELS: Readonly<
  Record<
    keyof Pick<
      AdminCatalogFilterState,
      "status" | "currency" | "priceStatus" | "stockStatus" | "hasImage" | "source" | "sortBy"
    >,
    Record<string, string>
  >
> = {
  status: {
    active: "Durum: Satışta",
    inactive: "Durum: Pasif",
  },
  currency: {
    TRY: "Para Birimi: TRY (₺)",
    USD: "Para Birimi: USD ($)",
    EUR: "Para Birimi: EUR (€)",
    GBP: "Para Birimi: GBP (£)",
  },
  priceStatus: {
    priced: "Fiyat: Fiyatlı Ürünler",
    unpriced: "Fiyat: Fiyatsız Ürünler",
    discounted: "Fiyat: İndirimli Ürünler",
  },
  stockStatus: {
    in_stock: "Stok: Stokta Var",
    low_stock: "Stok: Düşük Stok (1-10)",
    out_of_stock: "Stok: Tükendi",
  },
  hasImage: {
    yes: "Görsel: Mevcut",
    no: "Görsel: Yok",
  },
  source: {
    xml: "Kaynak: XML Feed",
    manual: "Kaynak: Manuel / Portal",
  },
  sortBy: {
    oldest: "Sıra: En Eski",
    updated_desc: "Sıra: Son Güncellenen",
    price_asc: "Sıra: Fiyat (Artan)",
    price_desc: "Sıra: Fiyat (Azalan)",
    stock_desc: "Sıra: Stok (Azalan)",
    stock_asc: "Sıra: Stok (Artan)",
    title_asc: "Sıra: Başlık (A-Z)",
  },
};

function countAdvancedFilters(filters: AdminCatalogFilterState): number {
  const flags = [
    Boolean(filters.currency),
    Boolean(filters.minPrice.trim() || filters.maxPrice.trim()),
    Boolean(filters.priceStatus),
    Boolean(filters.stockStatus),
    Boolean(filters.hasImage),
    Boolean(filters.gender),
    Boolean(filters.season),
    Boolean(filters.source),
    Boolean(filters.dateFrom || filters.dateTo),
  ];
  return flags.filter(Boolean).length;
}

function buildActiveChips(
  filters: AdminCatalogFilterState,
  suppliers: readonly Brand[],
  flatCategories: readonly FlatCategoryItem[]
): ActiveChip[] {
  const chips: ActiveChip[] = [];

  if (filters.searchQuery.trim()) {
    chips.push({
      key: "search",
      label: `Arama: "${filters.searchQuery.trim()}"`,
      clearPatch: { searchQuery: "" },
    });
  }
  if (filters.brandId) {
    const sup = suppliers.find((s) => s.id === filters.brandId);
    chips.push({
      key: "brand",
      label: `Tedarikçi: ${sup?.name || filters.brandId}`,
      clearPatch: { brandId: "" },
    });
  }
  if (filters.categoryId) {
    const catLabel =
      filters.categoryId === "uncategorized"
        ? "Kategorisiz"
        : flatCategories.find((c) => c.id === filters.categoryId)?.title || filters.categoryId;
    chips.push({
      key: "category",
      label: `Kategori: ${catLabel}`,
      clearPatch: { categoryId: "" },
    });
  }

  const mappedFields: Array<
    keyof Pick<
      AdminCatalogFilterState,
      "status" | "currency" | "priceStatus" | "stockStatus" | "hasImage" | "source" | "sortBy"
    >
  > = ["status", "currency", "priceStatus", "stockStatus", "hasImage", "source", "sortBy"];
  for (const field of mappedFields) {
    const val = filters[field];
    const mappedLabel = val ? SIMPLE_LABELS[field][val] : "";
    if (mappedLabel) {
      chips.push({
        key: field,
        label: mappedLabel,
        clearPatch: { [field]: "" },
      });
    }
  }

  if (filters.minPrice.trim() || filters.maxPrice.trim()) {
    const minPart = filters.minPrice.trim() || "0";
    const maxPart = filters.maxPrice.trim() || "∞";
    const curLabel = filters.currency ? ` ${filters.currency}` : "";
    chips.push({
      key: "priceRange",
      label: `Fiyat Aralığı: ${minPart} - ${maxPart}${curLabel}`,
      clearPatch: { minPrice: "", maxPrice: "" },
    });
  }
  if (filters.gender) {
    chips.push({
      key: "gender",
      label: `Cinsiyet: ${filters.gender}`,
      clearPatch: { gender: "" },
    });
  }
  if (filters.season) {
    chips.push({
      key: "season",
      label: `Sezon: ${filters.season}`,
      clearPatch: { season: "" },
    });
  }
  if (filters.dateFrom || filters.dateTo) {
    const fromPart = filters.dateFrom || "...";
    const toPart = filters.dateTo || "...";
    chips.push({
      key: "dateRange",
      label: `Tarih: ${fromPart} → ${toPart}`,
      clearPatch: { dateFrom: "", dateTo: "" },
    });
  }

  return chips;
}

const SELECT_CLS =
  "w-full appearance-none pl-3 pr-8 py-2 border border-zinc-200 rounded-xl bg-zinc-50/60 hover:bg-zinc-100/60 text-xs sm:text-sm focus:outline-none focus:border-violet-500 focus:bg-white transition-all cursor-pointer font-medium text-zinc-700";

const INPUT_CLS =
  "w-full px-3 py-2 border border-zinc-200 rounded-xl bg-zinc-50/60 text-xs sm:text-sm text-zinc-800 focus:outline-none focus:border-violet-500 focus:bg-white focus:ring-1 focus:ring-violet-500/20 transition-all";

export default function CatalogFilters({
  filters,
  onUpdateFilters,
  suppliers,
  flatCategories,
  onReset,
}: Readonly<CatalogFiltersProps>) {
  const [showAdvanced, setShowAdvanced] = useState(true);

  const sortedSuppliers = useMemo(
    () => [...suppliers].sort((a, b) => a.name.localeCompare(b.name, "tr")),
    [suppliers]
  );

  const advancedCount = useMemo(() => countAdvancedFilters(filters), [filters]);
  const activeChips = useMemo(
    () => buildActiveChips(filters, suppliers, flatCategories),
    [filters, suppliers, flatCategories]
  );

  return (
    <div className="glass-card bg-white p-4 rounded-2xl border border-zinc-200/60 flex flex-col gap-3.5 shadow-sm">
      {/* Row 1: Primary Search + Supplier + Status + Category + Sort + Controls */}
      <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-2.5 justify-between">
        <div className="relative w-full xl:max-w-sm">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
            size={16}
          />
          <input
            type="text"
            aria-label="Ürün ara"
            placeholder="Başlık, SKU, barkod, marka veya renk ara..."
            value={filters.searchQuery}
            onChange={(e) => onUpdateFilters({ searchQuery: e.target.value })}
            className="w-full pl-10 pr-4 py-2 border border-zinc-200 rounded-xl bg-zinc-50/60 text-sm focus:outline-none focus:border-violet-500 focus:bg-white focus:ring-1 focus:ring-violet-500/20 transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto xl:justify-end">
          {/* Supplier select */}
          <div className="relative flex-1 min-w-[165px] sm:flex-none sm:w-48">
            <select
              aria-label="Tedarikçiye göre filtrele"
              value={filters.brandId}
              onChange={(e) => onUpdateFilters({ brandId: e.target.value })}
              className={SELECT_CLS}
            >
              <option value="">Tüm Tedarikçiler</option>
              {sortedSuppliers.map((sup) => (
                <option key={sup.id} value={sup.id}>
                  {sup.name}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
            />
          </div>

          {/* Status select */}
          <div className="relative flex-1 min-w-[130px] sm:flex-none sm:w-40">
            <select
              aria-label="Duruma göre filtrele"
              value={filters.status}
              onChange={(e) =>
                onUpdateFilters({ status: e.target.value as ProductStatusFilter })
              }
              className={SELECT_CLS}
            >
              <option value="">Tüm Durumlar</option>
              <option value="active">Satışta (Aktif)</option>
              <option value="inactive">Pasif Ürünler</option>
            </select>
            <ChevronDown
              size={14}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
            />
          </div>

          {/* Category select */}
          <div className="relative flex-1 min-w-[160px] sm:flex-none sm:w-48">
            <select
              aria-label="Kategoriye göre filtrele"
              value={filters.categoryId}
              onChange={(e) => onUpdateFilters({ categoryId: e.target.value })}
              className={SELECT_CLS}
            >
              <option value="">Tüm Kategoriler</option>
              <option value="uncategorized">Kategorisiz Ürünler</option>
              {flatCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {"\u00A0".repeat(cat.depth * 2)} {cat.title}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
            />
          </div>

          {/* Sort select */}
          <div className="relative flex-1 min-w-[155px] sm:flex-none sm:w-44">
            <select
              aria-label="Sıralama seçin"
              value={filters.sortBy}
              onChange={(e) =>
                onUpdateFilters({ sortBy: e.target.value as ProductSortOption })
              }
              className={SELECT_CLS}
            >
              <option value="">En Yeni (Varsayılan)</option>
              <option value="oldest">En Eski Eklenen</option>
              <option value="updated_desc">Son Güncellenen</option>
              <option value="price_asc">Fiyat: Düşükten Yükseğe</option>
              <option value="price_desc">Fiyat: Yüksekten Düşüğe</option>
              <option value="stock_desc">Stok: Çoktan Aza</option>
              <option value="stock_asc">Stok: Azdan Çoğa</option>
              <option value="title_asc">Başlık: A - Z</option>
            </select>
            <ChevronDown
              size={14}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
            />
          </div>

          {/* Toggle Advanced */}
          <button
            type="button"
            onClick={() => setShowAdvanced((prev) => !prev)}
            className={`px-3 py-2 border rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
              showAdvanced || advancedCount > 0
                ? "bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100/70"
                : "bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            <SlidersHorizontal size={14} />
            <span>Gelişmiş</span>
            {advancedCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-violet-600 text-white text-[10px] leading-none font-extrabold">
                {advancedCount}
              </span>
            )}
            {showAdvanced ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          {/* Reset button */}
          <button
            type="button"
            onClick={onReset}
            className="px-3 py-2 border border-zinc-200 rounded-xl text-xs font-bold hover:bg-zinc-50 text-zinc-600 inline-flex items-center gap-1.5 transition-colors bg-white shadow-sm cursor-pointer"
          >
            <RotateCcw size={13} />
            <span>Sıfırla</span>
          </button>
        </div>
      </div>

      {/* Row 2: Advanced Filters Drawer */}
      {showAdvanced && (
        <div className="pt-3 border-t border-zinc-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 animate-in fade-in duration-150">
          {/* Price Range */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
              Fiyat Aralığı (Min - Max)
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <input
                type="number"
                min={0}
                step="0.01"
                aria-label="Minimum fiyat"
                placeholder="Min"
                value={filters.minPrice}
                onChange={(e) => onUpdateFilters({ minPrice: e.target.value })}
                className={INPUT_CLS}
              />
              <input
                type="number"
                min={0}
                step="0.01"
                aria-label="Maksimum fiyat"
                placeholder="Max"
                value={filters.maxPrice}
                onChange={(e) => onUpdateFilters({ maxPrice: e.target.value })}
                className={INPUT_CLS}
              />
            </div>
          </div>

          {/* Currency */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
              Para Birimi
            </label>
            <div className="relative">
              <select
                aria-label="Para birimi"
                value={filters.currency}
                onChange={(e) =>
                  onUpdateFilters({ currency: e.target.value as ProductCurrencyFilter })
                }
                className={SELECT_CLS}
              >
                <option value="">Tüm Para Birimleri</option>
                <option value="TRY">TRY (₺ Türk Lirası)</option>
                <option value="USD">USD ($ Dolar)</option>
                <option value="EUR">EUR (€ Euro)</option>
                <option value="GBP">GBP (£ Sterlin)</option>
              </select>
              <ChevronDown
                size={14}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
              />
            </div>
          </div>

          {/* Price Status */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
              Fiyat Durumu
            </label>
            <div className="relative">
              <select
                aria-label="Fiyat durumu"
                value={filters.priceStatus}
                onChange={(e) =>
                  onUpdateFilters({
                    priceStatus: e.target.value as ProductPriceStatusFilter,
                  })
                }
                className={SELECT_CLS}
              >
                <option value="">Tümü (Fiyatlı + Fiyatsız)</option>
                <option value="priced">Sadece Fiyatı Girilmiş (&gt; 0)</option>
                <option value="unpriced">Fiyatsız Ürünler (0 / Boş)</option>
                <option value="discounted">İndirimli Ürünler</option>
              </select>
              <ChevronDown
                size={14}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
              />
            </div>
          </div>

          {/* Stock Status */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
              Stok Durumu
            </label>
            <div className="relative">
              <select
                aria-label="Stok durumu"
                value={filters.stockStatus}
                onChange={(e) =>
                  onUpdateFilters({
                    stockStatus: e.target.value as ProductStockStatusFilter,
                  })
                }
                className={SELECT_CLS}
              >
                <option value="">Tüm Stoklar</option>
                <option value="in_stock">Stokta Var</option>
                <option value="low_stock">Düşük Stok (1 - 10 Adet)</option>
                <option value="out_of_stock">Stok Tükendi (0)</option>
              </select>
              <ChevronDown
                size={14}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
              />
            </div>
          </div>

          {/* Image Status */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
              Görsel Durumu
            </label>
            <div className="relative">
              <select
                aria-label="Görsel durumu"
                value={filters.hasImage}
                onChange={(e) =>
                  onUpdateFilters({ hasImage: e.target.value as ProductImageFilter })
                }
                className={SELECT_CLS}
              >
                <option value="">Tümü (Görsel Farketmez)</option>
                <option value="yes">Görseli Var</option>
                <option value="no">Görselsiz (Eksik Görsel)</option>
              </select>
              <ChevronDown
                size={14}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
              />
            </div>
          </div>

          {/* Gender */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
              Cinsiyet
            </label>
            <div className="relative">
              <select
                aria-label="Cinsiyet"
                value={filters.gender}
                onChange={(e) => onUpdateFilters({ gender: e.target.value })}
                className={SELECT_CLS}
              >
                <option value="">Tüm Cinsiyetler</option>
                {GENDER_OPTIONS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
              />
            </div>
          </div>

          {/* Season */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
              Sezon
            </label>
            <div className="relative">
              <select
                aria-label="Sezon"
                value={filters.season}
                onChange={(e) => onUpdateFilters({ season: e.target.value })}
                className={SELECT_CLS}
              >
                <option value="">Tüm Sezonlar</option>
                {SEASON_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
              />
            </div>
          </div>

          {/* Source */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
              Ürün Kaynağı
            </label>
            <div className="relative">
              <select
                aria-label="Ürün kaynağı"
                value={filters.source}
                onChange={(e) =>
                  onUpdateFilters({ source: e.target.value as ProductSourceFilter })
                }
                className={SELECT_CLS}
              >
                <option value="">Tüm Kaynaklar</option>
                <option value="xml">XML Feed Entegrasyonu</option>
                <option value="manual">Manuel / Tedarikçi Portalı</option>
              </select>
              <ChevronDown
                size={14}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
              />
            </div>
          </div>

          {/* Created Date Range */}
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
              Eklenme Tarih Aralığı
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <input
                type="date"
                aria-label="Başlangıç tarihi"
                value={filters.dateFrom}
                onChange={(e) => onUpdateFilters({ dateFrom: e.target.value })}
                className={INPUT_CLS}
              />
              <input
                type="date"
                aria-label="Bitiş tarihi"
                value={filters.dateTo}
                onChange={(e) => onUpdateFilters({ dateTo: e.target.value })}
                className={INPUT_CLS}
              />
            </div>
          </div>
        </div>
      )}

      {/* Active Filter Chips */}
      {activeChips.length > 0 && (
        <div className="pt-2.5 border-t border-zinc-100 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold text-zinc-400 mr-1">
            Aktif Filtreler:
          </span>
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => onUpdateFilters(chip.clearPatch)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-violet-50 hover:bg-violet-100 text-violet-800 border border-violet-200/80 text-[11px] font-semibold transition-colors cursor-pointer"
            >
              <span>{chip.label}</span>
              <X size={12} className="text-violet-600" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
