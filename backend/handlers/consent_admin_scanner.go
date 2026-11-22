package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"mertervitrini/backend/db"
	"mertervitrini/backend/middleware"
	"mertervitrini/backend/pkg/httpx"
)

var (
	validCookieCategories = map[string]bool{
		"necessary": true, "functionality": true, "experience": true, "measurement": true, "marketing": true,
	}
	validStorageTypes = map[string]bool{
		"cookie": true, "localStorage": true, "sessionStorage": true, "script": true,
	}
	scriptSrcRegex = regexp.MustCompile(`(?i)<script[^>]+src=["']([^"']+)["']`)
)

type cookieUpsertRequest struct {
	CookieName          string            `json:"cookie_name"`
	Category            string            `json:"category"`
	Provider            string            `json:"provider"`
	Domain              string            `json:"domain"`
	StorageType         string            `json:"storage_type"`
	Duration            string            `json:"duration"`
	IsThirdParty        bool              `json:"is_third_party"`
	IsActive            bool              `json:"is_active"`
	PurposeTranslations map[string]string `json:"purpose_translations"`
}

// ScanFinding represents a cookie, script, or storage key discovered during a live scan.
type ScanFinding struct {
	Name         string            `json:"name"`
	Category     string            `json:"category"`
	Provider     string            `json:"provider"`
	Domain       string            `json:"domain"`
	StorageType  string            `json:"storage_type"`
	Duration     string            `json:"duration"`
	IsThirdParty bool              `json:"is_third_party"`
	SourceURL    string            `json:"source_url"`
	AlreadyKnown bool              `json:"already_known"`
	Purposes     map[string]string `json:"purposes"`
}

// GetAdminSettings returns current CMP runtime settings.
func (h *ConsentComplianceHandler) GetAdminSettings(w http.ResponseWriter, r *http.Request) {
	if db.Pool == nil {
		httpx.Error(w, http.StatusServiceUnavailable, "Veritabanı hazır değil")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	settings, err := loadConsentSettingsRow(ctx)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Rıza ayarları yüklenemedi")
		return
	}
	httpx.JSON(w, http.StatusOK, settings)
}

// UpdateAdminSettings persists CMP banner, Consent Mode v2, IAB TCF, and RFC 3161 TSA configuration.
func (h *ConsentComplianceHandler) UpdateAdminSettings(w http.ResponseWriter, r *http.Request) {
	if db.Pool == nil {
		httpx.Error(w, http.StatusServiceUnavailable, "Veritabanı hazır değil")
		return
	}

	var req ConsentSettingsDTO
	if err := httpx.DecodeJSON(r, &req, httpx.DefaultMaxJSONBytes); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Geçersiz ayar JSON verisi")
		return
	}

	layout := strings.TrimSpace(req.BannerLayout)
	if layout != "floating" && layout != "bar" && layout != "modal" {
		layout = "floating"
	}
	gcmMode := strings.TrimSpace(req.GoogleConsentMode)
	if gcmMode != "always" && gcmMode != "after-consent" {
		gcmMode = "always"
	}
	if req.ReconsentDays < 30 || req.ReconsentDays > 730 {
		req.ReconsentDays = 365
	}
	if req.AutoAnchorIntervalMin < 1 || req.AutoAnchorIntervalMin > 1440 {
		req.AutoAnchorIntervalMin = 15
	}
	primaryTSA := strings.TrimSpace(req.TSAPrimaryURL)
	if primaryTSA == "" {
		primaryTSA = "http://timestamp.digicert.com"
	}
	if len(req.TSAFallbackURLs) == 0 {
		req.TSAFallbackURLs = []string{"http://timestamp.sectigo.com", "https://freetsa.org/tsr"}
	}
	if len(req.StrictOptInCountries) == 0 {
		req.StrictOptInCountries = []string{"TR", "EU", "EEA", "GB", "CH"}
	}

	fbBytes, _ := json.Marshal(req.TSAFallbackURLs)
	ccBytes, _ := json.Marshal(req.StrictOptInCountries)

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	_, err := db.Pool.Exec(ctx, `
		UPDATE compliance.consent_settings
		SET banner_enabled = $1,
		    banner_layout = $2,
		    floating_trigger_enabled = $3,
		    ga_measurement_id = $4,
		    google_consent_mode = $5,
		    reconsent_days = $6,
		    iab_enabled = $7,
		    iab_cmp_id = $8,
		    tsa_primary_url = $9,
		    tsa_fallback_urls = $10::jsonb,
		    auto_anchor_interval_min = $11,
		    strict_opt_in_countries = $12::jsonb,
		    updated_at = CURRENT_TIMESTAMP
		WHERE id = 1
	`,
		req.BannerEnabled, layout, req.FloatingTriggerEnabled, strings.TrimSpace(req.GAMeasurementID),
		gcmMode, req.ReconsentDays, req.IABEnabled, req.IABCMPID,
		primaryTSA, string(fbBytes), req.AutoAnchorIntervalMin, string(ccBytes),
	)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Rıza ayarları güncellenemedi")
		return
	}

	updated, _ := loadConsentSettingsRow(ctx)
	httpx.JSON(w, http.StatusOK, updated)
}

