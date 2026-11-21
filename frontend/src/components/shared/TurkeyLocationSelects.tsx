"use client";

import React, { useState } from "react";
import {
  TURKEY_PROVINCES,
  getDistrictsForProvince,
  isKnownTurkeyProvince,
} from "@/utils/brandContactHelpers";

const OTHER_PROVINCE_VALUE = "__OTHER__";

interface TurkeyLocationSelectsProps {
  readonly city: string;
  readonly district: string;
  readonly onCityChange: (val: string) => void;
  readonly onDistrictChange: (val: string) => void;
  readonly disabled?: boolean;
  readonly compact?: boolean;
  readonly cityId?: string;
  readonly districtId?: string;
  readonly cityLabel?: string;
  readonly districtLabel?: string;
}

export default function TurkeyLocationSelects({
  city,
  district,
  onCityChange,
  onDistrictChange,
  disabled = false,
  compact = false,
  cityId,
  districtId,
  cityLabel = "İl",
  districtLabel = "İlçe",
}: TurkeyLocationSelectsProps) {
  const isCustomInit = Boolean(city.trim()) && !isKnownTurkeyProvince(city);
  const [manualMode, setManualMode] = useState(isCustomInit);

  const inCustomMode = manualMode || (Boolean(city.trim()) && !isKnownTurkeyProvince(city));
  const districts = getDistrictsForProvince(city);
  const districtKnown = !district.trim() || districts.includes(district);

  const labelCls = compact
    ? "block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1"
    : "block text-xs font-bold text-zinc-600 uppercase tracking-wider mb-1";
  const inputCls = compact
    ? "w-full px-3 py-1.5 border border-zinc-200 rounded-lg bg-white text-xs font-semibold text-zinc-800 focus:outline-none focus:border-violet-500 disabled:opacity-60"
    : "w-full px-3.5 py-2.5 border border-zinc-200 rounded-xl bg-zinc-50/50 focus:outline-none focus:border-violet-500 focus:bg-white focus:ring-1 focus:ring-violet-500/20 text-xs font-semibold text-zinc-800 transition-all disabled:opacity-60";

  const handleProvinceSelectChange = (val: string) => {
    if (val === OTHER_PROVINCE_VALUE) {
      setManualMode(true);
      onCityChange("");
      onDistrictChange("");
      return;
    }
    setManualMode(false);
    onCityChange(val);
    onDistrictChange("");
  };

  if (inCustomMode) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <div className="flex items-center justify-between gap-2 mb-1">
            <label htmlFor={cityId} className={compact ? "text-[10px] font-bold text-zinc-500 uppercase tracking-wider" : "text-xs font-bold text-zinc-600 uppercase tracking-wider"}>
              {cityLabel} (Serbest)
            </label>
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setManualMode(false);
                onCityChange("İstanbul");
                onDistrictChange("Güngören");
              }}
              className="text-[10px] font-bold text-violet-600 hover:underline cursor-pointer"
            >
              TR Listesi
            </button>
          </div>
          <input
            id={cityId}
            type="text"
            value={city}
            disabled={disabled}
            onChange={(e) => onCityChange(e.target.value)}
            placeholder="İl / Şehir"
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor={districtId} className={labelCls}>
            {districtLabel}
          </label>
          <input
            id={districtId}
            type="text"
            value={district}
            disabled={disabled}
            onChange={(e) => onDistrictChange(e.target.value)}
            placeholder="İlçe / Bölge"
            className={inputCls}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label htmlFor={cityId} className={labelCls}>
          {cityLabel}
        </label>
        <select
          id={cityId}
          value={city}
          disabled={disabled}
          onChange={(e) => handleProvinceSelectChange(e.target.value)}
          className={inputCls}
        >
          <option value="">İl Seçiniz...</option>
          {TURKEY_PROVINCES.map((p) => (
            <option key={p.code} value={p.name}>
              {p.name}
            </option>
          ))}
          <option value={OTHER_PROVINCE_VALUE}>Diğer / Yurtdışı (Elle Gir)...</option>
        </select>
      </div>

      <div>
        <label htmlFor={districtId} className={labelCls}>
          {districtLabel}
        </label>
        {districts.length > 0 && districtKnown ? (
          <select
            id={districtId}
            value={district}
            disabled={disabled || !city}
            onChange={(e) => onDistrictChange(e.target.value)}
            className={inputCls}
          >
            <option value="">{city ? "İlçe Seçiniz..." : "Önce İl Seçin"}</option>
            {districts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        ) : (
          <input
            id={districtId}
            type="text"
            value={district}
            disabled={disabled}
            onChange={(e) => onDistrictChange(e.target.value)}
            placeholder={city ? "İlçe yazın..." : "Önce il seçin"}
            className={inputCls}
          />
        )}
      </div>
    </div>
  );
}
