"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Building2,
  ShieldCheck,
  Phone,
  Mail,
  Globe,
  MapPin,
  MessageCircle,
  CreditCard,
  CheckCircle2,
  Send,
  FileText,
  Lock,
} from "lucide-react";
import { Brand, Product } from "@/types/store";
import { showToast, trackBrandEvent } from "@/app/utils";
import {
  useIsStoreAuthenticated,
  useIsStoreMemberLoggedIn,
  openStoreAuthModal,
} from "@/app/storeAuth";

function normalizeWaPhone(raw?: string): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length === 11) {
    return "90" + digits.slice(1);
  }
  if (digits.length === 10 && digits.startsWith("5")) {
    return "90" + digits;
  }
  return digits;
}

const COMPANY_TYPE_LABELS: Record<string, string> = {
  uretici_toptanci: "Üretici & Toptan Satış",
  private_label: "Özel Etiket (Private Label) Üreticisi",
  fason_atolye: "Fason Üretim Atölyesi",
  kumas_tedarikcisi: "Kumaş Üreticisi & Tedarikçisi",
  aksesuar: "Tekstil Aksesuar & Yan Sanayi",
};

interface SupplierDirectCardProps {
  readonly product: Product;
  readonly pkgQty: number;
  readonly totalPieces: number;
  readonly totalPrice: number | string;
  readonly currency: string;
  readonly onOpenChat: () => void;
}

