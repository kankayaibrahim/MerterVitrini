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
  CreditCard,
  Search,
  ChevronLeft,
  Package,
  Lock,
  BookOpen,
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
import InstagramIcon from "@/components/shared/InstagramIcon";
import {
  formatBrandInstagramLabel,
  formatBrandInstagramUrl,
  formatBrandLocationLine,
  formatBrandWebsiteLabel,
  formatBrandWebsiteUrl,
} from "@/utils/brandContactHelpers";
import { isBrandWhatsappOnly, getWhatsappOrderingCopy } from "@/utils/whatsappOrdering";

interface ShowcaseCopy {
  readonly typeManufacturer: string;
  readonly typePrivateLabel: string;
  readonly typeFason: string;
  readonly typeFabric: string;
  readonly typeAccessory: string;
  readonly verifiedBadge: string;
  readonly zeroCommissionSubtitle: string;
  readonly defaultBrandDesc: string;
  readonly storyBtn: string;
  readonly waDirectBtn: string;
  readonly waIntroPrefix: string;
  readonly waIntroBody: string;
  readonly liveChatBtn: string;
  readonly liveChatLoginBtn: string;
  readonly activeProductsSuffix: string;
  readonly privateLabelBadge: string;
  readonly fasonBadge: string;
  readonly minOrderPrefix: string;
  readonly seriesUnit: string;
  readonly exportCountriesPrefix: string;
  readonly directIbanTitle: string;
  readonly bankFallback: string;
  readonly backToDirectory: string;
  readonly tabCollection: string;
  readonly tabStory: string;
  readonly loadingShowcase: string;
  readonly notFoundTitle: string;
  readonly goToDirectoryBtn: string;
  readonly collectionHeadingSuffix: string;
  readonly productCountUnit: string;
  readonly directShipNotePrefix: string;
  readonly searchInBrandPlaceholder: string;
  readonly loadingCollection: string;
  readonly emptyProducts: string;
}

