"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User, Settings, MapPin, Clipboard, Check, AlertCircle, Home, LogOut, Plus, Trash2, Edit3, Globe, Briefcase, ChevronDown, ChevronUp, Download, CreditCard, XCircle, RotateCcw } from "lucide-react";
import { t } from "@/app/i18n";
import { Category, CartItem } from "@/types/store";
import { apiFetch, getResizedImageUrl, showToast } from "@/app/utils";

// Custom Instagram SVG Icon to avoid older lucide-react import issues
const Instagram = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

// Reuse global storefront components
import Header from "@/components/store/Header";
import Footer from "@/components/store/Footer";

const addressTranslations: Record<string, Record<string, string>> = {
  tr: {
    address_book_header: "4. ADRES DEFTERİM",
    add_new_address: "Yeni Adres Ekle",
    edit_address: "Adresi Düzenle",
    delete_address: "Adresi Sil",
    address_title_label: "Adres Başlığı (Örn: Merkez Ofis, Depo)",
    address_type_label: "Adres Tipi",
    billing_address: "Fatura Adresi",
    shipping_address: "Sevk / Teslimat Adresi",
    country_label: "Ülke",
    state_label: "Şehir / İl / Eyalet",
    city_label: "İlçe / Kasaba",
    address_line_label: "Açık Adres",
    tax_office_label: "Vergi Dairesi",
    default_address_label: "Varsayılan adres olarak ayarla",
    no_addresses_found: "Kayıtlı adresiniz bulunmamaktadır.",
    address_delete_confirm: "Bu adresi silmek istediğinize emin misiniz?",
    legacy_migration_notice: "Profilinizde eski tip adres bilgileri bulundu. Bu bilgileri yeni adres defterinize otomatik kaydetmek ister misiniz?",
    migrate_addresses_btn: "Adreslerimi Taşı",
    address_title_placeholder: "Örn: İstanbul Depo",
    tax_no_tckn_label: "Vergi No / TCKN",
    company_name_label: "Firma / Şirket Unvanı",
    first_name_label: "Alıcı Adı",
    last_name_label: "Alıcı Soyadı",
    phone_label: "Alıcı Telefon Numarası",
    save_address_btn: "Adresi Kaydet",
    cancel_btn: "Vazgeç",
    loading_addresses: "Adresler yükleniyor...",
    migration_success: "Eski adresleriniz yeni adres defterinize başarıyla taşındı!",
    default_badge: "Varsayılan",
    address_line_placeholder: "Mahalle, sokak, bina numarası, daire, kat ve diğer detaylar...",
    tax_office_placeholder: "Örn: Merter Vergi Dairesi",
    postal_code_label: "Posta Kodu *",
    postal_code_placeholder: "Örn: 34000",
    postal_code_required_error: "Posta kodu alanı zorunludur.",
    phone_invalid_error: "Telefon numarası geçersizdir.",
    phone_tr_length_error: "Türkiye telefon numaraları 10 haneli olmalıdır (Örn: 5051234567).",
    phone_intl_length_error: "Telefon numarası 6 ile 15 hane arasında olmalıdır.",
    country_required_error: "Lütfen önce bir ülke seçiniz.",
  },
  en: {
    address_book_header: "4. MY ADDRESS BOOK",
    add_new_address: "Add New Address",
    edit_address: "Edit Address",
    delete_address: "Delete Address",
    address_title_label: "Address Title (e.g., Main Office, Warehouse)",
    address_type_label: "Address Type",
    billing_address: "Billing Address",
    shipping_address: "Shipping / Delivery Address",
    country_label: "Country",
    state_label: "City / State / Province",
    city_label: "City / Town / Sub-district",
    address_line_label: "Full Address",
    tax_office_label: "Tax Office",
    default_address_label: "Set as default address",
    no_addresses_found: "You have no saved addresses.",
    address_delete_confirm: "Are you sure you want to delete this address?",
    legacy_migration_notice: "Legacy address details were found in your profile. Would you like to automatically migrate them to your new Address Book?",
    migrate_addresses_btn: "Migrate My Addresses",
    address_title_placeholder: "e.g., London Warehouse",
    tax_no_tckn_label: "Tax ID / SSN",
    company_name_label: "Company / Corporate Name",
    first_name_label: "Recipient First Name",
    last_name_label: "Recipient Last Name",
    phone_label: "Recipient Phone Number",
    save_address_btn: "Save Address",
    cancel_btn: "Cancel",
    loading_addresses: "Loading addresses...",
    migration_success: "Your legacy addresses have been migrated successfully!",
    default_badge: "Default",
    address_line_placeholder: "Street address, building name, apartment, unit, floor and other details...",
    tax_office_placeholder: "e.g., London Central Tax Office",
    postal_code_label: "Postal Code *",
    postal_code_placeholder: "e.g., 90210",
    postal_code_required_error: "Postal code is required.",
    phone_invalid_error: "Invalid phone number.",
    phone_tr_length_error: "Turkish phone numbers must be 10 digits (e.g., 5051234567).",
    phone_intl_length_error: "Phone number must be between 6 and 15 digits.",
    country_required_error: "Please select a country first.",
  },
  ar: {
    address_book_header: "4. دفتر العناوين الخاص بي",
    add_new_address: "إضافة عنوان جديد",
    edit_address: "تعديل العنوان",
    delete_address: "حذف العنوان",
    address_title_label: "عنوان العنوان (مثال: المكتب الرئيسي، المستودع)",
    address_type_label: "نوع العنوان",
    billing_address: "عنوان الفاتورة",
    shipping_address: "عنوان الشحن / التسليم",
    country_label: "البلد",
    state_label: "المدينة / الولاية / المقاطعة",
    city_label: "المدينة / البلدة / المنطقة الفرعية",
    address_line_label: "العنوان الكامل",
    tax_office_label: "المكتب الضريبي",
    default_address_label: "تعيين كعنوان افتراضي",
    no_addresses_found: "ليس لديك عناوين محفوظة.",
    address_delete_confirm: "هل أنت متأكد من رغبتك في حذف هذا العنوان؟",
    legacy_migration_notice: "تم العثور على تفاصيل عنوان قديمة في ملفك الشخصي. هل ترغب في نقلها تلقائيًا إلى دفتر العناوين الجديد؟",
    migrate_addresses_btn: "نقل عناويني",
    address_title_placeholder: "مثال: مستودع دبي",
    tax_no_tckn_label: "الرقم الضريبي / الهوية الوطنية",
    company_name_label: "اسم الشركة / المؤسسة",
    first_name_label: "اسم المستلم الأول",
    last_name_label: "اسم عائلة المستلم",
    phone_label: "رقم هاتف المستلم",
    save_address_btn: "حفظ العنوان",
    cancel_btn: "إلغاء",
    loading_addresses: "جاري تحميل العناوين...",
    migration_success: "تم نقل عناوينك القديمة بنجاح!",
    default_badge: "افتراضي",
    address_line_placeholder: "عنوان الشارع، اسم المبنى، الشقة، الوحدة، الطابق وتفاصيل أخرى...",
    tax_office_placeholder: "مثال: مكتب ضرائب دبي المركزي",
    postal_code_label: "الرمز البريدي *",
    postal_code_placeholder: "مثال: 12345",
    postal_code_required_error: "الرمز البريدي مطلوب.",
    phone_invalid_error: "رقم الهاتف غير صالحة.",
    phone_tr_length_error: "يجب أن يتكون رقم الهاتف التركي من 10 أرقام (مثال: 5051234567).",
    phone_intl_length_error: "يجب أن يتكون رقم الهاتف من 6 إلى 15 رقمًا.",
    country_required_error: "يرجى تحديد البلد أولاً.",
  },
  ru: {
    address_book_header: "4. МОЯ АДРЕСНАЯ КНИГА",
    add_new_address: "Добавить новый адрес",
    edit_address: "Редактировать адрес",
    delete_address: "Удалить адрес",
    address_title_label: "Название адреса (например, Главный офис, Склад)",
    address_type_label: "Тип адреса",
    billing_address: "Адрес выставления счета",
    shipping_address: "Адрес доставки / отправки",
    country_label: "Страна",
    state_label: "Город / Область / Провинция",
    city_label: "Город / Населенный пункт",
    address_line_label: "Полный адрес",
    tax_office_label: "Налоговая инспекция",
    default_address_label: "Сделать адресом по умолчанию",
    no_addresses_found: "У вас нет сохраненных адресов.",
    address_delete_confirm: "Вы уверены, что хотите удалить этот адрес?",
    legacy_migration_notice: "В вашем профиле обнаружены устаревшие адреса. Хотите автоматически перенести их в новую адресную книгу?",
    migrate_addresses_btn: "Перенести мои адреса",
    address_title_placeholder: "например, Склад Москва",
    tax_no_tckn_label: "ИНН / Налоговый номер",
    company_name_label: "Название компании / фирмы",
    first_name_label: "Имя получателя",
    last_name_label: "Фамилия получателя",
    phone_label: "Телефонный номер получателя",
    save_address_btn: "Сохранить адрес",
    cancel_btn: "Отмена",
    loading_addresses: "Загрузка адресов...",
    migration_success: "Ваши прежние адреса были успешно перенесены!",
    default_badge: "По умолчанию",
    address_line_placeholder: "Улица, название дома, квартира, номер офиса, этаж и другие детали...",
    tax_office_placeholder: "например, Налоговая инспекция №4",
    postal_code_label: "Почтовый индекс *",
    postal_code_placeholder: "например, 101000",
    postal_code_required_error: "Почтовый индекс обязателен для заполнения.",
    phone_invalid_error: "Неверный номер телефона.",
    phone_tr_length_error: "Турецкие телефонные номера должны состоять из 10 цифр (например, 5051234567).",
    phone_intl_length_error: "Номер телефона должен содержать от 6 до 15 цифр.",
    country_required_error: "Пожалуйста, сначала выберите страну.",
  },
  pl: {
    address_book_header: "4. MOJA KSIĄŻKA ADRESOWA",
    add_new_address: "Dodaj nowy adres",
    edit_address: "Edytuj adres",
    delete_address: "Usuń adres",
    address_title_label: "Nazwa adresu (np. Główne biuro, Magazyn)",
    address_type_label: "Typ adresu",
    billing_address: "Adres do faktury",
    shipping_address: "Adres do wysyłki / dostawy",
    country_label: "Kraj",
    state_label: "Miasto / Województwo",
    city_label: "Miasto / Miejscowość",
    address_line_label: "Pełny adres",
    tax_office_label: "Urząd skarbowy",
    default_address_label: "Ustaw jako domyślny adres",
    no_addresses_found: "Brak zapisanych adresów.",
    address_delete_confirm: "Czy na pewno chcesz usunąć ten adres?",
    legacy_migration_notice: "W Twoim profilu znaleziono stare dane adresowe. Czy chcesz je automatycznie przenieść do nowej książki adresowej?",
    migrate_addresses_btn: "Przenieś moje adresy",
    address_title_placeholder: "np. Magazyn Warszawa",
    tax_no_tckn_label: "NIP / PESEL",
    company_name_label: "Nazwa firmy / przedsiębiorstwa",
    first_name_label: "Imię odbiorcy",
    last_name_label: "Nazwisko odbiorcy",
    phone_label: "Numer telefonu odbiorcy",
    save_address_btn: "Zapisz adres",
    cancel_btn: "Anuluj",
    loading_addresses: "Ładowanie adresów...",
    migration_success: "Stare adresy zostały pomyślnie przeniesione!",
    default_badge: "Domyślny",
    address_line_placeholder: "Ulica, numer budynku, mieszkania, piętro i inne szczegóły...",
    tax_office_placeholder: "np. Urząd Skarbowy Warszawa Śródmieście",
    postal_code_label: "Kod pocztowy *",
    postal_code_placeholder: "np. 00-001",
    postal_code_required_error: "Kod pocztowy jest wymagany.",
    phone_invalid_error: "Niepoprawny numer telefonu.",
    phone_tr_length_error: "Tureckie numery telefonów muszą mieć 10 cyfr (np. 5051234567).",
    phone_intl_length_error: "Numer telefonu musi zawierać od 6 do 15 cyfr.",
    country_required_error: "Wybierz najpierw kraj.",
  },
  bg: {
    address_book_header: "4. МОЯТ АДРЕСЕН УКАЗАТЕЛ",
    add_new_address: "Добавяне на нов адрес",
    edit_address: "Редактиране на адрес",
    delete_address: "Изтриване на адрес",
    address_title_label: "Име на адреса (напр. Главен офис, Склад)",
    address_type_label: "Тип адрес",
    billing_address: "Адрес за фактуриране",
    shipping_address: "Адрес за доставка / изпращане",
    country_label: "Държава",
    state_label: "Град / Област",
    city_label: "Град / Селище",
    address_line_label: "Пълен адрес",
    tax_office_label: "Данъчна служба",
    default_address_label: "Задаване като адрес по подразбиране",
    no_addresses_found: "Нямате запазени адреси.",
    address_delete_confirm: "Сигурни ли сте, че искате да изтриете този адрес?",
    legacy_migration_notice: "Във вашия профил беше открита стара адресна информация. Желаете ли автоматично да я прехвърлите в новия си адресен указател?",
    migrate_addresses_btn: "Прехвърли адресите ми",
    address_title_placeholder: "напр. Склад София",
    tax_no_tckn_label: "ЕИК / Булстат / ЕГН",
    company_name_label: "Име на фирма / компания",
    first_name_label: "Име на получател",
    last_name_label: "Фамилия на получател",
    phone_label: "Телефон за връзка с получателя",
    save_address_btn: "Запази адреса",
    cancel_btn: "Отказ",
    loading_addresses: "Зареждане на адреси...",
    migration_success: "Старите ви адреси бяха прехвърлени успешно!",
    default_badge: "По подразбиране",
    address_line_placeholder: "Улица, номер на сграда, апартамент, вход, етаж и други детайли...",
    tax_office_placeholder: "напр. НАП София-Изток",
    postal_code_label: "Пощенски код *",
    postal_code_placeholder: "напр. 1000",
    postal_code_required_error: "Пощенският код е задължителен.",
    phone_invalid_error: "Невалиден телефонен номер.",
    phone_tr_length_error: "Турските телефонни номера трябва да са точно 10 цифри (напр. 5051234567).",
    phone_intl_length_error: "Телефонният номер трябва да бъде между 6 и 15 цифри.",
    country_required_error: "Моля, първо изберете държава.",
  },
  de: {
    address_book_header: "4. MEIN ADRESSBUCH",
    add_new_address: "Neue Adresse hinzufügen",
    edit_address: "Adresse bearbeiten",
    delete_address: "Adresse löschen",
    address_title_label: "Adressbezeichnung (z. B. Hauptbüro, Lager)",
    address_type_label: "Adresstyp",
    billing_address: "Rechnungsadresse",
    shipping_address: "Lieferadresse / Versandadresse",
    country_label: "Land",
    state_label: "Stadt / Bundesland",
    city_label: "Stadt / Ort",
    address_line_label: "Vollständige Adresse",
    tax_office_label: "Finanzamt",
    default_address_label: "Als Standardadresse festlegen",
    no_addresses_found: "Keine gespeicherten Adressen gefunden.",
    address_delete_confirm: "Sind Sie sicher, dass Sie diese Adresse löschen möchten?",
    legacy_migration_notice: "In Ihrem Profil wurden alte Adressdaten gefunden. Möchten Sie diese automatisch in Ihr neues Adressbuch übertragen?",
    migrate_addresses_btn: "Meine Adressen übertragen",
    address_title_placeholder: "z. B. Lager Berlin",
    tax_no_tckn_label: "USt-IdNr. / Steuer-ID",
    company_name_label: "Firmenname / Unternehmensbezeichnung",
    first_name_label: "Vorname des Empfängers",
    last_name_label: "Nachname des Empfängers",
    phone_label: "Telefonnummer des Empfängers",
    save_address_btn: "Adresse speichern",
    cancel_btn: "Abbrechen",
    loading_addresses: "Adressen werden geladen...",
    migration_success: "Ihre alten Adressen wurden erfolgreich übertragen!",
    default_badge: "Standard",
    address_line_placeholder: "Straße, Hausnummer, Apartment, Stockwerk, Wohneinheit und weitere Details...",
    tax_office_placeholder: "z. B. Finanzamt Berlin-Mitte",
    postal_code_label: "Postleitzahl *",
    postal_code_placeholder: "z.B. 10115",
    postal_code_required_error: "Die Postleitzahl ist erforderlich.",
    phone_invalid_error: "Ungültige Telefonnummer.",
    phone_tr_length_error: "Türkische Telefonnummern müssen 10-stellig sein (z.B. 5051234567).",
    phone_intl_length_error: "Die Telefonnummer muss zwischen 6 und 15 Ziffern lang sein.",
    country_required_error: "Bitte wählen Sie zuerst ein Land aus.",
  },
  fr: {
    address_book_header: "4. MON CARNET D'ADRESSES",
    add_new_address: "Ajouter une nouvelle adresse",
    edit_address: "Modifier l'adresse",
    delete_address: "Supprimer l'adresse",
    address_title_label: "Nom de l'adresse (ex. Siège social, Entrepôt)",
    address_type_label: "Type d'adresse",
    billing_address: "Adresse de facturation",
    shipping_address: "Adresse de livraison",
    country_label: "Pays",
    state_label: "Ville / État / Province",
    city_label: "Ville / Commune",
    address_line_label: "Adresse complète",
    tax_office_label: "Bureau des impôts",
    default_address_label: "Définir comme adresse par défaut",
    no_addresses_found: "Aucune adresse enregistrée.",
    address_delete_confirm: "Êtes-vous sûr de vouloir supprimer cette adresse ?",
    legacy_migration_notice: "Des coordonnées d'adresse obsolètes ont été trouvées dans votre profil. Souhaitez-vous les importer automatiquement dans votre nouveau Carnet d'adresses ?",
    migrate_addresses_btn: "Importer mes adresses",
    address_title_placeholder: "ex. Entrepôt Paris",
    tax_no_tckn_label: "Numéro de TVA / Siret",
    company_name_label: "Nom de l'entreprise / société",
    first_name_label: "Prénom du destinataire",
    last_name_label: "Nom du destinataire",
    phone_label: "Téléphone du destinataire",
    save_address_btn: "Enregistrer l'adresse",
    postal_code_label: "Code postal *",
    postal_code_placeholder: "ex. 75001",
    postal_code_required_error: "Le code postal est requis.",
    phone_invalid_error: "Numéro de téléphone invalide.",
    phone_tr_length_error: "Les numéros de téléphone turcs doivent comporter 10 chiffres (ex. 5051234567).",
    phone_intl_length_error: "Le numéro de téléphone doit comporter entre 6 et 15 chiffres.",
    country_required_error: "Veuillez d'abord sélectionner un pays.",
    cancel_btn: "Annuler",
    loading_addresses: "Chargement des adresses...",
    migration_success: "Vos anciennes adresses ont été importées avec succès !",
    default_badge: "Par défaut",
    address_line_placeholder: "Nom de rue, numéro de bâtiment, appartement, étage, et autres précisions...",
    tax_office_placeholder: "ex. Centre des Impôts Paris 1er",
  }
};

