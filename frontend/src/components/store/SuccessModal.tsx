"use client";

import React from "react";
import { BadgeCheck, Building2, Check, MessageCircle, Phone } from "lucide-react";
import { t } from "@/app/i18n";
import { trackWhatsappClick } from "@/app/utils";
import { formatDualProductSku } from "@/utils/whatsappOrdering";
import type { SupplierDirectOrderSummary } from "@/types/store";
import { getCartMultiSupplierCopy } from "@/components/store/cart/cartMultiSupplierCopy";

interface SuccessModalProps {
  readonly lang: string;
  readonly whatsappUrl: string;
  readonly orderNumber?: string;
  readonly supplierOrders?: readonly SupplierDirectOrderSummary[];
  readonly isFormalOrder?: boolean;
  readonly onViewOrders?: () => void;
  readonly onWhatsappClick?: () => void;
  readonly onClose: () => void;
}

function SupplierDispatchCard({
  supplier,
  lang,
}: {
  readonly supplier: SupplierDirectOrderSummary;
  readonly lang: string;
}) {
  const copy = getCartMultiSupplierCopy(lang);
  const dialNumber = (supplier.phone || supplier.whatsapp_phone || "").trim();
  const hasAmount = supplier.gross_amount > 0;
  const locationParts = [supplier.brand_district, supplier.brand_city].filter(Boolean).join(", ");

  return (
    <div className="bg-[#FAF8F5] border border-[#E5E0D8] rounded-xl p-3.5 text-left flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Building2 className="w-4 h-4 text-[#8C6D3F] shrink-0" />
            <span className="text-sm font-extrabold text-[#1C1C1C] truncate">
              {supplier.brand_name}
            </span>
            {supplier.brand_verified !== false && (
              <BadgeCheck className="w-3.5 h-3.5 text-[#15803D] shrink-0" />
            )}
          </div>
          <p className="text-[11px] font-semibold text-[#525252] m-0 mt-0.5">
            {copy.subOrderNoLabel}: #{supplier.sub_order_number}
            {locationParts ? ` · ${locationParts}` : ""}
          </p>
        </div>
        {hasAmount && (
          <span className="text-xs font-extrabold text-[#1C1C1C] bg-white border border-[#E5E0D8] px-2 py-1 rounded shrink-0">
            {supplier.gross_amount.toFixed(2)} {supplier.currency}
          </span>
        )}
      </div>

      {Array.isArray(supplier.items) && supplier.items.length > 0 && (
        <ul className="m-0 pl-4 text-[11px] text-[#525252] space-y-0.5">
          {supplier.items.slice(0, 3).map((item) => (
            <li key={`${supplier.sub_order_id}-${item.product_id}`} className="truncate">
              <strong className="text-[#1C1C1C]">{item.title}</strong> ({formatDualProductSku(item.custom_sku, item.supplier_sku)}) ·{" "}
              {item.packages_qty} {copy.packsShort} / {item.pieces_qty} {t("piece", lang)}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        {supplier.whatsapp_url && (
          <a
            href={supplier.whatsapp_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              trackWhatsappClick({
                brandId: supplier.brand_id,
                productId: supplier.items?.[0]?.product_id || "",
                sourceSurface: "order_success_supplier",
                targetPhone: supplier.whatsapp_phone || supplier.phone,
              })
            }
            className="flex-1 min-w-[175px] py-2 px-3 rounded-md bg-[#15803D] hover:bg-[#166534] text-white text-xs font-bold no-underline flex items-center justify-center gap-1.5 transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{copy.contactSupplierWhatsapp}</span>
          </a>
        )}
        {dialNumber && (
          <a
            href={`tel:${dialNumber.replace(/\s+/g, "")}`}
            className="py-2 px-3 rounded-md bg-white border border-[#E5E0D8] hover:border-[#1C1C1C] text-[#1C1C1C] text-xs font-bold no-underline inline-flex items-center gap-1.5 transition-colors"
          >
            <Phone className="w-3.5 h-3.5 text-[#8C6D3F] shrink-0" />
            <span>{copy.callSupplierPhone}</span>
          </a>
        )}
      </div>
    </div>
  );
}

export default function SuccessModal({
  lang,
  whatsappUrl,
  orderNumber,
  supplierOrders = [],
  isFormalOrder = false,
  onViewOrders,
  onWhatsappClick,
  onClose,
}: Readonly<SuccessModalProps>) {
  const copy = getCartMultiSupplierCopy(lang);
  const hasSupplierCards = supplierOrders.length > 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={t("close_modal", lang)}
        tabIndex={-1}
        className="fixed inset-0 bg-transparent border-none cursor-default"
        onClick={onClose}
      />
      <div
        className={`bg-white border border-[#E5E0D8] rounded-[16px] w-full ${hasSupplierCards ? "max-w-xl max-h-[90vh] overflow-y-auto p-6 sm:p-7" : "max-w-md p-8"
          } text-center flex flex-col items-center gap-5 shadow-premium relative z-10 animate-in fade-in zoom-in-95 duration-200`}
      >
        <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#15803D] shrink-0">
          <Check className="w-7 h-7" />
        </div>

        <div className="w-full">
          {orderNumber && (
            <span className="inline-block px-3 py-1 rounded-full bg-[#F8F6F2] border border-[#E5E0D8] text-[11px] font-extrabold text-[#8C6D3F] mb-2">
              #{orderNumber}
            </span>
          )}
          <h3 className="font-sans font-extrabold text-xl text-[#1C1C1C] leading-tight m-0">
            {hasSupplierCards
              ? copy.successMultiTitle.replace("{count}", String(supplierOrders.length))
              : t("success_title", lang)}
          </h3>
          <p className="text-xs text-[#525252] leading-relaxed font-semibold mt-2.5 m-0">
            {hasSupplierCards ? copy.successMultiDesc : t("success_desc", lang)}
          </p>
        </div>

        {hasSupplierCards ? (
          <div className="w-full flex flex-col gap-3">
            {supplierOrders.map((supplier) => (
              <SupplierDispatchCard
                key={`${supplier.sub_order_id}-${supplier.brand_id}`}
                supplier={supplier}
                lang={lang}
              />
            ))}
          </div>
        ) : (
          <a
            href={whatsappUrl || "#"}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onWhatsappClick}
            className="w-full py-3 bg-[#15803D] hover:bg-[#166534] text-white rounded-md font-bold text-sm tracking-[0.5px] uppercase text-center no-underline shadow-sm transition-all flex items-center justify-center gap-2"
          >
            <MessageCircle className="w-4 h-4 shrink-0" />
            <span>{t("success_whatsapp", lang)}</span>
          </a>
        )}

        <div className="w-full flex flex-col sm:flex-row gap-2.5 pt-1">
          {isFormalOrder && onViewOrders && (
            <button
              type="button"
              onClick={onViewOrders}
              className="flex-1 py-2.5 bg-[#1C1C1C] hover:bg-[#333333] text-white rounded-[6px] text-xs font-extrabold border-none cursor-pointer transition-colors"
            >
              {copy.viewOrdersBtn}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 border border-[#E5E0D8] hover:border-[#1C1C1C] bg-[#FAF8F5] rounded-[6px] text-xs font-bold text-[#1C1C1C] transition-colors cursor-pointer"
          >
            {t("close", lang)}
          </button>
        </div>
      </div>
    </div>
  );
}
