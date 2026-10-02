"use client";

import { useState, useTransition } from "react";
import { 
  X, 
  Check, 
  Loader2, 
  AlertTriangle,
  Settings,
  CheckCircle2
} from "lucide-react";
import { XmlFeed, CategoryNode } from "@/types/integration";

// Safe LABELS for the Parser Configuration Panel
const LABELS = {
  TITLE: "XML Entegrasyon & Parser Ayarları",
  SCRIPT_PATH: "Python Script Dosya Yolu",
  SCRIPT_PATH_PLACEHOLDER: "Örn: parsers/janes.py",
  SCRIPT_PATH_DESC: "Sunucudaki `admin/backend` klasörüne göre custom Python parser script dosyasının göreceli yolu.",
  SAVE_CONFIG: "Yapılandırmayı Kaydet",
  SAVING: "Ayarlar sunucuya kaydediliyor...",
  SUCCESS_SAVED: "Entegrasyon ve Parser ayarlarınız başarıyla kaydedildi!",
  CANCEL: "Vazgeç",
  FEED_LABEL: "Tedarikçi Beslemesi: "
};

interface XmlImportWizardProps {
  readonly feed: XmlFeed;
  readonly categories: readonly CategoryNode[];
  readonly onClose: () => void;
  readonly onSaveSuccess: () => Promise<void>;
  readonly apiUrl: string;
  readonly token: string | null;
}

export default function XmlImportWizard({
  feed,
  onClose,
  onSaveSuccess,
  apiUrl,
  token,
}: Readonly<XmlImportWizardProps>) {
  const [isPending, startTransition] = useTransition();
  
  // Extract initial mapping config fields - always defaults to python_script
  const initialConfig = (feed.mapping_config as Record<string, unknown>) || {};
  const [pythonScript, setPythonScript] = useState<string>(
    typeof initialConfig.python_script === "string" ? initialConfig.python_script : "parsers/janes.py"
  );

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Save configurations to backend
  const handleSaveConfiguration = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pythonScript.trim()) {
      setErrorMsg("Python Script dosya yolu zorunludur.");
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);

    startTransition(async () => {
      try {
        const headers = new Headers({
          "Content-Type": "application/json"
        });
        if (token) {
          headers.set("Authorization", `Bearer ${token}`);
        }

        // 1. First update the Feed URL/status of the XML Feed in DB
        const feedUpdateRes = await fetch(`${apiUrl}/api/v1/suppliers/${feed.brand_id}/feeds`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            id: feed.id,
            name: feed.name,
            alias_code: feed.alias_code,
            feed_url: feed.feed_url || "", // Preserve the original feed URL
            is_active: feed.is_active
          })
        });

        if (!feedUpdateRes.ok) {
          const errData = await feedUpdateRes.json().catch(() => ({}));
          throw new Error(errData.error || "XML besleme adresi güncellenemedi.");
        }

        // 2. Save Mapping Config (method details and script path)
        const mappingRes = await fetch(`${apiUrl}/api/v1/feeds/${feed.id}/mapping`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            mapping_config: {
              parser_type: "python_script", // Always force python_script
              python_script: pythonScript.trim()
            },
            category_mapping: feed.category_mapping || {} // Preserve old category mapping if any
          })
        });

        if (!mappingRes.ok) {
          const errData = await mappingRes.json().catch(() => ({}));
          throw new Error(errData.error || "Parser yapılandırması kaydedilemedi.");
        }

        setSuccessMsg(LABELS.SUCCESS_SAVED);
        setTimeout(() => {
          void onSaveSuccess();
          onClose();
        }, 1500);
      } catch (err: unknown) {
        setErrorMsg((err as Error).message || "Kaydetme işlemi sırasında bir hata oluştu.");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 backdrop-blur-sm p-4 animate-in fade-in duration-200 overflow-y-auto">
      
      <div className="bg-white rounded-3xl border border-zinc-200 max-w-lg w-full overflow-hidden shadow-2xl flex flex-col my-8 animate-in zoom-in-95 duration-200 max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100 bg-zinc-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-violet-50 text-violet-600 rounded-2xl">
              <Settings size={20} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-zinc-900">{LABELS.TITLE}</h3>
              <p className="text-xs text-zinc-400 font-semibold uppercase mt-0.5 tracking-wider font-mono">
                {LABELS.FEED_LABEL}<span className="text-zinc-700 font-bold">{feed.name} ({feed.alias_code})</span>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-200/50 text-zinc-400 hover:text-zinc-600 transition-colors"
            type="button"
            disabled={isPending}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSaveConfiguration} className="flex flex-col overflow-y-auto flex-1">
          <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-5">
            {errorMsg && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-2xl text-xs font-semibold shrink-0">
                <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl text-xs font-semibold shrink-0">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Python Script File Path Input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-zinc-600 uppercase tracking-wider">{LABELS.SCRIPT_PATH}</label>
              <input 
                type="text"
                value={pythonScript}
                onChange={(e) => setPythonScript(e.target.value)}
                className="w-full px-4 py-3 border border-zinc-200 rounded-xl bg-zinc-50/50 focus:outline-none focus:border-violet-500 focus:bg-white focus:ring-1 focus:ring-violet-500/20 text-sm font-semibold transition-all shadow-sm font-mono"
                placeholder={LABELS.SCRIPT_PATH_PLACEHOLDER}
                required
                disabled={isPending}
              />
              <span className="text-[10px] text-zinc-400 font-semibold block leading-relaxed mt-0.5 px-1">
                {LABELS.SCRIPT_PATH_DESC}
              </span>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="px-6 py-4 border-t border-zinc-100 bg-zinc-50/50 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-zinc-200 rounded-xl text-sm font-semibold hover:bg-zinc-50 text-zinc-600 transition-colors bg-white shadow-sm"
              disabled={isPending}
            >
              {LABELS.CANCEL}
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 shadow-md hover:shadow-lg hover:shadow-violet-600/10 text-white rounded-xl text-sm font-semibold flex items-center gap-1.5 transition-all"
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {LABELS.SAVING}
                </>
              ) : (
                <>
                  <Check size={16} />
                  {LABELS.SAVE_CONFIG}
                </>
              )}
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}

