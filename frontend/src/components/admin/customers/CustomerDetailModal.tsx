"use client";

import React from "react";
import {
  Activity,
  AtSign,
  Ban,
  Calendar,
  CheckCircle2,
  CreditCard,
  Eye,
  FileText,
  Globe,
  History,
  Loader2,
  LogIn,
  Mail,
  MapPin,
  Network,
  Phone,
  ShieldAlert,
  ShoppingBag,
  ShoppingCart,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";
import CountryFlagBadge from "../analytics/CountryFlagBadge";
import { CustomerUnfinishedCartSection } from "./CustomerUnfinishedCartSection";
import {
  Customer,
  formatCurrencyTry,
  formatDateTimeTr,
  formatRelativeTimeTr,
  geoSourceLabelTr,
} from "./customerTypes";

interface CustomerDetailModalProps {
  customer: Customer | null;
  apiUrl: string;
  token: string | null;
  impersonatingId: string | null;
  onClose: () => void;
  onOpenJourney: (customer: Customer) => void;
  onToggleBlock: (customer: Customer) => void;
  onRequestDelete: (customer: Customer) => void;
  onImpersonate: (customer: Customer, openCart?: boolean) => void;
}

export function CustomerDetailModal({
  customer,
  apiUrl,
  token,
  impersonatingId,
  onClose,
  onOpenJourney,
  onToggleBlock,
  onRequestDelete,
  onImpersonate,
}: CustomerDetailModalProps) {
  if (!customer) return null;

  const locationTitle = [customer.city, customer.region_name, customer.country_name]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl border border-zinc-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-zinc-100 flex items-start justify-between gap-4 bg-zinc-50/70">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-lg shrink-0">
              {(customer.first_name || customer.email || "?").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-zinc-900 truncate">
                  {customer.first_name} {customer.last_name}
                </h2>
                {customer.country_code && (
                  <CountryFlagBadge
                    countryCode={customer.country_code}
                    title={customer.country_name || customer.country_code}
                  />
                )}
                {customer.is_online && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Çevrimiçi
                  </span>
                )}
                {customer.is_blocked ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                    Blokeli
                  </span>
                ) : customer.email_verified ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                    Onaylı Üye
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700">
                    Onaysız
                  </span>
                )}
              </div>
              <div className="text-xs text-zinc-500 font-mono truncate mt-0.5">
                {customer.email} • ID: {customer.id}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/70 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {customer.is_blocked && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs text-rose-800">
                <div className="font-bold text-rose-950">Bu hesap erişime kapatılmıştır</div>
                <p className="mt-1">Sebep: {customer.block_reason || "Sebep belirtilmemiş."}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100">
              <div className="text-[11px] font-semibold text-indigo-700 flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5" /> Sipariş &amp; Talep
              </div>
              <div className="text-xl font-bold text-zinc-900 mt-1 tabular-nums">
                {customer.orders_count}
              </div>
              <div className="text-[11px] text-zinc-600 font-medium tabular-nums">
                {formatCurrencyTry(customer.orders_total_amount)}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-100">
              <div className="text-[11px] font-semibold text-amber-800 flex items-center gap-1.5">
                <ShoppingCart className="w-3.5 h-3.5" /> Aktif Sepet
              </div>
              <div className="text-xl font-bold text-zinc-900 mt-1 tabular-nums">
                {customer.cart_items_count}
              </div>
              <div className="text-[11px] text-zinc-600 font-medium">ürün sepette</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-sky-50/70 border border-sky-100">
              <div className="text-[11px] font-semibold text-sky-800 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" /> Etkileşim
              </div>
              <div className="text-xl font-bold text-zinc-900 mt-1 tabular-nums">
                {customer.products_viewed}
              </div>
              <div className="text-[11px] text-zinc-600 font-medium tabular-nums">
                ürün • {customer.pages_read} sayfa
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100">
              <div className="text-[11px] font-semibold text-emerald-800 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" /> Son Aktiflik
              </div>
              <div className="text-sm font-bold text-zinc-900 mt-1.5">
                {formatRelativeTimeTr(customer.last_active_at || customer.last_login_at)}
              </div>
              <div className="text-[10px] text-zinc-600 font-medium truncate">
                {customer.last_event_title || "Son hareket kaydedildi"}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/70 space-y-2.5 text-xs">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                Kimlik &amp; İletişim
              </h3>
              <div className="flex justify-between gap-2">
                <span className="text-zinc-500 inline-flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" /> Telefon
                </span>
                <span className="font-semibold text-zinc-900 font-mono">
                  {customer.phone || "Belirtilmemiş"}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-zinc-500 inline-flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" /> E-Posta Onayı
                </span>
                <span className="font-semibold text-zinc-900 inline-flex items-center gap-1">
                  {customer.email_verified ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Doğrulandı
                    </>
                  ) : (
                    "Bekliyor"
                  )}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-zinc-500 inline-flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Kayıt Tarihi
                </span>
                <span className="font-semibold text-zinc-900">
                  {formatDateTimeTr(customer.created_at)}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-zinc-500 inline-flex items-center gap-1.5">
                  <AtSign className="w-3.5 h-3.5" /> Instagram
                </span>
                <span className="font-semibold text-zinc-900">
                  {customer.instagram_username ? `@${customer.instagram_username}` : "-"}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/70 space-y-2.5 text-xs">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                Coğrafya, Tercih &amp; Fatura
              </h3>
              <div className="flex justify-between gap-2">
                <span className="text-zinc-500 inline-flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> Tespit Edilen Konum
                </span>
                <span className="font-semibold text-zinc-900 text-right">
                  {locationTitle || "Çözümlenmedi"}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-zinc-500 inline-flex items-center gap-1.5">
                  <Network className="w-3.5 h-3.5" /> Konum Kaynağı / IP
                </span>
                <span className="font-semibold text-zinc-900 font-mono text-right">
                  {geoSourceLabelTr(customer.geo_source)} • {customer.registration_ip || "-"}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-zinc-500 inline-flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" /> Dil / Para Birimi
                </span>
                <span className="font-semibold text-zinc-900 uppercase">
                  {customer.preferred_lang || "TR"} /{" "}
                  <CreditCard className="w-3.5 h-3.5 inline mx-0.5 text-zinc-500" />
                  {customer.preferred_currency || "TRY"}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-zinc-500 inline-flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> Vergi / TCKN
                </span>
                <span className="font-semibold text-zinc-900 font-mono">
                  {customer.tax_no_tckn || "-"}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
            <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/70">
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                Teslimat Adresi
              </div>
              <p className="text-zinc-700 leading-relaxed">
                {customer.delivery_address || "Kayıtlı teslimat adresi bulunmuyor."}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/70">
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                Fatura Adresi
              </div>
              <p className="text-zinc-700 leading-relaxed">
                {customer.billing_address || "Kayıtlı fatura adresi bulunmuyor."}
              </p>
            </div>
          </div>

          <CustomerUnfinishedCartSection
            customer={customer}
            apiUrl={apiUrl}
            token={token}
            impersonating={impersonatingId === customer.id}
            onImpersonateWithCart={() => onImpersonate(customer, true)}
          />

          <div>
            <h3 className="text-xs font-bold text-zinc-900 mb-2.5 flex items-center gap-1.5">
              <History className="w-4 h-4 text-zinc-500" />
              Giriş Geçmişi ({customer.login_history?.length ?? 0} oturum)
            </h3>
            {!customer.login_history || customer.login_history.length === 0 ? (
              <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/70 text-xs text-zinc-500 text-center">
                Henüz giriş kaydı bulunmuyor.
              </div>
            ) : (
              <div className="rounded-2xl border border-zinc-200 overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500">
                    <tr>
                      <th className="py-2 px-4 font-semibold">Tarih &amp; Saat</th>
                      <th className="py-2 px-4 font-semibold text-right">IP Adresi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {customer.login_history.map((log, idx) => (
                      <tr key={`${log.login_at}-${idx}`} className="hover:bg-zinc-50/70">
                        <td className="py-2 px-4 text-zinc-800">
                          {formatDateTimeTr(log.login_at)}
                        </td>
                        <td className="py-2 px-4 text-right font-mono text-zinc-600">
                          {log.ip_address || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={customer.is_blocked || impersonatingId === customer.id}
              onClick={() => onImpersonate(customer, false)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              {impersonatingId === customer.id ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <LogIn className="w-3.5 h-3.5" />
              )}
              Vitrine Müşteri Adına Gir
            </button>
            <button
              type="button"
              onClick={() => onOpenJourney(customer)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              <Activity className="w-3.5 h-3.5" />
              Müşteri Yolculuğunu İncele
            </button>
            <button
              type="button"
              onClick={() => onToggleBlock(customer)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                customer.is_blocked
                  ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200"
                  : "bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200"
              }`}
            >
              {customer.is_blocked ? (
                <>
                  <UserCheck className="w-3.5 h-3.5" /> Engeli Kaldır
                </>
              ) : (
                <>
                  <Ban className="w-3.5 h-3.5" /> Hesabı Blokla
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => onRequestDelete(customer)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Kalıcı Sil
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-700 text-xs font-semibold transition-colors cursor-pointer"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
