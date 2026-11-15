"use client";

import { useSyncExternalStore } from "react";
import { pickLangText } from "@/app/i18n";
import { isRealisticPhoneNumber } from "@/utils/phoneValidation";

export interface StoreUser {
  id?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  role?: string;
  preferred_lang?: string;
  preferred_currency?: string;
  email_verified?: boolean;
  impersonated?: boolean;
  impersonated_by?: string;
  impersonated_by_id?: string;
  [key: string]: unknown;
}

export interface ImpersonationBootstrapPayload {
  token: string;
  customer: StoreUser;
  cart_items?: unknown[];
}

const IMPERSONATION_BACKUP_KEY = "merter_impersonation_prev_session";

let verifiedTokenCache: string | null = null;
let verifyingTokenInFlight: string | null = null;
let showPricesToGuestsCache: boolean | null = null;
let storeSettingsFetchedOnce = false;
let storeSettingsFetchInFlight = false;

export function syncShowPricesToGuestsSetting(enabled: boolean): void {
  const normalized = Boolean(enabled);
  const changed = showPricesToGuestsCache !== normalized;
  showPricesToGuestsCache = normalized;
  if (typeof window !== "undefined") {
    localStorage.setItem("merter_show_prices_to_guests", normalized ? "1" : "0");
    if (changed) {
      window.dispatchEvent(new Event("auth-change"));
    }
  }
}

function readShowPricesToGuestsPure(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  if (showPricesToGuestsCache !== null) {
    return showPricesToGuestsCache;
  }
  return localStorage.getItem("merter_show_prices_to_guests") === "1";
}

function triggerStorePriceVisibilityFetchOnce(): void {
  if (typeof window === "undefined") {
    return;
  }
  showPricesToGuestsCache ??=
    localStorage.getItem("merter_show_prices_to_guests") === "1";
  if (storeSettingsFetchedOnce || storeSettingsFetchInFlight) {
    return;
  }
  storeSettingsFetchInFlight = true;
  fetch("/api/v1/store/settings", {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  })
    .then(async (res) => {
      if (!res.ok) return;
      const data = (await res.json()) as {
        show_prices_to_guests?: boolean;
      };
      storeSettingsFetchedOnce = true;
      syncShowPricesToGuestsSetting(Boolean(data.show_prices_to_guests));
    })
    .catch(() => {
      // Keep cached setting on transient error
    })
    .finally(() => {
      storeSettingsFetchInFlight = false;
    });
}

function clearStaleStoreSession(): void {
  if (typeof window === "undefined") return;
  const hadToken = localStorage.getItem("store_user_token") !== null;
  const hadInfo = localStorage.getItem("store_user_info") !== null;
  if (hadToken || hadInfo) {
    localStorage.removeItem("store_user_token");
    localStorage.removeItem("store_user_info");
  }
}

export function isStoreSessionImpersonated(): boolean {
  const user = readValidStoreUserPure<StoreUser>();
  return user?.impersonated === true;
}

interface StoredSessionBackup {
  store_user_token: string | null;
  store_user_info: string | null;
  merter_b2b_cart: string | null;
  merter_cart_owner_id: string | null;
}

export function startCustomerImpersonationSession(payload: ImpersonationBootstrapPayload): void {
  if (typeof window === "undefined") return;
  const currentUser = readValidStoreUserPure<StoreUser>();
  if (!localStorage.getItem(IMPERSONATION_BACKUP_KEY) && !currentUser?.impersonated) {
    const backup: StoredSessionBackup = {
      store_user_token: localStorage.getItem("store_user_token"),
      store_user_info: localStorage.getItem("store_user_info"),
      merter_b2b_cart: localStorage.getItem("merter_b2b_cart"),
      merter_cart_owner_id: localStorage.getItem("merter_cart_owner_id"),
    };
    localStorage.setItem(IMPERSONATION_BACKUP_KEY, JSON.stringify(backup));
  }

  const normalizedUser: StoreUser = {
    ...payload.customer,
    impersonated: true,
  };
  verifiedTokenCache = null;
  localStorage.setItem("store_user_token", payload.token);
  localStorage.setItem("store_user_info", JSON.stringify(normalizedUser));

  if (payload.customer.id) {
    localStorage.setItem("merter_cart_owner_id", payload.customer.id);
  } else {
    localStorage.removeItem("merter_cart_owner_id");
  }

  const initialCart = Array.isArray(payload.cart_items) ? payload.cart_items : [];
  localStorage.setItem("merter_b2b_cart", JSON.stringify(initialCart));

  window.dispatchEvent(new Event("auth-change"));
  window.dispatchEvent(new Event("merter-cart-update"));
}

