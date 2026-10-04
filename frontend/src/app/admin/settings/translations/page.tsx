"use client";

import React from "react";
import TranslationManager from "@/components/admin/translate/TranslationManager";
import { useAdmin } from "@/context/AdminContext";

export default function AdminSettingsTranslationsPage() {
  const { apiUrl, token } = useAdmin();

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      <TranslationManager apiUrl={apiUrl} token={token} />
    </div>
  );
}
