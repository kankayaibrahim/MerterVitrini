"use client";

import React from "react";
import Link from "next/link";
import { X, ShoppingBag, Lock } from "lucide-react";
import { CartItem } from "@/types/store";
import { t, getCategoryPrefix, pickLangText, SupportedLangCode } from "@/app/i18n";
import { convertPrice, getResizedImageUrl, showToast, ExchangeRate } from "@/app/utils";
import { getDirectSellerNoticeCopy } from "@/utils/legalNotices";
import { useIsStoreAuthenticated, openStoreAuthModal, getShortMemberPriceLabel } from "@/app/storeAuth";
import { persistStoreCart } from "@/utils/cartSync";
import { UserAddress } from "@/app/profile/components/types";
import StructuredCheckoutAddressPicker, {
  formatCheckoutAddressDisplay,
  isAddressRecordComplete,
} from "@/components/store/StructuredCheckoutAddressPicker";
import StructuredLocationFields, {
  StructuredLocationMeta,
  StructuredLocationValue,
} from "@/components/store/StructuredLocationFields";
import { executeRecaptchaAction, getRecaptchaLegalNotice } from "@/utils/recaptcha";

export interface InquiryFormData {
  fullName: string;
  companyName: string;
  phoneNumber: string;
  emailAddress: string;
  customerMessage: string;
  countryId: string;
  stateId: string;
  cityId: string;
  postalCode: string;
  addressLine: string;
  locationMeta: StructuredLocationMeta;
}

interface CartDrawerProps {
  readonly lang: string;
  readonly cart: readonly CartItem[];
  readonly onClose: () => void;
  readonly onAdjustQty: (index: number, change: number) => void;
  readonly onRemove: (index: number) => void;
  readonly totalPkgs: number;
  readonly totalItemsCount: number;
  readonly totalWeight: number;
  readonly totalPrice?: number;
  readonly submittingInquiry: boolean;
  readonly onSubmitInquiry: (data: InquiryFormData) => void;
  readonly displayCurrency?: string;
  readonly exchangeRates?: readonly ExchangeRate[];
}

interface CartDrawerLabels {
  packUnit: string;
  pcsPerPack: string;
  itemsVariety: string;
  cartSyncError: string;
  orderSubmitError: string;
  networkError: string;
  missingAddressesToast: string;
  orderSuccessToast: string;
  confirmB2bOrder: string;
  addressPaymentHeader: string;
  backToCart: string;
  deliveryAddress: string;
  deliveryAddressPlaceholder: string;
  customDeliveryOption: string;
  noDeliveryAddresses: string;
  billingAddress: string;
  billingAddressPlaceholder: string;
  customBillingOption: string;
  noBillingAddresses: string;
  bankTransferHeader: string;
  beneficiaryPrefix: string;
  proformaIbanNotice: string;
  paymentReferenceNote: string;
  requestQuoteFormTitle: string;
  goToCheckout: string;
  orderViaBankTransfer: string;
  requestProformaOnly: string;
  registeredDealerPrompt: string;
  signInBtn: string;
  removeItemAria: string;
}

