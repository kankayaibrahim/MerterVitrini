package handlers

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/url"
	"strings"
	"time"

	"mertervitrini/backend/config"
	"mertervitrini/backend/db"
)

const directReferrerLabel = "Doğrudan (Direct)"

// AnalyticsHandler handles visitor tracking and analytics reporting.
type AnalyticsHandler struct {
	cfg *config.Config
}

// NewAnalyticsHandler creates a new AnalyticsHandler.
func NewAnalyticsHandler(cfg *config.Config) *AnalyticsHandler {
	return &AnalyticsHandler{cfg: cfg}
}

// TrackPageViewRequest represents the payload from the client-side tracker.
type TrackPageViewRequest struct {
	VisitorID    string `json:"visitor_id"`
	SessionID    string `json:"session_id"`
	URL          string `json:"url"`
	Path         string `json:"path"`
	Referrer     string `json:"referrer"`
	ScreenWidth  int    `json:"screen_width"`
	ScreenHeight int    `json:"screen_height"`
	Language     string `json:"language"`
}

type pageViewRecord struct {
	visitorID    string
	sessionID    string
	url          string
	path         string
	referrer     string
	referrerHost string
	utmSource    string
	utmMedium    string
	utmCampaign  string
	deviceType   string
	browser      string
	os           string
	language     string
	ipHash       string
	screenWidth  int
	screenHeight int
}

// HeatmapCell represents an hour/day activity count for the 7x24 heatmap.
type HeatmapCell struct {
	DayOfWeek int `json:"day"`      // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
	Hour      int `json:"hour"`     // 0 - 23
	Views     int `json:"views"`    // Total page views
	Visitors  int `json:"visitors"` // Unique visitors
}

// DailyTrendPoint represents daily metric aggregates.
type DailyTrendPoint struct {
	Date      string `json:"date"`
	Visitors  int    `json:"visitors"`
	Pageviews int    `json:"pageviews"`
}

// TopItemCount represents top referrer, page, device, or language item.
type TopItemCount struct {
	Name       string  `json:"name"`
	Views      int     `json:"views"`
	Visitors   int     `json:"visitors"`
	Percentage float64 `json:"percentage"`
}

// RecentActivityEvent represents the latest real-time visitor event.
type RecentActivityEvent struct {
	Path         string    `json:"path"`
	ReferrerHost string    `json:"referrer_host"`
	DeviceType   string    `json:"device_type"`
	Language     string    `json:"language"`
	CreatedAt    time.Time `json:"created_at"`
}

// AnalyticsSummary represents high-level KPIs.
type AnalyticsSummary struct {
	TotalVisitors       int     `json:"total_visitors"`
	TotalPageviews      int     `json:"total_pageviews"`
	AvgPagesPerVisitor  float64 `json:"avg_pages_per_visitor"`
	TodayVisitors       int     `json:"today_visitors"`
	TodayPageviews      int     `json:"today_pageviews"`
	LiveVisitorsLast15m int     `json:"live_visitors_last_15m"`
}

// AnalyticsStatsResponse contains all dashboard data for the requested period.
type AnalyticsStatsResponse struct {
	Period       string                `json:"period"`
	Summary      AnalyticsSummary      `json:"summary"`
	DailyTrend   []DailyTrendPoint     `json:"daily_trend"`
	Heatmap      []HeatmapCell         `json:"heatmap"`
	TopReferrers []TopItemCount        `json:"top_referrers"`
	TopPages     []TopItemCount        `json:"top_pages"`
	Devices      []TopItemCount        `json:"devices"`
	Languages    []TopItemCount        `json:"languages"`
	RecentEvents []RecentActivityEvent `json:"recent_events"`
}

