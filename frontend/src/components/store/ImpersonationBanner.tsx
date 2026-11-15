"use client";

import React, { useSyncExternalStore } from "react";
import Link from "next/link";
import { ShieldAlert, ShoppingCart, LogOut } from "lucide-react";
import { getCategoryPrefix } from "@/app/i18n";
import {
  endCustomerImpersonationSession,
  getValidStoreUser,
  type StoreUser,
} from "@/app/storeAuth";

interface ImpersonationBannerProps {
  lang?: string;
}

let cachedRawSnapshot = "";
let cachedParsedUser: StoreUser | null = null;

function getImpersonatedSnapshot(): StoreUser | null {
  if (typeof window === "undefined") return null;
  const validUser = getValidStoreUser<StoreUser>();
  if (!validUser?.impersonated) {
    cachedRawSnapshot = "";
    cachedParsedUser = null;
    return null;
  }
  const raw = localStorage.getItem("store_user_info") || "";
  if (raw === cachedRawSnapshot && cachedParsedUser !== null) {
    return cachedParsedUser;
  }
  cachedRawSnapshot = raw;
  cachedParsedUser = validUser;
  return cachedParsedUser;
}

function getServerSnapshot(): StoreUser | null {
  return null;
}

function subscribeImpersonation(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handleUpdate = () => callback();
  window.addEventListener("auth-change", handleUpdate);
  window.addEventListener("storage", handleUpdate);
  return () => {
    window.removeEventListener("auth-change", handleUpdate);
    window.removeEventListener("storage", handleUpdate);
  };
}

export function ImpersonationBanner({ lang = "tr" }: ImpersonationBannerProps) {
  const impUser = useSyncExternalStore(
    subscribeImpersonation,
    getImpersonatedSnapshot,
    getServerSnapshot
  );

  if (!impUser?.impersonated) {
    return null;
  }

  const fullName = `${impUser.first_name || ""} ${impUser.last_name || ""}`.trim();
  const displayCustomer = fullName || impUser.email || "Müşteri";
  const adminEmail = impUser.impersonated_by || "Yönetici";
  const cartHref = `/${getCategoryPrefix(lang)}/cart`;

  const handleExitImpersonation = () => {
    endCustomerImpersonationSession();
    if (typeof window !== "undefined" && window.opener) {
      window.close();
      return;
    }
    if (typeof window !== "undefined") {
      window.location.href = "/admin/customers";
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full bg-amber-500 text-slate-950 border-b border-amber-600 px-3 py-2 text-xs font-medium shadow-sm"
    >
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-950 px-2.5 py-0.5 text-[11px] font-bold text-amber-300 uppercase tracking-wide">
            <ShieldAlert className="w-3.5 h-3.5" />
            Müşteri Adına Test Modu
          </span>
          <span className="font-semibold text-slate-950">
            {displayCustomer}
          </span>
          {impUser.email && (
            <span className="text-slate-900/80 hidden sm:inline">
              ({impUser.email})
            </span>
          )}
          <span className="text-slate-900/80 text-[11px]">
            • Admin: <strong>{adminEmail}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={cartHref}
            className="inline-flex items-center gap-1.5 rounded-md bg-white/90 hover:bg-white text-slate-900 px-2.5 py-1 text-[11px] font-semibold border border-amber-700/20 transition-colors"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            Sepete Git
          </Link>
          <button
            type="button"
            onClick={handleExitImpersonation}
            className="inline-flex items-center gap-1.5 rounded-md bg-slate-950 hover:bg-slate-800 text-white px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Admin Modundan Çık
          </button>
        </div>
      </div>
    </div>
  );
}

export default ImpersonationBanner;
