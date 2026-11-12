"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import MemberJourneyExplorer from "@/components/admin/customers/MemberJourneyExplorer";
import { useAdmin } from "@/context/AdminContext";

function MemberJourneysContent() {
  const { apiUrl, token } = useAdmin();
  const searchParams = useSearchParams();
  const customerId = searchParams?.get("customer_id") || null;

  return (
    <MemberJourneyExplorer
      apiUrl={apiUrl}
      token={token}
      initialCustomerId={customerId}
    />
  );
}

export default function AdminMemberJourneysPage() {
  return (
    <Suspense fallback={null}>
      <MemberJourneysContent />
    </Suspense>
  );
}

