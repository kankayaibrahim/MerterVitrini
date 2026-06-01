"use client";

import React, { useEffect, useState } from "react";
import { t } from "../../app/i18n";
import { apiFetch } from "../../app/utils";

interface Settings {
  id: string;
  address: string;
  phone: string;
  whatsapp: string;
  email: string;
}

interface FooterProps {
  lang: string;
  onOpenPolicy?: (type: "cancellation_and_return" | "terms_of_service" | "privacy_policy") => void;
}

export default function Footer({ lang, onOpenPolicy }: FooterProps) {
  const [settings, setSettings] = useState<Settings>({
    id: "",
    address: "AKEVLER MAH. 1076 SOK. REGNUM ASTRUM TOWER 8A C2 NO:204 ESENYURT / İSTANBUL / TÜRKİYE",
    phone: "+90 533 703 08 83",
    whatsapp: "+90 533 703 08 83",
    email: "info@toptanmoda.net",
  });

  useEffect(() => {
    async function loadSettings() {
      const data = await apiFetch<Settings>("/settings");
      if (data) {
        setSettings(data);
      }
    }
    loadSettings();
  }, []);

  // Format WhatsApp link correctly (digits only, e.g. 905337030883)
  const sanitizedWhatsapp = settings.whatsapp.replace(/[^0-9]/g, "");
  const whatsappUrl = `https://wa.me/${sanitizedWhatsapp}`;

  return (
    <footer className="bg-slate-900 border-t border-slate-800 text-slate-400 py-12 px-6 md:px-12 mt-16 font-sans">
      <div className="max-w-[1720px] mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
        
        {/* Column 1: Contact Details */}
        <div className="space-y-4">
          <div className="flex flex-col">
            <span className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <span className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-2 py-0.5 rounded text-sm font-black">
                {t("b2b_tag", lang)}
              </span>
              {t("brand_title", lang)}
            </span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest mt-1">
              {t("brand_subtitle", lang)}
            </span>
          </div>
          
          <div className="text-sm space-y-3 pt-2 text-slate-300">
            <p className="flex items-start gap-2.5 leading-relaxed">
              <svg className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>{settings.address}</span>
            </p>
            
            <p className="flex items-center gap-2.5">
              <svg className="w-5 h-5 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <a href={`tel:${settings.phone}`} className="hover:text-white transition-colors duration-200">
                {settings.phone}
              </a>
            </p>

            <p className="flex items-center gap-2.5">
              <svg className="w-5 h-5 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <a href={`mailto:${settings.email}`} className="hover:text-white transition-colors duration-200 break-all">
                {settings.email}
              </a>
            </p>
          </div>
        </div>

        {/* Column 2: Hakkımızda (Corporate / Info) */}
        <div>
          <h3 className="text-white font-semibold text-sm tracking-wider uppercase mb-4 border-l-2 border-indigo-500 pl-3">
            {t("about_us", lang)}
          </h3>
          <ul className="space-y-2 text-sm">
            <li>
              <a href="#about" className="hover:text-white transition-colors duration-200">
                {t("about_us", lang)}
              </a>
            </li>
            <li>
              <a href="#b2b" className="hover:text-white transition-colors duration-200">
                {t("wholesale_b2b", lang)}
              </a>
            </li>
            <li>
              <a href="#contact" className="hover:text-white transition-colors duration-200">
                {t("contact_us", lang)}
              </a>
            </li>
          </ul>
        </div>

        {/* Column 3: Müşteri Hizmetleri (Customer Service) */}
        <div>
          <h3 className="text-white font-semibold text-sm tracking-wider uppercase mb-4 border-l-2 border-indigo-500 pl-3">
            {t("customer_service", lang)}
          </h3>
          <ul className="space-y-2 text-sm">
            <li>
              <a 
                href="#shipping" 
                onClick={(e) => {
                  if (onOpenPolicy) {
                    e.preventDefault();
                    onOpenPolicy("cancellation_and_return");
                  }
                }}
                className="hover:text-white transition-colors duration-200"
              >
                {t("delivery_returns", lang)}
              </a>
            </li>
            <li>
              <a href="#faq" className="hover:text-white transition-colors duration-200">
                {t("faq", lang)}
              </a>
            </li>
            <li>
              <a 
                href="#privacy" 
                onClick={(e) => {
                  if (onOpenPolicy) {
                    e.preventDefault();
                    onOpenPolicy("privacy_policy");
                  }
                }}
                className="hover:text-white transition-colors duration-200"
              >
                {t("privacy", lang)}
              </a>
            </li>
            <li>
              <a 
                href="#terms" 
                onClick={(e) => {
                  if (onOpenPolicy) {
                    e.preventDefault();
                    onOpenPolicy("terms_of_service");
                  }
                }}
                className="hover:text-white transition-colors duration-200"
              >
                {t("terms", lang)}
              </a>
            </li>
          </ul>
        </div>

        {/* Column 4: Hesabım (My Account) & WhatsApp support */}
        <div className="space-y-6">
          <div>
            <h3 className="text-white font-semibold text-sm tracking-wider uppercase mb-4 border-l-2 border-indigo-500 pl-3">
              {t("my_account", lang)}
            </h3>
            <ul className="space-y-2 text-sm mb-4">
              <li>
                <a 
                  href="#login" 
                  onClick={(e) => {
                    e.preventDefault();
                    if (typeof window !== "undefined") {
                      window.dispatchEvent(new CustomEvent("merter-open-auth", { detail: { mode: "login" } }));
                    }
                  }}
                  className="hover:text-white transition-colors duration-200"
                >
                  {t("login", lang)}
                </a>
              </li>
              <li>
                <a 
                  href="#register" 
                  onClick={(e) => {
                    e.preventDefault();
                    if (typeof window !== "undefined") {
                      window.dispatchEvent(new CustomEvent("merter-open-auth", { detail: { mode: "register" } }));
                    }
                  }}
                  className="hover:text-white transition-colors duration-200"
                >
                  {t("register", lang)}
                </a>
              </li>
              <li>
                <a href="#tracking" className="hover:text-white transition-colors duration-200">
                  {t("order_tracking", lang)}
                </a>
              </li>
            </ul>
          </div>

          {/* Premium Interactive WhatsApp support banner with pulsing micro-animation */}
          <div className="pt-2">
            <a 
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg hover:shadow-emerald-900/30 transition-all duration-300 transform hover:-translate-y-0.5 group font-semibold text-sm border border-emerald-500/30 relative overflow-hidden"
            >
              {/* WhatsApp Pulsing background radial animation */}
              <span className="absolute inset-0 bg-emerald-400/20 rounded-xl animate-ping scale-75 opacity-0 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700 pointer-events-none"></span>
              
              <svg className="w-5 h-5 shrink-0 animate-bounce group-hover:animate-none" fill="currentColor" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.73-1.458L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.863-9.73.001-2.595-1.006-5.035-2.836-6.87C16.671 2.16 14.237.986 11.64.985c-5.441 0-9.87 4.372-9.873 9.734-.001 1.709.467 3.376 1.354 4.887l-.982 3.582 3.71-.974zm13.14-5.932c-.3-.15-1.776-.875-2.05-.975-.275-.1-.475-.15-.675.15-.2.3-.775.975-.95 1.175-.175.2-.35.225-.65.075-1.127-.566-1.929-1.009-2.694-2.321-.202-.347-.202-.656-.051-.951.136-.264.3-.35.45-.5.15-.15.2-.25.3-.45.1-.2.05-.375-.025-.525-.075-.15-.675-1.625-.925-2.225-.244-.588-.491-.508-.675-.518-.175-.009-.375-.01-.575-.01-.2 0-.525.075-.8 1.025-.275.95-1.05 3.3-1.05 3.4 0 .1.075.2.225.35.15.15 1.75 2.673 4.237 3.743.592.255 1.054.408 1.413.523.595.19 1.137.163 1.564.1.477-.07 1.475-.603 1.675-1.18.2-.578.2-1.075.14-1.18-.06-.1-.225-.15-.525-.3z" />
              </svg>
              <span>
                {t("whatsapp_line", lang)}
              </span>
            </a>
          </div>
        </div>

      </div>

      <div className="max-w-[1720px] mx-auto border-t border-slate-800/80 mt-12 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
        <div>
          © {new Date().getFullYear()} {t("brand_title", lang)}. {t("all_rights_reserved", lang)}
        </div>
        <div className="flex gap-4">
          <a 
            href="#privacy" 
            onClick={(e) => {
              if (onOpenPolicy) {
                e.preventDefault();
                onOpenPolicy("privacy_policy");
              }
            }}
            className="hover:text-slate-300 transition-colors"
          >
            {t("privacy", lang)}
          </a>
          <a 
            href="#terms" 
            onClick={(e) => {
              if (onOpenPolicy) {
                e.preventDefault();
                onOpenPolicy("terms_of_service");
              }
            }}
            className="hover:text-slate-300 transition-colors"
          >
            {t("terms", lang)}
          </a>
        </div>
      </div>
    </footer>
  );
}
