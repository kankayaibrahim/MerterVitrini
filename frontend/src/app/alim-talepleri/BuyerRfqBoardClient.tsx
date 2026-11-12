"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  Plus,
  Search,
  Globe,
  Package,
  Calendar,
  Building2,
  CheckCircle2,
  Lock,
  UserPlus,
  LogIn,
  X,
} from "lucide-react";
import { CartItem, Category } from "@/types/store";
import { getCategoryPrefix } from "@/app/i18n";
import { apiFetch, showToast } from "@/app/utils";
import {
  getValidStoreUser,
  openStoreAuthModal,
  useIsStoreMemberLoggedIn,
} from "@/app/storeAuth";
import Header from "@/components/store/Header";
import Footer from "@/components/store/Footer";
import PolicyViewerModal from "@/components/store/PolicyViewerModal";
import {
  INTL_LOCALE_BY_LANG,
  SupportedSeoLang,
  normalizeSeoLang,
} from "@/utils/seoHelpers";

interface RfqBoardLocaleCopy {
  readonly heroBadge: string;
  readonly heroTitle: string;
  readonly heroDesc: string;
  readonly heroCreateBtn: string;
  readonly searchPlaceholder: string;
  readonly prodAll: string;
  readonly prodReadyWholesale: string;
  readonly prodPrivateLabel: string;
  readonly prodFason: string;
  readonly prodFabric: string;
  readonly cardTargetQty: string;
  readonly cardCategory: string;
  readonly cardBuyerCountry: string;
  readonly cardBuyer: string;
  readonly cardVerifiedBuyer: string;
  readonly cardUnverifiedEmail: string;
  readonly cardOfferCountSuffix: string;
  readonly cardSupplierQuoteBtn: string;
  readonly loadingText: string;
  readonly emptyText: string;
  readonly emptyCreateBtn: string;
  readonly gateBadge: string;
  readonly gateTitle: string;
  readonly gateDesc: string;
  readonly gateLoginBtn: string;
  readonly gateRegisterBtn: string;
  readonly gateSupplierBtn: string;
  readonly modalTitle: string;
  readonly modalSubtitle: string;
  readonly fieldTitleLabel: string;
  readonly fieldTitlePlaceholder: string;
  readonly fieldTypeLabel: string;
  readonly fieldQtyLabel: string;
  readonly fieldCatLabel: string;
  readonly fieldCatPlaceholder: string;
  readonly fieldDescLabel: string;
  readonly fieldDescPlaceholder: string;
  readonly fieldBuyerNameLabel: string;
  readonly fieldBuyerNamePlaceholder: string;
  readonly fieldCompanyCountryLabel: string;
  readonly fieldCompanyPlaceholder: string;
  readonly fieldCountryPlaceholder: string;
  readonly fieldPhoneLabel: string;
  readonly fieldEmailLabel: string;
  readonly fieldEmailPlaceholder: string;
  readonly defaultCountry: string;
  readonly cancelBtn: string;
  readonly submitBtn: string;
  readonly submittingBtn: string;
  readonly toastLoginRequired: string;
  readonly toastRequiredFields: string;
  readonly toastPublished: string;
  readonly toastSessionExpired: string;
  readonly toastCreateError: string;
  readonly toastNetworkError: string;
}

