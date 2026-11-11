"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  SlidersHorizontal,
  Layers,
  Sparkles,
  Search,
  CheckCircle2,
  Info,
  Plus,
  Trash2,
  RefreshCw,
  Ruler,
} from "lucide-react";
import { useAdmin } from "@/context/AdminContext";
import type { SizeDefinitionDTO, SeriesTemplateDTO } from "@/types/integration";

type AdminVariantTab = "templates" | "sizes";

const SIZE_GROUP_LABELS: Record<string, string> = {
  letter: "Harf Bedenler (XS - 5XL)",
  combo: "İkili Kalıp (S-M / L-XL)",
  numeric_eu: "Kadın / Sayısal (34 - 54)",
  jeans: "Kot / Jean (26 - 38)",
  kids: "Çocuk / Yaş Bedenleri",
  shoes: "Ayakkabı (36 - 44)",
  standard: "Tek Beden (STD)",
};

export default function AdminCatalogVariantsPage() {
  const { fetchWithConfig } = useAdmin();
  const [activeTab, setActiveTab] = useState<AdminVariantTab>("templates");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);

  const [sizeDefs, setSizeDefs] = useState<SizeDefinitionDTO[]>([]);
  const [templates, setTemplates] = useState<SeriesTemplateDTO[]>([]);

  // Quick-add Size Definition form
  const [newSizeCode, setNewSizeCode] = useState("");
  const [newSizeLabel, setNewSizeLabel] = useState("");
  const [newSizeGroup, setNewSizeGroup] = useState("letter");
  const [newSizeOrder, setNewSizeOrder] = useState(100);

  // Quick-add Series Template form
  const [newTplName, setNewTplName] = useState("");
  const [newTplHint, setNewTplHint] = useState("");
  const [newTplSizesCsv, setNewTplSizesCsv] = useState("S,M,L,XL");
  const [newTplRatio, setNewTplRatio] = useState("1-1-1-1");
  const [statusMsg, setStatusMsg] = useState("");

  const fetchLookupPair = useCallback(async () => {
    const [szRes, tplRes] = await Promise.all([
      fetchWithConfig("/api/v1/size-definitions"),
      fetchWithConfig("/api/v1/series-templates"),
    ]);
    const nextSizes: SizeDefinitionDTO[] = szRes.ok ? await szRes.json() : [];
    const nextTemplates: SeriesTemplateDTO[] = tplRes.ok ? await tplRes.json() : [];
    return {
      sizes: Array.isArray(nextSizes) ? nextSizes : [],
      templates: Array.isArray(nextTemplates) ? nextTemplates : [],
    };
  }, [fetchWithConfig]);

  const loadDefinitions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchLookupPair();
      setSizeDefs(data.sizes);
      setTemplates(data.templates);
    } catch (err) {
      console.error("Tanım tabloları yüklenemedi:", err);
    } finally {
      setLoading(false);
    }
  }, [fetchLookupPair]);

  useEffect(() => {
    let ignore = false;
    void fetchLookupPair()
      .then((data) => {
        if (!ignore) {
          setSizeDefs(data.sizes);
          setTemplates(data.templates);
        }
      })
      .catch((err) => console.error("Tanım tabloları yüklenemedi:", err));
    return () => {
      ignore = true;
    };
  }, [fetchLookupPair]);

  const handleCreateSize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSizeCode.trim()) return;
    setStatusMsg("");
    const res = await fetchWithConfig("/api/v1/size-definitions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: newSizeCode.trim(),
        label: newSizeLabel.trim() || newSizeCode.trim(),
        size_group: newSizeGroup,
        sort_order: Number(newSizeOrder) || 100,
        is_active: true,
      }),
    });
    if (res.ok) {
      setNewSizeCode("");
      setNewSizeLabel("");
      setStatusMsg("Beden tanımı kaydedildi.");
      void loadDefinitions();
    }
  };

  const handleDeleteSize = async (id: string) => {
    const res = await fetchWithConfig(`/api/v1/size-definitions/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      void loadDefinitions();
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedSizes = newTplSizesCsv
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!newTplName.trim() || parsedSizes.length === 0) return;

    setStatusMsg("");
    const tplKey = `custom_${Date.now()}`;
    const res = await fetchWithConfig("/api/v1/series-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        template_key: tplKey,
        name: newTplName.trim(),
        category_hint: newTplHint.trim() || "Genel Toptan",
        sizes: parsedSizes,
        series_ratio: newTplRatio.trim() || parsedSizes.map(() => "1").join("-"),
        sort_order: 100,
        is_active: true,
      }),
    });
    if (res.ok) {
      setNewTplName("");
      setNewTplHint("");
      setStatusMsg("Hazır seri şablonu kaydedildi.");
      void loadDefinitions();
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    const res = await fetchWithConfig(`/api/v1/series-templates/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      void loadDefinitions();
    }
  };

  const q = searchTerm.toLowerCase();
  const filteredTemplates = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      t.category_hint.toLowerCase().includes(q) ||
      t.sizes.join(" ").toLowerCase().includes(q)
  );
  const filteredSizes = sizeDefs.filter(
    (s) =>
      s.code.toLowerCase().includes(q) ||
      s.label.toLowerCase().includes(q) ||
      s.size_group.toLowerCase().includes(q)
  );

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      {/* Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-zinc-950 p-6 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-600 flex items-center justify-center shrink-0">
            <SlidersHorizontal size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-950 dark:text-white flex items-center gap-2">
              <span>Beden Tanım Tablosu &amp; Hazır Seri Şablonları</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300 font-bold">
                Seçmeli B2B Standart
              </span>
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Tedarikçilerin web ve mobil uygulamada serbest yazı yazmadan seçebileceği resmi beden kodlarını ve hazır seri şablonlarını yönetin.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              id="admin-var-search"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Beden veya şablon ara..."
              className="pl-9 pr-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:outline-hidden focus:border-violet-500 text-zinc-900 dark:text-white"
            />
          </div>
          <button
            type="button"
            onClick={() => void loadDefinitions()}
            className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer"
            title="Yenile"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
            <Layers size={20} />
          </div>
          <div>
            <span className="text-xs font-semibold text-zinc-500">Hazır Seri Şablonu</span>
            <p className="text-xl font-black text-zinc-950 dark:text-white">{templates.length} Şablon</p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
            <Ruler size={20} />
          </div>
          <div>
            <span className="text-xs font-semibold text-zinc-500">Tanımlı Seçmeli Beden</span>
            <p className="text-xl font-black text-zinc-950 dark:text-white">{sizeDefs.length} Beden Kodu</p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-600 flex items-center justify-center">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <span className="text-xs font-semibold text-zinc-500">Varsayılan Tedarikçi Stoğu</span>
            <p className="text-xl font-black text-zinc-950 dark:text-white">100 Seri</p>
          </div>
        </div>
      </div>

      {statusMsg && (
        <div className="px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
          ✓ {statusMsg}
        </div>
      )}

      {/* Switch Tabs */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("templates")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "templates"
              ? "bg-violet-600 text-white shadow-xs"
              : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300"
          }`}
        >
          Hazır Toptan Seri Şablonları ({templates.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("sizes")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "sizes"
              ? "bg-violet-600 text-white shadow-xs"
              : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300"
          }`}
        >
          Beden Tanım Tablosu ({sizeDefs.length})
        </button>
      </div>

      {activeTab === "templates" ? (
        <AdminSeriesTemplatesPanel
          templates={filteredTemplates}
          newTplName={newTplName}
          setNewTplName={setNewTplName}
          newTplHint={newTplHint}
          setNewTplHint={setNewTplHint}
          newTplSizesCsv={newTplSizesCsv}
          setNewTplSizesCsv={setNewTplSizesCsv}
          newTplRatio={newTplRatio}
          setNewTplRatio={setNewTplRatio}
          onCreate={handleCreateTemplate}
          onDelete={(id) => void handleDeleteTemplate(id)}
        />
      ) : (
        <AdminSizeDefinitionsPanel
          sizes={filteredSizes}
          newSizeCode={newSizeCode}
          setNewSizeCode={setNewSizeCode}
          newSizeLabel={newSizeLabel}
          setNewSizeLabel={setNewSizeLabel}
          newSizeGroup={newSizeGroup}
          setNewSizeGroup={setNewSizeGroup}
          newSizeOrder={newSizeOrder}
          setNewSizeOrder={setNewSizeOrder}
          onCreate={handleCreateSize}
          onDelete={(id) => void handleDeleteSize(id)}
        />
      )}
    </div>
  );
}

