"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Circle,
  Clock,
  Eye,
  FileText,
  Globe2,
  Loader2,
  LogIn,
  MessageCircle,
  Monitor,
  Package,
  RefreshCw,
  Search,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sparkles,
  UserPlus,
  ExternalLink,
  Compass,
  Radio,
} from "lucide-react";
import { getResizedImageUrl } from "@/app/utils";

export type TimelineCategoryFilter =
  | "all"
  | "content"
  | "catalog"
  | "commerce"
  | "engagement"
  | "auth"
  | "navigation";

export interface JourneyFunnelStep {
  readonly step_key: string;
  readonly label: string;
  readonly completed: boolean;
  readonly reached_at?: string;
  readonly detail: string;
}

export interface ViewedProductSummary {
  readonly product_id: string;
  readonly title: string;
  readonly custom_sku: string;
  readonly slug: string;
  readonly brand_name: string;
  readonly image_url: string;
  readonly view_count: number;
  readonly total_duration_sec: number;
  readonly added_to_cart: boolean;
  readonly ordered: boolean;
  readonly last_viewed_at: string;
}

export interface ReadContentSummary {
  readonly key: string;
  readonly title: string;
  readonly url_path: string;
  readonly content_type: string;
  readonly read_count: number;
  readonly total_duration_sec: number;
  readonly last_read_at: string;
}

export interface MemberTimelineEvent {
  readonly id: string;
  readonly event_type: string;
  readonly event_category: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly url_path?: string;
  readonly entity_type?: string;
  readonly entity_id?: string;
  readonly image_url?: string;
  readonly duration_sec?: number;
  readonly device_type?: string;
  readonly browser?: string;
  readonly os?: string;
  readonly country_code?: string;
  readonly ip_address?: string;
  readonly is_pre_signup: boolean;
  readonly created_at: string;
}

export interface MemberJourneyKPIs {
  readonly total_sessions: number;
  readonly total_events: number;
  readonly total_pages_read: number;
  readonly corporate_pages_read: number;
  readonly unique_products: number;
  readonly total_product_views: number;
  readonly cart_additions: number;
  readonly supplier_contacts: number;
  readonly orders_count: number;
  readonly orders_total_amount: number;
  readonly total_time_spent_sec: number;
  readonly first_seen_at?: string;
  readonly last_active_at?: string;
  readonly is_online: boolean;
  readonly acquisition_source: string;
  readonly primary_device: string;
}

export interface MemberJourneyCustomerProfile {
  readonly id: string;
  readonly first_name: string;
  readonly last_name: string;
  readonly email: string;
  readonly phone: string;
  readonly email_verified: boolean;
  readonly is_blocked: boolean;
  readonly registration_ip: string;
  readonly preferred_lang: string;
  readonly preferred_currency: string;
  readonly instagram_username: string;
  readonly created_at: string;
}

export interface MemberJourneyDetailResponse {
  readonly customer: MemberJourneyCustomerProfile;
  readonly kpis: MemberJourneyKPIs;
  readonly funnel_steps: readonly JourneyFunnelStep[];
  readonly viewed_products: readonly ViewedProductSummary[];
  readonly read_pages: readonly ReadContentSummary[];
  readonly top_categories: readonly string[];
  readonly timeline: readonly MemberTimelineEvent[];
}

interface CustomerJourneyPanelProps {
  readonly customerId: string;
  readonly apiUrl: string;
  readonly token: string | null;
}

function formatDurationHuman(seconds?: number): string {
  if (!seconds || seconds <= 0) return "";
  if (seconds < 60) return `${seconds} sn`;
  const mins = Math.floor(seconds / 60);
  const rem = seconds % 60;
  if (rem === 0) return `${mins} dk`;
  return `${mins} dk ${rem} sn`;
}

