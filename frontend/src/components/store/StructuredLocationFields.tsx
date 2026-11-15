"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { CityLookup, CountryLookup, StateLookup } from "@/app/profile/components/types";

export interface StructuredLocationValue {
  countryId: string;
  stateId: string;
  cityId: string;
  addressLine: string;
  postalCode: string;
}

export interface StructuredLocationMeta {
  countryCode: string;
  countryPhoneCode: number;
  countryName: string;
  stateName: string;
  cityName: string;
  hasStates: boolean;
  hasCities: boolean;
  loadingStates: boolean;
  loadingCities: boolean;
}

interface StructuredLocationFieldsProps {
  readonly lang: string;
  readonly value: StructuredLocationValue;
  readonly onChange: (next: StructuredLocationValue) => void;
  readonly onMetaChange?: (meta: StructuredLocationMeta) => void;
  readonly showPostalCode?: boolean;
  readonly requirePostalCode?: boolean;
  readonly disabled?: boolean;
  readonly compact?: boolean;
}

let cachedCountries: CountryLookup[] | null = null;
const cachedStatesByCountry = new Map<string, StateLookup[]>();
const cachedCitiesByState = new Map<string, CityLookup[]>();

async function loadCountriesCached(): Promise<CountryLookup[]> {
  if (cachedCountries) {
    return cachedCountries;
  }
  const res = await fetch("/api/v1/store/locations/countries");
  if (!res.ok) {
    return [];
  }
  const data = (await res.json().catch(() => [])) as CountryLookup[];
  const list = Array.isArray(data) ? data : [];
  cachedCountries = list;
  return list;
}

async function loadStatesCached(countryId: string): Promise<StateLookup[]> {
  if (!countryId) return [];
  const existing = cachedStatesByCountry.get(countryId);
  if (existing) {
    return existing;
  }
  const res = await fetch(`/api/v1/store/locations/countries/${encodeURIComponent(countryId)}/states`);
  if (!res.ok) {
    return [];
  }
  const data = (await res.json().catch(() => [])) as StateLookup[];
  const list = Array.isArray(data) ? data : [];
  cachedStatesByCountry.set(countryId, list);
  return list;
}

async function loadCitiesCached(stateId: string): Promise<CityLookup[]> {
  if (!stateId) return [];
  const existing = cachedCitiesByState.get(stateId);
  if (existing) {
    return existing;
  }
  const res = await fetch(`/api/v1/store/locations/states/${encodeURIComponent(stateId)}/cities`);
  if (!res.ok) {
    return [];
  }
  const data = (await res.json().catch(() => [])) as CityLookup[];
  const list = Array.isArray(data) ? data : [];
  cachedCitiesByState.set(stateId, list);
  return list;
}

function getLocalizedCountryName(country: CountryLookup, lang: string): string {
  if (lang === "tr") {
    return country.name_tr || country.name_en || country.code;
  }
  return country.name_en || country.name_tr || country.code;
}

export function validateStructuredLocationMeta(
  val: StructuredLocationValue,
  meta: StructuredLocationMeta,
  lang: string
): string | null {
  const isTr = lang === "tr";
  if (!val.countryId.trim()) {
    return isTr ? "Lütfen ülke seçimi yapın." : "Please select a country.";
  }
  if (meta.loadingStates || meta.loadingCities) {
    return isTr ? "Konum listesi yükleniyor, lütfen bekleyin." : "Location list is loading, please wait.";
  }
  if (meta.hasStates && !val.stateId.trim()) {
    return isTr ? "Lütfen il / eyalet seçimi yapın." : "Please select a state / province.";
  }
  if (meta.hasCities && !val.cityId.trim()) {
    return isTr ? "Lütfen ilçe / şehir seçimi yapın." : "Please select a city / district.";
  }
  return null;
}

