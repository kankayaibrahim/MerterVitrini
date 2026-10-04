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
  PanelLeftOpen
} from "lucide-react";
import { ADMIN_NAVIGATION, NavigationGroup, NavigationItem } from "@/config/adminNavigation";
import { useAdmin } from "@/context/AdminContext";

const BADGE_STYLES = {
  amber: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  emerald: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  violet: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
  blue: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  zinc: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700"
} as const;

export default function AdminSidebar() {
  const pathname = usePathname();
  const { 
    user, 
    sidebarCollapsed, 
    setSidebarCollapsed, 
    mobileSidebarOpen, 
    setMobileSidebarOpen 
  } = useAdmin();

  // User overrides for group expansion
  const [userToggledGroups, setUserToggledGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (groupId: string, currentlyExpanded: boolean) => {
    setUserToggledGroups(prev => ({ ...prev, [groupId]: !currentlyExpanded }));
  };

  const isGroupExpanded = (group: NavigationGroup) => {
    if (typeof userToggledGroups[group.id] === "boolean") {
      return userToggledGroups[group.id];
    }
    const hasActiveChild = group.items.some(
      item => pathname === item.href || (pathname.startsWith(item.href) && item.href !== "/admin")
    );
    return hasActiveChild || Boolean(group.defaultExpanded);
  };

  const closeMobileSidebar = () => {
    setMobileSidebarOpen(false);
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {mobileSidebarOpen && (
        <button 
          type="button"
          onClick={closeMobileSidebar}
          aria-label="Menüyü kapat"
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity cursor-pointer border-0 p-0"
        />
      )}

      {/* Sidebar Container */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 bg-white dark:bg-zinc-950 border-r border-zinc-200/80 dark:border-zinc-800/80 text-zinc-700 dark:text-zinc-300 flex flex-col shrink-0 transition-all duration-300 ease-in-out lg:static ${
          mobileSidebarOpen 
            ? "translate-x-0 w-72" 
            : "-translate-x-full lg:translate-x-0"
        } ${
          sidebarCollapsed ? "lg:w-20" : "lg:w-72"
        }`}
      >
        {/* Top Brand Header */}
        <div className="h-16 px-5 border-b border-zinc-200/80 dark:border-zinc-800/80 flex items-center justify-between shrink-0 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md">
          <Link 
            href="/admin/dashboard" 
            className="flex items-center gap-3 overflow-hidden"
            onClick={closeMobileSidebar}
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-amber-500 flex items-center justify-center text-white font-black text-sm shadow-md shadow-violet-600/30 shrink-0">
              MV
            </div>
            {!sidebarCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="font-extrabold text-zinc-900 dark:text-white text-sm tracking-tight truncate flex items-center gap-1.5">
                  <span>Merter Vitrini</span>
                  <span className="text-[10px] bg-violet-500/20 text-violet-700 dark:text-violet-300 px-1.5 py-0.5 rounded font-mono font-bold uppercase">
                    B2B
                  </span>
                </span>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium truncate">
                  Yönetim &amp; Entegrasyon Paneli
                </span>
              </div>
            )}
          </Link>

          {/* Desktop Collapse Toggle */}
          <button
            type="button"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden lg:flex p-1.5 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-colors cursor-pointer"
            title={sidebarCollapsed ? "Menüyü Genişlet" : "Menüyü Daralt"}
            aria-label="Sidebar daraltma"
          >
            {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>

          {/* Mobile Close Button */}
          <button 
            type="button"
            onClick={closeMobileSidebar}
            className="lg:hidden p-1.5 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
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
                    className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors rounded-lg group cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <group.icon size={13} className="text-zinc-400 dark:text-zinc-600 group-hover:text-zinc-600 dark:group-hover:text-zinc-400" />
                      {group.title}
                    </span>
                    {isExpanded ? (
                      <ChevronDown size={13} className="text-zinc-400 dark:text-zinc-600" />
                    ) : (
                      <ChevronRight size={13} className="text-zinc-400 dark:text-zinc-600" />
                    )}
                  </button>
                ) : (
                  <div className="h-px bg-zinc-200/80 dark:bg-zinc-800/60 my-2 mx-2" />
                )}

                {/* Items in Group */}
                {(isExpanded || sidebarCollapsed) && (
                  <div className="space-y-0.5">
                    {group.items.map((item: NavigationItem) => {
                      const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== "/admin");
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
                              ? "bg-zinc-100 dark:bg-zinc-800/90 text-zinc-950 dark:text-white shadow-xs ring-1 ring-zinc-200 dark:ring-zinc-700/50"
                              : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 hover:bg-zinc-100/70 dark:hover:bg-zinc-900/80"
                          } ${sidebarCollapsed ? "justify-center px-0 py-3" : ""}`}
                        >
                          {/* Active Left Indicator Bar */}
                          {isActive && (
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-gradient-to-b from-violet-600 to-indigo-600 rounded-r-full" />
                          )}

                          {/* Icon with active glowing accent */}
                          <Icon 
                            size={18} 
                            className={`shrink-0 transition-transform group-hover:scale-105 ${
                              isActive ? "text-violet-600 dark:text-violet-400" : "text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200"
                            }`} 
                          />

                          {/* Title and Badge (Full Mode) */}
                          {!sidebarCollapsed && (
                            <div className="flex-1 flex items-center justify-between min-w-0">
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
        <div className="p-3 border-t border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/80 dark:bg-zinc-950/80 shrink-0">
          <div className={`flex items-center gap-3 p-2 rounded-xl bg-white dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800/60 shadow-xs ${sidebarCollapsed ? "justify-center p-2" : ""}`}>
            <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/80 flex items-center justify-center text-zinc-700 dark:text-zinc-300 font-bold text-xs uppercase shrink-0">
              {user?.first_name ? user.first_name[0] : "A"}
              {user?.last_name ? user.last_name[0] : "D"}
            </div>

            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <span className="text-xs font-bold text-zinc-900 dark:text-white block truncate leading-tight">
                  {user?.first_name || "Yönetici"} {user?.last_name || ""}
                </span>
                <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 block truncate uppercase tracking-wider flex items-center gap-1 mt-0.5">
                  <Sparkles size={10} className="text-amber-500 dark:text-amber-400" />
                  {user?.role || "ADMINISTRATOR"}
                </span>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
