package handlers

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"sync"
	"time"

	"mertervitrini/backend/config"
	"mertervitrini/backend/pkg/httpx"
)

const (
	mobileChallengeTTL            = 15 * time.Minute
	mobileChallengeClockSkew      = 60 * time.Second
	mobileChallengeDefaultPurpose = "mobile_form"
	mobileChallengePurposeReg     = "register"
	mobileChallengePurposeSupp    = "supplier_apply"
	mobileChallengePurposeService = "service_provider_apply"
)

var (
	ephemeralMobileChallengeOnce   sync.Once
	ephemeralMobileChallengeSecret []byte

	errMobileChallengeMissing  = errors.New("Güvenlik doğrulama kodu eksik. Lütfen formu yenileyip tekrar deneyin.")
	errMobileChallengeInvalid  = errors.New("Güvenlik doğrulama kodu geçersiz. Lütfen formu yenileyip tekrar deneyin.")
	errMobileChallengeExpired  = errors.New("Güvenlik doğrulama kodunun süresi doldu. Lütfen tekrar deneyin.")
	errMobileChallengeMismatch = errors.New("Güvenlik doğrulama kodu bu işlem için geçerli değil.")
)

type mobileChallengePayload struct {
	Purpose   string `json:"p"`
	Nonce     string `json:"n"`
	IssuedAt  int64  `json:"iat"`
	ExpiresAt int64  `json:"exp"`
}

func resolveMobileChallengeSigningKey(cfg *config.Config) []byte {
	var raw string
	if cfg != nil {
		raw = strings.TrimSpace(cfg.JWTSecret)
		if raw == "" {
			raw = strings.TrimSpace(cfg.KeycloakClientSecret)
		}
	}
	if raw == "" {
		ephemeralMobileChallengeOnce.Do(func() {
			buf := make([]byte, 32)
			if _, err := rand.Read(buf); err != nil {
				// Fallback to timestamp entropy only if OS CSPRNG ever fails
				sum := sha256.Sum256([]byte(time.Now().UTC().String()))
				ephemeralMobileChallengeSecret = sum[:]
				return
			}
			ephemeralMobileChallengeSecret = buf
		})
		return ephemeralMobileChallengeSecret
	}
	sum := sha256.Sum256([]byte("merter-mobile-challenge-v1:" + raw))
	return sum[:]
}

func normalizeMobileChallengePurpose(purpose string) string {
	clean := strings.ToLower(strings.TrimSpace(purpose))
	switch clean {
	case "", "bootstrap", "default", mobileChallengeDefaultPurpose:
		return mobileChallengeDefaultPurpose
	case "supplier_application", "supplier-applications", "supplier-application", mobileChallengePurposeSupp:
		return mobileChallengePurposeSupp
	case "service_provider", "service-providers", "service-provider", mobileChallengePurposeService:
		return mobileChallengePurposeService
	case "auth_register", "signup", mobileChallengePurposeReg:
		return mobileChallengePurposeReg
	default:
		return clean
	}
}

func computeMobileChallengeSignature(key []byte, payloadB64 string) []byte {
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(payloadB64))
	return mac.Sum(nil)
}

func issueMobileChallengeToken(cfg *config.Config, purpose string, now time.Time) (string, error) {
	if now.IsZero() {
		now = time.Now().UTC()
	}
	nonceBytes := make([]byte, 12)
	if _, err := rand.Read(nonceBytes); err != nil {
		return "", err
	}
	payload := mobileChallengePayload{
		Purpose:   normalizeMobileChallengePurpose(purpose),
		Nonce:     hex.EncodeToString(nonceBytes),
		IssuedAt:  now.UTC().Unix(),
		ExpiresAt: now.UTC().Add(mobileChallengeTTL).Unix(),
	}
	rawJSON, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	payloadB64 := base64.RawURLEncoding.EncodeToString(rawJSON)
	sig := computeMobileChallengeSignature(resolveMobileChallengeSigningKey(cfg), payloadB64)
	return payloadB64 + "." + base64.RawURLEncoding.EncodeToString(sig), nil
}

