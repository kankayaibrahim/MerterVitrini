"use client";

import React from "react";
import Image from "next/image";
import { Gift, CheckCircle2, ShoppingBag } from "lucide-react";
import { ChatMessage, resolveChatLang } from "@/types/chat";
import { pickLangText, SupportedLangCode, t } from "@/app/i18n";
import { convertPrice, ExchangeRate } from "@/app/utils";

interface OfferCardTexts {
  badgeTitle: string;
  discountBadge: (pct: string) => string;
  productFallbackAlt: string;
  totalOfferLabel: (pkgs: number) => string;
  acceptedAdded: string;
  addingToCart: string;
  acceptAndAdd: string;
}

const OFFER_CARD_TEXTS: Record<SupportedLangCode, OfferCardTexts> = {
  tr: {
    badgeTitle: "Özel B2B Fiyat Teklifi",
    discountBadge: (pct) => `%${pct} İNDİRİM`,
    productFallbackAlt: "Ürün",
    totalOfferLabel: (pkgs) => `Toplam Teklif Tutarı (${pkgs} Paket):`,
    acceptedAdded: "Teklif Kabul Edildi & Sepete Eklendi",
    addingToCart: "Sepete Ekleniyor...",
    acceptAndAdd: "Teklifi Kabul Et & Sepete Ekle",
  },
  en: {
    badgeTitle: "Special B2B Price Offer",
    discountBadge: (pct) => `${pct}% OFF`,
    productFallbackAlt: "Product",
    totalOfferLabel: (pkgs) => `Total Offer Amount (${pkgs} Packs):`,
    acceptedAdded: "Offer Accepted & Added to Cart",
    addingToCart: "Adding to Cart...",
    acceptAndAdd: "Accept Offer & Add to Cart",
  },
  ru: {
    badgeTitle: "Специальное B2B предложение",
    discountBadge: (pct) => `СКИДКА ${pct}%`,
    productFallbackAlt: "Товар",
    totalOfferLabel: (pkgs) => `Итоговая сумма предложения (${pkgs} уп.):`,
    acceptedAdded: "Предложение принято и добавлено в корзину",
    addingToCart: "Добавление в корзину...",
    acceptAndAdd: "Принять предложение и в корзину",
  },
  ar: {
    badgeTitle: "عرض سعر B2B خاص",
    discountBadge: (pct) => `خصم ${pct}%`,
    productFallbackAlt: "منتج",
    totalOfferLabel: (pkgs) => `إجمالي قيمة العرض (${pkgs} حزمة):`,
    acceptedAdded: "تم قبول العرض وإضافته إلى السلة",
    addingToCart: "جاري الإضافة إلى السلة...",
    acceptAndAdd: "قبول العرض وإضافته إلى السلة",
  },
  de: {
    badgeTitle: "Sonder-B2B-Preisangebot",
    discountBadge: (pct) => `${pct}% RABATT`,
    productFallbackAlt: "Produkt",
    totalOfferLabel: (pkgs) => `Gesamtangebotsbetrag (${pkgs} Pakete):`,
    acceptedAdded: "Angebot angenommen & in den Warenkorb gelegt",
    addingToCart: "Wird hinzugefügt...",
    acceptAndAdd: "Angebot annehmen & in den Warenkorb",
  },
  fr: {
    badgeTitle: "Offre de prix B2B spéciale",
    discountBadge: (pct) => `-${pct}% REMISE`,
    productFallbackAlt: "Produit",
    totalOfferLabel: (pkgs) => `Montant total de l'offre (${pkgs} lots) :`,
    acceptedAdded: "Offre acceptée et ajoutée au panier",
    addingToCart: "Ajout au panier...",
    acceptAndAdd: "Accepter l'offre et ajouter au panier",
  },
  pl: {
    badgeTitle: "Specjalna oferta cenowa B2B",
    discountBadge: (pct) => `-${pct}% RABATU`,
    productFallbackAlt: "Produkt",
    totalOfferLabel: (pkgs) => `Łączna kwota oferty (${pkgs} pak.):`,
    acceptedAdded: "Oferta zaakceptowana i dodana do koszyka",
    addingToCart: "Dodawanie do koszyka...",
    acceptAndAdd: "Zaakceptuj ofertę i dodaj do koszyka",
  },
  bg: {
    badgeTitle: "Специална B2B ценова оферта",
    discountBadge: (pct) => `${pct}% ОТСТЪПКА`,
    productFallbackAlt: "Продукт",
    totalOfferLabel: (pkgs) => `Обща сума на офертата (${pkgs} пакета):`,
    acceptedAdded: "Офертата е приета и добавена в количката",
    addingToCart: "Добавяне в количката...",
    acceptAndAdd: "Приеми офертата и добави в количката",
  },
};

