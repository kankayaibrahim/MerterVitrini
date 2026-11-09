"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  FileText,
  Globe,
  Package,
  Phone,
  MessageCircle,
  Mail,
  Send,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";

interface SupplierRfqOffer {
  id: string;
  rfq_id: string;
  brand_id: string;
  brand_name: string;
  offered_unit_price: number;
  currency: string;
  min_order_quantity: number;
  delivery_days: number;
  notes: string;
  status: string;
  created_at: string;
}

interface SupplierBuyerRfqItem {
  id: string;
  rfq_number: string;
  title: string;
  category_name: string;
  target_quantity: number;
  unit_type: string;
  currency: string;
  production_type: string;
  description: string;
  buyer_name: string;
  buyer_company: string;
  buyer_country: string;
  buyer_phone: string;
  buyer_whatsapp: string;
  buyer_email: string;
  offer_count: number;
  my_offer?: SupplierRfqOffer;
  created_at: string;
}

const PRODUCTION_LABELS: Record<string, string> = {
  hazir_toptan: "Hazır Toptan Koleksiyon",
  private_label: "Private Label (Özel Etiket)",
  fason_uretim: "Fason Üretim Talebi",
  kumas_tedarik: "Kumaş & Aksesuar",
};

function normalizeWaPhone(raw?: string): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("0") && digits.length === 11) {
    return "90" + digits.slice(1);
  }
  if (digits.length === 10 && digits.startsWith("5")) {
    return "90" + digits;
  }
  return digits;
}

interface SupplierRfqCardProps {
  readonly item: SupplierBuyerRfqItem;
  readonly getToken: () => string | null;
  readonly onOfferSubmitted: () => void;
}

