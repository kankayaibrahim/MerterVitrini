"use client";

import React from "react";
import { UserAddress } from "@/app/profile/components/types";
import { SupportedSeoLang, normalizeSeoLang } from "@/utils/seoHelpers";
import StructuredCheckoutAddressPicker from "@/components/store/StructuredCheckoutAddressPicker";
import { getRecaptchaLegalNotice } from "@/utils/recaptcha";

interface CheckoutSectionCopy {
  readonly orderBankTransfer: string;
  readonly requestProforma: string;
  readonly addressPaymentTitle: string;
  readonly backToCart: string;
  readonly deliveryLabel: string;
  readonly billingLabel: string;
  readonly sameAsDeliveryLabel: string;
  readonly confirmOrder: string;
  readonly proformaNoticeTitle: string;
  readonly proformaNoticeBody: string;
  readonly proformaNoticeHint: string;
}

const CHECKOUT_COPY: Record<SupportedSeoLang, CheckoutSectionCopy> = {
  tr: {
    orderBankTransfer: "KURUMSAL HAVALE / PROFORMA İLE SİPARİŞ VER",
    requestProforma: "FİYAT TEKLİFİ İSTE (PROFORMA)",
    addressPaymentTitle: "TESLİMAT VE FATURA BİLGİLERİ",
    backToCart: "Sepete Dön",
    deliveryLabel: "TESLİMAT ADRESİ",
    billingLabel: "FATURA ADRESİ",
    sameAsDeliveryLabel: "Fatura adresi teslimat adresiyle aynı olsun",
    confirmOrder: "KURUMSAL SİPARİŞİ ONAYLA",
    proformaNoticeTitle: "RESMİ PROFORMA FATURA & BANKA TRANSFER SÜRECİ",
    proformaNoticeBody:
      "Sipariş onayınızın ardından TRY, USD veya EUR para birimindeki resmi kurumsal IBAN/SWIFT hesap bilgilerimiz sipariş numaranıza özel üretilen Proforma Fatura üzerinde tarafınıza iletilir.",
    proformaNoticeHint:
      "* Ödeme transferi sonrasında Profil > Siparişlerim ekranından dekont/ödeme bildirimi yapabilirsiniz.",
  },
  en: {
    orderBankTransfer: "PLACE ORDER VIA CORPORATE WIRE / PROFORMA",
    requestProforma: "REQUEST PRICE QUOTE (PROFORMA)",
    addressPaymentTitle: "DELIVERY & BILLING DETAILS",
    backToCart: "Back to Cart",
    deliveryLabel: "DELIVERY / CARGO ADDRESS",
    billingLabel: "COMPANY BILLING ADDRESS",
    sameAsDeliveryLabel: "Use same address for billing",
    confirmOrder: "CONFIRM WHOLESALE ORDER",
    proformaNoticeTitle: "OFFICIAL PROFORMA INVOICE & WIRE TRANSFER",
    proformaNoticeBody:
      "Upon order confirmation, official corporate IBAN & SWIFT bank coordinates (TRY, USD, EUR) are issued on your order-specific Proforma Invoice.",
    proformaNoticeHint:
      "* Reference your Order Number on the wire transfer and submit payment notification under Profile > My Orders.",
  },
  ru: {
    orderBankTransfer: "ОФОРМИТЬ ЗАКАЗ ПО СЧЕТУ / ПЕРЕВОДУ",
    requestProforma: "ЗАПРОСИТЬ СЧЕТ-ПРОФОРМУ",
    addressPaymentTitle: "АДРЕС ДОСТАВКИ И РЕКВИЗИТЫ",
    backToCart: "Назад в корзину",
    deliveryLabel: "АДРЕС ДОСТАВКИ / КАРГО",
    billingLabel: "ПЛАТЕЖНЫЙ АДРЕС КОМПАНИИ",
    sameAsDeliveryLabel: "Платёжный адрес совпадает с адресом доставки",
    confirmOrder: "ПОДТВЕРДИТЬ ОПТОВЫЙ ЗАКАЗ",
    proformaNoticeTitle: "ОФИЦИАЛЬНЫЙ СЧЕТ-ПРОФОРМА И БАНКОВСКИЙ ПЕРЕВОД",
    proformaNoticeBody:
      "После подтверждения заказа официальные корпоративные реквизиты IBAN / SWIFT (TRY, USD, EUR) формируются в вашем индивидуальном счете-проформе.",
    proformaNoticeHint:
      "* Укажите номер заказа в назначении платежа и отправьте уведомление об оплате в разделе Профиль > Мои заказы.",
  },
  ar: {
    orderBankTransfer: "تأكيد الطلب عبر تحويل بنكي / فاتورة أولية",
    requestProforma: "طلب عرض سعر رسمي (Proforma)",
    addressPaymentTitle: "بيانات الشحن والفوترة",
    backToCart: "العودة إلى السلة",
    deliveryLabel: "عنوان التسليم / شركة الشحن",
    billingLabel: "عنوان الفوترة للشركة",
    sameAsDeliveryLabel: "عنوان الفوترة مطابق لعنوان التسليم",
    confirmOrder: "تأكيد طلب الجملة",
    proformaNoticeTitle: "الفاتورة الأولية الرسمية والتحويل البنكي",
    proformaNoticeBody:
      "بعد تأكيد الطلب يتم إصدار الفاتورة الأولية (Proforma Invoice) متضمنةً الحسابات البنكية الرسمية للشركة (IBAN / SWIFT) بعملات TRY وUSD وEUR.",
    proformaNoticeHint:
      "* يرجى ذكر رقم الطلب في الحوالة البنكية وإشعارنا بالدفع من خلال الملف الشخصي > طلباتي.",
  },
  de: {
    orderBankTransfer: "PER BANKÜBERWEISUNG / PROFORMA BESTELLEN",
    requestProforma: "PREISANGEBOT ANFORDERN (PROFORMA)",
    addressPaymentTitle: "LIEFER- & RECHNUNGSANGABEN",
    backToCart: "Zurück zum Warenkorb",
    deliveryLabel: "LIEFERADRESSE",
    billingLabel: "FIRMEN-RECHNUNGSADRESSE",
    sameAsDeliveryLabel: "Rechnungsadresse entspricht der Lieferadresse",
    confirmOrder: "B2B-BESTELLUNG BESTÄTIGEN",
    proformaNoticeTitle: "OFFIZIELLE PROFORMA-RECHNUNG & BANKÜBERWEISUNG",
    proformaNoticeBody:
      "Nach Bestellbestätigung erhalten Sie Ihre auftragsbezogene Proforma-Rechnung inklusive unserer offiziellen Firmen-IBAN/SWIFT-Kontodaten (EUR, USD, TRY).",
    proformaNoticeHint:
      "* Bitte geben Sie Ihre Bestellnummer als Verwendungszweck an und melden Sie die Zahlung unter Profil > Meine Bestellungen.",
  },
  fr: {
    orderBankTransfer: "COMMANDER PAR VIREMENT / PROFORMA",
    requestProforma: "DEMANDER UN DEVIS (PROFORMA)",
    addressPaymentTitle: "ADRESSES DE LIVRAISON & FACTURATION",
    backToCart: "Retour au panier",
    deliveryLabel: "ADRESSE DE LIVRAISON / TRANSITAIRE",
    billingLabel: "ADRESSE DE FACTURATION SOCIÉTÉ",
    sameAsDeliveryLabel: "Utiliser la même adresse pour la facturation",
    confirmOrder: "CONFIRMER LA COMMANDE B2B",
    proformaNoticeTitle: "FACTURE PROFORMA OFFICIELLE & VIREMENT BANCAIRE",
    proformaNoticeBody:
      "Dès validation de votre commande, nos coordonnées bancaires officielles IBAN / SWIFT (EUR, USD, TRY) vous sont communiquées sur votre Facture Proforma dédiée.",
    proformaNoticeHint:
      "* Indiquez le numéro de commande en référence de virement puis déclarez le paiement dans Profil > Mes commandes.",
  },
  pl: {
    orderBankTransfer: "ZAMÓW PRZELEWEM FIRMOWYM / PROFORMA",
    requestProforma: "POPROŚ O WYCENĘ (PROFORMA)",
    addressPaymentTitle: "ADRES DOSTAWY I DANE DO FAKTURY",
    backToCart: "Wróć do koszyka",
    deliveryLabel: "ADRES DOSTAWY / SPEDYCJI",
    billingLabel: "DANE ROZLICZENIOWE FIRMY",
    sameAsDeliveryLabel: "Adres rozliczeniowy taki sam jak adres dostawy",
    confirmOrder: "POTWIERDŹ ZAMÓWIENIE B2B",
    proformaNoticeTitle: "OFICJALNA FAKTURA PROFORMA I PRZELEW BANKOWY",
    proformaNoticeBody:
      "Po potwierdzeniu zamówienia oficjalne firmowe rachunki IBAN / SWIFT (EUR, USD, TRY) zostaną udostępnione na dedykowanej Fakturze Proforma.",
    proformaNoticeHint:
      "* Podaj numer zamówienia w tytule przelewu i zgłoś płatność w zakładce Profil > Moje zamówienia.",
  },
  bg: {
    orderBankTransfer: "ПОРЪЧАЙ С БАНКОВ ПРЕВОД / ПРОФОРМА",
    requestProforma: "ПОИСКАЙ ЦЕНОВА ОФЕРТА (ПРОФОРМА)",
    addressPaymentTitle: "АДРЕС ЗА ДОСТАВКА И ФАКТУРИРАНЕ",
    backToCart: "Обратно към количката",
    deliveryLabel: "АДРЕС ЗА ДОСТАВКА / КАРГО",
    billingLabel: "ФИРМЕН АДРЕС ЗА ФАКТУРА",
    sameAsDeliveryLabel: "Адресът за фактуриране е същият като за доставка",
    confirmOrder: "ПОТВЪРДИ B2B ПОРЪЧКАТА",
    proformaNoticeTitle: "ОФИЦИАЛНА ПРОФОРМА ФАКТУРА И БАНКОВ ПРЕВОД",
    proformaNoticeBody:
      "След потвърждение на поръчката официалните фирмени банкови сметки IBAN / SWIFT (EUR, USD, TRY) се предоставят във вашата индивидуална Проформа фактура.",
    proformaNoticeHint:
      "* Посочете номера на поръчката като основание за превод и потвърдете плащането в Профил > Моите поръчки.",
  },
};

