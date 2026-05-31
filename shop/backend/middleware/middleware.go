package middleware

import (
	"context"
	"encoding/json"
	"log"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

type contextKey string

const (
	LogContextKey contextKey = "log_container"
)

type LogContainer struct {
	ClientIP string
}

type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

func (rw *responseWriter) Write(b []byte) (int, error) {
	if rw.statusCode == 0 {
		rw.statusCode = http.StatusOK
	}
	return rw.ResponseWriter.Write(b)
}

func getClientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[0])
	}
	if rip := r.Header.Get("X-Real-IP"); rip != "" {
		return rip
	}
	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return ip
}

// Memory-based IP rate limiter configuration
type ipRateLimiter struct {
	ips map[string][]time.Time
	mu  sync.Mutex
}

var rateLimiter = &ipRateLimiter{
	ips: make(map[string][]time.Time),
}

// RateLimitMiddleware restricts requests to 7 per minute per IP for sensitive auth routes.
func RateLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		// Monitor sensitive endpoints: login & register
		if strings.HasSuffix(path, "/auth/login") || strings.HasSuffix(path, "/auth/register") {
			ip := getClientIP(r)
			now := time.Now()
			oneMinuteAgo := now.Add(-1 * time.Minute)

			rateLimiter.mu.Lock()
			// Clean up old timestamps for this IP
			var validTimes []time.Time
			for _, t := range rateLimiter.ips[ip] {
				if t.After(oneMinuteAgo) {
					validTimes = append(validTimes, t)
				}
			}

			// Check limit: max 7 attempts per minute
			if len(validTimes) >= 7 {
				rateLimiter.mu.Unlock()
				log.Printf("[RATE LIMIT EXCEEDED] IP: %s attempted too many sensitive auth requests (%s).", ip, path)
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusTooManyRequests)
				w.Write([]byte(`{"error":"Çok fazla istek gönderildi. Lütfen 1 dakika sonra tekrar deneyin."}`))
				return
			}

			// Add current timestamp
			validTimes = append(validTimes, now)
			rateLimiter.ips[ip] = validTimes
			rateLimiter.mu.Unlock()
		}

		next.ServeHTTP(w, r)
	})
}

func LoggingMiddleware(logFormat string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			rw := &responseWriter{ResponseWriter: w}

			container := &LogContainer{}
			ctx := context.WithValue(r.Context(), LogContextKey, container)

			next.ServeHTTP(rw, r.WithContext(ctx))

			duration := time.Since(start)
			ip := getClientIP(r)

			if logFormat == "json" {
				logEntry := map[string]any{
					"time":        time.Now().UTC().Format(time.RFC3339),
					"level":       "INFO",
					"component":   "storefront-api",
					"client_ip":   ip,
					"method":      r.Method,
					"path":        r.URL.Path,
					"proto":       r.Proto,
					"status":      rw.statusCode,
					"duration_ms": float64(duration.Microseconds()) / 1000.0,
					"user_agent":  r.Header.Get("User-Agent"),
				}
				jsonBytes, err := json.Marshal(logEntry)
				if err == nil {
					log.Println(string(jsonBytes))
				} else {
					log.Printf("[STORE ERROR] Failed to serialize JSON log: %v", err)
				}
			} else {
				ua := r.Header.Get("User-Agent")
				if len(ua) > 50 {
					ua = ua[:47] + "..."
				}
				if ua == "" {
					ua = "unknown"
				}

				log.Printf("[STORE] %s - %s %s %s | Status: %d | Duration: %.2fms | UA: %s",
					ip, r.Method, r.URL.Path, r.Proto, rw.statusCode,
					float64(duration.Microseconds())/1000.0, ua)
			}
		})
	}
}

func CORSMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Expose-Headers", "Content-Length")
		w.Header().Set("Access-Control-Allow-Credentials", "true")

		// Strict security headers
		w.Header().Set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-XSS-Protection", "1; mode=block")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}
