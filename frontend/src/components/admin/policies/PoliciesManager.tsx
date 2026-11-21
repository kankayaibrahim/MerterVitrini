"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { 
  FileText, 
  History, 
  Check, 
  RefreshCw, 
  AlertTriangle, 
  Plus, 
  Edit3,
  Calendar
} from "lucide-react";
import { LegalPolicy } from "@/types/integration";

const LABELS = {
  TITLE: "Sözleşme & Hukuki Politika Yönetimi",
  DESC: "E-ticaret sitenizin 5651 Yer Sağlayıcı, FSEK/SMK ve TTK uyumu için İptal & İade, Kullanıcı Sözleşmesi, Tedarikçi Sorumluluk Sözleşmesi, Telif/Uyar-Kaldır ve Gizlilik Politikası metinlerini sürüm geçmişleriyle birlikte yönetebilirsiniz.",
  TAB_RETURN: "İptal & İade Politikası",
  TAB_TERMS: "Kullanıcı Sözleşmesi",
  TAB_SUPPLIER: "Tedarikçi Sözleşmesi",
  TAB_COPYRIGHT: "Telif & Uyar-Kaldır",
  TAB_PRIVACY: "Gizlilik Politikası",
  
  ACTIVE_VERSION: "Aktif Sürüm",
  VERSION_TIMELINE: "Versiyon ve Değişiklik Geçmişi",
  NO_HISTORY: "Bu politikaya ait henüz bir geçmiş kayıt bulunamadı.",
  CREATE_NEW: "Yeni Versiyon / Değişiklik Yayınla",
  PREVIEW_ACTIVE: "Aktif Versiyon Önizlemesi",
  
  FIELD_TITLE: "Sürüm Başlığı veya Değişiklik Özeti (Örn: v2.0 - İade Adresi Güncellemesi)",
  FIELD_CONTENT: "Sözleşme Metni (Markdown Formatı Desteklenir)",
  
  BTN_SAVE: "Yeni Sürüm Olarak Kaydet",
  BTN_ACTIVATE: "Bu Sürümü Yayına Al",
  BTN_PREVIEW: "Önizle",
  BTN_EDIT: "Düzenle & Yeni Sürüm Yaz",
  
  WARNING_ACTIVATE: "Kritik Eylem: Versiyon Değişikliği",
  WARNING_ACTIVATE_DESC: "Bu sürümü yayına aldığınızda, müşterilerinize gösterilen sözleşme anında değişecektir. Gelecekte üyeler bu yeni sürümü kabul etmek zorunda kalacaktır.",
  
  SUCCESS_CREATED: "Yeni sürüm başarıyla kaydedildi.",
  SUCCESS_ACTIVATED: "Sözleşme sürümü başarıyla yayına alındı! Storefront anında güncellendi.",
  REQUIRED_FIELDS: "Lütfen tüm gerekli alanları doldurun.",
  REFRESH: "Yenile",
  LAST_UPDATE: "Son Güncelleme",
  AUTHOR: "Yazar",
  VERSION: "Versiyon",
  LIVE: "YAYINDA",
  INACTIVE: "ARŞİV"
};

interface PoliciesManagerProps {
  readonly apiUrl: string;
  readonly token: string | null;
}

type PolicyType =
  | "cancellation_and_return"
  | "terms_of_service"
  | "supplier_agreement"
  | "copyright_and_takedown"
  | "privacy_policy";

const POLICY_TABS: ReadonlyArray<{ type: PolicyType; label: string }> = [
  { type: "cancellation_and_return", label: LABELS.TAB_RETURN },
  { type: "terms_of_service", label: LABELS.TAB_TERMS },
  { type: "supplier_agreement", label: LABELS.TAB_SUPPLIER },
  { type: "copyright_and_takedown", label: LABELS.TAB_COPYRIGHT },
  { type: "privacy_policy", label: LABELS.TAB_PRIVACY },
];

