"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { t, getCategoryPrefix, normalizeLangCode, pickLangText, SupportedLangCode } from "../../app/i18n";
import { apiFetch, invalidateStoreSettingsCache, trackWhatsappClick } from "../../app/utils";
import SupplierApplicationSection from "./SupplierApplicationSection";
import NewsletterSubscriptionBox from "./NewsletterSubscriptionBox";
import { Building2, Smartphone } from "lucide-react";
import {
  DEFAULT_MERTER_ADDRESS,
  DEFAULT_MERTER_EMAIL,
  formatAsciiSafeUpper,
  sanitizePublicStoreAddress,
  sanitizePublicStoreEmail,
} from "@/utils/formatters";
import { getFooterLegalNoticeCopy } from "@/utils/legalNotices";

interface Settings {
  id: string;
  address: string;
  phone: string;
  whatsapp: string;
  email: string;
}

export type PolicyType = "cancellation_and_return" | "terms_of_service" | "privacy_policy";

function openPolicyOrFallback(
  type: PolicyType,
  prefix: string,
  onOpenPolicy?: (type: PolicyType) => void
) {
  if (onOpenPolicy) {
    onOpenPolicy(type);
    return;
  }
  if (typeof window !== "undefined") {
    window.location.href = `/${prefix}/b2b`;
  }
}

interface FooterProps {
  readonly lang: string;
  readonly onOpenPolicy?: (type: PolicyType) => void;
  readonly showApplicationForm?: boolean;
  readonly initialSettings?: Partial<Settings>;
}

interface B2BWholesaleLink {
  label: string;
  href: string;
}

const B2B_HUB_TITLES: Record<string, string> = {
  tr: "Popüler Toptan Tekstil Kategorileri & Merter Tedarik Ağı",
  ru: "Популярные Оптовые Категории и Поставки из Мертер",
  ar: "أقسام الأزياء بالجملة وتوريد المنسوجات من مارتر",
  de: "Beliebte Großhandelskategorien & Merter Beschaffungsnetzwerk",
  fr: "Catégories Populaires de Vente en Gros & Approvisionnement Merter",
  pl: "Popularne Kategorie Hurtowe i Dostawy z Merter",
  bg: "Популярни Категории на Едро и Доставки от Мертер",
  en: "Top B2B Wholesale Categories & Merter Sourcing Network",
};

function getB2BHubTitle(lang: string): string {
  return B2B_HUB_TITLES[lang] || B2B_HUB_TITLES.en;
}

