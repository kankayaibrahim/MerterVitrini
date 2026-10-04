"use client";

import React from "react";
import Image from "next/image";
import { CartItem } from "@/types/store";
import { t } from "@/app/i18n";
import { convertPrice, getResizedImageUrl, ExchangeRate } from "@/app/utils";

interface CartDesktopTableProps {
  readonly cart: readonly CartItem[];
  readonly lang: string;
  readonly displayCurrency: string;
  readonly exchangeRates: ExchangeRate[];
  readonly onAdjustQty: (index: number, change: number) => void;
  readonly onRemoveItem: (index: number) => void;
}

export default function CartDesktopTable({
  cart,
  lang,
  displayCurrency,
  exchangeRates,
  onAdjustQty,
  onRemoveItem,
}: Readonly<CartDesktopTableProps>) {
  return (
    <div className="hidden md:block bg-white border border-cultured rounded-[12px] overflow-hidden shadow-premium">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-[#fafafa] border-b border-cultured text-xs font-extrabold text-sonic-silver tracking-wider">
            <th className="py-4.5 px-5 w-[42%]">{lang === "tr" ? "ÜRÜN" : "PRODUCT"}</th>
            <th className="py-4.5 px-4 text-center w-[12%]">{lang === "tr" ? "BİRİM FİYAT" : "UNIT PRICE"}</th>
            <th className="py-4.5 px-4 text-center w-[15%]">{lang === "tr" ? "PAKET MİKTARI" : "PACKAGE QTY"}</th>
            <th className="py-4.5 px-4 text-center w-[16%]">{lang === "tr" ? "PAKET İÇERİĞİ" : "PACK CONTENT"}</th>
            <th className="py-4.5 px-5 text-right w-[15%]">{lang === "tr" ? "TOPLAM TUTAR" : "TOTAL PRICE"}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-cultured">
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
              <tr key={itemKey} className="hover:bg-[#fafafa]/50 transition-colors">
                <td className="py-4 px-5">
                  <div className="flex gap-4">
                    <div className="relative w-16 h-20 rounded-[5px] overflow-hidden bg-[#fafafa] border border-cultured shrink-0">
                      <Image 
                        src={getResizedImageUrl(item.image_url, 80, 106)} 
                        alt={item.title} 
                        fill
                        sizes="64px"
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                    <div className="flex flex-col gap-1 min-w-0 pr-4">
                      <a
                        href={`/product/${item.slug || item.product_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-bold text-eerie-black hover:text-salmon-pink transition-colors truncate leading-normal no-underline block"
                      >
                        {item.title_translations?.[lang] || item.title}
                      </a>
                      <span className="text-[11px] font-bold text-accent-gold">
                        {t("color", lang)}: {item.color}
                      </span>
                      <span className="text-[11px] font-semibold text-sonic-silver">
                        SKU: {item.custom_sku} | Weight: {(item.weight_per_unit * item.units_per_package).toFixed(2)} kg/pk
                      </span>
                      <button
                        onClick={() => onRemoveItem(idx)}
                        className="text-[11px] font-semibold text-red-500 hover:text-red-700 bg-transparent border-none cursor-pointer self-start p-0 mt-1 transition-colors"
                      >
                        {lang === "tr" ? "Sil" : "Remove"}
                      </button>
                    </div>
                  </div>
                </td>

                <td className="py-4 px-4 text-center">
                  <span className="text-xs font-extrabold text-eerie-black block">
                    {pricePerUnit.toFixed(2)} {currency}
                  </span>
                  <span className="text-[10px] font-semibold text-sonic-silver block mt-0.5">
                    / {lang === "tr" ? "Adet" : t("piece", lang)}
                  </span>
                </td>

                <td className="py-4 px-4">
                  <div className="flex items-center justify-center gap-1.5 bg-[#fafafa] border border-cultured rounded-[5px] p-1 max-w-[110px] mx-auto">
                    <button 
                      onClick={() => onAdjustQty(idx, -1)}
                      className="w-7 h-7 rounded-[5px] border border-cultured bg-white flex items-center justify-center font-bold text-xs hover:border-salmon-pink hover:text-salmon-pink cursor-pointer transition-colors shadow-sm"
                    >
                      −
                    </button>
                    <span className="text-xs font-extrabold text-onyx w-8 text-center">
                      {item.packages_qty}
                    </span>
                    <button 
                      onClick={() => onAdjustQty(idx, 1)}
                      className="w-7 h-7 rounded-[5px] border border-cultured bg-white flex items-center justify-center font-bold text-xs hover:border-salmon-pink hover:text-salmon-pink cursor-pointer transition-colors shadow-sm"
                    >
                      +
                    </button>
                  </div>
                </td>

                <td className="py-4 px-4 text-center">
                  <span className="text-xs font-bold text-davys-gray block">
                    {item.units_per_package} {lang === "tr" ? "Adet" : t("piece", lang)}
                  </span>
                  <span className="text-[10px] font-semibold text-sonic-silver block mt-0.5">
                    ({itemTotalUnits} {lang === "tr" ? "Toplam Adet" : "Total Units"})
                  </span>
                </td>

                <td className="py-4 px-5 text-right">
                  <span className="text-sm font-extrabold text-eerie-black block">
                    {itemTotalPrice.toFixed(2)} {currency}
                  </span>
                  <span className="text-[10px] font-semibold text-sonic-silver block mt-0.5">
                    ({(rawItemTotalPrice).toFixed(2)} {item.currency || "TRY"})
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