function AdminSeriesTemplatesPanel({
  templates,
  newTplName,
  setNewTplName,
  newTplHint,
  setNewTplHint,
  newTplSizesCsv,
  setNewTplSizesCsv,
  newTplRatio,
  setNewTplRatio,
  onCreate,
  onDelete,
}: Readonly<{
  templates: SeriesTemplateDTO[];
  newTplName: string;
  setNewTplName: (v: string) => void;
  newTplHint: string;
  setNewTplHint: (v: string) => void;
  newTplSizesCsv: string;
  setNewTplSizesCsv: (v: string) => void;
  newTplRatio: string;
  setNewTplRatio: (v: string) => void;
  onCreate: (e: React.FormEvent) => void;
  onDelete: (id: string) => void;
}>) {
  return (
    <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs overflow-hidden flex flex-col gap-4">
      <form
        onSubmit={onCreate}
        className="p-4 border-b border-zinc-100 dark:border-zinc-800 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end bg-zinc-50/50 dark:bg-zinc-900/30"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="tpl-name" className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
            Şablon Adı
          </label>
          <input
            id="tpl-name"
            type="text"
            value={newTplName}
            onChange={(e) => setNewTplName(e.target.value)}
            placeholder="Örn: M-L-XL-2XL (4'lü)"
            className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs"
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="tpl-hint" className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
            Kategori İpucu
          </label>
          <input
            id="tpl-hint"
            type="text"
            value={newTplHint}
            onChange={(e) => setNewTplHint(e.target.value)}
            placeholder="Örn: Erkek Gömlek"
            className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="tpl-sizes" className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
            Bedenler (Virgülle)
          </label>
          <input
            id="tpl-sizes"
            type="text"
            value={newTplSizesCsv}
            onChange={(e) => setNewTplSizesCsv(e.target.value)}
            placeholder="S,M,L,XL"
            className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-mono"
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="tpl-ratio" className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
            Seri Asortisi
          </label>
          <input
            id="tpl-ratio"
            type="text"
            value={newTplRatio}
            onChange={(e) => setNewTplRatio(e.target.value)}
            placeholder="1-1-1-1"
            className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-mono"
            required
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Plus size={14} />
          <span>Şablon Ekle</span>
        </button>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-zinc-50 dark:bg-zinc-900/60 text-zinc-500 font-bold uppercase tracking-wider border-b border-zinc-200/60 dark:border-zinc-800/60">
            <tr>
              <th className="py-3 px-4">Şablon Adı</th>
              <th className="py-3 px-4">Kategori Grubu</th>
              <th className="py-3 px-4">Seçili Bedenler</th>
              <th className="py-3 px-4 text-center">Asorti</th>
              <th className="py-3 px-4 text-center">1 Seri Adedi</th>
              <th className="py-3 px-4 text-right">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 text-zinc-700 dark:text-zinc-300">
            {templates.map((s) => (
              <tr key={s.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40">
                <td className="py-3 px-4 font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <Sparkles size={14} className="text-amber-500" />
                  <span>{s.name}</span>
                </td>
                <td className="py-3 px-4 text-zinc-500">{s.category_hint}</td>
                <td className="py-3 px-4">
                  <div className="flex flex-wrap gap-1.5">
                    {s.sizes.map((sz) => (
                      <span
                        key={sz}
                        className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 font-mono text-[11px] font-bold"
                      >
                        {sz}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="py-3 px-4 text-center font-mono font-bold">{s.series_ratio}</td>
                <td className="py-3 px-4 text-center font-bold">{s.units_per_series} Adet</td>
                <td className="py-3 px-4 text-right">
                  <button
                    type="button"
                    onClick={() => onDelete(s.id)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                    title="Şablonu Sil"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-4 bg-zinc-50 dark:bg-zinc-900/40 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center gap-2 text-xs text-zinc-500">
        <Info size={14} className="text-violet-500 shrink-0" />
        <span>
          Tedarikçiler ürün eklerken tek tıkla bu şablonları seçer; serbest metin beden girişi kapalıdır.
        </span>
      </div>
    </div>
  );
}

function AdminSizeDefinitionsPanel({
  sizes,
  newSizeCode,
  setNewSizeCode,
  newSizeLabel,
  setNewSizeLabel,
  newSizeGroup,
  setNewSizeGroup,
  newSizeOrder,
  setNewSizeOrder,
  onCreate,
  onDelete,
}: Readonly<{
  sizes: SizeDefinitionDTO[];
  newSizeCode: string;
  setNewSizeCode: (v: string) => void;
  newSizeLabel: string;
  setNewSizeLabel: (v: string) => void;
  newSizeGroup: string;
  setNewSizeGroup: (v: string) => void;
  newSizeOrder: number;
  setNewSizeOrder: (v: number) => void;
  onCreate: (e: React.FormEvent) => void;
  onDelete: (id: string) => void;
}>) {
  return (
    <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs overflow-hidden flex flex-col gap-4">
      <form
        onSubmit={onCreate}
        className="p-4 border-b border-zinc-100 dark:border-zinc-800 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end bg-zinc-50/50 dark:bg-zinc-900/30"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="sz-code" className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
            Beden Kodu
          </label>
          <input
            id="sz-code"
            type="text"
            value={newSizeCode}
            onChange={(e) => setNewSizeCode(e.target.value)}
            placeholder="Örn: 6XL veya 56"
            className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-mono"
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="sz-label" className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
            Görünen Etiket
          </label>
          <input
            id="sz-label"
            type="text"
            value={newSizeLabel}
            onChange={(e) => setNewSizeLabel(e.target.value)}
            placeholder="Örn: 6XL"
            className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="sz-group" className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
            Beden Grubu
          </label>
          <select
            id="sz-group"
            value={newSizeGroup}
            onChange={(e) => setNewSizeGroup(e.target.value)}
            className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs"
          >
            {Object.entries(SIZE_GROUP_LABELS).map(([k, lbl]) => (
              <option key={k} value={k}>
                {lbl}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="sz-order" className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
            Sıralama
          </label>
          <input
            id="sz-order"
            type="number"
            value={newSizeOrder}
            onChange={(e) => setNewSizeOrder(Number(e.target.value))}
            className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Plus size={14} />
          <span>Beden Ekle</span>
        </button>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-zinc-50 dark:bg-zinc-900/60 text-zinc-500 font-bold uppercase tracking-wider border-b border-zinc-200/60 dark:border-zinc-800/60">
            <tr>
              <th className="py-3 px-4">Beden Kodu</th>
              <th className="py-3 px-4">Görünen Ad</th>
              <th className="py-3 px-4">Grup</th>
              <th className="py-3 px-4 text-center">Sıra</th>
              <th className="py-3 px-4 text-right">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 text-zinc-700 dark:text-zinc-300">
            {sizes.map((sz) => (
              <tr key={sz.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40">
                <td className="py-2.5 px-4 font-mono font-bold text-zinc-900 dark:text-white">{sz.code}</td>
                <td className="py-2.5 px-4">{sz.label}</td>
                <td className="py-2.5 px-4 text-zinc-500">
                  {SIZE_GROUP_LABELS[sz.size_group] || sz.size_group}
                </td>
                <td className="py-2.5 px-4 text-center font-mono">{sz.sort_order}</td>
                <td className="py-2.5 px-4 text-right">
                  <button
                    type="button"
                    onClick={() => onDelete(sz.id)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                    title="Bedeni Sil"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
