"use client";

import React from "react";
import GeographyManager from "@/components/admin/geography/GeographyManager";
import { useAdmin } from "@/context/AdminContext";

export default function AdminSettingsGeoPage() {
  const { apiUrl, token } = useAdmin();

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      <GeographyManager apiUrl={apiUrl} token={token} />
    </div>
  );
}
