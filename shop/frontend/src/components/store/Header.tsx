"use client";

import React, { useRef, useState, useEffect } from "react";
import { Search, ShoppingBag, Heart, User, ChevronDown, Menu } from "lucide-react";
import { languages, t, getCategoryPrefix as getCategoryPrefixFn, getCategoryTitle, getCategoryUrl } from "@/app/i18n";
import { Category } from "@/types/store";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "@/app/utils";
import AuthModal from "./AuthModal";

const getFlagUrl = (code: string): string => {
  const mapping: Record<string, string> = {
    tr: "tr",
    en: "gb",
    ar: "sa",
    ru: "ru",
    pl: "pl",
    bg: "bg",
    de: "de",
    fr: "fr"
  };
  const country = mapping[code] || code;
  return `https://flagcdn.com/w20/${country.toLowerCase()}.png`;
};

interface HeaderProps {
  lang: string;
  setLang: (lang: string) => void;
  isLangOpen: boolean;
  setIsLangOpen: (open: boolean) => void;
  totalPkgs: number;
  setIsCartOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;
  setCurrentPage: (page: number) => void;
  setActiveCategoryId: (catId: string) => void;
  categories: Category[];
  activeCategoryId: string;
  displayCurrency: string;
  onCurrencyChange: (currency: string) => void;
}

