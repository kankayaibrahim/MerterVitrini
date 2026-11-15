"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Filter,
  Globe2,
  History,
  Info,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";

interface IndexNowManagerProps {
  readonly apiUrl: string;
  readonly token: string;
}

type IndexNowTriggerSource =
  | "xml_sync"
  | "supplier_portal"
  | "supplier_excel"
  | "mobile_supplier"
  | "bulk_recent"
  | "blog"
  | "cms_page"
  | "manual";

type IndexNowLogStatus = "success" | "failed" | "skipped_dev" | "pending";

interface IndexNowLogEntry {
  readonly id: string;
  readonly trigger_source: IndexNowTriggerSource | string;
  readonly source_label: string;
  readonly feed_id?: string | null;
  readonly sync_run_id?: string | null;
  readonly host: string;
  readonly product_count: number;
  readonly url_count: number;
  readonly sample_urls: readonly string[];
  readonly status: IndexNowLogStatus | string;
  readonly http_status: number;
  readonly response_message: string;
  readonly duration_ms: number;
  readonly created_at: string;
}

interface IndexNowKpiSummary {
  readonly total_submissions: number;
  readonly total_urls_submitted: number;
  readonly total_products_notified: number;
  readonly today_submissions: number;
  readonly today_urls_submitted: number;
  readonly xml_sync_submissions: number;
  readonly supplier_submissions: number;
  readonly success_count: number;
  readonly failed_count: number;
  readonly skipped_dev_count: number;
  readonly success_rate: number;
  readonly last_submitted_at: string | null;
  readonly host: string;
  readonly key_location: string;
}

interface IndexNowLogsResponse {
  readonly kpi: IndexNowKpiSummary;
  readonly logs: readonly IndexNowLogEntry[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

interface IndexNowSubmitResponse {
  readonly status?: string;
  readonly message?: string;
  readonly error?: string;
  readonly log?: IndexNowLogEntry;
}

interface FeedbackBanner {
  readonly type: "success" | "warning" | "error";
  readonly message: string;
}

const PAGE_LIMIT = 20;

const SOURCE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "all", label: "Tüm Kaynaklar" },
  { value: "xml_sync", label: "XML Senkronizasyon" },
  { value: "supplier_portal", label: "Tedarikçi Stüdyosu" },
  { value: "supplier_excel", label: "Tedarikçi Excel" },
  { value: "mobile_supplier", label: "Mobil Stüdyo" },
  { value: "bulk_recent", label: "Toplu Son Ürünler" },
  { value: "blog", label: "Blog Yazısı" },
  { value: "cms_page", label: "Kurumsal Sayfa" },
  { value: "manual", label: "Manuel Gönderim" },
];

const STATUS_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "all", label: "Tüm Durumlar" },
  { value: "success", label: "Başarılı (200/202)" },
  { value: "failed", label: "Hatalı" },
  { value: "skipped_dev", label: "Geliştirme Modu" },
];

const RECENT_LIMIT_OPTIONS = [25, 50, 100, 250, 500] as const;