// TrackPageView captures a page view from the storefront non-blockingly.
func (h *AnalyticsHandler) TrackPageView(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", headerContentType)

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	var req TrackPageViewRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid json"}`, http.StatusBadRequest)
		return
	}

	path := strings.TrimSpace(req.Path)
	if path == "" {
		path = "/"
	}

	if strings.HasPrefix(path, "/admin") ||
		strings.HasPrefix(path, "/api") ||
		strings.HasPrefix(path, "/_next") ||
		strings.Contains(path, "favicon.ico") {
		w.Header().Set(headerContentType, mimeApplicationJSON)
		w.Write([]byte(`{"ok":true,"ignored":true}`))
		return
	}

	ip := getClientIP(r)
	ipHash := hashIP(ip)

	visitorID := strings.TrimSpace(req.VisitorID)
	if visitorID == "" {
		visitorID = ipHash
	}

	sessionID := strings.TrimSpace(req.SessionID)
	if sessionID == "" {
		sessionID = visitorID
	}

	ua := r.UserAgent()
	deviceType, browser, os := parseDeviceAndBrowser(ua, req.ScreenWidth)
	refHost := parseReferrerHost(req.Referrer)
	utmSource, utmMedium, utmCampaign := parseUTM(req.URL)

	lang := strings.ToLower(strings.TrimSpace(req.Language))
	if lang == "" || len(lang) > 10 {
		lang = "tr"
	}

	if len(path) > 500 {
		path = path[:500]
	}

	rec := pageViewRecord{
		visitorID:    visitorID,
		sessionID:    sessionID,
		url:          req.URL,
		path:         path,
		referrer:     req.Referrer,
		referrerHost: refHost,
		utmSource:    utmSource,
		utmMedium:    utmMedium,
		utmCampaign:  utmCampaign,
		deviceType:   deviceType,
		browser:      browser,
		os:           os,
		language:     lang,
		ipHash:       ipHash,
		screenWidth:  req.ScreenWidth,
		screenHeight: req.ScreenHeight,
	}

	go insertPageView(rec)

	w.Header().Set(headerContentType, mimeApplicationJSON)
	w.Write([]byte(`{"ok":true}`))
}

func insertPageView(rec pageViewRecord) {
	if db.Pool == nil {
		return
	}
	query := `
		INSERT INTO analytics.page_views (
			visitor_id, session_id, url, path, referrer, referrer_host,
			utm_source, utm_medium, utm_campaign, device_type, browser, os,
			language, screen_width, screen_height, ip_hash
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
	`
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, _ = db.Pool.Exec(ctx, query,
		rec.visitorID, rec.sessionID, rec.url, rec.path, rec.referrer, rec.referrerHost,
		rec.utmSource, rec.utmMedium, rec.utmCampaign, rec.deviceType, rec.browser, rec.os,
		rec.language, rec.screenWidth, rec.screenHeight, rec.ipHash,
	)
}

func resolveSinceTime(period string) (time.Time, string) {
	now := time.Now().UTC()
	switch period {
	case "today":
		return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC), "today"
	case "24h":
		return now.Add(-24 * time.Hour), "24h"
	case "30d":
		return now.Add(-30 * 24 * time.Hour), "30d"
	default:
		return now.Add(-7 * 24 * time.Hour), "7d"
	}
}

// GetAnalyticsStats provides comprehensive analytics data for the admin dashboard.
func (h *AnalyticsHandler) GetAnalyticsStats(w http.ResponseWriter, r *http.Request) {
	since, period := resolveSinceTime(strings.TrimSpace(r.URL.Query().Get("period")))

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	resp := AnalyticsStatsResponse{
		Period:       period,
		DailyTrend:   []DailyTrendPoint{},
		Heatmap:      []HeatmapCell{},
		TopReferrers: []TopItemCount{},
		TopPages:     []TopItemCount{},
		Devices:      []TopItemCount{},
		Languages:    []TopItemCount{},
		RecentEvents: []RecentActivityEvent{},
	}

	h.querySummary(ctx, since, &resp)
	h.queryDailyTrend(ctx, since, &resp)
	h.queryHeatmap(ctx, since, &resp)
	h.queryTopReferrers(ctx, since, &resp)
	h.queryTopPages(ctx, since, &resp)
	h.queryDevices(ctx, since, &resp)
	h.queryLanguages(ctx, since, &resp)
	h.queryRecentEvents(ctx, &resp)

	w.Header().Set(headerContentType, mimeApplicationJSON)
	_ = json.NewEncoder(w).Encode(resp)
}

