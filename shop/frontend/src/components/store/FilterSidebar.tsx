"use client";

import React, { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { Brand } from "@/types/store";
import { t } from "@/app/i18n";

interface FilterSidebarProps {
  lang: string;
  brands: Brand[];
  activeBrandIds: string[];
  handleBrandChange: (brandId: string) => void;
  activeSpecs: { gender: string[]; season: string[] };
  handleSpecChange: (type: "gender" | "season", value: string) => void;
  // Dynamic attribute filters
  attributes: Record<string, string[]>;
  activeAttributes: Record<string, string[]>;
  handleAttributeChange: (name: string, value: string) => void;
  // Price range filters
  minPrice: string;
  maxPrice: string;
  setMinPrice: (val: string) => void;
  setMaxPrice: (val: string) => void;
  facets?: {
    brands?: Record<string, number>;
    genders?: Record<string, number>;
    seasons?: Record<string, number>;
    attributes?: Record<string, Record<string, number>>;
  } | null;
  handleClearAllFilters: () => void;
}

function safeGetCount(obj: Record<string, number> | undefined | null, key: string): number {
  if (!obj || typeof obj !== "object") return 0;
  const cleanKey = String(key).trim();
  if (cleanKey === "__proto__" || cleanKey === "constructor" || cleanKey === "prototype") {
    return 0;
  }
  if (Object.prototype.hasOwnProperty.call(obj, cleanKey)) {
    return obj[cleanKey] ?? 0;
  }
  return 0;
}

function safeGetAttributeCount(
  attributesObj: Record<string, Record<string, number>> | undefined | null,
  attrName: string,
  val: string
): number {
  if (!attributesObj || typeof attributesObj !== "object") return 0;
  
  const cleanAttrName = String(attrName).trim();
  if (cleanAttrName === "__proto__" || cleanAttrName === "constructor" || cleanAttrName === "prototype") {
    return 0;
  }
  
  if (Object.prototype.hasOwnProperty.call(attributesObj, cleanAttrName)) {
    const valObj = attributesObj[cleanAttrName];
    return safeGetCount(valObj, val);
  }
  return 0;
}

export default function FilterSidebar({
  lang,
  brands,
  activeBrandIds,
  handleBrandChange,
  activeSpecs,
  handleSpecChange,
  attributes,
  activeAttributes,
  handleAttributeChange,
  minPrice,
  maxPrice,
  setMinPrice,
  setMaxPrice,
  facets,
  handleClearAllFilters,
}: FilterSidebarProps) {
  
  // Local price states for intermediate typing
  const [localMinPrice, setLocalMinPrice] = useState<string>(minPrice);
  const [localMaxPrice, setLocalMaxPrice] = useState<string>(maxPrice);

  useEffect(() => {
    setLocalMinPrice(minPrice);
  }, [minPrice]);

  useEffect(() => {
    setLocalMaxPrice(maxPrice);
  }, [maxPrice]);

  // Track open/collapsed state of each filter section
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    brands: true,
    b2b: true,
    priceRange: true,
  });

  // Responsive Initialization: Collapse filters by default on mobile to save scroll space, keep open on desktop
  useEffect(() => {
    if (typeof window !== "undefined") {
      const isMobile = window.innerWidth < 1024; // lg tailwind breakpoint
      const initialOpen: Record<string, boolean> = {
        brands: !isMobile,
        b2b: !isMobile,
        priceRange: !isMobile,
      };
      
      // Populate dynamic catalog attributes
      Object.keys(attributes).forEach((attrName) => {
        if (attrName !== "__proto__" && attrName !== "constructor" && attrName !== "prototype") {
          Reflect.set(initialOpen, attrName, !isMobile);
        }
      });
      
      setOpenSections(initialOpen);
    }
  }, [attributes]);

  const toggleSection = (sectionKey: string) => {
    const safeKey = String(sectionKey).trim();
    if (safeKey === "__proto__" || safeKey === "constructor") return;
    
    setOpenSections((prev) => {
      const next = { ...prev };
      const current = Object.prototype.hasOwnProperty.call(prev, safeKey) ? Reflect.get(prev, safeKey) : false;
      Reflect.set(next, safeKey, !current);
      return next;
    });
  };

  const hasActiveFilters = 
    activeBrandIds.length > 0 ||
    activeSpecs.gender.length > 0 ||
    activeSpecs.season.length > 0 ||
    minPrice !== "" ||
    maxPrice !== "" ||
    Object.values(activeAttributes).some(values => values && values.length > 0);

  return (
    <aside className="lg:col-span-1 flex flex-col gap-6 select-none">
      <div className="bg-white rounded-[15px] p-6 border border-cultured flex flex-col gap-5 shadow-sm">
        
        {/* Sidebar Header with Clear All Button */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between border-b border-cultured pb-4.5 mb-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
            <span className="text-[11px] font-extrabold text-onyx uppercase tracking-wider">
              {lang === "tr" ? "Aktif Filtreler" : "Active Filters"}
            </span>
            <button
              type="button"
              onClick={handleClearAllFilters}
              className="text-[10px] font-extrabold text-salmon-pink hover:text-eerie-black transition-colors duration-200 border-none bg-transparent cursor-pointer flex items-center gap-1 uppercase tracking-widest active:scale-95 transform select-none"
            >
              ✕ {lang === "tr" ? "Temizle" : "Clear All"}
            </button>
          </div>
        )}
        
        {/* Section 1: Brands Filter */}
        <div className="border-b border-cultured pb-4">
          <button 
            onClick={() => toggleSection("brands")}
            className="flex items-center justify-between w-full text-left focus:outline-none group cursor-pointer"
          >
            <span className="text-xs uppercase font-extrabold text-eerie-black tracking-[0.5px] group-hover:text-salmon-pink transition-colors">
              {t("brand_filter", lang)}
            </span>
            <ChevronDown 
              size={14} 
              className={`text-sonic-silver transition-transform duration-200 ${
                openSections.brands ? "transform rotate-180" : ""
              }`}
            />
          </button>
          
          {openSections.brands && (
            <div className="flex flex-col gap-2.5 max-h-48 overflow-y-auto pr-1 mt-3.5 animate-in fade-in duration-200">
              {brands.map((br) => {
                const count = safeGetCount(facets?.brands, br.id);
                const isDisabled = count === 0 && facets !== null;
                const isChecked = activeBrandIds.includes(br.id);
                return (
                  <label 
                    key={br.id} 
                    className={`flex items-center gap-2.5 text-xs font-semibold hover:text-salmon-pink cursor-pointer transition-colors duration-150 ${
                      isDisabled && !isChecked ? "opacity-40 cursor-not-allowed pointer-events-none" : "text-onyx"
                    }`}
                  >
                    <input 
                      type="checkbox" 
                      className="rounded border-cultured bg-white text-salmon-pink focus:ring-salmon-pink w-4 h-4 cursor-pointer disabled:opacity-50"
                      checked={isChecked}
                      disabled={isDisabled && !isChecked}
                      onChange={() => handleBrandChange(br.id)}
                    />
                    <span>
                      {br.alias_code || br.name}
                      {facets !== null && <span className="text-[10px] text-sonic-silver ml-1 font-bold">({count})</span>}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 2: B2B Specs Filters */}
        <div className="border-b border-cultured pb-4">
          <button 
            onClick={() => toggleSection("b2b")}
            className="flex items-center justify-between w-full text-left focus:outline-none group cursor-pointer"
          >
            <span className="text-xs uppercase font-extrabold text-eerie-black tracking-[0.5px] group-hover:text-salmon-pink transition-colors">
              {t("b2b_specs", lang)}
            </span>
            <ChevronDown 
              size={14} 
              className={`text-sonic-silver transition-transform duration-200 ${
                openSections.b2b ? "transform rotate-180" : ""
              }`}
            />
          </button>
          
          {openSections.b2b && (
            <div className="mt-4 flex flex-col gap-4 animate-in fade-in duration-200">
              {/* Gender Sub-section */}
              <div>
                <span className="block text-[10px] uppercase font-bold text-sonic-silver mb-2 tracking-wider">
                  {t("gender", lang)}
                </span>
                <div className="flex flex-col gap-2.5">
                  {["Kadın", "Erkek", "Unisex"].map((g) => {
                    const count = safeGetCount(facets?.genders, g);
                    const isDisabled = count === 0 && facets !== null;
                    const isChecked = activeSpecs.gender.includes(g);
                    return (
                      <label 
                        key={g} 
                        className={`flex items-center gap-2.5 text-xs font-semibold hover:text-salmon-pink cursor-pointer transition-colors duration-150 ${
                          isDisabled && !isChecked ? "opacity-40 cursor-not-allowed pointer-events-none" : "text-onyx"
                        }`}
                      >
                        <input 
                          type="checkbox" 
                          className="rounded border-cultured bg-white text-salmon-pink focus:ring-salmon-pink w-4 h-4 cursor-pointer disabled:opacity-50"
                          checked={isChecked}
                          disabled={isDisabled && !isChecked}
                          onChange={() => handleSpecChange("gender", g)}
                        />
                        <span>
                          {t(g === "Kadın" ? "women" : g === "Erkek" ? "men" : "unisex", lang)}
                          {facets !== null && <span className="text-[10px] text-sonic-silver ml-1 font-bold">({count})</span>}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Season Sub-section */}
              <div>
                <span className="block text-[10px] uppercase font-bold text-sonic-silver mb-2 tracking-wider">
                  {t("season", lang)}
                </span>
                <div className="flex flex-col gap-2.5">
                  {["Yazlık", "Kışlık", "Mevsimlik"].map((s) => {
                    const count = safeGetCount(facets?.seasons, s);
                    const isDisabled = count === 0 && facets !== null;
                    const isChecked = activeSpecs.season.includes(s);
                    return (
                      <label 
                        key={s} 
                        className={`flex items-center gap-2.5 text-xs font-semibold hover:text-salmon-pink cursor-pointer transition-colors duration-150 ${
                          isDisabled && !isChecked ? "opacity-40 cursor-not-allowed pointer-events-none" : "text-onyx"
                        }`}
                      >
                        <input 
                          type="checkbox" 
                          className="rounded border-cultured bg-white text-salmon-pink focus:ring-salmon-pink w-4 h-4 cursor-pointer disabled:opacity-50"
                          checked={isChecked}
                          disabled={isDisabled && !isChecked}
                          onChange={() => handleSpecChange("season", s)}
                        />
                        <span>
                          {t(s === "Yazlık" ? "summer" : s === "Kışlık" ? "winter" : "midseason", lang)}
                          {facets !== null && <span className="text-[10px] text-sonic-silver ml-1 font-bold">({count})</span>}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Section 2.5: Price Range Filter */}
        <div className="border-b border-cultured pb-4">
          <button 
            onClick={() => toggleSection("priceRange")}
            className="flex items-center justify-between w-full text-left focus:outline-none group cursor-pointer"
          >
            <span className="text-xs uppercase font-extrabold text-eerie-black tracking-[0.5px] group-hover:text-salmon-pink transition-colors">
              {lang === "tr" ? "Fiyat Aralığı" : "Price Range"}
            </span>
            <ChevronDown 
              size={14} 
              className={`text-sonic-silver transition-transform duration-200 ${
                openSections.priceRange ? "transform rotate-180" : ""
              }`}
            />
          </button>
          
          {openSections.priceRange && (
            <div className="mt-3.5 flex flex-col gap-2.5 animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <div className="relative flex-grow min-w-0">
                  <input
                    type="number"
                    placeholder="Min"
                    value={localMinPrice}
                    onChange={(e) => setLocalMinPrice(e.target.value)}
                    className="w-full bg-white border border-cultured rounded-[5px] px-2.5 py-1.5 text-xs font-semibold text-onyx focus:outline-none focus:border-salmon-pink shadow-inner"
                  />
                </div>
                <span className="text-sonic-silver text-xs font-bold">-</span>
                <div className="relative flex-grow min-w-0">
                  <input
                    type="number"
                    placeholder="Max"
                    value={localMaxPrice}
                    onChange={(e) => setLocalMaxPrice(e.target.value)}
                    className="w-full bg-white border border-cultured rounded-[5px] px-2.5 py-1.5 text-xs font-semibold text-onyx focus:outline-none focus:border-salmon-pink shadow-inner"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMinPrice(localMinPrice);
                  setMaxPrice(localMaxPrice);
                }}
                className="w-full py-2 bg-salmon-pink hover:bg-eerie-black text-white text-[11px] font-extrabold uppercase rounded-[5px] transition-colors border-none cursor-pointer shadow-sm active:scale-95"
              >
                {lang === "tr" ? "Uygula" : "Apply"}
              </button>
            </div>
          )}
        </div>

        {/* Section 3: Dynamic Product Attributes Filters */}
        {Object.entries(attributes).map(([attrName, values]) => {
          if (attrName === "__proto__" || attrName === "constructor") return null;
          
          const isSectionOpen = Object.prototype.hasOwnProperty.call(openSections, attrName) 
            ? Reflect.get(openSections, attrName) 
            : false;
            
          return (
            <div key={attrName} className="border-b border-cultured last:border-b-0 pb-4 last:pb-0">
              <button 
                onClick={() => toggleSection(attrName)}
                className="flex items-center justify-between w-full text-left focus:outline-none group cursor-pointer"
              >
                <span className="text-xs uppercase font-extrabold text-eerie-black tracking-[0.5px] group-hover:text-salmon-pink transition-colors">
                  {t(attrName, lang)}
                </span>
                <ChevronDown 
                  size={14} 
                  className={`text-sonic-silver transition-transform duration-200 ${
                    isSectionOpen ? "transform rotate-180" : ""
                  }`}
                />
              </button>
              
              {isSectionOpen && (
                <div className="flex flex-col gap-2.5 max-h-48 overflow-y-auto pr-1 mt-3.5 animate-in fade-in duration-200">
                  {values.map((val) => {
                    const isChecked = (
                      attrName !== "__proto__" &&
                      attrName !== "constructor" &&
                      Object.prototype.hasOwnProperty.call(activeAttributes, attrName)
                    ) ? (Reflect.get(activeAttributes, attrName) as string[])?.includes(val) : false;
                    
                    const count = safeGetAttributeCount(facets?.attributes, attrName, val);
                    const isDisabled = count === 0 && facets !== null;
                    return (
                      <label 
                        key={val} 
                        className={`flex items-center gap-2.5 text-xs font-semibold hover:text-salmon-pink cursor-pointer transition-colors duration-150 ${
                          isDisabled && !isChecked ? "opacity-40 cursor-not-allowed pointer-events-none" : "text-onyx"
                        }`}
                      >
                        <input 
                          type="checkbox" 
                          className="rounded border-cultured bg-white text-salmon-pink focus:ring-salmon-pink w-4 h-4 cursor-pointer disabled:opacity-50"
                          checked={isChecked}
                          disabled={isDisabled && !isChecked}
                          onChange={() => handleAttributeChange(attrName, val)}
                        />
                        <span>
                          {t(val, lang)}
                          {facets !== null && <span className="text-[10px] text-sonic-silver ml-1 font-bold">({count})</span>}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

      </div>
    </aside>
  );
}
