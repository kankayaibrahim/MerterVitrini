"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  ShieldCheck,
  MapPin,
  Phone,
  MessageCircle,
  Mail,
  Globe,
  CheckCircle2,
  CreditCard,
  Search,
  ChevronLeft,
  Package,
  Lock,
  BookOpen,
} from "lucide-react";
import { Brand, Category, Product } from "@/types/store";
import { apiFetch, ExchangeRate, trackBrandEvent } from "@/app/utils";
import {
  useIsStoreMemberLoggedIn,
  openStoreAuthModal,
  syncShowPricesToGuestsSetting,
} from "@/app/storeAuth";
import Header from "@/components/store/Header";
import Footer from "@/components/store/Footer";
import ProductCard from "@/components/store/ProductCard";
import StoreChatDrawer from "@/components/store/StoreChatDrawer";

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

interface ProductsApiResponse {
  products?: Product[];
  total?: number;
}

interface SupplierProfileBannerProps {
  readonly brand: Brand;
  readonly totalProducts: number;
  readonly isMemberLoggedIn: boolean;
  readonly onOpenChat: () => void;
}

function SupplierProfileBanner({
  brand,
  totalProducts,
  isMemberLoggedIn,
  onOpenChat,
}: SupplierProfileBannerProps) {
  const companyLabel =
    COMPANY_TYPE_LABELS[brand.company_type || "uretici_toptanci"] ||
    "Üretici & Toptan Satış";
  const waRaw = brand.whatsapp_phone || brand.phone || "";
  const callRaw = brand.phone || brand.whatsapp_phone || "";
  const waDigits = normalizeWaPhone(waRaw);
  const waMessage = `Merhaba *${brand.name}*,\nMerter Vitrini üzerindeki açık firma vitrininizden doğrudan toptan sipariş / üretim için iletişime geçiyorum.`;
  const waUrl = waDigits
    ? `https://wa.me/${waDigits}?text=${encodeURIComponent(waMessage)}`
    : "";

  return (
    <div className="bg-gradient-to-br from-amber-50/80 via-white to-emerald-50/50 rounded-3xl border border-amber-200/80 shadow-xs p-6 sm:p-8 space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
            <Building2 size={28} />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                {brand.name}
              </h1>
              {(brand.is_verified ?? true) && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100/80 text-emerald-800 border border-emerald-200 text-xs font-extrabold">
                  <ShieldCheck size={13} />
                  <span>Doğrulanmış Merter Üreticisi</span>
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm font-bold text-slate-600">
              {companyLabel} • %0 Komisyon Doğrudan Fabrika Çıkış Fiyatları
            </p>
            <p className="text-xs sm:text-sm text-slate-600 max-w-3xl leading-relaxed pt-1">
              {brand.description ||
                `${brand.name}, İstanbul Merter tekstil merkezinde orijinal seri (asorti) paket yapısıyla butik ve mağazalara doğrudan imalatçı fiyatlarıyla toptan koleksiyon sunan doğrulanmış üreticidir.`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Link
            href={`/ureticiler/${encodeURIComponent(brand.slug || brand.id)}/tanitim`}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-extrabold no-underline transition-colors"
          >
            <BookOpen size={15} className="text-amber-600" />
            <span>Firma Hikayesi &amp; Rehberi</span>
          </Link>

          {waUrl && (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackBrandEvent(brand.id, "whatsapp_click")}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold no-underline transition-colors shadow-xs"
            >
              <MessageCircle size={16} />
              <span>WhatsApp ile Doğrudan Yaz</span>
            </a>
          )}

          <button
            type="button"
            onClick={isMemberLoggedIn ? onOpenChat : () => openStoreAuthModal("login")}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold cursor-pointer border-none transition-colors shadow-xs"
          >
            {isMemberLoggedIn ? (
              <>
                <Building2 size={15} />
                <span>Canlı B2B Sohbet</span>
              </>
            ) : (
              <>
                <Lock size={14} />
                <span>Canlı Sohbet (Üye Girişi)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Capabilities & Open Contact Grid */}
      <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 text-slate-800 text-xs font-extrabold">
          <Package size={13} className="text-salmon-pink" />
          <span>{totalProducts} Aktif Koleksiyon Ürünü</span>
        </span>
        {brand.supports_private_label && (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-violet-50 text-violet-700 border border-violet-200 text-xs font-bold">
            <CheckCircle2 size={13} />
            <span>Private Label (Özel Etiket Üretim)</span>
          </span>
        )}
        {brand.supports_fason && (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold">
            <CheckCircle2 size={13} />
            <span>Fason Üretim Atölyesi</span>
          </span>
        )}
        {(brand.min_order_quantity ?? 1) > 1 && (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold">
            <span>Min. Sipariş: {brand.min_order_quantity} Seri</span>
          </span>
        )}
        {brand.export_countries && (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-sky-50 text-sky-700 border border-sky-200 text-xs font-bold">
            <span>İhracat Ülkeleri: {brand.export_countries}</span>
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-xs text-slate-700">
        {brand.location_address && (
          <div className="flex items-start gap-2">
            <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
            <span>{brand.location_address}</span>
          </div>
        )}
        {callRaw && (
          <div className="flex items-center gap-2">
            <Phone size={14} className="text-slate-400 shrink-0" />
            <a
              href={`tel:${callRaw}`}
              className="font-bold text-slate-800 hover:text-salmon-pink no-underline"
            >
              Tel: {callRaw}
            </a>
          </div>
        )}
        {brand.public_email && (
          <div className="flex items-center gap-2">
            <Mail size={14} className="text-slate-400 shrink-0" />
            <a
              href={`mailto:${brand.public_email}`}
              className="font-semibold text-slate-700 hover:text-salmon-pink no-underline truncate"
            >
              {brand.public_email}
            </a>
          </div>
        )}
        {brand.website && (
          <div className="flex items-center gap-2">
            <Globe size={14} className="text-slate-400 shrink-0" />
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
      </div>

      {brand.iban && (
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 text-xs flex flex-wrap items-center gap-2">
          <CreditCard size={14} className="text-emerald-600 shrink-0" />
          <span className="font-bold text-slate-800">
            Doğrudan Tedarikçi Havale / EFT IBAN ({brand.bank_name || "Banka"}
            {brand.bank_account_holder ? ` • ${brand.bank_account_holder}` : ""}):
          </span>
          <span className="font-mono font-extrabold text-slate-900 select-all">
            {brand.iban}
          </span>
        </div>
      )}
    </div>
  );
}

interface ShowcaseProductsGridProps {
  readonly loading: boolean;
  readonly products: readonly Product[];
  readonly lang: string;
  readonly displayCurrency: string;
  readonly exchangeRates: readonly ExchangeRate[];
  readonly onSelectProduct: (product: Product) => void;
}

function ShowcaseProductsGrid({
  loading,
  products,
  lang,
  displayCurrency,
  exchangeRates,
  onSelectProduct,
}: ShowcaseProductsGridProps) {
  if (loading) {
    return (
      <div className="py-16 text-center text-sm font-bold text-slate-500">
        Üretici koleksiyonu yükleniyor...
      </div>
    );
  }
  if (products.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-sm font-bold text-slate-600">
        Bu arama kriterine uygun ürün bulunamadı.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
      {products.map((prod, idx) => (
        <ProductCard
          key={prod.id}
          product={prod}
          lang={lang}
          priority={idx < 4}
          displayCurrency={displayCurrency}
          exchangeRates={exchangeRates}
          onOpenModal={() => onSelectProduct(prod)}
        />
      ))}
    </div>
  );
}

interface SupplierShowcaseClientProps {
  readonly slug: string;
}

export default function SupplierShowcaseClient({
  slug,
}: SupplierShowcaseClientProps) {
  const router = useRouter();
  const isMemberLoggedIn = useIsStoreMemberLoggedIn();
  const [lang, setLang] = useState<string>("tr");
  const [isLangOpen, setIsLangOpen] = useState<boolean>(false);
  const [displayCurrency, setDisplayCurrency] = useState<string>("TRY");
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [totalProducts, setTotalProducts] = useState<number>(0);
  const [loadingBrand, setLoadingBrand] = useState<boolean>(true);
  const [loadingProducts, setLoadingProducts] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);

  useEffect(() => {
    async function loadInitial() {
      setLoadingBrand(true);
      const [brandData, catsData, ratesData, settingsData] = await Promise.all([
        apiFetch<Brand>(`/brands/${encodeURIComponent(slug)}`),
        apiFetch<Category[]>("/categories"),
        apiFetch<ExchangeRate[]>("/exchange-rates"),
        apiFetch<{ show_prices_to_guests?: boolean }>("/settings"),
      ]);
      if (brandData) setBrand(brandData);
      if (catsData) setCategories(catsData);
      if (ratesData) setExchangeRates(ratesData);
      if (settingsData) {
        syncShowPricesToGuestsSetting(Boolean(settingsData.show_prices_to_guests));
      }
      setLoadingBrand(false);
    }
    void loadInitial();
  }, [slug]);

  useEffect(() => {
    if (!brand?.id) return;
    const brandId = brand.id;
    async function loadSupplierProducts() {
      setLoadingProducts(true);
      let query = `/products?brand_id=${encodeURIComponent(brandId)}&limit=48&offset=0`;
      if (searchQuery.trim()) {
        query += `&search=${encodeURIComponent(searchQuery.trim())}`;
      }
      const res = await apiFetch<ProductsApiResponse>(query);
      setProducts(res?.products || []);
      setTotalProducts(res?.total ?? brand?.active_product_count ?? 0);
      setLoadingProducts(false);
    }
    void loadSupplierProducts();
  }, [brand?.id, brand?.active_product_count, searchQuery]);

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

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <Link
            href="/ureticiler"
            className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-600 hover:text-emerald-700 no-underline"
          >
            <ChevronLeft size={15} />
            <span>Tüm Doğrulanmış Merter Üreticileri Rehberine Dön</span>
          </Link>

          {brand && (
            <div className="inline-flex items-center gap-1.5 p-1 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <Link
                href={`/ureticiler/${encodeURIComponent(slug)}`}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-extrabold no-underline shadow-xs"
              >
                <Package size={14} />
                <span>Koleksiyon &amp; Ürün Vitrini ({totalProducts})</span>
              </Link>
              <Link
                href={`/ureticiler/${encodeURIComponent(slug)}/tanitim`}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900 no-underline transition-colors"
              >
                <BookOpen size={14} />
                <span>Firma Hikayesi &amp; Rehberi (Blog)</span>
              </Link>
            </div>
          )}
        </div>

        {loadingBrand && (
          <div className="py-20 text-center text-sm font-bold text-slate-500">
            Üretici vitrini yükleniyor...
          </div>
        )}

        {!loadingBrand && !brand && (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
            <p className="text-base font-extrabold text-slate-800">
              Aradığınız üretici firma bulunamadı.
            </p>
            <Link
              href="/ureticiler"
              className="inline-flex px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold no-underline"
            >
              Firma Rehberine Git
            </Link>
          </div>
        )}

        {!loadingBrand && brand && (
          <>
            <SupplierProfileBanner
              brand={brand}
              totalProducts={totalProducts}
              isMemberLoggedIn={isMemberLoggedIn}
              onOpenChat={() => setIsChatOpen(true)}
            />

            {/* Collection Filter Bar */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                  {brand.name} — Toptan Koleksiyonu ({totalProducts} Ürün)
                </h2>
                <p className="text-xs text-slate-500">
                  Tüm ürünler aracısız olarak doğrudan {brand.name} tarafından gönderilir.
                </p>
              </div>

              <div className="relative w-full sm:w-80">
                <Search
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Bu üreticinin ürünlerinde ara..."
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-slate-900"
                />
              </div>
            </div>

            <ShowcaseProductsGrid
              loading={loadingProducts}
              products={products}
              lang={lang}
              displayCurrency={displayCurrency}
              exchangeRates={exchangeRates}
              onSelectProduct={(prod) => {
                const target = prod.slug || prod.id;
                router.push(`/product/${target}`);
              }}
            />
          </>
        )}
      </main>

      {brand && (
        <StoreChatDrawer
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          initialBrandId={brand.id}
          supplierDisplayName={brand.name}
          lang={lang}
          displayCurrency={displayCurrency}
          exchangeRates={exchangeRates}
          onAcceptOfferToCart={() => {}}
        />
      )}

      <Footer lang={lang} onOpenPolicy={() => {}} />
    </div>
  );
}

