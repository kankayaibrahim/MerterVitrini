"use client";

import React, { useState } from "react";
import { Plus, Radar, Trash2, X } from "lucide-react";
import type { CookieInventoryItem, CookieScanRunResult } from "./types";

interface CookieInventoryTabProps {
  cookies: CookieInventoryItem[];
  scanning: boolean;
  lastScan: CookieScanRunResult | null;
  onRunScan: () => void;
  onSaveCookie: (payload: Partial<CookieInventoryItem> & { id?: string }) => Promise<void>;
  onDeleteCookie: (id: string) => Promise<void>;
}

const EMPTY_COOKIE: Omit<CookieInventoryItem, "id"> = {
  cookie_name: "",
  category: "measurement",
  provider: "",
  domain: "mertervitrini.com.tr",
  storage_type: "cookie",
  duration: "1 yıl / 1 year",
  is_third_party: true,
  is_active: true,
  source: "manual",
  purpose_translations: { tr: "", en: "" },
};

export default function CookieInventoryTab({
  cookies,
  scanning,
  lastScan,
  onRunScan,
  onSaveCookie,
  onDeleteCookie,
}: CookieInventoryTabProps) {
  const [editing, setEditing] = useState<(Partial<CookieInventoryItem> & { id?: string }) | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      await onSaveCookie(editing);
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
        <div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
            Canlı Çerez, LocalStorage ve 3. Taraf Betik Envanteri
          </h3>
          <p className="text-xs text-zinc-500">
            Buradaki kayıtlar storefront tercih merkezinde kategorilere göre dinamik listelenir ve her rızada dondurularak mühürlenir.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={scanning}
            onClick={onRunScan}
            className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 hover:bg-black text-white px-3.5 py-2 text-xs font-semibold cursor-pointer disabled:opacity-50"
          >
            <Radar className={`w-3.5 h-3.5 ${scanning ? "animate-spin" : ""}`} />
            {scanning ? "Sayfalar Taranıyor..." : "Canlı Çerez Tarayıcıyı Başlat"}
          </button>

          <button
            type="button"
            onClick={() => setEditing({ ...EMPTY_COOKIE })}
            className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-3.5 py-2 text-xs font-semibold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Yeni Çerez / Script Ekle
          </button>
        </div>
      </div>

      {lastScan && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-900 p-4 text-xs text-emerald-900 dark:text-emerald-200">
          <strong>Tarama Tamamlandı:</strong> {lastScan.scanned_urls.length} sayfa tarandı •{" "}
          {lastScan.detected_count} çerez/betik tespit edildi • {lastScan.new_cookies_count} yeni kayıt envantere işlendi.
        </div>
      )}

      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500">
                <th className="py-3 px-3">Çerez / Anahtar</th>
                <th className="py-3 px-3">Kategori</th>
                <th className="py-3 px-3">Sağlayıcı</th>
                <th className="py-3 px-3">Tür & Süre</th>
                <th className="py-3 px-3">TR Amaç</th>
                <th className="py-3 px-3">Kaynak</th>
                <th className="py-3 px-3 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {cookies.map((ck) => (
                <tr key={ck.id} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40">
                  <td className="py-2.5 px-3 font-mono font-bold text-zinc-900 dark:text-white">
                    {ck.cookie_name}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 font-semibold">
                      {ck.category}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">{ck.provider}</td>
                  <td className="py-2.5 px-3">
                    <div>{ck.storage_type}</div>
                    <div className="text-[10px] text-zinc-500">{ck.duration}</div>
                  </td>
                  <td className="py-2.5 px-3 max-w-[260px] truncate" title={ck.purpose_translations?.tr || ck.purpose}>
                    {ck.purpose_translations?.tr || ck.purpose}
                  </td>
                  <td className="py-2.5 px-3 text-[11px]">{ck.source}</td>
                  <td className="py-2.5 px-3 text-right space-x-2 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setEditing(ck)}
                      className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-2.5 py-1 text-[11px] font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                    >
                      Düzenle
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDeleteCookie(ck.id)}
                      className="inline-flex items-center rounded-lg border border-red-200 text-red-700 px-2 py-1 text-[11px] hover:bg-red-50 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
          <form
            onSubmit={handleSave}
            className="w-full max-w-lg rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 shadow-2xl space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">
                {editing.id ? "Çerez Tanımını Düzenle" : "Yeni Çerez / Script Ekle"}
              </h3>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="p-1 text-zinc-500 hover:text-zinc-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <label className="space-y-1">
                <span className="font-semibold">Çerez / Anahtar Adı</span>
                <input
                  required
                  value={editing.cookie_name || ""}
                  onChange={(e) => setEditing({ ...editing, cookie_name: e.target.value })}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 px-3 py-2"
                />
              </label>
              <label className="space-y-1">
                <span className="font-semibold">Kategori</span>
                <select
                  value={editing.category || "measurement"}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      category: e.target.value as CookieInventoryItem["category"],
                    })
                  }
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 px-3 py-2"
                >
                  <option value="necessary">Zorunlu (necessary)</option>
                  <option value="functionality">İşlevsellik (functionality)</option>
                  <option value="experience">Deneyim (experience)</option>
                  <option value="measurement">Analitik (measurement)</option>
                  <option value="marketing">Pazarlama (marketing)</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="font-semibold">Sağlayıcı</span>
                <input
                  required
                  value={editing.provider || ""}
                  onChange={(e) => setEditing({ ...editing, provider: e.target.value })}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 px-3 py-2"
                />
              </label>
              <label className="space-y-1">
                <span className="font-semibold">Alan Adı (Domain)</span>
                <input
                  value={editing.domain || "mertervitrini.com.tr"}
                  onChange={(e) => setEditing({ ...editing, domain: e.target.value })}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 px-3 py-2"
                />
              </label>

              <label className="space-y-1">
                <span className="font-semibold">Depolama Tipi</span>
                <select
                  value={editing.storage_type || "cookie"}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      storage_type: e.target.value as CookieInventoryItem["storage_type"],
                    })
                  }
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 px-3 py-2"
                >
                  <option value="cookie">cookie</option>
                  <option value="localStorage">localStorage</option>
                  <option value="sessionStorage">sessionStorage</option>
                  <option value="script">script</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="font-semibold">Saklama Süresi</span>
                <input
                  value={editing.duration || ""}
                  onChange={(e) => setEditing({ ...editing, duration: e.target.value })}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 px-3 py-2"
                />
              </label>
            </div>

            <div className="space-y-2 text-xs">
              <label className="block space-y-1">
                <span className="font-semibold">Türkçe Kullanım Amacı</span>
                <textarea
                  rows={2}
                  value={editing.purpose_translations?.tr || ""}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      purpose_translations: {
                        ...(editing.purpose_translations || {}),
                        tr: e.target.value,
                      },
                    })
                  }
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 px-3 py-2"
                />
              </label>
              <label className="block space-y-1">
                <span className="font-semibold">İngilizce Kullanım Amacı</span>
                <textarea
                  rows={2}
                  value={editing.purpose_translations?.en || ""}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      purpose_translations: {
                        ...(editing.purpose_translations || {}),
                        en: e.target.value,
                      },
                    })
                  }
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 px-3 py-2"
                />
              </label>
            </div>

            <div className="flex items-center gap-4 text-xs pt-1">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(editing.is_third_party)}
                  onChange={(e) => setEditing({ ...editing, is_third_party: e.target.checked })}
                />
                <span>3. Taraf Çerez</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editing.is_active !== false}
                  onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
                />
                <span>Vitrin Listesinde Aktif</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-xl border border-zinc-200 dark:border-zinc-700 px-4 py-2 text-xs font-semibold cursor-pointer"
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {saving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
