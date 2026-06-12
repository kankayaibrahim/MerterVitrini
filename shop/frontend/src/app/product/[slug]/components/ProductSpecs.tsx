import React from "react";
import { Product } from "@/types/store";

interface ProductSpecsProps {
  product: Product;
  title: string;
  lang: string;
  t: (key: string, lang: string) => string;
  hasDiscount: boolean;
  unitPrice: number;
  discountedPrice: number;
  currency: string;
  dynamicAttrs: Array<{ name: string; value: string }>;
}

export default function ProductSpecs({
  product,
  title,
  lang,
  t,
  hasDiscount,
  unitPrice,
  discountedPrice,
  currency,
  dynamicAttrs,
}: ProductSpecsProps) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="text-[11px] uppercase font-extrabold tracking-[0.5px] text-salmon-pink">
          {product.brand_name || t("merter_manufacturer", lang)}
        </span>
        <h1 className="font-sans font-extrabold text-2xl md:text-3xl text-eerie-black leading-snug mt-1">
          {title}
        </h1>
        <span className="text-[11px] font-bold text-sonic-silver mt-2 block">
          {t("sku_label", lang) || "SKU"}: {product.custom_sku || product.source_product_id}
        </span>
      </div>

      {/* Pricing breakdown */}
      <div className="flex items-center gap-3 bg-[#fafafa] border border-cultured rounded-[8px] px-5 py-4 shadow-inner select-none">
        <span className="text-[10px] font-extrabold text-onyx uppercase tracking-[0.5px] shrink-0">
          {t("unit_price_label", lang)}
        </span>
        <div className="flex items-baseline gap-2.5">
          {hasDiscount ? (
            <>
              <span className="text-xs text-sonic-silver line-through">
                {unitPrice.toFixed(2)} {currency}
              </span>
              <span className="text-xl font-extrabold text-salmon-pink">
                {discountedPrice.toFixed(2)} {currency}
              </span>
            </>
          ) : (
            <span className="text-xl font-extrabold text-eerie-black">
              {unitPrice.toFixed(2)} {currency}
            </span>
          )}
        </div>
      </div>

      {/* Specifications Grid */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="border border-cultured rounded-[5px] p-3 bg-white flex flex-col gap-0.5 shadow-sm">
          <span className="text-[9px] uppercase font-extrabold text-sonic-silver tracking-[0.5px] select-none">{t("fabric", lang)}</span>
          <span className="font-bold text-eerie-black truncate">{t(product.kumas_fabric || "Viskon / Pamuk", lang)}</span>
        </div>
        <div className="border border-cultured rounded-[5px] p-3 bg-white flex flex-col gap-0.5 shadow-sm select-none">
          <span className="text-[9px] uppercase font-extrabold text-sonic-silver tracking-[0.5px]">
            {t("gender_spec", lang)} / {t("season_spec", lang)}
          </span>
          <span className="font-bold text-eerie-black truncate">
            {t(product.gender || "Unisex", lang)} / {t(product.season || "Mevsimlik", lang)}
          </span>
        </div>
        <div className="border border-cultured rounded-[5px] p-3 bg-white flex flex-col gap-0.5 shadow-sm select-none">
          <span className="text-[9px] uppercase font-extrabold text-sonic-silver tracking-[0.5px]">{t("desi", lang)}</span>
          <span className="font-bold text-eerie-black">{(product.desi_volume || 2)} {t("desi_unit", lang)}</span>
        </div>
        <div className="border border-cultured rounded-[5px] p-3 bg-white flex flex-col gap-0.5 shadow-sm select-none">
          <span className="text-[9px] uppercase font-extrabold text-sonic-silver tracking-[0.5px]">{t("min_order_qty", lang)}</span>
          <span className="font-bold text-eerie-black truncate">
            {product.minimum_order_quantity} {t("piece", lang)}
          </span>
        </div>
        
        {dynamicAttrs && dynamicAttrs.map((attr, idx) => (
          <div key={idx} className="border border-cultured rounded-[5px] p-3 bg-white flex flex-col gap-0.5 shadow-sm select-none">
            <span className="text-[9px] uppercase font-extrabold text-sonic-silver tracking-[0.5px] truncate">{t(attr.name, lang)}</span>
            <span className="font-bold text-eerie-black truncate">{t(attr.value, lang)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
