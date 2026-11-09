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
  ChevronLeft,
  Package,
  Lock,
  BookOpen,
  Sparkles,
  Award,
  Truck,
  Layers,
  ArrowRight,
  HelpCircle,
  FileText,
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

interface ProductsApiResponse {
  products?: Product[];
  total?: number;
}

interface BlogTranslation {
  title?: string;
  summary?: string;
  content?: string;
}

interface BlogPostResponse {
  slug?: string;
  translations?: Record<string, BlogTranslation>;
}

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

function resolveCandidateBlogSlugs(brand: Brand): string[] {
  const candidates = new Set<string>();
  if (brand.slug) {
    candidates.add(brand.slug);
    const firstPart = brand.slug.split("-")[0];
    if (firstPart) candidates.add(firstPart);
    if (brand.slug.startsWith("jane-s")) candidates.add("janes");
  }
  const cleanName = brand.name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .split(/\s+/)[0];
  if (cleanName) candidates.add(cleanName);
  return Array.from(candidates);
}

interface EditorialArticleSectionsProps {
  readonly brand: Brand;
  readonly totalProducts: number;
  readonly blogSummary?: string;
}

function EditorialArticleSections({
  brand,
  totalProducts,
  blogSummary,
}: EditorialArticleSectionsProps) {
  const exportRegions =
    brand.export_countries ||
    "Avrupa Birliği (Almanya, Fransa, Polonya, Hollanda), Balkanlar, Rusya & BDT, Orta Doğu & Körfez Ülkeleri ve Kuzey Afrika";
  const addressText =
    brand.location_address || "Merter Tekstil Merkezi, Güngören / İstanbul";

  return (
    <article className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 sm:p-10 space-y-8 text-slate-700 leading-relaxed">
      {/* Intro Lead Box */}
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-amber-50/70 via-white to-emerald-50/50 border border-amber-200/70 space-y-2">
        <div className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-amber-800">
          <Sparkles size={14} className="text-amber-600" />
          <span>Editöryel Firma Dosyası &amp; Toptan Alım Rehberi</span>
        </div>
        <p className="text-sm sm:text-base font-medium text-slate-800 leading-relaxed">
          {blogSummary ||
            brand.description ||
            `${brand.name}, İstanbul Merter tekstil piyasasının yüksek üretim standartlarını güncel hazır giyim trendleriyle buluşturan doğrulanmış bir üretici ve toptan tedarik markasıdır. Butikler, mağaza zincirleri ve uluslararası e-ticaret işletmeleri için %0 komisyonla doğrudan fabrika çıkış koleksiyonları sunar.`}
        </p>
      </div>

      {/* Section 1 */}
      <section className="space-y-3">
        <h2 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-black flex items-center justify-center shrink-0">
            01
          </span>
          <span>{brand.name} Marka Profili ve Merter Üretim Gücü</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
          Türkiye&apos;nin ve Avrupa&apos;nın en dinamik hazır giyim üretim merkezi olan{" "}
          <strong>İstanbul Merter</strong> ekosisteminde faaliyet gösteren{" "}
          <strong>{brand.name}</strong>, kumaş Ar-Ge aşamasından bilgisayarlı kalıp
          tasarımına, titiz dikim işçiliğinden son ütü, kalite kontrol ve seri paketleme
          süreçlerine kadar uçtan uca kurumsal üretim disipliniyle çalışmaktadır.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900">
              <Award size={14} className="text-emerald-600" />
              <span>Birinci Sınıf Kumaş &amp; Kalıp</span>
            </div>
            <p className="text-xs text-slate-600">
              Yüksek gramajlı dokuma, nefes alabilen viskon/pamuk karışımları ve tam kalıp
              ergonomisiyle düşük iade oranı sağlar.
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900">
              <Layers size={14} className="text-amber-600" />
              <span>Haftalık Yenilenen Koleksiyon</span>
            </div>
            <p className="text-xs text-slate-600">
              Aktif <strong>{totalProducts}+ model</strong> kapasitesi ve her hafta vitrine
              eklenen yeni sezon kapsül serilerle butik vitrinlerini canlı tutar.
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900">
              <ShieldCheck size={14} className="text-sky-600" />
              <span>%100 Doğrulanmış İmalatçı</span>
            </div>
            <p className="text-xs text-slate-600">
              Merter Vitrini saha ekibi tarafından üretim kapasitesi, ticari unvanı ve
              sevkiyat standartları yerinde doğrulanmıştır.
            </p>
          </div>
        </div>
      </section>

      {/* Section 2 */}
      <section className="space-y-3 pt-4 border-t border-slate-100">
        <h2 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 text-xs font-black flex items-center justify-center shrink-0">
            02
          </span>
          <span>Öne Çıkan Koleksiyon Yapısı ve Ürün Grupları</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
          <strong>{brand.name}</strong> koleksiyonları, hem fiziksel butiklerin hem de
          Instagram/TikTok ve pazaryeri mağazalarının hızlı stok devir hızı (fast-moving
          retail) ihtiyaçlarına göre kurgulanmıştır:
        </p>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs sm:text-sm text-slate-700 list-none p-0 m-0">
          <li className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50/40 border border-emerald-100">
            <CheckCircle2 size={15} className="text-emerald-600 shrink-0 mt-0.5" />
            <span>
              <strong>Elbise &amp; Tulum Koleksiyonları:</strong> Günlük şehir şıklığı,
              ofis stili ve davet/abiye kapsül serileri.
            </span>
          </li>
          <li className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50/40 border border-emerald-100">
            <CheckCircle2 size={15} className="text-emerald-600 shrink-0 mt-0.5" />
            <span>
              <strong>İkili Takım &amp; Ceket Kombinleri:</strong> Vitrinlerde en yüksek
              sepet ortalaması sağlayan uyumlu alt-üst takımlar.
            </span>
          </li>
          <li className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50/40 border border-emerald-100">
            <CheckCircle2 size={15} className="text-emerald-600 shrink-0 mt-0.5" />
            <span>
              <strong>Üst Giyim (Bluz, Gömlek, Triko):</strong> Dört mevsim yüksek adetli
              sirkülasyon sağlayan temel ve trend modeller.
            </span>
          </li>
          <li className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50/40 border border-emerald-100">
            <CheckCircle2 size={15} className="text-emerald-600 shrink-0 mt-0.5" />
            <span>
              <strong>Alt Giyim &amp; Dış Giyim:</strong> Palazzo pantolonlar, etek
              serileri ve sezonluk trençkot/kaban/ceket grupları.
            </span>
          </li>
        </ul>
      </section>

      {/* Section 3 */}
      <section className="space-y-3 pt-4 border-t border-slate-100">
        <h2 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-lg bg-sky-100 text-sky-800 text-xs font-black flex items-center justify-center shrink-0">
            03
          </span>
          <span>Toptan Seri (Asorti) Paketleme ve B2B Kârlılık Avantajları</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
          Merter Vitrini üzerinde <strong>{brand.name}</strong> markasına ait tüm ürünler
          aracı komisyonu olmadan doğrudan fabrika çıkış fiyatlarıyla listelenir. Her model,
          üreticinin belirlediği standart <strong>orijinal seri (lot/paket)</strong>{" "}
          yapısıyla (örneğin S-M-L veya 36-38-40-42 beden dağılımlı paketler halinde)
          satışa sunulur.
        </p>
        <div className="p-4 rounded-2xl bg-sky-50/60 border border-sky-200/80 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <div className="font-extrabold text-sky-950 mb-1">
              📦 Minimum Sipariş &amp; Paket Esnekliği
            </div>
            <p className="text-slate-600">
              Minimum sipariş alt limiti <strong>{brand.min_order_quantity ?? 1} seri</strong>{" "}
              olup, farklı renk ve modellerden karma sepet oluşturarak butiğinizin
              çeşitliliğini düşük sermaye ile maksimuma çıkarabilirsiniz.
            </p>
          </div>
          <div>
            <div className="font-extrabold text-sky-950 mb-1">
              🌍 İhracat &amp; Uluslararası Gönderim
            </div>
            <p className="text-slate-600">
              Başlıca ihracat pazarları: <strong>{exportRegions}</strong>. Anlaşmalı
              uluslararası kargo ve gümrük müşavirliği ortaklarımızla kapıya teslim ihracat
              desteği sağlanmaktadır.
            </p>
          </div>
        </div>
      </section>

      {/* Section 4: FAQ */}
      <section className="space-y-3 pt-4 border-t border-slate-100">
        <h2 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2.5">
          <HelpCircle size={20} className="text-amber-600 shrink-0" />
          <span>{brand.name} Hakkında Sıkça Sorulan B2B Soruları</span>
        </h2>
        <div className="space-y-2.5">
          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-1">
            <h3 className="text-xs sm:text-sm font-extrabold text-slate-900">
              1. {brand.name} ürünlerini tekil (perakende) olarak satın alabilir miyim?
            </h3>
            <p className="text-xs text-slate-600">
              Hayır. Merter Vitrini yalnızca B2B toptan alıcılar (butikler, mağazalar ve
              e-ticaret satıcıları) için hizmet verir. Satışlar üreticinin orijinal beden
              serisi (paket/lot) bazında gerçekleştirilir.
            </p>
          </div>
          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-1">
            <h3 className="text-xs sm:text-sm font-extrabold text-slate-900">
              2. Üreticiyle doğrudan fiyat ve üretim pazarlığı yapabilir miyim?
            </h3>
            <p className="text-xs text-slate-600">
              Evet! Sağ bölümdeki <strong>&ldquo;Üreticiyle Canlı B2B Sohbet&rdquo;</strong>{" "}
              butonunu kullanarak doğrudan {brand.name} yetkilisine mesaj gönderebilir,
              yüksek adetli alımlarınız için özel fiyat teklifi isteyebilirsiniz.
            </p>
          </div>
          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-1">
            <h3 className="text-xs sm:text-sm font-extrabold text-slate-900">
              3. Sevkiyatlar nereden yapılıyor?
            </h3>
            <p className="text-xs text-slate-600">
              Siparişleriniz doğrudan üreticinin Merter merkezinden ({addressText}) kalite
              kontrolden geçirilerek anlaşmalı yurtiçi veya uluslararası lojistik firmasına
              teslim edilir.
            </p>
          </div>
        </div>
      </section>
    </article>
  );
}

