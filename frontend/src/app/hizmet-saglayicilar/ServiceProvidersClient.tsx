"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Truck,
  Camera,
  Tag,
  Scissors,
  Globe,
  ShieldCheck,
  Sparkles,
  MapPin,
  Phone,
  MessageCircle,
  Search,
  Plus,
  CheckCircle2,
  Mail,
  AlertCircle,
} from "lucide-react";
import { Category } from "@/types/store";
import { apiFetch } from "@/app/utils";
import Header from "@/components/store/Header";
import Footer from "@/components/store/Footer";

interface GrecaptchaInstance {
  ready: (callback: () => void) => void;
  execute: (siteKey: string, options: { action: string }) => Promise<string>;
}

const DEFAULT_RECAPTCHA_SITE_KEY =
  process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ||
  "6LfwagMtAAAAAHpF7ID6J-bQmcn92YhFaSH9CX94";

async function executeServiceProviderCaptcha(actionName: string): Promise<string> {
  const grecaptcha = (
    window as unknown as { grecaptcha?: GrecaptchaInstance }
  ).grecaptcha;
  if (!grecaptcha) {
    return "";
  }
  await new Promise<void>((resolve) => {
    grecaptcha.ready(resolve);
  });
  try {
    return await grecaptcha.execute(DEFAULT_RECAPTCHA_SITE_KEY, {
      action: actionName,
    });
  } catch {
    return "";
  }
}

export interface ServiceProviderItem {
  id: string;
  slug: string;
  company_name: string;
  service_category: string;
  short_description: string;
  description: string;
  services_offered: string;
  target_countries: string;
  city: string;
  district: string;
  address: string;
  phone: string;
  whatsapp_phone: string;
  email: string;
  website: string;
  is_verified: boolean;
  is_sponsored: boolean;
  whatsapp_click_count: number;
  translations?: Record<
    string,
    {
      short_description?: string;
      services_offered?: string;
    }
  >;
}

const SERVICE_CATEGORIES = [
  { id: "all", label: "Tüm Hizmetler", icon: Sparkles },
  { id: "kargo_lojistik", label: "Kargo & Lojistik", icon: Truck },
  { id: "fotograf_studyo", label: "Fotoğraf & Prodüksiyon Stüdyosu", icon: Camera },
  { id: "ambalaj_etiket", label: "Ambalaj & Dokuma Etiket", icon: Tag },
  { id: "modelist_kalip", label: "Modelhane, Kalıp & Numune", icon: Scissors },
  { id: "ihracat_danismanlik", label: "Gümrük & İhracat Danışmanlığı", icon: Globe },
] as const;

const CATEGORY_TITLES: Record<string, string> = {
  kargo_lojistik: "Uluslararası Kargo, Lojistik & Konsolidasyon",
  fotograf_studyo: "Mankenli Katalog, Lookbook & Video Stüdyosu",
  ambalaj_etiket: "Dokuma Etiket, Karton Etiket & Lüks Ambalaj",
  modelist_kalip: "Dijital Modelhane, Gerber/Lectra Kalıp & Numune",
  ihracat_danismanlik: "Gümrük, EUR.1/ATR & Dış Ticaret Danışmanlığı",
};

function normalizeWaPhone(raw?: string): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("0") && digits.length === 11) {
    return "90" + digits.slice(1);
  }
  if (digits.length === 10 && digits.startsWith("5")) {
    return "90" + digits;
  }
  return digits;
}

function recordProviderClick(id: string) {
  void fetch(`/api/v1/store/service-providers/${encodeURIComponent(id)}/click`, {
    method: "POST",
    keepalive: true,
  }).catch(() => undefined);
}

function parseServiceTags(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function ServiceProviderBadges({
  isSponsored,
  isVerified,
}: Readonly<{ isSponsored: boolean; isVerified: boolean }>) {
  return (
    <div className="flex items-center gap-2 flex-wrap mb-1">
      {isSponsored && (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-amber-500 text-white text-[10px] font-extrabold uppercase tracking-wider">
          <Sparkles size={11} />
          <span>ÖNE ÇIKAN HİZMET ORTAĞI</span>
        </span>
      )}
      {isVerified && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
          <ShieldCheck size={11} />
          <span>Doğrulanmış Hizmet Sağlayıcı</span>
        </span>
      )}
    </div>
  );
}

