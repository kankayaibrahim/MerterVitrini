package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"mertervitrini/backend/pkg/logger"
)

func TestSanitizeQueryForLog(t *testing.T) {
	raw := "limit=24&q=Una%20Tutt&token=secret-abc&password=pw123&api_key=k999&display_currency=TRY"
	got := sanitizeQueryForLog(raw)
	for _, want := range []string{"limit=24", "q=Una%20Tutt", "token=[REDACTED]", "password=[REDACTED]", "api_key=[REDACTED]", "display_currency=TRY"} {
		if !strings.Contains(got, want) {
			t.Fatalf("expected sanitized query to contain %q, got %q", want, got)
		}
	}
	for _, secret := range []string{"secret-abc", "pw123", "k999"} {
		if strings.Contains(got, secret) {
			t.Fatalf("expected sanitized query to redact %q, got %q", secret, got)
		}
	}
}

func TestLoggingMiddlewareCapturesQueryBodyAndErrorDetail(t *testing.T) {
	var (
		gotSeverity string
		gotSource   string
		gotMessage  string
		gotDetail   string
		hookCalled  bool
	)
	logger.RegisterErrorHook(func(severity, source, message, stack string) {
		hookCalled = true
		gotSeverity = severity
		gotSource = source
		gotMessage = message
		gotDetail = stack
	})
	t.Cleanup(func() { logger.RegisterErrorHook(nil) })

	handler := LoggingMiddleware("text")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		SetRequestErrorDetail(r.Context(), "catalog products scan iteration error: context deadline exceeded")
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`{"error":"Failed to process products"}`))
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/store/products?limit=24&q=Una%20Tutt&token=abc", nil)
	req.Host = "api.mertervitrini.com.tr"
	req.Header.Set("Referer", "https://mertervitrini.com.tr/fr/tum-urunler")
	req.Header.Set("User-Agent", "TestAgent/1.0")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if !hookCalled {
		t.Fatal("expected logger error hook to be invoked on HTTP 500")
	}
	if gotSeverity != "http_5xx" || gotSource != "GET /api/v1/store/products" {
		t.Fatalf("unexpected severity/source: %q %q", gotSeverity, gotSource)
	}
	if !strings.Contains(gotMessage, "Query: ?limit=24&q=Una%20Tutt&token=[REDACTED]") {
		t.Fatalf("expected sanitized query in message, got %q", gotMessage)
	}
	if !strings.Contains(gotMessage, "context deadline exceeded") {
		t.Fatalf("expected internal error snippet in message, got %q", gotMessage)
	}
	for _, want := range []string{
		"Endpoint: GET /api/v1/store/products?limit=24&q=Una%20Tutt&token=[REDACTED]",
		"Referer: https://mertervitrini.com.tr/fr/tum-urunler",
		`Response Body: {"error":"Failed to process products"}`,
		"Internal Error: catalog products scan iteration error: context deadline exceeded",
	} {
		if !strings.Contains(gotDetail, want) {
			t.Fatalf("expected alert detail to contain %q, got:\n%s", want, gotDetail)
		}
	}
}