interface ChatOfferCardProps {
  readonly msg: ChatMessage;
  readonly displayCurrency: string;
  readonly exchangeRates: readonly ExchangeRate[];
  readonly acceptingId: string | null;
  readonly onAcceptOffer: (msg: ChatMessage) => void;
  readonly lang?: string;
}

export function ChatOfferCard({
  msg,
  displayCurrency,
  exchangeRates,
  acceptingId,
  onAcceptOffer,
  lang,
}: Readonly<ChatOfferCardProps>) {
  const effectiveLang = resolveChatLang(lang);
  const txt = pickLangText(effectiveLang, OFFER_CARD_TEXTS);
  const pkgLabel = t("package", effectiveLang);
  const pieceLabel = t("piece", effectiveLang);

  const meta = msg.metadata || {};
  const unitsPerPkg = meta.units_per_package || 1;
  const pkgs = meta.packages_qty || 1;
  const totalPieces = pkgs * unitsPerPkg;

  const origUnitConv = convertPrice(
    meta.original_unit_price || 0,
    meta.currency || "TRY",
    displayCurrency,
    [...exchangeRates]
  );
  const offeredUnitConv = convertPrice(
    meta.offered_unit_price || 0,
    meta.currency || "TRY",
    displayCurrency,
    [...exchangeRates]
  );
  const totalOfferPrice = offeredUnitConv * totalPieces;
  const isAccepted = meta.offer_status === "accepted";

  return (
    <div className="bg-gradient-to-br from-purple-900 via-slate-900 to-slate-900 text-white rounded-2xl p-4 shadow-lg border border-purple-500/40">
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider bg-purple-500/20 text-purple-200 border border-purple-400/30 px-2.5 py-1 rounded-full">
          <Gift className="w-3.5 h-3.5 text-amber-400" />
          {txt.badgeTitle}
        </span>
        {(meta.discount_percent || 0) > 0 && (
          <span className="px-2.5 py-0.5 bg-amber-400 text-slate-950 font-black text-[11px] rounded-full">
            {txt.discountBadge((meta.discount_percent ?? 0).toFixed(1))}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 bg-white/10 rounded-xl p-2.5 mb-3">
        <Image
          src={meta.image_url || "/placeholder.png"}
          alt={meta.title || txt.productFallbackAlt}
          width={56}
          height={64}
          unoptimized
          className="w-14 h-16 object-cover rounded-lg shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="font-bold text-xs text-white truncate">
            {meta.title}
          </div>
          <div className="text-[11px] text-slate-300 mt-0.5">
            SKU: {meta.custom_sku} • {pkgs} {pkgLabel} ({totalPieces} {pieceLabel})
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            {origUnitConv > offeredUnitConv && (
              <span className="text-[11px] text-slate-400 line-through">
                {origUnitConv.toFixed(2)} {displayCurrency}
              </span>
            )}
            <span className="text-sm font-black text-emerald-400">
              {offeredUnitConv.toFixed(2)} {displayCurrency} / {pieceLabel}
            </span>
          </div>
        </div>
      </div>

      {msg.content && (
        <p className="text-xs text-slate-200 mb-3 italic bg-black/20 px-3 py-2 rounded-lg">
          &ldquo;{msg.content}&rdquo;
        </p>
      )}

      <div className="flex items-center justify-between text-xs border-t border-white/15 pt-2.5 mb-3">
        <span className="text-slate-300 font-semibold">
          {txt.totalOfferLabel(pkgs)}
        </span>
        <span className="text-base font-black text-amber-300">
          {totalOfferPrice.toFixed(2)} {displayCurrency}
        </span>
      </div>

      {isAccepted ? (
        <div className="w-full py-2.5 bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          {txt.acceptedAdded}
        </div>
      ) : (
        <button
          type="button"
          disabled={acceptingId === msg.id}
          onClick={() => onAcceptOffer(msg)}
          className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer border-none shadow-md"
        >
          <ShoppingBag className="w-4 h-4" />
          {acceptingId === msg.id ? txt.addingToCart : txt.acceptAndAdd}
        </button>
      )}
    </div>
  );
}

