import type { Metadata } from "next";
import { Suspense } from "react";
import SupplierLoginClient from "./SupplierLoginClient";

export const metadata: Metadata = {
  title: "Tedarikçi Girişi | Merter Vitrini B2B Tedarikçi Portalı",
  description: "Merter Vitrini toptancı tedarikçi giriş ve ürün yönetim paneli",
  robots: {
    index: false,
    follow: false,
  },
};

export default function SupplierLoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-8 h-8 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SupplierLoginClient />
    </Suspense>
  );
}
