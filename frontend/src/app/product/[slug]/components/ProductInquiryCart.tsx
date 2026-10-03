import React from "react";
import CartDrawer, { InquiryFormData } from "@/components/store/CartDrawer";
import SuccessModal from "@/components/store/SuccessModal";
import { CartItem } from "@/types/store";
import { ExchangeRate } from "@/app/utils";

interface ProductInquiryCartProps {
  readonly isCartOpen: boolean;
  readonly setIsCartOpen: (v: boolean) => void;
  readonly cart: CartItem[];
  readonly lang: string;
  readonly totalPkgs: number;
  readonly totalItemsCount: number;
  readonly totalWeightCart: number;
  readonly totalPriceCart: number;
  
  // inquiry form state & events
  readonly submittingInquiry: boolean;
  readonly handleSubmitInquiry: (data: InquiryFormData) => void;
  readonly handleAdjustCartItemQty: (idx: number, change: number) => void;
  readonly handleRemoveCartItem: (idx: number) => void;
  
  // rates
  readonly displayCurrency: string;
  readonly exchangeRates: ExchangeRate[];

  // Success state
  readonly showSuccessOverlay: boolean;
  readonly setShowSuccessOverlay: (v: boolean) => void;
  readonly whatsappUrl: string;
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
          submittingInquiry={submittingInquiry}
          onSubmitInquiry={handleSubmitInquiry}
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
