package handlers

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"log"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"mertervitrini/backend/config"
	"mertervitrini/backend/db"
	"mertervitrini/backend/pkg/safe"
)

const (
	directReferrerLabel     = "Doğrudan (Direct)"
	istanbulTZName          = "Europe/Istanbul"
	headerSSRPrefetch       = "X-SSR-Prefetch"
	headerVisitorID         = "X-Visitor-Id"
	defaultCurrencyTRY      = "TRY"
	defaultDeviceDesktop    = "desktop"
	defaultLangTR           = "tr"
	otherLabelTR            = "Diğer"
	botNameGooglebot        = "Googlebot"
	botNameYandexBot        = "YandexBot"
	botNameFacebookExt      = "facebookexternalhit"
	botNameHeadlessChrome   = "HeadlessChrome"
	jsonOK                  = `{"ok":true}`
	jsonIgnoredOK           = `{"ok":true,"ignored":true}`
	errJSONInvalidJSON      = `{"error":"invalid json"}`
	errJSONMethodNotAllowed = `{"error":"Method not allowed"}`
)

var (
	analyticsSchemaOnce sync.Once
	istanbulLocOnce     sync.Once
	cachedIstanbulLoc   *time.Location
)

type botSignature struct {
	token string
	name  string
}

var knownBotSignatures = []botSignature{
	{token: "googlebot", name: botNameGooglebot},
	{token: "adsbot-google", name: botNameGooglebot},
	{token: "apis-google", name: botNameGooglebot},
	{token: "yandexbot", name: botNameYandexBot},
	{token: "yandeximages", name: botNameYandexBot},
	{token: "yandexmobilebot", name: botNameYandexBot},
	{token: "bingbot", name: "Bingbot"},
	{token: "duckduckbot", name: "DuckDuckBot"},
	{token: "baiduspider", name: "Baiduspider"},
	{token: "ahrefsbot", name: "AhrefsBot"},
	{token: "semrushbot", name: "SemrushBot"},
	{token: "mj12bot", name: "MJ12bot"},
	{token: "bytespider", name: "Bytespider"},
	{token: "gptbot", name: "GPTBot"},
	{token: "chatgpt-user", name: "ChatGPT-User"},
	{token: "claudebot", name: "ClaudeBot"},
	{token: "perplexitybot", name: "PerplexityBot"},
	{token: "applebot", name: "Applebot"},
	{token: botNameFacebookExt, name: botNameFacebookExt},
	{token: "meta-externalagent", name: botNameFacebookExt},
	{token: "telegrambot", name: "TelegramBot"},
	{token: "whatsapp", name: "WhatsApp"},
	{token: "headlesschrome", name: botNameHeadlessChrome},
	{token: "lighthouse", name: botNameHeadlessChrome},
	{token: "python-requests", name: "python-requests"},
	{token: "curl/", name: "curl"},
	{token: "go-http-client", name: "Go-http-client"},
}

func istanbulLocation() *time.Location {
	istanbulLocOnce.Do(func() {
		loc, err := time.LoadLocation(istanbulTZName)
		if err != nil {
			loc = time.FixedZone("TRT", 3*3600)
		}
		cachedIstanbulLoc = loc
	})
	return cachedIstanbulLoc
}

