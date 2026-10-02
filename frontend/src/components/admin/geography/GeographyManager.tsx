"use client";

import { useState, useEffect, useTransition, useCallback, type FormEvent } from "react";
import { 
  Plus, 
  Edit3, 
  Trash2, 
  Globe, 
  Check, 
  RefreshCw, 
  AlertTriangle,
  X,
  Search,
  MapPin,
  ChevronRight
} from "lucide-react";
import { Country, CountryState, CountryGroup, Currency, Language } from "@/types/integration";

// Strictly typed internationalized LABELS dictionary
const LABELS = {
  TITLE: "Coğrafi Tanımlar & Ülke Yönetimi",
  DESC: "E-ticaret alt yapımızın temelini oluşturacak ülkeleri, şehirleri/eyaletleri ve gümrük/kargo ülke gruplarını bu panelden yönetebilirsiniz.",
  TAB_GROUPS: "Ülke Grupları",
  TAB_COUNTRIES: "Ülkeler",
  TAB_STATES: "Şehirler / Eyaletler",
  TAB_CURRENCIES: "Para Birimleri",
  TAB_LANGUAGES: "Diller",
  
  ADD_GROUP: "Yeni Ülke Grubu Ekle",
  EDIT_GROUP: "Ülke Grubunu Düzenle",
  DELETE_GROUP: "Ülke Grubunu Sil",
  GROUP_CODE: "Grup Kodu (Örn: EU, EEU)",
  
  ADD_COUNTRY: "Yeni Ülke Tanımla",
  EDIT_COUNTRY: "Ülke Kartını Düzenle",
  DELETE_COUNTRY: "Ülke Kartını Sil",
  COUNTRY_CODE: "Ülke ISO Kodu (Örn: TR, DE, US)",
  PHONE_CODE: "Uluslararası Telefon Kodu (Örn: 90, 49)",
  
  ADD_STATE: "Yeni Şehir/Eyalet Ekle",
  EDIT_STATE: "Şehir/Eyalet Bilgisini Düzenle",
  DELETE_STATE: "Şehir/Eyalet Sil",
  STATE_CODE: "Şehir Plaka/Kodu (Örn: 34, CA)",
  STATE_NAME: "Şehir / Eyalet Adı",
  SELECT_COUNTRY: "Bağlı Olduğu Ülke",

  ADD_CURRENCY: "Yeni Para Birimi Tanımla",
  EDIT_CURRENCY: "Para Birimini Düzenle",
  DELETE_CURRENCY: "Para Birimini Sil",
  CURRENCY_NAME: "Para Birimi ISO Kodu (Örn: TRY, USD)",
  CURRENCY_SYMBOL: "Para Birimi Simgesi (Örn: ₺, $)",
  CURRENCY_FULL_NAME: "Para Birimi Unvanı (Örn: Türk Lirası)",

  ADD_LANGUAGE: "Yeni Sistem Dili Tanımla",
  EDIT_LANGUAGE: "Dil Kartını Düzenle",
  DELETE_LANGUAGE: "Dil Kartını Sil",
  LANG_CODE: "Dil ISO Kodu (Örn: tr_TR, en_US)",
  LANG_LABEL: "Dil Görünen Etiketi (Örn: Türkçe, English)",
  LANG_FLAG: "Bayrak Simge Kodu (Örn: tr, us)",
  LANG_PREFIX: "Dil URL Prefixi (Örn: tr, en)",
  LANG_DIR: "Metin Yazım Yönü (ltr, rtl)",
  LANG_DIR_LTR: "LTR (Soldan Sağa)",
  LANG_DIR_RTL: "RTL (Sağdan Sola)",
  SORT_ORDER: "Arayüz Sıralama Önceliği (Sort Order)",
  
  TR_NAME: "Türkçe İsim (tr_TR)",
  EN_NAME: "İngilizce İsim (en_US)",
  
  ACTIVE: "Aktif",
  SAVE: "Değişiklikleri Kaydet",
  CANCEL: "İptal",
  DELETE: "Sil",
  
  DELETE_GROUP_CONFIRM: "Bu ülke grubunu silmek istediğinize emin misiniz? Bu işlem gruptaki ülke bağlarını koparacaktır.",
  DELETE_COUNTRY_CONFIRM: "Bu ülkeyi silmek istediğinize emin misiniz? Bu işlem bu ülkeye bağlı TÜM şehirleri/eyaletleri de kalıcı olarak silecektir!",
  DELETE_STATE_CONFIRM: "Bu şehir/eyalet kaydını silmek istediğinize emin misiniz?",
  DELETE_CURRENCY_CONFIRM: "Bu para birimi tanımını silmek istediğinize emin misiniz?",
  DELETE_LANGUAGE_CONFIRM: "Bu sistem dili tanımını silmek istediğinize emin misiniz? Bu dili silmek storefront çevirilerini etkileyebilir!",
  
  SUCCESS_CREATED: "Kayıt başarıyla oluşturuldu.",
  SUCCESS_UPDATED: "Kayıt başarıyla güncellendi.",
  SUCCESS_DELETED: "Kayıt başarıyla silindi.",
  REQUIRED_FIELDS: "Lütfen gerekli tüm alanları doldurun.",
  REFRESH: "Yenile",
  NO_DATA: "Gösterilecek veri bulunamadı.",
  SEARCH_PLACEHOLDER: "Kod veya isim ile arayın...",
  CRITICAL_ACTION: "Kritik Eylem",
  CRITICAL_WARNING: "Bu işlem geri alınamaz ve bağlı olan tüm adres kayıtlarını/sipariş alt yapılarını etkileyebilir!",
  COL_COUNTRY_NAME: "Ülke İsmi (Türkçe / İngilizce)",
  COL_PHONE_CODE: "Telefon Kodu",
  COL_GROUP_NAME: "Grup İsmi (Türkçe / İngilizce)",
  NO_STATES_FOUND: "Bu ülkeye ait tanımlanmış şehir bulunamadı. Sihirbazı veya 'Yeni Şehir Ekle' butonunu kullanın.",
  SHOW_STATES: "Şehirlerini Göster",
  SELECT_COUNTRY_OPTION: "-- Ülke Seçin --",
  SELECT_COUNTRY_PROMPT: "Lütfen şehir listesini görmek için yukarıdan bir ülke seçin."
};

interface GeographyManagerProps {
  apiUrl: string;
  token: string | null;
}

const MODAL_TITLES: Record<string, string> = {
  create_group: LABELS.ADD_GROUP,
  edit_group: LABELS.EDIT_GROUP,
  delete_group: LABELS.DELETE_GROUP,
  create_country: LABELS.ADD_COUNTRY,
  edit_country: LABELS.EDIT_COUNTRY,
  delete_country: LABELS.DELETE_COUNTRY,
  create_state: LABELS.ADD_STATE,
  edit_state: LABELS.EDIT_STATE,
  delete_state: LABELS.DELETE_STATE,
  create_currency: LABELS.ADD_CURRENCY,
  edit_currency: LABELS.EDIT_CURRENCY,
  delete_currency: LABELS.DELETE_CURRENCY,
  create_language: LABELS.ADD_LANGUAGE,
  edit_language: LABELS.EDIT_LANGUAGE,
  delete_language: LABELS.DELETE_LANGUAGE,
};

