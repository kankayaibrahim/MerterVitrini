"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  X,
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { ADMIN_NAVIGATION, NavigationGroup, NavigationItem } from "@/config/adminNavigation";
import { useAdmin } from "@/context/AdminContext";

const BADGE_STYLES = {
  amber: "bg-amber-500/20 text-amber-300 border-amber-400/30",
  emerald: "bg-emerald-500/20 text-emerald-300 border-emerald-400/30",
  violet: "bg-[#8C6D3F]/25 text-[#F3E2C7] border-[#8C6D3F]/40",
  blue: "bg-sky-500/20 text-sky-300 border-sky-400/30",
  zinc: "bg-slate-800 text-slate-300 border-slate-700",
} as const;

function formatRoleLabelTr(role?: string): string {
  const norm = (role || "").trim().toLowerCase();
  if (!norm || norm === "admin" || norm === "super_admin" || norm === "administrator") {
    return "KURUMSAL YÖNETİCİ";
  }
  return norm.toLocaleUpperCase("tr-TR");
}

export default function AdminSidebar() {
  const pathname = usePathname();
  const {
    user,
    sidebarCollapsed,
    setSidebarCollapsed,
    mobileSidebarOpen,
    setMobileSidebarOpen,
  } = useAdmin();

  const [userToggledGroups, setUserToggledGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (groupId: string, currentlyExpanded: boolean) => {
    setUserToggledGroups((prev) => ({ ...prev, [groupId]: !currentlyExpanded }));
  };

  const isGroupExpanded = (group: NavigationGroup) => {
    if (typeof userToggledGroups[group.id] === "boolean") {
      return userToggledGroups[group.id];
    }
    const hasActiveChild = group.items.some(
      (item) => pathname === item.href || (pathname.startsWith(item.href) && item.href !== "/admin")
    );
    return hasActiveChild || Boolean(group.defaultExpanded);
  };

  const closeMobileSidebar = () => {
    setMobileSidebarOpen(false);
  };

  const firstInitial = (user?.first_name?.[0] || "A").toLocaleUpperCase("tr-TR");
  const lastInitial = (user?.last_name?.[0] || "D").toLocaleUpperCase("tr-TR");

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {mobileSidebarOpen && (
        <button
          type="button"
          onClick={closeMobileSidebar}
          aria-label="Menüyü kapat"
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 lg:hidden transition-opacity cursor-pointer border-0 p-0"
        />
      )}

      {/* Deep Slate-Navy (#0F172A) Executive Sidebar Container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-[#0F172A] border-r border-slate-800 text-slate-300 flex flex-col shrink-0 transition-all duration-300 ease-in-out lg:static ${
          mobileSidebarOpen
            ? "translate-x-0 w-72"
            : "-translate-x-full lg:translate-x-0"
        } ${
          sidebarCollapsed ? "lg:w-20" : "lg:w-72"
        }`}
      >
        {/* Top Brand Header */}
        <div className="h-16 px-5 border-b border-slate-800/90 flex items-center justify-between shrink-0 bg-[#0F172A]">
          <Link
            href="/admin/dashboard"
            className="flex items-center gap-3 overflow-hidden"
            onClick={closeMobileSidebar}
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#8C6D3F] to-[#B08D57] border border-[#D4AF7A]/30 flex items-center justify-center text-white font-black text-sm shadow-md shadow-black/30 shrink-0">
              MV
            </div>
            {!sidebarCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="font-extrabold text-white text-sm tracking-tight truncate flex items-center gap-1.5">
                  <span>Merter Vitrini</span>
                  <span className="text-[10px] bg-[#8C6D3F]/25 text-[#F3E2C7] border border-[#8C6D3F]/40 px-1.5 py-0.5 rounded font-mono font-bold">
                    B2B
                  </span>
                </span>
                <span className="text-[10px] text-slate-400 font-medium truncate">
                  Kurumsal Yönetim Paneli
                </span>
              </div>
            )}
          </Link>

          {/* Desktop Collapse Toggle */}
          <button
            type="button"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title={sidebarCollapsed ? "Menüyü Genişlet" : "Menüyü Daralt"}
            aria-label="Sidebar daraltma"
          >
            {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>

          {/* Mobile Close Button */}
          <button
            type="button"
            onClick={closeMobileSidebar}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            aria-label="Menüyü kapat"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 space-y-6 select-none custom-scrollbar">
          {ADMIN_NAVIGATION.map((group: NavigationGroup) => {
            const isExpanded = isGroupExpanded(group);

            return (
              <div key={group.id} className="space-y-1">
                {/* Group Header */}
                {!sidebarCollapsed ? (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id, isExpanded)}
                    className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-bold tracking-wider text-slate-400 hover:text-slate-200 transition-colors rounded-lg group cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <group.icon size={13} className="text-slate-400 group-hover:text-[#D4AF7A]" />
                      {group.title.toLocaleUpperCase("tr-TR")}
                    </span>
                    {isExpanded ? (
                      <ChevronDown size={13} className="text-slate-500" />
                    ) : (
                      <ChevronRight size={13} className="text-slate-500" />
                    )}
                  </button>
                ) : (
                  <div className="h-px bg-slate-800 my-2 mx-2" />
                )}

                {/* Items in Group */}
                {(isExpanded || sidebarCollapsed) && (
                  <div className="space-y-0.5">
                    {group.items.map((item: NavigationItem) => {
                      const isActive =
                        pathname === item.href ||
                        (pathname.startsWith(item.href) && item.href !== "/admin");
                      const Icon = item.icon;
                      const badgeColor = item.badgeColor || "zinc";
                      const badgeClass = BADGE_STYLES[badgeColor];

                      return (
                        <Link
                          key={item.id}
                          href={item.href}
                          onClick={closeMobileSidebar}
                          title={sidebarCollapsed ? `${item.title} - ${item.description || ""}` : undefined}
                          className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                            isActive
                              ? "bg-slate-800/95 text-white shadow-xs ring-1 ring-slate-700/80"
                              : "text-slate-300 hover:text-white hover:bg-slate-800/60"
                          } ${sidebarCollapsed ? "justify-center px-0 py-3" : ""}`}
                        >
                          {/* Active Left Indicator Bar */}
                          {isActive && (
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-[#D4AF7A] rounded-r-full" />
                          )}

                          {/* Icon with active accent */}
                          <Icon
                            size={18}
                            className={`shrink-0 transition-transform group-hover:scale-105 ${
                              isActive
                                ? "text-[#D4AF7A]"
                                : "text-slate-400 group-hover:text-slate-200"
                            }`}
                          />

                          {/* Title and Badge (Full Mode) */}
                          {!sidebarCollapsed && (
                            <div className="flex-1 flex items-center justify-between min-w-0 gap-2">
                              <span className="truncate">{item.title}</span>
                              {item.badge && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border shrink-0 ${badgeClass}`}>
                                  {item.badge}
                                </span>
                              )}
                            </div>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Bottom User Card */}
        <div className="p-3 border-t border-slate-800 bg-[#0B1221] shrink-0">
          <div
            className={`flex items-center gap-3 p-2 rounded-xl bg-slate-900/90 border border-slate-800 shadow-xs ${
              sidebarCollapsed ? "justify-center p-2" : ""
            }`}
          >
            <div className="w-8 h-8 rounded-lg bg-[#8C6D3F]/25 border border-[#8C6D3F]/40 flex items-center justify-center text-[#F3E2C7] font-bold text-xs uppercase shrink-0">
              {firstInitial}
              {lastInitial}
            </div>

            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <span className="text-xs font-bold text-white block truncate leading-tight">
                  {user?.first_name || "Yönetici"} {user?.last_name || ""}
                </span>
                <span className="text-[10px] font-semibold text-slate-400 truncate tracking-wider flex items-center gap-1 mt-0.5">
                  <Sparkles size={10} className="text-[#D4AF7A] shrink-0" />
                  <span className="truncate">{formatRoleLabelTr(user?.role)}</span>
                </span>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
