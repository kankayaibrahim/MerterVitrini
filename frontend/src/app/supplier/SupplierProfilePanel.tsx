"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import {
  Building2,
  Phone,
  Mail,
  Globe,
  MapPin,
  CreditCard,
  CheckCircle2,
  Save,
  ShieldCheck,
  Factory,
  Sparkles,
  Plus,
  Trash2,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import type { SupplierAddress } from "@/types/integration";
import TurkeyLocationSelects from "@/components/shared/TurkeyLocationSelects";
import InstagramIcon from "@/components/shared/InstagramIcon";
import {
  formatBrandInstagramLabel,
  formatBrandInstagramUrl,
  formatBrandWebsiteLabel,
  formatBrandWebsiteUrl,
} from "@/utils/brandContactHelpers";
import {
  ROOT_DOMAIN,
  normalizeSubdomainDraft,
  validateSupplierSubdomainInput,
} from "@/utils/subdomain";

export interface SupplierBrandProfile {
  id: string;
  name: string;
  slug: string;
  alias_code?: string;
  subdomain?: string;
  subdomain_enabled?: boolean;
  company_type: string;
  description: string;
  description_translations?: Record<string, string>;
  website?: string;
  phone?: string;
  landline_phone?: string;
  whatsapp_phone: string;
  public_email: string;
  instagram_handle: string;
  city?: string;
  district?: string;
  location_address: string;
  addresses?: SupplierAddress[];
  export_countries: string;
  min_order_quantity: number;
  supports_private_label: boolean;
  supports_fason: boolean;
  is_verified: boolean;
  whatsapp_only_ordering?: boolean;
  bank_name: string;
  bank_account_holder: string;
  iban: string;
}

type DescLangCode = "tr" | "en" | "ru" | "ar";

const DESCRIPTION_LANG_OPTIONS: ReadonlyArray<{
  code: DescLangCode;
  flagCode: string;
  label: string;
}> = [
  { code: "tr", flagCode: "tr", label: "TR" },
  { code: "en", flagCode: "gb", label: "EN" },
  { code: "ru", flagCode: "ru", label: "RU" },
  { code: "ar", flagCode: "sa", label: "AR" },
];

interface NormalizedBrandProfileForm {
  brandName: string;
  subdomain: string;
  subdomainEnabled: boolean;
  companyType: string;
  description: string;
  descTranslations: Record<string, string>;
  whatsappPhone: string;
  phone: string;
  landlinePhone: string;
  publicEmail: string;
  website: string;
  instagramHandle: string;
  city: string;
  district: string;
  locationAddress: string;
  addresses: SupplierAddress[];
  exportCountries: string;
  minOrderQty: number;
  supportsPrivateLabel: boolean;
  supportsFason: boolean;
  bankName: string;
  bankAccountHolder: string;
  iban: string;
  isVerified: boolean;
  whatsappOnlyOrdering: boolean;
}

function strOrEmpty(val?: string): string {
  return val || "";
}

function normalizeBrandProfileToForm(bp: SupplierBrandProfile): NormalizedBrandProfileForm {
  const dt = bp.description_translations;
  return {
    brandName: strOrEmpty(bp.name),
    subdomain: strOrEmpty(bp.subdomain),
    subdomainEnabled: bp.subdomain_enabled !== false,
    companyType: bp.company_type || "uretici_toptanci",
    description: strOrEmpty(bp.description),
    descTranslations: {
      en: strOrEmpty(dt?.en),
      ru: strOrEmpty(dt?.ru),
      ar: strOrEmpty(dt?.ar),
    },
    whatsappPhone: bp.whatsapp_phone || strOrEmpty(bp.phone),
    phone: strOrEmpty(bp.phone),
    landlinePhone: strOrEmpty(bp.landline_phone),
    publicEmail: strOrEmpty(bp.public_email),
    website: strOrEmpty(bp.website),
    instagramHandle: strOrEmpty(bp.instagram_handle),
    city: strOrEmpty(bp.city),
    district: strOrEmpty(bp.district),
    locationAddress: strOrEmpty(bp.location_address),
    addresses: Array.isArray(bp.addresses)
      ? bp.addresses.map((addr, idx) => ({
          id: addr.id || `supp-addr-${idx}-${Date.now()}`,
          title: addr.title || "",
          city: addr.city || "",
          district: addr.district || "",
          text: addr.text || "",
          coordinates: addr.coordinates || "",
        }))
      : [],
    exportCountries: strOrEmpty(bp.export_countries),
    minOrderQty: bp.min_order_quantity || 1,
    supportsPrivateLabel: Boolean(bp.supports_private_label),
    supportsFason: Boolean(bp.supports_fason),
    bankName: strOrEmpty(bp.bank_name),
    bankAccountHolder: strOrEmpty(bp.bank_account_holder),
    iban: strOrEmpty(bp.iban),
    isVerified: bp.is_verified !== false,
    whatsappOnlyOrdering: Boolean(bp.whatsapp_only_ordering),
  };
}

