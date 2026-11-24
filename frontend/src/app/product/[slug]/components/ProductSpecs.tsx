"use client";

import React from "react";
import { Lock, MessageCircle } from "lucide-react";
import { Product } from "@/types/store";
import { useIsStoreAuthenticated, getMemberPriceLabel } from "@/app/storeAuth";
import { formatAsciiSafeUpper } from "@/utils/formatters";
import { normalizeSeoLang, SupportedSeoLang } from "@/utils/seoHelpers";
import { isProductWhatsappOnly, getWhatsappOrderingCopy } from "@/utils/whatsappOrdering";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SUPPLIER_CODE_LABELS: Record<
  SupportedSeoLang,
  { readonly supplierCode: string; readonly modelCode: string }
> = {
  tr: { supplierCode: "Üretici Kodu", modelCode: "Model Kodu" },
  en: { supplierCode: "Supplier Code", modelCode: "Model Code" },
  ru: { supplierCode: "Код производителя", modelCode: "Код модели" },
  ar: { supplierCode: "كود المورد", modelCode: "كود الموديل" },
  de: { supplierCode: "Herstellercode", modelCode: "Modellcode" },
  fr: { supplierCode: "Code fournisseur", modelCode: "Code modèle" },
  pl: { supplierCode: "Kod producenta", modelCode: "Kod modelu" },
  bg: { supplierCode: "Код на производителя", modelCode: "Код на модела" },
};

function normalizeDistinctGroupCode(
  rawGroup: string,
  platformSku: string,
  supplierSku: string
): string {
  if (!rawGroup || UUID_PATTERN.test(rawGroup)) {
    return "";
  }
  const groupUpper = rawGroup.toUpperCase();
  if (groupUpper === platformSku.toUpperCase()) {
    return "";
  }
  if (supplierSku) {
    const supplierUpper = supplierSku.toUpperCase();
    if (groupUpper === supplierUpper || supplierUpper.includes(groupUpper)) {
      return "";
    }
  }
  return rawGroup;
}

function resolveProductDisplayCodes(product: Product): {
  platformSku: string;
  supplierSku: string;
  modelCode: string;
} {
  const platformSku = (product.custom_sku || product.source_product_id || "").trim();
  const rawSupplierSku = (product.sku || "").trim();
  const supplierSku =
    rawSupplierSku && rawSupplierSku.toUpperCase() !== platformSku.toUpperCase()
      ? rawSupplierSku
      : "";
  const cleanGroup = normalizeDistinctGroupCode(
    (product.source_product_group_id || "").trim(),
    platformSku,
    supplierSku
  );

  if (!supplierSku && cleanGroup) {
    return { platformSku, supplierSku: cleanGroup, modelCode: "" };
  }
  return { platformSku, supplierSku, modelCode: cleanGroup };
}

function ProductCodeBadges({
  product,
  lang,
  t,
}: Readonly<{
  product: Product;
  lang: string;
  t: (key: string, lang: string) => string;
}>) {
  const safeLang = normalizeSeoLang(lang, "tr");
  const codeLabels = SUPPLIER_CODE_LABELS[safeLang];
  const { platformSku, supplierSku, modelCode } = resolveProductDisplayCodes(product);
  const skuLabel = t("sku_label", lang) || "SKU";

  if (!platformSku && !supplierSku && !modelCode) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mt-2.5">
      {platformSku && (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#6B6B6B] bg-[#fafafa] border border-[#E5E0D8] rounded px-2 py-0.5">
          <span>{skuLabel}:</span>
          <span className="text-[#1C1C1C] font-extrabold">{platformSku}</span>
        </span>
      )}
      {supplierSku && (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#6E542E] bg-[#FAF7F2] border border-[#E5E0D8] rounded px-2 py-0.5">
          <span>{codeLabels.supplierCode}:</span>
          <span className="text-[#1C1C1C] font-extrabold">{supplierSku}</span>
        </span>
      )}
      {modelCode && (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#6E542E] bg-[#FAF7F2] border border-[#E5E0D8] rounded px-2 py-0.5">
          <span>{codeLabels.modelCode}:</span>
          <span className="text-[#1C1C1C] font-extrabold">{modelCode}</span>
        </span>
      )}
    </div>
  );
}

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
  readonly isPriceLoading?: boolean;
}

