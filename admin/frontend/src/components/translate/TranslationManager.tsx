"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Languages, 
  Play, 
  Pause, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Activity, 
  Clock, 
  TrendingUp, 
  Database,
  Globe
} from "lucide-react";

const LABELS = {
  TITLE: "Yapay Zeka Çeviri Yönetimi",
  DESCRIPTION: "İstanbul Merter Vitrini B2B e-ticaret sitenizdeki ürünleri, kategorileri ve özellikleri yerel Translate API proxy servisi ile paralel iş parçacıkları (threads) kullanarak saniyeler içinde otomatik olarak çevirebilirsiniz.",
  REFRESH_DATA: "Verileri Yenile",
  NO_LANGS: "Aktif dil kaydı bulunamadı.",
  DATA_TABLE: "Veri Tablosu",
  MATRIX_TITLE: "Eksik Çeviri Durum Matrisi",
  LOADING_STATS: "İstatistikler toplanıyor...",
  CONTROL_PANEL: "Çeviri Kontrol Paneli",
  SELECTED_POOL: "Seçilen Çeviri Havuzu",
  TRANSLATE_TO: "lisanına çevir",
  TARGET_TABLE: "Hedef Tablo:",
  MISSING_COUNT: "Eksik Kayıt:",
  PIECES: "adet",
  PAUSE_JOB: "Çeviri İşlemini Duraklat",
  START_JOB: "4 Kanallı Çeviriyi Başlat",
  SELECT_CELL_PROMPT: "Lütfen yukarıdaki matristen bir eksik hücresine tıklayın.",
  PROGRESS_PANEL_TITLE: "Canlı İlerleme & Performans Ekranı",
  NO_ACTIVE_ENGINE: "Şu an çalışan aktif bir çeviri motoru bulunmamaktadır. Kontrol panelinden çeviriyi tetikleyebilirsiniz.",
  ACTIVE_JOB_POOL: "Aktif Görev Havuzu",
  PROGRESS_RATE: "İlerleme Oranı",
  PROCESSED: "İşlenen:",
  REMAINING: "Kalan:",
  ERROR_DETAIL: "Hata Detayı:",
  SPEED: "Çeviri Hızı",
  ESTIMATED_REMAINING: "Tahmini Kalan",
  SUCCESS_ERROR: "Başarılı / Hata",
  START_BATCH_QUEUE: "Tüm Eksikleri Sırayla Çevir (Oto-Kuyruk)",
  ACTIVE_BATCH_QUEUE: "AKTİF ÇEVİRİ KUYRUĞU",
  REMAINING_TASKS: "Kalan Görev Sayısı:",
  NEXT_TASKS: "SIRADAKİ GÖREVLER:",
  NO_MORE_TASKS: "Kuyrukta başka görev kalmadı."
};

interface LanguageStat {
  code: string;
  label: string;
  flag: string;
  products_count: number;
  product_desc_count: number;
  categories_count: number;
  attributes_count: number;
  colors_count: number;
  fabrics_count: number;
}

interface TranslationLog {
  id: number;
  status: "success" | "error";
  text_in: string;
  text_out?: string;
  error_msg?: string;
  timestamp: string;
}

interface TranslationJobState {
  status: "idle" | "running" | "paused" | "completed" | "failed";
  table: string;
  language: string;
  total_items: number;
  processed: number;
  success_count: number;
  failed_count: number;
  speed: number;
  error_msg?: string;
  logs?: TranslationLog[];
}

interface TranslationManagerProps {
  apiUrl: string;
  token: string | null;
}

