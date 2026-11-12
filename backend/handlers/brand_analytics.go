package handlers

import (
	"context"
	"encoding/json"
	"math"
	"net/http"
	"strings"
	"time"

	"mertervitrini/backend/db"
	"mertervitrini/backend/middleware"
)

var allowedBrandEventTypes = map[string]bool{
	"profile_view":   true,
	"product_view":   true,
	"whatsapp_click": true,
	"phone_click":    true,
	"email_click":    true,
	"website_click":  true,
	"inquiry_submit": true,
	"chat_start":     true,
}

var countryCodeLabels = map[string]string{
	"TR": "🇹🇷 Türkiye",
	"RU": "🇷🇺 Rusya & BDT",
	"DE": "🇩🇪 Almanya",
	"AE": "🇦🇪 BAE & Körfez (GCC)",
	"SA": "🇸🇦 Suudi Arabistan",
	"IQ": "🇮🇶 Irak",
	"KZ": "🇰🇿 Kazakistan",
	"UZ": "🇺🇿 Özbekistan",
	"AZ": "🇦🇿 Azerbaycan",
	"PL": "🇵🇱 Polonya",
	"BG": "🇧🇬 Bulgaristan",
	"RO": "🇷🇴 Romanya",
	"FR": "🇫🇷 Fransa",
	"GB": "🇬🇧 Birleşik Krallık",
	"US": "🇺🇸 ABD",
	"NL": "🇳🇱 Hollanda",
	"IT": "🇮🇹 İtalya",
	"ES": "🇪🇸 İspanya",
	"DZ": "🇩🇿 Cezayir",
	"MA": "🇲🇦 Fas",
	"EG": "🇪🇬 Mısır",
	"EU": "🇪🇺 Avrupa Pazarı",
}

// TrackBrandEventRequest represents a supplier interaction event from web or mobile.
type TrackBrandEventRequest struct {
	BrandID     string `json:"brand_id"`
	ProductID   string `json:"product_id,omitempty"`
	EventType   string `json:"event_type"`
	VisitorID   string `json:"visitor_id,omitempty"`
	AuthToken   string `json:"auth_token,omitempty"`
	CountryCode string `json:"country_code,omitempty"`
	Language    string `json:"language,omitempty"`
}

// SupplierBrandAnalyticsSummary holds top-level ROI KPIs for a supplier.
type SupplierBrandAnalyticsSummary struct {
	ProfileViews       int `json:"profile_views"`
	ProductViews       int `json:"product_views"`
	UniqueVisitors     int `json:"unique_visitors"`
	WhatsappClicks     int `json:"whatsapp_clicks"`
	PhoneClicks        int `json:"phone_clicks"`
	EmailWebsiteClicks int `json:"email_website_clicks"`
	InquiryLeads       int `json:"inquiry_leads"`
	LiveChatRooms      int `json:"live_chat_rooms"`
	TotalBuyerContacts int `json:"total_buyer_contacts"`
}

// BrandCountryStat represents country-level interest distribution for a supplier.
type BrandCountryStat struct {
	CountryCode  string  `json:"country_code"`
	CountryLabel string  `json:"country_label"`
	Views        int     `json:"views"`
	Contacts     int     `json:"contacts"`
	Percentage   float64 `json:"percentage"`
}

// BrandTopProductStat represents the most viewed/contacted products of a supplier.
type BrandTopProductStat struct {
	ProductID      string `json:"product_id"`
	Title          string `json:"title"`
	CustomSKU      string `json:"custom_sku"`
	Slug           string `json:"slug"`
	Views          int    `json:"views"`
	WhatsappClicks int    `json:"whatsapp_clicks"`
	Inquiries      int    `json:"inquiries"`
}

// BrandDailyStat represents daily views and buyer contacts for a supplier.
type BrandDailyStat struct {
	Date     string `json:"date"`
	Views    int    `json:"views"`
	Contacts int    `json:"contacts"`
}

