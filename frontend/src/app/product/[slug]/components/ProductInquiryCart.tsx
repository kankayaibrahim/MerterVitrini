import React from "react";
import CartDrawer, { InquiryFormData } from "@/components/store/CartDrawer";
import SuccessModal from "@/components/store/SuccessModal";
import { CartItem, SupplierDirectOrderSummary } from "@/types/store";
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
  readonly handleSubmitInquiry: (data: InquiryFormData) => void | Promise<void>;
  readonly handleAdjustCartItemQty: (idx: number, change: number) => void;
  readonly handleRemoveCartItem: (idx: number) => void;
  readonly onOrderCreated?: (result: {
    readonly orderNumber: string;
    readonly supplierOrders: SupplierDirectOrderSummary[];
  }) => void;
  
  // rates
  readonly displayCurrency: string;
  readonly exchangeRates: ExchangeRate[];

  // Success state
  readonly showSuccessOverlay: boolean;
  readonly setShowSuccessOverlay: (v: boolean) => void;
  readonly whatsappUrl: string;
  readonly orderNumber?: string;
  readonly supplierOrders?: readonly SupplierDirectOrderSummary[];
  readonly isFormalOrder?: boolean;
  readonly onViewOrders?: () => void;
  readonly onWhatsappClick?: () => void;
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
  onOrderCreated,
  displayCurrency,
  exchangeRates,
  showSuccessOverlay,
  setShowSuccessOverlay,
  whatsappUrl,
  orderNumber,
  supplierOrders,
  isFormalOrder,
  onViewOrders,
  onWhatsappClick,
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
          onOrderCreated={onOrderCreated}
          displayCurrency={displayCurrency}
          exchangeRates={exchangeRates}
        />
      )}

      {/* Inquiry Success Confirmation overlay */}
      {showSuccessOverlay && (
        <SuccessModal
          lang={lang}
          whatsappUrl={whatsappUrl}
          orderNumber={orderNumber}
          supplierOrders={supplierOrders}
          isFormalOrder={isFormalOrder}
          onViewOrders={onViewOrders}
          onWhatsappClick={onWhatsappClick}
          onClose={() => setShowSuccessOverlay(false)}
        />
      )}
    </>
  );
}
