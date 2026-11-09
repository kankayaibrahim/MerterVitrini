"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  FileText,
  CheckCircle2,
  XCircle,
  Trash2,
  RefreshCw,
  Globe,
  Phone,
} from "lucide-react";
import { useAdminAuth } from "@/context/AdminContext";

interface AdminBuyerRfqItem {
  id: string;
  rfq_number: string;
  title: string;
  category_name: string;
  target_quantity: number;
  unit_type: string;
  production_type: string;
  description: string;
  buyer_name: string;
  buyer_company: string;
  buyer_country: string;
  buyer_phone: string;
  buyer_email: string;
  status: string;
  offer_count: number;
  created_at: string;
}

export default function AdminRfqModerationPage() {
  const { fetchWithConfig } = useAdminAuth();
  const [items, setItems] = useState<AdminBuyerRfqItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>("");

  const loadAdminRfqs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithConfig(
        `/api/v1/admin/rfqs?status=${encodeURIComponent(statusFilter)}`
      );
      if (res.ok) {
        const data = (await res.json()) as AdminBuyerRfqItem[];
        setItems(data || []);
      }
    } catch {
      // Ignore transient errors
    } finally {
      setLoading(false);
    }
  }, [fetchWithConfig, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadAdminRfqs();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadAdminRfqs]);

  const handleUpdateStatus = async (id: string, status: string) => {
    await fetchWithConfig(`/api/v1/admin/rfqs/${id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    void loadAdminRfqs();
  };

  const handleDelete = async (id: string) => {
    await fetchWithConfig(`/api/v1/admin/rfqs/${id}`, {
      method: "DELETE",
    });
    void loadAdminRfqs();
  };

  return (
    <div className="max-w-6xl mx-auto w-full space-y-6">
      <div className="bg-white dark:bg-zinc-950 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
            <FileText size={20} />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-zinc-900 dark:text-white">
              Alıcı Talep Panosu (B2B Alım İlanları / RFQ) Yönetimi
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              Alıcıların oluşturduğu toptan alım ve üretim ilanlarını inceleyin, onaylayın veya kaldırın.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-bold bg-white dark:bg-zinc-900"
          >
            <option value="">Tüm Durumlar</option>
            <option value="APPROVED">Yayında (APPROVED)</option>
            <option value="PENDING">Onay Bekleyen (PENDING)</option>
            <option value="CLOSED">Kapandı (CLOSED)</option>
            <option value="REJECTED">Reddedildi (REJECTED)</option>
          </select>
          <button
            type="button"
            onClick={() => void loadAdminRfqs()}
            className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 cursor-pointer"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="bg-white dark:bg-zinc-950 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="px-2 py-0.5 rounded bg-zinc-900 text-white font-mono font-bold">
                  {item.rfq_number}
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold">
                  {item.status}
                </span>
                <span className="font-bold text-zinc-600">
                  {item.target_quantity} {item.unit_type} • {item.offer_count} Teklif
                </span>
              </div>
              <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white">
                {item.title}
              </h3>
              <p className="text-xs text-zinc-500">{item.description}</p>
              <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-600 pt-1">
                <span>
                  Alıcı: <strong>{item.buyer_name}</strong> ({item.buyer_company || "-"})
                </span>
                <span className="inline-flex items-center gap-1">
                  <Globe size={12} /> {item.buyer_country}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Phone size={12} /> {item.buyer_phone}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => void handleUpdateStatus(item.id, "APPROVED")}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold cursor-pointer"
              >
                <CheckCircle2 size={13} />
                <span>Onayla</span>
              </button>
              <button
                type="button"
                onClick={() => void handleUpdateStatus(item.id, "CLOSED")}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-200 text-zinc-800 text-xs font-bold cursor-pointer"
              >
                <XCircle size={13} />
                <span>Kapat</span>
              </button>
              <button
                type="button"
                onClick={() => void handleDelete(item.id)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold cursor-pointer"
              >
                <Trash2 size={13} />
                <span>Sil</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

