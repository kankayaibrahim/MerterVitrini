import { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/api/v1/store/feeds/"],
        disallow: [
          "/api/",
          "/admin/",
          "/tedarikci/",
          "/supplier/",
          "/profile",
          "/cart",
          "/checkout",
          "/google-callback",
        ],
      },
      {
        userAgent: "Googlebot-Image",
        allow: ["/", "/uploads/", "/_next/static/"],
      },
    ],
    sitemap: "https://mertervitrini.com.tr/sitemap.xml",
  };
}
