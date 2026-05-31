import { Search, SlidersHorizontal, ChevronDown } from "lucide-react";

interface CatalogFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  flatCategories: Array<{ id: string; title: string; depth: number }>;
  onReset: () => void;
}

export default function CatalogFilters({
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  flatCategories,
  onReset
}: CatalogFiltersProps) {
  return (
    <div className="glass-card bg-white p-4 rounded-2xl flex flex-col md:flex-row items-center gap-4 justify-between">
      
      {/* Search input */}
      <div className="relative w-full md:max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
        <input 
          type="text"
          placeholder="Başlığa veya stok koduna göre ara (Örn: bluz, EDUSA)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-zinc-200 rounded-xl bg-zinc-50/50 text-sm focus:outline-none focus:border-violet-500 focus:bg-white focus:ring-1 focus:ring-violet-500/20 transition-all"
        />
      </div>

      {/* Dropdown Filters */}
      <div className="flex items-center gap-3 w-full md:w-auto">
        <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-semibold uppercase tracking-wider">
          <SlidersHorizontal size={14} />
          Filtrele:
        </div>
        
        {/* Category select */}
        <div className="relative flex-1 md:flex-none">
          <select 
            value={selectedCategory} 
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full md:w-48 appearance-none pl-3 pr-8 py-2 border border-zinc-200 rounded-xl bg-zinc-50/50 hover:bg-zinc-100/50 text-sm focus:outline-none focus:border-violet-500 focus:bg-white transition-all cursor-pointer font-medium text-zinc-700"
          >
            <option value="">Tüm Kategoriler</option>
            {flatCategories.map(cat => (
              <option key={cat.id} value={cat.id}>
                {"\u00A0".repeat(cat.depth * 2)} {cat.title}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
        </div>

        <button 
          onClick={onReset}
          className="px-3 py-2 border border-zinc-200 rounded-xl text-sm font-semibold hover:bg-zinc-50 text-zinc-500 transition-colors bg-white shadow-sm"
        >
          Sıfırla
        </button>
      </div>
    </div>
  );
}
