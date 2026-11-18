"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Building2,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Loader2,
  MessageCircle,
  Package,
  RefreshCw,
  Search,
  UserCheck,
  Users,
} from "lucide-react";
import { useAdmin } from "@/context/AdminContext";

export type WhatsappPeriod = "today" | "24h" | "7d" | "30d" | "90d" | "all";
export type WhatsappActorFilter = "all" | "customer" | "guest";

export interface WhatsappClicksSummary {
  readonly total_clicks: number;
  readonly unique_people: number;
  readonly customer_clicks: number;
  readonly guest_clicks: number;
  readonly unique_customers: number;
  readonly supplier_clicks: number;
  readonly platform_clicks: number;
}

export interface WhatsappSupplierBreakdown {
  readonly brand_id: string;
  readonly brand_name: string;
  readonly slug: string;
  readonly whatsapp_phone: string;
  readonly total_clicks: number;
  readonly unique_people: number;
  readonly customer_clicks: number;
  readonly unique_customers: number;
  readonly product_clicks: number;
  readonly last_clicked_at: string | null;
}

export interface WhatsappProductStat {
  readonly product_id: string;
  readonly title: string;
  readonly custom_sku: string;
  readonly slug: string;
  readonly brand_id: string;
  readonly brand_name: string;
  readonly total_clicks: number;
  readonly unique_customers: number;
  readonly unique_people: number;
}

export interface WhatsappClickLogItem {
  readonly id: string;
  readonly created_at: string;
  readonly user_id: string;
  readonly actor_type: "customer" | "guest";
  readonly customer_name: string;
  readonly customer_email: string;
  readonly customer_phone: string;
  readonly visitor_id: string;
  readonly brand_id: string;
  readonly brand_name: string;
  readonly brand_slug: string;
  readonly target_phone: string;
  readonly product_id: string;
  readonly product_title: string;
  readonly product_sku: string;
  readonly product_slug: string;
  readonly product_image: string;
  readonly source_surface: string;
  readonly page_path: string;
  readonly country_code: string;
  readonly language_code: string;
  readonly device_type: string;
  readonly ip_address: string;
}

export interface AdminWhatsappClicksPayload {
  readonly period: string;
  readonly summary: WhatsappClicksSummary;
  readonly by_supplier: WhatsappSupplierBreakdown[];
  readonly top_products: WhatsappProductStat[];
  readonly logs: WhatsappClickLogItem[];
  readonly total_logs: number;
}

interface WhatsappClicksPanelProps {
  readonly embedded?: boolean;
  readonly initialPeriod?: string;
  readonly initialBrandId?: string | null;
}

const PERIOD_CHOICES: ReadonlyArray<{ id: WhatsappPeriod; label: string }> = [
  { id: "today", label: "Bugün" },
  { id: "24h", label: "24 Saat" },
  { id: "7d", label: "7 Gün" },
  { id: "30d", label: "30 Gün" },
  { id: "90d", label: "90 Gün" },
  { id: "all", label: "Tümü" },
];

const SURFACE_LABELS: Record<string, string> = {
  product_calculator: "Ürün Detay (Hızlı WhatsApp)",
  product_supplier_card: "Ürün Sayfası Tedarikçi Kartı",
  product_supplier_card_inline: "Tedarikçi Satır İçi Hat",
  product_quick_modal: "Hızlı İnceleme Modalı",
  product_direct_inquiry: "Ürün Doğrudan Talep Formu",
  inquiry_success_modal: "Sipariş / Talep Onay Ekranı",
  supplier_directory: "Üretici Rehberi",
  supplier_showcase: "Tedarikçi Vitrini",
  supplier_editorial: "Üretici Tanıtım Sayfası",
  footer: "Site Alt Bilgi (Footer)",
  b2b_page: "B2B Toptan Satış Sayfası",
  b2b_form: "B2B Toptan Formu",
  contact_page: "İletişim Sayfası",
  contact_form: "İletişim Formu",
  faq_page: "SSS Destek Hattı",
  backend_event: "Sistem / Mobil Etkinlik",
};

const PAGE_SIZE = 50;

function normalizePeriod(raw?: string): WhatsappPeriod {
  if (raw === "today" || raw === "24h" || raw === "7d" || raw === "30d" || raw === "90d" || raw === "all") {
    return raw;
  }
  return "30d";
}

