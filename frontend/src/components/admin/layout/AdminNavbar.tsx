"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  Menu, 
  ExternalLink, 
  Bell, 
  LogOut, 
  ShieldCheck, 
  RefreshCw, 
  Radio, 
  CheckCircle2 
} from "lucide-react";
import AdminBreadcrumb from "./AdminBreadcrumb";
import { useAdmin } from "@/context/AdminContext";

export default function AdminNavbar() {
  const { 
    user, 
    dbStatus, 
    handleLogout, 
    setMobileSidebarOpen,
    activeSyncing
  } = useAdmin();

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const syncingCount = Object.keys(activeSyncing).length;

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200/80 dark:border-zinc-800/80 px-4 sm:px-6 flex items-center justify-between gap-4">
      {/* Left: Mobile Toggle & Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(prev => !prev)}
          className="lg:hidden p-2 rounded-xl text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800 transition-colors"
          aria-label="Menüyü aç"
        >
          <Menu size={20} />
        </button>

        <div className="min-w-0">
          <AdminBreadcrumb />
        </div>
      </div>

      {/* Right: Actions, Badges & User Dropdown */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Active Syncing Indicator */}
        {syncingCount > 0 && (
          <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-50 border border-violet-200 text-violet-700 text-xs font-bold animate-pulse">
            <RefreshCw size={12} className="animate-spin" />
            <span>{syncingCount} Senkronizasyon Çalışıyor</span>
          </div>
        )}

        {/* Database & Service Health Badge */}
        <div 
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800"
          title={`Backend API & PostgreSQL: ${dbStatus === "connected" ? "Bağlı ve Çalışıyor" : "Bağlantı Bekleniyor"}`}
        >
          <span className={`w-2 h-2 rounded-full ${
            dbStatus === "connected" 
              ? "bg-emerald-500 animate-pulse ring-2 ring-emerald-500/20" 
              : "bg-amber-500 ring-2 ring-amber-500/20"
          }`} />
          <span className="text-zinc-700 dark:text-zinc-300 hidden md:inline">
            {dbStatus === "connected" ? "Servis Aktif" : "Bağlantı Kontrol"}
          </span>
        </div>

        {/* View Storefront Link */}
        <Link
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-zinc-700 hover:text-zinc-950 bg-white hover:bg-zinc-50 border border-zinc-200/80 shadow-xs transition-all dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800 dark:hover:bg-zinc-800"
        >
          <ExternalLink size={13} />
          <span className="hidden sm:inline">Mağazayı Gör</span>
        </Link>

        {/* Notification Bell Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setNotificationsOpen(!notificationsOpen);
              setProfileOpen(false);
            }}
            className="relative p-2 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800 transition-colors"
            aria-label="Bildirimler"
          >
            <Bell size={18} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-violet-600 ring-2 ring-white dark:ring-zinc-950" />
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-xl p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800 px-2">
                <span className="text-xs font-bold text-zinc-900 dark:text-white">Sistem Bildirimleri</span>
                <span className="text-[10px] text-zinc-400 font-medium">Son 24 Saat</span>
              </div>
              <div className="py-2 space-y-2">
                <div className="flex items-start gap-2.5 p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
                  <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                  <div className="text-xs">
                    <p className="font-semibold text-zinc-800 dark:text-zinc-200">Veritabanı Hazır</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">PostgreSQL 16 havuzu ve ltree eklentisi sorunsuz devrede.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
                  <Radio size={16} className="text-violet-500 mt-0.5 shrink-0" />
                  <div className="text-xs">
                    <p className="font-semibold text-zinc-800 dark:text-zinc-200">Keycloak IAM Bağlı</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Realm: merter - OIDC JWT doğrulaması aktif.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Profile Avatar & Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setProfileOpen(!profileOpen);
              setNotificationsOpen(false);
            }}
            className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Profil menüsü"
          >
            <div className="w-8 h-8 rounded-xl bg-zinc-900 dark:bg-zinc-800 text-white flex items-center justify-center text-xs font-extrabold uppercase shadow-xs">
              {user?.first_name ? user.first_name[0] : "A"}
              {user?.last_name ? user.last_name[0] : "D"}
            </div>
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="p-2.5 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-xs font-bold text-zinc-900 dark:text-white block truncate">
                  {user?.first_name || "Yönetici"} {user?.last_name || ""}
                </span>
                <span className="text-[10px] text-zinc-400 block truncate mt-0.5 font-medium">
                  {user?.email || "admin@mertervitrini.com.tr"}
                </span>
              </div>
              <div className="py-1">
                <Link
                  href="/admin/settings/site"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                >
                  <ShieldCheck size={15} className="text-zinc-400" />
                  Sistem Ayarları
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors text-left"
                >
                  <LogOut size={15} />
                  Güvenli Çıkış Yap
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