export default function Header({
  lang,
  setLang,
  isLangOpen,
  setIsLangOpen,
  totalPkgs,
  setIsCartOpen,
  setSearchQuery,
  setCurrentPage,
  setActiveCategoryId,
  categories,
  activeCategoryId,
  displayCurrency,
  onCurrencyChange,
}: HeaderProps) {
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  const [activeLanguages, setActiveLanguages] = useState<any[]>(languages);
  const [user, setUser] = useState<any | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  
  const [isCurrencyOpen, setIsCurrencyOpen] = useState(false);
  const [wishlistCount, setWishlistCount] = useState(0);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const favs = JSON.parse(localStorage.getItem("merter_wishlist") || "[]");
      setWishlistCount(favs.length);

      const handleWishlistUpdate = (e: Event) => {
        const customEvent = e as CustomEvent;
        if (customEvent.detail && Array.isArray(customEvent.detail)) {
          setWishlistCount(customEvent.detail.length);
        } else {
          // If event payload isn't the array, read directly
          const currentFavs = JSON.parse(localStorage.getItem("merter_wishlist") || "[]");
          setWishlistCount(currentFavs.length);
        }
      };
      window.addEventListener("merter-wishlist-update", handleWishlistUpdate);
      return () => {
        window.removeEventListener("merter-wishlist-update", handleWishlistUpdate);
      };
    }
  }, []);


  const currenciesList = [
    { code: "TRY", label: "TRY (TL)", flag: "🇹🇷" },
    { code: "USD", label: "USD ($)", flag: "🇺🇸" },
    { code: "EUR", label: "EUR (€)", flag: "🇪🇺" },
    { code: "GBP", label: "GBP (£)", flag: "🇬🇧" }
  ];

  const activeCurrObj = currenciesList.find(c => c.code === displayCurrency) || currenciesList[0];
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [expandedMobileCategories, setExpandedMobileCategories] = useState<Record<string, boolean>>({});

  const toggleMobileCategory = (catId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedMobileCategories((prev) => ({
      ...prev,
      [catId]: !prev[catId],
    }));
  };

  const checkAuth = () => {
    if (typeof window !== "undefined") {
      const userInfo = localStorage.getItem("store_user_info");
      if (userInfo) {
        try {
          setUser(JSON.parse(userInfo));
        } catch {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    }
  };

  useEffect(() => {
    checkAuth();
    window.addEventListener("auth-change", checkAuth);

    const handleOpenAuth = (e: Event) => {
      const customEvent = e as CustomEvent<{ mode: "login" | "register" }>;
      if (customEvent.detail && customEvent.detail.mode) {
        setAuthMode(customEvent.detail.mode);
        setIsAuthOpen(true);
      }
    };
    window.addEventListener("merter-open-auth", handleOpenAuth);

    return () => {
      window.removeEventListener("auth-change", checkAuth);
      window.removeEventListener("merter-open-auth", handleOpenAuth);
    };
  }, []);

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("store_user_token");
      localStorage.removeItem("store_user_info");
      setIsUserMenuOpen(false);
      window.dispatchEvent(new Event("auth-change"));
      
      const origin = window.location.origin;
      const keycloakUrl = "https://auth.mertervitrini.com.tr";
      const realm = "merter";
      const clientId = "admin-client";
      
      window.location.href = `${keycloakUrl}/realms/${realm}/protocol/openid-connect/logout` +
        `?client_id=${encodeURIComponent(clientId)}` +
        `&post_logout_redirect_uri=${encodeURIComponent(origin)}`;
    }
  };

  useEffect(() => {
    apiFetch<any[]>("/languages").then((data) => {
      if (data && data.length > 0) {
        const mapped = data.map((l: any) => {
          let code = l.code;
          if (code.startsWith("en_")) code = "en";
          else if (code.startsWith("tr_")) code = "tr";
          else if (code.startsWith("pl_")) code = "pl";
          else if (code.startsWith("bg_")) code = "bg";
          else if (code.startsWith("de_")) code = "de";
          else if (code.startsWith("fr_")) code = "fr";
          else if (code.startsWith("ru_")) code = "ru";
          else if (code.startsWith("ar_")) code = "ar";
          return { ...l, code };
        });
        
        // Sort according to requested order: tr, en, ar, ru, and then others
        const order = ["tr", "en", "ar", "ru"];
        mapped.sort((a: any, b: any) => {
          const idxA = order.indexOf(a.code);
          const idxB = order.indexOf(b.code);
          if (idxA > -1 && idxB > -1) return idxA - idxB;
          if (idxA > -1) return -1;
          if (idxB > -1) return 1;
          const sortA = a.sort_order ?? 999;
          const sortB = b.sort_order ?? 999;
          if (sortA !== sortB) return sortA - sortB;
          return a.code.localeCompare(b.code);
        });

        setActiveLanguages(mapped);
      }
    });
  }, []);

  const getCategoryPrefix = () => {
    return getCategoryPrefixFn(lang);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    console.log(`[Search Log] Input field value changed: "${val}"`);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      const trimmed = val.trim();
      const prefix = getCategoryPrefix();
      
      // Determine the target URL while keeping the active language prefix
      const targetUrl = trimmed 
        ? `/${prefix}/tum-urunler?q=${encodeURIComponent(trimmed)}`
        : `/${prefix}/tum-urunler`;
      
      console.log(`[Search Log] Debounced search trigger for: "${trimmed}". Target URL: "${targetUrl}"`);
      router.push(targetUrl);
    }, 450);
  };

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    router.push("/");
  };

  const currentLangObj = languages.find((l) => l.code === lang) || languages[0];

  return (
    <header className="w-full bg-white select-none border-b border-cultured">
      {/* 1. Header Top Bar - Socials, Wholesale Alert, Language dropdown */}
      <div className="hidden sm:block border-b border-cultured py-2.5 text-[13px] text-sonic-silver">
        <div className="max-w-[1720px] mx-auto px-4 flex items-center justify-between">
          {/* Social Links */}
          <div className="flex items-center gap-3">
            <a href="#" className="p-1 text-davys-gray hover:text-salmon-pink transition-colors">
              <svg className="w-[15px] h-[15px] fill-current" viewBox="0 0 24 24">
                <path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z"/>
              </svg>
            </a>
            <a href="#" className="p-1 text-davys-gray hover:text-salmon-pink transition-colors">
              <svg className="w-[15px] h-[15px] fill-current" viewBox="0 0 24 24">
                <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/>
              </svg>
            </a>
            <a href="#" className="p-1 text-davys-gray hover:text-salmon-pink transition-colors">
              <svg className="w-[15px] h-[15px] fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
              </svg>
            </a>
            <a href="#" className="p-1 text-davys-gray hover:text-salmon-pink transition-colors">
              <svg className="w-[15px] h-[15px] fill-current" viewBox="0 0 24 24">
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.779-1.75-1.75s.784-1.75 1.75-1.75 1.75.779 1.75 1.75-.784 1.75-1.75 1.75zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
              </svg>
            </a>
          </div>

          {/* Alert text */}
          <div className="font-medium text-center uppercase tracking-[0.5px]">
            <span className="text-salmon-pink font-semibold">{t("wholesale_alert", lang)}</span> — {t("alert_desc", lang)}
          </div>

          {/* Language & Currency Selectors */}
          <div className="flex items-center gap-3">
            {/* Language selector */}
            <div className="relative">
              <button 
                onClick={() => setIsLangOpen(!isLangOpen)}
                className="flex items-center gap-1.5 px-3 py-1 bg-white hover:text-salmon-pink font-semibold text-xs transition-colors cursor-pointer"
              >
                <img src={getFlagUrl(currentLangObj.code)} alt={currentLangObj.label} className="w-4 h-3 object-cover rounded shadow-sm shrink-0" />
                <span>{currentLangObj.label}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${isLangOpen ? "rotate-180" : ""}`} />
              </button>
              
              {isLangOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40 bg-transparent" 
                    onClick={() => setIsLangOpen(false)}
                  />
                  <div className="absolute right-0 top-7 bg-white border border-cultured rounded-lg shadow-lg min-w-[130px] overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100">
                    {activeLanguages.map((l) => (
                      <button
                        key={l.code}
                        onClick={() => {
                          const oldPrefix = getCategoryPrefix();
                          setLang(l.code);
                          if (typeof window !== "undefined") {
                            localStorage.setItem("preferred_lang", l.code);
                          }
                          setIsLangOpen(false);
                          setCurrentPage(1);
                          if (pathname.includes(`/${oldPrefix}/`)) {
                            const newPrefix = getCategoryPrefixFn(l.code);
                            const newPath = pathname.replace(`/${oldPrefix}/`, `/${newPrefix}/`);
                            router.push(newPath);
                          }
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-medium transition-colors cursor-pointer border-none ${
                          lang === l.code 
                            ? "text-salmon-pink bg-cultured" 
                            : "text-onyx hover:bg-cultured hover:text-eerie-black"
                        }`}
                      >
                        <img src={getFlagUrl(l.code)} alt={l.label} className="w-4 h-3 object-cover rounded shadow-sm shrink-0" />
                        <span>{l.label}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Currency selector */}
            <div className="relative">
              <button 
                onClick={() => setIsCurrencyOpen(!isCurrencyOpen)}
                className="flex items-center gap-1.5 px-3 py-1 bg-white hover:text-salmon-pink font-semibold text-xs transition-colors cursor-pointer"
              >
                <span>{activeCurrObj.flag}</span>
                <span>{activeCurrObj.label}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${isCurrencyOpen ? "rotate-180" : ""}`} />
              </button>
              
              {isCurrencyOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40 bg-transparent" 
                    onClick={() => setIsCurrencyOpen(false)}
                  />
                  <div className="absolute right-0 top-7 bg-white border border-cultured rounded-lg shadow-lg min-w-[130px] overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100">
                    {currenciesList.map((c) => (
                      <button
                        key={c.code}
                        onClick={() => {
                          onCurrencyChange(c.code);
                          setIsCurrencyOpen(false);
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-medium transition-colors cursor-pointer border-none ${
                          displayCurrency === c.code 
                            ? "text-salmon-pink bg-cultured" 
                            : "text-onyx hover:bg-cultured hover:text-eerie-black"
                        }`}
                      >
                        <span>{c.flag}</span>
                        <span>{c.label}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Header Main Bar - Logo, Search, Actions */}
      <div className="border-b border-cultured py-4 sm:py-5 bg-white">
        <div className="max-w-[1720px] mx-auto px-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-8">
          {/* Logo & Mobile Actions Row */}
          <div className="flex items-center justify-between w-full sm:w-auto">
            {/* Brand Logo */}
            <a 
              href="#" 
              onClick={handleLogoClick}
              className="flex flex-col no-underline group active:scale-[0.98] transition-transform duration-100 shrink-0"
            >
              <span className="font-sans font-extrabold text-[18px] xs:text-[20px] sm:text-[26px] tracking-tight text-eerie-black group-hover:text-salmon-pink transition-colors leading-tight">
                {t("brand_title", lang) || "Merter Vitrini"}
              </span>
              <span className="text-[7px] xs:text-[7.5px] sm:text-[9px] uppercase tracking-[2px] xs:tracking-[2.5px] sm:tracking-[3px] text-sonic-silver -mt-0.5 font-bold">
                {t("brand_subtitle", lang) || "Toptan Showroom"}
              </span>
            </a>

            {/* Mobile Actions: Language Selector, Currency Selector, Wishlist, Cart */}
            <div className="flex sm:hidden items-center gap-1 text-eerie-black shrink-0">
              {/* Compact Language Selector */}
              <div className="relative">
                <button 
                  onClick={() => setIsLangOpen(!isLangOpen)}
                  className="flex items-center gap-1 px-1.5 py-1 bg-zinc-50 border border-zinc-200/60 rounded-lg hover:text-salmon-pink font-extrabold text-[9px] transition-all cursor-pointer select-none shrink-0"
                >
                  <img src={getFlagUrl(currentLangObj.code)} alt={currentLangObj.label} className="w-3.5 h-2.5 object-cover rounded shadow-sm shrink-0" />
                  <span className="uppercase text-[9px] text-zinc-800 shrink-0">{currentLangObj.code}</span>
                </button>
                
                {isLangOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40 bg-transparent" 
                      onClick={() => setIsLangOpen(false)}
                    />
                    <div className="absolute right-0 top-7 bg-white border border-cultured rounded shadow-lg min-w-[100px] overflow-hidden z-50">
                      {activeLanguages.map((l) => (
                        <button
                          key={l.code}
                          onClick={() => {
                            const oldPrefix = getCategoryPrefix();
                            setLang(l.code);
                            if (typeof window !== "undefined") {
                              localStorage.setItem("preferred_lang", l.code);
                            }
                            setIsLangOpen(false);
                            setCurrentPage(1);
                            if (pathname.includes(`/${oldPrefix}/`)) {
                              const newPrefix = getCategoryPrefixFn(l.code);
                              const newPath = pathname.replace(`/${oldPrefix}/`, `/${newPrefix}/`);
                              router.push(newPath);
                            }
                          }}
                          className={`w-full flex items-center gap-1.5 px-2.5 py-1.5 text-left text-[10px] font-semibold transition-colors cursor-pointer border-none ${
                            lang === l.code 
                              ? "text-salmon-pink bg-cultured" 
                              : "text-onyx hover:bg-cultured hover:text-eerie-black"
                          }`}
                        >
                          <img src={getFlagUrl(l.code)} alt={l.label} className="w-4 h-3 object-cover rounded shadow-sm shrink-0" />
                          <span className="uppercase">{l.code}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Compact Currency Selector */}
              <div className="relative">
                <button 
                  onClick={() => setIsCurrencyOpen(!isCurrencyOpen)}
                  className="flex items-center gap-1 px-1.5 py-1 bg-zinc-50 border border-zinc-200/60 rounded-lg hover:text-salmon-pink font-extrabold text-[9px] transition-all cursor-pointer select-none shrink-0"
                >
                  <span className="uppercase text-[9px] text-zinc-800 shrink-0">{activeCurrObj.code}</span>
                </button>
                
                {isCurrencyOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40 bg-transparent" 
                      onClick={() => setIsCurrencyOpen(false)}
                    />
                    <div className="absolute right-0 top-7 bg-white border border-cultured rounded shadow-lg min-w-[90px] overflow-hidden z-50">
                      {currenciesList.map((c) => (
                        <button
                          key={c.code}
                          onClick={() => {
                            onCurrencyChange(c.code);
                            setIsCurrencyOpen(false);
                          }}
                          className={`w-full flex items-center gap-1.5 px-2.5 py-1.5 text-left text-[10px] font-semibold transition-colors cursor-pointer border-none ${
                            displayCurrency === c.code 
                              ? "text-salmon-pink bg-cultured" 
                              : "text-onyx hover:bg-cultured hover:text-eerie-black"
                          }`}
                        >
                          <span>{c.flag}</span>
                          <span className="uppercase">{c.code}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

               {/* Wishlist Heart Icon */}
              <button className="p-1 sm:p-1.5 hover:text-salmon-pink transition-colors relative cursor-pointer border-none bg-transparent shrink-0">
                <Heart className="w-[19px] h-[19px] sm:w-[20px] sm:h-[20px]" />
                <span className="absolute top-0 right-0 bg-salmon-pink text-white rounded-full w-[13px] h-[13px] flex items-center justify-center font-bold text-[7.5px] leading-none shadow-sm">
                  {wishlistCount}
                </span>
              </button>

              {/* User Account / Profile Mobile Action */}
              <div className="relative flex items-center shrink-0">
                {user ? (
                  <button 
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="p-1 sm:p-1.5 hover:text-salmon-pink transition-colors relative cursor-pointer border-none bg-transparent"
                  >
                    <User className="w-[19px] h-[19px] sm:w-[20px] sm:h-[20px] text-salmon-pink animate-pulse" />
                  </button>
                ) : (
                  <button 
                    onClick={() => {
                      setAuthMode("login");
                      setIsAuthOpen(true);
                    }}
                    className="p-1 sm:p-1.5 hover:text-salmon-pink transition-colors relative cursor-pointer border-none bg-transparent"
                  >
                    <User className="w-[19px] h-[19px] sm:w-[20px] sm:h-[20px]" />
                  </button>
                )}
                
                {isUserMenuOpen && user && (
                  <>
                    <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsUserMenuOpen(false)} />
                    <div className="absolute right-0 top-8 bg-white border border-cultured rounded-xl shadow-xl min-w-[150px] overflow-hidden z-50 animate-in fade-in duration-150">
                      <div className="px-3 py-2 border-b border-cultured text-[10px] text-sonic-silver truncate">
                        {user.first_name} {user.last_name}
                      </div>
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          router.push("/profile");
                        }}
                        className="w-full text-left px-3 py-2 text-xs font-bold text-eerie-black hover:bg-cultured transition-colors border-none bg-transparent cursor-pointer"
                      >
                        {lang === "tr" ? "Profilim" : "My Profile"}
                      </button>
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-3 py-2 border-t border-cultured text-xs font-bold text-red-500 hover:bg-red-50 transition-colors border-none bg-transparent cursor-pointer"
                      >
                        {t("logout", lang) || "Çıkış Yap"}
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Cart Icon */}
              <button 
                onClick={() => setIsCartOpen(true)}
                className="p-1 sm:p-1.5 hover:text-salmon-pink transition-colors relative cursor-pointer border-none bg-transparent shrink-0"
              >
                <ShoppingBag className="w-[19px] h-[19px] sm:w-[20px] sm:h-[20px]" />
                <span className="absolute top-0 right-0 bg-salmon-pink text-white rounded-full w-[13px] h-[13px] flex items-center justify-center font-bold text-[7.5px] leading-none shadow-sm">
                  {totalPkgs}
                </span>
              </button>
            </div>
          </div>

          {/* Rounded Search Bar - stacks below logo on mobile, inline on desktop */}
          <div className="relative w-full sm:flex-1 sm:max-w-[480px]">
            <div className="relative flex items-center w-full border border-cultured rounded-lg overflow-hidden focus-within:border-salmon-pink transition-all">
              <input 
                type="text" 
                id="searchInputDesktop"
                className="w-full pl-4 pr-12 py-2 sm:py-2.5 text-xs sm:text-[13px] font-medium text-onyx placeholder-spanish-gray focus:outline-none bg-white"
                placeholder={t("search_placeholder", lang)}
                onChange={handleSearchChange}
              />
              <button className="absolute right-0 top-0 bottom-0 px-4 bg-white border-l border-cultured hover:text-salmon-pink transition-colors flex items-center justify-center cursor-pointer text-eerie-black">
                <Search className="w-[18px] h-[18px]" />
              </button>
            </div>
          </div>

          {/* Desktop Only Actions */}
          <div className="hidden sm:flex items-center gap-4 text-eerie-black">
            {/* Account Profile Icon / Dropdown */}
            <div className="relative">
              {user ? (
                <>
                  <button 
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-cultured hover:text-salmon-pink text-xs font-bold transition-all duration-200 cursor-pointer border-none"
                  >
                    <User className="w-[18px] h-[18px] text-salmon-pink" />
                    <span>{`${t("hello", lang)}, ${user.first_name}`}</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${isUserMenuOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isUserMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsUserMenuOpen(false)} />
                      <div className="absolute right-0 top-11 bg-white border border-cultured rounded-xl shadow-xl min-w-[160px] overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                        <div className="px-4 py-2.5 border-b border-cultured text-[10px] text-sonic-silver">
                          {user.email}
                        </div>
                        <button
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            router.push("/profile");
                          }}
                          className="w-full text-left px-4 py-2.5 text-xs font-bold text-eerie-black hover:bg-cultured transition-colors border-none bg-transparent cursor-pointer"
                        >
                          {lang === "tr" ? "Profilim" : "My Profile"}
                        </button>
                        <button
                          onClick={handleLogout}
                          className="w-full text-left px-4 py-2.5 border-t border-cultured text-xs font-bold text-red-500 hover:bg-red-50 transition-colors border-none bg-transparent cursor-pointer"
                        >
                          {t("logout", lang)}
                        </button>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <button 
                  onClick={() => {
                    setAuthMode("login");
                    setIsAuthOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-cultured hover:border-salmon-pink text-xs font-bold text-eerie-black hover:text-salmon-pink transition-all duration-200 cursor-pointer bg-white"
                >
                  <User className="w-[18px] h-[18px]" />
                  <span>{t("login", lang)}</span>
                </button>
              )}
            </div>

            {/* Wishlist Heart Icon */}
            <button className="p-2 hover:text-salmon-pink transition-colors relative cursor-pointer border-none bg-transparent">
              <Heart className="w-[22px] h-[22px]" />
              <span className="absolute top-0 right-0 bg-salmon-pink text-white rounded-full w-[17px] h-[17px] flex items-center justify-center font-bold text-[10px] leading-none shadow-sm">
                {wishlistCount}
              </span>
            </button>

            {/* Cart Icon */}
            <button 
              onClick={() => setIsCartOpen(true)}
              className="p-2 hover:text-salmon-pink transition-colors relative cursor-pointer border-none bg-transparent"
            >
              <ShoppingBag className="w-[22px] h-[22px]" />
              <span className="absolute top-0 right-0 bg-salmon-pink text-white rounded-full w-[17px] h-[17px] flex items-center justify-center font-bold text-[10px] leading-none shadow-sm">
                {totalPkgs}
              </span>
            </button>
          </div>
        </div>
      </div>


      {/* 3. Horizontal Navigation Menu (Tier 3) */}
      <nav className="bg-white border-b border-cultured py-3 hidden md:block">
        <div className="max-w-[1720px] mx-auto px-4 flex items-center justify-center gap-8">
          <button 
            onClick={() => {
              router.push("/tum-urunler");
            }}
            className={`text-[13px] font-bold tracking-[0.5px] uppercase transition-colors border-none bg-transparent cursor-pointer relative after:absolute after:bottom-[-6px] after:left-0 after:right-0 after:h-[2px] after:bg-salmon-pink after:transition-all after:duration-200 ${
              activeCategoryId === "" 
                ? "text-salmon-pink after:scale-x-100" 
                : "text-onyx hover:text-salmon-pink after:scale-x-0 hover:after:scale-x-100"
            }`}
          >
            {t("all_products", lang)}
          </button>
          
          {categories.map((cat) => (
            <div key={cat.id} className="relative group py-2">
              <button 
                onClick={() => {
                  router.push(getCategoryUrl(categories, cat, lang));
                }}
                className={`text-[13px] font-bold tracking-[0.5px] uppercase transition-colors border-none bg-transparent cursor-pointer relative after:absolute after:bottom-[-6px] after:left-0 after:right-0 after:h-[2px] after:bg-salmon-pink after:transition-all after:duration-200 ${
                  activeCategoryId === cat.slug || activeCategoryId === cat.id 
                    ? "text-salmon-pink after:scale-x-100" 
                    : "text-onyx hover:text-salmon-pink after:scale-x-0 hover:after:scale-x-100"
                }`}
              >
                {getCategoryTitle(cat, lang)}
              </button>

              {/* Mega Dropdown Menu for Categories with Children */}
              {cat.children && cat.children.length > 0 && (
                <div className="absolute left-1/2 -translate-x-1/2 top-full pt-4 z-50 w-[90vw] max-w-5xl transition-all duration-300 opacity-0 invisible translate-y-2 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 pointer-events-none group-hover:pointer-events-auto">
                  <div className="bg-white border border-cultured rounded-xl shadow-2xl p-8 grid grid-cols-4 gap-x-8 gap-y-6">
                    {cat.children.map((sub) => (
                      <div key={sub.id} className="flex flex-col">
                        <button
                          onClick={() => {
                            router.push(getCategoryUrl(categories, sub, lang));
                          }}
                          className={`text-left font-extrabold text-[13px] tracking-wider uppercase mb-3 border-none bg-transparent cursor-pointer transition-colors ${
                            activeCategoryId === sub.slug || activeCategoryId === sub.id ? "text-salmon-pink" : "text-eerie-black hover:text-salmon-pink"
                          }`}
                        >
                          {getCategoryTitle(sub, lang)}
                        </button>
                        
                        {sub.children && sub.children.length > 0 && (
                          <div className="flex flex-col gap-2 border-l border-cultured pl-3">
                            {sub.children.map((child) => (
                              <button
                                key={child.id}
                                onClick={() => {
                                  router.push(getCategoryUrl(categories, child, lang));
                                }}
                                className={`text-left text-xs font-semibold border-none bg-transparent cursor-pointer transition-colors duration-150 py-0.5 ${
                                  activeCategoryId === child.slug || activeCategoryId === child.id 
                                    ? "text-salmon-pink font-bold" 
                                    : "text-sonic-silver hover:text-salmon-pink"
                                }`}
                              >
                                {getCategoryTitle(child, lang)}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </nav>

      {/* 4. Collapsible Mobile Category Selector Bar */}
      <div className="relative md:hidden bg-white border-b border-cultured px-2.5 xs:px-4 py-2.5 select-none">
        <div className="flex gap-1.5 xs:gap-2 w-full">
          {/* Main Toggle Button */}
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="flex-1 flex items-center justify-between px-2 xs:px-4 py-2 bg-zinc-50 border border-zinc-200/60 rounded-xl hover:bg-zinc-100/80 text-xs font-bold text-onyx transition-all duration-200 cursor-pointer"
          >
            <div className="flex items-center gap-1.5 xs:gap-2">
              <Menu className="w-4 h-4 text-salmon-pink shrink-0" />
              <span className="truncate">
                {t("select_category", lang)}
              </span>
            </div>
            
            {/* Show active category badge if any */}
            <div className="flex items-center gap-1.5 shrink-0">
              {activeCategoryId ? (() => {
                const findInTree = (cats: Category[]): Category | null => {
                  for (const c of cats) {
                    if (c.slug === activeCategoryId || c.id === activeCategoryId) return c;
                    if (c.children) {
                      const f = findInTree(c.children);
                      if (f) return f;
                    }
                  }
                  return null;
                };
                const activeObj = findInTree(categories);
                const title = activeObj ? getCategoryTitle(activeObj, lang) : "";
                if (!title) return null;
                return (
                  <span 
                    style={{ backgroundColor: "rgba(255, 143, 155, 0.15)", color: "#e04b5c" }}
                    className="px-2 py-0.5 rounded-full text-[10px] font-extrabold max-w-[80px] xs:max-w-[120px] truncate animate-fade-in shrink-0"
                  >
                    {title}
                  </span>
                );
              })() : (
                <span className="px-2 py-0.5 bg-zinc-100 text-zinc-500 rounded-full text-[10px] font-extrabold max-w-[80px] xs:max-w-[120px] truncate">
                  {t("all_products", lang)}
                </span>
              )}
              <ChevronDown className="w-3 h-3 text-zinc-500 transition-transform duration-300 shrink-0" />
            </div>
          </button>
          
          {/* Fast Shortcut: "Tüm Ürünler" button directly next to it */}
          <button
            onClick={() => {
              router.push("/tum-urunler");
              setIsMobileMenuOpen(false);
            }}
            className={`px-3 xs:px-4 py-2 rounded-xl text-xs font-extrabold transition-all border cursor-pointer select-none shrink-0 ${
              activeCategoryId === ""
                ? "bg-salmon-pink text-white border-salmon-pink shadow-sm"
                : "bg-white text-onyx border-zinc-200/60 hover:bg-zinc-50"
            }`}
          >
            {t("all_btn", lang)}
          </button>
        </div>

        {/* Backdrop for the dropdown to close it when clicking outside */}
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 top-[210px] sm:top-[220px] bg-black/25 backdrop-blur-[2px] z-40" 
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Collapsible Category Menu Accordion Dropdown */}
        {isMobileMenuOpen && (
          <div className="absolute left-0 right-0 top-full bg-white border-b border-cultured shadow-2xl z-50 overflow-hidden animate-in slide-in-from-top-4 duration-300 max-h-[70vh] overflow-y-auto">
            <div className="px-4 py-3 flex flex-col divide-y divide-zinc-100">
              
              {/* "Tüm Ürünler" Row */}
              <div className="py-2.5">
                <button
                  onClick={() => {
                    router.push("/tum-urunler");
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full text-left text-xs font-bold uppercase transition-colors border-none bg-transparent cursor-pointer ${
                    activeCategoryId === "" ? "text-salmon-pink" : "text-eerie-black hover:text-salmon-pink"
                  }`}
                >
                  ✨ {t("all_products", lang)}
                </button>
              </div>

              {/* Render top-level categories */}
              {categories.map((cat) => {
                const hasChildren = cat.children && cat.children.length > 0;
                const isExpanded = !!expandedMobileCategories[cat.id];
                const isActive = activeCategoryId === cat.slug || activeCategoryId === cat.id;

                return (
                  <div key={cat.id} className="py-2.5 flex flex-col">
                    <div className="flex items-center justify-between w-full">
                      {/* Main Category Click */}
                      <button
                        onClick={() => {
                          router.push(getCategoryUrl(categories, cat, lang));
                          setIsMobileMenuOpen(false);
                        }}
                        className={`text-left text-xs font-extrabold uppercase transition-colors border-none bg-transparent cursor-pointer flex-1 py-1 ${
                          isActive ? "text-salmon-pink" : "text-eerie-black hover:text-salmon-pink"
                        }`}
                      >
                        {getCategoryTitle(cat, lang)}
                      </button>

                      {/* Expand/Collapse Chevron Button */}
                      {hasChildren && (
                        <button
                          onClick={(e) => toggleMobileCategory(cat.id, e)}
                          className="p-2 -mr-2 text-zinc-500 hover:text-salmon-pink transition-colors border-none bg-transparent cursor-pointer flex items-center justify-center rounded-full hover:bg-zinc-50"
                        >
                          <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`} />
                        </button>
                      )}
                    </div>

                    {/* Level 2 Subcategories (Accordion Children) */}
                    {hasChildren && isExpanded && (
                      <div className="mt-2 pl-3 ml-1 border-l-2 border-zinc-100 flex flex-col gap-2.5 animate-in fade-in duration-200">
                        {cat.children!.map((sub) => {
                          const hasSubChildren = sub.children && sub.children.length > 0;
                          const isSubExpanded = !!expandedMobileCategories[sub.id];
                          const isSubActive = activeCategoryId === sub.slug || activeCategoryId === sub.id;

                          return (
                            <div key={sub.id} className="flex flex-col gap-1.5 py-0.5">
                              <div className="flex items-center justify-between w-full">
                                <button
                                  onClick={() => {
                                    router.push(getCategoryUrl(categories, sub, lang));
                                    setIsMobileMenuOpen(false);
                                  }}
                                  className={`text-left text-xs font-bold transition-colors border-none bg-transparent cursor-pointer flex-1 py-0.5 ${
                                    isSubActive ? "text-salmon-pink" : "text-onyx hover:text-salmon-pink"
                                  }`}
                                >
                                  {getCategoryTitle(sub, lang)}
                                </button>

                                {hasSubChildren && (
                                  <button
                                    onClick={(e) => toggleMobileCategory(sub.id, e)}
                                    className="p-1 text-zinc-400 hover:text-salmon-pink transition-colors border-none bg-transparent cursor-pointer flex items-center justify-center rounded-full hover:bg-zinc-50"
                                  >
                                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${isSubExpanded ? "rotate-180" : ""}`} />
                                  </button>
                                )}
                              </div>

                              {/* Level 3 Children (Pills or bullet points) */}
                              {hasSubChildren && isSubExpanded && (
                                <div className="pl-3.5 border-l border-zinc-100/80 flex flex-wrap gap-1.5 py-1 animate-in fade-in duration-200">
                                  {sub.children!.map((child) => {
                                    const isChildActive = activeCategoryId === child.slug || activeCategoryId === child.id;

                                    return (
                                      <button
                                        key={child.id}
                                        onClick={() => {
                                          router.push(getCategoryUrl(categories, child, lang));
                                          setIsMobileMenuOpen(false);
                                        }}
                                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                                          isChildActive
                                            ? "bg-salmon-pink/10 text-salmon-pink border-salmon-pink/30"
                                            : "bg-zinc-50 text-sonic-silver border-zinc-150/50 hover:bg-zinc-100 hover:text-onyx"
                                        }`}
                                      >
                                        {getCategoryTitle(child, lang)}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

            </div>
          </div>
        )}
      </div>

      <AuthModal 
        isOpen={isAuthOpen} 
        onClose={() => setIsAuthOpen(false)} 
        lang={lang} 
        initialMode={authMode} 
      />
    </header>
  );
}
