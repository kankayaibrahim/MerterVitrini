"use client";

import React from "react";
import { Minus, Plus, ShoppingBag, MessageSquare, Lock } from "lucide-react";
import {
  useIsStoreAuthenticated,
  useIsStoreMemberLoggedIn,
  openStoreAuthModal,
  getMemberPriceLabel,
  getShortMemberPriceLabel,
} from "@/app/storeAuth";
import { normalizeSeoLang, SupportedSeoLang } from "@/utils/seoHelpers";

interface OrderCalculatorProps {
  readonly hasSeries: boolean;
  readonly unitsPerPkg: number;
  readonly sizes: readonly string[];
  readonly ratios: readonly string[];
  readonly pkgQty: number;
  readonly handleAdjustPkgQty: (change: number) => void;
  readonly totalPieces: number;
  readonly totalWeight: number;
  readonly totalPrice: number;
  readonly currency: string;
  readonly lang: string;
  readonly t: (key: string, lang: string) => string;
  readonly handleAddToCart: () => void;
  readonly onOpenSupplierChat?: () => void;
  readonly isPriceLoading?: boolean;
}

const CHAT_CTA_COPY: Record<
  SupportedSeoLang,
  {
    askSupplier: string;
    loginForChat: string;
    decPkg: string;
    incPkg: string;
    unlockHint: string;
    registerFree: string;
  }
> = {
  tr: {
    askSupplier: "Tedarikçiye Sor / Özel Fiyat İste (Canlı)",
    loginForChat: "Canlı Sohbet & Özel Fiyat İçin Giriş Yap",
    decPkg: "Paket sayısını azalt",
    incPkg: "Paket sayısını artır",
    unlockHint: "Toptan fabrika fiyatlarını görmek, sepete seri eklemek ve üreticiyle canlı görüşmek için giriş yapın.",
    registerFree: "Ücretsiz B2B Kayıt",
  },
  en: {
    askSupplier: "Ask Manufacturer / Request Custom Price (Live)",
    loginForChat: "Sign In for Live B2B Chat & Custom Pricing",
    decPkg: "Decrease pack quantity",
    incPkg: "Increase pack quantity",
    unlockHint: "Sign in to view factory wholesale prices, add series packs to cart, and chat live with the manufacturer.",
    registerFree: "Free B2B Register",
  },
  ru: {
    askSupplier: "Написать фабрике / Запросить спеццену (Чат)",
    loginForChat: "Войдите для онлайн-чата с фабрикой и спеццены",
    decPkg: "Уменьшить количество серий",
    incPkg: "Увеличить количество серий",
    unlockHint: "Войдите, чтобы видеть оптовые цены фабрики, добавлять серии в корзину и общаться напрямую.",
    registerFree: "Бесплатная B2B регистрация",
  },
  ar: {
    askSupplier: "اسأل المصنع / اطلب سعر جملة خاص (مباشر)",
    loginForChat: "سجّل الدخول للدردشة المباشرة وطلب عرض سعر خاص",
    decPkg: "تقليل عدد الباكيتات",
    incPkg: "زيادة عدد الباكيتات",
    unlockHint: "سجّل الدخول لعرض أسعار الجملة المباشرة من المصنع، وإضافة الباكيتات للسلة، ومراسلة المنتج.",
    registerFree: "تسجيل B2B مجاني",
  },
  de: {
    askSupplier: "Hersteller fragen / Sonderpreis anfordern (Live)",
    loginForChat: "Anmelden für Live-B2B-Chat & Sonderpreise",
    decPkg: "Paketanzahl verringern",
    incPkg: "Paketanzahl erhöhen",
    unlockHint: "Melden Sie sich an, um Fabrik-Großhandelspreise zu sehen, Serien in den Warenkorb zu legen und live zu chatten.",
    registerFree: "Kostenlose B2B-Registrierung",
  },
  fr: {
    askSupplier: "Contacter le fabricant / Tarif sur mesure (Live)",
    loginForChat: "Connectez-vous pour le chat B2B & tarif spécial",
    decPkg: "Diminuer le nombre de lots",
    incPkg: "Augmenter le nombre de lots",
    unlockHint: "Connectez-vous pour voir les prix d'usine en gros, ajouter des séries au panier et discuter en direct.",
    registerFree: "Inscription B2B gratuite",
  },
  pl: {
    askSupplier: "Zapytaj producenta / Poproś o cenę specjalną (Live)",
    loginForChat: "Zaloguj się, aby otworzyć czat B2B i negocjować cenę",
    decPkg: "Zmniejsz liczbę pakietów",
    incPkg: "Zwiększ liczbę pakietów",
    unlockHint: "Zaloguj się, aby zobaczyć hurtowe ceny fabryczne, dodać pakiety do koszyka i rozmawiać na czacie.",
    registerFree: "Bezpłatna rejestracja B2B",
  },
  bg: {
    askSupplier: "Попитай фабриката / Поискай специална цена (Чат)",
    loginForChat: "Влезте за чат на живо и индивидуална оферта",
    decPkg: "Намали броя серии",
    incPkg: "Увеличи броя серии",
    unlockHint: "Влезте в профила си, за да видите фабричните цени на едро, да добавяте серии и да пишете в чата.",
    registerFree: "Безплатна B2B регистрация",
  },
};

