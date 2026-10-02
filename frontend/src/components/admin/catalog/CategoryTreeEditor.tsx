"use client";

import { useState, useTransition } from "react";
import { 
  Folder, 
  FolderOpen, 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  Edit3, 
  Trash2, 
  RefreshCw,
  FolderPlus,
  CheckCircle,
  AlertTriangle,
  X,
  Sparkles
} from "lucide-react";
import { CategoryNode } from "@/types/integration";
import { getFlatCategoriesList } from "@/utils/formatters";

// Strict internationalization safe LABELS dictionary
const LABELS = {
  TITLE: "Kategori Hiyerarşi Yönetimi",
  DESCRIPTION: "Kategorileri hiyerarşik olarak düzenleyin, yeni alt kategoriler ekleyin veya üst kategorilerini değiştirerek taşıyın.",
  ADD_ROOT: "Yeni Ana Kategori Ekle",
  ADD_CHILD: "Alt Kategori Ekle",
  EDIT: "Düzenle",
  MOVE: "Hiyerarşide Taşı",
  DELETE: "Sil",
  ACTIVE: "Aktif",
  PASSIVE: "Pasif",
  SAVE: "Değişiklikleri Kaydet",
  CANCEL: "İptal",
  DELETE_CONFIRM_TITLE: "Kategoriyi Silmek İstediğinize Emin misiniz?",
  DELETE_CONFIRM_DESC: "Bu kategoriyi silmek istediğinizden emin misiniz? Alt kategorileri varsa, veritabanı ilişkileri gereği bu alt kategorilerin üst kategori bağlantısı koparılacak ve en üst seviyeye alınacaktır (parent_id değeri boş kalacaktır).",
  MOVE_TITLE: "Kategoriyi Taşı",
  CHOOSE_PARENT: "Yeni Üst Kategori Seçin",
  ROOT_LEVEL: "Ana Kategori (En Üst Seviye)",
  EDIT_TITLE: "Kategoriyi Düzenle",
  CREATE_TITLE: "Yeni Kategori Oluştur",
  NAME: "Kategori Adı",
  STATUS: "Durum",
  SUBMITTING: "İşlem yapılıyor...",
  SUCCESS_CREATED: "Kategori başarıyla oluşturuldu.",
  SUCCESS_UPDATED: "Kategori başarıyla güncellendi.",
  SUCCESS_DELETED: "Kategori başarıyla silindi.",
  ERROR_FETCH: "Kategoriler yüklenirken bir hata oluştu.",
  NO_CATEGORIES: "Henüz kategori tanımlanmamış. Hemen ilk ana kategoriyi ekleyin.",
  REFRESH: "Yenile",
  PARENT: "Üst Kategori",
  REQUIRED_FIELD: "Kategori adı zorunludur.",
  ERROR_SELF_PARENT: "Bir kategori kendisinin veya alt kategorilerinin altına taşınamaz.",
  CRITICAL_ACTION: "Hassas İşlem",
  DELETE_WARNING_DESC: "Silinen kategorideki tüm ürünler kategorisiz kalacaktır. Bu işlem geri alınamaz!"
};

const LANGUAGES = [
  { code: "tr", label: "TR", name: "Türkçe" },
  { code: "en", label: "EN", name: "English" },
  { code: "pl", label: "PL", name: "Polski" },
  { code: "bg", label: "BG", name: "Български" },
  { code: "ar", label: "AR", name: "العربية" },
  { code: "ru", label: "RU", name: "Русский" },
  { code: "de", label: "DE", name: "Deutsch" },
  { code: "fr", label: "FR", name: "Français" },
];

interface CategoryTreeEditorProps {
  categories: CategoryNode[];
  onRefresh: () => Promise<void>;
  apiUrl: string;
  token: string | null;
}

