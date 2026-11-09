"use client";

import React, { Suspense } from "react";
import SuppliersManager from "@/components/admin/integrations/SuppliersManager";
import { useAdmin } from "@/context/AdminContext";
import { useSearchParams } from "next/navigation";

function SuppliersPageContent() {
  const {
    suppliers,
    categories,
    loadSuppliers,
    apiUrl,
    token,
    activeSyncing,
    triggerSync
  } = useAdmin();

  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab = (tabParam === "applications" || tabParam === "users" || tabParam === "suppliers" || tabParam === "billing")
    ? tabParam
    : undefined;

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      <SuppliersManager 
        suppliers={suppliers}
        categories={categories}
        onRefresh={loadSuppliers}
        apiUrl={apiUrl}
        token={token}
        activeSyncing={activeSyncing}
        triggerSync={triggerSync}
        initialTab={initialTab}
      />
    </div>
  );
}

export default function AdminSuppliersPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-zinc-400">Yükleniyor...</div>}>
      <SuppliersPageContent />
    </Suspense>
  );
}
