"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Compass,
  Eye,
  FileText,
  Loader2,
  Radio,
  RefreshCw,
  Search,
  ShoppingBag,
  ShoppingCart,
  Users,
} from "lucide-react";
import CustomerJourneyPanel from "./CustomerJourneyPanel";

export interface MemberJourneyListItem {
  readonly id: string;
  readonly first_name: string;
  readonly last_name: string;
  readonly email: string;
  readonly phone: string;
  readonly email_verified: boolean;
  readonly is_active?: boolean;
  readonly is_blocked: boolean;
  readonly created_at: string;
  readonly last_active_at?: string | null;
  readonly is_online: boolean;
  readonly total_events: number;
  readonly pages_read_count: number;
  readonly products_viewed_count: number;
  readonly cart_actions_count: number;
  readonly orders_count: number;
  readonly last_event_title: string;
  readonly last_event_category: string;
}

interface MemberJourneysApiResult {
  readonly members: MemberJourneyListItem[];
  readonly summaryActiveMembers: number | null;
}

interface MemberJourneyExplorerProps {
  readonly apiUrl: string;
  readonly token: string | null;
  readonly initialCustomerId?: string | null;
}

function normalizeMemberJourneysPayload(payload: unknown): MemberJourneysApiResult {
  if (Array.isArray(payload)) {
    return {
      members: payload as MemberJourneyListItem[],
      summaryActiveMembers: null,
    };
  }
  if (payload && typeof payload === "object") {
    const root = payload as Record<string, unknown>;
    const rawList = Array.isArray(root.members)
      ? root.members
      : Array.isArray(root.items)
        ? root.items
        : [];
    const summaryObj =
      root.summary && typeof root.summary === "object"
        ? (root.summary as Record<string, unknown>)
        : null;
    const activeVal = summaryObj?.active_members ?? root.active_members;
    const summaryActiveMembers =
      typeof activeVal === "number" && Number.isFinite(activeVal) ? activeVal : null;
    return {
      members: rawList as MemberJourneyListItem[],
      summaryActiveMembers,
    };
  }
  return { members: [], summaryActiveMembers: null };
}

async function requestMemberJourneysList(
  apiUrl: string,
  token: string,
  search: string
): Promise<MemberJourneysApiResult> {
  const qs = search ? `?search=${encodeURIComponent(search)}` : "";
  const res = await fetch(`${apiUrl}/api/v1/admin/member-journeys${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error("Üye aktivite listesi yüklenemedi.");
  }
  const rawPayload: unknown = await res.json();
  return normalizeMemberJourneysPayload(rawPayload);
}

function formatMemberInitials(firstName?: string, lastName?: string): string {
  const first = (firstName || "").trim()[0] || "Ü";
  const last = (lastName || "").trim()[0] || "";
  return `${first}${last}`.toLocaleUpperCase("tr-TR");
}

function formatRelativeAgo(isoStr?: string | null): string {
  if (!isoStr) return "-";
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000));
  if (diffSec < 60) return "Az önce";
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins} dk önce`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} sa önce`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} gün önce`;
  return new Date(isoStr).toLocaleDateString("tr-TR");
}

