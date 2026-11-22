export type ConsentLang = "tr" | "en" | "ru" | "ar" | "de" | "fr" | "pl" | "bg";

export interface CategoryTranslation {
  title: string;
  description: string;
}

export interface ConsentLocaleCopy {
  badge: string;
  bannerTitle: string;
  bannerDescription: string;
  hostingNote: string;
  acceptAll: string;
  rejectAll: string;
  customize: string;
  cookiePolicyLabel: string;
  dialogTitle: string;
  dialogSubtitle: string;
  alwaysActive: string;
  savePreferences: string;
  closeLabel: string;
  preferencesTrigger: string;
  footerPolicyLink: string;
  footerSettingsButton: string;
  categories: {
    necessary: CategoryTranslation;
    functionality: CategoryTranslation;
    experience: CategoryTranslation;
    measurement: CategoryTranslation;
    marketing: CategoryTranslation;
  };
  table: {
    title: string;
    cookieName: string;
    provider: string;
    storageType: string;
    duration: string;
    purpose: string;
    thirdParty: string;
    firstParty: string;
    emptyInventory: string;
  };
  receipt: {
    title: string;
    refLabel: string;
    timeLabel: string;
    entryHashLabel: string;
    snapshotHashLabel: string;
    anchoredBadge: string;
    pendingBadge: string;
    explain: string;
    copyRef: string;
    copied: string;
  };
}

const VALID_LANGS: readonly ConsentLang[] = [
  "tr",
  "en",
  "ru",
  "ar",
  "de",
  "fr",
  "pl",
  "bg",
];

export function normalizeConsentLang(raw?: string | null): ConsentLang {
  const cleaned = String(raw || "tr").toLowerCase().trim().slice(0, 2);
  if ((VALID_LANGS as readonly string[]).includes(cleaned)) {
    return cleaned as ConsentLang;
  }
  return "tr";
}

