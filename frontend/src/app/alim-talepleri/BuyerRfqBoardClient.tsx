"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText,
  Plus,
  Search,
  Globe,
  Package,
  Calendar,
  Building2,
  CheckCircle2,
  Lock,
  UserPlus,
  LogIn,
  X,
} from "lucide-react";
import { Category } from "@/types/store";
import { apiFetch, showToast } from "@/app/utils";
import {
  getValidStoreUser,
  openStoreAuthModal,
  useIsStoreMemberLoggedIn,
} from "@/app/storeAuth";
import Header from "@/components/store/Header";
import Footer from "@/components/store/Footer";

function getActiveMemberOrSupplierToken(): string {
  if (typeof window === "undefined") return "";
  return (
    localStorage.getItem("store_user_token") ||
    localStorage.getItem("supplier_token") ||
    ""
  );
}

interface BuyerRfqItem {
  id: string;
  rfq_number: string;
  title: string;
  category_name: string;
  target_quantity: number;
  unit_type: string;
  target_price?: number;
  currency: string;
  production_type: string;
  description: string;
  buyer_name: string;
  buyer_company: string;
  buyer_country: string;
  buyer_email_verified?: boolean;
  status: string;
  offer_count: number;
  created_at: string;
}

const PRODUCTION_TYPES: ReadonlyArray<{ value: string; label: string }> = [
  { value: "", label: "Tüm Talepler" },
  { value: "hazir_toptan", label: "Hazır Toptan Koleksiyon" },
  { value: "private_label", label: "Private Label (Özel Etiket Üretim)" },
  { value: "fason_uretim", label: "Fason Üretim Talebi" },
  { value: "kumas_tedarik", label: "Kumaş & Aksesuar Tedariki" },
];

const PRODUCTION_LABELS: Record<string, string> = {
  hazir_toptan: "Hazır Toptan Koleksiyon",
  private_label: "Private Label (Özel Etiket)",
  fason_uretim: "Fason Üretim Talebi",
  kumas_tedarik: "Kumaş & Aksesuar",
};

