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
  Box,
} from "lucide-react";
import Header from "@/components/store/Header";
import Footer from "@/components/store/Footer";
import PolicyViewerModal from "@/components/store/PolicyViewerModal";
import { CartItem, Category } from "@/types/store";
import {
  SITE_ORIGIN,
  SupportedSeoLang,
  normalizeSeoLang,
  safeJsonLd,
} from "@/utils/seoHelpers";
import {
  sanitizePublicStoreAddress,
  sanitizePublicStoreEmail,
} from "@/utils/formatters";

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
  translations: Record<
    string,
    {
      title: string;
      content: string;
      meta_title?: string | null;
      meta_description?: string | null;
    }
  >;
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

function getCartPkgsSnapshot(): number {
  if (typeof window === "undefined") return 0;
  try {
    const saved = localStorage.getItem("merter_b2b_cart");
    if (!saved) return 0;
    const parsed = JSON.parse(saved) as CartItem[];
    return parsed.reduce((sum, item) => sum + (item.packages_qty || 0), 0);
  } catch {
    return 0;
  }
}

function getCartPkgsServerSnapshot(): number {
  return 0;
}

interface B2BUITexts {
  readonly heroBadge: string;
  readonly heroTitle: string;
  readonly heroSubtitle: string;
  readonly breadcrumbHome: string;
  readonly breadcrumbB2B: string;
  readonly ctaBrowseCatalog: string;
  readonly ctaWhatsapp: string;
  readonly whyTitle: string;
  readonly whySubtitle: string;
  readonly feature1Title: string;
  readonly feature1Desc: string;
  readonly feature2Title: string;
  readonly feature2Desc: string;
  readonly feature3Title: string;
  readonly feature3Desc: string;
  readonly feature4Title: string;
  readonly feature4Desc: string;
  readonly feature5Title: string;
  readonly feature5Desc: string;
  readonly feature6Title: string;
  readonly feature6Desc: string;
  readonly processBadge: string;
  readonly stepsTitle: string;
  readonly stepsSubtitle: string;
  readonly step1Title: string;
  readonly step1Desc: string;
  readonly step2Title: string;
  readonly step2Desc: string;
  readonly step3Title: string;
  readonly step3Desc: string;
  readonly step4Title: string;
  readonly step4Desc: string;
  readonly formTitle: string;
  readonly formSubtitle: string;
  readonly formFullName: string;
  readonly formFullNamePh: string;
  readonly formCompany: string;
  readonly formCompanyPh: string;
  readonly formPhone: string;
  readonly formPhonePh: string;
  readonly formEmail: string;
  readonly formEmailPh: string;
  readonly formCountry: string;
  readonly formCountryPh: string;
  readonly formVolume: string;
  readonly formVolumePh: string;
  readonly formMessage: string;
  readonly formMessagePh: string;
  readonly formSubmit: string;
  readonly formSending: string;
  readonly formSuccessTitle: string;
  readonly formSuccess: string;
  readonly formSendAnother: string;
  readonly cmsSectionTitle: string;
  readonly fastLineBadge: string;
  readonly fastLineTitle: string;
  readonly fastLineDesc: string;
  readonly fastLineBtn: string;
  readonly assuranceTitle: string;
  readonly assurance1: string;
  readonly assurance2: string;
  readonly assurance3: string;
  readonly waDefaultHello: string;
  readonly waFormHeader: string;
}

