"use client";

import React, { useState } from "react";
import { ChevronDown, Lock } from "lucide-react";
import { Brand } from "@/types/store";
import { t, pickLangText, SupportedLangCode } from "@/app/i18n";
import { useIsStoreAuthenticated, openStoreAuthModal, getShortMemberPriceLabel } from "@/app/storeAuth";

export interface B2BSourcingFilters {
  readonly fason: boolean;
  readonly privateLabel: boolean;
  readonly companyType: string;
  readonly maxMoq: string;
  readonly exportCountry: string;
}

interface FilterSidebarProps {
  readonly lang: string;
  readonly brands: readonly Brand[];
  readonly activeBrandIds: readonly string[];
  readonly handleBrandChange: (brandId: string) => void;
  readonly activeSpecs: { readonly gender: readonly string[]; readonly season: readonly string[] };
  readonly handleSpecChange: (type: "gender" | "season", value: string) => void;
  readonly b2bFilters?: B2BSourcingFilters;
  readonly onB2bFilterChange?: (patch: Partial<B2BSourcingFilters>) => void;
  readonly attributes: Record<string, string[]>;
  readonly activeAttributes: Record<string, string[]>;
  readonly handleAttributeChange: (name: string, value: string) => void;
  readonly minPrice: string;
  readonly maxPrice: string;
  readonly setMinPrice: (val: string) => void;
  readonly setMaxPrice: (val: string) => void;
  readonly facets?: {
    readonly brands?: Record<string, number>;
    readonly genders?: Record<string, number>;
    readonly seasons?: Record<string, number>;
    readonly attributes?: Record<string, Record<string, number>>;
  } | null;
  readonly handleClearAllFilters: () => void;
}

function safeGetCount(obj: Record<string, number> | undefined | null, key: string): number {
  if (!obj || typeof obj !== "object") return 0;
  const cleanKey = String(key).trim();
  if (cleanKey === "__proto__" || cleanKey === "constructor" || cleanKey === "prototype") {
    return 0;
  }
  if (Object.hasOwn(obj, cleanKey)) {
    return obj[cleanKey] ?? 0;
  }
  return 0;
}

function safeGetAttributeCount(
  attributesObj: Record<string, Record<string, number>> | undefined | null,
  attrName: string,
  val: string
): number {
  if (!attributesObj || typeof attributesObj !== "object") return 0;

  const cleanAttrName = String(attrName).trim();
  if (cleanAttrName === "__proto__" || cleanAttrName === "constructor" || cleanAttrName === "prototype") {
    return 0;
  }

  if (Object.hasOwn(attributesObj, cleanAttrName)) {
    const valObj = attributesObj[cleanAttrName];
    return safeGetCount(valObj, val);
  }
  return 0;
}

interface B2bSourcingLabelSet {
  title: string;
  capabilities: string;
  privateLabel: string;
  fason: string;
  companyType: string;
  allTypes: string;
  typeManufacturer: string;
  typePrivateLabel: string;
  typeFason: string;
  typeFabric: string;
  typeAccessory: string;
  maxMoq: string;
  moqAll: string;
  moq6: string;
  moq30: string;
  moq60: string;
  exportCountry: string;
  exportAll: string;
}

