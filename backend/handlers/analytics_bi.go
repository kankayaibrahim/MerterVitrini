package handlers

import (
	"context"
	"encoding/json"
	"math"
	"net/http"
	"strings"
	"time"

	"mertervitrini/backend/db"
)

type biTimeWindow struct {
	Period    string
	Since     time.Time
	Until     time.Time
	PrevSince time.Time
	PrevUntil time.Time
}

// BIOverviewMetrics holds executive KPIs with period-over-period percentage deltas.
type BIOverviewMetrics struct {
	UniqueVisitors        int     `json:"unique_visitors"`
	VisitorsDeltaPct      float64 `json:"visitors_delta_pct"`
	TotalSessions         int     `json:"total_sessions"`
	SessionsDeltaPct      float64 `json:"sessions_delta_pct"`
	TotalPageviews        int     `json:"total_pageviews"`
	NewVisitors           int     `json:"new_visitors"`
	ReturningVisitors     int     `json:"returning_visitors"`
	BounceRatePct         float64 `json:"bounce_rate_pct"`
	AvgSessionDurationSec float64 `json:"avg_session_duration_sec"`
	AvgScrollDepthPct     float64 `json:"avg_scroll_depth_pct"`
	ProductViews          int     `json:"product_views"`
	CartAdditions         int     `json:"cart_additions"`
	B2BLeads              int     `json:"b2b_leads"`
	LeadsDeltaPct         float64 `json:"leads_delta_pct"`
	OrdersCount           int     `json:"orders_count"`
	GMVTry                float64 `json:"gmv_try"`
	LiveVisitors15m       int     `json:"live_visitors_15m"`
}

// BIDailySeriesPoint represents one day of storefront funnel activity in Europe/Istanbul.
type BIDailySeriesPoint struct {
	Date         string `json:"date"`
	Visitors     int    `json:"visitors"`
	Sessions     int    `json:"sessions"`
	Pageviews    int    `json:"pageviews"`
	ProductViews int    `json:"product_views"`
	CartAdds     int    `json:"cart_adds"`
	Leads        int    `json:"leads"`
	Orders       int    `json:"orders"`
}

// BIFunnelStage represents one step of the 6-stage B2B wholesale conversion funnel.
type BIFunnelStage struct {
	StepKey                string  `json:"step_key"`
	Label                  string  `json:"label"`
	VisitorsCount          int     `json:"visitors_count"`
	ConversionFromStartPct float64 `json:"conversion_from_start_pct"`
	DropOffFromPrevPct     float64 `json:"drop_off_from_prev_pct"`
}

// BITopSearchRow represents an aggregated internal search term and its click performance.
type BITopSearchRow struct {
	Query      string  `json:"query"`
	Searches   int     `json:"searches"`
	AvgResults float64 `json:"avg_results"`
	Clicks     int     `json:"clicks"`
	CTRPct     float64 `json:"ctr_pct"`
	TopLang    string  `json:"top_lang"`
	TopCountry string  `json:"top_country"`
}

// BIZeroResultSearchRow represents unmet wholesale buyer search demand (0 matching products).
type BIZeroResultSearchRow struct {
	Query          string    `json:"query"`
	Searches       int       `json:"searches"`
	LastSearchedAt time.Time `json:"last_searched_at"`
	TopLang        string    `json:"top_lang"`
	TopCountry     string    `json:"top_country"`
}

// BISearchMining aggregates storefront search intelligence and zero-result demand gaps.
type BISearchMining struct {
	TotalSearches      int                     `json:"total_searches"`
	ZeroResultCount    int                     `json:"zero_result_count"`
	ZeroResultRatePct  float64                 `json:"zero_result_rate_pct"`
	TopSearches        []BITopSearchRow        `json:"top_searches"`
	ZeroResultSearches []BIZeroResultSearchRow `json:"zero_result_searches"`
}

// BIGeoCurrencyRow maps Country x Language x Preferred Currency wholesale demand.
type BIGeoCurrencyRow struct {
	CountryCode       string  `json:"country_code"`
	CountryLabel      string  `json:"country_label"`
	TopLanguage       string  `json:"top_language"`
	TopCurrency       string  `json:"top_currency"`
	Visitors          int     `json:"visitors"`
	Pageviews         int     `json:"pageviews"`
	ProductViews      int     `json:"product_views"`
	B2BLeads          int     `json:"b2b_leads"`
	ConversionRatePct float64 `json:"conversion_rate_pct"`
}

// BIAcquisitionRow attributes visitor sessions, bounce rates, and B2B leads to channels & campaigns.
type BIAcquisitionRow struct {
	Channel        string  `json:"channel"`
	Source         string  `json:"source"`
	Medium         string  `json:"medium"`
	Campaign       string  `json:"campaign"`
	HasPaidClickID bool    `json:"has_paid_click_id"`
	Visitors       int     `json:"visitors"`
	Sessions       int     `json:"sessions"`
	BounceRatePct  float64 `json:"bounce_rate_pct"`
	ProductViews   int     `json:"product_views"`
	B2BLeads       int     `json:"b2b_leads"`
	LeadRatePct    float64 `json:"lead_rate_pct"`
}

// BILandingPageRow measures entry page quality and engagement depth.
type BILandingPageRow struct {
	Path           string  `json:"path"`
	Sessions       int     `json:"sessions"`
	BounceRatePct  float64 `json:"bounce_rate_pct"`
	AvgDurationSec float64 `json:"avg_duration_sec"`
	AvgScrollPct   float64 `json:"avg_scroll_pct"`
}

// BIExitPageRow identifies where sessions leave the storefront.
type BIExitPageRow struct {
	Path        string  `json:"path"`
	Exits       int     `json:"exits"`
	ExitRatePct float64 `json:"exit_rate_pct"`
}

// BIPageIntelligence groups entry and exit page performance.
type BIPageIntelligence struct {
	LandingPages []BILandingPageRow `json:"landing_pages"`
	ExitPages    []BIExitPageRow    `json:"exit_pages"`
}

// BIHotProductRow measures product-level view-to-cart/order velocity and flags merchandising gaps.
type BIHotProductRow struct {
	ProductID         string  `json:"product_id"`
	Title             string  `json:"title"`
	CustomSKU         string  `json:"custom_sku"`
	BrandName         string  `json:"brand_name"`
	Views             int     `json:"views"`
	CartAdds          int     `json:"cart_adds"`
	InquiriesOrOrders int     `json:"inquiries_or_orders"`
	ConversionPct     float64 `json:"conversion_pct"`
	OpportunityFlag   string  `json:"opportunity_flag"`
}

// BITopBrandRow ranks manufacturer brands by buyer attention and direct leads.
type BITopBrandRow struct {
	BrandID          string  `json:"brand_id"`
	BrandName        string  `json:"brand_name"`
	ProfileViews     int     `json:"profile_views"`
	ProductViews     int     `json:"product_views"`
	WhatsappAndLeads int     `json:"whatsapp_and_leads"`
	LeadRatePct      float64 `json:"lead_rate_pct"`
}

// BIProductBrandVelocity combines product velocity and manufacturer demand rankings.
type BIProductBrandVelocity struct {
	HotProducts []BIHotProductRow `json:"hot_products"`
	TopBrands   []BITopBrandRow   `json:"top_brands"`
}

// BIHotBuyerLeadRow profiles an active high-intent visitor or registered B2B buyer with a 0-100 lead score.
type BIHotBuyerLeadRow struct {
	VisitorID       string    `json:"visitor_id"`
	UserID          string    `json:"user_id"`
	CustomerName    string    `json:"customer_name"`
	CustomerEmail   string    `json:"customer_email"`
	IsRegistered    bool      `json:"is_registered"`
	CountryCode     string    `json:"country_code"`
	Language        string    `json:"language"`
	Currency        string    `json:"currency"`
	DeviceType      string    `json:"device_type"`
	ReferrerHost    string    `json:"referrer_host"`
	LeadScore       int       `json:"lead_score"`
	ProductsViewed  int       `json:"products_viewed"`
	CartAdds        int       `json:"cart_adds"`
	LeadActions     int       `json:"lead_actions"`
	TotalDwellSec   int       `json:"total_dwell_sec"`
	LastSeenAt      time.Time `json:"last_seen_at"`
	LastActionTitle string    `json:"last_action_title"`
}

// BIWebVitalsDeviceRow summarizes real-user Core Web Vitals per device class.
type BIWebVitalsDeviceRow struct {
	DeviceType string  `json:"device_type"`
	Samples    int     `json:"samples"`
	AvgLCPMs   float64 `json:"avg_lcp_ms"`
	AvgINPMs   float64 `json:"avg_inp_ms"`
	AvgCLS     float64 `json:"avg_cls"`
	AvgTTFBMs  float64 `json:"avg_ttfb_ms"`
	GoodLCPPct float64 `json:"good_lcp_pct"`
}

// BIScreenResolutionRow represents WxH screen resolution buckets.
type BIScreenResolutionRow struct {
	Resolution string  `json:"resolution"`
	Count      int     `json:"count"`
	Visitors   int     `json:"visitors"`
	Pageviews  int     `json:"pageviews"`
	SharePct   float64 `json:"share_pct"`
}

// BINamedTechRow represents OS or browser distribution buckets.
type BINamedTechRow struct {
	Name      string  `json:"name"`
	Count     int     `json:"count"`
	Visitors  int     `json:"visitors"`
	Pageviews int     `json:"pageviews"`
	SharePct  float64 `json:"share_pct"`
}

// BIHourlyHeatmapCell represents day-of-week x hour-of-day traffic & B2B leads in Europe/Istanbul.
type BIHourlyHeatmapCell struct {
	DayOfWeek int `json:"day_of_week"`
	HourOfDay int `json:"hour_of_day"`
	Visitors  int `json:"visitors"`
	Pageviews int `json:"pageviews"`
	Leads     int `json:"leads"`
}

// BIWebVitalsAndTech aggregates Core Web Vitals, client environment buckets, and hourly conversion heatmap.
type BIWebVitalsAndTech struct {
	WebVitalsByDevice       []BIWebVitalsDeviceRow  `json:"web_vitals_by_device"`
	ScreenResolutions       []BIScreenResolutionRow `json:"screen_resolutions"`
	OSBreakdown             []BINamedTechRow        `json:"os_breakdown"`
	BrowserBreakdown        []BINamedTechRow        `json:"browser_breakdown"`
	HourlyConversionHeatmap []BIHourlyHeatmapCell   `json:"hourly_conversion_heatmap"`
}

// BIBotSummaryRow tracks search engine & AI crawler activity isolated from human BI metrics.
type BIBotSummaryRow struct {
	BotName             string    `json:"bot_name"`
	Hits                int       `json:"hits"`
	UniquePaths         int       `json:"unique_paths"`
	ProductPagesCrawled int       `json:"product_pages_crawled"`
	LastCrawlAt         time.Time `json:"last_crawl_at"`
}

// BIBotCrawledPathRow lists the most frequently crawled storefront paths.
type BIBotCrawledPathRow struct {
	Path        string    `json:"path"`
	Hits        int       `json:"hits"`
	TopBot      string    `json:"top_bot"`
	UniqueBots  int       `json:"unique_bots"`
	LastCrawlAt time.Time `json:"last_crawl_at"`
}

