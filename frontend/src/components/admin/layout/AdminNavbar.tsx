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
  CheckCircle2,
} from "lucide-react";
import AdminBreadcrumb from "./AdminBreadcrumb";
import {
  useAdminAuth,
  useAdminFeeds,
  useAdminShell,
} from "@/context/AdminContext";

export default function AdminNavbar() {
  const { user, dbStatus, handleLogout } = useAdminAuth();
  const { setMobileSidebarOpen } = useAdminShell();
  const { activeSyncing } = useAdminFeeds();

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const syncingCount = Object.keys(activeSyncing).length;
  const firstInitial = (user?.first_name?.[0] || "A").toLocaleUpperCase("tr-TR");
  const lastInitial = (user?.last_name?.[0] || "D").toLocaleUpperCase("tr-TR");

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-4 sm:px-6 flex items-center justify-between gap-4 text-[#0F172A]">
      {/* Left: Mobile Toggle & Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={() => setMobileSidebarOpen((prev) => !prev)}
          className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-[#0F172A] hover:bg-slate-100 transition-colors cursor-pointer"
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
          <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold animate-pulse">
            <RefreshCw size={12} className="animate-spin" />
            <span>{syncingCount} Senkronizasyon Çalışıyor</span>
          </div>
        )}

        {/* Database & Service Health Badge */}
        <div
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-bold bg-slate-100 border border-slate-200/90 text-[#0F172A]"
          title={`Backend API & PostgreSQL: ${dbStatus === "connected" ? "Bağlı ve Çalışıyor" : "Bağlantı Bekleniyor"}`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              dbStatus === "connected"
                ? "bg-emerald-500 animate-pulse ring-2 ring-emerald-500/20"
                : "bg-amber-500 ring-2 ring-amber-500/20"
            }`}
          />
          <span className="text-[#0F172A] hidden md:inline">
            {dbStatus === "connected" ? "Servis Aktif" : "Bağlantı Kontrol"}
          </span>
        </div>

        {/* View Storefront Link */}
        <Link
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-[#0F172A] hover:bg-slate-50 bg-white border border-slate-200 shadow-2xs transition-all whitespace-nowrap"
        >
          <ExternalLink size={13} className="text-slate-600" />
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
            className="relative p-2 rounded-xl text-slate-600 hover:text-[#0F172A] hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Bildirimler"
          >
            <Bell size={18} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#8C6D3F] ring-2 ring-white" />
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-white border border-slate-200 shadow-xl p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 px-2">
                <span className="text-xs font-bold text-[#0F172A]">Sistem Bildirimleri</span>
                <span className="text-[10px] text-slate-400 font-medium">Son 24 Saat</span>
              </div>
              <div className="py-2 space-y-2">
                <div className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-50">
                  <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 shrink-0" />
                  <div className="text-xs">
                    <p className="font-semibold text-[#0F172A]">Veritabanı Hazır</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      PostgreSQL 18 havuzu ve ltree eklentisi sorunsuz devrede.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-50">
                  <Radio size={16} className="text-[#8C6D3F] mt-0.5 shrink-0" />
                  <div className="text-xs">
                    <p className="font-semibold text-[#0F172A]">Keycloak IAM Bağlı</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Realm: merter - OIDC JWT doğrulaması aktif.
                    </p>
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
            className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Profil menüsü"
          >
            <div className="w-8 h-8 rounded-xl bg-[#0F172A] text-white border border-slate-700 flex items-center justify-center text-xs font-extrabold uppercase shadow-xs">
              {firstInitial}
              {lastInitial}
            </div>
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white border border-slate-200 shadow-xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="p-2.5 border-b border-slate-100">
                <span className="text-xs font-bold text-[#0F172A] block truncate">
                  {user?.first_name || "Yönetici"} {user?.last_name || ""}
                </span>
                <span className="text-[10px] text-slate-500 block truncate mt-0.5 font-medium">
                  {user?.email || "admin@mertervitrini.com.tr"}
                </span>
              </div>
              <div className="py-1">
                <Link
                  href="/admin/settings/site"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <ShieldCheck size={15} className="text-slate-500" />
                  Sistem Ayarları
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors text-left cursor-pointer"
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
