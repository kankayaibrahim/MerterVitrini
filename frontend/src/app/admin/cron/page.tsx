"use client";

import React from "react";
import CronManager from "@/components/admin/cron/CronManager";
import { useAdmin } from "@/context/AdminContext";

export default function AdminCronPage() {
  const { apiUrl, token } = useAdmin();

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      <CronManager apiUrl={apiUrl} token={token} />
    </div>
  );
}
