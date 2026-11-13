package middleware

import (
	"bufio"
	"context"
	"crypto/rsa"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"mertervitrini/backend/db"
	"mertervitrini/backend/models"
	"mertervitrini/backend/pkg/logger"
	"mertervitrini/backend/pkg/safe"
)

type contextKey string

const (
	UserContextKey      contextKey      = "user"
	LogContextKey       contextKey      = "log_container"
	headerContentType                   = "Content-Type"
	mimeApplicationJSON                 = "application/json"
	roleSupplier        models.UserRole = "supplier"
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

func (rw *responseWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	if hijacker, ok := rw.ResponseWriter.(http.Hijacker); ok {
		return hijacker.Hijack()
	}
	return nil, nil, errors.New("underlying ResponseWriter does not support http.Hijacker")
}

func (rw *responseWriter) Flush() {
	if flusher, ok := rw.ResponseWriter.(http.Flusher); ok {
		flusher.Flush()
	}
}

func (rw *responseWriter) Unwrap() http.ResponseWriter {
	return rw.ResponseWriter
}

// getClientIP safely extracts real client IP address, preferring validated X-Real-IP then first valid X-Forwarded-For IP.
func getClientIP(r *http.Request) string {
	if rip := strings.TrimSpace(r.Header.Get("X-Real-IP")); rip != "" {
		if parsed := net.ParseIP(rip); parsed != nil {
			return parsed.String()
		}
	}
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		for _, part := range strings.Split(xff, ",") {
			candidate := strings.TrimSpace(part)
			if parsed := net.ParseIP(candidate); parsed != nil {
				return parsed.String()
			}
		}
	}
	ip, _, err := net.SplitHostPort(strings.TrimSpace(r.RemoteAddr))
	if err != nil {
		return strings.TrimSpace(r.RemoteAddr)
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

	msg := fmt.Sprintf("[API] %s - [%s] %s %s %s | Status: %d | Duration: %.2fms | UA: %s",
		ip, userText, r.Method, r.URL.Path, r.Proto, statusCode,
		float64(duration.Microseconds())/1000.0, ua)

	if statusCode >= 500 {
		logger.Errorf("%s", msg)
	} else if statusCode >= 400 {
		logger.Warnf("%s", msg)
	} else {
		log.Println(msg)
	}
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

func isTrustedCORSOrigin(origin string) bool {
	if origin == "" {
		return false
	}
	parsed, err := url.Parse(origin)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return false
	}
	host := strings.ToLower(parsed.Hostname())
	if host == "mertervitrini.com.tr" || strings.HasSuffix(host, ".mertervitrini.com.tr") {
		return parsed.Scheme == "https" || parsed.Scheme == "http"
	}
	if host == "localhost" || host == "127.0.0.1" {
		return parsed.Scheme == "http" || parsed.Scheme == "https"
	}
	return false
}

// CORSMiddleware handles CORS preflight and headers without combining wildcard origin and credentials.
func CORSMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := strings.TrimSpace(r.Header.Get("Origin"))
		if isTrustedCORSOrigin(origin) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Add("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Credentials", "true")
		} else {
			w.Header().Set("Access-Control-Allow-Origin", "*")
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, X-Chat-Customer-Id, X-Chat-Customer-Name, X-Visitor-Id, X-Mobile-Challenge, X-Challenge-Token")
		w.Header().Set("Access-Control-Expose-Headers", "Content-Length, X-Total-Count")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// Memory-based IP rate limiter configuration with automatic stale-IP eviction.
type ipRateLimiter struct {
	ips         map[string][]time.Time
	lastCleanup time.Time
	mu          sync.Mutex
}

var rateLimiter = &ipRateLimiter{
	ips: make(map[string][]time.Time),
}

func (l *ipRateLimiter) evictStaleLocked(cutoff time.Time, now time.Time) {
	if !l.lastCleanup.IsZero() && now.Sub(l.lastCleanup) < 2*time.Minute {
		return
	}
	for ip, times := range l.ips {
		kept := times[:0]
		for _, t := range times {
			if t.After(cutoff) {
				kept = append(kept, t)
			}
		}
		if len(kept) == 0 {
			delete(l.ips, ip)
		} else {
			l.ips[ip] = kept
		}
	}
	l.lastCleanup = now
}

func (l *ipRateLimiter) allow(ip string, limit int) bool {
	now := time.Now()
	oneMinuteAgo := now.Add(-1 * time.Minute)

	l.mu.Lock()
	defer l.mu.Unlock()

	l.evictStaleLocked(oneMinuteAgo, now)

	var validTimes []time.Time
	for _, t := range l.ips[ip] {
		if t.After(oneMinuteAgo) {
			validTimes = append(validTimes, t)
		}
	}
	if len(validTimes) >= limit {
		l.ips[ip] = validTimes
		return false
	}
	l.ips[ip] = append(validTimes, now)
	return true
}

var rateLimitedPathSuffixes = []string{
	"/auth/login",
	"/auth/register",
	"/store/inquiries",
	"/store/rfqs",
	"/store/supplier-applications",
	"/store/service-providers",
	"/mobile/supplier-applications",
	"/mobile/service-providers",
	"/supplier/auth/setup-password",
}

func isRateLimitedRequest(r *http.Request) bool {
	if r.Method == http.MethodOptions || r.Method == http.MethodGet || r.Method == http.MethodHead {
		return false
	}
	cleanPath := strings.TrimRight(r.URL.Path, "/")
	for _, suffix := range rateLimitedPathSuffixes {
		if strings.HasSuffix(cleanPath, suffix) {
			return true
		}
	}
	return false
}

func enforceIPRateLimit(limiter *ipRateLimiter, maxPerMinute int, scope string, w http.ResponseWriter, r *http.Request) bool {
	ip := getClientIP(r)
	if limiter.allow(ip, maxPerMinute) {
		return true
	}
	log.Printf("[RATE LIMIT EXCEEDED] scope=%s IP=%s path=%s", scope, ip, r.URL.Path)
	w.Header().Set(headerContentType, mimeApplicationJSON)
	w.WriteHeader(http.StatusTooManyRequests)
	w.Write([]byte(`{"error":"Çok fazla istek gönderildi. Lütfen 1 dakika sonra tekrar deneyin."}`))
	return false
}

// StrictRateLimitMiddleware returns an isolated per-IP sliding-window rate limiter for public mobile form and challenge routes.
func StrictRateLimitMiddleware(scope string, maxPerMinute int) func(http.Handler) http.Handler {
	if maxPerMinute <= 0 {
		maxPerMinute = 10
	}
	scopedLimiter := &ipRateLimiter{
		ips: make(map[string][]time.Time),
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodOptions || r.Method == http.MethodHead {
				next.ServeHTTP(w, r)
				return
			}
			if !enforceIPRateLimit(scopedLimiter, maxPerMinute, scope, w, r) {
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// RateLimitMiddleware restricts requests to 15 per minute per IP for sensitive auth and public submission routes.
func RateLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if isRateLimitedRequest(r) && !enforceIPRateLimit(rateLimiter, 15, "global_sensitive", w, r) {
			return
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
	return func(token *jwt.Token) (any, error) {
		alg, _ := token.Header["alg"].(string)
		if strings.EqualFold(alg, "RS256") {
			if token.Method != jwt.SigningMethodRS256 {
				return nil, fmt.Errorf("unexpected RSA signing method: %v", token.Header["alg"])
			}
			pubKey, err := keyProvider.GetKey()
			if err != nil {
				return nil, fmt.Errorf("RS256 verification failed: %w", err)
			}
			return pubKey, nil
		}

		if strings.EqualFold(alg, "HS256") && jwtSecret != "" {
			if token.Method != jwt.SigningMethodHS256 {
				return nil, fmt.Errorf("unexpected HMAC signing method: %v", token.Header["alg"])
			}
			return []byte(jwtSecret), nil
		}

		return nil, fmt.Errorf("unsupported or unconfigured signing method: %v", token.Header["alg"])
	}
}

// VerifyJWTClaims cryptographically verifies a JWT token using Keycloak RS256 public key or HS256 secret.
func VerifyJWTClaims(tokenStr, jwtSecret, keycloakPublicKey string) (jwt.MapClaims, error) {
	trimmed := strings.TrimSpace(tokenStr)
	if trimmed == "" {
		return nil, errors.New("empty token")
	}
	keyProvider := &keycloakKeyProvider{rawKey: keycloakPublicKey}
	tok, err := jwt.Parse(trimmed, makeKeyFunc(jwtSecret, keyProvider))
	if err != nil || !tok.Valid {
		return nil, fmt.Errorf("invalid or expired token: %w", err)
	}
	claims, ok := tok.Claims.(jwt.MapClaims)
	if !ok {
		return nil, errors.New("invalid token claims")
	}
	return claims, nil
}

func classifyRoleName(raw string) (models.UserRole, int) {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "super_admin", "superadmin":
		return models.RoleSuperAdmin, 50
	case "admin", "merter-admin":
		return models.RoleAdmin, 40
	case "editor":
		return models.RoleEditor, 30
	case "sales_manager":
		return models.RoleSalesManager, 30
	case "warehouse":
		return models.RoleWarehouse, 30
	case "supplier":
		return roleSupplier, 20
	case "customer":
		return models.RoleCustomer, 10
	default:
		return "", 0
	}
}

func pickHigherRole(current models.UserRole, currentPrio int, candidateRaw string) (models.UserRole, int) {
	role, prio := classifyRoleName(candidateRaw)
	if prio > currentPrio {
		return role, prio
	}
	return current, currentPrio
}

func scanRoleSlice(roles []any, current models.UserRole, prio int) (models.UserRole, int) {
	for _, r := range roles {
		current, prio = pickHigherRole(current, prio, fmt.Sprintf("%v", r))
	}
	return current, prio
}

func extractResourceRoles(claims jwt.MapClaims, current models.UserRole, prio int) (models.UserRole, int) {
	resAccess, ok := claims["resource_access"].(map[string]any)
	if !ok {
		return current, prio
	}
	for _, clientObj := range resAccess {
		clientMap, ok := clientObj.(map[string]any)
		if !ok {
			continue
		}
		if roles, ok := clientMap["roles"].([]any); ok {
			current, prio = scanRoleSlice(roles, current, prio)
		}
	}
	return current, prio
}

// ExtractVerifiedUserRole resolves user role from cryptographically verified JWT claims, defaulting strictly to RoleCustomer.
func ExtractVerifiedUserRole(claims jwt.MapClaims) models.UserRole {
	role := models.RoleCustomer
	prio := 10

	if realmAccess, ok := claims["realm_access"].(map[string]any); ok {
		if roles, ok := realmAccess["roles"].([]any); ok {
			role, prio = scanRoleSlice(roles, role, prio)
		}
	}

	role, prio = extractResourceRoles(claims, role, prio)

	if tokenRole, ok := claims["role"].(string); ok && tokenRole != "" {
		role, _ = pickHigherRole(role, prio, tokenRole)
	}

	return role
}

// ResolveUserRoleFromDB checks identity.users for staff/admin role assignment and blocked status when token claims carry default customer role.
func ResolveUserRoleFromDB(ctx context.Context, userID, email string, fallback models.UserRole) (models.UserRole, bool) {
	if db.Pool == nil || (userID == "" && email == "") {
		return fallback, false
	}
	var dbRole string
	var isBlocked bool
	var isActive bool
	err := db.Pool.QueryRow(ctx, `
		SELECT COALESCE(user_role, 'customer'), COALESCE(is_blocked, false), COALESCE(is_active, true)
		FROM identity.users
		WHERE (($1 <> '' AND id::text = $1) OR ($2 <> '' AND lower(email) = lower($2)))
		ORDER BY ($1 <> '' AND id::text = $1) DESC
		LIMIT 1
	`, userID, email).Scan(&dbRole, &isBlocked, &isActive)
	if err != nil {
		return fallback, false
	}
	if isBlocked || !isActive {
		return fallback, true
	}
	if fallback == models.RoleCustomer {
		if mapped, prio := classifyRoleName(dbRole); prio > 10 {
			return mapped, false
		}
	}
	return fallback, false
}

func extractUserRole(claims jwt.MapClaims) models.UserRole {
	return ExtractVerifiedUserRole(claims)
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
		safe.Go("Keycloak Key Provider", func() {
			keyProvider.GetKey()
		})
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
			dbCtx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
			resolvedRole, blocked := ResolveUserRoleFromDB(dbCtx, user.ID, user.Email, user.Role)
			cancel()
			if blocked {
				http.Error(w, `{"error":"Forbidden: Account is inactive or blocked"}`, http.StatusForbidden)
				return
			}
			user.Role = resolvedRole

			if container, ok := r.Context().Value(LogContextKey).(*LogContainer); ok {
				container.UserEmail = user.Email
				container.UserRole = string(user.Role)
			}

			ctx := context.WithValue(r.Context(), UserContextKey, user)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func isUserRoleAllowed(actual models.UserRole, allowed []models.UserRole) bool {
	for _, reqRole := range allowed {
		if actual == reqRole {
			return true
		}
		if reqRole == models.RoleAdmin && actual == models.RoleSuperAdmin {
			return true
		}
	}
	return false
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

			if !isUserRoleAllowed(user.Role, roles) {
				http.Error(w, `{"error":"Forbidden: Insufficient privileges"}`, http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

const SupplierContextKey contextKey = "supplier"

type SupplierClaims struct {
	UserID      string `json:"sub"`
	BrandID     string `json:"brand_id"`
	BrandName   string `json:"brand_name"`
	AliasCode   string `json:"alias_code"`
	Email       string `json:"email"`
	ContactName string `json:"contact_name"`
	Role        string `json:"role"`
	jwt.RegisteredClaims
}

func GetSupplierFromContext(ctx context.Context) (*SupplierClaims, bool) {
	s, ok := ctx.Value(SupplierContextKey).(*SupplierClaims)
	return s, ok
}

// SupplierAuthMiddleware validates JWT Bearer tokens issued to suppliers (both RS256 Keycloak and HS256 Local)
func SupplierAuthMiddleware(jwtSecret string, keycloakPublicKey string) func(http.Handler) http.Handler {
	keyProvider := &keycloakKeyProvider{rawKey: keycloakPublicKey}
	if keycloakPublicKey != "" {
		safe.Go("Keycloak Key Provider Supplier", func() {
			keyProvider.GetKey()
		})
	}
	keyFunc := makeKeyFunc(jwtSecret, keyProvider)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			tokenStr, err := extractBearerToken(authHeader)
			if err != nil {
				w.Header().Set(headerContentType, mimeApplicationJSON)
				w.WriteHeader(http.StatusUnauthorized)
				json.NewEncoder(w).Encode(map[string]string{"error": "Yetkilendirme başlığı eksik veya geçersiz."})
				return
			}

			token, err := jwt.Parse(tokenStr, keyFunc)
			if err != nil || !token.Valid {
				w.Header().Set(headerContentType, mimeApplicationJSON)
				w.WriteHeader(http.StatusUnauthorized)
				json.NewEncoder(w).Encode(map[string]string{"error": "Geçersiz veya süresi dolmuş tedarikçi oturumu."})
				return
			}

			claimsMap, ok := token.Claims.(jwt.MapClaims)
			if !ok {
				w.Header().Set(headerContentType, mimeApplicationJSON)
				w.WriteHeader(http.StatusUnauthorized)
				json.NewEncoder(w).Encode(map[string]string{"error": "Geçersiz token yapısı."})
				return
			}

			brandID, _ := claimsMap["brand_id"].(string)
			userID, _ := claimsMap["sub"].(string)
			email, _ := claimsMap["email"].(string)
			brandName, _ := claimsMap["brand_name"].(string)
			aliasCode, _ := claimsMap["alias_code"].(string)
			contactName, _ := claimsMap["contact_name"].(string)

			// If brandID is missing in token claims (Keycloak token), dynamically resolve it from catalog.supplier_users
			if brandID == "" {
				ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
				defer cancel()

				var resolvedBrandID, resolvedBrandName, resolvedAlias, resolvedContactName, resolvedUserID string
				query := `
					SELECT u.id, u.brand_id, b.brand_name, coalesce(b.alias_code, ''), u.contact_name
					FROM catalog.supplier_users u
					JOIN catalog.brands b ON u.brand_id = b.id
					WHERE (u.keycloak_id = $1 OR lower(u.email) = lower($2)) AND u.is_active = true AND b.is_active = true
					LIMIT 1`
				err := db.Pool.QueryRow(ctx, query, userID, email).Scan(
					&resolvedUserID, &resolvedBrandID, &resolvedBrandName, &resolvedAlias, &resolvedContactName,
				)
				if err != nil {
					w.Header().Set(headerContentType, mimeApplicationJSON)
					w.WriteHeader(http.StatusForbidden)
					json.NewEncoder(w).Encode(map[string]string{"error": "Bu Keycloak hesabı ile ilişkili aktif bir tedarikçi markası bulunamadı."})
					return
				}
				brandID = resolvedBrandID
				brandName = resolvedBrandName
				aliasCode = resolvedAlias
				contactName = resolvedContactName
				userID = resolvedUserID
			}

			claims := &SupplierClaims{
				UserID:      userID,
				BrandID:     brandID,
				BrandName:   brandName,
				AliasCode:   aliasCode,
				Email:       email,
				ContactName: contactName,
				Role:        "supplier",
			}

			ctx := context.WithValue(r.Context(), SupplierContextKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
