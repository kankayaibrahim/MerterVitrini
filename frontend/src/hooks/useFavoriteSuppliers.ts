"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { getValidStoreBearerToken, openStoreAuthModal } from "@/app/storeAuth";
import { FavoriteSupplierItem } from "@/types/stories";

interface FavoriteSuppliersState {
  items: FavoriteSupplierItem[];
  loading: boolean;
}

const EMPTY_SERVER_SNAPSHOT: FavoriteSuppliersState = {
  items: [],
  loading: false,
};

let currentState: FavoriteSuppliersState = {
  items: [],
  loading: false,
};

let loadedToken: string | null = null;
let inFlightToken: string | null = null;
const listeners = new Set<() => void>();

function emitChange(): void {
  for (const l of listeners) {
    l();
  }
}

function setState(next: FavoriteSuppliersState): void {
  currentState = next;
  emitChange();
}

async function fetchFavoritesFromApi(token: string, force = false): Promise<void> {
  if (!force && loadedToken === token) return;
  if (inFlightToken === token && !force) return;
  inFlightToken = token;

  try {
    const res = await fetch("/api/v1/store/favorite-suppliers", {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
    if (res.ok) {
      const data = (await res.json()) as { items?: FavoriteSupplierItem[] };
      loadedToken = token;
      setState({
        items: Array.isArray(data.items) ? data.items : [],
        loading: false,
      });
    } else if (res.status === 401 || res.status === 403) {
      loadedToken = null;
      setState({ items: [], loading: false });
    }
  } catch {
    setState({ ...currentState, loading: false });
  } finally {
    if (inFlightToken === token) {
      inFlightToken = null;
    }
  }
}

function syncWithCurrentToken(force = false): void {
  if (typeof window === "undefined") return;
  const token = getValidStoreBearerToken();
  if (!token) {
    if (loadedToken !== null || currentState.items.length > 0) {
      loadedToken = null;
      setState({ items: [], loading: false });
    }
    return;
  }
  if (force || loadedToken !== token) {
    void fetchFavoritesFromApi(token, force);
  }
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  const onAuthOrFavChange = () => {
    syncWithCurrentToken(false);
  };
  if (typeof window !== "undefined") {
    window.addEventListener("auth-change", onAuthOrFavChange);
  }
  return () => {
    listeners.delete(callback);
    if (typeof window !== "undefined") {
      window.removeEventListener("auth-change", onAuthOrFavChange);
    }
  };
}

function getSnapshot(): FavoriteSuppliersState {
  return currentState;
}

function getServerSnapshot(): FavoriteSuppliersState {
  return EMPTY_SERVER_SNAPSHOT;
}

export function useFavoriteSuppliers() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    syncWithCurrentToken(false);
  }, []);

  const refresh = useCallback(async () => {
    const token = getValidStoreBearerToken();
    if (!token) {
      setState({ items: [], loading: false });
      return;
    }
    setState({ ...currentState, loading: true });
    await fetchFavoritesFromApi(token, true);
  }, []);

  const isFavorite = useCallback(
    (brandId: string) => state.items.some((item) => item.brand_id === brandId),
    [state.items]
  );

  const getFavoriteItem = useCallback(
    (brandId: string) => state.items.find((item) => item.brand_id === brandId) || null,
    [state.items]
  );

  const addFavorite = useCallback(
    async (
      brandId: string,
      prefs?: { notify_new_products?: boolean; notify_via_email?: boolean }
    ): Promise<boolean> => {
      const token = getValidStoreBearerToken();
      if (!token) {
        openStoreAuthModal("login");
        return false;
      }
      const res = await fetch(`/api/v1/store/favorite-suppliers/${encodeURIComponent(brandId)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(prefs ?? { notify_new_products: true, notify_via_email: false }),
      });
      if (!res.ok) return false;
      await fetchFavoritesFromApi(token, true);
      return true;
    },
    []
  );

  const removeFavorite = useCallback(async (brandId: string): Promise<boolean> => {
    const token = getValidStoreBearerToken();
    if (!token) {
      openStoreAuthModal("login");
      return false;
    }
    const res = await fetch(`/api/v1/store/favorite-suppliers/${encodeURIComponent(brandId)}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) return false;
    setState({
      items: currentState.items.filter((i) => i.brand_id !== brandId),
      loading: false,
    });
    loadedToken = token;
    return true;
  }, []);

  const toggleFavorite = useCallback(
    async (brandId: string): Promise<boolean> => {
      if (isFavorite(brandId)) {
        return removeFavorite(brandId);
      }
      return addFavorite(brandId, { notify_new_products: true, notify_via_email: false });
    },
    [addFavorite, isFavorite, removeFavorite]
  );

  const updateNotificationPrefs = useCallback(
    async (
      brandId: string,
      prefs: { notify_new_products?: boolean; notify_via_email?: boolean }
    ): Promise<boolean> => {
      const token = getValidStoreBearerToken();
      if (!token) {
        openStoreAuthModal("login");
        return false;
      }
      const res = await fetch(`/api/v1/store/favorite-suppliers/${encodeURIComponent(brandId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(prefs),
      });
      if (!res.ok) return false;
      const updated = (await res.json()) as {
        notify_new_products?: boolean;
        notify_via_email?: boolean;
      };
      setState({
        items: currentState.items.map((item) =>
          item.brand_id === brandId
            ? {
                ...item,
                notify_new_products:
                  typeof updated.notify_new_products === "boolean"
                    ? updated.notify_new_products
                    : item.notify_new_products,
                notify_via_email:
                  typeof updated.notify_via_email === "boolean"
                    ? updated.notify_via_email
                    : item.notify_via_email,
              }
            : item
        ),
        loading: false,
      });
      return true;
    },
    []
  );

  return {
    items: state.items,
    loading: state.loading,
    count: state.items.length,
    isFavorite,
    getFavoriteItem,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    updateNotificationPrefs,
    refresh,
  };
}