// ListAdminCookies returns the full declared + auto-discovered cookie/script inventory.
func (h *ConsentComplianceHandler) ListAdminCookies(w http.ResponseWriter, r *http.Request) {
	if db.Pool == nil {
		httpx.Error(w, http.StatusServiceUnavailable, "Veritabanı hazır değil")
		return
	}
	lang := normalizeConsentLanguage(r.URL.Query().Get("lang"))
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	items, err := loadActiveCookieInventory(ctx, lang, false)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Çerez envanteri okunamadı")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"cookies": items})
}

// UpsertAdminCookie creates or updates a cookie inventory definition across 8 languages.
func (h *ConsentComplianceHandler) UpsertAdminCookie(w http.ResponseWriter, r *http.Request) {
	if db.Pool == nil {
		httpx.Error(w, http.StatusServiceUnavailable, "Veritabanı hazır değil")
		return
	}
	var req cookieUpsertRequest
	if err := httpx.DecodeJSON(r, &req, httpx.DefaultMaxJSONBytes); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Geçersiz çerez tanımı JSON verisi")
		return
	}

	req.CookieName = strings.TrimSpace(req.CookieName)
	req.Provider = strings.TrimSpace(req.Provider)
	req.Domain = strings.TrimSpace(req.Domain)
	if req.Domain == "" {
		req.Domain = "mertervitrini.com.tr"
	}
	req.Duration = strings.TrimSpace(req.Duration)
	if req.Duration == "" {
		req.Duration = "Oturum / Session"
	}
	if req.CookieName == "" || req.Provider == "" || !validCookieCategories[req.Category] || !validStorageTypes[req.StorageType] {
		httpx.Error(w, http.StatusBadRequest, "Çerez adı, sağlayıcı, kategori ve depolama tipi eksiksiz geçerli olmalıdır")
		return
	}
	if req.PurposeTranslations == nil {
		req.PurposeTranslations = map[string]string{}
	}
	transBytes, _ := json.Marshal(req.PurposeTranslations)

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	pathID := strings.TrimSpace(r.PathValue("id"))
	var savedID string
	var err error
	if pathID != "" {
		err = db.Pool.QueryRow(ctx, `
			UPDATE compliance.cookie_inventory
			SET cookie_name = $1, category = $2, provider = $3, domain = $4,
			    storage_type = $5, duration = $6, is_third_party = $7, is_active = $8,
			    purpose_translations = $9::jsonb, updated_at = CURRENT_TIMESTAMP
			WHERE id = $10::uuid
			RETURNING id::text
		`, req.CookieName, req.Category, req.Provider, req.Domain, req.StorageType,
			req.Duration, req.IsThirdParty, req.IsActive, string(transBytes), pathID).Scan(&savedID)
	} else {
		err = db.Pool.QueryRow(ctx, `
			INSERT INTO compliance.cookie_inventory
				(cookie_name, category, provider, domain, storage_type, duration, is_third_party, is_active, source, purpose_translations)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'manual', $9::jsonb)
			ON CONFLICT (cookie_name) DO UPDATE SET
				category = EXCLUDED.category,
				provider = EXCLUDED.provider,
				domain = EXCLUDED.domain,
				storage_type = EXCLUDED.storage_type,
				duration = EXCLUDED.duration,
				is_third_party = EXCLUDED.is_third_party,
				is_active = EXCLUDED.is_active,
				purpose_translations = EXCLUDED.purpose_translations,
				updated_at = CURRENT_TIMESTAMP
			RETURNING id::text
		`, req.CookieName, req.Category, req.Provider, req.Domain, req.StorageType,
			req.Duration, req.IsThirdParty, req.IsActive, string(transBytes)).Scan(&savedID)
	}
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.Error(w, http.StatusNotFound, "Çerez tanımı bulunamadı")
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "Çerez envanteri kaydedilemedi")
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "id": savedID})
}

