"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

interface QueryParamSyncerProps {
  mode: "portal" | "catalog";
  setSearchQuery: (q: string) => void;
  setActiveCategoryId: (cat: string) => void;
}

export default function QueryParamSyncer({
  mode,
  setSearchQuery,
  setActiveCategoryId,
}: QueryParamSyncerProps) {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (mode === "catalog") {
      const catParam = searchParams.get("category");
      const qParam = searchParams.get("q") || "";

      if (catParam) {
        setActiveCategoryId(catParam);
      }
      
      setSearchQuery(qParam);
    }
  }, [mode, searchParams, setSearchQuery, setActiveCategoryId]);

  return null;
}
