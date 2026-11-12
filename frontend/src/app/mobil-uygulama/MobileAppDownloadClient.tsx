"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Smartphone,
  Download,
  RefreshCw,
  ShieldCheck,
  Camera,
  ShoppingBag,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import {
  INTL_LOCALE_BY_LANG,
  SUPPORTED_SEO_LANGS,
  SupportedSeoLang,
  normalizeSeoLang,
} from "@/utils/seoHelpers";

interface MobileVersionManifest {
  app_name: string;
  package_id: string;
  version: string;
  build_number: number;
  min_build_number: number;
  force_update: boolean;
  apk_filename: string;
  download_url: string;
  sha256: string;
  file_size_bytes: number;
  published_at: string;
  apk_available: boolean;
  release_notes?: Record<string, string>;
}

interface MobileAppLocaleCopy {
  readonly backToStore: string;
  readonly topBadge: string;
  readonly heroPill: string;
  readonly heroTitle: string;
  readonly heroLeadBeforeBold: string;
  readonly heroLeadBold: string;
  readonly heroLeadAfterBold: string;
  readonly downloadBtnPrefix: string;
  readonly buildWord: string;
  readonly preparingApkNotice: string;
  readonly sizePrefix: string;
  readonly stripActiveVersion: string;
  readonly checkingLabel: string;
  readonly stripReleaseDateSize: string;
  readonly currentFallback: string;
  readonly stripPackageSignature: string;
  readonly whatsNewTitle: string;
  readonly defaultReleaseNote: string;
  readonly sha256Label: string;
  readonly step1Title: string;
  readonly step1Body: string;
  readonly step2Title: string;
  readonly step2Body: string;
  readonly step3Title: string;
  readonly step3Body: string;
}

