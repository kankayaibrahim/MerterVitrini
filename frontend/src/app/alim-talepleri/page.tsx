import React from "react";
import type { Metadata } from "next";
import BuyerRfqBoardClient from "./BuyerRfqBoardClient";

export const metadata: Metadata = {
  title: "Alıcı Talep Panosu (B2B Alım İlanları / RFQ) | Merter Vitrini",
  description:
    "Küresel toptan giyim alıcılarının hazır stok, Private Label ve fason üretim alım ilanları (RFQ). Alım talebi açın, doğrulanmış Merter üreticilerinden doğrudan teklif alın.",
};

export default function BuyerRfqBoardPage() {
  return <BuyerRfqBoardClient />;
}

