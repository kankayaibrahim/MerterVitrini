import { NextResponse } from "next/server";
import { generateSitemaps } from "../sitemap";
import { SITE_ORIGIN } from "@/utils/seoHelpers";

export const dynamic = "force-dynamic";

export async function GET() {
  const sitemaps = await generateSitemaps();
  const now = new Date().toISOString();

  const xmlEntries = sitemaps
    .map(
      (item) => `  <sitemap>
    <loc>${SITE_ORIGIN}/sitemap/${item.id}.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xmlEntries}
</sitemapindex>`;

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