const MOBILE_APP_COPY: Record<SupportedSeoLang, MobileAppLocaleCopy> = {
  tr: {
    backToStore: "Mağaza Vitrinine Dön",
    topBadge: "MERTER VİTRİNİ MOBILE • OTA",
    heroPill: "RESMİ ANDROID PAKETİ • OTOMATİK GÜNCELLEME DESTEKLİ",
    heroTitle: "Merter Vitrini B2B Mobil Uygulaması",
    heroLeadBeforeBold:
      "Toptan hazır giyim kataloğu, canlı üretici pazarlık sohbeti ve tedarikçi kamera stüdyosu tek uygulamada. Telefonunuza yalnızca ",
    heroLeadBold: "bir kez",
    heroLeadAfterBold:
      " kurun; yeni sürümler yayınlandığında uygulama açılışta kendisini otomatik kontrol edip tek dokunuşla günceller.",
    downloadBtnPrefix: "ANDROID APK İNDİR",
    buildWord: "Yapı",
    preparingApkNotice:
      "Yeni APK paketi hazırlanıyor, lütfen birazdan yenileyin.",
    sizePrefix: "Boyut",
    stripActiveVersion: "AKTİF SÜRÜM & YAPI",
    checkingLabel: "Kontrol ediliyor...",
    stripReleaseDateSize: "YAYIN TARİHİ & BOYUT",
    currentFallback: "Güncel Sürüm",
    stripPackageSignature: "PAKET KİMLİĞİ & İMZA",
    whatsNewTitle: "BU SÜRÜMDEKİ YENİLİKLER",
    defaultReleaseNote:
      "Merter Vitrini B2B Müşteri Mağazası ve Tedarikçi Kamera Stüdyosu resmi Android sürümü. Uygulama içi otomatik güncelleme (OTA) altyapısı dahildir.",
    sha256Label: "SHA-256 Doğrulama Özeti:",
    step1Title: "1. Tek Seferlik Kurulum",
    step1Body:
      "Yukarıdaki Android APK İndir butonuna dokunun ve inen dosyayı açarak kurulumu tamamlayın. İlk yüklemede tarayıcınız için \"Bu kaynaktan yüklemeye izin ver\" seçeneğini açmanız yeterlidir.",
    step2Title: "2. Otomatik Sürüm Kontrolü (OTA)",
    step2Body:
      "Yeni bir güncelleme yayınlandığında uygulama açılışında sürümü otomatik algılar, SHA-256 bütünlük doğrulaması yapar ve tek dokunuşla kendisini günceller.",
    step3Title: "3. Müşteri Vitrini + Üretici Stüdyosu",
    step3Body:
      "Hem toptan alıcılar için seri bazlı sipariş ve canlı pazarlık hem de üreticiler için doğrudan kameradan ürün çekip vitrine yükleme stüdyosu aynı pakette yer alır.",
  },
  en: {
    backToStore: "Back to Storefront",
    topBadge: "MERTER VITRINI MOBILE • OTA",
    heroPill: "OFFICIAL ANDROID PACKAGE • OTA AUTO-UPDATE ENABLED",
    heroTitle: "Merter Vitrini B2B Wholesale Mobile App",
    heroLeadBeforeBold:
      "Full Turkish wholesale fashion catalog, live factory negotiation chat, and supplier camera studio in one unified app. Install it ",
    heroLeadBold: "just once",
    heroLeadAfterBold:
      " on your Android phone — whenever a new release ships, the app checks and updates itself with one tap.",
    downloadBtnPrefix: "DOWNLOAD ANDROID APK",
    buildWord: "Build",
    preparingApkNotice:
      "A new APK build is being prepared — please refresh shortly.",
    sizePrefix: "Size",
    stripActiveVersion: "ACTIVE VERSION & BUILD",
    checkingLabel: "Checking...",
    stripReleaseDateSize: "RELEASE DATE & SIZE",
    currentFallback: "Latest Release",
    stripPackageSignature: "PACKAGE ID & SIGNATURE",
    whatsNewTitle: "WHAT'S NEW IN THIS RELEASE",
    defaultReleaseNote:
      "Official Android release of Merter Vitrini B2B Buyer Storefront & Supplier Camera Studio with built-in SHA-256 verified OTA auto-updates.",
    sha256Label: "SHA-256 Checksum:",
    step1Title: "1. One-Time Installation",
    step1Body:
      "Tap Download Android APK above and open the downloaded package. On first install, allow \"Install unknown apps\" for your browser if prompted.",
    step2Title: "2. Automatic OTA Version Check",
    step2Body:
      "On startup, the app automatically detects new versions, verifies the SHA-256 signature, and upgrades seamlessly with one tap.",
    step3Title: "3. Buyer Storefront + Supplier Studio",
    step3Body:
      "Includes size-run pack ordering & real-time B2B factory chat for wholesale buyers plus an AI-ready mobile camera studio for Merter manufacturers.",
  },
  ru: {
    backToStore: "Вернуться на витрину",
    topBadge: "MERTER VITRINI MOBILE • OTA",
    heroPill: "ОФИЦИАЛЬНЫЙ ANDROID ПАКЕТ • АВТООБНОВЛЕНИЕ OTA",
    heroTitle: "Мобильное B2B-приложение Merter Vitrini",
    heroLeadBeforeBold:
      "Оптовый каталог одежды из Мертера, живой чат для торга с фабриками и фотостудия поставщика в одном приложении. Установите ",
    heroLeadBold: "всего один раз",
    heroLeadAfterBold:
      " — новые версии проверяются при запуске и обновляются в одно касание.",
    downloadBtnPrefix: "СКАЧАТЬ ANDROID APK",
    buildWord: "Сборка",
    preparingApkNotice:
      "Готовится новый APK-пакет, пожалуйста, обновите страницу чуть позже.",
    sizePrefix: "Размер",
    stripActiveVersion: "АКТУАЛЬНАЯ ВЕРСИЯ И СБОРКА",
    checkingLabel: "Проверка...",
    stripReleaseDateSize: "ДАТА ВЫПУСКА И РАЗМЕР",
    currentFallback: "Актуальный релиз",
    stripPackageSignature: "ID ПАКЕТА И ПОДПИСЬ",
    whatsNewTitle: "ЧТО НОВОГО В ЭТОЙ ВЕРСИИ",
    defaultReleaseNote:
      "Официальная Android-версия оптового магазина Merter Vitrini B2B и мобильной фотостудии поставщика со встроенным автообновлением OTA.",
    sha256Label: "Контрольная сумма SHA-256:",
    step1Title: "1. Однократная установка",
    step1Body:
      "Нажмите «Скачать Android APK» выше и откройте загруженный файл. При первой установке разрешите браузеру установку из этого источника.",
    step2Title: "2. Автоматическое обновление (OTA)",
    step2Body:
      "При выходе новой версии приложение само предложит обновление, проверит контрольную сумму SHA-256 и установит апдейт.",
    step3Title: "3. Витрина покупателя + Студия фабрики",
    step3Body:
      "В одном пакете: заказ размерными рядами и чат с производителями для байеров, а также быстрая загрузка моделей с камеры для поставщиков.",
  },
  ar: {
    backToStore: "العودة إلى المتجر",
    topBadge: "MERTER VITRINI MOBILE • OTA",
    heroPill: "حزمة أندرويد الرسمية • تدعم التحديث التلقائي OTA",
    heroTitle: "تطبيق Merter Vitrini B2B للجوال",
    heroLeadBeforeBold:
      "كتالوج الملابس التركية بالجملة، محادثة التفاوض المباشر مع المصانع، واستوديو كاميرا الموردين في تطبيق واحد. ثبّته ",
    heroLeadBold: "مرة واحدة فقط",
    heroLeadAfterBold:
      "؛ وعند صدور أي إصدار جديد يتحقق التطبيق تلقائياً ويحدّث نفسه بلمسة واحدة.",
    downloadBtnPrefix: "تحميل ملف ANDROID APK",
    buildWord: "بناء",
    preparingApkNotice: "جاري تجهيز حزمة APK الجديدة، يرجى التحديث بعد قليل.",
    sizePrefix: "الحجم",
    stripActiveVersion: "الإصدار النشط ورقم البناء",
    checkingLabel: "جاري التحقق...",
    stripReleaseDateSize: "تاريخ النشر والحجم",
    currentFallback: "أحدث إصدار",
    stripPackageSignature: "معرّف الحزمة والتوقيع",
    whatsNewTitle: "الجديد في هذا الإصدار",
    defaultReleaseNote:
      "الإصدار الرسمي لنظام أندرويد لمتجر Merter Vitrini B2B واستوديو كاميرا الموردين مع نظام التحديث التلقائي المدمج (OTA).",
    sha256Label: "بصمة التحقق SHA-256:",
    step1Title: "1. تثبيت لمرة واحدة",
    step1Body:
      "اضغط على زر تحميل Android APK أعلاه وافتح الملف لإكمال التثبيت، مع السماح بالتثبيت من هذا المصدر عند الطلب لأول مرة.",
    step2Title: "2. فحص التحديثات التلقائي (OTA)",
    step2Body:
      "عند توفر تحديث جديد، يكتشفه التطبيق تلقائياً ويتحقق من بصمة الأمان SHA-256 ويحدّث نفسه فوراً.",
    step3Title: "3. متجر المشتري + استوديو المصنع",
    step3Body:
      "يجمع بين طلب الباكيدجات بالجملة والتفاوض المباشر للمشترين، واستوديو تصوير ورفع المنتجات مباشرة من الكاميرا للمصانع.",
  },
  de: {
    backToStore: "Zurück zum Shop",
    topBadge: "MERTER VITRINI MOBILE • OTA",
    heroPill: "OFFIZIELLES ANDROID-PAKET • OTA-AUTO-UPDATE",
    heroTitle: "Merter Vitrini B2B Mobile-App",
    heroLeadBeforeBold:
      "Türkischer Großhandelskatalog, Live-Verhandlungs-Chat mit Herstellern und Lieferanten-Kamerastudio in einer App. Nur ",
    heroLeadBold: "einmal installieren",
    heroLeadAfterBold:
      " — neue Versionen werden beim Start automatisch geprüft und per Fingertipp aktualisiert.",
    downloadBtnPrefix: "ANDROID APK HERUNTERLADEN",
    buildWord: "Build",
    preparingApkNotice:
      "Ein neues APK-Paket wird vorbereitet. Bitte gleich aktualisieren.",
    sizePrefix: "Größe",
    stripActiveVersion: "AKTIVE VERSION & BUILD",
    checkingLabel: "Wird geprüft...",
    stripReleaseDateSize: "VERÖFFENTLICHUNG & GRÖSSE",
    currentFallback: "Aktuelle Version",
    stripPackageSignature: "PAKET-ID & SIGNATUR",
    whatsNewTitle: "NEUIGKEITEN IN DIESER VERSION",
    defaultReleaseNote:
      "Offizielle Android-Version des Merter Vitrini B2B-Großhandels & Lieferanten-Kamerastudios inklusive SHA-256-gesichertem OTA-Update.",
    sha256Label: "SHA-256-Prüfsumme:",
    step1Title: "1. Einmalige Installation",
    step1Body:
      "Tippen Sie oben auf Android APK herunterladen und öffnen Sie die Datei. Erlauben Sie beim ersten Mal die Installation über Ihren Browser.",
    step2Title: "2. Automatische OTA-Versionsprüfung",
    step2Body:
      "Neue Updates werden beim App-Start erkannt, per SHA-256 verifiziert und direkt installiert.",
    step3Title: "3. Einkäufer-Shop + Hersteller-Studio",
    step3Body:
      "Serienpaket-Bestellung & Live-Chat für Einkäufer sowie mobiles Produkt-Fotostudio für Merter Produzenten in einer Anwendung.",
  },
  fr: {
    backToStore: "Retour à la boutique",
    topBadge: "MERTER VITRINI MOBILE • OTA",
    heroPill: "PAQUET ANDROID OFFICIEL • MISE À JOUR AUTO OTA",
    heroTitle: "Application Mobile B2B Merter Vitrini",
    heroLeadBeforeBold:
      "Catalogue textile en gros, chat de négociation en direct avec les usines et studio caméra fournisseur réunis. Installez-la ",
    heroLeadBold: "une seule fois",
    heroLeadAfterBold:
      " ; l'application détecte et installe automatiquement les nouvelles versions en un geste.",
    downloadBtnPrefix: "TÉLÉCHARGER L'APK ANDROID",
    buildWord: "Build",
    preparingApkNotice:
      "Un nouveau paquet APK est en cours de préparation, veuillez rafraîchir dans un instant.",
    sizePrefix: "Taille",
    stripActiveVersion: "VERSION ACTIVE & BUILD",
    checkingLabel: "Vérification...",
    stripReleaseDateSize: "DATE DE SORTIE & TAILLE",
    currentFallback: "Version à jour",
    stripPackageSignature: "ID DU PAQUET & SIGNATURE",
    whatsNewTitle: "NOUVEAUTÉS DE CETTE VERSION",
    defaultReleaseNote:
      "Version officielle Android de la boutique B2B Merter Vitrini et du Studio Caméra Fournisseur avec mise à jour automatique OTA vérifiée par SHA-256.",
    sha256Label: "Empreinte SHA-256 :",
    step1Title: "1. Installation unique",
    step1Body:
      "Appuyez sur Télécharger l'APK Android ci-dessus et ouvrez le fichier téléchargé en autorisant votre navigateur lors de la première installation.",
    step2Title: "2. Mise à jour automatique (OTA)",
    step2Body:
      "À chaque lancement, l'application vérifie les nouvelles versions, contrôle l'intégrité SHA-256 et se met à jour en un clic.",
    step3Title: "3. Boutique Acheteur + Studio Fabricant",
    step3Body:
      "Commande par séries et négociation directe pour les acheteurs B2B, ainsi qu'un studio photo mobile pour les fabricants de Merter.",
  },
  pl: {
    backToStore: "Wróć do sklepu",
    topBadge: "MERTER VITRINI MOBILE • OTA",
    heroPill: "OFICJALNY PAKIET ANDROID • AUTO-AKTUALIZACJA OTA",
    heroTitle: "Aplikacja Mobilna Merter Vitrini B2B",
    heroLeadBeforeBold:
      "Hurtowy katalog odzieży tureckiej, czat negocjacyjny z fabrykami oraz studio kamery producenta w jednej aplikacji. Zainstaluj ",
    heroLeadBold: "tylko raz",
    heroLeadAfterBold:
      " — nowe wersje są wykrywane przy starcie i aktualizowane jednym dotknięciem.",
    downloadBtnPrefix: "POBIERZ ANDROID APK",
    buildWord: "Kompilacja",
    preparingApkNotice:
      "Nowy pakiet APK jest przygotowywany — odśwież stronę za chwilę.",
    sizePrefix: "Rozmiar",
    stripActiveVersion: "AKTYWNA WERSJA I KOMPILACJA",
    checkingLabel: "Sprawdzanie...",
    stripReleaseDateSize: "DATA WYDANIA I ROZMIAR",
    currentFallback: "Najnowsza wersja",
    stripPackageSignature: "ID PAKIETU I PODPIS",
    whatsNewTitle: "CO NOWEGO W TEJ WERSJI",
    defaultReleaseNote:
      "Oficjalne wydanie Android hurtowni Merter Vitrini B2B oraz Studia Kamery Producenta z automatycznymi aktualizacjami OTA (SHA-256).",
    sha256Label: "Suma kontrolna SHA-256:",
    step1Title: "1. Jednorazowa instalacja",
    step1Body:
      "Dotknij przycisku Pobierz Android APK powyżej i otwórz pobrany plik, zezwalając przeglądarce na instalację przy pierwszym uruchomieniu.",
    step2Title: "2. Automatyczna kontrola wersji (OTA)",
    step2Body:
      "Po wydaniu aktualizacji aplikacja wykrywa ją automatycznie, weryfikuje podpis SHA-256 i instaluje nową wersję.",
    step3Title: "3. Hurtownia B2B + Studio Producenta",
    step3Body:
      "Zamówienia w paczkach (seriach) i negocjacje na żywo dla kupców oraz mobilne studio fotograficzne dla dostawców z Merter.",
  },
  bg: {
    backToStore: "Обратно към витрината",
    topBadge: "MERTER VITRINI MOBILE • OTA",
    heroPill: "ОФИЦИАЛЕН ANDROID ПАКЕТ • АВТОМАТИЧНО OTA ОБНОВЯВАНЕ",
    heroTitle: "Мобилно B2B приложение Merter Vitrini",
    heroLeadBeforeBold:
      "Каталог за дрехи на едро, чат за договаряне с производители и камера-студио за доставчици в едно приложение. Инсталирайте ",
    heroLeadBold: "само веднъж",
    heroLeadAfterBold:
      " — при нова версия приложението автоматично проверява и се обновява с едно докосване.",
    downloadBtnPrefix: "ИЗТЕГЛИ ANDROID APK",
    buildWord: "Компилация",
    preparingApkNotice:
      "Подготвя се нов APK пакет, моля опреснете след малко.",
    sizePrefix: "Размер",
    stripActiveVersion: "АКТИВНА ВЕРСИЯ И КОМПИЛАЦИЯ",
    checkingLabel: "Проверка...",
    stripReleaseDateSize: "ДАТА НА ПУБЛИКУВАНЕ И РАЗМЕР",
    currentFallback: "Актуална версия",
    stripPackageSignature: "ПАКЕТЕН ID И ПОДПИС",
    whatsNewTitle: "НОВОСТИ В ТАЗИ ВЕРСИЯ",
    defaultReleaseNote:
      "Официална Android версия на B2B магазина Merter Vitrini и Камера Студиото за доставчици с вградено OTA обновяване (SHA-256).",
    sha256Label: "SHA-256 контролна сума:",
    step1Title: "1. Еднократна инсталация",
    step1Body:
      "Натиснете Изтегли Android APK по-горе и отворете изтегления файл. При първо инсталиране разрешете инсталация от браузъра си.",
    step2Title: "2. Автоматично OTA обновяване",
    step2Body:
      "При нова версия приложението я разпознава при стартиране, проверява SHA-256 подписа и се обновява автоматично.",
    step3Title: "3. Магазин за купувачи + Студио за фабрики",
    step3Body:
      "Поръчки на серии и директен чат за търговци на едро плюс мобилно студио за заснемане и качване на модели за производители.",
  },
};

