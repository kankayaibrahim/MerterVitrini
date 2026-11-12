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
import {
  SUPPORTED_SEO_LANGS,
  SupportedSeoLang,
  normalizeSeoLang,
} from "@/utils/seoHelpers";

interface AccountDeletionLocaleCopy {
  readonly backToStore: string;
  readonly playBadge: string;
  readonly pageTitle: string;
  readonly introAppLabel: string;
  readonly introMid: string;
  readonly introCustomerLabel: string;
  readonly introOr: string;
  readonly introSupplierLabel: string;
  readonly introEnd: string;
  readonly inAppTitle: string;
  readonly inAppStep1: string;
  readonly inAppStep2: string;
  readonly inAppStep3: string;
  readonly dataRetentionTitle: string;
  readonly deletedImmediateLabel: string;
  readonly deletedImmediateBody: string;
  readonly legalRetentionLabel: string;
  readonly legalRetentionBody: string;
  readonly formTitle: string;
  readonly formDesc: string;
  readonly roleLabel: string;
  readonly roleCustomer: string;
  readonly roleSupplier: string;
  readonly emailLabel: string;
  readonly emailPlaceholder: string;
  readonly passwordLabel: string;
  readonly reasonLabel: string;
  readonly reasonPlaceholder: string;
  readonly confirmLabel: string;
  readonly confirmError: string;
  readonly networkError: string;
  readonly submitBtn: string;
  readonly submittingBtn: string;
}

const ACCOUNT_DELETION_COPY: Record<
  SupportedSeoLang,
  AccountDeletionLocaleCopy
