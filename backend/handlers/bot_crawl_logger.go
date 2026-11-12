package handlers

import (
	"context"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"mertervitrini/backend/db"
	"mertervitrini/backend/pkg/safe"
)

const (
	botCrawlQueueCapacity   = 256
	botCrawlThrottleWindow  = 30 * time.Second
	botCrawlMaxThrottleKeys = 4096
)

type botCrawlLogEntry struct {
	botName     string
	path        string
	userAgent   string
	ipHash      string
	countryCode string
	statusCode  int
}

var (
	botCrawlWorkerOnce sync.Once
	botCrawlQueue      chan botCrawlLogEntry
	botThrottleMu      sync.Mutex
	botThrottleSeen    = make(map[string]time.Time)
)

var seoAndAICrawlerSignatures = []botSignature{
	{token: "googlebot", name: botNameGooglebot},
	{token: "google-inspectiontool", name: botNameGooglebot},
	{token: "storebot-google", name: botNameGooglebot},
	{token: "adsbot-google", name: botNameGooglebot},
	{token: "apis-google", name: botNameGooglebot},
	{token: "yandexbot", name: botNameYandexBot},
	{token: "yandeximages", name: botNameYandexBot},
	{token: "yandexmobilebot", name: botNameYandexBot},
	{token: "bingbot", name: "Bingbot"},
	{token: "duckduckbot", name: "DuckDuckBot"},
	{token: "applebot", name: "Applebot"},
	{token: "baiduspider", name: "Baiduspider"},
	{token: "gptbot", name: "GPTBot"},
	{token: "chatgpt-user", name: "ChatGPT-User"},
	{token: "oai-searchbot", name: "GPTBot"},
	{token: "claudebot", name: "ClaudeBot"},
	{token: "claude-web", name: "ClaudeBot"},
	{token: "anthropic-ai", name: "ClaudeBot"},
	{token: "perplexitybot", name: "PerplexityBot"},
	{token: "bytespider", name: "Bytespider"},
	{token: botNameFacebookExt, name: botNameFacebookExt},
	{token: "meta-externalagent", name: botNameFacebookExt},
	{token: "ahrefsbot", name: "AhrefsBot"},
	{token: "semrushbot", name: "SemrushBot"},
	{token: "mj12bot", name: "MJ12bot"},
	{token: "telegrambot", name: "TelegramBot"},
	{token: "whatsapp", name: "WhatsApp"},
	{token: "linkedinbot", name: "LinkedInBot"},
	{token: "twitterbot", name: "Twitterbot"},
}

// DetectSEOOrAIBot inspects User-Agent strings for known search engine and AI crawlers.
func DetectSEOOrAIBot(userAgent string) (bool, string) {
	uaLower := strings.ToLower(strings.TrimSpace(userAgent))
	if uaLower == "" {
		return false, ""
	}
	for _, sig := range seoAndAICrawlerSignatures {
		if strings.Contains(uaLower, sig.token) {
			return true, sig.name
		}
	}
	return false, ""
}

func resolveCrawlerUserAgent(r *http.Request) string {
	if r == nil {
		return ""
	}
	for _, hdr := range []string{"X-Forwarded-User-Agent", "X-Original-User-Agent"} {
		if v := strings.TrimSpace(r.Header.Get(hdr)); v != "" {
			if ok, _ := DetectSEOOrAIBot(v); ok {
				return v
			}
		}
	}
	return strings.TrimSpace(r.UserAgent())
}

func isBotLoggableStorePath(rawPath string) bool {
	if strings.HasPrefix(rawPath, "/api/v1/feeds/") || strings.HasPrefix(rawPath, "/api/v1/store/feeds/") {
		return true
	}
	if !strings.HasPrefix(rawPath, "/api/v1/store/") {
		return false
	}
	excludedPrefixes := []string{
		"/api/v1/store/track",
		"/api/v1/store/member-events",
		"/api/v1/store/brand-events",
		"/api/v1/store/search-events",
		"/api/v1/store/images/",
		"/api/v1/store/cart",
		"/api/v1/store/auth/",
	}
	for _, prefix := range excludedPrefixes {
		if strings.HasPrefix(rawPath, prefix) {
			return false
		}
	}
	return true
}

func normalizeBotCrawledPath(r *http.Request) string {
	rawPath := strings.TrimSpace(r.URL.Path)
	if strings.HasPrefix(rawPath, "/api/v1/store/feeds/") || strings.HasPrefix(rawPath, "/api/v1/feeds/") {
		return truncateStr(rawPath, 500)
	}
	for _, hdr := range []string{"X-Original-URI", "X-Forwarded-Uri"} {
		if orig := extractCleanPathFromHeader(r.Header.Get(hdr)); orig != "" {
			return orig
		}
	}
	if refPath := extractSameSiteRefererPath(r.Referer()); refPath != "" {
		return refPath
	}
	return mapStoreAPIToPublicPath(rawPath, r.URL.Query())
}

func extractCleanPathFromHeader(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" || strings.HasPrefix(trimmed, "/api/") || strings.HasPrefix(trimmed, "/_next") {
		return ""
	}
	if idx := strings.Index(trimmed, "?"); idx >= 0 {
		trimmed = trimmed[:idx]
	}
	if !strings.HasPrefix(trimmed, "/") {
		return ""
	}
	return truncateStr(trimmed, 500)
}