export default function PoliciesManager({ apiUrl, token }: Readonly<PoliciesManagerProps>) {
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<PolicyType>("cancellation_and_return");
  const [history, setHistory] = useState<LegalPolicy[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<LegalPolicy | null>(null);
  
  // Edit Workspace Form States
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [previewTab, setPreviewTab] = useState<"edit" | "preview">("edit");
  
  // Feedback states
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // API Client Helper
  const apiRequest = useCallback(async (path: string, method: string, body?: unknown) => {
    const headers = new Headers({
      "Content-Type": "application/json"
    });
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(`${apiUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${response.status}`);
    }

    return response.json();
  }, [apiUrl, token]);

  const showToast = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => {
      setSuccessMessage(null);
    }, 4000);
  };

  // Load Policy version history
  const loadPolicyHistory = useCallback(async (type: PolicyType) => {
    try {
      const data = await apiRequest(`/api/v1/policies/${type}/history`, "GET");
      setHistory(data || []);
      
      // Auto-select active version on load
      if (data && data.length > 0) {
        const active = data.find((p: LegalPolicy) => p.is_active);
        setSelectedVersion(active || data[0]);
      } else {
        setSelectedVersion(null);
      }
    } catch (err: unknown) {
      console.error("Failed to load policy history:", err);
    }
  }, [apiRequest]);

  useEffect(() => {
    let isMounted = true;
    if (!token) return;

    const fetchHistory = async () => {
      try {
        const data = await apiRequest(`/api/v1/policies/${activeTab}/history`, "GET");
        if (isMounted) {
          setHistory(data || []);
          if (data && data.length > 0) {
            const active = data.find((p: LegalPolicy) => p.is_active);
            setSelectedVersion(active || data[0]);
          } else {
            setSelectedVersion(null);
          }
          setIsEditing(false);
          setFormError(null);
        }
      } catch (err: unknown) {
        console.error("Failed to load policy history:", err);
      }
    };

    void fetchHistory();

    return () => {
      isMounted = false;
    };
  }, [activeTab, token, apiRequest]);

  const handleRefresh = () => {
    startTransition(async () => {
      await loadPolicyHistory(activeTab);
    });
  };

  // Switch tabs
  const handleTabChange = (type: PolicyType) => {
    setActiveTab(type);
  };

  // Open edit / write workspace
  const handleOpenWriteMode = () => {
    setIsEditing(true);
    setPreviewTab("edit");
    setFormError(null);
    
    // Autofill with selected or active content as boilerplate
    if (selectedVersion) {
      setEditTitle(`Sürüm v${selectedVersion.version + 1} - Güncellemesi`);
      setEditContent(selectedVersion.content);
    } else {
      setEditTitle("Yeni Sözleşme Taslağı");
      setEditContent("");
    }
  };

  // Submit new version
  const handleSaveNewVersion = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!editTitle.trim() || !editContent.trim()) {
      setFormError(LABELS.REQUIRED_FIELDS);
      return;
    }

    const payload = {
      type: activeTab,
      title: editTitle.trim(),
      content: editContent.trim()
    };

    startTransition(async () => {
      try {
        const data = await apiRequest("/api/v1/policies", "POST", payload);
        showToast(LABELS.SUCCESS_CREATED);
        setIsEditing(false);
        await loadPolicyHistory(activeTab);
        setSelectedVersion(data); // Auto-select the newly created version
      } catch (err: unknown) {
        setFormError((err as Error).message || "Kaydetme işlemi başarısız.");
      }
    });
  };

  // Activate selected version
  const handleActivateVersion = (versionId: string) => {
    setFormError(null);
    startTransition(async () => {
      try {
        const data = await apiRequest(`/api/v1/policies/${versionId}/activate`, "POST");
        showToast(LABELS.SUCCESS_ACTIVATED);
        await loadPolicyHistory(activeTab);
        setSelectedVersion(data);
      } catch (err: unknown) {
        setFormError((err as Error).message || "Aktifleştirme işlemi başarısız.");
      }
    });
  };

  // Format date safely
  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("tr-TR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="glass-card bg-white p-6 rounded-3xl border border-zinc-200/50 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
            <FileText className="text-violet-600 animate-pulse" size={24} />
            {LABELS.TITLE}
          </h2>
          <p className="text-sm text-zinc-500 mt-1">{LABELS.DESC}</p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
          <button
            onClick={handleRefresh}
            disabled={isPending}
            className="p-2.5 border border-zinc-200 rounded-xl hover:bg-zinc-50 text-zinc-600 transition-colors bg-white shadow-sm flex items-center justify-center gap-1.5 text-sm font-semibold cursor-pointer"
            type="button"
          >
            <RefreshCw size={15} className={isPending ? "animate-spin" : ""} />
            {LABELS.REFRESH}
          </button>

          {!isEditing && (
            <button
              onClick={handleOpenWriteMode}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-semibold text-sm shadow-md hover:shadow-lg hover:shadow-violet-600/10 transition-all cursor-pointer"
              type="button"
            >
              <Plus size={16} />
              {LABELS.CREATE_NEW}
            </button>
          )}
        </div>
      </div>

      {/* Policy Selection Tabs */}
      <div className="flex flex-wrap gap-4 sm:gap-6 border-b border-zinc-200/50 pb-2">
        {POLICY_TABS.map((tab) => (
          <button
            key={tab.type}
            type="button"
            onClick={() => handleTabChange(tab.type)}
            className={`pb-2 text-sm font-bold transition-all relative cursor-pointer ${
              activeTab === tab.type
                ? "text-violet-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-violet-600"
                : "text-zinc-500 hover:text-zinc-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Success alert message */}
      {successMessage && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl animate-in fade-in slide-in-from-top-4 duration-300 shadow-sm">
          <Check size={18} className="text-emerald-600 shrink-0" />
          <span className="text-sm font-semibold">{successMessage}</span>
        </div>
      )}

      {formError && (
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-2xl text-xs font-semibold">
          <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
          <span>{formError}</span>
        </div>
      )}

      {/* DUAL WORKSPACE LAYOUT */}
      {isEditing ? (
        /* ==================== EDIT / WRITE SCRIPT WORKSPACE ==================== */
        <form onSubmit={handleSaveNewVersion} className="bg-white border border-zinc-200/50 rounded-3xl shadow-sm overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/50 px-6 py-4">
            <h3 className="text-sm font-bold text-zinc-800 uppercase tracking-wider flex items-center gap-2">
              <Edit3 size={16} className="text-violet-600" />
              {LABELS.CREATE_NEW}
            </h3>
            
            <div className="flex border border-zinc-200 rounded-xl overflow-hidden text-xs font-bold">
              <button
                type="button"
                onClick={() => setPreviewTab("edit")}
                className={`px-3 py-1.5 cursor-pointer transition-colors ${
                  previewTab === "edit" ? "bg-violet-600 text-white" : "bg-white text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                {LABELS.BTN_EDIT}
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab("preview")}
                className={`px-3 py-1.5 cursor-pointer transition-colors ${
                  previewTab === "preview" ? "bg-violet-600 text-white" : "bg-white text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                {LABELS.BTN_PREVIEW}
              </button>
            </div>
          </div>

          <div className="p-6 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{LABELS.FIELD_TITLE}</label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="px-4 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:border-violet-500 font-semibold"
                placeholder="Örn: v2.0 - İade Koşulu Revizyonu"
                required
              />
            </div>

            {previewTab === "edit" ? (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{LABELS.FIELD_CONTENT}</label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={16}
                  className="px-4 py-3 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:border-violet-500 font-mono"
                  placeholder="# Başlık 1... \n\nMetin..."
                  required
                />
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{LABELS.BTN_PREVIEW}</label>
                <div className="border border-zinc-200 rounded-xl p-6 min-h-[350px] bg-zinc-50/30 overflow-y-auto max-h-[500px]">
                  <article className="prose prose-zinc max-w-none text-zinc-700 text-sm leading-relaxed whitespace-pre-wrap">
                    {editContent}
                  </article>
                </div>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-zinc-100 bg-zinc-50/50 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 border border-zinc-200 text-zinc-600 hover:bg-zinc-100 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl shadow-md hover:shadow-violet-600/15 transition-all flex items-center gap-2 cursor-pointer"
            >
              {isPending && <RefreshCw size={12} className="animate-spin" />}
              {LABELS.BTN_SAVE}
            </button>
          </div>
        </form>
      ) : (
        /* ==================== TIMELINE & DETAIL VIEW LAYOUT ==================== */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Version History Timeline */}
          <div className="lg:col-span-1 flex flex-col gap-4">
            <div className="bg-white border border-zinc-200/50 rounded-3xl p-5 shadow-sm flex flex-col gap-4">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                <History size={15} className="text-zinc-400" />
                {LABELS.VERSION_TIMELINE}
              </h3>

              <div className="flex flex-col gap-4 relative pl-4 border-l border-zinc-200/60 max-h-[600px] overflow-y-auto pr-1">
                {history.length > 0 ? (
                  history.map((p) => (
                    <button 
                      key={p.id} 
                      type="button"
                      onClick={() => setSelectedVersion(p)}
                      className={`text-left w-full group relative flex flex-col gap-1 p-3 rounded-2xl border transition-all cursor-pointer select-none ${
                        selectedVersion?.id === p.id 
                          ? "bg-violet-50/50 border-violet-200/60 shadow-sm" 
                          : "bg-white border-zinc-200/40 hover:bg-zinc-50/50"
                      }`}
                    >
                      {/* Timeline dot */}
                      <span className={`absolute -left-[21px] top-4 w-2.5 h-2.5 rounded-full border-2 transition-all ${
                        p.is_active 
                          ? "bg-emerald-500 border-emerald-100 ring-4 ring-emerald-500/20" 
                          : "bg-zinc-200 border-zinc-100"
                      }`} />

                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs font-mono text-zinc-400 group-hover:text-zinc-500">
                          {LABELS.VERSION} {p.version}
                        </span>
                        
                        {p.is_active ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-700">
                            {LABELS.LIVE}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold bg-zinc-100 border border-zinc-200 text-zinc-500">
                            {LABELS.INACTIVE}
                          </span>
                        )}
                      </div>

                      <span className={`text-xs font-bold truncate ${
                        selectedVersion?.id === p.id ? "text-violet-900" : "text-zinc-800 group-hover:text-zinc-950"
                      }`}>
                        {p.title}
                      </span>

                      <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-medium">
                        <Calendar size={11} />
                        <span>{formatDate(p.created_at)}</span>
                      </div>
                    </button>
                  ))
                ) : (
                  <p className="text-zinc-400 italic text-xs font-medium py-4 text-center">{LABELS.NO_HISTORY}</p>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Selected Version Detail & Content View */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            {selectedVersion ? (
              <div className="bg-white border border-zinc-200/50 rounded-3xl shadow-sm flex flex-col overflow-hidden animate-in fade-in duration-300">
                {/* Meta details Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-5 bg-zinc-50/50 border-b border-zinc-100">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-extrabold text-violet-600 bg-violet-50 px-2 py-0.5 rounded border border-violet-100">
                        {LABELS.VERSION} {selectedVersion.version}
                      </span>
                      <h3 className="font-extrabold text-zinc-800 text-sm sm:text-base">{selectedVersion.title}</h3>
                    </div>
                    
                    <div className="flex items-center gap-4 text-xs font-semibold text-zinc-400 mt-1">
                      <span className="flex items-center gap-1.5">
                        <Calendar size={13} />
                        {LABELS.LAST_UPDATE}: {formatDate(selectedVersion.updated_at)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {!selectedVersion.is_active && (
                      <button
                        onClick={() => handleActivateVersion(selectedVersion.id)}
                        disabled={isPending}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-sm hover:shadow-emerald-600/15 cursor-pointer transition-all"
                        type="button"
                      >
                        <Check size={13} />
                        {LABELS.BTN_ACTIVATE}
                      </button>
                    )}
                  </div>
                </div>

                {/* Warning Alert if selecting an inactive/draft version */}
                {!selectedVersion.is_active && (
                  <div className="mx-6 mt-4 p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl flex gap-3 text-xs font-semibold">
                    <AlertTriangle size={18} className="text-amber-600 shrink-0" />
                    <div>
                      <span className="block font-bold text-amber-800 mb-0.5">{LABELS.WARNING_ACTIVATE}</span>
                      <span>{LABELS.WARNING_ACTIVATE_DESC}</span>
                    </div>
                  </div>
                )}

                {/* Content body */}
                <div className="p-6 overflow-y-auto max-h-[500px]">
                  <article className="prose prose-zinc max-w-none text-zinc-700 text-sm leading-relaxed whitespace-pre-wrap">
                    {selectedVersion.content}
                  </article>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-zinc-200/50 rounded-3xl p-12 shadow-sm text-center flex flex-col items-center gap-3">
                <FileText size={48} className="text-zinc-300 animate-bounce" />
                <p className="text-sm font-semibold text-zinc-500">{LABELS.NO_HISTORY}</p>
                <button
                  onClick={handleOpenWriteMode}
                  className="mt-2 flex items-center justify-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-semibold text-xs shadow-md transition-all cursor-pointer"
                  type="button"
                >
                  <Plus size={14} />
                  {LABELS.CREATE_NEW}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

