package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"

	"mertervitrini/backend/db"
)

const (
	trafficChannelAIAssistant  = "ai_assistant"
	trafficChannelGoogleSearch = "google_search"
	trafficChannelOtherSearch  = "other_search"
	trafficChannelSocial       = "social"
	trafficChannelPaidAds      = "paid_ads"
	trafficChannelCampaign     = "campaign"
	trafficChannelDirect       = "direct"
	trafficChannelReferral     = "referral"

	crawlerDataSourceNginx  = "nginx_hourly"
	crawlerDataSourceHybrid = "hybrid"
	crawlerDataSourceLegacy = "middleware_fallback"
)

var turkishMonths = [...]string{
	"",
	"Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
	"Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
}

// TrafficComparisonHero holds headline AI vs. Google crawler and human visit comparison metrics.
type TrafficComparisonHero struct {
	AIBotRequests            int64   `json:"ai_bot_requests"`
	GoogleBotRequests        int64   `json:"google_bot_requests"`
	OtherSearchBotRequests   int64   `json:"other_search_bot_requests"`
	SEOToolBotRequests       int64   `json:"seo_tool_bot_requests"`
	SocialPreviewBotRequests int64   `json:"social_preview_bot_requests"`
	OtherBotRequests         int64   `json:"other_bot_requests"`
	TotalBotRequests         int64   `json:"total_bot_requests"`
	AIVisits                 int     `json:"ai_visits"`
	AIVisitors               int     `json:"ai_visitors"`
	ChatGPTVisits            int     `json:"chatgpt_visits"`
	ChatGPTVisitors          int     `json:"chatgpt_visitors"`
	GoogleSearchVisits       int     `json:"google_search_visits"`
	GoogleSearchVisitors     int     `json:"google_search_visitors"`
	OtherSearchVisits        int     `json:"other_search_visits"`
	TotalHumanSessions       int     `json:"total_human_sessions"`
	TotalHumanVisitors       int     `json:"total_human_visitors"`
	AICrawlPerVisitRatio     float64 `json:"ai_crawl_per_visit_ratio"`
	GoogleCrawlPerVisitRatio float64 `json:"google_crawl_per_visit_ratio"`
	CrawlerDataSource        string  `json:"crawler_data_source"`
}

// TrafficCrawlerGroupRow summarizes crawler request counts by category.
type TrafficCrawlerGroupRow struct {
	Category string  `json:"category"`
	Label    string  `json:"label"`
	Hits     int64   `json:"hits"`
	SharePct float64 `json:"share_pct"`
	BotCount int     `json:"bot_count"`
}

// TrafficCrawlerBotRow lists individual bot crawler metrics.
type TrafficCrawlerBotRow struct {
	BotName             string    `json:"bot_name"`
	Category            string    `json:"category"`
	Hits                int64     `json:"hits"`
	SharePct            float64   `json:"share_pct"`
	UniquePaths         int       `json:"unique_paths"`
	ProductPagesCrawled int64     `json:"product_pages_crawled"`
	LastCrawlAt         time.Time `json:"last_crawl_at"`
}

// TrafficCrawledPathRow lists URLs receiving the highest bot crawl activity.
type TrafficCrawledPathRow struct {
	Path        string    `json:"path"`
	Hits        int64     `json:"hits"`
	TopBot      string    `json:"top_bot"`
	TopCategory string    `json:"top_category"`
	UniqueBots  int       `json:"unique_bots"`
	LastCrawlAt time.Time `json:"last_crawl_at"`
}

// TrafficChannelSummaryRow groups human sessions and B2B leads by high-level acquisition channel.
type TrafficChannelSummaryRow struct {
	Channel  string  `json:"channel"`
	Label    string  `json:"label"`
	Sessions int     `json:"sessions"`
	Visitors int     `json:"visitors"`
	SharePct float64 `json:"share_pct"`
	B2BLeads int     `json:"b2b_leads"`
}

// TrafficSourceRow ranks individual human traffic sources (ChatGPT, Google Arama, Bing, Perplexity, etc.).
type TrafficSourceRow struct {
	SourceName    string  `json:"source_name"`
	Channel       string  `json:"channel"`
	Sessions      int     `json:"sessions"`
	Visitors      int     `json:"visitors"`
	Pageviews     int     `json:"pageviews"`
	SharePct      float64 `json:"share_pct"`
	BounceRatePct float64 `json:"bounce_rate_pct"`
	B2BLeads      int     `json:"b2b_leads"`
}

// TrafficCountryRow breaks down traffic by ISO country with AI vs. Google split.
type TrafficCountryRow struct {
	CountryCode  string  `json:"country_code"`
	CountryLabel string  `json:"country_label"`
	Sessions     int     `json:"sessions"`
	Visitors     int     `json:"visitors"`
	Pageviews    int     `json:"pageviews"`
	SharePct     float64 `json:"share_pct"`
	AIVisits     int     `json:"ai_visits"`
	GoogleVisits int     `json:"google_visits"`
}

// TrafficDailyComparisonPoint aligns daily AI/Google bot crawls and human AI/Google visits.
type TrafficDailyComparisonPoint struct {
	Date            string `json:"date"`
	AIBotHits       int64  `json:"ai_bot_hits"`
	GoogleBotHits   int64  `json:"google_bot_hits"`
	OtherBotHits    int64  `json:"other_bot_hits"`
	AIVisits        int    `json:"ai_visits"`
	GoogleVisits    int    `json:"google_visits"`
	OtherVisits     int    `json:"other_visits"`
}