// BIBotCrawlMonitor summarizes SEO & AI crawler activity.
type BIBotCrawlMonitor struct {
	TotalBotHits    int                   `json:"total_bot_hits"`
	Bots            []BIBotSummaryRow     `json:"bots"`
	TopCrawledPaths []BIBotCrawledPathRow `json:"top_crawled_paths"`
}

// BIMiningReportResponse is the unified Enterprise BI & Data Mining API payload.
type BIMiningReportResponse struct {
	Period                  string                 `json:"period"`
	GeneratedAt             time.Time              `json:"generated_at"`
	Overview                BIOverviewMetrics      `json:"overview"`
	DailySeries             []BIDailySeriesPoint   `json:"daily_series"`
	ConversionFunnel        []BIFunnelStage        `json:"conversion_funnel"`
	SearchMining            BISearchMining         `json:"search_mining"`
	GeoCurrencyMatrix       []BIGeoCurrencyRow     `json:"geo_currency_matrix"`
	AcquisitionAttribution  []BIAcquisitionRow     `json:"acquisition_attribution"`
	PageIntelligence        BIPageIntelligence     `json:"page_intelligence"`
	ProductAndBrandVelocity BIProductBrandVelocity `json:"product_and_brand_velocity"`
	HotBuyerLeads           []BIHotBuyerLeadRow    `json:"hot_buyer_leads"`
	WebVitalsAndTech        BIWebVitalsAndTech     `json:"web_vitals_and_tech"`
	BotCrawlMonitor         BIBotCrawlMonitor      `json:"bot_crawl_monitor"`
}

func round1(v float64) float64 {
	return math.Round(v*10) / 10
}

func round2(v float64) float64 {
	return math.Round(v*100) / 100
}

func safePct(part, total int) float64 {
	if total <= 0 {
		return 0
	}
	return round1((float64(part) / float64(total)) * 100.0)
}

func calcDeltaPct(curr, prev int) float64 {
	if prev <= 0 {
		if curr > 0 {
			return 100.0
		}
		return 0.0
	}
	return round1(((float64(curr) - float64(prev)) / float64(prev)) * 100.0)
}

func resolveBIPeriodWindow(rawPeriod string) biTimeWindow {
	loc := istanbulLocation()
	now := time.Now().In(loc)

	var since time.Time
	var period string
	switch strings.TrimSpace(rawPeriod) {
	case "today":
		since = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
		period = "today"
	case "24h":
		since = now.Add(-24 * time.Hour)
		period = "24h"
	case "7d":
		since = now.Add(-7 * 24 * time.Hour)
		period = "7d"
	case "90d":
		since = now.Add(-90 * 24 * time.Hour)
		period = "90d"
	default:
		since = now.Add(-30 * 24 * time.Hour)
		period = "30d"
	}

	span := now.Sub(since)
	if span < time.Hour {
		span = 24 * time.Hour
	}
	prevUntil := since
	prevSince := since.Add(-span)
	if period == "today" {
		prevStart := since.AddDate(0, 0, -1)
		prevSince = prevStart
		prevUntil = prevStart.Add(now.Sub(since))
	}

	return biTimeWindow{
		Period:    period,
		Since:     since,
		Until:     now,
		PrevSince: prevSince,
		PrevUntil: prevUntil,
	}
}

// GetBIMiningReport handles GET /api/v1/analytics/bi-mining?period=today|24h|7d|30d|90d.
func (h *AnalyticsHandler) GetBIMiningReport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, errJSONMethodNotAllowed, http.StatusMethodNotAllowed)
		return
	}

	win := resolveBIPeriodWindow(r.URL.Query().Get("period"))
	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	defer cancel()
	ensureAnalyticsSchema(ctx)

	resp := BIMiningReportResponse{
		Period:                  win.Period,
		GeneratedAt:             time.Now().UTC(),
		Overview:                queryBIOverview(ctx, win),
		DailySeries:             queryBIDailySeries(ctx, win),
		ConversionFunnel:        queryBIConversionFunnel(ctx, win),
		SearchMining:            queryBISearchMining(ctx, win),
		GeoCurrencyMatrix:       queryBIGeoCurrencyMatrix(ctx, win),
		AcquisitionAttribution:  queryBIAcquisitionAttribution(ctx, win),
		PageIntelligence:        queryBIPageIntelligence(ctx, win),
		ProductAndBrandVelocity: queryBIProductAndBrandVelocity(ctx, win),
		HotBuyerLeads:           queryBIHotBuyerLeads(ctx, win),
		WebVitalsAndTech:        queryBIWebVitalsAndTech(ctx, win),
		BotCrawlMonitor:         queryBIBotCrawlMonitor(ctx, win),
	}

	w.Header().Set(headerContentType, mimeApplicationJSON)
	_ = json.NewEncoder(w).Encode(resp)
}

func queryBIOverview(ctx context.Context, win biTimeWindow) BIOverviewMetrics {
	var m BIOverviewMetrics
	if db.Pool == nil {
		return m
	}

	var prevVisitors, prevSessions, bounceSessions int
	trafficSQL := `
		WITH curr_pv AS (
			SELECT visitor_id,
			       COALESCE(NULLIF(session_id, ''), visitor_id) AS sess_id,
			       path, duration_sec, scroll_depth_pct, is_new_visitor, created_at
			FROM analytics.page_views
			WHERE COALESCE(is_bot, false) = false
			  AND created_at >= $1 AND created_at < $2
		),
		sess_agg AS (
			SELECT sess_id,
			       COUNT(*) AS pv_cnt,
			       LEAST(
			           SUM(duration_sec) + CASE
			               WHEN COUNT(*) > 1 AND SUM(duration_sec) = 0
			               THEN EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at)))::int
			               ELSE 0
			           END,
			           3600
			       ) AS sess_dur
			FROM curr_pv
			GROUP BY sess_id
		),
		vis_first AS (
			SELECT cp.visitor_id,
			       (BOOL_OR(cp.is_new_visitor) OR NOT EXISTS (
			           SELECT 1 FROM analytics.page_views old_pv
			           WHERE old_pv.visitor_id = cp.visitor_id
			             AND COALESCE(old_pv.is_bot, false) = false
			             AND old_pv.created_at < $1
			       )) AS is_new
			FROM curr_pv cp
			GROUP BY cp.visitor_id
		),
		prev_pv AS (
			SELECT COUNT(DISTINCT visitor_id) AS p_vis,
			       COUNT(DISTINCT COALESCE(NULLIF(session_id, ''), visitor_id)) AS p_sess
			FROM analytics.page_views
			WHERE COALESCE(is_bot, false) = false
			  AND created_at >= $3 AND created_at < $4
		)
		SELECT
			COALESCE((SELECT COUNT(*) FROM vis_first), 0),
			COALESCE((SELECT COUNT(*) FILTER (WHERE is_new) FROM vis_first), 0),
			COALESCE((SELECT COUNT(*) FROM sess_agg), 0),
			COALESCE((SELECT COUNT(*) FILTER (WHERE pv_cnt = 1 AND sess_dur < 10) FROM sess_agg), 0),
			COALESCE((SELECT AVG(sess_dur)::float8 FROM sess_agg), 0),
			COALESCE((SELECT COUNT(*) FROM curr_pv), 0),
			COALESCE((SELECT AVG(NULLIF(scroll_depth_pct, 0))::float8 FROM curr_pv), 0),
			COALESCE((SELECT COUNT(*) FROM curr_pv WHERE path LIKE '/product/%' OR path ~ '^/[a-z]{2}/product/'), 0),
			COALESCE((SELECT p_vis FROM prev_pv), 0),
			COALESCE((SELECT p_sess FROM prev_pv), 0),
			COALESCE((
				SELECT COUNT(DISTINCT visitor_id)
				FROM analytics.page_views
				WHERE COALESCE(is_bot, false) = false
				  AND created_at >= NOW() - INTERVAL '15 minutes'
			), 0)
	`
	_ = db.Pool.QueryRow(ctx, trafficSQL, win.Since, win.Until, win.PrevSince, win.PrevUntil).Scan(
		&m.UniqueVisitors,
		&m.NewVisitors,
		&m.TotalSessions,
		&bounceSessions,
		&m.AvgSessionDurationSec,
		&m.TotalPageviews,
		&m.AvgScrollDepthPct,
		&m.ProductViews,
		&prevVisitors,
		&prevSessions,
		&m.LiveVisitors15m,
	)

	if m.UniqueVisitors > m.NewVisitors {
		m.ReturningVisitors = m.UniqueVisitors - m.NewVisitors
	}
	m.BounceRatePct = safePct(bounceSessions, m.TotalSessions)
	m.AvgSessionDurationSec = round1(m.AvgSessionDurationSec)
	m.AvgScrollDepthPct = round1(m.AvgScrollDepthPct)
	m.VisitorsDeltaPct = calcDeltaPct(m.UniqueVisitors, prevVisitors)
	m.SessionsDeltaPct = calcDeltaPct(m.TotalSessions, prevSessions)

	populateBIOverviewCommerce(ctx, win, &m)
	return m
}

