package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestBuildProductIndexNowURLs(t *testing.T) {
	slugs := []string{
		"  /erkek-triko-kazak-1a2b/ ",
		"erkek-triko-kazak-1a2b",
		"",
		"   ",
		"kadin elbise 9x8y",
	}

	urls, productCount := BuildProductIndexNowURLs(slugs)
	if productCount != 2 {
		t.Fatalf("expected 2 unique valid products, got %d", productCount)
	}

	expectedLen := 2 * 8
	if len(urls) != expectedLen {
		t.Fatalf("expected %d localized URLs, got %d", expectedLen, len(urls))
	}

	expectedFirst := "https://mertervitrini.com.tr/product/erkek-triko-kazak-1a2b"
	if urls[0] != expectedFirst {
		t.Fatalf("expected first URL %q, got %q", expectedFirst, urls[0])
	}
	expectedLast := "https://mertervitrini.com.tr/product/kadin%20elbise%209x8y?lang=bg"
	if urls[len(urls)-1] != expectedLast {
		t.Fatalf("expected last URL %q, got %q", expectedLast, urls[len(urls)-1])
	}
}

func TestNormalizeAndChunkIndexNowURLs(t *testing.T) {
	raw := []string{
		"",
		"  ",
		"/product/relative-path",
		"ftp://mertervitrini.com.tr/file.xml",
		"https://mertervitrini.com.tr/product/a",
		"  https://mertervitrini.com.tr/product/a  ",
		"http://mertervitrini.com.tr/product/b",
	}

	chunks := NormalizeAndChunkIndexNowURLs(raw, 0)
	if len(chunks) != 1 {
		t.Fatalf("expected 1 chunk, got %d", len(chunks))
	}
	if len(chunks[0]) != 2 {
		t.Fatalf("expected 2 valid deduplicated URLs, got %d (%v)", len(chunks[0]), chunks[0])
	}

	bulk := make([]string, 0, 25003)
	for i := 0; i < 25003; i++ {
		bulk = append(bulk, fmt.Sprintf("https://mertervitrini.com.tr/product/item-%d", i))
	}
	bulkChunks := NormalizeAndChunkIndexNowURLs(bulk, indexNowMaxChunkSize)
	if len(bulkChunks) != 3 {
		t.Fatalf("expected 3 chunks for 25003 URLs, got %d", len(bulkChunks))
	}
	if len(bulkChunks[0]) != 10000 || len(bulkChunks[1]) != 10000 || len(bulkChunks[2]) != 5003 {
		t.Fatalf("unexpected chunk sizes: %d, %d, %d", len(bulkChunks[0]), len(bulkChunks[1]), len(bulkChunks[2]))
	}
}

