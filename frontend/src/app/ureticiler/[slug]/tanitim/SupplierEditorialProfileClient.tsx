"use client";

import React, { useEffect, useState, useSyncExternalStore } from "react";
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
import { getCategoryPrefix } from "@/app/i18n";
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
import PolicyViewerModal from "@/components/store/PolicyViewerModal";
import { SupportedSeoLang, normalizeSeoLang } from "@/utils/seoHelpers";

interface EditorialCopy {
  readonly backToDirectory: string;
  readonly tabCollection: string;
  readonly tabStory: string;
  readonly loadingText: string;
  readonly notFoundText: string;
  readonly goDirectoryBtn: string;
  readonly heroVerifiedBadge: string;
  readonly heroGuideBadge: string;
  readonly heroTitleSuffix: string;
  readonly heroSubtitleTemplate: string;
  readonly statModelsSuffix: string;
  readonly statModelsSub: string;
  readonly statSeriesTitle: string;
  readonly statSeriesSub: string;
  readonly statExportTitle: string;
  readonly statExportSub: string;
  readonly statMerterTitle: string;
  readonly statMerterSub: string;
  readonly leadBadge: string;
  readonly leadFallbackSuffix: string;
  readonly sec1TitleSuffix: string;
  readonly sec1BodySuffix: string;
  readonly cardFabricTitle: string;
  readonly cardFabricDesc: string;
  readonly cardWeeklyTitle: string;
  readonly cardWeeklyDesc: string;
  readonly cardVerifiedTitle: string;
  readonly cardVerifiedDesc: string;
  readonly sec2Title: string;
  readonly sec2IntroSuffix: string;
  readonly group1: string;
  readonly group2: string;
  readonly group3: string;
  readonly group4: string;
  readonly sec3Title: string;
  readonly sec3BodySuffix: string;
  readonly moqBoxTitle: string;
  readonly moqBoxBodyPrefix: string;
  readonly moqBoxBodySuffix: string;
  readonly exportBoxTitle: string;
  readonly exportBoxPrefix: string;
  readonly defaultExportRegions: string;
  readonly defaultAddress: string;
  readonly faqHeadingSuffix: string;
  readonly faq1QPrefix: string;
  readonly faq1A: string;
  readonly faq2Q: string;
  readonly faq2A: string;
  readonly faq3Q: string;
  readonly faq3APrefix: string;
  readonly featuredTitleSuffix: string;
  readonly featuredSub: string;
  readonly viewAllBtnPrefix: string;
  readonly viewAllBtnSuffix: string;
  readonly companyTypeDefault: string;
  readonly dtVerification: string;
  readonly ddVerified: string;
  readonly dtActiveCollection: string;
  readonly ddModelsSuffix: string;
  readonly dtSalesFormat: string;
  readonly ddAssortedLot: string;
  readonly dtMinOrder: string;
  readonly ddSeriesPack: string;
  readonly dtHub: string;
  readonly dtExport: string;
  readonly inspectShowcaseBtn: string;
  readonly startLiveChatBtn: string;
  readonly loginLiveChatBtn: string;
  readonly waOrderLineBtn: string;
  readonly waIntroPrefix: string;
  readonly waIntroBody: string;
  readonly postRfqBtn: string;
}

