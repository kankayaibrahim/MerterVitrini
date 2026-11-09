"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  ShieldCheck,
  Search,
  MapPin,
  Phone,
  MessageCircle,
  Mail,
  Globe,
  CheckCircle2,
  Package,
  ArrowRight,
  CreditCard,
} from "lucide-react";
import { Brand, Category } from "@/types/store";
import { apiFetch, trackBrandEvent } from "@/app/utils";
import { syncShowPricesToGuestsSetting } from "@/app/storeAuth";
import Header from "@/components/store/Header";
import Footer from "@/components/store/Footer";

const COMPANY_TYPE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "all", label: "Tüm Firmalar" },
  { value: "uretici_toptanci", label: "Üretici & Toptan Satış" },
  { value: "private_label", label: "Private Label (Özel Üretim)" },
  { value: "fason_atolye", label: "Fason Üretim Atölyesi" },
  { value: "kumas_tedarikcisi", label: "Kumaş Toptancısı" },
  { value: "aksesuar", label: "Tekstil Aksesuar & Yan Sanayi" },
];

const COMPANY_TYPE_LABELS: Record<string, string> = {
  uretici_toptanci: "Üretici & Toptan Satış",
  private_label: "Private Label (Özel Üretim)",
  fason_atolye: "Fason Üretim Atölyesi",
  kumas_tedarikcisi: "Kumaş Toptancısı",
  aksesuar: "Tekstil Aksesuar & Yan Sanayi",
};

function normalizeWaPhone(raw?: string): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("0") && digits.length === 11) {
    return "90" + digits.slice(1);
  }
  if (digits.length === 10 && digits.startsWith("5")) {
    return "90" + digits;
  }
  return digits;
}