function getB2BWholesaleLinks(lang: string): B2BWholesaleLink[] {
  const prefix = getCategoryPrefix(lang);
  const linksMap: Record<string, B2BWholesaleLink[]> = {
    tr: [
      { label: "Yeni Ürünler (Son 7 Gün)", href: `/${prefix}/yeni-urunler` },
      { label: "Toptan Kadın Giyim", href: `/${prefix}/kadin-giyim` },
      { label: "Toptan Triko & Kazak", href: `/${prefix}/kadin-giyim/triko-hirka-kazak` },
      { label: "Toptan Elbise Modelleri", href: `/${prefix}/kadin-giyim/elbise-abiye` },
      { label: "Toptan Abiye & Gece Elbisesi", href: `/${prefix}/kadin-giyim/elbise-abiye/abiye` },
      { label: "Toptan Büyük Beden Giyim", href: `/${prefix}/kadin-giyim/buyuk-beden` },
      { label: "Toptan Bohem Giyim", href: `/${prefix}/kadin-giyim/yaz-koleksiyonu` },
      { label: "Toptan Vintage & Retro", href: `/${prefix}/kadin-giyim/vintage-retro` },
      { label: "Toptan Dış Giyim", href: `/${prefix}/kadin-giyim/dis-giyim` },
      { label: "Merter B2B Alıcı Rehberi", href: `/${prefix}/b2b` },
    ],
    en: [
      { label: "New Arrivals (Last 7 Days)", href: `/${prefix}/yeni-urunler` },
      { label: "Wholesale Women Clothing", href: `/${prefix}/kadin-giyim` },
      { label: "Wholesale Knitwear & Sweaters", href: `/${prefix}/kadin-giyim/triko-hirka-kazak` },
      { label: "Wholesale Dresses Turkey", href: `/${prefix}/kadin-giyim/elbise-abiye` },
      { label: "Wholesale Evening Dresses", href: `/${prefix}/kadin-giyim/elbise-abiye/abiye` },
      { label: "Wholesale Plus Size Fashion", href: `/${prefix}/kadin-giyim/buyuk-beden` },
      { label: "Wholesale Boho Chic Boutique", href: `/${prefix}/kadin-giyim/yaz-koleksiyonu` },
      { label: "Wholesale Vintage Clothing", href: `/${prefix}/kadin-giyim/vintage-retro` },
      { label: "Wholesale Outerwear", href: `/${prefix}/kadin-giyim/dis-giyim` },
      { label: "Merter B2B Sourcing Guide", href: `/${prefix}/b2b` },
    ],
    ru: [
      { label: "Новые поступления (за 7 дней)", href: `/${prefix}/yeni-urunler` },
      { label: "Женская одежда оптом Турция", href: `/${prefix}/kadin-giyim` },
      { label: "Трикотаж и свитера оптом", href: `/${prefix}/kadin-giyim/triko-hirka-kazak` },
      { label: "Платья оптом Стамбул", href: `/${prefix}/kadin-giyim/elbise-abiye` },
      { label: "Вечерние платья оптом", href: `/${prefix}/kadin-giyim/elbise-abiye/abiye` },
      { label: "Одежда больших размеров оптом", href: `/${prefix}/kadin-giyim/buyuk-beden` },
      { label: "Бохо шик оптом Мертер", href: `/${prefix}/kadin-giyim/yaz-koleksiyonu` },
      { label: "Винтажная одежда оптом", href: `/${prefix}/kadin-giyim/vintage-retro` },
      { label: "Верхняя одежда оптом", href: `/${prefix}/kadin-giyim/dis-giyim` },
      { label: "Гид по закупкам в Мертер", href: `/${prefix}/b2b` },
    ],
    ar: [
      { label: "وصل حديثاً (آخر 7 أيام)", href: `/${prefix}/yeni-urunler` },
      { label: "ملابس نسائية بالجملة تركيا", href: `/${prefix}/kadin-giyim` },
      { label: "تريكو وكنزات صوفية بالجملة", href: `/${prefix}/kadin-giyim/triko-hirka-kazak` },
      { label: "فساتين نسائية بالجملة إسطنبول", href: `/${prefix}/kadin-giyim/elbise-abiye` },
      { label: "فساتين سهرة وسواريه بالجملة", href: `/${prefix}/kadin-giyim/elbise-abiye/abiye` },
      { label: "مقاسات كبيرة بالجملة تركيا", href: `/${prefix}/kadin-giyim/buyuk-beden` },
      { label: "أزياء بوهو شيك بالجملة", href: `/${prefix}/kadin-giyim/yaz-koleksiyonu` },
      { label: "ملابس عتيقة وفينتاج بالجملة", href: `/${prefix}/kadin-giyim/vintage-retro` },
      { label: "ملابس خارجية بالجملة", href: `/${prefix}/kadin-giyim/dis-giyim` },
      { label: "دليل المشتريات من مارتر", href: `/${prefix}/b2b` },
    ],
    de: [
      { label: "Neuheiten (Letzte 7 Tage)", href: `/${prefix}/yeni-urunler` },
      { label: "Großhandel Damenbekleidung Türkei", href: `/${prefix}/kadin-giyim` },
      { label: "Großhandel Strickwaren & Pullover", href: `/${prefix}/kadin-giyim/triko-hirka-kazak` },
      { label: "Großhandel Kleider Istanbul", href: `/${prefix}/kadin-giyim/elbise-abiye` },
      { label: "Großhandel Abendkleider", href: `/${prefix}/kadin-giyim/elbise-abiye/abiye` },
      { label: "Große Größen Großhandel", href: `/${prefix}/kadin-giyim/buyuk-beden` },
      { label: "Großhandel Oberbekleidung", href: `/${prefix}/kadin-giyim/dis-giyim` },
      { label: "Merter B2B Einkaufsführer", href: `/${prefix}/b2b` },
    ],
    fr: [
      { label: "Nouveautés (7 derniers jours)", href: `/${prefix}/yeni-urunler` },
      { label: "Vêtements Femme en Gros Turquie", href: `/${prefix}/kadin-giyim` },
      { label: "Tricot et Pulls en Gros", href: `/${prefix}/kadin-giyim/triko-hirka-kazak` },
      { label: "Robes en Gros Istanbul", href: `/${prefix}/kadin-giyim/elbise-abiye` },
      { label: "Robes de Soirée en Gros", href: `/${prefix}/kadin-giyim/elbise-abiye/abiye` },
      { label: "Grandes Tailles en Gros", href: `/${prefix}/kadin-giyim/buyuk-beden` },
      { label: "Vêtements Extérieurs en Gros", href: `/${prefix}/kadin-giyim/dis-giyim` },
      { label: "Guide d'Achat B2B Merter", href: `/${prefix}/b2b` },
    ],
    pl: [
      { label: "Nowości (Ostatnie 7 dni)", href: `/${prefix}/yeni-urunler` },
      { label: "Hurtownia Odzieży Damskiej Turcja", href: `/${prefix}/kadin-giyim` },
      { label: "Swetry i Dzianiny Hurt", href: `/${prefix}/kadin-giyim/triko-hirka-kazak` },
      { label: "Sukienki Hurtownia Stambuł", href: `/${prefix}/kadin-giyim/elbise-abiye` },
      { label: "Suknie Wieczorowe Hurt", href: `/${prefix}/kadin-giyim/elbise-abiye/abiye` },
      { label: "Odzież Plus Size Hurt", href: `/${prefix}/kadin-giyim/buyuk-beden` },
      { label: "Odzież Wierzchnia Hurt", href: `/${prefix}/kadin-giyim/dis-giyim` },
      { label: "Przewodnik Zakupów B2B Merter", href: `/${prefix}/b2b` },
    ],
    bg: [
      { label: "Нови продукти (Последните 7 дни)", href: `/${prefix}/yeni-urunler` },
      { label: "Дамски Дрехи на Едро Турция", href: `/${prefix}/kadin-giyim` },
      { label: "Плетива и Пуловери на Едро", href: `/${prefix}/kadin-giyim/triko-hirka-kazak` },
      { label: "Рокли на Едро Истанбул", href: `/${prefix}/kadin-giyim/elbise-abiye` },
      { label: "Вечерни Рокли на Едро", href: `/${prefix}/kadin-giyim/elbise-abiye/abiye` },
      { label: "Макси Мода на Едро", href: `/${prefix}/kadin-giyim/buyuk-beden` },
      { label: "Връхни Дрехи на Едро", href: `/${prefix}/kadin-giyim/dis-giyim` },
      { label: "Наръчник за Покупки в Мертер", href: `/${prefix}/b2b` },
    ],
  };
  return linksMap[lang] || linksMap.en;
}

