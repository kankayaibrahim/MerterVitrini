"use client";

import React from "react";
import Image from "next/image";
import { Lock } from "lucide-react";
import { getResizedImageUrl } from "@/app/utils";
import { t } from "@/app/i18n";
import { openStoreAuthModal } from "@/app/storeAuth";
import { normalizeSeoLang } from "@/utils/seoHelpers";
import type { CartSupplierGroup, CartSupplierGroupItem } from "@/utils/cartSupplierGroups";
import type { CartMultiSupplierCopy } from "./cartMultiSupplierCopy";

interface CartSupplierLineItemsProps {
  readonly group: CartSupplierGroup;
  readonly lang: string;
  readonly variant: "drawer" | "page";
  readonly isAuthenticated: boolean;
  readonly copy: CartMultiSupplierCopy;
  readonly onAdjustQty: (cartIndex: number, change: number) => void;
  readonly onRemoveItem: (cartIndex: number) => void;
}

function ProductLinkTitle({
  entry,
  safeLang,
  className,
}: {
  readonly entry: CartSupplierGroupItem;
  readonly safeLang: string;
  readonly className: string;
}) {
  const title = entry.item.title_translations?.[safeLang] || entry.item.title;
  const suffix = safeLang === "tr" ? "" : `?lang=${safeLang}`;
  return (
    <a
      href={`/product/${entry.item.slug || entry.item.product_id}${suffix}`}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {title}
    </a>
  );
}

function DrawerLineRow({
  entry,
  safeLang,
  isAuthenticated,
  copy,
  onAdjustQty,
  onRemoveItem,
}: {
  readonly entry: CartSupplierGroupItem;
  readonly safeLang: string;
  readonly isAuthenticated: boolean;
  readonly copy: CartMultiSupplierCopy;
  readonly onAdjustQty: (cartIndex: number, change: number) => void;
  readonly onRemoveItem: (cartIndex: number) => void;
}) {
  const pieceWord = t("piece", safeLang);
  const priceSuffix = isAuthenticated
    ? ` × ${entry.unitPriceDisplay.toFixed(2)} ${entry.displayCurrency}`
    : "";

  return (
    <div className="border-t border-[#E5E0D8]/70 p-3 flex gap-3 relative bg-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={getResizedImageUrl(entry.item.image_url, 80, 106)}
        alt={entry.item.title}
        className="w-13 h-17 object-cover rounded-[5px] bg-[#FAF8F5] border border-[#E5E0D8] shrink-0"
      />
      <div className="flex-grow min-w-0 pr-5 flex flex-col gap-1">
        <ProductLinkTitle
          entry={entry}
          safeLang={safeLang}
          className="text-xs font-bold text-[#1C1C1C] hover:text-[#8C6D3F] line-clamp-2 leading-snug no-underline"
        />
        <span className="text-[11px] font-bold text-[#8C6D3F]">
          {t("color", safeLang)}: {entry.item.color || "Standart"} | SKU: {entry.item.custom_sku || "-"}
        </span>
        <div className="flex items-center justify-between gap-2 mt-1">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="-"
              onClick={() => onAdjustQty(entry.cartIndex, -1)}
              className="w-6 h-6 rounded border border-[#E5E0D8] bg-[#FAF8F5] flex items-center justify-center font-bold text-xs cursor-pointer"
            >
              −
            </button>
            <span className="text-xs font-extrabold text-[#1C1C1C] px-1">
              {entry.item.packages_qty} {copy.packsShort}
            </span>
            <button
              type="button"
              aria-label="+"
              onClick={() => onAdjustQty(entry.cartIndex, 1)}
              className="w-6 h-6 rounded border border-[#E5E0D8] bg-[#FAF8F5] flex items-center justify-center font-bold text-xs cursor-pointer"
            >
              +
            </button>
          </div>

          {isAuthenticated ? (
            <span className="text-xs font-extrabold text-[#1C1C1C]">
              {entry.totalPriceDisplay.toFixed(2)} {entry.displayCurrency}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => openStoreAuthModal("login")}
              className="inline-flex items-center gap-1 text-[10px] font-extrabold text-[#8C6D3F] hover:underline bg-transparent border-none p-0 cursor-pointer"
            >
              <Lock className="w-3 h-3 shrink-0" />
              <span>{t("login", safeLang)}</span>
            </button>
          )}
        </div>
        <span className="text-[10.5px] font-semibold text-[#525252]">
          {entry.pieces} {pieceWord} ({entry.item.units_per_package} {copy.pcsPerPack}){priceSuffix}
        </span>
      </div>
      <button
        type="button"
        aria-label={copy.removeBtn}
        onClick={() => onRemoveItem(entry.cartIndex)}
        className="absolute top-2.5 right-2.5 border-none bg-transparent text-[#525252] hover:text-red-600 cursor-pointer text-sm font-bold"
      >
        &times;
      </button>
    </div>
  );
}