function formatDayHeading(isoStr: string): string {
  const date = new Date(isoStr);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  if (isToday) return "Bugün";

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();
  if (isYesterday) return "Dün";

  return date.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDeviceLabel(deviceType?: string): string {
  if (deviceType === "mobile_app") return "Mobil Uygulama";
  if (deviceType === "mobile") return "Mobil Tarayıcı";
  if (deviceType === "tablet") return "Tablet";
  return "Masaüstü";
}

function formatCustomerInitials(firstName?: string, lastName?: string): string {
  const first = (firstName || "").trim()[0] || "Ü";
  const last = (lastName || "").trim()[0] || "";
  return `${first}${last}`.toLocaleUpperCase("tr-TR");
}

function JourneyProductThumb({
  imageUrl,
  alt,
  sizeClass = "w-11 h-14",
}: {
  readonly imageUrl?: string | null;
  readonly alt: string;
  readonly sizeClass?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const resolvedSrc = imageUrl?.trim() ? getResizedImageUrl(imageUrl, 96, 128) : "";

  if (!resolvedSrc || failedSrc === resolvedSrc) {
    return (
      <div
        className={`${sizeClass} rounded-lg border border-zinc-200 bg-zinc-100/80 text-zinc-400 flex items-center justify-center shrink-0`}
        title={alt}
      >
        <Package size={16} />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolvedSrc}
      alt={alt}
      onError={() => setFailedSrc(resolvedSrc)}
      className={`${sizeClass} rounded-lg object-cover border border-zinc-200 shrink-0 bg-white`}
    />
  );
}

interface EventVisualMeta {
  readonly badgeBg: string;
  readonly iconColor: string;
  readonly categoryLabel: string;
  readonly IconComp: React.ComponentType<{ size?: number; className?: string }>;
}

function resolveEventVisual(ev: MemberTimelineEvent): EventVisualMeta {
  if (ev.event_type === "register") {
    return {
      badgeBg: "bg-emerald-50 border-emerald-200",
      iconColor: "text-emerald-600",
      categoryLabel: "Üyelik Kaydı",
      IconComp: UserPlus,
    };
  }
  if (ev.event_type === "login" || ev.event_category === "auth") {
    return {
      badgeBg: "bg-sky-50 border-sky-200",
      iconColor: "text-sky-600",
      categoryLabel: "Hesap & Oturum",
      IconComp: LogIn,
    };
  }
  if (ev.event_type === "order_create" || ev.event_type === "inquiry_submit") {
    return {
      badgeBg: "bg-amber-50 border-amber-200",
      iconColor: "text-amber-600",
      categoryLabel: "Toptan Sipariş",
      IconComp: ShoppingBag,
    };
  }
  if (ev.event_type === "cart_add" || ev.event_category === "commerce") {
    return {
      badgeBg: "bg-violet-50 border-violet-200",
      iconColor: "text-violet-600",
      categoryLabel: "Sepet İşlemi",
      IconComp: ShoppingCart,
    };
  }
  if (ev.event_category === "engagement") {
    return {
      badgeBg: "bg-teal-50 border-teal-200",
      iconColor: "text-teal-600",
      categoryLabel: "Üretici İletişimi",
      IconComp: MessageCircle,
    };
  }
  if (ev.event_type === "product_view") {
    return {
      badgeBg: "bg-fuchsia-50 border-fuchsia-200",
      iconColor: "text-fuchsia-600",
      categoryLabel: "Ürün İnceleme",
      IconComp: Package,
    };
  }
  if (ev.event_type === "search_query") {
    return {
      badgeBg: "bg-indigo-50 border-indigo-200",
      iconColor: "text-indigo-600",
      categoryLabel: "Arama",
      IconComp: Search,
    };
  }
  if (ev.event_category === "content") {
    return {
      badgeBg: "bg-blue-50 border-blue-200",
      iconColor: "text-blue-600",
      categoryLabel: "Kurumsal & İçerik",
      IconComp: FileText,
    };
  }
  return {
    badgeBg: "bg-zinc-50 border-zinc-200",
    iconColor: "text-zinc-600",
    categoryLabel: "Sayfa Gezintisi",
    IconComp: Compass,
  };
}

async function requestCustomerJourney(
  apiUrl: string,
  token: string,
  customerId: string
): Promise<MemberJourneyDetailResponse> {
  const res = await fetch(`${apiUrl}/api/v1/customers/${customerId}/journey`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error("Üye yolculuk tarihçesi alınamadı.");
  }
  return (await res.json()) as MemberJourneyDetailResponse;
}

const FILTER_TABS: readonly { id: TimelineCategoryFilter; label: string }[] = [
  { id: "all", label: "Tüm Hareketler" },
  { id: "content", label: "Okunan Sayfalar (Hakkımızda vb.)" },
  { id: "catalog", label: "İncelenen Ürün & Kategoriler" },
  { id: "commerce", label: "Sepet & Siparişler" },
  { id: "engagement", label: "WhatsApp & Sohbet" },
  { id: "auth", label: "Kayıt & Oturumlar" },
];

export default function CustomerJourneyPanel({
  customerId,
  apiUrl,
  token,
}: Readonly<CustomerJourneyPanelProps>) {
  const [data, setData] = useState<MemberJourneyDetailResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<TimelineCategoryFilter>("all");

  const reload = useCallback(async () => {
    if (!token || !customerId) return;
    setRefreshing(true);
    try {
      const resp = await requestCustomerJourney(apiUrl, token, customerId);
      setData(resp);
      setError(null);
    } catch (err: unknown) {
      setError((err as Error).message || "Bir hata oluştu.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [apiUrl, token, customerId]);

  useEffect(() => {
    let active = true;
    if (!token || !customerId) return;

    void requestCustomerJourney(apiUrl, token, customerId)
      .then((resp) => {
        if (!active) return;
        setData(resp);
        setError(null);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError((err as Error).message || "Bir hata oluştu.");
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [apiUrl, token, customerId]);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 bg-white rounded-2xl border border-zinc-200/80">
        <Loader2 size={30} className="text-violet-600 animate-spin" />
        <span className="text-xs font-bold text-zinc-500">
          Üye yolculuk haritası ve tarihçesi hazırlanıyor...
        </span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-10 text-center bg-white rounded-2xl border border-rose-200 text-rose-600 text-xs font-bold">
        {error || "Veri bulunamadı."}
      </div>
    );
  }

  const { customer, kpis, funnel_steps, viewed_products, read_pages, top_categories, timeline } = data;

  const filteredTimeline = timeline.filter((ev) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "content") {
      return ev.event_category === "content" || ev.event_category === "navigation";
    }
    return ev.event_category === activeFilter;
  });

  // Group timeline items by calendar day
  const groupedDays: { dayLabel: string; items: MemberTimelineEvent[] }[] = [];
  for (const ev of filteredTimeline) {
    const label = formatDayHeading(ev.created_at);
    const lastGroup = groupedDays[groupedDays.length - 1];
    if (lastGroup && lastGroup.dayLabel === label) {
      lastGroup.items.push(ev);
    } else {
      groupedDays.push({ dayLabel: label, items: [ev] });
    }
  }

  const totalSpentText = formatDurationHuman(kpis.total_time_spent_sec) || "Yeni Ziyaret";

  return (
    <div className="space-y-5">
      {/* 1. Member Header & Summary KPIs */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white flex items-center justify-center font-black text-sm uppercase shadow-md shadow-violet-500/20">
                {formatCustomerInitials(customer.first_name, customer.last_name)}
              </div>
              {kpis.is_online && (
                <span
                  title="Son 15 dakikada aktif"
                  className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 ring-2 ring-white"
                />
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-extrabold text-zinc-900">
                  {customer.first_name} {customer.last_name}
                </h2>
                {kpis.is_online ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <Radio size={11} className="animate-pulse" />
                    Şu An Sitede Aktif
                  </span>
                ) : null}
                {customer.email_verified ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                    E-Posta Doğrulandı
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    Onay Bekliyor
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 font-medium mt-0.5">
                <span>{customer.email}</span>
                {customer.phone ? <span>• {customer.phone}</span> : null}
                <span>• Kayıt: {new Date(customer.created_at).toLocaleString("tr-TR")}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void reload()}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-xs font-bold text-zinc-700 transition-colors cursor-pointer self-start sm:self-auto whitespace-nowrap shrink-0"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin text-violet-600" : ""} />
            Yenile
          </button>
        </div>

        {/* KPI Mini Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2 border-t border-zinc-100">
          <div className="p-3 rounded-xl bg-zinc-50/80 border border-zinc-100">
            <span className="text-[10px] font-bold text-zinc-400 uppercase block">Gezilen Sayfa</span>
            <span className="text-base font-black text-zinc-900 mt-0.5 block">{kpis.total_pages_read}</span>
            <span className="text-[10px] text-zinc-500 font-medium">{kpis.corporate_pages_read} kurumsal/blog</span>
          </div>
          <div className="p-3 rounded-xl bg-fuchsia-50/50 border border-fuchsia-100">
            <span className="text-[10px] font-bold text-fuchsia-600 uppercase block">İncelenen Ürün</span>
            <span className="text-base font-black text-zinc-900 mt-0.5 block">{kpis.unique_products}</span>
            <span className="text-[10px] text-zinc-500 font-medium">{kpis.total_product_views} kez bakıldı</span>
          </div>
          <div className="p-3 rounded-xl bg-violet-50/50 border border-violet-100">
            <span className="text-[10px] font-bold text-violet-600 uppercase block">Sepet & İletişim</span>
            <span className="text-base font-black text-zinc-900 mt-0.5 block">
              {kpis.cart_additions + kpis.supplier_contacts}
            </span>
            <span className="text-[10px] text-zinc-500 font-medium">
              {kpis.cart_additions} sepet • {kpis.supplier_contacts} mesaj
            </span>
          </div>
          <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-100">
            <span className="text-[10px] font-bold text-amber-700 uppercase block">Sipariş / Talep</span>
            <span className="text-base font-black text-zinc-900 mt-0.5 block">{kpis.orders_count}</span>
            <span className="text-[10px] text-zinc-500 font-medium">
              {kpis.orders_total_amount > 0
                ? `${kpis.orders_total_amount.toLocaleString("tr-TR")} TL`
                : "Henüz sipariş yok"}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-zinc-50/80 border border-zinc-100">
            <span className="text-[10px] font-bold text-zinc-400 uppercase block">Okuma Süresi</span>
            <span className="text-sm font-black text-zinc-900 mt-0.5 block">{totalSpentText}</span>
            <span className="text-[10px] text-zinc-500 font-medium">{kpis.total_sessions} oturum</span>
          </div>
          <div className="p-3 rounded-xl bg-zinc-50/80 border border-zinc-100">
            <span className="text-[10px] font-bold text-zinc-400 uppercase block">Kaynak & Cihaz</span>
            <span className="text-xs font-extrabold text-zinc-900 mt-0.5 block truncate" title={kpis.acquisition_source}>
              {kpis.acquisition_source}
            </span>
            <span className="text-[10px] text-zinc-500 font-medium flex items-center gap-1 mt-0.5">
              {kpis.primary_device.includes("mobile") ? <Smartphone size={11} /> : <Monitor size={11} />}
              {formatDeviceLabel(kpis.primary_device)}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Visual 6-Stage Member Journey Map (Yolculuk Haritası) */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3.5">
          <h3 className="text-xs font-extrabold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
            <Sparkles size={15} className="text-violet-600" />
            Üye Yolculuk Haritası (Yaşam Döngüsü Adımları)
          </h3>
          {kpis.last_active_at ? (
            <span className="text-[11px] font-semibold text-zinc-500">
              Son Hareket: {new Date(kpis.last_active_at).toLocaleString("tr-TR")}
            </span>
          ) : null}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
          {funnel_steps.map((step) => (
            <div
              key={step.step_key}
              className={`relative p-3 rounded-xl border transition-all ${
                step.completed
                  ? "bg-gradient-to-br from-emerald-50/70 via-white to-violet-50/40 border-emerald-200/90 shadow-2xs"
                  : "bg-zinc-50/50 border-dashed border-zinc-200 opacity-75"
              }`}
            >
              <div className="flex items-center justify-between gap-1.5 mb-1">
                {step.completed ? (
                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                ) : (
                  <Circle size={15} className="text-zinc-300 shrink-0" />
                )}
                {step.reached_at ? (
                  <span className="text-[9px] font-semibold text-zinc-400">
                    {new Date(step.reached_at).toLocaleDateString("tr-TR")}
                  </span>
                ) : null}
              </div>
              <div className="text-xs font-extrabold text-zinc-900 leading-snug">{step.label}</div>
              <div className="text-[10px] font-semibold text-zinc-500 mt-1 truncate" title={step.detail}>
                {step.detail}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Viewed Products & Read Corporate Pages Summary */}
      {(viewed_products.length > 0 || read_pages.length > 0 || top_categories.length > 0) && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Göz Attığı Ürünler */}
          <div className="bg-white rounded-2xl border border-zinc-200/80 p-5 shadow-xs">
            <h3 className="text-xs font-extrabold text-zinc-900 uppercase tracking-wider flex items-center gap-2 mb-3">
              <Eye size={15} className="text-fuchsia-600" />
              Göz Attığı Ürünler ({viewed_products.length})
            </h3>
            {viewed_products.length === 0 ? (
              <p className="text-xs text-zinc-400 font-medium py-6 text-center">
                Henüz bir ürün detay sayfasına göz atmadı.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                {viewed_products.map((vp) => {
                  const dwellLabel = formatDurationHuman(vp.total_duration_sec);
                  return (
                    <div
                      key={vp.product_id}
                      className="flex items-center gap-3 p-2.5 rounded-xl border border-zinc-100 hover:border-violet-200 bg-zinc-50/40 transition-colors"
                    >
                      <JourneyProductThumb imageUrl={vp.image_url} alt={vp.title} sizeClass="w-11 h-14" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-zinc-900 truncate">{vp.title}</span>
                          {vp.slug ? (
                            <Link
                              href={`/product/${vp.slug}`}
                              target="_blank"
                              className="text-violet-600 hover:text-violet-800 shrink-0"
                              title="Ürünü yeni sekmede aç"
                            >
                              <ExternalLink size={12} />
                            </Link>
                          ) : null}
                        </div>
                        <div className="text-[10px] font-semibold text-zinc-500 truncate mt-0.5">
                          {vp.custom_sku ? `SKU: ${vp.custom_sku} • ` : ""}
                          {vp.brand_name || "Merter Üretici"}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200">
                            {vp.view_count} kez inceledi
                          </span>
                          {dwellLabel ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-zinc-100 text-zinc-600">
                              {dwellLabel}
                            </span>
                          ) : null}
                          {vp.added_to_cart ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-violet-100 text-violet-700">
                              Sepete Ekledi
                            </span>
                          ) : null}
                          {vp.ordered ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700">
                              Sipariş Verdi
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Okuduğu Sayfalar & Kategoriler */}
          <div className="bg-white rounded-2xl border border-zinc-200/80 p-5 shadow-xs space-y-4">
            <div>
              <h3 className="text-xs font-extrabold text-zinc-900 uppercase tracking-wider flex items-center gap-2 mb-3">
                <FileText size={15} className="text-blue-600" />
                Okuduğu Kurumsal & Bilgilendirme Sayfaları ({read_pages.length})
              </h3>
              {read_pages.length === 0 ? (
                <p className="text-xs text-zinc-400 font-medium py-4 text-center">
                  Henüz Hakkımızda, SSS veya Blog gibi içerik sayfalarını okumadı.
                </p>
              ) : (
                <div className="space-y-2 max-h-44 overflow-y-auto pr-1 custom-scrollbar">
                  {read_pages.map((rp) => {
                    const dwellText = formatDurationHuman(rp.total_duration_sec);
                    return (
                      <div
                        key={rp.key}
                        className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-blue-50/40 border border-blue-100"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-zinc-900 truncate">{rp.title}</div>
                          {rp.url_path ? (
                            <div className="text-[10px] font-mono text-zinc-500 truncate">{rp.url_path}</div>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white text-blue-700 border border-blue-200">
                            {rp.read_count}x
                          </span>
                          {dwellText ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white text-zinc-600 border border-zinc-200">
                              {dwellText}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {top_categories.length > 0 && (
              <div className="pt-3 border-t border-zinc-100">
                <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider block mb-2">
                  En Çok Gezdiği Kategoriler
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {top_categories.map((cat) => (
                    <span
                      key={cat}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-zinc-100 text-zinc-700 border border-zinc-200"
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. Step-by-Step Chronological Activity Timeline */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-zinc-100">
          <div>
            <h3 className="text-sm font-extrabold text-zinc-900 flex items-center gap-2">
              <Clock size={16} className="text-violet-600" />
              Adım Adım Üye Aktivite Tarihçesi ({filteredTimeline.length} Kayıt)
            </h3>
            <p className="text-[11px] text-zinc-500 font-medium mt-0.5">
              Üyenin kayıt öncesinden itibaren gezdiği sayfalar, okuduğu içerikler, incelediği ürünler ve tüm işlemleri.
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                  activeFilter === tab.id
                    ? "bg-zinc-900 text-white shadow-xs"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {groupedDays.length === 0 ? (
          <div className="py-14 text-center text-xs font-bold text-zinc-400">
            Seçili filtrede henüz aktivite kaydı bulunmuyor.
          </div>
        ) : (
          <div className="space-y-6 pt-4">
            {groupedDays.map((group) => (
              <div key={group.dayLabel} className="space-y-3">
                <div className="sticky top-0 z-10 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 border border-zinc-200 text-[11px] font-extrabold text-zinc-700">
                  <span>{group.dayLabel}</span>
                  <span className="text-zinc-400">• {group.items.length} adım</span>
                </div>

                <div className="relative pl-6 border-l-2 border-zinc-100 space-y-3 ml-3">
                  {group.items.map((ev) => {
                    const vis = resolveEventVisual(ev);
                    const IconComp = vis.IconComp;
                    const dwellText = formatDurationHuman(ev.duration_sec);
                    const timeStr = new Date(ev.created_at).toLocaleTimeString("tr-TR", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    });

                    return (
                      <div
                        key={ev.id}
                        className="relative p-3.5 rounded-2xl border border-zinc-100 hover:border-zinc-200 bg-zinc-50/40 transition-all"
                      >
                        <span
                          className={`absolute -left-[35px] top-3.5 w-6 h-6 rounded-full border flex items-center justify-center ${vis.badgeBg}`}
                        >
                          <IconComp size={12} className={vis.iconColor} />
                        </span>

                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                          <div className="flex items-start gap-3 min-w-0">
                            {ev.image_url ? (
                              <JourneyProductThumb
                                imageUrl={ev.image_url}
                                alt={ev.title}
                                sizeClass="w-10 h-12"
                              />
                            ) : null}

                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${vis.badgeBg} ${vis.iconColor}`}
                                >
                                  {vis.categoryLabel}
                                </span>
                                {ev.is_pre_signup ? (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                    Üyelik Öncesi Gezinti
                                  </span>
                                ) : null}
                                {dwellText ? (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white text-zinc-600 border border-zinc-200">
                                    ⏱ {dwellText} kaldı
                                  </span>
                                ) : null}
                              </div>

                              <div className="text-xs font-extrabold text-zinc-900 mt-1">
                                {ev.title}
                              </div>

                              {ev.subtitle ? (
                                <div className="text-[11px] font-semibold text-zinc-500 mt-0.5">
                                  {ev.subtitle}
                                </div>
                              ) : null}

                              {ev.url_path ? (
                                <Link
                                  href={ev.url_path}
                                  target="_blank"
                                  className="inline-flex items-center gap-1 text-[10px] font-mono text-violet-600 hover:underline mt-1"
                                >
                                  {ev.url_path}
                                  <ExternalLink size={10} />
                                </Link>
                              ) : null}
                            </div>
                          </div>

                          <div className="flex sm:flex-col items-center sm:items-end gap-2 sm:gap-1 shrink-0 text-[10px] text-zinc-400 font-semibold">
                            <span className="font-mono font-bold text-zinc-700 bg-white px-2 py-0.5 rounded-md border border-zinc-200">
                              {timeStr}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {ev.country_code ? (
                                <span className="inline-flex items-center gap-0.5">
                                  <Globe2 size={10} />
                                  {ev.country_code}
                                </span>
                              ) : null}
                              {ev.device_type ? (
                                <span>
                                  {formatDeviceLabel(ev.device_type)}
                                  {ev.browser ? ` • ${ev.browser}` : ""}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