function matchesSupplierFilter(
  brand: Brand,
  query: string,
  selectedType: string,
  onlyPrivateLabel: boolean,
  onlyFason: boolean
): boolean {
  if (selectedType !== "all" && (brand.company_type || "uretici_toptanci") !== selectedType) {
    return false;
  }
  if (onlyPrivateLabel && !brand.supports_private_label) {
    return false;
  }
  if (onlyFason && !brand.supports_fason) {
    return false;
  }
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const haystack = [
    brand.name,
    brand.description,
    brand.location_address,
    brand.export_countries,
    brand.alias_code,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

interface SupplierDirectoryCardProps {
  readonly brand: Brand;
}

function SupplierDirectoryCard({ brand }: SupplierDirectoryCardProps) {
  const companyLabel =
    COMPANY_TYPE_LABELS[brand.company_type || "uretici_toptanci"] ||
    "Üretici & Toptan Satış";
  const waRaw = brand.whatsapp_phone || brand.phone || "";
  const callRaw = brand.phone || brand.whatsapp_phone || "";
  const waDigits = normalizeWaPhone(waRaw);
  const waMessage = `Merhaba *${brand.name}*,\nMerter Vitrini Firma Rehberi üzerinden firmanızla toptan alım / üretim için doğrudan iletişime geçmek istiyorum.`;
  const waUrl = waDigits
    ? `https://wa.me/${waDigits}?text=${encodeURIComponent(waMessage)}`
    : "";
  const showcaseHref = `/ureticiler/${encodeURIComponent(brand.slug || brand.id)}`;
  const productCount = brand.active_product_count ?? 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 hover:border-slate-300 shadow-xs hover:shadow-md transition-all p-5 flex flex-col justify-between gap-4">
      <div className="space-y-3">
        {/* Top Row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
              <Building2 size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  href={showcaseHref}
                  className="text-base font-extrabold text-slate-900 hover:text-salmon-pink transition-colors no-underline"
                >
                  {brand.name}
                </Link>
                {(brand.is_verified ?? true) && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                    <ShieldCheck size={11} />
                    <span>Doğrulanmış Üretici</span>
                  </span>
                )}
              </div>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                {companyLabel} • %0 Komisyon Doğrudan Ticaret
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 text-xs font-extrabold shrink-0">
            <Package size={13} className="text-salmon-pink" />
            <span>{productCount} Ürün</span>
          </span>
        </div>

        {/* Capabilities */}
        <div className="flex flex-wrap gap-1.5">
          {brand.supports_private_label && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-violet-50 text-violet-700 border border-violet-200 text-[11px] font-bold">
              <CheckCircle2 size={11} />
              <span>Private Label (Özel Etiket)</span>
            </span>
          )}
          {brand.supports_fason && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-bold">
              <CheckCircle2 size={11} />
              <span>Fason Üretim</span>
            </span>
          )}
          {(brand.min_order_quantity ?? 1) > 1 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold">
              <span>Min. Sipariş: {brand.min_order_quantity} Seri</span>
            </span>
          )}
          {brand.export_countries && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200 text-[11px] font-semibold">
              <span>İhracat: {brand.export_countries}</span>
            </span>
          )}
        </div>

        {brand.description && (
          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
            {brand.description}
          </p>
        )}

        {/* Open Contact Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs text-slate-700">
          {brand.location_address && (
            <div className="flex items-start gap-1.5 sm:col-span-2">
              <MapPin size={13} className="text-slate-400 shrink-0 mt-0.5" />
              <span className="text-slate-600">{brand.location_address}</span>
            </div>
          )}
          {waRaw && (
            <div className="flex items-center gap-1.5">
              <MessageCircle size={13} className="text-emerald-600 shrink-0" />
              <span className="font-bold text-emerald-700">WhatsApp: {waRaw}</span>
            </div>
          )}
          {callRaw && (
            <div className="flex items-center gap-1.5">
              <Phone size={13} className="text-slate-400 shrink-0" />
              <a
                href={`tel:${callRaw}`}
                className="font-semibold text-slate-800 hover:text-salmon-pink no-underline"
              >
                Tel: {callRaw}
              </a>
            </div>
          )}
          {brand.public_email && (
            <div className="flex items-center gap-1.5">
              <Mail size={13} className="text-slate-400 shrink-0" />
              <a
                href={`mailto:${brand.public_email}`}
                className="font-semibold text-slate-700 hover:text-salmon-pink no-underline truncate"
              >
                {brand.public_email}
              </a>
            </div>
          )}
          {brand.website && (
            <div className="flex items-center gap-1.5">
              <Globe size={13} className="text-slate-400 shrink-0" />
              <a
                href={brand.website}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-slate-700 hover:text-salmon-pink no-underline truncate"
              >
                {brand.website.replace(/^https?:\/\//, "")}
              </a>
            </div>
          )}
          {brand.iban && (
            <div className="flex items-center gap-1.5 sm:col-span-2 text-[11px] text-slate-600">
              <CreditCard size={12} className="text-emerald-600 shrink-0" />
              <span className="truncate">
                Doğrudan Havale IBAN ({brand.bank_name || "Banka"}):{" "}
                <strong className="font-mono text-slate-900">{brand.iban}</strong>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100">
        <Link
          href={showcaseHref}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-salmon-pink text-white text-xs font-extrabold transition-colors no-underline"
        >
          <span>Firma Vitrini &amp; Koleksiyon</span>
          <ArrowRight size={14} />
        </Link>

        {waUrl ? (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackBrandEvent(brand.id, "whatsapp_click")}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold transition-colors no-underline"
          >
            <MessageCircle size={14} />
            <span>Doğrudan WhatsApp</span>
          </a>
        ) : (
          <Link
            href={showcaseHref}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-extrabold transition-colors no-underline"
          >
            <span>İletişim &amp; Detaylar</span>
          </Link>
        )}
      </div>
    </div>
  );
}

interface DirectoryContentProps {
  readonly loading: boolean;
  readonly brands: readonly Brand[];
  readonly onResetFilters: () => void;
}

function DirectoryContent({
  loading,
  brands,
  onResetFilters,
}: DirectoryContentProps) {
  if (loading) {
    return (
      <div className="py-16 text-center text-sm font-bold text-slate-500">
        Doğrulanmış Merter üretici firmaları yükleniyor...
      </div>
    );
  }
  if (brands.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-2">
        <p className="text-sm font-bold text-slate-800">
          Arama kriterlerinize uygun üretici firma bulunamadı.
        </p>
        <button
          type="button"
          onClick={onResetFilters}
          className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer"
        >
          Filtreleri Temizle
        </button>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {brands.map((brand) => (
        <SupplierDirectoryCard key={brand.id} brand={brand} />
      ))}
    </div>
  );
}

export default function SuppliersDirectoryClient() {
  const [lang, setLang] = useState<string>("tr");
  const [isLangOpen, setIsLangOpen] = useState<boolean>(false);
  const [displayCurrency, setDisplayCurrency] = useState<string>("TRY");
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [onlyPrivateLabel, setOnlyPrivateLabel] = useState<boolean>(false);
  const [onlyFason, setOnlyFason] = useState<boolean>(false);

  useEffect(() => {
    async function loadDirectoryData() {
      setLoading(true);
      const [brandsData, categoriesData, settingsData] = await Promise.all([
        apiFetch<Brand[]>("/brands"),
        apiFetch<Category[]>("/categories"),
        apiFetch<{ show_prices_to_guests?: boolean }>("/settings"),
      ]);
      if (brandsData) setBrands(brandsData);
      if (categoriesData) setCategories(categoriesData);
      if (settingsData) {
        syncShowPricesToGuestsSetting(Boolean(settingsData.show_prices_to_guests));
      }
      setLoading(false);
    }
    void loadDirectoryData();
  }, []);

  const filteredBrands = useMemo(
    () =>
      brands.filter((b) =>
        matchesSupplierFilter(b, searchQuery, selectedType, onlyPrivateLabel, onlyFason)
      ),
    [brands, searchQuery, selectedType, onlyPrivateLabel, onlyFason]
  );

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
        {/* Hero Banner */}
        <div className="rounded-2xl bg-slate-900 text-white p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-extrabold">
              <ShieldCheck size={14} />
              <span>AÇIK ÜRETİCİ VİTRİNİ • %0 KOMİSYON DOĞRUDAN TİCARET</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Merter Doğrulanmış Üretici &amp; Toptan Giyim Firmaları Rehberi
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Merter tekstil merkezindeki üretici, toptancı, Private Label ve fason üretim firmalarının açık iletişim, WhatsApp, Merter mağaza adresi ve doğrudan fabrika çıkış koleksiyonlarına aracısız ulaşın.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 shrink-0">
            <Link
              href="/tedarikci-basvuru"
              className="px-4 py-2.5 rounded-xl bg-salmon-pink hover:bg-rose-500 text-white text-xs font-extrabold no-underline text-center transition-colors"
            >
              Üretici Olarak Yerinizi Alın (Ücretsiz)
            </Link>
            <Link
              href="/supplier"
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-extrabold no-underline text-center transition-colors"
            >
              Tedarikçi Portalı Girişi
            </Link>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-xs">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Firma adı, Merter adresi, ihracat ülkesi veya üretim alanı ara..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:border-slate-900"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setOnlyPrivateLabel((prev) => !prev)}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                  onlyPrivateLabel
                    ? "bg-violet-600 text-white border-violet-600"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                Private Label (Özel Etiket)
              </button>
              <button
                type="button"
                onClick={() => setOnlyFason((prev) => !prev)}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                  onlyFason
                    ? "bg-amber-600 text-white border-amber-600"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                Fason Üretim Yapanlar
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {COMPANY_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSelectedType(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer border ${
                  selectedType === opt.value
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Directory Grid */}
        <DirectoryContent
          loading={loading}
          brands={filteredBrands}
          onResetFilters={() => {
            setSearchQuery("");
            setSelectedType("all");
            setOnlyPrivateLabel(false);
            setOnlyFason(false);
          }}
        />
      </main>

      <Footer lang={lang} onOpenPolicy={() => {}} />
    </div>
  );
}
