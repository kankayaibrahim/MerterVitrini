"use client";

import React, { useState } from "react";
import { AlertOctagon, ChevronDown, ChevronUp, Loader2, Save, ShieldAlert } from "lucide-react";
import { ExceptionAlertConfigDTO, ExceptionAlertStatusDTO } from "./types";

interface ExceptionAlertConfigCardProps {
  readonly config: ExceptionAlertConfigDTO;
  readonly status: ExceptionAlertStatusDTO;
  readonly loading: boolean;
  readonly saving: boolean;
  readonly onChange: (next: ExceptionAlertConfigDTO) => void;
  readonly onSave: () => void;
}

export default function ExceptionAlertConfigCard({
  config,
  status,
  loading,
  saving,
  onChange,
  onSave,
}: ExceptionAlertConfigCardProps) {
  const [showRecent, setShowRecent] = useState(false);

  if (loading) {
    return (
      <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-6 flex items-center gap-3 text-xs text-zinc-400">
        <Loader2 size={18} className="animate-spin text-rose-600" />
        <span>Exception ve yoğun hata alarm parametreleri yükleniyor...</span>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-rose-200/80 dark:border-rose-900/60 p-6 shadow-xs flex flex-col gap-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
            <AlertOctagon size={20} />
          </div>
          <div>
            <h2 className="text-base font-bold text-zinc-950 dark:text-white flex items-center gap-2">
              <span>Yoğun Hata &amp; Kritik Exception Mail Parametreleri</span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Aşağıdaki eşiklerden herhangi biri aşıldığında{" "}
              <code className="font-mono font-bold">Kritik Sistem Hatası &amp; Yoğun 5xx Alarmı</code> kanalındaki To/CC alıcılarına teknik rapor gönderilir.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          <span>{saving ? "Kaydediliyor..." : "Hata Alarm Parametrelerini Kaydet"}</span>
        </button>
      </div>

      {/* Live Telemetry Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800 p-3">
          <div className="text-[11px] text-zinc-500">Aktif Penceredeki Hata</div>
          <div className="text-lg font-bold text-zinc-950 dark:text-white mt-0.5">
            {status.window_error_count} / {config.burst_threshold}
          </div>
        </div>
        <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800 p-3">
          <div className="text-[11px] text-zinc-500">Son 1 Saatte Atılan Mail</div>
          <div className="text-lg font-bold text-zinc-950 dark:text-white mt-0.5">
            {status.emails_sent_last_hour} / {config.max_emails_per_hour}
          </div>
        </div>
        <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800 p-3">
          <div className="text-[11px] text-zinc-500">Yakalanan / Susturulan</div>
          <div className="text-lg font-bold text-zinc-950 dark:text-white mt-0.5">
            {status.total_captured} / {status.total_suppressed}
          </div>
        </div>
        <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800 p-3">
          <div className="text-[11px] text-zinc-500">Son Alarm Zamanı</div>
          <div className="text-xs font-mono font-bold text-zinc-900 dark:text-zinc-200 mt-1 truncate">
            {status.last_alert_sent_at || "Henüz yok"}
          </div>
        </div>
      </div>

      {/* Event Type Switches */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <label className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 cursor-pointer">
          <div>
            <div className="font-bold text-zinc-900 dark:text-white">Sunucu Panic Çökmesi</div>
            <div className="text-[11px] text-zinc-500">Eşik beklemeden anında mail atar</div>
          </div>
          <input
            type="checkbox"
            checked={config.alert_on_panic}
            onChange={(e) => onChange({ ...config, alert_on_panic: e.target.checked })}
          />
        </label>

        <label className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 cursor-pointer">
          <div>
            <div className="font-bold text-zinc-900 dark:text-white">HTTP 5xx (500/502/503)</div>
            <div className="text-[11px] text-zinc-500">Yoğun sunucu hatası patlamalarını sayar</div>
          </div>
          <input
            type="checkbox"
            checked={config.alert_on_http_5xx}
            onChange={(e) => onChange({ ...config, alert_on_http_5xx: e.target.checked })}
          />
        </label>

        <label className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 cursor-pointer">
          <div>
            <div className="font-bold text-zinc-900 dark:text-white">Kritik Logger Hataları</div>
            <div className="text-[11px] text-zinc-500">DB, cron &amp; servis `[ERROR]` kayıtları</div>
          </div>
          <input
            type="checkbox"
            checked={config.alert_on_error_logs}
            onChange={(e) => onChange({ ...config, alert_on_error_logs: e.target.checked })}
          />
        </label>
      </div>

      {/* Numeric Threshold Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <label className="space-y-1">
          <span className="font-bold text-zinc-700 dark:text-zinc-300">Patlama Eşiği (Adet)</span>
          <input
            type="number"
            min={1}
            max={500}
            value={config.burst_threshold}
            onChange={(e) =>
              onChange({ ...config, burst_threshold: Math.max(1, Number(e.target.value) || 1) })
            }
            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-3 py-2 font-bold"
          />
        </label>

        <label className="space-y-1">
          <span className="font-bold text-zinc-700 dark:text-zinc-300">Ölçüm Penceresi (Dakika)</span>
          <input
            type="number"
            min={1}
            max={60}
            value={config.window_minutes}
            onChange={(e) =>
              onChange({ ...config, window_minutes: Math.max(1, Number(e.target.value) || 1) })
            }
            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-3 py-2 font-bold"
          />
        </label>

        <label className="space-y-1">
          <span className="font-bold text-zinc-700 dark:text-zinc-300">Bekleme / Cooldown (Dk)</span>
          <input
            type="number"
            min={1}
            max={1440}
            value={config.cooldown_minutes}
            onChange={(e) =>
              onChange({ ...config, cooldown_minutes: Math.max(1, Number(e.target.value) || 1) })
            }
            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-3 py-2 font-bold"
          />
        </label>

        <label className="space-y-1">
          <span className="font-bold text-zinc-700 dark:text-zinc-300">Saatlik Max Mail Limiti</span>
          <input
            type="number"
            min={1}
            max={60}
            value={config.max_emails_per_hour}
            onChange={(e) =>
              onChange({ ...config, max_emails_per_hour: Math.max(1, Number(e.target.value) || 1) })
            }
            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-3 py-2 font-bold"
          />
        </label>
      </div>

      {/* Ignored Patterns */}
      <label className="space-y-1.5 text-xs">
        <span className="font-bold text-zinc-700 dark:text-zinc-300">
          Yok Sayılacak Gürültü Kalıpları (Her satıra bir alt metin — büyük/küçük harf duyarsız)
        </span>
        <textarea
          rows={3}
          value={config.ignored_patterns.join("\n")}
          onChange={(e) =>
            onChange({
              ...config,
              ignored_patterns: e.target.value.split(/\r?\n/),
            })
          }
          className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-3 py-2 font-mono text-[11px]"
          placeholder="Failed to find Server Action&#10;context canceled"
        />
      </label>

      {/* Collapsible Recent Captured Events */}
      <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
        <button
          type="button"
          onClick={() => setShowRecent((prev) => !prev)}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 cursor-pointer"
        >
          <ShieldAlert size={14} className="text-rose-500" />
          <span>Bellekte Yakalanan Son Hatalar ({status.recent_events.length})</span>
          {showRecent ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {showRecent && (
          <div className="mt-3 max-h-56 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-900 text-[11px]">
            {status.recent_events.length === 0 ? (
              <div className="p-4 text-center text-zinc-400">
                Sunucu başlangıcından bu yana alarm eşiğine aday hata yakalanmadı.
              </div>
            ) : (
              status.recent_events.map((ev, idx) => (
                <div key={`${ev.timestamp}-${idx}`} className="p-2.5 flex flex-col gap-0.5">
                  <div className="flex items-center justify-between gap-2 font-mono">
                    <span className="font-bold text-rose-600">
                      [{ev.severity}] {ev.source}
                    </span>
                    <span className="text-zinc-400">{ev.timestamp}</span>
                  </div>
                  <div className="text-zinc-700 dark:text-zinc-300 break-words">{ev.message}</div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