// SupplierBrandAnalyticsResponse is returned by GET /api/v1/supplier/analytics.
type SupplierBrandAnalyticsResponse struct {
	Period              string                        `json:"period"`
	Summary             SupplierBrandAnalyticsSummary `json:"summary"`
	CountryDistribution []BrandCountryStat            `json:"country_distribution"`
	TopProducts         []BrandTopProductStat         `json:"top_products"`
	DailyTrend          []BrandDailyStat              `json:"daily_trend"`
}

func resolveVisitorLang(r *http.Request, explicitLang string) string {
	lang := strings.ToLower(strings.TrimSpace(explicitLang))
	if lang == "" && r != nil {
		acceptLang := strings.ToLower(r.Header.Get("Accept-Language"))
		if len(acceptLang) >= 2 {
			lang = acceptLang[:2]
		}
	}
	if lang == "" || len(lang) > 5 {
		lang = "tr"
	}
	return lang
}

func fallbackCountryForLang(lang string) string {
	switch lang {
	case "ru":
		return "RU"
	case "ar":
		return "AE"
	case "de":
		return "DE"
	case "fr":
		return "FR"
	case "pl":
		return "PL"
	case "bg":
		return "BG"
	case "en":
		return "EU"
	default:
		return "TR"
	}
}

func resolveVisitorCountry(r *http.Request, explicitCountry, lang string) string {
	country := strings.ToUpper(strings.TrimSpace(explicitCountry))
	if country == "" && r != nil {
		for _, hdr := range []string{"CF-IPCountry", "X-Country-Code", "X-Geo-Country"} {
			val := strings.ToUpper(strings.TrimSpace(r.Header.Get(hdr)))
			if len(val) == 2 && val != "XX" {
				country = val
				break
			}
		}
	}

	if len(country) != 2 {
		return fallbackCountryForLang(lang)
	}
	return country
}

func resolveVisitorCountryAndLang(r *http.Request, explicitCountry, explicitLang string) (string, string) {
	lang := resolveVisitorLang(r, explicitLang)
	country := resolveVisitorCountry(r, explicitCountry, lang)
	return country, lang
}

func formatCountryLabel(code string) string {
	upper := strings.ToUpper(strings.TrimSpace(code))
	if label, ok := countryCodeLabels[upper]; ok {
		return label
	}
	if upper == "" {
		return "🌍 Küresel Alıcı"
	}
	return "🌍 " + upper
}

type brandEventRecordParams struct {
	BrandID     string
	ProductID   string
	EventType   string
	VisitorID   string
	CountryCode string
	LangCode    string
	DeviceType  string
	RefHost     string
}

// RecordBrandAnalyticsEvent asynchronously records a brand event from backend handlers.
func RecordBrandAnalyticsEvent(brandID, productID, eventType string, r *http.Request) {
	brandID = strings.TrimSpace(brandID)
	eventType = strings.TrimSpace(eventType)
	if brandID == "" || !allowedBrandEventTypes[eventType] || db.Pool == nil {
		return
	}

	var visitorID, deviceType, refHost string
	countryCode, langCode := resolveVisitorCountryAndLang(r, "", "")
	if r != nil {
		ip := getClientIP(r)
		visitorID = hashIP(ip)
		deviceType, _, _ = parseDeviceAndBrowser(r.UserAgent(), 0)
		refHost = parseReferrerHost(r.Referer())
	} else {
		visitorID = "system"
		deviceType = "desktop"
	}

	go insertBrandEventRecord(brandEventRecordParams{
		BrandID:     brandID,
		ProductID:   strings.TrimSpace(productID),
		EventType:   eventType,
		VisitorID:   visitorID,
		CountryCode: countryCode,
		LangCode:    langCode,
		DeviceType:  deviceType,
		RefHost:     refHost,
	})
}

