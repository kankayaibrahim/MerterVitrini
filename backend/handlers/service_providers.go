package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"mertervitrini/backend/config"
	"mertervitrini/backend/db"
	"mertervitrini/backend/pkg/mailer"
)

var serviceProvidersSchemaOnce sync.Once

func ensureServiceProvidersSchema(ctx context.Context) {
	serviceProvidersSchemaOnce.Do(func() {
		ddl := `
		CREATE TABLE IF NOT EXISTS catalog.service_providers (
			id UUID PRIMARY KEY DEFAULT uuidv7(),
			slug VARCHAR(180) NOT NULL UNIQUE,
			company_name VARCHAR(200) NOT NULL,
			contact_name VARCHAR(150) NOT NULL DEFAULT '',
			service_category VARCHAR(64) NOT NULL DEFAULT 'kargo_lojistik',
			short_description VARCHAR(300) NOT NULL DEFAULT '',
			description TEXT NOT NULL DEFAULT '',
			services_offered TEXT NOT NULL DEFAULT '',
			target_countries VARCHAR(255) NOT NULL DEFAULT '',
			city VARCHAR(100) NOT NULL DEFAULT 'İstanbul',
			district VARCHAR(100) NOT NULL DEFAULT 'Merter',
			address TEXT NOT NULL DEFAULT '',
			phone VARCHAR(64) NOT NULL DEFAULT '',
			whatsapp_phone VARCHAR(64) NOT NULL DEFAULT '',
			email VARCHAR(180) NOT NULL DEFAULT '',
			website VARCHAR(255) NOT NULL DEFAULT '',
			logo_url TEXT NOT NULL DEFAULT '',
			status VARCHAR(32) NOT NULL DEFAULT 'pending',
			email_verified BOOLEAN NOT NULL DEFAULT false,
			verification_token VARCHAR(128),
			verification_expires_at TIMESTAMPTZ,
			ip_address VARCHAR(64) NOT NULL DEFAULT '',
			is_verified BOOLEAN NOT NULL DEFAULT true,
			is_sponsored BOOLEAN NOT NULL DEFAULT false,
			is_active BOOLEAN NOT NULL DEFAULT true,
			priority INT NOT NULL DEFAULT 10,
			view_count BIGINT NOT NULL DEFAULT 0,
			whatsapp_click_count BIGINT NOT NULL DEFAULT 0,
			translations JSONB NOT NULL DEFAULT '{}'::jsonb,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
		ALTER TABLE catalog.service_providers ADD COLUMN IF NOT EXISTS contact_name VARCHAR(150) NOT NULL DEFAULT '';
		ALTER TABLE catalog.service_providers ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'pending';
		ALTER TABLE catalog.service_providers ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;
		ALTER TABLE catalog.service_providers ADD COLUMN IF NOT EXISTS verification_token VARCHAR(128);
		ALTER TABLE catalog.service_providers ADD COLUMN IF NOT EXISTS verification_expires_at TIMESTAMPTZ;
		ALTER TABLE catalog.service_providers ADD COLUMN IF NOT EXISTS ip_address VARCHAR(64) NOT NULL DEFAULT '';
		CREATE INDEX IF NOT EXISTS idx_service_providers_category_active
			ON catalog.service_providers (service_category, is_active, is_sponsored DESC, priority ASC);
		`
		_, _ = db.Pool.Exec(ctx, ddl)

		cleanupDemoSeedSQL := `
		DELETE FROM catalog.service_providers
		WHERE slug IN (
			'merter-global-kargo-lojistik',
			'studio-merter-lookbook-produksiyon',
			'merter-etiket-ve-luks-ambalaj',
			'pro-kalip-dijital-modelhane-merter',
			'avrasya-tekstil-ihracat-ve-gumruk-danismanligi'
		);
		`
		_, _ = db.Pool.Exec(ctx, cleanupDemoSeedSQL)
	})
}

