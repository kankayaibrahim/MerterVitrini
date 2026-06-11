import React from "react";
import { Clipboard, AlertCircle, Check } from "lucide-react";
import { CountryLookup, StateLookup, CityLookup, UserAddress } from "./types";
import { t } from "@/app/i18n";

interface AddressModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: string;
  countries: CountryLookup[];
  states: StateLookup[];
  cities: CityLookup[];
  editingAddress: UserAddress | null;
  
  // Form fields
  formTitle: string;
  setFormTitle: (v: string) => void;
  formType: "billing" | "shipping";
  setFormType: (v: "billing" | "shipping") => void;
  formFirstName: string;
  setFormFirstName: (v: string) => void;
  formLastName: string;
  setFormLastName: (v: string) => void;
  formCompany: string;
  setFormCompany: (v: string) => void;
  formPhoneOnly: string;
  setFormPhoneOnly: (v: string) => void;
  formCountryID: string;
  handleCountryChange: (v: string) => void;
  formStateID: string;
  handleStateChange: (v: string) => void;
  formCityID: string;
  setFormCityID: (v: string) => void;
  formAddressLine: string;
  setFormAddressLine: (v: string) => void;
  formPostalCode: string;
  setFormPostalCode: (v: string) => void;
  formTaxNo: string;
  setFormTaxNo: (v: string) => void;
  formTaxOffice: string;
  setFormTaxOffice: (v: string) => void;
  formIsDefault: boolean;
  setFormIsDefault: (v: boolean) => void;

  savingAddress: boolean;
  addressError: string | null;
  addressSuccess: string | null;
  handleSaveAddress: (e: React.FormEvent) => void;
  getAddressT: (key: string) => string;
}

export default function AddressModal({
  isOpen,
  onClose,
  lang,
  countries,
  states,
  cities,
  editingAddress,
  formTitle,
  setFormTitle,
  formType,
  setFormType,
  formFirstName,
  setFormFirstName,
  formLastName,
  setFormLastName,
  formCompany,
  setFormCompany,
  formPhoneOnly,
  setFormPhoneOnly,
  formCountryID,
  handleCountryChange,
  formStateID,
  handleStateChange,
  formCityID,
  setFormCityID,
  formAddressLine,
  setFormAddressLine,
  formPostalCode,
  setFormPostalCode,
  formTaxNo,
  setFormTaxNo,
  formTaxOffice,
  setFormTaxOffice,
  formIsDefault,
  setFormIsDefault,
  savingAddress,
  addressError,
  addressSuccess,
  handleSaveAddress,
  getAddressT,
}: AddressModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#0c0d10]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl animate-in scale-in duration-200 border border-cultured flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-cultured flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-eerie-black uppercase tracking-wider">
            {editingAddress ? getAddressT("edit_address") : getAddressT("add_new_address")}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-cultured text-sonic-silver hover:text-salmon-pink hover:bg-cultured transition-all bg-transparent flex items-center justify-center text-lg font-bold cursor-pointer"
          >
            ×
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSaveAddress} className="flex-grow overflow-y-auto p-6 flex flex-col gap-4">
          
          {/* Alerts */}
          {addressError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-[11px] font-bold flex items-center gap-2 select-none animate-in fade-in duration-200">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-500" />
              <span>{addressError}</span>
            </div>
          )}
          {addressSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-[11px] font-bold flex items-center gap-2 select-none animate-in fade-in duration-200">
              <Check className="w-3.5 h-3.5 shrink-0 text-emerald-500 animate-bounce" />
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
              onClick={onClose}
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
  );
}
