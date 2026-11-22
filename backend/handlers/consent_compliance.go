package handlers

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"mertervitrini/backend/config"
	"mertervitrini/backend/db"
	"mertervitrini/backend/pkg/httpx"
)

const (
	consentGenesisHash     = "0000000000000000000000000000000000000000000000000000000000000000"
	consentChainLockKey    = int64(8842026043)
	consentAnchorLockKey   = int64(8842026044)
	consentPayloadSchemaV1 = "MV-CMP-v1"
)

var validConsentLanguages = map[string]bool{
	"tr": true, "en": true, "ru": true, "ar": true,
	"de": true, "fr": true, "pl": true, "bg": true,
}

var validConsentActions = map[string]bool{
	"accept_all": true, "reject_all": true, "custom": true, "withdraw": true,
}

var consentRefSafeRegex = regexp.MustCompile(`^[A-Za-z0-9_-]{6,64}$`)

// ConsentComplianceHandler handles public CMP runtime & tamper-evident ledger endpoints plus admin compliance tooling.
type ConsentComplianceHandler struct {
	Cfg *config.Config
}

// NewConsentComplianceHandler constructs a ConsentComplianceHandler with server configuration.
func NewConsentComplianceHandler(cfg *config.Config) *ConsentComplianceHandler {
	return &ConsentComplianceHandler{Cfg: cfg}
}

// ConsentSettingsDTO represents persisted CMP, Google Consent Mode v2, IAB, and RFC 3161 TSA config.
type ConsentSettingsDTO struct {
	BannerEnabled          bool     `json:"banner_enabled"`
	BannerLayout           string   `json:"banner_layout"`
	FloatingTriggerEnabled bool     `json:"floating_trigger_enabled"`
	GAMeasurementID        string   `json:"ga_measurement_id"`
	GoogleConsentMode      string   `json:"google_consent_mode"`
	ReconsentDays          int      `json:"reconsent_days"`
	IABEnabled             bool     `json:"iab_enabled"`
	IABCMPID               int      `json:"iab_cmp_id"`
	TSAPrimaryURL          string   `json:"tsa_primary_url"`
	TSAFallbackURLs        []string `json:"tsa_fallback_urls"`
	AutoAnchorIntervalMin  int      `json:"auto_anchor_interval_min"`
	StrictOptInCountries   []string `json:"strict_opt_in_countries"`
	UpdatedAt              string   `json:"updated_at,omitempty"`
}

// CookieInventoryItem describes a single cookie/storage/script entry disclosed in the CMP UI.
type CookieInventoryItem struct {
	ID                  string            `json:"id"`
	CookieName          string            `json:"cookie_name"`
	Category            string            `json:"category"`
	Provider            string            `json:"provider"`
	Domain              string            `json:"domain"`
	StorageType         string            `json:"storage_type"`
	Duration            string            `json:"duration"`
	IsThirdParty        bool              `json:"is_third_party"`
	IsActive            bool              `json:"is_active"`
	Source              string            `json:"source"`
	PurposeTranslations map[string]string `json:"purpose_translations"`
	Purpose             string            `json:"purpose,omitempty"`
	LastSeenAt          *time.Time        `json:"last_seen_at,omitempty"`
	UpdatedAt           time.Time         `json:"updated_at"`
}

// ConsentChoices holds deterministic boolean flags for each c15t category.
type ConsentChoices struct {
	Necessary     bool `json:"necessary"`
	Functionality bool `json:"functionality"`
	Experience    bool `json:"experience"`
	Measurement   bool `json:"measurement"`
	Marketing     bool `json:"marketing"`
}

// GoogleConsentModeState captures exact Google Consent Mode v2 signal strings ("granted" | "denied").
type GoogleConsentModeState struct {
	AdStorage              string `json:"ad_storage"`
	AdUserData             string `json:"ad_user_data"`
	AdPersonalization      string `json:"ad_personalization"`
	AnalyticsStorage       string `json:"analytics_storage"`
	FunctionalityStorage   string `json:"functionality_storage"`
	PersonalizationStorage string `json:"personalization_storage"`
	SecurityStorage        string `json:"security_storage"`
}

type canonicalConsentPayloadV1 struct {
	Version             string                 `json:"version"`
	ConsentRefID        string                 `json:"consent_ref_id"`
	RecordedAtUTC       string                 `json:"recorded_at_utc"`
	SubjectID           string                 `json:"subject_id"`
	VisitorID           string                 `json:"visitor_id"`
	UserID              string                 `json:"user_id"`
	Action              string                 `json:"action"`
	Model               string                 `json:"model"`
	UISource            string                 `json:"ui_source"`
	Consents            ConsentChoices         `json:"consents"`
	GoogleConsentMode   GoogleConsentModeState `json:"google_consent_mode"`
	GPCSignal           bool                   `json:"gpc_signal"`
	PolicySnapshotHash  string                 `json:"policy_snapshot_hash"`
	PolicyVersion       int                    `json:"policy_version"`
	Language            string                 `json:"language"`
	CountryCode         string                 `json:"country_code"`
	IPMasked            string                 `json:"ip_masked"`
	IPHashSHA256        string                 `json:"ip_hash_sha256"`
	UserAgentHash       string                 `json:"user_agent_hash"`
	PageURL             string                 `json:"page_url"`
	TCFTCString         string                 `json:"tcf_tc_string"`
	AddtlConsent        string                 `json:"addtl_consent"`
	SupersedesConsentID string                 `json:"supersedes_consent_id"`
}

