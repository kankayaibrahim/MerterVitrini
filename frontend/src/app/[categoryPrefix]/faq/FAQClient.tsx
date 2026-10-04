"use client";

import React, { useState, useMemo, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { 
  HelpCircle, 
  Search, 
  ChevronDown, 
  MessageSquare, 
  Phone, 
  Mail, 
  Sparkles, 
  ShieldCheck, 
  CreditCard, 
  Truck, 
  Tag,
  Box
} from "lucide-react";
import Header from "@/components/store/Header";
import Footer from "@/components/store/Footer";
import PolicyViewerModal from "@/components/store/PolicyViewerModal";
import SafeHtml from "@/components/common/SafeHtml";
import { Category } from "@/types/store";

export interface StoreSettings {
  id: string;
  address: string;
  phone: string;
  whatsapp: string;
  email: string;
  show_single_price: boolean;
  updated_at: string;
}

export interface FAQCMSPage {
  id: string;
  slug: string;
  is_active: boolean;
  translations: Record<string, {
    title: string;
    content: string;
    meta_title?: string | null;
    meta_description?: string | null;
  }>;
}

export interface Language {
  code: string;
  label: string;
  flag: string;
  categoryPrefix: string;
  dir?: string;
  isActive: boolean;
  sortOrder: number;
}

interface FAQClientProps {
  readonly categoryPrefix: string;
  readonly categories: readonly Category[];
  readonly activeLangs: readonly Language[];
  readonly settings: StoreSettings;
  readonly cmsPage: FAQCMSPage | null;
}

function subscribeCurrency(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getCurrencySnapshot(): string {
  if (typeof window === "undefined") return "TRY";
  return localStorage.getItem("merter_preferred_currency") || "TRY";
}

function getCurrencyServerSnapshot(): string {
  return "TRY";
}

interface FAQItem {
  id: string;
  category: "order" | "payment" | "shipping" | "quality";
  q: string;
  a: string;
}

const FAQ_ITEMS: Record<string, FAQItem[]> = {
  tr: [
    {
      id: "tr-1",
      category: "order",
      q: "Minimum toptan sipariş miktarı (MOQ) nedir? Tek parça alabilir miyim?",
      a: "Merter Vitrini yalnızca B2B toptan alıcılara hizmet vermektedir. Ürünlerimiz perakende değil, üretici beden kırılımlı asorti seri paketleri (örneğin 3'lü, 4'lü veya 6'lı seriler: S, M, L / 2-2-2) halinde satılmaktadır. Bir modelden minimum 1 seri paket satın alabilirsiniz."
    },
    {
      id: "tr-2",
      category: "order",
      q: "Seri (asorti) paketi içeriği nasıl belirlenir?",
      a: "Seri paketleri doğrudan üretici markaların (MIMOZA, FLORA, EDUSA vb.) ihracat standartlarında hazırlanır. Ürün kartında belirtilen seri oranı (örneğin 2-2-2) her bedenden o pakette kaç adet bulunduğunu gösterir."
    },
    {
      id: "tr-3",
      category: "order",
      q: "Sitedeki toptan fiyatlara KDV ve kargo dahil midir?",
      a: "Sitemizde görüntülenen toptan fiyatlar imalat çıkış fiyatları olup KDV ve nakliye ücretleri hariçtir. İhracat ve yurt dışı alımlarında KDV muafiyetli faturalandırma yapılmaktadır."
    },
    {
      id: "tr-4",
      category: "payment",
      q: "Hangi ödeme yöntemlerini kabul ediyorsunuz?",
      a: "Banka Havalesi / EFT (USD, EUR, TRY döviz hesaplarımıza), Uluslararası SWIFT Transferi ve 3D Secure Güvenli Kredi Kartı ile online ödeme kabul etmekteyiz."
    },
    {
      id: "tr-5",
      category: "payment",
      q: "Farklı para birimlerinde (USD / EUR) faturalandırma yapılabilir mi?",
      a: "Evet. TCMB günlük efektif döviz kurları üzerinden USD veya EUR cinsinden resmi ihracat faturası düzenlenebilmektedir."
    },
    {
      id: "tr-6",
      category: "shipping",
      q: "Yurt dışına kargo gönderimi nasıl yapılıyor?",
      a: "Anlaşmalı uluslararası hava ve kara kargo acentelerimiz aracılığıyla 120+ ülkeye kapıdan kapıya sigortalı sevkiyat yapılmaktadır. Alternatif olarak İstanbul Laleli, Merter veya Osmanbey'deki kendi çalıştığınız kargo acentesine ücretsiz teslimat sağlıyoruz."
    },
    {
      id: "tr-7",
      category: "shipping",
      q: "Sipariş verildikten sonra teslimat ne kadar sürer?",
      a: "Stoklu ürünlerimiz sipariş ve ödeme onayının ardından aynı gün veya en geç 24 saat içinde kargoya veya acentenize teslim edilir. Yurt dışı teslimat süresi seçilen hava/kara nakliye türüne göre 3 ila 7 iş günü arasındadır."
    },
    {
      id: "tr-8",
      category: "quality",
      q: "Kendi butik markam için özel etiketleme (Private Label) yaptırabilir miyim?",
      a: "Evet. Belirli asorti koli hacimlerini karşılayan kurumsal müşterilerimiz için kendi marka etiketlerinizle dikim, ambalajlama ve barkodlama hizmeti sunulmaktadır."
    },
    {
      id: "tr-9",
      category: "quality",
      q: "Hatalı veya defolu bir ürünle karşılaşırsam ne yapmalıyım?",
      a: "Tüm koli ve seriler sevkiyat öncesi barkodlu kalite denetiminden geçer. Olası bir üretim hatası durumunda 48 saat içinde WhatsApp hattımıza ürün görselini ileterek değişim veya bakiye iadesi talep edebilirsiniz."
    }
  ],
  en: [
    {
      id: "en-1",
      category: "order",
      q: "What is the Minimum Order Quantity (MOQ)? Can I buy single pieces?",
      a: "Merter Vitrini is exclusively a B2B wholesale platform. Garments are not sold as single pieces; they are packaged in manufacturer assorted size series (e.g., 3-pack, 4-pack, or 6-pack: S, M, L / 2-2-2). The minimum order is 1 pack per style."
    },
    {
      id: "en-2",
      category: "order",
      q: "How does the series (assortment) packaging work?",
      a: "Series packs follow export specifications set by Merter manufacturers (such as MIMOZA, FLORA, EDUSA). The series breakdown indicates how many pieces of each size (e.g., 2 Small, 2 Medium, 2 Large) are included in that bundle."
    },
    {
      id: "en-3",
      category: "payment",
      q: "What payment methods are supported?",
      a: "We accept International SWIFT Wire Transfer, Bank Wire (USD, EUR, TRY), and Secure Online Credit Card payments protected by 3D Secure."
    },
    {
      id: "en-4",
      category: "shipping",
      q: "How do you handle international worldwide shipping?",
      a: "We dispatch cargo to over 120 countries via air and road freight. Alternatively, we provide free local delivery to your designated cargo office in Merter, Laleli, or Osmanbey (Istanbul)."
    },
    {
      id: "en-5",
      category: "quality",
      q: "Do you offer private labeling (OEM) for boutiques?",
      a: "Yes. For qualifying wholesale order volumes, custom neck labels, hangtags, barcodes, and custom packaging can be arranged."
    }
  ],
  ru: [
    {
      id: "ru-1",
      category: "order",
      q: "Какой минимальный объем заказа (MOQ)? Можно ли купить поштучно?",
      a: "Merter Vitrini работает исключительно как оптовая B2B площадка. Товар продается фабричными размерными рядами (сериями: S, M, L / 2-2-2). Минимальный заказ — от 1 серии на модель."
    },
    {
      id: "ru-2",
      category: "shipping",
      q: "Как доставляется товар в Россию и страны СНГ?",
      a: "Мы бесплатно доставляем ваш заказ до вашего карго-перевозчика в районах Мертер или Лалели в Стамбуле. Также возможна прямая отправка авиа или авто карго."
    },
    {
      id: "ru-3",
      category: "payment",
      q: "Какие способы оплаты доступны для иностранных клиентов?",
      a: "Международный перевод SWIFT, безналичный расчет в USD, EUR, RUB и оплата картой онлайн."
    }
  ],
  ar: [
    {
      id: "ar-1",
      category: "order",
      q: "ما هو الحد الأدنى للطلب (MOQ)؟ هل يمكن الشراء بالقطعة؟",
      a: "منصة مرتر فيتريني مخصصة لتجارة الجملة B2B فقط. تباع المنتجات في حزم مقاسات متناسقة (سيري: S, M, L / 2-2-2)، والحد الأدنى هو حزمة واحدة لكل موديل."
    },
    {
      id: "ar-2",
      category: "shipping",
      q: "كيف يتم شحن البضائع للدول العربية؟",
      a: "نوفر شحناً جوياً وبرياً وبحرياً لجميع الدول، بالإضافة لتسليم مجاني لمكتب الشحن الخاص بكم في مرتر أو لالالي بإسطنبول."
    },
    {
      id: "ar-3",
      category: "payment",
      q: "ما هي طرق الدفع المعتمدة؟",
      a: "التحويل البنكي الدولي (SWIFT)، الدفع المباشر بالدولار أو اليورو، والدفع الإلكتروني الآمن بالبطاقات الائتمانية."
    }
  ]
};

const UI_TEXTS: Record<string, Record<string, string>> = {
  tr: {
    heroBadge: "B2B Toptan Yardım & Rehber Merkezi",
    heroTitle: "Sıkça Sorulan Sorular (SSS)",
    heroSubtitle: "Merter tekstil piyasasında toptan hazır giyim alımları, asorti koli düzeni, minimum sipariş miktarı (MOQ), yurt dışı kargo ve ödeme süreçleri hakkında merak edilen tüm soruların yanıtları.",
    breadcrumbHome: "Ana Sayfa",
    breadcrumbFAQ: "Sıkça Sorulan Sorular",
    searchPlaceholder: "Soru veya anahtar kelime arayın (Örn: kargo, ödeme, asorti, minimum sipariş)...",
    tabAll: "Tüm Sorular",
    tabOrder: "Sipariş & Asorti",
    tabPayment: "Ödeme & Fatura",
    tabShipping: "Kargo & Lojistik",
    tabQuality: "Kalite & İade",
    noResults: "Aradığınız kriterlere uygun soru bulunamadı. Lütfen farklı bir arama yapın veya doğrudan WhatsApp hattımıza yazın.",
    helpTitle: "Sorunuza Yanıt Bulamadınız mı?",
    helpSubtitle: "7/24 B2B Müşteri Temsilcimiz canlı olarak tüm toptan alım sorularınızı yanıtlamaya hazırdır.",
    chatWhatsappBtn: "WhatsApp'tan Canlı Sorun",
    callBtn: "Müşteri Hizmetlerini Arayın",
    emailBtn: "E-Posta Gönderin",
    cmsSectionTitle: "Toptan Satış Rehberi ve Önemli Notlar",
  },
  en: {
    heroBadge: "B2B Wholesale Support & FAQ Hub",
    heroTitle: "Frequently Asked Questions",
    heroSubtitle: "Everything you need to know about wholesale garment sourcing from Istanbul Merter: series breakdowns, MOQ, international freight forwarding, and payment options.",
    breadcrumbHome: "Home",
    breadcrumbFAQ: "FAQ",
    searchPlaceholder: "Search question or keyword (e.g. shipping, payment, MOQ, series)...",
    tabAll: "All Questions",
    tabOrder: "Ordering & Series",
    tabPayment: "Payment & Tax",
    tabShipping: "Freight & Delivery",
    tabQuality: "Quality & Returns",
    noResults: "No matching questions found. Please try a different query or contact our WhatsApp support team.",
    helpTitle: "Still Have Questions?",
    helpSubtitle: "Our international B2B export specialists are ready to assist you in real time.",
    chatWhatsappBtn: "Chat on WhatsApp",
    callBtn: "Call Support",
    emailBtn: "Send Email",
    cmsSectionTitle: "Wholesale Buying Guide & Notes",
  },
  ru: {
    heroBadge: "B2B Центр Поддержки и Вопросов",
    heroTitle: "Часто Задаваемые Вопросы",
    heroSubtitle: "Вся необходимая информация об оптовых закупках турецкой одежды в Мертере: размерные ряды, минимальный заказ, доставка карго и оплата.",
    breadcrumbHome: "Главная",
    breadcrumbFAQ: "FAQ",
    searchPlaceholder: "Поиск по вопросам (например: карго, оплата, серии, заказ)...",
    tabAll: "Все Вопросы",
    tabOrder: "Заказ и Серии",
    tabPayment: "Оплата",
    tabShipping: "Доставка Карго",
    tabQuality: "Качество и Возврат",
    noResults: "По вашему запросу ничего не найдено. Напишите нам напрямую в WhatsApp.",
    helpTitle: "Остались Вопросы?",
    helpSubtitle: "Наши русскоязычные менеджеры готовы проконсультировать вас прямо сейчас.",
    chatWhatsappBtn: "Написать в WhatsApp",
    callBtn: "Позвонить",
    emailBtn: "Написать на E-mail",
    cmsSectionTitle: "Руководство по Оптовым Закупкам",
  },
  ar: {
    heroBadge: "مركز الدعم والأسئلة الشائعة B2B",
    heroTitle: "الأسئلة الشائعة",
    heroSubtitle: "كل ما تحتاج لمعرفته حول تجارة الملابس بالجملة في مرتر إسطنبول: حزم السيري، الحد الأدنى للطلب، الشحن الدولي وطرق الدفع.",
    breadcrumbHome: "الرئيسية",
    breadcrumbFAQ: "الأسئلة الشائعة",
    searchPlaceholder: "ابحث عن سؤال أو كلمة (مثل: شحن، دفع، سيري، كميات)...",
    tabAll: "جميع الأسئلة",
    tabOrder: "الطلب والحزم",
    tabPayment: "الدفع والفواتير",
    tabShipping: "الشحن الدولي",
    tabQuality: "الجودة والضمان",
    noResults: "لم يتم العثور على نتائج مطابقة. يرجى التواصل معنا عبر واتساب للمساعدة الفورية.",
    helpTitle: "هل لديك استفسار آخر؟",
    helpSubtitle: "فريق المبيعات متاح للإجابة على جميع استفساراتكم باللغة العربية فوراً.",
    chatWhatsappBtn: "تواصل عبر واتساب",
    callBtn: "اتصل بنا",
    emailBtn: "إرسال بريد إلكتروني",
    cmsSectionTitle: "دليل تجارة الجملة وملاحظات هامة",
  }
};

export default function FAQClient({
  categoryPrefix,
  categories,
  activeLangs,
  settings,
  cmsPage
}: Readonly<FAQClientProps>) {
  const router = useRouter();

  // Match current language
  const prefixToLangMap = new Map<string, string>();
  activeLangs.forEach((l) => {
    if (!prefixToLangMap.has(l.categoryPrefix) || l.code === "tr" || l.code === "en") {
      prefixToLangMap.set(l.categoryPrefix, l.code);
    }
  });
  
  const currentLang = prefixToLangMap.get(categoryPrefix) || "tr";
  const texts = UI_TEXTS[currentLang] || UI_TEXTS.tr;
  const questionsList = FAQ_ITEMS[currentLang] || FAQ_ITEMS.tr;

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({
    [questionsList[0]?.id || "0"]: true
  });

  // Modals and UI states
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState<boolean>(false);
  const [policyModalType, setPolicyModalType] = useState<"cancellation_and_return" | "terms_of_service" | "privacy_policy" | "">("");
  const [isLangOpen, setIsLangOpen] = useState<boolean>(false);

  // Currency external store
  const displayCurrency = useSyncExternalStore(subscribeCurrency, getCurrencySnapshot, getCurrencyServerSnapshot);

  const handleCurrencyChange = (curr: string) => {
    localStorage.setItem("merter_preferred_currency", curr);
    window.dispatchEvent(new Event("storage"));
  };

  const handleLangChange = (newLang: string) => {
    const matchLang = activeLangs.find((l) => l.code === newLang);
    if (matchLang) {
      router.push(`/${matchLang.categoryPrefix}/faq`);
    }
  };

  const toggleItem = (id: string) => {
    setOpenItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const filteredQuestions = useMemo(() => {
    return questionsList.filter((item) => {
      const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
      const qLower = item.q.toLowerCase();
      const aLower = item.a.toLowerCase();
      const sLower = searchQuery.toLowerCase().trim();
      const matchesSearch = !sLower || qLower.includes(sLower) || aLower.includes(sLower);
      return matchesCategory && matchesSearch;
    });
  }, [questionsList, selectedCategory, searchQuery]);

  const sanitizedWhatsapp = (settings.whatsapp || "+90 533 703 08 83").replace(/\D/g, "");
  const whatsappUrl = `https://wa.me/${sanitizedWhatsapp}?text=${encodeURIComponent("Merhaba, Merter Vitrini toptan alım süreci hakkında soru sormak istiyorum.")}`;
  const phoneTelUrl = `tel:${(settings.phone || "+90 533 703 08 83").replace(/\s/g, "")}`;
  const emailMailtoUrl = `mailto:${settings.email || "info@toptanmoda.net"}?subject=${encodeURIComponent("B2B Toptan SSS ve Danışma")}`;

  // Check if CMS translation exists
  const cmsTranslation = cmsPage?.translations?.[currentLang] || cmsPage?.translations?.tr || cmsPage?.translations?.en;

  // Schema.org FAQPage Structured Data
  const jsonLdData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": questionsList.map((item) => ({
      "@type": "Question",
      "name": item.q,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": item.a
      }
    }))
  };

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50/70 text-zinc-900 font-sans antialiased selection:bg-zinc-950 selection:text-white">
      {/* FAQPage JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdData) }}
      />

      {/* Main Storefront Header */}
      <Header
        lang={currentLang}
        setLang={handleLangChange}
        isLangOpen={isLangOpen}
        setIsLangOpen={setIsLangOpen}
        totalPkgs={0}
        setIsCartOpen={() => {}}
        setSearchQuery={() => {}}
        setCurrentPage={() => {}}
        setActiveCategoryId={() => {}}
        categories={categories}
        activeCategoryId=""
        displayCurrency={displayCurrency}
        onCurrencyChange={handleCurrencyChange}
      />

      {/* Breadcrumb Navigation */}
      <div className="w-full bg-white border-b border-zinc-200/60 py-3 px-6 md:px-12 text-xs text-zinc-500 font-medium">
        <div className="max-w-[1440px] mx-auto flex items-center gap-2">
          <a href={`/${categoryPrefix}`} className="hover:text-zinc-950 transition-colors">
            {texts.breadcrumbHome}
          </a>
          <span className="text-zinc-300">/</span>
          <span className="text-zinc-900 font-semibold">{texts.breadcrumbFAQ}</span>
        </div>
      </div>

      <main className="flex-1 w-full max-w-[1440px] mx-auto px-6 md:px-12 py-10 flex flex-col gap-12">
        
        {/* Top Hero Section with Search Input - Light Showroom Design */}
        <section className="relative overflow-hidden rounded-3xl bg-white text-zinc-900 p-8 md:p-14 border border-zinc-200/80 shadow-sm">
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-zinc-100/80 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-1/4 -mb-20 w-72 h-72 rounded-full bg-amber-50/50 blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl flex flex-col gap-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-800 text-[11px] font-bold w-fit tracking-wider uppercase">
              <Sparkles size={14} className="text-zinc-600" />
              {texts.heroBadge}
            </div>

            <h1 className="text-3xl md:text-5xl font-black tracking-tight text-zinc-950 leading-tight">
              {texts.heroTitle}
            </h1>

            <p className="text-sm md:text-base text-zinc-600 leading-relaxed font-normal">
              {texts.heroSubtitle}
            </p>

            {/* Live Interactive Search Box */}
            <div className="relative mt-4 max-w-2xl">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={texts.searchPlaceholder}
                className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 text-zinc-900 placeholder-zinc-400 text-sm focus:outline-none focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10 transition-all shadow-inner"
              />
            </div>
          </div>
        </section>

        {/* Category Filter Pills */}
        <section className="flex flex-wrap gap-2.5 items-center">
          <button
            type="button"
            onClick={() => setSelectedCategory("all")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedCategory === "all"
                ? "bg-zinc-950 text-white shadow-sm"
                : "bg-white text-zinc-600 border border-zinc-200 hover:border-zinc-300"
            }`}
          >
            {texts.tabAll}
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory("order")}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedCategory === "order"
                ? "bg-zinc-950 text-white shadow-sm"
                : "bg-white text-zinc-600 border border-zinc-200 hover:border-zinc-300"
            }`}
          >
            <Box size={14} />
            {texts.tabOrder}
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory("payment")}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedCategory === "payment"
                ? "bg-zinc-950 text-white shadow-sm"
                : "bg-white text-zinc-600 border border-zinc-200 hover:border-zinc-300"
            }`}
          >
            <CreditCard size={14} />
            {texts.tabPayment}
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory("shipping")}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedCategory === "shipping"
                ? "bg-zinc-950 text-white shadow-sm"
                : "bg-white text-zinc-600 border border-zinc-200 hover:border-zinc-300"
            }`}
          >
            <Truck size={14} />
            {texts.tabShipping}
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory("quality")}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedCategory === "quality"
                ? "bg-zinc-950 text-white shadow-sm"
                : "bg-white text-zinc-600 border border-zinc-200 hover:border-zinc-300"
            }`}
          >
            <Tag size={14} />
            {texts.tabQuality}
          </button>
        </section>

        {/* Accordion Questions List */}
        <section className="flex flex-col gap-4">
          {filteredQuestions.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-zinc-200/80 shadow-sm flex flex-col items-center justify-center gap-3">
              <HelpCircle size={40} className="text-zinc-300" />
              <p className="text-xs font-semibold text-zinc-500 max-w-md">
                {texts.noResults}
              </p>
            </div>
          ) : (
            filteredQuestions.map((item) => {
              const isOpen = Boolean(openItems[item.id]);
              return (
                <div 
                  key={item.id}
                  className={`bg-white rounded-2xl border transition-all overflow-hidden ${
                    isOpen ? "border-zinc-950 shadow-sm ring-1 ring-zinc-950/5" : "border-zinc-200/80 shadow-sm hover:border-zinc-300"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleItem(item.id)}
                    className="w-full p-6 text-left flex items-center justify-between gap-4 cursor-pointer select-none"
                  >
                    <span className="text-base font-bold text-zinc-950 flex items-center gap-3">
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                        isOpen ? "bg-zinc-950 text-white" : "bg-zinc-100 text-zinc-600"
                      }`}>
                        ?
                      </span>
                      {item.q}
                    </span>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-transform duration-200 ${
                      isOpen ? "rotate-180 bg-zinc-100 text-zinc-900" : "text-zinc-400 bg-zinc-50"
                    }`}>
                      <ChevronDown size={18} />
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-6 pb-6 pt-0 animate-in fade-in duration-200">
                      <div className="border-t border-zinc-100 pt-4 text-xs md:text-sm text-zinc-600 leading-relaxed pl-11">
                        {item.a}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </section>

        {/* Dynamic CMS Custom Section */}
        {cmsTranslation?.content && (
          <section className="bg-white rounded-3xl p-8 md:p-12 border border-zinc-200/80 shadow-sm flex flex-col gap-6">
            <div className="border-b border-zinc-100 pb-4">
              <h2 className="text-2xl md:text-3xl font-black text-zinc-950 tracking-tight">
                {cmsTranslation.title || texts.cmsSectionTitle}
              </h2>
            </div>
            <div className="prose prose-zinc max-w-none text-sm text-zinc-700 leading-relaxed">
              <SafeHtml html={cmsTranslation.content} />
            </div>
          </section>
        )}

        {/* Bottom Fast Help & WhatsApp Callout - Clean Light Theme */}
        <section className="rounded-3xl bg-white text-zinc-900 p-8 md:p-10 shadow-sm border border-zinc-200/80 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col gap-1.5 text-center md:text-left">
            <div className="inline-flex items-center gap-1.5 text-zinc-500 text-xs font-bold uppercase tracking-wider justify-center md:justify-start">
              <ShieldCheck size={16} />
              7/24 B2B Toptan Destek
            </div>
            <h3 className="text-xl md:text-2xl font-black text-zinc-950">
              {texts.helpTitle}
            </h3>
            <p className="text-xs text-zinc-600 max-w-lg leading-relaxed">
              {texts.helpSubtitle}
            </p>
          </div>

          <div className="flex flex-wrap gap-3 shrink-0">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white text-xs font-bold shadow-md shadow-emerald-900/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <MessageSquare size={16} />
              {texts.chatWhatsappBtn}
            </a>
            <a
              href={phoneTelUrl}
              className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-xs font-bold border border-zinc-200 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Phone size={16} />
              {texts.callBtn}
            </a>
            <a
              href={emailMailtoUrl}
              className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-xs font-bold border border-zinc-200 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Mail size={16} />
              E-Posta
            </a>
          </div>
        </section>

      </main>

      {/* Main Storefront Footer */}
      <Footer
        lang={currentLang}
        onOpenPolicy={(type) => {
          setPolicyModalType(type);
          setIsPolicyModalOpen(true);
        }}
      />

      {/* Policy Modal */}
      <PolicyViewerModal
        isOpen={isPolicyModalOpen}
        onClose={() => setIsPolicyModalOpen(false)}
        policyType={policyModalType}
        lang={currentLang}
      />
    </div>
  );
}
