"use client";

import React from "react";
import CategoryAnalyticsPanel from "@/components/admin/catalog/CategoryAnalyticsPanel";
import CategoryTreeEditor from "@/components/admin/catalog/CategoryTreeEditor";
import { useAdmin } from "@/context/AdminContext";

export default function AdminCatalogCategoriesPage() {
  const {
    categories,
    loadCategories,
    apiUrl,
    token,
  } = useAdmin();

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      <CategoryAnalyticsPanel categories={categories} />
      <CategoryTreeEditor
        categories={categories}
        onRefresh={loadCategories}
        apiUrl={apiUrl}
        token={token}
      />
    </div>
  );
}