function ServiceProviderContactMeta({
  targetCountries,
  address,
  phone,
}: Readonly<{ targetCountries: string; address: string; phone: string }>) {
  return (
    <div className="pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
      {targetCountries && (
        <div className="flex items-center gap-1.5">
          <Globe size={13} className="text-sky-600 shrink-0" />
          <span>
            <strong>Hizmet Bölgeleri / Ülkeler:</strong> {targetCountries}
          </span>
        </div>
      )}
      {address && (
        <div className="flex items-start gap-1.5">
          <MapPin size={13} className="text-slate-400 shrink-0 mt-0.5" />
          <span>{address}</span>
        </div>
      )}
      {phone && (
        <div className="flex items-center gap-1.5">
          <Phone size={13} className="text-slate-400 shrink-0" />
          <a
            href={`tel:${phone}`}
            className="font-bold text-slate-800 hover:text-amber-600 no-underline"
          >
            {phone}
          </a>
        </div>
      )}
    </div>
  );
}

function ServiceProviderCard({
  item,
  lang,
}: Readonly<{ item: ServiceProviderItem; lang: string }>) {
  const catLabel =
    CATEGORY_TITLES[item.service_category] || "B2B Sektörel Hizmet Ortağı";
  const trMap = item.translations?.[lang];
  const shortDesc = trMap?.short_description || item.short_description;
  const serviceTags = parseServiceTags(
    trMap?.services_offered || item.services_offered
  );

  const waDigits = normalizeWaPhone(item.whatsapp_phone || item.phone);
  const waMsg = `Merhaba *${item.company_name}*,\nMerter Vitrini Sektörel Hizmet Sağlayıcılar Rehberi üzerinden firmanızdan B2B hizmet teklifi almak istiyorum.`;
  const waHref = waDigits
    ? `https://wa.me/${waDigits}?text=${encodeURIComponent(waMsg)}`
    : "";

  const borderCls = item.is_sponsored
    ? "border-amber-400/90 ring-1 ring-amber-400/30"
    : "border-slate-200/90";

  return (
    <div
      className={`bg-white rounded-2xl border ${borderCls} shadow-xs hover:shadow-md transition-all p-6 flex flex-col justify-between gap-4`}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <ServiceProviderBadges
              isSponsored={item.is_sponsored}
              isVerified={item.is_verified}
            />
            <h2 className="text-base font-extrabold text-slate-900">
              {item.company_name}
            </h2>
            <p className="text-xs font-bold text-amber-700 mt-0.5">{catLabel}</p>
          </div>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">{shortDesc}</p>

        {serviceTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {serviceTags.map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-800 text-[11px] font-semibold"
              >
                ✓ {tag}
              </span>
            ))}
          </div>
        )}

        <ServiceProviderContactMeta
          targetCountries={item.target_countries}
          address={item.address}
          phone={item.phone}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-3 border-t border-slate-100">
        {waHref && (
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => recordProviderClick(item.id)}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold no-underline transition-colors"
          >
            <MessageCircle size={14} />
            <span>WhatsApp&apos;tan Teklif Al</span>
          </a>
        )}
        {item.phone && (
          <a
            href={`tel:${item.phone}`}
            onClick={() => recordProviderClick(item.id)}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-extrabold no-underline transition-colors shadow-xs"
          >
            <Phone size={14} />
            <span>Doğrudan Ara</span>
          </a>
        )}
      </div>
    </div>
  );
}

function ServiceProvidersDirectoryContent({
  loading,
  items,
  lang,
  onOpenApply,
}: Readonly<{
  loading: boolean;
  items: readonly ServiceProviderItem[];
  lang: string;
  onOpenApply: () => void;
}>) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map((n) => (
          <div
            key={n}
            className="h-56 rounded-2xl bg-white border border-slate-200 animate-pulse p-6"
          />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-10 sm:p-14 text-center space-y-4 shadow-xs">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
          <Sparkles size={26} />
        </div>
        <div className="space-y-1.5 max-w-lg mx-auto">
          <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
            Henüz Kayıtlı Hizmet Sağlayıcı Bulunmuyor
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Bu kategoride şu an listelenen bir hizmet sağlayıcı firma bulunmamaktadır. Kargo/lojistik, fotoğraf stüdyosu, dokuma etiket/ambalaj, modelhane veya ihracat danışmanlığı hizmeti veriyorsanız rehbere başvuru yapabilirsiniz.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenApply}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-extrabold uppercase tracking-wider cursor-pointer border-none shadow-xs"
        >
          <Plus size={15} />
          <span>Hizmet Sağlayıcı Olarak Başvur</span>
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {items.map((item) => (
        <ServiceProviderCard key={item.id} item={item} lang={lang} />
      ))}
    </div>
  );
}

