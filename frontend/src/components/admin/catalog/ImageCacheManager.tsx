"use client";

import React, { useState, useEffect, useTransition, useCallback } from "react";
import { 
  Image as ImageIcon, 
  RefreshCw, 
  Play, 
  CheckCircle, 
  AlertTriangle, 
  Loader2, 
  Clock, 
  Check, 
  Info,
  Search,
  Ban
} from "lucide-react";

interface ImageCacheManagerProps {
  readonly apiUrl: string;
  readonly token: string | null;
}

interface BulkStatus {
  is_running: boolean;
  total_jobs: number;
  completed: number;
  failed: number;
  elapsed_time: string;
}

const LABELS = {
  TITLE: "Görsel Önbellek & Boyutlandırma Yönetimi",
  DESC: "Ürünlerinizin storefront (beğeni, sepet, detay ve listeleme) sayfalarında hızlı yüklenmesi için optimize edilen WebP boyutlarının önbellek durumunu takip edip eksikleri arka planda (4 paralel iş parçacığıyla) ürettirebilirsiniz.",
  BTN_START: "Eksik Görselleri Taramaya & Üretmeye Başla",
  BTN_REFRESH: "Durumu Yenile",
  BTN_SCAN: "Eksik Görselleri Tara",
  BTN_STOP: "İşlemi Durdur",
  STATUS_RUNNING: "Kuyruk İşleniyor",
  STATUS_IDLE: "Beklemede / Tamamlandı",
  STAT_COMPLETED: "Tamamlanan",
  STAT_FAILED: "Başarısız",
  STAT_TOTAL: "Toplam Kuyruk İş Boyutu",
  STAT_ELAPSED: "Geçen Süre",
  ALLOWED_SIZES_TITLE: "Kullanılan Standart Boyutlar",
  SIZE_DETAIL_1: "288x385 - Katalog / Kategori Listesi",
  SIZE_DETAIL_2: "80x106 - Sepet ve Özet Listeler",
  SIZE_DETAIL_3: "600x800 - Ürün Detay Sayfası",
  INFO_THREAD_LIMIT: "Sunucu kaynaklarının tükenmesini önlemek amacıyla, görsel boyutlandırma işlemi arka planda en fazla 4 paralel thread (iş parçacığı) kullanacak şekilde Go seviyesinde kısıtlanmıştır.",
};

