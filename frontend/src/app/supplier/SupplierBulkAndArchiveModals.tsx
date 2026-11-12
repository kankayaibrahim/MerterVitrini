"use client";

import React, { useState } from "react";
import {
  FileSpreadsheet,
  Download,
  Upload,
  Archive,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";

export async function toggleSupplierProductArchiveApi(
  token: string,
  productId: string,
  isArchived: boolean,
  restoreActive = true
): Promise<boolean> {
  try {
    const res = await fetch(
      `/api/v1/supplier/products/${encodeURIComponent(productId)}/archive`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          is_archived: isArchived,
          restore_active: restoreActive,
        }),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

export async function bulkArchiveSupplierProductsByIdsApi(
  token: string,
  productIds: string[],
  isArchived: boolean,
  restoreActive = true
): Promise<number> {
  try {
    const res = await fetch("/api/v1/supplier/products/bulk-archive", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        product_ids: productIds,
        is_archived: isArchived,
        restore_active: restoreActive,
      }),
    });
    if (!res.ok) return 0;
    const data = (await res.json()) as { affected_count?: number };
    return data.affected_count || 0;
  } catch {
    return 0;
  }
}

export async function downloadSupplierExcelTemplateApi(token: string): Promise<void> {
  try {
    const res = await fetch("/api/v1/supplier/products/excel-template", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mertervitrini_toplu_urun_sablonu.xlsx";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch {
    // Ignore transient download error
  }
}

interface ExcelImportResult {
  imported_count: number;
  skipped_count: number;
  errors: string[];
  message: string;
}

export function SupplierExcelImportModal({
  isOpen,
  getToken,
  onClose,
  onImported,
}: Readonly<{
  isOpen: boolean;
  getToken: () => string | null;
  onClose: () => void;
  onImported: () => void;
}>) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [result, setResult] = useState<ExcelImportResult | null>(null);

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    const token = getToken();
    if (!token) return;
    void downloadSupplierExcelTemplateApi(token);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getToken();
    if (!token || !selectedFile) {
      setErrorMsg("Lütfen yüklenecek bir Excel (.xlsx) veya CSV (.csv) dosyası seçin.");
      return;
    }

    setUploading(true);
    setErrorMsg("");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const res = await fetch("/api/v1/supplier/products/import-excel", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = (await res.json()) as {
        error?: string;
        imported_count?: number;
        skipped_count?: number;
        errors?: string[];
        message?: string;
      };
      if (!res.ok) {
        setErrorMsg(data.error || "Excel dosyası içe aktarılamadı.");
      } else {
        setResult({
          imported_count: data.imported_count || 0,
          skipped_count: data.skipped_count || 0,
          errors: data.errors || [],
          message: data.message || "İçe aktarma tamamlandı.",
        });
        if ((data.imported_count || 0) > 0) {
          onImported();
        }
      }
    } catch {
      setErrorMsg("Sunucu bağlantısı sırasında bir hata oluştu.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Excel / CSV ile Toplu Ürün Yükleme
              </h3>
              <p className="text-[11px] text-slate-500">
                Yüzlerce modeli, beden/stok dağılımlarını ve fiyatları tek seferde yükleyin.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer border-none bg-transparent"
          >
            <X size={18} />
          </button>
        </div>

        <div className="bg-slate-50 rounded-xl border border-slate-200 p-3.5 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-600">
            <strong className="text-slate-900 block">1. Adım: Hazır Şablonu İndirin</strong>
            <span>Kategori rehberli hazır Excel (.xlsx) şablonunu indirip ürünlerinizi doldurun.</span>
          </div>
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 border border-slate-200 text-xs font-bold shrink-0 cursor-pointer transition-colors"
          >
            <Download size={14} />
            <span>Örnek Şablon (.xlsx)</span>
          </button>
        </div>

        <form onSubmit={handleUploadSubmit} className="space-y-3">
          <div className="border-2 border-dashed border-slate-300 hover:border-slate-900 rounded-xl p-5 text-center space-y-2 transition-colors">
            <Upload size={22} className="mx-auto text-slate-400" />
            <label htmlFor="supplier-excel-upload" className="block text-xs font-bold text-slate-700 cursor-pointer">
              2. Adım: Doldurduğunuz Excel (.xlsx) veya CSV (.csv) Dosyasını Seçin
            </label>
            <input
              id="supplier-excel-upload"
              type="file"
              accept=".xlsx,.csv"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="block w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-slate-900 file:text-white hover:file:bg-slate-800 cursor-pointer"
            />
          </div>

          {errorMsg && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2 text-xs font-bold text-red-700">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {result && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex items-center gap-2 font-extrabold text-emerald-900">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span>
                  {result.imported_count} ürün başarıyla yüklendi ({result.skipped_count} satır atlandı).
                </span>
              </div>
              {result.errors.length > 0 && (
                <ul className="list-disc pl-5 text-[11px] text-amber-800 space-y-0.5 max-h-28 overflow-y-auto">
                  {result.errors.map((errItem) => (
                    <li key={errItem}>{errItem}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 inline-flex items-center justify-center rounded-lg bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-xs font-bold cursor-pointer transition-colors"
            >
              Kapat
            </button>
            <button
              type="submit"
              disabled={uploading || !selectedFile}
              className="h-9 px-5 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold cursor-pointer border-none disabled:opacity-50 transition-colors"
            >
              <Upload size={14} />
              <span>{uploading ? "Yükleniyor..." : "Ürünleri İçe Aktar"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function SupplierCollectionArchiveModal({
  isOpen,
  getToken,
  onClose,
  onArchived,
}: Readonly<{
  isOpen: boolean;
  getToken: () => string | null;
  onClose: () => void;
  onArchived: () => void;
}>) {
  const [season, setSeason] = useState("");
  const [olderThanDays, setOlderThanDays] = useState("180");
  const [zeroStockOnly, setZeroStockOnly] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getToken();
    if (!token) return;

    setSubmitting(true);
    setStatusMsg("");
    setErrorMsg("");

    try {
      const res = await fetch("/api/v1/supplier/products/bulk-archive", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          season: season.trim(),
          older_than_days: Number(olderThanDays) || 0,
          zero_stock_only: zeroStockOnly,
          is_archived: true,
        }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        setErrorMsg(data.error || "Arşivleme işlemi başarısız oldu.");
      } else {
        setStatusMsg(data.message || "Seçilen koleksiyon ürünleri arşivlendi.");
        onArchived();
      }
    } catch {
      setErrorMsg("Sunucu bağlantı hatası oluştu.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <Archive size={20} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Eski Koleksiyonu Toplu Arşivle
              </h3>
              <p className="text-[11px] text-slate-500">
                Geçmiş sezon ürünlerini silmeden vitrinden kaldırıp arşive taşıyın.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer border-none bg-transparent"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label htmlFor="archive-season" className="font-bold text-slate-700 block mb-1">
              Sezon Adına Göre Filtrele (Opsiyonel)
            </label>
            <input
              id="archive-season"
              type="text"
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              placeholder="Örn: 2025 Kış, Eski Sezon (Boş bırakılırsa tüm sezonlar)"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-slate-900"
            />
          </div>

          <div>
            <label htmlFor="archive-older-days" className="font-bold text-slate-700 block mb-1">
              Yüklenme Tarihine Göre Eski Koleksiyon Sınırı
            </label>
            <select
              id="archive-older-days"
              value={olderThanDays}
              onChange={(e) => setOlderThanDays(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white focus:outline-none focus:border-slate-900"
            >
              <option value="0">Tarih sınırı olmadan (Sezon veya Stok kriterine göre)</option>
              <option value="90">90 Günden (3 Ay) Eski Ürünler</option>
              <option value="180">180 Günden (6 Ay) Eski Ürünler</option>
              <option value="365">365 Günden (1 Yıl) Eski Ürünler</option>
            </select>
          </div>

          <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={zeroStockOnly}
              onChange={(e) => setZeroStockOnly(e.target.checked)}
              className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
            />
            <span className="font-semibold text-slate-700">
              Yalnızca stoğu tükenmiş (0 stoklu) ürünleri arşivle
            </span>
          </label>

          {errorMsg && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 font-bold">
              {errorMsg}
            </div>
          )}

          {statusMsg && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-800 font-bold">
              ✓ {statusMsg}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 inline-flex items-center justify-center rounded-lg bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-xs font-bold cursor-pointer transition-colors"
            >
              Kapat
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-9 px-5 inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold cursor-pointer border-none disabled:opacity-50 transition-colors"
            >
              <Archive size={14} />
              <span>{submitting ? "Arşivleniyor..." : "Koleksiyonu Arşive Taşı"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