interface CartCheckoutSectionProps {
  readonly isCheckout: boolean;
  readonly setIsCheckout: (v: boolean) => void;
  readonly onRequestQuoteOnly: () => void;
  readonly token: string | null;
  readonly addresses: readonly UserAddress[];
  readonly deliveryAddr: string;
  readonly setDeliveryAddr: (v: string) => void;
  readonly billingAddr: string;
  readonly setBillingAddr: (v: string) => void;
  readonly sameAsDelivery: boolean;
  readonly setSameAsDelivery: (v: boolean) => void;
  readonly onAddressCreated: (createdId: string, kind: "shipping" | "billing") => Promise<void>;
  readonly defaultFirstName?: string;
  readonly defaultLastName?: string;
  readonly defaultPhone?: string;
  readonly submittingOrder: boolean;
  readonly onSubmitCheckout: (e: React.FormEvent) => void;
  readonly onCancelCheckout: () => void;
  readonly lang: string;
}

interface CartInitialActionsProps {
  readonly onStartCheckout: () => void;
  readonly onRequestQuoteOnly: () => void;
  readonly copy: CheckoutSectionCopy;
}

function CartInitialActions({
  onStartCheckout,
  onRequestQuoteOnly,
  copy,
}: Readonly<CartInitialActionsProps>) {
  return (
    <div className="flex flex-col gap-3 pt-2 mt-1">
      <button
        type="button"
        onClick={onStartCheckout}
        className="w-full py-3.5 bg-salmon-pink hover:bg-eerie-black text-white rounded-[5px] font-extrabold text-xs tracking-[0.5px] shadow-sm border-none flex items-center justify-center gap-2 cursor-pointer transition-colors"
      >
        💳 {copy.orderBankTransfer}
      </button>
      <button
        type="button"
        onClick={onRequestQuoteOnly}
        className="w-full py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-[5px] font-bold text-xs border-none flex items-center justify-center gap-2 cursor-pointer transition-colors"
      >
        📄 {copy.requestProforma}
      </button>
    </div>
  );
}