const SHOWCASE_COPY: Record<SupportedSeoLang, ShowcaseCopy> = {
  tr: {
    typeManufacturer: "Üretici & Toptan Satış",
    typePrivateLabel: "Private Label (Özel Üretim)",
    typeFason: "Fason Üretim Atölyesi",
    typeFabric: "Kumaş Toptancısı",
    typeAccessory: "Tekstil Aksesuar & Yan Sanayi",
    verifiedBadge: "Doğrulanmış Merter Üreticisi",
    zeroCommissionSubtitle: "%0 Komisyon Doğrudan Fabrika Çıkış Fiyatları",
    defaultBrandDesc:
      "İstanbul Merter tekstil merkezinde orijinal seri (asorti) paket yapısıyla butik ve mağazalara doğrudan imalatçı fiyatlarıyla toptan koleksiyon sunan doğrulanmış üreticidir.",
    storyBtn: "Firma Hikayesi & Rehberi",
    waDirectBtn: "WhatsApp ile Doğrudan Yaz",
    waIntroPrefix: "Merhaba",
    waIntroBody:
      "Merter Vitrini üzerindeki açık firma vitrininizden doğrudan toptan sipariş / üretim için iletişime geçiyorum.",
    liveChatBtn: "Canlı B2B Sohbet",
    liveChatLoginBtn: "Canlı Sohbet (Üye Girişi)",
    activeProductsSuffix: "Aktif Koleksiyon Ürünü",
    privateLabelBadge: "Private Label (Özel Etiket Üretim)",
    fasonBadge: "Fason Üretim Atölyesi",
    minOrderPrefix: "Min. Sipariş",
    seriesUnit: "Seri",
    exportCountriesPrefix: "İhracat Ülkeleri",
    directIbanTitle: "Doğrudan Tedarikçi Havale / EFT IBAN",
    bankFallback: "Banka",
    backToDirectory: "Tüm Doğrulanmış Merter Üreticileri Rehberine Dön",
    tabCollection: "Koleksiyon & Ürün Vitrini",
    tabStory: "Firma Hikayesi & Rehberi",
    loadingShowcase: "Üretici vitrini yükleniyor...",
    notFoundTitle: "Aradığınız üretici firma bulunamadı.",
    goToDirectoryBtn: "Firma Rehberine Git",
    collectionHeadingSuffix: "Toptan Koleksiyonu",
    productCountUnit: "Ürün",
    directShipNotePrefix: "Tüm ürünler aracısız olarak doğrudan üretici tarafından sevk edilir:",
    searchInBrandPlaceholder: "Bu üreticinin ürünlerinde ara...",
    loadingCollection: "Üretici koleksiyonu yükleniyor...",
    emptyProducts: "Bu arama kriterine uygun ürün bulunamadı.",
  },
  en: {
    typeManufacturer: "Manufacturer & Wholesaler",
    typePrivateLabel: "Private Label (OEM)",
    typeFason: "Contract Sewing Workshop",
    typeFabric: "Wholesale Fabric Mill",
    typeAccessory: "Textile Accessories",
    verifiedBadge: "Verified Merter Manufacturer",
    zeroCommissionSubtitle: "0% Commission Direct Factory Wholesale Prices",
    defaultBrandDesc:
      "is a verified Merter Istanbul apparel manufacturer supplying boutiques and retail chains worldwide with assorted size-run packs at factory-direct prices.",
    storyBtn: "Factory Profile & Guide",
    waDirectBtn: "Chat Directly on WhatsApp",
    waIntroPrefix: "Hello",
    waIntroBody:
      "I am contacting your showroom via Merter Vitrini for a direct B2B wholesale / production inquiry.",
    liveChatBtn: "Live B2B Chat",
    liveChatLoginBtn: "Live B2B Chat (Sign In)",
    activeProductsSuffix: "Active Wholesale Models",
    privateLabelBadge: "Private Label (OEM Production)",
    fasonBadge: "Contract Sewing (CMT)",
    minOrderPrefix: "Min. Order",
    seriesUnit: "Packs",
    exportCountriesPrefix: "Export Markets",
    directIbanTitle: "Direct Manufacturer Wire IBAN",
    bankFallback: "Bank",
    backToDirectory: "Back to Verified Merter Manufacturers Directory",
    tabCollection: "Wholesale Collection",
    tabStory: "Factory Story & B2B Guide",
    loadingShowcase: "Loading manufacturer showroom...",
    notFoundTitle: "Manufacturer profile not found.",
    goToDirectoryBtn: "Browse Manufacturers Directory",
    collectionHeadingSuffix: "Wholesale Collection",
    productCountUnit: "Models",
    directShipNotePrefix: "All size-run packs ship directly from verified factory:",
    searchInBrandPlaceholder: "Search this manufacturer's catalog...",
    loadingCollection: "Loading manufacturer catalog...",
    emptyProducts: "No wholesale models match your search.",
  },
  ru: {
    typeManufacturer: "Фабрика и оптовая продажа",
    typePrivateLabel: "Private Label (СТМ)",
    typeFason: "Швейный цех (Фасон)",
    typeFabric: "Опт тканей",
    typeAccessory: "Швейная фурнитура",
    verifiedBadge: "Проверенная фабрика Мертера",
    zeroCommissionSubtitle: "0% комиссии • Оптовые цены напрямую с фабрики",
    defaultBrandDesc:
      "— проверенная швейная фабрика в районе Мертер (Стамбул), поставляющая оптовые коллекции размерными рядами напрямую бутикам и сетям.",
    storyBtn: "О фабрике и гид по закупке",
    waDirectBtn: "Написать в WhatsApp фабрики",
    waIntroPrefix: "Здравствуйте,",
    waIntroBody:
      "Пишу вам напрямую через открытую витрину Merter Vitrini по вопросу оптового заказа.",
    liveChatBtn: "Онлайн B2B-чат",
    liveChatLoginBtn: "B2B-чат (Вход)",
    activeProductsSuffix: "активных моделей",
    privateLabelBadge: "Пошив под вашим брендом (СТМ)",
    fasonBadge: "Контрактный пошив",
    minOrderPrefix: "Мин. заказ",
    seriesUnit: "серий",
    exportCountriesPrefix: "Страны экспорта",
    directIbanTitle: "Прямой банковский счет IBAN фабрики",
    bankFallback: "Банк",
    backToDirectory: "Ко всем проверенным фабрикам Мертера",
    tabCollection: "Оптовая коллекция",
    tabStory: "О фабрике и B2B-гид",
    loadingShowcase: "Загрузка витрины фабрики...",
    notFoundTitle: "Фабрика не найдена.",
    goToDirectoryBtn: "Перейти в каталог фабрик",
    collectionHeadingSuffix: "Оптовый каталог",
    productCountUnit: "мод.",
    directShipNotePrefix: "Отгрузка напрямую со склада производителя без посредников:",
    searchInBrandPlaceholder: "Поиск по моделям этой фабрики...",
    loadingCollection: "Загрузка моделей фабрики...",
    emptyProducts: "По вашему запросу модели не найдены.",
  },
  ar: {
    typeManufacturer: "مصنع وبيع بالجملة",
    typePrivateLabel: "تصنيع خاص (Private Label)",
    typeFason: "مشغل خياطة فاصون",
    typeFabric: "تجارة الأقمشة بالجملة",
    typeAccessory: "إكسسوارات النسيج",
    verifiedBadge: "مصنع معتمد في مارتر",
    zeroCommissionSubtitle: "0% عمولة • أسعار المصنع مباشرة بدون وسطاء",
    defaultBrandDesc:
      "مصنع ملابس معتمد في مركز مارتر إسطنبول يقدم تشكيلات الجملة بنظام السيري والباكيدج مباشرة للمتاجر والبوتيكات.",
    storyBtn: "ملف المصنع ودليل الشراء",
    waDirectBtn: "تواصل مباشرة عبر واتساب",
    waIntroPrefix: "مرحباً",
    waIntroBody: "أتواصل معكم مباشرة عبر معرض Merter Vitrini بخصوص طلب جملة / تصنيع.",
    liveChatBtn: "محادثة B2B مباشرة",
    liveChatLoginBtn: "محادثة مباشرة (تسجيل الدخول)",
    activeProductsSuffix: "موديل متاح بالجملة",
    privateLabelBadge: "تصنيع للعلامات الخاصة (Private Label)",
    fasonBadge: "تشغيل فاصون",
    minOrderPrefix: "الحد الأدنى للطلب",
    seriesUnit: "سيري",
    exportCountriesPrefix: "أسواق التصدير",
    directIbanTitle: "حساب التحويل البنكي المباشر للمصنع (IBAN)",
    bankFallback: "البنك",
    backToDirectory: "العودة إلى دليل مصانع مارتر المعتمدة",
    tabCollection: "تشكيلة ومنتجات المصنع",
    tabStory: "قصة المصنع ودليل الجملة",
    loadingShowcase: "جاري تحميل معرض المصنع...",
    notFoundTitle: "لم يتم العثور على المصنع المطلوب.",
    goToDirectoryBtn: "الانتقال إلى دليل المصانع",
    collectionHeadingSuffix: "كتالوج الجملة",
    productCountUnit: "موديل",
    directShipNotePrefix: "يتم شحن جميع الطلبيات مباشرة دون وسطاء من مصنع:",
    searchInBrandPlaceholder: "ابحث ضمن منتجات هذا المصنع...",
    loadingCollection: "جاري تحميل تشكيلة المصنع...",
    emptyProducts: "لا توجد منتجات مطابقة لبحثك.",
  },
  de: {
    typeManufacturer: "Hersteller & Großhandel",
    typePrivateLabel: "Private Label (Eigenmarke)",
    typeFason: "Lohnfertigung (CMT)",
    typeFabric: "Stoffgroßhandel",
    typeAccessory: "Textilzubehör",
    verifiedBadge: "Geprüfter Merter-Hersteller",
    zeroCommissionSubtitle: "0% Provision • Direkte B2B-Werkspreise",
    defaultBrandDesc:
      "ist ein geprüfter Textilhersteller in Merter Istanbul mit sortierten Größenserien direkt ab Werk für Boutiquen und Modehändler.",
    storyBtn: "Firmenprofil & Einkaufsführer",
    waDirectBtn: "Direkt per WhatsApp schreiben",
    waIntroPrefix: "Guten Tag",
    waIntroBody:
      "ich kontaktiere Sie über Merter Vitrini bezüglich einer direkten B2B-Großhandelsbestellung.",
    liveChatBtn: "Live B2B-Chat",
    liveChatLoginBtn: "Live-Chat (Anmelden)",
    activeProductsSuffix: "Aktive Kollektionsmodelle",
    privateLabelBadge: "Private-Label-Fertigung",
    fasonBadge: "Lohnfertigung",
    minOrderPrefix: "Mindestbestellung",
    seriesUnit: "Serien",
    exportCountriesPrefix: "Exportländer",
    directIbanTitle: "Direkte Hersteller-IBAN",
    bankFallback: "Bank",
    backToDirectory: "Zurück zum Merter-Herstellerverzeichnis",
    tabCollection: "Kollektion & Produkte",
    tabStory: "Firmenprofil & Ratgeber",
    loadingShowcase: "Hersteller-Showroom wird geladen...",
    notFoundTitle: "Hersteller wurde nicht gefunden.",
    goToDirectoryBtn: "Zum Herstellerverzeichnis",
    collectionHeadingSuffix: "Großhandelskollektion",
    productCountUnit: "Modelle",
    directShipNotePrefix: "Alle Serienpakete werden direkt ab Werk versendet von:",
    searchInBrandPlaceholder: "In den Produkten dieses Herstellers suchen...",
    loadingCollection: "Kollektion wird geladen...",
    emptyProducts: "Keine passenden Produkte gefunden.",
  },
  fr: {
    typeManufacturer: "Fabricant & Grossiste",
    typePrivateLabel: "Private Label (Marque blanche)",
    typeFason: "Atelier à façon",
    typeFabric: "Grossiste tissus",
    typeAccessory: "Accessoires textiles",
    verifiedBadge: "Fabricant vérifié de Merter",
    zeroCommissionSubtitle: "0% de commission • Prix directs sortie d’usine",
    defaultBrandDesc:
      "est un fabricant de prêt-à-porter vérifié à Merter Istanbul proposant des lots par séries de tailles assorties au prix d’usine.",
    storyBtn: "Profil & Guide d’achat",
    waDirectBtn: "Écrire sur WhatsApp",
    waIntroPrefix: "Bonjour",
    waIntroBody:
      "je vous contacte depuis votre vitrine Merter Vitrini pour une commande B2B en gros.",
    liveChatBtn: "Chat B2B en direct",
    liveChatLoginBtn: "Chat en direct (Connexion)",
    activeProductsSuffix: "Modèles actifs en gros",
    privateLabelBadge: "Fabrication Private Label",
    fasonBadge: "Atelier de façonnage",
    minOrderPrefix: "Commande min.",
    seriesUnit: "Séries",
    exportCountriesPrefix: "Pays d’export",
    directIbanTitle: "IBAN direct du fabricant",
    bankFallback: "Banque",
    backToDirectory: "Retour à l’annuaire des fabricants de Merter",
    tabCollection: "Collection & Produits",
    tabStory: "Histoire & Guide B2B",
    loadingShowcase: "Chargement de la vitrine fabricant...",
    notFoundTitle: "Fabricant introuvable.",
    goToDirectoryBtn: "Voir l’annuaire des fabricants",
    collectionHeadingSuffix: "Collection en Gros",
    productCountUnit: "Modèles",
    directShipNotePrefix: "Expédition directe sans intermédiaire par le fabricant :",
    searchInBrandPlaceholder: "Rechercher dans le catalogue de ce fabricant...",
    loadingCollection: "Chargement de la collection...",
    emptyProducts: "Aucun modèle ne correspond à votre recherche.",
  },
  pl: {
    typeManufacturer: "Producent i hurtownia",
    typePrivateLabel: "Private Label (Marka własna)",
    typeFason: "Szwalnia usługowa",
    typeFabric: "Hurtownia tkanin",
    typeAccessory: "Dodatki krawieckie",
    verifiedBadge: "Zweryfikowany producent Merter",
    zeroCommissionSubtitle: "0% prowizji • Bezpośrednie ceny fabryczne",
    defaultBrandDesc:
      "to zweryfikowany producent odzieży w Merter Stambuł dostarczający pełne serie rozmiarowe w cenach fabrycznych dla butików i hurtowników.",
    storyBtn: "Profil firmy i poradnik",
    waDirectBtn: "Napisz bezpośrednio na WhatsApp",
    waIntroPrefix: "Dzień dobry",
    waIntroBody:
      "kontaktuję się przez wizytówkę Merter Vitrini w sprawie zamówienia hurtowego B2B.",
    liveChatBtn: "Czat B2B na żywo",
    liveChatLoginBtn: "Czat B2B (Zaloguj się)",
    activeProductsSuffix: "Aktywnych modeli hurtowych",
    privateLabelBadge: "Produkcja Private Label",
    fasonBadge: "Szycie usługowe",
    minOrderPrefix: "Min. zamówienie",
    seriesUnit: "Paczek",
    exportCountriesPrefix: "Kraje eksportu",
    directIbanTitle: "Bezpośredni rachunek IBAN producenta",
    bankFallback: "Bank",
    backToDirectory: "Wróć do katalogu producentów Merter",
    tabCollection: "Kolekcja i produkty",
    tabStory: "Historia firmy i poradnik",
    loadingShowcase: "Ładowanie wizytówki producenta...",
    notFoundTitle: "Nie znaleziono producenta.",
    goToDirectoryBtn: "Przejdź do katalogu firm",
    collectionHeadingSuffix: "Kolekcja Hurtowa",
    productCountUnit: "Modeli",
    directShipNotePrefix: "Wszystkie pakiety wysyłane są bezpośrednio z fabryki:",
    searchInBrandPlaceholder: "Szukaj w produktach tego producenta...",
    loadingCollection: "Ładowanie kolekcji producenta...",
    emptyProducts: "Brak produktów spełniających kryteria.",
  },
  bg: {
    typeManufacturer: "Производител и търговец на едро",
    typePrivateLabel: "Private Label производство",
    typeFason: "Цех за ишлеме",
    typeFabric: "Платове на едро",
    typeAccessory: "Шивашки аксесоари",
    verifiedBadge: "Проверен производител от Мертер",
    zeroCommissionSubtitle: "0% комисиона • Директни фабрични цени",
    defaultBrandDesc:
      "е проверен производител на облекло в Мертер Истанбул, доставящ колекции на серии на фабрични цени за бутици и търговци.",
    storyBtn: "Профил и ръководство",
    waDirectBtn: "Пишете директно в WhatsApp",
    waIntroPrefix: "Здравейте",
    waIntroBody:
      "свързвам се с вас чрез витрината ви в Merter Vitrini относно поръчка на едро.",
    liveChatBtn: "B2B чат на живо",
    liveChatLoginBtn: "Чат на живо (Вход)",
    activeProductsSuffix: "Активни модела на едро",
    privateLabelBadge: "Private Label (Собствен етикет)",
    fasonBadge: "Производство на ишлеме",
    minOrderPrefix: "Мин. поръчка",
    seriesUnit: "Серии",
    exportCountriesPrefix: "Пазари за износ",
    directIbanTitle: "Директен IBAN на производителя",
    bankFallback: "Банка",
    backToDirectory: "Обратно към каталога на производителите в Мертер",
    tabCollection: "Колекция и продукти",
    tabStory: "История и B2B ръководство",
    loadingShowcase: "Зареждане на витрината на производителя...",
    notFoundTitle: "Производителят не е намерен.",
    goToDirectoryBtn: "Към каталога на фирмите",
    collectionHeadingSuffix: "Колекция на едро",
    productCountUnit: "Модела",
    directShipNotePrefix: "Всички серии се изпращат директно без посредник от:",
    searchInBrandPlaceholder: "Търсене сред моделите на този производител...",
    loadingCollection: "Зареждане на колекцията...",
    emptyProducts: "Няма намерени продукти по това търсене.",
  },
};

