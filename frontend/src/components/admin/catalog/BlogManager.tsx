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
  Loader2,
  Image as ImageIcon
} from "lucide-react";
import { Language } from "@/types/integration";

const LABELS = {
  TITLE: "Blog Yazıları Yönetimi",
  DESC: "E-ticaret sitenizde yayınlanacak blog içeriklerini, makaleleri ve duyuruları çok dilli olarak ekleyip yönetebilirsiniz.",
  CREATE_NEW: "Yeni Yazı Ekle",
  EDIT_POST: "Blog Yazısını Düzenle",
  POST_LIST: "Blog Yazıları",
  NO_POSTS: "Henüz blog yazısı eklenmemiş.",
  REFRESH: "Yenile",
  SUCCESS_CREATED: "Yeni blog yazısı başarıyla oluşturuldu.",
  SUCCESS_UPDATED: "Blog yazısı başarıyla güncellendi.",
  SUCCESS_DELETED: "Blog yazısı başarıyla silindi.",
  REQUIRED_FIELDS: "Lütfen gerekli alanları doldurunuz.",
  FIELD_SLUG: "SEO URL (Slug) - Benzersiz olmalıdır",
  FIELD_COVER: "Kapak Görseli URL adresi (Opsiyonel)",
  FIELD_ACTIVE: "Yayın Durumu (Aktif/Pasif)",
  FIELD_TITLE: "Blog Başlığı",
  FIELD_SUMMARY: "Kısa Özet (Giriş Metni)",
  FIELD_CONTENT: "Blog Yazısı İçeriği (Markdown formatı desteklenir)",
  FIELD_META_TITLE: "Meta SEO Başlığı (Opsiyonel)",
  FIELD_META_DESC: "Meta SEO Açıklaması (Opsiyonel)",
  SLUG_HINT: "Sadece küçük harf, rakam ve tire (-) içerebilir.",
  BTN_SAVE: "Kaydet",
  BTN_CANCEL: "Vazgeç",
  BTN_DELETE: "Sil",
  BTN_EDIT: "Düzenle",
  LANG_TAB_INFO: "Lütfen dile ait içerikleri girin:"
};

export interface BlogPostTranslation {
  title: string;
  summary?: string;
  content: string;
  meta_title?: string;
  meta_description?: string;
}

export interface BlogPost {
  id: string;
  slug: string;
  cover_image?: string;
  is_active: boolean;
  translations: Record<string, BlogPostTranslation>;
  created_at: string;
  updated_at: string;
}

interface BlogManagerProps {
  readonly apiUrl: string;
  readonly token: string | null;
}

function normalizeLanguageCode(code: string): string {
  const prefix = code.split('_')[0].toLowerCase();
  const known = ["en", "tr", "pl", "bg", "de", "fr", "ru", "ar"];
  return known.includes(prefix) ? prefix : code;
}

function getSlugBorderClass(isSlugUnique: boolean | null): string {
  if (isSlugUnique === true) {
    return "border-emerald-200 focus:border-emerald-500 focus:ring-emerald-500/10";
  }
  if (isSlugUnique === false) {
    return "border-red-200 focus:border-red-500 focus:ring-red-500/10";
  }
  return "border-zinc-200 focus:border-violet-500 focus:ring-violet-500/10";
}

