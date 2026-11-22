"use client";

import React, { useState } from "react";
import { Download, Eye, FileJson, Search, ShieldCheck, X } from "lucide-react";
import type { ConsentRecordDTO } from "./types";

interface ConsentLedgerTabProps {
  records: ConsentRecordDTO[];
  total: number;
  page: number;
  loading: boolean;
  search: string;
  actionFilter: string;
  onSearchChange: (v: string) => void;
  onActionFilterChange: (v: string) => void;
  onPageChange: (p: number) => void;
  onInspectEvidence: (id: string) => Promise<Record<string, unknown> | null>;
  onExport: (format: "csv" | "json") => void;
}

export default function ConsentLedgerTab({
  records,
  total,
  page,
  loading,
  search,
  actionFilter,
  onSearchChange,
  onActionFilterChange,
  onPageChange,
  onInspectEvidence,
  onExport,
}: ConsentLedgerTabProps) {
  const [selectedEvidence, setSelectedEvidence] = useState<Record<string, unknown> | null>(null);
  const [loadingEvidenceId, setLoadingEvidenceId] = useState<string | null>(null);

  const handleOpenEvidence = async (id: string) => {
    setLoadingEvidenceId(id);
    try {
      const pack = await onInspectEvidence(id);
      if (pack) setSelectedEvidence(pack);
    } finally {
      setLoadingEvidenceId(null);
    }
  };

  const handleDownloadEvidenceJson = () => {
    if (!selectedEvidence) return;
    const rec = (selectedEvidence.record || {}) as { consent_ref_id?: string };
    const blob = new Blob([JSON.stringify(selectedEvidence, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bilirkisi-kanit-${rec.consent_ref_id || "record"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.max(1, Math.ceil(total / 25));

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Ref ID, Subject ID veya IP ara..."
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 pl-9 pr-3 py-2 text-xs"
            />
          </div>

          <select
            value={actionFilter}
            onChange={(e) => onActionFilterChange(e.target.value)}
            className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-xs"
          >
            <option value="">Tüm Eylemler</option>
            <option value="accept_all">Tümünü Kabul Et (accept_all)</option>
            <option value="reject_all">Zorunlu Dışı Ret (reject_all)</option>
            <option value="custom">Özel Tercih (custom)</option>
            <option value="withdraw">Rıza Geri Çekme (withdraw)</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onExport("csv")}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-xs font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            CSV İndir
          </button>
          <button
            type="button"
            onClick={() => onExport("json")}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-xs font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <FileJson className="w-3.5 h-3.5" />
            JSON İndir
          </button>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500">
                <th className="py-3 px-3">#Seq</th>
                <th className="py-3 px-3">Ref ID</th>
                <th className="py-3 px-3">Eylem</th>
                <th className="py-3 px-3">Kategoriler</th>
                <th className="py-3 px-3">Dil / Ülke</th>
                <th className="py-3 px-3">Maskeli IP</th>
                <th className="py-3 px-3">TSA Durumu</th>
                <th className="py-3 px-3">Tarih (UTC)</th>
                <th className="py-3 px-3 text-right">Bilirkişi Kanıtı</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-zinc-500">
                    Kayıtlar yükleniyor...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-zinc-500">
                    Eşleşen rıza kaydı bulunamadı.
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40">
                    <td className="py-2.5 px-3 font-mono font-semibold">#{r.seq_no}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-zinc-900 dark:text-white">
                      {r.consent_ref_id}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 font-semibold">
                        {r.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex flex-wrap gap-1 text-[10px]">
                        {r.consents.functionality && <span className="rounded bg-blue-100 text-blue-800 px-1.5 py-0.5">Fonk</span>}
                        {r.consents.experience && <span className="rounded bg-indigo-100 text-indigo-800 px-1.5 py-0.5">Deneyim</span>}
                        {r.consents.measurement && <span className="rounded bg-emerald-100 text-emerald-800 px-1.5 py-0.5">Ölçüm</span>}
                        {r.consents.marketing && <span className="rounded bg-amber-100 text-amber-800 px-1.5 py-0.5">Pazarlama</span>}
                        {!r.consents.functionality && !r.consents.experience && !r.consents.measurement && !r.consents.marketing && (
                          <span className="rounded bg-zinc-100 text-zinc-700 px-1.5 py-0.5">Yalnızca Zorunlu</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 uppercase font-mono">
                      {r.language} / {r.country_code || "-"}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px]">{r.ip_masked || "-"}</td>
                    <td className="py-2.5 px-3">
                      {r.anchored ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-bold">
                          <ShieldCheck className="w-3 h-3" /> Mühürlü
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-semibold">
                          Kuyrukta
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px]">{r.recorded_at_utc}</td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        disabled={loadingEvidenceId === r.id}
                        onClick={() => void handleOpenEvidence(r.id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-zinc-900 hover:bg-black text-white px-2.5 py-1 text-[11px] font-semibold cursor-pointer"
                      >
                        <Eye className="w-3 h-3" />
                        Kanıt Paketi
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800 px-4 py-3 text-xs text-zinc-500">
          <span>
            Toplam {total} kayıt • Sayfa {page} / {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-1 disabled:opacity-40 cursor-pointer"
            >
              Önceki
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-1 disabled:opacity-40 cursor-pointer"
            >
              Sonraki
            </button>
          </div>
        </div>
      </div>

      {/* Forensic Evidence Modal */}
      {selectedEvidence && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
          <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-5 py-4">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  Bilirkişi Adli Kanıt Paketi (Offline Doğrulanabilir JSON)
                </h3>
                <p className="text-xs text-zinc-500">
                  SHA-256 Kanonik Yük + Zincir Bağlantısı + Politika Metni Snapshot + Merkle & RFC 3161 TSA
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadEvidenceJson}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-3 py-1.5 text-xs font-semibold cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  JSON İndir
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedEvidence(null)}
                  className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-5 bg-zinc-950 text-emerald-300 font-mono text-[11px] leading-relaxed">
              <pre>{JSON.stringify(selectedEvidence, null, 2)}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
