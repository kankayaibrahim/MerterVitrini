"use client";

import React from "react";
import CustomersManager from "@/components/admin/customers/CustomersManager";
import { useAdmin } from "@/context/AdminContext";

export default function AdminCustomersPage() {
  const { apiUrl, token } = useAdmin();

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      <CustomersManager apiUrl={apiUrl} token={token} />
    </div>
  );
}