const CART_DRAWER_LABELS: Record<SupportedLangCode, CartDrawerLabels> = {
  tr: {
    packUnit: "Paket",
    pcsPerPack: "Adet/Paket",
    itemsVariety: "Çeşit Ürün",
    cartSyncError: "Sepet senkronizasyonu başarısız.",
    orderSubmitError: "Sipariş verilirken bir hata oluştu.",
    networkError: "Bir ağ hatası oluştu.",
    missingAddressesToast: "Lütfen fatura ve teslimat adreslerini doldurunuz.",
    orderSuccessToast:
      "Sipariş talebiniz ({orderNo}) doğrudan ilgili tedarikçiye iletildi!\nFiyat teyidi, fatura ve kurumsal IBAN / SWIFT ödeme bilgileri satıcı tedarikçi tarafından paylaşılır.",
    confirmB2bOrder: "Siparişi Onayla",
    addressPaymentHeader: "Adres ve Ödeme Bilgileri",
    backToCart: "Sepete Dön",
    deliveryAddress: "Teslimat Adresi",
    deliveryAddressPlaceholder: "Teslimat adresini yazınız...",
    customDeliveryOption: "+ Yeni Adres Girişi",
    noDeliveryAddresses: "Profilinizde kayıtlı teslimat adresi bulunamadı.",
    billingAddress: "Fatura Adresi",
    billingAddressPlaceholder: "Fatura adresini yazınız...",
    customBillingOption: "+ Yeni Fatura Adresi Girişi",
    noBillingAddresses: "Profilinizde kayıtlı fatura adresi bulunamadı.",
    bankTransferHeader: "Doğrudan Tedarikçi Ödeme ve Proforma Bilgisi",
    beneficiaryPrefix: "Muhatap",
    proformaIbanNotice:
      "Merter Vitrini ödeme tahsil etmez. Talebiniz onaylandığında seçtiğiniz ürünlerin doğrudan satıcısı olan ilgili tedarikçi firma, kurumsal banka/IBAN bilgilerini ve proforma faturanızı doğrudan sizinle paylaşır.",
    paymentReferenceNote:
      "* Ödeme, fatura, kargo ve tüm satış sonrası süreçler doğrudan satışı yapan tedarikçi firma ile yürütülür.",
    requestQuoteFormTitle: "Fiyat Teklifi Talep Formu",
    goToCheckout: "Sipariş Adımına Dön",
    orderViaBankTransfer: "Banka Havalesi ile Sipariş Ver",
    requestProformaOnly: "Sadece Fiyat Teklifi İste (Proforma)",
    registeredDealerPrompt: "Kayıtlı müşterimiz misiniz?",
    signInBtn: "Giriş Yapın",
    removeItemAria: "Ürünü sepetten kaldır",
  },
  en: {
    packUnit: "Pack",
    pcsPerPack: "Pcs/Pack",
    itemsVariety: "Items",
    cartSyncError: "Failed to synchronize wholesale cart.",
    orderSubmitError: "An error occurred while placing your order.",
    networkError: "A network error occurred.",
    missingAddressesToast: "Please select or enter both billing and delivery addresses.",
    orderSuccessToast:
      "Your B2B inquiry ({orderNo}) has been sent directly to the Supplier!\nProforma invoice & bank IBAN/SWIFT details will be provided directly by the selling Supplier.",
    confirmB2bOrder: "Confirm B2B Order",
    addressPaymentHeader: "Shipping & Payment Details",
    backToCart: "Back to Cart",
    deliveryAddress: "Delivery Address",
    deliveryAddressPlaceholder: "Enter delivery address...",
    customDeliveryOption: "+ Enter New Delivery Address",
    noDeliveryAddresses: "No saved delivery addresses found in your profile.",
    billingAddress: "Billing Address",
    billingAddressPlaceholder: "Enter billing address...",
    customBillingOption: "+ Enter New Billing Address",
    noBillingAddresses: "No saved billing addresses found in your profile.",
    bankTransferHeader: "Direct Supplier Payment & Proforma Notice",
    beneficiaryPrefix: "Counterparty",
    proformaIbanNotice:
      "Merter Vitrini does not collect payments. Once submitted, the independent selling Supplier sends its own corporate IBAN / SWIFT details and proforma invoice directly to you.",
    paymentReferenceNote:
      "* Payments, commercial invoices, shipping, returns, and any commercial disputes are settled directly with the selling Supplier.",
    requestQuoteFormTitle: "Request Wholesale Quote Form",
    goToCheckout: "Go to Checkout",
    orderViaBankTransfer: "Order via Bank Transfer",
    requestProformaOnly: "Request Price Quote Only (Proforma)",
    registeredDealerPrompt: "Already a registered B2B buyer?",
    signInBtn: "Sign In",
    removeItemAria: "Remove item from cart",
  },
  ru: {
    packUnit: "Упак.",
    pcsPerPack: "шт./упак.",
    itemsVariety: "Позиций",
    cartSyncError: "Не удалось синхронизировать корзину.",
    orderSubmitError: "Произошла ошибка при оформлении заказа.",
    networkError: "Произошла сетевая ошибка.",
    missingAddressesToast: "Пожалуйста, укажите адрес доставки и платежный адрес.",
    orderSuccessToast:
      "Ваш запрос № {orderNo} передан напрямую Поставщику!\nРеквизиты IBAN / SWIFT и проформа-инвойс предоставляются непосредственно продавцом-поставщиком.",
    confirmB2bOrder: "Подтвердить B2B заказ",
    addressPaymentHeader: "Адрес доставки и реквизиты оплаты",
    backToCart: "Назад в корзину",
    deliveryAddress: "Адрес доставки",
    deliveryAddressPlaceholder: "Введите адрес доставки...",
    customDeliveryOption: "+ Ввести новый адрес доставки",
    noDeliveryAddresses: "В вашем профиле нет сохраненных адресов доставки.",
    billingAddress: "Платежный адрес (для инвойса)",
    billingAddressPlaceholder: "Введите платежный адрес...",
    customBillingOption: "+ Ввести новый платежный адрес",
    noBillingAddresses: "В вашем профиле нет сохраненных платежных адресов.",
    bankTransferHeader: "Прямой расчет с Поставщиком / Проформа",
    beneficiaryPrefix: "Сторона сделки",
    proformaIbanNotice:
      "Merter Vitrini не принимает оплату за товары. После отправки заявки прямой продавец (Поставщик) направит вам свои реквизиты IBAN / SWIFT и проформа-инвойс.",
    paymentReferenceNote:
      "* Все расчеты, документы, отгрузка, возвраты и претензии решаются напрямую с продающим Поставщиком.",
    requestQuoteFormTitle: "Форма запроса коммерческого предложения",
    goToCheckout: "Перейти к оформлению",
    orderViaBankTransfer: "Оформить заказ банковским переводом",
    requestProformaOnly: "Запросить только расчет (Проформа)",
    registeredDealerPrompt: "Уже зарегистрированы как оптовый партнер?",
    signInBtn: "Войти",
    removeItemAria: "Удалить товар из корзины",
  },
  ar: {
    packUnit: "حزمة",
    pcsPerPack: "قطعة/حزمة",
    itemsVariety: "منتجات متنوعة",
    cartSyncError: "تعذرت مزامنة السلة.",
    orderSubmitError: "حدث خطأ أثناء إرسال الطلب.",
    networkError: "حدث خطأ في الشبكة.",
    missingAddressesToast: "يرجى تحديد أو إدخال عنوان الشحن وعنوان الفوترة.",
    orderSuccessToast:
      "تم إرسال طلبك رقم {orderNo} مباشرة إلى المورد!\nسيقوم المورد البائع بإرسال تفاصيل الحساب البنكي والفاتورة المبدئية مباشرة إليك.",
    confirmB2bOrder: "تأكيد طلب الجملة B2B",
    addressPaymentHeader: "معلومات العنوان والدفع",
    backToCart: "العودة إلى السلة",
    deliveryAddress: "عنوان التسليم والشحن",
    deliveryAddressPlaceholder: "اكتب عنوان التسليم...",
    customDeliveryOption: "+ إدخال عنوان تسليم جديد",
    noDeliveryAddresses: "لا توجد عناوين تسليم محفوظة في ملفك الشخصي.",
    billingAddress: "عنوان الفوترة",
    billingAddressPlaceholder: "اكتب عنوان الفوترة...",
    customBillingOption: "+ إدخال عنوان فوترة جديد",
    noBillingAddresses: "لا توجد عناوين فوترة محفوظة في ملفك الشخصي.",
    bankTransferHeader: "إشعار الدفع والفاتورة المباشرة مع المورد",
    beneficiaryPrefix: "الطرف المتعاقد",
    proformaIbanNotice:
      "لا تحصل منصة Merter Vitrini مبالغ المنتجات. بعد إرسال الطلب، يتولى المورد البائع مباشرة تزويدكم بتفاصيل الحساب البنكي (IBAN / SWIFT) والفاتورة المبدئية.",
    paymentReferenceNote:
      "* تتم جميع المدفوعات والفواتير والشحن والمرتجعات والنزاعات التجارية مباشرة مع المورد البائع.",
    requestQuoteFormTitle: "نموذج طلب عرض سعر بالجملة",
    goToCheckout: "الانتقال لإتمام الطلب",
    orderViaBankTransfer: "الطلب عبر التحويل البنكي",
    requestProformaOnly: "طلب عرض سعر فقط (فاتورة مبدئية)",
    registeredDealerPrompt: "هل أنت عميل جملة مسجل لدينا؟",
    signInBtn: "تسجيل الدخول",
    removeItemAria: "إزالة المنتج من السلة",
  },
  de: {
    packUnit: "Paket",
    pcsPerPack: "Stk./Paket",
    itemsVariety: "Positionen",
    cartSyncError: "Warenkorb-Synchronisierung fehlgeschlagen.",
    orderSubmitError: "Beim Aufgeben der Bestellung ist ein Fehler aufgetreten.",
    networkError: "Ein Netzwerkfehler ist aufgetreten.",
    missingAddressesToast: "Bitte wählen oder geben Sie Rechnungs- und Lieferadresse ein.",
    orderSuccessToast:
      "Ihre B2B-Anfrage ({orderNo}) wurde direkt an den Lieferanten gesendet!\nIBAN/SWIFT-Daten und Proforma-Rechnung erhalten Sie direkt vom verkaufenden Lieferanten.",
    confirmB2bOrder: "B2B-Bestellung bestätigen",
    addressPaymentHeader: "Adress- & Zahlungsinformationen",
    backToCart: "Zurück zum Warenkorb",
    deliveryAddress: "Lieferadresse",
    deliveryAddressPlaceholder: "Lieferadresse eingeben...",
    customDeliveryOption: "+ Neue Lieferadresse eingeben",
    noDeliveryAddresses: "Keine gespeicherten Lieferadressen im Profil gefunden.",
    billingAddress: "Rechnungsadresse",
    billingAddressPlaceholder: "Rechnungsadresse eingeben...",
    customBillingOption: "+ Neue Rechnungsadresse eingeben",
    noBillingAddresses: "Keine gespeicherten Rechnungsadressen im Profil gefunden.",
    bankTransferHeader: "Direktzahlung an den Lieferanten / Proforma",
    beneficiaryPrefix: "Vertragspartner",
    proformaIbanNotice:
      "Merter Vitrini zieht keine Zahlungen ein. Der jeweils verkaufende Lieferant stellt Ihnen nach Prüfung seine eigene Firmen-IBAN/SWIFT-Verbindung und Proforma-Rechnung direkt bereit.",
    paymentReferenceNote:
      "* Zahlung, Rechnungsstellung, Versand, Rückgaben und Reklamationen erfolgen ausschließlich direkt mit dem Lieferanten.",
    requestQuoteFormTitle: "Angebotsanfrage-Formular",
    goToCheckout: "Zur Bestellabwicklung",
    orderViaBankTransfer: "Per Banküberweisung bestellen",
    requestProformaOnly: "Nur Preisangebot anfordern (Proforma)",
    registeredDealerPrompt: "Sind Sie bereits registrierter B2B-Kunde?",
    signInBtn: "Anmelden",
    removeItemAria: "Artikel aus dem Warenkorb entfernen",
  },
  fr: {
    packUnit: "Paquet",
    pcsPerPack: "Pcs/Paquet",
    itemsVariety: "Références",
    cartSyncError: "Échec de la synchronisation du panier.",
    orderSubmitError: "Une erreur est survenue lors de la validation de la commande.",
    networkError: "Une erreur réseau s'est produite.",
    missingAddressesToast: "Veuillez sélectionner ou saisir les adresses de facturation et de livraison.",
    orderSuccessToast:
      "Votre demande B2B ({orderNo}) a été transmise directement au fournisseur !\nLa facture proforma et l'IBAN/SWIFT vous seront fournis directement par le fournisseur vendeur.",
    confirmB2bOrder: "Confirmer la commande B2B",
    addressPaymentHeader: "Adresses & Modalités de Paiement",
    backToCart: "Retour au panier",
    deliveryAddress: "Adresse de livraison",
    deliveryAddressPlaceholder: "Saisissez l'adresse de livraison...",
    customDeliveryOption: "+ Saisir une nouvelle adresse de livraison",
    noDeliveryAddresses: "Aucune adresse de livraison enregistrée dans votre profil.",
    billingAddress: "Adresse de facturation",
    billingAddressPlaceholder: "Saisissez l'adresse de facturation...",
    customBillingOption: "+ Saisir une nouvelle adresse de facturation",
    noBillingAddresses: "Aucune adresse de facturation enregistrée dans votre profil.",
    bankTransferHeader: "Paiement Direct au Fournisseur & Proforma",
    beneficiaryPrefix: "Cocontractant",
    proformaIbanNotice:
      "Merter Vitrini n'encaisse aucun règlement. Le fournisseur vendeur direct vous communique personnellement ses coordonnées IBAN/SWIFT et sa facture proforma.",
    paymentReferenceNote:
      "* Les paiements, factures, expéditions, retours et litiges relèvent exclusivement du fournisseur vendeur.",
    requestQuoteFormTitle: "Formulaire de Demande de Devis",
    goToCheckout: "Aller au paiement",
    orderViaBankTransfer: "Commander par virement bancaire",
    requestProformaOnly: "Demander uniquement un devis (Proforma)",
    registeredDealerPrompt: "Déjà client professionnel inscrit ?",
    signInBtn: "Se connecter",
    removeItemAria: "Retirer l'article du panier",
  },
  pl: {
    packUnit: "Pakiet",
    pcsPerPack: "szt./pakiet",
    itemsVariety: "Pozycji",
    cartSyncError: "Nie udało się zsynchronizować koszyka.",
    orderSubmitError: "Wystąpił błąd podczas składania zamówienia.",
    networkError: "Wystąpił błąd sieci.",
    missingAddressesToast: "Proszę wybrać lub wpisać adres rozliczeniowy oraz adres dostawy.",
    orderSuccessToast:
      "Twoje zapytanie B2B ({orderNo}) zostało przekazane bezpośrednio Dostawcy!\nFaktura proforma i dane IBAN / SWIFT zostaną przekazane bezpośrednio przez sprzedającego Dostawcę.",
    confirmB2bOrder: "Potwierdź zamówienie B2B",
    addressPaymentHeader: "Adresy i Dane Płatności",
    backToCart: "Powrót do koszyka",
    deliveryAddress: "Adres dostawy",
    deliveryAddressPlaceholder: "Wpisz adres dostawy...",
    customDeliveryOption: "+ Wprowadź nowy adres dostawy",
    noDeliveryAddresses: "Brak zapisanych adresów dostawy w profilu.",
    billingAddress: "Adres do faktury",
    billingAddressPlaceholder: "Wpisz adres do faktury...",
    customBillingOption: "+ Wprowadź nowy adres do faktury",
    noBillingAddresses: "Brak zapisanych adresów do faktury w profilu.",
    bankTransferHeader: "Płatność Bezpośrednia do Dostawcy / Proforma",
    beneficiaryPrefix: "Strona umowy",
    proformaIbanNotice:
      "Merter Vitrini nie pobiera płatności za towary. Po złożeniu zamówienia bezpośredni Dostawca przekaże swoje firmowe dane IBAN / SWIFT oraz fakturę proforma.",
    paymentReferenceNote:
      "* Wszelkie płatności, faktury, dostawy, zwroty i reklamacje są załatwiane bezpośrednio ze sprzedającym Dostawcą.",
    requestQuoteFormTitle: "Formularz Zapytania Ofertowego",
    goToCheckout: "Przejdź do zamówienia",
    orderViaBankTransfer: "Zamów przelewem bankowym",
    requestProformaOnly: "Poproś tylko o wycenę (Proforma)",
    registeredDealerPrompt: "Jesteś zarejestrowanym kontrahentem?",
    signInBtn: "Zaloguj się",
    removeItemAria: "Usuń produkt z koszyka",
  },
  bg: {
    packUnit: "Пакет",
    pcsPerPack: "бр./пакет",
    itemsVariety: "Артикула",
    cartSyncError: "Неуспешна синхронизация на количката.",
    orderSubmitError: "Възникна грешка при подаване на поръчката.",
    networkError: "Възникна мрежова грешка.",
    missingAddressesToast: "Моля, изберете или въведете адрес за доставка и фактуриране.",
    orderSuccessToast:
      "Вашата B2B заявка ({orderNo}) беше изпратена директно към Доставчика!\nПроформа фактура и IBAN / SWIFT данни се предоставят директно от продаващия Доставчик.",
    confirmB2bOrder: "Потвърди B2B поръчката",
    addressPaymentHeader: "Адрес и Данни за Плащане",
    backToCart: "Обратно към количката",
    deliveryAddress: "Адрес за доставка",
    deliveryAddressPlaceholder: "Въведете адрес за доставка...",
    customDeliveryOption: "+ Въвеждане на нов адрес за доставка",
    noDeliveryAddresses: "Няма запазени адреси за доставка във вашия профил.",
    billingAddress: "Адрес за фактуриране",
    billingAddressPlaceholder: "Въведете адрес за фактуриране...",
    customBillingOption: "+ Въвеждане на нов адрес за фактуриране",
    noBillingAddresses: "Няма запазени адреси за фактуриране във вашия профил.",
    bankTransferHeader: "Директно плащане към Доставчика / Проформа",
    beneficiaryPrefix: "Контрагент",
    proformaIbanNotice:
      "Merter Vitrini не събира плащания за стоки. Продаващият Доставчик директно ви изпраща своите IBAN / SWIFT данни и проформа фактура.",
    paymentReferenceNote:
      "* Всички плащания, фактури, доставки, връщания и спорове се уреждат директно с продаващия Доставчик.",
    requestQuoteFormTitle: "Формуляр за Оферта на Едро",
    goToCheckout: "Към завършване на поръчката",
    orderViaBankTransfer: "Поръчай с банков превод",
    requestProformaOnly: "Поискай само оферта (Проформа)",
    registeredDealerPrompt: "Регистриран B2B партньор ли сте?",
    signInBtn: "Вход",
    removeItemAria: "Премахни продукта от количката",
  },
};