function FooterContactColumn({ settings, lang }: { readonly settings: Settings; readonly lang: string }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col">
        <span className="text-xl font-bold tracking-tight text-black flex items-center gap-2 font-serif">
          <span className="bg-black text-white px-2 py-0.5 rounded-none text-xs font-black tracking-widest font-sans">
            {t("b2b_tag", lang)}
          </span>
          {t("brand_title", lang)}
        </span>
        <span className="text-[10px] font-bold text-accent-gold uppercase tracking-[1.5px] mt-1">
          {t("brand_subtitle", lang)}
        </span>
      </div>

      <div className="text-sm space-y-3 pt-2 text-onyx">
        <p className="flex items-start gap-2.5 leading-relaxed">
          <svg className="w-5 h-5 text-black shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>{settings.address}</span>
        </p>

        <p className="flex items-center gap-2.5">
          <svg className="w-5 h-5 text-black shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
          <a href={`tel:${settings.phone}`} className="hover:text-black transition-colors duration-200">
            {settings.phone}
          </a>
        </p>

        <p className="flex items-center gap-2.5">
          <svg className="w-5 h-5 text-black shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <a href={`mailto:${settings.email}`} className="hover:text-black transition-colors duration-200 break-all">
            {settings.email}
          </a>
        </p>
      </div>
    </div>
  );
}

interface FooterUiLabels {
  serviceProviders: string;
  androidAppApk: string;
  localDev: string;
  lastUpdatedPrefix: string;
}

