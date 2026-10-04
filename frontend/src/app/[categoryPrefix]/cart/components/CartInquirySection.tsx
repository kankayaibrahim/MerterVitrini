"use client";

import React from "react";
import { t } from "@/app/i18n";

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
  readonly customerMessage: string;
  readonly setCustomerMessage: (v: string) => void;
  readonly submittingInquiry: boolean;
  readonly onSubmitInquiry: (e: React.FormEvent) => void;
  readonly lang: string;
}

function getSubmitInquiryLabel(lang: string): string {
  const locale = lang === "tr" ? "tr" : "en";
  return `🚀 ${t("submit_inquiry", lang).toLocaleUpperCase(locale)}`;
}

function getUpperLabel(key: string, lang: string): string {
  const locale = lang === "tr" ? "tr" : "en";
  return t(key, lang).toLocaleUpperCase(locale);
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
  customerMessage,
  setCustomerMessage,
  submittingInquiry,
  onSubmitInquiry,
  lang,
}: Readonly<CartInquirySectionProps>) {
  if (token && !forceShowInquiry) {
    return null;
  }

  const submitLabel = getSubmitInquiryLabel(lang);

  return (
    <>
      <form onSubmit={onSubmitInquiry} className="flex flex-col gap-3.5 pt-2 border-t border-cultured mt-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold text-eerie-black tracking-wider">
            {lang === "tr" ? "TEKLİF TALEP FORMU" : "REQUEST QUOTE FORM"}
          </span>
          {token && (
            <button
              type="button"
              onClick={onBackToCheckout}
              className="text-[9px] font-bold text-salmon-pink bg-transparent border-none cursor-pointer"
            >
              &larr; {lang === "tr" ? "Checkout'a Git" : "Go to Checkout"}
            </button>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="inquiry-full-name" className="text-[10px] font-extrabold text-eerie-black tracking-[0.5px]">
            {getUpperLabel("full_name", lang)}
          </label>
          <input 
            id="inquiry-full-name"
            type="text" 
            required 
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-cultured rounded-[5px] text-xs font-semibold focus:outline-none focus:border-salmon-pink text-eerie-black"
            placeholder={t("placeholder_full_name", lang)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="inquiry-company" className="text-[10px] font-extrabold text-eerie-black tracking-[0.5px]">
            {getUpperLabel("company_name", lang)}
          </label>
          <input 
            id="inquiry-company"
            type="text" 
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-cultured rounded-[5px] text-xs font-semibold focus:outline-none focus:border-salmon-pink text-eerie-black"
            placeholder={t("placeholder_company_name", lang)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="inquiry-phone" className="text-[10px] font-extrabold text-eerie-black tracking-[0.5px]">
            {getUpperLabel("phone", lang)}
          </label>
          <input 
            id="inquiry-phone"
            type="tel" 
            required 
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-cultured rounded-[5px] text-xs font-semibold focus:outline-none focus:border-salmon-pink text-eerie-black"
            placeholder={t("placeholder_phone", lang)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="inquiry-email" className="text-[10px] font-extrabold text-eerie-black tracking-[0.5px]">
            {getUpperLabel("email", lang)}
          </label>
          <input 
            id="inquiry-email"
            type="email" 
            required 
            value={emailAddress}
            onChange={(e) => setEmailAddress(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-cultured rounded-[5px] text-xs font-semibold focus:outline-none focus:border-salmon-pink text-eerie-black"
            placeholder={t("placeholder_email", lang)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="inquiry-message" className="text-[10px] font-extrabold text-eerie-black tracking-[0.5px]">
            {getUpperLabel("message", lang)}
          </label>
          <textarea 
            id="inquiry-message"
            value={customerMessage}
            onChange={(e) => setCustomerMessage(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-cultured rounded-[5px] text-xs font-semibold focus:outline-none focus:border-salmon-pink text-eerie-black resize-none h-16"
            placeholder={t("placeholder_message", lang)}
          />
        </div>

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

      {/* Login hint for guest orders */}
      {!token && (
        <div className="mt-3 p-3 bg-zinc-50 border border-zinc-200/60 rounded-lg text-center text-xs font-semibold text-zinc-600">
          {lang === "tr" ? "Kayıtlı bayimiz misiniz?" : "Are you our registered dealer?"}{" "}
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(new CustomEvent("merter-open-auth", { detail: { mode: "login" } }));
            }}
            className="text-salmon-pink font-extrabold hover:underline bg-transparent border-none cursor-pointer"
          >
            {lang === "tr" ? "Giriş Yapın" : "Sign In"}
          </button>
        </div>
      )}
    </>
  );
}
