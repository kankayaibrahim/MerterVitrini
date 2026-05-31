"use client";

import React, { useState, useEffect } from "react";
import { User, ShieldAlert, ShieldCheck, Search, Loader2, RefreshCw } from "lucide-react";

interface CustomersManagerProps {
  apiUrl: string;
  token: string | null;
}

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: string;
  is_active: boolean;
  is_blocked: boolean;
  block_reason: string | null;
  created_at: string;
  updated_at: string;
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
  BLOCK_PLACEHOLDER: "Örn: B2B kurallarına aykırı davranış..."
};

export default function CustomersManager({ apiUrl, token }: CustomersManagerProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Block modal state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [blockReason, setBlockReason] = useState("");
  const [updating, setUpdating] = useState(false);

  const fetchCustomers = async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    setError(null);

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
    } catch (err: any) {
      setError(err.message || "Bir hata oluştu.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchCustomers();
    }
  }, [token]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCustomers();
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
        
        fetchCustomers();
      } catch (err: any) {
        alert(err.message);
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
      fetchCustomers();
    } catch (err: any) {
      alert(err.message);
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
        <button
          onClick={() => fetchCustomers(true)}
          disabled={loading || refreshing}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-zinc-200 hover:bg-zinc-50 text-xs font-bold text-zinc-700 rounded-xl transition-all cursor-pointer bg-white"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          {LABELS.REFRESH}
        </button>
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
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 size={32} className="text-violet-600 animate-spin" />
            <span className="text-xs font-bold text-zinc-400">{LABELS.LOADING}</span>
          </div>
        ) : error ? (
          <div className="py-20 text-center text-xs font-bold text-rose-500">
            {`${LABELS.ERROR_PREFIX}${error}`}
          </div>
        ) : customers.length === 0 ? (
          <div className="py-20 text-center text-xs font-bold text-zinc-400">
            {LABELS.EMPTY}
          </div>
        ) : (
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
                      <button
                        onClick={() => handleToggleBlock(c)}
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Block Reason Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-zinc-950/40 backdrop-blur-sm transition-opacity duration-300"
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
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  {LABELS.BLOCK_REASON}
                </label>
                <textarea
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

    </div>
  );
}