func ensureAnalyticsSchema(ctx context.Context) {
	if db.Pool == nil {
		return
	}
	analyticsSchemaOnce.Do(func() {
		ddl := `
			CREATE SCHEMA IF NOT EXISTS analytics;

			CREATE TABLE IF NOT EXISTS analytics.page_views (
				id BIGSERIAL PRIMARY KEY,
				visitor_id VARCHAR(64) NOT NULL,
				session_id VARCHAR(64),
				url TEXT NOT NULL,
				path VARCHAR(500) NOT NULL,
				referrer TEXT,
				referrer_host VARCHAR(255),
				utm_source VARCHAR(100),
				utm_medium VARCHAR(100),
				utm_campaign VARCHAR(100),
				device_type VARCHAR(20) DEFAULT 'desktop',
				browser VARCHAR(50),
				os VARCHAR(50),
				language VARCHAR(10) DEFAULT 'tr',
				screen_width INT DEFAULT 0,
				screen_height INT DEFAULT 0,
				ip_hash VARCHAR(64),
				created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
			);

			ALTER TABLE analytics.page_views ADD COLUMN IF NOT EXISTS user_id VARCHAR(128);
			ALTER TABLE analytics.page_views ADD COLUMN IF NOT EXISTS page_title VARCHAR(300);
			ALTER TABLE analytics.page_views ADD COLUMN IF NOT EXISTS duration_sec INT NOT NULL DEFAULT 0;
			ALTER TABLE analytics.page_views ADD COLUMN IF NOT EXISTS country_code VARCHAR(10) NOT NULL DEFAULT '';
			ALTER TABLE analytics.page_views ADD COLUMN IF NOT EXISTS city VARCHAR(100) NOT NULL DEFAULT '';
			ALTER TABLE analytics.page_views ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'TRY';
			ALTER TABLE analytics.page_views ADD COLUMN IF NOT EXISTS utm_term VARCHAR(150) NOT NULL DEFAULT '';
			ALTER TABLE analytics.page_views ADD COLUMN IF NOT EXISTS utm_content VARCHAR(150) NOT NULL DEFAULT '';
			ALTER TABLE analytics.page_views ADD COLUMN IF NOT EXISTS click_id VARCHAR(150) NOT NULL DEFAULT '';
			ALTER TABLE analytics.page_views ADD COLUMN IF NOT EXISTS scroll_depth_pct SMALLINT NOT NULL DEFAULT 0;
			ALTER TABLE analytics.page_views ADD COLUMN IF NOT EXISTS is_bot BOOLEAN NOT NULL DEFAULT FALSE;
			ALTER TABLE analytics.page_views ADD COLUMN IF NOT EXISTS bot_name VARCHAR(60) NOT NULL DEFAULT '';
			ALTER TABLE analytics.page_views ADD COLUMN IF NOT EXISTS is_new_visitor BOOLEAN NOT NULL DEFAULT FALSE;
			ALTER TABLE analytics.page_views ADD COLUMN IF NOT EXISTS lcp_ms INT NOT NULL DEFAULT 0;
			ALTER TABLE analytics.page_views ADD COLUMN IF NOT EXISTS cls_score NUMERIC(8,4) NOT NULL DEFAULT 0;
			ALTER TABLE analytics.page_views ADD COLUMN IF NOT EXISTS inp_ms INT NOT NULL DEFAULT 0;
			ALTER TABLE analytics.page_views ADD COLUMN IF NOT EXISTS ttfb_ms INT NOT NULL DEFAULT 0;

			CREATE INDEX IF NOT EXISTS idx_analytics_pv_bot_created
				ON analytics.page_views (is_bot, created_at DESC);
			CREATE INDEX IF NOT EXISTS idx_analytics_pv_country_created
				ON analytics.page_views (country_code, created_at DESC);
			CREATE INDEX IF NOT EXISTS idx_analytics_pv_utm_src_camp
				ON analytics.page_views (utm_source, utm_campaign);
			CREATE INDEX IF NOT EXISTS idx_analytics_pv_session_created
				ON analytics.page_views (session_id, created_at ASC);

			CREATE TABLE IF NOT EXISTS analytics.search_logs (
				id BIGSERIAL PRIMARY KEY,
				visitor_id VARCHAR(64) NOT NULL DEFAULT '',
				session_id VARCHAR(64) NOT NULL DEFAULT '',
				user_id VARCHAR(128),
				query_text VARCHAR(250) NOT NULL,
				normalized_query VARCHAR(250) NOT NULL,
				language_code VARCHAR(10) NOT NULL DEFAULT 'tr',
				country_code VARCHAR(10) NOT NULL DEFAULT '',
				category_slug VARCHAR(160) NOT NULL DEFAULT '',
				results_count INT NOT NULL DEFAULT 0,
				has_filters BOOLEAN NOT NULL DEFAULT FALSE,
				clicked_product_id VARCHAR(64),
				created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
			);

			CREATE INDEX IF NOT EXISTS idx_search_logs_created_at
				ON analytics.search_logs (created_at DESC);
			CREATE INDEX IF NOT EXISTS idx_search_logs_norm_query
				ON analytics.search_logs (normalized_query);
			CREATE INDEX IF NOT EXISTS idx_search_logs_results_created
				ON analytics.search_logs (results_count, created_at DESC);
			ALTER TABLE analytics.search_logs
				ADD COLUMN IF NOT EXISTS is_zero_result BOOLEAN NOT NULL DEFAULT FALSE;

			CREATE TABLE IF NOT EXISTS analytics.bot_crawl_logs (
				id BIGSERIAL PRIMARY KEY,
				bot_name VARCHAR(60) NOT NULL,
				path VARCHAR(500) NOT NULL,
				user_agent TEXT NOT NULL DEFAULT '',
				ip_hash VARCHAR(64) NOT NULL DEFAULT '',
				country_code VARCHAR(10) NOT NULL DEFAULT '',
				status_code SMALLINT NOT NULL DEFAULT 200,
				created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
			);
			CREATE INDEX IF NOT EXISTS idx_bot_crawl_logs_created_at
				ON analytics.bot_crawl_logs (created_at DESC);
			CREATE INDEX IF NOT EXISTS idx_bot_crawl_logs_bot_created
				ON analytics.bot_crawl_logs (bot_name, created_at DESC);

			CREATE TABLE IF NOT EXISTS analytics.bot_crawl_hourly (
				bucket_hour TIMESTAMPTZ NOT NULL,
				bot_name VARCHAR(60) NOT NULL,
				bot_category VARCHAR(32) NOT NULL,
				path VARCHAR(500) NOT NULL,
				status_class VARCHAR(8) NOT NULL DEFAULT '2xx',
				hits BIGINT NOT NULL DEFAULT 0,
				last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY (bucket_hour, bot_name, path, status_class)
			);
			CREATE INDEX IF NOT EXISTS idx_bot_crawl_hourly_bucket
				ON analytics.bot_crawl_hourly (bucket_hour DESC);
			CREATE INDEX IF NOT EXISTS idx_bot_crawl_hourly_cat_bucket
				ON analytics.bot_crawl_hourly (bot_category, bucket_hour DESC);

			CREATE TABLE IF NOT EXISTS analytics.log_ingest_cursors (
				source_key VARCHAR(120) PRIMARY KEY,
				file_inode BIGINT NOT NULL DEFAULT 0,
				byte_offset BIGINT NOT NULL DEFAULT 0,
				updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
			);

			ALTER TABLE analytics.page_views
				ADD COLUMN IF NOT EXISTS referrer_keyword VARCHAR(200) NOT NULL DEFAULT '';
			CREATE INDEX IF NOT EXISTS idx_analytics_pv_keywords_created
				ON analytics.page_views (created_at DESC)
				WHERE COALESCE(utm_term, '') <> '' OR COALESCE(referrer_keyword, '') <> '';

			ALTER TABLE catalog.orders
				ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'TRY';
		`
		if _, err := db.Pool.Exec(ctx, ddl); err != nil {
			log.Printf("[ANALYTICS SCHEMA WARNING] Failed to ensure BI schema: %v", err)
		}
	})
	ensureMemberActivitySchema(ctx)
}