const SAME_BILLING_LABELS: Record<string, string> = {
  tr: "Fatura adresi teslimat adresiyle aynı olsun",
  en: "Use same address for billing",
  ru: "Платёжный адрес совпадает с адресом доставки",
  ar: "عنوان الفوترة مطابق لعنوان التسليم",
  de: "Rechnungsadresse entspricht der Lieferadresse",
  fr: "Utiliser la même adresse pour la facturation",
  pl: "Adres rozliczeniowy taki sam jak adres dostawy",
  bg: "Адресът за фактуриране е същият като за доставка",
};

const INCOMPLETE_ADDRESS_LABELS: Record<string, string> = {
  tr: "Lütfen Ülke, İl, İlçe ve geçerli açık adres içeren kayıtlı teslimat ve fatura adreslerini seçin veya ekleyin.",
  en: "Please select or add complete delivery and billing addresses including Country, State, City, and street details.",
  ru: "Выберите или добавьте корректные адреса доставки и оплаты со страной, регионом и городом.",
  ar: "يرجى تحديد أو إضافة عناوين تسليم وفوترة مكتملة تتضمن الدولة والولاية والمدينة وتفاصيل الشارع.",
  de: "Bitte wählen oder erfassen Sie vollständige Liefer- und Rechnungsadressen mit Land, Bundesland und Stadt.",
  fr: "Veuillez sélectionner ou ajouter des adresses complètes avec pays, région, ville et rue.",
  pl: "Wybierz lub dodaj pełne adresy dostawy i rozliczeń z krajem, województwem, miastem i ulicą.",
  bg: "Моля, изберете или добавете пълни адреси с държава, област, град и улица.",
};

