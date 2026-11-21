import { normalizeSeoLang, SupportedSeoLang } from "@/utils/seoHelpers";

export interface AuthLegalCopy {
  readonly prefix: string;
  readonly termsLinkLabel: string;
  readonly middleAnd: string;
  readonly hostingLinkLabel: string;
  readonly suffix: string;
  readonly requiredError: string;
}

export interface FooterLegalNoticeCopy {
  readonly badge: string;
  readonly summary: string;
  readonly termsLink: string;
  readonly supplierAgreementLink: string;
  readonly hostingNoticeLink: string;
  readonly copyrightLink: string;
  readonly cancellationLink: string;
  readonly privacyLink: string;
}

export interface DirectSellerNoticeCopy {
  readonly directSellerTag: string;
  readonly buyerNotice: string;
}

const AUTH_LEGAL_COPY: Record<SupportedSeoLang, AuthLegalCopy> = {
  tr: {
    prefix: "Kayıt olarak",
    termsLinkLabel: "Üyelik ve Kullanım Sözleşmesi",
    middleAnd: "ile",
    hostingLinkLabel: "5651 Yer Sağlayıcı Bildirimi",
    suffix:
      "metinlerini kabul ediyorum. Merter Vitrini'nin doğrudan satıcı olmadığını, satış/ödeme/teslimat ve ayıplı mal uyuşmazlıklarında tek muhatabımın ilgili Tedarikçi olduğunu onaylıyorum.",
    requiredError:
      "Devam etmek için Üyelik Sözleşmesi ve Yer Sağlayıcı Bilgilendirmesini onaylamanız gerekmektedir.",
  },
  en: {
    prefix: "By registering, I accept the",
    termsLinkLabel: "Membership Agreement",
    middleAnd: "and",
    hostingLinkLabel: "Hosting Provider Disclosure",
    suffix:
      ". I acknowledge that Merter Vitrini is solely a Law No. 5651 Hosting Provider (not the direct seller) and that my sole counterparty for orders, payments, defects, and disputes is the named Supplier.",
    requiredError:
      "You must accept the Membership Agreement & Hosting Provider Disclosure to register.",
  },
  ru: {
    prefix: "Регистрируясь, я принимаю",
    termsLinkLabel: "Пользовательское соглашение",
    middleAnd: "и",
    hostingLinkLabel: "Уведомление о статусе хостинг-провайдера",
    suffix:
      ". Подтверждаю, что Merter Vitrini не является прямым продавцом, а все вопросы оплаты, доставки и претензий решаются напрямую с Поставщиком.",
    requiredError:
      "Для регистрации необходимо принять Пользовательское соглашение.",
  },
  ar: {
    prefix: "بالتسجيل أوافق على",
    termsLinkLabel: "اتفاقية العضوية",
    middleAnd: "و",
    hostingLinkLabel: "إفصاح مزود الاستضافة 5651",
    suffix:
      "، وأقر بأن Merter Vitrini مزود استضافة فقط وليس بائعاً مباشراً، وأن المورد المسمى هو الطرف المسؤول وحده عن البيع والدفع والنزاعات.",
    requiredError: "يجب الموافقة على اتفاقية العضوية وإفصاح مزود الاستضافة للمتابعة.",
  },
  de: {
    prefix: "Mit der Registrierung akzeptiere ich die",
    termsLinkLabel: "Nutzungsvereinbarung",
    middleAnd: "und den",
    hostingLinkLabel: "Hosting-Provider-Hinweis",
    suffix:
      ". Ich erkenne an, dass Merter Vitrini kein Direktverkäufer ist und sämtliche Zahlungs-, Liefer- und Gewährleistungsansprüche direkt an den Lieferanten zu richten sind.",
    requiredError: "Bitte akzeptieren Sie die Nutzungsvereinbarung zur Registrierung.",
  },
  fr: {
    prefix: "En m’inscrivant, j’accepte les",
    termsLinkLabel: "Conditions d’utilisation",
    middleAnd: "et la",
    hostingLinkLabel: "Notice d’hébergeur B2B",
    suffix:
      ". Je reconnais que Merter Vitrini n’est pas vendeur direct et que seul le Fournisseur assume les ventes, paiements, livraisons et litiges.",
    requiredError: "Veuillez accepter les conditions d’utilisation pour créer votre compte.",
  },
  pl: {
    prefix: "Rejestrując się, akceptuję",
    termsLinkLabel: "Umowę członkowską",
    middleAnd: "oraz",
    hostingLinkLabel: "Informację o hostingu 5651",
    suffix:
      ". Przyjmuję do wiadomości, że Merter Vitrini nie jest sprzedawcą bezpośrednim, a wyłączną stroną umów i reklamacji jest wskazany Dostawca.",
    requiredError: "Aby kontynuować, zaakceptuj Umowę członkowską.",
  },
  bg: {
    prefix: "С регистрацията приемам",
    termsLinkLabel: "Споразумението за членство",
    middleAnd: "и",
    hostingLinkLabel: "Уведомлението за хостинг 5651",
    suffix:
      ". Потвърждавам, че Merter Vitrini не е директен продавач, а единственият отговорен контрагент е посоченият Доставчик.",
    requiredError: "Моля, приемете Споразумението за членство, за да продължите.",
  },
};

