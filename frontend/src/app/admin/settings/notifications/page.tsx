"use client";

import React from "react";
import NotificationsManager from "@/components/admin/settings/notifications/NotificationsManager";
import { useAdmin } from "@/context/AdminContext";

export default function AdminSettingsNotificationsPage() {
  const { apiUrl, token } = useAdmin();

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      <NotificationsManager apiUrl={apiUrl} token={token || ""} />
    </div>
  );
}