function BuyerRfqCard({ item }: { readonly item: BuyerRfqItem }) {
  const prodLabel =
    PRODUCTION_LABELS[item.production_type] || "Hazır Toptan Koleksiyon";
  const dateStr = new Date(item.created_at).toLocaleDateString("tr-TR");

  return (
    <div className="bg-white rounded-2xl border border-slate-200 hover:border-slate-300 p-5 shadow-xs flex flex-col justify-between gap-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-mono font-bold">
            {item.rfq_number}
          </span>
          <span className="px-2.5 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200 text-[11px] font-bold">
            {prodLabel}
          </span>
        </div>

        <h3 className="text-base font-extrabold text-slate-900 leading-snug">
          {item.title}
        </h3>

        {item.description && (
          <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
            {item.description}
          </p>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-extrabold">
            <Package size={13} />
            <span>
              Hedef Miktar: {item.target_quantity} {item.unit_type}
            </span>
          </span>
          {item.category_name && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold">
              <span>Kategori: {item.category_name}</span>
            </span>
          )}
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 text-sky-700 border border-sky-200 text-xs font-bold">
            <Globe size={13} />
            <span>Alıcı Ülke: {item.buyer_country}</span>
          </span>
        </div>
      </div>

      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
        <div className="text-[11px] text-slate-500 space-y-0.5">
          <div className="font-bold text-slate-700 flex items-center gap-1.5 flex-wrap">
            <span>
              Alıcı: {item.buyer_name}
              {item.buyer_company ? ` (${item.buyer_company})` : ""}
            </span>
            {item.buyer_email_verified ? (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                ✓ Doğrulanmış Müşteri
              </span>
            ) : (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                E-posta Onaysız
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1">
              <Calendar size={11} />
              {dateStr}
            </span>
            <span>•</span>
            <strong className="text-emerald-700">
              {item.offer_count} Üretici Teklif Verdi
            </strong>
          </div>
        </div>

        <Link
          href="/supplier"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold no-underline transition-colors shadow-xs"
        >
          <Building2 size={13} />
          <span>Üretici Olarak Teklif Ver</span>
        </Link>
      </div>
    </div>
  );
}

interface RfqCreateModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onCreated: () => void;
}

function RfqCreateModal({ isOpen, onClose, onCreated }: RfqCreateModalProps) {
  const [title, setTitle] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [targetQuantity, setTargetQuantity] = useState("500");
  const [unitType, setUnitType] = useState("ADET");
  const [productionType, setProductionType] = useState("hazir_toptan");
  const [currency, setCurrency] = useState("USD");
  const [description, setDescription] = useState("");
  const [buyerName, setBuyerName] = useState(() => {
    const u = getValidStoreUser<{ first_name?: string; last_name?: string }>();
    return [u?.first_name, u?.last_name].filter(Boolean).join(" ");
  });
  const [buyerCompany, setBuyerCompany] = useState("");
  const [buyerCountry, setBuyerCountry] = useState("Türkiye");
  const [buyerPhone, setBuyerPhone] = useState(() => {
    const u = getValidStoreUser<{ phone?: string }>();
    return u?.phone || "";
  });
  const [buyerEmail, setBuyerEmail] = useState(() => {
    const u = getValidStoreUser<{ email?: string }>();
    return u?.email || "";
  });
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getActiveMemberOrSupplierToken();
    if (!token) {
      showToast("Alım ilanı oluşturmak için lütfen üye girişi yapın.");
      onClose();
      openStoreAuthModal("login");
      return;
    }
    if (!title.trim() || !buyerName.trim() || !buyerPhone.trim()) {
      showToast("Lütfen ilan başlığı, ad soyad ve telefon/WhatsApp numaranızı girin.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/store/rfqs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          category_name: categoryName.trim(),
          target_quantity: Number(targetQuantity) || 100,
          unit_type: unitType,
          production_type: productionType,
          currency,
          description: description.trim(),
          buyer_name: buyerName.trim(),
          buyer_company: buyerCompany.trim(),
          buyer_country: buyerCountry.trim() || "Türkiye",
          buyer_phone: buyerPhone.trim(),
          buyer_whatsapp: buyerPhone.trim(),
          buyer_email: buyerEmail.trim(),
        }),
      });
      if (res.ok) {
        showToast("Alım talebiniz (RFQ) yayınlandı! Merter üreticileri doğrudan size teklif iletecektir.");
        onCreated();
        onClose();
      } else if (res.status === 401) {
        showToast("Oturum süreniz dolmuş. Lütfen tekrar üye girişi yapın.");
        onClose();
        openStoreAuthModal("login");
      } else {
        showToast("Alım talebi oluşturulurken bir hata oluştu.");
      }
    } catch {
      showToast("Bağlantı hatası oluştu.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">
              Yeni Toptan Alım &amp; Üretim İlanı (RFQ) Oluştur
            </h2>
            <p className="text-xs text-slate-500">
              Aradığınız ürünü yazın, Merter üreticileri doğrudan WhatsApp ve telefonla size teklif versin.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label htmlFor="rfq-title" className="font-bold text-slate-700 block mb-1">
              Alım İlanı Başlığı *
            </label>
            <input
              id="rfq-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Örn: Almanya mağazalarımız için 500 adet kadın kaşe kaban arıyoruz"
              className="w-full px-3 py-2 rounded-lg border border-slate-300"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label htmlFor="rfq-production-type" className="font-bold text-slate-700 block mb-1">
                Talep Türü
              </label>
              <select
                id="rfq-production-type"
                value={productionType}
                onChange={(e) => setProductionType(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
              >
                <option value="hazir_toptan">Hazır Toptan Stok</option>
                <option value="private_label">Private Label (Özel Etiket)</option>
                <option value="fason_uretim">Fason Üretim</option>
                <option value="kumas_tedarik">Kumaş &amp; Aksesuar</option>
              </select>
            </div>

            <div>
              <label htmlFor="rfq-target-quantity" className="font-bold text-slate-700 block mb-1">
                Hedef Miktar *
              </label>
              <input
                id="rfq-target-quantity"
                type="number"
                min={1}
                value={targetQuantity}
                onChange={(e) => setTargetQuantity(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
                required
              />
            </div>

            <div>
              <label htmlFor="rfq-category-name" className="font-bold text-slate-700 block mb-1">
                Birim / Kategori
              </label>
              <input
                id="rfq-category-name"
                type="text"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="Kadın Giyim / Elbise"
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
              />
            </div>
          </div>

          <div>
            <label htmlFor="rfq-description" className="font-bold text-slate-700 block mb-1">
              Teknik Detaylar (Kumaş, Beden Serisi, Teslimat Beklentisi)
            </label>
            <textarea
              id="rfq-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Kumaş içeriği, renk/beden dağılımı, özel etiket talebiniz ve hedef fiyat aralığınızı belirtebilirsiniz..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <div>
              <label htmlFor="rfq-buyer-name" className="font-bold text-slate-700 block mb-1">
                Adınız Soyadınız *
              </label>
              <input
                id="rfq-buyer-name"
                type="text"
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                placeholder="Ad Soyad"
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
                required
              />
            </div>

            <div>
              <label htmlFor="rfq-buyer-company" className="font-bold text-slate-700 block mb-1">
                Firma Adı &amp; Ülke *
              </label>
              <div className="flex gap-1.5">
                <input
                  id="rfq-buyer-company"
                  type="text"
                  value={buyerCompany}
                  onChange={(e) => setBuyerCompany(e.target.value)}
                  placeholder="Firma Adı"
                  className="w-1/2 px-3 py-2 rounded-lg border border-slate-300"
                />
                <input
                  id="rfq-buyer-country"
                  type="text"
                  value={buyerCountry}
                  onChange={(e) => setBuyerCountry(e.target.value)}
                  placeholder="Ülke (Örn: Almanya)"
                  aria-label="Alıcı Ülke"
                  className="w-1/2 px-3 py-2 rounded-lg border border-slate-300"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="rfq-buyer-phone" className="font-bold text-slate-700 block mb-1">
                Doğrudan WhatsApp / Telefon *
              </label>
              <input
                id="rfq-buyer-phone"
                type="text"
                value={buyerPhone}
                onChange={(e) => setBuyerPhone(e.target.value)}
                placeholder="+90 532 000 00 00"
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
                required
              />
            </div>

            <div>
              <label htmlFor="rfq-buyer-email" className="font-bold text-slate-700 block mb-1">
                E-Posta Adresi
              </label>
              <input
                id="rfq-buyer-email"
                type="email"
                value={buyerEmail}
                onChange={(e) => setBuyerEmail(e.target.value)}
                placeholder="ornek@firma.com"
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
              />
            </div>
          </div>

          <input type="hidden" value={unitType} onChange={(e) => setUnitType(e.target.value)} />
          <input type="hidden" value={currency} onChange={(e) => setCurrency(e.target.value)} />

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold cursor-pointer"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold cursor-pointer disabled:opacity-50"
            >
              {submitting ? "Yayınlanıyor..." : "Alım İlanını Yayınla"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface RfqBoardListContentProps {
  readonly loading: boolean;
  readonly items: readonly BuyerRfqItem[];
  readonly onOpenCreate: () => void;
}

function RfqBoardListContent({
  loading,
  items,
  onOpenCreate,
}: RfqBoardListContentProps) {
  if (loading) {
    return (
      <div className="py-16 text-center text-sm font-bold text-slate-500">
        Alıcı talep ilanları yükleniyor...
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
        <p className="text-sm font-extrabold text-slate-800">
          Henüz bu kriterde açık alım ilanı bulunmuyor. İlk alım ilanını siz oluşturun!
        </p>
        <button
          type="button"
          onClick={onOpenCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-extrabold cursor-pointer"
        >
          <Plus size={15} />
          <span>Yeni Alım İlanı (RFQ) Aç</span>
        </button>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {items.map((item) => (
        <BuyerRfqCard key={item.id} item={item} />
      ))}
    </div>
  );
}

function MemberOnlyRfqGate() {
  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-8 sm:p-12 text-center max-w-2xl mx-auto my-6 space-y-5">
      <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
        <Lock size={30} />
      </div>
      <div className="space-y-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-extrabold uppercase tracking-wider">
          ÜYELERE ÖZEL B2B TALEP MERKEZİ
        </span>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900">
          Alıcı Talep Panosu (RFQ) Üyelere Özeldir
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-xl mx-auto">
          Toptan alım ilanlarını görüntülemek, yeni alım/üretim talebi (RFQ) oluşturmak veya üretici olarak alıcılara doğrudan teklif vermek için lütfen üye girişi yapın.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
        <button
          type="button"
          onClick={() => openStoreAuthModal("login")}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-extrabold cursor-pointer border-none shadow-xs"
        >
          <LogIn size={16} />
          <span>Üye Girişi Yap</span>
        </button>

        <button
          type="button"
          onClick={() => openStoreAuthModal("register")}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs sm:text-sm font-extrabold cursor-pointer border-none shadow-xs"
        >
          <UserPlus size={16} />
          <span>Ücretsiz B2B Üye Ol</span>
        </button>

        <Link
          href="/supplier"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-xs sm:text-sm font-bold no-underline"
        >
          <Building2 size={16} />
          <span>Üretici / Tedarikçi Girişi</span>
        </Link>
      </div>
    </div>
  );
}

export default function BuyerRfqBoardClient() {
  const isMemberLoggedIn = useIsStoreMemberLoggedIn();
  const [hasSupplierToken, setHasSupplierToken] = useState<boolean>(false);
  const [lang, setLang] = useState<string>("tr");
  const [isLangOpen, setIsLangOpen] = useState<boolean>(false);
  const [displayCurrency, setDisplayCurrency] = useState<string>("TRY");
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<BuyerRfqItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedProdType, setSelectedProdType] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);

  useEffect(() => {
    const checkSupplier = () => {
      if (typeof window !== "undefined") {
        setHasSupplierToken(Boolean(localStorage.getItem("supplier_token")));
      }
    };
    checkSupplier();
    window.addEventListener("storage", checkSupplier);
    window.addEventListener("auth-change", checkSupplier);
    return () => {
      window.removeEventListener("storage", checkSupplier);
      window.removeEventListener("auth-change", checkSupplier);
    };
  }, []);

  const isAuthenticated = isMemberLoggedIn || hasSupplierToken;

  const loadRfqs = useCallback(async () => {
    const token = getActiveMemberOrSupplierToken();
    if (!token) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let path = `/api/v1/store/rfqs?production_type=${encodeURIComponent(selectedProdType)}`;
    if (searchQuery.trim()) {
      path += `&search=${encodeURIComponent(searchQuery.trim())}`;
    }
    try {
      const res = await fetch(path, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = (await res.json()) as BuyerRfqItem[];
        setItems(data || []);
      } else {
        setItems([]);
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [selectedProdType, searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isAuthenticated) {
        void loadRfqs();
      } else {
        setItems([]);
        setLoading(false);
      }
      void apiFetch<Category[]>("/categories").then((c) => {
        if (c) setCategories(c);
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [isAuthenticated, loadRfqs]);

  const handleOpenCreateClick = () => {
    if (!isAuthenticated) {
      showToast("Alım ilanı (RFQ) açmak için lütfen üye girişi yapın.");
      openStoreAuthModal("login");
      return;
    }
    setIsCreateOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/60">
      <Header
        lang={lang}
        setLang={setLang}
        isLangOpen={isLangOpen}
        setIsLangOpen={setIsLangOpen}
        totalPkgs={0}
        setIsCartOpen={() => {}}
        setCurrentPage={() => {}}
        categories={categories}
        activeCategoryId=""
        displayCurrency={displayCurrency}
        onCurrencyChange={setDisplayCurrency}
      />

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 py-8 space-y-6">
        {/* Hero */}
        <div className="rounded-3xl bg-gradient-to-br from-emerald-50/90 via-white to-amber-50/60 border border-emerald-200/80 text-slate-900 p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xs">
          <div className="space-y-2.5 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100/80 border border-emerald-200 text-emerald-800 text-xs font-extrabold">
              <CheckCircle2 size={14} className="text-emerald-600" />
              <span>B2B ALICI TALEP PANOSU (BUYING LEADS / RFQ)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
              Aradığınız Ürünü İlan Edin, Merter Üreticileri Teklif Versin
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              &quot;500 adet kadın kabanı arıyoruz&quot;, &quot;Özel etiketli (Private Label) tişört yaptırmak istiyoruz&quot; gibi toptan alım ve üretim taleplerinizi ücretsiz açın; doğrulanmış Merter üreticileri doğrudan sizinle iletişime geçsin.
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenCreateClick}
            className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-extrabold cursor-pointer shrink-0 shadow-xs border-none transition-colors"
          >
            <Plus size={18} />
            <span>Yeni Alım İlanı (RFQ) Oluştur</span>
          </button>
        </div>

        {!isAuthenticated ? (
          <MemberOnlyRfqGate />
        ) : (
          <>
            {/* Filters */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-xs">
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="İlan başlığı, kategori veya alıcı ülkeye göre ara..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {PRODUCTION_TYPES.map((pt) => (
                  <button
                    key={pt.value}
                    type="button"
                    onClick={() => setSelectedProdType(pt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer border transition-colors ${
                      selectedProdType === pt.value
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                        : "bg-slate-50/80 text-slate-600 border-slate-200 hover:bg-emerald-50/60 hover:text-emerald-800 hover:border-emerald-200"
                    }`}
                  >
                    <FileText size={12} className="inline mr-1" />
                    {pt.label}
                  </button>
                ))}
              </div>
            </div>

            <RfqBoardListContent
              loading={loading}
              items={items}
              onOpenCreate={handleOpenCreateClick}
            />
          </>
        )}
      </main>

      <RfqCreateModal
        isOpen={isCreateOpen && isAuthenticated}
        onClose={() => setIsCreateOpen(false)}
        onCreated={() => void loadRfqs()}
      />

      <Footer lang={lang} onOpenPolicy={() => {}} />
    </div>
  );
}

