import { useState } from "react";
import { Database, RefreshCw, ChevronRight, XCircle } from "lucide-react";
import { XmlFeed, SyncRun } from "../../types/integration";
import { formatDateTime } from "../../utils/formatters";

// Localized labels dictionary to prevent JSX literal internationalization warnings
const LABELS = {
  sectionTitle: "Tedarikçi XML Entegrasyonları",
  manageAllButton: "Hepsini Yönet",
  maskedSuffix: " (Maskeli)",
  syncingStatusTitle: "Eşleniyor",
  noSyncStatusTitle: "Senkronizasyon Yok",
  lastStatusHeader: "Son Durum:",
  lastDateHeader: "Son Tarih:",
  statusRunningMsg: "Senkronize ediliyor...",
  statusSuccessMsg: "Başarılı",
  statusFailedMsg: "Hata Alındı",
  statusNoDataMsg: "Veri Yok",
  neverRunMsg: "Hiç çalıştırılmadı",
  syncNowButton: "Şimdi Senkronize Et",
  syncActiveButton: "Aktif...",
  processedCardsLabel: "İşlenen Ürün Kartı:",
  imagePoolLabel: "Görsel Havuzu",
  threadUnit: " Thread",
  speedLabel: "Hız: ",
  remainingLabel: "Kalan: ",
  fileUnit: " dosya",
  parsingImagesMsg: "Görsel listeleri analiz ediliyor...",
  cancelSyncButton: "Senkronizasyonu Durdur",
  cancellingSyncMsg: "Durduruluyor..."
};

// Safety guard against prototype pollution
const getSafeKey = (key: string): string => {
  if (key === "__proto__" || key === "constructor" || key === "prototype") {
    throw new Error("Dangerous key detected");
  }
  return key;
};

interface QuickFeedListProps {
  feeds: XmlFeed[];
  syncHistory: Record<string, SyncRun[]>;
  activeSyncing: Record<string, string>;
  triggerSync: (feedId: string) => Promise<void>;
  cancelSync: (feedId: string) => Promise<void>;
  onNavigateToIntegrations: () => void;
}

