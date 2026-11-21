"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Building2,
  ShieldCheck,
  Phone,
  Mail,
  Globe,
  MapPin,
  MessageCircle,
  CreditCard,
  CheckCircle2,
  Send,
  FileText,
} from "lucide-react";
import { Brand, Product } from "@/types/store";
import { normalizeWhatsappDigits, showToast, trackBrandEvent, trackWhatsappClick } from "@/app/utils";
import {
  useIsStoreAuthenticated,
  useIsStoreMemberLoggedIn,
} from "@/app/storeAuth";
import { normalizeSeoLang, SupportedSeoLang } from "@/utils/seoHelpers";
import { formatAsciiSafeUpper } from "@/utils/formatters";
import InstagramIcon from "@/components/shared/InstagramIcon";
import {
  formatBrandInstagramLabel,
  formatBrandInstagramUrl,
  formatBrandLocationLine,
  formatBrandWebsiteLabel,
  formatBrandWebsiteUrl,
} from "@/utils/brandContactHelpers";
import { isProductWhatsappOnly, getWhatsappOrderingCopy } from "@/utils/whatsappOrdering";

function normalizeWaPhone(raw?: string): string {
  return normalizeWhatsappDigits(raw);
}

interface SupplierCardCopy {
  readonly defaultSupplier: string;
  readonly verifiedBadge: string;
  readonly zeroCommission: string;
  readonly showcaseLink: string;
  readonly privateLabel: string;
  readonly fason: string;
  readonly exportLabel: string;
  readonly bankTitle: string;
  readonly bankLabel: string;
  readonly holderLabel: string;
  readonly whatsappBtn: string;
  readonly directFormBtn: string;
  readonly liveChatBtn: string;
  readonly liveChatMemberBtn: string;
  readonly formTitleSuffix: string;
  readonly closeBtn: string;
  readonly formHint: string;
  readonly fullNamePlaceholder: string;
  readonly phonePlaceholder: string;
  readonly companyPlaceholder: string;
  readonly notesPlaceholder: (pkg: number, pcs: number) => string;
  readonly submittedNotice: (orderNo: string, supplier: string) => string;
  readonly sendingBtn: string;
  readonly submitBtn: string;
  readonly validationMsg: string;
  readonly sentToast: (supplier: string) => string;
  readonly errorToast: string;
  readonly networkToast: string;
  readonly waAuthenticated: (
    supplier: string,
    title: string,
    sku: string,
    pkg: number,
    pcs: number,
    total: string,
    curr: string
  ) => string;
  readonly waGuest: (
    supplier: string,
    title: string,
    sku: string,
    pkg: number,
    pcs: number
  ) => string;
  readonly companyTypes: Record<string, string>;
}