func (h *AnalyticsHandler) querySummary(ctx context.Context, since time.Time, resp *AnalyticsStatsResponse) {
	sumQuery := `
		SELECT 
			COALESCE(COUNT(DISTINCT visitor_id), 0) AS total_visitors,
			COALESCE(COUNT(*), 0) AS total_pageviews,
			COALESCE(COUNT(DISTINCT CASE WHEN created_at >= CURRENT_DATE THEN visitor_id END), 0) AS today_visitors,
			COALESCE(COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END), 0) AS today_pageviews,
			COALESCE(COUNT(DISTINCT CASE WHEN created_at >= NOW() - INTERVAL '15 minutes' THEN visitor_id END), 0) AS live_visitors
		FROM analytics.page_views
		WHERE created_at >= $1
	`
	_ = db.Pool.QueryRow(ctx, sumQuery, since).Scan(
		&resp.Summary.TotalVisitors,
		&resp.Summary.TotalPageviews,
		&resp.Summary.TodayVisitors,
		&resp.Summary.TodayPageviews,
		&resp.Summary.LiveVisitorsLast15m,
	)

	if resp.Summary.TotalVisitors > 0 {
		resp.Summary.AvgPagesPerVisitor = float64(resp.Summary.TotalPageviews) / float64(resp.Summary.TotalVisitors)
	}
}

func (h *AnalyticsHandler) queryDailyTrend(ctx context.Context, since time.Time, resp *AnalyticsStatsResponse) {
	trendQuery := `
		SELECT 
			TO_CHAR(created_at, 'YYYY-MM-DD') AS day,
			COUNT(DISTINCT visitor_id) AS visitors,
			COUNT(*) AS pageviews
		FROM analytics.page_views
		WHERE created_at >= $1
		GROUP BY day
		ORDER BY day ASC
	`
	tRows, err := db.Pool.Query(ctx, trendQuery, since)
	if err != nil {
		return
	}
	defer tRows.Close()

	for tRows.Next() {
		var pt DailyTrendPoint
		if scanErr := tRows.Scan(&pt.Date, &pt.Visitors, &pt.Pageviews); scanErr == nil {
			resp.DailyTrend = append(resp.DailyTrend, pt)
		}
	}
}

func (h *AnalyticsHandler) queryHeatmap(ctx context.Context, since time.Time, resp *AnalyticsStatsResponse) {
	heatmapQuery := `
		SELECT 
			EXTRACT(DOW FROM created_at)::int AS dow,
			EXTRACT(HOUR FROM created_at)::int AS hour,
			COUNT(*) AS views,
			COUNT(DISTINCT visitor_id) AS visitors
		FROM analytics.page_views
		WHERE created_at >= $1
		GROUP BY dow, hour
		ORDER BY dow ASC, hour ASC
	`
	hRows, err := db.Pool.Query(ctx, heatmapQuery, since)
	if err != nil {
		return
	}
	defer hRows.Close()

	for hRows.Next() {
		var cell HeatmapCell
		if scanErr := hRows.Scan(&cell.DayOfWeek, &cell.Hour, &cell.Views, &cell.Visitors); scanErr == nil {
			resp.Heatmap = append(resp.Heatmap, cell)
		}
	}
}

func (h *AnalyticsHandler) queryTopReferrers(ctx context.Context, since time.Time, resp *AnalyticsStatsResponse) {
	refQuery := `
		SELECT 
			COALESCE(NULLIF(referrer_host, ''), 'Doğrudan (Direct)') AS ref,
			COUNT(*) AS views,
			COUNT(DISTINCT visitor_id) AS visitors
		FROM analytics.page_views
		WHERE created_at >= $1
		GROUP BY ref
		ORDER BY views DESC
		LIMIT 10
	`
	rRows, err := db.Pool.Query(ctx, refQuery, since)
	if err != nil {
		return
	}
	defer rRows.Close()

	for rRows.Next() {
		var item TopItemCount
		if scanErr := rRows.Scan(&item.Name, &item.Views, &item.Visitors); scanErr == nil {
			if resp.Summary.TotalPageviews > 0 {
				item.Percentage = (float64(item.Views) / float64(resp.Summary.TotalPageviews)) * 100
			}
			resp.TopReferrers = append(resp.TopReferrers, item)
		}
	}
}

