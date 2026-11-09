import React from "react";
import type { Metadata } from "next";
import SupplierShowcaseClient from "./SupplierShowcaseClient";

interface SupplierShowcasePageProps {
  readonly params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: SupplierShowcasePageProps): Promise<Metadata> {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug);
  return {
    title: `${decoded.toUpperCase()} — Doğrulanmış Merter Üretici Vitrini | Merter Vitrini`,
    description: `${decoded} üretici ve toptan giyim firmasının Merter Vitrini üzerindeki açık iletişim bilgileri, WhatsApp sipariş hattı ve %0 komisyonlu toptan koleksiyonu.`,
  };
}

export default async function SupplierShowcasePage({
  params,
}: SupplierShowcasePageProps) {
  const { slug } = await params;
  return <SupplierShowcaseClient slug={decodeURIComponent(slug)} />;
}