function getLocalizedDrawerNote(map: Record<string, string>, lang: string): string {
  return map[lang] || map.en;
}

interface StoredCheckoutDefaults {
  readonly firstName: string;
  readonly lastName: string;
  readonly phone: string;
}

function readStoredCheckoutDefaults(): StoredCheckoutDefaults {
  if (typeof window === "undefined") {
    return { firstName: "", lastName: "", phone: "" };
  }
  try {
    const stored = JSON.parse(localStorage.getItem("store_user_info") || "{}") as {
      first_name?: string;
      last_name?: string;
      phone?: string;
    };
    return {
      firstName: stored.first_name || "",
      lastName: stored.last_name || "",
      phone: stored.phone || "",
    };
  } catch {
    return { firstName: "", lastName: "", phone: "" };
  }
}

async function fetchSavedUserAddresses(token: string): Promise<UserAddress[]> {
  const res = await fetch("/api/v1/store/profile/addresses", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    return [];
  }
  const data = (await res.json().catch(() => [])) as UserAddress[];
  return Array.isArray(data) ? data : [];
}

function selectDefaultAddresses(
  data: readonly UserAddress[],
  setBilling: (id: string) => void,
  setDelivery: (id: string) => void
) {
  const defaultBill = data.find((a) => a.address_type === "billing" && a.is_default);
  const firstBill = defaultBill || data.find((a) => a.address_type === "billing") || data[0];
  if (firstBill?.id) {
    setBilling(firstBill.id);
  }

  const defaultDel = data.find((a) => a.address_type === "shipping" && a.is_default);
  const firstDel = defaultDel || data.find((a) => a.address_type === "shipping") || data[0];
  if (firstDel?.id) {
    setDelivery(firstDel.id);
  }
}

interface SubmitB2BOrderParams {
  readonly token: string;
  readonly cart: readonly CartItem[];
  readonly billingAddressId: string;
  readonly deliveryAddressId: string;
  readonly billingAddress: string;
  readonly deliveryAddress: string;
  readonly recaptchaToken: string;
  readonly lang: string;
  readonly displayCurrency?: string;
}

async function submitB2BOrder({
  token,
  cart,
  billingAddressId,
  deliveryAddressId,
  billingAddress,
  deliveryAddress,
  recaptchaToken,
  lang,
  displayCurrency,
}: SubmitB2BOrderParams): Promise<string> {
  const labels = pickLangText(lang, CART_DRAWER_LABELS);
  const syncRes = await fetch("/api/v1/store/cart/sync", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      items: cart.map((item) => ({
        product_id: item.product_id,
        quantity: item.packages_qty * item.units_per_package,
      })),
    }),
  });

  if (!syncRes.ok) {
    const syncData = await syncRes.json().catch(() => ({}));
    throw new Error(syncData.error || labels.cartSyncError);
  }

  const res = await fetch("/api/v1/store/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      billing_address_id: billingAddressId,
      delivery_address_id: deliveryAddressId,
      billing_address: billingAddress,
      delivery_address: deliveryAddress,
      payment_method: "BANK_TRANSFER",
      customer_currency: displayCurrency || "TRY",
      recaptcha_token: recaptchaToken,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || labels.orderSubmitError);
  }

  return data.order_number;
}