func isSSRPrefetchRequest(r *http.Request) bool {
	if r == nil {
		return false
	}
	return strings.TrimSpace(r.Header.Get(headerSSRPrefetch)) == "1"
}

func classifyVisitorBot(r *http.Request, ua string) (bool, string) {
	if r != nil {
		if explicitBot := strings.TrimSpace(r.Header.Get("X-Bot-Name")); explicitBot != "" {
			return true, truncateStr(explicitBot, 60)
		}
	}
	trimmedUA := strings.TrimSpace(ua)
	if trimmedUA == "" {
		return true, "EmptyUA"
	}
	if ok, botName, _ := ClassifyBotUserAgent(trimmedUA); ok {
		return true, botName
	}
	uaLower := strings.ToLower(trimmedUA)
	for _, sig := range knownBotSignatures {
		if strings.Contains(uaLower, sig.token) {
			return true, sig.name
		}
	}
	if strings.Contains(uaLower, "bot/") || strings.Contains(uaLower, "crawler") || strings.Contains(uaLower, "spider") {
		return true, "OtherBot"
	}
	return false, ""
}

func setAnalyticsCORSHeaders(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Visitor-Id, X-SSR-Prefetch, X-Bot-Name")
}

// AnalyticsHandler handles visitor tracking and analytics reporting.
type AnalyticsHandler struct {
	cfg *config.Config
}

// NewAnalyticsHandler creates a new AnalyticsHandler.
func NewAnalyticsHandler(cfg *config.Config) *AnalyticsHandler {
	safe.Go("Ensure Analytics & BI Schema", func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		ensureAnalyticsSchema(ctx)
	})
	return &AnalyticsHandler{cfg: cfg}
}

// TrackPageViewRequest represents the payload from the client-side tracker.
type TrackPageViewRequest struct {
	VisitorID      string `json:"visitor_id"`
	SessionID      string `json:"session_id"`
	AuthToken      string `json:"auth_token,omitempty"`
	PageTitle      string `json:"page_title,omitempty"`
	URL            string `json:"url"`
	Path           string `json:"path"`
	Referrer       string `json:"referrer"`
	ScreenWidth    int    `json:"screen_width"`
	ScreenHeight   int    `json:"screen_height"`
	ViewportWidth  int    `json:"viewport_width,omitempty"`
	ViewportHeight int    `json:"viewport_height,omitempty"`
	Language       string `json:"language"`
	Currency       string `json:"currency,omitempty"`
	UtmSource      string `json:"utm_source,omitempty"`
	UtmMedium      string `json:"utm_medium,omitempty"`
	UtmCampaign    string `json:"utm_campaign,omitempty"`
	UtmTerm        string `json:"utm_term,omitempty"`
	UtmContent     string `json:"utm_content,omitempty"`
	ClickID        string `json:"click_id,omitempty"`
	City           string `json:"city,omitempty"`
	TTFBMs         int    `json:"ttfb_ms,omitempty"`
	BotName        string `json:"bot_name,omitempty"`
}

// TrackRequest aliases TrackPageViewRequest for backward/forward compatibility.
type TrackRequest = TrackPageViewRequest

type attributionParams struct {
	source   string
	medium   string
	campaign string
	term     string
	content  string
	clickID  string
}