> = {
  tr: {
    backToStore: "Merter Vitrini Mağazasına Dön",
    playBadge: "Google Play Veri Güvenliği",
    pageTitle: "Merter Vitrini — Hesap ve Veri Silme Merkezi",
    introAppLabel: "Merter Vitrini Mobil Uygulaması",
    introMid: "ve web platformu üzerindeki ",
    introCustomerLabel: "Müşteri (Toptan Alıcı)",
    introOr: " veya ",
    introSupplierLabel: "Tedarikçi",
    introEnd:
      " hesabınızı uygulama içinden ya da doğrudan bu sayfa üzerinden kalıcı olarak silebilirsiniz.",
    inAppTitle: "Mobil Uygulama İçinden Silme",
    inAppStep1: "Merter Vitrini mobil uygulamasını açın.",
    inAppStep2: "Alt menüden Profil / Hesabım sekmesine gidin.",
    inAppStep3: "Hesabımı Kalıcı Olarak Sil butonuna dokunun ve onaylayın.",
    dataRetentionTitle: "Silinen ve Saklanan Veriler",
    deletedImmediateLabel: "Anında Silinir:",
    deletedImmediateBody:
      "Ad-soyad, e-posta, telefon, adres defteri, sepet, favoriler ve bildirim anahtarları.",
    legalRetentionLabel: "Yasal Saklama:",
    legalRetentionBody:
      "Tamamlanmış B2B sipariş ve muhasebe kayıtları anonimleştirilerek 6102 sayılı TTK ve VUK uyarınca yasal süre boyunca saklanır.",
    formTitle: "Web Üzerinden Anında Hesap Silme Formu",
    formDesc:
      "Mobil uygulamayı cihazınızdan kaldırdıysanız aşağıdan hesap türünüzü seçip giriş bilgilerinizle hesabınızı anında silebilirsiniz.",
    roleLabel: "Hesap Türü",
    roleCustomer: "Müşteri (Toptan Alıcı)",
    roleSupplier: "Tedarikçi / Üretici",
    emailLabel: "Kayıtlı E-Posta Adresi",
    emailPlaceholder: "ornek@firma.com",
    passwordLabel: "Hesap Şifreniz",
    reasonLabel: "Silme Nedeni (İsteğe Bağlı)",
    reasonPlaceholder:
      "Hizmetimizi geliştirmemiz için görüşünüzü paylaşabilirsiniz...",
    confirmLabel:
      "Hesabımın ve kişisel profil verilerimin kalıcı olarak silineceğini ve bu işlemin geri alınamayacağını onaylıyorum.",
    confirmError:
      "Lütfen hesap silme işleminin geri alınamaz olduğunu onaylayın.",
    networkError:
      "Sunucu bağlantısı sırasında bir hata oluştu. Lütfen tekrar deneyin.",
    submitBtn: "Hesabımı ve Kişisel Verilerimi Kalıcı Olarak Sil",
    submittingBtn: "Hesabınız Siliniyor...",
  },
  en: {
    backToStore: "Back to Merter Vitrini Store",
    playBadge: "Google Play Data Safety",
    pageTitle: "Merter Vitrini — Account & Personal Data Deletion Center",
    introAppLabel: "Merter Vitrini Mobile App",
    introMid: "and web platform allow you to permanently delete your ",
    introCustomerLabel: "Customer (Wholesale Buyer)",
    introOr: " or ",
    introSupplierLabel: "Supplier",
    introEnd: " account either inside the mobile app or directly on this page.",
    inAppTitle: "Delete Inside the Mobile App",
    inAppStep1: "Open the Merter Vitrini mobile app.",
    inAppStep2: "Navigate to Profile / My Account in the bottom tab bar.",
    inAppStep3: "Tap Permanently Delete My Account and confirm.",
    dataRetentionTitle: "Deleted & Legally Retained Data",
    deletedImmediateLabel: "Deleted Immediately:",
    deletedImmediateBody:
      "Full name, email, phone number, address book, cart, wishlist, and push notification tokens.",
    legalRetentionLabel: "Statutory Retention:",
    legalRetentionBody:
      "Completed B2B commercial invoices and accounting records are anonymized and retained for the mandatory period under Turkish Commercial & Tax Law.",
    formTitle: "Instant Web Account Deletion Form",
    formDesc:
      "If you have already uninstalled the mobile app, select your account type below and authenticate to erase your account immediately.",
    roleLabel: "Account Type",
    roleCustomer: "Customer (Wholesale Buyer)",
    roleSupplier: "Supplier / Manufacturer",
    emailLabel: "Registered Email Address",
    emailPlaceholder: "buyer@company.com",
    passwordLabel: "Account Password",
    reasonLabel: "Reason for Deletion (Optional)",
    reasonPlaceholder: "Optional feedback to help us improve...",
    confirmLabel:
      "I confirm that my account and personal profile data will be permanently deleted and that this action cannot be undone.",
    confirmError: "Please confirm that account deletion is irreversible.",
    networkError:
      "A server connection error occurred. Please try again.",
    submitBtn: "Permanently Delete My Account & Personal Data",
    submittingBtn: "Deleting Your Account...",
  },
  ru: {
    backToStore: "Вернуться в магазин Merter Vitrini",
    playBadge: "Безопасность данных Google Play",
    pageTitle: "Merter Vitrini — Центр удаления аккаунта и данных",
    introAppLabel: "Мобильное приложение Merter Vitrini",
    introMid: "и веб-платформа позволяют безвозвратно удалить аккаунт ",
    introCustomerLabel: "Покупателя (Опт)",
    introOr: " или ",
    introSupplierLabel: "Поставщика",
    introEnd: " прямо в приложении либо через форму на этой странице.",
    inAppTitle: "Удаление через мобильное приложение",
    inAppStep1: "Откройте мобильное приложение Merter Vitrini.",
    inAppStep2: "Перейдите на вкладку «Профиль / Мой аккаунт».",
    inAppStep3: "Нажмите «Удалить аккаунт навсегда» и подтвердите действие.",
    dataRetentionTitle: "Удаляемые и хранимые данные",
    deletedImmediateLabel: "Удаляется мгновенно:",
    deletedImmediateBody:
      "ФИО, e-mail, телефон, адресная книга, корзина, избранное и push-токены устройств.",
    legalRetentionLabel: "Законное хранение:",
    legalRetentionBody:
      "Завершенные оптовые заказы и бухгалтерские записи обезличиваются и хранятся в течение установленного законом срока.",
    formTitle: "Веб-форма мгновенного удаления аккаунта",
    formDesc:
      "Если приложение уже удалено с устройства, выберите тип аккаунта и введите учетные данные для немедленного удаления.",
    roleLabel: "Тип аккаунта",
    roleCustomer: "Покупатель (Оптовик)",
    roleSupplier: "Поставщик / Фабрика",
    emailLabel: "Зарегистрированный E-mail",
    emailPlaceholder: "buyer@company.ru",
    passwordLabel: "Пароль аккаунта",
    reasonLabel: "Причина удаления (необязательно)",
    reasonPlaceholder: "Поделитесь комментарием для улучшения сервиса...",
    confirmLabel:
      "Я подтверждаю, что мой аккаунт и личные данные профиля будут удалены безвозвратно.",
    confirmError:
      "Пожалуйста, подтвердите, что удаление аккаунта необратимо.",
    networkError: "Ошибка соединения с сервером. Попробуйте еще раз.",
    submitBtn: "Удалить мой аккаунт и персональные данные навсегда",
    submittingBtn: "Удаление аккаунта...",
  },
  ar: {
    backToStore: "العودة إلى متجر Merter Vitrini",
    playBadge: "أمان بيانات Google Play",
    pageTitle: "Merter Vitrini — مركز حذف الحساب والبيانات الشخصية",
    introAppLabel: "تطبيق Merter Vitrini للجوال",
    introMid: "والمنصة الإلكترونية يتيحان لك حذف حساب ",
    introCustomerLabel: "العميل (مشتري الجملة)",
    introOr: " أو ",
    introSupplierLabel: "المورد / المصنع",
    introEnd: " نهائياً من داخل التطبيق أو مباشرة عبر هذه الصفحة.",
    inAppTitle: "الحذف من داخل تطبيق الجوال",
    inAppStep1: "افتح تطبيق Merter Vitrini على هاتفك.",
    inAppStep2: "انتقل إلى تبويب الملف الشخصي / حسابي.",
    inAppStep3: "اضغط على حذف حسابي نهائياً وقم بالتأكيد.",
    dataRetentionTitle: "البيانات المحذوفة والمحتفظ بها قانونياً",
    deletedImmediateLabel: "تُحذف فوراً:",
    deletedImmediateBody:
      "الاسم الكامل، البريد الإلكتروني، رقم الهاتف، دفتر العناوين، السلة، المفضلة ورموز الإشعارات.",
    legalRetentionLabel: "الاحتفاظ القانوني:",
    legalRetentionBody:
      "يتم إخفاء هوية سجلات الفواتير والطلبات التجارية المكتملة والاحتفاظ بها للمدة القانونية وفق قانون التجارة والضرائب.",
    formTitle: "نموذج الحذف الفوري للحساب عبر الويب",
    formDesc:
      "إذا قمت بإزالة التطبيق من جهازك، اختر نوع حسابك أدناه وأدخل بيانات الدخول لحذف حسابك فوراً.",
    roleLabel: "نوع الحساب",
    roleCustomer: "عميل (مشتري جملة)",
    roleSupplier: "مورد / مصنع",
    emailLabel: "البريد الإلكتروني المسجل",
    emailPlaceholder: "buyer@company.com",
    passwordLabel: "كلمة مرور الحساب",
    reasonLabel: "سبب الحذف (اختياري)",
    reasonPlaceholder: "يمكنك مشاركة ملاحظاتك لتحسين خدماتنا...",
    confirmLabel:
      "أؤكد أن حسابي وبيانات ملفي الشخصي سيتم حذفها نهائياً ولا يمكن التراجع عن هذا الإجراء.",
    confirmError: "يرجى تأكيد أن عملية حذف الحساب لا يمكن التراجع عنها.",
    networkError: "حدث خطأ في الاتصال بالخادم. يرجى المحاولة مرة أخرى.",
    submitBtn: "حذف حسابي وبياناتي الشخصية نهائياً",
    submittingBtn: "جاري حذف الحساب...",
  },
  de: {
    backToStore: "Zurück zum Merter Vitrini Shop",
    playBadge: "Google Play Datensicherheit",
    pageTitle: "Merter Vitrini — Konto- und Datenlöschungszentrum",
    introAppLabel: "Merter Vitrini Mobile-App",
    introMid: "und Webplattform ermöglichen die dauerhafte Löschung Ihres ",
    introCustomerLabel: "Kundenkontos (B2B-Einkäufer)",
    introOr: " oder ",
    introSupplierLabel: "Lieferantenkontos",
    introEnd: " direkt in der App oder über dieses Formular.",
    inAppTitle: "Löschung in der Mobile-App",
    inAppStep1: "Öffnen Sie die Merter Vitrini App.",
    inAppStep2: "Wechseln Sie unten zu Profil / Mein Konto.",
    inAppStep3: "Tippen Sie auf Mein Konto dauerhaft löschen und bestätigen Sie.",
    dataRetentionTitle: "Gelöschte & gesetzlich aufbewahrte Daten",
    deletedImmediateLabel: "Sofort gelöscht:",
    deletedImmediateBody:
      "Name, E-Mail, Telefon, Adressbuch, Warenkorb, Merkliste und Push-Token.",
    legalRetentionLabel: "Gesetzliche Aufbewahrung:",
    legalRetentionBody:
      "Abgeschlossene B2B-Bestellungen und Buchhaltungsbelege werden anonymisiert gemäß Handels- und Steuerrecht aufbewahrt.",
    formTitle: "Sofortiges Web-Kontolöschungsformular",
    formDesc:
      "Falls Sie die App bereits deinstalliert haben, wählen Sie unten Ihren Kontotyp und authentifizieren Sie die Löschung.",
    roleLabel: "Kontotyp",
    roleCustomer: "Kunde (Großhandelskäufer)",
    roleSupplier: "Lieferant / Hersteller",
    emailLabel: "Registrierte E-Mail-Adresse",
    emailPlaceholder: "einkauf@firma.de",
    passwordLabel: "Kontopasswort",
    reasonLabel: "Grund der Löschung (optional)",
    reasonPlaceholder: "Optionales Feedback zur Verbesserung unseres Service...",
    confirmLabel:
      "Ich bestätige, dass mein Konto und meine Profildaten dauerhaft und unwiderruflich gelöscht werden.",
    confirmError:
      "Bitte bestätigen Sie, dass die Kontolöschung nicht rückgängig gemacht werden kann.",
    networkError: "Verbindungsfehler zum Server. Bitte erneut versuchen.",
    submitBtn: "Mein Konto und personenbezogene Daten dauerhaft löschen",
    submittingBtn: "Konto wird gelöscht...",
  },
  fr: {
    backToStore: "Retour à la boutique Merter Vitrini",
    playBadge: "Sécurité des données Google Play",
    pageTitle: "Merter Vitrini — Centre de Suppression de Compte et Données",
    introAppLabel: "L'application mobile Merter Vitrini",
    introMid: "et la plateforme web vous permettent de supprimer définitivement votre compte ",
    introCustomerLabel: "Client (Acheteur B2B)",
    introOr: " ou ",
    introSupplierLabel: "Fournisseur",
    introEnd: " depuis l'application ou directement sur cette page.",
    inAppTitle: "Suppression depuis l'application mobile",
    inAppStep1: "Ouvrez l'application mobile Merter Vitrini.",
    inAppStep2: "Accédez à l'onglet Profil / Mon Compte.",
    inAppStep3: "Appuyez sur Supprimer définitivement mon compte et confirmez.",
    dataRetentionTitle: "Données supprimées et conservation légale",
    deletedImmediateLabel: "Suppression immédiate :",
    deletedImmediateBody:
      "Nom, e-mail, téléphone, carnet d'adresses, panier, favoris et jetons de notification.",
    legalRetentionLabel: "Conservation légale :",
    legalRetentionBody:
      "Les commandes B2B finalisées et pièces comptables sont anonymisées et conservées selon les obligations commerciales et fiscales.",
    formTitle: "Formulaire Web de Suppression Immédiate",
    formDesc:
      "Si vous avez désinstallé l'application mobile, sélectionnez votre type de compte et saisissez vos identifiants ci-dessous.",
    roleLabel: "Type de compte",
    roleCustomer: "Client (Acheteur en gros)",
    roleSupplier: "Fournisseur / Fabricant",
    emailLabel: "Adresse e-mail enregistrée",
    emailPlaceholder: "achats@societe.fr",
    passwordLabel: "Mot de passe du compte",
    reasonLabel: "Motif de suppression (facultatif)",
    reasonPlaceholder: "Partagez vos remarques pour nous aider à progresser...",
    confirmLabel:
      "Je confirme que mon compte et mes données personnelles seront définitivement supprimés de manière irréversible.",
    confirmError:
      "Veuillez confirmer que la suppression du compte est irréversible.",
    networkError: "Erreur de connexion au serveur. Veuillez réessayer.",
    submitBtn: "Supprimer définitivement mon compte et mes données personnelles",
    submittingBtn: "Suppression en cours...",
  },
  pl: {
    backToStore: "Wróć do sklepu Merter Vitrini",
    playBadge: "Bezpieczeństwo danych Google Play",
    pageTitle: "Merter Vitrini — Centrum Usuwania Konta i Danych Osobowych",
    introAppLabel: "Aplikacja mobilna Merter Vitrini",
    introMid: "oraz platforma webowa umożliwiają trwałe usunięcie konta ",
    introCustomerLabel: "Klienta (Kupca B2B)",
    introOr: " lub ",
    introSupplierLabel: "Dostawcy",
    introEnd: " z poziomu aplikacji albo bezpośrednio na tej stronie.",
    inAppTitle: "Usuwanie w aplikacji mobilnej",
    inAppStep1: "Otwórz aplikację mobilną Merter Vitrini.",
    inAppStep2: "Przejdź do zakładki Profil / Moje konto.",
    inAppStep3: "Wybierz Trwale usuń moje konto i potwierdź operację.",
    dataRetentionTitle: "Usuwane i archiwizowane dane",
    deletedImmediateLabel: "Usuwane natychmiast:",
    deletedImmediateBody:
      "Imię i nazwisko, e-mail, telefon, książka adresowa, koszyk, ulubione oraz tokeny powiadomień.",
    legalRetentionLabel: "Wymóg prawny:",
    legalRetentionBody:
      "Zrealizowane zamówienia B2B i dokumenty księgowe zostają zanonimizowane i są przechowywane przez okres wymagany przepisami prawa.",
    formTitle: "Formularz Natychmiastowego Usunięcia Konta Online",
    formDesc:
      "Jeśli odinstalowałeś już aplikację, wybierz typ konta poniżej i potwierdź dane logowania, aby natychmiast usunąć konto.",
    roleLabel: "Typ konta",
    roleCustomer: "Klient (Kupujący hurtowo)",
    roleSupplier: "Dostawca / Producent",
    emailLabel: "Zarejestrowany adres e-mail",
    emailPlaceholder: "zakupy@firma.pl",
    passwordLabel: "Hasło do konta",
    reasonLabel: "Powód usunięcia (opcjonalnie)",
    reasonPlaceholder: "Podziel się opinią, aby pomóc nam ulepszyć platformę...",
    confirmLabel:
      "Potwierdzam, że moje konto i dane osobowe zostaną trwale usunięte, a operacja jest nieodwracalna.",
    confirmError: "Potwierdź, że usunięcie konta jest nieodwracalne.",
    networkError: "Błąd połączenia z serwerem. Spróbuj ponownie.",
    submitBtn: "Trwale usuń moje konto i dane osobowe",
    submittingBtn: "Usuwanie konta...",
  },
  bg: {
    backToStore: "Обратно към магазин Merter Vitrini",
    playBadge: "Защита на данните в Google Play",
    pageTitle: "Merter Vitrini — Център за изтриване на профил и данни",
    introAppLabel: "Мобилното приложение Merter Vitrini",
    introMid: "и уеб платформата ви позволяват окончателно да изтриете своя профил на ",
    introCustomerLabel: "Клиент (Купувач на едро)",
    introOr: " или ",
    introSupplierLabel: "Доставчик",
    introEnd: " от приложението или директно чрез тази страница.",
    inAppTitle: "Изтриване през мобилното приложение",
    inAppStep1: "Отворете мобилното приложение Merter Vitrini.",
    inAppStep2: "Отидете в секция Профил / Моят акаунт.",
    inAppStep3: "Натиснете Изтрий профила ми завинаги и потвърдете.",
    dataRetentionTitle: "Изтривани и законово съхранявани данни",
    deletedImmediateLabel: "Изтриват се веднага:",
    deletedImmediateBody:
      "Име, имейл, телефон, адресна книга, количка, любими и токени за известия.",
    legalRetentionLabel: "Законово съхранение:",
    legalRetentionBody:
      "Приключените B2B поръчки и счетоводни документи се анонимизират и се пазят за законоустановения срок.",
    formTitle: "Уеб формуляр за незабавно изтриване на профил",
    formDesc:
      "Ако вече сте деинсталирали приложението, изберете типа профил по-долу и въведете данните си за незабавно изтриване.",
    roleLabel: "Тип профил",
    roleCustomer: "Клиент (Търговец на едро)",
    roleSupplier: "Доставчик / Производител",
    emailLabel: "Регистриран имейл адрес",
    emailPlaceholder: "office@company.bg",
    passwordLabel: "Парола на профила",
    reasonLabel: "Причина за изтриване (по желание)",
    reasonPlaceholder: "Споделете мнението си, за да подобрим услугата...",
    confirmLabel:
      "Потвърждавам, че моят профил и личните ми данни ще бъдат окончателно изтрити и това действие е необратимо.",
    confirmError:
      "Моля, потвърдете, че изтриването на профила е необратимо.",
    networkError:
      "Възникна грешка при връзка със сървъра. Моля, опитайте отново.",
    submitBtn: "Изтрий окончателно моя профил и лични данни",
    submittingBtn: "Изтриване на профила...",
  },
};

