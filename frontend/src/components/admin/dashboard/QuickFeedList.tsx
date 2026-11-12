import { useState } from "react";
import { Database, RefreshCw, ChevronRight, XCircle, AlertTriangle } from "lucide-react";
import { XmlFeed, SyncRun } from "@/types/integration";
import { formatDateTime } from "@/utils/formatters";

const LABELS = {
  sectionTitle: "Tedarikçi XML Entegrasyonları",
  manageAllButton: "Hepsini Yönet",
  syncingStatusTitle: "Eşleniyor",
  activeReadyTitle: "Aktif • Hazır",
  inactiveStatusTitle: "Pasif",
  lastStatusHeader: "Son Durum:",
  lastDateHeader: "Son Tarih:",
  productCountHeader: "Aktif Ürün:",
  statusRunningMsg: "Senkronize ediliyor...",
  statusSuccessMsg: "Başarılı",
  statusFailedMsg: "Hata Alındı",
  statusActiveReadyMsg: "Aktif • Hazır",
  statusInactiveMsg: "Pasif",
  scheduledMsg: "Otomatik Planlı",
  syncNowButton: "Şimdi Senkronize Et",
  processedCardsLabel: "İşlenen Ürün Kartı:",
  imagePoolLabel: "Görsel Havuzu",
  threadUnit: " Thread",
  speedLabel: "Hız: ",
  remainingLabel: "Kalan: ",
  fileUnit: " dosya",
  parsingImagesMsg: "Görsel listeleri analiz ediliyor...",
  cancelSyncButton: "Senkronizasyonu Durdur",
  cancellingSyncMsg: "Durduruluyor...",
};

const getSafeKey = (key: string): string => {
  if (key === "__proto__" || key === "constructor" || key === "prototype") {
    throw new Error("Dangerous key detected");
  }
  return key;
};

interface FeedRuntimeMeta {
  readonly rawStatus: string;
  readonly lastSyncAt: string | null;
  readonly productCount: number | null;
}

function readStringField(record: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const val = record[key];
    if (typeof val === "string" && val.trim().length > 0) {
      return val.trim();
    }
  }
  return null;
}

