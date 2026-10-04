"use client";

import React, { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { 
  MapPin, 
  Phone, 
  MessageSquare, 
  Mail, 
  Clock, 
  Send, 
  CheckCircle2, 
  Copy, 
  Check, 
  ExternalLink, 
  Building2, 
  Sparkles, 
  ShieldCheck, 
  ArrowRight,
  Loader2
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

export interface ContactCMSPage {
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

interface ContactClientProps {
  readonly categoryPrefix: string;
  readonly categories: readonly Category[];
  readonly activeLangs: readonly Language[];
  readonly settings: StoreSettings;
  readonly cmsPage: ContactCMSPage | null;
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
    heroBadge: "B2B Toptan Showroom & İletişim Merkezi",
    heroTitle: "Bizimle İletişime Geçin",
    heroSubtitle: "Merter tekstil piyasasının lider üreticileriyle doğrudan bağlantı kurun. Toptan sipariş, showroom ziyareti veya özel üretim talepleriniz için uzman ekibimiz 7/24 yanınızda.",
    breadcrumbHome: "Ana Sayfa",
    breadcrumbContact: "İletişim Bilgileri",
    addressTitle: "Showroom & Merkez Ofis",
    addressDesc: "İstanbul toptan tekstil merkezinde showroomumuzu ziyaret edebilirsiniz.",
    phoneTitle: "Müşteri Hizmetleri",
    phoneDesc: "Hafta içi ve cumartesi günleri doğrudan satış temsilcimize ulaşın.",
    whatsappTitle: "7/24 WhatsApp Sipariş",
    whatsappDesc: "Hızlı fiyat teklifi, video aramalı ürün inceleme ve anlık sipariş desteği.",
    emailTitle: "Kurumsal E-Posta",
    emailDesc: "Toptan ihracat, bayilik ve resmi iş birliği talepleriniz için.",
    hoursTitle: "Çalışma Saatleri",
    hoursWeekday: "Pazartesi - Cuma: 09:00 - 18:30",
    hoursSaturday: "Cumartesi: 09:00 - 14:00",
    hoursSunday: "Pazar: Randevulu / WhatsApp Aktif",
    copyBtn: "Kopyala",
    copiedBtn: "Kopyalandı!",
    directionsBtn: "Yol Tarifi Al (Google Haritalar)",
    chatWhatsappBtn: "WhatsApp'tan Hemen Yazın",
    callBtn: "Hemen Arayın",
    sendEmailBtn: "E-Posta Gönderin",
    formTitle: "Hızlı Toptan Teklif & İletişim Formu",
    formSubtitle: "Aşağıdaki formu doldurun, toptan müşteri temsilcimiz en geç 15 dakika içinde sizinle iletişime geçsin.",
    formFullName: "Adınız Soyadınız *",
    formCompany: "Firma / Butik Adınız",
    formPhone: "Telefon / WhatsApp Numaranız *",
    formEmail: "E-Posta Adresiniz *",
    formCountry: "Ülke / Şehir",
    formMessage: "Talebiniz / İlgilendiğiniz Ürün Grupları *",
    formSubmit: "Talebi Gönder & İletişime Geç",
    formSending: "Gönderiliyor...",
    formSuccess: "Mesajınız başarıyla iletildi! Temsilcimiz en kısa sürede sizinle iletişime geçecektir.",
    mapTitle: "Merter Vitrini Showroom Konumu",
    cmsSectionTitle: "Toptan Satış ve Showroom Hakkında",
  },
  en: {
    heroBadge: "B2B Wholesale Showroom & Support Hub",
    heroTitle: "Get in Touch With Us",
    heroSubtitle: "Direct sourcing from leading Istanbul Merter manufacturers. Our international B2B team is available 24/7 for wholesale orders, showroom visits, and custom inquiries.",
    breadcrumbHome: "Home",
    breadcrumbContact: "Contact Information",
    addressTitle: "Showroom & Head Office",
    addressDesc: "Visit our showroom in the heart of Istanbul's wholesale fashion district.",
    phoneTitle: "Customer Support",
    phoneDesc: "Call our customer service representatives directly.",
    whatsappTitle: "24/7 WhatsApp Hotline",
    whatsappDesc: "Instant price quotes, video call showroom inspections, and fast order placement.",
    emailTitle: "Corporate Email",
    emailDesc: "For international export inquiries, dealership, and official correspondence.",
    hoursTitle: "Working Hours",
    hoursWeekday: "Monday - Friday: 09:00 - 18:30 (GMT+3)",
    hoursSaturday: "Saturday: 09:00 - 14:00 (GMT+3)",
    hoursSunday: "Sunday: Closed / WhatsApp Active",
    copyBtn: "Copy",
    copiedBtn: "Copied!",
    directionsBtn: "Get Directions (Google Maps)",
    chatWhatsappBtn: "Chat on WhatsApp",
    callBtn: "Call Us Now",
    sendEmailBtn: "Send Email",
    formTitle: "Quick Wholesale Inquiry Form",
    formSubtitle: "Fill out the form below and our international export representative will reach out within 15 minutes.",
    formFullName: "Full Name *",
    formCompany: "Company / Boutique Name",
    formPhone: "Phone / WhatsApp Number *",
    formEmail: "Email Address *",
    formCountry: "Country / City",
    formMessage: "Your Request / Interested Product Categories *",
    formSubmit: "Submit Inquiry",
    formSending: "Sending...",
    formSuccess: "Your message has been sent successfully! Our team will contact you shortly.",
    mapTitle: "Merter Vitrini Showroom Location",
    cmsSectionTitle: "About Wholesale Orders & Showroom",
  },
  ru: {
    heroBadge: "B2B Оптовый Шоурум и Поддержка",
    heroTitle: "Свяжитесь с Нами",
    heroSubtitle: "Прямые поставки от ведущих турецких фабрик Мертера. Наша команда готова ответить на любые вопросы по оптовым заказам и доставке.",
    breadcrumbHome: "Главная",
    breadcrumbContact: "Контакты",
    addressTitle: "Шоурум и Главный Офис",
    addressDesc: "Вы можете посетить наш оптовый шоурум в центре текстильного района Стамбула.",
    phoneTitle: "Служба Поддержки",
    phoneDesc: "Свяжитесь с нашими русскоязычными менеджерами напрямую.",
    whatsappTitle: "24/7 Линия WhatsApp",
    whatsappDesc: "Быстрый расчет цен, видеообзоры моделей и моментальное оформление заказов.",
    emailTitle: "Корпоративная Почта",
    emailDesc: "Для оптовых запросов на экспорт и официального сотрудничества.",
    hoursTitle: "Часы Работы",
    hoursWeekday: "Понедельник - Пятница: 09:00 - 18:30",
    hoursSaturday: "Суббота: 09:00 - 14:00",
    hoursSunday: "Воскресенье: По записи / WhatsApp доступен",
    copyBtn: "Копировать",
    copiedBtn: "Скопировано!",
    directionsBtn: "Маршрут в Google Maps",
    chatWhatsappBtn: "Написать в WhatsApp",
    callBtn: "Позвонить",
    sendEmailBtn: "Отправить E-mail",
    formTitle: "Форма Запроса Оптового Каталога",
    formSubtitle: "Заполните форму, и наш менеджер свяжется с вами в течение 15 минут.",
    formFullName: "Ваше Имя *",
    formCompany: "Название Компании / Магазина",
    formPhone: "Телефон / WhatsApp *",
    formEmail: "Электронная Почта *",
    formCountry: "Страна / Город",
    formMessage: "Ваш Запрос / Категории Товаров *",
    formSubmit: "Отправить Запрос",
    formSending: "Отправка...",
    formSuccess: "Ваше сообщение успешно отправлено! Мы свяжемся с вами в ближайшее время.",
    mapTitle: "Расположение Шоурума Merter Vitrini",
    cmsSectionTitle: "Информация о Шоуруме и Оптовых Закупках",
  },
  ar: {
    heroBadge: "صالة عرض تجارة الجملة B2B ومركز الدعم",
    heroTitle: "تواصل معنا مباشرة",
    heroSubtitle: "توريد مباشر من أكبر مصانع المنسوجات والأزياء في مرتر إسطنبول. فريقنا المتخصص بخدمتكم على مدار الساعة لتلبية طلبات الجملة والتصدير.",
    breadcrumbHome: "الرئيسية",
    breadcrumbContact: "معلومات الاتصال",
    addressTitle: "صالة العرض والمكتب الرئيسي",
    addressDesc: "يمكنكم زيارة صالة العرض الخاصة بنا في مركز تجارة المنسوجات في إسطنبول.",
    phoneTitle: "خدمة العملاء",
    phoneDesc: "اتصل مباشرة بممثلي المبيعات لخدمتكم باللغة العربية.",
    whatsappTitle: "خط واتساب للطلبات 24/7",
    whatsappDesc: "عروض أسعار فورية، معاينة المنتجات عبر مكالمات الفيديو، ودعم فوري للطلبات.",
    emailTitle: "البريد الإلكتروني المؤسسي",
    emailDesc: "لطلبات التصدير الدولي والوكالات والتعاملات الرسمية.",
    hoursTitle: "أوقات العمل",
    hoursWeekday: "الاثنين - الجمعة: 09:00 - 18:30",
    hoursSaturday: "السبت: 09:00 - 14:00",
    hoursSunday: "الأحد: بحجز مسبق / واتساب متاح",
    copyBtn: "نسخ",
    copiedBtn: "تم النسخ!",
    directionsBtn: "الاتجاهات (خرائط Google)",
    chatWhatsappBtn: "مراسلة عبر واتساب",
    callBtn: "اتصل بنا الآن",
    sendEmailBtn: "إرسال بريد إلكتروني",
    formTitle: "نموذج طلب عروض أسعار الجملة",
    formSubtitle: "يرجى ملء النموذج وسيتواصل معكم ممثل التصدير خلال 15 دقيقة.",
    formFullName: "الاسم الكامل *",
    formCompany: "اسم الشركة / المتجر",
    formPhone: "رقم الهاتف / واتساب *",
    formEmail: "البريد الإلكتروني *",
    formCountry: "الدولة / المدينة",
    formMessage: "طلبك / الموديلات المطلوبة *",
    formSubmit: "إرسال الطلب والتواصل",
    formSending: "جاري الإرسال...",
    formSuccess: "تم إرسال رسالتكم بنجاح! سيتواصل معكم فريقنا في أقرب وقت.",
    mapTitle: "موقع صالة عرض مرتر فيتريني",
    cmsSectionTitle: "حول صالة العرض ومبيعات الجملة",
  }
};

export default function ContactClient({
  categoryPrefix,
  categories,
  activeLangs,
  settings,
  cmsPage
}: Readonly<ContactClientProps>) {
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
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isLangOpen, setIsLangOpen] = useState<boolean>(false);

  // Form states
  const [formData, setFormData] = useState({
    fullName: "",
    company: "",
    phone: "",
    email: "",
    country: "",
    message: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Currency
  const displayCurrency = useSyncExternalStore(subscribeCurrency, getCurrencySnapshot, getCurrencyServerSnapshot);

  const handleCurrencyChange = (curr: string) => {
    localStorage.setItem("merter_preferred_currency", curr);
    window.dispatchEvent(new Event("storage"));
  };

  const handleCopy = (text: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleLangChange = (newLang: string) => {
    const matchLang = activeLangs.find((l) => l.code === newLang);
    if (matchLang) {
      router.push(`/${matchLang.categoryPrefix}/contact`);
    }
  };

  const sanitizedWhatsapp = (settings.whatsapp || "+90 533 703 08 83").replace(/\D/g, "");
  const whatsappUrl = `https://wa.me/${sanitizedWhatsapp}?text=${encodeURIComponent("Merhaba, Merter Vitrini B2B toptan ürünler hakkında bilgi ve fiyat teklifi almak istiyorum.")}`;
  const phoneTelUrl = `tel:${(settings.phone || "+90 533 703 08 83").replace(/\s/g, "")}`;
  const emailMailtoUrl = `mailto:${settings.email || "info@toptanmoda.net"}?subject=${encodeURIComponent("B2B Toptan Sipariş ve Bilgi Talebi")}`;
  const mapDirectionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.address || "Merter Tekstil Merkezi Istanbul")}`;

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate direct dispatch or optional webhook call
    await new Promise((resolve) => setTimeout(resolve, 800));
    
    setIsSubmitting(false);
    setIsSubmitted(true);

    // Optional direct WhatsApp prefill
    const waText = `*B2B Toptan İletişim Talebi*\n\n` +
      `👤 *İsim:* ${formData.fullName}\n` +
      `🏢 *Firma:* ${formData.company || "-"}\n` +
      `📱 *Telefon:* ${formData.phone}\n` +
      `✉️ *E-Posta:* ${formData.email}\n` +
      `🌍 *Konum:* ${formData.country || "-"}\n\n` +
      `💬 *Mesaj:* ${formData.message}`;

    window.open(`https://wa.me/${sanitizedWhatsapp}?text=${encodeURIComponent(waText)}`, "_blank");
  };

  // Check if CMS translation exists
  const cmsTranslation = cmsPage?.translations?.[currentLang] || cmsPage?.translations?.tr || cmsPage?.translations?.en;

  // Schema.org Structured Data
  const jsonLdData = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    "name": texts.heroTitle,
    "description": texts.heroSubtitle,
    "url": `https://mertervitrini.com.tr/${categoryPrefix}/contact`,
    "mainEntity": {
      "@type": "WholesaleStore",
      "name": "Merter Vitrini",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": settings.address,
        "addressLocality": "Merter, Güngören",
        "addressRegion": "İstanbul",
        "addressCountry": "TR"
      },
      "telephone": settings.phone,
      "email": settings.email,
      "openingHours": ["Mo-Fr 09:00-18:30", "Sa 09:00-14:00"],
      "priceRange": "$$",
      "currenciesAccepted": "TRY, USD, EUR"
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50/70 text-zinc-900 font-sans antialiased selection:bg-violet-500 selection:text-white">
      {/* JSON-LD Structured Data for Technical SEO */}
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
          <span className="text-zinc-900 font-semibold">{texts.breadcrumbContact}</span>
        </div>
      </div>

      <main className="flex-1 w-full max-w-[1440px] mx-auto px-6 md:px-12 py-10 flex flex-col gap-12">
        
        {/* Top Hero Section */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-950 via-zinc-900 to-violet-950 text-white p-8 md:p-14 shadow-xl border border-zinc-800">
          {/* Subtle decorative glow */}
          <div className="absolute top-0 right-0 -mr-24 -mt-24 w-96 h-96 rounded-full bg-violet-600/20 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-24 -mb-24 w-80 h-80 rounded-full bg-fuchsia-600/10 blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl flex flex-col gap-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-violet-300 text-xs font-bold w-fit tracking-wide uppercase">
              <Sparkles size={14} className="text-violet-400" />
              {texts.heroBadge}
            </div>

            <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white leading-tight">
              {texts.heroTitle}
            </h1>

            <p className="text-sm md:text-base text-zinc-300 leading-relaxed font-normal">
              {texts.heroSubtitle}
            </p>

            {/* Quick Action Badges */}
            <div className="flex flex-wrap gap-3 pt-3">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-950/40 transition-all hover:scale-105 active:scale-95"
              >
                <MessageSquare size={16} />
                {texts.chatWhatsappBtn}
              </a>
              <a
                href={phoneTelUrl}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/15 backdrop-blur-md transition-all hover:scale-105 active:scale-95"
              >
                <Phone size={16} />
                {texts.callBtn}
              </a>
              <a
                href={mapDirectionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/15 backdrop-blur-md transition-all hover:scale-105 active:scale-95"
              >
                <MapPin size={16} />
                {texts.directionsBtn}
              </a>
            </div>
          </div>
        </section>

        {/* 4 Interactive Contact Information Cards */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Card 1: Showroom Adresi */}
          <div className="bg-white rounded-2xl p-6 border border-zinc-200/80 shadow-sm flex flex-col justify-between gap-4 hover:shadow-md hover:border-violet-300 transition-all group">
            <div className="flex flex-col gap-3">
              <div className="w-12 h-12 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold group-hover:scale-110 group-hover:bg-violet-600 group-hover:text-white transition-all">
                <Building2 size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-950">{texts.addressTitle}</h3>
                <p className="text-xs text-zinc-500 mt-0.5">{texts.addressDesc}</p>
              </div>
              <p className="text-xs font-medium text-zinc-800 leading-relaxed bg-zinc-50 p-3 rounded-xl border border-zinc-100 select-all">
                {settings.address}
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => handleCopy(settings.address, "address")}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 transition-all cursor-pointer"
              >
                {copiedKey === "address" ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                {copiedKey === "address" ? texts.copiedBtn : texts.copyBtn}
              </button>
              <a
                href={mapDirectionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg text-zinc-500 hover:text-violet-600 hover:bg-violet-50 transition-all"
                title="Haritada Göster"
              >
                <ExternalLink size={16} />
              </a>
            </div>
          </div>

          {/* Card 2: WhatsApp Hattı */}
          <div className="bg-white rounded-2xl p-6 border border-zinc-200/80 shadow-sm flex flex-col justify-between gap-4 hover:shadow-md hover:border-emerald-300 transition-all group">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                  <MessageSquare size={24} />
                </div>
                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Canlı / Online
                </span>
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-950">{texts.whatsappTitle}</h3>
                <p className="text-xs text-zinc-500 mt-0.5">{texts.whatsappDesc}</p>
              </div>
              <p className="text-sm font-bold text-emerald-700 bg-emerald-50/60 p-3 rounded-xl border border-emerald-100 tracking-wide font-mono select-all">
                {settings.whatsapp}
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-zinc-100">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all"
              >
                <MessageSquare size={14} />
                {texts.chatWhatsappBtn}
              </a>
            </div>
          </div>

          {/* Card 3: Telefon */}
          <div className="bg-white rounded-2xl p-6 border border-zinc-200/80 shadow-sm flex flex-col justify-between gap-4 hover:shadow-md hover:border-blue-300 transition-all group">
            <div className="flex flex-col gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all">
                <Phone size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-950">{texts.phoneTitle}</h3>
                <p className="text-xs text-zinc-500 mt-0.5">{texts.phoneDesc}</p>
              </div>
              <p className="text-sm font-bold text-zinc-900 bg-zinc-50 p-3 rounded-xl border border-zinc-100 tracking-wide font-mono select-all">
                {settings.phone}
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-zinc-100">
              <a
                href={phoneTelUrl}
                className="w-full inline-flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-all"
              >
                <Phone size={14} />
                {texts.callBtn}
              </a>
            </div>
          </div>

          {/* Card 4: E-Posta */}
          <div className="bg-white rounded-2xl p-6 border border-zinc-200/80 shadow-sm flex flex-col justify-between gap-4 hover:shadow-md hover:border-violet-300 transition-all group">
            <div className="flex flex-col gap-3">
              <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold group-hover:scale-110 group-hover:bg-purple-600 group-hover:text-white transition-all">
                <Mail size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-950">{texts.emailTitle}</h3>
                <p className="text-xs text-zinc-500 mt-0.5">{texts.emailDesc}</p>
              </div>
              <p className="text-xs font-bold text-purple-900 bg-purple-50/50 p-3 rounded-xl border border-purple-100 font-mono break-all select-all">
                {settings.email}
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-zinc-100">
              <a
                href={emailMailtoUrl}
                className="w-full inline-flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 shadow-sm transition-all"
              >
                <Mail size={14} />
                {texts.sendEmailBtn}
              </a>
            </div>
          </div>

        </section>

        {/* Working Hours & Showroom Features Bar */}
        <section className="bg-white rounded-2xl p-6 border border-zinc-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Clock size={24} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-zinc-950">{texts.hoursTitle}</h4>
              <div className="text-xs text-zinc-600 flex flex-wrap gap-x-4 gap-y-1 mt-1 font-medium">
                <span>{texts.hoursWeekday}</span>
                <span className="text-zinc-300 hidden md:inline">•</span>
                <span>{texts.hoursSaturday}</span>
                <span className="text-zinc-300 hidden md:inline">•</span>
                <span className="text-amber-700 font-semibold">{texts.hoursSunday}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-zinc-500 shrink-0">
            <ShieldCheck size={18} className="text-emerald-600 shrink-0" />
            <span>Resmi Toptan Tekstil İhracatçısı & Üretici Ağı</span>
          </div>
        </section>

        {/* 2-Column Section: Contact Form + Interactive Map */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left: Contact Form (7 cols) */}
          <div className="lg:col-span-7 bg-white rounded-3xl p-8 border border-zinc-200/80 shadow-sm flex flex-col gap-6">
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
                <h3 className="text-lg font-bold text-emerald-950">Talebiniz Alındı!</h3>
                <p className="text-xs text-emerald-800 max-w-md leading-relaxed">
                  {texts.formSuccess}
                </p>
                <button
                  type="button"
                  onClick={() => setIsSubmitted(false)}
                  className="mt-2 text-xs font-bold text-emerald-700 hover:text-emerald-900 underline cursor-pointer"
                >
                  Yeni bir mesaj gönder
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
                      className="px-4 py-2.5 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 transition-all"
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
                      placeholder="siparis@butiginiz.com"
                      className="px-4 py-2.5 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 transition-all"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-zinc-600 uppercase tracking-wider">
                    {texts.formCountry}
                  </label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
                    placeholder="Örn: Türkiye / İstanbul veya Almanya / Berlin"
                    className="px-4 py-2.5 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 transition-all"
                  />
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
                    placeholder="İlgilendiğiniz ürün modelleri, asorti koli adetleri veya showroom randevu talebinizi belirtiniz..."
                    className="px-4 py-2.5 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 transition-all leading-relaxed"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="mt-2 inline-flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 text-white text-sm font-bold shadow-md shadow-violet-600/20 active:scale-[0.98] transition-all cursor-pointer"
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

          {/* Right: Interactive Google Maps Embed (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="bg-white rounded-3xl p-6 border border-zinc-200/80 shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-zinc-950 flex items-center gap-2">
                  <MapPin size={18} className="text-violet-600" />
                  {texts.mapTitle}
                </h3>
                <span className="text-[11px] font-semibold text-zinc-500">İstanbul / Türkiye</span>
              </div>

              {/* Embedded Google Map */}
              <div className="w-full h-80 rounded-2xl overflow-hidden border border-zinc-200 relative bg-zinc-100">
                <iframe
                  title="Merter Vitrini Showroom Konumu"
                  src="https://maps.google.com/maps?q=Merter%20Gungoren%20Istanbul&t=&z=14&ie=UTF8&iwloc=&output=embed"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="w-full h-full"
                />
              </div>

              <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200/60 flex flex-col gap-2 text-xs text-zinc-600">
                <div className="font-bold text-zinc-900 flex items-center gap-1.5">
                  <Building2 size={14} className="text-violet-600" />
                  Ulaşım ve Lokasyon Bilgisi:
                </div>
                <p className="leading-relaxed">
                  Showroomumuz Merter Tekstil Çarşısı merkezine, M1A Yenikapı - Atatürk Havalimanı metro hattına ve T1 Kabataş - Bağcılar tramvay durağına yürüme mesafesindedir.
                </p>
                <a
                  href={mapDirectionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-violet-600 hover:text-violet-800 font-bold transition-colors"
                >
                  Canlı Konuma Git <ArrowRight size={12} />
                </a>
              </div>
            </div>
          </div>

        </section>

        {/* Dynamic CMS Custom Section (If populated from admin CMS pages) */}
        {cmsTranslation?.content && (
          <section className="bg-white rounded-3xl p-8 md:p-12 border border-zinc-200/80 shadow-sm flex flex-col gap-6">
            <div className="border-b border-zinc-100 pb-4">
              <h2 className="text-2xl font-bold text-zinc-950">
                {cmsTranslation.title || texts.cmsSectionTitle}
              </h2>
            </div>
            <div className="prose prose-zinc max-w-none text-sm text-zinc-700 leading-relaxed">
              <SafeHtml html={cmsTranslation.content} />
            </div>
          </section>
        )}

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
