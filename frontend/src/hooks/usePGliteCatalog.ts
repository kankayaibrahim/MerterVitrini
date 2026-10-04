"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Product } from "@/types/store";
import {
  getPGliteClient,
  queryLocalCatalog,
  batchUpsertLocalProducts,
  getLocalProductCount,
  getLastSyncTime,
  setLastSyncTime,
  mapProductToLocal,
  mapLocalToProduct,
  CatalogFilterQuery,
} from "@/lib/pglite/pglite-client";
import { LocalCatalogProduct } from "@/lib/pglite/pglite-schema";

interface UsePGliteCatalogOptions {
  readonly initialProducts?: Product[];
  readonly autoSyncDelta?: boolean;
}

interface DeltaApiResponse {
  products: LocalCatalogProduct[];
  delta_token: string;
  count: number;
  has_more: boolean;
}

export function usePGliteCatalog(options: UsePGliteCatalogOptions = {}) {
  const { initialProducts, autoSyncDelta = true } = options;
  const [isReady, setIsReady] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [localCount, setLocalCount] = useState(0);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const syncingRef = useRef(false);

  // Initialize PGlite client and warm up cache
  useEffect(() => {
    let isMounted = true;

    async function initClient() {
      const client = await getPGliteClient();
      if (!client || !isMounted) return;

      const count = await getLocalProductCount();
      const syncTime = await getLastSyncTime();

      if (isMounted) {
        setLocalCount(count);
        setLastSync(syncTime);
        setIsReady(true);
      }

      // Warm up local database with initial SSR products if available
      if (initialProducts && initialProducts.length > 0) {
        const localItems = initialProducts.map(mapProductToLocal);
        await batchUpsertLocalProducts(localItems);
        const updatedCount = await getLocalProductCount();
        if (isMounted) setLocalCount(updatedCount);
      }
    }

    void initClient();

    return () => {
      isMounted = false;
    };
  }, [initialProducts]);

  // Delta sync function with backend
  const syncDelta = useCallback(async (): Promise<number> => {
    if (syncingRef.current) return 0;
    syncingRef.current = true;
    setIsSyncing(true);

    try {
      const currentLastSync = await getLastSyncTime();
      const url = currentLastSync
        ? `/api/v1/store/catalog/delta?since=${encodeURIComponent(currentLastSync)}&limit=500`
        : `/api/v1/store/catalog/delta?limit=500`;

      const response = await fetch(url);
      if (!response.ok) {
        setIsSyncing(false);
        syncingRef.current = false;
        return 0;
      }

      const data = (await response.json()) as DeltaApiResponse;
      if (data.products && data.products.length > 0) {
        await batchUpsertLocalProducts(data.products);
        if (data.delta_token) {
          await setLastSyncTime(data.delta_token);
          setLastSync(data.delta_token);
        }
        const updatedCount = await getLocalProductCount();
        setLocalCount(updatedCount);
      }

      setIsSyncing(false);
      syncingRef.current = false;
      return data.products?.length || 0;
    } catch (err) {
      console.warn("[PGLITE] Delta sync background check failed:", err);
      setIsSyncing(false);
      syncingRef.current = false;
      return 0;
    }
  }, []);

  // Run auto delta sync when ready
  useEffect(() => {
    if (!isReady || !autoSyncDelta) return;

    const timer = setTimeout(() => {
      void syncDelta();
    }, 0);

    return () => {
      clearTimeout(timer);
    };
  }, [isReady, autoSyncDelta, syncDelta]);

  // Fast-path client query
  const queryLocal = useCallback(
    async (filters: CatalogFilterQuery): Promise<{ products: Product[]; total: number } | null> => {
      if (!isReady || localCount === 0) {
        return null;
      }

      const res = await queryLocalCatalog(filters);
      if (!res) return null;

      const products = res.products.map(mapLocalToProduct);
      return {
        products,
        total: res.totalCount,
      };
    },
    [isReady, localCount]
  );

  return {
    isReady,
    isSyncing,
    localCount,
    lastSync,
    queryLocal,
    syncDelta,
  };
}