// ServiceProviderDTO represents a B2B Sectoral Service Provider (Cargo, Studio, Label/Packaging, Pattern Making, Export Consulting).
type ServiceProviderDTO struct {
	ID                 string          `json:"id"`
	Slug               string          `json:"slug"`
	CompanyName        string          `json:"company_name"`
	ContactName        string          `json:"contact_name"`
	ServiceCategory    string          `json:"service_category"`
	ShortDescription   string          `json:"short_description"`
	Description        string          `json:"description"`
	ServicesOffered    string          `json:"services_offered"`
	TargetCountries    string          `json:"target_countries"`
	City               string          `json:"city"`
	District           string          `json:"district"`
	Address            string          `json:"address"`
	Phone              string          `json:"phone"`
	WhatsappPhone      string          `json:"whatsapp_phone"`
	Email              string          `json:"email"`
	Website            string          `json:"website"`
	LogoURL            string          `json:"logo_url"`
	Status             string          `json:"status"`
	EmailVerified      bool            `json:"email_verified"`
	IsVerified         bool            `json:"is_verified"`
	IsSponsored        bool            `json:"is_sponsored"`
	IsActive           bool            `json:"is_active"`
	Priority           int             `json:"priority"`
	ViewCount          int64           `json:"view_count"`
	WhatsappClickCount int64           `json:"whatsapp_click_count"`
	Translations       json.RawMessage `json:"translations"`
	CreatedAt          time.Time       `json:"created_at"`
}

func slugifyServiceProviderName(name string) string {
	replacer := strings.NewReplacer(
		"ç", "c", "Ç", "c",
		"ğ", "g", "Ğ", "g",
		"ı", "i", "İ", "i",
		"ö", "o", "Ö", "o",
		"ş", "s", "Ş", "s",
		"ü", "u", "Ü", "u",
	)
	s := strings.ToLower(replacer.Replace(strings.TrimSpace(name)))
	var b strings.Builder
	prevDash := false
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
			prevDash = false
		} else if !prevDash && b.Len() > 0 {
			b.WriteRune('-')
			prevDash = true
		}
	}
	res := strings.Trim(b.String(), "-")
	if res == "" {
		res = "hizmet-saglayici"
	}
	return fmt.Sprintf("%s-%d", res, time.Now().Unix()%10000)
}

func verifyServiceProviderReCaptcha(cfg *config.Config, token, action string) (bool, error) {
	return verifyPublicFormReCaptcha(cfg, token, action, true)
}

// ListPublicServiceProviders handles GET /api/v1/store/service-providers.
func (h *MarketplaceHandler) ListPublicServiceProviders(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	ensureServiceProvidersSchema(ctx)

	category := strings.TrimSpace(r.URL.Query().Get("category"))
	searchQ := strings.TrimSpace(r.URL.Query().Get("q"))
	searchPattern := "%" + searchQ + "%"

	rows, err := db.Pool.Query(ctx, `
		SELECT
			id::text, slug, company_name, COALESCE(contact_name, ''), service_category, short_description, description,
			services_offered, target_countries, city, district, address,
			phone, whatsapp_phone, email, website, logo_url,
			COALESCE(status, 'approved'), COALESCE(email_verified, true),
			is_verified, is_sponsored, is_active, priority,
			view_count, whatsapp_click_count, COALESCE(translations, '{}'::jsonb), created_at
		FROM catalog.service_providers
		WHERE is_active = true
		  AND ($1 = '' OR $1 = 'all' OR service_category = $1)
		  AND ($2 = '' OR company_name ILIKE $3 OR short_description ILIKE $3 OR services_offered ILIKE $3 OR target_countries ILIKE $3)
		ORDER BY is_sponsored DESC, priority ASC, company_name ASC
	`, category, searchQ, searchPattern)
	if err != nil {
		writeMarketplaceJSON(w, http.StatusOK, []ServiceProviderDTO{})
		return
	}
	defer rows.Close()

	items := make([]ServiceProviderDTO, 0)
	for rows.Next() {
		var item ServiceProviderDTO
		var rawTrans []byte
		if scanErr := rows.Scan(
			&item.ID, &item.Slug, &item.CompanyName, &item.ContactName, &item.ServiceCategory, &item.ShortDescription, &item.Description,
			&item.ServicesOffered, &item.TargetCountries, &item.City, &item.District, &item.Address,
			&item.Phone, &item.WhatsappPhone, &item.Email, &item.Website, &item.LogoURL,
			&item.Status, &item.EmailVerified,
			&item.IsVerified, &item.IsSponsored, &item.IsActive, &item.Priority,
			&item.ViewCount, &item.WhatsappClickCount, &rawTrans, &item.CreatedAt,
		); scanErr == nil {
			item.Translations = json.RawMessage(rawTrans)
			items = append(items, item)
		}
	}

	writeMarketplaceJSON(w, http.StatusOK, items)
}

