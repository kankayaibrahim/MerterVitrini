"use client";

import React, { useCallback, useEffect, useState } from "react";
import { AlertTriangle, RefreshCw, ShieldCheck } from "lucide-react";
import { useAdmin } from "@/context/AdminContext";
import ConsentOverviewTab from "./ConsentOverviewTab";
import ConsentLedgerTab from "./ConsentLedgerTab";
import CookieInventoryTab from "./CookieInventoryTab";
import ConsentSettingsTab from "./ConsentSettingsTab";
import type {
  ConsentOverviewDTO,
  ConsentRecordDTO,
  ConsentSettingsDTO,
  CookieInventoryItem,
  CookieScanRunResult,
} from "./types";

type ConsentTabKey = "overview" | "ledger" | "cookies" | "settings";

const CONSENT_API_BASE = "/api/v1/admin/consent";

async function extractApiErrorMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
  const detail = body.error || body.message;
  return detail ? `${fallback}: ${detail} (HTTP ${res.status})` : `${fallback} (HTTP ${res.status})`;
}

export default function ConsentManager() {
  const { fetchWithConfig } = useAdmin();
  const [activeTab, setActiveTab] = useState<ConsentTabKey>("overview");
  const [overview, setOverview] = useState<ConsentOverviewDTO | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [records, setRecords] = useState<ConsentRecordDTO[]>([]);
  const [recordsTotal, setRecordsTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [loadingRecords, setLoadingRecords] = useState(false);

  const [cookies, setCookies] = useState<CookieInventoryItem[]>([]);
  const [lastScan, setLastScan] = useState<CookieScanRunResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [anchoring, setAnchoring] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [bannerMsg, setBannerMsg] = useState<string>("");

  const showToast = (msg: string) => {
    setBannerMsg(msg);
    setTimeout(() => setBannerMsg(""), 5000);
  };

  const loadOverview = useCallback(async () => {
    setLoadingOverview(true);
    try {
      const res = await fetchWithConfig(`${CONSENT_API_BASE}/overview`);
      if (res.ok) {
        setOverview((await res.json()) as ConsentOverviewDTO);
        setLoadError(null);
      } else {
        setLoadError(await extractApiErrorMessage(res, "Rıza verileri yüklenemedi"));
      }
    } catch {
      setLoadError("Rıza verileri yüklenirken ağ hatası oluştu.");
    } finally {
      setLoadingOverview(false);
    }
  }, [fetchWithConfig]);

  const loadRecords = useCallback(async () => {
    setLoadingRecords(true);
    try {
      const qs = new URLSearchParams({
        page: String(page),
        limit: "25",
        search,
        action: actionFilter,
      });
      const res = await fetchWithConfig(`${CONSENT_API_BASE}/records?${qs.toString()}`);
      if (res.ok) {
        const data = (await res.json()) as {
          records: ConsentRecordDTO[];
          total: number;
        };
        setRecords(data.records || []);
        setRecordsTotal(data.total || 0);
      } else {
        setLoadError(await extractApiErrorMessage(res, "Rıza kayıtları yüklenemedi"));
      }
    } catch {
      setLoadError("Rıza kayıtları yüklenirken ağ hatası oluştu.");
    } finally {
      setLoadingRecords(false);
    }
  }, [fetchWithConfig, page, search, actionFilter]);

  const loadCookies = useCallback(async () => {
    try {
      const res = await fetchWithConfig(`${CONSENT_API_BASE}/cookies?lang=tr`);
      if (res.ok) {
        const data = (await res.json()) as { cookies: CookieInventoryItem[] };
        setCookies(data.cookies || []);
      } else {
        setLoadError(await extractApiErrorMessage(res, "Çerez envanteri yüklenemedi"));
      }
    } catch {
      setLoadError("Çerez envanteri yüklenirken ağ hatası oluştu.");
    }
  }, [fetchWithConfig]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadOverview();
      void loadCookies();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadOverview, loadCookies]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadRecords();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadRecords]);

  const handleRetryAll = () => {
    setLoadError(null);
    void loadOverview();
    void loadRecords();
    void loadCookies();
  };

  const handleAnchorNow = async () => {
    setAnchoring(true);
    try {
      const res = await fetchWithConfig(`${CONSENT_API_BASE}/anchor`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        anchored?: boolean;
        message?: string;
        error?: string;
        tsa_provider?: string;
        record_count?: number;
      };
      if (!res.ok) {
        showToast(data.error || `TSA mühürleme başarısız (HTTP ${res.status})`);
      } else if (data.anchored) {
        showToast(`${data.record_count} rıza kaydı ${data.tsa_provider} ile RFC 3161 mühürlendi.`);
      } else {
        showToast(data.message || "Mühürlenecek yeni kayıt yok.");
      }
      await loadOverview();
      await loadRecords();
    } finally {
      setAnchoring(false);
    }
  };

  const handleVerifyIntegrity = async () => {
    setVerifying(true);
    try {
      const res = await fetchWithConfig(`${CONSENT_API_BASE}/verify`, { method: "POST" });
      if (res.ok) {
        const report = await res.json();
        showToast(
          report.overall_valid
            ? `Tüm ${report.total_records} kayıt ve ${report.total_anchors} TSA mührü doğrulandı (%100 sağlam).`
            : "Bütünlük ihlali tespit edildi! Detayları inceleyin."
        );
        await loadOverview();
      } else {
        showToast(await extractApiErrorMessage(res, "Bütünlük denetimi başarısız"));
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleDownloadTSR = async (anchorSeq: number) => {
    const res = await fetchWithConfig(`${CONSENT_API_BASE}/anchors/${anchorSeq}/tsr`);
    if (!res.ok) {
      showToast("TSA .tsr dosyası indirilemedi.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `consent-anchor-${anchorSeq}.tsr`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleInspectEvidence = async (id: string) => {
    const res = await fetchWithConfig(`${CONSENT_API_BASE}/records/${id}/evidence`);
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  };

  const handleExport = async (format: "csv" | "json") => {
    const res = await fetchWithConfig(`${CONSENT_API_BASE}/export?format=${format}`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `consent-ledger-export.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRunScan = async () => {
    setScanning(true);
    try {
      const res = await fetchWithConfig(`${CONSENT_API_BASE}/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auto_register: true }),
      });
      if (res.ok) {
        setLastScan((await res.json()) as CookieScanRunResult);
        await loadCookies();
        await loadOverview();
      } else {
        showToast(await extractApiErrorMessage(res, "Çerez taraması başlatılamadı"));
      }
    } finally {
      setScanning(false);
    }
  };

  const handleSaveCookie = async (payload: Partial<CookieInventoryItem> & { id?: string }) => {
    const path = payload.id
      ? `${CONSENT_API_BASE}/cookies/${payload.id}`
      : `${CONSENT_API_BASE}/cookies`;
    const method = payload.id ? "PUT" : "POST";
    const res = await fetchWithConfig(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      showToast("Çerez envanteri güncellendi.");
      await loadCookies();
    } else {
      showToast(await extractApiErrorMessage(res, "Çerez kaydedilemedi"));
    }
  };

  const handleDeleteCookie = async (id: string) => {
    const res = await fetchWithConfig(`${CONSENT_API_BASE}/cookies/${id}`, { method: "DELETE" });
    if (res.ok) {
      showToast("Çerez envanterden kaldırıldı.");
      await loadCookies();
    } else {
      showToast(await extractApiErrorMessage(res, "Çerez silinemedi"));
    }
  };

  const handleSaveSettings = async (settings: ConsentSettingsDTO) => {
    const res = await fetchWithConfig(`${CONSENT_API_BASE}/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    if (res.ok) {
      showToast("CMP & TSA ayarları güncellendi.");
      await loadOverview();
    } else {
      showToast(await extractApiErrorMessage(res, "Ayarlar kaydedilemedi"));
    }
  };

  const tabClass = (key: ConsentTabKey) =>
    `pb-2.5 text-sm font-bold border-b-2 transition-colors cursor-pointer ${
      activeTab === key
        ? "border-violet-600 text-violet-600 dark:text-violet-400"
        : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
    }`;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-violet-600" />
            KVKK / GDPR Çerez & Değiştirilemez Rıza Kanıt Merkezi (c15t + RFC 3161)
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            WORM veritabanı tetikleyicileri, SHA-256 hash zinciri, HMAC mührü ve bağımsız DigiCert/Sectigo/FreeTSA RFC 3161 zaman damgası doğrulaması.
          </p>
        </div>
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/40 dark:border-red-800 px-4 py-3 text-xs font-semibold text-red-800 dark:text-red-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{loadError}</span>
          </div>
          <button
            type="button"
            onClick={handleRetryAll}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 dark:border-red-700 bg-white dark:bg-red-950 px-3 py-1.5 text-xs font-semibold text-red-700 dark:text-red-200 hover:bg-red-100 cursor-pointer shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Yeniden Dene
          </button>
        </div>
      )}

      {bannerMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-800 px-4 py-3 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
          {bannerMsg}
        </div>
      )}

      <div className="flex flex-wrap gap-6 border-b border-zinc-200 dark:border-zinc-800">
        <button type="button" className={tabClass("overview")} onClick={() => setActiveTab("overview")}>
          Bilirkişi Özeti & TSA Mühürleri
        </button>
        <button type="button" className={tabClass("ledger")} onClick={() => setActiveTab("ledger")}>
          Değiştirilemez Rıza Defteri ({recordsTotal})
        </button>
        <button type="button" className={tabClass("cookies")} onClick={() => setActiveTab("cookies")}>
          Çerez Envanteri & Tarayıcı ({cookies.length})
        </button>
        <button type="button" className={tabClass("settings")} onClick={() => setActiveTab("settings")}>
          CMP & Consent Mode v2 Ayarları
        </button>
      </div>

      {activeTab === "overview" && loadingOverview && !overview && (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center text-xs text-zinc-500">
          Rıza & TSA verileri yükleniyor...
        </div>
      )}

      {activeTab === "overview" && overview && (
        <ConsentOverviewTab
          overview={overview}
          anchoring={anchoring}
          verifying={verifying}
          onAnchorNow={() => void handleAnchorNow()}
          onVerifyIntegrity={() => void handleVerifyIntegrity()}
          onDownloadTSR={(seq) => void handleDownloadTSR(seq)}
        />
      )}

      {activeTab === "ledger" && (
        <ConsentLedgerTab
          records={records}
          total={recordsTotal}
          page={page}
          loading={loadingRecords}
          search={search}
          actionFilter={actionFilter}
          onSearchChange={(v) => {
            setPage(1);
            setSearch(v);
          }}
          onActionFilterChange={(v) => {
            setPage(1);
            setActionFilter(v);
          }}
          onPageChange={setPage}
          onInspectEvidence={handleInspectEvidence}
          onExport={(fmt) => void handleExport(fmt)}
        />
      )}

      {activeTab === "cookies" && (
        <CookieInventoryTab
          cookies={cookies}
          scanning={scanning}
          lastScan={lastScan}
          onRunScan={() => void handleRunScan()}
          onSaveCookie={handleSaveCookie}
          onDeleteCookie={handleDeleteCookie}
        />
      )}

      {activeTab === "settings" && loadingOverview && !overview && (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center text-xs text-zinc-500">
          Rıza & TSA ayarları yükleniyor...
        </div>
      )}

      {activeTab === "settings" && overview && (
        <ConsentSettingsTab
          initialSettings={overview.settings}
          onSave={handleSaveSettings}
        />
      )}
    </div>
  );
}
