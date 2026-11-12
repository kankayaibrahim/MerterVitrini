package services

import (
	"context"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"mertervitrini/backend/models"
)

// MobilePrincipal represents an authenticated Customer or Supplier identity resolved from a Bearer token.
type MobilePrincipal struct {
	UserID  string
	Role    string // "customer" or "supplier"
	Email   string
	BrandID string
	IsOwner bool
}

// TokenService defines the DIP contract for dual-role JWT verification and local supplier token issuance.
type TokenService interface {
	ResolvePrincipal(ctx context.Context, authHeader string) (*MobilePrincipal, error)
	IssueSupplierJWT(u *models.SupplierUser) string
}

// UnifiedTokenService validates HS256 (local supplier) and RS256 (Keycloak OIDC) Bearer tokens.
type UnifiedTokenService struct {
	jwtSecret     string
	rsaPublicKey  *rsa.PublicKey
	pool          *pgxpool.Pool
}

const (
	errInvalidSessionToken   = "geçersiz oturum anahtarı"
	errExpiredOrInvalidToken = "geçersiz veya süresi dolmuş oturum anahtarı"
	roleSupplierLiteral      = "supplier"
)

var (
	defaultVerifierMu sync.RWMutex
	defaultVerifier   *UnifiedTokenService
)

// ConfigureDefaultVerifier registers the process-wide cryptographic JWT verifier.
func ConfigureDefaultVerifier(jwtSecret, keycloakPublicKey string) {
	svc := NewUnifiedTokenService(jwtSecret, keycloakPublicKey, nil)
	defaultVerifierMu.Lock()
	defaultVerifier = svc
	defaultVerifierMu.Unlock()
}

// VerifyTokenClaims cryptographically verifies a JWT (HS256 or RS256) and validates its expiration.
func VerifyTokenClaims(tokenStr string) (map[string]any, error) {
	defaultVerifierMu.RLock()
	svc := defaultVerifier
	defaultVerifierMu.RUnlock()
	if svc == nil {
		return nil, errors.New(errInvalidSessionToken)
	}
	return svc.parseAndVerifyClaims(strings.TrimSpace(tokenStr))
}

// VerifyJWTWithKeys cryptographically verifies a JWT against explicit HS256 secret and/or RS256 public key.
func VerifyJWTWithKeys(tokenStr, jwtSecret, keycloakPublicKey string) (map[string]any, error) {
	svc := NewUnifiedTokenService(jwtSecret, keycloakPublicKey, nil)
	return svc.parseAndVerifyClaims(strings.TrimSpace(tokenStr))
}

func NewUnifiedTokenService(jwtSecret, keycloakPublicKey string, pool *pgxpool.Pool) *UnifiedTokenService {
	var parsedPub *rsa.PublicKey
	if strings.TrimSpace(keycloakPublicKey) != "" {
		parsedPub, _ = parseRSAPublicKey(keycloakPublicKey)
	}
	svc := &UnifiedTokenService{
		jwtSecret:    jwtSecret,
		rsaPublicKey: parsedPub,
		pool:         pool,
	}
	defaultVerifierMu.Lock()
	if defaultVerifier == nil && (jwtSecret != "" || parsedPub != nil) {
		defaultVerifier = svc
	}
	defaultVerifierMu.Unlock()
	return svc
}

