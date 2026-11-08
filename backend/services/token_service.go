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

func NewUnifiedTokenService(jwtSecret, keycloakPublicKey string, pool *pgxpool.Pool) *UnifiedTokenService {
	var parsedPub *rsa.PublicKey
	if strings.TrimSpace(keycloakPublicKey) != "" {
		parsedPub, _ = parseRSAPublicKey(keycloakPublicKey)
	}
	return &UnifiedTokenService{
		jwtSecret:    jwtSecret,
		rsaPublicKey: parsedPub,
		pool:         pool,
	}
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
		"role":         "supplier",
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

	if roleClaim == "supplier" || brandID != "" {
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
	parts := strings.Split(tokenStr, ".")
	if len(parts) != 3 {
		return nil, errors.New(errInvalidSessionToken)
	}

	headerMap, err := decodeBase64JSONSegment(parts[0])
	if err != nil {
		return nil, errors.New(errInvalidSessionToken)
	}
	alg, _ := headerMap["alg"].(string)

	if strings.HasPrefix(strings.ToUpper(alg), "HS") && s.jwtSecret != "" {
		return verifyHMACTokenClaims(tokenStr, s.jwtSecret)
	}
	if strings.EqualFold(alg, "RS256") && s.rsaPublicKey != nil {
		return verifyRSATokenClaims(tokenStr, s.rsaPublicKey)
	}
	return decodeUnverifiedClaimsWithExp(parts[1])
}

const (
	errInvalidSessionToken   = "geçersiz oturum anahtarı"
	errExpiredOrInvalidToken = "geçersiz veya süresi dolmuş oturum anahtarı"
)

func verifyHMACTokenClaims(tokenStr, secret string) (map[string]any, error) {
	tok, err := jwt.Parse(tokenStr, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
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
		if _, ok := t.Method.(*jwt.SigningMethodRSA); !ok {
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

func decodeUnverifiedClaimsWithExp(payloadSeg string) (map[string]any, error) {
	claims, err := decodeBase64JSONSegment(payloadSeg)
	if err != nil {
		return nil, errors.New(errInvalidSessionToken)
	}
	expFloat, ok := claims["exp"].(float64)
	if ok && time.Now().Unix() > int64(expFloat) {
		return nil, errors.New("oturum süresi dolmuş")
	}
	return claims, nil
}

func (s *UnifiedTokenService) resolveSupplierPrincipal(ctx context.Context, sub, email, brandID string) (*MobilePrincipal, error) {
	p := &MobilePrincipal{
		UserID:  sub,
		Role:    "supplier",
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

func parseRSAPublicKey(rawKey string) (*rsa.PublicKey, error) {
	trimmed := strings.TrimSpace(rawKey)
	if !strings.Contains(trimmed, "BEGIN PUBLIC KEY") {
		trimmed = "-----BEGIN PUBLIC KEY-----\n" + trimmed + "\n-----END PUBLIC KEY-----"
	}
	block, _ := pem.Decode([]byte(trimmed))
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