// DeleteAdminCookie removes an item from the cookie inventory (does not alter historical policy snapshots).
func (h *ConsentComplianceHandler) DeleteAdminCookie(w http.ResponseWriter, r *http.Request) {
	if db.Pool == nil {
		httpx.Error(w, http.StatusServiceUnavailable, "Veritabanı hazır değil")
		return
	}
	id := strings.TrimSpace(r.PathValue("id"))
	if id == "" {
		httpx.Error(w, http.StatusBadRequest, "Çerez ID gerekli")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	tag, err := db.Pool.Exec(ctx, `DELETE FROM compliance.cookie_inventory WHERE id = $1::uuid`, id)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Çerez silinemedi")
		return
	}
	if tag.RowsAffected() == 0 {
		httpx.Error(w, http.StatusNotFound, "Çerez kaydı bulunamadı")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true})
}

func classifyScriptSignature(lowerHTML, rawURL string) []ScanFinding {
	type sigRule struct {
		Needle       string
		Name         string
		Category     string
		Provider     string
		Domain       string
		StorageType  string
		Duration     string
		IsThirdParty bool
		TRPurpose    string
		ENPurpose    string
	}
	rules := []sigRule{
		{
			Needle: "googletagmanager.com/gtag", Name: "_ga", Category: "measurement",
			Provider: "Google Analytics 4", Domain: ".mertervitrini.com.tr", StorageType: "cookie",
			Duration: "2 yıl / 2 years", IsThirdParty: true,
			TRPurpose: "Site trafiği ve sayfa performansı ölçümü (Google Consent Mode v2 uyumlu).",
			ENPurpose: "Traffic and catalog performance analytics (Google Consent Mode v2 aware).",
		},
		{
			Needle: "google.com/recaptcha", Name: "_grecaptcha", Category: "necessary",
			Provider: "Google reCAPTCHA v3", Domain: "google.com", StorageType: "localStorage",
			Duration: "6 ay / 6 months", IsThirdParty: true,
			TRPurpose: "Bot ve spam güvenlik doğrulaması.",
			ENPurpose: "Essential anti-bot and spam security verification.",
		},
		{
			Needle: "fbevents.js", Name: "_fbp", Category: "marketing",
			Provider: "Meta Pixel", Domain: ".mertervitrini.com.tr", StorageType: "cookie",
			Duration: "90 gün / 90 days", IsThirdParty: true,
			TRPurpose: "Pazarlama izni verildiğinde reklam hedefleme ölçümü.",
			ENPurpose: "Advertising attribution when marketing consent is granted.",
		},
		{
			Needle: "clarity.ms", Name: "_clck", Category: "measurement",
			Provider: "Microsoft Clarity", Domain: ".mertervitrini.com.tr", StorageType: "cookie",
			Duration: "1 yıl / 1 year", IsThirdParty: true,
			TRPurpose: "Kullanıcı deneyimi ve ısı haritası analizi.",
			ENPurpose: "UX session and heatmap analytics.",
		},
		{
			Needle: "mc.yandex.ru", Name: "_ym_uid", Category: "measurement",
			Provider: "Yandex Metrica", Domain: ".mertervitrini.com.tr", StorageType: "cookie",
			Duration: "1 yıl / 1 year", IsThirdParty: true,
			TRPurpose: "Yandex arama trafiği ölçüm analitiği.",
			ENPurpose: "Yandex search referral analytics.",
		},
	}

	var detected []ScanFinding
	for _, rule := range rules {
		if strings.Contains(lowerHTML, rule.Needle) {
			detected = append(detected, ScanFinding{
				Name: rule.Name, Category: rule.Category, Provider: rule.Provider,
				Domain: rule.Domain, StorageType: rule.StorageType, Duration: rule.Duration,
				IsThirdParty: rule.IsThirdParty, SourceURL: rawURL,
				Purposes: map[string]string{"tr": rule.TRPurpose, "en": rule.ENPurpose},
			})
		}
	}

	// Capture any third-party script hosts dynamically
	matches := scriptSrcRegex.FindAllStringSubmatch(lowerHTML, 40)
	for _, m := range matches {
		if len(m) < 2 {
			continue
		}
		src := strings.TrimSpace(m[1])
		if strings.HasPrefix(src, "/") || strings.Contains(src, "mertervitrini.com.tr") {
			continue
		}
		parsed, err := url.Parse(src)
		if err != nil || parsed.Host == "" {
			continue
		}
		host := strings.ToLower(parsed.Host)
		if strings.Contains(host, "googletagmanager") || strings.Contains(host, "recaptcha") || strings.Contains(host, "gstatic") {
			continue
		}
		detected = append(detected, ScanFinding{
			Name: "script:" + host, Category: "functionality", Provider: host,
			Domain: host, StorageType: "script", Duration: "Sayfa yükleme / Runtime",
			IsThirdParty: true, SourceURL: rawURL,
			Purposes: map[string]string{
				"tr": fmt.Sprintf("%s harici betik kaynağı.", host),
				"en": fmt.Sprintf("External script resource hosted by %s.", host),
			},
		})
	}
	return detected
}