export default function StructuredLocationFields({
  lang,
  value,
  onChange,
  onMetaChange,
  showPostalCode = false,
  requirePostalCode = false,
  disabled = false,
  compact = false,
}: StructuredLocationFieldsProps) {
  const isTr = lang === "tr";
  const [countries, setCountries] = useState<CountryLookup[]>(() => cachedCountries ?? []);
  const [statesResult, setStatesResult] = useState<{
    readonly countryId: string;
    readonly list: StateLookup[];
  }>({ countryId: "", list: [] });
  const [citiesResult, setCitiesResult] = useState<{
    readonly stateId: string;
    readonly list: CityLookup[];
  }>({ stateId: "", list: [] });

  const latestValueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const onMetaChangeRef = useRef(onMetaChange);

  useEffect(() => {
    latestValueRef.current = value;
  }, [value]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onMetaChangeRef.current = onMetaChange;
  }, [onMetaChange]);

  // Initial country load + default Turkey selection if unset
  useEffect(() => {
    let active = true;
    void loadCountriesCached().then((list) => {
      if (!active) return;
      setCountries(list);
      const currentVal = latestValueRef.current;
      if (!currentVal.countryId && list.length > 0) {
        const defaultCountry = list.find((c) => c.code === "TR") ?? list[0];
        if (defaultCountry) {
          onChangeRef.current({
            ...currentVal,
            countryId: defaultCountry.id,
            stateId: "",
            cityId: "",
          });
        }
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // Load states when country changes and not yet cached
  useEffect(() => {
    if (!value.countryId || cachedStatesByCountry.has(value.countryId)) {
      return;
    }
    let active = true;
    const targetCountryId = value.countryId;
    void loadStatesCached(targetCountryId).then((list) => {
      if (!active) return;
      setStatesResult({ countryId: targetCountryId, list });
    });
    return () => {
      active = false;
    };
  }, [value.countryId]);

  // Load cities when state changes and not yet cached
  useEffect(() => {
    if (!value.stateId || cachedCitiesByState.has(value.stateId)) {
      return;
    }
    let active = true;
    const targetStateId = value.stateId;
    void loadCitiesCached(targetStateId).then((list) => {
      if (!active) return;
      setCitiesResult({ stateId: targetStateId, list });
    });
    return () => {
      active = false;
    };
  }, [value.stateId]);

  const states = useMemo<StateLookup[]>(() => {
    if (!value.countryId) return [];
    const cached = cachedStatesByCountry.get(value.countryId);
    if (cached) return cached;
    if (statesResult.countryId === value.countryId) {
      return statesResult.list;
    }
    return [];
  }, [value.countryId, statesResult]);
  const loadingStates =
    Boolean(value.countryId) &&
    !cachedStatesByCountry.has(value.countryId) &&
    statesResult.countryId !== value.countryId;

  const cities = useMemo<CityLookup[]>(() => {
    if (!value.stateId) return [];
    const cached = cachedCitiesByState.get(value.stateId);
    if (cached) return cached;
    if (citiesResult.stateId === value.stateId) {
      return citiesResult.list;
    }
    return [];
  }, [value.stateId, citiesResult]);
  const loadingCities =
    Boolean(value.stateId) &&
    !cachedCitiesByState.has(value.stateId) &&
    citiesResult.stateId !== value.stateId;

  // Emit resolved metadata upstream whenever selections or options change
  useEffect(() => {
    const cb = onMetaChangeRef.current;
    if (!cb) return;
    const countryObj = countries.find((c) => c.id === value.countryId);
    const stateObj = states.find((s) => s.id === value.stateId);
    const cityObj = cities.find((c) => c.id === value.cityId);

    cb({
      countryCode: countryObj?.code ?? "TR",
      countryPhoneCode: countryObj?.phone_code ?? 90,
      countryName: countryObj ? getLocalizedCountryName(countryObj, lang) : "",
      stateName: stateObj?.state_name ?? "",
      cityName: cityObj?.name ?? "",
      hasStates: states.length > 0,
      hasCities: cities.length > 0,
      loadingStates,
      loadingCities,
    });
  }, [countries, states, cities, value.countryId, value.stateId, value.cityId, lang, loadingStates, loadingCities]);

  const inputPad = compact ? "px-3 py-2 text-xs" : "px-3.5 py-2.5 text-sm";
  const labelSize = compact ? "text-[11px]" : "text-xs";

  let statePlaceholder = isTr ? "İl / Bölge bulunmuyor" : "No state / province required";
  if (loadingStates) {
    statePlaceholder = isTr ? "Yükleniyor..." : "Loading...";
  } else if (states.length > 0) {
    statePlaceholder = isTr ? "İl / Eyalet seçin *" : "Select state / province *";
  }

  let cityPlaceholder = isTr ? "Önce il seçin" : "Select state first";
  if (loadingCities) {
    cityPlaceholder = isTr ? "Yükleniyor..." : "Loading...";
  } else if (cities.length > 0) {
    cityPlaceholder = isTr ? "İlçe / Şehir seçin *" : "Select city / district *";
  } else if (value.stateId) {
    cityPlaceholder = isTr ? "İlçe kaydı bulunmuyor" : "No district list available";
  }

  const gridColsClass = showPostalCode ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-3";

  return (
    <div className="space-y-2.5">
      <div className={`grid gap-2.5 ${gridColsClass}`}>
        <div>
          <label className={`block font-bold uppercase tracking-wider text-neutral-500 mb-1 ${labelSize}`}>
            {isTr ? "Ülke *" : "Country *"}
          </label>
          <select
            required
            disabled={disabled || countries.length === 0}
            value={value.countryId}
            onChange={(e) => {
              onChange({
                ...value,
                countryId: e.target.value,
                stateId: "",
                cityId: "",
              });
            }}
            className={`w-full rounded-xl border border-neutral-300 bg-white font-medium text-neutral-900 focus:outline-none focus:border-neutral-900 ${inputPad}`}
          >
            <option value="">{isTr ? "Ülke seçin *" : "Select country *"}</option>
            {countries.map((c) => (
              <option key={c.id} value={c.id}>
                {getLocalizedCountryName(c, lang)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={`block font-bold uppercase tracking-wider text-neutral-500 mb-1 ${labelSize}`}>
            {isTr ? "İl / Eyalet" : "State / Province"} {states.length > 0 ? "*" : ""}
          </label>
          <select
            required={states.length > 0}
            disabled={disabled || loadingStates || states.length === 0}
            value={value.stateId}
            onChange={(e) => {
              onChange({
                ...value,
                stateId: e.target.value,
                cityId: "",
              });
            }}
            className={`w-full rounded-xl border border-neutral-300 bg-white font-medium text-neutral-900 focus:outline-none focus:border-neutral-900 disabled:bg-neutral-100 disabled:text-neutral-400 ${inputPad}`}
          >
            <option value="">{statePlaceholder}</option>
            {states.map((s) => (
              <option key={s.id} value={s.id}>
                {s.state_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={`block font-bold uppercase tracking-wider text-neutral-500 mb-1 ${labelSize}`}>
            {isTr ? "İlçe / Şehir" : "City / District"} {cities.length > 0 ? "*" : ""}
          </label>
          <select
            required={cities.length > 0}
            disabled={disabled || loadingCities || cities.length === 0}
            value={value.cityId}
            onChange={(e) => {
              onChange({
                ...value,
                cityId: e.target.value,
              });
            }}
            className={`w-full rounded-xl border border-neutral-300 bg-white font-medium text-neutral-900 focus:outline-none focus:border-neutral-900 disabled:bg-neutral-100 disabled:text-neutral-400 ${inputPad}`}
          >
            <option value="">{cityPlaceholder}</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>
        </div>

        {showPostalCode && (
          <div>
            <label className={`block font-bold uppercase tracking-wider text-neutral-500 mb-1 ${labelSize}`}>
              {isTr ? "Posta Kodu" : "Postal Code"} {requirePostalCode ? "*" : ""}
            </label>
            <input
              type="text"
              required={requirePostalCode}
              disabled={disabled}
              value={value.postalCode}
              onChange={(e) => {
                onChange({
                  ...value,
                  postalCode: e.target.value,
                });
              }}
              placeholder="34173"
              className={`w-full rounded-xl border border-neutral-300 bg-white font-medium text-neutral-900 focus:outline-none focus:border-neutral-900 ${inputPad}`}
            />
          </div>
        )}
      </div>

      <div>
        <label className={`block font-bold uppercase tracking-wider text-neutral-500 mb-1 ${labelSize}`}>
          {isTr ? "Açık Adres (Mahalle, Cadde/Sokak, Bina & Daire No) *" : "Full Street Address (Neighborhood, Street, Building/Suite) *"}
        </label>
        <textarea
          rows={compact ? 2 : 3}
          required
          disabled={disabled}
          value={value.addressLine}
          onChange={(e) => {
            onChange({
              ...value,
              addressLine: e.target.value,
            });
          }}
          placeholder={
            isTr
              ? "Örn: Mehmet Nesih Özmen Mah. Gülsever Sok. No:12 D:4"
              : "e.g. 245 West 38th Street, Suite 702"
          }
          className={`w-full rounded-xl border border-neutral-300 bg-white font-medium text-neutral-900 focus:outline-none focus:border-neutral-900 resize-none ${inputPad}`}
        />
      </div>
    </div>
  );
}