const FOOTER_UI_LABELS: Record<SupportedLangCode, FooterUiLabels> = {
  tr: {
    serviceProviders: "Sektörel Hizmet Sağlayıcılar (Kargo / Stüdyo)",
    androidAppApk: "Android Uygulama (APK)",
    localDev: "Yerel Geliştirme",
    lastUpdatedPrefix: "Son Güncelleme",
  },
  en: {
    serviceProviders: "B2B Sectoral Service Providers",
    androidAppApk: "Android App (APK)",
    localDev: "Local Development",
    lastUpdatedPrefix: "Last Updated",
  },
  ru: {
    serviceProviders: "Отраслевые B2B-услуги (Карго / Студия)",
    androidAppApk: "Приложение Android (APK)",
    localDev: "Локальная разработка",
    lastUpdatedPrefix: "Последнее обновление",
  },
  ar: {
    serviceProviders: "مقدمو الخدمات القطاعية B2B (الشحن / الاستوديو)",
    androidAppApk: "تطبيق أندرويد (APK)",
    localDev: "تطوير محلي",
    lastUpdatedPrefix: "آخر تحديث",
  },
  de: {
    serviceProviders: "B2B-Branchendienstleister (Logistik / Studio)",
    androidAppApk: "Android-App (APK)",
    localDev: "Lokale Entwicklung",
    lastUpdatedPrefix: "Letzte Aktualisierung",
  },
  fr: {
    serviceProviders: "Prestataires de Services B2B (Cargo / Studio)",
    androidAppApk: "Application Android (APK)",
    localDev: "Développement Local",
    lastUpdatedPrefix: "Dernière mise à jour",
  },
  pl: {
    serviceProviders: "Branżowi Dostawcy Usług B2B (Cargo / Studio)",
    androidAppApk: "Aplikacja Android (APK)",
    localDev: "Środowisko Lokalne",
    lastUpdatedPrefix: "Ostatnia aktualizacja",
  },
  bg: {
    serviceProviders: "Секторни B2B Доставчици на Услуги (Карго / Студио)",
    androidAppApk: "Android Приложение (APK)",
    localDev: "Локална среда",
    lastUpdatedPrefix: " Последна актуализация".trim(),
  },
};

function buildFooterQueryRoute(basePath: string, lang: string): string {
  const safeCode = normalizeLangCode(lang);
  return safeCode === "tr" ? basePath : `${basePath}?lang=${safeCode}`;
}

function FooterAboutColumn({ lang }: { readonly lang: string }) {
  const prefix = getCategoryPrefix(lang);
  const labels = pickLangText(lang, FOOTER_UI_LABELS);
  return (
    <div>
      <h3 className="text-[#1C1C1C] font-bold text-xs tracking-[2px] uppercase mb-6">
        {t("about_us", lang)}
      </h3>
      <ul className="space-y-3 text-sm">
        <li>
          <Link href={`/${prefix}/pages/hakkimizda`} className="text-[#525252] hover:text-[#1C1C1C] hover:underline transition-colors duration-200">
            {t("about_us", lang)}
          </Link>
        </li>
        <li>
          <Link href={`/${prefix}/b2b`} className="text-[#525252] hover:text-[#1C1C1C] hover:underline transition-colors duration-200">
            {t("wholesale_b2b", lang)}
          </Link>
        </li>
        <li>
          <Link href={`/${prefix}/contact`} className="text-[#525252] hover:text-[#1C1C1C] hover:underline transition-colors duration-200">
            {t("contact_us", lang)}
          </Link>
        </li>
        <li>
          <Link href={`/${prefix}/blog`} className="text-[#525252] hover:text-[#1C1C1C] hover:underline transition-colors duration-200">
            {t("blog", lang)}
          </Link>
        </li>
        <li>
          <Link href={buildFooterQueryRoute("/hizmet-saglayicilar", lang)} className="text-[#525252] hover:text-[#1C1C1C] hover:underline transition-colors duration-200">
            {labels.serviceProviders}
          </Link>
        </li>
        <li>
          <Link href={`/${prefix}/tedarikci-basvuru`} className="text-[#525252] hover:text-[#1C1C1C] hover:underline transition-colors duration-200">
            {t("supplier_apply", lang)}
          </Link>
        </li>
        <li>
          <Link href="/supplier/login" className="text-[#525252] hover:text-[#1C1C1C] font-semibold hover:underline transition-colors duration-200 inline-flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-[#525252] shrink-0" />
            <span>{t("supplier_portal_login", lang)}</span>
          </Link>
        </li>
        <li className="pt-1">
          <Link
            href={buildFooterQueryRoute("/mobil-uygulama", lang)}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#1C1C1C] hover:bg-[#333333] text-white rounded-md text-xs font-bold tracking-wider transition-colors no-underline"
          >
            <Smartphone className="w-3.5 h-3.5 text-[#D8C7A6] shrink-0" />
            <span>{lang === "ar" ? labels.androidAppApk : formatAsciiSafeUpper(labels.androidAppApk)}</span>
          </Link>
        </li>
      </ul>
    </div>
  );
}