interface VerifyBannerState {
  type: "success" | "error";
  message: string;
}

async function safeParseJson<T>(res: Response): Promise<T> {
  try {
    return (await res.json()) as T;
  } catch {
    return {} as T;
  }
}

async function verifyServiceProviderToken(
  verifyToken: string
): Promise<VerifyBannerState> {
  try {
    const res = await fetch(
      `/api/v1/store/service-providers/verify?token=${encodeURIComponent(verifyToken)}`
    );
    const data = await safeParseJson<{ message?: string; error?: string }>(res);
    return {
      type: res.ok ? "success" : "error",
      message:
        data.message ||
        data.error ||
        "E-posta doğrulama işlemi tamamlandı.",
    };
  } catch {
    return {
      type: "error",
      message: "Doğrulama sırasında bir bağlantı hatası oluştu.",
    };
  }
}

function ServiceProviderVerifyAlert({
  banner,
  onDismiss,
}: Readonly<{ banner: VerifyBannerState | null; onDismiss: () => void }>) {
  if (!banner) return null;
  const isSuccess = banner.type === "success";
  const boxCls = isSuccess
    ? "bg-emerald-50 border-emerald-200 text-emerald-900"
    : "bg-rose-50 border-rose-200 text-rose-900";

  return (
    <div
      className={`rounded-2xl p-4 border flex items-center justify-between gap-3 text-xs sm:text-sm font-bold ${boxCls}`}
    >
      <div className="flex items-center gap-2.5">
        {isSuccess ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
        ) : (
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
        )}
        <span>{banner.message}</span>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="text-slate-500 hover:text-slate-800 font-extrabold cursor-pointer bg-transparent border-none"
      >
        ✕
      </button>
    </div>
  );
}

function ServiceProviderSubmittedNotice({
  submittedEmail,
  onClose,
}: Readonly<{ submittedEmail: string; onClose: () => void }>) {
  return (
    <div className="py-4 text-center space-y-3">
      <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mx-auto">
        <Mail size={30} />
      </div>
      <h4 className="text-base font-black text-slate-900">
        Doğrulama E-Postası Gönderildi!
      </h4>
      <p className="text-xs text-slate-600 leading-relaxed">
        <strong>{submittedEmail}</strong> adresinize <strong>30 dakika</strong>{" "}
        geçerli bir başvuru doğrulama bağlantısı gönderdik. E-postanızı
        doğruladığınızda başvurunuz yönetici onayına iletilecektir.
      </p>
      <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-left text-[11px] text-amber-900 leading-relaxed font-medium">
        ⚠️ <strong>Güvenlik Politikası:</strong> Tıpkı tedarikçi başvurularında
        olduğu gibi, 30 dakika içinde e-posta doğrulaması yapılmayan başvurular
        otomatik olarak silinir ve yönetici onayı olmadan rehberde yayınlanmaz.
      </div>
      <button
        type="button"
        onClick={onClose}
        className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-extrabold cursor-pointer border-none shadow-xs"
      >
        Tamam, Anladım
      </button>
    </div>
  );
}

interface ServiceProviderApplyModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSuccess: () => void;
}

