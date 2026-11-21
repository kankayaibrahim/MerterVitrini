"use client";

import React from "react";
import { UserAddress } from "@/app/profile/components/types";
import { SupportedSeoLang, normalizeSeoLang } from "@/utils/seoHelpers";
import StructuredCheckoutAddressPicker from "@/components/store/StructuredCheckoutAddressPicker";
import { getRecaptchaLegalNotice } from "@/utils/recaptcha";
import { getCartMultiSupplierCopy } from "@/components/store/cart/cartMultiSupplierCopy";

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
    orderBankTransfer: "TEDARİKÇİLERE SİPARİŞ TALEBİ GÖNDER",
    requestProforma: "HIZLI FİYAT TEKLİFİ İSTE (ADRES GİRMEDEN)",
    addressPaymentTitle: "TESLİMAT VE FATURA BİLGİLERİ",
    backToCart: "Sepete Dön",
    deliveryLabel: "TESLİMAT ADRESİ",
    billingLabel: "FATURA ADRESİ",
    sameAsDeliveryLabel: "Fatura adresi teslimat adresiyle aynı olsun",
    confirmOrder: "TEDARİKÇİLERE SİPARİŞ TALEBİNİ İLET",
    proformaNoticeTitle: "DOĞRUDAN TEDARİKÇİ HAZIRLIK & ÖDEME (%0 KOMİSYON)",
    proformaNoticeBody:
      "Merter Vitrini ödeme almaz ve komisyon eklemez. Talebiniz onaylandığında her ürünün satıcısı olan ilgili tedarikçi firma, proforma faturasını ve kendi kurumsal IBAN / SWIFT ödeme bilgilerini doğrudan size iletir.",
    proformaNoticeHint:
      "* Her tedarikçi kendi alt siparişini ayrı hazırlar; Profil > Siparişlerim ekranından takip edebilir veya doğrudan WhatsApp üzerinden görüşebilirsiniz.",
  },
  en: {
    orderBankTransfer: "SUBMIT ORDER REQUEST TO SUPPLIERS",
    requestProforma: "QUICK QUOTE REQUEST (NO ADDRESS NEEDED)",
    addressPaymentTitle: "DELIVERY & BILLING DETAILS",
    backToCart: "Back to Cart",
    deliveryLabel: "DELIVERY / CARGO ADDRESS",
    billingLabel: "COMPANY BILLING ADDRESS",
    sameAsDeliveryLabel: "Use same address for billing",
    confirmOrder: "SEND REQUEST TO SUPPLIERS",
    proformaNoticeTitle: "DIRECT SUPPLIER FULFILLMENT & PAYMENT (0% COMMISSION)",
    proformaNoticeBody:
      "Merter Vitrini collects zero payment and charges 0% commission. Upon confirmation, each named selling Supplier directly sends its own Proforma Invoice and corporate IBAN / SWIFT payment details.",
    proformaNoticeHint:
      "* Each supplier prepares and dispatches its own sub-order; track everything under Profile > My Orders or message each supplier on WhatsApp.",
  },
  ru: {
    orderBankTransfer: "ОТПРАВИТЬ ЗАЯВКУ ПОСТАВЩИКАМ",
    requestProforma: "БЫСТРЫЙ ЗАПРОС ЦЕНЫ (БЕЗ АДРЕСА)",
    addressPaymentTitle: "АДРЕС ДОСТАВКИ И РЕКВИЗИТЫ",
    backToCart: "Назад в корзину",
    deliveryLabel: "АДРЕС ДОСТАВКИ / КАРГО",
    billingLabel: "ПЛАТЕЖНЫЙ АДРЕС КОМПАНИИ",
    sameAsDeliveryLabel: "Платёжный адрес совпадает с адресом доставки",
    confirmOrder: "ОТПРАВИТЬ ЗАКАЗ ПОСТАВЩИКАМ",
    proformaNoticeTitle: "ПРЯМАЯ СБОРКА И ОПЛАТА ПОСТАВЩИКУ (0% КОМИССИИ)",
    proformaNoticeBody:
      "Merter Vitrini не принимает оплату и не берет комиссию. После отправки заявки каждый поставщик-продавец напрямую направляет свой счет-проформу и реквизиты IBAN / SWIFT.",
    proformaNoticeHint:
      "* Каждый поставщик собирает свою часть заказа; отслеживайте в Профиль > Мои заказы или свяжитесь напрямую по WhatsApp.",
  },
  ar: {
    orderBankTransfer: "إرسال طلب الشراء إلى الموردين",
    requestProforma: "طلب عرض سعر سريع (بدون عنوان)",
    addressPaymentTitle: "بيانات الشحن والفوترة",
    backToCart: "العودة إلى السلة",
    deliveryLabel: "عنوان التسليم / شركة الشحن",
    billingLabel: "عنوان الفوترة للشركة",
    sameAsDeliveryLabel: "عنوان الفوترة مطابق لعنوان التسليم",
    confirmOrder: "إرسال الطلب إلى الموردين",
    proformaNoticeTitle: "تجهيز ودفع مباشر مع المورد (عمولة 0%)",
    proformaNoticeBody:
      "منصة Merter Vitrini لا تحصل أي أموال ولا تضيف عمولة. يتولى كل مورد بائع إرسال فاتورته الأولية وحسابه البنكي (IBAN / SWIFT) مباشرة إليك.",
    proformaNoticeHint:
      "* كل مورد يجهز منتجاته بشكل مستقل؛ يمكنك المتابعة من الملف الشخصي > طلباتي أو التواصل عبر واتساب.",
  },
  de: {
    orderBankTransfer: "BESTELLANFRAGE AN LIEFERANTEN SENDEN",
    requestProforma: "SCHNELLES ANGEBOT ANFORDERN (OHNE ADRESSE)",
    addressPaymentTitle: "LIEFER- & RECHNUNGSANGABEN",
    backToCart: "Zurück zum Warenkorb",
    deliveryLabel: "LIEFERADRESSE",
    billingLabel: "FIRMEN-RECHNUNGSADRESSE",
    sameAsDeliveryLabel: "Rechnungsadresse entspricht der Lieferadresse",
    confirmOrder: "ANFRAGE AN LIEFERANTEN SENDEN",
    proformaNoticeTitle: "DIREKTABWICKLUNG & ZAHLUNG AN LIEFERANTEN (0% PROVISION)",
    proformaNoticeBody:
      "Merter Vitrini zieht keine Zahlungen ein. Jeder verkaufende Lieferant sendet Ihnen seine eigene Proforma-Rechnung und Firmen-IBAN/SWIFT direkt zu.",
    proformaNoticeHint:
      "* Jeder Lieferant bearbeitet seine eigene Teilbestellung; einsehbar unter Profil > Meine Bestellungen oder direkt per WhatsApp.",
  },
  fr: {
    orderBankTransfer: "ENVOYER LA DEMANDE AUX FOURNISSEURS",
    requestProforma: "DEVIS RAPIDE (SANS ADRESSE)",
    addressPaymentTitle: "ADRESSES DE LIVRAISON & FACTURATION",
    backToCart: "Retour au panier",
    deliveryLabel: "ADRESSE DE LIVRAISON / TRANSITAIRE",
    billingLabel: "ADRESSE DE FACTURATION SOCIÉTÉ",
    sameAsDeliveryLabel: "Utiliser la même adresse pour la facturation",
    confirmOrder: "TRANSMETTRE AUX FOURNISSEURS",
    proformaNoticeTitle: "PRÉPARATION ET PAIEMENT DIRECT FOURNISSEUR (0% COMMISSION)",
    proformaNoticeBody:
      "Merter Vitrini n’encaisse aucun paiement. Chaque fournisseur vendeur vous transmet directement sa facture proforma et ses coordonnées IBAN / SWIFT.",
    proformaNoticeHint:
      "* Chaque fournisseur prépare sa propre sous-commande ; suivez le tout dans Profil > Mes commandes ou via WhatsApp.",
  },
  pl: {
    orderBankTransfer: "WYŚLIJ ZAMÓWIENIE DO DOSTAWCÓW",
    requestProforma: "SZYBKIE ZAPYTANIE O WYCENĘ (BEZ ADRESU)",
    addressPaymentTitle: "ADRES DOSTAWY I DANE DO FAKTURY",
    backToCart: "Wróć do koszyka",
    deliveryLabel: "ADRES DOSTAWY / SPEDYCJI",
    billingLabel: "DANE ROZLICZENIOWE FIRMY",
    sameAsDeliveryLabel: "Adres rozliczeniowy taki sam jak adres dostawy",
    confirmOrder: "PRZEKAŻ ZAMÓWIENIE DOSTAWCOM",
    proformaNoticeTitle: "BEZPOŚREDNIA REALIZACJA I PŁATNOŚĆ DOSTAWCY (0% PROWIZJI)",
    proformaNoticeBody:
      "Merter Vitrini nie pobiera wpłat ani prowizji. Każdy sprzedający dostawca bezpośrednio prześle Ci własną fakturę proforma i dane IBAN / SWIFT.",
    proformaNoticeHint:
      "* Każdy dostawca realizuje swoją część zamówienia; szczegóły sprawdzisz w Profil > Moje zamówienia lub przez WhatsApp.",
  },
  bg: {
    orderBankTransfer: "ИЗПРАТИ ЗАЯВКА КЪМ ДОСТАВЧИЦИТЕ",
    requestProforma: "БЪРЗА ОФЕРТА (БЕЗ АДРЕС)",
    addressPaymentTitle: "АДРЕС ЗА ДОСТАВКА И ФАКТУРИРАНЕ",
    backToCart: "Обратно към количката",
    deliveryLabel: "АДРЕС ЗА ДОСТАВКА / КАРГО",
    billingLabel: "ФИРМЕН АДРЕС ЗА ФАКТУРА",
    sameAsDeliveryLabel: "Адресът за фактуриране е същият като за доставка",
    confirmOrder: "ИЗПРАТИ КЪМ ДОСТАВЧИЦИТЕ",
    proformaNoticeTitle: "ДИРЕКТНА ПОДГОТОВКА И ПЛАЩАНЕ КЪМ ДОСТАВЧИКА (0% КОМИСИОННА)",
    proformaNoticeBody:
      "Merter Vitrini не събира плащания. Всеки продаващ доставчик директно ще ви изпрати своя проформа фактура и IBAN / SWIFT данни.",
    proformaNoticeHint:
      "* Всеки доставчик подготвя своите артикули; следете в Профил > Моите поръчки или директно в WhatsApp.",
  },
};

