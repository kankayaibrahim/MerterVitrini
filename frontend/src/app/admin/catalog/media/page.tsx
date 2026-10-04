"use client";

import React from "react";
import ImageCacheManager from "@/components/admin/catalog/ImageCacheManager";
import { useAdmin } from "@/context/AdminContext";

export default function AdminCatalogMediaPage() {
  const { apiUrl, token } = useAdmin();

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      <ImageCacheManager apiUrl={apiUrl} token={token} />
    </div>
  );
}
