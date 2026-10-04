import { RefreshCw, Clock } from "lucide-react";
import { XmlFeed, SyncRun } from "@/types/integration";
import { formatDateTime, getDuration } from "@/utils/formatters";

// Localized labels dictionary to prevent JSX literal internationalization warnings
const LABELS = {
  maskLabel: "Kod: ",
  activeLabel: "Aktif",
  passiveLabel: "Pasif",
  triggerButton: "Tetikle",
  triggeringButton: "Eşleniyor...",
  recentRunsTitle: "Son Çalışmalar",
  tableDateHeader: "Tarih",
  tableDurationHeader: "Süre",
  tableStatusHeader: "Durum",
  tableSummaryHeader: "Özet",
  statusSuccess: "Başarılı",
  statusFailed: "Hata",
  statusSyncing: "Eşliyor",
  noSyncLogs: "Henüz senkronizasyon kaydı bulunmuyor."
};

// Safety guard against prototype pollution
const getSafeKey = (key: string): string => {
  if (key === "__proto__" || key === "constructor" || key === "prototype") {
    throw new Error("Dangerous key detected");
  }
  return key;
};

interface FeedManagerProps {
  readonly feeds: readonly XmlFeed[];
  readonly syncHistory: Readonly<Record<string, readonly SyncRun[]>>;
  readonly activeSyncing: Readonly<Record<string, string>>;
  readonly triggerSync: (feedId: string) => Promise<void>;
  readonly loadingFeeds: boolean;
}

function getTriggerButtonClass(isSyncing: boolean, isActive: boolean): string {
  if (isSyncing) {
    return "bg-blue-50 text-blue-500 border border-blue-200 cursor-not-allowed";
  }
  if (isActive) {
    return "bg-zinc-900 hover:bg-zinc-800 text-white";
  }
  return "bg-zinc-100 text-zinc-400 cursor-not-allowed";
}

function getRunStatusBadge(status: string) {
  if (status === "success") {
    return {
      className: "bg-emerald-100 text-emerald-800",
      label: LABELS.statusSuccess
    };
  }
  if (status === "failed") {
    return {
      className: "bg-rose-100 text-rose-800",
      label: LABELS.statusFailed
    };
  }
  return {
    className: "bg-blue-100 text-blue-800 animate-pulse",
    label: LABELS.statusSyncing
  };
}

export default function FeedManager({
  feeds,
  syncHistory,
  activeSyncing,
  triggerSync,
  loadingFeeds
}: Readonly<FeedManagerProps>) {
  if (loadingFeeds) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map(i => (
          <div key={`loading-feed-${i}`} className="glass-card bg-white p-6 rounded-2xl h-64 animate-pulse flex flex-col gap-4">
            <div className="h-6 w-1/3 bg-zinc-200 rounded" />
            <div className="h-4 w-2/3 bg-zinc-200 rounded" />
            <div className="h-32 bg-zinc-100 rounded mt-auto" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {feeds.map((feed) => {
        const safeFeedId = getSafeKey(feed.id);
        const runs = (Reflect.get(syncHistory, safeFeedId) as SyncRun[]) || [];
        const activeRunId = Reflect.get(activeSyncing, safeFeedId) as string | undefined;
        const isSyncing = Boolean(activeRunId);

        return (
          <div key={feed.id} className="glass-card bg-white p-6 rounded-2xl flex flex-col gap-4 border-l-4 border-l-violet-600">
            {/* Top Meta info */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-bold bg-violet-100 text-violet-800 px-2 py-0.5 rounded-full uppercase">
                    {LABELS.maskLabel} {feed.alias_code}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    feed.is_active ? "bg-emerald-100 text-emerald-800" : "bg-zinc-100 text-zinc-500"
                  }`}>
                    {feed.is_active ? LABELS.activeLabel : LABELS.passiveLabel}
                  </span>
                </div>
                <h3 className="text-lg font-extrabold text-zinc-900">{feed.name}</h3>
                <p className="text-xs font-mono text-zinc-400 mt-0.5">ID: {feed.id}</p>
              </div>

              {/* Sync trigger button */}
              <button
                type="button"
                onClick={() => { void triggerSync(feed.id); }}
                disabled={isSyncing || !feed.is_active}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm ${getTriggerButtonClass(isSyncing, feed.is_active)}`}
              >
                <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />
                {isSyncing ? LABELS.triggeringButton : LABELS.triggerButton}
              </button>
            </div>

            {/* Sync History Table inside Feed */}
            <div className="flex-1 flex flex-col gap-3 mt-2">
              <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-100 pb-1.5 flex items-center gap-1.5">
                <Clock size={12} />
                {LABELS.recentRunsTitle}
              </h4>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-200 text-zinc-400 font-bold">
                      <th className="pb-2 font-semibold">{LABELS.tableDateHeader}</th>
                      <th className="pb-2 font-semibold">{LABELS.tableDurationHeader}</th>
                      <th className="pb-2 font-semibold">{LABELS.tableStatusHeader}</th>
                      <th className="pb-2 font-semibold text-right">{LABELS.tableSummaryHeader}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 text-zinc-600 font-medium">
                    {runs.slice(0, 3).map((run) => {
                      const statusBadge = getRunStatusBadge(run.status);
                      return (
                        <tr key={run.id} className="hover:bg-zinc-50/50">
                          <td className="py-2.5">{formatDateTime(run.started_at)}</td>
                          <td className="py-2.5">{getDuration(run.started_at, run.completed_at)}</td>
                          <td className="py-2.5">
                            <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] uppercase ${statusBadge.className}`}>
                              {statusBadge.label}
                            </span>
                          </td>
                          <td className="py-2.5 text-right font-semibold text-zinc-700">
                            {run.summary ? (
                              <span title={`Toplam Okunan: ${run.summary.items_parsed}`}>
                                +{run.summary.items_added ?? 0} / ~{run.summary.items_updated ?? 0}
                              </span>
                            ) : "-"}
                          </td>
                        </tr>
                      );
                    })}
                    {runs.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-zinc-400">
                          {LABELS.noSyncLogs}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