func populateBIOverviewCommerce(ctx context.Context, win biTimeWindow, m *BIOverviewMetrics) {
	var meProdViews, prevLeads int
	commerceSQL := `
		SELECT
			COALESCE((
				SELECT COUNT(*) FROM analytics.member_events
				WHERE event_type = 'product_view' AND created_at >= $1 AND created_at < $2
			), 0),
			GREATEST(
				COALESCE((SELECT COUNT(*) FROM analytics.member_events WHERE event_type = 'cart_add' AND created_at >= $1 AND created_at < $2), 0),
				COALESCE((SELECT COUNT(*) FROM catalog.cart_items WHERE created_at >= $1 AND created_at < $2), 0)
			),
			(
				GREATEST(
					COALESCE((SELECT COUNT(*) FROM analytics.brand_events WHERE event_type IN ('whatsapp_click', 'phone_click', 'email_click', 'website_click') AND created_at >= $1 AND created_at < $2), 0),
					COALESCE((SELECT COUNT(*) FROM analytics.member_events WHERE event_type IN ('whatsapp_click', 'phone_click', 'email_click', 'website_click') AND created_at >= $1 AND created_at < $2), 0)
				)
				+ COALESCE((SELECT COUNT(*) FROM catalog.chat_rooms WHERE created_at >= $1 AND created_at < $2), 0)
				+ COALESCE((SELECT COUNT(*) FROM catalog.store_inquiries WHERE created_at >= $1 AND created_at < $2), 0)
				+ COALESCE((SELECT COUNT(*) FROM catalog.buyer_rfqs WHERE created_at >= $1 AND created_at < $2), 0)
			),
			(
				GREATEST(
					COALESCE((SELECT COUNT(*) FROM analytics.brand_events WHERE event_type IN ('whatsapp_click', 'phone_click', 'email_click', 'website_click') AND created_at >= $3 AND created_at < $4), 0),
					COALESCE((SELECT COUNT(*) FROM analytics.member_events WHERE event_type IN ('whatsapp_click', 'phone_click', 'email_click', 'website_click') AND created_at >= $3 AND created_at < $4), 0)
				)
				+ COALESCE((SELECT COUNT(*) FROM catalog.chat_rooms WHERE created_at >= $3 AND created_at < $4), 0)
				+ COALESCE((SELECT COUNT(*) FROM catalog.store_inquiries WHERE created_at >= $3 AND created_at < $4), 0)
				+ COALESCE((SELECT COUNT(*) FROM catalog.buyer_rfqs WHERE created_at >= $3 AND created_at < $4), 0)
			)
	`
	_ = db.Pool.QueryRow(ctx, commerceSQL, win.Since, win.Until, win.PrevSince, win.PrevUntil).Scan(
		&meProdViews,
		&m.CartAdditions,
		&m.B2BLeads,
		&prevLeads,
	)
	if meProdViews > m.ProductViews {
		m.ProductViews = meProdViews
	}
	m.LeadsDeltaPct = calcDeltaPct(m.B2BLeads, prevLeads)

	ordersSQL := `
		WITH latest_rates AS (
			SELECT DISTINCT ON (UPPER(currency_code))
				UPPER(currency_code) AS code,
				buying_rate
			FROM catalog.exchange_rates
			ORDER BY UPPER(currency_code), publication_date DESC
		),
		order_totals_try AS (
			SELECT o.id,
			       CASE
			           WHEN UPPER(COALESCE(o.currency, 'TRY')) NOT IN ('TRY', 'TL', '') THEN
			               o.total_amount * COALESCE((SELECT lr.buying_rate FROM latest_rates lr WHERE lr.code = UPPER(o.currency)), 1.0)
			           WHEN EXISTS (SELECT 1 FROM catalog.order_items oi WHERE oi.order_id = o.id) THEN
			               COALESCE((
			                   SELECT SUM(
			                       oi.price_at_purchase * oi.quantity * CASE
			                           WHEN UPPER(COALESCE(p.currency, 'TRY')) IN ('TRY', 'TL', '') THEN 1.0
			                           ELSE COALESCE((SELECT lr2.buying_rate FROM latest_rates lr2 WHERE lr2.code = UPPER(p.currency)), 1.0)
			                       END
			                   )
			                   FROM catalog.order_items oi
			                   LEFT JOIN catalog.products p ON p.id = oi.product_id
			                   WHERE oi.order_id = o.id
			               ), o.total_amount)
			           ELSE o.total_amount
			       END AS try_amount
			FROM catalog.orders o
			WHERE o.created_at >= $1 AND o.created_at < $2
			  AND UPPER(COALESCE(o.order_status, '')) <> 'CANCELLED'
		)
		SELECT COUNT(*), COALESCE(SUM(try_amount)::float8, 0)
		FROM order_totals_try
	`
	_ = db.Pool.QueryRow(ctx, ordersSQL, win.Since, win.Until).Scan(&m.OrdersCount, &m.GMVTry)
	m.GMVTry = round2(m.GMVTry)
}

func queryBIDailySeries(ctx context.Context, win biTimeWindow) []BIDailySeriesPoint {
	series := []BIDailySeriesPoint{}
	if db.Pool == nil {
		return series
	}

	sql := `
		WITH days AS (
			SELECT GENERATE_SERIES(
				(DATE_TRUNC('day', $1 AT TIME ZONE 'Europe/Istanbul'))::date,
				(DATE_TRUNC('day', $2 AT TIME ZONE 'Europe/Istanbul'))::date,
				INTERVAL '1 day'
			)::date AS d
		),
		pv_d AS (
			SELECT (created_at AT TIME ZONE 'Europe/Istanbul')::date AS d,
			       COUNT(DISTINCT visitor_id) AS visitors,
			       COUNT(DISTINCT COALESCE(NULLIF(session_id, ''), visitor_id)) AS sessions,
			       COUNT(*) AS pageviews,
			       COUNT(*) FILTER (WHERE path LIKE '/product/%' OR path ~ '^/[a-z]{2}/product/') AS product_views
			FROM analytics.page_views
			WHERE COALESCE(is_bot, false) = false
			  AND created_at >= $1 AND created_at < $2
			GROUP BY 1
		),
		cart_d AS (
			SELECT (created_at AT TIME ZONE 'Europe/Istanbul')::date AS d,
			       COUNT(*) AS cart_adds
			FROM analytics.member_events
			WHERE event_type = 'cart_add'
			  AND created_at >= $1 AND created_at < $2
			GROUP BY 1
		),
		lead_d AS (
			SELECT d, SUM(cnt)::int AS leads FROM (
				SELECT (created_at AT TIME ZONE 'Europe/Istanbul')::date AS d, COUNT(*) AS cnt
				FROM analytics.brand_events
				WHERE event_type IN ('whatsapp_click', 'phone_click', 'email_click', 'website_click')
				  AND created_at >= $1 AND created_at < $2
				GROUP BY 1
				UNION ALL
				SELECT (created_at AT TIME ZONE 'Europe/Istanbul')::date AS d, COUNT(*) AS cnt
				FROM catalog.chat_rooms WHERE created_at >= $1 AND created_at < $2 GROUP BY 1
				UNION ALL
				SELECT (created_at AT TIME ZONE 'Europe/Istanbul')::date AS d, COUNT(*) AS cnt
				FROM catalog.store_inquiries WHERE created_at >= $1 AND created_at < $2 GROUP BY 1
				UNION ALL
				SELECT (created_at AT TIME ZONE 'Europe/Istanbul')::date AS d, COUNT(*) AS cnt
				FROM catalog.buyer_rfqs WHERE created_at >= $1 AND created_at < $2 GROUP BY 1
			) u
			GROUP BY d
		),
		ord_d AS (
			SELECT (created_at AT TIME ZONE 'Europe/Istanbul')::date AS d,
			       COUNT(*) AS orders
			FROM catalog.orders
			WHERE created_at >= $1 AND created_at < $2
			  AND UPPER(COALESCE(order_status, '')) <> 'CANCELLED'
			GROUP BY 1
		)
		SELECT
			TO_CHAR(days.d, 'YYYY-MM-DD'),
			COALESCE(pv_d.visitors, 0),
			COALESCE(pv_d.sessions, 0),
			COALESCE(pv_d.pageviews, 0),
			COALESCE(pv_d.product_views, 0),
			COALESCE(cart_d.cart_adds, 0),
			COALESCE(lead_d.leads, 0),
			COALESCE(ord_d.orders, 0)
		FROM days
		LEFT JOIN pv_d ON pv_d.d = days.d
		LEFT JOIN cart_d ON cart_d.d = days.d
		LEFT JOIN lead_d ON lead_d.d = days.d
		LEFT JOIN ord_d ON ord_d.d = days.d
		ORDER BY days.d ASC
	`
	rows, err := db.Pool.Query(ctx, sql, win.Since, win.Until)
	if err != nil {
		return series
	}
	defer rows.Close()

	for rows.Next() {
		var pt BIDailySeriesPoint
		if err := rows.Scan(&pt.Date, &pt.Visitors, &pt.Sessions, &pt.Pageviews, &pt.ProductViews, &pt.CartAdds, &pt.Leads, &pt.Orders); err == nil {
			series = append(series, pt)
		}
	}
	return series
}

func queryBIConversionFunnel(ctx context.Context, win biTimeWindow) []BIFunnelStage {
	var s1, s2, s3, s4, s5, s6 int
	if db.Pool != nil {
		funnelSQL := `
			WITH human_pv AS (
				SELECT visitor_id, COALESCE(NULLIF(user_id, ''), visitor_id) AS actor_id, path, url
				FROM analytics.page_views
				WHERE COALESCE(is_bot, false) = false
				  AND created_at >= $1 AND created_at < $2
			)
			SELECT
				COALESCE((SELECT COUNT(DISTINCT visitor_id) FROM human_pv), 0) AS s1,
				COALESCE((
					SELECT COUNT(DISTINCT actor) FROM (
						SELECT visitor_id AS actor FROM human_pv
						WHERE path <> '/' AND path NOT IN ('/tr', '/en', '/ru', '/ar', '/de', '/fr', '/pl', '/bg')
						UNION
						SELECT visitor_id AS actor FROM analytics.search_logs
						WHERE visitor_id <> '' AND created_at >= $1 AND created_at < $2
						UNION
						SELECT COALESCE(NULLIF(visitor_id, ''), user_id) AS actor FROM analytics.member_events
						WHERE event_type IN ('category_view', 'search_query', 'product_view', 'brand_view')
						  AND created_at >= $1 AND created_at < $2
					) q2 WHERE actor IS NOT NULL AND actor <> ''
				), 0) AS s2,
				COALESCE((
					SELECT COUNT(DISTINCT actor) FROM (
						SELECT visitor_id AS actor FROM human_pv
						WHERE path LIKE '/product/%' OR path ~ '^/[a-z]{2}/product/'
						   OR path LIKE '/ureticiler/%' OR path ~ '^/[a-z]{2}/ureticiler/'
						UNION
						SELECT COALESCE(NULLIF(visitor_id, ''), user_id) AS actor FROM analytics.member_events
						WHERE event_type IN ('product_view', 'brand_view')
						  AND created_at >= $1 AND created_at < $2
					) q3 WHERE actor IS NOT NULL AND actor <> ''
				), 0) AS s3,
				COALESCE((
					SELECT COUNT(DISTINCT actor) FROM (
						SELECT visitor_id AS actor FROM human_pv
						WHERE path IN ('/cart', '/sepet') OR path ~ '^/[a-z]{2}/(cart|sepet)'
						UNION
						SELECT COALESCE(NULLIF(visitor_id, ''), user_id) AS actor FROM analytics.member_events
						WHERE event_type IN ('cart_add', 'wishlist_add', 'cart_excel_export', 'pack_calc', 'price_unlock', 'inquiry_submit', 'order_create')
						  AND created_at >= $1 AND created_at < $2
					) q4 WHERE actor IS NOT NULL AND actor <> ''
				), 0) AS s4,
				COALESCE((
					SELECT COUNT(DISTINCT actor) FROM (
						SELECT visitor_id AS actor FROM analytics.brand_events
						WHERE event_type IN ('whatsapp_click', 'phone_click', 'email_click', 'website_click', 'inquiry_submit', 'chat_start')
						  AND visitor_id <> '' AND created_at >= $1 AND created_at < $2
						UNION
						SELECT COALESCE(NULLIF(visitor_id, ''), user_id) AS actor FROM analytics.member_events
						WHERE event_type IN ('whatsapp_click', 'phone_click', 'email_click', 'chat_start', 'chat_message', 'rfq_create', 'inquiry_submit', 'order_create')
						  AND created_at >= $1 AND created_at < $2
						UNION
						SELECT customer_id AS actor FROM catalog.chat_rooms WHERE created_at >= $1 AND created_at < $2
						UNION
						SELECT COALESCE(NULLIF(email, ''), phone) AS actor FROM catalog.store_inquiries WHERE created_at >= $1 AND created_at < $2
						UNION
						SELECT COALESCE(NULLIF(buyer_email, ''), buyer_phone) AS actor FROM catalog.buyer_rfqs WHERE created_at >= $1 AND created_at < $2
					) q5 WHERE actor IS NOT NULL AND actor <> ''
				), 0) AS s5,
				COALESCE((
					SELECT COUNT(DISTINCT COALESCE(NULLIF(user_id, ''), NULLIF(customer_email, ''), id::text))
					FROM catalog.orders
					WHERE created_at >= $1 AND created_at < $2
					  AND UPPER(COALESCE(order_status, '')) <> 'CANCELLED'
				), 0) AS s6
		`
		_ = db.Pool.QueryRow(ctx, funnelSQL, win.Since, win.Until).Scan(&s1, &s2, &s3, &s4, &s5, &s6)
	}

	rawStages := []struct {
		key   string
		label string
		count int
	}{
		{"storefront_visitors", "Vitrin İnsan Ziyaretçileri", s1},
		{"catalog_explorers", "Katalog / Kategori / Arama Gezginleri", s2},
		{"product_viewers", "Ürün & Üretici Vitrini İnceleyenler", s3},
		{"high_intent_actions", "Yüksek Niyet (Sepet / Favori / Seri Hesap / Fiyat)", s4},
		{"supplier_leads", "Tedarikçi Teması (WhatsApp / Tel / Chat / RFQ / Teklif)", s5},
		{"confirmed_orders", "Onaylanan / Oluşturulan B2B Siparişler", s6},
	}

	baseCount := rawStages[0].count
	out := make([]BIFunnelStage, 0, len(rawStages))
	for i, st := range rawStages {
		convStart := safePct(st.count, baseCount)
		if convStart > 100 {
			convStart = 100
		}
		dropPrev := 0.0
		if i > 0 {
			prevCount := rawStages[i-1].count
			if prevCount > st.count && prevCount > 0 {
				dropPrev = safePct(prevCount-st.count, prevCount)
			}
		}
		out = append(out, BIFunnelStage{
			StepKey:                st.key,
			Label:                  st.label,
			VisitorsCount:          st.count,
			ConversionFromStartPct: convStart,
			DropOffFromPrevPct:     dropPrev,
		})
	}
	return out
}

