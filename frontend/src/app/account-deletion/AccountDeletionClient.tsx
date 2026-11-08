"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  CheckCircle2,
  Smartphone,
  Trash2,
  ArrowLeft,
  Lock,
} from "lucide-react";
import {
  AccountRole,
  accountDeletionService,
  IAccountDeletionService,
} from "@/services/account-deletion.service";

interface AccountDeletionClientProps {
  readonly service?: IAccountDeletionService;
}

export default function AccountDeletionClient({
  service = accountDeletionService,
}: Readonly<AccountDeletionClientProps>) {
  const [role, setRole] = useState<AccountRole>("customer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleDeleteSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!confirmed) {
      setErrorMsg(
        "Lütfen hesap silme işleminin geri alınamaz olduğunu onaylayın."
      );
      return;
    }

    setLoading(true);
    try {
      const result = await service.authenticateAndDelete({
        role,
        email,
        password,
        reason,
      });

      setSuccessMsg(result.message);
      setEmail("");
      setPassword("");
      setReason("");
      setConfirmed(false);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Sunucu bağlantısı sırasında bir hata oluştu. Lütfen tekrar deneyin."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Merter Vitrini Mağazasına Dön
          </Link>
          <span className="text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full bg-blue-100 text-blue-800">
            Google Play Veri Güvenliği
          </span>
        </div>

        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-red-50 text-red-600 shrink-0">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                Merter Vitrini — Hesap ve Veri Silme Merkezi
              </h1>
              <p className="mt-2 text-sm sm:text-base text-slate-600">
                <strong>Merter Vitrini Mobil Uygulaması</strong> (
                <code>com.mertervitrini.app</code>) ve web platformu üzerindeki{" "}
                <strong>Müşteri (Toptan Alıcı)</strong> veya{" "}
                <strong>Tedarikçi</strong> hesabınızı uygulama içinden ya da
                doğrudan bu sayfa üzerinden kalıcı olarak silebilirsiniz.
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 pt-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-slate-900">
                <Smartphone className="w-5 h-5 text-blue-600" />
                Mobil Uygulama İçinden Silme
              </div>
              <ol className="text-sm text-slate-600 list-decimal list-inside space-y-1">
                <li>Merter Vitrini mobil uygulamasını açın.</li>
                <li>
                  Alt menüden <strong>Profil / Hesabım</strong> sekmesine gidin.
                </li>
                <li>
                  <strong>Hesabımı Kalıcı Olarak Sil</strong> butonuna dokunun ve
                  onaylayın.
                </li>
              </ol>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-slate-900">
                <Lock className="w-5 h-5 text-emerald-600" />
                Silinen ve Saklanan Veriler
              </div>
              <ul className="text-sm text-slate-600 list-disc list-inside space-y-1">
                <li>
                  <strong>Anında Silinir:</strong> Ad-soyad, e-posta, telefon,
                  adres defteri, sepet, favoriler ve bildirim anahtarları.
                </li>
                <li>
                  <strong>Yasal Saklama:</strong> Tamamlanmış B2B sipariş ve
                  muhasebe kayıtları anonimleştirilerek 6102 sayılı TTK ve VUK
                  uyarınca yasal süre boyunca saklanır.
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            Web Üzerinden Anında Hesap Silme Formu
          </h2>
          <p className="text-sm text-slate-600 mb-6">
            Mobil uygulamayı cihazınızdan kaldırdıysanız aşağıdan hesap türünüzü
            seçip giriş bilgilerinizle hesabınızı anında silebilirsiniz.
          </p>

          {successMsg && (
            <div className="mb-6 rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex items-start gap-3 text-emerald-800">
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="text-sm font-medium">{successMsg}</div>
            </div>
          )}

          {errorMsg && (
            <div className="mb-6 rounded-xl bg-red-50 border border-red-200 p-4 text-sm font-medium text-red-700">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleDeleteSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Hesap Türü
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole("customer")}
                  className={`py-2.5 px-4 rounded-xl text-sm font-semibold border transition-all ${
                    role === "customer"
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  Müşteri (Toptan Alıcı)
                </button>
                <button
                  type="button"
                  onClick={() => setRole("supplier")}
                  className={`py-2.5 px-4 rounded-xl text-sm font-semibold border transition-all ${
                    role === "supplier"
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  Tedarikçi / Üretici
                </button>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Kayıtlı E-Posta Adresi
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ornek@firma.com"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Hesap Şifreniz
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Silme Nedeni (İsteğe Bağlı)
              </label>
              <textarea
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Hizmetimizi geliştirmemiz için görüşünüzü paylaşabilirsiniz..."
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-600"
              />
              <span className="text-sm text-slate-700">
                Hesabımın ve kişisel profil verilerimin kalıcı olarak
                silineceğini ve bu işlemin geri alınamayacağını onaylıyorum.
              </span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-semibold py-3 px-5 text-sm transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              {loading
                ? "Hesabınız Siliniyor..."
                : "Hesabımı ve Kişisel Verilerimi Kalıcı Olarak Sil"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
