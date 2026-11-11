package mailer

import (
	"bytes"
	"crypto/rand"
	"crypto/tls"
	"encoding/hex"
	"fmt"
	"html"
	"log"
	"mime"
	"net"
	"net/smtp"
	"net/url"
	"strings"
	"time"

	"mertervitrini/backend/config"
	"mertervitrini/backend/pkg/safe"
)

const (
	defaultAdminEmail = "kankayaibrahim@gmail.com"
	dateTimeFormatTR  = "02.01.2006 15:04"
)

// SupplierApplicationData encapsulates fields submitted through public supplier application form
type SupplierApplicationData struct {
	CompanyName string
	ContactName string
	Email       string
	Phone       string
	City        string
	District    string
	Category    string
	Instagram   string
	Website     string
	Notes       string
}

// SendRawMail sends an email via the configured SMTP server (e.g., local Postfix)
func SendRawMail(cfg *config.Config, to, subject, htmlBody, textBody string) error {
	host := cfg.SMTPHost
	if host == "" {
		host = "127.0.0.1"
	}
	port := cfg.SMTPPort
	if port == "" {
		port = "25"
	}
	addr := net.JoinHostPort(host, port)

	fromEmail := cfg.SMTPFrom
	if fromEmail == "" {
		fromEmail = "destek@mertervitrini.com.tr"
	}
	fromHeader := fmt.Sprintf("Merter Vitrini <%s>", fromEmail)

	randomBytes := make([]byte, 12)
	_, _ = rand.Read(randomBytes)
	boundary := "=_mv_" + hex.EncodeToString(randomBytes)
	msgID := fmt.Sprintf("<%d.%s@mertervitrini.com.tr>", time.Now().UnixNano(), hex.EncodeToString(randomBytes[:6]))

	encodedSubject := mime.BEncoding.Encode("utf-8", subject)

	var msg bytes.Buffer
	msg.WriteString(fmt.Sprintf("From: %s\r\n", fromHeader))
	msg.WriteString(fmt.Sprintf("To: %s\r\n", to))
	msg.WriteString(fmt.Sprintf("Subject: %s\r\n", encodedSubject))
	msg.WriteString(fmt.Sprintf("Date: %s\r\n", time.Now().Format(time.RFC1123Z)))
	msg.WriteString(fmt.Sprintf("Message-ID: %s\r\n", msgID))
	msg.WriteString("MIME-Version: 1.0\r\n")
	msg.WriteString(fmt.Sprintf("Content-Type: multipart/alternative; boundary=\"%s\"\r\n", boundary))
	msg.WriteString("\r\n")

	// Plain text part
	msg.WriteString(fmt.Sprintf("--%s\r\n", boundary))
	msg.WriteString("Content-Type: text/plain; charset=UTF-8\r\n")
	msg.WriteString("Content-Transfer-Encoding: 8bit\r\n\r\n")
	msg.WriteString(textBody)
	msg.WriteString("\r\n\r\n")

	// HTML part
	msg.WriteString(fmt.Sprintf("--%s\r\n", boundary))
	msg.WriteString("Content-Type: text/html; charset=UTF-8\r\n")
	msg.WriteString("Content-Transfer-Encoding: 8bit\r\n\r\n")
	msg.WriteString(htmlBody)
	msg.WriteString("\r\n\r\n")

	// End boundary
	msg.WriteString(fmt.Sprintf("--%s--\r\n", boundary))

	// Connect to SMTP with custom TLS handler to avoid loopback certificate mismatch
	conn, err := net.DialTimeout("tcp", addr, 10*time.Second)
	if err != nil {
		log.Printf("[MAILER ERROR] Failed to connect to SMTP %s: %v", addr, err)
		return err
	}

	client, err := smtp.NewClient(conn, host)
	if err != nil {
		conn.Close()
		log.Printf("[MAILER ERROR] Failed to create SMTP client: %v", err)
		return err
	}
	defer client.Close()

	if ok, _ := client.Extension("STARTTLS"); ok {
		tlsConfig := &tls.Config{
			ServerName:         host,
			InsecureSkipVerify: true,
		}
		if err := client.StartTLS(tlsConfig); err != nil {
			log.Printf("[MAILER ERROR] STARTTLS failed: %v", err)
			return err
		}
	}

	if err := client.Mail(fromEmail); err != nil {
		log.Printf("[MAILER ERROR] MAIL FROM failed for %s: %v", fromEmail, err)
		return err
	}

	if err := client.Rcpt(to); err != nil {
		log.Printf("[MAILER ERROR] RCPT TO failed for %s: %v", to, err)
		return err
	}

	w, err := client.Data()
	if err != nil {
		log.Printf("[MAILER ERROR] DATA command failed: %v", err)
		return err
	}

	if _, err := w.Write(msg.Bytes()); err != nil {
		log.Printf("[MAILER ERROR] Write body failed: %v", err)
		return err
	}

	if err := w.Close(); err != nil {
		log.Printf("[MAILER ERROR] Close data writer failed: %v", err)
		return err
	}

	_ = client.Quit()

	log.Printf("[MAILER SUCCESS] Email delivered to SMTP queue for: %s (subject: %s)", to, subject)
	return nil
}

func cleanPhoneForWhatsApp(phone string) string {
	digits := ""
	for _, r := range phone {
		if r >= '0' && r <= '9' {
			digits += string(r)
		}
	}
	if strings.HasPrefix(digits, "0") && len(digits) == 11 {
		digits = "9" + digits
	} else if len(digits) == 10 {
		digits = "90" + digits
	}
	return digits
}

func formatGeoLocationHTML(meta ClientMeta) string {
	flag := CountryCodeToFlag(meta.CountryCode)
	locParts := []string{}
	if meta.City != "" && meta.City != "Bilinmiyor" {
		locParts = append(locParts, meta.City)
	}
	if meta.RegionName != "" && meta.RegionName != meta.City && meta.RegionName != "Bilinmiyor" {
		locParts = append(locParts, meta.RegionName)
	}
	if meta.Country != "" && meta.Country != "Bilinmiyor" {
		locParts = append(locParts, meta.Country)
	}
	locationText := strings.Join(locParts, ", ")
	if locationText == "" {
		locationText = "Konum Belirlenemedi"
	}

	ispText := meta.ISP
	if meta.Org != "" && meta.Org != meta.ISP {
		if ispText != "" {
			ispText += " (" + meta.Org + ")"
		} else {
			ispText = meta.Org
		}
	}
	if ispText == "" {
		ispText = "Bilinmiyor"
	}

	deviceText := fmt.Sprintf("%s • %s", meta.Device, meta.Browser)

	return fmt.Sprintf(`
    <div style="margin-top: 24px; background: #f1f5f9; border-radius: 12px; padding: 18px; border: 1px solid #e2e8f0;">
      <div style="font-size: 11px; font-weight: 800; color: #475569; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
        🛡️ GÜVENLİK, AĞ VE COĞRAFİ KONUM ANALİZİ
      </div>
      <table style="width: 100%%; font-size: 12px; line-height: 1.7; border-collapse: collapse;">
        <tr>
          <td style="color: #64748b; width: 34%%; padding: 3px 0;"><strong>📍 Konum / Bölge:</strong></td>
          <td style="color: #0f172a; font-weight: 700; padding: 3px 0;">%s %s</td>
        </tr>
        <tr>
          <td style="color: #64748b; padding: 3px 0;"><strong>🌐 İstemci IP Adresi:</strong></td>
          <td style="color: #0284c7; font-family: monospace; font-size: 13px; font-weight: 700; padding: 3px 0;">%s</td>
        </tr>
        <tr>
          <td style="color: #64748b; padding: 3px 0;"><strong>🏢 İnternet Sağlayıcı (ISP):</strong></td>
          <td style="color: #334155; padding: 3px 0;">%s</td>
        </tr>
        <tr>
          <td style="color: #64748b; padding: 3px 0;"><strong>💻 Cihaz & Tarayıcı:</strong></td>
          <td style="color: #334155; padding: 3px 0;">%s</td>
        </tr>
      </table>
    </div>`, flag, html.EscapeString(locationText), html.EscapeString(meta.IP), html.EscapeString(ispText), html.EscapeString(deviceText))
}

