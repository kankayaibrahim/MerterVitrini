"use client";

import React from "react";
import Link from "next/link";
import { Users, ArrowRight, Building2, MapPin, Tag } from "lucide-react";
import { DashboardApplicationSummary } from "@/types/dashboard";

interface PendingApplicationsCardProps {
  readonly applications: DashboardApplicationSummary[];
  readonly loading: boolean;
}

function getApplicationStatusBadge(status: string): { label: string; className: string } {
  const normalized = (status || "").trim().toUpperCase();
  if (normalized === "APPROVED") {
    return {
      label: "Onaylandı",
      className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    };
  }
  if (normalized === "REJECTED") {
    return {
      label: "Reddedildi",
      className: "bg-rose-50 text-rose-700 border-rose-200",
    };
  }
  if (normalized === "REVIEWED" || normalized === "IN_REVIEW") {
    return {
      label: "İncelendi",
      className: "bg-blue-50 text-blue-700 border-blue-200",
    };
  }
  if (normalized === "CONTACTED") {
    return {
      label: "Görüşüldü",
      className: "bg-indigo-50 text-indigo-700 border-indigo-200",
    };
  }
  return {
    label: "Bekliyor",
    className: "bg-amber-100/80 text-amber-800 border-amber-200",
  };
}

export default function PendingApplicationsCard({
  applications,
  loading,
}: Readonly<PendingApplicationsCardProps>) {
  const renderApplicationsList = () => {
    if (loading) {
      return <div className="py-8 text-center text-xs text-zinc-400">Başvurular yükleniyor...</div>;
    }

    if (applications.length === 0) {
      return (
        <div className="py-8 text-center">
          <Building2 size={28} className="mx-auto text-zinc-300 mb-2" />
          <p className="text-xs font-semibold text-zinc-600">Bekleyen başvuru yok</p>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            Yeni toptancı adayları başvurduğunda burada görünecektir.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {applications.map((app) => {
          const badge = getApplicationStatusBadge(app.status);
          return (
            <div
              key={app.id}
              className="p-3 rounded-xl bg-zinc-50/70 border border-zinc-200/60 hover:bg-zinc-100/60 transition-colors"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="font-bold text-xs text-zinc-900 truncate">
                  {app.company_name}
                </div>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded border whitespace-nowrap shrink-0 ${badge.className}`}
                >
                  {badge.label}
                </span>
              </div>
              <div className="text-[11px] text-zinc-600 font-medium truncate mb-1">
                Yetkili: {app.contact_name} • {app.phone}
              </div>
              <div className="flex items-center gap-3 text-[10px] text-zinc-400">
                {app.city ? (
                  <span className="flex items-center gap-0.5">
                    <MapPin size={10} />
                    {app.city}
                  </span>
                ) : null}
                {app.category ? (
                  <span className="flex items-center gap-0.5">
                    <Tag size={10} />
                    {app.category}
                  </span>
                ) : null}
                <span className="ml-auto whitespace-nowrap">
                  {new Date(app.created_at).toLocaleDateString("tr-TR")}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-zinc-100">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Users size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-zinc-900 truncate">
                Tedarikçi Aday Başvuruları
              </h3>
              <p className="text-xs text-zinc-500 truncate">
                Vitrinden başvuran üretici ve toptancılar
              </p>
            </div>
          </div>

          <Link
            href="/admin/supplier-applications"
            className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 hover:text-amber-800 transition-colors whitespace-nowrap shrink-0"
          >
            <span>Yönet</span>
            <ArrowRight size={13} />
          </Link>
        </div>

        {renderApplicationsList()}
      </div>

      <div className="pt-3 mt-3 border-t border-zinc-100 flex items-center justify-between gap-3 text-xs text-zinc-500">
        <span>Toptancı başvuru formu vitrinde aktiftir.</span>
        <Link
          href="/admin/supplier-applications"
          className="font-semibold text-zinc-700 hover:text-zinc-900 whitespace-nowrap shrink-0"
        >
          Tüm Başvurular →
        </Link>
      </div>
    </div>
  );
}
