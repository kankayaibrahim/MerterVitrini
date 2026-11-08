import type { Metadata } from "next";
import AccountDeletionClient from "./AccountDeletionClient";

export const metadata: Metadata = {
  title: "Hesap ve Veri Silme Merkezi",
  description:
    "Merter Vitrini B2B mobil uygulaması ve web platformu için Google Play Veri Güvenliği uyumlu hesap ve kişisel veri silme merkezi.",
  robots: {
    index: true,
    follow: true,
  },
};

export default function AccountDeletionPage() {
  return <AccountDeletionClient />;
}

