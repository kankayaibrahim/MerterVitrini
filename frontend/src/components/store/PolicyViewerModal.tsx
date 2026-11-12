"use client";

import React, { useEffect, useState } from "react";
import { X, Printer, Copy, Check, FileText, Calendar, AlertCircle } from "lucide-react";
import { apiFetch } from "../../app/utils";
import { pickLangText, SupportedLangCode, t } from "@/app/i18n";

interface LegalPolicy {
  id: string;
  type: string;
  version: number;
  title: string;
  content: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface PolicyViewerModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly policyType: "cancellation_and_return" | "terms_of_service" | "privacy_policy" | "";
  readonly lang: string;
}

interface PolicyUiTexts {
  locale: string;
  loadingTitle: string;
  defaultTitle: string;
  retrievingDb: string;
  retryOrContact: string;
  loadFailed: string;
  dbError: string;
  versionLabel: string;
  updatedAtLabel: string;
  printBtn: string;
  copyBtn: string;
  copiedBtn: string;
  gotItBtn: string;
}

const POLICY_UI_TEXTS: Record<SupportedLangCode, PolicyUiTexts> = {
  tr: {
    locale: "tr-TR",
    loadingTitle: "Yükleniyor...",
    defaultTitle: "Sözleşme Metni",
    retrievingDb: "Sözleşme veritabanından çekiliyor...",
    retryOrContact: "Lütfen daha sonra tekrar deneyin veya müşteri temsilcimizle iletişime geçin.",
    loadFailed: "Aktif yasal metin yüklenemedi.",
    dbError: "Veritabanı bağlantı hatası oluştu.",
    versionLabel: "Sürüm",
    updatedAtLabel: "Güncelleme Tarihi",
    printBtn: "Yazdır",
    copyBtn: "Kopyala",
    copiedBtn: "Kopyalandı",
    gotItBtn: "Anladım",
  },
  en: {
    locale: "en-US",
    loadingTitle: "Loading...",
    defaultTitle: "Legal Policy",
    retrievingDb: "Retrieving policy from database...",
    retryOrContact: "Please try again later or contact our B2B representatives.",
    loadFailed: "Failed to load active policy text.",
    dbError: "Database connection error occurred.",
    versionLabel: "Version",
    updatedAtLabel: "Last Updated",
    printBtn: "Print",
    copyBtn: "Copy",
    copiedBtn: "Copied",
    gotItBtn: "Got it",
  },
  ru: {
    locale: "ru-RU",
    loadingTitle: "Загрузка...",
    defaultTitle: "Юридический документ",
    retrievingDb: "Загрузка документа из базы данных...",
    retryOrContact: "Пожалуйста, попробуйте позже или свяжитесь с нашим B2B представителем.",
    loadFailed: "Не удалось загрузить текст документа.",
    dbError: "Произошла ошибка подключения к базе данных.",
    versionLabel: "Версия",
    updatedAtLabel: "Дата обновления",
    printBtn: "Печать",
    copyBtn: "Копировать",
    copiedBtn: "Скопировано",
    gotItBtn: "Понятно",
  },
  ar: {
    locale: "ar-SA",
    loadingTitle: "جاري التحميل...",
    defaultTitle: "النص القانوني",
    retrievingDb: "جاري استرداد السياسة من قاعدة البيانات...",
    retryOrContact: "يرجى المحاولة مرة أخرى لاحقاً أو التواصل مع ممثلي B2B لدينا.",
    loadFailed: "تعذر تحميل النص القانوني النشط.",
    dbError: "حدث خطأ في الاتصال بقاعدة البيانات.",
    versionLabel: "الإصدار",
    updatedAtLabel: "تاريخ التحديث",
    printBtn: "طباعة",
    copyBtn: "نسخ",
    copiedBtn: "تم النسخ",
    gotItBtn: "حسناً",
  },
  de: {
    locale: "de-DE",
    loadingTitle: "Wird geladen...",
    defaultTitle: "Rechtstext",
    retrievingDb: "Richtlinie wird aus der Datenbank geladen...",
    retryOrContact: "Bitte versuchen Sie es später erneut oder kontaktieren Sie unser B2B-Team.",
    loadFailed: "Aktiver Rechtstext konnte nicht geladen werden.",
    dbError: "Datenbankverbindungsfehler aufgetreten.",
    versionLabel: "Version",
    updatedAtLabel: "Aktualisiert am",
    printBtn: "Drucken",
    copyBtn: "Kopieren",
    copiedBtn: "Kopiert",
    gotItBtn: "Verstanden",
  },
  fr: {
    locale: "fr-FR",
    loadingTitle: "Chargement...",
    defaultTitle: "Politique juridique",
    retrievingDb: "Récupération du texte depuis la base de données...",
    retryOrContact: "Veuillez réessayer plus tard ou contacter nos conseillers B2B.",
    loadFailed: "Impossible de charger le texte juridique actif.",
    dbError: "Erreur de connexion à la base de données.",
    versionLabel: "Version",
    updatedAtLabel: "Dernière mise à jour",
    printBtn: "Imprimer",
    copyBtn: "Copier",
    copiedBtn: "Copié",
    gotItBtn: "Compris",
  },
  pl: {
    locale: "pl-PL",
    loadingTitle: "Ładowanie...",
    defaultTitle: "Dokument prawny",
    retrievingDb: "Pobieranie dokumentu z bazy danych...",
    retryOrContact: "Spróbuj ponownie później lub skontaktuj się z naszym działem B2B.",
    loadFailed: "Nie udało się załadować aktywnego tekstu prawnego.",
    dbError: "Wystąpił błąd połączenia z bazą danych.",
    versionLabel: "Wersja",
    updatedAtLabel: "Data aktualizacji",
    printBtn: "Drukuj",
    copyBtn: "Kopiuj",
    copiedBtn: "Skopiowano",
    gotItBtn: "Rozumiem",
  },
  bg: {
    locale: "bg-BG",
    loadingTitle: "Зареждане...",
    defaultTitle: "Правна политика",
    retrievingDb: "Извличане на документа от базата данни...",
    retryOrContact: "Моля, опитайте отново по-късно или се свържете с наш B2B представител.",
    loadFailed: "Неуспешно зареждане на активния правен текст.",
    dbError: "Възникна грешка при връзка с базата данни.",
    versionLabel: "Версия",
    updatedAtLabel: "Дата на обновяване",
    printBtn: "Принтирай",
    copyBtn: "Копирай",
    copiedBtn: "Копирано",
    gotItBtn: "Разбрах",
  },
};

