"use client";

import React from "react";
import IndexNowManager from "@/components/admin/catalog/IndexNowManager";
import { useAdmin } from "@/context/AdminContext";

export default function AdminCatalogIndexNowPage() {
  const { apiUrl, token } = useAdmin();

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      <IndexNowManager apiUrl={apiUrl} token={token || ""} />
    </div>
  );
}
