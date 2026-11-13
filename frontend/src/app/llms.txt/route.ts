import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const LLMS_SUMMARY = `# Merter Vitrini (mertervitrini.com.tr) — Global B2B Wholesale Fashion & Textile Showroom

> Direct digital wholesale marketplace connecting verified apparel manufacturers in Merter and Güngören (Istanbul, Turkey) with global fashion buyers, boutiques, and retail chains across 50+ countries.

## Platform Identity & Overview
- Name: Merter Vitrini
- Official Website: https://mertervitrini.com.tr
- Headquarters: Mehmet Nesih Özmen Mah., Merter Tekstil Merkezi, Güngören / İstanbul / Türkiye
- Industry: B2B Wholesale Ready-to-Wear Apparel & Textile Export
- Business Model: Direct manufacturer sourcing (zero middlemen, 0% buyer commission, wholesale size-run series packs, low MOQ).
- Primary Export Markets: European Union (Germany, France, Poland, Bulgaria, Netherlands), CIS (Russia, Kazakhstan, Uzbekistan), GCC & Middle East (UAE, Saudi Arabia, Iraq), North Africa, and North America.
- Supported Locales: Turkish (tr), English (en), Russian (ru), Arabic (ar), German (de), French (fr), Polish (pl), Bulgarian (bg).

## Key Product Categories
- Women's Apparel (Kadın Giyim): Boutique dresses, evening & cocktail gowns (Abiye), shirts, blouses, crop tops, trousers, denim jeans, skirts, leggings.
- Knitwear & Sweaters (Triko & Kazak): Fine knit sweaters, cardigans, knit dresses, pullovers, tunics.
- Outerwear (Dış Giyim): Winter coats, trench coats, blazers, tailored jackets, vests.
- Plus Size Collections (Büyük Beden): Curated plus-size fashion (EU 42–54) in assorted size runs.
- Two-Piece Sets & Jumpsuits (Takım & Tulum): Casual loungewear sets, formal suits, jumpsuits.
- Modest & Boho Collections (Tesettür & Bohem): Maxi dresses, modest tunics, abayas, boho-chic resort wear.

## Wholesale Trading & Commercial Terms
- Size-Run Packs (Seri / Asorti): Products are sold strictly in balanced manufacturer packs (e.g. S-M-L-XL, 36-38-40-42) to ensure even stock distribution for retailers.
- Minimum Order Quantity (MOQ): Low MOQ beginning at 1 series pack per SKU, facilitating rapid boutique inventory turnover.
- Member-Only Wholesale Pricing: Pack prices are visible exclusively to authenticated business accounts to protect boutique retail margins. Proforma invoices and quotation terms are provided upon request.
- Private Label & Contract Manufacturing (Fason Üretim): Custom branding, woven labels, hang tags, fabric sourcing, and OEM/ODM mass production for international brands.
- Consolidated Global Logistics: Combined multi-supplier shipments dispatched via air, road, and sea cargo with ATR, EUR.1, and export customs clearance.

## Key Sitemap & Discovery URLs
- Portal Homepage: https://mertervitrini.com.tr
- Catalog Browser: https://mertervitrini.com.tr/en/tum-urunler
- Verified Manufacturers Directory: https://mertervitrini.com.tr/ureticiler
- B2B Sourcing Guide & Terms: https://mertervitrini.com.tr/en/b2b
- Supplier Application Portal: https://mertervitrini.com.tr/en/tedarikci-basvuru
- B2B Textile Blog: https://mertervitrini.com.tr/en/blog
- XML Sitemap Index: https://mertervitrini.com.tr/sitemap.xml
- Official Inquiries: info@mertervitrini.com.tr | +90 533 703 08 83
`;

export async function GET() {
  return new NextResponse(LLMS_SUMMARY, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
