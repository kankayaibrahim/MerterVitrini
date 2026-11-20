package handlers

import (
	"testing"
	"time"
)

func TestMapKnownReferrerHostAIAndSearch(t *testing.T) {
	cases := []struct {
		rawRef string
		want   string
	}{
		{"https://chatgpt.com/", "ChatGPT"},
		{"https://chat.openai.com/c/123", "ChatGPT"},
		{"https://www.perplexity.ai/search/merter", "Perplexity"},
		{"https://claude.ai/chat/abc", "Claude"},
		{"https://gemini.google.com/app", "Gemini"},
		{"https://copilot.microsoft.com/", "Microsoft Copilot"},
		{"https://www.google.com/search?q=toptan+abiye", "Google Arama"},
		{"https://yandex.com.tr/search/?text=toptan+giyim", "Yandex Arama"},
		{"https://www.bing.com/", "Bing Arama"},
		{"https://duckduckgo.com/?q=wholesale+dress", "DuckDuckGo"},
		{"https://search.brave.com/search?q=turkey+clothing", "Brave Search"},
		{"https://mertervitrini.com.tr/tr/kadin-giyim", directReferrerLabel},
	}

	for _, tc := range cases {
		if got := parseReferrerHost(tc.rawRef); got != tc.want {
			t.Fatalf("parseReferrerHost(%q) = %q, want %q", tc.rawRef, got, tc.want)
		}
	}
}

func TestExtractReferrerSearchKeyword(t *testing.T) {
	if got := extractReferrerSearchKeyword("https://www.google.com/search?q=toptan+keten+takim&hl=tr"); got != "toptan keten takim" {
		t.Fatalf("unexpected google keyword: %q", got)
	}
	if got := extractReferrerSearchKeyword("https://yandex.com.tr/search/?text=merter%20toptan"); got != "merter toptan" {
		t.Fatalf("unexpected yandex keyword: %q", got)
	}
	if got := extractReferrerSearchKeyword("https://mertervitrini.com.tr/tum-urunler?q=elbise"); got != "" {
		t.Fatalf("expected same-site referrer query to be ignored, got %q", got)
	}
	if got := extractReferrerSearchKeyword("https://chatgpt.com/"); got != "" {
		t.Fatalf("expected bare AI referrer without query to return empty keyword, got %q", got)
	}
}

func TestInferTopicFromLandingPathAndDateRange(t *testing.T) {
	if got := inferTopicFromLandingPath("/tr/kadin-giyim/takim-tulum/ikili-takim", ""); got != "ikili takim" {
		t.Fatalf("unexpected topic from category path: %q", got)
	}
	if got := inferTopicFromLandingPath("/en/product/kadin-keten-elbise-123", "Keten Elbise Toptan | Merter Vitrini"); got != "Keten Elbise Toptan" {
		t.Fatalf("unexpected topic from page title: %q", got)
	}
	if got := inferTopicFromLandingPath("/en", ""); got != "Ana Sayfa (EN)" {
		t.Fatalf("unexpected root locale topic: %q", got)
	}

	loc := istanbulLocation()
	since := time.Date(2026, 11, 9, 0, 0, 0, 0, loc)
	until := time.Date(2026, 11, 15, 23, 59, 0, 0, loc)
	if got := formatTurkishDateRange(since, until); got != "9 ilâ 15 Kasım 2026" {
		t.Fatalf("unexpected Turkish date range: %q", got)
	}
}
