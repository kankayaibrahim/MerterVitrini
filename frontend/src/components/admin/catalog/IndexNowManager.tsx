"use client";

import React, { useState } from "react";
import { Send, Loader2, Sparkles, AlertCircle, CheckCircle2, History, Trash2 } from "lucide-react";

interface IndexNowManagerProps {
  readonly apiUrl: string;
  readonly token: string;
}

interface SubmissionHistory {
  readonly id?: string;
  readonly timestamp: string;
  readonly urlsCount: number;
  readonly urls: readonly string[];
  readonly status: "success" | "error";
  readonly message: string;
}

export default function IndexNowManager({ apiUrl, token }: Readonly<IndexNowManagerProps>) {
  const [urlsInput, setUrlsInput] = useState("");
  const [hostDomain] = useState("mertervitrini.com.tr");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [history, setHistory] = useState<SubmissionHistory[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("indexnow_submission_history");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error("Failed to parse history", e);
        }
      }
    }
    return [];
  });

  const saveHistory = (newHistory: SubmissionHistory[]) => {
    setHistory(newHistory);
    localStorage.setItem("indexnow_submission_history", JSON.stringify(newHistory));
  };

  const handleClearHistory = () => {
    saveHistory([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const urls = urlsInput
      .split("\n")
      .map((url) => url.trim())
      .filter((url) => url.length > 0);

    if (urls.length === 0) {
      setFeedback({
        type: "error",
        message: "Lütfen en az bir adet geçerli URL adresi girin.",
      });
      return;
    }

    // Format check: ensure they start with http:// or https:// and belong to host
    const badUrls = urls.filter((url) => {
      const lower = url.toLowerCase();
      return !lower.startsWith("http://") && !lower.startsWith("https://");
    });

    if (badUrls.length > 0) {
      setFeedback({
        type: "error",
        message: "Tüm URL adresleri 'http://' veya 'https://' ile başlamalıdır.",
      });
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`${apiUrl}/api/v1/indexnow/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ urls }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "İstek başarısız oldu.");
      }

      setFeedback({
        type: "success",
        message: "URL adresleriniz başarıyla IndexNow motorlarına gönderildi!",
      });
      setUrlsInput("");

      // Add to history
      const newRecord: SubmissionHistory = {
        id: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-1`,
        timestamp: new Date().toLocaleString("tr-TR"),
        urlsCount: urls.length,
        urls: urls,
        status: "success",
        message: data.message || "Gönderim başarılı.",
      };
      saveHistory([newRecord, ...history]);

    } catch (err: unknown) {
      console.error(err);
      setFeedback({
        type: "error",
        message: (err as Error).message || "IndexNow API bağlantı hatası oluştu.",
      });

      const newRecord: SubmissionHistory = {
        id: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-2`,
        timestamp: new Date().toLocaleString("tr-TR"),
        urlsCount: urls.length,
        urls: urls,
        status: "error",
        message: (err as Error).message || "Bağlantı hatası.",
      };
      saveHistory([newRecord, ...history]);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto w-full flex flex-col gap-8 animate-in fade-in duration-200">
      {/* IndexNow Information and Entry Card */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 p-8 shadow-sm flex flex-col gap-6">
        <div>
          <h2 className="text-xl font-bold text-zinc-950 flex items-center gap-2">
            <Sparkles size={20} className="text-violet-600 animate-pulse" />
            IndexNow Arama Motoru İndeksleme Yönetimi
          </h2>
          <p className="text-xs text-zinc-500 mt-1 font-semibold leading-relaxed">
            IndexNow, web sitenizdeki içerik değişikliklerini (yeni ürün, güncellenen kategori, yeni blog yazısı) arama motorlarına (Bing, Yandex, Seznam vb.) anında bildirerek dakikalar içinde indekslenmesini sağlar.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {feedback && (
            <div
              className={`p-4 border rounded-xl text-xs font-semibold leading-relaxed flex items-start gap-2.5 ${
                feedback.type === "success"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-rose-50 border-rose-200 text-rose-800"
              }`}
            >
              {feedback.type === "success" ? (
                <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
              ) : (
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          <div className="space-y-4">
            {/* Host Domain Field */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="host-domain-input" className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                Web Sitesi Host Domain
              </label>
              <input
                id="host-domain-input"
                type="text"
                value={hostDomain}
                disabled
                className="px-4 py-2.5 bg-zinc-50 border border-zinc-200 text-zinc-400 rounded-xl text-xs font-bold cursor-not-allowed"
              />
            </div>

            {/* URL Textarea Input */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="indexnow-urls-input" className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center justify-between">
                <span>Bildirilecek URL Adresleri</span>
                <span className="text-[10px] font-semibold text-zinc-400 lowercase italic">
                  Her satıra bir adet tam URL adresi yazın
                </span>
              </label>
              <textarea
                id="indexnow-urls-input"
                value={urlsInput}
                onChange={(e) => setUrlsInput(e.target.value)}
                rows={6}
                placeholder="Örn:&#10;https://mertervitrini.com.tr/tr/blog/yeni-sezon-toptan-trendler&#10;https://mertervitrini.com.tr/en/product/123-wholesale-pants"
                className="px-4 py-3 rounded-xl border border-zinc-300 text-xs font-bold placeholder-zinc-400 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 leading-relaxed font-mono resize-y"
                required
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-zinc-100">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 text-white rounded-xl text-xs font-bold shadow-md shadow-violet-500/10 hover:shadow-violet-500/20 active:scale-[0.98] transition-all cursor-pointer border-none"
            >
              {submitting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
              {submitting ? "Gönderiliyor..." : "IndexNow Motorlarına Gönder"}
            </button>
          </div>
        </form>
      </div>

      {/* Submission History Section */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 p-8 shadow-sm flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
            <History size={16} className="text-zinc-500" />
            Manuel Gönderim Geçmişi
          </h3>
          {history.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="text-[10px] font-bold text-rose-500 hover:text-rose-700 flex items-center gap-1 bg-transparent border-none cursor-pointer"
            >
              <Trash2 size={12} />
              Geçmişi Temizle
            </button>
          )}
        </div>

        {history.length > 0 ? (
          <div className="space-y-4">
            {history.map((record) => (
              <div
                key={record.id || `${record.timestamp}-${record.urlsCount}`}
                className="p-4 border border-zinc-100 rounded-xl flex flex-col gap-3 hover:bg-zinc-50/50 transition-colors"
              >
                <div className="flex items-center justify-between text-[10px] font-semibold text-zinc-500">
                  <span>📅 {record.timestamp}</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold ${
                      record.status === "success"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-rose-50 text-rose-700"
                    }`}
                  >
                    {record.status === "success" ? "✓ Başarılı" : "✗ Hata"}
                  </span>
                </div>
                <div className="text-xs font-bold text-zinc-700">
                  {record.urlsCount} adet URL bildirildi:
                </div>
                <ul className="list-disc pl-5 text-[10px] font-bold text-zinc-500 font-mono space-y-1">
                  {record.urls.map((url) => (
                    <li key={url} className="truncate max-w-full">
                      {url}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-xs font-semibold text-zinc-400">
            Henüz manuel URL gönderim geçmişi bulunmuyor.
          </div>
        )}
      </div>
    </div>
  );
}