type pageViewRecord struct {
	userID          string
	visitorID       string
	sessionID       string
	pageTitle       string
	url             string
	path            string
	referrer        string
	referrerHost    string
	referrerKeyword string
	utmSource       string
	utmMedium    string
	utmCampaign  string
	utmTerm      string
	utmContent   string
	clickID      string
	deviceType   string
	browser      string
	os           string
	language     string
	countryCode  string
	city         string
	currency     string
	ipAddress    string
	ipHash       string
	screenWidth  int
	screenHeight int
	ttfbMs       int
	isBot        bool
	botName      string
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
	CountryCode  string    `json:"country_code"`
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

func shouldIgnoreTrackedPath(path string) bool {
	return strings.HasPrefix(path, "/admin") ||
		strings.HasPrefix(path, "/supplier") ||
		strings.HasPrefix(path, "/api") ||
		strings.HasPrefix(path, "/_next") ||
		strings.Contains(path, "favicon.ico")
}

func resolveVisitorCity(r *http.Request, explicitCity string) string {
	city := strings.TrimSpace(explicitCity)
	if city == "" && r != nil {
		for _, hdr := range []string{"CF-IPCity", "X-Geo-City", "X-City"} {
			if raw := strings.TrimSpace(r.Header.Get(hdr)); raw != "" {
				if decoded, err := url.QueryUnescape(raw); err == nil && decoded != "" {
					city = decoded
				} else {
					city = raw
				}
				break
			}
		}
	}
	return truncateStr(city, 100)
}

func normalizeCurrencyCode(raw string) string {
	code := strings.ToUpper(strings.TrimSpace(raw))
	switch code {
	case "TRY", "USD", "EUR", "GBP", "RUB", "AED", "SAR", "CHF":
		return code
	case "TL":
		return defaultCurrencyTRY
	default:
		return defaultCurrencyTRY
	}
}

func resolveScreenDims(req *TrackPageViewRequest) (int, int) {
	w := req.ScreenWidth
	h := req.ScreenHeight
	if w <= 0 && req.ViewportWidth > 0 {
		w = req.ViewportWidth
	}
	if h <= 0 && req.ViewportHeight > 0 {
		h = req.ViewportHeight
	}
	if w < 0 || w > 16000 {
		w = 0
	}
	if h < 0 || h > 16000 {
		h = 0
	}
	return w, h
}

func buildPageViewRecord(r *http.Request, req *TrackPageViewRequest, path string) pageViewRecord {
	ip := getClientIP(r)
	ipHash := hashIP(ip)
	userID := resolveAuthenticatedMemberID(r, req.AuthToken)
	visitorID := firstNonEmptyStr(req.VisitorID, r.Header.Get(headerVisitorID), ipHash)
	sessionID := firstNonEmptyStr(req.SessionID, visitorID)

	ua := r.UserAgent()
	isBot, botName := classifyVisitorBot(r, ua)
	if !isBot && strings.TrimSpace(req.BotName) != "" {
		isBot = true
		botName = truncateStr(req.BotName, 60)
	}

	screenW, screenH := resolveScreenDims(req)
	deviceType, browser, osName := parseDeviceAndBrowser(ua, screenW)
	attr := parseAttributionParams(req.URL, req)
	countryCode, resolvedLang := resolveVisitorCountryAndLang(r, "", req.Language)

	lang := strings.ToLower(strings.TrimSpace(req.Language))
	if lang == "" || len(lang) > 10 {
		lang = resolvedLang
	}

	ttfb := sanitizeVitalMs(req.TTFBMs, maxValidTTFBMs)

	return pageViewRecord{
		userID:          userID,
		visitorID:       truncateStr(visitorID, 64),
		sessionID:       truncateStr(sessionID, 64),
		pageTitle:       truncateStr(req.PageTitle, 300),
		url:             req.URL,
		path:            truncateStr(path, 500),
		referrer:        req.Referrer,
		referrerHost:    parseReferrerHost(req.Referrer),
		referrerKeyword: extractReferrerSearchKeyword(req.Referrer),
		utmSource:       truncateStr(attr.source, 100),
		utmMedium:    truncateStr(attr.medium, 100),
		utmCampaign:  truncateStr(attr.campaign, 100),
		utmTerm:      truncateStr(attr.term, 150),
		utmContent:   truncateStr(attr.content, 150),
		clickID:      truncateStr(attr.clickID, 150),
		deviceType:   deviceType,
		browser:      browser,
		os:           osName,
		language:     lang,
		countryCode:  truncateStr(countryCode, 10),
		city:         resolveVisitorCity(r, req.City),
		currency:     normalizeCurrencyCode(req.Currency),
		ipAddress:    ip,
		ipHash:       ipHash,
		screenWidth:  screenW,
		screenHeight: screenH,
		ttfbMs:       ttfb,
		isBot:        isBot,
		botName:      truncateStr(botName, 60),
	}
}

// TrackPageView captures a page view from the storefront non-blockingly.
func (h *AnalyticsHandler) TrackPageView(w http.ResponseWriter, r *http.Request) {
	setAnalyticsCORSHeaders(w)

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	if isSSRPrefetchRequest(r) {
		w.Header().Set(headerContentType, mimeApplicationJSON)
		_, _ = w.Write([]byte(jsonIgnoredOK))
		return
	}

	var req TrackPageViewRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, errJSONInvalidJSON, http.StatusBadRequest)
		return
	}

	if isImpersonatedAnalyticsRequest(r, req.AuthToken) {
		writeAnalyticsIgnoredJSON(w)
		return
	}

	path := firstNonEmptyStr(req.Path, "/")
	if shouldIgnoreTrackedPath(path) {
		w.Header().Set(headerContentType, mimeApplicationJSON)
		_, _ = w.Write([]byte(jsonIgnoredOK))
		return
	}

	rec := buildPageViewRecord(r, &req, path)
	safe.Go("Insert Analytics PageView", func() {
		insertPageView(rec)
	})

	w.Header().Set(headerContentType, mimeApplicationJSON)
	_, _ = w.Write([]byte(jsonOK))
}

