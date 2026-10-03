import { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin/",
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
