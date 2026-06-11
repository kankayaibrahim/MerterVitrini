"use client";

import { useState, useEffect, useTransition } from "react";
import {
  Clock,
  Play,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar,
  Zap,
  Settings,
  Database,
  Sparkles,
  Image as ImageIcon,
  Loader2,
  RefreshCw
} from "lucide-react";

interface CronSettings {
  id: string;
  is_active: boolean;
  run_hour: number;
  run_minute: number;
  last_run_at: string | null;
  next_run_at: string | null;
  current_status: string;
  last_run_status: string;
}

interface CronLogItem {
  id: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  summary: {
    manual_trigger?: boolean;
    xml_status?: string;
    image_status?: string;
    translate_status?: string;
    synced_feeds_count?: number;
    elapsed_time?: string;
    error?: string;
  } | null;
}

interface CronManagerProps {
  apiUrl: string;
  token: string | null;
}

export default function CronManager({ apiUrl, token }: CronManagerProps) {
  const [settings, setSettings] = useState<CronSettings | null>(null);
  const [logs, setLogs] = useState<CronLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Form states
  const [isActive, setIsActive] = useState(true);
  const [runHour, setRunHour] = useState(23);
  const [runMinute, setRunMinute] = useState(0);

  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const fetchSettings = async () => {
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
  };

  const fetchLogs = async () => {
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
  };

  const loadData = async () => {
    setLoading(true);
    await Promise.all([fetchSettings(), fetchLogs()]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    
    // Poll for status update if cron pipeline is currently running
    const interval = setInterval(() => {
      fetchSettings();
      fetchLogs();
    }, 4000);

    return () => clearInterval(interval);
  }, [apiUrl, token]);

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
        fetchSettings();
      } catch (err: any) {
        setFormError(err.message || "Bilinmeyen bir hata oluştu.");
      }
    });
  };

  const handleTriggerManual = async () => {
    if (settings?.current_status === "running") return;
    if (!window.confirm("Zamanlanmış tüm görevler zincirini (XML Senkronizasyon -> Görsel Boyutlandırma -> Çeviriler) şu anda arka planda başlatmak istediğinize emin misiniz?")) {
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
      fetchSettings();
      fetchLogs();
    } catch (err: any) {
      setFormError(err.message || "Tetikleme işlemi sırasında bir hata oluştu.");
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
            onClick={loadData}
            className="p-2.5 border border-zinc-200 rounded-xl hover:bg-zinc-50 text-zinc-600 transition-colors bg-white shadow-sm flex items-center justify-center gap-1.5 text-sm font-semibold cursor-pointer"
            type="button"
          >
            <RefreshCw size={15} />
            Yenile
          </button>

          <button
            onClick={handleTriggerManual}
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
        
        {/* Left Form Settings Card */}
        <div className="lg:col-span-1 bg-white rounded-3xl border border-zinc-200/50 p-6 shadow-sm flex flex-col gap-6 h-fit">
          <h3 className="font-bold text-base text-zinc-900 flex items-center gap-2 border-b border-zinc-100 pb-3">
            <Settings size={18} className="text-zinc-500" />
            Zamanlayıcı Ayarları
          </h3>

          <form onSubmit={handleSaveSettings} className="space-y-4">
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
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                Çalışma Saati (Her Gece)
              </label>
              <div className="flex gap-2 items-center">
                <div className="flex-1">
                  <select
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
                <span
                  className={`font-bold inline-flex items-center gap-1 ${
                    settings?.last_run_status === "success"
                      ? "text-emerald-600"
                      : settings?.last_run_status === "failed"
                      ? "text-rose-600"
                      : "text-zinc-500"
                  }`}
                >
                  {settings?.last_run_status === "success" ? (
                    <>Başarılı</>
                  ) : settings?.last_run_status === "failed" ? (
                    <>Hatalı</>
                  ) : (
                    <>Bulunmuyor</>
                  )}
                </span>
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

        {/* Right Active / History status visualizer */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-zinc-200/50 p-6 shadow-sm flex flex-col gap-6">
          <h3 className="font-bold text-base text-zinc-900 flex items-center gap-2 border-b border-zinc-100 pb-3">
            <Zap size={18} className="text-amber-500" />
            Aktif İşlem Akışı & Pipeline
          </h3>

          {isRunning && activeLog ? (
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

              {/* Progress Steps List */}
              <div className="relative pl-6 space-y-8 border-l border-zinc-200 ml-3 py-2 text-xs">
                
                {/* Step 1: XML Parser */}
                <div className="relative">
                  <span className={`absolute -left-[30px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full border bg-white ${
                    activeLog.summary?.xml_status === "success" ? "border-emerald-500 text-emerald-500" :
                    activeLog.summary?.xml_status === "running" ? "border-violet-500 text-violet-500 animate-pulse" :
                    activeLog.summary?.xml_status === "failed" ? "border-rose-500 text-rose-500" : "border-zinc-300"
                  }`}>
                    {activeLog.summary?.xml_status === "success" ? <CheckCircle2 size={11} className="fill-emerald-50" /> :
                     activeLog.summary?.xml_status === "running" ? <Loader2 size={10} className="animate-spin" /> :
                     activeLog.summary?.xml_status === "failed" ? <XCircle size={11} className="fill-rose-50" /> :
                     <div className="h-1.5 w-1.5 rounded-full bg-zinc-300" />}
                  </span>
                  <div>
                    <h4 className="font-bold text-zinc-800 flex items-center gap-2">
                      Adım 1: XML Entegrasyon Senkronizasyonu
                      {activeLog.summary?.xml_status === "running" && (
                        <span className="text-[9px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-md uppercase font-black">Aktif</span>
                      )}
                    </h4>
                    <p className="text-zinc-500 mt-1">
                      Tedarikçilere ait aktif XML beslemeleri okunur ve ürün kataloğu güncellenir.
                    </p>
                    {activeLog.summary?.synced_feeds_count !== undefined && (
                      <span className="text-[10px] text-zinc-400 font-bold block mt-1">
                        Senkronize Edilen XML Beslemesi: {activeLog.summary.synced_feeds_count} adet
                      </span>
                    )}
                  </div>
                </div>

                {/* Step 2: Resizing */}
                <div className="relative">
                  <span className={`absolute -left-[30px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full border bg-white ${
                    activeLog.summary?.image_status === "success" ? "border-emerald-500 text-emerald-500" :
                    activeLog.summary?.image_status === "running" ? "border-violet-500 text-violet-500 animate-pulse" :
                    activeLog.summary?.image_status === "failed" ? "border-rose-500 text-rose-500" : "border-zinc-300"
                  }`}>
                    {activeLog.summary?.image_status === "success" ? <CheckCircle2 size={11} className="fill-emerald-50" /> :
                     activeLog.summary?.image_status === "running" ? <Loader2 size={10} className="animate-spin" /> :
                     activeLog.summary?.image_status === "failed" ? <XCircle size={11} className="fill-rose-50" /> :
                     <div className="h-1.5 w-1.5 rounded-full bg-zinc-300" />}
                  </span>
                  <div>
                    <h4 className="font-bold text-zinc-800 flex items-center gap-2">
                      Adım 2: Görsel Thumbnail Boyutlandırması (Resize)
                      {activeLog.summary?.image_status === "running" && (
                        <span className="text-[9px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-md uppercase font-black">Aktif</span>
                      )}
                    </h4>
                    <p className="text-zinc-500 mt-1">
                      Katalogdaki yeni ürün görsellerinin eksik thumbnail (288x385, 80x106, 600x800) WebP cache dosyaları üretilir.
                    </p>
                  </div>
                </div>

                {/* Step 3: Translations */}
                <div className="relative">
                  <span className={`absolute -left-[30px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full border bg-white ${
                    activeLog.summary?.translate_status === "success" ? "border-emerald-500 text-emerald-500" :
                    activeLog.summary?.translate_status === "running" ? "border-violet-500 text-violet-500 animate-pulse" :
                    activeLog.summary?.translate_status === "failed" ? "border-rose-500 text-rose-500" : "border-zinc-300"
                  }`}>
                    {activeLog.summary?.translate_status === "success" ? <CheckCircle2 size={11} className="fill-emerald-50" /> :
                     activeLog.summary?.translate_status === "running" ? <Loader2 size={10} className="animate-spin" /> :
                     activeLog.summary?.translate_status === "failed" ? <XCircle size={11} className="fill-rose-50" /> :
                     <div className="h-1.5 w-1.5 rounded-full bg-zinc-300" />}
                  </span>
                  <div>
                    <h4 className="font-bold text-zinc-800 flex items-center gap-2">
                      Adım 3: Çok Dilli Yapay Zeka AI Çevirileri
                      {activeLog.summary?.translate_status === "running" && (
                        <span className="text-[9px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-md uppercase font-black">Aktif</span>
                      )}
                    </h4>
                    <p className="text-zinc-500 mt-1">
                      Kataloğa yeni eklenen renkler, kumaşlar, kategoriler, ürün başlıkları ve açıklamaları eksik olan dillerde çevrilir.
                    </p>
                  </div>
                </div>

              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center bg-zinc-50/50 rounded-2xl border border-dashed border-zinc-200">
              <CheckCircle2 className="text-zinc-300 mb-2.5" size={36} />
              <h4 className="text-xs font-bold text-zinc-800">Zamanlayıcı Hazır & Boşta</h4>
              <p className="text-[10px] text-zinc-500 max-w-xs mt-1 leading-relaxed">
                Şu anda arka planda çalışan zamanlanmış bir görev bulunmuyor. Görev her gece belirlenen saatte otomatik olarak başlayacaktır.
              </p>
            </div>
          )}
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
                  <tr key={logItem.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="py-3.5 px-4 text-zinc-800">
                      {new Date(logItem.started_at).toLocaleString("tr-TR")}
                    </td>
                    <td className="py-3.5 px-4 text-zinc-500">
                      {logItem.completed_at
                        ? new Date(logItem.completed_at).toLocaleString("tr-TR")
                        : "-"}
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
                        <span className={`px-2 py-0.5 rounded-md font-bold ${
                          logItem.summary?.xml_status === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
                          logItem.summary?.xml_status === "failed" ? "bg-rose-50 text-rose-700 border border-rose-100" : "bg-zinc-100 text-zinc-500"
                        }`}>
                          XML
                        </span>
                        <span className={`px-2 py-0.5 rounded-md font-bold ${
                          logItem.summary?.image_status === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
                          logItem.summary?.image_status === "failed" ? "bg-rose-50 text-rose-700 border border-rose-100" : "bg-zinc-100 text-zinc-500"
                        }`}>
                          IMAGE
                        </span>
                        <span className={`px-2 py-0.5 rounded-md font-bold ${
                          logItem.summary?.translate_status === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
                          logItem.summary?.translate_status === "failed" ? "bg-rose-50 text-rose-700 border border-rose-100" : "bg-zinc-100 text-zinc-500"
                        }`}>
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
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                        logItem.status === "success"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                          : logItem.status === "failed"
                          ? "bg-rose-50 text-rose-700 border-rose-100"
                          : "bg-violet-50 text-violet-700 border-violet-100 animate-pulse"
                      }`}>
                        {logItem.status === "success" ? (
                          <>
                            <CheckCircle2 size={11} />
                            Başarılı
                          </>
                        ) : logItem.status === "failed" ? (
                          <>
                            <XCircle size={11} />
                            Hatalı
                          </>
                        ) : (
                          <>
                            <Loader2 size={11} className="animate-spin" />
                            Çalışıyor
                          </>
                        )}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-400">
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