function formatSurfaceLabel(surface: string): string {
  const clean = (surface || "").trim();
  if (!clean) return "Vitrin Bağlantısı";
  return SURFACE_LABELS[clean] || clean;
}

function formatTimestampTr(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function escapeCsvCell(val: string | number): string {
  const txt = String(val ?? "");
  if (txt.includes(",") || txt.includes('"') || txt.includes("\n")) {
    return `"${txt.replaceAll('"', '""')}"`;
  }
  return txt;
}

function downloadWhatsappCsv(logs: readonly WhatsappClickLogItem[], period: string): void {
  if (typeof window === "undefined") return;
  const header = [
    "Tarih",
    "Tip",
    "Musteri / Ziyaretci",
    "E-Posta",
    "Musteri Telefon",
    "Tedarikci",
    "Acilan WhatsApp Numarasi",
    "Urun",
    "SKU",
    "Tiklanan Alan",
    "Ulke",
    "Dil",
    "Cihaz",
    "IP",
  ].join(",");

  const rows = logs.map((row) =>
    [
      formatTimestampTr(row.created_at),
      row.actor_type === "customer" ? "Kayıtlı Müşteri" : "Misafir",
      row.customer_name,
      row.customer_email,
      row.customer_phone,
      row.brand_name,
      row.target_phone,
      row.product_title,
      row.product_sku,
      formatSurfaceLabel(row.source_surface),
      row.country_code,
      row.language_code,
      row.device_type,
      row.ip_address,
    ]
      .map(escapeCsvCell)
      .join(",")
  );

  const stamp = new Date().toISOString().slice(0, 10);
  const blob = new Blob([`\uFEFF${header}\n${rows.join("\n")}`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `merter-whatsapp-clicks-${period}-${stamp}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

const EMPTY_PAYLOAD: AdminWhatsappClicksPayload = {
  period: "30d",
  summary: {
    total_clicks: 0,
    unique_people: 0,
    customer_clicks: 0,
    guest_clicks: 0,
    unique_customers: 0,
    supplier_clicks: 0,
    platform_clicks: 0,
  },
  by_supplier: [],
  top_products: [],
  logs: [],
  total_logs: 0,
};

function WhatsappKpiGrid({ summary }: { readonly summary: WhatsappClicksSummary }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-5 shadow-xs">
        <div className="flex items-center justify-between text-xs font-bold text-zinc-500">
          <span>TOPLAM WHATSAPP TIKLAMASI</span>
          <MessageCircle size={17} className="text-emerald-600" />
        </div>
        <div className="text-2xl font-black text-zinc-950 dark:text-white mt-2 tabular-nums">
          {summary.total_clicks.toLocaleString("tr-TR")}
        </div>
        <p className="text-[11px] text-zinc-500 mt-1">
          {summary.supplier_clicks.toLocaleString("tr-TR")} tedarikçi • {summary.platform_clicks.toLocaleString("tr-TR")} genel hat
        </p>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-5 shadow-xs">
        <div className="flex items-center justify-between text-xs font-bold text-zinc-500">
          <span>TEKİL KİŞİ (MÜŞTERİ + MİSAFİR)</span>
          <Users size={17} className="text-violet-600" />
        </div>
        <div className="text-2xl font-black text-zinc-950 dark:text-white mt-2 tabular-nums">
          {summary.unique_people.toLocaleString("tr-TR")}
        </div>
        <p className="text-[11px] text-zinc-500 mt-1">
          Farklı üye ve ziyaretçi cihaz toplamı
        </p>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-5 shadow-xs">
        <div className="flex items-center justify-between text-xs font-bold text-zinc-500">
          <span>KAYITLI MÜŞTERİ İLETİŞİMİ</span>
          <UserCheck size={17} className="text-sky-600" />
        </div>
        <div className="text-2xl font-black text-zinc-950 dark:text-white mt-2 tabular-nums">
          {summary.customer_clicks.toLocaleString("tr-TR")}
        </div>
        <p className="text-[11px] text-zinc-500 mt-1">
          {summary.unique_customers.toLocaleString("tr-TR")} farklı üye müşteri • {summary.guest_clicks.toLocaleString("tr-TR")} misafir tıklaması
        </p>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-5 shadow-xs">
        <div className="flex items-center justify-between text-xs font-bold text-zinc-500">
          <span>TEDARİKÇİ DOĞRUDAN HAT PAYI</span>
          <Building2 size={17} className="text-amber-600" />
        </div>
        <div className="text-2xl font-black text-zinc-950 dark:text-white mt-2 tabular-nums">
          {summary.total_clicks > 0
            ? `%${Math.round((summary.supplier_clicks / summary.total_clicks) * 100)}`
            : "%0"}
        </div>
        <p className="text-[11px] text-zinc-500 mt-1">
          Üretici firma ve ürün WhatsApp yönlendirmeleri
        </p>
      </div>
    </div>
  );
}

function WhatsappSupplierTable({
  suppliers,
  selectedBrandId,
  onSelectBrand,
}: {
  readonly suppliers: readonly WhatsappSupplierBreakdown[];
  readonly selectedBrandId: string;
  readonly onSelectBrand: (brandId: string) => void;
}) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs overflow-hidden">
      <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <Building2 size={16} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
              Tedarikçi Bazlı WhatsApp Tıklama Dağılımı
            </h2>
            <p className="text-[11px] text-zinc-500">
              Bir tedarikçiye tıklayarak alttaki müşteri loglarını filtreleyebilirsiniz
            </p>
          </div>
        </div>
        {selectedBrandId && (
          <button
            type="button"
            onClick={() => onSelectBrand("")}
            className="text-xs font-bold text-violet-600 hover:underline cursor-pointer bg-transparent border-none"
          >
            Tüm Tedarikçileri Göster
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-50/80 dark:bg-zinc-950/40 text-[11px] font-bold text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
              <th className="py-2.5 px-4">TEDARİKÇİ / HAT</th>
              <th className="py-2.5 px-4">WHATSAPP NUMARASI</th>
              <th className="py-2.5 px-4 text-right">TIKLAMA</th>
              <th className="py-2.5 px-4 text-right">TEKİL KİŞİ</th>
              <th className="py-2.5 px-4 text-right">ÜYE MÜŞTERİ</th>
              <th className="py-2.5 px-4 text-right">ÜRÜNDEN</th>
              <th className="py-2.5 px-4 text-right">SON TIKLAMA</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
            {suppliers.map((sup) => {
              const isSelected = selectedBrandId === sup.brand_id;
              return (
                <tr
                  key={sup.brand_id}
                  onClick={() => onSelectBrand(isSelected ? "" : sup.brand_id)}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-emerald-50/80 dark:bg-emerald-950/40"
                      : "hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                  }`}
                >
                  <td className="py-3 px-4 font-bold text-zinc-900 dark:text-white">
                    {sup.brand_name}
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                    {sup.whatsapp_phone || "-"}
                  </td>
                  <td className="py-3 px-4 text-right font-black tabular-nums text-zinc-950 dark:text-white">
                    {sup.total_clicks.toLocaleString("tr-TR")}
                  </td>
                  <td className="py-3 px-4 text-right font-bold tabular-nums text-zinc-700 dark:text-zinc-300">
                    {sup.unique_people.toLocaleString("tr-TR")}
                  </td>
                  <td className="py-3 px-4 text-right font-bold tabular-nums text-sky-700 dark:text-sky-400">
                    {sup.customer_clicks.toLocaleString("tr-TR")} ({sup.unique_customers})
                  </td>
                  <td className="py-3 px-4 text-right font-semibold tabular-nums text-zinc-600 dark:text-zinc-400">
                    {sup.product_clicks.toLocaleString("tr-TR")}
                  </td>
                  <td className="py-3 px-4 text-right text-[11px] text-zinc-500 whitespace-nowrap">
                    {formatTimestampTr(sup.last_clicked_at)}
                  </td>
                </tr>
              );
            })}
            {suppliers.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-xs text-zinc-400">
                  Kayıtlı tedarikçi WhatsApp hattı veya tıklama verisi bulunamadı.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WhatsappTopProductsTable({
  products,
}: {
  readonly products: readonly WhatsappProductStat[];
}) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs overflow-hidden">
      <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
          <Package size={16} />
        </div>
        <div>
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
            WhatsApp İle En Çok Sorulan Ürünler
          </h2>
          <p className="text-[11px] text-zinc-500">
            Alıcıların doğrudan tedarikçi WhatsApp hattını başlattığı ürünler
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-50/80 dark:bg-zinc-950/40 text-[11px] font-bold text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
              <th className="py-2.5 px-4">ÜRÜN &amp; SKU</th>
              <th className="py-2.5 px-4">TEDARİKÇİ</th>
              <th className="py-2.5 px-4 text-right">TIKLAMA</th>
              <th className="py-2.5 px-4 text-right">TEKİL KİŞİ</th>
              <th className="py-2.5 px-4 text-right">ÜYE MÜŞTERİ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
            {products.map((prod) => (
              <tr key={prod.product_id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                <td className="py-3 px-4">
                  <Link
                    href={`/product/${encodeURIComponent(prod.slug || prod.product_id)}`}
                    target="_blank"
                    className="font-bold text-zinc-900 dark:text-white hover:text-emerald-700 inline-flex items-center gap-1"
                  >
                    <span className="max-w-[260px] truncate">{prod.title}</span>
                    <ExternalLink size={11} className="shrink-0 opacity-60" />
                  </Link>
                  <div className="text-[11px] font-mono text-zinc-400">
                    SKU: {prod.custom_sku || "-"}
                  </div>
                </td>
                <td className="py-3 px-4 font-semibold text-zinc-700 dark:text-zinc-300">
                  {prod.brand_name || "-"}
                </td>
                <td className="py-3 px-4 text-right font-black tabular-nums text-emerald-700 dark:text-emerald-400">
                  {prod.total_clicks.toLocaleString("tr-TR")}
                </td>
                <td className="py-3 px-4 text-right font-bold tabular-nums text-zinc-700 dark:text-zinc-300">
                  {prod.unique_people.toLocaleString("tr-TR")}
                </td>
                <td className="py-3 px-4 text-right font-bold tabular-nums text-sky-700 dark:text-sky-400">
                  {prod.unique_customers.toLocaleString("tr-TR")}
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-xs text-zinc-400">
                  Seçili dönemde ürün bazlı WhatsApp tıklama kaydı bulunamadı.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WhatsappLogsTable({
  logs,
  totalLogs,
  offset,
  onPageChange,
}: {
  readonly logs: readonly WhatsappClickLogItem[];
  readonly totalLogs: number;
  readonly offset: number;
  readonly onPageChange: (nextOffset: number) => void;
}) {
  const startNo = totalLogs === 0 ? 0 : offset + 1;
  const endNo = Math.min(offset + logs.length, totalLogs);

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-50/80 dark:bg-zinc-950/40 text-[11px] font-bold text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
              <th className="py-3 px-4">TARİH / SAAT</th>
              <th className="py-3 px-4">MÜŞTERİ / ZİYARETÇİ</th>
              <th className="py-3 px-4">TEDARİKÇİ &amp; AÇILAN NUMARA</th>
              <th className="py-3 px-4">ÜRÜN &amp; ALAN</th>
              <th className="py-3 px-4">KONUM &amp; CİHAZ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
            {logs.map((row) => (
              <tr key={row.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40">
                <td className="py-3.5 px-4 whitespace-nowrap text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                  {formatTimestampTr(row.created_at)}
                </td>
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {row.actor_type === "customer" ? (
                      <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 text-[10px] font-bold">
                        Üye Müşteri
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 border border-zinc-200 text-[10px] font-bold">
                        Misafir
                      </span>
                    )}
                    {row.user_id ? (
                      <Link
                        href={`/admin/member-journeys?customer_id=${encodeURIComponent(row.user_id)}`}
                        className="font-bold text-zinc-900 dark:text-white hover:text-violet-600 underline decoration-zinc-300"
                      >
                        {row.customer_name}
                      </Link>
                    ) : (
                      <span className="font-bold text-zinc-800 dark:text-zinc-200">
                        {row.customer_name}
                      </span>
                    )}
                  </div>
                  {(row.customer_email || row.customer_phone) && (
                    <div className="text-[11px] text-zinc-500 mt-0.5">
                      {row.customer_email}
                      {row.customer_email && row.customer_phone ? " • " : ""}
                      {row.customer_phone}
                    </div>
                  )}
                  {!row.user_id && row.visitor_id && (
                    <div className="text-[10px] font-mono text-zinc-400 mt-0.5">
                      Ziyaretçi: {row.visitor_id.slice(0, 14)}
                    </div>
                  )}
                </td>
                <td className="py-3.5 px-4">
                  <div className="font-bold text-zinc-900 dark:text-white">{row.brand_name}</div>
                  <div className="text-[11px] font-mono font-semibold text-emerald-700 dark:text-emerald-400 mt-0.5">
                    {row.target_phone || "-"}
                  </div>
                </td>
                <td className="py-3.5 px-4">
                  {row.product_id ? (
                    <Link
                      href={`/product/${encodeURIComponent(row.product_slug || row.product_id)}`}
                      target="_blank"
                      className="font-bold text-zinc-900 dark:text-white hover:text-emerald-700 inline-flex items-center gap-1"
                    >
                      <span className="max-w-[230px] truncate">{row.product_title}</span>
                      <ExternalLink size={11} className="shrink-0 opacity-60" />
                    </Link>
                  ) : (
                    <span className="text-zinc-500 font-semibold">Genel İletişim</span>
                  )}
                  <div className="flex items-center gap-1.5 flex-wrap mt-1">
                    {row.product_sku && (
                      <span className="text-[10px] font-mono text-zinc-400">SKU: {row.product_sku}</span>
                    )}
                    <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200/70 text-[10px] font-bold">
                      {formatSurfaceLabel(row.source_surface)}
                    </span>
                  </div>
                </td>
                <td className="py-3.5 px-4 whitespace-nowrap text-[11px] text-zinc-600 dark:text-zinc-400">
                  <div className="font-semibold">
                    {row.country_code} / {row.language_code.toUpperCase()} • {row.device_type}
                  </div>
                  <div className="text-[10px] font-mono text-zinc-400 mt-0.5">
                    IP: {row.ip_address || "-"}
                  </div>
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="py-12 text-center text-xs text-zinc-400">
                  Filtrelerle eşleşen WhatsApp tıklama kaydı bulunamadı.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalLogs > 0 && (
        <div className="px-4 py-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
          <span>
            Toplam <strong className="text-zinc-900 dark:text-white">{totalLogs.toLocaleString("tr-TR")}</strong> kayıttan{" "}
            <strong>{startNo}–{endNo}</strong> gösteriliyor
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={offset === 0}
              onClick={() => onPageChange(Math.max(0, offset - PAGE_SIZE))}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 disabled:opacity-40 cursor-pointer bg-white dark:bg-zinc-900 font-bold text-zinc-700 dark:text-zinc-200"
            >
              <ChevronLeft size={14} />
              <span>Önceki</span>
            </button>
            <button
              type="button"
              disabled={offset + PAGE_SIZE >= totalLogs}
              onClick={() => onPageChange(offset + PAGE_SIZE)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 disabled:opacity-40 cursor-pointer bg-white dark:bg-zinc-900 font-bold text-zinc-700 dark:text-zinc-200"
            >
              <span>Sonraki</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function WhatsappClicksPanel({
  embedded = false,
  initialPeriod,
  initialBrandId,
}: WhatsappClicksPanelProps) {
  const { fetchWithConfig } = useAdmin();
  const [localPeriod, setLocalPeriod] = useState<WhatsappPeriod>(() =>
    normalizePeriod(initialPeriod)
  );
  const [brandId, setBrandId] = useState<string>(() => (initialBrandId || "").trim());
  const [actorType, setActorType] = useState<WhatsappActorFilter>("all");
  const [searchInput, setSearchInput] = useState<string>("");
  const [appliedSearch, setAppliedSearch] = useState<string>("");
  const [offset, setOffset] = useState<number>(0);
  const [reloadTick, setReloadTick] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [payload, setPayload] = useState<AdminWhatsappClicksPayload>(EMPTY_PAYLOAD);

  const effectivePeriod = embedded && initialPeriod ? normalizePeriod(initialPeriod) : localPeriod;

  useEffect(() => {
    let cancelled = false;

    async function loadWhatsappAnalytics() {
      const qs = new URLSearchParams({
        period: effectivePeriod,
        actor_type: actorType,
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      if (brandId) qs.set("brand_id", brandId);
      if (appliedSearch) qs.set("search", appliedSearch);

      try {
        const res = await fetchWithConfig(`/api/v1/admin/analytics/whatsapp-clicks?${qs.toString()}`);
        if (cancelled) return;
        if (!res.ok) {
          setErrorMsg("WhatsApp iletişim logları yüklenirken bir hata oluştu.");
          return;
        }
        const data = (await res.json()) as AdminWhatsappClicksPayload;
        setPayload(data);
        setErrorMsg(null);
      } catch {
        if (!cancelled) {
          setErrorMsg("Sunucu bağlantısı kurulamadı.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadWhatsappAnalytics();
    return () => {
      cancelled = true;
    };
  }, [fetchWithConfig, effectivePeriod, brandId, actorType, appliedSearch, offset, reloadTick]);

  const supplierOptions = useMemo(
    () =>
      payload.by_supplier.map((s) => ({
        id: s.brand_id,
        label: s.whatsapp_phone ? `${s.brand_name} (${s.whatsapp_phone})` : s.brand_name,
      })),
    [payload.by_supplier]
  );

  const handleBrandFilterChange = useCallback((nextBrandId: string) => {
    setLoading(true);
    setBrandId(nextBrandId);
    setOffset(0);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAppliedSearch(searchInput.trim());
    setOffset(0);
  };

  return (
    <div className="space-y-6">
      {!embedded && (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <MessageCircle size={20} />
            </div>
            <div>
              <h1 className="text-xl font-black text-zinc-950 dark:text-white">
                WhatsApp İletişim &amp; Tıklama Logları
              </h1>
              <p className="text-xs text-zinc-500 mt-1">
                Kaç kişi WhatsApp iletişimine tıkladı, hangi müşteri hangi tedarikçi ve ürünün WhatsApp hattını açtı gerçek zamanlı izleyin.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-semibold">
              {PERIOD_CHOICES.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setLoading(true);
                    setLocalPeriod(opt.id);
                    setOffset(0);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                    localPeriod === opt.id
                      ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs font-bold"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => downloadWhatsappCsv(payload.logs, effectivePeriod)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-bold text-zinc-700 dark:text-zinc-200 cursor-pointer"
            >
              <Download size={14} className="text-emerald-600" />
              <span>CSV</span>
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setLoading(true);
                setReloadTick((prev) => prev + 1);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-bold text-zinc-700 dark:text-zinc-200 cursor-pointer"
            >
              <RefreshCw size={14} className={loading ? "animate-spin text-emerald-600" : ""} />
              <span>Yenile</span>
            </button>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      <WhatsappKpiGrid summary={payload.summary} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <WhatsappSupplierTable
          suppliers={payload.by_supplier}
          selectedBrandId={brandId}
          onSelectBrand={handleBrandFilterChange}
        />
        <WhatsappTopProductsTable products={payload.top_products} />
      </div>

      {/* Filter Bar & Full Attribution Log Table */}
      <div className="space-y-4">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-4 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <select
              aria-label="Tedarikçiye göre filtrele"
              value={brandId}
              onChange={(e) => handleBrandFilterChange(e.target.value)}
              className="px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs font-bold text-zinc-800 dark:text-zinc-200"
            >
              <option value="">Tüm Tedarikçiler</option>
              {supplierOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>

            <select
              aria-label="Kişi tipine göre filtrele"
              value={actorType}
              onChange={(e) => {
                setLoading(true);
                setActorType(e.target.value as WhatsappActorFilter);
                setOffset(0);
              }}
              className="px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs font-bold text-zinc-800 dark:text-zinc-200"
            >
              <option value="all">Tüm Kişiler (Üye + Misafir)</option>
              <option value="customer">Sadece Kayıtlı Müşteriler</option>
              <option value="guest">Sadece Misafir Ziyaretçiler</option>
            </select>

            {embedded && (
              <button
                type="button"
                onClick={() => downloadWhatsappCsv(payload.logs, effectivePeriod)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-bold text-zinc-700 dark:text-zinc-200 cursor-pointer"
              >
                <Download size={14} className="text-emerald-600" />
                <span>Log CSV</span>
              </button>
            )}
          </div>

          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Müşteri, tedarikçi, ürün, SKU veya telefon ara..."
                className="pl-8 pr-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs w-64 sm:w-72"
              />
            </div>
            <button
              type="submit"
              className="px-3.5 py-2 rounded-xl bg-zinc-900 text-white text-xs font-bold cursor-pointer"
            >
              Ara
            </button>
          </form>
        </div>

        {loading && payload.logs.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-12 flex items-center justify-center gap-2 text-xs font-bold text-zinc-500">
            <Loader2 size={18} className="animate-spin text-emerald-600" />
            <span>WhatsApp iletişim logları yükleniyor...</span>
          </div>
        ) : (
          <WhatsappLogsTable
            logs={payload.logs}
            totalLogs={payload.total_logs}
            offset={offset}
            onPageChange={(nextOffset) => {
              setLoading(true);
              setOffset(nextOffset);
            }}
          />
        )}
      </div>
    </div>
  );
}