const DELETE_CONFIRMATIONS: Record<string, string> = {
  delete_group: LABELS.DELETE_GROUP_CONFIRM,
  delete_country: LABELS.DELETE_COUNTRY_CONFIRM,
  delete_state: LABELS.DELETE_STATE_CONFIRM,
  delete_currency: LABELS.DELETE_CURRENCY_CONFIRM,
  delete_language: LABELS.DELETE_LANGUAGE_CONFIRM,
};

const ADD_BUTTON_LABELS: Record<string, string> = {
  countries: LABELS.ADD_COUNTRY,
  groups: LABELS.ADD_GROUP,
  states: LABELS.ADD_STATE,
  currencies: LABELS.ADD_CURRENCY,
  languages: LABELS.ADD_LANGUAGE,
};

function matchesSearch(q: string, values: (string | undefined | null)[]): boolean {
  if (!q) return true;
  const lower = q.toLowerCase();
  for (const v of values) {
    if (v?.toLowerCase().includes(lower)) return true;
  }
  return false;
}

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return fallback;
}

type TabType = "groups" | "countries" | "states" | "currencies" | "languages";

type ActiveModalType = 
  | "create_group" | "edit_group" | "delete_group"
  | "create_country" | "edit_country" | "delete_country"
  | "create_state" | "edit_state" | "delete_state"
  | "create_currency" | "edit_currency" | "delete_currency"
  | "create_language" | "edit_language" | "delete_language";

interface GroupFormFieldsProps {
  codeField: string;
  setCodeField: (val: string) => void;
  nameTrField: string;
  setNameTrField: (val: string) => void;
  nameEnField: string;
  setNameEnField: (val: string) => void;
}

