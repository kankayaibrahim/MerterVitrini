import type { Metadata } from "next";
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
  return <SupplierLoginClient />;
}
