"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, Clipboard, Home, LogOut, Check, AlertCircle, AlertTriangle } from "lucide-react";
import { getCategoryPrefix, t } from "@/app/i18n";
import { Category, CartItem } from "@/types/store";
import { apiFetch, showToast } from "@/app/utils";
import {
  SupportedSeoLang,
  isSupportedSeoLang,
  normalizeSeoLang,
} from "@/utils/seoHelpers";
import {
  isRealisticPhoneNumber,
  validateAndNormalizeRealisticPhone,
} from "@/utils/phoneValidation";

// Centralized types & translations
import { addressTranslations, orderTranslations } from "./components/translations";
import { UserAddress, CountryLookup, StateLookup, CityLookup } from "./components/types";

// Modular sub-components
import ProfileDetails from "./components/ProfileDetails";
import AddressBook from "./components/AddressBook";
import AddressModal from "./components/AddressModal";
import OrderHistory, { UserOrder } from "./components/OrderHistory";
import PaymentModal from "./components/PaymentModal";
import RefundModal, { RefundOrderItem } from "./components/RefundModal";

// Reuse global storefront components
import Header from "@/components/store/Header";
import Footer from "@/components/store/Footer";
import PolicyViewerModal from "@/components/store/PolicyViewerModal";

interface ProfilePageLocaleCopy {
  readonly verifiedSuccess: string;
  readonly verifiedAlready: string;
  readonly verifiedExpired: string;
  readonly verifiedInvalid: string;
  readonly emailVerifiedBadge: string;
  readonly emailUnverifiedBadge: string;
  readonly roleAdmin: string;
  readonly roleCustomer: string;
  readonly resendFailed: string;
  readonly alreadyVerifiedToast: string;
  readonly verificationSentToast: string;
  readonly genericError: string;
  readonly ordersLoadFailed: string;
  readonly fileDownloadFailed: string;
  readonly orderCancelFailed: string;
  readonly paymentNotifyFailed: string;
  readonly refundRequestFailed: string;
  readonly addressSaveFailed: string;
  readonly addressDeleteFailed: string;
  readonly migrationFailed: string;
}