const B2B_SOURCING_LABELS: Record<SupportedLangCode, B2bSourcingLabelSet> = {
  tr: {
    title: "B2B ÜRETİM, MOQ & İHRACAT",
    capabilities: "ÜRETİM YETKİNLİKLERİ",
    privateLabel: "Private Label (Özel Etiket)",
    fason: "Fason Üretim Atölyesi",
    companyType: "TEDARİKÇİ FAALİYET TÜRÜ",
    allTypes: "Tüm Tedarikçi Türleri",
    typeManufacturer: "Hazır Giyim Üretici & Toptancı",
    typePrivateLabel: "Private Label Üretici",
    typeFason: "Fason Dikim Atölyesi",
    typeFabric: "Kumaş Tedarikçisi",
    typeAccessory: "Aksesuar & Yan Sanayi",
    maxMoq: "MAKSİMUM MİN. SİPARİŞ (MOQ)",
    moqAll: "Tümü (Sınırsız)",
    moq6: "≤ 6 Adet (1 Seri)",
    moq30: "≤ 30 Adet (5 Seri)",
    moq60: "≤ 60 Adet (10 Seri)",
    exportCountry: "İHRACAT PAZARI / ÜLKE",
    exportAll: "Tüm İhracat Ülkeleri",
  },
  en: {
    title: "B2B SOURCING, MOQ & EXPORT",
    capabilities: "PRODUCTION CAPABILITIES",
    privateLabel: "Private Label Manufacturing",
    fason: "Contract / CMT Workshop",
    companyType: "SUPPLIER BUSINESS TYPE",
    allTypes: "All Supplier Types",
    typeManufacturer: "Apparel Manufacturer & Wholesaler",
    typePrivateLabel: "Private Label Producer",
    typeFason: "CMT / Contract Workshop",
    typeFabric: "Fabric Supplier",
    typeAccessory: "Trim & Accessories",
    maxMoq: "MAX MINIMUM ORDER (MOQ)",
    moqAll: "Any MOQ",
    moq6: "≤ 6 Pcs (1 Pack)",
    moq30: "≤ 30 Pcs (5 Packs)",
    moq60: "≤ 60 Pcs (10 Packs)",
    exportCountry: "EXPORT MARKET / COUNTRY",
    exportAll: "All Export Markets",
  },
  ru: {
    title: "B2B ПРОИЗВОДСТВО, MOQ И ЭКСПОРТ",
    capabilities: "ВОЗМОЖНОСТИ ПРОИЗВОДСТВА",
    privateLabel: "Private Label (СТМ)",
    fason: "Контрактный пошив (Фасон)",
    companyType: "ТИП ПОСТАВЩИКА",
    allTypes: "Все типы поставщиков",
    typeManufacturer: "Производитель и оптовик",
    typePrivateLabel: "Производитель Private Label",
    typeFason: "Швейный цех (Фасон)",
    typeFabric: "Поставщик тканей",
    typeAccessory: "Фурнитура и аксессуары",
    maxMoq: "МАКС. МИН. ЗАКАЗ (MOQ)",
    moqAll: "Любой MOQ",
    moq6: "≤ 6 шт. (1 серия)",
    moq30: "≤ 30 шт. (5 серий)",
    moq60: "≤ 60 шт. (10 серий)",
    exportCountry: "СТРАНА ЭКСПОРТА",
    exportAll: "Все страны экспорта",
  },
  ar: {
    title: "الإنتاج بالجملة، الحد الأدنى والتصدير",
    capabilities: "قدرات التصنيع",
    privateLabel: "تصنيع علامة خاصة (Private Label)",
    fason: "ورشة خياطة وتصنيع للغير (فاسون)",
    companyType: "نوع نشاط المورد",
    allTypes: "جميع أنواع الموردين",
    typeManufacturer: "مصنع وتاجر جملة للملابس",
    typePrivateLabel: "مصنع علامات خاصة",
    typeFason: "مشغل خياطة (فاسون)",
    typeFabric: "مورد أقمشة",
    typeAccessory: "إكسسوارات ومستلزمات",
    maxMoq: "الحد الأدنى للطلب (MOQ)",
    moqAll: "الكل",
    moq6: "≤ 6 قطع (سيريه واحد)",
    moq30: "≤ 30 قطعة (5 سيريهات)",
    moq60: "≤ 60 قطعة (10 سيريهات)",
    exportCountry: "دول التصدير المستهدفة",
    exportAll: "جميع دول التصدير",
  },
  de: {
    title: "B2B-FERTIGUNG, MOQ & EXPORT",
    capabilities: "PRODUKTIONSKOMPETENZEN",
    privateLabel: "Private Label (Eigenmarke)",
    fason: "Lohnfertigung / Nähwerkstatt",
    companyType: "LIEFERANTENTYP",
    allTypes: "Alle Lieferantentypen",
    typeManufacturer: "Bekleidungshersteller & Großhändler",
    typePrivateLabel: "Private-Label-Produzent",
    typeFason: "Lohnnäherei (CMT)",
    typeFabric: "Stofflieferant",
    typeAccessory: "Kurzwaren & Zubehör",
    maxMoq: "MAX. MINDESTBESTELLUNG (MOQ)",
    moqAll: "Beliebiges MOQ",
    moq6: "≤ 6 Stk. (1 Paket)",
    moq30: "≤ 30 Stk. (5 Pakete)",
    moq60: "≤ 60 Stk. (10 Pakete)",
    exportCountry: "EXPORTMARKT / LAND",
    exportAll: "Alle Exportmärkte",
  },
  fr: {
    title: "PRODUCTION B2B, MOQ & EXPORT",
    capabilities: "CAPACITÉS DE FABRICATION",
    privateLabel: "Private Label (Marque Blanche)",
    fason: "Atelier de Façon (CMT)",
    companyType: "TYPE D'ACTIVITÉ DU FOURNISSEUR",
    allTypes: "Tous les types de fournisseurs",
    typeManufacturer: "Fabricant & Grossiste Prêt-à-porter",
    typePrivateLabel: "Producteur Private Label",
    typeFason: "Atelier de Confection à Façon",
    typeFabric: "Fournisseur de Tissus",
    typeAccessory: "Accessoires & Mercerie",
    maxMoq: "COMMANDE MIN. MAXIMALE (MOQ)",
    moqAll: "Tout MOQ",
    moq6: "≤ 6 pcs (1 paquet)",
    moq30: "≤ 30 pcs (5 paquets)",
    moq60: "≤ 60 pcs (10 paquets)",
    exportCountry: "MARCHÉ D'EXPORTATION / PAYS",
    exportAll: "Tous les pays d'exportation",
  },
  pl: {
    title: "PRODUKCJA B2B, MOQ I EKSPORT",
    capabilities: "MOŻLIWOŚCI PRODUKCYJNE",
    privateLabel: "Private Label (Marka Własna)",
    fason: "Szwalnia Kontraktowa (CMT)",
    companyType: "RODZAJ DOSTAWCY",
    allTypes: "Wszystkie typy dostawców",
    typeManufacturer: "Producent i Hurtownik Odzieży",
    typePrivateLabel: "Producent Private Label",
    typeFason: "Szwalnia Usługowa (Fason)",
    typeFabric: "Dostawca Tkanin",
    typeAccessory: "Dodatki Krawieckie i Akcesoria",
    maxMoq: "MAKS. MIN. ZAMÓWIENIE (MOQ)",
    moqAll: "Dowolne MOQ",
    moq6: "≤ 6 szt. (1 pakiet)",
    moq30: "≤ 30 szt. (5 pakietów)",
    moq60: "≤ 60 szt. (10 pakietów)",
    exportCountry: "RYNEK EKSPORTOWY / KRAJ",
    exportAll: "Wszystkie rynki eksportowe",
  },
  bg: {
    title: "B2B ПРОИЗВОДСТВО, MOQ И ИЗНОС",
    capabilities: "ПРОИЗВОДСТВЕН КАПАЦИТЕТ",
    privateLabel: "Private Label (Собствена марка)",
    fason: "Работа на ишлеме (CMT цех)",
    companyType: "ТИП ДОСТАВЧИК",
    allTypes: "Всички типове доставчици",
    typeManufacturer: "Производител и търговец на едро",
    typePrivateLabel: "Private Label производител",
    typeFason: "Шивашки цех на ишлеме",
    typeFabric: "Доставчик на платове",
    typeAccessory: "Аксесоари и материали",
    maxMoq: "МАКС. МИН. ПОРЪЧКА (MOQ)",
    moqAll: "Без ограничение",
    moq6: "≤ 6 бр. (1 пакет)",
    moq30: "≤ 30 бр. (5 пакета)",
    moq60: "≤ 60 бр. (10 пакета)",
    exportCountry: "ПАЗАР ЗА ИЗНОС / ДЪРЖАВА",
    exportAll: "Всички експортни пазари",
  },
};