const RFQ_BOARD_COPY: Record<SupportedSeoLang, RfqBoardLocaleCopy> = {
  tr: {
    heroBadge: "B2B ALICI TALEP PANOSU (BUYING LEADS / RFQ)",
    heroTitle: "Aradığınız Ürünü İlan Edin, Merter Üreticileri Teklif Versin",
    heroDesc:
      "\"500 adet kadın kabanı arıyoruz\", \"Özel etiketli (Private Label) tişört yaptırmak istiyoruz\" gibi toptan alım ve üretim taleplerinizi ücretsiz açın; doğrulanmış Merter üreticileri doğrudan sizinle iletişime geçsin.",
    heroCreateBtn: "Yeni Alım İlanı (RFQ) Oluştur",
    searchPlaceholder: "İlan başlığı, kategori veya alıcı ülkeye göre ara...",
    prodAll: "Tüm Talepler",
    prodReadyWholesale: "Hazır Toptan Koleksiyon",
    prodPrivateLabel: "Private Label (Özel Etiket)",
    prodFason: "Fason Üretim Talebi",
    prodFabric: "Kumaş & Aksesuar",
    cardTargetQty: "Hedef Miktar",
    cardCategory: "Kategori",
    cardBuyerCountry: "Alıcı Ülke",
    cardBuyer: "Alıcı",
    cardVerifiedBuyer: "✓ Doğrulanmış Müşteri",
    cardUnverifiedEmail: "E-posta Onaysız",
    cardOfferCountSuffix: "Üretici Teklif Verdi",
    cardSupplierQuoteBtn: "Üretici Olarak Teklif Ver",
    loadingText: "Alıcı talep ilanları yükleniyor...",
    emptyText:
      "Henüz bu kriterde açık alım ilanı bulunmuyor. İlk alım ilanını siz oluşturun!",
    emptyCreateBtn: "Yeni Alım İlanı (RFQ) Aç",
    gateBadge: "ÜYELERE ÖZEL B2B TALEP MERKEZİ",
    gateTitle: "Alıcı Talep Panosu (RFQ) Üyelere Özeldir",
    gateDesc:
      "Toptan alım ilanlarını görüntülemek, yeni alım/üretim talebi (RFQ) oluşturmak veya üretici olarak alıcılara doğrudan teklif vermek için lütfen üye girişi yapın.",
    gateLoginBtn: "Üye Girişi Yap",
    gateRegisterBtn: "Ücretsiz B2B Üye Ol",
    gateSupplierBtn: "Üretici / Tedarikçi Girişi",
    modalTitle: "Yeni Toptan Alım & Üretim İlanı (RFQ) Oluştur",
    modalSubtitle:
      "Aradığınız ürünü yazın, Merter üreticileri doğrudan WhatsApp ve telefonla size teklif versin.",
    fieldTitleLabel: "Alım İlanı Başlığı *",
    fieldTitlePlaceholder:
      "Örn: Almanya mağazalarımız için 500 adet kadın kaşe kaban arıyoruz",
    fieldTypeLabel: "Talep Türü",
    fieldQtyLabel: "Hedef Miktar *",
    fieldCatLabel: "Birim / Kategori",
    fieldCatPlaceholder: "Kadın Giyim / Elbise",
    fieldDescLabel: "Teknik Detaylar (Kumaş, Beden Serisi, Teslimat Beklentisi)",
    fieldDescPlaceholder:
      "Kumaş içeriği, renk/beden dağılımı, özel etiket talebiniz ve hedef fiyat aralığınızı belirtebilirsiniz...",
    fieldBuyerNameLabel: "Adınız Soyadınız *",
    fieldBuyerNamePlaceholder: "Ad Soyad",
    fieldCompanyCountryLabel: "Firma Adı & Ülke *",
    fieldCompanyPlaceholder: "Firma Adı",
    fieldCountryPlaceholder: "Ülke (Örn: Almanya)",
    fieldPhoneLabel: "Doğrudan WhatsApp / Telefon *",
    fieldEmailLabel: "E-Posta Adresi",
    fieldEmailPlaceholder: "ornek@firma.com",
    defaultCountry: "Türkiye",
    cancelBtn: "Vazgeç",
    submitBtn: "Alım İlanını Yayınla",
    submittingBtn: "Yayınlanıyor...",
    toastLoginRequired: "Alım ilanı (RFQ) açmak için lütfen üye girişi yapın.",
    toastRequiredFields:
      "Lütfen ilan başlığı, ad soyad ve telefon/WhatsApp numaranızı girin.",
    toastPublished:
      "Alım talebiniz (RFQ) yayınlandı! Merter üreticileri doğrudan size teklif iletecektir.",
    toastSessionExpired: "Oturum süreniz dolmuş. Lütfen tekrar üye girişi yapın.",
    toastCreateError: "Alım talebi oluşturulurken bir hata oluştu.",
    toastNetworkError: "Bağlantı hatası oluştu.",
  },
  en: {
    heroBadge: "B2B WHOLESALE BUYING LEADS & RFQ BOARD",
    heroTitle: "Post Your Wholesale Request, Receive Direct Merter Factory Quotes",
    heroDesc:
      "Post free B2B buying leads such as \"Looking for 500 pcs women's wool coats\" or \"Low-MOQ private label t-shirt production\" and connect directly with verified Merter Istanbul clothing manufacturers.",
    heroCreateBtn: "Post New Buying Request (RFQ)",
    searchPlaceholder: "Search by request title, category, or buyer country...",
    prodAll: "All Requests",
    prodReadyWholesale: "Ready Wholesale Stock",
    prodPrivateLabel: "Private Label (OEM)",
    prodFason: "CMT / Contract Manufacturing",
    prodFabric: "Fabrics & Trims",
    cardTargetQty: "Target Qty",
    cardCategory: "Category",
    cardBuyerCountry: "Buyer Country",
    cardBuyer: "Buyer",
    cardVerifiedBuyer: "✓ Verified Buyer",
    cardUnverifiedEmail: "Unverified Email",
    cardOfferCountSuffix: "Manufacturer Quotes",
    cardSupplierQuoteBtn: "Submit Factory Quote",
    loadingText: "Loading wholesale buying requests...",
    emptyText:
      "No open buying requests match this filter yet. Be the first buyer to post an RFQ!",
    emptyCreateBtn: "Post New RFQ",
    gateBadge: "MEMBERS-ONLY B2B SOURCING HUB",
    gateTitle: "The B2B Buying Leads (RFQ) Board Is for Registered Members",
    gateDesc:
      "Please sign in to view active wholesale buying leads, post a new sourcing/production RFQ, or send direct factory offers as a verified manufacturer.",
    gateLoginBtn: "Member Sign In",
    gateRegisterBtn: "Free B2B Registration",
    gateSupplierBtn: "Manufacturer / Supplier Login",
    modalTitle: "Create New Wholesale Buying & Production RFQ",
    modalSubtitle:
      "Describe what you need and verified Merter Istanbul factories will contact you directly via WhatsApp & phone.",
    fieldTitleLabel: "RFQ Title *",
    fieldTitlePlaceholder:
      "e.g., Looking for 500 pcs women's wool coats for our boutiques in Germany",
    fieldTypeLabel: "Request Type",
    fieldQtyLabel: "Target Quantity *",
    fieldCatLabel: "Category / Product Group",
    fieldCatPlaceholder: "Women's Clothing / Dresses",
    fieldDescLabel: "Technical Specs (Fabric, Size Ratio, Delivery Timeline)",
    fieldDescPlaceholder:
      "Specify fabric composition, color/size assortment, custom neck labels, and target price range...",
    fieldBuyerNameLabel: "Full Name *",
    fieldBuyerNamePlaceholder: "Full Name",
    fieldCompanyCountryLabel: "Company Name & Country *",
    fieldCompanyPlaceholder: "Company Name",
    fieldCountryPlaceholder: "Country (e.g., Germany)",
    fieldPhoneLabel: "Direct WhatsApp / Phone *",
    fieldEmailLabel: "Business Email",
    fieldEmailPlaceholder: "buyer@company.com",
    defaultCountry: "United Kingdom",
    cancelBtn: "Cancel",
    submitBtn: "Publish Buying Request",
    submittingBtn: "Publishing...",
    toastLoginRequired: "Please sign in to post a wholesale buying request (RFQ).",
    toastRequiredFields:
      "Please enter an RFQ title, your full name, and WhatsApp/phone number.",
    toastPublished:
      "Your RFQ is live! Verified Merter manufacturers will contact you directly with quotes.",
    toastSessionExpired: "Your session has expired. Please sign in again.",
    toastCreateError: "Failed to publish buying request.",
    toastNetworkError: "Network connection error occurred.",
  },
  ru: {
    heroBadge: "B2B ДОСКА ОПТОВЫХ ЗАЯВОК ПОКУПАТЕЛЕЙ (RFQ)",
    heroTitle: "Разместите заявку на закупку — фабрики Мертера предложат цены",
    heroDesc:
      "Бесплатно публикуйте оптовые запросы («Ищем 500 женских пальто», «Пошив футболок под своим брендом Private Label») и получайте прямые предложения от проверенных фабрик Мертера (Стамбул).",
    heroCreateBtn: "Создать заявку (RFQ)",
    searchPlaceholder: "Поиск по заголовку, категории или стране покупателя...",
    prodAll: "Все заявки",
    prodReadyWholesale: "Готовые коллекции оптом",
    prodPrivateLabel: "Private Label (СТМ)",
    prodFason: "Контрактный пошив",
    prodFabric: "Ткани и фурнитура",
    cardTargetQty: "Объем",
    cardCategory: "Категория",
    cardBuyerCountry: "Страна",
    cardBuyer: "Покупатель",
    cardVerifiedBuyer: "✓ Проверенный байер",
    cardUnverifiedEmail: "Email не подтвержден",
    cardOfferCountSuffix: "предложений от фабрик",
    cardSupplierQuoteBtn: "Предложить от фабрики",
    loadingText: "Загрузка оптовых заявок покупателей...",
    emptyText:
      "По выбранному фильтру пока нет открытых заявок. Создайте первую заявку на закупку!",
    emptyCreateBtn: "Разместить заявку (RFQ)",
    gateBadge: "ЗАКРЫТЫЙ B2B ЦЕНТР ЗАКУПОК",
    gateTitle: "Доска оптовых заявок (RFQ) доступна участникам B2B",
    gateDesc:
      "Войдите в аккаунт, чтобы просматривать актуальные запросы байеров, размещать заявки на пошив/закупку или отправлять прямые предложения от фабрики.",
    gateLoginBtn: "Вход для покупателей",
    gateRegisterBtn: "Бесплатная B2B регистрация",
    gateSupplierBtn: "Вход для производителей",
    modalTitle: "Новая заявка на оптовую закупку или пошив (RFQ)",
    modalSubtitle:
      "Опишите нужный товар — фабрики Мертера свяжутся с вами напрямую в WhatsApp или по телефону.",
    fieldTitleLabel: "Заголовок заявки *",
    fieldTitlePlaceholder:
      "Напр.: Ищем 500 шт. женских кашемировых пальто для сети магазинов в Москве",
    fieldTypeLabel: "Тип запроса",
    fieldQtyLabel: "Целевое количество *",
    fieldCatLabel: "Категория товара",
    fieldCatPlaceholder: "Женская одежда / Платья",
    fieldDescLabel: "Технические детали (ткань, размерный ряд, сроки поставки)",
    fieldDescPlaceholder:
      "Укажите состав ткани, цвета/размеры, бирки СТМ и желаемый диапазон цен...",
    fieldBuyerNameLabel: "Имя и фамилия *",
    fieldBuyerNamePlaceholder: "Имя Фамилия",
    fieldCompanyCountryLabel: "Компания и страна *",
    fieldCompanyPlaceholder: "Название компании",
    fieldCountryPlaceholder: "Страна (напр., Россия)",
    fieldPhoneLabel: "Прямой WhatsApp / Телефон *",
    fieldEmailLabel: "Электронная почта",
    fieldEmailPlaceholder: "buyer@company.ru",
    defaultCountry: "Россия",
    cancelBtn: "Отмена",
    submitBtn: "Опубликовать заявку",
    submittingBtn: "Публикация...",
    toastLoginRequired: "Войдите в аккаунт, чтобы разместить заявку (RFQ).",
    toastRequiredFields:
      "Пожалуйста, укажите заголовок, имя и номер телефона / WhatsApp.",
    toastPublished:
      "Ваша заявка (RFQ) опубликована! Фабрики Мертера свяжутся с вами напрямую.",
    toastSessionExpired: "Сессия истекла. Пожалуйста, войдите снова.",
    toastCreateError: "Ошибка при создании заявки.",
    toastNetworkError: "Ошибка соединения с сервером.",
  },
  ar: {
    heroBadge: "لوحة طلبات الشراء بالجملة والتصنيع (RFQ)",
    heroTitle: "انشر طلب الشراء الخاص بك واحصل على عروض مباشرة من مصانع مارتر",
    heroDesc:
      "افتح طلب شراء مجاني للجملة أو التصنيع الخاص (Private Label) مثل «نبحث عن 500 عباية أو فستان نسائي»، وسيتواصل معك مصنعو مارتر المعتمدون في إسطنبول مباشرة عبر واتساب.",
    heroCreateBtn: "إنشاء طلب شراء جديد (RFQ)",
    searchPlaceholder: "ابحث حسب عنوان الطلب أو الفئة أو دولة المشتري...",
    prodAll: "جميع الطلبات",
    prodReadyWholesale: "بضاعة جملة جاهزة",
    prodPrivateLabel: "تصنيع خاص (Private Label)",
    prodFason: "تصنيع للغير (فاسون)",
    prodFabric: "أقمشة وإكسسوارات",
    cardTargetQty: "الكمية المطلوبة",
    cardCategory: "الفئة",
    cardBuyerCountry: "دولة المشتري",
    cardBuyer: "المشتري",
    cardVerifiedBuyer: "✓ مشتري موثق",
    cardUnverifiedEmail: "بريد غير مؤكد",
    cardOfferCountSuffix: "عروض من المصانع",
    cardSupplierQuoteBtn: "تقديم عرض كمصنع",
    loadingText: "جاري تحميل طلبات الشراء بالجملة...",
    emptyText:
      "لا توجد طلبات شراء مفتوحة بهذه المعايير حالياً. كن أول من ينشر طلب شراء!",
    emptyCreateBtn: "فتح طلب شراء (RFQ)",
    gateBadge: "مركز طلبات B2B للأعضاء فقط",
    gateTitle: "لوحة طلبات الشراء بالجملة (RFQ) مخصصة للأعضاء المسجلين",
    gateDesc:
      "يرجى تسجيل الدخول لعرض طلبات الشراء بالجملة، أو نشر طلب تصنيع/توريد جديد، أو تقديم عروض أسعار مباشرة كمصنع معتمد.",
    gateLoginBtn: "تسجيل دخول الأعضاء",
    gateRegisterBtn: "تسجيل حساب B2B مجاني",
    gateSupplierBtn: "دخول المصانع والموردين",
    modalTitle: "إنشاء طلب شراء أو تصنيع بالجملة (RFQ)",
    modalSubtitle:
      "اكتب مواصفات المنتج المطلوب وستتواصل معك مصانع مارتر مباشرة عبر واتساب والهاتف.",
    fieldTitleLabel: "عنوان طلب الشراء *",
    fieldTitlePlaceholder:
      "مثال: مطلوب 500 فستان سهرة وموديلات محجبات لمتاجرنا في الرياض ودبي",
    fieldTypeLabel: "نوع الطلب",
    fieldQtyLabel: "الكمية المستهدفة *",
    fieldCatLabel: "الفئة / القسم",
    fieldCatPlaceholder: "ملابس نسائية / فساتين",
    fieldDescLabel: "التفاصيل الفنية (القماش، المقاسات، موعد الشحن)",
    fieldDescPlaceholder:
      "اذكر خامة القماش وتوزيع الألوان والمقاسات وطلب الليبل الخاص والسعر المستهدف...",
    fieldBuyerNameLabel: "الاسم الكامل *",
    fieldBuyerNamePlaceholder: "الاسم واللقب",
    fieldCompanyCountryLabel: "اسم الشركة والدولة *",
    fieldCompanyPlaceholder: "اسم الشركة",
    fieldCountryPlaceholder: "الدولة (مثال: السعودية)",
    fieldPhoneLabel: "رقم واتساب / الهاتف المباشر *",
    fieldEmailLabel: "البريد الإلكتروني",
    fieldEmailPlaceholder: "buyer@company.com",
    defaultCountry: "الإمارات العربية المتحدة",
    cancelBtn: "إلغاء",
    submitBtn: "نشر طلب الشراء",
    submittingBtn: "جاري النشر...",
    toastLoginRequired: "يرجى تسجيل الدخول لنشر طلب شراء بالجملة (RFQ).",
    toastRequiredFields:
      "يرجى إدخال عنوان الطلب والاسم الكامل ورقم الهاتف/واتساب.",
    toastPublished:
      "تم نشر طلب الشراء بنجاح! ستتواصل معك مصانع مارتر مباشرة لتقديم العروض.",
    toastSessionExpired: "انتهت صلاحية الجلسة. يرجى تسجيل الدخول مرة أخرى.",
    toastCreateError: "حدث خطأ أثناء إنشاء طلب الشراء.",
    toastNetworkError: "حدث خطأ في الاتصال بالخادم.",
  },
  de: {
    heroBadge: "B2B KAUFGESUCHE & AUSSCHREIBUNGEN (RFQ)",
    heroTitle: "Kaufgesuch veröffentlichen & Direktangebote aus Merter erhalten",
    heroDesc:
      "Erstellen Sie kostenlos B2B-Anfragen wie „500 Damenmäntel gesucht“ oder „Private-Label-T-Shirts ab Werk“ — geprüfte Textilhersteller aus Merter Istanbul kontaktieren Sie direkt.",
    heroCreateBtn: "Neues Kaufgesuch (RFQ) erstellen",
    searchPlaceholder: "Nach Titel, Kategorie oder Käuferland suchen...",
    prodAll: "Alle Gesuche",
    prodReadyWholesale: "Sofortware (Serienpakete)",
    prodPrivateLabel: "Private Label (Eigenmarke)",
    prodFason: "Lohnfertigung (CMT)",
    prodFabric: "Stoffe & Zutaten",
    cardTargetQty: "Zielmenge",
    cardCategory: "Kategorie",
    cardBuyerCountry: "Land",
    cardBuyer: "Einkäufer",
    cardVerifiedBuyer: "✓ Verifizierter Einkäufer",
    cardUnverifiedEmail: "E-Mail unbestätigt",
    cardOfferCountSuffix: "Hersteller-Angebote",
    cardSupplierQuoteBtn: "Als Hersteller anbieten",
    loadingText: "B2B-Kaufgesuche werden geladen...",
    emptyText:
      "Noch keine offenen Kaufgesuche für diesen Filter. Erstellen Sie jetzt die erste Ausschreibung!",
    emptyCreateBtn: "Kaufgesuch (RFQ) starten",
    gateBadge: "EXKLUSIVES B2B-EINKAUFSPORTAL",
    gateTitle: "Die B2B-Ausschreibungsbörse (RFQ) ist nur für Mitglieder",
    gateDesc:
      "Bitte melden Sie sich an, um aktuelle Großhandelsgesuche einzusehen, eigene Produktionsanfragen zu veröffentlichen oder als Hersteller direkt anzubieten.",
    gateLoginBtn: "Mitglieder-Login",
    gateRegisterBtn: "Kostenloses B2B-Konto",
    gateSupplierBtn: "Hersteller-Portal",
    modalTitle: "Neues Großhandels- & Produktionsgesuch (RFQ) erstellen",
    modalSubtitle:
      "Beschreiben Sie Ihren Bedarf — Merter Hersteller melden sich direkt per WhatsApp oder Telefon.",
    fieldTitleLabel: "Titel des Kaufgesuchs *",
    fieldTitlePlaceholder:
      "z. B. 500 Stück Damen-Wollmäntel für unsere Boutiquen in Deutschland gesucht",
    fieldTypeLabel: "Anfragetyp",
    fieldQtyLabel: "Zielmenge *",
    fieldCatLabel: "Kategorie / Warengruppe",
    fieldCatPlaceholder: "Damenmode / Kleider",
    fieldDescLabel: "Technische Details (Stoff, Größenschlüssel, Liefertermin)",
    fieldDescPlaceholder:
      "Materialzusammensetzung, Farb-/Größenverteilung, Eigenlabel-Wunsch und Zielpreis...",
    fieldBuyerNameLabel: "Vor- und Nachname *",
    fieldBuyerNamePlaceholder: "Vorname Nachname",
    fieldCompanyCountryLabel: "Firma & Land *",
    fieldCompanyPlaceholder: "Firmenname",
    fieldCountryPlaceholder: "Land (z. B. Deutschland)",
    fieldPhoneLabel: "Direktes WhatsApp / Telefon *",
    fieldEmailLabel: "Geschäftliche E-Mail",
    fieldEmailPlaceholder: "einkauf@firma.de",
    defaultCountry: "Deutschland",
    cancelBtn: "Abbrechen",
    submitBtn: "Kaufgesuch veröffentlichen",
    submittingBtn: "Wird veröffentlicht...",
    toastLoginRequired: "Bitte melden Sie sich an, um ein Kaufgesuch (RFQ) zu erstellen.",
    toastRequiredFields:
      "Bitte geben Sie Titel, Namen und Telefon-/WhatsApp-Nummer ein.",
    toastPublished:
      "Ihr RFQ wurde veröffentlicht! Merter Hersteller kontaktieren Sie direkt.",
    toastSessionExpired: "Sitzung abgelaufen. Bitte erneut anmelden.",
    toastCreateError: "Fehler beim Erstellen des Kaufgesuchs.",
    toastNetworkError: "Verbindungsfehler aufgetreten.",
  },
  fr: {
    heroBadge: "APPELS D'OFFRES & DEMANDES D'ACHAT B2B (RFQ)",
    heroTitle: "Publiez votre besoin en gros, les usines de Merter vous répondent",
    heroDesc:
      "Déposez gratuitement vos demandes B2B (« Recherche 500 manteaux femme », « Production marque blanche Private Label ») et recevez des offres directes des fabricants vérifiés de Merter Istanbul.",
    heroCreateBtn: "Créer un appel d'offres (RFQ)",
    searchPlaceholder: "Rechercher par titre, catégorie ou pays acheteur...",
    prodAll: "Toutes les demandes",
    prodReadyWholesale: "Stock prêt en série",
    prodPrivateLabel: "Private Label (Marque blanche)",
    prodFason: "Façonnage / Sous-traitance",
    prodFabric: "Tissus & Accessoires",
    cardTargetQty: "Quantité cible",
    cardCategory: "Catégorie",
    cardBuyerCountry: "Pays",
    cardBuyer: "Acheteur",
    cardVerifiedBuyer: "✓ Acheteur vérifié",
    cardUnverifiedEmail: "E-mail non vérifié",
    cardOfferCountSuffix: "offres fabricants",
    cardSupplierQuoteBtn: "Proposer un devis usine",
    loadingText: "Chargement des demandes d'achat B2B...",
    emptyText:
      "Aucune demande ouverte pour ce critère. Soyez le premier à publier un appel d'offres !",
    emptyCreateBtn: "Publier un RFQ",
    gateBadge: "ESPACE SOURCING B2B RÉSERVÉ AUX MEMBRES",
    gateTitle: "Le tableau d'appels d'offres (RFQ) est réservé aux membres",
    gateDesc:
      "Connectez-vous pour consulter les demandes d'achat en gros, déposer une demande de production ou envoyer une offre directe en tant que fabricant.",
    gateLoginBtn: "Connexion Membre",
    gateRegisterBtn: "Inscription B2B Gratuite",
    gateSupplierBtn: "Accès Fabricant / Fournisseur",
    modalTitle: "Nouvelle demande d'achat ou de production B2B (RFQ)",
    modalSubtitle:
      "Décrivez le produit recherché — les usines de Merter vous répondront sur WhatsApp et par téléphone.",
    fieldTitleLabel: "Titre de la demande *",
    fieldTitlePlaceholder:
      "Ex. : Recherche 500 manteaux femme en laine pour nos boutiques en France",
    fieldTypeLabel: "Type de demande",
    fieldQtyLabel: "Quantité cible *",
    fieldCatLabel: "Catégorie / Produit",
    fieldCatPlaceholder: "Prêt-à-porter Femme / Robes",
    fieldDescLabel: "Détails techniques (tissu, série de tailles, délai souhaité)",
    fieldDescPlaceholder:
      "Composition textile, répartition couleurs/tailles, griffes personnalisées et budget cible...",
    fieldBuyerNameLabel: "Nom complet *",
    fieldBuyerNamePlaceholder: "Prénom Nom",
    fieldCompanyCountryLabel: "Société & Pays *",
    fieldCompanyPlaceholder: "Nom de la société",
    fieldCountryPlaceholder: "Pays (ex. : France)",
    fieldPhoneLabel: "WhatsApp / Téléphone direct *",
    fieldEmailLabel: "E-mail professionnel",
    fieldEmailPlaceholder: "achats@societe.fr",
    defaultCountry: "France",
    cancelBtn: "Annuler",
    submitBtn: "Publier la demande",
    submittingBtn: "Publication...",
    toastLoginRequired: "Veuillez vous connecter pour publier un appel d'offres (RFQ).",
    toastRequiredFields:
      "Veuillez renseigner le titre, votre nom et votre numéro WhatsApp/téléphone.",
    toastPublished:
      "Votre demande RFQ est en ligne ! Les fabricants de Merter vous contacteront directement.",
    toastSessionExpired: "Votre session a expiré. Veuillez vous reconnecter.",
    toastCreateError: "Erreur lors de la création de la demande.",
    toastNetworkError: "Erreur de connexion réseau.",
  },
  pl: {
    heroBadge: "TABLICA ZAPYTAŃ OFERTOWYCH B2B (BUYING LEADS / RFQ)",
    heroTitle: "Ogłoś zapotrzebowanie hurtowe — fabryki z Merter złożą oferty",
    heroDesc:
      "Dodawaj bezpłatne ogłoszenia zakupowe B2B (np. „Szukamy 500 szt. płaszczy damskich”, „Produkcja T-shirtów Private Label”) i otrzymuj bezpośrednie oferty od zweryfikowanych producentów z Merter Stambuł.",
    heroCreateBtn: "Dodaj zapytanie ofertowe (RFQ)",
    searchPlaceholder: "Szukaj wg tytułu, kategorii lub kraju kupującego...",
    prodAll: "Wszystkie zapytania",
    prodReadyWholesale: "Gotowe kolekcje w paczkach",
    prodPrivateLabel: "Private Label (Własna marka)",
    prodFason: "Szycie kontraktowe (CMT)",
    prodFabric: "Tkaniny i dodatki",
    cardTargetQty: "Docelowa ilość",
    cardCategory: "Kategoria",
    cardBuyerCountry: "Kraj",
    cardBuyer: "Kupujący",
    cardVerifiedBuyer: "✓ Zweryfikowany kupiec",
    cardUnverifiedEmail: "E-mail niepotwierdzony",
    cardOfferCountSuffix: "ofert producentów",
    cardSupplierQuoteBtn: "Złóż ofertę jako producent",
    loadingText: "Ładowanie zapytań ofertowych B2B...",
    emptyText:
      "Brak otwartych zapytań dla wybranego filtra. Dodaj pierwsze ogłoszenie zakupowe!",
    emptyCreateBtn: "Utwórz nowe RFQ",
    gateBadge: "STREFA ZAKUPÓW B2B TYLKO DLA CZŁONKÓW",
    gateTitle: "Tablica zapytań hurtowych (RFQ) jest dostępna po zalogowaniu",
    gateDesc:
      "Zaloguj się, aby przeglądać zlecenia kupców, publikować własne zapytania produkcyjne lub składać bezpośrednie oferty fabryczne.",
    gateLoginBtn: "Zaloguj się",
    gateRegisterBtn: "Bezpłatna rejestracja B2B",
    gateSupplierBtn: "Panel Producenta / Dostawcy",
    modalTitle: "Utwórz nowe zapytanie hurtowe lub produkcyjne (RFQ)",
    modalSubtitle:
      "Opisz poszukiwany towar — producenci z Merter skontaktują się bezpośrednio przez WhatsApp lub telefon.",
    fieldTitleLabel: "Tytuł zapytania *",
    fieldTitlePlaceholder:
      "Np. Szukamy 500 szt. damskich płaszczy wełnianych do butików w Polsce",
    fieldTypeLabel: "Rodzaj zlecenia",
    fieldQtyLabel: "Docelowa ilość *",
    fieldCatLabel: "Kategoria / Asortyment",
    fieldCatPlaceholder: "Odzież damska / Sukienki",
    fieldDescLabel: "Szczegóły techniczne (skład tkaniny, rozmiarówka, termin)",
    fieldDescPlaceholder:
      "Podaj gramaturę tkaniny, kolory, rozmiary w paczce, wszywki własnej marki i budżet...",
    fieldBuyerNameLabel: "Imię i nazwisko *",
    fieldBuyerNamePlaceholder: "Imię i nazwisko",
    fieldCompanyCountryLabel: "Firma i kraj *",
    fieldCompanyPlaceholder: "Nazwa firmy",
    fieldCountryPlaceholder: "Kraj (np. Polska)",
    fieldPhoneLabel: "Bezpośredni WhatsApp / Telefon *",
    fieldEmailLabel: "Adres e-mail",
    fieldEmailPlaceholder: "zakupy@firma.pl",
    defaultCountry: "Polska",
    cancelBtn: "Anuluj",
    submitBtn: "Opublikuj zapytanie",
    submittingBtn: "Publikowanie...",
    toastLoginRequired: "Zaloguj się, aby dodać zapytanie ofertowe (RFQ).",
    toastRequiredFields:
      "Wprowadź tytuł zapytania, imię i nazwisko oraz numer telefonu / WhatsApp.",
    toastPublished:
      "Twoje zapytanie (RFQ) zostało opublikowane! Producenci z Merter skontaktują się z Tobą.",
    toastSessionExpired: "Sesja wygasła. Zaloguj się ponownie.",
    toastCreateError: "Wystąpił błąd podczas tworzenia zapytania.",
    toastNetworkError: "Błąd połączenia z serwerem.",
  },
  bg: {
    heroBadge: "B2B БОРСА ЗА ЗАПИТВАНИЯ НА ЕДРО (BUYING LEADS / RFQ)",
    heroTitle: "Публикувайте търсене на едро — фабриките в Мертер ще ви оферират",
    heroDesc:
      "Публикувайте безплатни B2B обяви като „Търсим 500 дамски палта“ или „Производство на тениски Private Label“ и получете директни оферти от проверени производители от Мертер Истанбул.",
    heroCreateBtn: "Нова обява за търсене (RFQ)",
    searchPlaceholder: "Търсене по заглавие, категория или държава на купувача...",
    prodAll: "Всички запитвания",
    prodReadyWholesale: "Готова стока на серии",
    prodPrivateLabel: "Private Label (Собствен етикет)",
    prodFason: "Производство на ишлеме",
    prodFabric: "Платове и аксесоари",
    cardTargetQty: "Количество",
    cardCategory: "Категория",
    cardBuyerCountry: "Държава",
    cardBuyer: "Купувач",
    cardVerifiedBuyer: "✓ Потвърден купувач",
    cardUnverifiedEmail: "Непотвърден имейл",
    cardOfferCountSuffix: "оферти от фабрики",
    cardSupplierQuoteBtn: "Дай оферта като производител",
    loadingText: "Зареждане на B2B запитванията...",
    emptyText:
      "Все още няма отворени обяви по този критерий. Създайте първото запитване за покупка!",
    emptyCreateBtn: "Отвори ново запитване (RFQ)",
    gateBadge: "B2B ЦЕНТЪР САМО ЗА ЧЛЕНОВЕ",
    gateTitle: "Борсата за B2B запитвания (RFQ) е достъпна за регистрирани членове",
    gateDesc:
      "Моля, влезте в профила си, за да преглеждате обявите за покупка на едро, да публикувате ново запитване или да изпращате директни оферти като производител.",
    gateLoginBtn: "Вход за клиенти",
    gateRegisterBtn: "Безплатна B2B регистрация",
    gateSupplierBtn: "Вход за производители",
    modalTitle: "Ново запитване за покупка на едро или производство (RFQ)",
    modalSubtitle:
      "Опишете търсения модел и фабриките от Мертер ще се свържат директно с вас по WhatsApp и телефон.",
    fieldTitleLabel: "Заглавие на запитването *",
    fieldTitlePlaceholder:
      "Напр.: Търсим 500 бр. дамски вълнени палта за магазините ни в България",
    fieldTypeLabel: "Тип поръчка",
    fieldQtyLabel: "Целево количество *",
    fieldCatLabel: "Категория / Продукт",
    fieldCatPlaceholder: "Дамско облекло / Рокли",
    fieldDescLabel: "Технически детайли (плат, номерация в серия, срок на доставка)",
    fieldDescPlaceholder:
      "Посочете състав на плата, разпределение на цветове/размери, брандиране и целева цена...",
    fieldBuyerNameLabel: "Име и фамилия *",
    fieldBuyerNamePlaceholder: "Име Фамилия",
    fieldCompanyCountryLabel: "Фирма и държава *",
    fieldCompanyPlaceholder: "Име на фирмата",
    fieldCountryPlaceholder: "Държава (напр. България)",
    fieldPhoneLabel: "Директен WhatsApp / Телефон *",
    fieldEmailLabel: "Имейл адрес",
    fieldEmailPlaceholder: "office@company.bg",
    defaultCountry: "България",
    cancelBtn: "Отказ",
    submitBtn: "Публикувай запитването",
    submittingBtn: "Публикуване...",
    toastLoginRequired: "Моля, влезте в профила си, за да публикувате RFQ.",
    toastRequiredFields:
      "Моля, въведете заглавие, име и телефон / WhatsApp номер.",
    toastPublished:
      "Вашето запитване (RFQ) е публикувано! Производителите от Мертер ще се свържат директно с вас.",
    toastSessionExpired: "Сесията ви е изтекла. Моля, влезте отново.",
    toastCreateError: "Възникна грешка при публикуване на запитването.",
    toastNetworkError: "Грешка при връзка със сървъра.",
  },
};