function getFormattedTcmbDate(rawDate: string | undefined, lang: string): string {
  if (!rawDate) return "";
  try {
    const d = new Date(rawDate);
    const localeMap: Record<string, string> = {
      tr: "tr-TR",
      en: "en-US",
      ru: "ru-RU",
      ar: "ar-EG",
      de: "de-DE",
      pl: "pl-PL",
      bg: "bg-BG",
      fr: "fr-FR",
    };
    const locale = localeMap[lang] || "en-US";
    return d.toLocaleDateString(locale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return String(rawDate).split("T")[0] || "";
  }
}

function getTcmbDateNotice(formattedDate: string, lang: string): string {
  const notices: Record<string, string> = {
    tr: `* ${formattedDate} tarihli TCMB kur bilgileri baz alınmıştır. (TR/İstanbul saat dilimi esaslıdır)`,
    ru: `* Курсы основаны на официальной публикации ЦБ Турции (TCMB) от ${formattedDate} (по часовому поясу TR/Стамбул)`,
    ar: `* الأسعار تعتمد على النشرة الرسمية للبنك المركزي التركي (TCMB) بتاريخ ${formattedDate} (توقيت تركيا/إسطنبول)`,
    de: `* Die Kurse basieren auf der offiziellen Veröffentlichung der TCMB vom ${formattedDate} (TR/Istanbul-Zeitzone gilt)`,
    pl: `* Kursy oparte na oficjalnej publikacji Banku Centralnego Turcji (TCMB) z dnia ${formattedDate} (obowiązuje strefa czasowa TR/Stambuł)`,
    bg: `* Валутните курсове са базирани на официалната публикация на TCMB от ${formattedDate} (приложена е часовата зона TR/Истанбул)`,
    fr: `* Les taux de change sont basés sur la publication officielle de la TCMB du ${formattedDate} (fuseau horaire TR/Istanbul appliqué)`,
  };
  return notices[lang] || `* Rates based on official TCMB publication of ${formattedDate} (TR/Istanbul time-boundary applied)`;
}

interface CartItemCardProps {
  readonly item: CartItem;
  readonly idx: number;
  readonly lang: string;
  readonly displayCurrency: string;
  readonly exchangeRates: readonly ExchangeRate[];
  readonly onAdjustQty: (index: number, change: number) => void;
  readonly onRemove: (index: number) => void;
}

function CartItemCard({
  item,
  idx,
  lang,
  displayCurrency,
  exchangeRates,
  onAdjustQty,
  onRemove,
}: Readonly<CartItemCardProps>) {
  const isAuthenticated = useIsStoreAuthenticated();
  const itemTotalUnits = item.packages_qty * item.units_per_package;
  const rawItemPricePerUnit = item.price_per_unit;
  const rawItemTotalPrice = itemTotalUnits * rawItemPricePerUnit;

  let pricePerUnit = rawItemPricePerUnit;
  let itemTotalPrice = rawItemTotalPrice;
  let currency = displayCurrency || "TRY";

  if (displayCurrency && exchangeRates.length > 0) {
    pricePerUnit = convertPrice(rawItemPricePerUnit, item.currency || "TRY", displayCurrency, [...exchangeRates]);
    itemTotalPrice = convertPrice(rawItemTotalPrice, item.currency || "TRY", displayCurrency, [...exchangeRates]);
  } else {
    currency = item.currency || "TRY";
  }

  const title = item.title_translations?.[lang] || item.title;
  const labels = pickLangText(lang, CART_DRAWER_LABELS);
  const pieceUnit = t("piece", lang);
  const unitPriceSuffix = isAuthenticated ? ` x ${pricePerUnit.toFixed(2)} ${currency}` : "";

  return (
    <div className="border border-cultured bg-[#fafafa] rounded-[5px] p-3 flex gap-3 relative shadow-inner">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={getResizedImageUrl(item.image_url, 80, 106)}
        alt={item.title}
        className="w-14 h-18 object-cover rounded-[5px] bg-white border border-cultured"
      />

      <div className="flex-grow flex flex-col gap-1 pr-6">
        <h4 className="text-sm font-bold text-eerie-black line-clamp-2 leading-relaxed">
          {title}
        </h4>

        <span className="text-xs font-bold text-salmon-pink block">
          {t("color", lang)}: {item.color} | SKU: {item.custom_sku}
        </span>

        <div className="flex items-center gap-2 mt-1.5">
          <button
            type="button"
            onClick={() => onAdjustQty(idx, -1)}
            className="w-6 h-6 rounded-[5px] border border-cultured bg-white flex items-center justify-center font-bold text-xs cursor-pointer select-none active:scale-90"
          >
            −
          </button>
          <span className="text-sm font-bold text-onyx">
            {item.packages_qty} {labels.packUnit}
          </span>
          <button
            type="button"
            onClick={() => onAdjustQty(idx, 1)}
            className="w-6 h-6 rounded-[5px] border border-cultured bg-white flex items-center justify-center font-bold text-xs cursor-pointer select-none active:scale-90"
          >
            +
          </button>
        </div>

        <span className="text-xs font-semibold text-sonic-silver mt-1.5 block">
          {itemTotalUnits} {pieceUnit} ({item.units_per_package} {labels.pcsPerPack}){unitPriceSuffix}
        </span>
      </div>

      <div className="shrink-0 self-center font-extrabold text-sm text-eerie-black text-right pl-1">
        {isAuthenticated ? (
          `${itemTotalPrice.toFixed(2)} ${currency}`
        ) : (
          <button
            type="button"
            onClick={() => openStoreAuthModal("login")}
            className="inline-flex items-center gap-1 text-[10px] font-extrabold text-salmon-pink hover:underline bg-transparent border-none p-0 cursor-pointer"
          >
            <Lock className="w-2.5 h-2.5 shrink-0" />
            <span>{getShortMemberPriceLabel(lang)}</span>
          </button>
        )}
      </div>

      <button
        type="button"
        aria-label={labels.removeItemAria}
        onClick={() => onRemove(idx)}
        className="absolute top-2 right-2 border-none bg-transparent text-sonic-silver hover:text-salmon-pink cursor-pointer text-sm font-extrabold"
      >
        &times;
      </button>
    </div>
  );
}

interface CartCurrencyEquivalentsProps {
  readonly grandTotalInTRY: number;
  readonly exchangeRates: readonly ExchangeRate[];
  readonly lang: string;
}

function CartCurrencyEquivalents({
  grandTotalInTRY,
  exchangeRates,
  lang,
}: Readonly<CartCurrencyEquivalentsProps>) {
  const eqUSD = convertPrice(grandTotalInTRY, "TRY", "USD", [...exchangeRates]);
  const eqEUR = convertPrice(grandTotalInTRY, "TRY", "EUR", [...exchangeRates]);
  const eqGBP = convertPrice(grandTotalInTRY, "TRY", "GBP", [...exchangeRates]);
  const eqTRY = grandTotalInTRY;

  const ratesBanner = exchangeRates.length > 0
    ? exchangeRates.filter((r) => ["USD", "EUR", "GBP"].includes(r.currency_code.toUpperCase()))
    : [];

  const rawDate = exchangeRates.find((r) => r.publication_date)?.publication_date;
  const formattedDate = getFormattedTcmbDate(rawDate, lang);
  const dateInfo = getTcmbDateNotice(formattedDate, lang);

  return (
    <div className="mt-3 pt-3 border-t border-dashed border-cultured flex flex-col gap-2.5 select-none bg-white p-3 rounded-[8px] border">
      <div className="flex flex-col gap-1">
        <span className="text-xs uppercase font-extrabold text-sonic-silver tracking-[0.5px]">
          {t("exchange_rate_equivalents", lang)}
        </span>
        {ratesBanner.length > 0 && (
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold text-spanish-gray">
              {t("active_tcmb_rates", lang)}{" "}
              {ratesBanner.map((r, i) => (
                <span key={r.currency_code} className="font-bold text-sonic-silver">
                  {i > 0 && " | "}1 {r.currency_code} = {Number(r.buying_rate).toFixed(4)} TL
                </span>
              ))}
            </span>
            {formattedDate && (
              <span className="text-[9px] font-medium text-spanish-gray italic leading-normal">
                {dateInfo}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs font-extrabold text-onyx">
        <div className="flex items-center justify-between bg-[#fafafa] border border-cultured rounded p-2 shadow-inner">
          <span className="text-sonic-silver">🇹🇷 TRY:</span>
          <span className="text-eerie-black font-extrabold">{eqTRY.toFixed(2)} ₺</span>
        </div>
        <div className="flex items-center justify-between bg-[#fafafa] border border-cultured rounded p-2 shadow-inner">
          <span className="text-sonic-silver">🇺🇸 USD:</span>
          <span className="text-eerie-black font-extrabold">${eqUSD.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between bg-[#fafafa] border border-cultured rounded p-2 shadow-inner">
          <span className="text-sonic-silver">🇪🇺 EUR:</span>
          <span className="text-eerie-black font-extrabold">€{eqEUR.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between bg-[#fafafa] border border-cultured rounded p-2 shadow-inner">
          <span className="text-sonic-silver">🇬🇧 GBP:</span>
          <span className="text-eerie-black font-extrabold">£{eqGBP.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

interface CartTotalsSectionProps {
  readonly lang: string;
  readonly totalPkgs: number;
  readonly totalItemsCount: number;
  readonly totalWeight: number;
  readonly finalTotalPrice: number;
  readonly displayCurrency: string;
  readonly grandTotalInTRY: number;
  readonly exchangeRates: readonly ExchangeRate[];
}

function CartTotalsSection({
  lang,
  totalPkgs,
  totalItemsCount,
  totalWeight,
  finalTotalPrice,
  displayCurrency,
  grandTotalInTRY,
  exchangeRates,
}: Readonly<CartTotalsSectionProps>) {
  const isAuthenticated = useIsStoreAuthenticated();
  const labels = pickLangText(lang, CART_DRAWER_LABELS);
  const pieceUnit = t("piece", lang);
  return (
    <div className="border border-cultured bg-[#fafafa] p-4 rounded-[10px] flex flex-col gap-2.5 shadow-sm shrink-0">
      <div className="flex justify-between text-sm font-bold text-onyx">
        <span>{t("total_packages", lang)}:</span>
        <span className="text-eerie-black font-extrabold">{totalPkgs} {labels.packUnit}</span>
      </div>
      <div className="flex justify-between text-sm font-bold text-onyx">
        <span>{t("total_qty", lang)}:</span>
        <span className="text-eerie-black font-extrabold">{totalItemsCount} {pieceUnit}</span>
      </div>
      <div className="flex justify-between text-sm font-bold text-onyx">
        <span>{t("total_weight", lang)}:</span>
        <span className="text-eerie-black font-extrabold">{totalWeight.toFixed(2)} kg</span>
      </div>
      <div className="flex justify-between items-center text-base font-extrabold text-salmon-pink border-t border-cultured pt-2.5 mt-1 select-none">
        <span>{t("grand_total", lang)}:</span>
        {isAuthenticated ? (
          <span>{finalTotalPrice.toFixed(2)} {displayCurrency}</span>
        ) : (
          <button
            type="button"
            onClick={() => openStoreAuthModal("login")}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900 hover:bg-salmon-pink text-white text-xs font-extrabold transition-colors cursor-pointer border-none"
          >
            <Lock className="w-3 h-3 shrink-0" />
            <span>{getShortMemberPriceLabel(lang)}</span>
          </button>
        )}
      </div>

      {isAuthenticated && (
        <CartCurrencyEquivalents
          grandTotalInTRY={grandTotalInTRY}
          exchangeRates={exchangeRates}
          lang={lang}
        />
      )}
    </div>
  );
}

interface CartCheckoutFormProps {
  readonly lang: string;
  readonly token: string | null;
  readonly addresses: readonly UserAddress[];
  readonly deliveryAddr: string;
  readonly setDeliveryAddr: (val: string) => void;
  readonly billingAddr: string;
  readonly setBillingAddr: (val: string) => void;
  readonly sameAsDelivery: boolean;
  readonly setSameAsDelivery: (val: boolean) => void;
  readonly onAddressCreated: (createdId: string, kind: "shipping" | "billing") => Promise<void>;
  readonly defaultFirstName: string;
  readonly defaultLastName: string;
  readonly defaultPhone: string;
  readonly submittingOrder: boolean;
  readonly onBackToCart: () => void;
  readonly onSubmit: (e: React.FormEvent) => void;
}

function BankTransferInfo({ lang }: { readonly lang: string }) {
  const labels = pickLangText(lang, CART_DRAWER_LABELS);
  const directNotice = getDirectSellerNoticeCopy(lang);

  return (
    <div className="bg-[#F8F6F2] border border-[#E5E0D8] rounded-lg p-3.5 flex flex-col gap-2 text-xs text-[#1C1C1C] leading-normal">
      <div className="font-extrabold uppercase tracking-[0.5px] border-b border-[#E5E0D8] pb-1.5 text-[11px] text-[#1C1C1C]">
        {labels.bankTransferHeader}
      </div>
      <div className="text-[11px] font-bold text-[#1C1C1C] bg-white border border-[#E5E0D8] px-2.5 py-1.5 rounded">
        {labels.beneficiaryPrefix}: <span className="font-extrabold">{directNotice.directSellerTag}</span>
      </div>
      <p className="text-[11px] font-semibold text-[#525252] bg-white border border-[#E5E0D8] rounded px-2.5 py-2 leading-relaxed m-0">
        {labels.proformaIbanNotice}
      </p>
      <p className="text-[10.5px] font-semibold text-[#525252] leading-snug m-0">
        {directNotice.buyerNotice}
      </p>
      <div className="text-[10px] font-semibold text-[#525252] italic border-t border-[#E5E0D8] pt-1.5 leading-snug">
        {labels.paymentReferenceNote}
      </div>
    </div>
  );
}

function CartCheckoutForm({
  lang,
  token,
  addresses,
  deliveryAddr,
  setDeliveryAddr,
  billingAddr,
  setBillingAddr,
  sameAsDelivery,
  setSameAsDelivery,
  onAddressCreated,
  defaultFirstName,
  defaultLastName,
  defaultPhone,
  submittingOrder,
  onBackToCart,
  onSubmit,
}: Readonly<CartCheckoutFormProps>) {
  const labels = pickLangText(lang, CART_DRAWER_LABELS);

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 pt-4 border-t border-cultured mt-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs uppercase font-extrabold text-salmon-pink tracking-[0.5px]">
          {labels.addressPaymentHeader}
        </h4>
        <button
          type="button"
          onClick={onBackToCart}
          className="text-xs font-bold text-sonic-silver hover:text-salmon-pink bg-transparent border-none cursor-pointer"
        >
          &larr; {labels.backToCart}
        </button>
      </div>

      <StructuredCheckoutAddressPicker
        label={labels.deliveryAddress}
        icon={<span aria-hidden="true">🚚</span>}
        addressType="shipping"
        lang={lang}
        token={token}
        addresses={addresses}
        selectedAddressId={deliveryAddr}
        onSelectAddressId={setDeliveryAddr}
        onAddressCreated={(id) => onAddressCreated(id, "shipping")}
        defaultFirstName={defaultFirstName}
        defaultLastName={defaultLastName}
        defaultPhone={defaultPhone}
      />

      <label className="flex items-center gap-2 text-xs font-bold text-eerie-black cursor-pointer select-none py-1">
        <input
          type="checkbox"
          checked={sameAsDelivery}
          onChange={(e) => setSameAsDelivery(e.target.checked)}
          className="w-4 h-4 rounded accent-salmon-pink cursor-pointer"
        />
        <span>{getLocalizedDrawerNote(SAME_BILLING_LABELS, lang)}</span>
      </label>

      {!sameAsDelivery && (
        <StructuredCheckoutAddressPicker
          label={labels.billingAddress}
          icon={<span aria-hidden="true">📄</span>}
          addressType="billing"
          lang={lang}
          token={token}
          addresses={addresses}
          selectedAddressId={billingAddr}
          onSelectAddressId={setBillingAddr}
          onAddressCreated={(id) => onAddressCreated(id, "billing")}
          defaultFirstName={defaultFirstName}
          defaultLastName={defaultLastName}
          defaultPhone={defaultPhone}
        />
      )}

      <BankTransferInfo lang={lang} />

      <p className="text-[10px] font-semibold text-[#525252] bg-[#FAF8F5] border border-[#E5E0D8] rounded px-2.5 py-2 leading-snug m-0">
        {getDirectSellerNoticeCopy(lang).buyerNotice}
      </p>

      <p className="text-[10px] font-medium text-neutral-500 text-center leading-snug m-0">
        {getRecaptchaLegalNotice(lang)}
      </p>

      <button
        type="submit"
        disabled={submittingOrder}
        className="w-full py-3.5 bg-salmon-pink hover:bg-eerie-black text-white rounded-[5px] font-extrabold text-sm tracking-[0.5px] uppercase shadow-sm border-none flex items-center justify-center gap-2 cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed mt-1 active:scale-[0.99] transition-colors duration-300"
      >
        {submittingOrder ? (
          <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
        ) : (
          `✔️ ${labels.confirmB2bOrder}`
        )}
      </button>
    </form>
  );
}

interface CartInquiryFormProps {
  readonly lang: string;
  readonly token: string | null;
  readonly fullName: string;
  readonly setFullName: (val: string) => void;
  readonly companyName: string;
  readonly setCompanyName: (val: string) => void;
  readonly phoneNumber: string;
  readonly setPhoneNumber: (val: string) => void;
  readonly emailAddress: string;
  readonly setEmailAddress: (val: string) => void;
  readonly inquiryLocation: StructuredLocationValue;
  readonly setInquiryLocation: (val: StructuredLocationValue) => void;
  readonly setInquiryLocMeta: (meta: StructuredLocationMeta) => void;
  readonly customerMessage: string;
  readonly setCustomerMessage: (val: string) => void;
  readonly submittingInquiry: boolean;
  readonly onGoToCheckout: () => void;
  readonly onSubmit: (e: React.FormEvent) => void;
}

function CartInquiryForm({
  lang,
  token,
  fullName,
  setFullName,
  companyName,
  setCompanyName,
  phoneNumber,
  setPhoneNumber,
  emailAddress,
  setEmailAddress,
  inquiryLocation,
  setInquiryLocation,
  setInquiryLocMeta,
  customerMessage,
  setCustomerMessage,
  submittingInquiry,
  onGoToCheckout,
  onSubmit,
}: Readonly<CartInquiryFormProps>) {
  const labels = pickLangText(lang, CART_DRAWER_LABELS);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3.5 pt-4 border-t border-cultured mt-2">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase font-extrabold text-eerie-black tracking-[0.5px]">
          {labels.requestQuoteFormTitle}
        </span>
        {token && (
          <button
            type="button"
            onClick={onGoToCheckout}
            className="text-[10px] font-bold text-salmon-pink bg-transparent border-none cursor-pointer"
          >
            &larr; {labels.goToCheckout}
          </button>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs uppercase font-extrabold text-eerie-black tracking-[0.5px]">{t("full_name", lang)}</label>
        <input
          type="text"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full px-3.5 py-2.5 bg-white border border-cultured rounded-[5px] text-sm font-semibold focus:outline-none focus:border-salmon-pink focus:ring-salmon-pink transition-all shadow-sm text-eerie-black"
          placeholder={t("placeholder_full_name", lang)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs uppercase font-extrabold text-eerie-black tracking-[0.5px]">{t("company_name", lang)}</label>
        <input
          type="text"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          className="w-full px-3.5 py-2.5 bg-white border border-cultured rounded-[5px] text-sm font-semibold focus:outline-none focus:border-salmon-pink focus:ring-salmon-pink transition-all shadow-sm text-eerie-black"
          placeholder={t("placeholder_company_name", lang)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs uppercase font-extrabold text-eerie-black tracking-[0.5px]">{t("phone", lang)}</label>
        <input
          type="tel"
          required
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          className="w-full px-3.5 py-2.5 bg-white border border-cultured rounded-[5px] text-sm font-semibold focus:outline-none focus:border-salmon-pink focus:ring-salmon-pink transition-all shadow-sm text-eerie-black"
          placeholder={t("placeholder_phone", lang)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs uppercase font-extrabold text-eerie-black tracking-[0.5px]">{t("email", lang)}</label>
        <input
          type="email"
          required
          value={emailAddress}
          onChange={(e) => setEmailAddress(e.target.value)}
          className="w-full px-3.5 py-2.5 bg-white border border-cultured rounded-[5px] text-sm font-semibold focus:outline-none focus:border-salmon-pink focus:ring-salmon-pink transition-all shadow-sm text-eerie-black"
          placeholder={t("placeholder_email", lang)}
        />
      </div>

      <StructuredLocationFields
        lang={lang}
        value={inquiryLocation}
        onChange={setInquiryLocation}
        onMetaChange={setInquiryLocMeta}
        showPostalCode={false}
        compact
        disabled={submittingInquiry}
      />

      <div className="flex flex-col gap-1">
        <label className="text-xs uppercase font-extrabold text-eerie-black tracking-[0.5px]">{t("message", lang)}</label>
        <textarea
          value={customerMessage}
          onChange={(e) => setCustomerMessage(e.target.value)}
          className="w-full px-3.5 py-2.5 bg-white border border-cultured rounded-[5px] text-sm font-semibold focus:outline-none focus:border-salmon-pink focus:ring-salmon-pink transition-all shadow-sm resize-none h-14 text-eerie-black"
          placeholder={t("placeholder_message", lang)}
        />
      </div>

      <p className="text-[10px] font-semibold text-[#525252] bg-[#FAF8F5] border border-[#E5E0D8] rounded px-2.5 py-2 leading-snug m-0">
        {getDirectSellerNoticeCopy(lang).buyerNotice}
      </p>

      <p className="text-[10px] font-medium text-neutral-500 text-center leading-snug m-0">
        {getRecaptchaLegalNotice(lang)}
      </p>

      <button
        type="submit"
        disabled={submittingInquiry}
        className="w-full py-3.5 bg-salmon-pink hover:bg-eerie-black text-white rounded-[5px] font-extrabold text-sm tracking-[0.5px] uppercase shadow-sm border-none flex items-center justify-center gap-2 cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed mt-1 active:scale-[0.99] transition-colors duration-300"
      >
        {submittingInquiry ? (
          <div className="spinner w-4 h-4 border-2" />
        ) : (
          "🚀 " + t("submit_inquiry", lang)
        )}
      </button>
    </form>
  );
}

export default function CartDrawer({
  lang,
  cart,
  onClose,
  onAdjustQty,
  onRemove,
  totalPkgs,
  totalItemsCount,
  totalWeight,
  submittingInquiry,
  onSubmitInquiry,
  displayCurrency = "TRY",
  exchangeRates = [],
}: Readonly<CartDrawerProps>) {
  const [fullName, setFullName] = React.useState<string>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = JSON.parse(localStorage.getItem("store_user_info") || "{}");
        return [stored.first_name, stored.last_name].filter(Boolean).join(" ");
      } catch {
        return "";
      }
    }
    return "";
  });
  const [companyName, setCompanyName] = React.useState<string>("");
  const [phoneNumber, setPhoneNumber] = React.useState<string>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = JSON.parse(localStorage.getItem("store_user_info") || "{}");
        return stored.phone || "";
      } catch {
        return "";
      }
    }
    return "";
  });
  const [emailAddress, setEmailAddress] = React.useState<string>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = JSON.parse(localStorage.getItem("store_user_info") || "{}");
        return stored.email || "";
      } catch {
        return "";
      }
    }
    return "";
  });
  const [customerMessage, setCustomerMessage] = React.useState<string>("");
  const [inquiryLocation, setInquiryLocation] = React.useState<StructuredLocationValue>({
    countryId: "",
    stateId: "",
    cityId: "",
    addressLine: "",
    postalCode: "",
  });
  const [inquiryLocMeta, setInquiryLocMeta] = React.useState<StructuredLocationMeta>({
    countryCode: "TR",
    countryPhoneCode: 90,
    countryName: "",
    stateName: "",
    cityName: "",
    hasStates: true,
    hasCities: true,
    loadingStates: false,
    loadingCities: false,
  });

  const handleInquirySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmitInquiry({
      fullName,
      companyName,
      phoneNumber,
      emailAddress,
      customerMessage,
      countryId: inquiryLocation.countryId,
      stateId: inquiryLocation.stateId,
      cityId: inquiryLocation.cityId,
      postalCode: inquiryLocation.postalCode,
      addressLine: inquiryLocation.addressLine,
      locationMeta: inquiryLocMeta,
    });
  };
  const [isCheckout, setIsCheckout] = React.useState(false);
  const [forceShowInquiry, setForceShowInquiry] = React.useState(false);
  const [addresses, setAddresses] = React.useState<UserAddress[]>([]);
  const [billingAddr, setBillingAddr] = React.useState("");
  const [deliveryAddr, setDeliveryAddr] = React.useState("");
  const [sameAsDelivery, setSameAsDelivery] = React.useState(true);
  const [submittingOrder, setSubmittingOrder] = React.useState(false);

  const token = typeof window !== "undefined" ? localStorage.getItem("store_user_token") : null;
  const userDefaults = readStoredCheckoutDefaults();

  React.useEffect(() => {
    if (token && isCheckout) {
      fetchSavedUserAddresses(token)
        .then((data) => {
          setAddresses(data);
          selectDefaultAddresses(data, setBillingAddr, setDeliveryAddr);
        })
        .catch((err) => console.error("Error fetching addresses:", err));
    }
  }, [token, isCheckout]);

  const handleAddressCreated = async (createdId: string, kind: "shipping" | "billing") => {
    if (!token) return;
    const latest = await fetchSavedUserAddresses(token);
    setAddresses(latest);
    if (kind === "shipping") {
      setDeliveryAddr(createdId);
      if (!billingAddr) {
        setBillingAddr(createdId);
      }
      return;
    }
    setBillingAddr(createdId);
  };

  const labels = pickLangText(lang, CART_DRAWER_LABELS);

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    const effectiveBillingId = sameAsDelivery ? deliveryAddr : billingAddr;
    const delObj = addresses.find((a) => a.id === deliveryAddr);
    const billObj = addresses.find((a) => a.id === effectiveBillingId);

    if (!delObj || !billObj || !isAddressRecordComplete(delObj) || !isAddressRecordComplete(billObj)) {
      showToast(getLocalizedDrawerNote(INCOMPLETE_ADDRESS_LABELS, lang));
      return;
    }

    const finalDelivery = formatCheckoutAddressDisplay(delObj);
    const finalBilling = formatCheckoutAddressDisplay(billObj);

    setSubmittingOrder(true);
    try {
      const recaptchaToken = await executeRecaptchaAction("create_order", lang);
      const orderNumber = await submitB2BOrder({
        token,
        cart,
        deliveryAddressId: deliveryAddr,
        billingAddressId: effectiveBillingId,
        billingAddress: finalBilling,
        deliveryAddress: finalDelivery,
        recaptchaToken,
        lang,
        displayCurrency,
      });

      const successNotice = labels.orderSuccessToast.replace("{orderNo}", orderNumber);

      showToast(successNotice);
      persistStoreCart([], { immediate: true });
      onClose();
      const profileQuery = lang && lang !== "tr" ? `?tab=orders&lang=${encodeURIComponent(lang)}` : "?tab=orders";
      window.location.href = `/profile${profileQuery}`;
    } catch (err: unknown) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : labels.networkError;
      showToast(errMsg);
    } finally {
      setSubmittingOrder(false);
    }
  };

  const handleOpenInquiryFromLoggedIn = () => {
    if (typeof window !== "undefined") {
      try {
        const stored = JSON.parse(localStorage.getItem("store_user_info") || "{}");
        const fullNameVal = [stored.first_name, stored.last_name].filter(Boolean).join(" ");
        if (fullNameVal) setFullName(fullName || fullNameVal);
        if (stored.email) setEmailAddress(emailAddress || stored.email);
        if (stored.phone) setPhoneNumber(phoneNumber || stored.phone);
      } catch {
        // ignore parse error
      }
    }
    setIsCheckout(false);
    setForceShowInquiry(true);
  };

  const grandTotalInTRY = cart.reduce((sum, item) => {
    const itemTotalUnits = item.packages_qty * item.units_per_package;
    const itemPriceInOrig = itemTotalUnits * item.price_per_unit;
    const itemPriceInTRY = convertPrice(itemPriceInOrig, item.currency || "TRY", "TRY", [...exchangeRates]);
    return sum + itemPriceInTRY;
  }, 0);

  const finalTotalPrice = convertPrice(grandTotalInTRY, "TRY", displayCurrency, [...exchangeRates]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-end">
      <button
        type="button"
        aria-label={t("close", lang)}
        tabIndex={-1}
        className="fixed inset-0 bg-transparent border-none cursor-default"
        onClick={onClose}
      />

      <div className="bg-white border-l border-cultured w-full max-w-md h-full flex flex-col shadow-premium relative z-10 animate-in slide-in-from-right duration-300 ease-out select-none">
        <div className="p-4 border-b border-cultured flex items-center justify-between shrink-0">
          <h3 className="font-sans font-extrabold text-lg tracking-[0.5px] text-eerie-black flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-salmon-pink" />
            {t("cart_title", lang)}
          </h3>
          <button
            type="button"
            aria-label={t("close", lang)}
            onClick={onClose}
            className="w-8 h-8 rounded-[5px] bg-[#fafafa] hover:bg-cultured border border-cultured flex items-center justify-center text-onyx cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-grow overflow-y-auto p-4 flex flex-col gap-4">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center text-sonic-silver">
              <div className="w-14 h-14 rounded-full bg-[#F8F6F2] border border-[#E5E0D8] flex items-center justify-center mb-4">
                <ShoppingBag className="w-6 h-6 text-[#1C1C1C]" />
              </div>
              <p className="text-sm font-bold text-[#1C1C1C]">{t("empty_cart", lang)}</p>
              <p className="text-xs font-medium mt-1.5 max-w-[280px] text-[#525252] leading-relaxed">
                {t("empty_cart_tip", lang)}
              </p>
              <Link
                href={`/${getCategoryPrefix(lang)}/tum-urunler`}
                onClick={onClose}
                className="mt-5 inline-flex items-center justify-center px-5 py-2.5 bg-[#1C1C1C] hover:bg-[#333333] text-white rounded-md text-xs font-bold uppercase tracking-wider no-underline transition-colors"
              >
                {t("portal_explore_all_collections", lang)}
              </Link>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3">
                {cart.map((item, idx) => (
                  <CartItemCard
                    key={`${item.product_id}-${item.custom_sku || idx}`}
                    item={item}
                    idx={idx}
                    lang={lang}
                    displayCurrency={displayCurrency}
                    exchangeRates={exchangeRates}
                    onAdjustQty={onAdjustQty}
                    onRemove={onRemove}
                  />
                ))}
              </div>

              <div className="flex justify-between items-center py-2 px-1 border-b border-cultured shrink-0 mt-1 select-none">
                <span className="text-xs font-bold text-sonic-silver">
                  {cart.length} {labels.itemsVariety}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    window.location.href = `/${getCategoryPrefix(lang)}/cart`;
                  }}
                  className="px-4 py-2 bg-salmon-pink text-white hover:bg-eerie-black rounded-[5px] font-extrabold text-[11px] uppercase transition-all duration-200 cursor-pointer active:scale-[0.98] flex items-center gap-1.5 shadow-sm border-none"
                >
                  <span>🛒</span>
                  <span>{t("go_to_cart", lang)}</span>
                </button>
              </div>

              <div className="flex flex-col gap-2.5">
                <CartTotalsSection
                  lang={lang}
                  totalPkgs={totalPkgs}
                  totalItemsCount={totalItemsCount}
                  totalWeight={totalWeight}
                  finalTotalPrice={finalTotalPrice}
                  displayCurrency={displayCurrency}
                  grandTotalInTRY={grandTotalInTRY}
                  exchangeRates={exchangeRates}
                />

                {token && !isCheckout && (
                  <div className="flex flex-col gap-3 pt-4 border-t border-cultured mt-2">
                    <button
                      type="button"
                      onClick={() => setIsCheckout(true)}
                      className="w-full py-3.5 bg-salmon-pink hover:bg-eerie-black text-white rounded-[5px] font-extrabold text-sm tracking-[0.5px] uppercase shadow-sm border-none flex items-center justify-center gap-2 cursor-pointer select-none active:scale-[0.99] transition-colors duration-300"
                    >
                      💳 {labels.orderViaBankTransfer}
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenInquiryFromLoggedIn}
                      className="w-full py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-[5px] font-bold text-xs uppercase border-none flex items-center justify-center gap-2 cursor-pointer select-none transition-colors"
                    >
                      📄 {labels.requestProformaOnly}
                    </button>
                  </div>
                )}

                {token && isCheckout && (
                  <CartCheckoutForm
                    lang={lang}
                    token={token}
                    addresses={addresses}
                    deliveryAddr={deliveryAddr}
                    setDeliveryAddr={setDeliveryAddr}
                    billingAddr={billingAddr}
                    setBillingAddr={setBillingAddr}
                    sameAsDelivery={sameAsDelivery}
                    setSameAsDelivery={setSameAsDelivery}
                    onAddressCreated={handleAddressCreated}
                    defaultFirstName={userDefaults.firstName}
                    defaultLastName={userDefaults.lastName}
                    defaultPhone={userDefaults.phone}
                    submittingOrder={submittingOrder}
                    onBackToCart={() => {
                      setIsCheckout(false);
                      setForceShowInquiry(false);
                    }}
                    onSubmit={handleCheckoutSubmit}
                  />
                )}

                {(!token || forceShowInquiry) && (
                  <CartInquiryForm
                    lang={lang}
                    token={token}
                    fullName={fullName}
                    setFullName={setFullName}
                    companyName={companyName}
                    setCompanyName={setCompanyName}
                    phoneNumber={phoneNumber}
                    setPhoneNumber={setPhoneNumber}
                    emailAddress={emailAddress}
                    setEmailAddress={setEmailAddress}
                    inquiryLocation={inquiryLocation}
                    setInquiryLocation={setInquiryLocation}
                    setInquiryLocMeta={setInquiryLocMeta}
                    customerMessage={customerMessage}
                    setCustomerMessage={setCustomerMessage}
                    submittingInquiry={submittingInquiry}
                    onGoToCheckout={() => {
                      setForceShowInquiry(false);
                      setIsCheckout(false);
                    }}
                    onSubmit={handleInquirySubmit}
                  />
                )}

                {!token && (
                  <div className="mt-4 p-3 bg-zinc-50 border border-zinc-200/60 rounded-lg text-center text-xs font-semibold text-zinc-600 select-none">
                    {labels.registeredDealerPrompt}{" "}
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        window.dispatchEvent(new CustomEvent("merter-open-auth", { detail: { mode: "login" } }));
                      }}
                      className="text-salmon-pink font-extrabold hover:underline bg-transparent border-none cursor-pointer"
                    >
                      {labels.signInBtn}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