interface AccountDeletionClientProps {
  readonly service?: IAccountDeletionService;
  readonly initialLang?: SupportedSeoLang;
}

export default function AccountDeletionClient({
  service = accountDeletionService,
  initialLang = "tr",
}: Readonly<AccountDeletionClientProps>) {
  const [lang, setLang] = useState<SupportedSeoLang>(initialLang);
  const [role, setRole] = useState<AccountRole>("customer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const safeLang = normalizeSeoLang(lang, "tr");
  const copy = ACCOUNT_DELETION_COPY[safeLang];

  const handleLangSelect = (nextLang: SupportedSeoLang) => {
    setLang(nextLang);
    if (typeof window !== "undefined") {
      const targetUrl =
        nextLang === "tr"
          ? "/account-deletion"
          : `/account-deletion?lang=${nextLang}`;
      window.history.replaceState({}, "", targetUrl);
    }
  };

  const handleDeleteSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!confirmed) {
      setErrorMsg(copy.confirmError);
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
      setErrorMsg(err instanceof Error ? err.message : copy.networkError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      dir={safeLang === "ar" ? "rtl" : "ltr"}
      className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8"
    >
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={safeLang === "tr" ? "/" : `/${safeLang}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {copy.backToStore}
          </Link>

          <div className="flex flex-wrap items-center gap-1">
            {SUPPORTED_SEO_LANGS.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => handleLangSelect(code)}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase cursor-pointer border transition-colors ${
                  safeLang === code
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                }`}
              >
                {code}
              </button>
            ))}
          </div>

          <span className="text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full bg-blue-100 text-blue-800">
            {copy.playBadge}
          </span>
        </div>

        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-red-50 text-red-600 shrink-0">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                {copy.pageTitle}
              </h1>
              <p className="mt-2 text-sm sm:text-base text-slate-600">
                <strong>{copy.introAppLabel}</strong> (
                <code>com.mertervitrini.app</code>) {copy.introMid}
                <strong>{copy.introCustomerLabel}</strong>
                {copy.introOr}
                <strong>{copy.introSupplierLabel}</strong>
                {copy.introEnd}
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 pt-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-slate-900">
                <Smartphone className="w-5 h-5 text-blue-600" />
                {copy.inAppTitle}
              </div>
              <ol className="text-sm text-slate-600 list-decimal list-inside space-y-1">
                <li>{copy.inAppStep1}</li>
                <li>{copy.inAppStep2}</li>
                <li>{copy.inAppStep3}</li>
              </ol>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-slate-900">
                <Lock className="w-5 h-5 text-emerald-600" />
                {copy.dataRetentionTitle}
              </div>
              <ul className="text-sm text-slate-600 list-disc list-inside space-y-1">
                <li>
                  <strong>{copy.deletedImmediateLabel}</strong>{" "}
                  {copy.deletedImmediateBody}
                </li>
                <li>
                  <strong>{copy.legalRetentionLabel}</strong>{" "}
                  {copy.legalRetentionBody}
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            {copy.formTitle}
          </h2>
          <p className="text-sm text-slate-600 mb-6">{copy.formDesc}</p>

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
                {copy.roleLabel}
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
                  {copy.roleCustomer}
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
                  {copy.roleSupplier}
                </button>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {copy.emailLabel}
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={copy.emailPlaceholder}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {copy.passwordLabel}
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
                {copy.reasonLabel}
              </label>
              <textarea
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={copy.reasonPlaceholder}
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
              <span className="text-sm text-slate-700">{copy.confirmLabel}</span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-semibold py-3 px-5 text-sm transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              {loading ? copy.submittingBtn : copy.submitBtn}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