const orderTranslations: Record<string, Record<string, string>> = {
  tr: {
    orders_tab: "Sipariş Geçmişim",
    profile_tab: "Profil Detayları",
    orders_header: "SİPARİŞ GEÇMİŞİM",
    orders_desc: "Geçmişte verdiğiniz siparişleri takip edebilir, faturalarınızı indirebilir veya ödeme bildiriminde bulunabilirsiniz.",
    order_number: "Sipariş No",
    order_date: "Tarih",
    total_amount: "Toplam Tutar",
    status: "Durum",
    actions: "İşlemler",
    view_details: "Detayları Göster",
    hide_details: "Detayları Gizle",
    download_excel: "Fatura Excel İndir",
    download_images: "Görselleri İndir (ZIP)",
    cancel_order: "Siparişi İptal Et",
    pay_notification: "Ödeme Bildirimi Yap",
    request_refund: "İade Talebi Oluştur",
    no_orders_found: "Henüz bir siparişiniz bulunmamaktadır.",
    status_pending_payment: "Ödeme Bekliyor",
    status_approved: "Onaylandı / Hazırlanıyor",
    status_shipping: "Kargoya Verildi",
    status_completed: "Tamamlandı",
    status_cancelled: "İptal Edildi",
    status_refunded: "İade Edildi",
    status_partially_refunded: "Kısmi İade Edildi",
    bank_name: "Banka Adı",
    sender_name: "Gönderen Adı Soyadı",
    amount: "Tutar",
    notes: "Açıklama / Notlar",
    submit_notification: "Bildirimi Gönder",
    refund_type: "İade Tipi",
    refund_reason: "İade Nedeni",
    full_refund: "Tüm Siparişi İade Et",
    partial_refund: "Kısmi Ürün İadesi",
    refund_items_selection: "İade edilecek ürünleri seçin",
    quantity: "Adet",
    price: "Birim Fiyat",
    total: "Toplam",
    cancel_confirm: "Bu siparişi iptal etmek istediğinize emin misiniz?",
    payment_notification_submitted: "Ödeme bildiriminiz başarıyla gönderildi.",
    refund_requested: "İade talebiniz başarıyla oluşturuldu.",
    payment_modal_title: "Ödeme Bildirimi Gönder",
    refund_modal_title: "İade Talebi Oluştur",
    address_delivery: "Teslimat Adresi",
    address_billing: "Fatura Adresi",
  },
  en: {
    orders_tab: "Order History",
    profile_tab: "Profile Details",
    orders_header: "MY ORDER HISTORY",
    orders_desc: "You can track your past orders, download invoices, or submit payment notifications.",
    order_number: "Order No",
    order_date: "Date",
    total_amount: "Total Amount",
    status: "Status",
    actions: "Actions",
    view_details: "Show Details",
    hide_details: "Hide Details",
    download_excel: "Download Invoice Excel",
    download_images: "Download Images (ZIP)",
    cancel_order: "Cancel Order",
    pay_notification: "Notify Payment",
    request_refund: "Request Refund",
    no_orders_found: "You have no orders yet.",
    status_pending_payment: "Pending Payment",
    status_approved: "Approved / Processing",
    status_shipping: "Shipped",
    status_completed: "Completed",
    status_cancelled: "Cancelled",
    status_refunded: "Refunded",
    status_partially_refunded: "Partially Refunded",
    bank_name: "Bank Name",
    sender_name: "Sender Full Name",
    amount: "Amount",
    notes: "Notes / Details",
    submit_notification: "Submit Notification",
    refund_type: "Refund Type",
    refund_reason: "Refund Reason",
    full_refund: "Refund Entire Order",
    partial_refund: "Refund Selected Items",
    refund_items_selection: "Select items to refund",
    quantity: "Qty",
    price: "Unit Price",
    total: "Total",
    cancel_confirm: "Are you sure you want to cancel this order?",
    payment_notification_submitted: "Your payment notification was submitted successfully.",
    refund_requested: "Your refund request was created successfully.",
    payment_modal_title: "Submit Payment Notification",
    refund_modal_title: "Create Refund Request",
    address_delivery: "Delivery Address",
    address_billing: "Billing Address",
  },
  ru: {
    orders_tab: "История заказов",
    profile_tab: "Детали профиля",
    orders_header: "МОЯ ИСТОРИЯ ЗАКАЗОВ",
    orders_desc: "Вы можете отслеживать свои прошлые заказы, скачивать счета или отправлять уведомления об оплате.",
    order_number: "Заказ №",
    order_date: "Дата",
    total_amount: "Итого",
    status: "Статус",
    actions: "Действия",
    view_details: "Показать детали",
    hide_details: "Скрыть детали",
    download_excel: "Скачать счет Excel",
    download_images: "Скачать изображения (ZIP)",
    cancel_order: "Отменить заказ",
    pay_notification: "Сообщить об оплате",
    request_refund: "Запросить возврат",
    no_orders_found: "У вас еще нет заказов.",
    status_pending_payment: "Ожидает оплаты",
    status_approved: "Одобрено / В обработке",
    status_shipping: "Отправлено",
    status_completed: "Завершено",
    status_cancelled: "Отменено",
    status_refunded: "Возвращено",
    status_partially_refunded: "Частично возвращено",
    bank_name: "Название банка",
    sender_name: "ФИО отправителя",
    amount: "Сумма",
    notes: "Примечания",
    submit_notification: "Отправить уведомление",
    refund_type: "Тип возврата",
    refund_reason: "Причина возврата",
    full_refund: "Возврат всего заказа",
    partial_refund: "Возврат выбранных товаров",
    refund_items_selection: "Выберите товары для возврата",
    quantity: "Кол-во",
    price: "Цена за ед.",
    total: "Всего",
    cancel_confirm: "Вы уверены, что хотите отменить этот заказ?",
    payment_notification_submitted: "Уведомление об оплате успешно отправлено.",
    refund_requested: "Запрос на возврат успешно создан.",
    payment_modal_title: "Отправить уведомление об оплате",
    refund_modal_title: "Создать запрос на возврат",
    address_delivery: "Адрес доставки",
    address_billing: "Адрес плательщика",
  }
};


