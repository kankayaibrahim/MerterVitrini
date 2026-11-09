"use client";

import React, { useState } from "react";
import { Mail, CheckCircle2, Sparkles } from "lucide-react";

const NEWSLETTER_TEXTS: Record<
  string,
  {
    badge: string;
    title: string;
    subtitle: string;
    emailPlaceholder: string;
    companyPlaceholder: string;
    countryPlaceholder: string;
    consentLabel: string;
    submitBtn: string;
    submittingBtn: string;
    successMsg: string;
    errorConsent: string;
  }
> = {
  tr: {
    badge: "MERTER B2B E-BÜLTEN & KOLEKSİYON DUYURULARI",
    title: "Yeni Sezon Toptan Koleksiyonları ve Üretici Fırsatlarını İlk Siz Öğrenin",
    subtitle:
      "Doğrulanmış Merter üreticilerinin yeni sezon serileri, Private Label/Fason kapasite duyuruları ve ihracat bültenleri doğrudan e-postanıza gelsin.",
    emailPlaceholder: "Kurumsal E-Posta Adresiniz *",
    companyPlaceholder: "Firma / Butik Adı (Opsiyonel)",
    countryPlaceholder: "Ülke (Örn: Türkiye, Almanya)",
    consentLabel:
      "6563 sayılı ETK ve KVKK kapsamında yeni koleksiyon, üretici fırsatları ve B2B bültenleri için ticari elektronik ileti gönderilmesini kabul ediyorum.",
    submitBtn: "BÜLTENE KAYDOL",
    submittingBtn: "KAYDEDİLİYOR...",
    successMsg: "B2B E-Bülten aboneliğiniz izinli olarak başarıyla kaydedildi!",
    errorConsent: "Lütfen KVKK ve ticari elektronik ileti onay kutucuğunu işaretleyiniz.",
  },
  en: {
    badge: "MERTER B2B WHOLESALE NEWSLETTER",
    title: "Be First to Receive New Wholesale Collections & Direct Factory Alerts",
    subtitle:
      "Get weekly updates on verified Merter manufacturers, new season size-run packs, and Private Label production availability.",
    emailPlaceholder: "Business Email Address *",
    companyPlaceholder: "Company / Boutique Name (Optional)",
    countryPlaceholder: "Country (e.g., Germany, UK)",
    consentLabel:
      "I agree to receive B2B wholesale collection alerts and commercial electronic communications in accordance with GDPR/KVKK data privacy policies.",
    submitBtn: "SUBSCRIBE",
    submittingBtn: "SAVING...",
    successMsg: "Your B2B newsletter subscription has been confirmed!",
    errorConsent: "Please check the commercial communication and privacy consent box.",
  },
  ru: {
    badge: "ОПТОВАЯ B2B РАССЫЛКА МЕРТЕР",
    title: "Первыми узнавайте о новых коллекциях и прямых предложениях фабрик",
    subtitle:
      "Еженедельные обзоры проверенных производителей Мертер, новые серийные коллекции и возможности пошива Private Label.",
    emailPlaceholder: "Ваш рабочий Email *",
    companyPlaceholder: "Название компании / бутика",
    countryPlaceholder: "Страна (например: Россия, Казахстан)",
    consentLabel:
      "Я согласен(на) получать информационные и коммерческие B2B-рассылки о новых коллекциях в соответствии с политикой конфиденциальности.",
    submitBtn: "ПОДПИСАТЬСЯ",
    submittingBtn: "ОТПРАВКА...",
    successMsg: "Вы успешно подписались на B2B рассылку Merter Vitrini!",
    errorConsent: "Пожалуйста, подтвердите согласие на получение рассылки.",
  },
  ar: {
    badge: "النشرة الإخبارية للأزياء بالجملة B2B",
    title: "كن أول من يطلع على تشكيلات الموسم الجديد وعروض مصانع مارتر",
    subtitle:
      "اشترك لتصلك أحدث تشكيلات السيريه، عروض المصانع المعتمدة، وفرص التصنيع للغير (Private Label) مباشرة إلى بريدك الإلكتروني.",
    emailPlaceholder: "البريد الإلكتروني التجاري *",
    companyPlaceholder: "اسم الشركة / البوتيك (اختياري)",
    countryPlaceholder: "الدولة (مثال: الإمارات، السعودية)",
    consentLabel:
      "أوافق على استلام النشرات التجارية وإشعارات التشكيلات الجديدة بالجملة وفقاً لسياسة الخصوصية وحماية البيانات.",
    submitBtn: "اشترك الآن",
    submittingBtn: "جاري التسجيل...",
    successMsg: "تم تسجيل اشتراكك في النشرة التجارية بنجاح!",
    errorConsent: "يرجى الموافقة على شروط الخصوصية والرسائل التجارية.",
  },
};

