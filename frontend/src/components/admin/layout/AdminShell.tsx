"use client";

import React, { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import AdminSidebar from "./AdminSidebar";
import AdminNavbar from "./AdminNavbar";
import LoginScreen from "@/components/admin/auth/LoginScreen";
import { useAdminAuth, useAdminShell } from "@/context/AdminContext";
import { Loader2 } from "lucide-react";

const ADMIN_TOKEN_STORAGE_KEYS = [
  "merter_admin_token",
  "admin_token",
  "token",
] as const;

function decodeBase64UrlUtf8(segment: string): string | null {
  try {
    const normalized = segment.replaceAll("-", "+").replaceAll("_", "/");
    const padLen = (4 - (normalized.length % 4)) % 4;
    const padded = normalized + "=".repeat(padLen);
    const binary = window.atob(padded);
    const bytes = Uint8Array.from(binary, (ch) => ch.codePointAt(0) ?? 0);
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return null;
  }
}

function decodeJwtPayload(rawToken: string): Record<string, unknown> | null {
  const parts = rawToken.trim().split(".");
  if (parts.length !== 3 || !parts[1]) {
    return null;
  }
  const jsonText = decodeBase64UrlUtf8(parts[1]);
  if (!jsonText) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(jsonText);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function appendStringRoles(source: unknown, bucket: Set<string>): void {
  if (!Array.isArray(source)) return;
  for (const item of source) {
    if (typeof item === "string" && item.trim()) {
      bucket.add(item.trim().toLowerCase());
    }
  }
}

function extractNormalizedRoles(claims: Record<string, unknown>): Set<string> {
  const roles = new Set<string>();

  if (typeof claims.role === "string" && claims.role.trim()) {
    roles.add(claims.role.trim().toLowerCase());
  }

  const realmAccess = claims.realm_access;
  if (realmAccess && typeof realmAccess === "object" && !Array.isArray(realmAccess)) {
    appendStringRoles((realmAccess as Record<string, unknown>).roles, roles);
  }

  const resourceAccess = claims.resource_access;
  if (resourceAccess && typeof resourceAccess === "object" && !Array.isArray(resourceAccess)) {
    for (const clientObj of Object.values(resourceAccess as Record<string, unknown>)) {
      if (clientObj && typeof clientObj === "object" && !Array.isArray(clientObj)) {
        appendStringRoles((clientObj as Record<string, unknown>).roles, roles);
      }
    }
  }

  return roles;
}

function isTokenAuthorizedAdmin(rawToken: string | null): boolean {
  if (!rawToken || typeof window === "undefined") {
    return false;
  }
  const claims = decodeJwtPayload(rawToken);
  if (!claims) {
    return false;
  }

  const exp = claims.exp;
  if (typeof exp !== "number" || !Number.isFinite(exp) || exp * 1000 <= Date.now()) {
    return false;
  }

  const directRole = typeof claims.role === "string" ? claims.role.trim().toLowerCase() : "";
  if (directRole === "customer" || directRole === "supplier") {
    return false;
  }

  const roles = extractNormalizedRoles(claims);
  return roles.has("admin") || roles.has("super_admin");
}

function readStoredCandidateToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    for (const key of ADMIN_TOKEN_STORAGE_KEYS) {
      const value = localStorage.getItem(key);
      if (value && value.trim()) {
        return value.trim();
      }
    }
  } catch {
    return null;
  }
  return null;
}

function clearUnauthorizedAdminStorage(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("merter_admin_token");
    localStorage.removeItem("token");
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
    localStorage.removeItem("admin_id_token");
  } catch {
    // Ignore storage access errors
  }
}

export default function AdminShell({ children }: { readonly children: React.ReactNode }) {
  const { isInitialized, token } = useAdminAuth();
  const { theme } = useAdminShell();
  const router = useRouter();
  const pathname = usePathname();

  const effectiveToken = useMemo(() => {
    if (!isInitialized) return null;
    return token || readStoredCandidateToken();
  }, [isInitialized, token]);

  const isAuthorizedAdmin = useMemo(() => {
    if (!isInitialized || !effectiveToken) return false;
    return isTokenAuthorizedAdmin(effectiveToken);
  }, [isInitialized, effectiveToken]);

  useEffect(() => {
    if (!isInitialized) return;
    const storedCandidate = token || readStoredCandidateToken();
    if (storedCandidate && !isTokenAuthorizedAdmin(storedCandidate)) {
      clearUnauthorizedAdminStorage();
      if (pathname !== "/admin/login") {
        router.replace("/admin/login");
      }
    }
  }, [isInitialized, token, pathname, router]);

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

  // 2. Authentication & RBAC check - show login screen if missing, expired, or non-admin token
  if (!token || !isAuthorizedAdmin) {
    return <LoginScreen />;
  }

  // 3. Authenticated & RBAC-Verified Admin SaaS Shell
  const shellThemeClasses =
    theme === "dark"
      ? "dark bg-zinc-950 text-zinc-100"
      : "bg-slate-50 text-slate-900";

  return (
    <div className={`min-h-screen ${shellThemeClasses} flex font-sans antialiased transition-colors duration-200`}>
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