const PROFILE_PAGE_COPY: Record<SupportedSeoLang, ProfilePageLocaleCopy> = {
  tr: {
    verifiedSuccess:
      "🎉 Tebrikler! E-posta adresiniz başarıyla doğrulandı. Artık Merter Vitrini üzerinde 'Doğrulanmış Müşteri' rozeti ile sipariş ve teklif verebilirsiniz.",
    verifiedAlready: "E-posta adresiniz zaten daha önceden doğrulanmış durumdadır.",
    verifiedExpired:
      "Doğrulama bağlantısının 24 saatlik geçerlilik süresi dolmuş. Lütfen profilinizden yeni bir doğrulama bağlantısı talep ediniz.",
    verifiedInvalid:
      "Geçersiz veya bulunamayan doğrulama bağlantısı. Lütfen yeni bir doğrulama e-postası talep ediniz.",
    emailVerifiedBadge: "E-Posta Doğrulandı",
    emailUnverifiedBadge: "E-Posta Doğrulanmadı",
    roleAdmin: "B2B Yönetici",
    roleCustomer: "B2B Müşteri",
    resendFailed: "Doğrulama e-postası gönderilemedi",
    alreadyVerifiedToast: "E-posta zaten doğrulanmış durumdadır",
    verificationSentToast:
      "Doğrulama e-postası gönderildi! Lütfen gelen kutunuzu (ve spam klasörünü) kontrol edin.",
    genericError: "Hata oluştu",
    ordersLoadFailed: "Siparişler yüklenemedi",
    fileDownloadFailed: "Dosya indirilemedi",
    orderCancelFailed: "Sipariş iptal edilemedi",
    paymentNotifyFailed: "Ödeme bildirimi iletilemedi",
    refundRequestFailed: "İade talebi oluşturulamadı",
    addressSaveFailed: "Adres kaydedilemedi",
    addressDeleteFailed: "Adres silinemedi",
    migrationFailed: "Taşıma işlemi başarısız oldu",
  },
  en: {
    verifiedSuccess:
      "🎉 Congratulations! Your email address has been verified. You now carry the 'Verified Buyer' badge on Merter Vitrini.",
    verifiedAlready: "Your email address is already verified.",
    verifiedExpired:
      "This 24-hour verification link has expired. Please request a new verification email from your profile.",
    verifiedInvalid:
      "Invalid or unknown verification link. Please request a new verification email.",
    emailVerifiedBadge: "Email Verified",
    emailUnverifiedBadge: "Email Unverified",
    roleAdmin: "B2B Admin",
    roleCustomer: "B2B Buyer",
    resendFailed: "Failed to send verification email",
    alreadyVerifiedToast: "Email is already verified",
    verificationSentToast:
      "Verification email sent! Please check your inbox and spam folder.",
    genericError: "An error occurred",
    ordersLoadFailed: "Failed to load orders",
    fileDownloadFailed: "Failed to download file",
    orderCancelFailed: "Failed to cancel order",
    paymentNotifyFailed: "Failed to submit payment notification",
    refundRequestFailed: "Failed to create refund request",
    addressSaveFailed: "Failed to save address",
    addressDeleteFailed: "Failed to delete address",
    migrationFailed: "Address migration failed",
  },
  ru: {
    verifiedSuccess:
      "🎉 Поздравляем! Ваш e-mail подтвержден. Теперь вы отмечены значком «Проверенный покупатель» на Merter Vitrini.",
    verifiedAlready: "Ваш адрес электронной почты уже подтвержден.",
    verifiedExpired:
      "Срок действия ссылки (24 часа) истек. Пожалуйста, запросите новое письмо в профиле.",
    verifiedInvalid:
      "Недействительная ссылка подтверждения. Пожалуйста, запросите новое письмо.",
    emailVerifiedBadge: "E-mail подтвержден",
    emailUnverifiedBadge: "E-mail не подтвержден",
    roleAdmin: "B2B Администратор",
    roleCustomer: "B2B Покупатель",
    resendFailed: "Не удалось отправить письмо подтверждения",
    alreadyVerifiedToast: "E-mail уже подтвержден",
    verificationSentToast:
      "Письмо отправлено! Проверьте папку «Входящие» и «Спам».",
    genericError: "Произошла ошибка",
    ordersLoadFailed: "Не удалось загрузить заказы",
    fileDownloadFailed: "Не удалось скачать файл",
    orderCancelFailed: "Не удалось отменить заказ",
    paymentNotifyFailed: "Не удалось отправить уведомление об оплате",
    refundRequestFailed: "Не удалось создать заявку на возврат",
    addressSaveFailed: "Не удалось сохранить адрес",
    addressDeleteFailed: "Не удалось удалить адрес",
    migrationFailed: "Не удалось перенести адреса",
  },
  ar: {
    verifiedSuccess:
      "🎉 تهانينا! تم تأكيد بريدك الإلكتروني بنجاح. يمكنك الآن الطلب بشارة «مشتري موثق» على Merter Vitrini.",
    verifiedAlready: "بريدك الإلكتروني مؤكد مسبقاً.",
    verifiedExpired:
      "انتهت صلاحية رابط التأكيد (24 ساعة). يرجى طلب رابط تأكيد جديد من ملفك الشخصي.",
    verifiedInvalid: "رابط التأكيد غير صالح. يرجى طلب رسالة تأكيد جديدة.",
    emailVerifiedBadge: "البريد مؤكد",
    emailUnverifiedBadge: "البريد غير مؤكد",
    roleAdmin: "مسؤول B2B",
    roleCustomer: "عميل B2B",
    resendFailed: "تعذر إرسال رسالة التأكيد",
    alreadyVerifiedToast: "البريد الإلكتروني مؤكد بالفعل",
    verificationSentToast:
      "تم إرسال رسالة التأكيد! يرجى التحقق من البريد الوارد والرسائل غير المرغوب فيها.",
    genericError: "حدث خطأ",
    ordersLoadFailed: "تعذر تحميل الطلبات",
    fileDownloadFailed: "تعذر تنزيل الملف",
    orderCancelFailed: "تعذر إلغاء الطلب",
    paymentNotifyFailed: "تعذر إرسال إشعار الدفع",
    refundRequestFailed: "تعذر إنشاء طلب الاسترجاع",
    addressSaveFailed: "تعذر حفظ العنوان",
    addressDeleteFailed: "تعذر حذف العنوان",
    migrationFailed: "فشل نقل العناوين",
  },
  de: {
    verifiedSuccess:
      "🎉 Herzlichen Glückwunsch! Ihre E-Mail-Adresse wurde bestätigt. Sie tragen nun das Abzeichen „Verifizierter Einkäufer“.",
    verifiedAlready: "Ihre E-Mail-Adresse wurde bereits bestätigt.",
    verifiedExpired:
      "Der 24-Stunden-Bestätigungslink ist abgelaufen. Bitte fordern Sie im Profil einen neuen Link an.",
    verifiedInvalid:
      "Ungültiger Bestätigungslink. Bitte fordern Sie eine neue E-Mail an.",
    emailVerifiedBadge: "E-Mail bestätigt",
    emailUnverifiedBadge: "E-Mail unbestätigt",
    roleAdmin: "B2B-Admin",
    roleCustomer: "B2B-Kunde",
    resendFailed: "Bestätigungs-E-Mail konnte nicht gesendet werden",
    alreadyVerifiedToast: "E-Mail ist bereits bestätigt",
    verificationSentToast:
      "Bestätigungs-E-Mail gesendet! Bitte prüfen Sie Posteingang und Spam-Ordner.",
    genericError: "Ein Fehler ist aufgetreten",
    ordersLoadFailed: "Bestellungen konnten nicht geladen werden",
    fileDownloadFailed: "Datei konnte nicht heruntergeladen werden",
    orderCancelFailed: "Bestellung konnte nicht storniert werden",
    paymentNotifyFailed: "Zahlungsmeldung konnte nicht gesendet werden",
    refundRequestFailed: "Rücksendeanfrage konnte nicht erstellt werden",
    addressSaveFailed: "Adresse konnte nicht gespeichert werden",
    addressDeleteFailed: "Adresse konnte nicht gelöscht werden",
    migrationFailed: "Adressmigration fehlgeschlagen",
  },
  fr: {
    verifiedSuccess:
      "🎉 Félicitations ! Votre adresse e-mail est vérifiée. Vous disposez désormais du badge « Acheteur vérifié ».",
    verifiedAlready: "Votre adresse e-mail est déjà vérifiée.",
    verifiedExpired:
      "Ce lien de validation (24h) a expiré. Veuillez demander un nouveau lien depuis votre profil.",
    verifiedInvalid:
      "Lien de validation invalide. Veuillez demander un nouvel e-mail.",
    emailVerifiedBadge: "E-mail vérifié",
    emailUnverifiedBadge: "E-mail non vérifié",
    roleAdmin: "Admin B2B",
    roleCustomer: "Client B2B",
    resendFailed: "Échec de l'envoi de l'e-mail de vérification",
    alreadyVerifiedToast: "L'adresse e-mail est déjà vérifiée",
    verificationSentToast:
      "E-mail de vérification envoyé ! Vérifiez votre boîte de réception et vos spams.",
    genericError: "Une erreur est survenue",
    ordersLoadFailed: "Impossible de charger les commandes",
    fileDownloadFailed: "Impossible de télécharger le fichier",
    orderCancelFailed: "Impossible d'annuler la commande",
    paymentNotifyFailed: "Impossible d'envoyer l'avis de paiement",
    refundRequestFailed: "Impossible de créer la demande de retour",
    addressSaveFailed: "Impossible d'enregistrer l'adresse",
    addressDeleteFailed: "Impossible de supprimer l'adresse",
    migrationFailed: "Échec de la migration des adresses",
  },
  pl: {
    verifiedSuccess:
      "🎉 Gratulacje! Twój adres e-mail został zweryfikowany. Posiadasz teraz oznaczenie „Zweryfikowany kupiec”.",
    verifiedAlready: "Twój adres e-mail jest już zweryfikowany.",
    verifiedExpired:
      "Link weryfikacyjny (24h) wygasł. Poproś o nowy link w ustawieniach profilu.",
    verifiedInvalid:
      "Nieprawidłowy link weryfikacyjny. Wyślij nową wiadomość weryfikacyjną.",
    emailVerifiedBadge: "E-mail zweryfikowany",
    emailUnverifiedBadge: "E-mail niezweryfikowany",
    roleAdmin: "Administrator B2B",
    roleCustomer: "Klient B2B",
    resendFailed: "Nie udało się wysłać wiadomości weryfikacyjnej",
    alreadyVerifiedToast: "E-mail jest już zweryfikowany",
    verificationSentToast:
      "Wiadomość weryfikacyjna wysłana! Sprawdź skrzynkę odbiorczą oraz folder spam.",
    genericError: "Wystąpił błąd",
    ordersLoadFailed: "Nie udało się załadować zamówień",
    fileDownloadFailed: "Nie udało się pobrać pliku",
    orderCancelFailed: "Nie udało się anulować zamówienia",
    paymentNotifyFailed: "Nie udało się wysłać powiadomienia o płatności",
    refundRequestFailed: "Nie udało się utworzyć zgłoszenia zwrotu",
    addressSaveFailed: "Nie udało się zapisać adresu",
    addressDeleteFailed: "Nie udało się usunąć adresu",
    migrationFailed: "Migracja adresów nie powiodła się",
  },
  bg: {
    verifiedSuccess:
      "🎉 Поздравления! Имейл адресът ви е потвърден. Вече притежавате значка „Потвърден купувач“ в Merter Vitrini.",
    verifiedAlready: "Вашият имейл адрес вече е потвърден.",
    verifiedExpired:
      "24-часовата валидност на линка е изтекла. Моля, заявете нов линк от профила си.",
    verifiedInvalid:
      "Невалиден линк за потвърждение. Моля, заявете нов имейл за потвърждение.",
    emailVerifiedBadge: "Имейлът е потвърден",
    emailUnverifiedBadge: "Имейлът не е потвърден",
    roleAdmin: "B2B Администратор",
    roleCustomer: "B2B Клиент",
    resendFailed: "Неуспешно изпращане на имейл за потвърждение",
    alreadyVerifiedToast: "Имейлът вече е потвърден",
    verificationSentToast:
      "Имейлът за потвърждение е изпратен! Проверете входящата поща и спам папката.",
    genericError: "Възникна грешка",
    ordersLoadFailed: "Неуспешно зареждане на поръчките",
    fileDownloadFailed: "Неуспешно изтегляне на файла",
    orderCancelFailed: "Неуспешно анулиране на поръчката",
    paymentNotifyFailed: "Неуспешно изпращане на известие за плащане",
    refundRequestFailed: "Неуспешно създаване на заявка за връщане",
    addressSaveFailed: "Неуспешно запазване на адреса",
    addressDeleteFailed: "Неуспешно изтриване на адреса",
    migrationFailed: "Прехвърлянето на адресите бе неуспешно",
  },
};

