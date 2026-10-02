import type { Metadata } from "next";
import { Playfair_Display, Outfit } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700", "800"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://mertervitrini.com.tr"),
  title: "Merter Vitrini - Toptan B2B Tekstil E-Ticaret",
  description: "Merter'in en seçkin üreticilerinden doğrudan toptan hazır giyim alımı yapabileceğiniz B2B dijital showroom.",
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