function PageDesktopRow({
  entry,
  safeLang,
  isAuthenticated,
  copy,
  onAdjustQty,
  onRemoveItem,
}: {
  readonly entry: CartSupplierGroupItem;
  readonly safeLang: string;
  readonly isAuthenticated: boolean;
  readonly copy: CartMultiSupplierCopy;
  readonly onAdjustQty: (cartIndex: number, change: number) => void;
  readonly onRemoveItem: (cartIndex: number) => void;
}) {
  const pieceWord = t("piece", safeLang);
  const pkgWeight = (entry.item.weight_per_unit || 0.35) * entry.item.units_per_package;

  return (
    <tr className="hover:bg-[#FAF8F5]/60 transition-colors">
      <td className="py-3.5 px-4">
        <div className="flex gap-3.5 items-start">
          <div className="relative w-14 h-18 rounded-[5px] overflow-hidden bg-[#FAF8F5] border border-[#E5E0D8] shrink-0">
            <Image
              src={getResizedImageUrl(entry.item.image_url, 80, 106)}
              alt={entry.item.title}
              fill
              sizes="56px"
              className="object-cover"
              unoptimized
            />
          </div>
          <div className="flex flex-col gap-1 min-w-0">
            <ProductLinkTitle
              entry={entry}
              safeLang={safeLang}
              className="text-xs sm:text-sm font-bold text-[#1C1C1C] hover:text-[#8C6D3F] line-clamp-2 leading-snug no-underline"
            />
            <span className="text-[11px] font-bold text-[#8C6D3F]">
              {t("color", safeLang)}: {entry.item.color || "Standart"}
            </span>
            <span className="text-[11px] font-semibold text-[#525252]">
              SKU: {entry.item.custom_sku || "-"} · {copy.weightLabel}: {pkgWeight.toFixed(2)} kg/{copy.packsShort}
            </span>
            <button
              type="button"
              onClick={() => onRemoveItem(entry.cartIndex)}
              className="text-[11px] font-bold text-red-600 hover:text-red-700 bg-transparent border-none cursor-pointer self-start p-0 mt-0.5"
            >
              {copy.removeBtn}
            </button>
          </div>
        </div>
      </td>

      <td className="py-3.5 px-3 text-center">
        {isAuthenticated ? (
          <>
            <span className="text-xs font-extrabold text-[#1C1C1C] block">
              {entry.unitPriceDisplay.toFixed(2)} {entry.displayCurrency}
            </span>
            <span className="text-[10px] font-semibold text-[#525252]">/ {pieceWord}</span>
          </>
        ) : (
          <button
            type="button"
            onClick={() => openStoreAuthModal("login")}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-[#8C6D3F] bg-transparent border-none cursor-pointer"
          >
            <Lock className="w-3 h-3" />
          </button>
        )}
      </td>

      <td className="py-3.5 px-3">
        <div className="flex items-center justify-center gap-1.5 bg-[#FAF8F5] border border-[#E5E0D8] rounded-[5px] p-1 max-w-[106px] mx-auto">
          <button
            type="button"
            onClick={() => onAdjustQty(entry.cartIndex, -1)}
            className="w-7 h-7 rounded border border-[#E5E0D8] bg-white font-bold text-xs cursor-pointer"
          >
            −
          </button>
          <span className="text-xs font-extrabold text-[#1C1C1C] w-7 text-center">
            {entry.item.packages_qty}
          </span>
          <button
            type="button"
            onClick={() => onAdjustQty(entry.cartIndex, 1)}
            className="w-7 h-7 rounded border border-[#E5E0D8] bg-white font-bold text-xs cursor-pointer"
          >
            +
          </button>
        </div>
      </td>

      <td className="py-3.5 px-3 text-center">
        <span className="text-xs font-bold text-[#1C1C1C] block">
          {entry.item.units_per_package} {pieceWord}
        </span>
        <span className="text-[10px] font-semibold text-[#525252]">
          ({entry.pieces} {copy.totalUnitsLabel})
        </span>
      </td>

      <td className="py-3.5 px-4 text-right">
        {isAuthenticated ? (
          <>
            <span className="text-sm font-extrabold text-[#1C1C1C] block">
              {entry.totalPriceDisplay.toFixed(2)} {entry.displayCurrency}
            </span>
            <span className="text-[10px] font-semibold text-[#525252]">
              ({entry.rawTotalPrice.toFixed(2)} {entry.item.currency || "TRY"})
            </span>
          </>
        ) : (
          <Lock className="w-3.5 h-3.5 text-[#8C6D3F] ml-auto" />
        )}
      </td>
    </tr>
  );
}

export default function CartSupplierLineItems({
  group,
  lang,
  variant,
  isAuthenticated,
  copy,
  onAdjustQty,
  onRemoveItem,
}: Readonly<CartSupplierLineItemsProps>) {
  const safeLang = normalizeSeoLang(lang, "tr");

  if (variant === "drawer") {
    return (
      <div className="flex flex-col">
        {group.items.map((entry) => (
          <DrawerLineRow
            key={`${entry.item.product_id}-${entry.cartIndex}`}
            entry={entry}
            safeLang={safeLang}
            isAuthenticated={isAuthenticated}
            copy={copy}
            onAdjustQty={onAdjustQty}
            onRemoveItem={onRemoveItem}
          />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#FAF8F5] border-y border-[#E5E0D8] text-[11px] font-extrabold text-[#525252] tracking-wider">
              <th className="py-3 px-4 w-[42%]">{copy.colProduct}</th>
              <th className="py-3 px-3 text-center w-[13%]">{copy.colUnitPrice}</th>
              <th className="py-3 px-3 text-center w-[15%]">{copy.colPackQty}</th>
              <th className="py-3 px-3 text-center w-[15%]">{copy.colPackContent}</th>
              <th className="py-3 px-4 text-right w-[15%]">{copy.colTotal}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E0D8]">
            {group.items.map((entry) => (
              <PageDesktopRow
                key={`${entry.item.product_id}-${entry.cartIndex}`}
                entry={entry}
                safeLang={safeLang}
                isAuthenticated={isAuthenticated}
                copy={copy}
                onAdjustQty={onAdjustQty}
                onRemoveItem={onRemoveItem}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden flex flex-col">
        {group.items.map((entry) => (
          <DrawerLineRow
            key={`${entry.item.product_id}-${entry.cartIndex}-m`}
            entry={entry}
            safeLang={safeLang}
            isAuthenticated={isAuthenticated}
            copy={copy}
            onAdjustQty={onAdjustQty}
            onRemoveItem={onRemoveItem}
          />
        ))}
      </div>
    </>
  );
}
