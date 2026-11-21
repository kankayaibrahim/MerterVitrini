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

	// Exported crawler category identifiers shared by nginx ingestor & BI queries.
	BotCategoryAI     = "ai_bot"
	BotCategoryGoogle = "google"
	BotCategorySearch = "search_engine"
	BotCategorySEO    = "seo_tool"
	BotCategorySocial = "social_preview"
	BotCategoryOther  = "other_bot"

	botNameGPTBot        = "GPTBot"
	botNameClaudeBot     = "ClaudeBot"
	botNamePerplexityBot = "PerplexityBot"
	botNameBingbot       = "Bingbot"
	botNamePinterestBot  = "Pinterestbot"
	botNameCohereAI      = "Cohere-AI"
)

type botCrawlLogEntry struct {
	botName     string
	path        string
	userAgent   string
	ipHash      string
	countryCode string
	statusCode  int
}

type classifiedBotSignature struct {
	token    string
	name     string
	category string
}

var (
	botCrawlWorkerOnce sync.Once
	botCrawlQueue      chan botCrawlLogEntry
	botThrottleMu      sync.Mutex
	botThrottleSeen    = make(map[string]time.Time)
)

// Priority order matters: AI extended / search tokens must precede generic Googlebot, Applebot, Facebook, or GPT tokens.
var classifiedCrawlerSignatures = []classifiedBotSignature{
	// AI Bots & LLM Search Crawlers
	{token: "oai-searchbot", name: "OAI-SearchBot", category: BotCategoryAI},
	{token: "chatgpt-user", name: "ChatGPT-User", category: BotCategoryAI},
	{token: "gptbot", name: botNameGPTBot, category: BotCategoryAI},
	{token: "claude-searchbot", name: "Claude-SearchBot", category: BotCategoryAI},
	{token: "claude-user", name: "Claude-User", category: BotCategoryAI},
	{token: "claudebot", name: botNameClaudeBot, category: BotCategoryAI},
	{token: "claude-web", name: botNameClaudeBot, category: BotCategoryAI},
	{token: "anthropic-ai", name: botNameClaudeBot, category: BotCategoryAI},
	{token: "perplexity-user", name: "Perplexity-User", category: BotCategoryAI},
	{token: "perplexitybot", name: botNamePerplexityBot, category: BotCategoryAI},
	{token: "google-extended", name: "Google-Extended", category: BotCategoryAI},
	{token: "googleother", name: "GoogleOther", category: BotCategoryAI},
	{token: "applebot-extended", name: "Applebot-Extended", category: BotCategoryAI},
	{token: "meta-externalagent", name: "Meta-ExternalAgent", category: BotCategoryAI},
	{token: "meta-externalfetcher", name: "Meta-ExternalFetcher", category: BotCategoryAI},
	{token: "meta-webindexer", name: "Meta-WebIndexer", category: BotCategoryAI},
	{token: "bytespider", name: "Bytespider", category: BotCategoryAI},
	{token: "amazonbot", name: "Amazonbot", category: BotCategoryAI},
	{token: "ccbot", name: "CCBot", category: BotCategoryAI},
	{token: "deepseekbot", name: "DeepSeekBot", category: BotCategoryAI},
	{token: "mistralai", name: "MistralAI", category: BotCategoryAI},
	{token: "cohere-ai", name: botNameCohereAI, category: BotCategoryAI},
	{token: "cohere-training-data-crawler", name: botNameCohereAI, category: BotCategoryAI},
	{token: "duckassistbot", name: "DuckAssistBot", category: BotCategoryAI},
	{token: "youbot", name: "YouBot", category: BotCategoryAI},
	{token: "ai2bot", name: "AI2Bot", category: BotCategoryAI},
	{token: "diffbot", name: "Diffbot", category: BotCategoryAI},
	{token: "timpibot", name: "Timpibot", category: BotCategoryAI},
	{token: "omgili", name: "Omgili", category: BotCategoryAI},
	{token: "petalbot", name: "PetalBot", category: BotCategoryAI},

	// Google Crawlers
	{token: "googlebot", name: botNameGooglebot, category: BotCategoryGoogle},
	{token: "google-inspectiontool", name: botNameGooglebot, category: BotCategoryGoogle},
	{token: "storebot-google", name: botNameGooglebot, category: BotCategoryGoogle},
	{token: "adsbot-google", name: botNameGooglebot, category: BotCategoryGoogle},
	{token: "apis-google", name: botNameGooglebot, category: BotCategoryGoogle},
	{token: "mediapartners-google", name: botNameGooglebot, category: BotCategoryGoogle},
	{token: "feedfetcher-google", name: botNameGooglebot, category: BotCategoryGoogle},

	// Other Search Engine Crawlers
	{token: "yandexbot", name: botNameYandexBot, category: BotCategorySearch},
	{token: "yandeximages", name: botNameYandexBot, category: BotCategorySearch},
	{token: "yandexmobilebot", name: botNameYandexBot, category: BotCategorySearch},
	{token: "yandexaccessibilitybot", name: botNameYandexBot, category: BotCategorySearch},
	{token: "bingbot", name: botNameBingbot, category: BotCategorySearch},
	{token: "adidxbot", name: botNameBingbot, category: BotCategorySearch},
	{token: "bingpreview", name: botNameBingbot, category: BotCategorySearch},
	{token: "duckduckbot", name: "DuckDuckBot", category: BotCategorySearch},
	{token: "applebot", name: "Applebot", category: BotCategorySearch},
	{token: "baiduspider", name: "Baiduspider", category: BotCategorySearch},
	{token: "seznambot", name: "SeznamBot", category: BotCategorySearch},
	{token: "sogou", name: "Sogou", category: BotCategorySearch},
	{token: "slurp", name: "Yahoo Slurp", category: BotCategorySearch},
	{token: "yeti", name: "Naver Yeti", category: BotCategorySearch},

	// SEO & Audit Tools
	{token: "semrushbot", name: "SemrushBot", category: BotCategorySEO},
	{token: "ahrefsbot", name: "AhrefsBot", category: BotCategorySEO},
	{token: "mj12bot", name: "MJ12bot", category: BotCategorySEO},
	{token: "dotbot", name: "DotBot", category: BotCategorySEO},
	{token: "barkrowler", name: "Barkrowler", category: BotCategorySEO},
	{token: "dataforseobot", name: "DataForSeoBot", category: BotCategorySEO},
	{token: "qlyzebot", name: "QlyzeBot", category: BotCategorySEO},
	{token: "reflectionbot", name: "ReflectionBot", category: BotCategorySEO},
	{token: "blexbot", name: "BLEXBot", category: BotCategorySEO},
	{token: "screaming frog", name: "ScreamingFrog", category: BotCategorySEO},

	// Social & Messaging Link Previews
	{token: botNameFacebookExt, name: botNameFacebookExt, category: BotCategorySocial},
	{token: "facebot", name: botNameFacebookExt, category: BotCategorySocial},
	{token: "telegrambot", name: "TelegramBot", category: BotCategorySocial},
	{token: "whatsapp", name: "WhatsApp", category: BotCategorySocial},
	{token: "linkedinbot", name: "LinkedInBot", category: BotCategorySocial},
	{token: "twitterbot", name: "Twitterbot", category: BotCategorySocial},
	{token: "pinterestbot", name: botNamePinterestBot, category: BotCategorySocial},
	{token: "slackbot", name: "Slackbot", category: BotCategorySocial},
	{token: "discordbot", name: "Discordbot", category: BotCategorySocial},
}

