"use client";

import React from "react";
import {
  Archive,
  BarChart3,
  Loader2,
  PackageMinus,
  PackagePlus,
  RefreshCw,
  Send,
  ShoppingBag,
  ShoppingCart,
  Trash2,
  UserPlus,
} from "lucide-react";
import { DailyDigestPreviewDTO } from "./types";

interface DailyDigestLiveCardProps {
  readonly preview: DailyDigestPreviewDTO | null;
  readonly loading: boolean;
  readonly sendingDigest: boolean;
  readonly onRefresh: () => void;
  readonly onSendNow: () => void;
}

interface DigestStatTileProps {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly value: number;
  readonly sub: string;
  readonly accentClass: string;
}

function DigestStatTile({ icon, label, value, sub, accentClass }: DigestStatTileProps) {
  return (
    <div className="p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/70 flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400">{label}</span>
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${accentClass}`}>
          {icon}
        </span>
      </div>
      <div className="text-xl font-black text-zinc-950 dark:text-white tracking-tight">
        {value.toLocaleString("tr-TR")}
      </div>
      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">{sub}</div>
    </div>
  );
}

export default function DailyDigestLiveCard({
  preview,
  loading,
  sendingDigest,
  onRefresh,
  onSendNow,
}: DailyDigestLiveCardProps) {
  const reportDateLabel = preview?.report_date_formatted || "Bugün";
  const generatedLabel = preview?.generated_at ? `Saat ${preview.generated_at} itibarıyla canlı veri` : "Canlı istatistikler yükleniyor";

  return (
    <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-6 shadow-xs flex flex-col gap-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-600 flex items-center justify-center shrink-0">
            <BarChart3 size={20} />
          </div>
          <div>
            <h2 className="text-base font-bold text-zinc-950 dark:text-white">
              Bugünün Canlı Günlük Özet Verisi ({reportDateLabel})
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {generatedLabel} — Planlanan saatte e-posta olarak iletilecek gerçek metrikler.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-200 inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            <span>Yenile</span>
          </button>

          <button
            type="button"
            onClick={onSendNow}
            disabled={sendingDigest || loading}
            className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
          >
            {sendingDigest ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Gönderiliyor...</span>
              </>
            ) : (
              <>
                <Send size={14} />
                <span>Günlük Özeti Şimdi Gönder</span>
              </>
            )}
          </button>
        </div>
      </div>

      {preview ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <DigestStatTile
            icon={<UserPlus size={15} />}
            label="Bugün Kaydolan Üye"
            value={preview.new_customers_today}
            sub={`Toplam ${preview.total_active_customers.toLocaleString("tr-TR")} aktif üye`}
            accentClass="bg-sky-500/10 text-sky-600"
          />
          <DigestStatTile
            icon={<ShoppingBag size={15} />}
            label="Bugün Gelen Sipariş"
            value={preview.new_orders_today}
            sub={`Ciro: ${preview.orders_revenue_formatted} • Talep: ${preview.inquiries_today}`}
            accentClass="bg-emerald-500/10 text-emerald-600"
          />
          <DigestStatTile
            icon={<PackagePlus size={15} />}
            label="Bugün Eklenen Ürün"
            value={preview.products_added_today}
            sub={`Yayında toplam ${preview.total_active_products.toLocaleString("tr-TR")} ürün`}
            accentClass="bg-violet-500/10 text-violet-600"
          />
          <DigestStatTile
            icon={<PackageMinus size={15} />}
            label="Bugün Kapatılan / Pasif"
            value={preview.products_deactivated_today}
            sub={`Arşiv: ${preview.products_archived_today} • Silinen: ${preview.products_deleted_today}`}
            accentClass="bg-amber-500/10 text-amber-600"
          />
          <DigestStatTile
            icon={<Trash2 size={15} />}
            label="Bugün Silinen Ürün"
            value={preview.products_deleted_today}
            sub="Kalıcı + soft silme işlemleri"
            accentClass="bg-rose-500/10 text-rose-600"
          />
          <DigestStatTile
            icon={<Archive size={15} />}
            label="Bugün Arşivlenen Ürün"
            value={preview.products_archived_today}
            sub="Eski sezon arşivine taşınan"
            accentClass="bg-zinc-500/10 text-zinc-600 dark:text-zinc-300"
          />
          <DigestStatTile
            icon={<ShoppingCart size={15} />}
            label="Bekleyen Açık Sepet"
            value={preview.active_unfinished_carts}
            sub="Sepeti tamamlanmamış müşteri"
            accentClass="bg-indigo-500/10 text-indigo-600"
          />
          <DigestStatTile
            icon={<RefreshCw size={15} />}
            label="Bugünkü XML Sync"
            value={preview.xml_syncs_completed_today}
            sub={`Hatalı: ${preview.xml_syncs_failed_today} • Tedarikçi Başvuru: ${preview.supplier_applications_today}`}
            accentClass="bg-teal-500/10 text-teal-600"
          />
        </div>
      ) : (
        <div className="py-8 flex items-center justify-center gap-2 text-xs font-semibold text-zinc-400">
          <Loader2 size={16} className="animate-spin text-violet-600" />
          <span>Günlük özet metrikleri hesaplanıyor...</span>
        </div>
      )}
    </div>
  );
}
