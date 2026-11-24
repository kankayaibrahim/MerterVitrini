package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"mertervitrini/backend/db"
	"mertervitrini/backend/pkg/safe"
)

const (
	whatsappBrandFilterPlatform = "platform"
	whatsappActorCustomer       = "customer"
	whatsappActorGuest          = "guest"
	whatsappPlatformBrandName   = "Merter Vitrini (Genel Mağaza Hattı)"
	whatsappGuestLabel          = "Misafir Ziyaretçi"
)

var (
	whatsappClicksSchemaOnce sync.Once
	whatsappClicksSchemaErr  error
)

// EnsureWhatsappClicksSchema ensures analytics.whatsapp_clicks and its indexes exist.
func EnsureWhatsappClicksSchema(ctx context.Context) error {
	if db.Pool == nil {
		return nil
	}
	whatsappClicksSchemaOnce.Do(func() {
		ddl := `
			CREATE SCHEMA IF NOT EXISTS analytics;
			CREATE TABLE IF NOT EXISTS analytics.whatsapp_clicks (
				id UUID PRIMARY KEY DEFAULT uuidv7(),
				brand_id UUID NULL REFERENCES catalog.brands(id) ON DELETE SET NULL,
				product_id UUID NULL REFERENCES catalog.products(id) ON DELETE SET NULL,
				user_id VARCHAR(128) NOT NULL DEFAULT '',
				visitor_id VARCHAR(128) NOT NULL DEFAULT '',
				target_phone VARCHAR(64) NOT NULL DEFAULT '',
				source_surface VARCHAR(64) NOT NULL DEFAULT '',
				page_path VARCHAR(500) NOT NULL DEFAULT '',
				country_code VARCHAR(10) NOT NULL DEFAULT 'TR',
				language_code VARCHAR(10) NOT NULL DEFAULT 'tr',
				device_type VARCHAR(30) NOT NULL DEFAULT 'desktop',
				ip_address VARCHAR(64) NOT NULL DEFAULT '',
				referrer_host VARCHAR(255) NOT NULL DEFAULT '',
				created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			);
			CREATE INDEX IF NOT EXISTS idx_whatsapp_clicks_created_at ON analytics.whatsapp_clicks(created_at DESC);
			CREATE INDEX IF NOT EXISTS idx_whatsapp_clicks_brand_created ON analytics.whatsapp_clicks(brand_id, created_at DESC);
			CREATE INDEX IF NOT EXISTS idx_whatsapp_clicks_user_id ON analytics.whatsapp_clicks(user_id) WHERE user_id <> '';
			CREATE INDEX IF NOT EXISTS idx_whatsapp_clicks_visitor_id ON analytics.whatsapp_clicks(visitor_id) WHERE visitor_id <> '';
		`
		_, whatsappClicksSchemaErr = db.Pool.Exec(ctx, ddl)
	})
	return whatsappClicksSchemaErr
}

// WhatsappClickInput carries attributes captured when a customer or visitor clicks a WhatsApp CTA.
type WhatsappClickInput struct {
	BrandID       string
	ProductID     string
	UserID        string
	VisitorID     string
	TargetPhone   string
	SourceSurface string
	PagePath      string
	CountryCode   string
	LangCode      string
}

type whatsappClickPrepared struct {
	BrandID       *string
	ProductID     *string
	RawBrandID    string
	UserID        string
	VisitorID     string
	TargetPhone   string
	SourceSurface string
	PagePath      string
	CountryCode   string
	LangCode      string
	DeviceType    string
	IPAddress     string
	ReferrerHost  string
}

// WhatsappClicksSummary holds headline WhatsApp click attribution KPIs for the admin report.
type WhatsappClicksSummary struct {
	TotalClicks     int `json:"total_clicks"`
	UniquePeople    int `json:"unique_people"`
	CustomerClicks  int `json:"customer_clicks"`
	GuestClicks     int `json:"guest_clicks"`
	UniqueCustomers int `json:"unique_customers"`
	SupplierClicks  int `json:"supplier_clicks"`
	PlatformClicks  int `json:"platform_clicks"`
}

