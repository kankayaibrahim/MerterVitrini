"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  CreditCard,
  Receipt,
  Wallet,
  Infinity as InfinityIcon,
  CheckCircle2,
  XCircle,
  Plus,
  RefreshCw,
  FileText,
  Edit3,
} from "lucide-react";

interface SubscriptionRow {
  id: string;
  brand_id: string;
  brand_name: string;
  alias_code: string;
  plan_code: string;
  plan_name: string;
  billing_cycle: string;
  status: string;
  is_complimentary: boolean;
  agreed_price: number;
  currency: string;
  max_products: number;
  active_products_count: number;
  current_period_end: string;
  total_paid_amount: number;
  total_invoiced_amount: number;
  outstanding_balance: number;
  billing_company_title: string;
  tax_office: string;
  tax_number: string;
  billing_address: string;
  billing_email: string;
  story_entitlement_override?: boolean | null;
  story_daily_limit_override?: number | null;
}

interface InvoiceRow {
  id: string;
  invoice_number: string;
  brand_id: string;
  brand_name: string;
  invoice_type: string;
  plan_code: string;
  period_label: string;
  subtotal_amount: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  currency: string;
  status: string;
  issue_date: string;
}

interface PaymentRow {
  id: string;
  payment_number: string;
  brand_id: string;
  brand_name: string;
  invoice_number?: string;
  plan_code: string;
  period_months: number;
  amount: number;
  currency: string;
  payment_method: string;
  status: string;
  sender_name: string;
  bank_reference: string;
  notes: string;
  paid_at: string;
}

interface LedgerRow {
  id: string;
  brand_id: string;
  brand_name: string;
  entry_type: string;
  debit_amount: number;
  credit_amount: number;
  running_balance: number;
  currency: string;
  description: string;
  created_at: string;
}

interface SummaryStats {
  total_collected_amount: number;
  total_invoiced_amount: number;
  total_outstanding_amount: number;
  pending_payments_count: number;
  total_suppliers_count: number;
  paid_suppliers_count: number;
  free_suppliers_count: number;
}

interface SupplierBillingAdminSectionProps {
  readonly apiUrl: string;
  readonly token: string | null;
}

