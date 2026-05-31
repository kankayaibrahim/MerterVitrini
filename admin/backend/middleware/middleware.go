package middleware

import (
	"context"
	"crypto/rsa"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"mertervitrini/admin/backend/models"
)

type contextKey string

const (
	UserContextKey contextKey = "user"
	LogContextKey  contextKey = "log_container"
)

// LogContainer holds mutable request log metadata shared across middleware boundaries
type LogContainer struct {
	UserEmail string
	UserRole  string
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

// LoggingMiddleware logs HTTP requests, execution time, and client context details in either Text or JSON format
func LoggingMiddleware(logFormat string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			rw := &responseWriter{ResponseWriter: w}

			// Inject mutable log container
			container := &LogContainer{}
			ctx := context.WithValue(r.Context(), LogContextKey, container)

			next.ServeHTTP(rw, r.WithContext(ctx))

			duration := time.Since(start)
			ip := getClientIP(r)

			if logFormat == "json" {
				logEntry := map[string]any{
					"time":        time.Now().UTC().Format(time.RFC3339),
					"level":       "INFO",
					"component":   "api",
					"client_ip":   ip,
					"user_email":  container.UserEmail,
					"user_role":   container.UserRole,
					"method":      r.Method,
					"path":        r.URL.Path,
					"proto":       r.Proto,
					"status":      rw.statusCode,
					"duration_ms": float64(duration.Microseconds()) / 1000.0,
					"user_agent":  r.Header.Get("User-Agent"),
				}
				if container.UserEmail == "" {
					logEntry["user_email"] = "anonymous"
					logEntry["user_role"] = "anonymous"
				}
				jsonBytes, err := json.Marshal(logEntry)
				if err == nil {
					log.Println(string(jsonBytes))
				} else {
					log.Printf("[API ERROR] Failed to serialize JSON log: %v", err)
				}
			} else {
				// Format user context if authenticated
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
					ip, userText, r.Method, r.URL.Path, r.Proto, rw.statusCode,
					float64(duration.Microseconds())/1000.0, ua)
			}
		})
	}
}

// CORSMiddleware handles CORS preflight and headers
func CORSMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Expose-Headers", "Content-Length")
		w.Header().Set("Access-Control-Allow-Credentials", "true")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// AuthMiddleware validates JWT Bearer tokens supporting both RS256 (Keycloak) and HS256 (Local fallback)