const SOURCE_META: Record<string, { label: string; badgeClass: string }> = {
  xml_sync: {
    label: "XML Senkronizasyon",
    badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  supplier_portal: {
    label: "Tedarikçi Stüdyosu",
    badgeClass: "bg-violet-50 text-violet-700 border-violet-200",
  },
  supplier_excel: {
    label: "Tedarikçi Excel",
    badgeClass: "bg-cyan-50 text-cyan-700 border-cyan-200",
  },
  mobile_supplier: {
    label: "Mobil Stüdyo",
    badgeClass: "bg-sky-50 text-sky-700 border-sky-200",
  },
  bulk_recent: {
    label: "Toplu Ürün Bildirimi",
    badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
  },
  blog: {
    label: "Blog Yazısı",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  cms_page: {
    label: "Kurumsal Sayfa",
    badgeClass: "bg-teal-50 text-teal-700 border-teal-200",
  },
  manual: {
    label: "Manuel Gönderim",
    badgeClass: "bg-zinc-100 text-zinc-700 border-zinc-200",
  },
};

function getSourceMeta(source: string): { label: string; badgeClass: string } {
  return (
    SOURCE_META[source] || {
      label: source || "Diğer",
      badgeClass: "bg-zinc-100 text-zinc-700 border-zinc-200",
    }
  );
}

function getStatusBadge(status: string, httpStatus: number): { label: string; badgeClass: string } {
  if (status === "success") {
    return {
      label: httpStatus > 0 ? `Başarılı (${httpStatus})` : "Başarılı",
      badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    };
  }
  if (status === "skipped_dev") {
    return {
      label: "Yerel Test (Atlandı)",
      badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
    };
  }
  return {
    label: httpStatus > 0 ? `Hata (${httpStatus})` : "Hata",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
  };
}

function formatDateTimeTr(iso: string | null | undefined): string {
  if (!iso) return "Henüz yok";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "Henüz yok";
  return parsed.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatNumberTr(value: number): string {
  return new Intl.NumberFormat("tr-TR").format(value);
}

export default function IndexNowManager({ apiUrl, token }: Readonly<IndexNowManagerProps>) {
  const [kpi, setKpi] = useState<IndexNowKpiSummary | null>(null);
  const [logs, setLogs] = useState<readonly IndexNowLogEntry[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [loadingLogs, setLoadingLogs] = useState(true);

  const [sourceFilter, setSourceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const isFirstSearchEffect = useRef(true);

  const [urlsInput, setUrlsInput] = useState("");
  const [recentLimit, setRecentLimit] = useState<number>(50);
  const [submittingManual, setSubmittingManual] = useState(false);
  const [submittingRecent, setSubmittingRecent] = useState(false);
  const [retryingLogId, setRetryingLogId] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [clearingLogs, setClearingLogs] = useState(false);

  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackBanner | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const fetchLogs = useCallback(
    async (opts?: { targetOffset?: number; targetSource?: string; targetStatus?: string; targetSearch?: string }) => {
      if (!token) {
        setLoadingLogs(false);
        return;
      }
      const nextOffset = opts?.targetOffset ?? offset;
      const nextSource = opts?.targetSource ?? sourceFilter;
      const nextStatus = opts?.targetStatus ?? statusFilter;
      const nextSearch = opts?.targetSearch ?? debouncedSearch;

      try {
        const params = new URLSearchParams({
          limit: String(PAGE_LIMIT),
          offset: String(nextOffset),
        });
        if (nextSource !== "all") params.set("source", nextSource);
        if (nextStatus !== "all") params.set("status", nextStatus);
        if (nextSearch.trim() !== "") params.set("q", nextSearch.trim());

        const res = await fetch(`${apiUrl}/api/v1/indexnow/logs?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          throw new Error(`IndexNow logları alınamadı (HTTP ${res.status})`);
        }
        const data: IndexNowLogsResponse = await res.json();
        setKpi(data.kpi);
        setLogs(Array.isArray(data.logs) ? data.logs : []);
        setTotalLogs(data.total ?? 0);
        setListError(null);
      } catch (err: unknown) {
        setListError(err instanceof Error ? err.message : "Log geçmişi yüklenirken hata oluştu.");
      } finally {
        setLoadingLogs(false);
      }
    },
    [apiUrl, token, offset, sourceFilter, statusFilter, debouncedSearch]
  );

  useEffect(() => {
    if (isFirstSearchEffect.current) {
      isFirstSearchEffect.current = false;
      return;
    }
    const timer = setTimeout(() => {
      setOffset(0);
      setDebouncedSearch(searchInput);
    }, 260);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      await fetchLogs();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [token, fetchLogs]);

  const handleRefresh = async () => {
    setLoadingLogs(true);
    await fetchLogs();
  };

  const handleSourceChange = (next: string) => {
    setOffset(0);
    setSourceFilter(next);
  };

  const handleStatusChange = (next: string) => {
    setOffset(0);
    setStatusFilter(next);
  };

  const applySubmitResultFeedback = (data: IndexNowSubmitResponse, fallbackMessage: string) => {
    const resolvedType: FeedbackBanner["type"] =
      data.status === "failed" ? "error" : data.status === "skipped_dev" ? "warning" : "success";
    setFeedback({
      type: resolvedType,
      message: data.message || fallbackMessage,
    });
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const urls = urlsInput
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (urls.length === 0) {
      setFeedback({ type: "error", message: "Lütfen en az bir geçerli URL adresi girin." });
      return;
    }

    const invalid = urls.filter((u) => {
      const lower = u.toLowerCase();
      return !lower.startsWith("http://") && !lower.startsWith("https://");
    });
    if (invalid.length > 0) {
      setFeedback({
        type: "error",
        message: "Tüm URL adresleri 'http://' veya 'https://' ile başlamalıdır.",
      });
      return;
    }

    setSubmittingManual(true);
    try {
      const response = await fetch(`${apiUrl}/api/v1/indexnow/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ urls }),
      });

      const data: IndexNowSubmitResponse = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "IndexNow isteği başarısız oldu.");
      }

      setUrlsInput("");
      applySubmitResultFeedback(data, "URL listesi IndexNow motorlarına bildirildi.");
      setOffset(0);
      await fetchLogs({ targetOffset: 0 });
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "IndexNow API bağlantı hatası oluştu.",
      });
    } finally {
      setSubmittingManual(false);
    }
  };

  const handleSubmitRecentProducts = async () => {
    setFeedback(null);
    setSubmittingRecent(true);
    try {
      const response = await fetch(`${apiUrl}/api/v1/indexnow/submit-recent-products`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ limit: recentLimit }),
      });

      const data: IndexNowSubmitResponse = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Son ürünler IndexNow gönderimi başarısız oldu.");
      }

      applySubmitResultFeedback(data, "Son aktif ürünler IndexNow motorlarına gönderildi.");
      setOffset(0);
      await fetchLogs({ targetOffset: 0 });
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Toplu ürün bildirimi sırasında hata oluştu.",
      });
    } finally {
      setSubmittingRecent(false);
    }
  };

  const handleRetryLog = async (logId: string) => {
    setFeedback(null);
    setRetryingLogId(logId);
    try {
      const response = await fetch(`${apiUrl}/api/v1/indexnow/logs/${encodeURIComponent(logId)}/retry`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: IndexNowSubmitResponse = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Tekrar gönderim başarısız oldu.");
      }
      applySubmitResultFeedback(data, "Seçili URL kümesi tekrar IndexNow servisine gönderildi.");
      setOffset(0);
      await fetchLogs({ targetOffset: 0 });
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Tekrar gönderim sırasında hata oluştu.",
      });
    } finally {
      setRetryingLogId(null);
    }
  };

  const handleClearLogs = async (onlyFailed: boolean) => {
    setClearingLogs(true);
    setFeedback(null);
    try {
      const qs = onlyFailed ? "?status=failed" : "";
      const response = await fetch(`${apiUrl}/api/v1/indexnow/logs${qs}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: { message?: string; error?: string } = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Loglar temizlenemedi.");
      }
      setConfirmClearAll(false);
      setExpandedLogId(null);
      setOffset(0);
      setFeedback({
        type: "success",
        message: data.message || "IndexNow log geçmişi temizlendi.",
      });
      await fetchLogs({ targetOffset: 0 });
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Log temizleme hatası.",
      });
    } finally {
      setClearingLogs(false);
    }
  };

  const keyLocationUrl =
    kpi?.key_location || "https://mertervitrini.com.tr/638d6e3eb8a743ec900269823f24ffe6.txt";

  const attemptedLiveCount = (kpi?.success_count ?? 0) + (kpi?.failed_count ?? 0);
  const successRateDisplay =
    attemptedLiveCount > 0
      ? `%${(kpi?.success_rate ?? 0).toFixed(1)}`
      : (kpi?.skipped_dev_count ?? 0) > 0
        ? "Yerel Test"
        : "—";

  const canGoPrev = offset > 0;
  const canGoNext = offset + PAGE_LIMIT < totalLogs;
  const showingFrom = totalLogs === 0 ? 0 : offset + 1;
  const showingTo = Math.min(offset + logs.length, totalLogs);

  return (
    <div className="max-w-7xl mx-auto w-full flex flex-col gap-6 animate-in fade-in duration-200">
      {/* Header & Automation Status Card */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
        <div className="space-y-2 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-xl font-bold text-zinc-950 flex items-center gap-2">
              <Sparkles size={20} className="text-violet-600" />
              IndexNow Otomasyon &amp; İndeksleme Log Merkezi
            </h2>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <ShieldCheck size={12} />
              Otomatik Hat Aktif (8 Dil)
            </span>
          </div>
          <p className="text-xs text-zinc-600 font-medium leading-relaxed">
            XML feed senkronizasyonları (cron &amp; manuel), tedarikçi web/mobil ürün açılışları,
            Excel toplu yüklemeleri ve blog/sayfa yayınları storefront önbelleği (
            <code className="px-1 py-0.5 bg-zinc-100 rounded text-[11px] font-mono">
              catalog.mv_products
            </code>
            ) tazelendikten hemen sonra otomatik olarak Bing &amp; Yandex IndexNow motorlarına
            iletülür ve tüm sonuçlar kalıcı olarak burada loglanır.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <a
            href={keyLocationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-xs font-bold text-zinc-700 transition-colors"
          >
            <Globe2 size={14} className="text-violet-600" />
            API Anahtar Dosyası
            <ExternalLink size={12} className="text-zinc-400" />
          </a>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={loadingLogs}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-400 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            <RefreshCw size={14} className={loadingLogs ? "animate-spin" : ""} />
            Logları Yenile
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 border rounded-2xl text-xs font-semibold leading-relaxed flex items-start gap-2.5 ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : feedback.type === "warning"
                ? "bg-amber-50 border-amber-200 text-amber-800"
                : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
          ) : feedback.type === "warning" ? (
            <Info size={16} className="shrink-0 mt-0.5" />
          ) : (
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* 5 Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-2xl border border-zinc-200/80 p-4 shadow-sm flex flex-col gap-1">
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <Activity size={13} className="text-violet-600" />
            Toplam Gönderim
          </span>
          <span className="text-2xl font-extrabold text-zinc-950">
            {formatNumberTr(kpi?.total_submissions ?? 0)}
          </span>
          <span className="text-[11px] font-semibold text-zinc-500">
            Bugün {formatNumberTr(kpi?.today_submissions ?? 0)} bildirim
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-zinc-200/80 p-4 shadow-sm flex flex-col gap-1">
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <Globe2 size={13} className="text-indigo-600" />
            Bildirilen URL
          </span>
          <span className="text-2xl font-extrabold text-zinc-950">
            {formatNumberTr(kpi?.total_urls_submitted ?? 0)}
          </span>
          <span className="text-[11px] font-semibold text-zinc-500">
            Bugün {formatNumberTr(kpi?.today_urls_submitted ?? 0)} URL •{" "}
            {formatNumberTr(kpi?.total_products_notified ?? 0)} ürün
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-zinc-200/80 p-4 shadow-sm flex flex-col gap-1">
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles size={13} className="text-sky-600" />
            XML &amp; Tedarikçi Oto
          </span>
          <span className="text-2xl font-extrabold text-zinc-950">
            {formatNumberTr((kpi?.xml_sync_submissions ?? 0) + (kpi?.supplier_submissions ?? 0))}
          </span>
          <span className="text-[11px] font-semibold text-zinc-500">
            {formatNumberTr(kpi?.xml_sync_submissions ?? 0)} XML •{" "}
            {formatNumberTr(kpi?.supplier_submissions ?? 0)} Tedarikçi
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-zinc-200/80 p-4 shadow-sm flex flex-col gap-1">
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 size={13} className="text-emerald-600" />
            Başarı Oranı
          </span>
          <span className="text-2xl font-extrabold text-zinc-950">{successRateDisplay}</span>
          <span className="text-[11px] font-semibold text-zinc-500">
            {formatNumberTr(kpi?.success_count ?? 0)} başarılı •{" "}
            {formatNumberTr(kpi?.failed_count ?? 0)} hatalı
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-zinc-200/80 p-4 shadow-sm flex flex-col gap-1">
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <Clock size={13} className="text-amber-600" />
            Son Bildirim
          </span>
          <span className="text-sm font-extrabold text-zinc-950 mt-1">
            {formatDateTimeTr(kpi?.last_submitted_at)}
          </span>
          <span className="text-[11px] font-semibold text-zinc-500">
            Host: {kpi?.host || "mertervitrini.com.tr"}
          </span>
        </div>
      </div>

      {/* Quick Bulk Recent Products + Manual Submission */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Quick Submit Recent Active Products */}
        <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-sm flex flex-col justify-between gap-5">
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
              <Sparkles size={16} className="text-amber-500" />
              Son Eklenen Ürünleri Şimdi Bildir
            </h3>
            <p className="text-xs text-zinc-500 font-medium leading-relaxed">
              Katalogdaki en son eklenen aktif ürünleri (arşivlenmemiş) 8 dil varyantıyla birlikte tek
              tıkla IndexNow arama motorlarına toplu gönderin.
            </p>

            <div className="flex flex-col gap-1.5 pt-1">
              <label
                htmlFor="recent-products-limit"
                className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider"
              >
                Gönderilecek Ürün Sayısı
              </label>
              <select
                id="recent-products-limit"
                value={recentLimit}
                onChange={(e) => setRecentLimit(Number(e.target.value))}
                className="px-3.5 py-2.5 rounded-xl border border-zinc-300 text-xs font-bold text-zinc-800 bg-white focus:outline-none focus:border-violet-500"
              >
                {RECENT_LIMIT_OPTIONS.map((count) => (
                  <option key={count} value={count}>
                    Son {count} Aktif Ürün (~{formatNumberTr(count * 8)} çok dilli URL)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSubmitRecentProducts}
            disabled={submittingRecent}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
          >
            {submittingRecent ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {submittingRecent ? "Ürünler Bildiriliyor..." : `Son ${recentLimit} Ürünü Gönder`}
          </button>
        </div>

        {/* Right: Manual URL Submission */}
        <form
          onSubmit={handleManualSubmit}
          className="lg:col-span-2 bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-sm flex flex-col gap-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
              <Send size={15} className="text-violet-600" />
              Manuel URL Bildirimi
            </h3>
            <span className="text-[11px] font-semibold text-zinc-400">
              Her satıra bir tam URL yazın (maks. 10.000 URL / parça)
            </span>
          </div>

          <textarea
            id="indexnow-urls-input"
            value={urlsInput}
            onChange={(e) => setUrlsInput(e.target.value)}
            rows={4}
            placeholder="https://mertervitrini.com.tr/product/ornek-toptan-elbise&#10;https://mertervitrini.com.tr/tr/blog/yeni-sezon-toptan-trendler"
            className="px-4 py-3 rounded-xl border border-zinc-300 text-xs font-semibold placeholder-zinc-400 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 leading-relaxed font-mono resize-y"
            required
          />

          <div className="flex items-center justify-between gap-3 pt-1">
            <span className="text-[11px] text-zinc-500 font-medium">
              Gönderilen tüm URL&apos;ler otomatik tekilleştirilir ve log tablosuna eklenir.
            </span>
            <button
              type="submit"
              disabled={submittingManual}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer shrink-0"
            >
              {submittingManual ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
              {submittingManual ? "Gönderiliyor..." : "IndexNow Motorlarına Gönder"}
            </button>
          </div>
        </form>
      </div>

      {/* Persistent PostgreSQL Submission Log Table */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-sm flex flex-col gap-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-2">
            <History size={17} className="text-zinc-600" />
            <h3 className="text-sm font-bold text-zinc-950">
              IndexNow Bildirim Geçmişi &amp; Denetim Logları
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 text-[11px] font-bold">
              {formatNumberTr(totalLogs)} kayıt
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {totalLogs > 0 && !confirmClearAll && (
              <>
                {(kpi?.failed_count ?? 0) > 0 && (
                  <button
                    type="button"
                    disabled={clearingLogs}
                    onClick={() => handleClearLogs(true)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold cursor-pointer"
                  >
                    <Trash2 size={12} />
                    Hatalıları Temizle
                  </button>
                )}
                <button
                  type="button"
                  disabled={clearingLogs}
                  onClick={() => setConfirmClearAll(true)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-600 text-[11px] font-bold cursor-pointer"
                >
                  <Trash2 size={12} />
                  Geçmişi Temizle
                </button>
              </>
            )}

            {confirmClearAll && (
              <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl">
                <span className="text-[11px] font-bold text-rose-800">
                  Tüm loglar silinsin mi?
                </span>
                <button
                  type="button"
                  disabled={clearingLogs}
                  onClick={() => handleClearLogs(false)}
                  className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold cursor-pointer"
                >
                  {clearingLogs ? "Siliniyor..." : "Evet, Sil"}
                </button>
                <button
                  type="button"
                  disabled={clearingLogs}
                  onClick={() => setConfirmClearAll(false)}
                  className="px-2.5 py-1 rounded-lg bg-white border border-zinc-200 text-zinc-700 text-[11px] font-bold cursor-pointer"
                >
                  Vazgeç
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-zinc-50/80 border border-zinc-200/70 p-3 rounded-xl">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
            />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Feed adı, ürün adı veya URL ara..."
              className="w-full pl-8 pr-3 py-2 rounded-lg border border-zinc-200 bg-white text-xs font-semibold text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-violet-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={14} className="text-zinc-400 shrink-0" />
            <select
              aria-label="Kaynak Filtresi"
              value={sourceFilter}
              onChange={(e) => handleSourceChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 bg-white text-xs font-bold text-zinc-700 focus:outline-none focus:border-violet-500"
            >
              {SOURCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              aria-label="Durum Filtresi"
              value={statusFilter}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 bg-white text-xs font-bold text-zinc-700 focus:outline-none focus:border-violet-500"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table Content */}
        {listError && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800 flex items-center gap-2">
            <AlertCircle size={15} />
            <span>{listError}</span>
          </div>
        )}

        {loadingLogs && logs.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-zinc-500 text-xs font-semibold">
            <Loader2 size={22} className="animate-spin text-violet-600" />
            <span>IndexNow log kayıtları yükleniyor...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center text-xs font-semibold text-zinc-400">
            Seçili filtrelere uygun IndexNow bildirim kaydı bulunamadı.
          </div>
        ) : (
          <div className="space-y-2.5">
            {logs.map((entry) => {
              const sourceMeta = getSourceMeta(entry.trigger_source);
              const statusMeta = getStatusBadge(entry.status, entry.http_status);
              const isExpanded = expandedLogId === entry.id;
              const isRetrying = retryingLogId === entry.id;

              return (
                <div
                  key={entry.id}
                  className="border border-zinc-200/80 rounded-xl overflow-hidden transition-colors hover:border-zinc-300"
                >
                  <div className="p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 bg-white">
                    <div className="flex flex-col gap-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${sourceMeta.badgeClass}`}
                        >
                          {sourceMeta.label}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusMeta.badgeClass}`}
                        >
                          {statusMeta.label}
                        </span>
                        <span className="text-[11px] font-semibold text-zinc-500">
                          {formatDateTimeTr(entry.created_at)}
                        </span>
                        {entry.duration_ms > 0 && (
                          <span className="text-[11px] font-mono text-zinc-400">
                            {entry.duration_ms} ms
                          </span>
                        )}
                      </div>

                      <div className="text-xs font-bold text-zinc-900 truncate">
                        {entry.source_label}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-zinc-500">
                        {entry.product_count > 0 && (
                          <span>{formatNumberTr(entry.product_count)} ürün</span>
                        )}
                        <span>{formatNumberTr(entry.url_count)} bildirilen URL</span>
                        {entry.response_message && (
                          <span className="text-zinc-600 truncate max-w-xl">
                            • {entry.response_message}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {entry.sample_urls.length > 0 && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleRetryLog(entry.id)}
                            disabled={isRetrying}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 disabled:opacity-50 text-zinc-700 text-[11px] font-bold cursor-pointer"
                          >
                            {isRetrying ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <RotateCcw size={12} />
                            )}
                            Tekrar Gönder
                          </button>

                          <button
                            type="button"
                            onClick={() => setExpandedLogId(isExpanded ? null : entry.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-violet-50 hover:bg-violet-100 text-violet-700 text-[11px] font-bold cursor-pointer"
                          >
                            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            URL&apos;ler ({entry.sample_urls.length})
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 py-3.5 bg-zinc-50/90 border-t border-zinc-200/80 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-zinc-600">
                        <span>
                          Gösterilen örnek: {entry.sample_urls.length} /{" "}
                          {formatNumberTr(entry.url_count)} toplam URL
                        </span>
                        {entry.sync_run_id && (
                          <span className="font-mono text-[10px] text-zinc-500">
                            Sync Run ID: {entry.sync_run_id}
                          </span>
                        )}
                      </div>

                      {entry.response_message && (
                        <div className="p-2.5 rounded-lg bg-white border border-zinc-200 text-[11px] font-mono text-zinc-700 break-all">
                          {entry.response_message}
                        </div>
                      )}

                      <ul className="grid grid-cols-1 md:grid-cols-2 gap-1.5 max-h-64 overflow-y-auto pr-1">
                        {entry.sample_urls.map((u) => (
                          <li key={u} className="truncate">
                            <a
                              href={u}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-mono text-violet-700 hover:underline truncate max-w-full"
                            >
                              <ExternalLink size={11} className="shrink-0" />
                              <span className="truncate">{u}</span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalLogs > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-100 text-xs font-semibold text-zinc-500">
            <span>
              Gösterilen: {formatNumberTr(showingFrom)}–{formatNumberTr(showingTo)} /{" "}
              {formatNumberTr(totalLogs)}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!canGoPrev || loadingLogs}
                onClick={() => setOffset(Math.max(0, offset - PAGE_LIMIT))}
                className="px-3.5 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-40 text-xs font-bold text-zinc-700 cursor-pointer"
              >
                Önceki
              </button>
              <button
                type="button"
                disabled={!canGoNext || loadingLogs}
                onClick={() => setOffset(offset + PAGE_LIMIT)}
                className="px-3.5 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-40 text-xs font-bold text-zinc-700 cursor-pointer"
              >
                Sonraki
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