// SendSupplierApplicationNotification notifies admin when a supplier fills out public onboarding form
func SendSupplierApplicationNotification(cfg *config.Config, app SupplierApplicationData, meta ClientMeta) {
	adminEmail := cfg.AdminEmail
	if adminEmail == "" {
		adminEmail = defaultAdminEmail
	}

	safe.Go("NotifyAdminSupplierApplication", func() {
		subject := fmt.Sprintf("🏢 Yeni Tedarikçi Başvurusu: %s (%s)", app.CompanyName, app.ContactName)
		nowStr := time.Now().Format(dateTimeFormatTR)
		geoHTML := formatGeoLocationHTML(meta)
		cleanPhone := cleanPhoneForWhatsApp(app.Phone)

		cityDistrict := app.City
		if app.District != "" {
			if cityDistrict != "" {
				cityDistrict = fmt.Sprintf("%s / %s", cityDistrict, app.District)
			} else {
				cityDistrict = app.District
			}
		}

		textBody := fmt.Sprintf(`Sayın Yönetici,

Web sitesi üzerinden yeni bir Tedarikçi Başvuru Formu dolduruldu:

• Firma Adı: %s
• Yetkili: %s
• E-Posta: %s
• Telefon: %s
• İl / İlçe: %s
• Kategori: %s
• Instagram: %s
• Web Sitesi: %s
• Notlar: %s

Güvenlik / Ağ Bilgisi:
• IP: %s
• Konum: %s, %s
• ISP: %s
• Cihaz: %s (%s)
• Tarih: %s

Tedarikçi Başvurularını Yönetmek İçin: https://mertervitrini.com.tr/admin/supplier-applications

Merter Vitrini Bildirim Servisi`,
			app.CompanyName, app.ContactName, app.Email, app.Phone, cityDistrict, app.Category, app.Instagram, app.Website, app.Notes,
			meta.IP, meta.City, meta.Country, meta.ISP, meta.Device, meta.Browser, nowStr)

		htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; padding: 24px 12px; color: #1e293b; margin: 0;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #cbd5e1; padding: 32px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.07);">
    
    <!-- Brand Header -->
    <div style="text-align: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 18px; margin-bottom: 24px;">
      <h2 style="color: #0f172a; margin: 0; font-size: 24px; font-weight: 900; letter-spacing: -0.5px;">MERTER VİTRİNİ</h2>
      <p style="color: #d97706; font-size: 11px; font-weight: 800; letter-spacing: 2px; margin: 4px 0 0 0; text-transform: uppercase;">B2B Tedarikçi Başvuru Bildirimi</p>
    </div>

    <!-- Badge -->
    <div style="margin-bottom: 20px;">
      <span style="display: inline-block; background-color: #fef3c7; color: #92400e; font-size: 12px; font-weight: 800; padding: 6px 14px; border-radius: 9999px; border: 1px solid #fde68a;">
        🏢 Yeni Tedarikçi Başvurusu Alındı
      </span>
    </div>

    <h3 style="color: #0f172a; margin: 0 0 8px 0; font-size: 20px; font-weight: 800;">%s</h3>
    <p style="font-size: 14px; color: #64748b; margin: 0 0 20px 0;">Yetkili: <strong style="color: #0f172a;">%s</strong> tarafından web sitesi başvuru formu üzerinden iletildi.</p>

    <!-- Details Card -->
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; margin-bottom: 20px;">
      <table style="width: 100%%; font-size: 13px; line-height: 1.8; border-collapse: collapse;">
        <tr>
          <td style="color: #64748b; width: 32%%; padding: 4px 0;"><strong>🏢 Firma Adı:</strong></td>
          <td style="color: #0f172a; font-weight: 700; padding: 4px 0;">%s</td>
        </tr>
        <tr>
          <td style="color: #64748b; padding: 4px 0;"><strong>👤 Yetkili Kişi:</strong></td>
          <td style="color: #0f172a; font-weight: 600; padding: 4px 0;">%s</td>
        </tr>
        <tr>
          <td style="color: #64748b; padding: 4px 0;"><strong>✉️ E-Posta:</strong></td>
          <td style="padding: 4px 0;"><a href="mailto:%s" style="color: #0284c7; text-decoration: underline; font-weight: 600;">%s</a></td>
        </tr>
        <tr>
          <td style="color: #64748b; padding: 4px 0;"><strong>📞 Telefon:</strong></td>
          <td style="color: #0f172a; font-weight: 600; padding: 4px 0;"><a href="tel:%s" style="color: #0f172a; text-decoration: none;">%s</a></td>
        </tr>
        <tr>
          <td style="color: #64748b; padding: 4px 0;"><strong>📍 İl / İlçe:</strong></td>
          <td style="color: #0f172a; font-weight: 600; padding: 4px 0;">%s</td>
        </tr>
        <tr>
          <td style="color: #64748b; padding: 4px 0;"><strong>🏷️ Ürün Kategorisi:</strong></td>
          <td style="color: #0f172a; padding: 4px 0;">%s</td>
        </tr>
        <tr>
          <td style="color: #64748b; padding: 4px 0;"><strong>📸 Instagram:</strong></td>
          <td style="color: #0284c7; padding: 4px 0;">%s</td>
        </tr>
        <tr>
          <td style="color: #64748b; padding: 4px 0;"><strong>🌐 Web Sitesi:</strong></td>
          <td style="color: #0284c7; padding: 4px 0;">%s</td>
        </tr>
        <tr>
          <td style="color: #64748b; padding: 4px 0; vertical-align: top;"><strong>📝 Notlar:</strong></td>
          <td style="color: #334155; padding: 4px 0; background: #ffffff; padding: 8px 12px; border-radius: 8px; border: 1px solid #e2e8f0;">%s</td>
        </tr>
      </table>
    </div>

    <!-- Geo & Network Analysis Box -->
    %s

    <!-- Quick Action Buttons -->
    <div style="margin-top: 28px; text-align: center; display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
      <a href="https://mertervitrini.com.tr/admin/supplier-applications" style="background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 12px 22px; border-radius: 10px; font-weight: 800; font-size: 13px; display: inline-block;">
        Başvuruları İncele →
      </a>
      %s
    </div>

    <!-- Footer -->
    <div style="border-top: 1px solid #f1f5f9; padding-top: 20px; margin-top: 28px; text-align: center; font-size: 11px; color: #94a3b8;">
      © 2026 Merter Vitrini B2B E-Ticaret Platformu. Bu e-posta sistem yöneticisine otomatik olarak gönderilmiştir.
    </div>
  </div>
</body>
</html>`,
			html.EscapeString(app.CompanyName), html.EscapeString(app.ContactName),
			html.EscapeString(app.CompanyName), html.EscapeString(app.ContactName),
			html.EscapeString(app.Email), html.EscapeString(app.Email),
			html.EscapeString(app.Phone), html.EscapeString(app.Phone),
			html.EscapeString(app.City), html.EscapeString(app.Category),
			html.EscapeString(app.Instagram), html.EscapeString(app.Website),
			html.EscapeString(app.Notes),
			geoHTML,
			func() string {
				if cleanPhone != "" {
					return fmt.Sprintf(`<a href="https://wa.me/%s" style="background-color: #16a34a; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 10px; font-weight: 700; font-size: 13px; display: inline-block;">💬 WhatsApp'tan Yaz</a>`, cleanPhone)
				}
				return ""
			}(),
		)

		_ = SendRawMail(cfg, adminEmail, subject, htmlBody, textBody)
	})
}