interface AuthUser {
  readonly id?: string;
  readonly email?: string;
  readonly role?: string;
  readonly first_name?: string;
  readonly last_name?: string;
  readonly phone?: string;
  readonly [key: string]: unknown;
}

function parsePhoneOnly(rawPhone: string, phoneCode: number): string {
  let cleanP = rawPhone.trim().replace(/\D/g, "");
  const pCodeStr = String(phoneCode);
  if (cleanP.startsWith(pCodeStr)) {
    cleanP = cleanP.substring(pCodeStr.length);
  }
  if (cleanP.startsWith("0")) {
    cleanP = cleanP.substring(1);
  }
  return cleanP;
}

function getDefaultCountryId(countries: readonly CountryLookup[]): string {
  const trCountry = countries.find((c) => c.code === "TR");
  if (trCountry) return trCountry.id;
  return countries[0]?.id || "";
}

function validateAddressPhone(
  countryCode: string,
  phoneCode: number,
  cleanPhone: string,
  getAddressT: (k: string) => string
): string | null {
  const normalizedLocal = cleanPhone.replace(/^0+/, "");
  if (countryCode === "TR") {
    if (normalizedLocal.length !== 10) {
      return getAddressT("phone_tr_length_error");
    }
  } else if (normalizedLocal.length < 6 || normalizedLocal.length > 15) {
    return getAddressT("phone_intl_length_error");
  }
  const fullPhone = `+${phoneCode}${normalizedLocal}`;
  if (!isRealisticPhoneNumber(fullPhone)) {
    return getAddressT("phone_invalid_error");
  }
  return null;
}

function getInitialLang(): string {
  if (typeof window !== "undefined") {
    const queryLang = new URLSearchParams(window.location.search).get("lang");
    if (isSupportedSeoLang(queryLang)) {
      return queryLang;
    }
    const stored = localStorage.getItem("preferred_lang");
    if (isSupportedSeoLang(stored)) {
      return stored;
    }
  }
  return "tr";
}

function getInitialDisplayCurrency(): string {
  if (typeof window !== "undefined") {
    return localStorage.getItem("merter_preferred_currency") || "TRY";
  }
  return "TRY";
}

function getInitialSavedCart(): CartItem[] {
  if (typeof window !== "undefined") {
    const savedCart = localStorage.getItem("merter_b2b_cart");
    if (savedCart) {
      try {
        return JSON.parse(savedCart);
      } catch {
        // ignore
      }
    }
  }
  return [];
}

function getInitialAuthUser(): AuthUser | null {
  if (typeof window !== "undefined") {
    const savedUserInfo = localStorage.getItem("store_user_info");
    if (savedUserInfo) {
      try {
        return JSON.parse(savedUserInfo);
      } catch {
        // ignore
      }
    }
  }
  return null;
}

function getInitialEmailVerified(): boolean {
  if (typeof window === "undefined") return false;
  const urlParams = new URLSearchParams(window.location.search);
  const verifiedParam = urlParams.get("verified");
  if (verifiedParam === "success" || verifiedParam === "already_verified") {
    return true;
  }
  const savedUserInfo = localStorage.getItem("store_user_info");
  if (!savedUserInfo) return false;
  try {
    const parsed = JSON.parse(savedUserInfo) as Record<string, unknown>;
    return Boolean(parsed.email_verified);
  } catch {
    return false;
  }
}

type FeedbackType = "success" | "warning" | "error" | "info";

interface VerificationFeedback {
  type: FeedbackType;
  message: string;
}

function getFeedbackClasses(type: FeedbackType): string {
  switch (type) {
    case "success":
      return "bg-emerald-50 border-emerald-200 text-emerald-900";
    case "warning":
      return "bg-amber-50 border-amber-200 text-amber-900";
    case "info":
      return "bg-blue-50 border-blue-200 text-blue-900";
    default:
      return "bg-red-50 border-red-200 text-red-900";
  }
}

function renderFeedbackIcon(type: FeedbackType) {
  if (type === "success") {
    return <Check className="w-5 h-5 text-emerald-600 shrink-0" />;
  }
  if (type === "warning") {
    return <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />;
  }
  return <AlertCircle className="w-5 h-5 text-current shrink-0" />;
}

function syncStoredEmailVerification(verified: boolean): void {
  if (typeof window === "undefined") return;
  const savedUserInfo = localStorage.getItem("store_user_info");
  if (!savedUserInfo) return;
  try {
    const parsed = JSON.parse(savedUserInfo) as Record<string, unknown>;
    if (parsed.email_verified !== verified) {
      parsed.email_verified = verified;
      localStorage.setItem("store_user_info", JSON.stringify(parsed));
      window.dispatchEvent(new Event("auth-change"));
    }
  } catch {
    // ignore
  }
}

function getInitialVerificationFeedback(): VerificationFeedback | null {
  if (typeof window === "undefined") return null;
  const urlParams = new URLSearchParams(window.location.search);
  const verifiedParam = urlParams.get("verified");
  if (!verifiedParam) return null;

  const activeCopy =
    PROFILE_PAGE_COPY[normalizeSeoLang(getInitialLang(), "tr")];

  if (verifiedParam === "success") {
    return {
      type: "success",
      message: activeCopy.verifiedSuccess,
    };
  }
  if (verifiedParam === "already_verified") {
    return {
      type: "info",
      message: activeCopy.verifiedAlready,
    };
  }
  if (verifiedParam === "expired") {
    return {
      type: "warning",
      message: activeCopy.verifiedExpired,
    };
  }
  if (verifiedParam === "invalid" || verifiedParam === "not_found") {
    return {
      type: "error",
      message: activeCopy.verifiedInvalid,
    };
  }
  return null;
}

