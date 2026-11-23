"use client";

import React, { useRef, useState, useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { Search, ShoppingBag, Heart, User, ChevronDown, Menu, Smartphone } from "lucide-react";
import {
  languages,
  t,
  getCategoryPrefix as getCategoryPrefixFn,
  getCategoryTitle,
  getCategoryUrl,
  normalizeLangCode,
  pickLangText,
  SupportedLangCode,
} from "@/app/i18n";
import { Category } from "@/types/store";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "@/app/utils";
import {
  clearStoreSession,
  endCustomerImpersonationSession,
  getValidStoreUser,
  isStoreSessionImpersonated,
  StoreUser,
  writeSharedCookie,
} from "@/app/storeAuth";
import { ROOT_ORIGIN, isSupplierSubdomainHostname } from "@/utils/subdomain";
import { clearStoreCartOnLogout, pullAndReconcileStoreCart } from "@/utils/cartSync";
import ImpersonationBanner from "./ImpersonationBanner";
import AuthModal from "./AuthModal";
import WishlistDrawer from "./WishlistDrawer";
import CustomerNotificationBell from "./CustomerNotificationBell";
import { useWishlistStore } from "@/store/useWishlistStore";
import { formatAsciiSafeUpper } from "@/utils/formatters";

const getFlagUrl = (code: string): string => {
  const mapping: Record<string, string> = {
    tr: "tr",
    en: "gb",
    ar: "sa",
    ru: "ru",
    pl: "pl",
    bg: "bg",
    de: "de",
    fr: "fr",
  };
  const country = mapping[code] || code;
  return `https://flagcdn.com/w20/${country.toLowerCase()}.png`;
};

interface LanguageItem {
  code: string;
  label: string;
  flag?: string;
  categoryPrefix?: string;
  dir?: string;
  sort_order?: number;
}

interface CurrencyOption {
  code: string;
  label: string;
  flag: string;
}

interface HeaderTexts {
  manufacturers: string;
  buyingLeads: string;
  b2bServices: string;
  androidApp: string;
  officialAndroidApp: string;
  getApk: string;
  submitSearch: string;
  myWishlist: string;
  myCart: string;
  userMenu: string;
  loginOrRegister: string;
  emailUnverifiedShort: string;
  emailUnverified: string;
  verifyNow: string;
  newArrivals: string;
  last7Days: string;
  favoriteSuppliers: string;
  notifications: string;
}

const HEADER_TEXTS: Record<SupportedLangCode, HeaderTexts> = {
  tr: {
    manufacturers: "ÜRETİCİ FİRMALAR",
    buyingLeads: "ALIM TALEPLERİ (RFQ)",
    b2bServices: "LOJİSTİK & HİZMETLER",
    androidApp: "ANDROID APK",
    officialAndroidApp: "Resmi Android Uygulaması",
    getApk: "APK İNDİR",
    submitSearch: "Arama yap",
    myWishlist: "Favorilerim",
    myCart: "Sepetim",
    userMenu: "Kullanıcı menüsü",
    loginOrRegister: "Giriş yap veya kayıt ol",
    emailUnverifiedShort: "⚠️ Mail Onaysız",
    emailUnverified: "⚠️ E-Posta Onaysız",
    verifyNow: "Doğrula",
    newArrivals: "YENİ ÜRÜNLER",
    last7Days: "Son 7 Gün",
    favoriteSuppliers: "Favori Tedarikçilerim",
    notifications: "Bildirimlerim",
  },
  en: {
    manufacturers: "MANUFACTURERS",
    buyingLeads: "BUYING LEADS (RFQ)",
    b2bServices: "B2B SERVICES",
    androidApp: "ANDROID APP",
    officialAndroidApp: "Official Android App",
    getApk: "GET APK",
    submitSearch: "Submit search",
    myWishlist: "My Wishlist",
    myCart: "My Cart",
    userMenu: "User menu",
    loginOrRegister: "Login or register",
    emailUnverifiedShort: "⚠️ Unverified Email",
    emailUnverified: "⚠️ Email Unverified",
    verifyNow: "Verify",
    newArrivals: "NEW ARRIVALS",
    last7Days: "Last 7 Days",
    favoriteSuppliers: "Favorite Suppliers",
    notifications: "Notifications",
  },
  ru: {
    manufacturers: "ФАБРИКИ",
    buyingLeads: "ЗАЯВКИ (RFQ)",
    b2bServices: "УСЛУГИ B2B",
    androidApp: "ANDROID APK",
    officialAndroidApp: "Официальное Android-приложение",
    getApk: "СКАЧАТЬ APK",
    submitSearch: "Найти",
    myWishlist: "Избранное",
    myCart: "Моя корзина",
    userMenu: "Меню пользователя",
    loginOrRegister: "Войти или зарегистрироваться",
    emailUnverifiedShort: "⚠️ Почта не подтв.",
    emailUnverified: "⚠️ Email не подтвержден",
    verifyNow: "Подтвердить",
    newArrivals: "НОВИНКИ",
    last7Days: "За 7 дней",
    favoriteSuppliers: "Избранные поставщики",
    notifications: "Уведомления",
  },
  ar: {
    manufacturers: "المصنّعون",
    buyingLeads: "طلبات الشراء (RFQ)",
    b2bServices: "الشحن والخدمات",
    androidApp: "تطبيق أندرويد",
    officialAndroidApp: "تطبيق أندرويد الرسمي",
    getApk: "تحميل APK",
    submitSearch: "بحث",
    myWishlist: "المفضلة",
    myCart: "سلتي",
    userMenu: "قائمة المستخدم",
    loginOrRegister: "تسجيل الدخول أو إنشاء حساب",
    emailUnverifiedShort: "⚠️ البريد غير مؤكد",
    emailUnverified: "⚠️ البريد الإلكتروني غير مؤكد",
    verifyNow: "تأكيد",
    newArrivals: "وصل حديثاً",
    last7Days: "آخر 7 أيام",
    favoriteSuppliers: "الموردون المفضلون",
    notifications: "الإشعارات",
  },
  de: {
    manufacturers: "HERSTELLER",
    buyingLeads: "KAUFGESUCHE (RFQ)",
    b2bServices: "B2B-SERVICES",
    androidApp: "ANDROID APP",
    officialAndroidApp: "Offizielle Android-App",
    getApk: "APK LADEN",
    submitSearch: "Suche starten",
    myWishlist: "Meine Favoriten",
    myCart: "Mein Warenkorb",
    userMenu: "Benutzermenü",
    loginOrRegister: "Anmelden oder registrieren",
    emailUnverifiedShort: "⚠️ E-Mail unbestätigt",
    emailUnverified: "⚠️ E-Mail nicht bestätigt",
    verifyNow: "Bestätigen",
    newArrivals: "NEUHEITEN",
    last7Days: "Letzte 7 Tage",
    favoriteSuppliers: "Favorisierte Hersteller",
    notifications: "Benachrichtigungen",
  },
  fr: {
    manufacturers: "FABRICANTS",
    buyingLeads: "APPELS RFQ",
    b2bServices: "SERVICES B2B",
    androidApp: "APP ANDROID",
    officialAndroidApp: "Application Android Officielle",
    getApk: "TÉLÉCHARGER APK",
    submitSearch: "Lancer la recherche",
    myWishlist: "Mes Favoris",
    myCart: "Mon Panier",
    userMenu: "Menu utilisateur",
    loginOrRegister: "Connexion ou inscription",
    emailUnverifiedShort: "⚠️ E-mail non vérifié",
    emailUnverified: "⚠️ Adresse e-mail non vérifiée",
    verifyNow: "Vérifier",
    newArrivals: "NOUVEAUTÉS",
    last7Days: "7 derniers jours",
    favoriteSuppliers: "Fournisseurs favoris",
    notifications: "Notifications",
  },
  pl: {
    manufacturers: "PRODUCENCI",
    buyingLeads: "ZAPYTANIA RFQ",
    b2bServices: "USŁUGI B2B",
    androidApp: "ANDROID APK",
    officialAndroidApp: "Oficjalna aplikacja Android",
    getApk: "POBIERZ APK",
    submitSearch: "Szukaj",
    myWishlist: "Ulubione",
    myCart: "Mój koszyk",
    userMenu: "Menu użytkownika",
    loginOrRegister: "Zaloguj lub zarejestruj się",
    emailUnverifiedShort: "⚠️ E-mail niezweryf.",
    emailUnverified: "⚠️ E-mail niezweryfikowany",
    verifyNow: "Zweryfikuj",
    newArrivals: "NOWOŚCI",
    last7Days: "Ostatnie 7 dni",
    favoriteSuppliers: "Ulubieni dostawcy",
    notifications: "Powiadomienia",
  },
  bg: {
    manufacturers: "ПРОИЗВОДИТЕЛИ",
    buyingLeads: "ЗАПИТВАНИЯ (RFQ)",
    b2bServices: "B2B УСЛУГИ",
    androidApp: "ANDROID APK",
    officialAndroidApp: "Официално Android приложение",
    getApk: "ИЗТЕГЛИ APK",
    submitSearch: "Търсене",
    myWishlist: "Любими",
    myCart: "Моята количка",
    userMenu: "Потребителско меню",
    loginOrRegister: "Вход или регистрация",
    emailUnverifiedShort: "⚠️ Непотвърден имейл",
    emailUnverified: "⚠️ Имейлът не е потвърден",
    verifyNow: "Потвърди",
    newArrivals: "НОВИ ПРОДУКТИ",
    last7Days: "Последните 7 дни",
    favoriteSuppliers: "Любими доставчици",
    notifications: "Известия",
  },
};

const QUERY_LOCALIZED_ROUTES = [
  "/product/",
  "/ureticiler",
  "/alim-talepleri",
  "/hizmet-saglayicilar",
  "/mobil-uygulama",
] as const;

function buildQueryLocalizedRouteHref(basePath: string, lang: string): string {
  const safeCode = normalizeLangCode(lang);
  if (safeCode === "tr") {
    return basePath;
  }
  return `${basePath}?lang=${safeCode}`;
}

function isQueryLocalizedPathname(pathname: string): boolean {
  return QUERY_LOCALIZED_ROUTES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`)
  );
}

function resolveLanguageSwitchUrl(
  pathname: string,
  currentSearch: string,
  oldPrefix: string,
  newCode: string
): string | null {
  const newPrefix = getCategoryPrefixFn(newCode);
  if (pathname === `/${oldPrefix}`) {
    return `/${newPrefix}${currentSearch}`;
  }
  const oldSegment = `/${oldPrefix}/`;
  const newSegment = `/${newPrefix}/`;
  if (pathname.startsWith(oldSegment)) {
    return `${pathname.replace(oldSegment, newSegment)}${currentSearch}`;
  }
  if (isQueryLocalizedPathname(pathname)) {
    const params = new URLSearchParams(currentSearch);
    if (normalizeLangCode(newCode) === "tr") {
      params.delete("lang");
    } else {
      params.set("lang", normalizeLangCode(newCode));
    }
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }
  return null;
}

const currenciesList: readonly CurrencyOption[] = [
  { code: "TRY", label: "TRY (TL)", flag: "🇹🇷" },
  { code: "USD", label: "USD ($)", flag: "🇺🇸" },
  { code: "EUR", label: "EUR (€)", flag: "🇪🇺" },
  { code: "GBP", label: "GBP (£)", flag: "🇬🇧" },
];

interface HeaderProps {
  readonly lang: string;
  readonly setLang: (lang: string) => void;
  readonly isLangOpen: boolean;
  readonly setIsLangOpen: (open: boolean) => void;
  readonly totalPkgs: number;
  readonly setIsCartOpen: (open: boolean) => void;
  readonly searchQuery?: string;
  readonly setSearchQuery?: (query: string) => void;
  readonly setCurrentPage: (page: number) => void;
  readonly setActiveCategoryId?: (catId: string) => void;
  readonly categories: readonly Category[];
  readonly activeCategoryId: string;
  readonly displayCurrency: string;
  readonly onCurrencyChange: (currency: string) => void;
}

interface HeaderTopBarProps {
  readonly lang: string;
  readonly isLangOpen: boolean;
  readonly setIsLangOpen: (open: boolean) => void;
  readonly activeLanguages: readonly LanguageItem[];
  readonly onSelectLanguage: (code: string) => void;
  readonly displayCurrency: string;
  readonly isCurrencyOpen: boolean;
  readonly setIsCurrencyOpen: (open: boolean) => void;
  readonly onCurrencyChange: (currency: string) => void;
}

function HeaderTopBar({
  lang,
  isLangOpen,
  setIsLangOpen,
  activeLanguages,
  onSelectLanguage,
  displayCurrency,
  isCurrencyOpen,
  setIsCurrencyOpen,
  onCurrencyChange,
}: Readonly<HeaderTopBarProps>) {
  const currentLangObj = languages.find((l) => l.code === lang) || languages[0];
  const activeCurrObj = currenciesList.find((c) => c.code === displayCurrency) || currenciesList[0];
  const ui = pickLangText(lang, HEADER_TEXTS);
  const closeLabel = t("close", lang);

  return (
    <div className="hidden sm:block border-b border-cultured py-2.5 text-[13px] text-sonic-silver">
      <div className="max-w-[1720px] mx-auto px-4 flex items-center justify-between">
        {/* Social Links with accessible, valid destinations */}
        <div className="flex items-center gap-3">
          <a
            href="https://facebook.com/mertervitrini"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Facebook"
            className="p-1 text-davys-gray hover:text-salmon-pink transition-colors"
          >
            <svg className="w-[15px] h-[15px] fill-current" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z" />
            </svg>
          </a>
          <a
            href="https://x.com/mertervitrini"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Twitter"
            className="p-1 text-davys-gray hover:text-salmon-pink transition-colors"
          >
            <svg className="w-[15px] h-[15px] fill-current" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" />
            </svg>
          </a>
          <a
            href="https://instagram.com/mertervitrini"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className="p-1 text-davys-gray hover:text-salmon-pink transition-colors"
          >
            <svg className="w-[15px] h-[15px] fill-none stroke-current stroke-2" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
            </svg>
          </a>
          <a
            href="https://linkedin.com/company/mertervitrini"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LinkedIn"
            className="p-1 text-davys-gray hover:text-salmon-pink transition-colors"
          >
            <svg className="w-[15px] h-[15px] fill-current" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.779-1.75-1.75s.784-1.75 1.75-1.75 1.75.779 1.75 1.75-.784 1.75-1.75 1.75zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
            </svg>
          </a>
        </div>

        {/* Alert text */}
        <div className="font-medium text-center uppercase tracking-[0.5px]">
          <span className="text-salmon-pink font-semibold">{t("wholesale_alert", lang)}</span> — {t("alert_desc", lang)}
        </div>

        {/* Language & Currency Selectors */}
        <div className="flex items-center gap-2">
          {normalizeLangCode(lang) === "tr" && (
            <Link
              href="/toptan-hazir-giyim"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white text-[#1C1C1C] border border-[#D6D1C7] hover:border-[#1C1C1C] font-bold text-[11px] tracking-wider transition-colors whitespace-nowrap no-underline"
            >
              <span>TOPTAN HAZIR GİYİM</span>
            </Link>
          )}
          <Link
            href={buildQueryLocalizedRouteHref("/ureticiler", lang)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#F8F6F2] text-[#1C1C1C] border border-[#E5E0D8] hover:border-[#1C1C1C] hover:bg-[#EFECE6] font-bold text-[11px] tracking-wider transition-colors whitespace-nowrap no-underline"
          >
            <span>{lang === "ar" ? ui.manufacturers : formatAsciiSafeUpper(ui.manufacturers)}</span>
          </Link>
          <Link
            href={buildQueryLocalizedRouteHref("/alim-talepleri", lang)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#F8F6F2] text-[#1C1C1C] border border-[#E5E0D8] hover:border-[#1C1C1C] hover:bg-[#EFECE6] font-bold text-[11px] tracking-wider transition-colors whitespace-nowrap no-underline"
          >
            <span>{lang === "ar" ? ui.buyingLeads : formatAsciiSafeUpper(ui.buyingLeads)}</span>
          </Link>
          <Link
            href={buildQueryLocalizedRouteHref("/hizmet-saglayicilar", lang)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#F8F6F2] text-[#1C1C1C] border border-[#E5E0D8] hover:border-[#1C1C1C] hover:bg-[#EFECE6] font-bold text-[11px] tracking-wider transition-colors whitespace-nowrap no-underline"
          >
            <span>{lang === "ar" ? ui.b2bServices : formatAsciiSafeUpper(ui.b2bServices)}</span>
          </Link>
          <Link
            href={buildQueryLocalizedRouteHref("/mobil-uygulama", lang)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#F8F6F2] text-[#1C1C1C] border border-[#E5E0D8] hover:border-[#1C1C1C] hover:bg-[#EFECE6] font-bold text-[11px] tracking-wider transition-colors whitespace-nowrap no-underline"
          >
            <Smartphone className="w-3.5 h-3.5 text-[#8C6D3F] shrink-0" />
            <span>{lang === "ar" ? ui.androidApp : formatAsciiSafeUpper(ui.androidApp)}</span>
          </Link>
          {/* Language selector */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsLangOpen(!isLangOpen)}
              className="flex items-center gap-1.5 px-3 py-1 bg-white hover:text-accent-gold font-bold text-xs uppercase tracking-wide transition-colors cursor-pointer border-none"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getFlagUrl(lang)}
                alt={lang}
                className="w-4.5 h-3.5 object-cover rounded-sm border border-black/5 shrink-0"
              />
              <span>{currentLangObj.code}</span>
              <ChevronDown className={`w-3 h-3 transition-transform duration-300 ${isLangOpen ? "rotate-180" : ""}`} />
            </button>

            {isLangOpen && (
              <>
                <button
                  type="button"
                  aria-label={closeLabel}
                  tabIndex={-1}
                  className="fixed inset-0 z-40 bg-transparent border-none cursor-default"
                  onClick={() => setIsLangOpen(false)}
                />
                <div className="absolute right-0 top-7 bg-white border border-cultured rounded-none shadow-md min-w-[160px] overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100">
                  {activeLanguages.map((l) => (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => onSelectLanguage(l.code)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-xs font-bold transition-colors cursor-pointer border-none uppercase ${
                        lang === l.code
                          ? "text-accent-gold bg-cultured"
                          : "text-onyx hover:bg-cultured hover:text-eerie-black"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={getFlagUrl(l.code)}
                        alt={l.label}
                        className="w-4.5 h-3.5 object-cover rounded-sm border border-black/5 shrink-0"
                      />
                      <span>{l.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Currency selector */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsCurrencyOpen(!isCurrencyOpen)}
              className="flex items-center gap-1 px-3 py-1 bg-white hover:text-accent-gold font-bold text-xs uppercase tracking-wide transition-colors cursor-pointer border-none"
            >
              <span>{activeCurrObj.code}</span>
              <ChevronDown className={`w-3 h-3 transition-transform duration-300 ${isCurrencyOpen ? "rotate-180" : ""}`} />
            </button>

            {isCurrencyOpen && (
              <>
                <button
                  type="button"
                  aria-label={closeLabel}
                  tabIndex={-1}
                  className="fixed inset-0 z-40 bg-transparent border-none cursor-default"
                  onClick={() => setIsCurrencyOpen(false)}
                />
                <div className="absolute right-0 top-7 bg-white border border-cultured rounded-none shadow-md min-w-[100px] overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100">
                  {currenciesList.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => {
                        onCurrencyChange(c.code);
                        setIsCurrencyOpen(false);
                      }}
                      className={`w-full flex items-center px-3 py-2 text-left text-xs font-bold transition-colors cursor-pointer border-none ${
                        displayCurrency === c.code
                          ? "text-accent-gold bg-cultured"
                          : "text-onyx hover:bg-cultured hover:text-eerie-black"
                      }`}
                    >
                      <span>{c.code}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface HeaderNavbarProps {
  readonly lang: string;
  readonly categories: readonly Category[];
  readonly activeCategoryId: string;
  readonly getCategoryPrefix: () => string;
}

interface MegaMenuDropdownProps {
  readonly parentCategory: Category;
  readonly categories: readonly Category[];
  readonly activeCategoryId: string;
  readonly lang: string;
  readonly onNavigate: (url: string) => void;
}

const MEGA_MENU_GRID_CLASSES: Record<number, string> = {
  1: "grid-cols-1 max-w-xs",
  2: "grid-cols-2 max-w-2xl",
  3: "grid-cols-3 max-w-4xl",
  4: "grid-cols-4 max-w-5xl",
};

function MegaMenuDropdown({
  parentCategory,
  categories,
  activeCategoryId,
  lang,
  onNavigate,
}: Readonly<MegaMenuDropdownProps>) {
  const children = parentCategory.children || [];
  const populatedSubs = children.filter((sub) => sub.children && sub.children.length > 0);
  const childlessSubs = children.filter((sub) => !sub.children || sub.children.length === 0);
  const totalCols = Math.min(4, Math.max(1, populatedSubs.length + (childlessSubs.length > 0 ? 1 : 0)));
  const gridColClass = MEGA_MENU_GRID_CLASSES[totalCols] || MEGA_MENU_GRID_CLASSES[4];

  return (
    <div
      className={`absolute left-1/2 -translate-x-1/2 top-full pt-4 z-50 w-[90vw] ${gridColClass} transition-all duration-300 opacity-0 invisible translate-y-2 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 pointer-events-none group-hover:pointer-events-auto`}
    >
      <div className={`bg-white border border-[#E5E0D8] rounded-md shadow-lg p-8 grid ${gridColClass} gap-x-8 gap-y-6`}>
        {populatedSubs.map((sub) => (
          <div key={sub.id} className="flex flex-col">
            <button
              type="button"
              onClick={() => onNavigate(getCategoryUrl(categories as Category[], sub, lang))}
              className={`text-start font-extrabold text-[13px] tracking-wider uppercase mb-3 border-none bg-transparent cursor-pointer transition-colors ${
                activeCategoryId === sub.slug || activeCategoryId === sub.id
                  ? "text-salmon-pink"
                  : "text-eerie-black hover:text-salmon-pink"
              }`}
            >
              {getCategoryTitle(sub, lang)}
            </button>
            <div className="flex flex-col gap-2 border-s border-cultured ps-3">
              {(sub.children || []).map((child) => (
                <button
                  key={child.id}
                  type="button"
                  onClick={() => onNavigate(getCategoryUrl(categories as Category[], child, lang))}
                  className={`text-start text-xs font-semibold border-none bg-transparent cursor-pointer transition-colors duration-150 py-0.5 ${
                    activeCategoryId === child.slug || activeCategoryId === child.id
                      ? "text-salmon-pink font-bold"
                      : "text-sonic-silver hover:text-salmon-pink"
                  }`}
                >
                  {getCategoryTitle(child, lang)}
                </button>
              ))}
            </div>
          </div>
        ))}

        {childlessSubs.length > 0 && (
          <div className="flex flex-col gap-2.5 border-s border-cultured ps-4">
            {childlessSubs.map((sub) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => onNavigate(getCategoryUrl(categories as Category[], sub, lang))}
                className={`text-start font-bold text-[12.5px] tracking-wide uppercase py-0.5 border-none bg-transparent cursor-pointer transition-colors ${
                  activeCategoryId === sub.slug || activeCategoryId === sub.id
                    ? "text-salmon-pink"
                    : "text-eerie-black hover:text-salmon-pink"
                }`}
              >
                {getCategoryTitle(sub, lang)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function isAllProductsPathname(pathname: string): boolean {
  return pathname === "/tum-urunler" || /^\/[a-z]{2}\/tum-urunler\/?$/.test(pathname);
}

function isNewArrivalsPathname(pathname: string): boolean {
  return pathname === "/yeni-urunler" || /^\/[a-z]{2}\/yeni-urunler\/?$/.test(pathname);
}

function HeaderNavbar({
  lang,
  categories,
  activeCategoryId,
  getCategoryPrefix,
}: Readonly<HeaderNavbarProps>) {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const [hoveredNavKey, setHoveredNavKey] = useState<string | null>(null);
  const ui = pickLangText(lang, HEADER_TEXTS);
  const isNewArrivalsActive =
    isNewArrivalsPathname(pathname) &&
    (hoveredNavKey === null || hoveredNavKey === "__new__");
  const isAllProductsActive =
    activeCategoryId === "" &&
    !isNewArrivalsPathname(pathname) &&
    isAllProductsPathname(pathname) &&
    (hoveredNavKey === null || hoveredNavKey === "__all__");

  return (
    <nav
      className="bg-white border-b border-cultured py-3 hidden md:block"
      onMouseLeave={() => setHoveredNavKey(null)}
    >
      <div className="max-w-[1720px] mx-auto px-4 flex items-center justify-center gap-7 lg:gap-8">
        <button
          type="button"
          onMouseEnter={() => setHoveredNavKey("__all__")}
          onClick={() => {
            router.push(`/${getCategoryPrefix()}/tum-urunler`);
          }}
          className={`text-[13px] font-bold tracking-[0.5px] uppercase transition-colors border-none bg-transparent cursor-pointer relative after:absolute after:bottom-[-6px] after:left-0 after:right-0 after:h-[2px] after:bg-salmon-pink after:transition-all after:duration-200 ${
            isAllProductsActive
              ? "text-salmon-pink after:scale-x-100"
              : "text-onyx hover:text-salmon-pink after:scale-x-0 hover:after:scale-x-100"
          }`}
        >
          {t("all_products", lang)}
        </button>

        <button
          type="button"
          onMouseEnter={() => setHoveredNavKey("__new__")}
          onClick={() => {
            router.push(`/${getCategoryPrefix()}/yeni-urunler`);
          }}
          className={`inline-flex items-center gap-1.5 text-[13px] font-bold tracking-[0.5px] uppercase transition-colors border-none bg-transparent cursor-pointer relative after:absolute after:bottom-[-6px] after:left-0 after:right-0 after:h-[2px] after:bg-salmon-pink after:transition-all after:duration-200 ${
            isNewArrivalsActive
              ? "text-salmon-pink after:scale-x-100"
              : "text-onyx hover:text-salmon-pink after:scale-x-0 hover:after:scale-x-100"
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-salmon-pink shrink-0" />
          <span>{ui.newArrivals}</span>
        </button>

        {categories.map((cat) => {
          const isCatActive =
            (activeCategoryId === cat.slug || activeCategoryId === cat.id) &&
            (hoveredNavKey === null || hoveredNavKey === cat.id);
          return (
            <div
              key={cat.id}
              className="relative group py-2"
              onMouseEnter={() => setHoveredNavKey(cat.id)}
            >
              <button
                type="button"
                onClick={() => {
                  router.push(getCategoryUrl(categories as Category[], cat, lang));
                }}
                className={`text-[13px] font-bold tracking-[0.5px] uppercase transition-colors border-none bg-transparent cursor-pointer relative after:absolute after:bottom-[-6px] after:left-0 after:right-0 after:h-[2px] after:bg-salmon-pink after:transition-all after:duration-200 ${
                  isCatActive
                    ? "text-salmon-pink after:scale-x-100"
                    : "text-onyx hover:text-salmon-pink after:scale-x-0 hover:after:scale-x-100"
                }`}
              >
                {getCategoryTitle(cat, lang)}
              </button>

              {cat.children && cat.children.length > 0 && (
                <MegaMenuDropdown
                  parentCategory={cat}
                  categories={categories}
                  activeCategoryId={activeCategoryId}
                  lang={lang}
                  onNavigate={(url) => router.push(url)}
                />
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}

interface MobileCategoryAccordionProps {
  readonly lang: string;
  readonly categories: readonly Category[];
  readonly activeCategoryId: string;
  readonly isMobileMenuOpen: boolean;
  readonly setIsMobileMenuOpen: (open: boolean) => void;
  readonly expandedMobileCategories: Record<string, boolean>;
  readonly toggleMobileCategory: (catId: string, e: React.MouseEvent) => void;
  readonly getCategoryPrefix: () => string;
}

function MobileCategoryAccordion({
  lang,
  categories,
  activeCategoryId,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  expandedMobileCategories,
  toggleMobileCategory,
  getCategoryPrefix,
}: Readonly<MobileCategoryAccordionProps>) {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const isNewArrivals = isNewArrivalsPathname(pathname);
  const ui = pickLangText(lang, HEADER_TEXTS);

  const findInTree = (cats: readonly Category[]): Category | null => {
    for (const c of cats) {
      if (c.slug === activeCategoryId || c.id === activeCategoryId) return c;
      if (c.children) {
        const f = findInTree(c.children);
        if (f) return f;
      }
    }
    return null;
  };

  const activeObj = activeCategoryId ? findInTree(categories) : null;
  const activeTitle = activeObj ? getCategoryTitle(activeObj, lang) : "";

  let mobileCategoryBadge: React.ReactNode;
  if (activeTitle) {
    mobileCategoryBadge = (
      <span
        style={{ backgroundColor: "rgba(230, 23, 48, 0.15)", color: "#e61730" }}
        className="px-2 py-0.5 rounded-full text-[10px] font-extrabold max-w-[80px] xs:max-w-[120px] truncate animate-fade-in shrink-0"
      >
        {activeTitle}
      </span>
    );
  } else if (isNewArrivals) {
    mobileCategoryBadge = (
      <span
        style={{ backgroundColor: "rgba(230, 23, 48, 0.15)", color: "#e61730" }}
        className="px-2 py-0.5 rounded-full text-[10px] font-extrabold max-w-[110px] xs:max-w-[140px] truncate animate-fade-in shrink-0"
      >
        {ui.newArrivals}
      </span>
    );
  } else {
    mobileCategoryBadge = (
      <span className="px-2 py-0.5 bg-zinc-100 text-zinc-700 rounded-full text-[10px] font-extrabold max-w-[80px] xs:max-w-[120px] truncate">
        {t("all_products", lang)}
      </span>
    );
  }

  return (
    <div className="relative md:hidden bg-white border-b border-cultured px-2.5 xs:px-4 py-2.5 select-none">
      <div className="flex gap-1.5 xs:gap-2 w-full">
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="flex-1 flex items-center justify-between px-2 xs:px-4 py-2 bg-zinc-50 border border-zinc-200/60 rounded-xl hover:bg-zinc-100/80 text-xs font-bold text-onyx transition-all duration-200 cursor-pointer"
        >
          <div className="flex items-center gap-1.5 xs:gap-2">
            <Menu className="w-4 h-4 text-salmon-pink shrink-0" />
            <span className="truncate">{t("select_category", lang)}</span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {mobileCategoryBadge}
            <ChevronDown className="w-3 h-3 text-zinc-700 transition-transform duration-300 shrink-0" />
          </div>
        </button>
      </div>

      {isMobileMenuOpen && (
        <button
          type="button"
          aria-label={t("close", lang)}
          tabIndex={-1}
          className="fixed inset-0 top-[210px] sm:top-[220px] bg-black/25 backdrop-blur-[2px] z-40 border-none cursor-default"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {isMobileMenuOpen && (
        <div className="absolute left-0 right-0 top-full bg-white border-b border-cultured shadow-2xl z-50 overflow-hidden animate-in slide-in-from-top-4 duration-300 max-h-[70vh] overflow-y-auto">
          <div className="px-4 py-3 flex flex-col divide-y divide-zinc-100">
            <div className="py-2.5">
              <button
                type="button"
                onClick={() => {
                  router.push(`/${getCategoryPrefix()}/tum-urunler`);
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full text-left text-xs font-bold uppercase transition-colors border-none bg-transparent cursor-pointer ${
                  activeCategoryId === "" && !isNewArrivals ? "text-salmon-pink" : "text-eerie-black hover:text-salmon-pink"
                }`}
              >
                ✨ {t("all_products", lang)}
              </button>
            </div>

            <div className="py-2.5">
              <button
                type="button"
                onClick={() => {
                  router.push(`/${getCategoryPrefix()}/yeni-urunler`);
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2 text-left text-xs font-extrabold uppercase transition-colors border-none bg-transparent cursor-pointer ${
                  isNewArrivals ? "text-salmon-pink" : "text-eerie-black hover:text-salmon-pink"
                }`}
              >
                <span>🆕 {ui.newArrivals}</span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-salmon-pink/10 text-salmon-pink">
                  {ui.last7Days}
                </span>
              </button>
            </div>

            {categories.map((cat) => {
              const hasChildren = cat.children && cat.children.length > 0;
              const isExpanded = Boolean(expandedMobileCategories[cat.id]);
              const isActive = activeCategoryId === cat.slug || activeCategoryId === cat.id;

              return (
                <div key={cat.id} className="py-2.5 flex flex-col">
                  <div className="flex items-center justify-between w-full">
                    <button
                      type="button"
                      onClick={() => {
                        router.push(getCategoryUrl(categories as Category[], cat, lang));
                        setIsMobileMenuOpen(false);
                      }}
                      className={`text-left text-xs font-extrabold uppercase transition-colors border-none bg-transparent cursor-pointer flex-1 py-1 ${
                        isActive ? "text-salmon-pink" : "text-eerie-black hover:text-salmon-pink"
                      }`}
                    >
                      {getCategoryTitle(cat, lang)}
                    </button>

                    {hasChildren && (
                      <button
                        type="button"
                        onClick={(e) => toggleMobileCategory(cat.id, e)}
                        className="p-2 -mr-2 text-zinc-500 hover:text-salmon-pink transition-colors border-none bg-transparent cursor-pointer flex items-center justify-center rounded-full hover:bg-zinc-50"
                      >
                        <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`} />
                      </button>
                    )}
                  </div>

                  {hasChildren && isExpanded && (
                    <div className="mt-2 pl-3 ml-1 border-l-2 border-zinc-100 flex flex-col gap-2.5 animate-in fade-in duration-200">
                      {cat.children!.map((sub) => {
                        const hasSubChildren = sub.children && sub.children.length > 0;
                        const isSubExpanded = Boolean(expandedMobileCategories[sub.id]);
                        const isSubActive = activeCategoryId === sub.slug || activeCategoryId === sub.id;

                        return (
                          <div key={sub.id} className="flex flex-col gap-1.5 py-0.5">
                            <div className="flex items-center justify-between w-full">
                              <button
                                type="button"
                                onClick={() => {
                                  router.push(getCategoryUrl(categories as Category[], sub, lang));
                                  setIsMobileMenuOpen(false);
                                }}
                                className={`text-left text-xs font-bold transition-colors border-none bg-transparent cursor-pointer flex-1 py-0.5 ${
                                  isSubActive ? "text-salmon-pink" : "text-onyx hover:text-salmon-pink"
                                }`}
                              >
                                {getCategoryTitle(sub, lang)}
                              </button>

                              {hasSubChildren && (
                                <button
                                  type="button"
                                  onClick={(e) => toggleMobileCategory(sub.id, e)}
                                  className="p-1 text-zinc-400 hover:text-salmon-pink transition-colors border-none bg-transparent cursor-pointer flex items-center justify-center rounded-full hover:bg-zinc-50"
                                >
                                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${isSubExpanded ? "rotate-180" : ""}`} />
                                </button>
                              )}
                            </div>

                            {hasSubChildren && isSubExpanded && (
                              <div className="pl-3.5 border-l border-zinc-100/80 flex flex-wrap gap-1.5 py-1 animate-in fade-in duration-200">
                                {sub.children!.map((child) => {
                                  const isChildActive = activeCategoryId === child.slug || activeCategoryId === child.id;

                                  return (
                                    <button
                                      key={child.id}
                                      type="button"
                                      onClick={() => {
                                        router.push(getCategoryUrl(categories as Category[], child, lang));
                                        setIsMobileMenuOpen(false);
                                      }}
                                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                                        isChildActive
                                          ? "bg-salmon-pink/10 text-salmon-pink border-salmon-pink/30"
                                          : "bg-zinc-50 text-sonic-silver border-zinc-150/50 hover:bg-zinc-100 hover:text-onyx"
                                      }`}
                                    >
                                      {getCategoryTitle(child, lang)}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Header({
  lang,
  setLang,
  isLangOpen,
  setIsLangOpen,
  totalPkgs,
  setIsCartOpen,
  searchQuery,
  setSearchQuery,
  setCurrentPage,
  categories,
  activeCategoryId,
  displayCurrency,
  onCurrencyChange,
}: Readonly<HeaderProps>) {
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const isSubdomainHost = useSyncExternalStore(
    () => () => {},
    () => isSupplierSubdomainHostname(window.location.hostname),
    () => false
  );

  const [activeLanguages, setActiveLanguages] = useState<LanguageItem[]>(languages);
  const [user, setUser] = useState<StoreUser | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");

  const [isCurrencyOpen, setIsCurrencyOpen] = useState(false);
  const wishlistCount = useWishlistStore((state) => state.wishlistIds.length);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);

  const activeCurrObj = currenciesList.find((c) => c.code === displayCurrency) || currenciesList[0];
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [expandedMobileCategories, setExpandedMobileCategories] = useState<Record<string, boolean>>({});

  const toggleMobileCategory = (catId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedMobileCategories((prev) => ({
      ...prev,
      [catId]: !prev[catId],
    }));
  };

  const checkAuth = () => {
    setUser(getValidStoreUser<StoreUser>());
  };

  useEffect(() => {
    queueMicrotask(() => {
      setUser(getValidStoreUser<StoreUser>());
      void pullAndReconcileStoreCart();
    });

    const handleAuthChange = () => {
      checkAuth();
      void pullAndReconcileStoreCart();
    };
    const handleFocus = () => {
      void pullAndReconcileStoreCart();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void pullAndReconcileStoreCart();
      }
    };

    window.addEventListener("auth-change", handleAuthChange);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const handleOpenAuth = (e: Event) => {
      const customEvent = e as CustomEvent<{ mode: "login" | "register" }>;
      if (customEvent.detail?.mode) {
        setAuthMode(customEvent.detail.mode);
        setIsAuthOpen(true);
      }
    };
    window.addEventListener("merter-open-auth", handleOpenAuth);

    return () => {
      window.removeEventListener("auth-change", handleAuthChange);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("merter-open-auth", handleOpenAuth);
    };
  }, []);

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      if (isStoreSessionImpersonated()) {
        endCustomerImpersonationSession();
        setIsUserMenuOpen(false);
        if (window.opener) {
          window.close();
          return;
        }
        window.location.href = "/admin/customers";
        return;
      }

      clearStoreCartOnLogout();
      clearStoreSession(true);
      setIsUserMenuOpen(false);
      window.dispatchEvent(new Event("auth-change"));

      const origin = window.location.origin;
      window.location.href = origin + "/";
    }
  };

  useEffect(() => {
    void apiFetch<LanguageItem[]>("/languages")
      .then((data) => {
        if (data && data.length > 0) {
          const mapped = data.map((l) => {
            let code = l.code;
            if (code.startsWith("en_")) code = "en";
            else if (code.startsWith("tr_")) code = "tr";
            else if (code.startsWith("pl_")) code = "pl";
            else if (code.startsWith("bg_")) code = "bg";
            else if (code.startsWith("de_")) code = "de";
            else if (code.startsWith("fr_")) code = "fr";
            else if (code.startsWith("ru_")) code = "ru";
            else if (code.startsWith("ar_")) code = "ar";
            return { ...l, code };
          });

          const order = ["tr", "en", "ar", "ru"];
          mapped.sort((a, b) => {
            const idxA = order.indexOf(a.code);
            const idxB = order.indexOf(b.code);
            if (idxA > -1 && idxB > -1) return idxA - idxB;
            if (idxA > -1) return -1;
            if (idxB > -1) return 1;
            const sortA = a.sort_order ?? 999;
            const sortB = b.sort_order ?? 999;
            if (sortA !== sortB) return sortA - sortB;
            return a.code.localeCompare(b.code);
          });

          setActiveLanguages(mapped);
        }
      })
      .catch((err) => console.error("Error fetching languages:", err));
  }, []);

  const getCategoryPrefix = () => {
    return getCategoryPrefixFn(lang);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery?.(val);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      const trimmed = val.trim();
      const prefix = getCategoryPrefix();
      const targetUrl = trimmed
        ? `/${prefix}/tum-urunler?q=${encodeURIComponent(trimmed)}`
        : `/${prefix}/tum-urunler`;
      router.push(targetUrl);
    }, 450);
  };

  const handleSelectLanguage = (newCode: string) => {
    const oldPrefix = getCategoryPrefix();
    setLang(newCode);
    const currentSearch = typeof window !== "undefined" ? window.location.search : "";
    if (typeof window !== "undefined") {
      localStorage.setItem("preferred_lang", newCode);
      writeSharedCookie("mv_pref_lang", newCode, 30 * 86400);
    }
    setIsLangOpen(false);
    setCurrentPage(1);
    const nextUrl = resolveLanguageSwitchUrl(pathname, currentSearch, oldPrefix, newCode);
    if (nextUrl) {
      router.push(nextUrl);
    }
  };

  const currentLangObj = languages.find((l) => l.code === lang) || languages[0];
  const ui = pickLangText(lang, HEADER_TEXTS);
  const closeLabel = t("close", lang);
  const rootLogoPath = lang && lang !== "en" ? `/${getCategoryPrefix()}` : "/";
  const profileLangQuery = lang !== "tr" ? `&lang=${lang}` : "";

  return (
    <header className="w-full bg-white select-none border-b border-cultured">
      <ImpersonationBanner lang={lang} />
      {/* Mobile Top APK Strip */}
      <div className="sm:hidden bg-[#111111] text-white px-3.5 py-2 flex items-center justify-between gap-2 border-b border-white/10">
        <div className="flex items-center gap-1.5 min-w-0">
          <Smartphone className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
          <span className="text-[10.5px] font-bold tracking-wide truncate">
            {ui.officialAndroidApp}
          </span>
        </div>
        <Link
          href={buildQueryLocalizedRouteHref("/mobil-uygulama", lang)}
          className="px-2.5 py-1 bg-[#D4AF37] text-[#111111] text-[10px] font-extrabold tracking-wider uppercase shrink-0 no-underline"
        >
          {ui.getApk}
        </Link>
      </div>

      {/* 1. Header Top Bar */}
      <HeaderTopBar
        lang={lang}
        isLangOpen={isLangOpen}
        setIsLangOpen={setIsLangOpen}
        activeLanguages={activeLanguages}
        onSelectLanguage={handleSelectLanguage}
        displayCurrency={displayCurrency}
        isCurrencyOpen={isCurrencyOpen}
        setIsCurrencyOpen={setIsCurrencyOpen}
        onCurrencyChange={onCurrencyChange}
      />

      {/* 2. Header Main Bar - Logo, Search, Actions */}
      <div className="border-b border-cultured py-4 sm:py-5 bg-white">
        <div className="max-w-[1720px] mx-auto px-4 flex flex-col sm:grid sm:grid-cols-3 sm:items-center gap-4">
          {/* Left Column (Desktop only Search) */}
          <div className="hidden sm:flex sm:col-span-1 items-center w-full justify-start">
            <div className="relative w-full max-w-[280px]">
              <div className="relative flex items-center w-full border-b border-cultured overflow-hidden focus-within:border-brand-black transition-all">
                <input
                  type="text"
                  id="searchInputDesktop"
                  value={searchQuery ?? ""}
                  className="w-full pl-0 pr-8 py-2 text-xs font-bold text-onyx placeholder-spanish-gray focus:outline-none bg-white"
                  placeholder={t("search_placeholder", lang)}
                  onChange={handleSearchChange}
                />
                <button
                  type="button"
                  aria-label={ui.submitSearch}
                  className="absolute right-0 top-0 bottom-0 px-1 bg-white hover:text-accent-gold transition-colors flex items-center justify-center cursor-pointer text-eerie-black border-none"
                >
                  <Search className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Center Column: Logo */}
          <div className="sm:col-span-1 flex items-center justify-between sm:justify-center w-full">
            {isSubdomainHost ? (
              <a
                href={`${ROOT_ORIGIN}${rootLogoPath}`}
                className="flex flex-col no-underline group active:scale-[0.98] transition-transform duration-100 shrink-0 text-center sm:mx-auto"
              >
                <span className="font-serif font-extrabold text-[20px] sm:text-[30px] tracking-[2px] uppercase text-eerie-black group-hover:text-salmon-pink transition-colors leading-tight">
                  {t("brand_title", lang) || "Merter Vitrini"}
                </span>
                <span className="text-[7.5px] sm:text-[9px] uppercase tracking-[3.5px] text-sonic-silver -mt-0.5 font-bold">
                  {t("brand_subtitle", lang) || "Toptan Showroom"}
                </span>
              </a>
            ) : (
              <Link
                href={rootLogoPath}
                className="flex flex-col no-underline group active:scale-[0.98] transition-transform duration-100 shrink-0 text-center sm:mx-auto"
              >
                <span className="font-serif font-extrabold text-[20px] sm:text-[30px] tracking-[2px] uppercase text-eerie-black group-hover:text-salmon-pink transition-colors leading-tight">
                  {t("brand_title", lang) || "Merter Vitrini"}
                </span>
                <span className="text-[7.5px] sm:text-[9px] uppercase tracking-[3.5px] text-sonic-silver -mt-0.5 font-bold">
                  {t("brand_subtitle", lang) || "Toptan Showroom"}
                </span>
              </Link>
            )}

            {/* Mobile Actions */}
            <div className="flex sm:hidden items-center gap-1.5 text-eerie-black shrink-0">
              {/* Compact Language Selector */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsLangOpen(!isLangOpen)}
                  className="flex items-center gap-1.5 px-1.5 py-1 bg-zinc-50 border border-zinc-200/60 rounded-none hover:text-accent-gold font-extrabold text-[9px] transition-all cursor-pointer select-none shrink-0"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getFlagUrl(lang)}
                    alt={lang}
                    className="w-4 h-3 object-cover rounded-sm border border-black/5 shrink-0"
                  />
                  <span className="uppercase text-[9px] text-zinc-800 shrink-0">{currentLangObj.code}</span>
                </button>

                {isLangOpen && (
                  <>
                    <button
                      type="button"
                      aria-label={closeLabel}
                      tabIndex={-1}
                      className="fixed inset-0 z-40 bg-transparent border-none cursor-default"
                      onClick={() => setIsLangOpen(false)}
                    />
                    <div className="absolute right-0 top-7 bg-white border border-cultured rounded-none shadow-lg min-w-[120px] overflow-hidden z-50">
                      {activeLanguages.map((l) => (
                        <button
                          key={l.code}
                          type="button"
                          onClick={() => handleSelectLanguage(l.code)}
                          className={`w-full flex items-center gap-2 px-2.5 py-2.5 text-left text-[10px] font-bold transition-colors cursor-pointer border-none uppercase ${
                            lang === l.code
                              ? "text-accent-gold bg-cultured"
                              : "text-onyx hover:bg-cultured hover:text-eerie-black"
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={getFlagUrl(l.code)}
                            alt={l.label}
                            className="w-4 h-3 object-cover rounded-sm border border-black/5 shrink-0"
                          />
                          <span className="uppercase">{l.code}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Compact Currency Selector */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsCurrencyOpen(!isCurrencyOpen)}
                  className="flex items-center gap-1 px-1.5 py-1 bg-zinc-50 border border-zinc-200/60 rounded-none hover:text-accent-gold font-extrabold text-[9px] transition-all cursor-pointer select-none shrink-0"
                >
                  <span className="uppercase text-[9px] text-zinc-800 shrink-0">{activeCurrObj.code}</span>
                </button>

                {isCurrencyOpen && (
                  <>
                    <button
                      type="button"
                      aria-label={closeLabel}
                      tabIndex={-1}
                      className="fixed inset-0 z-40 bg-transparent border-none cursor-default"
                      onClick={() => setIsCurrencyOpen(false)}
                    />
                    <div className="absolute right-0 top-7 bg-white border border-cultured rounded-none shadow-lg min-w-[90px] overflow-hidden z-50">
                      {currenciesList.map((c) => (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => {
                            onCurrencyChange(c.code);
                            setIsCurrencyOpen(false);
                          }}
                          className={`w-full flex items-center px-2.5 py-2 text-left text-[10px] font-bold transition-colors cursor-pointer border-none ${
                            displayCurrency === c.code
                              ? "text-accent-gold bg-cultured"
                              : "text-onyx hover:bg-cultured hover:text-eerie-black"
                          }`}
                        >
                          <span className="uppercase">{c.code}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Notifications Bell (Authenticated Customers) */}
              {user && <CustomerNotificationBell lang={lang} compact />}

              {/* Wishlist Heart Icon */}
              <button
                type="button"
                onClick={() => setIsWishlistOpen(true)}
                className="p-1 hover:text-accent-gold transition-colors relative cursor-pointer border-none bg-transparent shrink-0"
                aria-label={ui.myWishlist}
              >
                <Heart className="w-[19px] h-[19px]" />
                <span className="absolute -top-1.5 -end-1 bg-salmon-pink text-white rounded-full w-[14px] h-[14px] flex items-center justify-center font-extrabold text-[8px] leading-none shadow-sm">
                  {wishlistCount}
                </span>
              </button>

              {/* User Account / Profile Mobile Action */}
              <div className="relative flex items-center shrink-0">
                {user ? (
                  <button
                    type="button"
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="p-1 hover:text-accent-gold transition-colors relative cursor-pointer border-none bg-transparent"
                    aria-label={ui.userMenu}
                  >
                    <User className="w-[19px] h-[19px] text-accent-gold" />
                    {user.email_verified === false && (
                      <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white" />
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("login");
                      setIsAuthOpen(true);
                    }}
                    className="p-1 hover:text-accent-gold transition-colors relative cursor-pointer border-none bg-transparent"
                    aria-label={ui.loginOrRegister}
                  >
                    <User className="w-[19px] h-[19px]" />
                  </button>
                )}

                {isUserMenuOpen && user && (
                  <>
                    <button
                      type="button"
                      aria-label={closeLabel}
                      tabIndex={-1}
                      className="fixed inset-0 z-40 bg-transparent border-none cursor-default"
                      onClick={() => setIsUserMenuOpen(false)}
                    />
                    <div className="absolute right-0 top-8 bg-white border border-cultured rounded-none shadow-xl min-w-[150px] overflow-hidden z-50 animate-in fade-in duration-150">
                      <div className="px-3 py-2 border-b border-cultured text-[10px] text-sonic-silver truncate">
                        {user.first_name} {user.last_name}
                      </div>
                      {user.email_verified === false && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            router.push("/profile");
                          }}
                          className="w-full px-3 py-1.5 bg-amber-50 border-x-0 border-t-0 border-b border-amber-200 text-amber-800 text-[10px] font-bold flex items-center justify-between gap-2 cursor-pointer"
                        >
                          <span>{ui.emailUnverifiedShort}</span>
                          <span className="underline text-[9px]">{ui.verifyNow}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          router.push("/profile");
                        }}
                        className="w-full text-left px-3 py-2.5 text-xs font-bold text-eerie-black hover:bg-cultured transition-colors border-none bg-transparent cursor-pointer"
                      >
                        {t("my_profile", lang)}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          window.dispatchEvent(
                            new CustomEvent("merter-profile-tab", { detail: { tab: "favorites" } })
                          );
                          router.push(`/profile?tab=favorites${profileLangQuery}`);
                        }}
                        className="w-full text-left px-3 py-2 text-xs font-bold text-eerie-black hover:bg-cultured transition-colors border-none bg-transparent cursor-pointer"
                      >
                        {ui.favoriteSuppliers}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          window.dispatchEvent(
                            new CustomEvent("merter-profile-tab", {
                              detail: { tab: "notifications" },
                            })
                          );
                          router.push(`/profile?tab=notifications${profileLangQuery}`);
                        }}
                        className="w-full text-left px-3 py-2 text-xs font-bold text-eerie-black hover:bg-cultured transition-colors border-none bg-transparent cursor-pointer"
                      >
                        {ui.notifications}
                      </button>
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full text-left px-3 py-2.5 border-t border-cultured text-xs font-bold text-red-500 hover:bg-red-50 transition-colors border-none bg-transparent cursor-pointer"
                      >
                        {t("logout", lang)}
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Cart Icon */}
              <button
                type="button"
                onClick={() => setIsCartOpen(true)}
                className="p-1 hover:text-accent-gold transition-colors relative cursor-pointer border-none bg-transparent shrink-0"
                aria-label={ui.myCart}
              >
                <ShoppingBag className="w-[19px] h-[19px]" />
                <span className="absolute -top-1.5 -end-1 bg-salmon-pink text-white rounded-full w-[14px] h-[14px] flex items-center justify-center font-extrabold text-[8px] leading-none shadow-sm">
                  {totalPkgs}
                </span>
              </button>
            </div>
          </div>

          {/* Mobile Search Bar */}
          <div className="relative w-full sm:hidden">
            <div className="relative flex items-center w-full border-b border-cultured overflow-hidden focus-within:border-brand-black transition-all">
              <input
                type="text"
                id="searchInputMobile"
                value={searchQuery ?? ""}
                className="w-full pl-0 pr-8 py-2 text-xs font-medium text-onyx placeholder-spanish-gray focus:outline-none bg-white"
                placeholder={t("search_placeholder", lang)}
                onChange={handleSearchChange}
              />
              <button
                type="button"
                aria-label={ui.submitSearch}
                className="absolute right-0 top-0 bottom-0 px-1 bg-white hover:text-accent-gold transition-colors flex items-center justify-center cursor-pointer text-eerie-black border-none"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Right Column: Desktop Only Actions */}
          <div className="hidden sm:flex sm:col-span-1 items-center justify-end gap-5 text-eerie-black">
            {/* Account Profile Icon / Dropdown */}
            <div className="relative">
              {user ? (
                <>
                  <button
                    type="button"
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center gap-1.5 px-3 py-1 bg-transparent hover:text-accent-gold text-xs font-extrabold uppercase transition-all duration-200 cursor-pointer border-none"
                  >
                    <div className="relative">
                      <User className="w-[17px] h-[17px] text-accent-gold" />
                      {user.email_verified === false && (
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500 ring-1 ring-white" />
                      )}
                    </div>
                    <span>{user.first_name}</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${isUserMenuOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isUserMenuOpen && (
                    <>
                      <button
                        type="button"
                        aria-label={closeLabel}
                        tabIndex={-1}
                        className="fixed inset-0 z-40 bg-transparent border-none cursor-default"
                        onClick={() => setIsUserMenuOpen(false)}
                      />
                      <div className="absolute right-0 top-9 bg-white border border-cultured rounded-none shadow-xl min-w-[160px] overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                        <div className="px-4 py-2.5 border-b border-cultured text-[10px] text-sonic-silver">
                          {user.email}
                        </div>
                        {user.email_verified === false && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsUserMenuOpen(false);
                              router.push("/profile");
                            }}
                            className="w-full px-4 py-2 bg-amber-50 border-x-0 border-t-0 border-b border-amber-200 text-amber-800 text-[10px] font-bold flex items-center justify-between gap-2 cursor-pointer hover:bg-amber-100 transition-colors"
                          >
                            <span>{ui.emailUnverified}</span>
                            <span className="underline text-[9px]">{ui.verifyNow}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            router.push("/profile");
                          }}
                          className="w-full text-left px-4 py-2.5 text-xs font-bold text-eerie-black hover:bg-cultured transition-colors border-none bg-transparent cursor-pointer"
                        >
                          {t("my_profile", lang)}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            window.dispatchEvent(
                              new CustomEvent("merter-profile-tab", {
                                detail: { tab: "favorites" },
                              })
                            );
                            router.push(`/profile?tab=favorites${profileLangQuery}`);
                          }}
                          className="w-full text-left px-4 py-2 text-xs font-bold text-eerie-black hover:bg-cultured transition-colors border-none bg-transparent cursor-pointer"
                        >
                          {ui.favoriteSuppliers}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            window.dispatchEvent(
                              new CustomEvent("merter-profile-tab", {
                                detail: { tab: "notifications" },
                              })
                            );
                            router.push(`/profile?tab=notifications${profileLangQuery}`);
                          }}
                          className="w-full text-left px-4 py-2 text-xs font-bold text-eerie-black hover:bg-cultured transition-colors border-none bg-transparent cursor-pointer"
                        >
                          {ui.notifications}
                        </button>
                        <button
                          type="button"
                          onClick={handleLogout}
                          className="w-full text-left px-4 py-2.5 border-t border-cultured text-xs font-bold text-red-500 hover:bg-red-50 transition-colors border-none bg-transparent cursor-pointer"
                        >
                          {t("logout", lang)}
                        </button>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("login");
                    setIsAuthOpen(true);
                  }}
                  className="flex items-center gap-1 px-3 py-1 hover:text-accent-gold text-xs font-extrabold uppercase transition-all duration-200 cursor-pointer border-none bg-transparent"
                >
                  <User className="w-[17px] h-[17px]" />
                  <span>{t("login", lang)}</span>
                </button>
              )}
            </div>

            {/* Notifications Bell Desktop */}
            {user && <CustomerNotificationBell lang={lang} />}

            {/* Wishlist Heart Icon */}
            <button
              type="button"
              onClick={() => setIsWishlistOpen(true)}
              className="p-1 hover:text-accent-gold transition-colors relative cursor-pointer border-none bg-transparent"
              aria-label={ui.myWishlist}
            >
              <Heart className="w-[20px] h-[20px]" />
              <span className="absolute -top-1.5 -end-1 bg-salmon-pink text-white rounded-full w-[15px] h-[15px] flex items-center justify-center font-extrabold text-[8.5px] leading-none shadow-sm">
                {wishlistCount}
              </span>
            </button>

            {/* Cart Icon */}
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="p-1 hover:text-accent-gold transition-colors relative cursor-pointer border-none bg-transparent"
              aria-label={ui.myCart}
            >
              <ShoppingBag className="w-[20px] h-[20px]" />
              <span className="absolute -top-1.5 -end-1 bg-salmon-pink text-white rounded-full w-[15px] h-[15px] flex items-center justify-center font-extrabold text-[8.5px] leading-none shadow-sm">
                {totalPkgs}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Horizontal Navigation Menu (Tier 3) */}
      <HeaderNavbar
        lang={lang}
        categories={categories}
        activeCategoryId={activeCategoryId}
        getCategoryPrefix={getCategoryPrefix}
      />

      {/* 4. Collapsible Mobile Category Selector Bar (Tier 4) */}
      <MobileCategoryAccordion
        lang={lang}
        categories={categories}
        activeCategoryId={activeCategoryId}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        expandedMobileCategories={expandedMobileCategories}
        toggleMobileCategory={toggleMobileCategory}
        getCategoryPrefix={getCategoryPrefix}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        lang={lang}
        initialMode={authMode}
      />

      {isWishlistOpen && (
        <WishlistDrawer
          lang={lang}
          onClose={() => setIsWishlistOpen(false)}
          displayCurrency={displayCurrency}
        />
      )}
    </header>
  );
}
