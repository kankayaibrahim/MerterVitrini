"use client";

import React, { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  ShieldCheck,
  Search,
  MapPin,
  Phone,
  MessageCircle,
  Mail,
  Globe,
  CheckCircle2,
  Package,
  ArrowRight,
  CreditCard,
  BookOpen,
} from "lucide-react";
import { Brand, Category } from "@/types/store";
import { getCategoryPrefix } from "@/app/i18n";
import { apiFetch } from "@/app/utils";
import { syncShowPricesToGuestsSetting } from "@/app/storeAuth";
import Header from "@/components/store/Header";
import Footer from "@/components/store/Footer";
import PolicyViewerModal from "@/components/store/PolicyViewerModal";
import { SupportedSeoLang, normalizeSeoLang } from "@/utils/seoHelpers";

interface DirectoryLocaleCopy {
  readonly heroBadge: string;
  readonly heroTitle: string;
  readonly heroDesc: string;
  readonly applyBtn: string;
  readonly portalLoginBtn: string;
  readonly searchPlaceholder: string;
  readonly filterPrivateLabel: string;
  readonly filterFason: string;
  readonly typeAll: string;
  readonly typeManufacturer: string;
  readonly typePrivateLabel: string;
  readonly typeFason: string;
  readonly typeFabric: string;
  readonly typeAccessory: string;
  readonly verifiedBadge: string;
  readonly zeroCommission: string;
  readonly productCountSuffix: string;
  readonly originalSeriesBadge: string;
  readonly exportPrefix: string;
  readonly defaultExportRegions: string;
  readonly defaultAddress: string;
  readonly defaultBrandDescSuffix: string;
  readonly directIbanLabel: string;
  readonly bankFallback: string;
  readonly collectionBtn: string;
  readonly storyGuideBtn: string;
  readonly loadingText: string;
  readonly emptyText: string;
  readonly resetFiltersBtn: string;
}

