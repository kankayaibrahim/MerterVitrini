import type { Metadata } from "next";
import SupplierDashboardClient from "./SupplierDashboardClient";

export const metadata: Metadata = {
  title: "Tedarikçi Paneli | Merter Vitrini B2B Tedarikçi Portalı",
  description: "Merter Vitrini toptancı tedarikçi ürün ve katalog yönetim paneli",
  robots: {
    index: false,
    follow: false,
  },
};

export default function SupplierDashboardPage() {
  return <SupplierDashboardClient />;
}