// TrafficArrivalKeywordRow records first-party arrival keywords from utm_term and external search referrer queries.
type TrafficArrivalKeywordRow struct {
	Keyword        string    `json:"keyword"`
	KeywordType    string    `json:"keyword_type"`
	SourceName     string    `json:"source_name"`
	Campaign       string    `json:"campaign"`
	Sessions       int       `json:"sessions"`
	Visitors       int       `json:"visitors"`
	TopLandingPath string    `json:"top_landing_path"`
	LastSeenAt     time.Time `json:"last_seen_at"`
}

// TrafficSourceLandingRow shows which landing pages & inferred topics AI assistants and search engines sent visitors to.
type TrafficSourceLandingRow struct {
	SourceName    string `json:"source_name"`
	Channel       string `json:"channel"`
	Path          string `json:"path"`
	PageTitle     string `json:"page_title"`
	InferredTopic string `json:"inferred_topic"`
	Sessions      int    `json:"sessions"`
	Visitors      int    `json:"visitors"`
	ProductViews  int    `json:"product_views"`
}

// TrafficSourcesReportResponse is the response payload for GET /api/v1/analytics/traffic-sources.
type TrafficSourcesReportResponse struct {
	Period           string                        `json:"period"`
	DateRangeLabel   string                        `json:"date_range_label"`
	GeneratedAt      time.Time                     `json:"generated_at"`
	Hero             TrafficComparisonHero         `json:"hero"`
	CrawlerGroups    []TrafficCrawlerGroupRow      `json:"crawler_groups"`
	TopCrawlers      []TrafficCrawlerBotRow        `json:"top_crawlers"`
	TopCrawledPaths  []TrafficCrawledPathRow       `json:"top_crawled_paths"`
	VisitChannels    []TrafficChannelSummaryRow    `json:"visit_channels"`
	TopSources       []TrafficSourceRow            `json:"top_sources"`
	TopCountries     []TrafficCountryRow           `json:"top_countries"`
	DailyComparison  []TrafficDailyComparisonPoint `json:"daily_comparison"`
	ArrivalKeywords  []TrafficArrivalKeywordRow    `json:"arrival_keywords"`
	LandingIntents   []TrafficSourceLandingRow     `json:"landing_intents"`
	InternalKeywords []BITopSearchRow              `json:"internal_keywords"`
}

// GetTrafficSourcesReport handles GET /api/v1/analytics/traffic-sources?period=today|24h|7d|30d|90d.
func (h *AnalyticsHandler) GetTrafficSourcesReport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, errJSONMethodNotAllowed, http.StatusMethodNotAllowed)
		return
	}

	win := resolveBIPeriodWindow(r.URL.Query().Get("period"))
	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	defer cancel()
	ensureAnalyticsSchema(ctx)

	resp := TrafficSourcesReportResponse{
		Period:           win.Period,
		DateRangeLabel:   formatTurkishDateRange(win.Since, win.Until),
		GeneratedAt:      time.Now().UTC(),
		CrawlerGroups:    []TrafficCrawlerGroupRow{},
		TopCrawlers:      []TrafficCrawlerBotRow{},
		TopCrawledPaths:  []TrafficCrawledPathRow{},
		VisitChannels:    []TrafficChannelSummaryRow{},
		TopSources:       []TrafficSourceRow{},
		TopCountries:     []TrafficCountryRow{},
		DailyComparison:  []TrafficDailyComparisonPoint{},
		ArrivalKeywords:  []TrafficArrivalKeywordRow{},
		LandingIntents:   []TrafficSourceLandingRow{},
		InternalKeywords: []BITopSearchRow{},
	}

	dailyMap := make(map[string]*TrafficDailyComparisonPoint)
	populateTrafficCrawlers(ctx, win, &resp, dailyMap)
	populateTrafficVisits(ctx, win, &resp, dailyMap)
	populateTrafficLandingAndKeywords(ctx, win, &resp)

	resp.Hero.AICrawlPerVisitRatio = computeCrawlToVisitRatio(resp.Hero.AIBotRequests, resp.Hero.AIVisits)
	resp.Hero.GoogleCrawlPerVisitRatio = computeCrawlToVisitRatio(resp.Hero.GoogleBotRequests, resp.Hero.GoogleSearchVisits)
	resp.DailyComparison = flattenSortedDailyComparison(dailyMap)

	w.Header().Set(headerContentType, mimeApplicationJSON)
	_ = json.NewEncoder(w).Encode(resp)
}

func computeCrawlToVisitRatio(crawls int64, visits int) float64 {
	if visits <= 0 || crawls <= 0 {
		return 0
	}
	return round1(float64(crawls) / float64(visits))
}

func safePctInt64(part, total int64) float64 {
	if total <= 0 || part <= 0 {
		return 0
	}
	return round1((float64(part) / float64(total)) * 100.0)
}

