import { Database, ShoppingBag, Layers, RefreshCw } from "lucide-react";

// Localized labels dictionary to prevent JSX literal internationalization warnings
const LABELS = {
  feedsTitle: "Entegrasyon Beslemeleri",
  feedsUnit: "Toptancı",
  productsTitle: "Aktif Ürün Sayısı",
  categoriesTitle: "Sistem Kategorileri",
  categoriesUnit: "Kategori",
  activeSyncTitle: "Devam Eden Eşleme",
  activeSyncUnit: "Aktif"
};

interface MetricCardsProps {
  readonly feedsCount: number;
  readonly productsCount: number;
  readonly categoriesCount: number;
  readonly activeSyncingCount: number;
  readonly loadingProducts: boolean;
}

export default function MetricCards({
  feedsCount,
  productsCount,
  categoriesCount,
  activeSyncingCount,
  loadingProducts
}: Readonly<MetricCardsProps>) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Feeds Count Card */}
      <div className="glass-card bg-white p-5 rounded-2xl flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">{LABELS.feedsTitle}</p>
          <h3 className="text-3xl font-extrabold tracking-tight text-zinc-900">{feedsCount} {LABELS.feedsUnit}</h3>
        </div>
        <div className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center text-violet-600">
          <Database size={22} />
        </div>
      </div>

      {/* Products Count Card */}
      <div className="glass-card bg-white p-5 rounded-2xl flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">{LABELS.productsTitle}</p>
          <h3 className="text-3xl font-extrabold tracking-tight text-zinc-900">
            {loadingProducts ? "..." : productsCount.toLocaleString("tr-TR")}
          </h3>
        </div>
        <div className="w-12 h-12 rounded-xl bg-sky-50 flex items-center justify-center text-sky-600">
          <ShoppingBag size={22} />
        </div>
      </div>

      {/* Categories Count Card */}
      <div className="glass-card bg-white p-5 rounded-2xl flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">{LABELS.categoriesTitle}</p>
          <h3 className="text-3xl font-extrabold tracking-tight text-zinc-900">{categoriesCount} {LABELS.categoriesUnit}</h3>
        </div>
        <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
          <Layers size={22} />
        </div>
      </div>

      {/* Active Sync Count Card */}
      <div className="glass-card bg-white p-5 rounded-2xl flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">{LABELS.activeSyncTitle}</p>
          <h3 className="text-3xl font-extrabold tracking-tight text-zinc-900">
            {activeSyncingCount} {LABELS.activeSyncUnit}
          </h3>
        </div>
        <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
          <RefreshCw size={22} className={activeSyncingCount > 0 ? "animate-spin" : ""} />
        </div>
      </div>
    </div>
  );
}