function subscribeClientStore(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("auth-change", onStoreChange);
  window.addEventListener("cart-updated", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("auth-change", onStoreChange);
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

function getSupplierTokenSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(localStorage.getItem("supplier_token"));
}

function getActiveMemberOrSupplierToken(): string {
  if (typeof window === "undefined") return "";
  return (
    localStorage.getItem("store_user_token") ||
    localStorage.getItem("supplier_token") ||
    ""
  );
}

interface BuyerRfqItem {
  id: string;
  rfq_number: string;
  title: string;
  category_name: string;
  target_quantity: number;
  unit_type: string;
  target_price?: number;
  currency: string;
  production_type: string;
  description: string;
  buyer_name: string;
  buyer_company: string;
  buyer_country: string;
  buyer_email_verified?: boolean;
  status: string;
  offer_count: number;
  created_at: string;
}

function resolveProductionLabel(
  prodType: string,
  copy: RfqBoardLocaleCopy
): string {
  switch (prodType) {
    case "private_label":
      return copy.prodPrivateLabel;
    case "fason_uretim":
      return copy.prodFason;
    case "kumas_tedarik":
      return copy.prodFabric;
    default:
      return copy.prodReadyWholesale;
  }
}

function BuyerRfqCard({
  item,
  copy,
  safeLang,
}: {
  readonly item: BuyerRfqItem;
  readonly copy: RfqBoardLocaleCopy;
  readonly safeLang: SupportedSeoLang;
}) {
  const prodLabel = resolveProductionLabel(item.production_type, copy);
  const dateStr = new Date(item.created_at).toLocaleDateString(
    INTL_LOCALE_BY_LANG[safeLang]
  );

  return (
    <div className="bg-white rounded-lg border border-[#E5E0D8] hover:border-[#1C1C1C]/40 p-5 shadow-xs flex flex-col justify-between gap-4 transition-colors">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="px-2.5 py-0.5 rounded-md bg-[#F8F6F2] text-[#1C1C1C] border border-[#E5E0D8] text-[11px] font-mono font-bold">
            {item.rfq_number}
          </span>
          <span className="px-2.5 py-0.5 rounded-full bg-[#FAF7F2] text-[#6E542E] border border-[#D8C7A6] text-[11px] font-bold">
            {prodLabel}
          </span>
        </div>

        <h3 className="text-base font-extrabold text-[#1C1C1C] leading-snug">
          {item.title}
        </h3>

        {item.description && (
          <p className="text-xs text-[#525252] leading-relaxed line-clamp-3">
            {item.description}
          </p>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#F8F6F2] text-[#1C1C1C] border border-[#E5E0D8] text-xs font-extrabold">
            <Package size={13} className="text-[#8C6D3F]" />
            <span>
              {copy.cardTargetQty}: {item.target_quantity} {item.unit_type}
            </span>
          </span>
          {item.category_name && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#F8F6F2] text-[#525252] border border-[#E5E0D8] text-xs font-bold">
              <span>
                {copy.cardCategory}: {item.category_name}
              </span>
            </span>
          )}
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#F8F6F2] text-[#525252] border border-[#E5E0D8] text-xs font-bold">
            <Globe size={13} className="text-[#8C6D3F]" />
            <span>
              {copy.cardBuyerCountry}: {item.buyer_country}
            </span>
          </span>
        </div>
      </div>

      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
        <div className="text-[11px] text-slate-500 space-y-0.5">
          <div className="font-bold text-[#1C1C1C] flex items-center gap-1.5 flex-wrap">
            <span>
              {copy.cardBuyer}: {item.buyer_name}
              {item.buyer_company ? ` (${item.buyer_company})` : ""}
            </span>
            {item.buyer_email_verified ? (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-emerald-50 text-[#15803D] border border-emerald-200">
                {copy.cardVerifiedBuyer}
              </span>
            ) : (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                {copy.cardUnverifiedEmail}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1">
              <Calendar size={11} />
              {dateStr}
            </span>
            <span>•</span>
            <strong className="text-[#15803D]">
              {item.offer_count} {copy.cardOfferCountSuffix}
            </strong>
          </div>
        </div>

        <Link
          href="/supplier"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#1C1C1C] hover:bg-[#333333] text-white text-xs font-extrabold no-underline transition-colors shadow-xs"
        >
          <Building2 size={13} />
          <span>{copy.cardSupplierQuoteBtn}</span>
        </Link>
      </div>
    </div>
  );
}

interface RfqCreateModalProps {
  readonly isOpen: boolean;
  readonly copy: RfqBoardLocaleCopy;
  readonly onClose: () => void;
  readonly onCreated: () => void;
}

function RfqCreateModal({
  isOpen,
  copy,
  onClose,
  onCreated,
}: RfqCreateModalProps) {
  const [title, setTitle] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [targetQuantity, setTargetQuantity] = useState("500");
  const [unitType, setUnitType] = useState("ADET");
  const [productionType, setProductionType] = useState("hazir_toptan");
  const [currency, setCurrency] = useState("USD");
  const [description, setDescription] = useState("");
  const [buyerName, setBuyerName] = useState(() => {
    const u = getValidStoreUser<{ first_name?: string; last_name?: string }>();
    return [u?.first_name, u?.last_name].filter(Boolean).join(" ");
  });
  const [buyerCompany, setBuyerCompany] = useState("");
  const [buyerCountry, setBuyerCountry] = useState(copy.defaultCountry);
  const [buyerPhone, setBuyerPhone] = useState(() => {
    const u = getValidStoreUser<{ phone?: string }>();
    return u?.phone || "";
  });
  const [buyerEmail, setBuyerEmail] = useState(() => {
    const u = getValidStoreUser<{ email?: string }>();
    return u?.email || "";
  });
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getActiveMemberOrSupplierToken();
    if (!token) {
      showToast(copy.toastLoginRequired);
      onClose();
      openStoreAuthModal("login");
      return;
    }
    if (!title.trim() || !buyerName.trim() || !buyerPhone.trim()) {
      showToast(copy.toastRequiredFields);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/store/rfqs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          category_name: categoryName.trim(),
          target_quantity: Number(targetQuantity) || 100,
          unit_type: unitType,
          production_type: productionType,
          currency,
          description: description.trim(),
          buyer_name: buyerName.trim(),
          buyer_company: buyerCompany.trim(),
          buyer_country: buyerCountry.trim() || copy.defaultCountry,
          buyer_phone: buyerPhone.trim(),
          buyer_whatsapp: buyerPhone.trim(),
          buyer_email: buyerEmail.trim(),
        }),
      });
      if (res.ok) {
        showToast(copy.toastPublished);
        onCreated();
        onClose();
      } else if (res.status === 401) {
        showToast(copy.toastSessionExpired);
        onClose();
        openStoreAuthModal("login");
      } else {
        showToast(copy.toastCreateError);
      }
    } catch {
      showToast(copy.toastNetworkError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">
              {copy.modalTitle}
            </h2>
            <p className="text-xs text-slate-500">{copy.modalSubtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label
              htmlFor="rfq-title"
              className="font-bold text-slate-700 block mb-1"
            >
              {copy.fieldTitleLabel}
            </label>
            <input
              id="rfq-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={copy.fieldTitlePlaceholder}
              className="w-full px-3 py-2 rounded-lg border border-slate-300"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label
                htmlFor="rfq-production-type"
                className="font-bold text-slate-700 block mb-1"
              >
                {copy.fieldTypeLabel}
              </label>
              <select
                id="rfq-production-type"
                value={productionType}
                onChange={(e) => setProductionType(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
              >
                <option value="hazir_toptan">{copy.prodReadyWholesale}</option>
                <option value="private_label">{copy.prodPrivateLabel}</option>
                <option value="fason_uretim">{copy.prodFason}</option>
                <option value="kumas_tedarik">{copy.prodFabric}</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="rfq-target-quantity"
                className="font-bold text-slate-700 block mb-1"
              >
                {copy.fieldQtyLabel}
              </label>
              <input
                id="rfq-target-quantity"
                type="number"
                min={1}
                value={targetQuantity}
                onChange={(e) => setTargetQuantity(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
                required
              />
            </div>

            <div>
              <label
                htmlFor="rfq-category-name"
                className="font-bold text-slate-700 block mb-1"
              >
                {copy.fieldCatLabel}
              </label>
              <input
                id="rfq-category-name"
                type="text"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder={copy.fieldCatPlaceholder}
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="rfq-description"
              className="font-bold text-slate-700 block mb-1"
            >
              {copy.fieldDescLabel}
            </label>
            <textarea
              id="rfq-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={copy.fieldDescPlaceholder}
              className="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <div>
              <label
                htmlFor="rfq-buyer-name"
                className="font-bold text-slate-700 block mb-1"
              >
                {copy.fieldBuyerNameLabel}
              </label>
              <input
                id="rfq-buyer-name"
                type="text"
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                placeholder={copy.fieldBuyerNamePlaceholder}
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
                required
              />
            </div>

            <div>
              <label
                htmlFor="rfq-buyer-company"
                className="font-bold text-slate-700 block mb-1"
              >
                {copy.fieldCompanyCountryLabel}
              </label>
              <div className="flex gap-1.5">
                <input
                  id="rfq-buyer-company"
                  type="text"
                  value={buyerCompany}
                  onChange={(e) => setBuyerCompany(e.target.value)}
                  placeholder={copy.fieldCompanyPlaceholder}
                  className="w-1/2 px-3 py-2 rounded-lg border border-slate-300"
                />
                <input
                  id="rfq-buyer-country"
                  type="text"
                  value={buyerCountry}
                  onChange={(e) => setBuyerCountry(e.target.value)}
                  placeholder={copy.fieldCountryPlaceholder}
                  aria-label={copy.cardBuyerCountry}
                  className="w-1/2 px-3 py-2 rounded-lg border border-slate-300"
                  required
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="rfq-buyer-phone"
                className="font-bold text-slate-700 block mb-1"
              >
                {copy.fieldPhoneLabel}
              </label>
              <input
                id="rfq-buyer-phone"
                type="text"
                value={buyerPhone}
                onChange={(e) => setBuyerPhone(e.target.value)}
                placeholder="+90 532 000 00 00"
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
                required
              />
            </div>

            <div>
              <label
                htmlFor="rfq-buyer-email"
                className="font-bold text-slate-700 block mb-1"
              >
                {copy.fieldEmailLabel}
              </label>
              <input
                id="rfq-buyer-email"
                type="email"
                value={buyerEmail}
                onChange={(e) => setBuyerEmail(e.target.value)}
                placeholder={copy.fieldEmailPlaceholder}
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
              />
            </div>
          </div>

          <input
            type="hidden"
            value={unitType}
            onChange={(e) => setUnitType(e.target.value)}
          />
          <input
            type="hidden"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md border border-[#D6D1C7] text-[#525252] hover:border-[#1C1C1C] hover:text-[#1C1C1C] font-bold cursor-pointer bg-white"
            >
              {copy.cancelBtn}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-md bg-[#1C1C1C] hover:bg-[#333333] text-white font-extrabold cursor-pointer disabled:opacity-50"
            >
              {submitting ? copy.submittingBtn : copy.submitBtn}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface RfqBoardListContentProps {
  readonly loading: boolean;
  readonly items: readonly BuyerRfqItem[];
  readonly copy: RfqBoardLocaleCopy;
  readonly safeLang: SupportedSeoLang;
  readonly onOpenCreate: () => void;
}

function RfqBoardListContent({
  loading,
  items,
  copy,
  safeLang,
  onOpenCreate,
}: RfqBoardListContentProps) {
  if (loading) {
    return (
      <div className="py-16 text-center text-sm font-bold text-slate-500">
        {copy.loadingText}
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-[#E5E0D8] p-12 text-center space-y-3">
        <p className="text-sm font-extrabold text-[#1C1C1C]">{copy.emptyText}</p>
        <button
          type="button"
          onClick={onOpenCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-md bg-[#1C1C1C] hover:bg-[#333333] text-white text-xs font-extrabold cursor-pointer"
        >
          <Plus size={15} />
          <span>{copy.emptyCreateBtn}</span>
        </button>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {items.map((item) => (
        <BuyerRfqCard
          key={item.id}
          item={item}
          copy={copy}
          safeLang={safeLang}
        />
      ))}
    </div>
  );
}

function MemberOnlyRfqGate({ copy }: { readonly copy: RfqBoardLocaleCopy }) {
  return (
    <div className="bg-white rounded-lg border border-[#E5E0D8] shadow-xs p-8 sm:p-12 text-center max-w-2xl mx-auto my-6 space-y-5">
      <div className="w-16 h-16 rounded-lg bg-[#F8F6F2] border border-[#E5E0D8] text-[#8C6D3F] flex items-center justify-center mx-auto">
        <Lock size={30} />
      </div>
      <div className="space-y-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-[#15803D] border border-emerald-200 text-[11px] font-extrabold uppercase tracking-wider">
          {copy.gateBadge}
        </span>
        <h2 className="text-xl sm:text-2xl font-black text-[#1C1C1C]">
          {copy.gateTitle}
        </h2>
        <p className="text-xs sm:text-sm text-[#525252] leading-relaxed max-w-xl mx-auto">
          {copy.gateDesc}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
        <button
          type="button"
          onClick={() => openStoreAuthModal("register")}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-md bg-[#1C1C1C] hover:bg-[#333333] text-white text-xs sm:text-sm font-extrabold cursor-pointer border-none shadow-xs transition-colors"
        >
          <UserPlus size={16} />
          <span>{copy.gateRegisterBtn}</span>
        </button>

        <button
          type="button"
          onClick={() => openStoreAuthModal("login")}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-md bg-white hover:bg-[#F8F6F2] text-[#1C1C1C] border border-[#D6D1C7] hover:border-[#1C1C1C] text-xs sm:text-sm font-extrabold cursor-pointer shadow-xs transition-colors"
        >
          <LogIn size={16} />
          <span>{copy.gateLoginBtn}</span>
        </button>

        <Link
          href="/supplier"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-md bg-[#F8F6F2] hover:bg-[#EFECE6] text-[#1C1C1C] border border-[#E5E0D8] hover:border-[#1C1C1C] text-xs sm:text-sm font-bold no-underline transition-colors"
        >
          <Building2 size={16} />
          <span>{copy.gateSupplierBtn}</span>
        </Link>
      </div>
    </div>
  );
}

interface BuyerRfqBoardClientProps {
  readonly initialLang?: SupportedSeoLang;
  readonly initialCategories?: readonly Category[];
}

export default function BuyerRfqBoardClient({
  initialLang = "tr",
  initialCategories = [],
}: BuyerRfqBoardClientProps) {
  const router = useRouter();
  const isMemberLoggedIn = useIsStoreMemberLoggedIn();
  const hasSupplierToken = useSyncExternalStore(
    subscribeClientStore,
    getSupplierTokenSnapshot,
    () => false
  );
  const totalPkgs = useSyncExternalStore(
    subscribeClientStore,
    getCartPkgsSnapshot,
    () => 0
  );

  const [lang, setLang] = useState<string>(initialLang);
  const [isLangOpen, setIsLangOpen] = useState<boolean>(false);
  const [displayCurrency, setDisplayCurrency] = useState<string>("TRY");
  const [categories, setCategories] = useState<Category[]>([
    ...initialCategories,
  ]);
  const [items, setItems] = useState<BuyerRfqItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedProdType, setSelectedProdType] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState<boolean>(false);
  const [policyModalType, setPolicyModalType] = useState<
    "cancellation_and_return" | "terms_of_service" | "privacy_policy" | ""
  >("");

  const safeLang = normalizeSeoLang(lang, "tr");
  const copy = RFQ_BOARD_COPY[safeLang];
  const isAuthenticated = isMemberLoggedIn || hasSupplierToken;

  const productionTypes = useMemo(
    () => [
      { value: "", label: copy.prodAll },
      { value: "hazir_toptan", label: copy.prodReadyWholesale },
      { value: "private_label", label: copy.prodPrivateLabel },
      { value: "fason_uretim", label: copy.prodFason },
      { value: "kumas_tedarik", label: copy.prodFabric },
    ],
    [copy]
  );

  const loadRfqs = useCallback(async () => {
    const token = getActiveMemberOrSupplierToken();
    if (!token) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let path = `/api/v1/store/rfqs?production_type=${encodeURIComponent(selectedProdType)}`;
    if (searchQuery.trim()) {
      path += `&search=${encodeURIComponent(searchQuery.trim())}`;
    }
    try {
      const res = await fetch(path, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = (await res.json()) as BuyerRfqItem[];
        setItems(data || []);
      } else {
        setItems([]);
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [selectedProdType, searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isAuthenticated) {
        void loadRfqs();
      } else {
        setItems([]);
        setLoading(false);
      }
      if (initialCategories.length === 0) {
        void apiFetch<Category[]>("/categories").then((c) => {
          if (c) setCategories(c);
        });
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [isAuthenticated, loadRfqs, initialCategories.length]);

  const handleLangChange = (nextLang: string) => {
    const normalized = normalizeSeoLang(nextLang, "tr");
    setLang(normalized);
    router.push(
      normalized === "tr"
        ? "/alim-talepleri"
        : `/alim-talepleri?lang=${normalized}`
    );
  };

  const handleOpenCreateClick = () => {
    if (!isAuthenticated) {
      showToast(copy.toastLoginRequired);
      openStoreAuthModal("login");
      return;
    }
    setIsCreateOpen(true);
  };

  return (
    <div
      dir={safeLang === "ar" ? "rtl" : "ltr"}
      className="min-h-screen flex flex-col bg-slate-50/60"
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
        setCurrentPage={() => {}}
        categories={categories}
        activeCategoryId=""
        displayCurrency={displayCurrency}
        onCurrencyChange={setDisplayCurrency}
      />

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 py-8 space-y-6">
        {/* Hero */}
        <div className="rounded-lg bg-[#F8F6F2] border border-[#E5E0D8] text-[#1C1C1C] p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xs">
          <div className="space-y-2.5 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[#15803D] text-xs font-extrabold">
              <CheckCircle2 size={14} className="text-[#15803D]" />
              <span>{copy.heroBadge}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#1C1C1C]">
              {copy.heroTitle}
            </h1>
            <p className="text-xs sm:text-sm text-[#525252] leading-relaxed">
              {copy.heroDesc}
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenCreateClick}
            className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-md bg-[#1C1C1C] hover:bg-[#333333] text-white text-xs sm:text-sm font-extrabold cursor-pointer shrink-0 shadow-xs border-none transition-colors"
          >
            <Plus size={18} />
            <span>{copy.heroCreateBtn}</span>
          </button>
        </div>

        {!isAuthenticated ? (
          <MemberOnlyRfqGate copy={copy} />
        ) : (
          <>
            {/* Filters */}
            <div className="bg-white rounded-lg border border-[#E5E0D8] p-4 space-y-3 shadow-xs">
              <div className="relative">
                <Search
                  size={16}
                  className="absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={copy.searchPlaceholder}
                  className="w-full ps-10 pe-4 py-2.5 rounded-md border border-[#D6D1C7] text-xs sm:text-sm focus:outline-none focus:border-[#1C1C1C]"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {productionTypes.map((pt) => (
                  <button
                    key={pt.value}
                    type="button"
                    onClick={() => setSelectedProdType(pt.value)}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap cursor-pointer border transition-colors ${
                      selectedProdType === pt.value
                        ? "bg-[#1C1C1C] text-white border-[#1C1C1C] shadow-xs"
                        : "bg-white text-[#525252] border-[#D6D1C7] hover:bg-[#F8F6F2] hover:text-[#1C1C1C] hover:border-[#1C1C1C]"
                    }`}
                  >
                    <FileText size={12} className="inline me-1" />
                    {pt.label}
                  </button>
                ))}
              </div>
            </div>

            <RfqBoardListContent
              loading={loading}
              items={items}
              copy={copy}
              safeLang={safeLang}
              onOpenCreate={handleOpenCreateClick}
            />
          </>
        )}
      </main>

      <RfqCreateModal
        key={safeLang}
        isOpen={isCreateOpen && isAuthenticated}
        copy={copy}
        onClose={() => setIsCreateOpen(false)}
        onCreated={() => void loadRfqs()}
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
