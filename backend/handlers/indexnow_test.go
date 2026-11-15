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