func formatTurkishDateRange(since, until time.Time) string {
	loc := istanbulLocation()
	s := since.In(loc)
	u := until.In(loc)

	sMonth := turkishMonths[s.Month()]
	uMonth := turkishMonths[u.Month()]
	if s.Year() == u.Year() && s.Month() == u.Month() {
		if s.Day() == u.Day() {
			return fmt.Sprintf("%d %s %d", u.Day(), uMonth, u.Year())
		}
		return fmt.Sprintf("%d ilâ %d %s %d", s.Day(), u.Day(), uMonth, u.Year())
	}
	if s.Year() == u.Year() {
		return fmt.Sprintf("%d %s - %d %s %d", s.Day(), sMonth, u.Day(), uMonth, u.Year())
	}
	return fmt.Sprintf("%d %s %d - %d %s %d", s.Day(), sMonth, s.Year(), u.Day(), uMonth, u.Year())
}

func crawlerCategoryLabelTr(cat string) string {
	switch cat {
	case BotCategoryAI:
		return "Yapay Zeka Botları"
	case BotCategoryGoogle:
		return "Google Tarayıcıları"
	case BotCategorySearch:
		return "Diğer Arama Motorları"
	case BotCategorySEO:
		return "SEO & Denetim Botları"
	case BotCategorySocial:
		return "Sosyal Önizleme Botları"
	default:
		return "Diğer Otomatik Botlar"
	}
}

func trafficChannelLabelTr(ch string) string {
	switch ch {
	case trafficChannelAIAssistant:
		return "Yapay Zeka Asistanları"
	case trafficChannelGoogleSearch:
		return "Google Arama"
	case trafficChannelOtherSearch:
		return "Diğer Arama Motorları"
	case trafficChannelSocial:
		return "Sosyal Medya & Mesajlaşma"
	case trafficChannelPaidAds:
		return "Ücretli Reklam (Ads)"
	case trafficChannelCampaign:
		return "Kampanya / UTM"
	case trafficChannelDirect:
		return "Doğrudan (Direct)"
	default:
		return "Harici Yönlendirme (Referral)"
	}
}

func getOrInitDailyPoint(dailyMap map[string]*TrafficDailyComparisonPoint, date string) *TrafficDailyComparisonPoint {
	pt := dailyMap[date]
	if pt == nil {
		pt = &TrafficDailyComparisonPoint{Date: date}
		dailyMap[date] = pt
	}
	return pt
}

func flattenSortedDailyComparison(dailyMap map[string]*TrafficDailyComparisonPoint) []TrafficDailyComparisonPoint {
	if len(dailyMap) == 0 {
		return []TrafficDailyComparisonPoint{}
	}
	dates := make([]string, 0, len(dailyMap))
	for d := range dailyMap {
		dates = append(dates, d)
	}
	sort.Strings(dates)

	out := make([]TrafficDailyComparisonPoint, 0, len(dates))
	for _, d := range dates {
		out = append(out, *dailyMap[d])
	}
	return out
}

func populateTrafficCrawlers(
	ctx context.Context,
	win biTimeWindow,
	resp *TrafficSourcesReportResponse,
	dailyMap map[string]*TrafficDailyComparisonPoint,
) {
	if db.Pool == nil {
		resp.Hero.CrawlerDataSource = crawlerDataSourceLegacy
		return
	}

	var hourlyCount, legacyCount int64
	_ = db.Pool.QueryRow(ctx, biBotCrawlUnionCTE+`
		SELECT
			COALESCE(SUM(hits) FILTER (WHERE from_hourly), 0)::bigint,
			COALESCE(SUM(hits) FILTER (WHERE NOT from_hourly), 0)::bigint
		FROM bot_hits
	`, win.Since, win.Until).Scan(&hourlyCount, &legacyCount)

	switch {
	case hourlyCount > 0 && legacyCount > 0:
		resp.Hero.CrawlerDataSource = crawlerDataSourceHybrid
	case hourlyCount > 0:
		resp.Hero.CrawlerDataSource = crawlerDataSourceNginx
	default:
		resp.Hero.CrawlerDataSource = crawlerDataSourceLegacy
	}

	queryCrawlerBotsSummary(ctx, win, resp)
	queryCrawlerTopPaths(ctx, win, resp)
	queryCrawlerDailySeries(ctx, win, dailyMap)
}

func addBotHitsToHeroCategory(hero *TrafficComparisonHero, category string, hits int64) {
	hero.TotalBotRequests += hits
	switch category {
	case BotCategoryAI:
		hero.AIBotRequests += hits
	case BotCategoryGoogle:
		hero.GoogleBotRequests += hits
	case BotCategorySearch:
		hero.OtherSearchBotRequests += hits
	case BotCategorySEO:
		hero.SEOToolBotRequests += hits
	case BotCategorySocial:
		hero.SocialPreviewBotRequests += hits
	default:
		hero.OtherBotRequests += hits
	}
}