func (h *AnalyticsHandler) queryTopPages(ctx context.Context, since time.Time, resp *AnalyticsStatsResponse) {
	pagesQuery := `
		SELECT 
			path,
			COUNT(*) AS views,
			COUNT(DISTINCT visitor_id) AS visitors
		FROM analytics.page_views
		WHERE created_at >= $1
		GROUP BY path
		ORDER BY views DESC
		LIMIT 15
	`
	pRows, err := db.Pool.Query(ctx, pagesQuery, since)
	if err != nil {
		return
	}
	defer pRows.Close()

	for pRows.Next() {
		var item TopItemCount
		if scanErr := pRows.Scan(&item.Name, &item.Views, &item.Visitors); scanErr == nil {
			if resp.Summary.TotalPageviews > 0 {
				item.Percentage = (float64(item.Views) / float64(resp.Summary.TotalPageviews)) * 100
			}
			resp.TopPages = append(resp.TopPages, item)
		}
	}
}

func (h *AnalyticsHandler) queryDevices(ctx context.Context, since time.Time, resp *AnalyticsStatsResponse) {
	devQuery := `
		SELECT 
			COALESCE(NULLIF(device_type, ''), 'desktop') AS dev,
			COUNT(*) AS views,
			COUNT(DISTINCT visitor_id) AS visitors
		FROM analytics.page_views
		WHERE created_at >= $1
		GROUP BY dev
		ORDER BY views DESC
	`
	dRows, err := db.Pool.Query(ctx, devQuery, since)
	if err != nil {
		return
	}
	defer dRows.Close()

	for dRows.Next() {
		var item TopItemCount
		if scanErr := dRows.Scan(&item.Name, &item.Views, &item.Visitors); scanErr == nil {
			if resp.Summary.TotalPageviews > 0 {
				item.Percentage = (float64(item.Views) / float64(resp.Summary.TotalPageviews)) * 100
			}
			resp.Devices = append(resp.Devices, item)
		}
	}
}

func (h *AnalyticsHandler) queryLanguages(ctx context.Context, since time.Time, resp *AnalyticsStatsResponse) {
	langQuery := `
		SELECT 
			UPPER(COALESCE(NULLIF(language, ''), 'TR')) AS lang,
			COUNT(*) AS views,
			COUNT(DISTINCT visitor_id) AS visitors
		FROM analytics.page_views
		WHERE created_at >= $1
		GROUP BY lang
		ORDER BY views DESC
	`
	lRows, err := db.Pool.Query(ctx, langQuery, since)
	if err != nil {
		return
	}
	defer lRows.Close()

	for lRows.Next() {
		var item TopItemCount
		if scanErr := lRows.Scan(&item.Name, &item.Views, &item.Visitors); scanErr == nil {
			if resp.Summary.TotalPageviews > 0 {
				item.Percentage = (float64(item.Views) / float64(resp.Summary.TotalPageviews)) * 100
			}
			resp.Languages = append(resp.Languages, item)
		}
	}
}

func (h *AnalyticsHandler) queryRecentEvents(ctx context.Context, resp *AnalyticsStatsResponse) {
	eventsQuery := `
		SELECT 
			path,
			COALESCE(NULLIF(referrer_host, ''), 'Doğrudan') AS ref_host,
			COALESCE(NULLIF(device_type, ''), 'desktop') AS dev,
			COALESCE(NULLIF(language, ''), 'tr') AS lang,
			created_at
		FROM analytics.page_views
		ORDER BY created_at DESC
		LIMIT 20
	`
	evRows, err := db.Pool.Query(ctx, eventsQuery)
	if err != nil {
		return
	}
	defer evRows.Close()

	for evRows.Next() {
		var ev RecentActivityEvent
		if scanErr := evRows.Scan(&ev.Path, &ev.ReferrerHost, &ev.DeviceType, &ev.Language, &ev.CreatedAt); scanErr == nil {
			resp.RecentEvents = append(resp.RecentEvents, ev)
		}
	}
}