export default function MemberJourneyExplorer({
  apiUrl,
  token,
  initialCustomerId,
}: Readonly<MemberJourneyExplorerProps>) {
  const [members, setMembers] = useState<MemberJourneyListItem[]>([]);
  const [summaryActiveCount, setSummaryActiveCount] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(initialCustomerId || null);
  const [searchInput, setSearchInput] = useState<string>("");
  const [appliedSearch, setAppliedSearch] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const reloadList = useCallback(async () => {
    if (!token) return;
    setRefreshing(true);
    try {
      const result = await requestMemberJourneysList(apiUrl, token, appliedSearch);
      setMembers(result.members);
      setSummaryActiveCount(result.summaryActiveMembers);
      if (result.members.length > 0 && !selectedId) {
        setSelectedId(result.members[0].id);
      }
      setError(null);
    } catch (err: unknown) {
      setError((err as Error).message || "Bir hata oluştu.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [apiUrl, token, appliedSearch, selectedId]);

  useEffect(() => {
    let mounted = true;
    if (!token) return;

    void requestMemberJourneysList(apiUrl, token, appliedSearch)
      .then((result) => {
        if (!mounted) return;
        setMembers(result.members);
        setSummaryActiveCount(result.summaryActiveMembers);
        setSelectedId((prev) => {
          if (prev && result.members.some((m) => m.id === prev)) return prev;
          return result.members.length > 0 ? result.members[0].id : null;
        });
        setError(null);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        setError((err as Error).message || "Bir hata oluştu.");
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [apiUrl, token, appliedSearch]);

  const activeMembersCount =
    summaryActiveCount && summaryActiveCount > 0
      ? summaryActiveCount
      : members.filter((m) => m.is_active !== false && !m.is_blocked).length;
  const onlineCount = members.filter((m) => m.is_online).length;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSearch(searchInput.trim());
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Hero Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-xs">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-extrabold text-zinc-950 flex items-center gap-2">
              <Compass className="text-violet-600" size={22} />
              Üye Yolculuk Haritası &amp; Aktivite Tarihçesi
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Radio size={13} className="animate-pulse text-emerald-600" />
              {activeMembersCount} Aktif Üye
              {onlineCount > 0 ? ` • ${onlineCount} Çevrimiçi` : ""}
            </span>
          </div>
          <p className="text-xs text-zinc-500 font-semibold mt-1">
            Üye olan müşterilerin ilk site girişinden itibaren okuduğu sayfaları (Hakkımızda, SSS, Blog), incelediği ürünleri, sepet ve sipariş adımlarını kronolojik olarak izleyin.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void reloadList()}
          disabled={loading || refreshing}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-xs font-bold text-zinc-700 transition-all cursor-pointer bg-white self-start sm:self-auto whitespace-nowrap shrink-0"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin text-violet-600" : ""} />
          Yenile
        </button>
      </div>

      {/* Master-Detail Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Sidebar: Members Stream */}
        <div className="lg:col-span-4 xl:col-span-4 bg-white rounded-2xl border border-zinc-200/80 shadow-xs overflow-hidden">
          <div className="p-3.5 border-b border-zinc-100 bg-zinc-50/60">
            <form onSubmit={handleSearchSubmit} className="flex gap-1.5">
              <div className="relative flex-1 min-w-0">
                <label htmlFor="member-journey-search" className="sr-only">
                  Üye Ara
                </label>
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
                />
                <input
                  id="member-journey-search"
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Ad, e-posta veya firma ara..."
                  className="w-full pl-8 pr-2.5 py-2 rounded-xl border border-zinc-200 bg-white text-xs font-semibold focus:outline-none focus:border-violet-500"
                />
              </div>
              <button
                type="submit"
                className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold cursor-pointer shrink-0"
              >
                Ara
              </button>
            </form>
          </div>

          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2">
              <Loader2 size={24} className="text-violet-600 animate-spin" />
              <span className="text-xs font-bold text-zinc-400">Üyeler yükleniyor...</span>
            </div>
          ) : null}

          {!loading && error ? (
            <div className="p-6 text-center text-xs font-bold text-rose-600">{error}</div>
          ) : null}

          {!loading && !error && members.length === 0 ? (
            <div className="py-14 text-center text-xs font-bold text-zinc-400">
              Eşleşen kayıtlı üye bulunamadı.
            </div>
          ) : null}

          {!loading && !error && members.length > 0 ? (
            <div className="divide-y divide-zinc-100 max-h-[76vh] overflow-y-auto custom-scrollbar">
              {members.map((m) => {
                const isSelected = m.id === selectedId;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedId(m.id)}
                    className={`w-full text-left p-3.5 transition-all cursor-pointer block ${
                      isSelected
                        ? "bg-violet-50/70 border-l-4 border-l-violet-600"
                        : "hover:bg-zinc-50/80"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative shrink-0">
                          <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-700 font-extrabold text-xs uppercase flex items-center justify-center">
                            {formatMemberInitials(m.first_name, m.last_name)}
                          </div>
                          {m.is_online ? (
                            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-extrabold text-zinc-900 truncate">
                            {m.first_name} {m.last_name}
                          </div>
                          <div className="text-[10px] font-medium text-zinc-500 truncate" title={m.email}>
                            {m.email}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-zinc-400 shrink-0 whitespace-nowrap">
                        {formatRelativeAgo(m.last_active_at)}
                      </span>
                    </div>

                    <div className="mt-2 text-[11px] font-semibold text-zinc-600 truncate">
                      ↳ {m.last_event_title}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700">
                        <FileText size={10} />
                        {m.pages_read_count} sayfa
                      </span>
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-fuchsia-50 text-fuchsia-700">
                        <Eye size={10} />
                        {m.products_viewed_count} ürün
                      </span>
                      {m.cart_actions_count > 0 ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-50 text-violet-700">
                          <ShoppingCart size={10} />
                          {m.cart_actions_count}
                        </span>
                      ) : null}
                      {m.orders_count > 0 ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700">
                          <ShoppingBag size={10} />
                          {m.orders_count}
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        {/* Right Canvas: Selected Member Journey Map & Timeline */}
        <div className="lg:col-span-8 xl:col-span-8 min-w-0">
          {selectedId ? (
            <CustomerJourneyPanel customerId={selectedId} apiUrl={apiUrl} token={token} />
          ) : (
            <div className="bg-white rounded-2xl border border-zinc-200/80 py-24 flex flex-col items-center justify-center gap-3 text-center px-6">
              <Users size={36} className="text-zinc-300" />
              <p className="text-sm font-bold text-zinc-600">
                Yolculuk haritasını ve aktivite tarihçesini görüntülemek için soldan bir üye seçin.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
