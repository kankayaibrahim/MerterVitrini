"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Layers,
  Package,
  PauseCircle,
  Search,
} from "lucide-react";
import { CategoryNode } from "@/types/integration";

type AnalyticsScopeFilter = "all" | "roots" | "children" | "with_active" | "empty";
type AnalyticsSortBy =
  | "active_desc"
  | "total_desc"
  | "passive_desc"
  | "rate_desc"
  | "tree";

interface CategoryAnalyticsRow {
  id: string;
  title: string;
  breadcrumb: string;
  depth: number;
  isActive: boolean;
  hasChildren: boolean;
  totalProducts: number;
  activeProducts: number;
  passiveProducts: number;
  directTotalProducts: number;
  directActiveProducts: number;
  activeRatePercent: number;
}

const DEFAULT_VISIBLE_ROWS = 15;

const SCOPE_TABS: ReadonlyArray<{ id: AnalyticsScopeFilter; label: string }> = [
  { id: "all", label: "Tümü" },
  { id: "roots", label: "Ana Kategoriler" },
  { id: "children", label: "Alt Kategoriler" },
  { id: "with_active", label: "Aktif Ürünü Olanlar" },
  { id: "empty", label: "Ürünsüz (Boş)" },
];

function flattenCategoryAnalytics(
  nodes: readonly CategoryNode[],
  parentTitles: readonly string[] = [],
  depth = 0
): CategoryAnalyticsRow[] {
  const rows: CategoryAnalyticsRow[] = [];

  for (const node of nodes) {
    const chain = [...parentTitles, node.title];
    const totalProducts = node.total_products ?? 0;
    const activeProducts = node.active_products ?? 0;
    const passiveProducts = Math.max(0, totalProducts - activeProducts);
    const directTotalProducts = node.direct_total_products ?? totalProducts;
    const directActiveProducts = node.direct_active_products ?? activeProducts;
    const activeRatePercent =
      totalProducts > 0 ? Math.round((activeProducts / totalProducts) * 100) : 0;

    rows.push({
      id: node.id,
      title: node.title,
      breadcrumb: chain.join(" › "),
      depth,
      isActive: node.is_active,
      hasChildren: Array.isArray(node.children) && node.children.length > 0,
      totalProducts,
      activeProducts,
      passiveProducts,
      directTotalProducts,
      directActiveProducts,
      activeRatePercent,
    });

    if (node.children && node.children.length > 0) {
      rows.push(...flattenCategoryAnalytics(node.children, chain, depth + 1));
    }
  }

  return rows;
}

function matchesScope(row: CategoryAnalyticsRow, scope: AnalyticsScopeFilter): boolean {
  switch (scope) {
    case "roots":
      return row.depth === 0;
    case "children":
      return row.depth > 0;
    case "with_active":
      return row.activeProducts > 0;
    case "empty":
      return row.totalProducts === 0;
    default:
      return true;
  }
}

function compareAnalyticsRows(
  a: CategoryAnalyticsRow,
  b: CategoryAnalyticsRow,
  sortBy: AnalyticsSortBy
): number {
  switch (sortBy) {
    case "total_desc":
      return b.totalProducts - a.totalProducts || b.activeProducts - a.activeProducts;
    case "passive_desc":
      return b.passiveProducts - a.passiveProducts || b.totalProducts - a.totalProducts;
    case "rate_desc":
      return b.activeRatePercent - a.activeRatePercent || b.activeProducts - a.activeProducts;
    case "active_desc":
    default:
      return b.activeProducts - a.activeProducts || b.totalProducts - a.totalProducts;
  }
}

function resolveRateBarClass(rate: number): string {
  if (rate >= 70) return "bg-emerald-500";
  if (rate >= 40) return "bg-violet-500";
  return "bg-amber-500";
}

interface CategoryAnalyticsPanelProps {
  readonly categories: readonly CategoryNode[];
}

