"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ShieldAlert,
  UserCheck,
  Users,
  History,
  Search,
  RefreshCw,
  Filter,
  PackagePlus,
  Clock,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import {
  Brand,
  SupplierAuditLogsResponse,
  SupplierAuditProductLog,
  SupplierAuditSessionLog,
  SupplierAuditSummary,
} from "@/types/integration";
import { resolveProductActorMeta } from "@/utils/supplierImpersonation";

interface SupplierAuditLogsSectionProps {
  suppliers: Brand[];
  apiUrl: string;
  token: string | null;
}

const ACTION_LABELS: Record<string, { label: string; cls: string }> = {
  create: { label: "Yeni Ürün", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  batch_create: { label: "Hızlı Taslak", cls: "bg-sky-50 text-sky-700 border-sky-200" },
  excel_import: { label: "Excel Aktarımı", cls: "bg-violet-50 text-violet-700 border-violet-200" },
  update: { label: "Güncelleme", cls: "bg-amber-50 text-amber-800 border-amber-200" },
  delete: { label: "Silme", cls: "bg-rose-50 text-rose-700 border-rose-200" },
};

function formatAuditDateTime(iso?: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("tr-TR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function AuditSummaryCards({ summary }: Readonly<{ summary: SupplierAuditSummary }>) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 flex items-center gap-3.5">
        <div className="p-2.5 rounded-xl bg-amber-100 text-amber-800">
          <ShieldAlert size={18} />
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">
            Admin Tedarikçi Oturumuyla Yüklenen
          </span>
          <span className="text-xl font-extrabold text-amber-950 block mt-0.5">
            {summary.admin_impersonation_creates.toLocaleString("tr-TR")}
          </span>
        </div>
      </div>

      <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 flex items-center gap-3.5">
        <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-700">
          <ShieldCheck size={18} />
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
            Ana Hesap (Tedarikçi) Yüklemeleri
          </span>
          <span className="text-xl font-extrabold text-emerald-950 block mt-0.5">
            {summary.owner_creates.toLocaleString("tr-TR")}
          </span>
        </div>
      </div>

      <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-2xl p-4 flex items-center gap-3.5">
        <div className="p-2.5 rounded-xl bg-indigo-100 text-indigo-700">
          <Users size={18} />
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 block">
            Alt Kullanıcı Yüklemeleri
          </span>
          <span className="text-xl font-extrabold text-indigo-950 block mt-0.5">
            {summary.sub_user_creates.toLocaleString("tr-TR")}
          </span>
        </div>
      </div>

      <div className="bg-violet-50/70 border border-violet-200/80 rounded-2xl p-4 flex items-center gap-3.5">
        <div className="p-2.5 rounded-xl bg-violet-100 text-violet-700">
          <UserCheck size={18} />
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-violet-700 block">
            Admin Girişi / Toplam Oturum
          </span>
          <span className="text-xl font-extrabold text-violet-950 block mt-0.5">
            {summary.admin_impersonation_sessions.toLocaleString("tr-TR")} /{" "}
            {summary.total_sessions.toLocaleString("tr-TR")}
          </span>
        </div>
      </div>
    </div>
  );
}

function ProductAuditTable({
  items,
  loading,
}: Readonly<{
  items: readonly SupplierAuditProductLog[];
  loading: boolean;
}>) {
  if (loading) {
    return (
      <div className="py-12 text-center text-xs text-zinc-400">
        <RefreshCw size={22} className="animate-spin mx-auto text-violet-500 mb-2" />
        Ürün yükleme ve düzenleme denetim logları yükleniyor...
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="py-12 text-center text-xs text-zinc-400">
        Seçili filtrelere uygun ürün yükleme veya düzenleme kaydı bulunamadı.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse text-xs">
        <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-bold uppercase text-[10px] tracking-wider">
          <tr>
            <th className="py-3 px-4">Tarih & Saat</th>
            <th className="py-3 px-4">Tedarikçi Firma</th>
            <th className="py-3 px-4">Ürün & Model Kodu</th>
            <th className="py-3 px-4">İşlem</th>
            <th className="py-3 px-4">Oturum Türü</th>
            <th className="py-3 px-4">Açan / Yükleyen Kullanıcı</th>
            <th className="py-3 px-4">Yönetici (Adına Oturum)</th>
            <th className="py-3 px-4">IP</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {items.map((row) => {
            const actorMeta = resolveProductActorMeta(row.actor_type, row.actor_role);
            const actionMeta = ACTION_LABELS[row.action] || {
              label: row.action,
              cls: "bg-zinc-100 text-zinc-700 border-zinc-200",
            };
            return (
              <tr key={row.id} className="hover:bg-zinc-50/70 transition-colors">
                <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-zinc-700">
                  <span className="inline-flex items-center gap-1">
                    <Clock size={11} className="text-zinc-400" />
                    {formatAuditDateTime(row.created_at)}
                  </span>
                </td>
                <td className="py-3 px-4 font-bold text-zinc-900">{row.brand_name || "-"}</td>
                <td className="py-3 px-4">
                  <div className="flex flex-col gap-0.5 max-w-xs">
                    <span className="font-semibold text-zinc-900 truncate" title={row.product_title}>
                      {row.product_title || "(Başlıksız Ürün)"}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500">
                      {row.custom_sku || row.product_id || "-"}
                    </span>
                  </div>
                </td>
                <td className="py-3 px-4 whitespace-nowrap">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${actionMeta.cls}`}>
                    {actionMeta.label}
                  </span>
                </td>
                <td className="py-3 px-4 whitespace-nowrap">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${actorMeta.badgeClass}`}>
                    {actorMeta.shortLabel}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <div className="flex flex-col">
                    <span className="font-semibold text-zinc-800">{row.actor_name || "-"}</span>
                    <span className="text-[10px] font-mono text-zinc-500">{row.actor_email || "-"}</span>
                    {row.actor_role && (
                      <span className="text-[10px] text-zinc-400">{row.actor_role}</span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-4">
                  {row.impersonated_by_email ? (
                    <div className="flex flex-col">
                      <span className="font-bold text-amber-800">{row.impersonated_by_email}</span>
                      <span className="text-[10px] text-amber-600 uppercase font-semibold">
                        {row.impersonated_by_role || "admin"}
                      </span>
                    </div>
                  ) : (
                    <span className="text-zinc-400">-</span>
                  )}
                </td>
                <td className="py-3 px-4 font-mono text-[11px] text-zinc-500 whitespace-nowrap">
                  {row.ip_address || "-"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SessionAuditTable({
  items,
  loading,
}: Readonly<{
  items: readonly SupplierAuditSessionLog[];
  loading: boolean;
}>) {
  if (loading) {
    return (
      <div className="py-12 text-center text-xs text-zinc-400">
        <RefreshCw size={22} className="animate-spin mx-auto text-violet-500 mb-2" />
        Tedarikçi ve admin oturum kayıtları yükleniyor...
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="py-12 text-center text-xs text-zinc-400">
        Seçili filtrelere uygun oturum kaydı bulunamadı.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse text-xs">
        <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-bold uppercase text-[10px] tracking-wider">
          <tr>
            <th className="py-3 px-4">Tarih & Saat</th>
            <th className="py-3 px-4">Oturum Türü</th>
            <th className="py-3 px-4">Tedarikçi Firma</th>
            <th className="py-3 px-4">Tedarikçi Hesabı</th>
            <th className="py-3 px-4">İşlemi Yapan Admin</th>
            <th className="py-3 px-4">IP Adresi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {items.map((sess) => {
            const actorMeta = resolveProductActorMeta(sess.session_type, sess.supplier_job_title);
            return (
              <tr key={sess.id} className="hover:bg-zinc-50/70 transition-colors">
                <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-zinc-700">
                  <span className="inline-flex items-center gap-1">
                    <Clock size={11} className="text-zinc-400" />
                    {formatAuditDateTime(sess.created_at)}
                  </span>
                </td>
                <td className="py-3 px-4 whitespace-nowrap">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${actorMeta.badgeClass}`}>
                    {actorMeta.shortLabel}
                  </span>
                </td>
                <td className="py-3 px-4 font-bold text-zinc-900">{sess.brand_name || "-"}</td>
                <td className="py-3 px-4">
                  <div className="flex flex-col">
                    <span className="font-semibold text-zinc-800">
                      {sess.supplier_contact_name || "-"}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500">
                      {sess.supplier_email || "-"}
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      {sess.supplier_is_owner ? "Ana Hesap" : "Alt Temsilci"}{" "}
                      {sess.supplier_job_title ? `• ${sess.supplier_job_title}` : ""}
                    </span>
                  </div>
                </td>
                <td className="py-3 px-4">
                  {sess.admin_email ? (
                    <div className="flex flex-col">
                      <span className="font-bold text-amber-800">{sess.admin_name || sess.admin_email}</span>
                      <span className="text-[10px] font-mono text-amber-700">{sess.admin_email}</span>
                      <span className="text-[10px] uppercase text-amber-600 font-semibold">
                        {sess.admin_role}
                      </span>
                    </div>
                  ) : (
                    <span className="text-zinc-400">Doğrudan Tedarikçi Girişi</span>
                  )}
                </td>
                <td className="py-3 px-4 font-mono text-[11px] text-zinc-500 whitespace-nowrap">
                  {sess.ip_address || "-"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function SupplierAuditLogsSection({
  suppliers,
  apiUrl,
  token,
}: Readonly<SupplierAuditLogsSectionProps>) {
  const [logType, setLogType] = useState<"products" | "sessions">("products");
  const [brandFilter, setBrandFilter] = useState("");
  const [actorTypeFilter, setActorTypeFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 30;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [productItems, setProductItems] = useState<SupplierAuditProductLog[]>([]);
  const [sessionItems, setSessionItems] = useState<SupplierAuditSessionLog[]>([]);
  const [summary, setSummary] = useState<SupplierAuditSummary>({
    total_product_events: 0,
    admin_impersonation_creates: 0,
    owner_creates: 0,
    sub_user_creates: 0,
    total_sessions: 0,
    admin_impersonation_sessions: 0,
  });

  const buildAuditQueryString = useCallback(() => {
    const qs = new URLSearchParams({
      type: logType,
      limit: String(limit),
      offset: String(offset),
    });
    if (brandFilter) qs.set("brand_id", brandFilter);
    if (actorTypeFilter !== "all") qs.set("actor_type", actorTypeFilter);
    if (logType === "products" && actionFilter !== "all") qs.set("action", actionFilter);
    if (searchQuery.trim()) qs.set("q", searchQuery.trim());
    return qs.toString();
  }, [actionFilter, actorTypeFilter, brandFilter, logType, offset, searchQuery]);

  const applyAuditResponse = useCallback(
    (data: SupplierAuditLogsResponse, targetType: "products" | "sessions") => {
      if (data.summary) setSummary(data.summary);
      setTotal(data.total || 0);
      if (targetType === "sessions") {
        setSessionItems(Array.isArray(data.items) ? (data.items as SupplierAuditSessionLog[]) : []);
      } else {
        setProductItems(Array.isArray(data.items) ? (data.items as SupplierAuditProductLog[]) : []);
      }
    },
    []
  );

  const loadLogs = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const qs = buildAuditQueryString();
      const res = await fetch(`${apiUrl}/api/v1/admin/supplier-audit-logs?${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error(`Loglar yüklenemedi (HTTP ${res.status})`);
      }
      const data = (await res.json()) as SupplierAuditLogsResponse;
      applyAuditResponse(data, logType);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Denetim logları yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [apiUrl, applyAuditResponse, buildAuditQueryString, logType, token]);

  useEffect(() => {
    if (!token) return;
    let ignore = false;
    const targetType = logType;
    const qs = buildAuditQueryString();

    fetch(`${apiUrl}/api/v1/admin/supplier-audit-logs?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Loglar yüklenemedi (HTTP ${res.status})`);
        }
        return (await res.json()) as SupplierAuditLogsResponse;
      })
      .then((data) => {
        if (!ignore) {
          setError(null);
          applyAuditResponse(data, targetType);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Denetim logları yüklenemedi");
        }
      });

    return () => {
      ignore = true;
    };
  }, [apiUrl, applyAuditResponse, buildAuditQueryString, logType, token]);

  const handleSwitchType = (nextType: "products" | "sessions") => {
    setLogType(nextType);
    setOffset(0);
  };

  return (
    <div className="flex flex-col gap-5 animate-in fade-in duration-200">
      <div className="bg-white border border-zinc-200/70 rounded-3xl p-5 shadow-sm flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
              <History size={18} className="text-violet-600" />
              Tedarikçi Oturumları & Ürün Yükleme Denetim Kayıtları
            </h3>
            <p className="text-xs text-zinc-500 mt-1">
              Hangi ürünün saat kaçta, admin tedarikçi oturumuyla mı yoksa tedarikçi ana hesap / alt kullanıcı tarafından mı yüklendiğini inceleyin.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/supplier"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-600 hover:bg-zinc-50 inline-flex items-center gap-1.5"
            >
              <ExternalLink size={13} />
              Tedarikçi Portalı
            </a>
            <button
              type="button"
              onClick={() => void loadLogs()}
              disabled={loading}
              className="px-3.5 py-2 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-700 hover:bg-zinc-50 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              Yenile
            </button>
          </div>
        </div>

        <AuditSummaryCards summary={summary} />

        {/* Switch & Filters */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1">
          <div className="inline-flex bg-zinc-100 p-1 rounded-xl border border-zinc-200/70 w-fit">
            <button
              type="button"
              onClick={() => handleSwitchType("products")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                logType === "products"
                  ? "bg-white text-violet-700 shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              <PackagePlus size={14} />
              Ürün Yükleme & Düzenleme Logları
            </button>
            <button
              type="button"
              onClick={() => handleSwitchType("sessions")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                logType === "sessions"
                  ? "bg-white text-amber-800 shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              <UserCheck size={14} />
              Tedarikçi & Admin Oturum Geçmişi
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setOffset(0);
                }}
                placeholder="Ürün, SKU, e-posta, admin ara..."
                className="pl-8 pr-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-violet-500 w-56"
              />
            </div>

            <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs">
              <Filter size={12} className="text-zinc-400" />
              <select
                value={brandFilter}
                onChange={(e) => {
                  setBrandFilter(e.target.value);
                  setOffset(0);
                }}
                className="bg-transparent focus:outline-none font-semibold text-zinc-700 cursor-pointer"
              >
                <option value="">Tüm Tedarikçiler</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <select
              value={actorTypeFilter}
              onChange={(e) => {
                setActorTypeFilter(e.target.value);
                setOffset(0);
              }}
              className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-700 focus:outline-none focus:border-violet-500 cursor-pointer"
            >
              <option value="all">Tüm Oturum Türleri</option>
              <option value="admin_impersonation">Admin Tedarikçi Oturumu</option>
              <option value="supplier_owner">Tedarikçi Ana Hesap</option>
              <option value="supplier_sub_user">Tedarikçi Alt Kullanıcı</option>
            </select>

            {logType === "products" && (
              <select
                value={actionFilter}
                onChange={(e) => {
                  setActionFilter(e.target.value);
                  setOffset(0);
                }}
                className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-700 focus:outline-none focus:border-violet-500 cursor-pointer"
              >
                <option value="all">Tüm İşlemler</option>
                <option value="create">Yeni Ürün Açma</option>
                <option value="batch_create">Hızlı Taslak</option>
                <option value="excel_import">Excel İçe Aktarma</option>
                <option value="update">Güncelleme</option>
                <option value="delete">Silme</option>
              </select>
            )}
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
            {error}
          </div>
        )}

        <div className="border border-zinc-200/70 rounded-2xl overflow-hidden bg-white">
          {logType === "sessions" ? (
            <SessionAuditTable items={sessionItems} loading={loading} />
          ) : (
            <ProductAuditTable items={productItems} loading={loading} />
          )}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between text-xs text-zinc-500 pt-1">
          <span>
            Toplam <strong className="text-zinc-800">{total.toLocaleString("tr-TR")}</strong> kayıt
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOffset((prev) => Math.max(0, prev - limit))}
              disabled={offset === 0 || loading}
              className="px-3 py-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-700 font-semibold disabled:opacity-40 inline-flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft size={13} />
              Önceki
            </button>
            <span className="font-mono text-[11px]">
              {offset + 1} - {Math.min(offset + limit, Math.max(total, offset))}
            </span>
            <button
              type="button"
              onClick={() => setOffset((prev) => prev + limit)}
              disabled={offset + limit >= total || loading}
              className="px-3 py-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-700 font-semibold disabled:opacity-40 inline-flex items-center gap-1 cursor-pointer"
            >
              Sonraki
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