// SendSupplierRegisteredNotification notifies admin when a supplier user is created with full geo details
func SendSupplierRegisteredNotification(cfg *config.Config, brandName, brandCode, contactName, email, phone string, meta ClientMeta) {
	adminEmail := cfg.AdminEmail
	if adminEmail == "" {
		adminEmail = defaultAdminEmail
	}

	safe.Go("NotifyAdminSupplierRegistration", func() {
		subject := fmt.Sprintf("🔔 Yeni Tedarikçi Hesabı: %s (%s)", brandName, contactName)
		nowStr := time.Now().Format(dateTimeFormatTR)
		geoHTML := formatGeoLocationHTML(meta)
		cleanPhone := cleanPhoneForWhatsApp(phone)

		phoneDisplay := phone
		if phoneDisplay == "" {
			phoneDisplay = "Belirtilmedi"
		}

		textBody := fmt.Sprintf(`Sayın Yönetici,

Merter Vitrini sisteminde yeni bir tedarikçi kullanıcısı tanımlandı:

• Tedarikçi Firma: %s (Kod: %s)
• Yetkili Kişi: %s
• E-Posta: %s
• Telefon: %s
• Tarih: %s

Güvenlik / Ağ Bilgisi:
• IP: %s
• Konum: %s, %s
• ISP: %s
• Cihaz: %s (%s)

Tedarikçileri yönetmek için: https://mertervitrini.com.tr/admin/suppliers

Merter Vitrini Bildirim Servisi`, brandName, brandCode, contactName, email, phoneDisplay, nowStr, meta.IP, meta.City, meta.Country, meta.ISP, meta.Device, meta.Browser)

		htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f1f5f9; padding: 24px 12px; color: #1e293b; margin: 0;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #cbd5e1; padding: 32px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.07);">
    <div style="text-align: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 18px; margin-bottom: 24px;">
      <h2 style="color: #0f172a; margin: 0; font-size: 24px; font-weight: 900; letter-spacing: -0.5px;">MERTER VİTRİNİ</h2>
      <p style="color: #d97706; font-size: 11px; font-weight: 800; letter-spacing: 2px; margin: 4px 0 0 0; text-transform: uppercase;">Yönetici Bildirim Servisi</p>
    </div>

    <div style="margin-bottom: 20px;">
      <span style="display: inline-block; background-color: #fef3c7; color: #92400e; font-size: 12px; font-weight: 800; padding: 6px 14px; border-radius: 9999px; border: 1px solid #fde68a;">
        ✨ Yeni Tedarikçi Kullanıcısı Tanımlandı
      </span>
    </div>

    <h3 style="color: #0f172a; margin: 0 0 16px 0; font-size: 18px;">Tedarikçi Portalı Hesabı Açıldı</h3>
    <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 20px 0;">
      Aşağıdaki detaylara sahip tedarikçi kullanıcısı sisteme tanımlanmış ve Keycloak IAM erişimi sağlanmıştır:
    </p>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px; margin-bottom: 20px;">
      <table style="width: 100%%; font-size: 13px; line-height: 1.8; border-collapse: collapse;">
        <tr>
          <td style="color: #64748b; width: 35%%;"><strong>Firma Adı:</strong></td>
          <td style="color: #0f172a; font-weight: 700;">%s (%s)</td>
        </tr>
        <tr>
          <td style="color: #64748b;"><strong>Yetkili Kişi:</strong></td>
          <td style="color: #0f172a; font-weight: 600;">%s</td>
        </tr>
        <tr>
          <td style="color: #64748b;"><strong>E-Posta:</strong></td>
          <td><a href="mailto:%s" style="color: #0284c7; text-decoration: underline; font-weight: 600;">%s</a></td>
        </tr>
        <tr>
          <td style="color: #64748b;"><strong>Telefon:</strong></td>
          <td style="color: #0f172a;"><a href="tel:%s" style="color: #0f172a; text-decoration: none;">%s</a></td>
        </tr>
        <tr>
          <td style="color: #64748b;"><strong>Kayıt Zamanı:</strong></td>
          <td style="color: #0f172a;">%s</td>
        </tr>
      </table>
    </div>

    <!-- Geo & Network Analysis Box -->
    %s

    <div style="text-align: center; margin-top: 28px; display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
      <a href="https://mertervitrini.com.tr/admin/suppliers" style="background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 12px 22px; border-radius: 10px; font-weight: 700; font-size: 13px; display: inline-block;">
        Tedarikçileri Görüntüle →
      </a>
      %s
    </div>

    <div style="border-top: 1px solid #f1f5f9; padding-top: 18px; margin-top: 28px; text-align: center; font-size: 11px; color: #94a3b8;">
      © 2026 Merter Vitrini B2B E-Ticaret Platformu. Bu e-posta sistem yöneticisine otomatik gönderilmiştir.
    </div>
  </div>
</body>
</html>`,
			html.EscapeString(brandName), html.EscapeString(brandCode),
			html.EscapeString(contactName),
			html.EscapeString(email), html.EscapeString(email),
			html.EscapeString(phoneDisplay), html.EscapeString(phoneDisplay),
			nowStr,
			geoHTML,
			func() string {
				if cleanPhone != "" {
					return fmt.Sprintf(`<a href="https://wa.me/%s" style="background-color: #16a34a; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 10px; font-weight: 700; font-size: 13px; display: inline-block;">💬 WhatsApp'tan Yaz</a>`, cleanPhone)
				}
				return ""
			}(),
		)

		_ = SendRawMail(cfg, adminEmail, subject, htmlBody, textBody)
	})
}

