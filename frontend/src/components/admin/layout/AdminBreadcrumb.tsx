"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { getBreadcrumbsForPath } from "@/config/adminNavigation";

export default function AdminBreadcrumb() {
  const pathname = usePathname();
  const crumbs = getBreadcrumbsForPath(pathname);

  return (
    <nav className="flex items-center gap-1.5 text-xs text-slate-600 font-medium select-none" aria-label="Breadcrumb">
      <Link
        href="/admin/dashboard"
        className="flex items-center gap-1 text-slate-500 hover:text-[#0F172A] transition-colors"
        title="Yönetim Paneli Ana Sayfası"
      >
        <Home size={13} />
      </Link>

      {crumbs.slice(1).map((crumb, idx) => {
        const isLast = idx === crumbs.length - 2;
        return (
          <React.Fragment key={`${crumb.title}-${crumb.href || idx}`}>
            <ChevronRight size={12} className="text-slate-300 shrink-0" />
            {isLast || !crumb.href ? (
              <span
                className={`truncate max-w-[180px] sm:max-w-xs ${
                  isLast ? "text-[#0F172A] font-bold" : "text-slate-600"
                }`}
              >
                {crumb.title}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="text-slate-600 hover:text-[#0F172A] transition-colors truncate max-w-[160px]"
              >
                {crumb.title}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
