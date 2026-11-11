"use client";

import { useSyncExternalStore } from "react";

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

function ensureStorePriceVisibilitySettingLoaded(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  if (showPricesToGuestsCache === null) {
    showPricesToGuestsCache =
      localStorage.getItem("merter_show_prices_to_guests") === "1";
  }
  if (!storeSettingsFetchedOnce && !storeSettingsFetchInFlight) {
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
  return showPricesToGuestsCache;
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
        try {
          const profile = (await res.json()) as { email_verified?: boolean };
          if (typeof profile.email_verified === "boolean") {
            const current = localStorage.getItem("store_user_info");
            if (current) {
              const parsed = JSON.parse(current) as Record<string, unknown>;
              if (parsed.email_verified !== profile.email_verified) {
                parsed.email_verified = profile.email_verified;
                localStorage.setItem("store_user_info", JSON.stringify(parsed));
                window.dispatchEvent(new Event("auth-change"));
              }
            }
          }
        } catch {
          // ignore json parse error
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

export function getValidStoreUser<T = Record<string, unknown>>(): T | null {
  if (typeof window === "undefined") {
    return null;
  }
  const customerToken = localStorage.getItem("store_user_token");
  const customerInfo = localStorage.getItem("store_user_info");

  if (!customerToken || !customerInfo) {
    clearStaleStoreSession();
    return null;
  }

  if (!isJwtTokenUnexpired(customerToken)) {
    verifiedTokenCache = null;
    clearStaleStoreSession();
    return null;
  }

  try {
    const parsed = JSON.parse(customerInfo) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || (!parsed.email && !parsed.id && !parsed.first_name)) {
      clearStaleStoreSession();
      return null;
    }
    verifyTokenWithBackendOnce(customerToken);
    return parsed as T;
  } catch {
    clearStaleStoreSession();
    return null;
  }
}

function subscribeStoreAuth(callback: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  window.addEventListener("auth-change", callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener("auth-change", callback);
    window.removeEventListener("storage", callback);
  };
}

function getStoreAuthSnapshot(): boolean {
  if (getValidStoreUser() !== null) {
    return true;
  }
  return ensureStorePriceVisibilitySettingLoaded();
}

function getStoreMemberLoggedInSnapshot(): boolean {
  return getValidStoreUser() !== null;
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
  switch (lang) {
    case "tr":
      return "Fiyatları Görmek İçin Üye Ol / Giriş Yap";
    case "ru":
      return "Войдите, чтобы увидеть оптовую цену";
    case "ar":
      return "سجل الدخول لرؤية سعر الجملة";
    default:
      return "Login / Register to See Wholesale Price";
  }
}

export function getShortMemberPriceLabel(lang: string): string {
  switch (lang) {
    case "tr":
      return "Üyelere Özel Fiyat (Giriş Yap)";
    case "ru":
      return "Цена для участников (Войти)";
    case "ar":
      return "سعر خاص للأعضاء (دخول)";
    default:
      return "Members Only Price (Login)";
  }
}
