"use client";

import React from "react";
import OrdersManager from "@/components/admin/orders/OrdersManager";
import { useAdmin } from "@/context/AdminContext";

export default function AdminOrdersPage() {
  const { apiUrl, token } = useAdmin();

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      <OrdersManager apiUrl={apiUrl} token={token} />
    </div>
  );
}