interface CustomerServiceProps {
  readonly lang: string;
  readonly onOpenPolicy?: (type: PolicyType) => void;
}

function FooterCustomerServiceColumn({ lang, onOpenPolicy }: CustomerServiceProps) {
  const prefix = getCategoryPrefix(lang);

  return (
    <div>
      <h3 className="text-[#1C1C1C] font-bold text-xs tracking-[2px] uppercase mb-6">
        {t("customer_service", lang)}
      </h3>
      <ul className="space-y-3 text-sm">
        <li>
          <button
            type="button"
            onClick={() => openPolicyOrFallback("cancellation_and_return", prefix, onOpenPolicy)}
            className="text-start bg-transparent border-none p-0 cursor-pointer text-[#525252] hover:text-[#1C1C1C] hover:underline transition-colors duration-200"
          >
            {t("delivery_returns", lang)}
          </button>
        </li>
        <li>
          <Link href={`/${prefix}/faq`} className="text-[#525252] hover:text-[#1C1C1C] hover:underline transition-colors duration-200">
            {t("faq", lang)}
          </Link>
        </li>
        <li>
          <Link href={`/${prefix}/pages/kullanici-sozlesmesi`} className="text-[#525252] hover:text-[#1C1C1C] hover:underline transition-colors duration-200">
            {getFooterLegalNoticeCopy(lang).termsLink}
          </Link>
        </li>
        <li>
          <Link href={`/${prefix}/pages/tedarikci-sozlesmesi`} className="text-[#525252] hover:text-[#1C1C1C] hover:underline transition-colors duration-200">
            {getFooterLegalNoticeCopy(lang).supplierAgreementLink}
          </Link>
        </li>
        <li>
          <Link href={`/${prefix}/pages/yer-saglayici-bildirimi`} className="text-[#525252] hover:text-[#1C1C1C] hover:underline transition-colors duration-200">
            {getFooterLegalNoticeCopy(lang).hostingNoticeLink}
          </Link>
        </li>
        <li>
          <Link href={`/${prefix}/pages/telif-hakki-ve-uyar-kaldir`} className="text-[#525252] hover:text-[#1C1C1C] hover:underline transition-colors duration-200">
            {getFooterLegalNoticeCopy(lang).copyrightLink}
          </Link>
        </li>
        <li>
          <button
            type="button"
            onClick={() => openPolicyOrFallback("privacy_policy", prefix, onOpenPolicy)}
            className="text-start bg-transparent border-none p-0 cursor-pointer text-[#525252] hover:text-[#1C1C1C] hover:underline transition-colors duration-200"
          >
            {t("privacy", lang)}
          </button>
        </li>
        <li>
          <button
            type="button"
            onClick={() => openPolicyOrFallback("terms_of_service", prefix, onOpenPolicy)}
            className="text-start bg-transparent border-none p-0 cursor-pointer text-[#525252] hover:text-[#1C1C1C] hover:underline transition-colors duration-200"
          >
            {t("terms", lang)}
          </button>
        </li>
      </ul>
    </div>
  );
}