// WhatsappSupplierBreakdown aggregates WhatsApp engagement per supplier and general storefront line.
type WhatsappSupplierBreakdown struct {
	BrandID         string     `json:"brand_id"`
	BrandName       string     `json:"brand_name"`
	Slug            string     `json:"slug"`
	WhatsappPhone   string     `json:"whatsapp_phone"`
	TotalClicks     int        `json:"total_clicks"`
	UniquePeople    int        `json:"unique_people"`
	CustomerClicks  int        `json:"customer_clicks"`
	UniqueCustomers int        `json:"unique_customers"`
	ProductClicks   int        `json:"product_clicks"`
	LastClickedAt   *time.Time `json:"last_clicked_at"`
}

// WhatsappProductStat summarizes the top products generating WhatsApp clicks.
type WhatsappProductStat struct {
	ProductID       string `json:"product_id"`
	Title           string `json:"title"`
	CustomSKU       string `json:"custom_sku"`
	Slug            string `json:"slug"`
	BrandID         string `json:"brand_id"`
	BrandName       string `json:"brand_name"`
	TotalClicks     int    `json:"total_clicks"`
	UniqueCustomers int    `json:"unique_customers"`
	UniquePeople    int    `json:"unique_people"`
}

// WhatsappClickLogItem represents one detailed customer/visitor -> supplier/product WhatsApp click log row.
type WhatsappClickLogItem struct {
	ID            string    `json:"id"`
	CreatedAt     time.Time `json:"created_at"`
	UserID        string    `json:"user_id"`
	ActorType     string    `json:"actor_type"`
	CustomerName  string    `json:"customer_name"`
	CustomerEmail string    `json:"customer_email"`
	CustomerPhone string    `json:"customer_phone"`
	VisitorID     string    `json:"visitor_id"`
	BrandID       string    `json:"brand_id"`
	BrandName     string    `json:"brand_name"`
	BrandSlug     string    `json:"brand_slug"`
	TargetPhone   string    `json:"target_phone"`
	ProductID     string    `json:"product_id"`
	ProductTitle  string    `json:"product_title"`
	ProductSKU    string    `json:"product_sku"`
	ProductSlug   string    `json:"product_slug"`
	ProductImage  string    `json:"product_image"`
	SourceSurface string    `json:"source_surface"`
	PagePath      string    `json:"page_path"`
	CountryCode   string    `json:"country_code"`
	LanguageCode  string    `json:"language_code"`
	DeviceType    string    `json:"device_type"`
	IPAddress     string    `json:"ip_address"`
}

// AdminWhatsappClicksResponse is returned by GET /api/v1/admin/analytics/whatsapp-clicks.
type AdminWhatsappClicksResponse struct {
	Period     string                      `json:"period"`
	Summary    WhatsappClicksSummary       `json:"summary"`
	BySupplier []WhatsappSupplierBreakdown `json:"by_supplier"`
	TopProducts []WhatsappProductStat      `json:"top_products"`
	Logs       []WhatsappClickLogItem      `json:"logs"`
	TotalLogs  int                         `json:"total_logs"`
}

type whatsappFilterParams struct {
	Period    string
	Since     *time.Time
	BrandID   string
	ActorType string
	Search    string
	Limit     int
	Offset    int
}