func queryCrawlerBotsSummary(ctx context.Context, win biTimeWindow, resp *TrafficSourcesReportResponse) {
	botRows, err := db.Pool.Query(ctx, biBotCrawlUnionCTE+`
		SELECT
			bot_name,
			MAX(bot_category) AS stored_cat,
			COALESCE(SUM(hits), 0)::bigint AS total_hits,
			COUNT(DISTINCT path)::int AS uniq_paths,
			COALESCE(SUM(hits) FILTER (WHERE path LIKE '/product/%' OR path ~ '^/[a-z]{2}/product/'), 0)::bigint AS prod_crawled,
			MAX(created_at) AS last_at
		FROM bot_hits
		GROUP BY bot_name
		ORDER BY total_hits DESC
		LIMIT 60
	`, win.Since, win.Until)
	if err != nil {
		return
	}
	defer botRows.Close()

	groupMap := make(map[string]*TrafficCrawlerGroupRow)
	var rawBots []TrafficCrawlerBotRow

	for botRows.Next() {
		var row TrafficCrawlerBotRow
		var storedCat string
		if scanErr := botRows.Scan(&row.BotName, &storedCat, &row.Hits, &row.UniquePaths, &row.ProductPagesCrawled, &row.LastCrawlAt); scanErr != nil {
			continue
		}
		row.Category = strings.TrimSpace(storedCat)
		if row.Category == "" {
			row.Category = ResolveBotCategory(row.BotName)
		}
		addBotHitsToHeroCategory(&resp.Hero, row.Category, row.Hits)

		grp := groupMap[row.Category]
		if grp == nil {
			grp = &TrafficCrawlerGroupRow{
				Category: row.Category,
				Label:    crawlerCategoryLabelTr(row.Category),
			}
			groupMap[row.Category] = grp
		}
		grp.Hits += row.Hits
		grp.BotCount++
		rawBots = append(rawBots, row)
	}

	for i := range rawBots {
		rawBots[i].SharePct = safePctInt64(rawBots[i].Hits, resp.Hero.TotalBotRequests)
	}
	if len(rawBots) > 25 {
		rawBots = rawBots[:25]
	}
	resp.TopCrawlers = rawBots

	groups := make([]TrafficCrawlerGroupRow, 0, len(groupMap))
	for _, grp := range groupMap {
		grp.SharePct = safePctInt64(grp.Hits, resp.Hero.TotalBotRequests)
		groups = append(groups, *grp)
	}
	sort.Slice(groups, func(i, j int) bool {
		return groups[i].Hits > groups[j].Hits
	})
	resp.CrawlerGroups = groups
}

func queryCrawlerTopPaths(ctx context.Context, win biTimeWindow, resp *TrafficSourcesReportResponse) {
	pathRows, err := db.Pool.Query(ctx, biBotCrawlUnionCTE+`
		WITH ranked_path_bots AS (
			SELECT
				path,
				bot_name,
				MAX(bot_category) AS stored_cat,
				SUM(hits) AS bot_hits,
				ROW_NUMBER() OVER (PARTITION BY path ORDER BY SUM(hits) DESC, bot_name ASC) AS rn
			FROM bot_hits
			GROUP BY path, bot_name
		)
		SELECT
			bh.path,
			COALESCE(SUM(bh.hits), 0)::bigint AS hits,
			COALESCE(MAX(rpb.bot_name) FILTER (WHERE rpb.rn = 1), 'UnknownBot') AS top_bot,
			COALESCE(MAX(rpb.stored_cat) FILTER (WHERE rpb.rn = 1), '') AS top_cat,
			COUNT(DISTINCT bh.bot_name)::int AS uniq_bots,
			MAX(bh.created_at) AS last_at
		FROM bot_hits bh
		LEFT JOIN ranked_path_bots rpb ON rpb.path = bh.path AND rpb.rn = 1
		GROUP BY bh.path
		ORDER BY hits DESC
		LIMIT 20
	`, win.Since, win.Until)
	if err != nil {
		return
	}
	defer pathRows.Close()

	for pathRows.Next() {
		var p TrafficCrawledPathRow
		if scanErr := pathRows.Scan(&p.Path, &p.Hits, &p.TopBot, &p.TopCategory, &p.UniqueBots, &p.LastCrawlAt); scanErr == nil {
			if strings.TrimSpace(p.TopCategory) == "" {
				p.TopCategory = ResolveBotCategory(p.TopBot)
			}
			resp.TopCrawledPaths = append(resp.TopCrawledPaths, p)
		}
	}
}

func queryCrawlerDailySeries(
	ctx context.Context,
	win biTimeWindow,
	dailyMap map[string]*TrafficDailyComparisonPoint,
) {
	rows, err := db.Pool.Query(ctx, biBotCrawlUnionCTE+`
		SELECT
			TO_CHAR(bucket_hour AT TIME ZONE 'Europe/Istanbul', 'YYYY-MM-DD') AS day,
			bot_name,
			MAX(bot_category) AS stored_cat,
			COALESCE(SUM(hits), 0)::bigint AS hits
		FROM bot_hits
		GROUP BY day, bot_name
		ORDER BY day ASC
	`, win.Since, win.Until)
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var day, botName, storedCat string
		var hits int64
		if scanErr := rows.Scan(&day, &botName, &storedCat, &hits); scanErr != nil {
			continue
		}
		cat := strings.TrimSpace(storedCat)
		if cat == "" {
			cat = ResolveBotCategory(botName)
		}
		pt := getOrInitDailyPoint(dailyMap, day)
		switch cat {
		case BotCategoryAI:
			pt.AIBotHits += hits
		case BotCategoryGoogle:
			pt.GoogleBotHits += hits
		default:
			pt.OtherBotHits += hits
		}
	}
}