interface CartCheckoutSectionProps {
  readonly isCheckout: boolean;
  readonly setIsCheckout: (v: boolean) => void;
  readonly onStartCheckoutClick?: () => void;
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
  readonly supplierCount?: number;
  readonly errorMessage?: string | null;
  readonly lang: string;
}

interface CartInitialActionsProps {
  readonly onStartCheckout: () => void;
  readonly onRequestQuoteOnly: () => void;
  readonly copy: CheckoutSectionCopy;
  readonly supplierCount: number;
  readonly lang: string;
}

function CartInitialActions({
  onStartCheckout,
  onRequestQuoteOnly,
  copy,
  supplierCount,
  lang,
}: Readonly<CartInitialActionsProps>) {
  const multiCopy = getCartMultiSupplierCopy(lang);
  return (
    <div className="flex flex-col gap-3 pt-2 mt-1">
      {supplierCount > 1 && (
        <p className="text-[11px] font-bold text-[#8C6D3F] bg-[#F8F6F2] border border-[#E5E0D8] rounded-md px-3 py-2 m-0 text-center">
          {multiCopy.multiDispatchHint.replace("{count}", String(supplierCount))}
        </p>
      )}
      <button
        type="button"
        onClick={onStartCheckout}
        className="w-full py-3.5 bg-[#1C1C1C] hover:bg-salmon-pink text-white rounded-[6px] font-extrabold text-xs tracking-[0.5px] shadow-sm border-none flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors"
      >
        <span>{copy.orderBankTransfer}</span>
        <span className="text-[10px] font-semibold text-white/80">
          {multiCopy.zeroCommissionPill}
        </span>
      </button>
      <button
        type="button"
        onClick={onRequestQuoteOnly}
        className="w-full py-2.5 bg-[#FAF8F5] hover:bg-[#F1ECE3] text-[#1C1C1C] border border-[#E5E0D8] rounded-[6px] font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
      >
        📄 {copy.requestProforma}
      </button>
    </div>
  );
}

