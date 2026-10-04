"use client";

import React from "react";
import MetricCards from "@/components/admin/dashboard/MetricCards";
import QuickFeedList from "@/components/admin/dashboard/QuickFeedList";
import ActivityLogs from "@/components/admin/dashboard/ActivityLogs";
import { useAdmin } from "@/context/AdminContext";
import { useRouter } from "next/navigation";

export default function AdminDashboardPage() {
  const router = useRouter();
  const {
    feeds,
    totalProductsCount,
    flatCategories,
    activeSyncing,
    loadingProducts,
    syncHistory,
    triggerSync,
    cancelSync,
    handleClearHistory
  } = useAdmin();

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      {/* Top Level Metric KPIs */}
      <MetricCards 
        feedsCount={feeds.length}
        productsCount={totalProductsCount}
        categoriesCount={flatCategories.length}
        activeSyncingCount={Object.keys(activeSyncing).length}
        loadingProducts={loadingProducts}
      />

      {/* Main Grid: Feed Status and Live Activity Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <QuickFeedList 
          feeds={feeds}
          syncHistory={syncHistory}
          activeSyncing={activeSyncing}
          triggerSync={triggerSync}
          cancelSync={cancelSync}
          onNavigateToIntegrations={() => router.push("/admin/suppliers")}
        />
        <ActivityLogs 
          feeds={feeds}
          syncHistory={syncHistory}
          onClearHistory={async () => {
            await Promise.all(feeds.map(feed => handleClearHistory(feed.id)));
          }}
        />
      </div>
    </div>
  );
}
