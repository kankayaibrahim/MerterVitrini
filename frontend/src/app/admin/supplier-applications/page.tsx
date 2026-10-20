"use client";

import React, { Suspense } from "react";
import SuppliersManager from "@/components/admin/integrations/SuppliersManager";
import { useAdmin } from "@/context/AdminContext";

function SupplierApplicationsContent() {
  const {
    suppliers,
    categories,
    loadSuppliers,
    apiUrl,
    token,
    activeSyncing,
    triggerSync
  } = useAdmin();

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
        initialTab="applications"
      />
    </div>
  );
}

export default function AdminSupplierApplicationsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-zinc-400">Yükleniyor...</div>}>
      <SupplierApplicationsContent />
    </Suspense>
  );
}