export default function TranslationManager({ apiUrl, token }: TranslationManagerProps) {
  const [stats, setStats] = useState<LanguageStat[]>([]);
  const [loadingStats, setLoadingStats] = useState<boolean>(true);
  const [jobState, setJobState] = useState<TranslationJobState>({
    status: "idle",
    table: "",
    language: "",
    total_items: 0,
    processed: 0,
    success_count: 0,
    failed_count: 0,
    speed: 0
  });

  const [selectedCell, setSelectedCell] = useState<{
    table: "products" | "product_descriptions" | "categories" | "attributes" | "colors" | "fabrics";
    langCode: string;
    langLabel: string;
    missingCount: number;
  } | null>(null);

  const [isBatchRunning, setIsBatchRunning] = useState<boolean>(false);
  const [batchQueue, setBatchQueue] = useState<{
    table: "products" | "product_descriptions" | "categories" | "attributes" | "colors" | "fabrics";
    langCode: string;
    langLabel: string;
    missingCount: number;
  }[]>([]);

  const batchQueueRef = useRef(batchQueue);
  useEffect(() => {
    batchQueueRef.current = batchQueue;
  }, [batchQueue]);

  const isBatchRunningRef = useRef(isBatchRunning);
  useEffect(() => {
    isBatchRunningRef.current = isBatchRunning;
  }, [isBatchRunning]);

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // API Request Helper
  const apiRequest = async (path: string, method: string, body?: any) => {
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
  };

  const loadStats = async () => {
    setLoadingStats(true);
    try {
      const data = await apiRequest("/api/v1/translate/stats", "GET");
      setStats(data || []);
      
      // Auto-select first missing translation cell on load if nothing is selected
      if (data && data.length > 0 && !selectedCell) {
        // Try to find first cell with missing translations
        for (const s of data) {
          if (s.products_count > 0) {
            setSelectedCell({ table: "products", langCode: s.code, langLabel: s.label, missingCount: s.products_count });
            break;
          } else if (s.product_desc_count > 0) {
            setSelectedCell({ table: "product_descriptions", langCode: s.code, langLabel: s.label, missingCount: s.product_desc_count });
            break;
          } else if (s.categories_count > 0) {
            setSelectedCell({ table: "categories", langCode: s.code, langLabel: s.label, missingCount: s.categories_count });
            break;
          } else if (s.attributes_count > 0) {
            setSelectedCell({ table: "attributes", langCode: s.code, langLabel: s.label, missingCount: s.attributes_count });
            break;
          } else if (s.colors_count > 0) {
            setSelectedCell({ table: "colors", langCode: s.code, langLabel: s.label, missingCount: s.colors_count });
            break;
          } else if (s.fabrics_count > 0) {
            setSelectedCell({ table: "fabrics", langCode: s.code, langLabel: s.label, missingCount: s.fabrics_count });
            break;
          }
        }
      }
    } catch (err: any) {
      console.error("Failed to load translation stats", err);
      setActionError(err.message || "İstatistik yüklenemedi.");
    } finally {
      setLoadingStats(false);
    }
  };

  const loadJobStatus = async () => {
    try {
      const data = await apiRequest("/api/v1/translate/status", "GET");
      if (data) {
        setJobState(data);
        
        // If the job is running, make sure we have active polling
        if (data.status === "running") {
          startPolling();
        } else {
          stopPolling();
          // If a job just completed, refresh the stats matrix automatically
          if (data.status === "completed") {
            loadStats();
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch translation status", err);
    }
  };

  const startPolling = () => {
    if (pollingIntervalRef.current) return;
    pollingIntervalRef.current = setInterval(() => {
      loadJobStatus();
    }, 1000);
  };

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  useEffect(() => {
    if (token) {
      loadStats();
      loadJobStatus();
    }
    return () => stopPolling();
  }, [token]);

  const handleStartJob = async () => {
    if (!selectedCell) return;
    setActionError(null);
    setActionSuccess(null);
    
    try {
      const data = await apiRequest("/api/v1/translate/start", "POST", {
        table: selectedCell.table,
        language: selectedCell.langCode
      });
      
      if (data) {
        setJobState(data);
        startPolling();
        setActionSuccess(`${selectedCell.langLabel} çeviri başlatıldı.`);
      }
    } catch (err: any) {
      setActionError(err.message || "Çeviri işlemi başlatılamadı.");
    }
  };

  const handlePauseJob = async () => {
    setActionError(null);
    setActionSuccess(null);
    
    try {
      const data = await apiRequest("/api/v1/translate/pause", "POST");
      if (data) {
        setJobState(data);
        stopPolling();
        setActionSuccess("Çeviri işlemi duraklatıldı.");
        loadStats(); // Reload stats to see partially saved translations
      }
    } catch (err: any) {
      setActionError(err.message || "İşlem duraklatılamadı.");
    }
  };

  const handleStartBatch = async () => {
    setActionError(null);
    setActionSuccess(null);
    
    const queue: typeof batchQueue = [];
    const tables: ("products" | "product_descriptions" | "categories" | "attributes" | "colors" | "fabrics")[] = [
      "products",
      "product_descriptions",
      "categories",
      "attributes",
      "colors",
      "fabrics"
    ];
    
    for (const t of tables) {
      for (const s of stats) {
        const count = 
          t === "products" ? s.products_count : 
          t === "product_descriptions" ? s.product_desc_count :
          t === "categories" ? s.categories_count : 
          t === "attributes" ? s.attributes_count : 
          t === "colors" ? s.colors_count : 
          s.fabrics_count;
        if (count > 0) {
          queue.push({
            table: t,
            langCode: s.code,
            langLabel: s.label,
            missingCount: count
          });
        }
      }
    }
    
    if (queue.length === 0) {
      setActionError("Çevrilecek eksik kayıt bulunamadı.");
      return;
    }
    
    setIsBatchRunning(true);
    setBatchQueue(queue);
    
    const first = queue[0];
    setSelectedCell(first);
    
    try {
      const data = await apiRequest("/api/v1/translate/start", "POST", {
        table: first.table,
        language: first.langCode
      });
      
      if (data) {
        setJobState(data);
        startPolling();
        setActionSuccess(`Toplu Çeviri Başlatıldı: ${first.langLabel} (${getTableLabel(first.table).split(" (")[0]})`);
      }
    } catch (err: any) {
      setActionError(err.message || "Toplu çeviri işlemi başlatılamadı.");
      setIsBatchRunning(false);
      setBatchQueue([]);
    }
  };

  const handleStopBatch = async () => {
    setIsBatchRunning(false);
    setBatchQueue([]);
    await handlePauseJob();
  };

  useEffect(() => {
    if (jobState.status === "completed" && isBatchRunningRef.current && batchQueueRef.current.length > 0) {
      const processNext = async () => {
        const nextQueue = batchQueueRef.current.slice(1);
        setBatchQueue(nextQueue);
        
        if (nextQueue.length > 0) {
          const next = nextQueue[0];
          setSelectedCell(next);
          setActionSuccess(`Bir sonraki çeviriye geçiliyor: ${next.langLabel} (${getTableLabel(next.table).split(" (")[0]})`);
          
          try {
            const data = await apiRequest("/api/v1/translate/start", "POST", {
              table: next.table,
              language: next.langCode
            });
            if (data) {
              setJobState(data);
              startPolling();
            }
          } catch (err: any) {
            setActionError(`Kuyruk hatası: ${err.message || "İşlem başlatılamadı."}`);
            setIsBatchRunning(false);
            setBatchQueue([]);
          }
        } else {
          setIsBatchRunning(false);
          setActionSuccess("Tüm diller ve tablolar için otomatik toplu çeviri kuyruğu başarıyla tamamlandı! 🎉");
          loadStats();
        }
      };
      
      processNext();
    }
  }, [jobState.status]);

  // Helper translations for UI table labels
  const getTableLabel = (t: string) => {
    switch (t) {
      case "products": return "Ürün Başlıkları (catalog.products)";
      case "product_descriptions": return "Ürün Açıklamaları (catalog.product_descriptions)";
      case "categories": return "Kategoriler (catalog.categories)";
      case "attributes": return "Özellikler (catalog.product_attributes)";
      case "colors": return "Renkler (catalog.colors)";
      case "fabrics": return "Kumaşlar (catalog.fabrics)";
      default: return t;
    }
  };

  // Calculations for remaining time
  const getRemainingTime = () => {
    if (jobState.status !== "running" || jobState.speed <= 0) return "--";
    const remainingItems = jobState.total_items - jobState.processed;
    if (remainingItems <= 0) return "0 sn";
    
    const seconds = Math.ceil(remainingItems / jobState.speed);
    if (seconds < 60) return `${seconds} sn`;
    
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes} dk ${secs} sn`;
  };

  // Percent calculation
  const progressPercent = jobState.total_items > 0 
    ? Math.min(Math.round((jobState.processed / jobState.total_items) * 100), 100) 
    : 0;

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in duration-200">
      
      {/* 1. Header Banner */}
      <div className="glass-card bg-white p-6 rounded-3xl border border-zinc-200/50 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
            <Languages className="text-violet-600 animate-pulse" size={24} />
            {LABELS.TITLE}
          </h2>
          <p className="text-sm text-zinc-500 mt-1">
            {LABELS.DESCRIPTION}
          </p>
        </div>

        <button
          onClick={() => { loadStats(); loadJobStatus(); }}
          disabled={loadingStats || jobState.status === "running"}
          className="p-2.5 border border-zinc-200 rounded-xl hover:bg-zinc-50 text-zinc-600 transition-colors bg-white shadow-sm flex items-center justify-center gap-1.5 text-sm font-semibold cursor-pointer disabled:opacity-50"
          type="button"
        >
          <RefreshCw size={15} className={loadingStats ? "animate-spin" : ""} />
          {LABELS.REFRESH_DATA}
        </button>
      </div>

      {/* Action Messages */}
      {actionSuccess && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl animate-in fade-in slide-in-from-top-4 duration-300 shadow-sm">
          <CheckCircle size={18} className="text-emerald-600 shrink-0" />
          <span className="text-sm font-semibold">{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="flex items-start gap-2.5 bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-2xl text-xs font-semibold">
          <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
          <span>{actionError}</span>
        </div>
      )}

      {/* 2. STATS MATRIX TABLE CARD */}
      <div className="bg-white border border-zinc-200/50 rounded-3xl p-6 shadow-sm overflow-hidden flex flex-col gap-4">
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5 select-none">
          <Globe size={15} className="text-zinc-400" />
          {LABELS.MATRIX_TITLE}
        </h3>

        {loadingStats ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 border-3 border-zinc-100 border-t-violet-600 rounded-full animate-spin" />
            <span className="text-xs font-bold text-zinc-400 select-none">{LABELS.LOADING_STATS}</span>
          </div>
        ) : stats.length === 0 ? (
          <p className="text-zinc-500 text-sm italic py-8 text-center">{LABELS.NO_LANGS}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="py-3 px-4 text-xs font-bold text-zinc-400 uppercase tracking-wider select-none w-1/4">{LABELS.DATA_TABLE}</th>
                  {stats.map((s) => (
                    <th key={s.code} className="py-3 px-4 text-center text-xs font-bold text-zinc-400 uppercase tracking-wider select-none">
                      <span className="flex items-center justify-center gap-1.5">
                        <span className="text-sm">{s.flag}</span>
                        <span>{s.label} ({s.code.toUpperCase()})</span>
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Row 1: Ürün Başlıkları */}
                <tr className="border-b border-zinc-100/50 hover:bg-zinc-50/30 transition-colors">
                  <td className="py-4 px-4 text-sm font-bold text-zinc-800 flex items-center gap-2 select-none">
                    <Database size={15} className="text-zinc-400" />
                    Ürün Başlıkları
                  </td>
                  {stats.map((s) => {
                    const isSelected = selectedCell?.table === "products" && selectedCell?.langCode === s.code;
                    return (
                      <td 
                        key={s.code} 
                        className={`py-4 px-4 text-center cursor-pointer transition-all ${
                          isSelected ? "bg-violet-50/40" : ""
                        }`}
                        onClick={() => setSelectedCell({ table: "products", langCode: s.code, langLabel: s.label, missingCount: s.products_count })}
                      >
                        {s.products_count === 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 border border-emerald-100 text-emerald-700">
                            ✔ Hazır
                          </span>
                        ) : (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${
                            isSelected 
                              ? "bg-violet-600 border-violet-700 text-white shadow-sm shadow-violet-600/20 scale-105" 
                              : "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
                          }`}>
                            {s.products_count} Eksik
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>

                {/* Row 2: Ürün Açıklamaları */}
                <tr className="border-b border-zinc-100/50 hover:bg-zinc-50/30 transition-colors">
                  <td className="py-4 px-4 text-sm font-bold text-zinc-800 flex items-center gap-2 select-none">
                    <Database size={15} className="text-zinc-400" />
                    Ürün Açıklamaları
                  </td>
                  {stats.map((s) => {
                    const isSelected = selectedCell?.table === "product_descriptions" && selectedCell?.langCode === s.code;
                    return (
                      <td 
                        key={s.code} 
                        className={`py-4 px-4 text-center cursor-pointer transition-all ${
                          isSelected ? "bg-violet-50/40" : ""
                        }`}
                        onClick={() => setSelectedCell({ table: "product_descriptions", langCode: s.code, langLabel: s.label, missingCount: s.product_desc_count })}
                      >
                        {s.product_desc_count === 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 border border-emerald-100 text-emerald-700">
                            ✔ Hazır
                          </span>
                        ) : (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${
                            isSelected 
                              ? "bg-violet-600 border-violet-700 text-white shadow-sm shadow-violet-600/20 scale-105" 
                              : "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
                          }`}>
                            {s.product_desc_count} Eksik
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>

                {/* Row 3: Kategoriler */}
                <tr className="border-b border-zinc-100/50 hover:bg-zinc-50/30 transition-colors">
                  <td className="py-4 px-4 text-sm font-bold text-zinc-800 flex items-center gap-2 select-none">
                    <Database size={15} className="text-zinc-400" />
                    Kategoriler
                  </td>
                  {stats.map((s) => {
                    const isSelected = selectedCell?.table === "categories" && selectedCell?.langCode === s.code;
                    return (
                      <td 
                        key={s.code} 
                        className={`py-4 px-4 text-center cursor-pointer transition-all ${
                          isSelected ? "bg-violet-50/40" : ""
                        }`}
                        onClick={() => setSelectedCell({ table: "categories", langCode: s.code, langLabel: s.label, missingCount: s.categories_count })}
                      >
                        {s.categories_count === 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 border border-emerald-100 text-emerald-700">
                            ✔ Hazır
                          </span>
                        ) : (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${
                            isSelected 
                              ? "bg-violet-600 border-violet-700 text-white shadow-sm shadow-violet-600/20 scale-105" 
                              : "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
                          }`}>
                            {s.categories_count} Eksik
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>

                {/* Row 4: Özellikler */}
                <tr className="border-b border-zinc-100/50 hover:bg-zinc-50/30 transition-colors">
                  <td className="py-4 px-4 text-sm font-bold text-zinc-800 flex items-center gap-2 select-none">
                    <Database size={15} className="text-zinc-400" />
                    Özellikler
                  </td>
                  {stats.map((s) => {
                    const isSelected = selectedCell?.table === "attributes" && selectedCell?.langCode === s.code;
                    return (
                      <td 
                        key={s.code} 
                        className={`py-4 px-4 text-center cursor-pointer transition-all ${
                          isSelected ? "bg-violet-50/40" : ""
                        }`}
                        onClick={() => setSelectedCell({ table: "attributes", langCode: s.code, langLabel: s.label, missingCount: s.attributes_count })}
                      >
                        {s.attributes_count === 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 border border-emerald-100 text-emerald-700">
                            ✔ Hazır
                          </span>
                        ) : (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${
                            isSelected 
                              ? "bg-violet-600 border-violet-700 text-white shadow-sm shadow-violet-600/20 scale-105" 
                              : "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
                          }`}>
                            {s.attributes_count} Eksik
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>

                {/* Row 5: Renkler */}
                <tr className="border-b border-zinc-100/50 hover:bg-zinc-50/30 transition-colors">
                  <td className="py-4 px-4 text-sm font-bold text-zinc-800 flex items-center gap-2 select-none">
                    <Database size={15} className="text-zinc-400" />
                    Renkler
                  </td>
                  {stats.map((s) => {
                    const isSelected = selectedCell?.table === "colors" && selectedCell?.langCode === s.code;
                    return (
                      <td 
                        key={s.code} 
                        className={`py-4 px-4 text-center cursor-pointer transition-all ${
                          isSelected ? "bg-violet-50/40" : ""
                        }`}
                        onClick={() => setSelectedCell({ table: "colors", langCode: s.code, langLabel: s.label, missingCount: s.colors_count })}
                      >
                        {s.colors_count === 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 border border-emerald-100 text-emerald-700">
                            ✔ Hazır
                          </span>
                        ) : (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${
                            isSelected 
                              ? "bg-violet-600 border-violet-700 text-white shadow-sm shadow-violet-600/20 scale-105" 
                              : "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
                          }`}>
                            {s.colors_count} Eksik
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>

                {/* Row 6: Kumaşlar */}
                <tr className="hover:bg-zinc-50/30 transition-colors">
                  <td className="py-4 px-4 text-sm font-bold text-zinc-800 flex items-center gap-2 select-none">
                    <Database size={15} className="text-zinc-400" />
                    Kumaşlar
                  </td>
                  {stats.map((s) => {
                    const isSelected = selectedCell?.table === "fabrics" && selectedCell?.langCode === s.code;
                    return (
                      <td 
                        key={s.code} 
                        className={`py-4 px-4 text-center cursor-pointer transition-all ${
                          isSelected ? "bg-violet-50/40" : ""
                        }`}
                        onClick={() => setSelectedCell({ table: "fabrics", langCode: s.code, langLabel: s.label, missingCount: s.fabrics_count })}
                      >
                        {s.fabrics_count === 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 border border-emerald-100 text-emerald-700">
                            ✔ Hazır
                          </span>
                        ) : (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${
                            isSelected 
                              ? "bg-violet-600 border-violet-700 text-white shadow-sm shadow-violet-600/20 scale-105" 
                              : "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
                          }`}>
                            {s.fabrics_count} Eksik
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. DUAL-WORKSPACE CONTROL & PROGRESS PANELS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Control Card: Action Launcher */}
        <div className="lg:col-span-1 bg-white border border-zinc-200/50 rounded-3xl p-5 shadow-sm flex flex-col gap-4">
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5 select-none">
            <Activity size={15} className="text-zinc-400" />
            {LABELS.CONTROL_PANEL}
          </h3>

          {selectedCell ? (
            <div className="flex flex-col gap-4">
              <div className="bg-zinc-50/50 border border-zinc-100 p-4 rounded-2xl flex flex-col gap-2">
                <span className="text-[10px] font-extrabold uppercase text-zinc-400 tracking-wider">{LABELS.SELECTED_POOL}</span>
                <span className="text-sm font-bold text-zinc-800 flex items-center gap-1.5">
                  <span className="text-base">{stats.find(s => s.code === selectedCell.langCode)?.flag || "🌐"}</span>
                  {selectedCell.langLabel} {LABELS.TRANSLATE_TO}
                </span>
                <div className="h-px bg-zinc-200/40 my-1" />
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="text-zinc-400">{LABELS.TARGET_TABLE}</span>
                  <span className="text-zinc-700">{getTableLabel(selectedCell.table)}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="text-zinc-400">{LABELS.MISSING_COUNT}</span>
                  <span className="text-zinc-700">{selectedCell.missingCount} {LABELS.PIECES}</span>
                </div>
              </div>

              {isBatchRunning ? (
                <button
                  onClick={handleStopBatch}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-bold text-sm shadow-md hover:shadow-lg hover:shadow-rose-600/10 transition-all cursor-pointer"
                  type="button"
                >
                  <Pause size={16} />
                  Kuyruğu ve Çeviriyi Durdur
                </button>
              ) : jobState.status === "running" ? (
                <button
                  onClick={handlePauseJob}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-bold text-sm shadow-md hover:shadow-lg hover:shadow-amber-600/10 transition-all cursor-pointer"
                  type="button"
                >
                  <Pause size={16} />
                  {LABELS.PAUSE_JOB}
                </button>
              ) : (
                <div className="flex flex-col gap-2.5">
                  <button
                    onClick={handleStartJob}
                    disabled={selectedCell.missingCount === 0}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-2xl font-bold text-sm shadow-md hover:shadow-lg hover:shadow-violet-600/10 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    type="button"
                  >
                    <Play size={16} />
                    {LABELS.START_JOB}
                  </button>
                  
                  <button
                    onClick={handleStartBatch}
                    className="w-full flex items-center justify-center gap-2 py-2.5 border border-violet-200 hover:bg-violet-50 text-violet-700 bg-white rounded-2xl font-bold text-xs shadow-sm hover:shadow-md transition-all cursor-pointer"
                    type="button"
                  >
                    <Globe size={14} className="text-violet-600" />
                    {LABELS.START_BATCH_QUEUE}
                  </button>
                </div>
              )}

              {isBatchRunning && batchQueue.length > 0 && (
                <div className="bg-violet-50/50 border border-violet-100 p-3 rounded-2xl flex flex-col gap-1.5 mt-2 animate-in slide-in-from-top-2 duration-300">
                  <span className="text-[9px] font-black text-violet-700 uppercase tracking-widest flex items-center gap-1">
                    <Globe size={10} className="animate-spin" />
                    {LABELS.ACTIVE_BATCH_QUEUE}
                  </span>
                  <div className="flex justify-between items-center text-xs font-semibold text-zinc-600">
                    <span>{LABELS.REMAINING_TASKS}</span>
                    <span className="text-violet-700 font-bold">{batchQueue.length}</span>
                  </div>
                  <div className="flex flex-col gap-1 mt-1">
                    <span className="text-[9px] font-bold text-zinc-400">{LABELS.NEXT_TASKS}</span>
                    <div className="max-h-24 overflow-y-auto flex flex-col gap-1">
                      {batchQueue.slice(1).map((q, idx) => (
                        <div key={idx} className="flex justify-between items-center text-[10px] bg-white border border-zinc-100 p-1.5 rounded-lg text-zinc-500 font-medium">
                          <span>{idx + 1}. {stats.find(s => s.code === q.langCode)?.flag} {getTableLabel(q.table).split(" (")[0]} ({q.langCode.toUpperCase()})</span>
                          <span className="font-bold text-amber-600">{q.missingCount}</span>
                        </div>
                      ))}
                      {batchQueue.length <= 1 && (
                        <span className="text-[10px] text-zinc-400 italic">{LABELS.NO_MORE_TASKS}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-zinc-400 italic text-xs font-medium py-4 text-center">{LABELS.SELECT_CELL_PROMPT}</p>
          )}
        </div>

        {/* Right Info Card: Real-Time Translation Progress Panel */}
        <div className="lg:col-span-2 bg-white border border-zinc-200/50 rounded-3xl p-5 shadow-sm flex flex-col gap-4">
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5 select-none">
            <Activity size={15} className="text-zinc-400" />
            {LABELS.PROGRESS_PANEL_TITLE}
          </h3>

          {jobState.status === "idle" ? (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
              <CheckCircle size={36} className="text-zinc-300" />
              <p className="text-xs font-bold text-zinc-400 max-w-xs">{LABELS.NO_ACTIVE_ENGINE}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-5 animate-in fade-in duration-300">
              
              {/* Target & Status Badges */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col">
                  <span className="text-[10px] font-extrabold uppercase text-zinc-400 tracking-wider">{LABELS.ACTIVE_JOB_POOL}</span>
                  <span className="text-xs font-bold text-zinc-800">
                    {getTableLabel(jobState.table)} &rarr; {jobState.language.toUpperCase()}
                  </span>
                </div>
                
                <span className={`inline-flex items-center px-3 py-1 rounded-xl text-[10px] font-bold border uppercase tracking-wider ${
                  jobState.status === "running" ? "bg-blue-50 border-blue-200 text-blue-700 animate-pulse" :
                  jobState.status === "paused" ? "bg-amber-50 border-amber-200 text-amber-700" :
                  jobState.status === "completed" ? "bg-emerald-50 border-emerald-200 text-emerald-700" :
                  "bg-rose-50 border-rose-200 text-rose-700"
                }`}>
                  {jobState.status === "running" && "Çeviri Yapılıyor (4 Thread)"}
                  {jobState.status === "paused" && "Duraklatıldı"}
                  {jobState.status === "completed" && "Tamamlandı"}
                  {jobState.status === "failed" && "Hata Oluştu"}
                </span>
              </div>

              {/* Progress bar container */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-baseline select-none">
                  <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider">{LABELS.PROGRESS_RATE}</span>
                  <span className="font-mono text-sm font-black text-violet-600">{progressPercent}%</span>
                </div>
                
                {/* CSS progress bar */}
                <div className="w-full h-3 bg-zinc-100 rounded-full overflow-hidden border border-zinc-200/40 relative">
                  <div 
                    className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all duration-500 relative"
                    style={{ width: `${progressPercent}%` }}
                  >
                    {/* Glowing pulse bar if running */}
                    {jobState.status === "running" && (
                      <span className="absolute inset-0 bg-white/30 animate-pulse" />
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center text-[11px] font-bold text-zinc-400 mt-1 select-none">
                  <span>{LABELS.PROCESSED} {jobState.processed} / {jobState.total_items} {LABELS.PIECES}</span>
                  <span>{LABELS.REMAINING} {jobState.total_items - jobState.processed}</span>
                </div>
              </div>

              {/* Translation Errors if occurred */}
              {jobState.error_msg && (
                <div className="flex items-start gap-2 bg-rose-50 border border-rose-100 text-rose-900 rounded-xl p-3 text-xs font-semibold leading-relaxed">
                  <AlertCircle size={14} className="text-rose-600 shrink-0 mt-0.5" />
                  <span>{LABELS.ERROR_DETAIL} {jobState.error_msg}</span>
                </div>
              )}

              {/* 3 Column Statistics grid */}
              <div className="grid grid-cols-3 gap-4 border-t border-zinc-100 pt-4 text-center select-none">
                
                <div className="flex flex-col items-center gap-1.5 p-2.5 bg-zinc-50/50 border border-zinc-100/50 rounded-2xl shadow-sm">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100/50 flex items-center justify-center text-indigo-600 shrink-0">
                    <TrendingUp size={15} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-extrabold uppercase text-zinc-400 tracking-wider">{LABELS.SPEED}</span>
                    <span className="text-xs font-black text-zinc-800 mt-0.5">
                      {jobState.status === "running" ? `${jobState.speed.toFixed(1)} / sn` : "0.0 / sn"}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-1.5 p-2.5 bg-zinc-50/50 border border-zinc-100/50 rounded-2xl shadow-sm">
                  <div className="w-8 h-8 rounded-xl bg-violet-50 border border-violet-100/50 flex items-center justify-center text-violet-600 shrink-0">
                    <Clock size={15} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-extrabold uppercase text-zinc-400 tracking-wider">{LABELS.ESTIMATED_REMAINING}</span>
                    <span className="text-xs font-black text-zinc-800 mt-0.5">
                      {getRemainingTime()}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-1.5 p-2.5 bg-zinc-50/50 border border-zinc-100/50 rounded-2xl shadow-sm">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100/50 flex items-center justify-center text-emerald-600 shrink-0">
                    <CheckCircle size={15} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-extrabold uppercase text-zinc-400 tracking-wider">{LABELS.SUCCESS_ERROR}</span>
                    <span className="text-xs font-black text-zinc-800 mt-0.5">
                      {jobState.success_count} / <span className={jobState.failed_count > 0 ? "text-rose-600 font-extrabold" : ""}>{jobState.failed_count}</span>
                    </span>
                  </div>
                </div>

              </div>

              {/* Çeviri Akışı & Günlükleri Console (Live Stream Logs) */}
              {jobState.logs && jobState.logs.length > 0 && (
                <div className="flex flex-col gap-2 border-t border-zinc-100 pt-4 animate-in fade-in duration-300">
                  <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider select-none flex items-center gap-1.5">
                    <Activity className="text-violet-600 shrink-0" size={13} />
                    Çeviri Günlükleri & Canlı Akış
                  </span>
                  
                  <div className="w-full max-h-48 overflow-y-auto bg-zinc-950 rounded-2xl p-4 border border-zinc-800/80 font-mono text-[11px] flex flex-col gap-2 text-zinc-300 shadow-inner scrollbar-thin">
                    {jobState.logs.map((log) => (
                      <div 
                        key={log.id} 
                        className={`flex items-start gap-2.5 py-1 border-b border-zinc-800/40 last:border-0 ${
                          log.status === "error" ? "text-rose-400" : "text-zinc-300"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${
                          log.status === "error" ? "bg-rose-500 animate-pulse" : "bg-emerald-500"
                        }`} />
                        
                        <div className="flex-1 flex flex-col gap-0.5">
                          <div className="flex justify-between items-center text-[10px] text-zinc-500 font-bold select-none">
                            <span>Görev #{log.id}</span>
                            <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                          </div>
                          
                          <div className="flex flex-wrap gap-1 leading-relaxed">
                            <span className="text-zinc-500 font-semibold">TR:</span>
                            <span className="text-zinc-200">"{log.text_in}"</span>
                            
                            {log.status === "success" ? (
                              <>
                                <span className="text-emerald-500 font-semibold">&rarr; Cevap:</span>
                                <span className="text-emerald-300">"{log.text_out}"</span>
                              </>
                            ) : (
                              <>
                                <span className="text-rose-500 font-semibold">&rarr; Hata:</span>
                                <span className="text-rose-300 bg-rose-950/40 border border-rose-900/30 px-1.5 py-0.5 rounded text-[10px]">
                                  {log.error_msg}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>

      </div>

    </div>
  );
}
