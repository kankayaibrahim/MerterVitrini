import React from "react";
import AnalyticsDashboardClient from "@/components/admin/analytics/AnalyticsDashboardClient";

export const metadata = {
  title: "İş Zekası (BI) & Veri Madenciliği Merkezi | Merter Vitrini Admin",
  robots: { index: false, follow: false },
};

export default function AdminAnalyticsPage() {
  return <AnalyticsDashboardClient />;
}
