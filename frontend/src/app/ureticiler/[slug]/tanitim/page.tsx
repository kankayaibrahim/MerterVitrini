import React from "react";
import type { Metadata } from "next";
import SupplierEditorialProfileClient from "./SupplierEditorialProfileClient";

interface SupplierEditorialPageProps {
  readonly params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: SupplierEditorialPageProps): Promise<Metadata> {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug);
  return {
    title: `${decoded.toUpperCase()} — Firma Tanıtımı, Üretim Gücü & Toptan Alım Rehberi | Merter Vitrini`,
    description: `${decoded} üretici ve toptan hazır giyim firmasının Merter üretim standartları, koleksiyon yapısı, ihracat bölgeleri ve doğrudan imalatçıdan toptan sipariş rehberi.`,
  };
}

export default async function SupplierEditorialPage({
  params,
}: SupplierEditorialPageProps) {
  const { slug } = await params;
  return <SupplierEditorialProfileClient slug={decodeURIComponent(slug)} />;
}