func insertBrandEventRecord(p brandEventRecordParams) {
	if db.Pool == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 4*time.Second)
	defer cancel()

	var prodPtr *string
	if p.ProductID != "" {
		prodPtr = &p.ProductID
	}

	_, _ = db.Pool.Exec(ctx, `
		INSERT INTO analytics.brand_events (
			brand_id, product_id, event_type, visitor_id, country_code, language_code, device_type, referrer_host
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`, p.BrandID, prodPtr, p.EventType, p.VisitorID, p.CountryCode, p.LangCode, p.DeviceType, p.RefHost)
}

// TrackBrandEvent handles POST /api/v1/store/brand-events from web & mobile clients.
func (h *AnalyticsHandler) TrackBrandEvent(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Visitor-Id")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var req TrackBrandEventRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid json"}`, http.StatusBadRequest)
		return
	}

	brandID := strings.TrimSpace(req.BrandID)
	eventType := strings.TrimSpace(req.EventType)
	if brandID == "" || !allowedBrandEventTypes[eventType] {
		http.Error(w, `{"error":"invalid brand_id or event_type"}`, http.StatusBadRequest)
		return
	}

	visitorID := strings.TrimSpace(req.VisitorID)
	if visitorID == "" {
		visitorID = hashIP(getClientIP(r))
	}
	userID := resolveAuthenticatedMemberID(r, req.AuthToken)
	countryCode, langCode := resolveVisitorCountryAndLang(r, req.CountryCode, req.Language)
	deviceType, _, _ := parseDeviceAndBrowser(r.UserAgent(), 0)
	refHost := parseReferrerHost(r.Referer())

	go insertBrandEventRecord(brandEventRecordParams{
		BrandID:     brandID,
		ProductID:   strings.TrimSpace(req.ProductID),
		EventType:   eventType,
		VisitorID:   visitorID,
		CountryCode: countryCode,
		LangCode:    langCode,
		DeviceType:  deviceType,
		RefHost:     refHost,
	})

	if eventType != "product_view" && eventType != "profile_view" {
		recordBrandContactMemberEvent(r, userID, visitorID, brandID, strings.TrimSpace(req.ProductID), eventType)
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	w.Write([]byte(`{"ok":true}`))
}

func recordBrandContactMemberEvent(r *http.Request, userID, visitorID, brandID, productID, eventType string) {
	RecordMemberActivityAsync(r, MemberActivityInput{
		UserID:        userID,
		VisitorID:     visitorID,
		EventType:     eventType,
		EventCategory: "engagement",
		Title:         brandInteractionLabel(brandID, productID, eventType),
		EntityType:    "brand",
		EntityID:      brandID,
		Metadata: map[string]any{
			"brand_id":   brandID,
			"product_id": productID,
		},
	})
}

func brandInteractionLabel(brandID, productID, eventType string) string {
	brandName := "Üretici Firma"
	prodTitle := ""
	if db.Pool != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		_ = db.Pool.QueryRow(ctx, `SELECT brand_name FROM catalog.brands WHERE id::text = $1 LIMIT 1`, brandID).Scan(&brandName)
		if productID != "" {
			_ = db.Pool.QueryRow(ctx, `SELECT title FROM catalog.products WHERE id::text = $1 LIMIT 1`, productID).Scan(&prodTitle)
		}
	}
	target := "“" + brandName + "”"
	if prodTitle != "" {
		target += " (" + prodTitle + ")"
	}
	switch eventType {
	case "whatsapp_click":
		return target + " için WhatsApp iletişimine tıkladı"
	case "phone_click":
		return target + " telefon numarasına tıkladı"
	case "email_click":
		return target + " e-posta iletişimine tıkladı"
	case "website_click":
		return target + " web sitesi bağlantısına tıkladı"
	case "chat_start":
		return target + " ile canlı sohbet penceresini açtı"
	default:
		return target + " ile iletişime geçti"
	}
}

func resolveSupplierAnalyticsPeriod(raw string) (time.Time, string) {
	now := time.Now().UTC()
	switch strings.TrimSpace(raw) {
	case "7d":
		return now.Add(-7 * 24 * time.Hour), "7d"
	case "90d":
		return now.Add(-90 * 24 * time.Hour), "90d"
	default:
		return now.Add(-30 * 24 * time.Hour), "30d"
	}
}

// GetSupplierBrandAnalytics handles GET /api/v1/supplier/analytics for the authenticated supplier.
func (h *AnalyticsHandler) GetSupplierBrandAnalytics(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.GetSupplierFromContext(r.Context())
	if !ok || claims.BrandID == "" {
		http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	since, period := resolveSupplierAnalyticsPeriod(r.URL.Query().Get("period"))
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	resp := SupplierBrandAnalyticsResponse{
		Period:              period,
		CountryDistribution: []BrandCountryStat{},
		TopProducts:         []BrandTopProductStat{},
		DailyTrend:          []BrandDailyStat{},
	}

	populateSupplierSummary(ctx, claims.BrandID, since, &resp.Summary)
	resp.CountryDistribution = fetchSupplierCountryStats(ctx, claims.BrandID, since)
	resp.TopProducts = fetchSupplierTopProducts(ctx, claims.BrandID, since)
	resp.DailyTrend = fetchSupplierDailyTrend(ctx, claims.BrandID, since)

	w.Header().Set(headerContentType, mimeApplicationJSON)
	json.NewEncoder(w).Encode(resp)
}

func populateSupplierSummary(ctx context.Context, brandID string, since time.Time, summary *SupplierBrandAnalyticsSummary) {
	_ = db.Pool.QueryRow(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE event_type = 'profile_view'),
			COUNT(*) FILTER (WHERE event_type = 'product_view'),
			COUNT(DISTINCT visitor_id),
			COUNT(*) FILTER (WHERE event_type = 'whatsapp_click'),
			COUNT(*) FILTER (WHERE event_type = 'phone_click'),
			COUNT(*) FILTER (WHERE event_type IN ('email_click', 'website_click')),
			COUNT(*) FILTER (WHERE event_type = 'inquiry_submit'),
			COUNT(*) FILTER (WHERE event_type = 'chat_start')
		FROM analytics.brand_events
		WHERE brand_id = $1 AND created_at >= $2
	`, brandID, since).Scan(
		&summary.ProfileViews,
		&summary.ProductViews,
		&summary.UniqueVisitors,
		&summary.WhatsappClicks,
		&summary.PhoneClicks,
		&summary.EmailWebsiteClicks,
		&summary.InquiryLeads,
		&summary.LiveChatRooms,
	)

	var subOrderCount int
	_ = db.Pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM catalog.supplier_sub_orders
		WHERE brand_id = $1 AND created_at >= $2
	`, brandID, since).Scan(&subOrderCount)
	if subOrderCount > summary.InquiryLeads {
		summary.InquiryLeads = subOrderCount
	}

	var chatRoomCount int
	_ = db.Pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM chat.rooms
		WHERE brand_id = $1 AND created_at >= $2
	`, brandID, since).Scan(&chatRoomCount)
	if chatRoomCount > summary.LiveChatRooms {
		summary.LiveChatRooms = chatRoomCount
	}

	summary.TotalBuyerContacts = summary.WhatsappClicks +
		summary.PhoneClicks +
		summary.EmailWebsiteClicks +
		summary.InquiryLeads +
		summary.LiveChatRooms
}