type recordConsentRequest struct {
	SubjectID           string                  `json:"subject_id"`
	VisitorID           string                  `json:"visitor_id"`
	SupersedesConsentID string                  `json:"supersedes_consent_id"`
	Action              string                  `json:"action"`
	Model               string                  `json:"model"`
	UISource            string                  `json:"ui_source"`
	Consents            ConsentChoices          `json:"consents"`
	GoogleConsentMode   *GoogleConsentModeState `json:"google_consent_mode,omitempty"`
	TCFTCString         string                  `json:"tcf_tc_string"`
	AddtlConsent        string                  `json:"addtl_consent"`
	GPCSignal           bool                    `json:"gpc_signal"`
	Language            string                  `json:"language"`
	CountryCode         string                  `json:"country_code"`
	PageURL             string                  `json:"page_url"`
	BannerCopy          map[string]string       `json:"banner_copy,omitempty"`
}

// EnsureConsentComplianceSchema idempotently guarantees compliance tables and WORM triggers exist on startup.
func EnsureConsentComplianceSchema(ctx context.Context) error {
	if db.Pool == nil {
		return nil
	}

	_, err := db.Pool.Exec(ctx, `ALTER TYPE catalog.policy_type ADD VALUE IF NOT EXISTS 'cookie_policy'`)
	if err != nil {
		log.Printf("[COMPLIANCE SCHEMA WARNING] policy_type alter skipped or failed: %v", err)
	}

	statements := []string{
		`CREATE SCHEMA IF NOT EXISTS compliance`,
		`CREATE OR REPLACE FUNCTION compliance.prevent_immutable_mutation()
		RETURNS TRIGGER AS $$
		BEGIN
			RAISE EXCEPTION 'Compliance table % is append-only (WORM); % operations are forbidden for forensic integrity.', TG_TABLE_NAME, TG_OP;
		END;
		$$ LANGUAGE plpgsql`,
		`CREATE TABLE IF NOT EXISTS compliance.consent_settings (
			id                        INTEGER PRIMARY KEY CHECK (id = 1),
			banner_enabled            BOOLEAN NOT NULL DEFAULT true,
			banner_layout             VARCHAR(24) NOT NULL DEFAULT 'floating',
			floating_trigger_enabled  BOOLEAN NOT NULL DEFAULT true,
			ga_measurement_id         VARCHAR(64) NOT NULL DEFAULT 'G-CNMNCL62Q2',
			google_consent_mode       VARCHAR(24) NOT NULL DEFAULT 'always',
			reconsent_days            INTEGER NOT NULL DEFAULT 365,
			iab_enabled               BOOLEAN NOT NULL DEFAULT false,
			iab_cmp_id                INTEGER NOT NULL DEFAULT 0,
			tsa_primary_url           VARCHAR(255) NOT NULL DEFAULT 'http://timestamp.digicert.com',
			tsa_fallback_urls         JSONB NOT NULL DEFAULT '["http://timestamp.sectigo.com","https://freetsa.org/tsr"]'::jsonb,
			auto_anchor_interval_min  INTEGER NOT NULL DEFAULT 15,
			strict_opt_in_countries   JSONB NOT NULL DEFAULT '["TR","EU","EEA","GB","CH"]'::jsonb,
			updated_at                TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`INSERT INTO compliance.consent_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING`,
		`CREATE TABLE IF NOT EXISTS compliance.cookie_inventory (
			id                    UUID PRIMARY KEY DEFAULT uuidv7(),
			cookie_name           VARCHAR(128) NOT NULL UNIQUE,
			category              VARCHAR(32) NOT NULL CHECK (category IN ('necessary', 'functionality', 'experience', 'measurement', 'marketing')),
			provider              VARCHAR(128) NOT NULL,
			domain                VARCHAR(180) NOT NULL DEFAULT 'mertervitrini.com.tr',
			storage_type          VARCHAR(32) NOT NULL DEFAULT 'cookie' CHECK (storage_type IN ('cookie', 'localStorage', 'sessionStorage', 'script')),
			duration              VARCHAR(120) NOT NULL DEFAULT 'Oturum / Session',
			is_third_party        BOOLEAN NOT NULL DEFAULT false,
			is_active             BOOLEAN NOT NULL DEFAULT true,
			source                VARCHAR(32) NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'auto_scan')),
			purpose_translations  JSONB NOT NULL DEFAULT '{}'::jsonb,
			last_seen_at          TIMESTAMPTZ,
			created_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS compliance.cookie_scan_runs (
			id                UUID PRIMARY KEY DEFAULT uuidv7(),
			triggered_by      VARCHAR(128),
			scanned_urls      JSONB NOT NULL DEFAULT '[]'::jsonb,
			detected_count    INTEGER NOT NULL DEFAULT 0,
			new_cookies_count INTEGER NOT NULL DEFAULT 0,
			findings          JSONB NOT NULL DEFAULT '[]'::jsonb,
			created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS compliance.consent_policy_snapshots (
			id                        UUID PRIMARY KEY DEFAULT uuidv7(),
			content_sha256            CHAR(64) NOT NULL UNIQUE,
			policy_version            INTEGER NOT NULL DEFAULT 1,
			language                  VARCHAR(10) NOT NULL,
			banner_copy               JSONB NOT NULL DEFAULT '{}'::jsonb,
			cookie_inventory_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
			legal_policy_text         TEXT NOT NULL DEFAULT '',
			created_at                TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`DROP TRIGGER IF EXISTS trg_consent_policy_snapshots_worm ON compliance.consent_policy_snapshots`,
		`CREATE TRIGGER trg_consent_policy_snapshots_worm BEFORE UPDATE OR DELETE ON compliance.consent_policy_snapshots FOR EACH ROW EXECUTE FUNCTION compliance.prevent_immutable_mutation()`,
		`CREATE TABLE IF NOT EXISTS compliance.consent_ledger (
			seq_no               BIGSERIAL NOT NULL UNIQUE,
			id                   UUID PRIMARY KEY DEFAULT uuidv7(),
			consent_ref_id       VARCHAR(32) NOT NULL UNIQUE,
			subject_id           VARCHAR(128) NOT NULL,
			visitor_id           VARCHAR(128),
			user_id              VARCHAR(128),
			user_email_hash      CHAR(64),
			supersedes_consent_id UUID,
			action               VARCHAR(32) NOT NULL CHECK (action IN ('accept_all', 'reject_all', 'custom', 'withdraw')),
			model                VARCHAR(24) NOT NULL DEFAULT 'opt-in',
			ui_source            VARCHAR(32) NOT NULL DEFAULT 'banner',
			given_consents       JSONB NOT NULL,
			google_consent_mode  JSONB NOT NULL DEFAULT '{}'::jsonb,
			tcf_tc_string        TEXT,
			addtl_consent        TEXT,
			gpc_signal           BOOLEAN NOT NULL DEFAULT false,
			policy_snapshot_id   UUID NOT NULL REFERENCES compliance.consent_policy_snapshots(id),
			policy_snapshot_hash CHAR(64) NOT NULL,
			language             VARCHAR(10) NOT NULL,
			country_code         VARCHAR(8),
			ip_masked            VARCHAR(64),
			ip_hash_sha256       CHAR(64),
			user_agent_hash      CHAR(64),
			page_url             TEXT,
			canonical_payload    TEXT NOT NULL,
			payload_sha256       CHAR(64) NOT NULL,
			prev_hash            CHAR(64) NOT NULL,
			entry_hash           CHAR(64) NOT NULL UNIQUE,
			server_hmac_sha256   CHAR(64) NOT NULL,
			recorded_at_utc      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`DROP TRIGGER IF EXISTS trg_consent_ledger_worm ON compliance.consent_ledger`,
		`CREATE TRIGGER trg_consent_ledger_worm BEFORE UPDATE OR DELETE ON compliance.consent_ledger FOR EACH ROW EXECUTE FUNCTION compliance.prevent_immutable_mutation()`,
		`CREATE TABLE IF NOT EXISTS compliance.consent_merkle_anchors (
			anchor_seq        BIGSERIAL NOT NULL UNIQUE,
			id                UUID PRIMARY KEY DEFAULT uuidv7(),
			seq_from          BIGINT NOT NULL,
			seq_to            BIGINT NOT NULL,
			record_count      INTEGER NOT NULL,
			merkle_root       CHAR(64) NOT NULL,
			prev_anchor_hash  CHAR(64) NOT NULL,
			anchor_chain_hash CHAR(64) NOT NULL UNIQUE,
			tsa_provider      VARCHAR(120) NOT NULL,
			tsa_url           VARCHAR(255) NOT NULL,
			tsa_status        VARCHAR(32) NOT NULL,
			tsa_gen_time_utc  TIMESTAMPTZ,
			tsa_serial_hex    VARCHAR(128),
			tsa_policy_oid    VARCHAR(128),
			tsa_token_base64  TEXT NOT NULL,
			created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`DROP TRIGGER IF EXISTS trg_consent_merkle_anchors_worm ON compliance.consent_merkle_anchors`,
		`CREATE TRIGGER trg_consent_merkle_anchors_worm BEFORE UPDATE OR DELETE ON compliance.consent_merkle_anchors FOR EACH ROW EXECUTE FUNCTION compliance.prevent_immutable_mutation()`,
	}

	for _, stmt := range statements {
		if _, err := db.Pool.Exec(ctx, stmt); err != nil {
			return err
		}
	}
	return nil
}

func sha256HexString(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

func deriveConsentHMACKey(cfg *config.Config) []byte {
	secret := ""
	if cfg != nil {
		secret = strings.TrimSpace(cfg.JWTSecret)
	}
	if secret == "" {
		secret = "mertervitrini-default-hmac-fallback"
	}
	sum := sha256.Sum256([]byte("mertervitrini-consent-ledger-v1:" + secret))
	return sum[:]
}

func computeConsentHMAC(key []byte, entryHash string) string {
	mac := hmac.New(sha256.New, key)
	_, _ = mac.Write([]byte(strings.ToLower(strings.TrimSpace(entryHash))))
	return hex.EncodeToString(mac.Sum(nil))
}

func computeChainEntryHash(prevHash, payloadSHA256 string) string {
	return sha256HexString(strings.ToLower(strings.TrimSpace(prevHash)) + "|" + strings.ToLower(strings.TrimSpace(payloadSHA256)))
}

func buildGoogleConsentModeState(choices ConsentChoices, override *GoogleConsentModeState) GoogleConsentModeState {
	if override != nil && override.SecurityStorage != "" {
		return *override
	}
	flag := func(b bool) string {
		if b {
			return "granted"
		}
		return "denied"
	}
	return GoogleConsentModeState{
		AdStorage:              flag(choices.Marketing),
		AdUserData:             flag(choices.Marketing),
		AdPersonalization:      flag(choices.Marketing),
		AnalyticsStorage:       flag(choices.Measurement),
		FunctionalityStorage:   flag(choices.Functionality),
		PersonalizationStorage: flag(choices.Experience),
		SecurityStorage:        "granted",
	}
}

func maskAndHashIP(rawIP string) (string, string) {
	cleaned := strings.TrimSpace(rawIP)
	if cleaned == "" {
		return "0.0.0.0/0", sha256HexString("mv-ip:unknown")
	}
	hashHex := sha256HexString("mv-ip:" + cleaned)
	parsed := net.ParseIP(cleaned)
	if parsed == nil {
		return "unknown", hashHex
	}
	if v4 := parsed.To4(); v4 != nil {
		return fmt.Sprintf("%d.%d.0.0/16", v4[0], v4[1]), hashHex
	}
	full := parsed.String()
	parts := strings.Split(full, ":")
	prefixLen := len(parts)
	if prefixLen > 3 {
		prefixLen = 3
	}
	return strings.Join(parts[:prefixLen], ":") + "::/48", hashHex
}

func generateConsentRefID() string {
	b := make([]byte, 5)
	if _, err := rand.Read(b); err != nil {
		return fmt.Sprintf("MV-%d", time.Now().UTC().UnixNano())
	}
	return fmt.Sprintf("MV-CMP-%s", strings.ToUpper(hex.EncodeToString(b)))
}

func normalizeConsentLanguage(raw string) string {
	cleaned := strings.ToLower(strings.TrimSpace(raw))
	if validConsentLanguages[cleaned] {
		return cleaned
	}
	return "tr"
}

func inferRequestCountryCode(r *http.Request, bodyCountry string) string {
	candidates := []string{
		bodyCountry,
		r.Header.Get("CF-IPCountry"),
		r.Header.Get("X-Country-Code"),
		r.URL.Query().Get("country"),
	}
	for _, c := range candidates {
		cc := strings.ToUpper(strings.TrimSpace(c))
		if len(cc) == 2 && cc != "XX" && cc != "T1" {
			return cc
		}
	}
	return "TR"
}

func buildCanonicalConsentPayload(p canonicalConsentPayloadV1) (string, string, error) {
	b, err := json.Marshal(p)
	if err != nil {
		return "", "", err
	}
	canonical := string(b)
	return canonical, sha256HexString(canonical), nil
}

func loadConsentSettingsRow(ctx context.Context) (ConsentSettingsDTO, error) {
	dto := ConsentSettingsDTO{
		BannerEnabled:          true,
		BannerLayout:           "floating",
		FloatingTriggerEnabled: true,
		GAMeasurementID:        "G-CNMNCL62Q2",
		GoogleConsentMode:      "always",
		ReconsentDays:          365,
		IABEnabled:             false,
		IABCMPID:               0,
		TSAPrimaryURL:          "http://timestamp.digicert.com",
		TSAFallbackURLs:        []string{"http://timestamp.sectigo.com", "https://freetsa.org/tsr"},
		AutoAnchorIntervalMin:  15,
		StrictOptInCountries:   []string{"TR", "EU", "EEA", "GB", "CH"},
	}
	if db.Pool == nil {
		return dto, nil
	}

	var fallbackRaw, countriesRaw []byte
	var updatedAt time.Time
	err := db.Pool.QueryRow(ctx, `
		SELECT banner_enabled, banner_layout, floating_trigger_enabled, ga_measurement_id,
		       google_consent_mode, reconsent_days, iab_enabled, iab_cmp_id,
		       tsa_primary_url, tsa_fallback_urls, auto_anchor_interval_min, strict_opt_in_countries, updated_at
		FROM compliance.consent_settings
		WHERE id = 1
	`).Scan(
		&dto.BannerEnabled, &dto.BannerLayout, &dto.FloatingTriggerEnabled, &dto.GAMeasurementID,
		&dto.GoogleConsentMode, &dto.ReconsentDays, &dto.IABEnabled, &dto.IABCMPID,
		&dto.TSAPrimaryURL, &fallbackRaw, &dto.AutoAnchorIntervalMin, &countriesRaw, &updatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return dto, nil
		}
		return dto, err
	}
	_ = json.Unmarshal(fallbackRaw, &dto.TSAFallbackURLs)
	_ = json.Unmarshal(countriesRaw, &dto.StrictOptInCountries)
	dto.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return dto, nil
}

func loadActiveCookieInventory(ctx context.Context, lang string, onlyActive bool) ([]CookieInventoryItem, error) {
	query := `
		SELECT id::text, cookie_name, category, provider, domain, storage_type,
		       duration, is_third_party, is_active, source, purpose_translations, last_seen_at, updated_at
		FROM compliance.cookie_inventory
	`
	if onlyActive {
		query += ` WHERE is_active = true`
	}
	query += ` ORDER BY CASE category WHEN 'necessary' THEN 1 WHEN 'functionality' THEN 2 WHEN 'experience' THEN 3 WHEN 'measurement' THEN 4 ELSE 5 END, cookie_name ASC`

	rows, err := db.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []CookieInventoryItem
	for rows.Next() {
		var item CookieInventoryItem
		var transRaw []byte
		if scanErr := rows.Scan(
			&item.ID, &item.CookieName, &item.Category, &item.Provider, &item.Domain,
			&item.StorageType, &item.Duration, &item.IsThirdParty, &item.IsActive,
			&item.Source, &transRaw, &item.LastSeenAt, &item.UpdatedAt,
		); scanErr != nil {
			continue
		}
		item.PurposeTranslations = map[string]string{}
		_ = json.Unmarshal(transRaw, &item.PurposeTranslations)
		item.Purpose = resolveCookiePurposeText(item.PurposeTranslations, lang)
		items = append(items, item)
	}
	if items == nil {
		items = []CookieInventoryItem{}
	}
	return items, nil
}

func resolveCookiePurposeText(translations map[string]string, lang string) string {
	for _, k := range []string{lang, "tr", "en"} {
		if val := strings.TrimSpace(translations[k]); val != "" {
			return val
		}
	}
	for _, val := range translations {
		if strings.TrimSpace(val) != "" {
			return strings.TrimSpace(val)
		}
	}
	return ""
}

func buildSortedBannerCopyJSON(copyMap map[string]string) string {
	if len(copyMap) == 0 {
		return "{}"
	}
	keys := make([]string, 0, len(copyMap))
	for k := range copyMap {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	type kv struct {
		K string `json:"k"`
		V string `json:"v"`
	}
	ordered := make([]kv, 0, len(keys))
	for _, k := range keys {
		ordered = append(ordered, kv{K: k, V: copyMap[k]})
	}
	b, _ := json.Marshal(ordered)
	return string(b)
}

func loadActiveCookiePolicy(ctx context.Context) (int, string) {
	if db.Pool == nil {
		return 1, ""
	}
	var version int
	var content string
	err := db.Pool.QueryRow(ctx, `
		SELECT policy_version, content
		FROM catalog.legal_policies
		WHERE policy_type = 'cookie_policy' AND is_active = true
		ORDER BY policy_version DESC
		LIMIT 1
	`).Scan(&version, &content)
	if err != nil {
		return 1, ""
	}
	return version, content
}

func ensurePolicySnapshot(ctx context.Context, tx pgx.Tx, lang string, bannerCopy map[string]string) (string, string, int, error) {
	items, err := loadActiveCookieInventory(ctx, lang, true)
	if err != nil {
		return "", "", 1, err
	}
	policyVer, policyText := loadActiveCookiePolicy(ctx)
	invJSONBytes, err := json.Marshal(items)
	if err != nil {
		return "", "", policyVer, err
	}
	bannerOrderedJSON := buildSortedBannerCopyJSON(bannerCopy)
	bannerObjBytes, _ := json.Marshal(bannerCopy)

	digestSource := fmt.Sprintf("v=%d|lang=%s|banner=%s|inv=%s|policy=%s",
		policyVer, lang, bannerOrderedJSON, string(invJSONBytes), policyText)
	contentHash := sha256HexString(digestSource)

	if tx != nil {
		_, err = tx.Exec(ctx, `
			INSERT INTO compliance.consent_policy_snapshots
				(content_sha256, policy_version, language, banner_copy, cookie_inventory_snapshot, legal_policy_text)
			VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6)
			ON CONFLICT (content_sha256) DO NOTHING
		`, contentHash, policyVer, lang, string(bannerObjBytes), string(invJSONBytes), policyText)
		if err != nil {
			return "", "", policyVer, err
		}
		var snapID string
		err = tx.QueryRow(ctx, `SELECT id::text FROM compliance.consent_policy_snapshots WHERE content_sha256 = $1`, contentHash).Scan(&snapID)
		return snapID, contentHash, policyVer, err
	}

	_, err = db.Pool.Exec(ctx, `
		INSERT INTO compliance.consent_policy_snapshots
			(content_sha256, policy_version, language, banner_copy, cookie_inventory_snapshot, legal_policy_text)
		VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6)
		ON CONFLICT (content_sha256) DO NOTHING
	`, contentHash, policyVer, lang, string(bannerObjBytes), string(invJSONBytes), policyText)
	if err != nil {
		return "", "", policyVer, err
	}
	var snapID string
	err = db.Pool.QueryRow(ctx, `SELECT id::text FROM compliance.consent_policy_snapshots WHERE content_sha256 = $1`, contentHash).Scan(&snapID)
	return snapID, contentHash, policyVer, err
}

func isCountryInList(countryCode string, strictList []string) bool {
	euSet := map[string]bool{
		"AT": true, "BE": true, "BG": true, "HR": true, "CY": true, "CZ": true, "DK": true,
		"EE": true, "FI": true, "FR": true, "DE": true, "GR": true, "HU": true, "IE": true,
		"IT": true, "LV": true, "LT": true, "LU": true, "MT": true, "NL": true, "PL": true,
		"PT": true, "RO": true, "SK": true, "SI": true, "ES": true, "SE": true,
		"NO": true, "IS": true, "LI": true, "GB": true, "UK": true, "CH": true, "TR": true,
	}
	cc := strings.ToUpper(strings.TrimSpace(countryCode))
	for _, entry := range strictList {
		e := strings.ToUpper(strings.TrimSpace(entry))
		if e == cc {
			return true
		}
		if (e == "EU" || e == "EEA") && euSet[cc] {
			return true
		}
	}
	return len(strictList) == 0
}

// GetStorefrontConsentInit serves CMP policy config, localized cookie inventory, snapshot hash & existing subject state.
func (h *ConsentComplianceHandler) GetStorefrontConsentInit(w http.ResponseWriter, r *http.Request) {
	if db.Pool == nil {
		httpx.Error(w, http.StatusServiceUnavailable, "Veritabanı hazır değil")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	lang := normalizeConsentLanguage(r.URL.Query().Get("lang"))
	countryCode := inferRequestCountryCode(r, "")
	gpcDetected := strings.TrimSpace(r.Header.Get("Sec-GPC")) == "1"
	subjectID := strings.TrimSpace(r.URL.Query().Get("subject_id"))

	settings, err := loadConsentSettingsRow(ctx)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Rıza ayarları okunamadı")
		return
	}
	inventory, err := loadActiveCookieInventory(ctx, lang, true)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Çerez envanteri okunamadı")
		return
	}
	_, snapshotHash, policyVersion, snapErr := ensurePolicySnapshot(ctx, nil, lang, map[string]string{})
	if snapErr != nil {
		log.Printf("[COMPLIANCE WARN] snapshot warmup failed: %v", snapErr)
	}

	var latestRecord map[string]any
	if subjectID != "" && len(subjectID) <= 120 {
		latestRecord = fetchLatestSubjectReceiptSummary(ctx, subjectID)
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"settings":             settings,
		"language":             lang,
		"country_code":         countryCode,
		"is_strict_opt_in":     isCountryInList(countryCode, settings.StrictOptInCountries),
		"gpc_detected":         gpcDetected,
		"policy_version":       policyVersion,
		"policy_snapshot_hash": snapshotHash,
		"cookie_inventory":     inventory,
		"latest_record":        latestRecord,
	})
}

func fetchLatestSubjectReceiptSummary(ctx context.Context, subjectID string) map[string]any {
	var refID, action, entryHash, snapHash, recordedAt string
	var seqNo int64
	var givenRaw []byte
	err := db.Pool.QueryRow(ctx, `
		SELECT seq_no, consent_ref_id, action, given_consents, policy_snapshot_hash, entry_hash, to_char(recorded_at_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
		FROM compliance.consent_ledger
		WHERE subject_id = $1
		ORDER BY seq_no DESC
		LIMIT 1
	`, subjectID).Scan(&seqNo, &refID, &action, &givenRaw, &snapHash, &entryHash, &recordedAt)
	if err != nil {
		return nil
	}
	var choices ConsentChoices
	_ = json.Unmarshal(givenRaw, &choices)
	res := map[string]any{
		"seq_no":               seqNo,
		"consent_ref_id":       refID,
		"action":               action,
		"consents":             choices,
		"policy_snapshot_hash": snapHash,
		"entry_hash":           entryHash,
		"recorded_at_utc":      recordedAt,
	}
	var anchorSeq int64
	var tsaProvider, merkleRoot string
	err = db.Pool.QueryRow(ctx, `
		SELECT anchor_seq, tsa_provider, merkle_root
		FROM compliance.consent_merkle_anchors
		WHERE seq_from <= $1 AND seq_to >= $1
		LIMIT 1
	`, seqNo).Scan(&anchorSeq, &tsaProvider, &merkleRoot)
	if err == nil {
		res["anchored"] = true
		res["anchor_seq"] = anchorSeq
		res["tsa_provider"] = tsaProvider
		res["merkle_root"] = merkleRoot
	} else {
		res["anchored"] = false
	}
	return res
}

// RecordStorefrontConsent appends a tamper-evident canonical + chained + HMAC-sealed consent row.
func (h *ConsentComplianceHandler) RecordStorefrontConsent(w http.ResponseWriter, r *http.Request) {
	if db.Pool == nil {
		httpx.Error(w, http.StatusServiceUnavailable, "Veritabanı hazır değil")
		return
	}

	var req recordConsentRequest
	if err := httpx.DecodeJSON(r, &req, httpx.DefaultMaxJSONBytes); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Geçersiz rıza kaydı JSON verisi")
		return
	}

	req.SubjectID = strings.TrimSpace(req.SubjectID)
	req.VisitorID = strings.TrimSpace(req.VisitorID)
	req.Action = strings.ToLower(strings.TrimSpace(req.Action))
	if req.SubjectID == "" || len(req.SubjectID) > 128 {
		httpx.Error(w, http.StatusBadRequest, "Geçerli subject_id zorunludur")
		return
	}
	if !validConsentActions[req.Action] {
		httpx.Error(w, http.StatusBadRequest, "Geçersiz rıza eylem tipi")
		return
	}
	req.Consents.Necessary = true

	model := strings.TrimSpace(req.Model)
	if model == "" {
		model = "opt-in"
	}
	uiSource := strings.TrimSpace(req.UISource)
	if uiSource == "" {
		uiSource = "banner"
	}
	lang := normalizeConsentLanguage(req.Language)
	countryCode := inferRequestCountryCode(r, req.CountryCode)
	pageURL := strings.TrimSpace(req.PageURL)
	if len(pageURL) > 512 {
		pageURL = pageURL[:512]
	}

	userID := resolveAuthenticatedMemberID(r, "")
	userEmailHash := ""
	if userID != "" {
		var email string
		_ = db.Pool.QueryRow(r.Context(), `SELECT lower(coalesce(email, '')) FROM identity.users WHERE id = $1`, userID).Scan(&email)
		if email != "" {
			userEmailHash = sha256HexString("mv-email:" + email)
		}
	}

	clientIP := getClientIP(r)
	ipMasked, ipHash := maskAndHashIP(clientIP)
	uaHash := sha256HexString(strings.TrimSpace(r.UserAgent()))
	consentMode := buildGoogleConsentModeState(req.Consents, req.GoogleConsentMode)

	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Rıza kaydı işlemi başlatılamadı")
		return
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock($1)`, consentChainLockKey); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Kayıt kilidi alınamadı")
		return
	}

	prevHash := consentGenesisHash
	err = tx.QueryRow(ctx, `SELECT entry_hash FROM compliance.consent_ledger ORDER BY seq_no DESC LIMIT 1`).Scan(&prevHash)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusInternalServerError, "Zincir başı okunamadı")
		return
	}

	var supersedesPtr *string
	supersedesStr := strings.TrimSpace(req.SupersedesConsentID)
	if supersedesStr == "" {
		var prevID string
		if prevErr := tx.QueryRow(ctx, `SELECT id::text FROM compliance.consent_ledger WHERE subject_id = $1 ORDER BY seq_no DESC LIMIT 1`, req.SubjectID).Scan(&prevID); prevErr == nil && prevID != "" {
			supersedesStr = prevID
		}
	}
	if supersedesStr != "" {
		supersedesPtr = &supersedesStr
	}

	snapID, snapHash, policyVer, snapErr := ensurePolicySnapshot(ctx, tx, lang, req.BannerCopy)
	if snapErr != nil {
		httpx.Error(w, http.StatusInternalServerError, "Politika anlık görüntüsü oluşturulamadı")
		return
	}

	nowUTC := time.Now().UTC().Truncate(time.Microsecond)
	refID := generateConsentRefID()

	canonicalStruct := canonicalConsentPayloadV1{
		Version:             consentPayloadSchemaV1,
		ConsentRefID:        refID,
		RecordedAtUTC:       nowUTC.Format("2006-01-02T15:04:05.000000Z"),
		SubjectID:           req.SubjectID,
		VisitorID:           req.VisitorID,
		UserID:              userID,
		Action:              req.Action,
		Model:               model,
		UISource:            uiSource,
		Consents:            req.Consents,
		GoogleConsentMode:   consentMode,
		GPCSignal:           req.GPCSignal,
		PolicySnapshotHash:  snapHash,
		PolicyVersion:       policyVer,
		Language:            lang,
		CountryCode:         countryCode,
		IPMasked:            ipMasked,
		IPHashSHA256:        ipHash,
		UserAgentHash:       uaHash,
		PageURL:             pageURL,
		TCFTCString:         strings.TrimSpace(req.TCFTCString),
		AddtlConsent:        strings.TrimSpace(req.AddtlConsent),
		SupersedesConsentID: supersedesStr,
	}

	canonicalJSON, payloadSHA256, canonErr := buildCanonicalConsentPayload(canonicalStruct)
	if canonErr != nil {
		httpx.Error(w, http.StatusInternalServerError, "Kanonik kanıt verisi oluşturulamadı")
		return
	}

	entryHash := computeChainEntryHash(prevHash, payloadSHA256)
	hmacHex := computeConsentHMAC(deriveConsentHMACKey(h.Cfg), entryHash)

	consentsBytes, _ := json.Marshal(req.Consents)
	cmBytes, _ := json.Marshal(consentMode)

	var insertedSeq int64
	var insertedID string
	err = tx.QueryRow(ctx, `
		INSERT INTO compliance.consent_ledger (
			consent_ref_id, subject_id, visitor_id, user_id, user_email_hash, supersedes_consent_id,
			action, model, ui_source, given_consents, google_consent_mode, tcf_tc_string, addtl_consent,
			gpc_signal, policy_snapshot_id, policy_snapshot_hash, language, country_code,
			ip_masked, ip_hash_sha256, user_agent_hash, page_url,
			canonical_payload, payload_sha256, prev_hash, entry_hash, server_hmac_sha256, recorded_at_utc
		) VALUES (
			$1, $2, NULLIF($3, ''), NULLIF($4, ''), NULLIF($5, ''), $6::uuid,
			$7, $8, $9, $10::jsonb, $11::jsonb, NULLIF($12, ''), NULLIF($13, ''),
			$14, $15::uuid, $16, $17, $18,
			$19, $20, $21, $22,
			$23, $24, $25, $26, $27, $28
		)
		RETURNING seq_no, id::text
	`,
		refID, req.SubjectID, req.VisitorID, userID, userEmailHash, supersedesPtr,
		req.Action, model, uiSource, string(consentsBytes), string(cmBytes), req.TCFTCString, req.AddtlConsent,
		req.GPCSignal, snapID, snapHash, lang, countryCode,
		ipMasked, ipHash, uaHash, pageURL,
		canonicalJSON, payloadSHA256, prevHash, entryHash, hmacHex, nowUTC,
	).Scan(&insertedSeq, &insertedID)
	if err != nil {
		log.Printf("[COMPLIANCE ERROR] insert consent_ledger failed: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "Rıza kaydı yazılamadı")
		return
	}

	if err := tx.Commit(ctx); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Rıza kaydı onaylanamadı")
		return
	}

	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":                   true,
		"id":                   insertedID,
		"seq_no":               insertedSeq,
		"consent_ref_id":       refID,
		"subject_id":           req.SubjectID,
		"policy_snapshot_hash": snapHash,
		"payload_sha256":       payloadSHA256,
		"prev_hash":            prevHash,
		"entry_hash":           entryHash,
		"recorded_at_utc":      nowUTC.Format(time.RFC3339Nano),
	})
}

// GetStorefrontConsentReceipt returns a public, privacy-safe cryptographic receipt for a visitor's consent_ref_id.
func (h *ConsentComplianceHandler) GetStorefrontConsentReceipt(w http.ResponseWriter, r *http.Request) {
	if db.Pool == nil {
		httpx.Error(w, http.StatusServiceUnavailable, "Veritabanı hazır değil")
		return
	}
	refID := strings.TrimSpace(r.PathValue("ref_id"))
	if !consentRefSafeRegex.MatchString(refID) {
		httpx.Error(w, http.StatusBadRequest, "Geçersiz rıza referans numarası")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	var (
		seqNo        int64
		id           string
		action       string
		model        string
		uiSource     string
		lang         string
		countryCode  string
		snapHash     string
		payloadSHA   string
		prevHash     string
		entryHash    string
		recordedAt   time.Time
		givenRaw     []byte
		cmRaw        []byte
	)
	err := db.Pool.QueryRow(ctx, `
		SELECT seq_no, id::text, action, model, ui_source, language, coalesce(country_code, ''),
		       policy_snapshot_hash, payload_sha256, prev_hash, entry_hash, recorded_at_utc,
		       given_consents, google_consent_mode
		FROM compliance.consent_ledger
		WHERE consent_ref_id = $1
	`, refID).Scan(
		&seqNo, &id, &action, &model, &uiSource, &lang, &countryCode,
		&snapHash, &payloadSHA, &prevHash, &entryHash, &recordedAt, &givenRaw, &cmRaw,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.Error(w, http.StatusNotFound, "Rıza makbuzu bulunamadı")
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "Rıza makbuzu sorgulanamadı")
		return
	}

	var choices ConsentChoices
	var cm GoogleConsentModeState
	_ = json.Unmarshal(givenRaw, &choices)
	_ = json.Unmarshal(cmRaw, &cm)

	receipt := map[string]any{
		"seq_no":               seqNo,
		"id":                   id,
		"consent_ref_id":       refID,
		"action":               action,
		"model":                model,
		"ui_source":            uiSource,
		"language":             lang,
		"country_code":         countryCode,
		"consents":             choices,
		"google_consent_mode":  cm,
		"policy_snapshot_hash": snapHash,
		"payload_sha256":       payloadSHA,
		"prev_hash":            prevHash,
		"entry_hash":           entryHash,
		"recorded_at_utc":      recordedAt.UTC().Format(time.RFC3339Nano),
	}

	anchorInfo, _ := findAnchorForSeq(ctx, seqNo, entryHash)
	if anchorInfo != nil {
		receipt["rfc3161_anchor"] = anchorInfo
	}

	httpx.JSON(w, http.StatusOK, receipt)
}
