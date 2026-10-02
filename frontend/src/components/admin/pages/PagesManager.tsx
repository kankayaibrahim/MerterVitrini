"use client";

import React, { useState, useEffect, useTransition, useCallback } from "react";
import { 
  FileText, 
  Trash2, 
  Edit3, 
  Plus, 
  Check, 
  RefreshCw, 
  AlertTriangle, 
  Languages, 
  Eye, 
  ArrowLeft,
  Loader2
} from "lucide-react";
import { Page, PageTranslation, Language } from "@/types/integration";

const LABELS = {
  TITLE: "Dinamik Sayfa Yönetimi (CMS)",
  DESC: "E-ticaret sitenizin Hakkımızda, B2B Şartları, Teslimat Bilgileri gibi ek statik sayfalarını çok dilli olarak ekleyip yönetebilirsiniz.",
  CREATE_NEW: "Yeni Sayfa Ekle",
  EDIT_PAGE: "Sayfa Düzenle",
  PAGE_LIST: "Sayfa Listesi",
  NO_PAGES: "Henüz dinamik bir sayfa eklenmemiş.",
  REFRESH: "Yenile",
  SUCCESS_CREATED: "Yeni sayfa başarıyla oluşturuldu.",
  SUCCESS_UPDATED: "Sayfa başarıyla güncellendi.",
  SUCCESS_DELETED: "Sayfa başarıyla silindi.",
  REQUIRED_FIELDS: "Lütfen gerekli alanları doldurunuz.",
  FIELD_SLUG: "SEO URL (Slug) - Benzersiz olmalıdır",
  FIELD_ACTIVE: "Sayfa Durumu (Aktif/Pasif)",
  FIELD_TITLE: "Sayfa Başlığı",
  FIELD_CONTENT: "Sayfa İçeriği (Markdown formatı desteklenir)",
  FIELD_META_TITLE: "Meta SEO Başlığı (Opsiyonel)",
  FIELD_META_DESC: "Meta SEO Açıklaması (Opsiyonel)",
  SLUG_HINT: "Sadece küçük harf, rakam ve tire (-) içerebilir.",
  BTN_SAVE: "Kaydet",
  BTN_CANCEL: "Vazgeç",
  BTN_DELETE: "Sil",
  BTN_EDIT: "Düzenle",
  LANG_TAB_INFO: "Lütfen dile ait içerikleri girin:"
};

interface PagesManagerProps {
  readonly apiUrl: string;
  readonly token: string | null;
}

function getSlugInputClass(isSlugUnique: boolean | null): string {
  if (isSlugUnique === true) {
    return "border-emerald-200 focus:border-emerald-500 focus:ring-emerald-500/10";
  }
  if (isSlugUnique === false) {
    return "border-red-200 focus:border-red-500 focus:ring-red-500/10";
  }
  return "border-zinc-200 focus:border-violet-500 focus:ring-violet-500/10";
}

function renderSlugStatusIcon(isCheckingSlug: boolean, isSlugUnique: boolean | null) {
  if (isCheckingSlug) {
    return <Loader2 size={16} className="animate-spin text-zinc-400" />;
  }
  if (isSlugUnique === true) {
    return <Check size={16} className="text-emerald-500 font-extrabold" />;
  }
  if (isSlugUnique === false) {
    return <AlertTriangle size={16} className="text-red-500" />;
  }
  return null;
}

interface PagesTableViewProps {
  readonly pages: readonly Page[];
  readonly activeLangs: readonly Language[];
  readonly onOpenCreateForm: () => void;
  readonly onOpenEditForm: (page: Page) => void;
  readonly onDeletePage: (id: string, slug: string) => void;
  readonly onRefresh: () => void;
  readonly isPending: boolean;
}