function GroupFormFields({ codeField, setCodeField, nameTrField, setNameTrField, nameEnField, setNameEnField }: Readonly<GroupFormFieldsProps>) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{LABELS.GROUP_CODE}</label>
        <input
          type="text"
          value={codeField}
          onChange={(e) => setCodeField(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:border-violet-500 font-semibold"
          placeholder="Örn: EU"
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{LABELS.TR_NAME}</label>
        <input
          type="text"
          value={nameTrField}
          onChange={(e) => setNameTrField(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:border-violet-500 font-semibold"
          placeholder="Örn: Avrupa Birliği"
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{LABELS.EN_NAME}</label>
        <input
          type="text"
          value={nameEnField}
          onChange={(e) => setNameEnField(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:border-violet-500 font-semibold"
          placeholder="Örn: European Union"
          required
        />
      </div>
    </>
  );
}

interface CountryFormFieldsProps {
  codeField: string;
  setCodeField: (val: string) => void;
  phoneCodeField: number | "";
  setPhoneCodeField: (val: number | "") => void;
  nameTrField: string;
  setNameTrField: (val: string) => void;
  nameEnField: string;
  setNameEnField: (val: string) => void;
}

function CountryFormFields({
  codeField,
  setCodeField,
  phoneCodeField,
  setPhoneCodeField,
  nameTrField,
  setNameTrField,
  nameEnField,
  setNameEnField,
}: Readonly<CountryFormFieldsProps>) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{LABELS.COUNTRY_CODE}</label>
          <input
            type="text"
            value={codeField}
            onChange={(e) => setCodeField(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:border-violet-500 font-mono font-bold"
            placeholder="Örn: TR"
            maxLength={5}
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{LABELS.PHONE_CODE}</label>
          <input
            type="number"
            value={phoneCodeField}
            onChange={(e) => setPhoneCodeField(e.target.value !== "" ? Number(e.target.value) : "")}
            className="px-4 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:border-violet-500 font-semibold"
            placeholder="Örn: 90"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{LABELS.TR_NAME}</label>
        <input
          type="text"
          value={nameTrField}
          onChange={(e) => setNameTrField(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:border-violet-500 font-semibold"
          placeholder="Örn: Türkiye"
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{LABELS.EN_NAME}</label>
        <input
          type="text"
          value={nameEnField}
          onChange={(e) => setNameEnField(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:border-violet-500 font-semibold"
          placeholder="Örn: Turkey"
          required
        />
      </div>
    </>
  );
}

interface StateFormFieldsProps {
  codeField: string;
  setCodeField: (val: string) => void;
  stateNameField: string;
  setStateNameField: (val: string) => void;
  parentCountryId: string;
  setParentCountryId: (val: string) => void;
  countries: Country[];
}

function StateFormFields({
  codeField,
  setCodeField,
  stateNameField,
  setStateNameField,
  parentCountryId,
  setParentCountryId,
  countries,
}: Readonly<StateFormFieldsProps>) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{LABELS.SELECT_COUNTRY}</label>
        <select
          value={parentCountryId}
          onChange={(e) => setParentCountryId(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:border-violet-500 font-semibold"
          required
        >
          <option value="">-- Ülke Seçin --</option>
          {countries.map((c) => (
            <option key={c.id} value={c.id}>
              {c.names?.tr_TR || c.names?.en_US} ({c.code})
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-1 flex flex-col gap-1.5">
          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{LABELS.STATE_CODE}</label>
          <input
            type="text"
            value={codeField}
            onChange={(e) => setCodeField(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:border-violet-500 font-mono font-bold"
            placeholder="Örn: 34"
            required
          />
        </div>

        <div className="col-span-2 flex flex-col gap-1.5">
          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{LABELS.STATE_NAME}</label>
          <input
            type="text"
            value={stateNameField}
            onChange={(e) => setStateNameField(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:border-violet-500 font-semibold"
            placeholder="Örn: İstanbul"
            required
          />
        </div>
      </div>
    </>
  );
}

interface CurrencyFormFieldsProps {
  currencyName: string;
  setCurrencyName: (val: string) => void;
  currencySymbol: string;
  setCurrencySymbol: (val: string) => void;
  currencyFullName: string;
  setCurrencyFullName: (val: string) => void;
  currencyActive: boolean;
  setCurrencyActive: (val: boolean) => void;
}

function CurrencyFormFields({
  currencyName,
  setCurrencyName,
  currencySymbol,
  setCurrencySymbol,
  currencyFullName,
  setCurrencyFullName,
  currencyActive,
  setCurrencyActive,
}: Readonly<CurrencyFormFieldsProps>) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{LABELS.CURRENCY_NAME}</label>
          <input
            type="text"
            value={currencyName}
            onChange={(e) => setCurrencyName(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:border-violet-500 font-mono font-bold"
            placeholder="Örn: TRY"
            maxLength={5}
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{LABELS.CURRENCY_SYMBOL}</label>
          <input
            type="text"
            value={currencySymbol}
            onChange={(e) => setCurrencySymbol(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:border-violet-500 font-bold"
            placeholder="Örn: ₺"
            required
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{LABELS.CURRENCY_FULL_NAME}</label>
        <input
          type="text"
          value={currencyFullName}
          onChange={(e) => setCurrencyFullName(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:border-violet-500 font-semibold"
          placeholder="Örn: Türk Lirası"
          required
        />
      </div>

      <div className="flex items-center gap-2 mt-2">
        <input
          type="checkbox"
          id="currencyActive"
          checked={currencyActive}
          onChange={(e) => setCurrencyActive(e.target.checked)}
          className="w-4 h-4 text-violet-600 border-zinc-300 rounded focus:ring-violet-500"
        />
        <label htmlFor="currencyActive" className="text-xs font-bold text-zinc-600 uppercase cursor-pointer select-none">
          {LABELS.ACTIVE}
        </label>
      </div>
    </>
  );
}

interface LanguageFormFieldsProps {
  langCode: string;
  setLangCode: (val: string) => void;
  langLabel: string;
  setLangLabel: (val: string) => void;
  langFlag: string;
  setLangFlag: (val: string) => void;
  langCategoryPrefix: string;
  setLangCategoryPrefix: (val: string) => void;
  langDir: string;
  setLangDir: (val: string) => void;
  langSortOrder: number;
  setLangSortOrder: (val: number) => void;
  langIsActive: boolean;
  setLangIsActive: (val: boolean) => void;
}

function LanguageFormFields({
  langCode,
  setLangCode,
  langLabel,
  setLangLabel,
  langFlag,
  setLangFlag,
  langCategoryPrefix,
  setLangCategoryPrefix,
  langDir,
  setLangDir,
  langSortOrder,
  setLangSortOrder,
  langIsActive,
  setLangIsActive,
}: Readonly<LanguageFormFieldsProps>) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{LABELS.LANG_CODE}</label>
          <input
            type="text"
            value={langCode}
            onChange={(e) => setLangCode(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:border-violet-500 font-mono font-bold"
            placeholder="Örn: tr_TR"
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{LABELS.LANG_LABEL}</label>
          <input
            type="text"
            value={langLabel}
            onChange={(e) => setLangLabel(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:border-violet-500 font-semibold"
            placeholder="Örn: Türkçe"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{LABELS.LANG_FLAG}</label>
          <input
            type="text"
            value={langFlag}
            onChange={(e) => setLangFlag(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:border-violet-500 font-semibold"
            placeholder="Örn: tr"
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{LABELS.LANG_PREFIX}</label>
          <input
            type="text"
            value={langCategoryPrefix}
            onChange={(e) => setLangCategoryPrefix(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:border-violet-500 font-mono"
            placeholder="Örn: tr"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{LABELS.LANG_DIR}</label>
          <select
            value={langDir}
            onChange={(e) => setLangDir(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:border-violet-500 font-semibold"
          >
            <option value="ltr">{LABELS.LANG_DIR_LTR}</option>
            <option value="rtl">{LABELS.LANG_DIR_RTL}</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{LABELS.SORT_ORDER}</label>
          <input
            type="number"
            value={langSortOrder}
            onChange={(e) => setLangSortOrder(Number(e.target.value))}
            className="px-4 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:border-violet-500 font-semibold"
            required
          />
        </div>
      </div>

      <div className="flex items-center gap-2 mt-2">
        <input
          type="checkbox"
          id="langIsActive"
          checked={langIsActive}
          onChange={(e) => setLangIsActive(e.target.checked)}
          className="w-4 h-4 text-violet-600 border-zinc-300 rounded focus:ring-violet-500"
        />
        <label htmlFor="langIsActive" className="text-xs font-bold text-zinc-600 uppercase cursor-pointer select-none">
          {LABELS.ACTIVE}
        </label>
      </div>
    </>
  );
}

function DeleteConfirmation({ activeModal }: Readonly<{ activeModal: string }>) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-zinc-600 text-sm leading-relaxed">
        {DELETE_CONFIRMATIONS[activeModal] || ""}
      </p>
      <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 flex gap-3 text-xs font-medium">
        <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold block text-amber-800 mb-0.5">{LABELS.CRITICAL_ACTION}</span>
          <span>{LABELS.CRITICAL_WARNING}</span>
        </div>
      </div>
    </div>
  );
}

interface GeographyModalProps {
  activeModal: ActiveModalType;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
  isPending: boolean;
  formError: string | null;
  codeField: string;
  setCodeField: (val: string) => void;
  phoneCodeField: number | "";
  setPhoneCodeField: (val: number | "") => void;
  nameTrField: string;
  setNameTrField: (val: string) => void;
  nameEnField: string;
  setNameEnField: (val: string) => void;
  stateNameField: string;
  setStateNameField: (val: string) => void;
  parentCountryId: string;
  setParentCountryId: (val: string) => void;
  countries: Country[];
  currencyName: string;
  setCurrencyName: (val: string) => void;
  currencySymbol: string;
  setCurrencySymbol: (val: string) => void;
  currencyFullName: string;
  setCurrencyFullName: (val: string) => void;
  currencyActive: boolean;
  setCurrencyActive: (val: boolean) => void;
  langCode: string;
  setLangCode: (val: string) => void;
  langLabel: string;
  setLangLabel: (val: string) => void;
  langFlag: string;
  setLangFlag: (val: string) => void;
  langCategoryPrefix: string;
  setLangCategoryPrefix: (val: string) => void;
  langDir: string;
  setLangDir: (val: string) => void;
  langSortOrder: number;
  setLangSortOrder: (val: number) => void;
  langIsActive: boolean;
  setLangIsActive: (val: boolean) => void;
}

function GeographyModal(props: Readonly<GeographyModalProps>) {
  const {
    activeModal,
    onClose,
    onSubmit,
    isPending,
    formError,
    codeField,
    setCodeField,
    phoneCodeField,
    setPhoneCodeField,
    nameTrField,
    setNameTrField,
    nameEnField,
    setNameEnField,
    stateNameField,
    setStateNameField,
    parentCountryId,
    setParentCountryId,
    countries,
    currencyName,
    setCurrencyName,
    currencySymbol,
    setCurrencySymbol,
    currencyFullName,
    setCurrencyFullName,
    currencyActive,
    setCurrencyActive,
    langCode,
    setLangCode,
    langLabel,
    setLangLabel,
    langFlag,
    setLangFlag,
    langCategoryPrefix,
    setLangCategoryPrefix,
    langDir,
    setLangDir,
    langSortOrder,
    setLangSortOrder,
    langIsActive,
    setLangIsActive,
  } = props;

  const isDelete = activeModal.startsWith("delete");

  const renderFormFields = () => {
    if (isDelete) {
      return <DeleteConfirmation activeModal={activeModal} />;
    }
    if (activeModal.endsWith("_group")) {
      return (
        <GroupFormFields
          codeField={codeField}
          setCodeField={setCodeField}
          nameTrField={nameTrField}
          setNameTrField={setNameTrField}
          nameEnField={nameEnField}
          setNameEnField={setNameEnField}
        />
      );
    }
    if (activeModal.endsWith("_country")) {
      return (
        <CountryFormFields
          codeField={codeField}
          setCodeField={setCodeField}
          phoneCodeField={phoneCodeField}
          setPhoneCodeField={setPhoneCodeField}
          nameTrField={nameTrField}
          setNameTrField={setNameTrField}
          nameEnField={nameEnField}
          setNameEnField={setNameEnField}
        />
      );
    }
    if (activeModal.endsWith("_state")) {
      return (
        <StateFormFields
          codeField={codeField}
          setCodeField={setCodeField}
          stateNameField={stateNameField}
          setStateNameField={setStateNameField}
          parentCountryId={parentCountryId}
          setParentCountryId={setParentCountryId}
          countries={countries}
        />
      );
    }
    if (activeModal.endsWith("_currency")) {
      return (
        <CurrencyFormFields
          currencyName={currencyName}
          setCurrencyName={setCurrencyName}
          currencySymbol={currencySymbol}
          setCurrencySymbol={setCurrencySymbol}
          currencyFullName={currencyFullName}
          setCurrencyFullName={setCurrencyFullName}
          currencyActive={currencyActive}
          setCurrencyActive={setCurrencyActive}
        />
      );
    }
    if (activeModal.endsWith("_language")) {
      return (
        <LanguageFormFields
          langCode={langCode}
          setLangCode={setLangCode}
          langLabel={langLabel}
          setLangLabel={setLangLabel}
          langFlag={langFlag}
          setLangFlag={setLangFlag}
          langCategoryPrefix={langCategoryPrefix}
          setLangCategoryPrefix={setLangCategoryPrefix}
          langDir={langDir}
          setLangDir={setLangDir}
          langSortOrder={langSortOrder}
          setLangSortOrder={setLangSortOrder}
          langIsActive={langIsActive}
          setLangIsActive={setLangIsActive}
        />
      );
    }
    return null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 backdrop-blur-sm p-4 animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-zinc-100 max-w-lg w-full overflow-hidden shadow-2xl flex flex-col my-8 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100 bg-zinc-50/50 shrink-0">
          <h3 className="font-bold text-lg text-zinc-900">
            {MODAL_TITLES[activeModal] || ""}
          </h3>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-200/50 text-zinc-400 hover:text-zinc-600 transition-colors cursor-pointer"
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col">
          <div className="p-6 flex flex-col gap-4">
            {formError && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-2xl text-xs font-semibold">
                <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}
            {renderFormFields()}
          </div>

          <div className="px-6 py-4 border-t border-zinc-100 bg-zinc-50/50 flex justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-zinc-200 text-zinc-600 hover:bg-zinc-100 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              {LABELS.CANCEL}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className={`px-5 py-2 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer ${
                isDelete
                  ? "bg-red-600 hover:bg-red-700" 
                  : "bg-violet-600 hover:bg-violet-700"
              }`}
            >
              {isPending && <RefreshCw size={12} className="animate-spin" />}
              {isDelete ? LABELS.DELETE : LABELS.SAVE}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function GeographyManager({ apiUrl, token }: Readonly<GeographyManagerProps>) {
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<TabType>("countries");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Data States
  const [countries, setCountries] = useState<Country[]>([]);
  const [groups, setGroups] = useState<CountryGroup[]>([]);
  const [states, setStates] = useState<CountryState[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  
  // Specific Filters
  const [selectedCountryFilter, setSelectedCountryFilter] = useState<string>("");
  
  // Modals state
  const [activeModal, setActiveModal] = useState<ActiveModalType | null>(null);
  
  const [selectedGroup, setSelectedGroup] = useState<CountryGroup | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [selectedState, setSelectedState] = useState<CountryState | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState<Currency | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<Language | null>(null);

  // Form Fields (Common & Geographic)
  const [codeField, setCodeField] = useState("");
  const [phoneCodeField, setPhoneCodeField] = useState<number | "">("");
  const [nameTrField, setNameTrField] = useState("");
  const [nameEnField, setNameEnField] = useState("");
  const [stateNameField, setStateNameField] = useState("");
  const [parentCountryId, setParentCountryId] = useState("");

  // Form Fields (Currency)
  const [currencyName, setCurrencyName] = useState("");
  const [currencySymbol, setCurrencySymbol] = useState("");
  const [currencyFullName, setCurrencyFullName] = useState("");
  const [currencyActive, setCurrencyActive] = useState(true);

  // Form Fields (Language)
  const [langCode, setLangCode] = useState("");
  const [langLabel, setLangLabel] = useState("");
  const [langFlag, setLangFlag] = useState("");
  const [langCategoryPrefix, setLangCategoryPrefix] = useState("");
  const [langDir, setLangDir] = useState("ltr");
  const [langIsActive, setLangIsActive] = useState(true);
  const [langSortOrder, setLangSortOrder] = useState<number>(0);

  // Status indicators
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);


  // Safe API Request Helper
  const apiRequest = useCallback(async <T = unknown>(path: string, method: string, body?: unknown): Promise<T | null> => {
    const headers = new Headers({
      "Content-Type": "application/json"
    });
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(`${apiUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      const errData = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(errData.error || `HTTP ${response.status}`);
    }

    if (response.status === 204) return null;
    return response.json() as Promise<T>;
  }, [apiUrl, token]);

  const showToast = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => {
      setSuccessMessage(null);
    }, 3000);
  };

  // Loaders
  const loadCountries = async () => {
    try {
      const data = await apiRequest<Country[]>("/api/v1/countries", "GET");
      setCountries(data || []);
      // Pre-select first country for states filter if not set
      if (data && data.length > 0) {
        setSelectedCountryFilter((prev: string) => prev || data[0].id);
      }
    } catch (err: unknown) {
      console.error("Failed to load countries:", err);
    }
  };

  const loadGroups = async () => {
    try {
      const data = await apiRequest<CountryGroup[]>("/api/v1/country-groups", "GET");
      setGroups(data || []);
    } catch (err: unknown) {
      console.error("Failed to load country groups:", err);
    }
  };

  const loadStates = async (countryId: string) => {
    if (!countryId) return;
    try {
      const data = await apiRequest<CountryState[]>(`/api/v1/countries/${countryId}/states`, "GET");
      setStates(data || []);
    } catch (err: unknown) {
      console.error("Failed to load states:", err);
    }
  };

  const loadCurrencies = async () => {
    try {
      const data = await apiRequest<Currency[]>("/api/v1/currencies", "GET");
      setCurrencies(data || []);
    } catch (err: unknown) {
      console.error("Failed to load currencies:", err);
    }
  };

  const loadLanguages = async () => {
    try {
      const data = await apiRequest<Language[]>("/api/v1/languages", "GET");
      setLanguages(data || []);
    } catch (err: unknown) {
      console.error("Failed to load languages:", err);
    }
  };

  // Initial Load trigger
  useEffect(() => {
    let isMounted = true;
    if (token) {
      void apiRequest<Country[]>("/api/v1/countries", "GET").then((data: Country[] | null) => {
        if (!isMounted) return;
        setCountries(data || []);
        if (data && data.length > 0) {
          setSelectedCountryFilter((prev: string) => prev || data[0].id);
        }
      }).catch((err: unknown) => console.error("Failed to load countries:", err));

      void apiRequest<CountryGroup[]>("/api/v1/country-groups", "GET").then((data: CountryGroup[] | null) => {
        if (isMounted) setGroups(data || []);
      }).catch((err: unknown) => console.error("Failed to load country groups:", err));

      void apiRequest<Currency[]>("/api/v1/currencies", "GET").then((data: Currency[] | null) => {
        if (isMounted) setCurrencies(data || []);
      }).catch((err: unknown) => console.error("Failed to load currencies:", err));

      void apiRequest<Language[]>("/api/v1/languages", "GET").then((data: Language[] | null) => {
        if (isMounted) setLanguages(data || []);
      }).catch((err: unknown) => console.error("Failed to load languages:", err));
    }
    return () => {
      isMounted = false;
    };
  }, [token, apiRequest]);

  // Load states when country filter changes
  useEffect(() => {
    let isMounted = true;
    if (token && selectedCountryFilter) {
      void apiRequest<CountryState[]>(`/api/v1/countries/${selectedCountryFilter}/states`, "GET").then((data: CountryState[] | null) => {
        if (isMounted) setStates(data || []);
      }).catch((err: unknown) => console.error("Failed to load states:", err));
    }
    return () => {
      isMounted = false;
    };
  }, [selectedCountryFilter, token, apiRequest]);

  const handleRefresh = () => {
    startTransition(async () => {
      const refreshMap: Record<string, () => Promise<void>> = {
        countries: loadCountries,
        groups: loadGroups,
        states: async () => {
          if (selectedCountryFilter) await loadStates(selectedCountryFilter);
        },
        currencies: loadCurrencies,
        languages: loadLanguages,
      };
      await refreshMap[activeTab]?.();
    });
  };


  // Open modals helper
  const openCreateGroup = () => {
    setCodeField("");
    setNameTrField("");
    setNameEnField("");
    setFormError(null);
    setActiveModal("create_group");
  };

  const openEditGroup = (g: CountryGroup) => {
    setSelectedGroup(g);
    setCodeField(g.code);
    setNameTrField(g.names?.tr_TR || "");
    setNameEnField(g.names?.en_US || "");
    setFormError(null);
    setActiveModal("edit_group");
  };

  const openDeleteGroup = (g: CountryGroup) => {
    setSelectedGroup(g);
    setFormError(null);
    setActiveModal("delete_group");
  };

  const openCreateCountry = () => {
    setCodeField("");
    setPhoneCodeField("");
    setNameTrField("");
    setNameEnField("");
    setFormError(null);
    setActiveModal("create_country");
  };

  const openEditCountry = (c: Country) => {
    setSelectedCountry(c);
    setCodeField(c.code);
    setPhoneCodeField(c.phone_code || "");
    setNameTrField(c.names?.tr_TR || "");
    setNameEnField(c.names?.en_US || "");
    setFormError(null);
    setActiveModal("edit_country");
  };

  const openDeleteCountry = (c: Country) => {
    setSelectedCountry(c);
    setFormError(null);
    setActiveModal("delete_country");
  };

  const openCreateState = () => {
    setCodeField("");
    setStateNameField("");
    setParentCountryId(selectedCountryFilter);
    setFormError(null);
    setActiveModal("create_state");
  };

  const openEditState = (s: CountryState) => {
    setSelectedState(s);
    setCodeField(s.code);
    setStateNameField(s.name);
    setParentCountryId(s.country_id);
    setFormError(null);
    setActiveModal("edit_state");
  };

  const openDeleteState = (s: CountryState) => {
    setSelectedState(s);
    setFormError(null);
    setActiveModal("delete_state");
  };

  const openCreateCurrency = () => {
    setCurrencyName("");
    setCurrencySymbol("");
    setCurrencyFullName("");
    setCurrencyActive(true);
    setFormError(null);
    setActiveModal("create_currency");
  };

  const openEditCurrency = (c: Currency) => {
    setSelectedCurrency(c);
    setCurrencyName(c.name);
    setCurrencySymbol(c.symbol);
    setCurrencyFullName(c.full_name);
    setCurrencyActive(c.active);
    setFormError(null);
    setActiveModal("edit_currency");
  };

  const openDeleteCurrency = (c: Currency) => {
    setSelectedCurrency(c);
    setFormError(null);
    setActiveModal("delete_currency");
  };

  const openCreateLanguage = () => {
    setLangCode("");
    setLangLabel("");
    setLangFlag("");
    setLangCategoryPrefix("");
    setLangDir("ltr");
    setLangIsActive(true);
    setLangSortOrder(0);
    setFormError(null);
    setActiveModal("create_language");
  };

  const openEditLanguage = (l: Language) => {
    setSelectedLanguage(l);
    setLangCode(l.code);
    setLangLabel(l.label);
    setLangFlag(l.flag);
    setLangCategoryPrefix(l.categoryPrefix);
    setLangDir(l.dir);
    setLangIsActive(l.isActive);
    setLangSortOrder(l.sortOrder);
    setFormError(null);
    setActiveModal("edit_language");
  };

  const openDeleteLanguage = (l: Language) => {
    setSelectedLanguage(l);
    setFormError(null);
    setActiveModal("delete_language");
  };

  const handleGroupSubmit = () => {
    if (activeModal === "create_group" || activeModal === "edit_group") {
      if (!codeField.trim() || !nameTrField.trim() || !nameEnField.trim()) {
        setFormError(LABELS.REQUIRED_FIELDS);
        return;
      }
      const payload = {
        code: codeField.trim(),
        names: {
          tr_TR: nameTrField.trim(),
          en_US: nameEnField.trim()
        }
      };
      startTransition(async () => {
        try {
          if (activeModal === "create_group") {
            await apiRequest("/api/v1/country-groups", "POST", payload);
          } else if (activeModal === "edit_group" && selectedGroup) {
            await apiRequest(`/api/v1/country-groups/${selectedGroup.id}`, "PUT", payload);
          }
          showToast(activeModal === "create_group" ? LABELS.SUCCESS_CREATED : LABELS.SUCCESS_UPDATED);
          setActiveModal(null);
          await loadGroups();
        } catch (err: unknown) {
          setFormError(getErrorMessage(err, "İşlem başarısız."));
        }
      });
      return;
    }

    if (activeModal === "delete_group" && selectedGroup) {
      startTransition(async () => {
        try {
          await apiRequest(`/api/v1/country-groups/${selectedGroup.id}`, "DELETE");
          showToast(LABELS.SUCCESS_DELETED);
          setActiveModal(null);
          await loadGroups();
        } catch (err: unknown) {
          setFormError(getErrorMessage(err, "Silme işlemi başarısız."));
        }
      });
    }
  };

  const handleCountrySubmit = () => {
    if (activeModal === "create_country" || activeModal === "edit_country") {
      if (!codeField.trim() || !nameTrField.trim() || !nameEnField.trim()) {
        setFormError(LABELS.REQUIRED_FIELDS);
        return;
      }
      const payload = {
        code: codeField.trim(),
        phone_code: phoneCodeField !== "" ? Number(phoneCodeField) : null,
        names: {
          tr_TR: nameTrField.trim(),
          en_US: nameEnField.trim()
        }
      };
      startTransition(async () => {
        try {
          if (activeModal === "create_country") {
            await apiRequest("/api/v1/countries", "POST", payload);
          } else if (activeModal === "edit_country" && selectedCountry) {
            await apiRequest(`/api/v1/countries/${selectedCountry.id}`, "PUT", payload);
          }
          showToast(activeModal === "create_country" ? LABELS.SUCCESS_CREATED : LABELS.SUCCESS_UPDATED);
          setActiveModal(null);
          await loadCountries();
        } catch (err: unknown) {
          setFormError(getErrorMessage(err, "İşlem başarısız."));
        }
      });
      return;
    }

    if (activeModal === "delete_country" && selectedCountry) {
      startTransition(async () => {
        try {
          await apiRequest(`/api/v1/countries/${selectedCountry.id}`, "DELETE");
          showToast(LABELS.SUCCESS_DELETED);
          setActiveModal(null);
          await loadCountries();
          if (selectedCountryFilter === selectedCountry.id) {
            setSelectedCountryFilter("");
          }
        } catch (err: unknown) {
          setFormError(getErrorMessage(err, "Silme işlemi başarısız."));
        }
      });
    }
  };

  const handleStateSubmit = () => {
    if (activeModal === "create_state" || activeModal === "edit_state") {
      if (!codeField.trim() || !stateNameField.trim() || !parentCountryId) {
        setFormError(LABELS.REQUIRED_FIELDS);
        return;
      }
      const payload = {
        country_id: parentCountryId,
        code: codeField.trim(),
        name: stateNameField.trim()
      };
      startTransition(async () => {
        try {
          if (activeModal === "create_state") {
            await apiRequest("/api/v1/countries/states", "POST", payload);
          } else if (activeModal === "edit_state" && selectedState) {
            await apiRequest(`/api/v1/countries/states/${selectedState.id}`, "PUT", payload);
          }
          showToast(activeModal === "create_state" ? LABELS.SUCCESS_CREATED : LABELS.SUCCESS_UPDATED);
          setActiveModal(null);
          await loadStates(parentCountryId);
          setSelectedCountryFilter(parentCountryId);
        } catch (err: unknown) {
          setFormError(getErrorMessage(err, "İşlem başarısız."));
        }
      });
      return;
    }

    if (activeModal === "delete_state" && selectedState) {
      startTransition(async () => {
        try {
          await apiRequest(`/api/v1/countries/states/${selectedState.id}`, "DELETE");
          showToast(LABELS.SUCCESS_DELETED);
          setActiveModal(null);
          await loadStates(selectedCountryFilter);
        } catch (err: unknown) {
          setFormError(getErrorMessage(err, "Silme işlemi başarısız."));
        }
      });
    }
  };

  const handleCurrencySubmit = () => {
    if (activeModal === "create_currency" || activeModal === "edit_currency") {
      if (!currencyName.trim() || !currencySymbol.trim() || !currencyFullName.trim()) {
        setFormError(LABELS.REQUIRED_FIELDS);
        return;
      }
      const payload = {
        name: currencyName.trim(),
        symbol: currencySymbol.trim(),
        full_name: currencyFullName.trim(),
        active: currencyActive
      };
      startTransition(async () => {
        try {
          if (activeModal === "create_currency") {
            await apiRequest("/api/v1/currencies", "POST", payload);
          } else if (activeModal === "edit_currency" && selectedCurrency) {
            await apiRequest(`/api/v1/currencies/${selectedCurrency.id}`, "PUT", payload);
          }
          showToast(activeModal === "create_currency" ? LABELS.SUCCESS_CREATED : LABELS.SUCCESS_UPDATED);
          setActiveModal(null);
          await loadCurrencies();
        } catch (err: unknown) {
          setFormError(getErrorMessage(err, "İşlem başarısız."));
        }
      });
      return;
    }

    if (activeModal === "delete_currency" && selectedCurrency) {
      startTransition(async () => {
        try {
          await apiRequest(`/api/v1/currencies/${selectedCurrency.id}`, "DELETE");
          showToast(LABELS.SUCCESS_DELETED);
          setActiveModal(null);
          await loadCurrencies();
        } catch (err: unknown) {
          setFormError(getErrorMessage(err, "Silme işlemi başarısız."));
        }
      });
    }
  };

  const handleLanguageSubmit = () => {
    if (activeModal === "create_language" || activeModal === "edit_language") {
      if (!langCode.trim() || !langLabel.trim() || !langFlag.trim() || !langCategoryPrefix.trim()) {
        setFormError(LABELS.REQUIRED_FIELDS);
        return;
      }
      const payload = {
        code: langCode.trim(),
        label: langLabel.trim(),
        flag: langFlag.trim(),
        categoryPrefix: langCategoryPrefix.trim(),
        dir: langDir,
        isActive: langIsActive,
        sortOrder: Number(langSortOrder)
      };
      startTransition(async () => {
        try {
          if (activeModal === "create_language") {
            await apiRequest("/api/v1/languages", "POST", payload);
          } else if (activeModal === "edit_language" && selectedLanguage) {
            await apiRequest(`/api/v1/languages/${selectedLanguage.id}`, "PUT", payload);
          }
          showToast(activeModal === "create_language" ? LABELS.SUCCESS_CREATED : LABELS.SUCCESS_UPDATED);
          setActiveModal(null);
          await loadLanguages();
        } catch (err: unknown) {
          setFormError(getErrorMessage(err, "İşlem başarısız."));
        }
      });
      return;
    }

    if (activeModal === "delete_language" && selectedLanguage) {
      startTransition(async () => {
        try {
          await apiRequest(`/api/v1/languages/${selectedLanguage.id}`, "DELETE");
          showToast(LABELS.SUCCESS_DELETED);
          setActiveModal(null);
          await loadLanguages();
        } catch (err: unknown) {
          setFormError(getErrorMessage(err, "Silme işlemi başarısız."));
        }
      });
    }
  };

  // Submit operations
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!activeModal) return;

    const modalSubmitActions: Record<string, () => void> = {
      group: handleGroupSubmit,
      country: handleCountrySubmit,
      state: handleStateSubmit,
      currency: handleCurrencySubmit,
      language: handleLanguageSubmit,
    };

    const actionKey = activeModal.split("_")[1];
    modalSubmitActions[actionKey]?.();
  };

  const handleOpenCreateModal = () => {
    const actions: Record<string, () => void> = {
      countries: openCreateCountry,
      groups: openCreateGroup,
      states: openCreateState,
      currencies: openCreateCurrency,
      languages: openCreateLanguage,
    };
    actions[activeTab]?.();
  };

  // Searching logic
  const filteredCountries = countries.filter((c: Country) => matchesSearch(searchQuery, [c.code, c.names?.tr_TR, c.names?.en_US]));
  const filteredGroups = groups.filter((g: CountryGroup) => matchesSearch(searchQuery, [g.code, g.names?.tr_TR, g.names?.en_US]));
  const filteredStates = states.filter((s: CountryState) => matchesSearch(searchQuery, [s.code, s.name]));
  const filteredCurrencies = currencies.filter((c: Currency) => matchesSearch(searchQuery, [c.name, c.full_name, c.symbol]));
  const filteredLanguages = languages.filter((l: Language) => matchesSearch(searchQuery, [l.code, l.label, l.flag, l.categoryPrefix]));

  const renderStatesTableBody = () => {
    if (!selectedCountryFilter) {
      return (
        <tr>
          <td colSpan={3} className="py-12 text-center text-zinc-400 italic font-medium">
            {LABELS.SELECT_COUNTRY_PROMPT}
          </td>
        </tr>
      );
    }
    if (filteredStates.length === 0) {
      return (
        <tr>
          <td colSpan={3} className="py-12 text-center text-zinc-400 italic font-medium">
            {LABELS.NO_STATES_FOUND}
          </td>
        </tr>
      );
    }
    return filteredStates.map((s: CountryState) => (
      <tr key={s.id} className="hover:bg-zinc-50/50 transition-colors">
        <td className="py-4 px-6 font-mono font-bold text-violet-600">{s.code || "-"}</td>
        <td className="py-4 px-6 font-bold text-zinc-800">{s.name}</td>
        <td className="py-4 px-6 text-right">
          <div className="flex items-center justify-end gap-1.5">
            <button
              onClick={() => openEditState(s)}
              className="p-1.5 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              title={LABELS.EDIT_STATE}
            >
              <Edit3 size={15} />
            </button>
            <button
              onClick={() => openDeleteState(s)}
              className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              title={LABELS.DELETE_STATE}
            >
              <Trash2 size={15} />
            </button>
          </div>
        </td>
      </tr>
    ));
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="glass-card bg-white p-6 rounded-3xl border border-zinc-200/50 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
            <Globe className="text-violet-600 animate-spin-slow" size={24} />
            {LABELS.TITLE}
          </h2>
          <p className="text-sm text-zinc-500 mt-1">{LABELS.DESC}</p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
          <button
            onClick={handleRefresh}
            disabled={isPending}
            className="p-2.5 border border-zinc-200 rounded-xl hover:bg-zinc-50 text-zinc-600 transition-colors bg-white shadow-sm flex items-center justify-center gap-1.5 text-sm font-semibold cursor-pointer"
            type="button"
          >
            <RefreshCw size={15} className={isPending ? "animate-spin" : ""} />
            {LABELS.REFRESH}
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-semibold text-sm shadow-md hover:shadow-lg hover:shadow-violet-600/10 transition-all cursor-pointer"
            type="button"
          >
            <Plus size={16} />
            {ADD_BUTTON_LABELS[activeTab]}
          </button>
        </div>
      </div>

      {/* Tabs list & Search Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200/50 pb-2">
        <div className="flex gap-6">
          {[
            { id: "countries", label: `${LABELS.TAB_COUNTRIES} (${countries.length})` },
            { id: "states", label: LABELS.TAB_STATES },
            { id: "groups", label: `${LABELS.TAB_GROUPS} (${groups.length})` },
            { id: "currencies", label: `${LABELS.TAB_CURRENCIES} (${currencies.length})` },
            { id: "languages", label: `${LABELS.TAB_LANGUAGES} (${languages.length})` },
          ].map((tab) => (
            <button 
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as TabType);
                setSearchQuery("");
              }}
              className={`pb-2 text-sm font-bold transition-all relative cursor-pointer ${
                activeTab === tab.id 
                  ? "text-violet-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-violet-600" 
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Real-time search bar */}
        <div className="relative w-full sm:w-72 shrink-0">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
            <Search size={16} />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-white border border-zinc-200/60 rounded-xl focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20 text-xs font-semibold shadow-sm transition-all"
            placeholder={LABELS.SEARCH_PLACEHOLDER}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-600 transition-colors cursor-pointer"
              type="button"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Success alert message */}
      {successMessage && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl animate-in fade-in slide-in-from-top-4 duration-300 shadow-sm">
          <Check size={18} className="text-emerald-600 shrink-0" />
          <span className="text-sm font-semibold">{successMessage}</span>
        </div>
      )}

      {/* CONTENT LIST PANELS */}

      {/* 1. COUNTRIES LISTING */}
      {activeTab === "countries" && (
        <div className="bg-white rounded-3xl border border-zinc-200/50 shadow-sm overflow-hidden animate-in fade-in duration-200">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-100 text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                <th className="py-4 px-6">{LABELS.COUNTRY_CODE}</th>
                <th className="py-4 px-6">{LABELS.COL_COUNTRY_NAME}</th>
                <th className="py-4 px-6">{LABELS.COL_PHONE_CODE}</th>
                <th className="py-4 px-6 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-sm">
              {filteredCountries.length > 0 ? (
                filteredCountries.map((c: Country) => (
                  <tr key={c.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="py-4 px-6 font-mono font-bold text-violet-600">{c.code}</td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-zinc-800">{c.names?.tr_TR || c.names?.en_US}</span>
                        <ChevronRight size={12} className="text-zinc-300" />
                        <span className="text-zinc-400 font-medium text-xs">{c.names?.en_US}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 font-semibold text-zinc-600">
                      {c.phone_code ? `+${c.phone_code}` : "-"}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedCountryFilter(c.id);
                            setActiveTab("states");
                          }}
                          className="p-1.5 text-zinc-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors cursor-pointer"
                          title={LABELS.SHOW_STATES}
                        >
                          <MapPin size={15} />
                        </button>
                        <button
                          onClick={() => openEditCountry(c)}
                          className="p-1.5 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title={LABELS.EDIT_COUNTRY}
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          onClick={() => openDeleteCountry(c)}
                          className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title={LABELS.DELETE_COUNTRY}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-zinc-400 italic font-medium">
                    {LABELS.NO_DATA}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 2. STATES LISTING (WITH SELECT COUNTRY FILTER) */}
      {activeTab === "states" && (
        <div className="flex flex-col gap-4 animate-in fade-in duration-200">
          {/* Select country toolbar */}
          <div className="flex items-center gap-3 p-4 bg-zinc-50 border border-zinc-200/60 rounded-2xl">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
              {LABELS.SELECT_COUNTRY}:
            </span>
            <select
              value={selectedCountryFilter}
              onChange={(e) => setSelectedCountryFilter(e.target.value)}
              className="bg-white border border-zinc-200 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-violet-500 shadow-sm"
            >
              <option value="">{LABELS.SELECT_COUNTRY_OPTION}</option>
              {countries.map((c: Country) => (
                <option key={c.id} value={c.id}>
                  {c.names?.tr_TR || c.names?.en_US} ({c.code})
                </option>
              ))}
            </select>
          </div>

          <div className="bg-white rounded-3xl border border-zinc-200/50 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-100 text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                  <th className="py-4 px-6">{LABELS.STATE_CODE}</th>
                  <th className="py-4 px-6">{LABELS.STATE_NAME}</th>
                  <th className="py-4 px-6 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-sm">
                {renderStatesTableBody()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. COUNTRY GROUPS LISTING */}
      {activeTab === "groups" && (
        <div className="bg-white rounded-3xl border border-zinc-200/50 shadow-sm overflow-hidden animate-in fade-in duration-200">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-100 text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                <th className="py-4 px-6">{LABELS.GROUP_CODE}</th>
                <th className="py-4 px-6">{LABELS.COL_GROUP_NAME}</th>
                <th className="py-4 px-6 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-sm">
              {filteredGroups.length > 0 ? (
                filteredGroups.map((g: CountryGroup) => (
                  <tr key={g.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="py-4 px-6 font-mono font-bold text-violet-600">{g.code}</td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-zinc-800">{g.names?.tr_TR || g.names?.en_US}</span>
                        <ChevronRight size={12} className="text-zinc-300" />
                        <span className="text-zinc-400 font-medium text-xs">{g.names?.en_US}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEditGroup(g)}
                          className="p-1.5 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title={LABELS.EDIT_GROUP}
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          onClick={() => openDeleteGroup(g)}
                          className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title={LABELS.DELETE_GROUP}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="py-12 text-center text-zinc-400 italic font-medium">
                    {LABELS.NO_DATA}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 4. CURRENCIES LISTING */}
      {activeTab === "currencies" && (
        <div className="bg-white rounded-3xl border border-zinc-200/50 shadow-sm overflow-hidden animate-in fade-in duration-200">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-100 text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                <th className="py-4 px-6">{LABELS.CURRENCY_NAME}</th>
                <th className="py-4 px-6">{LABELS.CURRENCY_SYMBOL}</th>
                <th className="py-4 px-6">{LABELS.CURRENCY_FULL_NAME}</th>
                <th className="py-4 px-6">{LABELS.ACTIVE}</th>
                <th className="py-4 px-6 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-sm">
              {filteredCurrencies.length > 0 ? (
                filteredCurrencies.map((c: Currency) => (
                  <tr key={c.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="py-4 px-6 font-mono font-bold text-violet-600">{c.name}</td>
                    <td className="py-4 px-6 font-mono font-bold text-zinc-800 text-lg">{c.symbol}</td>
                    <td className="py-4 px-6 font-bold text-zinc-800">{c.full_name}</td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                        c.active 
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                          : "bg-zinc-100 text-zinc-500 border border-zinc-200"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${c.active ? "bg-emerald-500" : "bg-zinc-400"}`} />
                        {c.active ? "Aktif" : "Pasif"}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEditCurrency(c)}
                          className="p-1.5 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title={LABELS.EDIT_CURRENCY}
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          onClick={() => openDeleteCurrency(c)}
                          className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title={LABELS.DELETE_CURRENCY}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-zinc-400 italic font-medium">
                    {LABELS.NO_DATA}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 5. LANGUAGES LISTING */}
      {activeTab === "languages" && (
        <div className="bg-white rounded-3xl border border-zinc-200/50 shadow-sm overflow-hidden animate-in fade-in duration-200">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-100 text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                <th className="py-4 px-6">{LABELS.LANG_CODE}</th>
                <th className="py-4 px-6">{LABELS.LANG_LABEL}</th>
                <th className="py-4 px-6">{LABELS.LANG_FLAG}</th>
                <th className="py-4 px-6">{LABELS.LANG_PREFIX}</th>
                <th className="py-4 px-6">{LABELS.LANG_DIR}</th>
                <th className="py-4 px-6">{LABELS.SORT_ORDER}</th>
                <th className="py-4 px-6">{LABELS.ACTIVE}</th>
                <th className="py-4 px-6 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-sm">
              {filteredLanguages.length > 0 ? (
                filteredLanguages.map((l: Language) => (
                  <tr key={l.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="py-4 px-6 font-mono font-bold text-violet-600">{l.code}</td>
                    <td className="py-4 px-6 font-bold text-zinc-800">{l.label}</td>
                    <td className="py-4 px-6 font-semibold text-zinc-600">
                      <div className="flex items-center gap-2">
                        <span className="font-mono bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded text-xs font-semibold text-zinc-700">
                          {l.flag}
                        </span>
                        {l.flag?.length === 2 && (
                          <span className="text-base" title={l.flag.toUpperCase()}>
                            {String.fromCodePoint(
                              ...l.flag
                                .toUpperCase()
                                .split("")
                                .map((char: string) => 127397 + (char.codePointAt(0) ?? 0))
                            )}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6 font-semibold text-zinc-600 font-mono">
                      {l.categoryPrefix}
                    </td>
                    <td className="py-4 px-6 font-semibold text-zinc-600">
                      {l.dir ? l.dir.toUpperCase() : "LTR"}
                    </td>
                    <td className="py-4 px-6 font-semibold text-zinc-600">
                      {l.sortOrder}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                        l.isActive 
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                          : "bg-zinc-100 text-zinc-500 border border-zinc-200"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${l.isActive ? "bg-emerald-500" : "bg-zinc-400"}`} />
                        {l.isActive ? "Aktif" : "Pasif"}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEditLanguage(l)}
                          className="p-1.5 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title={LABELS.EDIT_LANGUAGE}
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          onClick={() => openDeleteLanguage(l)}
                          className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title={LABELS.DELETE_LANGUAGE}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-400 italic font-medium">
                    {LABELS.NO_DATA}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* DYNAMIC MODALS */}
      {activeModal && (
        <GeographyModal
          activeModal={activeModal}
          onClose={() => setActiveModal(null)}
          onSubmit={handleSubmit}
          isPending={isPending}
          formError={formError}
          codeField={codeField}
          setCodeField={setCodeField}
          phoneCodeField={phoneCodeField}
          setPhoneCodeField={setPhoneCodeField}
          nameTrField={nameTrField}
          setNameTrField={setNameTrField}
          nameEnField={nameEnField}
          setNameEnField={setNameEnField}
          stateNameField={stateNameField}
          setStateNameField={setStateNameField}
          parentCountryId={parentCountryId}
          setParentCountryId={setParentCountryId}
          countries={countries}
          currencyName={currencyName}
          setCurrencyName={setCurrencyName}
          currencySymbol={currencySymbol}
          setCurrencySymbol={setCurrencySymbol}
          currencyFullName={currencyFullName}
          setCurrencyFullName={setCurrencyFullName}
          currencyActive={currencyActive}
          setCurrencyActive={setCurrencyActive}
          langCode={langCode}
          setLangCode={setLangCode}
          langLabel={langLabel}
          setLangLabel={setLangLabel}
          langFlag={langFlag}
          setLangFlag={setLangFlag}
          langCategoryPrefix={langCategoryPrefix}
          setLangCategoryPrefix={setLangCategoryPrefix}
          langDir={langDir}
          setLangDir={setLangDir}
          langSortOrder={langSortOrder}
          setLangSortOrder={setLangSortOrder}
          langIsActive={langIsActive}
          setLangIsActive={setLangIsActive}
        />
      )}
    </div>
  );
}

