"use client";

import React, { useState, useEffect } from "react";
import { 
  Building2, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Globe, 
  Phone, 
  Mail, 
  User, 
  MapPin, 
  Tag, 
  FileText,
  ShieldCheck
} from "lucide-react";
import { SUPPLIER_TRANSLATIONS, SupplierPageTranslations } from "@/app/[categoryPrefix]/tedarikci-basvuru/translations";

const Instagram = ({ size = 16, ...props }: Readonly<React.SVGProps<SVGSVGElement> & { size?: number }>) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
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

interface GrecaptchaInstance {
  ready: (callback: () => void) => void;
  execute: (siteKey: string, options: { action: string }) => Promise<string>;
}

interface SupplierApplicationSectionProps {
  readonly lang?: string;
  readonly className?: string;
}

interface SuccessViewProps {
  readonly t: SupplierPageTranslations;
  readonly onReset: () => void;
}

function SupplierSuccessView({ t, onReset }: Readonly<SuccessViewProps>) {
  return (
    <div className="py-12 px-4 text-center max-w-md mx-auto">
      <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mx-auto mb-5">
        <CheckCircle2 size={36} />
      </div>
      <h3 className="text-xl font-black text-zinc-950">{t.success_title}</h3>
      <p className="text-xs sm:text-sm text-zinc-600 mt-2.5 leading-relaxed">
        {t.success_desc}
      </p>
      <button
        type="button"
        onClick={onReset}
        className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
      >
        {t.submit_another}
      </button>
    </div>
  );
}

