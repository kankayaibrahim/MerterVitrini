"use client";

import React, { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  Globe,
  Layers,
  Package,
  ShieldCheck,
  Sparkles,
  Truck,
} from "lucide-react";
import Header from "@/components/store/Header";
import Footer from "@/components/store/Footer";
import ProductCard from "@/components/store/ProductCard";
import PolicyViewerModal from "@/components/store/PolicyViewerModal";
import { Brand, Category, Product } from "@/types/store";
import { getSupplierShowcaseHref } from "@/utils/subdomain";

export const TOPTAN_HAZIR_GIYIM_FAQS: ReadonlyArray<{
  question: string;
  answer: string;
}> = [
  {
    question: "Toptan hazır giyim siparişlerinde seri (asorti) sistemi nasıl işler?",
    answer:
      "Türkiye ve Merter toptan hazır giyim sektöründe ürünler tek adet değil, bir modelin farklı bedenlerini (örneğin S-M-L-XL veya 36-38-40-42) içeren kapalı seri paketleri halinde satılır. Bir seride genellikle 3 ila 8 adet ürün bulunur ve stok miktarları seri adedi üzerinden hesaplanır.",
  },
  {
    question: "Merter Vitrini'nde aracı komisyonu var mıdır?",
    answer:
      "Hayır. Merter Vitrini açık üretici vitrini modeliyle çalışır; toptan hazır giyim üreticilerinin firma ünvanı, showroom adresi, WhatsApp hattı ve IBAN bilgileri alıcıya şeffaf biçimde sunulur. Alıcılar doğrudan imalatçıyla aracısız çalışır.",
  },
  {
    question: "Butik veya Trendyol / Instagram mağazası için minimum kaç adet alım gerekir?",
    answer:
      "Hazır stoklu koleksiyonlarda birçok Merter üreticisi model başına 1 veya 2 seri (yaklaşık 4–8 parça) ile deneme ve butik siparişi kabul etmektedir. Özel etiket (Private Label) ve fason imalatta minimum üretim adedi modele ve kumaşa göre genellikle renk başına 100–300 adet aralığındadır.",
  },
  {
    question: "Merter, Laleli, Osmanbey ve Giyimkent toptan piyasaları arasındaki fark nedir?",
    answer:
      "Merter kadın günlük/trend giyim, ikili takım, triko ve erkek sokak modasında üretim merkezidir. Laleli ve Osmanbey daha çok ihracat odaklı abiye, klasik takım ve üst segment trikoya yoğunlaşır; Giyimkent ise kumaş, yan sanayi ve büyük depo ofislerine ev sahipliği yapar.",
  },
  {
    question: "Online toptan hazır giyim alırken XML entegrasyonu sağlanıyor mu?",
    answer:
      "Evet. Merter Vitrini üzerinden çalışan birçok üretici güncel stok ve seri fiyatlarını dijital katalog üzerinden sunar. Ayrıca e-ticaret ve pazaryeri entegrasyonları için standart ürün verileriyle hızlı stok senkronizasyonu yapılır.",
  },
  {
    question: "Yurtdışı toptan hazır giyim ihracatında ATR, EUR.1 ve kargo konsolidasyonu nasıl yapılır?",
    answer:
      "Avrupa Birliği, Balkanlar, BDT ve Orta Doğu'dan alım yapan firmalar farklı Merter üreticilerinden seçtikleri ürünleri İstanbul'da tek bir kargo paketinde birleştirebilir (konsolidasyon). İhracatçı üreticiler sipariş hacmine göre ATR, EUR.1 ve menşe belgelerini düzenler.",
  },
];

const HUB_CATEGORIES: ReadonlyArray<{
  title: string;
  subtitle: string;
  href: string;
}> = [
  {
    title: "Toptan Kadın Giyim",
    subtitle: "Günlük şık koleksiyonlar, trend parçalar ve serili butik modelleri",
    href: "/tr/kadin-giyim",
  },
  {
    title: "Toptan Elbise & Abiye",
    subtitle: "Yazlık, kışlık, davet ve ofis elbise grupları seri fiyatlarıyla",
    href: "/tr/kadin-giyim/elbise-abiye",
  },
  {
    title: "Toptan İkili Takım",
    subtitle: "Gömlek-pantolon, triko ve spor-şık hazır kombin serileri",
    href: "/tr/kadin-giyim/ikili-takim",
  },
  {
    title: "Toptan Triko, Kazak & Hırka",
    subtitle: "Doğrudan örgü ve triko fabrikalarından yeni sezon modelleri",
    href: "/tr/kadin-giyim/triko-hirka-kazak",
  },
  {
    title: "Toptan Büyük Beden Giyim",
    subtitle: "44–58 beden aralığında özel kalıp toptan kadın hazır giyim",
    href: "/tr/kadin-giyim/buyuk-beden",
  },
  {
    title: "Toptan Dış Giyim & Kaban",
    subtitle: "Trençkot, kaşe kaban, mont ve blazer ceket toptan serileri",
    href: "/tr/kadin-giyim/dis-giyim",
  },
  {
    title: "Toptan Erkek Giyim",
    subtitle: "Oversize t-shirt, sweatshirt, gömlek, pantolon ve streetwear",
    href: "/tr/erkek-giyim",
  },
  {
    title: "Son 7 Gün Yeni Ürünler",
    subtitle: "Üreticilerin yeni eklediği güncel toptan hazır giyim modelleri",
    href: "/tr/yeni-urunler",
  },
];