func isValidUUIDString(raw string) bool {
	s := strings.TrimSpace(raw)
	if len(s) != 36 {
		return false
	}
	for i := 0; i < 36; i++ {
		c := s[i]
		if i == 8 || i == 13 || i == 18 || i == 23 {
			if c != '-' {
				return false
			}
			continue
		}
		isHexDigit := (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')
		if !isHexDigit {
			return false
		}
	}
	return true
}

func optionalUUIDPtr(raw string) *string {
	trimmed := strings.TrimSpace(raw)
	if !isValidUUIDString(trimmed) {
		return nil
	}
	return &trimmed
}

func extractPathFromReferer(rawReferer string) string {
	trimmed := strings.TrimSpace(rawReferer)
	if trimmed == "" {
		return ""
	}
	parsed, err := url.Parse(trimmed)
	if err != nil {
		return ""
	}
	if parsed.RawQuery != "" {
		return truncateStr(parsed.Path+"?"+parsed.RawQuery, 480)
	}
	return truncateStr(parsed.Path, 480)
}

func resolveWhatsappTargetPhone(ctx context.Context, brandID, explicitPhone string) string {
	cleaned := strings.TrimSpace(explicitPhone)
	if cleaned != "" {
		return truncateStr(cleaned, 60)
	}
	if db.Pool == nil {
		return ""
	}
	var resolved string
	if isValidUUIDString(brandID) {
		_ = db.Pool.QueryRow(ctx, `
			SELECT COALESCE(NULLIF(whatsapp_phone, ''), NULLIF(phone, ''), '')
			FROM catalog.brands
			WHERE id::text = $1
			LIMIT 1
		`, brandID).Scan(&resolved)
		return truncateStr(strings.TrimSpace(resolved), 60)
	}
	_ = db.Pool.QueryRow(ctx, `SELECT COALESCE(whatsapp, '') FROM catalog.settings LIMIT 1`).Scan(&resolved)
	return truncateStr(strings.TrimSpace(resolved), 60)
}

func prepareWhatsappClickData(r *http.Request, in WhatsappClickInput) whatsappClickPrepared {
	cleanBrand := strings.TrimSpace(in.BrandID)
	cleanProd := strings.TrimSpace(in.ProductID)
	countryCode, langCode := resolveVisitorCountryAndLang(r, in.CountryCode, in.LangCode)

	deviceType := "desktop"
	var ipAddr, refHost, visitorHdr, refererPath string
	if r != nil {
		ipAddr = truncateStr(getClientIP(r), 60)
		deviceType, _, _ = parseDeviceAndBrowser(r.UserAgent(), 0)
		refHost = truncateStr(parseReferrerHost(r.Referer()), 240)
		visitorHdr = strings.TrimSpace(r.Header.Get(headerVisitorID))
		refererPath = extractPathFromReferer(r.Referer())
	}

	pagePath := strings.TrimSpace(in.PagePath)
	if pagePath == "" {
		pagePath = refererPath
	}

	return whatsappClickPrepared{
		BrandID:       optionalUUIDPtr(cleanBrand),
		ProductID:     optionalUUIDPtr(cleanProd),
		RawBrandID:    cleanBrand,
		UserID:        truncateStr(strings.TrimSpace(in.UserID), 120),
		VisitorID:     truncateStr(firstNonEmptyStr(in.VisitorID, visitorHdr, hashIP(ipAddr)), 120),
		TargetPhone:   strings.TrimSpace(in.TargetPhone),
		SourceSurface: truncateStr(strings.TrimSpace(in.SourceSurface), 60),
		PagePath:      truncateStr(pagePath, 480),
		CountryCode:   truncateStr(countryCode, 8),
		LangCode:      truncateStr(langCode, 8),
		DeviceType:    truncateStr(deviceType, 28),
		IPAddress:     ipAddr,
		ReferrerHost:  refHost,
	}
}

// RecordWhatsappClickAsync persists a WhatsApp CTA click record asynchronously for admin reporting.
func RecordWhatsappClickAsync(r *http.Request, in WhatsappClickInput) {
	if db.Pool == nil {
		return
	}
	prep := prepareWhatsappClickData(r, in)

	safe.Go("RecordWhatsappClick", func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		if err := EnsureWhatsappClicksSchema(ctx); err != nil {
			log.Printf("[WHATSAPP ANALYTICS WARNING] schema init failed: %v", err)
			return
		}

		userID := prep.UserID
		if userID == "" && prep.VisitorID != "" {
			userID = lookupLinkedUserByVisitor(ctx, prep.VisitorID)
		}

		targetPhone := resolveWhatsappTargetPhone(ctx, prep.RawBrandID, prep.TargetPhone)
		_, err := db.Pool.Exec(ctx, `
			INSERT INTO analytics.whatsapp_clicks (
				brand_id, product_id, user_id, visitor_id, target_phone,
				source_surface, page_path, country_code, language_code,
				device_type, ip_address, referrer_host
			) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		`, prep.BrandID, prep.ProductID, userID, prep.VisitorID, targetPhone,
			prep.SourceSurface, prep.PagePath, prep.CountryCode, prep.LangCode,
			prep.DeviceType, prep.IPAddress, prep.ReferrerHost)
		if err != nil {
			log.Printf("[WHATSAPP ANALYTICS WARNING] insert failed: %v", err)
		}
	})

	if strings.TrimSpace(in.BrandID) == "" && prep.UserID != "" {
		RecordMemberActivityAsync(r, MemberActivityInput{
			UserID:        prep.UserID,
			VisitorID:     prep.VisitorID,
			EventType:     "whatsapp_click",
			EventCategory: "engagement",
			Title:         "Merter Vitrini WhatsApp hattına tıkladı",
			URLPath:       prep.PagePath,
			Metadata: map[string]any{
				"source_surface": prep.SourceSurface,
				"target_phone":   prep.TargetPhone,
			},
		})
	}
}