const FOOTER_LEGAL_NOTICE_COPY: Record<SupportedSeoLang, FooterLegalNoticeCopy> = {
  tr: {
    badge: "5651 Sayılı Kanun Madde 5 • B2B Yer Sağlayıcı Bildirimi",
    summary:
      "mertervitrini.com.tr doğrudan satıcı değildir; yalnızca bağımsız üretici ve toptancıların ürünlerini sergileyen teknik yer sağlayıcı B2B vitrindir. Her ürünün tek doğrudan satıcısı ve içerik sağlayıcısı ilgili Tedarikçidir. Sipariş, ödeme, fatura, teslimat, iade ve olası tüm uyuşmazlıklarda tek muhatap satışı yapan Tedarikçi firmadır.",
    termsLink: "Üyelik Sözleşmesi",
    supplierAgreementLink: "Tedarikçi Sorumluluk Sözleşmesi",
    hostingNoticeLink: "Yer Sağlayıcı Bildirimi",
    copyrightLink: "Telif Hakkı & Uyar-Kaldır",
    cancellationLink: "B2B İptal & İade",
    privacyLink: "Gizlilik & KVKK",
  },
  en: {
    badge: "Law No. 5651 Art. 5 • B2B Hosting Provider Disclosure",
    summary:
      "mertervitrini.com.tr is NOT a direct seller. It operates strictly as a B2B technical hosting showcase connecting buyers with independent wholesalers. Each named Supplier is the sole Direct Seller & Content Provider; all orders, payments, invoices, deliveries, returns, and disputes are handled exclusively with the selling Supplier.",
    termsLink: "Membership Agreement",
    supplierAgreementLink: "Supplier IP Agreement",
    hostingNoticeLink: "Hosting Notice (5651)",
    copyrightLink: "Copyright & Takedown",
    cancellationLink: "B2B Cancellation & Return",
    privacyLink: "Privacy & KVKK",
  },
  ru: {
    badge: "Закон № 5651, ст. 5 • Хостинг-провайдер B2B",
    summary:
      "mertervitrini.com.tr НЕ является прямым продавцом — это техническая B2B-витрина. Единственным прямым продавцом и поставщиком контента выступает указанный Поставщик. Все расчеты, отгрузки, возвраты и претензии направляются напрямую Поставщику.",
    termsLink: "Пользовательское соглашение",
    supplierAgreementLink: "Соглашение поставщика",
    hostingNoticeLink: "Статус хостинга (5651)",
    copyrightLink: "Авторские права",
    cancellationLink: "Отмена и возврат B2B",
    privacyLink: "Конфиденциальность",
  },
  ar: {
    badge: "القانون 5651 المادة 5 • مزود استضافة B2B",
    summary:
      "منصة mertervitrini.com.tr ليست بائعاً مباشراً بل مزود استضافة تقني B2B. كل مورد مستقل هو البائع المباشر ومزود المحتوى الوحيد، وتتم كافة عمليات الدفع والفواتير والشحن والشكاوى والمرتجعات مباشرة مع المورد.",
    termsLink: "اتفاقية العضوية",
    supplierAgreementLink: "اتفاقية المورد",
    hostingNoticeLink: "إفصاح الاستضافة 5651",
    copyrightLink: "حقوق النشر والإزالة",
    cancellationLink: "الإلغاء والاسترجاع B2B",
    privacyLink: "الخصوصية وحماية البيانات",
  },
  de: {
    badge: "Gesetz Nr. 5651 Art. 5 • B2B-Hosting-Provider",
    summary:
      "mertervitrini.com.tr ist KEIN Direktverkäufer, sondern ausschließlich technischer B2B-Hosting-Provider. Alleiniger Direktverkäufer und Inhaltsanbieter ist der jeweils benannte Lieferant. Zahlung, Versand, Rückgaben und Reklamationen erfolgen direkt über den Lieferanten.",
    termsLink: "Nutzungsvereinbarung",
    supplierAgreementLink: "Lieferantenvertrag",
    hostingNoticeLink: "Hosting-Hinweis (5651)",
    copyrightLink: "Urheberrecht & Takedown",
    cancellationLink: "B2B Rückgabe & Storno",
    privacyLink: "Datenschutz & KVKK",
  },
  fr: {
    badge: "Loi n° 5651 art. 5 • Hébergeur technique B2B",
    summary:
      "mertervitrini.com.tr n’est PAS vendeur direct mais exclusivement hébergeur B2B. Chaque fournisseur nommé est l’unique vendeur direct et responsable de contenu ; paiements, expéditions, retours et litiges relèvent exclusivement du fournisseur.",
    termsLink: "Conditions d’utilisation",
    supplierAgreementLink: "Contrat Fournisseur",
    hostingNoticeLink: "Statut d’hébergeur",
    copyrightLink: "Droits d’auteur & Retrait",
    cancellationLink: "Annulation & Retour B2B",
    privacyLink: "Confidentialité",
  },
  pl: {
    badge: "Ustawa nr 5651 art. 5 • Dostawca hostingu B2B",
    summary:
      "mertervitrini.com.tr NIE jest sprzedawcą bezpośrednim, lecz techniczną platformą hostingową B2B. Wyłącznym sprzedawcą i dostawcą treści jest wskazany Dostawca, do którego należy kierować płatności, zwroty i reklamacje.",
    termsLink: "Umowa członkowska",
    supplierAgreementLink: "Umowa Dostawcy",
    hostingNoticeLink: "Informacja 5651",
    copyrightLink: "Prawa autorskie",
    cancellationLink: "Zwroty B2B",
    privacyLink: "Prywatność",
  },
  bg: {
    badge: "Закон № 5651 чл. 5 • B2B Хостинг доставчик",
    summary:
      "mertervitrini.com.tr НЕ е директен продавач, а B2B хостинг витрина. Единствен директен продавач и доставчик на съдържание е посоченият Доставчик. Плащания, доставки, връщания и спорове се уреждат директно с него.",
    termsLink: "Споразумение за членство",
    supplierAgreementLink: "Споразумение с доставчика",
    hostingNoticeLink: "Статут 5651",
    copyrightLink: "Авторски права",
    cancellationLink: "Анулиране и връщане B2B",
    privacyLink: "Поверителност",
  },
};

