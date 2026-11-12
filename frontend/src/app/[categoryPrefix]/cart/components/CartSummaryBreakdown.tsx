"use client";

import React from "react";
import { t } from "@/app/i18n";
import { ExchangeRate } from "@/app/utils";
import {
  INTL_LOCALE_BY_LANG,
  SupportedSeoLang,
  normalizeSeoLang,
} from "@/utils/seoHelpers";

interface SummaryBreakdownCopy {
  readonly heading: string;
  readonly packUnit: string;
}

const SUMMARY_COPY: Record<SupportedSeoLang, SummaryBreakdownCopy> = {
  tr: { heading: "SİPARİŞ ÖZETİ", packUnit: "Paket" },
  en: { heading: "ORDER SUMMARY", packUnit: "Packs" },
  ru: { heading: "СВОДКА ЗАКАЗА", packUnit: "Серий" },
  ar: { heading: "ملخص الطلب", packUnit: "باكيدج" },
  de: { heading: "BESTELLÜBERSICHT", packUnit: "Pakete" },
  fr: { heading: "RÉCAPITULATIF", packUnit: "Séries" },
  pl: { heading: "PODSUMOWANIE ZAMÓWIENIA", packUnit: "Paczek" },
  bg: { heading: "ОБОБЩЕНИЕ НА ПОРЪЧКАТА", packUnit: "Серии" },
};

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

function formatExchangeDate(rawDate?: string, safeLang: SupportedSeoLang = "en"): string {
  if (!rawDate) return "";
  try {
    const d = new Date(rawDate);
    return d.toLocaleDateString(INTL_LOCALE_BY_LANG[safeLang], {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return String(rawDate).split("T")[0] || "";
  }
}

function getTCMBDateInfo(formattedDate: string, lang: SupportedSeoLang): string {
  const templates: Record<SupportedSeoLang, string> = {
    tr: `* ${formattedDate} tarihli TCMB kur bilgileri baz alınmıştır. (TR/İstanbul saat dilimi esaslıdır)`,
    en: `* Rates based on official TCMB publication of ${formattedDate} (TR/Istanbul time-boundary applied)`,
    ru: `* Курсы основаны на официальной публикации ЦБ Турции (TCMB) от ${formattedDate} (по часовому поясу TR/Стамбул)`,
    ar: `* الأسعار تعتمد على النشرة الرسمية للبنك المركزي التركي (TCMB) بتاريخ ${formattedDate} (توقيت تركيا/إسطنبول)`,
    de: `* Die Kurse basieren auf der offiziellen Veröffentlichung der TCMB vom ${formattedDate} (TR/Istanbul-Zeitzone gilt)`,
    pl: `* Kursy oparte na oficjalnej publikacji Banku Centralnego Turcji (TCMB) z dnia ${formattedDate} (obowiązuje strefa czasowa TR/Stambuł)`,
    bg: `* Валутните курсове са базирани на официалната публикация на TCMB от ${formattedDate} (приложена е часовата зона TR/Истанбул)`,
    fr: `* Les taux de change sont basés sur la publication officielle de la TCMB du ${formattedDate} (fuseau horaire TR/Istanbul appliqué)`,
  };
  return templates[lang];
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
  const safeLang = normalizeSeoLang(lang, "en");
  const copy = SUMMARY_COPY[safeLang];

  const ratesBanner =
    exchangeRates && exchangeRates.length > 0
      ? exchangeRates.filter((r) => ["USD", "EUR", "GBP"].includes(r.currency_code.toUpperCase()))
      : [];

  const rawDate = exchangeRates?.find((r) => r.publication_date)?.publication_date;
  const formattedDate = formatExchangeDate(rawDate, safeLang);
  const dateInfo = getTCMBDateInfo(formattedDate, safeLang);
  const eqHeading =
    safeLang === "ar"
      ? t("exchange_rate_equivalents", safeLang)
      : t("exchange_rate_equivalents", safeLang).toLocaleUpperCase(INTL_LOCALE_BY_LANG[safeLang]);

  return (
    <div className="bg-white border border-cultured rounded-[12px] p-5 shadow-premium flex flex-col gap-4">
      <h3 className="font-sans font-extrabold text-sm text-eerie-black border-b border-cultured pb-3 tracking-wider">
        {copy.heading}
      </h3>

      <div className="flex flex-col gap-3.5 text-xs font-bold text-davys-gray">
        <div className="flex justify-between items-center">
          <span>{t("total_packages", safeLang)}:</span>
          <span className="text-eerie-black font-extrabold">
            {totalPkgs} {copy.packUnit}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span>{t("total_qty", safeLang)}:</span>
          <span className="text-eerie-black font-extrabold">
            {totalItemsCount} {t("piece", safeLang)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span>{t("total_weight", safeLang)}:</span>
          <span className="text-eerie-black font-extrabold">{totalWeight.toFixed(2)} kg</span>
        </div>

        <div className="flex justify-between items-center text-sm font-extrabold text-salmon-pink border-t border-cultured pt-4 mt-2">
          <span>{t("grand_total", safeLang)}:</span>
          <span className="text-[16px]">
            {finalTotalPrice.toFixed(2)} {displayCurrency}
          </span>
        </div>
      </div>

      <div className="mt-2 pt-4 border-t border-dashed border-cultured flex flex-col gap-3 bg-[#fafafa] p-3.5 rounded-[8px] border border-cultured">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-extrabold text-sonic-silver tracking-wider">
            {eqHeading}
          </span>
          {ratesBanner.length > 0 && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] font-semibold text-spanish-gray">
                {t("active_tcmb_rates", safeLang)}{" "}
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
