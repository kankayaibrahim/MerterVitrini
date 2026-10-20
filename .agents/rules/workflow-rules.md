# Ajan Çalışma ve Kod Standartları Kuralları (Workflow Rules)

Bu kurallar bütünü, `mertervitrini.com.tr` deposunda kod yazan, refactor yapan veya hata ayıklayan tüm AI ajanlarının ve yazılımcıların uymakla yükümlü olduğu temel davranış ve kalite standartlarını belirler.

---

## 1. Kesin Git ve Versiyon Kontrol Kuralları (Iron Rules)

1. **ASLA İZİNSİZ COMMIT VEYA PUSH YAPMA:**
   - Kullanıcı açıkça *"commit'le"*, *"commit et"* veya *"push yap"* demedikçe **KESİNLİKLE** `git commit` veya `git push` komutlarını ÇALIŞTIRMA!
   - Yapılan tüm kod değişiklikleri, eklenen dosyalar ve refactoring işlemleri yerel çalışma dizininde (working tree) tutulmalı ve kullanıcıya açıkça raporlanarak onay istenmelidir.
2. **KULLANICI ONAY VERDİĞİNDE: COMMIT FORMATI STANDARDI:**
   - Commit mesajlarında kesinlikle **Conventional Commits** standardı uygulanmalıdır:
     - `feat: <yeni bir modül veya işlevsellik>`
     - `fix: <tespit edilen bir hatanın giderilmesi>`
     - `refactor: <davranışı değiştirmeden kodun iyileştirilmesi>`
     - `perf: <sorgu veya render hızını artıran optimizasyon>`
     - `chore: <bağımlılık, derleme veya konfigürasyon güncellemesi>`
     - `docs: <dokümantasyon veya hafıza dosyası eklenmesi>`
   - Örnek: `feat(catalog): add category translation caching mechanism`

---

## 2. Test Çalıştırma Stratejisi

1. **Gereksiz Test Çalıştırmalarından Kaçınma:**
   - Her küçük dosya düzenlemesinde, CSS düzeltmesinde veya tip güncellemesinde arka arkaya tüm test paketlerini çalıştırma.
   - Bu durum sistem kaynaklarını kilitler ve geliştirme hızını yavaşlatır.
2. **Testlerin Çalıştırılacağı Zamanlar:**
   - Yeni bir büyük özellik veya karmaşık bir iş mantığı algoritması tamamlandığında,
   - Kritik veritabanı veya yetkilendirme kodlarında değişiklik yapıldığında,
   - Kullanıcı açıkça testlerin koşulmasını talep ettiğinde.

---

## 3. Kod Kalitesi, Temiz Kod ve Bilişsel Karmaşıklık (Cognitive Complexity)

1. **Erken Çıkış (Guard Clauses & Early Return):**
   - İç içe geçmiş derin `if-else` blokları (`pyramid of doom`) yazmaktan kaçın.
   - Hata ve sınır koşullarını en başta kontrol edip fonksiyondan hemen dön:
     ```go
     // Tercih Edilen (Clean)
     if err != nil {
         return fmt.Errorf("failed to fetch product: %w", err)
     }
     if !product.IsActive {
         return ErrProductInactive
     }
     // Ana mantık burada devam eder...
     ```
2. **Fonksiyon Boyutu ve Tek Sorumluluk İlkesi (SRP):**
   - Fonksiyonlar tek bir iş yapmalı ve ideal olarak 30-40 satırı geçmemelidir.
   - Karmaşık iş akışları (örn. XML ayrıştırma, sipariş oluşturma) mantıksal alt fonksiyonlara parçalanmalıdır.
3. **Go Dili Standartları:**
   - Hataları ASLA yok sayma (`_ = doSomething()` yapma; hatayı açıkça kontrol et ve logla/dön).
   - Hataları zenginleştirerek yukarı fırlat (`fmt.Errorf("handlers.CreateOrder: %w", err)`).
   - SQL sorgularında SQL injection'ı önlemek için daima parametreli ifadeler (`$1, $2...`) kullan; dinamik string birleştirmesi (`fmt.Sprintf("SELECT... %s", val)`) yapma.
   - Eşzamanlı (goroutine) işlemlerde yarış durumlarını (race condition) önlemek için mutex veya context timeout yapılarını eksiksiz uygula.
4. **TypeScript & React Standartları:**
   - `any` tipi kullanmak kesinlikle YASAKTIR. Tüm API DTO'ları ve bileşen propları için açık tip tanımları (`interface` / `type`) yazılmalıdır.
   - React bileşenlerinde gereksiz re-render'ları önlemek için karmaşık hesaplamalarda `useMemo`, fonksiyon referanslarında `useCallback` tercih edilmelidir.
   - Modern Tailwind v4 sınıfları kullanılmalı, inline stil (`style={{...}}`) yazımından kaçınılmalıdır.
5. **Sıfır Uyarı Standardı (TreatWarningsAsErrors):**
   - Kod değişikliklerinden sonra ne Go derleyicisinde ne de TypeScript/ESLint tarafında çözülmemiş hiçbir uyarı (warning) bırakılamaz.
   - Kullanılmayan kütüphane importları, tanımlanıp okunmayan değişkenler anında temizlenmelidir.

---

## 4. Kalıcı Konuşma Kaydı Kuralı (Persistent Conversation Logging)

1. **HER KONUŞMA TURUNU KAYDETME ZORUNLULUĞU:**
   - Kullanıcı ile gerçekleşen her diyalog (kullanıcı talebi ve ajanın verdiği yanıt / yaptığı teknik işlemler), yanıt kullanıcıya sunulmadan hemen önce [`context/conversations.md`](file:///c:/Projects/mertervitrini.com.tr/context/conversations.md) dosyasına kronolojik olarak eklenmelidir (`Append`).
   - Kayıt formatı; Tarih/Saat (`YYYY-MM-DD HH:mm`), `Conversation ID`, **Kullanıcı Mesajı**, **Ajan Yanıtı / Yapılan İşlemler** ve varsa **Değiştirilen Dosyalar** başlıklarını içermelidir.
