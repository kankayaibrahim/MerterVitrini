"use client";

import React from "react";
import {
  Building2,
  Clock,
  FileBarChart2,
  Loader2,
  Send,
  ShoppingBag,
  UserPlus,
} from "lucide-react";
import EmailRecipientListInput from "./EmailRecipientListInput";
import { NotificationRuleDTO } from "./types";

interface NotificationRuleCardProps {
  readonly rule: NotificationRuleDTO;
  readonly defaultRecipients: readonly string[];
  readonly testing: boolean;
  readonly onChange: (updated: NotificationRuleDTO) => void;
  readonly onSendTest: (rule: NotificationRuleDTO) => void;
}

function renderRuleIcon(eventKey: string): React.ReactNode {
  switch (eventKey) {
    case "new_customer":
      return <UserPlus size={18} />;
    case "new_order":
      return <ShoppingBag size={18} />;
    case "daily_digest":
      return <FileBarChart2 size={18} />;
    default:
      return <Building2 size={18} />;
  }
}

function getRuleAccentClass(eventKey: string): string {
  switch (eventKey) {
    case "new_customer":
      return "bg-sky-500/10 text-sky-600";
    case "new_order":
      return "bg-emerald-500/10 text-emerald-600";
    case "daily_digest":
      return "bg-violet-500/10 text-violet-600";
    default:
      return "bg-amber-500/10 text-amber-600";
  }
}

function formatTwoDigits(value: number): string {
  return String(value).padStart(2, "0");
}

function parseTimeInput(rawTime: string): { hour: number; minute: number } {
  const parts = rawTime.split(":");
  const parsedHour = Number.parseInt(parts[0] || "21", 10);
  const parsedMinute = Number.parseInt(parts[1] || "0", 10);
  const safeHour = Number.isFinite(parsedHour) && parsedHour >= 0 && parsedHour <= 23 ? parsedHour : 21;
  const safeMinute = Number.isFinite(parsedMinute) && parsedMinute >= 0 && parsedMinute <= 59 ? parsedMinute : 0;
  return { hour: safeHour, minute: safeMinute };
}

function getYesButtonClass(enabled: boolean): string {
  if (enabled) {
    return "bg-emerald-600 text-white shadow-xs";
  }
  return "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-zinc-800";
}

function getNoButtonClass(enabled: boolean): string {
  if (!enabled) {
    return "bg-rose-600 text-white shadow-xs";
  }
  return "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-zinc-800";
}

export default function NotificationRuleCard({
  rule,
  defaultRecipients,
  testing,
  onChange,
  onSendTest,
}: NotificationRuleCardProps) {
  const isDailyDigest = rule.event_key === "daily_digest";
  const timeValue = `${formatTwoDigits(rule.schedule_hour)}:${formatTwoDigits(rule.schedule_minute)}`;

  return (
    <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-6 shadow-xs flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${getRuleAccentClass(rule.event_key)}`}>
            {renderRuleIcon(rule.event_key)}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-zinc-950 dark:text-white">{rule.title}</h3>
              {isDailyDigest && rule.last_sent_date && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                  Son otomatik özet: {rule.last_sent_date}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-2xl">
              {rule.description}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start">
          <div className="inline-flex items-center rounded-xl p-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => onChange({ ...rule, enabled: true })}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${getYesButtonClass(rule.enabled)}`}
            >
              Evet (Mail Gitsin)
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...rule, enabled: false })}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${getNoButtonClass(rule.enabled)}`}
            >
              Hayır (Pasif)
            </button>
          </div>
        </div>
      </div>

      {isDailyDigest && (
        <div className="p-4 rounded-xl bg-violet-50/60 dark:bg-violet-950/20 border border-violet-200/70 dark:border-violet-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Clock size={16} className="text-violet-600 shrink-0" />
            <div>
              <div className="text-xs font-bold text-zinc-900 dark:text-white">
                Günlük Özet Gönderim Saati (Türkiye / İstanbul Saati)
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Her gün seçtiğiniz saatte yeni üye, sipariş, eklenen/kapatılan/arşivlenen/silinen ürün sayıları otomatik gönderilir.
              </div>
            </div>
          </div>
          <input
            type="time"
            value={timeValue}
            onChange={(e) => {
              const { hour, minute } = parseTimeInput(e.target.value);
              onChange({ ...rule, schedule_hour: hour, schedule_minute: minute });
            }}
            className="px-3 py-2 rounded-xl border border-violet-200 dark:border-violet-800 bg-white dark:bg-zinc-950 text-xs font-bold text-zinc-900 dark:text-white focus:outline-hidden focus:border-violet-500"
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <EmailRecipientListInput
          label="To (Birincil Alıcı Listesi)"
          helperText="Mail doğrudan bu listedeki tüm adreslere gönderilir."
          emails={rule.to_emails}
          quickSuggestions={defaultRecipients}
          tone="to"
          onChange={(nextTo) => {
            const nextToSet = new Set(nextTo.map((item) => item.toLowerCase()));
            const filteredCC = rule.cc_emails.filter((item) => !nextToSet.has(item.toLowerCase()));
            onChange({ ...rule, to_emails: nextTo, cc_emails: filteredCC });
          }}
        />

        <EmailRecipientListInput
          label="CC (Bilgi Kopyası Listesi)"
          helperText="İsteğe bağlı olarak bilgi amaçlı kopya alacak ekip üyeleri."
          emails={rule.cc_emails}
          tone="cc"
          placeholder="cc@mertervitrini.com.tr yazıp Enter'a basın..."
          onChange={(nextCC) => {
            const toSet = new Set(rule.to_emails.map((item) => item.toLowerCase()));
            const dedupedCC = nextCC.filter((item) => !toSet.has(item.toLowerCase()));
            onChange({ ...rule, cc_emails: dedupedCC });
          }}
        />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/80">
        <span className="text-[11px] text-zinc-400">
          {rule.updated_at ? `Son güncelleme: ${rule.updated_at}` : "Varsayılan yapılandırma"}
          {rule.updated_by ? ` • ${rule.updated_by}` : ""}
        </span>

        <button
          type="button"
          onClick={() => onSendTest(rule)}
          disabled={testing}
          className="px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-xs font-bold text-zinc-800 dark:text-zinc-200 inline-flex items-center gap-1.5 disabled:opacity-50 self-end sm:self-auto cursor-pointer"
        >
          {testing ? (
            <>
              <Loader2 size={13} className="animate-spin" />
              <span>Test Gönderiliyor...</span>
            </>
          ) : (
            <>
              <Send size={13} />
              <span>Bu Kural İçin Test Maili Gönder</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