interface UserAddress {
  id?: string;
  user_id?: string;
  title: string;
  address_type: "billing" | "shipping";
  first_name: string;
  last_name: string;
  company_name?: string;
  phone: string;
  country_id: string;
  state_id?: string;
  city_id?: string;
  address_line: string;
  tax_no_tckn?: string;
  tax_office?: string;
  is_default: boolean;
  country_name?: string;
  state_name?: string;
  city_name?: string;
  postal_code: string;
}

interface CountryLookup {
  id: string;
  code: string;
  phone_code: number;
  name_tr: string;
  name_en: string;
}

interface StateLookup {
  id: string;
  country_id: string;
  code: string;
  state_name: string;
}

interface CityLookup {
  id: string;
  state_id: string;
  code: string;
  name: string;
}

export default function ProfilePage() {
  const router = useRouter();

  // --- Storefront states ---
  const [lang, setLang] = useState<string>("tr");
  const [isLangOpen, setIsLangOpen] = useState<boolean>(false);
  const [displayCurrency, setDisplayCurrency] = useState<string>("TRY");
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string>("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);

  // --- Auth states ---
  const [user, setUser] = useState<any | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

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

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // --- Section state ---
  const [activeSection, setActiveSection] = useState<"profile" | "orders">("profile");

  // --- Orders states ---
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState<boolean>(false);
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
  const [refundOrderItems, setRefundOrderItems] = useState<any[]>([]);
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
  const [loadingAddresses, setLoadingAddresses] = useState<boolean>(true);

  // Modal / Form States
  const [isAddressModalOpen, setIsAddressModalOpen] = useState<boolean>(false);
  const [editingAddress, setEditingAddress] = useState<UserAddress | null>(null);
  
  // Active Address form state
  const [formTitle, setFormTitle] = useState("");
  const [formType, setFormType] = useState<"billing" | "shipping">("shipping");
  const [formFirstName, setFormFirstName] = useState("");
  const [formLastName, setFormLastName] = useState("");
  const [formCompany, setFormCompany] = useState("");
  const [formPhone, setFormPhone] = useState("");
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

  // Synchronize dynamic HTML lang attribute
  useEffect(() => {
    if (typeof window !== "undefined") {
      document.documentElement.setAttribute("lang", lang);
    }
  }, [lang]);

  // Load language, currency, cart & categories on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedLang = localStorage.getItem("preferred_lang") || "tr";
      setLang(savedLang);

      const savedCurrency = localStorage.getItem("merter_preferred_currency") || "TRY";
      setDisplayCurrency(savedCurrency);

      const savedCart = localStorage.getItem("merter_b2b_cart");
      if (savedCart) {
        try {
          setCart(JSON.parse(savedCart));
        } catch (e) {
          console.error(e);
        }
      }

      const urlParams = new URLSearchParams(window.location.search);
      const tab = urlParams.get("tab");
      if (tab === "orders") {
        setActiveSection("orders");
      }
    }

    const loadCategories = async () => {
      const data = await apiFetch<Category[]>("/categories");
      if (data) setCategories(data);
    };
    loadCategories();

    // Check authorization
    checkAuth();
  }, []);

  const checkAuth = () => {
    if (typeof window !== "undefined") {
      const savedToken = localStorage.getItem("store_user_token");
      const savedUserInfo = localStorage.getItem("store_user_info");

      if (savedToken && savedUserInfo) {
        setToken(savedToken);
        const parsedUser = JSON.parse(savedUserInfo);
        setUser(parsedUser);
        fetchUserProfile(savedToken);
        fetchAddresses(savedToken);
        fetchCountries();
        fetchOrders(savedToken);
      } else {
        setCheckingAuth(false);
        setLoadingProfile(false);
      }
    }
  };

  const fetchOrders = async (authToken: string) => {
    setLoadingOrders(true);
    setOrdersError(null);
    try {
      const response = await fetch("/api/v1/store/orders", {
        headers: {
          "Authorization": `Bearer ${authToken}`,
          "Content-Type": "application/json"
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Siparişler yüklenemedi");
      }
      setOrders(data || []);
    } catch (err: any) {
      setOrdersError(err.message);
    } finally {
      setLoadingOrders(false);
    }
  };

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
        throw new Error(errData.error || "Dosya indirilemedi");
      }
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      showToast("Hata: " + err.message);
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
        throw new Error(data.error || "Sipariş iptal edilemedi");
      }
      showToast(getOrderT("order_cancelled"));
      if (token) fetchOrders(token);
    } catch (err: any) {
      showToast("Hata: " + err.message);
    }
  };

  const openPaymentModal = (order: any) => {
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
          amount: parseFloat(payAmount),
          notes: payNotes
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Ödeme bildirimi iletilemedi");
      }
      showToast(getOrderT("payment_notification_submitted"));
      setIsPaymentModalOpen(false);
      if (token) fetchOrders(token);
    } catch (err: any) {
      showToast("Hata: " + err.message);
    } finally {
      setSubmittingPayment(false);
    }
  };

  const openRefundModal = (order: any) => {
    setRefundOrderID(order.id);
    setRefundOrderItems(order.items || []);
    setRefundType("FULL");
    setRefundReason("");
    
    const initialQty: Record<string, number> = {};
    const initialSel: Record<string, boolean> = {};
    (order.items || []).forEach((item: any) => {
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
    
    let itemsPayload: any[] = [];
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
        throw new Error(data.error || "İade talebi oluşturulamadı");
      }
      showToast(getOrderT("refund_requested"));
      setIsRefundModalOpen(false);
      if (token) fetchOrders(token);
    } catch (err: any) {
      showToast("Hata: " + err.message);
    } finally {
      setSubmittingRefund(false);
    }
  };

  const fetchUserProfile = async (authToken: string) => {
    setLoadingProfile(true);
    setError(null);
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
        // Token expired or invalid
        if (response.status === 401) {
          handleLogout();
          throw new Error(t("session_expired", lang));
        }
        throw new Error(data.error || t("profile_load_failed", lang));
      }

      // Populate form state
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

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingProfile(false);
      setCheckingAuth(false);
    }
  };

  const fetchAddresses = async (authToken: string) => {
    setLoadingAddresses(true);
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
  };

  const fetchCountries = async () => {
    try {
      const response = await fetch("/api/v1/store/locations/countries");
      if (response.ok) {
        const data = await response.json();
        setCountries(data || []);
      }
    } catch (e) {
      console.error("Failed to fetch countries:", e);
    }
  };

  const fetchStates = async (countryId: string): Promise<void> => {
    if (!countryId) {
      setStates([]);
      return Promise.resolve();
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
    return Promise.resolve();
  };

  const fetchCities = async (stateId: string): Promise<void> => {
    if (!stateId) {
      setCities([]);
      return Promise.resolve();
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
    return Promise.resolve();
  };

  const handleCountryChange = (countryId: string) => {
    setFormCountryID(countryId);
    setFormStateID("");
    setFormCityID("");
    setCities([]);
    fetchStates(countryId);
  };

  const handleStateChange = (stateId: string) => {
    setFormStateID(stateId);
    setFormCityID("");
    fetchCities(stateId);
  };

  const openAddressModal = (address: UserAddress | null = null) => {
    setAddressError(null);
    setAddressSuccess(null);
    if (address) {
      setEditingAddress(address);
      setFormTitle(address.title);
      setFormType(address.address_type);
      setFormFirstName(address.first_name);
      setFormLastName(address.last_name);
      setFormCompany(address.company_name || "");
      setFormPhone(address.phone);
      setFormCountryID(address.country_id);
      setFormAddressLine(address.address_line);
      setFormPostalCode(address.postal_code || "");
      setFormTaxNo(address.tax_no_tckn || "");
      setFormTaxOffice(address.tax_office || "");
      setFormIsDefault(address.is_default);

      // Parse phone code prefix based on selected country
      const matchedCountry = countries.find(c => c.id === address.country_id);
      const matchedPhoneCode = matchedCountry ? matchedCountry.phone_code : 90;
      let cleanP = (address.phone || "").trim().replace(/\D/g, "");
      const pCodeStr = String(matchedPhoneCode);
      if (cleanP.startsWith(pCodeStr)) {
        cleanP = cleanP.substring(pCodeStr.length);
      }
      if (cleanP.startsWith("0")) {
        cleanP = cleanP.substring(1);
      }
      setFormPhoneOnly(cleanP);
      
      fetchStates(address.country_id).then(() => {
        setFormStateID(address.state_id || "");
        if (address.state_id) {
          fetchCities(address.state_id).then(() => {
            setFormCityID(address.city_id || "");
          });
        } else {
          setFormCityID("");
          setCities([]);
        }
      });
    } else {
      setEditingAddress(null);
      setFormTitle("");
      setFormType("shipping");
      setFormFirstName(firstName || "");
      setFormLastName(lastName || "");
      setFormCompany("");
      setFormPhone(phone || "");
      
      const trCountry = countries.find(c => c.code === "TR");
      const defaultCountryID = trCountry ? trCountry.id : (countries.length > 0 ? countries[0].id : "");
      setFormCountryID(defaultCountryID);
      
      // Parse profile phone number prefix based on default country
      const matchedCountry = trCountry || (countries.length > 0 ? countries[0] : null);
      const matchedPhoneCode = matchedCountry ? matchedCountry.phone_code : 90;
      let cleanP = (phone || "").trim().replace(/\D/g, "");
      const pCodeStr = String(matchedPhoneCode);
      if (cleanP.startsWith(pCodeStr)) {
        cleanP = cleanP.substring(pCodeStr.length);
      }
      if (cleanP.startsWith("0")) {
        cleanP = cleanP.substring(1);
      }
      setFormPhoneOnly(cleanP);

      if (defaultCountryID) {
        fetchStates(defaultCountryID);
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

    const selectedCountry = countries.find(c => c.id === formCountryID);
    if (!selectedCountry) {
      setAddressError(getAddressT("country_required_error"));
      return;
    }

    const cleanPhone = formPhoneOnly.trim().replace(/\D/g, "");
    if (selectedCountry.code === "TR") {
      if (cleanPhone.length !== 10) {
        setAddressError(getAddressT("phone_tr_length_error"));
        return;
      }
    } else {
      if (cleanPhone.length < 6 || cleanPhone.length > 15) {
        setAddressError(getAddressT("phone_intl_length_error"));
        return;
      }
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
        throw new Error(data.error || "Adres kaydedilirken bir hata oluştu");
      }

      setAddressSuccess(editingAddress ? getAddressT("address_update_success") : getAddressT("address_create_success"));
      if (token) fetchAddresses(token);
      
      setTimeout(() => {
        setIsAddressModalOpen(false);
        setEditingAddress(null);
      }, 1000);

    } catch (err: any) {
      setAddressError(err.message);
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
        throw new Error(data.error || "Adres silinemedi");
      }

      if (token) fetchAddresses(token);
    } catch (err: any) {
      showToast(err.message);
    }
  };

  const handleMigrateLegacyAddresses = async () => {
    setIsMigrating(true);
    try {
      const trCountry = countries.find(c => c.code === "TR");
      if (!trCountry) throw new Error("Turkey location code not found in active catalog countries");

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
            phone: phone || "905000000000",
            country_id: trCountry.id,
            address_line: billingAddress.substring(0, 500),
            postal_code: "34000",
            tax_no_tckn: taxNoTCKN || null,
            is_default: true
          })
        });
        if (!response.ok) {
          const resErr = await response.json();
          throw new Error(resErr.error || "Fatura adresi taşınamadı");
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
            phone: phone || "905000000000",
            country_id: trCountry.id,
            address_line: deliveryAddress.substring(0, 500),
            postal_code: "34000",
            is_default: true
          })
        });
        if (!response.ok) {
          const resErr = await response.json();
          throw new Error(resErr.error || "Sevk adresi taşınamadı");
        }
      }

      setSuccess(getAddressT("migration_success"));
      if (token) fetchAddresses(token);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Taşıma işlemi başarısız oldu");
    } finally {
      setIsMigrating(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
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
          phone,
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

      setSuccess(t("profile_saved_success", lang));

      // 1. Sync updated details locally immediately
      if (typeof window !== "undefined") {
        const updatedUserInfo = {
          ...user,
          first_name: firstName,
          last_name: lastName,
          phone: phone
        };
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

    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("store_user_token");
      localStorage.removeItem("store_user_info");
      window.dispatchEvent(new Event("auth-change"));
      
      const origin = window.location.origin;
      window.location.href = origin + "/";
    }
  };

  const totalPkgs = cart.reduce((sum, item) => sum + item.packages_qty, 0);

  // --- Sub-loaders for unauthorised / loading UI ---
  if (checkingAuth || loadingProfile) {
    return (
      <div className="min-h-screen flex flex-col bg-[#fafafa]">
        <Header
          lang={lang}
          setLang={setLang}
          isLangOpen={isLangOpen}
          setIsLangOpen={setIsLangOpen}
          totalPkgs={totalPkgs}
          setIsCartOpen={setIsCartOpen}
          setSearchQuery={() => {}}
          setCurrentPage={() => {}}
          setActiveCategoryId={setActiveCategoryId}
          categories={categories}
          activeCategoryId={activeCategoryId}
          displayCurrency={displayCurrency}
          onCurrencyChange={() => {}}
        />
        <main className="flex-grow flex flex-col items-center justify-center py-20 gap-3">
          <div className="spinner animate-spin w-8 h-8 border-4 border-salmon-pink border-t-transparent rounded-full" />
          <span className="text-xs font-bold text-sonic-silver select-none">
            {t("loading_profile", lang)}
          </span>
        </main>
        <Footer lang={lang} />
      </div>
    );
  }

  // Unauthorized page state
  if (!user || !token) {
    return (
      <div className="min-h-screen flex flex-col bg-[#fafafa]">
        <Header
          lang={lang}
          setLang={setLang}
          isLangOpen={isLangOpen}
          setIsLangOpen={setIsLangOpen}
          totalPkgs={totalPkgs}
          setIsCartOpen={setIsCartOpen}
          setSearchQuery={() => {}}
          setCurrentPage={() => {}}
          setActiveCategoryId={setActiveCategoryId}
          categories={categories}
          activeCategoryId={activeCategoryId}
          displayCurrency={displayCurrency}
          onCurrencyChange={() => {}}
        />
        <main className="flex-grow flex flex-col items-center justify-center p-8 text-center select-none py-24">
          <span className="text-5xl mb-4">🔒</span>
          <h1 className="text-2xl font-extrabold text-eerie-black mb-3">
            {t("auth_required", lang)}
          </h1>
          <p className="text-sm font-semibold text-sonic-silver mb-8 max-w-md mx-auto leading-relaxed">
            {t("auth_required_desc", lang)}
          </p>
          <a 
            href="/" 
            className="px-8 py-3 bg-salmon-pink text-white rounded-[5px] font-extrabold text-xs tracking-[0.5px] uppercase hover:bg-eerie-black transition-all cursor-pointer shadow-md no-underline"
          >
            {t("back_to_homepage", lang)}
          </a>
        </main>
        <Footer lang={lang} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#fbfbfb]">
      <Header
        lang={lang}
        setLang={setLang}
        isLangOpen={isLangOpen}
        setIsLangOpen={setIsLangOpen}
        totalPkgs={totalPkgs}
        setIsCartOpen={setIsCartOpen}
        setSearchQuery={() => {}}
        setCurrentPage={() => {}}
        setActiveCategoryId={setActiveCategoryId}
        categories={categories}
        activeCategoryId={activeCategoryId}
        displayCurrency={displayCurrency}
        onCurrencyChange={() => {}}
      />

      <main className="flex-grow max-w-[1280px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-in fade-in duration-300">
        
        {/* Navigation Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-[11px] font-bold text-sonic-silver mb-6 uppercase tracking-wider select-none">
          <a href="/" className="hover:text-salmon-pink flex items-center gap-1 transition-colors no-underline text-sonic-silver">
            <Home className="w-3.5 h-3.5" />
            <span>{t("home", lang)}</span>
          </a>
          <span className="text-spanish-gray">/</span>
          <span className="text-salmon-pink font-extrabold">{t("my_account", lang)}</span>
        </nav>

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
                B2B {user.role === "admin" ? "Admin" : "Customer"}
              </span>
              
              <div className="w-full border-t border-cultured my-6" />

              <div className="flex flex-col gap-2.5 w-full">
                <button
                  type="button"
                  onClick={() => setActiveSection("profile")}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border text-xs font-bold text-left cursor-pointer w-full transition-all ${
                    activeSection === "profile"
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
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border text-xs font-bold text-left cursor-pointer w-full transition-all ${
                    activeSection === "orders"
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

          {/* Right Column: Profile Edit Form Dashboard */}
          <div className="lg:col-span-3">
            {activeSection === "profile" ? (
              <div className="bg-white rounded-2xl p-6 sm:p-8 border border-cultured shadow-sm">
              <h2 className="font-sans font-extrabold text-xl text-eerie-black mb-1 select-none flex items-center gap-2">
                <Settings className="w-5 h-5 text-salmon-pink" />
                {t("account_settings_title", lang)}
              </h2>
              <p className="text-xs text-sonic-silver font-semibold mb-8 select-none">
                {t("account_settings_desc", lang)}
              </p>

              {/* Success / Error Alerts */}
              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold flex items-center gap-2 select-none animate-in fade-in duration-200">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{error}</span>
                </div>
              )}
              {success && (
                <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-bold flex items-center gap-2 select-none animate-in fade-in duration-200">
                  <Check className="w-4 h-4 shrink-0 text-emerald-500 animate-bounce" />
                  <span>{success}</span>
                </div>
              )}

              <form onSubmit={handleSaveProfile} className="flex flex-col gap-6">
                
                {/* Section 1: Personal info */}
                <div>
                  <h4 className="text-[10px] font-extrabold uppercase text-sonic-silver tracking-wider border-b border-cultured pb-2 mb-4 select-none">
                    {t("personal_information_header", lang)}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-extrabold uppercase text-eerie-black tracking-wider">{t("first_name_field", lang)}</label>
                      <input
                        type="text"
                        required
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-cultured rounded-lg text-xs font-semibold focus:outline-none focus:border-salmon-pink focus:ring-salmon-pink transition-all shadow-inner text-eerie-black"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-extrabold uppercase text-eerie-black tracking-wider">{t("last_name_field", lang)}</label>
                      <input
                        type="text"
                        required
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-cultured rounded-lg text-xs font-semibold focus:outline-none focus:border-salmon-pink focus:ring-salmon-pink transition-all shadow-inner text-eerie-black"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-extrabold uppercase text-eerie-black tracking-wider">{t("email_readonly", lang)}</label>
                      <input
                        type="email"
                        disabled
                        value={email}
                        className="w-full px-3.5 py-2.5 bg-[#f5f5f5] border border-cultured rounded-lg text-xs font-semibold text-sonic-silver cursor-not-allowed select-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-extrabold uppercase text-eerie-black tracking-wider">{t("phone_number_field", lang)}</label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-cultured rounded-lg text-xs font-semibold focus:outline-none focus:border-salmon-pink focus:ring-salmon-pink transition-all shadow-inner text-eerie-black"
                        placeholder={t("placeholder_phone", lang)}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Storefront Preferences */}
                <div>
                  <h4 className="text-[10px] font-extrabold uppercase text-sonic-silver tracking-wider border-b border-cultured pb-2 mb-4 select-none">
                    {t("shopping_preferences_header", lang)}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-extrabold uppercase text-eerie-black tracking-wider">{t("default_language_field", lang)}</label>
                      <select
                        value={preferredLang}
                        onChange={(e) => setPreferredLang(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-cultured rounded-lg text-xs font-bold focus:outline-none focus:border-salmon-pink text-onyx cursor-pointer shadow-sm"
                      >
                        <option value="tr">Türkçe 🇹🇷</option>
                        <option value="en">English 🇬🇧</option>
                        <option value="ar">العربية 🇸🇦</option>
                        <option value="ru">Русский 🇷🇺</option>
                        <option value="pl">Polski 🇵🇱</option>
                        <option value="bg">Български 🇧🇬</option>
                        <option value="de">Deutsch 🇩🇪</option>
                        <option value="fr">Français 🇫🇷</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-extrabold uppercase text-eerie-black tracking-wider">{t("default_currency_field", lang)}</label>
                      <select
                        value={preferredCurrency}
                        onChange={(e) => setPreferredCurrency(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-cultured rounded-lg text-xs font-bold focus:outline-none focus:border-salmon-pink text-onyx cursor-pointer shadow-sm"
                      >
                        <option value="TRY">TRY (TL) 🇹🇷</option>
                        <option value="USD">USD ($) 🇺🇸</option>
                        <option value="EUR">EUR (€) 🇪🇺</option>
                        <option value="GBP">GBP (£) 🇬🇧</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Section 3: Company and Instagram */}
                <div>
                  <h4 className="text-[10px] font-extrabold uppercase text-sonic-silver tracking-wider border-b border-cultured pb-2 mb-4 select-none">
                    {t("b2b_company_billing_header", lang)}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-extrabold uppercase text-eerie-black tracking-wider flex items-center gap-1.5">
                        <Clipboard className="w-3.5 h-3.5 text-salmon-pink" />
                        {t("tax_id_field", lang)}
                      </label>
                      <input
                        type="text"
                        value={taxNoTCKN}
                        onChange={(e) => setTaxNoTCKN(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-cultured rounded-lg text-xs font-semibold focus:outline-none focus:border-salmon-pink focus:ring-salmon-pink transition-all shadow-inner text-eerie-black"
                        placeholder={t("placeholder_tax_id", lang)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-extrabold uppercase text-eerie-black tracking-wider flex items-center gap-1.5">
                        <Instagram className="w-3.5 h-3.5 text-salmon-pink" />
                        {t("instagram_username_field", lang)}
                      </label>
                      <input
                        type="text"
                        value={instagramUsername}
                        onChange={(e) => setInstagramUsername(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-cultured rounded-lg text-xs font-semibold focus:outline-none focus:border-salmon-pink focus:ring-salmon-pink transition-all shadow-inner text-eerie-black"
                        placeholder={t("placeholder_instagram", lang)}
                      />
                    </div>
                  </div>
                </div>

                {/* Legacy Address Migration Banner */}
                {addresses.length === 0 && (billingAddress?.trim() !== "" || deliveryAddress?.trim() !== "") && (
                  <div className="p-5 bg-gradient-to-r from-salmon-pink/10 to-salmon-pink/5 border border-salmon-pink/20 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in duration-300">
                    <div className="flex gap-3">
                      <div className="w-10 h-10 rounded-full bg-salmon-pink/10 flex items-center justify-center text-salmon-pink shrink-0">
                        <Globe className="w-5 h-5" />
                      </div>
                      <div>
                        <h5 className="text-xs font-extrabold text-eerie-black mb-1">
                          {getAddressT("legacy_migration_notice")}
                        </h5>
                        <div className="text-[10px] font-bold text-sonic-silver">
                          {billingAddress && <p>• {getAddressT("billing_address")}: {billingAddress.substring(0, 80)}...</p>}
                          {deliveryAddress && <p>• {getAddressT("shipping_address")}: {deliveryAddress.substring(0, 80)}...</p>}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={isMigrating}
                      onClick={handleMigrateLegacyAddresses}
                      className="px-5 py-2.5 bg-salmon-pink text-white rounded-lg font-extrabold text-[10px] uppercase tracking-[0.5px] border-none shadow-md hover:bg-eerie-black active:scale-[0.98] transition-all shrink-0 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isMigrating ? (
                        <div className="spinner animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          {getAddressT("migrate_addresses_btn")}
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Section 4: Relational Address Book Manager */}
                <div className="border-t border-cultured pt-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h4 className="text-[11px] font-extrabold uppercase text-sonic-silver tracking-wider select-none mb-1">
                        {getAddressT("address_book_header")}
                      </h4>
                      <p className="text-[10px] font-semibold text-sonic-silver select-none">
                        {getAddressT("account_settings_desc")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openAddressModal(null)}
                      className="px-4 py-2 bg-salmon-pink/10 text-salmon-pink hover:bg-salmon-pink hover:text-white transition-all rounded-lg font-extrabold text-[10px] uppercase tracking-[0.5px] border border-salmon-pink/20 cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {getAddressT("add_new_address")}
                    </button>
                  </div>

                  {loadingAddresses ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2">
                      <div className="spinner animate-spin w-6 h-6 border-3 border-salmon-pink border-t-transparent rounded-full" />
                      <span className="text-[10px] font-bold text-sonic-silver">{getAddressT("loading_addresses")}</span>
                    </div>
                  ) : addresses.length === 0 ? (
                    <div className="border-2 border-dashed border-cultured rounded-2xl p-10 text-center select-none">
                      <MapPin className="w-8 h-8 text-spanish-gray mx-auto mb-2.5" />
                      <p className="text-xs font-bold text-sonic-silver mb-4">
                        {getAddressT("no_addresses_found")}
                      </p>
                      <button
                        type="button"
                        onClick={() => openAddressModal(null)}
                        className="px-5 py-2.5 bg-salmon-pink text-white rounded-lg font-extrabold text-xs uppercase tracking-[0.5px] border-none shadow-md hover:bg-eerie-black active:scale-[0.98] transition-all cursor-pointer"
                      >
                        {getAddressT("add_new_address")}
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {addresses.map((addr) => (
                        <div
                          key={addr.id}
                          className={`bg-white border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative group ${
                            addr.is_default ? "border-salmon-pink/30 bg-salmon-pink/[0.01]" : "border-cultured"
                          }`}
                        >
                          {addr.is_default && (
                            <span className="absolute top-4 right-4 bg-salmon-pink/10 text-salmon-pink text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border border-salmon-pink/20 tracking-wider">
                              {getAddressT("default_badge")}
                            </span>
                          )}

                          <div className="flex flex-col gap-2">
                            {/* Card Header (Title & Badge) */}
                            <div className="flex items-center gap-2">
                              {addr.address_type === "billing" ? (
                                <Briefcase className="w-4 h-4 text-salmon-pink" />
                              ) : (
                                <MapPin className="w-4 h-4 text-salmon-pink" />
                              )}
                              <span className="text-xs font-extrabold text-eerie-black truncate max-w-[150px]">
                                {addr.title}
                              </span>
                              <span className={`text-[8px] font-extrabold uppercase px-2 py-0.5 rounded-full tracking-wider ${
                                addr.address_type === "billing"
                                  ? "bg-purple-50 text-purple-600 border border-purple-100"
                                  : "bg-blue-50 text-blue-600 border border-blue-100"
                              }`}>
                                {addr.address_type === "billing" ? getAddressT("billing_address") : getAddressT("shipping_address")}
                              </span>
                            </div>

                            {/* Recipient details */}
                            <div className="text-xs font-extrabold text-eerie-black mt-1">
                              {addr.first_name} {addr.last_name}
                            </div>
                            {addr.company_name && (
                              <div className="text-[10px] font-bold text-sonic-silver truncate">
                                {addr.company_name}
                              </div>
                            )}

                            {/* Address details */}
                            <div className="text-[11px] font-medium text-sonic-silver leading-relaxed mt-1">
                              {addr.address_line}
                            </div>
                            <div className="text-[10px] font-extrabold text-eerie-black flex items-center gap-1.5 mt-0.5">
                              <Globe className="w-3.5 h-3.5 text-spanish-gray" />
                              <span>
                                {addr.postal_code ? `${addr.postal_code} ` : ""}
                                {addr.city_name ? `${addr.city_name}, ` : ""}
                                {addr.state_name ? `${addr.state_name}, ` : ""}
                                {addr.country_name}
                              </span>
                            </div>

                            <div className="text-[10px] font-bold text-sonic-silver truncate mt-0.5">
                              📱 {addr.phone}
                            </div>

                            {/* Conditional Billing details */}
                            {addr.address_type === "billing" && (addr.tax_no_tckn || addr.tax_office) && (
                              <div className="mt-2 pt-2 border-t border-cultured text-[10px] font-semibold text-sonic-silver flex flex-col gap-0.5">
                                {addr.tax_no_tckn && (
                                  <div className="flex items-center gap-1">
                                    <Clipboard className="w-3 h-3 text-spanish-gray" />
                                    <span>{getAddressT("tax_no_tckn_label")}: {addr.tax_no_tckn}</span>
                                  </div>
                                )}
                                {addr.tax_office && (
                                  <div>
                                    🏢 {getAddressT("tax_office_label")}: {addr.tax_office}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Card Actions */}
                          <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-cultured">
                            <button
                              type="button"
                              onClick={() => openAddressModal(addr)}
                              className="p-1.5 hover:bg-cultured text-sonic-silver hover:text-salmon-pink transition-all rounded border-none bg-transparent cursor-pointer flex items-center gap-1"
                              title={getAddressT("edit_address")}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span className="text-[9px] font-extrabold uppercase">{getAddressT("edit_address")}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteAddress(addr.id!)}
                              className="p-1.5 hover:bg-red-50 text-sonic-silver hover:text-red-500 transition-all rounded border-none bg-transparent cursor-pointer flex items-center gap-1"
                              title={getAddressT("delete_address")}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span className="text-[9px] font-extrabold uppercase">{getAddressT("delete_address")}</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="w-full mt-4 py-3.5 bg-salmon-pink hover:bg-eerie-black text-white rounded-lg font-extrabold text-xs tracking-[0.5px] uppercase shadow-md border-none flex items-center justify-center gap-2 cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-300 active:scale-[0.99]"
                >
                  {savingProfile ? (
                    <div className="spinner animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    t("save_changes_btn", lang)
                  )}
                </button>

              </form>

            </div>
            ) : (
              <div className="bg-white rounded-2xl p-6 sm:p-8 border border-cultured shadow-sm animate-in fade-in duration-200">
                <h2 className="font-sans font-extrabold text-xl text-eerie-black mb-1 select-none flex items-center gap-2">
                  <Clipboard className="w-5 h-5 text-salmon-pink" />
                  {getOrderT("orders_header")}
                </h2>
                <p className="text-xs text-sonic-silver font-semibold mb-8 select-none">
                  {getOrderT("orders_desc")}
                </p>

                {loadingOrders ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <div className="spinner animate-spin w-8 h-8 border-4 border-salmon-pink border-t-transparent rounded-full" />
                    <span className="text-xs font-bold text-sonic-silver select-none">
                      Yükleniyor...
                    </span>
                  </div>
                ) : ordersError ? (
                  <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold flex items-center gap-2 select-none">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <span>{ordersError}</span>
                  </div>
                ) : orders.length === 0 ? (
                  <div className="border-2 border-dashed border-cultured rounded-2xl p-12 text-center select-none">
                    <Clipboard className="w-12 h-12 text-spanish-gray mx-auto mb-3" />
                    <p className="text-sm font-bold text-sonic-silver">
                      {getOrderT("no_orders_found")}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-6">
                    {orders.map((order) => {
                      const isExpanded = !!expandedOrders[order.id];
                      return (
                        <div
                          key={order.id}
                          className="border border-cultured rounded-2xl overflow-hidden shadow-sm bg-white hover:border-salmon-pink/30 transition-colors"
                        >
                          {/* Order Card Header */}
                          <div className="bg-cultured/40 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-cultured">
                            <div className="grid grid-cols-2 sm:flex sm:items-center gap-x-6 gap-y-2 text-xs font-bold text-sonic-silver">
                              <div>
                                <div className="text-[10px] uppercase text-spanish-gray tracking-wider mb-0.5">
                                  {getOrderT("order_number")}
                                </div>
                                <div className="text-eerie-black font-extrabold">{order.order_number}</div>
                              </div>
                              <div>
                                <div className="text-[10px] uppercase text-spanish-gray tracking-wider mb-0.5">
                                  {getOrderT("order_date")}
                                </div>
                                <div className="text-eerie-black">
                                  {new Date(order.created_at).toLocaleDateString(lang === "tr" ? "tr-TR" : "en-US", {
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric"
                                  })}
                                </div>
                              </div>
                              <div>
                                <div className="text-[10px] uppercase text-spanish-gray tracking-wider mb-0.5">
                                  {getOrderT("total_amount")}
                                </div>
                                <div className="text-salmon-pink font-extrabold">
                                  {new Intl.NumberFormat(lang === "tr" ? "tr-TR" : "en-US", {
                                    style: "currency",
                                    currency: "TRY"
                                  }).format(order.total_amount)}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 self-end sm:self-center">
                              <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                                order.order_status === "PENDING_PAYMENT"
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : order.order_status === "APPROVED"
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : order.order_status === "SHIPPING"
                                  ? "bg-purple-50 text-purple-700 border-purple-200"
                                  : order.order_status === "COMPLETED"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : order.order_status === "CANCELLED"
                                  ? "bg-rose-50 text-rose-700 border-rose-200"
                                  : "bg-slate-50 text-slate-700 border-slate-200"
                              }`}>
                                {getOrderT(`status_${order.order_status.toLowerCase()}`)}
                              </span>

                              <button
                                type="button"
                                onClick={() => setExpandedOrders(prev => ({ ...prev, [order.id]: !prev[order.id] }))}
                                className="p-1.5 hover:bg-cultured rounded-lg transition-colors border border-cultured bg-white cursor-pointer text-sonic-silver hover:text-salmon-pink flex items-center justify-center"
                              >
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>

                          {/* Expanded Details */}
                          {isExpanded && (
                            <div className="p-4 sm:p-6 border-t border-cultured bg-white animate-in slide-in-from-top duration-200">
                              <div className="flex flex-col gap-6">
                                
                                <div>
                                  <h4 className="text-[10px] font-extrabold uppercase text-sonic-silver tracking-wider border-b border-cultured pb-2 mb-4">
                                    Ürünler
                                  </h4>
                                  <div className="flex flex-col gap-4">
                                    {(order.items || []).map((item: any) => {
                                      const coverImg = getResizedImageUrl(item.image_url_at_purchase, 80, 106);
                                      return (
                                        <div key={item.id} className="flex items-center gap-4 text-xs font-bold">
                                          <img
                                            src={coverImg}
                                            alt={item.product_name}
                                            className="w-16 h-16 object-cover rounded-lg border border-cultured"
                                            onError={(e) => {
                                              (e.target as HTMLImageElement).src = "/placeholder.png";
                                            }}
                                          />
                                          <div className="flex-grow min-w-0">
                                            <div className="text-eerie-black font-extrabold truncate">
                                              {item.product_name}
                                            </div>
                                            <div className="text-[10px] text-sonic-silver mt-0.5">
                                              SKU: {item.product_sku}
                                            </div>
                                            <div className="text-[10px] text-sonic-silver mt-0.5">
                                              {item.quantity} {getOrderT("quantity")} x {new Intl.NumberFormat(lang === "tr" ? "tr-TR" : "en-US", { style: "currency", currency: "TRY" }).format(item.price_at_purchase)}
                                            </div>
                                          </div>
                                          <div className="text-eerie-black font-extrabold shrink-0">
                                            {new Intl.NumberFormat(lang === "tr" ? "tr-TR" : "en-US", { style: "currency", currency: "TRY" }).format(item.price_at_purchase * item.quantity)}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-cultured">
                                  <div>
                                    <h4 className="text-[10px] font-extrabold uppercase text-sonic-silver tracking-wider border-b border-cultured pb-2 mb-2.5">
                                      {getOrderT("address_delivery")}
                                    </h4>
                                    <p className="text-xs font-medium text-sonic-silver leading-relaxed whitespace-pre-line">
                                      {order.delivery_address}
                                    </p>
                                  </div>
                                  <div>
                                    <h4 className="text-[10px] font-extrabold uppercase text-sonic-silver tracking-wider border-b border-cultured pb-2 mb-2.5">
                                      {getOrderT("address_billing")}
                                    </h4>
                                    <p className="text-xs font-medium text-sonic-silver leading-relaxed whitespace-pre-line">
                                      {order.billing_address}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center justify-end gap-3 pt-6 border-t border-cultured mt-2">
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadFile(`/api/v1/store/orders/${order.id}/excel`, `fatura-${order.order_number}.xls`)}
                                    className="px-4 py-2 bg-cultured hover:bg-[#e2e8f0] text-eerie-black hover:text-salmon-pink rounded-lg font-extrabold text-[10px] uppercase tracking-[0.5px] border border-cultured transition-colors flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>{getOrderT("download_excel")}</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleDownloadFile(`/api/v1/store/orders/${order.id}/images`, `gorseller-${order.order_number}.zip`)}
                                    className="px-4 py-2 bg-cultured hover:bg-[#e2e8f0] text-eerie-black hover:text-salmon-pink rounded-lg font-extrabold text-[10px] uppercase tracking-[0.5px] border border-cultured transition-colors flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>{getOrderT("download_images")}</span>
                                  </button>

                                  {order.order_status === "PENDING_PAYMENT" && (
                                    <button
                                      type="button"
                                      onClick={() => openPaymentModal(order)}
                                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-extrabold text-[10px] uppercase tracking-[0.5px] border-none shadow transition-colors flex items-center gap-1.5 cursor-pointer"
                                    >
                                      <CreditCard className="w-3.5 h-3.5" />
                                      <span>{getOrderT("pay_notification")}</span>
                                    </button>
                                  )}

                                  {(order.order_status === "APPROVED" || order.order_status === "COMPLETED") && (
                                    <button
                                      type="button"
                                      onClick={() => openRefundModal(order)}
                                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-extrabold text-[10px] uppercase tracking-[0.5px] border-none shadow transition-colors flex items-center gap-1.5 cursor-pointer"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5" />
                                      <span>{getOrderT("request_refund")}</span>
                                    </button>
                                  )}

                                  {(order.order_status === "PENDING_PAYMENT" || order.order_status === "APPROVED") && (
                                    <button
                                      type="button"
                                      onClick={() => handleCancelOrder(order.id)}
                                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-extrabold text-[10px] uppercase tracking-[0.5px] border-none shadow transition-colors flex items-center gap-1.5 cursor-pointer"
                                    >
                                      <XCircle className="w-3.5 h-3.5" />
                                      <span>{getOrderT("cancel_order")}</span>
                                    </button>
                                  )}
                                </div>

                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

        </div>

      </main>

      {/* Address Form Dialog Modal */}
      {isAddressModalOpen && (
        <div className="fixed inset-0 bg-[#0c0d10]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl animate-in scale-in duration-200 border border-cultured flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-cultured flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-eerie-black uppercase tracking-wider flex items-center gap-2">
                <MapPin className="w-4 h-4 text-salmon-pink" />
                {editingAddress ? getAddressT("edit_address") : getAddressT("add_new_address")}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddressModalOpen(false)}
                className="w-8 h-8 rounded-full border border-cultured text-sonic-silver hover:text-salmon-pink hover:bg-cultured transition-all bg-transparent flex items-center justify-center text-lg font-bold cursor-pointer"
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveAddress} className="flex-grow overflow-y-auto p-6 flex flex-col gap-4">
              {addressError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold flex items-center gap-2 select-none animate-in fade-in duration-200">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{addressError}</span>
                </div>
              )}
              {addressSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-bold flex items-center gap-2 select-none animate-in fade-in duration-200">
                  <Check className="w-4 h-4 shrink-0 text-emerald-500 animate-bounce" />
                  <span>{addressSuccess}</span>
                </div>
              )}

              {/* Title & Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-extrabold uppercase text-eerie-black tracking-wider">
                    {getAddressT("address_title_label")} *
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-cultured rounded-lg text-xs font-semibold focus:outline-none focus:border-salmon-pink focus:ring-salmon-pink transition-all shadow-inner text-eerie-black"
                    placeholder={getAddressT("address_title_placeholder")}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-extrabold uppercase text-eerie-black tracking-wider">
                    {getAddressT("address_type_label")} *
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as "billing" | "shipping")}
                    className="w-full px-3.5 py-2.5 bg-white border border-cultured rounded-lg text-xs font-bold focus:outline-none focus:border-salmon-pink text-onyx cursor-pointer shadow-sm"
                  >
                    <option value="shipping">{getAddressT("shipping_address")}</option>
                    <option value="billing">{getAddressT("billing_address")}</option>
                  </select>
                </div>
              </div>

              {/* Country */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold uppercase text-eerie-black tracking-wider">
                  {getAddressT("country_label")} *
                </label>
                <select
                  required
                  value={formCountryID}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-cultured rounded-lg text-xs font-bold focus:outline-none focus:border-salmon-pink text-onyx cursor-pointer shadow-sm"
                >
                  <option value="">-- {getAddressT("country_label")} --</option>
                  {countries.map((c) => (
                    <option key={c.id} value={c.id}>
                      {lang === "tr" ? c.name_tr : c.name_en}
                    </option>
                  ))}
                </select>
              </div>

              {/* State & City/Town */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-extrabold uppercase text-eerie-black tracking-wider">
                    {getAddressT("state_label")}
                  </label>
                  <select
                    value={formStateID}
                    onChange={(e) => handleStateChange(e.target.value)}
                    disabled={states.length === 0}
                    className="w-full px-3.5 py-2.5 bg-white border border-cultured rounded-lg text-xs font-bold focus:outline-none focus:border-salmon-pink text-onyx cursor-pointer shadow-sm disabled:bg-[#f5f5f5] disabled:cursor-not-allowed disabled:text-sonic-silver"
                  >
                    <option value="">-- {states.length === 0 ? "N/A" : getAddressT("state_label")} --</option>
                    {states.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.state_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-extrabold uppercase text-eerie-black tracking-wider">
                    {getAddressT("city_label")}
                  </label>
                  <select
                    value={formCityID}
                    onChange={(e) => setFormCityID(e.target.value)}
                    disabled={cities.length === 0}
                    className="w-full px-3.5 py-2.5 bg-white border border-cultured rounded-lg text-xs font-bold focus:outline-none focus:border-salmon-pink text-onyx cursor-pointer shadow-sm disabled:bg-[#f5f5f5] disabled:cursor-not-allowed disabled:text-sonic-silver"
                  >
                    <option value="">-- {cities.length === 0 ? "N/A" : getAddressT("city_label")} --</option>
                    {cities.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Postal Code */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold uppercase text-eerie-black tracking-wider">
                  {getAddressT("postal_code_label")}
                </label>
                <input
                  type="text"
                  required
                  value={formPostalCode}
                  onChange={(e) => setFormPostalCode(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-cultured rounded-lg text-xs font-semibold focus:outline-none focus:border-salmon-pink focus:ring-salmon-pink transition-all shadow-inner text-eerie-black"
                  placeholder={getAddressT("postal_code_placeholder")}
                />
              </div>

              {/* First Name & Last Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-extrabold uppercase text-eerie-black tracking-wider">
                    {getAddressT("first_name_label")} *
                  </label>
                  <input
                    type="text"
                    required
                    value={formFirstName}
                    onChange={(e) => setFormFirstName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-cultured rounded-lg text-xs font-semibold focus:outline-none focus:border-salmon-pink focus:ring-salmon-pink transition-all shadow-inner text-eerie-black"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-extrabold uppercase text-eerie-black tracking-wider">
                    {getAddressT("last_name_label")} *
                  </label>
                  <input
                    type="text"
                    required
                    value={formLastName}
                    onChange={(e) => setFormLastName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-cultured rounded-lg text-xs font-semibold focus:outline-none focus:border-salmon-pink focus:ring-salmon-pink transition-all shadow-inner text-eerie-black"
                  />
                </div>
              </div>

              {/* Company & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-extrabold uppercase text-eerie-black tracking-wider">
                    {getAddressT("company_name_label")}
                  </label>
                  <input
                    type="text"
                    value={formCompany}
                    onChange={(e) => setFormCompany(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-cultured rounded-lg text-xs font-semibold focus:outline-none focus:border-salmon-pink focus:ring-salmon-pink transition-all shadow-inner text-eerie-black"
                    placeholder={t("placeholder_company_name", lang)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-extrabold uppercase text-eerie-black tracking-wider">
                    {getAddressT("phone_label")} *
                  </label>
                  <div className="flex items-center">
                    <span className="inline-flex items-center px-3.5 py-2.5 rounded-l-lg border border-r-0 border-cultured bg-[#f5f5f5] text-xs font-bold text-sonic-silver select-none">
                      +{countries.find(c => c.id === formCountryID)?.phone_code || "..."}
                    </span>
                    <input
                      type="tel"
                      required
                      value={formPhoneOnly}
                      onChange={(e) => setFormPhoneOnly(e.target.value.replace(/\D/g, ""))}
                      className="w-full px-3.5 py-2.5 bg-white border border-cultured rounded-r-lg text-xs font-semibold focus:outline-none focus:border-salmon-pink focus:ring-salmon-pink transition-all shadow-inner text-eerie-black"
                      placeholder="505 123 45 67"
                    />
                  </div>
                </div>
              </div>

              {/* Address Line */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-extrabold uppercase text-eerie-black tracking-wider">
                    {getAddressT("address_line_label")} *
                  </label>
                  <span className="text-[9px] font-bold text-sonic-silver select-none">
                    {formAddressLine.length}/500
                  </span>
                </div>
                <textarea
                  required
                  maxLength={500}
                  value={formAddressLine}
                  onChange={(e) => setFormAddressLine(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-cultured rounded-lg text-xs font-semibold focus:outline-none focus:border-salmon-pink focus:ring-salmon-pink transition-all shadow-inner h-20 resize-none text-eerie-black"
                  placeholder={getAddressT("address_line_placeholder")}
                />
              </div>

              {/* Conditional Billing Fields */}
              {formType === "billing" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-[#fbfbfb] rounded-xl border border-cultured animate-in slide-in-from-top-2 duration-200">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-extrabold uppercase text-eerie-black tracking-wider flex items-center gap-1.5">
                      <Clipboard className="w-3.5 h-3.5 text-salmon-pink" />
                      {getAddressT("tax_no_tckn_label")}
                    </label>
                    <input
                      type="text"
                      value={formTaxNo}
                      onChange={(e) => setFormTaxNo(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-cultured rounded-lg text-xs font-semibold focus:outline-none focus:border-salmon-pink focus:ring-salmon-pink transition-all shadow-inner text-eerie-black"
                      placeholder={t("placeholder_tax_id", lang)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-extrabold uppercase text-eerie-black tracking-wider flex items-center gap-1.5">
                      🏢 {getAddressT("tax_office_label")}
                    </label>
                    <input
                      type="text"
                      value={formTaxOffice}
                      onChange={(e) => setFormTaxOffice(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-cultured rounded-lg text-xs font-semibold focus:outline-none focus:border-salmon-pink focus:ring-salmon-pink transition-all shadow-inner text-eerie-black"
                      placeholder={getAddressT("tax_office_placeholder")}
                    />
                  </div>
                </div>
              )}

              {/* Default address checkbox */}
              <div className="flex items-center gap-2 select-none my-1">
                <input
                  type="checkbox"
                  id="formIsDefault"
                  checked={formIsDefault}
                  onChange={(e) => setFormIsDefault(e.target.checked)}
                  className="rounded text-salmon-pink focus:ring-salmon-pink cursor-pointer w-4 h-4"
                />
                <label htmlFor="formIsDefault" className="text-xs font-bold text-eerie-black cursor-pointer">
                  {getAddressT("default_address_label")}
                </label>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-cultured mt-2">
                <button
                  type="button"
                  onClick={() => setIsAddressModalOpen(false)}
                  className="px-5 py-2.5 bg-cultured hover:bg-spanish-gray/20 text-sonic-silver rounded-lg font-extrabold text-xs uppercase tracking-[0.5px] border-none cursor-pointer transition-colors"
                >
                  {getAddressT("cancel_btn")}
                </button>
                <button
                  type="submit"
                  disabled={savingAddress}
                  className="px-5 py-2.5 bg-salmon-pink hover:bg-eerie-black text-white rounded-lg font-extrabold text-xs uppercase tracking-[0.5px] border-none shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-300 flex items-center gap-1.5"
                >
                  {savingAddress ? (
                    <div className="spinner animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    getAddressT("save_address_btn")
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Payment Notification Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-[#0c0d10]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl animate-in scale-in duration-200 border border-cultured flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-cultured flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-eerie-black uppercase tracking-wider flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-salmon-pink" />
                {getOrderT("payment_modal_title")}
              </h3>
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="w-8 h-8 rounded-full border border-cultured text-sonic-silver hover:text-salmon-pink hover:bg-cultured transition-all bg-transparent flex items-center justify-center text-lg font-bold cursor-pointer"
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleSubmitPaymentNotification} className="flex-grow overflow-y-auto p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold uppercase text-eerie-black tracking-wider">
                  {getOrderT("bank_name")} *
                </label>
                <select
                  required
                  value={payBankName}
                  onChange={(e) => setPayBankName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-cultured rounded-lg text-xs font-bold focus:outline-none focus:border-salmon-pink text-onyx cursor-pointer shadow-sm"
                >
                  <option value="">-- Banka Seçin --</option>
                  <option value="VakıfBank">VakıfBank</option>
                  <option value="Ziraat Bankası">Ziraat Bankası</option>
                  <option value="Garanti BBVA">Garanti BBVA</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold uppercase text-eerie-black tracking-wider">
                  {getOrderT("sender_name")} *
                </label>
                <input
                  type="text"
                  required
                  value={paySenderName}
                  onChange={(e) => setPaySenderName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-cultured rounded-lg text-xs font-semibold focus:outline-none focus:border-salmon-pink text-eerie-black shadow-inner"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold uppercase text-eerie-black tracking-wider">
                  {getOrderT("amount")} (TRY) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-cultured rounded-lg text-xs font-semibold focus:outline-none focus:border-salmon-pink text-eerie-black shadow-inner"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold uppercase text-eerie-black tracking-wider">
                  {getOrderT("notes")}
                </label>
                <textarea
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-cultured rounded-lg text-xs font-semibold focus:outline-none focus:border-salmon-pink text-eerie-black shadow-inner h-20 resize-none"
                  placeholder="Ek açıklama varsa yazabilirsiniz..."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-cultured mt-2">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-5 py-2.5 bg-cultured hover:bg-spanish-gray/20 text-sonic-silver rounded-lg font-extrabold text-xs uppercase tracking-[0.5px] border-none cursor-pointer transition-colors"
                >
                  {getAddressT("cancel_btn")}
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="px-5 py-2.5 bg-salmon-pink hover:bg-eerie-black text-white rounded-lg font-extrabold text-xs uppercase tracking-[0.5px] border-none shadow-md cursor-pointer disabled:opacity-50 transition-colors"
                >
                  {submittingPayment ? "Gönderiliyor..." : getOrderT("submit_notification")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Refund Request Modal */}
      {isRefundModalOpen && (
        <div className="fixed inset-0 bg-[#0c0d10]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl animate-in scale-in duration-200 border border-cultured flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-cultured flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-eerie-black uppercase tracking-wider flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-salmon-pink" />
                {getOrderT("refund_modal_title")}
              </h3>
              <button
                type="button"
                onClick={() => setIsRefundModalOpen(false)}
                className="w-8 h-8 rounded-full border border-cultured text-sonic-silver hover:text-salmon-pink hover:bg-cultured transition-all bg-transparent flex items-center justify-center text-lg font-bold cursor-pointer"
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleSubmitRefund} className="flex-grow overflow-y-auto p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold uppercase text-eerie-black tracking-wider">
                  {getOrderT("refund_type")} *
                </label>
                <select
                  required
                  value={refundType}
                  onChange={(e) => setRefundType(e.target.value as "FULL" | "PARTIAL")}
                  className="w-full px-3.5 py-2.5 bg-white border border-cultured rounded-lg text-xs font-bold focus:outline-none focus:border-salmon-pink text-onyx cursor-pointer shadow-sm"
                >
                  <option value="FULL">{getOrderT("full_refund")}</option>
                  <option value="PARTIAL">{getOrderT("partial_refund")}</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold uppercase text-eerie-black tracking-wider">
                  {getOrderT("refund_reason")} *
                </label>
                <textarea
                  required
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-cultured rounded-lg text-xs font-semibold focus:outline-none focus:border-salmon-pink text-eerie-black shadow-inner h-20 resize-none"
                  placeholder="İade talep nedeninizi açıklayınız..."
                />
              </div>

              {/* Partial Refund Items Selection */}
              {refundType === "PARTIAL" && (
                <div className="flex flex-col gap-3 border-t border-cultured pt-4">
                  <label className="text-[10px] font-extrabold uppercase text-sonic-silver tracking-wider">
                    {getOrderT("refund_items_selection")}
                  </label>
                  
                  <div className="flex flex-col gap-3 max-h-48 overflow-y-auto pr-1">
                    {refundOrderItems.map((item) => {
                      const isSelected = !!refundSelectedItems[item.id];
                      return (
                        <div key={item.id} className="flex items-center gap-3 p-2 bg-[#fbfbfb] rounded-lg border border-cultured text-xs font-bold text-eerie-black">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleRefundItem(item.id)}
                            className="rounded text-salmon-pink focus:ring-salmon-pink cursor-pointer w-4 h-4"
                          />
                          <div className="flex-grow min-w-0">
                            <div className="truncate">{item.product_name}</div>
                            <div className="text-[10px] text-sonic-silver">SKU: {item.product_sku}</div>
                          </div>
                          
                          {isSelected && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] text-sonic-silver font-semibold">{getOrderT("quantity")}:</span>
                              <input
                                type="number"
                                min={1}
                                max={item.quantity}
                                value={refundQuantities[item.id] || 1}
                                onChange={(e) => handleRefundQtyChange(item.id, parseInt(e.target.value) || 1, item.quantity)}
                                className="w-16 px-1.5 py-1 bg-white border border-cultured rounded text-center text-xs font-bold text-eerie-black focus:outline-none focus:border-salmon-pink"
                              />
                              <span className="text-[10px] text-sonic-silver font-semibold">/ {item.quantity}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-cultured mt-2">
                <button
                  type="button"
                  onClick={() => setIsRefundModalOpen(false)}
                  className="px-5 py-2.5 bg-cultured hover:bg-spanish-gray/20 text-sonic-silver rounded-lg font-extrabold text-xs uppercase tracking-[0.5px] border-none cursor-pointer transition-colors"
                >
                  {getAddressT("cancel_btn")}
                </button>
                <button
                  type="submit"
                  disabled={submittingRefund}
                  className="px-5 py-2.5 bg-salmon-pink hover:bg-eerie-black text-white rounded-lg font-extrabold text-xs uppercase tracking-[0.5px] border-none shadow-md cursor-pointer disabled:opacity-50 transition-colors"
                >
                  {submittingRefund ? "Gönderiliyor..." : getOrderT("request_refund")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Footer lang={lang} />
    </div>
  );
}