// Shared SQL CTE normalizing session-first attribution into canonical human channels and sources.
const trafficHumanSessionsCTE = `
	pv_window AS (
		SELECT
			visitor_id,
			COALESCE(NULLIF(session_id, ''), visitor_id) AS sess_id,
			COALESCE(NULLIF(referrer_host, ''), 'Doğrudan (Direct)') AS referrer_host,
			COALESCE(utm_source, '') AS utm_source,
			COALESCE(utm_medium, '') AS utm_medium,
			COALESCE(utm_campaign, '') AS utm_campaign,
			COALESCE(utm_term, '') AS utm_term,
			COALESCE(referrer_keyword, '') AS referrer_keyword,
			COALESCE(click_id, '') AS click_id,
			CASE
				WHEN UPPER(COALESCE(NULLIF(country_code, ''), 'TR')) IN ('EU', 'EN', 'T1', 'XX', '--') THEN 'TR'
				ELSE UPPER(COALESCE(NULLIF(country_code, ''), 'TR'))
			END AS country_code,
			path,
			COALESCE(page_title, '') AS page_title,
			duration_sec,
			created_at
		FROM analytics.page_views
		WHERE COALESCE(is_bot, false) = false
		  AND created_at >= $1 AND created_at < $2
	),
	sess_entry AS (
		SELECT DISTINCT ON (sess_id)
			sess_id,
			visitor_id,
			country_code,
			created_at AS first_at,
			LOWER(utm_source) AS l_utm_src,
			LOWER(utm_medium) AS l_utm_med,
			utm_source AS raw_utm_src,
			utm_campaign,
			utm_term,
			referrer_keyword,
			referrer_host,
			LOWER(referrer_host) AS l_ref,
			click_id,
			path AS entry_path,
			page_title AS entry_title
		FROM pv_window
		ORDER BY sess_id, created_at ASC
	),
	sess_stats AS (
		SELECT
			sess_id,
			COUNT(*)::int AS pv_cnt,
			COALESCE(SUM(duration_sec), 0)::int AS dur_sum,
			COUNT(*) FILTER (WHERE path LIKE '/product/%' OR path ~ '^/[a-z]{2}/product/')::int AS prod_views
		FROM pv_window
		GROUP BY sess_id
	),
	classified_sessions AS (
		SELECT
			se.sess_id,
			se.visitor_id,
			se.country_code,
			se.first_at,
			se.entry_path,
			se.entry_title,
			se.utm_campaign,
			se.utm_term,
			se.referrer_keyword,
			ss.pv_cnt,
			ss.dur_sum,
			ss.prod_views,
			CASE
				WHEN se.click_id <> '' THEN 'paid_ads'
				WHEN (se.l_utm_src || ' ' || se.l_ref) ~ '(chatgpt|chat\.openai|openai\.com|perplexity|claude\.ai|anthropic|gemini\.google|bard\.google|copilot\.microsoft|grok\.com|x\.ai|deepseek|meta\.ai|you\.com|phind)' THEN 'ai_assistant'
				WHEN se.l_utm_med IN ('cpc', 'ppc', 'paid', 'ads', 'paid_social') THEN 'paid_ads'
				WHEN se.referrer_host = 'Google Arama' OR se.l_ref LIKE '%google.%' OR se.l_utm_src = 'google' THEN 'google_search'
				WHEN se.referrer_host IN ('Yandex Arama', 'Bing Arama', 'DuckDuckGo', 'Brave Search', 'Yahoo Arama', 'Baidu', 'Ecosia')
				  OR se.l_ref ~ '(duckduckgo\.|search\.brave\.|yahoo\.|yandex\.|bing\.|baidu\.|ecosia\.)'
				  OR se.l_utm_med = 'organic' THEN 'other_search'
				WHEN se.referrer_host IN ('Instagram', 'Facebook', 'WhatsApp', 'Telegram', 'TikTok', 'YouTube', 'LinkedIn', 'Pinterest', 'X (Twitter)')
				  OR se.l_utm_med = 'social'
				  OR se.l_utm_src IN ('instagram', 'facebook', 'fb', 'whatsapp', 'telegram', 'tiktok', 'youtube', 'linkedin') THEN 'social'
				WHEN se.raw_utm_src <> '' THEN 'campaign'
				WHEN se.referrer_host IN ('', 'Doğrudan (Direct)') THEN 'direct'
				ELSE 'referral'
			END AS channel,
			CASE
				WHEN (se.l_utm_src || ' ' || se.l_ref) ~ '(chatgpt|chat\.openai|openai\.com)' THEN 'ChatGPT'
				WHEN (se.l_utm_src || ' ' || se.l_ref) LIKE '%perplexity%' THEN 'Perplexity'
				WHEN (se.l_utm_src || ' ' || se.l_ref) ~ '(claude\.ai|anthropic)' THEN 'Claude'
				WHEN (se.l_utm_src || ' ' || se.l_ref) ~ '(gemini\.google|bard\.google)' THEN 'Gemini'
				WHEN (se.l_utm_src || ' ' || se.l_ref) LIKE '%copilot.microsoft%' THEN 'Microsoft Copilot'
				WHEN (se.l_utm_src || ' ' || se.l_ref) ~ '(grok\.com|x\.ai)' THEN 'Grok'
				WHEN (se.l_utm_src || ' ' || se.l_ref) LIKE '%deepseek%' THEN 'DeepSeek'
				WHEN (se.l_utm_src || ' ' || se.l_ref) LIKE '%meta.ai%' THEN 'Meta AI'
				WHEN (se.l_utm_src || ' ' || se.l_ref) LIKE '%you.com%' THEN 'You.com'
				WHEN (se.l_utm_src || ' ' || se.l_ref) LIKE '%phind%' THEN 'Phind'
				WHEN se.click_id LIKE 'gclid:%' THEN 'Google Ads'
				WHEN se.click_id LIKE 'yclid:%' THEN 'Yandex Direct'
				WHEN se.click_id LIKE 'fbclid:%' THEN 'Meta Ads'
				WHEN se.click_id LIKE 'ttclid:%' THEN 'TikTok Ads'
				WHEN se.referrer_host = 'Google Arama' OR se.l_ref LIKE '%google.%' THEN 'Google Arama'
				WHEN se.referrer_host = 'Yandex Arama' OR se.l_ref LIKE '%yandex.%' THEN 'Yandex Arama'
				WHEN se.referrer_host = 'Bing Arama' OR se.l_ref LIKE '%bing.%' THEN 'Bing Arama'
				WHEN se.referrer_host = 'DuckDuckGo' OR se.l_ref LIKE '%duckduckgo.%' THEN 'DuckDuckGo'
				WHEN se.referrer_host = 'Brave Search' OR se.l_ref LIKE '%search.brave.%' THEN 'Brave Search'
				WHEN se.referrer_host = 'Yahoo Arama' OR se.l_ref LIKE '%yahoo.%' THEN 'Yahoo Arama'
				WHEN se.raw_utm_src <> '' AND se.referrer_host IN ('', 'Doğrudan (Direct)') THEN se.raw_utm_src
				ELSE COALESCE(NULLIF(se.referrer_host, ''), 'Doğrudan (Direct)')
			END AS source_name
		FROM sess_entry se
		JOIN sess_stats ss ON ss.sess_id = se.sess_id
	)
`