function formatBytesToMb(bytes: number): string {
  if (!bytes || bytes <= 0) {
    return "—";
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatPublishedDate(
  iso: string,
  locale: string,
  fallback: string
): string {
  if (!iso) {
    return fallback;
  }
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }
  return parsed.toLocaleString(locale, {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface MobileAppDownloadClientProps {
  readonly initialLang?: SupportedSeoLang;
}

export default function MobileAppDownloadClient({
  initialLang = "tr",
}: MobileAppDownloadClientProps) {
  const router = useRouter();
  const [lang, setLang] = useState<SupportedSeoLang>(initialLang);
  const [manifest, setManifest] = useState<MobileVersionManifest | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const safeLang = normalizeSeoLang(lang, "tr");
  const copy = MOBILE_APP_COPY[safeLang];
  const intlLocale = INTL_LOCALE_BY_LANG[safeLang];

  useEffect(() => {
    let active = true;
    async function fetchManifest() {
      try {
        const res = await fetch("/api/v1/mobile/version", {
          cache: "no-store",
        });
        if (res.ok) {
          const data = (await res.json()) as MobileVersionManifest;
          if (active) {
            setManifest(data);
          }
        }
      } catch {
        // Fallback metadata rendered gracefully when offline
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    void fetchManifest();
    return () => {
      active = false;
    };
  }, []);

  const handleLangSelect = (targetLang: SupportedSeoLang) => {
    setLang(targetLang);
    router.push(
      targetLang === "tr"
        ? "/mobil-uygulama"
        : `/mobil-uygulama?lang=${targetLang}`
    );
  };

  const versionLabel = manifest
    ? `v${manifest.version} (${copy.buildWord} #${manifest.build_number})`
    : `v1.0.0 (${copy.buildWord} #1)`;
  const sizeLabel = manifest ? formatBytesToMb(manifest.file_size_bytes) : "—";
  const releaseNote =
    manifest?.release_notes?.[safeLang] ||
    manifest?.release_notes?.en ||
    manifest?.release_notes?.tr ||
    copy.defaultReleaseNote;
  const apkAvailable = manifest ? manifest.apk_available : true;

  return (
    <main
      dir={safeLang === "ar" ? "rtl" : "ltr"}
      className="min-h-screen bg-[#FAFAFA] text-[#111111] py-10 px-4 sm:px-8"
    >
      <div className="max-w-5xl mx-auto">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <Link
            href={`/${safeLang}`}
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[1.5px] text-zinc-600 hover:text-black transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{copy.backToStore}</span>
          </Link>

          <div className="flex flex-wrap items-center gap-1.5">
            {SUPPORTED_SEO_LANGS.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => handleLangSelect(code)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase cursor-pointer border transition-colors ${
                  safeLang === code
                    ? "bg-amber-600 text-white border-amber-600"
                    : "bg-white text-zinc-600 border-zinc-200 hover:border-amber-400"
                }`}
              >
                {code}
              </button>
            ))}
          </div>

          <span className="text-[11px] font-bold tracking-[2px] uppercase text-[#8A6D1F]">
            {copy.topBadge}
          </span>
        </div>

        {/* Hero Download Card */}
        <section className="bg-white rounded-3xl border border-amber-200/80 shadow-xs overflow-hidden">
          <div className="bg-gradient-to-br from-amber-50/90 via-white to-emerald-50/50 border-b border-amber-200/60 text-slate-900 px-6 sm:px-10 py-10 sm:py-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100/80 border border-amber-200 text-[11px] font-extrabold tracking-[1.5px] uppercase text-amber-800 mb-5">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>{copy.heroPill}</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight text-slate-900">
              {copy.heroTitle}
            </h1>
            <p className="mt-3 text-sm sm:text-base text-slate-600 max-w-2xl leading-relaxed">
              {copy.heroLeadBeforeBold}
              <strong className="text-slate-900">{copy.heroLeadBold}</strong>
              {copy.heroLeadAfterBold}
            </p>

            <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-4">
              {apkAvailable ? (
                <a
                  href="/api/v1/mobile/apk"
                  download
                  className="inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs sm:text-sm tracking-[1.5px] uppercase transition-colors no-underline shadow-xs"
                >
                  <Download className="w-5 h-5 shrink-0" />
                  <span>
                    {copy.downloadBtnPrefix} ({versionLabel})
                  </span>
                </a>
              ) : (
                <div className="inline-flex items-center gap-3 px-6 py-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold uppercase tracking-wider">
                  <span>{copy.preparingApkNotice}</span>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  <Smartphone className="w-4 h-4 text-amber-600" />
                  <span>Android 7.0+ (ARM64 / Universal)</span>
                </span>
                {sizeLabel !== "—" && (
                  <span className="font-mono text-slate-700 font-bold">
                    {copy.sizePrefix}: {sizeLabel}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Live Version Metadata Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#EAEAEA] bg-[#FCFCFC] text-xs">
            <div className="px-6 py-4">
              <div className="text-[10px] font-bold uppercase tracking-[1.5px] text-zinc-400">
                {copy.stripActiveVersion}
              </div>
              <div className="mt-1 font-extrabold text-sm text-[#111111]">
                {loading ? copy.checkingLabel : versionLabel}
              </div>
            </div>
            <div className="px-6 py-4">
              <div className="text-[10px] font-bold uppercase tracking-[1.5px] text-zinc-400">
                {copy.stripReleaseDateSize}
              </div>
              <div className="mt-1 font-bold text-[#111111]">
                {manifest
                  ? formatPublishedDate(
                      manifest.published_at,
                      intlLocale,
                      copy.currentFallback
                    )
                  : copy.currentFallback}{" "}
                • {sizeLabel}
              </div>
            </div>
            <div className="px-6 py-4">
              <div className="text-[10px] font-bold uppercase tracking-[1.5px] text-zinc-400">
                {copy.stripPackageSignature}
              </div>
              <div className="mt-1 font-mono text-[11px] text-zinc-700 truncate">
                {manifest?.package_id || "com.mertervitrini.app"} (Release Signed)
              </div>
            </div>
          </div>

          {/* Release Notes & SHA-256 */}
          <div className="p-6 sm:p-10 border-t border-[#EAEAEA] space-y-6">
            <div>
              <h2 className="text-xs font-extrabold uppercase tracking-[2px] text-[#111111] mb-2">
                {copy.whatsNewTitle}
              </h2>
              <p className="text-sm text-zinc-600 leading-relaxed">{releaseNote}</p>
            </div>

            {manifest?.sha256 && (
              <div className="p-4 rounded-xl bg-[#FAFAFA] border border-[#EAEAEA] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-zinc-700">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{copy.sha256Label}</span>
                </div>
                <code className="text-[11px] font-mono text-zinc-500 break-all">
                  {manifest.sha256}
                </code>
              </div>
            )}
          </div>
        </section>

        {/* How Self-Update Works + Dual Role Highlights */}
        <section className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white rounded-2xl border border-[#EAEAEA] p-6">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <h3 className="text-xs font-extrabold uppercase tracking-[1.5px] mb-2">
              {copy.step1Title}
            </h3>
            <p className="text-xs text-zinc-600 leading-relaxed">
              {copy.step1Body}
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-[#EAEAEA] p-6">
            <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-200 text-sky-700 flex items-center justify-center mb-4">
              <RefreshCw className="w-4 h-4 text-sky-600" />
            </div>
            <h3 className="text-xs font-extrabold uppercase tracking-[1.5px] mb-2">
              {copy.step2Title}
            </h3>
            <p className="text-xs text-zinc-600 leading-relaxed">
              {copy.step2Body}
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-[#EAEAEA] p-6">
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mb-4">
              <div className="flex items-center gap-0.5">
                <ShoppingBag className="w-3.5 h-3.5 text-amber-600" />
                <Camera className="w-3.5 h-3.5 text-amber-700" />
              </div>
            </div>
            <h3 className="text-xs font-extrabold uppercase tracking-[1.5px] mb-2">
              {copy.step3Title}
            </h3>
            <p className="text-xs text-zinc-600 leading-relaxed">
              {copy.step3Body}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
