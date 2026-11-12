"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  CreditCard,
  Receipt,
  CheckCircle2,
  Infinity as InfinityIcon,
  FileText,
  Send,
  Building2,
  RefreshCw,
  Sparkles,
  Wallet,
  Landmark,
} from "lucide-react";

interface SubscriptionPlan {
  id: string;
  code: string;
  name: string;
  description: string;
  monthly_price: number;
  yearly_price: number;
  currency: string;
  tax_rate: number;
  max_products: number;
  features: string[];
}

interface SupplierSubscription {
  id: string;
  brand_id: string;
  brand_name: string;
  plan_code: string;
  plan_name: string;
  billing_cycle: string;
  status: string;
  is_complimentary: boolean;
  agreed_price: number;
  currency: string;
  max_products: number;
  active_products_count: number;
  current_period_start: string;
  current_period_end: string;
  total_paid_amount: number;
  total_invoiced_amount: number;
  outstanding_balance: number;
  billing_company_title: string;
  tax_office: string;
  tax_number: string;
  billing_address: string;
  billing_email: string;
}

interface SupplierInvoice {
  id: string;
  invoice_number: string;
  invoice_type: string;
  plan_code: string;
  period_label: string;
  subtotal_amount: number;
  tax_rate: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  paid_amount: number;
  currency: string;
  status: string;
  issue_date: string;
  due_date: string;
  paid_at?: string;
}

interface SupplierPayment {
  id: string;
  payment_number: string;
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

interface AccountingLedgerRow {
  id: string;
  entry_type: string;
  debit_amount: number;
  credit_amount: number;
  running_balance: number;
  currency: string;
  description: string;
  created_at: string;
}

interface SupplierBillingPanelProps {
  readonly getToken: () => string | null;
}

function toCorporateUpper(value: string): string {
  return value
    .replace(/premium/gi, "PREMIUM")
    .toLocaleUpperCase("tr-TR")
    .replace(/PREMİUM/g, "PREMIUM");
}

function formatPaymentStatus(status: string): { label: string; className: string } {
  if (status === "COMPLETED") {
    return { label: "ONAYLANDI", className: "bg-emerald-50 text-emerald-700" };
  }
  if (status === "PENDING_APPROVAL") {
    return { label: "ONAY BEKLİYOR", className: "bg-amber-50 text-amber-700" };
  }
  return { label: status, className: "bg-red-50 text-red-700" };
}

function formatLedgerEntryType(entryType: string): string {
  if (entryType === "INVOICE_DEBIT") return "Fatura Tahakkuku";
  if (entryType === "PAYMENT_CREDIT") return "Tedarikçi Ödemesi";
  return entryType;
}

function BillingTopBanner({
  sub,
  onRefresh,
}: Readonly<{
  sub: SupplierSubscription | null;
  onRefresh: () => void;
}>) {
  const brandTitle = (sub?.brand_name || "Firmanız").trim();
  const activePlanBadge = sub?.is_complimentary
    ? "Şu An Ücretsiz (Lansman Muafiyeti Aktif)"
    : `Aktif Paket: ${sub?.plan_name || "Ücretsiz Vitrin"}`;

  return (
    <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[11px] font-extrabold tracking-wide">
            {toCorporateUpper(activePlanBadge)}
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/20 text-slate-200 text-[11px] font-extrabold">
            <InfinityIcon size={13} />
            <span>Sınırsız Ürün Yükleme Hakkı (Ürün Sınırı Yok)</span>
          </span>
        </div>
        <h2 className="text-base font-extrabold tracking-tight">
          {`${brandTitle} — B2B Vitrin Abonelik & Muhasebe Merkezi`}
        </h2>
        <p className="text-xs text-slate-300 max-w-3xl">
          Platformumuzda ürün yükleme sınırı yoktur ({sub?.active_products_count ?? 0} aktif ürününüz yayında).
          Şu an ücretsiz vitrin kullanımınız aktiftir; dilediğiniz zaman Profesyonel veya Sponsorlu Premium Vitrin paketlerine aylık ödeme yaparak geçebilir ve tüm fatura/cari hareketlerinizi buradan takip edebilirsiniz.
        </p>
      </div>

      <button
        type="button"
        onClick={onRefresh}
        className="self-start lg:self-center inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-bold transition-colors cursor-pointer shrink-0"
      >
        <RefreshCw size={14} />
        <span>Muhasebeyi Yenile</span>
      </button>
    </div>
  );
}

function BillingSummaryCards({
  sub,
  invoiceCount,
}: Readonly<{
  sub: SupplierSubscription | null;
  invoiceCount: number;
}>) {
  const currency = sub?.currency || "TRY";
  const outstanding = sub?.outstanding_balance ?? 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
        <div className="flex items-center justify-between text-slate-400 mb-1">
          <span className="text-[11px] font-bold uppercase">Aktif Paket &amp; Kota</span>
          <Sparkles size={16} className="text-slate-700" />
        </div>
        <div className="text-base font-black text-slate-900">
          {sub?.plan_name || "Ücretsiz Vitrin"}
        </div>
        <div className="text-[11px] font-bold text-emerald-600 mt-1">
          Ürün Kotası: SINIRSIZ (∞)
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
        <div className="flex items-center justify-between text-slate-400 mb-1">
          <span className="text-[11px] font-bold uppercase">Toplam Ödediğim Tutar</span>
          <Wallet size={16} className="text-emerald-600" />
        </div>
        <div className="text-xl font-black text-emerald-700">
          {(sub?.total_paid_amount ?? 0).toLocaleString("tr-TR", {
            minimumFractionDigits: 2,
          })}{" "}
          {currency}
        </div>
        <div className="text-[11px] text-slate-500 mt-1">
          Onaylanmış tüm abonelik &amp; reklam ödemeleriniz
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
        <div className="flex items-center justify-between text-slate-400 mb-1">
          <span className="text-[11px] font-bold uppercase">Kesilen Toplam Fatura</span>
          <Receipt size={16} className="text-slate-700" />
        </div>
        <div className="text-xl font-black text-slate-900">
          {(sub?.total_invoiced_amount ?? 0).toLocaleString("tr-TR", {
            minimumFractionDigits: 2,
          })}{" "}
          {currency}
        </div>
        <div className="text-[11px] text-slate-500 mt-1">
          Toplam {invoiceCount} adet fatura kaydı
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
        <div className="flex items-center justify-between text-slate-400 mb-1">
          <span className="text-[11px] font-bold uppercase">Güncel Cari Bakiye</span>
          <CreditCard size={16} className="text-slate-700" />
        </div>
        <div className="text-xl font-black text-slate-900">
          {outstanding.toLocaleString("tr-TR", {
            minimumFractionDigits: 2,
          })}{" "}
          {currency}
        </div>
        <div className="text-[11px] text-slate-500 mt-1">
          {outstanding <= 0
            ? "Vadesi geçmiş borcunuz bulunmuyor"
            : "Ödeme bekleyen fatura bakiyesi"}
        </div>
      </div>
    </div>
  );
}

