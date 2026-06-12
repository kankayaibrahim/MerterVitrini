import React from "react";
import CartDrawer from "@/components/store/CartDrawer";
import SuccessModal from "@/components/store/SuccessModal";
import { CartItem } from "@/types/store";
import { ExchangeRate } from "@/app/utils";

interface ProductInquiryCartProps {
  isCartOpen: boolean;
  setIsCartOpen: (v: boolean) => void;
  cart: CartItem[];
  lang: string;
  totalPkgs: number;
  totalItemsCount: number;
  totalWeightCart: number;
  totalPriceCart: number;
  
  // inquiry form state & events
  fullName: string;
  setFullName: (v: string) => void;
  companyName: string;
  setCompanyName: (v: string) => void;
  phoneNumber: string;
  setPhoneNumber: (v: string) => void;
  emailAddress: string;
  setEmailAddress: (v: string) => void;
  customerMessage: string;
  setCustomerMessage: (v: string) => void;
  submittingInquiry: boolean;
  handleSubmitInquiry: (e: React.FormEvent) => void;
  handleAdjustCartItemQty: (idx: number, change: number) => void;
  handleRemoveCartItem: (idx: number) => void;
  
  // rates
  displayCurrency: string;
  exchangeRates: ExchangeRate[];

  // Success state
  showSuccessOverlay: boolean;
  setShowSuccessOverlay: (v: boolean) => void;
  whatsappUrl: string;
}

export default function ProductInquiryCart({
  isCartOpen,
  setIsCartOpen,
  cart,
  lang,
  totalPkgs,
  totalItemsCount,
  totalWeightCart,
  totalPriceCart,
  fullName,
  setFullName,
  companyName,
  setCompanyName,
  phoneNumber,
  setPhoneNumber,
  emailAddress,
  setEmailAddress,
  customerMessage,
  setCustomerMessage,
  submittingInquiry,
  handleSubmitInquiry,
  handleAdjustCartItemQty,
  handleRemoveCartItem,
  displayCurrency,
  exchangeRates,
  showSuccessOverlay,
  setShowSuccessOverlay,
  whatsappUrl,
}: ProductInquiryCartProps) {
  return (
    <>
      {/* Cart Drawer */}
      {isCartOpen && (
        <CartDrawer
          lang={lang}
          cart={cart}
          onClose={() => setIsCartOpen(false)}
          onAdjustQty={handleAdjustCartItemQty}
          onRemove={handleRemoveCartItem}
          totalPkgs={totalPkgs}
          totalItemsCount={totalItemsCount}
          totalWeight={totalWeightCart}
          totalPrice={totalPriceCart}
          fullName={fullName}
          setFullName={setFullName}
          companyName={companyName}
          setCompanyName={setCompanyName}
          phoneNumber={phoneNumber}
          setPhoneNumber={setPhoneNumber}
          emailAddress={emailAddress}
          setEmailAddress={setEmailAddress}
          customerMessage={customerMessage}
          setCustomerMessage={setCustomerMessage}
          submittingInquiry={submittingInquiry}
          onSubmit={handleSubmitInquiry}
          displayCurrency={displayCurrency}
          exchangeRates={exchangeRates}
        />
      )}

      {/* Inquiry Success Confirmation overlay */}
      {showSuccessOverlay && (
        <SuccessModal
          lang={lang}
          whatsappUrl={whatsappUrl}
          onClose={() => setShowSuccessOverlay(false)}
        />
      )}
    </>
  );
}