const EDITORIAL_COPY: Record<SupportedSeoLang, EditorialCopy> = {
  tr: {
    backToDirectory: "Tüm Doğrulanmış Merter Üreticileri Rehberine Dön",
    tabCollection: "Koleksiyon & Ürün Vitrini",
    tabStory: "Firma Hikayesi & Rehberi",
    loadingText: "Firma kurumsal tanıtım dosyası yükleniyor...",
    notFoundText: "Aradığınız üretici firma bulunamadı.",
    goDirectoryBtn: "Firma Rehberine Git",
    heroVerifiedBadge: "DOĞRULANMIŞ MERTER ÜRETİCİ DOSYASI",
    heroGuideBadge: "Kurumsal Tanıtım & Toptan Alım Rehberi",
    heroTitleSuffix: "Merter Toptan Giyim Üretim Gücü & Koleksiyon Rehberi",
    heroSubtitleTemplate:
      "üretim standartları, ürün grupları, orijinal seri (asorti) paket yapısı, ihracat bölgeleri ve doğrudan fabrika çıkış sipariş avantajları.",
    statModelsSuffix: "+ Model",
    statModelsSub: "Aktif Toptan Koleksiyon",
    statSeriesTitle: "Orijinal Seri",
    statSeriesSub: "Standart Beden Asortili Paket",
    statExportTitle: "81 İl & İhracat",
    statExportSub: "Hızlı & Sigortalı Sevkiyat",
    statMerterTitle: "Merter / İstanbul",
    statMerterSub: "%0 Komisyon Fabrika Çıkışı",
    leadBadge: "Editöryel Firma Dosyası & Toptan Alım Rehberi",
    leadFallbackSuffix:
      "İstanbul Merter tekstil piyasasının yüksek üretim standartlarını güncel hazır giyim trendleriyle buluşturan doğrulanmış bir üretici ve toptan tedarik markasıdır. Butikler, mağaza zincirleri ve e-ticaret işletmeleri için %0 komisyonla doğrudan fabrika çıkış koleksiyonları sunar.",
    sec1TitleSuffix: "Marka Profili ve Merter Üretim Gücü",
    sec1BodySuffix:
      "İstanbul Merter ekosisteminde kumaş Ar-Ge aşamasından bilgisayarlı kalıp tasarımına, dikim işçiliğinden kalite kontrol ve seri paketleme süreçlerine kadar kurumsal üretim disipliniyle faaliyet göstermektedir.",
    cardFabricTitle: "Birinci Sınıf Kumaş & Kalıp",
    cardFabricDesc:
      "Seçkin kumaş kalitesi ve standart kalıp ergonomisiyle perakende noktalarda düşük iade oranı sağlar.",
    cardWeeklyTitle: "Haftalık Yenilenen Koleksiyon",
    cardWeeklyDesc:
      "Her hafta vitrine eklenen yeni sezon kapsül serilerle butik vitrinlerini güncel tutar.",
    cardVerifiedTitle: "%100 Doğrulanmış İmalatçı",
    cardVerifiedDesc:
      "Üretim kapasitesi, ticari unvanı ve sevkiyat standartları saha ekibimizce doğrulanmıştır.",
    sec2Title: "Öne Çıkan Koleksiyon Yapısı ve Ürün Grupları",
    sec2IntroSuffix:
      "koleksiyonları, fiziksel butiklerin ve online mağazaların hızlı stok devir hızı ihtiyaçlarına göre kurgulanmıştır:",
    group1: "Elbise & Tulum Koleksiyonları: Günlük şehir şıklığı, ofis stili ve davet serileri.",
    group2: "İkili Takım & Ceket Kombinleri: Yüksek sepet ortalaması sağlayan uyumlu takımlar.",
    group3: "Üst Giyim (Bluz, Gömlek, Triko): Dört mevsim yüksek sirkülasyonlu trend modeller.",
    group4: "Alt Giyim & Dış Giyim: Pantolon, etek ve sezonluk dış giyim serileri.",
    sec3Title: "Toptan Seri (Asorti) Paketleme ve B2B Avantajları",
    sec3BodySuffix:
      "markasına ait tüm ürünler aracı komisyonu olmadan doğrudan fabrika çıkış fiyatlarıyla, standart orijinal beden serisi (paket/lot) yapısıyla sunulur.",
    moqBoxTitle: "📦 Minimum Sipariş & Paket Esnekliği",
    moqBoxBodyPrefix: "Minimum sipariş alt limiti",
    moqBoxBodySuffix:
      "seri olup farklı renk ve modellerden karma sepet oluşturabilirsiniz.",
    exportBoxTitle: "🌍 İhracat & Uluslararası Gönderim",
    exportBoxPrefix: "Başlıca ihracat pazarları:",
    defaultExportRegions: "Avrupa Birliği, Balkanlar, Rusya & BDT, Orta Doğu & Körfez",
    defaultAddress: "Merter Tekstil Merkezi, Güngören / İstanbul",
    faqHeadingSuffix: "Hakkında Sıkça Sorulan B2B Soruları",
    faq1QPrefix: "ürünlerini tekil (perakende) olarak satın alabilir miyim?",
    faq1A:
      "Hayır. Satışlar yalnızca B2B toptan alıcılar için orijinal beden serisi (paket/lot) bazında gerçekleştirilir.",
    faq2Q: "Üreticiyle doğrudan fiyat ve üretim görüşmesi yapabilir miyim?",
    faq2A:
      "Evet, Canlı B2B Sohbet veya doğrudan WhatsApp hattı üzerinden üretici yetkilisiyle aracısız görüşebilirsiniz.",
    faq3Q: "Sevkiyatlar nereden yapılıyor?",
    faq3APrefix:
      "Siparişler doğrudan üreticinin Merter merkezinden kalite kontrolden geçirilerek kargo/ambar firmasına teslim edilir:",
    featuredTitleSuffix: "Seçkin Koleksiyon Modelleri",
    featuredSub: "Üreticinin vitrindeki güncel toptan seri modellerinden örnekler",
    viewAllBtnPrefix: "Tüm",
    viewAllBtnSuffix: "Ürünü Gör",
    companyTypeDefault: "Üretici & Toptan Satış",
    dtVerification: "Doğrulama Statüsü",
    ddVerified: "Doğrulanmış Üretici",
    dtActiveCollection: "Aktif Koleksiyon",
    ddModelsSuffix: "Model",
    dtSalesFormat: "Satış Biçimi",
    ddAssortedLot: "Orijinal Seri (Asorti Lot)",
    dtMinOrder: "Min. Sipariş",
    ddSeriesPack: "Seri Paket",
    dtHub: "Üretim Merkezi",
    dtExport: "İhracat Bölgesi",
    inspectShowcaseBtn: "Koleksiyon Vitrinini İncele",
    startLiveChatBtn: "Üreticiyle Canlı B2B Sohbet Başlat",
    loginLiveChatBtn: "Canlı B2B Sohbet (Üye Girişi)",
    waOrderLineBtn: "WhatsApp Sipariş Hattı",
    waIntroPrefix: "Merhaba",
    waIntroBody:
      "Merter Vitrini üzerindeki Kurumsal Tanıtım sayfanızı inceledim. Toptan koleksiyonunuz hakkında bilgi almak istiyorum.",
    postRfqBtn: "Özel Üretim / Alım İlanı (RFQ) Aç",
  },
  en: {
    backToDirectory: "Back to Verified Merter Manufacturers Directory",
    tabCollection: "Wholesale Collection",
    tabStory: "Factory Profile & Guide",
    loadingText: "Loading manufacturer editorial dossier...",
    notFoundText: "Manufacturer profile could not be found.",
    goDirectoryBtn: "Browse Manufacturers",
    heroVerifiedBadge: "VERIFIED MERTER MANUFACTURER DOSSIER",
    heroGuideBadge: "Corporate Profile & B2B Sourcing Guide",
    heroTitleSuffix: "Merter Garment Manufacturing Capacity & Wholesale Guide",
    heroSubtitleTemplate:
      "production standards, apparel categories, assorted size-run pack structure, export markets, and 0% commission factory-direct ordering.",
    statModelsSuffix: "+ Models",
    statModelsSub: "Active Wholesale Catalog",
    statSeriesTitle: "Size-Run Packs",
    statSeriesSub: "Assorted Factory Series",
    statExportTitle: "Global Export",
    statExportSub: "Consolidated Air & Road Cargo",
    statMerterTitle: "Merter / Istanbul",
    statMerterSub: "0% Commission Direct Factory",
    leadBadge: "Editorial Manufacturer Dossier & Wholesale Guide",
    leadFallbackSuffix:
      "is a verified apparel manufacturer in Istanbul's Merter textile hub supplying boutiques, retail chains, and international e-commerce brands with factory-direct size-run packs at 0% commission.",
    sec1TitleSuffix: "Brand Profile & Merter Production Standards",
    sec1BodySuffix:
      "operates in Istanbul Merter with end-to-end garment discipline—from fabric R&D and CAD pattern grading to precision stitching, steam finishing, quality control, and export-ready pack barcoding.",
    cardFabricTitle: "Premium Fabrics & Fit",
    cardFabricDesc:
      "High-grade woven and breathable knit blends engineered for consistent European/international sizing.",
    cardWeeklyTitle: "Weekly Capsule Drops",
    cardWeeklyDesc:
      "New wholesale models added weekly to keep boutique and online storefronts fresh.",
    cardVerifiedTitle: "100% Verified Factory",
    cardVerifiedDesc:
      "Commercial registration, production capacity, and dispatch standards verified on-site in Merter.",
    sec2Title: "Core Apparel Categories & Collection Architecture",
    sec2IntroSuffix:
      "collections are tailored for fast retail sell-through across physical boutiques and online stores:",
    group1: "Dresses & Jumpsuits: Daywear, office chic, modest cuts, and occasion capsules.",
    group2: "Two-Piece Sets & Co-ords: High-margin matching blazer, trouser, and skirt sets.",
    group3: "Tops, Blouses & Knitwear: Year-round fast-moving essentials and seasonal statement pieces.",
    group4: "Bottoms & Outerwear: Wide-leg trousers, skirts, trench coats, and tailored jackets.",
    sec3Title: "Assorted Size-Run Packaging & B2B Margin Advantages",
    sec3BodySuffix:
      "lists every style at direct factory prices with zero middleman markup, sold in standardized assorted size-run packs (e.g., S-M-L or 36-42).",
    moqBoxTitle: "📦 Flexible MOQ & Mixed Cart",
    moqBoxBodyPrefix: "Minimum order starts from",
    moqBoxBodySuffix: "pack(s), allowing mixed colorways and styles in one consolidated shipment.",
    exportBoxTitle: "🌍 Worldwide Export & Customs",
    exportBoxPrefix: "Key export destinations:",
    defaultExportRegions: "EU, UK, Eastern Europe, CIS, Middle East & North Africa",
    defaultAddress: "Merter Textile Center, Güngören / Istanbul",
    faqHeadingSuffix: "Frequently Asked B2B Questions",
    faq1QPrefix: "products available as single retail pieces?",
    faq1A:
      "No. Sales are strictly B2B wholesale in manufacturer-sealed assorted size-run packs (series/lots).",
    faq2Q: "Can I negotiate bulk pricing or Private Label directly with the factory?",
    faq2A:
      "Yes. Use Live B2B Chat or the direct WhatsApp line to discuss volume discounts or Private Label OEM runs directly.",
    faq3Q: "Where do orders ship from?",
    faq3APrefix:
      "All orders undergo quality inspection and dispatch directly from the manufacturer's Merter hub:",
    featuredTitleSuffix: "Featured Wholesale Models",
    featuredSub: "Sample size-run packs currently available from this manufacturer",
    viewAllBtnPrefix: "View All",
    viewAllBtnSuffix: "Models",
    companyTypeDefault: "Manufacturer & Wholesaler",
    dtVerification: "Verification",
    ddVerified: "Verified Factory",
    dtActiveCollection: "Active Catalog",
    ddModelsSuffix: "Models",
    dtSalesFormat: "Sales Format",
    ddAssortedLot: "Assorted Size-Run Pack",
    dtMinOrder: "Min. Order",
    ddSeriesPack: "Pack(s)",
    dtHub: "Production Hub",
    dtExport: "Export Markets",
    inspectShowcaseBtn: "Browse Full Wholesale Catalog",
    startLiveChatBtn: "Start Live B2B Chat",
    loginLiveChatBtn: "Live B2B Chat (Sign In)",
    waOrderLineBtn: "Direct WhatsApp Line",
    waIntroPrefix: "Hello",
    waIntroBody:
      "I reviewed your Factory Profile on Merter Vitrini and would like wholesale catalog details.",
    postRfqBtn: "Post Custom Production / Buyer RFQ",
  },
  ru: {
    backToDirectory: "Ко всем проверенным фабрикам Мертера",
    tabCollection: "Оптовая коллекция",
    tabStory: "О фабрике и B2B-гид",
    loadingText: "Загрузка презентации фабрики...",
    notFoundText: "Фабрика не найдена.",
    goDirectoryBtn: "В каталог фабрик",
    heroVerifiedBadge: "ДОСЬЕ ПРОВЕРЕННОЙ ФАБРИКИ МЕРТЕРА",
    heroGuideBadge: "Профиль производства и гид по оптовым закупкам",
    heroTitleSuffix: "Производственные мощности в Мертере и гид по коллекции",
    heroSubtitleTemplate:
      "— стандарты пошива, ассортиментные группы, структура размерных рядов и прямые поставки с фабрики без комиссии.",
    statModelsSuffix: "+ мод.",
    statModelsSub: "Активный оптовый каталог",
    statSeriesTitle: "Размерные ряды",
    statSeriesSub: "Фабричные серии (упаковки)",
    statExportTitle: "Экспорт и Карго",
    statExportSub: "Быстрая отправка в СНГ и ЕС",
    statMerterTitle: "Мертер / Стамбул",
    statMerterSub: "0% комиссии • Цена фабрики",
    leadBadge: "Редакционный обзор фабрики и гид закупщика",
    leadFallbackSuffix:
      "— проверенная фабрика готовой одежды в текстильном центре Мертер (Стамбул), поставляющая оптовые серии бутикам, сетям и селлерам маркетплейсов без посредников.",
    sec1TitleSuffix: "Профиль бренда и производство в Мертере",
    sec1BodySuffix:
      "работает по полному производственному циклу в Стамбуле: подбор тканей, компьютерное конструирование лекал, пошив, ОТК и серийная упаковка.",
    cardFabricTitle: "Качественные ткани и лекала",
    cardFabricDesc:
      "Выверенная посадка и износостойкие ткани обеспечивают высокий процент выкупа в рознице.",
    cardWeeklyTitle: "Еженедельные новинки",
    cardWeeklyDesc:
      "Каждую неделю каталог пополняется новыми капсульными моделями сезона.",
    cardVerifiedTitle: "100% проверенный цех",
    cardVerifiedDesc:
      "Юридический статус и производственная база в Мертере подтверждены командой платформы.",
    sec2Title: "Ассортиментные группы и структура коллекций",
    sec2IntroSuffix:
      "разрабатывает модели с высокой оборачиваемостью для розничных магазинов и онлайн-ритейла:",
    group1: "Платья и комбинезоны: повседневные, офисные и вечерние капсулы.",
    group2: "Костюмы и комплекты-двойки: трендовые сочетания с высоким средним чеком.",
    group3: "Блузы, рубашки и трикотаж: базовые и сезонные хиты продаж.",
    group4: "Брюки, юбки и верхняя одежда: актуальные фасоны на каждый сезон.",
    sec3Title: "Продажа размерными рядами и выгода B2B",
    sec3BodySuffix:
      "реализует продукцию напрямую по фабричным ценам без наценок посредников в стандартных размерных сериях.",
    moqBoxTitle: "📦 Гибкий минимальный заказ",
    moqBoxBodyPrefix: "Минимальный заказ — от",
    moqBoxBodySuffix: "серии с возможностью комбинировать разные модели и цвета.",
    exportBoxTitle: "🌍 Экспорт и карго-доставка",
    exportBoxPrefix: "Основные направления экспорта:",
    defaultExportRegions: "Россия, Казахстан, Беларусь, Узбекистан, ЕС и Балканы",
    defaultAddress: "Текстильный центр Мертер, Стамбул",
    faqHeadingSuffix: "— Частые вопросы оптовых покупателей",
    faq1QPrefix: "— возможна ли покупка поштучно в розницу?",
    faq1A:
      "Нет, продажи ведутся исключительно оптом фабричными размерными рядами (сериями).",
    faq2Q: "Можно ли обсудить крупный опт или пошив под своим брендом (СТМ)?",
    faq2A:
      "Да, свяжитесь с фабрикой напрямую через B2B-чат или WhatsApp для согласования крупного тиража.",
    faq3Q: "Откуда осуществляется отгрузка?",
    faq3APrefix:
      "Все заказы проходят проверку качества и передаются в ваше карго со склада в Мертере:",
    featuredTitleSuffix: "Избранные оптовые модели",
    featuredSub: "Актуальные серии из витрины производителя",
    viewAllBtnPrefix: "Смотреть все",
    viewAllBtnSuffix: "мод.",
    companyTypeDefault: "Фабрика и оптовая продажа",
    dtVerification: "Статус проверки",
    ddVerified: "Проверенная фабрика",
    dtActiveCollection: "В каталоге",
    ddModelsSuffix: "мод.",
    dtSalesFormat: "Формат отгрузки",
    ddAssortedLot: "Размерный ряд (Серия)",
    dtMinOrder: "Мин. заказ",
    ddSeriesPack: "серия",
    dtHub: "Производство",
    dtExport: "Экспорт",
    inspectShowcaseBtn: "Открыть полный каталог",
    startLiveChatBtn: "Начать онлайн B2B-чат",
    loginLiveChatBtn: "B2B-чат (Войти)",
    waOrderLineBtn: "Линия заказов WhatsApp",
    waIntroPrefix: "Здравствуйте,",
    waIntroBody:
      "ознакомился с профилем вашей фабрики на Merter Vitrini, хочу уточнить условия оптового заказа.",
    postRfqBtn: "Разместить заявку на пошив / закупку (RFQ)",
  },
  ar: {
    backToDirectory: "العودة إلى دليل مصانع مارتر المعتمدة",
    tabCollection: "تشكيلة ومنتجات المصنع",
    tabStory: "قصة المصنع ودليل الجملة",
    loadingText: "جاري تحميل الملف التعريفي للمصنع...",
    notFoundText: "لم يتم العثور على المصنع المطلوب.",
    goDirectoryBtn: "تصفح دليل المصانع",
    heroVerifiedBadge: "ملف مصنع معتمد في مارتر إسطنبول",
    heroGuideBadge: "التعريف المؤسسي ودليل الشراء بالجملة",
    heroTitleSuffix: "القدرة الإنتاجية في مارتر ودليل تشكيلات الجملة",
    heroSubtitleTemplate:
      "— معايير التصنيع، فئات الملابس، نظام الباكيدج المقسم بالمقاسات ومزايا الشراء المباشر من المصنع بعمولة 0%.",
    statModelsSuffix: "+ موديل",
    statModelsSub: "كتالوج الجملة النشط",
    statSeriesTitle: "نظام السيري",
    statSeriesSub: "باكيدج مقاسات قياسية",
    statExportTitle: "تصدير دولي",
    statExportSub: "شحن جوي وبري مؤمّن",
    statMerterTitle: "مارتر / إسطنبول",
    statMerterSub: "0% عمولة من المصنع مباشرة",
    leadBadge: "ملف تحريري للمصنع ودليل تجار الجملة",
    leadFallbackSuffix:
      "علامة تصنيع وتوريد ملابس بالجملة معتمدة في سوق مارتر إسطنبول، تقدم تشكيلات المصنع مباشرة للبوتيكات وسلاسل المتاجر بدون عمولات وسطاء.",
    sec1TitleSuffix: "نبذة عن العلامة وقوة التصنيع في مارتر",
    sec1BodySuffix:
      "تعمل وفق منظومة تصنيع متكاملة في مارتر إسطنبول تشمل اختيار الأقمشة، تصميم القوالب الرقمية، الخياطة الدقيقة، الفحص النهائي والتعبئة بنظام السيري.",
    cardFabricTitle: "خامات وقوالب عالية الجودة",
    cardFabricDesc: "أقمشة مختارة بعناية وقصّات مريحة تضمن رضا العملاء في متاجر التجزئة.",
    cardWeeklyTitle: "موديلات متجددة أسبوعياً",
    cardWeeklyDesc: "إضافة تصاميم موسمية جديدة كل أسبوع لتجديد واجهات البوتيكات باستمرار.",
    cardVerifiedTitle: "مصنع موثق 100%",
    cardVerifiedDesc: "تم التحقق ميدانياً من السجل التجاري والطاقة الإنتاجية في مارتر.",
    sec2Title: "فئات الملابس وهيكل التشكيلات",
    sec2IntroSuffix: "تشكيلات مصممة لسرعة الدوران البيعي في البوتيكات والمتاجر الإلكترونية:",
    group1: "الفساتين والجمبسوت: تصاميم يومية ورسمية وموديلات محجبات عصرية.",
    group2: "الأطقم الثنائية والبدل: تنسيقات متكاملة ترفع قيمة سلة المشتريات.",
    group3: "البلوزات والقمصان والتريكو: قطع أساسية وموسمية عالية الطلب.",
    group4: "البناطيل والتنانير والمعاطف: تشكيلات متنوعة لكافة المواسم.",
    sec3Title: "التعبئة بنظام الباكيدج ومزايا الربحية لتجار الجملة",
    sec3BodySuffix:
      "تُعرض جميع منتجات المصنع بأسعار المصنع المباشرة دون وسطاء، وتُباع ضمن باكيدج مقاسات متكامل (سيري).",
    moqBoxTitle: "📦 مرونة الحد الأدنى للطلب",
    moqBoxBodyPrefix: "يبدأ الحد الأدنى للطلب من",
    moqBoxBodySuffix: "سيري مع إمكانية تنويع الألوان والموديلات في سلة واحدة.",
    exportBoxTitle: "🌍 التصدير والشحن الدولي",
    exportBoxPrefix: "أهم أسواق التصدير:",
    defaultExportRegions: "دول الخليج العربي، الشرق الأوسط، شمال أفريقيا وأوروبا",
    defaultAddress: "مركز مارتر للنسيج، إسطنبول",
    faqHeadingSuffix: "— الأسئلة الشائعة لتجار الجملة",
    faq1QPrefix: "— هل يمكن شراء القطع بالمفرق (قطعة واحدة)؟",
    faq1A: "لا، البيع مخصص لتجار الجملة فقط بنظام السيري/الباكيدج الكامل.",
    faq2Q: "هل يمكن التفاوض مباشرة مع المصنع للكميات الكبيرة أو التصنيع الخاص؟",
    faq2A: "نعم، عبر محادثة B2B المباشرة أو خط واتساب الخاص بالمصنع دون أي وسيط.",
    faq3Q: "من أين يتم شحن الطلبيات؟",
    faq3APrefix: "يتم تجهيز وفحص الطلبيات وتسليمها لشركة الشحن مباشرة من مقر المصنع في مارتر:",
    featuredTitleSuffix: "موديلات مختارة من التشكيلة",
    featuredSub: "نماذج من موديلات الجملة المتوفرة حالياً لدى المصنع",
    viewAllBtnPrefix: "عرض جميع",
    viewAllBtnSuffix: "موديل",
    companyTypeDefault: "مصنع وبيع بالجملة",
    dtVerification: "حالة التوثيق",
    ddVerified: "مصنع معتمد",
    dtActiveCollection: "التشكيلة النشطة",
    ddModelsSuffix: "موديل",
    dtSalesFormat: "نظام البيع",
    ddAssortedLot: "سيري مقاسات (باكيدج)",
    dtMinOrder: "الحد الأدنى",
    ddSeriesPack: "سيري",
    dtHub: "مقر الإنتاج",
    dtExport: "نطاق التصدير",
    inspectShowcaseBtn: "تصفح كتالوج المصنع الكامل",
    startLiveChatBtn: "بدء محادثة B2B مباشرة",
    loginLiveChatBtn: "محادثة مباشرة (تسجيل الدخول)",
    waOrderLineBtn: "خط طلبات واتساب",
    waIntroPrefix: "مرحباً",
    waIntroBody: "اطلعت على ملف مصنعكم في Merter Vitrini وأرغب بالاستفسار عن تشكيلة الجملة.",
    postRfqBtn: "إنشاء طلب تصنيع خاص / شراء (RFQ)",
  },
  de: {
    backToDirectory: "Zurück zum Merter-Herstellerverzeichnis",
    tabCollection: "Kollektion & Produkte",
    tabStory: "Firmenprofil & Ratgeber",
    loadingText: "Herstellerdossier wird geladen...",
    notFoundText: "Herstellerprofil nicht gefunden.",
    goDirectoryBtn: "Zum Herstellerverzeichnis",
    heroVerifiedBadge: "GEPRÜFTES MERTER-HERSTELLERDOSSIER",
    heroGuideBadge: "Unternehmensprofil & B2B-Einkaufsratgeber",
    heroTitleSuffix: "Produktionskompetenz in Merter & Großhandelsratgeber",
    heroSubtitleTemplate:
      "— Fertigungsstandards, Produktgruppen, sortierte Größenserien, Exportmärkte und direkter Werkseinkauf mit 0% Provision.",
    statModelsSuffix: "+ Modelle",
    statModelsSub: "Aktive B2B-Kollektion",
    statSeriesTitle: "Größenserien",
    statSeriesSub: "Sortierte Serienpakete",
    statExportTitle: "EU- & Weltexport",
    statExportSub: "Versicherter Expressversand",
    statMerterTitle: "Merter / Istanbul",
    statMerterSub: "0% Provision • Ab Werk",
    leadBadge: "Redaktionelles Herstellerprofil & Einkaufsführer",
    leadFallbackSuffix:
      "ist ein geprüfter Bekleidungshersteller im Textilzentrum Merter Istanbul und beliefert Boutiquen, Filialisten sowie Online-Händler ohne Zwischenhändler direkt ab Werk.",
    sec1TitleSuffix: "Markenprofil & Fertigungsqualität in Merter",
    sec1BodySuffix:
      "arbeitet in Istanbul Merter mit durchgängiger Produktionskontrolle – von Stoffauswahl und CAD-Schnitttechnik über Konfektion bis zur Qualitätsprüfung und Serienverpackung.",
    cardFabricTitle: "Hochwertige Stoffe & Passform",
    cardFabricDesc:
      "Sorgfältig geprüfte Gewebe und passgenaue Schnitte reduzieren Retouren im Einzelhandel.",
    cardWeeklyTitle: "Wöchentlich neue Kapseln",
    cardWeeklyDesc:
      "Regelmäßige Neuheiten sorgen für attraktive Sortimente in Ihrem Geschäft.",
    cardVerifiedTitle: "100% geprüfter Betrieb",
    cardVerifiedDesc:
      "Gewerbliche Registrierung und Produktionskapazität vor Ort in Merter verifiziert.",
    sec2Title: "Sortimentsstruktur & Warengruppen",
    sec2IntroSuffix:
      "entwickelt Kollektionen für schnelle Abverkäufe im stationären Handel und E-Commerce:",
    group1: "Kleider & Jumpsuits: Tagesmode, Business-Looks und festliche Serien.",
    group2: "Zweiteiler & Blazer-Sets: Umsatzstarke Kombinationen für höhere Warenkörbe.",
    group3: "Oberteile, Blusen & Strick: Ganzjährige Bestseller und Saison-Highlights.",
    group4: "Hosen, Röcke & Outerwear: Moderne Schnitte sowie Mäntel und Jacken.",
    sec3Title: "Serienverpackung & B2B-Einkaufsvorteile",
    sec3BodySuffix:
      "bietet sämtliche Artikel ohne Vermittlungsprovision zu direkten Werkspreisen in standardisierten Größenserien an.",
    moqBoxTitle: "📦 Niedrige MOQ & Mischwarenkorb",
    moqBoxBodyPrefix: "Mindestbestellmenge ab",
    moqBoxBodySuffix: "Serie – kombinieren Sie verschiedene Farben und Modelle flexibel.",
    exportBoxTitle: "🌍 Internationaler Versand & Zoll",
    exportBoxPrefix: "Wichtigste Exportregionen:",
    defaultExportRegions: "DACH (Deutschland, Österreich, Schweiz), EU, Balkan & Nahost",
    defaultAddress: "Textilzentrum Merter, Güngören / Istanbul",
    faqHeadingSuffix: "— Häufige B2B-Fragen",
    faq1QPrefix: "— können Artikel einzeln gekauft werden?",
    faq1A:
      "Nein. Der Verkauf erfolgt ausschließlich im B2B-Großhandel in vollständigen Größenserien (Packs).",
    faq2Q: "Kann ich Großmengen oder Private Label direkt mit dem Werk verhandeln?",
    faq2A:
      "Ja, über den Live-B2B-Chat oder direkt per WhatsApp mit dem Ansprechpartner des Herstellers.",
    faq3Q: "Von wo erfolgt der Versand?",
    faq3APrefix:
      "Nach der Endkontrolle erfolgt der Versand direkt ab dem Merter-Standort des Herstellers:",
    featuredTitleSuffix: "Ausgewählte Kollektionsmodelle",
    featuredSub: "Aktuelle Großhandelsserien aus dem Showroom des Herstellers",
    viewAllBtnPrefix: "Alle",
    viewAllBtnSuffix: "Modelle ansehen",
    companyTypeDefault: "Hersteller & Großhandel",
    dtVerification: "Status",
    ddVerified: "Geprüfter Hersteller",
    dtActiveCollection: "Aktive Modelle",
    ddModelsSuffix: "Modelle",
    dtSalesFormat: "Verkaufseinheit",
    ddAssortedLot: "Sortierte Größenserie",
    dtMinOrder: "Mindestabnahme",
    ddSeriesPack: "Serie(n)",
    dtHub: "Standort",
    dtExport: "Export",
    inspectShowcaseBtn: "Gesamte Kollektion ansehen",
    startLiveChatBtn: "Live-B2B-Chat starten",
    loginLiveChatBtn: "Live-B2B-Chat (Anmelden)",
    waOrderLineBtn: "WhatsApp-Bestellhotline",
    waIntroPrefix: "Guten Tag",
    waIntroBody:
      "ich habe Ihr Herstellerprofil auf Merter Vitrini gelesen und interessiere mich für Ihre Großhandelskollektion.",
    postRfqBtn: "Produktions-/Kaufgesuch (RFQ) erstellen",
  },
  fr: {
    backToDirectory: "Retour à l’annuaire des fabricants de Merter",
    tabCollection: "Collection & Produits",
    tabStory: "Profil & Guide B2B",
    loadingText: "Chargement du dossier fabricant...",
    notFoundText: "Fabricant introuvable.",
    goDirectoryBtn: "Voir l’annuaire",
    heroVerifiedBadge: "DOSSIER FABRICANT VÉRIFIÉ MERTER",
    heroGuideBadge: "Présentation Corporate & Guide d’Achat B2B",
    heroTitleSuffix: "Capacité de Production à Merter & Guide Grossiste",
    heroSubtitleTemplate:
      "— standards de confection, gammes produits, conditionnement par séries assorties et prix directs usine à 0% de commission.",
    statModelsSuffix: "+ Modèles",
    statModelsSub: "Catalogue B2B actif",
    statSeriesTitle: "Séries assorties",
    statSeriesSub: "Lots de tailles standards",
    statExportTitle: "Export Global",
    statExportSub: "Expédition rapide & assurée",
    statMerterTitle: "Merter / Istanbul",
    statMerterSub: "0% commission • Direct usine",
    leadBadge: "Dossier Éditorial Fabricant & Guide d’Approvisionnement",
    leadFallbackSuffix:
      "est un fabricant vérifié du pôle textile de Merter à Istanbul, fournissant boutiques, chaînes et e-commerçants en direct usine sans commission d’intermédiaire.",
    sec1TitleSuffix: "Profil de Marque & Savoir-Faire Industriel à Merter",
    sec1BodySuffix:
      "maîtrise l’ensemble de la chaîne de confection à Istanbul : sélection des étoffes, patronage CAO, montage soigné, contrôle qualité et mise en série.",
    cardFabricTitle: "Tissus & Coupes Soignés",
    cardFabricDesc:
      "Matières sélectionnées et gradation régulière garantissant une excellente tenue en boutique.",
    cardWeeklyTitle: "Nouveautés Hebdomadaires",
    cardWeeklyDesc:
      "Des capsules saisonnières ajoutées chaque semaine pour dynamiser vos rayons.",
    cardVerifiedTitle: "Usine 100% Vérifiée",
    cardVerifiedDesc:
      "Existence légale, atelier et capacité logistique contrôlés à Merter Istanbul.",
    sec2Title: "Architecture des Collections & Familles de Produits",
    sec2IntroSuffix:
      "conçoit ses lignes pour une rotation rapide en boutique physique comme en ligne :",
    group1: "Robes & Combinaisons : coupes citadines, bureau, mode modeste et cérémonie.",
    group2: "Ensembles Coordonnés & Tailleurs : pièces à forte valeur panier.",
    group3: "Hauts, Blouses & Maille : essentiels quatre saisons et modèles tendance.",
    group4: "Pantalons, Jupes & Manteaux : coupes actuelles et pièces d’extérieur.",
    sec3Title: "Vente par Séries Assorties & Avantages B2B",
    sec3BodySuffix:
      "propose tous ses modèles au tarif direct fabricant sans commission, vendus en paquets de tailles assorties.",
    moqBoxTitle: "📦 MOQ Souple & Panier Mixte",
    moqBoxBodyPrefix: "Commande minimum dès",
    moqBoxBodySuffix: "série(s), avec panachage libre des coloris et références.",
    exportBoxTitle: "🌍 Export International & Douane",
    exportBoxPrefix: "Principaux marchés d’export :",
    defaultExportRegions: "France, Belgique, UE, Maghreb, Afrique & Moyen-Orient",
    defaultAddress: "Centre textile de Merter, Istanbul",
    faqHeadingSuffix: "— Questions Fréquentes B2B",
    faq1QPrefix: "— puis-je acheter à l’unité au détail ?",
    faq1A:
      "Non. Les ventes sont strictement réservées aux professionnels par séries complètes de tailles.",
    faq2Q: "Puis-je négocier des volumes ou du Private Label en direct ?",
    faq2A:
      "Oui, échangez directement avec l’usine via le Chat B2B ou la ligne WhatsApp dédiée.",
    faq3Q: "D’où partent les expéditions ?",
    faq3APrefix:
      "Les colis sont contrôlés et remis à votre transitaire directement depuis Merter :",
    featuredTitleSuffix: "Modèles Phares de la Collection",
    featuredSub: "Aperçu des séries actuellement disponibles en vitrine",
    viewAllBtnPrefix: "Voir les",
    viewAllBtnSuffix: "modèles",
    companyTypeDefault: "Fabricant & Grossiste",
    dtVerification: "Statut",
    ddVerified: "Fabricant vérifié",
    dtActiveCollection: "Collection active",
    ddModelsSuffix: "Modèles",
    dtSalesFormat: "Conditionnement",
    ddAssortedLot: "Série assortie (Lot)",
    dtMinOrder: "Commande min.",
    ddSeriesPack: "Série(s)",
    dtHub: "Site de production",
    dtExport: "Zones d’export",
    inspectShowcaseBtn: "Explorer toute la collection",
    startLiveChatBtn: "Démarrer le Chat B2B",
    loginLiveChatBtn: "Chat B2B (Connexion)",
    waOrderLineBtn: "Ligne WhatsApp Directe",
    waIntroPrefix: "Bonjour",
    waIntroBody:
      "j’ai consulté votre présentation sur Merter Vitrini et souhaite des informations sur vos collections en gros.",
    postRfqBtn: "Publier un appel d’offres / RFQ",
  },
  pl: {
    backToDirectory: "Wróć do katalogu producentów Merter",
    tabCollection: "Kolekcja i produkty",
    tabStory: "Profil firmy i poradnik",
    loadingText: "Ładowanie prezentacji producenta...",
    notFoundText: "Nie znaleziono producenta.",
    goDirectoryBtn: "Przejdź do katalogu",
    heroVerifiedBadge: "ZWERYFIKOWANY PROFIL PRODUCENTA MERTER",
    heroGuideBadge: "Prezentacja Firmy i Poradnik Zakupów Hurtowych",
    heroTitleSuffix: "Potencjał Produkcyjny w Merter i Przewodnik po Kolekcji",
    heroSubtitleTemplate:
      "— standardy szycia, grupy asortymentowe, struktura paczek rozmiarowych oraz zakupy prosto z fabryki z 0% prowizji.",
    statModelsSuffix: "+ Modeli",
    statModelsSub: "Aktywna kolekcja hurtowa",
    statSeriesTitle: "Pełne Serie",
    statSeriesSub: "Paczki rozmiarowe producenta",
    statExportTitle: "Eksport do Polski i UE",
    statExportSub: "Szybki i ubezpieczony transport",
    statMerterTitle: "Merter / Stambuł",
    statMerterSub: "0% prowizji • Ceny fabryczne",
    leadBadge: "Redakcyjny Profil Producenta i Poradnik B2B",
    leadFallbackSuffix:
      "to zweryfikowany producent odzieży w centrum tekstylnym Merter w Stambule, zaopatrujący butiki, sieci handlowe i sklepy internetowe bezpośrednio w cenach fabrycznych.",
    sec1TitleSuffix: "Profil Marki i Jakość Produkcji w Merter",
    sec1BodySuffix:
      "realizuje w Stambule pełny proces produkcyjny: od doboru tkanin i komputerowego stopniowania szablonów po szycie, kontrolę jakości i pakowanie w serie.",
    cardFabricTitle: "Wysokogatunkowe Tkaniny",
    cardFabricDesc:
      "Starannie dobrane materiały i dopracowane kroje minimalizują zwroty w sprzedaży detalicznej.",
    cardWeeklyTitle: "Cotygodniowe Nowości",
    cardWeeklyDesc:
      "Regularne dostawy nowych modeli pozwalają utrzymać świeżą ofertę butiku.",
    cardVerifiedTitle: "100% Zweryfikowana Fabryka",
    cardVerifiedDesc:
      "Dane rejestrowe oraz zaplecze produkcyjne w Merter zostały potwierdzone na miejscu.",
    sec2Title: "Struktura Kolekcji i Główne Grupy Produktowe",
    sec2IntroSuffix:
      "projektuje kolekcje nastawione na szybką rotację w butikach stacjonarnych i sprzedaży online:",
    group1: "Sukienki i kombinezony: modele codzienne, biurowe oraz wizytowe.",
    group2: "Komplety dwuczęściowe i garnitury damskie: zestawy podnoszące wartość koszyka.",
    group3: "Bluzki, koszule i dzianiny: całoroczne bestsellery i modowe nowości.",
    group4: "Spodnie, spódnice i okrycia wierzchnie: sezonowe płaszcze, trencze i kurtki.",
    sec3Title: "Pakowanie w Serie (Paczki) i Korzyści Marżowe B2B",
    sec3BodySuffix:
      "oferuje wszystkie modele bez prowizji pośredników w oryginalnych paczkach rozmiarowych producenta.",
    moqBoxTitle: "📦 Niskie MOQ i Mieszany Koszyk",
    moqBoxBodyPrefix: "Minimalne zamówienie już od",
    moqBoxBodySuffix: "paczki – swobodnie łącz różne kolory i fasony w jednej wysyłce.",
    exportBoxTitle: "🌍 Eksport i Spedycja Międzynarodowa",
    exportBoxPrefix: "Główne kierunki eksportu:",
    defaultExportRegions: "Polska, kraje UE, Bałkany oraz Europa Wschodnia",
    defaultAddress: "Centrum Tekstylne Merter, Stambuł",
    faqHeadingSuffix: "— Najczęstsze Pytania Hurtowników",
    faq1QPrefix: "— czy mogę kupić pojedyncze sztuki detalicznie?",
    faq1A:
      "Nie. Sprzedaż prowadzona jest wyłącznie hurtowo (B2B) w pełnych seriach rozmiarowych.",
    faq2Q: "Czy mogę negocjować większe ilości lub szycie Private Label bezpośrednio?",
    faq2A:
      "Tak, skontaktuj się bezpośrednio z producentem przez Czat B2B lub linię WhatsApp.",
    faq3Q: "Skąd realizowana jest wysyłka?",
    faq3APrefix:
      "Zamówienia po kontroli jakości przekazywane są spedycji bezpośrednio z siedziby w Merter:",
    featuredTitleSuffix: "Wybrane Modele z Kolekcji",
    featuredSub: "Przykładowe pakiety hurtowe dostępne aktualnie w ofercie",
    viewAllBtnPrefix: "Zobacz wszystkie",
    viewAllBtnSuffix: "modeli",
    companyTypeDefault: "Producent i hurtownia",
    dtVerification: "Status weryfikacji",
    ddVerified: "Zweryfikowany producent",
    dtActiveCollection: "Aktywna oferta",
    ddModelsSuffix: "Modeli",
    dtSalesFormat: "Forma sprzedaży",
    ddAssortedLot: "Pełna seria (Paczka)",
    dtMinOrder: "Min. zamówienie",
    ddSeriesPack: "Paczka",
    dtHub: "Siedziba produkcji",
    dtExport: "Rynki eksportowe",
    inspectShowcaseBtn: "Zobacz pełną kolekcję",
    startLiveChatBtn: "Rozpocznij Czat B2B",
    loginLiveChatBtn: "Czat B2B (Logowanie)",
    waOrderLineBtn: "Linia zamówień WhatsApp",
    waIntroPrefix: "Dzień dobry",
    waIntroBody:
      "zapoznałem się z profilem Państwa firmy na Merter Vitrini i proszę o szczegóły oferty hurtowej.",
    postRfqBtn: "Dodaj zlecenie szycia / zakupu (RFQ)",
  },
  bg: {
    backToDirectory: "Обратно към каталога на производителите в Мертер",
    tabCollection: "Колекция и продукти",
    tabStory: "Профил и ръководство",
    loadingText: "Зареждане на фирменото представяне...",
    notFoundText: "Производителят не е намерен.",
    goDirectoryBtn: "Към каталога на фирмите",
    heroVerifiedBadge: "ДОСИЕ НА ПРОВЕРЕН ПРОИЗВОДИТЕЛ ОТ МЕРТЕР",
    heroGuideBadge: "Корпоративен профил и ръководство за покупка на едро",
    heroTitleSuffix: "Производствен капацитет в Мертер и ръководство за колекцията",
    heroSubtitleTemplate:
      "— производствени стандарти, продуктови групи, размерни серии и директни фабрични поръчки с 0% комисиона.",
    statModelsSuffix: "+ Модела",
    statModelsSub: "Активна колекция на едро",
    statSeriesTitle: "Оригинални серии",
    statSeriesSub: "Стандартни размерни пакети",
    statExportTitle: "Износ за България и ЕС",
    statExportSub: "Бързо и застраховано карго",
    statMerterTitle: "Мертер / Истанбул",
    statMerterSub: "0% комисиона • Фабрични цени",
    leadBadge: "Редакционен профил и B2B ръководство",
    leadFallbackSuffix:
      "е проверен производител на конфекция в текстилния център Мертер Истанбул, доставящ директно на бутици, търговски вериги и онлайн магазини без посредници.",
    sec1TitleSuffix: "Профил на марката и производство в Мертер",
    sec1BodySuffix:
      "работи в Мертер Истанбул със затворен производствен цикъл — от подбор на платове и CAD кройки до прецизен шев, качествен контрол и серийно пакетиране.",
    cardFabricTitle: "Първокласни платове и кройки",
    cardFabricDesc:
      "Подбрани материи и точни размери, осигуряващи висока удовлетвореност на крайните клиенти.",
    cardWeeklyTitle: "Седмични нови модели",
    cardWeeklyDesc:
      "Всяка седмица се добавят нови сезонни серии за свежа витрина на вашия бутик.",
    cardVerifiedTitle: "100% проверена фабрика",
    cardVerifiedDesc:
      "Търговската регистрация и производствената база в Мертер са потвърдени на място.",
    sec2Title: "Основни продуктови групи и колекции",
    sec2IntroSuffix:
      "разработва колекции за бърза реализация във физически бутици и онлайн платформи:",
    group1: "Рокли и гащеризони: ежедневни, офис и официални капсулни серии.",
    group2: "Комплекти от две части и костюми: комбинации с висока средна стойност на количката.",
    group3: "Блузи, ризи и плетива: целогодишни базови и тренд модели.",
    group4: "Панталони, поли и връхни дрехи: сезонни палта, тренчкоти и сака.",
    sec3Title: "Пакетиране на серии и B2B предимства",
    sec3BodySuffix:
      "предлага всички модели без комисиона от посредници на директни фабрични цени в стандартни размерни серии.",
    moqBoxTitle: "📦 Гъвкав минимум и смесена количка",
    moqBoxBodyPrefix: "Минималната поръчка започва от",
    moqBoxBodySuffix: "серия с възможност за комбиниране на различни цветове и модели.",
    exportBoxTitle: "🌍 Износ и международна доставка",
    exportBoxPrefix: "Основни пазари за износ:",
    defaultExportRegions: "България, Румъния, Гърция, ЕС, Балкани и Близък изток",
    defaultAddress: "Текстилен център Мертер, Истанбул",
    faqHeadingSuffix: "— Често задавани B2B въпроси",
    faq1QPrefix: "— мога ли да закупя единични бройки на дребно?",
    faq1A:
      "Не. Продажбите са само на едро за B2B търговци в оригинални размерни серии (пакети).",
    faq2Q: "Мога ли да договарям обеми или ишлеме / Private Label директно?",
    faq2A:
      "Да, свържете се директно с фабриката чрез B2B чата на живо или WhatsApp линията.",
    faq3Q: "Откъде се изпращат поръчките?",
    faq3APrefix:
      "Пратките преминават качествен контрол и се предават на карго директно от базата в Мертер:",
    featuredTitleSuffix: "Избрани модели от колекцията",
    featuredSub: "Примери от актуалните серии на производителя",
    viewAllBtnPrefix: "Виж всички",
    viewAllBtnSuffix: "модела",
    companyTypeDefault: "Производител и търговец на едро",
    dtVerification: "Статус",
    ddVerified: "Проверен производител",
    dtActiveCollection: "Активна колекция",
    ddModelsSuffix: "Модела",
    dtSalesFormat: "Начин на продажба",
    ddAssortedLot: "Оригинална серия (Пакет)",
    dtMinOrder: "Мин. поръчка",
    ddSeriesPack: "Серия",
    dtHub: "Производствена база",
    dtExport: "Пазари за износ",
    inspectShowcaseBtn: "Разгледай пълния каталог",
    startLiveChatBtn: "Започни B2B чат на живо",
    loginLiveChatBtn: "B2B чат (Вход)",
    waOrderLineBtn: "WhatsApp линия за поръчки",
    waIntroPrefix: "Здравейте",
    waIntroBody:
      "разгледах представянето на вашата фабрика в Merter Vitrini и желая информация за колекцията на едро.",
    postRfqBtn: "Публикувай запитване за производство (RFQ)",
  },
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

function subscribeStore(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getCartPkgsSnapshot(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem("merter_b2b_cart");
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as Array<{ quantity?: number }>;
    if (!Array.isArray(parsed)) return 0;
    return parsed.reduce((acc, item) => acc + (Number(item.quantity) || 0), 0);
  } catch {
    return 0;
  }
}

function getCartPkgsServerSnapshot(): number {
  return 0;
}

interface EditorialArticleSectionsProps {
  readonly brand: Brand;
  readonly blogSummary?: string;
  readonly copy: EditorialCopy;
}

function EditorialArticleSections({
  brand,
  blogSummary,
  copy,
}: EditorialArticleSectionsProps) {
  const exportRegions = brand.export_countries || copy.defaultExportRegions;
  const addressText = brand.location_address || copy.defaultAddress;
  const groups = [copy.group1, copy.group2, copy.group3, copy.group4];

  return (
    <article className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 sm:p-10 space-y-8 text-slate-700 leading-relaxed">
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-amber-50/70 via-white to-emerald-50/50 border border-amber-200/70 space-y-2">
        <div className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-amber-800">
          <Sparkles size={14} className="text-amber-600" />
          <span>{copy.leadBadge}</span>
        </div>
        <p className="text-sm sm:text-base font-medium text-slate-800 leading-relaxed">
          {blogSummary || brand.description || `${brand.name} ${copy.leadFallbackSuffix}`}
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-black flex items-center justify-center shrink-0">
            01
          </span>
          <span>
            {brand.name} — {copy.sec1TitleSuffix}
          </span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
          <strong>{brand.name}</strong> {copy.sec1BodySuffix}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900">
              <Award size={14} className="text-emerald-600" />
              <span>{copy.cardFabricTitle}</span>
            </div>
            <p className="text-xs text-slate-600">{copy.cardFabricDesc}</p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900">
              <Layers size={14} className="text-amber-600" />
              <span>{copy.cardWeeklyTitle}</span>
            </div>
            <p className="text-xs text-slate-600">{copy.cardWeeklyDesc}</p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900">
              <ShieldCheck size={14} className="text-sky-600" />
              <span>{copy.cardVerifiedTitle}</span>
            </div>
            <p className="text-xs text-slate-600">{copy.cardVerifiedDesc}</p>
          </div>
        </div>
      </section>

      <section className="space-y-3 pt-4 border-t border-slate-100">
        <h2 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 text-xs font-black flex items-center justify-center shrink-0">
            02
          </span>
          <span>{copy.sec2Title}</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
          <strong>{brand.name}</strong> {copy.sec2IntroSuffix}
        </p>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs sm:text-sm text-slate-700 list-none p-0 m-0">
          {groups.map((item) => (
            <li
              key={item.slice(0, 24)}
              className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50/40 border border-emerald-100"
            >
              <CheckCircle2 size={15} className="text-emerald-600 shrink-0 mt-0.5" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3 pt-4 border-t border-slate-100">
        <h2 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-lg bg-sky-100 text-sky-800 text-xs font-black flex items-center justify-center shrink-0">
            03
          </span>
          <span>{copy.sec3Title}</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
          <strong>{brand.name}</strong> {copy.sec3BodySuffix}
        </p>
        <div className="p-4 rounded-2xl bg-sky-50/60 border border-sky-200/80 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <div className="font-extrabold text-sky-950 mb-1">{copy.moqBoxTitle}</div>
            <p className="text-slate-600">
              {copy.moqBoxBodyPrefix} <strong>{brand.min_order_quantity ?? 1}</strong>{" "}
              {copy.moqBoxBodySuffix}
            </p>
          </div>
          <div>
            <div className="font-extrabold text-sky-950 mb-1">{copy.exportBoxTitle}</div>
            <p className="text-slate-600">
              {copy.exportBoxPrefix} <strong>{exportRegions}</strong>
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3 pt-4 border-t border-slate-100">
        <h2 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2.5">
          <HelpCircle size={20} className="text-amber-600 shrink-0" />
          <span>
            {brand.name} {copy.faqHeadingSuffix}
          </span>
        </h2>
        <div className="space-y-2.5">
          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-1">
            <h3 className="text-xs sm:text-sm font-extrabold text-slate-900">
              1. {brand.name} {copy.faq1QPrefix}
            </h3>
            <p className="text-xs text-slate-600">{copy.faq1A}</p>
          </div>
          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-1">
            <h3 className="text-xs sm:text-sm font-extrabold text-slate-900">2. {copy.faq2Q}</h3>
            <p className="text-xs text-slate-600">{copy.faq2A}</p>
          </div>
          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-1">
            <h3 className="text-xs sm:text-sm font-extrabold text-slate-900">3. {copy.faq3Q}</h3>
            <p className="text-xs text-slate-600">
              {copy.faq3APrefix} {addressText}
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
  readonly copy: EditorialCopy;
  readonly langSuffix: string;
  readonly onOpenChat: () => void;
}

function SidebarIdentityCard({
  brand,
  slug,
  totalProducts,
  isMemberLoggedIn,
  copy,
  langSuffix,
  onOpenChat,
}: SidebarIdentityCardProps) {
  const waRaw = brand.whatsapp_phone || brand.phone || "";
  const callRaw = brand.phone || brand.whatsapp_phone || "";
  const waDigits = normalizeWaPhone(waRaw);
  const waMessage = `${copy.waIntroPrefix} *${brand.name}*,\n${copy.waIntroBody}`;
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
            <p className="text-xs font-bold text-emerald-700">{copy.companyTypeDefault}</p>
          </div>
        </div>

        <dl className="space-y-2.5 text-xs">
          <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
            <dt className="text-slate-500 font-semibold">{copy.dtVerification}</dt>
            <dd className="font-extrabold text-emerald-700 inline-flex items-center gap-1">
              <ShieldCheck size={13} />
              <span>{copy.ddVerified}</span>
            </dd>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
            <dt className="text-slate-500 font-semibold">{copy.dtActiveCollection}</dt>
            <dd className="font-extrabold text-slate-900">
              {totalProducts} {copy.ddModelsSuffix}
            </dd>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
            <dt className="text-slate-500 font-semibold">{copy.dtSalesFormat}</dt>
            <dd className="font-bold text-slate-800">{copy.ddAssortedLot}</dd>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
            <dt className="text-slate-500 font-semibold">{copy.dtMinOrder}</dt>
            <dd className="font-bold text-slate-800">
              {brand.min_order_quantity ?? 1} {copy.ddSeriesPack}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-2 py-1.5 border-b border-slate-100">
            <dt className="text-slate-500 font-semibold shrink-0">{copy.dtHub}</dt>
            <dd className="font-semibold text-slate-700 text-right">
              {brand.location_address || copy.defaultAddress}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-2 py-1.5">
            <dt className="text-slate-500 font-semibold shrink-0">{copy.dtExport}</dt>
            <dd className="font-semibold text-slate-700 text-right">
              {brand.export_countries || copy.defaultExportRegions}
            </dd>
          </div>
        </dl>

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

        <div className="space-y-2.5 pt-2">
          <Link
            href={`/ureticiler/${encodeURIComponent(slug)}${langSuffix}`}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold no-underline transition-colors shadow-xs"
          >
            <Package size={15} />
            <span>
              {copy.inspectShowcaseBtn} ({totalProducts})
            </span>
          </Link>

          <button
            type="button"
            onClick={isMemberLoggedIn ? onOpenChat : () => openStoreAuthModal("login")}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold cursor-pointer border-none transition-colors shadow-xs"
          >
            {isMemberLoggedIn ? (
              <>
                <MessageCircle size={15} />
                <span>{copy.startLiveChatBtn}</span>
              </>
            ) : (
              <>
                <Lock size={14} />
                <span>{copy.loginLiveChatBtn}</span>
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
              <span>{copy.waOrderLineBtn}</span>
            </a>
          )}

          <Link
            href={`/alim-talepleri${langSuffix}`}
            className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold no-underline transition-colors"
          >
            <FileText size={14} />
            <span>{copy.postRfqBtn}</span>
          </Link>
        </div>
      </div>
    </aside>
  );
}

interface SupplierEditorialProfileClientProps {
  readonly slug: string;
  readonly initialLang?: SupportedSeoLang;
  readonly initialBrand?: Brand | null;
  readonly initialFeaturedProducts?: readonly Product[];
  readonly initialTotalProducts?: number;
  readonly initialCategories?: readonly Category[];
}

export default function SupplierEditorialProfileClient({
  slug,
  initialLang = "tr",
  initialBrand = null,
  initialFeaturedProducts = [],
  initialTotalProducts = 0,
  initialCategories = [],
}: SupplierEditorialProfileClientProps) {
  const router = useRouter();
  const isMemberLoggedIn = useIsStoreMemberLoggedIn();
  const [lang, setLang] = useState<string>(initialLang);
  const [isLangOpen, setIsLangOpen] = useState<boolean>(false);
  const [displayCurrency, setDisplayCurrency] = useState<string>("TRY");
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);
  const [categories, setCategories] = useState<Category[]>([...initialCategories]);
  const [brand, setBrand] = useState<Brand | null>(initialBrand);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([...initialFeaturedProducts]);
  const [totalProducts, setTotalProducts] = useState<number>(initialTotalProducts);
  const [blogSummary, setBlogSummary] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(!initialBrand);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState<boolean>(false);
  const [policyModalType, setPolicyModalType] = useState<
    "cancellation_and_return" | "terms_of_service" | "privacy_policy" | ""
  >("");

  const safeLang = normalizeSeoLang(lang, "tr");
  const copy = EDITORIAL_COPY[safeLang];
  const langSuffix = safeLang === "tr" ? "" : `?lang=${safeLang}`;

  const totalPkgs = useSyncExternalStore(
    subscribeStore,
    getCartPkgsSnapshot,
    getCartPkgsServerSnapshot
  );

  useEffect(() => {
    async function loadEditorialPage() {
      const needBrand = !initialBrand;
      const needCats = initialCategories.length === 0;
      if (needBrand) setLoading(true);

      const [brandData, catsData, ratesData, settingsData] = await Promise.all([
        needBrand ? apiFetch<Brand>(`/brands/${encodeURIComponent(slug)}`) : Promise.resolve(initialBrand),
        needCats ? apiFetch<Category[]>("/categories") : Promise.resolve(null),
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
        if (initialFeaturedProducts.length === 0) {
          const prodRes = await apiFetch<ProductsApiResponse>(
            `/products?brand_id=${encodeURIComponent(brandData.id)}&limit=8&offset=0`
          );
          setFeaturedProducts(prodRes?.products || []);
          setTotalProducts(prodRes?.total ?? brandData.active_product_count ?? 0);
        }

        const candidates = resolveCandidateBlogSlugs(brandData);
        const candidatePosts = await Promise.all(
          candidates.map((candidate) =>
            apiFetch<BlogPostResponse>(`/blog/${encodeURIComponent(candidate)}`)
          )
        );
        const matchedSummary = candidatePosts
          .map(
            (post) =>
              post?.translations?.[safeLang]?.summary ||
              post?.translations?.en?.summary ||
              post?.translations?.tr?.summary
          )
          .find(Boolean);
        if (matchedSummary) {
          setBlogSummary(matchedSummary);
        }
      }
      setLoading(false);
    }
    void loadEditorialPage();
  }, [slug, safeLang, initialBrand, initialCategories.length, initialFeaturedProducts.length]);

  const handleLangChange = (nextLang: string) => {
    const normalized = normalizeSeoLang(nextLang, "tr");
    setLang(normalized);
    const encodedSlug = encodeURIComponent(slug);
    router.push(
      normalized === "tr"
        ? `/ureticiler/${encodedSlug}/tanitim`
        : `/ureticiler/${encodedSlug}/tanitim?lang=${normalized}`
    );
  };

  return (
    <div
      dir={safeLang === "ar" ? "rtl" : "ltr"}
      className="min-h-screen flex flex-col bg-slate-50/60"
    >
      <Header
        lang={safeLang}
        setLang={handleLangChange}
        isLangOpen={isLangOpen}
        setIsLangOpen={setIsLangOpen}
        totalPkgs={totalPkgs}
        setIsCartOpen={(open) => {
          if (open) router.push(`/${getCategoryPrefix(safeLang)}/cart`);
        }}
        setCurrentPage={() => undefined}
        categories={categories}
        activeCategoryId=""
        displayCurrency={displayCurrency}
        onCurrencyChange={setDisplayCurrency}
      />

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <Link
            href={`/ureticiler${langSuffix}`}
            className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-600 hover:text-emerald-700 no-underline"
          >
            <ChevronLeft size={15} />
            <span>{copy.backToDirectory}</span>
          </Link>

          {brand && (
            <div className="inline-flex items-center gap-1.5 p-1 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <Link
                href={`/ureticiler/${encodeURIComponent(slug)}${langSuffix}`}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900 no-underline transition-colors"
              >
                <Package size={14} />
                <span>
                  {copy.tabCollection} ({totalProducts})
                </span>
              </Link>
              <Link
                href={`/ureticiler/${encodeURIComponent(slug)}/tanitim${langSuffix}`}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-extrabold no-underline shadow-xs"
              >
                <BookOpen size={14} />
                <span>{copy.tabStory}</span>
              </Link>
            </div>
          )}
        </div>

        {loading && (
          <div className="py-20 text-center text-sm font-bold text-slate-500">
            {copy.loadingText}
          </div>
        )}

        {!loading && !brand && (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
            <p className="text-base font-extrabold text-slate-800">{copy.notFoundText}</p>
            <Link
              href={`/ureticiler${langSuffix}`}
              className="inline-flex px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold no-underline"
            >
              {copy.goDirectoryBtn}
            </Link>
          </div>
        )}

        {!loading && brand && (
          <>
            <header className="rounded-3xl bg-gradient-to-br from-emerald-50/90 via-white to-amber-50/70 border border-emerald-200/80 p-6 sm:p-10 shadow-xs space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100/90 border border-emerald-200 text-emerald-800 text-xs font-extrabold">
                  <ShieldCheck size={13} />
                  <span>{copy.heroVerifiedBadge}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100/80 border border-amber-200 text-amber-900 text-xs font-bold">
                  <BookOpen size={13} />
                  <span>{copy.heroGuideBadge}</span>
                </span>
              </div>

              <div className="space-y-2 max-w-4xl">
                <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-slate-900 leading-tight">
                  {brand.name} — {copy.heroTitleSuffix}
                </h1>
                <p className="text-xs sm:text-base text-slate-600 leading-relaxed">
                  {brand.name} {copy.heroSubtitleTemplate}
                </p>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                <div className="bg-white/90 rounded-2xl border border-emerald-200/70 p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                    <Package size={20} />
                  </div>
                  <div>
                    <div className="text-base sm:text-lg font-black text-slate-900">
                      {totalProducts}
                      {copy.statModelsSuffix}
                    </div>
                    <div className="text-[11px] font-semibold text-slate-500">
                      {copy.statModelsSub}
                    </div>
                  </div>
                </div>

                <div className="bg-white/90 rounded-2xl border border-amber-200/70 p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                    <Layers size={20} />
                  </div>
                  <div>
                    <div className="text-base sm:text-lg font-black text-slate-900">
                      {copy.statSeriesTitle}
                    </div>
                    <div className="text-[11px] font-semibold text-slate-500">
                      {copy.statSeriesSub}
                    </div>
                  </div>
                </div>

                <div className="bg-white/90 rounded-2xl border border-sky-200/70 p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center shrink-0">
                    <Truck size={20} />
                  </div>
                  <div>
                    <div className="text-base sm:text-lg font-black text-slate-900">
                      {copy.statExportTitle}
                    </div>
                    <div className="text-[11px] font-semibold text-slate-500">
                      {copy.statExportSub}
                    </div>
                  </div>
                </div>

                <div className="bg-white/90 rounded-2xl border border-violet-200/70 p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-700 flex items-center justify-center shrink-0">
                    <MapPin size={20} />
                  </div>
                  <div>
                    <div className="text-base sm:text-lg font-black text-slate-900">
                      {copy.statMerterTitle}
                    </div>
                    <div className="text-[11px] font-semibold text-slate-500">
                      {copy.statMerterSub}
                    </div>
                  </div>
                </div>
              </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-8 space-y-6">
                <EditorialArticleSections
                  brand={brand}
                  blogSummary={blogSummary}
                  copy={copy}
                />

                {featuredProducts.length > 0 && (
                  <section className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-5 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h2 className="text-base sm:text-lg font-black text-slate-900">
                          {brand.name} — {copy.featuredTitleSuffix}
                        </h2>
                        <p className="text-xs text-slate-500">{copy.featuredSub}</p>
                      </div>
                      <Link
                        href={`/ureticiler/${encodeURIComponent(slug)}${langSuffix}`}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold no-underline shrink-0 shadow-xs"
                      >
                        <span>
                          {copy.viewAllBtnPrefix} {totalProducts} {copy.viewAllBtnSuffix}
                        </span>
                        <ArrowRight size={14} />
                      </Link>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                      {featuredProducts.slice(0, 8).map((prod, idx) => (
                        <ProductCard
                          key={prod.id}
                          product={prod}
                          lang={safeLang}
                          priority={idx < 4}
                          displayCurrency={displayCurrency}
                          exchangeRates={exchangeRates}
                          onOpenModal={() => {
                            const target = prod.slug || prod.id;
                            router.push(`/product/${target}${langSuffix}`);
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
                  copy={copy}
                  langSuffix={langSuffix}
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
          lang={safeLang}
          displayCurrency={displayCurrency}
          exchangeRates={exchangeRates}
          onAcceptOfferToCart={() => undefined}
        />
      )}

      <Footer
        lang={safeLang}
        onOpenPolicy={(type) => {
          setPolicyModalType(type);
          setIsPolicyModalOpen(true);
        }}
      />

      <PolicyViewerModal
        isOpen={isPolicyModalOpen}
        onClose={() => {
          setIsPolicyModalOpen(false);
          setPolicyModalType("");
        }}
        policyType={policyModalType}
        lang={safeLang}
      />
    </div>
  );
}