const biSearchEventsUnionCTE = `
	WITH combined_searches AS (
		SELECT
			sl.query_text,
			sl.normalized_query,
			UPPER(COALESCE(NULLIF(sl.language_code, ''), 'TR')) AS lang_code,
			CASE
				WHEN UPPER(COALESCE(NULLIF(sl.country_code, ''), 'TR')) IN ('EU', 'EN', 'T1', 'XX', '--') THEN 'TR'
				ELSE UPPER(COALESCE(NULLIF(sl.country_code, ''), 'TR'))
			END AS country_code,
			COALESCE(sl.results_count, 0) AS results_count,
			(COALESCE(sl.results_count, 0) = 0 OR COALESCE(sl.is_zero_result, false) = true) AS is_zero,
			sl.clicked_product_id,
			sl.created_at
		FROM analytics.search_logs sl
		WHERE sl.created_at >= $1 AND sl.created_at < $2
		UNION ALL
		SELECT
			me.entity_id AS query_text,
			LOWER(BTRIM(me.entity_id)) AS normalized_query,
			'TR' AS lang_code,
			CASE
				WHEN UPPER(COALESCE(NULLIF(me.country_code, ''), 'TR')) IN ('EU', 'EN', 'T1', 'XX', '--') THEN 'TR'
				ELSE UPPER(COALESCE(NULLIF(me.country_code, ''), 'TR'))
			END AS country_code,
			cat_match.cnt AS results_count,
			(cat_match.cnt = 0) AS is_zero,
			NULL::varchar AS clicked_product_id,
			me.created_at
		FROM analytics.member_events me
		CROSS JOIN LATERAL (
			SELECT COALESCE(COUNT(*), 0)::int AS cnt
			FROM catalog.mv_products p
			WHERE p.is_active = true
			  AND (
				p.custom_sku ILIKE ('%' || BTRIM(me.entity_id) || '%')
				OR p.brand_name ILIKE ('%' || BTRIM(me.entity_id) || '%')
				OR COALESCE(p.title, '') ILIKE ('%' || BTRIM(me.entity_id) || '%')
				OR COALESCE(p.description, '') ILIKE ('%' || BTRIM(me.entity_id) || '%')
				OR COALESCE(p.translations_json::text, '') ILIKE ('%' || BTRIM(me.entity_id) || '%')
			  )
		) cat_match
		WHERE me.event_type = 'search_query'
		  AND me.entity_id IS NOT NULL AND BTRIM(me.entity_id) <> ''
		  AND me.created_at >= $1 AND me.created_at < $2
		  AND NOT EXISTS (
			SELECT 1 FROM analytics.search_logs sl2
			WHERE sl2.normalized_query = LOWER(BTRIM(me.entity_id))
			  AND sl2.created_at BETWEEN me.created_at - INTERVAL '10 seconds' AND me.created_at + INTERVAL '10 seconds'
		  )
	)
`

const biUnifiedLeadsCTE = `
	me_clicks AS (
		SELECT visitor_id, NULLIF(user_id, '') AS user_id, '' AS email, country_code AS raw_country, created_at
		FROM analytics.member_events
		WHERE event_type IN ('whatsapp_click', 'phone_click', 'email_click', 'website_click')
		  AND created_at >= $1 AND created_at < $2
	),
	be_clicks AS (
		SELECT visitor_id, NULL::text AS user_id, '' AS email, country_code AS raw_country, created_at
		FROM analytics.brand_events
		WHERE event_type IN ('whatsapp_click', 'phone_click', 'email_click', 'website_click')
		  AND created_at >= $1 AND created_at < $2
	),
	contact_clicks AS (
		SELECT * FROM me_clicks
		WHERE (SELECT COUNT(*) FROM me_clicks) >= (SELECT COUNT(*) FROM be_clicks)
		UNION ALL
		SELECT * FROM be_clicks
		WHERE (SELECT COUNT(*) FROM me_clicks) < (SELECT COUNT(*) FROM be_clicks)
	),
	raw_leads AS (
		SELECT visitor_id, user_id, email, raw_country, created_at FROM contact_clicks
		UNION ALL
		SELECT
			NULL::text AS visitor_id,
			NULLIF(cr.customer_id, '') AS user_id,
			COALESCE(cr.customer_email, '') AS email,
			'' AS raw_country,
			cr.created_at
		FROM catalog.chat_rooms cr
		WHERE cr.created_at >= $1 AND cr.created_at < $2
		UNION ALL
		SELECT
			me_inq.visitor_id,
			me_inq.user_id,
			COALESCE(si.email, '') AS email,
			COALESCE(me_inq.country_code, '') AS raw_country,
			si.created_at
		FROM catalog.store_inquiries si
		LEFT JOIN LATERAL (
			SELECT visitor_id, NULLIF(user_id, '') AS user_id, country_code
			FROM analytics.member_events
			WHERE event_type = 'inquiry_submit' AND entity_id = si.id::text
			ORDER BY created_at DESC LIMIT 1
		) me_inq ON true
		WHERE si.created_at >= $1 AND si.created_at < $2
		UNION ALL
		SELECT
			me_rfq.visitor_id,
			me_rfq.user_id,
			COALESCE(r.buyer_email, '') AS email,
			COALESCE(NULLIF(me_rfq.country_code, ''), COALESCE(r.buyer_country, '')) AS raw_country,
			r.created_at
		FROM catalog.buyer_rfqs r
		LEFT JOIN LATERAL (
			SELECT visitor_id, NULLIF(user_id, '') AS user_id, country_code
			FROM analytics.member_events
			WHERE event_type = 'rfq_create' AND entity_id = r.id::text
			ORDER BY created_at DESC LIMIT 1
		) me_rfq ON true
		WHERE r.created_at >= $1 AND r.created_at < $2
	),
	resolved_leads AS (
		SELECT
			rl.created_at,
			COALESCE(
				NULLIF(rl.visitor_id, ''),
				(SELECT l.visitor_id FROM analytics.user_visitor_links l WHERE u_ref.uid IS NOT NULL AND l.user_id = u_ref.uid ORDER BY l.last_seen_at DESC LIMIT 1),
				(SELECT pv.visitor_id FROM analytics.page_views pv WHERE u_ref.uid IS NOT NULL AND pv.user_id = u_ref.uid ORDER BY pv.created_at DESC LIMIT 1),
				''
			) AS eff_vid,
			COALESCE(
				CASE
					WHEN LENGTH(BTRIM(rl.raw_country)) = 2 AND UPPER(BTRIM(rl.raw_country)) NOT IN ('EU', 'EN', 'T1', 'XX', '--') THEN UPPER(BTRIM(rl.raw_country))
					WHEN LOWER(BTRIM(rl.raw_country)) IN ('türkiye', 'turkiye', 'turkey') THEN 'TR'
					WHEN LOWER(BTRIM(rl.raw_country)) IN ('rusya', 'russia') THEN 'RU'
					WHEN LOWER(BTRIM(rl.raw_country)) IN ('almanya', 'germany', 'deutschland') THEN 'DE'
					WHEN LOWER(BTRIM(rl.raw_country)) IN ('fransa', 'france') THEN 'FR'
					WHEN LOWER(BTRIM(rl.raw_country)) IN ('ingiltere', 'birleşik krallık', 'uk', 'united kingdom') THEN 'GB'
					WHEN LOWER(BTRIM(rl.raw_country)) IN ('polonya', 'poland') THEN 'PL'
					WHEN LOWER(BTRIM(rl.raw_country)) IN ('bulgaristan', 'bulgaria') THEN 'BG'
					WHEN LOWER(BTRIM(rl.raw_country)) IN ('suudi arabistan', 'saudi arabia') THEN 'SA'
					WHEN LOWER(BTRIM(rl.raw_country)) IN ('bae', 'uae', 'birleşik arap emirlikleri') THEN 'AE'
					ELSE NULL
				END,
				(
					SELECT CASE
						WHEN UPPER(COALESCE(NULLIF(pv2.country_code, ''), 'TR')) IN ('EU', 'EN', 'T1', 'XX', '--') THEN 'TR'
						ELSE UPPER(COALESCE(NULLIF(pv2.country_code, ''), 'TR'))
					END
					FROM analytics.page_views pv2
					WHERE (rl.visitor_id IS NOT NULL AND rl.visitor_id <> '' AND pv2.visitor_id = rl.visitor_id)
					   OR (u_ref.uid IS NOT NULL AND pv2.user_id = u_ref.uid)
					ORDER BY pv2.created_at DESC
					LIMIT 1
				),
				'TR'
			) AS eff_country
		FROM raw_leads rl
		LEFT JOIN LATERAL (
			SELECT COALESCE(
				rl.user_id,
				(SELECT u.id FROM identity.users u WHERE rl.email <> '' AND LOWER(u.email) = LOWER(rl.email) LIMIT 1)
			) AS uid
		) u_ref ON true
	)
`

