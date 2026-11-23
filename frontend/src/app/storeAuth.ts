"use client";

import { useSyncExternalStore } from "react";
import { pickLangText } from "@/app/i18n";
import { isRealisticPhoneNumber } from "@/utils/phoneValidation";
import { buildCookieDomainAttribute } from "@/utils/subdomain";

export interface StoreSessionUser {
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
}

export interface StoreUser extends StoreSessionUser {
  [key: string]: unknown;
}

export interface ImpersonationBootstrapPayload {
  token: string;
  customer: StoreUser;
  cart_items?: unknown[];
}

const IMPERSONATION_BACKUP_KEY = "merter_impersonation_prev_session";
const COOKIE_TOKEN_KEY = "mv_store_token";
const COOKIE_USER_KEY = "mv_store_user";
const COOKIE_LOGGED_OUT_KEY = "mv_store_logged_out";

let verifiedTokenCache: string | null = null;
let verifyingTokenInFlight: string | null = null;
let showPricesToGuestsCache: boolean | null = null;
let storeSettingsFetchedOnce = false;
let storeSettingsFetchInFlight = false;

export function readSharedCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  const cookies = document.cookie ? document.cookie.split(";") : [];
  const prefix = `${name}=`;
  for (const rawEntry of cookies) {
    const entry = rawEntry.trim();
    if (entry.startsWith(prefix)) {
      const encoded = entry.slice(prefix.length);
      try {
        return decodeURIComponent(encoded);
      } catch {
        return encoded;
      }
    }
  }
  return null;
}