func fetchSupplierCountryStats(ctx context.Context, brandID string, since time.Time) []BrandCountryStat {
	rows, err := db.Pool.Query(ctx, `
		SELECT
			COALESCE(NULLIF(country_code, ''), 'TR') AS ccode,
			COUNT(*) FILTER (WHERE event_type IN ('profile_view', 'product_view')) AS views,
			COUNT(*) FILTER (WHERE event_type IN ('whatsapp_click', 'phone_click', 'email_click', 'website_click', 'inquiry_submit', 'chat_start')) AS contacts
		FROM analytics.brand_events
		WHERE brand_id = $1 AND created_at >= $2
		GROUP BY ccode
		ORDER BY (COUNT(*)) DESC
		LIMIT 10
	`, brandID, since)
	if err != nil {
		return []BrandCountryStat{}
	}
	defer rows.Close()

	stats := []BrandCountryStat{}
	totalActivity := 0
	for rows.Next() {
		var item BrandCountryStat
		if err := rows.Scan(&item.CountryCode, &item.Views, &item.Contacts); err == nil {
			item.CountryLabel = formatCountryLabel(item.CountryCode)
			totalActivity += item.Views + item.Contacts
			stats = append(stats, item)
		}
	}

	if totalActivity > 0 {
		for i := range stats {
			rawPct := (float64(stats[i].Views+stats[i].Contacts) / float64(totalActivity)) * 100.0
			stats[i].Percentage = math.Round(rawPct*10) / 10
		}
	}
	return stats
}