func queryBISearchMining(ctx context.Context, win biTimeWindow) BISearchMining {
	res := BISearchMining{
		TopSearches:        []BITopSearchRow{},
		ZeroResultSearches: []BIZeroResultSearchRow{},
	}
	if db.Pool == nil {
		return res
	}

	_ = db.Pool.QueryRow(ctx, biSearchEventsUnionCTE+`
		SELECT COUNT(*), COUNT(*) FILTER (WHERE is_zero = true)
		FROM combined_searches
	`, win.Since, win.Until).Scan(&res.TotalSearches, &res.ZeroResultCount)

	if res.TotalSearches == 0 {
		return res
	}
	res.ZeroResultRatePct = safePct(res.ZeroResultCount, res.TotalSearches)

	topRows, err := db.Pool.Query(ctx, biSearchEventsUnionCTE+`
		SELECT
			MAX(query_text) AS q_label,
			COUNT(*) AS searches,
			COALESCE(AVG(results_count)::float8, 0) AS avg_res,
			COUNT(clicked_product_id) FILTER (WHERE clicked_product_id IS NOT NULL AND clicked_product_id <> '') AS clicks,
			UPPER(COALESCE(MODE() WITHIN GROUP (ORDER BY NULLIF(lang_code, '')), 'TR')) AS top_lang,
			UPPER(COALESCE(MODE() WITHIN GROUP (ORDER BY NULLIF(country_code, '')), 'TR')) AS top_country
		FROM combined_searches
		GROUP BY normalized_query
		ORDER BY searches DESC, clicks DESC
		LIMIT 20
	`, win.Since, win.Until)
	if err == nil {
		defer topRows.Close()
		for topRows.Next() {
			var r BITopSearchRow
			if scanErr := topRows.Scan(&r.Query, &r.Searches, &r.AvgResults, &r.Clicks, &r.TopLang, &r.TopCountry); scanErr == nil {
				r.AvgResults = round1(r.AvgResults)
				r.CTRPct = safePct(r.Clicks, r.Searches)
				res.TopSearches = append(res.TopSearches, r)
			}
		}
	}

	zeroRows, err := db.Pool.Query(ctx, biSearchEventsUnionCTE+`
		SELECT
			MAX(query_text) AS q_label,
			COUNT(*) AS searches,
			MAX(created_at) AS last_at,
			UPPER(COALESCE(MODE() WITHIN GROUP (ORDER BY NULLIF(lang_code, '')), 'TR')) AS top_lang,
			UPPER(COALESCE(MODE() WITHIN GROUP (ORDER BY NULLIF(country_code, '')), 'TR')) AS top_country
		FROM combined_searches
		WHERE is_zero = true
		GROUP BY normalized_query
		ORDER BY searches DESC, last_at DESC
		LIMIT 20
	`, win.Since, win.Until)
	if err == nil {
		defer zeroRows.Close()
		for zeroRows.Next() {
			var z BIZeroResultSearchRow
			if scanErr := zeroRows.Scan(&z.Query, &z.Searches, &z.LastSearchedAt, &z.TopLang, &z.TopCountry); scanErr == nil {
				res.ZeroResultSearches = append(res.ZeroResultSearches, z)
			}
		}
	}

	return res
}

func queryBIGeoCurrencyMatrix(ctx context.Context, win biTimeWindow) []BIGeoCurrencyRow {
	list := []BIGeoCurrencyRow{}
	if db.Pool == nil {
		return list
	}

	sql := `WITH ` + biUnifiedLeadsCTE + `,
		pv_geo AS (
			SELECT
				CASE
					WHEN UPPER(COALESCE(NULLIF(country_code, ''), 'TR')) IN ('EU', 'EN', 'T1', 'XX', '--') THEN 'TR'
					ELSE UPPER(COALESCE(NULLIF(country_code, ''), 'TR'))
				END AS ccode,
				UPPER(COALESCE(MODE() WITHIN GROUP (ORDER BY NULLIF(language, '')), 'TR')) AS top_lang,
				UPPER(COALESCE(MODE() WITHIN GROUP (ORDER BY NULLIF(currency, '')), 'TRY')) AS top_curr,
				COUNT(DISTINCT visitor_id) AS visitors,
				COUNT(*) AS pageviews,
				COUNT(*) FILTER (WHERE path LIKE '/product/%' OR path ~ '^/[a-z]{2}/product/') AS product_views
			FROM analytics.page_views
			WHERE COALESCE(is_bot, false) = false
			  AND created_at >= $1 AND created_at < $2
			GROUP BY 1
		),
		leads_geo AS (
			SELECT eff_country AS ccode, COUNT(*)::int AS leads
			FROM resolved_leads
			GROUP BY 1
		)
		SELECT
			COALESCE(pv_geo.ccode, leads_geo.ccode) AS ccode,
			COALESCE(pv_geo.top_lang, 'TR'),
			COALESCE(pv_geo.top_curr, 'TRY'),
			COALESCE(pv_geo.visitors, 0),
			COALESCE(pv_geo.pageviews, 0),
			COALESCE(pv_geo.product_views, 0),
			COALESCE(leads_geo.leads, 0)
		FROM pv_geo
		FULL OUTER JOIN leads_geo ON leads_geo.ccode = pv_geo.ccode
		ORDER BY COALESCE(pv_geo.visitors, 0) DESC, COALESCE(leads_geo.leads, 0) DESC, COALESCE(pv_geo.pageviews, 0) DESC
		LIMIT 20
	`
	rows, err := db.Pool.Query(ctx, sql, win.Since, win.Until)
	if err != nil {
		return list
	}
	defer rows.Close()

	for rows.Next() {
		var item BIGeoCurrencyRow
		if scanErr := rows.Scan(
			&item.CountryCode,
			&item.TopLanguage,
			&item.TopCurrency,
			&item.Visitors,
			&item.Pageviews,
			&item.ProductViews,
			&item.B2BLeads,
		); scanErr == nil {
			item.CountryLabel = formatCountryLabel(item.CountryCode)
			denom := item.Visitors
			if denom == 0 && item.B2BLeads > 0 {
				denom = item.B2BLeads
			}
			item.ConversionRatePct = safePct(item.B2BLeads, denom)
			list = append(list, item)
		}
	}
	return list
}

func queryBIAcquisitionAttribution(ctx context.Context, win biTimeWindow) []BIAcquisitionRow {
	list := []BIAcquisitionRow{}
	if db.Pool == nil {
		return list
	}

	sql := `WITH ` + biUnifiedLeadsCTE + `,
		sess_base AS (
			SELECT
				COALESCE(NULLIF(session_id, ''), visitor_id) AS sess_id,
				visitor_id,
				referrer_host,
				utm_source,
				utm_medium,
				utm_campaign,
				click_id,
				path,
				duration_sec,
				created_at
			FROM analytics.page_views
			WHERE COALESCE(is_bot, false) = false
			  AND created_at >= $1 AND created_at < $2
		),
		sess_first AS (
			SELECT DISTINCT ON (sess_id)
				sess_id,
				visitor_id,
				created_at AS first_at,
				COALESCE(NULLIF(utm_source, ''), COALESCE(NULLIF(referrer_host, ''), 'Doğrudan (Direct)')) AS src,
				COALESCE(NULLIF(utm_medium, ''), 'none') AS med,
				COALESCE(NULLIF(utm_campaign, ''), '-') AS camp,
				(COALESCE(click_id, '') <> '') AS paid_click,
				CASE
					WHEN COALESCE(click_id, '') <> '' OR LOWER(COALESCE(utm_medium, '')) IN ('cpc', 'ppc', 'paid', 'ads', 'paid_social') THEN 'Paid Ads'
					WHEN LOWER(COALESCE(utm_source, '') || ' ' || COALESCE(referrer_host, '')) ~ '(chatgpt|openai|perplexity|claude|anthropic|gemini|bard\.google|copilot\.microsoft|grok\.com|deepseek|meta\.ai|you\.com|phind)' THEN 'AI Assistant'
					WHEN referrer_host IN ('Google Arama', 'Yandex Arama', 'Bing Arama', 'DuckDuckGo', 'Brave Search', 'Yahoo Arama', 'Baidu', 'Ecosia')
					  OR LOWER(COALESCE(referrer_host, '')) ~ '(duckduckgo\.|search\.brave\.|yahoo\.|yandex\.|google\.|bing\.)'
					  OR LOWER(COALESCE(utm_medium, '')) = 'organic' THEN 'Organic Search'
					WHEN referrer_host IN ('Instagram', 'Facebook', 'WhatsApp', 'Telegram', 'TikTok', 'YouTube', 'LinkedIn', 'Pinterest', 'X (Twitter)') OR LOWER(COALESCE(utm_medium, '')) = 'social' THEN 'Social & Messaging'
					WHEN COALESCE(utm_source, '') <> '' THEN 'Campaign / UTM'
					WHEN COALESCE(referrer_host, '') IN ('', 'Doğrudan (Direct)') THEN 'Direct'
					ELSE 'Referral'
				END AS channel
			FROM sess_base
			ORDER BY sess_id, created_at ASC
		),
		sess_metrics AS (
			SELECT
				sess_id,
				COUNT(*) AS pv_cnt,
				SUM(duration_sec) AS dur_sum,
				COUNT(*) FILTER (WHERE path LIKE '/product/%' OR path ~ '^/[a-z]{2}/product/') AS prod_views
			FROM sess_base
			GROUP BY sess_id
		),
		sess_channels AS (
			SELECT
				sf.channel,
				sf.src,
				sf.med,
				sf.camp,
				BOOL_OR(sf.paid_click) AS has_paid,
				COUNT(DISTINCT sf.visitor_id) AS visitors,
				COUNT(*) AS sessions,
				COUNT(*) FILTER (WHERE sm.pv_cnt = 1 AND sm.dur_sum < 10) AS bounce_sess,
				COALESCE(SUM(sm.prod_views), 0)::int AS product_views
			FROM sess_first sf
			JOIN sess_metrics sm ON sm.sess_id = sf.sess_id
			GROUP BY sf.channel, sf.src, sf.med, sf.camp
		),
		lead_channels AS (
			SELECT
				COALESCE(matched_sf.channel, 'Direct') AS channel,
				COALESCE(matched_sf.src, 'Doğrudan (Direct)') AS src,
				COALESCE(matched_sf.med, 'none') AS med,
				COALESCE(matched_sf.camp, '-') AS camp,
				COUNT(*)::int AS leads
			FROM resolved_leads rl
			LEFT JOIN LATERAL (
				SELECT sf.channel, sf.src, sf.med, sf.camp
				FROM sess_first sf
				WHERE rl.eff_vid <> '' AND sf.visitor_id = rl.eff_vid
				ORDER BY (sf.first_at <= rl.created_at) DESC, sf.first_at DESC
				LIMIT 1
			) matched_sf ON true
			GROUP BY 1, 2, 3, 4
		)
		SELECT
			COALESCE(sc.channel, lc.channel) AS channel,
			COALESCE(sc.src, lc.src) AS src,
			COALESCE(sc.med, lc.med) AS med,
			COALESCE(sc.camp, lc.camp) AS camp,
			COALESCE(sc.has_paid, false) AS has_paid,
			COALESCE(sc.visitors, 0)::int AS visitors,
			COALESCE(sc.sessions, 0)::int AS sessions,
			COALESCE(sc.bounce_sess, 0)::int AS bounce_sess,
			COALESCE(sc.product_views, 0)::int AS product_views,
			COALESCE(lc.leads, 0)::int AS leads
		FROM sess_channels sc
		FULL OUTER JOIN lead_channels lc
			ON lc.channel = sc.channel AND lc.src = sc.src AND lc.med = sc.med AND lc.camp = sc.camp
		ORDER BY COALESCE(sc.sessions, 0) DESC, COALESCE(lc.leads, 0) DESC, COALESCE(sc.visitors, 0) DESC
		LIMIT 20
	`
	rows, err := db.Pool.Query(ctx, sql, win.Since, win.Until)
	if err != nil {
		return list
	}
	defer rows.Close()

	for rows.Next() {
		var r BIAcquisitionRow
		var bounceSess int
		if scanErr := rows.Scan(
			&r.Channel, &r.Source, &r.Medium, &r.Campaign, &r.HasPaidClickID,
			&r.Visitors, &r.Sessions, &bounceSess, &r.ProductViews, &r.B2BLeads,
		); scanErr == nil {
			r.BounceRatePct = safePct(bounceSess, r.Sessions)
			denom := r.Sessions
			if denom == 0 && r.B2BLeads > 0 {
				denom = r.B2BLeads
			}
			r.LeadRatePct = safePct(r.B2BLeads, denom)
			list = append(list, r)
		}
	}
	return list
}

