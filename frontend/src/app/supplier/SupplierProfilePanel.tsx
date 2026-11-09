"use client";

import React, { useState, useEffect } from "react";
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
} from "lucide-react";

export interface SupplierBrandProfile {
  id: string;
  name: string;
  slug: string;
  alias_code?: string;
  company_type: string;
  description: string;
  description_translations?: Record<string, string>;
  website?: string;
  phone?: string;
  whatsapp_phone: string;
  public_email: string;
  instagram_handle: string;
  location_address: string;
  export_countries: string;
  min_order_quantity: number;
  supports_private_label: boolean;
  supports_fason: boolean;
  is_verified: boolean;
  bank_name: string;
  bank_account_holder: string;
  iban: string;
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
  const [companyType, setCompanyType] = useState("uretici_toptanci");
  const [description, setDescription] = useState("");
  const [descTranslations, setDescTranslations] = useState<Record<string, string>>({
    en: "",
    ru: "",
    ar: "",
  });
  const [activeDescLang, setActiveDescLang] = useState<"tr" | "en" | "ru" | "ar">("tr");
  const [autoTranslatingDesc, setAutoTranslatingDesc] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [phone, setPhone] = useState("");
  const [publicEmail, setPublicEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [locationAddress, setLocationAddress] = useState("");
  const [exportCountries, setExportCountries] = useState("");
  const [minOrderQty, setMinOrderQty] = useState<number>(1);
  const [supportsPrivateLabel, setSupportsPrivateLabel] = useState(false);
  const [supportsFason, setSupportsFason] = useState(false);
  const [bankName, setBankName] = useState("");
  const [bankAccountHolder, setBankAccountHolder] = useState("");
  const [iban, setIban] = useState("");
  const [isVerified, setIsVerified] = useState(true);

  useEffect(() => {
    let ignore = false;
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
          const data = await res.json();
          const bp: SupplierBrandProfile | undefined = data.brand_profile;
          if (bp) {
            setBrandName(bp.name || "");
            setCompanyType(bp.company_type || "uretici_toptanci");
            setDescription(bp.description || "");
            setDescTranslations({
              en: bp.description_translations?.en || "",
              ru: bp.description_translations?.ru || "",
              ar: bp.description_translations?.ar || "",
            });
            setWhatsappPhone(bp.whatsapp_phone || bp.phone || "");
            setPhone(bp.phone || "");
            setPublicEmail(bp.public_email || "");
            setWebsite(bp.website || "");
            setInstagramHandle(bp.instagram_handle || "");
            setLocationAddress(bp.location_address || "");
            setExportCountries(bp.export_countries || "");
            setMinOrderQty(bp.min_order_quantity || 1);
            setSupportsPrivateLabel(Boolean(bp.supports_private_label));
            setSupportsFason(Boolean(bp.supports_fason));
            setBankName(bp.bank_name || "");
            setBankAccountHolder(bp.bank_account_holder || "");
            setIban(bp.iban || "");
            setIsVerified(bp.is_verified !== false);
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
        const data = await res.json();
        const t = data.translations || {};
        setDescTranslations({
          en: t.en?.description || descTranslations.en || "",
          ru: t.ru?.description || descTranslations.ru || "",
          ar: t.ar?.description || descTranslations.ar || "",
        });
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
          public_email: publicEmail,
          website,
          instagram_handle: instagramHandle,
          location_address: locationAddress,
          export_countries: exportCountries,
          min_order_quantity: Number(minOrderQty) || 1,
          supports_private_label: supportsPrivateLabel,
          supports_fason: supportsFason,
          bank_name: bankName,
          bank_account_holder: bankAccountHolder,
          iban,
        }),
      });

