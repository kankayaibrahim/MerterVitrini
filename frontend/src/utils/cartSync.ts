"use client";

import type { CartItem } from "@/types/store";
import {
  getValidStoreBearerToken,
  getValidStoreUser,
  type StoreUser,
} from "@/app/storeAuth";

const CART_STORAGE_KEY = "merter_b2b_cart";
const CART_OWNER_KEY = "merter_cart_owner_id";
const CART_SYNC_DEBOUNCE_MS = 350;

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let syncAbortController: AbortController | null = null;
let pullInFlight: Promise<CartItem[] | null> | null = null;

export interface PersistCartOptions {
  skipRemoteSync?: boolean;
  immediate?: boolean;
}

export function readLocalStoreCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as CartItem[]) : [];
  } catch {
    return [];
  }
}

export function cancelPendingCartSync(): void {
  if (syncTimer !== null) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }
  if (syncAbortController !== null) {
    syncAbortController.abort();
    syncAbortController = null;
  }
}

function areCartItemsEquivalent(a: CartItem[], b: CartItem[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (
      a[i].product_id !== b[i].product_id ||
      a[i].packages_qty !== b[i].packages_qty ||
      Number(a[i].price_per_unit) !== Number(b[i].price_per_unit)
    ) {
      return false;
    }
  }
  return true;
}

export function syncLocalCartStateIfChanged(prev: CartItem[]): CartItem[] {
  const next = readLocalStoreCart();
  return areCartItemsEquivalent(prev, next) ? prev : next;
}

function writeCartStorage(items: CartItem[], ownerId?: string | null): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  if (ownerId) {
    localStorage.setItem(CART_OWNER_KEY, ownerId);
  }
  queueMicrotask(() => {
    window.dispatchEvent(new Event("merter-cart-update"));
  });
}

export async function pushCartItemsToServer(
  items: CartItem[],
  tokenOverride?: string | null
): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const token = tokenOverride ?? getValidStoreBearerToken();
  if (!token) return false;

  if (syncAbortController !== null) {
    syncAbortController.abort();
  }
  const controller = new AbortController();
  syncAbortController = controller;

  try {
    const res = await fetch("/api/v1/store/cart/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        items: items
          .filter((item) => Boolean(item.product_id) && item.packages_qty > 0)
          .map((item) => ({
            product_id: item.product_id,
            quantity: item.packages_qty,
          })),
      }),
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    if (syncAbortController === controller) {
      syncAbortController = null;
    }
  }
}

export function persistStoreCart(
  items: CartItem[],
  options: PersistCartOptions = {}
): void {
  if (typeof window === "undefined") return;
  const user = getValidStoreUser<StoreUser>();
  writeCartStorage(items, user?.id ?? null);

  if (options.skipRemoteSync) return;
  const token = getValidStoreBearerToken();
  if (!token) return;

  if (syncTimer !== null) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }

  if (options.immediate) {
    void pushCartItemsToServer(items, token);
    return;
  }

  syncTimer = setTimeout(() => {
    syncTimer = null;
    const latest = readLocalStoreCart();
    const latestToken = getValidStoreBearerToken();
    if (latestToken) {
      void pushCartItemsToServer(latest, latestToken);
    }
  }, CART_SYNC_DEBOUNCE_MS);
}

function mergeGuestAndServerCart(
  localItems: CartItem[],
  serverItems: CartItem[]
): CartItem[] {
  const byProductId = new Map<string, CartItem>();
  for (const item of serverItems) {
    if (item.product_id && item.packages_qty > 0) {
      byProductId.set(item.product_id, { ...item });
    }
  }
  for (const item of localItems) {
    if (!item.product_id || item.packages_qty <= 0) continue;
    const existing = byProductId.get(item.product_id);
    if (existing) {
      byProductId.set(item.product_id, {
        ...existing,
        packages_qty: existing.packages_qty + item.packages_qty,
      });
    } else {
      byProductId.set(item.product_id, { ...item });
    }
  }
  return Array.from(byProductId.values());
}

async function executePullAndReconcile(): Promise<CartItem[] | null> {
  if (typeof window === "undefined") return null;
  const token = getValidStoreBearerToken();
  const user = getValidStoreUser<StoreUser>();
  const userId = user?.id?.trim() ?? "";
  if (!token || !userId) return null;

  try {
    const res = await fetch("/api/v1/store/cart", {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) return null;

    const rawData = (await res.json()) as unknown;
    const serverItems = Array.isArray(rawData) ? (rawData as CartItem[]) : [];

    const prevOwnerId = localStorage.getItem(CART_OWNER_KEY);
    const localItems = readLocalStoreCart();
    const isGuestMerge = !prevOwnerId && !user?.impersonated && localItems.length > 0;

    if (isGuestMerge) {
      const merged = mergeGuestAndServerCart(localItems, serverItems);
      writeCartStorage(merged, userId);
      if (!areCartItemsEquivalent(merged, serverItems)) {
        void pushCartItemsToServer(merged, token);
      }
      return merged;
    }

    if (!areCartItemsEquivalent(localItems, serverItems) || prevOwnerId !== userId) {
      writeCartStorage(serverItems, userId);
    }
    return serverItems;
  } catch {
    return null;
  }
}

export function pullAndReconcileStoreCart(): Promise<CartItem[] | null> {
  if (pullInFlight !== null) {
    return pullInFlight;
  }
  pullInFlight = executePullAndReconcile().finally(() => {
    pullInFlight = null;
  });
  return pullInFlight;
}

export function clearStoreCartOnLogout(): void {
  if (typeof window === "undefined") return;
  cancelPendingCartSync();
  localStorage.removeItem(CART_STORAGE_KEY);
  localStorage.removeItem(CART_OWNER_KEY);
  window.dispatchEvent(new Event("merter-cart-update"));
}