func queryBILandingPages(ctx context.Context, win biTimeWindow) []BILandingPageRow {
	list := []BILandingPageRow{}
	landingSQL := `
		WITH sess_pv AS (
			SELECT
				COALESCE(NULLIF(session_id, ''), visitor_id) AS sess_id,
				path,
				duration_sec,
				scroll_depth_pct,
				created_at
			FROM analytics.page_views
			WHERE COALESCE(is_bot, false) = false
			  AND created_at >= $1 AND created_at < $2
		),
		entry_pv AS (
			SELECT DISTINCT ON (sess_id)
				sess_id, path, duration_sec, scroll_depth_pct
			FROM sess_pv
			ORDER BY sess_id, created_at ASC
		),
		sess_tot AS (
			SELECT sess_id, COUNT(*) AS pv_cnt, SUM(duration_sec) AS tot_dur
			FROM sess_pv
			GROUP BY sess_id
		)
		SELECT
			ep.path,
			COUNT(*) AS sessions,
			COUNT(*) FILTER (WHERE st.pv_cnt = 1 AND st.tot_dur < 10) AS bounces,
			COALESCE(AVG(st.tot_dur)::float8, 0) AS avg_dur,
			COALESCE(AVG(NULLIF(ep.scroll_depth_pct, 0))::float8, 0) AS avg_scroll
		FROM entry_pv ep
		JOIN sess_tot st ON st.sess_id = ep.sess_id
		GROUP BY ep.path
		ORDER BY sessions DESC
		LIMIT 15
	`
	if rows, err := db.Pool.Query(ctx, landingSQL, win.Since, win.Until); err == nil {
		defer rows.Close()
		for rows.Next() {
			var lp BILandingPageRow
			var bounces int
			if scanErr := rows.Scan(&lp.Path, &lp.Sessions, &bounces, &lp.AvgDurationSec, &lp.AvgScrollPct); scanErr == nil {
				lp.BounceRatePct = safePct(bounces, lp.Sessions)
				lp.AvgDurationSec = round1(lp.AvgDurationSec)
				lp.AvgScrollPct = round1(lp.AvgScrollPct)
				list = append(list, lp)
			}
		}
	}
	return list
}

func queryBIExitPages(ctx context.Context, win biTimeWindow) []BIExitPageRow {
	list := []BIExitPageRow{}
	exitSQL := `
		WITH sess_pv AS (
			SELECT
				COALESCE(NULLIF(session_id, ''), visitor_id) AS sess_id,
				path,
				created_at
			FROM analytics.page_views
			WHERE COALESCE(is_bot, false) = false
			  AND created_at >= $1 AND created_at < $2
		),
		last_pv AS (
			SELECT DISTINCT ON (sess_id) sess_id, path
			FROM sess_pv
			ORDER BY sess_id, created_at DESC
		),
		path_totals AS (
			SELECT path, COUNT(*) AS views
			FROM sess_pv
			GROUP BY path
		)
		SELECT
			lp.path,
			COUNT(*) AS exits,
			COALESCE(MAX(pt.views), 1) AS total_views
		FROM last_pv lp
		LEFT JOIN path_totals pt ON pt.path = lp.path
		GROUP BY lp.path
		ORDER BY exits DESC
		LIMIT 15
	`
	if rows, err := db.Pool.Query(ctx, exitSQL, win.Since, win.Until); err == nil {
		defer rows.Close()
		for rows.Next() {
			var ep BIExitPageRow
			var totViews int
			if scanErr := rows.Scan(&ep.Path, &ep.Exits, &totViews); scanErr == nil {
				ep.ExitRatePct = safePct(ep.Exits, totViews)
				if ep.ExitRatePct > 100 {
					ep.ExitRatePct = 100
				}
				list = append(list, ep)
			}
		}
	}
	return list
}

func queryBIPageIntelligence(ctx context.Context, win biTimeWindow) BIPageIntelligence {
	if db.Pool == nil {
		return BIPageIntelligence{
			LandingPages: []BILandingPageRow{},
			ExitPages:    []BIExitPageRow{},
		}
	}
	return BIPageIntelligence{
		LandingPages: queryBILandingPages(ctx, win),
		ExitPages:    queryBIExitPages(ctx, win),
	}
}

func classifyProductOpportunityFlag(views, cartAdds, inquiriesOrOrders int, convPct float64) string {
	if views >= 5 && cartAdds == 0 && inquiriesOrOrders == 0 {
		return "high_views_low_cart"
	}
	if cartAdds >= 2 && inquiriesOrOrders == 0 {
		return "cart_abandon_risk"
	}
	if inquiriesOrOrders >= 2 || (views >= 5 && convPct >= 15.0) {
		return "high_demand_winner"
	}
	return ""
}

func queryBIHotProducts(ctx context.Context, win biTimeWindow) []BIHotProductRow {
	list := []BIHotProductRow{}
	prodSQL := `
		WITH me_prod AS (
			SELECT
				entity_id AS pid,
				COUNT(*) FILTER (WHERE event_type = 'product_view') AS me_views,
				COUNT(*) FILTER (WHERE event_type = 'cart_add') AS cart_adds
			FROM analytics.member_events
			WHERE entity_id IS NOT NULL AND entity_id <> ''
			  AND event_type IN ('product_view', 'cart_add')
			  AND created_at >= $1 AND created_at < $2
			GROUP BY entity_id
		),
		be_prod AS (
			SELECT
				product_id::text AS pid,
				COUNT(*) FILTER (WHERE event_type = 'product_view') AS be_views,
				COUNT(*) FILTER (WHERE event_type IN ('whatsapp_click', 'phone_click', 'inquiry_submit')) AS wa_leads
			FROM analytics.brand_events
			WHERE product_id IS NOT NULL
			  AND created_at >= $1 AND created_at < $2
			GROUP BY product_id
		),
		ord_prod AS (
			SELECT oi.product_id::text AS pid, COUNT(DISTINCT oi.order_id) AS ord_cnt
			FROM catalog.order_items oi
			JOIN catalog.orders o ON o.id = oi.order_id
			WHERE oi.product_id IS NOT NULL
			  AND o.created_at >= $1 AND o.created_at < $2
			  AND UPPER(COALESCE(o.order_status, '')) <> 'CANCELLED'
			GROUP BY oi.product_id
		),
		inq_prod AS (
			SELECT sii.product_id::text AS pid, COUNT(DISTINCT sii.inquiry_id) AS inq_cnt
			FROM catalog.store_inquiry_items sii
			JOIN catalog.store_inquiries si ON si.id = sii.inquiry_id
			WHERE si.created_at >= $1 AND si.created_at < $2
			GROUP BY sii.product_id
		)
		SELECT
			p.id::text,
			p.title,
			COALESCE(p.custom_sku, ''),
			COALESCE(b.brand_name, ''),
			GREATEST(COALESCE(me_prod.me_views, 0), COALESCE(be_prod.be_views, 0))::int AS views,
			COALESCE(me_prod.cart_adds, 0)::int AS cart_adds,
			(COALESCE(be_prod.wa_leads, 0) + COALESCE(ord_prod.ord_cnt, 0) + COALESCE(inq_prod.inq_cnt, 0))::int AS convs
		FROM catalog.products p
		LEFT JOIN catalog.brands b ON b.id = p.brand_id
		LEFT JOIN me_prod ON me_prod.pid = p.id::text
		LEFT JOIN be_prod ON be_prod.pid = p.id::text
		LEFT JOIN ord_prod ON ord_prod.pid = p.id::text
		LEFT JOIN inq_prod ON inq_prod.pid = p.id::text
		WHERE p.is_active = true
		  AND (
		      COALESCE(me_prod.me_views, 0) > 0
		      OR COALESCE(be_prod.be_views, 0) > 0
		      OR COALESCE(me_prod.cart_adds, 0) > 0
		      OR COALESCE(ord_prod.ord_cnt, 0) > 0
		      OR COALESCE(inq_prod.inq_cnt, 0) > 0
		  )
		ORDER BY views DESC, cart_adds DESC, convs DESC
		LIMIT 20
	`
	if rows, err := db.Pool.Query(ctx, prodSQL, win.Since, win.Until); err == nil {
		defer rows.Close()
		for rows.Next() {
			var hp BIHotProductRow
			if scanErr := rows.Scan(
				&hp.ProductID, &hp.Title, &hp.CustomSKU, &hp.BrandName,
				&hp.Views, &hp.CartAdds, &hp.InquiriesOrOrders,
			); scanErr == nil {
				denom := hp.Views
				if denom <= 0 {
					denom = hp.CartAdds + hp.InquiriesOrOrders
				}
				hp.ConversionPct = safePct(hp.CartAdds+hp.InquiriesOrOrders, denom)
				hp.OpportunityFlag = classifyProductOpportunityFlag(hp.Views, hp.CartAdds, hp.InquiriesOrOrders, hp.ConversionPct)
				list = append(list, hp)
			}
		}
	}
	return list
}

func queryBITopBrands(ctx context.Context, win biTimeWindow) []BITopBrandRow {
	list := []BITopBrandRow{}
	brandSQL := `
		WITH be_agg AS (
			SELECT
				brand_id,
				COUNT(*) FILTER (WHERE event_type = 'profile_view') AS prof_views,
				COUNT(*) FILTER (WHERE event_type = 'product_view') AS prod_views,
				COUNT(*) FILTER (WHERE event_type IN ('whatsapp_click', 'phone_click', 'email_click', 'website_click', 'inquiry_submit', 'chat_start')) AS contacts
			FROM analytics.brand_events
			WHERE created_at >= $1 AND created_at < $2
			GROUP BY brand_id
		),
		chat_agg AS (
			SELECT brand_id, COUNT(*) AS chats
			FROM catalog.chat_rooms
			WHERE created_at >= $1 AND created_at < $2
			GROUP BY brand_id
		),
		sub_agg AS (
			SELECT brand_id, COUNT(*) AS sub_orders
			FROM catalog.supplier_sub_orders
			WHERE created_at >= $1 AND created_at < $2
			GROUP BY brand_id
		)
		SELECT
			b.id::text,
			b.brand_name,
			COALESCE(be_agg.prof_views, 0)::int,
			COALESCE(be_agg.prod_views, 0)::int,
			(COALESCE(be_agg.contacts, 0) + COALESCE(chat_agg.chats, 0) + COALESCE(sub_agg.sub_orders, 0))::int AS total_leads
		FROM catalog.brands b
		LEFT JOIN be_agg ON be_agg.brand_id = b.id
		LEFT JOIN chat_agg ON chat_agg.brand_id = b.id
		LEFT JOIN sub_agg ON sub_agg.brand_id = b.id
		WHERE b.is_active = true
		  AND (COALESCE(be_agg.prof_views, 0) + COALESCE(be_agg.prod_views, 0) + COALESCE(be_agg.contacts, 0) + COALESCE(chat_agg.chats, 0) + COALESCE(sub_agg.sub_orders, 0)) > 0
		ORDER BY total_leads DESC, COALESCE(be_agg.prod_views, 0) DESC
		LIMIT 15
	`
	if rows, err := db.Pool.Query(ctx, brandSQL, win.Since, win.Until); err == nil {
		defer rows.Close()
		for rows.Next() {
			var tb BITopBrandRow
			if scanErr := rows.Scan(&tb.BrandID, &tb.BrandName, &tb.ProfileViews, &tb.ProductViews, &tb.WhatsappAndLeads); scanErr == nil {
				tb.LeadRatePct = safePct(tb.WhatsappAndLeads, tb.ProfileViews+tb.ProductViews)
				list = append(list, tb)
			}
		}
	}
	return list
}

