package middleware

import (
	"encoding/json"
	"fmt"
	"net/http"
	"runtime/debug"
	"time"

	"mertervitrini/backend/pkg/logger"
)

// RecoveryMiddleware provides robust global panic recovery for all HTTP requests.
// It catches any runtime panic, logs the full stack trace to the daily error file,
// and returns a clean 500 JSON error response to the client without terminating the process.
func RecoveryMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				stack := debug.Stack()
				ip := getClientIP(r)
				ua := r.Header.Get("User-Agent")

				contextMsg := fmt.Sprintf("HTTP Request Panic: %s %s (Client IP: %s, UA: %s)", r.Method, r.URL.RequestURI(), ip, ua)
				logger.LogPanic(contextMsg, rec, stack)

				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				_ = json.NewEncoder(w).Encode(map[string]any{
					"error":     "Beklenmeyen bir sunucu hatası oluştu. Sistem yöneticisine bildirildi.",
					"status":    http.StatusInternalServerError,
					"path":      r.URL.Path,
					"timestamp": time.Now().UTC().Format(time.RFC3339),
				})
			}
		}()

		next.ServeHTTP(w, r)
	})
}