function readNumberField(record: Record<string, unknown>, keys: readonly string[]): number | null {
  for (const key of keys) {
    const val = record[key];
    if (typeof val === "number" && Number.isFinite(val)) {
      return val;
    }
    if (typeof val === "string" && val.trim().length > 0) {
      const parsed = Number(val);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

function extractFeedRuntimeMeta(feed: XmlFeed): FeedRuntimeMeta {
  const record = feed as unknown as Record<string, unknown>;
  const rawStatus = (readStringField(record, ["last_sync_status", "sync_status", "status"]) ?? "").toLowerCase();
  const lastSyncAt = readStringField(record, ["last_sync_at", "last_synced_at", "synced_at", "updated_at"]);
  const productCount = readNumberField(record, ["product_count", "products_count", "total_products", "items_count"]);
  return { rawStatus, lastSyncAt, productCount };
}

interface QuickFeedListProps {
  readonly feeds: readonly XmlFeed[];
  readonly syncHistory: Readonly<Record<string, readonly SyncRun[]>>;
  readonly activeSyncing: Readonly<Record<string, string>>;
  readonly triggerSync: (feedId: string) => Promise<void>;
  readonly cancelSync: (feedId: string) => Promise<void>;
  readonly onNavigateToIntegrations: () => void;
}

function getFeedStatus(feed: XmlFeed, meta: FeedRuntimeMeta, isSyncing: boolean, lastRun?: SyncRun) {
  if (isSyncing || meta.rawStatus === "running" || meta.rawStatus === "syncing") {
    return {
      dotClass: "bg-blue-500 animate-pulse",
      title: LABELS.syncingStatusTitle,
      textClass: "text-blue-600 animate-pulse",
      text: LABELS.statusRunningMsg,
    };
  }
  const effectiveStatus = lastRun?.status?.toLowerCase() || meta.rawStatus;
  if (effectiveStatus === "success" || effectiveStatus === "completed" || effectiveStatus === "ok") {
    return {
      dotClass: "bg-emerald-500",
      title: LABELS.statusSuccessMsg,
      textClass: "text-emerald-700",
      text: LABELS.statusSuccessMsg,
    };
  }
  if (effectiveStatus === "failed" || effectiveStatus === "error") {
    return {
      dotClass: "bg-rose-500",
      title: LABELS.statusFailedMsg,
      textClass: "text-rose-700",
      text: LABELS.statusFailedMsg,
    };
  }
  if (feed.is_active !== false) {
    return {
      dotClass: "bg-emerald-500",
      title: LABELS.activeReadyTitle,
      textClass: "text-emerald-700",
      text: LABELS.statusActiveReadyMsg,
    };
  }
  return {
    dotClass: "bg-zinc-300",
    title: LABELS.inactiveStatusTitle,
    textClass: "text-zinc-600",
    text: LABELS.statusInactiveMsg,
  };
}

interface FeedSyncProgressProps {
  readonly summary: NonNullable<SyncRun["summary"]>;
}

function FeedSyncProgress({ summary }: Readonly<FeedSyncProgressProps>) {
  const imagesTotal = summary.images_total ?? 0;
  const imagesDownloaded = summary.images_downloaded ?? 0;
  const speedKbps = summary.download_speed_kbps ?? 0;
  const percentage = summary.percentage ?? 0;
  const speedText = speedKbps > 1024
    ? `${(speedKbps / 1024).toFixed(1)} MB/s`
    : `${speedKbps} KB/s`;
  const remainingFiles = Math.max(0, imagesTotal - imagesDownloaded);

  if (imagesTotal <= 0) {
    return (
      <div className="text-[10px] text-zinc-400 italic animate-pulse mt-1">
        {LABELS.parsingImagesMsg}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 mt-1.5 border-t border-blue-100/30 pt-1.5">
      <div className="flex justify-between font-bold text-zinc-700">
        <span>{LABELS.imagePoolLabel} ({summary.active_workers ?? 0}{LABELS.threadUnit}):</span>
        <span>{imagesDownloaded} / {imagesTotal}</span>
      </div>

      <div className="w-full bg-zinc-200/80 rounded-full h-1.5 overflow-hidden">
        <div
          className="bg-blue-500 h-full rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="flex justify-between text-[10px] text-zinc-400 font-mono font-bold mt-0.5">
        <span>{LABELS.speedLabel}{speedText}</span>
        <span>{LABELS.remainingLabel}{remainingFiles}{LABELS.fileUnit} ({percentage}%)</span>
      </div>
    </div>
  );
}

interface QuickFeedCardProps {
  readonly feed: XmlFeed;
  readonly history: readonly SyncRun[];
  readonly isSyncing: boolean;
  readonly isCancelling: boolean;
  readonly onCancel: (feedId: string) => Promise<void>;
  readonly onTrigger: (feedId: string) => Promise<void>;
}

function QuickFeedCard({
  feed,
  history,
  isSyncing,
  isCancelling,
  onCancel,
  onTrigger,
}: Readonly<QuickFeedCardProps>) {
  const lastRun = history[0];
  const meta = extractFeedRuntimeMeta(feed);
  const status = getFeedStatus(feed, meta, isSyncing, lastRun);
  const rawDate = lastRun?.completed_at || lastRun?.started_at || meta.lastSyncAt;
  const lastDate = rawDate ? formatDateTime(rawDate) : LABELS.scheduledMsg;
  const productCount = lastRun?.summary?.items_parsed ?? meta.productCount;

  return (
    <div className="p-4 rounded-xl border border-zinc-200/70 bg-zinc-50/50 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-200/60 mb-1 inline-block">
            {feed.alias_code}
          </span>
          <h4 className="font-bold text-zinc-900">{feed.name}</h4>
        </div>

        <span className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1 ${status.dotClass}`} title={status.title} />
      </div>

      <div className="text-xs text-zinc-500 flex flex-col gap-1 border-t border-zinc-200/50 pt-2">
        <div className="flex justify-between">
          <span>{LABELS.lastStatusHeader}</span>
          <span className={`font-semibold ${status.textClass}`}>
            {status.text}
          </span>
        </div>
        <div className="flex justify-between">
          <span>{LABELS.lastDateHeader}</span>
          <span className="font-medium text-zinc-700">
            {lastDate}
          </span>
        </div>
        {productCount !== null && productCount > 0 ? (
          <div className="flex justify-between">
            <span>{LABELS.productCountHeader}</span>
            <span className="font-semibold text-zinc-800 tabular-nums">
              {productCount.toLocaleString("tr-TR")} Model
            </span>
          </div>
        ) : null}

        {isSyncing && lastRun?.summary && (
          <div className="flex flex-col gap-2 mt-2 bg-blue-50/40 border border-blue-100/60 rounded-xl p-3 text-[11px] text-zinc-600 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex justify-between font-bold text-zinc-800">
              <span>{LABELS.processedCardsLabel}</span>
              <span>{lastRun.summary.items_parsed ?? 0}</span>
            </div>
            <FeedSyncProgress summary={lastRun.summary} />
          </div>
        )}

        {!isSyncing && lastRun?.status === "failed" && lastRun?.summary?.error && (
          <div className="flex flex-col gap-1 mt-2 bg-rose-50 border border-rose-200/80 rounded-xl p-2.5 text-[11px] text-rose-800 animate-in fade-in duration-200">
            <div className="flex items-center gap-1.5 font-bold text-rose-900">
              <AlertTriangle size={13} className="shrink-0 text-rose-600" />
              <span>Hata Ayrıntısı</span>
            </div>
            <p className="text-[10px] text-rose-700 leading-relaxed font-mono line-clamp-3 hover:line-clamp-none transition-all cursor-pointer whitespace-pre-wrap select-all">
              {lastRun.summary.error}
            </p>
          </div>
        )}
      </div>

      {isSyncing ? (
        <button
          onClick={() => { void onCancel(feed.id); }}
          disabled={isCancelling}
          type="button"
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
          onClick={() => { void onTrigger(feed.id); }}
          type="button"
          className="w-full py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100 hover:border-zinc-300 shadow-sm cursor-pointer"
        >
          <RefreshCw size={12} />
          {LABELS.syncNowButton}
        </button>
      )}
    </div>
  );
}

export default function QuickFeedList({
  feeds,
  syncHistory,
  activeSyncing,
  triggerSync,
  cancelSync,
  onNavigateToIntegrations,
}: Readonly<QuickFeedListProps>) {
  const [cancellingFeeds, setCancellingFeeds] = useState<Record<string, boolean>>({});

  const handleCancel = async (feedId: string) => {
    const safeFeedId = getSafeKey(feedId);
    const next = { ...cancellingFeeds };
    Reflect.set(next, safeFeedId, true);
    setCancellingFeeds(next);
    try {
      await cancelSync(feedId);
    } finally {
      const cleared = { ...cancellingFeeds };
      Reflect.deleteProperty(cleared, safeFeedId);
      setCancellingFeeds(cleared);
    }
  };

  return (
    <div className="lg:col-span-2 glass-card bg-white rounded-2xl p-6 flex flex-col gap-4 border border-zinc-200/80 shadow-xs">
      <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
        <h3 className="text-lg font-bold text-zinc-950 flex items-center gap-2">
          <Database size={18} className="text-[#8C6D3F]" />
          {LABELS.sectionTitle}
        </h3>
        <button
          onClick={onNavigateToIntegrations}
          type="button"
          className="text-xs font-semibold text-slate-700 hover:text-[#0F172A] flex items-center gap-1 whitespace-nowrap shrink-0"
        >
          {LABELS.manageAllButton} <ChevronRight size={14} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {feeds.map((feed) => {
          const safeFeedId = getSafeKey(feed.id);
          const history = (Reflect.get(syncHistory, safeFeedId) as SyncRun[]) || [];
          const isSyncing = Boolean(Reflect.get(activeSyncing, safeFeedId));
          const isCancelling = Boolean(Reflect.get(cancellingFeeds, safeFeedId));

          return (
            <QuickFeedCard
              key={feed.id}
              feed={feed}
              history={history}
              isSyncing={isSyncing}
              isCancelling={isCancelling}
              onCancel={handleCancel}
              onTrigger={triggerSync}
            />
          );
        })}
      </div>
    </div>
  );
}