export default function QuickFeedList({
  feeds,
  syncHistory,
  activeSyncing,
  triggerSync,
  cancelSync,
  onNavigateToIntegrations
}: QuickFeedListProps) {
  const [cancellingFeeds, setCancellingFeeds] = useState<Record<string, boolean>>({});
  return (
    <div className="lg:col-span-2 glass-card bg-white rounded-2xl p-6 flex flex-col gap-4">
      <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
        <h3 className="text-lg font-bold text-zinc-950 flex items-center gap-2">
          <Database size={18} className="text-violet-600" />
          {LABELS.sectionTitle}
        </h3>
        <button 
          onClick={onNavigateToIntegrations}
          className="text-xs font-semibold text-violet-600 hover:text-violet-700 flex items-center gap-1"
        >
          {LABELS.manageAllButton} <ChevronRight size={14} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {feeds.map(feed => {
          const safeFeedId = getSafeKey(feed.id);
          const history = (Reflect.get(syncHistory, safeFeedId) as SyncRun[]) || [];
          const lastRun = history[0];
          const isSyncing = !!Reflect.get(activeSyncing, safeFeedId);

          return (
            <div key={feed.id} className="p-4 rounded-xl border border-zinc-200/70 bg-zinc-50/50 flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-200/60 mb-1 inline-block">
                    {feed.alias_code}{LABELS.maskedSuffix}
                  </span>
                  <h4 className="font-bold text-zinc-900">{feed.name}</h4>
                </div>
                
                {/* Status badge */}
                <span className={`w-2.5 h-2.5 rounded-full ${
                  isSyncing ? "bg-blue-500 animate-pulse" :
                  lastRun?.status === "success" ? "bg-emerald-500" :
                  lastRun?.status === "failed" ? "bg-rose-500" : "bg-zinc-300"
                }`} title={isSyncing ? LABELS.syncingStatusTitle : lastRun?.status || LABELS.noSyncStatusTitle} />
              </div>

              <div className="text-xs text-zinc-500 flex flex-col gap-1 border-t border-zinc-200/50 pt-2">
                <div className="flex justify-between">
                  <span>{LABELS.lastStatusHeader}</span>
                  <span className={`font-semibold ${
                    isSyncing ? "text-blue-600 animate-pulse" :
                    lastRun?.status === "success" ? "text-emerald-700" :
                    lastRun?.status === "failed" ? "text-rose-700" : "text-zinc-600"
                  }`}>
                    {isSyncing ? LABELS.statusRunningMsg :
                     lastRun?.status === "success" ? LABELS.statusSuccessMsg :
                     lastRun?.status === "failed" ? LABELS.statusFailedMsg : LABELS.statusNoDataMsg}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>{LABELS.lastDateHeader}</span>
                  <span className="font-medium text-zinc-700">
                    {lastRun ? formatDateTime(lastRun.completed_at || lastRun.started_at) : LABELS.neverRunMsg}
                  </span>
                </div>

                {/* Real-time Parallel Downloader & Speed Stats view */}
                {isSyncing && lastRun?.summary && (
                  <div className="flex flex-col gap-2 mt-2 bg-blue-50/40 border border-blue-100/60 rounded-xl p-3 text-[11px] text-zinc-600 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex justify-between font-bold text-zinc-800">
                      <span>{LABELS.processedCardsLabel}</span>
                      <span>{lastRun.summary.items_parsed || 0}</span>
                    </div>

                    {lastRun.summary.images_total !== undefined && lastRun.summary.images_total > 0 ? (
                      <div className="flex flex-col gap-1.5 mt-1.5 border-t border-blue-100/30 pt-1.5">
                        <div className="flex justify-between font-bold text-zinc-700">
                          <span>{LABELS.imagePoolLabel} ({lastRun.summary.active_workers || 0}{LABELS.threadUnit}):</span>
                          <span>{lastRun.summary.images_downloaded || 0} / {lastRun.summary.images_total}</span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-zinc-200/80 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-blue-500 h-full rounded-full transition-all duration-300"
                            style={{ width: `${lastRun.summary.percentage || 0}%` }}
                          />
                        </div>

                        {/* Live Speed / Stats */}
                        <div className="flex justify-between text-[10px] text-zinc-400 font-mono font-bold mt-0.5">
                          <span>{LABELS.speedLabel}{(lastRun.summary.download_speed_kbps || 0) > 1024 
                            ? `${((lastRun.summary.download_speed_kbps || 0)/1024.0).toFixed(1)} MB/s` 
                            : `${lastRun.summary.download_speed_kbps || 0} KB/s`}</span>
                          <span>{LABELS.remainingLabel}{Math.max(0, (lastRun.summary.images_total || 0) - (lastRun.summary.images_downloaded || 0))}{LABELS.fileUnit} ({lastRun.summary.percentage || 0}%)</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[10px] text-zinc-400 italic animate-pulse mt-1">
                        {LABELS.parsingImagesMsg}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {(() => {
                const isCancelling = !!Reflect.get(cancellingFeeds, safeFeedId);
                return isSyncing ? (
                  <button
                    onClick={async () => {
                      const next = { ...cancellingFeeds };
                      Reflect.set(next, safeFeedId, true);
                      setCancellingFeeds(next);
                      try {
                        await cancelSync(feed.id);
                      } finally {
                        const cleared = { ...cancellingFeeds };
                        Reflect.deleteProperty(cleared, safeFeedId);
                        setCancellingFeeds(cleared);
                      }
                    }}
                    disabled={isCancelling}
                    className="w-full py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100/70 hover:border-rose-300 shadow-sm cursor-pointer"
                  >
                    {isCancelling ? (
                      <RefreshCw size={12} className="animate-spin" />
                    ) : (
                      <XCircle size={12} />
                    )}
                    {isCancelling ? LABELS.cancellingSyncMsg : LABELS.cancelSyncButton}
                  </button>
                ) : (
                  <button
                    onClick={() => triggerSync(feed.id)}
                    className="w-full py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100 hover:border-zinc-300 shadow-sm cursor-pointer"
                  >
                    <RefreshCw size={12} />
                    {LABELS.syncNowButton}
                  </button>
                );
              })()}
            </div>
          );
        })}
      </div>
    </div>
  );
}