func fetchSupplierTopProducts(ctx context.Context, brandID string, since time.Time) []BrandTopProductStat {
	rows, err := db.Pool.Query(ctx, `
		SELECT
			p.id::text,
			p.title,
			COALESCE(p.custom_sku, ''),
			COALESCE(p.slug, p.id::text),
			COUNT(be.id) FILTER (WHERE be.event_type = 'product_view') AS views,
			COUNT(be.id) FILTER (WHERE be.event_type = 'whatsapp_click') AS wa_clicks,
			(
				SELECT COUNT(*)::int
				FROM catalog.supplier_sub_order_items soi
				JOIN catalog.supplier_sub_orders so ON so.id = soi.sub_order_id
				WHERE soi.product_id = p.id AND so.brand_id = $1 AND so.created_at >= $2
			) AS inquiries
		FROM catalog.products p
		LEFT JOIN analytics.brand_events be
			ON be.product_id = p.id AND be.brand_id = $1 AND be.created_at >= $2
		WHERE p.brand_id = $1 AND p.is_active = true
		GROUP BY p.id, p.title, p.custom_sku, p.slug
		ORDER BY
			COUNT(be.id) FILTER (WHERE be.event_type = 'product_view') DESC,
			COUNT(be.id) FILTER (WHERE be.event_type = 'whatsapp_click') DESC,
			p.created_at DESC
		LIMIT 10
	`, brandID, since)
	if err != nil {
		return []BrandTopProductStat{}
	}
	defer rows.Close()

	items := []BrandTopProductStat{}
	for rows.Next() {
		var it BrandTopProductStat
		if err := rows.Scan(&it.ProductID, &it.Title, &it.CustomSKU, &it.Slug, &it.Views, &it.WhatsappClicks, &it.Inquiries); err == nil {
			items = append(items, it)
		}
	}
	return items
}

func fetchSupplierDailyTrend(ctx context.Context, brandID string, since time.Time) []BrandDailyStat {
	rows, err := db.Pool.Query(ctx, `
		SELECT
			TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
			COUNT(*) FILTER (WHERE event_type IN ('profile_view', 'product_view')) AS views,
			COUNT(*) FILTER (WHERE event_type IN ('whatsapp_click', 'phone_click', 'email_click', 'website_click', 'inquiry_submit', 'chat_start')) AS contacts
		FROM analytics.brand_events
		WHERE brand_id = $1 AND created_at >= $2
		GROUP BY day
		ORDER BY day ASC
	`, brandID, since)
	if err != nil {
		return []BrandDailyStat{}
	}
	defer rows.Close()

	trend := []BrandDailyStat{}
	for rows.Next() {
		var pt BrandDailyStat
		if err := rows.Scan(&pt.Date, &pt.Views, &pt.Contacts); err == nil {
			trend = append(trend, pt)
		}
	}
	return trend
}