const DIRECTORY_COPY: Record<SupportedSeoLang, DirectoryLocaleCopy> = {
  tr: {
    heroBadge: "AÇIK ÜRETİCİ VİTRİNİ • %0 KOMİSYON DOĞRUDAN TİCARET",
    heroTitle: "Merter Doğrulanmış Üretici & Toptan Giyim Firmaları Rehberi",
    heroDesc:
      "Merter tekstil merkezindeki üretici, toptancı, Private Label ve fason üretim firmalarının açık iletişim, WhatsApp, mağaza adresi ve doğrudan fabrika çıkış koleksiyonlarına aracısız ulaşın.",
    applyBtn: "Üretici Olarak Yerinizi Alın (Ücretsiz)",
    portalLoginBtn: "Tedarikçi Portalı Girişi",
    searchPlaceholder: "Firma adı, Merter adresi, ihracat ülkesi veya üretim alanı ara...",
    filterPrivateLabel: "Private Label (Özel Etiket)",
    filterFason: "Fason Üretim Yapanlar",
    typeAll: "Tüm Firmalar",
    typeManufacturer: "Üretici & Toptan Satış",
    typePrivateLabel: "Private Label (Özel Üretim)",
    typeFason: "Fason Üretim Atölyesi",
    typeFabric: "Kumaş Toptancısı",
    typeAccessory: "Tekstil Aksesuar & Yan Sanayi",
    verifiedBadge: "Doğrulanmış Üretici",
    zeroCommission: "%0 Komisyon Doğrudan Ticaret",
    productCountSuffix: "Ürün",
    originalSeriesBadge: "Orijinal Seri (Asorti Paket)",
    exportPrefix: "İhracat",
    defaultExportRegions: "Avrupa, Balkanlar, BDT & Körfez",
    defaultAddress: "Merter Tekstil Merkezi, Güngören / İstanbul",
    defaultBrandDescSuffix:
      "İstanbul Merter tekstil merkezinde orijinal seri (asorti) paket yapısıyla butik ve mağazalara doğrudan imalatçı fiyatlarıyla toptan koleksiyon sunan doğrulanmış üreticidir.",
    directIbanLabel: "Doğrudan Havale IBAN",
    bankFallback: "Banka",
    collectionBtn: "Koleksiyon & Ürünler",
    storyGuideBtn: "Firma Hikayesi & Rehber",
    loadingText: "Doğrulanmış Merter üretici firmaları yükleniyor...",
    emptyText: "Arama kriterlerinize uygun üretici firma bulunamadı.",
    resetFiltersBtn: "Filtreleri Temizle",
  },
  en: {
    heroBadge: "OPEN MANUFACTURER SHOWROOM • 0% COMMISSION DIRECT B2B TRADE",
    heroTitle: "Verified Merter Clothing Manufacturers & Wholesale Suppliers Directory",
    heroDesc:
      "Access direct WhatsApp lines, Merter showroom addresses, Private Label OEM capabilities, and factory-direct size-run collections from verified Istanbul apparel manufacturers.",
    applyBtn: "List Your Factory (Free)",
    portalLoginBtn: "Supplier Portal Login",
    searchPlaceholder: "Search manufacturer name, Merter address, export market, or specialty...",
    filterPrivateLabel: "Private Label (OEM)",
    filterFason: "CMT / Contract Sewing",
    typeAll: "All Manufacturers",
    typeManufacturer: "Manufacturer & Wholesaler",
    typePrivateLabel: "Private Label (OEM)",
    typeFason: "Contract Sewing Workshop",
    typeFabric: "Wholesale Fabric Mill",
    typeAccessory: "Trims & Textile Accessories",
    verifiedBadge: "Verified Factory",
    zeroCommission: "0% Commission Direct Factory",
    productCountSuffix: "Models",
    originalSeriesBadge: "Assorted Size-Run Packs",
    exportPrefix: "Exports",
    defaultExportRegions: "EU, UK, CIS, Balkans & GCC",
    defaultAddress: "Merter Textile District, Güngören / Istanbul",
    defaultBrandDescSuffix:
      "is a verified Merter Istanbul apparel manufacturer supplying boutiques and retail chains with assorted size-run packs at direct factory prices.",
    directIbanLabel: "Direct Supplier IBAN",
    bankFallback: "Bank",
    collectionBtn: "Collection & Catalog",
    storyGuideBtn: "Factory Profile & Guide",
    loadingText: "Loading verified Merter clothing manufacturers...",
    emptyText: "No verified manufacturers match your current filter criteria.",
    resetFiltersBtn: "Reset Filters",
  },
  ru: {
    heroBadge: "ОТКРЫТАЯ ВИТРИНА ФАБРИК • 0% КОМИССИИ ПРЯМЫЕ ЗАКУПКИ",
    heroTitle: "Каталог проверенных швейных фабрик и оптовиков Мертера (Стамбул)",
    heroDesc:
      "Прямые контакты WhatsApp, адреса шоурумов в Мертере, пошив Private Label и оптовые коллекции размерными рядами напрямую от производителей Турции.",
    applyBtn: "Разместить фабрику (Бесплатно)",
    portalLoginBtn: "Вход для поставщиков",
    searchPlaceholder: "Поиск по названию фабрики, адресу в Мертере или странам экспорта...",
    filterPrivateLabel: "Private Label (СТМ)",
    filterFason: "Пошив на заказ (Фасон)",
    typeAll: "Все фабрики",
    typeManufacturer: "Фабрика и оптовая продажа",
    typePrivateLabel: "Private Label (СТМ)",
    typeFason: "Швейный цех (Фасон)",
    typeFabric: "Опт тканей",
    typeAccessory: "Фурнитура и аксессуары",
    verifiedBadge: "Проверенная фабрика",
    zeroCommission: "0% комиссии • Напрямую",
    productCountSuffix: "мод.",
    originalSeriesBadge: "Размерные ряды (Серии)",
    exportPrefix: "Экспорт",
    defaultExportRegions: "Россия, СНГ, Европа и Ближний Восток",
    defaultAddress: "Текстильный центр Мертер, Стамбул",
    defaultBrandDescSuffix:
      "— проверенный производитель одежды в районе Мертер (Стамбул), поставляющий оптовые коллекции размерными рядами по фабричным ценам.",
    directIbanLabel: "Прямой IBAN поставщика",
    bankFallback: "Банк",
    collectionBtn: "Коллекция и товары",
    storyGuideBtn: "О фабрике и гид",
    loadingText: "Загрузка проверенных фабрик Мертера...",
    emptyText: "По выбранным критериям фабрики не найдены.",
    resetFiltersBtn: "Сбросить фильтры",
  },
  ar: {
    heroBadge: "معرض المصانع المفتوح • 0% عمولة تجارة مباشرة",
    heroTitle: "دليل مصانع الملابس المعتمدة وشركات الجملة في مارتر إسطنبول",
    heroDesc:
      "تواصل مباشرة عبر واتساب وعناوين صالات العرض في مارتر مع مصانع الملابس الجاهزة والتصنيع الخاص (Private Label) بأسعار المصنع مباشرة.",
    applyBtn: "سجّل مصنعك مجاناً",
    portalLoginBtn: "دخول بوابة الموردين",
    searchPlaceholder: "ابحث باسم المصنع أو العنوان في مارتر أو دول التصدير...",
    filterPrivateLabel: "تصنيع خاص (Private Label)",
    filterFason: "تشغيل فاصون للمصانع",
    typeAll: "جميع المصانع",
    typeManufacturer: "مصنع وبيع بالجملة",
    typePrivateLabel: "تصنيع علامات خاصة",
    typeFason: "مشغل خياطة فاصون",
    typeFabric: "تاجر أقمشة بالجملة",
    typeAccessory: "إكسسوارات ومستلزمات النسيج",
    verifiedBadge: "مصنع معتمد",
    zeroCommission: "0% عمولة بيع مباشر",
    productCountSuffix: "موديل",
    originalSeriesBadge: "نظام السيري والباكيدج",
    exportPrefix: "التصدير",
    defaultExportRegions: "الخليج، الشرق الأوسط، أوروبا وآسيا الوسطى",
    defaultAddress: "مركز مارتر للنسيج، إسطنبول",
    defaultBrandDescSuffix:
      "مصنع ملابس معتمد في مارتر إسطنبول يوفّر تشكيلات الجملة بنظام الباكيدج المقسم بالمقاسات مباشرة بأسعار المصنع.",
    directIbanLabel: "حساب IBAN المباشر للمورد",
    bankFallback: "البنك",
    collectionBtn: "التشكيلة والمنتجات",
    storyGuideBtn: "ملف المصنع والدليل",
    loadingText: "جاري تحميل مصانع مارتر المعتمدة...",
    emptyText: "لم يتم العثور على مصانع تطابق معايير البحث.",
    resetFiltersBtn: "مسح الفلاتر",
  },
  de: {
    heroBadge: "OFFENES HERSTELLERVERZEICHNIS • 0% PROVISION DIREKTHANDEL",
    heroTitle: "Geprüfte Bekleidungshersteller & Mode-Großhändler in Merter Istanbul",
    heroDesc:
      "Direkter Kontakt via WhatsApp, Showroom-Adressen in Merter, Private-Label-Fertigung und Serienpakete ab Werk ohne Zwischenhändler.",
    applyBtn: "Als Hersteller registrieren (Kostenlos)",
    portalLoginBtn: "Lieferanten-Login",
    searchPlaceholder: "Herstellername, Merter-Adresse oder Exportland suchen...",
    filterPrivateLabel: "Private Label (Eigenmarke)",
    filterFason: "Lohnfertigung (CMT)",
    typeAll: "Alle Betriebe",
    typeManufacturer: "Hersteller & Großhandel",
    typePrivateLabel: "Private-Label-Produzent",
    typeFason: "Lohnnäherei",
    typeFabric: "Stoffgroßhandel",
    typeAccessory: "Textilzubehör",
    verifiedBadge: "Geprüfter Hersteller",
    zeroCommission: "0% Provision • Ab Werk",
    productCountSuffix: "Modelle",
    originalSeriesBadge: "Sortierte Größenserien",
    exportPrefix: "Export",
    defaultExportRegions: "DACH, EU, Balkan & Nahost",
    defaultAddress: "Textilzentrum Merter, Güngören / Istanbul",
    defaultBrandDescSuffix:
      "ist ein geprüfter Bekleidungshersteller in Merter Istanbul mit sortierten Größenserien zu direkten Werkspreisen.",
    directIbanLabel: "Direkt-IBAN des Herstellers",
    bankFallback: "Bank",
    collectionBtn: "Kollektion & Produkte",
    storyGuideBtn: "Firmenprofil & Ratgeber",
    loadingText: "Geprüfte Merter-Hersteller werden geladen...",
    emptyText: "Keine Hersteller für Ihre Filterauswahl gefunden.",
    resetFiltersBtn: "Filter zurücksetzen",
  },
  fr: {
    heroBadge: "ANNUAIRE FABRICANTS OUVERT • 0% COMMISSION EN DIRECT USINE",
    heroTitle: "Fabricants de Vêtements Vérifiés & Grossistes Mode à Merter Istanbul",
    heroDesc:
      "Accédez sans intermédiaire aux lignes WhatsApp, showrooms de Merter, ateliers Private Label et collections vendues par séries assorties.",
    applyBtn: "Inscrire votre usine (Gratuit)",
    portalLoginBtn: "Portail Fournisseur",
    searchPlaceholder: "Rechercher un fabricant, une adresse à Merter ou un pays d’export...",
    filterPrivateLabel: "Private Label (Marque blanche)",
    filterFason: "Façonnage textile",
    typeAll: "Toutes les entreprises",
    typeManufacturer: "Fabricant & Grossiste",
    typePrivateLabel: "Fabrication Marque Blanche",
    typeFason: "Atelier à façon",
    typeFabric: "Grossiste tissus",
    typeAccessory: "Accessoires textiles",
    verifiedBadge: "Fabricant vérifié",
    zeroCommission: "0% commission • Direct usine",
    productCountSuffix: "Modèles",
    originalSeriesBadge: "Séries de tailles assorties",
    exportPrefix: "Export",
    defaultExportRegions: "France, UE, Maghreb & Moyen-Orient",
    defaultAddress: "Centre textile de Merter, Istanbul",
    defaultBrandDescSuffix:
      "est un fabricant vérifié de Merter Istanbul proposant des collections en gros par séries assorties au prix d’usine.",
    directIbanLabel: "IBAN direct fournisseur",
    bankFallback: "Banque",
    collectionBtn: "Collection & Produits",
    storyGuideBtn: "Profil & Guide B2B",
    loadingText: "Chargement des fabricants vérifiés de Merter...",
    emptyText: "Aucun fabricant ne correspond à vos critères.",
    resetFiltersBtn: "Réinitialiser les filtres",
  },
  pl: {
    heroBadge: "OTWARTY KATALOG FABRYK • 0% PROWIZJI HANDEL BEZPOŚREDNI",
    heroTitle: "Zweryfikowani Producenci i Hurtownie Odzieży w Merter Stambuł",
    heroDesc:
      "Bezpośredni kontakt WhatsApp, adresy showroomów w Merter, produkcja Private Label oraz kolekcje w pełnych seriach prosto z fabryk.",
    applyBtn: "Dodaj swoją fabrykę (Bezpłatnie)",
    portalLoginBtn: "Logowanie dostawcy",
    searchPlaceholder: "Szukaj nazwy producenta, adresu w Merter lub kraju eksportu...",
    filterPrivateLabel: "Private Label (Marka własna)",
    filterFason: "Szwalnie usługowe",
    typeAll: "Wszystkie firmy",
    typeManufacturer: "Producent i hurtownia",
    typePrivateLabel: "Produkcja Private Label",
    typeFason: "Szwalnia usługowa",
    typeFabric: "Hurtownia tkanin",
    typeAccessory: "Dodatki krawieckie",
    verifiedBadge: "Zweryfikowany producent",
    zeroCommission: "0% prowizji • Prosto z fabryki",
    productCountSuffix: "Modeli",
    originalSeriesBadge: "Oryginalne serie (Paczki)",
    exportPrefix: "Eksport",
    defaultExportRegions: "Polska, UE, Bałkany i WNP",
    defaultAddress: "Centrum Tekstylne Merter, Stambuł",
    defaultBrandDescSuffix:
      "to zweryfikowany producent odzieży z Merter w Stambule oferujący sprzedaż hurtową w seriach rozmiarowych w cenach fabrycznych.",
    directIbanLabel: "Bezpośredni IBAN dostawcy",
    bankFallback: "Bank",
    collectionBtn: "Kolekcja i produkty",
    storyGuideBtn: "Profil firmy i poradnik",
    loadingText: "Ładowanie zweryfikowanych producentów z Merter...",
    emptyText: "Nie znaleziono producentów spełniających kryteria.",
    resetFiltersBtn: "Wyczyść filtry",
  },
  bg: {
    heroBadge: "ОТВОРЕН КАТАЛОГ НА ФАБРИКИ • 0% КОМИСИОНА ДИРЕКТНА ТЪРГОВИЯ",
    heroTitle: "Проверени производители и фирми за дрехи на едро в Мертер Истанбул",
    heroDesc:
      "Директни WhatsApp линии, адреси на шоуруми в Мертер, ишлеме / Private Label производство и колекции на серии директно от фабриките.",
    applyBtn: "Регистрирайте фабрика (Безплатно)",
    portalLoginBtn: "Вход за доставчици",
    searchPlaceholder: "Търсене по име на фирма, адрес в Мертер или пазар за износ...",
    filterPrivateLabel: "Private Label (Собствен етикет)",
    filterFason: "Производство на ишлеме",
    typeAll: "Всички фирми",
    typeManufacturer: "Производител и търговец на едро",
    typePrivateLabel: "Private Label производство",
    typeFason: "Цех за ишлеме",
    typeFabric: "Търговия с платове",
    typeAccessory: "Шивашки аксесоари",
    verifiedBadge: "Проверен производител",
    zeroCommission: "0% комисиона • Фабрични цени",
    productCountSuffix: "Модела",
    originalSeriesBadge: "Оригинални серии (Пакети)",
    exportPrefix: "Износ",
    defaultExportRegions: "България, ЕС, Балкани и ОНД",
    defaultAddress: "Текстилен център Мертер, Истанбул",
    defaultBrandDescSuffix:
      "е проверен производител в Мертер Истанбул, предлагащ колекции на едро в размерни серии на директни фабрични цени.",
    directIbanLabel: "Директен IBAN на доставчика",
    bankFallback: "Банка",
    collectionBtn: "Колекция и продукти",
    storyGuideBtn: "Профил и ръководство",
    loadingText: "Зареждане на проверени производители от Мертер...",
    emptyText: "Няма намерени производители по избраните филтри.",
    resetFiltersBtn: "Изчисти филтрите",
  },
};

