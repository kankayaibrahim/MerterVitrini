import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "@/utils/seoHelpers";

export const dynamic = "force-static";

const DISALLOW_PATHS: string[] = [
  "/admin",
  "/admin/",
  "/supplier",
  "/supplier/",
  "/tedarikci",
  "/tedarikci/",
  "/api/",
  "/profile",
  "/*/profile",
  "/cart",
  "/*/cart",
  "/checkout",
  "/*/checkout",
  "/google-callback",
  "/*?*sort_by=",
  "/*?*min_price=",
  "/*?*max_price=",
];

const YANDEX_CLEAN_PARAM =
  "utm_source&utm_medium&utm_campaign&utm_term&utm_content&gclid&fbclid&yclid";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/api/v1/store/feeds/"],
        disallow: DISALLOW_PATHS,
      },
      {
        userAgent: "Yandex",
        allow: ["/", "/api/v1/store/feeds/"],
        disallow: DISALLOW_PATHS,
      },
      {
        userAgent: "Googlebot-Image",
        allow: ["/", "/uploads/", "/_next/static/"],
      },
    ],
    host: `${SITE_ORIGIN}\nClean-param: ${YANDEX_CLEAN_PARAM}`,
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  };
}