// SendSupplierWelcomeEmail welcomes the supplier with login links and instructions
func SendSupplierWelcomeEmail(cfg *config.Config, brandName, contactName, email string) {
	if email == "" || !strings.Contains(email, "@") {
		return
	}

	safe.Go("SendSupplierWelcomeEmail", func() {
		subject := fmt.Sprintf("Merter Vitrini Tedarikçi Portalına Hoş Geldiniz - %s", brandName)
		loginURL := "https://mertervitrini.com.tr/supplier/login"

		textBody := fmt.Sprintf(`Sayın %s,

Merter Vitrini B2B E-Ticaret Platformu tedarikçi portalı hesabınız oluşturulmuştur.

Firma: %s
Giriş E-Postanız: %s
Portal Adresi: %s

Tedarikçi portalına giriş yaparak ürünlerinizi yönetebilir, stoklarınızı takip edebilir ve gelen siparişleri görüntüleyebilirsiniz.

İyi çalışmalar dileriz.
Merter Vitrini Ekibi`, contactName, brandName, email, loginURL)

		htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; padding: 24px 12px; color: #1e293b; margin: 0;">
  <div style="max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.04);">
    <div style="text-align: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 18px; margin-bottom: 24px;">
      <h2 style="color: #0f172a; margin: 0; font-size: 22px; font-weight: 800;">MERTER VİTRİNİ</h2>
      <p style="color: #d97706; font-size: 11px; font-weight: 700; letter-spacing: 2px; margin: 4px 0 0 0; text-transform: uppercase;">Tedarikçi Portalı</p>
    </div>

    <h3 style="color: #0f172a; margin: 0 0 16px 0; font-size: 18px;">Hoş Geldiniz, Sayın %s</h3>
    <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 20px 0;">
      <strong>%s</strong> firması adına Merter Vitrini B2B platformu tedarikçi hesabınız başarıyla tanımlanmıştır.
    </p>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 24px;">
      <div style="font-size: 13px; color: #64748b; margin-bottom: 6px;">Kullanıcı Adı / E-Posta:</div>
      <div style="font-size: 15px; color: #0f172a; font-weight: 700;">%s</div>
    </div>

    <div style="text-align: center; margin: 28px 0;">
      <a href="%s" style="background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 700; font-size: 14px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(15, 23, 42, 0.2);">
        Tedarikçi Portalı Girişi →
      </a>
    </div>

    <p style="font-size: 12px; line-height: 1.6; color: #64748b; margin: 20px 0 0 0;">
      Herhangi bir sorunuz olduğunda <a href="mailto:destek@mertervitrini.com.tr" style="color: #0284c7; text-decoration: underline;">destek@mertervitrini.com.tr</a> adresinden bizimle iletişime geçebilirsiniz.
    </p>

    <div style="border-top: 1px solid #f1f5f9; padding-top: 18px; margin-top: 24px; text-align: center; font-size: 11px; color: #94a3b8;">
      © 2026 Merter Vitrini B2B E-Ticaret Platformu. Tüm hakları saklıdır.
    </div>
  </div>
</body>
</html>`, html.EscapeString(contactName), html.EscapeString(brandName), html.EscapeString(email), loginURL)

		_ = SendRawMail(cfg, email, subject, htmlBody, textBody)
	})
}

// SendCustomerRegisteredNotification notifies admin when a new B2B customer registers
func SendCustomerRegisteredNotification(cfg *config.Config, firstName, lastName, email, phone string, meta ClientMeta) {
	adminEmail := cfg.AdminEmail
	if adminEmail == "" {
		adminEmail = defaultAdminEmail
	}

	safe.Go("NotifyAdminCustomerRegistration", func() {
		fullName := strings.TrimSpace(firstName + " " + lastName)
		subject := fmt.Sprintf("👤 Yeni Müşteri / Bayi Kaydı: %s", fullName)
		nowStr := time.Now().Format(dateTimeFormatTR)
		geoHTML := formatGeoLocationHTML(meta)
		cleanPhone := cleanPhoneForWhatsApp(phone)

		phoneDisplay := phone
		if phoneDisplay == "" {
			phoneDisplay = "Belirtilmedi"
		}

		textBody := fmt.Sprintf(`Sayın Yönetici,

Mağaza vitrininde yeni bir müşteri / bayi kaydı yapıldı:

• İsim Soyisim: %s
• E-Posta: %s
• Telefon: %s
• Kayıt Tarihi: %s

Güvenlik / Ağ Bilgisi:
• IP: %s
• Konum: %s, %s
• ISP: %s
• Cihaz: %s (%s)

Kullanıcıları yönetmek için: https://mertervitrini.com.tr/admin/customers

Merter Vitrini Bildirim Servisi`, fullName, email, phoneDisplay, nowStr, meta.IP, meta.City, meta.Country, meta.ISP, meta.Device, meta.Browser)

		htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f1f5f9; padding: 24px 12px; color: #1e293b; margin: 0;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #cbd5e1; padding: 32px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.07);">
    <div style="text-align: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 18px; margin-bottom: 24px;">
      <h2 style="color: #0f172a; margin: 0; font-size: 24px; font-weight: 900;">MERTER VİTRİNİ</h2>
      <p style="color: #d97706; font-size: 11px; font-weight: 800; letter-spacing: 2px; margin: 4px 0 0 0; text-transform: uppercase;">Yönetici Bildirim Servisi</p>
    </div>

    <div style="margin-bottom: 20px;">
      <span style="display: inline-block; background-color: #e0f2fe; color: #0369a1; font-size: 12px; font-weight: 800; padding: 6px 14px; border-radius: 9999px; border: 1px solid #bae6fd;">
        👤 Yeni Müşteri / Bayi Kaydı
      </span>
    </div>

    <h3 style="color: #0f172a; margin: 0 0 16px 0; font-size: 18px;">Mağaza Vitrininden Yeni Kayıt Geldi</h3>
    <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 20px 0;">
      Aşağıdaki kullanıcı sisteme başarıyla üye olmuştur:
    </p>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px; margin-bottom: 20px;">
      <table style="width: 100%%; font-size: 13px; line-height: 1.8; border-collapse: collapse;">
        <tr>
          <td style="color: #64748b; width: 35%%;"><strong>Müşteri Adı:</strong></td>
          <td style="color: #0f172a; font-weight: 700;">%s</td>
        </tr>
        <tr>
          <td style="color: #64748b;"><strong>E-Posta:</strong></td>
          <td><a href="mailto:%s" style="color: #0284c7; text-decoration: underline; font-weight: 600;">%s</a></td>
        </tr>
        <tr>
          <td style="color: #64748b;"><strong>Telefon:</strong></td>
          <td><a href="tel:%s" style="color: #0f172a; text-decoration: none;">%s</a></td>
        </tr>
        <tr>
          <td style="color: #64748b;"><strong>Kayıt Zamanı:</strong></td>
          <td style="color: #0f172a;">%s</td>
        </tr>
      </table>
    </div>

    <!-- Geo & Network Analysis Box -->
    %s

    <div style="text-align: center; margin-top: 28px; display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
      <a href="https://mertervitrini.com.tr/admin/customers" style="background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 12px 22px; border-radius: 10px; font-weight: 700; font-size: 13px; display: inline-block;">
        Müşterileri Yönet →
      </a>
      %s
    </div>

    <div style="border-top: 1px solid #f1f5f9; padding-top: 18px; margin-top: 28px; text-align: center; font-size: 11px; color: #94a3b8;">
      © 2026 Merter Vitrini B2B E-Ticaret Platformu. Bu e-posta sistem yöneticisine otomatik gönderilmiştir.
    </div>
  </div>
</body>
</html>`,
			html.EscapeString(fullName),
			html.EscapeString(email), html.EscapeString(email),
			html.EscapeString(phoneDisplay), html.EscapeString(phoneDisplay),
			nowStr,
			geoHTML,
			func() string {
				if cleanPhone != "" {
					return fmt.Sprintf(`<a href="https://wa.me/%s" style="background-color: #16a34a; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 10px; font-weight: 700; font-size: 13px; display: inline-block;">💬 WhatsApp'tan Yaz</a>`, cleanPhone)
				}
				return ""
			}(),
		)

		_ = SendRawMail(cfg, adminEmail, subject, htmlBody, textBody)
	})
}