const UI_TEXTS: Record<SupportedSeoLang, B2BUITexts> = {
  tr: {
    heroBadge: "Küresel Toptan Tekstil Tedarik Ağı",
    heroTitle: "Toptan Satış & B2B Tedarik Portalı",
    heroSubtitle:
      "İstanbul Merter piyasasının köklü hazır giyim üreticilerinden doğrudan toptan alım yapın. Asorti beden serileri, fabrika çıkış fiyatları ve 120+ ülkeye güvenli lojistik ağı ile işinizi büyütün.",
    breadcrumbHome: "Ana Sayfa",
    breadcrumbB2B: "Toptan Satış & B2B",
    ctaBrowseCatalog: "Toptan Kataloğu Keşfedin",
    ctaWhatsapp: "WhatsApp'tan Toptan Teklif Alın",
    whyTitle: "Neden Merter Vitrini B2B?",
    whySubtitle:
      "Küresel hazır giyim toptancıları ve butik sahipleri için tasarlanmış uçtan uca dijital ticaret altyapısı.",
    feature1Title: "Doğrudan Üretici Fiyatları",
    feature1Desc:
      "Aracı veya komisyoncu olmadan, doğrudan Merter tekstil fabrikalarının net fabrika çıkış fiyatlarıyla sipariş verin.",
    feature2Title: "Hazır Asorti & Seri Paketler",
    feature2Desc:
      "Ürünler beden dağılımlı standart seri paketlerinde (S, M, L / 2-2-2) paketlenir; mağazanızda doğrudan satışa hazırdır.",
    feature3Title: "120+ Ülkeye Uluslararası Lojistik",
    feature3Desc:
      "Hava yolu, kara yolu ve konsolide kargo seçenekleri; dilerseniz Merter veya Laleli'deki kargo acentenize ücretsiz teslimat.",
    feature4Title: "Güvenli B2B Ödeme Yöntemleri",
    feature4Desc:
      "Banka Havalesi, Uluslararası SWIFT Transferi ve 3D Secure Kredi Kartı ile kurumsal faturalı sipariş imkanı.",
    feature5Title: "Private Label & Özel Üretim",
    feature5Desc:
      "Belirli sipariş hacimlerinde kendi markanıza özel etiketleme, barkodlama ve fason üretim desteği.",
    feature6Title: "Çok Dilli Satış Temsilcisi",
    feature6Desc:
      "8 dilde uzman ihracat danışmanlarımız ile siparişinizin her aşamasında birebir destek.",
    processBadge: "İşleyiş ve Süreç",
    stepsTitle: "Toptan Satın Alma Nasıl Çalışır?",
    stepsSubtitle:
      "4 basit adımda siparişinizi oluşturun ve mağazanızı yeni sezon koleksiyonlarla donatın.",
    step1Title: "Kataloğu İnceleyin",
    step1Desc: "Binlerce hazır giyim modelini, kumaş ve renk seçeneklerini online inceleyin.",
    step2Title: "Seri Paketlerini Belirleyin",
    step2Desc:
      "İhtiyacınız olan asorti paketlerini sepete ekleyin veya toptan teklif listesi oluşturun.",
    step3Title: "Kargo & Ödemeyi Onaylayın",
    step3Desc:
      "Satış temsilcimizle nakliye şeklini (kargo firması veya acente) ve ödeme tercihinizi netleştirin.",
    step4Title: "Kapınıza Teslim Alın",
    step4Desc:
      "Özenle paketlenen siparişiniz en kısa sürede kargoya verilsin veya acentenize ulaştırılsın.",
    formTitle: "Toptan Müşteri / Bayi Başvuru Formu",
    formSubtitle:
      "Butiğiniz veya mağazanız için özel fiyat listesi ve asorti detayları almak üzere formu iletin.",
    formFullName: "Adınız Soyadınız *",
    formFullNamePh: "Örn: Ahmet Yılmaz",
    formCompany: "Firma / Butik Adınız *",
    formCompanyPh: "Örn: Moda Butik Tekstil",
    formPhone: "Telefon / WhatsApp Numaranız *",
    formPhonePh: "+90 532 000 00 00",
    formEmail: "E-Posta Adresiniz *",
    formEmailPh: "toptan@magazaniz.com",
    formCountry: "Ülke / Şehir *",
    formCountryPh: "Örn: Türkiye / İzmir veya Almanya / Berlin",
    formVolume: "Aylık Tahmini Alım Adedi / Bütçe",
    formVolumePh: "Örn: 200 - 500 adet / ay",
    formMessage: "İlgilendiğiniz Ürün Grupları / Notunuz *",
    formMessagePh: "Elbise, ikili takım, triko veya özel üretim talepleriniz...",
    formSubmit: "Toptan Başvurusu Gönder",
    formSending: "İletiliyor...",
    formSuccessTitle: "Toptan Talebiniz Alındı!",
    formSuccess:
      "Toptan başvurunuz başarıyla alındı! İhracat temsilcimiz en kısa sürede WhatsApp veya telefonla sizinle iletişime geçecektir.",
    formSendAnother: "Yeni bir form gönder",
    cmsSectionTitle: "B2B Şartları ve Detaylı Alım Koşulları",
    fastLineBadge: "Hızlı İletişim Hattı",
    fastLineTitle: "Anında WhatsApp İle Bağlanın",
    fastLineDesc:
      "Toptan satış uzmanımızla canlı görüşerek fiyat teklifi, video aramalı ürün inceleme ve stok teyidi alabilirsiniz.",
    fastLineBtn: "WhatsApp ile Görüşün",
    assuranceTitle: "Kurumsal Güvence",
    assurance1: "Resmi faturalı ve ihracat mevzuatına (ATR / EUR.1) uygun sevkiyat.",
    assurance2: "Doğrulanmış Merter üreticilerinden orijinal barkodlu seriler.",
    assurance3: "Anlaşmalı kargo acenteleriyle kapıdan kapıya sigortalı taşıma.",
    waDefaultHello:
      "Merhaba, Merter Vitrini B2B toptan alım şartları ve minimum sipariş detayları hakkında bilgi almak istiyorum.",
    waFormHeader: "*B2B Toptan Müşteri Başvurusu*",
  },
  en: {
    heroBadge: "Global Wholesale Fashion Supply Network",
    heroTitle: "Wholesale & B2B Sourcing Portal",
    heroSubtitle:
      "Source directly from Istanbul Merter's verified ready-to-wear manufacturers. Grow your boutique with factory-gate pricing, assorted size-run packs, and consolidated shipping to 120+ countries.",
    breadcrumbHome: "Home",
    breadcrumbB2B: "Wholesale & B2B",
    ctaBrowseCatalog: "Explore Wholesale Catalog",
    ctaWhatsapp: "Get WhatsApp Price Quote",
    whyTitle: "Why Merter Vitrini B2B?",
    whySubtitle:
      "End-to-end digital wholesale sourcing infrastructure built for international boutiques, distributors, and fashion chains.",
    feature1Title: "Direct Factory Pricing",
    feature1Desc:
      "Zero middlemen or broker commissions — purchase apparel at net factory-gate prices directly from Merter producers.",
    feature2Title: "Assorted Size-Run Packs",
    feature2Desc:
      "Collections come in balanced size breakdowns (S, M, L / 2-2-2), ready for immediate retail merchandising.",
    feature3Title: "Worldwide Freight to 120+ Countries",
    feature3Desc:
      "Air express, road freight, and free local drop-off to your designated cargo agent in Merter or Laleli.",
    feature4Title: "Secure Corporate Payments",
    feature4Desc:
      "International SWIFT wire, 3D Secure corporate cards, and official export invoicing in USD, EUR, and TRY.",
    feature5Title: "Private Label & Custom OEM",
    feature5Desc:
      "Custom woven neck labels, hangtags, barcodes, and private label manufacturing for qualifying volumes.",
    feature6Title: "Dedicated Multilingual Export Desk",
    feature6Desc:
      "One-on-one support across 8 languages from sample inspection to customs clearance.",
    processBadge: "How It Works",
    stepsTitle: "How Wholesale Ordering Works",
    stepsSubtitle:
      "4 straightforward steps to stock your store with high-margin Istanbul fashion collections.",
    step1Title: "Browse Online Catalog",
    step1Desc: "Explore thousands of wholesale dresses, sets, and knitwear with live factory stock.",
    step2Title: "Select Size-Run Packs",
    step2Desc: "Add assorted series packs to your cart or submit a custom wholesale RFQ.",
    step3Title: "Confirm Freight & Payment",
    step3Desc: "Finalize your cargo forwarder and payment method with your export manager.",
    step4Title: "Fast Door-to-Door Dispatch",
    step4Desc: "Consolidated parcels ship immediately with full commercial export documentation.",
    formTitle: "Wholesale Buyer Registration Form",
    formSubtitle:
      "Submit your business details to receive wholesale line sheets and volume pricing.",
    formFullName: "Full Name *",
    formFullNamePh: "e.g. Sarah Jenkins",
    formCompany: "Company / Boutique Name *",
    formCompanyPh: "e.g. Bella Moda Boutique",
    formPhone: "Phone / WhatsApp Number *",
    formPhonePh: "+44 7700 900000",
    formEmail: "Business Email *",
    formEmailPh: "buying@yourboutique.com",
    formCountry: "Country / City *",
    formCountryPh: "e.g. UK / London or USA / New York",
    formVolume: "Estimated Monthly Volume / Budget",
    formVolumePh: "e.g. 200 - 500 pcs / month",
    formMessage: "Target Categories / Sourcing Notes *",
    formMessagePh: "Dresses, co-ord sets, modest wear, private label requirements...",
    formSubmit: "Submit Wholesale Inquiry",
    formSending: "Submitting...",
    formSuccessTitle: "Wholesale Inquiry Received!",
    formSuccess:
      "Your wholesale inquiry has been received! Our international export team will reach out via WhatsApp or email shortly.",
    formSendAnother: "Submit another inquiry",
    cmsSectionTitle: "Wholesale Sourcing Terms & Guide",
    fastLineBadge: "Direct Export Desk",
    fastLineTitle: "Connect Instantly on WhatsApp",
    fastLineDesc:
      "Chat live with our export specialists for price quotes, live showroom video calls, and stock confirmation.",
    fastLineBtn: "Chat on WhatsApp",
    assuranceTitle: "Corporate Trade Assurance",
    assurance1: "Official commercial export invoices with ATR / EUR.1 customs certificates.",
    assurance2: "Barcoded authentic size-run packs directly from verified Merter factories.",
    assurance3: "Insured door-to-door international air and road freight consolidation.",
    waDefaultHello:
      "Hello, I would like information about Merter Vitrini B2B wholesale terms, MOQ, and international shipping.",
    waFormHeader: "*B2B Wholesale Buyer Application*",
  },
  ru: {
    heroBadge: "Международная B2B Сеть Поставок Одежды",
    heroTitle: "Оптовые Продажи и B2B Поставки",
    heroSubtitle:
      "Прямые оптовые закупки одежды от проверенных фабрик Мертера (Стамбул) без посредников. Размерные ряды, фабричные цены и консолидированная карго-доставка в Россию, СНГ и Европу.",
    breadcrumbHome: "Главная",
    breadcrumbB2B: "Оптовые Продажи & B2B",
    ctaBrowseCatalog: "Смотреть Оптовый Каталог",
    ctaWhatsapp: "Получить Расчет в WhatsApp",
    whyTitle: "Почему выбирают Merter Vitrini B2B?",
    whySubtitle:
      "Цифровая B2B-платформа прямых закупок для владельцев бутиков, сетевых магазинов и селлеров.",
    feature1Title: "Цены Напрямую от Фабрик",
    feature1Desc:
      "Никаких наценок посредников — закупайте по прямым прайсам швейных фабрик Мертера.",
    feature2Title: "Фабричные Серии (Размерные Ряды)",
    feature2Desc:
      "Модели упакованы стандартными сериями (S, M, L / 2-2-2), полностью готовыми к розничной продаже.",
    feature3Title: "Карго Доставка в 120+ Стран",
    feature3Desc:
      "Авиа и авто карго, а также бесплатная доставка до вашего карго-склада в Мертере или Лалели.",
    feature4Title: "Удобные Корпоративные Расчеты",
    feature4Desc:
      "Международный перевод SWIFT, оплата картой 3D Secure и расчет в USD, EUR, TRY.",
    feature5Title: "Private Label и Пошив СТМ",
    feature5Desc:
      "Отшив коллекций под вашим брендом, индивидуальные бирки, составники и штрихкодирование.",
    feature6Title: "Русскоязычный Персональный Менеджер",
    feature6Desc:
      "Полное сопровождение сделки, видеопоказ моделей из шоурума и контроль отгрузки.",
    processBadge: "Схема Работы",
    stepsTitle: "Как Оформить Оптовый Заказ",
    stepsSubtitle: "4 простых шага для закупки актуальных турецких коллекций напрямую с фабрик.",
    step1Title: "Выберите Модели",
    step1Desc: "Изучите онлайн-каталог платьев, костюмов и трикотажа с живыми остатками.",
    step2Title: "Сформируйте Корзину",
    step2Desc: "Добавьте нужные размерные серии в корзину или отправьте заявку на расчет.",
    step3Title: "Согласуйте Карго и Оплату",
    step3Desc: "Менеджер подтвердит наличие и передаст груз вашей карго-компании в Стамбуле.",
    step4Title: "Получите Груз",
    step4Desc: "Консолидированная партия оперативно отправляется в ваш город с полным пакетом документов.",
    formTitle: "Анкета Оптового Покупателя",
    formSubtitle: "Оставьте контакты для получения оптового прайс-листа и условий сотрудничества.",
    formFullName: "Имя и Фамилия *",
    formFullNamePh: "Например: Елена Смирнова",
    formCompany: "Компания / Магазин *",
    formCompanyPh: "Например: Бутик Мода",
    formPhone: "Телефон / WhatsApp *",
    formPhonePh: "+7 999 000 00 00",
    formEmail: "Электронная Почта *",
    formEmailPh: "zakupki@shop.ru",
    formCountry: "Страна / Город *",
    formCountryPh: "Например: Россия / Москва или Казахстан / Алматы",
    formVolume: "Планируемый объем закупок в месяц",
    formVolumePh: "Например: 200 - 500 ед. / мес.",
    formMessage: "Интересующие категории товаров *",
    formMessagePh: "Платья, костюмы-двойки, трикотаж, пошив под своим брендом...",
    formSubmit: "Отправить Оптовый Запрос",
    formSending: "Отправка...",
    formSuccessTitle: "Ваша Заявка Принята!",
    formSuccess:
      "Заявка успешно получена! Русскоязычный менеджер свяжется с вами в WhatsApp в ближайшее время.",
    formSendAnother: "Отправить еще одну заявку",
    cmsSectionTitle: "Условия B2B Сотрудничества",
    fastLineBadge: "Прямая Линия Экспорта",
    fastLineTitle: "Свяжитесь в WhatsApp Сейчас",
    fastLineDesc:
      "Получите быстрый расчет стоимости, видеообзор тканей из шоурума и подтверждение наличия.",
    fastLineBtn: "Написать в WhatsApp",
    assuranceTitle: "Гарантии Надежности",
    assurance1: "Официальные экспортные накладные и таможенное сопровождение.",
    assurance2: "Оригинальная продукция проверенных фабрик Мертера со штрихкодами.",
    assurance3: "Застрахованная консолидированная доставка через надежные карго.",
    waDefaultHello:
      "Здравствуйте! Интересуют условия оптовых закупок B2B на Merter Vitrini и доставка карго.",
    waFormHeader: "*Заявка Оптового Покупателя B2B*",
  },
  ar: {
    heroBadge: "شبكة توريد الأزياء وتجارة الجملة العالمية",
    heroTitle: "بوابة تجارة الجملة وتوريد B2B",
    heroSubtitle:
      "استورد الملابس الجاهزة مباشرة من مصانع مارتر إسطنبول المعتمدة بدون وسطاء. أسعار المصنع، حزم المقاسات المتنوعة (سيري)، وشحن دولي موحد لأكثر من 120 دولة.",
    breadcrumbHome: "الرئيسية",
    breadcrumbB2B: "تجارة الجملة & B2B",
    ctaBrowseCatalog: "تصفح كتالوج الجملة",
    ctaWhatsapp: "اطلب عرض سعر عبر واتساب",
    whyTitle: "لماذا منصة Merter Vitrini B2B؟",
    whySubtitle:
      "بنية تجارية رقمية متكاملة مصممة لأصحاب البوتيكات وتجار الجملة والمستوردين حول العالم.",
    feature1Title: "أسعار المصنع المباشرة",
    feature1Desc: "شراء مباشر من مصانع مارتر بدون عمولات وسطاء لتحقيق أعلى هامش ربح لمتجرك.",
    feature2Title: "حزم سيري متوازنة المقاسات",
    feature2Desc:
      "تُجهز الموديلات في باكتات مقاسات قياسية (S, M, L / 2-2-2) جاهزة للعرض الفوري.",
    feature3Title: "شحن دولي لأكثر من 120 دولة",
    feature3Desc:
      "شحن جوي وبري وبحري، مع توصيل مجاني إلى مكتب شركة الشحن الخاصة بكم في مارتر أو لالالي.",
    feature4Title: "طرق دفع مؤسسية آمنة",
    feature4Desc:
      "تحويل بنكي دولي SWIFT، بطاقات ائتمان 3D Secure، وفواتير تصدير رسمية بالدولار واليورو.",
    feature5Title: "تصنيع للعلامات الخاصة (Private Label)",
    feature5Desc: "إمكانية التصنيع بعلامتكم التجارية الخاصة مع الليبل والباركود والتغليف المخصص.",
    feature6Title: "مسؤول مبيعات يتحدث العربية",
    feature6Desc: "مرافقة كاملة عبر واتساب ومكالمات الفيديو لمعاينة الخامات وتأكيد الشحن.",
    processBadge: "آلية العمل",
    stepsTitle: "كيف تبدأ الشراء بالجملة؟",
    stepsSubtitle: "4 خطوات سريعة لتزويد متجرك بأحدث تشكيلات الموضة التركية.",
    step1Title: "تصفح الكتالوج",
    step1Desc: "استعرض آلاف الموديلات من الفساتين والأطقم وملابس المحجبات بتفاصيل الخامات.",
    step2Title: "اختر باكتات السيري",
    step2Desc: "أضف الكميات المطلوبة إلى السلة أو أرسل طلب عرض سعر مخصص.",
    step3Title: "تأكيد الشحن والدفع",
    step3Desc: "نسّق مع مسؤول التصدير شركة الكارجو وطريقة الدفع المعتمدة.",
    step4Title: "شحن سريع ومؤمّن",
    step4Desc: "تُجمع طلباتك في شحنة موحدة وتُرسل فوراً مع كامل مستندات التصدير.",
    formTitle: "نموذج تسجيل تجار الجملة والبوتيكات",
    formSubtitle: "أرسل بياناتك للحصول على قوائم أسعار المصنع وخصومات الكميات.",
    formFullName: "الاسم الكامل *",
    formFullNamePh: "مثال: محمد العلي",
    formCompany: "اسم الشركة / البوتيك *",
    formCompanyPh: "مثال: بوتيك الأناقة",
    formPhone: "رقم الهاتف / واتساب *",
    formPhonePh: "+966 50 000 0000",
    formEmail: "البريد الإلكتروني *",
    formEmailPh: "info@boutique.com",
    formCountry: "الدولة / المدينة *",
    formCountryPh: "مثال: السعودية / الرياض أو الإمارات / دبي",
    formVolume: "حجم الشراء الشهري المتوقع",
    formVolumePh: "مثال: 200 - 500 قطعة شهرياً",
    formMessage: "الأقسام المطلوبة / ملاحظاتك *",
    formMessagePh: "فساتين، أطقم، عبايات، أو تصنيع بعلامة خاصة...",
    formSubmit: "إرسال طلب الجملة",
    formSending: "جاري الإرسال...",
    formSuccessTitle: "تم استلام طلبكم بنجاح!",
    formSuccess: "سيتواصل معكم مسؤول التصدير باللغة العربية عبر واتساب في أقرب وقت.",
    formSendAnother: "إرسال طلب جديد",
    cmsSectionTitle: "شروط التوريد بالجملة ودليل الشراء",
    fastLineBadge: "خط التصدير السريع",
    fastLineTitle: "تواصل فوراً عبر واتساب",
    fastLineDesc:
      "تحدث مباشرة مع فريق التصدير للحصول على عروض الأسعار ومعاينة الموديلات بالفيديو.",
    fastLineBtn: "مراسلة عبر واتساب",
    assuranceTitle: "الضمان التجاري المؤسسي",
    assurance1: "فواتير تصدير رسمية وشهادات منشأ معتمدة للتخليص الجمركي.",
    assurance2: "منتجات أصلية بنظام السيري من مصانع مارتر الموثقة.",
    assurance3: "شحن دولي مؤمّن من الباب إلى الباب عبر شركات كارجو معتمدة.",
    waDefaultHello:
      "مرحباً، أرغب في الاستفسار عن شروط الشراء بالجملة B2B والحد الأدنى للطلب في Merter Vitrini.",
    waFormHeader: "*طلب تسجيل تاجر جملة B2B*",
  },
  de: {
    heroBadge: "Globales B2B-Beschaffungsnetzwerk für Mode",
    heroTitle: "Großhandel & B2B-Sourcing-Portal",
    heroSubtitle:
      "Kaufen Sie direkt bei geprüften Textilherstellern in Istanbul Merter ein. Sortierte Größenserien, Werkspreise ohne Zwischenhändler und schneller EU-Export mit ATR-Zollabwicklung.",
    breadcrumbHome: "Startseite",
    breadcrumbB2B: "Großhandel & B2B",
    ctaBrowseCatalog: "Großhandelskatalog entdecken",
    ctaWhatsapp: "WhatsApp-Angebot anfordern",
    whyTitle: "Warum Merter Vitrini B2B?",
    whySubtitle:
      "Digitale B2B-Direktbeschaffung für Modeboutiquen, Filialisten und Online-Händler in ganz Europa.",
    feature1Title: "Direkte Herstellerpreise",
    feature1Desc:
      "Keine Zwischenhändler oder Maklergebühren — bestellen Sie zu echten Werkspreisen direkt aus Merter.",
    feature2Title: "Sortierte Serienpakete (Packs)",
    feature2Desc:
      "Ausgewogene Größenläufe (z. B. S, M, L / 2-2-2), verkaufsfertig verpackt für Ihren Store.",
    feature3Title: "Express-Logistik in 120+ Länder",
    feature3Desc:
      "Luft- und Straßenfracht nach Deutschland, Österreich und in die Schweiz inkl. kostenloser Übergabe an Ihre Spedition in Istanbul.",
    feature4Title: "Sichere B2B-Zahlungsarten",
    feature4Desc:
      "SEPA/SWIFT-Banküberweisung, 3D-Secure-Firmenkreditkarte und Netto-Exportrechnung in EUR oder USD.",
    feature5Title: "Private Label & Lohnfertigung",
    feature5Desc:
      "Eigene Webetiketten, Hangtags, EAN-Barcodes und Exklusivproduktion ab attraktiven Stückzahlen.",
    feature6Title: "Persönlicher B2B-Kundenberater",
    feature6Desc:
      "Mehrsprachige Betreuung von der Musterprüfung per Video-Call bis zur Zustellung.",
    processBadge: "Ablauf & Prozess",
    stepsTitle: "So funktioniert der Großhandelseinkauf",
    stepsSubtitle: "In 4 klaren Schritten zu neuen Kollektionen direkt aus Istanbul.",
    step1Title: "Katalog durchsuchen",
    step1Desc: "Tausende Kleider, Zweiteiler und Strickmodelle mit Echtzeit-Beständen prüfen.",
    step2Title: "Serienpakete wählen",
    step2Desc: "Gewünschte Packs in den Warenkorb legen oder eine Angebotsliste senden.",
    step3Title: "Versand & Zahlung bestätigen",
    step3Desc: "Spedition, ATR-Exportdokumente und Zahlungsart mit Ihrem Berater abstimmen.",
    step4Title: "Konsolidierte Lieferung",
    step4Desc: "Sorgfältig geprüfte Ware wird gebündelt und versichert an Ihre Adresse geliefert.",
    formTitle: "B2B-Händlerregistrierung & Anfrage",
    formSubtitle: "Fordern Sie unsere Großhandelspreisliste und Mengenrabatte für Ihr Geschäft an.",
    formFullName: "Vor- und Nachname *",
    formFullNamePh: "z. B. Anna Weber",
    formCompany: "Firma / Boutique *",
    formCompanyPh: "z. B. Modehaus Weber GmbH",
    formPhone: "Telefon / WhatsApp *",
    formPhonePh: "+49 170 0000000",
    formEmail: "Geschäftliche E-Mail *",
    formEmailPh: "einkauf@ihreboutique.de",
    formCountry: "Land / Stadt *",
    formCountryPh: "z. B. Deutschland / München oder Österreich / Wien",
    formVolume: "Monatliches Einkaufsvolumen",
    formVolumePh: "z. B. 200 - 500 Stück / Monat",
    formMessage: "Gewünschte Warengruppen / Notiz *",
    formMessagePh: "Damenkleider, Zweiteiler, Strickmode oder Private-Label-Anfrage...",
    formSubmit: "B2B-Anfrage absenden",
    formSending: "Wird gesendet...",
    formSuccessTitle: "B2B-Anfrage eingegangen!",
    formSuccess:
      "Vielen Dank! Unser Export-Team meldet sich in Kürze per WhatsApp oder E-Mail bei Ihnen.",
    formSendAnother: "Weitere Anfrage senden",
    cmsSectionTitle: "B2B-Handelsbedingungen & Einkaufsleitfaden",
    fastLineBadge: "Direkter Export-Kontakt",
    fastLineTitle: "Sofort per WhatsApp verbinden",
    fastLineDesc:
      "Erhalten Sie Live-Videoberatungen aus dem Showroom, Staffelpreise und Lieferzeiten.",
    fastLineBtn: "Per WhatsApp schreiben",
    assuranceTitle: "Geprüfte B2B-Sicherheit",
    assurance1: "Offizielle Netto-Exportrechnung inklusive ATR / EUR.1 Präфеrenz-Nachweis.",
    assurance2: "Original verpackte Serienware geprüfter Hersteller aus Istanbul Merter.",
    assurance3: "Versicherter Tür-zu-Tür-Sammelversand in die gesamte EU.",
    waDefaultHello:
      "Hallo, ich interessiere mich für die B2B-Großhandelskonditionen und Mindestbestellmengen bei Merter Vitrini.",
    waFormHeader: "*B2B-Großhandelsanfrage*",
  },
  fr: {
    heroBadge: "Réseau Mondial d'Approvisionnement Mode B2B",
    heroTitle: "Portail Grossiste & Sourcing B2B",
    heroSubtitle:
      "Approvisionnez-vous directement auprès des fabricants de prêt-à-porter de Merter Istanbul. Lots par séries assorties, prix d'usine sans intermédiaire et expédition internationale vers 120+ pays.",
    breadcrumbHome: "Accueil",
    breadcrumbB2B: "Vente en Gros & B2B",
    ctaBrowseCatalog: "Explorer le Catalogue Grossiste",
    ctaWhatsapp: "Obtenir un Devis WhatsApp",
    whyTitle: "Pourquoi choisir Merter Vitrini B2B ?",
    whySubtitle:
      "Une plateforme digitale complète pensée pour les boutiques indépendantes, grossistes et enseignes de mode.",
    feature1Title: "Prix Direct Fabricant",
    feature1Desc:
      "Aucun intermédiaire : commandez aux tarifs sortie d'usine directement auprès des ateliers de Merter.",
    feature2Title: "Séries & Packs Assortis",
    feature2Desc:
      "Répartition équilibrée des tailles par lot (S, M, L / 2-2-2), prête pour la mise en rayon.",
    feature3Title: "Fret International vers 120+ Pays",
    feature3Desc:
      "Transport aérien, routier ou remise gratuite à votre transitaire cargo à Merter ou Laleli.",
    feature4Title: "Paiements B2B Sécurisés",
    feature4Desc:
      "Virement bancaire SWIFT/SEPA, carte 3D Secure et facturation export officielle en EUR ou USD.",
    feature5Title: "Marque Blanche (Private Label)",
    feature5Desc:
      "Étiquetage personnalisé, griffes tissées, codes-barres et façonnage sur mesure.",
    feature6Title: "Conseiller Export Multilingue",
    feature6Desc:
      "Accompagnement dédié en français pour vos sélections vidéo, devis et formalités douanières.",
    processBadge: "Fonctionnement",
    stepsTitle: "Comment commander en gros ?",
    stepsSubtitle: "4 étapes simples pour renouveler vos collections depuis Istanbul.",
    step1Title: "Parcourez le Catalogue",
    step1Desc: "Découvrez des milliers de robes, ensembles et mailles avec stocks en direct.",
    step2Title: "Sélectionnez vos Séries",
    step2Desc: "Ajoutez vos lots assortis au panier ou envoyez une demande de devis.",
    step3Title: "Validez Transport & Paiement",
    step3Desc: "Confirmez votre transitaire et votre mode de règlement avec votre conseiller.",
    step4Title: "Expédition Groupée Rapide",
    step4Desc: "Vos colis consolidés partent immédiatement avec documents d'exportation EUR.1/ATR.",
    formTitle: "Formulaire d'Ouverture de Compte Grossiste",
    formSubtitle: "Recevez nos grilles tarifaires B2B et conditions de remises sur volume.",
    formFullName: "Nom et Prénom *",
    formFullNamePh: "ex. Claire Dupont",
    formCompany: "Société / Boutique *",
    formCompanyPh: "ex. Boutique Élégance Paris",
    formPhone: "Téléphone / WhatsApp *",
    formPhonePh: "+33 6 00 00 00 00",
    formEmail: "E-mail Professionnel *",
    formEmailPh: "achats@votreboutique.fr",
    formCountry: "Pays / Ville *",
    formCountryPh: "ex. France / Paris ou Belgique / Bruxelles",
    formVolume: "Volume mensuel estimé",
    formVolumePh: "ex. 200 - 500 pièces / mois",
    formMessage: "Catégories recherchées / Message *",
    formMessagePh: "Robes, ensembles, mode modeste ou fabrication marque blanche...",
    formSubmit: "Envoyer la Demande B2B",
    formSending: "Envoi en cours...",
    formSuccessTitle: "Demande B2B Enregistrée !",
    formSuccess:
      "Votre demande a bien été reçue ! Notre service export vous contactera très rapidement sur WhatsApp.",
    formSendAnother: "Envoyer une nouvelle demande",
    cmsSectionTitle: "Conditions Générales B2B & Guide d'Achat",
    fastLineBadge: "Ligne Directe Export",
    fastLineTitle: "Contactez-nous sur WhatsApp",
    fastLineDesc:
      "Échangez en direct avec nos spécialistes pour une présentation vidéo du showroom et des tarifs.",
    fastLineBtn: "Discuter sur WhatsApp",
    assuranceTitle: "Garantie Commerciale B2B",
    assurance1: "Facturation export officielle HT avec certificats douaniers ATR / EUR.1.",
    assurance2: "Lots certifiés avec codes-barres issus des usines vérifiées de Merter.",
    assurance3: "Livraison porte-à-porte assurée et groupage multi-fabricants.",
    waDefaultHello:
      "Bonjour, je souhaite obtenir des informations sur les conditions d'achat en gros B2B chez Merter Vitrini.",
    waFormHeader: "*Demande d'Ouverture Compte B2B*",
  },
  pl: {
    heroBadge: "Globalna Sieć Dostaw Odzieży Hurtowej B2B",
    heroTitle: "Portal Hurtowy i Zaopatrzenia B2B",
    heroSubtitle:
      "Kupuj bezpośrednio od sprawdzonych producentów odzieży z dzielnicy Merter w Stambule. Pełne serie rozmiarowe w paczkach, ceny fabryczne i szybki transport do Polski oraz 120+ krajów.",
    breadcrumbHome: "Strona główna",
    breadcrumbB2B: "Sprzedaż Hurtowa & B2B",
    ctaBrowseCatalog: "Przeglądaj Katalog Hurtowy",
    ctaWhatsapp: "Zapytaj o Ofertę na WhatsApp",
    whyTitle: "Dlaczego Merter Vitrini B2B?",
    whySubtitle:
      "Nowoczesna platforma bezpośrednich zakupów hurtowych stworzona dla butików, hurtowni i marek modowych.",
    feature1Title: "Bezpośrednie Ceny Fabryczne",
    feature1Desc:
      "Zero pośredników i ukrytych prowizji — zamawiasz bezpośrednio u producentów z Merter Stambuł.",
    feature2Title: "Gotowe Pakiety Rozmiarowe (Serie)",
    feature2Desc:
      "Odzież pakowana w proporcjonalne serie rozmiarowe (np. S, M, L / 2-2-2), gotowe do ekspozycji.",
    feature3Title: "Szybka Logistyka do Polski i UE",
    feature3Desc:
      "Transport lotniczy, drogowy oraz bezpłatna dostawa do Twojego spedytora cargo w Merter lub Laleli.",
    feature4Title: "Bezpieczne Płatności Firmowe",
    feature4Desc:
      "Przelew międzynarodowy SWIFT/SEPA, karty 3D Secure oraz faktury eksportowe 0% VAT (ATR).",
    feature5Title: "Private Label i Szycie na Zamówienie",
    feature5Desc:
      "Produkcja pod własną marką butiku, wszywki żakardowe, metki i kody kreskowe.",
    feature6Title: "Dedykowany Opiekun Eksportu",
    feature6Desc:
      "Wsparcie na każdym etapie zamówienia — od wideo-prezentacji kolekcji po odprawę celną.",
    processBadge: "Jak Działamy",
    stepsTitle: "Jak Złożyć Zamówienie Hurtowe?",
    stepsSubtitle: "4 proste kroki, aby zaopatrzyć Twój butik w najnowsze kolekcje z Turcji.",
    step1Title: "Wybierz Modele z Katalogu",
    step1Desc: "Przeglądaj tysiące sukienek, kompletów i dzianin z aktualnym stanem magazynowym.",
    step2Title: "Dodaj Pakiety do Koszyka",
    step2Desc: "Wybierz potrzebną liczbę serii lub wyślij listę zapytania ofertowego.",
    step3Title: "Potwierdź Transport i Płatność",
    step3Desc: "Ustal szczegóły wysyłki i faktury eksportowej z opiekunem handlowym.",
    step4Title: "Odbierz Skonsolidowaną Dostawę",
    step4Desc: "Zamówienia od wielu fabryk łączymy w jedną przesyłkę dostarczaną prosto pod drzwi.",
    formTitle: "Formularz Rejestracji Klienta Hurtowego",
    formSubtitle: "Wypełnij formularz, aby otrzymać cennik hurtowy i rabaty ilościowe.",
    formFullName: "Imię i Nazwisko *",
    formFullNamePh: "np. Karolina Nowak",
    formCompany: "Nazwa Firmy / Butiku *",
    formCompanyPh: "np. Butik Milano Sp. z o.o.",
    formPhone: "Telefon / WhatsApp *",
    formPhonePh: "+48 500 000 000",
    formEmail: "E-mail Firmowy *",
    formEmailPh: "zakupy@twojbutik.pl",
    formCountry: "Kraj / Miasto *",
    formCountryPh: "np. Polska / Warszawa lub Rzgów",
    formVolume: "Szacowany miesięczny wolumen zakupów",
    formVolumePh: "np. 200 - 500 szt. / mies.",
    formMessage: "Poszukiwane kategorie / Uwagi *",
    formMessagePh: "Sukienki, komplety damskie, swetry lub szycie Private Label...",
    formSubmit: "Wyślij Zapytanie Hurtowe",
    formSending: "Wysyłanie...",
    formSuccessTitle: "Zapytanie Zostało Przyjęte!",
    formSuccess:
      "Dziękujemy! Nasz dział eksportu skontaktuje się z Tobą wkrótce przez WhatsApp lub e-mail.",
    formSendAnother: "Wyślij kolejne zapytanie",
    cmsSectionTitle: "Warunki Współpracy Hurtowej B2B",
    fastLineBadge: "Szybki Kontakt B2B",
    fastLineTitle: "Połącz się przez WhatsApp",
    fastLineDesc:
      "Uzyskaj szybką wycenę, wideoprezentację produktów z showroomu i potwierdzenie stanów.",
    fastLineBtn: "Napisz na WhatsApp",
    assuranceTitle: "Gwarancja Bezpieczeństwa B2B",
    assurance1: "Oficjalna faktura eksportowa i świadectwo ATR do bezcłowego importu do UE.",
    assurance2: "Oryginalne pakiety z kodami kreskowymi bezpośrednio z fabryk Merter.",
    assurance3: "Ubezpieczony transport skonsolidowany door-to-door do Polski.",
    waDefaultHello:
      "Dzień dobry, chcę zapytać o warunki współpracy hurtowej B2B i minimalne zamówienie w Merter Vitrini.",
    waFormHeader: "*Zgłoszenie Klienta Hurtowego B2B*",
  },
  bg: {
    heroBadge: "Глобална B2B Мрежа за Търговия с Дрехи на Едро",
    heroTitle: "Портал за Търговия на Едро и B2B Доставки",
    heroSubtitle:
      "Купувайте директно от проверени производители на конфекция в Мертер, Истанбул. Асортови размерни серии, фабрични цени без посредници и експресна доставка до България и 120+ държави.",
    breadcrumbHome: "Начало",
    breadcrumbB2B: "Търговия на Едро & B2B",
    ctaBrowseCatalog: "Разгледайте Каталога на Едро",
    ctaWhatsapp: "Поискайте Оферта в WhatsApp",
    whyTitle: "Защо да изберете Merter Vitrini B2B?",
    whySubtitle:
      "Цялостна дигитална B2B платформа за собственици на бутици, складове на едро и търговски вериги.",
    feature1Title: "Директни Фабрични Цени",
    feature1Desc:
      "Без комисиони на посредници — поръчвате по реални производствени цени от фабриките в Мертер.",
    feature2Title: "Готови Размерни Серии (Пакети)",
    feature2Desc:
      "Продуктите са пакетирани в балансирани серии (S, M, L / 2-2-2), готови за продажба.",
    feature3Title: "Бърза Логистика до България и ЕС",
    feature3Desc:
      "Експресен сухопътен и въздушен транспорт или безплатна доставка до вашето карго в Мертер или Лалели.",
    feature4Title: "Сигурни Корпоративни Плащания",
    feature4Desc:
      "Банков превод SWIFT/SEPA, 3D Secure карти и официална експортна фактура с ATR сертификат.",
    feature5Title: "Private Label и Ишлеме Производство",
    feature5Desc:
      "Изработка на колекции под ваш собствен бранд, етикети и баркодове при определени обеми.",
    feature6Title: "Персонален Търговски Консултант",
    feature6Desc:
      "Пълно съдействие при избор на модели, видео оглед от шоурума и митнически документи.",
    processBadge: "Как Работим",
    stepsTitle: "Как да Поръчате на Едро?",
    stepsSubtitle: "4 лесни стъпки за зареждане на вашия магазин с нови турски колекции.",
    step1Title: "Разгледайте Онлайн Каталога",
    step1Desc: "Хиляди модели рокли, комплекти и плетива с актуална фабрична наличност.",
    step2Title: "Изберете Размерни Серии",
    step2Desc: "Добавете желаните пакети в количката или изпратете запитване за оферта.",
    step3Title: "Потвърдете Карго и Плащане",
    step3Desc: "Уточнете превозвача и начина на плащане с вашия търговски представител.",
    step4Title: "Бърза Консолидирана Доставка",
    step4Desc: "Вашите стоки от различни фабрики се обединяват и изпращат експресно до адреса ви.",
    formTitle: "Форма за Регистрация на Търговци на Едро",
    formSubtitle: "Попълнете формата, за да получите ценови листи на едро и отстъпки за обем.",
    formFullName: "Име и Фамилия *",
    formFullNamePh: "напр. Мария Иванова",
    formCompany: "Фирма / Бутик *",
    formCompanyPh: "напр. Бутик Елеганс ООД",
    formPhone: "Телефон / WhatsApp *",
    formPhonePh: "+359 88 000 0000",
    formEmail: "Фирмен Имейл *",
    formEmailPh: "orders@boutique.bg",
    formCountry: "Държава / Град *",
    formCountryPh: "напр. България / София или Пловдив",
    formVolume: "Очакван месечен обем на поръчките",
    formVolumePh: "напр. 200 - 500 бр. / месец",
    formMessage: "Интересуващи ви категории / Бележка *",
    formMessagePh: "Дамски рокли, комплекти, трикотаж или Private Label производство...",
    formSubmit: "Изпрати B2B Запитване",
    formSending: "Изпращане...",
    formSuccessTitle: "Вашето Запитване е Прието!",
    formSuccess:
      "Благодарим ви! Нашият експортен екип ще се свърже с вас по WhatsApp или телефон съвсем скоро.",
    formSendAnother: "Изпрати ново запитване",
    cmsSectionTitle: "Условия за Търговия на Едро и Наръчник",
    fastLineBadge: "Директна Връзка за Поръчки",
    fastLineTitle: "Свържете се Веднага в WhatsApp",
    fastLineDesc:
      "Получете оферта на живо, видео преглед на моделите от шоурума и потвърждение за наличност.",
    fastLineBtn: "Пишете ни в WhatsApp",
    assuranceTitle: "Корпоративна Сигурност",
    assurance1: "Официална експортна фактура и ATR документ за безмитен внос в ЕС.",
    assurance2: "Оригинални серии с баркод директно от сертифицирани фабрики в Мертер.",
    assurance3: "Застрахована доставка от врата до врата до всяка точка на България.",
    waDefaultHello:
      "Здравейте, интересувам се от условията за пазаруване на едро B2B и минималните количества в Merter Vitrini.",
    waFormHeader: "*B2B Запитване от Търговец на Едро*",
  },
};

