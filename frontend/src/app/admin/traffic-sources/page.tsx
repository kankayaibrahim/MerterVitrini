import React from "react";
import TrafficSourcesPanel from "@/components/admin/analytics/TrafficSourcesPanel";

export const metadata = {
  title: "AI Bot & Trafik Kaynakları | Merter Vitrini Admin",
  robots: { index: false, follow: false },
};

export default function AdminTrafficSourcesPage() {
  return <TrafficSourcesPanel />;
}