func TestPostIndexNowChunkFailoverOn403(t *testing.T) {
	firstCalled := false
	srvForbidden := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		firstCalled = true
		w.WriteHeader(http.StatusForbidden)
		_, _ = w.Write([]byte(`{"errorCode":"UserForbiddedToAccessSite"}`))
	}))
	defer srvForbidden.Close()

	var capturedPayload IndexNowRequest
	var capturedUA string
	srvAccepted := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedUA = r.Header.Get("User-Agent")
		if err := json.NewDecoder(r.Body).Decode(&capturedPayload); err != nil {
			t.Fatalf("failed to decode payload: %v", err)
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"success":true}`))
	}))
	defer srvAccepted.Close()

	endpoints := []IndexNowEndpoint{
		{Name: "primary.forbidden.test", URL: srvForbidden.URL},
		{Name: "yandex.fallback.test", URL: srvAccepted.URL},
	}

	testURL := "https://mertervitrini.com.tr/product/test-elbise"
	code, msg, err := postIndexNowChunkWithEndpoints(context.Background(), []string{testURL}, endpoints, srvAccepted.Client())
	if err != nil {
		t.Fatalf("expected failover success, got error: %v (msg=%s)", err, msg)
	}
	if !firstCalled {
		t.Fatalf("expected primary endpoint to be tried first")
	}
	if code != http.StatusOK {
		t.Fatalf("expected HTTP 200 after failover, got %d", code)
	}
	if !strings.Contains(msg, "yandex.fallback.test") {
		t.Fatalf("expected response message to mention fallback endpoint name, got %q", msg)
	}
	if capturedUA != indexNowUserAgent {
		t.Fatalf("expected User-Agent %q, got %q", indexNowUserAgent, capturedUA)
	}
	if capturedPayload.Host != indexNowHost || capturedPayload.Key != indexNowKey || capturedPayload.KeyLocation != indexNowKeyLocation {
		t.Fatalf("unexpected IndexNow payload metadata: %+v", capturedPayload)
	}
	if len(capturedPayload.URLList) != 1 || capturedPayload.URLList[0] != testURL {
		t.Fatalf("unexpected urlList: %+v", capturedPayload.URLList)
	}
}

func TestPostIndexNowChunkNoRetryOn422(t *testing.T) {
	srvUnprocessable := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnprocessableEntity)
		_, _ = w.Write([]byte(`{"errorCode":"InvalidUrl"}`))
	}))
	defer srvUnprocessable.Close()

	secondCalled := false
	srvSecond := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		secondCalled = true
		w.WriteHeader(http.StatusOK)
	}))
	defer srvSecond.Close()

	endpoints := []IndexNowEndpoint{
		{Name: "primary.422.test", URL: srvUnprocessable.URL},
		{Name: "secondary.should-not-run", URL: srvSecond.URL},
	}

	code, msg, err := postIndexNowChunkWithEndpoints(
		context.Background(),
		[]string{"https://mertervitrini.com.tr/product/bad-url"},
		endpoints,
		srvUnprocessable.Client(),
	)
	if err == nil {
		t.Fatalf("expected error on HTTP 422")
	}
	if secondCalled {
		t.Fatalf("expected no retry on secondary endpoint after HTTP 422")
	}
	if code != http.StatusUnprocessableEntity {
		t.Fatalf("expected HTTP 422, got %d (msg=%s)", code, msg)
	}
}

func TestServeKeyFile(t *testing.T) {
	h := NewIndexNowHandler()
	req := httptest.NewRequest(http.MethodGet, IndexNowKeyVerificationPath, nil)
	rec := httptest.NewRecorder()

	h.ServeKeyFile(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected HTTP 200, got %d", rec.Code)
	}
	body := rec.Body.String()
	if body != indexNowKey || len(body) != 32 {
		t.Fatalf("expected exact 32-byte key %q, got %q (len=%d)", indexNowKey, body, len(body))
	}
	if ct := rec.Header().Get(headerContentType); !strings.Contains(ct, "text/plain") {
		t.Fatalf("expected text/plain content type, got %q", ct)
	}
}

func TestNormalizeLangCode2(t *testing.T) {
	cases := []struct {
		in   string
		want string
	}{
		{"en_US", "en"},
		{"ar_001", "ar"},
		{"tr_TR", "tr"},
		{"PL", "pl"},
		{"  fr-FR ", "fr"},
		{"", ""},
	}
	for _, tc := range cases {
		if got := normalizeLangCode2(tc.in); got != tc.want {
			t.Fatalf("normalizeLangCode2(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}
}

func TestBuildCategoryTrailURLs(t *testing.T) {
	cats := []indexNowCategoryNode{
		{ID: "c1", ParentID: "", Slug: "kadin-giyim"},
		{ID: "c2", ParentID: "c1", Slug: "ust-giyim"},
		{ID: "c3", ParentID: "c2", Slug: "bluz"},
	}

	urls := BuildCategoryTrailURLs(cats)
	expectedTotal := 3 * len(indexNowAllLangs)
	if len(urls) != expectedTotal {
		t.Fatalf("expected %d category URLs, got %d", expectedTotal, len(urls))
	}

	wanted := "https://mertervitrini.com.tr/en/kadin-giyim/ust-giyim/bluz"
	found := false
	for _, u := range urls {
		if u == wanted {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("expected hierarchical category URL %q in %v", wanted, urls)
	}
}

func TestBuildBrandBlogAndStaticIndexNowURLs(t *testing.T) {
	brandURLs := BuildBrandIndexNowURLs([]string{"lustrin-toptan-tekstil"})
	if len(brandURLs) != 2*len(indexNowAllLangs) {
		t.Fatalf("expected %d brand URLs, got %d", 2*len(indexNowAllLangs), len(brandURLs))
	}
	if brandURLs[0] != "https://mertervitrini.com.tr/ureticiler/lustrin-toptan-tekstil" {
		t.Fatalf("unexpected brand URL[0]: %q", brandURLs[0])
	}

	blogURLs := BuildBlogIndexNowURLs([]indexNowBlogRow{
		{
			ID:       "b1",
			BaseSlug: "toptan-sezon-trendleri",
			SlugsByLng: map[string]string{
				"tr": "toptan-sezon-trendleri",
				"en": "wholesale-season-trends",
			},
		},
	})
	if len(blogURLs) != len(indexNowAllLangs) {
		t.Fatalf("expected %d blog URLs, got %d", len(indexNowAllLangs), len(blogURLs))
	}
	hasLocalized := false
	for _, u := range blogURLs {
		if u == "https://mertervitrini.com.tr/en/blog/wholesale-season-trends" {
			hasLocalized = true
			break
		}
	}
	if !hasLocalized {
		t.Fatalf("expected localized blog URL in %v", blogURLs)
	}

	staticURLs := BuildStaticAndCMSIndexNowURLs([]string{"hakkimizda", "iletisim-rehberi"})
	if len(staticURLs) == 0 || staticURLs[0] != "https://mertervitrini.com.tr" {
		t.Fatalf("expected root site URL first, got %v", staticURLs)
	}
}

func TestChunkProductRefs(t *testing.T) {
	items := make([]indexNowProductRef, 0, 2600)
	for i := 0; i < 2600; i++ {
		items = append(items, indexNowProductRef{
			ID:   fmt.Sprintf("id-%d", i),
			Slug: fmt.Sprintf("urun-%d", i),
		})
	}
	chunks := chunkProductRefs(items, indexNowProductsPerChunk)
	if len(chunks) != 3 {
		t.Fatalf("expected 3 chunks of <=1250 products, got %d", len(chunks))
	}
	if len(chunks[0]) != 1250 || len(chunks[1]) != 1250 || len(chunks[2]) != 100 {
		t.Fatalf("unexpected product chunk lengths: %d, %d, %d", len(chunks[0]), len(chunks[1]), len(chunks[2]))
	}
}
