import { normalizeLangCode, pickLangText, SupportedLangCode } from "@/app/i18n";

export interface SupplierAgent {
  id: string;
  brand_id: string;
  contact_name: string;
  email?: string;
  phone?: string;
  job_title: string;
  spoken_languages: string;
  is_owner: boolean;
  is_active: boolean;
}

export interface ChatOfferMetadata {
  product_id?: string;
  title?: string;
  custom_sku?: string;
  color?: string;
  image_url?: string;
  slug?: string;
  series_ratio?: string;
  units_per_package?: number;
  packages_qty?: number;
  original_unit_price?: number;
  offered_unit_price?: number;
  discount_percent?: number;
  weight_per_unit?: number;
  currency?: string;
  offer_status?: "pending" | "accepted" | "rejected";
}

export interface ChatRoom {
  id: string;
  brand_id: string;
  supplier_name: string;
  supplier_user_id?: string;
  supplier_user_name?: string;
  supplier_user_title?: string;
  supplier_user_languages?: string;
  customer_id: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  customer_email_verified?: boolean;
  initial_product_id?: string;
  last_message_preview: string;
  last_message_at: string;
  unread_customer_count: number;
  unread_supplier_count: number;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  sender_type: "customer" | "supplier" | "admin";
  sender_id: string;
  sender_name: string;
  message_type: "text" | "product_card" | "custom_offer";
  content: string;
  metadata: ChatOfferMetadata;
  is_read: boolean;
  created_at: string;
}

export interface CentrifugeEventEnvelope {
  event: "new_message" | "offer_updated" | "room_updated";
  data: ChatMessage | ChatRoom;
}

const DEFAULT_CHAT_NAMES: Record<SupportedLangCode, { member: string; guest: string }> = {
  tr: { member: "B2B Müşteri", guest: "B2B Misafir Alıcı" },
  en: { member: "B2B Buyer", guest: "B2B Guest Buyer" },
  ru: { member: "B2B Покупатель", guest: "B2B Гость" },
  ar: { member: "مشتري B2B", guest: "مشتري زائر B2B" },
  de: { member: "B2B-Käufer", guest: "B2B-Gastkäufer" },
  fr: { member: "Acheteur B2B", guest: "Acheteur invité B2B" },
  pl: { member: "Kupujący B2B", guest: "Gość B2B" },
  bg: { member: "B2B Купувач", guest: "B2B Гост купувач" },
};

export const CHAT_LOCALE_BY_LANG: Record<SupportedLangCode, string> = {
  tr: "tr-TR",
  en: "en-US",
  ru: "ru-RU",
  ar: "ar-SA",
  de: "de-DE",
  fr: "fr-FR",
  pl: "pl-PL",
  bg: "bg-BG",
};

export function resolveChatLang(lang?: string): SupportedLangCode {
  if (lang && lang.trim()) {
    return normalizeLangCode(lang);
  }
  if (typeof window !== "undefined") {
    return normalizeLangCode(localStorage.getItem("preferred_lang") || "tr");
  }
  return "tr";
}

export function getCentrifugeWsUrl(): string {
  if (typeof window === "undefined") {
    return "ws://localhost:8080/api/v1/chat/ws";
  }
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.hostname === "localhost" ? "localhost:8080" : window.location.host;
  return `${proto}//${host}/api/v1/chat/ws`;
}

export function getOrInitCustomerChatIdentity(lang?: string): {
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  token: string | null;
} {
  const effectiveLang = resolveChatLang(lang);
  const defaults = pickLangText(effectiveLang, DEFAULT_CHAT_NAMES);

  if (typeof window === "undefined") {
    return {
      customerId: "guest_ssr",
      customerName: defaults.member,
      customerEmail: "",
      customerPhone: "",
      token: null,
    };
  }

  const token = localStorage.getItem("store_user_token");
  const rawUser = localStorage.getItem("store_user_info");
  if (rawUser) {
    try {
      const parsed = JSON.parse(rawUser) as {
        id?: string;
        first_name?: string;
        last_name?: string;
        email?: string;
        phone?: string;
      };
      if (parsed.id) {
        const fullName =
          `${parsed.first_name || ""} ${parsed.last_name || ""}`.trim() ||
          parsed.email ||
          defaults.member;
        return {
          customerId: parsed.id,
          customerName: fullName,
          customerEmail: parsed.email || "",
          customerPhone: parsed.phone || "",
          token,
        };
      }
    } catch {
      // ignore invalid json
    }
  }

  let guestId = localStorage.getItem("merter_chat_guest_id");
  if (!guestId) {
    const randomPart =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : Date.now().toString(36);
    guestId = `guest_${randomPart}`;
    localStorage.setItem("merter_chat_guest_id", guestId);
  }
  const savedGuestName = localStorage.getItem("merter_chat_guest_name") || defaults.guest;

  return {
    customerId: guestId,
    customerName: savedGuestName,
    customerEmail: "",
    customerPhone: "",
    token,
  };
}