function getCompanyTypeLabel(typeKey: string | undefined, copy: DirectoryLocaleCopy): string {
  switch (typeKey) {
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

function matchesSupplierFilter(
  brand: Brand,
  query: string,
  selectedType: string,
  onlyPrivateLabel: boolean,
  onlyFason: boolean
): boolean {
  if ((brand.active_product_count ?? 0) <= 0) {
    return false;
  }
  if (selectedType !== "all" && (brand.company_type || "uretici_toptanci") !== selectedType) {
    return false;
  }
  if (onlyPrivateLabel && !brand.supports_private_label) {
    return false;
  }
  if (onlyFason && !brand.supports_fason) {
    return false;
  }
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const haystack = [
    brand.name,
    brand.description,
    brand.location_address,
    brand.export_countries,
    brand.alias_code,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
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

interface SupplierDirectoryCardProps {
  readonly brand: Brand;
  readonly copy: DirectoryLocaleCopy;
  readonly langSuffix: string;
}

function SupplierCardContactDetails({
  brand,
  copy,
}: {
  readonly brand: Brand;
  readonly copy: DirectoryLocaleCopy;
}) {
  const waRaw = brand.whatsapp_phone || brand.phone || "";
  const callRaw = brand.phone || brand.whatsapp_phone || "";
  const addressText = brand.location_address || copy.defaultAddress;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs text-slate-700">
      <div className="flex items-start gap-1.5 sm:col-span-2">
        <MapPin size={13} className="text-emerald-600 shrink-0 mt-0.5" />
        <span className="text-slate-600 font-medium">{addressText}</span>
      </div>
      {waRaw && (
        <div className="flex items-center gap-1.5">
          <MessageCircle size={13} className="text-[#15803D] shrink-0" />
          <span className="font-bold text-[#15803D]">WhatsApp: {waRaw}</span>
        </div>
      )}
      {callRaw && (
        <div className="flex items-center gap-1.5">
          <Phone size={13} className="text-slate-400 shrink-0" />
          <a
            href={`tel:${callRaw}`}
            className="font-semibold text-slate-800 hover:text-[#1C1C1C] no-underline"
          >
            Tel: {callRaw}
          </a>
        </div>
      )}
      {brand.public_email && (
        <div className="flex items-center gap-1.5">
          <Mail size={13} className="text-slate-400 shrink-0" />
          <a
            href={`mailto:${brand.public_email}`}
            className="font-semibold text-slate-700 hover:text-[#1C1C1C] no-underline truncate"
          >
            {brand.public_email}
          </a>
        </div>
      )}
      {brand.website && (
        <div className="flex items-center gap-1.5">
          <Globe size={13} className="text-slate-400 shrink-0" />
          <a
            href={brand.website}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-slate-700 hover:text-[#1C1C1C] no-underline truncate"
          >
            {brand.website.replace(/^https?:\/\//, "")}
          </a>
        </div>
      )}
      {brand.iban && (
        <div className="flex items-center gap-1.5 sm:col-span-2 text-[11px] text-slate-600">
          <CreditCard size={12} className="text-[#8C6D3F] shrink-0" />
          <span className="truncate">
            {copy.directIbanLabel} ({brand.bank_name || copy.bankFallback}):{" "}
            <strong className="font-mono text-slate-900">{brand.iban}</strong>
          </span>
        </div>
      )}
    </div>
  );
}

function SupplierDirectoryCard({ brand, copy, langSuffix }: SupplierDirectoryCardProps) {
  const companyLabel = getCompanyTypeLabel(brand.company_type, copy);
  const slugPart = encodeURIComponent(brand.slug || brand.id);
  const showcaseHref = `/ureticiler/${slugPart}${langSuffix}`;
  const editorialHref = `/ureticiler/${slugPart}/tanitim${langSuffix}`;
  const productCount = brand.active_product_count ?? 0;
  const descText = brand.description || `${brand.name} ${copy.defaultBrandDescSuffix}`;
  const exportText = brand.export_countries || copy.defaultExportRegions;

  return (
    <div className="bg-white rounded-lg border border-[#E5E0D8] hover:border-[#1C1C1C]/40 shadow-xs hover:shadow-md transition-all p-5 flex flex-col justify-between gap-4">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-md bg-[#F8F6F2] text-[#1C1C1C] border border-[#E5E0D8] flex items-center justify-center shrink-0">
              <Building2 size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  href={showcaseHref}
                  className="text-base font-extrabold text-[#1C1C1C] hover:text-[#6E542E] transition-colors no-underline"
                >
                  {brand.name}
                </Link>
                {(brand.is_verified ?? true) && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-[#15803D] border border-emerald-200 text-[10px] font-bold">
                    <ShieldCheck size={11} />
                    <span>{copy.verifiedBadge}</span>
                  </span>
                )}
              </div>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                {companyLabel} • {copy.zeroCommission}
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#F8F6F2] border border-[#E5E0D8] text-[#1C1C1C] text-xs font-extrabold shrink-0">
            <Package size={13} className="text-[#8C6D3F]" />
            <span>
              {productCount} {copy.productCountSuffix}
            </span>
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#F8F6F2] text-[#1C1C1C] border border-[#E5E0D8] text-[11px] font-bold">
            <CheckCircle2 size={11} className="text-[#15803D]" />
            <span>{copy.originalSeriesBadge}</span>
          </span>
          {brand.supports_private_label && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#F8F6F2] text-[#1C1C1C] border border-[#E5E0D8] text-[11px] font-bold">
              <CheckCircle2 size={11} className="text-[#8C6D3F]" />
              <span>{copy.filterPrivateLabel}</span>
            </span>
          )}
          {brand.supports_fason && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#F8F6F2] text-[#1C1C1C] border border-[#E5E0D8] text-[11px] font-bold">
              <CheckCircle2 size={11} className="text-[#8C6D3F]" />
              <span>{copy.typeFason}</span>
            </span>
          )}
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#F8F6F2] text-[#525252] border border-[#E5E0D8] text-[11px] font-semibold">
            <span>
              {copy.exportPrefix}: {exportText}
            </span>
          </span>
        </div>

        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{descText}</p>

        <SupplierCardContactDetails brand={brand} copy={copy} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-3 border-t border-slate-100">
        <Link
          href={showcaseHref}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-md bg-[#1C1C1C] hover:bg-[#333333] text-white text-xs font-extrabold transition-colors no-underline shadow-xs"
        >
          <span>{copy.collectionBtn}</span>
          <ArrowRight size={14} className="rtl:rotate-180" />
        </Link>

        <Link
          href={editorialHref}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-md bg-white hover:bg-[#F8F6F2] text-[#1C1C1C] border border-[#D6D1C7] hover:border-[#1C1C1C] text-xs font-extrabold transition-colors no-underline"
        >
          <BookOpen size={14} className="text-[#8C6D3F]" />
          <span>{copy.storyGuideBtn}</span>
        </Link>
      </div>
    </div>
  );
}

interface DirectoryContentProps {
  readonly loading: boolean;
  readonly brands: readonly Brand[];
  readonly copy: DirectoryLocaleCopy;
  readonly langSuffix: string;
  readonly onResetFilters: () => void;
}

function DirectoryContent({
  loading,
  brands,
  copy,
  langSuffix,
  onResetFilters,
}: DirectoryContentProps) {
  if (loading) {
    return (
      <div className="py-16 text-center text-sm font-bold text-slate-500">{copy.loadingText}</div>
    );
  }
  if (brands.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-[#E5E0D8] p-12 text-center space-y-2">
        <p className="text-sm font-bold text-[#1C1C1C]">{copy.emptyText}</p>
        <button
          type="button"
          onClick={onResetFilters}
          className="px-4 py-2 rounded-md bg-[#1C1C1C] hover:bg-[#333333] text-white text-xs font-bold cursor-pointer border-none"
        >
          {copy.resetFiltersBtn}
        </button>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {brands.map((brand) => (
        <SupplierDirectoryCard
          key={brand.id}
          brand={brand}
          copy={copy}
          langSuffix={langSuffix}
        />
      ))}
    </div>
  );
}

interface SuppliersDirectoryClientProps {
  readonly initialLang?: SupportedSeoLang;
  readonly initialBrands?: readonly Brand[];
  readonly initialCategories?: readonly Category[];
}

export default function SuppliersDirectoryClient({
  initialLang = "tr",
  initialBrands = [],
  initialCategories = [],
}: SuppliersDirectoryClientProps) {
  const router = useRouter();
  const [lang, setLang] = useState<string>(initialLang);
  const [isLangOpen, setIsLangOpen] = useState<boolean>(false);
  const [displayCurrency, setDisplayCurrency] = useState<string>("TRY");
  const [categories, setCategories] = useState<Category[]>([...initialCategories]);
  const [brands, setBrands] = useState<Brand[]>([...initialBrands]);
  const [loading, setLoading] = useState<boolean>(initialBrands.length === 0);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [onlyPrivateLabel, setOnlyPrivateLabel] = useState<boolean>(false);
  const [onlyFason, setOnlyFason] = useState<boolean>(false);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState<boolean>(false);
  const [policyModalType, setPolicyModalType] = useState<
    "cancellation_and_return" | "terms_of_service" | "privacy_policy" | ""
  >("");

  const safeLang = normalizeSeoLang(lang, "tr");
  const copy = DIRECTORY_COPY[safeLang];
  const langSuffix = safeLang === "tr" ? "" : `?lang=${safeLang}`;

  const totalPkgs = useSyncExternalStore(
    subscribeStore,
    getCartPkgsSnapshot,
    getCartPkgsServerSnapshot
  );

  useEffect(() => {
    async function loadDirectoryData() {
      const needBrands = initialBrands.length === 0;
      const needCats = initialCategories.length === 0;
      if (needBrands) setLoading(true);

      const [brandsData, categoriesData, settingsData] = await Promise.all([
        needBrands ? apiFetch<Brand[]>("/brands") : Promise.resolve(null),
        needCats ? apiFetch<Category[]>("/categories") : Promise.resolve(null),
        apiFetch<{ show_prices_to_guests?: boolean }>("/settings"),
      ]);
      if (brandsData) setBrands(brandsData);
      if (categoriesData) setCategories(categoriesData);
      if (settingsData) {
        syncShowPricesToGuestsSetting(Boolean(settingsData.show_prices_to_guests));
      }
      setLoading(false);
    }
    void loadDirectoryData();
  }, [initialBrands.length, initialCategories.length]);

  const handleLangChange = (nextLang: string) => {
    const normalized = normalizeSeoLang(nextLang, "tr");
    setLang(normalized);
    router.push(normalized === "tr" ? "/ureticiler" : `/ureticiler?lang=${normalized}`);
  };

  const companyTypeOptions = useMemo(
    () => [
      { value: "all", label: copy.typeAll },
      { value: "uretici_toptanci", label: copy.typeManufacturer },
      { value: "private_label", label: copy.typePrivateLabel },
      { value: "fason_atolye", label: copy.typeFason },
      { value: "kumas_tedarikcisi", label: copy.typeFabric },
      { value: "aksesuar", label: copy.typeAccessory },
    ],
    [copy]
  );

  const filteredBrands = useMemo(
    () =>
      brands.filter((b) =>
        matchesSupplierFilter(b, searchQuery, selectedType, onlyPrivateLabel, onlyFason)
      ),
    [brands, searchQuery, selectedType, onlyPrivateLabel, onlyFason]
  );

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

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 py-8 space-y-6">
        <div className="rounded-lg bg-[#F8F6F2] border border-[#E5E0D8] text-[#1C1C1C] p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xs">
          <div className="space-y-2.5 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[#15803D] text-xs font-extrabold">
              <ShieldCheck size={14} className="text-[#15803D]" />
              <span>{copy.heroBadge}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#1C1C1C]">
              {copy.heroTitle}
            </h1>
            <p className="text-xs sm:text-sm text-[#525252] leading-relaxed">{copy.heroDesc}</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 shrink-0">
            <Link
              href="/tedarikci-basvuru"
              className="px-4 py-3 rounded-md bg-[#1C1C1C] hover:bg-[#333333] text-white text-xs font-extrabold no-underline text-center transition-colors shadow-xs"
            >
              {copy.applyBtn}
            </Link>
            <Link
              href="/supplier"
              className="px-4 py-3 rounded-md bg-white hover:bg-[#F8F6F2] text-[#1C1C1C] border border-[#D6D1C7] hover:border-[#1C1C1C] text-xs font-extrabold no-underline text-center transition-colors shadow-xs"
            >
              {copy.portalLoginBtn}
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-[#E5E0D8] p-4 space-y-3 shadow-xs">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={copy.searchPlaceholder}
                className="w-full ps-10 pe-4 py-2.5 rounded-md border border-[#D6D1C7] text-xs sm:text-sm focus:outline-none focus:border-[#1C1C1C]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setOnlyPrivateLabel((prev) => !prev)}
                className={`px-3 py-2 rounded-md text-xs font-bold border transition-colors cursor-pointer ${
                  onlyPrivateLabel
                    ? "bg-[#1C1C1C] text-white border-[#1C1C1C]"
                    : "bg-white text-[#1C1C1C] border-[#D6D1C7] hover:border-[#1C1C1C] hover:bg-[#F8F6F2]"
                }`}
              >
                {copy.filterPrivateLabel}
              </button>
              <button
                type="button"
                onClick={() => setOnlyFason((prev) => !prev)}
                className={`px-3 py-2 rounded-md text-xs font-bold border transition-colors cursor-pointer ${
                  onlyFason
                    ? "bg-[#1C1C1C] text-white border-[#1C1C1C]"
                    : "bg-white text-[#1C1C1C] border-[#D6D1C7] hover:border-[#1C1C1C] hover:bg-[#F8F6F2]"
                }`}
              >
                {copy.filterFason}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {companyTypeOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSelectedType(opt.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap transition-colors cursor-pointer border ${
                  selectedType === opt.value
                    ? "bg-[#1C1C1C] text-white border-[#1C1C1C] shadow-xs"
                    : "bg-white text-[#525252] border-[#D6D1C7] hover:bg-[#F8F6F2] hover:text-[#1C1C1C] hover:border-[#1C1C1C]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <DirectoryContent
          loading={loading}
          brands={filteredBrands}
          copy={copy}
          langSuffix={langSuffix}
          onResetFilters={() => {
            setSearchQuery("");
            setSelectedType("all");
            setOnlyPrivateLabel(false);
            setOnlyFason(false);
          }}
        />
      </main>

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
