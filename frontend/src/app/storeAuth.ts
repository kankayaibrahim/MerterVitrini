"use client";

import { useSyncExternalStore } from "react";
import { pickLangText } from "@/app/i18n";

export interface StoreUser {
  id?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  role?: string;
  email_verified?: boolean;
  [key: string]: unknown;
}

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
  if (showPricesToGuestsCache === null) {
    showPricesToGuestsCache =
      localStorage.getItem("merter_show_prices_to_guests") === "1";
  }
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

function syncVerifiedProfileFlag(emailVerified: boolean): void {
  const current = localStorage.getItem("store_user_info");
  if (!current) return;
  try {
    const parsed = JSON.parse(current) as Record<string, unknown>;
    if (parsed.email_verified !== emailVerified) {
      parsed.email_verified = emailVerified;
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
        const profile = (await res.json().catch(() => ({}))) as { email_verified?: boolean };
        if (typeof profile.email_verified === "boolean") {
          syncVerifiedProfileFlag(profile.email_verified);
        }
      } else if (res.status === 401 || res.status === 403) {
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
