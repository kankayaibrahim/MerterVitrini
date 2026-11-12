package handlers

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"mertervitrini/backend/config"
)

func TestReCaptchaPolicyPreventsLoginAndFormDeadlock(t *testing.T) {
	secretOnlyCfg := &config.Config{
		GoogleReCaptchaSecretKey: "prod-secret-only",
	}
	if secretOnlyCfg.HasReCaptchaPair() {
		t.Fatalf("expected HasReCaptchaPair=false when site_key is absent")
	}
	if secretOnlyCfg.PublicReCaptchaSiteKey() != "" {
		t.Fatalf("expected empty PublicReCaptchaSiteKey when site_key is absent")
	}

	if ok, err := verifyPublicFormReCaptcha(secretOnlyCfg, "", "login", false); err != nil || !ok {
		t.Fatalf("expected Login with empty captcha_token to succeed, got ok=%v err=%v", ok, err)
	}
	if ok, err := verifyPublicFormReCaptcha(secretOnlyCfg, "", "register", true); err != nil || !ok {
		t.Fatalf("expected Register with empty captcha_token to succeed when site_key is absent, got ok=%v err=%v", ok, err)
	}

	fullPairCfg := &config.Config{
		GoogleReCaptchaSecretKey: "prod-secret",
		GoogleReCaptchaSiteKey:   "prod-public-site-key",
	}
	if !fullPairCfg.HasReCaptchaPair() {
		t.Fatalf("expected HasReCaptchaPair=true when both keys exist")
	}
	if fullPairCfg.PublicReCaptchaSiteKey() != "prod-public-site-key" {
		t.Fatalf("unexpected PublicReCaptchaSiteKey: %s", fullPairCfg.PublicReCaptchaSiteKey())
	}
	if ok, err := verifyPublicFormReCaptcha(fullPairCfg, "", "login", false); err != nil || !ok {
		t.Fatalf("expected Login with empty captcha_token to stay unblocked even when pair exists, got ok=%v err=%v", ok, err)
	}
	if ok, err := verifyPublicFormReCaptcha(fullPairCfg, "", "register", true); err == nil || ok {
		t.Fatalf("expected Register with empty captcha_token to require token when full pair is configured")
	}
}

func TestResolveVisitorCountryNeverUsesURLPathLocale(t *testing.T) {
	reqNoGeo := httptest.NewRequest(http.MethodPost, "/api/v1/store/track", nil)
	reqNoGeo.RemoteAddr = "213.202.255.80:54321"

	for _, locale := range []string{"ru", "ar", "en", "de", "fr"} {
		got := resolveVisitorCountry(reqNoGeo, "", locale)
		if got != "TR" {
			t.Fatalf("locale %q leaked into country_code: got %q, want TR", locale, got)
		}
	}

	reqGeo := httptest.NewRequest(http.MethodPost, "/api/v1/store/track", nil)
	reqGeo.Header.Set("CF-IPCountry", "DE")
	if got := resolveVisitorCountry(reqGeo, "", "ru"); got != "DE" {
		t.Fatalf("expected GeoIP header DE, got %q", got)
	}
}

func TestSanitizeWebVitalOutliers(t *testing.T) {
	if got := sanitizeVitalMs(10024, maxValidINPMs); got != 0 {
		t.Fatalf("expected 10024ms INP outlier to be ignored (0), got %d", got)
	}
	if got := sanitizeVitalMs(180, maxValidINPMs); got != 180 {
		t.Fatalf("expected valid 180ms INP to remain 180, got %d", got)
	}
	if got := sanitizeVitalMs(45000, maxValidLCPMs); got != 0 {
		t.Fatalf("expected 45000ms LCP outlier to be ignored (0), got %d", got)
	}
	if got := sanitizeVitalMs(20000, maxValidTTFBMs); got != 0 {
		t.Fatalf("expected 20000ms TTFB outlier to be ignored (0), got %d", got)
	}
}

func TestDetectSEOAndAICrawlers(t *testing.T) {
	cases := []struct {
		ua      string
		wantBot bool
		wantID  string
	}{
		{"Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", true, botNameGooglebot},
		{"Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)", true, botNameYandexBot},
		{"Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.1", true, "GPTBot"},
		{"Mozilla/5.0 AppleWebKit/537.36; compatible; ClaudeBot/1.0; +claudebot@anthropic.com", true, "ClaudeBot"},
		{"Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)", true, "PerplexityBot"},
		{"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36", false, ""},
	}
	for _, tc := range cases {
		ok, name := DetectSEOOrAIBot(tc.ua)
		if ok != tc.wantBot || name != tc.wantID {
			t.Fatalf("DetectSEOOrAIBot(%q) = (%v, %q), want (%v, %q)", tc.ua, ok, name, tc.wantBot, tc.wantID)
		}
	}

	feedPath := "/api/v1/store/feeds/google-merchant.xml"
	if !isBotLoggableStorePath(feedPath) {
		t.Fatalf("expected XML feed path %s to be bot-loggable", feedPath)
	}
	if got := mapStoreAPIToPublicPath("/api/v1/store/products/kadin-elbise", url.Values{}); got != "/product/kadin-elbise" {
		t.Fatalf("unexpected mapped product path: %s", got)
	}
}

func TestMemberJourneyConsistencyHelpers(t *testing.T) {
	if s := resolveCustomerStatusLabel(true, false); s != "active" {
		t.Fatalf("expected active status, got %s", s)
	}
	if s := resolveCustomerStatusLabel(true, true); s != "blocked" {
		t.Fatalf("expected blocked status, got %s", s)
	}
	if !isJourneyPageVisitEvent(MemberTimelineEvent{EventType: "product_view", EventCategory: "catalog"}) {
		t.Fatalf("expected product_view to count as visited page")
	}
	if isJourneyPageVisitEvent(MemberTimelineEvent{EventType: "login", EventCategory: "auth"}) {
		t.Fatalf("expected login auth event not to count as visited page")
	}
}