export default function CategoryAnalyticsPanel({
  categories,
}: Readonly<CategoryAnalyticsPanelProps>) {
  const [searchQuery, setSearchQuery] = useState("");
  const [scope, setScope] = useState<AnalyticsScopeFilter>("all");
  const [sortBy, setSortBy] = useState<AnalyticsSortBy>("active_desc");
  const [showAll, setShowAll] = useState(false);

  const flatRows = useMemo(() => flattenCategoryAnalytics(categories), [categories]);

  // Root nodes already carry rolled-up ltree subtree counts, so summing roots prevents double-counting
  const summary = useMemo(() => {
    let totalProducts = 0;
    let activeProducts = 0;
    for (const root of categories) {
      totalProducts += root.total_products ?? 0;
      activeProducts += root.active_products ?? 0;
    }
    const passiveProducts = Math.max(0, totalProducts - activeProducts);
    const activeRatePercent =
      totalProducts > 0 ? Math.round((activeProducts / totalProducts) * 100) : 0;
    const totalCategories = flatRows.length;
    const activeCategories = flatRows.filter((r) => r.isActive).length;
    const emptyCategories = flatRows.filter((r) => r.totalProducts === 0).length;

    return {
      totalCategories,
      activeCategories,
      emptyCategories,
      rootCount: categories.length,
      totalProducts,
      activeProducts,
      passiveProducts,
      activeRatePercent,
    };
  }, [categories, flatRows]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLocaleLowerCase("tr-TR");
    const matching = flatRows.filter((row) => {
      if (!matchesScope(row, scope)) return false;
      if (!q) return true;
      return (
        row.title.toLocaleLowerCase("tr-TR").includes(q) ||
        row.breadcrumb.toLocaleLowerCase("tr-TR").includes(q)
      );
    });

    if (sortBy === "tree") {
      return matching;
    }
    return [...matching].sort((a, b) => compareAnalyticsRows(a, b, sortBy));
  }, [flatRows, searchQuery, scope, sortBy]);

  const visibleRows = showAll
    ? filteredRows
    : filteredRows.slice(0, DEFAULT_VISIBLE_ROWS);
  const canToggleExpand = filteredRows.length > DEFAULT_VISIBLE_ROWS;

  return (
    <div className="flex flex-col gap-5">
      {/* Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="glass-card bg-white rounded-2xl border border-zinc-200/60 p-5 shadow-sm flex items-start justify-between gap-3">
          <div>
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Toplam Kategori
            </span>
            <p className="text-2xl font-extrabold text-zinc-900 mt-1">
              {summary.totalCategories.toLocaleString("tr-TR")}
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              {summary.rootCount.toLocaleString("tr-TR")} ana •{" "}
              {summary.activeCategories.toLocaleString("tr-TR")} aktif •{" "}
              {summary.emptyCategories.toLocaleString("tr-TR")} boş
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-violet-50 text-violet-600 shrink-0">
            <Layers size={20} />
          </div>
        </div>

        <div className="glass-card bg-white rounded-2xl border border-zinc-200/60 p-5 shadow-sm flex items-start justify-between gap-3">
          <div>
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Katalog Toplam Ürün
            </span>
            <p className="text-2xl font-extrabold text-zinc-900 mt-1">
              {summary.totalProducts.toLocaleString("tr-TR")}
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              Tüm kategorilerdeki silinmemiş ürün
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700 shrink-0">
            <Package size={20} />
          </div>
        </div>

        <div className="glass-card bg-white rounded-2xl border border-emerald-200/70 p-5 shadow-sm flex items-start justify-between gap-3">
          <div>
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
              Aktif (Satışta) Ürün
            </span>
            <p className="text-2xl font-extrabold text-emerald-700 mt-1">
              {summary.activeProducts.toLocaleString("tr-TR")}
            </p>
            <p className="text-xs text-emerald-700/80 font-semibold mt-1">
              Vitrinde yayında (%{summary.activeRatePercent})
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="glass-card bg-white rounded-2xl border border-amber-200/70 p-5 shadow-sm flex items-start justify-between gap-3">
          <div>
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
              Pasif Ürün
            </span>
            <p className="text-2xl font-extrabold text-amber-700 mt-1">
              {summary.passiveProducts.toLocaleString("tr-TR")}
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              Vitrinde gizli (%{Math.max(0, 100 - summary.activeRatePercent)})
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 shrink-0">
            <PauseCircle size={20} />
          </div>
        </div>
      </div>

      {/* Interactive Category Analytics Breakdown Table */}
      <div className="glass-card bg-white rounded-3xl border border-zinc-200/60 p-6 flex flex-col gap-4 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-zinc-100 pb-4">
          <div className="flex items-start gap-2.5">
            <div className="p-2 rounded-xl bg-violet-50 text-violet-600 mt-0.5">
              <BarChart3 size={18} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-900">
                Kategori Bazlı Ürün Analizi
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Her kategori ve alt dallarındaki toplam, aktif ve pasif ürün dağılımını inceleyin.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px] sm:w-64">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
              />
              <input
                type="text"
                aria-label="Kategori analizinde ara"
                placeholder="Kategori veya yol ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-zinc-200 rounded-xl bg-zinc-50/60 text-xs sm:text-sm focus:outline-none focus:border-violet-500 focus:bg-white transition-all"
              />
            </div>

            <div className="relative">
              <select
                aria-label="Kategori analiz sıralaması"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as AnalyticsSortBy)}
                className="appearance-none pl-3 pr-8 py-2 border border-zinc-200 rounded-xl bg-zinc-50/60 hover:bg-zinc-100/60 text-xs sm:text-sm font-semibold text-zinc-700 focus:outline-none focus:border-violet-500 focus:bg-white cursor-pointer"
              >
                <option value="active_desc">Aktif Ürün (Çoktan Aza)</option>
                <option value="total_desc">Toplam Ürün (Çoktan Aza)</option>
                <option value="passive_desc">Pasif Ürün (Çoktan Aza)</option>
                <option value="rate_desc">Aktiflik Oranı (Yüksekten Düşüğe)</option>
                <option value="tree">Hiyerarşi Sırası</option>
              </select>
              <ChevronDown
                size={14}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
              />
            </div>
          </div>
        </div>

        {/* Filter Scope Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {SCOPE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setScope(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                scope === tab.id
                  ? "bg-violet-600 text-white shadow-sm"
                  : "bg-zinc-100/80 text-zinc-600 hover:bg-zinc-200/70"
              }`}
            >
              {tab.label}
            </button>
          ))}
          <span className="ml-auto text-xs font-semibold text-zinc-400">
            {filteredRows.length.toLocaleString("tr-TR")} kategori listeleniyor
          </span>
        </div>

        {/* Analytics Table */}
        {visibleRows.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-zinc-200/60">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50/90 border-b border-zinc-200/60 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Kategori / Hiyerarşi Yolu</th>
                  <th className="py-3 px-3 text-right">Toplam Ürün</th>
                  <th className="py-3 px-3 text-right">Aktif (Satışta)</th>
                  <th className="py-3 px-3 text-right">Pasif</th>
                  <th className="py-3 px-4 min-w-[140px]">Aktiflik Oranı</th>
                  <th className="py-3 px-4 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-xs sm:text-sm">
                {visibleRows.map((row) => {
                  const hasSubtreeDiff =
                    row.hasChildren && row.directTotalProducts !== row.totalProducts;
                  return (
                    <tr
                      key={row.id}
                      className="hover:bg-violet-50/30 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500">
                            Seviye {row.depth + 1}
                          </span>
                          <span className="font-bold text-zinc-900">{row.title}</span>
                          {!row.isActive && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500">
                              Pasif Kategori
                            </span>
                          )}
                        </div>
                        {row.depth > 0 && (
                          <div className="text-[11px] text-zinc-400 mt-0.5 truncate max-w-md">
                            {row.breadcrumb}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-extrabold text-zinc-800 whitespace-nowrap">
                        <div>{row.totalProducts.toLocaleString("tr-TR")}</div>
                        {hasSubtreeDiff && (
                          <div className="text-[10px] font-medium text-zinc-400">
                            Doğrudan: {row.directTotalProducts.toLocaleString("tr-TR")}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                          {row.activeProducts.toLocaleString("tr-TR")}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200/70">
                          {row.passiveProducts.toLocaleString("tr-TR")}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${resolveRateBarClass(row.activeRatePercent)}`}
                              style={{ width: `${row.activeRatePercent}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-zinc-700 w-9 text-right">
                            %{row.activeRatePercent}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <Link
                          href={`/admin/catalog/products?category_id=${encodeURIComponent(row.id)}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-violet-600 text-zinc-700 hover:text-white text-xs font-bold transition-colors"
                        >
                          <span>Ürünleri Gör</span>
                          <ExternalLink size={12} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-zinc-200 py-10 text-center text-sm text-zinc-400 font-medium">
            Seçili filtrelerle eşleşen kategori bulunamadı.
          </div>
        )}

        {canToggleExpand && (
          <div className="flex justify-center pt-1">
            <button
              type="button"
              onClick={() => setShowAll((prev) => !prev)}
              className="px-4 py-2 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-xs font-bold text-zinc-700 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {showAll ? (
                <>
                  <ChevronUp size={14} />
                  <span>İlk {DEFAULT_VISIBLE_ROWS} Kategoriyi Göster</span>
                </>
              ) : (
                <>
                  <ChevronDown size={14} />
                  <span>
                    Tümünü Göster ({filteredRows.length.toLocaleString("tr-TR")})
                  </span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