const SUPPLIER_CARD_COPY: Record<SupportedSeoLang, SupplierCardCopy> = {
  tr: {
    defaultSupplier: "Merter Üreticisi",
    verifiedBadge: "Doğrulanmış Üretici",
    zeroCommission: "%0 Komisyon Doğrudan Tedarikçi İletişimi",
    showcaseLink: "Firma Vitrini →",
    privateLabel: "Private Label (Özel Etiket)",
    fason: "Fason Üretim",
    exportLabel: "İhracat",
    bankTitle: "Tedarikçi Doğrudan Havale / EFT Bilgisi:",
    bankLabel: "Banka",
    holderLabel: "Alıcı",
    whatsappBtn: "WhatsApp ile Doğrudan Tedarikçiye Yaz",
    directFormBtn: "Doğrudan İletişim Formu",
    liveChatBtn: "Canlı B2B Sohbet",
    liveChatMemberBtn: "Canlı Sohbet (Üyelere Özel)",
    formTitleSuffix: "Doğrudan Firma İletişim & Sipariş Formu",
    closeBtn: "Kapat",
    formHint:
      "Bilgilerinizi bırakın; talebiniz doğrudan üreticinin paneline düşsün ve WhatsApp hattına yönlendirilsin.",
    fullNamePlaceholder: "Adınız Soyadınız *",
    phonePlaceholder: "Telefon / WhatsApp No *",
    companyPlaceholder: "Firma / Butik Adınız (Opsiyonel)",
    notesPlaceholder: (pkg, pcs) =>
      `Mesajınız (${pkg} Seri / ${pcs} Adet için renk, beden veya özel üretim sorunuz)...`,
    submittedNotice: (orderNo, supplier) =>
      `✓ Talebiniz (${orderNo}) doğrudan ${supplier} firmasına iletildi!`,
    sendingBtn: "Tedarikçiye İletiliyor...",
    submitBtn: "Doğrudan Tedarikçiye Gönder & WhatsApp Başlat",
    validationMsg: "Lütfen Ad Soyad ve Telefon/WhatsApp numaranızı girin.",
    sentToast: (supplier) => `Talebiniz doğrudan ${supplier} tedarikçisine iletildi!`,
    errorToast: "Mesaj gönderilirken bir hata oluştu.",
    networkToast: "Bağlantı hatası oluştu.",
    waAuthenticated: (supplier, title, sku, pkg, pcs, total, curr) =>
      `Merhaba *${supplier}*,\nMerter Vitrini üzerindeki *${title}* (SKU: ${sku}) ürününüz hakkında doğrudan sipariş vermek istiyorum.\n\n• Miktar: ${pkg} Seri (${pcs} Adet)\n• Toplam Tutar: ${total} ${curr}`,
    waGuest: (supplier, title, sku, pkg, pcs) =>
      `Merhaba *${supplier}*,\nMerter Vitrini üzerindeki *${title}* (SKU: ${sku}) ürününüz hakkında doğrudan fiyat bilgisi almak istiyorum.\n\n• Miktar: ${pkg} Seri (${pcs} Adet)`,
    companyTypes: {
      uretici_toptanci: "Üretici & Toptan Satış",
      private_label: "Özel Etiket (Private Label) Üreticisi",
      fason_atolye: "Fason Üretim Atölyesi",
      kumas_tedarikcisi: "Kumaş Üreticisi & Tedarikçisi",
      aksesuar: "Tekstil Aksesuar & Yan Sanayi",
    },
  },
  en: {
    defaultSupplier: "Merter Manufacturer",
    verifiedBadge: "Verified Factory",
    zeroCommission: "0% Commission Direct Manufacturer Contact",
    showcaseLink: "Factory Showroom →",
    privateLabel: "Private Label (OEM)",
    fason: "Contract Manufacturing",
    exportLabel: "Exports",
    bankTitle: "Manufacturer Direct Wire / IBAN Details:",
    bankLabel: "Bank",
    holderLabel: "Beneficiary",
    whatsappBtn: "Message Manufacturer Directly on WhatsApp",
    directFormBtn: "Direct Inquiry Form",
    liveChatBtn: "Live B2B Chat",
    liveChatMemberBtn: "Live Chat (Members Only)",
    formTitleSuffix: "Direct Factory Inquiry & Order Form",
    closeBtn: "Close",
    formHint:
      "Leave your contact details; your inquiry goes straight to the factory dashboard and opens WhatsApp.",
    fullNamePlaceholder: "Full Name *",
    phonePlaceholder: "Phone / WhatsApp Number *",
    companyPlaceholder: "Company / Boutique Name (Optional)",
    notesPlaceholder: (pkg, pcs) =>
      `Your message (${pkg} Packs / ${pcs} Pcs — color, size ratio, or private label questions)...`,
    submittedNotice: (orderNo, supplier) =>
      `✓ Your inquiry (${orderNo}) has been sent directly to ${supplier}!`,
    sendingBtn: "Sending to Manufacturer...",
    submitBtn: "Send to Manufacturer & Open WhatsApp",
    validationMsg: "Please enter your full name and phone/WhatsApp number.",
    sentToast: (supplier) => `Your inquiry was sent directly to ${supplier}!`,
    errorToast: "An error occurred while sending your inquiry.",
    networkToast: "Network connection error.",
    waAuthenticated: (supplier, title, sku, pkg, pcs, total, curr) =>
      `Hello *${supplier}*,\nI would like to place a wholesale order for *${title}* (SKU: ${sku}) on Merter Vitrini.\n\n• Quantity: ${pkg} Packs (${pcs} Pcs)\n• Estimated Total: ${total} ${curr}`,
    waGuest: (supplier, title, sku, pkg, pcs) =>
      `Hello *${supplier}*,\nI would like wholesale pricing details for *${title}* (SKU: ${sku}) on Merter Vitrini.\n\n• Quantity: ${pkg} Packs (${pcs} Pcs)`,
    companyTypes: {
      uretici_toptanci: "Manufacturer & Wholesaler",
      private_label: "Private Label (OEM) Manufacturer",
      fason_atolye: "Contract Sewing Workshop",
      kumas_tedarikcisi: "Fabric Mill & Supplier",
      aksesuar: "Textile Accessories & Trims",
    },
  },
  ru: {
    defaultSupplier: "Фабрика Мертер",
    verifiedBadge: "Проверенная фабрика",
    zeroCommission: "0% комиссии — Прямая связь с производителем",
    showcaseLink: "Витрина фабрики →",
    privateLabel: "Private Label (Свой бренд)",
    fason: "Пошив на заказ",
    exportLabel: "Экспорт",
    bankTitle: "Реквизиты фабрики для прямого перевода (IBAN):",
    bankLabel: "Банк",
    holderLabel: "Получатель",
    whatsappBtn: "Написать напрямую фабрике в WhatsApp",
    directFormBtn: "Прямая заявка фабрике",
    liveChatBtn: "Онлайн B2B-чат",
    liveChatMemberBtn: "Онлайн-чат (для участников)",
    formTitleSuffix: "Прямая форма заказа и связи с фабрикой",
    closeBtn: "Закрыть",
    formHint:
      "Оставьте контакты — заявка поступит напрямую в кабинет фабрики и откроется диалог в WhatsApp.",
    fullNamePlaceholder: "Имя и Фамилия *",
    phonePlaceholder: "Телефон / WhatsApp *",
    companyPlaceholder: "Компания / Магазин (необязательно)",
    notesPlaceholder: (pkg, pcs) =>
      `Ваш комментарий (${pkg} серий / ${pcs} шт. — цвета, размеры, карго)...`,
    submittedNotice: (orderNo, supplier) =>
      `✓ Заявка (${orderNo}) отправлена напрямую фабрике ${supplier}!`,
    sendingBtn: "Отправка фабрике...",
    submitBtn: "Отправить фабрике и открыть WhatsApp",
    validationMsg: "Пожалуйста, укажите имя и номер телефона / WhatsApp.",
    sentToast: (supplier) => `Заявка отправлена напрямую фабрике ${supplier}!`,
    errorToast: "Ошибка при отправке сообщения.",
    networkToast: "Ошибка соединения с сетью.",
    waAuthenticated: (supplier, title, sku, pkg, pcs, total, curr) =>
      `Здравствуйте, *${supplier}*!\nХочу оформить оптовый заказ на модель *${title}* (SKU: ${sku}) через Merter Vitrini.\n\n• Количество: ${pkg} серий (${pcs} шт.)\n• Сумма: ${total} ${curr}`,
    waGuest: (supplier, title, sku, pkg, pcs) =>
      `Здравствуйте, *${supplier}*!\nИнтересует оптовая цена на модель *${title}* (SKU: ${sku}) на Merter Vitrini.\n\n• Количество: ${pkg} серий (${pcs} шт.)`,
    companyTypes: {
      uretici_toptanci: "Производитель и оптовый поставщик",
      private_label: "Фабрика Private Label (СТМ)",
      fason_atolye: "Швейное производство на заказ",
      kumas_tedarikcisi: "Производитель и поставщик тканей",
      aksesuar: "Текстильная фурнитура",
    },
  },
  ar: {
    defaultSupplier: "مصنع مارتر",
    verifiedBadge: "مصنع معتمد",
    zeroCommission: "بدون عمولة 0% — تواصل مباشر مع المصنع",
    showcaseLink: "واجهة المصنع ←",
    privateLabel: "تصنيع خاص (Private Label)",
    fason: "تصنيع تعاقدي للغير",
    exportLabel: "التصدير",
    bankTitle: "بيانات التحويل البنكي المباشر للمصنع (IBAN):",
    bankLabel: "البنك",
    holderLabel: "المستفيد",
    whatsappBtn: "تواصل مع المصنع مباشرة عبر واتساب",
    directFormBtn: "نموذج طلب مباشر",
    liveChatBtn: "دردشة B2B مباشرة",
    liveChatMemberBtn: "دردشة مباشرة (للأعضاء)",
    formTitleSuffix: "نموذج الطلب والتواصل المباشر مع المصنع",
    closeBtn: "إغلاق",
    formHint: "أدخل بياناتك ليصل طلبك مباشرة إلى لوحة المصنع ويتم فتح محادثة واتساب.",
    fullNamePlaceholder: "الاسم الكامل *",
    phonePlaceholder: "رقم الهاتف / واتساب *",
    companyPlaceholder: "اسم الشركة / البوتيك (اختياري)",
    notesPlaceholder: (pkg, pcs) =>
      `رسالتك (${pkg} باكت / ${pcs} قطعة — استفسار عن الألوان أو المقاسات أو الشحن)...`,
    submittedNotice: (orderNo, supplier) =>
      `✓ تم إرسال طلبك (${orderNo}) مباشرة إلى مصنع ${supplier}!`,
    sendingBtn: "جاري الإرسال للمصنع...",
    submitBtn: "إرسال للمصنع وفتح واتساب",
    validationMsg: "يرجى إدخال الاسم ورقم الهاتف / واتساب.",
    sentToast: (supplier) => `تم إرسال طلبك مباشرة إلى ${supplier}!`,
    errorToast: "حدث خطأ أثناء إرسال الرسالة.",
    networkToast: "خطأ في الاتصال بالشبكة.",
    waAuthenticated: (supplier, title, sku, pkg, pcs, total, curr) =>
      `مرحباً *${supplier}*،\nأرغب في طلب منتج *${title}* (SKU: ${sku}) بالجملة عبر Merter Vitrini.\n\n• الكمية: ${pkg} باكت (${pcs} قطعة)\n• الإجمالي: ${total} ${curr}`,
    waGuest: (supplier, title, sku, pkg, pcs) =>
      `مرحباً *${supplier}*،\nأرغب في معرفة سعر الجملة لمنتج *${title}* (SKU: ${sku}) عبر Merter Vitrini.\n\n• الكمية: ${pkg} باكت (${pcs} قطعة)`,
    companyTypes: {
      uretici_toptanci: "مصنع وتاجر جملة",
      private_label: "مصنع علامات خاصة (Private Label)",
      fason_atolye: "ورشة خياطة وتصنيع تعاقدي",
      kumas_tedarikcisi: "مصنع ومورد أقمشة",
      aksesuar: "إكسسوارات ومستلزمات النسيج",
    },
  },
  de: {
    defaultSupplier: "Merter Hersteller",
    verifiedBadge: "Geprüfter Hersteller",
    zeroCommission: "0% Provision — Direkter Herstellerkontakt",
    showcaseLink: "Herstellerprofil →",
    privateLabel: "Private Label (Eigenmarke)",
    fason: "Lohnfertigung",
    exportLabel: "Export",
    bankTitle: "Direkte Bankverbindung des Herstellers (IBAN):",
    bankLabel: "Bank",
    holderLabel: "Empfänger",
    whatsappBtn: "Hersteller direkt per WhatsApp kontaktieren",
    directFormBtn: "Direktes Anfrageformular",
    liveChatBtn: "Live-B2B-Chat",
    liveChatMemberBtn: "Live-Chat (Nur Mitglieder)",
    formTitleSuffix: "Direktes Kontakt- & Bestellformular",
    closeBtn: "Schließen",
    formHint:
      "Hinterlassen Sie Ihre Daten; Ihre Anfrage geht direkt an den Hersteller und öffnet WhatsApp.",
    fullNamePlaceholder: "Vor- und Nachname *",
    phonePlaceholder: "Telefon / WhatsApp-Nr. *",
    companyPlaceholder: "Firma / Boutique (Optional)",
    notesPlaceholder: (pkg, pcs) =>
      `Ihre Nachricht (${pkg} Serien / ${pcs} Stück — Farben, Größen oder Private Label)...`,
    submittedNotice: (orderNo, supplier) =>
      `✓ Ihre Anfrage (${orderNo}) wurde direkt an ${supplier} gesendet!`,
    sendingBtn: "Wird gesendet...",
    submitBtn: "Direkt an Hersteller senden & WhatsApp starten",
    validationMsg: "Bitte geben Sie Ihren Namen und Ihre Telefon-/WhatsApp-Nummer ein.",
    sentToast: (supplier) => `Anfrage direkt an ${supplier} übermittelt!`,
    errorToast: "Beim Senden ist ein Fehler aufgetreten.",
    networkToast: "Netzwerkfehler aufgetreten.",
    waAuthenticated: (supplier, title, sku, pkg, pcs, total, curr) =>
      `Hallo *${supplier}*,\nich möchte *${title}* (SKU: ${sku}) über Merter Vitrini im Großhandel bestellen.\n\n• Menge: ${pkg} Serien (${pcs} Stück)\n• Gesamtbetrag: ${total} ${curr}`,
    waGuest: (supplier, title, sku, pkg, pcs) =>
      `Hallo *${supplier}*,\nich bitte um Großhandelspreise für *${title}* (SKU: ${sku}) auf Merter Vitrini.\n\n• Menge: ${pkg} Serien (${pcs} Stück)`,
    companyTypes: {
      uretici_toptanci: "Hersteller & Großhändler",
      private_label: "Private-Label-Hersteller",
      fason_atolye: "Lohnfertigungsbetrieb",
      kumas_tedarikcisi: "Stoffhersteller & Lieferant",
      aksesuar: "Textilzubehör & Kurzwaren",
    },
  },
  fr: {
    defaultSupplier: "Fabricant Merter",
    verifiedBadge: "Fabricant Vérifié",
    zeroCommission: "0% Commission — Contact Direct Usine",
    showcaseLink: "Vitrine Usine →",
    privateLabel: "Marque Blanche (Private Label)",
    fason: "Façonnage Textile",
    exportLabel: "Export",
    bankTitle: "Coordonnées Bancaires Directes du Fabricant (IBAN) :",
    bankLabel: "Banque",
    holderLabel: "Bénéficiaire",
    whatsappBtn: "Écrire directement au fabricant sur WhatsApp",
    directFormBtn: "Formulaire de Contact Direct",
    liveChatBtn: "Chat B2B en Direct",
    liveChatMemberBtn: "Chat en Direct (Membres)",
    formTitleSuffix: "Formulaire Direct de Commande & Devis",
    closeBtn: "Fermer",
    formHint:
      "Laissez vos coordonnées ; votre demande est transmise directement au fabricant et ouvre WhatsApp.",
    fullNamePlaceholder: "Nom et Prénom *",
    phonePlaceholder: "Téléphone / WhatsApp *",
    companyPlaceholder: "Société / Boutique (Optionnel)",
    notesPlaceholder: (pkg, pcs) =>
      `Votre message (${pkg} Séries / ${pcs} Pièces — coloris, tailles ou marque blanche)...`,
    submittedNotice: (orderNo, supplier) =>
      `✓ Votre demande (${orderNo}) a été envoyée directement à ${supplier} !`,
    sendingBtn: "Envoi en cours...",
    submitBtn: "Envoyer au fabricant & Ouvrir WhatsApp",
    validationMsg: "Veuillez renseigner votre nom et votre numéro WhatsApp/téléphone.",
    sentToast: (supplier) => `Demande transmise directement à ${supplier} !`,
    errorToast: "Une erreur est survenue lors de l'envoi.",
    networkToast: "Erreur de connexion réseau.",
    waAuthenticated: (supplier, title, sku, pkg, pcs, total, curr) =>
      `Bonjour *${supplier}*,\nJe souhaite commander en gros *${title}* (SKU: ${sku}) via Merter Vitrini.\n\n• Quantité : ${pkg} Séries (${pcs} Pièces)\n• Total : ${total} ${curr}`,
    waGuest: (supplier, title, sku, pkg, pcs) =>
      `Bonjour *${supplier}*,\nJe souhaite connaître vos tarifs de gros pour *${title}* (SKU: ${sku}) sur Merter Vitrini.\n\n• Quantité : ${pkg} Séries (${pcs} Pièces)`,
    companyTypes: {
      uretici_toptanci: "Fabricant & Grossiste",
      private_label: "Fabricant Marque Blanche",
      fason_atolye: "Atelier de Façonnage",
      kumas_tedarikcisi: "Fournisseur de Tissus",
      aksesuar: "Accessoires Textiles",
    },
  },
  pl: {
    defaultSupplier: "Producent Merter",
    verifiedBadge: "Zweryfikowany Producent",
    zeroCommission: "0% Prowizji — Bezpośredni Kontakt z Fabryką",
    showcaseLink: "Wizytówka Firmy →",
    privateLabel: "Private Label (Własna Marka)",
    fason: "Szycie Kontraktowe",
    exportLabel: "Eksport",
    bankTitle: "Bezpośrednie Dane Bankowe Producenta (IBAN):",
    bankLabel: "Bank",
    holderLabel: "Odbiorca",
    whatsappBtn: "Napisz bezpośrednio do producenta na WhatsApp",
    directFormBtn: "Formularz Bezpośredni",
    liveChatBtn: "Czat B2B na Żywo",
    liveChatMemberBtn: "Czat na Żywo (Dla Członków)",
    formTitleSuffix: "Bezpośredni Formularz Kontaktowy i Zamówienia",
    closeBtn: "Zamknij",
    formHint:
      "Zostaw swoje dane — zapytanie trafi bezpośrednio do panelu producenta i otworzy WhatsApp.",
    fullNamePlaceholder: "Imię i Nazwisko *",
    phonePlaceholder: "Telefon / WhatsApp *",
    companyPlaceholder: "Firma / Butik (Opcjonalnie)",
    notesPlaceholder: (pkg, pcs) =>
      `Twoja wiadomość (${pkg} pakietów / ${pcs} szt. — kolory, rozmiary lub Private Label)...`,
    submittedNotice: (orderNo, supplier) =>
      `✓ Zapytanie (${orderNo}) zostało wysłane bezpośrednio do ${supplier}!`,
    sendingBtn: "Wysyłanie do producenta...",
    submitBtn: "Wyślij do producenta i otwórz WhatsApp",
    validationMsg: "Podaj imię i nazwisko oraz numer telefonu/WhatsApp.",
    sentToast: (supplier) => `Zapytanie wysłane bezpośrednio do ${supplier}!`,
    errorToast: "Wystąpił błąd podczas wysyłania wiadomości.",
    networkToast: "Błąd połączenia sieciowego.",
    waAuthenticated: (supplier, title, sku, pkg, pcs, total, curr) =>
      `Dzień dobry *${supplier}*,\nChcę złożyć zamówienie hurtowe na *${title}* (SKU: ${sku}) przez Merter Vitrini.\n\n• Ilość: ${pkg} pakietów (${pcs} szt.)\n• Suma: ${total} ${curr}`,
    waGuest: (supplier, title, sku, pkg, pcs) =>
      `Dzień dobry *${supplier}*,\nProszę o ofertę hurtową na *${title}* (SKU: ${sku}) z Merter Vitrini.\n\n• Ilość: ${pkg} pakietów (${pcs} szt.)`,
    companyTypes: {
      uretici_toptanci: "Producent i Hurtownia",
      private_label: "Producent Private Label",
      fason_atolye: "Szwalnia Kontraktowa",
      kumas_tedarikcisi: "Producent i Dostawca Tkanin",
      aksesuar: "Akcesoria Krawieckie",
    },
  },
  bg: {
    defaultSupplier: "Производител Мертер",
    verifiedBadge: "Проверен производител",
    zeroCommission: "0% Комисиона — Директен контакт с фабриката",
    showcaseLink: "Профил на фабриката →",
    privateLabel: "Private Label (Собствена марка)",
    fason: "Ишлеме производство",
    exportLabel: "Износ",
    bankTitle: "Директна банкова сметка на производителя (IBAN):",
    bankLabel: "Банка",
    holderLabel: "Титуляр",
    whatsappBtn: "Пишете директно на фабриката в WhatsApp",
    directFormBtn: "Директна форма за запитване",
    liveChatBtn: "B2B Чат на живо",
    liveChatMemberBtn: "Чат на живо (За членове)",
    formTitleSuffix: "Директна форма за поръчка и запитване",
    closeBtn: "Затвори",
    formHint:
      "Оставете данните си; запитването отива директно при производителя и отваря WhatsApp.",
    fullNamePlaceholder: "Име и Фамилия *",
    phonePlaceholder: "Телефон / WhatsApp *",
    companyPlaceholder: "Фирма / Бутик (По избор)",
    notesPlaceholder: (pkg, pcs) =>
      `Вашето съобщение (${pkg} серии / ${pcs} бр. — цветове, размери или ишлеме)...`,
    submittedNotice: (orderNo, supplier) =>
      `✓ Запитването (${orderNo}) е изпратено директно до ${supplier}!`,
    sendingBtn: "Изпращане...",
    submitBtn: "Изпрати до фабриката и отвори WhatsApp",
    validationMsg: "Моля, въведете име и телефон / WhatsApp номер.",
    sentToast: (supplier) => `Запитването е изпратено директно до ${supplier}!`,
    errorToast: "Възникна грешка при изпращането.",
    networkToast: "Грешка при връзката.",
    waAuthenticated: (supplier, title, sku, pkg, pcs, total, curr) =>
      `Здравейте *${supplier}*,\nИскам да поръчам на едро *${title}* (SKU: ${sku}) през Merter Vitrini.\n\n• Количество: ${pkg} серии (${pcs} бр.)\n• Общо: ${total} ${curr}`,
    waGuest: (supplier, title, sku, pkg, pcs) =>
      `Здравейте *${supplier}*,\nИнтересувам се от цена на едро за *${title}* (SKU: ${sku}) в Merter Vitrini.\n\n• Количество: ${pkg} серии (${pcs} бр.)`,
    companyTypes: {
      uretici_toptanci: "Производител и търговец на едро",
      private_label: "Производител Private Label",
      fason_atolye: "Шивашки цех на ишлеме",
      kumas_tedarikcisi: "Производител на платове",
      aksesuar: "Текстилни аксесоари",
    },
  },
};

