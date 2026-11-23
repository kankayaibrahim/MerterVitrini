"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Eye,
  ImagePlus,
  Loader2,
  MousePointerClick,
  Plus,
  Save,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";
import { PublicStoryItem as StoryItemDTO, StorySettings } from "@/types/stories";

interface AdminStoriesSupplierRef {
  id: string;
  name: string;
  alias_code: string;
}

interface AdminStoriesTabProps {
  readonly suppliers: readonly AdminStoriesSupplierRef[];
  readonly fetchWithConfig: (url: string, init?: RequestInit) => Promise<Response>;
}

export default function AdminStoriesTab({
  suppliers,
  fetchWithConfig,
}: AdminStoriesTabProps) {
  const [loading, setLoading] = useState(true);
  const [snapshotNowMs, setSnapshotNowMs] = useState(0);
  const [stories, setStories] = useState<StoryItemDTO[]>([]);
  const [summary, setSummary] = useState({
    active_count: 0,
    total_views: 0,
    total_clicks: 0,
    active_brands_count: 0,
  });

  // Settings form
  const [isPaidMode, setIsPaidMode] = useState(false);
  const [paidDailyLimit, setPaidDailyLimit] = useState("8");
  const [freeDailyLimit, setFreeDailyLimit] = useState("8");
  const [storyTTLHours, setStoryTTLHours] = useState("24");
  const [addonPriceTry, setAddonPriceTry] = useState("990");
  const [savingSettings, setSavingSettings] = useState(false);

  // Admin publish form
  const [brandId, setBrandId] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState("");
  const [ctaLabel, setCtaLabel] = useState("Vitrini İncele");
  const [ctaUrl, setCtaUrl] = useState("");
  const [submittingStory, setSubmittingStory] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithConfig("/api/v1/admin/stories/overview");
      if (!res.ok) return;
      const data = (await res.json()) as {
        settings?: StorySettings;
        summary?: {
          active_count: number;
          total_views: number;
          total_clicks: number;
          active_brands_count: number;
        };
        stories?: StoryItemDTO[];
      };
      if (data.settings) {
        setIsPaidMode(Boolean(data.settings.is_paid_mode));
        setPaidDailyLimit(String(data.settings.paid_daily_limit ?? 8));
        setFreeDailyLimit(String(data.settings.free_daily_limit ?? 8));
        setStoryTTLHours(String(data.settings.story_ttl_hours ?? 24));
        setAddonPriceTry(String(data.settings.monthly_addon_price_try ?? 990));
      }
      if (data.summary) setSummary(data.summary);
      setStories(Array.isArray(data.stories) ? data.stories : []);
      setSnapshotNowMs(Date.now());
    } finally {
      setLoading(false);
    }
  }, [fetchWithConfig]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void loadOverview();
    }, 0);
    return () => window.clearTimeout(t);
  }, [loadOverview]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setMsg(null);
    try {
      const res = await fetchWithConfig("/api/v1/admin/stories/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_paid_mode: isPaidMode,
          paid_daily_limit: Number(paidDailyLimit) || 8,
          free_daily_limit: Number(freeDailyLimit) || 0,
          story_ttl_hours: Number(storyTTLHours) || 24,
          monthly_addon_price_try: Number(addonPriceTry) || 0,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        setMsg({ type: "err", text: data.error || "Ayarlar kaydedilemedi." });
        return;
      }
      setMsg({
        type: "ok",
        text: data.message || "Hikaye ücretlendirme ve limit ayarları kaydedildi.",
      });
      void loadOverview();
    } finally {
      setSavingSettings(false);
    }
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMsg(null);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetchWithConfig("/api/v1/admin/stories/upload", {
        method: "POST",
        body: formData,
      });
      const data = (await res.json().catch(() => ({}))) as {
        media_url?: string;
        error?: string;
      };
      if (!res.ok || !data.media_url) {
        setMsg({ type: "err", text: data.error || "Görsel yüklenemedi." });
        return;
      }
      setMediaUrl(data.media_url);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleCreateStory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandId || !mediaUrl) {
      setMsg({ type: "err", text: "Üretici firma ve görsel seçilmelidir." });
      return;
    }
    setSubmittingStory(true);
    setMsg(null);
    try {
      const res = await fetchWithConfig("/api/v1/admin/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand_id: brandId,
          media_url: mediaUrl,
          caption: caption.trim(),
          cta_label: ctaLabel.trim(),
          cta_url: ctaUrl.trim(),
          ttl_hours: Number(storyTTLHours) || 24,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        setMsg({ type: "err", text: data.error || "Hikaye eklenemedi." });
        return;
      }
      setMediaUrl("");
      setCaption("");
      setCtaUrl("");
      setMsg({ type: "ok", text: data.message || "Hikaye yayına alındı." });
      void loadOverview();
    } finally {
      setSubmittingStory(false);
    }
  };

  const handleToggleActive = async (story: StoryItemDTO) => {
    await fetchWithConfig(`/api/v1/admin/stories/${story.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !story.is_active }),
    });
    void loadOverview();
  };

  const handleDelete = async (storyId: string) => {
    await fetchWithConfig(`/api/v1/admin/stories/${storyId}`, {
      method: "DELETE",
    });
    void loadOverview();
  };

  return (
    <div className="space-y-6">
      {msg && (
        <div
          className={`px-4 py-3 rounded-xl border text-xs font-bold ${
            msg.type === "ok"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
          <div className="text-[11px] font-bold text-zinc-500">Aktif Hikaye</div>
          <div className="text-xl font-black text-zinc-900 dark:text-white mt-0.5">
            {summary.active_count}
          </div>
        </div>
        <div className="bg-white dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
          <div className="text-[11px] font-bold text-zinc-500">Hikayeli Firma</div>
          <div className="text-xl font-black text-zinc-900 dark:text-white mt-0.5">
            {summary.active_brands_count}
          </div>
        </div>
        <div className="bg-white dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
          <div className="text-[11px] font-bold text-zinc-500">Toplam İzlenme</div>
          <div className="text-xl font-black text-zinc-900 dark:text-white mt-0.5">
            {summary.total_views}
          </div>
        </div>
        <div className="bg-white dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
          <div className="text-[11px] font-bold text-zinc-500">CTA Tıklaması</div>
          <div className="text-xl font-black text-zinc-900 dark:text-white mt-0.5">
            {summary.total_clicks}
          </div>
        </div>
      </div>

      {/* Monetization & Rolling 24h Quota Settings */}
      <form
        onSubmit={handleSaveSettings}
        className="bg-white dark:bg-zinc-950 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-extrabold text-zinc-900 dark:text-white flex items-center gap-2">
              <Sparkles size={16} className="text-rose-500" />
              <span>Hikaye Ücretlendirme Modu &amp; 24 Saatlik Kota Ayarları</span>
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Ücretli modu açtığınızda yalnızca aktif ücretli paketi (veya abonelik kartından özel izni) olan tedarikçiler hikaye paylaşabilir.
            </p>
          </div>

          <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs font-extrabold text-amber-900 dark:text-amber-200 cursor-pointer">
            <input
              type="checkbox"
              checked={isPaidMode}
              onChange={(e) => setIsPaidMode(e.target.checked)}
              className="w-4 h-4 accent-amber-600"
            />
            <span>Sadece Ücretlilere Aç (Ücretli Mod)</span>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-zinc-500 mb-1">
              Ücretli Limit (24 Saat)
            </label>
            <input
              type="number"
              min={1}
              max={50}
              value={paidDailyLimit}
              onChange={(e) => setPaidDailyLimit(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-bold"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-zinc-500 mb-1">
              Ücretsiz Mod Limiti (24s)
            </label>
            <input
              type="number"
              min={0}
              max={50}
              value={freeDailyLimit}
              onChange={(e) => setFreeDailyLimit(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-bold"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-zinc-500 mb-1">
              Hikaye Ömrü (Saat)
            </label>
            <input
              type="number"
              min={1}
              max={168}
              value={storyTTLHours}
              onChange={(e) => setStoryTTLHours(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-bold"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-zinc-500 mb-1">
              Önerilen Eklenti Fiyatı (TRY)
            </label>
            <input
              type="number"
              min={0}
              step="10"
              value={addonPriceTry}
              onChange={(e) => setAddonPriceTry(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-bold"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={savingSettings}
          className="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-extrabold border-none cursor-pointer inline-flex items-center gap-1.5"
        >
          {savingSettings ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          <span>Hikaye Ayarlarını Kaydet</span>
        </button>
      </form>

      {/* Admin Story Publisher */}
      <form
        onSubmit={handleCreateStory}
        className="bg-white dark:bg-zinc-950 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-4"
      >
        <h2 className="text-sm font-extrabold text-zinc-900 dark:text-white flex items-center gap-2">
          <Plus size={16} className="text-emerald-600" />
          <span>Admin Olarak Firma Hikayesi Yayınla</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-zinc-500 mb-1">
              Üretici Firma *
            </label>
            <select
              required
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold bg-white dark:bg-zinc-900"
            >
              <option value="">Firma Seçin</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-zinc-500 mb-1">
              Görsel Yükle *
            </label>
            <label className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer bg-zinc-50 dark:bg-zinc-900">
              {uploading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <ImagePlus size={14} />
              )}
              <span>{mediaUrl ? "✓ Görsel Yüklendi" : "Hikaye Görseli Seç"}</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => void handleUploadImage(e)}
                className="hidden"
              />
            </label>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-zinc-500 mb-1">
              Buton Metni / CTA Linki
            </label>
            <input
              type="text"
              value={ctaUrl}
              onChange={(e) => setCtaUrl(e.target.value)}
              placeholder="/product/... veya boş bırakın"
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Hikaye metni..."
            className="sm:col-span-2 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs"
          />
          <input
            type="text"
            value={ctaLabel}
            onChange={(e) => setCtaLabel(e.target.value)}
            placeholder="Buton yazısı (örn: Vitrini İncele)"
            className="px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs"
          />
        </div>

        <button
          type="submit"
          disabled={submittingStory}
          className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-extrabold border-none cursor-pointer inline-flex items-center gap-1.5"
        >
          <Plus size={14} />
          <span>{submittingStory ? "Yayınlanıyor..." : "Hikayeyi Yayınla"}</span>
        </button>
      </form>

      {/* Stories Moderation List */}
      <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800 text-xs font-extrabold text-zinc-700 dark:text-zinc-200 flex items-center justify-between">
          <span>Son Yayınlanan Hikayeler ({stories.length})</span>
          {loading && <Loader2 size={14} className="animate-spin" />}
        </div>

        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {stories.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-500">
              Henüz hikaye kaydı bulunmuyor.
            </div>
          ) : (
            stories.map((st) => {
              const isLive =
                st.is_active &&
                (snapshotNowMs === 0 || new Date(st.expires_at).getTime() > snapshotNowMs);
              return (
                <div
                  key={st.id}
                  className="p-4 flex items-center justify-between gap-4 hover:bg-zinc-50/70 dark:hover:bg-zinc-900/40"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-14 rounded-lg overflow-hidden bg-zinc-200 shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={st.media_url}
                        alt={st.brand_name || "Story"}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-extrabold text-zinc-900 dark:text-white">
                          {st.brand_name}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 text-[10px] font-bold">
                          {st.created_by_role === "admin" ? "Admin" : "Tedarikçi"}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                            isLive
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-zinc-100 text-zinc-500"
                          }`}
                        >
                          {isLive ? "Aktif" : "Pasif / Süresi Doldu"}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-600 truncate">
                        {st.caption || "(Metin yok)"}
                      </p>
                      <div className="flex items-center gap-3 text-[11px] text-zinc-400 font-semibold">
                        <span className="inline-flex items-center gap-1">
                          <Eye size={12} /> {st.view_count}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MousePointerClick size={12} /> {st.click_count}
                        </span>
                        <span>Bitiş: {new Date(st.expires_at).toLocaleString("tr-TR")}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => void handleToggleActive(st)}
                      className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 cursor-pointer"
                      title={st.is_active ? "Pasifleştir" : "Aktifleştir"}
                    >
                      {st.is_active ? (
                        <CheckCircle2 size={15} className="text-emerald-600" />
                      ) : (
                        <XCircle size={15} className="text-zinc-400" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(st.id)}
                      className="p-2 rounded-lg border border-red-200 bg-red-50 text-red-600 cursor-pointer"
                      title="Sil"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