func queryBIProductAndBrandVelocity(ctx context.Context, win biTimeWindow) BIProductBrandVelocity {
	if db.Pool == nil {
		return BIProductBrandVelocity{
			HotProducts: []BIHotProductRow{},
			TopBrands:   []BITopBrandRow{},
		}
	}
	return BIProductBrandVelocity{
		HotProducts: queryBIHotProducts(ctx, win),
		TopBrands:   queryBITopBrands(ctx, win),
	}
}

type buyerScoreInputs struct {
	isRegistered   bool
	productsViewed int
	cartAdds       int
	leadActions    int
	totalDwellSec  int
	avgScrollPct   int
	sessionCount   int
}

func computeBuyerLeadScore(in buyerScoreInputs) int {
	score := 5
	if in.isRegistered {
		score += 15
	}
	score += clampIntRange(in.productsViewed*4, 0, 20)
	score += clampIntRange(in.totalDwellSec/20, 0, 15)
	score += clampIntRange(in.avgScrollPct/10, 0, 10)
	if in.sessionCount > 1 {
		score += clampIntRange((in.sessionCount-1)*5, 0, 10)
	}
	score += clampIntRange(in.cartAdds*10, 0, 20)
	score += clampIntRange(in.leadActions*15, 0, 30)
	return clampIntRange(score, 5, 100)
}

func queryBIHotBuyerLeads(ctx context.Context, win biTimeWindow) []BIHotBuyerLeadRow {
	leads := []BIHotBuyerLeadRow{}
	if db.Pool == nil {
		return leads
	}

	sql := `
		WITH pv_vis AS (
			SELECT
				visitor_id,
				MAX(NULLIF(user_id, '')) AS linked_uid,
				CASE
					WHEN UPPER(COALESCE((ARRAY_AGG(NULLIF(country_code, '') ORDER BY created_at DESC))[1], 'TR')) IN ('EU', 'EN', 'T1', 'XX', '--') THEN 'TR'
					ELSE UPPER(COALESCE((ARRAY_AGG(NULLIF(country_code, '') ORDER BY created_at DESC))[1], 'TR'))
				END AS country_code,
				UPPER(COALESCE((ARRAY_AGG(NULLIF(language, '') ORDER BY created_at DESC))[1], 'TR')) AS lang,
				UPPER(COALESCE((ARRAY_AGG(NULLIF(currency, '') ORDER BY created_at DESC))[1], 'TRY')) AS curr,
				COALESCE((ARRAY_AGG(NULLIF(device_type, '') ORDER BY created_at DESC))[1], 'desktop') AS dev,
				COALESCE((ARRAY_AGG(NULLIF(referrer_host, '') ORDER BY created_at ASC))[1], 'Doğrudan (Direct)') AS ref_host,
				COUNT(DISTINCT COALESCE(NULLIF(session_id, ''), visitor_id)) AS sess_cnt,
				COUNT(*) FILTER (WHERE path LIKE '/product/%' OR path ~ '^/[a-z]{2}/product/') AS pv_prod_cnt,
				COALESCE(SUM(duration_sec), 0)::int AS dwell_sec,
				COALESCE(AVG(NULLIF(scroll_depth_pct, 0))::int, 0) AS avg_scroll,
				MAX(created_at) AS last_pv_at,
				COALESCE((ARRAY_AGG(COALESCE(NULLIF(page_title, ''), path) ORDER BY created_at DESC))[1], '/') AS last_pv_title
			FROM analytics.page_views
			WHERE COALESCE(is_bot, false) = false
			  AND visitor_id <> ''
			  AND created_at >= $1 AND created_at < $2
			GROUP BY visitor_id
		),
		me_vis AS (
			SELECT
				visitor_id,
				MAX(NULLIF(user_id, '')) AS me_uid,
				COUNT(*) FILTER (WHERE event_type = 'product_view') AS me_prod_cnt,
				COUNT(*) FILTER (WHERE event_type IN ('cart_add', 'wishlist_add', 'cart_excel_export', 'pack_calc')) AS cart_cnt,
				COUNT(*) FILTER (WHERE event_type IN ('whatsapp_click', 'phone_click', 'email_click', 'chat_start', 'chat_message', 'rfq_create', 'inquiry_submit', 'order_create')) AS lead_cnt,
				MAX(created_at) AS last_me_at,
				(ARRAY_AGG(title ORDER BY created_at DESC))[1] AS last_me_title
			FROM analytics.member_events
			WHERE visitor_id IS NOT NULL AND visitor_id <> ''
			  AND created_at >= $1 AND created_at < $2
			GROUP BY visitor_id
		)
		SELECT
			pv_vis.visitor_id,
			COALESCE(pv_vis.linked_uid, me_vis.me_uid, uvl.user_id, '') AS uid,
			COALESCE(NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), ''), '') AS cust_name,
			COALESCE(u.email, '') AS cust_email,
			pv_vis.country_code,
			pv_vis.lang,
			pv_vis.curr,
			pv_vis.dev,
			pv_vis.ref_host,
			GREATEST(pv_vis.pv_prod_cnt, COALESCE(me_vis.me_prod_cnt, 0))::int AS products_viewed,
			COALESCE(me_vis.cart_cnt, 0)::int AS cart_adds,
			COALESCE(me_vis.lead_cnt, 0)::int AS lead_actions,
			pv_vis.dwell_sec,
			pv_vis.avg_scroll,
			pv_vis.sess_cnt::int,
			GREATEST(pv_vis.last_pv_at, COALESCE(me_vis.last_me_at, pv_vis.last_pv_at)) AS last_seen,
			COALESCE(NULLIF(me_vis.last_me_title, ''), pv_vis.last_pv_title) AS last_action
		FROM pv_vis
		LEFT JOIN me_vis ON me_vis.visitor_id = pv_vis.visitor_id
		LEFT JOIN LATERAL (
			SELECT l.user_id FROM analytics.user_visitor_links l
			WHERE l.visitor_id = pv_vis.visitor_id
			ORDER BY l.last_seen_at DESC LIMIT 1
		) uvl ON true
		LEFT JOIN identity.users u ON u.id = COALESCE(pv_vis.linked_uid, me_vis.me_uid, uvl.user_id)
		ORDER BY
			(COALESCE(me_vis.lead_cnt, 0) * 15 + COALESCE(me_vis.cart_cnt, 0) * 10 + GREATEST(pv_vis.pv_prod_cnt, COALESCE(me_vis.me_prod_cnt, 0)) * 4 + LEAST(pv_vis.dwell_sec / 20, 15)) DESC,
			last_seen DESC
		LIMIT 25
	`
	rows, err := db.Pool.Query(ctx, sql, win.Since, win.Until)
	if err != nil {
		return leads
	}
	defer rows.Close()

	for rows.Next() {
		var row BIHotBuyerLeadRow
		var avgScroll, sessCnt int
		if scanErr := rows.Scan(
			&row.VisitorID, &row.UserID, &row.CustomerName, &row.CustomerEmail,
			&row.CountryCode, &row.Language, &row.Currency, &row.DeviceType, &row.ReferrerHost,
			&row.ProductsViewed, &row.CartAdds, &row.LeadActions, &row.TotalDwellSec,
			&avgScroll, &sessCnt, &row.LastSeenAt, &row.LastActionTitle,
		); scanErr == nil {
			row.IsRegistered = row.UserID != ""
			row.LeadScore = computeBuyerLeadScore(buyerScoreInputs{
				isRegistered:   row.IsRegistered,
				productsViewed: row.ProductsViewed,
				cartAdds:       row.CartAdds,
				leadActions:    row.LeadActions,
				totalDwellSec:  row.TotalDwellSec,
				avgScrollPct:   avgScroll,
				sessionCount:   sessCnt,
			})
			leads = append(leads, row)
		}
	}
	return leads
}

func queryBIWebVitalsAndTech(ctx context.Context, win biTimeWindow) BIWebVitalsAndTech {
	out := BIWebVitalsAndTech{
		WebVitalsByDevice:       []BIWebVitalsDeviceRow{},
		ScreenResolutions:       []BIScreenResolutionRow{},
		OSBreakdown:             []BINamedTechRow{},
		BrowserBreakdown:        []BINamedTechRow{},
		HourlyConversionHeatmap: []BIHourlyHeatmapCell{},
	}
	if db.Pool == nil {
		return out
	}

	vitalsSQL := `
		SELECT
			COALESCE(NULLIF(device_type, ''), 'desktop') AS dev,
			COUNT(*) AS samples,
			COALESCE(AVG(CASE WHEN lcp_ms > 0 AND lcp_ms <= 30000 THEN lcp_ms END)::float8, 0) AS avg_lcp,
			COALESCE(AVG(CASE WHEN inp_ms > 0 AND inp_ms <= 5000 THEN inp_ms END)::float8, 0) AS avg_inp,
			COALESCE(AVG(CASE WHEN cls_score > 0 AND cls_score <= 5 THEN cls_score END)::float8, 0) AS avg_cls,
			COALESCE(AVG(CASE WHEN ttfb_ms > 0 AND ttfb_ms <= 15000 THEN ttfb_ms END)::float8, 0) AS avg_ttfb,
			COUNT(*) FILTER (WHERE lcp_ms > 0 AND lcp_ms <= 2500) AS good_lcp,
			COUNT(*) FILTER (WHERE lcp_ms > 0 AND lcp_ms <= 30000) AS total_lcp
		FROM analytics.page_views
		WHERE COALESCE(is_bot, false) = false
		  AND created_at >= $1 AND created_at < $2
		  AND (
			(lcp_ms > 0 AND lcp_ms <= 30000)
			OR (inp_ms > 0 AND inp_ms <= 5000)
			OR (ttfb_ms > 0 AND ttfb_ms <= 15000)
			OR (cls_score > 0 AND cls_score <= 5)
		  )
		GROUP BY dev
		ORDER BY samples DESC
	`
	if rows, err := db.Pool.Query(ctx, vitalsSQL, win.Since, win.Until); err == nil {
		defer rows.Close()
		for rows.Next() {
			var v BIWebVitalsDeviceRow
			var goodLCP, totalLCP int
			if scanErr := rows.Scan(&v.DeviceType, &v.Samples, &v.AvgLCPMs, &v.AvgINPMs, &v.AvgCLS, &v.AvgTTFBMs, &goodLCP, &totalLCP); scanErr == nil {
				v.AvgLCPMs = round1(v.AvgLCPMs)
				v.AvgINPMs = round1(v.AvgINPMs)
				v.AvgCLS = math.Round(v.AvgCLS*1000) / 1000
				v.AvgTTFBMs = round1(v.AvgTTFBMs)
				v.GoodLCPPct = safePct(goodLCP, totalLCP)
				out.WebVitalsByDevice = append(out.WebVitalsByDevice, v)
			}
		}
	}

	out.ScreenResolutions = queryBIScreenResolutions(ctx, win)

	out.OSBreakdown = queryBINamedTechBuckets(ctx, win, `
		SELECT COALESCE(NULLIF(os, ''), 'Diğer') AS lbl,
		       COUNT(DISTINCT visitor_id) AS visitors,
		       COUNT(*) AS pvs
		FROM analytics.page_views
		WHERE COALESCE(is_bot, false) = false
		  AND created_at >= $1 AND created_at < $2
		GROUP BY lbl
		ORDER BY visitors DESC, pvs DESC
		LIMIT 10
	`)

	out.BrowserBreakdown = queryBINamedTechBuckets(ctx, win, `
		SELECT COALESCE(NULLIF(browser, ''), 'Diğer') AS lbl,
		       COUNT(DISTINCT visitor_id) AS visitors,
		       COUNT(*) AS pvs
		FROM analytics.page_views
		WHERE COALESCE(is_bot, false) = false
		  AND created_at >= $1 AND created_at < $2
		GROUP BY lbl
		ORDER BY visitors DESC, pvs DESC
		LIMIT 10
	`)

	out.HourlyConversionHeatmap = queryBIHourlyHeatmap(ctx, win)
	return out
}