type serviceProviderApplyPayload struct {
	CompanyName        string `json:"company_name"`
	ContactName        string `json:"contact_name"`
	ServiceCategory    string `json:"service_category"`
	ShortDescription   string `json:"short_description"`
	ServicesOffered    string `json:"services_offered"`
	TargetCountries    string `json:"target_countries"`
	Address            string `json:"address"`
	Phone              string `json:"phone"`
	WhatsappPhone      string `json:"whatsapp_phone"`
	Email              string `json:"email"`
	Website            string `json:"website"`
	ReCaptchaToken     string `json:"recaptcha_token"`
	ChallengeToken     string `json:"challenge_token,omitempty"`
	FormChallengeToken string `json:"form_challenge_token,omitempty"`
}

func validateServiceProviderApplyPayload(req *serviceProviderApplyPayload) string {
	req.CompanyName = strings.TrimSpace(req.CompanyName)
	req.ContactName = strings.TrimSpace(req.ContactName)
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.Phone = strings.TrimSpace(req.Phone)
	req.ShortDescription = strings.TrimSpace(req.ShortDescription)

	if req.CompanyName == "" || req.ContactName == "" || req.Email == "" || req.Phone == "" || req.ShortDescription == "" {
		return "Firma unvanı, yetkili adı, kurumsal e-posta, telefon ve kısa tanıtım alanları zorunludur."
	}
	if !supplierEmailRegex.MatchString(req.Email) {
		return "Lütfen geçerli bir e-posta adresi giriniz."
	}
	if strings.TrimSpace(req.ServiceCategory) == "" {
		req.ServiceCategory = "kargo_lojistik"
	}
	if strings.TrimSpace(req.WhatsappPhone) == "" {
		req.WhatsappPhone = req.Phone
	}
	return ""
}

func (h *MarketplaceHandler) createServiceProviderApplication(w http.ResponseWriter, r *http.Request, req serviceProviderApplyPayload) {
	ctx := r.Context()
	ensureServiceProvidersSchema(ctx)

	slug := slugifyServiceProviderName(req.CompanyName)
	verificationToken := generateSecureToken(32)
	verificationExpires := time.Now().Add(30 * time.Minute)
	ip := getClientIP(r)

	var id string
	err := db.Pool.QueryRow(ctx, `
		INSERT INTO catalog.service_providers (
			slug, company_name, contact_name, service_category, short_description, description,
			services_offered, target_countries, city, district, address,
			phone, whatsapp_phone, email, website,
			status, email_verified, verification_token, verification_expires_at, ip_address,
			is_verified, is_sponsored, is_active, priority
		) VALUES ($1, $2, $3, $4, $5, $5, $6, $7, 'İstanbul', 'Merter', $8, $9, $10, $11, $12, 'pending', false, $13, $14, $15, false, false, false, 50)
		RETURNING id::text
	`,
		slug,
		req.CompanyName,
		req.ContactName,
		strings.TrimSpace(req.ServiceCategory),
		req.ShortDescription,
		strings.TrimSpace(req.ServicesOffered),
		strings.TrimSpace(req.TargetCountries),
		strings.TrimSpace(req.Address),
		req.Phone,
		strings.TrimSpace(req.WhatsappPhone),
		req.Email,
		strings.TrimSpace(req.Website),
		verificationToken,
		verificationExpires,
		ip,
	).Scan(&id)
	if err != nil {
		writeMarketplaceJSON(w, http.StatusInternalServerError, map[string]string{"error": "Başvuru kaydedilemedi"})
		return
	}

	if h.Cfg != nil {
		verifyURL := fmt.Sprintf("https://mertervitrini.com.tr/hizmet-saglayicilar?verify_token=%s", verificationToken)
		mailer.SendServiceProviderVerificationEmail(h.Cfg, req.CompanyName, req.ContactName, req.Email, verifyURL)
	}

	writeMarketplaceJSON(w, http.StatusCreated, map[string]any{
		"id":                 id,
		"status":             "pending_verification",
		"expires_in_minutes": 30,
		"message":            fmt.Sprintf("Başvurunuz oluşturuldu. Lütfen 30 dakika içinde %s adresinize gönderilen doğrulama bağlantısına tıklayarak e-posta adresinizi onaylayınız.", req.Email),
	})
}

