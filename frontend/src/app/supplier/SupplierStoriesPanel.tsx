"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Clock,
  CreditCard,
  Eye,
  ImagePlus,
  Loader2,
  MousePointerClick,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import { SupplierProductRow } from "@/types/integration";
import {
  StoryEntitlement,
  StorySettings,
  SupplierStoryItem,
} from "@/types/stories";

const STORY_BG_COLORS = [
  "#111111",
  "#1e293b",
  "#7c2d12",
  "#4c0519",
  "#064e3b",
  "#3b0764",
];

interface SupplierStoriesPanelProps {
  readonly getToken: () => string | null;
  readonly products: readonly SupplierProductRow[];
  readonly onOpenBilling: () => void;
}

export default function SupplierStoriesPanel({
  getToken,
  products,
  onOpenBilling,
}: SupplierStoriesPanelProps) {
  const [loading, setLoading] = useState(true);
  const [snapshotNowMs, setSnapshotNowMs] = useState(0);
  const [entitlement, setEntitlement] = useState<StoryEntitlement | null>(null);
  const [settings, setSettings] = useState<StorySettings | null>(null);
  const [activeStories, setActiveStories] = useState<SupplierStoryItem[]>([]);
  const [recentStories, setRecentStories] = useState<SupplierStoryItem[]>([]);

  const [mediaUrl, setMediaUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState("");
  const [linkedProductId, setLinkedProductId] = useState("");
  const [ctaLabel, setCtaLabel] = useState("Ürünü İncele");
  const [bgColor, setBgColor] = useState("#111111");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  const loadStories = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/v1/supplier/stories", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (res.ok) {
        const data = (await res.json()) as {
          entitlement?: StoryEntitlement;
          settings?: StorySettings;
          active_stories?: SupplierStoryItem[];
          recent_stories?: SupplierStoryItem[];
        };
        setEntitlement(data.entitlement ?? null);
        setSettings(data.settings ?? null);
        setActiveStories(data.active_stories ?? []);
        setRecentStories(data.recent_stories ?? []);
        setSnapshotNowMs(Date.now());
      }
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void loadStories();
    }, 0);
    return () => window.clearTimeout(t);
  }, [loadStories]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const token = getToken();
    if (!token) return;

    setUploading(true);
    setFeedback(null);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/v1/supplier/stories/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = (await res.json().catch(() => ({}))) as {
        media_url?: string;
        error?: string;
      };
      if (!res.ok || !data.media_url) {
        setFeedback({
          type: "err",
          text: data.error || "Hikaye görseli yüklenemedi.",
        });
        return;
      }
      setMediaUrl(data.media_url);
    } catch {
      setFeedback({ type: "err", text: "Görsel yükleme sırasında bağlantı hatası." });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handlePublishStory = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getToken();
    if (!token) return;
    if (!mediaUrl.trim()) {
      setFeedback({
        type: "err",
        text: "Lütfen önce hikaye için bir görsel yükleyin.",
      });
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/v1/supplier/stories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          media_url: mediaUrl.trim(),
          caption: caption.trim(),
          linked_product_id: linkedProductId || undefined,
          cta_label: ctaLabel.trim(),
          bg_color: bgColor,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        entitlement?: StoryEntitlement;
      };
      if (!res.ok) {
        if (data.entitlement) {
          setEntitlement(data.entitlement);
        }
        setFeedback({
          type: "err",
          text: data.error || "Hikaye yayınlanamadı.",
        });
        return;
      }

      setMediaUrl("");
      setCaption("");
      setLinkedProductId("");
      setFeedback({
        type: "ok",
        text: data.message || "Hikayeniz 24 saat boyunca vitrinde yayına alındı.",
      });
      void loadStories();
    } catch {
      setFeedback({ type: "err", text: "Sunucu bağlantı hatası." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteStory = async (storyId: string) => {
    const token = getToken();
    if (!token) return;
    const res = await fetch(`/api/v1/supplier/stories/${encodeURIComponent(storyId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setFeedback({ type: "ok", text: "Hikaye vitrinden kaldırıldı." });
      void loadStories();
    }
  };

  const activeProducts = products.filter((p) => p.is_active && !p.is_archived);
  const dailyLimit = entitlement?.daily_limit ?? settings?.paid_daily_limit ?? 8;
  const usedCount = entitlement?.used_last_24h ?? 0;
  const remainingCount = entitlement?.remaining_24h ?? Math.max(0, dailyLimit - usedCount);
  const quotaPct = dailyLimit > 0 ? Math.min(100, Math.round((usedCount / dailyLimit) * 100)) : 0;
  const canPublishNow = Boolean(entitlement?.can_publish) && remainingCount > 0;

  return (
    <div className="space-y-6">
      {/* Quota & Paid Plan Status Header */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#D4AF37] via-[#E1306C] to-[#F77737] text-white flex items-center justify-center shrink-0">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Instagram Tarzı Üretici Hikayeleri (24 Saatlik)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Ana sayfa vitrininde ve firma profilinizde 24 saat boyunca üst sırada görünen dikey hikaye kartları paylaşın.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void loadStories()}
            className="h-9 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 inline-flex items-center gap-1.5 cursor-pointer self-start"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Yenile</span>
          </button>
        </div>

        {/* Quota Progress */}
        <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
            <span className="text-slate-800 flex items-center gap-1.5">
              <Clock size={14} className="text-rose-600" />
              <span>
                Son 24 Saat Kullanımı: {usedCount} / {dailyLimit} Hikaye (Kalan: {remainingCount})
              </span>
            </span>

            {entitlement?.is_paid_mode ? (
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                  entitlement.can_publish
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-amber-50 text-amber-800 border border-amber-200"
                }`}
              >
                {entitlement.can_publish
                  ? `Ücretli Paket Aktif (${dailyLimit} Hikaye / 24s)`
                  : "Ücretli Paket Gerekiyor"}
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-extrabold">
                Lansman Ücretsiz Dönemi Aktif (Ücretli Limiti: {settings?.paid_daily_limit ?? 8} / 24s)
              </span>
            )}
          </div>

          <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                remainingCount === 0
                  ? "bg-red-500"
                  : "bg-gradient-to-r from-[#D4AF37] via-[#E1306C] to-[#F77737]"
              }`}
              style={{ width: `${quotaPct}%` }}
            />
          </div>

          {entitlement?.next_slot_at && remainingCount === 0 && (
            <p className="text-[11px] font-bold text-amber-800">
              24 saatlik limitiniz doldu. Bir sonraki hikaye hakkınız:{" "}
              {new Date(entitlement.next_slot_at).toLocaleString("tr-TR")}
            </p>
          )}
        </div>

        {entitlement && !entitlement.can_publish && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 text-amber-900">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <div className="text-xs space-y-0.5">
                <p className="font-extrabold">
                  Hikaye yayınlama özelliği şu an ücretli abonelik paketlerine özeldir.
                </p>
                <p className="text-amber-800">
                  Ücretli vitrin paketine geçerek 24 saat içinde 8 adede kadar hikaye paylaşabilirsiniz.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenBilling}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer shrink-0 border-none"
            >
              <CreditCard size={14} />
              <span>Üyelik &amp; Paketler</span>
            </button>
          </div>
        )}

        {feedback && (
          <div
            className={`px-4 py-3 rounded-xl border text-xs font-bold ${
              feedback.type === "ok"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-red-50 border-red-200 text-red-700"
            }`}
          >
            {feedback.text}
          </div>
        )}
      </div>

      {/* Composer + Live 9:16 Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form
          onSubmit={handlePublishStory}
          className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-4"
        >
          <h3 className="text-sm font-extrabold text-slate-900">
            Yeni 24 Saatlik Hikaye Oluştur
          </h3>

          <div className="space-y-2">
            <span className="block text-xs font-bold text-slate-700">
              1. Hikaye Görseli (Önerilen: Dikey 9:16) *
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold cursor-pointer transition-colors">
                {uploading ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <ImagePlus size={15} />
                )}
                <span>{uploading ? "Yükleniyor..." : "Görsel Seç / Yükle"}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={uploading || !canPublishNow}
                  onChange={(e) => void handleFileUpload(e)}
                  className="hidden"
                />
              </label>

              {mediaUrl && (
                <span className="text-[11px] font-bold text-emerald-700">
                  ✓ Görsel hazır
                </span>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              2. Hikaye Açıklaması / Duyuru Metni (Opsiyonel)
            </label>
            <textarea
              rows={2}
              maxLength={300}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Örn: Yeni sezon %100 pamuklu oversize ikili takımlar stoklarda! 4 renk serili..."
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-slate-900"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                3. Bağlı Ürün (Opsiyonel CTA Linki)
              </label>
              <select
                value={linkedProductId}
                onChange={(e) => setLinkedProductId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs bg-white"
              >
                <option value="">Sadece Firma Vitrinine Yönlendir</option>
                {activeProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({p.custom_sku})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Buton Metni
              </label>
              <input
                type="text"
                maxLength={60}
                value={ctaLabel}
                onChange={(e) => setCtaLabel(e.target.value)}
                placeholder="Ürünü İncele"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600">Zemin Tonu:</span>
              {STORY_BG_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setBgColor(c)}
                  className={`w-6 h-6 rounded-full cursor-pointer border-2 ${
                    bgColor === c ? "border-amber-500 scale-110" : "border-slate-200"
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={c}
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={submitting || !canPublishNow || !mediaUrl}
              className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-[#D4AF37] via-[#E1306C] to-[#F77737] text-white text-xs font-black inline-flex items-center gap-2 cursor-pointer border-none disabled:opacity-45 shadow-sm"
            >
              {submitting ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Send size={15} />
              )}
              <span>{submitting ? "Yayınlanıyor..." : "24 Saatlik Hikaye Yayınla"}</span>
            </button>
          </div>
        </form>

        {/* Live 9:16 Mobile Preview */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col items-center justify-center">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-3">
            Canlı 9:16 Mobil Ön İzleme
          </span>
          <div
            className="w-[210px] aspect-[9/16] rounded-2xl overflow-hidden relative shadow-lg border border-slate-200 flex flex-col justify-between p-3 text-white"
            style={{ backgroundColor: bgColor }}
          >
            {mediaUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mediaUrl}
                alt="Preview"
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
            <div className="relative z-10 h-1 w-full rounded-full bg-white/80" />
            <div className="relative z-10 space-y-2 mt-auto">
              {caption && (
                <p className="text-[11px] font-bold leading-snug drop-shadow-md">
                  {caption}
                </p>
              )}
              <div className="w-full py-1.5 rounded-lg bg-white text-slate-900 text-[10px] font-black text-center">
                {ctaLabel || "Ürünü İncele"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Active & Recent Stories List */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-4">
        <h3 className="text-sm font-extrabold text-slate-900">
          Aktif ve Son Yayınlanan Hikayeler ({activeStories.length} Aktif)
        </h3>

        {activeStories.length === 0 && recentStories.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">
            Henüz hikaye yayınlamadınız. Yukarıdan yeni sezon ürünlerinizi 24 saatlik hikaye olarak öne çıkarabilirsiniz.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...activeStories, ...recentStories].map((st) => {
              const isLive =
                st.is_active &&
                (snapshotNowMs === 0 || new Date(st.expires_at).getTime() > snapshotNowMs);
              return (
                <div
                  key={st.id}
                  className="rounded-xl border border-slate-200 p-3 flex items-start gap-3 bg-slate-50/50"
                >
                  <div className="w-14 aspect-[9/16] rounded-lg overflow-hidden bg-slate-200 shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={st.media_url}
                      alt={st.caption || "Story"}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                          isLive
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {isLive ? "Yayında (24s)" : "Süresi Doldu"}
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleDeleteStory(st.id)}
                        className="p-1 text-slate-400 hover:text-red-600 bg-transparent border-none cursor-pointer"
                        title="Hikayeyi Kaldır"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <p className="text-xs font-bold text-slate-800 line-clamp-2">
                      {st.caption || "(Açıklamasız hikaye)"}
                    </p>
                    <div className="flex items-center gap-3 text-[11px] font-bold text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Eye size={12} /> {st.view_count}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MousePointerClick size={12} /> {st.click_count}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Bitiş: {new Date(st.expires_at).toLocaleString("tr-TR")}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
