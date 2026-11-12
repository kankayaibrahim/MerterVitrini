"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { User, ShieldAlert, ShieldCheck, Search, Loader2, RefreshCw, Info, X, Trash2, Compass } from "lucide-react";
import CustomerJourneyPanel from "./CustomerJourneyPanel";

interface CustomersManagerProps {
  readonly apiUrl: string;
  readonly token: string | null;
}

interface LoginHistoryRecord {
  readonly login_at: string;
  readonly ip_address: string;
}

interface Customer {
  readonly id: string;
  readonly first_name: string;
  readonly last_name: string;
  readonly email: string;
  readonly phone: string;
  readonly role: string;
  readonly is_active: boolean;
  readonly is_blocked: boolean;
  readonly block_reason: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly registration_ip?: string | null;
  readonly billing_address?: string | null;
  readonly delivery_address?: string | null;
  readonly tax_no_tckn?: string | null;
  readonly instagram_username?: string | null;
  readonly preferred_lang?: string | null;
  readonly preferred_currency?: string | null;
  readonly last_login_at?: string | null;
  readonly login_history?: readonly LoginHistoryRecord[] | null;
}

const LABELS = {
  TITLE: "Müşteri Listesi & Yönetimi",
  SUBTITLE: "Storefront üzerinden kayıt olan ve Keycloak OIDC altyapısı ile kimlik doğrulayan tüm aktif/engellenmiş son kullanıcı listesi.",
  REFRESH: "Tazele",
  SEARCH_PLACEHOLDER: "İsim, e-posta veya telefon ile ara...",
  SEARCH_BTN: "Ara",
  LOADING: "Müşteri verileri yükleniyor...",
  EMPTY: "Kayıtlı herhangi bir müşteri bulunamadı.",
  TH_CUSTOMER: "Müşteri",
  TH_EMAIL: "E-Posta",
  TH_PHONE: "Telefon",
  TH_CREATED: "Kayıt Tarihi",
  TH_STATUS: "Durum",
  TH_ACTIONS: "İşlemler",
  STATUS_BLOCKED: "Engellenmiş",
  STATUS_ACTIVE: "Aktif",
  UNBLOCK: "Engeli Kaldır",
  BLOCK: "Engelle",
  BLOCK_TITLE: "Müşteriyi Engelle",
  BLOCK_DESC_PRE: "isimli müşterinin sisteme erişimini engellemek üzeresiniz. Bu işlem sonrasında müşteri mağazaya giriş yapamayacaktır.",
  BLOCK_REASON: "Engelleme Gerekçesi",
  CANCEL: "Vazgeç",
  CONFIRM_BLOCK: "Onayla ve Engelle",
  BLOCKING: "Engelleniyor...",
  ID_LABEL: "ID: ",
  REASON_LABEL: "Neden: ",
  ERROR_PREFIX: "⚠️ Hata: ",
  BLOCK_PLACEHOLDER: "Örn: B2B kurallarına aykırı davranış...",
  DELETE_TITLE: "Müşteriyi Sil",
  DELETE_DESC: "isimli müşteriyi kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz, müşterinin Keycloak hesabı ve veri tabanındaki kaydı silinecektir.",
  DELETE_BTN: "Sil",
  DELETING: "Siliniyor...",
};

interface CustomersTableProps {
  readonly loading: boolean;
  readonly error: string | null;
  readonly customers: readonly Customer[];
  readonly updating: boolean;
  readonly onOpenJourney: (customer: Customer) => void;
  readonly onOpenDetails: (customer: Customer) => void;
  readonly onToggleBlock: (customer: Customer) => void;
  readonly onOpenDelete: (customer: Customer) => void;
}

