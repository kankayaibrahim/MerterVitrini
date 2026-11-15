"use client";

import React, { useState } from "react";
import { Plus, MapPin, AlertTriangle, Check } from "lucide-react";
import type { UserAddress } from "@/app/profile/components/types";
import StructuredLocationFields, {
  StructuredLocationMeta,
  StructuredLocationValue,
  validateStructuredLocationMeta,
} from "@/components/store/StructuredLocationFields";
import {
  validateHumanAddressClient,
  validateHumanPersonNameClient,
  validatePostalCodeClient,
} from "@/utils/addressValidation";
import { validateAndNormalizeRealisticPhone } from "@/utils/phoneValidation";

interface StructuredCheckoutAddressPickerProps {
  readonly label: string;
  readonly icon?: React.ReactNode;
  readonly addressType: "shipping" | "billing";
  readonly lang: string;
  readonly token: string | null;
  readonly addresses: readonly UserAddress[];
  readonly selectedAddressId: string;
  readonly onSelectAddressId: (id: string) => void;
  readonly onAddressCreated: (createdId: string) => Promise<void> | void;
  readonly defaultFirstName?: string;
  readonly defaultLastName?: string;
  readonly defaultCompanyName?: string;
  readonly defaultPhone?: string;
  readonly accentClassName?: string;
}

export function isAddressRecordComplete(addr: UserAddress | undefined): boolean {
  if (!addr?.id) return false;
  if (!addr.country_id?.trim()) return false;
  return validateHumanAddressClient(addr.address_line || "") === null;
}

export function formatCheckoutAddressDisplay(addr: UserAddress): string {
  const companyPart = addr.company_name ? ` (${addr.company_name})` : "";
  const geoParts = [addr.city_name, addr.state_name, addr.country_name].filter(Boolean);
  const geoLine = geoParts.join(" / ");
  const pcPart = addr.postal_code ? ` (${addr.postal_code})` : "";
  const taxParts = [
    addr.tax_office ? `VD: ${addr.tax_office}` : "",
    addr.tax_no_tckn ? `VKN/TCKN: ${addr.tax_no_tckn}` : "",
  ].filter(Boolean);
  const lines = [
    `${addr.first_name} ${addr.last_name}${companyPart}`,
    addr.address_line,
    `${geoLine}${pcPart}`.trim(),
    addr.phone ? `Tel: ${addr.phone}` : "",
    taxParts.length > 0 ? taxParts.join(" / ") : "",
  ].filter(Boolean);
  return lines.join("\n");
}

function getPreferredAddresses(
  addresses: readonly UserAddress[],
  addressType: "shipping" | "billing"
): readonly UserAddress[] {
  const matching = addresses.filter((a) => a.address_type === addressType);
  if (matching.length > 0) {
    return matching;
  }
  return addresses;
}

