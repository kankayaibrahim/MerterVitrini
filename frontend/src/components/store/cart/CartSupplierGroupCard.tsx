"use client";

import React from "react";
import Link from "next/link";
import { BadgeCheck, Building2, ExternalLink, MapPin, MessageCircle, Phone } from "lucide-react";
import { t } from "@/app/i18n";
import { trackWhatsappClick } from "@/app/utils";
import { buildSupplierCartWhatsAppUrl, type CartSupplierGroup } from "@/utils/cartSupplierGroups";
import { normalizeSeoLang } from "@/utils/seoHelpers";
import { getCartMultiSupplierCopy } from "./cartMultiSupplierCopy";
import CartSupplierLineItems from "./CartSupplierLineItems";

interface CartSupplierGroupCardProps {
  readonly group: CartSupplierGroup;
  readonly lang: string;
  readonly variant: "drawer" | "page";
  readonly isAuthenticated: boolean;
  readonly onAdjustQty: (cartIndex: number, change: number) => void;
  readonly onRemoveItem: (cartIndex: number) => void;
}

function formatSupplierLocation(group: CartSupplierGroup, fallback: string): string {
  const parts = [group.district, group.city].filter(Boolean);
  if (parts.length > 0) return parts.join(", ");
  return fallback;
}

export default function CartSupplierGroupCard({
  group,
  lang,
  variant,
  isAuthenticated,
  onAdjustQty,
  onRemoveItem,
}: Readonly<CartSupplierGroupCardProps>) {
  const safeLang = normalizeSeoLang(lang, "tr");
  const copy = getCartMultiSupplierCopy(safeLang);
  const pieceWord = t("piece", safeLang);
  const locationText = formatSupplierLocation(group, copy.defaultLocation);
  const showroomHref = group.brandSlug
    ? `/ureticiler/${group.brandSlug}${safeLang === "tr" ? "" : `?lang=${safeLang}`}`
    : "";
  const waHref = buildSupplierCartWhatsAppUrl(group, safeLang, isAuthenticated);
  const dialNumber = (group.phone || group.whatsappPhone || "").trim();

  return (
    <article className="bg-white border border-[#E5E0D8] rounded-[12px] overflow-hidden shadow-sm">
      <header className="bg-[#FAF8F5] px-4 py-3 flex flex-wrap items-center justify-between gap-2 border-b border-[#E5E0D8]">
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Building2 className="w-4 h-4 text-[#8C6D3F] shrink-0" />
            {showroomHref ? (
              <Link
                href={showroomHref}
                className="text-xs sm:text-sm font-extrabold text-[#1C1C1C] hover:text-[#8C6D3F] no-underline truncate"
              >
                {group.brandName}
              </Link>
            ) : (
              <span className="text-xs sm:text-sm font-extrabold text-[#1C1C1C] truncate">
                {group.brandName}
              </span>
            )}
            {group.isVerified && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[#15803D] text-[10px] font-bold">
                <BadgeCheck className="w-3 h-3 shrink-0" />
                <span>{copy.verifiedBadge}</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[10.5px] font-semibold text-[#525252]">
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-3 h-3 text-[#8C6D3F]" />
              {locationText}
            </span>
            <span>·</span>
            <span>
              {group.totalPackages} {copy.packsShort} · {group.totalPieces} {pieceWord}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isAuthenticated && group.subtotalDisplay > 0 && (
            <div className="text-right">
              <span className="text-[10px] font-bold text-[#525252] block">
                {copy.supplierSubtotal}
              </span>
              <span className="text-xs sm:text-sm font-extrabold text-[#1C1C1C]">
                {group.subtotalDisplay.toFixed(2)} {group.displayCurrency}
              </span>
            </div>
          )}
          {showroomHref && variant === "page" && (
            <Link
              href={showroomHref}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-[#E5E0D8] bg-white hover:border-[#8C6D3F] text-[11px] font-bold text-[#1C1C1C] no-underline"
            >
              <span>{copy.visitShowroomCta}</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          )}
        </div>
      </header>

      <CartSupplierLineItems
        group={group}
        lang={safeLang}
        variant={variant}
        isAuthenticated={isAuthenticated}
        copy={copy}
        onAdjustQty={onAdjustQty}
        onRemoveItem={onRemoveItem}
      />

      {(waHref || dialNumber) && (
        <footer className="bg-[#F8F6F2] px-4 py-2.5 border-t border-[#E5E0D8] flex flex-wrap items-center justify-between gap-2">
          {waHref && (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                trackWhatsappClick({
                  brandId: group.brandId,
                  productId: group.items[0]?.item.product_id || "",
                  sourceSurface:
                    variant === "drawer" ? "cart_drawer_supplier" : "cart_page_supplier",
                  targetPhone: group.whatsappPhone || group.phone,
                })
              }
              className="flex-1 min-w-[200px] py-2 px-3 rounded-[6px] bg-[#15803D] hover:bg-[#166534] text-white text-xs font-extrabold no-underline flex items-center justify-center gap-1.5 transition-colors shadow-sm"
            >
              <MessageCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{copy.askWhatsappCta}</span>
            </a>
          )}

          {dialNumber && (
            <a
              href={`tel:${dialNumber.replace(/\s+/g, "")}`}
              className="py-2 px-3 rounded-[6px] bg-white border border-[#E5E0D8] hover:border-[#1C1C1C] text-[#1C1C1C] text-xs font-bold no-underline inline-flex items-center gap-1.5 transition-colors"
            >
              <Phone className="w-3.5 h-3.5 text-[#8C6D3F] shrink-0" />
              <span>{copy.callSupplierCta}</span>
            </a>
          )}
        </footer>
      )}
    </article>
  );
}
