import type { Metadata } from "next";
import { Suspense } from "react";
import { headers } from "next/headers";
import { Playfair_Display, Outfit, Noto_Sans_Arabic } from "next/font/google";
import Script from "next/script";
import { AnalyticsTracker } from "@/components/analytics/AnalyticsTracker";
import {
  GLOBAL_B2B_SEO_MATRIX,
  normalizeSeoLang,
  SITE_ORIGIN,
  type SupportedSeoLang,
} from "@/utils/seoHelpers";
import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const notoSansArabic = Noto_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: false,
});

function sanitizeVerificationToken(
  envVal: string | undefined,
  fallbackToken: string
): string | null {
  const candidate = (envVal ?? fallbackToken).trim();
  if (
    !candidate ||
    candidate === "google-site-verification-id" ||
    candidate === "yandex-verification-id"
  ) {
    return null;
  }
  return candidate;
}

async function resolveHtmlLang(): Promise<SupportedSeoLang> {
  try {
    const reqHeaders = await headers();
    const headerLang = reqHeaders.get("x-mv-lang");
    return normalizeSeoLang(headerLang, "tr");
  } catch {
    return "tr";
  }
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: {
    default: "Merter Vitrini | Türkiye Toptan B2B Tekstil & Moda Showroom",
    template: "%s | Merter Vitrini B2B",
  },
  description: GLOBAL_B2B_SEO_MATRIX.tr.portalDescription,
  keywords: [
    "merter toptan giyim",
    "istanbul b2b tekstil üreticileri",
    "seri toptan kadın giyim",
    "wholesale clothing turkey merter istanbul",
    "одежда оптом из турции мертер стамбул",
    "ملابس تركية بالجملة مارتر إسطنبول",
    "großhandel damenmode türkei merter",
    "grossiste vêtement femme turquie merter",
    "hurtownia odzieży tureckiej merter stambuł",
    "дрехи на едро от турция мертер истанбул",
  ],
  authors: [{ name: "Merter Vitrini" }],
  creator: "Merter Vitrini",
  publisher: "Merter Vitrini",
  openGraph: {
    type: "website",
    locale: "tr_TR",
    url: SITE_ORIGIN,
    siteName: "Merter Vitrini B2B",
    title: "Merter Vitrini | Türkiye Toptan B2B Tekstil & Moda Showroom",
    description: GLOBAL_B2B_SEO_MATRIX.tr.portalDescription,
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Merter Vitrini B2B Toptan Tekstil Showroom",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Merter Vitrini | Türkiye Toptan B2B Tekstil & Moda Showroom",
    description: GLOBAL_B2B_SEO_MATRIX.tr.portalDescription,
    images: ["/og-image.jpg"],
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const htmlLang = await resolveHtmlLang();
  const htmlDir = htmlLang === "ar" ? "rtl" : "ltr";

  const googleVerification = sanitizeVerificationToken(
    process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
    "xEjdYBdb9A1n0WFNzuUtrntttgNCFd5IH0vy4yx8I4A"
  );
  const yandexVerification = sanitizeVerificationToken(
    process.env.NEXT_PUBLIC_YANDEX_VERIFICATION,
    "77562ce72d424a2f"
  );

  return (
    <html
      lang={htmlLang}
      dir={htmlDir}
      className={`${playfair.variable} ${outfit.variable} ${notoSansArabic.variable} h-full antialiased`}
    >
      <head>
        {googleVerification && (
          <meta
            name="google-site-verification"
            content={googleVerification}
          />
        )}
        {yandexVerification && (
          <meta name="yandex-verification" content={yandexVerification} />
        )}
        {/* Google tag (gtag.js) — storefront only, skips /admin & /supplier */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-CNMNCL62Q2"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            if (!window.location.pathname.startsWith('/admin') && !window.location.pathname.startsWith('/supplier')) {
              gtag('js', new Date());
              gtag('config', 'G-CNMNCL62Q2');
            }
          `}
        </Script>
      </head>
      <body className="min-h-full flex flex-col bg-white font-sans antialiased text-onyx">
        <Suspense fallback={null}>
          <AnalyticsTracker />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