function SubscriptionPlansGrid({
  plans,
  activePlanCode,
  onSelectPlan,
}: Readonly<{
  plans: readonly SubscriptionPlan[];
  activePlanCode?: string;
  onSelectPlan: (plan: SubscriptionPlan) => void;
}>) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
      <div>
        <h3 className="text-sm font-extrabold text-slate-900">
          Aylık Vitrin &amp; Sponsorluk Paketleri (Ürün Sınırı Yoktur)
        </h3>
        <p className="text-xs text-slate-500">
          Tüm paketlerimizde ürün yükleme sınırı yoktur. Kategorilerde ve ana sayfada öne çıkmak için dilediğiniz zaman aylık ödeme yapabilirsiniz.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((plan) => {
          const isCurrent = activePlanCode === plan.code;
          return (
            <div
              key={plan.code}
              className={`rounded-xl border p-4 flex flex-col justify-between gap-4 ${
                isCurrent
                  ? "border-emerald-500 bg-emerald-50/30"
                  : "border-slate-200 bg-slate-50/40"
              }`}
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold tracking-wider text-slate-900">
                    {toCorporateUpper(plan.name)}
                  </span>
                  {isCurrent && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold shrink-0">
                      Aktif Paketiniz
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-slate-900">
                    {plan.monthly_price.toLocaleString("tr-TR")} {plan.currency}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">/ Ay</span>
                </div>
                <p className="text-[11px] text-slate-600">{plan.description}</p>
                <ul className="space-y-1.5 pt-1">
                  {plan.features.map((feat) => (
                    <li
                      key={feat}
                      className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700"
                    >
                      <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {plan.monthly_price > 0 ? (
                <button
                  type="button"
                  onClick={() => onSelectPlan(plan)}
                  className="w-full py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Bu Paket İçin Aylık Ödeme Bildir
                </button>
              ) : (
                <div className="w-full py-2 px-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-center text-xs font-extrabold">
                  Ücretsiz &amp; Sınırsız Ürün Aktif
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BillingHistoryTables({
  invoices,
  payments,
  ledger,
}: Readonly<{
  invoices: readonly SupplierInvoice[];
  payments: readonly SupplierPayment[];
  ledger: readonly AccountingLedgerRow[];
}>) {
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Invoices Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText size={15} className="text-slate-700" />
              <h4 className="text-xs font-extrabold text-slate-900 uppercase">
                Kesilen Faturalarım ({invoices.length})
              </h4>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-500">
                <tr>
                  <th className="py-2.5 px-3">Fatura No</th>
                  <th className="py-2.5 px-3">Dönem / Açıklama</th>
                  <th className="py-2.5 px-3">KDV Dahil Toplam</th>
                  <th className="py-2.5 px-3">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-400">
                      Henüz adınıza kesilmiş fatura bulunmuyor (Ücretsiz Vitrin aktif).
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                        {inv.invoice_number}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">
                        {inv.period_label || inv.plan_code}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
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

        {/* Payments Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard size={15} className="text-emerald-600" />
              <h4 className="text-xs font-extrabold text-slate-900 uppercase">
                Yaptığım Ödemeler &amp; Tahsilatlar ({payments.length})
              </h4>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-500">
                <tr>
                  <th className="py-2.5 px-3">Makbuz No</th>
                  <th className="py-2.5 px-3">Paket / Süre</th>
                  <th className="py-2.5 px-3">Tutar</th>
                  <th className="py-2.5 px-3">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-400">
                      Henüz ödeme kaydınız bulunmuyor.
                    </td>
                  </tr>
                ) : (
                  payments.map((pay) => {
                    const badge = formatPaymentStatus(pay.status);
                    return (
                      <tr key={pay.id}>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                          {pay.payment_number}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">
                          {pay.plan_code} ({pay.period_months} Ay)
                        </td>
                        <td className="py-2.5 px-3 font-bold text-emerald-700">
                          {pay.amount.toFixed(2)} {pay.currency}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${badge.className}`}>
                            {badge.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Accounting Ledger (Cari Ekstre) */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <h4 className="text-xs font-extrabold text-slate-900 uppercase">
            Muhasebe Cari Hesap Ekstresi (Borç / Alacak Hareketleri)
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-500">
              <tr>
                <th className="py-2.5 px-3">Tarih</th>
                <th className="py-2.5 px-3">İşlem Türü</th>
                <th className="py-2.5 px-3">Açıklama</th>
                <th className="py-2.5 px-3 text-right">Borç (Tahakkuk)</th>
                <th className="py-2.5 px-3 text-right">Alacak (Ödenen)</th>
                <th className="py-2.5 px-3 text-right">Kalan Bakiye</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ledger.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    Cari hesap ekstrenizde henüz borç veya tahsilat hareketi bulunmuyor (Bakiye: 0.00 TRY).
                  </td>
                </tr>
              ) : (
                ledger.map((row) => (
                  <tr key={row.id}>
                    <td className="py-2.5 px-3 text-slate-500">
                      {new Date(row.created_at).toLocaleDateString("tr-TR")}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-800">
                      {formatLedgerEntryType(row.entry_type)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">{row.description}</td>
                    <td className="py-2.5 px-3 text-right font-semibold text-slate-800">
                      {row.debit_amount > 0 ? `${row.debit_amount.toFixed(2)} ${row.currency}` : "-"}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                      {row.credit_amount > 0 ? `${row.credit_amount.toFixed(2)} ${row.currency}` : "-"}
                    </td>
                    <td className="py-2.5 px-3 text-right font-extrabold text-slate-900">
                      {row.running_balance.toFixed(2)} {row.currency}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export default function SupplierBillingPanel({
  getToken,
}: Readonly<SupplierBillingPanelProps>) {
  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState<SupplierSubscription | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);
  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const [ledger, setLedger] = useState<AccountingLedgerRow[]>([]);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [billingTitle, setBillingTitle] = useState("");
  const [taxOffice, setTaxOffice] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [savingTax, setSavingTax] = useState(false);

  const [payPlanCode, setPayPlanCode] = useState("PRO");
  const [payMonths, setPayMonths] = useState(1);
  const [payAmount, setPayAmount] = useState("990");
  const [paySender, setPaySender] = useState("");
  const [payRef, setPayRef] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [submittingPay, setSubmittingPay] = useState(false);

  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  const applySubscriptionDefaults = useCallback((s: SupplierSubscription | null) => {
    if (!s) return;
    setBillingTitle(s.billing_company_title || s.brand_name || "");
    setTaxOffice(s.tax_office || "");
    setTaxNumber(s.tax_number || "");
    setBillingEmail(s.billing_email || "");
    setBillingAddress(s.billing_address || "");
  }, []);

  const loadBilling = useCallback(async (showSpinner = false) => {
    const token = getTokenRef.current();
    if (!token) {
      setLoading(false);
      return;
    }
    if (showSpinner) setLoading(true);
    try {
      const res = await fetch("/api/v1/supplier/billing", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const s: SupplierSubscription | null = data.subscription || null;
        setSub(s);
        setPlans(data.plans || []);
        setInvoices(data.invoices || []);
        setPayments(data.payments || []);
        setLedger(data.ledger || []);
        applySubscriptionDefaults(s);
      }
    } catch {
      // Keep previous state on transient network failure
    } finally {
      setLoading(false);
    }
  }, [applySubscriptionDefaults]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadBilling(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [loadBilling]);

  const handleSaveTaxInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTax(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/v1/supplier/billing/tax-info", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getTokenRef.current()}`,
        },
        body: JSON.stringify({
          billing_company_title: billingTitle,
          tax_office: taxOffice,
          tax_number: taxNumber,
          billing_email: billingEmail,
          billing_address: billingAddress,
        }),
      });
      if (res.ok) {
        setFeedback({
          type: "ok",
          text: "Resmi fatura ve vergi dairesi bilgileriniz kaydedildi.",
        });
        void loadBilling();
      } else {
        setFeedback({ type: "err", text: "Fatura bilgileri kaydedilemedi." });
      }
    } catch {
      setFeedback({ type: "err", text: "Sunucu bağlantı hatası." });
    } finally {
      setSavingTax(false);
    }
  };

  const handleSelectPlanForPayment = (plan: SubscriptionPlan) => {
    if (plan.monthly_price <= 0) return;
    setPayPlanCode(plan.code);
    setPayMonths(1);
    setPayAmount(String(plan.monthly_price));
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmt = Number(payAmount);
    if (!numericAmt || numericAmt <= 0) {
      setFeedback({ type: "err", text: "Lütfen geçerli bir ödeme tutarı girin." });
      return;
    }
    setSubmittingPay(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/v1/supplier/billing/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getTokenRef.current()}`,
        },
        body: JSON.stringify({
          plan_code: payPlanCode,
          period_months: payMonths,
          amount: numericAmt,
          payment_method: "BANK_TRANSFER",
          sender_name: paySender || billingTitle,
          bank_reference: payRef,
          notes: payNotes,
        }),
      });
      if (res.ok) {
        setFeedback({
          type: "ok",
          text: "Aylık abonelik / vitrin ödeme bildiriminiz muhasebe servisine iletildi.",
        });
        setPayRef("");
        setPayNotes("");
        void loadBilling();
      } else {
        setFeedback({ type: "err", text: "Ödeme bildirimi gönderilemedi." });
      }
    } catch {
      setFeedback({ type: "err", text: "Bağlantı hatası." });
    } finally {
      setSubmittingPay(false);
    }
  };

  if (loading && !sub) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-500">
        Üyelik, muhasebe ve fatura bilgileriniz yükleniyor...
      </div>
    );
  }

  const selectedPlanLabel =
    payPlanCode === "PREMIUM" ? "Premium Vitrin" : "Profesyonel Vitrin";
  const transferDescriptionCode = `${(
    sub?.brand_name ||
    billingTitle ||
    "Tedarikçi Firma Adı"
  ).trim()} — ${selectedPlanLabel}`;

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-bold flex items-center justify-between ${
            feedback.type === "ok"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          <span>{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-[11px] underline cursor-pointer"
          >
            Kapat
          </button>
        </div>
      )}

      <BillingTopBanner sub={sub} onRefresh={() => void loadBilling(true)} />

      <BillingSummaryCards sub={sub} invoiceCount={invoices.length} />

      <SubscriptionPlansGrid
        plans={plans}
        activePlanCode={sub?.plan_code}
        onSelectPlan={handleSelectPlanForPayment}
      />

      {/* Two-Column: Payment Notification Form + Official Tax/Invoice Details Form */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Payment Notification Form */}
        <form
          onSubmit={handleSubmitPayment}
          className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3.5"
        >
          <div className="flex items-center gap-2">
            <Send size={16} className="text-emerald-600" />
            <h3 className="text-sm font-extrabold text-slate-900">
              Aylık Abonelik / Reklam Ödeme Bildirimi Gönder
            </h3>
          </div>
          <p className="text-xs text-slate-500">
            Merter Vitrini hesabına yaptığınız aylık üyelik veya sponsorlu vitrin Havale/EFT ödemenizi bildirin; muhasebe onayından sonra faturanız otomatik kesilir.
          </p>

          {/* Corporate Wire Transfer & Proforma Instructions Box */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2 text-xs">
            <div className="flex items-center gap-1.5 font-extrabold text-slate-900">
              <Landmark size={14} className="text-emerald-600 shrink-0" />
              <span>Havale / EFT &amp; Proforma Bilgilendirme</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
              <div className="rounded-lg bg-white border border-slate-200/80 px-2.5 py-2">
                <span className="block text-[10px] font-bold uppercase text-slate-400">
                  Alıcı Ünvanı
                </span>
                <span className="font-bold text-slate-900">
                  Merter Vitrini B2B Dijital Pazarlama
                </span>
              </div>
              <div className="rounded-lg bg-white border border-slate-200/80 px-2.5 py-2">
                <span className="block text-[10px] font-bold uppercase text-slate-400">
                  Açıklama Kodu
                </span>
                <span className="font-bold text-emerald-700">
                  {transferDescriptionCode}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Ödeme öncesi resmi <strong>Proforma Fatura</strong> ve güncel kurumsal banka <strong>IBAN teyidi</strong> için{" "}
              <a
                href="mailto:info@mertervitrini.com.tr"
                className="font-bold text-slate-900 underline"
              >
                info@mertervitrini.com.tr
              </a>{" "}
              veya Tedarikçi Muhasebe Destek hattımızla iletişime geçebilirsiniz.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label
                htmlFor="pay-plan-code"
                className="block text-[11px] font-bold text-slate-700 mb-1"
              >
                Paket Seçimi
              </label>
              <select
                id="pay-plan-code"
                value={payPlanCode}
                onChange={(e) => {
                  const code = e.target.value;
                  setPayPlanCode(code);
                  const found = plans.find((p) => p.code === code);
                  if (found && found.monthly_price > 0) {
                    setPayAmount(String(found.monthly_price * payMonths));
                  }
                }}
                className="w-full min-w-[260px] px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-900"
              >
                <option value="PRO">Profesyonel Vitrin (990 TL / Ay)</option>
                <option value="PREMIUM">Premium Vitrin (2.490 TL / Ay)</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="pay-months"
                  className="block text-[11px] font-bold text-slate-700 mb-1"
                >
                  Süre (Ay)
                </label>
                <select
                  id="pay-months"
                  value={payMonths}
                  onChange={(e) => {
                    const m = Number(e.target.value) || 1;
                    setPayMonths(m);
                    const found = plans.find((p) => p.code === payPlanCode);
                    if (found && found.monthly_price > 0) {
                      setPayAmount(String(found.monthly_price * m));
                    }
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs text-slate-900"
                >
                  <option value={1}>1 Aylık</option>
                  <option value={3}>3 Aylık</option>
                  <option value={6}>6 Aylık</option>
                  <option value={12}>12 Aylık (Yıllık)</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="pay-amount"
                  className="block text-[11px] font-bold text-slate-700 mb-1"
                >
                  Ödenen Tutar (TRY) *
                </label>
                <input
                  id="pay-amount"
                  type="number"
                  step="0.01"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-900"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="pay-sender"
                className="block text-[11px] font-bold text-slate-700 mb-1"
              >
                Gönderen Firma / Ad Soyad *
              </label>
              <input
                id="pay-sender"
                type="text"
                required
                value={paySender}
                onChange={(e) => setPaySender(e.target.value)}
                placeholder={billingTitle || "Örn: Lustrin Tekstil Ltd. Şti."}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
              />
            </div>
            <div>
              <label
                htmlFor="pay-ref"
                className="block text-[11px] font-bold text-slate-700 mb-1"
              >
                Dekont / Banka Referans No
              </label>
              <input
                id="pay-ref"
                type="text"
                value={payRef}
                onChange={(e) => setPayRef(e.target.value)}
                placeholder="Dekont veya işlem no"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="pay-notes"
              className="block text-[11px] font-bold text-slate-700 mb-1"
            >
              Açıklama / Not
            </label>
            <input
              id="pay-notes"
              type="text"
              value={payNotes}
              onChange={(e) => setPayNotes(e.target.value)}
              placeholder="Örn: Kasım ayı Profesyonel Vitrin ödemesi"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
            />
          </div>

          <button
            type="submit"
            disabled={submittingPay}
            className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold transition-colors cursor-pointer disabled:opacity-50"
          >
            {submittingPay ? "Gönderiliyor..." : "Ödeme Bildirimini Muhasebeye Gönder"}
          </button>
        </form>

        {/* Official Tax & Billing Info Form */}
        <form
          onSubmit={handleSaveTaxInfo}
          className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3.5 flex flex-col justify-between"
        >
          <div className="space-y-3.5">
            <div className="flex items-center gap-2">
              <Building2 size={16} className="text-slate-800" />
              <h3 className="text-sm font-extrabold text-slate-900">
                Resmi Fatura &amp; Vergi Dairesi Bilgilerim
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              Yaptığınız aylık ödemelerin resmi E-Fatura / E-Arşiv faturalarının firmanıza kesilebilmesi için vergi bilgilerinizi güncel tutun.
            </p>

            <div>
              <label
                htmlFor="billing-title"
                className="block text-[11px] font-bold text-slate-700 mb-1"
              >
                Resmi Ticari Fatura Unvanı *
              </label>
              <input
                id="billing-title"
                type="text"
                required
                value={billingTitle}
                onChange={(e) => setBillingTitle(e.target.value)}
                placeholder="Örn: Lustrin Tekstil San. ve Dış Tic. Ltd. Şti."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="tax-office"
                  className="block text-[11px] font-bold text-slate-700 mb-1"
                >
                  Vergi Dairesi
                </label>
                <input
                  id="tax-office"
                  type="text"
                  value={taxOffice}
                  onChange={(e) => setTaxOffice(e.target.value)}
                  placeholder="Örn: Merter V.D."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                />
              </div>
              <div>
                <label
                  htmlFor="tax-number"
                  className="block text-[11px] font-bold text-slate-700 mb-1"
                >
                  Vergi Kimlik No / TCKN
                </label>
                <input
                  id="tax-number"
                  type="text"
                  value={taxNumber}
                  onChange={(e) => setTaxNumber(e.target.value)}
                  placeholder="10 veya 11 haneli vergi no"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="billing-email"
                  className="block text-[11px] font-bold text-slate-700 mb-1"
                >
                  E-Fatura Gönderim E-posta Adresi
                </label>
                <input
                  id="billing-email"
                  type="email"
                  value={billingEmail}
                  onChange={(e) => setBillingEmail(e.target.value)}
                  placeholder="muhasebe@firmaniz.com"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                />
              </div>
              <div>
                <label
                  htmlFor="billing-address"
                  className="block text-[11px] font-bold text-slate-700 mb-1"
                >
                  Fatura Adresi
                </label>
                <input
                  id="billing-address"
                  type="text"
                  value={billingAddress}
                  onChange={(e) => setBillingAddress(e.target.value)}
                  placeholder="Mehmet Nesih Özmen Mah. Merter / Güngören / İstanbul"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={savingTax}
            className="w-full py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold transition-colors cursor-pointer disabled:opacity-50"
          >
            {savingTax ? "Kaydediliyor..." : "Resmi Fatura Bilgilerimi Kaydet"}
          </button>
        </form>
      </div>

      <BillingHistoryTables
        invoices={invoices}
        payments={payments}
        ledger={ledger}
      />
    </div>
  );
}