func populateTrafficVisits(
	ctx context.Context,
	win biTimeWindow,
	resp *TrafficSourcesReportResponse,
	dailyMap map[string]*TrafficDailyComparisonPoint,
) {
	if db.Pool == nil {
		return
	}

	queryTrafficSourcesList(ctx, win, resp)
	queryTrafficCountriesList(ctx, win, resp)
	queryTrafficVisitsDailySeries(ctx, win, dailyMap)
}

func queryTrafficSourcesList(ctx context.Context, win biTimeWindow, resp *TrafficSourcesReportResponse) {
	sql := `WITH ` + biUnifiedLeadsCTE + `, ` + trafficHumanSessionsCTE + `,
		lead_sources AS (
			SELECT
				COALESCE(ms.source_name, 'Doğrudan (Direct)') AS source_name,
				COALESCE(ms.channel, 'direct') AS channel,
				COUNT(*)::int AS leads
			FROM resolved_leads rl
			LEFT JOIN LATERAL (
				SELECT cs.source_name, cs.channel
				FROM classified_sessions cs
				WHERE rl.eff_vid <> '' AND cs.visitor_id = rl.eff_vid
				ORDER BY (cs.first_at <= rl.created_at) DESC, cs.first_at DESC
				LIMIT 1
			) ms ON true
			GROUP BY 1, 2
		),
		sess_agg AS (
			SELECT
				source_name,
				channel,
				COUNT(*)::int AS sessions,
				COUNT(DISTINCT visitor_id)::int AS visitors,
				COALESCE(SUM(pv_cnt), 0)::int AS pageviews,
				COUNT(*) FILTER (WHERE pv_cnt = 1 AND dur_sum < 10)::int AS bounce_sess
			FROM classified_sessions
			GROUP BY source_name, channel
		)
		SELECT
			COALESCE(sa.source_name, ls.source_name) AS source_name,
			COALESCE(sa.channel, ls.channel) AS channel,
			COALESCE(sa.sessions, 0)::int AS sessions,
			COALESCE(sa.visitors, 0)::int AS visitors,
			COALESCE(sa.pageviews, 0)::int AS pageviews,
			COALESCE(sa.bounce_sess, 0)::int AS bounce_sess,
			COALESCE(ls.leads, 0)::int AS leads
		FROM sess_agg sa
		FULL OUTER JOIN lead_sources ls
			ON ls.source_name = sa.source_name AND ls.channel = sa.channel
		ORDER BY sessions DESC, visitors DESC, leads DESC
	`
	rows, err := db.Pool.Query(ctx, sql, win.Since, win.Until)
	if err != nil {
		return
	}
	defer rows.Close()

	channelMap := make(map[string]*TrafficChannelSummaryRow)
	var allSources []TrafficSourceRow
	totalSessions := 0

	for rows.Next() {
		var r TrafficSourceRow
		var bounceSess int
		if scanErr := rows.Scan(
			&r.SourceName, &r.Channel, &r.Sessions, &r.Visitors, &r.Pageviews, &bounceSess, &r.B2BLeads,
		); scanErr != nil {
			continue
		}
		r.BounceRatePct = safePct(bounceSess, r.Sessions)
		totalSessions += r.Sessions
		updateHeroAndChannelMetrics(&resp.Hero, channelMap, r)
		allSources = append(allSources, r)
	}

	resp.Hero.TotalHumanSessions = totalSessions
	_ = db.Pool.QueryRow(ctx, `
		SELECT COALESCE(COUNT(DISTINCT visitor_id), 0)::int
		FROM analytics.page_views
		WHERE COALESCE(is_bot, false) = false
		  AND created_at >= $1 AND created_at < $2
	`, win.Since, win.Until).Scan(&resp.Hero.TotalHumanVisitors)

	for i := range allSources {
		allSources[i].SharePct = safePct(allSources[i].Sessions, totalSessions)
	}
	if len(allSources) > 25 {
		allSources = allSources[:25]
	}
	resp.TopSources = allSources

	channels := make([]TrafficChannelSummaryRow, 0, len(channelMap))
	for _, ch := range channelMap {
		ch.SharePct = safePct(ch.Sessions, totalSessions)
		channels = append(channels, *ch)
	}
	sort.Slice(channels, func(i, j int) bool {
		return channels[i].Sessions > channels[j].Sessions
	})
	resp.VisitChannels = channels
}