func resolveWhatsappPeriodSince(rawPeriod string) (string, *time.Time) {
	loc := istanbulLocation()
	now := time.Now().In(loc)
	switch strings.TrimSpace(rawPeriod) {
	case "today":
		start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
		return "today", &start
	case "24h":
		start := now.Add(-24 * time.Hour)
		return "24h", &start
	case "7d":
		start := now.Add(-7 * 24 * time.Hour)
		return "7d", &start
	case "90d":
		start := now.Add(-90 * 24 * time.Hour)
		return "90d", &start
	case "all":
		return "all", nil
	default:
		start := now.Add(-30 * 24 * time.Hour)
		return "30d", &start
	}
}

func normalizeWhatsappActorType(raw string) string {
	switch strings.TrimSpace(raw) {
	case whatsappActorCustomer:
		return whatsappActorCustomer
	case whatsappActorGuest:
		return whatsappActorGuest
	default:
		return "all"
	}
}

func parseWhatsappFilterParams(r *http.Request) whatsappFilterParams {
	q := r.URL.Query()
	period, since := resolveWhatsappPeriodSince(q.Get("period"))

	limit := 100
	if parsed, err := strconv.Atoi(strings.TrimSpace(q.Get("limit"))); err == nil && parsed > 0 {
		if parsed > 300 {
			parsed = 300
		}
		limit = parsed
	}

	offset := 0
	if parsed, err := strconv.Atoi(strings.TrimSpace(q.Get("offset"))); err == nil && parsed > 0 {
		offset = parsed
	}

	return whatsappFilterParams{
		Period:    period,
		Since:     since,
		BrandID:   strings.TrimSpace(q.Get("brand_id")),
		ActorType: normalizeWhatsappActorType(q.Get("actor_type")),
		Search:    strings.TrimSpace(q.Get("search")),
		Limit:     limit,
		Offset:    offset,
	}
}

func buildWhatsappFilterSQL(f whatsappFilterParams) (string, []any) {
	var conds []string
	var args []any

	if f.Since != nil {
		args = append(args, *f.Since)
		conds = append(conds, fmt.Sprintf("wc.created_at >= $%d", len(args)))
	}

	if f.BrandID == whatsappBrandFilterPlatform {
		conds = append(conds, "wc.brand_id IS NULL")
	} else if f.BrandID != "" {
		args = append(args, f.BrandID)
		conds = append(conds, fmt.Sprintf("wc.brand_id::text = $%d", len(args)))
	}

	switch f.ActorType {
	case whatsappActorCustomer:
		conds = append(conds, "COALESCE(wc.user_id, '') <> ''")
	case whatsappActorGuest:
		conds = append(conds, "COALESCE(wc.user_id, '') = ''")
	}

	if f.Search != "" {
		args = append(args, "%"+f.Search+"%")
		n := len(args)
		conds = append(conds, fmt.Sprintf(`(
			COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '') ILIKE $%d
			OR COALESCE(u.email, '') ILIKE $%d
			OR COALESCE(u.phone, '') ILIKE $%d
			OR COALESCE(b.brand_name, '') ILIKE $%d
			OR COALESCE(p.title, '') ILIKE $%d
			OR COALESCE(p.custom_sku, '') ILIKE $%d
			OR COALESCE(wc.target_phone, '') ILIKE $%d
			OR COALESCE(wc.ip_address, '') ILIKE $%d
		)`, n, n, n, n, n, n, n, n))
	}

	if len(conds) == 0 {
		return "WHERE 1=1", args
	}
	return "WHERE " + strings.Join(conds, " AND "), args
}

