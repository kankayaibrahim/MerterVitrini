"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User, Settings, MapPin, Clipboard, Check, AlertCircle, Home, LogOut, Plus, Trash2, Edit3, Globe, Briefcase } from "lucide-react";
import { t } from "@/app/i18n";
import { Category, CartItem } from "@/types/store";
import { apiFetch } from "@/app/utils";

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
    address_line_label: "Pełny adres",
    tax_office_label: "Urząd Skarbowy",
    default_address_label: "Ustaw jako adres domyślny",
    no_addresses_found: "Brak zapisanych adresów.",
    address_delete_confirm: "Czy na pewno chcesz usunąć ten adres?",
    legacy_migration_notice: "W Twoim profilu znaleziono stare dane adresowe. Czy chcesz je automatycznie zaimportować do nowej książki adresowej?",
    migrate_addresses_btn: "Przenieś moje adresy",
    address_title_placeholder: "np. Magazyn Warszawa",
    tax_no_tckn_label: "NIP / PESEL",
    company_name_label: "Nazwa firmy / przedsiębiorstwa",
    first_name_label: "Imię odbiorcy",
    last_name_label: "Nazwisko odbiorcy",
    phone_label: "Numer telefonu odbiorcy",
    save_address_btn: "Zapisz adres",
    cancel_btn: "Anuluj",
    loading_addresses: "Wczytywanie adresów...",
    migration_success: "Twoje dotychczasowe adresy zostały pomyślnie przeniesione!",
    default_badge: "Domyślny",
    address_line_placeholder: "Ulica, numer budynku, mieszkania, kod, piętro i inne szczegóły...",
    tax_office_placeholder: "np. Urząd Skarbowy Warszawa Śródmieście",
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
    cancel_btn: "Annuler",
    loading_addresses: "Chargement des adresses...",
    migration_success: "Vos anciennes adresses ont été importées avec succès !",
    default_badge: "Par défaut",
    address_line_placeholder: "Nom de rue, numéro de bâtiment, appartement, étage, et autres précisions...",
    tax_office_placeholder: "ex. Centre des Impôts Paris 1er",
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
  address_line: string;
  tax_no_tckn?: string;
  tax_office?: string;
  is_default: boolean;
  country_name?: string;
  state_name?: string;
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

  // --- Address Book States ---
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [countries, setCountries] = useState<CountryLookup[]>([]);
  const [states, setStates] = useState<StateLookup[]>([]);
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
  const [formCountryID, setFormCountryID] = useState("");
  const [formStateID, setFormStateID] = useState("");
  const [formAddressLine, setFormAddressLine] = useState("");
  const [formTaxNo, setFormTaxNo] = useState("");
  const [formTaxOffice, setFormTaxOffice] = useState("");
  const [formIsDefault, setFormIsDefault] = useState(false);

  const [savingAddress, setSavingAddress] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [addressSuccess, setAddressSuccess] = useState<string | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);

  const getAddressT = (key: string): string => {
    const safeLang = addressTranslations[lang] ? lang : "tr";
    return addressTranslations[safeLang][key] || addressTranslations["tr"][key] || key;
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
      } else {
        setCheckingAuth(false);
        setLoadingProfile(false);
      }
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

  const handleCountryChange = (countryId: string) => {
    setFormCountryID(countryId);
    setFormStateID("");
    fetchStates(countryId);
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
      setFormTaxNo(address.tax_no_tckn || "");
      setFormTaxOffice(address.tax_office || "");
      setFormIsDefault(address.is_default);
      
      fetchStates(address.country_id).then(() => {
        setFormStateID(address.state_id || "");
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
      if (trCountry) {
        setFormCountryID(trCountry.id);
        fetchStates(trCountry.id);
      } else if (countries.length > 0) {
        setFormCountryID(countries[0].id);
        fetchStates(countries[0].id);
      }
      setFormStateID("");
      setFormAddressLine("");
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
    setSavingAddress(true);

    const payload = {
      title: formTitle,
      address_type: formType,
      first_name: formFirstName,
      last_name: formLastName,
      company_name: formCompany || null,
      phone: formPhone,
      country_id: formCountryID,
      state_id: formStateID || null,
      address_line: formAddressLine,
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
      alert(err.message);
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
    }
    router.push("/");
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
                <div className="flex items-center gap-3 px-3 py-2.5 bg-salmon-pink/5 rounded-lg border border-salmon-pink/20 text-salmon-pink text-xs font-bold text-left">
                  <User className="w-4 h-4" />
                  <span>{t("profile_details", lang)}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 px-3 py-2.5 text-sonic-silver hover:text-salmon-pink hover:bg-cultured transition-all rounded-lg text-xs font-bold text-left border-none bg-transparent cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{t("safe_logout", lang)}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Profile Edit Form Dashboard */}
          <div className="lg:col-span-3">
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
                  <input
                    type="tel"
                    required
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-cultured rounded-lg text-xs font-semibold focus:outline-none focus:border-salmon-pink focus:ring-salmon-pink transition-all shadow-inner text-eerie-black"
                    placeholder={t("placeholder_phone", lang)}
                  />
                </div>
              </div>

              {/* Country & State */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-extrabold uppercase text-eerie-black tracking-wider">
                    {getAddressT("state_label")}
                  </label>
                  <select
                    value={formStateID}
                    onChange={(e) => setFormStateID(e.target.value)}
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

      <Footer lang={lang} />
    </div>
  );
}