func updateHeroAndChannelMetrics(
	hero *TrafficComparisonHero,
	channelMap map[string]*TrafficChannelSummaryRow,
	r TrafficSourceRow,
) {
	ch := channelMap[r.Channel]
	if ch == nil {
		ch = &TrafficChannelSummaryRow{
			Channel: r.Channel,
			Label:   trafficChannelLabelTr(r.Channel),
		}
		channelMap[r.Channel] = ch
	}
	ch.Sessions += r.Sessions
	ch.Visitors += r.Visitors
	ch.B2BLeads += r.B2BLeads

	switch r.Channel {
	case trafficChannelAIAssistant:
		hero.AIVisits += r.Sessions
		hero.AIVisitors += r.Visitors
		if r.SourceName == "ChatGPT" {
			hero.ChatGPTVisits += r.Sessions
			hero.ChatGPTVisitors += r.Visitors
		}
	case trafficChannelGoogleSearch:
		hero.GoogleSearchVisits += r.Sessions
		hero.GoogleSearchVisitors += r.Visitors
	case trafficChannelOtherSearch:
		hero.OtherSearchVisits += r.Sessions
	}
}

func queryTrafficCountriesList(ctx context.Context, win biTimeWindow, resp *TrafficSourcesReportResponse) {
	sql := `WITH ` + trafficHumanSessionsCTE + `
		SELECT
			country_code,
			COUNT(*)::int AS sessions,
			COUNT(DISTINCT visitor_id)::int AS visitors,
			COALESCE(SUM(pv_cnt), 0)::int AS pageviews,
			COUNT(*) FILTER (WHERE channel = 'ai_assistant')::int AS ai_visits,
			COUNT(*) FILTER (WHERE channel = 'google_search')::int AS google_visits
		FROM classified_sessions
		GROUP BY country_code
		ORDER BY sessions DESC, visitors DESC
		LIMIT 15
	`
	rows, err := db.Pool.Query(ctx, sql, win.Since, win.Until)
	if err != nil {
		return
	}
	defer rows.Close()

	var totalSess int
	var list []TrafficCountryRow
	for rows.Next() {
		var item TrafficCountryRow
		if scanErr := rows.Scan(
			&item.CountryCode, &item.Sessions, &item.Visitors, &item.Pageviews,
			&item.AIVisits, &item.GoogleVisits,
		); scanErr == nil {
			item.CountryLabel = formatCountryLabel(item.CountryCode)
			totalSess += item.Sessions
			list = append(list, item)
		}
	}
	for i := range list {
		list[i].SharePct = safePct(list[i].Sessions, totalSess)
	}
	resp.TopCountries = list
}

func queryTrafficVisitsDailySeries(
	ctx context.Context,
	win biTimeWindow,
	dailyMap map[string]*TrafficDailyComparisonPoint,
) {
	sql := `WITH ` + trafficHumanSessionsCTE + `
		SELECT
			TO_CHAR(first_at AT TIME ZONE 'Europe/Istanbul', 'YYYY-MM-DD') AS day,
			COUNT(*) FILTER (WHERE channel = 'ai_assistant')::int AS ai_visits,
			COUNT(*) FILTER (WHERE channel = 'google_search')::int AS google_visits,
			COUNT(*) FILTER (WHERE channel NOT IN ('ai_assistant', 'google_search'))::int AS other_visits
		FROM classified_sessions
		GROUP BY day
		ORDER BY day ASC
	`
	rows, err := db.Pool.Query(ctx, sql, win.Since, win.Until)
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var day string
		var aiV, gV, oV int
		if scanErr := rows.Scan(&day, &aiV, &gV, &oV); scanErr == nil {
			pt := getOrInitDailyPoint(dailyMap, day)
			pt.AIVisits += aiV
			pt.GoogleVisits += gV
			pt.OtherVisits += oV
		}
	}
}

func populateTrafficLandingAndKeywords(ctx context.Context, win biTimeWindow, resp *TrafficSourcesReportResponse) {
	if db.Pool == nil {
		return
	}
	queryTrafficArrivalKeywords(ctx, win, resp)
	queryTrafficSourceLandings(ctx, win, resp)

	searchMining := queryBISearchMining(ctx, win)
	if len(searchMining.TopSearches) > 10 {
		resp.InternalKeywords = searchMining.TopSearches[:10]
	} else {
		resp.InternalKeywords = searchMining.TopSearches
	}
}

