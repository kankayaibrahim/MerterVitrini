package middleware

import (
	"context"
	"crypto/rsa"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"mertervitrini/backend/models"
)

type contextKey string

const (
	UserContextKey      contextKey = "user"
	LogContextKey       contextKey = "log_container"
	headerContentType              = "Content-Type"
	mimeApplicationJSON            = "application/json"
)

// LogContainer holds mutable request log metadata shared across middleware boundaries
type LogContainer struct {
	UserEmail string
	UserRole  string
	ClientIP  string
}

// GetUserFromContext extracts authenticated user info from context
func GetUserFromContext(ctx context.Context) (*models.UserInfo, bool) {
	u, ok := ctx.Value(UserContextKey).(*models.UserInfo)
	return u, ok
}

// responseWriter is a wrapper to capture HTTP status codes
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

// getClientIP extracts real client IP address checking proxies
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

func logJSON(r *http.Request, ip string, container *LogContainer, statusCode int, duration time.Duration) {
	userEmail := container.UserEmail
	userRole := container.UserRole
	if userEmail == "" {
		userEmail = "anonymous"
		userRole = "anonymous"
	}

	logEntry := map[string]any{
		"time":        time.Now().UTC().Format(time.RFC3339),
		"level":       "INFO",
		"component":   "api",
		"client_ip":   ip,
		"user_email":  userEmail,
		"user_role":   userRole,
		"method":      r.Method,
		"path":        r.URL.Path,
		"proto":       r.Proto,
		"status":      statusCode,
		"duration_ms": float64(duration.Microseconds()) / 1000.0,
		"user_agent":  r.Header.Get("User-Agent"),
	}

	jsonBytes, err := json.Marshal(logEntry)
	if err != nil {
		log.Printf("[API ERROR] Failed to serialize JSON log: %v", err)
		return
	}
	log.Println(string(jsonBytes))
}

func logText(r *http.Request, ip string, container *LogContainer, statusCode int, duration time.Duration) {
	userText := "anonymous"
	if container.UserEmail != "" {
		userText = fmt.Sprintf("%s (%s)", container.UserEmail, container.UserRole)
	}

	ua := r.Header.Get("User-Agent")
	if len(ua) > 50 {
		ua = ua[:47] + "..."
	}
	if ua == "" {
		ua = "unknown"
	}

	log.Printf("[API] %s - [%s] %s %s %s | Status: %d | Duration: %.2fms | UA: %s",
		ip, userText, r.Method, r.URL.Path, r.Proto, statusCode,
		float64(duration.Microseconds())/1000.0, ua)
}

// LoggingMiddleware logs HTTP requests, execution time, and client context details in either Text or JSON format
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
				logJSON(r, ip, container, rw.statusCode, duration)
			} else {
				logText(r, ip, container, rw.statusCode, duration)
			}
		})
	}
}

// CORSMiddleware handles CORS preflight and headers
func CORSMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
		w.Header().Set("Access-Control-Expose-Headers", "Content-Length")
		w.Header().Set("Access-Control-Allow-Credentials", "true")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// Memory-based IP rate limiter configuration
type ipRateLimiter struct {
	ips map[string][]time.Time
	mu  sync.Mutex
}

var rateLimiter = &ipRateLimiter{
	ips: make(map[string][]time.Time),
}

// RateLimitMiddleware restricts requests to 15 per minute per IP for sensitive auth routes
func RateLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		if strings.HasSuffix(path, "/auth/login") || strings.HasSuffix(path, "/auth/register") {
			ip := getClientIP(r)
			now := time.Now()
			oneMinuteAgo := now.Add(-1 * time.Minute)

			rateLimiter.mu.Lock()
			var validTimes []time.Time
			for _, t := range rateLimiter.ips[ip] {
				if t.After(oneMinuteAgo) {
					validTimes = append(validTimes, t)
				}
			}

			if len(validTimes) >= 15 {
				rateLimiter.mu.Unlock()
				log.Printf("[RATE LIMIT EXCEEDED] IP: %s attempted too many sensitive auth requests (%s).", ip, path)
				w.Header().Set(headerContentType, mimeApplicationJSON)
				w.WriteHeader(http.StatusTooManyRequests)
				w.Write([]byte(`{"error":"Çok fazla istek gönderildi. Lütfen 1 dakika sonra tekrar deneyin."}`))
				return
			}

			validTimes = append(validTimes, now)
			rateLimiter.ips[ip] = validTimes
			rateLimiter.mu.Unlock()
		}

		next.ServeHTTP(w, r)
	})
}

type keycloakKeyProvider struct {
	rawKey string
	pubKey *rsa.PublicKey
	err    error
	once   sync.Once
}

func formatPEMBlock(rawKey string) string {
	if strings.Contains(rawKey, "-----BEGIN PUBLIC KEY-----") {
		return rawKey
	}
	clean := strings.ReplaceAll(rawKey, "\n", "")
	clean = strings.ReplaceAll(clean, "\r", "")
	clean = strings.ReplaceAll(clean, " ", "")

	var sb strings.Builder
	sb.WriteString("-----BEGIN PUBLIC KEY-----\n")
	for len(clean) > 0 {
		chunkSize := 64
		if len(clean) < chunkSize {
			chunkSize = len(clean)
		}
		sb.WriteString(clean[:chunkSize])
		sb.WriteByte('\n')
		clean = clean[chunkSize:]
	}
	sb.WriteString("-----END PUBLIC KEY-----")
	return sb.String()
}