func checkIsNewHumanVisitor(ctx context.Context, visitorID string) bool {
	if visitorID == "" {
		return false
	}
	var alreadySeen bool
	err := db.Pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM analytics.page_views
			WHERE visitor_id = $1 AND COALESCE(is_bot, false) = false
			LIMIT 1
		)
	`, visitorID).Scan(&alreadySeen)
	if err != nil {
		return false
	}
	return !alreadySeen
}

func resolveHumanPageViewIdentity(ctx context.Context, rec pageViewRecord) (string, bool) {
	isNew := checkIsNewHumanVisitor(ctx, rec.visitorID)
	if rec.visitorID == "" {
		return rec.userID, isNew
	}
	if rec.userID != "" {
		StitchVisitorToMember(ctx, rec.userID, rec.visitorID)
		return rec.userID, isNew
	}
	return lookupLinkedUserByVisitor(ctx, rec.visitorID), isNew
}

func buildPageViewActivityMeta(rec pageViewRecord) map[string]any {
	meta := map[string]any{}
	if rec.referrerHost != "" {
		meta["referrer_host"] = rec.referrerHost
	}
	if rec.utmSource != "" {
		meta["utm_source"] = rec.utmSource
	}
	if rec.currency != "" {
		meta["currency"] = rec.currency
	}
	return meta
}

func insertPageView(rec pageViewRecord) {
	if db.Pool == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	ensureAnalyticsSchema(ctx)

	effectiveUserID := rec.userID
	isNewVisitor := false
	if !rec.isBot {
		effectiveUserID, isNewVisitor = resolveHumanPageViewIdentity(ctx, rec)
	}

	query := `
		INSERT INTO analytics.page_views (
			user_id, visitor_id, session_id, page_title, url, path, referrer, referrer_host,
			utm_source, utm_medium, utm_campaign, utm_term, utm_content, click_id,
			device_type, browser, os, language, country_code, city, currency,
			screen_width, screen_height, ip_hash, is_bot, bot_name, is_new_visitor, ttfb_ms,
			referrer_keyword
		) VALUES (
			NULLIF($1, ''), $2, $3, NULLIF($4, ''), $5, $6, $7, $8,
			$9, $10, $11, $12, $13, $14,
			$15, $16, $17, $18, $19, $20, $21,
			$22, $23, $24, $25, $26, $27, $28,
			$29
		)
	`
	_, _ = db.Pool.Exec(ctx, query,
		effectiveUserID, rec.visitorID, rec.sessionID, rec.pageTitle, rec.url, rec.path, rec.referrer, rec.referrerHost,
		rec.utmSource, rec.utmMedium, rec.utmCampaign, rec.utmTerm, rec.utmContent, rec.clickID,
		rec.deviceType, rec.browser, rec.os, rec.language, rec.countryCode, rec.city, rec.currency,
		rec.screenWidth, rec.screenHeight, rec.ipHash, rec.isBot, rec.botName, isNewVisitor, rec.ttfbMs,
		rec.referrerKeyword,
	)

	if rec.isBot {
		if rec.botName != "" && rec.botName != "EmptyUA" {
			EnqueueBotCrawlLog(rec.botName, rec.path, "", rec.ipHash, rec.countryCode, http.StatusOK)
		}
		return
	}

	resolved := resolveStorePathActivity(ctx, rec.path, rec.url, rec.pageTitle, rec.referrerHost)
	if resolved.EventType == "search_query" && strings.TrimSpace(resolved.EntityID) != "" {
		persistSearchLogEntry(searchLogEntry{
			VisitorID:    rec.visitorID,
			SessionID:    rec.sessionID,
			UserID:       effectiveUserID,
			QueryText:    resolved.EntityID,
			LanguageCode: rec.language,
			CountryCode:  rec.countryCode,
			ResultsCount: countStoreSearchMatches(ctx, resolved.EntityID),
		})
	}
	persistMemberActivity(ctx, MemberActivityInput{
		UserID:        effectiveUserID,
		VisitorID:     rec.visitorID,
		SessionID:     rec.sessionID,
		EventType:     resolved.EventType,
		EventCategory: resolved.EventCategory,
		Title:         resolved.Title,
		Subtitle:      resolved.Subtitle,
		URLPath:       rec.path,
		EntityType:    resolved.EntityType,
		EntityID:      resolved.EntityID,
		ImageURL:      resolved.ImageURL,
		Metadata:      buildPageViewActivityMeta(rec),
		DeviceType:    rec.deviceType,
		Browser:       rec.browser,
		OS:            rec.os,
		CountryCode:   rec.countryCode,
		IPAddress:     rec.ipAddress,
	})
}

func resolveSinceTime(period string) (time.Time, string) {
	loc := istanbulLocation()
	now := time.Now().In(loc)
	switch period {
	case "today":
		return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc), "today"
	case "24h":
		return now.Add(-24 * time.Hour), "24h"
	case "30d":
		return now.Add(-30 * 24 * time.Hour), "30d"
	case "90d":
		return now.Add(-90 * 24 * time.Hour), "90d"
	default:
		return now.Add(-7 * 24 * time.Hour), "7d"
	}
}

// GetStats aliases GetAnalyticsStats.
func (h *AnalyticsHandler) GetStats(w http.ResponseWriter, r *http.Request) {
	h.GetAnalyticsStats(w, r)
}

// GetAnalyticsStats provides comprehensive analytics data for the admin dashboard.
func (h *AnalyticsHandler) GetAnalyticsStats(w http.ResponseWriter, r *http.Request) {
	since, period := resolveSinceTime(strings.TrimSpace(r.URL.Query().Get("period")))

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	ensureAnalyticsSchema(ctx)

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
			COALESCE(COUNT(DISTINCT visitor_id) FILTER (WHERE created_at >= $1), 0) AS total_visitors,
			COALESCE(COUNT(*) FILTER (WHERE created_at >= $1), 0) AS total_pageviews,
			COALESCE(COUNT(DISTINCT CASE WHEN (created_at AT TIME ZONE 'Europe/Istanbul')::date = (NOW() AT TIME ZONE 'Europe/Istanbul')::date THEN visitor_id END), 0) AS today_visitors,
			COALESCE(COUNT(CASE WHEN (created_at AT TIME ZONE 'Europe/Istanbul')::date = (NOW() AT TIME ZONE 'Europe/Istanbul')::date THEN 1 END), 0) AS today_pageviews,
			COALESCE(COUNT(DISTINCT CASE WHEN created_at >= NOW() - INTERVAL '15 minutes' THEN visitor_id END), 0) AS live_visitors
		FROM analytics.page_views
		WHERE COALESCE(is_bot, false) = false
		  AND created_at >= LEAST($1, (DATE_TRUNC('day', NOW() AT TIME ZONE 'Europe/Istanbul') AT TIME ZONE 'Europe/Istanbul'))
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
			TO_CHAR(created_at AT TIME ZONE 'Europe/Istanbul', 'YYYY-MM-DD') AS day,
			COUNT(DISTINCT visitor_id) AS visitors,
			COUNT(*) AS pageviews
		FROM analytics.page_views
		WHERE created_at >= $1 AND COALESCE(is_bot, false) = false
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
			EXTRACT(DOW FROM (created_at AT TIME ZONE 'Europe/Istanbul'))::int AS dow,
			EXTRACT(HOUR FROM (created_at AT TIME ZONE 'Europe/Istanbul'))::int AS hour,
			COUNT(*) AS views,
			COUNT(DISTINCT visitor_id) AS visitors
		FROM analytics.page_views
		WHERE created_at >= $1 AND COALESCE(is_bot, false) = false
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
		WHERE created_at >= $1 AND COALESCE(is_bot, false) = false
		GROUP BY ref
		ORDER BY views DESC
		LIMIT 10
	`
	resp.TopReferrers = scanTopItemCounts(ctx, refQuery, since, resp.Summary.TotalPageviews)
}