export default function CategoryTreeEditor({
  categories,
  onRefresh,
  apiUrl,
  token
}: Readonly<CategoryTreeEditorProps>) {
  const [isPending, startTransition] = useTransition();
  const [expandedNodes, setExpandedNodes] = useState<Map<string, boolean>>(new Map());
  
  // Modals state
  const [activeModal, setActiveModal] = useState<"create" | "edit" | "delete" | null>(null);
  const [selectedNode, setSelectedNode] = useState<CategoryNode | null>(null);
  
  // Form fields
  const [formTitle, setFormTitle] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [formParentId, setFormParentId] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Multilingual state
  const [translations, setTranslations] = useState<Record<string, { title: string; seo_description: string }>>({});
  const [activeLangTab, setActiveLangTab] = useState("tr");

  // Flat list helper for parent selection dropdowns
  const flatCategories = getFlatCategoriesList(categories);

  // Toggle node expansion
  const toggleExpand = (nodeId: string) => {
    if (nodeId === "__proto__" || nodeId === "constructor" || nodeId === "prototype") return;
    setExpandedNodes(prev => {
      const next = new Map(prev);
      next.set(nodeId, !next.get(nodeId));
      return next;
    });
  };

  // Safe API Request Helper
  const apiRequest = async (path: string, method: string, body?: any) => {
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

    if (response.status === 204) return null;
    return response.json();
  };

  // Open Create Modal
  const openCreateModal = (parent: CategoryNode | null) => {
    setFormTitle("");
    setFormIsActive(true);
    setFormParentId(parent ? parent.id : "");
    setSelectedNode(parent);
    setFormError(null);

    // Initialize translations
    const initialTrans: any = {};
    LANGUAGES.forEach(l => {
      initialTrans[l.code] = { title: "", seo_description: "" };
    });
    setTranslations(initialTrans);
    setActiveLangTab("tr");

    setActiveModal("create");
  };

  // Open Edit Modal
  const openEditModal = (node: CategoryNode) => {
    setSelectedNode(node);
    setFormTitle(node.title);
    setFormIsActive(node.is_active);
    setFormParentId(node.parent_id || "");
    setFormError(null);

    // Populate translations
    const editTrans: any = {};
    LANGUAGES.forEach(l => {
      const existing = node.translations?.[l.code];
      editTrans[l.code] = {
        title: existing?.title || (l.code === "tr" ? node.title : ""),
        seo_description: existing?.seo_description || "",
      };
    });
    setTranslations(editTrans);
    setActiveLangTab("tr");

    setActiveModal("edit");
  };

  // Open Delete Modal
  const openDeleteModal = (node: CategoryNode) => {
    setSelectedNode(node);
    setFormError(null);
    setActiveModal("delete");
  };

  // Update translation field helper
  const handleTranslationChange = (langCode: string, field: "title" | "seo_description", val: string) => {
    setTranslations(prev => ({
      ...prev,
      [langCode]: {
        ...prev[langCode],
        [field]: val
      }
    }));
  };

  // Handle Save (Create/Update/Delete)
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeModal === "delete") {
      if (!selectedNode) return;
      startTransition(async () => {
        try {
          await apiRequest(`/api/v1/categories/${selectedNode.id}`, "DELETE");
          showToast(LABELS.SUCCESS_DELETED);
          setActiveModal(null);
          await onRefresh();
        } catch (err: any) {
          setFormError(err.message || "Bir hata oluştu.");
        }
      });
      return;
    }

    const trTitle = translations["tr"]?.title || formTitle;
    if (!trTitle.trim()) {
      setFormError(LABELS.REQUIRED_FIELD);
      return;
    }

    const payload = {
      parent_id: formParentId === "" ? null : formParentId,
      title: trTitle.trim(),
      is_active: formIsActive,
      translations: translations
    };

    startTransition(async () => {
      try {
        if (activeModal === "create") {
          await apiRequest("/api/v1/categories", "POST", payload);
          showToast(LABELS.SUCCESS_CREATED);
        } else if (activeModal === "edit" && selectedNode) {
          // Extra cycle prevention validation (Frontend Guard)
          if (formParentId === selectedNode.id) {
            setFormError(LABELS.ERROR_SELF_PARENT);
            return;
          }
          await apiRequest(`/api/v1/categories/${selectedNode.id}`, "PUT", payload);
          showToast(LABELS.SUCCESS_UPDATED);
        }
        setActiveModal(null);
        await onRefresh();
      } catch (err: any) {
        setFormError(err.message || "Bir hata oluştu.");
      }
    });
  };

  // Toast indicator helper
  const showToast = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => {
      setSuccessMessage(null);
    }, 4000);
  };

  // Recursive Categories Node Renderer
  const renderTreeNode = (node: CategoryNode, depth: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = !!expandedNodes.get(node.id);

    return (
      <div key={node.id} className="flex flex-col">
        {/* Row element */}
        <div 
          className={`flex items-center justify-between py-2.5 px-4 rounded-xl border border-transparent transition-all group ${
            node.is_active 
              ? "hover:bg-violet-50/40 hover:border-violet-100/60" 
              : "bg-zinc-50/50 hover:bg-zinc-100/40 opacity-80"
          }`}
          style={{ paddingLeft: `${Math.max(16, depth * 28)}px` }}
        >
          <div className="flex items-center gap-3">
            {/* Collapse Trigger Button */}
            {hasChildren ? (
              <button 
                onClick={() => toggleExpand(node.id)}
                className="p-1 rounded-md hover:bg-zinc-200/50 text-zinc-500 transition-colors"
                type="button"
              >
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
            ) : (
              <span className="w-6" /> // Placeholder for indent alignment
            )}

            {/* Folder & Title icon */}
            <span className={node.is_active ? "text-violet-600" : "text-zinc-400"}>
              {hasChildren && isExpanded ? <FolderOpen size={18} /> : <Folder size={18} />}
            </span>

            {/* Category title */}
            <span className={`font-semibold text-sm transition-colors ${
              node.is_active ? "text-zinc-800" : "text-zinc-500 line-through decoration-zinc-400"
            }`}>
              {node.title}
            </span>

            {/* Path description badge (Ltree) */}
            <span className="text-[10px] font-mono text-zinc-400 bg-zinc-100/70 px-2 py-0.5 rounded border border-zinc-200/40 hidden md:inline-block">
              {node.node_path}
            </span>

            {/* Status indicators */}
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full inline-flex ${
              node.is_active 
                ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                : "bg-zinc-100 text-zinc-600 border border-zinc-200"
            }`}>
              {node.is_active ? LABELS.ACTIVE : LABELS.PASSIVE}
            </span>
          </div>

          {/* Quick Actions (Visually gorgeous hover states) */}
          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Add child */}
            <button
              onClick={() => openCreateModal(node)}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-violet-600 hover:bg-violet-50 transition-all cursor-pointer"
              title={LABELS.ADD_CHILD}
              type="button"
            >
              <Plus size={16} />
            </button>

            {/* Edit / Rename */}
            <button
              onClick={() => openEditModal(node)}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-blue-600 hover:bg-blue-50 transition-all cursor-pointer"
              title={LABELS.EDIT}
              type="button"
            >
              <Edit3 size={16} />
            </button>

            {/* Delete */}
            <button
              onClick={() => openDeleteModal(node)}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-red-600 hover:bg-red-50 transition-all cursor-pointer"
              title={LABELS.DELETE}
              type="button"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* Render children sub-nodes recursively */}
        {hasChildren && isExpanded && (
          <div className="flex flex-col mt-0.5 border-l border-zinc-200/50 ml-6 pl-1 gap-0.5">
            {node.children.map((child: CategoryNode) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Get eligible parent categories to prevent loops (filtering out current node and its kids)
  const getEligibleParents = () => {
    if (!selectedNode) return flatCategories;
    return flatCategories.filter((cat: any) => {
      if (cat.id === selectedNode.id) return false;
      // If parent has a path starting with selectedNode path, it's a child. Prevent loop
      if (cat.node_path.startsWith(selectedNode.node_path + ".")) return false;
      return true;
    });
  };

  const getSubmitButtonLabel = () => {
    if (isPending) return LABELS.SUBMITTING;
    if (activeModal === "delete") return LABELS.DELETE;
    return LABELS.SAVE;
  };

  return (
    <div className="glass-card bg-white rounded-3xl border border-zinc-200/50 p-6 flex flex-col gap-6 shadow-sm">
      
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-100 pb-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-900">{LABELS.TITLE}</h2>
          <p className="text-sm text-zinc-500 mt-1">{LABELS.DESCRIPTION}</p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Refresh button */}
          <button
            onClick={() => {
              startTransition(async () => {
                await onRefresh();
              });
            }}
            disabled={isPending}
            className="p-2.5 border border-zinc-200 rounded-xl hover:bg-zinc-50 text-zinc-600 transition-colors bg-white shadow-sm flex items-center justify-center gap-1.5 text-sm font-semibold cursor-pointer"
            type="button"
          >
            <RefreshCw size={15} className={isPending ? "animate-spin" : ""} />
            {LABELS.REFRESH}
          </button>

          {/* Add top level Category */}
          <button
            onClick={() => openCreateModal(null)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-semibold text-sm shadow-md hover:shadow-lg hover:shadow-violet-600/10 transition-all cursor-pointer border-none"
            type="button"
          >
            <FolderPlus size={16} />
            {LABELS.ADD_ROOT}
          </button>
        </div>
      </div>

      {/* Success notification popup */}
      {successMessage && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl animate-in fade-in slide-in-from-top-4 duration-300">
          <CheckCircle size={18} className="text-emerald-600 shrink-0" />
          <span className="text-sm font-semibold">{successMessage}</span>
        </div>
      )}

      {/* Categories tree layout container */}
      <div className="flex flex-col gap-2 min-h-[300px]">
        {categories.length > 0 ? (
          <div className="flex flex-col gap-1">
            {categories.map(rootCat => renderTreeNode(rootCat, 0))}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-zinc-200 rounded-2xl py-16 text-center">
            <Folder size={40} className="text-zinc-300 mb-3" />
            <p className="text-zinc-500 text-sm max-w-xs">{LABELS.NO_CATEGORIES}</p>
            <button
              onClick={() => openCreateModal(null)}
              className="mt-4 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-lg shadow transition-colors cursor-pointer border-none"
              type="button"
            >
              {LABELS.ADD_ROOT}
            </button>
          </div>
        )}
      </div>

      {/* -------------------- DYNAMIC FORMS & OVERLAYS -------------------- */}

      {/* Modal Backdrop Container */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          
          <div className="bg-white rounded-3xl border border-zinc-100 max-w-lg w-full overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100 bg-zinc-50/50">
              <h3 className="font-bold text-lg text-zinc-900">
                {activeModal === "create" && LABELS.CREATE_TITLE}
                {activeModal === "edit" && LABELS.EDIT_TITLE}
                {activeModal === "delete" && LABELS.DELETE_CONFIRM_TITLE}
              </h3>
              <button 
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-lg hover:bg-zinc-200/50 text-zinc-400 hover:text-zinc-600 transition-colors cursor-pointer border-none"
                type="button"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} className="flex flex-col">
              
              {/* Modal Body */}
              <div className="p-6 flex flex-col gap-5 max-h-[70vh] overflow-y-auto">
                
                {/* General Alerts / Error Display */}
                {formError && (
                  <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-2xl text-xs font-semibold">
                    <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
                    <span>{formError}</span>
                  </div>
                )}

                {activeModal === "delete" ? (
                  /* Delete Confirmation UI */
                  <div className="flex flex-col gap-3">
                    <p className="text-zinc-600 text-sm leading-relaxed">{LABELS.DELETE_CONFIRM_DESC}</p>
                    <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 flex gap-3 text-xs font-medium">
                      <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block text-amber-800 mb-0.5">{LABELS.CRITICAL_ACTION}</span>
                        <span>{LABELS.DELETE_WARNING_DESC}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Create / Edit Form UI */
                  <div className="flex flex-col gap-4">
                    
                    {/* General Settings */}
                    <div className="grid grid-cols-1 gap-4">
                      {/* Parent Selector Selector (To move or set structure) */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-zinc-600 uppercase tracking-wider">{LABELS.PARENT}</label>
                        <select 
                          value={formParentId}
                          onChange={(e) => setFormParentId(e.target.value)}
                          className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl bg-zinc-50/50 hover:bg-zinc-100/50 focus:outline-none focus:border-violet-500 focus:bg-white text-sm font-semibold transition-all cursor-pointer text-zinc-700"
                          disabled={isPending}
                        >
                          <option value="">{LABELS.ROOT_LEVEL}</option>
                          {getEligibleParents().map((cat: any) => (
                            <option key={cat.id} value={cat.id}>
                              {"\u00A0".repeat(cat.depth * 2)} {cat.title}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Active Checkbox toggle */}
                      <div className="flex items-center justify-between border border-zinc-100 rounded-2xl p-4 bg-zinc-50/40 mt-1">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-bold text-zinc-800">{LABELS.STATUS}</span>
                          <span className="text-xs text-zinc-400">Ürün hiyerarşisinde görünürlüğü belirler</span>
                        </div>
                        
                        <button
                          type="button"
                          onClick={() => setFormIsActive(!formIsActive)}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none border-none ${
                            formIsActive ? "bg-violet-600" : "bg-zinc-200"
                          }`}
                          disabled={isPending}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              formIsActive ? "translate-x-5" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    <div className="h-px bg-zinc-100 my-2" />

                    {/* Multilingual Editor Area */}
                    <div className="flex flex-col gap-3">
                      <span className="text-xs font-bold text-zinc-600 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles size={14} className="text-violet-600" />
                        Çok Dilli Başlık ve SEO Açıklamaları
                      </span>

                      {/* Lang Tab buttons */}
                      <div className="flex flex-wrap border-b border-zinc-200 gap-1 pb-1">
                        {LANGUAGES.map(l => (
                          <button
                            key={l.code}
                            type="button"
                            onClick={() => setActiveLangTab(l.code)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border-none cursor-pointer ${
                              activeLangTab === l.code
                                ? "bg-violet-50 text-violet-600 font-extrabold"
                                : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50"
                            }`}
                          >
                            {l.name}
                          </button>
                        ))}
                      </div>

                      {/* Selected language fields */}
                      {LANGUAGES.map(l => {
                        if (l.code !== activeLangTab) return null;
                        const trans = translations[l.code] || { title: "", seo_description: "" };

                        return (
                          <div key={l.code} className="space-y-4 animate-in fade-in duration-200 mt-2">
                            {/* Localized Name */}
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider">
                                {l.name} Kategori Adı
                              </label>
                              <input
                                type="text"
                                value={trans.title}
                                onChange={(e) => handleTranslationChange(l.code, "title", e.target.value)}
                                className="w-full px-4 py-2 border border-zinc-200 rounded-xl focus:outline-none focus:border-violet-500 text-xs font-bold transition-all"
                                placeholder={`${l.name} başlığı...`}
                                disabled={isPending}
                                required={l.code === "tr"}
                              />
                            </div>

                            {/* Localized SEO Description */}
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider flex items-center justify-between">
                                <span>{l.name} SEO Açıklama Yazısı</span>
                                <span className="text-[9px] text-zinc-400 lowercase font-medium italic">sayfa en altında gösterilir (300-400 kelime önerilir)</span>
                              </label>
                              <textarea
                                value={trans.seo_description}
                                onChange={(e) => handleTranslationChange(l.code, "seo_description", e.target.value)}
                                rows={6}
                                className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl focus:outline-none focus:border-violet-500 text-xs font-bold transition-all leading-relaxed resize-y"
                                placeholder={`${l.name} dilinde detaylı SEO metni girin...`}
                                disabled={isPending}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                  </div>
                )}

              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-zinc-100 bg-zinc-50/50 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2.5 border border-zinc-200 rounded-xl text-sm font-semibold hover:bg-zinc-50 text-zinc-600 transition-colors bg-white shadow-sm cursor-pointer"
                  disabled={isPending}
                >
                  {LABELS.CANCEL}
                </button>
                
                <button
                  type="submit"
                  className={`px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-md transition-all cursor-pointer border-none ${
                    activeModal === "delete" 
                      ? "bg-red-600 hover:bg-red-700 shadow-red-600/10 hover:shadow-lg hover:shadow-red-600/20" 
                      : "bg-violet-600 hover:bg-violet-700 shadow-violet-600/10 hover:shadow-lg hover:shadow-violet-600/20"
                  }`}
                  disabled={isPending}
                >
                  {getSubmitButtonLabel()}
                </button>
              </div>

            </form>
          </div>

        </div>
      )}

    </div>
  );
}