const whatsappBaseJoinsSQL = `
	FROM analytics.whatsapp_clicks wc
	LEFT JOIN catalog.brands b ON b.id = wc.brand_id
	LEFT JOIN catalog.products p ON p.id = wc.product_id
	LEFT JOIN identity.users u ON u.id = wc.user_id
`

func queryWhatsappSummaryKPIs(ctx context.Context, whereSQL string, args []any) WhatsappClicksSummary {
	var s WhatsappClicksSummary
	query := `
		SELECT
			COUNT(*)::int,
			COUNT(DISTINCT COALESCE(NULLIF(wc.user_id, ''), NULLIF(wc.visitor_id, ''), wc.id::text))::int,
			COUNT(*) FILTER (WHERE COALESCE(wc.user_id, '') <> '')::int,
			COUNT(*) FILTER (WHERE COALESCE(wc.user_id, '') = '')::int,
			COUNT(DISTINCT NULLIF(wc.user_id, ''))::int,
			COUNT(*) FILTER (WHERE wc.brand_id IS NOT NULL)::int,
			COUNT(*) FILTER (WHERE wc.brand_id IS NULL)::int
	` + whatsappBaseJoinsSQL + whereSQL

	_ = db.Pool.QueryRow(ctx, query, args...).Scan(
		&s.TotalClicks,
		&s.UniquePeople,
		&s.CustomerClicks,
		&s.GuestClicks,
		&s.UniqueCustomers,
		&s.SupplierClicks,
		&s.PlatformClicks,
	)
	return s
}

func queryWhatsappBySupplier(ctx context.Context, since *time.Time) []WhatsappSupplierBreakdown {
	var sinceArg any
	if since != nil {
		sinceArg = *since
	}

	supplierSQL := `
		SELECT
			b.id::text,
			b.brand_name,
			COALESCE(b.slug, ''),
			COALESCE(NULLIF(b.whatsapp_phone, ''), NULLIF(b.phone, ''), '') AS wa_phone,
			COUNT(wc.id)::int AS total_clicks,
			COUNT(DISTINCT COALESCE(NULLIF(wc.user_id, ''), NULLIF(wc.visitor_id, ''), wc.id::text)) FILTER (WHERE wc.id IS NOT NULL)::int AS unique_people,
			COUNT(wc.id) FILTER (WHERE COALESCE(wc.user_id, '') <> '')::int AS customer_clicks,
			COUNT(DISTINCT NULLIF(wc.user_id, '')) FILTER (WHERE wc.id IS NOT NULL)::int AS unique_customers,
			COUNT(wc.id) FILTER (WHERE wc.product_id IS NOT NULL)::int AS product_clicks,
			MAX(wc.created_at) AS last_clicked_at
		FROM catalog.brands b
		LEFT JOIN analytics.whatsapp_clicks wc
			ON wc.brand_id = b.id
			AND ($1::timestamptz IS NULL OR wc.created_at >= $1)
		WHERE b.is_active = true
		GROUP BY b.id, b.brand_name, b.slug, b.whatsapp_phone, b.phone
		HAVING COUNT(wc.id) > 0 OR COALESCE(NULLIF(b.whatsapp_phone, ''), NULLIF(b.phone, ''), '') <> ''
		ORDER BY total_clicks DESC, b.brand_name ASC
	`
	list := []WhatsappSupplierBreakdown{}
	if rows, err := db.Pool.Query(ctx, supplierSQL, sinceArg); err == nil {
		defer rows.Close()
		for rows.Next() {
			var row WhatsappSupplierBreakdown
			if scanErr := rows.Scan(
				&row.BrandID, &row.BrandName, &row.Slug, &row.WhatsappPhone,
				&row.TotalClicks, &row.UniquePeople, &row.CustomerClicks,
				&row.UniqueCustomers, &row.ProductClicks, &row.LastClickedAt,
			); scanErr == nil {
				list = append(list, row)
			}
		}
	}

	platformSQL := `
		SELECT
			COUNT(*)::int,
			COUNT(DISTINCT COALESCE(NULLIF(wc.user_id, ''), NULLIF(wc.visitor_id, ''), wc.id::text))::int,
			COUNT(*) FILTER (WHERE COALESCE(wc.user_id, '') <> '')::int,
			COUNT(DISTINCT NULLIF(wc.user_id, ''))::int,
			MAX(wc.created_at)
		FROM analytics.whatsapp_clicks wc
		WHERE wc.brand_id IS NULL
		  AND ($1::timestamptz IS NULL OR wc.created_at >= $1)
	`
	var pRow WhatsappSupplierBreakdown
	pRow.BrandID = whatsappBrandFilterPlatform
	pRow.BrandName = whatsappPlatformBrandName
	if err := db.Pool.QueryRow(ctx, platformSQL, sinceArg).Scan(
		&pRow.TotalClicks, &pRow.UniquePeople, &pRow.CustomerClicks,
		&pRow.UniqueCustomers, &pRow.LastClickedAt,
	); err == nil && pRow.TotalClicks > 0 {
		_ = db.Pool.QueryRow(ctx, `SELECT COALESCE(whatsapp, '') FROM catalog.settings LIMIT 1`).Scan(&pRow.WhatsappPhone)
		list = append(list, pRow)
	}

	return list
}

