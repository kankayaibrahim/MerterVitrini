"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  X
} from "lucide-react";
import { Brand, SupplierUser } from "@/types/integration";

interface SupplierUsersSectionProps {
  suppliers: Brand[];
  apiUrl: string;
  token: string | null;
}

export default function SupplierUsersSection({
  suppliers,
  apiUrl,
  token
}: Readonly<SupplierUsersSectionProps>) {
  const [users, setUsers] = useState<SupplierUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeModal, setActiveModal] = useState<"create" | "edit" | "delete" | null>(null);
  const [selectedUser, setSelectedUser] = useState<SupplierUser | null>(null);

  // Form states
  const [formBrandId, setFormBrandId] = useState("");
  const [formContactName, setFormContactName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const loadUsers = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/v1/admin/supplier-users`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
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
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok && !ignore) {
          const data = await res.json();
          setUsers(data);
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

  const handleOpenCreate = () => {
    setFormBrandId(suppliers[0]?.id || "");
    setFormContactName("");
    setFormEmail("");
    setFormPassword("");
    setFormPhone("");
    setFormIsActive(true);
    setFormError("");
    setActiveModal("create");
  };

  const handleOpenEdit = (user: SupplierUser) => {
    setSelectedUser(user);
    setFormContactName(user.contact_name);
    setFormPhone(user.phone || "");
    setFormPassword("");
    setFormIsActive(user.is_active);
    setFormError("");
    setActiveModal("edit");
  };

  const handleOpenDelete = (user: SupplierUser) => {
    setSelectedUser(user);
    setActiveModal("delete");
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
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          brand_id: formBrandId,
          contact_name: formContactName,
          email: formEmail,
          password: formPassword,
          phone: formPhone
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
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          contact_name: formContactName,
          phone: formPhone,
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
          "Authorization": `Bearer ${token}`
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
    const q = searchQuery.toLowerCase();
    return (
      u.contact_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.brand_name || "").toLowerCase().includes(q) ||
      (u.alias_code || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-zinc-200/60 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
            <Users className="text-violet-600" size={18} />
            Tedarikçi Giriş Hesapları
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Tedarikçiler için kullanıcı adı/şifre tanımlayın. Tedarikçiler bu bilgilerle <span className="font-semibold text-violet-700">/tedarikci</span> panelinden ürün ekleyebilir.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
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
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold shadow-md shadow-violet-600/10 transition-all cursor-pointer hover:shadow-lg active:scale-95"
          >
            <UserPlus size={16} />
            Yeni Tedarikçi Girişi Tanımla
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Tedarikçi firma, yetkili adı veya e-posta ile arayın..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-zinc-200/80 text-xs text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-zinc-200/60 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50/80 border-b border-zinc-200/60 text-zinc-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Tedarikçi Firma / Marka</th>
                <th className="py-3 px-4">Yetkili Kişi</th>
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
                  <td colSpan={7} className="py-12 text-center text-zinc-400">
                    {loading ? "Tedarikçi hesapları yükleniyor..." : "Tanımlı tedarikçi kullanıcısı bulunamadı."}
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
                    <td className="py-3.5 px-4 text-zinc-700">
                      {user.contact_name}
                    </td>
                    <td className="py-3.5 px-4 text-zinc-600 font-mono">
                      <div className="flex items-center gap-1.5">
                        <span>{user.email}</span>
                        {user.keycloak_id && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-sans font-bold" title={`Keycloak ID: ${user.keycloak_id}`}>
                            Keycloak
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-zinc-500">
                      {user.phone || "-"}
                    </td>
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
                      {user.last_login_at 
                        ? new Date(user.last_login_at).toLocaleString("tr-TR") 
                        : "Henüz girmedi"}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(user)}
                          className="p-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:text-violet-600 hover:bg-violet-50 transition-colors cursor-pointer"
                          title="Düzenle / Şifre Yenile"
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
                Yeni Tedarikçi Girişi Tanımla
              </h3>
              <button 
                type="button" 
                onClick={() => setActiveModal(null)} 
                className="text-zinc-400 hover:text-zinc-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitCreate} className="p-5 flex flex-col gap-4">
              {formError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                  {formError}
                </div>
              )}

              {/* Brand Select */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="create-supplier-brand" className="text-xs font-bold text-zinc-700">Tedarikçi Firma *</label>
                <select
                  id="create-supplier-brand"
                  value={formBrandId}
                  onChange={(e) => setFormBrandId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-950/20"
                  required
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.alias_code ? `(${s.alias_code})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Contact Name */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="create-supplier-contact" className="text-xs font-bold text-zinc-700">Yetkili Kişi Adı Soyadı *</label>
                <input
                  id="create-supplier-contact"
                  type="text"
                  value={formContactName}
                  onChange={(e) => setFormContactName(e.target.value)}
                  placeholder="Örn: Mehmet Yılmaz"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-950/20"
                  required
                />
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
                  placeholder="tedarikci@firma.com"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-950/20"
                  required
                />
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="create-supplier-password" className="text-xs font-bold text-zinc-700 flex items-center gap-1.5">
                  <Lock size={13} className="text-zinc-400" />
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

              {/* Phone */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="create-supplier-phone" className="text-xs font-bold text-zinc-700 flex items-center gap-1.5">
                  <Phone size={13} className="text-zinc-400" />
                  Telefon Numarası (İsteğe Bağlı)
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
                Tedarikçi Hesabını Düzenle / Şifre Yenile
              </h3>
              <button 
                type="button" 
                onClick={() => setActiveModal(null)} 
                className="text-zinc-400 hover:text-zinc-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitEdit} className="p-5 flex flex-col gap-4">
              {formError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                  {formError}
                </div>
              )}

              <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-xs flex flex-col gap-1">
                <span className="text-zinc-500">Tedarikçi Firma:</span>
                <span className="font-bold text-zinc-900">{selectedUser.brand_name} ({selectedUser.alias_code})</span>
                <span className="text-zinc-500 mt-1">E-Posta:</span>
                <span className="font-mono text-zinc-700">{selectedUser.email}</span>
              </div>

              {/* Contact Name */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="edit-supplier-contact" className="text-xs font-bold text-zinc-700">Yetkili Kişi Adı Soyadı *</label>
                <input
                  id="edit-supplier-contact"
                  type="text"
                  value={formContactName}
                  onChange={(e) => setFormContactName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-950/20"
                  required
                />
              </div>

              {/* Phone */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="edit-supplier-phone" className="text-xs font-bold text-zinc-700">Telefon Numarası</label>
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

              {/* Active Toggle */}
              <label className="flex items-center gap-2 cursor-pointer mt-1">
                <input
                  type="checkbox"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500 border-zinc-300"
                />
                <span className="text-xs font-bold text-zinc-800">Hesap Aktif (Giriş Yapabilir)</span>
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
              <span className="font-semibold text-zinc-800">{selectedUser.contact_name}</span> ({selectedUser.email}) kullanıcısına ait tedarikçi giriş yetkisi tamamen silinecektir.
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
    </div>
  );
}