func queryBIScreenResolutions(ctx context.Context, win biTimeWindow) []BIScreenResolutionRow {
	rows, err := db.Pool.Query(ctx, `
		SELECT (screen_width::text || 'x' || screen_height::text) AS res,
		       COUNT(DISTINCT visitor_id) AS visitors,
		       COUNT(*) AS pvs
		FROM analytics.page_views
		WHERE COALESCE(is_bot, false) = false
		  AND screen_width > 0 AND screen_height > 0
		  AND created_at >= $1 AND created_at < $2
		GROUP BY res
		ORDER BY visitors DESC, pvs DESC
		LIMIT 10
	`, win.Since, win.Until)
	if err != nil {
		return []BIScreenResolutionRow{}
	}
	defer rows.Close()

	list := []BIScreenResolutionRow{}
	totalPV := 0
	for rows.Next() {
		var item BIScreenResolutionRow
		if scanErr := rows.Scan(&item.Resolution, &item.Visitors, &item.Pageviews); scanErr == nil {
			item.Count = item.Visitors
			if item.Count == 0 {
				item.Count = item.Pageviews
			}
			totalPV += item.Pageviews
			list = append(list, item)
		}
	}
	for i := range list {
		list[i].SharePct = safePct(list[i].Pageviews, totalPV)
	}
	return list
}

func queryBINamedTechBuckets(ctx context.Context, win biTimeWindow, sql string) []BINamedTechRow {
	rows, err := db.Pool.Query(ctx, sql, win.Since, win.Until)
	if err != nil {
		return []BINamedTechRow{}
	}
	defer rows.Close()

	list := []BINamedTechRow{}
	totalPV := 0
	for rows.Next() {
		var item BINamedTechRow
		if scanErr := rows.Scan(&item.Name, &item.Visitors, &item.Pageviews); scanErr == nil {
			item.Count = item.Visitors
			if item.Count == 0 {
				item.Count = item.Pageviews
			}
			totalPV += item.Pageviews
			list = append(list, item)
		}
	}
	for i := range list {
		list[i].SharePct = safePct(list[i].Pageviews, totalPV)
	}
	return list
}

func queryBIHourlyHeatmap(ctx context.Context, win biTimeWindow) []BIHourlyHeatmapCell {
	cells := []BIHourlyHeatmapCell{}
	heatmapSQL := `
		WITH pv_hm AS (
			SELECT
				EXTRACT(DOW FROM (created_at AT TIME ZONE 'Europe/Istanbul'))::int AS dow,
				EXTRACT(HOUR FROM (created_at AT TIME ZONE 'Europe/Istanbul'))::int AS hr,
				COUNT(DISTINCT visitor_id) AS visitors,
				COUNT(*) AS pageviews
			FROM analytics.page_views
			WHERE COALESCE(is_bot, false) = false
			  AND created_at >= $1 AND created_at < $2
			GROUP BY 1, 2
		),
		lead_hm AS (
			SELECT dow, hr, SUM(cnt)::int AS leads FROM (
				SELECT
					EXTRACT(DOW FROM (created_at AT TIME ZONE 'Europe/Istanbul'))::int AS dow,
					EXTRACT(HOUR FROM (created_at AT TIME ZONE 'Europe/Istanbul'))::int AS hr,
					COUNT(*) AS cnt
				FROM analytics.brand_events
				WHERE event_type IN ('whatsapp_click', 'phone_click', 'email_click', 'website_click', 'inquiry_submit', 'chat_start')
				  AND created_at >= $1 AND created_at < $2
				GROUP BY 1, 2
				UNION ALL
				SELECT
					EXTRACT(DOW FROM (created_at AT TIME ZONE 'Europe/Istanbul'))::int AS dow,
					EXTRACT(HOUR FROM (created_at AT TIME ZONE 'Europe/Istanbul'))::int AS hr,
					COUNT(*) AS cnt
				FROM catalog.store_inquiries
				WHERE created_at >= $1 AND created_at < $2
				GROUP BY 1, 2
			) u
			GROUP BY dow, hr
		)
		SELECT
			COALESCE(pv_hm.dow, lead_hm.dow) AS dow,
			COALESCE(pv_hm.hr, lead_hm.hr) AS hr,
			COALESCE(pv_hm.visitors, 0),
			COALESCE(pv_hm.pageviews, 0),
			COALESCE(lead_hm.leads, 0)
		FROM pv_hm
		FULL OUTER JOIN lead_hm ON lead_hm.dow = pv_hm.dow AND lead_hm.hr = pv_hm.hr
		ORDER BY 1 ASC, 2 ASC
	`
	rows, err := db.Pool.Query(ctx, heatmapSQL, win.Since, win.Until)
	if err != nil {
		return cells
	}
	defer rows.Close()

	for rows.Next() {
		var c BIHourlyHeatmapCell
		if scanErr := rows.Scan(&c.DayOfWeek, &c.HourOfDay, &c.Visitors, &c.Pageviews, &c.Leads); scanErr == nil {
			cells = append(cells, c)
		}
	}
	return cells
}

const biBotCrawlUnionCTE = `
	WITH hourly_bounds AS (
		SELECT MIN(bucket_hour) AS first_hourly_at
		FROM analytics.bot_crawl_hourly
	),
	bot_hits AS (
		SELECT
			h.bucket_hour,
			h.bot_name,
			h.bot_category,
			h.path,
			h.hits,
			h.last_seen_at AS created_at,
			true AS from_hourly
		FROM analytics.bot_crawl_hourly h
		WHERE h.last_seen_at >= $1 AND h.bucket_hour < $2
		UNION ALL
		SELECT
			date_trunc('hour', b.created_at) AS bucket_hour,
			COALESCE(NULLIF(b.bot_name, ''), 'UnknownBot') AS bot_name,
			''::text AS bot_category,
			b.path,
			1::bigint AS hits,
			b.created_at,
			false AS from_hourly
		FROM analytics.bot_crawl_logs b, hourly_bounds hb
		WHERE b.created_at >= $1 AND b.created_at < $2
		  AND b.created_at < COALESCE(hb.first_hourly_at, '9999-12-31'::timestamptz)
		UNION ALL
		SELECT
			date_trunc('hour', pv.created_at) AS bucket_hour,
			COALESCE(NULLIF(pv.bot_name, ''), 'UnknownBot') AS bot_name,
			''::text AS bot_category,
			pv.path,
			1::bigint AS hits,
			pv.created_at,
			false AS from_hourly
		FROM analytics.page_views pv, hourly_bounds hb
		WHERE pv.is_bot = true
		  AND pv.created_at >= $1 AND pv.created_at < $2
		  AND pv.created_at < COALESCE(hb.first_hourly_at, '9999-12-31'::timestamptz)
		  AND COALESCE(pv.bot_name, '') <> 'EmptyUA'
		  AND NOT EXISTS (
			SELECT 1 FROM analytics.bot_crawl_logs b2
			WHERE b2.bot_name = COALESCE(NULLIF(pv.bot_name, ''), 'UnknownBot')
			  AND b2.path = pv.path
			  AND b2.created_at BETWEEN pv.created_at - INTERVAL '5 seconds' AND pv.created_at + INTERVAL '5 seconds'
		  )
	)
`

const biBotTopCrawledPathsSQL = biBotCrawlUnionCTE + `,
	ranked_path_bots AS (
		SELECT
			path,
			bot_name,
			SUM(hits) AS bot_hits,
			ROW_NUMBER() OVER (PARTITION BY path ORDER BY SUM(hits) DESC, bot_name ASC) AS rn
		FROM bot_hits
		GROUP BY path, bot_name
	)
	SELECT
		bh.path,
		COALESCE(SUM(bh.hits), 0)::int AS hits,
		COALESCE(MAX(rpb.bot_name) FILTER (WHERE rpb.rn = 1), 'UnknownBot') AS top_bot,
		COUNT(DISTINCT bh.bot_name)::int AS uniq_bots,
		MAX(bh.created_at) AS last_at
	FROM bot_hits bh
	LEFT JOIN ranked_path_bots rpb ON rpb.path = bh.path AND rpb.rn = 1
	GROUP BY bh.path
	ORDER BY hits DESC
	LIMIT 20
`

func queryBIBotCrawlMonitor(ctx context.Context, win biTimeWindow) BIBotCrawlMonitor {
	out := BIBotCrawlMonitor{
		Bots:            []BIBotSummaryRow{},
		TopCrawledPaths: []BIBotCrawledPathRow{},
	}
	if db.Pool == nil {
		return out
	}

	_ = db.Pool.QueryRow(ctx, biBotCrawlUnionCTE+`
		SELECT COALESCE(SUM(hits), 0)::int
		FROM bot_hits
	`, win.Since, win.Until).Scan(&out.TotalBotHits)

	botRows, err := db.Pool.Query(ctx, biBotCrawlUnionCTE+`
		SELECT
			bot_name,
			COALESCE(SUM(hits), 0)::int AS hits,
			COUNT(DISTINCT path)::int AS uniq_paths,
			COALESCE(SUM(hits) FILTER (WHERE path LIKE '/product/%' OR path ~ '^/[a-z]{2}/product/'), 0)::int AS prod_crawled,
			MAX(created_at) AS last_at
		FROM bot_hits
		GROUP BY bot_name
		ORDER BY hits DESC
		LIMIT 20
	`, win.Since, win.Until)
	if err == nil {
		defer botRows.Close()
		for botRows.Next() {
			var b BIBotSummaryRow
			if scanErr := botRows.Scan(&b.BotName, &b.Hits, &b.UniquePaths, &b.ProductPagesCrawled, &b.LastCrawlAt); scanErr == nil {
				out.Bots = append(out.Bots, b)
			}
		}
	}

	pathRows, err := db.Pool.Query(ctx, biBotTopCrawledPathsSQL, win.Since, win.Until)
	if err == nil {
		defer pathRows.Close()
		for pathRows.Next() {
			var p BIBotCrawledPathRow
			if scanErr := pathRows.Scan(&p.Path, &p.Hits, &p.TopBot, &p.UniqueBots, &p.LastCrawlAt); scanErr == nil {
				out.TopCrawledPaths = append(out.TopCrawledPaths, p)
			}
		}
	}
	return out
}
