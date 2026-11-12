"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
import {
  Truck,
  Camera,
  Tag,
  Scissors,
  Globe,
  ShieldCheck,
  Sparkles,
  MapPin,
  Phone,
  MessageCircle,
  Search,
  Plus,
  CheckCircle2,
  Mail,
  AlertCircle,
} from "lucide-react";
import { CartItem, Category } from "@/types/store";
import { getCategoryPrefix } from "@/app/i18n";
import { apiFetch } from "@/app/utils";
import Header from "@/components/store/Header";
import Footer from "@/components/store/Footer";
import PolicyViewerModal from "@/components/store/PolicyViewerModal";
import { SupportedSeoLang, normalizeSeoLang } from "@/utils/seoHelpers";

interface ServiceProvidersLocaleCopy {
  readonly heroBadge: string;
  readonly heroTitle: string;
  readonly heroDesc: string;
  readonly heroApplyBtn: string;
  readonly searchLabel: string;
  readonly searchPlaceholder: string;
  readonly catAll: string;
  readonly catCargo: string;
  readonly catStudio: string;
  readonly catLabel: string;
  readonly catPattern: string;
  readonly catCustoms: string;
  readonly catTitleCargo: string;
  readonly catTitleStudio: string;
  readonly catTitleLabel: string;
  readonly catTitlePattern: string;
  readonly catTitleCustoms: string;
  readonly catTitleFallback: string;
  readonly sponsoredBadge: string;
  readonly verifiedBadge: string;
  readonly targetCountriesLabel: string;
  readonly whatsappMessagePrefix: string;
  readonly whatsappMessageBody: string;
  readonly whatsappBtn: string;
  readonly callBtn: string;
  readonly emptyTitle: string;
  readonly emptyDesc: string;
  readonly emptyApplyBtn: string;
  readonly verifyDefaultSuccess: string;
  readonly verifyNetworkError: string;
  readonly submittedTitle: string;
  readonly submittedDescBeforeEmail: string;
  readonly submittedDescBetween: string;
  readonly submittedWindowLabel: string;
  readonly submittedDescAfter: string;
  readonly securityPolicyTitle: string;
  readonly securityPolicyBody: string;
  readonly gotItBtn: string;
  readonly modalTitle: string;
  readonly fieldCompanyPlaceholder: string;
  readonly fieldContactPlaceholder: string;
  readonly fieldEmailPlaceholder: string;
  readonly fieldShortDescPlaceholder: string;
  readonly fieldServicesPlaceholder: string;
  readonly fieldCountriesPlaceholder: string;
  readonly fieldPhonePlaceholder: string;
  readonly fieldAddressPlaceholder: string;
  readonly recaptchaNotice: string;
  readonly submitBtn: string;
  readonly submittingBtn: string;
  readonly submitErrorFallback: string;
}

const SERVICE_PROVIDERS_COPY: Record<
  SupportedSeoLang,
  ServiceProvidersLocaleCopy
