"use client";

import React from "react";
import Link from "next/link";
import { Users, ArrowRight, Building2, MapPin, Tag } from "lucide-react";
import { DashboardApplicationSummary } from "@/types/dashboard";

interface PendingApplicationsCardProps {
  readonly applications: DashboardApplicationSummary[];
  readonly loading: boolean;
}

export default function PendingApplicationsCard({
  applications,
  loading,
}: Readonly<PendingApplicationsCardProps>) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Users size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900">
                Tedarikçi Aday Başvuruları
              </h3>
              <p className="text-xs text-zinc-500">
                Vitrinden başvuran üretici ve toptancılar
              </p>
            </div>
          </div>

          <Link
            href="/admin/suppliers"
            className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 hover:text-amber-800 transition-colors"
          >
            <span>Yönet</span>
            <ArrowRight size={13} />
          </Link>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-zinc-400">Başvurular yükleniyor...</div>
        ) : applications.length === 0 ? (
          <div className="py-8 text-center">
            <Building2 size={28} className="mx-auto text-zinc-300 mb-2" />
            <p className="text-xs font-semibold text-zinc-600">Bekleyen başvuru yok</p>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Yeni toptancı adayları başvurduğunda burada görünecektir.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {applications.map((app) => (
              <div
                key={app.id}
                className="p-3 rounded-xl bg-zinc-50/70 border border-zinc-200/60 hover:bg-zinc-100/60 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="font-bold text-xs text-zinc-900 truncate">
                    {app.company_name}
                  </div>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100/80 text-amber-800 border border-amber-200">
                    {app.status.toUpperCase()}
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
                  <span className="ml-auto">
                    {new Date(app.created_at).toLocaleDateString("tr-TR")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="pt-3 mt-3 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
        <span>Toptancı başvuru formu vitrinde aktiftir.</span>
        <Link href="/admin/suppliers" className="font-semibold text-zinc-700 hover:text-zinc-900">
          Tüm Başvurular →
        </Link>
      </div>
    </div>
  );
}
