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
  Box,
} from "lucide-react";
import Header from "@/components/store/Header";
import Footer from "@/components/store/Footer";
import PolicyViewerModal from "@/components/store/PolicyViewerModal";
import { CartItem, Category } from "@/types/store";
import { SupportedSeoLang, normalizeSeoLang, safeJsonLd } from "@/utils/seoHelpers";
import { sanitizePublicStoreEmail } from "@/utils/formatters";

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

interface FAQItem {
  id: string;
  category: "order" | "payment" | "shipping" | "quality";
  q: string;
  a: string;
}

const FAQ_ITEMS: Record<SupportedSeoLang, FAQItem[]> = {
  tr: [
    {
      id: "tr-1",
      category: "order",
      q: "Minimum toptan sipariş miktarı (MOQ) nedir? Tek parça alabilir miyim?",
      a: "Merter Vitrini yalnızca B2B toptan alıcılara hizmet vermektedir. Ürünlerimiz perakende değil, üretici beden kırılımlı asorti seri paketleri (örneğin 3'lü, 4'lü veya 6'lı seriler: S, M, L / 2-2-2) halinde satılmaktadır. Bir modelden minimum 1 seri paket satın alabilirsiniz.",
    },
    {
      id: "tr-2",
      category: "order",
      q: "Seri (asorti) paketi içeriği nasıl belirlenir?",
      a: "Seri paketleri doğrudan doğrulanmış Merter üreticilerinin standart beden dağılımında hazırlanır. Ürün sayfasındaki seri oranı (örneğin 2-2-2) her bedenden pakette kaç adet bulunduğunu gösterir.",
    },
    {
      id: "tr-3",
      category: "order",
      q: "Sitedeki toptan fiyatlara KDV ve kargo dahil midir?",
      a: "Görüntülenen toptan fiyatlar fabrika çıkış fiyatları olup KDV ve nakliye ücretleri hariçtir. Resmi ihracat alımlarında KDV muafiyetli fatura düzenlenir.",
    },
    {
      id: "tr-4",
      category: "payment",
      q: "Hangi ödeme yöntemlerini kabul ediyorsunuz?",
      a: "Banka Havalesi / EFT (USD, EUR, TRY kurumsal hesaplara), Uluslararası SWIFT Transferi ve 3D Secure Kredi Kartı ile güvenli ödeme kabul edilmektedir.",
    },
    {
      id: "tr-5",
      category: "shipping",
      q: "Yurt dışına kargo gönderimi nasıl yapılıyor?",
      a: "Anlaşmalı uluslararası hava ve kara kargo acenteleriyle 120+ ülkeye kapıdan kapıya sigortalı sevkiyat yapılmaktadır. Alternatif olarak İstanbul Merter, Laleli veya Osmanbey'deki kendi kargo acentenize ücretsiz teslimat sağlanır.",
    },
    {
      id: "tr-6",
      category: "quality",
      q: "Kendi markam için özel etiketleme (Private Label) yaptırabilir miyim?",
      a: "Evet. Belirli seri/koli hacimlerini karşılayan B2B alıcılar için kendi marka etiketlerinizle dikim, ambalajlama ve barkodlama hizmeti sunulmaktadır.",
    },
  ],
  en: [
    {
      id: "en-1",
      category: "order",
      q: "What is the Minimum Order Quantity (MOQ)? Can I buy single pieces?",
      a: "Merter Vitrini is strictly a B2B wholesale platform. Apparel is sold in manufacturer assorted size-run packs (e.g., 4-pack or 6-pack: S, M, L / 2-2-2). Minimum order starts at just 1 pack per style.",
    },
    {
      id: "en-2",
      category: "order",
      q: "How does size-run (series) pack pricing work?",
      a: "Each pack contains all sizes of a single colorway in balanced retail ratios set by the Merter factory. Your cart automatically calculates total pieces, pack count, weight, and net wholesale value.",
    },
    {
      id: "en-3",
      category: "payment",
      q: "Which corporate payment methods do you support?",
      a: "We accept International SWIFT/SEPA Wire Transfers (USD, EUR, TRY) and 3D Secure corporate credit cards with official commercial export invoices.",
    },
    {
      id: "en-4",
      category: "shipping",
      q: "How do international shipping and customs clearance work?",
      a: "We consolidate orders from multiple Merter factories into one shipment via air express or road cargo to 120+ countries with ATR / EUR.1 certificates, or deliver free of charge to your Istanbul cargo forwarder.",
    },
    {
      id: "en-5",
      category: "quality",
      q: "Do you offer Private Label (OEM) manufacturing for boutiques?",
      a: "Yes. Verified Merter manufacturers provide custom neck labels, hangtags, barcodes, and private label production for qualifying order volumes.",
    },
  ],
  ru: [
    {
      id: "ru-1",
      category: "order",
      q: "Какой минимальный объем заказа (MOQ)? Можно ли купить поштучно?",
      a: "Merter Vitrini — исключительно оптовая B2B-платформа. Одежда продается фабричными размерными рядами (сериями: S, M, L / 2-2-2). Минимальный заказ — от 1 серии на модель.",
    },
    {
      id: "ru-2",
      category: "shipping",
      q: "Как осуществляется доставка карго в Россию, Казахстан и СНГ?",
      a: "Мы бесплатно доставляем собранный заказ до вашего карго-перевозчика в районах Мертер или Лалели в Стамбуле, а также организуем прямую авиа- и автодоставку.",
    },
    {
      id: "ru-3",
      category: "payment",
      q: "Какие способы оплаты доступны оптовым покупателям?",
      a: "Международный банковский перевод SWIFT, оплата корпоративными картами 3D Secure и расчет в USD, EUR или TRY.",
    },
    {
      id: "ru-4",
      category: "quality",
      q: "Возможен ли пошив под собственным брендом (Private Label)?",
      a: "Да, фабрики Мертера выполняют отшив коллекций под вашим брендом (СТМ) с установкой ваших бирок, составников и штрихкодов для маркетплейсов.",
    },
  ],
  ar: [
    {
      id: "ar-1",
      category: "order",
      q: "ما هو الحد الأدنى للطلب (MOQ)؟ وهل يتوفر البيع بالقطعة؟",
      a: "منصة Merter Vitrini مخصصة لتجارة الجملة B2B فقط. تُباع الموديلات بنظام الباكيدج/السيري المقاسات المتنوعة (مثل S, M, L / 2-2-2) ويبدأ الطلب من باكت واحد لكل موديل.",
    },
    {
      id: "ar-2",
      category: "shipping",
      q: "كيف يتم شحن البضائع إلى الخليج والشرق الأوسط وأوروبا؟",
      a: "نوفر شحناً جوياً وبرياً موحداً لأكثر من 120 دولة مع كامل مستندات التصدير، كما نوفر توصيلاً مجانياً إلى مكتب شركة الشحن الخاصة بكم في مارتر أو لالالي بإسطنبول.",
    },
    {
      id: "ar-3",
      category: "payment",
      q: "ما هي طرق الدفع المتاحة للتجار والشركات؟",
      a: "نقبل التحويل البنكي الدولي SWIFT بالدولار واليورو والليرة التركية بالإضافة إلى البطاقات الائتمانية الآمنة 3D Secure.",
    },
    {
      id: "ar-4",
      category: "quality",
      q: "هل تتوفر خدمة التصنيع للعلامات الخاصة (Private Label)؟",
      a: "نعم، توفر مصانع مارتر المعتمدة إمكانية التصنيع بعلامتكم التجارية الخاصة مع الليبل والتغليف المخصص للكميات التجارية.",
    },
  ],
  de: [
    {
      id: "de-1",
      category: "order",
      q: "Wie hoch ist die Mindestbestellmenge (MOQ)? Ist Einzelkauf möglich?",
      a: "Merter Vitrini ist ein reines B2B-Großhandelsportal. Alle Artikel werden in größenassortierten Serienpaketen (Packs, z. B. S, M, L / 2-2-2) verkauft. Die Mindestbestellmenge beträgt 1 Serienpaket pro Modell.",
    },
    {
      id: "de-2",
      category: "shipping",
      q: "Wie erfolgen Versand und Verzollung nach Deutschland, Österreich und in die EU?",
      a: "Ihre Bestellungen mehrerer Hersteller werden konsolidiert per Express-Luftfracht oder LKW inklusive ATR-Präferenzdokument (zollfrei in die EU) versendet oder kostenlos an Ihre Spedition in Istanbul übergeben.",
    },
    {
      id: "de-3",
      category: "payment",
      q: "Welche B2B-Zahlungsmethoden werden akzeptiert?",
      a: "SEPA/SWIFT-Firmenüberweisung in EUR oder USD sowie 3D-Secure-Kreditkartenzahlung inklusive offizieller Netto-Exportrechnung.",
    },
    {
      id: "de-4",
      category: "quality",
      q: "Bieten Sie Private-Label-Produktion für eigene Modemarken an?",
      a: "Ja, unsere geprüften Fabriken in Merter fertigen ab definierten Stückzahlen mit Ihren eigenen Webetiketten, Hangtags und EAN-Codes.",
    },
  ],
  fr: [
    {
      id: "fr-1",
      category: "order",
      q: "Quel est le minimum de commande (MOQ) ? Vendez-vous à l'unité ?",
      a: "Merter Vitrini est exclusivement réservé aux professionnels B2B. Les articles sont vendus par lots/séries de tailles assorties (ex. S, M, L / 2-2-2), à partir d'une seule série par référence.",
    },
    {
      id: "fr-2",
      category: "shipping",
      q: "Comment fonctionne l'expédition internationale vers la France, l'Europe et le Maghreb ?",
      a: "Nous regroupons vos achats multi-fabricants en un seul envoi express aérien ou routier avec certificat douanier ATR/EUR.1, ou livrons gratuitement votre transitaire à Istanbul.",
    },
    {
      id: "fr-3",
      category: "payment",
      q: "Quels moyens de paiement professionnels acceptez-vous ?",
      a: "Virement bancaire international SWIFT/SEPA en EUR ou USD et paiement par carte bancaire sécurisée 3D Secure avec facture export HT.",
    },
    {
      id: "fr-4",
      category: "quality",
      q: "Proposez-vous la fabrication en marque blanche (Private Label) ?",
      a: "Oui, nos ateliers certifiés de Merter réalisent l'étiquetage personnalisé, le façonnage et le conditionnement à votre marque.",
    },
  ],
  pl: [
    {
      id: "pl-1",
      category: "order",
      q: "Jakie jest minimalne zamówienie (MOQ)? Czy możliwy jest zakup pojedynczych sztuk?",
      a: "Merter Vitrini to platforma wyłącznie hurtowa B2B. Odzież sprzedawana jest w fabrycznych pakietach rozmiarowych (seriach, np. S, M, L / 2-2-2). Minimalne zamówienie wynosi 1 pakiet z modelu.",
    },
    {
      id: "pl-2",
      category: "shipping",
      q: "Jak wygląda wysyłka ze Stambułu do Polski oraz odprawa celna?",
      a: "Łączymy zamówienia od różnych producentów w jedną przesyłkę kurierską lub drobnicową ze świadectwem ATR (0% cła w UE) albo dostarczamy towar bezpłatnie do Twojego cargo w Merter/Laleli.",
    },
    {
      id: "pl-3",
      category: "payment",
      q: "Jakie metody płatności są dostępne dla firm?",
      a: "Przelew walutowy SWIFT/SEPA (EUR, USD) oraz bezpieczne płatności kartą 3D Secure z oficjalną fakturą eksportową.",
    },
    {
      id: "pl-4",
      category: "quality",
      q: "Czy oferujecie produkcję Private Label pod własną marką butiku?",
      a: "Tak, zweryfikowane szwalnie w Merter realizują szycie z własnymi metkami, wszywkami i kodami EAN.",
    },
  ],
  bg: [
    {
      id: "bg-1",
      category: "order",
      q: "Какво е минималното количество за поръчка (MOQ)? Продавате ли на бройка?",
      a: "Merter Vitrini обслужва само B2B търговци на едро. Моделите се продават в асортови размерни серии/пакети (напр. S, M, L / 2-2-2), като минимумът е 1 серия от модел.",
    },
    {
      id: "bg-2",
      category: "shipping",
      q: "Как се извършва доставката от Истанбул до България?",
      a: "Изпращаме консолидирани пратки със сухопътен и експресен карго транспорт за 1-3 работни дни с ATR сертификат или предаваме безплатно на вашата карго фирма в Мертер или Лалели.",
    },
    {
      id: "bg-3",
      category: "payment",
      q: "Какви методи на плащане приемате?",
      a: "Банков превод SWIFT/SEPA в EUR, USD или TRY и сигурно картово плащане с 3D Secure и експортна фактура.",
    },
    {
      id: "bg-4",
      category: "quality",
      q: "Предлагате ли производство на ишлеме и Private Label?",
      a: "Да, сертифицираните фабрики в Мертер предлагат производство със собствени етикети, брандиране и опаковка.",
    },
  ],
};