const EXPORT_COUNTRY_OPTIONS: readonly {
  readonly value: string;
  readonly labels: Record<SupportedLangCode, string>;
}[] = [
  {
    value: "Almanya",
    labels: { tr: "Almanya", en: "Germany", ru: "Германия", ar: "ألمانيا", de: "Deutschland", fr: "Allemagne", pl: "Niemcy", bg: "Германия" },
  },
  {
    value: "Rusya",
    labels: { tr: "Rusya", en: "Russia", ru: "Россия", ar: "روسيا", de: "Russland", fr: "Russie", pl: "Rosja", bg: "Русия" },
  },
  {
    value: "İngiltere",
    labels: { tr: "İngiltere", en: "United Kingdom", ru: "Великобритания", ar: "المملكة المتحدة", de: "Vereinigtes Königreich", fr: "Royaume-Uni", pl: "Wielka Brytania", bg: "Великобритания" },
  },
  {
    value: "Polonya",
    labels: { tr: "Polonya", en: "Poland", ru: "Польша", ar: "بولندا", de: "Polen", fr: "Pologne", pl: "Polska", bg: "Полша" },
  },
  {
    value: "BAE",
    labels: { tr: "BAE", en: "UAE", ru: "ОАЭ", ar: "الإمارات", de: "VAE", fr: "Émirats arabes unis", pl: "ZEA", bg: "ОАЕ" },
  },
  {
    value: "Suudi Arabistan",
    labels: { tr: "Suudi Arabistan", en: "Saudi Arabia", ru: "Саудовская Аравия", ar: "السعودية", de: "Saudi-Arabien", fr: "Arabie saoudite", pl: "Arabia Saudyjska", bg: "Саудитска Арабия" },
  },
  {
    value: "Fransa",
    labels: { tr: "Fransa", en: "France", ru: "Франция", ar: "فرنسا", de: "Frankreich", fr: "France", pl: "Francja", bg: "Франция" },
  },
  {
    value: "Hollanda",
    labels: { tr: "Hollanda", en: "Netherlands", ru: "Нидерланды", ar: "هولندا", de: "Niederlande", fr: "Pays-Bas", pl: "Holandia", bg: "Нидерландия" },
  },
  {
    value: "İtalya",
    labels: { tr: "İtalya", en: "Italy", ru: "Италия", ar: "إيطاليا", de: "Italien", fr: "Italie", pl: "Włochy", bg: "Италия" },
  },
  {
    value: "Kazakistan",
    labels: { tr: "Kazakistan", en: "Kazakhstan", ru: "Казахстан", ar: "كازاخستان", de: "Kasachstan", fr: "Kazakhstan", pl: "Kazachstan", bg: "Казахстан" },
  },
  {
    value: "Ukrayna",
    labels: { tr: "Ukrayna", en: "Ukraine", ru: "Украина", ar: "أوكرانيا", de: "Ukraine", fr: "Ukraine", pl: "Ukraina", bg: "Украйна" },
  },
  {
    value: "Romanya",
    labels: { tr: "Romanya", en: "Romania", ru: "Румыния", ar: "رومانيا", de: "Rumänien", fr: "Roumanie", pl: "Rumunia", bg: "Румъния" },
  },
  {
    value: "Bulgaristan",
    labels: { tr: "Bulgaristan", en: "Bulgaria", ru: "Болгария", ar: "بلغاريا", de: "Bulgarien", fr: "Bulgarie", pl: "Bułgaria", bg: "България" },
  },
];

