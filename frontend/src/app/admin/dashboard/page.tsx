"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Layers } from "lucide-react";
import { useAdmin } from "@/context/AdminContext";
import { ExecutiveDashboardStats } from "@/types/dashboard";
import ExecutiveHeader from "@/components/admin/dashboard/ExecutiveHeader";
import ExecutiveMetricCards from "@/components/admin/dashboard/ExecutiveMetricCards";
import MarketFxTicker from "@/components/admin/dashboard/MarketFxTicker";
import RecentOrdersCard from "@/components/admin/dashboard/RecentOrdersCard";
import PendingApplicationsCard from "@/components/admin/dashboard/PendingApplicationsCard";
import QuickFeedList from "@/components/admin/dashboard/QuickFeedList";
import ActivityLogs from "@/components/admin/dashboard/ActivityLogs";

export default function AdminDashboardPage() {
  const router = useRouter();
  const {
    fetchWithConfig,
    token,
    feeds,
    activeSyncing,
    syncHistory,
    triggerSync,
    cancelSync,
    handleClearHistory,
    loadFeedsAndHistory,
  } = useAdmin();

  const [stats, setStats] = useState<ExecutiveDashboardStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let ignore = false;

    async function fetchStats() {
      try {
        const res = await fetchWithConfig("/api/v1/admin/dashboard/stats");
        if (res.ok && !ignore) {
          const data: ExecutiveDashboardStats = await res.json();
          setStats(data);
        }
      } catch {
        // Handled silently
      } finally {
        if (!ignore) {
          setLoadingStats(false);
          setIsRefreshing(false);
        }
      }
    }

    if (token) {
      void fetchStats();
    }

    return () => {
      ignore = true;
    };
  }, [token, refreshTrigger, fetchWithConfig]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setRefreshTrigger((prev) => prev + 1);
    await loadFeedsAndHistory();
  }, [loadFeedsAndHistory]);

  const handleClearAllHistory = useCallback(async () => {
    await Promise.all(feeds.map((feed) => handleClearHistory(feed.id)));
  }, [feeds, handleClearHistory]);

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      {/* 1. Executive Command Center Header */}
      <ExecutiveHeader
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />

      {/* 2. Top-Level Executive B2B Financial & Volume KPIs */}
      <ExecutiveMetricCards
        stats={stats}
        loading={loadingStats}
      />

      {/* 3. TCMB Live Currency Rates & B2B Cross-Border Ticker */}
      <MarketFxTicker
        rates={stats?.exchange_rates ?? []}
        loading={loadingStats}
      />

      {/* 4. Core B2B Business Operations Grid: Orders & Supplier Inflow */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentOrdersCard
            orders={stats?.recent_orders ?? []}
            loading={loadingStats}
          />
        </div>
        <div className="lg:col-span-1">
          <PendingApplicationsCard
            applications={stats?.pending_applications ?? []}
            loading={loadingStats}
          />
        </div>
      </div>

      {/* 5. Toptancı XML Entegrasyon ve Senkronizasyon Durumu */}
      <div className="mt-2">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-md bg-zinc-100 flex items-center justify-center text-zinc-600">
            <Layers size={14} />
          </div>
          <h2 className="text-sm font-bold text-zinc-900">
            Toptancı XML Entegrasyon & Senkronizasyon Operasyonları
          </h2>
        </div>

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
            onClearHistory={handleClearAllHistory}
          />
        </div>
      </div>
    </div>
  );
}