func (h *AnalyticsHandler) queryTopPages(ctx context.Context, since time.Time, resp *AnalyticsStatsResponse) {
	pagesQuery := `
		SELECT 
			path,
			COUNT(*) AS views,
			COUNT(DISTINCT visitor_id) AS visitors
		FROM analytics.page_views
		WHERE created_at >= $1 AND COALESCE(is_bot, false) = false
		GROUP BY path
		ORDER BY views DESC
		LIMIT 15
	`
	resp.TopPages = scanTopItemCounts(ctx, pagesQuery, since, resp.Summary.TotalPageviews)
}

func (h *AnalyticsHandler) queryDevices(ctx context.Context, since time.Time, resp *AnalyticsStatsResponse) {
	devQuery := `
		SELECT 
			COALESCE(NULLIF(device_type, ''), 'desktop') AS dev,
			COUNT(*) AS views,
			COUNT(DISTINCT visitor_id) AS visitors
		FROM analytics.page_views
		WHERE created_at >= $1 AND COALESCE(is_bot, false) = false
		GROUP BY dev
		ORDER BY views DESC
	`
	resp.Devices = scanTopItemCounts(ctx, devQuery, since, resp.Summary.TotalPageviews)
}

func (h *AnalyticsHandler) queryLanguages(ctx context.Context, since time.Time, resp *AnalyticsStatsResponse) {
	langQuery := `
		SELECT 
			UPPER(COALESCE(NULLIF(language, ''), 'TR')) AS lang,
			COUNT(*) AS views,
			COUNT(DISTINCT visitor_id) AS visitors
		FROM analytics.page_views
		WHERE created_at >= $1 AND COALESCE(is_bot, false) = false
		GROUP BY lang
		ORDER BY views DESC
	`
	resp.Languages = scanTopItemCounts(ctx, langQuery, since, resp.Summary.TotalPageviews)
}