export default function SupplierDirectCard({
  product,
  pkgQty,
  totalPieces,
  totalPrice,
  currency,
  onOpenChat,
}: Readonly<SupplierDirectCardProps>) {
  const isAuthenticated = useIsStoreAuthenticated();
  const isMemberLoggedIn = useIsStoreMemberLoggedIn();
  const bp: Brand | undefined = product.brand_profile;
  const supplierName = bp?.name || product.brand_name || "Merter Üreticisi";
  const waRaw = bp?.whatsapp_phone || bp?.phone || "";
  const callRaw = bp?.phone || bp?.whatsapp_phone || "";
  const waDigits = normalizeWaPhone(waRaw);
  const companyTypeLabel =
    COMPANY_TYPE_LABELS[bp?.company_type || "uretici_toptanci"] ||
    "Üretici & Toptan Satış";
  const formattedTotalPrice =
    typeof totalPrice === "number" ? totalPrice.toFixed(2) : totalPrice;
  const numericUnitPrice =
    totalPieces > 0
      ? (typeof totalPrice === "number" ? totalPrice : Number(totalPrice) || 0) /
        totalPieces
      : product.discounted_price && product.discounted_price > 0
        ? product.discounted_price
        : product.price || 0;

  const directWaMessage = isAuthenticated
    ? `Merhaba *${supplierName}*,\nMerter Vitrini üzerindeki *${product.title}* (SKU: ${product.custom_sku || "-"}) ürününüz hakkında doğrudan iletişime geçmek ve sipariş vermek istiyorum.\n\n• Miktar: ${pkgQty} Seri (${totalPieces} Adet)\n• Toplam Tutar: ${formattedTotalPrice} ${currency}`
    : `Merhaba *${supplierName}*,\nMerter Vitrini üzerindeki *${product.title}* (SKU: ${product.custom_sku || "-"}) ürününüz hakkında doğrudan iletişime geçmek ve fiyat bilgisi almak istiyorum.\n\n• Miktar: ${pkgQty} Seri (${totalPieces} Adet)`;
  const directWaUrl = waDigits
    ? `https://wa.me/${waDigits}?text=${encodeURIComponent(directWaMessage)}`
    : `https://wa.me/?text=${encodeURIComponent(directWaMessage)}`;

  const [showContactForm, setShowContactForm] = useState(false);
  const [fullName, setFullName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [notes, setNotes] = useState("");
  const [sendingForm, setSendingForm] = useState(false);
  const [submittedOrderNo, setSubmittedOrderNo] = useState<string | null>(null);

  const handleSendDirectInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !buyerPhone.trim()) {
      showToast("Lütfen Ad Soyad ve Telefon/WhatsApp numaranızı girin.");
      return;
    }
    setSendingForm(true);
    try {
      const res = await fetch("/api/v1/store/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName.trim(),
          phone: buyerPhone.trim(),
          company_name: companyName.trim(),
          notes:
            notes.trim() ||
            `${product.title} (${pkgQty} Seri / ${totalPieces} Adet) için doğrudan tedarikçi iletişim formu mesajı.`,
          currency: currency || "TRY",
          items: [
            {
              product_id: product.id,
              title: product.title,
              custom_sku: product.custom_sku || "",
              series_ratio: product.series_ratio || "1",
              quantity: pkgQty || 1,
              price: numericUnitPrice,
            },
          ],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSubmittedOrderNo(data.order_number || "GÖNDERİLDİ");
        showToast(
          `Talebiniz doğrudan ${supplierName} tedarikçisine iletildi!`
        );
        if (data.whatsapp_url) {
          window.open(data.whatsapp_url, "_blank", "noopener,noreferrer");
        }
      } else {
        showToast("Mesaj gönderilirken bir hata oluştu.");
      }
    } catch {
      showToast("Bağlantı hatası oluştu.");
    } finally {
      setSendingForm(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
      {/* Header: Supplier Name + Verified Badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
            <Building2 size={18} />
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Link
                href={`/ureticiler/${encodeURIComponent(bp?.slug || product.brand_id)}`}
                className="text-xs font-extrabold text-slate-900 hover:text-salmon-pink uppercase tracking-wide no-underline transition-colors"
              >
                {supplierName}
              </Link>
              {(bp?.is_verified ?? true) && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                  <ShieldCheck size={11} />
                  <span>Doğrulanmış Üretici</span>
                </span>
              )}
            </div>
            <p className="text-[11px] font-semibold text-slate-500">
              {companyTypeLabel} • %0 Komisyon Doğrudan Tedarikçi İletişimi
            </p>
          </div>
        </div>

        <Link
          href={`/ureticiler/${encodeURIComponent(bp?.slug || product.brand_id)}`}
          className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-[10px] font-extrabold text-slate-800 no-underline shrink-0"
        >
          Firma Vitrini →
        </Link>
      </div>

      {/* Capabilities Badges */}
      {(bp?.supports_private_label || bp?.supports_fason || bp?.export_countries) && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {bp?.supports_private_label && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-bold text-slate-700">
              <CheckCircle2 size={11} className="text-emerald-600" />
              <span>Private Label (Özel Etiket)</span>
            </span>
          )}
          {bp?.supports_fason && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-bold text-slate-700">
              <CheckCircle2 size={11} className="text-emerald-600" />
              <span>Fason Üretim</span>
            </span>
          )}
          {bp?.export_countries && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-semibold text-slate-600">
              <span>İhracat: {bp.export_countries}</span>
            </span>
          )}
        </div>
      )}

      {bp?.description && (
        <p className="text-[11px] text-slate-600 leading-relaxed">
          {bp.description}
        </p>
      )}

      {/* Open Contact Details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700 pt-1">
        {waRaw && (
          <div className="flex items-center gap-1.5">
            <MessageCircle size={13} className="text-emerald-600 shrink-0" />
            <a
              href={directWaUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackBrandEvent(product.brand_id, "whatsapp_click", product.id)}
              className="font-extrabold hover:text-emerald-700 no-underline text-emerald-700"
            >
              WhatsApp: {waRaw}
            </a>
          </div>
        )}

        {callRaw && (
          <div className="flex items-center gap-1.5">
            <Phone size={13} className="text-slate-400 shrink-0" />
            <a
              href={`tel:${callRaw}`}
              onClick={() => trackBrandEvent(product.brand_id, "phone_click", product.id)}
              className="font-bold hover:text-salmon-pink no-underline text-slate-800"
            >
              Tel: {callRaw}
            </a>
          </div>
        )}

        {bp?.public_email && (
          <div className="flex items-center gap-1.5">
            <Mail size={13} className="text-slate-400 shrink-0" />
            <a
              href={`mailto:${bp.public_email}`}
              onClick={() => trackBrandEvent(product.brand_id, "email_click", product.id)}
              className="font-semibold hover:text-salmon-pink no-underline text-slate-700 truncate"
            >
              {bp.public_email}
            </a>
          </div>
        )}

        {bp?.website && (
          <div className="flex items-center gap-1.5">
            <Globe size={13} className="text-slate-400 shrink-0" />
            <a
              href={bp.website}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackBrandEvent(product.brand_id, "website_click", product.id)}
              className="font-semibold hover:text-salmon-pink no-underline text-slate-700 truncate"
            >
              {bp.website.replace(/^https?:\/\//, "")}
            </a>
          </div>
        )}

        {bp?.location_address && (
          <div className="flex items-start gap-1.5 sm:col-span-2">
            <MapPin size={13} className="text-slate-400 shrink-0 mt-0.5" />
            <span className="text-[11px] text-slate-600">
              {bp.location_address}
            </span>
          </div>
        )}
      </div>

      {/* Direct Bank / IBAN info if provided */}
      {bp?.iban && (
        <div className="bg-white rounded-lg p-2.5 border border-slate-200/90 text-[11px] space-y-0.5">
          <div className="font-bold text-slate-800 flex items-center gap-1.5">
            <CreditCard size={12} className="text-emerald-600" />
            <span>Tedarikçi Doğrudan Havale / EFT Bilgisi:</span>
          </div>
          {bp.bank_name && (
            <div className="text-slate-600">
              Banka: <strong className="text-slate-800">{bp.bank_name}</strong>
              {bp.bank_account_holder ? ` • Alıcı: ${bp.bank_account_holder}` : ""}
            </div>
          )}
          <div className="font-mono font-bold text-slate-900 select-all">
            {bp.iban}
          </div>
        </div>
      )}

      {/* Direct Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
        <a
          href={directWaUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackBrandEvent(product.brand_id, "whatsapp_click", product.id)}
          className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold transition-colors no-underline shadow-xs sm:col-span-2"
        >
          <MessageCircle size={16} />
          <span>
            WhatsApp ile Doğrudan Tedarikçiye Yaz {waRaw ? `(${waRaw})` : ""}
          </span>
        </a>

        <button
          type="button"
          onClick={() => setShowContactForm((prev) => !prev)}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-extrabold transition-colors cursor-pointer"
        >
          <FileText size={14} className="text-emerald-600" />
          <span>Doğrudan İletişim Formu</span>
        </button>

        <button
          type="button"
          onClick={isMemberLoggedIn ? onOpenChat : () => openStoreAuthModal("login")}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold transition-colors cursor-pointer"
        >
          {isMemberLoggedIn ? (
            <>
              <Building2 size={14} />
              <span>Canlı B2B Sohbet</span>
            </>
          ) : (
            <>
              <Lock size={14} />
              <span>Canlı Sohbet (Üyelere Özel)</span>
            </>
          )}
        </button>
      </div>

      {/* Expandable Direct Supplier Contact Form */}
      {showContactForm && (
        <form
          onSubmit={handleSendDirectInquiry}
          className="bg-white rounded-xl border border-emerald-200 p-3.5 space-y-2.5 mt-2 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-900">
              {supplierName} — Doğrudan Firma İletişim & Sipariş Formu
            </span>
            <button
              type="button"
              onClick={() => setShowContactForm(false)}
              className="text-[11px] font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              Kapat
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            Bilgilerinizi bırakın; talebiniz doğrudan üreticinin paneline düşsün ve WhatsApp hattına yönlendirilsin.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Adınız Soyadınız *"
              className="px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-emerald-500"
            />
            <input
              type="tel"
              required
              value={buyerPhone}
              onChange={(e) => setBuyerPhone(e.target.value)}
              placeholder="Telefon / WhatsApp No *"
              className="px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Firma / Butik Adınız (Opsiyonel)"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-emerald-500"
          />
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={`Mesajınız (${pkgQty} Seri / ${totalPieces} Adet için renk, beden veya özel üretim sorunuz)...`}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-emerald-500"
          />
          {submittedOrderNo && (
            <div className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              ✓ Talebiniz ({submittedOrderNo}) doğrudan {supplierName} firmasına iletildi!
            </div>
          )}
          <button
            type="submit"
            disabled={sendingForm}
            className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            <Send size={13} />
            <span>
              {sendingForm
                ? "Tedarikçiye İletiliyor..."
                : "Doğrudan Tedarikçiye Gönder & WhatsApp Başlat"}
            </span>
          </button>
        </form>
      )}
    </div>
  );
}