export default function NewsletterSubscriptionBox({
  lang,
}: Readonly<{ lang: string }>) {
  const L = NEWSLETTER_TEXTS[lang] || NEWSLETTER_TEXTS.tr;

  const [email, setEmail] = useState<string>("");
  const [companyName, setCompanyName] = useState<string>("");
  const [country, setCountry] = useState<string>("");
  const [consent, setConsent] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!consent) {
      setErrorMsg(L.errorConsent);
      return;
    }
    if (!email.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/store/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          company_name: companyName.trim(),
          country: country.trim(),
          preferred_lang: lang,
          kvkk_consent: true,
          commercial_consent: true,
        }),
      });
      if (res.ok) {
        setSuccess(true);
        setEmail("");
        setCompanyName("");
        setCountry("");
      } else {
        const data = (await res.json()) as { error?: string };
        setErrorMsg(data.error || "Bir hata oluştu.");
      }
    } catch {
      setErrorMsg("Bağlantı hatası oluştu.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-[1720px] mx-auto mb-12 bg-[#FAFAFA] border border-cultured p-6 sm:p-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        <div className="lg:col-span-5 space-y-2">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[2px] text-amber-700">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{L.badge}</span>
          </span>
          <h3 className="font-serif font-bold text-base sm:text-lg text-eerie-black leading-snug">
            {L.title}
          </h3>
          <p className="text-xs text-sonic-silver leading-relaxed">{L.subtitle}</p>
        </div>

        <div className="lg:col-span-7">
          {success ? (
            <div className="bg-emerald-50 border border-emerald-200 p-4 flex items-center gap-3 text-emerald-900 text-xs font-bold">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{L.successMsg}</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="relative">
                  <Mail className="w-4 h-4 text-sonic-silver absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={L.emailPlaceholder}
                    className="w-full bg-white border border-cultured pl-9 pr-3 py-2.5 text-xs font-semibold text-eerie-black focus:outline-none focus:border-black"
                  />
                </div>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder={L.companyPlaceholder}
                  className="w-full bg-white border border-cultured px-3 py-2.5 text-xs font-semibold text-eerie-black focus:outline-none focus:border-black"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder={L.countryPlaceholder}
                    className="w-full bg-white border border-cultured px-3 py-2.5 text-xs font-semibold text-eerie-black focus:outline-none focus:border-black"
                  />
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2.5 bg-black hover:bg-amber-600 text-white text-[11px] font-extrabold uppercase tracking-wider shrink-0 cursor-pointer border-none transition-colors disabled:opacity-50"
                  >
                    {submitting ? L.submittingBtn : L.submitBtn}
                  </button>
                </div>
              </div>

              <label className="flex items-start gap-2 text-[11px] text-sonic-silver cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 rounded border-cultured text-black focus:ring-black cursor-pointer"
                />
                <span>{L.consentLabel}</span>
              </label>

              {errorMsg && (
                <p className="text-[11px] font-bold text-rose-600">{errorMsg}</p>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

