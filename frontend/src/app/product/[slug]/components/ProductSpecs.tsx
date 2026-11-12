"use client";

import React from "react";
import { Lock } from "lucide-react";
import { Product } from "@/types/store";
import { useIsStoreAuthenticated, getMemberPriceLabel } from "@/app/storeAuth";
import { formatAsciiSafeUpper } from "@/utils/formatters";

interface DynamicAttr {
  readonly name: string;
  readonly value: string;
}

interface ProductSpecsProps {
  readonly product: Product;
  readonly title: string;
  readonly lang: string;
  readonly t: (key: string, lang: string) => string;
  readonly hasDiscount: boolean;
  readonly unitPrice: number;
  readonly discountedPrice: number;
  readonly currency: string;
  readonly dynamicAttrs: readonly DynamicAttr[];
  readonly mode?: "all" | "header" | "specs";
}

function ProductSpecsHeader({
  product,
  title,
  lang,
  t,
  hasDiscount,
  unitPrice,
  discountedPrice,
  currency,
  isAuthenticated,
}: Readonly<{
  product: Product;
  title: string;
  lang: string;
  t: (key: string, lang: string) => string;
  hasDiscount: boolean;
  unitPrice: number;
  discountedPrice: number;
  currency: string;
  isAuthenticated: boolean;
}>) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="text-[11px] font-extrabold tracking-[0.8px] text-[#8C6D3F]">
          {formatAsciiSafeUpper(product.brand_name || t("merter_manufacturer", lang))}
        </span>
        <h1 className="font-sans font-extrabold text-2xl md:text-3xl text-[#1C1C1C] leading-snug mt-1">
          {title}
        </h1>
        <span className="text-[11px] font-bold text-[#6B6B6B] mt-2 block">
          {t("sku_label", lang) || "SKU"}: {product.custom_sku || product.source_product_id}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3 bg-[#F8F6F2] border border-[#E5E0D8] rounded-lg px-5 py-4 select-none">
        <span className="text-[10px] font-extrabold text-[#1C1C1C] uppercase tracking-[0.5px] shrink-0">
          {t("unit_price_label", lang)}
        </span>
        {isAuthenticated ? (
          <div className="flex items-baseline gap-2.5">
            {hasDiscount ? (
              <>
                <span className="text-xs text-[#6B6B6B] line-through">
                  {unitPrice.toFixed(2)} {currency}
                </span>
                <span className="text-xl font-extrabold text-[#A30000]">
                  {discountedPrice.toFixed(2)} {currency}
                </span>
              </>
            ) : (
              <span className="text-xl font-extrabold text-[#1C1C1C]">
                {unitPrice.toFixed(2)} {currency}
              </span>
            )}
          </div>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6E542E]">
            <Lock className="w-3.5 h-3.5 text-[#8C6D3F] shrink-0" />
            <span>{getMemberPriceLabel(lang)}</span>
          </span>
        )}
      </div>
    </div>
  );
}

function ProductSpecsGrid({
  product,
  lang,
  t,
  dynamicAttrs,
}: Readonly<{
  product: Product;
  lang: string;
  t: (key: string, lang: string) => string;
  dynamicAttrs: readonly DynamicAttr[];
}>) {
  return (
    <div className="grid grid-cols-2 gap-3 text-xs">
      <div className="border border-[#E5E0D8] rounded-md p-3 bg-white flex flex-col gap-0.5">
        <span className="text-[9px] uppercase font-extrabold text-[#6B6B6B] tracking-[0.5px] select-none">
          {t("fabric", lang)}
        </span>
        <span className="font-bold text-[#1C1C1C] truncate">
          {t(product.kumas_fabric || "Viskon / Pamuk", lang)}
        </span>
      </div>
      <div className="border border-[#E5E0D8] rounded-md p-3 bg-white flex flex-col gap-0.5 select-none">
        <span className="text-[9px] uppercase font-extrabold text-[#6B6B6B] tracking-[0.5px]">
          {t("gender_spec", lang)} / {t("season_spec", lang)}
        </span>
        <span className="font-bold text-[#1C1C1C] truncate">
          {t(product.gender || "Unisex", lang)} / {t(product.season || "Mevsimlik", lang)}
        </span>
      </div>
      <div className="border border-[#E5E0D8] rounded-md p-3 bg-white flex flex-col gap-0.5 select-none">
        <span className="text-[9px] uppercase font-extrabold text-[#6B6B6B] tracking-[0.5px]">
          {t("desi", lang)}
        </span>
        <span className="font-bold text-[#1C1C1C]">
          {product.desi_volume || 2} {t("desi_unit", lang)}
        </span>
      </div>
      <div className="border border-[#E5E0D8] rounded-md p-3 bg-white flex flex-col gap-0.5 select-none">
        <span className="text-[9px] uppercase font-extrabold text-[#6B6B6B] tracking-[0.5px]">
          {t("min_order_qty", lang)}
        </span>
        <span className="font-bold text-[#1C1C1C] truncate">
          {product.minimum_order_quantity} {t("piece", lang)}
        </span>
      </div>

      {dynamicAttrs?.map((attr) => (
        <div
          key={`${attr.name}-${attr.value}`}
          className="border border-[#E5E0D8] rounded-md p-3 bg-white flex flex-col gap-0.5 select-none"
        >
          <span className="text-[9px] uppercase font-extrabold text-[#6B6B6B] tracking-[0.5px] truncate">
            {t(attr.name, lang)}
          </span>
          <span className="font-bold text-[#1C1C1C] truncate">{t(attr.value, lang)}</span>
        </div>
      ))}
    </div>
  );
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
  mode = "all",
}: ProductSpecsProps) {
  const isAuthenticated = useIsStoreAuthenticated();

  if (mode === "header") {
    return (
      <ProductSpecsHeader
        product={product}
        title={title}
        lang={lang}
        t={t}
        hasDiscount={hasDiscount}
        unitPrice={unitPrice}
        discountedPrice={discountedPrice}
        currency={currency}
        isAuthenticated={isAuthenticated}
      />
    );
  }

  if (mode === "specs") {
    return (
      <ProductSpecsGrid
        product={product}
        lang={lang}
        t={t}
        dynamicAttrs={dynamicAttrs}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <ProductSpecsHeader
        product={product}
        title={title}
        lang={lang}
        t={t}
        hasDiscount={hasDiscount}
        unitPrice={unitPrice}
        discountedPrice={discountedPrice}
        currency={currency}
        isAuthenticated={isAuthenticated}
      />
      <ProductSpecsGrid
        product={product}
        lang={lang}
        t={t}
        dynamicAttrs={dynamicAttrs}
      />
    </div>
  );
}
