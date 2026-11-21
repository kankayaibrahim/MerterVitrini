"use client";

import React, { useState } from "react";
import { t } from "@/app/i18n";
import {
  INTL_LOCALE_BY_LANG,
  SupportedSeoLang,
  normalizeSeoLang,
} from "@/utils/seoHelpers";
import StructuredLocationFields, {
  StructuredLocationMeta,
  StructuredLocationValue,
} from "@/components/store/StructuredLocationFields";
import { getRecaptchaLegalNotice } from "@/utils/recaptcha";
import { getCartMultiSupplierCopy } from "@/components/store/cart/cartMultiSupplierCopy";

interface InquirySectionCopy {
  readonly formTitle: string;
  readonly goToCheckout: string;
  readonly registeredPrompt: string;
  readonly signInBtn: string;
  readonly optionalLocationToggle: string;
}

const INQUIRY_SECTION_COPY: Record<SupportedSeoLang, InquirySectionCopy> = {
  tr: {
    formTitle: "HIZLI TEKLİF / SİPARİŞ TALEBİ FORMU",
    goToCheckout: "Sipariş Ekranına Dön",
    registeredPrompt: "Kayıtlı kurumsal müşterimiz misiniz?",
    signInBtn: "Giriş Yapın",
    optionalLocationToggle: "Opsiyonel: Şehir / Teslimat Adresi Notu Ekle",
  },
  en: {
    formTitle: "QUICK QUOTE / ORDER REQUEST FORM",
    goToCheckout: "Back to Checkout",
    registeredPrompt: "Already a registered B2B buyer?",
    signInBtn: "Sign In",
    optionalLocationToggle: "Optional: Add Country / City / Delivery Note",
  },
  ru: {
    formTitle: "БЫСТРЫЙ ЗАПРОС ЦЕНЫ / ЗАКАЗ",
    goToCheckout: "К оформлению заказа",
    registeredPrompt: "Уже зарегистрированы как оптовый партнер?",
    signInBtn: "Войти",
    optionalLocationToggle: "Необязательно: Добавить город / адрес карго",
  },
  ar: {
    formTitle: "نموذج طلب عرض سعر / طلب سريع",
    goToCheckout: "العودة لإتمام الطلب",
    registeredPrompt: "هل لديك حساب تاجر مسجل؟",
    signInBtn: "تسجيل الدخول",
    optionalLocationToggle: "اختياري: إضافة البلد / المدينة / ملاحظة الشحن",
  },
  de: {
    formTitle: "SCHNELLES ANGEBOTS- / BESTELLFORMULAR",
    goToCheckout: "Zurück zum Checkout",
    registeredPrompt: "Bereits registrierter B2B-Kunde?",
    signInBtn: "Anmelden",
    optionalLocationToggle: "Optional: Land / Stadt / Lieferhinweis hinzufügen",
  },
  fr: {
    formTitle: "DEMANDE RAPIDE DE DEVIS / COMMANDE",
    goToCheckout: "Retour à la commande",
    registeredPrompt: "Déjà client B2B inscrit ?",
    signInBtn: "Se connecter",
    optionalLocationToggle: "Optionnel : Ajouter pays / ville / livraison",
  },
  pl: {
    formTitle: "SZYBKI FORMULARZ ZAPYTANIA OFERTOWEGO",
    goToCheckout: "Wróć do zamówienia",
    registeredPrompt: "Jesteś zarejestrowanym kontrahentem B2B?",
    signInBtn: "Zaloguj się",
    optionalLocationToggle: "Opcjonalnie: Dodaj kraj / miasto / adres",
  },
  bg: {
    formTitle: "БЪРЗ ФОРМУЛЯР ЗА ОФЕРТА / ПОРЪЧКА",
    goToCheckout: "Към поръчката",
    registeredPrompt: "Вече сте регистриран B2B партньор?",
    signInBtn: "Вход",
    optionalLocationToggle: "По избор: Добави държава / град / адрес",
  },
};

interface CartInquirySectionProps {
  readonly token: string | null;
  readonly forceShowInquiry: boolean;
  readonly onBackToCheckout: () => void;
  readonly fullName: string;
  readonly setFullName: (v: string) => void;
  readonly companyName: string;
  readonly setCompanyName: (v: string) => void;
  readonly phoneNumber: string;
  readonly setPhoneNumber: (v: string) => void;
  readonly emailAddress: string;
  readonly setEmailAddress: (v: string) => void;
  readonly inquiryLocation: StructuredLocationValue;
  readonly setInquiryLocation: (v: StructuredLocationValue) => void;
  readonly setInquiryLocMeta: (m: StructuredLocationMeta) => void;
  readonly customerMessage: string;
  readonly setCustomerMessage: (v: string) => void;
  readonly submittingInquiry: boolean;
  readonly onSubmitInquiry: (e: React.FormEvent) => void;
  readonly supplierCount?: number;
  readonly errorMessage?: string | null;
  readonly lang: string;
}

function getUpperLabel(key: string, safeLang: SupportedSeoLang): string {
  if (safeLang === "ar") {
    return t(key, safeLang);
  }
  return t(key, safeLang).toLocaleUpperCase(INTL_LOCALE_BY_LANG[safeLang]);
}

