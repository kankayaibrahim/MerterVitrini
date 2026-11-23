"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Users,
  UserPlus,
  Key,
  Trash2,
  Edit3,
  CheckCircle2,
  XCircle,
  Search,
  RefreshCw,
  Building,
  Phone,
  Mail,
  Lock,
  X,
  Briefcase,
  Globe,
  ShieldCheck,
  MessageSquare,
  Gift,
  Filter,
  LogIn
} from "lucide-react";
import { Brand, SupplierUser } from "@/types/integration";
import { ChatRoom, ChatMessage, ChatOfferMetadata } from "@/types/chat";
import { launchSupplierImpersonationSession } from "@/utils/supplierImpersonation";

interface SupplierUsersSectionProps {
  suppliers: Brand[];
  apiUrl: string;
  token: string | null;
}

function renderChatRoomsList(
  loadingChats: boolean,
  chatRooms: readonly ChatRoom[],
  selectedRoom: ChatRoom | null,
  onSelectRoom: (room: ChatRoom) => void
) {
  if (loadingChats) {
    return <div className="p-8 text-center text-xs text-zinc-400">Sohbet odaları yükleniyor...</div>;
  }
  if (chatRooms.length === 0) {
    return <div className="p-8 text-center text-xs text-zinc-400">Henüz kayıtlı sohbet odası bulunamadı.</div>;
  }
  return chatRooms.map((room) => (
    <button
      key={room.id}
      type="button"
      onClick={() => void onSelectRoom(room)}
      className={`w-full text-left p-3.5 hover:bg-white transition-colors cursor-pointer flex flex-col gap-1 ${
        selectedRoom?.id === room.id ? "bg-white border-l-4 border-l-violet-600 shadow-xs" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-zinc-900 truncate">{room.customer_name}</span>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 font-bold">
          {room.supplier_name}
        </span>
      </div>
      <div className="text-[11px] text-indigo-700 font-semibold">
        Temsilci: {room.supplier_user_name || "Genel Mağaza Hattı"}{" "}
        {room.supplier_user_title ? `(${room.supplier_user_title})` : ""}
      </div>
      <p className="text-xs text-zinc-500 truncate">{room.last_message_preview || "Mesaj yok"}</p>
      <span className="text-[10px] text-zinc-400">
        {new Date(room.last_message_at).toLocaleString("tr-TR")}
      </span>
    </button>
  ));
}

function renderChatMessages(
  selectedRoom: ChatRoom | null,
  loadingMessages: boolean,
  roomMessages: readonly ChatMessage[]
) {
  if (!selectedRoom) {
    return (
      <div className="flex-1 flex items-center justify-center text-xs text-zinc-400 p-8">
        Detaylarını görmek için soldan bir sohbet odası seçin.
      </div>
    );
  }
  if (loadingMessages) {
    return (
      <div className="flex-1 flex items-center justify-center text-xs text-zinc-400 p-8">
        Mesaj geçmişi yükleniyor...
      </div>
    );
  }
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-zinc-50/40">
      {roomMessages.map((msg) => {
        const isSupplier = msg.sender_type === "supplier";
        const offer =
          msg.message_type === "custom_offer"
            ? (msg.metadata as ChatOfferMetadata | undefined)
            : undefined;
        return (
          <div
            key={msg.id}
            className={`flex flex-col ${isSupplier ? "items-end" : "items-start"}`}
          >
            <span className="text-[10px] text-zinc-400 mb-0.5 px-1">
              {msg.sender_name} • {new Date(msg.created_at).toLocaleString("tr-TR")}
            </span>
            <div
              className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-xs ${
                isSupplier
                  ? "bg-violet-600 text-white rounded-br-xs"
                  : "bg-white border border-zinc-200 text-zinc-800 rounded-bl-xs"
              }`}
            >
              {offer && (
                <div className="mb-2 p-2.5 rounded-xl bg-black/15 border border-white/15 text-left">
                  <div className="flex items-center gap-1.5 font-extrabold text-[11px] mb-1">
                    <Gift size={13} />
                    ÖZEL B2B FİYAT TEKLİFİ ({offer.offer_status === "accepted" ? "KABUL EDİLDİ" : "BEKLİYOR"})
                  </div>
                  <div className="text-[11px] font-bold">{offer.title}</div>
                  <div className="text-[11px] opacity-90 mt-0.5">
                    Miktar: {offer.packages_qty} Paket • Teklif Birim Fiyatı:{" "}
                    <span className="font-extrabold underline">
                      {offer.offered_unit_price} {offer.currency}
                    </span>
                  </div>
                </div>
              )}
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function SupplierUsersSection({
  suppliers,
  apiUrl,
  token
}: Readonly<SupplierUsersSectionProps>) {
  const [users, setUsers] = useState<SupplierUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBrandFilter, setSelectedBrandFilter] = useState<string>("all");
  const [activeModal, setActiveModal] = useState<"create" | "edit" | "delete" | "chats" | null>(null);
  const [selectedUser, setSelectedUser] = useState<SupplierUser | null>(null);

  // Form states
  const [formBrandId, setFormBrandId] = useState("");
  const [formContactName, setFormContactName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formJobTitle, setFormJobTitle] = useState("Satış Temsilcisi");
  const [formSpokenLanguages, setFormSpokenLanguages] = useState("TR, EN, RU");
  const [formIsOwner, setFormIsOwner] = useState(false);
  const [formIsActive, setFormIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [impersonatingUserId, setImpersonatingUserId] = useState<string | null>(null);
  const [impersonationNotice, setImpersonationNotice] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Admin Chat Monitor states
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [roomMessages, setRoomMessages] = useState<ChatMessage[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const loadUsers = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/v1/admin/supplier-users`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Tedarikçi kullanıcıları yüklenemedi:", err);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, token]);

  useEffect(() => {
    let ignore = false;
    async function initUsers() {
      if (!token) return;
      try {
        const res = await fetch(`${apiUrl}/api/v1/admin/supplier-users`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok && !ignore) {
          const data = await res.json();
          setUsers(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error("Tedarikçi kullanıcıları yüklenemedi:", err);
      }
    }
    void initUsers();
    return () => {
      ignore = true;
    };
  }, [apiUrl, token]);

  const userCountByBrand = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const u of users) {
      counts[u.brand_id] = (counts[u.brand_id] || 0) + 1;
    }
    return counts;
  }, [users]);

  const handleOpenCreate = (presetBrandId?: string) => {
    const defaultBrand = presetBrandId && presetBrandId !== "all" ? presetBrandId : suppliers[0]?.id || "";
    setFormBrandId(defaultBrand);
    setFormContactName("");
    setFormEmail("");
    setFormPassword("");
    setFormPhone("");
    setFormJobTitle("Satış Temsilcisi");
    setFormSpokenLanguages("TR, EN, RU");
    setFormIsOwner((userCountByBrand[defaultBrand] || 0) === 0);
    setFormIsActive(true);
    setFormError("");
    setActiveModal("create");
  };

  const handleOpenEdit = (user: SupplierUser) => {
    setSelectedUser(user);
    setFormContactName(user.contact_name);
    setFormPhone(user.phone || "");
    setFormJobTitle(user.job_title || "Satış Temsilcisi");
    setFormSpokenLanguages(user.spoken_languages || "TR");
    setFormIsOwner(Boolean(user.is_owner));
    setFormPassword("");
    setFormIsActive(user.is_active);
    setFormError("");
    setActiveModal("edit");
  };

  const handleOpenDelete = (user: SupplierUser) => {
    setSelectedUser(user);
    setActiveModal("delete");
  };

  const handleImpersonateUser = async (user: SupplierUser) => {
    setImpersonationNotice(null);
    setImpersonatingUserId(user.id);
    const res = await launchSupplierImpersonationSession({
      apiUrl,
      token,
      brandId: user.brand_id,
      supplierUserId: user.id,
    });
    setImpersonatingUserId(null);
    if (res.ok) {
      setImpersonationNotice({
        type: "success",
        text: `${user.brand_name || "Tedarikçi"} (${user.contact_name}) adına tedarikçi portalı yeni sekmede açıldı.`,
      });
    } else {
      setImpersonationNotice({
        type: "error",
        text: res.error || "Tedarikçi oturumu açılamadı.",
      });
    }
  };

  const handleOpenChatMonitor = async (user?: SupplierUser) => {
    if (!token) return;
    setSelectedUser(user || null);
    setSelectedRoom(null);
    setRoomMessages([]);
    setActiveModal("chats");
    setLoadingChats(true);
    try {
      const qs = new URLSearchParams();
      if (user) {
        qs.set("brand_id", user.brand_id);
        qs.set("supplier_user_id", user.id);
      } else if (selectedBrandFilter !== "all") {
        qs.set("brand_id", selectedBrandFilter);
      }
      const queryStr = qs.toString() ? `?${qs.toString()}` : "";
      const res = await fetch(`${apiUrl}/api/v1/admin/chat/rooms${queryStr}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const rooms: ChatRoom[] = await res.json();
        const list = Array.isArray(rooms) ? rooms : [];
        setChatRooms(list);
        if (list.length > 0) {
          void handleSelectChatRoom(list[0]);
        }
      }
    } catch (err) {
      console.error("Sohbet odaları yüklenemedi:", err);
    } finally {
      setLoadingChats(false);
    }
  };

  const handleSelectChatRoom = async (room: ChatRoom) => {
    if (!token) return;
    setSelectedRoom(room);
    setLoadingMessages(true);
    try {
      const res = await fetch(`${apiUrl}/api/v1/admin/chat/rooms/${room.id}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const msgs: ChatMessage[] = await res.json();
        setRoomMessages(Array.isArray(msgs) ? msgs : []);
      }
    } catch (err) {
      console.error("Mesajlar yüklenemedi:", err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSubmitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formBrandId || !formEmail || !formPassword || !formContactName) {
      setFormError("Lütfen tüm zorunlu alanları doldurun.");
      return;
    }
    if (formPassword.length < 6) {
      setFormError("Şifre en az 6 karakter olmalıdır.");
      return;
    }

    setSubmitting(true);
    setFormError("");
    try {
      const res = await fetch(`${apiUrl}/api/v1/admin/supplier-users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          brand_id: formBrandId,
          contact_name: formContactName,
          email: formEmail,
          password: formPassword,
          phone: formPhone,
          job_title: formJobTitle,
          spoken_languages: formSpokenLanguages,
          is_owner: formIsOwner
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Kullanıcı oluşturulamadı.");
      }

      setActiveModal(null);
      void loadUsers();
    } catch (err: unknown) {
      setFormError((err as Error).message || "Bir hata oluştu.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (!formContactName) {
      setFormError("Yetkili kişi adı zorunludur.");
      return;
    }
    if (formPassword && formPassword.length < 6) {
      setFormError("Yeni şifre en az 6 karakter olmalıdır.");
      return;
    }

    setSubmitting(true);
    setFormError("");
    try {
      const res = await fetch(`${apiUrl}/api/v1/admin/supplier-users/${selectedUser.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          contact_name: formContactName,
          phone: formPhone,
          job_title: formJobTitle,
          spoken_languages: formSpokenLanguages,
          is_owner: formIsOwner,
          password: formPassword || undefined,
          is_active: formIsActive
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Güncelleme başarısız.");
      }

      setActiveModal(null);
      void loadUsers();
    } catch (err: unknown) {
      setFormError((err as Error).message || "Bir hata oluştu.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitDelete = async () => {
    if (!selectedUser) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${apiUrl}/api/v1/admin/supplier-users/${selectedUser.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Silme işlemi başarısız.");
      }

      setActiveModal(null);
      void loadUsers();
    } catch (err: unknown) {
      alert((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (selectedBrandFilter !== "all" && u.brand_id !== selectedBrandFilter) {
      return false;
    }
    const q = searchQuery.toLowerCase();
    return (
      u.contact_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.brand_name || "").toLowerCase().includes(q) ||
      (u.alias_code || "").toLowerCase().includes(q) ||
      (u.job_title || "").toLowerCase().includes(q) ||
      (u.spoken_languages || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-zinc-200/60 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
            <Users className="text-violet-600" size={18} />
            Tedarikçi Ana Hesapları & Alt Satış Temsilcileri ({users.length})
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Her tedarikçi firmaya birden fazla alt kullanıcı (Satış Temsilcisi, İhracat Sorumlusu vb.) tanımlayabilir, dil ve departman bilgilerini düzenleyebilir ve canlı müşteri sohbetlerini denetleyebilirsiniz.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => void handleOpenChatMonitor()}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition-colors cursor-pointer"
          >
            <MessageSquare size={15} />
            Canlı Sohbet & Teklif Denetimi
          </button>

          <button
            type="button"
            onClick={() => void loadUsers()}
            disabled={loading}
            className="p-2.5 rounded-xl border border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 transition-colors cursor-pointer"
            title="Listeyi Yenile"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>

          <button
            type="button"
            onClick={() => handleOpenCreate(selectedBrandFilter)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold shadow-md shadow-violet-600/10 transition-all cursor-pointer hover:shadow-lg active:scale-95"
          >
            <UserPlus size={16} />
            Yeni Tedarikçi / Alt Temsilci Tanımla
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      {impersonationNotice && (
        <div
          className={`px-4 py-3 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 ${
            impersonationNotice.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          <span>{impersonationNotice.text}</span>
          <button
            type="button"
            onClick={() => setImpersonationNotice(null)}
            className="text-current opacity-60 hover:opacity-100 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tedarikçi firma, temsilci adı, departman, dil veya e-posta ile arayın..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-zinc-200/80 text-xs text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
          />
        </div>

        <div className="flex items-center gap-2 bg-white border border-zinc-200/80 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-700 shrink-0">
          <Filter size={14} className="text-violet-600" />
          <select
            value={selectedBrandFilter}
            onChange={(e) => setSelectedBrandFilter(e.target.value)}
            className="bg-transparent focus:outline-none cursor-pointer pr-2 font-bold text-zinc-800"
          >
            <option value="all">Tüm Tedarikçi Firmalar ({users.length} Hesap)</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} {s.alias_code ? `[${s.alias_code}]` : ""} — ({userCountByBrand[s.id] || 0} Temsilci)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-zinc-200/60 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50/80 border-b border-zinc-200/60 text-zinc-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Tedarikçi Firma / Marka</th>
                <th className="py-3 px-4">Temsilci & Rol</th>
                <th className="py-3 px-4">Departman & Diller</th>
                <th className="py-3 px-4">Giriş E-Postası</th>
                <th className="py-3 px-4">Telefon</th>
                <th className="py-3 px-4 text-center">Durum</th>
                <th className="py-3 px-4">Son Giriş</th>
                <th className="py-3 px-4 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 font-medium">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-400">
                    {loading ? "Tedarikçi hesapları yükleniyor..." : "Seçili filtreye uygun tedarikçi veya alt temsilci hesabı bulunamadı."}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-zinc-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-zinc-900">
                      <div className="flex items-center gap-2">
                        <Building size={14} className="text-zinc-400 shrink-0" />
                        <span>{user.brand_name || "Bilinmiyor"}</span>
                        {user.alias_code && (
                          <span className="px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 text-[10px] font-mono font-bold">
                            {user.alias_code}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-zinc-800">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold">{user.contact_name}</span>
                          {user.is_owner ? (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px] font-extrabold uppercase">
                              <ShieldCheck size={10} />
                              Ana Hesap
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[9px] font-bold">
                              Alt Temsilci
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-zinc-700 font-semibold flex items-center gap-1">
                          <Briefcase size={11} className="text-zinc-400" />
                          {user.job_title || "Satış Temsilcisi"}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-bold">
                          <Globe size={10} />
                          {user.spoken_languages || "TR"}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-zinc-600 font-mono">
                      <div className="flex items-center gap-1.5">
                        <span>{user.email}</span>
                        {user.keycloak_id && (
                          <span
                            className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-sans font-bold"
                            title={`Keycloak ID: ${user.keycloak_id}`}
                          >
                            Keycloak
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-zinc-500">{user.phone || "-"}</td>
                    <td className="py-3.5 px-4 text-center">
                      {user.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                          <CheckCircle2 size={12} />
                          Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-200 text-zinc-600 text-[10px] font-bold">
                          <XCircle size={12} />
                          Pasif
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-zinc-400 text-[11px]">
                      {user.last_login_at ? new Date(user.last_login_at).toLocaleString("tr-TR") : "Henüz girmedi"}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => void handleImpersonateUser(user)}
                          disabled={!user.is_active || impersonatingUserId === user.id}
                          className="px-2 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-45 disabled:cursor-not-allowed inline-flex items-center gap-1 text-[11px] font-bold transition-colors cursor-pointer"
                          title={
                            user.is_active
                              ? "Bu Kullanıcı Adına Tedarikçi Portalında Oturum Aç"
                              : "Pasif kullanıcı adına oturum açılamaz"
                          }
                        >
                          <LogIn size={13} />
                          <span>{impersonatingUserId === user.id ? "..." : "Oturum Aç"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleOpenChatMonitor(user)}
                          className="p-1.5 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                          title="Bu Temsilcinin Sohbetlerini Gör"
                        >
                          <MessageSquare size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(user)}
                          className="p-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:text-violet-600 hover:bg-violet-50 transition-colors cursor-pointer"
                          title="Düzenle / Şifre & Departman Güncelle"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenDelete(user)}
                          className="p-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          title="Hesabı Sil"
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

      {/* CREATE MODAL */}
      {activeModal === "create" && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-zinc-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="font-bold text-zinc-900 text-sm flex items-center gap-2">
                <UserPlus size={16} className="text-violet-600" />
                Yeni Tedarikçi veya Alt Temsilci Hesabı Tanımla
              </h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="text-zinc-400 hover:text-zinc-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitCreate} className="p-5 flex flex-col gap-3.5">
              {formError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                  {formError}
                </div>
              )}

              {/* Brand Select */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="create-supplier-brand" className="text-xs font-bold text-zinc-700">
                  Tedarikçi Firma *
                </label>
                <select
                  id="create-supplier-brand"
                  value={formBrandId}
                  onChange={(e) => setFormBrandId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-950/20"
                  required
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.alias_code ? `(${s.alias_code})` : ""} — Mevcut: {userCountByBrand[s.id] || 0} Temsilci
                    </option>
                  ))}
                </select>
              </div>

              {/* Contact Name */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="create-supplier-contact" className="text-xs font-bold text-zinc-700">
                  Temsilci / Yetkili Adı Soyadı *
                </label>
                <input
                  id="create-supplier-contact"
                  type="text"
                  value={formContactName}
                  onChange={(e) => setFormContactName(e.target.value)}
                  placeholder="Örn: Ahmet Yılmaz (Rusya Satış)"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-950/20"
                  required
                />
              </div>

              {/* Job Title & Languages */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="create-supplier-job" className="text-xs font-bold text-zinc-700 flex items-center gap-1">
                    <Briefcase size={12} className="text-zinc-400" />
                    Departman / Ünvan
                  </label>
                  <input
                    id="create-supplier-job"
                    type="text"
                    value={formJobTitle}
                    onChange={(e) => setFormJobTitle(e.target.value)}
                    placeholder="İhracat Temsilcisi"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-950/20"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="create-supplier-langs" className="text-xs font-bold text-zinc-700 flex items-center gap-1">
                    <Globe size={12} className="text-zinc-400" />
                    Konuşulan Diller
                  </label>
                  <input
                    id="create-supplier-langs"
                    type="text"
                    value={formSpokenLanguages}
                    onChange={(e) => setFormSpokenLanguages(e.target.value)}
                    placeholder="TR, EN, RU, AR"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-950/20"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="create-supplier-email" className="text-xs font-bold text-zinc-700 flex items-center gap-1.5">
                  <Mail size={13} className="text-zinc-400" />
                  Giriş E-Posta Adresi *
                </label>
                <input
                  id="create-supplier-email"
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="temsilci@firma.com"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-950/20"
                  required
                />
              </div>

              {/* Password & Phone */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="create-supplier-password" className="text-xs font-bold text-zinc-700 flex items-center gap-1">
                    <Lock size={12} className="text-zinc-400" />
                    Giriş Şifresi *
                  </label>
                  <input
                    id="create-supplier-password"
                    type="password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="En az 6 karakter"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-950/20"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="create-supplier-phone" className="text-xs font-bold text-zinc-700 flex items-center gap-1">
                    <Phone size={12} className="text-zinc-400" />
                    Telefon / WhatsApp
                  </label>
                  <input
                    id="create-supplier-phone"
                    type="tel"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="+90 5XX XXX XX XX"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-950/20"
                  />
                </div>
              </div>

              {/* Owner Checkbox */}
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={formIsOwner}
                  onChange={(e) => setFormIsOwner(e.target.checked)}
                  className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500 border-zinc-300"
                />
                <span className="text-xs font-bold text-zinc-800">
                  Firma Ana Hesabı (Alt kullanıcı ekleme/silme yetkisine sahip)
                </span>
              </label>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 rounded-xl border border-zinc-200 text-xs text-zinc-600 hover:bg-zinc-50 cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
                >
                  {submitting ? "Kaydediliyor..." : "Hesabı Oluştur"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {activeModal === "edit" && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-zinc-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="font-bold text-zinc-900 text-sm flex items-center gap-2">
                <Key size={16} className="text-violet-600" />
                Temsilci Hesabını Düzenle / Şifre Yenile
              </h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="text-zinc-400 hover:text-zinc-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitEdit} className="p-5 flex flex-col gap-3.5">
              {formError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                  {formError}
                </div>
              )}

              <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-xs flex flex-col gap-1">
                <span className="text-zinc-500">Tedarikçi Firma:</span>
                <span className="font-bold text-zinc-900">
                  {selectedUser.brand_name} ({selectedUser.alias_code})
                </span>
                <span className="text-zinc-500 mt-1">E-Posta:</span>
                <span className="font-mono text-zinc-700">{selectedUser.email}</span>
              </div>

              {/* Contact Name */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="edit-supplier-contact" className="text-xs font-bold text-zinc-700">
                  Temsilci / Yetkili Adı Soyadı *
                </label>
                <input
                  id="edit-supplier-contact"
                  type="text"
                  value={formContactName}
                  onChange={(e) => setFormContactName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-950/20"
                  required
                />
              </div>

              {/* Job Title & Spoken Languages */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="edit-supplier-job" className="text-xs font-bold text-zinc-700">
                    Departman / Ünvan
                  </label>
                  <input
                    id="edit-supplier-job"
                    type="text"
                    value={formJobTitle}
                    onChange={(e) => setFormJobTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-950/20"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="edit-supplier-langs" className="text-xs font-bold text-zinc-700">
                    Konuşulan Diller
                  </label>
                  <input
                    id="edit-supplier-langs"
                    type="text"
                    value={formSpokenLanguages}
                    onChange={(e) => setFormSpokenLanguages(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-950/20"
                  />
                </div>
              </div>

              {/* Phone */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="edit-supplier-phone" className="text-xs font-bold text-zinc-700">
                  Telefon Numarası
                </label>
                <input
                  id="edit-supplier-phone"
                  type="tel"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-950/20"
                />
              </div>

              {/* Password (Optional) */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="edit-supplier-password" className="text-xs font-bold text-zinc-700 flex items-center gap-1.5">
                  <Lock size={13} className="text-zinc-400" />
                  Yeni Şifre (Değiştirmek İstemiyorsanız Boş Bırakın)
                </label>
                <input
                  id="edit-supplier-password"
                  type="password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder="Değiştirmek için yeni şifre girin"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-950/20"
                />
              </div>

              {/* Toggles */}
              <div className="flex flex-col gap-2 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsOwner}
                    onChange={(e) => setFormIsOwner(e.target.checked)}
                    className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500 border-zinc-300"
                  />
                  <span className="text-xs font-bold text-zinc-800">Firma Ana Hesabı (Owner)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500 border-zinc-300"
                  />
                  <span className="text-xs font-bold text-zinc-800">Hesap Aktif (Giriş ve Canlı Sohbet Yapabilir)</span>
                </label>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 rounded-xl border border-zinc-200 text-xs text-zinc-600 hover:bg-zinc-50 cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
                >
                  {submitting ? "Kaydediliyor..." : "Değişiklikleri Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {activeModal === "delete" && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-zinc-200 max-w-sm w-full overflow-hidden p-6 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={24} />
            </div>
            <h3 className="text-base font-bold text-zinc-900 mb-1">
              Hesabı Silmek İstediğinize Emin Misiniz?
            </h3>
            <p className="text-xs text-zinc-500 mb-6 leading-relaxed">
              <span className="font-semibold text-zinc-800">{selectedUser.contact_name}</span> ({selectedUser.email}) kullanıcısına ait tedarikçi / satış temsilcisi yetkisi silinecektir.
            </p>
            <div className="flex gap-2.5 justify-center">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 rounded-xl border border-zinc-200 text-xs text-zinc-600 hover:bg-zinc-50 cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleSubmitDelete}
                disabled={submitting}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
              >
                {submitting ? "Siliniyor..." : "Evet, Hesabı Sil"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN LIVE CHAT & OFFER MONITOR MODAL */}
      {activeModal === "chats" && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-zinc-200 max-w-5xl w-full h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-900 text-white">
              <div className="flex items-center gap-2.5">
                <MessageSquare size={18} className="text-emerald-400" />
                <div>
                  <h3 className="font-bold text-sm">
                    {selectedUser
                      ? `${selectedUser.contact_name} (${selectedUser.brand_name}) — Canlı Müşteri Görüşmeleri`
                      : "Tüm Tedarikçi & Alt Temsilci Canlı Sohbet Denetimi"}
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Müşteriler ile tedarikçi satış temsilcileri arasındaki konuşmaları ve özel fiyat tekliflerini inceleyin.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-12 min-h-0">
              {/* Left: Rooms list */}
              <div className="md:col-span-5 border-r border-zinc-200 overflow-y-auto divide-y divide-zinc-100 bg-zinc-50/50">
                {renderChatRoomsList(loadingChats, chatRooms, selectedRoom, handleSelectChatRoom)}
              </div>

              {/* Right: Messages */}
              <div className="md:col-span-7 flex flex-col min-h-0 bg-white">
                {renderChatMessages(selectedRoom, loadingMessages, roomMessages)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