export default function OrderCalculator({
  hasSeries,
  unitsPerPkg,
  sizes,
  ratios,
  pkgQty,
  handleAdjustPkgQty,
  totalPieces,
  totalWeight,
  totalPrice,
  currency,
  lang,
  t,
  handleAddToCart,
  onOpenSupplierChat,
  isPriceLoading,
}: OrderCalculatorProps) {
  const isAuthenticated = useIsStoreAuthenticated();
  const isMemberLoggedIn = useIsStoreMemberLoggedIn();
  const safeLang = normalizeSeoLang(lang, "tr");
  const cta = CHAT_CTA_COPY[safeLang];
  const safeTotalWeight = Number.isFinite(totalWeight) ? totalWeight : 0;
  const safeTotalPrice = Number.isFinite(totalPrice) ? totalPrice : 0;

  return (
    <>
      {hasSeries && (
        <div className="flex flex-col gap-3.5 pt-4 border-t border-cultured">
          <div className="flex items-center justify-between select-none">
            <span className="text-[11px] uppercase font-extrabold text-eerie-black tracking-[0.5px]">
              📦 {t("series_sales_pack", lang)}
            </span>
            <span className="text-[10px] font-bold text-salmon-pink">
              {unitsPerPkg} {t("piece", lang)} / {t("package", lang)}
            </span>
          </div>

          <div>
            <span className="block text-[9px] uppercase font-bold text-sonic-silver mb-2 tracking-[0.5px] select-none">
              {t("pkg_content", lang)}
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {sizes.map((sz, idx) => {
                const count = ratios.at(idx) || "1";
                return (
                  <div
                    key={`size-${sz}-${count}`}
                    className="border border-cultured bg-[#fafafa] rounded-[5px] px-3 py-2 flex items-center justify-between text-[11px] font-bold shadow-inner"
                  >
                    <span className="text-sonic-silver">{sz}</span>
                    <span className="text-salmon-pink">
                      {count} {t("piece", lang)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-[#fafafa] border border-cultured p-3.5 rounded-[10px] flex items-center justify-between shadow-inner select-none">
            <span className="text-[10px] font-extrabold text-onyx uppercase tracking-[0.5px]">
              {t("pkg_qty_label", lang)}
            </span>

            <div className="flex items-center bg-white border border-cultured rounded-[5px] p-0.5 shadow-sm">
              <button
                type="button"
                aria-label={cta.decPkg}
                onClick={() => handleAdjustPkgQty(-1)}
                className="w-7 h-7 rounded-[5px] border-none bg-transparent hover:bg-[#fafafa] flex items-center justify-center font-bold text-sm cursor-pointer text-onyx select-none transition-colors"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <input
                type="text"
                aria-label={t("pkg_qty_label", lang)}
                className="w-10 text-center font-extrabold text-xs focus:outline-none border-none bg-transparent text-eerie-black"
                value={pkgQty}
                readOnly
              />
              <button
                type="button"
                aria-label={cta.incPkg}
                onClick={() => handleAdjustPkgQty(1)}
                className="w-7 h-7 rounded-[5px] border-none bg-transparent hover:bg-[#fafafa] flex items-center justify-center font-bold text-sm cursor-pointer text-onyx select-none transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-[#F8F6F2] border border-[#E5E0D8] p-4 rounded-lg flex flex-col gap-3 mt-1">
        <span className="text-[10px] font-extrabold text-[#8C6D3F] uppercase tracking-[0.5px] block select-none">
          {t("order_summary", lang)}
        </span>

        <div className="flex flex-col gap-2 text-xs font-bold text-[#1C1C1C]">
          <div className="flex justify-between">
            <span className="select-none text-[#525252]">{t("total_pieces_calc", lang)}:</span>
            <span className="text-[#1C1C1C]">
              {totalPieces} {t("piece", lang)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="select-none text-[#525252]">{t("total_weight_calc", lang)}:</span>
            <span className="text-[#1C1C1C]">
              {safeTotalWeight.toFixed(2)} {t("kg_unit", lang)}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm font-extrabold pt-2.5 border-t border-[#E5E0D8] mt-1">
            <span className="select-none text-[#1C1C1C]">
              {t("total_price_calc", lang)} ({t("excluding_vat", lang)}):
            </span>
            {isAuthenticated ? (
              isPriceLoading ? (
                <span
                  className="inline-block h-5 w-20 rounded bg-[#E5E0D8] animate-pulse"
                  aria-busy="true"
                />
              ) : (
                <span className="text-[#1C1C1C]">
                  {safeTotalPrice.toFixed(2)} {currency}
                </span>
              )
            ) : (
              <span className="text-xs font-bold text-[#6E542E]">
                {getShortMemberPriceLabel(lang)}
              </span>
            )}
          </div>
        </div>
      </div>

      {isAuthenticated ? (
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            disabled={Boolean(isPriceLoading)}
            onClick={handleAddToCart}
            className="w-full py-3.5 bg-[#1C1C1C] hover:bg-[#333333] disabled:opacity-60 disabled:cursor-wait text-white rounded-md font-extrabold text-xs tracking-[0.5px] uppercase transition-colors border-none flex items-center justify-center gap-2.5 cursor-pointer select-none active:scale-[0.99]"
          >
            <ShoppingBag className="w-4 h-4 text-white" />
            <span>{t("add_to_cart", lang)}</span>
          </button>

          {onOpenSupplierChat && (
            <button
              type="button"
              onClick={isMemberLoggedIn ? onOpenSupplierChat : () => openStoreAuthModal("login")}
              className="w-full py-3 bg-white hover:bg-[#F8F6F2] text-[#1C1C1C] rounded-md font-extrabold text-xs tracking-[0.5px] uppercase transition-colors border border-[#D6D1C7] hover:border-[#1C1C1C] flex items-center justify-center gap-2.5 cursor-pointer select-none active:scale-[0.99]"
            >
              <MessageSquare className="w-4 h-4 text-[#8C6D3F]" />
              <span>{isMemberLoggedIn ? cta.askSupplier : cta.loginForChat}</span>
            </button>
          )}
        </div>
      ) : (
        <div className="bg-[#FAF7F2] border border-[#D8C7A6] rounded-lg p-4 flex flex-col gap-3">
          <p className="text-xs font-semibold text-[#525252] leading-relaxed">
            {cta.unlockHint}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => openStoreAuthModal("login")}
              className="w-full py-3 px-4 bg-[#1C1C1C] hover:bg-[#333333] text-white rounded-md font-extrabold text-xs tracking-[0.4px] uppercase transition-colors border-none flex items-center justify-center gap-2 cursor-pointer select-none"
            >
              <Lock className="w-3.5 h-3.5 shrink-0" />
              <span>{getMemberPriceLabel(lang)}</span>
            </button>
            <button
              type="button"
              onClick={() => openStoreAuthModal("register")}
              className="w-full py-3 px-4 bg-white hover:bg-[#F8F6F2] text-[#1C1C1C] rounded-md font-extrabold text-xs tracking-[0.4px] uppercase transition-colors border border-[#D6D1C7] hover:border-[#1C1C1C] flex items-center justify-center cursor-pointer select-none"
            >
              <span>{cta.registerFree}</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