export default function StructuredCheckoutAddressPicker({
  label,
  icon,
  addressType,
  lang,
  token,
  addresses,
  selectedAddressId,
  onSelectAddressId,
  onAddressCreated,
  defaultFirstName = "",
  defaultLastName = "",
  defaultCompanyName = "",
  defaultPhone = "",
  accentClassName = "border-salmon-pink bg-salmon-pink/5",
}: StructuredCheckoutAddressPickerProps) {
  const isTr = lang === "tr";
  const visibleAddresses = getPreferredAddresses(addresses, addressType);

  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [firstName, setFirstName] = useState<string | null>(null);
  const [lastName, setLastName] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [taxOffice, setTaxOffice] = useState("");
  const [taxNo, setTaxNo] = useState("");
  const [location, setLocation] = useState<StructuredLocationValue>({
    countryId: "",
    stateId: "",
    cityId: "",
    addressLine: "",
    postalCode: "",
  });
  const [locMeta, setLocMeta] = useState<StructuredLocationMeta>({
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

  const showCreator = isCreating || visibleAddresses.length === 0;
  const resolvedFirstName = firstName ?? defaultFirstName;
  const resolvedLastName = lastName ?? defaultLastName;
  const resolvedCompanyName = companyName ?? defaultCompanyName;
  const resolvedPhone = phone ?? defaultPhone;

  const validateNewAddressInputs = (): { ok: true; normalizedPhone: string } | { ok: false; error: string } => {
    if (!title.trim()) {
      return {
        ok: false,
        error: isTr ? "Lütfen adres başlığı girin (örn: Merkez Mağaza / Depo)." : "Please enter an address title.",
      };
    }

    const firstErr = validateHumanPersonNameClient(resolvedFirstName, lang);
    if (firstErr) return { ok: false, error: firstErr };

    const lastErr = validateHumanPersonNameClient(resolvedLastName, lang);
    if (lastErr) return { ok: false, error: lastErr };

    const rawPhone = resolvedPhone.trim();
    const dialPrefix = `+${locMeta.countryPhoneCode || 90}`;
    const combinedPhone = rawPhone.startsWith("+") ? rawPhone : `${dialPrefix}${rawPhone.replace(/^0+/, "")}`;
    const phoneCheck = validateAndNormalizeRealisticPhone(combinedPhone);
    if (!phoneCheck.valid) {
      return {
        ok: false,
        error: isTr ? "Lütfen geçerli bir iletişim telefon numarası girin." : "Please enter a valid contact phone number.",
      };
    }

    const locErr = validateStructuredLocationMeta(location, locMeta, lang);
    if (locErr) return { ok: false, error: locErr };

    const pcErr = validatePostalCodeClient(location.postalCode, lang);
    if (pcErr) return { ok: false, error: pcErr };

    const addrErr = validateHumanAddressClient(location.addressLine, lang);
    if (addrErr) return { ok: false, error: addrErr };

    return { ok: true, normalizedPhone: phoneCheck.normalized };
  };

  const handleSaveNewAddress = async () => {
    setFormError(null);
    if (!token) {
      setFormError(isTr ? "Adres kaydetmek için oturum açmalısınız." : "Please sign in to save an address.");
      return;
    }

    const check = validateNewAddressInputs();
    if (!check.ok) {
      setFormError(check.error);
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/v1/store/profile/addresses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          address_type: addressType,
          first_name: resolvedFirstName.trim(),
          last_name: resolvedLastName.trim(),
          company_name: resolvedCompanyName.trim() || null,
          phone: check.normalizedPhone,
          country_id: location.countryId,
          state_id: location.stateId || null,
          city_id: location.cityId || null,
          postal_code: location.postalCode.trim(),
          address_line: location.addressLine.trim(),
          tax_office: taxOffice.trim() || null,
          tax_no_tckn: taxNo.trim() || null,
          is_default: visibleAddresses.length === 0,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!response.ok || !data.id) {
        throw new Error(data.error || (isTr ? "Adres kaydedilemedi." : "Failed to save address."));
      }

      onSelectAddressId(data.id);
      setIsCreating(false);
      setTitle("");
      setLocation((prev) => ({ ...prev, addressLine: "", postalCode: "" }));
      await onAddressCreated(data.id);
    } catch (err: unknown) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] uppercase font-extrabold text-eerie-black tracking-[0.5px] inline-flex items-center gap-1.5">
          {icon || <MapPin size={13} />}
          {label}
        </span>
        {visibleAddresses.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setIsCreating((prev) => !prev);
            }}
            className="text-[11px] font-bold text-salmon-pink hover:underline inline-flex items-center gap-1 cursor-pointer"
          >
            <Plus size={12} />
            {isCreating
              ? (isTr ? "Kayıtlı Adreslere Dön" : "Back to Saved")
              : (isTr ? "Yeni Adres Ekle" : "Add New Address")}
          </button>
        )}
      </div>

      {!showCreator && visibleAddresses.length > 0 && (
        <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
          {visibleAddresses.map((addr) => {
            const addrId = addr.id || "";
            const isSelected = addrId !== "" && addrId === selectedAddressId;
            const complete = isAddressRecordComplete(addr);
            const geoLabel = [addr.city_name, addr.state_name, addr.country_name].filter(Boolean).join(" / ");
            const cardStyle = isSelected
              ? `${accentClassName} shadow-xs`
              : "border-neutral-200 bg-white hover:border-neutral-300";

            return (
              <button
                key={addrId}
                type="button"
                onClick={() => onSelectAddressId(addrId)}
                className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${cardStyle}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-extrabold text-neutral-900 truncate">{addr.title}</span>
                    {addr.is_default && (
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 shrink-0">
                        {isTr ? "Varsayılan" : "Default"}
                      </span>
                    )}
                  </div>
                  {isSelected && <Check size={14} className="text-emerald-600 shrink-0" />}
                </div>
                <p className="text-[11px] font-semibold text-neutral-700 mt-1 line-clamp-2">
                  {addr.address_line}
                </p>
                <p className="text-[10px] font-bold text-neutral-500 mt-0.5">
                  {geoLabel || (isTr ? "Konum bilgisi eksik" : "Missing country / city")}
                  {addr.postal_code ? ` · ${addr.postal_code}` : ""}
                </p>
                {!complete && (
                  <p className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    <AlertTriangle size={11} />
                    {isTr
                      ? "Eksik adres detayı: Profilinizden güncelleyin veya yeni ekleyin."
                      : "Incomplete address details: please update or add a new address."}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}

      {showCreator && (
        <div className="p-3.5 rounded-xl border border-neutral-200 bg-neutral-50/70 space-y-2.5">
          {visibleAddresses.length === 0 && (
            <p className="text-[11px] font-semibold text-neutral-600">
              {isTr
                ? "Sipariş verebilmek için Ülke, İl, İlçe ve geçerli açık adresinizi bir defaya mahsus kaydedin:"
                : "Save a structured address with Country, State, City, and full street line to place your order:"}
            </p>
          )}

          {formError && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-bold">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">
                {isTr ? "Adres Başlığı *" : "Address Title *"}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={isTr ? "Örn: Showroom / Merkez" : "e.g. Store / Warehouse"}
                className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-xl text-xs font-medium text-neutral-900 focus:outline-none focus:border-neutral-900"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">
                {isTr ? "Telefon *" : "Phone *"}
              </label>
              <input
                type="tel"
                value={resolvedPhone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+905331234567"
                className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-xl text-xs font-medium text-neutral-900 focus:outline-none focus:border-neutral-900"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">
                {isTr ? "Alıcı Adı *" : "First Name *"}
              </label>
              <input
                type="text"
                value={resolvedFirstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-xl text-xs font-medium text-neutral-900 focus:outline-none focus:border-neutral-900"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">
                {isTr ? "Alıcı Soyadı *" : "Last Name *"}
              </label>
              <input
                type="text"
                value={resolvedLastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-xl text-xs font-medium text-neutral-900 focus:outline-none focus:border-neutral-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">
              {isTr ? "Firma / Mağaza Adı" : "Company / Boutique Name"}
            </label>
            <input
              type="text"
              value={resolvedCompanyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-xl text-xs font-medium text-neutral-900 focus:outline-none focus:border-neutral-900"
            />
          </div>

          {addressType === "billing" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">
                  {isTr ? "Vergi Dairesi" : "Tax Office"}
                </label>
                <input
                  type="text"
                  value={taxOffice}
                  onChange={(e) => setTaxOffice(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-xl text-xs font-medium text-neutral-900 focus:outline-none focus:border-neutral-900"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">
                  {isTr ? "VKN / TCKN" : "Tax ID / Passport"}
                </label>
                <input
                  type="text"
                  value={taxNo}
                  onChange={(e) => setTaxNo(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-xl text-xs font-medium text-neutral-900 focus:outline-none focus:border-neutral-900"
                />
              </div>
            </div>
          )}

          <StructuredLocationFields
            lang={lang}
            value={location}
            onChange={setLocation}
            onMetaChange={setLocMeta}
            showPostalCode
            requirePostalCode
            compact
            disabled={saving}
          />

          <div className="flex items-center justify-end gap-2 pt-1">
            {visibleAddresses.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setFormError(null);
                  setIsCreating(false);
                }}
                className="px-3 py-1.5 rounded-lg border border-neutral-300 bg-white text-[11px] font-bold text-neutral-700 hover:bg-neutral-100 cursor-pointer"
              >
                {isTr ? "Vazgeç" : "Cancel"}
              </button>
            )}
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                void handleSaveNewAddress();
              }}
              className="px-4 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-[11px] font-bold disabled:opacity-60 cursor-pointer"
            >
              {saving
                ? (isTr ? "Kaydediliyor..." : "Saving...")
                : (isTr ? "Adresi Kaydet ve Seç" : "Save & Use Address")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
