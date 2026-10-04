"use client";

import React, { useState, useEffect, useCallback } from "react";
import { 
  Building2, 
  Search, 
  RefreshCw, 
  Mail, 
  Phone, 
  Globe, 
  Calendar, 
  MapPin, 
  Tag, 
  CheckCircle2, 
  Clock, 
  PhoneCall, 
  XCircle, 
  Trash2, 
  Edit3, 
  X,
  MessageCircle,
  ExternalLink
} from "lucide-react";
import { SupplierApplication } from "@/types/integration";

const Instagram = ({ size = 16, ...props }: Readonly<React.SVGProps<SVGSVGElement> & { size?: number }>) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

interface SupplierApplicationsSectionProps {
  readonly apiUrl: string;
  readonly token: string | null;
}

export default function SupplierApplicationsSection({
  apiUrl,
  token
}: Readonly<SupplierApplicationsSectionProps>) {
  const [applications, setApplications] = useState<SupplierApplication[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [selectedApp, setSelectedApp] = useState<SupplierApplication | null>(null);
  const [modalMode, setModalMode] = useState<"detail" | "delete" | null>(null);
  const [newStatus, setNewStatus] = useState<string>("");
  const [adminNotes, setAdminNotes] = useState<string>("");
  const [savingStatus, setSavingStatus] = useState(false);

  const loadApplications = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (statusFilter !== "all") queryParams.set("status", statusFilter);
      if (searchQuery.trim()) queryParams.set("q", searchQuery.trim());
      queryParams.set("limit", "100");

      const res = await fetch(`${apiUrl}/api/v1/admin/supplier-applications?${queryParams.toString()}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setApplications(data.items || []);
        setTotalCount(data.total || 0);
      }
    } catch (err) {
      console.error("Başvurular yüklenirken hata oluştu:", err);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, token, statusFilter, searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadApplications();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadApplications]);

  const handleOpenDetail = (app: SupplierApplication) => {
    setSelectedApp(app);
    setNewStatus(app.status);
    setAdminNotes(app.admin_notes || "");
    setModalMode("detail");
  };

  const handleOpenDelete = (app: SupplierApplication) => {
    setSelectedApp(app);
    setModalMode("delete");
  };

  const handleSaveStatus = async () => {
    if (!selectedApp || !token) return;
    setSavingStatus(true);
    try {
      const res = await fetch(`${apiUrl}/api/v1/admin/supplier-applications/${selectedApp.id}/status`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status: newStatus,
          admin_notes: adminNotes
        })
      });
      if (!res.ok) {
        throw new Error("Durum güncellenemedi.");
      }
      setModalMode(null);
      void loadApplications();
    } catch (err: unknown) {
      alert((err as Error).message);
    } finally {
      setSavingStatus(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedApp || !token) return;
    setSavingStatus(true);
    try {
      const res = await fetch(`${apiUrl}/api/v1/admin/supplier-applications/${selectedApp.id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (!res.ok) {
        throw new Error("Silme işlemi başarısız.");
      }
      setModalMode(null);
      void loadApplications();
    } catch (err: unknown) {
      alert((err as Error).message);
    } finally {
      setSavingStatus(false);
    }
  };

  // Status badge formatter
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold">
            <Clock size={12} />
            Beklemede
          </span>
        );
      case "reviewed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 text-[11px] font-bold">
            <CheckCircle2 size={12} />
            İncelendi
          </span>
        );
      case "contacted":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 text-[11px] font-bold">
            <PhoneCall size={12} />
            İletişime Geçildi
          </span>
        );
      case "approved":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
            <CheckCircle2 size={12} />
            Onaylandı
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 text-red-800 text-[11px] font-bold">
            <XCircle size={12} />
            Reddedildi
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-700 text-[11px] font-bold">
            {status}
          </span>
        );
    }
  };

  // Format Instagram handle / URL
  const formatInstagramUrl = (handle?: string | null) => {
    if (!handle) return null;
    const clean = handle.trim();
    if (clean.startsWith("http://") || clean.startsWith("https://")) {
      return clean;
    }
    const username = clean.replace(/^@/, "");
    return `https://instagram.com/${username}`;
  };

  // Format WhatsApp chat URL
  const formatWhatsAppUrl = (phone: string, companyName: string) => {
    const digits = phone.replace(/\D/g, "");
    const text = encodeURIComponent(`Merhaba, Merter Vitrini (${companyName}) tedarikçi başvurunuz hakkında görüşmek istiyoruz.`);
    return `https://wa.me/${digits}?text=${text}`;
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center font-bold">
              <Building2 size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                <span>Toptan Tedarikçi Başvuruları</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
                  {totalCount} Başvuru
                </span>
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Vitrinden ve landing sayfalarından gelen yeni toptancı &amp; imalatçı ortaklık başvurularını yönetin.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void loadApplications()}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-zinc-200 text-zinc-700 hover:bg-zinc-50 text-xs font-bold transition-all cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Listeyi Yenile
        </button>
      </div>

      {/* Filter Tabs and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-zinc-200/80 shadow-sm">
        {/* Status Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {[
            { id: "all", label: "Tümü" },
            { id: "pending", label: "Bekleyenler" },
            { id: "reviewed", label: "İncelendi" },
            { id: "contacted", label: "Görüşüldü" },
            { id: "approved", label: "Onaylandı" },
            { id: "rejected", label: "Reddedildi" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                statusFilter === tab.id
                  ? "bg-zinc-950 text-white shadow-sm"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200/70 hover:text-zinc-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[260px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={15} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Firma, yetkili, e-posta, şehir, instagram..."
            className="w-full pl-9 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-amber-500 focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-zinc-50/80 border-b border-zinc-200/80 text-zinc-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Tarih / Saat</th>
                <th className="py-3 px-4">Firma &amp; Kategori</th>
                <th className="py-3 px-4">Yetkili Kişi</th>
                <th className="py-3 px-4">İletişim (Tel / E-posta)</th>
                <th className="py-3 px-4">Sosyal Medya / Web</th>
                <th className="py-3 px-4 text-center">Durum</th>
                <th className="py-3 px-4 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 font-medium">
              {applications.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center text-zinc-400">
                    {loading ? "Başvurular taranıyor..." : "Kriterlere uygun tedarikçi başvurusu bulunamadı."}
                  </td>
                </tr>
              ) : (
                applications.map((app) => (
                  <tr key={app.id} className="hover:bg-zinc-50/70 transition-colors">
                    {/* Tarih Saat */}
                    <td className="py-3.5 px-4 text-zinc-500 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 font-mono text-[11px]">
                        <Calendar size={13} className="text-zinc-400 shrink-0" />
                        <span>{new Date(app.created_at).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}</span>
                      </div>
                      {app.ip_address && (
                        <span className="text-[10px] text-zinc-400 font-mono block mt-0.5">
                          IP: {app.ip_address}
                        </span>
                      )}
                    </td>

                    {/* Firma & Kategori */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-zinc-950 text-xs">
                        {app.company_name}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-zinc-500">
                        {app.category && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200/60 font-semibold text-[10px]">
                            <Tag size={10} />
                            {app.category}
                          </span>
                        )}
                        {app.city && (
                          <span className="inline-flex items-center gap-1 text-zinc-400">
                            <MapPin size={11} />
                            {app.city}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Yetkili Kişi */}
                    <td className="py-3.5 px-4 font-bold text-zinc-800">
                      {app.contact_name}
                    </td>

                    {/* İletişim */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col gap-1">
                        <a 
                          href={`tel:${app.phone}`} 
                          className="inline-flex items-center gap-1.5 text-zinc-700 hover:text-amber-600 font-mono text-[11px] transition-colors"
                        >
                          <Phone size={12} className="text-zinc-400 shrink-0" />
                          <span>{app.phone}</span>
                        </a>
                        <a 
                          href={`mailto:${app.email}`} 
                          className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-zinc-900 text-[11px] transition-colors truncate max-w-[190px]"
                          title={app.email}
                        >
                          <Mail size={12} className="text-zinc-400 shrink-0" />
                          <span className="truncate">{app.email}</span>
                        </a>
                      </div>
                    </td>

                    {/* Sosyal Medya / Web */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        {app.instagram ? (
                          <a
                            href={formatInstagramUrl(app.instagram) || "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-pink-50 hover:bg-pink-100 text-pink-700 font-medium text-[11px] transition-colors"
                            title={`Instagram: ${app.instagram}`}
                          >
                            <Instagram size={13} />
                            <span className="truncate max-w-[110px]">{app.instagram}</span>
                            <ExternalLink size={10} />
                          </a>
                        ) : (
                          <span className="text-zinc-300 text-[11px]">-</span>
                        )}

                        {app.website && (
                          <a
                            href={app.website.startsWith("http") ? app.website : `https://${app.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-600 transition-colors"
                            title={app.website}
                          >
                            <Globe size={13} />
                          </a>
                        )}
                      </div>
                    </td>

                    {/* Durum */}
                    <td className="py-3.5 px-4 text-center">
                      {renderStatusBadge(app.status)}
                    </td>

                    {/* İşlemler */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {/* WhatsApp Button */}
                        <a
                          href={formatWhatsAppUrl(app.phone, app.company_name)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors"
                          title="WhatsApp Sohbeti Başlat"
                        >
                          <MessageCircle size={15} />
                        </a>

                        {/* Detay & Not Ekle */}
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(app)}
                          className="p-2 rounded-xl border border-zinc-200 hover:border-zinc-300 text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer"
                          title="İncele & Durum Güncelle"
                        >
                          <Edit3 size={14} />
                        </button>

                        {/* Sil */}
                        <button
                          type="button"
                          onClick={() => handleOpenDelete(app)}
                          className="p-2 rounded-xl border border-zinc-200 hover:border-red-200 text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          title="Sil"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail / Status Update Modal */}
      {modalMode === "detail" && selectedApp && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-zinc-200 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-zinc-950">{selectedApp.company_name}</h3>
                  <p className="text-xs text-zinc-500">Tedarikçi Başvuru Detayları</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="p-2 rounded-xl text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="py-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-zinc-50 p-4 rounded-2xl border border-zinc-200/60">
                <div>
                  <span className="text-zinc-400 block text-[10px] font-bold uppercase tracking-wider">Yetkili Adı</span>
                  <span className="font-bold text-zinc-900 mt-0.5 block">{selectedApp.contact_name}</span>
                </div>
                <div>
                  <span className="text-zinc-400 block text-[10px] font-bold uppercase tracking-wider">Telefon</span>
                  <a href={`tel:${selectedApp.phone}`} className="font-bold font-mono text-zinc-900 mt-0.5 block hover:underline">
                    {selectedApp.phone}
                  </a>
                </div>
                <div>
                  <span className="text-zinc-400 block text-[10px] font-bold uppercase tracking-wider">E-posta</span>
                  <a href={`mailto:${selectedApp.email}`} className="font-medium text-zinc-900 mt-0.5 block hover:underline truncate">
                    {selectedApp.email}
                  </a>
                </div>
                <div>
                  <span className="text-zinc-400 block text-[10px] font-bold uppercase tracking-wider">Şehir / Kategori</span>
                  <span className="font-medium text-zinc-900 mt-0.5 block">
                    {selectedApp.city || "-"} / {selectedApp.category || "-"}
                  </span>
                </div>
                {selectedApp.instagram && (
                  <div>
                    <span className="text-zinc-400 block text-[10px] font-bold uppercase tracking-wider">Instagram</span>
                    <a 
                      href={formatInstagramUrl(selectedApp.instagram) || "#"} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="font-medium text-pink-600 hover:underline mt-0.5 flex items-center gap-1"
                    >
                      <Instagram size={12} /> {selectedApp.instagram}
                    </a>
                  </div>
                )}
                {selectedApp.website && (
                  <div>
                    <span className="text-zinc-400 block text-[10px] font-bold uppercase tracking-wider">Web Sitesi</span>
                    <a 
                      href={selectedApp.website.startsWith("http") ? selectedApp.website : `https://${selectedApp.website}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="font-medium text-blue-600 hover:underline mt-0.5 flex items-center gap-1"
                    >
                      <Globe size={12} /> {selectedApp.website}
                    </a>
                  </div>
                )}
              </div>

              {/* Notes from applicant */}
              {selectedApp.notes && (
                <div>
                  <label htmlFor="applicant_notes" className="text-zinc-500 font-bold block mb-1">Başvuranın Notu / Üretim Açıklaması:</label>
                  <p id="applicant_notes" className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/80 text-zinc-700 leading-relaxed text-xs whitespace-pre-wrap">
                    {selectedApp.notes}
                  </p>
                </div>
              )}

              {/* Status Selector */}
              <div>
                <label htmlFor="app_status_select" className="text-zinc-700 font-bold block mb-1.5">Başvuru Durumu:</label>
                <select
                  id="app_status_select"
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full bg-white border border-zinc-300 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 font-bold focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="pending">Beklemede (Henüz incelenmedi)</option>
                  <option value="reviewed">İncelendi (Uygun bulundu)</option>
                  <option value="contacted">Görüşüldü (İletişim kuruldu)</option>
                  <option value="approved">Onaylandı (Tedarikçi hesabı açılabilir)</option>
                  <option value="rejected">Reddedildi (Uygun değil)</option>
                </select>
              </div>

              {/* Admin Private Notes */}
              <div>
                <label htmlFor="admin_private_notes" className="text-zinc-700 font-bold block mb-1.5">Yönetici Notları (İç Takip):</label>
                <textarea
                  id="admin_private_notes"
                  rows={3}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Görüşme sonucu, teklif edilen şartlar, numune durumu..."
                  className="w-full bg-white border border-zinc-300 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-zinc-100 gap-3">
              <a
                href={formatWhatsAppUrl(selectedApp.phone, selectedApp.company_name)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all"
              >
                <MessageCircle size={15} />
                WhatsApp ile Yaz
              </a>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="px-4 py-2.5 rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-50 text-xs font-bold transition-colors cursor-pointer"
                >
                  Kapat
                </button>
                <button
                  type="button"
                  onClick={handleSaveStatus}
                  disabled={savingStatus}
                  className="px-5 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-60"
                >
                  {savingStatus ? "Kaydediliyor..." : "Değişiklikleri Kaydet"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {modalMode === "delete" && selectedApp && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-zinc-200 text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={24} />
            </div>
            <h3 className="font-bold text-base text-zinc-950">Başvuru Kaydını Sil</h3>
            <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
              <span className="font-bold text-zinc-800">{selectedApp.company_name}</span> firmasının başvuru kaydını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
            </p>
            <div className="flex items-center justify-center gap-2.5 mt-6">
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="px-4 py-2.5 rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-50 text-xs font-bold transition-colors cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={savingStatus}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-60"
              >
                {savingStatus ? "Siliniyor..." : "Evet, Sil"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