function getCompanyLabel(companyType: string | undefined, copy: ShowcaseCopy): string {
  switch (companyType) {
    case "private_label":
      return copy.typePrivateLabel;
    case "fason_atolye":
      return copy.typeFason;
    case "kumas_tedarikcisi":
      return copy.typeFabric;
    case "aksesuar":
      return copy.typeAccessory;
    default:
      return copy.typeManufacturer;
  }
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

interface ProductsApiResponse {
  products?: Product[];
  total?: number;
}

interface SupplierProfileBannerProps {
  readonly brand: Brand;
  readonly totalProducts: number;
  readonly isMemberLoggedIn: boolean;
  readonly copy: ShowcaseCopy;
  readonly langSuffix: string;
  readonly onOpenChat: () => void;
}

function SupplierProfileBanner({
  brand,
  totalProducts,
  isMemberLoggedIn,
  copy,
  langSuffix,
  onOpenChat,
}: SupplierProfileBannerProps) {
  const companyLabel = getCompanyLabel(brand.company_type, copy);
  const waRaw = brand.whatsapp_phone || brand.phone || "";
  const callRaw = brand.phone || brand.whatsapp_phone || "";
  const waDigits = normalizeWaPhone(waRaw);
  const waMessage = `${copy.waIntroPrefix} *${brand.name}*,\n${copy.waIntroBody}`;
  const waUrl = waDigits
    ? `https://wa.me/${waDigits}?text=${encodeURIComponent(waMessage)}`
    : "";

  return (
    <div className="bg-[#F8F6F2] rounded-lg border border-[#E5E0D8] shadow-xs p-6 sm:p-8 space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-lg bg-white border border-[#E5E0D8] text-[#1C1C1C] flex items-center justify-center shrink-0">
            <Building2 size={28} />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-[#1C1C1C]">{brand.name}</h1>
              {(brand.is_verified ?? true) && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-[#15803D] border border-emerald-200 text-xs font-extrabold">
                  <ShieldCheck size={13} />
                  <span>{copy.verifiedBadge}</span>
                </span>
              )}
              {isBrandWhatsappOnly(brand) && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0] text-xs font-extrabold">
                  <MessageCircle size={13} />
                  <span>
                    {getWhatsappOrderingCopy(
                      langSuffix.match(/lang=([a-z]+)/i)?.[1] || "tr"
                    ).supplierBadge}
                  </span>
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm font-bold text-[#525252]">
              {companyLabel} • {copy.zeroCommissionSubtitle}
            </p>
            <p className="text-xs sm:text-sm text-[#525252] max-w-3xl leading-relaxed pt-1">
              {brand.description || `${brand.name} ${copy.defaultBrandDesc}`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Link
            href={`/ureticiler/${encodeURIComponent(brand.slug || brand.id)}/tanitim${langSuffix}`}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-white hover:bg-[#EFECE6] text-[#1C1C1C] border border-[#D6D1C7] hover:border-[#1C1C1C] text-xs font-extrabold no-underline transition-colors"
          >
            <BookOpen size={15} className="text-[#8C6D3F]" />
            <span>{copy.storyBtn}</span>
          </Link>

          {waUrl && (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                trackBrandEvent(brand.id, "whatsapp_click", "", {
                  source_surface: "supplier_showcase",
                  target_phone: waRaw,
                })
              }
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-[#15803D] hover:bg-[#166534] text-white text-xs font-extrabold no-underline transition-colors shadow-xs"
            >
              <MessageCircle size={16} />
              <span>{copy.waDirectBtn}</span>
            </a>
          )}

          <button
            type="button"
            onClick={isMemberLoggedIn ? onOpenChat : () => openStoreAuthModal("login")}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-[#1C1C1C] hover:bg-[#333333] text-white text-xs font-extrabold cursor-pointer border-none transition-colors shadow-xs"
          >
            {isMemberLoggedIn ? (
              <>
                <Building2 size={15} />
                <span>{copy.liveChatBtn}</span>
              </>
            ) : (
              <>
                <Lock size={14} />
                <span>{copy.liveChatLoginBtn}</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-2 border-t border-[#E5E0D8]">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-white border border-[#E5E0D8] text-[#1C1C1C] text-xs font-extrabold">
          <Package size={13} className="text-[#8C6D3F]" />
          <span>
            {totalProducts} {copy.activeProductsSuffix}
          </span>
        </span>
        {brand.supports_private_label && (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-white text-[#1C1C1C] border border-[#E5E0D8] text-xs font-bold">
            <CheckCircle2 size={13} className="text-[#8C6D3F]" />
            <span>{copy.privateLabelBadge}</span>
          </span>
        )}
        {brand.supports_fason && (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-white text-[#1C1C1C] border border-[#E5E0D8] text-xs font-bold">
            <CheckCircle2 size={13} className="text-[#8C6D3F]" />
            <span>{copy.fasonBadge}</span>
          </span>
        )}
        {(brand.min_order_quantity ?? 1) > 1 && (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-white border border-[#E5E0D8] text-[#525252] text-xs font-bold">
            <span>
              {copy.minOrderPrefix}: {brand.min_order_quantity} {copy.seriesUnit}
            </span>
          </span>
        )}
        {brand.export_countries && (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-white text-[#525252] border border-[#E5E0D8] text-xs font-bold">
            <span>
              {copy.exportCountriesPrefix}: {brand.export_countries}
            </span>
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-3 border-t border-[#E5E0D8] text-xs text-[#525252]">
        {(brand.location_address || brand.city || brand.district) && (
          <div className="flex items-start gap-2">
            <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
            <span>
              {formatBrandLocationLine(brand.location_address, brand.district, brand.city)}
            </span>
          </div>
        )}
        {callRaw && (
          <div className="flex items-center gap-2">
            <Phone size={14} className="text-slate-400 shrink-0" />
            <a
              href={`tel:${callRaw}`}
              className="font-bold text-[#1C1C1C] hover:underline no-underline"
            >
              Tel: {callRaw}
            </a>
          </div>
        )}
        {brand.landline_phone && brand.landline_phone !== callRaw && (
          <div className="flex items-center gap-2">
            <Phone size={14} className="text-slate-400 shrink-0" />
            <a
              href={`tel:${brand.landline_phone}`}
              className="font-bold text-[#1C1C1C] hover:underline no-underline"
            >
              Sabit: {brand.landline_phone}
            </a>
          </div>
        )}
        {brand.public_email && (
          <div className="flex items-center gap-2">
            <Mail size={14} className="text-slate-400 shrink-0" />
            <a
              href={`mailto:${brand.public_email}`}
              className="font-semibold text-[#525252] hover:text-[#1C1C1C] no-underline truncate"
            >
              {brand.public_email}
            </a>
          </div>
        )}
        {formatBrandWebsiteUrl(brand.website) && (
          <div className="flex items-center gap-2">
            <Globe size={14} className="text-slate-400 shrink-0" />
            <a
              href={formatBrandWebsiteUrl(brand.website)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[#525252] hover:text-[#1C1C1C] no-underline truncate"
            >
              {formatBrandWebsiteLabel(brand.website)}
            </a>
          </div>
        )}
        {formatBrandInstagramUrl(brand.instagram_handle) && (
          <div className="flex items-center gap-2">
            <InstagramIcon size={14} className="text-rose-600 shrink-0" />
            <a
              href={formatBrandInstagramUrl(brand.instagram_handle)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-[#1C1C1C] hover:text-rose-700 no-underline truncate"
            >
              {formatBrandInstagramLabel(brand.instagram_handle)}
            </a>
          </div>
        )}
      </div>

      {brand.iban && (
        <div className="bg-white rounded-md p-3 border border-[#E5E0D8] text-xs flex flex-wrap items-center gap-2">
          <CreditCard size={14} className="text-[#8C6D3F] shrink-0" />
          <span className="font-bold text-[#1C1C1C]">
            {copy.directIbanTitle} ({brand.bank_name || copy.bankFallback}
            {brand.bank_account_holder ? ` • ${brand.bank_account_holder}` : ""}):
          </span>
          <span className="font-mono font-extrabold text-[#1C1C1C] select-all">{brand.iban}</span>
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
  readonly copy: ShowcaseCopy;
  readonly onSelectProduct: (product: Product) => void;
}

function ShowcaseProductsGrid({
  loading,
  products,
  lang,
  displayCurrency,
  exchangeRates,
  copy,
  onSelectProduct,
}: ShowcaseProductsGridProps) {
  if (loading) {
    return (
      <div className="py-16 text-center text-sm font-bold text-slate-500">
        {copy.loadingCollection}
      </div>
    );
  }
  if (products.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-sm font-bold text-slate-600">
        {copy.emptyProducts}
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
  readonly initialLang?: SupportedSeoLang;
  readonly initialBrand?: Brand | null;
  readonly initialProducts?: readonly Product[];
  readonly initialTotalProducts?: number;
  readonly initialCategories?: readonly Category[];
}

export default function SupplierShowcaseClient({
  slug,
  initialLang = "tr",
  initialBrand = null,
  initialProducts = [],
  initialTotalProducts = 0,
  initialCategories = [],
}: SupplierShowcaseClientProps) {
  const router = useRouter();
  const isMemberLoggedIn = useIsStoreMemberLoggedIn();
  const [lang, setLang] = useState<string>(initialLang);
  const [isLangOpen, setIsLangOpen] = useState<boolean>(false);
  const [displayCurrency, setDisplayCurrency] = useState<string>("TRY");
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);
  const [categories, setCategories] = useState<Category[]>([...initialCategories]);
  const [brand, setBrand] = useState<Brand | null>(initialBrand);
  const [products, setProducts] = useState<Product[]>([...initialProducts]);
  const [totalProducts, setTotalProducts] = useState<number>(initialTotalProducts);
  const [loadingBrand, setLoadingBrand] = useState<boolean>(!initialBrand);
  const [loadingProducts, setLoadingProducts] = useState<boolean>(
    Boolean(!initialBrand || (initialProducts.length === 0 && initialTotalProducts > 0))
  );
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState<boolean>(false);
  const [policyModalType, setPolicyModalType] = useState<
    "cancellation_and_return" | "terms_of_service" | "privacy_policy" | ""
  >("");

  const safeLang = normalizeSeoLang(lang, "tr");
  const copy = SHOWCASE_COPY[safeLang];
  const langSuffix = safeLang === "tr" ? "" : `?lang=${safeLang}`;

  const totalPkgs = useSyncExternalStore(
    subscribeStore,
    getCartPkgsSnapshot,
    getCartPkgsServerSnapshot
  );

  useEffect(() => {
    async function loadInitial() {
      const needBrand = !initialBrand;
      const needCats = initialCategories.length === 0;
      if (needBrand) setLoadingBrand(true);

      const [brandData, catsData, ratesData, settingsData] = await Promise.all([
        needBrand ? apiFetch<Brand>(`/brands/${encodeURIComponent(slug)}`) : Promise.resolve(null),
        needCats ? apiFetch<Category[]>("/categories") : Promise.resolve(null),
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
  }, [slug, initialBrand, initialCategories.length]);

  const isSupplierWhatsappOnly = isBrandWhatsappOnly(brand);

  useEffect(() => {
    if (!brand?.id) return;
    const brandId: string = brand.id;
    const trimmed = searchQuery.trim();
    let cancelled = false;

    async function loadSupplierProducts() {
      await Promise.resolve();
      if (cancelled) return;

      const ssrHasPrices =
        initialProducts.some((p) => Number(p.price) > 0) ||
        isSupplierWhatsappOnly;
      if (
        !trimmed &&
        initialProducts.length > 0 &&
        brandId === initialBrand?.id &&
        (!isMemberLoggedIn || ssrHasPrices)
      ) {
        setProducts([...initialProducts]);
        setTotalProducts(initialTotalProducts);
        setLoadingProducts(false);
        return;
      }

      setLoadingProducts(true);
      let query = `/products?brand_id=${encodeURIComponent(brandId)}&limit=48&offset=0`;
      if (trimmed) {
        query += `&search=${encodeURIComponent(trimmed)}`;
      }
      const res = await apiFetch<ProductsApiResponse>(query);
      if (cancelled) return;
      setProducts(res?.products || []);
      setTotalProducts(res?.total ?? brand?.active_product_count ?? 0);
      setLoadingProducts(false);
    }

    void loadSupplierProducts();
    return () => {
      cancelled = true;
    };
  }, [
    brand?.id,
    brand?.active_product_count,
    isSupplierWhatsappOnly,
    searchQuery,
    initialProducts,
    initialTotalProducts,
    initialBrand?.id,
    isMemberLoggedIn,
  ]);

  const handleLangChange = (nextLang: string) => {
    const normalized = normalizeSeoLang(nextLang, "tr");
    setLang(normalized);
    const encodedSlug = encodeURIComponent(slug);
    router.push(
      normalized === "tr"
        ? `/ureticiler/${encodedSlug}`
        : `/ureticiler/${encodedSlug}?lang=${normalized}`
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
        setCurrentPage={() => {}}
        categories={categories}
        activeCategoryId=""
        displayCurrency={displayCurrency}
        onCurrencyChange={setDisplayCurrency}
      />

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <Link
            href={`/ureticiler${langSuffix}`}
            className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#525252] hover:text-[#1C1C1C] no-underline"
          >
            <ChevronLeft size={15} className="rtl:rotate-180" />
            <span>{copy.backToDirectory}</span>
          </Link>

          {brand && (
            <div className="inline-flex items-center gap-1.5 p-1 rounded-lg bg-white border border-[#E5E0D8] shadow-2xs">
              <Link
                href={`/ureticiler/${encodeURIComponent(slug)}${langSuffix}`}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-[#1C1C1C] text-white text-xs font-extrabold no-underline shadow-xs"
              >
                <Package size={14} />
                <span>
                  {copy.tabCollection} ({totalProducts})
                </span>
              </Link>
              <Link
                href={`/ureticiler/${encodeURIComponent(slug)}/tanitim${langSuffix}`}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-bold text-[#525252] hover:text-[#1C1C1C] no-underline transition-colors"
              >
                <BookOpen size={14} />
                <span>{copy.tabStory}</span>
              </Link>
            </div>
          )}
        </div>

        {loadingBrand && (
          <div className="py-20 text-center text-sm font-bold text-slate-500">
            {copy.loadingShowcase}
          </div>
        )}

        {!loadingBrand && !brand && (
          <div className="bg-white rounded-lg border border-[#E5E0D8] p-12 text-center space-y-3">
            <p className="text-base font-extrabold text-[#1C1C1C]">{copy.notFoundTitle}</p>
            <Link
              href={`/ureticiler${langSuffix}`}
              className="inline-flex px-4 py-2 rounded-md bg-[#1C1C1C] text-white text-xs font-bold no-underline"
            >
              {copy.goToDirectoryBtn}
            </Link>
          </div>
        )}

        {!loadingBrand && brand && (
          <>
            <SupplierProfileBanner
              brand={brand}
              totalProducts={totalProducts}
              isMemberLoggedIn={isMemberLoggedIn}
              copy={copy}
              langSuffix={langSuffix}
              onOpenChat={() => setIsChatOpen(true)}
            />

            <div className="bg-white rounded-lg border border-[#E5E0D8] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-[#1C1C1C]">
                  {brand.name} — {copy.collectionHeadingSuffix} ({totalProducts}{" "}
                  {copy.productCountUnit})
                </h2>
                <p className="text-xs text-[#525252]">
                  {copy.directShipNotePrefix} {brand.name}
                </p>
              </div>

              <div className="relative w-full sm:w-80">
                <Search
                  size={15}
                  className="absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={copy.searchInBrandPlaceholder}
                  className="w-full ps-9 pe-3.5 py-2 rounded-md border border-[#D6D1C7] text-xs focus:outline-none focus:border-[#1C1C1C]"
                />
              </div>
            </div>

            <ShowcaseProductsGrid
              loading={loadingProducts}
              products={products}
              lang={safeLang}
              displayCurrency={displayCurrency}
              exchangeRates={exchangeRates}
              copy={copy}
              onSelectProduct={(prod) => {
                const target = prod.slug || prod.id;
                router.push(`/product/${target}${langSuffix}`);
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
          lang={safeLang}
          displayCurrency={displayCurrency}
          exchangeRates={exchangeRates}
          onAcceptOfferToCart={() => {}}
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