interface FAQUITexts {
  readonly heroBadge: string;
  readonly heroTitle: string;
  readonly heroSubtitle: string;
  readonly breadcrumbHome: string;
  readonly breadcrumbFAQ: string;
  readonly searchPlaceholder: string;
  readonly tabAll: string;
  readonly tabOrder: string;
  readonly tabPayment: string;
  readonly tabShipping: string;
  readonly tabQuality: string;
  readonly noResults: string;
  readonly supportBadge: string;
  readonly helpTitle: string;
  readonly helpSubtitle: string;
  readonly chatWhatsappBtn: string;
  readonly callBtn: string;
  readonly emailBtn: string;
  readonly cmsSectionTitle: string;
  readonly waHello: string;
  readonly emailSubject: string;
}

const UI_TEXTS: Record<SupportedSeoLang, FAQUITexts> = {
  tr: {
    heroBadge: "B2B Toptan Yardım & Rehber Merkezi",
    heroTitle: "Sıkça Sorulan Sorular (SSS)",
    heroSubtitle:
      "Merter tekstil piyasasında toptan hazır giyim alımları, asorti seri düzeni, minimum sipariş miktarı (MOQ), yurt dışı kargo ve ödeme süreçleri hakkında merak edilen tüm yanıtlar.",
    breadcrumbHome: "Ana Sayfa",
    breadcrumbFAQ: "Sıkça Sorulan Sorular",
    searchPlaceholder:
      "Soru veya anahtar kelime arayın (Örn: kargo, ödeme, seri, minimum sipariş)...",
    tabAll: "Tüm Sorular",
    tabOrder: "Sipariş & Seri",
    tabPayment: "Ödeme & Fatura",
    tabShipping: "Kargo & Lojistik",
    tabQuality: "Kalite & Üretim",
    noResults:
      "Aradığınız kriterlere uygun soru bulunamadı. Farklı bir kelime deneyin veya WhatsApp hattımıza yazın.",
    supportBadge: "7/24 B2B Toptan Destek",
    helpTitle: "Sorunuza Yanıt Bulamadınız mı?",
    helpSubtitle:
      "7/24 B2B ihracat uzmanlarımız tüm toptan alım sorularınızı canlı yanıtlamaya hazırdır.",
    chatWhatsappBtn: "WhatsApp'tan Canlı Sorun",
    callBtn: "Müşteri Hizmetlerini Arayın",
    emailBtn: "E-Posta Gönderin",
    cmsSectionTitle: "Toptan Satış Rehberi ve Önemli Notlar",
    waHello:
      "Merhaba, Merter Vitrini toptan alım süreci hakkında soru sormak istiyorum.",
    emailSubject: "B2B Toptan SSS ve Danışma",
  },
  en: {
    heroBadge: "B2B Wholesale Support & FAQ Hub",
    heroTitle: "Frequently Asked Questions",
    heroSubtitle:
      "Everything you need to know about wholesale garment sourcing from Istanbul Merter: size-run packs, MOQ, consolidated international cargo, and corporate payment.",
    breadcrumbHome: "Home",
    breadcrumbFAQ: "FAQ",
    searchPlaceholder: "Search question or keyword (e.g. shipping, payment, MOQ, pack)...",
    tabAll: "All Questions",
    tabOrder: "Ordering & Packs",
    tabPayment: "Payment & Invoicing",
    tabShipping: "Freight & Customs",
    tabQuality: "Quality & OEM",
    noResults:
      "No matching questions found. Try another keyword or message our WhatsApp export desk.",
    supportBadge: "24/7 B2B Export Support",
    helpTitle: "Still Have Questions?",
    helpSubtitle:
      "Our multilingual B2B export specialists are ready to assist you in real time.",
    chatWhatsappBtn: "Chat on WhatsApp",
    callBtn: "Call Support",
    emailBtn: "Send Email",
    cmsSectionTitle: "Wholesale Buying Guide & Notes",
    waHello:
      "Hello, I have a question regarding Merter Vitrini B2B wholesale ordering.",
    emailSubject: "B2B Wholesale FAQ Inquiry",
  },
  ru: {
    heroBadge: "B2B Центр Поддержки и Вопросов",
    heroTitle: "Часто Задаваемые Вопросы",
    heroSubtitle:
      "Вся информация об оптовых закупках турецкой одежды в Мертере: размерные ряды, минимальный заказ, доставка карго в РФ и СНГ и оплата.",
    breadcrumbHome: "Главная",
    breadcrumbFAQ: "FAQ",
    searchPlaceholder: "Поиск по вопросам (например: карго, оплата, серии, MOQ)...",
    tabAll: "Все Вопросы",
    tabOrder: "Заказ и Серии",
    tabPayment: "Оплата",
    tabShipping: "Доставка Карго",
    tabQuality: "Качество и СТМ",
    noResults:
      "По вашему запросу ничего не найдено. Напишите нам напрямую в WhatsApp.",
    supportBadge: "Поддержка B2B 24/7",
    helpTitle: "Остались Вопросы?",
    helpSubtitle:
      "Наши русскоязычные менеджеры готовы проконсультировать вас прямо сейчас.",
    chatWhatsappBtn: "Написать в WhatsApp",
    callBtn: "Позвонить",
    emailBtn: "Написать на E-mail",
    cmsSectionTitle: "Руководство по Оптовым Закупкам",
    waHello: "Здравствуйте! У меня вопрос по условиям оптового заказа на Merter Vitrini.",
    emailSubject: "Вопрос по оптовым закупкам B2B",
  },
  ar: {
    heroBadge: "مركز الدعم والأسئلة الشائعة B2B",
    heroTitle: "الأسئلة الشائعة",
    heroSubtitle:
      "كل ما تحتاج لمعرفته حول استيراد الملابس بالجملة من مارتر إسطنبول: حزم الباكيدج، الحد الأدنى للطلب، الشحن الدولي وطرق الدفع.",
    breadcrumbHome: "الرئيسية",
    breadcrumbFAQ: "الأسئلة الشائعة",
    searchPlaceholder: "ابحث عن سؤال أو كلمة مفتاحية (شحن، دفع، سيري، كميات)...",
    tabAll: "جميع الأسئلة",
    tabOrder: "الطلب والباكيدج",
    tabPayment: "الدفع والفواتير",
    tabShipping: "الشحن الدولي",
    tabQuality: "الجودة والتصنيع",
    noResults: "لم يتم العثور على نتائج مطابقة. تواصل معنا عبر واتساب للمساعدة الفورية.",
    supportBadge: "دعم تجار الجملة 24/7",
    helpTitle: "هل لديك استفسار آخر؟",
    helpSubtitle: "فريق التصدير جاهز للإجابة على جميع استفساراتكم باللغة العربية فوراً.",
    chatWhatsappBtn: "تواصل عبر واتساب",
    callBtn: "اتصل بنا",
    emailBtn: "إرسال بريد إلكتروني",
    cmsSectionTitle: "دليل تجارة الجملة وملاحظات هامة",
    waHello: "مرحباً، لدي استفسار بخصوص الشراء بالجملة من منصة Merter Vitrini.",
    emailSubject: "استفسار الأسئلة الشائعة B2B",
  },
  de: {
    heroBadge: "B2B-Hilfezentrum & Großhandels-FAQ",
    heroTitle: "Häufig Gestellte Fragen (FAQ)",
    heroSubtitle:
      "Antworten rund um den Mode-Großhandel aus Istanbul Merter: Serienpakete, Mindestbestellmenge (MOQ), zollfreier EU-Versand mit ATR und Zahlungsarten.",
    breadcrumbHome: "Startseite",
    breadcrumbFAQ: "FAQ",
    searchPlaceholder: "Frage oder Stichwort suchen (z. B. Versand, ATR, Zahlung, Serien)...",
    tabAll: "Alle Fragen",
    tabOrder: "Bestellung & Serien",
    tabPayment: "Zahlung & Rechnung",
    tabShipping: "Versand & Zoll",
    tabQuality: "Qualität & OEM",
    noResults:
      "Keine passenden Antworten gefunden. Schreiben Sie uns gerne direkt per WhatsApp.",
    supportBadge: "24/7 B2B-Kundenbetreuung",
    helpTitle: "Noch Fragen offen?",
    helpSubtitle: "Unser Export-Team beantwortet Ihre Fragen rund um die Uhr persönlich.",
    chatWhatsappBtn: "Per WhatsApp fragen",
    callBtn: "Support anrufen",
    emailBtn: "E-Mail senden",
    cmsSectionTitle: "Einkaufsleitfaden für Großhändler",
    waHello: "Hallo, ich habe eine Frage zum B2B-Großhandelseinkauf bei Merter Vitrini.",
    emailSubject: "B2B-Großhandel FAQ-Anfrage",
  },
  fr: {
    heroBadge: "Centre d'Aide & FAQ Grossiste B2B",
    heroTitle: "Foire Aux Questions (FAQ)",
    heroSubtitle:
      "Toutes les réponses sur l'approvisionnement en gros depuis Merter Istanbul : lots par séries, MOQ, transport international groupé et facturation export.",
    breadcrumbHome: "Accueil",
    breadcrumbFAQ: "FAQ",
    searchPlaceholder: "Rechercher une question ou un mot-clé (livraison, paiement, série, MOQ)...",
    tabAll: "Toutes les Questions",
    tabOrder: "Commandes & Séries",
    tabPayment: "Paiement & Facture",
    tabShipping: "Transport & Douane",
    tabQuality: "Qualité & Marque Blanche",
    noResults:
      "Aucune question correspondante. Contactez directement notre service export sur WhatsApp.",
    supportBadge: "Support B2B 24/7",
    helpTitle: "Vous avez d'autres questions ?",
    helpSubtitle: "Nos conseillers export sont disponibles en direct pour vous accompagner.",
    chatWhatsappBtn: "Demander sur WhatsApp",
    callBtn: "Appeler le Support",
    emailBtn: "Envoyer un E-mail",
    cmsSectionTitle: "Guide d'Achat en Gros & Infos Pratiques",
    waHello: "Bonjour, j'ai une question concernant les commandes en gros sur Merter Vitrini.",
    emailSubject: "Question FAQ Grossiste B2B",
  },
  pl: {
    heroBadge: "Centrum Pomocy Hurtowej B2B",
    heroTitle: "Często Zadawane Pytania (FAQ)",
    heroSubtitle:
      "Najważniejsze informacje o zakupach hurtowych odzieży w Merter Stambuł: pakiety rozmiarowe, niskie MOQ, transport ze świadectwem ATR do Polski i płatności.",
    breadcrumbHome: "Strona główna",
    breadcrumbFAQ: "FAQ",
    searchPlaceholder: "Szukaj pytania lub słowa kluczowego (np. wysyłka, płatność, pakiety)...",
    tabAll: "Wszystkie Pytania",
    tabOrder: "Zamówienia i Pakiety",
    tabPayment: "Płatności i Faktury",
    tabShipping: "Transport i Cło",
    tabQuality: "Jakość i Private Label",
    noResults:
      "Nie znaleziono pasujących pytań. Napisz bezpośrednio do naszego zespołu na WhatsApp.",
    supportBadge: "Wsparcie Hurtowe B2B 24/7",
    helpTitle: "Nie znalazłeś odpowiedzi?",
    helpSubtitle: "Nasi specjaliści ds. eksportu chętnie odpowiedzą na Twoje pytania na żywo.",
    chatWhatsappBtn: "Zapytaj na WhatsApp",
    callBtn: "Zadzwoń do Nas",
    emailBtn: "Wyślij E-mail",
    cmsSectionTitle: "Przewodnik Zakupów Hurtowych",
    waHello: "Dzień dobry, mam pytanie dotyczące zakupów hurtowych w Merter Vitrini.",
    emailSubject: "Pytanie FAQ B2B",
  },
  bg: {
    heroBadge: "B2B Център за Помощ и Въпроси",
    heroTitle: "Често Задавани Въпроси (FAQ)",
    heroSubtitle:
      "Всичко за поръчките на дрехи на едро от Мертер, Истанбул: размерни серии, минимални количества, карго доставка до България и плащане.",
    breadcrumbHome: "Начало",
    breadcrumbFAQ: "Въпроси и Отговори",
    searchPlaceholder: "Търсете въпрос или ключова дума (доставка, плащане, серии, MOQ)...",
    tabAll: "Всички Въпроси",
    tabOrder: "Поръчки и Серии",
    tabPayment: "Плащане и Фактури",
    tabShipping: "Карго и Доставка",
    tabQuality: "Качество и Ишлеме",
    noResults:
      "Няма намерени резултати. Пишете ни директно в WhatsApp за бързо съдействие.",
    supportBadge: "24/7 B2B Поддръжка на Едро",
    helpTitle: "Имате ли друг въпрос?",
    helpSubtitle: "Нашите търговски консултанти са насреща за жива връзка по всяко време.",
    chatWhatsappBtn: "Пишете в WhatsApp",
    callBtn: "Обадете се",
    emailBtn: "Изпратете Имейл",
    cmsSectionTitle: "Наръчник за Пазаруване на Едро",
    waHello: "Здравейте, имам въпрос относно поръчките на едро в Merter Vitrini.",
    emailSubject: "B2B Въпрос и Консултация",
  },
};