function PagesTableView({
  pages,
  activeLangs,
  onOpenCreateForm,
  onOpenEditForm,
  onDeletePage,
  onRefresh,
  isPending
}: Readonly<PagesTableViewProps>) {
  return (
    <div className="bg-white border border-zinc-200/50 rounded-3xl shadow-sm overflow-hidden flex flex-col">
      <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/50 px-6 py-4 flex-wrap gap-4">
        <div>
          <h2 className="text-base font-extrabold text-zinc-900 flex items-center gap-2">
            <FileText size={18} className="text-violet-600" />
            {LABELS.PAGE_LIST}
          </h2>
          <span className="text-xs text-zinc-400 font-semibold">
            Toplam {pages.length} dinamik sayfa kayıtlı
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isPending}
            className="p-2 border border-zinc-200 hover:bg-zinc-100 rounded-xl text-zinc-600 transition-colors cursor-pointer"
            title={LABELS.REFRESH}
          >
            <RefreshCw size={15} className={isPending ? "animate-spin" : ""} />
          </button>
          <button
            type="button"
            onClick={onOpenCreateForm}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-md hover:shadow-violet-600/20 cursor-pointer"
          >
            <Plus size={16} />
            {LABELS.CREATE_NEW}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-zinc-100 text-[11px] font-extrabold uppercase text-zinc-400 bg-zinc-50/30">
              <th className="py-3.5 px-6">Sayfa Başlığı</th>
              <th className="py-3.5 px-6">SEO Slug</th>
              <th className="py-3.5 px-6">Diller</th>
              <th className="py-3.5 px-6">Durum</th>
              <th className="py-3.5 px-6 text-right">İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 text-xs font-semibold text-zinc-700">
            {pages.length > 0 ? (
              pages.map((page) => {
                const trTitle = page.translations?.tr?.title;
                const anyTitle = page.translations ? Object.values(page.translations)[0]?.title : "";
                const displayTitle = trTitle || anyTitle || page.slug;
                const availableLangs = page.translations ? Object.keys(page.translations) : [];

                return (
                  <tr key={page.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="py-4 px-6 font-bold text-zinc-950">
                      {displayTitle}
                    </td>
                    <td className="py-4 px-6 font-mono text-zinc-500">
                      /{page.slug}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex gap-1 flex-wrap">
                        {availableLangs.map((lang) => {
                          const matchLang = activeLangs.find(l => l.code === lang);
                          return (
                            <span 
                              key={lang} 
                              className="inline-flex items-center px-1.5 py-0.5 bg-zinc-100 text-[10px] rounded border border-zinc-200 font-extrabold uppercase text-zinc-600"
                              title={matchLang?.label || lang}
                            >
                              {matchLang?.flag || "🌐"} {lang}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      {page.is_active ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 border border-emerald-200 text-emerald-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>AKTİF</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-zinc-50 border border-zinc-200 text-zinc-400">
                          <span>PASİF</span>
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={`https://mertervitrini.com.tr/tr/pages/${page.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 border border-zinc-200 hover:bg-zinc-100 rounded-lg text-zinc-500 hover:text-zinc-950 transition-colors"
                          title="Storefront Önizlemesi"
                        >
                          <Eye size={14} />
                        </a>
                        <button
                          type="button"
                          onClick={() => onOpenEditForm(page)}
                          className="p-1.5 border border-zinc-200 hover:bg-zinc-100 rounded-lg text-zinc-600 hover:text-zinc-950 transition-colors cursor-pointer"
                          title={LABELS.BTN_EDIT}
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeletePage(page.id, page.slug)}
                          className="p-1.5 border border-red-100 bg-red-50/50 hover:bg-red-50 rounded-lg text-red-500 hover:text-red-700 transition-colors cursor-pointer"
                          title={LABELS.BTN_DELETE}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="py-12 text-center text-zinc-400 font-medium italic">
                  <FileText className="mx-auto text-zinc-300 mb-2 animate-bounce" size={40} />
                  {LABELS.NO_PAGES}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface PageFormWorkspaceProps {
  readonly pageId: string | null;
  readonly slug: string;
  readonly onSlugChange: (val: string) => void;
  readonly isSlugUnique: boolean | null;
  readonly isCheckingSlug: boolean;
  readonly isActive: boolean;
  readonly onToggleActive: () => void;
  readonly activeLangs: readonly Language[];
  readonly activeLangTab: string;
  readonly onSelectLangTab: (code: string) => void;
  readonly translations: Readonly<Record<string, PageTranslation>>;
  readonly onTitleChange: (langCode: string, title: string) => void;
  readonly onFieldChange: (langCode: string, field: keyof PageTranslation, val: string) => void;
  readonly editorMode: "edit" | "preview";
  readonly onSetEditorMode: (mode: "edit" | "preview") => void;
  readonly onSubmit: (e: React.FormEvent) => void;
  readonly onCancel: () => void;
  readonly isPending: boolean;
}

function PageFormWorkspace({
  pageId,
  slug,
  onSlugChange,
  isSlugUnique,
  isCheckingSlug,
  isActive,
  onToggleActive,
  activeLangs,
  activeLangTab,
  onSelectLangTab,
  translations,
  onTitleChange,
  onFieldChange,
  editorMode,
  onSetEditorMode,
  onSubmit,
  onCancel,
  isPending
}: Readonly<PageFormWorkspaceProps>) {
  return (
    <form onSubmit={onSubmit} className="bg-white border border-zinc-200/50 rounded-3xl shadow-sm overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-200">
      <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/50 px-6 py-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-zinc-900 transition-colors bg-white border border-zinc-200 px-3 py-1.5 rounded-xl cursor-pointer"
        >
          <ArrowLeft size={14} />
          {LABELS.PAGE_LIST}
        </button>
        <h3 className="text-sm font-extrabold text-zinc-800 uppercase tracking-wider flex items-center gap-2">
          <Edit3 size={16} className="text-violet-600" />
          {pageId ? LABELS.EDIT_PAGE : LABELS.CREATE_NEW}
        </h3>
      </div>

      <div className="p-6 flex flex-col gap-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 flex flex-col gap-1.5">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
              {LABELS.FIELD_SLUG}
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-4 text-xs font-bold font-mono text-zinc-400">
                /pages/
              </span>
              <input
                type="text"
                value={slug}
                onChange={(e) => onSlugChange(e.target.value)}
                className={`pl-16 pr-10 py-2.5 w-full rounded-xl border text-sm font-semibold focus:outline-none focus:ring-2 transition-all ${getSlugInputClass(isSlugUnique)}`}
                placeholder="hakkimizda"
                required
              />
              <div className="absolute right-3">
                {renderSlugStatusIcon(isCheckingSlug, isSlugUnique)}
              </div>
            </div>
            <p className="text-[10px] text-zinc-400 font-bold pl-1">{LABELS.SLUG_HINT}</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
              {LABELS.FIELD_ACTIVE}
            </label>
            <div className="flex items-center gap-3 py-1">
              <button
                type="button"
                onClick={onToggleActive}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isActive ? "bg-violet-600" : "bg-zinc-200"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isActive ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
              <span className="text-xs font-bold text-zinc-600">
                {isActive ? "Sitede Aktif" : "Pasif Taslak"}
              </span>
            </div>
          </div>
        </div>

        <hr className="border-zinc-100" />

        <div className="bg-zinc-50/40 border border-zinc-200/50 rounded-3xl p-5 flex flex-col gap-5">
          <div className="flex items-center justify-between border-b border-zinc-200/60 pb-3 flex-wrap gap-4">
            <span className="text-xs font-extrabold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
              <Languages size={15} className="text-violet-500" />
              {LABELS.LANG_TAB_INFO}
            </span>

            <div className="flex gap-1.5 flex-wrap">
              {activeLangs.map((lang: Language) => {
                const hasTitle = (translations[lang.code]?.title || "").trim().length > 0;
                
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => onSelectLangTab(lang.code)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer transition-all border ${
                      activeLangTab === lang.code
                        ? "bg-violet-600 border-violet-600 text-white shadow-sm"
                        : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                    }`}
                  >
                    <span>{lang.flag}</span>
                    <span className="uppercase">{lang.code}</span>
                    {hasTitle && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {activeLangs.map((lang: Language) => {
            if (lang.code !== activeLangTab) return null;
            const data = translations[lang.code] || { title: "", content: "", meta_title: "", meta_description: "" };

            return (
              <div key={lang.code} className="flex flex-col gap-4 animate-in fade-in duration-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                      {LABELS.FIELD_TITLE} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={data.title}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => onTitleChange(lang.code, e.target.value)}
                      className="px-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-semibold focus:outline-none focus:border-violet-500"
                      placeholder={`${lang.label} sayfa başlığı giriniz`}
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                      {LABELS.FIELD_META_TITLE}
                    </label>
                    <input
                      type="text"
                      value={data.meta_title || ""}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => onFieldChange(lang.code, "meta_title", e.target.value)}
                      className="px-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-semibold focus:outline-none focus:border-violet-500"
                      placeholder={`Örn: Hakkımızda - ${lang.label} SEO Alternatifi`}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                    {LABELS.FIELD_META_DESC}
                  </label>
                  <textarea
                    value={data.meta_description || ""}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onFieldChange(lang.code, "meta_description", e.target.value)}
                    rows={2}
                    className="px-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-semibold focus:outline-none focus:border-violet-500"
                    placeholder="Google arama sonuçlarında çıkacak kısa açıklama"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between border-b border-zinc-200/50 pb-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                      {LABELS.FIELD_CONTENT} <span className="text-red-500">*</span>
                    </label>
                    
                    <div className="flex border border-zinc-200 rounded-lg overflow-hidden text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => onSetEditorMode("edit")}
                        className={`px-3 py-1 cursor-pointer transition-colors ${
                          editorMode === "edit" ? "bg-violet-600 text-white" : "bg-white text-zinc-600 hover:bg-zinc-50"
                        }`}
                      >
                        Metin Düzenle
                      </button>
                      <button
                        type="button"
                        onClick={() => onSetEditorMode("preview")}
                        className={`px-3 py-1 cursor-pointer transition-colors ${
                          editorMode === "preview" ? "bg-violet-600 text-white" : "bg-white text-zinc-600 hover:bg-zinc-50"
                        }`}
                      >
                        Önizleme
                      </button>
                    </div>
                  </div>

                  {editorMode === "edit" ? (
                    <textarea
                      value={data.content}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onFieldChange(lang.code, "content", e.target.value)}
                      rows={12}
                      className="px-4 py-3 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:border-violet-500 font-mono"
                      placeholder={`# ${data.title || 'Başlık'} \n\nBuraya ${lang.label} sayfa içeriğini Markdown biçiminde yazınız.`}
                      required
                    />
                  ) : (
                    <div className="border border-zinc-200 rounded-xl p-6 min-h-[288px] bg-zinc-50/20 overflow-y-auto max-h-[400px]">
                      <article className="prose prose-zinc max-w-none text-zinc-700 text-sm leading-relaxed whitespace-pre-wrap">
                        {data.content ? data.content : <span className="italic text-zinc-400 font-medium">Sayfa içeriği henüz boş.</span>}
                      </article>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-6 py-4 border-t border-zinc-100 bg-zinc-50/50 flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-zinc-200 text-zinc-600 hover:bg-zinc-100 text-xs font-bold rounded-xl transition-colors cursor-pointer"
        >
          {LABELS.BTN_CANCEL}
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
  );
}

export default function PagesManager({ apiUrl, token }: Readonly<PagesManagerProps>) {
  const [isPending, startTransition] = useTransition();
  const [pages, setPages] = useState<Page[]>([]);
  const [activeLangs, setActiveLangs] = useState<Language[]>([]);
  
  // View states
  const [view, setView] = useState<"list" | "form">("list");
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form states
  const [pageId, setPageId] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [translations, setTranslations] = useState<Record<string, PageTranslation>>({});
  
  // Active editing lang tab
  const [activeLangTab, setActiveLangTab] = useState<string>("tr");
  
  // Editor tab mode
  const [editorMode, setEditorMode] = useState<"edit" | "preview">("edit");

  // Slug checking states
  const [isCheckingSlug, setIsCheckingSlug] = useState(false);
  const [isSlugUnique, setIsSlugUnique] = useState<boolean | null>(null);

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

    if (response.status === 204) return null;
    return response.json();
  }, [apiUrl, token]);

  const showToast = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => {
      setSuccessMessage(null);
    }, 4000);
  };

  // Slug Generator (Slugify)
  const slugify = (text: string) => {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[ğĞ]/g, 'g')
      .replace(/[üÜ]/g, 'u')
      .replace(/[şŞ]/g, 's')
      .replace(/[ıİI]/g, 'i')
      .replace(/[öÖ]/g, 'o')
      .replace(/[çÇ]/g, 'c')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/--+/g, '-');
  };

  // Load pages list
  const loadPages = useCallback(async () => {
    try {
      const data = await apiRequest("/api/v1/pages", "GET");
      setPages(data || []);
    } catch (err: unknown) {
      console.error("Failed to load pages:", err);
    }
  }, [apiRequest]);

  useEffect(() => {
    let isMounted = true;
    if (!token) return;

    const fetchInitialData = async () => {
      try {
        const [pagesData, langsData] = await Promise.all([
          apiRequest("/api/v1/pages", "GET"),
          apiRequest("/api/v1/languages", "GET")
        ]);

        if (isMounted) {
          setPages(pagesData || []);

          if (langsData && Array.isArray(langsData) && langsData.length > 0) {
            const formattedLangs = langsData
              .filter((l: Language) => l.isActive)
              .map((l: Language) => {
                let code = l.code;
                if (code.startsWith("en_")) code = "en";
                else if (code.startsWith("tr_")) code = "tr";
                else if (code.startsWith("pl_")) code = "pl";
                else if (code.startsWith("bg_")) code = "bg";
                else if (code.startsWith("de_")) code = "de";
                else if (code.startsWith("fr_")) code = "fr";
                else if (code.startsWith("ru_")) code = "ru";
                else if (code.startsWith("ar_")) code = "ar";
                return { ...l, code };
              });
            setActiveLangs(formattedLangs);
            const hasTr = formattedLangs.some((l: Language) => l.code === "tr");
            if (hasTr) setActiveLangTab("tr");
            else if (formattedLangs.length > 0) setActiveLangTab(formattedLangs[0].code);
          }
        }
      } catch (err: unknown) {
        console.error("Failed to load initial page data:", err);
      }
    };

    void fetchInitialData();

    return () => {
      isMounted = false;
    };
  }, [token, apiRequest]);

  // Handle Slug Uniqueness Verification on edit/input
  useEffect(() => {
    const clean = slug.trim();
    if (!clean) return;
    
    // Only check if it satisfies standard slug formatting
    const isFormatValid = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(clean);

    const delayDebounceFn = setTimeout(async () => {
      if (!isFormatValid) {
        setIsSlugUnique(false);
        return;
      }

      setIsCheckingSlug(true);
      try {
        const excludeParam = pageId ? `&exclude_id=${encodeURIComponent(pageId)}` : "";
        const query = `/api/v1/pages/check-slug?slug=${encodeURIComponent(clean)}${excludeParam}`;
        const data = await apiRequest(query, "GET");
        setIsSlugUnique(data.unique);
      } catch (err: unknown) {
        console.error("Failed to verify slug:", err);
        setIsSlugUnique(null);
      } finally {
        setIsCheckingSlug(false);
      }
    }, 450);

    return () => clearTimeout(delayDebounceFn);
  }, [slug, pageId, apiRequest]);

  const handleSlugChange = (newSlug: string) => {
    setSlug(newSlug);
    if (!newSlug.trim()) {
      setIsSlugUnique(null);
    }
  };

  const handleRefresh = () => {
    startTransition(async () => {
      await loadPages();
    });
  };

  // Open Form for Adding New Page
  const handleOpenCreateForm = () => {
    setPageId(null);
    setSlug("");
    setIsActive(true);
    setFormError(null);
    setIsSlugUnique(null);
    
    const initialTrans: Record<string, PageTranslation> = {};
    activeLangs.forEach((l: Language) => {
      initialTrans[l.code] = {
        title: "",
        content: "",
        meta_title: "",
        meta_description: ""
      };
    });
    setTranslations(initialTrans);
    
    const hasTr = activeLangs.some((l: Language) => l.code === "tr");
    if (hasTr) setActiveLangTab("tr");
    else if (activeLangs.length > 0) setActiveLangTab(activeLangs[0].code);

    setEditorMode("edit");
    setView("form");
  };

  // Open Form for Editing Page
  const handleOpenEditForm = (page: Page) => {
    setPageId(page.id);
    setSlug(page.slug);
    setIsActive(page.is_active);
    setFormError(null);
    setIsSlugUnique(true);

    const initialTrans: Record<string, PageTranslation> = {};
    activeLangs.forEach((l: Language) => {
      const existing = page.translations[l.code];
      initialTrans[l.code] = {
        title: existing?.title || "",
        content: existing?.content || "",
        meta_title: existing?.meta_title || "",
        meta_description: existing?.meta_description || ""
      };
    });
    setTranslations(initialTrans);

    const hasTr = activeLangs.some((l: Language) => l.code === "tr");
    if (hasTr) setActiveLangTab("tr");
    else if (activeLangs.length > 0) setActiveLangTab(activeLangs[0].code);

    setEditorMode("edit");
    setView("form");
  };

  // Auto slugify when title changes in primary languages (TR or EN)
  const handleTitleChange = (langCode: string, newTitle: string) => {
    const updated = {
      ...translations,
      [langCode]: {
        ...translations[langCode],
        title: newTitle
      }
    };
    setTranslations(updated);

    if (!pageId && (langCode === "tr" || langCode === "en")) {
      setSlug(slugify(newTitle));
    }
  };

  const handleFieldChange = (langCode: string, field: keyof PageTranslation, value: string) => {
    setTranslations({
      ...translations,
      [langCode]: {
        ...translations[langCode],
        [field]: value
      }
    });
  };

  // Form Submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanSlug = slug.trim().toLowerCase();
    if (!cleanSlug) {
      setFormError("SEO URL (slug) alanı boş olamaz.");
      return;
    }

    if (isSlugUnique === false) {
      setFormError("Bu SEO URL (slug) benzersiz değil veya formatı geçersiz.");
      return;
    }

    const finalTranslations: Record<string, PageTranslation> = {};
    let hasAtLeastOne = false;

    for (const langCode in translations) {
      const t = translations[langCode];
      if (t.title.trim() && t.content.trim()) {
        finalTranslations[langCode] = {
          title: t.title.trim(),
          content: t.content.trim(),
          meta_title: t.meta_title?.trim() || "",
          meta_description: t.meta_description?.trim() || ""
        };
        hasAtLeastOne = true;
      }
    }

    if (!hasAtLeastOne) {
      setFormError("Lütfen en az bir dil için geçerli bir Başlık ve İçerik giriniz.");
      return;
    }

    const payload = {
      slug: cleanSlug,
      is_active: isActive,
      translations: finalTranslations
    };

    startTransition(async () => {
      try {
        if (pageId) {
          await apiRequest(`/api/v1/pages/${pageId}`, "PUT", payload);
          showToast(LABELS.SUCCESS_UPDATED);
        } else {
          await apiRequest("/api/v1/pages", "POST", payload);
          showToast(LABELS.SUCCESS_CREATED);
        }
        setView("list");
        await loadPages();
      } catch (err: unknown) {
        setFormError((err as Error).message || "Sayfa kaydedilirken hata oluştu.");
      }
    });
  };

  // Handle Delete Page
  const handleDeletePage = (id: string, pageSlug: string) => {
    if (!window.confirm(`'${pageSlug}' sayfayı silmek istediğinize emin misiniz?`)) {
      return;
    }

    startTransition(async () => {
      try {
        await apiRequest(`/api/v1/pages/${id}`, "DELETE");
        showToast(LABELS.SUCCESS_DELETED);
        await loadPages();
      } catch (err: unknown) {
        alert((err as Error).message || "Sayfa silinemedi.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white p-6 rounded-3xl border border-zinc-200/50 shadow-sm">
        <div>
          <h1 className="text-xl font-extrabold text-zinc-950 flex items-center gap-2">
            <FileText size={24} className="text-violet-600" />
            {LABELS.TITLE}
          </h1>
          <p className="text-xs text-zinc-500 font-semibold mt-1 max-w-2xl">
            {LABELS.DESC}
          </p>
        </div>

        {view === "list" && (
          <button
            type="button"
            onClick={handleOpenCreateForm}
            className="flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-md hover:shadow-violet-600/20 cursor-pointer shrink-0"
          >
            <Plus size={16} />
            {LABELS.CREATE_NEW}
          </button>
        )}
      </div>

      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold px-5 py-3 rounded-2xl flex items-center gap-2 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
          <Check size={16} className="text-emerald-600 shrink-0" />
          {successMessage}
        </div>
      )}

      {formError && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-xs font-bold px-5 py-3 rounded-2xl flex items-center gap-2 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
          <AlertTriangle size={16} className="text-red-600 shrink-0" />
          {formError}
        </div>
      )}

      {view === "list" ? (
        <PagesTableView
          pages={pages}
          activeLangs={activeLangs}
          onOpenCreateForm={handleOpenCreateForm}
          onOpenEditForm={handleOpenEditForm}
          onDeletePage={handleDeletePage}
          onRefresh={handleRefresh}
          isPending={isPending}
        />
      ) : (
        <PageFormWorkspace
          pageId={pageId}
          slug={slug}
          onSlugChange={handleSlugChange}
          isSlugUnique={isSlugUnique}
          isCheckingSlug={isCheckingSlug}
          isActive={isActive}
          onToggleActive={() => setIsActive(!isActive)}
          activeLangs={activeLangs}
          activeLangTab={activeLangTab}
          onSelectLangTab={setActiveLangTab}
          translations={translations}
          onTitleChange={handleTitleChange}
          onFieldChange={handleFieldChange}
          editorMode={editorMode}
          onSetEditorMode={setEditorMode}
          onSubmit={handleSubmit}
          onCancel={() => setView("list")}
          isPending={isPending}
        />
      )}
    </div>
  );
}
