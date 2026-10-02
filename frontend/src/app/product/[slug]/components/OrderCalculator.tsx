import React from "react";
import { Minus, Plus, ShoppingBag } from "lucide-react";

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
}

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
}: OrderCalculatorProps) {
  return (
    <>
      {/* A. SERIES PACK SALES CALCULATOR */}
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

          {/* Pack sizes/ratios content */}
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

          {/* Quantity counters */}
          <div className="bg-[#fafafa] border border-cultured p-3.5 rounded-[10px] flex items-center justify-between shadow-inner select-none">
            <span className="text-[10px] font-extrabold text-onyx uppercase tracking-[0.5px]">
              {t("pkg_qty_label", lang)}
            </span>

            <div className="flex items-center bg-white border border-cultured rounded-[5px] p-0.5 shadow-sm">
              <button
                type="button"
                onClick={() => handleAdjustPkgQty(-1)}
                className="w-7 h-7 rounded-[5px] border-none bg-transparent hover:bg-[#fafafa] flex items-center justify-center font-bold text-sm cursor-pointer text-onyx select-none transition-colors"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <input
                type="text"
                className="w-10 text-center font-extrabold text-xs focus:outline-none border-none bg-transparent text-eerie-black"
                value={pkgQty}
                readOnly
              />
              <button
                type="button"
                onClick={() => handleAdjustPkgQty(1)}
                className="w-7 h-7 rounded-[5px] border-none bg-transparent hover:bg-[#fafafa] flex items-center justify-center font-bold text-sm cursor-pointer text-onyx select-none transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* B2B CALCULATIONS SUMMARY */}
      <div className="bg-[#fafafa] border border-cultured p-4.5 rounded-[10px] flex flex-col gap-3.5 shadow-inner mt-2">
        <span className="text-[10px] font-extrabold text-salmon-pink uppercase tracking-[0.5px] block select-none">
          {t("order_summary", lang)}
        </span>

        <div className="flex flex-col gap-2 text-xs font-bold text-onyx">
          <div className="flex justify-between">
            <span className="select-none">{t("total_pieces_calc", lang)}:</span>
            <span className="text-eerie-black">
              {totalPieces} {t("piece", lang)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="select-none">{t("total_weight_calc", lang)}:</span>
            <span className="text-eerie-black">
              {totalWeight.toFixed(2)} {t("kg_unit", lang)}
            </span>
          </div>
          <div className="flex justify-between text-sm text-salmon-pink font-extrabold pt-2.5 border-t border-cultured mt-2">
            <span className="select-none">
              {t("total_price_calc", lang)} ({t("excluding_vat", lang)}):
            </span>
            <span>
              {totalPrice.toFixed(2)} {currency}
            </span>
          </div>
        </div>
      </div>

      {/* Add to Inquiry Cart Button */}
      <button
        type="button"
        onClick={handleAddToCart}
        className="w-full py-3.5 bg-salmon-pink hover:bg-eerie-black text-white rounded-[5px] font-extrabold text-xs tracking-[0.5px] uppercase transition-all duration-300 border-none flex items-center justify-center gap-2.5 cursor-pointer select-none active:scale-[0.99]"
      >
        <ShoppingBag className="w-4 h-4 text-white" />
        {t("add_to_cart", lang)}
      </button>
    </>
  );
}
