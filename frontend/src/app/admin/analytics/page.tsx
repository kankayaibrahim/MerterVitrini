import React from "react";
import AnalyticsDashboardClient from "@/components/admin/analytics/AnalyticsDashboardClient";

export const metadata = {
  title: "Ziyaretçi & Trafik Analitiği | Merter Vitrini Admin",
  robots: { index: false, follow: false },
};

export default function AdminAnalyticsPage() {
  return <AnalyticsDashboardClient />;
}
