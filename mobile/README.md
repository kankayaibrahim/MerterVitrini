# Merter Vitrini B2B — Birleşik Mobil & Windows Masaüstü Uygulaması

Tek bir Flutter kod tabanında (`com.mertervitrini.app`) hem **B2B Toptan Müşteri Mağazası (`CustomerShell`)** hem de **Tedarikçi Stüdyosu (`SupplierShell`)** rollerini barındıran, Windows Masaüstü ve Android (Google Play Store) hedeflerini destekleyen birleşik uygulama.

---

## Hızlı Kullanım (`mobile.ps1`)

Tüm derleme, Windows üzerinde çalıştırma, APK/AAB paketleme ve test işlemleri `mobile\mobile.ps1` scripti üzerinden yönetilir:

```powershell
cd C:\Projects\mertervitrini.com.tr\mobile

# İnteraktif Türkçe seçim menüsünü açar (0-9)
.\mobile.ps1

# Windows masaüstünde canlı geliştirme modunda (Hot Reload) çalıştırır
.\mobile.ps1 run

# Yerel Go Backend (http://localhost:8080) ile Windows'ta çalıştırır
.\mobile.ps1 run -Local

# Windows Release .exe derler ve derleme biter bitmez uygulamayı açar
.\mobile.ps1 build-run-win

# Daha önce derlenmiş Windows .exe uygulamasını beklemeden açar
.\mobile.ps1 open-win

# İmzalı Android Release APK üretir (-OpenFolder ile klasörü açar)
.\mobile.ps1 apk -OpenFolder

# Tam Google Play Store yayın paketi (flutter analyze + test + .aab + .apk)
.\mobile.ps1 release

# Statik kod analizi ve SOLID DI birim testlerini çalıştırır
.\mobile.ps1 check
```