      if (res.ok) {
        setSaveMessage(
          "Firma vitrin, doğrudan iletişim ve tahsilat (IBAN) bilgileriniz başarıyla güncellendi."
        );
        if (onProfileSaved) onProfileSaved();
      } else {
        const errData = await res.json().catch(() => ({}));
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
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900">
              Açık Firma Vitrini, Doğrudan İletişim & Tahsilat Ayarları
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
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1677ff] hover:bg-[#4096ff] text-white text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50 shrink-0"
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
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-2.5">
            <Factory size={15} className="text-[#1677ff]" />
            <span>1. Firma Kimliği & Üretim Kapasitesi</span>
          </h3>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Vitrinde Görünecek Ticari Firma Adı *
            </label>
            <input
              type="text"
              required
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="Örn: Lustrin Toptan Tekstil"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-[#1677ff]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Faaliyet / Üretici Türü
            </label>
            <select
              value={companyType}
              onChange={(e) => setCompanyType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-[#1677ff]"
            >
              <option value="uretici_toptanci">Hazır Giyim Üreticisi & Toptancı</option>
              <option value="private_label">Özel Etiket (Private Label) Üreticisi</option>
              <option value="fason_atolye">Fason Üretim Atölyesi</option>
              <option value="kumas_tedarikcisi">Kumaş Üreticisi & Tedarikçisi</option>
              <option value="aksesuar">Tekstil Aksesuar & Yan Sanayi</option>
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
              <label className="block text-xs font-bold text-slate-700">
                Firma Tanıtım Yazısı (4 Dil • Alıcılara Açık)
              </label>
              <button
                type="button"
                onClick={() => void handleAutoTranslateDescription()}
                disabled={autoTranslatingDesc || !description.trim()}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-[#1677ff] border border-blue-200 text-[10px] font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                <Sparkles size={11} />
                <span>{autoTranslatingDesc ? "Çevriliyor..." : "EN/RU/AR Otomatik Çevir"}</span>
              </button>
            </div>

            <div className="flex items-center gap-1 mb-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
              {([
                { code: "tr", label: "🇹🇷 TR" },
                { code: "en", label: "🇬🇧 EN" },
                { code: "ru", label: "🇷🇺 RU" },
                { code: "ar", label: "🇸🇦 AR" },
              ] as const).map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => setActiveDescLang(l.code)}
                  className={`flex-1 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                    activeDescLang === l.code
                      ? "bg-white text-[#1677ff] shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>

            {activeDescLang === "tr" ? (
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Firmanızın uzmanlık alanları, üretim kapasitesi ve koleksiyon tarzı hakkında Türkçe bilgi verin..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-[#1677ff]"
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
                className="w-full px-3 py-2 rounded-lg border border-blue-200 bg-blue-50/20 text-xs text-slate-800 focus:outline-none focus:border-[#1677ff]"
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Min. Sipariş (Seri)
              </label>
              <input
                type="number"
                min={1}
                value={minOrderQty}
                onChange={(e) => setMinOrderQty(Number(e.target.value) || 1)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-[#1677ff]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                İhracat Ülkeleri
              </label>
              <input
                type="text"
                value={exportCountries}
                onChange={(e) => setExportCountries(e.target.value)}
                placeholder="Almanya, Rusya, BAE..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-[#1677ff]"
              />
            </div>
          </div>

          <div className="pt-2 space-y-2 border-t border-slate-100">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={supportsPrivateLabel}
                onChange={(e) => setSupportsPrivateLabel(e.target.checked)}
                className="rounded border-slate-300 text-[#1677ff] focus:ring-[#1677ff]"
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
                className="rounded border-slate-300 text-[#1677ff] focus:ring-[#1677ff]"
              />
              <span className="text-xs font-semibold text-slate-700">
                Fason / Sipariş Bazlı Üretim İmkanımız Var
              </span>
            </label>
          </div>
        </div>

        {/* Column 2: Direct Contact Channels */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-xs space-y-4">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-2.5">
            <Phone size={15} className="text-emerald-600" />
            <span>2. Doğrudan İletişim & Adres Bilgileri</span>
          </h3>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Doğrudan Sipariş WhatsApp Hattı *
            </label>
            <input
              type="text"
              value={whatsappPhone}
              onChange={(e) => setWhatsappPhone(e.target.value)}
              placeholder="+90 532 000 00 00"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-[#1677ff]"
            />
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              Ürün sayfasındaki &quot;WhatsApp ile Doğrudan Sipariş Ver&quot; butonu bu numaraya yönlenir.
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Mağaza / Santral Telefonu
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+90 212 000 00 00"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-[#1677ff]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Kurumsal E-Posta Adresi
            </label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                value={publicEmail}
                onChange={(e) => setPublicEmail(e.target.value)}
                placeholder="satis@firmaniz.com"
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-[#1677ff]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Web Sitesi
              </label>
              <div className="relative">
                <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://..."
                  className="w-full pl-8 pr-2.5 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-[#1677ff]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Instagram
              </label>
              <input
                type="text"
                value={instagramHandle}
                onChange={(e) => setInstagramHandle(e.target.value)}
                placeholder="@firmaniz"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-[#1677ff]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Merter Mağaza / Showroom Açık Adresi
            </label>
            <div className="relative">
              <MapPin size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <textarea
                rows={2}
                value={locationAddress}
                onChange={(e) => setLocationAddress(e.target.value)}
                placeholder="Mehmet Nesih Özmen Mah. Fatih Cad. No:... Merter / Güngören / İstanbul"
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-[#1677ff]"
              />
            </div>
          </div>
        </div>

        {/* Column 3: Direct Bank / IBAN Payment Info */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-xs space-y-4">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-2.5">
            <CreditCard size={15} className="text-[#1677ff]" />
            <span>3. Doğrudan Sipariş Tahsilat (Banka / IBAN)</span>
          </h3>

          <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3 text-[11px] text-slate-700 leading-relaxed">
            <strong className="text-slate-900 block mb-0.5">
              %0 Komisyon & Doğrudan Tahsilat Modeli:
            </strong>
            Merter Vitrini satışlardan komisyon almaz. Alıcılar sipariş verdiğinde ödemeyi doğrudan aşağıda belirttiğiniz banka hesabınıza (Havale/EFT) gönderir.
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Banka Adı
            </label>
            <input
              type="text"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="Örn: Garanti BBVA / İş Bankası"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-[#1677ff]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Alıcı Ünvanı / Hesap Sahibi Adı Soyadı
            </label>
            <div className="relative">
              <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={bankAccountHolder}
                onChange={(e) => setBankAccountHolder(e.target.value)}
                placeholder="Örn: LUSTRİN TEKSTİL SAN. VE TİC. LTD. ŞTİ."
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-[#1677ff]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              IBAN Numarası (TR)
            </label>
            <input
              type="text"
              value={iban}
              onChange={(e) => setIban(e.target.value.toUpperCase())}
              placeholder="TR00 0000 0000 0000 0000 0000 00"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-[#1677ff]"
            />
          </div>
        </div>
      </div>
    </form>
  );
}