> = {
  tr: {
    heroBadge: "MERTER B2B EKOSİSTEM & ÇÖZÜM ORTAKLARI REHBERİ",
    heroTitle: "Sektörel Hizmet Sağlayıcılar Rehberi",
    heroDesc:
      "Toptan tekstil ticaretinizi hızlandıran doğrulanmış uluslararası kargo ve gümrükleme firmaları, mankenli katalog çekim stüdyoları, Private Label dokuma etiket/ambalaj üreticileri, dijital modelhaneler ve ihracat danışmanlarıyla doğrudan iletişime geçin.",
    heroApplyBtn: "Hizmet Sağlayıcı Olarak Kaydol",
    searchLabel: "Hizmet Sağlayıcı Ara",
    searchPlaceholder: "Hizmet, ülke veya firma ara...",
    catAll: "Tüm Hizmetler",
    catCargo: "Kargo & Lojistik",
    catStudio: "Fotoğraf & Prodüksiyon Stüdyosu",
    catLabel: "Ambalaj & Dokuma Etiket",
    catPattern: "Modelhane, Kalıp & Numune",
    catCustoms: "Gümrük & İhracat Danışmanlığı",
    catTitleCargo: "Uluslararası Kargo, Lojistik & Konsolidasyon",
    catTitleStudio: "Mankenli Katalog, Lookbook & Video Stüdyosu",
    catTitleLabel: "Dokuma Etiket, Karton Etiket & Lüks Ambalaj",
    catTitlePattern: "Dijital Modelhane, Gerber/Lectra Kalıp & Numune",
    catTitleCustoms: "Gümrük, EUR.1/ATR & Dış Ticaret Danışmanlığı",
    catTitleFallback: "B2B Sektörel Hizmet Ortağı",
    sponsoredBadge: "ÖNE ÇIKAN HİZMET ORTAĞI",
    verifiedBadge: "Doğrulanmış Hizmet Sağlayıcı",
    targetCountriesLabel: "Hizmet Bölgeleri / Ülkeler:",
    whatsappMessagePrefix: "Merhaba",
    whatsappMessageBody:
      "Merter Vitrini Sektörel Hizmet Sağlayıcılar Rehberi üzerinden firmanızdan B2B hizmet teklifi almak istiyorum.",
    whatsappBtn: "WhatsApp'tan Teklif Al",
    callBtn: "Doğrudan Ara",
    emptyTitle: "Henüz Kayıtlı Hizmet Sağlayıcı Bulunmuyor",
    emptyDesc:
      "Bu kategoride şu an listelenen bir hizmet sağlayıcı firma bulunmamaktadır. Kargo/lojistik, fotoğraf stüdyosu, dokuma etiket/ambalaj, modelhane veya ihracat danışmanlığı hizmeti veriyorsanız rehbere başvuru yapabilirsiniz.",
    emptyApplyBtn: "Hizmet Sağlayıcı Olarak Başvur",
    verifyDefaultSuccess: "E-posta doğrulama işlemi tamamlandı.",
    verifyNetworkError: "Doğrulama sırasında bir bağlantı hatası oluştu.",
    submittedTitle: "Doğrulama E-Postası Gönderildi!",
    submittedDescBeforeEmail: "",
    submittedDescBetween: " adresinize ",
    submittedWindowLabel: "30 dakika",
    submittedDescAfter:
      " geçerli bir başvuru doğrulama bağlantısı gönderdik. E-postanızı doğruladığınızda başvurunuz yönetici onayına iletilecektir.",
    securityPolicyTitle: "Güvenlik Politikası:",
    securityPolicyBody:
      "Tıpkı tedarikçi başvurularında olduğu gibi, 30 dakika içinde e-posta doğrulaması yapılmayan başvurular otomatik olarak silinir ve yönetici onayı olmadan rehberde yayınlanmaz.",
    gotItBtn: "Tamam, Anladım",
    modalTitle: "Sektörel Hizmet Sağlayıcı Rehber Başvurusu",
    fieldCompanyPlaceholder: "Firma Unvanı (Örn: Merter Ekspres Kargo) *",
    fieldContactPlaceholder: "Yetkili Adı Soyadı *",
    fieldEmailPlaceholder: "Kurumsal E-Posta (Doğrulama İçin) *",
    fieldShortDescPlaceholder: "Kısa Tanıtım Yazısı *",
    fieldServicesPlaceholder:
      "Sunulan Hizmetler (Virgülle ayırın: ETGB, Konsolidasyon vb.)",
    fieldCountriesPlaceholder:
      "Hizmet Verilen Ülkeler (Örn: Almanya, Rusya, BAE)",
    fieldPhonePlaceholder: "Telefon / WhatsApp Numarası *",
    fieldAddressPlaceholder: "Merter / İstanbul Açık Adres",
    recaptchaNotice:
      "Google reCAPTCHA v3 koruması, 30 dk e-posta doğrulaması ve yönetici onay mekanizmasıyla korunmaktadır.",
    submitBtn: "BAŞVURU YAP & DOĞRULAMA KODU GÖNDER",
    submittingBtn: "DOĞRULAMA GÖNDERİLİYOR...",
    submitErrorFallback: "Başvurunuz gönderilirken bir hata oluştu.",
  },
  en: {
    heroBadge: "MERTER B2B ECOSYSTEM & VERIFIED PARTNERS DIRECTORY",
    heroTitle: "B2B Textile Service Providers Directory",
    heroDesc:
      "Connect directly with verified international cargo & consolidation forwarders, fashion lookbook photography studios, private-label woven label & packaging manufacturers, CAD pattern houses, and export customs consultants in Merter Istanbul.",
    heroApplyBtn: "Register as a Service Partner",
    searchLabel: "Search Service Providers",
    searchPlaceholder: "Search by service, destination country, or company...",
    catAll: "All Services",
    catCargo: "Cargo & Logistics",
    catStudio: "Photo & Lookbook Studio",
    catLabel: "Woven Labels & Packaging",
    catPattern: "Pattern Making & Sampling",
    catCustoms: "Customs & Export Advisory",
    catTitleCargo: "International Cargo, Freight & Multi-Supplier Consolidation",
    catTitleStudio: "Model Catalog, E-Commerce Lookbook & Video Studio",
    catTitleLabel: "Custom Woven Labels, Hangtags & Luxury Packaging",
    catTitlePattern: "Digital Pattern Making (Gerber/Lectra) & Sampling",
    catTitleCustoms: "Customs Clearance, EUR.1/ATR & Export Advisory",
    catTitleFallback: "B2B Industry Service Partner",
    sponsoredBadge: "FEATURED PARTNER",
    verifiedBadge: "Verified Service Provider",
    targetCountriesLabel: "Served Regions / Countries:",
    whatsappMessagePrefix: "Hello",
    whatsappMessageBody:
      "I am reaching out via the Merter Vitrini B2B Service Providers Directory and would like to request a quote.",
    whatsappBtn: "Get Quote on WhatsApp",
    callBtn: "Call Directly",
    emptyTitle: "No Service Providers Listed Yet",
    emptyDesc:
      "No service provider matches this filter right now. If your company provides international textile cargo, studio photography, custom labels/packaging, pattern making, or export consulting in Merter, apply to join the directory.",
    emptyApplyBtn: "Apply as a Service Provider",
    verifyDefaultSuccess: "Email verification completed successfully.",
    verifyNetworkError: "A network error occurred during verification.",
    submittedTitle: "Verification Email Sent!",
    submittedDescBeforeEmail: "We sent an application verification link to ",
    submittedDescBetween: " valid for ",
    submittedWindowLabel: "30 minutes",
    submittedDescAfter:
      ". Once you verify your email, your application will be forwarded for admin review.",
    securityPolicyTitle: "Security Policy:",
    securityPolicyBody:
      "Applications not verified via email within 30 minutes are automatically purged and are never published without admin verification.",
    gotItBtn: "Got It",
    modalTitle: "B2B Service Provider Directory Application",
    fieldCompanyPlaceholder: "Company Name (e.g., Merter Express Cargo) *",
    fieldContactPlaceholder: "Contact Person Full Name *",
    fieldEmailPlaceholder: "Corporate Email (For Verification) *",
    fieldShortDescPlaceholder: "Short Company Summary *",
    fieldServicesPlaceholder:
      "Services Offered (comma-separated: Consolidation, Air Cargo, EUR.1...)",
    fieldCountriesPlaceholder:
      "Served Countries (e.g., Germany, UK, USA, UAE)",
    fieldPhonePlaceholder: "Phone / WhatsApp Number *",
    fieldAddressPlaceholder: "Merter / Istanbul Street Address",
    recaptchaNotice:
      "Protected by Google reCAPTCHA v3, 30-minute email verification, and manual admin approval.",
    submitBtn: "SUBMIT & SEND VERIFICATION LINK",
    submittingBtn: "SENDING VERIFICATION...",
    submitErrorFallback: "An error occurred while submitting your application.",
  },
  ru: {
    heroBadge: "B2B ЭКОСИСТЕМА И ПРОВЕРЕННЫЕ ПАРТНЕРЫ МЕРТЕРА",
    heroTitle: "Каталог отраслевых B2B партнеров и карго",
    heroDesc:
      "Свяжитесь напрямую с проверенными карго-компаниями и консолидаторами грузов из Турции, модельными фотостудиями, производителями тканых бирок/упаковки для Private Label, конструкторскими бюро и таможенными брокерами.",
    heroApplyBtn: "Добавить компанию в каталог",
    searchLabel: "Поиск поставщиков услуг",
    searchPlaceholder: "Поиск по услуге, стране доставки или компании...",
    catAll: "Все услуги",
    catCargo: "Карго и логистика",
    catStudio: "Фото и видеостудии",
    catLabel: "Бирки и упаковка",
    catPattern: "Лекала и образцы",
    catCustoms: "Таможня и экспорт",
    catTitleCargo: "Международное карго, логистика и консолидация грузов",
    catTitleStudio: "Каталожная фотосъемка с моделями, Lookbook и видео",
    catTitleLabel: "Тканые жаккардовые бирки, навесные ярлыки и упаковка",
    catTitlePattern: "Цифровые лекала (Gerber/Lectra) и пошив образцов",
    catTitleCustoms: "Таможенное оформление, сертификаты и ВЭД консалтинг",
    catTitleFallback: "B2B сервисный партнер",
    sponsoredBadge: "РЕКОМЕНДУЕМЫЙ ПАРТНЕР",
    verifiedBadge: "Проверенный партнер",
    targetCountriesLabel: "Страны и регионы работы:",
    whatsappMessagePrefix: "Здравствуйте,",
    whatsappMessageBody:
      "Обращаюсь к вам через каталог B2B партнеров Merter Vitrini и хочу запросить расчет стоимости услуг.",
    whatsappBtn: "Запросить в WhatsApp",
    callBtn: "Позвонить напрямую",
    emptyTitle: "В этой категории пока нет компаний",
    emptyDesc:
      "По выбранному фильтру пока нет зарегистрированных партнеров. Если вы предоставляете услуги карго, фотостудии, производства бирок, лекал или экспортного оформления в Мертере, подайте заявку.",
    emptyApplyBtn: "Подать заявку как партнер",
    verifyDefaultSuccess: "Подтверждение электронной почты завершено.",
    verifyNetworkError: "Ошибка соединения при проверке токена.",
    submittedTitle: "Письмо с подтверждением отправлено!",
    submittedDescBeforeEmail: "На адрес ",
    submittedDescBetween: " отправлена ссылка подтверждения со сроком действия ",
    submittedWindowLabel: "30 минут",
    submittedDescAfter:
      ". После подтверждения e-mail заявка поступит на проверку модератору.",
    securityPolicyTitle: "Политика безопасности:",
    securityPolicyBody:
      "Заявки без подтверждения e-mail в течение 30 минут автоматически удаляются и публикуются только после проверки администрацией.",
    gotItBtn: "Понятно",
    modalTitle: "Заявка на включение в каталог B2B услуг",
    fieldCompanyPlaceholder: "Название компании (напр., Merter Express Cargo) *",
    fieldContactPlaceholder: "Контактное лицо (Имя и Фамилия) *",
    fieldEmailPlaceholder: "Корпоративный E-mail (для подтверждения) *",
    fieldShortDescPlaceholder: "Краткое описание компании *",
    fieldServicesPlaceholder:
      "Услуги через запятую (Консолидация, Авто/Авиа карго и т.д.)",
    fieldCountriesPlaceholder:
      "Страны доставки (напр., Россия, Казахстан, ЕС)",
    fieldPhonePlaceholder: "Телефон / WhatsApp *",
    fieldAddressPlaceholder: "Адрес офиса / склада в Мертере (Стамбул)",
    recaptchaNotice:
      "Защищено Google reCAPTCHA v3, 30-минутным подтверждением e-mail и модерацией.",
    submitBtn: "ОТПРАВИТЬ ЗАЯВКУ И КОД ПОДТВЕРЖДЕНИЯ",
    submittingBtn: "ОТПРАВКА...",
    submitErrorFallback: "Произошла ошибка при отправке заявки.",
  },
  ar: {
    heroBadge: "دليل شركاء الأعمال والخدمات اللوجستية في مارتر",
    heroTitle: "دليل مزودي الخدمات القطاعية لتجارة الجملة",
    heroDesc:
      "تواصل مباشرة مع شركات الشحن الدولي وتجميع البضائع المعتمدة، استوديوهات تصوير الكتالوجات والموديلات، مصانع الليبل المنسوج والتغليف (Private Label)، مكاتب الباترون الرقمي ومستشاري التصدير والجمارك في مارتر إسطنبول.",
    heroApplyBtn: "سجّل كمزود خدمة معتمد",
    searchLabel: "البحث عن مزود خدمة",
    searchPlaceholder: "ابحث حسب الخدمة أو الدولة أو اسم الشركة...",
    catAll: "جميع الخدمات",
    catCargo: "الشحن والخدمات اللوجستية",
    catStudio: "استوديوهات التصوير والإنتاج",
    catLabel: "التغليف والليبل المنسوج",
    catPattern: "الباترون والعينات",
    catCustoms: "التخليص الجمركي والتصدير",
    catTitleCargo: "الشحن الدولي والتجميع اللوجستي للبضائع",
    catTitleStudio: "استوديو تصوير كتالوجات الأزياء والفيديو",
    catTitleLabel: "تصنيع الليبل المنسوج وكروت الماركة والتغليف الفاخر",
    catTitlePattern: "تصميم الباترون الرقمي (Gerber/Lectra) وتنفيذ العينات",
    catTitleCustoms: "التخليص الجمركي وشهادات المنشأ واستشارات التصدير",
    catTitleFallback: "شريك خدمات أعمال B2B",
    sponsoredBadge: "شريك خدمة مميز",
    verifiedBadge: "مزود خدمة موثق",
    targetCountriesLabel: "مناطق ودول الخدمة:",
    whatsappMessagePrefix: "مرحباً",
    whatsappMessageBody:
      "أتواصل معكم عبر دليل مزودي الخدمات في Merter Vitrini وأرغب في الحصول على عرض سعر لخدماتكم.",
    whatsappBtn: "اطلب عرض سعر عبر واتساب",
    callBtn: "اتصال مباشر",
    emptyTitle: "لا يوجد مزودو خدمات مسجلون في هذا القسم حالياً",
    emptyDesc:
      "لا توجد شركات مدرجة ضمن هذا التصنيف حالياً. إذا كنتم تقدمون خدمات الشحن الدولي أو التصوير أو الليبل أو الباترون في مارتر، يمكنكم تقديم طلب انضمام للدليل.",
    emptyApplyBtn: "تقديم طلب انضمام كمزود خدمة",
    verifyDefaultSuccess: "تم تأكيد البريد الإلكتروني بنجاح.",
    verifyNetworkError: "حدث خطأ في الاتصال أثناء التحقق.",
    submittedTitle: "تم إرسال رسالة التأكيد!",
    submittedDescBeforeEmail: "أرسلنا رابط تأكيد إلى ",
    submittedDescBetween: " صالحاً لمدة ",
    submittedWindowLabel: "30 دقيقة",
    submittedDescAfter:
      ". بعد تأكيد بريدك الإلكتروني سيُحال طلبك لمراجعة الإدارة.",
    securityPolicyTitle: "سياسة الأمان:",
    securityPolicyBody:
      "تُحذف الطلبات التي لا يتم تأكيد بريدها الإلكتروني خلال 30 دقيقة تلقائياً ولا تُنشر إلا بعد موافقة الإدارة.",
    gotItBtn: "حسناً، فهمت",
    modalTitle: "طلب انضمام إلى دليل مزودي الخدمات القطاعية",
    fieldCompanyPlaceholder: "الاسم التجاري للشركة (مثال: مارتر للشحن السريع) *",
    fieldContactPlaceholder: "اسم الشخص المسؤول *",
    fieldEmailPlaceholder: "البريد الإلكتروني الرسمي (للتأكيد) *",
    fieldShortDescPlaceholder: "نبذة مختصرة عن خدمات الشركة *",
    fieldServicesPlaceholder: "الخدمات المقدمة (مفصولة بفواصل: شحن جوي، تجميع...)",
    fieldCountriesPlaceholder: "الدول المخدومة (مثال: السعودية، الإمارات، الكويت)",
    fieldPhonePlaceholder: "رقم الهاتف / واتساب *",
    fieldAddressPlaceholder: "العنوان التفصيلي في مارتر / إسطنبول",
    recaptchaNotice:
      "محمي بواسطة Google reCAPTCHA v3 وتأكيد البريد خلال 30 دقيقة وموافقة الإدارة.",
    submitBtn: "إرسال الطلب ورابط التأكيد",
    submittingBtn: "جاري الإرسال...",
    submitErrorFallback: "حدث خطأ أثناء إرسال الطلب.",
  },
  de: {
    heroBadge: "MERTER B2B-ÖKOSYSTEM & GEPRÜFTE PARTNER",
    heroTitle: "Verzeichnis für Textil- & Exportdienstleister",
    heroDesc:
      "Kontaktieren Sie direkt geprüfte internationale Textilspeditionen, Mode- & Lookbook-Studios, Webetiketten- & Verpackungshersteller (Private Label), CAD-Schnittateliers sowie Zoll- und Exportberater in Merter Istanbul.",
    heroApplyBtn: "Als Dienstleister eintragen",
    searchLabel: "Dienstleister suchen",
    searchPlaceholder: "Nach Dienstleistung, Zielland oder Firma suchen...",
    catAll: "Alle Dienste",
    catCargo: "Spedition & Logistik",
    catStudio: "Foto- & Videostudio",
    catLabel: "Webetiketten & Verpackung",
    catPattern: "Schnittatelier & Muster",
    catCustoms: "Zoll & Exportberatung",
    catTitleCargo: "Internationale Textilspedition, Luft-/LKW-Fracht & Konsolidierung",
    catTitleStudio: "Model-Katalogshooting, Lookbook & E-Commerce-Videostudio",
    catTitleLabel: "Gewebte Etiketten, Hangtags & Private-Label-Verpackungen",
    catTitlePattern: "Digitale Schnittkonstruktion (Gerber/Lectra) & Erstmuster",
    catTitleCustoms: "Zollabwicklung, ATR/EUR.1 & Außenhandelsberatung",
    catTitleFallback: "B2B Branchenpartner",
    sponsoredBadge: "EMPFOHLENER PARTNER",
    verifiedBadge: "Geprüfter Dienstleister",
    targetCountriesLabel: "Zielländer / Regionen:",
    whatsappMessagePrefix: "Guten Tag",
    whatsappMessageBody:
      "ich kontaktiere Sie über das Merter Vitrini B2B-Dienstleisterverzeichnis und bitte um ein unverbindliches Angebot.",
    whatsappBtn: "Angebot per WhatsApp",
    callBtn: "Direkt anrufen",
    emptyTitle: "Noch keine Dienstleister in dieser Kategorie",
    emptyDesc:
      "Derzeit sind für diesen Filter keine Unternehmen gelistet. Wenn Sie Logistik-, Studio-, Etiketten-, Schnittmuster- oder Zollservices in Merter anbieten, bewerben Sie sich jetzt.",
    emptyApplyBtn: "Als Dienstleister bewerben",
    verifyDefaultSuccess: "E-Mail-Bestätigung erfolgreich abgeschlossen.",
    verifyNetworkError: "Verbindungsfehler während der Bestätigung.",
    submittedTitle: "Bestätigungs-E-Mail gesendet!",
    submittedDescBeforeEmail: "Wir haben einen Bestätigungslink an ",
    submittedDescBetween: " gesendet (gültig für ",
    submittedWindowLabel: "30 Minuten",
    submittedDescAfter:
      "). Nach Ihrer Bestätigung wird der Eintrag von der Redaktion geprüft.",
    securityPolicyTitle: "Sicherheitsrichtlinie:",
    securityPolicyBody:
      "Nicht innerhalb von 30 Minuten bestätigte Anträge werden automatisch gelöscht und erst nach Freigabe veröffentlicht.",
    gotItBtn: "Verstanden",
    modalTitle: "Aufnahmeantrag — B2B-Dienstleisterverzeichnis",
    fieldCompanyPlaceholder: "Firmenname (z. B. Merter Express Spedition) *",
    fieldContactPlaceholder: "Ansprechpartner Vor- & Nachname *",
    fieldEmailPlaceholder: "Geschäfts-E-Mail (zur Bestätigung) *",
    fieldShortDescPlaceholder: "Kurzbeschreibung Ihrer Leistungen *",
    fieldServicesPlaceholder:
      "Leistungen (kommagetrennt: Sammelgut, ATR, Luftfracht...)",
    fieldCountriesPlaceholder: "Bediente Länder (z. B. Deutschland, Österreich, EU)",
    fieldPhonePlaceholder: "Telefon / WhatsApp *",
    fieldAddressPlaceholder: "Geschäftsadresse in Merter / Istanbul",
    recaptchaNotice:
      "Geschützt durch Google reCAPTCHA v3, 30-Minuten-E-Mail-Bestätigung und Admin-Prüfung.",
    submitBtn: "ANTRAG SENDEN & E-MAIL BESTÄTIGEN",
    submittingBtn: "WIRD GESENDET...",
    submitErrorFallback: "Beim Senden Ihres Antrags ist ein Fehler aufgetreten.",
  },
  fr: {
    heroBadge: "ÉCOSYSTÈME B2B MERTER & PARTENAIRES CERTIFIÉS",
    heroTitle: "Annuaire des Prestataires B2B du Textile",
    heroDesc:
      "Contactez directement les transitaires cargo internationaux, studios photo lookbook avec mannequins, fabricants d'étiquettes tissées et d'emballages Private Label, bureaux de modélisme CAO et experts douane export à Merter Istanbul.",
    heroApplyBtn: "S'inscrire comme prestataire",
    searchLabel: "Rechercher un prestataire",
    searchPlaceholder: "Rechercher un service, un pays ou une société...",
    catAll: "Tous les services",
    catCargo: "Cargo & Logistique",
    catStudio: "Studio Photo & Vidéo",
    catLabel: "Étiquettes & Packaging",
    catPattern: "Modélisme & Prototypes",
    catCustoms: "Douane & Conseil Export",
    catTitleCargo: "Fret international, groupage multi-fournisseurs & logistique",
    catTitleStudio: "Shooting catalogue mannequin, Lookbook & Studio vidéo",
    catTitleLabel: "Étiquettes tissées, hangtags & emballages personnalisés",
    catTitlePattern: "Bureau d'études CAO (Gerber/Lectra), patronage & prototypes",
    catTitleCustoms: "Dédouanement, certificats EUR.1/ATR & conseil export",
    catTitleFallback: "Partenaire B2B Textile",
    sponsoredBadge: "PARTENAIRE MIS EN AVANT",
    verifiedBadge: "Prestataire vérifié",
    targetCountriesLabel: "Zones / Pays desservis :",
    whatsappMessagePrefix: "Bonjour",
    whatsappMessageBody:
      "je vous contacte via l'annuaire des prestataires B2B Merter Vitrini pour demander un devis professionnel.",
    whatsappBtn: "Devis sur WhatsApp",
    callBtn: "Appeler directement",
    emptyTitle: "Aucun prestataire référencé dans cette catégorie",
    emptyDesc:
      "Aucune entreprise ne correspond à ce filtre pour le moment. Vous proposez du fret textile, un studio photo, des étiquettes ou du modélisme à Merter ? Déposez votre candidature.",
    emptyApplyBtn: "Postuler comme prestataire",
    verifyDefaultSuccess: "Vérification de l'adresse e-mail effectuée.",
    verifyNetworkError: "Erreur réseau lors de la vérification.",
    submittedTitle: "E-mail de vérification envoyé !",
    submittedDescBeforeEmail: "Un lien de validation a été envoyé à ",
    submittedDescBetween: " (valable ",
    submittedWindowLabel: "30 minutes",
    submittedDescAfter:
      "). Après validation, votre dossier sera transmis pour approbation.",
    securityPolicyTitle: "Politique de sécurité :",
    securityPolicyBody:
      "Les demandes non confirmées sous 30 minutes sont supprimées automatiquement et soumises à validation manuelle.",
    gotItBtn: "Compris",
    modalTitle: "Candidature — Annuaire des Prestataires B2B",
    fieldCompanyPlaceholder: "Raison sociale (ex. : Merter Express Cargo) *",
    fieldContactPlaceholder: "Nom complet du responsable *",
    fieldEmailPlaceholder: "E-mail professionnel (pour validation) *",
    fieldShortDescPlaceholder: "Présentation courte de l'entreprise *",
    fieldServicesPlaceholder:
      "Services proposés (séparés par virgule : Groupage, EUR.1...)",
    fieldCountriesPlaceholder:
      "Pays desservis (ex. : France, Belgique, Afrique du Nord)",
    fieldPhonePlaceholder: "Téléphone / WhatsApp *",
    fieldAddressPlaceholder: "Adresse complète à Merter / Istanbul",
    recaptchaNotice:
      "Protégé par Google reCAPTCHA v3, validation e-mail sous 30 min et modération.",
    submitBtn: "ENVOYER LA DEMANDE & LE LIEN DE VALIDATION",
    submittingBtn: "ENVOI EN COURS...",
    submitErrorFallback: "Une erreur est survenue lors de l'envoi de la demande.",
  },
  pl: {
    heroBadge: "EKOSYSTEM B2B MERTER I ZWERYFIKOWANI PARTNERZY",
    heroTitle: "Katalog Partnerów i Usług B2B Branży Tekstylnej",
    heroDesc:
      "Skontaktuj się bezpośrednio ze zweryfikowanymi firmami spedycyjnymi i cargo z Turcji, studiami fotografii modowej, producentami metek tkanych i opakowań Private Label, wzorcowniami CAD oraz agencjami celnymi w Merter Stambuł.",
    heroApplyBtn: "Dołącz jako usługodawca",
    searchLabel: "Szukaj usługodawcy",
    searchPlaceholder: "Szukaj usługi, kraju dostawy lub firmy...",
    catAll: "Wszystkie usługi",
    catCargo: "Spedycja i Logistyka Cargo",
    catStudio: "Studio Foto i Wideo",
    catLabel: "Metki Tkane i Opakowania",
    catPattern: "Konstrukcja Odzieży i Wzory",
    catCustoms: "Agencje Celne i Eksport",
    catTitleCargo: "Międzynarodowe cargo, spedycja i konsolidacja dostaw",
    catTitleStudio: "Sesje katalogowe z modelkami, Lookbook i wideo e-commerce",
    catTitleLabel: "Metki żakardowe, przywieszki kartonowe i opakowania",
    catTitlePattern: "Konstrukcja i stopniowanie CAD (Gerber/Lectra) oraz odszycia",
    catTitleCustoms: "Odprawa celna, świadectwa ATR/EUR.1 i doradztwo eksportowe",
    catTitleFallback: "Partner Usługowy B2B",
    sponsoredBadge: "WYRÓŻNIONY PARTNER",
    verifiedBadge: "Zweryfikowany usługodawca",
    targetCountriesLabel: "Obsługiwane kraje / regiony:",
    whatsappMessagePrefix: "Dzień dobry",
    whatsappMessageBody:
      "kontaktuję się przez Katalog Usług B2B Merter Vitrini i proszę o wycenę współpracy.",
    whatsappBtn: "Zapytaj na WhatsApp",
    callBtn: "Zadzwoń bezpośrednio",
    emptyTitle: "Brak zarejestrowanych usługodawców w tej kategorii",
    emptyDesc:
      "Obecnie brak firm spełniających wybrane kryteria. Jeśli świadczysz usługi cargo, fotografii modowej, produkcji metek lub odpraw celnych w Merter, zgłoś swoją firmę.",
    emptyApplyBtn: "Zgłoś firmę do katalogu",
    verifyDefaultSuccess: "Weryfikacja adresu e-mail zakończona pomyślnie.",
    verifyNetworkError: "Błąd połączenia podczas weryfikacji.",
    submittedTitle: "Wysłano e-mail weryfikacyjny!",
    submittedDescBeforeEmail: "Wysłaliśmy link potwierdzający na adres ",
    submittedDescBetween: " ważny przez ",
    submittedWindowLabel: "30 minut",
    submittedDescAfter:
      ". Po potwierdzeniu e-maila zgłoszenie trafi do akceptacji administratora.",
    securityPolicyTitle: "Polityka bezpieczeństwa:",
    securityPolicyBody:
      "Zgłoszenia niepotwierdzone w ciągu 30 minut są automatycznie usuwane i wymagają zatwierdzenia przez zespół.",
    gotItBtn: "Rozumiem",
    modalTitle: "Zgłoszenie do Katalogu Usługodawców B2B",
    fieldCompanyPlaceholder: "Nazwa firmy (np. Merter Express Cargo) *",
    fieldContactPlaceholder: "Imię i nazwisko osoby kontaktowej *",
    fieldEmailPlaceholder: "Firmowy adres e-mail (do weryfikacji) *",
    fieldShortDescPlaceholder: "Krótki opis działalności *",
    fieldServicesPlaceholder:
      "Zakres usług (po przecinku: Konsolidacja, ATR, Transport...)",
    fieldCountriesPlaceholder: "Obsługiwane kraje (np. Polska, Niemcy, UE)",
    fieldPhonePlaceholder: "Telefon / WhatsApp *",
    fieldAddressPlaceholder: "Adres biura / magazynu w Merter (Stambuł)",
    recaptchaNotice:
      "Chronione przez Google reCAPTCHA v3, 30-minutową weryfikację e-mail i moderację.",
    submitBtn: "WYŚLIJ ZGŁOSZENIE I LINK WERYFIKACYJNY",
    submittingBtn: "WYSYŁANIE...",
    submitErrorFallback: "Wystąpił błąd podczas wysyłania zgłoszenia.",
  },
  bg: {
    heroBadge: "B2B ЕКОСИСТЕМА И ПРОВЕРЕНИ ПАРТНЬОРИ В МЕРТЕР",
    heroTitle: "Каталог на B2B доставчици на текстилни и карго услуги",
    heroDesc:
      "Свържете се директно с проверени международни карго и спедиторски фирми, модни фотостудиа с модели, производители на тъкани етикети и опаковки Private Label, конструктори на кройки и митнически консултанти в Мертер Истанбул.",
    heroApplyBtn: "Регистрация като доставчик на услуги",
    searchLabel: "Търсене на доставчик на услуги",
    searchPlaceholder: "Търсене по услуга, държава или фирма...",
    catAll: "Всички услуги",
    catCargo: "Карго и логистика",
    catStudio: "Фото и видео студио",
    catLabel: "Етикети и опаковки",
    catPattern: "Кройки и мостри",
    catCustoms: "Митница и износ",
    catTitleCargo: "Международно карго, спедиция и консолидация на пратки",
    catTitleStudio: "Каталожна фотосесия с модели, Lookbook и видео продукция",
    catTitleLabel: "Тъкани етикети, картонени етикети и брандирани опаковки",
    catTitlePattern: "Дигитално конструиране (Gerber/Lectra) и мострено шиене",
    catTitleCustoms: "Митническо представителство, EUR.1/ATR и експортни консултации",
    catTitleFallback: "B2B секторен партньор",
    sponsoredBadge: "ПРЕПОРЪЧАН ПАРТНЬОР",
    verifiedBadge: "Проверен доставчик на услуги",
    targetCountriesLabel: "Обслужвани държави / региони:",
    whatsappMessagePrefix: "Здравейте",
    whatsappMessageBody:
      "свързвам се с вас чрез каталога за B2B услуги на Merter Vitrini и бих искал оферта за вашите услуги.",
    whatsappBtn: "Поискай оферта в WhatsApp",
    callBtn: "Директно обаждане",
    emptyTitle: "Все още няма регистрирани фирми в тази категория",
    emptyDesc:
      "В момента няма публикувани доставчици по този филтър. Ако предлагате карго транспорт, фотостудио, етикети, кройки или митнически услуги в Мертер, кандидатствайте тук.",
    emptyApplyBtn: "Кандидатствай като доставчик",
    verifyDefaultSuccess: "Потвърждението на имейл адреса приключи успешно.",
    verifyNetworkError: "Възникна мрежова грешка при проверката.",
    submittedTitle: "Изпратен е имейл за потвърждение!",
    submittedDescBeforeEmail: "Изпратихме линк за потвърждение до ",
    submittedDescBetween: ", валиден за ",
    submittedWindowLabel: "30 минути",
    submittedDescAfter:
      ". След като потвърдите имейла си, кандидатурата ще бъде разгледана от администратор.",
    securityPolicyTitle: "Политика за сигурност:",
    securityPolicyBody:
      "Заявки без потвърден имейл до 30 минути се изтриват автоматично и не се публикуват без одобрение.",
    gotItBtn: "Разбрах",
    modalTitle: "Кандидатура за каталога на B2B услуги",
    fieldCompanyPlaceholder: "Име на фирмата (напр. Merter Express Cargo) *",
    fieldContactPlaceholder: "Име и фамилия на лице за контакт *",
    fieldEmailPlaceholder: "Фирмен имейл (за потвърждение) *",
    fieldShortDescPlaceholder: "Кратко представяне на дейността *",
    fieldServicesPlaceholder:
      "Предлагани услуги (разделени със запетая: Консолидация, ATR...)",
    fieldCountriesPlaceholder:
      "Обслужвани държави (напр. България, Румъния, ЕС)",
    fieldPhonePlaceholder: "Телефон / WhatsApp номер *",
    fieldAddressPlaceholder: "Адрес на офис / склад в Мертер (Истанбул)",
    recaptchaNotice:
      "Защитено с Google reCAPTCHA v3, 30-минутно имейл потвърждение и одобрение от администратор.",
    submitBtn: "ИЗПРАТИ КАНДИДАТУРА И ЛИНК ЗА ПОТВЪРЖДЕНИЕ",
    submittingBtn: "ИЗПРАЩАНЕ...",
    submitErrorFallback: "Възникна грешка при изпращане на кандидатурата.",
  },
};

