"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getLocalCartItems,
  addOrUpdateLocalCartItem,
  removeLocalCartItem,
  clearLocalCart as clearDbCart,
  getPGliteClient,
} from "@/lib/pglite/pglite-client";
import { LocalCartItem } from "@/lib/pglite/pglite-schema";

export interface CartSummary {
  totalPackages: number;
  totalPieces: number;
  subtotal: number;
  itemCount: number;
}

export function usePGliteCart() {
  const [items, setItems] = useState<LocalCartItem[]>([]);
  const [summary, setSummary] = useState<CartSummary>({
    totalPackages: 0,
    totalPieces: 0,
    subtotal: 0,
    itemCount: 0,
  });
  const [isReady, setIsReady] = useState(false);
  const [isOnline, setIsOnline] = useState(() =>
    typeof window !== "undefined" ? navigator.onLine : true
  );

  // Recalculate relational summary via SQL query or memory
  const recalculateSummary = useCallback(async () => {
    const pg = await getPGliteClient();
    if (!pg) {
      // Memory fallback
      const totalPackages = items.reduce((acc, item) => acc + item.packages_qty, 0);
      const totalPieces = items.reduce((acc, item) => acc + item.total_pieces, 0);
      const subtotal = items.reduce((acc, item) => acc + item.packages_qty * Number(item.price), 0);
      setSummary({ totalPackages, totalPieces, subtotal, itemCount: items.length });
      return;
    }

    try {
      const res = await pg.query<{
        total_packages: string;
        total_pieces: string;
        subtotal: string;
        item_count: string;
      }>(`
        SELECT 
          COALESCE(SUM(packages_qty), 0)::text as total_packages,
          COALESCE(SUM(total_pieces), 0)::text as total_pieces,
          COALESCE(SUM(packages_qty * price), 0)::text as subtotal,
          COUNT(*)::text as item_count
        FROM local_cart
      `);

      const row = res.rows[0];
      setSummary({
        totalPackages: Number.parseInt(row?.total_packages || "0", 10),
        totalPieces: Number.parseInt(row?.total_pieces || "0", 10),
        subtotal: Number.parseFloat(row?.subtotal || "0"),
        itemCount: Number.parseInt(row?.item_count || "0", 10),
      });
    } catch (err) {
      console.warn("[PGLITE] Cart summary SQL query failed:", err);
    }
  }, [items]);

  // Load cart items on mount
  const refreshCart = useCallback(async () => {
    const loaded = await getLocalCartItems();
    setItems(loaded);
    void recalculateSummary();
  }, [recalculateSummary]);

  // Sync local offline cart items with backend
  const syncWithServer = useCallback(async (): Promise<boolean> => {
    if (typeof window === "undefined" || !navigator.onLine) return false;

    try {
      const currentItems = await getLocalCartItems();
      if (currentItems.length === 0) return true;

      const res = await fetch("/api/v1/store/cart/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: currentItems }),
      });

      return res.ok;
    } catch (err) {
      console.warn("[PGLITE] Background cart server sync failed:", err);
      return false;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function init() {
      const client = await getPGliteClient();
      if (!client || !isMounted) return;
      setIsReady(true);
      await refreshCart();
    }

    void init();

    if (typeof window !== "undefined") {
      const handleOnline = () => {
        setIsOnline(true);
        void syncWithServer();
      };
      const handleOffline = () => setIsOnline(false);

      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);

      return () => {
        isMounted = false;
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }

    return () => {
      isMounted = false;
    };
  }, [refreshCart, syncWithServer]);

  // Add or update cart item
  const addItem = useCallback(
    async (item: LocalCartItem): Promise<boolean> => {
      const success = await addOrUpdateLocalCartItem(item);
      if (success) {
        await refreshCart();
      }
      return success;
    },
    [refreshCart]
  );

  // Update item package quantity
  const updateQuantity = useCallback(
    async (itemId: string, packagesQty: number): Promise<boolean> => {
      const item = items.find((i) => i.id === itemId);
      if (!item) return false;

      const updated: LocalCartItem = {
        ...item,
        packages_qty: packagesQty,
        total_pieces: packagesQty * item.pieces_per_package,
      };

      const success = await addOrUpdateLocalCartItem(updated);
      if (success) {
        await refreshCart();
      }
      return success;
    },
    [items, refreshCart]
  );

  // Remove item
  const removeItem = useCallback(
    async (itemId: string): Promise<boolean> => {
      const success = await removeLocalCartItem(itemId);
      if (success) {
        await refreshCart();
      }
      return success;
    },
    [refreshCart]
  );

  // Clear cart
  const clearCart = useCallback(async (): Promise<boolean> => {
    const success = await clearDbCart();
    if (success) {
      await refreshCart();
    }
    return success;
  }, [refreshCart]);

  return {
    items,
    summary,
    isReady,
    isOnline,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    refreshCart,
    syncWithServer,
  };
}
