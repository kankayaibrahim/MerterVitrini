package mailer

import (
	"fmt"
	"html"
	"strings"
	"time"

	"mertervitrini/backend/config"
)

// OrderAdminNotificationItem describes a single line item inside an order admin email.
type OrderAdminNotificationItem struct {
	Title     string
	SKU       string
	Quantity  int
	UnitPrice float64
	Currency  string
}

// OrderAdminNotificationData encapsulates order details for admin notification emails.
type OrderAdminNotificationData struct {
	OrderNumber         string
	ChannelLabel        string
	PaymentMethod       string
	CustomerName        string
	CustomerCompany     string
	CustomerEmail       string
	CustomerPhone       string
	BillingAddress      string
	DeliveryAddress     string
	TotalAmountTRY      float64
	TotalSummaryText    string
	IsImpersonated      bool
	ImpersonatedByEmail string
	Items               []OrderAdminNotificationItem
	Meta                ClientMeta
	IsTest              bool
}

// DigestMemberHighlight holds a recent registered customer row for the daily digest report.
type DigestMemberHighlight struct {
	FullName  string `json:"full_name"`
	Email     string `json:"email"`
	Country   string `json:"country"`
	CreatedAt string `json:"created_at"`
}

// DigestOrderHighlight holds a recent order row for the daily digest report.
type DigestOrderHighlight struct {
	OrderNumber  string `json:"order_number"`
	CustomerName string `json:"customer_name"`
	AmountText   string `json:"amount_text"`
	Status       string `json:"status"`
	CreatedAt    string `json:"created_at"`
}

// DailyDigestEmailData captures daily operational counts for both Admin UI preview and scheduled email digest.
type DailyDigestEmailData struct {
	ReportDate                string                  `json:"report_date"`
	ReportDateFormatted       string                  `json:"report_date_formatted"`
	GeneratedAt               string                  `json:"generated_at"`
	NewCustomersToday         int                     `json:"new_customers_today"`
	TotalActiveCustomers      int                     `json:"total_active_customers"`
	NewOrdersToday            int                     `json:"new_orders_today"`
	OrdersRevenueTRYToday     float64                 `json:"orders_revenue_try_today"`
	OrdersRevenueFormatted    string                  `json:"orders_revenue_formatted"`
	ActiveUnfinishedCarts     int                     `json:"active_unfinished_carts"`
	InquiriesToday            int                     `json:"inquiries_today"`
	ProductsAddedToday        int                     `json:"products_added_today"`
	ProductsDeactivatedToday  int                     `json:"products_deactivated_today"`
	ProductsArchivedToday     int                     `json:"products_archived_today"`
	ProductsDeletedToday      int                     `json:"products_deleted_today"`
	TotalActiveProducts       int                     `json:"total_active_products"`
	XMLSyncsCompletedToday    int                     `json:"xml_syncs_completed_today"`
	XMLSyncsFailedToday       int                     `json:"xml_syncs_failed_today"`
	SupplierApplicationsToday int                     `json:"supplier_applications_today"`
	RecentMembers             []DigestMemberHighlight `json:"recent_members"`
	RecentOrders              []DigestOrderHighlight  `json:"recent_orders"`
}

func formatOrderItemsHTMLRows(items []OrderAdminNotificationItem) string {
	if len(items) == 0 {
		return `<tr><td colspan="3" style="padding:10px;color:#64748b;text-align:center;">Sipariş kalemi detayı bulunamadı.</td></tr>`
	}
	var sb strings.Builder
	limit := min(len(items), 25)
	for _, it := range items[:limit] {
		currency := strings.TrimSpace(it.Currency)
		if currency == "" {
			currency = "TRY"
		}
		sb.WriteString(fmt.Sprintf(`
        <tr style="border-bottom:1px solid #e2e8f0;">
          <td style="padding:8px 10px;color:#0f172a;font-weight:600;">%s<br><span style="color:#64748b;font-family:monospace;font-size:11px;">SKU: %s</span></td>
          <td style="padding:8px 10px;color:#0f172a;text-align:center;font-weight:700;">%d</td>
          <td style="padding:8px 10px;color:#0f172a;text-align:right;font-weight:700;">%.2f %s</td>
        </tr>`, html.EscapeString(it.Title), html.EscapeString(it.SKU), it.Quantity, it.UnitPrice, html.EscapeString(currency)))
	}
	if len(items) > limit {
		sb.WriteString(fmt.Sprintf(`<tr><td colspan="3" style="padding:8px 10px;color:#64748b;font-size:12px;">+ %d ek kalem daha (Admin panelinden tamamını görüntüleyebilirsiniz)</td></tr>`, len(items)-limit))
	}
	return sb.String()
}