// RunAdminCookieScan crawls live storefront pages safely, inspects Set-Cookie & scripts, and syncs findings.
func (h *ConsentComplianceHandler) RunAdminCookieScan(w http.ResponseWriter, r *http.Request) {
	if db.Pool == nil {
		httpx.Error(w, http.StatusServiceUnavailable, "Veritabanı hazır değil")
		return
	}

	var req struct {
		Paths        []string `json:"paths"`
		AutoRegister *bool    `json:"auto_register"`
	}
	_ = httpx.DecodeJSON(r, &req, httpx.DefaultMaxJSONBytes)

	autoRegister := true
	if req.AutoRegister != nil {
		autoRegister = *req.AutoRegister
	}

	paths := req.Paths
	if len(paths) == 0 {
		paths = []string{"/", "/tr/b2b", "/en/b2b"}
	}
	if len(paths) > 5 {
		paths = paths[:5]
	}

	baseURL := "http://127.0.0.1:3000"

	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	defer cancel()

	knownNames := map[string]bool{}
	existingRows, _ := db.Pool.Query(ctx, `SELECT cookie_name FROM compliance.cookie_inventory`)
	if existingRows != nil {
		for existingRows.Next() {
			var n string
			if existingRows.Scan(&n) == nil {
				knownNames[n] = true
			}
		}
		existingRows.Close()
	}

	client := &http.Client{Timeout: 8 * time.Second}
	findingByKey := map[string]ScanFinding{}
	var scannedURLs []string

	// Include first-party runtime storage signatures known in storefront bundle
	firstPartyDefaults := []ScanFinding{
		{Name: "c15t", Category: "necessary", Provider: "Merter Vitrini CMP (c15t)", Domain: "mertervitrini.com.tr", StorageType: "cookie", Duration: "365 gün / 1 year", SourceURL: "runtime"},
		{Name: "store_user_token", Category: "necessary", Provider: "Merter Vitrini / Keycloak IAM", Domain: "mertervitrini.com.tr", StorageType: "localStorage", Duration: "Oturum süresince / Session", SourceURL: "runtime"},
		{Name: "merter_b2b_cart", Category: "necessary", Provider: "Merter Vitrini", Domain: "mertervitrini.com.tr", StorageType: "localStorage", Duration: "Kalıcı / Persistent", SourceURL: "runtime"},
		{Name: "preferred_lang", Category: "functionality", Provider: "Merter Vitrini", Domain: "mertervitrini.com.tr", StorageType: "localStorage", Duration: "365 gün / 1 year", SourceURL: "runtime"},
		{Name: "merter_preferred_currency", Category: "functionality", Provider: "Merter Vitrini", Domain: "mertervitrini.com.tr", StorageType: "localStorage", Duration: "365 gün / 1 year", SourceURL: "runtime"},
		{Name: "mv_vid / mv_sid", Category: "measurement", Provider: "Merter Vitrini Analytics", Domain: "mertervitrini.com.tr", StorageType: "localStorage", Duration: "30 dk / 1 yıl", SourceURL: "runtime"},
	}
	for _, fp := range firstPartyDefaults {
		fp.AlreadyKnown = knownNames[fp.Name]
		findingByKey[fp.Name] = fp
	}

	for _, p := range paths {
		cleanPath := "/" + strings.TrimLeft(strings.TrimSpace(p), "/")
		targetURL := baseURL + cleanPath
		scannedURLs = append(scannedURLs, targetURL)

		httpReq, reqErr := http.NewRequestWithContext(ctx, http.MethodGet, targetURL, nil)
		if reqErr != nil {
			continue
		}
		httpReq.Header.Set("User-Agent", "MerterVitrini-CookieScanner/1.0")
		resp, respErr := client.Do(httpReq)
		if respErr != nil {
			continue
		}
		for _, ck := range resp.Cookies() {
			name := strings.TrimSpace(ck.Name)
			if name == "" {
				continue
			}
			f := ScanFinding{
				Name: name, Category: "necessary", Provider: "Merter Vitrini HTTP",
				Domain: "mertervitrini.com.tr", StorageType: "cookie", Duration: "Oturum / Session",
				IsThirdParty: false, SourceURL: targetURL, AlreadyKnown: knownNames[name],
				Purposes: map[string]string{
					"tr": "Sunucu tarafından oluşturulan oturum/güvenlik çerezi.",
					"en": "First-party HTTP cookie set by application server.",
				},
			}
			findingByKey[name] = f
		}
		bodyBytes, _ := io.ReadAll(io.LimitReader(resp.Body, 512*1024))
		resp.Body.Close()

		lowerHTML := strings.ToLower(string(bodyBytes))
		for _, f := range classifyScriptSignature(lowerHTML, targetURL) {
			f.AlreadyKnown = knownNames[f.Name]
			findingByKey[f.Name] = f
		}
	}

	findings := make([]ScanFinding, 0, len(findingByKey))
	newCount := 0
	for _, f := range findingByKey {
		findings = append(findings, f)
		if f.AlreadyKnown {
			_, _ = db.Pool.Exec(ctx, `UPDATE compliance.cookie_inventory SET last_seen_at = CURRENT_TIMESTAMP WHERE cookie_name = $1`, f.Name)
		} else {
			newCount++
			if autoRegister {
				transBytes, _ := json.Marshal(f.Purposes)
				_, _ = db.Pool.Exec(ctx, `
					INSERT INTO compliance.cookie_inventory
						(cookie_name, category, provider, domain, storage_type, duration, is_third_party, is_active, source, purpose_translations, last_seen_at)
					VALUES ($1, $2, $3, $4, $5, $6, $7, true, 'auto_scan', $8::jsonb, CURRENT_TIMESTAMP)
					ON CONFLICT (cookie_name) DO UPDATE SET last_seen_at = CURRENT_TIMESTAMP
				`, f.Name, f.Category, f.Provider, f.Domain, f.StorageType, f.Duration, f.IsThirdParty, string(transBytes))
			}
		}
	}

	triggeredBy := "admin"
	if user, ok := middleware.GetUserFromContext(r.Context()); ok && user.Email != "" {
		triggeredBy = user.Email
	}
	urlsBytes, _ := json.Marshal(scannedURLs)
	findingsBytes, _ := json.Marshal(findings)

	var scanID string
	_ = db.Pool.QueryRow(ctx, `
		INSERT INTO compliance.cookie_scan_runs (triggered_by, scanned_urls, detected_count, new_cookies_count, findings)
		VALUES ($1, $2::jsonb, $3, $4, $5::jsonb)
		RETURNING id::text
	`, triggeredBy, string(urlsBytes), len(findings), newCount, string(findingsBytes)).Scan(&scanID)

	httpx.JSON(w, http.StatusOK, map[string]any{
		"scan_id":           scanID,
		"scanned_urls":      scannedURLs,
		"detected_count":    len(findings),
		"new_cookies_count": newCount,
		"auto_registered":   autoRegister,
		"findings":          findings,
	})
}

