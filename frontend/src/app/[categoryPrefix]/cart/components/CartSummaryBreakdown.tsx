"use client";

import React from "react";
import { t } from "@/app/i18n";
import { ExchangeRate } from "@/app/utils";

interface CartSummaryBreakdownProps {
  readonly totalPkgs: number;
  readonly totalItemsCount: number;
  readonly totalWeight: number;
  readonly finalTotalPrice: number;
  readonly displayCurrency: string;
  readonly lang: string;
  readonly eqTRY: number;
  readonly eqUSD: number;
  readonly eqEUR: number;
  readonly eqGBP: number;
  readonly exchangeRates: readonly ExchangeRate[];
}

function getSafeLocale(l: string): string {
  switch (l) {
    case "tr": return "tr-TR";
    case "en": return "en-US";
    case "ru": return "ru-RU";
    case "ar": return "ar-EG";
    case "de": return "de-DE";
    case "pl": return "pl-PL";
    case "bg": return "bg-BG";
    case "fr": return "fr-FR";
    default: return "en-US";
  }
}

function formatExchangeDate(rawDate?: string, lang = "en"): string {
  if (!rawDate) return "";
  try {
    const d = new Date(rawDate);
    return d.toLocaleDateString(getSafeLocale(lang), {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return String(rawDate).split("T")[0] || "";
  }
}

function getTCMBDateInfo(formattedDate: string, lang: string): string {
  switch (lang) {
    case "tr":
      return `* ${formattedDate} tarihli TCMB kur bilgileri baz alınmıştır. (TR/İstanbul saat dilimi esaslıdır)`;
    case "ru":
      return `* Курсы основаны на официальной публикации ЦБ Турции (TCMB) от ${formattedDate} (по часовому поясу TR/Стамбул)`;
    case "ar":
      return `* الأسعار تعتمد على النشرة الرسمية للبنك المركزي التركي (TCMB) بتاريخ ${formattedDate} (توقيت تركيا/إسطنبول)`;
    case "de":
      return `* Die Kurse basieren auf der offiziellen Veröffentlichung der TCMB vom ${formattedDate} (TR/Istanbul-Zeitzone gilt)`;
    case "pl":
      return `* Kursy oparte na oficjalnej publikacji Banku Centralnego Turcji (TCMB) z dnia ${formattedDate} (obowiązuje strefa czasowa TR/Stambuł)`;
    case "bg":
      return `* Валутните курсове са базирани на официалната публикация на TCMB от ${formattedDate} (приложена е часовата зона TR/Истанбул)`;
    case "fr":
      return `* Les taux de change sont basés sur la publication officielle de la TCMB du ${formattedDate} (fuseau horaire TR/Istanbul appliqué)`;
    default:
      return `* Rates based on official TCMB publication of ${formattedDate} (TR/Istanbul time-boundary applied)`;
  }
}

export default function CartSummaryBreakdown({
  totalPkgs,
  totalItemsCount,
  totalWeight,
  finalTotalPrice,
  displayCurrency,
  lang,
  eqTRY,
  eqUSD,
  eqEUR,
  eqGBP,
  exchangeRates,
}: Readonly<CartSummaryBreakdownProps>) {
  const ratesBanner = exchangeRates && exchangeRates.length > 0
    ? exchangeRates.filter(r => ["USD", "EUR", "GBP"].includes(r.currency_code.toUpperCase()))
    : [];

  const rawDate = exchangeRates?.find(r => r.publication_date)?.publication_date;
  const formattedDate = formatExchangeDate(rawDate, lang);
  const dateInfo = getTCMBDateInfo(formattedDate, lang);

  return (
    <div className="bg-white border border-cultured rounded-[12px] p-5 shadow-premium flex flex-col gap-4">
      <h3 className="font-sans font-extrabold text-sm text-eerie-black border-b border-cultured pb-3 tracking-wider">
        {lang === "tr" ? "SİPARİŞ ÖZETİ" : "ORDER SUMMARY"}
      </h3>
      
      <div className="flex flex-col gap-3.5 text-xs font-bold text-davys-gray">
        <div className="flex justify-between items-center">
          <span>{t("total_packages", lang)}:</span>
          <span className="text-eerie-black font-extrabold">{totalPkgs} {lang === "tr" ? "Paket" : "Pack"}</span>
        </div>
        <div className="flex justify-between items-center">
          <span>{t("total_qty", lang)}:</span>
          <span className="text-eerie-black font-extrabold">{totalItemsCount} {lang === "tr" ? "Adet" : t("piece", lang)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span>{t("total_weight", lang)}:</span>
          <span className="text-eerie-black font-extrabold">{totalWeight.toFixed(2)} kg</span>
        </div>
        
        <div className="flex justify-between items-center text-sm font-extrabold text-salmon-pink border-t border-cultured pt-4 mt-2">
          <span>{t("grand_total", lang)}:</span>
          <span className="text-[16px]">{finalTotalPrice.toFixed(2)} {displayCurrency}</span>
        </div>
      </div>

      {/* TCMB Multi-Currency Exchange Equivalents Card */}
      <div className="mt-2 pt-4 border-t border-dashed border-cultured flex flex-col gap-3 bg-[#fafafa] p-3.5 rounded-[8px] border border-cultured">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-extrabold text-sonic-silver tracking-wider">
            {t("exchange_rate_equivalents", lang).toLocaleUpperCase(lang === "tr" ? "tr" : "en")}
          </span>
          {ratesBanner.length > 0 && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] font-semibold text-spanish-gray">
                {t("active_tcmb_rates", lang)}{" "}
                {ratesBanner.map((r, i) => (
                  <span key={r.currency_code} className="font-bold text-sonic-silver">
                    {i > 0 && " | "}1 {r.currency_code} = {Number(r.buying_rate).toFixed(4)} TL
                  </span>
                ))}
              </span>
              {formattedDate && (
                <span className="text-[8px] font-medium text-spanish-gray italic leading-normal">
                  {dateInfo}
                </span>
              )}
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-2 gap-2 text-[10px] font-extrabold text-onyx">
          <div className="flex items-center justify-between bg-white border border-cultured rounded p-2 shadow-sm">
            <span className="text-sonic-silver">🇹🇷 TRY:</span>
            <span className="text-eerie-black font-extrabold">{eqTRY.toFixed(2)} ₺</span>
          </div>
          <div className="flex items-center justify-between bg-white border border-cultured rounded p-2 shadow-sm">
            <span className="text-sonic-silver">🇺🇸 USD:</span>
            <span className="text-eerie-black font-extrabold">${eqUSD.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between bg-white border border-cultured rounded p-2 shadow-sm">
            <span className="text-sonic-silver">🇪🇺 EUR:</span>
            <span className="text-eerie-black font-extrabold">€{eqEUR.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between bg-white border border-cultured rounded p-2 shadow-sm">
            <span className="text-sonic-silver">🇬🇧 GBP:</span>
            <span className="text-eerie-black font-extrabold">£{eqGBP.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
