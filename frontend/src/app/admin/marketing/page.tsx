"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Sparkles,
  Mail,
  Plus,
  Trash2,
  Eye,
  MousePointerClick,
  Send,
  RefreshCw,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useAdminAuth } from "@/context/AdminContext";
import AdminStoriesTab from "@/components/admin/marketing/AdminStoriesTab";

interface AdminSponsoredSlot {
  id: string;
  placement: string;
  brand_id?: string;
  brand_name: string;
  category_slug: string;
  title: string;
  subtitle: string;
  badge_text: string;
  cta_text: string;
  target_url: string;
  priority: number;
  is_active: boolean;
  impression_count: number;
  click_count: number;
  fee_amount: number;
  currency: string;
}

interface AdminNewsletterSubscriber {
  id: string;
  email: string;
  full_name: string;
  company_name: string;
  country: string;
  preferred_lang: string;
  kvkk_consent: boolean;
  commercial_consent: boolean;
  consent_ip: string;
  is_active: boolean;
  created_at: string;
}

interface AdminNewsletterCampaign {
  id: string;
  subject: string;
  target_lang: string;
  content_summary: string;
  sponsor_name: string;
  recipient_count: number;
  status: string;
  sent_at: string;
}

interface SupplierRef {
  id: string;
  name: string;
  alias_code: string;
}

const PLACEMENT_LABELS: Record<string, string> = {
  home_featured_suppliers: "Ana Sayfa — Öne Çıkan Üreticiler",
  home_new_collection: "Ana Sayfa — Yeni Koleksiyon Vitrini",
  category_sponsor: "Kategori Sayfası — Kategori Sponsorluğu",
  sector_service_ad: "Ana Sayfa — Sektörel Hizmet / Lojistik Reklamı",
};