func hashIP(ip string) string {
	h := sha256.Sum256([]byte("mv_salt_2026_" + ip))
	return hex.EncodeToString(h[:16]) // 32 chars
}

func parseDeviceAndBrowser(ua string, screenWidth int) (deviceType, browser, os string) {
	uaLower := strings.ToLower(ua)

	// Device
	if screenWidth > 0 && screenWidth < 768 {
		deviceType = "mobile"
	} else if screenWidth >= 768 && screenWidth < 1024 {
		deviceType = "tablet"
	} else if strings.Contains(uaLower, "mobile") || strings.Contains(uaLower, "iphone") || strings.Contains(uaLower, "android") {
		deviceType = "mobile"
	} else if strings.Contains(uaLower, "ipad") || strings.Contains(uaLower, "tablet") {
		deviceType = "tablet"
	} else {
		deviceType = "desktop"
	}

	// Browser
	switch {
	case strings.Contains(uaLower, "edg/"):
		browser = "Edge"
	case strings.Contains(uaLower, "chrome/"):
		browser = "Chrome"
	case strings.Contains(uaLower, "safari/") && !strings.Contains(uaLower, "chrome"):
		browser = "Safari"
	case strings.Contains(uaLower, "firefox/"):
		browser = "Firefox"
	case strings.Contains(uaLower, "opera") || strings.Contains(uaLower, "opr/"):
		browser = "Opera"
	default:
		browser = "Diğer"
	}

	// OS
	switch {
	case strings.Contains(uaLower, "windows"):
		os = "Windows"
	case strings.Contains(uaLower, "iphone") || strings.Contains(uaLower, "ipad") || strings.Contains(uaLower, "ios"):
		os = "iOS"
	case strings.Contains(uaLower, "android"):
		os = "Android"
	case strings.Contains(uaLower, "macintosh") || strings.Contains(uaLower, "mac os"):
		os = "macOS"
	case strings.Contains(uaLower, "linux"):
		os = "Linux"
	default:
		os = "Diğer"
	}

	return deviceType, browser, os
}

func parseReferrerHost(rawRef string) string {
	rawRef = strings.TrimSpace(rawRef)
	if rawRef == "" {
		return directReferrerLabel
	}
	u, err := url.Parse(rawRef)
	if err != nil || u.Host == "" {
		return directReferrerLabel
	}
	host := strings.ToLower(u.Host)
	host = strings.TrimPrefix(host, "www.")

	if strings.Contains(host, "mertervitrini.com.tr") || strings.Contains(host, "localhost") {
		return directReferrerLabel
	}

	switch {
	case strings.Contains(host, "google."):
		return "Google Arama"
	case strings.Contains(host, "yandex."):
		return "Yandex Arama"
	case strings.Contains(host, "instagram."):
		return "Instagram"
	case strings.Contains(host, "facebook."):
		return "Facebook"
	case strings.Contains(host, "whatsapp."):
		return "WhatsApp"
	case strings.Contains(host, "t.me") || strings.Contains(host, "telegram."):
		return "Telegram"
	case strings.Contains(host, "tiktok."):
		return "TikTok"
	case strings.Contains(host, "bing."):
		return "Bing Arama"
	}

	return host
}

func parseUTM(rawURL string) (source, medium, campaign string) {
	if rawURL == "" {
		return "", "", ""
	}
	u, err := url.Parse(rawURL)
	if err != nil {
		return "", "", ""
	}
	q := u.Query()
	return q.Get("utm_source"), q.Get("utm_medium"), q.Get("utm_campaign")
}
