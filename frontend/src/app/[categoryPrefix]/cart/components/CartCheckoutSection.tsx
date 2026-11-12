"use client";

import React from "react";
import { UserAddress } from "@/app/profile/components/types";
import { SupportedSeoLang, normalizeSeoLang } from "@/utils/seoHelpers";

interface CheckoutSectionCopy {
  readonly orderBankTransfer: string;
  readonly requestProforma: string;
  readonly addressPaymentTitle: string;
  readonly backToCart: string;
  readonly deliveryLabel: string;
  readonly customDeliveryOption: string;
  readonly emptyDelivery: string;
  readonly deliveryPlaceholder: string;
  readonly billingLabel: string;
  readonly customBillingOption: string;
  readonly emptyBilling: string;
  readonly billingPlaceholder: string;
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
    customDeliveryOption: "+ Yeni Teslimat Adresi Girişi",
    emptyDelivery: "Profilinizde kayıtlı teslimat adresi bulunamadı.",
    deliveryPlaceholder: "Teslimat ve kargo/ambar adresini yazınız...",
    billingLabel: "FATURA ADRESİ",
    customBillingOption: "+ Yeni Fatura Adresi Girişi",
    emptyBilling: "Profilinizde kayıtlı fatura adresi bulunamadı.",
    billingPlaceholder: "Firma unvanı, vergi dairesi/no ve fatura adresini yazınız...",
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
    customDeliveryOption: "+ Enter New Delivery Address",
    emptyDelivery: "No saved shipping addresses found in your profile.",
    deliveryPlaceholder: "Enter destination address or Istanbul cargo agency details...",
    billingLabel: "COMPANY BILLING ADDRESS",
    customBillingOption: "+ Enter New Billing Address",
    emptyBilling: "No saved billing addresses found in your profile.",
    billingPlaceholder: "Enter company name, VAT/Tax ID, and billing address...",
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
    customDeliveryOption: "+ Ввести новый адрес доставки",
    emptyDelivery: "В профиле нет сохраненных адресов доставки.",
    deliveryPlaceholder: "Укажите адрес получателя или код/склад вашего карго в Стамбуле...",
    billingLabel: "ПЛАТЕЖНЫЙ АДРЕС КОМПАНИИ",
    customBillingOption: "+ Ввести новый платежный адрес",
    emptyBilling: "В профиле нет сохраненных платежных адресов.",
    billingPlaceholder: "Название компании, ИНН и юридический адрес...",
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
    customDeliveryOption: "+ إدخال عنوان تسليم جديد",
    emptyDelivery: "لا توجد عناوين شحن محفوظة في ملفك الشخصي.",
    deliveryPlaceholder: "اكتب عنوان التسليم أو بيانات مكتب الشحن في إسطنبول...",
    billingLabel: "عنوان الفوترة للشركة",
    customBillingOption: "+ إدخال عنوان فوترة جديد",
    emptyBilling: "لا توجد عناوين فوترة محفوظة في ملفك الشخصي.",
    billingPlaceholder: "اسم الشركة والرقم الضريبي وعنوان الفوترة...",
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
    customDeliveryOption: "+ Neue Lieferadresse eingeben",
    emptyDelivery: "Keine gespeicherten Lieferadressen im Profil gefunden.",
    deliveryPlaceholder: "Lieferadresse oder Speditionsdaten eingeben...",
    billingLabel: "FIRMEN-RECHNUNGSADRESSE",
    customBillingOption: "+ Neue Rechnungsadresse eingeben",
    emptyBilling: "Keine gespeicherten Rechnungsadressen im Profil gefunden.",
    billingPlaceholder: "Firmenname, USt-IdNr. und Rechnungsadresse eingeben...",
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
    customDeliveryOption: "+ Saisir une nouvelle adresse de livraison",
    emptyDelivery: "Aucune adresse de livraison enregistrée dans votre profil.",
    deliveryPlaceholder: "Saisissez l’adresse de livraison ou votre transitaire à Istanbul...",
    billingLabel: "ADRESSE DE FACTURATION SOCIÉTÉ",
    customBillingOption: "+ Saisir une nouvelle adresse de facturation",
    emptyBilling: "Aucune adresse de facturation enregistrée dans votre profil.",
    billingPlaceholder: "Raison sociale, N° TVA et adresse de facturation...",
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
    customDeliveryOption: "+ Wpisz nowy adres dostawy",
    emptyDelivery: "Brak zapisanych adresów dostawy w profilu.",
    deliveryPlaceholder: "Wpisz adres dostawy lub dane spedycji w Stambule...",
    billingLabel: "DANE ROZLICZENIOWE FIRMY",
    customBillingOption: "+ Wpisz nowy adres do faktury",
    emptyBilling: "Brak zapisanych adresów rozliczeniowych w profilu.",
    billingPlaceholder: "Nazwa firmy, NIP EU oraz adres siedziby...",
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
    customDeliveryOption: "+ Въвеждане на нов адрес за доставка",
    emptyDelivery: "Няма запазени адреси за доставка в профила ви.",
    deliveryPlaceholder: "Въведете адрес за доставка или данни на карго спедитор...",
    billingLabel: "ФИРМЕН АДРЕС ЗА ФАКТУРА",
    customBillingOption: "+ Въвеждане на нов адрес за фактура",
    emptyBilling: "Няма запазени адреси за фактуриране в профила ви.",
    billingPlaceholder: "Име на фирма, ДДС/ЕИК номер и адрес...",
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
  readonly addresses: readonly UserAddress[];
  readonly deliveryAddr: string;
  readonly setDeliveryAddr: (v: string) => void;
  readonly customDeliveryAddr: string;
  readonly setCustomDeliveryAddr: (v: string) => void;
  readonly billingAddr: string;
  readonly setBillingAddr: (v: string) => void;
  readonly customBillingAddr: string;
  readonly setCustomBillingAddr: (v: string) => void;
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

interface AddressSelectorFieldProps {
  readonly id: string;
  readonly label: string;
  readonly addresses: readonly UserAddress[];
  readonly selectedAddr: string;
  readonly onSelectAddr: (v: string) => void;
  readonly customAddr: string;
  readonly onCustomAddrChange: (v: string) => void;
  readonly customOptionLabel: string;
  readonly emptyMessage: string;
  readonly placeholder: string;
}

function AddressSelectorField({
  id,
  label,
  addresses,
  selectedAddr,
  onSelectAddr,
  customAddr,
  onCustomAddrChange,
  customOptionLabel,
  emptyMessage,
  placeholder,
}: Readonly<AddressSelectorFieldProps>) {
  const showCustomTextarea = selectedAddr === "custom" || addresses.length === 0;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[10px] font-extrabold text-eerie-black tracking-[0.5px]">
        {label}
      </label>
      {addresses.length > 0 ? (
        <select
          id={id}
          value={selectedAddr}
          onChange={(e) => onSelectAddr(e.target.value)}
          className="w-full px-3 py-2 bg-white border border-cultured rounded-[5px] text-xs font-semibold focus:outline-none focus:border-salmon-pink text-eerie-black"
        >
          {addresses.map((a) => (
            <option key={a.id} value={a.id}>
              {a.title} ({a.address_line.substring(0, 30)}...)
            </option>
          ))}
          <option value="custom">{customOptionLabel}</option>
        </select>
      ) : (
        <div className="text-[10px] text-sonic-silver font-medium italic">{emptyMessage}</div>
      )}
      {showCustomTextarea && (
        <textarea
          required
          value={customAddr}
          onChange={(e) => onCustomAddrChange(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 bg-white border border-cultured rounded-[5px] text-xs font-semibold focus:outline-none focus:border-salmon-pink text-eerie-black resize-none mt-1"
          placeholder={placeholder}
        />
      )}
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
  addresses,
  deliveryAddr,
  setDeliveryAddr,
  customDeliveryAddr,
  setCustomDeliveryAddr,
  billingAddr,
  setBillingAddr,
  customBillingAddr,
  setCustomBillingAddr,
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

      <AddressSelectorField
        id="cart-delivery-addr"
        label={`🚚 ${copy.deliveryLabel}`}
        addresses={addresses}
        selectedAddr={deliveryAddr}
        onSelectAddr={setDeliveryAddr}
        customAddr={customDeliveryAddr}
        onCustomAddrChange={setCustomDeliveryAddr}
        customOptionLabel={copy.customDeliveryOption}
        emptyMessage={copy.emptyDelivery}
        placeholder={copy.deliveryPlaceholder}
      />

      <AddressSelectorField
        id="cart-billing-addr"
        label={`📄 ${copy.billingLabel}`}
        addresses={addresses}
        selectedAddr={billingAddr}
        onSelectAddr={setBillingAddr}
        customAddr={customBillingAddr}
        onCustomAddrChange={setCustomBillingAddr}
        customOptionLabel={copy.customBillingOption}
        emptyMessage={copy.emptyBilling}
        placeholder={copy.billingPlaceholder}
      />

      <CorporateProformaNotice copy={copy} />

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
