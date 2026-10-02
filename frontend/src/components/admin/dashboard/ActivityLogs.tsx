"use client";

import { useState } from "react";
import { Clock, Info, Trash2, Loader2 } from "lucide-react";
import { XmlFeed, SyncRun } from "@/types/integration";
import { formatDateTime, getDuration } from "@/utils/formatters";

// Localized labels dictionary to prevent JSX literal internationalization warnings
const LABELS = {
  sectionTitle: "Son Senkronizasyon Akışı",
  statusSuccess: "Başarılı",
  statusFailed: "Başarısız",
  statusRunning: "Devam Ediyor",
  durationLabel: "Süre:",
  dateLabel: "Tarih:",
  addedLabel: "Eklenen: ",
  updatedLabel: "Güncellenen: ",
  variantLabel: "Varyant: ",
  noSyncLogs: "Kayıtlı senkronizasyon oturumu bulunmuyor."
};

interface ActivityLogsProps {
  readonly feeds: readonly XmlFeed[];
  readonly syncHistory: Readonly<Record<string, readonly SyncRun[]>>;
  readonly onClearHistory?: () => Promise<void>;
}

function getStatusBadge(status: string) {
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
    label: LABELS.statusRunning
  };
}

export default function ActivityLogs({ feeds, syncHistory, onClearHistory }: Readonly<ActivityLogsProps>) {
  const [isClearing, setIsClearing] = useState(false);

  // Sort all runs from all feeds by started_at descending and get first 5
  const recentRuns = Object.values(syncHistory)
    .flat()
    .slice()
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
    .slice(0, 5);

  const handleClear = async () => {
    if (!window.confirm("Senkronizasyon geçmişini tamamen temizlemek istediğinize emin misiniz? Devam eden aktif senkronizasyonlar korunacaktır.")) {
      return;
    }
    
    setIsClearing(true);
    try {
      if (onClearHistory) {
        await onClearHistory();
      }
    } catch (err: unknown) {
      console.error("Failed to clear sync history:", err);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="glass-card bg-white rounded-2xl p-6 flex flex-col gap-4 shadow-sm border border-zinc-200/50">
      <h3 className="text-lg font-bold text-zinc-950 flex items-center justify-between border-b border-zinc-100 pb-3">
        <div className="flex items-center gap-2">
          <Clock size={18} className="text-violet-600" />
          {LABELS.sectionTitle}
        </div>
        
        {recentRuns.some(run => run.status !== "running") && (
          <button
            onClick={() => { void handleClear(); }}
            disabled={isClearing}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition-all shrink-0 flex items-center justify-center"
            title="Tüm Geçmişi Temizle"
            type="button"
          >
            {isClearing ? <Loader2 size={15} className="animate-spin text-red-600" /> : <Trash2 size={15} />}
          </button>
        )}
      </h3>

      <div className="flex-1 overflow-y-auto max-h-[340px] pr-2 flex flex-col gap-3">
        {recentRuns.map((run) => {
          const feed = feeds.find((f) => f.id === run.feed_id);
          const statusBadge = getStatusBadge(run.status);
          return (
            <div key={run.id} className="p-3 rounded-xl bg-zinc-50 border border-zinc-200/50 flex flex-col gap-1.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="font-bold text-zinc-800">{feed?.name || run.feed_id}</span>
                <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${statusBadge.className}`}>
                  {statusBadge.label}
                </span>
              </div>
              
              <div className="text-zinc-500 flex flex-col gap-0.5 font-medium">
                <div className="flex justify-between">
                  <span>{LABELS.durationLabel}</span>
                  <span>{getDuration(run.started_at, run.completed_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{LABELS.dateLabel}</span>
                  <span>{formatDateTime(run.started_at)}</span>
                </div>
                {run.summary && (
                  <div className="mt-1.5 border-t border-zinc-200/80 pt-1.5 flex flex-wrap gap-2 text-[10px] text-zinc-600">
                    <span>{LABELS.addedLabel}<b className="text-zinc-800 font-bold">{run.summary.items_added || 0}</b></span>
                    <span>{LABELS.updatedLabel}<b className="text-zinc-800 font-bold">{run.summary.items_updated || 0}</b></span>
                    <span>{LABELS.variantLabel}<b className="text-zinc-800 font-bold">{run.summary.variants_aligned || 0}</b></span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        
        {recentRuns.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-400">
            <Info size={32} className="mb-2 text-zinc-300" />
            <p className="text-xs font-semibold">{LABELS.noSyncLogs}</p>
          </div>
        )}
      </div>
    </div>
  );
}