function FooterAccountColumn({
  lang,
  whatsappUrl,
  whatsappPhone,
}: {
  readonly lang: string;
  readonly whatsappUrl: string;
  readonly whatsappPhone: string;
}) {
  const dispatchAuthEvent = (mode: "login" | "register") => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("merter-open-auth", { detail: { mode } }));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-[#1C1C1C] font-bold text-xs tracking-[2px] uppercase mb-6">
          {t("my_account", lang)}
        </h3>
        <ul className="space-y-3 text-sm mb-4">
          <li>
            <button
              type="button"
              onClick={() => dispatchAuthEvent("login")}
              className="text-start bg-transparent border-none p-0 cursor-pointer text-[#525252] hover:text-[#1C1C1C] hover:underline transition-colors duration-200"
            >
              {t("login", lang)}
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => dispatchAuthEvent("register")}
              className="text-start bg-transparent border-none p-0 cursor-pointer text-[#525252] hover:text-[#1C1C1C] hover:underline transition-colors duration-200"
            >
              {t("register", lang)}
            </button>
          </li>
          <li>
            <Link href="/profile" className="text-[#525252] hover:text-[#1C1C1C] hover:underline transition-colors duration-200">
              {t("order_tracking", lang)}
            </Link>
          </li>
        </ul>
      </div>

      <div className="pt-2">
        <a 
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() =>
            trackWhatsappClick({
              sourceSurface: "footer",
              targetPhone: whatsappPhone,
            })
          }
          className="inline-flex items-center gap-3 px-5 py-3 bg-[#15803D] hover:bg-[#166534] text-white rounded-md shadow-sm transition-all duration-300 group font-bold text-xs tracking-[1.5px] border-none relative overflow-hidden no-underline"
        >
          <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.73-1.458L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.863-9.73.001-2.595-1.006-5.035-2.836-6.87C16.671 2.16 14.237.986 11.64.985c-5.441 0-9.87 4.372-9.873 9.734-.001 1.709.467 3.376 1.354 4.887l-.982 3.582 3.71-.974zm13.14-5.932c-.3-.15-1.776-.875-2.05-.975-.275-.1-.475-.15-.675.15-.2.3-.775.975-.95 1.175-.175.2-.35.225-.65.075-1.127-.566-1.929-1.009-2.694-2.321-.202-.347-.202-.656-.051-.951.136-.264.3-.35.45-.5.15-.15.2-.25.3-.45.1-.2.05-.375-.025-.525-.075-.15-.675-1.625-.925-2.225-.244-.588-.491-.508-.675-.518-.175-.009-.375-.01-.575-.01-.2 0-.525.075-.8 1.025-.275.95-1.05 3.3-1.05 3.4 0 .1.075.2.225.35.15.15 1.75 2.673 4.237 3.743.592.255 1.054.408 1.413.523.595.19 1.137.163 1.564.1.477-.07 1.475-.603 1.675-1.18.2-.578.2-1.075.14-1.18-.06-.1-.225-.15-.525-.3z" />
          </svg>
          <span>{lang === "ar" ? t("whatsapp_line", lang) : formatAsciiSafeUpper(t("whatsapp_line", lang))}</span>
        </a>
      </div>
    </div>
  );
}