export default function ImageCacheManager({ apiUrl, token }: Readonly<ImageCacheManagerProps>) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<BulkStatus>({
    is_running: false,
    total_jobs: 0,
    completed: 0,
    failed: 0,
    elapsed_time: ""
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scannedMissingCount, setScannedMissingCount] = useState<number | null>(null);
  const [isStopping, setIsStopping] = useState<boolean>(false);

  // API Request Helper
  const apiRequest = useCallback(async (path: string, method: string, body?: unknown) => {
    const headers = new Headers({
      "Content-Type": "application/json"
    });
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(`${apiUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${response.status}`);
    }

    return response.json();
  }, [apiUrl, token]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Load Status
  const getStatus = useCallback(async () => {
    try {
      const data = await apiRequest("/api/v1/store/images/bulk-status", "GET");
      setStatus(data);
    } catch (err: unknown) {
      console.error("Failed to load bulk resize status:", err);
      setErrorMessage((err as Error).message || "Durum bilgisi alınamadı.");
    }
  }, [apiRequest]);

  // Start Bulk Resize
  const handleStartResize = () => {
    setErrorMessage(null);
    setScannedMissingCount(null);
    startTransition(async () => {
      try {
        const data = await apiRequest("/api/v1/store/images/bulk-resize", "POST");
        showToast(data.message || "Görsel tarama ve kuyruk üretimi başlatıldı.");
        await getStatus();
      } catch (err: unknown) {
        setErrorMessage((err as Error).message || "İşlem başlatılamadı.");
      }
    });
  };

  // Scan for missing images
  const handleScan = async () => {
    setErrorMessage(null);
    setIsScanning(true);
    try {
      const data = await apiRequest("/api/v1/store/images/scan-missing", "GET");
      setScannedMissingCount(data.missing_count);
      showToast(`Tarama tamamlandı: Cache'de olmayan ${data.missing_count} adet görsel boyutu tespit edildi.`);
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || "Tarama işlemi başarısız oldu.");
    } finally {
      setIsScanning(false);
    }
  };

  // Stop Bulk Resize
  const handleStopResize = async () => {
    setErrorMessage(null);
    setIsStopping(true);
    try {
      const data = await apiRequest("/api/v1/store/images/bulk-stop", "POST");
      showToast(data.message || "Görsel boyutlandırma işlemi durduruldu.");
      await getStatus();
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || "İşlem durdurulamadı.");
    } finally {
      setIsStopping(false);
    }
  };

  const handleRefresh = () => {
    startTransition(async () => {
      await getStatus();
    });
  };

  // Fetch status on mount
  useEffect(() => {
    let isMounted = true;
    const loadInitialStatus = async () => {
      try {
        const data = await apiRequest("/api/v1/store/images/bulk-status", "GET");
        if (isMounted) {
          setStatus(data);
        }
      } catch (err: unknown) {
        if (isMounted) {
          console.error("Failed to load bulk resize status:", err);
          setErrorMessage((err as Error).message || "Durum bilgisi alınamadı.");
        }
      }
    };
    void loadInitialStatus();
    return () => {
      isMounted = false;
    };
  }, [apiRequest]);

  // Poll status while job is running
  useEffect(() => {
    if (!status.is_running) return;
    const intervalId = setInterval(() => {
      void getStatus();
    }, 2000);
    return () => {
      clearInterval(intervalId);
    };
  }, [status.is_running, getStatus]);

  const processed = status.completed + status.failed;
  const progressPercent = status.total_jobs > 0 
    ? Math.min(Math.round((processed / status.total_jobs) * 100), 100) 
    : 0;

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in duration-200 text-zinc-800 dark:text-zinc-200">
      {/* Top Banner */}
      <div className="glass-card bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
            <ImageIcon className="text-violet-600 dark:text-violet-400 animate-pulse" size={24} />
            {LABELS.TITLE}
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{LABELS.DESC}</p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
          <button
            onClick={handleRefresh}
            disabled={isPending || isScanning || isStopping}
            className="p-2.5 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors bg-white dark:bg-zinc-900 shadow-xs flex items-center justify-center gap-1.5 text-sm font-semibold cursor-pointer"
            type="button"
          >
            <RefreshCw size={15} className={isPending || status.is_running ? "animate-spin" : ""} />
            {LABELS.BTN_REFRESH}
          </button>

          <button
            onClick={handleScan}
            disabled={isPending || isScanning || isStopping || status.is_running}
            className="p-2.5 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors bg-white dark:bg-zinc-900 shadow-xs flex items-center justify-center gap-1.5 text-sm font-semibold cursor-pointer"
            type="button"
          >
            {isScanning ? (
              <Loader2 size={15} className="animate-spin text-zinc-500 dark:text-zinc-400" />
            ) : (
              <Search size={15} />
            )}
            {LABELS.BTN_SCAN}
          </button>

          {status.is_running ? (
            <button
              onClick={handleStopResize}
              disabled={isPending || isStopping}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm shadow-md bg-red-600 hover:bg-red-700 text-white hover:shadow-lg hover:shadow-red-600/10 transition-all cursor-pointer"
              type="button"
            >
              {isStopping ? <Loader2 size={16} className="animate-spin" /> : <Ban size={16} />}
              {LABELS.BTN_STOP}
            </button>
          ) : (
            <button
              onClick={handleStartResize}
              disabled={isPending || isScanning}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm shadow-md bg-violet-600 hover:bg-violet-700 text-white hover:shadow-lg hover:shadow-violet-600/10 transition-all cursor-pointer"
              type="button"
            >
              {isPending ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              {LABELS.BTN_START}
            </button>
          )}
        </div>
      </div>

      {/* Success alert toast */}
      {toastMessage && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl animate-in fade-in slide-in-from-top-4 duration-300 shadow-sm">
          <Check size={18} className="text-emerald-600 shrink-0" />
          <span className="text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-2xl text-xs font-semibold">
          <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Scan Result Info Card */}
      {scannedMissingCount !== null && !status.is_running && (
        <div className="flex items-start justify-between gap-4 bg-violet-50/60 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/40 p-5 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300 shadow-xs">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center text-violet-600 dark:text-violet-400 shrink-0">
              <Search size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-violet-950 dark:text-violet-200">Önbellek Tarama Sonucu</h4>
              <p className="text-xs text-violet-700/80 dark:text-violet-300/80 mt-0.5 leading-relaxed">
                Yapılan taramada, sisteme kayıtlı ürün görsellerinden standart boyutlarda üretilmemiş (cache&apos;de olmayan) toplam <strong className="text-violet-950 dark:text-white font-black">{scannedMissingCount}</strong> adet WebP görsel boyutu tespit edilmiştir. Aşağıdaki butondan eksikleri üretmeye başlayabilirsiniz.
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={() => setScannedMissingCount(null)}
            className="text-xs font-bold text-violet-500 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-200 transition-colors shrink-0 cursor-pointer"
          >
            Temizle
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Panel (Left) */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-6 shadow-xs flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Mevcut İşlem Durumu
            </h3>
            {status.is_running ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-amber-700 dark:text-amber-300 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                {LABELS.STATUS_RUNNING}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300">
                <CheckCircle size={14} className="text-emerald-500" />
                {LABELS.STATUS_IDLE}
              </span>
            )}
          </div>

          {/* Progress Bar */}
          {status.is_running && (
            <div className="flex flex-col gap-2 bg-zinc-50/80 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800 p-5 rounded-2xl">
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-zinc-500 dark:text-zinc-400">Kuyruk İlerleme Durumu</span>
                <span className="text-violet-600 dark:text-violet-400 font-mono">{progressPercent}% ({processed} / {status.total_jobs})</span>
              </div>
              <div className="w-full bg-zinc-200 dark:bg-zinc-700 h-2.5 rounded-full overflow-hidden">
                <div 
                  className="bg-violet-600 dark:bg-violet-500 h-full transition-all duration-500 ease-out rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-zinc-50/70 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800 p-4 rounded-2xl flex flex-col gap-1">
              <span className="text-[10px] font-extrabold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                {LABELS.STAT_COMPLETED}
              </span>
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                {status.completed}
              </span>
            </div>

            <div className="bg-zinc-50/70 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800 p-4 rounded-2xl flex flex-col gap-1">
              <span className="text-[10px] font-extrabold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                {LABELS.STAT_FAILED}
              </span>
              <span className="text-2xl font-black text-red-500 dark:text-red-400 font-mono">
                {status.failed}
              </span>
            </div>

            <div className="bg-zinc-50/70 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800 p-4 rounded-2xl flex flex-col gap-1">
              <span className="text-[10px] font-extrabold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                {LABELS.STAT_TOTAL}
              </span>
              <span className="text-2xl font-black text-zinc-900 dark:text-white font-mono">
                {status.total_jobs}
              </span>
            </div>

            <div className="bg-zinc-50/70 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800 p-4 rounded-2xl flex flex-col gap-1">
              <span className="text-[10px] font-extrabold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                {LABELS.STAT_ELAPSED}
              </span>
              <span className="text-sm font-black text-zinc-700 dark:text-zinc-300 font-mono flex items-center gap-1 mt-1.5">
                <Clock size={14} className="text-zinc-400" />
                {status.elapsed_time || "0s"}
              </span>
            </div>
          </div>
        </div>

        {/* Configurations & Dimensions Panel (Right) */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-6 shadow-xs flex flex-col gap-5">
          <div>
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              {LABELS.ALLOWED_SIZES_TITLE}
            </h3>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">Sistem tarafından otomatik üretilen WebP çözünürlükleri</p>
          </div>

          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2 p-3 rounded-xl border border-zinc-200/60 dark:border-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-300 bg-zinc-50/50 dark:bg-zinc-800/30">
              <span className="w-2 h-2 rounded-full bg-violet-500" />
              {LABELS.SIZE_DETAIL_1}
            </div>
            <div className="flex items-center gap-2 p-3 rounded-xl border border-zinc-200/60 dark:border-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-300 bg-zinc-50/50 dark:bg-zinc-800/30">
              <span className="w-2 h-2 rounded-full bg-violet-500" />
              {LABELS.SIZE_DETAIL_2}
            </div>
            <div className="flex items-center gap-2 p-3 rounded-xl border border-zinc-200/60 dark:border-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-300 bg-zinc-50/50 dark:bg-zinc-800/30">
              <span className="w-2 h-2 rounded-full bg-violet-500" />
              {LABELS.SIZE_DETAIL_3}
            </div>
          </div>

          <hr className="border-zinc-100 dark:border-zinc-800" />

          <div className="flex gap-2.5 items-start bg-violet-50/50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/40 p-4 rounded-2xl">
            <Info size={16} className="text-violet-600 dark:text-violet-400 shrink-0 mt-0.5" />
            <span className="text-[11px] font-bold text-violet-900 dark:text-violet-200 leading-relaxed">
              {LABELS.INFO_THREAD_LIMIT}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

