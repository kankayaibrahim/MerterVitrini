"use client";

import React from "react";
import ConsentManager from "@/components/admin/consent/ConsentManager";

export default function AdminSettingsConsentPage() {
  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      <ConsentManager />
    </div>
  );
}