func verifyMobileChallengeToken(cfg *config.Config, token, expectedPurpose string, now time.Time) error {
	trimmed := strings.TrimSpace(token)
	if trimmed == "" {
		return errMobileChallengeMissing
	}
	dotIdx := strings.IndexByte(trimmed, '.')
	if dotIdx <= 0 || dotIdx >= len(trimmed)-1 {
		return errMobileChallengeInvalid
	}
	payloadB64 := trimmed[:dotIdx]
	sigB64 := trimmed[dotIdx+1:]
	if strings.ContainsRune(sigB64, '.') {
		return errMobileChallengeInvalid
	}

	providedSig, err := base64.RawURLEncoding.DecodeString(sigB64)
	if err != nil || len(providedSig) == 0 {
		return errMobileChallengeInvalid
	}
	expectedSig := computeMobileChallengeSignature(resolveMobileChallengeSigningKey(cfg), payloadB64)
	if !hmac.Equal(providedSig, expectedSig) {
		return errMobileChallengeInvalid
	}

	rawJSON, err := base64.RawURLEncoding.DecodeString(payloadB64)
	if err != nil {
		return errMobileChallengeInvalid
	}
	var payload mobileChallengePayload
	if err := json.Unmarshal(rawJSON, &payload); err != nil {
		return errMobileChallengeInvalid
	}
	if strings.TrimSpace(payload.Nonce) == "" || payload.IssuedAt <= 0 || payload.ExpiresAt <= payload.IssuedAt {
		return errMobileChallengeInvalid
	}

	if now.IsZero() {
		now = time.Now().UTC()
	}
	nowUnix := now.UTC().Unix()
	if payload.IssuedAt > nowUnix+int64(mobileChallengeClockSkew.Seconds()) {
		return errMobileChallengeInvalid
	}
	if nowUnix > payload.ExpiresAt {
		return errMobileChallengeExpired
	}

	expectedNorm := normalizeMobileChallengePurpose(expectedPurpose)
	actualNorm := normalizeMobileChallengePurpose(payload.Purpose)
	if actualNorm != expectedNorm && actualNorm != mobileChallengeDefaultPurpose {
		return errMobileChallengeMismatch
	}
	return nil
}

func resolveMobileChallengeFromRequest(r *http.Request, bodyTokens ...string) string {
	for _, t := range bodyTokens {
		if trimmed := strings.TrimSpace(t); trimmed != "" {
			return trimmed
		}
	}
	if r != nil {
		if h := strings.TrimSpace(r.Header.Get("X-Mobile-Challenge")); h != "" {
			return h
		}
		if h := strings.TrimSpace(r.Header.Get("X-Challenge-Token")); h != "" {
			return h
		}
	}
	return ""
}

// GetChallenge godoc
// GET /api/v1/mobile/challenge?purpose=register
// Issues a short-lived HMAC-SHA256 challenge token replacing browser ReCAPTCHA on native mobile endpoints.
func (h *MobileHandler) GetChallenge(w http.ResponseWriter, r *http.Request) {
	purpose := normalizeMobileChallengePurpose(r.URL.Query().Get("purpose"))
	now := time.Now().UTC()
	token, err := issueMobileChallengeToken(h.Cfg, purpose, now)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Güvenlik kodu oluşturulamadı.")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"token":           token,
		"challenge_token": token,
		"purpose":         purpose,
		"expires_in":      int(mobileChallengeTTL.Seconds()),
		"expires_at":      now.Add(mobileChallengeTTL).Format(time.RFC3339),
	})
}

func (h *MobileHandler) requireMobileChallenge(w http.ResponseWriter, r *http.Request, expectedPurpose string, bodyTokens ...string) bool {
	token := resolveMobileChallengeFromRequest(r, bodyTokens...)
	if err := verifyMobileChallengeToken(h.Cfg, token, expectedPurpose, time.Now().UTC()); err != nil {
		httpx.Error(w, http.StatusForbidden, err.Error())
		return false
	}
	return true
}
