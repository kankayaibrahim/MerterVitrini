import type { Metadata } from "next";
import ServiceProvidersClient from "./ServiceProvidersClient";

export const metadata: Metadata = {
  title:
    "Sektörel Hizmet Sağlayıcılar Rehberi — Kargo, Fotoğraf Stüdyosu, Etiket, Modelhane & İhracat | Merter Vitrini",
  description:
    "Merter toptan tekstil ekosistemi için doğrulanmış uluslararası kargo/lojistik firmaları, mankenli katalog çekim stüdyoları, dokuma etiket/ambalaj üreticileri, dijital modelhaneler ve ihracat danışmanları rehberi.",
  alternates: {
    canonical: "https://mertervitrini.com.tr/hizmet-saglayicilar",
  },
};

export default function ServiceProvidersDirectoryPage() {
  return <ServiceProvidersClient />;
}