func queryWhatsappTopProducts(ctx context.Context, whereSQL string, args []any) []WhatsappProductStat {
	prodWhere := whereSQL + " AND wc.product_id IS NOT NULL"
	query := `
		SELECT
			p.id::text,
			COALESCE(p.title, ''),
			COALESCE(p.custom_sku, ''),
			COALESCE(p.slug, p.id::text),
			COALESCE(b.id::text, ''),
			COALESCE(b.brand_name, ''),
			COUNT(*)::int AS total_clicks,
			COUNT(DISTINCT NULLIF(wc.user_id, ''))::int AS unique_customers,
			COUNT(DISTINCT COALESCE(NULLIF(wc.user_id, ''), NULLIF(wc.visitor_id, ''), wc.id::text))::int AS unique_people
	` + whatsappBaseJoinsSQL + prodWhere + `
		GROUP BY p.id, p.title, p.custom_sku, p.slug, b.id, b.brand_name
		ORDER BY total_clicks DESC, unique_people DESC
		LIMIT 20
	`
	list := []WhatsappProductStat{}
	rows, err := db.Pool.Query(ctx, query, args...)
	if err != nil {
		return list
	}
	defer rows.Close()

	for rows.Next() {
		var item WhatsappProductStat
		if scanErr := rows.Scan(
			&item.ProductID, &item.Title, &item.CustomSKU, &item.Slug,
			&item.BrandID, &item.BrandName,
			&item.TotalClicks, &item.UniqueCustomers, &item.UniquePeople,
		); scanErr == nil {
			list = append(list, item)
		}
	}
	return list
}

func buildWhatsappClickLogsQuery(whereSQL string, baseArgs []any, limit, offset int) (string, []any) {
	n := len(baseArgs)
	pagedArgs := make([]any, 0, n+7)
	pagedArgs = append(pagedArgs, baseArgs...)
	pagedArgs = append(pagedArgs,
		whatsappActorCustomer,
		whatsappActorGuest,
		whatsappGuestLabel,
		whatsappBrandFilterPlatform,
		whatsappPlatformBrandName,
		limit,
		offset,
	)

	actorCustomerParam := n + 1
	actorGuestParam := n + 2
	guestLabelParam := n + 3
	platformBrandIDParam := n + 4
	platformBrandNameParam := n + 5
	limitParam := n + 6
	offsetParam := n + 7

	logQuery := fmt.Sprintf(`
		SELECT
			wc.id::text,
			wc.created_at,
			COALESCE(wc.user_id, ''),
			CASE WHEN COALESCE(wc.user_id, '') <> '' THEN $%d::text ELSE $%d::text END AS actor_type,
			CASE WHEN COALESCE(wc.user_id, '') <> ''
				THEN COALESCE(NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), ''), COALESCE(u.email, 'Kayıtlı Müşteri'))
				ELSE $%d::text
			END AS customer_name,
			COALESCE(u.email, ''),
			COALESCE(u.phone, ''),
			COALESCE(wc.visitor_id, ''),
			COALESCE(b.id::text, $%d::text),
			COALESCE(b.brand_name, $%d::text),
			COALESCE(b.slug, ''),
			COALESCE(NULLIF(wc.target_phone, ''), COALESCE(NULLIF(b.whatsapp_phone, ''), NULLIF(b.phone, ''), '')),
			COALESCE(p.id::text, ''),
			COALESCE(p.title, ''),
			COALESCE(p.custom_sku, ''),
			COALESCE(p.slug, ''),
			COALESCE((SELECT image_url FROM catalog.product_images WHERE product_id = p.id ORDER BY sort_order ASC, is_cover DESC LIMIT 1), ''),
			COALESCE(wc.source_surface, ''),
			COALESCE(wc.page_path, ''),
			COALESCE(wc.country_code, 'TR'),
			COALESCE(wc.language_code, 'tr'),
			COALESCE(wc.device_type, 'desktop'),
			COALESCE(wc.ip_address, '')
		%s
		%s
		ORDER BY wc.created_at DESC
		LIMIT $%d OFFSET $%d
	`, actorCustomerParam, actorGuestParam, guestLabelParam, platformBrandIDParam, platformBrandNameParam,
		whatsappBaseJoinsSQL, whereSQL, limitParam, offsetParam)

	return logQuery, pagedArgs
}

