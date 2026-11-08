import type { Metadata } from "next";
import MobileAppDownloadClient from "./MobileAppDownloadClient";

export const metadata: Metadata = {
  title: "Mobil Uygulama İndir (Android APK) | Merter Vitrini B2B",
  description:
    "Merter Vitrini B2B Toptan Giyim Mağazası ve Tedarikçi Kamera Stüdyosu resmi Android uygulamasını indirin. Otomatik uygulama içi güncelleme (OTA) destekli.",
  robots: {
    index: true,
    follow: true,
  },
};

export default function MobileAppDownloadPage() {
  return <MobileAppDownloadClient />;
}