export function endCustomerImpersonationSession(): void {
  if (typeof window === "undefined") return;
  verifiedTokenCache = null;
  localStorage.removeItem("store_user_token");
  localStorage.removeItem("store_user_info");
  localStorage.removeItem("merter_b2b_cart");
  localStorage.removeItem("merter_cart_owner_id");

  const rawBackup = localStorage.getItem(IMPERSONATION_BACKUP_KEY);
  localStorage.removeItem(IMPERSONATION_BACKUP_KEY);
  if (rawBackup) {
    try {
      const backup = JSON.parse(rawBackup) as Partial<StoredSessionBackup>;
      if (typeof backup.store_user_token === "string" && backup.store_user_token) {
        localStorage.setItem("store_user_token", backup.store_user_token);
      }
      if (typeof backup.store_user_info === "string" && backup.store_user_info) {
        localStorage.setItem("store_user_info", backup.store_user_info);
      }
      if (typeof backup.merter_b2b_cart === "string") {
        localStorage.setItem("merter_b2b_cart", backup.merter_b2b_cart);
      }
      if (typeof backup.merter_cart_owner_id === "string") {
        localStorage.setItem("merter_cart_owner_id", backup.merter_cart_owner_id);
      }
    } catch {
      // ignore corrupted backup JSON
    }
  }

  window.dispatchEvent(new Event("auth-change"));
  window.dispatchEvent(new Event("merter-cart-update"));
}

function isJwtTokenUnexpired(token: string): boolean {
  try {
    const parts = token.trim().split(".");
    if (parts.length !== 3) return false;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const decoded = atob(padded);
    const payload = JSON.parse(decoded) as { exp?: number };
    if (typeof payload.exp !== "number") return false;
    return payload.exp * 1000 > Date.now() + 5000;
  } catch {
    return false;
  }
}

function syncVerifiedProfileFields(emailVerified?: boolean, phone?: string): void {
  const current = localStorage.getItem("store_user_info");
  if (!current) return;
  try {
    const parsed = JSON.parse(current) as Record<string, unknown>;
    let changed = false;
    if (typeof emailVerified === "boolean" && parsed.email_verified !== emailVerified) {
      parsed.email_verified = emailVerified;
      changed = true;
    }
    if (typeof phone === "string" && phone.trim() !== "" && parsed.phone !== phone) {
      parsed.phone = phone;
      changed = true;
    }
    if (changed) {
      localStorage.setItem("store_user_info", JSON.stringify(parsed));
      window.dispatchEvent(new Event("auth-change"));
    }
  } catch {
    // ignore json parse error
  }
}

function verifyTokenWithBackendOnce(token: string): void {
  if (typeof window === "undefined") return;
  if (verifiedTokenCache === token || verifyingTokenInFlight === token) return;
  verifyingTokenInFlight = token;

  fetch("/api/v1/store/profile", {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  })
    .then(async (res) => {
      if (res.ok) {
        verifiedTokenCache = token;
        const profile = (await res.json().catch(() => ({}))) as {
          email_verified?: boolean;
          phone?: string;
        };
        if (!isStoreSessionImpersonated() && !isRealisticPhoneNumber(profile.phone)) {
          verifiedTokenCache = null;
          clearStaleStoreSession();
          window.dispatchEvent(new Event("auth-change"));
          return;
        }
        syncVerifiedProfileFields(profile.email_verified, profile.phone);
      } else if (res.status === 401 || res.status === 403 || res.status === 404) {
        verifiedTokenCache = null;
        clearStaleStoreSession();
        window.dispatchEvent(new Event("auth-change"));
      }
    })
    .catch(() => {
      // Network hiccup: keep local JWT exp result
    })
    .finally(() => {
      if (verifyingTokenInFlight === token) {
        verifyingTokenInFlight = null;
      }
    });
}

