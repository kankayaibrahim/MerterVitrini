"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import WhatsappClicksPanel from "@/components/admin/analytics/WhatsappClicksPanel";

function WhatsappLogsContent() {
  const searchParams = useSearchParams();
  const initialBrandId = searchParams?.get("brand_id") || null;

  return <WhatsappClicksPanel initialBrandId={initialBrandId} />;
}

export default function AdminWhatsappLogsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-xs font-bold text-zinc-400">Yükleniyor...</div>}>
      <WhatsappLogsContent />
    </Suspense>
  );
}