// SendCustomerEmailVerification sends an activation/verification link to a registered storefront customer
func SendCustomerEmailVerification(cfg *config.Config, firstName, email, token string) {
	if email == "" || !strings.Contains(email, "@") || token == "" {
		return
	}

	safe.Go("SendCustomerEmailVerification", func() {
		verifyURL := fmt.Sprintf("https://mertervitrini.com.tr/api/v1/store/auth/verify-email?token=%s", url.QueryEscape(token))
		subject := "🔐 Merter Vitrini B2B Hesabınızı Doğrulayın"

		displayName := strings.TrimSpace(firstName)
		if displayName == "" {
			displayName = "Değerli Müşterimiz"
		}

		textBody := fmt.Sprintf(`Merhaba %s,

Merter Vitrini B2B Toptan Tekstil Platformu'na hoş geldiniz!

Üyeliğinizi tamamlamak, Merter üreticilerinden doğrudan teklif almak ve doğrulanmış B2B müşteri statüsüne geçmek için lütfen e-posta adresinizi doğrulayın:

%s

Bu bağlantı 24 saat boyunca geçerlidir.

Eğer bu kaydı siz yapmadıysanız bu e-postayı dikkate almayınız.

Saygılarımızla,
Merter Vitrini Ekibi
https://mertervitrini.com.tr`, displayName, verifyURL)

		htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; padding: 24px 12px; color: #1e293b; margin: 0;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; padding: 36px 30px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05);">
    <div style="text-align: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 26px;">
      <h2 style="color: #0f172a; margin: 0; font-size: 24px; font-weight: 900; letter-spacing: 0.5px;">MERTER VİTRİNİ</h2>
      <p style="color: #d97706; font-size: 11px; font-weight: 800; letter-spacing: 2px; margin: 5px 0 0 0; text-transform: uppercase;">Doğrudan Üreticiden B2B Tedarik</p>
    </div>

    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-flex; align-items: center; justify-content: center; width: 64px; height: 64px; background-color: #ecfdf5; border: 2px solid #a7f3d0; border-radius: 20px; font-size: 28px; margin-bottom: 16px;">
        ✉️
      </div>
      <h3 style="color: #0f172a; margin: 0 0 8px 0; font-size: 20px; font-weight: 800;">E-Posta Adresinizi Doğrulayın</h3>
      <p style="font-size: 14px; line-height: 1.6; color: #64748b; margin: 0;">
        Merhaba <strong>%s</strong>, Merter Vitrini B2B platformuna üyeliğinizi onaylamak için son bir adım kaldı.
      </p>
    </div>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px; margin-bottom: 26px; font-size: 13px; line-height: 1.7; color: #334155;">
      <div style="font-weight: 800; color: #0f172a; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
        🛡️ Doğrulanmış Müşteri Avantajları:
      </div>
      <ul style="margin: 0; padding-left: 18px;">
        <li>Üreticilerin açtığınız alım ilanlarına (RFQ) ve mesajlarınıza öncelikli yanıt vermesi</li>
        <li>Tedarikçilere açık profilinizde <strong>&ldquo;✓ E-Postası Doğrulanmış Müşteri&rdquo;</strong> güven rozeti</li>
        <li>Sipariş, kargo takip ve fiyat teklif bildirimlerinin anında iletilmesi</li>
      </ul>
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="%s" style="background-color: #059669; color: #ffffff; text-decoration: none; padding: 14px 34px; border-radius: 12px; font-weight: 800; font-size: 14px; display: inline-block; letter-spacing: 0.5px; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.25);">
        E-Posta Adresimi Doğrula →
      </a>
      <p style="font-size: 11px; color: #94a3b8; margin: 12px 0 0 0;">
        ⏱️ Bu bağlantı <strong>24 saat</strong> boyunca geçerlidir.
      </p>
    </div>

    <div style="border-top: 1px solid #f1f5f9; padding-top: 18px; margin-top: 28px; font-size: 12px; color: #94a3b8; line-height: 1.6;">
      <p style="margin: 0 0 6px 0;">Butona tıklayamıyorsanız aşağıdaki bağlantıyı tarayıcınıza yapıştırabilirsiniz:</p>
      <p style="margin: 0; word-break: break-all; color: #0284c7; font-family: monospace; font-size: 11px;">%s</p>
    </div>

    <div style="border-top: 1px solid #f1f5f9; padding-top: 18px; margin-top: 24px; text-align: center; font-size: 11px; color: #94a3b8;">
      © 2026 Merter Vitrini B2B E-Ticaret Platformu. Tüm hakları saklıdır.
    </div>
  </div>
</body>
</html>`,
			html.EscapeString(displayName),
			verifyURL,
			verifyURL,
		)

		_ = SendRawMail(cfg, email, subject, htmlBody, textBody)
	})
}

// SendSupplierApplicationConfirmationEmail sends an acknowledgment email to the prospective supplier
func SendSupplierApplicationConfirmationEmail(cfg *config.Config, companyName, contactName, email string) {
	if email == "" || !strings.Contains(email, "@") {
		return
	}

	safe.Go("SendSupplierApplicationConfirmationEmail", func() {
		subject := fmt.Sprintf("Tedarikçi Başvurunuz Alındı - %s (Merter Vitrini)", companyName)

		textBody := fmt.Sprintf(`Sayın %s,

%s adına yapmış olduğunuz Merter Vitrini toptan tedarikçi satış başvurusu sistemimize başarıyla ulaşmıştır.

Kategori ve satın alma ekiplerimiz başvurunuzu inceleyecek ve değerlendirme neticesinde tarafınıza geri dönüş sağlayacaktır.

Başvurunuz onaylandığında, tedarikçi yönetim portalı giriş hesabınız oluşturulacak ve şifrenizi belirlemeniz için güvenli aktivasyon bağlantısı kurumsal e-posta adresinize gönderilecektir.

Bize ulaştığınız için teşekkür eder, bol kazançlar dileriz.

Merter Vitrini B2B Destek Ekibi
Web: https://mertervitrini.com.tr
E-Posta: destek@mertervitrini.com.tr`, contactName, companyName)

		htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; padding: 24px 12px; color: #1e293b; margin: 0;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05);">
    <div style="text-align: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 18px; margin-bottom: 24px;">
      <h2 style="color: #0f172a; margin: 0; font-size: 24px; font-weight: 900; letter-spacing: -0.5px;">MERTER VİTRİNİ</h2>
      <p style="color: #64748b; font-size: 11px; font-weight: 700; letter-spacing: 2px; margin: 4px 0 0 0; text-transform: uppercase;">Global B2B Wholesale Fashion Platform</p>
    </div>

    <div style="margin-bottom: 20px;">
      <span style="display: inline-block; background-color: #dcfce7; color: #15803d; font-size: 12px; font-weight: 800; padding: 6px 14px; border-radius: 9999px;">
        ✓ Başvurunuz Başarıyla Alındı
      </span>
    </div>

    <h3 style="color: #0f172a; margin: 0 0 14px 0; font-size: 18px;">Sayın %s,</h3>
    <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 16px 0;">
      <strong>%s</strong> adına yapmış olduğunuz toptan tedarikçi satış başvurunuz tarafımıza ulaşmıştır.
    </p>

    <div style="background-color: #f8fafc; border-left: 4px solid #0f172a; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
      <p style="margin: 0; font-size: 13px; color: #334155; line-height: 1.6;">
        Satın alma ve kategori uzmanlarımız ürün gamınızı ve kapasitenizi inceledikten sonra sizinle iletişime geçecektir. 
        Başvurunuz onaylandığında, tedarikçi yönetim panelinize erişebilmeniz için <strong>şifre oluşturma bağlantısı</strong> bu e-posta adresinize iletilecektir.
      </p>
    </div>

    <p style="font-size: 13px; color: #64748b; line-height: 1.6; margin: 0 0 24px 0;">
      Sorularınız için <a href="mailto:destek@mertervitrini.com.tr" style="color: #0284c7; text-decoration: underline;">destek@mertervitrini.com.tr</a> adresinden veya WhatsApp destek hattımızdan bize ulaşabilirsiniz.
    </p>

    <div style="border-top: 1px solid #f1f5f9; padding-top: 18px; margin-top: 24px; text-align: center; font-size: 11px; color: #94a3b8;">
      © 2026 Merter Vitrini Tekstil B2B E-Ticaret Platformu. Tüm hakları saklıdır.
    </div>
  </div>
</body>
</html>`,
			html.EscapeString(contactName),
			html.EscapeString(companyName),
		)

		_ = SendRawMail(cfg, email, subject, htmlBody, textBody)
	})
}