function CorporateProformaNotice({ copy }: { readonly copy: CheckoutSectionCopy }) {
  return (
    <div className="bg-[#eff6ff] border border-blue-100 rounded-lg p-3.5 flex flex-col gap-2 text-xs text-blue-900 shadow-sm leading-relaxed">
      <div className="font-extrabold tracking-wide border-b border-blue-200/50 pb-1.5 text-[10px] text-blue-800">
        🏦 {copy.proformaNoticeTitle}
      </div>
      <p className="text-[11px] font-semibold text-blue-950 m-0 leading-relaxed">
        {copy.proformaNoticeBody}
      </p>
      <div className="text-[9.5px] font-bold text-blue-800 italic border-t border-blue-200/40 pt-1.5 leading-snug">
        {copy.proformaNoticeHint}
      </div>
    </div>
  );
}

export default function CartCheckoutSection({
  isCheckout,
  setIsCheckout,
  onRequestQuoteOnly,
  token,
  addresses,
  deliveryAddr,
  setDeliveryAddr,
  billingAddr,
  setBillingAddr,
  sameAsDelivery,
  setSameAsDelivery,
  onAddressCreated,
  defaultFirstName = "",
  defaultLastName = "",
  defaultPhone = "",
  submittingOrder,
  onSubmitCheckout,
  onCancelCheckout,
  lang,
}: Readonly<CartCheckoutSectionProps>) {
  const safeLang = normalizeSeoLang(lang, "en");
  const copy = CHECKOUT_COPY[safeLang];

  if (!isCheckout) {
    return (
      <CartInitialActions
        onStartCheckout={() => setIsCheckout(true)}
        onRequestQuoteOnly={onRequestQuoteOnly}
        copy={copy}
      />
    );
  }

  return (
    <form onSubmit={onSubmitCheckout} className="flex flex-col gap-4 pt-2 border-t border-cultured mt-1">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-extrabold text-salmon-pink tracking-[0.5px]">
          {copy.addressPaymentTitle}
        </h4>
        <button
          type="button"
          onClick={onCancelCheckout}
          className="text-[10px] font-bold text-sonic-silver hover:text-salmon-pink bg-transparent border-none cursor-pointer"
        >
          &larr; {copy.backToCart}
        </button>
      </div>

      <StructuredCheckoutAddressPicker
        label={copy.deliveryLabel}
        icon={<span aria-hidden="true">🚚</span>}
        addressType="shipping"
        lang={safeLang}
        token={token}
        addresses={addresses}
        selectedAddressId={deliveryAddr}
        onSelectAddressId={setDeliveryAddr}
        onAddressCreated={(id) => onAddressCreated(id, "shipping")}
        defaultFirstName={defaultFirstName}
        defaultLastName={defaultLastName}
        defaultPhone={defaultPhone}
      />

      <label className="flex items-center gap-2 text-xs font-bold text-eerie-black cursor-pointer select-none py-1">
        <input
          type="checkbox"
          checked={sameAsDelivery}
          onChange={(e) => setSameAsDelivery(e.target.checked)}
          className="w-4 h-4 rounded accent-salmon-pink cursor-pointer"
        />
        <span>{copy.sameAsDeliveryLabel}</span>
      </label>

      {!sameAsDelivery && (
        <StructuredCheckoutAddressPicker
          label={copy.billingLabel}
          icon={<span aria-hidden="true">📄</span>}
          addressType="billing"
          lang={safeLang}
          token={token}
          addresses={addresses}
          selectedAddressId={billingAddr}
          onSelectAddressId={setBillingAddr}
          onAddressCreated={(id) => onAddressCreated(id, "billing")}
          defaultFirstName={defaultFirstName}
          defaultLastName={defaultLastName}
          defaultPhone={defaultPhone}
        />
      )}

      <CorporateProformaNotice copy={copy} />

      <p className="text-[10px] font-medium text-neutral-500 text-center leading-snug m-0">
        {getRecaptchaLegalNotice(safeLang)}
      </p>

      <button
        type="submit"
        disabled={submittingOrder}
        className="w-full py-3.5 bg-salmon-pink hover:bg-eerie-black text-white rounded-[5px] font-extrabold text-xs tracking-[0.5px] shadow-sm border-none flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-[0.99] transition-all"
      >
        {submittingOrder ? (
          <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
        ) : (
          `✔️ ${copy.confirmOrder}`
        )}
      </button>
    </form>
  );
}
