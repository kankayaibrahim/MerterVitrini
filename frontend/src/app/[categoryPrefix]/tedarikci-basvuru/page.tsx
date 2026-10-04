import React from "react";
import type { Metadata } from "next";
import SupplierApplicationClient from "./SupplierApplicationClient";

export const metadata: Metadata = {
  title: "Toptan Tedarikçi Başvuru Formu | Merter Vitrini B2B",
  description: "Merter Vitrini B2B tekstil ve hazır giyim platformunda toptan satış yapmak, markanızı 100+ ülkeye ulaştırmak için tedarikçi başvuru formunu doldurun.",
  alternates: {
    canonical: "https://mertervitrini.com.tr/tr/tedarikci-basvuru",
  },
  openGraph: {
    title: "Toptan Tedarikçi Başvuru Formu | Merter Vitrini B2B",
    description: "Merter Vitrini B2B tekstil ve hazır giyim platformunda toptan satış yapmak için tedarikçi başvuru formunu doldurun.",
    url: "https://mertervitrini.com.tr/tr/tedarikci-basvuru",
    type: "website",
  },
};

interface PageProps {
  params: Promise<{
    categoryPrefix: string;
  }>;
}

export default async function SupplierApplicationPage({ params }: Readonly<PageProps>) {
  const { categoryPrefix } = await params;
  return <SupplierApplicationClient lang={categoryPrefix || "tr"} />;
}
