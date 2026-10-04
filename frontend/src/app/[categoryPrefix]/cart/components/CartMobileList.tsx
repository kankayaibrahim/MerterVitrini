"use client";

import React from "react";
import Image from "next/image";
import { CartItem } from "@/types/store";
import { t } from "@/app/i18n";
import { convertPrice, getResizedImageUrl, ExchangeRate } from "@/app/utils";

interface CartMobileListProps {
  readonly cart: readonly CartItem[];
  readonly lang: string;
  readonly displayCurrency: string;
  readonly exchangeRates: ExchangeRate[];
  readonly onAdjustQty: (index: number, change: number) => void;
  readonly onRemoveItem: (index: number) => void;
}

export default function CartMobileList({
  cart,
  lang,
  displayCurrency,
  exchangeRates,
  onAdjustQty,
  onRemoveItem,
}: Readonly<CartMobileListProps>) {
  return (
    <div className="md:hidden flex flex-col gap-4">
      {cart.map((item, idx) => {
        const itemTotalUnits = item.packages_qty * item.units_per_package;
        const rawItemPricePerUnit = item.price_per_unit;
        const rawItemTotalPrice = itemTotalUnits * rawItemPricePerUnit;

        let pricePerUnit = rawItemPricePerUnit;
        let itemTotalPrice = rawItemTotalPrice;
        let currency = displayCurrency || "TRY";

        if (displayCurrency && exchangeRates && exchangeRates.length > 0) {
          pricePerUnit = convertPrice(rawItemPricePerUnit, item.currency || "TRY", displayCurrency, exchangeRates);
          itemTotalPrice = convertPrice(rawItemTotalPrice, item.currency || "TRY", displayCurrency, exchangeRates);
        } else {
          currency = item.currency || "TRY";
        }

        const itemKey = `${item.product_id}_${item.color || "def"}_${idx}`;

        return (
          <div key={itemKey} className="bg-white border border-cultured rounded-[12px] p-4 flex flex-col gap-3 shadow-sm relative">
            <button
              onClick={() => onRemoveItem(idx)}
              className="absolute top-4 right-4 text-sonic-silver hover:text-red-500 bg-transparent border-none cursor-pointer text-sm transition-colors"
            >
              ✕
            </button>
            <div className="flex gap-4">
              <div className="relative w-14 h-18 rounded-[5px] overflow-hidden bg-[#fafafa] border border-cultured shrink-0">
                <Image 
                  src={getResizedImageUrl(item.image_url, 80, 106)} 
                  alt={item.title} 
                  fill
                  sizes="56px"
                  className="object-cover"
                  unoptimized
                />
              </div>
              <div className="flex-grow min-w-0 pr-4">
                <a
                  href={`/product/${item.slug || item.product_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-eerie-black hover:text-salmon-pink transition-colors line-clamp-2 leading-relaxed no-underline block"
                >
                  {item.title_translations?.[lang] || item.title}
                </a>
                <span className="text-[10px] font-bold text-accent-gold block mt-0.5">
                  {t("color", lang)}: {item.color} | SKU: {item.custom_sku}
                </span>
                <span className="text-[10px] font-semibold text-sonic-silver block mt-0.5">
                  {item.units_per_package} {lang === "tr" ? "Adet/Paket" : "Pcs/Pack"}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-cultured pt-3 mt-1">
              <div className="flex items-center gap-1.5 bg-white border border-cultured rounded-[5px] p-0.5">
                <button 
                  onClick={() => onAdjustQty(idx, -1)}
                  className="w-6 h-6 rounded-[5px] border border-cultured bg-[#fafafa] flex items-center justify-center font-bold text-[10px] cursor-pointer"
                >
                  −
                </button>
                <span className="text-xs font-bold text-onyx px-1.5">
                  {item.packages_qty} {lang === "tr" ? "Pkt" : "Pck"}
                </span>
                <button 
                  onClick={() => onAdjustQty(idx, 1)}
                  className="w-6 h-6 rounded-[5px] border border-cultured bg-[#fafafa] flex items-center justify-center font-bold text-[10px] cursor-pointer"
                >
                  +
                </button>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-semibold text-sonic-silver block">
                  {itemTotalUnits} {lang === "tr" ? "Adet" : t("piece", lang)} x {pricePerUnit.toFixed(2)} {currency}
                </span>
                <span className="text-xs font-extrabold text-eerie-black block mt-0.5">
                  {itemTotalPrice.toFixed(2)} {currency}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
