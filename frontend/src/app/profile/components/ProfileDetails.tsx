import React from "react";
import { Settings, Clipboard, Globe, Plus, Check, AlertCircle } from "lucide-react";
import { t } from "@/app/i18n";

// Custom Instagram SVG Icon to avoid older lucide-react import issues
const Instagram = (props: Readonly<React.SVGProps<SVGSVGElement>>) => (
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

interface ProfileDetailsProps {
  readonly lang: string;
  readonly firstName: string;
  readonly setFirstName: (val: string) => void;
  readonly lastName: string;
  readonly setLastName: (val: string) => void;
  readonly email: string;
  readonly phone: string;
  readonly setPhone: (val: string) => void;
  readonly preferredLang: string;
  readonly setPreferredLang: (val: string) => void;
  readonly preferredCurrency: string;
  readonly setPreferredCurrency: (val: string) => void;
  readonly taxNoTCKN: string;
  readonly setTaxNoTCKN: (val: string) => void;
  readonly instagramUsername: string;
  readonly setInstagramUsername: (val: string) => void;
  readonly savingProfile: boolean;
  readonly handleSaveProfile: (e: React.FormEvent) => void;
  
  // Legacy migration props
  readonly addressesCount: number;
  readonly billingAddress?: string;
  readonly deliveryAddress?: string;
  readonly isMigrating: boolean;
  readonly handleMigrateLegacyAddresses: () => void;
  readonly getAddressT: (key: string) => string;

  // Global alerts/notifs inside the panel
  readonly error: string | null;
  readonly success: string | null;

  // Email verification props
  readonly emailVerified?: boolean;
  readonly handleResendVerification?: () => void;
  readonly resendingVerification?: boolean;
  readonly resendCountdown?: number;
}

export default function ProfileDetails({
  lang,
  firstName,
  setFirstName,
  lastName,
  setLastName,
  email,
  phone,
  setPhone,
  preferredLang,
  setPreferredLang,
  preferredCurrency,
  setPreferredCurrency,
  taxNoTCKN,
  setTaxNoTCKN,
  instagramUsername,
  setInstagramUsername,
  savingProfile,
  handleSaveProfile,
  addressesCount,
  billingAddress,
  deliveryAddress,
  isMigrating,
  handleMigrateLegacyAddresses,
  getAddressT,
  error,
  success,
  emailVerified = false,
  handleResendVerification,
  resendingVerification = false,
  resendCountdown = 0,
}: Readonly<ProfileDetailsProps>) {
  return (
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
              <label className="text-[10px] font-extrabold uppercase text-eerie-black tracking-wider">
                {t("first_name_field", lang)}
              </label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-cultured rounded-lg text-xs font-semibold focus:outline-none focus:border-salmon-pink focus:ring-salmon-pink transition-all shadow-inner text-eerie-black"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-extrabold uppercase text-eerie-black tracking-wider">
                {t("last_name_field", lang)}
              </label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-cultured rounded-lg text-xs font-semibold focus:outline-none focus:border-salmon-pink focus:ring-salmon-pink transition-all shadow-inner text-eerie-black"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-extrabold uppercase text-eerie-black tracking-wider">
                  {t("email_readonly", lang)}
                </label>
                {emailVerified ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    <Check className="w-3 h-3 text-emerald-600" />
                    {lang === "tr" ? "E-Posta Doğrulandı" : "Email Verified"}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    <AlertCircle className="w-3 h-3 text-amber-600" />
                    {lang === "tr" ? "Doğrulanmadı" : "Unverified"}
                  </span>
                )}
              </div>
              <input
                type="email"
                disabled
                value={email}
                className="w-full px-3.5 py-2.5 bg-[#f5f5f5] border border-cultured rounded-lg text-xs font-semibold text-sonic-silver cursor-not-allowed select-none"
              />
              {!emailVerified && handleResendVerification && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-1 text-[11px] text-amber-800 bg-amber-50/80 p-2.5 rounded-lg border border-amber-200">
                  <span className="leading-snug">
                    {lang === "tr"
                      ? "Siparişleriniz ve tekliflerinizin üreticiler tarafından öncelikli yanıtlanması için e-postanızı doğrulayın."
                      : "Verify your email to have suppliers prioritize your orders and inquiries."}
                  </span>
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={resendingVerification || resendCountdown > 0}
                    className="shrink-0 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded font-bold text-[10px] transition-colors cursor-pointer border-none shadow-xs text-center"
                  >
                    {resendingVerification
                      ? (lang === "tr" ? "Gönderiliyor..." : "Sending...")
                      : resendCountdown > 0
                      ? `${resendCountdown}s`
                      : (lang === "tr" ? "Doğrulama E-postası Gönder" : "Send Verification Email")}
                  </button>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-extrabold uppercase text-eerie-black tracking-wider">
                {t("phone_number_field", lang)} <span className="text-red-500 font-bold">*</span>
              </label>
              <input
                type="tel"
                required
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
              <label className="text-[10px] font-extrabold uppercase text-eerie-black tracking-wider">
                {t("default_language_field", lang)}
              </label>
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
              <label className="text-[10px] font-extrabold uppercase text-eerie-black tracking-wider">
                {t("default_currency_field", lang)}
              </label>
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
        {addressesCount === 0 && (billingAddress?.trim() !== "" || deliveryAddress?.trim() !== "") && (
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
  );
}