func scanTopItemCounts(ctx context.Context, query string, since time.Time, totalPageviews int) []TopItemCount {
	rows, err := db.Pool.Query(ctx, query, since)
	if err != nil {
		return []TopItemCount{}
	}
	defer rows.Close()

	items := []TopItemCount{}
	for rows.Next() {
		var item TopItemCount
		if scanErr := rows.Scan(&item.Name, &item.Views, &item.Visitors); scanErr == nil {
			if totalPageviews > 0 {
				item.Percentage = (float64(item.Views) / float64(totalPageviews)) * 100
			}
			items = append(items, item)
		}
	}
	return items
}

func countStoreSearchMatches(ctx context.Context, rawQuery string) int {
	trimmed := strings.TrimSpace(rawQuery)
	if trimmed == "" || db.Pool == nil {
		return 0
	}
	pattern := "%" + trimmed + "%"
	var cnt int
	_ = db.Pool.QueryRow(ctx, `
		SELECT COALESCE(COUNT(*), 0)
		FROM catalog.mv_products p
		WHERE p.is_active = true
		  AND (
			p.custom_sku ILIKE $1
			OR p.brand_name ILIKE $1
			OR COALESCE(p.title, '') ILIKE $1
			OR COALESCE(p.description, '') ILIKE $1
			OR COALESCE(p.translations_json::text, '') ILIKE $1
		  )
	`, pattern).Scan(&cnt)
	return cnt
}