func AuthMiddleware(jwtSecret string, keycloakPublicKey string) func(http.Handler) http.Handler {
	var rsaPubKey *rsa.PublicKey
	var rsaParseErr error
	var parseOnce sync.Once

	getRSAPublicKey := func() (*rsa.PublicKey, error) {
		parseOnce.Do(func() {
			if keycloakPublicKey == "" {
				rsaParseErr = fmt.Errorf("keycloak public key is empty")
				return
			}
			var pemBlock string
			if strings.Contains(keycloakPublicKey, "-----BEGIN PUBLIC KEY-----") {
				pemBlock = keycloakPublicKey
			} else {
				// Format raw base64 string
				pemBlock = "-----BEGIN PUBLIC KEY-----\n"
				raw := strings.ReplaceAll(keycloakPublicKey, "\n", "")
				raw = strings.ReplaceAll(raw, "\r", "")
				raw = strings.ReplaceAll(raw, " ", "")
				for len(raw) > 0 {
					chunkSize := 64
					if len(raw) < chunkSize {
						chunkSize = len(raw)
					}
					pemBlock += raw[:chunkSize] + "\n"
					raw = raw[chunkSize:]
				}
				pemBlock += "-----END PUBLIC KEY-----"
			}
			pub, err := jwt.ParseRSAPublicKeyFromPEM([]byte(pemBlock))
			if err != nil {
				rsaParseErr = fmt.Errorf("failed to parse RSA public key from PEM: %w", err)
				log.Printf("[AUTH ERROR] %v", rsaParseErr)
				return
			}
			rsaPubKey = pub
			log.Println("[AUTH] Keycloak RSA Public Key successfully loaded and parsed.")
		})
		return rsaPubKey, rsaParseErr
	}

	// Warm-up cache
	if keycloakPublicKey != "" {
		go getRSAPublicKey()
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				http.Error(w, `{"error":"Missing authorization header"}`, http.StatusUnauthorized)
				return
			}

			parts := strings.Split(authHeader, " ")
			if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
				http.Error(w, `{"error":"Invalid authorization format. Use 'Bearer <token>'"}`, http.StatusUnauthorized)
				return
			}

			tokenStr := parts[1]
			
			// Detect signature algorithm first
			token, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
				alg, _ := token.Header["alg"].(string)
				if strings.ToUpper(alg) == "RS256" {
					pubKey, err := getRSAPublicKey()
					if err != nil {
						return nil, fmt.Errorf("RS256 verification failed: %w", err)
					}
					return pubKey, nil
				}
				
				// Fallback to HS256 (HMAC symmetric)
				if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
				}
				return []byte(jwtSecret), nil
			})

			if err != nil || !token.Valid {
				http.Error(w, fmt.Sprintf(`{"error":"Invalid or expired token: %v"}`, err), http.StatusUnauthorized)
				return
			}

			claims, ok := token.Claims.(jwt.MapClaims)
			if !ok {
				http.Error(w, `{"error":"Invalid token claims"}`, http.StatusUnauthorized)
				return
			}

			// Map claims to models.UserInfo
			var userID, firstName, lastName, email string
			var role models.UserRole

			// Keycloak sets the standard sub claim
			if sub, ok := claims["sub"].(string); ok {
				userID = sub
			}
			
			// Keycloak attributes
			if givenName, ok := claims["given_name"].(string); ok {
				firstName = givenName
			} else if fName, ok := claims["first_name"].(string); ok {
				firstName = fName
			}
			
			if familyName, ok := claims["family_name"].(string); ok {
				lastName = familyName
			} else if lName, ok := claims["last_name"].(string); ok {
				lastName = lName
			}
			
			if emailClaim, ok := claims["email"].(string); ok {
				email = emailClaim
			}
			
			// Extract role dynamically
			role = models.RoleAdmin // default fallback role
			
			// 1. Check realm_access.roles
			if realmAccess, ok := claims["realm_access"].(map[string]any); ok {
				if roles, ok := realmAccess["roles"].([]any); ok {
					for _, r := range roles {
						roleStr := strings.ToLower(fmt.Sprintf("%v", r))
						switch models.UserRole(roleStr) {
						case models.RoleSuperAdmin, models.RoleAdmin, models.RoleEditor, models.RoleSalesManager, models.RoleWarehouse:
							role = models.UserRole(roleStr)
						}
					}
				}
			}
			
			// 2. Check resource_access for specific roles
			if resourceAccess, ok := claims["resource_access"].(map[string]any); ok {
				for _, clientData := range resourceAccess {
					if clientMap, ok := clientData.(map[string]any); ok {
						if roles, ok := clientMap["roles"].([]any); ok {
							for _, r := range roles {
								roleStr := strings.ToLower(fmt.Sprintf("%v", r))
								switch models.UserRole(roleStr) {
								case models.RoleSuperAdmin, models.RoleAdmin, models.RoleEditor, models.RoleSalesManager, models.RoleWarehouse:
									role = models.UserRole(roleStr)
								}
							}
						}
					}
				}
			}
			
			// Support custom standard HS256 claims if generated by the legacy login or local test
			if legacyRole, ok := claims["role"].(string); ok {
				role = models.UserRole(legacyRole)
			}

			user := &models.UserInfo{
				ID:        userID,
				FirstName: firstName,
				LastName:  lastName,
				Email:     email,
				Role:      role,
			}

			// Capture details for persistent logging middleware
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
