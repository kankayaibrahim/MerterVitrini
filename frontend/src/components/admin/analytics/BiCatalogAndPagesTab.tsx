"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Building2,
  DoorOpen,
  ExternalLink,
  LogIn,
  PackageSearch,
} from "lucide-react";
import {
  BiHotProductRow,
  BiPageIntelligence,
  BiProductAndBrandVelocity,
  formatDurationSec,
} from "./biTypes";

function resolveOpportunityBadge(product: BiHotProductRow): string | null {
  if (product.opportunity_flag && product.opportunity_flag.trim()) {
    return product.opportunity_flag.trim();
  }
  if (product.views >= 15 && product.cart_adds === 0) {
    return "Yüksek İnceleme / Düşük Sepet (Fiyat/Asorti Uyarısı)";
  }
  return null;
}

function HotProductsTable({ products }: { readonly products: BiHotProductRow[] }) {
  const [onlyWarnings, setOnlyWarnings] = useState(false);

  const visibleProducts = useMemo(() => {
    if (!onlyWarnings) return products;
    return products.filter((p) => Boolean(resolveOpportunityBadge(p)));
  }, [products, onlyWarnings]);

  const warningCount = useMemo(
    () => products.filter((p) => Boolean(resolveOpportunityBadge(p))).length,
    [products]
  );

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs overflow-hidden">
      <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <PackageSearch size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Ürün İnceleme Hızı &amp; Merchandising Teşhis Motoru
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Çok incelenip sepete eklenmeyen modellerde fiyat, minimum seri adedi veya beden asortisi darboğazlarını yakalar
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setOnlyWarnings((prev) => !prev)}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer self-start sm:self-auto ${
            onlyWarnings
              ? "bg-amber-600 text-white border-amber-600"
              : "bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100"
          }`}
        >
          <AlertCircle size={14} />
          <span>Fiyat/Asorti Uyarısı ({warningCount})</span>
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-50/80 dark:bg-zinc-950/50 text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
              <th className="py-3 px-4">Toptan Model &amp; SKU</th>
              <th className="py-3 px-4">Üretici Firma</th>
              <th className="py-3 px-4">İnceleme</th>
              <th className="py-3 px-4">Sepet</th>
              <th className="py-3 px-4">Talep/Sipariş</th>
              <th className="py-3 px-4">Dönüşüm</th>
              <th className="py-3 px-4">Merchandising Teşhisi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
            {visibleProducts.map((prod, idx) => {
              const warningLabel = resolveOpportunityBadge(prod);
              return (
                <tr
                  key={prod.product_id || `${prod.custom_sku}-${idx}`}
                  className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors"
                >
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-zinc-900 dark:text-zinc-100 max-w-[260px] truncate" title={prod.title}>
                      {prod.title}
                    </div>
                    <div className="text-[11px] font-mono text-zinc-400 mt-0.5">
                      SKU: {prod.custom_sku || "-"}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-zinc-700 dark:text-zinc-300">
                    {prod.brand_name}
                  </td>
                  <td className="py-3.5 px-4 font-black text-zinc-900 dark:text-zinc-100">
                    {prod.views.toLocaleString("tr-TR")}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-amber-700 dark:text-amber-400">
                    {prod.cart_adds.toLocaleString("tr-TR")}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-emerald-700 dark:text-emerald-400">
                    {prod.inquiries_or_orders.toLocaleString("tr-TR")}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-zinc-800 dark:text-zinc-200">
                    %{prod.conversion_pct.toFixed(1)}
                  </td>
                  <td className="py-3.5 px-4">
                    {warningLabel ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-[11px] font-bold">
                        <AlertCircle size={12} className="shrink-0" />
                        <span>{warningLabel}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold">
                        Dengeli Dönüşüm
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {visibleProducts.length === 0 && (
          <div className="py-12 text-center text-xs text-zinc-400">
            Seçili filtreye uygun ürün hız kaydı bulunamadı.
          </div>
        )}
      </div>
    </div>
  );
}

function TopManufacturersCard({
  brands,
}: {
  readonly brands: BiProductAndBrandVelocity["top_brands"];
}) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs overflow-hidden">
      <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2.5">
        <div className="p-2.5 rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
          <Building2 size={18} />
        </div>
        <div>
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            En Yüksek Talep Çeken Üretici &amp; Toptancı Firmalar
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Firma vitrini ziyareti, ürün kartı gösterimi ve doğrudan WhatsApp / B2B talep liderlik tablosu
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-50/80 dark:bg-zinc-950/50 text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
              <th className="py-3 px-4">#</th>
              <th className="py-3 px-4">Üretici / Tedarikçi</th>
              <th className="py-3 px-4">Vitrin Ziyareti</th>
              <th className="py-3 px-4">Ürün İnceleme</th>
              <th className="py-3 px-4">WhatsApp &amp; Lead</th>
              <th className="py-3 px-4 text-right">Lead Dönüşümü</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
            {brands.map((brand, idx) => (
              <tr
                key={brand.brand_id || `${brand.brand_name}-${idx}`}
                className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors"
              >
                <td className="py-3 px-4 font-black text-zinc-400">{idx + 1}</td>
                <td className="py-3 px-4 font-bold text-zinc-900 dark:text-zinc-100">
                  {brand.brand_name}
                </td>
                <td className="py-3 px-4 font-semibold text-zinc-700 dark:text-zinc-300">
                  {brand.profile_views.toLocaleString("tr-TR")}
                </td>
                <td className="py-3 px-4 font-black text-zinc-900 dark:text-zinc-100">
                  {brand.product_views.toLocaleString("tr-TR")}
                </td>
                <td className="py-3 px-4 font-black text-emerald-700 dark:text-emerald-400">
                  {brand.whatsapp_and_leads.toLocaleString("tr-TR")}
                </td>
                <td className="py-3 px-4 text-right">
                  <span className="px-2.5 py-1 rounded-xl bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 font-bold">
                    %{brand.lead_rate_pct.toFixed(1)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {brands.length === 0 && (
          <div className="py-10 text-center text-xs text-zinc-400">
            Bu periyotta üretici etkileşim verisi bulunamadı.
          </div>
        )}
      </div>
    </div>
  );
}

function PageLeakageSection({ pageIntel }: { readonly pageIntel: BiPageIntelligence }) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* Landing Pages */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2.5">
          <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <LogIn size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Karşılama (Landing) Sayfaları &amp; Kaydırma Kalitesi
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Oturumların başladığı ilk sayfalar, hemen çıkma ve içerik tüketim derinliği
            </p>
          </div>
        </div>

        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {pageIntel.landing_pages.map((lp) => (
            <div key={lp.path} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="min-w-0">
                <Link
                  href={lp.path || "/"}
                  target="_blank"
                  className="font-mono font-bold text-zinc-900 dark:text-zinc-100 hover:text-emerald-600 inline-flex items-center gap-1 truncate max-w-[300px]"
                >
                  <span>{lp.path}</span>
                  <ExternalLink size={11} />
                </Link>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Ort. Süre: <strong>{formatDurationSec(lp.avg_duration_sec)}</strong> • Kaydırma:{" "}
                  <strong>%{lp.avg_scroll_pct.toFixed(0)}</strong>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="font-black text-zinc-800 dark:text-zinc-200">
                  {lp.sessions.toLocaleString("tr-TR")} oturum
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                    lp.bounce_rate_pct <= 50
                      ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                      : "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300"
                  }`}
                >
                  Bounce %{lp.bounce_rate_pct.toFixed(1)}
                </span>
              </div>
            </div>
          ))}

          {pageIntel.landing_pages.length === 0 && (
            <div className="py-10 text-center text-xs text-zinc-400">
              Karşılama sayfası verisi bulunamadı.
            </div>
          )}
        </div>
      </div>

      {/* Exit / Leakage Pages */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2.5">
          <div className="p-2.5 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <DoorOpen size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Çıkış &amp; Trafik Sızıntı (Exit) Sayfaları
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Alıcıların oturumu terk etmeden önce son gördüğü sayfalar ve terk oranları
            </p>
          </div>
        </div>

        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {pageIntel.exit_pages.map((ep) => (
            <div key={ep.path} className="p-4 flex flex-col gap-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <Link
                  href={ep.path || "/"}
                  target="_blank"
                  className="font-mono font-bold text-zinc-900 dark:text-zinc-100 hover:text-rose-600 inline-flex items-center gap-1 truncate max-w-[300px]"
                >
                  <span>{ep.path}</span>
                  <ExternalLink size={11} />
                </Link>
                <span className="font-bold text-rose-700 dark:text-rose-400 shrink-0">
                  {ep.exits.toLocaleString("tr-TR")} çıkış (%{ep.exit_rate_pct.toFixed(1)})
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-rose-500"
                  style={{ width: `${Math.min(100, Math.max(4, ep.exit_rate_pct))}%` }}
                />
              </div>
            </div>
          ))}

          {pageIntel.exit_pages.length === 0 && (
            <div className="py-10 text-center text-xs text-zinc-400">
              Çıkış sayfası verisi bulunamadı.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export interface BiCatalogAndPagesTabProps {
  readonly velocity: BiProductAndBrandVelocity;
  readonly pageIntelligence: BiPageIntelligence;
}

export default function BiCatalogAndPagesTab({
  velocity,
  pageIntelligence,
}: BiCatalogAndPagesTabProps) {
  return (
    <div className="flex flex-col gap-6">
      <HotProductsTable products={velocity.hot_products} />
      <TopManufacturersCard brands={velocity.top_brands} />
      <PageLeakageSection pageIntel={pageIntelligence} />
    </div>
  );
}