func (h *AnalyticsHandler) queryRecentEvents(ctx context.Context, resp *AnalyticsStatsResponse) {
	eventsQuery := `
		SELECT 
			path,
			COALESCE(NULLIF(referrer_host, ''), 'Doğrudan') AS ref_host,
			COALESCE(NULLIF(device_type, ''), 'desktop') AS dev,
			COALESCE(NULLIF(language, ''), 'tr') AS lang,
			CASE
				WHEN UPPER(COALESCE(NULLIF(country_code, ''), 'TR')) IN ('EU', 'EN', 'T1', '--') THEN 'TR'
				ELSE UPPER(COALESCE(NULLIF(country_code, ''), 'TR'))
			END AS ccode,
			created_at
		FROM analytics.page_views
		WHERE COALESCE(is_bot, false) = false
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
		if scanErr := evRows.Scan(&ev.Path, &ev.ReferrerHost, &ev.DeviceType, &ev.Language, &ev.CountryCode, &ev.CreatedAt); scanErr == nil {
			resp.RecentEvents = append(resp.RecentEvents, ev)
		}
	}
}

func hashIP(ip string) string {
	h := sha256.Sum256([]byte("mv_salt_2026_" + ip))
	return hex.EncodeToString(h[:16])
}

func parseDeviceType(uaLower string, screenWidth int) string {
	if strings.Contains(uaLower, "mertervitriniapp") {
		if strings.Contains(uaLower, "ipad") || strings.Contains(uaLower, "tablet") {
			return "tablet"
		}
		return "mobile"
	}
	if screenWidth > 0 && screenWidth < 768 {
		return "mobile"
	}
	if screenWidth >= 768 && screenWidth < 1024 {
		return "tablet"
	}
	if strings.Contains(uaLower, "ipad") || strings.Contains(uaLower, "tablet") {
		return "tablet"
	}
	if strings.Contains(uaLower, "mobile") || strings.Contains(uaLower, "iphone") || strings.Contains(uaLower, "android") {
		return "mobile"
	}
	return defaultDeviceDesktop
}

func parseBrowserName(uaLower string) string {
	switch {
	case strings.Contains(uaLower, "mertervitriniapp"):
		return "Mobil Uygulama"
	case strings.Contains(uaLower, "edg/"):
		return "Edge"
	case strings.Contains(uaLower, "chrome/"):
		return "Chrome"
	case strings.Contains(uaLower, "safari/") && !strings.Contains(uaLower, "chrome"):
		return "Safari"
	case strings.Contains(uaLower, "firefox/"):
		return "Firefox"
	case strings.Contains(uaLower, "opera") || strings.Contains(uaLower, "opr/"):
		return "Opera"
	default:
		return otherLabelTR
	}
}

func parseOSName(uaLower string) string {
	switch {
	case strings.Contains(uaLower, "windows"):
		return "Windows"
	case strings.Contains(uaLower, "iphone") || strings.Contains(uaLower, "ipad") || strings.Contains(uaLower, "ios"):
		return "iOS"
	case strings.Contains(uaLower, "android"):
		return "Android"
	case strings.Contains(uaLower, "macintosh") || strings.Contains(uaLower, "mac os"):
		return "macOS"
	case strings.Contains(uaLower, "linux"):
		return "Linux"
	default:
		return otherLabelTR
	}
}

func parseDeviceAndBrowser(ua string, screenWidth int) (deviceType, browser, os string) {
	uaLower := strings.ToLower(ua)
	return parseDeviceType(uaLower, screenWidth), parseBrowserName(uaLower), parseOSName(uaLower)
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
	host := strings.TrimPrefix(strings.ToLower(u.Host), "www.")
	if strings.Contains(host, "mertervitrini.com.tr") || strings.Contains(host, "localhost") {
		return directReferrerLabel
	}
	return mapKnownReferrerHost(host)
}

type referrerHostRule struct {
	substr string
	label  string
}

// Ordered from most specific (e.g. gemini.google.com, copilot.microsoft.com) to generic search/social hosts.
var knownReferrerHostRules = []referrerHostRule{
	// AI Assistants
	{substr: "gemini.google.", label: "Gemini"},
	{substr: "bard.google.", label: "Gemini"},
	{substr: "copilot.microsoft.", label: "Microsoft Copilot"},
	{substr: "chatgpt.com", label: "ChatGPT"},
	{substr: "chat.openai.", label: "ChatGPT"},
	{substr: "openai.com", label: "ChatGPT"},
	{substr: "perplexity.ai", label: "Perplexity"},
	{substr: "claude.ai", label: "Claude"},
	{substr: "grok.com", label: "Grok"},
	{substr: "x.ai", label: "Grok"},
	{substr: "deepseek.com", label: "DeepSeek"},
	{substr: "meta.ai", label: "Meta AI"},
	{substr: "you.com", label: "You.com"},
	{substr: "phind.com", label: "Phind"},
	// Search Engines
	{substr: "google.", label: "Google Arama"},
	{substr: "yandex.", label: "Yandex Arama"},
	{substr: "bing.", label: "Bing Arama"},
	{substr: "duckduckgo.", label: "DuckDuckGo"},
	{substr: "search.brave.", label: "Brave Search"},
	{substr: "yahoo.", label: "Yahoo Arama"},
	{substr: "baidu.", label: "Baidu"},
	{substr: "ecosia.", label: "Ecosia"},
	// Social & Messaging
	{substr: "instagram.", label: "Instagram"},
	{substr: "facebook.", label: "Facebook"},
	{substr: "fb.", label: "Facebook"},
	{substr: "whatsapp.", label: "WhatsApp"},
	{substr: "t.me", label: "Telegram"},
	{substr: "telegram.", label: "Telegram"},
	{substr: "tiktok.", label: "TikTok"},
	{substr: "youtube.", label: "YouTube"},
	{substr: "youtu.be", label: "YouTube"},
	{substr: "linkedin.", label: "LinkedIn"},
	{substr: "lnkd.in", label: "LinkedIn"},
	{substr: "pinterest.", label: "Pinterest"},
	{substr: "twitter.", label: "X (Twitter)"},
	{substr: "x.com", label: "X (Twitter)"},
	{substr: "t.co", label: "X (Twitter)"},
}

func mapKnownReferrerHost(host string) string {
	for _, rule := range knownReferrerHostRules {
		if strings.Contains(host, rule.substr) {
			return rule.label
		}
	}
	return host
}

// extractReferrerSearchKeyword captures search terms when external referrers include query params (q, text, p, etc.).
func extractReferrerSearchKeyword(rawRef string) string {
	trimmed := strings.TrimSpace(rawRef)
	if trimmed == "" {
		return ""
	}
	u, err := url.Parse(trimmed)
	if err != nil || u.Host == "" {
		return ""
	}
	host := strings.ToLower(u.Hostname())
	if strings.Contains(host, "mertervitrini.com.tr") || host == "localhost" || host == "127.0.0.1" {
		return ""
	}
	q := u.Query()
	for _, param := range []string{"q", "text", "p", "query", "wd", "search"} {
		val := strings.TrimSpace(q.Get(param))
		if val == "" || strings.HasPrefix(strings.ToLower(val), "http://") || strings.HasPrefix(strings.ToLower(val), "https://") {
			continue
		}
		return truncateStr(val, 200)
	}
	return ""
}

func parseAttributionParams(rawURL string, req *TrackPageViewRequest) attributionParams {
	var out attributionParams
	if rawURL != "" {
		if u, err := url.Parse(rawURL); err == nil {
			q := u.Query()
			out.source = q.Get("utm_source")
			out.medium = q.Get("utm_medium")
			out.campaign = q.Get("utm_campaign")
			out.term = q.Get("utm_term")
			out.content = q.Get("utm_content")
			out.clickID = firstNonEmptyStr(
				q.Get("gclid"),
				q.Get("fbclid"),
				q.Get("yclid"),
				q.Get("ttclid"),
				q.Get("msclkid"),
			)
		}
	}
	if req != nil {
		out.source = firstNonEmptyStr(req.UtmSource, out.source)
		out.medium = firstNonEmptyStr(req.UtmMedium, out.medium)
		out.campaign = firstNonEmptyStr(req.UtmCampaign, out.campaign)
		out.term = firstNonEmptyStr(req.UtmTerm, out.term)
		out.content = firstNonEmptyStr(req.UtmContent, out.content)
		out.clickID = firstNonEmptyStr(req.ClickID, out.clickID)
	}
	return out
}