export default function SupplierApplicationSection({
  lang = "tr",
  className = ""
}: Readonly<SupplierApplicationSectionProps>) {
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [instagram, setInstagram] = useState("");
  const [website, setWebsite] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const t: SupplierPageTranslations = SUPPLIER_TRANSLATIONS[lang] || SUPPLIER_TRANSLATIONS.en;
  const isRtl = lang === "ar";

  useEffect(() => {
    const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "6LfwagMtAAAAAHpF7ID6J-bQmcn92YhFaSH9CX94";
    const scriptId = "recaptcha-v3-script";
    let script = document.getElementById(scriptId) as HTMLScriptElement;
    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}&hl=${lang}`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  }, [lang]);

  const executeCaptcha = async (actionName: string): Promise<string> => {
    return new Promise((resolve) => {
      const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "6LfwagMtAAAAAHpF7ID6J-bQmcn92YhFaSH9CX94";
      const grecaptcha = (window as unknown as { grecaptcha?: GrecaptchaInstance }).grecaptcha;
      if (!grecaptcha) {
        resolve("");
        return;
      }
      grecaptcha.ready(() => {
        grecaptcha.execute(siteKey, { action: actionName })
          .then((token: string) => resolve(token))
          .catch(() => resolve(""));
      });
    });
  };

  const handleReset = () => {
    setSubmitted(false);
    setCompanyName("");
    setContactName("");
    setEmail("");
    setPhone("");
    setCity("");
    setCategory("");
    setInstagram("");
    setWebsite("");
    setNotes("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!companyName.trim() || !contactName.trim() || !email.trim() || !phone.trim()) {
      setError(t.error_required);
      return;
    }

    setLoading(true);

    try {
      const recaptchaToken = await executeCaptcha("supplier_apply");

      const res = await fetch("/api/v1/store/supplier-applications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          company_name: companyName.trim(),
          contact_name: contactName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          city: city.trim(),
          category: category.trim(),
          instagram: instagram.trim(),
          website: website.trim(),
          notes: notes.trim(),
          recaptcha_token: recaptchaToken,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || t.error_generic);
      }

      setSubmitted(true);
    } catch (err: unknown) {
      setError((err as Error).message || t.error_generic);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="tedarikci-basvuru" className={`relative bg-zinc-50 border-t border-zinc-200/80 text-zinc-900 py-16 sm:py-20 px-4 sm:px-6 lg:px-8 overflow-hidden ${className}`} dir={isRtl ? "rtl" : "ltr"}>
      <div className="max-w-5xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-zinc-200 shadow-xs text-zinc-800 text-xs font-bold tracking-widest uppercase mb-4">
            <Building2 size={14} className="text-zinc-950" />
            {t.form_badge}
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-zinc-950">
            {t.form_title}
          </h2>
          <p className="mt-3 text-sm sm:text-base text-zinc-600 leading-relaxed">
            {t.form_desc}
          </p>
        </div>

        {/* Content Box */}
        <div className="bg-white border border-zinc-200/90 rounded-3xl p-6 sm:p-10 shadow-sm">
          {submitted ? (
            <SupplierSuccessView t={t} onReset={handleReset} />
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2.5">
                  <AlertCircle size={16} className="shrink-0 text-red-600" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Company Name */}
                <div>
                  <label htmlFor="supp_company_name" className="block text-xs font-bold text-zinc-700 mb-1.5 flex items-center gap-1.5">
                    <Building2 size={13} className="text-zinc-600" />
                    <span>{t.company_name_label}</span>
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="supp_company_name"
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder={t.company_name_placeholder}
                    className="w-full bg-zinc-50/60 hover:bg-white focus:bg-white border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 transition-all"
                  />
                </div>

                {/* Contact Name */}
                <div>
                  <label htmlFor="supp_contact_name" className="block text-xs font-bold text-zinc-700 mb-1.5 flex items-center gap-1.5">
                    <User size={13} className="text-zinc-600" />
                    <span>{t.contact_name_label}</span>
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="supp_contact_name"
                    type="text"
                    required
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder={t.contact_name_placeholder}
                    className="w-full bg-zinc-50/60 hover:bg-white focus:bg-white border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 transition-all"
                  />
                </div>

                {/* Email */}
                <div>
                  <label htmlFor="supp_email" className="block text-xs font-bold text-zinc-700 mb-1.5 flex items-center gap-1.5">
                    <Mail size={13} className="text-zinc-600" />
                    <span>{t.email_label}</span>
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="supp_email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t.email_placeholder}
                    className="w-full bg-zinc-50/60 hover:bg-white focus:bg-white border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 transition-all"
                  />
                </div>

                {/* Phone / WhatsApp */}
                <div>
                  <label htmlFor="supp_phone" className="block text-xs font-bold text-zinc-700 mb-1.5 flex items-center gap-1.5">
                    <Phone size={13} className="text-zinc-600" />
                    <span>{t.phone_label}</span>
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="supp_phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={t.phone_placeholder}
                    className="w-full bg-zinc-50/60 hover:bg-white focus:bg-white border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 transition-all"
                  />
                </div>

                {/* City */}
                <div>
                  <label htmlFor="supp_city" className="block text-xs font-bold text-zinc-700 mb-1.5 flex items-center gap-1.5">
                    <MapPin size={13} className="text-zinc-600" />
                    <span>{t.city_label}</span>
                  </label>
                  <input
                    id="supp_city"
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder={t.city_placeholder}
                    className="w-full bg-zinc-50/60 hover:bg-white focus:bg-white border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 transition-all"
                  />
                </div>

                {/* Category Selection */}
                <div>
                  <label htmlFor="supp_category" className="block text-xs font-bold text-zinc-700 mb-1.5 flex items-center gap-1.5">
                    <Tag size={13} className="text-zinc-600" />
                    <span>{t.category_label}</span>
                  </label>
                  <select
                    id="supp_category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-zinc-50/60 hover:bg-white focus:bg-white border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 transition-all cursor-pointer"
                  >
                    <option value="">{t.category_select}</option>
                    <option value={t.categories.womens_wear}>{t.categories.womens_wear}</option>
                    <option value={t.categories.knitwear}>{t.categories.knitwear}</option>
                    <option value={t.categories.denim}>{t.categories.denim}</option>
                    <option value={t.categories.dresses}>{t.categories.dresses}</option>
                    <option value={t.categories.outerwear}>{t.categories.outerwear}</option>
                    <option value={t.categories.mens_wear}>{t.categories.mens_wear}</option>
                    <option value={t.categories.suits}>{t.categories.suits}</option>
                    <option value={t.categories.plus_size}>{t.categories.plus_size}</option>
                    <option value={t.categories.other}>{t.categories.other}</option>
                  </select>
                </div>

                {/* Instagram / Social Media */}
                <div>
                  <label htmlFor="supp_instagram" className="block text-xs font-bold text-zinc-700 mb-1.5 flex items-center gap-1.5">
                    <Instagram size={13} className="text-zinc-600" />
                    <span>{t.social_label}</span>
                  </label>
                  <input
                    id="supp_instagram"
                    type="text"
                    value={instagram}
                    onChange={(e) => setInstagram(e.target.value)}
                    placeholder={t.social_placeholder}
                    className="w-full bg-zinc-50/60 hover:bg-white focus:bg-white border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 transition-all"
                  />
                </div>

                {/* Website */}
                <div>
                  <label htmlFor="supp_website" className="block text-xs font-bold text-zinc-700 mb-1.5 flex items-center gap-1.5">
                    <Globe size={13} className="text-zinc-600" />
                    <span>{t.website_label}</span>
                  </label>
                  <input
                    id="supp_website"
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder={t.website_placeholder}
                    className="w-full bg-zinc-50/60 hover:bg-white focus:bg-white border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 transition-all"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label htmlFor="supp_notes" className="block text-xs font-bold text-zinc-700 mb-1.5 flex items-center gap-1.5">
                  <FileText size={13} className="text-zinc-600" />
                  <span>{t.notes_label}</span>
                </label>
                <textarea
                  id="supp_notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t.notes_placeholder}
                  className="w-full bg-zinc-50/60 hover:bg-white focus:bg-white border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 transition-all resize-none"
                />
              </div>

              {/* Security and Submit Footer */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-5 border-t border-zinc-100">
                <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                  <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
                  <span>{t.security_note}</span>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white font-bold text-sm tracking-wide shadow-sm hover:shadow transition-all cursor-pointer active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>{t.submitting_btn}</span>
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      <span>{t.submit_btn}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
