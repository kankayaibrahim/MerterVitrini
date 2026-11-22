"use client";

import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Info,
  Loader2,
  Save,
} from "lucide-react";
import DailyDigestLiveCard from "./DailyDigestLiveCard";
import ExceptionAlertConfigCard from "./ExceptionAlertConfigCard";
import NotificationLogsTable from "./NotificationLogsTable";
import NotificationRuleCard from "./NotificationRuleCard";
import {
  DailyDigestPreviewDTO,
  ExceptionAlertConfigDTO,
  ExceptionAlertConfigResponse,
  ExceptionAlertStatusDTO,
  NotificationFeedback,
  NotificationLogDTO,
  NotificationRuleDTO,
  NotificationsSettingsResponse,
} from "./types";

interface NotificationsManagerProps {
  readonly apiUrl: string;
  readonly token: string;
}

const FALLBACK_DEFAULT_RECIPIENTS = [
  "kankayaibrahim@gmail.com",
  "carnavaltedarik@gmail.com",
];

function buildAuthHeaders(token: string, jsonContent: boolean): Record<string, string> {
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (jsonContent) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
}

async function parseErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const payload = (await res.json()) as { error?: string; message?: string };
    return payload.error || payload.message || fallback;
  } catch {
    return fallback;
  }
}

type SettingsFetchResult =
  | { ok: true; data: NotificationsSettingsResponse }
  | { ok: false; error: string };

async function requestNotificationsSettings(
  apiUrl: string,
  token: string,
): Promise<SettingsFetchResult> {
  try {
    const res = await fetch(`${apiUrl}/api/v1/admin/notifications/settings`, {
      headers: buildAuthHeaders(token, false),
    });
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Bildirim ayarları yüklenemedi.");
      return { ok: false, error: msg };
    }
    const data = (await res.json()) as NotificationsSettingsResponse;
    return { ok: true, data };
  } catch {
    return {
      ok: false,
      error: "Bildirim ayarları alınırken bağlantı hatası oluştu.",
    };
  }
}