func formatOrderItemsTextLines(items []OrderAdminNotificationItem) string {
	if len(items) == 0 {
		return "- Kalem bilgisi yok"
	}
	var sb strings.Builder
	for idx, it := range items {
		if idx >= 25 {
			sb.WriteString(fmt.Sprintf("- ... +%d kalem daha\n", len(items)-idx))
			break
		}
		currency := strings.TrimSpace(it.Currency)
		if currency == "" {
			currency = "TRY"
		}
		sb.WriteString(fmt.Sprintf("- %s (SKU: %s) • %d x %.2f %s\n", it.Title, it.SKU, it.Quantity, it.UnitPrice, currency))
	}
	return sb.String()
}

// BuildOrderCreatedAdminEmailBodies constructs subject, HTML, and text payloads for admin new-order emails.
func BuildOrderCreatedAdminEmailBodies(data OrderAdminNotificationData) (subject, htmlBody, textBody string) {
	prefix := ""
	if data.IsTest {
		prefix = "[TEST] "
	}
	custName := strings.TrimSpace(data.CustomerName)
	if custName == "" {
		custName = "B2B Müşterisi"
	}
	channel := strings.TrimSpace(data.ChannelLabel)
	if channel == "" {
		channel = "B2B Mağaza Sepet Siparişi"
	}
	totalDisplay := strings.TrimSpace(data.TotalSummaryText)
	if totalDisplay == "" {
		totalDisplay = fmt.Sprintf("%.2f TL", data.TotalAmountTRY)
	}

	subject = fmt.Sprintf("%s🛒 Yeni B2B Sipariş: #%s — %s (%s)", prefix, data.OrderNumber, custName, totalDisplay)

	impersonationBanner := ""
	impersonationText := ""
	if data.IsImpersonated {
		impersonationBanner = fmt.Sprintf(`<div style="background:#fef3c7;border:1px solid #fcd34d;color:#92400e;border-radius:10px;padding:10px 14px;font-size:12px;font-weight:700;margin-bottom:18px;">⚠️ Personel İşlemi: Bu sipariş müşteri adına giriş yapan personel (%s) tarafından oluşturuldu.</div>`, html.EscapeString(data.ImpersonatedByEmail))
		impersonationText = fmt.Sprintf("\n[NOT] Müşteri adına giriş yapan personel (%s) tarafından oluşturuldu.\n", data.ImpersonatedByEmail)
	}

	cleanPhone := cleanPhoneForWhatsApp(data.CustomerPhone)
	waButton := ""
	if cleanPhone != "" {
		waButton = fmt.Sprintf(`<a href="https://wa.me/%s" style="background-color:#16a34a;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700;font-size:13px;display:inline-block;">💬 Müşteriye WhatsApp&apos;tan Yaz</a>`, cleanPhone)
	}

	geoHTML := formatGeoLocationHTML(data.Meta)
	rowsHTML := formatOrderItemsHTMLRows(data.Items)
	companyRow := ""
	if strings.TrimSpace(data.CustomerCompany) != "" {
		companyRow = fmt.Sprintf(`<tr><td style="color:#64748b;padding:4px 0;"><strong>Firma:</strong></td><td style="color:#0f172a;font-weight:600;padding:4px 0;">%s</td></tr>`, html.EscapeString(data.CustomerCompany))
	}

	textBody = fmt.Sprintf(`Sayın Yönetici,

Merter Vitrini platformunda yeni bir sipariş oluşturuldu:
%s
• Sipariş No: #%s
• Kanal: %s
• Ödeme Yöntemi: %s
• Müşteri: %s
• Firma: %s
• E-Posta: %s
• Telefon: %s
• Teslimat Adresi: %s
• Sipariş Toplamı: %s (TCMB ≈ %.2f TL)

Sipariş Kalemleri (%d kalem):
%s
Güvenlik / Ağ Bilgisi:
• IP (%s): %s
• Konum: %s, %s

Siparişleri Yönet: https://mertervitrini.com.tr/admin/orders

Merter Vitrini Bildirim Servisi`,
		impersonationText, data.OrderNumber, channel, data.PaymentMethod, custName, data.CustomerCompany,
		data.CustomerEmail, data.CustomerPhone, data.DeliveryAddress, totalDisplay, data.TotalAmountTRY,
		len(data.Items), formatOrderItemsTextLines(data.Items), data.Meta.IPVersion, data.Meta.IP, data.Meta.City, data.Meta.Country)

	htmlBody = fmt.Sprintf(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f1f5f9;padding:24px 12px;color:#1e293b;margin:0;">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid #cbd5e1;padding:32px;box-shadow:0 10px 15px -3px rgba(0,0,0,0.07);">
    <div style="text-align:center;border-bottom:2px solid #f1f5f9;padding-bottom:18px;margin-bottom:22px;">
      <h2 style="color:#0f172a;margin:0;font-size:24px;font-weight:900;">MERTER VİTRİNİ</h2>
      <p style="color:#059669;font-size:11px;font-weight:800;letter-spacing:2px;margin:4px 0 0 0;text-transform:uppercase;">Yeni B2B Sipariş Bildirimi</p>
    </div>

    %s

    <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:14px;padding:18px;margin-bottom:20px;">
      <div style="font-size:12px;font-weight:800;color:#065f46;text-transform:uppercase;letter-spacing:0.5px;">%s • #%s</div>
      <div style="font-size:24px;font-weight:900;color:#0f172a;margin-top:6px;">%s</div>
      <div style="font-size:12px;color:#475569;margin-top:2px;">TCMB Karşılığı: ≈ %.2f TL • Ödeme: %s</div>
    </div>

    <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:18px;margin-bottom:20px;">
      <table style="width:100%%;font-size:13px;line-height:1.7;border-collapse:collapse;">
        <tr><td style="color:#64748b;width:32%%;padding:4px 0;"><strong>Müşteri Adı:</strong></td><td style="color:#0f172a;font-weight:700;padding:4px 0;">%s</td></tr>
        %s
        <tr><td style="color:#64748b;padding:4px 0;"><strong>E-Posta:</strong></td><td style="padding:4px 0;"><a href="mailto:%s" style="color:#0284c7;font-weight:600;">%s</a></td></tr>
        <tr><td style="color:#64748b;padding:4px 0;"><strong>Telefon:</strong></td><td style="color:#0f172a;font-weight:600;padding:4px 0;">%s</td></tr>
        <tr><td style="color:#64748b;padding:4px 0;vertical-align:top;"><strong>Teslimat Adresi:</strong></td><td style="color:#334155;padding:4px 0;">%s</td></tr>
      </table>
    </div>

    <div style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:20px;">
      <div style="background:#f8fafc;padding:10px 14px;font-size:12px;font-weight:800;color:#334155;border-bottom:1px solid #e2e8f0;">🛍️ Sipariş Kalemleri (%d kalem)</div>
      <table style="width:100%%;font-size:12px;border-collapse:collapse;">
        <thead>
          <tr style="background:#f8fafc;color:#64748b;text-align:left;">
            <th style="padding:8px 10px;">Ürün / SKU</th>
            <th style="padding:8px 10px;text-align:center;">Seri/Adet</th>
            <th style="padding:8px 10px;text-align:right;">Birim Fiyat</th>
          </tr>
        </thead>
        <tbody>%s</tbody>
      </table>
    </div>

    %s

    <div style="text-align:center;margin-top:26px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
      <a href="https://mertervitrini.com.tr/admin/orders" style="background-color:#0f172a;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700;font-size:13px;display:inline-block;">Siparişleri Yönet →</a>
      %s
    </div>

    <div style="border-top:1px solid #f1f5f9;padding-top:18px;margin-top:26px;text-align:center;font-size:11px;color:#94a3b8;">
      © 2026 Merter Vitrini B2B E-Ticaret Platformu. Yönetici Sipariş Bildirim Servisi.
    </div>
  </div>
</body>
</html>`,
		impersonationBanner, html.EscapeString(channel), html.EscapeString(data.OrderNumber),
		html.EscapeString(totalDisplay), data.TotalAmountTRY, html.EscapeString(data.PaymentMethod),
		html.EscapeString(custName), companyRow,
		html.EscapeString(data.CustomerEmail), html.EscapeString(data.CustomerEmail),
		html.EscapeString(data.CustomerPhone), html.EscapeString(data.DeliveryAddress),
		len(data.Items), rowsHTML, geoHTML, waButton)

	return subject, htmlBody, textBody
}

// SendOrderCreatedAdminNotification notifies configured To/CC recipients whenever an order is created.
func SendOrderCreatedAdminNotification(cfg *config.Config, data OrderAdminNotificationData) {
	subject, htmlBody, textBody := BuildOrderCreatedAdminEmailBodies(data)
	DispatchAdminEventMail(cfg, EventNewOrder, subject, htmlBody, textBody, map[string]any{
		"kind":             "order_created",
		"order_number":     data.OrderNumber,
		"customer_name":    data.CustomerName,
		"customer_email":   data.CustomerEmail,
		"total_amount_try": data.TotalAmountTRY,
		"items_count":      len(data.Items),
	})
}

func renderDigestStatCell(label string, value any, sub string, accent string) string {
	return fmt.Sprintf(`<td style="width:50%%;padding:6px;vertical-align:top;">
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid %s;border-radius:10px;padding:12px 14px;">
        <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">%s</div>
        <div style="font-size:22px;font-weight:900;color:#0f172a;margin:4px 0 2px 0;">%v</div>
        <div style="font-size:11px;color:#475569;">%s</div>
      </div>
    </td>`, accent, html.EscapeString(label), value, html.EscapeString(sub))
}

func renderDigestMembersSectionHTML(members []DigestMemberHighlight) string {
	if len(members) == 0 {
		return `<p style="font-size:12px;color:#64748b;margin:0;">Bugün yeni müşteri kaydı oluşmadı.</p>`
	}
	var sb strings.Builder
	sb.WriteString(`<table style="width:100%;font-size:12px;border-collapse:collapse;">`)
	for _, m := range members {
		sb.WriteString(fmt.Sprintf(`<tr style="border-bottom:1px solid #f1f5f9;">
          <td style="padding:7px 4px;font-weight:700;color:#0f172a;">%s</td>
          <td style="padding:7px 4px;color:#0284c7;">%s</td>
          <td style="padding:7px 4px;color:#475569;text-align:right;">%s • %s</td>
        </tr>`, html.EscapeString(m.FullName), html.EscapeString(m.Email), html.EscapeString(m.Country), html.EscapeString(m.CreatedAt)))
	}
	sb.WriteString(`</table>`)
	return sb.String()
}

func renderDigestOrdersSectionHTML(orders []DigestOrderHighlight) string {
	if len(orders) == 0 {
		return `<p style="font-size:12px;color:#64748b;margin:0;">Bugün yeni sipariş oluşmadı.</p>`
	}
	var sb strings.Builder
	sb.WriteString(`<table style="width:100%;font-size:12px;border-collapse:collapse;">`)
	for _, o := range orders {
		sb.WriteString(fmt.Sprintf(`<tr style="border-bottom:1px solid #f1f5f9;">
          <td style="padding:7px 4px;font-family:monospace;font-weight:700;color:#0f172a;">#%s</td>
          <td style="padding:7px 4px;color:#334155;">%s</td>
          <td style="padding:7px 4px;color:#059669;font-weight:800;text-align:right;">%s (%s)</td>
        </tr>`, html.EscapeString(o.OrderNumber), html.EscapeString(o.CustomerName), html.EscapeString(o.AmountText), html.EscapeString(o.CreatedAt)))
	}
	sb.WriteString(`</table>`)
	return sb.String()
}

// BuildDailyDigestEmailBodies builds the daily operational summary report email.
func BuildDailyDigestEmailBodies(data DailyDigestEmailData) (subject, htmlBody, textBody string) {
	dateLabel := data.ReportDateFormatted
	if dateLabel == "" {
		dateLabel = data.ReportDate
	}
	revenueLabel := data.OrdersRevenueFormatted
	if revenueLabel == "" {
		revenueLabel = fmt.Sprintf("%.2f TL", data.OrdersRevenueTRYToday)
	}

	subject = fmt.Sprintf("📊 Günlük B2B Özet (%s): %d Yeni Üye • %d Sipariş • +%d / -%d Ürün",
		dateLabel, data.NewCustomersToday, data.NewOrdersToday, data.ProductsAddedToday, data.ProductsDeactivatedToday+data.ProductsDeletedToday)

	textBody = fmt.Sprintf(`MERTER VİTRİNİ GÜNLÜK OPERASYON ÖZETİ (%s)
Oluşturulma Zamanı: %s

1. ÜYELER & SİPARİŞLER
• Bugün Kaydolan Yeni Üye: %d (Toplam Aktif Müşteri: %d)
• Bugün Gelen Sipariş: %d (Tahmini Ciro: %s)
• Bugünkü Doğrudan Talep / Teklif: %d
• Aktif Tamamlanmamış Sepet: %d

2. KATALOG & ÜRÜN HAREKETLERİ
• Bugün Eklenen Yeni Ürün: %d
• Bugün Kapatılan (Pasife Alınan) Ürün: %d
• Bugün Arşivlenen Ürün: %d
• Bugün Silinen Ürün: %d
• Güncel Yayındaki Aktif Ürün: %d

3. SİSTEM & TEDARİKÇİ OPERASYONU
• Tamamlanan XML Senkronizasyonu: %d (Hatalı: %d)
• Yeni Tedarikçi Başvurusu: %d

Yönetim Paneli: https://mertervitrini.com.tr/admin/dashboard`,
		dateLabel, data.GeneratedAt,
		data.NewCustomersToday, data.TotalActiveCustomers,
		data.NewOrdersToday, revenueLabel,
		data.InquiriesToday, data.ActiveUnfinishedCarts,
		data.ProductsAddedToday, data.ProductsDeactivatedToday,
		data.ProductsArchivedToday, data.ProductsDeletedToday, data.TotalActiveProducts,
		data.XMLSyncsCompletedToday, data.XMLSyncsFailedToday, data.SupplierApplicationsToday)

	kpiGridHTML := fmt.Sprintf(`
      <table style="width:100%%;border-collapse:collapse;margin-bottom:18px;">
        <tr>
          %s
          %s
        </tr>
        <tr>
          %s
          %s
        </tr>
        <tr>
          %s
          %s
        </tr>
        <tr>
          %s
          %s
        </tr>
      </table>`,
		renderDigestStatCell("Bugün Kaydolan Üye", data.NewCustomersToday, fmt.Sprintf("Toplam %d aktif müşteri", data.TotalActiveCustomers), "#0284c7"),
		renderDigestStatCell("Bugün Gelen Sipariş", data.NewOrdersToday, fmt.Sprintf("Ciro: %s • Talep: %d", revenueLabel, data.InquiriesToday), "#059669"),
		renderDigestStatCell("Bugün Eklenen Ürün", data.ProductsAddedToday, fmt.Sprintf("Yayındaki toplam aktif ürün: %d", data.TotalActiveProducts), "#7c3aed"),
		renderDigestStatCell("Kapatılan / Pasif Ürün", data.ProductsDeactivatedToday, fmt.Sprintf("Arşivlenen: %d • XML / Stüdyo", data.ProductsArchivedToday), "#d97706"),
		renderDigestStatCell("Bugün Silinen Ürün", data.ProductsDeletedToday, "Soft + kalıcı silme kayıtları", "#e11d48"),
		renderDigestStatCell("Tamamlanmamış Sepet", data.ActiveUnfinishedCarts, "Sepetinde ürün bekleyen müşteri", "#6366f1"),
		renderDigestStatCell("XML Senkronizasyon", data.XMLSyncsCompletedToday, fmt.Sprintf("Hatalı XML sync: %d", data.XMLSyncsFailedToday), "#0d9488"),
		renderDigestStatCell("Tedarikçi Başvurusu", data.SupplierApplicationsToday, "Bugün gelen yeni başvuru", "#475569"),
	)

	htmlBody = fmt.Sprintf(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f1f5f9;padding:24px 12px;color:#1e293b;margin:0;">
  <div style="max-width:650px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid #cbd5e1;padding:30px;box-shadow:0 10px 15px -3px rgba(0,0,0,0.07);">
    <div style="text-align:center;border-bottom:2px solid #f1f5f9;padding-bottom:18px;margin-bottom:22px;">
      <h2 style="color:#0f172a;margin:0;font-size:24px;font-weight:900;">MERTER VİTRİNİ</h2>
      <p style="color:#7c3aed;font-size:11px;font-weight:800;letter-spacing:2px;margin:4px 0 0 0;text-transform:uppercase;">Günlük B2B Operasyon Özet Raporu</p>
      <p style="color:#64748b;font-size:12px;margin:8px 0 0 0;">Tarih: <strong>%s</strong> • Oluşturma: %s (İstanbul)</p>
    </div>

    %s

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:16px;">
      <div style="font-size:12px;font-weight:800;color:#0f172a;margin-bottom:10px;">👥 Bugün Kaydolan Son Müşteriler</div>
      %s
    </div>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:22px;">
      <div style="font-size:12px;font-weight:800;color:#0f172a;margin-bottom:10px;">🛒 Bugün Oluşturulan Son Siparişler</div>
      %s
    </div>

    <div style="text-align:center;">
      <a href="https://mertervitrini.com.tr/admin/dashboard" style="background-color:#0f172a;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:800;font-size:13px;display:inline-block;">Yönetim Paneline Git →</a>
      <a href="https://mertervitrini.com.tr/admin/settings/notifications" style="background-color:#ffffff;color:#0f172a;border:1px solid #cbd5e1;text-decoration:none;padding:11px 18px;border-radius:10px;font-weight:700;font-size:13px;display:inline-block;margin-left:8px;">Bildirim Ayarları</a>
    </div>

    <div style="border-top:1px solid #f1f5f9;padding-top:16px;margin-top:24px;text-align:center;font-size:11px;color:#94a3b8;">
      © 2026 Merter Vitrini B2B E-Ticaret Platformu • Otomatik Günlük Yönetici Raporu
    </div>
  </div>
</body>
</html>`,
		html.EscapeString(dateLabel), html.EscapeString(data.GeneratedAt),
		kpiGridHTML,
		renderDigestMembersSectionHTML(data.RecentMembers),
		renderDigestOrdersSectionHTML(data.RecentOrders))

	return subject, htmlBody, textBody
}

// BuildTestEventEmailBodies builds a realistic sample email for admin notification settings testing.
func BuildTestEventEmailBodies(eventKey string) (subject, htmlBody, textBody string) {
	nowTR := time.Now().Format(dateTimeFormatTR)
	switch eventKey {
	case EventNewOrder:
		return BuildOrderCreatedAdminEmailBodies(OrderAdminNotificationData{
			OrderNumber:      "TEST-20261115-001",
			ChannelLabel:     "B2B Mağaza Sepet Siparişi",
			PaymentMethod:    "BANK_TRANSFER",
			CustomerName:     "Örnek Butik (Test Müşteri)",
			CustomerCompany:  "Örnek Tekstil Ltd.",
			CustomerEmail:    "ornek-musteri@mertervitrini.com.tr",
			CustomerPhone:    "+90 533 000 00 00",
			DeliveryAddress:  "Mehmet Nesih Özmen Mah. Merter / İstanbul",
			TotalAmountTRY:   24500,
			TotalSummaryText: "520.00 USD + 6.300,00 TL",
			Items: []OrderAdminNotificationItem{
				{Title: "Örnek Toptan Triko Takım (4'lü Seri)", SKU: "MIMOZA-TEST-01", Quantity: 5, UnitPrice: 104, Currency: "USD"},
			},
			Meta: ClientMeta{
				IP:        "2a02:4e0:2d14::1",
				IPVersion: "IPv6",
				Country:   "Türkiye",
				City:      "İstanbul",
				ISP:       "Turkcell Superonline",
				Device:    "Android Cihaz",
				Browser:   "Google Chrome",
			},
			IsTest: true,
		})
	case EventSupplierOnboarding:
		subject = "[TEST] 🏢 Örnek Tedarikçi / Hizmet Sağlayıcı Bildirimi — Merter Vitrini"
		textBody = fmt.Sprintf("Bu e-posta Merter Vitrini Admin Bildirim Merkezi üzerinden 'Tedarikçi & Hizmet Sağlayıcı Başvuruları' test gönderimidir.\nTarih: %s", nowTR)
		htmlBody = fmt.Sprintf(`<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;">
          <h2 style="margin:0 0 8px 0;color:#0f172a;">[TEST] Tedarikçi Bildirimi Başarılı</h2>
          <p style="color:#475569;font-size:14px;">Bu e-posta <strong>Tedarikçi &amp; Hizmet Sağlayıcı Başvuru</strong> bildirim kanalının To/CC alıcı listesini doğrulamak amacıyla gönderilmiştir.</p>
          <p style="color:#64748b;font-size:12px;">Zaman: %s</p>
        </div>`, html.EscapeString(nowTR))
		return subject, htmlBody, textBody
	default:
		subject = "[TEST] 👤 Örnek Yeni Müşteri Kaydı Bildirimi — Merter Vitrini"
		textBody = fmt.Sprintf("Bu e-posta Merter Vitrini Admin Bildirim Merkezi üzerinden 'Yeni Müşteri Kaydı' test gönderimidir.\nIPv6 Örnek: 2a02:4e0:2d14::1\nTarih: %s", nowTR)
		htmlBody = fmt.Sprintf(`<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;">
          <h2 style="margin:0 0 8px 0;color:#0f172a;">[TEST] Yeni Müşteri Kaydı Bildirimi</h2>
          <p style="color:#475569;font-size:14px;">Bu e-posta <strong>Yeni Müşteri Kaydı</strong> kanalının To/CC alıcı ayarlarını doğrulamak için gönderilmiştir.</p>
          <p style="color:#0369a1;font-size:13px;font-weight:700;">Hesap Türü: Müşteri</p>
          %s
          <p style="color:#64748b;font-size:12px;margin-top:16px;">Zaman: %s</p>
        </div>`, formatGeoLocationHTML(ClientMeta{
			IP:        "2a02:4e0:2d14::1",
			IPVersion: "IPv6",
			Country:   "Türkiye",
			City:      "İstanbul",
			ISP:       "Turkcell Mobil (IPv6)",
			Device:    "Android Cihaz",
			Browser:   "Google Chrome",
		}), html.EscapeString(nowTR))
		return subject, htmlBody, textBody
	}
}