export default function SupplierProfilePanel({
  getToken,
  onProfileSaved,
}: Readonly<{
  getToken: () => string | null;
  onProfileSaved?: () => void;
}>) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const [brandName, setBrandName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [subdomainEnabled, setSubdomainEnabled] = useState(true);
  const [copiedSubdomain, setCopiedSubdomain] = useState(false);
  const [companyType, setCompanyType] = useState("uretici_toptanci");
  const [description, setDescription] = useState("");
  const [descTranslations, setDescTranslations] = useState<Record<string, string>>({
    en: "",
    ru: "",
    ar: "",
  });
  const [activeDescLang, setActiveDescLang] = useState<DescLangCode>("tr");
  const [autoTranslatingDesc, setAutoTranslatingDesc] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [phone, setPhone] = useState("");
  const [landlinePhone, setLandlinePhone] = useState("");
  const [publicEmail, setPublicEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [locationAddress, setLocationAddress] = useState("");
  const [addresses, setAddresses] = useState<SupplierAddress[]>([]);
  const [exportCountries, setExportCountries] = useState("");
  const [minOrderQty, setMinOrderQty] = useState<number>(1);
  const [supportsPrivateLabel, setSupportsPrivateLabel] = useState(false);
  const [supportsFason, setSupportsFason] = useState(false);
  const [bankName, setBankName] = useState("");
  const [bankAccountHolder, setBankAccountHolder] = useState("");
  const [iban, setIban] = useState("");
  const [isVerified, setIsVerified] = useState(true);
  const [whatsappOnlyOrdering, setWhatsappOnlyOrdering] = useState(false);

  useEffect(() => {
    let ignore = false;

    const applyNormalized = (norm: NormalizedBrandProfileForm) => {
      setBrandName(norm.brandName);
      setSubdomain(norm.subdomain);
      setSubdomainEnabled(norm.subdomainEnabled);
      setCompanyType(norm.companyType);
      setDescription(norm.description);
      setDescTranslations(norm.descTranslations);
      setWhatsappPhone(norm.whatsappPhone);
      setPhone(norm.phone);
      setLandlinePhone(norm.landlinePhone);
      setPublicEmail(norm.publicEmail);
      setWebsite(norm.website);
      setInstagramHandle(norm.instagramHandle);
      setCity(norm.city);
      setDistrict(norm.district);
      setLocationAddress(norm.locationAddress);
      setAddresses(norm.addresses);
      setExportCountries(norm.exportCountries);
      setMinOrderQty(norm.minOrderQty);
      setSupportsPrivateLabel(norm.supportsPrivateLabel);
      setSupportsFason(norm.supportsFason);
      setBankName(norm.bankName);
      setBankAccountHolder(norm.bankAccountHolder);
      setIban(norm.iban);
      setIsVerified(norm.isVerified);
      setWhatsappOnlyOrdering(norm.whatsappOnlyOrdering);
    };

    async function initBrandProfile() {
      const token = getToken();
      if (!token) {
        if (!ignore) setLoading(false);
        return;
      }
      try {
        const res = await fetch("/api/v1/supplier/profile", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok && !ignore) {
          const data = (await res.json()) as { brand_profile?: SupplierBrandProfile };
          if (data.brand_profile) {
            applyNormalized(normalizeBrandProfileToForm(data.brand_profile));
          }
        }
      } catch (err) {
        console.error("Failed to load supplier brand profile:", err);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    void initBrandProfile();
    return () => {
      ignore = true;
    };
  }, [getToken]);

  const handleAutoTranslateDescription = async () => {
    const token = getToken();
    if (!token || !description.trim()) return;
    setAutoTranslatingDesc(true);
    try {
      const res = await fetch("/api/v1/supplier/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          source_lang: "tr",
          target_langs: ["en", "ru", "ar"],
          fields: { description: description.trim() },
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          translations?: Record<string, { description?: string }>;
        };
        const t = data.translations || {};
        setDescTranslations((prev) => ({
          en: t.en?.description || prev.en || "",
          ru: t.ru?.description || prev.ru || "",
          ar: t.ar?.description || prev.ar || "",
        }));
      }
    } catch (err) {
      console.error("Auto-translate description error:", err);
    } finally {
      setAutoTranslatingDesc(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getToken();
    if (!token) return;

    if (subdomainEnabled) {
      const subErr = validateSupplierSubdomainInput(subdomain);
      if (subErr) {
        setErrorMsg(subErr);
        return;
      }
    }

    setSaving(true);
    setSaveMessage("");
    setErrorMsg("");

    try {
      const res = await fetch("/api/v1/supplier/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          brand_name: brandName,
          subdomain: subdomainEnabled ? subdomain.trim() : undefined,
          company_type: companyType,
          description,
          description_translations: {
            tr: description,
            en: descTranslations.en || "",
            ru: descTranslations.ru || "",
            ar: descTranslations.ar || "",
          },
          whatsapp_phone: whatsappPhone,
          phone,
          landline_phone: landlinePhone.trim(),
          public_email: publicEmail,
          website,
          instagram_handle: instagramHandle,
          city: city.trim(),
          district: district.trim(),
          location_address: locationAddress,
          addresses: addresses
            .filter((addr) => addr.title.trim() && addr.text.trim())
            .map((addr) => ({
              ...addr,
              title: addr.title.trim(),
              city: (addr.city || "").trim(),
              district: (addr.district || "").trim(),
              text: addr.text.trim(),
              coordinates: (addr.coordinates || "").trim(),
            })),
          export_countries: exportCountries,
          min_order_quantity: Number(minOrderQty) || 1,
          supports_private_label: supportsPrivateLabel,
          supports_fason: supportsFason,
          whatsapp_only_ordering: whatsappOnlyOrdering,
          bank_name: bankName,
          bank_account_holder: bankAccountHolder,
          iban,
        }),
      });

      if (res.ok) {
        setSaveMessage(
          "Firma vitrin, doğrudan iletişim ve tahsilat (IBAN) bilgileriniz başarıyla güncellendi."
        );
        onProfileSaved?.();
      } else {
        const errData = (await res.json().catch(() => ({}))) as { error?: string };
        setErrorMsg(errData.error || "Bilgiler kaydedilirken bir hata oluştu.");
      }
    } catch (err) {
      console.error("Save supplier profile error:", err);
      setErrorMsg("Sunucu bağlantısı sırasında hata oluştu.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-xs text-slate-500">
        Firma profil bilgileriniz yükleniyor...
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Top Info Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-bold text-slate-900">
              Açık Firma Vitrini, Doğrudan İletişim &amp; Tahsilat Ayarları
            </h2>
            {isVerified && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                <ShieldCheck size={12} />
                <span>Doğrulanmış Merter İşletmesi</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Burada girdiğiniz telefon, WhatsApp, adres ve IBAN bilgileri ürün sayfalarınızda alıcılara açıkça gösterilir ve siparişler doğrudan size yönlendirilir.
          </p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="h-10 inline-flex items-center justify-center gap-2 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50 shrink-0"
        >
          <Save size={15} />
          <span>{saving ? "Kaydediliyor..." : "Bilgileri Kaydet ve Yayınla"}</span>
        </button>
      </div>

      {saveMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{saveMessage}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-xs font-semibold">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Column 1: Company Identity & Production Capabilities */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-xs space-y-4">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2.5">
            <Factory size={15} className="text-slate-900" />
            <span>1. Firma Kimliği &amp; Üretim Kapasitesi</span>
          </h3>

          <div>
            <label htmlFor="prof-brand-name" className="block text-xs font-bold text-slate-700 mb-1">
              Vitrinde Görünecek Ticari Firma Adı *
            </label>
            <input
              id="prof-brand-name"
              type="text"
              required
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="Örn: Lustrin Toptan Tekstil"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-slate-900"
            />
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="prof-subdomain"
                className="text-xs font-bold text-slate-800 flex items-center gap-1.5"
              >
                <Globe size={13} className="text-emerald-700" />
                <span>Özel Mağaza Adresiniz (Subdomain)</span>
              </label>
              {subdomainEnabled && subdomain.trim() && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard
                        .writeText(`https://${subdomain.trim()}.${ROOT_DOMAIN}`)
                        .then(() => {
                          setCopiedSubdomain(true);
                          setTimeout(() => setCopiedSubdomain(false), 2000);
                        })
                        .catch(() => {});
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-slate-200 hover:border-slate-400 text-[10px] font-bold text-slate-700 cursor-pointer"
                  >
                    {copiedSubdomain ? <Check size={10} className="text-emerald-600" /> : <Copy size={10} />}
                    <span>{copiedSubdomain ? "Kopyalandı" : "Kopyala"}</span>
                  </button>
                  <a
                    href={`https://${subdomain.trim()}.${ROOT_DOMAIN}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-[10px] font-bold text-white no-underline"
                  >
                    <span>Mağazayı Aç</span>
                    <ExternalLink size={10} />
                  </a>
                </div>
              )}
            </div>

            {subdomainEnabled ? (
              <div className="flex items-center rounded-lg border border-slate-300 bg-white overflow-hidden focus-within:border-slate-900">
                <input
                  id="prof-subdomain"
                  type="text"
                  value={subdomain}
                  onChange={(e) => setSubdomain(normalizeSubdomainDraft(e.target.value))}
                  placeholder="orn-magazaniz"
                  className="flex-1 min-w-0 px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-none bg-transparent"
                />
                <span className="px-2.5 py-1.5 bg-slate-100 border-l border-slate-200 text-[11px] font-semibold text-slate-600 shrink-0">
                  .{ROOT_DOMAIN}
                </span>
              </div>
            ) : (
              <p className="text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5">
                Özel mağaza subdomain özelliği şu anda hesabınızda pasif. Açtırmak için platform yöneticisi ile iletişime geçebilirsiniz.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="prof-company-type" className="block text-xs font-bold text-slate-700 mb-1">
              Faaliyet / Üretici Türü
            </label>
            <select
              id="prof-company-type"
              value={companyType}
              onChange={(e) => setCompanyType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 bg-white focus:outline-none focus:border-slate-900"
            >
              <option value="uretici_toptanci">Hazır Giyim Üreticisi &amp; Toptancı</option>
              <option value="private_label">Özel Etiket (Private Label) Üreticisi</option>
              <option value="fason_atolye">Fason Üretim Atölyesi</option>
              <option value="kumas_tedarikcisi">Kumaş Üreticisi &amp; Tedarikçisi</option>
              <option value="aksesuar">Tekstil Aksesuar &amp; Yan Sanayi</option>
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
              <span className="block text-xs font-bold text-slate-700">
                Firma Tanıtım Yazısı (4 Dil • Alıcılara Açık)
              </span>
              <button
                type="button"
                onClick={() => void handleAutoTranslateDescription()}
                disabled={autoTranslatingDesc || !description.trim()}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 hover:border-slate-300 text-[10px] font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                <Sparkles size={11} />
                <span>{autoTranslatingDesc ? "Çevriliyor..." : "EN/RU/AR Otomatik Çevir"}</span>
              </button>
            </div>

            <div className="flex items-center gap-1 mb-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
              {DESCRIPTION_LANG_OPTIONS.map((l) => {
                const isSelected = activeDescLang === l.code;
                return (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => setActiveDescLang(l.code)}
                    className={`flex-1 py-1.5 px-2 rounded-md text-[11px] font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 ${
                      isSelected
                        ? "bg-slate-900 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                    }`}
                  >
                    <Image
                      unoptimized
                      src={`https://flagcdn.com/w20/${l.flagCode}.png`}
                      alt={l.label}
                      width={16}
                      height={12}
                      className="w-4 h-3 object-cover rounded-[2px] border border-slate-200/80 shrink-0"
                    />
                    <span>{l.label}</span>
                  </button>
                );
              })}
            </div>

            {activeDescLang === "tr" ? (
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Firmanızın uzmanlık alanları, üretim kapasitesi ve koleksiyon tarzı hakkında Türkçe bilgi verin..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-slate-900"
              />
            ) : (
              <textarea
                rows={3}
                dir={activeDescLang === "ar" ? "rtl" : "ltr"}
                value={descTranslations[activeDescLang] || ""}
                onChange={(e) =>
                  setDescTranslations((prev) => ({
                    ...prev,
                    [activeDescLang]: e.target.value,
                  }))
                }
                placeholder={`${activeDescLang.toUpperCase()} dilinde firma tanıtım yazısı (elle düzenleyebilir veya üstteki butonla otomatik çevirebilirsiniz)...`}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-slate-50/50 text-xs text-slate-800 focus:outline-none focus:border-slate-900"
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="prof-min-order" className="block text-xs font-bold text-slate-700 mb-1">
                Min. Sipariş (Seri)
              </label>
              <input
                id="prof-min-order"
                type="number"
                min={1}
                value={minOrderQty}
                onChange={(e) => setMinOrderQty(Number(e.target.value) || 1)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label htmlFor="prof-export-countries" className="block text-xs font-bold text-slate-700 mb-1">
                İhracat Ülkeleri
              </label>
              <input
                id="prof-export-countries"
                type="text"
                value={exportCountries}
                onChange={(e) => setExportCountries(e.target.value)}
                placeholder="Almanya, Rusya, BAE..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-slate-900"
              />
            </div>
          </div>

          <div className="pt-2 space-y-2 border-t border-slate-100">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={supportsPrivateLabel}
                onChange={(e) => setSupportsPrivateLabel(e.target.checked)}
                className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
              />
              <span className="text-xs font-semibold text-slate-700">
                Özel Etiket (Private Label) Üretim Yapıyoruz
              </span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={supportsFason}
                onChange={(e) => setSupportsFason(e.target.checked)}
                className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
              />
              <span className="text-xs font-semibold text-slate-700">
                Fason / Sipariş Bazlı Üretim İmkanımız Var
              </span>
            </label>
          </div>
        </div>

        {/* Column 2: Direct Contact Channels */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-xs space-y-4">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2.5">
            <Phone size={15} className="text-emerald-600" />
            <span>2. Doğrudan İletişim &amp; Adres Bilgileri</span>
          </h3>

          <div>
            <label htmlFor="prof-whatsapp" className="block text-xs font-bold text-slate-700 mb-1">
              Doğrudan Sipariş WhatsApp Hattı *
            </label>
            <input
              id="prof-whatsapp"
              type="text"
              value={whatsappPhone}
              onChange={(e) => setWhatsappPhone(e.target.value)}
              placeholder="+90 532 000 00 00"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-slate-900"
            />
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              Ürün sayfasındaki &quot;WhatsApp ile Doğrudan Sipariş Ver&quot; butonu bu numaraya yönlenir.
            </span>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 flex items-start justify-between gap-3">
            <div>
              <span className="block text-xs font-extrabold text-emerald-950">
                Yalnızca WhatsApp ile Sipariş &amp; Fiyat Sorunuz Modu
              </span>
              <span className="block text-[11px] text-emerald-800/90 mt-0.5 leading-relaxed">
                Aktif edildiğinde vitrinde ürünlerinizin fiyatı gizlenir, &quot;Toptan Fiyat İçin WhatsApp&apos;tan Ulaşın&quot; rozeti gösterilir ve müşteriler doğrudan WhatsApp üzerinden sipariş verir. Sepete ekleme kapatılır.
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
              <input
                type="checkbox"
                checked={whatsappOnlyOrdering}
                onChange={(e) => setWhatsappOnlyOrdering(e.target.checked)}
                className="sr-only peer"
              />
              <span className="w-10 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600" />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="prof-phone" className="block text-xs font-bold text-slate-700 mb-1">
                Cep / Yetkili Telefonu
              </label>
              <input
                id="prof-phone"
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+90 532 000 00 00"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label htmlFor="prof-landline" className="block text-xs font-bold text-slate-700 mb-1">
                Sabit Telefon (Santral)
              </label>
              <input
                id="prof-landline"
                type="text"
                value={landlinePhone}
                onChange={(e) => setLandlinePhone(e.target.value)}
                placeholder="+90 212 000 00 00"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-slate-900"
              />
            </div>
          </div>

          <div>
            <label htmlFor="prof-email" className="block text-xs font-bold text-slate-700 mb-1">
              Kurumsal E-Posta Adresi
            </label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="prof-email"
                type="email"
                value={publicEmail}
                onChange={(e) => setPublicEmail(e.target.value)}
                placeholder="satis@firmaniz.com"
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="prof-website" className="block text-xs font-bold text-slate-700 mb-1">
                Web Sitesi
              </label>
              <div className="relative">
                <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="prof-website"
                  type="text"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://www.firmaniz.com"
                  className="w-full pl-8 pr-2.5 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-slate-900"
                />
              </div>
              {formatBrandWebsiteUrl(website) && (
                <a
                  href={formatBrandWebsiteUrl(website)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:underline"
                >
                  <span className="truncate max-w-[160px]">{formatBrandWebsiteLabel(website)}</span>
                  <ExternalLink size={10} />
                </a>
              )}
            </div>

            <div>
              <label htmlFor="prof-instagram" className="block text-xs font-bold text-slate-700 mb-1">
                Instagram Sayfası
              </label>
              <div className="relative">
                <InstagramIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-rose-500" />
                <input
                  id="prof-instagram"
                  type="text"
                  value={instagramHandle}
                  onChange={(e) => setInstagramHandle(e.target.value)}
                  placeholder="@firmaniz veya link"
                  className="w-full pl-8 pr-2.5 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-slate-900"
                />
              </div>
              {formatBrandInstagramUrl(instagramHandle) && (
                <a
                  href={formatBrandInstagramUrl(instagramHandle)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 hover:underline"
                >
                  <span>{formatBrandInstagramLabel(instagramHandle)}</span>
                  <ExternalLink size={10} />
                </a>
              )}
            </div>
          </div>

          <TurkeyLocationSelects
            compact
            city={city}
            district={district}
            onCityChange={setCity}
            onDistrictChange={setDistrict}
            cityId="prof-city"
            districtId="prof-district"
            cityLabel="İl"
            districtLabel="İlçe"
          />

          <div>
            <label htmlFor="prof-address" className="block text-xs font-bold text-slate-700 mb-1">
              Mağaza / Showroom Açık Adresi
            </label>
            <div className="relative">
              <MapPin size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <textarea
                id="prof-address"
                rows={2}
                value={locationAddress}
                onChange={(e) => setLocationAddress(e.target.value)}
                placeholder="Mehmet Nesih Özmen Mah. Fatih Cad. No:..."
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-slate-900"
              />
            </div>
          </div>
        </div>

        {/* Column 3: Direct Bank / IBAN Payment Info */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-xs space-y-4">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2.5">
            <CreditCard size={15} className="text-slate-900" />
            <span>3. Doğrudan Sipariş Tahsilat (Banka / IBAN)</span>
          </h3>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-700 leading-relaxed">
            <strong className="text-slate-900 block mb-0.5">
              %0 Komisyon &amp; Doğrudan Tahsilat Modeli:
            </strong>
            Merter Vitrini satışlardan komisyon almaz. Alıcılar sipariş verdiğinde ödemeyi doğrudan aşağıda belirttiğiniz banka hesabınıza (Havale/EFT) gönderir.
          </div>

          <div>
            <label htmlFor="prof-bank-name" className="block text-xs font-bold text-slate-700 mb-1">
              Banka Adı
            </label>
            <input
              id="prof-bank-name"
              type="text"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="Örn: Garanti BBVA / İş Bankası"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-slate-900"
            />
          </div>

          <div>
            <label htmlFor="prof-account-holder" className="block text-xs font-bold text-slate-700 mb-1">
              Alıcı Ünvanı / Hesap Sahibi Adı Soyadı
            </label>
            <div className="relative">
              <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="prof-account-holder"
                type="text"
                value={bankAccountHolder}
                onChange={(e) => setBankAccountHolder(e.target.value)}
                placeholder="Örn: LUSTRİN TEKSTİL SAN. VE TİC. LTD. ŞTİ."
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-slate-900"
              />
            </div>
          </div>

          <div>
            <label htmlFor="prof-iban" className="block text-xs font-bold text-slate-700 mb-1">
              IBAN Numarası (TR)
            </label>
            <input
              id="prof-iban"
              type="text"
              value={iban}
              onChange={(e) => setIban(e.target.value.toUpperCase())}
              placeholder="TR00 0000 0000 0000 0000 0000 00"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-slate-900"
            />
          </div>
        </div>
      </div>

      {/* Additional Branches / Depots */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <MapPin size={15} className="text-rose-600" />
              <span>4. Ek Mağaza, Şube &amp; Depo Adresleri ({addresses.length})</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Showroom dışında fabrika, depo veya ikinci satış noktanız varsa il/ilçe ve konum koordinatıyla ekleyebilirsiniz.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setAddresses((prev) => [
                ...prev,
                {
                  id: `supp-branch-${Date.now()}-${prev.length + 1}`,
                  title: "",
                  city: city || "",
                  district: district || "",
                  text: "",
                  coordinates: "",
                },
              ])
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer self-start sm:self-auto"
          >
            <Plus size={13} />
            <span>Yeni Şube / Adres Ekle</span>
          </button>
        </div>

        {addresses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {addresses.map((addr, idx) => (
              <div
                key={addr.id || `supp-branch-row-${idx}`}
                className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 space-y-3 relative"
              >
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="text"
                    required
                    value={addr.title}
                    onChange={(e) =>
                      setAddresses((prev) =>
                        prev.map((a, i) => (i === idx ? { ...a, title: e.target.value } : a))
                      )
                    }
                    placeholder="Başlık (Örn: Merter Showroom, Fabrika Depo)"
                    className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-800 focus:outline-none focus:border-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => setAddresses((prev) => prev.filter((_, i) => i !== idx))}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    title="Adresi Kaldır"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <TurkeyLocationSelects
                  compact
                  city={addr.city || ""}
                  district={addr.district || ""}
                  onCityChange={(val) =>
                    setAddresses((prev) =>
                      prev.map((a, i) => (i === idx ? { ...a, city: val, district: "" } : a))
                    )
                  }
                  onDistrictChange={(val) =>
                    setAddresses((prev) =>
                      prev.map((a, i) => (i === idx ? { ...a, district: val } : a))
                    )
                  }
                  cityLabel="Şube İl"
                  districtLabel="Şube İlçe"
                />

                <textarea
                  rows={2}
                  required
                  value={addr.text}
                  onChange={(e) =>
                    setAddresses((prev) =>
                      prev.map((a, i) => (i === idx ? { ...a, text: e.target.value } : a))
                    )
                  }
                  placeholder="Sokak, bina no, kat / daire..."
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-800 focus:outline-none focus:border-slate-900"
                />

                <input
                  type="text"
                  value={addr.coordinates}
                  onChange={(e) =>
                    setAddresses((prev) =>
                      prev.map((a, i) => (i === idx ? { ...a, coordinates: e.target.value } : a))
                    )
                  }
                  placeholder="Harita Koordinatı (Örn: 41.0185, 28.8893)"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-[11px] font-mono text-slate-700 focus:outline-none focus:border-slate-900"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
            Henüz ek mağaza veya depo adresi eklenmemiş.
          </div>
        )}
      </div>
    </form>
  );
}