// ClassifyBotUserAgent inspects User-Agent strings and classifies known AI, Google, search, SEO, and social crawlers.
func ClassifyBotUserAgent(userAgent string) (bool, string, string) {
	uaLower := strings.ToLower(strings.TrimSpace(userAgent))
	if uaLower == "" {
		return false, "", ""
	}
	for _, sig := range classifiedCrawlerSignatures {
		if strings.Contains(uaLower, sig.token) {
			return true, sig.name, sig.category
		}
	}
	return false, "", ""
}

// ResolveBotCategory maps a normalized bot_name back to its canonical crawler category.
func ResolveBotCategory(botName string) string {
	switch botName {
	case "OAI-SearchBot", "ChatGPT-User", botNameGPTBot,
		"Claude-SearchBot", "Claude-User", botNameClaudeBot,
		"Perplexity-User", botNamePerplexityBot,
		"Google-Extended", "GoogleOther", "Applebot-Extended",
		"Meta-ExternalAgent", "Meta-ExternalFetcher", "Meta-WebIndexer",
		"Bytespider", "Amazonbot", "CCBot", "DeepSeekBot",
		"MistralAI", botNameCohereAI, "DuckAssistBot", "YouBot",
		"AI2Bot", "Diffbot", "Timpibot", "Omgili", "PetalBot":
		return BotCategoryAI
	case botNameGooglebot:
		return BotCategoryGoogle
	case botNameYandexBot, botNameBingbot, "DuckDuckBot", "Applebot", "Baiduspider", "SeznamBot", "Sogou", "Yahoo Slurp", "Naver Yeti":
		return BotCategorySearch
	case "SemrushBot", "AhrefsBot", "MJ12bot", "DotBot", "Barkrowler", "DataForSeoBot", "QlyzeBot", "ReflectionBot", "BLEXBot", "ScreamingFrog":
		return BotCategorySEO
	case botNameFacebookExt, "TelegramBot", "WhatsApp", "LinkedInBot", "Twitterbot", botNamePinterestBot, "Slackbot", "Discordbot":
		return BotCategorySocial
	default:
		return BotCategoryOther
	}
}

// DetectSEOOrAIBot inspects User-Agent strings for known search engine and AI crawlers.
func DetectSEOOrAIBot(userAgent string) (bool, string) {
	isBot, name, _ := ClassifyBotUserAgent(userAgent)
	return isBot, name
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
		cat := strings.TrimSpace(q.Get("category_id"))
		if strings.TrimSpace(q.Get("new_days")) != "" && (cat == "" || strings.EqualFold(cat, "yeni-urunler")) {
			return "/yeni-urunler"
		}
		if cat != "" {
			if strings.EqualFold(cat, "yeni-urunler") {
				return "/yeni-urunler"
			}
			if strings.EqualFold(cat, "tum-urunler") {
				return "/tum-urunler"
			}
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
