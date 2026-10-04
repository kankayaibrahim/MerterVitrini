"use client";

import React from "react";
import PoliciesManager from "@/components/admin/policies/PoliciesManager";
import { useAdmin } from "@/context/AdminContext";

export default function AdminSettingsPoliciesPage() {
  const { apiUrl, token } = useAdmin();

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      <PoliciesManager apiUrl={apiUrl} token={token} />
    </div>
  );
}
