"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Truck,
  ShieldCheck,
  Sparkles,
  Trash2,
  RefreshCw,
  MessageCircle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useAdminAuth } from "@/context/AdminContext";

interface AdminServiceProvider {
  id: string;
  slug: string;
  company_name: string;
  service_category: string;
  short_description: string;
  services_offered: string;
  target_countries: string;
  address: string;
  phone: string;
  whatsapp_phone: string;
  is_verified: boolean;
  is_sponsored: boolean;
  is_active: boolean;
  whatsapp_click_count: number;
  created_at: string;
}

const CATEGORY_NAMES: Record<string, string> = {
  kargo_lojistik: "Kargo & Lojistik",
  fotograf_studyo: "Fotoğraf & Prodüksiyon Stüdyosu",
  ambalaj_etiket: "Ambalaj & Dokuma Etiket",
  modelist_kalip: "Modelhane, Kalıp & Numune",
  ihracat_danismanlik: "Gümrük & İhracat Danışmanlığı",
};

export default function AdminServiceProvidersPage() {
  const { fetchWithConfig } = useAdminAuth();
  const [items, setItems] = useState<AdminServiceProvider[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithConfig("/api/v1/admin/service-providers");
      if (res.ok) {
        const data = (await res.json()) as AdminServiceProvider[];
        setItems(data || []);
      }
    } catch {
      // Ignore transient errors
    } finally {
      setLoading(false);
    }
  }, [fetchWithConfig]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadItems();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadItems]);

  const handleUpdateFlags = async (
    id: string,
    patch: { is_active?: boolean; is_verified?: boolean; is_sponsored?: boolean }
  ) => {
    await fetchWithConfig(`/api/v1/admin/service-providers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    void loadItems();
  };

  const handleDelete = async (id: string) => {
    await fetchWithConfig(`/api/v1/admin/service-providers/${id}`, {
      method: "DELETE",
    });
    void loadItems();
  };

  return (
    <div className="max-w-6xl mx-auto w-full space-y-6">
      <div className="bg-white dark:bg-zinc-950 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center shrink-0">
            <Truck size={20} />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-zinc-900 dark:text-white">
              Sektörel Hizmet Sağlayıcılar Rehberi Yönetimi
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              Kargo/Lojistik, Fotoğraf Stüdyosu, Ambalaj/Etiket, Modelhane ve İhracat Danışmanı çözüm ortaklarını yönetin.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void loadItems()}
          className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 cursor-pointer bg-white dark:bg-zinc-900"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="space-y-3">
        {items.map((item) => {
          const catLabel =
            CATEGORY_NAMES[item.service_category] || item.service_category;
          const activeBadgeCls = item.is_active
            ? "bg-emerald-50 text-emerald-700"
            : "bg-zinc-100 text-zinc-600";

          return (
            <div
              key={item.id}
              className="bg-white dark:bg-zinc-950 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="px-2 py-0.5 rounded bg-sky-500/15 text-sky-700 font-bold">
                    {catLabel}
                  </span>
                  <span className={`px-2 py-0.5 rounded font-bold ${activeBadgeCls}`}>
                    {item.is_active ? "YAYINDA" : "GİZLİ"}
                  </span>
                  {item.is_verified && (
                    <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 font-bold inline-flex items-center gap-1">
                      <ShieldCheck size={12} /> Doğrulanmış
                    </span>
                  )}
                  {item.is_sponsored && (
                    <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-700 font-bold inline-flex items-center gap-1">
                      <Sparkles size={12} /> Sponsorlu
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 font-bold text-zinc-600">
                    <MessageCircle size={12} className="text-emerald-600" />
                    {item.whatsapp_click_count} WhatsApp Tıklama
                  </span>
                </div>

                <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white">
                  {item.company_name}
                </h3>
                <p className="text-xs text-zinc-500">{item.short_description}</p>
                <p className="text-xs text-zinc-600">
                  Tel: <strong>{item.phone}</strong> • Bölgeler:{" "}
                  {item.target_countries || "-"}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    void handleUpdateFlags(item.id, {
                      is_verified: !item.is_verified,
                    })
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold cursor-pointer border-none"
                >
                  <ShieldCheck size={13} />
                  <span>{item.is_verified ? "Doğrulamayı Kaldır" : "Doğrula"}</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void handleUpdateFlags(item.id, {
                      is_sponsored: !item.is_sponsored,
                    })
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold cursor-pointer border-none"
                >
                  <Sparkles size={13} />
                  <span>{item.is_sponsored ? "Sponsorluğu Kaldır" : "Sponsorlu Yap"}</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void handleUpdateFlags(item.id, {
                      is_active: !item.is_active,
                    })
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold cursor-pointer border-none"
                >
                  {item.is_active ? (
                    <>
                      <XCircle size={13} />
                      <span>Gizle</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={13} />
                      <span>Yayınla</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(item.id)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold cursor-pointer border-none"
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