interface SidebarIdentityCardProps {
  readonly brand: Brand;
  readonly slug: string;
  readonly totalProducts: number;
  readonly isMemberLoggedIn: boolean;
  readonly onOpenChat: () => void;
}

function SidebarIdentityCard({
  brand,
  slug,
  totalProducts,
  isMemberLoggedIn,
  onOpenChat,
}: SidebarIdentityCardProps) {
  const companyLabel =
    COMPANY_TYPE_LABELS[brand.company_type || "uretici_toptanci"] ||
    "Üretici & Toptan Satış";
  const waRaw = brand.whatsapp_phone || brand.phone || "";
  const callRaw = brand.phone || brand.whatsapp_phone || "";
  const waDigits = normalizeWaPhone(waRaw);
  const waMessage = `Merhaba *${brand.name}*,\nMerter Vitrini üzerindeki Kurumsal Tanıtım & Blog sayfanızı inceledim. Toptan koleksiyonunuz hakkında bilgi almak istiyorum.`;
  const waUrl = waDigits
    ? `https://wa.me/${waDigits}?text=${encodeURIComponent(waMessage)}`
    : "";

  return (
    <aside className="space-y-5 lg:sticky lg:top-24">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
            <Building2 size={24} />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900">{brand.name}</h2>
            <p className="text-xs font-bold text-emerald-700">{companyLabel}</p>
          </div>
        </div>

        <dl className="space-y-2.5 text-xs">
          <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
            <dt className="text-slate-500 font-semibold">Doğrulama Statüsü</dt>
            <dd className="font-extrabold text-emerald-700 inline-flex items-center gap-1">
              <ShieldCheck size={13} />
              <span>Doğrulanmış Üretici</span>
            </dd>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
            <dt className="text-slate-500 font-semibold">Aktif Koleksiyon</dt>
            <dd className="font-extrabold text-slate-900">{totalProducts} Model</dd>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
            <dt className="text-slate-500 font-semibold">Satış Biçimi</dt>
            <dd className="font-bold text-slate-800">Orijinal Seri (Asorti Lot)</dd>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
            <dt className="text-slate-500 font-semibold">Min. Sipariş</dt>
            <dd className="font-bold text-slate-800">
              {brand.min_order_quantity ?? 1} Seri Paket
            </dd>
          </div>
          <div className="flex items-start justify-between gap-2 py-1.5 border-b border-slate-100">
            <dt className="text-slate-500 font-semibold shrink-0">Üretim Merkezi</dt>
            <dd className="font-semibold text-slate-700 text-right">
              {brand.location_address || "Merter Tekstil Merkezi, İstanbul"}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-2 py-1.5">
            <dt className="text-slate-500 font-semibold shrink-0">İhracat Bölgesi</dt>
            <dd className="font-semibold text-slate-700 text-right">
              {brand.export_countries || "Avrupa, Balkanlar, BDT & Körfez"}
            </dd>
          </div>
        </dl>

        {/* Contact links if present */}
        {(callRaw || brand.public_email || brand.website) && (
          <div className="pt-2 border-t border-slate-100 space-y-2 text-xs">
            {callRaw && (
              <div className="flex items-center gap-2">
                <Phone size={13} className="text-slate-400 shrink-0" />
                <a
                  href={`tel:${callRaw}`}
                  className="font-bold text-slate-800 hover:text-emerald-700 no-underline"
                >
                  {callRaw}
                </a>
              </div>
            )}
            {brand.public_email && (
              <div className="flex items-center gap-2">
                <Mail size={13} className="text-slate-400 shrink-0" />
                <a
                  href={`mailto:${brand.public_email}`}
                  className="font-semibold text-slate-700 hover:text-emerald-700 no-underline truncate"
                >
                  {brand.public_email}
                </a>
              </div>
            )}
            {brand.website && (
              <div className="flex items-center gap-2">
                <Globe size={13} className="text-slate-400 shrink-0" />
                <a
                  href={brand.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-slate-700 hover:text-emerald-700 no-underline truncate"
                >
                  {brand.website.replace(/^https?:\/\//, "")}
                </a>
              </div>
            )}
          </div>
        )}

        {/* Primary CTA Buttons */}
        <div className="space-y-2.5 pt-2">
          <Link
            href={`/ureticiler/${encodeURIComponent(slug)}`}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold no-underline transition-colors shadow-xs"
          >
            <Package size={15} />
            <span>Koleksiyon Vitrinini İncele ({totalProducts} Ürün)</span>
          </Link>

          <button
            type="button"
            onClick={isMemberLoggedIn ? onOpenChat : () => openStoreAuthModal("login")}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold cursor-pointer border-none transition-colors shadow-xs"
          >
            {isMemberLoggedIn ? (
              <>
                <MessageCircle size={15} />
                <span>Üreticiyle Canlı B2B Sohbet Başlat</span>
              </>
            ) : (
              <>
                <Lock size={14} />
                <span>Canlı B2B Sohbet (Üye Girişi)</span>
              </>
            )}
          </button>

          {waUrl && (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackBrandEvent(brand.id, "whatsapp_click")}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-extrabold no-underline transition-colors"
            >
              <MessageCircle size={15} />
              <span>WhatsApp Sipariş Hattı</span>
            </a>
          )}

          <Link
            href="/alim-talepleri"
            className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold no-underline transition-colors"
          >
            <FileText size={14} />
            <span>Özel Üretim / Alım İlanı (RFQ) Aç</span>
          </Link>
        </div>
      </div>
    </aside>
  );
}

export default function SupplierEditorialProfileClient({
  slug,
}: {
  readonly slug: string;
}) {
  const router = useRouter();
  const isMemberLoggedIn = useIsStoreMemberLoggedIn();
  const [lang, setLang] = useState<string>("tr");
  const [isLangOpen, setIsLangOpen] = useState<boolean>(false);
  const [displayCurrency, setDisplayCurrency] = useState<string>("TRY");
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [totalProducts, setTotalProducts] = useState<number>(0);
  const [blogSummary, setBlogSummary] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);

  useEffect(() => {
    async function loadEditorialPage() {
      setLoading(true);
      const [brandData, catsData, ratesData, settingsData] = await Promise.all([
        apiFetch<Brand>(`/brands/${encodeURIComponent(slug)}`),
        apiFetch<Category[]>("/categories"),
        apiFetch<ExchangeRate[]>("/exchange-rates"),
        apiFetch<{ show_prices_to_guests?: boolean }>("/settings"),
      ]);

      if (catsData) setCategories(catsData);
      if (ratesData) setExchangeRates(ratesData);
      if (settingsData) {
        syncShowPricesToGuestsSetting(Boolean(settingsData.show_prices_to_guests));
      }

      if (brandData) {
        setBrand(brandData);
        const prodRes = await apiFetch<ProductsApiResponse>(
          `/products?brand_id=${encodeURIComponent(brandData.id)}&limit=8&offset=0`
        );
        setFeaturedProducts(prodRes?.products || []);
        setTotalProducts(prodRes?.total ?? brandData.active_product_count ?? 0);

        const candidates = resolveCandidateBlogSlugs(brandData);
        for (const candidate of candidates) {
          const post = await apiFetch<BlogPostResponse>(
            `/blog/${encodeURIComponent(candidate)}`
          );
          const trSummary =
            post?.translations?.[lang]?.summary ||
            post?.translations?.tr?.summary;
          if (trSummary) {
            setBlogSummary(trSummary);
            break;
          }
        }
      }
      setLoading(false);
    }
    void loadEditorialPage();
  }, [slug, lang]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/60">
      <Header
        lang={lang}
        setLang={setLang}
        isLangOpen={isLangOpen}
        setIsLangOpen={setIsLangOpen}
        totalPkgs={0}
        setIsCartOpen={() => undefined}
        setCurrentPage={() => undefined}
        categories={categories}
        activeCategoryId=""
        displayCurrency={displayCurrency}
        onCurrencyChange={setDisplayCurrency}
      />

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 py-6 space-y-6">
        {/* Top Navigation & View Switcher */}
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
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900 no-underline transition-colors"
              >
                <Package size={14} />
                <span>Koleksiyon &amp; Ürün Vitrini ({totalProducts})</span>
              </Link>
              <Link
                href={`/ureticiler/${encodeURIComponent(slug)}/tanitim`}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-extrabold no-underline shadow-xs"
              >
                <BookOpen size={14} />
                <span>Firma Hikayesi &amp; Rehberi (Blog)</span>
              </Link>
            </div>
          )}
        </div>

        {loading && (
          <div className="py-20 text-center text-sm font-bold text-slate-500">
            Firma kurumsal tanıtım dosyası yükleniyor...
          </div>
        )}

        {!loading && !brand && (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
            <p className="text-base font-extrabold text-slate-800">
              Aradığınız üretici firma bulunamadı.
            </p>
            <Link
              href="/ureticiler"
              className="inline-flex px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold no-underline"
            >
              Firma Rehberine Git
            </Link>
          </div>
        )}

        {!loading && brand && (
          <>
            {/* Editorial Magazine Hero */}
            <header className="rounded-3xl bg-gradient-to-br from-emerald-50/90 via-white to-amber-50/70 border border-emerald-200/80 p-6 sm:p-10 shadow-xs space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100/90 border border-emerald-200 text-emerald-800 text-xs font-extrabold">
                  <ShieldCheck size={13} />
                  <span>DOĞRULANMIŞ MERTER ÜRETİCİ DOSYASI</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100/80 border border-amber-200 text-amber-900 text-xs font-bold">
                  <BookOpen size={13} />
                  <span>Kurumsal Tanıtım &amp; Toptan Alım Rehberi</span>
                </span>
              </div>

              <div className="space-y-2 max-w-4xl">
                <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-slate-900 leading-tight">
                  {brand.name} — Merter Toptan Giyim Üretim Gücü &amp; Koleksiyon Rehberi
                </h1>
                <p className="text-xs sm:text-base text-slate-600 leading-relaxed">
                  {brand.name} firmasının Merter üretim standartları, ürün grupları,
                  orijinal seri (asorti) paket yapısı, ihracat bölgeleri ve doğrudan
                  fabrika çıkış sipariş avantajları.
                </p>
              </div>

              {/* 4 Key Stats Strip */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                <div className="bg-white/90 rounded-2xl border border-emerald-200/70 p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                    <Package size={20} />
                  </div>
                  <div>
                    <div className="text-base sm:text-lg font-black text-slate-900">
                      {totalProducts}+ Model
                    </div>
                    <div className="text-[11px] font-semibold text-slate-500">
                      Aktif Toptan Koleksiyon
                    </div>
                  </div>
                </div>

                <div className="bg-white/90 rounded-2xl border border-amber-200/70 p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                    <Layers size={20} />
                  </div>
                  <div>
                    <div className="text-base sm:text-lg font-black text-slate-900">
                      Orijinal Seri
                    </div>
                    <div className="text-[11px] font-semibold text-slate-500">
                      Standart Beden Asortili Paket
                    </div>
                  </div>
                </div>

                <div className="bg-white/90 rounded-2xl border border-sky-200/70 p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center shrink-0">
                    <Truck size={20} />
                  </div>
                  <div>
                    <div className="text-base sm:text-lg font-black text-slate-900">
                      81 İl &amp; İhracat
                    </div>
                    <div className="text-[11px] font-semibold text-slate-500">
                      Hızlı &amp; Sigortalı Sevkiyat
                    </div>
                  </div>
                </div>

                <div className="bg-white/90 rounded-2xl border border-violet-200/70 p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-700 flex items-center justify-center shrink-0">
                    <MapPin size={20} />
                  </div>
                  <div>
                    <div className="text-base sm:text-lg font-black text-slate-900">
                      Merter / İstanbul
                    </div>
                    <div className="text-[11px] font-semibold text-slate-500">
                      %0 Komisyon Fabrika Çıkışı
                    </div>
                  </div>
                </div>
              </div>
            </header>

            {/* 2-Column Blog Content + Sticky Corporate Identity Sidebar */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-8 space-y-6">
                <EditorialArticleSections
                  brand={brand}
                  totalProducts={totalProducts}
                  blogSummary={blogSummary}
                />

                {/* Featured Products Preview */}
                {featuredProducts.length > 0 && (
                  <section className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-5 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h2 className="text-base sm:text-lg font-black text-slate-900">
                          {brand.name} — Seçkin Koleksiyon Modelleri
                        </h2>
                        <p className="text-xs text-slate-500">
                          Üreticinin vitrindeki güncel toptan seri modellerinden örnekler
                        </p>
                      </div>
                      <Link
                        href={`/ureticiler/${encodeURIComponent(slug)}`}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold no-underline shrink-0 shadow-xs"
                      >
                        <span>Tüm {totalProducts} Ürünü Gör</span>
                        <ArrowRight size={14} />
                      </Link>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                      {featuredProducts.slice(0, 8).map((prod, idx) => (
                        <ProductCard
                          key={prod.id}
                          product={prod}
                          lang={lang}
                          priority={idx < 4}
                          displayCurrency={displayCurrency}
                          exchangeRates={exchangeRates}
                          onOpenModal={() => {
                            const target = prod.slug || prod.id;
                            router.push(`/product/${target}`);
                          }}
                        />
                      ))}
                    </div>
                  </section>
                )}
              </div>

              <div className="lg:col-span-4">
                <SidebarIdentityCard
                  brand={brand}
                  slug={slug}
                  totalProducts={totalProducts}
                  isMemberLoggedIn={isMemberLoggedIn}
                  onOpenChat={() => setIsChatOpen(true)}
                />
              </div>
            </div>
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
          onAcceptOfferToCart={() => undefined}
        />
      )}

      <Footer lang={lang} onOpenPolicy={() => undefined} />
    </div>
  );
}