// CreatePublicServiceProviderApplication handles POST /api/v1/store/service-providers.
func (h *MarketplaceHandler) CreatePublicServiceProviderApplication(w http.ResponseWriter, r *http.Request) {
	var req serviceProviderApplyPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeMarketplaceJSON(w, http.StatusBadRequest, map[string]string{"error": "Geçersiz başvuru verisi"})
		return
	}

	if errMsg := validateServiceProviderApplyPayload(&req); errMsg != "" {
		writeMarketplaceJSON(w, http.StatusBadRequest, map[string]string{"error": errMsg})
		return
	}

	if valid, err := verifyServiceProviderReCaptcha(h.Cfg, req.ReCaptchaToken, "service_provider_apply"); err != nil || !valid {
		writeMarketplaceJSON(w, http.StatusBadRequest, map[string]string{"error": "Güvenlik doğrulaması (Google reCAPTCHA) başarısız oldu. Lütfen tekrar deneyin."})
		return
	}

	h.createServiceProviderApplication(w, r, req)
}

// VerifyServiceProviderEmail handles GET /api/v1/store/service-providers/verify?token=...
func (h *MarketplaceHandler) VerifyServiceProviderEmail(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	ensureServiceProvidersSchema(ctx)

	token := strings.TrimSpace(r.URL.Query().Get("token"))
	if token == "" {
		writeMarketplaceJSON(w, http.StatusBadRequest, map[string]string{"error": "Doğrulama belirteci (token) eksik"})
		return
	}

	var id, companyName, contactName, email, phone, category, shortDesc, address string
	var emailVerified bool
	var expiresAt *time.Time

	err := db.Pool.QueryRow(ctx, `
		SELECT
			id::text, company_name, COALESCE(contact_name, ''), email, phone,
			service_category, short_description, address, COALESCE(email_verified, false), verification_expires_at
		FROM catalog.service_providers
		WHERE verification_token = $1
	`, token).Scan(
		&id, &companyName, &contactName, &email, &phone,
		&category, &shortDesc, &address, &emailVerified, &expiresAt,
	)
	if err != nil {
		writeMarketplaceJSON(w, http.StatusNotFound, map[string]string{
			"error": "Geçersiz veya süresi dolmuş doğrulama bağlantısı. 30 dakika içinde doğrulanmayan başvurular otomatik olarak silinmektedir.",
		})
		return
	}

	if emailVerified {
		writeMarketplaceJSON(w, http.StatusOK, map[string]any{
			"success":          true,
			"already_verified": true,
			"company_name":     companyName,
			"message":          "E-posta adresiniz daha önce doğrulandı. Başvurunuz yönetici onay aşamasındadır.",
		})
		return
	}

	if expiresAt != nil && time.Now().After(*expiresAt) {
		_, _ = db.Pool.Exec(ctx, `DELETE FROM catalog.service_providers WHERE id::text = $1`, id)
		writeMarketplaceJSON(w, http.StatusGone, map[string]string{
			"error": "Doğrulama bağlantısının 30 dakikalık süresi dolmuştur ve başvuru güvenlik politikası gereğince silinmiştir. Lütfen tekrar başvuru yapınız.",
		})
		return
	}

	_, err = db.Pool.Exec(ctx, `
		UPDATE catalog.service_providers
		SET email_verified = true, verification_token = NULL, updated_at = NOW()
		WHERE id::text = $1
	`, id)
	if err != nil {
		writeMarketplaceJSON(w, http.StatusInternalServerError, map[string]string{"error": "Doğrulama işlemi tamamlanamadı"})
		return
	}

	if h.Cfg != nil {
		meta := mailer.ExtractClientMeta(r)
		mailer.SendServiceProviderAdminNotification(h.Cfg, mailer.ServiceProviderApplicationEmailData{
			CompanyName:     companyName,
			ContactName:     contactName,
			Email:           email,
			Phone:           phone,
			ServiceCategory: category,
			ShortDesc:       shortDesc,
			Address:         address,
		}, meta)
	}

	writeMarketplaceJSON(w, http.StatusOK, map[string]any{
		"success":      true,
		"company_name": companyName,
		"message":      "E-posta adresiniz başarıyla doğrulandı! Başvurunuz yönetici onayına iletilmiştir.",
	})
}