func queryWhatsappClickLogs(ctx context.Context, whereSQL string, args []any, limit, offset int) ([]WhatsappClickLogItem, int) {
	var total int
	countQuery := `SELECT COUNT(*)::int ` + whatsappBaseJoinsSQL + whereSQL
	_ = db.Pool.QueryRow(ctx, countQuery, args...).Scan(&total)

	logQuery, pagedArgs := buildWhatsappClickLogsQuery(whereSQL, args, limit, offset)

	list := []WhatsappClickLogItem{}
	rows, err := db.Pool.Query(ctx, logQuery, pagedArgs...)
	if err != nil {
		log.Printf("[WHATSAPP ANALYTICS ERROR] query logs failed: %v", err)
		return list, total
	}
	defer rows.Close()

	for rows.Next() {
		var row WhatsappClickLogItem
		if scanErr := rows.Scan(
			&row.ID, &row.CreatedAt, &row.UserID, &row.ActorType,
			&row.CustomerName, &row.CustomerEmail, &row.CustomerPhone,
			&row.VisitorID, &row.BrandID, &row.BrandName, &row.BrandSlug,
			&row.TargetPhone, &row.ProductID, &row.ProductTitle, &row.ProductSKU,
			&row.ProductSlug, &row.ProductImage, &row.SourceSurface, &row.PagePath,
			&row.CountryCode, &row.LanguageCode, &row.DeviceType, &row.IPAddress,
		); scanErr == nil {
			list = append(list, row)
		}
	}
	return list, total
}

// GetAdminWhatsappClicks serves GET /api/v1/admin/analytics/whatsapp-clicks with attribution & supplier rollups.
func (h *AnalyticsHandler) GetAdminWhatsappClicks(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, errJSONMethodNotAllowed, http.StatusMethodNotAllowed)
		return
	}

	filters := parseWhatsappFilterParams(r)
	if db.Pool == nil {
		w.Header().Set(headerContentType, mimeApplicationJSON)
		_ = json.NewEncoder(w).Encode(AdminWhatsappClicksResponse{
			Period:      filters.Period,
			BySupplier:  []WhatsappSupplierBreakdown{},
			TopProducts: []WhatsappProductStat{},
			Logs:        []WhatsappClickLogItem{},
		})
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	_ = EnsureWhatsappClicksSchema(ctx)

	whereSQL, args := buildWhatsappFilterSQL(filters)
	summary := queryWhatsappSummaryKPIs(ctx, whereSQL, args)
	bySupplier := queryWhatsappBySupplier(ctx, filters.Since)
	topProducts := queryWhatsappTopProducts(ctx, whereSQL, args)
	logs, totalLogs := queryWhatsappClickLogs(ctx, whereSQL, args, filters.Limit, filters.Offset)

	w.Header().Set(headerContentType, mimeApplicationJSON)
	_ = json.NewEncoder(w).Encode(AdminWhatsappClicksResponse{
		Period:      filters.Period,
		Summary:     summary,
		BySupplier:  bySupplier,
		TopProducts: topProducts,
		Logs:        logs,
		TotalLogs:   totalLogs,
	})
}