export default function ProfilePage() {
  const router = useRouter();
  // --- Storefront states ---
  const [lang, setLang] = useState<string>(getInitialLang);
  const [isLangOpen, setIsLangOpen] = useState<boolean>(false);
  const [displayCurrency, setDisplayCurrency] = useState<string>(getInitialDisplayCurrency);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string>("");
  const [cart] = useState<CartItem[]>(getInitialSavedCart);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState<boolean>(false);
  const [policyModalType, setPolicyModalType] = useState<
    "cancellation_and_return" | "terms_of_service" | "privacy_policy" | ""
  >("");

  const safeLang = normalizeSeoLang(lang, "tr");
  const pageCopy = PROFILE_PAGE_COPY[safeLang];

  // --- Auth states ---
  const [user, setUser] = useState<AuthUser | null>(getInitialAuthUser);
  const [token] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("store_user_token");
    }
    return null;
  });

  // --- Form Profile states ---
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [preferredLang, setPreferredLang] = useState("tr");
  const [preferredCurrency, setPreferredCurrency] = useState("TRY");
  const [billingAddress, setBillingAddress] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [taxNoTCKN, setTaxNoTCKN] = useState("");
  const [instagramUsername, setInstagramUsername] = useState("");

  const [loadingProfile, setLoadingProfile] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return Boolean(localStorage.getItem("store_user_token"));
    }
    return false;
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // --- Email Verification states ---
  const [emailVerified, setEmailVerified] = useState<boolean>(getInitialEmailVerified);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [verificationFeedback, setVerificationFeedback] = useState<VerificationFeedback | null>(getInitialVerificationFeedback);

  // --- Section state ---
  const [activeSection, setActiveSection] = useState<"profile" | "orders">(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("tab") === "orders") {
        return "orders";
      }
    }
    return "profile";
  });

  // --- Orders states ---
  const [orders, setOrders] = useState<UserOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return Boolean(localStorage.getItem("store_user_token"));
    }
    return false;
  });
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

  // --- Payment Notification Form States ---
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [paymentOrderID, setPaymentOrderID] = useState<string>("");
  const [payBankName, setPayBankName] = useState<string>("");
  const [paySenderName, setPaySenderName] = useState<string>("");
  const [payAmount, setPayAmount] = useState<string>("");
  const [payNotes, setPayNotes] = useState<string>("");
  const [submittingPayment, setSubmittingPayment] = useState<boolean>(false);

  // --- Refund Form States ---
  const [isRefundModalOpen, setIsRefundModalOpen] = useState<boolean>(false);
  const [refundOrderID, setRefundOrderID] = useState<string>("");
  const [refundOrderItems, setRefundOrderItems] = useState<RefundOrderItem[]>([]);
  const [refundType, setRefundType] = useState<"FULL" | "PARTIAL">("FULL");
  const [refundReason, setRefundReason] = useState<string>("");
  const [refundQuantities, setRefundQuantities] = useState<Record<string, number>>({});
  const [refundSelectedItems, setRefundSelectedItems] = useState<Record<string, boolean>>({});
  const [submittingRefund, setSubmittingRefund] = useState<boolean>(false);

  // --- Address Book States ---
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [countries, setCountries] = useState<CountryLookup[]>([]);
  const [states, setStates] = useState<StateLookup[]>([]);
  const [cities, setCities] = useState<CityLookup[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return Boolean(localStorage.getItem("store_user_token"));
    }
    return false;
  });

  // Modal / Form States
  const [isAddressModalOpen, setIsAddressModalOpen] = useState<boolean>(false);
  const [editingAddress, setEditingAddress] = useState<UserAddress | null>(null);

  // Active Address form state
  const [formTitle, setFormTitle] = useState("");
  const [formType, setFormType] = useState<"billing" | "shipping">("shipping");
  const [formFirstName, setFormFirstName] = useState("");
  const [formLastName, setFormLastName] = useState("");
  const [formCompany, setFormCompany] = useState("");
  const [formPhoneOnly, setFormPhoneOnly] = useState("");
  const [formCountryID, setFormCountryID] = useState("");
  const [formStateID, setFormStateID] = useState("");
  const [formCityID, setFormCityID] = useState("");
  const [formAddressLine, setFormAddressLine] = useState("");
  const [formPostalCode, setFormPostalCode] = useState("");
  const [formTaxNo, setFormTaxNo] = useState("");
  const [formTaxOffice, setFormTaxOffice] = useState("");
  const [formIsDefault, setFormIsDefault] = useState(false);

  const [savingAddress, setSavingAddress] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [addressSuccess, setAddressSuccess] = useState<string | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);

  const getAddressT = (key: string): string => {
    const safeLang = addressTranslations[lang] ? lang : "tr";
    return addressTranslations[safeLang][key] || addressTranslations["tr"][key] || t(key, lang);
  };

  const getOrderT = (key: string): string => {
    const safeLang = orderTranslations[lang] ? lang : "tr";
    return orderTranslations[safeLang][key] || orderTranslations["tr"][key] || key;
  };

  const handleLangChange = useCallback((nextLang: string) => {
    const normalized = normalizeSeoLang(nextLang, "tr");
    setLang(normalized);
    if (typeof window !== "undefined") {
      localStorage.setItem("preferred_lang", normalized);
      const urlParams = new URLSearchParams(window.location.search);
      if (normalized === "tr") {
        urlParams.delete("lang");
      } else {
        urlParams.set("lang", normalized);
      }
      const qs = urlParams.toString();
      window.history.replaceState(
        {},
        document.title,
        window.location.pathname + (qs ? `?${qs}` : "")
      );
    }
  }, []);

  const handleLogout = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("store_user_token");
      localStorage.removeItem("store_user_info");
      window.dispatchEvent(new Event("auth-change"));

      const origin = window.location.origin;
      window.location.href = origin + "/";
    }
  }, []);

  const fetchOrders = useCallback(async (authToken: string) => {
    const activeCopy = PROFILE_PAGE_COPY[normalizeSeoLang(getInitialLang(), "tr")];
    try {
      const response = await fetch("/api/v1/store/orders", {
        headers: {
          "Authorization": `Bearer ${authToken}`,
          "Content-Type": "application/json"
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || activeCopy.ordersLoadFailed);
      }
      setOrders(data || []);
    } catch (err: unknown) {
      setOrdersError((err as Error).message || activeCopy.ordersLoadFailed);
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  const fetchUserProfile = useCallback(async (authToken: string) => {
    try {
      const response = await fetch("/api/v1/store/profile", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${authToken}`,
          "Content-Type": "application/json"
        }
      });

      const data = await response.json();

      if (!response.ok) {
        const currentLang = (typeof window !== "undefined" && localStorage.getItem("preferred_lang")) || "tr";
        if (response.status === 401) {
          handleLogout();
          throw new Error(t("session_expired", currentLang));
        }
        throw new Error(data.error || t("profile_load_failed", currentLang));
      }

      setFirstName(data.first_name || "");
      setLastName(data.last_name || "");
      setEmail(data.email || "");
      setPhone(data.phone || "");
      setPreferredLang(data.preferred_lang || "tr");
      setPreferredCurrency(data.preferred_currency || "TRY");
      setBillingAddress(data.billing_address || "");
      setDeliveryAddress(data.delivery_address || "");
      setTaxNoTCKN(data.tax_no_tckn || "");
      setInstagramUsername(data.instagram_username || "");
      setEmailVerified(Boolean(data.email_verified));
      syncStoredEmailVerification(Boolean(data.email_verified));

    } catch (err: unknown) {
      const currentLang = (typeof window !== "undefined" && localStorage.getItem("preferred_lang")) || "tr";
      setError((err as Error).message || t("profile_load_failed", currentLang));
    } finally {
      setLoadingProfile(false);
    }
  }, [handleLogout]);

  const fetchAddresses = useCallback(async (authToken: string) => {
    try {
      const response = await fetch("/api/v1/store/profile/addresses", {
        headers: {
          "Authorization": `Bearer ${authToken}`,
          "Content-Type": "application/json"
        }
      });
      if (response.ok) {
        const data = await response.json();
        setAddresses(data || []);
      }
    } catch (e) {
      console.error("Failed to fetch addresses:", e);
    } finally {
      setLoadingAddresses(false);
    }
  }, []);

  const fetchCountries = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/store/locations/countries");
      if (response.ok) {
        const data = await response.json();
        setCountries(data || []);
      }
    } catch (e) {
      console.error("Failed to fetch countries:", e);
    }
  }, []);

  // Email verification countdown timer
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setInterval(() => {
      setResendCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCountdown]);

  // Handle URL cleanup and storage sync on email verification
  useEffect(() => {
    if (typeof window === "undefined") return;
    const urlParams = new URLSearchParams(window.location.search);
    const verifiedParam = urlParams.get("verified");
    if (!verifiedParam) return;

    if (verifiedParam === "success") {
      syncStoredEmailVerification(true);
    }

    urlParams.delete("verified");
    const qs = urlParams.toString();
    const cleanUrl = window.location.pathname + (qs ? `?${qs}` : "");
    window.history.replaceState({}, document.title, cleanUrl);
  }, []);

  const handleResendVerification = useCallback(async () => {
    if (resendingVerification || resendCountdown > 0) return;
    setResendingVerification(true);
    try {
      const response = await fetch("/api/v1/store/auth/resend-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || pageCopy.resendFailed);
      }

      if (data.already_verified) {
        setEmailVerified(true);
        showToast(pageCopy.alreadyVerifiedToast);
      } else {
        setResendCountdown(60);
        showToast(pageCopy.verificationSentToast);
      }
    } catch (err: unknown) {
      showToast((err as Error).message || pageCopy.genericError);
    } finally {
      setResendingVerification(false);
    }
  }, [token, email, pageCopy, resendingVerification, resendCountdown]);

  // Synchronize dynamic HTML lang & dir attributes
  useEffect(() => {
    if (typeof window !== "undefined") {
      document.documentElement.setAttribute("lang", safeLang);
      document.documentElement.setAttribute(
        "dir",
        safeLang === "ar" ? "rtl" : "ltr"
      );
    }
  }, [safeLang]);

  // Load language, currency, cart & categories on mount
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      const catData = await apiFetch<Category[]>("/categories");
      if (isMounted && catData) {
        setCategories(catData);
      }

      if (token) {
        await Promise.all([
          fetchUserProfile(token),
          fetchAddresses(token),
          fetchCountries(),
          fetchOrders(token)
        ]);
      }
    };

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [token, fetchUserProfile, fetchAddresses, fetchCountries, fetchOrders]);

  const handleDownloadFile = async (url: string, filename: string) => {
    if (!token) return;
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || pageCopy.fileDownloadFailed);
      }
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err: unknown) {
      showToast((err as Error).message || pageCopy.fileDownloadFailed);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!window.confirm(getOrderT("cancel_confirm"))) return;
    try {
      const response = await fetch(`/api/v1/store/orders/${orderId}/cancel`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || pageCopy.orderCancelFailed);
      }
      showToast(getOrderT("order_cancelled"));
      if (token) void fetchOrders(token);
    } catch (err: unknown) {
      showToast((err as Error).message || pageCopy.orderCancelFailed);
    }
  };

  const openPaymentModal = (order: UserOrder) => {
    setPaymentOrderID(order.id);
    setPayBankName("");
    setPaySenderName(`${firstName} ${lastName}`);
    setPayAmount(order.total_amount.toString());
    setPayNotes("");
    setIsPaymentModalOpen(true);
  };

  const handleSubmitPaymentNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingPayment(true);
    try {
      const response = await fetch(`/api/v1/store/orders/${paymentOrderID}/payment-notification`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          bank_name: payBankName,
          sender_name: paySenderName,
          amount: Number.parseFloat(payAmount),
          notes: payNotes
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || pageCopy.paymentNotifyFailed);
      }
      showToast(getOrderT("payment_notification_submitted"));
      setIsPaymentModalOpen(false);
      if (token) void fetchOrders(token);
    } catch (err: unknown) {
      showToast((err as Error).message || pageCopy.paymentNotifyFailed);
    } finally {
      setSubmittingPayment(false);
    }
  };

  const openRefundModal = (order: UserOrder) => {
    setRefundOrderID(order.id);
    setRefundOrderItems(order.items ? [...order.items] : []);
    setRefundType("FULL");
    setRefundReason("");

    const initialQty: Record<string, number> = {};
    const initialSel: Record<string, boolean> = {};
    (order.items || []).forEach((item) => {
      initialQty[item.id] = item.quantity;
      initialSel[item.id] = false;
    });
    setRefundQuantities(initialQty);
    setRefundSelectedItems(initialSel);

    setIsRefundModalOpen(true);
  };

  const handleRefundQtyChange = (itemId: string, val: number, max: number) => {
    const cleanVal = Math.max(1, Math.min(max, val));
    setRefundQuantities(prev => ({
      ...prev,
      [itemId]: cleanVal
    }));
  };

  const handleToggleRefundItem = (itemId: string) => {
    setRefundSelectedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const handleSubmitRefund = async (e: React.FormEvent) => {
    e.preventDefault();

    let itemsPayload: Array<{ order_item_id: string; quantity: number }> = [];
    if (refundType === "PARTIAL") {
      itemsPayload = refundOrderItems
        .filter(item => refundSelectedItems[item.id])
        .map(item => ({
          order_item_id: item.id,
          quantity: refundQuantities[item.id]
        }));

      if (itemsPayload.length === 0) {
        showToast(getOrderT("refund_items_selection"));
        return;
      }
    }

    setSubmittingRefund(true);
    try {
      const response = await fetch(`/api/v1/store/orders/${refundOrderID}/refund`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          refund_type: refundType,
          reason: refundReason,
          items: itemsPayload
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || pageCopy.refundRequestFailed);
      }
      showToast(getOrderT("refund_requested"));
      setIsRefundModalOpen(false);
      if (token) void fetchOrders(token);
    } catch (err: unknown) {
      showToast((err as Error).message || pageCopy.refundRequestFailed);
    } finally {
      setSubmittingRefund(false);
    }
  };



  const fetchStates = async (countryId: string): Promise<void> => {
    if (!countryId) {
      setStates([]);
      return;
    }
    try {
      const response = await fetch(`/api/v1/store/locations/countries/${countryId}/states`);
      if (response.ok) {
        const data = await response.json();
        setStates(data || []);
      } else {
        setStates([]);
      }
    } catch (e) {
      console.error("Failed to fetch states:", e);
      setStates([]);
    }
  };

  const fetchCities = async (stateId: string): Promise<void> => {
    if (!stateId) {
      setCities([]);
      return;
    }
    try {
      const response = await fetch(`/api/v1/store/locations/states/${stateId}/cities`);
      if (response.ok) {
        const data = await response.json();
        setCities(data || []);
      } else {
        setCities([]);
      }
    } catch (e) {
      console.error("Failed to fetch cities:", e);
      setCities([]);
    }
  };

  const handleCountryChange = (countryId: string) => {
    setFormCountryID(countryId);
    setFormStateID("");
    setFormCityID("");
    setCities([]);
    void fetchStates(countryId);
  };

  const handleStateChange = (stateId: string) => {
    setFormStateID(stateId);
    setFormCityID("");
    void fetchCities(stateId);
  };

  const openAddressModal = async (address: UserAddress | null = null) => {
    setAddressError(null);
    setAddressSuccess(null);
    if (address) {
      setEditingAddress(address);
      setFormTitle(address.title);
      setFormType(address.address_type);
      setFormFirstName(address.first_name);
      setFormLastName(address.last_name);
      setFormCompany(address.company_name || "");
      setFormCountryID(address.country_id);
      setFormAddressLine(address.address_line);
      setFormPostalCode(address.postal_code || "");
      setFormTaxNo(address.tax_no_tckn || "");
      setFormTaxOffice(address.tax_office || "");
      setFormIsDefault(address.is_default);

      // Parse phone code prefix based on selected country
      const matchedCountry = countries.find((c) => c.id === address.country_id);
      const matchedPhoneCode = matchedCountry ? matchedCountry.phone_code : 90;
      setFormPhoneOnly(parsePhoneOnly(address.phone || "", matchedPhoneCode));

      await fetchStates(address.country_id);
      setFormStateID(address.state_id || "");
      if (address.state_id) {
        await fetchCities(address.state_id);
        setFormCityID(address.city_id || "");
      } else {
        setFormCityID("");
        setCities([]);
      }
    } else {
      setEditingAddress(null);
      setFormTitle("");
      setFormType("shipping");
      setFormFirstName(firstName || "");
      setFormLastName(lastName || "");
      setFormCompany("");

      const defaultCountryID = getDefaultCountryId(countries);
      setFormCountryID(defaultCountryID);

      // Parse profile phone number prefix based on default country
      const matchedCountry = countries.find((c) => c.id === defaultCountryID);
      const matchedPhoneCode = matchedCountry ? matchedCountry.phone_code : 90;
      setFormPhoneOnly(parsePhoneOnly(phone || "", matchedPhoneCode));

      if (defaultCountryID) {
        await fetchStates(defaultCountryID);
      }
      setFormStateID("");
      setFormCityID("");
      setCities([]);
      setFormAddressLine("");
      setFormPostalCode("");
      setFormTaxNo(taxNoTCKN || "");
      setFormTaxOffice("");
      setFormIsDefault(addresses.length === 0);
    }
    setIsAddressModalOpen(true);
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddressError(null);
    setAddressSuccess(null);

    if (!formPostalCode.trim()) {
      setAddressError(getAddressT("postal_code_required_error"));
      return;
    }

    const selectedCountry = countries.find((c) => c.id === formCountryID);
    if (!selectedCountry) {
      setAddressError(getAddressT("country_required_error"));
      return;
    }

    const cleanPhone = formPhoneOnly.trim().replace(/\D/g, "").replace(/^0+/, "");
    const phoneError = validateAddressPhone(
      selectedCountry.code,
      selectedCountry.phone_code,
      cleanPhone,
      getAddressT
    );
    if (phoneError) {
      setAddressError(phoneError);
      return;
    }

    const fullPhone = `+${selectedCountry.phone_code}${cleanPhone}`;

    setSavingAddress(true);

    const payload = {
      title: formTitle,
      address_type: formType,
      first_name: formFirstName,
      last_name: formLastName,
      company_name: formCompany || null,
      phone: fullPhone,
      country_id: formCountryID,
      state_id: formStateID || null,
      city_id: formCityID || null,
      address_line: formAddressLine,
      postal_code: formPostalCode,
      tax_no_tckn: formType === "billing" ? (formTaxNo || null) : null,
      tax_office: formType === "billing" ? (formTaxOffice || null) : null,
      is_default: formIsDefault
    };

    try {
      const url = editingAddress
        ? `/api/v1/store/profile/addresses/${editingAddress.id}`
        : "/api/v1/store/profile/addresses";

      const method = editingAddress ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || pageCopy.addressSaveFailed);
      }

      setAddressSuccess(editingAddress ? getAddressT("address_update_success") : getAddressT("address_create_success"));
      if (token) void fetchAddresses(token);

      setTimeout(() => {
        setIsAddressModalOpen(false);
        setEditingAddress(null);
      }, 1000);

    } catch (err: unknown) {
      setAddressError((err as Error).message || pageCopy.addressSaveFailed);
    } finally {
      setSavingAddress(false);
    }
  };

  const handleDeleteAddress = async (id: string) => {
    if (!window.confirm(getAddressT("address_delete_confirm"))) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/store/profile/addresses/${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || pageCopy.addressDeleteFailed);
      }

      if (token) void fetchAddresses(token);
    } catch (err: unknown) {
      showToast((err as Error).message || pageCopy.addressDeleteFailed);
    }
  };

  const handleMigrateLegacyAddresses = async () => {
    setIsMigrating(true);
    try {
      const trCountry = countries.find((c) => c.code === "TR");
      if (!trCountry) throw new Error(pageCopy.migrationFailed);

      const phoneCheck = validateAndNormalizeRealisticPhone(phone);
      if (!phoneCheck.valid) {
        throw new Error(t("phone_invalid_error", lang));
      }
      const migratedPhone = phoneCheck.normalized;

      if (billingAddress && billingAddress.trim() !== "") {
        const response = await fetch("/api/v1/store/profile/addresses", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            title: getAddressT("billing_address"),
            address_type: "billing",
            first_name: firstName,
            last_name: lastName,
            phone: migratedPhone,
            country_id: trCountry.id,
            address_line: billingAddress.substring(0, 500),
            postal_code: "34000",
            tax_no_tckn: taxNoTCKN || null,
            is_default: true
          })
        });
        if (!response.ok) {
          const resErr = await response.json();
          throw new Error(resErr.error || pageCopy.migrationFailed);
        }
      }

      if (deliveryAddress && deliveryAddress.trim() !== "") {
        const response = await fetch("/api/v1/store/profile/addresses", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            title: getAddressT("shipping_address"),
            address_type: "shipping",
            first_name: firstName,
            last_name: lastName,
            phone: migratedPhone,
            country_id: trCountry.id,
            address_line: deliveryAddress.substring(0, 500),
            postal_code: "34000",
            is_default: true
          })
        });
        if (!response.ok) {
          const resErr = await response.json();
          throw new Error(resErr.error || pageCopy.migrationFailed);
        }
      }

      setSuccess(getAddressT("migration_success"));
      if (token) void fetchAddresses(token);
    } catch (e: unknown) {
      console.error(e);
      setError((e as Error).message || pageCopy.migrationFailed);
    } finally {
      setIsMigrating(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmedPhone = phone.trim();
    if (!trimmedPhone) {
      setError(t("phone_required_error", lang) || "Cep telefonu numarası zorunludur.");
      return;
    }
    const phoneCheck = validateAndNormalizeRealisticPhone(trimmedPhone);
    if (!phoneCheck.valid) {
      setError(t("phone_invalid_error", lang));
      return;
    }

    setSavingProfile(true);

    try {
      const response = await fetch("/api/v1/store/profile", {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          phone: phoneCheck.normalized,
          preferred_lang: preferredLang,
          preferred_currency: preferredCurrency,
          billing_address: billingAddress,
          delivery_address: deliveryAddress,
          tax_no_tckn: taxNoTCKN,
          instagram_username: instagramUsername
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t("profile_update_failed", lang));
      }

      const savedPhone = (data.phone as string | undefined) || phoneCheck.normalized;
      setPhone(savedPhone);
      setSuccess(t("profile_saved_success", lang));

      // 1. Sync updated details locally immediately
      if (typeof window !== "undefined") {
        const updatedUserInfo = {
          ...user,
          first_name: firstName,
          last_name: lastName,
          phone: savedPhone
        };
        setUser(updatedUserInfo);
        localStorage.setItem("store_user_info", JSON.stringify(updatedUserInfo));
        localStorage.setItem("preferred_lang", preferredLang);
        localStorage.setItem("merter_preferred_currency", preferredCurrency);

        // Sync outer page display state
        setLang(preferredLang);
        setDisplayCurrency(preferredCurrency);

        // Dispatch auth and profile sync triggers
        window.dispatchEvent(new Event("auth-change"));
      }

      setTimeout(() => {
        setSuccess(null);
      }, 3000);

    } catch (err: unknown) {
      setError((err as Error).message || t("profile_update_failed", lang));
    } finally {
      setSavingProfile(false);
    }
  };

  const totalPkgs = cart.reduce((sum, item) => sum + item.packages_qty, 0);
  const handleOpenCart = (open: boolean) => {
    if (open) {
      router.push(`/${getCategoryPrefix(safeLang)}/cart`);
    }
  };
  const handleOpenPolicy = (
    type: "cancellation_and_return" | "terms_of_service" | "privacy_policy"
  ) => {
    setPolicyModalType(type);
    setIsPolicyModalOpen(true);
  };

  // --- Sub-loaders for unauthorised / loading UI ---
  if (loadingProfile) {
    return (
      <div
        dir={safeLang === "ar" ? "rtl" : "ltr"}
        className="min-h-screen flex flex-col bg-[#fafafa]"
      >
        <Header
          lang={safeLang}
          setLang={handleLangChange}
          isLangOpen={isLangOpen}
          setIsLangOpen={setIsLangOpen}
          totalPkgs={totalPkgs}
          setIsCartOpen={handleOpenCart}
          setSearchQuery={() => { }}
          setCurrentPage={() => { }}
          setActiveCategoryId={setActiveCategoryId}
          categories={categories}
          activeCategoryId={activeCategoryId}
          displayCurrency={displayCurrency}
          onCurrencyChange={setDisplayCurrency}
        />
        <main className="flex-grow flex flex-col items-center justify-center py-20 gap-3">
          <div className="spinner animate-spin w-8 h-8 border-4 border-salmon-pink border-t-transparent rounded-full" />
          <span className="text-xs font-bold text-sonic-silver select-none">
            {t("loading_profile", safeLang)}
          </span>
        </main>
        <Footer lang={safeLang} onOpenPolicy={handleOpenPolicy} />
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

  // Unauthorized page state
  if (!user || !token) {
    return (
      <div
        dir={safeLang === "ar" ? "rtl" : "ltr"}
        className="min-h-screen flex flex-col bg-[#fafafa]"
      >
        <Header
          lang={safeLang}
          setLang={handleLangChange}
          isLangOpen={isLangOpen}
          setIsLangOpen={setIsLangOpen}
          totalPkgs={totalPkgs}
          setIsCartOpen={handleOpenCart}
          setSearchQuery={() => { }}
          setCurrentPage={() => { }}
          setActiveCategoryId={setActiveCategoryId}
          categories={categories}
          activeCategoryId={activeCategoryId}
          displayCurrency={displayCurrency}
          onCurrencyChange={setDisplayCurrency}
        />
        <main className="flex-grow flex flex-col items-center justify-center p-8 text-center select-none py-24">
          <span className="text-5xl mb-4">🔒</span>
          <h1 className="text-2xl font-extrabold text-eerie-black mb-3">
            {t("auth_required", safeLang)}
          </h1>
          <p className="text-sm font-semibold text-sonic-silver mb-8 max-w-md mx-auto leading-relaxed">
            {t("auth_required_desc", safeLang)}
          </p>
          <Link
            href={`/${safeLang}`}
            className="px-8 py-3 bg-salmon-pink text-white rounded-[5px] font-extrabold text-xs tracking-[0.5px] uppercase hover:bg-eerie-black transition-all cursor-pointer shadow-md no-underline"
          >
            {t("back_to_homepage", safeLang)}
          </Link>
        </main>
        <Footer lang={safeLang} onOpenPolicy={handleOpenPolicy} />
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

  return (
    <div
      dir={safeLang === "ar" ? "rtl" : "ltr"}
      className="min-h-screen flex flex-col bg-[#fbfbfb]"
    >
      <Header
        lang={safeLang}
        setLang={handleLangChange}
        isLangOpen={isLangOpen}
        setIsLangOpen={setIsLangOpen}
        totalPkgs={totalPkgs}
        setIsCartOpen={handleOpenCart}
        setSearchQuery={() => { }}
        setCurrentPage={() => { }}
        setActiveCategoryId={setActiveCategoryId}
        categories={categories}
        activeCategoryId={activeCategoryId}
        displayCurrency={displayCurrency}
        onCurrencyChange={setDisplayCurrency}
      />

      <main className="flex-grow max-w-[1280px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-in fade-in duration-300">

        {/* Navigation Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-[11px] font-bold text-sonic-silver mb-6 uppercase tracking-wider select-none">
          <Link href={`/${safeLang}`} className="hover:text-salmon-pink flex items-center gap-1 transition-colors no-underline text-sonic-silver">
            <Home className="w-3.5 h-3.5" />
            <span>{t("home", safeLang)}</span>
          </Link>
          <span className="text-spanish-gray">/</span>
          <span className="text-salmon-pink font-extrabold">{t("my_account", safeLang)}</span>
        </nav>

        {/* Verification Alert Banner */}
        {verificationFeedback && (
          <div
            className={`mb-6 p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs font-bold animate-in fade-in duration-200 ${getFeedbackClasses(
              verificationFeedback.type
            )}`}
          >
            <div className="flex items-center gap-2.5">
              {renderFeedbackIcon(verificationFeedback.type)}
              <span>{verificationFeedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setVerificationFeedback(null)}
              className="text-current opacity-70 hover:opacity-100 font-extrabold px-2 py-1 cursor-pointer border-none bg-transparent text-sm"
            >
              ✕
            </button>
          </div>
        )}

        {/* Outer Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

          {/* Left Column: Premium User Status Widget */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            <div className="bg-white rounded-2xl p-6 border border-cultured flex flex-col items-center text-center shadow-sm select-none">
              <div className="w-20 h-20 rounded-full bg-salmon-pink/10 border-2 border-salmon-pink flex items-center justify-center mb-4">
                <span className="text-3xl font-extrabold text-salmon-pink">
                  {firstName.charAt(0).toUpperCase()}
                </span>
              </div>
              <h3 className="font-sans font-extrabold text-lg text-eerie-black">
                {firstName} {lastName}
              </h3>
              <span className="text-[11px] font-semibold text-sonic-silver tracking-wider uppercase bg-cultured px-2.5 py-1 rounded-full mt-2.5 border border-cultured">
                {user?.role === "admin" ? pageCopy.roleAdmin : pageCopy.roleCustomer}
              </span>
              {emailVerified ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full mt-2 border border-emerald-200">
                  <Check className="w-3 h-3 text-emerald-600" />
                  {pageCopy.emailVerifiedBadge}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full mt-2 border border-amber-200">
                  <AlertCircle className="w-3 h-3 text-amber-600" />
                  {pageCopy.emailUnverifiedBadge}
                </span>
              )}

              <div className="w-full border-t border-cultured my-6" />

              <div className="flex flex-col gap-2.5 w-full">
                <button
                  type="button"
                  onClick={() => setActiveSection("profile")}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border text-xs font-bold text-left cursor-pointer w-full transition-all ${activeSection === "profile"
                    ? "bg-salmon-pink/5 border-salmon-pink/20 text-salmon-pink"
                    : "bg-transparent border-transparent text-sonic-silver hover:text-salmon-pink hover:bg-cultured"
                    }`}
                >
                  <User className="w-4 h-4" />
                  <span>{t("profile_details", lang)}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSection("orders")}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border text-xs font-bold text-left cursor-pointer w-full transition-all ${activeSection === "orders"
                    ? "bg-salmon-pink/5 border-salmon-pink/20 text-salmon-pink"
                    : "bg-transparent border-transparent text-sonic-silver hover:text-salmon-pink hover:bg-cultured"
                    }`}
                >
                  <Clipboard className="w-4 h-4" />
                  <span>{getOrderT("orders_tab")}</span>
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-3 px-3 py-2.5 text-sonic-silver hover:text-salmon-pink hover:bg-cultured transition-all rounded-lg text-xs font-bold text-left border border-transparent bg-transparent cursor-pointer w-full"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{t("safe_logout", lang)}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Dynamic Section Router */}
          <div className="lg:col-span-3">
            {activeSection === "profile" ? (
              <div className="flex flex-col gap-8">
                <ProfileDetails
                  lang={lang}
                  firstName={firstName}
                  setFirstName={setFirstName}
                  lastName={lastName}
                  setLastName={setLastName}
                  email={email}
                  phone={phone}
                  setPhone={setPhone}
                  preferredLang={preferredLang}
                  setPreferredLang={setPreferredLang}
                  preferredCurrency={preferredCurrency}
                  setPreferredCurrency={setPreferredCurrency}
                  taxNoTCKN={taxNoTCKN}
                  setTaxNoTCKN={setTaxNoTCKN}
                  instagramUsername={instagramUsername}
                  setInstagramUsername={setInstagramUsername}
                  savingProfile={savingProfile}
                  handleSaveProfile={handleSaveProfile}
                  addressesCount={addresses.length}
                  billingAddress={billingAddress}
                  deliveryAddress={deliveryAddress}
                  isMigrating={isMigrating}
                  handleMigrateLegacyAddresses={handleMigrateLegacyAddresses}
                  getAddressT={getAddressT}
                  error={error}
                  success={success}
                  emailVerified={emailVerified}
                  handleResendVerification={handleResendVerification}
                  resendingVerification={resendingVerification}
                  resendCountdown={resendCountdown}
                />

                <AddressBook
                  addresses={addresses}
                  loadingAddresses={loadingAddresses}
                  openAddressModal={openAddressModal}
                  handleDeleteAddress={handleDeleteAddress}
                  getAddressT={getAddressT}
                />
              </div>
            ) : (
              <OrderHistory
                orders={orders}
                loadingOrders={loadingOrders}
                ordersError={ordersError}
                expandedOrders={expandedOrders}
                setExpandedOrders={setExpandedOrders}
                lang={lang}
                getOrderT={getOrderT}
                handleDownloadFile={handleDownloadFile}
                openPaymentModal={openPaymentModal}
                openRefundModal={openRefundModal}
                handleCancelOrder={handleCancelOrder}
              />
            )}
          </div>

        </div>

      </main>

      {/* Form Dialog Modals */}
      <AddressModal
        isOpen={isAddressModalOpen}
        onClose={() => setIsAddressModalOpen(false)}
        lang={lang}
        countries={countries}
        states={states}
        cities={cities}
        editingAddress={editingAddress}
        formTitle={formTitle}
        setFormTitle={setFormTitle}
        formType={formType}
        setFormType={setFormType}
        formFirstName={formFirstName}
        setFormFirstName={setFormFirstName}
        formLastName={formLastName}
        setFormLastName={setFormLastName}
        formCompany={formCompany}
        setFormCompany={setFormCompany}
        formPhoneOnly={formPhoneOnly}
        setFormPhoneOnly={setFormPhoneOnly}
        formCountryID={formCountryID}
        handleCountryChange={handleCountryChange}
        formStateID={formStateID}
        handleStateChange={handleStateChange}
        formCityID={formCityID}
        setFormCityID={setFormCityID}
        formAddressLine={formAddressLine}
        setFormAddressLine={setFormAddressLine}
        formPostalCode={formPostalCode}
        setFormPostalCode={setFormPostalCode}
        formTaxNo={formTaxNo}
        setFormTaxNo={setFormTaxNo}
        formTaxOffice={formTaxOffice}
        setFormTaxOffice={setFormTaxOffice}
        formIsDefault={formIsDefault}
        setFormIsDefault={setFormIsDefault}
        savingAddress={savingAddress}
        addressError={addressError}
        addressSuccess={addressSuccess}
        handleSaveAddress={handleSaveAddress}
        getAddressT={getAddressT}
      />

      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        lang={lang}
        payBankName={payBankName}
        setPayBankName={setPayBankName}
        paySenderName={paySenderName}
        setPaySenderName={setPaySenderName}
        payAmount={payAmount}
        setPayAmount={setPayAmount}
        payNotes={payNotes}
        setPayNotes={setPayNotes}
        submittingPayment={submittingPayment}
        handleSubmitPaymentNotification={handleSubmitPaymentNotification}
        getOrderT={getOrderT}
        getAddressT={getAddressT}
      />

      <RefundModal
        isOpen={isRefundModalOpen}
        onClose={() => setIsRefundModalOpen(false)}
        lang={lang}
        refundType={refundType}
        setRefundType={setRefundType}
        refundReason={refundReason}
        setRefundReason={setRefundReason}
        refundOrderItems={refundOrderItems}
        refundQuantities={refundQuantities}
        handleRefundQtyChange={handleRefundQtyChange}
        refundSelectedItems={refundSelectedItems}
        handleToggleRefundItem={handleToggleRefundItem}
        submittingRefund={submittingRefund}
        handleSubmitRefund={handleSubmitRefund}
        getOrderT={getOrderT}
        getAddressT={getAddressT}
      />

      <Footer lang={safeLang} onOpenPolicy={handleOpenPolicy} />
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