function getModalTitle(loading: boolean, policy: LegalPolicy | null, lang: string): string {
  const txt = pickLangText(lang, POLICY_UI_TEXTS);
  if (loading) {
    return txt.loadingTitle;
  }
  if (policy?.title) {
    return policy.title;
  }
  return txt.defaultTitle;
}

function formatDate(dateStr: string, lang: string): string {
  const txt = pickLangText(lang, POLICY_UI_TEXTS);
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(txt.locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

interface PolicyModalBodyProps {
  readonly loading: boolean;
  readonly error: string | null;
  readonly policy: LegalPolicy | null;
  readonly lang: string;
  readonly onClose: () => void;
}

function PolicyModalBody({
  loading,
  error,
  policy,
  lang,
  onClose,
}: Readonly<PolicyModalBodyProps>) {
  const txt = pickLangText(lang, POLICY_UI_TEXTS);
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-xs font-bold text-slate-400 select-none animate-pulse">
          {txt.retrievingDb}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center max-w-sm mx-auto gap-4">
        <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-extrabold text-slate-800">{error}</p>
          <p className="text-xs text-slate-400 font-semibold mt-1">
            {txt.retryOrContact}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer border-none"
        >
          {t("close", lang)}
        </button>
      </div>
    );
  }

  if (policy) {
    return (
      <article className="prose prose-slate max-w-none text-slate-700 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-sans">
        {policy.content}
      </article>
    );
  }

  return null;
}

