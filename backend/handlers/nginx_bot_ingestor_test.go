package handlers

import (
	"testing"
	"time"
)

func TestClassifyBotUserAgentExpandedSignatures(t *testing.T) {
	cases := []struct {
		ua       string
		wantBot  bool
		wantName string
		wantCat  string
	}{
		{"Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.4; +https://openai.com/gptbot)", true, "GPTBot", BotCategoryAI},
		{"Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot", true, "OAI-SearchBot", BotCategoryAI},
		{"Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot", true, "ChatGPT-User", BotCategoryAI},
		{"Mozilla/5.0 AppleWebKit/537.36; compatible; ClaudeBot/1.0; +claudebot@anthropic.com", true, "ClaudeBot", BotCategoryAI},
		{"Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)", true, "PerplexityBot", BotCategoryAI},
		{"Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); Google-Extended", true, "Google-Extended", BotCategoryAI},
		{"Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; Amazonbot/0.1; +https://developer.amazon.com/support/amazonbot", true, "Amazonbot", BotCategoryAI},
		{"Mozilla/5.0 (compatible; Meta-ExternalAgent/1.1; +https://developers.facebook.com/docs/sharing/webmasters/crawler)", true, "Meta-ExternalAgent", BotCategoryAI},
		{"Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", true, botNameGooglebot, BotCategoryGoogle},
		{"Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)", true, "Bingbot", BotCategorySearch},
		{"Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)", true, botNameYandexBot, BotCategorySearch},
		{"Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)", true, "SemrushBot", BotCategorySEO},
		{"Mozilla/5.0 (compatible; QlyzeBot/1.0; +https://app.qlyze.io/bot)", true, "QlyzeBot", BotCategorySEO},
		{"facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)", true, botNameFacebookExt, BotCategorySocial},
		{"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36", false, "", ""},
	}

	for _, tc := range cases {
		gotBot, gotName, gotCat := ClassifyBotUserAgent(tc.ua)
		if gotBot != tc.wantBot || gotName != tc.wantName || gotCat != tc.wantCat {
			t.Fatalf("ClassifyBotUserAgent(%q) = (%v, %q, %q), want (%v, %q, %q)",
				tc.ua, gotBot, gotName, gotCat, tc.wantBot, tc.wantName, tc.wantCat)
		}
	}
}

func TestParseNginxMainLogLineAndFiltering(t *testing.T) {
	botLine := `172.68.244.203 - - [20/Nov/2026:05:12:15 +0300] "GET /product/kadin-keten-ikili-takim-5t6b?lang=tr HTTP/2.0" 200 6337 "https://mertervitrini.com.tr/" "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.4; +https://openai.com/gptbot)" "85.208.96.196"`
	parsed, ok := parseNginxMainLogLine(botLine)
	if !ok {
		t.Fatalf("expected valid nginx log line to parse")
	}
	if parsed.method != "GET" || parsed.statusCode != 200 {
		t.Fatalf("unexpected method/status: %s %d", parsed.method, parsed.statusCode)
	}

	cleanPath, botName, cat, ingest := shouldIngestNginxBotHit(parsed.method, parsed.rawTarget, parsed.userAgent)
	if !ingest || cleanPath != "/product/kadin-keten-ikili-takim-5t6b" || botName != "GPTBot" || cat != BotCategoryAI {
		t.Fatalf("unexpected ingest result: ingest=%v path=%q bot=%q cat=%q", ingest, cleanPath, botName, cat)
	}

	ssrLine := `172.69.109.226 - - [20/Nov/2026:05:13:04 +0300] "GET /api/v1/store/blog/sefyu HTTP/2.0" 200 18638 "-" "node" "2001:4ba0:cafe:8e::1"`
	pSSR, okSSR := parseNginxMainLogLine(ssrLine)
	if !okSSR {
		t.Fatalf("expected SSR internal log line to parse")
	}
	if _, _, _, shouldLog := shouldIngestNginxBotHit(pSSR.method, pSSR.rawTarget, pSSR.userAgent); shouldLog {
		t.Fatalf("expected internal Next.js node UA to be excluded")
	}

	staticTarget := "/_next/static/chunks/app.js"
	if _, _, _, shouldLog := shouldIngestNginxBotHit("GET", staticTarget, parsed.userAgent); shouldLog {
		t.Fatalf("expected static asset %s to be excluded", staticTarget)
	}

	sitemapTarget := "/sitemap/0.xml"
	if cp, _, _, shouldLog := shouldIngestNginxBotHit("GET", sitemapTarget, parsed.userAgent); !shouldLog || cp != sitemapTarget {
		t.Fatalf("expected sitemap %s to be ingested", sitemapTarget)
	}

	chunk := []byte(botLine + "\n" + ssrLine + "\n")
	aggs := aggregateNginxLogChunk(chunk)
	if len(aggs) != 1 {
		t.Fatalf("expected 1 aggregated key from chunk, got %d", len(aggs))
	}
	expectedHour := parsed.timestamp.UTC().Truncate(time.Hour)
	k := botHourlyAggKey{bucketHour: expectedHour, botName: "GPTBot", path: "/product/kadin-keten-ikili-takim-5t6b", statusClass: "2xx"}
	if aggs[k] == nil || aggs[k].hits != 1 {
		t.Fatalf("expected aggregated hit count 1 at %v, got %+v", k, aggs[k])
	}
}