function CustomersTable({
  loading,
  error,
  customers,
  updating,
  onOpenJourney,
  onOpenDetails,
  onToggleBlock,
  onOpenDelete,
}: Readonly<CustomersTableProps>) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 size={32} className="text-violet-600 animate-spin" />
        <span className="text-xs font-bold text-zinc-400">{LABELS.LOADING}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-20 text-center text-xs font-bold text-rose-500">
        {`${LABELS.ERROR_PREFIX}${error}`}
      </div>
    );
  }

  if (customers.length === 0) {
    return (
      <div className="py-20 text-center text-xs font-bold text-zinc-400">
        {LABELS.EMPTY}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-zinc-100 bg-zinc-50/30">
            <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">{LABELS.TH_CUSTOMER}</th>
            <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">{LABELS.TH_EMAIL}</th>
            <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">{LABELS.TH_PHONE}</th>
            <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">{LABELS.TH_CREATED}</th>
            <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">{LABELS.TH_STATUS}</th>
            <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">{LABELS.TH_ACTIONS}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {customers.map((c) => (
            <tr key={c.id} className="hover:bg-zinc-50/30 transition-colors">
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-violet-50 border border-violet-100 text-violet-600 flex items-center justify-center font-bold text-xs">
                    {c.first_name[0]}{c.last_name[0]}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-zinc-900 block">
                      {`${c.first_name} ${c.last_name}`}
                    </span>
                    <span className="text-[9px] font-semibold text-zinc-400 block tracking-wider uppercase">
                      {`${LABELS.ID_LABEL}${c.id.substring(0, 8)}...`}
                    </span>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 text-xs font-semibold text-zinc-600">{c.email}</td>
              <td className="px-6 py-4 text-xs font-semibold text-zinc-600">{c.phone || "-"}</td>
              <td className="px-6 py-4 text-xs font-semibold text-zinc-500">
                {new Date(c.created_at).toLocaleString("tr-TR")}
              </td>
              <td className="px-6 py-4">
                {c.is_blocked ? (
                  <div className="inline-flex flex-col gap-1">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 border border-rose-200 text-rose-700">
                      {LABELS.STATUS_BLOCKED}
                    </span>
                    {c.block_reason && (
                      <span className="text-[9px] font-medium text-rose-500 max-w-[150px] truncate" title={c.block_reason}>
                        {LABELS.REASON_LABEL}{c.block_reason}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-700">
                    {LABELS.STATUS_ACTIVE}
                  </span>
                )}
              </td>
              <td className="px-6 py-4 text-right">
                <div className="flex justify-end items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenJourney(c)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
                  >
                    <Compass size={14} />
                    Yolculuk & Tarihçe
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenDetails(c)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
                  >
                    <Info size={14} />
                    Detaylar
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleBlock(c)}
                    disabled={updating}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer active:scale-[0.98] ${
                      c.is_blocked
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/10"
                        : "bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 shadow-rose-500/5"
                    }`}
                  >
                    {c.is_blocked ? (
                      <>
                        <ShieldCheck size={14} />
                        {LABELS.UNBLOCK}
                      </>
                    ) : (
                      <>
                        <ShieldAlert size={14} />
                        {LABELS.BLOCK}
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenDelete(c)}
                    disabled={updating}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer active:scale-[0.98]"
                  >
                    <Trash2 size={14} />
                    {LABELS.DELETE_BTN}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CustomersManager({ apiUrl, token }: Readonly<CustomersManagerProps>) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Block modal state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [blockReason, setBlockReason] = useState("");
  const [updating, setUpdating] = useState(false);

  // Detailed customer modal state
  const [detailedCustomer, setDetailedCustomer] = useState<Customer | null>(null);

  // Journey map & timeline modal state
  const [journeyCustomer, setJourneyCustomer] = useState<Customer | null>(null);

  // Delete modal state
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);

  const fetchCustomers = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);

    try {
      const queryParam = searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : "";
      const response = await fetch(`${apiUrl}/api/v1/customers${queryParam}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error("Müşteri listesi yüklenemedi.");
      }

      const data = await response.json();
      setCustomers(data);
      setError(null);
    } catch (err: unknown) {
      setError((err as Error).message || "Bir hata oluştu.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [apiUrl, token, searchQuery]);

  useEffect(() => {
    let isMounted = true;

    if (!token) return;

    const loadInitialData = async () => {
      try {
        const queryParam = searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : "";
        const response = await fetch(`${apiUrl}/api/v1/customers${queryParam}`, {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error("Müşteri listesi yüklenemedi.");
        }

        const data = await response.json();
        if (isMounted) {
          setCustomers(data);
          setError(null);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError((err as Error).message || "Bir hata oluştu.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadInitialData();

    return () => {
      isMounted = false;
    };
  }, [apiUrl, token, searchQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void fetchCustomers();
  };

  const handleToggleBlock = async (customer: Customer) => {
    if (customer.is_blocked) {
      // Unblock directly
      setUpdating(true);
      try {
        const response = await fetch(`${apiUrl}/api/v1/customers/${customer.id}/block`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            is_blocked: false,
            block_reason: ""
          })
        });

        if (!response.ok) throw new Error("Engelleme kaldırılamadı.");
        
        void fetchCustomers();
      } catch (err: unknown) {
        alert((err as Error).message);
      } finally {
        setUpdating(false);
      }
    } else {
      // Open block reason modal
      setSelectedCustomer(customer);
      setBlockReason("");
    }
  };

  const submitBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    setUpdating(true);
    try {
      const response = await fetch(`${apiUrl}/api/v1/customers/${selectedCustomer.id}/block`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          is_blocked: true,
          block_reason: blockReason
        })
      });

      if (!response.ok) throw new Error("Müşteri engellenemedi.");

      setSelectedCustomer(null);
      void fetchCustomers();
    } catch (err: unknown) {
      alert((err as Error).message);
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!deletingCustomer) return;

    setUpdating(true);
    try {
      const response = await fetch(`${apiUrl}/api/v1/customers/${deletingCustomer.id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Müşteri silinemedi.");
      }

      setDeletingCustomer(null);
      void fetchCustomers();
    } catch (err: unknown) {
      alert((err as Error).message || "Bir hata oluştu.");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      
      {/* Header Cards & Title */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white p-6 rounded-2xl border border-zinc-200/80 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-zinc-950 flex items-center gap-2">
            <User className="text-violet-600" size={22} />
            {LABELS.TITLE}
          </h1>
          <p className="text-xs text-zinc-500 font-semibold mt-1">
            {LABELS.SUBTITLE}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/member-journeys"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-xs font-bold text-white rounded-xl transition-all shadow-sm"
          >
            <Compass size={14} />
            Üye Yolculuk Haritası Merkezi
          </Link>
          <button
            onClick={() => void fetchCustomers(true)}
            disabled={loading || refreshing}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-zinc-200 hover:bg-zinc-50 text-xs font-bold text-zinc-700 rounded-xl transition-all cursor-pointer bg-white"
            type="button"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            {LABELS.REFRESH}
          </button>
        </div>
      </div>

      {/* Filter and Table Card */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden">
        
        {/* Search Bar */}
        <div className="p-4 border-b border-zinc-100 bg-zinc-50/50">
          <form onSubmit={handleSearchSubmit} className="flex gap-2 max-w-md">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-400">
                <Search size={16} />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={LABELS.SEARCH_PLACEHOLDER}
                className="w-full pl-9 pr-4 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              {LABELS.SEARCH_BTN}
            </button>
          </form>
        </div>

        {/* Content Area */}
        <CustomersTable
          loading={loading}
          error={error}
          customers={customers}
          updating={updating}
          onOpenJourney={(c) => setJourneyCustomer(c)}
          onOpenDetails={(c) => setDetailedCustomer(c)}
          onToggleBlock={handleToggleBlock}
          onOpenDelete={(c) => setDeletingCustomer(c)}
        />
      </div>

      {/* Block Reason Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button 
            type="button"
            aria-label={LABELS.CANCEL}
            tabIndex={-1}
            className="fixed inset-0 bg-zinc-950/40 backdrop-blur-sm transition-opacity duration-300 border-none cursor-default"
            onClick={() => setSelectedCustomer(null)}
          />
          <div className="relative w-full max-w-md bg-white border border-zinc-200 rounded-2xl shadow-xl overflow-hidden z-10 p-6 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-base font-bold text-zinc-950 flex items-center gap-2 mb-2">
              <ShieldAlert className="text-rose-600" size={18} />
              {LABELS.BLOCK_TITLE}
            </h3>
            <p className="text-xs text-zinc-500 font-semibold mb-4 leading-relaxed">
              <strong className="text-zinc-800">{`${selectedCustomer.first_name} ${selectedCustomer.last_name}`}</strong> {LABELS.BLOCK_DESC_PRE}
            </p>
            <form onSubmit={submitBlock} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="block-reason-textarea" className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  {LABELS.BLOCK_REASON}
                </label>
                <textarea
                  id="block-reason-textarea"
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  rows={3}
                  className="px-4 py-2.5 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 leading-relaxed"
                  placeholder={LABELS.BLOCK_PLACEHOLDER}
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedCustomer(null)}
                  className="px-4 py-2 border border-zinc-200 hover:bg-zinc-50 text-xs font-bold text-zinc-700 rounded-xl transition-all cursor-pointer bg-white"
                >
                  {LABELS.CANCEL}
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-500/10 hover:shadow-rose-500/20 transition-all cursor-pointer"
                >
                  {updating ? LABELS.BLOCKING : LABELS.CONFIRM_BLOCK}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button 
            type="button"
            aria-label={LABELS.CANCEL}
            tabIndex={-1}
            className="fixed inset-0 bg-zinc-950/40 backdrop-blur-sm transition-opacity duration-300 border-none cursor-default"
            onClick={() => setDeletingCustomer(null)}
          />
          <div className="relative w-full max-w-md bg-white border border-zinc-200 rounded-2xl shadow-xl overflow-hidden z-10 p-6 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-base font-bold text-zinc-950 flex items-center gap-2 mb-2">
              <Trash2 className="text-rose-600" size={18} />
              {LABELS.DELETE_TITLE}
            </h3>
            <p className="text-xs text-zinc-500 font-semibold mb-6 leading-relaxed">
              <strong className="text-zinc-800">{`${deletingCustomer.first_name} ${deletingCustomer.last_name}`}</strong> {LABELS.DELETE_DESC}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingCustomer(null)}
                className="px-4 py-2 border border-zinc-200 hover:bg-zinc-50 text-xs font-bold text-zinc-700 rounded-xl transition-all cursor-pointer bg-white"
              >
                {LABELS.CANCEL}
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteCustomer()}
                disabled={updating}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-500/10 hover:shadow-rose-500/20 transition-all cursor-pointer active:scale-[0.98]"
              >
                {updating ? LABELS.DELETING : LABELS.DELETE_BTN}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Details Modal */}
      {detailedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button 
            type="button"
            aria-label="Kapat"
            tabIndex={-1}
            className="fixed inset-0 bg-zinc-950/40 backdrop-blur-sm transition-opacity duration-300 border-none cursor-default"
            onClick={() => setDetailedCustomer(null)}
          />
          <div className="relative w-full max-w-2xl bg-white border border-zinc-200 rounded-2xl shadow-xl overflow-hidden z-10 p-6 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-zinc-100 pb-4 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-violet-100 border border-violet-200 text-violet-700 flex items-center justify-center font-bold text-sm">
                  {detailedCustomer.first_name?.[0] || ""}{detailedCustomer.last_name?.[0] || ""}
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-950">
                    {`${detailedCustomer.first_name} ${detailedCustomer.last_name}`}
                  </h3>
                  <span className="text-[10px] font-semibold text-zinc-400 block tracking-wider uppercase">
                    Kullanıcı ID: {detailedCustomer.id}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailedCustomer(null)}
                className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              {/* Left Column: Personal and System Info */}
              <div className="space-y-4">
                <div className="bg-zinc-50/50 p-4 rounded-xl border border-zinc-100 space-y-3">
                  <h4 className="font-bold text-zinc-800 uppercase tracking-wider text-[10px] border-b border-zinc-200/60 pb-1">
                    Kişisel Bilgiler
                  </h4>
                  <div className="grid grid-cols-3 gap-1">
                    <span className="text-zinc-400 font-semibold">E-Posta:</span>
                    <span className="col-span-2 text-zinc-700 font-bold break-all">{detailedCustomer.email}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <span className="text-zinc-400 font-semibold">Telefon:</span>
                    <span className="col-span-2 text-zinc-700 font-bold">{detailedCustomer.phone || "-"}</span>
                  </div>
                </div>

                <div className="bg-zinc-50/50 p-4 rounded-xl border border-zinc-100 space-y-3">
                  <h4 className="font-bold text-zinc-800 uppercase tracking-wider text-[10px] border-b border-zinc-200/60 pb-1">
                    Sistem Bilgileri
                  </h4>
                  <div className="grid grid-cols-3 gap-1">
                    <span className="text-zinc-400 font-semibold">Kayıt Tarihi:</span>
                    <span className="col-span-2 text-zinc-700 font-bold">
                      {new Date(detailedCustomer.created_at).toLocaleString("tr-TR")}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <span className="text-zinc-400 font-semibold">Kayıt IP:</span>
                    <span className="col-span-2 text-zinc-700 font-bold">
                      {detailedCustomer.registration_ip || "Bilinmiyor"}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <span className="text-zinc-400 font-semibold">Tercih Edilen Dil:</span>
                    <span className="col-span-2 text-zinc-700 font-bold uppercase">
                      {detailedCustomer.preferred_lang || "-"}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <span className="text-zinc-400 font-semibold">Para Birimi:</span>
                    <span className="col-span-2 text-zinc-700 font-bold">
                      {detailedCustomer.preferred_currency || "-"}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <span className="text-zinc-400 font-semibold">Son Oturum:</span>
                    <span className="col-span-2 text-zinc-700 font-bold text-violet-700">
                      {detailedCustomer.last_login_at 
                        ? new Date(detailedCustomer.last_login_at).toLocaleString("tr-TR") 
                        : "Hiç oturum açılmadı"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: Address and Extra Info */}
              <div className="space-y-4">
                <div className="bg-zinc-50/50 p-4 rounded-xl border border-zinc-100 space-y-3">
                  <h4 className="font-bold text-zinc-800 uppercase tracking-wider text-[10px] border-b border-zinc-200/60 pb-1">
                    Adres Tanımları
                  </h4>
                  <div className="space-y-2">
                    <div>
                      <span className="text-zinc-400 font-semibold block mb-1">Fatura Adresi:</span>
                      <p className="text-zinc-700 font-bold bg-white p-2.5 rounded-lg border border-zinc-200/60 whitespace-pre-wrap min-h-[50px]">
                        {detailedCustomer.billing_address || "Tanımlanmamış"}
                      </p>
                    </div>
                    <div>
                      <span className="text-zinc-400 font-semibold block mb-1">Teslimat Adresi:</span>
                      <p className="text-zinc-700 font-bold bg-white p-2.5 rounded-lg border border-zinc-200/60 whitespace-pre-wrap min-h-[50px]">
                        {detailedCustomer.delivery_address || "Tanımlanmamış"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-50/50 p-4 rounded-xl border border-zinc-100 space-y-3">
                  <h4 className="font-bold text-zinc-800 uppercase tracking-wider text-[10px] border-b border-zinc-200/60 pb-1">
                    Diğer Bilgiler
                  </h4>
                  <div className="grid grid-cols-3 gap-1">
                    <span className="text-zinc-400 font-semibold">Vergi No / TCKN:</span>
                    <span className="col-span-2 text-zinc-700 font-bold">
                      {detailedCustomer.tax_no_tckn || "-"}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <span className="text-zinc-400 font-semibold">Instagram:</span>
                    <span className="col-span-2 text-zinc-700 font-bold">
                      {detailedCustomer.instagram_username ? `@${detailedCustomer.instagram_username}` : "-"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Login History Section (Full Width) */}
            <div className="mt-6 bg-zinc-50/50 p-4 rounded-xl border border-zinc-100 space-y-3 text-xs">
              <h4 className="font-bold text-zinc-800 uppercase tracking-wider text-[10px] border-b border-zinc-200/60 pb-1">
                Oturum Açma Geçmişi (Logins History)
              </h4>
              {detailedCustomer.login_history && detailedCustomer.login_history.length > 0 ? (
                <div className="max-h-[160px] overflow-y-auto border border-zinc-200/60 rounded-lg bg-white">
                  <table className="w-full text-[11px] text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-200/60 text-zinc-500 font-bold uppercase tracking-wider">
                        <th className="px-4 py-2 font-bold">Tarih / Saat</th>
                        <th className="px-4 py-2 font-bold">IP Adresi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 text-zinc-700">
                      {detailedCustomer.login_history.map((lh) => (
                        <tr key={`${lh.login_at}-${lh.ip_address}`} className="hover:bg-zinc-50/40">
                          <td className="px-4 py-2 font-semibold">
                            {new Date(lh.login_at).toLocaleString("tr-TR")}
                          </td>
                          <td className="px-4 py-2 font-bold">{lh.ip_address}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-[11px] font-semibold text-zinc-400 py-2 text-center">
                  Oturum açma geçmişi bulunmuyor.
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-zinc-100 mt-6">
              <button
                type="button"
                onClick={() => setDetailedCustomer(null)}
                className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-[0.98]"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Journey Map & Activity Timeline Modal */}
      {journeyCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
          <button
            type="button"
            aria-label="Kapat"
            tabIndex={-1}
            className="fixed inset-0 bg-zinc-950/50 backdrop-blur-sm border-none cursor-default"
            onClick={() => setJourneyCustomer(null)}
          />
          <div className="relative w-full max-w-6xl bg-slate-50 border border-zinc-200 rounded-3xl shadow-2xl overflow-hidden z-10 max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-zinc-200 shrink-0">
              <div className="flex items-center gap-2.5">
                <Compass size={18} className="text-violet-600" />
                <span className="text-sm font-extrabold text-zinc-950">
                  {journeyCustomer.first_name} {journeyCustomer.last_name} — Üye Yolculuk Haritası & Tarihçesi
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/admin/member-journeys?customer_id=${encodeURIComponent(journeyCustomer.id)}`}
                  className="px-3 py-1.5 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-bold transition-colors"
                >
                  Tam Ekran Aç
                </Link>
                <button
                  type="button"
                  onClick={() => setJourneyCustomer(null)}
                  className="p-1.5 rounded-xl hover:bg-zinc-100 text-zinc-500 hover:text-zinc-800 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-1">
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
