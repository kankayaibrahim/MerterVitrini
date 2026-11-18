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
  Loader2,
} from "lucide-react";
import Header from "@/components/store/Header";
import Footer from "@/components/store/Footer";
import PolicyViewerModal from "@/components/store/PolicyViewerModal";
import SafeHtml from "@/components/common/SafeHtml";
import { trackWhatsappClick } from "@/app/utils";
import { CartItem, Category } from "@/types/store";
import {
  SITE_ORIGIN,
  SupportedSeoLang,
  normalizeSeoLang,
  safeJsonLd,
} from "@/utils/seoHelpers";
import {
  resolveAddressLocality,
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

export interface ContactCMSPage {
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

interface ContactUITexts {
  readonly heroBadge: string;
  readonly heroTitle: string;
  readonly heroSubtitle: string;
  readonly breadcrumbHome: string;
  readonly breadcrumbContact: string;
  readonly addressTitle: string;
  readonly addressDesc: string;
  readonly phoneTitle: string;
  readonly phoneDesc: string;
  readonly whatsappTitle: string;
  readonly whatsappDesc: string;
  readonly onlineBadge: string;
  readonly emailTitle: string;
  readonly emailDesc: string;
  readonly hoursTitle: string;
  readonly hoursWeekday: string;
  readonly hoursSaturday: string;
  readonly hoursSunday: string;
  readonly officialNetworkBadge: string;
  readonly copyBtn: string;
  readonly copiedBtn: string;
  readonly showOnMap: string;
  readonly directionsBtn: string;
  readonly chatWhatsappBtn: string;
  readonly callBtn: string;
  readonly sendEmailBtn: string;
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
  readonly formMessage: string;
  readonly formMessagePh: string;
  readonly formSubmit: string;
  readonly formSending: string;
  readonly formSuccessTitle: string;
  readonly formSuccess: string;
  readonly formSendAnother: string;
  readonly mapTitle: string;
  readonly mapCityBadge: string;
  readonly transitTitle: string;
  readonly transitDesc: string;
  readonly liveMapLink: string;
  readonly cmsSectionTitle: string;
  readonly waHello: string;
  readonly waFormHeader: string;
  readonly emailSubject: string;
}

const UI_TEXTS: Record<SupportedSeoLang, ContactUITexts> = {
  tr: {
    heroBadge: "B2B Toptan Showroom & İletişim Merkezi",
    heroTitle: "Bizimle İletişime Geçin",
    heroSubtitle:
      "Merter tekstil piyasasının lider üreticileriyle doğrudan bağlantı kurun. Toptan sipariş, showroom ziyareti veya özel üretim talepleriniz için uzman ekibimiz 7/24 yanınızda.",
    breadcrumbHome: "Ana Sayfa",
    breadcrumbContact: "İletişim Bilgileri",
    addressTitle: "Showroom & Merkez Ofis",
    addressDesc: "İstanbul toptan tekstil merkezinde showroomumuzu ziyaret edebilirsiniz.",
    phoneTitle: "Müşteri Hizmetleri",
    phoneDesc: "Hafta içi ve cumartesi günleri doğrudan satış temsilcimize ulaşın.",
    whatsappTitle: "7/24 WhatsApp Sipariş",
    whatsappDesc: "Hızlı fiyat teklifi, video aramalı ürün inceleme ve anlık sipariş desteği.",
    onlineBadge: "Canlı / Online",
    emailTitle: "Kurumsal E-Posta",
    emailDesc: "Toptan ihracat, müşteri/tedarikçi ve resmi iş birliği talepleriniz için.",
    hoursTitle: "Çalışma Saatleri",
    hoursWeekday: "Pazartesi - Cuma: 09:00 - 18:30",
    hoursSaturday: "Cumartesi: 09:00 - 14:00",
    hoursSunday: "Pazar: Randevulu / WhatsApp Aktif",
    officialNetworkBadge: "Resmi Toptan Tekstil İhracatçısı & Doğrulanmış Üretici Ağı",
    copyBtn: "Kopyala",
    copiedBtn: "Kopyalandı!",
    showOnMap: "Haritada Göster",
    directionsBtn: "Yol Tarifi Al (Google Haritalar)",
    chatWhatsappBtn: "WhatsApp'tan Hemen Yazın",
    callBtn: "Hemen Arayın",
    sendEmailBtn: "E-Posta Gönderin",
    formTitle: "Hızlı Toptan Teklif & İletişim Formu",
    formSubtitle:
      "Aşağıdaki formu doldurun, toptan müşteri temsilcimiz en geç 15 dakika içinde sizinle iletişime geçsin.",
    formFullName: "Adınız Soyadınız *",
    formFullNamePh: "Örn: Ahmet Yılmaz",
    formCompany: "Firma / Butik Adınız",
    formCompanyPh: "Örn: Moda Butik Tekstil",
    formPhone: "Telefon / WhatsApp Numaranız *",
    formPhonePh: "+90 532 000 00 00",
    formEmail: "E-Posta Adresiniz *",
    formEmailPh: "siparis@butiginiz.com",
    formCountry: "Ülke / Şehir",
    formCountryPh: "Örn: Türkiye / İstanbul veya Almanya / Berlin",
    formMessage: "Talebiniz / İlgilendiğiniz Ürün Grupları *",
    formMessagePh:
      "İlgilendiğiniz ürün modelleri, asorti koli adetleri veya showroom randevu talebinizi belirtiniz...",
    formSubmit: "Talebi Gönder & İletişime Geç",
    formSending: "Gönderiliyor...",
    formSuccessTitle: "Talebiniz Alındı!",
    formSuccess:
      "Mesajınız başarıyla iletildi! Temsilcimiz en kısa sürede sizinle iletişime geçecektir.",
    formSendAnother: "Yeni bir mesaj gönder",
    mapTitle: "Merter Vitrini Showroom Konumu",
    mapCityBadge: "İstanbul / Türkiye",
    transitTitle: "Ulaşım ve Lokasyon Bilgisi:",
    transitDesc:
      "Showroomumuz Merter Tekstil Çarşısı merkezine, M1A metro hattına ve T1 tramvay durağına yürüme mesafesindedir.",
    liveMapLink: "Canlı Konuma Git",
    cmsSectionTitle: "Toptan Satış ve Showroom Hakkında",
    waHello:
      "Merhaba, Merter Vitrini B2B toptan ürünler hakkında bilgi ve fiyat teklifi almak istiyorum.",
    waFormHeader: "*B2B Toptan İletişim Talebi*",
    emailSubject: "B2B Toptan Sipariş ve Bilgi Talebi",
  },
  en: {
    heroBadge: "B2B Wholesale Showroom & Support Hub",
    heroTitle: "Get in Touch With Us",
    heroSubtitle:
      "Connect directly with verified Istanbul Merter apparel manufacturers. Our export desk is available 24/7 for wholesale orders, showroom appointments, and private label inquiries.",
    breadcrumbHome: "Home",
    breadcrumbContact: "Contact Information",
    addressTitle: "Showroom & Head Office",
    addressDesc: "Visit our wholesale showroom in the heart of Istanbul's Merter textile district.",
    phoneTitle: "Customer Support",
    phoneDesc: "Speak directly with our multilingual wholesale sales executives.",
    whatsappTitle: "24/7 WhatsApp Hotline",
    whatsappDesc: "Instant price quotes, live video showroom tours, and fast order placement.",
    onlineBadge: "Live / Online",
    emailTitle: "Corporate Email",
    emailDesc: "For export invoices, wholesale buyer/supplier inquiries, and official partnerships.",
    hoursTitle: "Working Hours",
    hoursWeekday: "Monday - Friday: 09:00 - 18:30 (GMT+3)",
    hoursSaturday: "Saturday: 09:00 - 14:00 (GMT+3)",
    hoursSunday: "Sunday: By Appointment / WhatsApp Active",
    officialNetworkBadge: "Verified Turkish Apparel Export & Manufacturer Network",
    copyBtn: "Copy",
    copiedBtn: "Copied!",
    showOnMap: "Open in Google Maps",
    directionsBtn: "Get Directions (Google Maps)",
    chatWhatsappBtn: "Chat on WhatsApp",
    callBtn: "Call Us Now",
    sendEmailBtn: "Send Email",
    formTitle: "Quick Wholesale Inquiry Form",
    formSubtitle:
      "Complete the form below and an international export specialist will respond within 15 minutes.",
    formFullName: "Full Name *",
    formFullNamePh: "e.g. Sarah Jenkins",
    formCompany: "Company / Boutique Name",
    formCompanyPh: "e.g. Bella Moda Boutique",
    formPhone: "Phone / WhatsApp Number *",
    formPhonePh: "+44 7700 900000",
    formEmail: "Email Address *",
    formEmailPh: "orders@yourboutique.com",
    formCountry: "Country / City",
    formCountryPh: "e.g. United Kingdom / London",
    formMessage: "Your Request / Product Categories *",
    formMessagePh:
      "Share target categories, pack quantities, cargo agent details, or showroom appointment date...",
    formSubmit: "Submit Inquiry",
    formSending: "Sending...",
    formSuccessTitle: "Inquiry Received!",
    formSuccess: "Your message has been delivered! Our team will contact you shortly.",
    formSendAnother: "Send another message",
    mapTitle: "Merter Vitrini Showroom Location",
    mapCityBadge: "Istanbul / Turkey",
    transitTitle: "Transit & Location Guide:",
    transitDesc:
      "Located in the Merter Wholesale Textile District, within walking distance of M1A Merter Metro and T1 Tram stations.",
    liveMapLink: "Open Live Location",
    cmsSectionTitle: "About Wholesale Orders & Showroom",
    waHello:
      "Hello, I would like wholesale catalog and pricing information from Merter Vitrini B2B.",
    waFormHeader: "*B2B Wholesale Contact Request*",
    emailSubject: "B2B Wholesale Order & Sourcing Inquiry",
  },
  ru: {
    heroBadge: "B2B Оптовый Шоурум и Служба Поддержки",
    heroTitle: "Свяжитесь с Нами",
    heroSubtitle:
      "Прямая связь с проверенными швейными фабриками Мертера (Стамбул). Консультации по закупкам размерными рядами, посещению шоурума и отправке карго 24/7.",
    breadcrumbHome: "Главная",
    breadcrumbContact: "Контакты",
    addressTitle: "Шоурум и Главный Офис",
    addressDesc: "Посетите наш оптовый шоурум в центре текстильного района Мертер в Стамбуле.",
    phoneTitle: "Служба Поддержки",
    phoneDesc: "Прямая телефонная линия с русскоязычными менеджерами.",
    whatsappTitle: "24/7 Линия WhatsApp",
    whatsappDesc: "Быстрый расчет партий, видеопоказ коллекций и оформление заказа.",
    onlineBadge: "Онлайн",
    emailTitle: "Корпоративная Почта",
    emailDesc: "Для экспортных контрактов, прайс-листов и официальных запросов.",
    hoursTitle: "Часы Работы",
    hoursWeekday: "Понедельник - Пятница: 09:00 - 18:30",
    hoursSaturday: "Суббота: 09:00 - 14:00",
    hoursSunday: "Воскресенье: По записи / WhatsApp 24/7",
    officialNetworkBadge: "Официальная Сеть Экспортеров и Швейных Фабрик Мертера",
    copyBtn: "Копировать",
    copiedBtn: "Скопировано!",
    showOnMap: "Открыть на карте",
    directionsBtn: "Маршрут в Google Maps",
    chatWhatsappBtn: "Написать в WhatsApp",
    callBtn: "Позвонить",
    sendEmailBtn: "Отправить E-mail",
    formTitle: "Быстрый Запрос в Отдел Оптовых Продаж",
    formSubtitle: "Заполните форму, и менеджер свяжется с вами в течение 15 минут.",
    formFullName: "Имя и Фамилия *",
    formFullNamePh: "Например: Елена Смирнова",
    formCompany: "Компания / Магазин",
    formCompanyPh: "Например: Бутик Мода",
    formPhone: "Телефон / WhatsApp *",
    formPhonePh: "+7 999 000 00 00",
    formEmail: "Электронная Почта *",
    formEmailPh: "zakupki@shop.ru",
    formCountry: "Страна / Город",
    formCountryPh: "Например: Россия / Москва",
    formMessage: "Ваш Запрос / Категории Товаров *",
    formMessagePh: "Укажите интересующие модели, количество серий или дату визита в шоурум...",
    formSubmit: "Отправить Запрос",
    formSending: "Отправка...",
    formSuccessTitle: "Запрос Принят!",
    formSuccess: "Сообщение отправлено! Менеджер свяжется с вами в ближайшее время.",
    formSendAnother: "Отправить еще одно сообщение",
    mapTitle: "Расположение Шоурума Merter Vitrini",
    mapCityBadge: "Стамбул / Турция",
    transitTitle: "Как добраться:",
    transitDesc:
      "Шоурум расположен в центре текстильного квартала Мертер в пешей доступности от метро M1A Merter и трамвая T1.",
    liveMapLink: "Открыть на карте",
    cmsSectionTitle: "Информация о Шоуруме и Оптовых Закупках",
    waHello:
      "Здравствуйте! Хочу получить информацию и оптовый прайс на коллекции Merter Vitrini B2B.",
    waFormHeader: "*B2B Контактный Запрос*",
    emailSubject: "Оптовый заказ и сотрудничество B2B",
  },
  ar: {
    heroBadge: "صالة عرض الجملة B2B ومركز الدعم",
    heroTitle: "تواصل معنا مباشرة",
    heroSubtitle:
      "اتصل مباشرة بمصانع الملابس المعتمدة في منطقة مارتر إسطنبول. فريقنا متاح 24/7 لطلبات الجملة وزيارات صالة العرض والشحن الدولي.",
    breadcrumbHome: "الرئيسية",
    breadcrumbContact: "معلومات الاتصال",
    addressTitle: "صالة العرض والمكتب الرئيسي",
    addressDesc: "تفضلوا بزيارة صالة العرض في قلب سوق مارتر للملابس بالجملة في إسطنبول.",
    phoneTitle: "خدمة العملاء",
    phoneDesc: "تواصل مباشر مع مسؤولي المبيعات باللغة العربية.",
    whatsappTitle: "خط واتساب للطلبات 24/7",
    whatsappDesc: "عروض أسعار فورية، جولات فيديو حية في المعرض وتأكيد الطلبات.",
    onlineBadge: "متصل الآن",
    emailTitle: "البريد الإلكتروني المؤسسي",
    emailDesc: "لطلبات التصدير واستفسارات المشترين والموردين والمراسلات الرسمية.",
    hoursTitle: "أوقات العمل",
    hoursWeekday: "الاثنين - الجمعة: 09:00 - 18:30",
    hoursSaturday: "السبت: 09:00 - 14:00",
    hoursSunday: "الأحد: بموعد مسبق / واتساب نشط",
    officialNetworkBadge: "شبكة التصدير الرسمية ومصانع مارتر المعتمدة",
    copyBtn: "نسخ",
    copiedBtn: "تم النسخ!",
    showOnMap: "عرض على الخريطة",
    directionsBtn: "الاتجاهات (خرائط Google)",
    chatWhatsappBtn: "مراسلة عبر واتساب",
    callBtn: "اتصل بنا الآن",
    sendEmailBtn: "إرسال بريد إلكتروني",
    formTitle: "نموذج التواصل السريع لطلبات الجملة",
    formSubtitle: "أرسل بياناتك وسيتواصل معك مسؤول التصدير خلال 15 دقيقة.",
    formFullName: "الاسم الكامل *",
    formFullNamePh: "مثال: محمد العلي",
    formCompany: "اسم الشركة / البوتيك",
    formCompanyPh: "مثال: بوتيك الأناقة",
    formPhone: "رقم الهاتف / واتساب *",
    formPhonePh: "+966 50 000 0000",
    formEmail: "البريد الإلكتروني *",
    formEmailPh: "info@boutique.com",
    formCountry: "الدولة / المدينة",
    formCountryPh: "مثال: السعودية / الرياض",
    formMessage: "تفاصيل طلبك / الأقسام المطلوبة *",
    formMessagePh: "اذكر الموديلات المطلوبة أو عدد الباكتات أو موعد زيارة المعرض...",
    formSubmit: "إرسال الطلب",
    formSending: "جاري الإرسال...",
    formSuccessTitle: "تم استلام رسالتك!",
    formSuccess: "تم إرسال رسالتك بنجاح! سيتواصل معك فريقنا قريباً.",
    formSendAnother: "إرسال رسالة جديدة",
    mapTitle: "موقع صالة عرض Merter Vitrini",
    mapCityBadge: "إسطنبول / تركيا",
    transitTitle: "معلومات الموقع والمواصلات:",
    transitDesc:
      "تقع صالة العرض في قلب سوق مارتر للمنسوجات على بُعد خطوات من محطة مترو M1A وترام T1.",
    liveMapLink: "الانتقال إلى الموقع المباشر",
    cmsSectionTitle: "حول صالة العرض ومبيعات الجملة",
    waHello: "مرحباً، أرغب في الحصول على كتالوج وأسعار الجملة من منصة Merter Vitrini B2B.",
    waFormHeader: "*طلب تواصل B2B بالجملة*",
    emailSubject: "استفسار طلب جملة B2B",
  },
  de: {
    heroBadge: "B2B-Großhandels-Showroom & Kundenbetreuung",
    heroTitle: "Kontaktieren Sie Uns",
    heroSubtitle:
      "Direkter Draht zu geprüften Textilherstellern in Istanbul Merter. Unser B2B-Exportteam berät Sie rund um Großhandelsbestellungen, Showroom-Termine und Private Label.",
    breadcrumbHome: "Startseite",
    breadcrumbContact: "Kontakt & Showroom",
    addressTitle: "Showroom & Hauptsitz",
    addressDesc: "Besuchen Sie unseren Showroom im Textilzentrum Merter in Istanbul.",
    phoneTitle: "Kundenservice",
    phoneDesc: "Direkter telefonischer Kontakt zu unseren Exportberatern.",
    whatsappTitle: "24/7 WhatsApp-Bestellhotline",
    whatsappDesc: "Schnelle Preisangebote, Live-Videoberatung und Bestellannahme.",
    onlineBadge: "Live / Online",
    emailTitle: "Firmen-E-Mail",
    emailDesc: "Für Exportrechnungen, B2B-Kunden-/Lieferantenanfragen und Kooperationen.",
    hoursTitle: "Öffnungszeiten",
    hoursWeekday: "Montag - Freitag: 09:00 - 18:30 (GMT+3)",
    hoursSaturday: "Samstag: 09:00 - 14:00 (GMT+3)",
    hoursSunday: "Sonntag: Nach Vereinbarung / WhatsApp aktiv",
    officialNetworkBadge: "Geprüftes Textil-Export- & Herstellernetzwerk Istanbul",
    copyBtn: "Kopieren",
    copiedBtn: "Kopiert!",
    showOnMap: "Auf Karte zeigen",
    directionsBtn: "Route planen (Google Maps)",
    chatWhatsappBtn: "Per WhatsApp schreiben",
    callBtn: "Jetzt anrufen",
    sendEmailBtn: "E-Mail senden",
    formTitle: "Schnelles B2B-Anfrageformular",
    formSubtitle: "Füllen Sie das Formular aus — unser Team antwortet innerhalb von 15 Minuten.",
    formFullName: "Vor- und Nachname *",
    formFullNamePh: "z. B. Anna Weber",
    formCompany: "Firma / Boutique",
    formCompanyPh: "z. B. Modehaus Weber",
    formPhone: "Telefon / WhatsApp *",
    formPhonePh: "+49 170 0000000",
    formEmail: "E-Mail-Adresse *",
    formEmailPh: "einkauf@ihreboutique.de",
    formCountry: "Land / Stadt",
    formCountryPh: "z. B. Deutschland / Berlin",
    formMessage: "Ihre Nachricht / Warengruppen *",
    formMessagePh: "Gewünschte Kollektionen, Serienmengen oder Terminwunsch für den Showroom...",
    formSubmit: "Anfrage absenden",
    formSending: "Wird gesendet...",
    formSuccessTitle: "Anfrage erhalten!",
    formSuccess: "Ihre Nachricht wurde erfolgreich übermittelt! Wir melden uns umgehend.",
    formSendAnother: "Weitere Nachricht senden",
    mapTitle: "Merter Vitrini Showroom-Standort",
    mapCityBadge: "Istanbul / Türkei",
    transitTitle: "Anfahrt & Lage:",
    transitDesc:
      "Zentral im Textilviertel Merter gelegen, fußläufig zur Metro-Linie M1A (Station Merter) und Straßenbahn T1.",
    liveMapLink: "Live-Standort öffnen",
    cmsSectionTitle: "Über unseren Großhandels-Showroom",
    waHello:
      "Hallo, ich bitte um Informationen und Großhandelspreise zu den Kollektionen auf Merter Vitrini B2B.",
    waFormHeader: "*B2B-Kontaktanfrage*",
    emailSubject: "B2B-Großhandelsanfrage",
  },
  fr: {
    heroBadge: "Showroom Grossiste B2B & Support Export",
    heroTitle: "Contactez Notre Équipe",
    heroSubtitle:
      "Lien direct avec les fabricants de prêt-à-porter de Merter Istanbul. Notre service export est disponible 24/7 pour vos commandes en gros et rendez-vous showroom.",
    breadcrumbHome: "Accueil",
    breadcrumbContact: "Contact & Showroom",
    addressTitle: "Showroom & Siège Social",
    addressDesc: "Visitez notre showroom au cœur du quartier textile de Merter à Istanbul.",
    phoneTitle: "Service Client B2B",
    phoneDesc: "Appelez directement nos conseillers commerciaux export.",
    whatsappTitle: "Ligne WhatsApp 24/7",
    whatsappDesc: "Devis rapides, visite vidéo en direct et suivi de commandes.",
    onlineBadge: "En ligne",
    emailTitle: "E-mail Professionnel",
    emailDesc: "Pour les demandes d'exportation, factures proforma et partenariats.",
    hoursTitle: "Horaires d'Ouverture",
    hoursWeekday: "Lundi - Vendredi : 09h00 - 18h30 (GMT+3)",
    hoursSaturday: "Samedi : 09h00 - 14h00 (GMT+3)",
    hoursSunday: "Dimanche : Sur rendez-vous / WhatsApp actif",
    officialNetworkBadge: "Réseau Officiel d'Exportateurs & Fabricants Textiles d'Istanbul",
    copyBtn: "Copier",
    copiedBtn: "Copié !",
    showOnMap: "Voir sur la carte",
    directionsBtn: "Itinéraire (Google Maps)",
    chatWhatsappBtn: "Écrire sur WhatsApp",
    callBtn: "Appeler Maintenant",
    sendEmailBtn: "Envoyer un E-mail",
    formTitle: "Formulaire Rapide de Devis Grossiste",
    formSubtitle: "Remplissez ce formulaire et notre équipe export vous répondra sous 15 minutes.",
    formFullName: "Nom et Prénom *",
    formFullNamePh: "ex. Claire Dupont",
    formCompany: "Société / Boutique",
    formCompanyPh: "ex. Boutique Élégance",
    formPhone: "Téléphone / WhatsApp *",
    formPhonePh: "+33 6 00 00 00 00",
    formEmail: "Adresse E-mail *",
    formEmailPh: "achats@votreboutique.fr",
    formCountry: "Pays / Ville",
    formCountryPh: "ex. France / Paris",
    formMessage: "Votre Demande / Produits recherchés *",
    formMessagePh: "Précisez les catégories souhaitées, quantités par série ou date de visite...",
    formSubmit: "Envoyer la Demande",
    formSending: "Envoi...",
    formSuccessTitle: "Demande Envoyée !",
    formSuccess: "Votre message a bien été transmis ! Notre équipe vous recontactera très vite.",
    formSendAnother: "Envoyer un autre message",
    mapTitle: "Localisation du Showroom Merter Vitrini",
    mapCityBadge: "Istanbul / Turquie",
    transitTitle: "Accès & Transport :",
    transitDesc:
      "Situé au centre du quartier textile de Merter, à quelques minutes à pied du métro M1A Merter et du tramway T1.",
    liveMapLink: "Ouvrir la localisation",
    cmsSectionTitle: "À propos du Showroom & Vente en Gros",
    waHello:
      "Bonjour, je souhaite recevoir des informations et tarifs de gros sur les collections Merter Vitrini B2B.",
    waFormHeader: "*Demande de Contact B2B*",
    emailSubject: "Demande de devis grossiste B2B",
  },
  pl: {
    heroBadge: "Showroom Hurtowy B2B i Centrum Wsparcia",
    heroTitle: "Skontaktuj Się z Nami",
    heroSubtitle:
      "Bezpośredni kontakt ze sprawdzonymi producentami odzieży z dzielnicy Merter w Stambule. Nasz zespół eksportowy służy pomocą 24/7 przy zamówieniach hurtowych.",
    breadcrumbHome: "Strona główna",
    breadcrumbContact: "Kontakt i Showroom",
    addressTitle: "Showroom i Siedziba Główna",
    addressDesc: "Odwiedź nasz showroom w samym sercu dzielnicy tekstylnej Merter w Stambule.",
    phoneTitle: "Biuro Obsługi B2B",
    phoneDesc: "Zadzwoń bezpośrednio do naszych doradców handlowych.",
    whatsappTitle: "Całodobowa Linia WhatsApp",
    whatsappDesc: "Szybkie wyceny, wideoprezentacje z showroomu i składanie zamówień.",
    onlineBadge: "Online",
    emailTitle: "E-mail Firmowy",
    emailDesc: "W sprawach eksportu, faktur i stałej współpracy hurtowej.",
    hoursTitle: "Godziny Otwarcia",
    hoursWeekday: "Poniedziałek - Piątek: 09:00 - 18:30 (GMT+3)",
    hoursSaturday: "Sobota: 09:00 - 14:00 (GMT+3)",
    hoursSunday: "Niedziela: Po umówieniu / WhatsApp aktywny",
    officialNetworkBadge: "Oficjalna Sieć Tureckich Producentów i Eksporterów Odzieży",
    copyBtn: "Kopiuj",
    copiedBtn: "Skopiowano!",
    showOnMap: "Pokaż na mapie",
    directionsBtn: "Wyznacz trasę (Google Maps)",
    chatWhatsappBtn: "Napisz na WhatsApp",
    callBtn: "Zadzwoń Teraz",
    sendEmailBtn: "Wyślij E-mail",
    formTitle: "Szybki Formularz Zapytania Hurtowego",
    formSubtitle: "Wypełnij formularz — nasz opiekun eksportu odpowie w ciągu 15 minut.",
    formFullName: "Imię i Nazwisko *",
    formFullNamePh: "np. Karolina Nowak",
    formCompany: "Firma / Butik",
    formCompanyPh: "np. Butik Milano",
    formPhone: "Telefon / WhatsApp *",
    formPhonePh: "+48 500 000 000",
    formEmail: "Adres E-mail *",
    formEmailPh: "zakupy@twojbutik.pl",
    formCountry: "Kraj / Miasto",
    formCountryPh: "np. Polska / Warszawa",
    formMessage: "Treść zapytania / Kategorie produktów *",
    formMessagePh: "Podaj interesujące Cię modele, ilości pakietów lub termin wizyty...",
    formSubmit: "Wyślij Zapytanie",
    formSending: "Wysyłanie...",
    formSuccessTitle: "Zapytanie Wysłane!",
    formSuccess: "Twoja wiadomość została dostarczona! Skontaktujemy się z Tobą wkrótce.",
    formSendAnother: "Wyślij kolejną wiadomość",
    mapTitle: "Lokalizacja Showroomu Merter Vitrini",
    mapCityBadge: "Stambuł / Turcja",
    transitTitle: "Dojazd i Lokalizacja:",
    transitDesc:
      "Nasz showroom znajduje się w centrum targów tekstylnych Merter, w pobliżu stacji metra M1A Merter oraz tramwaju T1.",
    liveMapLink: "Otwórz lokalizację na żywo",
    cmsSectionTitle: "O Showroomie i Zakupach Hurtowych",
    waHello:
      "Dzień dobry, proszę o informacje oraz ofertę hurtową kolekcji Merter Vitrini B2B.",
    waFormHeader: "*Zapytanie Kontaktowe B2B*",
    emailSubject: "Zapytanie hurtowe B2B",
  },
  bg: {
    heroBadge: "B2B Шоурум на Едро и Център за Обслужване",
    heroTitle: "Свържете се с Нас",
    heroSubtitle:
      "Директна връзка с водещите производители на облекло в Мертер, Истанбул. Екипът ни е на разположение 24/7 за поръчки на едро и посещения в шоурума.",
    breadcrumbHome: "Начало",
    breadcrumbContact: "Контакти и Шоурум",
    addressTitle: "Шоурум и Централен Офис",
    addressDesc: "Посетете нашия шоурум в сърцето на текстилния център Мертер в Истанбул.",
    phoneTitle: "Обслужване на Клиенти",
    phoneDesc: "Свържете се директно с нашите търговски консултанти.",
    whatsappTitle: "24/7 WhatsApp Линия",
    whatsappDesc: "Бързи оферти, видео оглед на моделите и експресни поръчки.",
    onlineBadge: "Онлайн",
    emailTitle: "Корпоративен Имейл",
    emailDesc: "За експортни запитвания, фактури и дългосрочно партньорство.",
    hoursTitle: "Работно Време",
    hoursWeekday: "Понеделник - Петък: 09:00 - 18:30",
    hoursSaturday: "Събота: 09:00 - 14:00",
    hoursSunday: "Неделя: С предварителна уговорка / WhatsApp активен",
    officialNetworkBadge: "Официална Мрежа от Износители и Текстилни Фабрики в Мертер",
    copyBtn: "Копирай",
    copiedBtn: "Копирано!",
    showOnMap: "Покажи на картата",
    directionsBtn: "Упътване (Google Maps)",
    chatWhatsappBtn: "Пишете в WhatsApp",
    callBtn: "Обадете се Сега",
    sendEmailBtn: "Изпрати Имейл",
    formTitle: "Бърза Форма за Запитване на Едро",
    formSubtitle: "Попълнете формата и нашият представител ще се свърже с вас до 15 минути.",
    formFullName: "Име и Фамилия *",
    formFullNamePh: "напр. Мария Иванова",
    formCompany: "Фирма / Бутик",
    formCompanyPh: "напр. Бутик Елеганс",
    formPhone: "Телефон / WhatsApp *",
    formPhonePh: "+359 88 000 0000",
    formEmail: "Имейл Адрес *",
    formEmailPh: "orders@boutique.bg",
    formCountry: "Държава / Град",
    formCountryPh: "напр. България / София",
    formMessage: "Вашето Запитване / Категории *",
    formMessagePh: "Посочете желаните модели, брой серии или дата за посещение в шоурума...",
    formSubmit: "Изпрати Запитването",
    formSending: "Изпращане...",
    formSuccessTitle: "Запитването е Получено!",
    formSuccess: "Съобщението ви е изпратено успешно! Ще се свържем с вас възможно най-скоро.",
    formSendAnother: "Изпрати ново съобщение",
    mapTitle: "Локация на Шоурума Merter Vitrini",
    mapCityBadge: "Истанбул / Турция",
    transitTitle: "Транспорт и Локация:",
    transitDesc:
      "Шоурумът ни се намира в центъра на текстилния квартал Мертер, на пешеходно разстояние от метростанция M1A Merter и трамвай T1.",
    liveMapLink: "Отвори локацията",
    cmsSectionTitle: "За Шоурума и Търговията на Едро",
    waHello:
      "Здравейте, бих искал информация и ценова оферта на едро от Merter Vitrini B2B.",
    waFormHeader: "*B2B Контактно Запитване*",
    emailSubject: "B2B Запитване за поръчка на едро",
  },
};

export default function ContactClient({
  categoryPrefix,
  categories,
  activeLangs,
  settings,
  cmsPage,
}: Readonly<ContactClientProps>) {
  const router = useRouter();

  const matchedLang = activeLangs.find((l) => l.categoryPrefix === categoryPrefix);
  const currentLang = normalizeSeoLang(matchedLang?.code || categoryPrefix, "tr");
  const texts = UI_TEXTS[currentLang];

  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState<boolean>(false);
  const [policyModalType, setPolicyModalType] = useState<
    "cancellation_and_return" | "terms_of_service" | "privacy_policy" | ""
  >("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isLangOpen, setIsLangOpen] = useState<boolean>(false);

  const [formData, setFormData] = useState({
    fullName: "",
    company: "",
    phone: "",
    email: "",
    country: "",
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

  const handleCopy = (text: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleLangChange = (newLang: string) => {
    const matchLang = activeLangs.find((l) => l.code === newLang);
    const targetPrefix = matchLang?.categoryPrefix || newLang;
    router.push(`/${targetPrefix}/contact`);
  };

  const sanitizedWhatsapp = (settings.whatsapp || "+90 533 703 08 83").replace(/\D/g, "");
  const whatsappUrl = `https://wa.me/${sanitizedWhatsapp}?text=${encodeURIComponent(texts.waHello)}`;
  const phoneTelUrl = `tel:${(settings.phone || "+90 533 703 08 83").replace(/\s/g, "")}`;
  const effectiveAddress = sanitizePublicStoreAddress(settings.address);
  const emailAddress = sanitizePublicStoreEmail(settings.email);
  const emailMailtoUrl = `mailto:${emailAddress}?subject=${encodeURIComponent(texts.emailSubject)}`;
  const mapDirectionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(effectiveAddress)}`;

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    setIsSubmitting(false);
    setIsSubmitted(true);

    const waText =
      `${texts.waFormHeader}\n\n` +
      `👤 ${formData.fullName}\n` +
      `🏢 ${formData.company || "-"}\n` +
      `📱 ${formData.phone}\n` +
      `✉️ ${formData.email}\n` +
      `🌍 ${formData.country || "-"}\n\n` +
      `💬 ${formData.message}`;

    trackWhatsappClick({
      sourceSurface: "contact_form",
      targetPhone: settings.whatsapp || "+90 533 703 08 83",
    });

    window.open(
      `https://wa.me/${sanitizedWhatsapp}?text=${encodeURIComponent(waText)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const rawCmsTranslation =
    cmsPage?.translations?.[currentLang] ||
    cmsPage?.translations?.en ||
    cmsPage?.translations?.tr;
  const sanitizedCmsHtml = rawCmsTranslation?.content || "";

  const jsonLdData = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: texts.heroTitle,
    description: texts.heroSubtitle,
    inLanguage: currentLang,
    url: `${SITE_ORIGIN}/${currentLang}/contact`,
    mainEntity: {
      "@type": "Organization",
      name: "Merter Vitrini B2B",
      url: SITE_ORIGIN,
      logo: `${SITE_ORIGIN}/og-image.jpg`,
      address: {
        "@type": "PostalAddress",
        streetAddress: effectiveAddress,
        addressLocality: resolveAddressLocality(effectiveAddress),
        addressRegion: "İstanbul",
        addressCountry: "TR",
      },
      telephone: settings.phone,
      email: emailAddress,
    },
  };

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
          <span className="text-[#1C1C1C] font-semibold">{texts.breadcrumbContact}</span>
        </div>
      </div>

      <main className="flex-1 w-full max-w-[1440px] mx-auto px-6 md:px-12 py-10 flex flex-col gap-10">
        <section className="relative overflow-hidden rounded-lg bg-[#F8F6F2] text-[#1C1C1C] p-8 md:p-12 border border-[#E5E0D8] shadow-xs">
          <div className="relative z-10 max-w-3xl flex flex-col gap-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#E5E0D8] text-[#6E542E] text-xs font-bold w-fit tracking-wide uppercase">
              <Sparkles size={14} className="text-[#8C6D3F]" />
              {texts.heroBadge}
            </div>

            <h1 className="text-3xl md:text-5xl font-black tracking-tight text-[#1C1C1C] leading-tight">
              {texts.heroTitle}
            </h1>

            <p className="text-sm md:text-base text-[#525252] leading-relaxed font-normal">
              {texts.heroSubtitle}
            </p>

            <div className="flex flex-wrap gap-3 pt-3">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  trackWhatsappClick({
                    sourceSurface: "contact_page",
                    targetPhone: settings.whatsapp || "+90 533 703 08 83",
                  })
                }
                className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-[#15803D] hover:bg-[#166534] text-white text-xs font-bold shadow-xs transition-colors"
              >
                <MessageSquare size={16} />
                {texts.chatWhatsappBtn}
              </a>
              <a
                href={phoneTelUrl}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-[#1C1C1C] hover:bg-[#333333] text-white text-xs font-bold transition-colors"
              >
                <Phone size={16} />
                {texts.callBtn}
              </a>
              <a
                href={mapDirectionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-white hover:bg-[#EFECE6] text-[#1C1C1C] text-xs font-bold border border-[#D6D1C7] hover:border-[#1C1C1C] transition-colors"
              >
                <MapPin size={16} />
                {texts.directionsBtn}
              </a>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg p-6 border border-[#E5E0D8] shadow-xs flex flex-col justify-between gap-4 hover:shadow-md hover:border-[#1C1C1C]/40 transition-all group">
            <div className="flex flex-col gap-3">
              <div className="w-12 h-12 rounded-md bg-[#F8F6F2] text-[#1C1C1C] border border-[#E5E0D8] flex items-center justify-center font-bold group-hover:bg-[#1C1C1C] group-hover:text-white transition-colors">
                <Building2 size={22} />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#1C1C1C]">{texts.addressTitle}</h2>
                <p className="text-xs text-zinc-500 mt-0.5">{texts.addressDesc}</p>
              </div>
              <p className="text-xs font-medium text-[#1C1C1C] leading-relaxed bg-[#F8F6F2] p-3 rounded-md border border-[#E5E0D8] select-all">
                {effectiveAddress}
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => handleCopy(effectiveAddress, "address")}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-xs font-semibold text-[#1C1C1C] bg-white border border-[#D6D1C7] hover:border-[#1C1C1C] hover:bg-[#F8F6F2] transition-colors cursor-pointer"
              >
                {copiedKey === "address" ? (
                  <Check size={14} className="text-[#15803D]" />
                ) : (
                  <Copy size={14} />
                )}
                {copiedKey === "address" ? texts.copiedBtn : texts.copyBtn}
              </button>
              <a
                href={mapDirectionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-md text-zinc-500 hover:text-[#1C1C1C] hover:bg-[#F8F6F2] border border-transparent hover:border-[#D6D1C7] transition-colors"
                title={texts.showOnMap}
                aria-label={texts.showOnMap}
              >
                <ExternalLink size={16} />
              </a>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 border border-[#E5E0D8] shadow-xs flex flex-col justify-between gap-4 hover:shadow-md hover:border-[#15803D]/50 transition-all group">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-md bg-emerald-50 text-[#15803D] border border-emerald-200 flex items-center justify-center font-bold group-hover:bg-[#15803D] group-hover:text-white transition-colors">
                  <MessageSquare size={22} />
                </div>
                <span className="flex items-center gap-1 text-[11px] font-bold text-[#15803D] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-[#15803D] animate-pulse" />
                  <span>{texts.onlineBadge}</span>
                </span>
              </div>
              <div>
                <h2 className="text-base font-bold text-[#1C1C1C]">{texts.whatsappTitle}</h2>
                <p className="text-xs text-zinc-500 mt-0.5">{texts.whatsappDesc}</p>
              </div>
              <p className="text-sm font-bold text-[#15803D] bg-emerald-50/60 p-3 rounded-md border border-emerald-200 tracking-wide font-mono select-all">
                {settings.whatsapp}
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-zinc-100">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  trackWhatsappClick({
                    sourceSurface: "contact_page",
                    targetPhone: settings.whatsapp || "+90 533 703 08 83",
                  })
                }
                className="w-full inline-flex items-center justify-center gap-2 py-2 px-4 rounded-md text-xs font-bold text-white bg-[#15803D] hover:bg-[#166534] shadow-xs transition-colors"
              >
                <MessageSquare size={14} />
                {texts.chatWhatsappBtn}
              </a>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 border border-[#E5E0D8] shadow-xs flex flex-col justify-between gap-4 hover:shadow-md hover:border-[#1C1C1C]/40 transition-all group">
            <div className="flex flex-col gap-3">
              <div className="w-12 h-12 rounded-md bg-[#F8F6F2] text-[#1C1C1C] border border-[#E5E0D8] flex items-center justify-center font-bold group-hover:bg-[#1C1C1C] group-hover:text-white transition-colors">
                <Phone size={22} />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#1C1C1C]">{texts.phoneTitle}</h2>
                <p className="text-xs text-zinc-500 mt-0.5">{texts.phoneDesc}</p>
              </div>
              <p className="text-sm font-bold text-[#1C1C1C] bg-[#F8F6F2] p-3 rounded-md border border-[#E5E0D8] tracking-wide font-mono select-all">
                {settings.phone}
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-zinc-100">
              <a
                href={phoneTelUrl}
                className="w-full inline-flex items-center justify-center gap-2 py-2 px-4 rounded-md text-xs font-bold text-white bg-[#1C1C1C] hover:bg-[#333333] shadow-xs transition-colors"
              >
                <Phone size={14} />
                {texts.callBtn}
              </a>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 border border-[#E5E0D8] shadow-xs flex flex-col justify-between gap-4 hover:shadow-md hover:border-[#1C1C1C]/40 transition-all group">
            <div className="flex flex-col gap-3">
              <div className="w-12 h-12 rounded-md bg-[#F8F6F2] text-[#1C1C1C] border border-[#E5E0D8] flex items-center justify-center font-bold group-hover:bg-[#1C1C1C] group-hover:text-white transition-colors">
                <Mail size={22} />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#1C1C1C]">{texts.emailTitle}</h2>
                <p className="text-xs text-zinc-500 mt-0.5">{texts.emailDesc}</p>
              </div>
              <p className="text-xs font-bold text-[#1C1C1C] bg-[#F8F6F2] p-3 rounded-md border border-[#E5E0D8] font-mono break-all select-all">
                {emailAddress}
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-zinc-100">
              <a
                href={emailMailtoUrl}
                className="w-full inline-flex items-center justify-center gap-2 py-2 px-4 rounded-md text-xs font-bold text-[#1C1C1C] bg-white border border-[#D6D1C7] hover:border-[#1C1C1C] hover:bg-[#F8F6F2] transition-colors"
              >
                <Mail size={14} />
                {texts.sendEmailBtn}
              </a>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-lg p-6 border border-[#E5E0D8] shadow-xs flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-md bg-[#F8F6F2] border border-[#E5E0D8] text-[#8C6D3F] flex items-center justify-center shrink-0">
              <Clock size={22} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#1C1C1C]">{texts.hoursTitle}</h3>
              <div className="text-xs text-[#525252] flex flex-wrap gap-x-4 gap-y-1 mt-1 font-medium">
                <span>{texts.hoursWeekday}</span>
                <span className="text-zinc-300 hidden md:inline">•</span>
                <span>{texts.hoursSaturday}</span>
                <span className="text-zinc-300 hidden md:inline">•</span>
                <span className="text-[#6E542E] font-semibold">{texts.hoursSunday}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-[#525252] shrink-0">
            <ShieldCheck size={18} className="text-[#15803D] shrink-0" />
            <span>{texts.officialNetworkBadge}</span>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 bg-white rounded-lg p-8 border border-[#E5E0D8] shadow-xs flex flex-col gap-6">
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

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-zinc-600 uppercase tracking-wider">
                    {texts.formCountry}
                  </label>
                  <input
                    type="text"
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

          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="bg-white rounded-lg p-6 border border-[#E5E0D8] shadow-xs flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-[#1C1C1C] flex items-center gap-2">
                  <MapPin size={18} className="text-[#8C6D3F]" />
                  {texts.mapTitle}
                </h2>
                <span className="text-[11px] font-semibold text-zinc-500">
                  {texts.mapCityBadge}
                </span>
              </div>

              <div className="w-full h-80 rounded-lg overflow-hidden border border-[#E5E0D8] relative bg-zinc-100">
                <iframe
                  title={texts.mapTitle}
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(effectiveAddress)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="w-full h-full"
                />
              </div>

              <div className="p-4 bg-[#F8F6F2] rounded-md border border-[#E5E0D8] flex flex-col gap-2 text-xs text-[#525252]">
                <div className="font-bold text-[#1C1C1C] flex items-center gap-1.5">
                  <Building2 size={14} className="text-[#8C6D3F]" />
                  {texts.transitTitle}
                </div>
                <p className="leading-relaxed">{texts.transitDesc}</p>
                <a
                  href={mapDirectionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-[#1C1C1C] hover:text-[#6E542E] font-bold transition-colors"
                >
                  {texts.liveMapLink} <ArrowRight size={12} className="rtl:rotate-180" />
                </a>
              </div>
            </div>
          </div>
        </section>

        {sanitizedCmsHtml && (
          <section className="bg-white rounded-lg p-8 md:p-10 border border-[#E5E0D8] shadow-xs flex flex-col gap-6">
            <div className="border-b border-zinc-100 pb-4">
              <h2 className="text-2xl font-bold text-[#1C1C1C]">
                {rawCmsTranslation?.title || texts.cmsSectionTitle}
              </h2>
            </div>
            <div className="prose prose-zinc max-w-none text-sm text-[#525252] leading-relaxed">
              <SafeHtml html={sanitizedCmsHtml} />
            </div>
          </section>
        )}
      </main>

      <Footer
        lang={currentLang}
        initialSettings={settings}
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
