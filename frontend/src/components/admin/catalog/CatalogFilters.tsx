import { useMemo } from "react";
import { Search, SlidersHorizontal, ChevronDown } from "lucide-react";
import { Brand } from "@/types/integration";
import { ProductStatusFilter } from "@/services/admin-api.service";

interface FlatCategoryItem {
  readonly id: string;
  readonly title: string;
  readonly depth: number;
}

interface CatalogFiltersProps {
  readonly searchQuery: string;
  readonly setSearchQuery: (query: string) => void;
  readonly selectedBrandId: string;
  readonly setSelectedBrandId: (brandId: string) => void;
  readonly selectedStatus: ProductStatusFilter;
  readonly setSelectedStatus: (status: ProductStatusFilter) => void;
  readonly selectedCategory: string;
  readonly setSelectedCategory: (category: string) => void;
  readonly suppliers: readonly Brand[];
  readonly flatCategories: readonly FlatCategoryItem[];
  readonly onReset: () => void;
}

const LABELS = {
  searchPlaceholder: "Başlık, stok kodu, marka veya renk ara...",
  filterPrefix: "Filtrele:",
  allSuppliers: "Tüm Tedarikçiler",
  allStatuses: "Tüm Durumlar",
  statusActive: "Satışta (Aktif)",
  statusInactive: "Pasif Ürünler",
  allCategories: "Tüm Kategoriler",
  reset: "Sıfırla",
  supplierAria: "Tedarikçiye göre filtrele",
  statusAria: "Duruma göre filtrele",
  categoryAria: "Kategoriye göre filtrele",
};

export default function CatalogFilters({
  searchQuery,
  setSearchQuery,
  selectedBrandId,
  setSelectedBrandId,
  selectedStatus,
  setSelectedStatus,
  selectedCategory,
  setSelectedCategory,
  suppliers,
  flatCategories,
  onReset,
}: Readonly<CatalogFiltersProps>) {
  const sortedSuppliers = useMemo(
    () => [...suppliers].sort((a, b) => a.name.localeCompare(b.name, "tr")),
    [suppliers]
  );

  return (
    <div className="glass-card bg-white p-4 rounded-2xl flex flex-col xl:flex-row items-stretch xl:items-center gap-3 justify-between">
      {/* Search input */}
      <div className="relative w-full xl:max-w-sm">
        <Search
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
          size={16}
        />
        <input
          type="text"
          placeholder={LABELS.searchPlaceholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-zinc-200 rounded-xl bg-zinc-50/50 text-sm focus:outline-none focus:border-violet-500 focus:bg-white focus:ring-1 focus:ring-violet-500/20 transition-all"
        />
      </div>

      {/* Dropdown Filters */}
      <div className="flex flex-wrap items-center gap-2.5 w-full xl:w-auto xl:justify-end">
        <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-semibold uppercase tracking-wider mr-1">
          <SlidersHorizontal size={14} />
          {LABELS.filterPrefix}
        </div>

        {/* Supplier select */}
        <div className="relative flex-1 min-w-[180px] sm:flex-none">
          <select
            aria-label={LABELS.supplierAria}
            value={selectedBrandId}
            onChange={(e) => setSelectedBrandId(e.target.value)}
            className="w-full sm:w-56 appearance-none pl-3 pr-8 py-2 border border-zinc-200 rounded-xl bg-zinc-50/50 hover:bg-zinc-100/50 text-sm focus:outline-none focus:border-violet-500 focus:bg-white transition-all cursor-pointer font-medium text-zinc-700"
          >
            <option value="">{LABELS.allSuppliers}</option>
            {sortedSuppliers.map((sup) => (
              <option key={sup.id} value={sup.id}>
                {sup.name}
                {sup.alias_code ? ` (${sup.alias_code})` : ""}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
          />
        </div>

        {/* Status select */}
        <div className="relative flex-1 min-w-[140px] sm:flex-none">
          <select
            aria-label={LABELS.statusAria}
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as ProductStatusFilter)}
            className="w-full sm:w-44 appearance-none pl-3 pr-8 py-2 border border-zinc-200 rounded-xl bg-zinc-50/50 hover:bg-zinc-100/50 text-sm focus:outline-none focus:border-violet-500 focus:bg-white transition-all cursor-pointer font-medium text-zinc-700"
          >
            <option value="">{LABELS.allStatuses}</option>
            <option value="active">{LABELS.statusActive}</option>
            <option value="inactive">{LABELS.statusInactive}</option>
          </select>
          <ChevronDown
            size={14}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
          />
        </div>

        {/* Category select */}
        <div className="relative flex-1 min-w-[160px] sm:flex-none">
          <select
            aria-label={LABELS.categoryAria}
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full sm:w-48 appearance-none pl-3 pr-8 py-2 border border-zinc-200 rounded-xl bg-zinc-50/50 hover:bg-zinc-100/50 text-sm focus:outline-none focus:border-violet-500 focus:bg-white transition-all cursor-pointer font-medium text-zinc-700"
          >
            <option value="">{LABELS.allCategories}</option>
            {flatCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {"\u00A0".repeat(cat.depth * 2)} {cat.title}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
          />
        </div>

        <button
          type="button"
          onClick={onReset}
          className="px-3.5 py-2 border border-zinc-200 rounded-xl text-sm font-semibold hover:bg-zinc-50 text-zinc-600 transition-colors bg-white shadow-sm cursor-pointer"
        >
          {LABELS.reset}
        </button>
      </div>
    </div>
  );
}