function B2bProductionSourcingSection({
  lang,
  isOpen,
  onToggle,
  b2bFilters,
  onB2bFilterChange,
}: Readonly<{
  lang: string;
  isOpen: boolean;
  onToggle: () => void;
  b2bFilters: B2BSourcingFilters;
  onB2bFilterChange: (patch: Partial<B2BSourcingFilters>) => void;
}>) {
  const L = pickLangText(lang, B2B_SOURCING_LABELS);
  const rotateCls = isOpen ? "transform rotate-180" : "";

  return (
    <div className="border-b border-cultured pb-4">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center justify-between w-full text-left focus:outline-none group cursor-pointer"
      >
        <span className="text-xs uppercase font-extrabold text-eerie-black tracking-[0.5px] group-hover:text-salmon-pink transition-colors">
          {L.title}
        </span>
        <ChevronDown
          size={14}
          className={`text-sonic-silver transition-transform duration-200 ${rotateCls}`}
        />
      </button>

      {isOpen && (
        <div className="mt-4 flex flex-col gap-3.5 animate-in fade-in duration-200">
          {/* Production Capabilities */}
          <div>
            <span className="block text-[10px] uppercase font-bold text-sonic-silver mb-2 tracking-wider">
              {L.capabilities}
            </span>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2.5 text-xs font-semibold text-onyx hover:text-salmon-pink cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  className="rounded border-cultured bg-white text-salmon-pink focus:ring-salmon-pink w-4 h-4 cursor-pointer"
                  checked={b2bFilters.privateLabel}
                  onChange={(e) => onB2bFilterChange({ privateLabel: e.target.checked })}
                />
                <span>{L.privateLabel}</span>
              </label>
              <label className="flex items-center gap-2.5 text-xs font-semibold text-onyx hover:text-salmon-pink cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  className="rounded border-cultured bg-white text-salmon-pink focus:ring-salmon-pink w-4 h-4 cursor-pointer"
                  checked={b2bFilters.fason}
                  onChange={(e) => onB2bFilterChange({ fason: e.target.checked })}
                />
                <span>{L.fason}</span>
              </label>
            </div>
          </div>

          {/* Supplier Business Type */}
          <div>
            <span className="block text-[10px] uppercase font-bold text-sonic-silver mb-1.5 tracking-wider">
              {L.companyType}
            </span>
            <select
              value={b2bFilters.companyType}
              onChange={(e) => onB2bFilterChange({ companyType: e.target.value })}
              className="w-full bg-white border border-cultured rounded-[6px] px-2.5 py-1.5 text-xs font-semibold text-onyx focus:outline-none focus:border-salmon-pink"
            >
              <option value="">{L.allTypes}</option>
              <option value="uretici_toptanci">{L.typeManufacturer}</option>
              <option value="private_label">{L.typePrivateLabel}</option>
              <option value="fason_atolye">{L.typeFason}</option>
              <option value="kumas_tedarikcisi">{L.typeFabric}</option>
              <option value="aksesuar">{L.typeAccessory}</option>
            </select>
          </div>

          {/* Maximum MOQ */}
          <div>
            <span className="block text-[10px] uppercase font-bold text-sonic-silver mb-1.5 tracking-wider">
              {L.maxMoq}
            </span>
            <select
              value={b2bFilters.maxMoq}
              onChange={(e) => onB2bFilterChange({ maxMoq: e.target.value })}
              className="w-full bg-white border border-cultured rounded-[6px] px-2.5 py-1.5 text-xs font-semibold text-onyx focus:outline-none focus:border-salmon-pink"
            >
              <option value="">{L.moqAll}</option>
              <option value="6">{L.moq6}</option>
              <option value="30">{L.moq30}</option>
              <option value="60">{L.moq60}</option>
            </select>
          </div>

          {/* Export Country */}
          <div>
            <span className="block text-[10px] uppercase font-bold text-sonic-silver mb-1.5 tracking-wider">
              {L.exportCountry}
            </span>
            <select
              value={b2bFilters.exportCountry}
              onChange={(e) => onB2bFilterChange({ exportCountry: e.target.value })}
              className="w-full bg-white border border-cultured rounded-[6px] px-2.5 py-1.5 text-xs font-semibold text-onyx focus:outline-none focus:border-salmon-pink"
            >
              <option value="">{L.exportAll}</option>
              {EXPORT_COUNTRY_OPTIONS.map((country) => (
                <option key={country.value} value={country.value}>
                  {pickLangText(lang, country.labels)}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

function hasB2bSourcingActive(b2bFilters?: B2BSourcingFilters): boolean {
  if (!b2bFilters) return false;
  return Boolean(
    b2bFilters.fason ||
    b2bFilters.privateLabel ||
    b2bFilters.companyType !== "" ||
    b2bFilters.maxMoq !== "" ||
    b2bFilters.exportCountry !== ""
  );
}

export default function FilterSidebar({
  lang,
  brands,
  activeBrandIds,
  handleBrandChange,
  activeSpecs,
  handleSpecChange,
  b2bFilters,
  onB2bFilterChange,
  attributes,
  activeAttributes,
  handleAttributeChange,
  minPrice,
  maxPrice,
  setMinPrice,
  setMaxPrice,
  facets,
  handleClearAllFilters,
}: Readonly<FilterSidebarProps>) {
  // Synchronize local price states without useEffect cascading renders
  const [prevPrices, setPrevPrices] = useState({ minPrice, maxPrice });
  const [localMinPrice, setLocalMinPrice] = useState<string>(minPrice);
  const [localMaxPrice, setLocalMaxPrice] = useState<string>(maxPrice);

  if (prevPrices.minPrice !== minPrice || prevPrices.maxPrice !== maxPrice) {
    setPrevPrices({ minPrice, maxPrice });
    setLocalMinPrice(minPrice);
    setLocalMaxPrice(maxPrice);
  }

  // Track explicit user open/collapsed toggles; defaults to desktop open, mobile collapsed
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const isSectionOpen = (key: string): boolean => {
    if (Object.hasOwn(openSections, key)) {
      return Boolean(openSections[key]);
    }
    if (typeof window !== "undefined") {
      return window.innerWidth >= 1024;
    }
    return true;
  };

  const toggleSection = (sectionKey: string) => {
    const safeKey = String(sectionKey).trim();
    if (safeKey === "__proto__" || safeKey === "constructor") return;

    setOpenSections((prev) => ({
      ...prev,
      [safeKey]: !isSectionOpen(safeKey),
    }));
  };

  const hasActiveFilters =
    activeBrandIds.length > 0 ||
    activeSpecs.gender.length > 0 ||
    activeSpecs.season.length > 0 ||
    hasB2bSourcingActive(b2bFilters) ||
    minPrice !== "" ||
    maxPrice !== "" ||
    Object.values(activeAttributes).some(values => values && values.length > 0);

  const isAuthenticated = useIsStoreAuthenticated();
  const isBrandsOpen = isSectionOpen("brands");
  const isB2bSourcingOpen = isSectionOpen("b2bSourcing");
  const isB2bOpen = isSectionOpen("b2b");
  const isPriceRangeOpen = isSectionOpen("priceRange");

  return (
    <aside className="lg:col-span-1 flex flex-col gap-6 select-none">
      <div className="bg-white rounded-[15px] p-6 border border-cultured flex flex-col gap-5 shadow-sm">

        {/* Sidebar Header with Clear All Button */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between border-b border-cultured pb-4.5 mb-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
            <span className="text-[11px] font-extrabold text-onyx uppercase tracking-wider">
              {t("active_filters", lang)}
            </span>
            <button
              type="button"
              onClick={handleClearAllFilters}
              className="text-[10px] font-extrabold text-salmon-pink hover:text-eerie-black transition-colors duration-200 border-none bg-transparent cursor-pointer flex items-center gap-1 uppercase tracking-widest active:scale-95 transform select-none"
            >
              ✕ {t("clear_all", lang)}
            </button>
          </div>
        )}

        {/* Section 1: Brands Filter */}
        <div className="border-b border-cultured pb-4">
          <button
            type="button"
            onClick={() => toggleSection("brands")}
            className="flex items-center justify-between w-full text-left focus:outline-none group cursor-pointer"
          >
            <span className="text-xs uppercase font-extrabold text-eerie-black tracking-[0.5px] group-hover:text-salmon-pink transition-colors">
              {t("brand_filter", lang)}
            </span>
            <ChevronDown
              size={14}
              className={`text-sonic-silver transition-transform duration-200 ${isBrandsOpen ? "transform rotate-180" : ""
                }`}
            />
          </button>

          {isBrandsOpen && (
            <div className="flex flex-col gap-2.5 max-h-48 overflow-y-auto pr-1 mt-3.5 animate-in fade-in duration-200">
              {brands.map((br) => {
                const count = safeGetCount(facets?.brands, br.id);
                const isDisabled = count === 0 && facets !== null;
                const isChecked = activeBrandIds.includes(br.id);
                return (
                  <label
                    key={br.id}
                    className={`flex items-center gap-2.5 text-xs font-semibold hover:text-salmon-pink cursor-pointer transition-colors duration-150 ${isDisabled && !isChecked ? "opacity-40 cursor-not-allowed pointer-events-none" : "text-onyx"
                      }`}
                  >
                    <input
                      type="checkbox"
                      className="rounded border-cultured bg-white text-salmon-pink focus:ring-salmon-pink w-4 h-4 cursor-pointer disabled:opacity-50"
                      checked={isChecked}
                      disabled={isDisabled && !isChecked}
                      onChange={() => handleBrandChange(br.id)}
                    />
                    <span>
                      {br.name || br.alias_code}
                      {facets !== null && <span className="text-[10px] text-sonic-silver ml-1 font-bold">({count})</span>}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 1.5: B2B Production, MOQ & Export Filters */}
        {b2bFilters && onB2bFilterChange && (
          <B2bProductionSourcingSection
            lang={lang}
            isOpen={isB2bSourcingOpen}
            onToggle={() => toggleSection("b2bSourcing")}
            b2bFilters={b2bFilters}
            onB2bFilterChange={onB2bFilterChange}
          />
        )}

        {/* Section 2: B2B Specs Filters */}
        <div className="border-b border-cultured pb-4">
          <button
            type="button"
            onClick={() => toggleSection("b2b")}
            className="flex items-center justify-between w-full text-left focus:outline-none group cursor-pointer"
          >
            <span className="text-xs uppercase font-extrabold text-eerie-black tracking-[0.5px] group-hover:text-salmon-pink transition-colors">
              {t("b2b_specs", lang)}
            </span>
            <ChevronDown
              size={14}
              className={`text-sonic-silver transition-transform duration-200 ${isB2bOpen ? "transform rotate-180" : ""
                }`}
            />
          </button>

          {isB2bOpen && (
            <div className="mt-4 flex flex-col gap-4 animate-in fade-in duration-200">
              {/* Gender Sub-section */}
              <div>
                <span className="block text-[10px] uppercase font-bold text-sonic-silver mb-2 tracking-wider">
                  {t("gender", lang)}
                </span>
                <div className="flex flex-col gap-2.5">
                  {["Kadın", "Erkek", "Unisex"].map((g) => {
                    const count = safeGetCount(facets?.genders, g);
                    const isDisabled = count === 0 && facets !== null;
                    const isChecked = activeSpecs.gender.includes(g);
                    return (
                      <label
                        key={g}
                        className={`flex items-center gap-2.5 text-xs font-semibold hover:text-salmon-pink cursor-pointer transition-colors duration-150 ${isDisabled && !isChecked ? "opacity-40 cursor-not-allowed pointer-events-none" : "text-onyx"
                          }`}
                      >
                        <input
                          type="checkbox"
                          className="rounded border-cultured bg-white text-salmon-pink focus:ring-salmon-pink w-4 h-4 cursor-pointer disabled:opacity-50"
                          checked={isChecked}
                          disabled={isDisabled && !isChecked}
                          onChange={() => handleSpecChange("gender", g)}
                        />
                        <span>
                          {t(g, lang)}
                          {facets !== null && <span className="text-[10px] text-sonic-silver ml-1 font-bold">({count})</span>}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Season Sub-section */}
              <div>
                <span className="block text-[10px] uppercase font-bold text-sonic-silver mb-2 tracking-wider">
                  {t("season", lang)}
                </span>
                <div className="flex flex-col gap-2.5">
                  {["Yazlık", "Kışlık", "Mevsimlik"].map((s) => {
                    const count = safeGetCount(facets?.seasons, s);
                    const isDisabled = count === 0 && facets !== null;
                    const isChecked = activeSpecs.season.includes(s);
                    return (
                      <label
                        key={s}
                        className={`flex items-center gap-2.5 text-xs font-semibold hover:text-salmon-pink cursor-pointer transition-colors duration-150 ${isDisabled && !isChecked ? "opacity-40 cursor-not-allowed pointer-events-none" : "text-onyx"
                          }`}
                      >
                        <input
                          type="checkbox"
                          className="rounded border-cultured bg-white text-salmon-pink focus:ring-salmon-pink w-4 h-4 cursor-pointer disabled:opacity-50"
                          checked={isChecked}
                          disabled={isDisabled && !isChecked}
                          onChange={() => handleSpecChange("season", s)}
                        />
                        <span>
                          {t(s, lang)}
                          {facets !== null && <span className="text-[10px] text-sonic-silver ml-1 font-bold">({count})</span>}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Section 2.5: Price Range Filter */}
        <div className="border-b border-cultured pb-4">
          <button
            type="button"
            onClick={() => toggleSection("priceRange")}
            className="flex items-center justify-between w-full text-left focus:outline-none group cursor-pointer"
          >
            <span className="text-xs uppercase font-extrabold text-eerie-black tracking-[0.5px] group-hover:text-salmon-pink transition-colors">
              {t("Price Range", lang)}
            </span>
            <ChevronDown
              size={14}
              className={`text-sonic-silver transition-transform duration-200 ${isPriceRangeOpen ? "transform rotate-180" : ""
                }`}
            />
          </button>

          {isPriceRangeOpen && (
            <div className="mt-3.5 flex flex-col gap-2.5 animate-in fade-in duration-200">
              {isAuthenticated ? (
                <>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-grow min-w-0">
                      <input
                        type="number"
                        placeholder={t("Min", lang)}
                        value={localMinPrice}
                        onChange={(e) => setLocalMinPrice(e.target.value)}
                        className="w-full bg-white border border-cultured rounded-[5px] px-2.5 py-1.5 text-xs font-semibold text-onyx focus:outline-none focus:border-salmon-pink shadow-inner"
                      />
                    </div>
                    <span className="text-sonic-silver text-xs font-bold">-</span>
                    <div className="relative flex-grow min-w-0">
                      <input
                        type="number"
                        placeholder={t("Max", lang)}
                        value={localMaxPrice}
                        onChange={(e) => setLocalMaxPrice(e.target.value)}
                        className="w-full bg-white border border-cultured rounded-[5px] px-2.5 py-1.5 text-xs font-semibold text-onyx focus:outline-none focus:border-salmon-pink shadow-inner"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMinPrice(localMinPrice);
                      setMaxPrice(localMaxPrice);
                    }}
                    className="w-full py-2 bg-salmon-pink hover:bg-eerie-black text-white text-[11px] font-extrabold uppercase rounded-[5px] transition-colors border-none cursor-pointer shadow-sm active:scale-95"
                  >
                    {t("Apply", lang)}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => openStoreAuthModal("login")}
                  className="w-full py-2 px-3 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-[10.5px] font-extrabold uppercase rounded-[5px] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Lock className="w-3.5 h-3.5 shrink-0" />
                  <span>{getShortMemberPriceLabel(lang)}</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Section 3: Dynamic Product Attributes Filters */}
        {Object.entries(attributes).map(([attrName, values]) => {
          if (attrName === "__proto__" || attrName === "constructor") return null;

          const isSectionOpenCurrent = isSectionOpen(attrName);

          return (
            <div key={attrName} className="border-b border-cultured last:border-b-0 pb-4 last:pb-0">
              <button
                type="button"
                onClick={() => toggleSection(attrName)}
                className="flex items-center justify-between w-full text-left focus:outline-none group cursor-pointer"
              >
                <span className="text-xs uppercase font-extrabold text-eerie-black tracking-[0.5px] group-hover:text-salmon-pink transition-colors">
                  {t(attrName, lang)}
                </span>
                <ChevronDown
                  size={14}
                  className={`text-sonic-silver transition-transform duration-200 ${isSectionOpenCurrent ? "transform rotate-180" : ""
                    }`}
                />
              </button>

              {isSectionOpenCurrent && (
                <div className="flex flex-col gap-2.5 max-h-48 overflow-y-auto pr-1 mt-3.5 animate-in fade-in duration-200">
                  {values.map((val) => {
                    const isChecked = (
                      attrName !== "__proto__" &&
                      attrName !== "constructor" &&
                      Object.hasOwn(activeAttributes, attrName)
                    ) ? (Reflect.get(activeAttributes, attrName) as string[])?.includes(val) : false;

                    const count = safeGetAttributeCount(facets?.attributes, attrName, val);
                    const isDisabled = count === 0 && facets !== null;
                    return (
                      <label
                        key={val}
                        className={`flex items-center gap-2.5 text-xs font-semibold hover:text-salmon-pink cursor-pointer transition-colors duration-150 ${isDisabled && !isChecked ? "opacity-40 cursor-not-allowed pointer-events-none" : "text-onyx"
                          }`}
                      >
                        <input
                          type="checkbox"
                          className="rounded border-cultured bg-white text-salmon-pink focus:ring-salmon-pink w-4 h-4 cursor-pointer disabled:opacity-50"
                          checked={isChecked}
                          disabled={isDisabled && !isChecked}
                          onChange={() => handleAttributeChange(attrName, val)}
                        />
                        <span>
                          {t(val, lang)}
                          {facets !== null && <span className="text-[10px] text-sonic-silver ml-1 font-bold">({count})</span>}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

      </div>
    </aside>
  );
}
