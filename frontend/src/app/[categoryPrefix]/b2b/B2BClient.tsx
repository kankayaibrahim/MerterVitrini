"use client";

import React, { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { 
  Factory, 
  Truck, 
  CreditCard, 
  Tag, 
  Headset, 
  CheckCircle2, 
  MessageSquare, 
  ArrowRight, 
  ShieldCheck, 
  Sparkles, 
  Send,
  Loader2,
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

export interface B2BCMSPage {
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

interface B2BClientProps {
  readonly categoryPrefix: string;
  readonly categories: readonly Category[];
  readonly activeLangs: readonly Language[];
  readonly settings: StoreSettings;
  readonly cmsPage: B2BCMSPage | null;
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

const UI_TEXTS: Record<string, Record<string, string>> = {
  tr: {
    heroBadge: "Küresel Toptan Tekstil Tedarik Ağı",
    heroTitle: "Toptan Satış & B2B Tedarik Portalı",
    heroSubtitle: "İstanbul Merter piyasasının en köklü hazır giyim üreticilerinden doğrudan toptan alım yapın. Asorti paketler, avantajlı imalat fiyatları ve 120+ ülkeye güvenli lojistik ağı ile işinizi büyütün.",
    breadcrumbHome: "Ana Sayfa",
    breadcrumbB2B: "Toptan Satış & B2B",
    ctaBrowseCatalog: "Toptan Kataloğu Keşfedin",
    ctaWhatsapp: "WhatsApp'tan Toptan Teklif Alın",
    feature1Title: "Doğrudan Üretici Fiyatları",
    feature1Desc: "Aracı veya komisyoncu olmadan, doğrudan Merter tekstil fabrikalarının ve atölyelerinin net toptan satış fiyatlarıyla sipariş verin.",
    feature2Title: "Hazır Asorti & Seri Paketler",
    feature2Desc: "Ürünler beden dağılımlı standart seri paketlerinde (S, M, L / 2-2-2) paketlenir; mağazanızda kolayca satışa hazır hale gelir.",
    feature3Title: "120+ Ülkeye Uluslararası Lojistik",
    feature3Desc: "Hava yolu, kara yolu ve parsiyel kargo seçenekleri. Dilerseniz Merter veya Laleli'deki kendi kargo acentenize ücretsiz teslimat.",
    feature4Title: "Güvenli B2B Ödeme Yöntemleri",
    feature4Desc: "Banka Havalesi, Uluslararası SWIFT Transferi ve 3D Secure Güvenli Kredi Kartı ile kurumsal faturalı sipariş imkanı.",
    feature5Title: "Private Label & Özel Üretim",
    feature5Desc: "Belirli sipariş hacimlerinde kendi butik veya zincir mağaza markanıza özel etiketleme, barkodlama ve fason üretim desteği.",
    feature6Title: "Kişisel B2B Satış Temsilcisi",
    feature6Desc: "Türkçe, İngilizce, Rusça ve Arapça dillerinde uzman müşteri danışmanlarımız ile siparişinizin her aşamasında birebir destek.",
    stepsTitle: "Toptan Satın Alma Nasıl Çalışır?",
    stepsSubtitle: "4 basit adımda siparişinizi oluşturun ve mağazanızı yeni sezon koleksiyonlarla donatın.",
    step1Title: "1. Kataloğu İnceleyin",
    step1Desc: "Binlerce kadın hazır giyim modelini, kumaş ve renk seçeneklerini online inceleyin.",
    step2Title: "2. Seri Paketlerini Belirleyin",
    step2Desc: "İhtiyacınız olan asorti paketlerini sepete ekleyin veya toptan teklif listesi oluşturun.",
    step3Title: "3. Kargo & Ödemeyi Onaylayın",
    step3Desc: "Satış temsilcimizle nakliye şeklini (kargo firması veya acente) ve ödeme tercihinizi netleştirin.",
    step4Title: "4. Kapınıza Teslim Alın",
    step4Desc: "Özenle paketlenen siparişiniz en kısa sürede kargoya verilsin veya acentenize ulaştırılsın.",
    formTitle: "Toptan Müşteri / Bayi Başvuru Formu",
    formSubtitle: "Butiğiniz veya toptan mağazanız için özel fiyat listesi ve asorti detayları almak üzere formu iletin.",
    formFullName: "Adınız Soyadınız *",
    formCompany: "Firma / Butik Adınız *",
    formPhone: "Telefon / WhatsApp Numaranız *",
    formEmail: "E-Posta Adresiniz *",
    formCountry: "Ülke / Şehir *",
    formVolume: "Aylık Tahmini Alım Adedi / Bütçe",
    formMessage: "İlgilendiğiniz Ürün Grupları / Notunuz *",
    formSubmit: "Toptan Başvurusu Gönder",
    formSending: "İletiliyor...",
    formSuccess: "Toptan başvurunuz başarıyla alındı! İhracat temsilcimiz en kısa sürede WhatsApp veya telefonla sizinle iletişime geçecektir.",
    cmsSectionTitle: "B2B Şartları ve Detaylı Alım Koşulları",
  },
  en: {
    heroBadge: "Global Wholesale Fashion Supply Network",
    heroTitle: "Wholesale & B2B Sourcing Portal",
    heroSubtitle: "Source directly from Istanbul Merter's premier ready-to-wear manufacturers. Grow your fashion boutique with manufacturer-direct prices, series packs, and worldwide shipping to 120+ countries.",
    breadcrumbHome: "Home",
    breadcrumbB2B: "Wholesale & B2B",
    ctaBrowseCatalog: "Explore Wholesale Catalog",
    ctaWhatsapp: "Get WhatsApp Price Quote",
    feature1Title: "Direct Manufacturer Pricing",
    feature1Desc: "No middlemen or agent markups. Purchase apparel at factory-gate wholesale prices directly from Merter producers.",
    feature2Title: "Standard Series & Assortments",
    feature2Desc: "All collections are packed in balanced size breakdowns (S, M, L / 2-2-2), ready for boutique display.",
    feature3Title: "Worldwide Freight to 120+ Countries",
    feature3Desc: "Air, road, and sea freight options. Free local delivery to your designated cargo agent in Merter or Laleli.",
    feature4Title: "Secure Corporate Payment",
    feature4Desc: "International SWIFT bank wire, credit card (3D Secure), and multi-currency invoicing in USD, EUR, and TRY.",
    feature5Title: "Private Label & Custom Orders",
    feature5Desc: "Custom labeling, branding, and OEM manufacturing available for qualifying order quantities.",
    feature6Title: "Dedicated Multilingual Account Manager",
    feature6Desc: "One-on-one personal guidance in English, Russian, Arabic, and Turkish across all order and shipping stages.",
    stepsTitle: "How Wholesale Ordering Works",
    stepsSubtitle: "Follow 4 simple steps to stock your boutique with high-demand Istanbul fashion collections.",
    step1Title: "1. Browse Online Catalog",
    step1Desc: "Explore thousands of women ready-to-wear dresses, sets, and knitwear with live inventory.",
    step2Title: "2. Choose Series Packs",
    step2Desc: "Add your desired assortment packages to your cart or compile a custom wholesale inquiry.",
    step3Title: "3. Confirm Shipping & Payment",
    step3Desc: "Finalize your transport agent and payment method with your personal sales representative.",
    step4Title: "4. Fast Door-to-Door Delivery",
    step4Desc: "Your securely packaged goods are dispatched immediately to your country or cargo agency.",
    formTitle: "Wholesale Buyer Registration Form",
    formSubtitle: "Submit your inquiry to receive our digital wholesale line sheet and volume discounts.",
    formFullName: "Full Name *",
    formCompany: "Company / Boutique Name *",
    formPhone: "Phone / WhatsApp Number *",
    formEmail: "Email Address *",
    formCountry: "Country / City *",
    formVolume: "Estimated Monthly Volume / Budget",
    formMessage: "Interested Product Categories / Notes *",
    formSubmit: "Submit Wholesale Inquiry",
    formSending: "Submitting...",
    formSuccess: "Your wholesale inquiry was received successfully! An international sales executive will contact you shortly.",
    cmsSectionTitle: "Wholesale Sourcing Terms & FAQ",
  },
  ru: {
    heroBadge: "Международная B2B Сеть Поставок Одежды",
    heroTitle: "Оптовые Продажи и B2B Поставки",
    heroSubtitle: "Прямые оптовые закупки женской одежды от ведущих фабрик Мертера (Стамбул). Выгодные фабричные цены, размерные ряды и надежная доставка в Россию, страны СНГ и Европу.",
    breadcrumbHome: "Главная",
    breadcrumbB2B: "Оптовые Продажи & B2B",
    ctaBrowseCatalog: "Смотреть Оптовый Каталог",
    ctaWhatsapp: "Получить Расчет в WhatsApp",
    feature1Title: "Цены Напрямую от Производителей",
    feature1Desc: "Без посредников и лишних наценок — прямые оптовые цены фабрик и швейных производств Мертера.",
    feature2Title: "Фабричные Серии и Размерные Ряды",
    feature2Desc: "Товары упакованы стандартными размерными сериями (S, M, L / 2-2-2), готовыми к продаже в рознице.",
    feature3Title: "Доставка Карго в 120+ Стран",
    feature3Desc: "Авиа и авто карго. Бесплатная доставка до вашего карго-перевозчика в районах Мертер или Лалели.",
    feature4Title: "Безопасные Способы Оплаты",
    feature4Desc: "Банковский перевод SWIFT, оплата картой онлайн и расчет в валютах USD, EUR, RUB.",
    feature5Title: "Private Label и Пошив на Заказ",
    feature5Desc: "Возможность брендирования, пришивания ваших бирок и пошива коллекций под вашим брендом.",
    feature6Title: "Русскоязычный Персональный Менеджер",
    feature6Desc: "Индивидуальное сопровождение заказа, фото и видеообзоры моделей в шоуруме.",
    stepsTitle: "Как Оформить Оптовый Заказ",
    stepsSubtitle: "4 простых шага для пополнения ассортимента вашего магазина лучшими турецкими коллекциями.",
    step1Title: "1. Выберите Модели",
    step1Desc: "Изучите онлайн-каталог платьев, костюмов и трикотажа с актуальным наличием.",
    step2Title: "2. Сформируйте Заказ",
    step2Desc: "Добавьте нужные серии в корзину или отправьте список интересующих артикулов.",
    step3Title: "3. Согласуйте Карго и Оплату",
    step3Desc: "Менеджер согласует удобное для вас карго в Стамбуле и подтвердит детали оплаты.",
    step4Title: "4. Получите Товар",
    step4Desc: "Заказ оперативно упаковывается и доставляется до карго в день подтверждения.",
    formTitle: "Анкета Оптового Покупателя",
    formSubtitle: "Заполните форму, чтобы получить индивидуальные оптовые условия и каталог новинок.",
    formFullName: "Ваше Имя *",
    formCompany: "Название Бутика / Компании *",
    formPhone: "Телефон / WhatsApp *",
    formEmail: "Электронная Почта *",
    formCountry: "Страна / Город *",
    formVolume: "Планируемый объем закупок",
    formMessage: "Интересующие категории товаров *",
    formSubmit: "Отправить Заявку",
    formSending: "Отправка...",
    formSuccess: "Ваша заявка принята! Менеджер свяжется с вами в WhatsApp в ближайшее время.",
    cmsSectionTitle: "Условия Сотрудничества и Оптовые Правила",
  },
  ar: {
    heroBadge: "شبكة توريد الأزياء وتجارة الجملة العالمية",
    heroTitle: "بوابة تجارة الجملة وتوريد B2B",
    heroSubtitle: "استورد الملابس النسائية الجاهزة مباشرة من أكبر مصانع مركز مرتر في إسطنبول. أسعار تصنيع حصرية، حزم قياسية (سيري)، وشحن سريع وآمن لأكثر من 120 دولة حول العالم.",
    breadcrumbHome: "الرئيسية",
    breadcrumbB2B: "تجارة الجملة & B2B",
    ctaBrowseCatalog: "تصفح كتالوج الجملة",
    ctaWhatsapp: "طلب عرض أسعار عبر واتساب",
    feature1Title: "أسعار المصانع المباشرة",
    feature1Desc: "شراء مباشر من مصانع وورش مرتر دون وسطاء أو عمولات إضافية بأفضل الأسعار التنافسية.",
    feature2Title: "حزم قياسية متكاملة (سيري)",
    feature2Desc: "تباع الموديلات في حزم متناسقة المقاسات (S, M, L / 2-2-2) جاهزة للعرض والبيع في متاجرك.",
    feature3Title: "شحن وتصدير لأكثر من 120 دولة",
    feature3Desc: "خيارات شحن جوي وبري وبحري، مع تسليم مجاني لمكتب الشحن الخاص بكم في مرتر أو لالالي.",
    feature4Title: "طرق دفع آمنة ومعتمدة",
    feature4Desc: "تحويل بنكي دولي (SWIFT)، دفع إلكتروني ببطاقات الائتمان، وفواتير تجارية رسمية.",
    feature5Title: "تصنيع بعلامتكم الخاصة (Private Label)",
    feature5Desc: "إمكانية تصنيع الموديلات ووضع ملصقات وشعارات متاجرك الخاصة للكميات المناسبة.",
    feature6Title: "مدير حساب مبيعات مخصص",
    feature6Desc: "دعم فردي كامل باللغة العربية عبر الهاتف وواتساب في جميع مراحل اختيار الموديلات والشحن.",
    stepsTitle: "كيف تبدأ الشراء بالجملة؟",
    stepsSubtitle: "4 خطوات سريعة لتوريد أحدث صيحات الموضة التركية إلى متجرك.",
    step1Title: "1. تصفح الكتالوج",
    step1Desc: "استكشف آلاف الموديلات من الفساتين والأطقم النسائية بالصور وتفاصيل الأقمشة.",
    step2Title: "2. حدد حزم السيري",
    step2Desc: "أضف الحزم المناسبة لسلتك أو أنشئ قائمة بالمنتجات المطلوبة.",
    step3Title: "3. تأكيد الشحن والدفع",
    step3Desc: "نسق مع مسؤول المبيعات شركة الشحن المفضلة لديكم وطريقة الدفع المناسبة.",
    step4Title: "4. استلام الطلبية",
    step4Desc: "يتم تسليم بضائعكم لشركة الشحن بسرعة وأمان لتصل إلى عنوانك مباشرة.",
    formTitle: "نموذج تسجيل تجار الجملة والبوتيكات",
    formSubtitle: "سجل بياناتك للحصول على أحدث الأسعار وقوائم التخفيضات الخاصة بالكميات.",
    formFullName: "الاسم الكامل *",
    formCompany: "اسم الشركة / البوتيك *",
    formPhone: "رقم الهاتف / واتساب *",
    formEmail: "البريد الإلكتروني *",
    formCountry: "الدولة / المدينة *",
    formVolume: "حجم الشراء الشهري المتوقع",
    formMessage: "المنتجات والموديلات المطلوبة *",
    formSubmit: "إرسال طلب الانضمام",
    formSending: "جاري الإرسال...",
    formSuccess: "تم استلام طلبكم بنجاح! سيتواصل معكم ممثل التصدير باللغة العربية عبر واتساب سريعاً.",
    cmsSectionTitle: "شروط تجارة الجملة والأسئلة الشائعة",
  }
};

export default function B2BClient({
  categoryPrefix,
  categories,
  activeLangs,
  settings,
  cmsPage
}: Readonly<B2BClientProps>) {
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

  // Modals and UI states
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState<boolean>(false);
  const [policyModalType, setPolicyModalType] = useState<"cancellation_and_return" | "terms_of_service" | "privacy_policy" | "">("");
  const [isLangOpen, setIsLangOpen] = useState<boolean>(false);

  // Form states
  const [formData, setFormData] = useState({
    fullName: "",
    company: "",
    phone: "",
    email: "",
    country: "",
    volume: "",
    message: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Currency external store
  const displayCurrency = useSyncExternalStore(subscribeCurrency, getCurrencySnapshot, getCurrencyServerSnapshot);

  const handleCurrencyChange = (curr: string) => {
    localStorage.setItem("merter_preferred_currency", curr);
    window.dispatchEvent(new Event("storage"));
  };

  const handleLangChange = (newLang: string) => {
    const matchLang = activeLangs.find((l) => l.code === newLang);
    if (matchLang) {
      router.push(`/${matchLang.categoryPrefix}/b2b`);
    }
  };

  const sanitizedWhatsapp = (settings.whatsapp || "+90 533 703 08 83").replace(/\D/g, "");
  const whatsappUrl = `https://wa.me/${sanitizedWhatsapp}?text=${encodeURIComponent("Merhaba, Merter Vitrini B2B toptan alım şartları ve minimum sipariş detayları hakkında bilgi almak istiyorum.")}`;

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    await new Promise((resolve) => setTimeout(resolve, 800));
    
    setIsSubmitting(false);
    setIsSubmitted(true);

    const waText = `*B2B Toptan Müşteri Başvurusu*\n\n` +
      `👤 *İsim:* ${formData.fullName}\n` +
      `🏢 *Firma / Butik:* ${formData.company}\n` +
      `📱 *Telefon:* ${formData.phone}\n` +
      `✉️ *E-Posta:* ${formData.email}\n` +
      `🌍 *Konum:* ${formData.country}\n` +
      `📦 *Aylık Hacim:* ${formData.volume || "-"}\n\n` +
      `💬 *Talebi:* ${formData.message}`;

    window.open(`https://wa.me/${sanitizedWhatsapp}?text=${encodeURIComponent(waText)}`, "_blank");
  };

  // Check if CMS translation exists
  const cmsTranslation = cmsPage?.translations?.[currentLang] || cmsPage?.translations?.tr || cmsPage?.translations?.en;

  // Schema.org Structured Data
  const jsonLdData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": texts.heroTitle,
    "description": texts.heroSubtitle,
    "url": `https://mertervitrini.com.tr/${categoryPrefix}/b2b`,
    "provider": {
      "@type": "WholesaleStore",
      "name": "Merter Vitrini",
      "telephone": settings.phone,
      "email": settings.email,
      "address": settings.address
    }
  };

  const features = [
    {
      icon: <Factory size={26} className="text-amber-700 group-hover:scale-110 transition-transform" />,
      title: texts.feature1Title,
      desc: texts.feature1Desc,
      bg: "bg-amber-50/80 border border-amber-100/80 group-hover:bg-amber-100"
    },
    {
      icon: <Box size={26} className="text-amber-700 group-hover:scale-110 transition-transform" />,
      title: texts.feature2Title,
      desc: texts.feature2Desc,
      bg: "bg-amber-50/80 border border-amber-100/80 group-hover:bg-amber-100"
    },
    {
      icon: <Truck size={26} className="text-amber-700 group-hover:scale-110 transition-transform" />,
      title: texts.feature3Title,
      desc: texts.feature3Desc,
      bg: "bg-amber-50/80 border border-amber-100/80 group-hover:bg-amber-100"
    },
    {
      icon: <CreditCard size={26} className="text-amber-700 group-hover:scale-110 transition-transform" />,
      title: texts.feature4Title,
      desc: texts.feature4Desc,
      bg: "bg-amber-50/80 border border-amber-100/80 group-hover:bg-amber-100"
    },
    {
      icon: <Tag size={26} className="text-amber-700 group-hover:scale-110 transition-transform" />,
      title: texts.feature5Title,
      desc: texts.feature5Desc,
      bg: "bg-amber-50/80 border border-amber-100/80 group-hover:bg-amber-100"
    },
    {
      icon: <Headset size={26} className="text-amber-700 group-hover:scale-110 transition-transform" />,
      title: texts.feature6Title,
      desc: texts.feature6Desc,
      bg: "bg-amber-50/80 border border-amber-100/80 group-hover:bg-amber-100"
    }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50/70 text-zinc-900 font-sans antialiased selection:bg-zinc-950 selection:text-white">
      {/* JSON-LD Structured Data */}
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
          <a href={`/${categoryPrefix}`} className="hover:text-violet-600 transition-colors">
            {texts.breadcrumbHome}
          </a>
          <span className="text-zinc-300">/</span>
          <span className="text-zinc-900 font-semibold">{texts.breadcrumbB2B}</span>
        </div>
      </div>

      <main className="flex-1 w-full max-w-[1440px] mx-auto px-6 md:px-12 py-10 flex flex-col gap-14">
        
        {/* Top Hero Section - Light Luxury Showroom Design */}
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

            <div className="flex flex-wrap gap-4 pt-3">
              <a
                href={`/${categoryPrefix}/tum-urunler`}
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold shadow-md shadow-zinc-900/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                {texts.ctaBrowseCatalog}
                <ArrowRight size={16} />
              </a>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white text-xs font-bold shadow-md shadow-emerald-900/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <MessageSquare size={16} />
                {texts.ctaWhatsapp}
              </a>
            </div>
          </div>
        </section>

        {/* 6 Core Value Propositions (Grid Cards) */}
        <section className="flex flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            <h2 className="text-2xl font-bold text-zinc-950 tracking-tight">
              Neden Merter Vitrini B2B?
            </h2>
            <p className="text-xs text-zinc-500 font-medium">
              Küresel hazır giyim toptancıları ve butik sahipleri için tasarlanmış uçtan uca dijital ticaret altyapısı.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div 
                key={f.title}
                className="bg-white rounded-2xl p-7 border border-zinc-200/80 shadow-sm flex flex-col gap-4 hover:shadow-md hover:border-zinc-300 transition-all group"
              >
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${f.bg} group-hover:text-white`}>
                  {f.icon}
                </div>
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-base font-bold text-zinc-950 group-hover:text-zinc-950 transition-colors">
                    {f.title}
                  </h3>
                  <p className="text-xs text-zinc-600 leading-relaxed font-normal">
                    {f.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 4 Steps Process */}
        <section className="bg-white rounded-3xl p-8 md:p-12 border border-zinc-200/80 shadow-sm flex flex-col gap-8">
          <div>
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest block mb-1">
              İşleyiş ve Süreç
            </span>
            <h2 className="text-2xl md:text-3xl font-bold text-zinc-950 tracking-tight">
              {texts.stepsTitle}
            </h2>
            <p className="text-xs text-zinc-500 mt-1 font-medium">
              {texts.stepsSubtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-5 rounded-2xl bg-zinc-50 border border-zinc-100 flex flex-col gap-2">
              <span className="text-xs font-black text-zinc-950">01</span>
              <h4 className="text-sm font-bold text-zinc-950">{texts.step1Title}</h4>
              <p className="text-xs text-zinc-600 leading-relaxed">{texts.step1Desc}</p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-50 border border-zinc-100 flex flex-col gap-2">
              <span className="text-xs font-black text-zinc-950">02</span>
              <h4 className="text-sm font-bold text-zinc-950">{texts.step2Title}</h4>
              <p className="text-xs text-zinc-600 leading-relaxed">{texts.step2Desc}</p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-50 border border-zinc-100 flex flex-col gap-2">
              <span className="text-xs font-black text-zinc-950">03</span>
              <h4 className="text-sm font-bold text-zinc-950">{texts.step3Title}</h4>
              <p className="text-xs text-zinc-600 leading-relaxed">{texts.step3Desc}</p>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-50 border border-zinc-100 flex flex-col gap-2">
              <span className="text-xs font-black text-zinc-950">04</span>
              <h4 className="text-sm font-bold text-zinc-950">{texts.step4Title}</h4>
              <p className="text-xs text-zinc-600 leading-relaxed">{texts.step4Desc}</p>
            </div>
          </div>
        </section>

        {/* Dynamic B2B Terms & Trade Guide Section */}
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

        {/* Wholesale Registration & Inquiry Form */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 bg-white rounded-3xl p-8 md:p-10 border border-zinc-200/80 shadow-sm flex flex-col gap-6">
            <div>
              <h2 className="text-2xl font-bold text-zinc-950 tracking-tight">
                {texts.formTitle}
              </h2>
              <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed font-medium">
                {texts.formSubtitle}
              </p>
            </div>

            {isSubmitted ? (
              <div className="p-8 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col items-center justify-center text-center gap-3">
                <CheckCircle2 size={48} className="text-emerald-600" />
                <h3 className="text-lg font-bold text-emerald-950">Toptan Talebiniz Alındı!</h3>
                <p className="text-xs text-emerald-800 max-w-md leading-relaxed">
                  {texts.formSuccess}
                </p>
                <button
                  type="button"
                  onClick={() => setIsSubmitted(false)}
                  className="mt-2 text-xs font-bold text-emerald-700 hover:text-emerald-900 underline cursor-pointer"
                >
                  Yeni bir form gönder
                </button>
              </div>
            ) : (
              <form onSubmit={handleFormSubmit} className="flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-zinc-600 uppercase tracking-wider">
                      {texts.formFullName}
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.fullName}
                      onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                      placeholder="Örn: Halil Yılmaz"
                      className="px-4 py-2.5 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 transition-all"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-zinc-600 uppercase tracking-wider">
                      {texts.formCompany}
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.company}
                      onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                      placeholder="Örn: Butik Moda Tekstil"
                      className="px-4 py-2.5 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-zinc-600 uppercase tracking-wider">
                      {texts.formPhone}
                    </label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="+90 532 000 00 00"
                      className="px-4 py-2.5 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10 transition-all"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-zinc-600 uppercase tracking-wider">
                      {texts.formEmail}
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="toptan@magazaniz.com"
                      className="px-4 py-2.5 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-zinc-600 uppercase tracking-wider">
                      {texts.formCountry}
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.country}
                      onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
                      placeholder="Örn: Türkiye / İzmir veya Rusya / Moskova"
                      className="px-4 py-2.5 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10 transition-all"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-zinc-600 uppercase tracking-wider">
                      {texts.formVolume}
                    </label>
                    <input
                      type="text"
                      value={formData.volume}
                      onChange={(e) => setFormData(prev => ({ ...prev, volume: e.target.value }))}
                      placeholder="Örn: 200 - 500 adet / ay"
                      className="px-4 py-2.5 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10 transition-all"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-zinc-600 uppercase tracking-wider">
                    {texts.formMessage}
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={formData.message}
                    onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                    placeholder="İlgilendiğiniz kategoriler (elbise, takım, triko vb.), özel seri veya kargo taleplerinizi yazabilirsiniz..."
                    className="px-4 py-2.5 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10 transition-all leading-relaxed"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="mt-2 inline-flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl bg-zinc-950 hover:bg-zinc-800 disabled:bg-zinc-400 text-white text-sm font-bold shadow-md shadow-zinc-900/10 active:scale-[0.98] transition-all cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      {texts.formSending}
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      {texts.formSubmit}
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

          {/* Right Info Box (4 cols) */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="bg-white rounded-3xl p-7 border border-zinc-200/80 shadow-sm flex flex-col gap-4 text-zinc-900">
              <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                Hızlı İletişim Hattı
              </span>
              <h3 className="text-xl font-bold text-zinc-950">
                Anında WhatsApp İle Bağlanın
              </h3>
              <p className="text-xs text-zinc-600 leading-relaxed font-normal">
                Toptan satış uzmanımızla canlı görüşerek fiyat teklifi, video aramalı ürün inceleme ve stok teyidi alabilirsiniz.
              </p>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white text-xs font-bold shadow-md shadow-emerald-900/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <MessageSquare size={16} />
                WhatsApp ile Görüşün
              </a>
            </div>

            <div className="bg-white rounded-3xl p-7 border border-zinc-200/80 shadow-sm flex flex-col gap-4 text-xs text-zinc-600">
              <div className="font-bold text-zinc-950 flex items-center gap-2 text-sm">
                <ShieldCheck size={18} className="text-emerald-600" />
                Kurumsal Güvence
              </div>
              <ul className="space-y-2.5">
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span>Resmi faturalı ve ihracat mevzuatına uygun sevkiyat.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span>Merter piyasası üreticilerinden orijinal barkodlu ürünler.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span>Anlaşmalı kargo acenteleriyle kapıdan kapıya sigortalı taşıma.</span>
                </li>
              </ul>
            </div>
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
