"use client";

import React, { useState } from "react";
import { Save } from "lucide-react";
import type { ConsentSettingsDTO } from "./types";

interface ConsentSettingsTabProps {
  initialSettings: ConsentSettingsDTO;
  onSave: (settings: ConsentSettingsDTO) => Promise<void>;
}

export default function ConsentSettingsTab({
  initialSettings,
  onSave,
}: ConsentSettingsTabProps) {
  const [form, setForm] = useState<ConsentSettingsDTO>(initialSettings);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-xs space-y-5 max-w-4xl"
    >
      <div>
        <h3 className="text-base font-bold text-zinc-900 dark:text-white">
          c15t CMP, Google Consent Mode v2, IAB TCF 2.2 ve RFC 3161 TSA Ayarları
        </h3>
        <p className="text-xs text-zinc-500 mt-1">
          Yapılan değişiklikler vitrin rıza motorunu ve otomatik zaman damgalama periyotlarını anında günceller.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <label className="flex items-center justify-between rounded-xl border border-zinc-200 dark:border-zinc-700 p-3 cursor-pointer">
          <div>
            <div className="font-semibold">Storefront Çerez Banner&apos;ı Aktif</div>
            <div className="text-[11px] text-zinc-500">KVKK/GDPR onay penceresini ziyaretçilere gösterir</div>
          </div>
          <input
            type="checkbox"
            checked={form.banner_enabled}
            onChange={(e) => setForm({ ...form, banner_enabled: e.target.checked })}
          />
        </label>

        <label className="flex items-center justify-between rounded-xl border border-zinc-200 dark:border-zinc-700 p-3 cursor-pointer">
          <div>
            <div className="font-semibold">Sol Alt Yüzen Tercih Butonu</div>
            <div className="text-[11px] text-zinc-500">Kullanıcının rızayı istediği an geri çekmesini sağlar</div>
          </div>
          <input
            type="checkbox"
            checked={form.floating_trigger_enabled}
            onChange={(e) => setForm({ ...form, floating_trigger_enabled: e.target.checked })}
          />
        </label>

        <label className="space-y-1">
          <span className="font-semibold">Banner Görünüm Düzeni</span>
          <select
            value={form.banner_layout}
            onChange={(e) => setForm({ ...form, banner_layout: e.target.value })}
            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 px-3 py-2"
          >
            <option value="floating">Sağ Alt Yüzen Kart (Önerilen)</option>
            <option value="bar">Tam Genişlik Alt Bant</option>
          </select>
        </label>

        <label className="space-y-1">
          <span className="font-semibold">Google Consent Mode v2 Yükleme Stratejisi</span>
          <select
            value={form.google_consent_mode}
            onChange={(e) => setForm({ ...form, google_consent_mode: e.target.value })}
            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 px-3 py-2"
          >
            <option value="always">always (Rıza öncesi cookieless sinyal + tam Consent Mode v2)</option>
            <option value="after-consent">after-consent (Açık rıza öncesi Google isteğini engelle)</option>
          </select>
        </label>

        <label className="space-y-1">
          <span className="font-semibold">GA4 Ölçüm Kimliği</span>
          <input
            value={form.ga_measurement_id}
            onChange={(e) => setForm({ ...form, ga_measurement_id: e.target.value })}
            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 px-3 py-2 font-mono"
          />
        </label>

        <label className="space-y-1">
          <span className="font-semibold">Yeniden Rıza İsteme Süresi (Gün)</span>
          <input
            type="number"
            min={30}
            max={730}
            value={form.reconsent_days}
            onChange={(e) => setForm({ ...form, reconsent_days: Number(e.target.value) || 365 })}
            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 px-3 py-2"
          />
        </label>

        <label className="space-y-1">
          <span className="font-semibold">Otomatik RFC 3161 TSA Mühürleme Aralığı (Dakika)</span>
          <input
            type="number"
            min={1}
            max={1440}
            value={form.auto_anchor_interval_min}
            onChange={(e) =>
              setForm({ ...form, auto_anchor_interval_min: Number(e.target.value) || 15 })
            }
            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 px-3 py-2"
          />
        </label>

        <label className="space-y-1">
          <span className="font-semibold">Birincil Ücretsiz RFC 3161 TSA Sunucusu</span>
          <input
            value={form.tsa_primary_url}
            onChange={(e) => setForm({ ...form, tsa_primary_url: e.target.value })}
            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 px-3 py-2 font-mono"
          />
        </label>

        <label className="flex items-center justify-between rounded-xl border border-zinc-200 dark:border-zinc-700 p-3 cursor-pointer">
          <div>
            <div className="font-semibold">IAB TCF 2.2 Uyumluluk Bayrağı</div>
            <div className="text-[11px] text-zinc-500">Programatik reklam ağları aktif edildiğinde açılır</div>
          </div>
          <input
            type="checkbox"
            checked={form.iab_enabled}
            onChange={(e) => setForm({ ...form, iab_enabled: e.target.checked })}
          />
        </label>

        <label className="space-y-1">
          <span className="font-semibold">IAB CMP ID (Opsiyonel)</span>
          <input
            type="number"
            value={form.iab_cmp_id}
            onChange={(e) => setForm({ ...form, iab_cmp_id: Number(e.target.value) || 0 })}
            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 px-3 py-2"
          />
        </label>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-5 py-2.5 text-xs font-semibold cursor-pointer disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? "Kaydediliyor..." : "CMP & TSA Ayarlarını Kaydet"}
        </button>
      </div>
    </form>
  );
}