export default function CartInquirySection({
  token,
  forceShowInquiry,
  onBackToCheckout,
  fullName,
  setFullName,
  companyName,
  setCompanyName,
  phoneNumber,
  setPhoneNumber,
  emailAddress,
  setEmailAddress,
  inquiryLocation,
  setInquiryLocation,
  setInquiryLocMeta,
  customerMessage,
  setCustomerMessage,
  submittingInquiry,
  onSubmitInquiry,
  supplierCount = 0,
  errorMessage = null,
  lang,
}: Readonly<CartInquirySectionProps>) {
  const [showLocationFields, setShowLocationFields] = useState(false);

  if (token && !forceShowInquiry) {
    return null;
  }

  const safeLang = normalizeSeoLang(lang, "en");
  const copy = INQUIRY_SECTION_COPY[safeLang];
  const multiCopy = getCartMultiSupplierCopy(safeLang);
  const submitLabel = `🚀 ${getUpperLabel("submit_inquiry", safeLang)}`;

  return (
    <>
      <form
        onSubmit={onSubmitInquiry}
        className="flex flex-col gap-3.5 pt-2 border-t border-cultured mt-1"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold text-eerie-black tracking-wider">
            {copy.formTitle}
          </span>
          {token && (
            <button
              type="button"
              onClick={onBackToCheckout}
              className="text-[9px] font-bold text-salmon-pink bg-transparent border-none cursor-pointer"
            >
              &larr; {copy.goToCheckout}
            </button>
          )}
        </div>

        {supplierCount > 1 && (
          <p className="text-[11px] font-bold text-[#8C6D3F] bg-[#F8F6F2] border border-[#E5E0D8] rounded-md px-3 py-2 m-0">
            {multiCopy.multiDispatchHint.replace("{count}", String(supplierCount))}
          </p>
        )}

        {errorMessage && (
          <div
            role="alert"
            className="text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2"
          >
            {errorMessage}
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label
            htmlFor="inquiry-full-name"
            className="text-[10px] font-extrabold text-eerie-black tracking-[0.5px]"
          >
            {getUpperLabel("full_name", safeLang)}
          </label>
          <input
            id="inquiry-full-name"
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-cultured rounded-[5px] text-xs font-semibold focus:outline-none focus:border-salmon-pink text-eerie-black"
            placeholder={t("placeholder_full_name", safeLang)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="inquiry-company"
            className="text-[10px] font-extrabold text-eerie-black tracking-[0.5px]"
          >
            {getUpperLabel("company_name", safeLang)}
          </label>
          <input
            id="inquiry-company"
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-cultured rounded-[5px] text-xs font-semibold focus:outline-none focus:border-salmon-pink text-eerie-black"
            placeholder={t("placeholder_company_name", safeLang)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="inquiry-phone"
            className="text-[10px] font-extrabold text-eerie-black tracking-[0.5px]"
          >
            {getUpperLabel("phone", safeLang)}
          </label>
          <input
            id="inquiry-phone"
            type="tel"
            required
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-cultured rounded-[5px] text-xs font-semibold focus:outline-none focus:border-salmon-pink text-eerie-black"
            placeholder={t("placeholder_phone", safeLang)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="inquiry-email"
            className="text-[10px] font-extrabold text-eerie-black tracking-[0.5px]"
          >
            {getUpperLabel("email", safeLang)}
          </label>
          <input
            id="inquiry-email"
            type="email"
            required
            value={emailAddress}
            onChange={(e) => setEmailAddress(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-cultured rounded-[5px] text-xs font-semibold focus:outline-none focus:border-salmon-pink text-eerie-black"
            placeholder={t("placeholder_email", safeLang)}
          />
        </div>

        <div className="border border-[#E5E0D8] rounded-md bg-[#FAF8F5] px-3 py-2">
          <button
            type="button"
            onClick={() => setShowLocationFields((prev) => !prev)}
            className="w-full text-left text-[11px] font-bold text-[#8C6D3F] bg-transparent border-none p-0 cursor-pointer flex items-center justify-between"
          >
            <span>📍 {copy.optionalLocationToggle}</span>
            <span>{showLocationFields ? "−" : "+"}</span>
          </button>
          {showLocationFields && (
            <div className="pt-2.5">
              <StructuredLocationFields
                lang={safeLang}
                value={inquiryLocation}
                onChange={setInquiryLocation}
                onMetaChange={setInquiryLocMeta}
                showPostalCode={false}
                compact
                disabled={submittingInquiry}
              />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="inquiry-message"
            className="text-[10px] font-extrabold text-eerie-black tracking-[0.5px]"
          >
            {getUpperLabel("message", safeLang)}
          </label>
          <textarea
            id="inquiry-message"
            value={customerMessage}
            onChange={(e) => setCustomerMessage(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-cultured rounded-[5px] text-xs font-semibold focus:outline-none focus:border-salmon-pink text-eerie-black resize-none h-16"
            placeholder={t("placeholder_message", safeLang)}
          />
        </div>

        <p className="text-[10px] font-medium text-neutral-500 text-center leading-snug m-0">
          {getRecaptchaLegalNotice(safeLang)}
        </p>

        <button
          type="submit"
          disabled={submittingInquiry}
          className="w-full py-3.5 bg-salmon-pink hover:bg-eerie-black text-white rounded-[5px] font-extrabold text-xs tracking-[0.5px] shadow-sm border-none flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-[0.99] transition-all mt-1"
        >
          {submittingInquiry ? (
            <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
          ) : (
            submitLabel
          )}
        </button>
      </form>

      {!token && (
        <div className="mt-3 p-3 bg-zinc-50 border border-zinc-200/60 rounded-lg text-center text-xs font-semibold text-zinc-600">
          {copy.registeredPrompt}{" "}
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent("merter-open-auth", { detail: { mode: "login" } })
              );
            }}
            className="text-salmon-pink font-extrabold hover:underline bg-transparent border-none cursor-pointer"
          >
            {copy.signInBtn}
          </button>
        </div>
      )}
    </>
  );
}