const DIRECT_SELLER_NOTICE_COPY: Record<SupportedSeoLang, DirectSellerNoticeCopy> = {
  tr: {
    directSellerTag: "Doğrudan Satıcı (5651 İçerik Sağlayıcı)",
    buyerNotice:
      "Merter Vitrini yer sağlayıcıdır; doğrudan satıcı değildir. Ödeme, fatura, kargo, iade ve tüm ticari uyuşmazlıklarda tek muhatap yukarıdaki Tedarikçi firmadır.",
  },
  en: {
    directSellerTag: "Direct Seller & Content Provider (Law 5651)",
    buyerNotice:
      "Merter Vitrini is a Hosting Provider, not the direct seller. Payments, invoices, delivery, returns, and all buyer disputes are exclusively between you and the Supplier named above.",
  },
  ru: {
    directSellerTag: "Прямой продавец (Закон № 5651)",
    buyerNotice:
      "Merter Vitrini — хостинг-витрина, а не продавец. По оплате, доставке, возвратам и спорам обращайтесь напрямую к указанному Поставщику.",
  },
  ar: {
    directSellerTag: "البائع المباشر ومزود المحتوى (القانون 5651)",
    buyerNotice:
      "Merter Vitrini مزود استضافة وليس بائعاً مباشراً. يتحمل المورد المذكور أعلاه وحده مسؤولية الدفع والفوترة والشحن والإرجاع وأي نزاع تجاري.",
  },
  de: {
    directSellerTag: "Direktverkäufer & Inhaltsanbieter (Gesetz 5651)",
    buyerNotice:
      "Merter Vitrini ist Hosting-Provider, kein Direktverkäufer. Zahlung, Rechnung, Versand, Rückgaben und Mängelansprüche richten sich ausschließlich an den oben genannten Lieferanten.",
  },
  fr: {
    directSellerTag: "Vendeur Direct & Fournisseur de Contenu",
    buyerNotice:
      "Merter Vitrini agit comme hébergeur et n’est pas vendeur. Paiements, factures, livraisons, retours et litiges relèvent exclusivement du fournisseur indiqué ci-dessus.",
  },
  pl: {
    directSellerTag: "Sprzedawca Bezpośredni (Ustawa 5651)",
    buyerNotice:
      "Merter Vitrini jest dostawcą hostingu, a nie sprzedawcą. Płatności, faktury, zwroty i reklamacje realizowane są wyłącznie z powyższym Dostawcą.",
  },
  bg: {
    directSellerTag: "Директен продавач (Закон 5651)",
    buyerNotice:
      "Merter Vitrini е хостинг доставчик, а не продавач. Плащанията, фактурите, доставките, връщанията и споровете са директно с посочения Доставчик.",
  },
};

export function getAuthLegalCopy(lang: string): AuthLegalCopy {
  return AUTH_LEGAL_COPY[normalizeSeoLang(lang)];
}

export function getFooterLegalNoticeCopy(lang: string): FooterLegalNoticeCopy {
  return FOOTER_LEGAL_NOTICE_COPY[normalizeSeoLang(lang)];
}

export function getDirectSellerNoticeCopy(lang: string): DirectSellerNoticeCopy {
  return DIRECT_SELLER_NOTICE_COPY[normalizeSeoLang(lang)];
}