func loadKeycloakRSAPublicKey(keycloakPublicKey string) (*rsa.PublicKey, error) {
	if keycloakPublicKey == "" {
		return nil, errors.New("keycloak public key is empty")
	}
	pemBlock := formatPEMBlock(keycloakPublicKey)
	pub, err := jwt.ParseRSAPublicKeyFromPEM([]byte(pemBlock))
	if err != nil {
		return nil, fmt.Errorf("failed to parse RSA public key from PEM: %w", err)
	}
	log.Println("[AUTH] Keycloak RSA Public Key successfully loaded and parsed.")
	return pub, nil
}

func (p *keycloakKeyProvider) GetKey() (*rsa.PublicKey, error) {
	p.once.Do(func() {
		p.pubKey, p.err = loadKeycloakRSAPublicKey(p.rawKey)
		if p.err != nil {
			log.Printf("[AUTH ERROR] %v", p.err)
		}
	})
	return p.pubKey, p.err
}

func extractBearerToken(authHeader string) (string, error) {
	if authHeader == "" {
		return "", errors.New("Missing authorization header")
	}
	parts := strings.Split(authHeader, " ")
	if len(parts) != 2 || !strings.EqualFold(parts[0], "bearer") {
		return "", errors.New("Invalid authorization format. Use 'Bearer <token>'")
	}
	return parts[1], nil
}

func makeKeyFunc(jwtSecret string, keyProvider *keycloakKeyProvider) jwt.Keyfunc {
	return func(token *jwt.Token) (interface{}, error) {
		alg, _ := token.Header["alg"].(string)
		if strings.EqualFold(alg, "RS256") {
			pubKey, err := keyProvider.GetKey()
			if err != nil {
				return nil, fmt.Errorf("RS256 verification failed: %w", err)
			}
			return pubKey, nil
		}

		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(jwtSecret), nil
	}
}

func extractUserRole(claims jwt.MapClaims) models.UserRole {
	role := models.RoleAdmin

	if realmAccess, ok := claims["realm_access"].(map[string]any); ok {
		if roles, ok := realmAccess["roles"].([]any); ok {
			for _, r := range roles {
				roleStr := strings.ToLower(fmt.Sprintf("%v", r))
				switch models.UserRole(roleStr) {
				case models.RoleSuperAdmin, models.RoleAdmin, models.RoleEditor,
					models.RoleSalesManager, models.RoleWarehouse, models.RoleCustomer:
					role = models.UserRole(roleStr)
				}
			}
		}
	}

	if legacyRole, ok := claims["role"].(string); ok && legacyRole != "" {
		role = models.UserRole(legacyRole)
	}

	return role
}

func extractClaimString(claims jwt.MapClaims, keys ...string) string {
	for _, key := range keys {
		if val, ok := claims[key].(string); ok && val != "" {
			return val
		}
	}
	return ""
}

func parseUserInfoFromClaims(claims jwt.MapClaims) *models.UserInfo {
	return &models.UserInfo{
		ID:        extractClaimString(claims, "sub"),
		FirstName: extractClaimString(claims, "given_name", "first_name"),
		LastName:  extractClaimString(claims, "family_name", "last_name"),
		Email:     extractClaimString(claims, "email"),
		Role:      extractUserRole(claims),
	}
}

// AuthMiddleware validates JWT Bearer tokens supporting both RS256 (Keycloak) and HS256 (Local fallback)
func AuthMiddleware(jwtSecret string, keycloakPublicKey string) func(http.Handler) http.Handler {
	keyProvider := &keycloakKeyProvider{rawKey: keycloakPublicKey}
	if keycloakPublicKey != "" {
		go keyProvider.GetKey()
	}

	keyFunc := makeKeyFunc(jwtSecret, keyProvider)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			tokenStr, err := extractBearerToken(r.Header.Get("Authorization"))
			if err != nil {
				http.Error(w, fmt.Sprintf(`{"error":%q}`, err.Error()), http.StatusUnauthorized)
				return
			}

			token, err := jwt.Parse(tokenStr, keyFunc)
			if err != nil || !token.Valid {
				http.Error(w, fmt.Sprintf(`{"error":"Invalid or expired token: %v"}`, err), http.StatusUnauthorized)
				return
			}

			claims, ok := token.Claims.(jwt.MapClaims)
			if !ok {
				http.Error(w, `{"error":"Invalid token claims"}`, http.StatusUnauthorized)
				return
			}

			user := parseUserInfoFromClaims(claims)

			if container, ok := r.Context().Value(LogContextKey).(*LogContainer); ok {
				container.UserEmail = user.Email
				container.UserRole = string(user.Role)
			}

			ctx := context.WithValue(r.Context(), UserContextKey, user)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequireRole enforces specific roles on route handlers
func RequireRole(roles ...models.UserRole) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, ok := GetUserFromContext(r.Context())
			if !ok {
				http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
				return
			}

			roleAllowed := false
			for _, r := range roles {
				if user.Role == r {
					roleAllowed = true
					break
				}
			}

			if !roleAllowed {
				http.Error(w, `{"error":"Forbidden: Insufficient privileges"}`, http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