async function requestDailyDigestPreview(
  apiUrl: string,
  token: string,
): Promise<DailyDigestPreviewDTO | null> {
  try {
    const res = await fetch(`${apiUrl}/api/v1/admin/notifications/digest-preview`, {
      headers: buildAuthHeaders(token, false),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { digest?: DailyDigestPreviewDTO };
    return data.digest ?? null;
  } catch {
    return null;
  }
}

async function requestExceptionAlertConfig(
  apiUrl: string,
  token: string,
): Promise<ExceptionAlertConfigResponse | null> {
  try {
    const res = await fetch(`${apiUrl}/api/v1/admin/notifications/exception-config`, {
      headers: buildAuthHeaders(token, false),
    });
    if (!res.ok) return null;
    return (await res.json()) as ExceptionAlertConfigResponse;
  } catch {
    return null;
  }
}

const DEFAULT_EXCEPTION_CONFIG: ExceptionAlertConfigDTO = {
  alert_on_panic: true,
  alert_on_http_5xx: true,
  alert_on_error_logs: true,
  burst_threshold: 5,
  window_minutes: 5,
  cooldown_minutes: 15,
  max_emails_per_hour: 6,
  ignored_patterns: ["Failed to find Server Action", "context canceled"],
};

const EMPTY_EXCEPTION_STATUS: ExceptionAlertStatusDTO = {
  window_error_count: 0,
  emails_sent_last_hour: 0,
  total_captured: 0,
  total_suppressed: 0,
  last_alert_sent_at: "",
  recent_events: [],
};

function validateRulesBeforeSave(rules: NotificationRuleDTO[]): string | null {
  for (const rule of rules) {
    if (rule.enabled && rule.to_emails.length === 0) {
      return `"${rule.title}" aktifken en az bir To (Alıcı) e-posta adresi girmelisiniz.`;
    }
  }
  return null;
}

export default function NotificationsManager({ apiUrl, token }: NotificationsManagerProps) {
  const [rules, setRules] = useState<NotificationRuleDTO[]>([]);
  const [logs, setLogs] = useState<NotificationLogDTO[]>([]);
  const [defaultRecipients, setDefaultRecipients] = useState<string[]>(FALLBACK_DEFAULT_RECIPIENTS);
  const [serverTime, setServerTime] = useState<string>("");
  const [digestPreview, setDigestPreview] = useState<DailyDigestPreviewDTO | null>(null);

  const [loadingSettings, setLoadingSettings] = useState(true);
  const [loadingDigest, setLoadingDigest] = useState(true);
  const [loadingExceptionCfg, setLoadingExceptionCfg] = useState(true);
  const [savingExceptionCfg, setSavingExceptionCfg] = useState(false);
  const [exceptionConfig, setExceptionConfig] = useState<ExceptionAlertConfigDTO>(DEFAULT_EXCEPTION_CONFIG);
  const [exceptionStatus, setExceptionStatus] = useState<ExceptionAlertStatusDTO>(EMPTY_EXCEPTION_STATUS);
  const [saving, setSaving] = useState(false);
  const [sendingDigest, setSendingDigest] = useState(false);
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [feedback, setFeedback] = useState<NotificationFeedback | null>(null);

  const applySettingsResponse = (data: NotificationsSettingsResponse) => {
    setRules(data.settings || []);
    setLogs(data.recent_logs || []);
    if (Array.isArray(data.default_recipients) && data.default_recipients.length > 0) {
      setDefaultRecipients([...data.default_recipients]);
    }
    setServerTime(data.server_time_istanbul || "");
    setIsDirty(false);
  };

  useEffect(() => {
    if (!apiUrl || !token) return;
    let cancelled = false;

    void requestNotificationsSettings(apiUrl, token)
      .then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          setFeedback({ type: "error", text: result.error });
        } else {
          setRules(result.data.settings || []);
          setLogs(result.data.recent_logs || []);
          if (
            Array.isArray(result.data.default_recipients) &&
            result.data.default_recipients.length > 0
          ) {
            setDefaultRecipients([...result.data.default_recipients]);
          }
          setServerTime(result.data.server_time_istanbul || "");
          setIsDirty(false);
        }
        setLoadingSettings(false);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadingSettings(false);
        }
      });

    void requestDailyDigestPreview(apiUrl, token)
      .then((preview) => {
        if (cancelled) return;
        if (preview) {
          setDigestPreview(preview);
        }
        setLoadingDigest(false);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadingDigest(false);
        }
      });

    void requestExceptionAlertConfig(apiUrl, token)
      .then((res) => {
        if (cancelled) return;
        if (res?.config) {
          setExceptionConfig(res.config);
        }
        if (res?.status) {
          setExceptionStatus(res.status);
        }
        setLoadingExceptionCfg(false);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadingExceptionCfg(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [apiUrl, token]);

  const reloadSettingsSilently = async () => {
    if (!apiUrl || !token) return;
    const result = await requestNotificationsSettings(apiUrl, token);
    if (!result.ok) {
      setFeedback({ type: "error", text: result.error });
      return;
    }
    applySettingsResponse(result.data);
  };

  const handleRefreshDigest = async () => {
    if (!apiUrl || !token) return;
    setLoadingDigest(true);
    const preview = await requestDailyDigestPreview(apiUrl, token);
    if (preview) {
      setDigestPreview(preview);
    }
    setLoadingDigest(false);
  };

  const handleRuleChange = (updated: NotificationRuleDTO) => {
    setRules((prev) => prev.map((item) => (item.event_key === updated.event_key ? updated : item)));
    setIsDirty(true);
    if (feedback) {
      setFeedback(null);
    }
  };

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiUrl || !token) return;

    const validationError = validateRulesBeforeSave(rules);
    if (validationError) {
      setFeedback({ type: "error", text: validationError });
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      const payload = {
        settings: rules.map((r) => ({
          event_key: r.event_key,
          enabled: r.enabled,
          to_emails: r.to_emails,
          cc_emails: r.cc_emails,
          schedule_hour: r.schedule_hour,
          schedule_minute: r.schedule_minute,
        })),
      };
      const res = await fetch(`${apiUrl}/api/v1/admin/notifications/settings`, {
        method: "PUT",
        headers: buildAuthHeaders(token, true),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const msg = await parseErrorMessage(res, "Ayarlar kaydedilemedi.");
        setFeedback({ type: "error", text: msg });
        return;
      }
      const data = (await res.json()) as { message?: string; settings?: NotificationRuleDTO[] };
      if (Array.isArray(data.settings)) {
        setRules(data.settings);
      }
      setIsDirty(false);
      setFeedback({ type: "success", text: data.message || "Bildirim ayarları başarıyla kaydedildi." });
    } catch {
      setFeedback({ type: "error", text: "Ayarlar kaydedilirken ağ hatası oluştu." });
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async (rule: NotificationRuleDTO) => {
    if (!apiUrl || !token) return;
    setTestingKey(rule.event_key);
    setFeedback(null);
    try {
      const res = await fetch(`${apiUrl}/api/v1/admin/notifications/test`, {
        method: "POST",
        headers: buildAuthHeaders(token, true),
        body: JSON.stringify({
          event_key: rule.event_key,
          to_emails: rule.to_emails,
          cc_emails: rule.cc_emails,
        }),
      });
      if (!res.ok) {
        const msg = await parseErrorMessage(res, "Test e-postası gönderilemedi.");
        setFeedback({ type: "error", text: msg });
        await reloadSettingsSilently();
        return;
      }
      const data = (await res.json()) as { message?: string };
      setFeedback({ type: "success", text: data.message || "Test e-postası başarıyla gönderildi." });
      await reloadSettingsSilently();
    } catch {
      setFeedback({ type: "error", text: "Test e-postası gönderilirken ağ hatası oluştu." });
    } finally {
      setTestingKey(null);
    }
  };

  const handleSendDigestNow = async () => {
    if (!apiUrl || !token) return;
    const digestRule = rules.find((r) => r.event_key === "daily_digest");
    setSendingDigest(true);
    setFeedback(null);
    try {
      const res = await fetch(`${apiUrl}/api/v1/admin/notifications/send-digest-now`, {
        method: "POST",
        headers: buildAuthHeaders(token, true),
        body: JSON.stringify({
          to_emails: digestRule?.to_emails || defaultRecipients,
          cc_emails: digestRule?.cc_emails || [],
        }),
      });
      if (!res.ok) {
        const msg = await parseErrorMessage(res, "Günlük özet raporu gönderilemedi.");
        setFeedback({ type: "error", text: msg });
        await reloadSettingsSilently();
        return;
      }
      const data = (await res.json()) as { message?: string; digest?: DailyDigestPreviewDTO };
      if (data.digest) {
        setDigestPreview(data.digest);
      }
      setFeedback({ type: "success", text: data.message || "Günlük özet raporu başarıyla gönderildi." });
      await reloadSettingsSilently();
    } catch {
      setFeedback({ type: "error", text: "Günlük özet gönderilirken bağlantı hatası oluştu." });
    } finally {
      setSendingDigest(false);
    }
  };

  const handleSaveExceptionConfig = async () => {
    if (!apiUrl || !token) return;
    setSavingExceptionCfg(true);
    setFeedback(null);
    try {
      const cleanedPatterns = exceptionConfig.ignored_patterns
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
      const res = await fetch(`${apiUrl}/api/v1/admin/notifications/exception-config`, {
        method: "PUT",
        headers: buildAuthHeaders(token, true),
        body: JSON.stringify({
          ...exceptionConfig,
          ignored_patterns: cleanedPatterns,
        }),
      });
      if (!res.ok) {
        const msg = await parseErrorMessage(res, "Exception alarm parametreleri kaydedilemedi.");
        setFeedback({ type: "error", text: msg });
        return;
      }
      const data = (await res.json()) as ExceptionAlertConfigResponse;
      if (data.config) setExceptionConfig(data.config);
      if (data.status) setExceptionStatus(data.status);
      setFeedback({ type: "success", text: data.message || "Hata alarm parametreleri kaydedildi." });
    } catch {
      setFeedback({ type: "error", text: "Exception ayarları kaydedilirken bağlantı hatası oluştu." });
    } finally {
      setSavingExceptionCfg(false);
    }
  };

  const topSaveLabel = isDirty ? "Değişiklikleri Kaydet *" : "Tüm Ayarları Kaydet";

  return (
    <div className="max-w-5xl mx-auto w-full flex flex-col gap-6">
      {/* Header Bar */}
      <div className="bg-white dark:bg-zinc-950 p-6 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
            <Bell size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-950 dark:text-white">
              Yönetici E-Posta &amp; Bildirim Merkezi
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Yeni müşteri kaydı, yeni sipariş, tedarikçi başvurusu ve günlük B2B özet raporlarının{" "}
              <strong>Evet/Hayır</strong> durumlarını, <strong>To / CC</strong> alıcılarını ve gönderim saatini yönetin.
            </p>
            {serverTime && (
              <p className="text-[11px] font-semibold text-zinc-400 mt-1">
                Sunucu Saati (İstanbul): {serverTime}
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            void handleSaveAll(e);
          }}
          disabled={saving || loadingSettings}
          className="px-5 py-2.5 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-bold text-xs hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-all inline-flex items-center gap-2 shadow-xs disabled:opacity-50 shrink-0 cursor-pointer"
        >
          {saving ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              <span>Kaydediliyor...</span>
            </>
          ) : (
            <>
              <Save size={14} />
              <span>{topSaveLabel}</span>
            </>
          )}
        </button>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
            feedback.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300"
              : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 size={16} className="shrink-0" />
          ) : (
            <AlertTriangle size={16} className="shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* IPv6 Clarification Box */}
      <div className="p-4 rounded-xl bg-sky-50/70 dark:bg-sky-950/25 border border-sky-200/80 dark:border-sky-900/60 flex items-start gap-3">
        <Info size={16} className="text-sky-600 shrink-0 mt-0.5" />
        <div className="text-xs text-sky-900 dark:text-sky-200 leading-relaxed">
          <strong>Müşteri E-Postalarındaki IPv6 Adresleri Hakkında:</strong> Gelen kayıtlardaki IPv6 adresleri
          Cloudflare <code className="font-mono font-bold">CF-Connecting-IP</code> başlığından doğrudan alınan gerçek
          müşteri IP adresleridir. Türkiye ve dünya genelindeki mobil operatörler (Turkcell/Vodafone/Türk Telekom 4.5G-5G)
          ve modern fiber ISS&apos;ler Cloudflare kenar sunucularına yerel IPv6 ile bağlandığı için bu durum normaldir ve
          coğrafi konum çözümlemesi IPv6 üzerinden doğru şekilde yapılır.
        </div>
      </div>

      {/* Live Daily Digest Card */}
      <DailyDigestLiveCard
        preview={digestPreview}
        loading={loadingDigest}
        sendingDigest={sendingDigest}
        onRefresh={() => {
          void handleRefreshDigest();
        }}
        onSendNow={() => {
          void handleSendDigestNow();
        }}
      />

      {/* Parametric Exception Alert Thresholds */}
      <ExceptionAlertConfigCard
        config={exceptionConfig}
        status={exceptionStatus}
        loading={loadingExceptionCfg}
        saving={savingExceptionCfg}
        onChange={setExceptionConfig}
        onSave={() => {
          void handleSaveExceptionConfig();
        }}
      />

      {/* Rules List */}
      {loadingSettings ? (
        <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 py-16 flex flex-col items-center justify-center gap-3">
          <Loader2 size={28} className="animate-spin text-violet-600" />
          <span className="text-xs font-semibold text-zinc-400">E-posta ve bildirim kuralları yükleniyor...</span>
        </div>
      ) : (
        <form onSubmit={(e) => { void handleSaveAll(e); }} className="flex flex-col gap-4">
          {rules.map((rule) => (
            <NotificationRuleCard
              key={rule.event_key}
              rule={rule}
              defaultRecipients={defaultRecipients}
              testing={testingKey === rule.event_key}
              onChange={handleRuleChange}
              onSendTest={(targetRule) => {
                void handleSendTest(targetRule);
              }}
            />
          ))}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-bold text-xs hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-all inline-flex items-center gap-2 shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Kaydediliyor...</span>
                </>
              ) : (
                <>
                  <Save size={14} />
                  <span>Tüm Bildirim Ayarlarını Kaydet</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Recent Logs */}
      <NotificationLogsTable logs={logs} />
    </div>
  );
}