function SponsoredSlotsTab({
  slots,
  suppliers,
  onReload,
  fetchWithConfig,
}: Readonly<{
  slots: AdminSponsoredSlot[];
  suppliers: SupplierRef[];
  onReload: () => void;
  fetchWithConfig: (url: string, init?: RequestInit) => Promise<Response>;
}>) {
  const [placement, setPlacement] = useState("home_featured_suppliers");
  const [brandId, setBrandId] = useState("");
  const [categorySlug, setCategorySlug] = useState("");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [badgeText, setBadgeText] = useState("SPONSORLU ÜRETİCİ");
  const [ctaText, setCtaText] = useState("Firma Vitrinini Aç");
  const [targetUrl, setTargetUrl] = useState("");
  const [feeAmount, setFeeAmount] = useState("2490");
  const [priority, setPriority] = useState("10");

  const handleCreateSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await fetchWithConfig("/api/v1/admin/sponsored-slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        placement,
        brand_id: brandId,
        category_slug: categorySlug.trim(),
        title: title.trim(),
        subtitle: subtitle.trim(),
        badge_text: badgeText.trim(),
        cta_text: ctaText.trim(),
        target_url: targetUrl.trim(),
        fee_amount: Number(feeAmount) || 0,
        priority: Number(priority) || 10,
        is_active: true,
        currency: "TRY",
      }),
    });
    setTitle("");
    setSubtitle("");
    setTargetUrl("");
    onReload();
  };

  const handleToggleActive = async (slot: AdminSponsoredSlot) => {
    await fetchWithConfig(`/api/v1/admin/sponsored-slots/${slot.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !slot.is_active }),
    });
    onReload();
  };

  const handleDeleteSlot = async (id: string) => {
    await fetchWithConfig(`/api/v1/admin/sponsored-slots/${id}`, {
      method: "DELETE",
    });
    onReload();
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleCreateSlot}
        className="bg-white dark:bg-zinc-950 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-4"
      >
        <h2 className="text-sm font-extrabold text-zinc-900 dark:text-white flex items-center gap-2">
          <Plus size={16} className="text-amber-500" />
          <span>Yeni Sponsorlu Vitrin / Reklam Alanı Ekle</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <span className="block text-[11px] font-bold text-zinc-500 mb-1">
              Reklam Yerleşimi
            </span>
            <select
              value={placement}
              onChange={(e) => setPlacement(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold bg-white dark:bg-zinc-900"
            >
              <option value="home_featured_suppliers">
                Ana Sayfa — Öne Çıkan Üreticiler
              </option>
              <option value="home_new_collection">
                Ana Sayfa — Yeni Koleksiyon Vitrini
              </option>
              <option value="category_sponsor">
                Kategori Sayfası — Kategori Sponsorluğu
              </option>
              <option value="sector_service_ad">
                Ana Sayfa — Sektörel Hizmet Reklamı
              </option>
            </select>
          </div>

          <div>
            <span className="block text-[11px] font-bold text-zinc-500 mb-1">
              Üretici Firma (Opsiyonel)
            </span>
            <select
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold bg-white dark:bg-zinc-900"
            >
              <option value="">Bağımsız Reklam / Tüm Firmalar</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name || s.alias_code}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className="block text-[11px] font-bold text-zinc-500 mb-1">
              Hedef Kategori Slug (Kategori Sponsorluğu İçin)
            </span>
            <input
              type="text"
              value={categorySlug}
              onChange={(e) => setCategorySlug(e.target.value)}
              placeholder="Örn: kadin-giyim (Boşsa tümü)"
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold bg-white dark:bg-zinc-900"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Vitrin Başlığı (Örn: Lustrin Toptan — 2027 Kış Koleksiyonu) *"
            className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold bg-white dark:bg-zinc-900"
          />
          <input
            type="text"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="Alt Açıklama (Örn: Private Label & Doğrudan Fabrika Fiyatı)"
            className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold bg-white dark:bg-zinc-900"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input
            type="text"
            value={badgeText}
            onChange={(e) => setBadgeText(e.target.value)}
            placeholder="Rozet Metni"
            className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold bg-white dark:bg-zinc-900"
          />
          <input
            type="text"
            value={ctaText}
            onChange={(e) => setCtaText(e.target.value)}
            placeholder="Buton Metni"
            className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold bg-white dark:bg-zinc-900"
          />
          <input
            type="text"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="Hedef URL (Örn: /ureticiler/lustrin)"
            className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold bg-white dark:bg-zinc-900"
          />
          <div className="flex gap-2">
            <input
              type="number"
              value={feeAmount}
              onChange={(e) => setFeeAmount(e.target.value)}
              placeholder="Ücret (TRY)"
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold bg-white dark:bg-zinc-900"
            />
            <input
              type="number"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              placeholder="Sıra"
              className="w-20 px-2 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold bg-white dark:bg-zinc-900"
            />
          </div>
        </div>

        <button
          type="submit"
          className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold cursor-pointer border-none"
        >
          Sponsorlu Alanı Yayınla
        </button>
      </form>

      <div className="space-y-3">
        {slots.map((slot) => {
          const ctr =
            slot.impression_count > 0
              ? ((slot.click_count / slot.impression_count) * 100).toFixed(1)
              : "0.0";
          const statusCls = slot.is_active
            ? "bg-emerald-50 text-emerald-700"
            : "bg-zinc-100 text-zinc-600";

          return (
            <div
              key={slot.id}
              className="bg-white dark:bg-zinc-950 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-700 font-bold">
                    {PLACEMENT_LABELS[slot.placement] || slot.placement}
                  </span>
                  <span className={`px-2 py-0.5 rounded font-bold ${statusCls}`}>
                    {slot.is_active ? "AKTİF" : "PASİF"}
                  </span>
                  {slot.category_slug && (
                    <span className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 font-mono">
                      /{slot.category_slug}
                    </span>
                  )}
                  <span className="font-bold text-zinc-500">
                    {slot.fee_amount} {slot.currency}
                  </span>
                </div>
                <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white">
                  {slot.title}
                </h3>
                <p className="text-xs text-zinc-500">{slot.subtitle}</p>
                <div className="flex items-center gap-4 text-xs text-zinc-600 pt-1">
                  <span className="inline-flex items-center gap-1 font-semibold">
                    <Eye size={13} className="text-blue-500" />
                    {slot.impression_count} Görüntülenme
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold">
                    <MousePointerClick size={13} className="text-emerald-600" />
                    {slot.click_count} Tıklama (CTR: %{ctr})
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void handleToggleActive(slot)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold cursor-pointer border-none"
                >
                  {slot.is_active ? (
                    <>
                      <XCircle size={13} />
                      <span>Durdur</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={13} />
                      <span>Aktifleştir</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeleteSlot(slot.id)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold cursor-pointer border-none"
                >
                  <Trash2 size={13} />
                  <span>Sil</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NewsletterTab({
  subscribers,
  campaigns,
  suppliers,
  onReload,
  fetchWithConfig,
}: Readonly<{
  subscribers: AdminNewsletterSubscriber[];
  campaigns: AdminNewsletterCampaign[];
  suppliers: SupplierRef[];
  onReload: () => void;
  fetchWithConfig: (url: string, init?: RequestInit) => Promise<Response>;
}>) {
  const [subject, setSubject] = useState("");
  const [targetLang, setTargetLang] = useState("all");
  const [sponsorBrandId, setSponsorBrandId] = useState("");
  const [contentSummary, setContentSummary] = useState("");

  const handleSendCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) return;
    await fetchWithConfig("/api/v1/admin/newsletter/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: subject.trim(),
        target_lang: targetLang,
        sponsor_brand_id: sponsorBrandId,
        content_summary: contentSummary.trim(),
      }),
    });
    setSubject("");
    setContentSummary("");
    onReload();
  };

  const handleDeleteSubscriber = async (id: string) => {
    await fetchWithConfig(`/api/v1/admin/newsletter/subscribers/${id}`, {
      method: "DELETE",
    });
    onReload();
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSendCampaign}
        className="bg-white dark:bg-zinc-950 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-4"
      >
        <h2 className="text-sm font-extrabold text-zinc-900 dark:text-white flex items-center gap-2">
          <Send size={15} className="text-violet-600" />
          <span>Yeni B2B E-Bülten / Koleksiyon Duyurusu Oluştur</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="E-Bülten Başlığı (Örn: Merter 2027 Yeni Sezon Koleksiyon Bülteni) *"
            className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold bg-white dark:bg-zinc-900"
          />
          <select
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold bg-white dark:bg-zinc-900"
          >
            <option value="all">Tüm Diller (TR / EN / RU / AR)</option>
            <option value="tr">Türkçe Aboneler (TR)</option>
            <option value="en">İngilizce Aboneler (EN)</option>
            <option value="ru">Rusça Aboneler (RU)</option>
            <option value="ar">Arapça Aboneler (AR)</option>
          </select>
          <select
            value={sponsorBrandId}
            onChange={(e) => setSponsorBrandId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold bg-white dark:bg-zinc-900"
          >
            <option value="">Bülten Sponsoru Yok (Genel Bülten)</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                Sponsor: {s.name || s.alias_code}
              </option>
            ))}
          </select>
        </div>

        <textarea
          rows={3}
          value={contentSummary}
          onChange={(e) => setContentSummary(e.target.value)}
          placeholder="Bülten özeti ve öne çıkan koleksiyon/üretici bağlantıları..."
          className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold bg-white dark:bg-zinc-900"
        />

        <button
          type="submit"
          className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-extrabold cursor-pointer border-none"
        >
          İzinli Abonelere Bülteni Gönder ({subscribers.length} Abone)
        </button>
      </form>

      {campaigns.length > 0 && (
        <div className="bg-white dark:bg-zinc-950 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-2">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-500">
            Gönderilen E-Bülten Kampanyaları
          </h3>
          {campaigns.map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-b-0 text-xs"
            >
              <div>
                <span className="font-bold text-zinc-900 dark:text-white">
                  {c.subject}
                </span>
                {c.sponsor_name && (
                  <span className="ml-2 px-2 py-0.5 rounded bg-amber-50 text-amber-800 font-bold text-[10px]">
                    Sponsor: {c.sponsor_name}
                  </span>
                )}
              </div>
              <span className="text-zinc-500 font-semibold">
                {c.recipient_count} Alıcı • Dil: {c.target_lang.toUpperCase()} •{" "}
                {new Date(c.sent_at).toLocaleDateString("tr-TR")}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white dark:bg-zinc-950 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-3">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-500">
          İzinli B2B E-Bülten Aboneleri ({subscribers.length})
        </h3>
        {subscribers.map((sub) => (
          <div
            key={sub.id}
            className="flex flex-wrap items-center justify-between gap-3 py-2.5 border-b border-zinc-100 dark:border-zinc-800 last:border-b-0 text-xs"
          >
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-zinc-900 dark:text-white">
                  {sub.email}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                  KVKK & ETK Onaylı
                </span>
                <span className="px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 text-[10px] font-mono uppercase">
                  {sub.preferred_lang}
                </span>
              </div>
              <p className="text-[11px] text-zinc-500">
                Firma: {sub.company_name || "-"} • Ülke: {sub.country || "-"} • IP:{" "}
                {sub.consent_ip || "-"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleDeleteSubscriber(sub.id)}
              className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer border-none bg-transparent"
              title="Aboneliği Sil"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminMarketingAndSponsoredPage() {
  const { fetchWithConfig } = useAdminAuth();
  const [activeTab, setActiveTab] = useState<"slots" | "newsletter" | "stories">("slots");
  const [slots, setSlots] = useState<AdminSponsoredSlot[]>([]);
  const [subscribers, setSubscribers] = useState<AdminNewsletterSubscriber[]>([]);
  const [campaigns, setCampaigns] = useState<AdminNewsletterCampaign[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRef[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [slotsRes, newsRes, supRes] = await Promise.all([
        fetchWithConfig("/api/v1/admin/sponsored-slots"),
        fetchWithConfig("/api/v1/admin/newsletter/overview"),
        fetchWithConfig("/api/v1/suppliers"),
      ]);
      if (slotsRes.ok) {
        const sData = (await slotsRes.json()) as AdminSponsoredSlot[];
        setSlots(sData || []);
      }
      if (newsRes.ok) {
        const nData = (await newsRes.json()) as {
          subscribers?: AdminNewsletterSubscriber[];
          campaigns?: AdminNewsletterCampaign[];
        };
        setSubscribers(nData.subscribers || []);
        setCampaigns(nData.campaigns || []);
      }
      if (supRes.ok) {
        const supData = (await supRes.json()) as SupplierRef[];
        setSuppliers(supData || []);
      }
    } catch {
      // Ignore transient errors
    } finally {
      setLoading(false);
    }
  }, [fetchWithConfig]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadAll();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadAll]);

  const slotsBtnCls =
    activeTab === "slots"
      ? "bg-amber-600 text-white"
      : "bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300";
  const newsBtnCls =
    activeTab === "newsletter"
      ? "bg-violet-600 text-white"
      : "bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300";
  const storiesBtnCls =
    activeTab === "stories"
      ? "bg-rose-600 text-white"
      : "bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300";

  return (
    <div className="max-w-6xl mx-auto w-full space-y-6">
      <div className="bg-white dark:bg-zinc-950 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
            <Sparkles size={20} />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-zinc-900 dark:text-white">
              Sponsorlu Vitrin, Hikayeler (24s) & B2B E-Bülten Yönetimi
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              Ana sayfa öne çıkan üreticileri, Instagram tarzı 24 saatlik hikayeleri ve izinli B2B e-bülten abonelerini yönetin.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("slots")}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold cursor-pointer border-none flex items-center gap-1.5 ${slotsBtnCls}`}
          >
            <Sparkles size={14} />
            <span>Sponsorlu Vitrin ({slots.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("stories")}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold cursor-pointer border-none flex items-center gap-1.5 ${storiesBtnCls}`}
          >
            <Sparkles size={14} />
            <span>Hikayeler (24s)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("newsletter")}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold cursor-pointer border-none flex items-center gap-1.5 ${newsBtnCls}`}
          >
            <Mail size={14} />
            <span>E-Bülten ({subscribers.length})</span>
          </button>
          <button
            type="button"
            onClick={() => void loadAll()}
            className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 cursor-pointer bg-white dark:bg-zinc-900"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {activeTab === "slots" && (
        <SponsoredSlotsTab
          slots={slots}
          suppliers={suppliers}
          onReload={() => void loadAll()}
          fetchWithConfig={fetchWithConfig}
        />
      )}
      {activeTab === "stories" && (
        <AdminStoriesTab
          suppliers={suppliers}
          fetchWithConfig={fetchWithConfig}
        />
      )}
      {activeTab === "newsletter" && (
        <NewsletterTab
          subscribers={subscribers}
          campaigns={campaigns}
          suppliers={suppliers}
          onReload={() => void loadAll()}
          fetchWithConfig={fetchWithConfig}
        />
      )}
    </div>
  );
}

