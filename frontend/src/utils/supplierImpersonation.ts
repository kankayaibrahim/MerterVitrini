export const SUPPLIER_IMPERSONATION_META_KEY = "mv_supplier_impersonation_meta_v1";

export interface SupplierImpersonationMeta {
  impersonated: boolean;
  impersonated_by: string;
  impersonated_by_id?: string;
  impersonated_by_role?: string;
  impersonation_log_id?: string;
  brand_name?: string;
}

export interface LaunchSupplierImpersonationParams {
  apiUrl: string;
  token: string | null;
  brandId: string;
  supplierUserId?: string;
}

export async function launchSupplierImpersonationSession({
  apiUrl,
  token,
  brandId,
  supplierUserId,
}: LaunchSupplierImpersonationParams): Promise<{ ok: boolean; error?: string; brandName?: string }> {
  if (!token) {
    return { ok: false, error: "Yönetici oturumu bulunamadı." };
  }

  // Open blank tab synchronously on click handler to satisfy popup blockers.
  const popup = typeof window !== "undefined" ? window.open("about:blank", "_blank") : null;

  try {
    const res = await fetch(`${apiUrl}/api/v1/admin/suppliers/${brandId}/impersonate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(supplierUserId ? { supplier_user_id: supplierUserId } : {}),
    });

    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      token?: string;
      user?: Record<string, unknown>;
      impersonation?: SupplierImpersonationMeta;
    };

    if (!res.ok || !data.token || !data.user) {
      if (popup && !popup.closed) popup.close();
      return {
        ok: false,
        error: data.error || `Tedarikçi oturumu açılamadı (HTTP ${res.status})`,
      };
    }

    localStorage.setItem("supplier_token", data.token);
    localStorage.setItem("supplier_user", JSON.stringify(data.user));
    if (data.impersonation) {
      localStorage.setItem(SUPPLIER_IMPERSONATION_META_KEY, JSON.stringify(data.impersonation));
    } else {
      localStorage.removeItem(SUPPLIER_IMPERSONATION_META_KEY);
    }

    if (popup && !popup.closed) {
      popup.location.href = "/supplier";
    } else {
      window.location.href = "/supplier";
    }
    return { ok: true, brandName: data.impersonation?.brand_name };
  } catch (err) {
    if (popup && !popup.closed) popup.close();
    console.error("Supplier impersonation failed:", err);
    return { ok: false, error: "Tedarikçi oturumu başlatılırken sunucu hatası oluştu." };
  }
}

export function clearStoredSupplierImpersonationMeta(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(SUPPLIER_IMPERSONATION_META_KEY);
  }
}

export interface ProductActorMeta {
  label: string;
  shortLabel: string;
  badgeClass: string;
}

export function resolveProductActorMeta(actorType?: string, role?: string): ProductActorMeta {
  switch ((actorType || "").toLowerCase()) {
    case "admin_impersonation":
      return {
        label: role ? `Admin Tedarikçi Oturumu (${role})` : "Admin Tedarikçi Oturumu",
        shortLabel: "Admin Oturumu",
        badgeClass: "bg-amber-100 text-amber-800 border-amber-200",
      };
    case "supplier_owner":
      return {
        label: role ? `Tedarikçi Ana Hesap (${role})` : "Tedarikçi Ana Hesap",
        shortLabel: "Firma Sahibi",
        badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200",
      };
    case "supplier_sub_user":
      return {
        label: role ? `Alt Kullanıcı (${role})` : "Tedarikçi Alt Kullanıcı",
        shortLabel: role || "Alt Kullanıcı",
        badgeClass: "bg-indigo-100 text-indigo-800 border-indigo-200",
      };
    case "xml_feed":
      return {
        label: "XML Feed Entegrasyonu",
        shortLabel: "XML Feed",
        badgeClass: "bg-zinc-100 text-zinc-700 border-zinc-200",
      };
    case "admin_panel":
      return {
        label: "Admin Paneli",
        shortLabel: "Admin Paneli",
        badgeClass: "bg-violet-100 text-violet-800 border-violet-200",
      };
    default:
      return {
        label: "Eski / Belirtilmemiş Kayıt",
        shortLabel: "Eski Kayıt",
        badgeClass: "bg-zinc-100 text-zinc-500 border-zinc-200",
      };
  }
}
