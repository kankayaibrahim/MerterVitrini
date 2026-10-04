import type { Metadata } from "next";
import { AdminProvider } from "@/context/AdminContext";
import AdminShell from "@/components/admin/layout/AdminShell";

export const metadata: Metadata = {
  title: "Yönetim Paneli | Merter Vitrini Admin Suite",
  description: "Merter Vitrini B2B Toptan E-Ticaret Yönetim ve Entegrasyon Paneli",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AdminProvider>
      <AdminShell>{children}</AdminShell>
    </AdminProvider>
  );
}