func extractSameSiteRefererPath(rawRef string) string {
	trimmed := strings.TrimSpace(rawRef)
	if trimmed == "" {
		return ""
	}
	parsed, err := url.Parse(trimmed)
	if err != nil || parsed.Path == "" {
		return ""
	}
	host := strings.ToLower(parsed.Hostname())
	if !strings.Contains(host, "mertervitrini") && host != "localhost" && host != "127.0.0.1" {
		return ""
	}
	if strings.HasPrefix(parsed.Path, "/api/") || strings.HasPrefix(parsed.Path, "/admin") {
		return ""
	}
	return truncateStr(parsed.Path, 500)
}

func mapStoreAPIToPublicPath(apiPath string, q url.Values) string {
	rest := strings.TrimPrefix(apiPath, "/api/v1/store/")
	switch {
	case strings.HasPrefix(rest, "products/"):
		return truncateStr("/product/"+strings.TrimPrefix(rest, "products/"), 500)
	case rest == "products":
		if cat := strings.TrimSpace(q.Get("category_id")); cat != "" {
			return truncateStr("/"+strings.Trim(cat, "/"), 500)
		}
		return "/tum-urunler"
	case strings.HasPrefix(rest, "brands/"):
		slug := strings.TrimSuffix(strings.TrimPrefix(rest, "brands/"), "/products")
		return truncateStr("/ureticiler/"+slug, 500)
	case strings.HasPrefix(rest, "blog/"):
		return truncateStr("/blog/"+strings.TrimPrefix(rest, "blog/"), 500)
	case strings.HasPrefix(rest, "pages/"):
		return truncateStr("/pages/"+strings.TrimPrefix(rest, "pages/"), 500)
	default:
		return truncateStr(apiPath, 500)
	}
}

func shouldAllowThrottledBotLog(ipHash, botName, path string) bool {
	now := time.Now()
	key := ipHash + "|" + botName + "|" + path

	botThrottleMu.Lock()
	defer botThrottleMu.Unlock()

	if lastAt, exists := botThrottleSeen[key]; exists && now.Sub(lastAt) < botCrawlThrottleWindow {
		return false
	}
	if len(botThrottleSeen) >= botCrawlMaxThrottleKeys {
		for k, ts := range botThrottleSeen {
			if now.Sub(ts) >= botCrawlThrottleWindow {
				delete(botThrottleSeen, k)
			}
		}
		if len(botThrottleSeen) >= botCrawlMaxThrottleKeys {
			clear(botThrottleSeen)
		}
	}
	botThrottleSeen[key] = now
	return true
}

func ensureBotCrawlWorker() {
	botCrawlWorkerOnce.Do(func() {
		botCrawlQueue = make(chan botCrawlLogEntry, botCrawlQueueCapacity)
		safe.Go("SEO & AI Bot Crawl Logger Worker", func() {
			for item := range botCrawlQueue {
				persistBotCrawlEntry(item)
			}
		})
	})
}

func persistBotCrawlEntry(item botCrawlLogEntry) {
	if db.Pool == nil || item.botName == "" || item.path == "" {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	ensureAnalyticsSchema(ctx)

	status := item.statusCode
	if status <= 0 || status > 599 {
		status = http.StatusOK
	}
	_, _ = db.Pool.Exec(ctx, `
		INSERT INTO analytics.bot_crawl_logs (
			bot_name, path, user_agent, ip_hash, country_code, status_code
		) VALUES ($1, $2, $3, $4, $5, $6)
	`,
		truncateStr(item.botName, 60),
		truncateStr(item.path, 500),
		truncateStr(item.userAgent, 500),
		truncateStr(item.ipHash, 64),
		truncateStr(item.countryCode, 10),
		status,
	)
}

// EnqueueBotCrawlLog schedules an asynchronous, throttled insert into analytics.bot_crawl_logs.
func EnqueueBotCrawlLog(botName, path, userAgent, ipHash, countryCode string, statusCode int) {
	if botName == "" || path == "" || db.Pool == nil {
		return
	}
	if !shouldAllowThrottledBotLog(ipHash, botName, path) {
		return
	}
	ensureBotCrawlWorker()
	select {
	case botCrawlQueue <- botCrawlLogEntry{
		botName:     botName,
		path:        path,
		userAgent:   userAgent,
		ipHash:      ipHash,
		countryCode: countryCode,
		statusCode:  statusCode,
	}:
	default:
	}
}

type botStatusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *botStatusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

func (r *botStatusRecorder) Unwrap() http.ResponseWriter {
	return r.ResponseWriter
}

// BotCrawlLoggingMiddleware non-blockingly logs search & AI crawler hits on /api/v1/store/* and XML feeds.
func BotCrawlLoggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r == nil || (r.Method != http.MethodGet && r.Method != http.MethodHead) || !isBotLoggableStorePath(r.URL.Path) {
			next.ServeHTTP(w, r)
			return
		}
		ua := resolveCrawlerUserAgent(r)
		isBot, botName := DetectSEOOrAIBot(ua)
		if !isBot {
			next.ServeHTTP(w, r)
			return
		}

		rec := &botStatusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)

		ipHash := hashIP(getClientIP(r))
		countryCode := resolveVisitorCountry(r, "", "")
		path := normalizeBotCrawledPath(r)
		EnqueueBotCrawlLog(botName, path, ua, ipHash, countryCode, rec.status)
	})
}