// SendSupplierApplicationVerificationEmail sends a 30-minute email verification link to prospective supplier
func SendSupplierApplicationVerificationEmail(cfg *config.Config, companyName, contactName, email, verifyURL string) {
	if email == "" || !strings.Contains(email, "@") {
		return
	}

	safe.Go("SendSupplierApplicationVerificationEmail", func() {
		subject := fmt.Sprintf("E-Postanızı Doğrulayın: %s - Merter Vitrini Tedarikçi Başvurusu", companyName)

		textBody := fmt.Sprintf(`Sayın %s,

%s adına Merter Vitrini toptan tedarikçi satış başvurusu başlattınız.

Başvurunuzun değerlendirmeye alınabilmesi ve satın alma ekibimize iletilmesi için lütfen aşağıdaki bağlantıya tıklayarak e-posta adresinizi doğrulayınız:

Doğrulama Bağlantısı: %s

ÖNEMLİ GÜVENLİK BİLGİSİ:
Bu bağlantı 30 dakika süreyle geçerlidir. 30 dakika içinde doğrulanmayan başvurular güvenlik politikamız gereğince sistemden otomatik olarak silinmektedir.

Merter Vitrini B2B Destek Ekibi
Web: https://mertervitrini.com.tr
E-Posta: destek@mertervitrini.com.tr`, contactName, companyName, verifyURL)

		htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; padding: 24px 12px; color: #1e293b; margin: 0;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05);">
    <div style="text-align: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 18px; margin-bottom: 24px;">
      <h2 style="color: #0f172a; margin: 0; font-size: 24px; font-weight: 900; letter-spacing: -0.5px;">MERTER VİTRİNİ</h2>
      <p style="color: #d97706; font-size: 11px; font-weight: 800; letter-spacing: 2px; margin: 4px 0 0 0; text-transform: uppercase;">Tedarikçi Doğrulama Servisi</p>
    </div>

    <div style="margin-bottom: 20px;">
      <span style="display: inline-block; background-color: #fef3c7; color: #92400e; font-size: 12px; font-weight: 800; padding: 6px 14px; border-radius: 9999px;">
        ✉️ E-Posta Adresinizi Doğrulayınız
      </span>
    </div>

    <h3 style="color: #0f172a; margin: 0 0 14px 0; font-size: 18px;">Sayın %s,</h3>
    <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 16px 0;">
      <strong>%s</strong> adına yapmış olduğunuz toptan tedarikçi satış başvurusunun satın alma ve kategori ekibimize ulaşabilmesi için lütfen e-posta adresinizi doğrulayın.
    </p>

    <div style="text-align: center; margin: 28px 0;">
      <a href="%s" style="background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: 800; font-size: 14px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
        ✓ E-Posta Adresimi Doğrula ve Başvuruyu Tamamla
      </a>
    </div>

    <div style="background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 10px; padding: 14px; margin-bottom: 20px;">
      <p style="margin: 0; font-size: 12px; color: #991b1b; line-height: 1.6; font-weight: 600;">
        ⚠️ Güvenlik Uyarısı: Bu doğrulama bağlantısı <strong>30 dakika</strong> geçerlidir. 30 dakika içerisinde doğrulanmayan başvurular güvenlik politikamız gereğince sistemden otomatik olarak silinmektedir.
      </p>
    </div>

    <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin: 0 0 10px 0;">
      Butona tıklayamıyorsanız aşağıdaki bağlantıyı tarayıcınıza kopyalayabilirsiniz:
    </p>
    <p style="font-size: 11px; color: #0284c7; word-break: break-all; margin: 0 0 24px 0;">
      <a href="%s" style="color: #0284c7;">%s</a>
    </p>

    <div style="border-top: 1px solid #f1f5f9; padding-top: 18px; margin-top: 24px; text-align: center; font-size: 11px; color: #94a3b8;">
      © 2026 Merter Vitrini B2B E-Ticaret Platformu. Bu e-posta başvuru sahibine otomatik iletilmiştir.
    </div>
  </div>
</body>
</html>`,
			html.EscapeString(contactName),
			html.EscapeString(companyName),
			verifyURL,
			verifyURL, verifyURL,
		)

		_ = SendRawMail(cfg, email, subject, htmlBody, textBody)
	})
}

// SendSupplierApplicationApprovedEmail sends password setup invitation to approved supplier
func SendSupplierApplicationApprovedEmail(cfg *config.Config, companyName, contactName, email, setupURL string) {
	if email == "" || !strings.Contains(email, "@") {
		return
	}

	safe.Go("SendSupplierApplicationApprovedEmail", func() {
		subject := fmt.Sprintf("🎉 Tebrikler! Tedarikçi Başvurunuz Onaylandı - %s (Merter Vitrini)", companyName)

		textBody := fmt.Sprintf(`Sayın %s,

Tebrik ederiz! %s için Merter Vitrini B2B e-ticaret platformuna yapmış olduğunuz toptan tedarikçi satış başvurusu yönetim kurulu ve kategori ekibimiz tarafından onaylanmıştır.

Tedarikçi portalı hesabınızı aktif etmek ve şifrenizi belirlemek için aşağıdaki bağlantıya tıklayınız:

Şifre Belirleme Bağlantısı: %s

Giriş E-Postanız: %s
Tedarikçi Giriş Portalı: https://mertervitrini.com.tr/supplier/login

(Bu aktivasyon bağlantısı 48 saat süreyle geçerlidir.)

Merter Vitrini ailesine hoş geldiniz!

Merter Vitrini B2B Destek Ekibi
Web: https://mertervitrini.com.tr
E-Posta: destek@mertervitrini.com.tr`, contactName, companyName, setupURL, email)

		htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; padding: 24px 12px; color: #1e293b; margin: 0;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05);">
    <div style="text-align: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 18px; margin-bottom: 24px;">
      <h2 style="color: #0f172a; margin: 0; font-size: 24px; font-weight: 900; letter-spacing: -0.5px;">MERTER VİTRİNİ</h2>
      <p style="color: #16a34a; font-size: 11px; font-weight: 800; letter-spacing: 2px; margin: 4px 0 0 0; text-transform: uppercase;">Tedarikçi Başvurusu Onaylandı</p>
    </div>

    <div style="margin-bottom: 20px;">
      <span style="display: inline-block; background-color: #dcfce7; color: #15803d; font-size: 13px; font-weight: 800; padding: 8px 16px; border-radius: 9999px;">
        🎉 Tebrikler! Başvurunuz Onaylandı
      </span>
    </div>

    <h3 style="color: #0f172a; margin: 0 0 14px 0; font-size: 18px;">Sayın %s,</h3>
    <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 16px 0;">
      <strong>%s</strong> için yapmış olduğunuz tedarikçi satış başvurusu incelenmiş ve onaylanmıştır. Artık Merter Vitrini B2B pazar yerinde toptan ürünlerinizi küresel alıcılara sunabilirsiniz.
    </p>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin: 20px 0;">
      <p style="margin: 0 0 8px 0; font-size: 13px; color: #64748b;">Giriş E-Posta Adresiniz:</p>
      <p style="margin: 0; font-size: 15px; font-weight: 700; color: #0f172a;">%s</p>
    </div>

    <div style="text-align: center; margin: 28px 0;">
      <a href="%s" style="background-color: #16a34a; color: #ffffff; text-decoration: none; padding: 14px 30px; border-radius: 10px; font-weight: 800; font-size: 14px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(22, 163, 74, 0.2);">
        🔑 Şifremi Belirle ve Panele Giriş Yap →
      </a>
    </div>

    <div style="background-color: #eff6ff; border: 1px solid #dbeafe; border-radius: 10px; padding: 14px; margin-bottom: 20px;">
      <p style="margin: 0; font-size: 12px; color: #1e40af; line-height: 1.6;">
        ℹ️ Bu bağlantı <strong>48 saat</strong> süreyle geçerlidir. Şifrenizi belirledikten sonra doğrudan ürünlerinizi yönetmeye ve siparişlerinizi takip etmeye başlayabilirsiniz.
      </p>
    </div>

    <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin: 0 0 10px 0;">
      Buton çalışmıyorsa aşağıdaki bağlantıyı tarayıcınıza yapıştırabilirsiniz:
    </p>
    <p style="font-size: 11px; color: #0284c7; word-break: break-all; margin: 0 0 24px 0;">
      <a href="%s" style="color: #0284c7;">%s</a>
    </p>

    <div style="border-top: 1px solid #f1f5f9; padding-top: 18px; margin-top: 24px; text-align: center; font-size: 11px; color: #94a3b8;">
      © 2026 Merter Vitrini B2B E-Ticaret Platformu. Tüm hakları saklıdır.
    </div>
  </div>
</body>
</html>`,
			html.EscapeString(contactName),
			html.EscapeString(companyName),
			html.EscapeString(email),
			setupURL,
			setupURL, setupURL,
		)

		_ = SendRawMail(cfg, email, subject, htmlBody, textBody)
	})
}

