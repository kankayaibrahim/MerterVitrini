"use client";

import React from "react";
import {
  CheckCircle2,
  Download,
  Lock,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Stamp,
} from "lucide-react";
import type { ConsentOverviewDTO } from "./types";

interface ConsentOverviewTabProps {
  overview: ConsentOverviewDTO;
  anchoring: boolean;
  verifying: boolean;
  onAnchorNow: () => void;
  onVerifyIntegrity: () => void;
  onDownloadTSR: (anchorSeq: number) => void;
}

export default function ConsentOverviewTab({
  overview,
  anchoring,
  verifying,
  onAnchorNow,
  onVerifyIntegrity,
  onDownloadTSR,
}: ConsentOverviewTabProps) {
  const { stats, integrity, recent_anchors } = overview;

  const badgeClass = (ok: boolean) =>
    ok
      ? "inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-1 text-xs font-semibold dark:bg-emerald-950/60 dark:text-emerald-300"
      : "inline-flex items-center gap-1 rounded-full bg-red-100 text-red-800 px-2.5 py-1 text-xs font-semibold dark:bg-red-950/60 dark:text-red-300";

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-xs">
          <div className="text-xs font-semibold text-zinc-500">Toplam Rıza Kaydı (WORM)</div>
          <div className="mt-1 text-2xl font-bold text-zinc-900 dark:text-white">
            {stats.total_records}
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-zinc-500">
            <span>Tümü: {stats.accept_all_count}</span>
            <span>• Ret: {stats.reject_all_count}</span>
            <span>• Özel: {stats.custom_count}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-xs">
          <div className="text-xs font-semibold text-zinc-500">RFC 3161 TSA Mühürlü</div>
          <div className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-400">
            {stats.anchored_records}
          </div>
          <div className="mt-2 text-[11px] text-zinc-500">
            Bekleyen (Kuyrukta): <strong className="text-amber-600">{stats.unanchored_records}</strong>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-xs">
          <div className="text-xs font-semibold text-zinc-500">Merkle Zaman Damgası Sayısı</div>
          <div className="mt-1 text-2xl font-bold text-violet-700 dark:text-violet-400">
            {stats.total_anchors}
          </div>
          <div className="mt-2 text-[11px] text-zinc-500 truncate">
            Sağlayıcı: {overview.settings.tsa_primary_url}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-xs">
          <div className="text-xs font-semibold text-zinc-500">Aktif Çerez Envanteri</div>
          <div className="mt-1 text-2xl font-bold text-zinc-900 dark:text-white">
            {stats.active_cookies}
          </div>
          <div className="mt-2 text-[11px] text-zinc-500">
            Consent Mode: <strong>{overview.settings.google_consent_mode}</strong>
          </div>
        </div>
      </div>

      {/* Integrity & Action Panel */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            {integrity.overall_valid ? (
              <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <ShieldAlert className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
            )}
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                Bilirkişi Seviyesi Değiştirilemezlik & Bütünlük Denetimi
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Son Doğrulama: {integrity.verified_at_utc} • WORM Trigger + SHA-256 Zinciri + Sunucu HMAC + RFC 3161 TSA
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={verifying}
              onClick={onVerifyIntegrity}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 px-3.5 py-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${verifying ? "animate-spin" : ""}`} />
              Tam Bütünlük Denetimi Çalıştır
            </button>
            <button
              type="button"
              disabled={anchoring}
              onClick={onAnchorNow}
              className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              <Stamp className="w-3.5 h-3.5" />
              {anchoring ? "Mühürleniyor..." : "Şimdi RFC 3161 TSA ile Mühürle"}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className={badgeClass(integrity.worm_triggers_active)}>
            <Lock className="w-3 h-3" />
            WORM DB Koruması: {integrity.worm_triggers_active ? "AKTİF" : "PASİF"}
          </span>
          <span className={badgeClass(integrity.chain_valid)}>
            <CheckCircle2 className="w-3 h-3" />
            SHA-256 Zincir: {integrity.chain_valid ? "GEÇERLİ" : "BOZUK"}
          </span>
          <span className={badgeClass(integrity.hmac_valid)}>
            <CheckCircle2 className="w-3 h-3" />
            Sunucu HMAC-SHA256: {integrity.hmac_valid ? "GEÇERLİ" : "BOZUK"}
          </span>
          <span className={badgeClass(integrity.snapshots_valid)}>
            <CheckCircle2 className="w-3 h-3" />
            Politika Metni Özeti: {integrity.snapshots_valid ? "EŞLEŞİYOR" : "UYUMSUZ"}
          </span>
          <span className={badgeClass(integrity.merkle_valid && integrity.tsa_tokens_valid)}>
            <CheckCircle2 className="w-3 h-3" />
            Merkle & RFC 3161 Token: {integrity.merkle_valid && integrity.tsa_tokens_valid ? "DOĞRULANDI" : "HATA"}
          </span>
        </div>

        {integrity.violations && integrity.violations.length > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 space-y-1">
            {integrity.violations.map((v, i) => (
              <div key={i}>• {v}</div>
            ))}
          </div>
        )}
      </div>

      {/* Anchors History Table */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xs">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-3">
          Bağımsız RFC 3161 Zaman Damgası Mühürleri (Merkle Roots)
        </h3>
        {recent_anchors.length === 0 ? (
          <p className="text-xs text-zinc-500 py-4">
            Henüz mühürlenmiş RFC 3161 Merkle paketi yok. Yeni rıza kayıtları oluştuktan sonra otomatik (15 dk) veya manuel mühürleyebilirsiniz.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500">
                  <th className="py-2.5 px-3">Mühür #</th>
                  <th className="py-2.5 px-3">Kayıt Aralığı</th>
                  <th className="py-2.5 px-3">Adet</th>
                  <th className="py-2.5 px-3">Merkle Kökü (SHA-256)</th>
                  <th className="py-2.5 px-3">TSA Sağlayıcı & Seri</th>
                  <th className="py-2.5 px-3">TSA UTC Zamanı</th>
                  <th className="py-2.5 px-3 text-right">.tsr İndir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {recent_anchors.map((a) => (
                  <tr key={a.id} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40">
                    <td className="py-2.5 px-3 font-mono font-bold">#{a.anchor_seq}</td>
                    <td className="py-2.5 px-3 font-mono">
                      seq {a.seq_from}..{a.seq_to}
                    </td>
                    <td className="py-2.5 px-3">{a.record_count}</td>
                    <td className="py-2.5 px-3 font-mono text-[11px] max-w-[180px] truncate" title={a.merkle_root}>
                      {a.merkle_root}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-zinc-800 dark:text-zinc-200">{a.tsa_provider}</div>
                      <div className="font-mono text-[10px] text-zinc-500 truncate max-w-[140px]">
                        SN: {a.tsa_serial_hex}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px]">{a.tsa_gen_time_utc}</td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => onDownloadTSR(a.anchor_seq)}
                        className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-700 px-2.5 py-1 text-[11px] font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                      >
                        <Download className="w-3 h-3" />
                        .tsr
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
