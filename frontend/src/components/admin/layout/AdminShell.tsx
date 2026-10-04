"use client";

import React from "react";
import AdminSidebar from "./AdminSidebar";
import AdminNavbar from "./AdminNavbar";
import LoginScreen from "@/components/admin/auth/LoginScreen";
import { useAdmin } from "@/context/AdminContext";
import { Loader2 } from "lucide-react";

export default function AdminShell({ children }: { readonly children: React.ReactNode }) {
  const { isInitialized, token, theme } = useAdmin();

  // 1. Initializing state (checking stored JWT / Keycloak callback)
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4 text-white">
        <div className="relative">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-600 to-amber-500 flex items-center justify-center font-black text-lg shadow-xl shadow-violet-600/30">
            MV
          </div>
          <Loader2 size={24} className="absolute -bottom-2 -right-2 text-white animate-spin" />
        </div>
        <p className="text-xs font-semibold text-zinc-400 tracking-wider uppercase animate-pulse">
          Admin Suite Hazırlanıyor...
        </p>
      </div>
    );
  }

  // 2. Authentication check - show login screen if no token
  if (!token) {
    return <LoginScreen />;
  }

  // 3. Authenticated Admin SaaS Shell
  return (
    <div className={`min-h-screen ${theme === "dark" ? "dark bg-zinc-950 text-zinc-100" : "bg-slate-50 text-slate-900"} flex font-sans antialiased transition-colors duration-200`}>
      {/* Dynamic Collapsible Sidebar */}
      <AdminSidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Sticky Top Navbar */}
        <AdminNavbar />

        {/* Scrollable Viewport */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 custom-scrollbar">
          <div className="max-w-[1720px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
