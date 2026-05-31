import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
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
    <html lang="tr" className={`${poppins.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-white font-sans antialiased text-onyx">
        {children}
      </body>
    </html>
  );
}
