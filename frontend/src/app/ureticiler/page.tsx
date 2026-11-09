import React from "react";
import type { Metadata } from "next";
import SuppliersDirectoryClient from "./SuppliersDirectoryClient";

export const metadata: Metadata = {
  title: "Merter Doğrulanmış Üretici & Toptan Giyim Firmaları Rehberi | Merter Vitrini",
  description:
    "Merter tekstil piyasasının doğrulanmış üretici, toptan hazır giyim, Private Label ve fason üretim firmaları rehberi. %0 komisyonla doğrudan üreticiyle iletişime geçin.",
};

export default function SuppliersDirectoryPage() {
  return <SuppliersDirectoryClient />;
}