export default function FAQClient({
  categoryPrefix,
  categories,
  activeLangs,
  settings,
}: Readonly<FAQClientProps>) {
  const router = useRouter();

  const matchedLang = activeLangs.find((l) => l.categoryPrefix === categoryPrefix);
  const currentLang = normalizeSeoLang(matchedLang?.code || categoryPrefix, "tr");
  const texts = UI_TEXTS[currentLang];
  const questionsList = FAQ_ITEMS[currentLang];

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({
    [questionsList[0]?.id || "0"]: true,
  });

  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState<boolean>(false);
  const [policyModalType, setPolicyModalType] = useState<
    "cancellation_and_return" | "terms_of_service" | "privacy_policy" | ""
  >("");
  const [isLangOpen, setIsLangOpen] = useState<boolean>(false);

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
    router.push(`/${targetPrefix}/faq`);
  };

  const toggleItem = (id: string) => {
    setOpenItems((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const filteredQuestions = useMemo(() => {
    return questionsList.filter((item) => {
      const matchesCategory =
        selectedCategory === "all" || item.category === selectedCategory;
      const qLower = item.q.toLowerCase();
      const aLower = item.a.toLowerCase();
      const sLower = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !sLower || qLower.includes(sLower) || aLower.includes(sLower);
      return matchesCategory && matchesSearch;
    });
  }, [questionsList, selectedCategory, searchQuery]);

  const sanitizedWhatsapp = (settings.whatsapp || "+90 533 703 08 83").replace(/\D/g, "");
  const whatsappUrl = `https://wa.me/${sanitizedWhatsapp}?text=${encodeURIComponent(texts.waHello)}`;
  const phoneTelUrl = `tel:${(settings.phone || "+90 533 703 08 83").replace(/\s/g, "")}`;
  const emailAddress = sanitizePublicStoreEmail(settings.email);
  const emailMailtoUrl = `mailto:${emailAddress}?subject=${encodeURIComponent(texts.emailSubject)}`;

  const jsonLdData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: currentLang,
    mainEntity: questionsList.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
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
          <span className="text-[#1C1C1C] font-semibold">{texts.breadcrumbFAQ}</span>
        </div>
      </div>

      <main className="flex-1 w-full max-w-[1440px] mx-auto px-6 md:px-12 py-10 flex flex-col gap-10">
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

            <div className="relative mt-4 max-w-2xl">
              <Search
                size={18}
                className="absolute start-4 top-1/2 -translate-y-1/2 text-zinc-400"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={texts.searchPlaceholder}
                className="w-full ps-11 pe-4 py-3.5 rounded-md bg-white border border-[#D6D1C7] text-[#1C1C1C] placeholder-zinc-400 text-sm focus:outline-none focus:border-[#1C1C1C] transition-colors"
              />
            </div>
          </div>
        </section>

        <section className="flex flex-wrap gap-2 items-center">
          <button
            type="button"
            onClick={() => setSelectedCategory("all")}
            className={`px-4 py-2 rounded-md text-xs font-bold transition-colors cursor-pointer ${
              selectedCategory === "all"
                ? "bg-[#1C1C1C] text-white border border-[#1C1C1C] shadow-xs"
                : "bg-white text-[#525252] border border-[#D6D1C7] hover:border-[#1C1C1C] hover:text-[#1C1C1C]"
            }`}
          >
            {texts.tabAll}
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory("order")}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-bold transition-colors cursor-pointer ${
              selectedCategory === "order"
                ? "bg-[#1C1C1C] text-white border border-[#1C1C1C] shadow-xs"
                : "bg-white text-[#525252] border border-[#D6D1C7] hover:border-[#1C1C1C] hover:text-[#1C1C1C]"
            }`}
          >
            <Box size={14} />
            {texts.tabOrder}
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory("payment")}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-bold transition-colors cursor-pointer ${
              selectedCategory === "payment"
                ? "bg-[#1C1C1C] text-white border border-[#1C1C1C] shadow-xs"
                : "bg-white text-[#525252] border border-[#D6D1C7] hover:border-[#1C1C1C] hover:text-[#1C1C1C]"
            }`}
          >
            <CreditCard size={14} />
            {texts.tabPayment}
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory("shipping")}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-bold transition-colors cursor-pointer ${
              selectedCategory === "shipping"
                ? "bg-[#1C1C1C] text-white border border-[#1C1C1C] shadow-xs"
                : "bg-white text-[#525252] border border-[#D6D1C7] hover:border-[#1C1C1C] hover:text-[#1C1C1C]"
            }`}
          >
            <Truck size={14} />
            {texts.tabShipping}
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory("quality")}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-bold transition-colors cursor-pointer ${
              selectedCategory === "quality"
                ? "bg-[#1C1C1C] text-white border border-[#1C1C1C] shadow-xs"
                : "bg-white text-[#525252] border border-[#D6D1C7] hover:border-[#1C1C1C] hover:text-[#1C1C1C]"
            }`}
          >
            <Tag size={14} />
            {texts.tabQuality}
          </button>
        </section>

        <section className="flex flex-col gap-4">
          {filteredQuestions.length === 0 ? (
            <div className="bg-white rounded-lg p-12 text-center border border-[#E5E0D8] shadow-xs flex flex-col items-center justify-center gap-3">
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
                  className={`bg-white rounded-lg border transition-colors overflow-hidden ${
                    isOpen
                      ? "border-[#1C1C1C] shadow-xs"
                      : "border-[#E5E0D8] shadow-2xs hover:border-[#D6D1C7]"
                  }`}
                >
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => toggleItem(item.id)}
                    className="w-full p-6 text-start flex items-center justify-between gap-4 cursor-pointer select-none"
                  >
                    <span className="text-base font-bold text-[#1C1C1C] flex items-center gap-3">
                      <span
                        className={`w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                          isOpen
                            ? "bg-[#1C1C1C] text-white"
                            : "bg-[#F8F6F2] text-[#525252] border border-[#E5E0D8]"
                        }`}
                      >
                        ?
                      </span>
                      {item.q}
                    </span>
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-transform duration-200 ${
                        isOpen
                          ? "rotate-180 bg-[#F8F6F2] text-[#1C1C1C]"
                          : "text-zinc-400 bg-zinc-50"
                      }`}
                    >
                      <ChevronDown size={18} />
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-6 pb-6 pt-0 animate-in fade-in duration-200">
                      <div className="border-t border-zinc-100 pt-4 text-xs md:text-sm text-[#525252] leading-relaxed ps-11">
                        {item.a}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </section>

        <section className="rounded-lg bg-[#F8F6F2] text-[#1C1C1C] p-8 md:p-10 shadow-xs border border-[#E5E0D8] flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col gap-1.5 text-center md:text-start">
            <div className="inline-flex items-center gap-1.5 text-[#8C6D3F] text-xs font-bold uppercase tracking-wider justify-center md:justify-start">
              <ShieldCheck size={16} className="text-[#15803D]" />
              {texts.supportBadge}
            </div>
            <h2 className="text-xl md:text-2xl font-black text-[#1C1C1C]">
              {texts.helpTitle}
            </h2>
            <p className="text-xs text-[#525252] max-w-lg leading-relaxed">
              {texts.helpSubtitle}
            </p>
          </div>

          <div className="flex flex-wrap gap-3 shrink-0">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-md bg-[#15803D] hover:bg-[#166534] text-white text-xs font-bold shadow-xs transition-colors"
            >
              <MessageSquare size={16} />
              {texts.chatWhatsappBtn}
            </a>
            <a
              href={phoneTelUrl}
              className="inline-flex items-center gap-2 px-5 py-3.5 rounded-md bg-[#1C1C1C] hover:bg-[#333333] text-white text-xs font-bold transition-colors"
            >
              <Phone size={16} />
              {texts.callBtn}
            </a>
            <a
              href={emailMailtoUrl}
              className="inline-flex items-center gap-2 px-5 py-3.5 rounded-md bg-white hover:bg-[#EFECE6] text-[#1C1C1C] text-xs font-bold border border-[#D6D1C7] hover:border-[#1C1C1C] transition-colors"
            >
              <Mail size={16} />
              {texts.emailBtn}
            </a>
          </div>
        </section>
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
