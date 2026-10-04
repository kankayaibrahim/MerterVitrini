"use client";

import React from "react";
import PagesManager from "@/components/admin/pages/PagesManager";
import { useAdmin } from "@/context/AdminContext";

export default function AdminSettingsCmsPage() {
  const { apiUrl, token } = useAdmin();

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      <PagesManager apiUrl={apiUrl} token={token} />
    </div>
  );
}