export default function PolicyViewerModal({
  isOpen,
  onClose,
  policyType,
  lang,
}: Readonly<PolicyViewerModalProps>) {
  const [policy, setPolicy] = useState<LegalPolicy | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [animate, setAnimate] = useState<boolean>(false);
  const txt = pickLangText(lang, POLICY_UI_TEXTS);

  if (prevIsOpen !== isOpen) {
    setPrevIsOpen(isOpen);
    if (!isOpen) {
      setAnimate(false);
    }
  }

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => setAnimate(true), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !policyType) return;

    async function fetchPolicy() {
      const currentTxt = pickLangText(lang, POLICY_UI_TEXTS);
      setLoading(true);
      setError(null);
      setPolicy(null);

      try {
        const data = await apiFetch<LegalPolicy>(`/policies/${policyType}/active`);
        if (data) {
          setPolicy(data);
        } else {
          setError(currentTxt.loadFailed);
        }
      } catch (err) {
        console.error("Failed to fetch policy", err);
        setError(currentTxt.dbError);
      } finally {
        setLoading(false);
      }
    }

    void fetchPolicy();
  }, [isOpen, policyType, lang]);

  const handleCopy = async () => {
    if (!policy) return;
    try {
      await navigator.clipboard.writeText(policy.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  const handlePrint = () => {
    if (!policy) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const escapedTitle = escapeHtml(policy.title);
    const escapedContent = escapeHtml(policy.content);
    const policyVersion = String(policy.version);
    const policyDate = new Date(policy.updated_at).toLocaleDateString(txt.locale);

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
<title>${escapedTitle}</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; padding: 40px; color: #1e293b; max-width: 800px; margin: 0 auto; }
h1 { border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; font-size: 24px; color: #0f172a; }
.meta { font-size: 12px; color: #64748b; margin-bottom: 30px; }
pre { white-space: pre-wrap; font-family: inherit; font-size: 14px; }
</style>
</head>
<body>
<h1>${escapedTitle}</h1>
<div class="meta">${escapeHtml(txt.versionLabel)}: v${policyVersion} | ${escapeHtml(txt.updatedAtLabel)}: ${escapeHtml(policyDate)}</div>
<pre>${escapedContent}</pre>
</body>
</html>`;

    printWindow.document.documentElement.innerHTML = htmlContent;
    printWindow.focus();
    printWindow.print();
  };

  if (!isOpen) return null;

  const modalTitle = getModalTitle(loading, policy, lang);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 transition-all duration-300 ${
        animate ? "opacity-100" : "opacity-0"
      }`}
      aria-labelledby="modal-title"
      aria-modal="true"
    >
      {/* Accessible Backdrop Overlay */}
      <button
        type="button"
        aria-label={t("close_modal", lang)}
        tabIndex={-1}
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-md transition-opacity cursor-default border-none"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div
        className={`bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-100 flex flex-col max-h-[85vh] relative z-10 transition-all duration-300 transform ${
          animate ? "scale-100 translate-y-0" : "scale-95 translate-y-4"
        }`}
      >
        {/* Modal Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 flex items-center justify-between gap-4 shrink-0 select-none">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100/50 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3
                id="modal-title"
                className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight"
              >
                {modalTitle}
              </h3>

              {policy && !loading && (
                <div className="flex items-center gap-3 text-xs font-semibold text-slate-400 mt-0.5">
                  <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-lg border border-indigo-100/50 font-mono">
                    v{policy.version}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {formatDate(policy.updated_at, lang)}
                  </span>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t("close_modal", lang)}
            className="w-8 h-8 rounded-full border border-slate-100 hover:border-slate-200 hover:bg-slate-50 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-all active:scale-90 cursor-pointer shadow-sm"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content Scrollable Workspace */}
        <div className="p-6 overflow-y-auto flex-grow bg-slate-50/20 leading-relaxed text-sm">
          <PolicyModalBody
            loading={loading}
            error={error}
            policy={policy}
            lang={lang}
            onClose={onClose}
          />
        </div>

        {/* Modal Footer Controls */}
        {policy && !loading && (
          <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between gap-4 shrink-0 select-none">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-200/80 hover:border-slate-300 hover:bg-slate-100/50 rounded-xl text-slate-600 hover:text-slate-900 transition-all font-semibold text-xs cursor-pointer shadow-sm"
              >
                <Printer className="w-4 h-4" />
                <span>{txt.printBtn}</span>
              </button>

              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-200/80 hover:border-slate-300 hover:bg-slate-100/50 rounded-xl text-slate-600 hover:text-slate-900 transition-all font-semibold text-xs cursor-pointer shadow-sm"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span className="text-emerald-700 font-bold">
                      {txt.copiedBtn}
                    </span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>{txt.copyBtn}</span>
                  </>
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer border-none"
            >
              {txt.gotItBtn}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