function subscribeStore(cb: () => void) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}

function getCurrencySnap(): string {
  if (typeof window === "undefined") return "TRY";
  return localStorage.getItem("merter_preferred_currency") || "TRY";
}

function getCurrencyServerSnap(): string {
  return "TRY";
}

function getCartSnap(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem("merter_b2b_cart");
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as Array<{ quantity?: number }>;
    return Array.isArray(parsed)
      ? parsed.reduce((acc, item) => acc + (Number(item.quantity) || 0), 0)
      : 0;
  } catch {
    return 0;
  }
}

function getCartServerSnap(): number {
  return 0;
}

interface ToptanHazirGiyimClientProps {
  readonly categories: readonly Category[];
  readonly featuredProducts: readonly Product[];
  readonly totalProductsCount: number;
  readonly activeBrands: readonly Brand[];
  readonly totalBrandsCount: number;
}

export default function ToptanHazirGiyimClient({
  categories,
  featuredProducts,
  totalProductsCount,
  activeBrands,
  totalBrandsCount,
}: Readonly<ToptanHazirGiyimClientProps>) {
  const router = useRouter();
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);
  const [isPolicyOpen, setIsPolicyOpen] = useState(false);
  const [policyType, setPolicyType] = useState<
    "cancellation_and_return" | "terms_of_service" | "privacy_policy" | ""
  >("");

  const displayCurrency = useSyncExternalStore(
    subscribeStore,
    getCurrencySnap,
    getCurrencyServerSnap
  );
  const totalPkgs = useSyncExternalStore(
    subscribeStore,
    getCartSnap,
    getCartServerSnap
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#FDFDFD] font-sans antialiased text-onyx">
      <Header
        lang="tr"
        setLang={(newLang) => {
          router.push(newLang === "tr" ? "/toptan-hazir-giyim" : `/${newLang}/tum-urunler`);
        }}
        isLangOpen={isLangOpen}
        setIsLangOpen={setIsLangOpen}
        totalPkgs={totalPkgs}
        setIsCartOpen={(open) => {
          if (open) router.push("/tr/cart");
        }}
        setSearchQuery={() => {}}
        setCurrentPage={() => {}}
        setActiveCategoryId={() => {}}
        categories={categories}
        activeCategoryId=""
        displayCurrency={displayCurrency}
        onCurrencyChange={(curr) => {
          localStorage.setItem("merter_preferred_currency", curr);
          window.dispatchEvent(new Event("storage"));
        }}
      />

      <main className="flex-grow max-w-[1440px] w-full mx-auto px-4 md:px-8 py-8 md:py-12 flex flex-col gap-12">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="text-xs font-semibold text-sonic-silver flex items-center gap-2">
          <Link href="/" className="hover:text-eerie-black no-underline text-inherit">
            Ana Sayfa
          </Link>
          <span>/</span>
          <span className="text-eerie-black font-bold">Toptan Hazır Giyim</span>
        </nav>

        {/* HERO */}
        <section className="rounded-2xl border border-[#E5E0D8] bg-gradient-to-br from-[#F8F6F2] via-white to-[#F4F0E8] p-6 md:p-10 shadow-xs">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[2px] text-[#6E542E] mb-3">
            <Sparkles className="w-4 h-4 text-[#8C6D3F]" />
            <span>TÜRKİYE &amp; MERTER B2B TEKSTİL SHOWROOM</span>
          </div>

          <h1 className="font-serif font-bold text-2xl sm:text-3xl md:text-4xl text-[#1C1C1C] tracking-tight leading-tight max-w-4xl">
            Toptan Hazır Giyim — İstanbul Merter Üreticilerinden Seri &amp; Paket B2B Tedarik
          </h1>

          <p className="mt-4 text-sm md:text-base text-[#404040] leading-relaxed max-w-3xl">
            Türkiye&apos;nin ve Avrupa&apos;nın en büyük hazır giyim üretim merkezi İstanbul Merter&apos;deki
            doğrulanmış imalatçı firmalardan aracısız toptan kadın giyim, erkek giyim, tesettür ve
            büyük beden koleksiyonlarına tek noktadan ulaşın. Fabrika çıkış seri fiyatları, düşük
            minimum sipariş adedi (MOQ) ve Private Label üretim seçenekleriyle mağazanızı güvenle besleyin.
          </p>

          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl">
            <div className="bg-white border border-[#E5E0D8] rounded-xl p-3.5">
              <span className="text-[10px] font-bold uppercase text-sonic-silver block">Aktif Toptan Model</span>
              <span className="text-xl font-extrabold text-eerie-black">
                {(totalProductsCount || featuredProducts.length).toLocaleString("tr-TR")}+
              </span>
            </div>
            <div className="bg-white border border-[#E5E0D8] rounded-xl p-3.5">
              <span className="text-[10px] font-bold uppercase text-sonic-silver block">Doğrulanmış Üretici</span>
              <span className="text-xl font-extrabold text-eerie-black">
                {(totalBrandsCount || activeBrands.length).toLocaleString("tr-TR")}+
              </span>
            </div>
            <div className="bg-white border border-[#E5E0D8] rounded-xl p-3.5">
              <span className="text-[10px] font-bold uppercase text-sonic-silver block">Komisyon Oranı</span>
              <span className="text-xl font-extrabold text-emerald-700">%0</span>
            </div>
            <div className="bg-white border border-[#E5E0D8] rounded-xl p-3.5">
              <span className="text-[10px] font-bold uppercase text-sonic-silver block">İhracat &amp; Kargo</span>
              <span className="text-xl font-extrabold text-eerie-black">50+ Ülke</span>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/tr/tum-urunler"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#1C1C1C] hover:bg-neutral-800 text-white text-xs font-extrabold uppercase tracking-wider no-underline transition-colors"
            >
              <Package size={15} />
              <span>Tüm Toptan Hazır Giyim Ürünleri</span>
              <ArrowRight size={14} />
            </Link>
            <Link
              href="/ureticiler"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white hover:bg-zinc-50 text-[#1C1C1C] border border-[#D6D1C7] text-xs font-extrabold uppercase tracking-wider no-underline transition-colors"
            >
              <Building2 size={15} className="text-[#8C6D3F]" />
              <span>Doğrulanmış Üreticiler Rehberi</span>
            </Link>
            <Link
              href="/tr/blog"
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-white hover:bg-zinc-50 text-zinc-700 border border-cultured text-xs font-bold no-underline transition-colors"
            >
              <span>B2B Satın Alma Rehberleri</span>
            </Link>
          </div>
        </section>

        {/* CATEGORY HUBS */}
        <section className="flex flex-col gap-5">
          <div className="flex items-end justify-between gap-4 border-b border-cultured pb-3">
            <div>
              <h2 className="font-serif font-bold text-2xl text-eerie-black">
                Toptan Hazır Giyim Ana Kategorileri
              </h2>
              <p className="text-xs text-sonic-silver mt-1">
                Kadın, erkek, tesettür, triko ve büyük beden gruplarında seri/paket stokları inceleyin.
              </p>
            </div>
            <Link
              href="/tr/tum-urunler"
              className="text-xs font-bold text-salmon-pink hover:underline no-underline shrink-0"
            >
              Tüm Kategoriler →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {HUB_CATEGORIES.map((cat) => (
              <Link
                key={cat.href}
                href={cat.href}
                className="group bg-white border border-cultured hover:border-eerie-black rounded-2xl p-5 flex flex-col gap-2 transition-all no-underline text-inherit shadow-xs hover:shadow-md"
              >
                <div className="flex items-center justify-between gap-2">
                  <Layers size={16} className="text-[#8C6D3F]" />
                  <ArrowRight
                    size={14}
                    className="text-zinc-400 group-hover:text-eerie-black group-hover:translate-x-0.5 transition-all"
                  />
                </div>
                <h3 className="font-bold text-sm text-eerie-black">{cat.title}</h3>
                <p className="text-xs text-sonic-silver leading-relaxed">{cat.subtitle}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* LIVE VERIFIED MANUFACTURERS */}
        {activeBrands.length > 0 && (
          <section className="flex flex-col gap-5">
            <div className="flex items-end justify-between gap-4 border-b border-cultured pb-3">
              <div>
                <h2 className="font-serif font-bold text-2xl text-eerie-black">
                  Doğrulanmış Toptan Hazır Giyim Üreticileri
                </h2>
                <p className="text-xs text-sonic-silver mt-1">
                  Merter showroom bilgileri açık olan imalatçı ve toptancı vitrinlerine doğrudan erişin.
                </p>
              </div>
              <Link
                href="/ureticiler"
                className="text-xs font-bold text-salmon-pink hover:underline no-underline shrink-0"
              >
                Tüm Üreticiler →
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {activeBrands.map((brand) => {
                const href = getSupplierShowcaseHref(brand, "tr");
                return (
                  <Link
                    key={brand.id}
                    href={href}
                    className="bg-white border border-cultured hover:border-eerie-black rounded-xl p-4 flex flex-col gap-1.5 transition-all no-underline text-inherit"
                  >
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                      <ShieldCheck size={12} />
                      <span>Doğrulanmış</span>
                    </span>
                    <span className="font-bold text-sm text-eerie-black line-clamp-1">
                      {brand.name}
                    </span>
                    <span className="text-[11px] text-sonic-silver">
                      {brand.active_product_count || 0} Toptan Model
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* LIVE FEATURED PRODUCTS */}
        {featuredProducts.length > 0 && (
          <section className="flex flex-col gap-5">
            <div className="flex items-end justify-between gap-4 border-b border-cultured pb-3">
              <div>
                <h2 className="font-serif font-bold text-2xl text-eerie-black">
                  Yeni Sezon Toptan Hazır Giyim Modelleri
                </h2>
                <p className="text-xs text-sonic-silver mt-1">
                  Üreticilerin yeni eklediği güncel seri ve paket koleksiyonları.
                </p>
              </div>
              <Link
                href="/tr/yeni-urunler"
                className="text-xs font-bold text-salmon-pink hover:underline no-underline shrink-0"
              >
                Son 7 Gün Yeni Ürünler →
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {featuredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  lang="tr"
                  onOpenModal={() => {
                    router.push(`/product/${product.slug || product.id}`);
                  }}
                  displayCurrency={displayCurrency}
                  exchangeRates={[]}
                />
              ))}
            </div>
          </section>
        )}

        {/* EDITORIAL B2B BUYING GUIDE */}
        <article className="bg-white border border-cultured rounded-2xl p-6 md:p-10 flex flex-col gap-6 leading-relaxed text-sm text-[#333333]">
          <h2 className="font-serif font-bold text-2xl md:text-3xl text-eerie-black">
            Türkiye Toptan Hazır Giyim Piyasası ve B2B Satın Alma Rehberi (2026)
          </h2>

          <p>
            Türkiye, güçlü kumaş dokuma ve boyahane altyapısı, hızlı numune çıkarma kabiliyeti ve
            Avrupa&apos;ya yakın lojistik konumuyla küresel <strong>toptan hazır giyim</strong>{" "}
            tedariğinin ana üslerinden biridir. Yerli butik sahiplerinden Trendyol ve Hepsiburada gibi
            pazaryeri satıcılarına, Avrupa, Balkanlar, BDT ülkeleri ve Orta Doğu&apos;daki zincir
            mağazalara kadar on binlerce alıcı her sezon koleksiyonlarını İstanbul tekstil
            merkezlerinden tedarik etmektedir.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-2">
            <div className="bg-[#F8F6F2] border border-[#E5E0D8] rounded-xl p-4 flex flex-col gap-1.5">
              <CheckCircle2 size={18} className="text-emerald-700" />
              <h3 className="font-bold text-sm text-eerie-black">Seri (Asorti) Paket Sistemi</h3>
              <p className="text-xs text-[#4A4A4A]">
                Toptan kıyafetlerde her model renk bazında S-M-L-XL veya 36-42 beden dağılımıyla
                kapalı seri olarak hazırlanır; stok planlaması seri çarpanıyla yönetilir.
              </p>
            </div>
            <div className="bg-[#F8F6F2] border border-[#E5E0D8] rounded-xl p-4 flex flex-col gap-1.5">
              <Truck size={18} className="text-[#8C6D3F]" />
              <h3 className="font-bold text-sm text-eerie-black">Konsolide İhracat &amp; Kargo</h3>
              <p className="text-xs text-[#4A4A4A]">
                Merter&apos;deki farklı üreticilerden seçtiğiniz modelleri tek sevkiyatta
                birleştirerek yurt içi ambar veya ATR/EUR.1 belgeli yurtdışı kargo avantajı elde edersiniz.
              </p>
            </div>
            <div className="bg-[#F8F6F2] border border-[#E5E0D8] rounded-xl p-4 flex flex-col gap-1.5">
              <Globe size={18} className="text-indigo-700" />
              <h3 className="font-bold text-sm text-eerie-black">Fason &amp; Private Label</h3>
              <p className="text-xs text-[#4A4A4A]">
                Hazır toptan stokların yanı sıra kendi markanızın etiketiyle özel üretim yapan Merter
                ve Güngören atölyeleriyle doğrudan iletişime geçebilirsiniz.
              </p>
            </div>
          </div>

          <h3 className="font-bold text-lg text-eerie-black mt-2">
            İstanbul&apos;daki Başlıca Toptan Hazır Giyim Merkezleri Karşılaştırması
          </h3>
          <div className="overflow-x-auto border border-cultured rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-zinc-50 border-b border-cultured text-eerie-black font-bold uppercase">
                <tr>
                  <th className="py-3 px-4">Merkez</th>
                  <th className="py-3 px-4">Öne Çıkan Ürün Grupları</th>
                  <th className="py-3 px-4">Hedef Alıcı Profili</th>
                  <th className="py-3 px-4">Sipariş Yapısı</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cultured">
                <tr>
                  <td className="py-3 px-4 font-bold text-eerie-black">Merter (Güngören)</td>
                  <td className="py-3 px-4">Kadın elbise, ikili takım, triko, tesettür, erkek streetwear</td>
                  <td className="py-3 px-4">Yurt içi butikler, e-ticaret markaları, global toptancılar</td>
                  <td className="py-3 px-4">Hazır seri (4–8 parça), Private Label &amp; fason</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-eerie-black">Laleli &amp; Osmanbey</td>
                  <td className="py-3 px-4">Abiye, klasik bayan giyim, üst segment triko ve takım</td>
                  <td className="py-3 px-4">BDT, Doğu Avrupa, Orta Doğu butik &amp; mağazaları</td>
                  <td className="py-3 px-4">İhracat serisi ve sezonluk koleksiyon</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-eerie-black">Giyimkent (Esenler)</td>
                  <td className="py-3 px-4">Kumaş, astar, yan sanayi ve büyük hacimli toptan depolar</td>
                  <td className="py-3 px-4">Üreticiler, zincir mağaza satın alma ekipleri</td>
                  <td className="py-3 px-4">Top/metre kumaş &amp; parti stok tedarik</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="font-bold text-lg text-eerie-black mt-2">
            E-Ticaret, Butikler ve Kurumsal Alıcılar İçin Doğrudan İmalatçı Avantajı
          </h3>
          <p>
            Geleneksel aracı toptan sitelerinden farklı olarak{" "}
            <Link href="/ureticiler" className="text-eerie-black font-bold underline">
              Merter Vitrini Doğrulanmış Üreticiler Rehberi
            </Link>{" "}
            üzerinden her ürünün gerçek üreticisini, açık adresini ve WhatsApp satış temsilcisini
            görürsünüz. Böylece hem <Link href="/tr/kadin-giyim" className="underline font-semibold">toptan kadın giyim</Link>{" "}
            hem de <Link href="/tr/erkek-giyim" className="underline font-semibold">toptan erkek giyim</Link>{" "}
            kategorilerinde aracısız fabrika fiyatlarıyla kâr marjınızı korursunuz.
          </p>
        </article>

        {/* FAQ ACCORDION */}
        <section className="flex flex-col gap-4">
          <h2 className="font-serif font-bold text-2xl text-eerie-black">
            Toptan Hazır Giyim Hakkında Sıkça Sorulan Sorular
          </h2>
          <div className="flex flex-col gap-3">
            {TOPTAN_HAZIR_GIYIM_FAQS.map((faq, idx) => {
              const isOpen = openFaqIdx === idx;
              return (
                <div
                  key={faq.question}
                  className="bg-white border border-cultured rounded-2xl overflow-hidden shadow-xs"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                    className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left font-bold text-sm text-eerie-black cursor-pointer bg-white border-none"
                  >
                    <span>{faq.question}</span>
                    <ChevronDown
                      size={16}
                      className={`shrink-0 text-sonic-silver transition-transform ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 text-xs md:text-sm text-[#4A4A4A] leading-relaxed border-t border-cultured/60 pt-3">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <Footer
        lang="tr"
        onOpenPolicy={(type) => {
          setPolicyType(type);
          setIsPolicyOpen(true);
        }}
      />

      <PolicyViewerModal
        isOpen={isPolicyOpen}
        onClose={() => {
          setIsPolicyOpen(false);
          setPolicyType("");
        }}
        policyType={policyType}
        lang="tr"
      />
    </div>
  );
}
