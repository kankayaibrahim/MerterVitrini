"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Ban,
  CheckCircle2,
  Compass,
  Info,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShoppingBag,
  ShoppingCart,
  Trash2,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import CountryFlagBadge from "../analytics/CountryFlagBadge";
import CustomerJourneyPanel from "./CustomerJourneyPanel";
import { CustomerKpiCards } from "./CustomerKpiCards";
import { CustomersGeoInsightsSection } from "./CustomersGeoInsightsSection";
import { CustomersFilterBar } from "./CustomersFilterBar";
import { CustomerDetailModal } from "./CustomerDetailModal";
import {
  Customer,
  CustomerFiltersState,
  CustomerPeriodFilter,
  CustomerStatusFilter,
  CustomersOverviewResponse,
  formatCurrencyTry,
  formatDateTimeTr,
  formatRelativeTimeTr,
  geoSourceLabelTr,
  isRegisteredTodayIstanbul,
} from "./customerTypes";

interface CustomersManagerProps {
  readonly apiUrl: string;
  readonly token: string | null;
}

const DEFAULT_FILTERS: CustomerFiltersState = {
  search: "",
  country: "ALL",
  period: "",
  status: "",
  sort: "newest",
};

export default function CustomersManager({ apiUrl, token }: CustomersManagerProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [overview, setOverview] = useState<CustomersOverviewResponse | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [syncingGeo, setSyncingGeo] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<CustomerFiltersState>(DEFAULT_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const isFirstSearchRun = useRef(true);

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [journeyCustomer, setJourneyCustomer] = useState<Customer | null>(null);

  const [blockTarget, setBlockTarget] = useState<Customer | null>(null);
  const [blockReasonInput, setBlockReasonInput] = useState("");
  const [blockingId, setBlockingId] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${apiUrl}/api/v1/customers/overview`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data: CustomersOverviewResponse = await res.json();
      setOverview(data);
    } catch {
      // Overview error is surfaced gently without blocking list operations
    } finally {
      setLoadingOverview(false);
    }
  }, [apiUrl, token]);

  const loadCustomers = useCallback(
    async (activeFilters: CustomerFiltersState, searchTerm: string) => {
      if (!token) return;
      try {
        const params = new URLSearchParams();
        if (searchTerm.trim() !== "") params.set("search", searchTerm.trim());
        if (activeFilters.country && activeFilters.country !== "ALL") {
          params.set("country", activeFilters.country);
        }
        if (activeFilters.period) params.set("period", activeFilters.period);
        if (activeFilters.status) params.set("status", activeFilters.status);
        if (activeFilters.sort) params.set("sort", activeFilters.sort);

        const qs = params.toString();
        const url = qs ? `${apiUrl}/api/v1/customers?${qs}` : `${apiUrl}/api/v1/customers`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          throw new Error("Müşteriler yüklenemedi.");
        }
        const data: Customer[] = await res.json();
        setCustomers(Array.isArray(data) ? data : []);
        setError(null);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu.");
      } finally {
        setLoadingList(false);
      }
    },
    [apiUrl, token]
  );

  useEffect(() => {
    if (isFirstSearchRun.current) {
      isFirstSearchRun.current = false;
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedSearch(filters.search);
    }, 260);
    return () => clearTimeout(timer);
  }, [filters.search]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      await loadOverview();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [token, loadOverview]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      await loadCustomers(filters, debouncedSearch);
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [
    token,
    debouncedSearch,
    filters.country,
    filters.period,
    filters.status,
    filters.sort,
    filters,
    loadCustomers,
  ]);

  const handleRefreshAll = async () => {
    setLoadingList(true);
    setLoadingOverview(true);
    await Promise.all([loadOverview(), loadCustomers(filters, filters.search)]);
  };

  const handleFiltersChange = (next: CustomerFiltersState) => {
    setLoadingList(true);
    setFilters(next);
    if (next.search === "") {
      setDebouncedSearch("");
    }
  };

  const handleResetFilters = () => {
    setLoadingList(true);
    setFilters(DEFAULT_FILTERS);
    setDebouncedSearch("");
  };

  const handleSelectPeriod = (period: CustomerPeriodFilter) => {
    setLoadingList(true);
    setFilters((prev) => ({ ...prev, period }));
  };

  const handleSelectStatus = (status: CustomerStatusFilter) => {
    setLoadingList(true);
    setFilters((prev) => ({ ...prev, status }));
  };

  const handleSelectCountry = (country: string) => {
    setLoadingList(true);
    setFilters((prev) => ({ ...prev, country: country || "ALL" }));
  };

  const handleSyncGeo = async () => {
    if (!token || syncingGeo) return;
    setSyncingGeo(true);
    setSyncMessage(null);
    try {
      const res = await fetch(`${apiUrl}/api/v1/customers/sync-geo`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error("Konum senkronizasyonu başarısız oldu.");
      }
      const data: { updated_count?: number } = await res.json();
      const updated = data.updated_count ?? 0;
      setSyncMessage(
        updated > 0 ? `${updated} müşterinin konumu güncellendi` : "Tüm konumlar güncel"
      );
      await Promise.all([loadOverview(), loadCustomers(filters, debouncedSearch)]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Konum senkronizasyonu sırasında hata oluştu.");
    } finally {
      setSyncingGeo(false);
    }
  };

  const handleSelectCustomerById = useCallback(
    (customerId: string) => {
      const existing = customers.find((c) => c.id === customerId);
      if (existing) {
        setSelectedCustomer(existing);
        return;
      }
      if (!token) return;
      void (async () => {
        try {
          const res = await fetch(`${apiUrl}/api/v1/customers`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) return;
          const all: Customer[] = await res.json();
          const match = all.find((c) => c.id === customerId);
          if (match) setSelectedCustomer(match);
        } catch {
          // Ignore lookup error cleanly
        }
      })();
    },
    [apiUrl, customers, token]
  );

  const openBlockDialogOrUnblock = (c: Customer) => {
    if (!c.is_blocked) {
      setBlockTarget(c);
      setBlockReasonInput("");
      return;
    }
    void executeToggleBlock(c, false, "");
  };

  const executeToggleBlock = async (c: Customer, isBlocked: boolean, reason: string) => {
    if (!token) return;
    setBlockingId(c.id);
    try {
      const res = await fetch(`${apiUrl}/api/v1/customers/${c.id}/block`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_blocked: isBlocked, block_reason: reason }),
      });
      if (!res.ok) {
        throw new Error("Durum güncellenemedi.");
      }
      setBlockTarget(null);
      if (selectedCustomer?.id === c.id) {
        setSelectedCustomer({
          ...c,
          is_blocked: isBlocked,
          block_reason: isBlocked ? reason : null,
          is_active: !isBlocked,
        });
      }
      await Promise.all([loadOverview(), loadCustomers(filters, debouncedSearch)]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Müşteri durumu güncellenemedi.");
    } finally {
      setBlockingId(null);
    }
  };

  const executeDeleteCustomer = async () => {
    if (!token || !deleteTarget) return;
    setDeletingId(deleteTarget.id);
    try {
      const res = await fetch(`${apiUrl}/api/v1/customers/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error("Müşteri silinemedi.");
      }
      if (selectedCustomer?.id === deleteTarget.id) {
        setSelectedCustomer(null);
      }
      if (journeyCustomer?.id === deleteTarget.id) {
        setJourneyCustomer(null);
      }
      setDeleteTarget(null);
      await Promise.all([loadOverview(), loadCustomers(filters, debouncedSearch)]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Müşteri silinemedi.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 flex items-center gap-2.5">
            <Users className="w-6 h-6 text-indigo-600" />
            Müşteriler &amp; Coğrafi Analiz
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Günlük B2B kayıt performansı, ülke bazlı dağılım, OpenStreetMap müşteri yoğunluğu ve müşteri yaşam döngüsü.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/admin/member-journeys"
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl text-xs font-semibold hover:bg-indigo-100 transition-colors"
          >
            <Compass className="w-4 h-4" />
            Canlı Müşteri Akışı
          </Link>
          <button
            type="button"
            onClick={handleRefreshAll}
            disabled={loadingList || loadingOverview}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw
              className={`w-4 h-4 ${loadingList || loadingOverview ? "animate-spin" : ""}`}
            />
            Yenile
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 text-rose-800 border border-rose-200 p-4 rounded-2xl text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-medium">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-rose-700 hover:text-rose-900 font-semibold cursor-pointer"
          >
            Kapat
          </button>
        </div>
      )}

      <CustomerKpiCards
        kpis={overview?.kpis ?? null}
        loading={loadingOverview}
        activePeriod={filters.period}
        activeStatus={filters.status}
        activeCountry={filters.country}
        onSelectPeriod={handleSelectPeriod}
        onSelectStatus={handleSelectStatus}
        onSelectCountry={handleSelectCountry}
        onResetAll={handleResetFilters}
      />

      <CustomersGeoInsightsSection
        overview={overview}
        loading={loadingOverview}
        syncingGeo={syncingGeo}
        syncMessage={syncMessage}
        selectedCountry={filters.country}
        onSelectCountry={handleSelectCountry}
        onSyncGeo={handleSyncGeo}
        onSelectCustomerById={handleSelectCustomerById}
      />

      <CustomersFilterBar
        filters={filters}
        countries={overview?.countries ?? []}
        resultCount={customers.length}
        loading={loadingList}
        customers={customers}
        onChange={handleFiltersChange}
        onReset={handleResetFilters}
      />

      <div className="glass-card bg-white rounded-3xl border border-zinc-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/90 border-b border-zinc-200/80 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                <th className="py-3.5 px-5">Müşteri</th>
                <th className="py-3.5 px-4">Ülke &amp; Konum</th>
                <th className="py-3.5 px-4">Kayıt &amp; Son Aktiflik</th>
                <th className="py-3.5 px-4">Sipariş &amp; Etkileşim</th>
                <th className="py-3.5 px-4">Durum</th>
                <th className="py-3.5 px-5 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-sm">
              {loadingList && customers.length === 0 ? (
                Array.from({ length: 6 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-4 px-5">
                      <div className="h-4 w-40 bg-zinc-200 rounded mb-1.5" />
                      <div className="h-3 w-32 bg-zinc-100 rounded" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 w-28 bg-zinc-200 rounded" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 w-28 bg-zinc-200 rounded" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 w-24 bg-zinc-200 rounded" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-5 w-20 bg-zinc-200 rounded-full" />
                    </td>
                    <td className="py-4 px-5 text-right">
                      <div className="h-7 w-28 bg-zinc-100 rounded-xl ml-auto" />
                    </td>
                  </tr>
                ))
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-14 px-6 text-center text-zinc-500">
                    <div className="text-sm font-semibold text-zinc-700">
                      Seçili kriterlere uygun müşteri bulunamadı
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">
                      Filtreleri sıfırlayarak tüm kayıtları görüntüleyebilirsiniz.
                    </p>
                  </td>
                </tr>
              ) : (
                customers.map((c) => {
                  const registeredToday = isRegisteredTodayIstanbul(c.created_at);
                  const initial = (c.first_name || c.email || "?").charAt(0).toUpperCase();
                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-zinc-50/70 transition-colors align-top"
                    >
                      <td className="py-3.5 px-5">
                        <div className="flex items-start gap-3">
                          <div className="relative w-9 h-9 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                            {initial}
                            {c.is_online && (
                              <span
                                title="Şu an çevrimiçi"
                                className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white"
                              />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-bold text-zinc-900 truncate max-w-[200px]">
                                {c.first_name} {c.last_name}
                              </span>
                              {registeredToday && (
                                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wide">
                                  Bugün
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-zinc-500 truncate max-w-[240px]">
                              {c.email}
                            </div>
                            <div className="text-[11px] text-zinc-500 font-mono mt-0.5 flex flex-wrap items-center gap-2">
                              <span>{c.phone || "-"}</span>
                              {c.instagram_username && (
                                <span className="text-pink-700 font-sans font-medium">
                                  @{c.instagram_username}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-start gap-2">
                          <CountryFlagBadge
                            countryCode={c.country_code || ""}
                            title={c.country_name || c.country_code || "Konum bilinmiyor"}
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-zinc-900">
                              {c.country_name || (c.country_code ? c.country_code : "Konum Bekleniyor")}
                            </div>
                            <div className="text-[11px] text-zinc-500 truncate max-w-[160px]">
                              {[c.city, c.region_name].filter(Boolean).join(", ") ||
                                geoSourceLabelTr(c.geo_source)}
                            </div>
                            {c.registration_ip && (
                              <div className="text-[10px] font-mono text-zinc-400 mt-0.5">
                                {c.registration_ip}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-xs">
                        <div className="font-semibold text-zinc-900 tabular-nums">
                          {formatDateTimeTr(c.created_at)}
                        </div>
                        <div className="text-[11px] text-zinc-500 mt-0.5">
                          Son aktif:{" "}
                          <span className="font-semibold text-zinc-700">
                            {c.is_online
                              ? "Şu an çevrimiçi"
                              : formatRelativeTimeTr(c.last_active_at || c.last_login_at)}
                          </span>
                        </div>
                        <div className="text-[10px] text-zinc-400 uppercase mt-0.5">
                          Dil: {c.preferred_lang || "TR"} • {c.preferred_currency || "TRY"}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-xs">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-semibold tabular-nums ${
                              c.orders_count > 0
                                ? "bg-indigo-50 text-indigo-800 border border-indigo-200/70"
                                : "bg-zinc-100 text-zinc-600"
                            }`}
                          >
                            <ShoppingBag className="w-3 h-3" />
                            {c.orders_count} sip.
                          </span>
                          {c.cart_items_count > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-semibold bg-amber-50 text-amber-800 border border-amber-200/70 tabular-nums">
                              <ShoppingCart className="w-3 h-3" />
                              {c.cart_items_count}
                            </span>
                          )}
                        </div>
                        {c.orders_total_amount > 0 && (
                          <div className="text-[11px] font-bold text-zinc-800 mt-1 tabular-nums">
                            {formatCurrencyTry(c.orders_total_amount)}
                          </div>
                        )}
                        <div className="text-[11px] text-zinc-500 mt-0.5 tabular-nums">
                          {c.products_viewed} ürün • {c.pages_read} sayfa
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex flex-col items-start gap-1">
                          {c.is_blocked ? (
                            <span
                              title={c.block_reason || "Blokeli"}
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800"
                            >
                              <ShieldAlert className="w-3 h-3" /> Blokeli
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                              <UserCheck className="w-3 h-3" /> Aktif
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-500">
                            {c.email_verified ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> E-posta onaylı
                              </>
                            ) : (
                              "E-posta onaysız"
                            )}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-5 text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setJourneyCustomer(c)}
                            title="Müşteri Yolculuğu"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-semibold transition-colors cursor-pointer"
                          >
                            <Activity className="w-3.5 h-3.5" />
                            <span className="hidden xl:inline">Yolculuk</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedCustomer(c)}
                            title="Müşteri Detayı"
                            className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-colors cursor-pointer"
                          >
                            <Info className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openBlockDialogOrUnblock(c)}
                            disabled={blockingId === c.id}
                            title={c.is_blocked ? "Engeli Kaldır" : "Hesabı Blokla"}
                            className={`p-2 rounded-xl transition-colors cursor-pointer disabled:opacity-50 ${
                              c.is_blocked
                                ? "text-emerald-600 hover:bg-emerald-50"
                                : "text-amber-600 hover:bg-amber-50"
                            }`}
                          >
                            {blockingId === c.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : c.is_blocked ? (
                              <UserCheck className="w-4 h-4" />
                            ) : (
                              <Ban className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(c)}
                            title="Müşteriyi Kalıcı Sil"
                            className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CustomerDetailModal
        customer={selectedCustomer}
        onClose={() => setSelectedCustomer(null)}
        onOpenJourney={(c) => {
          setSelectedCustomer(null);
          setJourneyCustomer(c);
        }}
        onToggleBlock={openBlockDialogOrUnblock}
        onRequestDelete={(c) => {
          setSelectedCustomer(null);
          setDeleteTarget(c);
        }}
      />

      {blockTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-zinc-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-zinc-900">Müşteri Hesabını Blokla</h3>
              <button
                type="button"
                onClick={() => setBlockTarget(null)}
                className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-zinc-600">
                <strong className="text-zinc-900">
                  {blockTarget.first_name} {blockTarget.last_name}
                </strong>{" "}
                ({blockTarget.email}) kullanıcısının giriş yetkisi engellenecektir.
              </p>
              <div>
                <label
                  htmlFor="customer-block-reason"
                  className="block text-xs font-semibold text-zinc-700 mb-1.5"
                >
                  Bloklama Sebebi (Opsiyonel)
                </label>
                <textarea
                  id="customer-block-reason"
                  rows={3}
                  value={blockReasonInput}
                  onChange={(e) => setBlockReasonInput(e.target.value)}
                  placeholder="Örn: Şüpheli işlem veya ödeme ihlali"
                  className="w-full px-3.5 py-2.5 text-xs border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                />
              </div>
            </div>
            <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-100 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setBlockTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-zinc-700 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-100 cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={blockingId === blockTarget.id}
                onClick={() => void executeToggleBlock(blockTarget, true, blockReasonInput.trim())}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl disabled:opacity-50 cursor-pointer"
              >
                {blockingId === blockTarget.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Hesabı Blokla
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-zinc-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-rose-700 flex items-center gap-2">
                <Trash2 className="w-4 h-4" /> Kalıcı Hesap Silme
              </h3>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 text-xs text-zinc-600 leading-relaxed">
              <strong className="text-zinc-900">
                {deleteTarget.first_name} {deleteTarget.last_name}
              </strong>{" "}
              ({deleteTarget.email}) müşterisi hem veritabanından hem Keycloak kimlik sisteminden kalıcı olarak silinecektir. Bu işlem geri alınamaz.
            </div>
            <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-100 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-zinc-700 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-100 cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={deletingId === deleteTarget.id}
                onClick={() => void executeDeleteCustomer()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl disabled:opacity-50 cursor-pointer"
              >
                {deletingId === deleteTarget.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Evet, Kalıcı Olarak Sil
              </button>
            </div>
          </div>
        </div>
      )}

      {journeyCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl border border-zinc-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/70">
              <div>
                <h2 className="text-base font-bold text-zinc-900">
                  Müşteri Yolculuğu — {journeyCustomer.first_name} {journeyCustomer.last_name}
                </h2>
                <p className="text-xs text-zinc-500">{journeyCustomer.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setJourneyCustomer(null)}
                aria-label="Müşteri yolculuğunu kapat"
                className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/70 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 sm:p-6 overflow-y-auto flex-1">
              <CustomerJourneyPanel
                customerId={journeyCustomer.id}
                apiUrl={apiUrl}
                token={token}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
