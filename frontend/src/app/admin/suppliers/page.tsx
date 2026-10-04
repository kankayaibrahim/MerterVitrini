"use client";

import React from "react";
import SuppliersManager from "@/components/admin/integrations/SuppliersManager";
import { useAdmin } from "@/context/AdminContext";

export default function AdminSuppliersPage() {
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
      />
    </div>
  );
}