function FooterWholesaleHub({ lang }: { readonly lang: string }) {
  const hubTitle = getB2BHubTitle(lang);
  const links = getB2BWholesaleLinks(lang);

  return (
    <div className="max-w-[1720px] mx-auto border-t border-cultured mt-12 pt-8">
      <h4 className="text-black font-extrabold text-[11px] tracking-[2px] uppercase mb-4">
        {hubTitle}
      </h4>
      <div className="flex flex-wrap gap-2 text-xs">
        {links.map((linkItem) => (
          <Link
            key={linkItem.href}
            href={linkItem.href}
            className="px-3 py-1.5 bg-[#fcfcfc] hover:bg-black hover:text-white border border-cultured rounded-[4px] text-[11px] font-semibold text-onyx transition-all duration-200 no-underline"
          >
            {linkItem.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

function FooterHostingNoticeBanner({ lang }: { readonly lang: string }) {
  const prefix = getCategoryPrefix(lang);
  const copy = getFooterLegalNoticeCopy(lang);
  return (
    <div className="max-w-[1720px] mx-auto mt-8 rounded-lg border border-cultured bg-[#FAF8F5] px-4 py-3.5 text-[11px] leading-relaxed text-[#525252]">
      <div className="font-extrabold text-[#1C1C1C] uppercase tracking-[0.6px] mb-1">
        {copy.badge}
      </div>
      <p className="m-0">{copy.summary}</p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-bold text-[#1C1C1C]">
        <Link href={`/${prefix}/pages/yer-saglayici-bildirimi`} className="hover:underline">
          {copy.hostingNoticeLink}
        </Link>
        <Link href={`/${prefix}/pages/tedarikci-sozlesmesi`} className="hover:underline">
          {copy.supplierAgreementLink}
        </Link>
        <Link href={`/${prefix}/pages/telif-hakki-ve-uyar-kaldir`} className="hover:underline">
          {copy.copyrightLink}
        </Link>
        <Link href={`/${prefix}/pages/iptal-iade-kosullari`} className="hover:underline">
          {copy.cancellationLink}
        </Link>
        <Link href={`/${prefix}/pages/gizlilik-politikasi`} className="hover:underline">
          {copy.privacyLink}
        </Link>
      </div>
    </div>
  );
}

interface FooterBottomBarProps {
  readonly lang: string;
  readonly onOpenPolicy?: (type: PolicyType) => void;
}

function FooterBottomBar({ lang, onOpenPolicy }: FooterBottomBarProps) {
  const prefix = getCategoryPrefix(lang);

  return (
    <div className="max-w-[1720px] mx-auto border-t border-cultured mt-8 pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-sonic-silver">
      <div className="flex flex-col sm:flex-row items-center gap-2 text-center sm:text-start">
        <span>© {new Date().getFullYear()} {t("brand_title", lang)}. {t("all_rights_reserved", lang)}</span>
      </div>
      <div className="flex flex-wrap gap-4 sm:gap-6 items-center">
        <button
          type="button"
          onClick={() => openPolicyOrFallback("privacy_policy", prefix, onOpenPolicy)}
          className="bg-transparent border-none p-0 cursor-pointer text-xs text-sonic-silver hover:text-[#1C1C1C] transition-colors"
        >
          {t("privacy", lang)}
        </button>
        <button
          type="button"
          onClick={() => openPolicyOrFallback("terms_of_service", prefix, onOpenPolicy)}
          className="bg-transparent border-none p-0 cursor-pointer text-xs text-sonic-silver hover:text-[#1C1C1C] transition-colors"
        >
          {t("terms", lang)}
        </button>
        <Link 
          href={`/${prefix}/site-haritasi`} 
          className="text-sonic-silver hover:text-[#1C1C1C] transition-colors no-underline"
        >
          {t("sitemap_title", lang)}
        </Link>
      </div>
    </div>
  );
}

function buildInitialFooterSettings(initial?: Partial<Settings>): Settings {
  return {
    id: initial?.id || "",
    address: sanitizePublicStoreAddress(initial?.address) || DEFAULT_MERTER_ADDRESS,
    phone: initial?.phone?.trim() || "+90 533 703 08 83",
    whatsapp: initial?.whatsapp?.trim() || "+90 533 703 08 83",
    email: sanitizePublicStoreEmail(initial?.email) || DEFAULT_MERTER_EMAIL,
  };
}

export default function Footer({
  lang,
  onOpenPolicy,
  showApplicationForm = false,
  initialSettings,
}: Readonly<FooterProps>) {
  const [settings, setSettings] = useState<Settings>(() =>
    buildInitialFooterSettings(initialSettings)
  );

  useEffect(() => {
    let active = true;

    const refreshSettings = () => {
      void apiFetch<Settings>("/settings").then((data) => {
        if (!active || !data) return;
        setSettings(buildInitialFooterSettings(data));
      });
    };

    const handleSettingsEvent = () => {
      invalidateStoreSettingsCache();
      refreshSettings();
    };

    const handleStorageEvent = (event: StorageEvent) => {
      if (event.key !== "merter_settings_updated_at") return;
      invalidateStoreSettingsCache();
      refreshSettings();
    };

    refreshSettings();
    window.addEventListener("store-settings-updated", handleSettingsEvent);
    window.addEventListener("storage", handleStorageEvent);

    return () => {
      active = false;
      window.removeEventListener("store-settings-updated", handleSettingsEvent);
      window.removeEventListener("storage", handleStorageEvent);
    };
  }, []);

  const sanitizedWhatsapp = settings.whatsapp.replace(/\D/g, "");
  const whatsappUrl = `https://wa.me/${sanitizedWhatsapp}`;

  return (
    <>
      {showApplicationForm && <SupplierApplicationSection lang={lang} />}
      <footer className="bg-white border-t border-cultured text-sonic-silver py-16 px-6 md:px-12 mt-0 font-sans">
        <NewsletterSubscriptionBox lang={lang} />
        <div className="max-w-[1720px] mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
          <FooterContactColumn settings={settings} lang={lang} />
          <FooterAboutColumn lang={lang} />
          <FooterCustomerServiceColumn lang={lang} onOpenPolicy={onOpenPolicy} />
          <FooterAccountColumn lang={lang} whatsappUrl={whatsappUrl} whatsappPhone={settings.whatsapp} />
        </div>

        <FooterWholesaleHub lang={lang} />
        <FooterHostingNoticeBanner lang={lang} />
        <FooterBottomBar lang={lang} onOpenPolicy={onOpenPolicy} />
      </footer>
    </>
  );
}