function subscribeCartStore(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("cart-updated", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("cart-updated", onStoreChange);
  };
}

function getCartPkgsSnapshot(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem("merter_b2b_cart");
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as CartItem[];
    if (!Array.isArray(parsed)) return 0;
    return parsed.reduce((sum, item) => sum + (Number(item.packages_qty) || 0), 0);
  } catch {
    return 0;
  }
}

interface GrecaptchaInstance {
  ready: (callback: () => void) => void;
  execute: (siteKey: string, options: { action: string }) => Promise<string>;
}

const DEFAULT_RECAPTCHA_SITE_KEY =
  process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ||
  "6LfwagMtAAAAAHpF7ID6J-bQmcn92YhFaSH9CX94";

async function executeServiceProviderCaptcha(actionName: string): Promise<string> {
  const grecaptcha = (
    window as unknown as { grecaptcha?: GrecaptchaInstance }
  ).grecaptcha;
  if (!grecaptcha) {
    return "";
  }
  await new Promise<void>((resolve) => {
    grecaptcha.ready(resolve);
  });
  try {
    return await grecaptcha.execute(DEFAULT_RECAPTCHA_SITE_KEY, {
      action: actionName,
    });
  } catch {
    return "";
  }
}

export interface ServiceProviderItem {
  id: string;
  slug: string;
  company_name: string;
  service_category: string;
  short_description: string;
  description: string;
  services_offered: string;
  target_countries: string;
  city: string;
  district: string;
  address: string;
  phone: string;
  whatsapp_phone: string;
  email: string;
  website: string;
  is_verified: boolean;
  is_sponsored: boolean;
  whatsapp_click_count: number;
  translations?: Record<
    string,
    {
      short_description?: string;
      services_offered?: string;
    }
  >;
}