export const CONSENT_UI_COPY: Record<ConsentLang, ConsentLocaleCopy> = {
  tr: {
    badge: "KVKK & GDPR • Zaman Damgalı İspat",
    bannerTitle: "Çerez Tercihleri & Gizlilik Kontrolü",
    bannerDescription:
      "Merter Vitrini toptan B2B platformunda güvenliğiniz için zorunlu çerezler kullanılır. Ölçümleme ve pazarlama çerezleri açık rızanızla etkinleştirilir ve her tercihiniz değiştirilemez SHA-256 + RFC 3161 zaman damgasıyla kayıt altına alınır.",
    hostingNote:
      "Not: Merter Vitrini 5651 sayılı Kanun kapsamında yer sağlayıcı B2B platformudur; alışveriş ve faturalama doğrudan ilgili toptan tedarikçi ile yürütülür.",
    acceptAll: "Tümünü Kabul Et",
    rejectAll: "Zorunlu Olanlar Dışında Reddet",
    customize: "Tercihleri Yönet",
    cookiePolicyLabel: "Çerez Politikası",
    dialogTitle: "Gizlilik & Çerez Tercih Merkezi",
    dialogSubtitle:
      "Kategori bazında izinlerinizi yönetin. İstediğiniz zaman tercihlerinizi güncelleyebilir veya geri çekebilirsiniz.",
    alwaysActive: "Her Zaman Aktif",
    savePreferences: "Seçimlerimi Kaydet",
    closeLabel: "Kapat",
    preferencesTrigger: "Çerez Tercihleri",
    footerPolicyLink: "Çerez Politikası",
    footerSettingsButton: "Çerez Tercihleri",
    categories: {
      necessary: {
        title: "Zorunlu Çerezler (Güvenlik & Oturum)",
        description:
          "Üyelik oturumu, toptan seri sepeti, bot/spam koruması (reCAPTCHA) ve rıza kayıtlarının saklanması için teknik olarak zorunludur.",
      },
      functionality: {
        title: "İşlevsellik & Tercihler",
        description:
          "Seçtiğiniz dil (8 dil) ve para birimi (TRY/USD/EUR/GBP) gibi arayüz kolaylıklarını hatırlar.",
      },
      experience: {
        title: "Kişiselleştirilmiş B2B Deneyimi",
        description:
          "İlgilendiğiniz giyim kategorileri ve uyumlu tedarikçi vitrinlerini size daha hızlı sunmamıza yardımcı olur.",
      },
      measurement: {
        title: "Analitik & Performans Ölçümü (Consent Mode v2)",
        description:
          "Google Analytics 4 ve anonim site trafiği ölçümlerini yürütür; reddedildiğinde çerezsiz mod uygulanır ve mevcut _ga çerezleri temizlenir.",
      },
      marketing: {
        title: "Pazarlama & Dönüşüm İlişkilendirme",
        description:
          "Kampanya ve reklam dönüşümlerini yalnızca açık onayınız halinde ölçer.",
      },
    },
    table: {
      title: "Bu Kategorideki Tanımlı Çerezler ve Teknolojiler",
      cookieName: "Çerez / Anahtar",
      provider: "Sağlayıcı",
      storageType: "Tür",
      duration: "Süre",
      purpose: "Kullanım Amacı",
      thirdParty: "3. Taraf",
      firstParty: "1. Taraf",
      emptyInventory: "Bu kategori için tanımlı ek çerez kaydı bulunmuyor.",
    },
    receipt: {
      title: "Kriptografik Rıza Makbuzunuz (Bilirkişi Doğrulanabilir)",
      refLabel: "Rıza Referans No",
      timeLabel: "UTC Kayıt Zamanı",
      entryHashLabel: "Zincir Hash (SHA-256)",
      snapshotHashLabel: "Politika Metni Özeti",
      anchoredBadge: "RFC 3161 TSA Mühürlü",
      pendingBadge: "Zincir Mühürlü • Toplu TSA Kuyruğunda",
      explain:
        "E-imza gerektirmeden değiştirilemezlik garantisi: Her tercih değişikliği WORM veritabanında önceki kayda SHA-256 ile bağlanır ve bağımsız RFC 3161 Zaman Damgası Otoritesi (DigiCert/Sectigo/FreeTSA) Merkle köküne mühürlenir.",
      copyRef: "Kodu Kopyala",
      copied: "Kopyalandı",
    },
  },
  en: {
    badge: "KVKK & GDPR • Timestamped Proof",
    bannerTitle: "Cookie Preferences & Privacy Control",
    bannerDescription:
      "We use strictly necessary cookies for session security and B2B wholesale cart integrity. Analytics and marketing cookies remain disabled unless you opt in. Every decision is sealed in an immutable SHA-256 + RFC 3161 ledger.",
    hostingNote:
      "Note: Merter Vitrini operates as a hosting marketplace intermediary; wholesale transactions occur directly between buyers and verified suppliers.",
    acceptAll: "Accept All",
    rejectAll: "Reject Optional Cookies",
    customize: "Manage Preferences",
    cookiePolicyLabel: "Cookie Policy",
    dialogTitle: "Privacy & Cookie Preference Center",
    dialogSubtitle:
      "Control consent category by category. You may update or withdraw your consent at any time.",
    alwaysActive: "Always Active",
    savePreferences: "Save My Preferences",
    closeLabel: "Close",
    preferencesTrigger: "Cookie Preferences",
    footerPolicyLink: "Cookie Policy",
    footerSettingsButton: "Cookie Preferences",
    categories: {
      necessary: {
        title: "Strictly Necessary Cookies",
        description:
          "Required for authentication, wholesale series cart state, anti-bot security (reCAPTCHA), and storing your consent receipt.",
      },
      functionality: {
        title: "Functionality & Localization",
        description:
          "Remembers your selected display language (8 locales) and preferred currency across sessions.",
      },
      experience: {
        title: "Personalization & Storefront Experience",
        description:
          "Helps prioritize relevant wholesale categories and supplier showcases based on browsing preferences.",
      },
      measurement: {
        title: "Analytics & Measurement (Consent Mode v2)",
        description:
          "Enables Google Analytics 4 and catalog performance analytics. Revoking automatically purges measurement cookies.",
      },
      marketing: {
        title: "Marketing & Conversion Attribution",
        description:
          "Measures advertising campaign performance strictly when explicitly enabled by you.",
      },
    },
    table: {
      title: "Declared Cookies & Scripts in This Category",
      cookieName: "Cookie / Key",
      provider: "Provider",
      storageType: "Storage",
      duration: "Retention",
      purpose: "Purpose",
      thirdParty: "3rd Party",
      firstParty: "1st Party",
      emptyInventory: "No extra trackers registered under this category.",
    },
    receipt: {
      title: "Verifiable Cryptographic Consent Receipt",
      refLabel: "Consent Reference",
      timeLabel: "UTC Timestamp",
      entryHashLabel: "Ledger Entry SHA-256",
      snapshotHashLabel: "Policy Snapshot Hash",
      anchoredBadge: "RFC 3161 TSA Sealed",
      pendingBadge: "Hash-Chained • Next TSA Batch",
      explain:
        "Tamper-evident forensic integrity without e-signature: each decision links to the prior SHA-256 chain entry and anchors into an independent RFC 3161 Time Stamping Authority Merkle root.",
      copyRef: "Copy Ref ID",
      copied: "Copied",
    },
  },
  ru: {
    badge: "KVKK & GDPR • Криптографическое доказательство",
    bannerTitle: "Настройки файлов cookie и конфиденциальность",
    bannerDescription:
      "Необходимые cookie обеспечивают безопасность сессии и оптовой корзины. Аналитика и маркетинг включаются только с вашего согласия и фиксируются в неизменяемом журнале SHA-256 + RFC 3161.",
    hostingNote:
      "Примечание: Merter Vitrini — B2B хостинг-платформа; сделки заключаются напрямую между покупателем и оптовым поставщиком.",
    acceptAll: "Принять все",
    rejectAll: "Только необходимые",
    customize: "Настроить выбор",
    cookiePolicyLabel: "Политика Cookie",
    dialogTitle: "Центр управления согласием на cookie",
    dialogSubtitle:
      "Управляйте каждой категорией отдельно. Вы можете изменить или отозвать согласие в любое время.",
    alwaysActive: "Всегда активно",
    savePreferences: "Сохранить настройки",
    closeLabel: "Закрыть",
    preferencesTrigger: "Настройки Cookie",
    footerPolicyLink: "Политика Cookie",
    footerSettingsButton: "Настройки Cookie",
    categories: {
      necessary: {
        title: "Строго необходимые cookie",
        description:
          "Необходимы для входа, корзины серий, защиты от ботов и сохранения вашего выбора согласия.",
      },
      functionality: {
        title: "Функциональные предпочтения",
        description:
          "Запоминают выбранный язык интерфейса и валюту (TRY/USD/EUR/GBP).",
      },
      experience: {
        title: "Персонализация B2B каталога",
        description:
          "Помогают быстрее отображать подходящие категории и витрины поставщиков.",
      },
      measurement: {
        title: "Аналитика (Google Consent Mode v2)",
        description:
          "Измерение посещаемости и поиска. При отказе cookie аналитики автоматически удаляются.",
      },
      marketing: {
        title: "Маркетинг и реклама",
        description:
          "Оценка рекламных кампаний только при вашем прямом согласии.",
      },
    },
    table: {
      title: "Используемые cookie и скрипты в категории",
      cookieName: "Имя / Ключ",
      provider: "Провайдер",
      storageType: "Тип",
      duration: "Срок",
      purpose: "Назначение",
      thirdParty: "Сторонний",
      firstParty: "Собственный",
      emptyInventory: "Дополнительные cookie не зарегистрированы.",
    },
    receipt: {
      title: "Криптографическая квитанция согласия",
      refLabel: "Номер записи",
      timeLabel: "Время UTC",
      entryHashLabel: "Хеш цепочки SHA-256",
      snapshotHashLabel: "Хеш версии политики",
      anchoredBadge: "Печать RFC 3161 TSA",
      pendingBadge: "В цепочке SHA-256 • Ожидает TSA",
      explain:
        "Гарантия неизменности без ЭЦП: каждая запись связана с предыдущей по SHA-256 и закрепляется в дереве Меркла независимого центра штампов времени RFC 3161.",
      copyRef: "Копировать ID",
      copied: "Скопировано",
    },
  },
  ar: {
    badge: "KVKK & GDPR • إثبات ختم زمني موثّق",
    bannerTitle: "تفضيلات ملفات تعريف الارتباط والخصوصية",
    bannerDescription:
      "نستخدم ملفات تعريف ارتباط ضرورية لأمان الجلسة وسلة الجملة. تظل ملفات التحليلات والتسويق معطلة حتى تمنح موافقتك الصريحة، ويُوثَّق كل اختيار بسجل مشفّر غير قابل للتعديل.",
    hostingNote:
      "ملاحظة: منصة Merter Vitrini وسيط استضافة رقمي، وتتم المبيعات والالتزامات مباشرة مع المورّد المعتمد.",
    acceptAll: "قبول الكل",
    rejectAll: "رفض الاختيارية",
    customize: "تخصيص التفضيلات",
    cookiePolicyLabel: "سياسة ملفات الارتباط",
    dialogTitle: "مركز التحكم في الخصوصية وملفات الارتباط",
    dialogSubtitle:
      "يمكنك تفعيل أو إيقاف كل فئة على حدة وتعديل موافقتك أو سحبها في أي وقت.",
    alwaysActive: "مفعّل دائماً",
    savePreferences: "حفظ الاختيارات",
    closeLabel: "إغلاق",
    preferencesTrigger: "تفضيلات الخصوصية",
    footerPolicyLink: "سياسة ملفات الارتباط",
    footerSettingsButton: "تفضيلات الخصوصية",
    categories: {
      necessary: {
        title: "ملفات الارتباط الضرورية",
        description:
          "ضرورية لتسجيل الدخول، وحفظ سلة الجملة، والحماية الأمنية، وحفظ سجل موافقتك.",
      },
      functionality: {
        title: "التفضيلات والوظائف",
        description: "تحفظ اللغة والعملة المفضلة لديك عبر الزيارات.",
      },
      experience: {
        title: "تخصيص تجربة العرض B2B",
        description:
          "تساعد في عرض الفئات والموردين الأنسب لنشاطك التجاري بشكل أسرع.",
      },
      measurement: {
        title: "القياسات والتحليلات (Consent Mode v2)",
        description:
          "تحليل أداء الكتالوج والبحث مع حذف تلقائي عند سحب الموافقة.",
      },
      marketing: {
        title: "التسويق والإعلانات",
        description:
          "تُستخدم فقط عند موافقتك الصريحة لقياس فعالية الحملات الإعلانية.",
      },
    },
    table: {
      title: "قائمة ملفات الارتباط المسجّلة ضمن هذه الفئة",
      cookieName: "الاسم / المفتاح",
      provider: "المزوّد",
      storageType: "النوع",
      duration: "المدة",
      purpose: "الغرض",
      thirdParty: "طرف ثالث",
      firstParty: "طرف أول",
      emptyInventory: "لا توجد ملفات إضافية مسجلة في هذه الفئة.",
    },
    receipt: {
      title: "إيصال الموافقة التشفيري الموثّق للخبراء",
      refLabel: "مرجع الموافقة",
      timeLabel: "الوقت العالمي UTC",
      entryHashLabel: "تجزئة السلسلة SHA-256",
      snapshotHashLabel: "تجزئة نسخة السياسة",
      anchoredBadge: "مختوم بـ RFC 3161 TSA",
      pendingBadge: "سلسلة SHA-256 • بانتظار ختم TSA",
      explain:
        "حماية من التلاعب دون توقيع إلكتروني: يرتبط كل سجل بالسجل السابق عبر SHA-256 ويُختم بجذر ميركل لدى سلطة ختم زمني مستقلة وفق RFC 3161.",
      copyRef: "نسخ الرمز",
      copied: "تم النسخ",
    },
  },
  de: {
    badge: "DSGVO & KVKK • Zeitgestempelter Nachweis",
    bannerTitle: "Cookie-Einstellungen & Datenschutz",
    bannerDescription:
      "Wir verwenden technisch notwendige Cookies für Sitzungssicherheit und B2B-Warenkorb. Analyse- und Marketing-Cookies werden erst nach Ihrer Einwilligung aktiv und revisionssicher mit SHA-256 + RFC 3161 protokolliert.",
    hostingNote:
      "Hinweis: Merter Vitrini ist eine B2B-Vermittlungsplattform; Kaufverträge und Abrechnung erfolgen direkt mit dem jeweiligen Großhändler.",
    acceptAll: "Alle akzeptieren",
    rejectAll: "Optionale ablehnen",
    customize: "Präferenzen verwalten",
    cookiePolicyLabel: "Cookie-Richtlinie",
    dialogTitle: "Datenschutz- & Cookie-Präferenzzentrum",
    dialogSubtitle:
      "Verwalten Sie Ihre Einwilligungen nach Kategorie. Sie können Ihre Wahl jederzeit ändern oder widerrufen.",
    alwaysActive: "Immer aktiv",
    savePreferences: "Auswahl speichern",
    closeLabel: "Schließen",
    preferencesTrigger: "Cookie-Einstellungen",
    footerPolicyLink: "Cookie-Richtlinie",
    footerSettingsButton: "Cookie-Einstellungen",
    categories: {
      necessary: {
        title: "Unbedingt erforderliche Cookies",
        description:
          "Erforderlich für Login, B2B-Serienwarenkorb, Bot-Schutz (reCAPTCHA) und Speicherung des Einwilligungsnachweises.",
      },
      functionality: {
        title: "Funktionalität & Präferenzen",
        description: "Speichert gewählte Sprache und Anzeigewährung.",
      },
      experience: {
        title: "Personalisierte B2B-Darstellung",
        description:
          "Optimiert die Anzeige relevanter Großhandelskategorien und Lieferanten-Showrooms.",
      },
      measurement: {
        title: "Reichweitenmessung (Consent Mode v2)",
        description:
          "Google Analytics 4 & anonyme Katalogstatistiken; beim Widerruf automatisch gelöscht.",
      },
      marketing: {
        title: "Marketing & Konversionsmessung",
        description:
          "Misst Kampagnenleistung ausschließlich bei ausdrücklicher Zustimmung.",
      },
    },
    table: {
      title: "Deklarierte Cookies & Skripte in dieser Kategorie",
      cookieName: "Cookie / Schlüssel",
      provider: "Anbieter",
      storageType: "Typ",
      duration: "Laufzeit",
      purpose: "Zweck",
      thirdParty: "Drittanbieter",
      firstParty: "Erstanbieter",
      emptyInventory: "Keine weiteren Einträge in dieser Kategorie.",
    },
    receipt: {
      title: "Kryptographischer Einwilligungsnachweis",
      refLabel: "Referenz-ID",
      timeLabel: "UTC-Zeitstempel",
      entryHashLabel: "Ketten-Hash SHA-256",
      snapshotHashLabel: "Richtlinien-Hash",
      anchoredBadge: "RFC 3161 TSA versiegelt",
      pendingBadge: "SHA-256-verkettet • TSA-Warteschlange",
      explain:
        "Manipulationssicher ohne E-Signatur: Jede Wahl wird per SHA-256 verkettet und über Merkle-Wurzeln bei unabhängigen RFC-3161-Zeitstempelstellen verankert.",
      copyRef: "ID kopieren",
      copied: "Kopiert",
    },
  },
  fr: {
    badge: "RGPD & KVKK • Preuve Horodatée",
    bannerTitle: "Préférences de Cookies & Confidentialité",
    bannerDescription:
      "Des cookies strictement nécessaires assurent la sécurité B2B et votre panier. Les cookies de mesure et marketing restent bloqués sans consentement explicite et chaque choix est scellé par chaîne SHA-256 + RFC 3161.",
    hostingNote:
      "Note : Merter Vitrini agit en tant qu’hébergeur B2B ; les commandes et transactions s’effectuent directement auprès de chaque fournisseur.",
    acceptAll: "Tout accepter",
    rejectAll: "Refuser les optionnels",
    customize: "Personnaliser",
    cookiePolicyLabel: "Politique de Cookies",
    dialogTitle: "Centre de Préférences des Cookies",
    dialogSubtitle:
      "Gérez vos consentements par finalité. Vous pouvez modifier ou retirer votre accord à tout moment.",
    alwaysActive: "Toujours actif",
    savePreferences: "Enregistrer mes choix",
    closeLabel: "Fermer",
    preferencesTrigger: "Gestion des Cookies",
    footerPolicyLink: "Politique de Cookies",
    footerSettingsButton: "Gestion des Cookies",
    categories: {
      necessary: {
        title: "Cookies strictement nécessaires",
        description:
          "Indispensables pour l’authentification, le panier B2B, l’anti-bot et la conservation de votre preuve de choix.",
      },
      functionality: {
        title: "Fonctionnalité & Langue",
        description: "Mémorise votre langue et devise préférées.",
      },
      experience: {
        title: "Expérience B2B Personnalisée",
        description:
          "Facilite la mise en avant des catégories et grossistes pertinents.",
      },
      measurement: {
        title: "Mesure d’audience (Consent Mode v2)",
        description:
          "Statistiques Google Analytics 4 et catalogue ; supprimés automatiquement en cas de retrait.",
      },
      marketing: {
        title: "Marketing & Publicité",
        description:
          "Évalue l’efficacité publicitaire uniquement après votre accord explicite.",
      },
    },
    table: {
      title: "Cookies et traceurs déclarés dans cette catégorie",
      cookieName: "Cookie / Clé",
      provider: "Fournisseur",
      storageType: "Type",
      duration: "Durée",
      purpose: "Finalité",
      thirdParty: "Tiers",
      firstParty: "Interne",
      emptyInventory: "Aucun autre cookie déclaré pour cette finalité.",
    },
    receipt: {
      title: "Reçu Cryptographique de Consentement",
      refLabel: "Référence",
      timeLabel: "Horodatage UTC",
      entryHashLabel: "Empreinte SHA-256",
      snapshotHashLabel: "Hash Politique",
      anchoredBadge: "Scellé RFC 3161 TSA",
      pendingBadge: "Chaîné SHA-256 • File TSA",
      explain:
        "Intégrité prouvée sans signature électronique : chaque choix est chaîné en SHA-256 et ancré via arbre de Merkle auprès d’autorités d’horodatage RFC 3161 indépendantes.",
      copyRef: "Copier l’ID",
      copied: "Copié",
    },
  },
  pl: {
    badge: "RODO & KVKK • Znacznik Czasu",
    bannerTitle: "Ustawienia Plików Cookie i Prywatności",
    bannerDescription:
      "Niezbędne pliki cookie chronią sesję i koszyk hurtowy B2B. Analityka i marketing działają wyłącznie po wyrażeniu zgody, a każda decyzja jest utrwalana w rejestrze SHA-256 + RFC 3161.",
    hostingNote:
      "Uwaga: Merter Vitrini działa jako platforma B2B; transakcje i rozliczenia odbywają się bezpośrednio ze zweryfikowanym dostawcą.",
    acceptAll: "Zaakceptuj wszystkie",
    rejectAll: "Odrzuć opcjonalne",
    customize: "Zarządzaj preferencjami",
    cookiePolicyLabel: "Polityka Cookie",
    dialogTitle: "Centrum Preferencji Plików Cookie",
    dialogSubtitle:
      "Zarządzaj zgodami w podziale na kategorie. Możesz zmienić lub wycofać zgodę w dowolnej chwili.",
    alwaysActive: "Zawsze aktywne",
    savePreferences: "Zapisz ustawienia",
    closeLabel: "Zamknij",
    preferencesTrigger: "Preferencje Cookie",
    footerPolicyLink: "Polityka Cookie",
    footerSettingsButton: "Preferencje Cookie",
    categories: {
      necessary: {
        title: "Niezbędne pliki cookie",
        description:
          "Konieczne do logowania, koszyka pakietów B2B, ochrony przed botami i zapisu dowodu zgody.",
      },
      functionality: {
        title: "Funkcjonalność i preferencje",
        description: "Zapamiętuje wybrany język i walutę wyświetlania.",
      },
      experience: {
        title: "Personalizacja katalogu B2B",
        description:
          "Ułatwia dopasowanie widocznych kategorii i dostawców odzieżowych.",
      },
      measurement: {
        title: "Analityka (Consent Mode v2)",
        description:
          "Statystyki Google Analytics 4 i wydajności; automatycznie usuwane po wycofaniu zgody.",
      },
      marketing: {
        title: "Marketing i konwersje",
        description:
          "Mierzy skuteczność kampanii wyłącznie po wyraźnej zgodzie.",
      },
    },
    table: {
      title: "Zadeklarowane pliki cookie w tej kategorii",
      cookieName: "Nazwa / Klucz",
      provider: "Dostawca",
      storageType: "Typ",
      duration: "Okres",
      purpose: "Cel",
      thirdParty: "Zewnętrzny",
      firstParty: "Własny",
      emptyInventory: "Brak dodatkowych wpisów w tej kategorii.",
    },
    receipt: {
      title: "Kryptograficzne Potwierdzenie Zgody",
      refLabel: "Numer referencyjny",
      timeLabel: "Czas UTC",
      entryHashLabel: "Skrót łańcucha SHA-256",
      snapshotHashLabel: "Skrót treści polityki",
      anchoredBadge: "Zapieczętowane RFC 3161 TSA",
      pendingBadge: "Łańcuch SHA-256 • Kolejka TSA",
      explain:
        "Nienaruszalność bez e-podpisu: każdy wpis łączy się z poprzednim przez SHA-256 i jest kotwiczony korzeniem Merkle w niezależnym urzędzie znaczników czasu RFC 3161.",
      copyRef: "Kopiuj ID",
      copied: "Skopiowano",
    },
  },
  bg: {
    badge: "GDPR & KVKK • Времеви Печат",
    bannerTitle: "Предпочитания за бисквитки и поверителност",
    bannerDescription:
      "Задължителните бисквитки защитават сесията и B2B количката. Анализът и маркетингът се активират само след вашето изрично съгласие и се записват в неизменим дневник SHA-256 + RFC 3161.",
    hostingNote:
      "Бележка: Merter Vitrini е B2B платформа; сделките и фактурирането се извършват директно със съответния доставчик.",
    acceptAll: "Приеми всички",
    rejectAll: "Откажи незадължителните",
    customize: "Управление на настройки",
    cookiePolicyLabel: "Политика за бисквитки",
    dialogTitle: "Център за управление на бисквитки",
    dialogSubtitle:
      "Контролирайте разрешенията по категории. Можете да промените или оттеглите съгласието си по всяко време.",
    alwaysActive: "Винаги активни",
    savePreferences: "Запази избора ми",
    closeLabel: "Затвори",
    preferencesTrigger: "Настройки на бисквитки",
    footerPolicyLink: "Политика за бисквитки",
    footerSettingsButton: "Настройки на бисквитки",
    categories: {
      necessary: {
        title: "Строго необходими бисквитки",
        description:
          "Нужни за удостоверяване, B2B количка, защита от ботове и съхраняване на доказателство за съгласие.",
      },
      functionality: {
        title: "Функционалност и език",
        description: "Запомня избрания език и предпочитана валута.",
      },
      experience: {
        title: "Персонализирано B2B изживяване",
        description:
          "Помага за по-бързо показване на релевантни категории и производители.",
      },
      measurement: {
        title: "Статистика (Consent Mode v2)",
        description:
          "Измерване чрез Google Analytics 4; автоматично се изчиства при отказ.",
      },
      marketing: {
        title: "Маркетинг и реклама",
        description:
          "Използва се единствено след изрично съгласие за рекламни кампании.",
      },
    },
    table: {
      title: "Декларирани бисквитки и скриптове в категорията",
      cookieName: "Име / Ключ",
      provider: "Доставчик",
      storageType: "Тип",
      duration: "Срок",
      purpose: "Цел",
      thirdParty: "Трета страна",
      firstParty: "Собствена",
      emptyInventory: "Няма допълнителни бисквитки в тази категория.",
    },
    receipt: {
      title: "Криптографска разписка за съгласие",
      refLabel: "Референтен номер",
      timeLabel: "UTC Време",
      entryHashLabel: "Верижен SHA-256",
      snapshotHashLabel: "Хеш на политиката",
      anchoredBadge: "Подпечатано RFC 3161 TSA",
      pendingBadge: "SHA-256 верига • Изчаква TSA",
      explain:
        "Гарантирана неизменност без електронен подпис: всеки избор се свързва чрез SHA-256 верига и се подпечатва чрез Merkle корен в независим RFC 3161 TSA орган.",
      copyRef: "Копирай код",
      copied: "Копирано",
    },
  },
};