function ProductUnitPriceValue({
  isWhatsappOnly,
  isAuthenticated,
  isPriceLoading,
  hasDiscount,
  safeUnitPrice,
  safeDiscountedPrice,
  currency,
  lang,
  waPriceBadge,
}: Readonly<{
  isWhatsappOnly: boolean;
  isAuthenticated: boolean;
  isPriceLoading?: boolean;
  hasDiscount: boolean;
  safeUnitPrice: number;
  safeDiscountedPrice: number;
  currency: string;
  lang: string;
  waPriceBadge: string;
}>) {
  if (isWhatsappOnly) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#166534] bg-[#F0FDF4] border border-[#BBF7D0] px-3 py-1.5 rounded-md">
        <MessageCircle className="w-3.5 h-3.5 text-[#15803D] shrink-0" />
        <span>{waPriceBadge}</span>
      </span>
    );
  }
  if (!isAuthenticated) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6E542E]">
        <Lock className="w-3.5 h-3.5 text-[#8C6D3F] shrink-0" />
        <span>{getMemberPriceLabel(lang)}</span>
      </span>
    );
  }
  if (isPriceLoading) {
    return (
      <span
        className="inline-block h-6 w-24 rounded bg-[#E5E0D8] animate-pulse"
        aria-busy="true"
      />
    );
  }
  if (hasDiscount) {
    return (
      <div className="flex items-baseline gap-2.5">
        <span className="text-xs text-[#6B6B6B] line-through">
          {safeUnitPrice.toFixed(2)} {currency}
        </span>
        <span className="text-xl font-extrabold text-[#A30000]">
          {safeDiscountedPrice.toFixed(2)} {currency}
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-baseline gap-2.5">
      <span className="text-xl font-extrabold text-[#1C1C1C]">
        {safeUnitPrice.toFixed(2)} {currency}
      </span>
    </div>
  );
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
  isPriceLoading,
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
  isPriceLoading?: boolean;
}>) {
  const safeUnitPrice = Number.isFinite(unitPrice) ? unitPrice : 0;
  const safeDiscountedPrice = Number.isFinite(discountedPrice) ? discountedPrice : 0;
  const isWhatsappOnly = isProductWhatsappOnly(product);
  const waCopy = getWhatsappOrderingCopy(lang);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="text-[11px] font-extrabold tracking-[0.8px] text-[#8C6D3F]">
          {formatAsciiSafeUpper(product.brand_name || t("merter_manufacturer", lang))}
        </span>
        <h1 className="font-sans font-extrabold text-2xl md:text-3xl text-[#1C1C1C] leading-snug mt-1">
          {title}
        </h1>
        <ProductCodeBadges product={product} lang={lang} t={t} />
      </div>

      <div className="flex items-center justify-between gap-3 bg-[#F8F6F2] border border-[#E5E0D8] rounded-lg px-5 py-4 select-none">
        <span className="text-[10px] font-extrabold text-[#1C1C1C] uppercase tracking-[0.5px] shrink-0">
          {t("unit_price_label", lang)}
        </span>
        <ProductUnitPriceValue
          isWhatsappOnly={isWhatsappOnly}
          isAuthenticated={isAuthenticated}
          isPriceLoading={isPriceLoading}
          hasDiscount={hasDiscount}
          safeUnitPrice={safeUnitPrice}
          safeDiscountedPrice={safeDiscountedPrice}
          currency={currency}
          lang={lang}
          waPriceBadge={waCopy.priceBadge}
        />
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
  isPriceLoading,
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
        isPriceLoading={isPriceLoading}
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
        isPriceLoading={isPriceLoading}
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
