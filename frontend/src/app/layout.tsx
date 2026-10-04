import type { Metadata } from "next";
import { Playfair_Display, Outfit } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://mertervitrini.com.tr"),
  title: {
    default: "Merter Vitrini | Türkiye Toptan B2B Tekstil & Moda Showroom",
    template: "%s | Merter Vitrini B2B",
  },
  description: "Merter'in en seçkin üreticilerinden doğrudan toptan hazır giyim ve moda alımı yapabileceğiniz çok dilli B2B dijital showroom.",
  keywords: [
    "merter toptan giyim",
    "istanbul b2b tekstil",
    "toptan kadın giyim",
    "merter vitrini",
    "wholesale clothing turkey",
    "turkish fashion wholesale",
    "merter showroom"
  ],
  authors: [{ name: "Merter Vitrini" }],
  creator: "Merter Vitrini",
  publisher: "Merter Vitrini",
  openGraph: {
    type: "website",
    locale: "tr_TR",
    url: "https://mertervitrini.com.tr",
    siteName: "Merter Vitrini B2B",
    title: "Merter Vitrini | Türkiye Toptan B2B Tekstil & Moda Showroom",
    description: "Merter'in en seçkin üreticilerinden doğrudan toptan hazır giyim ve moda alımı yapabileceğiniz çok dilli B2B dijital showroom.",
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
    description: "Merter'in en seçkin üreticilerinden doğrudan toptan hazır giyim ve moda alımı yapabileceğiniz çok dilli B2B dijital showroom.",
    images: ["/og-image.jpg"],
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className={`${playfair.variable} ${outfit.variable} h-full antialiased`}>
      <head>
        <meta name="google-site-verification" content="xEjdYBdb9A1n0WFNzuUtrntttgNCFd5IH0vy4yx8I4A" />
        <meta name="yandex-verification" content="77562ce72d424a2f" />
        {/* Google tag (gtag.js) */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-CNMNCL62Q2"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());

            gtag('config', 'G-CNMNCL62Q2');
          `}
        </Script>
      </head>
      <body className="min-h-full flex flex-col bg-white font-sans antialiased text-onyx">
        {children}
      </body>
    </html>
  );
}