// ListAdminScanRuns lists historical automated cookie/script scan reports.
func (h *ConsentComplianceHandler) ListAdminScanRuns(w http.ResponseWriter, r *http.Request) {
	if db.Pool == nil {
		httpx.Error(w, http.StatusServiceUnavailable, "Veritabanı hazır değil")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	rows, err := db.Pool.Query(ctx, `
		SELECT id::text, coalesce(triggered_by,''), scanned_urls, detected_count, new_cookies_count, created_at
		FROM compliance.cookie_scan_runs
		ORDER BY created_at DESC
		LIMIT 20
	`)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Tarama geçmişi okunamadı")
		return
	}
	defer rows.Close()

	var runs []map[string]any
	for rows.Next() {
		var id, triggeredBy string
		var urlsRaw []byte
		var detected, newCnt int
		var createdAt time.Time
		if rows.Scan(&id, &triggeredBy, &urlsRaw, &detected, &newCnt, &createdAt) == nil {
			var urls []string
			_ = json.Unmarshal(urlsRaw, &urls)
			runs = append(runs, map[string]any{
				"id":                id,
				"triggered_by":      triggeredBy,
				"scanned_urls":      urls,
				"detected_count":    detected,
				"new_cookies_count": newCnt,
				"created_at":        createdAt.UTC().Format(time.RFC3339),
			})
		}
	}
	if runs == nil {
		runs = []map[string]any{}
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"runs": runs})
}
