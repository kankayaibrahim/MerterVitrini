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
    <nav className="flex items-center gap-1.5 text-xs text-zinc-500 font-medium select-none" aria-label="Breadcrumb">
      <Link 
        href="/admin/dashboard" 
        className="flex items-center gap-1 text-zinc-400 hover:text-zinc-900 transition-colors"
        title="Admin Ana Sayfası"
      >
        <Home size={13} />
      </Link>
      
      {crumbs.slice(1).map((crumb, idx) => {
        const isLast = idx === crumbs.length - 2;
        return (
          <React.Fragment key={`${crumb.title}-${crumb.href || idx}`}>
            <ChevronRight size={12} className="text-zinc-300 shrink-0" />
            {isLast || !crumb.href ? (
              <span className={`truncate max-w-[180px] sm:max-w-xs ${isLast ? "text-zinc-900 font-bold" : "text-zinc-500"}`}>
                {crumb.title}
              </span>
            ) : (
              <Link 
                href={crumb.href} 
                className="text-zinc-500 hover:text-zinc-900 transition-colors truncate max-w-[160px]"
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