export default function SupplierBillingAdminSection({
  apiUrl,
  token,
}: Readonly<SupplierBillingAdminSectionProps>) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Active action modal
  const [modalMode, setModalMode] = useState<"payment" | "invoice" | "plan" | null>(null);
  const [selectedBrandId, setSelectedBrandId] = useState("");
  const [selectedBrandName, setSelectedBrandName] = useState("");

  // Payment/Invoice/Plan form fields
  const [planCode, setPlanCode] = useState("PRO");
  const [periodMonths, setPeriodMonths] = useState(1);
  const [amount, setAmount] = useState("990");
  const [senderName, setSenderName] = useState("");
  const [bankRef, setBankRef] = useState("");
  const [autoInvoice, setAutoInvoice] = useState(true);
  const [periodLabel, setPeriodLabel] = useState("Aylık Vitrin Aboneliği");
  const [markPaid, setMarkPaid] = useState(true);
  const [isComplimentary, setIsComplimentary] = useState(true);
  const [taxOffice, setTaxOffice] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [billingTitle, setBillingTitle] = useState("");
  const [storyOverrideMode, setStoryOverrideMode] = useState<"auto" | "allow" | "deny">("auto");
  const [storyDailyLimitOverride, setStoryDailyLimitOverride] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadOverview = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/v1/admin/billing/overview`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary || null);
        setSubscriptions(data.subscriptions || []);
        setInvoices(data.invoices || []);
        setPayments(data.payments || []);
        setLedger(data.ledger || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [apiUrl, token]);

  useEffect(() => {
    let ignore = false;
    const init = async () => {
      if (!ignore) await loadOverview(false);
    };
    void init();
    return () => {
      ignore = true;
    };
  }, [loadOverview]);

  const openPaymentModal = (row: SubscriptionRow) => {
    setSelectedBrandId(row.brand_id);
    setSelectedBrandName(row.brand_name);
    setPlanCode(row.plan_code === "FREE" ? "PRO" : row.plan_code);
    setPeriodMonths(1);
    setAmount(row.plan_code === "PREMIUM" ? "2490" : "990");
    setSenderName(row.billing_company_title || row.brand_name);
    setBankRef("");
    setAutoInvoice(true);
    setNotes("");
    setModalMode("payment");
  };

  const openInvoiceModal = (row: SubscriptionRow) => {
    setSelectedBrandId(row.brand_id);
    setSelectedBrandName(row.brand_name);
    setPlanCode(row.plan_code === "FREE" ? "PRO" : row.plan_code);
    setPeriodLabel(`${row.brand_name} - Aylık B2B Vitrin & Tanıtım Hizmet Bedeli`);
    setAmount(row.plan_code === "PREMIUM" ? "2490" : "990");
    setMarkPaid(true);
    setNotes("");
    setModalMode("invoice");
  };

  const openPlanModal = (row: SubscriptionRow) => {
    setSelectedBrandId(row.brand_id);
    setSelectedBrandName(row.brand_name);
    setPlanCode(row.plan_code);
    setIsComplimentary(row.is_complimentary);
    setAmount(String(row.agreed_price || 0));
    setBillingTitle(row.billing_company_title || row.brand_name);
    setTaxOffice(row.tax_office || "");
    setTaxNumber(row.tax_number || "");
    if (row.story_entitlement_override === true) {
      setStoryOverrideMode("allow");
    } else if (row.story_entitlement_override === false) {
      setStoryOverrideMode("deny");
    } else {
      setStoryOverrideMode("auto");
    }
    setStoryDailyLimitOverride(
      typeof row.story_daily_limit_override === "number"
        ? String(row.story_daily_limit_override)
        : ""
    );
    setPeriodMonths(0);
    setNotes("");
    setModalMode("plan");
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await fetch(`${apiUrl}/api/v1/admin/billing/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          brand_id: selectedBrandId,
          plan_code: planCode,
          period_months: periodMonths,
          amount: Number(amount) || 0,
          payment_method: "BANK_TRANSFER",
          sender_name: senderName,
          bank_reference: bankRef,
          auto_create_invoice: autoInvoice,
          notes,
        }),
      });
      if (res.ok) {
        setMsg({ type: "ok", text: "Tedarikçi ödemesi ve muhasebe kaydı başarıyla işlendi." });
        setModalMode(null);
        void loadOverview();
      } else {
        setMsg({ type: "err", text: "Ödeme kaydedilemedi." });
      }
    } catch {
      setMsg({ type: "err", text: "Sunucu bağlantı hatası." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);
    try {
      const totalAmt = Number(amount) || 0;
      const subtotalAmt = Math.round((totalAmt / 1.2) * 100) / 100;
      const res = await fetch(`${apiUrl}/api/v1/admin/billing/invoices`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          brand_id: selectedBrandId,
          invoice_type: "SUBSCRIPTION",
          plan_code: planCode,
          period_label: periodLabel,
          subtotal_amount: subtotalAmt,
          tax_rate: 20,
          discount_amount: 0,
          mark_as_paid: markPaid,
          payment_method: "BANK_TRANSFER",
          notes,
        }),
      });
      if (res.ok) {
        setMsg({ type: "ok", text: "Fatura kesildi ve cari muhasebe defterine işlendi." });
        setModalMode(null);
        void loadOverview();
      } else {
        setMsg({ type: "err", text: "Fatura oluşturulamadı." });
      }
    } catch {
      setMsg({ type: "err", text: "Sunucu bağlantı hatası." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);
    let storyOverrideValue: boolean | null = null;
    if (storyOverrideMode === "allow") storyOverrideValue = true;
    else if (storyOverrideMode === "deny") storyOverrideValue = false;
    const parsedLimit = Number(storyDailyLimitOverride);
    const storyLimitValue =
      storyDailyLimitOverride.trim() !== "" && parsedLimit >= 1 && parsedLimit <= 50
        ? Math.round(parsedLimit)
        : null;
    try {
      const res = await fetch(
        `${apiUrl}/api/v1/admin/billing/subscriptions/${selectedBrandId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            plan_code: planCode,
            billing_cycle: isComplimentary ? "PROMO_FREE" : "MONTHLY",
            status: "ACTIVE",
            is_complimentary: isComplimentary,
            agreed_price: Number(amount) || 0,
            extend_months: periodMonths,
            billing_company_title: billingTitle,
            tax_office: taxOffice,
            tax_number: taxNumber,
            story_entitlement_override: storyOverrideValue,
            story_daily_limit_override: storyLimitValue,
            notes,
          }),
        }
      );
      if (res.ok) {
        setMsg({ type: "ok", text: "Tedarikçi paketi ve muafiyet durumu güncellendi." });
        setModalMode(null);
        void loadOverview();
      } else {
        setMsg({ type: "err", text: "Paket güncellenemedi." });
      }
    } catch {
      setMsg({ type: "err", text: "Sunucu bağlantı hatası." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleProcessPendingPayment = async (
    paymentId: string,
    newStatus: "COMPLETED" | "REJECTED"
  ) => {
    try {
      const res = await fetch(
        `${apiUrl}/api/v1/admin/billing/payments/${paymentId}/status`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ status: newStatus }),
        }
      );
      if (res.ok) {
        setMsg({
          type: "ok",
          text:
            newStatus === "COMPLETED"
              ? "Ödeme onaylandı, fatura kesildi ve cari bakiyeye işlendi."
              : "Ödeme bildirimi reddedildi.",
        });
        void loadOverview();
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      {msg && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center justify-between ${
            msg.type === "ok"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          <span>{msg.text}</span>
          <button
            type="button"
            onClick={() => setMsg(null)}
            className="underline cursor-pointer"
          >
            Kapat
          </button>
        </div>
      )}

      {/* Top Summary Banner & KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-zinc-200/80 p-4 shadow-xs">
          <div className="flex items-center justify-between text-zinc-400 mb-1">
            <span className="text-[11px] font-bold uppercase">
              Toplam Tahsilat (Ödenen)
            </span>
            <Wallet size={16} className="text-emerald-600" />
          </div>
          <div className="text-xl font-black text-emerald-700">
            {(summary?.total_collected_amount ?? 0).toLocaleString("tr-TR", {
              minimumFractionDigits: 2,
            })}{" "}
            TRY
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            Tedarikçilerin ödediği toplam abonelik/reklam tutarı
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-zinc-200/80 p-4 shadow-xs">
          <div className="flex items-center justify-between text-zinc-400 mb-1">
            <span className="text-[11px] font-bold uppercase">
              Toplam Kesilen Fatura
            </span>
            <Receipt size={16} className="text-violet-600" />
          </div>
          <div className="text-xl font-black text-zinc-900">
            {(summary?.total_invoiced_amount ?? 0).toLocaleString("tr-TR", {
              minimumFractionDigits: 2,
            })}{" "}
            TRY
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            Toplam {invoices.length} adet fatura kaydı
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-zinc-200/80 p-4 shadow-xs">
          <div className="flex items-center justify-between text-zinc-400 mb-1">
            <span className="text-[11px] font-bold uppercase">
              Bekleyen Cari Alacak
            </span>
            <CreditCard size={16} className="text-amber-600" />
          </div>
          <div className="text-xl font-black text-amber-700">
            {(summary?.total_outstanding_amount ?? 0).toLocaleString("tr-TR", {
              minimumFractionDigits: 2,
            })}{" "}
            TRY
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            Onay bekleyen ödeme: {summary?.pending_payments_count ?? 0} adet
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-zinc-200/80 p-4 shadow-xs">
          <div className="flex items-center justify-between text-zinc-400 mb-1">
            <span className="text-[11px] font-bold uppercase">
              Ürün Kotası &amp; Paket Durumu
            </span>
            <InfinityIcon size={16} className="text-blue-600" />
          </div>
          <div className="text-base font-black text-zinc-900">
            Sınırsız Ürün (Kota Yok)
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            {summary?.free_suppliers_count ?? 0} Ücretsiz •{" "}
            {summary?.paid_suppliers_count ?? 0} Ücretli Abone
          </div>
        </div>
      </div>

      {/* Suppliers Accounting & Subscription Table */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 overflow-hidden shadow-xs">
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-sm font-extrabold text-zinc-900">
              Tedarikçi Abonelik, Cari Muhasebe &amp; Faturalandırma Tablosu
            </h3>
            <p className="text-xs text-zinc-500">
              Şu an tüm tedarikçiler ücretsiz &amp; sınırsız ürün yükleme hakkına sahiptir. Aylık ödeme yapan tedarikçilerin tahsilatlarını ve faturalarını buradan işleyebilirsiniz.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadOverview()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-50 cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            <span>Yenile</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-[10px] font-bold uppercase text-zinc-500">
              <tr>
                <th className="py-3 px-4">Tedarikçi Firma</th>
                <th className="py-3 px-4">Aktif Paket &amp; Kota</th>
                <th className="py-3 px-4">Vergi Dairesi / VKN</th>
                <th className="py-3 px-4 text-right">Ne Kadar Ödedi</th>
                <th className="py-3 px-4 text-right">Kesilen Fatura</th>
                <th className="py-3 px-4 text-right">Cari Bakiye</th>
                <th className="py-3 px-4 text-right">Muhasebe İşlemleri</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {subscriptions.map((row) => (
                <tr key={row.brand_id} className="hover:bg-zinc-50/60">
                  <td className="py-3 px-4">
                    <div className="font-bold text-zinc-900">{row.brand_name}</div>
                    <div className="text-[11px] text-zinc-400">
                      Kod: {row.alias_code} • {row.active_products_count} Ürün (Sınırsız Kota)
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 font-bold text-[10px]">
                      {row.plan_name}
                    </span>
                    <div className="text-[10px] text-emerald-600 font-bold mt-0.5">
                      {row.is_complimentary
                        ? "Şimdilik Ücretsiz (Muaf)"
                        : `${row.agreed_price.toFixed(2)} ${row.currency}/Ay`}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-zinc-600">
                    {row.tax_office || row.tax_number ? (
                      <div>
                        <div className="font-semibold text-zinc-800">
                          {row.billing_company_title || row.brand_name}
                        </div>
                        <div className="text-[10px] text-zinc-500">
                          {row.tax_office} / {row.tax_number}
                        </div>
                      </div>
                    ) : (
                      <span className="text-[11px] text-zinc-400">Girilmedi</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right font-extrabold text-emerald-700">
                    {row.total_paid_amount.toLocaleString("tr-TR", {
                      minimumFractionDigits: 2,
                    })}{" "}
                    {row.currency}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-zinc-800">
                    {row.total_invoiced_amount.toLocaleString("tr-TR", {
                      minimumFractionDigits: 2,
                    })}{" "}
                    {row.currency}
                  </td>
                  <td className="py-3 px-4 text-right font-extrabold text-zinc-900">
                    {row.outstanding_balance.toLocaleString("tr-TR", {
                      minimumFractionDigits: 2,
                    })}{" "}
                    {row.currency}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex items-center gap-1.5 flex-wrap justify-end">
                      <button
                        type="button"
                        onClick={() => openPaymentModal(row)}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer inline-flex items-center gap-1"
                      >
                        <Plus size={12} />
                        <span>Ödeme İşle</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openInvoiceModal(row)}
                        className="px-2.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-bold cursor-pointer inline-flex items-center gap-1"
                      >
                        <FileText size={12} />
                        <span>Fatura Kes</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openPlanModal(row)}
                        className="px-2.5 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-100 text-zinc-700 text-[11px] font-bold cursor-pointer inline-flex items-center gap-1"
                      >
                        <Edit3 size={12} />
                        <span>Paket/Vergi</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoices & Payments Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payments Table */}
        <div className="bg-white rounded-2xl border border-zinc-200/80 overflow-hidden shadow-xs">
          <div className="px-4 py-3 border-b border-zinc-100">
            <h4 className="text-xs font-extrabold text-zinc-900 uppercase">
              Tedarikçi Ödemeleri &amp; Tahsilat Kayıtları ({payments.length})
            </h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-[10px] font-bold uppercase text-zinc-500">
                <tr>
                  <th className="py-2.5 px-3">Tahsilat No</th>
                  <th className="py-2.5 px-3">Firma / Paket</th>
                  <th className="py-2.5 px-3">Tutar</th>
                  <th className="py-2.5 px-3">Durum / İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-zinc-400">
                      Henüz tahsilat kaydı bulunmuyor.
                    </td>
                  </tr>
                ) : (
                  payments.map((pay) => (
                    <tr key={pay.id}>
                      <td className="py-2.5 px-3 font-mono font-bold text-zinc-900">
                        {pay.payment_number}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-zinc-800">{pay.brand_name}</div>
                        <div className="text-[10px] text-zinc-500">
                          {pay.plan_code} ({pay.period_months} Ay)
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-extrabold text-emerald-700">
                        {pay.amount.toFixed(2)} {pay.currency}
                      </td>
                      <td className="py-2.5 px-3">
                        {pay.status === "PENDING_APPROVAL" ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                void handleProcessPendingPayment(pay.id, "COMPLETED")
                              }
                              className="px-2 py-1 rounded bg-emerald-600 text-white text-[10px] font-bold cursor-pointer inline-flex items-center gap-0.5"
                            >
                              <CheckCircle2 size={11} />
                              <span>Onayla</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void handleProcessPendingPayment(pay.id, "REJECTED")
                              }
                              className="px-2 py-1 rounded bg-red-600 text-white text-[10px] font-bold cursor-pointer inline-flex items-center gap-0.5"
                            >
                              <XCircle size={11} />
                              <span>Reddet</span>
                            </button>
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                            {pay.status === "COMPLETED" ? "ONAYLANDI" : pay.status}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Invoices Table */}
        <div className="bg-white rounded-2xl border border-zinc-200/80 overflow-hidden shadow-xs">
          <div className="px-4 py-3 border-b border-zinc-100">
            <h4 className="text-xs font-extrabold text-zinc-900 uppercase">
              Kesilen Tedarikçi Faturaları ({invoices.length})
            </h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-[10px] font-bold uppercase text-zinc-500">
                <tr>
                  <th className="py-2.5 px-3">Fatura No</th>
                  <th className="py-2.5 px-3">Tedarikçi / Açıklama</th>
                  <th className="py-2.5 px-3">KDV Dahil</th>
                  <th className="py-2.5 px-3">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-zinc-400">
                      Henüz kesilmiş fatura bulunmuyor.
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td className="py-2.5 px-3 font-mono font-bold text-zinc-900">
                        {inv.invoice_number}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-zinc-800">{inv.brand_name}</div>
                        <div className="text-[10px] text-zinc-500">{inv.period_label}</div>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-zinc-900">
                        {inv.total_amount.toFixed(2)} {inv.currency}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            inv.status === "PAID"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {inv.status === "PAID" ? "ÖDENDİ" : inv.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 overflow-hidden shadow-xs">
        <div className="px-4 py-3 border-b border-zinc-100">
          <h4 className="text-xs font-extrabold text-zinc-900 uppercase">
            Tedarikçi Muhasebe Cari Defteri (Borç / Alacak Hareketleri)
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-[10px] font-bold uppercase text-zinc-500">
              <tr>
                <th className="py-2.5 px-3">Tarih</th>
                <th className="py-2.5 px-3">Tedarikçi</th>
                <th className="py-2.5 px-3">Açıklama</th>
                <th className="py-2.5 px-3 text-right">Borç (Tahakkuk)</th>
                <th className="py-2.5 px-3 text-right">Alacak (Ödenen)</th>
                <th className="py-2.5 px-3 text-right">Cari Bakiye</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {ledger.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-zinc-400">
                    Henüz muhasebe defter hareketi bulunmuyor.
                  </td>
                </tr>
              ) : (
                ledger.map((l) => (
                  <tr key={l.id}>
                    <td className="py-2.5 px-3 text-zinc-500">
                      {new Date(l.created_at).toLocaleDateString("tr-TR")}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-zinc-900">{l.brand_name}</td>
                    <td className="py-2.5 px-3 text-zinc-700">{l.description}</td>
                    <td className="py-2.5 px-3 text-right font-semibold text-zinc-800">
                      {l.debit_amount > 0 ? `${l.debit_amount.toFixed(2)} ${l.currency}` : "-"}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                      {l.credit_amount > 0 ? `${l.credit_amount.toFixed(2)} ${l.currency}` : "-"}
                    </td>
                    <td className="py-2.5 px-3 text-right font-extrabold text-zinc-900">
                      {l.running_balance.toFixed(2)} {l.currency}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Record Payment / Issue Invoice / Edit Plan */}
      {modalMode && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-zinc-200 max-w-lg w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-sm font-extrabold text-zinc-900">
                {modalMode === "payment"
                  ? `${selectedBrandName} — Tedarikçi Ödemesi / Tahsilat Gir`
                  : modalMode === "invoice"
                    ? `${selectedBrandName} — Yeni Fatura Kes`
                    : `${selectedBrandName} — Paket, Muafiyet & Vergi Ayarları`}
              </h3>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="text-xs font-bold text-zinc-400 hover:text-zinc-700 cursor-pointer"
              >
                Kapat
              </button>
            </div>

            {modalMode === "payment" && (
              <form onSubmit={handleRecordPayment} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-zinc-700 mb-1">Paket</label>
                    <select
                      value={planCode}
                      onChange={(e) => setPlanCode(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-zinc-300"
                    >
                      <option value="PRO">Profesyonel Vitrin (990 TL)</option>
                      <option value="PREMIUM">Premium Vitrin (2.490 TL)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-zinc-700 mb-1">Süre (Ay)</label>
                    <input
                      type="number"
                      min={1}
                      value={periodMonths}
                      onChange={(e) => setPeriodMonths(Number(e.target.value) || 1)}
                      className="w-full px-3 py-2 rounded-lg border border-zinc-300"
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">
                    Tahsil Edilen Tutar (TRY - KDV Dahil) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 font-bold"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-zinc-700 mb-1">Gönderen Adı</label>
                    <input
                      type="text"
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-zinc-300"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-zinc-700 mb-1">Dekont / Ref No</label>
                    <input
                      type="text"
                      value={bankRef}
                      onChange={(e) => setBankRef(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-zinc-300"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 font-bold text-zinc-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoInvoice}
                    onChange={(e) => setAutoInvoice(e.target.checked)}
                  />
                  <span>Otomatik Ödendi Faturası (MV-FAT) da Kes</span>
                </label>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalMode(null)}
                    className="px-4 py-2 rounded-lg border border-zinc-200 font-bold cursor-pointer"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold cursor-pointer"
                  >
                    {submitting ? "Kaydediliyor..." : "Tahsilatı Kaydet"}
                  </button>
                </div>
              </form>
            )}

            {modalMode === "invoice" && (
              <form onSubmit={handleCreateInvoice} className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">
                    Fatura Açıklaması / Dönem *
                  </label>
                  <input
                    type="text"
                    required
                    value={periodLabel}
                    onChange={(e) => setPeriodLabel(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300"
                  />
                </div>
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">
                    KDV Dahil Toplam Tutar (TRY) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 font-bold"
                  />
                </div>
                <label className="flex items-center gap-2 font-bold text-zinc-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={markPaid}
                    onChange={(e) => setMarkPaid(e.target.checked)}
                  />
                  <span>Faturayı &ldquo;Ödendi&rdquo; Olarak İşaretle ve Tahsilat Kaydı Oluştur</span>
                </label>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalMode(null)}
                    className="px-4 py-2 rounded-lg border border-zinc-200 font-bold cursor-pointer"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 rounded-lg bg-violet-600 text-white font-bold cursor-pointer"
                  >
                    {submitting ? "Kesiliyor..." : "Faturayı Kes"}
                  </button>
                </div>
              </form>
            )}

            {modalMode === "plan" && (
              <form onSubmit={handleUpdatePlan} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-zinc-700 mb-1">Tanımlı Paket</label>
                    <select
                      value={planCode}
                      onChange={(e) => setPlanCode(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-zinc-300"
                    >
                      <option value="FREE">Ücretsiz Vitrin (Sınırsız Ürün)</option>
                      <option value="PRO">Profesyonel Vitrin (Sınırsız Ürün)</option>
                      <option value="PREMIUM">Premium Vitrin (Sınırsız Ürün)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-zinc-700 mb-1">
                      Aylık Anlaşılan Ücret (TRY)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-zinc-300"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 font-bold text-emerald-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isComplimentary}
                    onChange={(e) => setIsComplimentary(e.target.checked)}
                  />
                  <span>Şimdilik Ücretsiz (Lansman Muafiyeti Aktif)</span>
                </label>
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">
                    Resmi Ticari Fatura Unvanı
                  </label>
                  <input
                    type="text"
                    value={billingTitle}
                    onChange={(e) => setBillingTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-zinc-700 mb-1">Vergi Dairesi</label>
                    <input
                      type="text"
                      value={taxOffice}
                      onChange={(e) => setTaxOffice(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-zinc-300"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-zinc-700 mb-1">Vergi No / TCKN</label>
                    <input
                      type="text"
                      value={taxNumber}
                      onChange={(e) => setTaxNumber(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-zinc-300"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-1 border-t border-zinc-100">
                  <div>
                    <label className="block font-bold text-zinc-700 mb-1">
                      Hikaye (24s) Yetkisi
                    </label>
                    <select
                      value={storyOverrideMode}
                      onChange={(e) =>
                        setStoryOverrideMode(e.target.value as "auto" | "allow" | "deny")
                      }
                      className="w-full px-3 py-2 rounded-lg border border-zinc-300"
                    >
                      <option value="auto">Otomatik (Pakete Göre)</option>
                      <option value="allow">Özel İzin Ver (Açık)</option>
                      <option value="deny">Engelle (Kapalı)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-zinc-700 mb-1">
                      Özel 24s Hikaye Limiti
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      placeholder="Varsayılan (8)"
                      value={storyDailyLimitOverride}
                      onChange={(e) => setStoryDailyLimitOverride(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-zinc-300"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalMode(null)}
                    className="px-4 py-2 rounded-lg border border-zinc-200 font-bold cursor-pointer"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 rounded-lg bg-zinc-900 text-white font-bold cursor-pointer"
                  >
                    {submitting ? "Kaydediliyor..." : "Kaydet"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