function CorporateProformaNotice({ copy }: { readonly copy: CheckoutSectionCopy }) {
  return (
    <div className="bg-[#F8F6F2] border border-[#E5E0D8] rounded-lg p-3.5 flex flex-col gap-2 text-xs text-[#1C1C1C] shadow-sm leading-relaxed">
      <div className="font-extrabold tracking-wide border-b border-[#E5E0D8] pb-1.5 text-[10.5px] text-[#1C1C1C]">
        🤝 {copy.proformaNoticeTitle}
      </div>
      <p className="text-[11px] font-semibold text-[#525252] m-0 leading-relaxed">
        {copy.proformaNoticeBody}
      </p>
      <div className="text-[10px] font-bold text-[#8C6D3F] border-t border-[#E5E0D8] pt-1.5 leading-snug">
        {copy.proformaNoticeHint}
      </div>
    </div>
  );
}

export default function CartCheckoutSection({
  isCheckout,
  setIsCheckout,
  onStartCheckoutClick,
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
  supplierCount = 0,
  errorMessage = null,
  lang,
}: Readonly<CartCheckoutSectionProps>) {
  const safeLang = normalizeSeoLang(lang, "en");
  const copy = CHECKOUT_COPY[safeLang];
  const multiCopy = getCartMultiSupplierCopy(safeLang);

  if (!isCheckout) {
    return (
      <CartInitialActions
        onStartCheckout={() => {
          onStartCheckoutClick?.();
          setIsCheckout(true);
        }}
        onRequestQuoteOnly={onRequestQuoteOnly}
        copy={copy}
        supplierCount={supplierCount}
        lang={safeLang}
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

      {supplierCount > 1 && (
        <p className="text-[11px] font-bold text-[#8C6D3F] bg-[#F8F6F2] border border-[#E5E0D8] rounded-md px-3 py-2 m-0">
          {multiCopy.multiDispatchHint.replace("{count}", String(supplierCount))}
        </p>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2"
        >
          {errorMessage}
        </div>
      )}

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