function ServiceProviderApplyModal({
  isOpen,
  onClose,
  onSuccess,
}: ServiceProviderApplyModalProps) {
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [serviceCat, setServiceCat] = useState("kargo_lojistik");
  const [shortDesc, setShortDesc] = useState("");
  const [servicesOffered, setServicesOffered] = useState("");
  const [targetCountries, setTargetCountries] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittedOk, setSubmittedOk] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleClose = () => {
    setSubmittedOk(false);
    setSubmitError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      const recaptchaToken = await executeServiceProviderCaptcha(
        "service_provider_apply"
      );
      const targetEmail = email.trim();
      const res = await fetch("/api/v1/store/service-providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: companyName.trim(),
          contact_name: contactName.trim(),
          email: targetEmail,
          service_category: serviceCat,
          short_description: shortDesc.trim(),
          services_offered: servicesOffered.trim(),
          target_countries: targetCountries.trim(),
          address: address.trim(),
          phone: phone.trim(),
          whatsapp_phone: phone.trim(),
          recaptcha_token: recaptchaToken,
        }),
      });
      const data = await safeParseJson<{ error?: string }>(res);
      if (!res.ok) {
        setSubmitError(
          data.error || "Başvurunuz gönderilirken bir hata oluştu."
        );
        return;
      }
      setSubmittedEmail(targetEmail);
      setSubmittedOk(true);
      setCompanyName("");
      setContactName("");
      setEmail("");
      setShortDesc("");
      setServicesOffered("");
      setTargetCountries("");
      setAddress("");
      setPhone("");
      onSuccess();
    } finally {
      setSubmitting(false);
    }
  };

  const submitLabel = submitting
    ? "DOĞRULAMA GÖNDERİLİYOR..."
    : "BAŞVURU YAP & DOĞRULAMA KODU GÖNDER";

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-extrabold text-slate-900">
            Sektörel Hizmet Sağlayıcı Rehber Başvurusu
          </h3>
          <button
            type="button"
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-700 font-bold cursor-pointer border-none bg-transparent"
          >
            ✕
          </button>
        </div>

        {submittedOk ? (
          <ServiceProviderSubmittedNotice
            submittedEmail={submittedEmail}
            onClose={handleClose}
          />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {submitError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            <div>
              <label htmlFor="sp-company-name" className="sr-only">
                Firma Unvanı
              </label>
              <input
                id="sp-company-name"
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Firma Unvanı (Örn: Merter Ekspres Kargo) *"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="sp-contact-name" className="sr-only">
                  Yetkili Adı Soyadı
                </label>
                <input
                  id="sp-contact-name"
                  type="text"
                  required
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Yetkili Adı Soyadı *"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold"
                />
              </div>
              <div>
                <label htmlFor="sp-email" className="sr-only">
                  Kurumsal E-Posta Adresi
                </label>
                <input
                  id="sp-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Kurumsal E-Posta (Doğrulama İçin) *"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold"
                />
              </div>
            </div>

            <div>
              <label htmlFor="sp-category" className="sr-only">
                Hizmet Kategorisi
              </label>
              <select
                id="sp-category"
                value={serviceCat}
                onChange={(e) => setServiceCat(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold bg-white"
              >
                <option value="kargo_lojistik">Kargo &amp; Lojistik</option>
                <option value="fotograf_studyo">
                  Fotoğraf &amp; Prodüksiyon Stüdyosu
                </option>
                <option value="ambalaj_etiket">
                  Ambalaj &amp; Dokuma Etiket
                </option>
                <option value="modelist_kalip">
                  Modelhane, Kalıp &amp; Numune
                </option>
                <option value="ihracat_danismanlik">
                  Gümrük &amp; İhracat Danışmanlığı
                </option>
              </select>
            </div>

            <div>
              <label htmlFor="sp-short-desc" className="sr-only">
                Kısa Tanıtım Yazısı
              </label>
              <input
                id="sp-short-desc"
                type="text"
                required
                value={shortDesc}
                onChange={(e) => setShortDesc(e.target.value)}
                placeholder="Kısa Tanıtım Yazısı *"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold"
              />
            </div>

            <div>
              <label htmlFor="sp-services-offered" className="sr-only">
                Sunulan Hizmetler
              </label>
              <input
                id="sp-services-offered"
                type="text"
                value={servicesOffered}
                onChange={(e) => setServicesOffered(e.target.value)}
                placeholder="Sunulan Hizmetler (Virgülle ayırın: ETGB, Konsolidasyon vb.)"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold"
              />
            </div>

            <div>
              <label htmlFor="sp-target-countries" className="sr-only">
                Hizmet Verilen Ülkeler
              </label>
              <input
                id="sp-target-countries"
                type="text"
                value={targetCountries}
                onChange={(e) => setTargetCountries(e.target.value)}
                placeholder="Hizmet Verilen Ülkeler (Örn: Almanya, Rusya, BAE)"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="sp-phone" className="sr-only">
                  Telefon / WhatsApp Numarası
                </label>
                <input
                  id="sp-phone"
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Telefon / WhatsApp Numarası *"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold"
                />
              </div>
              <div>
                <label htmlFor="sp-address" className="sr-only">
                  Merter / İstanbul Açık Adres
                </label>
                <input
                  id="sp-address"
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Merter / İstanbul Açık Adres"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 font-medium">
              <ShieldCheck size={15} className="text-emerald-600 shrink-0" />
              <span>
                Google reCAPTCHA v3 koruması, 30 dk e-posta doğrulaması ve
                yönetici onay mekanizmasıyla korunmaktadır.
              </span>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-extrabold uppercase tracking-wider cursor-pointer border-none shadow-xs"
            >
              {submitLabel}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ServiceProvidersClient() {
  const [lang, setLang] = useState<string>("tr");
  const [isLangOpen, setIsLangOpen] = useState<boolean>(false);
  const [displayCurrency, setDisplayCurrency] = useState<string>("TRY");
  const [categories, setCategories] = useState<Category[]>([]);

  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [items, setItems] = useState<ServiceProviderItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showApplyModal, setShowApplyModal] = useState<boolean>(false);
  const [verifyBanner, setVerifyBanner] = useState<VerifyBannerState | null>(
    null
  );

  useEffect(() => {
    const scriptId = "recaptcha-v3-script";
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = `https://www.google.com/recaptcha/api.js?render=${DEFAULT_RECAPTCHA_SITE_KEY}&hl=${lang}`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  }, [lang]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const verifyToken = params.get("verify_token");
    if (!verifyToken) return;

    void verifyServiceProviderToken(verifyToken).then((bannerState) => {
      setVerifyBanner(bannerState);
      window.history.replaceState({}, "", "/hizmet-saglayicilar");
    });
  }, []);

  const loadProviders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/store/service-providers?category=${encodeURIComponent(selectedCategory)}&q=${encodeURIComponent(searchQuery)}`
      );
      if (res.ok) {
        const data = (await res.json()) as ServiceProviderItem[];
        setItems(data || []);
      }
    } catch {
      // Ignore transient network errors
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    void apiFetch<Category[]>("/categories").then((c) => {
      if (c) setCategories(c);
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadProviders();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadProviders]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header
        lang={lang}
        setLang={setLang}
        isLangOpen={isLangOpen}
        setIsLangOpen={setIsLangOpen}
        totalPkgs={0}
        setIsCartOpen={() => undefined}
        setCurrentPage={() => undefined}
        categories={categories}
        activeCategoryId=""
        displayCurrency={displayCurrency}
        onCurrencyChange={setDisplayCurrency}
      />

      <main className="flex-grow max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <ServiceProviderVerifyAlert
          banner={verifyBanner}
          onDismiss={() => setVerifyBanner(null)}
        />

        {/* Hero Banner */}
        <div className="bg-gradient-to-br from-sky-50/90 via-white to-amber-50/60 border border-sky-200/80 text-slate-900 rounded-3xl p-6 sm:p-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6 shadow-xs">
          <div className="space-y-2.5 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-100/80 border border-sky-200 text-sky-800 text-xs font-extrabold uppercase tracking-wider">
              <Sparkles size={13} className="text-sky-600" />
              <span>MERTER B2B EKOSİSTEM &amp; ÇÖZÜM ORTAKLARI REHBERİ</span>
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Sektörel Hizmet Sağlayıcılar Rehberi
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Toptan tekstil ticaretinizi hızlandıran doğrulanmış uluslararası kargo ve gümrükleme firmaları, mankenli katalog çekim stüdyoları, Private Label dokuma etiket/ambalaj üreticileri, dijital modelhaneler ve ihracat danışmanlarıyla doğrudan iletişime geçin.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowApplyModal(true)}
            className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-extrabold uppercase tracking-wider shrink-0 cursor-pointer border-none shadow-xs transition-colors"
          >
            <Plus size={16} />
            <span>Hizmet Sağlayıcı Olarak Kaydol</span>
          </button>
        </div>

        {/* Category Filter Tabs & Search */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xs">
          <div className="flex flex-wrap gap-2">
            {SERVICE_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const active = selectedCategory === cat.id;
              const btnCls = active
                ? "bg-sky-600 text-white shadow-xs"
                : "bg-slate-50/80 hover:bg-sky-50/70 text-slate-700 hover:text-sky-800 border border-slate-200";
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors ${btnCls}`}
                >
                  <Icon size={14} />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          <div className="relative min-w-[260px]">
            <label htmlFor="sp-search-input" className="sr-only">
              Hizmet Sağlayıcı Ara
            </label>
            <Search
              size={15}
              className="text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
            />
            <input
              id="sp-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Hizmet, ülke veya firma ara..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-sky-600"
            />
          </div>
        </div>

        {/* Directory Grid */}
        <ServiceProvidersDirectoryContent
          loading={loading}
          items={items}
          lang={lang}
          onOpenApply={() => setShowApplyModal(true)}
        />
      </main>

      <ServiceProviderApplyModal
        isOpen={showApplyModal}
        onClose={() => setShowApplyModal(false)}
        onSuccess={() => void loadProviders()}
      />

      <Footer lang={lang} />
    </div>
  );
}