function parseValidStoreUserRecord(customerInfo: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(customerInfo) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    if (!parsed.email && !parsed.id && !parsed.first_name) {
      return null;
    }
    const isImpersonated = parsed.impersonated === true;
    const role = typeof parsed.role === "string" ? parsed.role.trim().toLowerCase() : "";
    if (!isImpersonated && (role === "" || role === "customer") && !isRealisticPhoneNumber(parsed.phone)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Pure snapshot reader safe for React 19 useSyncExternalStore getSnapshot:
 * never mutates localStorage and never triggers network fetches.
 */
function readValidStoreUserPure<T = Record<string, unknown>>(): T | null {
  if (typeof window === "undefined") {
    return null;
  }
  const customerToken = localStorage.getItem("store_user_token");
  const customerInfo = localStorage.getItem("store_user_info");
  if (!customerToken || !customerInfo || !isJwtTokenUnexpired(customerToken)) {
    return null;
  }
  const parsed = parseValidStoreUserRecord(customerInfo);
  return parsed ? (parsed as T) : null;
}

/**
 * Pure reader returning the unexpired bearer token for a valid customer
 * session, or null on SSR / guests / incomplete profiles.
 */
export function getValidStoreBearerToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  if (readValidStoreUserPure() === null) {
    return null;
  }
  const token = localStorage.getItem("store_user_token");
  const trimmed = token ? token.trim() : "";
  return trimmed !== "" ? trimmed : null;
}

function hydrateStoreAuthSideEffects(): void {
  if (typeof window === "undefined") {
    return;
  }
  const customerToken = localStorage.getItem("store_user_token");
  const customerInfo = localStorage.getItem("store_user_info");

  if (!customerToken || !customerInfo) {
    clearStaleStoreSession();
    triggerStorePriceVisibilityFetchOnce();
    return;
  }

  if (!isJwtTokenUnexpired(customerToken)) {
    verifiedTokenCache = null;
    clearStaleStoreSession();
    triggerStorePriceVisibilityFetchOnce();
    return;
  }

  const parsed = parseValidStoreUserRecord(customerInfo);
  if (!parsed) {
    clearStaleStoreSession();
    triggerStorePriceVisibilityFetchOnce();
    return;
  }

  verifyTokenWithBackendOnce(customerToken);
}

export function getValidStoreUser<T = Record<string, unknown>>(): T | null {
  if (typeof window === "undefined") {
    return null;
  }
  const user = readValidStoreUserPure<T>();
  queueMicrotask(hydrateStoreAuthSideEffects);
  return user;
}

function subscribeStoreAuth(callback: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  hydrateStoreAuthSideEffects();
  const handleChange = () => {
    hydrateStoreAuthSideEffects();
    callback();
  };
  window.addEventListener("auth-change", handleChange);
  window.addEventListener("storage", handleChange);
  return () => {
    window.removeEventListener("auth-change", handleChange);
    window.removeEventListener("storage", handleChange);
  };
}

function getStoreAuthSnapshot(): boolean {
  if (readValidStoreUserPure() !== null) {
    return true;
  }
  return readShowPricesToGuestsPure();
}

function getStoreMemberLoggedInSnapshot(): boolean {
  return readValidStoreUserPure() !== null;
}

function getServerAuthSnapshot(): boolean {
  return false;
}

export function useIsStoreAuthenticated(): boolean {
  return useSyncExternalStore(
    subscribeStoreAuth,
    getStoreAuthSnapshot,
    getServerAuthSnapshot
  );
}

export function useIsStoreMemberLoggedIn(): boolean {
  return useSyncExternalStore(
    subscribeStoreAuth,
    getStoreMemberLoggedInSnapshot,
    getServerAuthSnapshot
  );
}

export function openStoreAuthModal(mode: "login" | "register" = "login"): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("merter-open-auth", { detail: { mode } })
    );
  }
}

export function getMemberPriceLabel(lang: string): string {
  return pickLangText(lang, {
    tr: "Fiyatları Görmek İçin Üye Ol / Giriş Yap",
    en: "Login / Register to See Wholesale Price",
    ru: "Войдите, чтобы увидеть оптовую цену",
    ar: "سجل الدخول لرؤية سعر الجملة",
    de: "Anmelden / Registrieren für Großhandelspreise",
    fr: "Connectez-vous / Inscrivez-vous pour voir les prix de gros",
    pl: "Zaloguj się / Zarejestruj, aby zobaczyć ceny hurtowe",
    bg: "Влезте / Регистрирайте се за цени на едро",
  });
}

export function getShortMemberPriceLabel(lang: string): string {
  return pickLangText(lang, {
    tr: "Üyelere Özel Fiyat (Giriş Yap)",
    en: "Members Only Price (Login)",
    ru: "Цена для участников (Войти)",
    ar: "سعر خاص للأعضاء (دخول)",
    de: "Mitgliederpreis (Anmelden)",
    fr: "Prix Membres (Connexion)",
    pl: "Cena dla członków (Zaloguj)",
    bg: "Цена за членове (Вход)",
  });
}
