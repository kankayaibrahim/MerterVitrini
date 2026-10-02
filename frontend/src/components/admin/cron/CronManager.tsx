"use client";

import React, { useState, useEffect, useTransition, useCallback, Fragment } from "react";
import {
  Clock,
  Play,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Zap,
  Settings,
  Database,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

interface CronSettings {
  readonly id: string;
  readonly is_active: boolean;
  readonly run_hour: number;
  readonly run_minute: number;
  readonly last_run_at: string | null;
  readonly next_run_at: string | null;
  readonly current_status: string;
  readonly last_run_status: string;
}

interface SyncedFeedDetail {
  readonly feed_id: string;
  readonly feed_name: string;
  readonly sync_run_id: string;
  readonly status: string;
  readonly items_parsed?: number;
  readonly items_added?: number;
  readonly items_updated?: number;
  readonly errors_skipped?: number;
}

interface CronLogSummary {
  readonly manual_trigger?: boolean;
  readonly xml_status?: string;
  readonly image_status?: string;
  readonly translate_status?: string;
  readonly synced_feeds_count?: number;
  readonly synced_feeds?: readonly SyncedFeedDetail[];
  readonly elapsed_time?: string;
  readonly error?: string;
}

interface CronLogItem {
  readonly id: string;
  readonly started_at: string;
  readonly completed_at: string | null;
  readonly status: string;
  readonly summary: CronLogSummary | null;
}

interface CronManagerProps {
  readonly apiUrl: string;
  readonly token: string | null;
}

function getStatusBadge(status?: string): {
  className: string;
  text: string;
  Icon: React.ComponentType<{ size: number; className?: string }>;
} {
  if (status === "success") {
    return {
      className: "bg-emerald-50 text-emerald-700 border-emerald-100",
      text: "Başarılı",
      Icon: CheckCircle2,
    };
  }
  if (status === "failed") {
    return {
      className: "bg-rose-50 text-rose-700 border-rose-100",
      text: "Hatalı",
      Icon: XCircle,
    };
  }
  if (status === "running") {
    return {
      className: "bg-violet-50 text-violet-700 border-violet-100 animate-pulse",
      text: "Çalışıyor",
      Icon: Loader2,
    };
  }
  return {
    className: "bg-zinc-100 text-zinc-500 border-zinc-200",
    text: "Beklemede",
    Icon: AlertCircle,
  };
}

function getStepStatusStyle(status?: string): {
  circleClass: string;
  iconNode: React.ReactNode;
} {
  if (status === "success") {
    return {
      circleClass: "border-emerald-500 text-emerald-500",
      iconNode: <CheckCircle2 size={11} className="fill-emerald-50" />,
    };
  }
  if (status === "running") {
    return {
      circleClass: "border-violet-500 text-violet-500 animate-pulse",
      iconNode: <Loader2 size={10} className="animate-spin" />,
    };
  }
  if (status === "failed") {
    return {
      circleClass: "border-rose-500 text-rose-500",
      iconNode: <XCircle size={11} className="fill-rose-50" />,
    };
  }
  return {
    circleClass: "border-zinc-300",
    iconNode: <div className="h-1.5 w-1.5 rounded-full bg-zinc-300" />,
  };
}

function getMiniStatusBadgeClass(status?: string): string {
  if (status === "success") return "bg-emerald-50 text-emerald-700 border border-emerald-100";
  if (status === "failed") return "bg-rose-50 text-rose-700 border border-rose-100";
  return "bg-zinc-100 text-zinc-500";
}

function getStatusDotClass(status?: string): string {
  if (status === "success") return "bg-emerald-500";
  if (status === "failed") return "bg-rose-500";
  return "bg-zinc-300";
}

function getStatusText(status?: string): string {
  if (status === "success") return "Başarılı";
  if (status === "failed") return "Hatalı";
  if (status === "running") return "Çalışıyor";
  return "Beklemede";
}

function renderLastRunStatus(status?: string): React.ReactNode {
  if (status === "success") {
    return <span className="font-bold text-emerald-600">Başarılı</span>;
  }
  if (status === "failed") {
    return <span className="font-bold text-rose-600">Hatalı</span>;
  }
  return <span className="font-bold text-zinc-500">Bulunmuyor</span>;
}

interface StepProgressItemProps {
  readonly stepNumber: number;
  readonly title: string;
  readonly description: string;
  readonly status?: string;
  readonly extraInfo?: string;
}

function StepProgressItem({
  stepNumber,
  title,
  description,
  status,
  extraInfo,
}: Readonly<StepProgressItemProps>) {
  const { circleClass, iconNode } = getStepStatusStyle(status);
  const isStepRunning = status === "running";

  return (
    <div className="relative">
      <span className={`absolute -left-[30px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full border bg-white ${circleClass}`}>
        {iconNode}
      </span>
      <div>
        <h4 className="font-bold text-zinc-800 flex items-center gap-2">
          Adım {stepNumber}: {title}
          {isStepRunning && (
            <span className="text-[9px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-md uppercase font-black">
              Aktif
            </span>
          )}
        </h4>
        <p className="text-zinc-500 mt-1">{description}</p>
        {extraInfo && (
          <span className="text-[10px] text-zinc-400 font-bold block mt-1">
            {extraInfo}
          </span>
        )}
      </div>
    </div>
  );
}

interface ActivePipelineViewProps {
  readonly isRunning: boolean;
  readonly activeLog: CronLogItem | null;
}

function ActivePipelineView({ isRunning, activeLog }: Readonly<ActivePipelineViewProps>) {
  if (!isRunning || !activeLog) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center bg-zinc-50/50 rounded-2xl border border-dashed border-zinc-200">
        <CheckCircle2 className="text-zinc-300 mb-2.5" size={36} />
        <h4 className="text-xs font-bold text-zinc-800">Zamanlayıcı Hazır & Boşta</h4>
        <p className="text-[10px] text-zinc-500 max-w-xs mt-1 leading-relaxed">
          Şu anda arka planda çalışan zamanlanmış bir görev bulunmuyor. Görev her gece belirlenen saatte otomatik olarak başlayacaktır.
        </p>
      </div>
    );
  }

  const syncedCount = activeLog.summary?.synced_feeds_count;
  const extraInfoXml = syncedCount !== undefined
    ? `Senkronize Edilen XML Beslemesi: ${syncedCount} adet`
    : undefined;

  return (
    <div className="space-y-6 py-4 animate-in fade-in duration-200">
      <div className="flex items-center gap-3 p-4 bg-violet-50/50 border border-violet-100 rounded-2xl">
        <Loader2 className="text-violet-600 animate-spin shrink-0" size={18} />
        <div className="text-xs">
          <span className="font-bold text-violet-900 block">Zamanlayıcı Görevi Sürüyor</span>
          <span className="text-violet-700 block mt-0.5">
            Başlangıç: {new Date(activeLog.started_at).toLocaleString("tr-TR")}
          </span>
        </div>
      </div>

      <div className="relative pl-6 space-y-8 border-l border-zinc-200 ml-3 py-2 text-xs">
        <StepProgressItem
          stepNumber={1}
          title="XML Entegrasyon Senkronizasyonu"
          description="Tedarikçilere ait aktif XML beslemeleri okunur ve ürün kataloğu güncellenir."
          status={activeLog.summary?.xml_status}
          extraInfo={extraInfoXml}
        />
        <StepProgressItem
          stepNumber={2}
          title="Görsel Thumbnail Boyutlandırması (Resize)"
          description="Katalogdaki yeni ürün görsellerinin eksik thumbnail (288x385, 80x106, 600x800) WebP cache dosyaları üretilir."
          status={activeLog.summary?.image_status}
        />
        <StepProgressItem
          stepNumber={3}
          title="Çok Dilli Yapay Zeka AI Çevirileri"
          description="Kataloğa yeni eklenen renkler, kumaşlar, kategoriler, ürün başlıkları ve açıklamaları eksik olan dillerde çevrilir."
          status={activeLog.summary?.translate_status}
        />
      </div>
    </div>
  );
}