function resolveCategoryTitle(
  serviceCategory: string,
  copy: ServiceProvidersLocaleCopy
): string {
  switch (serviceCategory) {
    case "kargo_lojistik":
      return copy.catTitleCargo;
    case "fotograf_studyo":
      return copy.catTitleStudio;
    case "ambalaj_etiket":
      return copy.catTitleLabel;
    case "modelist_kalip":
      return copy.catTitlePattern;
    case "ihracat_danismanlik":
      return copy.catTitleCustoms;
    default:
      return copy.catTitleFallback;
  }
}

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

function recordProviderClick(id: string) {
  void fetch(`/api/v1/store/service-providers/${encodeURIComponent(id)}/click`, {
    method: "POST",
    keepalive: true,
  }).catch(() => undefined);
}

function parseServiceTags(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function ServiceProviderBadges({
  isSponsored,
  isVerified,
  copy,
}: Readonly<{
  isSponsored: boolean;
  isVerified: boolean;
  copy: ServiceProvidersLocaleCopy;
}>) {
  return (
    <div className="flex items-center gap-2 flex-wrap mb-1">
      {isSponsored && (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-[#FAF7F2] border border-[#D8C7A6] text-[#6E542E] text-[10px] font-extrabold uppercase tracking-wider">
          <Sparkles size={11} />
          <span>{copy.sponsoredBadge}</span>
        </span>
      )}
      {isVerified && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-[#15803D] border border-emerald-200 text-[10px] font-bold">
          <ShieldCheck size={11} />
          <span>{copy.verifiedBadge}</span>
        </span>
      )}
    </div>
  );
}

function ServiceProviderContactMeta({
  targetCountries,
  address,
  phone,
  targetCountriesLabel,
}: Readonly<{
  targetCountries: string;
  address: string;
  phone: string;
  targetCountriesLabel: string;
}>) {
  return (
    <div className="pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
      {targetCountries && (
        <div className="flex items-center gap-1.5">
          <Globe size={13} className="text-[#8C6D3F] shrink-0" />
          <span>
            <strong>{targetCountriesLabel}</strong> {targetCountries}
          </span>
        </div>
      )}
      {address && (
        <div className="flex items-start gap-1.5">
          <MapPin size={13} className="text-slate-400 shrink-0 mt-0.5" />
          <span>{address}</span>
        </div>
      )}
      {phone && (
        <div className="flex items-center gap-1.5">
          <Phone size={13} className="text-slate-400 shrink-0" />
          <a
            href={`tel:${phone}`}
            className="font-bold text-[#1C1C1C] hover:underline no-underline"
          >
            {phone}
          </a>
        </div>
      )}
    </div>
  );
}

function ServiceProviderCard({
  item,
  lang,
  copy,
}: Readonly<{
  item: ServiceProviderItem;
  lang: string;
  copy: ServiceProvidersLocaleCopy;
}>) {
  const catLabel = resolveCategoryTitle(item.service_category, copy);
  const trMap = item.translations?.[lang];
  const shortDesc = trMap?.short_description || item.short_description;
  const serviceTags = parseServiceTags(
    trMap?.services_offered || item.services_offered
  );

  const waDigits = normalizeWaPhone(item.whatsapp_phone || item.phone);
  const waMsg = `${copy.whatsappMessagePrefix} *${item.company_name}*,\n${copy.whatsappMessageBody}`;
  const waHref = waDigits
    ? `https://wa.me/${waDigits}?text=${encodeURIComponent(waMsg)}`
    : "";

  const borderCls = item.is_sponsored
    ? "border-[#D8C7A6] bg-[#FAF7F2]/40"
    : "border-[#E5E0D8] bg-white";

  return (
    <div
      className={`rounded-lg border ${borderCls} shadow-xs hover:shadow-md transition-all p-6 flex flex-col justify-between gap-4`}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <ServiceProviderBadges
              isSponsored={item.is_sponsored}
              isVerified={item.is_verified}
              copy={copy}
            />
            <h2 className="text-base font-extrabold text-[#1C1C1C]">
              {item.company_name}
            </h2>
            <p className="text-xs font-bold text-[#6E542E] mt-0.5">{catLabel}</p>
          </div>
        </div>

        <p className="text-xs text-[#525252] leading-relaxed">{shortDesc}</p>

        {serviceTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {serviceTags.map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-1 rounded-md bg-[#F8F6F2] border border-[#E5E0D8] text-[#1C1C1C] text-[11px] font-semibold"
              >
                ✓ {tag}
              </span>
            ))}
          </div>
        )}

        <ServiceProviderContactMeta
          targetCountries={item.target_countries}
          address={item.address}
          phone={item.phone}
          targetCountriesLabel={copy.targetCountriesLabel}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-3 border-t border-slate-100">
        {waHref && (
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => recordProviderClick(item.id)}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-md bg-[#15803D] hover:bg-[#166534] text-white text-xs font-extrabold no-underline transition-colors"
          >
            <MessageCircle size={14} />
            <span>{copy.whatsappBtn}</span>
          </a>
        )}
        {item.phone && (
          <a
            href={`tel:${item.phone}`}
            onClick={() => recordProviderClick(item.id)}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-md bg-[#1C1C1C] hover:bg-[#333333] text-white text-xs font-extrabold no-underline transition-colors shadow-xs"
          >
            <Phone size={14} />
            <span>{copy.callBtn}</span>
          </a>
        )}
      </div>
    </div>
  );
}

function ServiceProvidersDirectoryContent({
  loading,
  items,
  lang,
  copy,
  onOpenApply,
}: Readonly<{
  loading: boolean;
  items: readonly ServiceProviderItem[];
  lang: string;
  copy: ServiceProvidersLocaleCopy;
  onOpenApply: () => void;
}>) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map((n) => (
          <div
            key={n}
            className="h-56 rounded-lg bg-white border border-[#E5E0D8] animate-pulse p-6"
          />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-[#E5E0D8] p-10 sm:p-14 text-center space-y-4 shadow-xs">
        <div className="w-14 h-14 rounded-lg bg-[#F8F6F2] border border-[#E5E0D8] text-[#8C6D3F] flex items-center justify-center mx-auto">
          <Sparkles size={26} />
        </div>
        <div className="space-y-1.5 max-w-lg mx-auto">
          <h2 className="text-base sm:text-lg font-extrabold text-[#1C1C1C]">
            {copy.emptyTitle}
          </h2>
          <p className="text-xs sm:text-sm text-[#525252] leading-relaxed">
            {copy.emptyDesc}
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenApply}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-md bg-[#1C1C1C] hover:bg-[#333333] text-white text-xs font-extrabold uppercase tracking-wider cursor-pointer border-none shadow-xs"
        >
          <Plus size={15} />
          <span>{copy.emptyApplyBtn}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {items.map((item) => (
        <ServiceProviderCard
          key={item.id}
          item={item}
          lang={lang}
          copy={copy}
        />
      ))}
    </div>
  );
}

interface VerifyBannerState {
  type: "success" | "error";
  message: string;
}

async function safeParseJson<T>(res: Response): Promise<T> {
  try {
    return (await res.json()) as T;
  } catch {
    return {} as T;
  }
}

async function verifyServiceProviderToken(
  verifyToken: string,
  copy: ServiceProvidersLocaleCopy
): Promise<VerifyBannerState> {
  try {
    const res = await fetch(
      `/api/v1/store/service-providers/verify?token=${encodeURIComponent(verifyToken)}`
    );
    const data = await safeParseJson<{ message?: string; error?: string }>(res);
    return {
      type: res.ok ? "success" : "error",
      message: data.message || data.error || copy.verifyDefaultSuccess,
    };
  } catch {
    return {
      type: "error",
      message: copy.verifyNetworkError,
    };
  }
}

function ServiceProviderVerifyAlert({
  banner,
  onDismiss,
}: Readonly<{ banner: VerifyBannerState | null; onDismiss: () => void }>) {
  if (!banner) return null;
  const isSuccess = banner.type === "success";
  const boxCls = isSuccess
    ? "bg-emerald-50 border-emerald-200 text-emerald-900"
    : "bg-rose-50 border-rose-200 text-rose-900";

  return (
    <div
      className={`rounded-2xl p-4 border flex items-center justify-between gap-3 text-xs sm:text-sm font-bold ${boxCls}`}
    >
      <div className="flex items-center gap-2.5">
        {isSuccess ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
        ) : (
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
        )}
        <span>{banner.message}</span>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="text-slate-500 hover:text-slate-800 font-extrabold cursor-pointer bg-transparent border-none"
      >
        ✕
      </button>
    </div>
  );
}

function ServiceProviderSubmittedNotice({
  submittedEmail,
  copy,
  onClose,
}: Readonly<{
  submittedEmail: string;
  copy: ServiceProvidersLocaleCopy;
  onClose: () => void;
}>) {
  return (
    <div className="py-4 text-center space-y-3">
      <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mx-auto">
        <Mail size={30} />
      </div>
      <h4 className="text-base font-black text-slate-900">
        {copy.submittedTitle}
      </h4>
      <p className="text-xs text-slate-600 leading-relaxed">
        {copy.submittedDescBeforeEmail}
        <strong>{submittedEmail}</strong>
        {copy.submittedDescBetween}
        <strong>{copy.submittedWindowLabel}</strong>
        {copy.submittedDescAfter}
      </p>
      <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-left text-[11px] text-amber-900 leading-relaxed font-medium">
        ⚠️ <strong>{copy.securityPolicyTitle}</strong> {copy.securityPolicyBody}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="w-full py-2.5 rounded-md bg-[#1C1C1C] hover:bg-[#333333] text-white text-xs font-extrabold cursor-pointer border-none shadow-xs"
      >
        {copy.gotItBtn}
      </button>
    </div>
  );
}

interface ServiceProviderApplyModalProps {
  readonly isOpen: boolean;
  readonly copy: ServiceProvidersLocaleCopy;
  readonly onClose: () => void;
  readonly onSuccess: () => void;
}

function ServiceProviderApplyModal({
  isOpen,
  copy,
  onClose,
  onSuccess,
}: ServiceProviderApplyModalProps) {
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [serviceCat, setServiceCat] = useState("kargo_lojistik");
  const [shortDesc, setShortDesc] = useState("");
  const [servicesOffered, setServicesOffered] = useState("");
  const [targetCountries, setTargetCountries] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittedOk, setSubmittedOk] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleClose = () => {
    setSubmittedOk(false);
    setSubmitError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      const recaptchaToken = await executeServiceProviderCaptcha(
        "service_provider_apply"
      );
      const targetEmail = email.trim();
      const res = await fetch("/api/v1/store/service-providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: companyName.trim(),
          contact_name: contactName.trim(),
          email: targetEmail,
          service_category: serviceCat,
          short_description: shortDesc.trim(),
          services_offered: servicesOffered.trim(),
          target_countries: targetCountries.trim(),
          address: address.trim(),
          phone: phone.trim(),
          whatsapp_phone: phone.trim(),
          recaptcha_token: recaptchaToken,
        }),
      });
      const data = await safeParseJson<{ error?: string }>(res);
      if (!res.ok) {
        setSubmitError(data.error || copy.submitErrorFallback);
        return;
      }
      setSubmittedEmail(targetEmail);
      setSubmittedOk(true);
      setCompanyName("");
      setContactName("");
      setEmail("");
      setShortDesc("");
      setServicesOffered("");
      setTargetCountries("");
      setAddress("");
      setPhone("");
      onSuccess();
    } finally {
      setSubmitting(false);
    }
  };

  const submitLabel = submitting ? copy.submittingBtn : copy.submitBtn;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-extrabold text-slate-900">
            {copy.modalTitle}
          </h3>
          <button
            type="button"
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-700 font-bold cursor-pointer border-none bg-transparent"
          >
            ✕
          </button>
        </div>

        {submittedOk ? (
          <ServiceProviderSubmittedNotice
            submittedEmail={submittedEmail}
            copy={copy}
            onClose={handleClose}
          />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {submitError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            <div>
              <label htmlFor="sp-company-name" className="sr-only">
                {copy.fieldCompanyPlaceholder}
              </label>
              <input
                id="sp-company-name"
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder={copy.fieldCompanyPlaceholder}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="sp-contact-name" className="sr-only">
                  {copy.fieldContactPlaceholder}
                </label>
                <input
                  id="sp-contact-name"
                  type="text"
                  required
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder={copy.fieldContactPlaceholder}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold"
                />
              </div>
              <div>
                <label htmlFor="sp-email" className="sr-only">
                  {copy.fieldEmailPlaceholder}
                </label>
                <input
                  id="sp-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={copy.fieldEmailPlaceholder}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold"
                />
              </div>
            </div>

            <div>
              <label htmlFor="sp-category" className="sr-only">
                {copy.catAll}
              </label>
              <select
                id="sp-category"
                value={serviceCat}
                onChange={(e) => setServiceCat(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold bg-white"
              >
                <option value="kargo_lojistik">{copy.catCargo}</option>
                <option value="fotograf_studyo">{copy.catStudio}</option>
                <option value="ambalaj_etiket">{copy.catLabel}</option>
                <option value="modelist_kalip">{copy.catPattern}</option>
                <option value="ihracat_danismanlik">{copy.catCustoms}</option>
              </select>
            </div>

            <div>
              <label htmlFor="sp-short-desc" className="sr-only">
                {copy.fieldShortDescPlaceholder}
              </label>
              <input
                id="sp-short-desc"
                type="text"
                required
                value={shortDesc}
                onChange={(e) => setShortDesc(e.target.value)}
                placeholder={copy.fieldShortDescPlaceholder}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold"
              />
            </div>

            <div>
              <label htmlFor="sp-services-offered" className="sr-only">
                {copy.fieldServicesPlaceholder}
              </label>
              <input
                id="sp-services-offered"
                type="text"
                value={servicesOffered}
                onChange={(e) => setServicesOffered(e.target.value)}
                placeholder={copy.fieldServicesPlaceholder}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold"
              />
            </div>

            <div>
              <label htmlFor="sp-target-countries" className="sr-only">
                {copy.fieldCountriesPlaceholder}
              </label>
              <input
                id="sp-target-countries"
                type="text"
                value={targetCountries}
                onChange={(e) => setTargetCountries(e.target.value)}
                placeholder={copy.fieldCountriesPlaceholder}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="sp-phone" className="sr-only">
                  {copy.fieldPhonePlaceholder}
                </label>
                <input
                  id="sp-phone"
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={copy.fieldPhonePlaceholder}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold"
                />
              </div>
              <div>
                <label htmlFor="sp-address" className="sr-only">
                  {copy.fieldAddressPlaceholder}
                </label>
                <input
                  id="sp-address"
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder={copy.fieldAddressPlaceholder}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-[#F8F6F2] border border-[#E5E0D8] text-[11px] text-[#525252] font-medium">
              <ShieldCheck size={15} className="text-[#15803D] shrink-0" />
              <span>{copy.recaptchaNotice}</span>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-md bg-[#1C1C1C] hover:bg-[#333333] text-white text-xs font-extrabold uppercase tracking-wider cursor-pointer border-none shadow-xs"
            >
              {submitLabel}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

interface ServiceProvidersClientProps {
  readonly initialLang?: SupportedSeoLang;
  readonly initialItems?: readonly ServiceProviderItem[];
  readonly initialCategories?: readonly Category[];
}

export default function ServiceProvidersClient({
  initialLang = "tr",
  initialItems = [],
  initialCategories = [],
}: ServiceProvidersClientProps) {
  const router = useRouter();
  const totalPkgs = useSyncExternalStore(
    subscribeCartStore,
    getCartPkgsSnapshot,
    () => 0
  );

  const [lang, setLang] = useState<string>(initialLang);
  const [isLangOpen, setIsLangOpen] = useState<boolean>(false);
  const [displayCurrency, setDisplayCurrency] = useState<string>("TRY");
  const [categories, setCategories] = useState<Category[]>([
    ...initialCategories,
  ]);

  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [items, setItems] = useState<ServiceProviderItem[]>([...initialItems]);
  const [loading, setLoading] = useState<boolean>(initialItems.length === 0);
  const [showApplyModal, setShowApplyModal] = useState<boolean>(false);
  const [verifyBanner, setVerifyBanner] = useState<VerifyBannerState | null>(
    null
  );
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState<boolean>(false);
  const [policyModalType, setPolicyModalType] = useState<
    "cancellation_and_return" | "terms_of_service" | "privacy_policy" | ""
  >("");

  const safeLang = normalizeSeoLang(lang, "tr");
  const copy = SERVICE_PROVIDERS_COPY[safeLang];
  const hasSkippedFirstPrefetchedLoad = useRef<boolean>(false);

  const serviceCategories = useMemo(
    () => [
      { id: "all", label: copy.catAll, icon: Sparkles },
      { id: "kargo_lojistik", label: copy.catCargo, icon: Truck },
      { id: "fotograf_studyo", label: copy.catStudio, icon: Camera },
      { id: "ambalaj_etiket", label: copy.catLabel, icon: Tag },
      { id: "modelist_kalip", label: copy.catPattern, icon: Scissors },
      { id: "ihracat_danismanlik", label: copy.catCustoms, icon: Globe },
    ],
    [copy]
  );

  useEffect(() => {
    const scriptId = "recaptcha-v3-script";
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = `https://www.google.com/recaptcha/api.js?render=${DEFAULT_RECAPTCHA_SITE_KEY}&hl=${safeLang}`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  }, [safeLang]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const verifyToken = params.get("verify_token");
    if (!verifyToken) return;

    void verifyServiceProviderToken(verifyToken, copy).then((bannerState) => {
      setVerifyBanner(bannerState);
      const cleanPath =
        safeLang === "tr"
          ? "/hizmet-saglayicilar"
          : `/hizmet-saglayicilar?lang=${safeLang}`;
      window.history.replaceState({}, "", cleanPath);
    });
  }, [copy, safeLang]);

  const loadProviders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/store/service-providers?category=${encodeURIComponent(selectedCategory)}&q=${encodeURIComponent(searchQuery)}`
      );
      if (res.ok) {
        const data = (await res.json()) as ServiceProviderItem[];
        setItems(data || []);
      }
    } catch {
      // Ignore transient network errors
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    if (initialCategories.length === 0) {
      void apiFetch<Category[]>("/categories").then((c) => {
        if (c) setCategories(c);
      });
    }
  }, [initialCategories.length]);

  useEffect(() => {
    if (
      !hasSkippedFirstPrefetchedLoad.current &&
      initialItems.length > 0 &&
      selectedCategory === "all" &&
      searchQuery === ""
    ) {
      hasSkippedFirstPrefetchedLoad.current = true;
      return;
    }
    const timer = setTimeout(() => {
      void loadProviders();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadProviders, initialItems.length, selectedCategory, searchQuery]);

  const handleLangChange = (nextLang: string) => {
    const normalized = normalizeSeoLang(nextLang, "tr");
    setLang(normalized);
    router.push(
      normalized === "tr"
        ? "/hizmet-saglayicilar"
        : `/hizmet-saglayicilar?lang=${normalized}`
    );
  };

  return (
    <div
      dir={safeLang === "ar" ? "rtl" : "ltr"}
      className="min-h-screen flex flex-col bg-slate-50"
    >
      <Header
        lang={safeLang}
        setLang={handleLangChange}
        isLangOpen={isLangOpen}
        setIsLangOpen={setIsLangOpen}
        totalPkgs={totalPkgs}
        setIsCartOpen={(open) => {
          if (open) router.push(`/${getCategoryPrefix(safeLang)}/cart`);
        }}
        setCurrentPage={() => undefined}
        categories={categories}
        activeCategoryId=""
        displayCurrency={displayCurrency}
        onCurrencyChange={setDisplayCurrency}
      />

      <main className="flex-grow max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <ServiceProviderVerifyAlert
          banner={verifyBanner}
          onDismiss={() => setVerifyBanner(null)}
        />

        {/* Hero Banner */}
        <div className="bg-[#F8F6F2] border border-[#E5E0D8] text-[#1C1C1C] rounded-lg p-6 sm:p-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6 shadow-xs">
          <div className="space-y-2.5 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#E5E0D8] text-[#6E542E] text-xs font-extrabold uppercase tracking-wider">
              <Sparkles size={13} className="text-[#8C6D3F]" />
              <span>{copy.heroBadge}</span>
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1C1C1C]">
              {copy.heroTitle}
            </h1>
            <p className="text-xs sm:text-sm text-[#525252] leading-relaxed">
              {copy.heroDesc}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowApplyModal(true)}
            className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-md bg-[#1C1C1C] hover:bg-[#333333] text-white text-xs font-extrabold uppercase tracking-wider shrink-0 cursor-pointer border-none shadow-xs transition-colors"
          >
            <Plus size={16} />
            <span>{copy.heroApplyBtn}</span>
          </button>
        </div>

        {/* Category Filter Tabs & Search */}
        <div className="bg-white rounded-lg border border-[#E5E0D8] p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xs">
          <div className="flex flex-wrap gap-2">
            {serviceCategories.map((cat) => {
              const Icon = cat.icon;
              const active = selectedCategory === cat.id;
              const btnCls = active
                ? "bg-[#1C1C1C] text-white border border-[#1C1C1C] shadow-xs"
                : "bg-white hover:bg-[#F8F6F2] text-[#525252] hover:text-[#1C1C1C] border border-[#D6D1C7] hover:border-[#1C1C1C]";
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-bold cursor-pointer transition-colors ${btnCls}`}
                >
                  <Icon size={14} />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          <div className="relative min-w-[260px]">
            <label htmlFor="sp-search-input" className="sr-only">
              {copy.searchLabel}
            </label>
            <Search
              size={15}
              className="text-slate-400 absolute start-3 top-1/2 -translate-y-1/2"
            />
            <input
              id="sp-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={copy.searchPlaceholder}
              className="w-full ps-9 pe-3 py-2 rounded-md border border-[#D6D1C7] text-xs font-semibold focus:outline-none focus:border-[#1C1C1C]"
            />
          </div>
        </div>

        {/* Directory Grid */}
        <ServiceProvidersDirectoryContent
          loading={loading}
          items={items}
          lang={safeLang}
          copy={copy}
          onOpenApply={() => setShowApplyModal(true)}
        />
      </main>

      <ServiceProviderApplyModal
        isOpen={showApplyModal}
        copy={copy}
        onClose={() => setShowApplyModal(false)}
        onSuccess={() => void loadProviders()}
      />

      <Footer
        lang={safeLang}
        onOpenPolicy={(type) => {
          setPolicyModalType(type);
          setIsPolicyModalOpen(true);
        }}
      />

      <PolicyViewerModal
        isOpen={isPolicyModalOpen}
        onClose={() => {
          setIsPolicyModalOpen(false);
          setPolicyModalType("");
        }}
        policyType={policyModalType}
        lang={safeLang}
      />
    </div>
  );
}