func (s *UnifiedTokenService) IssueSupplierJWT(u *models.SupplierUser) string {
	if s == nil || s.jwtSecret == "" || u == nil {
		return ""
	}
	now := time.Now()
	claims := jwt.MapClaims{
		"sub":          u.ID,
		"brand_id":     u.BrandID,
		"brand_name":   u.BrandName,
		"alias_code":   u.AliasCode,
		"email":        u.Email,
		"contact_name": u.ContactName,
		"role":         roleSupplierLiteral,
		"iat":          now.Unix(),
		"exp":          now.Add(7 * 24 * time.Hour).Unix(),
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := tok.SignedString([]byte(s.jwtSecret))
	if err != nil {
		return ""
	}
	return signed
}

func (s *UnifiedTokenService) ResolvePrincipal(ctx context.Context, authHeader string) (*MobilePrincipal, error) {
	trimmed := strings.TrimSpace(authHeader)
	if len(trimmed) >= 7 && strings.EqualFold(trimmed[:7], "bearer ") {
		trimmed = strings.TrimSpace(trimmed[7:])
	}
	if trimmed == "" {
		return nil, errors.New("yetkilendirme anahtarı eksik")
	}

	claims, err := s.parseAndVerifyClaims(trimmed)
	if err != nil {
		return nil, err
	}

	sub, _ := claims["sub"].(string)
	email, _ := claims["email"].(string)
	roleClaim, _ := claims["role"].(string)
	brandID, _ := claims["brand_id"].(string)

	if roleClaim == roleSupplierLiteral || brandID != "" {
		return s.resolveSupplierPrincipal(ctx, sub, email, brandID)
	}

	if sub == "" {
		return nil, errors.New("geçersiz kullanıcı kimliği")
	}

	return &MobilePrincipal{
		UserID: sub,
		Role:   "customer",
		Email:  email,
	}, nil
}

func (s *UnifiedTokenService) parseAndVerifyClaims(tokenStr string) (map[string]any, error) {
	if s == nil {
		return nil, errors.New(errInvalidSessionToken)
	}
	parts := strings.Split(tokenStr, ".")
	if len(parts) != 3 {
		return nil, errors.New(errInvalidSessionToken)
	}

	headerMap, err := decodeBase64JSONSegment(parts[0])
	if err != nil {
		return nil, errors.New(errInvalidSessionToken)
	}
	alg, _ := headerMap["alg"].(string)

	if strings.EqualFold(alg, "HS256") && s.jwtSecret != "" {
		return verifyHMACTokenClaims(tokenStr, s.jwtSecret)
	}
	if strings.EqualFold(alg, "RS256") && s.rsaPublicKey != nil {
		return verifyRSATokenClaims(tokenStr, s.rsaPublicKey)
	}
	return nil, errors.New(errInvalidSessionToken)
}

func verifyHMACTokenClaims(tokenStr, secret string) (map[string]any, error) {
	tok, err := jwt.Parse(tokenStr, func(t *jwt.Token) (any, error) {
		if t.Method != jwt.SigningMethodHS256 {
			return nil, fmt.Errorf("beklenmeyen imza algoritması: %v", t.Header["alg"])
		}
		return []byte(secret), nil
	})
	if err != nil || !tok.Valid {
		return nil, errors.New(errExpiredOrInvalidToken)
	}
	mc, ok := tok.Claims.(jwt.MapClaims)
	if !ok {
		return nil, errors.New(errInvalidSessionToken)
	}
	return map[string]any(mc), nil
}

func verifyRSATokenClaims(tokenStr string, pub *rsa.PublicKey) (map[string]any, error) {
	tok, err := jwt.Parse(tokenStr, func(t *jwt.Token) (any, error) {
		if t.Method != jwt.SigningMethodRS256 {
			return nil, fmt.Errorf("beklenmeyen imza algoritması: %v", t.Header["alg"])
		}
		return pub, nil
	})
	if err != nil || !tok.Valid {
		return nil, errors.New(errExpiredOrInvalidToken)
	}
	mc, ok := tok.Claims.(jwt.MapClaims)
	if !ok {
		return nil, errors.New(errInvalidSessionToken)
	}
	return map[string]any(mc), nil
}

func (s *UnifiedTokenService) resolveSupplierPrincipal(ctx context.Context, sub, email, brandID string) (*MobilePrincipal, error) {
	p := &MobilePrincipal{
		UserID:  sub,
		Role:    roleSupplierLiteral,
		Email:   email,
		BrandID: brandID,
		IsOwner: true,
	}
	if s.pool != nil {
		_ = s.pool.QueryRow(ctx, `
			SELECT id::text, brand_id::text, email, coalesce(is_owner, true)
			FROM catalog.supplier_users
			WHERE (id::text = $1 OR keycloak_id = $1 OR lower(email) = lower($2)) AND is_active = true
			LIMIT 1
		`, sub, email).Scan(&p.UserID, &p.BrandID, &p.Email, &p.IsOwner)
	}
	if p.UserID == "" {
		return nil, errors.New("tedarikçi hesabı bulunamadı")
	}
	return p, nil
}

func decodeBase64JSONSegment(seg string) (map[string]any, error) {
	padded := seg
	if rem := len(padded) % 4; rem > 0 {
		padded += strings.Repeat("=", 4-rem)
	}
	raw, err := base64.URLEncoding.DecodeString(padded)
	if err != nil {
		raw, err = base64.StdEncoding.DecodeString(padded)
		if err != nil {
			return nil, err
		}
	}
	var out map[string]any
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func formatPublicKeyPEM(rawKey string) string {
	trimmed := strings.TrimSpace(rawKey)
	if strings.Contains(trimmed, "BEGIN PUBLIC KEY") {
		return trimmed
	}
	clean := strings.NewReplacer("\n", "", "\r", "", " ", "").Replace(trimmed)
	var sb strings.Builder
	sb.WriteString("-----BEGIN PUBLIC KEY-----\n")
	for len(clean) > 0 {
		chunk := 64
		if len(clean) < chunk {
			chunk = len(clean)
		}
		sb.WriteString(clean[:chunk])
		sb.WriteByte('\n')
		clean = clean[chunk:]
	}
	sb.WriteString("-----END PUBLIC KEY-----")
	return sb.String()
}

func parseRSAPublicKey(rawKey string) (*rsa.PublicKey, error) {
	block, _ := pem.Decode([]byte(formatPublicKeyPEM(rawKey)))
	if block == nil {
		return nil, errors.New("invalid PEM block")
	}
	pub, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return nil, err
	}
	rsaPub, ok := pub.(*rsa.PublicKey)
	if !ok {
		return nil, errors.New("not an RSA public key")
	}
	return rsaPub, nil
}

