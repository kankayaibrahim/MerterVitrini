"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { AlertTriangle, RefreshCw, Home, ShoppingBag } from "lucide-react";
import {
  getCategoryPrefix,
  normalizeLangCode,
  pickLangText,
  SupportedLangCode,
} from "@/app/i18n";

interface GlobalErrorCopy {
  badge: string;
  heading: string;
  description: string;
  refLabel: string;
  retryBtn: string;
  homeBtn: string;
  catalogBtn: string;
}

const ERROR_COPY: Record<SupportedLangCode, GlobalErrorCopy> = {
  tr: {
    badge: "Sayfa Yükleme Hatası",
    heading: "Sayfa Görüntülenirken Geçici Bir Sorun Oluştu",
    description:
      "Bu sayfa yüklenirken beklenmeyen bir teknik hata meydana geldi. Hata ekibimize otomatik olarak raporlandı; sayfayı yeniden yükleyebilir veya mağazaya dönebilirsiniz.",
    refLabel: "Hata Referans Kodu",
    retryBtn: "Tekrar Dene",
    homeBtn: "Ana Sayfaya Dön",
    catalogBtn: "Tüm Ürünleri İncele",
  },
  en: {
    badge: "Page Load Error",
    heading: "Something Went Wrong While Loading This Page",
    description:
      "An unexpected technical error occurred while rendering this page. The issue has been reported automatically; you can try reloading or return to the wholesale storefront.",
    refLabel: "Error Reference",
    retryBtn: "Try Again",
    homeBtn: "Back to Homepage",
    catalogBtn: "Browse All Products",
  },
  ru: {
    badge: "Ошибка загрузки страницы",
    heading: "Произошла временная ошибка при загрузке страницы",
    description:
      "При отображении этой страницы возникла непредвиденная техническая ошибка. Отчёт уже отправлен нашей команде. Попробуйте обновить страницу или вернуться в каталог.",
    refLabel: "Код ошибки",
    retryBtn: "Повторить попытку",
    homeBtn: "На главную",
    catalogBtn: "Все товары",
  },
  ar: {
    badge: "خطأ في تحميل الصفحة",
    heading: "حدثت مشكلة مؤقتة أثناء عرض الصفحة",
    description:
      "وقع خطأ تقني غير متوقع أثناء تحميل هذه الصفحة. تم إرسال تقرير تلقائي لفريقنا؛ يمكنك إعادة المحاولة أو العودة إلى المتجر.",
    refLabel: "رمز الخطأ المرجعي",
    retryBtn: "إعادة المحاولة",
    homeBtn: "العودة للرئيسية",
    catalogBtn: "تصفح جميع المنتجات",
  },
  de: {
    badge: "Seitenladefehler",
    heading: "Beim Laden dieser Seite ist ein Problem aufgetreten",
    description:
      "Beim Darstellen dieser Seite ist ein unerwarteter technischer Fehler aufgetreten. Der Vorfall wurde automatisch gemeldet. Bitte versuchen Sie es erneut oder kehren Sie zum Shop zurück.",
    refLabel: "Fehlerreferenz",
    retryBtn: "Erneut versuchen",
    homeBtn: "Zur Startseite",
    catalogBtn: "Alle Produkte ansehen",
  },
  fr: {
    badge: "Erreur de chargement",
    heading: "Un problème temporaire est survenu lors du chargement",
    description:
      "Une erreur technique inattendue s'est produite lors de l'affichage de cette page. L'incident a été signalé automatiquement ; veuillez réessayer ou revenir à la boutique.",
    refLabel: "Code de référence",
    retryBtn: "Réessayer",
    homeBtn: "Retour à l'accueil",
    catalogBtn: "Voir tous les produits",
  },
  pl: {
    badge: "Błąd ładowania strony",
    heading: "Wystąpił tymczasowy problem podczas ładowania strony",
    description:
      "Podczas wyświetlania tej strony wystąpił nieoczekiwany błąd techniczny. Zgłoszenie zostało wysłane automatycznie; spróbuj ponownie lub wróć do sklepu.",
    refLabel: "Kod błędu",
    retryBtn: "Spróbuj ponownie",
    homeBtn: "Strona główna",
    catalogBtn: "Wszystkie produkty",
  },
  bg: {
    badge: "Грешка при зареждане",
    heading: "Възникна временен проблем при зареждането на страницата",
    description:
      "При показването на тази страница възникна неочаквана техническа грешка. Сигналът е изпратен автоматично; опитайте отново или се върнете в каталога.",
    refLabel: "Референтен код",
    retryBtn: "Опитай отново",
    homeBtn: "Към началната страница",
    catalogBtn: "Всички продукти",
  },
};

interface RootErrorProps {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}

export default function GlobalError({ error, reset }: RootErrorProps) {
  const [lang, setLang] = useState<SupportedLangCode>("tr");

  useEffect(() => {
    console.error("Storefront error boundary caught:", error);
    Sentry.captureException(error);

    queueMicrotask(() => {
      const docLang = document.documentElement.getAttribute("lang");
      const storedLang = localStorage.getItem("preferred_lang");
      setLang(normalizeLangCode(docLang || storedLang));
    });
  }, [error]);

  const copy = pickLangText(lang, ERROR_COPY);
  const catalogHref = `/${getCategoryPrefix(lang)}/tum-urunler`;

  return (
    <main
      dir={lang === "ar" ? "rtl" : "ltr"}
      className="min-h-[75vh] flex flex-col items-center justify-center px-4 py-16 text-center bg-[#fcfcfc] text-[#1C1C1C]"
    >
      <div className="max-w-lg w-full bg-white border border-[#E5E0D8] rounded-xl p-8 shadow-xs space-y-6">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-[#FAF7F2] border border-[#D8C7A6] flex items-center justify-center text-[#8C6D3F]">
          <AlertTriangle className="w-7 h-7" />
        </div>

        <div className="space-y-2.5">
          <span className="inline-block px-3 py-1 rounded-full bg-[#FAF7F2] border border-[#D8C7A6] text-[#6E542E] text-[10.5px] font-extrabold uppercase tracking-wider">
            {copy.badge}
          </span>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#1C1C1C] leading-snug">
            {copy.heading}
          </h1>
          <p className="text-xs sm:text-sm font-medium text-[#525252] leading-relaxed">
            {copy.description}
          </p>
        </div>

        {error.digest && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#F8F6F2] border border-[#E5E0D8] text-[11px] font-mono font-bold text-[#6B6B6B]">
            <span>{copy.refLabel}:</span>
            <span className="text-[#1C1C1C] select-all">{error.digest}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#1C1C1C] hover:bg-[#333333] text-white rounded-lg text-xs font-extrabold uppercase tracking-wider transition-colors border-none cursor-pointer active:scale-[0.99]"
          >
            <RefreshCw className="w-4 h-4" />
            <span>{copy.retryBtn}</span>
          </button>

          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#F8F6F2] hover:bg-[#EFECE6] text-[#1C1C1C] border border-[#D6D1C7] rounded-lg text-xs font-extrabold uppercase tracking-wider transition-colors no-underline"
          >
            <Home className="w-4 h-4 text-[#8C6D3F]" />
            <span>{copy.homeBtn}</span>
          </Link>

          <Link
            href={catalogHref}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white hover:bg-[#F8F6F2] text-[#1C1C1C] border border-[#E5E0D8] rounded-lg text-xs font-extrabold uppercase tracking-wider transition-colors no-underline"
          >
            <ShoppingBag className="w-4 h-4 text-[#8C6D3F]" />
            <span>{copy.catalogBtn}</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
