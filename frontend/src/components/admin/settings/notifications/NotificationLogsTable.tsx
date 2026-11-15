"use client";

import React from "react";
import { CheckCircle2, History, Slash, XCircle } from "lucide-react";
import { getNotificationEventLabel, NotificationLogDTO } from "./types";

interface NotificationLogsTableProps {
  readonly logs: readonly NotificationLogDTO[];
}

function renderStatusBadge(status: string): React.ReactNode {
  if (status === "sent") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60 text-[11px] font-bold">
        <CheckCircle2 size={12} />
        <span>Gönderildi</span>
      </span>
    );
  }
  if (status === "skipped_disabled") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 text-[11px] font-bold">
        <Slash size={12} />
        <span>Pasif (Atlandı)</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/60 text-[11px] font-bold">
      <XCircle size={12} />
      <span>Hatalı</span>
    </span>
  );
}

export default function NotificationLogsTable({ logs }: NotificationLogsTableProps) {
  return (
    <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-6 shadow-xs flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 flex items-center justify-center">
          <History size={16} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-zinc-950 dark:text-white">Son E-Posta Gönderim Geçmişi</h3>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Sistemden çıkan son yönetici bildirimleri, günlük özet raporları ve test gönderimleri.
          </p>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="py-8 text-center text-xs text-zinc-400">
          Henüz kaydedilmiş bir yönetici e-posta gönderim logu bulunmuyor.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-bold text-zinc-500 uppercase">
                <th className="py-2.5 pr-4">Tarih / Saat</th>
                <th className="py-2.5 pr-4">Bildirim Türü</th>
                <th className="py-2.5 pr-4">Konu</th>
                <th className="py-2.5 pr-4">To / CC Alıcıları</th>
                <th className="py-2.5 text-right">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
              {logs.map((entry) => (
                <tr key={entry.id} className="align-top">
                  <td className="py-3 pr-4 whitespace-nowrap text-zinc-500 dark:text-zinc-400 font-mono text-[11px]">
                    {entry.created_at}
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap font-bold text-zinc-900 dark:text-zinc-100">
                    {getNotificationEventLabel(entry.event_key)}
                  </td>
                  <td className="py-3 pr-4 text-zinc-700 dark:text-zinc-300 max-w-xs">
                    <div className="truncate font-semibold" title={entry.subject}>
                      {entry.subject}
                    </div>
                    {entry.error_message && (
                      <div className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5 break-words">
                        {entry.error_message}
                      </div>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-[11px] text-zinc-600 dark:text-zinc-400">
                    <div>
                      <span className="font-bold text-zinc-800 dark:text-zinc-200">To:</span>{" "}
                      {entry.to_emails.length > 0 ? entry.to_emails.join(", ") : "-"}
                    </div>
                    {entry.cc_emails.length > 0 && (
                      <div>
                        <span className="font-bold text-zinc-800 dark:text-zinc-200">CC:</span>{" "}
                        {entry.cc_emails.join(", ")}
                      </div>
                    )}
                  </td>
                  <td className="py-3 text-right whitespace-nowrap">
                    {renderStatusBadge(entry.status)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