interface CronSettingsCardProps {
  readonly settings: CronSettings | null;
  readonly isRunning: boolean;
  readonly isActive: boolean;
  readonly setIsActive: (active: boolean) => void;
  readonly runHour: number;
  readonly setRunHour: (hour: number) => void;
  readonly runMinute: number;
  readonly setRunMinute: (minute: number) => void;
  readonly formError: string | null;
  readonly formSuccess: string | null;
  readonly isPending: boolean;
  readonly onSaveSettings: (e: React.FormEvent) => void;
}

function CronSettingsCard({
  settings,
  isRunning,
  isActive,
  setIsActive,
  runHour,
  setRunHour,
  runMinute,
  setRunMinute,
  formError,
  formSuccess,
  isPending,
  onSaveSettings,
}: Readonly<CronSettingsCardProps>) {
  return (
    <div className="lg:col-span-1 bg-white rounded-3xl border border-zinc-200/50 p-6 shadow-sm flex flex-col gap-6 h-fit">
      <h3 className="font-bold text-base text-zinc-900 flex items-center gap-2 border-b border-zinc-100 pb-3">
        <Settings size={18} className="text-zinc-500" />
        Zamanlayıcı Ayarları
      </h3>

      <form onSubmit={onSaveSettings} className="space-y-4">
        {formError && (
          <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-xl text-xs font-semibold text-rose-600">
            ⚠️ {formError}
          </div>
        )}

        {formSuccess && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-xl text-xs font-semibold text-emerald-700">
            ✓ {formSuccess}
          </div>
        )}

        {/* Is Active Toggle */}
        <div className="flex items-center justify-between p-3.5 bg-zinc-50 rounded-2xl border border-zinc-200/40">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-zinc-800">Durum</span>
            <span className="text-[10px] text-zinc-400 font-medium mt-0.5">Zamanlayıcıyı aç veya kapat</span>
          </div>
          <button
            type="button"
            onClick={() => setIsActive(!isActive)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              isActive ? "bg-violet-600" : "bg-zinc-200"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                isActive ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Time Picker */}
        <div className="space-y-2">
          <label htmlFor="run-hour-select" className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
            Çalışma Saati (Her Gece)
          </label>
          <div className="flex gap-2 items-center">
            <div className="flex-1">
              <select
                id="run-hour-select"
                value={runHour}
                onChange={(e) => setRunHour(Number(e.target.value))}
                className="w-full px-3 py-2 border border-zinc-200 rounded-xl bg-zinc-50 text-xs font-bold focus:outline-none focus:border-violet-500 focus:bg-white"
              >
                {Array.from({ length: 24 }).map((_, i) => (
                  <option key={i} value={i}>
                    {String(i).padStart(2, "0")} Saati
                  </option>
                ))}
              </select>
            </div>
            <span className="font-extrabold text-zinc-400">:</span>
            <div className="flex-1">
              <select
                id="run-minute-select"
                aria-label="Çalışma Dakikası"
                value={runMinute}
                onChange={(e) => setRunMinute(Number(e.target.value))}
                className="w-full px-3 py-2 border border-zinc-200 rounded-xl bg-zinc-50 text-xs font-bold focus:outline-none focus:border-violet-500 focus:bg-white"
              >
                {Array.from({ length: 12 }).map((_, i) => {
                  const m = i * 5;
                  return (
                    <option key={m} value={m}>
                      {String(m).padStart(2, "0")} Dk
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        </div>

        {/* Info Metrics block */}
        <div className="pt-4 border-t border-zinc-100 space-y-3.5 text-xs">
          <div className="flex justify-between font-semibold">
            <span className="text-zinc-400">Mevcut Durum:</span>
            <span className={`font-bold capitalize ${isRunning ? "text-violet-600 animate-pulse" : "text-zinc-600"}`}>
              {isRunning ? "Çalışıyor" : "Beklemede (Boşta)"}
            </span>
          </div>
          <div className="flex justify-between font-semibold">
            <span className="text-zinc-400">Son Çalışma:</span>
            <span className="text-zinc-700">
              {settings?.last_run_at
                ? new Date(settings.last_run_at).toLocaleString("tr-TR")
                : "Hiç çalışmadı"}
            </span>
          </div>
          <div className="flex justify-between font-semibold">
            <span className="text-zinc-400">Son Durum:</span>
            {renderLastRunStatus(settings?.last_run_status)}
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full py-2.5 bg-zinc-900 text-white rounded-xl text-xs font-bold transition-all hover:bg-zinc-800 disabled:bg-zinc-300 shadow cursor-pointer flex items-center justify-center gap-1.5"
        >
          {isPending && <Loader2 size={13} className="animate-spin" />}
          Ayarları Kaydet
        </button>
      </form>
    </div>
  );
}

interface CronLogDetailViewProps {
  readonly logItem: CronLogItem;
}

function CronLogDetailView({ logItem }: Readonly<CronLogDetailViewProps>) {
  return (
    <div className="bg-white rounded-2xl border border-zinc-200/80 p-4 space-y-4 shadow-sm text-xs max-w-4xl mx-auto">
      <h4 className="font-bold text-zinc-800 text-xs flex items-center gap-1.5 pb-2 border-b border-zinc-100 justify-between">
        <span className="flex items-center gap-1.5">
          <Database size={13} className="text-violet-500" />
          Detaylı Görev Raporu
        </span>
        {logItem.summary?.elapsed_time && (
          <span className="text-[10px] text-zinc-400 font-bold">
            Toplam Süre: {logItem.summary.elapsed_time}
          </span>
        )}
      </h4>

      {/* XML Sync Details */}
      <div className="space-y-2">
        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex justify-between">
          <span>XML Entegrasyon Senkronizasyonu</span>
          <span>{logItem.summary?.synced_feeds_count || 0} aktif besleme</span>
        </div>
        {logItem.summary?.synced_feeds && logItem.summary.synced_feeds.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {logItem.summary.synced_feeds.map((feed) => {
              const feedBadge = getStatusBadge(feed.status);
              return (
                <div key={feed.sync_run_id} className="p-3 bg-zinc-50 rounded-xl border border-zinc-200/50 flex flex-col gap-1.5">
                  <div className="flex justify-between items-center font-bold">
                    <span className="text-zinc-700">{feed.feed_name}</span>
                    <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-black tracking-wider border ${feedBadge.className}`}>
                      {feedBadge.text}
                    </span>
                  </div>
                  {feed.status !== "failed" && (
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-zinc-500 font-semibold mt-1">
                      <div>Ayrıştırılan: <span className="text-zinc-800 font-bold">{feed.items_parsed ?? 0}</span></div>
                      <div>Yeni Ürün: <span className="text-emerald-600 font-bold">{feed.items_added ?? 0}</span></div>
                      <div>Güncellenen: <span className="text-blue-600 font-bold">{feed.items_updated ?? 0}</span></div>
                      <div>Atlanan Hata: <span className="text-rose-600 font-bold">{feed.errors_skipped ?? 0}</span></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-[11px] text-zinc-500 italic">
            {logItem.summary?.xml_status === "success"
              ? "XML senkronizasyon adımı tamamlandı (detaylı feed bilgisi bulunmuyor)."
              : "XML senkronizasyon adımı detayı bulunamadı."}
          </p>
        )}
      </div>

      {/* Other steps overview */}
      <div className="grid grid-cols-2 gap-4 pt-3 border-t border-zinc-100 text-[11px]">
        <div>
          <span className="text-zinc-400 block font-bold text-[9px] uppercase tracking-wider mb-1">
            Görsel Thumbnail Boyutlandırması (Resize)
          </span>
          <div className="flex items-center gap-1.5">
            <span className={`inline-block h-2 w-2 rounded-full ${getStatusDotClass(logItem.summary?.image_status)}`} />
            <span className="font-bold text-zinc-700">
              {getStatusText(logItem.summary?.image_status)}
            </span>
          </div>
        </div>
        <div>
          <span className="text-zinc-400 block font-bold text-[9px] uppercase tracking-wider mb-1">
            Çok Dilli Yapay Zeka AI Çevirileri
          </span>
          <div className="flex items-center gap-1.5">
            <span className={`inline-block h-2 w-2 rounded-full ${getStatusDotClass(logItem.summary?.translate_status)}`} />
            <span className="font-bold text-zinc-700">
              {getStatusText(logItem.summary?.translate_status)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface CronLogRowProps {
  readonly logItem: CronLogItem;
  readonly isExpanded: boolean;
  readonly onToggleExpand: () => void;
}

function CronLogRow({ logItem, isExpanded, onToggleExpand }: Readonly<CronLogRowProps>) {
  const statusBadge = getStatusBadge(logItem.status);
  const StatusIcon = statusBadge.Icon;

  return (
    <Fragment>
      <tr className="hover:bg-zinc-50/50 transition-colors">
        <td className="py-3.5 px-2 text-center">
          <button
            type="button"
            onClick={onToggleExpand}
            className="p-1 hover:bg-zinc-100 rounded-md transition-colors text-zinc-400 hover:text-zinc-600 cursor-pointer flex items-center justify-center mx-auto"
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        </td>
        <td className="py-3.5 px-4 text-zinc-800">
          {new Date(logItem.started_at).toLocaleString("tr-TR")}
        </td>
        <td className="py-3.5 px-4 text-zinc-500">
          {logItem.completed_at ? new Date(logItem.completed_at).toLocaleString("tr-TR") : "-"}
        </td>
        <td className="py-3.5 px-4 text-zinc-800">
          {logItem.summary?.elapsed_time || "-"}
        </td>
        <td className="py-3.5 px-4 text-zinc-600">
          {logItem.summary?.manual_trigger ? (
            <span className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full font-bold">
              <Zap size={9} />
              Manuel
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full font-bold">
              <Clock size={9} />
              Otomatik
            </span>
          )}
        </td>
        <td className="py-3.5 px-4">
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className={`px-2 py-0.5 rounded-md font-bold ${getMiniStatusBadgeClass(logItem.summary?.xml_status)}`}>
              XML
            </span>
            <span className={`px-2 py-0.5 rounded-md font-bold ${getMiniStatusBadgeClass(logItem.summary?.image_status)}`}>
              IMAGE
            </span>
            <span className={`px-2 py-0.5 rounded-md font-bold ${getMiniStatusBadgeClass(logItem.summary?.translate_status)}`}>
              AI
            </span>
            {logItem.summary?.error && (
              <span className="text-rose-600 font-bold truncate max-w-xs" title={logItem.summary.error}>
                Hata: {logItem.summary.error}
              </span>
            )}
          </div>
        </td>
        <td className="py-3.5 px-4 text-right">
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${statusBadge.className}`}>
            <StatusIcon size={11} className={logItem.status === "running" ? "animate-spin" : ""} />
            {statusBadge.text}
          </span>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={7} className="bg-zinc-50/60 p-4 border-b border-zinc-200/50">
            <CronLogDetailView logItem={logItem} />
          </td>
        </tr>
      )}
    </Fragment>
  );
}

export default function CronManager({ apiUrl, token }: Readonly<CronManagerProps>) {
  const [settings, setSettings] = useState<CronSettings | null>(null);
  const [logs, setLogs] = useState<CronLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Expanded logs state
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});

  const toggleExpandLog = useCallback((id: string) => {
    setExpandedLogs((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }, []);

  // Form states
  const [isActive, setIsActive] = useState(true);
  const [runHour, setRunHour] = useState(23);
  const [runMinute, setRunMinute] = useState(0);

  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const res = await fetch(`${apiUrl}/api/v1/cron/settings`, { headers });
      if (res.ok) {
        const data: CronSettings = await res.json();
        setSettings(data);
        setIsActive(data.is_active);
        setRunHour(data.run_hour);
        setRunMinute(data.run_minute);
      }
    } catch (err) {
      console.error("Failed to load cron settings:", err);
    }
  }, [apiUrl, token]);

  const fetchLogs = useCallback(async () => {
    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const res = await fetch(`${apiUrl}/api/v1/cron/logs`, { headers });
      if (res.ok) {
        const data: CronLogItem[] = await res.json();
        setLogs(data || []);
      }
    } catch (err) {
      console.error("Failed to load cron logs:", err);
    }
  }, [apiUrl, token]);

  const loadData = useCallback(async () => {
    try {
      await Promise.all([fetchSettings(), fetchLogs()]);
    } finally {
      setLoading(false);
    }
  }, [fetchSettings, fetchLogs]);

  useEffect(() => {
    void loadData();

    // Poll for status update if cron pipeline is currently running
    const interval = setInterval(() => {
      void fetchSettings();
      void fetchLogs();
    }, 4000);

    return () => clearInterval(interval);
  }, [fetchSettings, fetchLogs, loadData]);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    startTransition(async () => {
      try {
        const headers: HeadersInit = { "Content-Type": "application/json" };
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
        const res = await fetch(`${apiUrl}/api/v1/cron/settings`, {
          method: "PUT",
          headers,
          body: JSON.stringify({
            is_active: isActive,
            run_hour: Number(runHour),
            run_minute: Number(runMinute),
          }),
        });

        if (!res.ok) {
          throw new Error("Ayarlar kaydedilirken hata oluştu.");
        }

        setFormSuccess("Zamanlayıcı ayarları başarıyla güncellendi.");
        void fetchSettings();
      } catch (err: unknown) {
        setFormError((err as Error).message || "Bilinmeyen bir hata oluştu.");
      }
    });
  };

  const handleTriggerManual = async () => {
    if (settings?.current_status === "running") return;
    if (
      !window.confirm(
        "Zamanlanmış tüm görevler zincirini (XML Senkronizasyon -> Görsel Boyutlandırma -> Çeviriler) şu anda arka planda başlatmak istediğinize emin misiniz?"
      )
    ) {
      return;
    }

    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const res = await fetch(`${apiUrl}/api/v1/cron/trigger`, {
        method: "POST",
        headers,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Tetikleme başarısız oldu.");
      }

      setFormSuccess("Görev zinciri başarıyla tetiklendi. Arka planda çalışıyor...");
      void fetchSettings();
      void fetchLogs();
    } catch (err: unknown) {
      setFormError((err as Error).message || "Tetikleme işlemi sırasında bir hata oluştu.");
    }
  };

  if (loading && !settings) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 size={32} className="text-violet-600 animate-spin" />
        <span className="text-xs font-semibold text-zinc-400">Yükleniyor...</span>
      </div>
    );
  }

  const isRunning = settings?.current_status === "running";
  const activeLog = isRunning ? logs[0] : null;

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in duration-200">
      {/* Header Panel */}
      <div className="glass-card bg-white p-6 rounded-3xl border border-zinc-200/50 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
            <Clock className="text-violet-600 animate-spin-slow" size={22} />
            Zamanlanmış Görevler (Cron Scheduler)
          </h2>
          <p className="text-sm text-zinc-500 mt-1">
            XML senkronizasyonu, eksik görsel önbellek boyutlandırması ve AI yapay zeka çeviri işlemlerini otomatik sırayla çalıştırır.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
          <button
            onClick={() => void loadData()}
            className="p-2.5 border border-zinc-200 rounded-xl hover:bg-zinc-50 text-zinc-600 transition-colors bg-white shadow-sm flex items-center justify-center gap-1.5 text-sm font-semibold cursor-pointer"
            type="button"
          >
            <RefreshCw size={15} />
            Yenile
          </button>

          <button
            onClick={() => void handleTriggerManual()}
            disabled={isRunning}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm shadow-md transition-all cursor-pointer ${
              isRunning
                ? "bg-zinc-100 text-zinc-400 border border-zinc-200 cursor-not-allowed"
                : "bg-violet-600 hover:bg-violet-700 text-white hover:shadow-lg hover:shadow-violet-600/10"
            }`}
            type="button"
          >
            {isRunning ? (
              <Loader2 size={16} className="animate-spin text-zinc-400" />
            ) : (
              <Play size={16} />
            )}
            Şimdi Tetikle (Manuel)
          </button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <CronSettingsCard
          settings={settings}
          isRunning={isRunning}
          isActive={isActive}
          setIsActive={setIsActive}
          runHour={runHour}
          setRunHour={setRunHour}
          runMinute={runMinute}
          setRunMinute={setRunMinute}
          formError={formError}
          formSuccess={formSuccess}
          isPending={isPending}
          onSaveSettings={handleSaveSettings}
        />

        {/* Right Active / History status visualizer */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-zinc-200/50 p-6 shadow-sm flex flex-col gap-6">
          <h3 className="font-bold text-base text-zinc-900 flex items-center gap-2 border-b border-zinc-100 pb-3">
            <Zap size={18} className="text-amber-500" />
            Aktif İşlem Akışı & Pipeline
          </h3>

          <ActivePipelineView isRunning={isRunning} activeLog={activeLog} />
        </div>
      </div>

      {/* Logs Table Section */}
      <div className="bg-white rounded-3xl border border-zinc-200/50 p-6 shadow-sm">
        <h3 className="font-bold text-base text-zinc-900 flex items-center gap-2 border-b border-zinc-100 pb-3 mb-4">
          <Database size={18} className="text-zinc-500" />
          Geçmiş Çalışma Günlüğü (Son 50)
        </h3>

        <div className="border border-zinc-200/60 rounded-2xl overflow-hidden bg-zinc-50/20 max-h-[30rem] overflow-y-auto">
          <table className="w-full border-collapse text-left">
            <thead className="bg-zinc-50 border-b border-zinc-200/60 text-zinc-500 font-extrabold text-[10px] uppercase tracking-wider sticky top-0 z-10">
              <tr>
                <th className="w-10 py-3 px-2"></th>
                <th className="py-3 px-4">Başlangıç Tarihi</th>
                <th className="py-3 px-4">Bitiş Tarihi</th>
                <th className="py-3 px-4">Süre</th>
                <th className="py-3 px-4">Tetikleme</th>
                <th className="py-3 px-4">Görev Detayları (XML | Image | AI)</th>
                <th className="py-3 px-4 text-right">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200/50 text-xs font-semibold text-zinc-700">
              {logs.length > 0 ? (
                logs.map((logItem) => (
                  <CronLogRow
                    key={logItem.id}
                    logItem={logItem}
                    isExpanded={!!expandedLogs[logItem.id]}
                    onToggleExpand={() => toggleExpandLog(logItem.id)}
                  />
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-400">
                    <AlertCircle size={28} className="mx-auto text-zinc-300 mb-2" />
                    <span className="font-semibold">Henüz çalışma kaydı bulunmuyor.</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