export default function B2BClient({
  categoryPrefix,
  categories,
  activeLangs,
  settings,
}: Readonly<B2BClientProps>) {
  const router = useRouter();

  const matchedLang = activeLangs.find((l) => l.categoryPrefix === categoryPrefix);
  const currentLang = normalizeSeoLang(matchedLang?.code || categoryPrefix, "tr");
  const texts = UI_TEXTS[currentLang];

  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState<boolean>(false);
  const [policyModalType, setPolicyModalType] = useState<
    "cancellation_and_return" | "terms_of_service" | "privacy_policy" | ""
  >("");
  const [isLangOpen, setIsLangOpen] = useState<boolean>(false);

  const [formData, setFormData] = useState({
    fullName: "",
    company: "",
    phone: "",
    email: "",
    country: "",
    volume: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const displayCurrency = useSyncExternalStore(
    subscribeCurrency,
    getCurrencySnapshot,
    getCurrencyServerSnapshot
  );

  const totalPkgs = useSyncExternalStore(
    subscribeCurrency,
    getCartPkgsSnapshot,
    getCartPkgsServerSnapshot
  );

  const handleCurrencyChange = (curr: string) => {
    localStorage.setItem("merter_preferred_currency", curr);
    window.dispatchEvent(new Event("storage"));
  };

  const handleLangChange = (newLang: string) => {
    const matchLang = activeLangs.find((l) => l.code === newLang);
    const targetPrefix = matchLang?.categoryPrefix || newLang;
    router.push(`/${targetPrefix}/b2b`);
  };

  const sanitizedWhatsapp = (settings.whatsapp || "+90 533 703 08 83").replace(/\D/g, "");
  const whatsappUrl = `https://wa.me/${sanitizedWhatsapp}?text=${encodeURIComponent(texts.waDefaultHello)}`;

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    setIsSubmitting(false);
    setIsSubmitted(true);

    const waText =
      `${texts.waFormHeader}\n\n` +
      `👤 ${formData.fullName}\n` +
      `🏢 ${formData.company}\n` +
      `📱 ${formData.phone}\n` +
      `✉️ ${formData.email}\n` +
      `🌍 ${formData.country}\n` +
      `📦 ${formData.volume || "-"}\n\n` +
      `💬 ${formData.message}`;

    window.open(
      `https://wa.me/${sanitizedWhatsapp}?text=${encodeURIComponent(waText)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const jsonLdData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: texts.heroTitle,
    description: texts.heroSubtitle,
    inLanguage: currentLang,
    url: `${SITE_ORIGIN}/${currentLang}/b2b`,
    provider: {
      "@type": "Organization",
      name: "Merter Vitrini B2B",
      url: SITE_ORIGIN,
      logo: `${SITE_ORIGIN}/og-image.jpg`,
      telephone: settings.phone,
      email: sanitizePublicStoreEmail(settings.email),
      address: {
        "@type": "PostalAddress",
        streetAddress: sanitizePublicStoreAddress(settings.address),
        addressLocality: "Merter, Güngören",
        addressRegion: "İstanbul",
        addressCountry: "TR",
      },
    },
  };

  const features = [
    {
      icon: (
        <Factory
          size={24}
          className="text-[#8C6D3F] group-hover:scale-110 transition-transform"
        />
      ),
      title: texts.feature1Title,
      desc: texts.feature1Desc,
    },
    {
      icon: (
        <Box
          size={24}
          className="text-[#8C6D3F] group-hover:scale-110 transition-transform"
        />
      ),
      title: texts.feature2Title,
      desc: texts.feature2Desc,
    },
    {
      icon: (
        <Truck
          size={24}
          className="text-[#8C6D3F] group-hover:scale-110 transition-transform"
        />
      ),
      title: texts.feature3Title,
      desc: texts.feature3Desc,
    },
    {
      icon: (
        <CreditCard
          size={24}
          className="text-[#8C6D3F] group-hover:scale-110 transition-transform"
        />
      ),
      title: texts.feature4Title,
      desc: texts.feature4Desc,
    },
    {
      icon: (
        <Tag
          size={24}
          className="text-[#8C6D3F] group-hover:scale-110 transition-transform"
        />
      ),
      title: texts.feature5Title,
      desc: texts.feature5Desc,
    },
    {
      icon: (
        <Headset
          size={24}
          className="text-[#8C6D3F] group-hover:scale-110 transition-transform"
        />
      ),
      title: texts.feature6Title,
      desc: texts.feature6Desc,
    },
  ];

  return (
    <div
      className="min-h-screen flex flex-col bg-zinc-50/70 text-[#1C1C1C] font-sans antialiased selection:bg-[#1C1C1C] selection:text-white"
      style={{ direction: currentLang === "ar" ? "rtl" : "ltr" }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLdData) }}
      />

      <Header
        lang={currentLang}
        setLang={handleLangChange}
        isLangOpen={isLangOpen}
        setIsLangOpen={setIsLangOpen}
        totalPkgs={totalPkgs}
        setIsCartOpen={(open) => {
          if (open) router.push(`/${categoryPrefix}/cart`);
        }}
        setSearchQuery={() => {}}
        setCurrentPage={() => {}}
        setActiveCategoryId={() => {}}
        categories={categories}
        activeCategoryId=""
        displayCurrency={displayCurrency}
        onCurrencyChange={handleCurrencyChange}
      />

      <div className="w-full bg-white border-b border-[#E5E0D8] py-3 px-6 md:px-12 text-xs text-zinc-500 font-medium">
        <div className="max-w-[1440px] mx-auto flex items-center gap-2">
          <a href={`/${categoryPrefix}`} className="hover:text-[#1C1C1C] transition-colors">
            {texts.breadcrumbHome}
          </a>
          <span className="text-zinc-300">/</span>
          <span className="text-[#1C1C1C] font-semibold">{texts.breadcrumbB2B}</span>
        </div>
      </div>

      <main className="flex-1 w-full max-w-[1440px] mx-auto px-6 md:px-12 py-10 flex flex-col gap-12">
        <section className="relative overflow-hidden rounded-lg bg-[#F8F6F2] text-[#1C1C1C] p-8 md:p-12 border border-[#E5E0D8] shadow-xs">
          <div className="relative z-10 max-w-3xl flex flex-col gap-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-[#E5E0D8] text-[#6E542E] text-[11px] font-bold w-fit tracking-wider uppercase">
              <Sparkles size={14} className="text-[#8C6D3F]" />
              {texts.heroBadge}
            </div>

            <h1 className="text-3xl md:text-5xl font-black tracking-tight text-[#1C1C1C] leading-tight">
              {texts.heroTitle}
            </h1>

            <p className="text-sm md:text-base text-[#525252] leading-relaxed font-normal">
              {texts.heroSubtitle}
            </p>

            <div className="flex flex-wrap gap-4 pt-3">
              <a
                href={`/${categoryPrefix}/tum-urunler`}
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-md bg-[#1C1C1C] hover:bg-[#333333] text-white text-xs font-bold shadow-xs transition-colors"
              >
                {texts.ctaBrowseCatalog}
                <ArrowRight size={16} className="rtl:rotate-180" />
              </a>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-md bg-[#15803D] hover:bg-[#166534] text-white text-xs font-bold shadow-xs transition-colors"
              >
                <MessageSquare size={16} />
                {texts.ctaWhatsapp}
              </a>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            <h2 className="text-2xl font-bold text-[#1C1C1C] tracking-tight">
              {texts.whyTitle}
            </h2>
            <p className="text-xs text-zinc-500 font-medium">{texts.whySubtitle}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="bg-white rounded-lg p-7 border border-[#E5E0D8] shadow-xs flex flex-col gap-4 hover:shadow-md hover:border-[#1C1C1C]/40 transition-all group"
              >
                <div className="w-12 h-12 rounded-md flex items-center justify-center transition-colors bg-[#F8F6F2] border border-[#E5E0D8]">
                  {f.icon}
                </div>
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-base font-bold text-[#1C1C1C]">{f.title}</h3>
                  <p className="text-xs text-[#525252] leading-relaxed font-normal">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-lg p-8 md:p-10 border border-[#E5E0D8] shadow-xs flex flex-col gap-8">
          <div>
            <span className="text-xs font-bold text-[#8C6D3F] uppercase tracking-widest block mb-1">
              {texts.processBadge}
            </span>
            <h2 className="text-2xl md:text-3xl font-bold text-[#1C1C1C] tracking-tight">
              {texts.stepsTitle}
            </h2>
            <p className="text-xs text-zinc-500 mt-1 font-medium">{texts.stepsSubtitle}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { no: "01", title: texts.step1Title, desc: texts.step1Desc },
              { no: "02", title: texts.step2Title, desc: texts.step2Desc },
              { no: "03", title: texts.step3Title, desc: texts.step3Desc },
              { no: "04", title: texts.step4Title, desc: texts.step4Desc },
            ].map((step) => (
              <div
                key={step.no}
                className="p-5 rounded-lg bg-[#F8F6F2] border border-[#E5E0D8] flex flex-col gap-2"
              >
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-[#1C1C1C] text-white text-xs font-black">
                  {step.no}
                </span>
                <h3 className="text-sm font-bold text-[#1C1C1C] mt-1">{step.title}</h3>
                <p className="text-xs text-[#525252] leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 bg-white rounded-lg p-8 md:p-10 border border-[#E5E0D8] shadow-xs flex flex-col gap-6">
            <div>
              <h2 className="text-2xl font-bold text-[#1C1C1C] tracking-tight">
                {texts.formTitle}
              </h2>
              <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed font-medium">
                {texts.formSubtitle}
              </p>
            </div>

            {isSubmitted ? (
              <div className="p-8 rounded-lg bg-emerald-50 border border-emerald-200 flex flex-col items-center justify-center text-center gap-3">
                <CheckCircle2 size={48} className="text-[#15803D]" />
                <h3 className="text-lg font-bold text-emerald-950">
                  {texts.formSuccessTitle}
                </h3>
                <p className="text-xs text-emerald-800 max-w-md leading-relaxed">
                  {texts.formSuccess}
                </p>
                <button
                  type="button"
                  onClick={() => setIsSubmitted(false)}
                  className="mt-2 text-xs font-bold text-[#15803D] hover:text-emerald-900 underline cursor-pointer"
                >
                  {texts.formSendAnother}
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
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, fullName: e.target.value }))
                      }
                      placeholder={texts.formFullNamePh}
                      className="px-4 py-2.5 rounded-md border border-[#D6D1C7] text-sm focus:outline-none focus:border-[#1C1C1C] transition-colors"
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
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, company: e.target.value }))
                      }
                      placeholder={texts.formCompanyPh}
                      className="px-4 py-2.5 rounded-md border border-[#D6D1C7] text-sm focus:outline-none focus:border-[#1C1C1C] transition-colors"
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
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, phone: e.target.value }))
                      }
                      placeholder={texts.formPhonePh}
                      className="px-4 py-2.5 rounded-md border border-[#D6D1C7] text-sm focus:outline-none focus:border-[#1C1C1C] transition-colors"
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
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, email: e.target.value }))
                      }
                      placeholder={texts.formEmailPh}
                      className="px-4 py-2.5 rounded-md border border-[#D6D1C7] text-sm focus:outline-none focus:border-[#1C1C1C] transition-colors"
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
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, country: e.target.value }))
                      }
                      placeholder={texts.formCountryPh}
                      className="px-4 py-2.5 rounded-md border border-[#D6D1C7] text-sm focus:outline-none focus:border-[#1C1C1C] transition-colors"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-zinc-600 uppercase tracking-wider">
                      {texts.formVolume}
                    </label>
                    <input
                      type="text"
                      value={formData.volume}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, volume: e.target.value }))
                      }
                      placeholder={texts.formVolumePh}
                      className="px-4 py-2.5 rounded-md border border-[#D6D1C7] text-sm focus:outline-none focus:border-[#1C1C1C] transition-colors"
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
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, message: e.target.value }))
                    }
                    placeholder={texts.formMessagePh}
                    className="px-4 py-2.5 rounded-md border border-[#D6D1C7] text-sm focus:outline-none focus:border-[#1C1C1C] transition-colors leading-relaxed"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="mt-2 inline-flex items-center justify-center gap-2 py-3.5 px-6 rounded-md bg-[#1C1C1C] hover:bg-[#333333] disabled:bg-zinc-400 text-white text-sm font-bold shadow-xs transition-colors cursor-pointer"
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

          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="bg-[#F8F6F2] rounded-lg p-7 border border-[#E5E0D8] shadow-xs flex flex-col gap-4 text-[#1C1C1C]">
              <span className="text-[11px] font-bold text-[#8C6D3F] uppercase tracking-wider">
                {texts.fastLineBadge}
              </span>
              <h3 className="text-xl font-bold text-[#1C1C1C]">{texts.fastLineTitle}</h3>
              <p className="text-xs text-[#525252] leading-relaxed font-normal">
                {texts.fastLineDesc}
              </p>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-md bg-[#15803D] hover:bg-[#166534] text-white text-xs font-bold shadow-xs transition-colors"
              >
                <MessageSquare size={16} />
                {texts.fastLineBtn}
              </a>
            </div>

            <div className="bg-white rounded-lg p-7 border border-[#E5E0D8] shadow-xs flex flex-col gap-4 text-xs text-[#525252]">
              <div className="font-bold text-[#1C1C1C] flex items-center gap-2 text-sm">
                <ShieldCheck size={18} className="text-[#15803D]" />
                {texts.assuranceTitle}
              </div>
              <ul className="space-y-2.5">
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={14} className="text-[#15803D] shrink-0 mt-0.5" />
                  <span>{texts.assurance1}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={14} className="text-[#15803D] shrink-0 mt-0.5" />
                  <span>{texts.assurance2}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={14} className="text-[#15803D] shrink-0 mt-0.5" />
                  <span>{texts.assurance3}</span>
                </li>
              </ul>
            </div>
          </div>
        </section>
      </main>

      <Footer
        lang={currentLang}
        onOpenPolicy={(type) => {
          setPolicyModalType(type);
          setIsPolicyModalOpen(true);
        }}
      />

      <PolicyViewerModal
        isOpen={isPolicyModalOpen}
        onClose={() => setIsPolicyModalOpen(false)}
        policyType={policyModalType}
        lang={currentLang}
      />
    </div>
  );
}