function computeNumericUnitPrice(
  product: Product,
  totalPieces: number,
  totalPrice: number | string
): number {
  if (totalPieces > 0) {
    const parsedTotal = typeof totalPrice === "number" ? totalPrice : Number(totalPrice) || 0;
    return parsedTotal / totalPieces;
  }
  if (product.discounted_price && product.discounted_price > 0) {
    return product.discounted_price;
  }
  return product.price || 0;
}

interface SupplierDirectCardProps {
  readonly product: Product;
  readonly pkgQty: number;
  readonly totalPieces: number;
  readonly totalPrice: number | string;
  readonly currency: string;
  readonly lang?: string;
  readonly onOpenChat: () => void;
}

export default function SupplierDirectCard({
  product,
  pkgQty,
  totalPieces,
  totalPrice,
  currency,
  lang = "tr",
  onOpenChat,
}: Readonly<SupplierDirectCardProps>) {
  const safeLang = normalizeSeoLang(lang, "tr");
  const copy = SUPPLIER_CARD_COPY[safeLang];
  const isAuthenticated = useIsStoreAuthenticated();
  const isMemberLoggedIn = useIsStoreMemberLoggedIn();
  const bp: Brand | undefined = product.brand_profile;
  const isWhatsappOnly = isProductWhatsappOnly(product);
  const waCopy = getWhatsappOrderingCopy(safeLang);
  const supplierName = bp?.name || product.brand_name || copy.defaultSupplier;
  const waRaw = bp?.whatsapp_phone || bp?.phone || "";
  const callRaw = bp?.phone || bp?.whatsapp_phone || "";
  const waDigits = normalizeWaPhone(waRaw);
  const companyTypeKey = bp?.company_type || "uretici_toptanci";
  const companyTypeLabel =
    copy.companyTypes[companyTypeKey] || copy.companyTypes.uretici_toptanci;
  const formattedTotalPrice =
    typeof totalPrice === "number"
      ? (Number.isFinite(totalPrice) ? totalPrice : 0).toFixed(2)
      : String(totalPrice || "0.00");
  const numericUnitPrice = computeNumericUnitPrice(product, totalPieces, totalPrice);

  const skuCode = product.custom_sku || "-";
  const localizedProdTitle =
    product.translations?.[safeLang]?.title || product.title;

  const directWaMessage =
    !isWhatsappOnly && isAuthenticated
      ? copy.waAuthenticated(
          supplierName,
          localizedProdTitle,
          skuCode,
          pkgQty,
          totalPieces,
          formattedTotalPrice,
          currency
        )
      : copy.waGuest(supplierName, localizedProdTitle, skuCode, pkgQty, totalPieces);

  const directWaUrl = waDigits
    ? `https://wa.me/${waDigits}?text=${encodeURIComponent(directWaMessage)}`
    : "";

  const supplierSlug = encodeURIComponent(bp?.slug || product.brand_id);
  const supplierHref =
    safeLang === "tr"
      ? `/ureticiler/${supplierSlug}`
      : `/ureticiler/${supplierSlug}?lang=${safeLang}`;

  const [showContactForm, setShowContactForm] = useState(false);
  const [fullName, setFullName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [notes, setNotes] = useState("");
  const [sendingForm, setSendingForm] = useState(false);
  const [submittedOrderNo, setSubmittedOrderNo] = useState<string | null>(null);

  const handleSendDirectInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !buyerPhone.trim()) {
      showToast(copy.validationMsg);
      return;
    }
    setSendingForm(true);
    try {
      const res = await fetch("/api/v1/store/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName.trim(),
          phone: buyerPhone.trim(),
          company_name: companyName.trim(),
          notes:
            notes.trim() ||
            `${localizedProdTitle} (${pkgQty} Pack / ${totalPieces} Pcs)`,
          currency: currency || "TRY",
          lang: safeLang,
          items: [
            {
              product_id: product.id,
              title: localizedProdTitle,
              custom_sku: product.custom_sku || "",
              series_ratio: product.series_ratio || "1",
              quantity: pkgQty || 1,
              price: numericUnitPrice,
            },
          ],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSubmittedOrderNo(data.order_number || "OK");
        showToast(copy.sentToast(supplierName));
        if (data.whatsapp_url) {
          trackWhatsappClick({
            brandId: product.brand_id,
            productId: product.id,
            sourceSurface: "product_direct_inquiry",
            targetPhone: waRaw,
          });
          window.open(data.whatsapp_url, "_blank", "noopener,noreferrer");
        }
      } else {
        showToast(copy.errorToast);
      }
    } catch {
      showToast(copy.networkToast);
    } finally {
      setSendingForm(false);
    }
  };

  return (
    <div className="rounded-lg border border-[#E5E0D8] bg-[#F8F6F2] p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-md bg-[#1C1C1C] text-white flex items-center justify-center shrink-0">
            <Building2 size={18} />
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Link
                href={supplierHref}
                className="text-xs font-extrabold text-[#1C1C1C] hover:text-[#8C6D3F] tracking-wide no-underline transition-colors"
              >
                {formatAsciiSafeUpper(supplierName)}
              </Link>
              {(bp?.is_verified ?? true) && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-[#15803D] border border-emerald-200 text-[10px] font-bold">
                  <ShieldCheck size={11} />
                  <span>{copy.verifiedBadge}</span>
                </span>
              )}
              {isWhatsappOnly && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0] text-[10px] font-bold">
                  <MessageCircle size={11} />
                  <span>{waCopy.supplierBadge}</span>
                </span>
              )}
            </div>
            <p className="text-[11px] font-semibold text-[#525252]">
              {companyTypeLabel} • {copy.zeroCommission}
            </p>
          </div>
        </div>

        <Link
          href={supplierHref}
          className="px-2.5 py-1 rounded-md bg-white hover:bg-[#EFECE6] border border-[#D6D1C7] hover:border-[#1C1C1C] text-[10px] font-extrabold text-[#1C1C1C] no-underline shrink-0 transition-colors"
        >
          {copy.showcaseLink}
        </Link>
      </div>

      {(bp?.supports_private_label || bp?.supports_fason || bp?.export_countries) && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {bp?.supports_private_label && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-[#E5E0D8] text-[10px] font-bold text-[#1C1C1C]">
              <CheckCircle2 size={11} className="text-[#15803D]" />
              <span>{copy.privateLabel}</span>
            </span>
          )}
          {bp?.supports_fason && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-[#E5E0D8] text-[10px] font-bold text-[#1C1C1C]">
              <CheckCircle2 size={11} className="text-[#15803D]" />
              <span>{copy.fason}</span>
            </span>
          )}
          {bp?.export_countries && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-[#E5E0D8] text-[10px] font-semibold text-[#525252]">
              <span>
                {copy.exportLabel}: {bp.export_countries}
              </span>
            </span>
          )}
        </div>
      )}

      {bp?.description && (
        <p className="text-[11px] text-[#525252] leading-relaxed">{bp.description}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[#1C1C1C] pt-1">
        {waRaw && directWaUrl && (
          <div className="flex items-center gap-1.5">
            <MessageCircle size={13} className="text-[#15803D] shrink-0" />
            <a
              href={directWaUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                trackWhatsappClick({
                  brandId: product.brand_id,
                  productId: product.id,
                  sourceSurface: "product_supplier_card_inline",
                  targetPhone: waRaw,
                })
              }
              className="font-extrabold hover:underline no-underline text-[#15803D]"
            >
              WhatsApp: {waRaw}
            </a>
          </div>
        )}

        {callRaw && (
          <div className="flex items-center gap-1.5">
            <Phone size={13} className="text-[#8C6D3F] shrink-0" />
            <a
              href={`tel:${callRaw}`}
              onClick={() => trackBrandEvent(product.brand_id, "phone_click", product.id)}
              className="font-bold hover:text-[#8C6D3F] no-underline text-[#1C1C1C]"
            >
              Tel: {callRaw}
            </a>
          </div>
        )}

        {bp?.landline_phone && bp.landline_phone !== callRaw && (
          <div className="flex items-center gap-1.5">
            <Phone size={13} className="text-[#8C6D3F] shrink-0" />
            <a
              href={`tel:${bp.landline_phone}`}
              onClick={() => trackBrandEvent(product.brand_id, "phone_click", product.id)}
              className="font-bold hover:text-[#8C6D3F] no-underline text-[#1C1C1C]"
            >
              Sabit: {bp.landline_phone}
            </a>
          </div>
        )}

        {bp?.public_email && (
          <div className="flex items-center gap-1.5">
            <Mail size={13} className="text-[#8C6D3F] shrink-0" />
            <a
              href={`mailto:${bp.public_email}`}
              onClick={() => trackBrandEvent(product.brand_id, "email_click", product.id)}
              className="font-semibold hover:text-[#8C6D3F] no-underline text-[#525252] truncate"
            >
              {bp.public_email}
            </a>
          </div>
        )}

        {formatBrandWebsiteUrl(bp?.website) && (
          <div className="flex items-center gap-1.5">
            <Globe size={13} className="text-[#8C6D3F] shrink-0" />
            <a
              href={formatBrandWebsiteUrl(bp?.website)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackBrandEvent(product.brand_id, "website_click", product.id)}
              className="font-semibold hover:text-[#8C6D3F] no-underline text-[#525252] truncate"
            >
              {formatBrandWebsiteLabel(bp?.website)}
            </a>
          </div>
        )}

        {formatBrandInstagramUrl(bp?.instagram_handle) && (
          <div className="flex items-center gap-1.5">
            <InstagramIcon size={13} className="text-rose-600 shrink-0" />
            <a
              href={formatBrandInstagramUrl(bp?.instagram_handle)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackBrandEvent(product.brand_id, "website_click", product.id)}
              className="font-bold hover:text-rose-700 no-underline text-[#1C1C1C] truncate"
            >
              {formatBrandInstagramLabel(bp?.instagram_handle)}
            </a>
          </div>
        )}

        {(bp?.location_address || bp?.city || bp?.district) && (
          <div className="flex items-start gap-1.5 sm:col-span-2">
            <MapPin size={13} className="text-[#8C6D3F] shrink-0 mt-0.5" />
            <span className="text-[11px] text-[#525252]">
              {formatBrandLocationLine(bp?.location_address, bp?.district, bp?.city)}
            </span>
          </div>
        )}
      </div>

      {bp?.iban && (
        <div className="bg-white rounded-md p-2.5 border border-[#E5E0D8] text-[11px] space-y-0.5">
          <div className="font-bold text-[#1C1C1C] flex items-center gap-1.5">
            <CreditCard size={12} className="text-[#8C6D3F]" />
            <span>{copy.bankTitle}</span>
          </div>
          {bp.bank_name && (
            <div className="text-[#525252]">
              {copy.bankLabel}: <strong className="text-[#1C1C1C]">{bp.bank_name}</strong>
              {bp.bank_account_holder
                ? ` • ${copy.holderLabel}: ${bp.bank_account_holder}`
                : ""}
            </div>
          )}
          <div className="font-mono font-bold text-[#1C1C1C] select-all">{bp.iban}</div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
        {directWaUrl && (
          <a
            href={directWaUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              trackWhatsappClick({
                brandId: product.brand_id,
                productId: product.id,
                sourceSurface: "product_supplier_card",
                targetPhone: waRaw,
              })
            }
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-md bg-[#15803D] hover:bg-[#166534] text-white text-xs font-extrabold transition-colors no-underline sm:col-span-2"
          >
            <MessageCircle size={16} />
            <span>
              {copy.whatsappBtn} {waRaw ? `(${waRaw})` : ""}
            </span>
          </a>
        )}

        <button
          type="button"
          onClick={() => setShowContactForm((prev) => !prev)}
          className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-white hover:bg-[#EFECE6] text-[#1C1C1C] border border-[#D6D1C7] hover:border-[#1C1C1C] text-xs font-extrabold transition-colors cursor-pointer ${
            isMemberLoggedIn ? "" : "sm:col-span-2"
          }`}
        >
          <FileText size={14} className="text-[#8C6D3F]" />
          <span>{copy.directFormBtn}</span>
        </button>

        {isMemberLoggedIn && (
          <button
            type="button"
            onClick={onOpenChat}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-[#1C1C1C] hover:bg-[#333333] text-white text-xs font-extrabold transition-colors cursor-pointer"
          >
            <Building2 size={14} />
            <span>{copy.liveChatBtn}</span>
          </button>
        )}
      </div>

      {showContactForm && (
        <form
          onSubmit={handleSendDirectInquiry}
          className="bg-white rounded-lg border border-[#E5E0D8] p-3.5 space-y-2.5 mt-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-[#1C1C1C]">
              {formatAsciiSafeUpper(supplierName)} — {copy.formTitleSuffix}
            </span>
            <button
              type="button"
              onClick={() => setShowContactForm(false)}
              className="text-[11px] font-bold text-[#6B6B6B] hover:text-[#1C1C1C] cursor-pointer"
            >
              {copy.closeBtn}
            </button>
          </div>
          <p className="text-[11px] text-[#525252]">{copy.formHint}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={copy.fullNamePlaceholder}
              className="px-3 py-2 rounded-md border border-[#D6D1C7] text-xs focus:outline-none focus:border-[#1C1C1C]"
            />
            <input
              type="tel"
              required
              value={buyerPhone}
              onChange={(e) => setBuyerPhone(e.target.value)}
              placeholder={copy.phonePlaceholder}
              className="px-3 py-2 rounded-md border border-[#D6D1C7] text-xs focus:outline-none focus:border-[#1C1C1C]"
            />
          </div>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder={copy.companyPlaceholder}
            className="w-full px-3 py-2 rounded-md border border-[#D6D1C7] text-xs focus:outline-none focus:border-[#1C1C1C]"
          />
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={copy.notesPlaceholder(pkgQty, totalPieces)}
            className="w-full px-3 py-2 rounded-md border border-[#D6D1C7] text-xs focus:outline-none focus:border-[#1C1C1C]"
          />
          {submittedOrderNo && (
            <div className="text-[11px] font-bold text-[#15803D] bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
              {copy.submittedNotice(submittedOrderNo, supplierName)}
            </div>
          )}
          <button
            type="submit"
            disabled={sendingForm}
            className="w-full py-2.5 rounded-md bg-[#1C1C1C] hover:bg-[#333333] disabled:opacity-50 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            <Send size={13} />
            <span>{sendingForm ? copy.sendingBtn : copy.submitBtn}</span>
          </button>
        </form>
      )}
    </div>
  );
}