// TrackServiceProviderClick handles POST /api/v1/store/service-providers/{id}/click.
func (h *MarketplaceHandler) TrackServiceProviderClick(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	ensureServiceProvidersSchema(ctx)

	providerID := strings.TrimSpace(r.PathValue("id"))
	if providerID != "" {
		_, _ = db.Pool.Exec(ctx, `
			UPDATE catalog.service_providers
			SET whatsapp_click_count = whatsapp_click_count + 1, updated_at = NOW()
			WHERE id::text = $1
		`, providerID)
	}
	writeMarketplaceJSON(w, http.StatusOK, map[string]string{"status": "recorded"})
}

// ListAdminServiceProviders handles GET /api/v1/admin/service-providers.
func (h *MarketplaceHandler) ListAdminServiceProviders(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	ensureServiceProvidersSchema(ctx)

	rows, err := db.Pool.Query(ctx, `
		SELECT
			id::text, slug, company_name, COALESCE(contact_name, ''), service_category, short_description, description,
			services_offered, target_countries, city, district, address,
			phone, whatsapp_phone, email, website, logo_url,
			COALESCE(status, 'pending'), COALESCE(email_verified, false),
			is_verified, is_sponsored, is_active, priority,
			view_count, whatsapp_click_count, COALESCE(translations, '{}'::jsonb), created_at
		FROM catalog.service_providers
		ORDER BY is_sponsored DESC, priority ASC, created_at DESC
	`)
	if err != nil {
		writeMarketplaceJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()

	items := make([]ServiceProviderDTO, 0)
	for rows.Next() {
		var item ServiceProviderDTO
		var rawTrans []byte
		if scanErr := rows.Scan(
			&item.ID, &item.Slug, &item.CompanyName, &item.ContactName, &item.ServiceCategory, &item.ShortDescription, &item.Description,
			&item.ServicesOffered, &item.TargetCountries, &item.City, &item.District, &item.Address,
			&item.Phone, &item.WhatsappPhone, &item.Email, &item.Website, &item.LogoURL,
			&item.Status, &item.EmailVerified,
			&item.IsVerified, &item.IsSponsored, &item.IsActive, &item.Priority,
			&item.ViewCount, &item.WhatsappClickCount, &rawTrans, &item.CreatedAt,
		); scanErr == nil {
			item.Translations = json.RawMessage(rawTrans)
			items = append(items, item)
		}
	}

	writeMarketplaceJSON(w, http.StatusOK, items)
}

// UpdateAdminServiceProvider handles PUT /api/v1/admin/service-providers/{id}.
func (h *MarketplaceHandler) UpdateAdminServiceProvider(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	ensureServiceProvidersSchema(ctx)

	id := strings.TrimSpace(r.PathValue("id"))
	var req struct {
		Status      *string `json:"status"`
		IsActive    *bool   `json:"is_active"`
		IsVerified  *bool   `json:"is_verified"`
		IsSponsored *bool   `json:"is_sponsored"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeMarketplaceJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid payload"})
		return
	}

	var companyName, contactName, email, prevStatus string
	_ = db.Pool.QueryRow(ctx, `
		SELECT company_name, COALESCE(contact_name, ''), email, COALESCE(status, 'pending')
		FROM catalog.service_providers WHERE id::text = $1
	`, id).Scan(&companyName, &contactName, &email, &prevStatus)

	_, err := db.Pool.Exec(ctx, `
		UPDATE catalog.service_providers
		SET
			status = COALESCE($2, status),
			is_active = COALESCE($3, is_active),
			is_verified = COALESCE($4, is_verified),
			is_sponsored = COALESCE($5, is_sponsored),
			updated_at = NOW()
		WHERE id::text = $1
	`, id, req.Status, req.IsActive, req.IsVerified, req.IsSponsored)
	if err != nil {
		writeMarketplaceJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	if h.Cfg != nil && req.Status != nil && *req.Status == "approved" && prevStatus != "approved" && email != "" {
		mailer.SendServiceProviderApprovedEmail(h.Cfg, companyName, contactName, email)
	}

	writeMarketplaceJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

// DeleteAdminServiceProvider handles DELETE /api/v1/admin/service-providers/{id}.
func (h *MarketplaceHandler) DeleteAdminServiceProvider(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	ensureServiceProvidersSchema(ctx)

	id := strings.TrimSpace(r.PathValue("id"))
	_, _ = db.Pool.Exec(ctx, `DELETE FROM catalog.service_providers WHERE id::text = $1`, id)
	writeMarketplaceJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}
