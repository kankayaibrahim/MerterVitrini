"use client";

import type { CartItem, SupplierDirectOrderSummary } from "@/types/store";
import { t } from "@/app/i18n";
import { validateHumanPersonNameClient } from "@/utils/addressValidation";
import { validateAndNormalizeRealisticPhone } from "@/utils/phoneValidation";
import { executeRecaptchaAction } from "@/utils/recaptcha";
import type {
  StructuredLocationMeta,
  StructuredLocationValue,
} from "@/components/store/StructuredLocationFields";

export interface StoreInquirySubmissionInput {
  readonly cart: readonly CartItem[];
  readonly fullName: string;
  readonly companyName?: string;
  readonly phoneNumber: string;
  readonly emailAddress: string;
  readonly customerMessage?: string;
  readonly displayCurrency: string;
  readonly lang: string;
  readonly location?: StructuredLocationValue;
  readonly locationMeta?: StructuredLocationMeta;
}

export interface StoreInquirySubmissionResult {
  readonly id: string;
  readonly order_number: string;
  readonly whatsapp_url: string;
  readonly supplier_orders: SupplierDirectOrderSummary[];
}

export async function submitStoreCartInquiry(
  input: StoreInquirySubmissionInput
): Promise<StoreInquirySubmissionResult> {
  if (input.cart.length === 0) {
    throw new Error(
      input.lang === "tr" ? "Sepetiniz boş." : "Your wholesale cart is empty."
    );
  }

  const nameErr = validateHumanPersonNameClient(input.fullName, input.lang);
  if (nameErr) {
    throw new Error(nameErr);
  }

  const rawPhone = input.phoneNumber.trim();
  const dialPrefix = `+${input.locationMeta?.countryPhoneCode || 90}`;
  const candidatePhone = rawPhone.startsWith("+")
    ? rawPhone
    : `${dialPrefix}${rawPhone.replace(/^0+/, "")}`;
  const phoneCheck = validateAndNormalizeRealisticPhone(candidatePhone);
  if (!phoneCheck.valid) {
    throw new Error(
      input.lang === "tr"
        ? "Lütfen ülke kodunu içeren geçerli bir telefon (WhatsApp) numarası girin."
        : "Please enter a valid contact phone number including country code."
    );
  }

  const addressNote = (input.location?.addressLine || "").trim();
  if (Array.from(addressNote).length > 500) {
    throw new Error(
      input.lang === "tr"
        ? "Teslimat / adres notu en fazla 500 karakter olabilir."
        : "Delivery note cannot exceed 500 characters."
    );
  }

  const inquiryItems = input.cart.map((item) => {
    const unitsPerPkg = Math.max(1, item.units_per_package || 1);
    const totalUnits = Math.max(1, item.packages_qty * unitsPerPkg);
    const colorSuffix = item.color ? ` (${item.color})` : "";
    return {
      product_id: item.product_id,
      title: `${item.title}${colorSuffix} - ${item.packages_qty} ${t("package", input.lang)} (${totalUnits} ${t("piece", input.lang)})`,
      custom_sku: item.custom_sku || item.product_id || "-",
      quantity: totalUnits,
      price: item.price_per_unit || 0,
    };
  });

  const recaptchaToken = await executeRecaptchaAction("submit_inquiry", input.lang);

  const payload = {
    full_name: input.fullName.trim(),
    company: (input.companyName || "").trim() || null,
    phone: phoneCheck.normalized,
    email: input.emailAddress.trim(),
    message: (input.customerMessage || "").trim() || null,
    country_id: (input.location?.countryId || "").trim(),
    state_id: (input.location?.stateId || "").trim() || null,
    city_id: (input.location?.cityId || "").trim() || null,
    postal_code: (input.location?.postalCode || "").trim(),
    address_line: addressNote,
    delivery_address: addressNote,
    customer_currency: input.displayCurrency || "TRY",
    recaptcha_token: recaptchaToken,
    items: inquiryItems,
  };

  const response = await fetch("/api/v1/store/inquiries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errData = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(
      errData.error ||
        (input.lang === "tr"
          ? "Sipariş / teklif talebiniz gönderilemedi. Lütfen bilgilerinizi kontrol edin."
          : "Failed to submit your wholesale request. Please check your details.")
    );
  }

  const result = (await response.json()) as {
    id?: string;
    order_number?: string;
    whatsapp_url?: string;
    supplier_orders?: SupplierDirectOrderSummary[];
  };

  return {
    id: result.id || "",
    order_number: result.order_number || "",
    whatsapp_url: result.whatsapp_url || "#",
    supplier_orders: Array.isArray(result.supplier_orders) ? result.supplier_orders : [],
  };
}