function renderSlugStatusIcon(isCheckingSlug: boolean, isSlugUnique: boolean | null): React.ReactNode {
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

function getPostDisplayTitle(post: BlogPost): string {
  if (post.translations["tr"]?.title) {
    return post.translations["tr"].title;
  }
  const keys = Object.keys(post.translations);
  if (keys.length > 0 && post.translations[keys[0]]?.title) {
    return post.translations[keys[0]].title;
  }
  return "Başlıksız";
}

interface BlogTableProps {
  readonly posts: readonly BlogPost[];
  readonly activeLangs: readonly Language[];
  readonly onEdit: (post: BlogPost) => void;
  readonly onDelete: (id: string, slugName: string) => void;
}

function BlogTable({ posts, activeLangs, onEdit, onDelete }: Readonly<BlogTableProps>) {
  return (
    <div className="bg-white border border-zinc-200/50 rounded-3xl shadow-sm overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-50/70 border-b border-zinc-200/50 text-[10px] uppercase tracking-wider font-extrabold text-zinc-500">
              <th className="py-4 px-6">Görsel</th>
              <th className="py-4 px-6">Blog URL (Slug)</th>
              <th className="py-4 px-6">TR Başlık</th>
              <th className="py-4 px-6">Çeviriler</th>
              <th className="py-4 px-6">Durum</th>
              <th className="py-4 px-6 text-right">Eylemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 text-sm font-semibold text-zinc-700">
            {posts.length > 0 ? (
              posts.map((post: BlogPost) => {
                const trTitle = getPostDisplayTitle(post);
                const activeLangsList = Object.keys(post.translations);
                
                return (
                  <tr key={post.id} className="hover:bg-zinc-50/40 transition-colors">
                    <td className="py-4 px-6">
                      {post.cover_image ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img 
                          src={post.cover_image} 
                          alt={trTitle} 
                          className="w-12 h-8 rounded-lg object-cover border border-zinc-200" 
                        />
                      ) : (
                        <div className="w-12 h-8 rounded-lg bg-zinc-100 flex items-center justify-center border border-zinc-200 text-zinc-400">
                          <ImageIcon size={14} />
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-6 font-mono text-xs text-violet-600 font-bold">
                      /blog/{post.slug}
                    </td>
                    <td className="py-4 px-6 font-bold text-zinc-900">
                      {trTitle}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-1">
                        {activeLangsList.map((lang: string) => {
                          const matchLang = activeLangs.find((l: Language) => l.code === lang);
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
                      {post.is_active ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 border border-emerald-200 text-emerald-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>AKTİF</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-zinc-50 border border-zinc-200 text-zinc-400">
                          <span>TASLAK</span>
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={`https://mertervitrini.com.tr/tr/blog/${post.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 border border-zinc-200 hover:bg-zinc-100 rounded-lg text-zinc-500 hover:text-zinc-950 transition-colors"
                          title="Storefront Önizlemesi"
                        >
                          <Eye size={14} />
                        </a>
                        <button
                          onClick={() => onEdit(post)}
                          className="p-1.5 border border-zinc-200 hover:bg-zinc-100 rounded-lg text-zinc-600 hover:text-zinc-950 transition-colors cursor-pointer"
                          title={LABELS.BTN_EDIT}
                          type="button"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => onDelete(post.id, post.slug)}
                          className="p-1.5 border border-red-100 bg-red-50/50 hover:bg-red-50 rounded-lg text-red-500 hover:text-red-700 transition-colors cursor-pointer"
                          title={LABELS.BTN_DELETE}
                          type="button"
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
                <td colSpan={6} className="py-12 text-center text-zinc-400 font-medium italic">
                  <FileText className="mx-auto text-zinc-300 mb-2 animate-bounce" size={40} />
                  {LABELS.NO_POSTS}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function BlogManager({ apiUrl, token }: Readonly<BlogManagerProps>) {
  const [isPending, startTransition] = useTransition();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [activeLangs, setActiveLangs] = useState<Language[]>([]);
  
  // View states
  const [view, setView] = useState<"list" | "form">("list");
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form states
  const [postId, setPostId] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [translations, setTranslations] = useState<Record<string, BlogPostTranslation>>({});
  
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
      const errData = (await response.json().catch(() => ({}))) as { error?: string };
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

  // Load blog posts
  const loadPosts = useCallback(async () => {
    try {
      const data = (await apiRequest("/api/v1/blog", "GET")) as BlogPost[] | null;
      setPosts(data || []);
    } catch (err) {
      console.error("Failed to load blog posts:", err);
    }
  }, [apiRequest]);

  useEffect(() => {
    let ignore = false;
    if (token) {
      apiRequest("/api/v1/blog", "GET")
        .then((data) => {
          if (!ignore) setPosts((data as BlogPost[]) || []);
        })
        .catch((err) => console.error("Failed to load blog posts:", err));

      apiRequest("/api/v1/languages", "GET")
        .then((data) => {
          const langList = data as Language[] | null;
          if (ignore || !langList || langList.length === 0) return;
          const formattedLangs = langList
            .filter((l) => l.isActive)
            .map((l) => ({ ...l, code: normalizeLanguageCode(l.code) }));
          setActiveLangs(formattedLangs);
          const hasTr = formattedLangs.some((l) => l.code === "tr");
          if (hasTr) setActiveLangTab("tr");
          else if (formattedLangs.length > 0) setActiveLangTab(formattedLangs[0].code);
        })
        .catch((err) => console.error("Failed to load languages:", err));
    }
    return () => {
      ignore = true;
    };
  }, [token, apiRequest]);

  // Handle Slug Uniqueness Verification on edit/input
  useEffect(() => {
    const trimmed = slug.trim();
    if (!trimmed) {
      return;
    }
    
    const isFormatValid = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trimmed);
    if (!isFormatValid) {
      const timer = setTimeout(() => setIsSlugUnique(false), 0);
      return () => clearTimeout(timer);
    }

    const delayDebounceFn = setTimeout(() => {
      setIsCheckingSlug(true);
      const excludeParam = postId ? `&exclude_id=${postId}` : "";
      const query = `/api/v1/blog/check-slug?slug=${encodeURIComponent(trimmed)}${excludeParam}`;
      apiRequest(query, "GET")
        .then((data) => {
          const res = data as { unique: boolean };
          setIsSlugUnique(res.unique);
        })
        .catch((err) => {
          console.error("Failed to verify slug:", err);
          setIsSlugUnique(null);
        })
        .finally(() => {
          setIsCheckingSlug(false);
        });
    }, 450);

    return () => clearTimeout(delayDebounceFn);
  }, [slug, postId, apiRequest]);

  const handleRefresh = () => {
    startTransition(async () => {
      await loadPosts();
    });
  };

  // Open Form for Adding New Post
  const handleOpenCreateForm = () => {
    setPostId(null);
    setSlug("");
    setCoverImage("");
    setIsActive(true);
    setFormError(null);
    setIsSlugUnique(null);
    
    const initialTrans: Record<string, BlogPostTranslation> = {};
    activeLangs.forEach((l: Language) => {
      initialTrans[l.code] = {
        title: "",
        summary: "",
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

  // Open Form for Editing Post
  const handleOpenEditForm = (post: BlogPost) => {
    setPostId(post.id);
    setSlug(post.slug);
    setCoverImage(post.cover_image || "");
    setIsActive(post.is_active);
    setFormError(null);
    setIsSlugUnique(true);

    const initialTrans: Record<string, BlogPostTranslation> = {};
    activeLangs.forEach((l: Language) => {
      const existing = post.translations[l.code];
      initialTrans[l.code] = {
        title: existing?.title || "",
        summary: existing?.summary || "",
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

  const handleTitleChange = (langCode: string, newTitle: string) => {
    const updated = {
      ...translations,
      [langCode]: {
        ...translations[langCode],
        title: newTitle
      }
    };
    setTranslations(updated);

    if (!postId && (langCode === "tr" || langCode === "en")) {
      const generatedSlug = slugify(newTitle);
      setSlug(generatedSlug);
      if (!generatedSlug) {
        setIsSlugUnique(null);
      }
    }
  };

  const handleFieldChange = (langCode: string, field: keyof BlogPostTranslation, value: string) => {
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

    const finalTranslations: Record<string, BlogPostTranslation> = {};
    let hasAtLeastOne = false;

    for (const langCode in translations) {
      const t = translations[langCode];
      if (t.title.trim() && t.content.trim()) {
        finalTranslations[langCode] = {
          title: t.title.trim(),
          summary: t.summary?.trim() || undefined,
          content: t.content.trim(),
          meta_title: t.meta_title?.trim() || undefined,
          meta_description: t.meta_description?.trim() || undefined
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
      cover_image: coverImage.trim() || null,
      is_active: isActive,
      translations: finalTranslations
    };

    startTransition(async () => {
      try {
        if (postId) {
          await apiRequest(`/api/v1/blog/${postId}`, "PUT", payload);
          showToast(LABELS.SUCCESS_UPDATED);
        } else {
          await apiRequest("/api/v1/blog", "POST", payload);
          showToast(LABELS.SUCCESS_CREATED);
        }
        setView("list");
        await loadPosts();
      } catch (err: unknown) {
        setFormError((err as Error).message || "Blog yazısı kaydedilirken hata oluştu.");
      }
    });
  };

  // Handle Delete Post
  const handleDeletePost = (id: string, slugName: string) => {
    if (!confirm(`"${slugName}" yazısını silmek istediğinize emin misiniz?`)) {
      return;
    }

    startTransition(async () => {
      try {
        await apiRequest(`/api/v1/blog/${id}`, "DELETE");
        showToast(LABELS.SUCCESS_DELETED);
        await loadPosts();
      } catch (err: unknown) {
        alert((err as Error).message || "Silme işlemi başarısız.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in duration-200 text-zinc-800">
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

          {view === "list" && (
            <button
              onClick={handleOpenCreateForm}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-semibold text-sm shadow-md hover:shadow-lg hover:shadow-violet-600/10 transition-all cursor-pointer"
              type="button"
            >
              <Plus size={16} />
              {LABELS.CREATE_NEW}
            </button>
          )}
        </div>
      </div>

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

      {view === "list" ? (
        <BlogTable 
          posts={posts} 
          activeLangs={activeLangs} 
          onEdit={handleOpenEditForm} 
          onDelete={handleDeletePost} 
        />
      ) : (
        /* VIEW: FORM WORKSPACE */
        <form onSubmit={handleSubmit} className="bg-white border border-zinc-200/50 rounded-3xl shadow-sm overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/50 px-6 py-4">
            <button
              type="button"
              onClick={() => setView("list")}
              className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-zinc-900 transition-colors bg-white border border-zinc-200 px-3 py-1.5 rounded-xl cursor-pointer"
            >
              <ArrowLeft size={14} />
              {LABELS.POST_LIST}
            </button>
            <h3 className="text-sm font-extrabold text-zinc-800 uppercase tracking-wider flex items-center gap-2">
              <Edit3 size={16} className="text-violet-600 animate-spin" />
              {postId ? LABELS.EDIT_POST : LABELS.CREATE_NEW}
            </h3>
          </div>

          <div className="p-6 flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Slug Input */}
              <div className="md:col-span-2 flex flex-col gap-1.5">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  {LABELS.FIELD_SLUG}
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-4 text-xs font-bold font-mono text-zinc-400">
                    /blog/
                  </span>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => {
                      setSlug(e.target.value);
                      if (!e.target.value.trim()) {
                        setIsSlugUnique(null);
                      }
                    }}
                    className={`pl-14 pr-10 py-2.5 w-full rounded-xl border text-sm font-semibold focus:outline-none focus:ring-2 transition-all ${getSlugBorderClass(isSlugUnique)}`}
                    placeholder="yeni-sezon-trendleri"
                    required
                  />
                  <div className="absolute right-3">
                    {renderSlugStatusIcon(isCheckingSlug, isSlugUnique)}
                  </div>
                </div>
                <p className="text-[10px] text-zinc-400 font-bold pl-1">{LABELS.SLUG_HINT}</p>
              </div>

              {/* Is Active Status Switch */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  {LABELS.FIELD_ACTIVE}
                </label>
                <div className="flex items-center gap-3 py-1">
                  <button
                    type="button"
                    onClick={() => setIsActive(!isActive)}
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
                    {isActive ? "Sitede Yayında" : "Pasif / Taslak"}
                  </span>
                </div>
              </div>
            </div>

            {/* Cover Image Input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                {LABELS.FIELD_COVER}
              </label>
              <input
                type="text"
                value={coverImage}
                onChange={(e) => setCoverImage(e.target.value)}
                className="px-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-semibold focus:outline-none focus:border-violet-500"
                placeholder="https://example.com/images/blog-cover.jpg veya /uploads/cache/..."
              />
            </div>

            <hr className="border-zinc-100" />

            {/* Translation Tabs Box */}
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
                        onClick={() => setActiveLangTab(lang.code)}
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
                const data = translations[lang.code] || { title: "", summary: "", content: "", meta_title: "", meta_description: "" };

                return (
                  <div key={lang.code} className="flex flex-col gap-4 animate-in fade-in duration-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Title */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                          {LABELS.FIELD_TITLE} <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={data.title}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleTitleChange(lang.code, e.target.value)}
                          className="px-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-semibold focus:outline-none focus:border-violet-500"
                          placeholder={`${lang.label} başlık giriniz`}
                          required
                        />
                      </div>

                      {/* Meta SEO Title */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                          {LABELS.FIELD_META_TITLE}
                        </label>
                        <input
                          type="text"
                          value={data.meta_title || ""}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFieldChange(lang.code, "meta_title", e.target.value)}
                          className="px-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-semibold focus:outline-none focus:border-violet-500"
                          placeholder="Arama motoru başlığı (Opsiyonel)"
                        />
                      </div>
                    </div>

                    {/* Summary */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                        {LABELS.FIELD_SUMMARY}
                      </label>
                      <textarea
                        value={data.summary || ""}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleFieldChange(lang.code, "summary", e.target.value)}
                        rows={2}
                        className="px-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-semibold focus:outline-none focus:border-violet-500"
                        placeholder="Blog listelemesinde görünecek kısa giriş metni"
                      />
                    </div>

                    {/* Meta SEO Description */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                        {LABELS.FIELD_META_DESC}
                      </label>
                      <textarea
                        value={data.meta_description || ""}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleFieldChange(lang.code, "meta_description", e.target.value)}
                        rows={2}
                        className="px-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-semibold focus:outline-none focus:border-violet-500"
                        placeholder="Arama sonuçlarında çıkacak kısa açıklama"
                      />
                    </div>

                    {/* Content Editor */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between border-b border-zinc-200/50 pb-1">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                          {LABELS.FIELD_CONTENT} <span className="text-red-500">*</span>
                        </label>
                        
                        <div className="flex border border-zinc-200 rounded-lg overflow-hidden text-[10px] font-bold">
                          <button
                            type="button"
                            onClick={() => setEditorMode("edit")}
                            className={`px-3 py-1 cursor-pointer transition-colors ${
                              editorMode === "edit" ? "bg-violet-600 text-white" : "bg-white text-zinc-600 hover:bg-zinc-50"
                            }`}
                          >
                            Metin Düzenle
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditorMode("preview")}
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
                          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleFieldChange(lang.code, "content", e.target.value)}
                          rows={12}
                          className="px-4 py-3 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:border-violet-500 font-mono"
                          placeholder={`# ${data.title || 'Başlık'} \n\nBuraya ${lang.label} yazı içeriğini Markdown biçiminde yazınız.`}
                          required
                        />
                      ) : (
                        <div className="border border-zinc-200 rounded-xl p-6 min-h-[288px] bg-zinc-50/20 overflow-y-auto max-h-[400px]">
                          <article className="prose prose-zinc max-w-none text-zinc-700 text-sm leading-relaxed whitespace-pre-wrap">
                            {data.content ? data.content : <span className="italic text-zinc-400 font-medium">Blog içeriği henüz boş.</span>}
                          </article>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Form Actions */}
          <div className="px-6 py-4 border-t border-zinc-100 bg-zinc-50/50 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setView("list")}
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
      )}
    </div>
  );
}