export function writeSharedCookie(
  name: string,
  value: string,
  maxAgeSeconds: number
): void {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return;
  }
  const secureAttr = window.location.protocol === "https:" ? "; Secure" : "";
  const domainAttr = buildCookieDomainAttribute(window.location.hostname);
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}; SameSite=Lax${secureAttr}${domainAttr}`;
}

export function deleteSharedCookie(name: string): void {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return;
  }
  const secureAttr = window.location.protocol === "https:" ? "; Secure" : "";
  const domainAttr = buildCookieDomainAttribute(window.location.hostname);
  if (domainAttr) {
    document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax${secureAttr}${domainAttr}`;
  }
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax${secureAttr}`;
}

function getJwtRemainingSeconds(token: string): number {
  try {
    const parts = token.trim().split(".");
    if (parts.length !== 3) return 7 * 86400;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const decoded = atob(padded);
    const payload = JSON.parse(decoded) as { exp?: number };
    if (typeof payload.exp !== "number") return 7 * 86400;
    const remaining = Math.floor(payload.exp - Date.now() / 1000);
    return Math.max(60, Math.min(30 * 86400, remaining));
  } catch {
    return 7 * 86400;
  }
}

function toCompactStoreUser(user: StoreSessionUser): StoreSessionUser {
  return {
    id: user.id,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    preferred_lang: user.preferred_lang,
    preferred_currency: user.preferred_currency,
    email_verified: user.email_verified,
    impersonated: user.impersonated === true ? true : undefined,
    impersonated_by: user.impersonated_by,
    impersonated_by_id: user.impersonated_by_id,
  };
}

function writeSessionCookies(token: string, user: StoreSessionUser): void {
  const ttl = getJwtRemainingSeconds(token);
  deleteSharedCookie(COOKIE_LOGGED_OUT_KEY);
  writeSharedCookie(COOKIE_TOKEN_KEY, token, ttl);
  writeSharedCookie(COOKIE_USER_KEY, JSON.stringify(toCompactStoreUser(user)), ttl);
}

export function setStoreSession(token: string, user: StoreSessionUser): void {
  if (typeof window === "undefined") {
    return;
  }
  verifiedTokenCache = null;
  localStorage.setItem("store_user_token", token);
  localStorage.setItem("store_user_info", JSON.stringify(user));
  if (token.trim() && isJwtTokenUnexpired(token)) {
    writeSessionCookies(token, user);
  }
}

export function clearStoreSession(markExplicitLogout = false): void {
  if (typeof window === "undefined") {
    return;
  }
  verifiedTokenCache = null;
  localStorage.removeItem("store_user_token");
  localStorage.removeItem("store_user_info");
  deleteSharedCookie(COOKIE_TOKEN_KEY);
  deleteSharedCookie(COOKIE_USER_KEY);
  if (markExplicitLogout) {
    writeSharedCookie(COOKIE_LOGGED_OUT_KEY, "1", 86400);
  }
}

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
  if (readSharedCookie(COOKIE_TOKEN_KEY) || readSharedCookie(COOKIE_USER_KEY)) {
    deleteSharedCookie(COOKIE_TOKEN_KEY);
    deleteSharedCookie(COOKIE_USER_KEY);
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
  setStoreSession(payload.token, normalizedUser);

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
  clearStoreSession(false);
  localStorage.removeItem("merter_b2b_cart");
  localStorage.removeItem("merter_cart_owner_id");

  const rawBackup = localStorage.getItem(IMPERSONATION_BACKUP_KEY);
  localStorage.removeItem(IMPERSONATION_BACKUP_KEY);
  if (rawBackup) {
    try {
      const backup = JSON.parse(rawBackup) as Partial<StoredSessionBackup>;
      if (typeof backup.store_user_token === "string" && backup.store_user_token) {
        if (typeof backup.store_user_info === "string" && backup.store_user_info) {
          const parsedInfo = JSON.parse(backup.store_user_info) as StoreUser;
          setStoreSession(backup.store_user_token, parsedInfo);
        } else {
          localStorage.setItem("store_user_token", backup.store_user_token);
        }
      } else if (typeof backup.store_user_info === "string" && backup.store_user_info) {
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
  const token = localStorage.getItem("store_user_token");
  if (!current) return;
  try {
    const parsed = JSON.parse(current) as StoreUser;
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
      if (token && isJwtTokenUnexpired(token)) {
        writeSessionCookies(token, parsed);
      }
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
 * never mutates localStorage/cookies and never triggers network fetches.
 */
function readValidStoreUserPure<T = Record<string, unknown>>(): T | null {
  if (typeof window === "undefined") {
    return null;
  }
  const cookieToken = readSharedCookie(COOKIE_TOKEN_KEY);
  const loggedOut = readSharedCookie(COOKIE_LOGGED_OUT_KEY) === "1";
  if (loggedOut && !cookieToken) {
    return null;
  }

  const localToken = localStorage.getItem("store_user_token");
  const localInfo = localStorage.getItem("store_user_info");
  if (localToken && localInfo && isJwtTokenUnexpired(localToken)) {
    const parsed = parseValidStoreUserRecord(localInfo);
    if (parsed) {
      return parsed as T;
    }
  }

  const cookieInfo = readSharedCookie(COOKIE_USER_KEY);
  if (cookieToken && cookieInfo && isJwtTokenUnexpired(cookieToken)) {
    const parsed = parseValidStoreUserRecord(cookieInfo);
    if (parsed) {
      return parsed as T;
    }
  }
  return null;
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
  const localToken = localStorage.getItem("store_user_token")?.trim() || "";
  if (localToken && isJwtTokenUnexpired(localToken)) {
    return localToken;
  }
  const cookieToken = readSharedCookie(COOKIE_TOKEN_KEY)?.trim() || "";
  if (cookieToken && isJwtTokenUnexpired(cookieToken)) {
    return cookieToken;
  }
  return null;
}

function hydrateStoreAuthSideEffects(): void {
  if (typeof window === "undefined") {
    return;
  }
  const cookieToken = readSharedCookie(COOKIE_TOKEN_KEY);
  const cookieInfo = readSharedCookie(COOKIE_USER_KEY);
  const loggedOut = readSharedCookie(COOKIE_LOGGED_OUT_KEY) === "1";

  if (loggedOut && !cookieToken) {
    clearStaleStoreSession();
    triggerStorePriceVisibilityFetchOnce();
    return;
  }

  const localToken = localStorage.getItem("store_user_token");
  const localInfo = localStorage.getItem("store_user_info");
  const localParsed =
    localToken && localInfo && isJwtTokenUnexpired(localToken)
      ? parseValidStoreUserRecord(localInfo)
      : null;

  if (!localParsed) {
    if (cookieToken && cookieInfo && isJwtTokenUnexpired(cookieToken) && parseValidStoreUserRecord(cookieInfo)) {
      localStorage.setItem("store_user_token", cookieToken);
      localStorage.setItem("store_user_info", cookieInfo);
      verifyTokenWithBackendOnce(cookieToken);
      window.dispatchEvent(new Event("auth-change"));
      return;
    }
    verifiedTokenCache = null;
    clearStaleStoreSession();
    triggerStorePriceVisibilityFetchOnce();
    return;
  }

  if (!cookieToken && localToken) {
    writeSessionCookies(localToken, localParsed as StoreUser);
  }
  if (localToken) {
    verifyTokenWithBackendOnce(localToken);
  }
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