// ServiceProviderApplicationEmailData holds fields for service provider directory onboarding emails.
type ServiceProviderApplicationEmailData struct {
	CompanyName     string
	ContactName     string
	Email           string
	Phone           string
	ServiceCategory string
	ShortDesc       string
	Address         string
}

// SendServiceProviderVerificationEmail sends a 30-minute email verification link to a prospective service provider.
func SendServiceProviderVerificationEmail(cfg *config.Config, companyName, contactName, email, verifyURL string) {
	if email == "" || !strings.Contains(email, "@") {
		return
	}

	safe.Go("SendServiceProviderVerificationEmail", func() {
		subject := fmt.Sprintf("✉️ Hizmet Sağlayıcı Başvurunuzu Doğrulayın (30 Dk Geçerli) - %s", companyName)

		textBody := fmt.Sprintf(`Sayın %s,

%s adına Merter Vitrini Sektörel Hizmet Sağlayıcılar Rehberi'ne yapmış olduğunuz başvuru alınmıştır.

Başvurunuzun yönetici onayına iletilebilmesi için lütfen 30 dakika içinde aşağıdaki bağlantıya tıklayarak e-posta adresinizi doğrulayınız:

Doğrulama Bağlantısı: %s

ÖNEMLİ GÜVENLİK BİLGİSİ:
Bu bağlantı 30 dakika süreyle geçerlidir. 30 dakika içinde doğrulanmayan başvurular güvenlik politikamız gereğince sistemden otomatik olarak silinmektedir.

Merter Vitrini B2B Destek Ekibi
Web: https://mertervitrini.com.tr/hizmet-saglayicilar`, contactName, companyName, verifyURL)

		htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; padding: 24px 12px; color: #1e293b; margin: 0;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px;">
    <div style="text-align: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 18px; margin-bottom: 24px;">
      <h2 style="color: #0f172a; margin: 0; font-size: 24px; font-weight: 900;">MERTER VİTRİNİ</h2>
      <p style="color: #d97706; font-size: 11px; font-weight: 800; letter-spacing: 2px; margin: 4px 0 0 0; text-transform: uppercase;">Sektörel Hizmet Sağlayıcı Doğrulama Servisi</p>
    </div>
    <h3 style="color: #0f172a; margin: 0 0 14px 0; font-size: 18px;">Sayın %s,</h3>
    <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 16px 0;">
      <strong>%s</strong> adına yapmış olduğunuz Sektörel Hizmet Sağlayıcılar Rehberi başvurusunun yönetici onayına sunulabilmesi için lütfen e-posta adresinizi doğrulayın.
    </p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="%s" style="background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: 800; font-size: 14px; display: inline-block;">
        ✓ E-Posta Adresimi Doğrula ve Başvuruyu Tamamla
      </a>
    </div>
    <div style="background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 10px; padding: 14px; margin-bottom: 20px;">
      <p style="margin: 0; font-size: 12px; color: #991b1b; line-height: 1.6; font-weight: 600;">
        ⚠️ Güvenlik Uyarısı: Bu doğrulama bağlantısı <strong>30 dakika</strong> geçerlidir. Süresi içinde doğrulanmayan başvurular otomatik olarak silinmektedir.
      </p>
    </div>
    <p style="font-size: 11px; color: #0284c7; word-break: break-all; margin: 0 0 24px 0;">
      <a href="%s" style="color: #0284c7;">%s</a>
    </p>
  </div>
</body>
</html>`,
			html.EscapeString(contactName),
			html.EscapeString(companyName),
			verifyURL,
			verifyURL, verifyURL,
		)

		_ = SendRawMail(cfg, email, subject, htmlBody, textBody)
	})
}

// SendServiceProviderAdminNotification notifies admin after applicant verifies their email.
func SendServiceProviderAdminNotification(cfg *config.Config, app ServiceProviderApplicationEmailData, meta ClientMeta) {
	adminEmail := cfg.AdminEmail
	if adminEmail == "" {
		adminEmail = defaultAdminEmail
	}

	safe.Go("SendServiceProviderAdminNotification", func() {
		subject := fmt.Sprintf("🚚 Yeni Doğrulanmış Hizmet Sağlayıcı Başvurusu: %s (%s)", app.CompanyName, app.ServiceCategory)
		nowStr := time.Now().Format(dateTimeFormatTR)
		geoHTML := formatGeoLocationHTML(meta)

		textBody := fmt.Sprintf(`Sayın Yönetici,

Sektörel Hizmet Sağlayıcılar Rehberi için e-posta doğrulaması tamamlanmış yeni bir başvuru alındı:

• Firma Unvanı: %s
• Yetkili: %s
• Hizmet Kategorisi: %s
• E-Posta: %s (Doğrulandı)
• Telefon / WhatsApp: %s
• Kısa Tanıtım: %s
• Adres: %s
• Tarih: %s

Başvuruyu İncelemek ve Onaylamak İçin: https://mertervitrini.com.tr/admin/service-providers`,
			app.CompanyName, app.ContactName, app.ServiceCategory, app.Email, app.Phone, app.ShortDesc, app.Address, nowStr)

		htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f1f5f9; padding: 24px 12px; color: #1e293b; margin: 0;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #cbd5e1; padding: 32px;">
    <h2 style="color: #0f172a; margin: 0 0 8px 0; font-size: 20px; font-weight: 900;">Yeni Hizmet Sağlayıcı Başvurusu (E-Posta Doğrulandı)</h2>
    <p style="font-size: 13px; color: #475569; margin: 0 0 18px 0;"><strong>%s</strong> (%s) rehberde yayınlanmak üzere yönetici onayı bekliyor.</p>
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; font-size: 13px; line-height: 1.7;">
      <div><strong>🏢 Firma:</strong> %s</div>
      <div><strong>👤 Yetkili:</strong> %s</div>
      <div><strong>🏷️ Kategori:</strong> %s</div>
      <div><strong>✉️ E-Posta:</strong> %s</div>
      <div><strong>📞 Telefon:</strong> %s</div>
      <div><strong>📝 Tanıtım:</strong> %s</div>
      <div><strong>📍 Adres:</strong> %s</div>
    </div>
    %s
    <div style="margin-top: 24px; text-align: center;">
      <a href="https://mertervitrini.com.tr/admin/service-providers" style="background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 12px 22px; border-radius: 10px; font-weight: 800; font-size: 13px; display: inline-block;">
        Yönetim Panelinde İncele &amp; Onayla →
      </a>
    </div>
  </div>
</body>
</html>`,
			html.EscapeString(app.CompanyName),
			html.EscapeString(app.ContactName),
			html.EscapeString(app.CompanyName),
			html.EscapeString(app.ContactName),
			html.EscapeString(app.ServiceCategory),
			html.EscapeString(app.Email),
			html.EscapeString(app.Phone),
			html.EscapeString(app.ShortDesc),
			html.EscapeString(app.Address),
			geoHTML,
		)

		_ = SendRawMail(cfg, adminEmail, subject, htmlBody, textBody)
	})
}

// SendServiceProviderApprovedEmail notifies the service provider when admin approves their listing.
func SendServiceProviderApprovedEmail(cfg *config.Config, companyName, contactName, email string) {
	if email == "" || !strings.Contains(email, "@") {
		return
	}

	safe.Go("SendServiceProviderApprovedEmail", func() {
		subject := fmt.Sprintf("🎉 Tebrikler! Hizmet Sağlayıcı Rehber Kaydınız Onaylandı - %s", companyName)

		textBody := fmt.Sprintf(`Sayın %s,

Tebrik ederiz! %s adına Merter Vitrini Sektörel Hizmet Sağlayıcılar Rehberi için yapmış olduğunuz başvuru yönetici ekibimiz tarafından onaylanmış ve yayına alınmıştır.

Rehber Sayfası: https://mertervitrini.com.tr/hizmet-saglayicilar

Merter Vitrini B2B Destek Ekibi`, contactName, companyName)

		htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; padding: 24px 12px; color: #1e293b; margin: 0;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px;">
    <h2 style="color: #15803d; margin: 0 0 12px 0; font-size: 20px; font-weight: 900;">🎉 Rehber Kaydınız Onaylandı ve Yayına Alındı!</h2>
    <p style="font-size: 14px; line-height: 1.6; color: #475569;">
      Sayın <strong>%s</strong>, <strong>%s</strong> firmanızın Sektörel Hizmet Sağlayıcılar Rehberi başvurusu onaylanmıştır. Küresel B2B alıcıları ve Merter üreticileri artık rehber üzerinden doğrudan firmanızla iletişime geçebilir.
    </p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="https://mertervitrini.com.tr/hizmet-saglayicilar" style="background-color: #16a34a; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 800; font-size: 13px; display: inline-block;">
        Sektörel Hizmet Sağlayıcılar Rehberini Görüntüle →
      </a>
    </div>
  </div>
</body>
</html>`,
			html.EscapeString(contactName),
			html.EscapeString(companyName),
		)

		_ = SendRawMail(cfg, email, subject, htmlBody, textBody)
	})
}