func queryTrafficArrivalKeywords(ctx context.Context, win biTimeWindow, resp *TrafficSourcesReportResponse) {
	sql := `WITH ` + trafficHumanSessionsCTE + `,
		kw_rows AS (
			SELECT
				TRIM(COALESCE(NULLIF(utm_term, ''), NULLIF(referrer_keyword, ''))) AS kw,
				CASE WHEN COALESCE(TRIM(utm_term), '') <> '' THEN 'paid_utm_term' ELSE 'referrer_query' END AS kw_type,
				source_name,
				COALESCE(NULLIF(utm_campaign, ''), '-') AS campaign,
				SPLIT_PART(entry_path, '?', 1) AS clean_path,
				visitor_id,
				first_at
			FROM classified_sessions
			WHERE COALESCE(TRIM(utm_term), '') <> '' OR COALESCE(TRIM(referrer_keyword), '') <> ''
		)
		SELECT
			MAX(kw) AS keyword,
			kw_type,
			source_name,
			MAX(campaign) AS campaign,
			COUNT(*)::int AS sessions,
			COUNT(DISTINCT visitor_id)::int AS visitors,
			COALESCE(MODE() WITHIN GROUP (ORDER BY clean_path), '/') AS top_landing_path,
			MAX(first_at) AS last_seen_at
		FROM kw_rows
		GROUP BY LOWER(kw), kw_type, source_name
		ORDER BY sessions DESC, last_seen_at DESC
		LIMIT 25
	`
	rows, err := db.Pool.Query(ctx, sql, win.Since, win.Until)
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var r TrafficArrivalKeywordRow
		if scanErr := rows.Scan(
			&r.Keyword, &r.KeywordType, &r.SourceName, &r.Campaign,
			&r.Sessions, &r.Visitors, &r.TopLandingPath, &r.LastSeenAt,
		); scanErr == nil {
			resp.ArrivalKeywords = append(resp.ArrivalKeywords, r)
		}
	}
}

func queryTrafficSourceLandings(ctx context.Context, win biTimeWindow, resp *TrafficSourcesReportResponse) {
	sql := `WITH ` + trafficHumanSessionsCTE + `
		SELECT
			source_name,
			channel,
			COALESCE(NULLIF(SPLIT_PART(entry_path, '?', 1), ''), '/') AS clean_path,
			COALESCE(MAX(NULLIF(entry_title, '')), '') AS page_title,
			COUNT(*)::int AS sessions,
			COUNT(DISTINCT visitor_id)::int AS visitors,
			COALESCE(SUM(prod_views), 0)::int AS product_views
		FROM classified_sessions
		WHERE channel IN ('ai_assistant', 'google_search', 'other_search', 'paid_ads')
		GROUP BY source_name, channel, clean_path
		ORDER BY sessions DESC, visitors DESC
		LIMIT 35
	`
	rows, err := db.Pool.Query(ctx, sql, win.Since, win.Until)
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var r TrafficSourceLandingRow
		if scanErr := rows.Scan(
			&r.SourceName, &r.Channel, &r.Path, &r.PageTitle,
			&r.Sessions, &r.Visitors, &r.ProductViews,
		); scanErr == nil {
			r.InferredTopic = inferTopicFromLandingPath(r.Path, r.PageTitle)
			resp.LandingIntents = append(resp.LandingIntents, r)
		}
	}
}

var localePathSegments = map[string]bool{
	"tr": true, "en": true, "de": true, "fr": true, "ru": true, "ar": true, "bg": true, "pl": true,
}

func inferTopicFromLandingPath(rawPath, pageTitle string) string {
	if cleanTitle := cleanTitleSuffix(pageTitle); cleanTitle != "" {
		return cleanTitle
	}
	clean := strings.Trim(strings.SplitN(strings.TrimSpace(rawPath), "?", 2)[0], "/")
	if clean == "" {
		return "Ana Sayfa (Vitrin)"
	}
	if unescaped, err := url.PathUnescape(clean); err == nil {
		clean = unescaped
	}
	parts := strings.Split(clean, "/")
	if len(parts) > 0 && localePathSegments[strings.ToLower(parts[0])] {
		parts = parts[1:]
	}
	if len(parts) == 0 {
		return "Ana Sayfa (" + strings.ToUpper(strings.Split(clean, "/")[0]) + ")"
	}
	if len(parts) >= 2 && (parts[0] == "product" || parts[0] == "blog" || parts[0] == "ureticiler") {
		return formatSlugToReadableTopic(parts[len(parts)-1])
	}
	lastSeg := parts[len(parts)-1]
	return formatSlugToReadableTopic(lastSeg)
}

func cleanTitleSuffix(title string) string {
	trimmed := strings.TrimSpace(title)
	if trimmed == "" {
		return ""
	}
	if idx := strings.Index(trimmed, " | "); idx > 3 {
		return strings.TrimSpace(trimmed[:idx])
	}
	return truncateStr(trimmed, 120)
}

func formatSlugToReadableTopic(slug string) string {
	words := strings.Split(strings.TrimSpace(slug), "-")
	if len(words) == 0 {
		return slug
	}
	readable := make([]string, 0, len(words))
	for _, w := range words {
		if w == "" {
			continue
		}
		readable = append(readable, w)
	}
	if len(readable) == 0 {
		return slug
	}
	return strings.Join(readable, " ")
}
