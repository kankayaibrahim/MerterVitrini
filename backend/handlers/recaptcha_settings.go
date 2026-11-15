package handlers

import (
	"context"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"mertervitrini/backend/config"
	"mertervitrini/backend/db"
)

const recaptchaSettingsCacheTTL = 30 * time.Second

// EffectiveReCaptchaSettings represents the merged database + config/env Google reCAPTCHA v3 policy.
type EffectiveReCaptchaSettings struct {
	Enabled   bool
	SiteKey   string
	SecretKey string
	HasSecret bool
	Enforce   bool
}

type cachedReCaptchaRow struct {
	loadedAt  time.Time
	hasRow    bool
	enabled   bool
	siteKey   string
	secretKey string
}

var (
	recaptchaCacheMu sync.RWMutex
	recaptchaCache   cachedReCaptchaRow
)

// invalidateReCaptchaSettingsCache clears the in-memory reCAPTCHA settings cache after admin updates.
func invalidateReCaptchaSettingsCache() {
	recaptchaCacheMu.Lock()
	recaptchaCache = cachedReCaptchaRow{}
	recaptchaCacheMu.Unlock()
}

func loadDBReCaptchaSettings(ctx context.Context) (enabled bool, siteKey string, secretKey string, ok bool) {
	if db.Pool == nil {
		return true, "", "", false
	}

	recaptchaCacheMu.RLock()
	if recaptchaCache.hasRow && time.Since(recaptchaCache.loadedAt) < recaptchaSettingsCacheTTL {
		enabled = recaptchaCache.enabled
		siteKey = recaptchaCache.siteKey
		secretKey = recaptchaCache.secretKey
		recaptchaCacheMu.RUnlock()
		return enabled, siteKey, secretKey, true
	}
	recaptchaCacheMu.RUnlock()

	if ctx == nil {
		ctx = context.Background()
	}
	qCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	var dbEnabled bool
	var dbSiteKey, dbSecretKey string
	err := db.Pool.QueryRow(qCtx, `
		SELECT COALESCE(recaptcha_enabled, true),
		       COALESCE(recaptcha_site_key, ''),
		       COALESCE(recaptcha_secret_key, '')
		FROM catalog.settings
		LIMIT 1
	`).Scan(&dbEnabled, &dbSiteKey, &dbSecretKey)
	if err != nil {
		return true, "", "", false
	}

	dbSiteKey = strings.TrimSpace(dbSiteKey)
	dbSecretKey = strings.TrimSpace(dbSecretKey)

	recaptchaCacheMu.Lock()
	recaptchaCache = cachedReCaptchaRow{
		loadedAt:  time.Now(),
		hasRow:    true,
		enabled:   dbEnabled,
		siteKey:   dbSiteKey,
		secretKey: dbSecretKey,
	}
	recaptchaCacheMu.Unlock()

	return dbEnabled, dbSiteKey, dbSecretKey, true
}

func fallbackEnvOrConfigSiteKey(cfg *config.Config) string {
	if cfg != nil {
		if k := cfg.PublicReCaptchaSiteKey(); k != "" {
			return k
		}
	}
	if v := strings.TrimSpace(os.Getenv("RECAPTCHA_SITE_KEY")); v != "" {
		return v
	}
	if v := strings.TrimSpace(os.Getenv("GOOGLE_RECAPTCHA_SITE_KEY")); v != "" {
		return v
	}
	return strings.TrimSpace(os.Getenv("NEXT_PUBLIC_RECAPTCHA_SITE_KEY"))
}

func fallbackEnvOrConfigSecretKey(cfg *config.Config) string {
	if cfg != nil {
		if k := cfg.EffectiveReCaptchaSecret(); k != "" {
			return k
		}
	}
	if v := strings.TrimSpace(os.Getenv("RECAPTCHA_SECRET")); v != "" {
		return v
	}
	return strings.TrimSpace(os.Getenv("GOOGLE_RECAPTCHA_SECRET_KEY"))
}

// resolveEffectiveReCaptcha resolves active Google reCAPTCHA v3 configuration from DB and config/env fallbacks.
func resolveEffectiveReCaptcha(ctx context.Context, cfg *config.Config) EffectiveReCaptchaSettings {
	dbEnabled, dbSiteKey, dbSecretKey, hasDB := loadDBReCaptchaSettings(ctx)

	enabled := true
	if hasDB {
		enabled = dbEnabled
	}

	siteKey := dbSiteKey
	if siteKey == "" {
		siteKey = fallbackEnvOrConfigSiteKey(cfg)
	}

	secretKey := dbSecretKey
	if secretKey == "" {
		secretKey = fallbackEnvOrConfigSecretKey(cfg)
	}

	return EffectiveReCaptchaSettings{
		Enabled:   enabled,
		SiteKey:   siteKey,
		SecretKey: secretKey,
		HasSecret: secretKey != "",
		Enforce:   enabled && siteKey != "" && secretKey != "",
	}
}

// verifyOrderOrInquiryAntiBot validates Google reCAPTCHA v3 on web orders/inquiries while
// safely exempting admin impersonation and signed X-Mobile-Challenge requests.
func verifyOrderOrInquiryAntiBot(
	ctx context.Context,
	cfg *config.Config,
	r *http.Request,
	bodyRecaptchaToken string,
	bodyChallengeToken string,
	expectedAction string,
	expectedMobilePurpose string,
) (int, string) {
	if r != nil {
		if isImp, _ := isImpersonatedToken(r.Header.Get("Authorization")); isImp {
			return 0, ""
		}

		challengeTok := resolveMobileChallengeFromRequest(r, bodyChallengeToken)
		if challengeTok != "" {
			if err := verifyMobileChallengeToken(cfg, challengeTok, expectedMobilePurpose, time.Now().UTC()); err != nil {
				return http.StatusForbidden, "Mobil güvenlik doğrulaması geçersiz veya süresi doldu. Lütfen tekrar deneyin."
			}
			return 0, ""
		}
	}

	eff := resolveEffectiveReCaptcha(ctx, cfg)
	if !eff.Enabled {
		return 0, ""
	}

	trimmedToken := strings.TrimSpace(bodyRecaptchaToken)
	if trimmedToken == "" {
		if eff.Enforce {
			return http.StatusBadRequest, "Güvenlik doğrulaması (Google reCAPTCHA) gerekli. Lütfen sayfayı yenileyip tekrar deneyin."
		}
		return 0, ""
	}

	if eff.SecretKey == "" {
		return 0, ""
	}

	valid, err := verifyGoogleReCaptcha(eff.SecretKey, trimmedToken, expectedAction)
	if err != nil || !valid {
		return http.StatusBadRequest, "Google reCAPTCHA güvenlik doğrulaması başarısız oldu. Lütfen tekrar deneyin."
	}

	return 0, ""
}
