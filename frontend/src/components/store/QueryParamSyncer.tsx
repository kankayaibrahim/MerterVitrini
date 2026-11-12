"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

interface QueryParamSyncerProps {
  mode: "portal" | "catalog";
  setSearchQuery: (q: string) => void;
  setActiveCategoryId: (cat: string) => void;
  setSortBy?: (sort: string) => void;
}

export default function QueryParamSyncer({
  mode,
  setSearchQuery,
  setActiveCategoryId,
  setSortBy,
}: QueryParamSyncerProps) {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (mode === "catalog") {
      const catParam = searchParams.get("category");
      const qParam = searchParams.get("q") || "";
      const sortParam = searchParams.get("sort");

      if (catParam) {
        setActiveCategoryId(catParam);
      }
      if (sortParam && setSortBy) {
        setSortBy(sortParam);
      }

      setSearchQuery(qParam);
    }
  }, [mode, searchParams, setSearchQuery, setActiveCategoryId, setSortBy]);

  return null;
}