function SupplierRfqCard({
  item,
  getToken,
  onOfferSubmitted,
}: SupplierRfqCardProps) {
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [unitPrice, setUnitPrice] = useState(
    item.my_offer ? String(item.my_offer.offered_unit_price) : ""
  );
  const [currency, setCurrency] = useState(item.my_offer?.currency || "USD");
  const [moq, setMoq] = useState(
    item.my_offer ? String(item.my_offer.min_order_quantity) : "50"
  );
  const [deliveryDays, setDeliveryDays] = useState(
    item.my_offer ? String(item.my_offer.delivery_days) : "7"
  );
  const [notes, setNotes] = useState(item.my_offer?.notes || "");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");

  const prodLabel =
    PRODUCTION_LABELS[item.production_type] || "Hazır Toptan Koleksiyon";
  const waRaw = item.buyer_whatsapp || item.buyer_phone || "";
  const waDigits = normalizeWaPhone(waRaw);
  const directWaUrl = waDigits
    ? `https://wa.me/${waDigits}?text=${encodeURIComponent(
        `Merhaba ${item.buyer_name},\nMerter Vitrini üzerindeki "${item.title}" (${item.rfq_number}) alım talebiniz için üretici firma olarak iletişime geçiyoruz.`
      )}`
    : "";

  const handleSubmitOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getToken();
    if (!token || !unitPrice || Number(unitPrice) <= 0) return;

    setSubmitting(true);
    setFeedback("");
    try {
      const res = await fetch(`/api/v1/supplier/rfqs/${item.id}/offers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          offered_unit_price: Number(unitPrice),
          currency,
          min_order_quantity: Number(moq) || 1,
          delivery_days: Number(deliveryDays) || 7,
          notes: notes.trim(),
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { whatsapp_url?: string };
        setFeedback("Teklifiniz kaydedildi!");
        setShowOfferForm(false);
        onOfferSubmitted();
        if (data.whatsapp_url) {
          window.open(data.whatsapp_url, "_blank", "noopener,noreferrer");
        }
      } else {
        setFeedback("Teklif kaydedilemedi.");
      }
    } catch {
      setFeedback("Bağlantı hatası oluştu.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-md bg-slate-900 text-white text-[11px] font-mono font-bold">
              {item.rfq_number}
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200 text-[11px] font-bold">
              {prodLabel}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 text-[11px] font-bold">
              <Globe size={11} />
              <span>{item.buyer_country}</span>
            </span>
            {item.my_offer && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-extrabold">
                <CheckCircle2 size={11} />
                <span>
                  Teklif Verdiniz: {item.my_offer.offered_unit_price}{" "}
                  {item.my_offer.currency}
                </span>
              </span>
            )}
          </div>

          <h3 className="text-base font-extrabold text-slate-900">
            {item.title}
          </h3>
          {item.description && (
            <p className="text-xs text-slate-600 leading-relaxed">
              {item.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-extrabold">
            <Package size={14} />
            <span>
              {item.target_quantity} {item.unit_type}
            </span>
          </span>
        </div>
      </div>

      {/* Open Buyer Contact Info for Verified Supplier */}
      <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase block">
            Alıcı &amp; Firma
          </span>
          <span className="font-extrabold text-slate-900">
            {item.buyer_name}
            {item.buyer_company ? ` • ${item.buyer_company}` : ""}
          </span>
        </div>

        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase block">
            Doğrudan Telefon / WhatsApp
          </span>
          <a
            href={`tel:${item.buyer_phone}`}
            className="inline-flex items-center gap-1 font-extrabold text-emerald-700 no-underline"
          >
            <Phone size={12} />
            <span>{item.buyer_phone}</span>
          </a>
        </div>

        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase block">
            E-Posta
          </span>
          <span className="font-semibold text-slate-700">
            {item.buyer_email ? (
              <a
                href={`mailto:${item.buyer_email}`}
                className="inline-flex items-center gap-1 text-slate-700 no-underline"
              >
                <Mail size={12} />
                <span>{item.buyer_email}</span>
              </a>
            ) : (
              "-"
            )}
          </span>
        </div>
      </div>

      {feedback && (
        <div className="text-xs font-bold text-emerald-700">{feedback}</div>
      )}

      {/* Action Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <span className="text-[11px] font-semibold text-slate-500">
          Kategori: <strong>{item.category_name || "Genel Tekstil"}</strong> •{" "}
          Toplam Teklif: <strong>{item.offer_count}</strong>
        </span>

        <div className="flex flex-wrap items-center gap-2">
          {directWaUrl && (
            <a
              href={directWaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold no-underline"
            >
              <MessageCircle size={14} />
              <span>Alıcıya WhatsApp&apos;tan Yaz</span>
            </a>
          )}

          <button
            type="button"
            onClick={() => setShowOfferForm((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold cursor-pointer"
          >
            <Send size={13} />
            <span>
              {item.my_offer ? "Teklifimi Güncelle" : "Fiyat Teklifi Ver"}
            </span>
          </button>
        </div>
      </div>

      {showOfferForm && (
        <form
          onSubmit={handleSubmitOffer}
          className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3 text-xs"
        >
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Birim Fiyat *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.1"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="12.50"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                required
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Para Birimi
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="TRY">TRY (₺)</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Min. Sipariş Adedi
              </label>
              <input
                type="number"
                min={1}
                value={moq}
                onChange={(e) => setMoq(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Teslim Süresi (Gün)
              </label>
              <input
                type="number"
                min={1}
                value={deliveryDays}
                onChange={(e) => setDeliveryDays(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Teklif Notunuz (Kumaş kalitesi, ödeme ve üretim detayı)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Örn: Merter showroomumuzda numuneler mevcuttur, kendi etiketinizle dikebiliriz."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowOfferForm(false)}
              className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-bold cursor-pointer"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold cursor-pointer disabled:opacity-50"
            >
              {submitting
                ? "Gönderiliyor..."
                : "Teklifi Kaydet & WhatsApp ile Alıcıya Gönder"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

interface SupplierRfqListBodyProps {
  readonly loading: boolean;
  readonly items: readonly SupplierBuyerRfqItem[];
  readonly getToken: () => string | null;
  readonly onOfferSubmitted: () => void;
}

function SupplierRfqListBody({
  loading,
  items,
  getToken,
  onOfferSubmitted,
}: SupplierRfqListBodyProps) {
  if (loading) {
    return (
      <div className="py-16 text-center text-xs font-bold text-slate-400">
        Alıcı talep ilanları yükleniyor...
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-xs font-semibold text-slate-500">
        Şu an aktif alıcı talep ilanı (RFQ) bulunmuyor.
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {items.map((item) => (
        <SupplierRfqCard
          key={item.id}
          item={item}
          getToken={getToken}
          onOfferSubmitted={onOfferSubmitted}
        />
      ))}
    </div>
  );
}

export default function SupplierRfqPanel({
  getToken,
}: {
  readonly getToken: () => string | null;
}) {
  const [items, setItems] = useState<SupplierBuyerRfqItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadSupplierRfqs = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch("/api/v1/supplier/rfqs", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = (await res.json()) as SupplierBuyerRfqItem[];
        setItems(data || []);
      }
    } catch {
      // Keep existing state on error
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadSupplierRfqs();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadSupplierRfqs]);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
            <FileText size={20} />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-900">
              Alıcı Talep Panosu (B2B Alım İlanları / RFQ)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Küresel alıcıların açtığı toptan alım, Private Label ve fason üretim ilanlarına doğrudan teklif verin ve alıcının WhatsApp/telefon numarasıyla aracısız iletişime geçin.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void loadSupplierRfqs()}
          className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
          title="Yenile"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <SupplierRfqListBody
        loading={loading}
        items={items}
        getToken={getToken}
        onOfferSubmitted={() => void loadSupplierRfqs()}
      />
    </div>
  );
}

