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

      console.log(`[Search Log] QueryParamSyncer triggered. qParam: "${qParam}"`);

      if (catParam) {
        setActiveCategoryId(catParam);
      }
      
      setSearchQuery(qParam);

      // Safely sync both desktop & mobile input box values in UI
      const searchInput = document.getElementById("searchInputDesktop") as HTMLInputElement;
      if (searchInput) {
        searchInput.value = qParam;
      }
      const searchInputMobile = document.getElementById("searchInputMobile") as HTMLInputElement;
      if (searchInputMobile) {
        searchInputMobile.value = qParam;
      }
    }
  }, [mode, searchParams, setSearchQuery, setActiveCategoryId]);

  return null;
}
